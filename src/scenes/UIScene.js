// ============================================================================
// UIScene.js - HUD Overlay for Gains & Goblins
// ============================================================================
// Runs as a SEPARATE scene on top of WorldScene.  Renders health/mana/XP bars,
// level indicator, weapon slots, compact stat panel (toggle with TAB), and a
// slide-in notification system.  Listens for events from the game registry and
// scene event bus to stay in sync with gameplay.
// ============================================================================

import {
  WEAPONS,
  BASE_STATS,
  STAT_NAMES,
  GAME_WIDTH,
  GAME_HEIGHT,
  SCENES,
  UI_COLORS,
} from '../utils/constants.js';

// ── Layout constants ────────────────────────────────────────────────────────
const PAD         = 10;        // general padding
const BAR_W       = 160;       // health / mana bar width
const BAR_H       = 14;        // health / mana bar height
const XP_BAR_H    = 6;         // XP bar (thinner)
const SLOT_SIZE   = 40;        // weapon-slot square
const SLOT_GAP    = 6;         // gap between weapon slots
const CORNER_R    = 4;         // rounded-rect corner radius
const GOLD        = 0xffd700;
const GOLD_HEX    = '#ffd700';
const DARK_BG     = 0x0a0a1e;

export default class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.UI });
  }

  // --------------------------------------------------------------------------
  //  CREATE
  // --------------------------------------------------------------------------
  create() {
    // Make sure this scene renders above everything else
    this.scene.bringToTop();

    // ── State ──
    this._hp        = { cur: 100, max: 100 };
    this._mp        = { cur: 50,  max: 50 };
    this._xp        = { cur: 0,   max: 100 };
    this._level     = 1;
    this._gold      = 0;
    this._activeWpn = Object.keys(WEAPONS)[0]; // first weapon key
    this._stats     = { ...BASE_STATS };
    this._statsOpen = false;

    // ── Build UI elements ──
    this._createHealthBar();
    this._createManaBar();
    this._createXPBar();
    this._createLevelBadge();
    this._createGoldDisplay();
    this._createWeaponSlots();
    this._createStatsPanel();
    this._createNotificationArea();
    this._createDeathBanner();

    // ── Input ──
    this._bindKeys();

    // ── Cross-scene event listeners ──
    this._bindEvents();
  }

  // ========================================================================
  //  HEALTH BAR  (top-left)
  // ========================================================================
  _createHealthBar() {
    const x = PAD;
    const y = PAD;

    // Container background (rounded rect)
    this._hpContainer = this.add.graphics();
    this._drawRoundedPanel(this._hpContainer, x - 4, y - 4, BAR_W + 8, BAR_H + 8);

    // Icon
    if (this.textures.exists('icon_heart')) {
      this._hpIcon = this.add.image(x + 2, y + BAR_H / 2, 'icon_heart')
        .setOrigin(0, 0.5)
        .setScale(0.45);
    }

    // Bar graphics (redrawn on update)
    this._hpBar = this.add.graphics();
    this._hpText = this.add.text(x + BAR_W / 2, y + BAR_H / 2, '', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '10px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);

    this._drawHealthBar();
  }

  _drawHealthBar() {
    const x = PAD;
    const y = PAD;
    const g = this._hpBar;
    g.clear();

    // Background
    g.fillStyle(0x330000, 0.8);
    g.fillRoundedRect(x, y, BAR_W, BAR_H, CORNER_R);

    // Fill (red gradient simulated with two layers)
    const pct = Phaser.Math.Clamp(this._hp.cur / this._hp.max, 0, 1);
    const fillW = Math.round(BAR_W * pct);
    if (fillW > 0) {
      // Darker base
      g.fillStyle(0xcc2244, 0.9);
      g.fillRoundedRect(x, y, fillW, BAR_H, CORNER_R);
      // Lighter top half for gradient effect
      g.fillStyle(0xe94560, 0.5);
      g.fillRoundedRect(x, y, fillW, BAR_H / 2, { tl: CORNER_R, tr: CORNER_R, bl: 0, br: 0 });
    }

    // Border
    g.lineStyle(1, GOLD, 0.6);
    g.strokeRoundedRect(x, y, BAR_W, BAR_H, CORNER_R);

    // Text
    this._hpText.setText(`${this._hp.cur} / ${this._hp.max}`);
  }

  // ========================================================================
  //  MANA BAR  (below health)
  // ========================================================================
  _createManaBar() {
    const x = PAD;
    const y = PAD + BAR_H + 10;

    this._mpContainer = this.add.graphics();
    this._drawRoundedPanel(this._mpContainer, x - 4, y - 4, BAR_W + 8, BAR_H + 8);

    if (this.textures.exists('icon_mana')) {
      this._mpIcon = this.add.image(x + 2, y + BAR_H / 2, 'icon_mana')
        .setOrigin(0, 0.5)
        .setScale(0.4);
    }

    this._mpBar = this.add.graphics();
    this._mpText = this.add.text(x + BAR_W / 2, y + BAR_H / 2, '', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '10px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);

    this._drawManaBar();
  }

  _drawManaBar() {
    const x = PAD;
    const y = PAD + BAR_H + 10;
    const g = this._mpBar;
    g.clear();

    g.fillStyle(0x0a1030, 0.8);
    g.fillRoundedRect(x, y, BAR_W, BAR_H, CORNER_R);

    const pct = Phaser.Math.Clamp(this._mp.cur / this._mp.max, 0, 1);
    const fillW = Math.round(BAR_W * pct);
    if (fillW > 0) {
      g.fillStyle(0x1a6b8a, 0.9);
      g.fillRoundedRect(x, y, fillW, BAR_H, CORNER_R);
      g.fillStyle(0x2d9cdb, 0.5);
      g.fillRoundedRect(x, y, fillW, BAR_H / 2, { tl: CORNER_R, tr: CORNER_R, bl: 0, br: 0 });
    }

    g.lineStyle(1, GOLD, 0.6);
    g.strokeRoundedRect(x, y, BAR_W, BAR_H, CORNER_R);

    this._mpText.setText(`${this._mp.cur} / ${this._mp.max}`);
  }

  // ========================================================================
  //  XP BAR  (thin bar below mana)
  // ========================================================================
  _createXPBar() {
    const x = PAD;
    const y = PAD + (BAR_H + 10) * 2;

    this._xpBar = this.add.graphics();
    this._xpLabel = this.add.text(x + BAR_W + 6, y + XP_BAR_H / 2, '', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '9px',
      color: GOLD_HEX,
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0, 0.5);

    this._drawXPBar();
  }

  _drawXPBar() {
    const x = PAD;
    const y = PAD + (BAR_H + 10) * 2;
    const g = this._xpBar;
    g.clear();

    g.fillStyle(0x1a1a1a, 0.8);
    g.fillRoundedRect(x, y, BAR_W, XP_BAR_H, 2);

    const pct = this._xp.max > 0 ? Phaser.Math.Clamp(this._xp.cur / this._xp.max, 0, 1) : 0;
    const fillW = Math.round(BAR_W * pct);
    if (fillW > 0) {
      g.fillStyle(GOLD, 0.9);
      g.fillRoundedRect(x, y, fillW, XP_BAR_H, 2);
    }

    g.lineStyle(1, GOLD, 0.4);
    g.strokeRoundedRect(x, y, BAR_W, XP_BAR_H, 2);

    this._xpLabel.setText(`XP ${this._xp.cur}/${this._xp.max}`);
  }

  // ========================================================================
  //  LEVEL BADGE
  // ========================================================================
  _createLevelBadge() {
    const x = PAD + BAR_W + 30;
    const y = PAD + 4;

    this._lvlBadge = this.add.graphics();
    this._lvlBadge.fillStyle(DARK_BG, 0.85);
    this._lvlBadge.fillCircle(x, y + 14, 18);
    this._lvlBadge.lineStyle(2, GOLD, 0.8);
    this._lvlBadge.strokeCircle(x, y + 14, 18);

    this._lvlText = this.add.text(x, y + 14, `${this._level}`, {
      fontFamily: 'MedievalSharp, serif',
      fontSize: '18px',
      color: GOLD_HEX,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    this._lvlLabel = this.add.text(x, y + 32, 'NIVEL', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '8px',
      color: '#aaaaaa',
    }).setOrigin(0.5, 0);
  }

  // ========================================================================
  //  GOLD DISPLAY  (below level badge)
  // ========================================================================
  _createGoldDisplay() {
    const x = PAD + BAR_W + 30;
    const y = PAD + 48;

    this._goldText = this.add.text(x, y, '0', {
      fontFamily: 'MedievalSharp, serif',
      fontSize: '12px',
      color: GOLD_HEX,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5, 0);

    this._goldLabel = this.add.text(x, y + 16, 'ORO', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '7px',
      color: '#aaaaaa',
    }).setOrigin(0.5, 0);
  }

  updateGold(amount) {
    this._gold = amount;
    this._goldText.setText(`${amount}`);
  }

  // ========================================================================
  //  DEATH BANNER
  // ========================================================================
  _createDeathBanner() {
    this._deathBanner = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '¡Has caído!', {
      fontFamily: 'MedievalSharp, serif',
      fontSize: '32px',
      color: '#e94560',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5).setAlpha(0).setDepth(100);

    this._deathSub = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40, '', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '14px',
      color: '#c4a35a',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setAlpha(0).setDepth(100);
  }

  showDeathBanner() {
    this.tweens.add({
      targets: [this._deathBanner, this._deathSub],
      alpha: 1,
      duration: 500,
      ease: 'Power2',
    });

    // Auto-hide after respawn
    this.time.delayedCall(2000, () => {
      this.tweens.add({
        targets: [this._deathBanner, this._deathSub],
        alpha: 0,
        duration: 500,
      });
    });
  }

  // ========================================================================
  //  WEAPON SLOTS  (bottom-center, 3 slots)
  // ========================================================================
  _createWeaponSlots() {
    const weaponKeys = Object.keys(WEAPONS);
    const totalW = weaponKeys.length * SLOT_SIZE + (weaponKeys.length - 1) * SLOT_GAP;
    const startX = (GAME_WIDTH - totalW) / 2;
    const y = GAME_HEIGHT - SLOT_SIZE - PAD;

    this._weaponSlots = {};
    this._weaponSlotGfx = this.add.graphics();
    this._weaponSlotIcons = [];
    this._weaponSlotLabels = [];

    const iconKeys = {
      [Object.keys(WEAPONS)[0]]: 'icon_sword',
      [Object.keys(WEAPONS)[1]]: 'icon_bow',
      [Object.keys(WEAPONS)[2]]: 'icon_magic',
    };

    const numLabels = ['1', '2', '3'];

    weaponKeys.forEach((wKey, i) => {
      const sx = startX + i * (SLOT_SIZE + SLOT_GAP);
      this._weaponSlots[wKey] = { x: sx, y, idx: i };

      // Icon image (scaled to fit slot)
      const texKey = iconKeys[wKey] || 'icon_sword';
      if (this.textures.exists(texKey)) {
        const icon = this.add.image(sx + SLOT_SIZE / 2, y + SLOT_SIZE / 2, texKey)
          .setScale(0.9)
          .setAlpha(0.7);
        this._weaponSlotIcons.push(icon);
      }

      // Number label
      const numTxt = this.add.text(sx + 4, y + 2, numLabels[i], {
        fontFamily: 'Inter, sans-serif',
        fontSize: '10px',
        color: '#aaaaaa',
        stroke: '#000000',
        strokeThickness: 2,
      });
      this._weaponSlotLabels.push(numTxt);
    });

    this._drawWeaponSlots();
  }

  _drawWeaponSlots() {
    const g = this._weaponSlotGfx;
    g.clear();

    const weaponKeys = Object.keys(WEAPONS);

    weaponKeys.forEach((wKey, i) => {
      const slot = this._weaponSlots[wKey];
      const isActive = wKey === this._activeWpn;

      // Slot background
      g.fillStyle(DARK_BG, isActive ? 0.95 : 0.75);
      g.fillRoundedRect(slot.x, slot.y, SLOT_SIZE, SLOT_SIZE, 4);

      if (isActive) {
        // Glow effect – two layered borders
        g.lineStyle(2, GOLD, 0.9);
        g.strokeRoundedRect(slot.x - 1, slot.y - 1, SLOT_SIZE + 2, SLOT_SIZE + 2, 5);
        g.lineStyle(1, 0xffffff, 0.3);
        g.strokeRoundedRect(slot.x - 3, slot.y - 3, SLOT_SIZE + 6, SLOT_SIZE + 6, 6);
      } else {
        g.lineStyle(1, 0x555566, 0.6);
        g.strokeRoundedRect(slot.x, slot.y, SLOT_SIZE, SLOT_SIZE, 4);
      }

      // Adjust icon brightness
      if (this._weaponSlotIcons[i]) {
        this._weaponSlotIcons[i].setAlpha(isActive ? 1 : 0.5);
      }
    });
  }

  // ========================================================================
  //  STATS PANEL  (top-right, toggleable with TAB)
  // ========================================================================
  _createStatsPanel() {
    const panelW = 150;
    const lineH = 16;
    const statKeys = Object.keys(STAT_NAMES);
    const panelH = statKeys.length * lineH + 30;
    const px = GAME_WIDTH - panelW - PAD;
    const py = PAD;

    // Panel container (graphics)
    this._statsPanelGfx = this.add.graphics();
    this._statsPanelGfx.fillStyle(DARK_BG, 0.88);
    this._statsPanelGfx.fillRoundedRect(px, py, panelW, panelH, 6);
    this._statsPanelGfx.lineStyle(1, GOLD, 0.5);
    this._statsPanelGfx.strokeRoundedRect(px, py, panelW, panelH, 6);

    // Title
    this._statsPanelTitle = this.add.text(px + panelW / 2, py + 8, '⚔ STATS', {
      fontFamily: 'MedievalSharp, serif',
      fontSize: '13px',
      color: GOLD_HEX,
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 0);

    // Stat rows
    this._statTexts = {};
    statKeys.forEach((key, i) => {
      const rowY = py + 26 + i * lineH;
      // Stat name
      this.add.text(px + 8, rowY, STAT_NAMES[key] || key, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '10px',
        color: '#bbbbcc',
      }).setOrigin(0, 0).setData('statsChild', true);

      // Stat value
      this._statTexts[key] = this.add.text(px + panelW - 8, rowY, `${this._stats[key] ?? 0}`, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '10px',
        color: '#ffffff',
      }).setOrigin(1, 0);
    });

    // Group everything under a container-like visibility flag
    this._statsPanelElements = [
      this._statsPanelGfx,
      this._statsPanelTitle,
      ...Object.values(this._statTexts),
    ];

    // Collect the label texts we just added (they have data flag)
    this.children.list.forEach((child) => {
      if (child.getData && child.getData('statsChild')) {
        this._statsPanelElements.push(child);
      }
    });

    // Affinity row at the bottom of the panel
    const affinityY = py + 26 + statKeys.length * lineH + 4;
    this._affinityBg = this.add.graphics();
    this._affinityBg.fillStyle(0x1a1a3e, 0.9);
    this._affinityBg.fillRoundedRect(px + 4, affinityY - 2, panelW - 8, 24, 4);
    this._affinityBg.lineStyle(1, 0xf1c40f, 0.6);
    this._affinityBg.strokeRoundedRect(px + 4, affinityY - 2, panelW - 8, 24, 4);

    this._affinityLabel = this.add.text(px + 8, affinityY + 4, '🌟 Afinidad:', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '9px',
      color: '#f1c40f',
    }).setOrigin(0, 0.5);

    this._affinityValue = this.add.text(px + panelW - 8, affinityY + 4, 'Ninguna', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '9px',
      color: '#ffffff',
    }).setOrigin(1, 0.5);

    this._statsPanelElements.push(this._affinityBg, this._affinityLabel, this._affinityValue);

    // Resize the panel to fit
    const totalH = panelH + 28;
    this._statsPanelGfx.clear();
    this._statsPanelGfx.fillStyle(DARK_BG, 0.88);
    this._statsPanelGfx.fillRoundedRect(px, py, panelW, totalH, 6);
    this._statsPanelGfx.lineStyle(1, GOLD, 0.5);
    this._statsPanelGfx.strokeRoundedRect(px, py, panelW, totalH, 6);

    // Start hidden
    this._setStatsPanelVisible(false);
  }

  _setStatsPanelVisible(visible) {
    this._statsOpen = visible;
    this._statsPanelElements.forEach((el) => el.setVisible(visible));
  }

  _refreshStatsPanel() {
    Object.keys(this._statTexts).forEach((key) => {
      this._statTexts[key].setText(`${this._stats[key] ?? 0}`);
    });
  }

  // ========================================================================
  //  NOTIFICATION SYSTEM  (right side, slide in / fade out)
  // ========================================================================
  _createNotificationArea() {
    this._notifications = []; // active notification text objects
  }

  /** Show a notification that slides in from the right and fades out */
  showNotification(text, color = GOLD_HEX) {
    const nx = GAME_WIDTH - PAD;
    // Stack below existing ones
    const offsetY = 60 + this._notifications.length * 28;
    const ny = offsetY;

    const notif = this.add.text(nx + 200, ny, text, {
      fontFamily: 'Inter, sans-serif',
      fontSize: '12px',
      color,
      stroke: '#000000',
      strokeThickness: 3,
      backgroundColor: 'rgba(10,10,30,0.8)',
      padding: { x: 8, y: 4 },
    }).setOrigin(1, 0);

    this._notifications.push(notif);

    // Slide in
    this.tweens.add({
      targets: notif,
      x: nx,
      duration: 350,
      ease: 'Power2',
      onComplete: () => {
        // Hold then fade out
        this.tweens.add({
          targets: notif,
          alpha: 0,
          delay: 2500,
          duration: 500,
          ease: 'Power1',
          onComplete: () => {
            const idx = this._notifications.indexOf(notif);
            if (idx !== -1) this._notifications.splice(idx, 1);
            notif.destroy();
          },
        });
      },
    });
  }

  // ========================================================================
  //  PUBLIC API – called by WorldScene via events or direct reference
  // ========================================================================
  updateHealth(current, max) {
    this._hp.cur = current;
    this._hp.max = max;
    this._drawHealthBar();
  }

  updateMana(current, max) {
    this._mp.cur = current;
    this._mp.max = max;
    this._drawManaBar();
  }

  updateXP(current, max, level) {
    this._xp.cur = current;
    this._xp.max = max;
    if (level !== undefined) {
      this._level = level;
      this._lvlText.setText(`${level}`);
    }
    this._drawXPBar();
  }

  setActiveWeapon(weaponKey) {
    if (!WEAPONS[weaponKey]) return;
    this._activeWpn = weaponKey;
    this._drawWeaponSlots();
  }

  updateStats(statsObject) {
    Object.assign(this._stats, statsObject);
    this._refreshStatsPanel();
  }

  updateAffinity(dominantBranch, counts) {
    const branchNames = {
      strength: '⚔️ Espada +15%',
      dexterity: '🏹 Arco +15%',
      intelligence: '✨ Magia +15%',
      willpower: '🧘 Voluntad +15%'
    };
    const label = dominantBranch ? branchNames[dominantBranch] : 'Ninguna';
    const color = dominantBranch ? '#f1c40f' : '#888899';
    if (this._affinityValue) {
      this._affinityValue.setText(label).setColor(color);
    }
  }

  // ========================================================================
  //  INPUT BINDINGS
  // ========================================================================
  _bindKeys() {
    const keys = this.input.keyboard;

    // Weapon switching: 1, 2, 3
    const weaponKeys = Object.keys(WEAPONS);
    keys.on('keydown-ONE', () => this._switchWeapon(weaponKeys[0]));
    keys.on('keydown-TWO', () => this._switchWeapon(weaponKeys[1]));
    keys.on('keydown-THREE', () => this._switchWeapon(weaponKeys[2]));

    // Stats panel toggle
    keys.on('keydown-TAB', (event) => {
      event.preventDefault();
      this._setStatsPanelVisible(!this._statsOpen);
    });
  }

  _switchWeapon(wKey) {
    if (!wKey || wKey === this._activeWpn) return;
    this.setActiveWeapon(wKey);
    // Emit event so WorldScene (or others) can react
    this.game.events.emit('weapon-change', wKey);
    this.showNotification(`Arma: ${WEAPONS[wKey]?.name || wKey}`, '#ffd700');
  }

  // ========================================================================
  //  CROSS-SCENE EVENT LISTENERS
  // ========================================================================
  _bindEvents() {
    // Listen on the global game event bus for updates from WorldScene
    this.game.events.on('update-health', (cur, max) => this.updateHealth(cur, max));
    this.game.events.on('update-mana',   (cur, max) => this.updateMana(cur, max));
    this.game.events.on('update-xp',     (cur, max, level) => this.updateXP(cur, max, level));
    this.game.events.on('update-stats',   (stats) => this.updateStats(stats));
    this.game.events.on('update-gold',    (amount) => this.updateGold(amount));
    this.game.events.on('weapon-change',  (key) => this.setActiveWeapon(key));
    this.game.events.on('show-notification', (text, color) => this.showNotification(text, color));
    this.game.events.on('player-died',    () => this.showDeathBanner());
    this.game.events.on('player-respawned', () => {});
    this.game.events.on('update-affinity', (branch, counts) => this.updateAffinity(branch, counts));

    // Clean up on scene shutdown so we don't leak listeners
    this.events.on('shutdown', () => {
      this.game.events.off('update-health');
      this.game.events.off('update-mana');
      this.game.events.off('update-xp');
      this.game.events.off('update-stats');
      this.game.events.off('update-gold');
      this.game.events.off('weapon-change');
      this.game.events.off('show-notification');
      this.game.events.off('player-died');
      this.game.events.off('player-respawned');
    });
  }

  // ========================================================================
  //  UTILITY – draw a premium rounded panel
  // ========================================================================
  _drawRoundedPanel(graphics, x, y, w, h) {
    // Dark semi-transparent background
    graphics.fillStyle(DARK_BG, 0.85);
    graphics.fillRoundedRect(x, y, w, h, CORNER_R + 2);
    // Gold border
    graphics.lineStyle(1, GOLD, 0.45);
    graphics.strokeRoundedRect(x, y, w, h, CORNER_R + 2);
  }
}
