import Phaser from 'phaser';
import { PLAYER_SPEED, PLAYER_ATTACK_COOLDOWN, WEAPONS, BASE_STATS, TILE_SIZE, BRANCHES } from '../utils/constants.js';
import SaveSystem from '../utils/SaveSystem.js';

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'player', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Physics body
    this.body.setSize(10, 14);
    this.body.setOffset(3, 10);
    this.setDepth(10);

    // Stats
    this.stats = JSON.parse(JSON.stringify(BASE_STATS));
    this.level = 1;
    this.maxHp = this.stats.resistance * 10;
    this.hp = this.maxHp;
    this.maxMana = this.stats.maxMana;
    this.mana = this.maxMana;
    this.xp = 0;
    this.gold = 0;
    
    // Initial inventory with classified items
    this.inventory = [
      { id: 'potion_hp', name: 'Agua Mineral', count: 3, icon: '🥤', type: 'consumable' },
      { id: 'potion_mp', name: 'Café Cargado', count: 3, icon: '☕', type: 'consumable' },
      { id: 'acc_strength_ring', name: 'Anillo de Fuerza', count: 1, icon: '💍', type: 'accessory', effect: { strength: 2, resistance: 1 } },
      { id: 'acc_intellect_amulet', name: 'Amuleto de Intelecto', count: 1, icon: '📿', type: 'accessory', effect: { intelligence: 2, willpower: 1 } },
      { id: 'acc_dexterity_cloak', name: 'Capa de Destreza', count: 1, icon: '🧥', type: 'accessory', effect: { dexterity: 2, speed: 1 } },
      { id: 'quest_goblin_tooth', name: 'Diente de Goblin', count: 0, icon: '🦷', type: 'quest' },
      { id: 'quest_slime_jelly', name: 'Gelatina de Slime', count: 0, icon: '🟢', type: 'quest' }
    ];
    this.equippedAccessories = [];
    this.spells = ['shield', 'ghost_swords', 'heal'];
    this.equippedSpells = ['shield', 'ghost_swords'];
    this.activeSpellIndex = 0;

    // Daily activity tracking
    this.activitiesToday = {};

    // Death tracking
    this.lastDeathTime = 0;
    this.consecutiveDeaths = 0;

    // Moral alignment: -100 (evil) ↔ +100 (heroic)
    this.moral = 0;
    this.debuffTimer = 0;
    this.isRolling = false;
    this.lastDodgeTime = 0;

    // Branch points (unspent) — Fable-style (vitality tracks energy for study/meditation)
    this.branchPoints = { strength: 0, dexterity: 0, intelligence: 0, willpower: 0, vitality: 100 };

    // ── AFINIDAD ORGÁNICA ──
    // Registro mensual de actividades por rama
    // Estructura: { month: 'YYYY-MM', counts: { strength:0, dexterity:0, intelligence:0, willpower:0 } }
    this.affinityData = {
      month: this._currentMonth(),
      counts: { strength: 0, dexterity: 0, intelligence: 0, willpower: 0 }
    };
    // La rama dominante del mes: 'strength'|'dexterity'|'intelligence'|'willpower'|null
    this.dominantBranch = null;

    // Combat state
    this.currentWeaponKey = WEAPONS.SWORD.key;
    this.lastAttackTime = 0;
    this.facing = 'down';
    this.isDead = false;
    this.comboStep = 0;
    this.shieldActivatedAt = 0;
    this.isUltimateActive = false;
    this.ultimateActivatedAt = 0;

    // Shadow
    this.shadow = scene.add.ellipse(x, y + 10, 12, 6, 0x000000, 0.4);
    this.shadow.setDepth(9);

    // Mana regeneration: +1 mana every 2 seconds
    // (willpower stat reduces the delay: base 2000ms - willpower*80ms, min 500ms)
    this._startManaRegen();
  }

  get vitality() {
    const rawVal = this.branchPoints.vitality ?? 100;
    if (this.inRecovery) {
      return Math.min(100, rawVal);
    }
    return rawVal;
  }

  set vitality(value) {
    const limit = this.inRecovery ? 100 : 300;
    this.branchPoints.vitality = Math.max(0, Math.min(limit, value));
  }

  _startManaRegen() {
    if (this._manaRegenTimer) this._manaRegenTimer.remove();
    const delay = Math.max(500, 2000 - (this.stats.willpower - 5) * 80);
    this._manaRegenTimer = this.scene.time.addEvent({
      delay,
      callback: () => {
        if (this.isDead) return;
        if (this.mana < this.maxMana) {
          this.mana = Math.min(this.mana + 1, this.maxMana);
          this.scene.game.events.emit('update-mana', this.mana, this.maxMana);
        }
      },
      loop: true
    });
  }

  static createAnimations(scene) {
    scene.anims.create({
      key: 'player-walk-down',
      frames: scene.anims.generateFrameNumbers('player', { start: 0, end: 2 }),
      frameRate: 8,
      repeat: -1
    });
    scene.anims.create({
      key: 'player-walk-left',
      frames: scene.anims.generateFrameNumbers('player', { start: 3, end: 5 }),
      frameRate: 8,
      repeat: -1
    });
    scene.anims.create({
      key: 'player-walk-right',
      frames: scene.anims.generateFrameNumbers('player', { start: 6, end: 8 }),
      frameRate: 8,
      repeat: -1
    });
    scene.anims.create({
      key: 'player-walk-up',
      frames: scene.anims.generateFrameNumbers('player', { start: 9, end: 11 }),
      frameRate: 8,
      repeat: -1
    });
  }

  update(cursors) {
    if (this.isDead) return;

    if (this.isRolling) {
      // Create trailing dust effect while rolling
      if (Math.random() > 0.5) {
        const dust = this.scene.add.rectangle(this.x, this.y + 8, 4, 4, 0xaaaaaa, 0.5);
        this.scene.tweens.add({ targets: dust, y: dust.y - 10, alpha: 0, duration: 300, onComplete: () => dust.destroy() });
      }
      // Sync shadow and shield visual positions during roll
      if (this.shadow) {
        this.shadow.x = this.x;
        this.shadow.y = this.y + 10;
      }
      if (this.shieldBubble) {
        this.shieldBubble.x = this.x;
        this.shieldBubble.y = this.y;
      }
      return; // Skip normal movement while rolling
    }

    this.body.setVelocity(0);

    // Check for charge input
    if (cursors.SPACE && cursors.SPACE.isDown) {
      if (!this.isCharging) {
        this.beginCharge();
      } else {
        this.updateCharge();
      }
    } else if (this.isCharging) {
      this.releaseCharge();
    }

    // Apply speed penalty if charging bow
    let currentSpeed = PLAYER_SPEED + (this.stats.speed - 5) * 4;
    if (this.isCharging && this.currentWeaponKey === WEAPONS.BOW.key) {
      const chargeDur = this.scene.time.now - this.chargeStartTime;
      if (chargeDur > 300) currentSpeed = (PLAYER_SPEED + (this.stats.speed - 5) * 4) * 0.5; // 50% slow down
    }

    // Apply speed debuff if underleveled (Hero Lv. 1 vs Monster Lv. 2+)
    if (this.debuffTimer && this.scene.time.now < this.debuffTimer) {
      currentSpeed *= 0.7; // 30% slow
    }

    if (cursors.left.isDown || cursors.A.isDown) {
      this.body.setVelocityX(-currentSpeed);
      this.facing = 'left';
    } else if (cursors.right.isDown || cursors.D.isDown) {
      this.body.setVelocityX(currentSpeed);
      this.facing = 'right';
    }

    if (cursors.up.isDown || cursors.W.isDown) {
      this.body.setVelocityY(-currentSpeed);
      this.facing = 'up';
    } else if (cursors.down.isDown || cursors.S.isDown) {
      this.body.setVelocityY(currentSpeed);
      this.facing = 'down';
    }

    // Normalize diagonal movement
    this.body.velocity.normalize().scale(currentSpeed);

    // Animations
    if (this.body.velocity.length() > 0) {
      this.anims.play(`player-walk-${this.facing}`, true);
    } else {
      this.anims.stop();
      switch (this.facing) {
        case 'down': this.setFrame(0); break;
        case 'left': this.setFrame(3); break;
        case 'right': this.setFrame(6); break;
        case 'up': this.setFrame(9); break;
      }
    }

    // Update shadow position
    this.shadow.x = this.x;
    this.shadow.y = this.y + 10;

    // Update Shield visual position if active
    if (this.shieldBubble) {
      this.shieldBubble.x = this.x;
      this.shieldBubble.y = this.y;
    }
  }

  dodgeRoll() {
    if (this.isDead || this.isRolling) return;
    const time = this.scene.time.now;

    // 1 second cooldown
    if (this.lastDodgeTime && time < this.lastDodgeTime + 1000) return;
    this.lastDodgeTime = time;

    this.isRolling = true;
    this.isInvulnerable = true;

    // Determine direction
    let dirX = 0;
    let dirY = 0;

    const cursors = this.scene.cursors;
    if (cursors) {
      if (cursors.left.isDown || cursors.A.isDown) dirX = -1;
      else if (cursors.right.isDown || cursors.D.isDown) dirX = 1;

      if (cursors.up.isDown || cursors.W.isDown) dirY = -1;
      else if (cursors.down.isDown || cursors.S.isDown) dirY = 1;
    }

    // Default to currently facing direction if no movement keys pressed
    if (dirX === 0 && dirY === 0) {
      if (this.facing === 'left') dirX = -1;
      else if (this.facing === 'right') dirX = 1;
      else if (this.facing === 'up') dirY = -1;
      else if (this.facing === 'down') dirY = 1;
    }

    // Normalize diagonal vectors
    if (dirX !== 0 && dirY !== 0) {
      const len = Math.sqrt(dirX * dirX + dirY * dirY);
      dirX /= len;
      dirY /= len;
    }

    // Apply high roll velocity
    const rollSpeed = 260;
    this.body.setVelocity(dirX * rollSpeed, dirY * rollSpeed);

    // Roll animation: 360 degree spin in movement direction
    const rotationAngle = dirX < 0 ? -360 : 360;

    const uiScene = this.scene.scene.get('UI');
    if (uiScene?.showNotification) {
      uiScene.showNotification('⚡ ¡Voltereta!', '#3498db');
    }

    this.scene.tweens.add({
      targets: this,
      angle: rotationAngle,
      duration: 350,
      onComplete: () => {
        if (!this.isDead) {
          this.isRolling = false;
          this.isInvulnerable = false;
          this.setAngle(0);
          this.body.setVelocity(0);
        }
      }
    });
  }

  switchWeapon(weaponKey) {
    if (this.isDead) return;
    if (this.currentWeaponKey === weaponKey) return;
    this.currentWeaponKey = weaponKey;
    this.scene.game.events.emit('weapon-change', weaponKey);
  }

  /**
   * Damage = base + stat bonus + 15% affinity bonus if using the dominant branch's weapon.
   */
  _getScaledDamage(weaponObj) {
    const statKey = weaponObj.statBranch;
    const statValue = this.stats[statKey] || 5;
    const bonus = Math.max(0, (statValue - 5) * 2);
    let damage = weaponObj.damage + bonus;

    // Affinity bonus: +15% if this weapon matches the dominant branch
    if (this.dominantBranch && statKey === this.dominantBranch) {
      damage = Math.ceil(damage * 1.15);
    }

    // Rusted (inRecovery) penalty: -20% attack damage
    if (this.inRecovery) {
      damage = Math.floor(damage * 0.8);
    }
    return damage;
  }

  /**
   * Returns current month string like '2026-06'
   */
  _currentMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Called every time an activity is logged to update the monthly affinity counter.
   * statBranchKey: 'strength'|'dexterity'|'intelligence'|'willpower' (or others, ignored)
   */
  trackAffinityActivity(statBranchKey) {
    // Only track the 4 combat branches
    const tracked = ['strength', 'dexterity', 'intelligence', 'willpower'];
    if (!tracked.includes(statBranchKey)) return;

    const month = this._currentMonth();

    // Reset if month changed
    if (this.affinityData.month !== month) {
      this.affinityData = {
        month,
        counts: { strength: 0, dexterity: 0, intelligence: 0, willpower: 0 }
      };
      this.dominantBranch = null;
    }

    // Increment count
    this.affinityData.counts[statBranchKey] = (this.affinityData.counts[statBranchKey] || 0) + 1;

    // Recalculate dominant branch (must have at least 2 activities, and clear leader)
    const counts = this.affinityData.counts;
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const [topBranch, topCount] = sorted[0];
    const [, secondCount] = sorted[1] || [null, 0];

    if (topCount >= 2 && topCount > secondCount) {
      this.dominantBranch = topBranch;
    } else {
      this.dominantBranch = null; // Tie or not enough data
    }

    // Emit event so UI can display current affinity
    this.scene.game.events.emit('update-affinity', this.dominantBranch, { ...counts });
  }

  getAttackCooldown() {
    let cooldownValue = PLAYER_ATTACK_COOLDOWN;
    if (this.currentWeaponKey === WEAPONS.SWORD.key) {
      // Base sword cooldown is longer (lower attack speed), e.g. 800ms.
      // Every point of the 'speed' stat (starts at 5) reduces the cooldown by 40ms.
      const baseCooldown = 800;
      const speedBonus = (this.stats.speed - 5) * 40;
      cooldownValue = Math.max(250, baseCooldown - speedBonus);
    }
    // Halve all attack cooldowns during Ultimate!
    if (this.isUltimateActive) {
      cooldownValue = Math.max(120, Math.floor(cooldownValue * 0.5));
    }
    return cooldownValue;
  }

  beginCharge() {
    if (this.isDead) return;
    const time = this.scene.time.now;
    if (time < this.lastAttackTime + this.getAttackCooldown()) return;

    this.isCharging = true;
    this.chargeStartTime = time;

    // Optional charge particles here
  }

  updateCharge() {
    const chargeDur = this.scene.time.now - this.chargeStartTime;
    // Tint character to show charging
    if (chargeDur > 800 && this.currentWeaponKey === WEAPONS.SWORD.key) this.setTint(0xffd700);
    
    if (this.currentWeaponKey === WEAPONS.BOW.key) {
      const speedVal = this.stats.speed || 5;
      const chargeTarget = Math.max(400, 1000 - (speedVal - 5) * 50);

      if (chargeDur >= chargeTarget * 0.8 && chargeDur <= chargeTarget * 1.2) {
        this.setTint(0x2ecc71); // Green (Perfect Tension!)
      } else if (chargeDur > chargeTarget * 1.2 && chargeDur <= chargeTarget * 1.5) {
        this.setTint(0xff8c00); // Orange
      } else if (chargeDur > chargeTarget * 1.5) {
        this.setTint(0xff0000); // Red (Unstable!)
        // Shake player sprite visually
        this.x += Math.sin(this.scene.time.now * 0.3) * 0.7;
      }
    }
    
    if (chargeDur > 1000 && this.currentWeaponKey === WEAPONS.MAGIC.key) this.setTint(0xa855f7);
  }

  releaseCharge() {
    this.isCharging = false;
    this.clearTint();
    
    if (this.isDead) return;

    const time = this.scene.time.now;
    const cooldown = this.getAttackCooldown();
    if (time < this.lastAttackTime + cooldown) return;

    const chargeTime = time - this.chargeStartTime;

    let weaponObj = Object.values(WEAPONS).find(w => w.key === this.currentWeaponKey);
    if (!weaponObj) return;

    // Check mana cost if magic
    if (this.currentWeaponKey === WEAPONS.MAGIC.key) {
      const isAoE = chargeTime > 1000;
      let cost = isAoE ? weaponObj.manaCost * 2.5 : weaponObj.manaCost; // AoE costs more
      if (this.isUltimateActive) {
        cost = 0; // Mana cost reduced to 0 during ultimate
      }
      if (this.inRecovery) {
        cost = Math.ceil(cost * 1.2); // +20% mana cost if Rusted/inRecovery
      }
      if (this.mana < cost) {
        this.scene.game.events.emit('show-notification', 'Sin maná suficiente', '#e94560');
        return;
      }
      if (cost > 0) {
        this.mana -= cost;
        this.scene.game.events.emit('update-mana', this.mana, this.maxMana);
      }
    }

    // Sword combo step tracking
    if (this.currentWeaponKey === WEAPONS.SWORD.key && chargeTime < 500) {
      const timeSinceLast = time - this.lastAttackTime;
      // If pressing space within combo window (scales with Resistance)
      const resVal = this.stats.resistance || 5;
      const comboWindow = 600 + (resVal - 5) * 40;
      if (timeSinceLast >= cooldown && timeSinceLast <= cooldown + comboWindow) {
        this.comboStep = (this.comboStep + 1) % 3;
      } else {
        this.comboStep = 0;
      }
    } else {
      this.comboStep = 0;
    }

    this.lastAttackTime = time;

    let ox = 0, oy = 0;
    if (this.facing === 'left') ox = -1;
    if (this.facing === 'right') ox = 1;
    if (this.facing === 'up') oy = -1;
    if (this.facing === 'down') oy = 1;

    // Small bump effect
    this.scene.tweens.add({
      targets: this,
      x: this.x + ox * 4,
      y: this.y + oy * 4,
      duration: 50,
      yoyo: true
    });

    const scaledDamage = this._getScaledDamage(weaponObj);
    const attackData = {
      weapon: { ...weaponObj, damage: scaledDamage },
      dir: { x: ox, y: oy },
      origin: { x: this.x, y: this.y },
      chargeTime,
      comboStep: this.comboStep
    };

    this.scene.events.emit('player-attack', attackData);
  }

  castSpell(spellKey) {
    if (this.isDead || this.currentWeaponKey !== WEAPONS.MAGIC.key) return;
    
    this.scene.events.emit('player-spell', { spell: spellKey, origin: { x: this.x, y: this.y } });
  }

  takeDamage(amount, attacker = null) {
    if (this.isInvulnerable || this.isDead) return;

    // Check for underleveled debuff (Hero level 1 vs Monster level 2+)
    if (attacker && attacker.level && attacker.level >= 2 && this.level === 1) {
      this.debuffTimer = this.scene.time.now + 3000;
      const uiScene = this.scene.scene.get('UI');
      if (uiScene?.showNotification) {
        uiScene.showNotification('¡Intimidado! (-30% Velocidad por diferencia de nivel)', '#a855f7');
      }

      // Flash purple tint to indicate debuff after the red invulnerablity/hurt flash
      this.scene.time.delayedCall(400, () => {
        if (!this.isDead) {
          this.setTint(0xa855f7); // Purple tint
          this.scene.time.delayedCall(2600, () => {
            if (!this.isDead && this.scene.time.now >= this.debuffTimer) {
              this.clearTint();
            }
          });
        }
      });
    }

    // Perfect Parry Check: activated shield < 500ms ago
    if (this.hasPhysicalShield && this.shieldActivatedAt) {
      const elapsed = this.scene.time.now - this.shieldActivatedAt;
      if (elapsed < 500) {
        this.scene.events.emit('player-parry', { origin: { x: this.x, y: this.y }, amount });
        return; // Zero damage, triggers counters
      }
    }

    // Escudo Físico (Physical Shield) intercepts damage with mana
    if (this.hasPhysicalShield) {
      // 1 mana = 2 HP of damage absorbed
      const manaNeeded = Math.ceil(amount / 2);
      if (this.mana >= manaNeeded) {
        this.mana -= manaNeeded;
        this.scene.game.events.emit('update-mana', this.mana, this.maxMana);
        // Shield flash
        if (this.shieldBubble) {
          this.scene.tweens.add({ targets: this.shieldBubble, alpha: 0.5, duration: 100, yoyo: true });
        }
        return; // No HP lost
      } else {
        // Shield breaks
        amount -= (this.mana * 2);
        this.mana = 0;
        this.hasPhysicalShield = false;
        if (this.shieldBubble) {
          this.shieldBubble.destroy();
          this.shieldBubble = null;
        }
        this.scene.game.events.emit('update-mana', this.mana, this.maxMana);
        this.scene.game.events.emit('show-notification', 'Escudo Físico Roto', '#e94560');
      }
    }

    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.scene.game.events.emit('update-health', this.hp, this.maxHp);
      this.die();
      return;
    }

    this.scene.game.events.emit('update-health', this.hp, this.maxHp);

    this.isInvulnerable = true;
    this.setTint(0xff0000);
    this.scene.time.delayedCall(200, () => {
      this.clearTint();
      this.isInvulnerable = false;
    });
  }

  die() {
    this.isDead = true;
    this.body.setVelocity(0);
    this.setTint(0xff0000);

    // Emit death event for UI to show banner
    this.scene.game.events.emit('player-died');

    // Fade out
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 800,
      onComplete: () => {
        // Respawn after a delay
        this.scene.time.delayedCall(1500, () => {
          this.respawn();
        });
      }
    });
  }

  respawn() {
    const now = Date.now();
    
    // Check if died within 3 minutes of last death
    if (now - this.lastDeathTime < 3 * 60 * 1000) {
      this.consecutiveDeaths++;
    } else {
      this.consecutiveDeaths = 1;
    }
    this.lastDeathTime = now;

    // Calculate penalty: 10 gold base + 5 for each consecutive death after the first
    const penaltyAmount = 10 + (this.consecutiveDeaths - 1) * 5;
    const goldPenalty = Math.min(this.gold, penaltyAmount);
    
    // Restore HP & apply penalty
    this.hp = this.maxHp;
    this.mana = this.maxMana;
    this.gold -= goldPenalty;

    // Reset visual state
    this.setAlpha(1);
    this.clearTint();
    this.isDead = false;
    this.isInvulnerable = true;
    this.debuffTimer = 0;

    // Brief invulnerability after respawn
    this.scene.time.delayedCall(2000, () => {
      this.isInvulnerable = false;
    });

    // Blink effect during invulnerability
    this.scene.tweens.add({
      targets: this,
      alpha: 0.3,
      duration: 200,
      yoyo: true,
      repeat: 4,
      onComplete: () => this.setAlpha(1)
    });

    // Knockback blast effect to push enemies away
    const blastRadius = 80;
    
    // Visual blast
    const blast = this.scene.add.circle(this.x, this.y, 10, 0xffd700, 0.5);
    this.scene.tweens.add({
      targets: blast,
      radius: blastRadius,
      alpha: 0,
      duration: 500,
      ease: 'Cubic.easeOut',
      onComplete: () => blast.destroy()
    });

    // Physics push
    if (this.scene.enemiesGroup) {
      this.scene.enemiesGroup.getChildren().forEach(enemy => {
        if (!enemy.active || enemy.isDead) return;
        const dist = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
        if (dist < blastRadius) {
          const angle = Phaser.Math.Angle.Between(this.x, this.y, enemy.x, enemy.y);
          const pushForce = 300;
          enemy.body.setVelocity(Math.cos(angle) * pushForce, Math.sin(angle) * pushForce);
          
          // Stun the enemy briefly
          enemy.isStunned = true;
          this.scene.time.delayedCall(800, () => {
            if (enemy && enemy.active) enemy.isStunned = false;
          });
        }
      });
    }

    // Update UI
    this.scene.game.events.emit('update-health', this.hp, this.maxHp);
    this.scene.game.events.emit('update-mana', this.mana, this.maxMana);
    this.scene.game.events.emit('player-respawned');

    if (goldPenalty > 0) {
      this.scene.game.events.emit('show-notification', `Perdiste ${goldPenalty} oro...`, '#e94560');
    }
  }

  addGold(amount) {
    this.gold += amount;
    this.scene.game.events.emit('update-gold', this.gold);
    return true;
  }

  addItem(item) {
    // item format: { id: 'potion_hp', name: 'Poción de Vida', count: 1, icon: '🧪' }
    const existing = this.inventory.find(i => i.id === item.id);
    if (existing) {
      existing.count += item.count;
    } else {
      this.inventory.push(item);
    }
    this.scene.game.events.emit('update-inventory', this.inventory);
  }

  async consumeItem(itemId) {
    const itemIndex = this.inventory.findIndex(i => i.id === itemId);
    if (itemIndex === -1) {
      this.scene.game.events.emit('show-notification', 'No tienes pociones', '#e94560');
      return;
    }

    const item = this.inventory[itemIndex];
    if (item.count <= 0) return;

    if (itemId === 'potion_hp') {
      if (this.hp >= this.maxHp) {
        this.scene.game.events.emit('show-notification', 'Salud al máximo', '#8b8b8b');
        return;
      }
    } else if (itemId === 'potion_mp') {
      if (this.mana >= this.maxMana) {
        this.scene.game.events.emit('show-notification', 'Maná al máximo', '#8b8b8b');
        return;
      }
    }

    const updated = await SaveSystem.consumeItem(itemId);
    if (updated) {
      this.inventory = updated.inventory;
      
      if (itemId === 'potion_hp') {
        this.hp = Math.min(this.hp + 30, this.maxHp);
        this.scene.game.events.emit('update-health', this.hp, this.maxHp);
        this.scene.game.events.emit('show-notification', '+30 HP', '#3ac55e');
      } else if (itemId === 'potion_mp') {
        this.mana = Math.min(this.mana + 20, this.maxMana);
        this.scene.game.events.emit('update-mana', this.mana, this.maxMana);
        this.scene.game.events.emit('show-notification', '+20 Maná', '#4488ff');
      }

      this.scene.game.events.emit('update-inventory', this.inventory);
    } else {
      this.scene.game.events.emit('show-notification', 'Error de red al consumir', '#e94560');
    }
  }

  logActivity(activityId) {
    this.scene.game.events.emit('activity-logged', activityId);
  }

  /**
   * Modifies the player's moral alignment.
   * @param {number} delta Positive = good deed, negative = evil deed.
   */
  addMoral(delta) {
    this.moral = Math.max(-100, Math.min(100, this.moral + delta));
    this.scene.game.events.emit('update-moral', this.moral);
  }

  /**
   * Called when an activity gives XP to a specific stat.
   * Each activity raises the corresponding stat by 1.
   */
  gainStatXP(statKey, amount) {
    this.stats[statKey] += 1;

    // If resistance goes up, update max HP and heal
    if (statKey === 'resistance') {
      this.maxHp = this.stats.resistance * 10;
      this.hp = this.maxHp;
      this.scene.game.events.emit('update-health', this.hp, this.maxHp);
    }
    // If maxMana goes up, refill mana
    if (statKey === 'maxMana') {
      this.maxMana = this.stats.maxMana;
      this.mana = this.maxMana;
      this.scene.game.events.emit('update-mana', this.mana, this.maxMana);
    }

    // Update overall XP bar
    this.xp += amount;
    this.level += 1;
    this.scene.game.events.emit('update-xp', this.xp, this.level * 50, this.level);

    // Emit stats update for the panel
    this.scene.game.events.emit('update-stats', this.stats);

    // Check for visual evolution thresholds
    const oldStrength = this.stats.strength - (statKey === 'strength' ? amount : 0);
    const oldIntelligence = this.stats.intelligence - (statKey === 'intelligence' ? amount : 0);
    const oldDexterity = this.stats.dexterity - (statKey === 'dexterity' ? amount : 0);
    
    let evolved = false;
    if (statKey === 'strength' && oldStrength < 10 && this.stats.strength >= 10) evolved = true;
    if (statKey === 'intelligence' && oldIntelligence < 10 && this.stats.intelligence >= 10) evolved = true;
    if (statKey === 'dexterity' && oldDexterity < 10 && this.stats.dexterity >= 10) evolved = true;

    if (evolved) {
      // Regenerate player texture
      this.scene.scene.get('Boot')._generatePlayerSpritesheet(this.stats);
      
      this.scene.game.events.emit('show-notification', '¡Tu apariencia ha evolucionado!', '#ffd700');
      
      // Evolution effect
      const evoParticles = this.scene.add.particles(0, 0, 'particle_gold', {
        speed: { min: 20, max: 100 },
        angle: { min: 0, max: 360 },
        scale: { start: 1.5, end: 0 },
        lifespan: 1500,
        quantity: 50,
        blendMode: 'ADD'
      });
      evoParticles.explode(50, this.x, this.y);
      this.scene.time.delayedCall(2000, () => { if (evoParticles.active) evoParticles.destroy(); });
    }

    // Sparkle effect
    const particles = this.scene.add.particles(0, 0, 'particle_gold', {
      speed: { min: -50, max: 50 },
      angle: { min: 0, max: 360 },
      scale: { start: 1, end: 0 },
      lifespan: 1000,
      quantity: 20
    });
    particles.explode(20, this.x, this.y);

    // Auto-cleanup particles
    this.scene.time.delayedCall(1500, () => {
      if (particles && particles.active) particles.destroy();
    });
  }

  /**
   * Grant 1 unspent point to a branch (called when logging an activity).
   * The player then decides how to spend it via spendBranchPoint().
   */
  gainBranchXP(branchKey, xpAmount) {
    this.branchPoints[branchKey] = (this.branchPoints[branchKey] || 0) + 1;

    // Update overall XP bar (for level indicator)
    this.xp += xpAmount;
    this.scene.game.events.emit('update-xp', this.xp, this.level * 50, this.level);
    this.scene.game.events.emit('update-branch-points', { ...this.branchPoints });

    // Sparkle
    const particles = this.scene.add.particles(0, 0, 'particle_gold', {
      speed: { min: -50, max: 50 }, angle: { min: 0, max: 360 },
      scale: { start: 1, end: 0 }, lifespan: 1000, quantity: 15
    });
    particles.explode(15, this.x, this.y);
    this.scene.time.delayedCall(1500, () => { if (particles?.active) particles.destroy(); });
  }

  /**
   * Spend 1 point from a branch to increment a specific stat.
   * Called from the stat allocation UI.
   */
  spendBranchPoint(branchKey, statKey) {
    if (!this.branchPoints[branchKey] || this.branchPoints[branchKey] <= 0) return false;
    
    // Validate the stat belongs to this branch
    const branch = BRANCHES[branchKey];
    if (!branch || !branch.stats.find(s => s.key === statKey)) return false;

    this.branchPoints[branchKey] -= 1;
    this.stats[statKey] += 1;

    // Side-effects per stat
    if (statKey === 'resistance') {
      this.maxHp = this.stats.resistance * 10;
      this.hp = Math.min(this.hp + 10, this.maxHp); // Heal 10 on HP upgrade
      this.scene.game.events.emit('update-health', this.hp, this.maxHp);
    }
    if (statKey === 'maxMana') {
      this.maxMana = this.stats.maxMana;
      this.mana = Math.min(this.mana + 5, this.maxMana);
      this.scene.game.events.emit('update-mana', this.mana, this.maxMana);
    }
    if (statKey === 'willpower') {
      // Faster mana regen
      this._startManaRegen();
    }

    this.scene.game.events.emit('update-stats', this.stats);
    this.scene.game.events.emit('update-branch-points', { ...this.branchPoints });

    // Check visual evolution thresholds
    const evolvable = ['strength', 'intelligence', 'dexterity'];
    if (evolvable.includes(statKey) && this.stats[statKey] === 10) {
      this.scene.scene.get('Boot')._generatePlayerSpritesheet(this.stats);
      this.scene.game.events.emit('show-notification', '¡Tu apariencia ha evolucionado!', '#ffd700');
      const evo = this.scene.add.particles(0, 0, 'particle_gold', {
        speed: { min: 20, max: 100 }, angle: { min: 0, max: 360 },
        scale: { start: 1.5, end: 0 }, lifespan: 1500, quantity: 50, blendMode: 'ADD'
      });
      evo.explode(50, this.x, this.y);
      this.scene.time.delayedCall(2000, () => { if (evo?.active) evo.destroy(); });
    }

    return true;
  }

  equipAccessory(item) {
    if (this.equippedAccessories.includes(item.id)) return;
    if (this.equippedAccessories.length >= 2) {
      // Unequip first one to make room
      const firstId = this.equippedAccessories[0];
      const firstItem = this.inventory.find(i => i.id === firstId);
      if (firstItem) this.unequipAccessory(firstItem);
    }
    this.equippedAccessories.push(item.id);
    // Apply stats
    if (item.effect) {
      for (const [stat, val] of Object.entries(item.effect)) {
        this.stats[stat] = (this.stats[stat] || 5) + val;
      }
    }
    this.scene.game.events.emit('update-stats', this.stats);
    this.scene.game.events.emit('update-equipped-accessories', this.equippedAccessories);
  }

  unequipAccessory(item) {
    const idx = this.equippedAccessories.indexOf(item.id);
    if (idx === -1) return;
    this.equippedAccessories.splice(idx, 1);
    // Remove stats
    if (item.effect) {
      for (const [stat, val] of Object.entries(item.effect)) {
        this.stats[stat] = Math.max(5, (this.stats[stat] || 5) - val);
      }
    }
    this.scene.game.events.emit('update-stats', this.stats);
    this.scene.game.events.emit('update-equipped-accessories', this.equippedAccessories);
  }

  switchSpell() {
    if (this.isDead) return;
    if (this.equippedSpells.length < 2) return;
    this.activeSpellIndex = (this.activeSpellIndex + 1) % this.equippedSpells.length;
    this.scene.game.events.emit('active-spell-changed', this.equippedSpells[this.activeSpellIndex]);
    const uiScene = this.scene.scene.get('UI');
    if (uiScene?.showNotification) {
      const spellNames = { shield: 'Escudo de Maná', ghost_swords: 'Espadas Fantasma', heal: 'Fuego Curativo' };
      const activeSpellKey = this.equippedSpells[this.activeSpellIndex];
      uiScene.showNotification(`Hechizo Activo: ${spellNames[activeSpellKey] || activeSpellKey}`, '#a855f7');
    }
  }

  hasLoggedActivityToday() {
    const today = new Date().toISOString().split('T')[0];
    return Object.values(this.activitiesToday).some(date => date === today);
  }

  /**
   * Get save data for persistence.
   */
  getSaveData() {
    // Pack new fields inside branchPoints to avoid DB migrations
    const bp = {
      ...this.branchPoints,
      equippedAccessories: this.equippedAccessories,
      spells: this.spells,
      equippedSpells: this.equippedSpells,
      activeSpellIndex: this.activeSpellIndex
    };

    return {
      stats: this.stats,
      level: this.level,
      xp: this.xp,
      hp: this.hp,
      maxHp: this.maxHp,
      mana: this.mana,
      maxMana: this.maxMana,
      gold: this.gold,
      currentWeaponKey: this.currentWeaponKey,
      activitiesToday: this.activitiesToday,
      inventory: this.inventory,
      affinityData: this.affinityData,
      dominantBranch: this.dominantBranch,
      branchPoints: bp,
      lastDeathTime: this.lastDeathTime,
      consecutiveDeaths: this.consecutiveDeaths,
      moral: this.moral,
      inRecovery: this.inRecovery
    };
  }

  /**
   * Load saved data into the player.
   */
  loadSaveData(data) {
    if (!data) return;
    this.inRecovery = data.inRecovery || false;
    this.stats = data.stats || this.stats;
    this.level = data.level || this.level;
    this.xp = data.xp || 0;
    this.hp = data.hp || this.maxHp;
    this.maxHp = data.maxHp || this.stats.resistance * 10;
    this.mana = data.mana || this.maxMana;
    this.maxMana = data.maxMana || this.stats.maxMana;
    this.gold = data.gold || 0;
    this.currentWeaponKey = data.currentWeaponKey || WEAPONS.SWORD.key;
    this.activitiesToday = data.activitiesToday || {};

    const baseItems = {
      potion_hp: { name: 'Agua Mineral', icon: '🥤', type: 'consumable' },
      potion_mp: { name: 'Café Cargado', icon: '☕', type: 'consumable' },
      acc_strength_ring: { name: 'Anillo de Fuerza', icon: '💍', type: 'accessory', effect: { strength: 2, resistance: 1 } },
      acc_intellect_amulet: { name: 'Amuleto de Intelecto', icon: '📿', type: 'accessory', effect: { intelligence: 2, willpower: 1 } },
      acc_dexterity_cloak: { name: 'Capa de Destreza', icon: '🧥', type: 'accessory', effect: { dexterity: 2, speed: 1 } },
      quest_goblin_tooth: { name: 'Diente de Goblin', icon: '🦷', type: 'quest' },
      quest_slime_jelly: { name: 'Gelatina de Slime', icon: '🟢', type: 'quest' }
    };

    const loadedInventory = data.inventory || [];
    this.inventory = loadedInventory.map(item => {
      const base = baseItems[item.id];
      if (base) {
        return { ...item, ...base };
      }
      return item;
    });

    if (loadedInventory.length === 0) {
      this.inventory = [
        { id: 'potion_hp', name: 'Agua Mineral', count: 3, icon: '🥤', type: 'consumable' },
        { id: 'potion_mp', name: 'Café Cargado', count: 3, icon: '☕', type: 'consumable' },
        { id: 'acc_strength_ring', name: 'Anillo de Fuerza', count: 1, icon: '💍', type: 'accessory', effect: { strength: 2, resistance: 1 } },
        { id: 'acc_intellect_amulet', name: 'Amuleto de Intelecto', count: 1, icon: '📿', type: 'accessory', effect: { intelligence: 2, willpower: 1 } },
        { id: 'acc_dexterity_cloak', name: 'Capa de Destreza', count: 1, icon: '🧥', type: 'accessory', effect: { dexterity: 2, speed: 1 } },
        { id: 'quest_goblin_tooth', name: 'Diente de Goblin', count: 0, icon: '🦷', type: 'quest' },
        { id: 'quest_slime_jelly', name: 'Gelatina de Slime', count: 0, icon: '🟢', type: 'quest' }
      ];
    }

    this.affinityData = data.affinityData || {
      month: this._currentMonth(),
      counts: { strength: 0, dexterity: 0, intelligence: 0, willpower: 0 }
    };
    this.dominantBranch = data.dominantBranch || null;
    this.branchPoints = data.branchPoints || { strength: 0, dexterity: 0, intelligence: 0, willpower: 0, vitality: 100 };
    if (this.branchPoints.vitality === undefined) {
      this.branchPoints.vitality = 100;
    }

    // Unpack from branchPoints Json
    this.equippedAccessories = this.branchPoints.equippedAccessories || [];
    this.spells = this.branchPoints.spells || ['shield', 'ghost_swords', 'heal'];
    this.equippedSpells = this.branchPoints.equippedSpells || ['shield', 'ghost_swords'];
    this.activeSpellIndex = this.branchPoints.activeSpellIndex || 0;

    // Restart mana regen with loaded willpower stat
    this._startManaRegen();
  }
}
