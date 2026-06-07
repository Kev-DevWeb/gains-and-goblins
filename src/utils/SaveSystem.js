// ============================================================================
// SaveSystem.js — online persistence for Gains & Goblins
// ============================================================================
// Saves and loads player state from the Supabase backend.
// Falls back to localStorage cache for seamless gameplay.
// ============================================================================

const SAVE_KEY = 'gains_goblins_save';
const USER_ID_KEY = 'gains_goblins_user_id';
const BACKEND_URL = 'http://localhost:3001/api';

export default class SaveSystem {
  static getUserId() {
    return localStorage.getItem(USER_ID_KEY);
  }

  static setUserId(id) {
    if (id) {
      localStorage.setItem(USER_ID_KEY, id);
    } else {
      localStorage.removeItem(USER_ID_KEY);
    }
  }

  /**
   * Register a new user and create their starting character.
   * @param {string} email
   * @param {string} password
   * @param {string} name
   */
  static async register(email, password, name) {
    try {
      const response = await fetch(`${BACKEND_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Error en el registro.');
      }
      
      this.setUserId(data.character.userId);
      localStorage.setItem(SAVE_KEY, JSON.stringify(data.character));
      return { success: true, character: data.character };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Log in an existing user and fetch their character progress.
   * @param {string} email
   * @param {string} password
   */
  static async login(email, password) {
    try {
      const response = await fetch(`${BACKEND_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Error en el inicio de sesión.');
      }
      
      this.setUserId(data.character.userId);
      localStorage.setItem(SAVE_KEY, JSON.stringify(data.character));
      return { success: true, character: data.character };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Load the character state from the backend.
   * Falls back to local cache if offline.
   */
  static async loadFromServer() {
    const userId = this.getUserId();
    if (!userId) return null;
    try {
      const response = await fetch(`${BACKEND_URL}/character/${userId}`);
      if (!response.ok) {
        if (response.status === 444) {
          // Character not found or user deleted
          this.setUserId(null);
          localStorage.removeItem(SAVE_KEY);
        }
        return null;
      }
      const data = await response.json();
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return data;
    } catch (err) {
      console.warn('[SaveSystem] Sync failed during load, loading from cache:', err);
      return this.load();
    }
  }

  /**
   * Save character state to local storage and queue sync with backend.
   * @param {object} playerData
   * @param {object} [newActivityLogged] - Optional activity logged in real-life
   */
  static save(playerData, newActivityLogged = null) {
    try {
      // First, write cache to local storage
      const localData = {
        ...playerData,
        lastSaveDate: new Date().toISOString().split('T')[0],
        savedAt: Date.now(),
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(localData));

      // Asynchronously trigger server sync if user is logged in
      const userId = this.getUserId();
      if (userId) {
        this.syncServer(userId, playerData, newActivityLogged);
      }
      return true;
    } catch (e) {
      console.warn('[SaveSystem] Failed to save local cache:', e);
      return false;
    }
  }

  /**
   * Sync character data with the server.
   */
  static async syncServer(userId, playerData, newActivityLogged) {
    try {
      const payload = {
        userId,
        xp: playerData.xp,
        gold: playerData.gold,
        moral: playerData.moral,
        stats: playerData.stats,
        branchPoints: playerData.branchPoints,
        inventory: playerData.inventory,
        activitiesToday: playerData.activitiesToday,
        newActivityLogged,
      };

      const response = await fetch(`${BACKEND_URL}/character/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Merge server-calculated properties (e.g. stats decay, level calculations, recovery status)
        const cache = {
          ...playerData,
          ...result.character,
          lastSaveDate: new Date().toISOString().split('T')[0],
          savedAt: Date.now(),
        };
        localStorage.setItem(SAVE_KEY, JSON.stringify(cache));

        // Dispatch a global event so the game scene updates if there are modifications
        window.dispatchEvent(new CustomEvent('character-synced', { detail: result }));
      }
    } catch (err) {
      console.warn('[SaveSystem] Asynchronous server sync failed:', err);
    }
  }

  /**
   * Load saved player state from local cache.
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
      console.warn('[SaveSystem] Failed to load from cache:', e);
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
   * Delete the local cache and authentication.
   */
  static deleteSave() {
    localStorage.removeItem(SAVE_KEY);
    this.setUserId(null);
  }

  /**
   * Check if user is authenticated or has a cached character.
   * @returns {boolean}
   */
  static hasSave() {
    return this.getUserId() !== null;
  }
}
