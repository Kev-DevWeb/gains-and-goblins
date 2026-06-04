export const QUEST_STATE = { AVAILABLE: 'available', ACTIVE: 'active', COMPLETE: 'complete', REWARDED: 'rewarded' };

export default class QuestSystem {
  constructor(game) {
    this.game = game;
    this.quests = new Map();
    this.questProgress = new Map();

    // Define all quests
    this._defineQuests();
  }

  _defineQuests() {
    const defaultQuests = [
      { 
        id: 'kill_slimes', 
        title: 'Limpieza de Slimes', 
        desc: 'Elimina 5 Slimes cerca de la aldea.', 
        objective: { type: 'kill', target: 'Slime', required: 5 }, 
        reward: { gold: 50 },
        state: QUEST_STATE.AVAILABLE
      },
      { 
        id: 'kill_goblins', 
        title: 'Amenaza Goblin', 
        desc: 'Derrota a 3 Goblins en las afueras.', 
        objective: { type: 'kill', target: 'Goblin', required: 3 }, 
        reward: { gold: 80 },
        state: QUEST_STATE.AVAILABLE
      },
      { 
        id: 'kill_skeletons', 
        title: 'Huesos Antiguos', 
        desc: 'Destruye 2 Esqueletos en la mazmorra.', 
        objective: { type: 'kill', target: 'Esqueleto', required: 2 }, 
        reward: { gold: 120 },
        state: QUEST_STATE.AVAILABLE
      }
    ];

    defaultQuests.forEach(q => {
      this.quests.set(q.id, q);
      this.questProgress.set(q.id, 0);
    });
  }

  startQuest(questId) {
    const q = this.quests.get(questId);
    if (q && q.state === QUEST_STATE.AVAILABLE) {
      q.state = QUEST_STATE.ACTIVE;
      this.questProgress.set(questId, 0);
      
      this.game.events.emit('show-notification', `Nueva Misión: ${q.title}`, '#ffd700');
      this.game.events.emit('quest-started', q);
      return true;
    }
    return false;
  }

  trackKill(enemyName) {
    let progressed = false;
    
    for (const [id, q] of this.quests.entries()) {
      if (q.state === QUEST_STATE.ACTIVE && q.objective.type === 'kill' && q.objective.target === enemyName) {
        let current = this.questProgress.get(id);
        current++;
        this.questProgress.set(id, current);
        progressed = true;

        if (current >= q.objective.required) {
          q.state = QUEST_STATE.COMPLETE;
          this.game.events.emit('show-notification', `Misión Completada: ${q.title}`, '#3ac55e');
          this.game.events.emit('quest-completed', q);
        } else {
          this.game.events.emit('quest-progress', q, current);
        }
      }
    }
    return progressed;
  }

  isComplete(questId) {
    const q = this.quests.get(questId);
    return q && q.state === QUEST_STATE.COMPLETE;
  }

  claimReward(questId) {
    const q = this.quests.get(questId);
    if (q && q.state === QUEST_STATE.COMPLETE) {
      q.state = QUEST_STATE.REWARDED;
      this.game.events.emit('quest-rewarded', q);
      return q.reward;
    }
    return null;
  }

  getActiveQuest() {
    for (const q of this.quests.values()) {
      if (q.state === QUEST_STATE.ACTIVE || q.state === QUEST_STATE.COMPLETE) {
        return { quest: q, progress: this.questProgress.get(q.id) };
      }
    }
    return null;
  }

  getAvailableQuests() {
    return Array.from(this.quests.values()).filter(q => q.state === QUEST_STATE.AVAILABLE);
  }

  getSaveData() {
    const data = {
      states: {},
      progress: {}
    };
    for (const [id, q] of this.quests.entries()) {
      data.states[id] = q.state;
      data.progress[id] = this.questProgress.get(id);
    }
    return data;
  }

  loadSaveData(data) {
    if (!data || !data.states) return;
    
    for (const [id, state] of Object.entries(data.states)) {
      if (this.quests.has(id)) {
        this.quests.get(id).state = state;
        this.questProgress.set(id, data.progress[id] || 0);
      }
    }
  }
}
