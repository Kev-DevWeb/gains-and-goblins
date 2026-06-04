// ============================================================================
// BootScene.js - Procedural Asset Generator for Gains & Goblins
// ============================================================================
// Generates every game texture programmatically using Phaser's Canvas/Graphics
// APIs. No external image files are needed. After generation, transitions to
// the Menu scene.
// ============================================================================

import { TILE_SIZE, TILES, TILE_COLORS, ENEMIES, WEAPONS, SCENES } from '../utils/constants.js';

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
  _generateTileset() {
    const tileKeys = Object.values(TILES);
    const canvas = this.textures.createCanvas('tileset', tileKeys.length * TILE_SIZE, TILE_SIZE);
    const ctx = canvas.getContext();

    tileKeys.forEach((tileKey) => {
      ctx.save();
      ctx.translate(tileKey * TILE_SIZE, 0);
      this._drawTile(ctx, tileKey);
      ctx.restore();
    });
    
    canvas.refresh();
  }

  /** Dispatch drawing for a single tile type */
  _drawTile(ctx, tileKey) {
    const C = TILE_COLORS;
    switch (tileKey) {
      case TILES.GRASS:           this._drawGrass(ctx, C); break;
      case TILES.GRASS_FLOWER:    this._drawGrassFlower(ctx, C); break;
      case TILES.DIRT:            this._drawDirt(ctx, C); break;
      case TILES.WATER:           this._drawWater(ctx, C); break;
      case TILES.WALL_STONE:      this._drawWallStone(ctx, C); break;
      case TILES.TREE_TRUNK:      this._drawTreeTrunk(ctx, C); break;
      case TILES.TREE_TOP:        this._drawTreeTop(ctx, C); break;
      case TILES.HOUSE_WALL:      this._drawHouseWall(ctx, C); break;
      case TILES.HOUSE_DOOR:      this._drawHouseDoor(ctx, C); break;
      case TILES.HOUSE_ROOF:      this._drawHouseRoof(ctx, C); break;
      case TILES.BRIDGE:          this._drawBridge(ctx, C); break;
      case TILES.STONE_PATH:      this._drawStonePath(ctx, C); break;
      case TILES.DARK_GRASS:      this._drawDarkGrass(ctx, C); break;
      case TILES.SAND:            this._drawSand(ctx, C); break;
      case TILES.CHEST:           this._drawChest(ctx, C); break;
      case TILES.SIGN:            this._drawSign(ctx, C); break;
      case TILES.GUILD_FLOOR:     this._drawGuildFloor(ctx, C); break;
      case TILES.GUILD_WALL:      this._drawGuildWall(ctx, C); break;
      case TILES.DUMBBELL_RACK:   this._drawDumbbellRack(ctx, C); break;
      case TILES.CARDIO_ZONE:     this._drawCardioZone(ctx, C); break;
      case TILES.BOOKSHELF:       this._drawBookshelf(ctx, C); break;
      case TILES.MEDITATION_MAT:  this._drawMeditationMat(ctx, C); break;
      case TILES.ARENA_FLOOR:     this._drawArenaFloor(ctx, C); break;
      case TILES.BULLETIN_BOARD:  this._drawBulletinBoard(ctx, C); break;
      case TILES.DUNGEON_FLOOR:   this._drawDungeonFloor(ctx, C); break;
      case TILES.DUNGEON_WALL:    this._drawDungeonWall(ctx, C); break;
      case TILES.LAVA:            this._drawLava(ctx, C); break;
      case TILES.CAVE_ENTRANCE:   this._drawCaveEntrance(ctx, C); break;
      default:
        // Fallback – magenta so missing tiles are obvious
        ctx.fillStyle = '#ff00ff';
        ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    }
  }

  // --- Individual tile painters ------------------------------------------------

  _drawGrass(ctx, C) {
    // Solid green base
    ctx.fillStyle = C.GRASS || '#4a7c2e';
    ctx.fillRect(0, 0, 16, 16);
    // Darker dots for texture
    ctx.fillStyle = C.GRASS_DARK || '#2d5016';
    const dots = [[2,3],[7,1],[12,5],[4,10],[9,13],[14,9],[1,14],[10,7]];
    dots.forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));
  }

  _drawGrassFlower(ctx, C) {
    // Grass base first
    this._drawGrass(ctx, C);
    // Small flower
    ctx.fillStyle = '#e94560'; // red petal
    ctx.fillRect(7, 6, 2, 2);
    ctx.fillStyle = '#ffd93d'; // gold center
    ctx.fillRect(8, 6, 1, 1);
    // Stem
    ctx.fillStyle = '#2d5016';
    ctx.fillRect(7, 8, 1, 3);
  }

  _drawDirt(ctx, C) {
    ctx.fillStyle = C.DIRT || '#8b6914';
    ctx.fillRect(0, 0, 16, 16);
    // Slight lighter variation dots
    ctx.fillStyle = C.DIRT_LIGHT || '#c4a35a';
    const spots = [[3,2],[8,5],[13,1],[2,11],[6,14],[11,10],[15,7]];
    spots.forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));
    // Darker specs
    ctx.fillStyle = '#6b4f0a';
    [[5,8],[10,3],[1,6],[14,13]].forEach(([x,y]) => ctx.fillRect(x,y,1,1));
  }

  _drawWater(ctx, C) {
    ctx.fillStyle = C.WATER || '#2d9cdb';
    ctx.fillRect(0, 0, 16, 16);
    // Lighter wave lines
    ctx.fillStyle = C.WATER_LIGHT || '#7ec8e3';
    // Wave row 1
    for (let x = 1; x < 15; x += 3) { ctx.fillRect(x, 4, 2, 1); }
    // Wave row 2 (offset)
    for (let x = 3; x < 16; x += 3) { ctx.fillRect(x, 10, 2, 1); }
    // Deep accents
    ctx.fillStyle = C.WATER_DEEP || '#1a6b8a';
    ctx.fillRect(0, 7, 16, 1);
    ctx.fillRect(6, 13, 3, 1);
  }

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

  _drawTreeTrunk(ctx, C) {
    // Grass base behind the trunk
    this._drawGrass(ctx, C);
    // Trunk (centered, bottom half)
    ctx.fillStyle = C.TREE_TRUNK || '#8b6914';
    ctx.fillRect(5, 4, 6, 12);
    // Bark detail
    ctx.fillStyle = '#6b4f0a';
    ctx.fillRect(6, 6, 1, 8);
    ctx.fillRect(9, 5, 1, 9);
    // Highlight
    ctx.fillStyle = '#c4a35a';
    ctx.fillRect(7, 7, 1, 4);
  }

  _drawTreeTop(ctx, C) {
    // Dark green canopy – diamond / rounded shape
    ctx.fillStyle = C.TREE_TOP || '#2d5016';
    // Build a rough circle/diamond
    ctx.fillRect(5, 0, 6, 1);    // top
    ctx.fillRect(3, 1, 10, 2);
    ctx.fillRect(1, 3, 14, 4);
    ctx.fillRect(2, 7, 12, 3);
    ctx.fillRect(3, 10, 10, 2);
    ctx.fillRect(5, 12, 6, 2);
    ctx.fillRect(6, 14, 4, 2);
    // Lighter leaf highlights
    ctx.fillStyle = C.TREE_HIGHLIGHT || '#8fbc5a';
    [[4,4],[8,2],[11,5],[6,8],[3,6],[10,9],[7,11]].forEach(([x,y]) => ctx.fillRect(x,y,2,1));
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

  _drawBridge(ctx, C) {
    // Water base underneath
    ctx.fillStyle = C.WATER || '#2d9cdb';
    ctx.fillRect(0, 0, 16, 16);
    // Wooden planks
    ctx.fillStyle = '#8b6914';
    for (let y = 0; y < 16; y += 4) {
      ctx.fillRect(2, y, 12, 3);
    }
    // Gaps between planks
    ctx.fillStyle = '#1a6b8a';
    for (let y = 3; y < 16; y += 4) {
      ctx.fillRect(2, y, 12, 1);
    }
    // Side rails
    ctx.fillStyle = '#6b4f0a';
    ctx.fillRect(1, 0, 1, 16);
    ctx.fillRect(14, 0, 1, 16);
  }

  _drawStonePath(ctx, C) {
    ctx.fillStyle = '#999999';
    ctx.fillRect(0, 0, 16, 16);
    // Cobblestone outlines
    ctx.fillStyle = '#666666';
    // Row 1
    ctx.fillRect(0, 0, 16, 1);
    ctx.fillRect(0, 5, 16, 1);
    ctx.fillRect(0, 10, 16, 1);
    ctx.fillRect(0, 15, 16, 1);
    ctx.fillRect(5, 0, 1, 5);
    ctx.fillRect(11, 0, 1, 5);
    ctx.fillRect(3, 5, 1, 5);
    ctx.fillRect(8, 5, 1, 5);
    ctx.fillRect(13, 5, 1, 5);
    ctx.fillRect(5, 10, 1, 5);
    ctx.fillRect(11, 10, 1, 5);
    // Highlights
    ctx.fillStyle = '#bbbbbb';
    [[2,2],[8,2],[13,3],[1,7],[5,7],[10,8],[3,12],[8,12],[14,13]].forEach(([x,y]) => ctx.fillRect(x,y,1,1));
  }

  _drawDarkGrass(ctx, C) {
    ctx.fillStyle = C.DARK_GRASS || '#2d5016';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#1a3a0a';
    [[3,2],[9,4],[14,1],[1,9],[7,12],[12,14],[5,7]].forEach(([x,y]) => ctx.fillRect(x,y,1,1));
    // A couple lighter blades
    ctx.fillStyle = '#4a7c2e';
    [[6,3],[11,8],[2,13]].forEach(([x,y]) => ctx.fillRect(x,y,1,2));
  }

  _drawSand(ctx, C) {
    ctx.fillStyle = C.SAND || '#e8d5b7';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#c4a35a';
    [[2,1],[8,4],[14,2],[1,10],[6,13],[12,9],[4,6],[10,15]].forEach(([x,y]) => ctx.fillRect(x,y,1,1));
    ctx.fillStyle = '#f5edd5';
    [[5,3],[11,6],[3,11],[9,14]].forEach(([x,y]) => ctx.fillRect(x,y,1,1));
  }

  _drawChest(ctx, C) {
    // Grass behind
    this._drawGrass(ctx, C);
    // Chest body
    ctx.fillStyle = '#8b6914';
    ctx.fillRect(2, 6, 12, 8);
    // Lid (slightly darker)
    ctx.fillStyle = '#6b4f0a';
    ctx.fillRect(2, 4, 12, 3);
    // Gold trim / latch
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(2, 6, 12, 1); // rim between lid and body
    ctx.fillRect(7, 7, 2, 3);  // latch
    // Keyhole
    ctx.fillStyle = '#333333';
    ctx.fillRect(7, 9, 2, 1);
    // Highlights
    ctx.fillStyle = '#c4a35a';
    ctx.fillRect(3, 5, 2, 1);
    ctx.fillRect(11, 5, 2, 1);
  }

  _drawSign(ctx, C) {
    // Grass behind
    this._drawGrass(ctx, C);
    // Post
    ctx.fillStyle = '#6b4f0a';
    ctx.fillRect(7, 7, 2, 9);
    // Board
    ctx.fillStyle = '#c4a35a';
    ctx.fillRect(3, 2, 10, 6);
    // Board border
    ctx.fillStyle = '#8b6914';
    ctx.fillRect(3, 2, 10, 1);
    ctx.fillRect(3, 7, 10, 1);
    ctx.fillRect(3, 2, 1, 6);
    ctx.fillRect(12, 2, 1, 6);
    // Text lines (tiny dark lines to suggest writing)
    ctx.fillStyle = '#333333';
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(4, 5, 8, 5);
  }

  // --- New Guild Tile Painters ---

  _drawGuildFloor(ctx, C) {
    // Polished wood planks
    ctx.fillStyle = '#4a3b2c';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#3a2b1c';
    // Planks lines
    ctx.fillRect(0, 3, 16, 1);
    ctx.fillRect(0, 7, 16, 1);
    ctx.fillRect(0, 11, 16, 1);
    ctx.fillRect(0, 15, 16, 1);
    // Vertical cuts
    ctx.fillRect(4, 0, 1, 3);
    ctx.fillRect(10, 4, 1, 3);
    ctx.fillRect(6, 8, 1, 3);
    ctx.fillRect(12, 12, 1, 3);
  }

  _drawGuildWall(ctx, C) {
    // Elegant dark stone blocks
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#1a252f';
    ctx.fillRect(0, 7, 16, 1);
    ctx.fillRect(0, 15, 16, 1);
    ctx.fillRect(7, 0, 1, 7);
    ctx.fillRect(14, 8, 1, 7);
  }

  _drawDumbbellRack(ctx, C) {
    // Rack base
    this._drawGuildFloor(ctx, C);
    ctx.fillStyle = '#7f8c8d'; // metal rack
    ctx.fillRect(1, 4, 14, 2);
    ctx.fillRect(1, 10, 14, 2);
    // Dumbbells
    ctx.fillStyle = '#2c3e50'; // black iron
    [2, 6, 10].forEach(x => {
      ctx.fillRect(x, 3, 3, 4);
      ctx.fillRect(x, 9, 3, 4);
    });
    ctx.fillStyle = '#bdc3c7'; // metal handle
    [3, 7, 11].forEach(x => {
      ctx.fillRect(x, 4, 1, 2);
      ctx.fillRect(x, 10, 1, 2);
    });
  }

  _drawCardioZone(ctx, C) {
    this._drawGuildFloor(ctx, C);
    // Purple mat/dummy
    ctx.fillStyle = '#8e44ad';
    ctx.fillRect(2, 2, 12, 12);
    ctx.fillStyle = '#9b59b6';
    ctx.fillRect(3, 3, 10, 10);
    // Footprints
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(5, 5, 2, 3);
    ctx.fillRect(9, 8, 2, 3);
  }

  _drawBookshelf(ctx, C) {
    // Wood shelf
    ctx.fillStyle = '#3e2723';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#5c4033';
    ctx.fillRect(1, 1, 14, 14);
    // Shelves
    ctx.fillStyle = '#271911';
    ctx.fillRect(1, 5, 14, 2);
    ctx.fillRect(1, 10, 14, 2);
    // Books
    const bookColors = ['#e74c3c', '#3498db', '#2ecc71', '#9b59b6'];
    for(let i = 0; i < 4; i++) {
      ctx.fillStyle = bookColors[i % 4];
      ctx.fillRect(2 + i*3, 2, 2, 3);
      ctx.fillStyle = bookColors[(i+1) % 4];
      ctx.fillRect(3 + i*3, 7, 2, 3);
    }
  }

  _drawMeditationMat(ctx, C) {
    this._drawGuildFloor(ctx, C);
    ctx.fillStyle = '#16a085'; // teal mat
    ctx.fillRect(3, 2, 10, 12);
    ctx.fillStyle = '#1abc9c';
    ctx.fillRect(4, 3, 8, 10);
    // Incense or candles
    ctx.fillStyle = '#f1c40f'; // golden flame
    ctx.fillRect(1, 1, 2, 2);
    ctx.fillRect(13, 13, 2, 2);
  }

  _drawArenaFloor(ctx, C) {
    ctx.fillStyle = C.ARENA_FLOOR?.primary || '#c0392b';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = C.ARENA_FLOOR?.detail || '#7f8c8d';
    ctx.fillRect(1, 1, 14, 14);
    ctx.fillStyle = C.ARENA_FLOOR?.secondary || '#e74c3c';
    ctx.fillRect(4, 4, 8, 8);
  }

  _drawBulletinBoard(ctx, C) {
    ctx.fillStyle = C.BULLETIN_BOARD?.primary || '#7d4e00';
    ctx.fillRect(0, 2, 16, 12);
    // Papers
    ctx.fillStyle = C.BULLETIN_BOARD?.detail || '#e8d5b7';
    ctx.fillRect(2, 4, 4, 5);
    ctx.fillRect(8, 5, 5, 4);
    // Pins
    ctx.fillStyle = C.BULLETIN_BOARD?.secondary || '#ffd700';
    ctx.fillRect(4, 3, 1, 1);
    ctx.fillRect(10, 4, 1, 1);
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
  _generatePlayerSpritesheet(stats = null) {
    const fw = 16;  // frame width
    const fh = 24;  // frame height
    const totalFrames = 12;
    const sheetW = fw * totalFrames;
    const sheetH = fh;

    if (this.textures.exists('player')) {
      this.textures.remove('player');
    }

    const canvas = this.textures.createCanvas('player', sheetW, sheetH);
    const ctx = canvas.getContext();

    // Direction order: down(0-2), left(3-5), right(6-8), up(9-11)
    const directions = ['down', 'left', 'right', 'up'];

    for (let dir = 0; dir < 4; dir++) {
      for (let frame = 0; frame < 3; frame++) {
        const ox = (dir * 3 + frame) * fw; // x-offset in the strip
        this._drawPlayerFrame(ctx, ox, 0, directions[dir], frame, stats);
      }
    }

    canvas.refresh();

    // Register spritesheet frame data so Phaser can use frame indices
    const tex = this.textures.get('player');
    for (let i = 0; i < totalFrames; i++) {
      tex.add(i, 0, i * fw, 0, fw, fh);
    }
  }

  /**
   * Draw one player frame at (ox, oy) inside the spritesheet canvas.
   * Visuals evolve based on stats (Fable-style).
   */
  _drawPlayerFrame(ctx, ox, oy, dir, frame, stats = null) {
    // ---- Default Palette ----
    let skin    = '#e8b078';
    let hair    = '#5a3410';
    let eyeCol  = '#222222';
    let tunic   = '#2d7040';
    let tunicH  = '#3a9955'; // highlight
    let pants   = '#3b3b6e';
    let boots   = '#5a3410';
    let magicAura = false;
    let strengthBulk = 0;

    // ---- Fable-style Visual Evolution ----
    if (stats) {
      const highStr = stats.strength >= 10;
      const highDex = stats.dexterity >= 10;
      const highInt = stats.intelligence >= 10;
      const isMaster = highStr && highDex && highInt;

      if (isMaster) {
        // Master of all: Bulky, White/Gold robes, Glowing Aura
        strengthBulk = 2;
        tunic = '#f8f9fa'; // White
        tunicH = '#ffd700'; // Gold trim
        pants = '#222222';
        magicAura = true;
      } else {
        // High Strength: Bulky (wider torso), red/darker clothes
        if (highStr) {
          strengthBulk = 2; // pixel width increase
          tunic = '#702d2d';
          tunicH = '#993a3a';
        }
        
        // High Dexterity: Slender, dark green/black, rogue style
        if (highDex && !highStr) {
          tunic = '#1f3024';
          tunicH = '#2d5036';
          pants = '#222222';
        }
        
        // High Intelligence: Purple robes, magic aura
        if (highInt) {
          tunic = '#4b2d70';
          tunicH = '#663a99';
          magicAura = true;
        }
      }
      
      // High Resistance/Willpower: Lighter hair / aging effect
      if (stats.resistance >= 15 || stats.willpower >= 15) {
        hair = '#aaaaaa'; // gray hair
      }
    }

    // ---- Hair (top 3px, centered 10px wide) ----
    ctx.fillStyle = hair;
    ctx.fillRect(ox + 3, oy + 0, 10, 3);

    // ---- Head / skin (rows 3–7) ----
    ctx.fillStyle = skin;
    ctx.fillRect(ox + 4, oy + 3, 8, 5);

    // ---- Eyes (row 5) – depend on direction ----
    ctx.fillStyle = eyeCol;
    if (magicAura) ctx.fillStyle = '#a855f7'; // glowing eyes for high INT
    if (dir === 'down') {
      ctx.fillRect(ox + 5, oy + 5, 2, 1);
      ctx.fillRect(ox + 9, oy + 5, 2, 1);
    } else if (dir === 'left') {
      ctx.fillRect(ox + 4, oy + 5, 2, 1);
    } else if (dir === 'right') {
      ctx.fillRect(ox + 10, oy + 5, 2, 1);
    }
    // 'up' → no eyes visible

    // ---- Tunic body (rows 8–16) ----
    ctx.fillStyle = tunic;
    // Apply strength bulk
    let tWidth = 10;
    let tX = 3;
    if (strengthBulk > 0 && (dir === 'down' || dir === 'up')) {
      tWidth += strengthBulk;
      tX -= Math.floor(strengthBulk / 2);
    }
    ctx.fillRect(ox + tX, oy + 8, tWidth, 9);
    
    // Tunic highlight stripe
    ctx.fillStyle = tunicH;
    if (dir === 'down' || dir === 'up') {
      ctx.fillRect(ox + 7, oy + 9, 2, 7);
    } else if (dir === 'left') {
      ctx.fillRect(ox + 4, oy + 9, 2, 7);
    } else {
      ctx.fillRect(ox + 10, oy + 9, 2, 7);
    }

    // ---- Belt ----
    ctx.fillStyle = '#8b6914';
    ctx.fillRect(ox + tX, oy + 14, tWidth, 1);
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(ox + 7, oy + 14, 2, 1); // buckle

    // ---- Legs / pants (rows 17–19) ----
    ctx.fillStyle = pants;
    const legOffset = frame === 1 ? -1 : frame === 2 ? 1 : 0;
    // Left leg
    ctx.fillRect(ox + 4 + (dir === 'left' ? legOffset : 0),  oy + 17, 3, 3);
    // Right leg
    ctx.fillRect(ox + 9 + (dir === 'right' ? -legOffset : 0), oy + 17, 3, 3);

    // ---- Boots (rows 20–23) ----
    ctx.fillStyle = boots;
    const bootShift = frame === 1 ? -1 : frame === 2 ? 1 : 0;
    // Left boot
    ctx.fillRect(ox + 4, oy + 20 + (frame === 1 ? -1 : 0), 3, 4);
    // Right boot
    ctx.fillRect(ox + 9, oy + 20 + (frame === 2 ? -1 : 0), 3, 4);

    // Arms – small rectangles on sides
    ctx.fillStyle = tunic;
    if (dir === 'down' || dir === 'up') {
      let armLeftX = 1;
      let armRightX = 13;
      if (strengthBulk > 0) { armLeftX -= 1; armRightX += 1; }
      
      ctx.fillRect(ox + armLeftX, oy + 9, 2, 6);  // left arm
      ctx.fillRect(ox + armRightX, oy + 9, 2, 6); // right arm
      // Skin hands
      ctx.fillStyle = magicAura ? '#a855f7' : skin;
      ctx.fillRect(ox + armLeftX, oy + 15, 2, 2);
      ctx.fillRect(ox + armRightX, oy + 15, 2, 2);
    } else if (dir === 'left') {
      ctx.fillRect(ox + 2, oy + 9, 2, 6);
      ctx.fillStyle = magicAura ? '#a855f7' : skin;
      ctx.fillRect(ox + 2, oy + 15, 2, 2);
    } else {
      ctx.fillRect(ox + 12, oy + 9, 2, 6);
      ctx.fillStyle = magicAura ? '#a855f7' : skin;
      ctx.fillRect(ox + 12, oy + 15, 2, 2);
    }
  }

  // ========================================================================
  //  ENEMY SPRITES
  // ========================================================================
  _generateEnemies() {
    this._generateSlime();
    this._generateGoblin();
    this._generateSkeleton();
    this._generateEnemyGoblinKing();
  }

  // ========================================================================
  //  NPC SPRITES  (16×24 per frame, 3 frames idle/walk, single direction)
  // ========================================================================
  _generateNPCs() {
    const npcConfigs = [
      { key: 'npc_villager', tunic: '#6b5b3a', tunicH: '#8b7b5a', hair: '#8b6914' },
      { key: 'npc_smith',    tunic: '#5a2a0a', tunicH: '#7a4a2a', hair: '#2a2a2a' },
      { key: 'npc_sage',     tunic: '#3a2a6b', tunicH: '#5a4a8b', hair: '#c0c0c0' },
    ];

    npcConfigs.forEach(cfg => {
      const fw = 16, fh = 24;
      const canvas = this.textures.createCanvas(cfg.key, fw * 3, fh);
      const ctx = canvas.getContext();

      for (let frame = 0; frame < 3; frame++) {
        const ox = frame * fw;
        this._drawNPCFrame(ctx, ox, 0, cfg, frame);
      }

      canvas.refresh();
      const tex = this.textures.get(cfg.key);
      for (let i = 0; i < 3; i++) {
        tex.add(i, 0, i * fw, 0, fw, fh);
      }
    });
  }

  _drawNPCFrame(ctx, ox, oy, cfg, frame) {
    const skin = '#d4a574';
    const hair = cfg.hair;
    const tunic = cfg.tunic;
    const tunicH = cfg.tunicH;
    const pants = '#4a4a3a';
    const boots = '#3a2a1a';

    // Hair
    ctx.fillStyle = hair;
    ctx.fillRect(ox + 3, oy + 0, 10, 3);

    // Head
    ctx.fillStyle = skin;
    ctx.fillRect(ox + 4, oy + 3, 8, 5);

    // Eyes
    ctx.fillStyle = '#222222';
    ctx.fillRect(ox + 5, oy + 5, 2, 1);
    ctx.fillRect(ox + 9, oy + 5, 2, 1);

    // Tunic
    ctx.fillStyle = tunic;
    ctx.fillRect(ox + 3, oy + 8, 10, 9);
    ctx.fillStyle = tunicH;
    ctx.fillRect(ox + 7, oy + 9, 2, 7);

    // Belt
    ctx.fillStyle = '#8b6914';
    ctx.fillRect(ox + 3, oy + 14, 10, 1);

    // Legs
    ctx.fillStyle = pants;
    const legOff = frame === 1 ? -1 : frame === 2 ? 1 : 0;
    ctx.fillRect(ox + 4, oy + 17, 3, 3);
    ctx.fillRect(ox + 9, oy + 17, 3, 3);

    // Boots
    ctx.fillStyle = boots;
    ctx.fillRect(ox + 4, oy + 20 + (frame === 1 ? -1 : 0), 3, 4);
    ctx.fillRect(ox + 9, oy + 20 + (frame === 2 ? -1 : 0), 3, 4);

    // Arms
    ctx.fillStyle = tunic;
    ctx.fillRect(ox + 1, oy + 9, 2, 6);
    ctx.fillRect(ox + 13, oy + 9, 2, 6);
    ctx.fillStyle = skin;
    ctx.fillRect(ox + 1, oy + 15, 2, 2);
    ctx.fillRect(ox + 13, oy + 15, 2, 2);
  }

  _generateSlime() {
    const canvas = this.textures.createCanvas('enemy_slime', 16, 16);
    const ctx = canvas.getContext();
    // Green blob – wider at bottom
    ctx.fillStyle = '#3ac55e';
    ctx.fillRect(3, 8, 10, 6);   // bottom wide
    ctx.fillRect(4, 5, 8, 3);    // mid
    ctx.fillRect(5, 3, 6, 2);    // top
    // Darker edge
    ctx.fillStyle = '#28a745';
    ctx.fillRect(3, 13, 10, 1);
    ctx.fillRect(4, 7, 8, 1);
    // Eyes
    ctx.fillStyle = '#111111';
    ctx.fillRect(5, 7, 2, 2);
    ctx.fillRect(9, 7, 2, 2);
    // Eye shine
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(5, 7, 1, 1);
    ctx.fillRect(9, 7, 1, 1);
    // Highlight
    ctx.fillStyle = '#80e89b';
    ctx.fillRect(6, 4, 2, 1);
    canvas.refresh();
  }

  _generateGoblin() {
    const canvas = this.textures.createCanvas('enemy_goblin', 16, 16);
    const ctx = canvas.getContext();
    // Head (greenish skin)
    ctx.fillStyle = '#6b8e23';
    ctx.fillRect(5, 1, 6, 5);
    // Pointy ears
    ctx.fillRect(3, 2, 2, 2);
    ctx.fillRect(11, 2, 2, 2);
    // Eyes (angry red)
    ctx.fillStyle = '#ff3333';
    ctx.fillRect(6, 3, 2, 1);
    ctx.fillRect(9, 3, 2, 1);
    // Body (dark vest)
    ctx.fillStyle = '#4a3520';
    ctx.fillRect(5, 6, 6, 5);
    // Arms (green skin)
    ctx.fillStyle = '#6b8e23';
    ctx.fillRect(3, 7, 2, 4);
    ctx.fillRect(11, 7, 2, 4);
    // Club in right hand
    ctx.fillStyle = '#8b6914';
    ctx.fillRect(13, 4, 2, 6);
    ctx.fillStyle = '#6b4f0a';
    ctx.fillRect(13, 3, 2, 2);
    // Legs
    ctx.fillStyle = '#6b8e23';
    ctx.fillRect(5, 11, 2, 3);
    ctx.fillRect(9, 11, 2, 3);
    // Feet
    ctx.fillStyle = '#4a3520';
    ctx.fillRect(5, 14, 3, 2);
    ctx.fillRect(9, 14, 3, 2);
    canvas.refresh();
  }

  _generateSkeleton() {
    const canvas = this.textures.createCanvas('enemy_skeleton', 16, 16);
    const ctx = canvas.getContext();
    // Skull
    ctx.fillStyle = '#e0ddd0';
    ctx.fillRect(5, 0, 6, 5);
    // Eye sockets
    ctx.fillStyle = '#222222';
    ctx.fillRect(6, 2, 2, 2);
    ctx.fillRect(9, 2, 2, 2);
    // Jaw
    ctx.fillStyle = '#c0bcb0';
    ctx.fillRect(6, 4, 4, 1);
    // Spine
    ctx.fillStyle = '#e0ddd0';
    ctx.fillRect(7, 5, 2, 2);
    // Ribcage
    ctx.fillStyle = '#d0cdc0';
    ctx.fillRect(4, 7, 8, 3);
    // Rib lines (dark gaps)
    ctx.fillStyle = '#333333';
    ctx.fillRect(5, 7, 1, 3);
    ctx.fillRect(7, 7, 1, 3);
    ctx.fillRect(9, 7, 1, 3);
    ctx.fillRect(11, 7, 1, 3);
    // Pelvis
    ctx.fillStyle = '#e0ddd0';
    ctx.fillRect(5, 10, 6, 1);
    // Legs (bones)
    ctx.fillStyle = '#e0ddd0';
    ctx.fillRect(5, 11, 2, 4);
    ctx.fillRect(9, 11, 2, 4);
    // Arms
    ctx.fillRect(2, 7, 2, 4);
    ctx.fillRect(12, 7, 2, 4);
    // Joint dots
    ctx.fillStyle = '#c0bcb0';
    ctx.fillRect(3, 10, 1, 1);
    ctx.fillRect(13, 10, 1, 1);
    canvas.refresh();
  }

  _generateEnemyGoblinKing() {
    const canvas = this.textures.createCanvas('enemy_goblin_king', 24, 24);
    const ctx = canvas.getContext();
    // Body (golden/orange)
    ctx.fillStyle = '#ff9900';
    ctx.fillRect(4, 6, 16, 14);
    // Crown
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(6, 2, 12, 4);
    ctx.fillRect(4, 0, 2, 4);
    ctx.fillRect(10, 0, 4, 4);
    ctx.fillRect(18, 0, 2, 4);
    // Eyes
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(6, 10, 4, 2);
    ctx.fillRect(14, 10, 4, 2);
    // Loincloth
    ctx.fillStyle = '#8b2500';
    ctx.fillRect(8, 20, 8, 4);
    // Huge club
    ctx.fillStyle = '#4a2a0a';
    ctx.fillRect(18, 4, 6, 16);
    ctx.fillStyle = '#8b6914';
    ctx.fillRect(19, 5, 4, 14);
    // Spikes on club
    ctx.fillStyle = '#cccccc';
    ctx.fillRect(17, 6, 2, 2);
    ctx.fillRect(23, 10, 2, 2);
    ctx.fillRect(17, 14, 2, 2);
    
    canvas.refresh();
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
