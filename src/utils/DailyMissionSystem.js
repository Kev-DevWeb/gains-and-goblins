// ============================================================================
// DailyMissionSystem.js
// Generates and tracks 3 daily missions that reset at midnight.
// Mission type: monster hunting only (no activities/visits).
// Progress can happen in any combat map except guild.
// Supports minimum level requirements per mission.
// ============================================================================

const SAVE_KEY = 'gg_daily_missions';

// Pool of possible daily mission templates (combat-only)
const MISSION_POOL = [
  { id: 'hunt_slimes_deeproot',  type: 'kill', target: 'Slime',      count: 8, title: 'Caza de Slimes',      desc: 'Elimina 8 Slimes en Deeproot.',                  reward: { gold: 60 },  zone: 'deeproot',    minLevel: 1, icon: '🟢' },
  { id: 'hunt_goblins_deeproot', type: 'kill', target: 'Goblin',     count: 5, title: 'Patrulla Goblin',     desc: 'Derrota 5 Goblins en Deeproot.',                 reward: { gold: 90 },  zone: 'deeproot',    minLevel: 1, icon: '👺' },
  { id: 'hunt_archers_any',      type: 'kill', target: 'Goblin Arquero', count: 3, title: 'Rompefilas',      desc: 'Derrota 3 Arqueros Goblin fuera del Gremio.',    reward: { gold: 110 }, zone: null,          minLevel: 1, icon: '🏹' },
  { id: 'hunt_mages_any',        type: 'kill', target: 'Goblin Mago', count: 3, title: 'Caza de Magos',      desc: 'Derrota 3 Magos Goblin fuera del Gremio.',       reward: { gold: 120 }, zone: null,          minLevel: 2, icon: '✨' },
  { id: 'hunt_mixed_deeproot',   type: 'kill', target: 'Goblin',     count: 3, title: 'Limpieza Total',      desc: 'Elimina 3 Goblins y 5 Slimes en Deeproot.',      reward: { gold: 120 }, zone: 'deeproot',    minLevel: 1, icon: '⚔️', extraKill: { target: 'Slime', count: 5 } },
  { id: 'hunt_any_non_guild',    type: 'kill', target: 'any',        count: 10, title: 'Exterminador',       desc: 'Derrota 10 monstruos en cualquier mapa de combate.', reward: { gold: 140 }, zone: null,      minLevel: 1, icon: '🗡️' },
  { id: 'hunt_cave_goblins',     type: 'kill', target: 'Goblin',     count: 6, title: 'Incursión a la Cueva', desc: 'Derrota 6 Goblins en la Cueva Goblin (Nv. 2+).', reward: { gold: 200 }, zone: 'cueva_goblin', minLevel: 2, icon: '🦇' },
  { id: 'hunt_goblin_king',      type: 'kill', target: 'Rey Goblin', count: 1, title: 'Asesino de Reyes',    desc: 'Derrota al Rey Goblin en Cueva Goblin (Nv. 2+).', reward: { gold: 300 }, zone: 'cueva_goblin', minLevel: 2, icon: '👑' },
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
  trackKill(enemyName, mapId, playerLevel = 1) {
    // Missions never progress inside the guild.
    if (mapId === 'guild') return;

    let any = false;
    for (const m of this.missions) {
      if (!m.accepted || this.claimed[m.id]) continue;
      if ((m.minLevel || 1) > playerLevel) continue;
      const prog = this.progress[m.id] || 0;

      if (m.type === 'kill') {
        // Enforce zone strictly
        if (m.zone && m.zone !== mapId) continue;

        let updated = false;

        // Main target check
        const matchesMain = m.target === 'any' || m.target === enemyName;
        if (matchesMain && prog < m.count) {
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

  /** Disabled for combat-only daily mission system */
  trackVisit(_mapId) {}

  /** Disabled for combat-only daily mission system */
  trackActivity(_branchKey) {}

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

  acceptMission(missionId, playerLevel = 1) {
    const m = this.missions.find(x => x.id === missionId);
    if (m && (m.minLevel || 1) > playerLevel) {
      this.game.events.emit('show-notification', `Requiere nivel ${m.minLevel}.`, '#e94560');
      return false;
    }
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
