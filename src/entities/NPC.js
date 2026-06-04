import Phaser from 'phaser';

export default class NPC extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, spriteKey, config) {
    super(scene, x, y, spriteKey, 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.npcConfig = config;
    this.spawnPoint = { x, y };

    this.body.setImmovable(true);
    this.body.setSize(10, 14);
    this.body.setOffset(3, 10);
    this.setDepth(10);

    // Name label
    this.nameLabel = scene.add.text(x, y - 18, config.name, {
      fontFamily: 'MedievalSharp, serif',
      fontSize: '8px',
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(11);

    // Shadow
    this.shadow = scene.add.ellipse(x, y + 10, 12, 6, 0x000000, 0.4).setDepth(9);

    // Wander logic
    if (config.wanderRadius > 0) {
      this.wanderRadius = config.wanderRadius;
      this.stateTimer = scene.time.now + Phaser.Math.Between(1000, 3000);
      
      // Animations for walking
      if (!scene.anims.exists(`${spriteKey}-walk`)) {
        scene.anims.create({
          key: `${spriteKey}-walk`,
          frames: scene.anims.generateFrameNumbers(spriteKey, { start: 0, end: 2 }),
          frameRate: 6,
          repeat: -1
        });
      }
    }
  }

  update() {
    if (this.wanderRadius > 0) {
      const time = this.scene.time.now;
      
      if (time > this.stateTimer) {
        // Change state
        if (this.body.velocity.lengthSq() > 0) {
          // Stop and wait
          this.body.setVelocity(0);
          this.anims.stop();
          this.setFrame(0);
          this.stateTimer = time + Phaser.Math.Between(2000, 5000);
        } else {
          // Move to a new random point within wanderRadius
          const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
          const dist = Phaser.Math.FloatBetween(0, this.wanderRadius);
          const targetX = this.spawnPoint.x + Math.cos(angle) * dist;
          const targetY = this.spawnPoint.y + Math.sin(angle) * dist;
          
          this.scene.physics.moveTo(this, targetX, targetY, 20);
          this.anims.play(`${this.texture.key}-walk`, true);
          this.stateTimer = time + Phaser.Math.Between(1000, 3000);
          
          // Flip sprite based on direction
          if (targetX < this.x) {
            this.setFlipX(true);
          } else {
            this.setFlipX(false);
          }
        }
      }
      
      // Stop if reached target or too far
      const distFromSpawn = Phaser.Math.Distance.Between(this.x, this.y, this.spawnPoint.x, this.spawnPoint.y);
      if (distFromSpawn > this.wanderRadius + 10) {
        this.body.setVelocity(0);
        this.anims.stop();
        this.setFrame(0);
      }
    }

    // Update attachments
    this.nameLabel.x = this.x;
    this.nameLabel.y = this.y - 18;
    this.shadow.x = this.x;
    this.shadow.y = this.y + 10;
  }

  isNearPlayer(player, range = 30) {
    return Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y) <= range;
  }
}
