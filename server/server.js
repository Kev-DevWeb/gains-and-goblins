import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const prisma = new PrismaClient();
const app = express();

const frontendUrl = process.env.FRONTEND_URL?.trim();

function isVercelOrigin(origin) {
  try {
    return typeof origin === 'string' && origin.endsWith('.vercel.app');
  } catch (e) { return false; }
}

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl)
    if (!origin) return callback(null, true);

    // Allow exact configured frontend URL
    if (frontendUrl && origin === frontendUrl) return callback(null, true);

    // Allow localhost dev origins
    if (origin === 'http://localhost:3000' || origin === 'http://localhost:5173') return callback(null, true);

    // Allow any vercel.app subdomain (preview deployments)
    if (isVercelOrigin(origin)) return callback(null, true);

    // Deny otherwise
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
};

// Lightweight origin logger to help debug CORS issues in production logs
app.use((req, res, next) => {
  if (req.headers && req.headers.origin) {
    console.log('[CORS] origin=', req.headers.origin, 'path=', req.path);
  }
  next();
});

app.use(cors(corsOptions));
app.use(express.json());

const PORT = process.env.PORT || 3001;

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'gains-and-goblins-api' });
});

// ── AUTH ENDPOINTS ───────────────────────────────────────────

// Register new user and create their default character
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Faltan datos de registro.' });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'El correo ya está registrado.' });
    }

    // In a real production app we would hash the password using bcrypt.
    // For local MVP / simplicity, we save it directly (or hash if required).
    const user = await prisma.user.create({
      data: {
        email,
        password, // Save password directly for easy setup
        character: {
          create: {
            name,
            level: 1,
            xp: 0,
            gold: 0,
            moral: 0,
            strength: 5,
            resistance: 5,
            dexterity: 5,
            speed: 5,
            intelligence: 5,
            maxMana: 20,
            willpower: 5,
            charisma: 5,
            branchPoints: { strength: 0, dexterity: 0, intelligence: 0, willpower: 0 },
            inventory: [],
            activitiesToday: {},
            lastActivityAt: new Date(),
            lastDecayAppliedAt: new Date(),
          }
        }
      },
      include: {
        character: true
      }
    });

    res.json({ message: 'Registro exitoso.', userId: user.id, character: user.character });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al registrar usuario.' });
  }
});

// Login user and fetch character
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Faltan credenciales.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { character: true }
    });

    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    // Perform check for long-term inactivity on login
    let character = user.character;
    if (character) {
      character = await checkInactivityAndDecay(character.id);
    }

    res.json({ message: 'Login exitoso.', userId: user.id, character });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al iniciar sesión.' });
  }
});

// ── CHARACTER & SYNC ENDPOINTS ───────────────────────────────

// Fetch character details
app.get('/api/character/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    let character = await prisma.character.findUnique({
      where: { userId }
    });

    if (!character) {
      return res.status(444).json({ error: 'Personaje no encontrado.' });
    }

    // Perform check on fetch
    character = await checkInactivityAndDecay(character.id);

    res.json(character);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener personaje.' });
  }
});

// Sync/Save character state and log new activities
app.post('/api/character/sync', async (req, res) => {
  const { userId, xp, gold, moral, stats, branchPoints, inventory, activitiesToday, newActivityLogged } = req.body;

  try {
    let character = await prisma.character.findUnique({
      where: { userId }
    });

    if (!character) {
      return res.status(404).json({ error: 'Personaje no encontrado.' });
    }

    // Log activity if client reports a new activity was logged
    if (newActivityLogged) {
      await prisma.activity.create({
        data: {
          characterId: character.id,
          type: newActivityLogged.type,
          xpEarned: newActivityLogged.xpEarned || 50,
        }
      });
    }

    // Check inactivity and decay
    character = await checkInactivityAndDecay(character.id);

    // Enforce Balanced Growth (Level requirements check)
    // Client sends the stats and xp it wants to save. We validate level on server:
    let computedLevel = character.level;
    let computedXp = xp !== undefined ? xp : character.xp;

    const currentStats = stats || {
      strength: character.strength,
      resistance: character.resistance,
      dexterity: character.dexterity,
      speed: character.speed,
      intelligence: character.intelligence,
      maxMana: character.maxMana,
      willpower: character.willpower,
      charisma: character.charisma
    };

    // Calculate level up iteratively if they meet conditions
    let levelCheck = true;
    let blockedLevelUp = false;
    
    while (levelCheck) {
      const xpNeeded = computedLevel * 50;
      if (computedXp >= xpNeeded) {
        // Stats requirement for Level L -> L+1: all stats must be >= 5 + L
        const reqValue = 5 + computedLevel;
        
        // Map maxMana to equivalent stat scale: starting at 20 mana, +1 stats = +5 mana max, so scale is stats_value = maxMana / 4 (since base willpower is 5, maxMana is 20)
        // Wait, equivalent stat value for maxMana: (maxMana - 20) / 1 + 5?
        // Let's simplify: in our code, when maxMana goes up, it goes up by 1: `this.stats[statKey] += 1`
        // So character.stats.maxMana is actually the stat value itself, which starts at 5 and is displayed as Maná Máx!
        // Yes, `this.stats.maxMana` starts at 5 (equivalent to 20 mana).
        const statsToVerify = [
          currentStats.strength,
          currentStats.resistance,
          currentStats.dexterity,
          currentStats.speed,
          currentStats.intelligence,
          currentStats.maxMana,
          currentStats.willpower,
          currentStats.charisma
        ];

        const isBalanced = statsToVerify.every(val => val >= reqValue);

        if (isBalanced) {
          computedLevel += 1;
        } else {
          blockedLevelUp = true;
          levelCheck = false;
        }
      } else {
        levelCheck = false;
      }
    }

    // Update character state in DB
    const updateData = {
      xp: computedXp,
      gold: gold !== undefined ? gold : character.gold,
      moral: moral !== undefined ? moral : character.moral,
      level: computedLevel,
      lastActivityAt: newActivityLogged ? new Date() : character.lastActivityAt,
    };

    if (stats) {
      updateData.strength = stats.strength;
      updateData.resistance = stats.resistance;
      updateData.dexterity = stats.dexterity;
      updateData.speed = stats.speed;
      updateData.intelligence = stats.intelligence;
      updateData.maxMana = stats.maxMana;
      updateData.willpower = stats.willpower;
      updateData.charisma = stats.charisma;
    }

    if (branchPoints) updateData.branchPoints = branchPoints;
    if (inventory) updateData.inventory = inventory;
    if (activitiesToday) updateData.activitiesToday = activitiesToday;

    const updatedCharacter = await prisma.character.update({
      where: { id: character.id },
      data: updateData
    });

    res.json({
      character: updatedCharacter,
      blockedLevelUp,
      requiredStatValue: 5 + updatedCharacter.level,
      decayApplied: character.lastDecayAppliedAt.getTime() !== updatedCharacter.lastDecayAppliedAt.getTime() && updatedCharacter.lastDecayAppliedAt > character.lastDecayAppliedAt
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al sincronizar datos.' });
  }
});

// ── LOGIC HELPERS ────────────────────────────────────────────

async function checkInactivityAndDecay(characterId) {
  const character = await prisma.character.findUnique({
    where: { id: characterId }
  });

  if (!character) return null;

  const now = new Date();
  let updatedCharacter = character;

  // 1. Check Larga Inactividad (> 21 días)
  const msSinceLastActivity = now.getTime() - character.lastActivityAt.getTime();
  const daysSinceLastActivity = msSinceLastActivity / (1000 * 60 * 60 * 24);

  if (daysSinceLastActivity > 21 && !character.inRecovery) {
    // Penalize and backup stats
    const statsBackup = {
      level: character.level,
      strength: character.strength,
      resistance: character.resistance,
      dexterity: character.dexterity,
      speed: character.speed,
      intelligence: character.intelligence,
      maxMana: character.maxMana,
      willpower: character.willpower,
      charisma: character.charisma
    };

    // 30% reduction on current stats (min 5)
    const penalize = (val) => Math.max(5, Math.round(val * 0.7));

    updatedCharacter = await prisma.character.update({
      where: { id: characterId },
      data: {
        inRecovery: true,
        recoveryStartedAt: null, // will mark when they log their first activity back
        recoveryBackup: statsBackup,
        level: Math.max(1, character.level - 2), // reduce level by 2
        strength: penalize(character.strength),
        resistance: penalize(character.resistance),
        dexterity: penalize(character.dexterity),
        speed: penalize(character.speed),
        intelligence: penalize(character.intelligence),
        maxMana: penalize(character.maxMana),
        willpower: penalize(character.willpower),
        charisma: penalize(character.charisma),
        lastActivityAt: now // Reset lastActivity to now so penalty doesn't keep triggering
      }
    });
  }

  // 2. Check Recovery Progress
  if (updatedCharacter.inRecovery) {
    // If they have registered their first activity since recovery, check if 30 days have passed
    // and if they remained consistent.
    const activities = await prisma.activity.findMany({
      where: {
        characterId,
        loggedAt: { gte: updatedCharacter.lastActivityAt } // activities logged since they returned
      },
      orderBy: { loggedAt: 'asc' }
    });

    if (activities.length > 0 && !updatedCharacter.recoveryStartedAt) {
      // Mark start of recovery month
      updatedCharacter = await prisma.character.update({
        where: { id: characterId },
        data: { recoveryStartedAt: activities[0].loggedAt }
      });
    }

    if (updatedCharacter.recoveryStartedAt) {
      const msInRecovery = now.getTime() - updatedCharacter.recoveryStartedAt.getTime();
      const daysInRecovery = msInRecovery / (1000 * 60 * 60 * 24);

      if (daysInRecovery >= 30) {
        // Verify consistency: 3 activities per week for 4 consecutive weeks
        // Let's divide the 30 days into 4 blocks of 7 days
        let isConsistent = true;
        for (let week = 0; week < 4; week++) {
          const weekStart = new Date(updatedCharacter.recoveryStartedAt.getTime() + week * 7 * 24 * 60 * 60 * 1000);
          const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
          
          const weekActivities = activities.filter(a => a.loggedAt >= weekStart && a.loggedAt < weekEnd);
          if (weekActivities.length < 3) {
            isConsistent = false;
            break;
          }
        }

        if (isConsistent) {
          // Recover original level and stats!
          const backup = updatedCharacter.recoveryBackup;
          updatedCharacter = await prisma.character.update({
            where: { id: characterId },
            data: {
              inRecovery: false,
              recoveryStartedAt: null,
              recoveryBackup: null,
              level: backup.level,
              strength: backup.strength,
              resistance: backup.resistance,
              dexterity: backup.dexterity,
              speed: backup.speed,
              intelligence: backup.intelligence,
              maxMana: backup.maxMana,
              willpower: backup.willpower,
              charisma: backup.charisma
            }
          });
        } else {
          // Restart recovery: consistency check failed!
          // Reset recovery started date to their latest activity
          const latestActivity = activities[activities.length - 1];
          updatedCharacter = await prisma.character.update({
            where: { id: characterId },
            data: {
              recoveryStartedAt: latestActivity ? latestActivity.loggedAt : null
            }
          });
        }
      }
    }
  }

  // 3. Weekly Stat Decay Check (< 3 activities per week)
  const msSinceLastDecay = now.getTime() - updatedCharacter.lastDecayAppliedAt.getTime();
  const daysSinceLastDecay = msSinceLastDecay / (1000 * 60 * 60 * 24);

  if (daysSinceLastDecay >= 7) {
    // Count activities in the last 7 days
    const last7DaysDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const count = await prisma.activity.count({
      where: {
        characterId,
        loggedAt: { gte: last7DaysDate }
      }
    });

    if (count < 3) {
      // Decay stats by 1 point (min 5)
      const decay = (val) => Math.max(5, val - 1);
      updatedCharacter = await prisma.character.update({
        where: { id: characterId },
        data: {
          lastDecayAppliedAt: now,
          strength: decay(updatedCharacter.strength),
          resistance: decay(updatedCharacter.resistance),
          dexterity: decay(updatedCharacter.dexterity),
          speed: decay(updatedCharacter.speed),
          intelligence: decay(updatedCharacter.intelligence),
          maxMana: decay(updatedCharacter.maxMana),
          willpower: decay(updatedCharacter.willpower),
          charisma: decay(updatedCharacter.charisma)
        }
      });
    } else {
      // Reset decay check timer to now
      updatedCharacter = await prisma.character.update({
        where: { id: characterId },
        data: {
          lastDecayAppliedAt: now
        }
      });
    }
  }

  return updatedCharacter;
}

// Start Server
app.listen(PORT, () => {
  console.log(`Servidor de Gains & Goblins escuchando en puerto ${PORT}`);
});
