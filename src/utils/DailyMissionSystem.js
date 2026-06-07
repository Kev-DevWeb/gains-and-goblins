// ============================================================================
// DailyMissionSystem.js
// Generates and tracks 3 daily missions that reset at midnight.
// Missions types: kill enemies, visit a zone, log a real-life activity.
// Rewards: gold, bonus branch XP points.
// ============================================================================

const SAVE_KEY = 'gg_daily_missions';

// Pool of possible daily mission templates
const MISSION_POOL = [
  // Kill missions
  { id: 'kill_slimes_daily',    type: 'kill',     target: 'Slime',     count: 8,  title: 'Caza de Slimes',       desc: 'Elimina 8 Slimes en Deeproot.',        reward: { gold: 60 },                  zone: 'deeproot', icon: '🟢' },
  { id: 'kill_goblins_daily',   type: 'kill',     target: 'Goblin',    count: 5,  title: 'Patrulla Goblin',      desc: 'Derrota 5 Goblins en Deeproot.',       reward: { gold: 90 },                  zone: 'deeproot', icon: '👺' },
  { id: 'kill_skeletons_daily', type: 'kill',     target: 'Esqueleto', count: 3,  title: 'Los Muertos Inquietos', desc: 'Destruye 3 Esqueletos en la Arena.',       reward: { gold: 120 },                 zone: 'guild',     icon: '💀' },
  { id: 'kill_mixed_daily',     type: 'kill',     target: 'Goblin',    count: 3,  title: 'Limpieza Total',       desc: 'Elimina 3 Goblins y 5 Slimes.',            reward: { gold: 100 },                 zone: 'deeproot', icon: '⚔️',  extraKill: { target: 'Slime', count: 5 } },
  { id: 'kill_boss_daily',      type: 'kill',     target: 'Rey Goblin',     count: 1, title: 'Asesino de Reyes',         desc: 'Derrota al Rey Goblin en la Cueva Goblin.',         reward: { gold: 300, branchBonus: 'strength' }, zone: 'cueva_goblin', icon: '👑' },

  // Visit missions
  { id: 'visit_dungeon',        type: 'visit',    target: 'cueva_goblin',   count: 1,  title: 'Valiente',             desc: 'Adéntrate en la Cueva Goblin.',                reward: { gold: 40 },                  zone: null,    icon: '🦇' },
  { id: 'visit_deeproot',       type: 'visit',    target: 'deeproot',  count: 1,  title: 'Explorador',           desc: 'Visita Deeproot hoy.',                     reward: { gold: 25 },                  zone: null,    icon: '🌲' },
  { id: 'visit_arena',          type: 'visit',    target: 'guild',     count: 1,  title: 'Al Entrenamiento',     desc: 'Derrota un enemigo en la Arena del Gremio.', reward: { gold: 30 },                zone: null,    icon: '🏟️', subType: 'arena_kill' },

  // Real-life activity missions
  { id: 'activity_strength',    type: 'activity', target: 'strength',     count: 1, title: 'Día de Pesas',        desc: 'Registra un ejercicio de Fuerza hoy.',     reward: { gold: 40, branchBonus: 'strength' },      zone: null, icon: '💪' },
  { id: 'activity_dexterity',   type: 'activity', target: 'dexterity',    count: 1, title: 'Día de Cardio',       desc: 'Registra una actividad de Destreza hoy.',  reward: { gold: 40, branchBonus: 'dexterity' },     zone: null, icon: '🏃' },
  { id: 'activity_intelligence', type: 'activity', target: 'intelligence', count: 1, title: 'Día de Estudio',     desc: 'Registra un ejercicio de Inteligencia.',   reward: { gold: 40, branchBonus: 'intelligence' },  zone: null, icon: '📖' },
  { id: 'activity_willpower',   type: 'activity', target: 'willpower',    count: 1, title: 'Día de Meditación',   desc: 'Registra una actividad de Voluntad.',      reward: { gold: 40, branchBonus: 'willpower' },     zone: null, icon: '🧘' },
  { id: 'activity_any',         type: 'activity', target: 'any',          count: 2, title: 'Héroe Activo',        desc: 'Registra 2 actividades hoy (cualquiera).',  reward: { gold: 80, branchBonus: 'strength' },     zone: null, icon: '🌟' },
];

const DAILY_MISSION_COUNT = 3;

export default class DailyMissionSystem {
  constructor(game) {
    this.game = game;
    this.missions = [];     // today's 3 active missions
    this.progress = {};     // { missionId: currentCount }
    this.claimed = {};      // { missionId: true } if reward already taken
    this.notified = {};     // { missionId: true } if completion notification shown

    this._loadOrGenerate();
  }

  // ── Init ─────────────────────────────────────────────────────────────────

  _today() {
    return new Date().toISOString().split('T')[0];
  }

  _loadOrGenerate() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.date === this._today()) {
          // Same day — restore
          this.missions = data.missions;
          this.progress = data.progress || {};
          this.claimed  = data.claimed  || {};
          this.notified = data.notified || {};
          return;
        }
      }
    } catch (e) { /* ignore */ }

    // New day — generate fresh missions
    this._generate();
  }

  _generate() {
    // Shuffle the pool and pick DAILY_MISSION_COUNT unique ones
    const shuffled = [...MISSION_POOL].sort(() => Math.random() - 0.5);
    this.missions = shuffled.slice(0, DAILY_MISSION_COUNT).map(m => ({ ...m, accepted: false }));
    this.progress = {};
    this.claimed  = {};
    this.notified = {};
    this.missions.forEach(m => { this.progress[m.id] = 0; });
    this._save();
  }

  _save() {
    const data = {
      date:     this._today(),
      missions: this.missions,
      progress: this.progress,
      claimed:  this.claimed,
      notified: this.notified,
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  // ── Tracking ─────────────────────────────────────────────────────────────

  /** Call every time an enemy is killed */
  trackKill(enemyName, mapId) {
    let any = false;
    for (const m of this.missions) {
      if (!m.accepted || this.claimed[m.id]) continue;
      const prog = this.progress[m.id] || 0;

      // Arena-specific kill subtype
      if (m.subType === 'arena_kill') {
        if (mapId === 'guild' && prog < m.count) {
          this.progress[m.id] = prog + 1;
          any = true;
        }
        continue; // Skip normal kill logic for arena_kill subtype
      }

      if (m.type === 'kill') {
        // Enforce zone strictly
        if (m.zone && m.zone !== mapId) continue;

        let updated = false;

        // Main target check
        if (m.target === enemyName && prog < m.count) {
          this.progress[m.id] = prog + 1;
          updated = true;
        }

        // Extra target check (for mixed missions)
        if (m.extraKill && m.extraKill.target === enemyName) {
          const key = `${m.id}_extra`;
          const extraProg = this.progress[key] || 0;
          if (extraProg < m.extraKill.count) {
            this.progress[key] = extraProg + 1;
            updated = true;
          }
        }

        if (updated) any = true;
      }
    }
    if (any) {
      this._checkCompletions();
      this._save();
    }
  }

  /** Call when player enters a new map */
  trackVisit(mapId) {
    let any = false;
    for (const m of this.missions) {
      if (!m.accepted || this.claimed[m.id]) continue;
      if (m.type === 'visit' && m.target === mapId && this.progress[m.id] < m.count) {
        this.progress[m.id] = 1;
        any = true;
      }
    }
    if (any) {
      this._checkCompletions();
      this._save();
    }
  }

  /** Call when player logs a real-life activity */
  trackActivity(branchKey) {
    let any = false;
    for (const m of this.missions) {
      if (!m.accepted || this.claimed[m.id]) continue;
      const prog = this.progress[m.id] || 0;
      if (m.type === 'activity') {
        if (m.target === 'any' || m.target === branchKey) {
          this.progress[m.id] = Math.min(prog + 1, m.count);
          any = true;
        }
      }
    }
    if (any) {
      this._checkCompletions();
      this._save();
    }
  }

  _checkCompletions() {
    for (const m of this.missions) {
      if (!m.accepted || this.claimed[m.id] || this.notified[m.id]) continue;
      if (this._isComplete(m)) {
        this.notified[m.id] = true;
        this.game.events.emit('show-notification', `✅ ¡Misión completada: ${m.title}!`, '#2ecc71');
        this.game.events.emit('daily-mission-completed', m);
      }
    }
  }

  _isComplete(m) {
    const prog = this.progress[m.id] || 0;
    if (prog < m.count) return false;
    // Check extra kill if needed
    if (m.extraKill) {
      const extra = this.progress[`${m.id}_extra`] || 0;
      if (extra < m.extraKill.count) return false;
    }
    return true;
  }

  /** Claim reward for a completed mission. Returns reward object or null. */
  claimReward(missionId) {
    const m = this.missions.find(x => x.id === missionId);
    if (!m || !this._isComplete(m) || this.claimed[missionId]) return null;
    this.claimed[missionId] = true;
    this._save();
    return m.reward;
  }

  acceptMission(missionId) {
    const m = this.missions.find(x => x.id === missionId);
    if (m && !m.accepted) {
      m.accepted = true;
      this._save();
      this._checkCompletions(); // check just in case
      this.game.events.emit('show-notification', `Aceptada: ${m.title}`, '#f1c40f');
      return true;
    }
    return false;
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  getMissions() {
    return this.missions.map(m => ({
      ...m,
      current:   this.progress[m.id] || 0,
      extraProgress: m.extraKill ? (this.progress[`${m.id}_extra`] || 0) : null,
      completed: this._isComplete(m),
      claimed:   !!this.claimed[m.id],
      accepted:  !!m.accepted,
    }));
  }

  hasUnclaimed() {
    return this.missions.some(m => this._isComplete(m) && !this.claimed[m.id]);
  }

  allClaimed() {
    return this.missions.every(m => !!this.claimed[m.id]);
  }

  getCompletedCount() {
    return this.missions.filter(m => this._isComplete(m)).length;
  }
}
