import Phaser from 'phaser';
import { SOLID_TILES, TILE_SIZE, SCENES } from '../utils/constants.js';

// Pre-build solid tile set once (shared across all enemies)
const SOLID_SET = new Set(SOLID_TILES);

const STATES = {
  IDLE: 'IDLE',
  PATROL: 'PATROL',
  CHASE: 'CHASE',
  ATTACK: 'ATTACK',
  HURT: 'HURT',
  DEAD: 'DEAD'
};

export default class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, typeConfig, level = 1) {
    const key = `enemy_${typeConfig.name.toLowerCase().replace(/\s+/g, '_')}`;
    super(scene, x, y, key);
    
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.typeConfig = typeConfig;
    this.level = level;
    this.maxHp = Math.round(typeConfig.hp * level);
    this.hp = this.maxHp;
    this.damage = Math.round(typeConfig.damage * level);
    this.xpReward = Math.round(typeConfig.xp * level);
    this.defense = Math.round((typeConfig.defense || 0) * level);
    this.speed = typeConfig.speed;
    this.baseSpeed = typeConfig.speed;
    this.frostTimer = 0;
    this.burnTimer = 0;
    this.burnDamageTimer = 0;
    this.aggroRange = typeConfig.aggroRange;
    this.patrolRange = typeConfig.patrolRange;

    this.body.setSize(this.typeConfig.size, this.typeConfig.size);
    this.setDepth(10);

    this.spawnPoint = { x, y };
    this.state = STATES.IDLE;
    this.stateTimer = 0;
    
    this.lastAttackTime = 0;
    this.lastAbilityTime = 0;

    // LOS throttle: don't ray-cast every single frame
    this._losTimer   = 0;
    this._losResult  = false; // cached result
    this._LOS_INTERVAL = 120; // ms between full ray checks

    // Health bar
    this.healthBarBg = scene.add.rectangle(x, y - 12, 16, 3, 0x000000).setDepth(11);
    this.healthBar = scene.add.rectangle(x - 8, y - 12, 16, 3, 0xff0000).setOrigin(0, 0.5).setDepth(11);
    this.healthBarBg.setVisible(false);
    this.healthBar.setVisible(false);
    
    // Name label showing level
    this.nameLabel = scene.add.text(x, y - 22, `${typeConfig.name} (Lv. ${this.level})`, {
      fontFamily: 'MedievalSharp, serif',
      fontSize: '7px',
      color: typeConfig.isBoss ? '#ffd700' : '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(11);
    
    // Tint based on config color if needed, or rely on generated sprite
    this.setTint(typeConfig.color);
  }

  _getEffectTint() {
    const now = this.scene.time.now;
    const isFr = now < this.frostTimer;
    const isBu = now < this.burnTimer;
    if (isFr && isBu) return 0x9b59b6; // purple
    if (isFr) return 0x3498db; // blue
    if (isBu) return 0xe67e22; // orange
    return this.typeConfig.color;
  }

  update(player) {
    if (this.state === STATES.DEAD) return;

    const time = this.scene.time.now;

    // Handle Frost & Burn states
    const isFrozen = time < this.frostTimer;
    const isBurning = time < this.burnTimer;

    // Apply Frost speed penalty
    this.speed = isFrozen ? this.baseSpeed * 0.5 : this.baseSpeed;

    // Apply Burn DOT
    if (isBurning) {
      if (time > this.burnDamageTimer) {
        this.takeDamage(2, null);
        this.burnDamageTimer = time + 500;
      }
      // Spawn tiny flame particles rising up
      if (Math.random() > 0.75) {
        const flame = this.scene.add.rectangle(
          this.x + Phaser.Math.Between(-6, 6),
          this.y + Phaser.Math.Between(-6, 6),
          2, 2, 0xe67e22, 0.8
        );
        this.scene.tweens.add({
          targets: flame,
          y: flame.y - 12,
          alpha: 0,
          duration: 450,
          onComplete: () => flame.destroy()
        });
      }
    }

    // Update tint based on active effects
    if (this.state !== STATES.HURT) {
      this.setTint(this._getEffectTint());
    }

    // Update health bar position
    this.healthBarBg.x = this.x;
    this.healthBarBg.y = this.y - 12;
    this.healthBar.x = this.x - 8;
    this.healthBar.y = this.y - 12;

    // Update name label position
    if (this.nameLabel && this.nameLabel.active) {
      this.nameLabel.x = this.x;
      this.nameLabel.y = this.y - 22;
    }

    const distToPlayer = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

    if (this.typeConfig.isBoss && time > this.lastAbilityTime + 6000 && this.state !== STATES.IDLE) {
      this.lastAbilityTime = time;
      // 50% chance to spawn slimes, 50% chance to jump attack
      if (Math.random() > 0.5) {
        // Spawn 2 Slimes
        this.scene.game.events.emit('show-notification', '¡El Rey invoca súbditos!', '#ff9900');
        for (let i = 0; i < 2; i++) {
          const spawnX = this.x + Phaser.Math.Between(-30, 30);
          const spawnY = this.y + Phaser.Math.Between(-30, 30);
          const slime = new this.constructor(this.scene, spawnX, spawnY, this.scene.ENEMIES ? this.scene.ENEMIES.SLIME : { name: 'Slime', hp: 20, damage: 3, speed: 40, xp: 10, color: 0x4caf50, size: 12, aggroRange: 80, patrolRange: 60 }, this.level);
          this.scene.enemiesGroup.add(slime);
        }
      } else {
        // Jump attack (high speed dash towards player)
        this.scene.game.events.emit('show-notification', '¡Ataque Terremoto!', '#ff4444');
        this.state = STATES.ATTACK;
        this.scene.physics.moveToObject(this, player, this.speed * 4);
        this.scene.tweens.add({
          targets: this,
          y: this.y - 30,
          yoyo: true,
          duration: 300
        });
      }
    }

    switch (this.state) {
      case STATES.IDLE:
        this.body.setVelocity(0);
        if (time > this.stateTimer) {
          this.state = STATES.PATROL;
          this.stateTimer = time + Phaser.Math.Between(1000, 3000);
          
          const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
          this.body.setVelocity(Math.cos(angle) * (this.speed * 0.5), Math.sin(angle) * (this.speed * 0.5));
        }
        if (distToPlayer < this.aggroRange && this._hasLineOfSight(player)) {
          this.state = STATES.CHASE;
        }
        break;

      case STATES.PATROL:
        if (time > this.stateTimer || Phaser.Math.Distance.Between(this.x, this.y, this.spawnPoint.x, this.spawnPoint.y) > this.patrolRange) {
          this.state = STATES.IDLE;
          this.stateTimer = time + Phaser.Math.Between(1000, 2000);
        }
        if (distToPlayer < this.aggroRange && this._hasLineOfSight(player)) {
          this.state = STATES.CHASE;
        }
        break;

      case STATES.CHASE:
        // If player ran out of aggro range OR a wall now blocks sight, return to idle
        if (distToPlayer > this.aggroRange * 1.5 || !this._hasLineOfSight(player)) {
          this.state = STATES.IDLE;
        } else {
          // Custom aggro/attack ranges for ranged/mage satire
          let attackRange = 20;
          if (this.typeConfig.name === 'Goblin Arquero') attackRange = 100;
          if (this.typeConfig.name === 'Goblin Mago') attackRange = 90;

          if (distToPlayer < attackRange) {
            this.state = STATES.ATTACK;
          } else {
            this.scene.physics.moveToObject(this, player, this.speed);
          }
        }
        break;

      case STATES.ATTACK:
        this.body.setVelocity(0);
        
        let escapeRange = 24;
        if (this.typeConfig.name === 'Goblin Arquero') escapeRange = 130;
        if (this.typeConfig.name === 'Goblin Mago') escapeRange = 120;

        if (distToPlayer > escapeRange) {
          this.state = STATES.CHASE;
          this.clearTint(); // clear warning tint if mage
        } else {
          // Custom attack logic per class
          if (this.typeConfig.name === 'Goblin Arquero') {
            const cd = Math.round(1500 / (1 + (this.level - 1) * 0.15));
            if (time > this.lastAttackTime + cd) {
              this.lastAttackTime = time;
              
              // Shoot arrow at player
              const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
              const arrow = this.scene.physics.add.sprite(this.x, this.y, 'arrow');
              arrow.setRotation(angle);
              arrow.setDepth(12);
              this.scene.physics.moveToObject(arrow, player, 180);
              
              this.scene.physics.add.collider(arrow, this.scene.mapLayer, () => arrow.destroy());
              this.scene.physics.add.overlap(arrow, player, () => {
                player.takeDamage(this.damage, this);
                arrow.destroy();
              });
              this.scene.time.delayedCall(1500, () => { if (arrow.active) arrow.destroy(); });

              // visual tiny scale bump
              this.scene.tweens.add({ targets: this, scale: 1.1, duration: 100, yoyo: true });
            }
          } 
          else if (this.typeConfig.name === 'Goblin Mago') {
            const castProgress = time - this.lastAttackTime;
            const castTime = Math.round(2500 / (1 + (this.level - 1) * 0.15));
            const warningStart = Math.max(0, castTime - 800);
            
            // Warning flash before casting (final 800ms of cast time)
            if (castProgress >= warningStart && castProgress < castTime) {
              if (Math.floor(time / 100) % 2 === 0) {
                this.setTint(0xa855f7); // Flash purple
              } else {
                this.setTint(0xffffff);
              }
            } else {
              this.setTint(this._getEffectTint());
            }

            if (time > this.lastAttackTime + castTime) {
              this.lastAttackTime = time;
              this.clearTint();

              // Cast magic orb
              const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
              const orb = this.scene.physics.add.sprite(this.x, this.y, 'magic_orb');
              orb.setDepth(12);
              this.scene.physics.moveToObject(orb, player, 110);
              
              this.scene.physics.add.collider(orb, this.scene.mapLayer, () => orb.destroy());
              this.scene.physics.add.overlap(orb, player, () => {
                player.takeDamage(this.damage, this);
                orb.destroy();
              });
              this.scene.time.delayedCall(2000, () => { if (orb.active) orb.destroy(); });

              this.scene.tweens.add({ targets: this, scale: 1.25, duration: 150, yoyo: true });
            }
          } 
          else {
            // Melee attack behavior
            const baseCd = this.typeConfig.isBoss ? 1000 : 1200;
            const cd = Math.round(baseCd / (1 + (this.level - 1) * 0.15));
            if (time > this.lastAttackTime + cd) {
              this.lastAttackTime = time;
              player.takeDamage(this.damage, this);
              
              this.scene.tweens.add({
                targets: this,
                scale: 1.2,
                duration: 100,
                yoyo: true
              });
            }
          }
        }
        break;

      case STATES.HURT:
        if (time > this.stateTimer) {
          this.state = STATES.CHASE;
        }
        break;
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // LINE-OF-SIGHT  (Bresenham tile ray-cast through mapData)
  // Returns true if no solid tile blocks the path from enemy to player.
  // Throttled to _LOS_INTERVAL ms to keep performance light.
  // ──────────────────────────────────────────────────────────────────────
  _hasLineOfSight(player) {
    const now = this.scene.time.now;
    if (now - this._losTimer < this._LOS_INTERVAL) return this._losResult;
    this._losTimer = now;

    const mapData = this.scene._mapData;
    if (!mapData) { this._losResult = true; return true; } // no map yet

    // Convert world coords → tile coords
    const x0 = Math.floor(this.x / TILE_SIZE);
    const y0 = Math.floor(this.y / TILE_SIZE);
    const x1 = Math.floor(player.x / TILE_SIZE);
    const y1 = Math.floor(player.y / TILE_SIZE);

    // Bresenham's line algorithm
    let dx =  Math.abs(x1 - x0);
    let dy = -Math.abs(y1 - y0);
    let sx = x0 < x1 ? 1 : -1;
    let sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;

    let cx = x0;
    let cy = y0;

    const rows = mapData.length;
    const cols = mapData[0]?.length ?? 0;

    while (true) {
      // Skip the enemy's own tile and the player's tile
      if ((cx !== x0 || cy !== y0) && (cx !== x1 || cy !== y1)) {
        if (cx < 0 || cy < 0 || cy >= rows || cx >= cols) {
          this._losResult = false; return false; // out of bounds = blocked
        }
        if (SOLID_SET.has(mapData[cy][cx])) {
          this._losResult = false; return false; // wall tile → blocked
        }
      }
      if (cx === x1 && cy === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; cx += sx; }
      if (e2 <= dx) { err += dx; cy += sy; }
    }

    this._losResult = true;
    return true;
  }

  takeDamage(amount, knockbackDir, attackType) {
    if (this.state === STATES.DEAD) return;

    // Rey Goblin restriction: Level 1 heroes cannot damage him
    if (this.typeConfig.isBoss) {
      const player = this.scene.player;
      if (player && player.level < 2) {
        const uiScene = this.scene.scene.get(SCENES.UI);
        if (uiScene?.showNotification) {
          uiScene.showNotification('¡El Rey Goblin es inmune a héroes de Nivel 1! Entrena y sube al Nivel 2.', '#ff4444');
        }
        this.scene.cameras.main.shake(100, 0.005);
        return;
      }
    }

    // Apply class satire weaknesses
    if (this.typeConfig.name === 'Goblin') {
      // Melee goblin: weak to bow and magic (takes 1.5x damage)
      if (attackType === 'bow' || attackType === 'magic') {
        amount = Math.ceil(amount * 1.5);
      }
    } else if (this.typeConfig.name === 'Goblin Arquero') {
      // Archer goblin: weak to anything (takes 1.5x damage from all attacks)
      amount = Math.ceil(amount * 1.5);
    } else if (this.typeConfig.name === 'Goblin Mago') {
      // Mage goblin: weak to anything (takes 3.0x damage from all attacks)
      amount = Math.ceil(amount * 3.0);
    }

    // Apply defense (minimum of 1 damage taken)
    amount = Math.max(1, amount - this.defense);

    this.hp -= amount;
    
    // Show health bar
    this.healthBarBg.setVisible(true);
    this.healthBar.setVisible(true);
    this.healthBar.width = (this.hp / this.maxHp) * 16;

    if (this.hp <= 0) {
      this.die();
      return;
    }

    this.state = STATES.HURT;
    this.stateTimer = this.scene.time.now + 300;
    
    // Knockback
    if (knockbackDir) {
      this.body.setVelocity(knockbackDir.x * 150, knockbackDir.y * 150);
    } else {
      this.body.setVelocity(0);
    }

    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(100, () => {
      this.clearTint();
      this.setTint(this._getEffectTint());
    });
  }

  die() {
    this.state = STATES.DEAD;
    this.body.checkCollision.none = true;
    this.body.setVelocity(0);
    this.healthBarBg.destroy();
    this.healthBar.destroy();
    if (this.nameLabel) this.nameLabel.destroy();

    this.scene.tweens.add({
      targets: this,
      scaleX: 0.1,
      scaleY: 0.1,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        // Drop XP particle
        const xpParticle = this.scene.add.sprite(this.x, this.y, 'particle_gold').setScale(1.5);
        this.scene.tweens.add({
          targets: xpParticle,
          y: this.y - 10,
          duration: 300,
          yoyo: true,
          repeat: 2,
          onComplete: () => {
             xpParticle.destroy();
          }
        });
        
        // Notify scene
        this.scene.events.emit('enemy-died', this);
        this.destroy();
      }
    });
  }

  destroy(fromScene) {
    if (this.healthBarBg && this.healthBarBg.active) this.healthBarBg.destroy();
    if (this.healthBar && this.healthBar.active) this.healthBar.destroy();
    if (this.nameLabel && this.nameLabel.active) this.nameLabel.destroy();
    super.destroy(fromScene);
  }
}
