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

  // Open modal with 'L' key globally
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
  });

  // HUD Button Controls
  document.getElementById('btn-habits').onclick = () => modal.classList.toggle('hidden');
  document.getElementById('btn-stats').onclick = () => document.getElementById('stats-panel').classList.toggle('hidden');
  document.getElementById('btn-inventory').onclick = () => document.getElementById('inventory-panel').classList.toggle('hidden');
  document.getElementById('btn-quests').onclick = () => document.getElementById('quests-panel').classList.toggle('hidden');
  document.getElementById('btn-help').onclick = () => document.getElementById('help-panel').classList.toggle('hidden');
  document.getElementById('btn-privacy').onclick = () => document.getElementById('privacy-modal').classList.toggle('hidden');
  document.getElementById('btn-about').onclick = () => document.getElementById('about-modal').classList.toggle('hidden');

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

function setupGameEventListeners() {
  game.events.on('update-stats', (stats) => {
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

  game.events.on('update-xp', (_xp, _maxXp, level) => {
    document.getElementById('hud-level').innerText = level;
  });

  game.events.on('update-inventory', (inventory) => {
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
}

export default game;
