import Phaser from 'phaser';

const STATES = {
  IDLE: 'IDLE',
  PATROL: 'PATROL',
  CHASE: 'CHASE',
  ATTACK: 'ATTACK',
  HURT: 'HURT',
  DEAD: 'DEAD'
};

export default class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, typeConfig) {
    const key = `enemy_${typeConfig.name.toLowerCase()}`;
    super(scene, x, y, key);
    
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.typeConfig = typeConfig;
    this.hp = typeConfig.hp;
    this.maxHp = typeConfig.hp;
    this.damage = typeConfig.damage;
    this.xpReward = typeConfig.xp;
    this.speed = typeConfig.speed;
    this.aggroRange = typeConfig.aggroRange;
    this.patrolRange = typeConfig.patrolRange;

    this.body.setSize(this.typeConfig.size, this.typeConfig.size);
    this.setDepth(10);

    this.spawnPoint = { x, y };
    this.state = STATES.IDLE;
    this.stateTimer = 0;
    
    this.lastAttackTime = 0;
    this.lastAbilityTime = 0;

    // Health bar
    this.healthBarBg = scene.add.rectangle(x, y - 12, 16, 3, 0x000000).setDepth(11);
    this.healthBar = scene.add.rectangle(x - 8, y - 12, 16, 3, 0xff0000).setOrigin(0, 0.5).setDepth(11);
    this.healthBarBg.setVisible(false);
    this.healthBar.setVisible(false);
    
    // Tint based on config color if needed, or rely on generated sprite
    this.setTint(typeConfig.color);
  }

  update(player) {
    if (this.state === STATES.DEAD) return;

    // Update health bar position
    this.healthBarBg.x = this.x;
    this.healthBarBg.y = this.y - 12;
    this.healthBar.x = this.x - 8;
    this.healthBar.y = this.y - 12;

    const distToPlayer = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    const time = this.scene.time.now;

    if (this.typeConfig.isBoss && time > this.lastAbilityTime + 6000 && this.state !== STATES.IDLE) {
      this.lastAbilityTime = time;
      // 50% chance to spawn slimes, 50% chance to jump attack
      if (Math.random() > 0.5) {
        // Spawn 2 Slimes
        this.scene.game.events.emit('show-notification', '¡El Rey invoca súbditos!', '#ff9900');
        for (let i = 0; i < 2; i++) {
          const spawnX = this.x + Phaser.Math.Between(-30, 30);
          const spawnY = this.y + Phaser.Math.Between(-30, 30);
          const slime = new this.constructor(this.scene, spawnX, spawnY, this.scene.ENEMIES ? this.scene.ENEMIES.SLIME : { name: 'Slime', hp: 20, damage: 3, speed: 40, xp: 10, color: 0x4caf50, size: 12, aggroRange: 80, patrolRange: 60 });
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
        if (distToPlayer < this.aggroRange) {
          this.state = STATES.CHASE;
        }
        break;

      case STATES.PATROL:
        if (time > this.stateTimer || Phaser.Math.Distance.Between(this.x, this.y, this.spawnPoint.x, this.spawnPoint.y) > this.patrolRange) {
          this.state = STATES.IDLE;
          this.stateTimer = time + Phaser.Math.Between(1000, 2000);
        }
        if (distToPlayer < this.aggroRange) {
          this.state = STATES.CHASE;
        }
        break;

      case STATES.CHASE:
        if (distToPlayer > this.aggroRange * 1.5) {
          this.state = STATES.IDLE;
        } else if (distToPlayer < 20) {
          this.state = STATES.ATTACK;
        } else {
          this.scene.physics.moveToObject(this, player, this.speed);
        }
        break;

      case STATES.ATTACK:
        this.body.setVelocity(0);
        if (distToPlayer > 24 && !this.typeConfig.isBoss) {
          this.state = STATES.CHASE;
        } else if (distToPlayer > 50 && this.typeConfig.isBoss) {
          this.state = STATES.CHASE; // Boss has bigger attack range due to dash
        } else if (time > this.lastAttackTime + 1000) {
          this.lastAttackTime = time;
          player.takeDamage(this.damage);
          
          // Attack animation bump
          this.scene.tweens.add({
            targets: this,
            scale: 1.2,
            duration: 100,
            yoyo: true
          });
        }
        break;

      case STATES.HURT:
        if (time > this.stateTimer) {
          this.state = STATES.CHASE;
        }
        break;
    }
  }

  takeDamage(amount, knockbackDir) {
    if (this.state === STATES.DEAD) return;

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
      this.setTint(this.typeConfig.color);
    });
  }

  die() {
    this.state = STATES.DEAD;
    this.body.checkCollision.none = true;
    this.body.setVelocity(0);
    this.healthBarBg.destroy();
    this.healthBar.destroy();

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
}
