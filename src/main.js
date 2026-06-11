import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import WorldScene from './scenes/WorldScene.js';
import UIScene from './scenes/UIScene.js';
import { GAME_WIDTH, GAME_HEIGHT, ACTIVITIES } from './utils/constants.js';
import SaveSystem from './utils/SaveSystem.js';

const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scene: [BootScene, MenuScene, WorldScene, UIScene]
};

let game = null;

function initGame() {
  if (game) return;
  game = new Phaser.Game(config);
  setupGameEventListeners();
}

// Setup Activity Tracker Modal UI & Auth Flow
document.addEventListener('DOMContentLoaded', async () => {
  const authModal = document.getElementById('auth-modal');
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');
  const authErrorMsg = document.getElementById('auth-error-msg');
  
  // Tab Switchers
  tabLogin.onclick = () => {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    formLogin.classList.remove('hidden');
    formRegister.classList.add('hidden');
    authErrorMsg.innerText = '';
  };

  tabRegister.onclick = () => {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    formRegister.classList.remove('hidden');
    formLogin.classList.add('hidden');
    authErrorMsg.innerText = '';
  };

  // Submit handlers
  formLogin.onsubmit = async (e) => {
    e.preventDefault();
    authErrorMsg.innerText = 'Cargando...';
    authErrorMsg.style.color = 'var(--clr-gold)';
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    
    const result = await SaveSystem.login(email, password);
    if (result.success) {
      authModal.classList.add('hidden');
      initGame();
    } else {
      authErrorMsg.innerText = result.error || 'Error al iniciar sesión';
      authErrorMsg.style.color = 'var(--clr-crimson)';
    }
  };

  formRegister.onsubmit = async (e) => {
    e.preventDefault();
    authErrorMsg.innerText = 'Forjando personaje...';
    authErrorMsg.style.color = 'var(--clr-gold)';
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    
    const result = await SaveSystem.register(email, password, name);
    if (result.success) {
      authModal.classList.add('hidden');
      initGame();
    } else {
      authErrorMsg.innerText = result.error || 'Error al registrar';
      authErrorMsg.style.color = 'var(--clr-crimson)';
    }
  };

  // Check if already authenticated
  const userId = SaveSystem.getUserId();
  if (userId) {
    authErrorMsg.innerText = 'Autenticando sesión previa...';
    authErrorMsg.style.color = 'var(--clr-gold)';
    const character = await SaveSystem.loadFromServer();
    if (character) {
      authModal.classList.add('hidden');
      initGame();
    } else {
      authErrorMsg.innerText = 'Sesión previa expirada. Inicia sesión.';
      authErrorMsg.style.color = 'var(--clr-crimson)';
      SaveSystem.deleteSave();
    }
  }

  // Setup Activity Tracker Modal UI
  const modal = document.getElementById('activity-modal');
  const closeBtn = document.getElementById('close-modal-btn');
  const grid = document.getElementById('activities-grid');

  // Generate buttons from ACTIVITIES
  Object.values(ACTIVITIES).forEach(activity => {
    const btn = document.createElement('button');
    btn.className = 'activity-btn';
    btn.innerHTML = `
      <div class="act-name">${activity.name}</div>
      <div class="act-reward">+${activity.xpReward} XP (${activity.branch})</div>
    `;
    btn.onclick = () => {
      // Emit to Phaser
      if (game) game.events.emit('activity-logged', activity.id);
      modal.classList.add('hidden');
    };
    grid.appendChild(btn);
  });

  closeBtn.onclick = () => modal.classList.add('hidden');

  // --- GOOGLE HEALTH / FITBIT INTEGRATION ---
  function updateFitbitUI() {
    const saveData = SaveSystem.load();
    const statusEl = document.getElementById('fitbit-status');
    const connectBtn = document.getElementById('btn-fitbit-connect');
    const syncBtn = document.getElementById('btn-fitbit-sync');

    if (!saveData || !statusEl || !connectBtn || !syncBtn) return;

    if (saveData.fitbitUserId) {
      statusEl.innerText = `Vinculado (${saveData.fitbitUserId})`;
      statusEl.style.color = '#2ecc71';
      connectBtn.innerText = 'Re-vincular';
      syncBtn.classList.remove('hidden');
    } else {
      statusEl.innerText = 'No vinculado';
      statusEl.style.color = 'var(--ui-text-dim)';
      connectBtn.innerText = 'Vincular Cuenta';
      syncBtn.classList.add('hidden');
    }
  }

  // Initial render of Fitbit UI
  updateFitbitUI();

  // Listen to character updates to refresh Fitbit UI
  window.addEventListener('character-synced', () => {
    updateFitbitUI();
  });

  const connectBtn = document.getElementById('btn-fitbit-connect');
  if (connectBtn) {
    connectBtn.onclick = () => {
      const uId = SaveSystem.getUserId();
      if (!uId) {
        alert('Debes iniciar sesión primero.');
        return;
      }
      const backendUrl = SaveSystem.getBackendUrl();
      window.location.href = `${backendUrl}/auth/fitbit?userId=${uId}`;
    };
  }

  const syncBtn = document.getElementById('btn-fitbit-sync');
  if (syncBtn) {
    syncBtn.onclick = async () => {
      syncBtn.innerText = 'Sincronizando...';
      syncBtn.disabled = true;
      
      const result = await SaveSystem.syncFitbit();
      
      syncBtn.innerText = 'Sincronizar Hoy';
      syncBtn.disabled = false;

      if (result && result.success) {
        if (result.loggedActivities && result.loggedActivities.length > 0) {
          const names = result.loggedActivities.map(a => a.title).join(', ');
          alert(`¡Sincronización exitosa!\nEjercicios agregados: ${names}\nXP ganada: +${result.totalXpEarned} XP\nPasos de hoy: ${result.steps}`);
        } else {
          alert(`¡Sincronización exitosa! No se encontraron nuevos ejercicios para sincronizar hoy.\nPasos de hoy: ${result.steps}`);
        }
      } else {
        alert(result && result.error ? result.error : 'Error al sincronizar con Google Health.');
      }
    };
  }

  // Handle successful Fitbit redirect callback parameter
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('fitbit') === 'success') {
    setTimeout(() => {
      alert('¡Tu cuenta de Google Health (Fitbit) se ha vinculado correctamente! Ahora puedes sincronizar tus ejercicios.');
    }, 1000);
    const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
  }

  // Open modal with keyboard shortcuts globally
  document.addEventListener('keydown', (e) => {
    // Ignore global shortcuts when typing inside form inputs
    if (document.activeElement.tagName === 'INPUT') return;

    // If pressing L, toggle modal
    if (e.key.toLowerCase() === 'l') {
      modal.classList.toggle('hidden');
    }
    // If pressing I, toggle inventory
    if (e.key.toLowerCase() === 'i') {
      document.getElementById('inventory-panel').classList.toggle('hidden');
    }
    // If pressing J, toggle quests
    if (e.key.toLowerCase() === 'j') {
      document.getElementById('quests-panel').classList.toggle('hidden');
    }
    // If pressing Y, toggle hero panel
    if (e.key.toLowerCase() === 'y') {
      document.getElementById('hero-panel').classList.toggle('hidden');
    }
  });

  // HUD Button Controls
  document.getElementById('btn-habits').onclick = () => modal.classList.toggle('hidden');
  document.getElementById('btn-stats').onclick = () => document.getElementById('stats-panel').classList.toggle('hidden');
  document.getElementById('btn-inventory').onclick = () => document.getElementById('inventory-panel').classList.toggle('hidden');
  document.getElementById('btn-quests').onclick = () => document.getElementById('quests-panel').classList.toggle('hidden');
  document.getElementById('btn-hero').onclick = () => document.getElementById('hero-panel').classList.toggle('hidden');
  document.getElementById('btn-help').onclick = () => document.getElementById('help-panel').classList.toggle('hidden');
  document.getElementById('btn-privacy').onclick = () => document.getElementById('privacy-modal').classList.toggle('hidden');
  document.getElementById('btn-about').onclick = () => document.getElementById('about-modal').classList.toggle('hidden');

  // Party Tab Controls
  document.getElementById('btn-party-create').onclick = () => {
    const nameInput = document.getElementById('party-name-input');
    const name = nameInput.value.trim();
    if (name && game) {
      game.events.emit('party-create', name);
    }
  };

  document.getElementById('btn-party-join').onclick = () => {
    const nameInput = document.getElementById('party-name-input');
    const name = nameInput.value.trim();
    if (name && game) {
      game.events.emit('party-join', name);
    }
  };

  document.getElementById('btn-party-leave').onclick = () => {
    if (game) {
      game.events.emit('party-leave');
    }
  };

  // Hero Panel Tabs switching
  const heroTabs = document.querySelectorAll('.hero-tab');
  heroTabs.forEach(tab => {
    tab.onclick = (e) => {
      heroTabs.forEach(t => {
        t.classList.remove('active');
        t.style.background = 'none';
        t.style.borderColor = 'transparent';
        t.style.color = 'var(--ui-text-dim)';
      });
      tab.classList.add('active');
      tab.style.background = 'rgba(255,255,255,0.05)';
      tab.style.borderColor = 'var(--ui-border)';
      tab.style.color = 'var(--clr-gold)';

      const targetTabId = tab.getAttribute('data-tab');
      document.querySelectorAll('.hero-tab-content').forEach(content => {
        content.classList.add('hidden');
      });
      document.getElementById(`tab-${targetTabId}`).classList.remove('hidden');
    };
  });

  // Inventory filter tabs in Hero Panel
  const invFilters = document.querySelectorAll('.inv-filter');
  invFilters.forEach(filter => {
    filter.onclick = () => {
      invFilters.forEach(f => {
        f.classList.remove('active');
        f.style.borderColor = 'transparent';
        f.style.background = 'rgba(255,255,255,0.05)';
        f.style.color = '#ccc';
      });
      filter.classList.add('active');
      filter.style.borderColor = 'rgba(255,215,0,0.3)';
      filter.style.background = 'rgba(255,215,0,0.1)';
      filter.style.color = '#fff';

      currentInventoryFilter = filter.getAttribute('data-filter');
      if (lastInventoryData) {
        renderHeroInventory(lastInventoryData, lastEquippedAccessoriesData);
      }
    };
  });

  // Quick Use Clicks
  document.getElementById('quick-hp').onclick = () => { if (game) game.events.emit('quick-use-hp'); };
  document.getElementById('quick-mp').onclick = () => { if (game) game.events.emit('quick-use-mp'); };

  document.querySelectorAll('.close-btn[data-target]').forEach(btn => {
    btn.onclick = (e) => {
      const targetId = e.target.getAttribute('data-target');
      document.getElementById(targetId).classList.add('hidden');
    };
  });
});

let currentInventoryFilter = 'all';
let lastInventoryData = [];
let lastEquippedAccessoriesData = [];
let lastStatsData = null;
let lastBranchPointsData = null;
let lastPlayerSpellsData = ['shield', 'ghost_swords', 'heal'];
let lastEquippedSpellsData = ['shield', 'ghost_swords'];
let lastActiveSpellKey = 'shield';

function renderHeroInventory(inventory, equippedAccessories) {
  lastInventoryData = inventory;
  lastEquippedAccessoriesData = equippedAccessories;

  const grid = document.getElementById('hero-classified-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const filtered = inventory.filter(item => {
    if (currentInventoryFilter === 'all') return true;
    return item.type === currentInventoryFilter;
  });

  for (let i = 0; i < Math.max(16, filtered.length); i++) {
    const item = filtered[i];
    if (item) {
      const isEquipped = equippedAccessories.includes(item.id);
      
      let actionsHtml = '';
      if (item.type === 'accessory') {
        actionsHtml = `<div class="item-actions" style="position: absolute; top:0; left:0; width:100%; height:100%; display:none; flex-direction:column; align-items:center; justify-content:center; background:rgba(0,0,0,0.85); border-radius:4px;">
          <button class="btn-action-equip" style="font-size:0.55rem; padding:2px 4px; margin-bottom:2px; background:var(--clr-brown); border:1px solid var(--clr-tan); color:white; border-radius:3px; cursor:pointer;">${isEquipped ? 'Quitar' : 'Equipar'}</button>
        </div>`;
      } else if (item.type === 'consumable') {
        actionsHtml = `<div class="item-actions" style="position: absolute; top:0; left:0; width:100%; height:100%; display:none; flex-direction:column; align-items:center; justify-content:center; background:rgba(0,0,0,0.85); border-radius:4px;">
          <button class="btn-action-use" style="font-size:0.55rem; padding:2px 4px; background:var(--clr-brown); border:1px solid var(--clr-tan); color:white; border-radius:3px; cursor:pointer;">Usar</button>
        </div>`;
      }

      const slot = document.createElement('div');
      slot.className = `inv-slot ${isEquipped ? 'equipped' : ''}`;
      slot.style.position = 'relative';
      if (isEquipped) {
        slot.style.borderColor = 'var(--clr-gold)';
        slot.style.background = 'rgba(255,215,0,0.1)';
      }
      slot.title = `${item.name} (${item.type})`;
      
      slot.innerHTML = `
        ${item.icon}
        <span class="item-count">${item.count}</span>
        ${actionsHtml}
      `;

      slot.onmouseenter = () => {
        const actions = slot.querySelector('.item-actions');
        if (actions) actions.style.display = 'flex';
      };
      slot.onmouseleave = () => {
        const actions = slot.querySelector('.item-actions');
        if (actions) actions.style.display = 'none';
      };

      const equipBtn = slot.querySelector('.btn-action-equip');
      if (equipBtn) {
        equipBtn.onclick = (e) => {
          e.stopPropagation();
          if (isEquipped) {
            if (window.game) window.game.events.emit('unequip-accessory', item);
          } else {
            if (window.game) window.game.events.emit('equip-accessory', item);
          }
        };
      }

      const useBtn = slot.querySelector('.btn-action-use');
      if (useBtn) {
        useBtn.onclick = (e) => {
          e.stopPropagation();
          if (window.game) {
            if (item.id === 'potion_hp') window.game.events.emit('quick-use-hp');
            if (item.id === 'potion_mp') window.game.events.emit('quick-use-mp');
          }
        };
      }

      grid.appendChild(slot);
    } else {
      const slot = document.createElement('div');
      slot.className = 'inv-slot';
      grid.appendChild(slot);
    }
  }

  const eqContainer = document.getElementById('hero-equipped-accessories');
  if (eqContainer) {
    eqContainer.innerHTML = '';
    for (let j = 0; j < 2; j++) {
      const accId = equippedAccessories[j];
      const accItem = inventory.find(i => i.id === accId);
      
      const slot = document.createElement('div');
      slot.className = `accessory-slot ${accItem ? 'filled' : ''}`;
      
      if (accItem) {
        let bonusText = '';
        if (accItem.effect) {
          bonusText = Object.entries(accItem.effect)
            .map(([stat, val]) => `+${val} ${stat.substring(0,3).toUpperCase()}`)
            .join(', ');
        }
        slot.innerHTML = `
          <span class="accessory-slot__icon">${accItem.icon}</span>
          <div class="accessory-slot__info">
            <span class="accessory-slot__name" style="font-size: 0.65rem;">${accItem.name}</span>
            <span class="accessory-slot__bonus" style="font-size: 0.55rem;">${bonusText}</span>
          </div>
        `;
        slot.onclick = () => {
          if (window.game) window.game.events.emit('unequip-accessory', accItem);
        };
      } else {
        slot.innerHTML = `<span class="accessory-slot__empty">Vacío</span>`;
      }
      eqContainer.appendChild(slot);
    }
  }
}

function renderHeroStats(stats, branchPoints) {
  lastStatsData = stats;
  lastBranchPointsData = branchPoints;

  const container = document.getElementById('hero-branches-container');
  if (!container) return;
  container.innerHTML = '';

  const statLabels = {
    strength: 'Fuerza',
    resistance: 'Resistencia',
    dexterity: 'Destreza',
    speed: 'Velocidad',
    intelligence: 'Inteligencia',
    maxMana: 'Maná Máx',
    willpower: 'Voluntad',
    charisma: 'Carisma'
  };

  const statDescs = {
    strength: '+Daño de espada',
    resistance: '+Vida máxima',
    dexterity: '+Daño de arco',
    speed: '+Velocidad de movimiento/ataque',
    intelligence: '+Daño de magia',
    maxMana: '+Reserva de maná',
    willpower: '+Regeneración de maná',
    charisma: '+Precios en tienda'
  };

  const branchesDef = {
    strength: { name: 'Fuerza', icon: '⚔️', stats: ['strength', 'resistance'] },
    dexterity: { name: 'Destreza', icon: '🏹', stats: ['dexterity', 'speed'] },
    intelligence: { name: 'Inteligencia', icon: '✨', stats: ['intelligence', 'maxMana'] },
    willpower: { name: 'Voluntad', icon: '🧘', stats: ['willpower', 'charisma'] }
  };

  Object.entries(branchesDef).forEach(([bKey, bDef]) => {
    const card = document.createElement('div');
    card.className = 'hero-branch-card';

    const points = branchPoints[bKey] || 0;
    const pointsText = points > 0 
      ? `<span class="gold-text" style="font-weight:bold; font-size:0.75rem;">¡${points} Punto(s)!</span>`
      : `<span style="color:#8b8b8b; font-size:0.75rem;">0 puntos</span>`;

    card.innerHTML = `
      <div class="hero-branch-header">
        <span style="font-weight:bold; font-family:var(--font-title); color:var(--clr-gold); font-size: 0.85rem;">${bDef.icon} Rama ${bDef.name}</span>
        <span>${pointsText}</span>
      </div>
      <div class="hero-branch-stats" style="display:flex; flex-direction:column; gap:4px;">
      </div>
    `;

    const statsList = card.querySelector('.hero-branch-stats');
    bDef.stats.forEach(statKey => {
      const row = document.createElement('div');
      row.className = 'hero-stat-row';

      const val = stats[statKey] || 5;
      
      let allocateBtnHtml = '';
      if (points > 0) {
        allocateBtnHtml = `<button class="btn-allocate-stat">+</button>`;
      }

      row.innerHTML = `
        <div class="hero-stat-info" style="text-align: left;">
          <span style="font-weight:600; color:#eee; font-size:0.75rem;">${statLabels[statKey] || statKey}</span>
          <span class="hero-stat-desc" style="font-size:0.6rem;">${statDescs[statKey] || ''}</span>
        </div>
        <div class="hero-stat-value-group">
          <span style="font-weight:bold; font-size:0.85rem; color:var(--clr-gold);">${val}</span>
          ${allocateBtnHtml}
        </div>
      `;

      const plusBtn = row.querySelector('.btn-allocate-stat');
      if (plusBtn) {
        plusBtn.onclick = () => {
          if (window.game) window.game.events.emit('spend-branch-point', bKey, statKey);
        };
      }

      statsList.appendChild(row);
    });

    container.appendChild(card);
  });
}

function renderHeroSpells(spells, equippedSpells, activeSpellKey) {
  lastPlayerSpellsData = spells;
  lastEquippedSpellsData = equippedSpells;
  lastActiveSpellKey = activeSpellKey;

  const slot0 = document.getElementById('spell-slot-0');
  const slot0Name = document.getElementById('spell-slot-0-name');
  const slot1 = document.getElementById('spell-slot-1');
  const slot1Name = document.getElementById('spell-slot-1-name');

  if (!slot0 || !slot1) return;

  const spellIcons = { shield: '🛡️', ghost_swords: '⚔️', heal: '💚' };
  const spellNames = { shield: 'Escudo de Maná', ghost_swords: 'Espadas Fantasma', heal: 'Fuego Curativo' };
  const spellDescs = {
    shield: 'Absorbe daño usando Maná (10 Maná)',
    ghost_swords: 'Espadas orbitales que dañan enemigos (15 Maná)',
    heal: 'Cura instantáneamente 25 HP (15 Maná)'
  };

  const sp0 = equippedSpells[0];
  if (sp0) {
    slot0.innerHTML = `${spellIcons[sp0] || '✨'}`;
    slot0Name.innerText = spellNames[sp0] || sp0;
    slot0.style.borderColor = (sp0 === activeSpellKey) ? 'var(--clr-gold)' : 'rgba(255,215,0,0.3)';
    slot0.style.background = (sp0 === activeSpellKey) ? 'rgba(255,215,0,0.1)' : 'none';
  } else {
    slot0.innerHTML = '-';
    slot0Name.innerText = 'Vacío';
    slot0.style.borderColor = 'rgba(255,255,255,0.1)';
    slot0.style.background = 'none';
  }

  const sp1 = equippedSpells[1];
  if (sp1) {
    slot1.innerHTML = `${spellIcons[sp1] || '✨'}`;
    slot1Name.innerText = spellNames[sp1] || sp1;
    slot1.style.borderColor = (sp1 === activeSpellKey) ? 'var(--clr-gold)' : 'rgba(255,215,0,0.3)';
    slot1.style.background = (sp1 === activeSpellKey) ? 'rgba(255,215,0,0.1)' : 'none';
  } else {
    slot1.innerHTML = '-';
    slot1Name.innerText = 'Vacío';
    slot1.style.borderColor = 'rgba(255,255,255,0.1)';
    slot1.style.background = 'none';
  }

  const list = document.getElementById('hero-spells-list');
  if (!list) return;
  list.innerHTML = '';

  spells.forEach(spellKey => {
    const row = document.createElement('div');
    row.className = 'hero-spell-row';

    const isEquipped0 = equippedSpells[0] === spellKey;
    const isEquipped1 = equippedSpells[1] === spellKey;
    const isEquipped = isEquipped0 || isEquipped1;

    let equipButtonsHtml = '';
    if (isEquipped) {
      equipButtonsHtml = `<span class="btn-spell-equip equipped">Equipado</span>`;
    } else {
      equipButtonsHtml = `
        <button class="btn-spell-equip" onclick="event.stopPropagation(); if(window.game) window.game.events.emit('equip-spell', 0, '${spellKey}')">Eq. 1</button>
        <button class="btn-spell-equip" onclick="event.stopPropagation(); if(window.game) window.game.events.emit('equip-spell', 1, '${spellKey}')">Eq. 2</button>
      `;
    }

    row.innerHTML = `
      <div class="hero-spell-details" style="text-align: left;">
        <span style="font-weight:bold; color:var(--clr-gold); font-size: 0.75rem;">${spellIcons[spellKey] || '✨'} ${spellNames[spellKey] || spellKey}</span>
        <span style="font-size:0.6rem; color:#ccc;">${spellDescs[spellKey] || ''}</span>
      </div>
      <div class="hero-spell-actions">
        ${equipButtonsHtml}
      </div>
    `;

    list.appendChild(row);
  });
}

function setupGameEventListeners() {
  game.events.on('update-stats', (stats) => {
    lastStatsData = stats;
    renderHeroStats(stats, lastBranchPointsData || {});

    const list = document.getElementById('hud-stats-list');
    list.innerHTML = '';
    const statNames = {
      strength: 'Fuerza', resistance: 'Resistencia', dexterity: 'Destreza',
      speed: 'Velocidad', intelligence: 'Inteligencia', maxMana: 'Maná Máx',
      willpower: 'Voluntad', charisma: 'Carisma'
    };
    for (const [key, val] of Object.entries(stats)) {
      if (statNames[key]) {
        list.innerHTML += `<div class="stat-row"><span>${statNames[key]}:</span> <span>${val}</span></div>`;
      }
    }
    // Keep moral row if it was already rendered
    const moralEl = document.getElementById('hud-moral-row');
    if (!moralEl) _renderMoralRow(0);
  });

  function _moralLabel(val) {
    if (val >=  50) return { text: 'Heroíco 🌟', color: '#ffd700' };
    if (val >=  10) return { text: 'Bueno ✨',    color: '#2ecc71' };
    if (val >= -10) return { text: 'Neutral ⚖️',  color: '#aaaaaa' };
    if (val >= -50) return { text: 'Oscuro ⚫',   color: '#888888' };
    return                        { text: 'Malévolo 💀', color: '#e94560' };
  }

  function _renderMoralRow(val) {
    const list = document.getElementById('hud-stats-list');
    let moralEl = document.getElementById('hud-moral-row');
    if (!moralEl) {
      moralEl = document.createElement('div');
      moralEl.id = 'hud-moral-row';
      moralEl.className = 'stat-row';
      list.appendChild(moralEl);
    }
    const { text, color } = _moralLabel(val);
    const sign = val >= 0 ? '+' : '';
    moralEl.innerHTML = `<span>Moral:</span> <span style="color:${color}">${sign}${val} ${text}</span>`;
  }

  game.events.on('update-moral', (val) => {
    _renderMoralRow(val);
  });

  game.events.on('update-gold', (gold) => {
    document.getElementById('hud-gold').innerText = gold;
  });

  game.events.on('update-xp', (xp, maxXp, level) => {
    document.getElementById('hud-level').innerText = level;
    const levelVal = document.getElementById('hero-level-val');
    const xpVal = document.getElementById('hero-xp-val');
    const xpMaxVal = document.getElementById('hero-xp-max-val');
    if (levelVal) levelVal.innerText = level;
    if (xpVal) xpVal.innerText = xp;
    if (xpMaxVal) xpMaxVal.innerText = maxXp;
  });

  game.events.on('update-inventory', (inventory) => {
    lastInventoryData = inventory;
    renderHeroInventory(inventory, lastEquippedAccessoriesData || []);

    const grid = document.getElementById('inventory-grid');
    grid.innerHTML = '';
    let hpCount = 0;
    let mpCount = 0;
    
    // Create 16 slots minimum
    for (let i = 0; i < Math.max(16, inventory.length); i++) {
      const item = inventory[i];
      if (item) {
        grid.innerHTML += `
          <div class="inv-slot" title="${item.name}">
            ${item.icon}
            <span class="item-count">${item.count}</span>
          </div>
        `;
        if (item.id === 'potion_hp') hpCount = item.count;
        if (item.id === 'potion_mp') mpCount = item.count;
      } else {
        grid.innerHTML += `<div class="inv-slot"></div>`;
      }
    }

    document.getElementById('count-hp').innerText = hpCount;
    document.getElementById('count-mp').innerText = mpCount;
  });

  game.events.on('update-branch-points', (branchPoints) => {
    lastBranchPointsData = branchPoints;
    if (lastStatsData) {
      renderHeroStats(lastStatsData, branchPoints);
    }
  });

  game.events.on('update-equipped-accessories', (equipped) => {
    lastEquippedAccessoriesData = equipped;
    if (lastInventoryData) {
      renderHeroInventory(lastInventoryData, equipped);
    }
  });

  game.events.on('active-spell-changed', (activeSpellKey) => {
    lastActiveSpellKey = activeSpellKey;
    const spellIcons = { shield: '🛡️', ghost_swords: '⚔️', heal: '💚' };
    const spellNames = { shield: 'Escudo', ghost_swords: 'Espadas', heal: 'Curación' };
    
    const iconEl = document.getElementById('hud-active-spell-icon');
    const nameEl = document.getElementById('hud-active-spell-name');
    if (iconEl) iconEl.innerText = spellIcons[activeSpellKey] || '✨';
    if (nameEl) nameEl.innerText = spellNames[activeSpellKey] || activeSpellKey;
    
    renderHeroSpells(lastPlayerSpellsData || [], lastEquippedSpellsData || [], activeSpellKey);
  });

  game.events.on('update-spells', (spells, equippedSpells) => {
    lastPlayerSpellsData = spells;
    lastEquippedSpellsData = equippedSpells;
    renderHeroSpells(spells, equippedSpells, lastActiveSpellKey);
  });

  game.events.on('update-quests', (activeDailies, activeMains) => {
    const dailyList = document.getElementById('daily-quests-list');
    dailyList.innerHTML = '';
    if (activeDailies.length === 0) {
      dailyList.innerHTML = '<div style="color: #8b8b8b; font-size: 0.8rem; padding: 4px;">No hay misiones diarias activas. Visita el tablón en el Gremio para aceptar algunas hoy.</div>';
    } else {
      activeDailies.forEach(m => {
        const progressVal = m.extraKill
          ? `${m.current}/${m.count} + ${m.extraProgress}/${m.extraKill.count}`
          : `${m.current}/${m.count}`;
        const statusText = m.completed 
          ? '<span style="color: #2ecc71; font-weight: bold;">🎁 Completada!</span>' 
          : `<span style="color: #ffd700; font-weight: bold;">${progressVal}</span>`;
        dailyList.innerHTML += `
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,215,0,0.15); padding: 6px; border-radius: 4px; font-size: 0.8rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
              <span style="font-weight: bold; color: #ffd700;">${m.icon} ${m.title}</span>
              <span>${statusText}</span>
            </div>
            <div style="color: #bbbbcc; font-size: 0.75rem;">${m.desc}</div>
          </div>
        `;
      });
    }

    const mainList = document.getElementById('main-quests-list');
    mainList.innerHTML = '';
    if (activeMains.length === 0) {
      mainList.innerHTML = '<div style="color: #8b8b8b; font-size: 0.8rem; padding: 4px;">No hay misiones principales activas. Habla con el Maestro.</div>';
    } else {
      activeMains.forEach(q => {
        const statusText = q.state === 'complete' 
          ? '<span style="color: #2ecc71; font-weight: bold;">¡Lista!</span>' 
          : `<span style="color: #ffd700; font-weight: bold;">${q.progress}/${q.objective.required}</span>`;
        mainList.innerHTML += `
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(155,89,182,0.25); padding: 6px; border-radius: 4px; font-size: 0.8rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
              <span style="font-weight: bold; color: #a855f7;">📜 ${q.title}</span>
              <span>${statusText}</span>
            </div>
            <div style="color: #bbbbcc; font-size: 0.75rem;">${q.desc}</div>
          </div>
        `;
      });
    }
  });

  game.events.on('party-updated', (party) => {
    const setupSec = document.getElementById('party-setup-section');
    const activeSec = document.getElementById('party-active-section');
    const curName = document.getElementById('party-current-name');
    const list = document.getElementById('party-members-list');

    if (setupSec) setupSec.classList.add('hidden');
    if (activeSec) activeSec.classList.remove('hidden');
    if (curName) curName.innerText = party.id;

    if (list) {
      list.innerHTML = '';
      party.members.forEach(member => {
        list.innerHTML += `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 6px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,215,0,0.1); border-radius: 4px; font-size: 0.8rem;">
            <span style="color: #e8d5b7;">👤 ${member.characterName}</span>
            <span style="color: #8b8b8b; font-size: 0.7rem;">${member.userId === SaveSystem.getUserId() ? '(Tú)' : 'Miembro'}</span>
          </div>
        `;
      });
    }
  });

  game.events.on('party-left', () => {
    const setupSec = document.getElementById('party-setup-section');
    const activeSec = document.getElementById('party-active-section');
    const curName = document.getElementById('party-current-name');
    const list = document.getElementById('party-members-list');
    const nameInput = document.getElementById('party-name-input');

    if (setupSec) setupSec.classList.remove('hidden');
    if (activeSec) activeSec.classList.add('hidden');
    if (curName) curName.innerText = '-';
    if (list) list.innerHTML = '';
    if (nameInput) nameInput.value = '';
  });
}

export default game;
