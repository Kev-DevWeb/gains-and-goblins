import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import WorldScene from './scenes/WorldScene.js';
import UIScene from './scenes/UIScene.js';
import { GAME_WIDTH, GAME_HEIGHT, ACTIVITIES } from './utils/constants.js';

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

const game = new Phaser.Game(config);

// Setup Activity Tracker Modal UI
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('activity-modal');
  const closeBtn = document.getElementById('close-modal-btn');
  const grid = document.getElementById('activities-grid');

  // Generate buttons from ACTIVITIES
  Object.values(ACTIVITIES).forEach(activity => {
    const btn = document.createElement('button');
    btn.className = 'activity-btn';
    btn.innerHTML = `
      <div class="act-name">${activity.name}</div>
      <div class="act-reward">+${activity.xpReward} ${activity.stat}</div>
    `;
    btn.onclick = () => {
      // Emit to Phaser
      game.events.emit('activity-logged', activity.id);
      modal.classList.add('hidden');
    };
    grid.appendChild(btn);
  });

  closeBtn.onclick = () => modal.classList.add('hidden');

  // Open modal with 'L' key globally
  document.addEventListener('keydown', (e) => {
    // If pressing L, toggle modal
    if (e.key.toLowerCase() === 'l') {
      modal.classList.toggle('hidden');
    }
    // If pressing I, toggle inventory
    if (e.key.toLowerCase() === 'i') {
      document.getElementById('inventory-panel').classList.toggle('hidden');
    }
  });

  // HUD Button Controls
  document.getElementById('btn-habits').onclick = () => modal.classList.toggle('hidden');
  document.getElementById('btn-stats').onclick = () => document.getElementById('stats-panel').classList.toggle('hidden');
  document.getElementById('btn-inventory').onclick = () => document.getElementById('inventory-panel').classList.toggle('hidden');
  document.getElementById('btn-help').onclick = () => document.getElementById('help-panel').classList.toggle('hidden');
  document.getElementById('btn-privacy').onclick = () => document.getElementById('privacy-modal').classList.toggle('hidden');
  document.getElementById('btn-about').onclick = () => document.getElementById('about-modal').classList.toggle('hidden');

  // Quick Use Clicks
  document.getElementById('quick-hp').onclick = () => game.events.emit('quick-use-hp');
  document.getElementById('quick-mp').onclick = () => game.events.emit('quick-use-mp');

  document.querySelectorAll('.close-btn[data-target]').forEach(btn => {
    btn.onclick = (e) => {
      const targetId = e.target.getAttribute('data-target');
      document.getElementById(targetId).classList.add('hidden');
    };
  });

  // Phaser Events -> HTML HUD sync
  game.events.on('update-stats', (stats) => {
    const list = document.getElementById('hud-stats-list');
    list.innerHTML = '';
    const statNames = {
      strength: 'Fuerza', resistance: 'Resistencia', dexterity: 'Destreza',
      speed: 'Velocidad', intelligence: 'Inteligencia', maxMana: 'Mana Máx',
      willpower: 'Voluntad', charisma: 'Carisma'
    };
    for (const [key, val] of Object.entries(stats)) {
      if (statNames[key]) {
        list.innerHTML += `<div class="stat-row"><span>${statNames[key]}:</span> <span>${val}</span></div>`;
      }
    }
  });

  game.events.on('update-gold', (gold) => {
    document.getElementById('hud-gold').innerText = gold;
  });

  game.events.on('update-xp', (xp, maxXp, level) => {
    document.getElementById('hud-xp').innerText = `${xp}/${maxXp}`;
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

});

export default game;
