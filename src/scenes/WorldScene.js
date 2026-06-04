import Phaser from 'phaser';
import Player from '../entities/Player.js';
import Enemy from '../entities/Enemy.js';
import NPC from '../entities/NPC.js';
import QuestSystem, { QUEST_STATE } from '../utils/QuestSystem.js';
import DialogueSystem from '../ui/DialogueSystem.js';
import ShopSystem from '../ui/ShopSystem.js';
import DailyMissionSystem from '../utils/DailyMissionSystem.js';
import { generateMap, getSpawnPoint, getEnemySpawns, getTransitions } from '../utils/MapGenerator.js';
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, SOLID_TILES, SCENES, WEAPONS, ACTIVITIES, TILES, BRANCHES } from '../utils/constants.js';
import SaveSystem from '../utils/SaveSystem.js';

export default class WorldScene extends Phaser.Scene {
  constructor() {
    super(SCENES.WORLD);
  }

  init(data) {
    this.mapId = data?.mapId || 'guild';
    this.spawnId = data?.spawnId || 'default';
    this.isTransitioning = false;
  }

  create() {
    // ── Map ──
    const mapData = generateMap(this.mapId, MAP_WIDTH, MAP_HEIGHT);
    this._mapData = mapData; 
    const map = this.make.tilemap({ data: mapData, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = map.addTilesetImage('tileset');
    this.mapLayer = map.createLayer(0, tileset, 0, 0);
    this.mapLayer.setCollision(SOLID_TILES);

    // Load Transitions
    this.transitions = getTransitions(this.mapId);

    // ── Player ──
    const spawnTile = getSpawnPoint(this.mapId, this.spawnId);
    Player.createAnimations(this);
    this.player = new Player(this, spawnTile.x * TILE_SIZE, spawnTile.y * TILE_SIZE);

    // Load save data if it exists
    const saveData = SaveSystem.load();
    if (saveData) {
      this.player.loadSaveData(saveData);
    }

    // ── Enemies ──
    this.enemiesGroup = this.physics.add.group();
    this._enemySpawnData = getEnemySpawns(this.mapId); // Save for respawning
    this._spawnEnemies();

    // ── Camera ──
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setBounds(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
    this.cameras.main.setZoom(2.5);
    this.cameras.main.fadeIn(800, 0, 0, 0);

    // ── Zone Title Display ──
    const zoneNames = { 'guild': 'Gremio de Héroes', 'deeproot': 'Deeproot' };
    const titleText = this.add.text(
      (MAP_WIDTH * TILE_SIZE) / 2, 
      this.player.y - 100, 
      zoneNames[this.mapId] || this.mapId,
      { fontFamily: 'MedievalSharp', fontSize: '32px', color: '#ffd700', stroke: '#000', strokeThickness: 4 }
    ).setOrigin(0.5).setAlpha(0).setDepth(100);

    // Make text follow camera vertically so it stays centered
    titleText.setScrollFactor(0);
    titleText.setPosition(this.cameras.main.centerX, this.cameras.main.centerY - 50);

    this.tweens.add({
      targets: titleText,
      alpha: 1,
      y: titleText.y - 20,
      duration: 1000,
      ease: 'Power2',
      onComplete: () => {
        this.time.delayedCall(2000, () => {
          this.tweens.add({
            targets: titleText,
            alpha: 0,
            duration: 800,
            onComplete: () => titleText.destroy()
          });
        });
      }
    });

    // ── Collisions ──
    this.physics.add.collider(this.player, this.mapLayer);
    this.physics.add.collider(this.enemiesGroup, this.mapLayer);
    this.physics.add.collider(this.player, this.enemiesGroup);

    // ── UI Scene ──
    this.scene.launch(SCENES.UI);

    // ── Vision System (Dungeon) ──
    if (this.mapId === 'dungeon') {
      this.visionMask = this.make.graphics();
      this.visionMask.fillStyle(0x000000, 0.98); // Very dark
      this.visionMask.fillRect(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
      this.visionMask.setDepth(90); // Above map and entities, below UI/Text
      
      this.visionEraser = this.make.graphics();
      this.visionEraser.fillStyle(0xffffff, 1);
      
      const mask = this.visionEraser.createGeometryMask();
      mask.setInvertAlpha(true);
      this.visionMask.setMask(mask);
    }

    // ── New Systems ──
    this.questSystem = new QuestSystem(this.game);
    this.dialogueSystem = new DialogueSystem(this);
    this.shopSystem = new ShopSystem(this.game, this.dialogueSystem);
    this.dailyMissions = new DailyMissionSystem(this.game);

    // Track map visit for daily missions
    this.dailyMissions.trackVisit(this.mapId);

    // ── NPCs ──
    this.npcsGroup = this.physics.add.group();
    
    if (this.mapId === 'guild') {
      // 1. Villager (Guild Master - Center)
      const villager = new NPC(this, 30 * TILE_SIZE, 17 * TILE_SIZE, 'npc_villager', {
        name: 'Maestro',
        dialogueKey: 'tutorial',
        wanderRadius: 10
      });
      // 2. Blacksmith (Reception - Top Center)
      const smith = new NPC(this, 30 * TILE_SIZE, 8 * TILE_SIZE, 'npc_smith', {
        name: 'Herrero',
        dialogueKey: 'smith',
        wanderRadius: 0
      });
      // 3. Alchemist (Library/Magic Zone - Top Right)
      const alchemist = new NPC(this, 48 * TILE_SIZE, 9 * TILE_SIZE, 'npc_sage', {
        name: 'Alquimista',
        dialogueKey: 'shop',
        wanderRadius: 20
      });

      this.npcsGroup.add(villager);
      this.npcsGroup.add(smith);
      this.npcsGroup.add(alchemist);
    }
    this.physics.add.collider(this.npcsGroup, this.mapLayer);
    this.physics.add.collider(this.player, this.npcsGroup);

    // ── Input ──
    this.cursors = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D,
      SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE,
      ONE: Phaser.Input.Keyboard.KeyCodes.ONE,
      TWO: Phaser.Input.Keyboard.KeyCodes.TWO,
      THREE: Phaser.Input.Keyboard.KeyCodes.THREE,
      TAB: Phaser.Input.Keyboard.KeyCodes.TAB,
      E: Phaser.Input.Keyboard.KeyCodes.E,
      Q: Phaser.Input.Keyboard.KeyCodes.Q,
      F: Phaser.Input.Keyboard.KeyCodes.F,
      SHIFT: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      H: Phaser.Input.Keyboard.KeyCodes.H,
      M: Phaser.Input.Keyboard.KeyCodes.M,
    });

    // Weapon switching
    this.cursors.ONE.on('down', () => this.player.switchWeapon(WEAPONS.SWORD.key));
    this.cursors.TWO.on('down', () => this.player.switchWeapon(WEAPONS.BOW.key));
    this.cursors.THREE.on('down', () => this.player.switchWeapon(WEAPONS.MAGIC.key));

    // Spells (Q and F)
    this.cursors.Q.on('down', () => this.player.castSpell('shield'));
    this.cursors.F.on('down', () => this.player.castSpell('ghost_swords'));

    // Dodge Roll (SHIFT)
    this.cursors.SHIFT.on('down', () => this.player.dodgeRoll());

    // Interact action (E key)
    this.cursors.E.on('down', () => this._handleInteraction());

    // ── Interaction prompt ──
    this._interactPrompt = this.add.text(0, 0, 'Presiona E', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '8px',
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 3,
      backgroundColor: 'rgba(10,10,30,0.8)',
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(20).setVisible(false);

    // ── Events ──
    this.events.on('player-attack', this.handleAttack, this);
    this.events.on('player-spell', this.handleSpellcast, this);

    // Handle enemy deaths → give gold & track quests
    this.events.on('enemy-died', (enemy) => {
      let goldDrop = Math.floor(enemy.xpReward / 2) + Phaser.Math.Between(1, 5);
      
      // Boss drop
      if (enemy.typeConfig.isBoss) {
        goldDrop = 500;
        // Boss death dramatic effect
        this.cameras.main.flash(800, 255, 215, 0); // Gold flash
        this.cameras.main.shake(1000, 0.02);
      }

      this.player.addGold(goldDrop);

      const uiScene = this.scene.get(SCENES.UI);
      if (uiScene && uiScene.showNotification) {
        uiScene.showNotification(`+${goldDrop} Oro`, '#ffd700');
      }
      
      // Track quest
      this.questSystem.trackKill(enemy.typeConfig.name);

      // Track daily mission
      this.dailyMissions.trackKill(enemy.typeConfig.name, this.mapId);

      // Auto-save after enemy kill
      SaveSystem.save(this.player.getSaveData());
    });

    // Handle activities logged from the HTML modal
    this.game.events.on('activity-logged', (activityId) => {
      const activity = Object.values(ACTIVITIES).find(a => a.id === activityId);
      if (!activity) return;

      // Check daily cooldown
      const today = new Date().toISOString().split('T')[0];
      if (this.player.activitiesToday[activityId] === today) {
        const uiScene = this.scene.get(SCENES.UI);
        if (uiScene && uiScene.showNotification) {
          uiScene.showNotification('Ya registraste esta actividad hoy', '#e94560');
        }
        return;
      }

      // Mark as done today
      this.player.activitiesToday[activityId] = today;

      // Grant branch XP (unspent point)
      this.player.gainBranchXP(activity.branch, activity.xpReward);

      // Update monthly affinity tracking
      const prevBranch = this.player.dominantBranch;
      this.player.trackAffinityActivity(activity.branch);
      const newBranch = this.player.dominantBranch;

      const branchDef = BRANCHES[activity.branch];
      const branchName = branchDef ? `${branchDef.icon} ${branchDef.name}` : activity.branch;

      const uiScene = this.scene.get(SCENES.UI);
      if (uiScene && uiScene.showNotification) {
        uiScene.showNotification(`¡+1 punto de ${branchName}!`, '#a855f7');
        if (newBranch && newBranch !== prevBranch) {
          this.time.delayedCall(1200, () => {
            const ui = this.scene.get(SCENES.UI);
            if (ui && ui.showNotification) ui.showNotification(`¡Afinidad Orgánica: ${branchName} +15% daño!`, '#f1c40f');
          });
        }
      }

      // Show stat allocation dialog (Fable-style)
      this.time.delayedCall(600, () => {
        this._showStatAllocationDialog(activity.branch);
      });

      // Track daily mission activity
      this.dailyMissions.trackActivity(activity.branch);

      // Notify if all daily missions done
      if (this.dailyMissions.allClaimed()) {
        this.time.delayedCall(2000, () => {
          const ui = this.scene.get(SCENES.UI);
          if (ui && ui.showNotification) ui.showNotification('🏆 ¡Misiones del día completadas!', '#f1c40f');
        });
      }

      // Auto-save after activity
      SaveSystem.save(this.player.getSaveData());
    });

    // Handle player death (for camera effects)
    this.game.events.on('player-died', () => {
      this.cameras.main.flash(400, 200, 0, 0);
      this.cameras.main.shake(300, 0.01);
    });

    // Handle player respawn
    this.game.events.on('player-respawned', () => {
      this.cameras.main.fadeIn(500);
    });

    // Quick-use item listeners (from HTML HUD)
    this.game.events.on('quick-use-hp', () => this.player.consumeItem('potion_hp'));
    this.game.events.on('quick-use-mp', () => this.player.consumeItem('potion_mp'));

    // ── Initial UI sync ──
    this.time.delayedCall(100, () => {
      this.game.events.emit('update-health', this.player.hp, this.player.maxHp);
      this.game.events.emit('update-mana', this.player.mana, this.player.maxMana);
      this.game.events.emit('update-xp', this.player.xp, this.player.level * 50, this.player.level);
      this.game.events.emit('update-stats', this.player.stats);
      this.game.events.emit('update-gold', this.player.gold);
      this.game.events.emit('update-inventory', this.player.inventory);
      this.game.events.emit('update-affinity', this.player.dominantBranch, this.player.affinityData?.counts || {});
      this.game.events.emit('update-branch-points', { ...this.player.branchPoints });

      // Notify player of any unspent points from previous session
      const unspent = Object.entries(this.player.branchPoints).filter(([, v]) => v > 0);
      if (unspent.length > 0) {
        const uiScene = this.scene.get(SCENES.UI);
        if (uiScene && uiScene.showNotification) {
          uiScene.showNotification('¡Tienes puntos sin gastar! (TAB → Asignar)', '#f1c40f');
        }
      }
    });

    // ── Enemy respawn timer (every 30s) ──
    this._enemyRespawnTimer = this.time.addEvent({
      delay: 30000,
      callback: () => this._respawnDeadEnemies(),
      loop: true
    });

    // ── Auto-save timer (every 30s) ──
    this._autoSaveTimer = this.time.addEvent({
      delay: 30000,
      callback: () => {
        SaveSystem.save(this.player.getSaveData());
      },
      loop: true
    });
  }

  // ── UPDATE ──
  update() {
    if (this.isTransitioning) return;

    this.player.update(this.cursors);

    // Quick Items (Keyboard Hotkeys)
    if (Phaser.Input.Keyboard.JustDown(this.cursors.H)) {
      this.player.consumeItem('potion_hp');
    }
    if (Phaser.Input.Keyboard.JustDown(this.cursors.M)) {
      this.player.consumeItem('potion_mp');
    }

    // Update vision eraser in dungeon
    if (this.visionEraser && this.mapId === 'dungeon') {
      this.visionEraser.clear();
      this.visionEraser.fillStyle(0xffffff, 1);
      
      // Dynamic light pulsing
      const pulse = Math.sin(this.time.now / 400) * 8;
      // Also flicker randomly a bit like a torch
      const flicker = Math.random() * 3;
      
      const radius = 70 + pulse + flicker;
      this.visionEraser.fillCircle(this.player.x, this.player.y - 12, radius);
    }

    this.enemiesGroup.getChildren().forEach(enemy => {
      if (enemy.active) {
        enemy.update(this.player);
      }
    });

    // Check map transitions
    const px = Math.floor(this.player.x / TILE_SIZE);
    const py = Math.floor(this.player.y / TILE_SIZE);
    for (const t of this.transitions) {
      if (px >= t.x && px < t.x + t.w && py >= t.y && py < t.y + t.h) {
        this._transitionToMap(t.targetMap, t.targetSpawnId);
        break;
      }
    }
    
    // Ghost swords update
    if (this.ghostSwords) {
      this.ghostSwords.getChildren().forEach(sword => {
        if (sword.active && sword.targetEnemy && sword.targetEnemy.active && sword.targetEnemy.hp > 0) {
          // Seek target
          this.physics.moveToObject(sword, sword.targetEnemy, 150);
          sword.rotation = Phaser.Math.Angle.Between(sword.x, sword.y, sword.targetEnemy.x, sword.targetEnemy.y) + Math.PI/4;
        } else if (sword.active) {
          // Orbit player
          const time = this.time.now / 500;
          const radius = 30;
          const offset = sword.orbitOffset || 0;
          const targetX = this.player.x + Math.cos(time + offset) * radius;
          const targetY = this.player.y + Math.sin(time + offset) * radius;
          this.physics.moveTo(sword, targetX, targetY, 100);
          sword.rotation = time + offset;
          
          // Find new target
          let closest = null;
          let minD = 100; // aggro range
          this.enemiesGroup.getChildren().forEach(e => {
            if (e.active && e.hp > 0) {
              const d = Phaser.Math.Distance.Between(sword.x, sword.y, e.x, e.y);
              if (d < minD) { minD = d; closest = e; }
            }
          });
          if (closest) sword.targetEnemy = closest;
        }
      });
    }

    // Update NPCs
    this.npcsGroup.getChildren().forEach(npc => {
      if (npc.active) npc.update();
    });

    // Check for nearby interactables and show prompt
    this._updateInteractionPrompt();
  }

  // ========================================================================
  //  COMBAT & SPELLS
  // ========================================================================
  handleAttack(data) {
    const { weapon, dir, origin, chargeTime } = data;
    const isCharged = chargeTime > 800; // 0.8s charge

    if (weapon.key === WEAPONS.SWORD.key) {
      // Melee attack
      const spriteKey = isCharged ? 'slash_flourish' : 'slash_effect';
      const slash = this.add.sprite(origin.x + dir.x * 16, origin.y + dir.y * 16, spriteKey);
      slash.setDepth(15);

      if (dir.x === 1) slash.setAngle(0);
      else if (dir.x === -1) slash.setAngle(180);
      else if (dir.y === 1) slash.setAngle(90);
      else if (dir.y === -1) slash.setAngle(-90);

      this.tweens.add({
        targets: slash,
        alpha: 0,
        scale: isCharged ? 2.0 : 1.5,
        duration: isCharged ? 250 : 150,
        onComplete: () => slash.destroy()
      });

      const size = isCharged ? 40 : 24;
      const hitbox = this.add.rectangle(slash.x, slash.y, size, size, 0xff0000, 0);
      this.physics.add.existing(hitbox);

      const collider = this.physics.add.overlap(hitbox, this.enemiesGroup, (box, enemy) => {
        enemy.takeDamage(isCharged ? weapon.damage * 2 : weapon.damage, dir);
        if (isCharged) {
          // Extra knockback
          enemy.body.setVelocity(dir.x * 200, dir.y * 200);
          this.cameras.main.shake(100, 0.005);
        }
      });

      this.time.delayedCall(isCharged ? 200 : 100, () => {
        collider.destroy();
        hitbox.destroy();
      });

    } else if (weapon.key === WEAPONS.BOW.key) {
      const isPiercing = chargeTime > 1200; // 1.2s charge
      const spriteKey = isPiercing ? 'arrow_charged' : 'arrow';
      const arrow = this.physics.add.sprite(origin.x, origin.y, spriteKey);
      arrow.setDepth(12);

      if (dir.x === 1) arrow.setAngle(0);
      else if (dir.x === -1) arrow.setAngle(180);
      else if (dir.y === 1) arrow.setAngle(90);
      else if (dir.y === -1) arrow.setAngle(-90);

      const speed = isPiercing ? 350 : 200;
      arrow.setVelocity(dir.x * speed, dir.y * speed);

      this.physics.add.collider(arrow, this.mapLayer, () => arrow.destroy());
      
      arrow.hitEnemies = new Set();
      this.physics.add.overlap(arrow, this.enemiesGroup, (arr, enemy) => {
        if (!arrow.hitEnemies.has(enemy)) {
          arrow.hitEnemies.add(enemy);
          enemy.takeDamage(isPiercing ? weapon.damage * 2.5 : weapon.damage, dir);
          if (isPiercing) {
            enemy.body.setVelocity(dir.x * 100, dir.y * 100);
          }
          if (!isPiercing) arr.destroy();
        }
      });

      this.time.delayedCall(isPiercing ? 2000 : 1500, () => { if (arrow.active) arrow.destroy() });

    } else if (weapon.key === WEAPONS.MAGIC.key) {
      const isAoE = chargeTime > 1000; // 1.0s charge
      
      if (isAoE) {
        // Explode outward
        const aoe = this.add.sprite(origin.x, origin.y, 'magic_aoe');
        aoe.setDepth(11);
        
        this.tweens.add({
          targets: aoe,
          scale: { start: 0.1, end: 2.5 },
          alpha: { start: 1, end: 0 },
          duration: 400,
          onComplete: () => aoe.destroy()
        });
        
        const hitbox = this.add.circle(origin.x, origin.y, 40, 0xff0000, 0);
        this.physics.add.existing(hitbox);
        
        const collider = this.physics.add.overlap(hitbox, this.enemiesGroup, (box, enemy) => {
          // Push away from player
          const angle = Phaser.Math.Angle.Between(origin.x, origin.y, enemy.x, enemy.y);
          const pushDir = { x: Math.cos(angle), y: Math.sin(angle) };
          enemy.takeDamage(weapon.damage * 2, pushDir);
          enemy.body.setVelocity(pushDir.x * 250, pushDir.y * 250); // huge push
        });
        
        this.cameras.main.shake(150, 0.01);
        this.time.delayedCall(150, () => {
          collider.destroy();
          hitbox.destroy();
        });
        
      } else {
        const orb = this.physics.add.sprite(origin.x, origin.y, 'magic_orb');
        orb.setDepth(12);
        orb.setVelocity(dir.x * 150, dir.y * 150);

        const particles = this.add.particles(0, 0, 'particle_purple', {
          speed: 10,
          scale: { start: 1, end: 0 },
          blendMode: 'ADD',
          lifespan: 300
        });
        particles.startFollow(orb);

        this.physics.add.collider(orb, this.mapLayer, () => {
          orb.destroy();
          particles.destroy();
        });
        this.physics.add.overlap(orb, this.enemiesGroup, (o, enemy) => {
          enemy.takeDamage(weapon.damage, dir);
          o.destroy();
          particles.destroy();
        });

        this.time.delayedCall(2000, () => {
          if (orb.active) {
            orb.destroy();
            particles.destroy();
          }
        });
      }
    }
  }

  handleSpellcast(data) {
    const { spell, origin } = data;
    const uiScene = this.scene.get(SCENES.UI);

    if (spell === 'shield') {
      if (this.player.hasPhysicalShield) {
        // Toggle off
        this.player.hasPhysicalShield = false;
        if (this.player.shieldBubble) {
          this.player.shieldBubble.destroy();
          this.player.shieldBubble = null;
        }
        if (uiScene && uiScene.showNotification) uiScene.showNotification('Escudo Físico Desactivado', '#8b8b8b');
      } else {
        if (this.player.mana >= 10) {
          this.player.hasPhysicalShield = true;
          this.player.mana -= 10; // Activation cost
          this.game.events.emit('update-mana', this.player.mana, this.player.maxMana);
          
          this.player.shieldBubble = this.add.sprite(origin.x, origin.y, 'shield_bubble');
          this.player.shieldBubble.setDepth(20);
          
          if (uiScene && uiScene.showNotification) uiScene.showNotification('Escudo Físico Activado', '#4488ff');
        } else {
          if (uiScene && uiScene.showNotification) uiScene.showNotification('Sin maná para Escudo', '#e94560');
        }
      }
    } else if (spell === 'ghost_swords') {
      if (this.player.mana >= 15) {
        this.player.mana -= 15;
        this.game.events.emit('update-mana', this.player.mana, this.player.maxMana);
        if (uiScene && uiScene.showNotification) uiScene.showNotification('Espadas Fantasma', '#a8dcf7');
        
        if (!this.ghostSwords) {
          this.ghostSwords = this.physics.add.group();
          this.physics.add.overlap(this.ghostSwords, this.enemiesGroup, (sword, enemy) => {
            if (sword.active && enemy.active && enemy.hp > 0) {
              const dir = { x: Math.sign(enemy.x - sword.x), y: Math.sign(enemy.y - sword.y) };
              enemy.takeDamage(this.player._getScaledDamage(WEAPONS.MAGIC), dir);
              sword.destroy(); // one hit
            }
          });
        }
        
        // Spawn 3 swords
        for (let i = 0; i < 3; i++) {
          const sword = this.physics.add.sprite(origin.x, origin.y, 'ghost_sword');
          sword.setDepth(15);
          sword.orbitOffset = (Math.PI * 2 / 3) * i;
          this.ghostSwords.add(sword);
          
          // Expire after 10 seconds if no target hit
          this.time.delayedCall(10000, () => {
            if (sword.active) {
              this.tweens.add({ targets: sword, alpha: 0, duration: 500, onComplete: () => sword.destroy() });
            }
          });
        }
      } else {
        if (uiScene && uiScene.showNotification) uiScene.showNotification('Sin maná para Espadas', '#e94560');
      }
    }
  }

  // ========================================================================
  //  ENEMY SPAWNING / RESPAWN
  // ========================================================================
  _spawnEnemies() {
    this._enemySpawnData.forEach(spawn => {
      const enemy = new Enemy(this, spawn.x * TILE_SIZE, spawn.y * TILE_SIZE, spawn.type);
      this.enemiesGroup.add(enemy);
    });
  }

  _respawnDeadEnemies() {
    const currentCount = this.enemiesGroup.getChildren().filter(e => e.active).length;
    const targetCount = this._enemySpawnData.length;

    if (currentCount < targetCount) {
      // Pick random spawns to fill back up
      const toSpawn = Math.min(3, targetCount - currentCount); // max 3 at a time
      for (let i = 0; i < toSpawn; i++) {
        const spawn = Phaser.Utils.Array.GetRandom(this._enemySpawnData);
        const enemy = new Enemy(this, spawn.x * TILE_SIZE, spawn.y * TILE_SIZE, spawn.type);
        this.enemiesGroup.add(enemy);

        // Fade-in effect
        enemy.setAlpha(0);
        this.tweens.add({
          targets: enemy,
          alpha: 1,
          duration: 500
        });
      }
    }
  }

  // ========================================================================
  //  INTERACTION SYSTEM (chests, signs)
  // ========================================================================
  _getNearbyTile() {
    // Get the tile the player is facing
    let checkX = Math.floor(this.player.x / TILE_SIZE);
    let checkY = Math.floor(this.player.y / TILE_SIZE);

    switch (this.player.facing) {
      case 'up':    checkY -= 1; break;
      case 'down':  checkY += 1; break;
      case 'left':  checkX -= 1; break;
      case 'right': checkX += 1; break;
    }

    if (checkX < 0 || checkX >= MAP_WIDTH || checkY < 0 || checkY >= MAP_HEIGHT) return null;

    return {
      x: checkX,
      y: checkY,
      tileType: this._mapData[checkY][checkX]
    };
  }
  
  _getNearbyNPC() {
    let closestNPC = null;
    let closestDist = Infinity;
    
    this.npcsGroup.getChildren().forEach(npc => {
      if (npc.isNearPlayer(this.player, 30)) {
        const dist = Phaser.Math.Distance.Between(npc.x, npc.y, this.player.x, this.player.y);
        if (dist < closestDist) {
          closestDist = dist;
          closestNPC = npc;
        }
      }
    });
    
    return closestNPC;
  }

  _updateInteractionPrompt() {
    // Check NPCs first
    const npc = this._getNearbyNPC();
    if (npc) {
      this._interactPrompt.setPosition(npc.x, npc.y - 30);
      this._interactPrompt.setVisible(true);
      return;
    }

    const tile = this._getNearbyTile();
    if (tile && (tile.tileType === TILES.CHEST || tile.tileType === TILES.SIGN || tile.tileType === TILES.BULLETIN_BOARD)) {
      this._interactPrompt.setPosition(
        tile.x * TILE_SIZE + TILE_SIZE / 2,
        tile.y * TILE_SIZE - 8
      );
      this._interactPrompt.setVisible(true);
    } else {
      this._interactPrompt.setVisible(false);
    }
  }

  _handleInteraction() {
    if (this.dialogueSystem && this.dialogueSystem.isActive) {
      // Dialogue handles its own progression on E, don't do anything here
      return;
    }

    // 1. Check NPC
    const npc = this._getNearbyNPC();
    if (npc) {
      this._handleNPCDialogue(npc);
      return;
    }

    // 2. Check Tile
    const tile = this._getNearbyTile();
    if (!tile) return;

    const uiScene = this.scene.get(SCENES.UI);

    if (tile.tileType === TILES.CHEST) {
      // Give random gold only
      const goldAmount = Phaser.Math.Between(50, 100);
      this.player.addGold(goldAmount);

      if (uiScene && uiScene.showNotification) {
        uiScene.showNotification(`¡Cofre! +${goldAmount} Oro`, '#ffd700');
      }

      // Change chest to grass (opened)
      this._mapData[tile.y][tile.x] = TILES.GRASS;
      this.mapLayer.putTileAt(TILES.GRASS, tile.x, tile.y);

      // Sparkle particles
      const particles = this.add.particles(0, 0, 'particle_gold', {
        speed: { min: 20, max: 60 },
        scale: { start: 1, end: 0 },
        lifespan: 600,
        quantity: 10
      });
      particles.explode(10, tile.x * TILE_SIZE + 8, tile.y * TILE_SIZE + 8);

      SaveSystem.save(this.player.getSaveData());

    } else if (tile.tileType === TILES.SIGN) {
      // Show a tutorial message
      const messages = [
        '¡Bienvenido a Gains & Goblins!\nTus hábitos reales te hacen más fuerte.',
        'Presiona L para registrar actividades.\n¡Cada hábito sube tus stats!',
        'Espada (1), Arco (2), Magia (3).\nPresiona ESPACIO para atacar.',
        'TAB para ver tus estadísticas.\n¡Entrena en la vida real para mejorar!',
      ];
      const msg = Phaser.Utils.Array.GetRandom(messages);
      if (uiScene && uiScene.showNotification) {
        uiScene.showNotification(`📜 ${msg}`, '#c4a35a');
      }

    } else if (tile.tileType === TILES.BULLETIN_BOARD) {
      this._showDailyMissionsBoard();
    }
  }

  _showDailyMissionsBoard() {
    const missions = this.dailyMissions.getMissions();
    const today = new Date().toLocaleDateString('es-MX', { weekday: 'long', month: 'long', day: 'numeric' });

    // Build mission lines for dialogue
    const lines = [`📋 MISIONES DEL DÍA — ${today}`];
    const choices = [];

    missions.forEach((m, i) => {
      const progress = m.extraKill
        ? `${m.current}/${m.count} + ${m.extraProgress}/${m.extraKill.count}`
        : `${m.current}/${m.count}`;
      const status = m.claimed ? '✅' : m.completed ? '🎁 ¡Listo para reclamar!' : `${m.icon} ${progress}`;
      lines.push(`${i + 1}. ${m.title}: ${status}`);
      lines.push(`   ${m.desc}`);
      const rewardText = `${m.reward.gold} oro${m.reward.branchBonus ? ' + 1 punto extra' : ''}`;
      lines.push(`   Recompensa: ${rewardText}`);
    });

    // Add claim choices for completed missions
    const claimable = missions.filter(m => m.completed && !m.claimed);
    if (claimable.length > 0) {
      claimable.forEach(m => {
        choices.push({
          text: `🎁 Reclamar: ${m.title} (+${m.reward.gold} oro)`,
          callback: () => {
            const reward = this.dailyMissions.claimReward(m.id);
            if (reward) {
              this.player.addGold(reward.gold);
              const uiScene = this.scene.get(SCENES.UI);
              if (uiScene && uiScene.showNotification) {
                uiScene.showNotification(`🎁 +${reward.gold} Oro (${m.title})`, '#f1c40f');
              }
              // Grant bonus branch point if applicable
              if (reward.branchBonus) {
                this.player.gainBranchXP(reward.branchBonus, 0);
                this.time.delayedCall(400, () => this._showStatAllocationDialog(reward.branchBonus));
              }
              SaveSystem.save(this.player.getSaveData());
            }
          }
        });
      });
      this.dialogueSystem.show('📋 Tablón de Misiones', lines, () => {
        this.dialogueSystem.showChoices('📋 Tablón de Misiones', '¿Qué deseas reclamar?', choices);
      });
    } else {
      lines.push(this.dailyMissions.allClaimed()
        ? '¡Felicidades! Completaste todas las misiones del día. 🏆'
        : 'Vuelve cuando completes una misión para reclamar tu recompensa.');
      this.dialogueSystem.show('📋 Tablón de Misiones', lines);
    }
  }

  _handleNPCDialogue(npc) {
    // Stop player movement
    this.player.body.setVelocity(0);
    this.player.anims.stop();
    this.player.setFrame(0);
    
    // Stop NPC movement
    npc.body.setVelocity(0);
    npc.anims.stop();
    npc.setFrame(0);
    // Face player
    if (npc.x < this.player.x) npc.setFlipX(false);
    else npc.setFlipX(true);

    if (npc.npcConfig.dialogueKey === 'tutorial') {
      this.dialogueSystem.show(npc.npcConfig.name, [
        '¡Hola viajero!',
        'Bienvenido a Gains & Goblins.',
        'Recuerda presionar L para registrar tus hábitos.',
        'Mientras más te esfuerces en el mundo real, ¡más fuerte te volverás aquí!',
        'Ve a hablar con el Herrero o el Sabio si buscas qué hacer.'
      ]);
    } 
    else if (npc.npcConfig.dialogueKey === 'shop') {
      this.dialogueSystem.show(npc.npcConfig.name, [
        '¡Saludos! He preparado algunas pociones frescas.',
        '¿Necesitas algo para tu próxima aventura?'
      ], () => {
        this.shopSystem.openShop(this.player);
      });
    }
    else if (npc.npcConfig.dialogueKey === 'smith') {
      this.dialogueSystem.show(npc.npcConfig.name, [
        '¡Aún estoy preparando mi fragua!',
        'Vuelve más adelante cuando tenga armas a la venta.'
      ]);
    }
    else if (npc.npcConfig.dialogueKey === 'quest') {
      const activeQuest = this.questSystem.getActiveQuest();
      
      if (activeQuest) {
        if (activeQuest.quest.state === QUEST_STATE.COMPLETE) {
          // Turn in quest
          this.dialogueSystem.show(npc.npcConfig.name, [
            `¡Ah! Veo que has completado la misión: ${activeQuest.quest.title}.`,
            'Aquí tienes tu recompensa. ¡Bien hecho!'
          ], () => {
            const reward = this.questSystem.claimReward(activeQuest.quest.id);
            if (reward && reward.gold) {
              this.player.addGold(reward.gold);
              const uiScene = this.scene.get(SCENES.UI);
              if (uiScene && uiScene.showNotification) {
                uiScene.showNotification(`+${reward.gold} Oro`, '#ffd700');
              }
            }
          });
        } else {
          // Quest in progress
          this.dialogueSystem.show(npc.npcConfig.name, [
            `Aún estás trabajando en: ${activeQuest.quest.title}.`,
            `Llevas ${activeQuest.progress} de ${activeQuest.quest.objective.required}.`,
            '¡Vuelve cuando hayas terminado!'
          ]);
        }
      } else {
        // Offer new quest
        const available = this.questSystem.getAvailableQuests();
        if (available.length > 0) {
          const q = available[0]; // Take first available
          const choices = [
            {
              text: 'Aceptar Misión',
              callback: () => {
                this.questSystem.startQuest(q.id);
                this.dialogueSystem.show(npc.npcConfig.name, ['¡Excelente! Ten cuidado ahí fuera.']);
              }
            },
            {
              text: 'Ahora no',
              callback: () => this.dialogueSystem.show(npc.npcConfig.name, ['Como quieras.'])
            }
          ];
          
          this.dialogueSystem.show(npc.npcConfig.name, [
            'Tengo una tarea para ti si te interesa.',
            `${q.title}: ${q.desc}`
          ], () => {
            this.dialogueSystem.showChoices(npc.npcConfig.name, '¿Aceptas el encargo?', choices);
          });
        } else {
          this.dialogueSystem.show(npc.npcConfig.name, [
            'No tengo más misiones para ti en este momento.',
            'Has sido de gran ayuda para la aldea.'
          ]);
        }
      }
    }
  }

  // ========================================================================
  //  MAP TRANSITIONS
  // ========================================================================
  _transitionToMap(targetMapId, targetSpawnId) {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    
    // Disable player input
    this.player.isDead = true; 
    
    // Auto-save before changing map
    SaveSystem.save(this.player.getSaveData());

    this.cameras.main.fadeOut(800, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.restart({ mapId: targetMapId, spawnId: targetSpawnId });
    });
  }

  // ========================================================================
  //  STAT ALLOCATION DIALOG (Fable-style)
  // ========================================================================
  _showStatAllocationDialog(branchKey) {
    const branch = BRANCHES[branchKey];
    if (!branch) return;
    if (!this.player.branchPoints[branchKey] || this.player.branchPoints[branchKey] <= 0) return;
    if (this.dialogueSystem.isActive) return; // Don't interrupt existing dialogue

    const choices = branch.stats.map(statDef => ({
      text: `${statDef.label} — ${statDef.desc}`,
      callback: () => {
        const applied = this.player.spendBranchPoint(branchKey, statDef.key);
        if (applied) {
          const uiScene = this.scene.get(SCENES.UI);
          if (uiScene && uiScene.showNotification) {
            uiScene.showNotification(`+1 ${statDef.label} (${statDef.desc})`, '#2ecc71');
          }
          SaveSystem.save(this.player.getSaveData());
          // If more points remain in this branch, show again
          if (this.player.branchPoints[branchKey] > 0) {
            this.time.delayedCall(300, () => this._showStatAllocationDialog(branchKey));
          }
        }
      }
    }));

    this.dialogueSystem.showChoices(
      `${branch.icon} ${branch.name}`,
      `¡Ganaste 1 punto de ${branch.name}! ¿Cómo lo distribuyes?`,
      choices
    );
  }
}
// Helper function defined outside class to avoid this-binding issues inside other methods if needed
function _getNearbyNPC() {
  return this._getNearbyNPC();
}
