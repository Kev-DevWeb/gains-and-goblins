// ============================================================================
// SaveSystem.js — online persistence for Gains & Goblins
// ============================================================================
// Accounts live in Supabase Auth and progress in the Supabase database. Every
// change goes through the game functions in supabase/migrations, which enforce
// the rules. A localStorage copy keeps the game responsive between syncs.
// ============================================================================

import { supabase } from './supabaseClient.js';

const SAVE_KEY = 'gains_goblins_save';
const USER_ID_KEY = 'gains_goblins_user_id';
// Set when the server reports a weekly stat decay before the world scene exists
const PENDING_DECAY_KEY = 'gains_goblins_pending_decay';

// Supabase Auth answers in English; show players the common cases in Spanish
const AUTH_ERRORS = {
  'Invalid login credentials': 'Correo o contraseña incorrectos.',
  'Email not confirmed': 'Confirma tu correo: te enviamos un enlace al registrarte.',
  'User already registered': 'El correo ya está registrado.',
  'Password should be at least 6 characters.': 'La contraseña debe tener al menos 6 caracteres.',
};

function friendlyError(error) {
  return AUTH_ERRORS[error.message] || error.message;
}

// Keep the cached user id in step with Supabase (sign-out, expired session, Google redirect)
supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user) {
    localStorage.setItem(USER_ID_KEY, session.user.id);
  } else {
    localStorage.removeItem(USER_ID_KEY);
  }
});

export default class SaveSystem {
  /**
   * Returns true once if a weekly stat decay happened while loading, then clears it.
   */
  static takePendingDecayNotice() {
    try {
      const pending = localStorage.getItem(PENDING_DECAY_KEY) === '1';
      localStorage.removeItem(PENDING_DECAY_KEY);
      return pending;
    } catch (e) {
      return false;
    }
  }

  static getUserId() {
    return localStorage.getItem(USER_ID_KEY);
  }

  /**
   * Create an account with email and password.
   * Returns { success, needsConfirmation } when Supabase asks the player to confirm their email first.
   */
  static async register(email, password, name) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name }, emailRedirectTo: `${window.location.origin}/` },
    });
    if (error) return { success: false, error: friendlyError(error) };
    if (!data.session) return { success: true, needsConfirmation: true };

    const character = await this.loadFromServer();
    return character ? { success: true, character } : { success: false, error: 'No se pudo crear el personaje.' };
  }

  static async login(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error: friendlyError(error) };

    const character = await this.loadFromServer();
    return character ? { success: true, character } : { success: false, error: 'No se pudo cargar el personaje.' };
  }

  /** Leaves the page for Google's sign-in screen; Supabase restores the session on return. */
  static async loginWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    });
    return error ? { success: false, error: friendlyError(error) } : { success: true };
  }

  /**
   * Load the character for the signed-in player, creating it on their first visit.
   * Returns null when nobody is signed in. Falls back to the local cache if offline.
   */
  static async loadFromServer() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      localStorage.removeItem(SAVE_KEY);
      return null;
    }

    try {
      let { data, error } = await supabase.rpc('get_character');
      if (error) throw error;

      if (!data.character) {
        ({ data, error } = await supabase.rpc('create_character', { p_name: this._heroName(session.user) }));
        if (error) throw error;
      }

      localStorage.setItem(SAVE_KEY, JSON.stringify(data.character));
      if (data.decayApplied) localStorage.setItem(PENDING_DECAY_KEY, '1');
      return data.character;
    } catch (err) {
      console.warn('[SaveSystem] Sync failed during load, loading from cache:', err);
      return this.load();
    }
  }

  // Name chosen at registration, else the Google profile name, else the email
  static _heroName(user) {
    const meta = user.user_metadata || {};
    const name = meta.name || meta.full_name || user.email?.split('@')[0] || 'Héroe';
    return name.trim().slice(0, 24) || 'Héroe';
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

      if (this.getUserId()) {
        this.syncServer(playerData, newActivityLogged);
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
  static async syncServer(playerData, newActivityLogged) {
    const payload = {
      xp: playerData.xp,
      moral: playerData.moral,
      stats: playerData.stats,
      branchPoints: playerData.branchPoints,
      activitiesToday: playerData.activitiesToday,
      newActivityLogged,
    };
    const { data: result, error } = await supabase.rpc('sync_character', { p_data: payload });
    if (error) {
      console.warn('[SaveSystem] Asynchronous server sync failed:', error.message);
      return;
    }

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
   * Calls a game function and publishes the updated character.
   * Returns the function's result, or null on failure.
   */
  static async _callGame(fn, args, label) {
    if (!this.getUserId()) return null;
    const { data, error } = await supabase.rpc(fn, args);
    if (error) {
      console.warn(`[SaveSystem] ${label} failed:`, error.message);
      return null;
    }
    const character = data.character || data;
    localStorage.setItem(SAVE_KEY, JSON.stringify(character));
    window.dispatchEvent(new CustomEvent('character-synced', { detail: { character } }));
    return data;
  }

  static enemyKilled(enemyName) {
    return this._callGame('enemy_killed', { p_enemy_name: enemyName }, 'enemyKilled');
  }

  static openChest(mapId, x, y) {
    return this._callGame('open_chest', { p_map_id: mapId, p_x: x, p_y: y }, 'openChest');
  }

  /** Returns the updated character. */
  static buyItem(itemId) {
    return this._callGame('buy_item', { p_item_id: itemId }, 'buyItem');
  }

  /** Returns the updated character. */
  static consumeItem(itemId) {
    return this._callGame('consume_item', { p_item_id: itemId }, 'consumeItem');
  }

  /**
   * Securely sync Fitbit exercises with the server.
   */
  static async syncFitbit() {
    return { error: 'La sincronización con Google Health estará disponible pronto.' };
  }

  /**
   * Sign out and delete the local cache.
   */
  static async deleteSave() {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(USER_ID_KEY);
    await supabase.auth.signOut();
  }

  /**
   * Check if user is authenticated or has a cached character.
   * @returns {boolean}
   */
  static hasSave() {
    return this.getUserId() !== null;
  }
}
