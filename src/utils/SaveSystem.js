// ============================================================================
// SaveSystem.js — localStorage persistence for Gains & Goblins
// ============================================================================
// Saves and loads player state (stats, level, xp, gold, activity log).
// Auto-saves every 30 seconds and on activity registration.
// ============================================================================

const SAVE_KEY = 'gains_goblins_save';

export default class SaveSystem {
  /**
   * Save the current player state to localStorage.
   * @param {object} playerData
   */
  static save(playerData) {
    try {
      const data = {
        stats: playerData.stats,
        level: playerData.level,
        xp: playerData.xp,
        hp: playerData.hp,
        maxHp: playerData.maxHp,
        mana: playerData.mana,
        maxMana: playerData.maxMana,
        gold: playerData.gold || 0,
        currentWeaponKey: playerData.currentWeaponKey,
        activitiesToday: playerData.activitiesToday || {},
        lastSaveDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        savedAt: Date.now(),
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn('[SaveSystem] Failed to save:', e);
      return false;
    }
  }

  /**
   * Load saved player state from localStorage.
   * Returns null if no save exists or save is corrupted.
   * @returns {object|null}
   */
  static load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;

      const data = JSON.parse(raw);

      // If the save is from a different day, reset daily activity cooldowns
      const today = new Date().toISOString().split('T')[0];
      if (data.lastSaveDate !== today) {
        data.activitiesToday = {};
      }

      return data;
    } catch (e) {
      console.warn('[SaveSystem] Failed to load:', e);
      return null;
    }
  }

  /**
   * Check if a specific activity has already been logged today.
   * @param {string} activityId
   * @returns {boolean}
   */
  static hasLoggedToday(activityId) {
    const data = SaveSystem.load();
    if (!data || !data.activitiesToday) return false;
    return !!data.activitiesToday[activityId];
  }

  /**
   * Delete the save file.
   */
  static deleteSave() {
    localStorage.removeItem(SAVE_KEY);
  }

  /**
   * Check if a save exists.
   * @returns {boolean}
   */
  static hasSave() {
    return localStorage.getItem(SAVE_KEY) !== null;
  }
}
