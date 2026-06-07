import Phaser from 'phaser';
import Player from '../entities/Player.js';
import Enemy from '../entities/Enemy.js';
import NPC from '../entities/NPC.js';
import QuestSystem, { QUEST_STATE } from '../utils/QuestSystem.js';
import DialogueSystem from '../ui/DialogueSystem.js';
import ShopSystem from '../ui/ShopSystem.js';
import DailyMissionSystem from '../utils/DailyMissionSystem.js';
import { generateMap, getSpawnPoint, getEnemySpawns, getTransitions, getChestSpawns } from '../utils/MapGenerator.js';
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
    this.isPerformingAction = false;
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
    const zoneNames = { 'guild': 'Gremio de Héroes', 'deeproot': 'Deeproot', 'cueva_goblin': 'Cueva Goblin' };
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

    // ── Vision System (Cueva Goblin) ──
    if (this.mapId === 'cueva_goblin') {
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

    // ── Chests (aleatorios con cooldown) ──
    this._initChests();

    // ── New Systems ──
    this.questSystem = new QuestSystem(this.game);
    this.dialogueSystem = new DialogueSystem(this);
    this.shopSystem = new ShopSystem(this.game, this.dialogueSystem);
    this.dailyMissions = new DailyMissionSystem(this.game);

    // Track map visit for daily missions
    this.dailyMissions.trackVisit(this.mapId);

    // ── NPCs ──
    this.npcsGroup = this.add.group();
    
    if (this.mapId === 'guild') {
      // 1. Maestro (Center)
      const villager = new NPC(this, 30 * TILE_SIZE, 17 * TILE_SIZE, 'npc_villager', {
        name: 'Maestro',
        dialogueKey: 'tutorial',
        wanderRadius: 10
      });
      // 2. Recepcionista (Gym Front Desk)
      const receptionist = new NPC(this, 30 * TILE_SIZE, 8 * TILE_SIZE, 'npc_receptionist', {
        name: 'Recepcionista',
        dialogueKey: 'receptionist',
        wanderRadius: 0
      });
      // 3. Sabio (Library / Magic Zone)
      const alchemist = new NPC(this, 48 * TILE_SIZE, 9 * TILE_SIZE, 'npc_sage', {
        name: 'Librero Sabio',
        dialogueKey: 'sage_librarian',
        wanderRadius: 0
      });
      // 4. Entrenador de Fuerza (Weights Zone - Top Left)
      const coachStrength = new NPC(this, 8 * TILE_SIZE, 9 * TILE_SIZE, 'npc_coach_strength', {
        name: 'Entrenador de Fuerza',
        dialogueKey: 'coach_strength',
        wanderRadius: 5
      });
      // 5. Instructor de Cardio (Cardio Zone - Bottom Left)
      const coachCardio = new NPC(this, 8 * TILE_SIZE, 24 * TILE_SIZE, 'npc_coach_cardio', {
        name: 'Instructor de Cardio',
        dialogueKey: 'coach_cardio',
        wanderRadius: 5
      });
      // 6. Monje de Meditación (Meditation Zone - Bottom Right)
      const monk = new NPC(this, 50 * TILE_SIZE, 22 * TILE_SIZE, 'npc_monk', {
        name: 'Monje de Meditación',
        dialogueKey: 'coach_meditation',
        wanderRadius: 5
      });

      this.npcsGroup.add(villager);
      this.npcsGroup.add(receptionist);
      this.npcsGroup.add(alchemist);
      this.npcsGroup.add(coachStrength);
      this.npcsGroup.add(coachCardio);
      this.npcsGroup.add(monk);
    }
    this.physics.add.collider(this.npcsGroup, this.mapLayer);
    this.physics.add.collider(
      this.player, this.npcsGroup,
      (pl, npc) => this._onPlayerNPCCollide(pl, npc)
    );

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
      R: Phaser.Input.Keyboard.KeyCodes.R,
      SHIFT: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      H: Phaser.Input.Keyboard.KeyCodes.H,
      M: Phaser.Input.Keyboard.KeyCodes.M,
    });

    // Weapon switching
    this.cursors.ONE.on('down', () => {
      if (this.dialogueSystem && this.dialogueSystem.isActive) return;
      this.player.switchWeapon(WEAPONS.SWORD.key);
    });
    this.cursors.TWO.on('down', () => {
      if (this.dialogueSystem && this.dialogueSystem.isActive) return;
      this.player.switchWeapon(WEAPONS.BOW.key);
    });
    this.cursors.THREE.on('down', () => {
      if (this.dialogueSystem && this.dialogueSystem.isActive) return;
      this.player.switchWeapon(WEAPONS.MAGIC.key);
    });

    // Spells (Q, F and Ultimate R)
    this.cursors.Q.on('down', () => {
      if (this.dialogueSystem && this.dialogueSystem.isActive) return;
      this.player.castSpell('shield');
    });
    this.cursors.F.on('down', () => {
      if (this.dialogueSystem && this.dialogueSystem.isActive) return;
      this.player.castSpell('ghost_swords');
    });
    this.cursors.R.on('down', () => {
      if (this.dialogueSystem && this.dialogueSystem.isActive) return;
      this._activateUltimate();
    });

    // Dodge Roll (SHIFT)
    this.cursors.SHIFT.on('down', () => {
      if (this.dialogueSystem && this.dialogueSystem.isActive) return;
      this.player.dodgeRoll();
    });

    // Interact action (E key)
    this.cursors.E.on('down', () => {
      if (this.dialogueSystem && this.dialogueSystem.isActive) return;
      this._handleInteraction();
    });

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

    // ── Combat Indicators ──
    this.comboIndicator = this.add.graphics({ depth: 8 });
    this.trajectoryIndicator = this.add.graphics({ depth: 8 });

    // ── Events ──
    this.events.on('player-attack', this.handleAttack, this);
    this.events.on('player-spell', this.handleSpellcast, this);
    this.events.on('player-parry', this.handleParry, this);

    // Handle enemy deaths → give gold & track quests
    this.events.on('enemy-died', (enemy) => {
      let goldDrop = Phaser.Math.Between(1, 3);
      
      // Boss drop
      if (enemy.typeConfig.isBoss) {
        goldDrop = 150;
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

      // Sync HUD panel
      this._syncQuestsUI();

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

      // Add Vitality for physical exercises (strength / dexterity)
      if (activity.branch === 'strength' || activity.branch === 'dexterity') {
        const prevVit = this.player.vitality;
        this.player.vitality = Math.min(300, this.player.vitality + 100);
        this.game.events.emit('update-vitality', this.player.vitality);
        this.time.delayedCall(1500, () => {
          const ui = this.scene.get(SCENES.UI);
          if (ui && ui.showNotification) {
            ui.showNotification(`💪 ¡Energía Vital! +100 (${prevVit} ➔ ${this.player.vitality})`, '#2ecc71');
          }
        });
      }

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

      // Sync HUD panel
      this._syncQuestsUI();

      // Notify if all daily missions done
      if (this.dailyMissions.allClaimed()) {
        this.time.delayedCall(2000, () => {
          const ui = this.scene.get(SCENES.UI);
          if (ui && ui.showNotification) ui.showNotification('🏆 ¡Misiones del día completadas!', '#f1c40f');
        });
      }

      // Auto-save after activity
      SaveSystem.save(this.player.getSaveData(), { type: activityId, xpEarned: activity.xpReward });
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
      this.game.events.emit('update-vitality', this.player.vitality);
      this._syncQuestsUI();

      // Notify player of any unspent points from previous session
      const unspent = Object.entries(this.player.branchPoints).filter(([, v]) => v > 0);
      if (unspent.length > 0) {
        const uiScene = this.scene.get(SCENES.UI);
        if (uiScene && uiScene.showNotification) {
          uiScene.showNotification('¡Tienes puntos sin gastar! (TAB → Asignar)', '#f1c40f');
        }
      }
    });

    // ── Enemy respawn timer (60s for deeproot to avoid crowding, 30s for other maps) ──
    const respawnDelay = this.mapId === 'deeproot' ? 60000 : 30000;
    this._enemyRespawnTimer = this.time.addEvent({
      delay: respawnDelay,
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

    // Listen to online database updates
    this._characterSyncedListener = (e) => {
      const { character, blockedLevelUp, requiredStatValue, decayApplied } = e.detail;
      if (character && this.player) {
        this.player.level = character.level;
        
        // Sync stats
        this.player.stats = {
          strength: character.strength,
          resistance: character.resistance,
          dexterity: character.dexterity,
          speed: character.speed,
          intelligence: character.intelligence,
          maxMana: character.maxMana,
          willpower: character.willpower,
          charisma: character.charisma
        };
        
        this.player.xp = character.xp;
        this.player.gold = character.gold;
        this.player.moral = character.moral;
        this.player.inventory = character.inventory || [];
        this.player.branchPoints = character.branchPoints || { strength: 0, dexterity: 0, intelligence: 0, willpower: 0, vitality: 100 };
        if (this.player.branchPoints.vitality === undefined) {
          this.player.branchPoints.vitality = 100;
        }

        // Recalculate max HP and Mana
        this.player.maxHp = character.resistance * 10;
        this.player.maxMana = character.maxMana;
        
        // Emit events to update HUD UI
        this.game.events.emit('update-health', this.player.hp, this.player.maxHp);
        this.game.events.emit('update-mana', this.player.mana, this.player.maxMana);
        this.game.events.emit('update-stats', this.player.stats);
        this.game.events.emit('update-gold', this.player.gold);
        this.game.events.emit('update-xp', this.player.xp, this.player.level * 50, this.player.level);
        this.game.events.emit('update-inventory', this.player.inventory);
        this.game.events.emit('update-branch-points', { ...this.player.branchPoints });
        this.game.events.emit('update-vitality', this.player.vitality);
        this._syncQuestsUI();

        // Show notifications if applicable
        const uiScene = this.scene.get(SCENES.UI);
        if (uiScene && uiScene.showNotification) {
          if (decayApplied) {
            uiScene.showNotification("Tus stats bajaron 1 punto por falta de actividades esta semana.", "#e94560");
          }
          if (blockedLevelUp) {
            uiScene.showNotification(`Nivel bloqueado: sube todos tus atributos a ${requiredStatValue} para subir nivel.`, "#e94560");
          }
        }
      }
    };
    window.addEventListener('character-synced', this._characterSyncedListener);

    // Clean up event listener when scene shuts down
    this.events.once('shutdown', () => {
      window.removeEventListener('character-synced', this._characterSyncedListener);
    });
  }

  // ── UPDATE ──
  update() {
    if (this.isTransitioning) return;

    if (this.isPerformingAction) {
      this.player.body.setVelocity(0);
      this.player.anims.stop();
      return;
    }

    if (this.dialogueSystem && this.dialogueSystem.isActive) {
      this.player.body.setVelocity(0);
      this.player.anims.stop();
      switch (this.player.facing) {
        case 'down': this.player.setFrame(0); break;
        case 'left': this.player.setFrame(3); break;
        case 'right': this.player.setFrame(6); break;
        case 'up': this.player.setFrame(9); break;
      }
    } else {
      this.player.update(this.cursors);

      // Quick Items (Keyboard Hotkeys)
      if (this.cursors.H && Phaser.Input.Keyboard.JustDown(this.cursors.H)) {
        this.player.consumeItem('potion_hp');
      }
      if (this.cursors.M && Phaser.Input.Keyboard.JustDown(this.cursors.M)) {
        this.player.consumeItem('potion_mp');
      }
    }

    // Update vision eraser in Cueva Goblin
    if (this.visionEraser && this.mapId === 'cueva_goblin') {
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

    // Draw combat visual helpers
    this._drawComboIndicator();
    this._drawTrajectoryLine();
  }

  // ========================================================================
  //  COMBAT & SPELLS
  // ========================================================================
  handleAttack(data) {
    const { weapon, dir, origin, chargeTime, comboStep } = data;
    const isCharged = chargeTime > 800; // 0.8s charge

    if (weapon.key === WEAPONS.SWORD.key) {
      // Melee attack
      let damage = weapon.damage;
      let spriteKey = 'slash_effect';
      let scale = 1.3;
      let pushForce = 120;
      let stunTime = 0;
      
      const step = comboStep || 0;
      if (step === 1) {
        // Thrust combo
        damage = Math.ceil(damage * 1.25);
        scale = 1.6;
        pushForce = 85;
        const uiScene = this.scene.get(SCENES.UI);
        if (uiScene?.showNotification) uiScene.showNotification('⚔️ ¡Combo: Estocada! (+25%)', '#ffd700');
      } else if (step === 2) {
        // Overhead smash combo
        damage = Math.ceil(damage * 1.6);
        spriteKey = 'slash_flourish';
        scale = 2.0;
        pushForce = 250;
        stunTime = 1000; // 1s stun
        this.cameras.main.shake(150, 0.008);
        const uiScene = this.scene.get(SCENES.UI);
        if (uiScene?.showNotification) uiScene.showNotification('💥 ¡GOLPE DE MARTILLO! (+60% y Aturdir)', '#f1c40f');
      }

      if (isCharged) {
        damage = weapon.damage * 2;
        spriteKey = 'slash_flourish';
        scale = 2.2;
        pushForce = 220;
      }

      const slash = this.add.sprite(origin.x + dir.x * 16, origin.y + dir.y * 16, spriteKey);
      slash.setDepth(15);

      if (dir.x === 1) slash.setAngle(0);
      else if (dir.x === -1) slash.setAngle(180);
      else if (dir.y === 1) slash.setAngle(90);
      else if (dir.y === -1) slash.setAngle(-90);

      this.tweens.add({
        targets: slash,
        alpha: 0,
        scale: scale,
        duration: isCharged ? 250 : 150,
        onComplete: () => slash.destroy()
      });

      const size = 24 * scale;
      const hitbox = this.add.rectangle(slash.x, slash.y, size, size, 0xff0000, 0);
      this.physics.add.existing(hitbox);

      const collider = this.physics.add.overlap(hitbox, this.enemiesGroup, (box, enemy) => {
        // Thermal Explosion Reaction: Sword combo on Burning enemy
        const isBurning = this.time.now < enemy.burnTimer;
        if (step > 0 && isBurning) {
          enemy.burnTimer = 0; // clear burn state
          const bonusDamage = Math.ceil(damage * 1.25);
          enemy.takeDamage(bonusDamage, dir, 'sword');

          const uiScene = this.scene.get(SCENES.UI);
          if (uiScene?.showNotification) {
            uiScene.showNotification('🔥 ¡REACCIÓN: EXPLOSIÓN TÉRMICA! 🔥', '#e67e22');
          }

          // Extra impact visual and shake
          this.cameras.main.shake(150, 0.012);

          const fireExplosion = this.add.particles(0, 0, 'particle_gold', {
            speed: { min: 50, max: 200 },
            scale: { start: 1.5, end: 0 },
            blendMode: 'ADD',
            lifespan: 700,
            quantity: 30
          });
          fireExplosion.explode(30, enemy.x, enemy.y);
          this.time.delayedCall(1000, () => fireExplosion.destroy());

          // Splash damage + high knockback to nearby enemies (64px)
          this.enemiesGroup.getChildren().forEach(other => {
            if (other !== enemy && other.active && !other.isDead) {
              const d = Phaser.Math.Distance.Between(enemy.x, enemy.y, other.x, other.y);
              if (d < 64) {
                const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, other.x, other.y);
                const push = { x: Math.cos(angle), y: Math.sin(angle) };
                other.takeDamage(Math.ceil(damage * 0.75), push, 'sword');
                other.body.setVelocity(push.x * 300, push.y * 300);
              }
            }
          });
        } else {
          enemy.takeDamage(damage, dir, 'sword');
          enemy.body.setVelocity(dir.x * pushForce, dir.y * pushForce);
        }

        if (stunTime > 0) {
          enemy.isStunned = true;
          this.time.delayedCall(stunTime, () => {
            if (enemy && enemy.active) enemy.isStunned = false;
          });
        }
      });

      this.time.delayedCall(isCharged ? 200 : 100, () => {
        collider.destroy();
        hitbox.destroy();
      });

    } else if (weapon.key === WEAPONS.BOW.key) {
      const speedVal = this.player.stats.speed || 5;
      const chargeTarget = Math.max(400, 1000 - (speedVal - 5) * 50);
      const isPerfect = chargeTime >= chargeTarget * 0.8 && chargeTime <= chargeTarget * 1.2;
      const isOvercharged = chargeTime > chargeTarget * 1.5;
      
      let spriteKey = isPerfect ? 'arrow_charged' : 'arrow';
      let damage = weapon.damage;
      let speed = isPerfect ? 350 : 200;
      let spreadAngle = 0;
      
      const uiScene = this.scene.get(SCENES.UI);
      if (isPerfect) {
        damage = Math.ceil(damage * 1.5);
        if (uiScene?.showNotification) {
          uiScene.showNotification('🎯 ¡TIRO PERFECTO! +50% Daño', '#2ecc71');
        }
      } else if (isOvercharged) {
        damage = Math.ceil(damage * 0.5);
        speed = 120;
        const dexVal = this.player.stats.dexterity || 5;
        spreadAngle = Phaser.Math.FloatBetween(-0.25, 0.25) * Math.max(0.1, 5 / dexVal); // More Dex = less shake
        if (uiScene?.showNotification) {
          uiScene.showNotification('💨 Tiro Inestable (Sin fuerza)', '#e94560');
        }
      }

      const arrow = this.physics.add.sprite(origin.x, origin.y, spriteKey);
      arrow.setDepth(12);

      const baseAngle = dir.x === 1 ? 0 : dir.x === -1 ? Math.PI : dir.y === 1 ? Math.PI/2 : -Math.PI/2;
      const finalAngle = baseAngle + spreadAngle;
      arrow.setRotation(finalAngle);

      arrow.setVelocity(Math.cos(finalAngle) * speed, Math.sin(finalAngle) * speed);

      this.physics.add.collider(arrow, this.mapLayer, () => arrow.destroy());
      
      arrow.hitEnemies = new Set();
      this.physics.add.overlap(arrow, this.enemiesGroup, (arr, enemy) => {
        if (!arrow.hitEnemies.has(enemy)) {
          arrow.hitEnemies.add(enemy);

          // Shatter Reaction: Perfect arrow on Frozen enemy
          const isFrozen = this.time.now < enemy.frostTimer;
          if (isPerfect && isFrozen) {
            enemy.frostTimer = 0; // clear frost state
            const bonusDamage = Math.ceil(damage * 1.5);
            enemy.takeDamage(bonusDamage, dir, 'bow');
            enemy.body.setVelocity(Math.cos(finalAngle) * 200, Math.sin(finalAngle) * 200);

            const ui = this.scene.get(SCENES.UI);
            if (ui?.showNotification) {
              ui.showNotification('❄️ ¡REACCIÓN: SHATTER DE HIELO! ❄️', '#3498db');
            }

            // Ice shards explosion
            const iceExplosion = this.add.particles(0, 0, 'particle_purple', {
              speed: { min: 40, max: 150 },
              scale: { start: 1.2, end: 0 },
              blendMode: 'ADD',
              lifespan: 600,
              quantity: 25
            });
            iceExplosion.explode(25, enemy.x, enemy.y);
            this.time.delayedCall(1000, () => iceExplosion.destroy());

            // Splash damage to nearby enemies (48px)
            this.enemiesGroup.getChildren().forEach(other => {
              if (other !== enemy && other.active && !other.isDead) {
                const d = Phaser.Math.Distance.Between(enemy.x, enemy.y, other.x, other.y);
                if (d < 48) {
                  const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, other.x, other.y);
                  other.takeDamage(Math.ceil(damage * 0.75), { x: Math.cos(angle), y: Math.sin(angle) }, 'bow');
                }
              }
            });
          } else {
            enemy.takeDamage(isPerfect ? damage * 1.5 : damage, dir, 'bow');
            enemy.body.setVelocity(Math.cos(finalAngle) * (isPerfect ? 150 : 50), Math.sin(finalAngle) * (isPerfect ? 150 : 50));
          }

          if (!isPerfect) arr.destroy();
        }
      });

      this.time.delayedCall(isPerfect ? 2000 : 1500, () => { if (arrow.active) arrow.destroy() });

    } else if (weapon.key === WEAPONS.MAGIC.key) {
      const isAoE = chargeTime > 1000; // 1.0s charge
      
      if (isAoE) {
        // Explode outward (Ignition)
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
          enemy.takeDamage(weapon.damage * 2, pushDir, 'magic');
          enemy.body.setVelocity(pushDir.x * 250, pushDir.y * 250); // huge push

          // Apply Ignition (Burn status)
          enemy.burnTimer = this.time.now + 4000; // 4s burn DOT
          enemy.burnDamageTimer = this.time.now + 500;
        });
        
        this.cameras.main.shake(150, 0.01);
        this.time.delayedCall(150, () => {
          collider.destroy();
          hitbox.destroy();
        });
        
      } else {
        // Frost Bolt basic orb
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
          enemy.takeDamage(weapon.damage, dir, 'magic');

          // Apply Frost (Slow status)
          enemy.frostTimer = this.time.now + 5000; // 5s slow

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
        const cost = this.player.isUltimateActive ? 0 : 10;
        if (this.player.mana >= cost) {
          this.player.hasPhysicalShield = true;
          this.player.shieldActivatedAt = this.time.now;
          if (cost > 0) {
            this.player.mana -= cost;
            this.game.events.emit('update-mana', this.player.mana, this.player.maxMana);
          }
          
          this.player.shieldBubble = this.add.sprite(origin.x, origin.y, 'shield_bubble');
          this.player.shieldBubble.setDepth(20);
          
          if (uiScene && uiScene.showNotification) uiScene.showNotification('Escudo Físico Activado', '#4488ff');
        } else {
          if (uiScene && uiScene.showNotification) uiScene.showNotification('Sin maná para Escudo', '#e94560');
        }
      }
    } else if (spell === 'ghost_swords') {
      const cost = this.player.isUltimateActive ? 0 : 15;
      if (this.player.mana >= cost) {
        if (cost > 0) {
          this.player.mana -= cost;
          this.game.events.emit('update-mana', this.player.mana, this.player.maxMana);
        }
        if (uiScene && uiScene.showNotification) uiScene.showNotification('Espadas Fantasma', '#a8dcf7');
        
        if (!this.ghostSwords) {
          this.ghostSwords = this.physics.add.group();
          this.physics.add.overlap(this.ghostSwords, this.enemiesGroup, (sword, enemy) => {
            if (sword.active && enemy.active && enemy.hp > 0) {
              const dir = { x: Math.sign(enemy.x - sword.x), y: Math.sign(enemy.y - sword.y) };
              enemy.takeDamage(this.player._getScaledDamage(WEAPONS.MAGIC), dir, 'magic');
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
  //  CHEST SYSTEM
  // ========================================================================

  // Storage key for chest cooldowns across sessions
  _chestCooldownKey(mapId, x, y) {
    return `gg_chest_${mapId}_${x}_${y}`;
  }

  /**
   * Returns the set of valid floor tile types for chest placement in this map.
   */
  _getValidChestTiles() {
    if (this.mapId === 'cueva_goblin') return new Set([TILES.DUNGEON_FLOOR]);
    if (this.mapId === 'deeproot')     return new Set([TILES.GRASS, TILES.GRASS_FLOWER, TILES.DARK_GRASS, TILES.DIRT]);
    return new Set([TILES.GUILD_FLOOR]);
  }

  /**
   * Places chests dynamically. Positions are PERSISTED in localStorage so
   * reloading the page keeps the same spots (and their individual cooldowns).
   * Positions are regenerated only when all saved spots become invalid tiles.
   */
  _initChests() {
    const CHEST_COUNT = { guild: 4, deeproot: 6, cueva_goblin: 5 };
    const count = CHEST_COUNT[this.mapId] || 5;
    const posKey = `gg_chest_pos_${this.mapId}`;
    const validTiles = this._getValidChestTiles();

    // Try to reuse saved positions (so reloading respects cooldowns)
    let spawns = null;
    try {
      const raw = localStorage.getItem(posKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.length >= count) {
          spawns = parsed;
          // Force floor tiles at these positions to avoid wall conflicts
          const floorTile = this.mapId === 'cueva_goblin' ? TILES.DUNGEON_FLOOR
                          : this.mapId === 'deeproot'      ? TILES.GRASS
                          : TILES.GUILD_FLOOR;
          spawns.forEach(({ x, y }) => {
            if (this._mapData[y] && this._mapData[y][x] !== undefined) {
              this._mapData[y][x] = floorTile;
            }
          });
        }
      }
    } catch (e) { /* ignore parse errors */ }

    if (!spawns) {
      // Generate fresh positions and persist them
      spawns = getChestSpawns(this.mapId, this._mapData, count);
      try { localStorage.setItem(posKey, JSON.stringify(spawns)); } catch (e) {}
    }

    this._chestPositions = [];
    spawns.forEach(({ x, y }) => {
      const key = this._chestCooldownKey(this.mapId, x, y);
      const cooldownUntil = parseInt(localStorage.getItem(key) || '0', 10);
      if (Date.now() >= cooldownUntil) {
        this._mapData[y][x] = TILES.CHEST;
        this.mapLayer.putTileAt(TILES.CHEST, x, y);
        this._chestPositions.push({ x, y });
      }
      // On cooldown: leave as floor (generator already set it)
    });
  }

  /**
   * Handles opening a chest tile.
   * Grants gold (guild: 50-100, deeproot: 40-80, cueva_goblin: 80-150)
   * and starts 20-minute respawn cooldown stored in localStorage.
   */
  _handleChestOpen(tileX, tileY) {
    const goldAmount = 20;

    this.player.addGold(goldAmount);

    const uiScene = this.scene.get(SCENES.UI);
    if (uiScene && uiScene.showNotification) {
      uiScene.showNotification(`✨ ¡Cofre! +${goldAmount} Oro`, '#ffd700');
    }

    // Replace chest tile with appropriate floor
    const floorTile = this.mapId === 'cueva_goblin' ? TILES.DUNGEON_FLOOR
                    : this.mapId === 'deeproot'      ? TILES.GRASS
                    : TILES.GUILD_FLOOR;
    this._mapData[tileY][tileX] = floorTile;
    this.mapLayer.putTileAt(floorTile, tileX, tileY);

    // Start 20-minute cooldown
    const COOLDOWN_MS = 20 * 60 * 1000; // 20 minutes
    const cooldownUntil = Date.now() + COOLDOWN_MS;
    const key = this._chestCooldownKey(this.mapId, tileX, tileY);
    localStorage.setItem(key, String(cooldownUntil));

    // Schedule visual re-spawn if the player stays in the map that long
    this.time.delayedCall(COOLDOWN_MS, () => {
      if (!this.scene.isActive(SCENES.WORLD)) return;
      if (this._mapData[tileY][tileX] !== floorTile && this._mapData[tileY][tileX] !== TILES.CHEST) return;
      // Remove cooldown key so a page reload ALSO shows the chest
      localStorage.removeItem(key);
      this._mapData[tileY][tileX] = TILES.CHEST;
      this.mapLayer.putTileAt(TILES.CHEST, tileX, tileY);
      if (uiScene && uiScene.showNotification) {
        uiScene.showNotification('📦 ¡Un cofre ha reaparecido cerca!', '#c4a35a');
      }
    });

    // Gold sparkle effect
    const particles = this.add.particles(0, 0, 'particle_gold', {
      speed: { min: 20, max: 60 },
      scale: { start: 1, end: 0 },
      lifespan: 600,
      quantity: 12
    });
    particles.explode(12, tileX * TILE_SIZE + 8, tileY * TILE_SIZE + 8);

    SaveSystem.save(this.player.getSaveData());
  }

  // ========================================================================
  //  NPC PUSH / MORAL SYSTEM
  // ========================================================================

  /**
   * Called every frame the player overlaps with an NPC.
   * Debounced and windowed: 2 bumps within 8 s triggers a scolding.
   */
  _onPlayerNPCCollide(player, npc) {
    const now     = this.time.now;
    const DEBOUNCE     = 900;   // min ms between counted bumps
    const WINDOW       = 8000;  // time window for 2 bumps to count
    const SCOLD_PAUSE  = 7000;  // silence period after a scolding

    // Still in post-scold cooldown
    if (now - npc._scoldedAt < SCOLD_PAUSE) return;
    // Too soon after last bump
    if (now - npc._lastBumpTime < DEBOUNCE) return;

    // Reset window if too much time passed since first bump
    if (now - npc._firstBumpTime > WINDOW) {
      npc._bumpCount    = 0;
      npc._firstBumpTime = now;
    }

    npc._bumpCount++;
    npc._lastBumpTime = now;

    if (npc._bumpCount >= 2) {
      npc._bumpCount = 0;
      npc._scoldedAt = now;
      this._scoldPlayerByNPC(npc);
    }
  }

  /**
   * NPC scolding dialogue + moral penalty.
   */
  _scoldPlayerByNPC(npc) {
    if (this.dialogueSystem.isActive) return;

    const DIALOGUES = {
      tutorial: [
        '¡Oye! ¿Qué te pasa? ¡Para de empujarme!',
        'Ese comportamiento no es digno de un héroe.',
        'El Gremio espera más de ti. Tu reputación ha caído.',
      ],
      smith: [
        '¡Dos veces! ¡La próxima te aplano con el martillo!',
        'Los héroes de verdad no molestan a los artesanos.',
        'Me haré el sordo cuando pidas armas nuevas...',
      ],
      shop: [
        '¡Empújame otra vez y no te vendo ni agua!',
        'Compro y vendo a gente de bien, no a rufianes.',
        'Tu nombre empieza a sonar mal en el mercado.',
      ],
    };

    const lines = DIALOGUES[npc.npcConfig.dialogueKey] ?? [
      '¡Deja de empujarme!',
      'Ese comportamiento tiene consecuencias.',
      'Tu alineación moral ha caído.',
    ];

    // Stop player and face the NPC
    this.player.body.setVelocity(0);
    this.dialogueSystem.show(npc.npcConfig.name, lines);

    // Apply moral penalty
    this.player.addMoral(-10);

    // Dark screen flash
    this.cameras.main.flash(350, 30, 0, 0);

    const uiScene = this.scene.get(SCENES.UI);
    if (uiScene?.showNotification) {
      const moralVal = this.player.moral;
      const sign  = moralVal >= 0 ? '+' : '';
      const label = moralVal >= 50  ? 'Heroíco 🌟'
                  : moralVal >= 10  ? 'Bueno ✨'
                  : moralVal >= -10 ? 'Neutral ⚖️'
                  : moralVal >= -50 ? 'Oscuro ⚫'
                  :                   'Malévolo 💀';
      uiScene.showNotification(
        `⚫ Reputación: ${sign}${moralVal} — ${label}`,
        '#777777'
      );
    }
  }

  // ========================================================================
  //  ENEMY SPAWNING / RESPAWN
  // ========================================================================
  _spawnEnemies() {
    this._enemySpawnData.forEach(spawn => {
      let level = 1;
      if (this.mapId === 'guild' && this.player) {
        level = this.player.level;
      } else if (this.mapId === 'cueva_goblin') {
        level = 2;
      }
      const enemy = new Enemy(this, spawn.x * TILE_SIZE, spawn.y * TILE_SIZE, spawn.type, level);
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
        let level = 1;
        if (this.mapId === 'guild' && this.player) {
          level = this.player.level;
        } else if (this.mapId === 'cueva_goblin') {
          level = 2;
        }
        const enemy = new Enemy(this, spawn.x * TILE_SIZE, spawn.y * TILE_SIZE, spawn.type, level);
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
    // Check standing tile first (for meditation mats)
    let standX = Math.floor(this.player.x / TILE_SIZE);
    let standY = Math.floor(this.player.y / TILE_SIZE);
    if (standX >= 0 && standX < MAP_WIDTH && standY >= 0 && standY < MAP_HEIGHT) {
      const standTileType = this._mapData[standY][standX];
      if (standTileType === TILES.MEDITATION_MAT) {
        return { x: standX, y: standY, tileType: standTileType };
      }
    }

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
    if (tile && (tile.tileType === TILES.CHEST || tile.tileType === TILES.SIGN || tile.tileType === TILES.BULLETIN_BOARD || tile.tileType === TILES.BOOKSHELF || tile.tileType === TILES.MEDITATION_MAT || tile.tileType === TILES.STUDY_TABLE)) {
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
      this._handleChestOpen(tile.x, tile.y);

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
      const receptionist = this.npcsGroup.getChildren().find(n => n.npcConfig?.dialogueKey === 'receptionist');
      if (receptionist) {
        this._handleNPCDialogue(receptionist);
      } else {
        this._showDailyMissionsBoard();
      }
    } else if (tile.tileType === TILES.BOOKSHELF || tile.tileType === TILES.STUDY_TABLE) {
      this._handleStudyTableOpen(tile.x, tile.y);
    } else if (tile.tileType === TILES.MEDITATION_MAT) {
      this._handleMeditationMatOpen(tile.x, tile.y);
    }
  }

  _handleStudyTableOpen(tileX, tileY) {
    const lines = [
      '📚 MESA DE ESTUDIO',
      'Frente a ti se encuentra el Grimorio del Gremio con antiguos conocimientos mágicos.',
      '🌟 "Ser sincero y disciplinado lleva a que seas una verdadera leyenda. La acción de meditar o leer realmente depende de tu propio compromiso en el mundo real. ¡Conviértete en leyenda entrenando de verdad!"',
      '¿Deseas sentarte a estudiar para aumentar tu nivel de magia?',
      '⚠️ Estudiar consume 20 de Vitalidad (⚡) y toma 10 segundos de concentración.'
    ];

    const choices = [
      {
        text: 'Comenzar a Estudiar (10s)',
        callback: () => {
          this._startActivityProgress('study', 'intelligence', '#9b59b6', 'Estudio');
        }
      },
      {
        text: 'Cancelar',
        callback: () => {}
      }
    ];

    this.dialogueSystem.show('📚 Mesa de Estudio', lines, () => {
      this.dialogueSystem.showChoices('📚 Mesa de Estudio', '¿Qué deseas hacer?', choices);
    });
  }

  _handleMeditationMatOpen(tileX, tileY) {
    const lines = [
      '🧘 TAPETE DE MEDITACIÓN',
      'Un lugar tranquilo, perfumado con incienso silvestre, ideal para calmar la mente.',
      '🌟 "Ser sincero y disciplinado lleva a que seas una verdadera leyenda. La acción de meditar o leer realmente depende de tu propio compromiso en el mundo real. ¡Conviértete en leyenda entrenando de verdad!"',
      '¿Deseas comenzar una meditación guiada para canalizar tu fuerza de voluntad?',
      '⚠️ Meditar consume 20 de Vitalidad (⚡) y toma 10 segundos de paz interior.'
    ];

    const choices = [
      {
        text: 'Comenzar a Meditar (10s)',
        callback: () => {
          this._startActivityProgress('meditation', 'willpower', '#1abc9c', 'Meditación');
        }
      },
      {
        text: 'Cancelar',
        callback: () => {}
      }
    ];

    this.dialogueSystem.show('🧘 Tapete de Meditación', lines, () => {
      this.dialogueSystem.showChoices('🧘 Tapete de Meditación', '¿Qué deseas hacer?', choices);
    });
  }

  _startActivityProgress(activityId, branchKey, particleColorHex, activityName) {
    const uiScene = this.scene.get(SCENES.UI);
    
    // Check vitality
    if (this.player.vitality < 20) {
      this.dialogueSystem.show(
        '❌ Sin Energía',
        [
          '¡Tu cuerpo y mente están fatigados!',
          'Para asimilar nuevos conocimientos o canalizar tu poder mental, necesitas Energía Vital activa.',
          '¡Sal a hacer ejercicio físico en la vida real (Fuerza o Cardio) y regístralo para recargar tu Vitalidad!'
        ]
      );
      return;
    }

    // Freeze player and start action
    this.isPerformingAction = true;
    this.player.body.setVelocity(0);
    this.player.anims.stop();
    
    // Face down for front stance
    this.player.facing = 'down';
    this.player.setFrame(0);

    // Progress bar UI in Phaser
    const progressBg = this.add.rectangle(this.player.x, this.player.y - 20, 32, 6, 0x000000).setDepth(20);
    const progressBar = this.add.rectangle(this.player.x - 16, this.player.y - 20, 0, 6, parseInt(particleColorHex.replace('#', '0x'))).setOrigin(0, 0.5).setDepth(20);

    // Particles
    const particles = this.add.particles(0, 0, 'particle_gold', {
      x: { min: -12, max: 12 },
      y: { min: -18, max: 8 },
      speed: { min: 10, max: 30 },
      scale: { start: 1, end: 0 },
      lifespan: 800,
      quantity: 1,
      frequency: 150,
      blendMode: 'ADD'
    });
    particles.startFollow(this.player);

    if (uiScene && uiScene.showNotification) {
      uiScene.showNotification(`Comenzando ${activityName}...`, particleColorHex);
    }

    // Tween for progress bar
    this.tweens.add({
      targets: progressBar,
      width: 32,
      duration: 10000,
      onComplete: () => {
        // Cleanup
        progressBg.destroy();
        progressBar.destroy();
        particles.destroy();
        this.isPerformingAction = false;

        // Apply results
        this.player.vitality -= 20;
        this.player.gainBranchXP(branchKey, 50);

        // Notify
        this.game.events.emit('update-vitality', this.player.vitality);
        if (uiScene && uiScene.showNotification) {
          uiScene.showNotification(`¡${activityName} completado! -20 Vitalidad`, '#2ecc71');
        }

        // Show stat allocation popup
        this.time.delayedCall(600, () => {
          this._showStatAllocationDialog(branchKey);
        });

        // Save progress
        SaveSystem.save(this.player.getSaveData());
      }
    });
  }

  _syncQuestsUI() {
    // 1. Dailies accepted and not claimed
    const activeDailies = this.dailyMissions.getMissions().filter(m => m.accepted && !m.claimed);

    // 2. Active main quests
    const activeMains = [];
    for (const [id, q] of this.questSystem.quests.entries()) {
      if (q.state === 'active' || q.state === 'complete') {
        activeMains.push({
          ...q,
          progress: this.questSystem.questProgress.get(id) || 0
        });
      }
    }

    this.game.events.emit('update-quests', activeDailies, activeMains);
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
      
      let status = '';
      if (m.claimed) {
        status = '✅ Reclamada';
      } else if (m.completed) {
        status = '🎁 ¡Completada! (Reclámala abajo)';
      } else if (m.accepted) {
        status = `⚔️ Activa: ${progress}`;
      } else {
        status = '📌 Disponible';
      }

      lines.push(`${i + 1}. ${m.title}: ${status}`);
      lines.push(`   ${m.desc}`);
      const rewardText = `${m.reward.gold} oro${m.reward.branchBonus ? ' + 1 punto extra' : ''}`;
      lines.push(`   Recompensa: ${rewardText}`);
    });

    // Accept choices
    const available = missions.filter(m => !m.accepted);
    available.forEach(m => {
      choices.push({
        text: `📌 Aceptar: ${m.title}`,
        callback: () => {
          this.dailyMissions.acceptMission(m.id);
          this._syncQuestsUI();
          SaveSystem.save(this.player.getSaveData());
          // Redraw board
          this.time.delayedCall(500, () => this._showDailyMissionsBoard());
        }
      });
    });

    // Claim choices
    const claimable = missions.filter(m => m.completed && !m.claimed);
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
            if (reward.branchBonus) {
              this.player.gainBranchXP(reward.branchBonus, 0);
              this.time.delayedCall(400, () => this._showStatAllocationDialog(reward.branchBonus));
            }
            this._syncQuestsUI();
            SaveSystem.save(this.player.getSaveData());
            this.time.delayedCall(800, () => this._showDailyMissionsBoard());
          }
        }
      });
    });

    choices.push({
      text: '❌ Salir',
      callback: () => {}
    });

    this.dialogueSystem.show('📋 Tablón de Misiones', lines, () => {
      this.dialogueSystem.showChoices('📋 Tablón de Misiones', '¿Qué deseas hacer?', choices);
    });
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
        'Habla con la Recepcionista si buscas misiones o suministros.'
      ]);
    } 
    else if (npc.npcConfig.dialogueKey === 'receptionist') {
      const choices = [
        {
          text: 'Ver Tabla de Misiones (Registro)',
          callback: () => {
            this._showDailyMissionsBoard();
          }
        },
        {
          text: 'Comprar Suministros (Agua / Café)',
          callback: () => {
            this.shopSystem.openShop(this.player);
          }
        },
        {
          text: 'Salir',
          callback: () => {}
        }
      ];

      this.dialogueSystem.show(npc.npcConfig.name, [
        '¡Hola! Bienvenido a la recepción del Gremio.',
        'Aquí puedes registrar tus misiones diarias o comprar suministros para entrenar.',
        '¿En qué te puedo ayudar hoy?'
      ], () => {
        this.dialogueSystem.showChoices(npc.npcConfig.name, '¿Qué deseas hacer?', choices);
      });
    }
    else if (npc.npcConfig.dialogueKey === 'sage_librarian') {
      const tips = [
        '¡Saludos, joven mente! Para asimilar mejor la lectura, lee en bloques de 25 minutos y toma notas breves. ¡La mente también se entrena!',
        'El conocimiento es el músculo del cerebro. Asegúrate de leer libros que desafíen tu intelecto. ¡Sube tu nivel de magia leyendo de verdad!',
        'La meditación limpia el canal, pero la lectura aporta los hechizos. Intenta leer sin distracciones, apaga tu celular por 20 minutos.'
      ];
      const tip = Phaser.Utils.Array.GetRandom(tips);
      this.dialogueSystem.show(npc.npcConfig.name, [
        'Hola. Esta es la biblioteca mágica del Gremio.',
        'Recuerda que la sabiduría mental complementa la fuerza física.',
        `💡 Consejo de lectura: ${tip}`
      ]);
    }
    else if (npc.npcConfig.dialogueKey === 'coach_strength') {
      const tips = [
        '¡Arriba esa barra! Recuerda calentar tus articulaciones antes de levantar peso pesado. La técnica es 100 veces más importante que el peso.',
        'Mantén la espalda recta en el peso muerto. Si redondeas la columna, te arriesgas a una lesión. ¡Entrena con disciplina y cuida tu cuerpo!',
        'El músculo crece en el descanso y la nutrición. No entrenes el mismo grupo todos los días; dale al menos 48 horas de recuperación.'
      ];
      const tip = Phaser.Utils.Array.GetRandom(tips);
      this.dialogueSystem.show(npc.npcConfig.name, [
        '¡Hey! ¡Espero que estés listo para machacar esos fierros hoy!',
        'En la zona de pesas construimos la fuerza bruta necesaria para blandir espadas pesadas.',
        `🏋️ Consejo de fuerza: ${tip}`
      ]);
    }
    else if (npc.npcConfig.dialogueKey === 'coach_cardio') {
      const tips = [
        '¡Mantén el ritmo en la bicicleta! El cardio mejora tu resistencia cardiovascular y acelera la recuperación entre series. ¡Destreza al máximo!',
        'No olvides hidratarte constantemente mientras corres. Si sientes dolor punzante en el pecho o mareo, detente de inmediato. ¡Salud ante todo!',
        'Comienza con un trote suave de 5 minutos antes de sprinting. El calentamiento previene desgarres musculares. ¡Vamos por esos kilómetros!'
      ];
      const tip = Phaser.Utils.Array.GetRandom(tips);
      this.dialogueSystem.show(npc.npcConfig.name, [
        '¡Hola! ¡A sudar un poco en las bicicletas de cardio!',
        'Aquí entrenamos tu destreza, agilidad y velocidad de ataque.',
        `🏃 Consejo de cardio: ${tip}`
      ]);
    }
    else if (npc.npcConfig.dialogueKey === 'coach_meditation') {
      const tips = [
        'Respira hondo... Siente el aire entrar y salir. La meditación no se trata de dejar la mente vacía, sino de observar tus pensamientos sin juzgar.',
        'Si tu mente se distrae (y lo hará), simplemente regresa tu atención suavemente a la respiración. Esa es la verdadera repetición mental.',
        'Cinco minutos de meditación diaria consciente valen más que una hora de meditación forzada una vez al mes. La consistencia es la clave.'
      ];
      const tip = Phaser.Utils.Array.GetRandom(tips);
      this.dialogueSystem.show(npc.npcConfig.name, [
        'Namasté. Bienvenido a la zona de meditación y yoga.',
        'Aquí calmas tu mente y aumentas tu fuerza de voluntad.',
        `🧘 Consejo de meditación: ${tip}`
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

  _activateUltimate() {
    const time = this.time.now;
    if (this.player.ultimateCooldown && time < this.player.ultimateCooldown + 60000) {
      const remaining = Math.ceil((this.player.ultimateCooldown + 60000 - time) / 1000);
      const uiScene = this.scene.get(SCENES.UI);
      if (uiScene?.showNotification) {
        uiScene.showNotification(`Definitiva en enfriamiento (${remaining}s)`, '#8b8b8b');
      }
      return;
    }
    
    if (!this.player.hasLoggedActivityToday()) {
      const uiScene = this.scene.get(SCENES.UI);
      if (uiScene?.showNotification) {
        uiScene.showNotification('¡Necesitas registrar hábitos hoy!', '#e94560');
      }
      return;
    }

    this.player.isUltimateActive = true;
    this.player.ultimateActivatedAt = time;
    this.player.ultimateCooldown = time;
    
    const uiScene = this.scene.get(SCENES.UI);
    if (uiScene?.showNotification) {
      uiScene.showNotification('🌟 ¡RÁFAGA DE DISCIPLINA! 🌟', '#ffd700');
    }
    this.cameras.main.flash(400, 255, 215, 0);

    // Aura particles
    this.ultimateParticles = this.add.particles(0, 0, 'particle_gold', {
      speed: { min: 20, max: 50 },
      scale: { start: 1, end: 0 },
      blendMode: 'ADD',
      lifespan: 600,
      frequency: 40,
      quantity: 1
    });
    this.ultimateParticles.startFollow(this.player);

    this.time.delayedCall(15000, () => {
      this.player.isUltimateActive = false;
      if (this.ultimateParticles) {
        this.ultimateParticles.destroy();
        this.ultimateParticles = null;
      }
      const ui = this.scene.get(SCENES.UI);
      if (ui?.showNotification) {
        ui.showNotification('Definitiva terminada', '#8b8b8b');
      }
    });
  }

  _drawComboIndicator() {
    this.comboIndicator.clear();
    if (this.player.isDead || this.player.currentWeaponKey !== WEAPONS.SWORD.key) return;

    const cooldown = this.player.getAttackCooldown();
    const resVal = this.player.stats.resistance || 5;
    const comboWindow = 600 + (resVal - 5) * 40;
    const elapsed = this.time.now - this.player.lastAttackTime;

    if (elapsed < cooldown + comboWindow) {
      const px = this.player.x;
      const py = this.player.y + 14;
      
      this.comboIndicator.fillStyle(0x000000, 0.6);
      this.comboIndicator.fillRect(px - 10, py, 20, 3);

      if (elapsed < cooldown) {
        const pct = elapsed / cooldown;
        this.comboIndicator.fillStyle(0xe74c3c, 1);
        this.comboIndicator.fillRect(px - 10, py, 20 * pct, 3);
      } else {
        const alpha = Math.sin(this.time.now * 0.05) > 0 ? 1 : 0.6;
        this.comboIndicator.fillStyle(0x2ecc71, alpha);
        this.comboIndicator.fillRect(px - 10, py, 20, 3);
        
        this.comboIndicator.lineStyle(1, 0xffffff, alpha);
        this.comboIndicator.strokeRect(px - 11, py - 1, 22, 5);
      }
    }
  }

  _drawTrajectoryLine() {
    this.trajectoryIndicator.clear();
    if (this.player.isDead || !this.player.isCharging || this.player.currentWeaponKey !== WEAPONS.BOW.key) return;

    const chargeDur = this.time.now - this.player.chargeStartTime;
    const speedVal = this.player.stats.speed || 5;
    const chargeTarget = Math.max(400, 1000 - (speedVal - 5) * 50);

    let color = 0x888888;
    let alpha = 0.5;
    let isPerfect = false;
    let isOvercharged = false;

    if (chargeDur >= chargeTarget * 0.8 && chargeDur <= chargeTarget * 1.2) {
      color = 0x2ecc71;
      alpha = 0.9;
      isPerfect = true;
    } else if (chargeDur > chargeTarget * 1.2 && chargeDur <= chargeTarget * 1.5) {
      color = 0xff8c00;
      alpha = 0.7;
    } else if (chargeDur > chargeTarget * 1.5) {
      color = 0xff0000;
      alpha = 0.8;
      isOvercharged = true;
    }

    let ox = 0, oy = 0;
    if (this.player.facing === 'left') ox = -1;
    if (this.player.facing === 'right') ox = 1;
    if (this.player.facing === 'up') oy = -1;
    if (this.player.facing === 'down') oy = 1;

    const maxLen = isPerfect ? 120 : (isOvercharged ? 60 : Math.min(100, (chargeDur / chargeTarget) * 100));

    this.trajectoryIndicator.lineStyle(1.5, color, alpha);
    
    let startX = this.player.x;
    let startY = this.player.y;
    let endX = startX + ox * maxLen;
    let endY = startY + oy * maxLen;

    if (isOvercharged) {
      const jitterX = Math.sin(this.time.now * 0.2) * 4;
      const jitterY = Math.cos(this.time.now * 0.2) * 4;
      endX += jitterX;
      endY += jitterY;
    }

    this.trajectoryIndicator.lineBetween(startX, startY, endX, endY);
    
    this.trajectoryIndicator.fillStyle(color, alpha);
    this.trajectoryIndicator.fillCircle(endX, endY, isPerfect ? 3 : 2);
  }

  handleParry(data) {
    const { origin, amount } = data;
    const uiScene = this.scene.get(SCENES.UI);
    if (uiScene?.showNotification) {
      uiScene.showNotification('🛡️ ¡PARRY PERFECTO! Contraataque', '#ffd700');
    }

    // Visual parry flash and shake
    this.cameras.main.flash(200, 255, 215, 0);
    this.cameras.main.shake(150, 0.005);

    // Blast graphics
    const blast = this.add.circle(origin.x, origin.y, 10, 0xffd700, 0.6);
    this.tweens.add({
      targets: blast,
      radius: 64,
      alpha: 0,
      duration: 350,
      onComplete: () => blast.destroy()
    });

    // Stun and damage surrounding enemies (64px radius)
    this.enemiesGroup.getChildren().forEach(enemy => {
      if (!enemy.active || enemy.isDead) return;
      const dist = Phaser.Math.Distance.Between(origin.x, origin.y, enemy.x, enemy.y);
      if (dist < 64) {
        const angle = Phaser.Math.Angle.Between(origin.x, origin.y, enemy.x, enemy.y);
        const pushDir = { x: Math.cos(angle), y: Math.sin(angle) };
        
        enemy.takeDamage(amount * 2, pushDir, 'parry');
        enemy.body.setVelocity(pushDir.x * 220, pushDir.y * 220);
        
        enemy.isStunned = true;
        this.time.delayedCall(1500, () => {
          if (enemy && enemy.active) enemy.isStunned = false;
        });
      }
    });
  }
}
// Helper function defined outside class to avoid this-binding issues inside other methods if needed
function _getNearbyNPC() {
  return this._getNearbyNPC();
}
