// ============================================================================
// MenuScene.js - Title Screen for Gains & Goblins
// ============================================================================
// Atmospheric dark-fantasy title screen with animated particles, floating
// weapon icons, pulsing call-to-action, and screen transition on start.
// ============================================================================

import { SCENES } from '../utils/constants.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.MENU });
  }

  // --------------------------------------------------------------------------
  //  CREATE
  // --------------------------------------------------------------------------
  create() {
    const { width, height } = this.cameras.main;

    // ---- 1. Dark fantasy background with stars ----
    this._createBackground(width, height);

    // ---- 2. Floating golden particles (fireflies) ----
    this._createParticles(width, height);

    // ---- 3. Title text ----
    this.titleText = this.add.text(width / 2, height * 0.22, 'GAINS & GOBLINS', {
      fontFamily: 'MedievalSharp, serif',
      fontSize: '52px',
      color: '#ffd700',
      stroke: '#1a1a2e',
      strokeThickness: 8,
      shadow: {
        offsetX: 3,
        offsetY: 3,
        color: '#000000',
        blur: 10,
        fill: true,
      },
    }).setOrigin(0.5).setAlpha(0);

    // Title shimmer / glow tween
    this.tweens.add({
      targets: this.titleText,
      alpha: 1,
      y: height * 0.20,
      duration: 1200,
      ease: 'Power2',
    });

    // Gentle float
    this.tweens.add({
      targets: this.titleText,
      y: height * 0.20 - 4,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: 1200,
    });

    // ---- 4. Subtitle ----
    this.subtitleText = this.add.text(
      width / 2,
      height * 0.30,
      'Tu progreso real impulsa tu personaje',
      {
        fontFamily: 'MedievalSharp, serif',
        fontSize: '18px',
        color: '#c4a35a',
        stroke: '#000000',
        strokeThickness: 3,
      }
    ).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: this.subtitleText,
      alpha: 0.9,
      duration: 1500,
      delay: 600,
      ease: 'Power2',
    });

    // ---- 5. Floating weapon icons ----
    this._createWeaponShowcase(width, height);

    // ---- 6. Call to action ----
    this.ctaText = this.add.text(
      width / 2,
      height * 0.82,
      'Presiona ENTER o haz clic para comenzar',
      {
        fontFamily: 'MedievalSharp, serif',
        fontSize: '20px',
        color: '#ffd700',
        stroke: '#000000',
        strokeThickness: 4,
      }
    ).setOrigin(0.5).setAlpha(0);

    // Fade in then pulse
    this.tweens.add({
      targets: this.ctaText,
      alpha: 1,
      duration: 1000,
      delay: 1200,
      ease: 'Power2',
      onComplete: () => {
        this.tweens.add({
          targets: this.ctaText,
          alpha: 0.3,
          duration: 900,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      },
    });

    // ---- 7. Version tag ----
    this.add.text(width - 8, height - 8, 'v0.1.0', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '11px',
      color: '#555566',
    }).setOrigin(1, 1);

    // ---- 8. Input listeners ----
    this._started = false;

    this.input.keyboard.on('keydown-ENTER', () => this._startGame());
    this.input.keyboard.on('keydown-SPACE', () => this._startGame());
    this.input.on('pointerdown', () => this._startGame());
  }

  // ==========================================================================
  //  BACKGROUND – gradient + stars
  // ==========================================================================
  _createBackground(w, h) {
    const bg = this.add.graphics();

    // Vertical gradient: dark navy → black
    const steps = 32;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      // Interpolate #1a1a2e → #060610
      const r = Math.round(0x1a + (0x06 - 0x1a) * t);
      const g = Math.round(0x1a + (0x06 - 0x1a) * t);
      const b = Math.round(0x2e + (0x10 - 0x2e) * t);
      const color = (r << 16) | (g << 8) | b;
      bg.fillStyle(color, 1);
      bg.fillRect(0, Math.floor((i / steps) * h), w, Math.ceil(h / steps) + 1);
    }

    // Stars
    for (let i = 0; i < 90; i++) {
      const sx = Phaser.Math.Between(0, w);
      const sy = Phaser.Math.Between(0, h * 0.7);
      const size = Phaser.Math.Between(1, 2);
      const alpha = Phaser.Math.FloatBetween(0.2, 0.7);
      bg.fillStyle(0xffffff, alpha);
      bg.fillRect(sx, sy, size, size);
    }

    // A few brighter stars with twinkle
    for (let i = 0; i < 12; i++) {
      const star = this.add.graphics();
      const sx = Phaser.Math.Between(20, w - 20);
      const sy = Phaser.Math.Between(10, h * 0.55);
      star.fillStyle(0xffd700, 0.6);
      star.fillRect(sx, sy, 2, 2);
      this.tweens.add({
        targets: star,
        alpha: 0.15,
        duration: Phaser.Math.Between(1500, 3000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Phaser.Math.Between(0, 2000),
      });
    }

    // Subtle ground gradient at the very bottom
    const groundGrad = this.add.graphics();
    for (let i = 0; i < 8; i++) {
      const t = i / 8;
      const r = Math.round(0x0f * t);
      const g = Math.round(0x34 * t * 0.3);
      const b = Math.round(0x10 * t);
      groundGrad.fillStyle((r << 16) | (g << 8) | b, 0.3);
      groundGrad.fillRect(0, h - 60 + i * 8, w, 8);
    }
  }

  // ==========================================================================
  //  GOLDEN PARTICLES (fireflies)
  // ==========================================================================
  _createParticles(w, h) {
    // Only create emitter if particle_gold texture exists
    if (!this.textures.exists('particle_gold')) {
      // Fallback: create a tiny gold square
      const c = this.textures.createCanvas('particle_gold', 4, 4);
      const cx = c.getContext();
      cx.fillStyle = '#ffd700';
      cx.fillRect(0, 0, 4, 4);
      c.refresh();
    }

    // Phaser 3.60+ particle emitter API
    const emitter = this.add.particles(0, 0, 'particle_gold', {
      x: { min: 0, max: w },
      y: { min: 0, max: h },
      lifespan: { min: 3000, max: 6000 },
      speed: { min: 5, max: 20 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.6, end: 0 },
      frequency: 300,
      blendMode: 'ADD',
      quantity: 1,
    });

    // A secondary slow emitter for bigger, rarer sparkles
    const sparkle = this.add.particles(0, 0, 'particle_gold', {
      x: { min: 40, max: w - 40 },
      y: { min: h * 0.15, max: h * 0.6 },
      lifespan: 4000,
      speed: { min: 2, max: 8 },
      scale: { start: 1.2, end: 0.2 },
      alpha: { start: 0.8, end: 0 },
      frequency: 900,
      blendMode: 'ADD',
      quantity: 1,
    });
  }

  // ==========================================================================
  //  WEAPON SHOWCASE – three icons floating / rotating
  // ==========================================================================
  _createWeaponShowcase(w, h) {
    const icons = [
      { key: 'icon_sword', x: w * 0.25 },
      { key: 'icon_bow',   x: w * 0.50 },
      { key: 'icon_magic', x: w * 0.75 },
    ];

    const baseY = h * 0.55;

    icons.forEach((cfg, i) => {
      // Only add if texture exists (BootScene should have created them)
      if (!this.textures.exists(cfg.key)) return;

      const icon = this.add.image(cfg.x, baseY, cfg.key)
        .setScale(2.5)
        .setAlpha(0);

      // Fade-in staggered
      this.tweens.add({
        targets: icon,
        alpha: 0.9,
        duration: 800,
        delay: 800 + i * 250,
        ease: 'Power2',
      });

      // Gentle float (each offset slightly)
      this.tweens.add({
        targets: icon,
        y: baseY - 8,
        duration: 2200 + i * 300,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: 1600 + i * 250,
      });

      // Slow scale pulse
      this.tweens.add({
        targets: icon,
        scaleX: 2.7,
        scaleY: 2.7,
        duration: 2800 + i * 200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: 1600 + i * 350,
      });

      // Label beneath
      const labels = ['Espada', 'Arco', 'Magia'];
      this.add.text(cfg.x, baseY + 44, labels[i], {
        fontFamily: 'MedievalSharp, serif',
        fontSize: '15px',
        color: '#c4a35a',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5).setAlpha(0.75);
    });
  }

  // ==========================================================================
  //  TRANSITION → WORLD
  // ==========================================================================
  _startGame() {
    if (this._started) return;
    this._started = true;

    // Flash + fade-out transition
    this.cameras.main.flash(200, 255, 215, 0, false); // gold flash

    // Fade to black
    this.cameras.main.fadeOut(600, 0, 0, 0);

    this.cameras.main.once('camerafadeoutcomplete', () => {
      // Start the World scene (it will launch UI itself)
      this.scene.start(SCENES.WORLD);
    });
  }
}
