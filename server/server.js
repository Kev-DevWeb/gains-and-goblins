import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { Server } from 'socket.io';
import http from 'http';

dotenv.config();

const prisma = new PrismaClient();
const app = express();

const parties = new Map(); // key: partyName, value: { id, members: [{ socketId, userId, characterName }] }
const partyDisconnectTimers = new Map(); // key: userId, value: setTimeout object
const activePlayers = new Map();

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

// Sync/Save character state and log new activities (stats & branch points allocation only)
app.post('/api/character/sync', async (req, res) => {
  const { userId, xp, moral, stats, branchPoints, activitiesToday, newActivityLogged } = req.body;

  try {
    let character = await prisma.character.findUnique({
      where: { userId }
    });

    if (!character) {
      return res.status(404).json({ error: 'Personaje no encontrado.' });
    }

    // Validate stat allocation to prevent hacking
    if (stats && branchPoints) {
      const branches = ['strength', 'dexterity', 'intelligence', 'willpower'];
      const branchStats = {
        strength: ['strength', 'resistance'],
        dexterity: ['dexterity', 'speed'],
        intelligence: ['intelligence', 'maxMana'],
        willpower: ['willpower', 'charisma']
      };

      let isValid = true;
      for (const bKey of branches) {
        const oldStatSum = branchStats[bKey].reduce((sum, key) => sum + (character[key] || 5), 0);
        const oldBp = character.branchPoints[bKey] || 0;
        const oldTotal = oldStatSum + oldBp;

        const newStatSum = branchStats[bKey].reduce((sum, key) => sum + (stats[key] || 5), 0);
        const newBp = branchPoints[bKey] || 0;
        const newTotal = newStatSum + newBp;

        if (newTotal !== oldTotal) {
          isValid = false;
          break;
        }
      }

      if (!isValid) {
        return res.status(400).json({ error: 'Asignación de puntos inválida detectada.' });
      }
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
        const reqValue = 5 + computedLevel;
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

    if (branchPoints) {
      // Merge other properties that we pack inside branchPoints (equippedAccessories, spells, etc)
      // client sends it, let's keep them
      updateData.branchPoints = {
        ...character.branchPoints,
        ...branchPoints
      };
    }
    
    if (activitiesToday) {
      // Preserve chestCooldowns
      updateData.activitiesToday = {
        ...character.activitiesToday,
        ...activitiesToday,
        chestCooldowns: character.activitiesToday?.chestCooldowns || {}
      };
    }

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

    // Asymmetrical decay percentages:
    // Physical stats: 30% reduction (-30%)
    const penalizePhysical = (val) => Math.max(5, Math.round(val * 0.7));
    // Willpower / Charisma: 20% reduction (-20%)
    const penalizeWill = (val) => Math.max(5, Math.round(val * 0.8));
    // Intelligence / Max Mana: 10% reduction (-10%)
    const penalizeMental = (val) => Math.max(5, Math.round(val * 0.9));

    // Set recoveryStartedAt to a few seconds in the past to ensure any activity
    // created in the current request's earlier step is included in the recovery check.
    const recoveryStart = new Date(now.getTime() - 5000);

    updatedCharacter = await prisma.character.update({
      where: { id: characterId },
      data: {
        inRecovery: true,
        recoveryStartedAt: recoveryStart,
        recoveryBackup: statsBackup,
        // level remains unchanged
        strength: penalizePhysical(character.strength),
        resistance: penalizePhysical(character.resistance),
        dexterity: penalizePhysical(character.dexterity),
        speed: penalizePhysical(character.speed),
        intelligence: penalizeMental(character.intelligence),
        maxMana: penalizeMental(character.maxMana),
        willpower: penalizeWill(character.willpower),
        charisma: penalizeWill(character.charisma),
        lastActivityAt: now // Reset lastActivity to now so penalty doesn't keep triggering
      }
    });
  }

  // 2. Check Recovery Progress
  if (updatedCharacter.inRecovery) {
    const recoveryStart = updatedCharacter.recoveryStartedAt || updatedCharacter.lastActivityAt;

    // Count physical activities logged since entering recovery
    const physicalActivitiesCount = await prisma.activity.count({
      where: {
        characterId,
        loggedAt: { gte: recoveryStart },
        type: { in: ['strength', 'cardio', 'intense', 'running'] }
      }
    });

    if (physicalActivitiesCount >= 3) {
      // Recover original stats and level!
      const backup = updatedCharacter.recoveryBackup;
      if (backup && typeof backup === 'object') {
        updatedCharacter = await prisma.character.update({
          where: { id: characterId },
          data: {
            inRecovery: false,
            recoveryStartedAt: null,
            recoveryBackup: null,
            level: backup.level !== undefined ? backup.level : updatedCharacter.level,
            strength: backup.strength !== undefined ? backup.strength : updatedCharacter.strength,
            resistance: backup.resistance !== undefined ? backup.resistance : updatedCharacter.resistance,
            dexterity: backup.dexterity !== undefined ? backup.dexterity : updatedCharacter.dexterity,
            speed: backup.speed !== undefined ? backup.speed : updatedCharacter.speed,
            intelligence: backup.intelligence !== undefined ? backup.intelligence : updatedCharacter.intelligence,
            maxMana: backup.maxMana !== undefined ? backup.maxMana : updatedCharacter.maxMana,
            willpower: backup.willpower !== undefined ? backup.willpower : updatedCharacter.willpower,
            charisma: backup.charisma !== undefined ? backup.charisma : updatedCharacter.charisma
          }
        });
      } else {
        // Fallback if backup is missing
        updatedCharacter = await prisma.character.update({
          where: { id: characterId },
          data: {
            inRecovery: false,
            recoveryStartedAt: null,
            recoveryBackup: null
          }
        });
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

// ── SECURE SERVER-AUTHORITATIVE ENDPOINTS ─────────────────────

app.post('/api/character/enemy-killed', async (req, res) => {
  const { userId, enemyName } = req.body;
  try {
    const character = await prisma.character.findUnique({ where: { userId } });
    if (!character) return res.status(404).json({ error: 'Personaje no encontrado.' });

    let goldDrop = Math.floor(Math.random() * 3) + 1; // 1-3
    const isBoss = enemyName.toLowerCase().includes('boss') || enemyName.toLowerCase().includes('reina') || enemyName.toLowerCase().includes('rey');
    if (isBoss) {
      goldDrop = 150;
    }

    let droppedItem = null;
    if (Math.random() < 0.6) {
      const nameLower = enemyName.toLowerCase();
      if (nameLower.includes('slime')) {
        droppedItem = { id: 'quest_slime_jelly', name: 'Gelatina de Slime', count: 1, icon: '🟢', type: 'quest' };
      } else if (nameLower.includes('goblin')) {
        droppedItem = { id: 'quest_goblin_tooth', name: 'Diente de Goblin', count: 1, icon: '🦷', type: 'quest' };
      }
    }

    const inventory = character.inventory || [];
    if (droppedItem) {
      const existing = inventory.find(i => i.id === droppedItem.id);
      if (existing) {
        existing.count += 1;
      } else {
        inventory.push(droppedItem);
      }
    }

    const updated = await prisma.character.update({
      where: { id: character.id },
      data: {
        gold: character.gold + goldDrop,
        inventory
      }
    });

    // Notify party members if in a party
    try {
      let killerSocket = null;
      for (const [sId, s] of io.sockets.sockets) {
        if (s.userId === userId) {
          killerSocket = s;
          break;
        }
      }

      if (killerSocket && killerSocket.partyId) {
        const partyName = killerSocket.partyId;
        const party = parties.get(partyName);
        if (party) {
          const playerState = activePlayers.get(killerSocket.id);
          const killerName = playerState ? playerState.characterName : (character.name || 'Compañero');
          killerSocket.to('party_' + partyName).emit('party-enemy-killed', {
            enemyName,
            killerName
          });
        }
      }
    } catch (socketErr) {
      console.error('[Socket] Error notifying party of kill:', socketErr);
    }

    res.json({
      character: updated,
      goldDrop,
      droppedItem
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al procesar muerte de enemigo.' });
  }
});

app.post('/api/character/open-chest', async (req, res) => {
  const { userId, mapId, x, y } = req.body;
  try {
    const character = await prisma.character.findUnique({ where: { userId } });
    if (!character) return res.status(404).json({ error: 'Personaje no encontrado.' });

    // Cooldown verification: 20 minutes
    const chestKey = `${mapId}_${x}_${y}`;
    const activitiesToday = character.activitiesToday || {};
    const chestCooldowns = activitiesToday.chestCooldowns || {};
    const now = Date.now();

    if (chestCooldowns[chestKey] && now < chestCooldowns[chestKey]) {
      return res.status(400).json({ error: 'El cofre está en cooldown.' });
    }

    // Determine gold reward by map
    let goldDrop = 20; // default fallback
    if (mapId === 'guild') {
      goldDrop = Math.floor(Math.random() * 51) + 50; // 50-100
    } else if (mapId === 'deeproot') {
      goldDrop = Math.floor(Math.random() * 41) + 40; // 40-80
    } else if (mapId === 'cueva_goblin') {
      goldDrop = Math.floor(Math.random() * 71) + 80; // 80-150
    }

    // Set 20 minutes cooldown
    const COOLDOWN_MS = 20 * 60 * 1000;
    chestCooldowns[chestKey] = now + COOLDOWN_MS;
    activitiesToday.chestCooldowns = chestCooldowns;

    const updated = await prisma.character.update({
      where: { id: character.id },
      data: {
        gold: character.gold + goldDrop,
        activitiesToday
      }
    });

    res.json({
      character: updated,
      goldDrop,
      cooldownUntil: now + COOLDOWN_MS
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al abrir cofre.' });
  }
});

app.post('/api/character/buy-item', async (req, res) => {
  const { userId, itemId, price, name, icon, type } = req.body;
  try {
    const character = await prisma.character.findUnique({ where: { userId } });
    if (!character) return res.status(404).json({ error: 'Personaje no encontrado.' });

    if (character.gold < price) {
      return res.status(400).json({ error: 'Oro insuficiente.' });
    }

    const inventory = character.inventory || [];
    const existing = inventory.find(i => i.id === itemId);
    if (existing) {
      existing.count += 1;
    } else {
      inventory.push({ id: itemId, name, count: 1, icon, type });
    }

    const updated = await prisma.character.update({
      where: { id: character.id },
      data: {
        gold: character.gold - price,
        inventory
      }
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al realizar la compra.' });
  }
});

app.post('/api/character/consume-item', async (req, res) => {
  const { userId, itemId } = req.body;
  try {
    const character = await prisma.character.findUnique({ where: { userId } });
    if (!character) return res.status(404).json({ error: 'Personaje no encontrado.' });

    const inventory = character.inventory || [];
    const itemIndex = inventory.findIndex(i => i.id === itemId);
    if (itemIndex === -1 || inventory[itemIndex].count <= 0) {
      return res.status(400).json({ error: 'No posees este item.' });
    }

    // Consume item
    inventory[itemIndex].count -= 1;
    if (inventory[itemIndex].count <= 0) {
      inventory.splice(itemIndex, 1);
    }

    const updated = await prisma.character.update({
      where: { id: character.id },
      data: {
        inventory
      }
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al consumir item.' });
  }
});

// ── GOOGLE HEALTH / FITBIT OAUTH & SYNC ENDPOINTS ───────────────────

// Redirect to Fitbit Authorization
app.get('/api/auth/fitbit', (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).send('userId is required');
  }

  const clientId = process.env.FITBIT_CLIENT_ID;
  const redirectUri = process.env.FITBIT_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return res.status(500).send('Fitbit integration is not configured on the server.');
  }

  // Passing the userId in the state parameter
  const authorizeUrl = `https://www.fitbit.com/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=activity%20heartrate%20profile%20weight&state=${userId}&expires_in=31536000`;
  
  res.redirect(authorizeUrl);
});

// Callback from Fitbit
app.get('/api/auth/fitbit/callback', async (req, res) => {
  const { code, state: userId } = req.query;
  
  if (!code || !userId) {
    return res.status(400).send('Faltan parámetros OAuth.');
  }

  const clientId = process.env.FITBIT_CLIENT_ID;
  const clientSecret = process.env.FITBIT_CLIENT_SECRET;
  const redirectUri = process.env.FITBIT_REDIRECT_URI;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  try {
    // Exchange Auth Code for Access/Refresh Tokens
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch('https://api.fitbit.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code: code
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Fitbit Callback] Exchange error:', data);
      return res.status(400).send('Error de intercambio de token de Fitbit.');
    }

    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    // Save Fitbit Credentials to Character database
    await prisma.character.update({
      where: { userId },
      data: {
        fitbitUserId: data.user_id,
        fitbitAccessToken: data.access_token,
        fitbitRefreshToken: data.refresh_token,
        fitbitExpiresAt: expiresAt
      }
    });

    // Redirect back to frontend
    res.redirect(`${frontendUrl.replace(/\/$/, '')}/?fitbit=success`);
  } catch (error) {
    console.error('[Fitbit Callback] Catch error:', error);
    res.status(500).send('Error interno en callback de Fitbit.');
  }
});

// Helper: Refresh Fitbit Token
async function refreshFitbitToken(character) {
  const clientId = process.env.FITBIT_CLIENT_ID;
  const clientSecret = process.env.FITBIT_CLIENT_SECRET;

  if (!character.fitbitRefreshToken) {
    throw new Error('No refresh token available');
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch('https://api.fitbit.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: character.fitbitRefreshToken
    })
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('[Fitbit Refresh] Exchange error:', data);
    throw new Error('Failed to refresh Fitbit token');
  }

  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  // Update tokens in database
  const updated = await prisma.character.update({
    where: { id: character.id },
    data: {
      fitbitAccessToken: data.access_token,
      fitbitRefreshToken: data.refresh_token,
      fitbitExpiresAt: expiresAt
    }
  });

  return updated;
}

// Fitbit Exercise Sync Endpoint
app.post('/api/character/fitbit/sync', async (req, res) => {
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId es requerido.' });
  }

  try {
    let character = await prisma.character.findUnique({
      where: { userId },
      include: { activities: true }
    });

    if (!character) {
      return res.status(404).json({ error: 'Personaje no encontrado.' });
    }

    if (!character.fitbitUserId || !character.fitbitAccessToken) {
      return res.status(400).json({ error: 'Cuenta de Fitbit no vinculada.' });
    }

    // Check if access token is expired or close to expiry (within 5 minutes)
    const now = new Date();
    const expiryThreshold = new Date(now.getTime() + 5 * 60 * 1000);
    if (character.fitbitExpiresAt && character.fitbitExpiresAt <= expiryThreshold) {
      console.log('[Fitbit Sync] Token expirado o próximo a expirar. Refrescando...');
      character = await refreshFitbitToken(character);
    }

    // Fetch today's activities from Fitbit API
    const todayStr = new Date().toISOString().split('T')[0];
    const fitbitUrl = `https://api.fitbit.com/1/user/${character.fitbitUserId}/activities/date/${todayStr}.json`;
    
    const response = await fetch(fitbitUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${character.fitbitAccessToken}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Fitbit Sync] Fetch error:', data);
      return res.status(400).json({ error: 'Error al consultar datos de Fitbit.' });
    }

    // Process Fitbit Data
    // summary contains: steps, activeScore, caloriesOut, activityCalories, etc.
    const steps = data.summary?.steps || 0;
    const activities = data.activities || [];
    
    let xpEarned = 0;
    const loggedActivities = [];
    const statsBranchesToIncrement = { strength: 0, dexterity: 0, intelligence: 0, willpower: 0 };

    // 1. Check Steps goal: 10,000 steps = Cardio activity
    const stepsActivityKey = `fitbit_steps_${todayStr}`;
    const stepsAlreadyClaimed = character.activities.some(act => act.type === stepsActivityKey);

    if (steps >= 10000 && !stepsAlreadyClaimed) {
      // Reward Cardio
      xpEarned += 50;
      statsBranchesToIncrement.dexterity += 1;
      loggedActivities.push({
        type: stepsActivityKey,
        title: 'Meta de Pasos (Cardio)',
        xpEarned: 50
      });
    }

    // 2. Check logged workouts
    // Map fitbit activity names to game activities / branches
    // Examples of Fitbit activity names: "Run", "Walk", "Weights", "HIIT", "Swim", "Workout"
    for (const fitbitAct of activities) {
      const fitbitActKey = `fitbit_act_${fitbitAct.logId}`;
      const actAlreadyClaimed = character.activities.some(act => act.type === fitbitActKey);

      if (!actAlreadyClaimed) {
        const nameLower = fitbitAct.name.toLowerCase();
        let branch = null;
        let gameActTitle = '';

        if (nameLower.includes('run') || nameLower.includes('correr') || nameLower.includes('sprint')) {
          branch = 'dexterity';
          gameActTitle = `Correr (${fitbitAct.name})`;
        } else if (nameLower.includes('walk') || nameLower.includes('caminar') || nameLower.includes('hike') || nameLower.includes('bici') || nameLower.includes('bike') || nameLower.includes('swim') || nameLower.includes('nadar')) {
          branch = 'dexterity';
          gameActTitle = `Cardio (${fitbitAct.name})`;
        } else if (nameLower.includes('weight') || nameLower.includes('pesas') || nameLower.includes('strength') || nameLower.includes('fuerza') || nameLower.includes('lifting')) {
          branch = 'strength';
          gameActTitle = `Fuerza (${fitbitAct.name})`;
        } else if (nameLower.includes('hiit') || nameLower.includes('cardio intenso') || nameLower.includes('workout') || nameLower.includes('entrenamiento')) {
          branch = 'dexterity'; // Intense is dexterity
          gameActTitle = `Intenso (${fitbitAct.name})`;
        } else if (nameLower.includes('yoga') || nameLower.includes('pilates') || nameLower.includes('meditation') || nameLower.includes('meditación')) {
          branch = 'willpower';
          gameActTitle = `Voluntad (${fitbitAct.name})`;
        }

        if (branch) {
          xpEarned += 50;
          statsBranchesToIncrement[branch] += 1;
          loggedActivities.push({
            type: fitbitActKey,
            title: gameActTitle,
            xpEarned: 50
          });
        }
      }
    }

    // If there is any progress to register, save it to DB
    let updatedCharacter = character;
    if (loggedActivities.length > 0) {
      // Create Activity entries
      await prisma.activity.createMany({
        data: loggedActivities.map(act => ({
          characterId: character.id,
          type: act.type,
          xpEarned: act.xpEarned
        }))
      });

      // Update character XP and branch points
      const newBranchPoints = { ...character.branchPoints };
      for (const [branch, count] of Object.entries(statsBranchesToIncrement)) {
        if (count > 0) {
          newBranchPoints[branch] = (newBranchPoints[branch] || 0) + count;
        }
      }

      // Add Vitality points! (100 per activity logged)
      newBranchPoints.vitality = Math.min(300, (newBranchPoints.vitality || 100) + loggedActivities.length * 100);

      // Check level up (Balanced Growth requirements check)
      let computedLevel = character.level;
      let computedXp = character.xp + xpEarned;
      let blockedLevelUp = false;
      let levelCheck = true;

      const currentStats = {
        strength: character.strength,
        resistance: character.resistance,
        dexterity: character.dexterity,
        speed: character.speed,
        intelligence: character.intelligence,
        maxMana: character.maxMana,
        willpower: character.willpower,
        charisma: character.charisma
      };

      while (levelCheck) {
        const xpNeeded = computedLevel * 50;
        if (computedXp >= xpNeeded) {
          const reqValue = 5 + computedLevel;
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

      updatedCharacter = await prisma.character.update({
        where: { id: character.id },
        data: {
          xp: computedXp,
          level: computedLevel,
          branchPoints: newBranchPoints,
          lastActivityAt: new Date()
        }
      });
    }

    res.json({
      success: true,
      character: updatedCharacter,
      loggedActivities,
      totalXpEarned: xpEarned,
      steps
    });
  } catch (error) {
    console.error('[Fitbit Sync] Error:', error);
    res.status(500).json({ error: 'Error interno de sincronización.' });
  }
});

// Start Server with Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: corsOptions
});

io.on('connection', (socket) => {
  console.log(`[Socket] Cliente conectado: ${socket.id}`);

  socket.on('join-game', ({ userId, characterName, mapId, x, y }) => {
    socket.userId = userId;
    socket.mapId = mapId;
    
    const playerState = {
      socketId: socket.id,
      userId,
      characterName,
      mapId,
      x,
      y,
      facing: 'down',
      weaponKey: 'sword',
      anim: 'idle'
    };
    activePlayers.set(socket.id, playerState);

    socket.join(mapId);
    socket.to(mapId).emit('player-joined', playerState);

    const roomPlayers = Array.from(activePlayers.values()).filter(p => p.mapId === mapId && p.socketId !== socket.id);
    socket.emit('current-players', roomPlayers);

    // --- RECONNECT GRACE PERIOD & MAP TRANSITION FOR PARTIES ---
    // If the user's userId was in a party disconnect grace period, cancel the timeout.
    if (partyDisconnectTimers.has(userId)) {
      clearTimeout(partyDisconnectTimers.get(userId));
      partyDisconnectTimers.delete(userId);
      console.log(`[Socket] Cancelado timeout de desconexión de grupo para userId: ${userId}`);
    }

    // Find if user is in an in-memory party
    let joinedParty = null;
    for (const [pName, pObj] of parties.entries()) {
      const m = pObj.members.find(member => member.userId === userId);
      if (m) {
        m.socketId = socket.id;
        socket.partyId = pName;
        socket.join('party_' + pName);
        joinedParty = pObj;
        console.log(`[Socket] Reasociado usuario ${characterName} a la party ${pName}`);
        break;
      }
    }

    if (joinedParty) {
      io.to('party_' + joinedParty.id).emit('party-updated', joinedParty);
    }
  });

  // --- PARTY SYSTEM EVENTS ---
  socket.on('create-party', ({ partyName }) => {
    if (!partyName) return socket.emit('party-error', 'El nombre del grupo es obligatorio.');
    const trimmedName = partyName.trim();
    if (trimmedName.length < 1 || trimmedName.length > 20) {
      return socket.emit('party-error', 'El nombre del grupo debe tener entre 1 y 20 caracteres.');
    }

    if (socket.partyId) {
      return socket.emit('party-error', 'Ya estás en un grupo. Sal primero.');
    }

    if (parties.has(trimmedName)) {
      return socket.emit('party-error', 'El nombre de grupo ya está en uso.');
    }

    const player = activePlayers.get(socket.id);
    if (!player) return socket.emit('party-error', 'Error al obtener datos del jugador.');

    const party = {
      id: trimmedName,
      members: [{ socketId: socket.id, userId: socket.userId, characterName: player.characterName }]
    };

    parties.set(trimmedName, party);
    socket.partyId = trimmedName;
    socket.join('party_' + trimmedName);

    io.to('party_' + trimmedName).emit('party-updated', party);
    console.log(`[Socket] Grupo '${trimmedName}' creado por ${player.characterName}`);
  });

  socket.on('join-party', ({ partyName }) => {
    if (!partyName) return socket.emit('party-error', 'El nombre del grupo es obligatorio.');
    const trimmedName = partyName.trim();

    if (socket.partyId) {
      return socket.emit('party-error', 'Ya estás en un grupo. Sal primero.');
    }

    const party = parties.get(trimmedName);
    if (!party) {
      return socket.emit('party-error', 'El grupo no existe.');
    }

    const player = activePlayers.get(socket.id);
    if (!player) return socket.emit('party-error', 'Error al obtener datos del jugador.');

    // Add player to members list if they aren't already there
    if (!party.members.some(m => m.userId === socket.userId)) {
      party.members.push({ socketId: socket.id, userId: socket.userId, characterName: player.characterName });
    }

    socket.partyId = trimmedName;
    socket.join('party_' + trimmedName);

    io.to('party_' + trimmedName).emit('party-updated', party);
    console.log(`[Socket] Jugador ${player.characterName} se unió al grupo '${trimmedName}'`);
  });

  socket.on('leave-party', () => {
    if (!socket.partyId) return;
    const partyName = socket.partyId;
    const party = parties.get(partyName);

    if (party) {
      party.members = party.members.filter(m => m.userId !== socket.userId);
      socket.leave('party_' + partyName);
      socket.partyId = null;
      socket.emit('party-left');

      if (party.members.length === 0) {
        parties.delete(partyName);
        console.log(`[Socket] Grupo '${partyName}' disuelto porque quedó vacío.`);
      } else {
        io.to('party_' + partyName).emit('party-updated', party);
        console.log(`[Socket] Jugador con ID ${socket.id} salió del grupo '${partyName}'`);
      }
    }
  });

  // --- GENERAL PLAYERS MOVEMENT & COMBAT SYNC ---
  socket.on('player-moved', (movementData) => {
    const player = activePlayers.get(socket.id);
    if (player) {
      player.x = movementData.x;
      player.y = movementData.y;
      player.facing = movementData.facing;
      player.anim = movementData.anim;
      
      socket.to(player.mapId).emit('player-moved', {
        socketId: socket.id,
        x: player.x,
        y: player.y,
        facing: player.facing,
        anim: player.anim
      });
    }
  });

  socket.on('player-switched-weapon', ({ weaponKey }) => {
    const player = activePlayers.get(socket.id);
    if (player) {
      player.weaponKey = weaponKey;
      socket.to(player.mapId).emit('player-switched-weapon', {
        socketId: socket.id,
        weaponKey
      });
    }
  });

  socket.on('player-attacked', (attackData) => {
    const player = activePlayers.get(socket.id);
    if (player) {
      socket.to(player.mapId).emit('player-attacked', {
        socketId: socket.id,
        attackData
      });
    }
  });

  socket.on('player-cast-spell', (spellKey) => {
    const player = activePlayers.get(socket.id);
    if (player) {
      socket.to(player.mapId).emit('player-cast-spell', {
        socketId: socket.id,
        spellKey
      });
    }
  });

  socket.on('player-rolled', () => {
    const player = activePlayers.get(socket.id);
    if (player) {
      socket.to(player.mapId).emit('player-rolled', {
        socketId: socket.id
      });
    }
  });

  socket.on('change-map', ({ mapId, x, y }) => {
    const player = activePlayers.get(socket.id);
    if (player) {
      socket.leave(player.mapId);
      socket.to(player.mapId).emit('player-left', { socketId: socket.id });

      player.mapId = mapId;
      player.x = x;
      player.y = y;

      socket.join(mapId);
      socket.to(mapId).emit('player-joined', player);

      const roomPlayers = Array.from(activePlayers.values()).filter(p => p.mapId === mapId && p.socketId !== socket.id);
      socket.emit('current-players', roomPlayers);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Cliente desconectado: ${socket.id}`);
    const player = activePlayers.get(socket.id);
    if (player) {
      socket.to(player.mapId).emit('player-left', { socketId: socket.id });
      activePlayers.delete(socket.id);
    }

    const userId = socket.userId;
    const partyName = socket.partyId;
    if (userId && partyName) {
      console.log(`[Socket] Programado temporizador de 10s para remover userId ${userId} del grupo ${partyName}`);
      const timer = setTimeout(() => {
        partyDisconnectTimers.delete(userId);
        let isTrulyOffline = true;
        for (const playerState of activePlayers.values()) {
          if (playerState.userId === userId) {
            isTrulyOffline = false;
            break;
          }
        }
        if (isTrulyOffline) {
          const party = parties.get(partyName);
          if (party) {
            party.members = party.members.filter(m => m.userId !== userId);
            console.log(`[Socket] Grace period de 10s expiró. Removido userId ${userId} del grupo ${partyName}`);
            if (party.members.length === 0) {
              parties.delete(partyName);
              console.log(`[Socket] Grupo '${partyName}' disuelto porque se desconectaron todos los miembros.`);
            } else {
              io.to('party_' + partyName).emit('party-updated', party);
            }
          }
        }
      }, 10000);
      partyDisconnectTimers.set(userId, timer);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Servidor de Gains & Goblins escuchando en puerto ${PORT}`);
});
