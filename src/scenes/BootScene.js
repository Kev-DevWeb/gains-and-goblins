// ============================================================================
// BootScene.js - Procedural Asset Generator for Gains & Goblins
// ============================================================================
// Generates every game texture programmatically using Phaser's Canvas/Graphics
// APIs. No external image files are needed. After generation, transitions to
// the Menu scene.
// ============================================================================

import { TILE_SIZE, TILES, TILE_COLORS, SCENES } from '../utils/constants.js';
import { drawPixelMap, mirror, liftFoot, breathe } from '../art/pixelArt.js';
import { HERO, HERO_EVOLUTIONS, NPCS, ENEMIES as ENEMY_SPRITES, GUILD_TILES, OUTDOOR_TILES } from '../art/sprites.js';

const PIXEL_TILES = {
  [TILES.GUILD_FLOOR]: GUILD_TILES.floor,
  [TILES.GUILD_WALL]: GUILD_TILES.wall,
  [TILES.GUILD_BANNER]: GUILD_TILES.banner,
  [TILES.DUMBBELL_RACK]: GUILD_TILES.dumbbellRack,
  [TILES.CARDIO_ZONE]: GUILD_TILES.treadmill,
  [TILES.MEDITATION_MAT]: GUILD_TILES.meditationMat,
  [TILES.BOOKSHELF]: GUILD_TILES.bookshelf,
  [TILES.RECEPTION_DESK]: GUILD_TILES.receptionDesk,
  [TILES.GUILD_WALL_TORCH]: GUILD_TILES.wallTorch,
  [TILES.GUILD_RUG]: GUILD_TILES.rug,
  [TILES.GUILD_PLANT]: GUILD_TILES.plant,
  [TILES.TRAINING_DUMMY]: GUILD_TILES.trainingDummy,
  [TILES.GUILD_FLAGSTONE]: GUILD_TILES.flagstone,
  [TILES.ARENA_FLOOR]: GUILD_TILES.arenaFloor,
  [TILES.GUILD_CHEST]: GUILD_TILES.chest,
  [TILES.BULLETIN_BOARD]: GUILD_TILES.bulletinBoard,
  [TILES.SIGN_EXIT]: GUILD_TILES.signExit,
  [TILES.SIGN_ARENA]: GUILD_TILES.signArena,
  [TILES.ARENA_DUMMY]: GUILD_TILES.arenaDummy,
  [TILES.GRASS]: OUTDOOR_TILES.grass,
  [TILES.GRASS_FLOWER]: OUTDOOR_TILES.grassFlower,
  [TILES.DARK_GRASS]: OUTDOOR_TILES.tallGrass,
  [TILES.DIRT]: OUTDOOR_TILES.dirt,
  [TILES.WATER]: OUTDOOR_TILES.water,
  [TILES.TREE_TOP]: OUTDOOR_TILES.forestCanopy,
  [TILES.TREE_TRUNK]: OUTDOOR_TILES.forestEdge,
  [TILES.STONE_PATH]: OUTDOOR_TILES.plazaStone,
  [TILES.BRIDGE]: OUTDOOR_TILES.dock,
  [TILES.CHEST]: OUTDOOR_TILES.chest,
  [TILES.SIGN]: OUTDOOR_TILES.sign,
  [TILES.BUSH]: OUTDOOR_TILES.bush,
  [TILES.ROCK]: OUTDOOR_TILES.rock,
  [TILES.MUSHROOMS]: OUTDOOR_TILES.mushrooms,
  [TILES.GUILD_ROOF]: OUTDOOR_TILES.guildRoof,
  [TILES.GUILD_FACADE]: OUTDOOR_TILES.guildFacade,
  [TILES.GUILD_WINDOW]: OUTDOOR_TILES.guildWindow,
  [TILES.GUILD_DOOR_LEFT]: OUTDOOR_TILES.guildDoorLeft,
  [TILES.GUILD_DOOR_RIGHT]: OUTDOOR_TILES.guildDoorRight,
  [TILES.GUILD_FLAG]: OUTDOOR_TILES.guildFlag,
  [TILES.PULLUP_BAR]: OUTDOOR_TILES.pullupBar,
  [TILES.PARALLEL_BARS]: OUTDOOR_TILES.parallelBars,
  [TILES.LIFT_STONES]: OUTDOOR_TILES.liftStones,
  [TILES.LOG_BENCH]: OUTDOOR_TILES.logBench,
  [TILES.TRACK_LINE]: OUTDOOR_TILES.trackLine,
  [TILES.TIRE]: OUTDOOR_TILES.tire,
  [TILES.KETTLEBELLS]: OUTDOOR_TILES.kettlebells,
  [TILES.BALANCE_BEAM]: OUTDOOR_TILES.balanceBeam,
  [TILES.FOUNTAIN]: OUTDOOR_TILES.fountain,
  [TILES.YOGA_MAT]: OUTDOOR_TILES.yogaMat,
  [TILES.LILY_PAD]: OUTDOOR_TILES.lilyPad,
  [TILES.TENT_TOP_LEFT]: OUTDOOR_TILES.tentTopLeft,
  [TILES.TENT_TOP_RIGHT]: OUTDOOR_TILES.tentTopRight,
  [TILES.TENT_BOTTOM_LEFT]: OUTDOOR_TILES.tentBottomLeft,
  [TILES.TENT_BOTTOM_RIGHT]: OUTDOOR_TILES.tentBottomRight,
  [TILES.CAMPFIRE]: OUTDOOR_TILES.campfire,
  [TILES.FENCE_H]: OUTDOOR_TILES.fenceH,
  [TILES.FENCE_V]: OUTDOOR_TILES.fenceV,
  [TILES.SKULL_POLE]: OUTDOOR_TILES.skullPole,
  [TILES.CLIFF_TOP]: OUTDOOR_TILES.cliffTop,
  [TILES.CLIFF]: OUTDOOR_TILES.cliff,
};
OUTDOOR_TILES.caveMouth.forEach((map, i) => { PIXEL_TILES[TILES[`CAVE_MOUTH_${i}`]] = map; });
for (let mask = 1; mask < 16; mask++) {
  PIXEL_TILES[TILES[`WATER_EDGE_${mask}`]] = OUTDOOR_TILES.waterEdges[mask];
  PIXEL_TILES[TILES[`DIRT_EDGE_${mask}`]] = OUTDOOR_TILES.dirtEdges[mask];
}

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.BOOT });
  }

  // --------------------------------------------------------------------------
  //  CREATE – orchestrate all texture generation then move on
  // --------------------------------------------------------------------------
  create() {
    // "Loading…" feedback while textures are built
    const loadingText = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      'Loading...',
      {
        fontFamily: 'MedievalSharp, serif',
        fontSize: '28px',
        color: '#ffd700',
        stroke: '#000000',
        strokeThickness: 4,
      }
    ).setOrigin(0.5);

    // Build everything (synchronous – canvas ops are instant)
    this._generateTileset();
    this._generatePlayerSpritesheet();
    this._generateEnemies();
    this._generateNPCs();
    this._generateWeaponEffects();
    this._generateUIIcons();
    this._generateParticles();

    // Small cosmetic delay so the player actually sees the splash
    this.time.delayedCall(400, () => {
      loadingText.destroy();
      this.scene.start(SCENES.MENU);
    });
  }

  // ========================================================================
  //  TILESET GENERATION
  // ========================================================================
  // Each tile sits in an 18 px cell with its edge pixels copied one pixel outward
  // (margin 1, spacing 2). At non-integer zoom the GPU samples that copy instead of
  // the neighbouring tile, which showed up as grass lines between floor boards.
  _generateTileset() {
    const tileKeys = Object.values(TILES);
    const cell = TILE_SIZE + 2;
    const canvas = this.textures.createCanvas('tileset', tileKeys.length * cell, cell);
    const ctx = canvas.getContext();
    const src = canvas.getSourceImage();

    tileKeys.forEach((tileKey) => {
      const x = tileKey * cell + 1;
      ctx.save();
      ctx.translate(x, 1);
      this._drawTile(ctx, tileKey);
      ctx.restore();

      const last = TILE_SIZE - 1;
      ctx.drawImage(src, x, 1, TILE_SIZE, 1, x, 0, TILE_SIZE, 1);                       // top
      ctx.drawImage(src, x, 1 + last, TILE_SIZE, 1, x, 1 + TILE_SIZE, TILE_SIZE, 1);     // bottom
      ctx.drawImage(src, x, 0, 1, cell, x - 1, 0, 1, cell);                              // left
      ctx.drawImage(src, x + last, 0, 1, cell, x + TILE_SIZE, 0, 1, cell);               // right
    });

    canvas.refresh();
  }

  /** Dispatch drawing for a single tile type */
  _drawTile(ctx, tileKey) {
    if (PIXEL_TILES[tileKey]) {
      drawPixelMap(ctx, PIXEL_TILES[tileKey]);
      return;
    }
    const C = TILE_COLORS;
    switch (tileKey) {
      case TILES.WALL_STONE:      this._drawWallStone(ctx, C); break;
      case TILES.HOUSE_WALL:      this._drawHouseWall(ctx, C); break;
      case TILES.HOUSE_DOOR:      this._drawHouseDoor(ctx, C); break;
      case TILES.HOUSE_ROOF:      this._drawHouseRoof(ctx, C); break;
      case TILES.SAND:            this._drawSand(ctx, C); break;
      case TILES.DUNGEON_FLOOR:   this._drawDungeonFloor(ctx, C); break;
      case TILES.DUNGEON_WALL:    this._drawDungeonWall(ctx, C); break;
      case TILES.LAVA:            this._drawLava(ctx, C); break;
      case TILES.CAVE_ENTRANCE:   this._drawCaveEntrance(ctx, C); break;
      case TILES.STUDY_TABLE:     this._drawStudyTable(ctx, C); break;
      default:
        // Fallback – magenta so missing tiles are obvious
        ctx.fillStyle = '#ff00ff';
        ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    }
  }

  // --- Individual tile painters ------------------------------------------------

  _drawWallStone(ctx, C) {
    ctx.fillStyle = C.STONE || '#888888';
    ctx.fillRect(0, 0, 16, 16);
    // Brick mortar lines (dark)
    ctx.fillStyle = C.STONE_DARK || '#555555';
    // Horizontal lines
    ctx.fillRect(0, 5, 16, 1);
    ctx.fillRect(0, 10, 16, 1);
    ctx.fillRect(0, 15, 16, 1);
    // Vertical lines – offset per row for brick pattern
    ctx.fillRect(8, 0, 1, 5);
    ctx.fillRect(4, 5, 1, 5);
    ctx.fillRect(12, 5, 1, 5);
    ctx.fillRect(8, 10, 1, 5);
    // Highlight pixel on a few bricks
    ctx.fillStyle = '#aaaaaa';
    [[2,1],[10,1],[6,7],[14,7],[2,12],[10,12]].forEach(([x,y]) => ctx.fillRect(x,y,1,1));
  }

  _drawHouseWall(ctx, C) {
    ctx.fillStyle = C.HOUSE_WALL || '#e8d5b7';
    ctx.fillRect(0, 0, 16, 16);
    // Darker outline edges
    ctx.fillStyle = C.HOUSE_OUTLINE || '#8b6914';
    ctx.fillRect(0, 0, 1, 16);
    ctx.fillRect(15, 0, 1, 16);
    ctx.fillRect(0, 0, 16, 1);
    ctx.fillRect(0, 15, 16, 1);
    // Window detail
    ctx.fillStyle = '#7ec8e3';
    ctx.fillRect(5, 4, 6, 5);
    ctx.fillStyle = '#555555';
    ctx.fillRect(8, 4, 1, 5);
    ctx.fillRect(5, 6, 6, 1);
  }

  _drawHouseDoor(ctx, C) {
    // Wall base
    ctx.fillStyle = C.HOUSE_WALL || '#e8d5b7';
    ctx.fillRect(0, 0, 16, 16);
    // Door
    ctx.fillStyle = '#5a3410';
    ctx.fillRect(3, 2, 10, 14);
    // Door panels
    ctx.fillStyle = '#6b4f0a';
    ctx.fillRect(4, 3, 4, 5);
    ctx.fillRect(9, 3, 4, 5);
    ctx.fillRect(4, 9, 4, 6);
    ctx.fillRect(9, 9, 4, 6);
    // Gold handle
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(10, 9, 2, 2);
  }

  _drawHouseRoof(ctx, C) {
    ctx.fillStyle = C.HOUSE_ROOF || '#8b2020';
    ctx.fillRect(0, 0, 16, 16);
    // Angled shingle pattern – darker lines
    ctx.fillStyle = '#6b1515';
    for (let y = 0; y < 16; y += 4) {
      ctx.fillRect(0, y, 16, 1);
    }
    // Ridge highlight
    ctx.fillStyle = '#b03030';
    ctx.fillRect(0, 0, 16, 2);
    // Edge shadow
    ctx.fillStyle = '#4a0e0e';
    ctx.fillRect(0, 14, 16, 2);
  }

  _drawSand(ctx, C) {
    ctx.fillStyle = C.SAND || '#e8d5b7';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#c4a35a';
    [[2,1],[8,4],[14,2],[1,10],[6,13],[12,9],[4,6],[10,15]].forEach(([x,y]) => ctx.fillRect(x,y,1,1));
    ctx.fillStyle = '#f5edd5';
    [[5,3],[11,6],[3,11],[9,14]].forEach(([x,y]) => ctx.fillRect(x,y,1,1));
  }

  _drawStudyTable(ctx, C) {
    // Guild floor behind table/chair
    drawPixelMap(ctx, GUILD_TILES.floor);
    
    // Chair (dark wood, placed on the left side of tile)
    ctx.fillStyle = '#3e2723';
    ctx.fillRect(2, 6, 4, 6); // Chair seat
    ctx.fillStyle = '#271911';
    ctx.fillRect(2, 3, 1, 9); // Backrest left
    ctx.fillRect(5, 3, 1, 9); // Backrest right
    ctx.fillRect(2, 3, 4, 1); // Backrest top bar
    
    // Table (lighter wood, on the right side)
    ctx.fillStyle = '#5c4033';
    ctx.fillRect(7, 4, 8, 10); // Tabletop
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(8, 5, 6, 8);  // Inset highlight
    
    // Book on table
    ctx.fillStyle = '#e74c3c'; // red cover
    ctx.fillRect(9, 7, 4, 3);
    ctx.fillStyle = '#f8f9fa'; // white sheets
    ctx.fillRect(10, 7, 2, 3);
    ctx.fillStyle = '#ffd700'; // ribbon
    ctx.fillRect(11, 6, 1, 1);
  }

  _drawDungeonFloor(ctx, C) {
    ctx.fillStyle = C.DUNGEON_FLOOR?.primary || '#2b2b2b';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = C.DUNGEON_FLOOR?.secondary || '#3b3b3b';
    ctx.fillRect(2, 2, 4, 4);
    ctx.fillRect(10, 8, 4, 4);
    ctx.fillStyle = C.DUNGEON_FLOOR?.detail || '#1b1b1b';
    ctx.fillRect(6, 12, 2, 2);
  }

  _drawDungeonWall(ctx, C) {
    ctx.fillStyle = C.DUNGEON_WALL?.primary || '#111111';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = C.DUNGEON_WALL?.secondary || '#222222';
    // Brick pattern
    ctx.fillRect(0, 0, 8, 7);
    ctx.fillRect(9, 0, 7, 7);
    ctx.fillRect(0, 8, 16, 8);
    ctx.fillStyle = C.DUNGEON_WALL?.detail || '#050505';
    // Cracks
    ctx.fillRect(4, 4, 1, 4);
    ctx.fillRect(12, 2, 2, 1);
  }

  _drawLava(ctx, C) {
    ctx.fillStyle = C.LAVA?.primary || '#ff4500';
    ctx.fillRect(0, 0, 16, 16);
    // Bubbles and waves
    ctx.fillStyle = C.LAVA?.secondary || '#d93800';
    ctx.fillRect(3, 4, 10, 2);
    ctx.fillRect(2, 10, 12, 2);
    ctx.fillStyle = C.LAVA?.detail || '#ff8c00';
    ctx.fillRect(5, 5, 2, 2);
    ctx.fillRect(11, 11, 2, 2);
  }

  _drawCaveEntrance(ctx, C) {
    ctx.fillStyle = C.CAVE_ENTRANCE?.primary || '#111111';
    ctx.fillRect(0, 0, 16, 16);
    // Dark void arch
    ctx.fillStyle = C.CAVE_ENTRANCE?.secondary || '#000000';
    ctx.beginPath();
    ctx.arc(8, 16, 6, Math.PI, 0);
    ctx.fill();
  }

  // ========================================================================
  //  PLAYER SPRITESHEET   (16×24 per frame, 12 frames → 192×24 strip)
  // ========================================================================
  // Fable-style visual evolution: a stat at 10+ recolors the hero's outfit
  _heroEvolution(stats) {
    if (!stats) return null;
    const highStr = stats.strength >= 10;
    const highDex = stats.dexterity >= 10;
    const highInt = stats.intelligence >= 10;
    if (highStr && highDex && highInt) return HERO_EVOLUTIONS.master;
    if (highInt) return HERO_EVOLUTIONS.intelligence;
    if (highStr) return HERO_EVOLUTIONS.strength;
    if (highDex) return HERO_EVOLUTIONS.dexterity;
    return null;
  }

  _generatePlayerSpritesheet(stats = null) {
    // Frame order: down(0-2), left(3-5), right(6-8), up(9-11); each is idle + two steps
    const walkRight = [HERO.side, HERO.sideStride, HERO.sideStrideB];
    const frames = [
      HERO.front, liftFoot(HERO.front, 'left'), liftFoot(HERO.front, 'right'),
      ...walkRight.map(mirror),
      ...walkRight,
      HERO.back, liftFoot(HERO.back, 'left'), liftFoot(HERO.back, 'right'),
    ];
    const colorSwap = this._heroEvolution(stats);

    // On evolution, repaint the existing texture: removing it would break the
    // player sprite that is still using its frames
    if (this.textures.exists('player')) {
      const canvas = this.textures.get('player');
      const ctx = canvas.getContext();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frames.forEach((rows, i) => drawPixelMap(ctx, rows, i * 16, 0, colorSwap));
      canvas.refresh();
      return;
    }
    this._createFrameStrip('player', frames, colorSwap);
  }

  /**
   * Draw one player frame at (ox, oy) inside the spritesheet canvas.
   * Visuals evolve based on stats (Fable-style).
   */

  // ========================================================================
  //  ENEMY SPRITES
  // ========================================================================
  _generateEnemies() {
    // Two frames per enemy: idle and a 1 px "breathing" squash
    Object.entries(ENEMY_SPRITES).forEach(([key, rows]) => {
      this._createFrameStrip(key, [rows, breathe(rows)]);
    });
  }

  // ========================================================================
  //  NPC SPRITES  (16×24 per frame, 3 frames idle/walk, single direction)
  // ========================================================================
  _generateNPCs() {
    Object.entries(NPCS).forEach(([key, rows]) => {
      this._createFrameStrip(key, [rows, liftFoot(rows, 'left'), liftFoot(rows, 'right')]);
    });
  }

  /** Draws equally sized pixel maps side by side and registers them as frames 0..n-1. */
  _createFrameStrip(key, frames, colorSwap = null) {
    const fw = frames[0][0].length;
    const fh = frames[0].length;
    const canvas = this.textures.createCanvas(key, fw * frames.length, fh);
    const ctx = canvas.getContext();
    frames.forEach((rows, i) => drawPixelMap(ctx, rows, i * fw, 0, colorSwap));
    canvas.refresh();
    const tex = this.textures.get(key);
    frames.forEach((_, i) => tex.add(i, 0, i * fw, 0, fw, fh));
  }

  // ========================================================================
  //  WEAPON / EFFECT SPRITES
  // ========================================================================
  _generateWeaponEffects() {
    this._generateSlashEffect();
    this._generateSlashFlourish();
    this._generateArrow();
    this._generateArrowCharged();
    this._generateMagicOrb();
    this._generateMagicAoE();
    this._generateShieldBubble();
    this._generateGhostSword();
  }

  _generateSlashEffect() {
    const canvas = this.textures.createCanvas('slash_effect', 24, 24);
    const ctx = canvas.getContext();
    // Arc / sweep in white-silver
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(12, 12, 9, Math.PI * 1.2, Math.PI * 1.9);
    ctx.stroke();
    // Inner brighter arc
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(12, 12, 7, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
    // Bright tip
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(18, 4, 3, 3);
    canvas.refresh();
  }

  _generateArrow() {
    const canvas = this.textures.createCanvas('arrow', 8, 3);
    const ctx = canvas.getContext();
    // Shaft
    ctx.fillStyle = '#8b6914';
    ctx.fillRect(0, 1, 6, 1);
    // Tip
    ctx.fillStyle = '#cccccc';
    ctx.fillRect(6, 0, 1, 3);
    ctx.fillRect(7, 1, 1, 1);
    // Fletching
    ctx.fillStyle = '#e94560';
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillRect(0, 2, 1, 1);
    canvas.refresh();
  }

  _generateMagicOrb() {
    const canvas = this.textures.createCanvas('magic_orb', 10, 10);
    const ctx = canvas.getContext();
    // Outer glow
    ctx.fillStyle = '#6c3483';
    ctx.fillRect(2, 0, 6, 1);
    ctx.fillRect(1, 1, 8, 1);
    ctx.fillRect(0, 2, 10, 6);
    ctx.fillRect(1, 8, 8, 1);
    ctx.fillRect(2, 9, 6, 1);
    // Inner bright
    ctx.fillStyle = '#a855f7';
    ctx.fillRect(3, 2, 4, 6);
    ctx.fillRect(2, 3, 6, 4);
    // Center highlight
    ctx.fillStyle = '#d8b4fe';
    ctx.fillRect(4, 3, 2, 2);
    // Bright core
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(4, 4, 1, 1);
    canvas.refresh();
  }

  _generateSlashFlourish() {
    const canvas = this.textures.createCanvas('slash_flourish', 32, 32);
    const ctx = canvas.getContext();
    // Huge sweeping golden arc
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(16, 16, 12, Math.PI * 1.1, Math.PI * 2.0);
    ctx.stroke();
    // Inner white hot arc
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(16, 16, 10, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    canvas.refresh();
  }

  _generateArrowCharged() {
    const canvas = this.textures.createCanvas('arrow_charged', 12, 5);
    const ctx = canvas.getContext();
    // Shaft
    ctx.fillStyle = '#ff8c00'; // glowing orange
    ctx.fillRect(0, 2, 8, 1);
    // Tip
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(8, 1, 2, 3);
    ctx.fillRect(10, 2, 2, 1);
    // Aura
    ctx.fillStyle = 'rgba(255, 215, 0, 0.4)';
    ctx.fillRect(6, 0, 4, 5);
    canvas.refresh();
  }

  _generateMagicAoE() {
    const canvas = this.textures.createCanvas('magic_aoe', 64, 64);
    const ctx = canvas.getContext();
    // Purple pulsing ring
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(216, 180, 254, 0.5)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(32, 32, 25, 0, Math.PI * 2);
    ctx.stroke();
    canvas.refresh();
  }

  _generateShieldBubble() {
    const canvas = this.textures.createCanvas('shield_bubble', 32, 32);
    const ctx = canvas.getContext();
    // Blue semi-transparent bubble
    ctx.strokeStyle = 'rgba(68, 136, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(16, 16, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(68, 136, 255, 0.2)';
    ctx.beginPath();
    ctx.arc(16, 16, 14, 0, Math.PI * 2);
    ctx.fill();
    canvas.refresh();
  }

  _generateGhostSword() {
    const canvas = this.textures.createCanvas('ghost_sword', 16, 16);
    const ctx = canvas.getContext();
    // Ethereal floating sword (diagonal)
    ctx.strokeStyle = 'rgba(126, 200, 227, 0.8)'; // light blue ghost color
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(3, 13); // hilt
    ctx.lineTo(13, 3); // tip
    ctx.stroke();
    ctx.fillStyle = 'rgba(168, 220, 247, 1)';
    ctx.fillRect(2, 12, 3, 3); // pommel
    // Crossguard
    ctx.beginPath();
    ctx.moveTo(4, 10);
    ctx.lineTo(8, 14);
    ctx.stroke();
    canvas.refresh();
  }

  // ========================================================================
  //  UI ICONS  (32×32, higher detail for HUD)
  // ========================================================================
  _generateUIIcons() {
    this._generateIconSword();
    this._generateIconBow();
    this._generateIconMagic();
    this._generateIconHeart();
    this._generateIconMana();
  }

  _generateIconSword() {
    const canvas = this.textures.createCanvas('icon_sword', 32, 32);
    const ctx = canvas.getContext();
    // Blade (diagonal represented as vertical for pixel art)
    ctx.fillStyle = '#cccccc';
    ctx.fillRect(14, 2, 4, 18);
    // Blade edge highlight
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(15, 2, 2, 16);
    // Blade tip
    ctx.fillStyle = '#dddddd';
    ctx.fillRect(15, 1, 2, 1);
    ctx.fillRect(15, 0, 2, 1);
    // Guard
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(10, 20, 12, 2);
    // Guard detail
    ctx.fillStyle = '#daa520';
    ctx.fillRect(10, 21, 12, 1);
    // Grip
    ctx.fillStyle = '#5a3410';
    ctx.fillRect(14, 22, 4, 6);
    // Grip wrap
    ctx.fillStyle = '#8b6914';
    ctx.fillRect(14, 23, 4, 1);
    ctx.fillRect(14, 25, 4, 1);
    ctx.fillRect(14, 27, 4, 1);
    // Pommel
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(14, 28, 4, 3);
    ctx.fillStyle = '#e94560';
    ctx.fillRect(15, 29, 2, 1); // gem
    canvas.refresh();
  }

  _generateIconBow() {
    const canvas = this.textures.createCanvas('icon_bow', 32, 32);
    const ctx = canvas.getContext();
    // Bow limb (curved shape using rects)
    ctx.fillStyle = '#8b6914';
    // Left limb curve
    ctx.fillRect(8, 4, 2, 3);
    ctx.fillRect(7, 7, 2, 4);
    ctx.fillRect(6, 11, 2, 4);
    ctx.fillRect(7, 15, 2, 4);
    ctx.fillRect(6, 19, 2, 4);
    ctx.fillRect(7, 23, 2, 3);
    ctx.fillRect(8, 26, 2, 3);
    // Bow tip accents
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(8, 3, 2, 1);
    ctx.fillRect(8, 29, 2, 1);
    // String
    ctx.fillStyle = '#c4a35a';
    ctx.fillRect(10, 5, 1, 24);
    // Arrow
    ctx.fillStyle = '#6b4f0a';
    ctx.fillRect(11, 15, 14, 1);
    // Arrow tip
    ctx.fillStyle = '#cccccc';
    ctx.fillRect(25, 14, 1, 3);
    ctx.fillRect(26, 15, 1, 1);
    // Fletching
    ctx.fillStyle = '#e94560';
    ctx.fillRect(11, 14, 2, 1);
    ctx.fillRect(11, 16, 2, 1);
    canvas.refresh();
  }

  _generateIconMagic() {
    const canvas = this.textures.createCanvas('icon_magic', 32, 32);
    const ctx = canvas.getContext();
    // Staff
    ctx.fillStyle = '#5a3410';
    ctx.fillRect(14, 8, 3, 22);
    // Staff wrap
    ctx.fillStyle = '#8b6914';
    ctx.fillRect(14, 12, 3, 1);
    ctx.fillRect(14, 16, 3, 1);
    ctx.fillRect(14, 20, 3, 1);
    // Orb holder (crescent)
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(12, 6, 2, 4);
    ctx.fillRect(17, 6, 2, 4);
    ctx.fillRect(13, 5, 5, 1);
    // Orb
    ctx.fillStyle = '#a855f7';
    ctx.fillRect(13, 2, 5, 4);
    ctx.fillRect(14, 1, 3, 1);
    ctx.fillRect(14, 6, 3, 1);
    // Orb highlight
    ctx.fillStyle = '#d946ef';
    ctx.fillRect(14, 2, 2, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(14, 2, 1, 1);
    // Base gem
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(13, 29, 5, 2);
    canvas.refresh();
  }

  _generateIconHeart() {
    const canvas = this.textures.createCanvas('icon_heart', 32, 32);
    const ctx = canvas.getContext();
    // Heart shape built with rects
    ctx.fillStyle = '#e94560';
    // Top lobes
    ctx.fillRect(4, 8, 10, 8);
    ctx.fillRect(18, 8, 10, 8);
    ctx.fillRect(3, 10, 12, 6);
    ctx.fillRect(17, 10, 12, 6);
    // Middle
    ctx.fillRect(4, 16, 24, 4);
    // Taper
    ctx.fillRect(6, 20, 20, 3);
    ctx.fillRect(8, 23, 16, 2);
    ctx.fillRect(10, 25, 12, 2);
    ctx.fillRect(12, 27, 8, 2);
    ctx.fillRect(14, 29, 4, 2);
    // Highlight
    ctx.fillStyle = '#ff8a8a';
    ctx.fillRect(7, 10, 4, 3);
    ctx.fillRect(6, 11, 3, 2);
    // Dark edge
    ctx.fillStyle = '#cc2244';
    ctx.fillRect(14, 29, 4, 2);
    ctx.fillRect(12, 27, 2, 2);
    ctx.fillRect(20, 27, 2, 2);
    canvas.refresh();
  }

  _generateIconMana() {
    const canvas = this.textures.createCanvas('icon_mana', 32, 32);
    const ctx = canvas.getContext();
    // Diamond / drop shape
    ctx.fillStyle = '#2d9cdb';
    // Top taper (drop)
    ctx.fillRect(14, 2, 4, 2);
    ctx.fillRect(12, 4, 8, 2);
    ctx.fillRect(10, 6, 12, 3);
    ctx.fillRect(8, 9, 16, 3);
    ctx.fillRect(6, 12, 20, 4);
    ctx.fillRect(7, 16, 18, 3);
    ctx.fillRect(8, 19, 16, 3);
    ctx.fillRect(10, 22, 12, 2);
    ctx.fillRect(12, 24, 8, 2);
    ctx.fillRect(14, 26, 4, 2);
    // Highlight (inner glow)
    ctx.fillStyle = '#7ec8e3';
    ctx.fillRect(12, 8, 4, 4);
    ctx.fillRect(11, 9, 3, 3);
    // Bright spot
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(12, 9, 2, 2);
    canvas.refresh();
  }

  // ========================================================================
  //  PARTICLE TEXTURES  (4×4 solid colour squares)
  // ========================================================================
  _generateParticles() {
    const particles = {
      particle_white:  '#ffffff',
      particle_red:    '#e94560',
      particle_gold:   '#ffd700',
      particle_blue:   '#2d9cdb',
      particle_purple: '#a855f7',
    };

    Object.entries(particles).forEach(([key, color]) => {
      const canvas = this.textures.createCanvas(key, 4, 4);
      const ctx = canvas.getContext();
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 4, 4);
      canvas.refresh();
    });
  }
}
