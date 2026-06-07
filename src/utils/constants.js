// ============================================================
// Gains & Goblins — Game Constants
// All configuration values as named ES module exports
// ============================================================

// ── Display ──────────────────────────────────────────────────
export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;
export const TILE_SIZE = 16;
export const SCALE = 1; // Phaser will handle zoom

// ── Map ──────────────────────────────────────────────────────
export const MAP_WIDTH = 60;  // tiles
export const MAP_HEIGHT = 45; // tiles

// ── Player ───────────────────────────────────────────────────
export const PLAYER_SPEED = 120;
export const PLAYER_ATTACK_COOLDOWN = 400; // ms
export const PLAYER_ATTACK_RANGE = 24;     // pixels

// ── Weapons ──────────────────────────────────────────────────
// Each weapon has different stats and scales with a specific stat branch.
export const WEAPONS = {
  SWORD: {
    name: 'Espada',
    key: 'sword',
    damage: 10,
    speed: 1.0,
    range: 20,
    color: 0xc0c0c0, // silver
    statBranch: 'strength',
    icon: '⚔️',
  },
  BOW: {
    name: 'Arco',
    key: 'bow',
    damage: 7,
    speed: 1.5,
    range: 120,
    color: 0x8b4513, // saddlebrown
    statBranch: 'dexterity',
    icon: '🏹',
  },
  MAGIC: {
    name: 'Magia',
    key: 'magic',
    damage: 12,
    speed: 0.7,
    range: 100,
    manaCost: 8,
    color: 0xa855f7, // purple
    statBranch: 'intelligence',
    icon: '✨',
  },
};

// ── Base Stats ───────────────────────────────────────────────
// No classes — every new character starts with identical stats.
// Stats grow based on real-world activities the player logs.
export const BASE_STATS = {
  strength: 5,      // Espada — Ejercicio de fuerza
  resistance: 5,    // Espada — Ejercicio intenso
  dexterity: 5,     // Arco — Cardio
  speed: 5,         // Arco — Cardio de alta intensidad
  intelligence: 5,  // Magia — Lectura/estudio
  maxMana: 20,      // Magia — Lectura sostenida
  willpower: 5,     // Meditación — Yoga/meditación
  charisma: 5,      // Social — Journaling/escritura
};

// ── Stat Display Names (Spanish) ─────────────────────────────
export const STAT_NAMES = {
  strength: 'Fuerza',
  resistance: 'Resistencia',
  dexterity: 'Destreza',
  speed: 'Velocidad',
  intelligence: 'Inteligencia',
  maxMana: 'Mana Máx',
  willpower: 'Voluntad',
  charisma: 'Carisma',
};

// ── Activities (Real Life Habits) ────────────────────────────
// Each activity grants a point to a BRANCH (not a stat directly).
// The player then CHOOSES which stat to upgrade within that branch.
export const ACTIVITIES = {
  STRENGTH: { id: 'strength', name: 'Ejercicio de Fuerza (Pesas)',    branch: 'strength',     xpReward: 50 },
  INTENSE:  { id: 'intense',  name: 'Entrenamiento Intenso (HIIT)',    branch: 'dexterity',    xpReward: 50 },
  CARDIO:   { id: 'cardio',   name: 'Cardio Lento (Caminar/Bici)',     branch: 'dexterity',    xpReward: 50 },
  RUNNING:  { id: 'running',  name: 'Correr / Sprint',                 branch: 'dexterity',    xpReward: 50 },
  STUDY:    { id: 'study',    name: 'Estudiar / Leer (Aprender)',       branch: 'intelligence', xpReward: 50 },
  READING:  { id: 'reading',  name: 'Lectura de Ocio',                 branch: 'intelligence', xpReward: 50 },
  MEDITATION:{ id: 'meditation', name: 'Meditación / Yoga',            branch: 'willpower',    xpReward: 50 },
  SOCIAL:   { id: 'social',   name: 'Socializar / Journaling',         branch: 'willpower',    xpReward: 50 },
};

// ── Branches (Stat Trees) ─────────────────────────────────────
// Each branch groups related stats the player can upgrade.
// Activities grant points to a branch; player chooses where to spend.
export const BRANCHES = {
  strength: {
    name: 'Fuerza',
    icon: '⚔️',
    color: '#e74c3c',
    stats: [
      { key: 'strength',   label: 'Fuerza',      desc: '+Daño con Espada' },
      { key: 'resistance', label: 'Resistencia',  desc: '+Vida Máxima'    },
    ],
  },
  dexterity: {
    name: 'Destreza',
    icon: '🏹',
    color: '#27ae60',
    stats: [
      { key: 'dexterity', label: 'Destreza', desc: '+Daño con Arco'    },
      { key: 'speed',     label: 'Velocidad', desc: '+Velocidad'        },
    ],
  },
  intelligence: {
    name: 'Inteligencia',
    icon: '✨',
    color: '#9b59b6',
    stats: [
      { key: 'intelligence', label: 'Inteligencia', desc: '+Daño con Magia'   },
      { key: 'maxMana',      label: 'Maná Máximo',  desc: '+Reserva de Maná'  },
    ],
  },
  willpower: {
    name: 'Voluntad',
    icon: '🧘',
    color: '#1abc9c',
    stats: [
      { key: 'willpower', label: 'Voluntad', desc: '+Regen. de Maná'   },
      { key: 'charisma',  label: 'Carisma',  desc: '+Precios en tienda' },
    ],
  },
};

// ── Tile Types for Map Generation ────────────────────────────
export const TILES = {
  GRASS: 0,
  GRASS_FLOWER: 1,
  DIRT: 2,
  WATER: 3,
  WALL_STONE: 4,
  TREE_TRUNK: 5,
  TREE_TOP: 6,
  HOUSE_WALL: 7,
  HOUSE_DOOR: 8,
  HOUSE_ROOF: 9,
  BRIDGE: 10,
  STONE_PATH: 11,
  DARK_GRASS: 12,
  SAND: 13,
  CHEST: 14,
  SIGN: 15,
  GUILD_FLOOR: 16,
  GUILD_WALL: 17,
  DUMBBELL_RACK: 18,
  CARDIO_ZONE: 19,
  BOOKSHELF: 20,
  MEDITATION_MAT: 21,
  ARENA_FLOOR: 22,
  BULLETIN_BOARD: 23,
  DUNGEON_FLOOR: 24,
  DUNGEON_WALL: 25,
  LAVA: 26,
  CAVE_ENTRANCE: 27,
  STUDY_TABLE: 28,
};

// ── Solid Tiles (impassable) ─────────────────────────────────
export const SOLID_TILES = [
  TILES.WALL_STONE,
  TILES.TREE_TRUNK,
  TILES.TREE_TOP,
  TILES.HOUSE_WALL,
  TILES.HOUSE_ROOF,
  TILES.WATER,
  TILES.CHEST,
  TILES.GUILD_WALL,
  TILES.DUMBBELL_RACK,
  TILES.BOOKSHELF,
  TILES.BULLETIN_BOARD,
  TILES.DUNGEON_WALL,
  TILES.LAVA,
  TILES.STUDY_TABLE,
];

// ── Tile Colors (16-bit pixel-art palette) ───────────────────
// Each tile has primary, secondary, and detail colors for
// procedural rendering with visual variety.
export const TILE_COLORS = {
  [TILES.GRASS]:        { primary: 0x4a7c2e, secondary: 0x5a8c3e, detail: 0x3a6c1e },
  [TILES.GRASS_FLOWER]: { primary: 0x4a7c2e, secondary: 0x5a8c3e, detail: 0xff6b6b },
  [TILES.DIRT]:         { primary: 0x8b6914, secondary: 0x9b7924, detail: 0x7b5904 },
  [TILES.WATER]:        { primary: 0x2d9cdb, secondary: 0x1a6b8a, detail: 0x7ec8e3 },
  [TILES.WALL_STONE]:   { primary: 0x6b6b6b, secondary: 0x7b7b7b, detail: 0x5b5b5b },
  [TILES.TREE_TRUNK]:   { primary: 0x5a3a1a, secondary: 0x6a4a2a, detail: 0x4a2a0a },
  [TILES.TREE_TOP]:     { primary: 0x2d5016, secondary: 0x3d6026, detail: 0x1d4006 },
  [TILES.HOUSE_WALL]:   { primary: 0xc4a35a, secondary: 0xd4b36a, detail: 0xb4934a },
  [TILES.HOUSE_DOOR]:   { primary: 0x5a3a1a, secondary: 0x6a4a2a, detail: 0xffd700 },
  [TILES.HOUSE_ROOF]:   { primary: 0x8b2500, secondary: 0x9b3510, detail: 0x7b1500 },
  [TILES.BRIDGE]:       { primary: 0x8b6914, secondary: 0x7b5904, detail: 0x5a3a1a },
  [TILES.STONE_PATH]:   { primary: 0x9b9b8b, secondary: 0x8b8b7b, detail: 0xababab },
  [TILES.DARK_GRASS]:   { primary: 0x2d5016, secondary: 0x3d6026, detail: 0x1d4006 },
  [TILES.SAND]:         { primary: 0xe8d5b7, secondary: 0xd8c5a7, detail: 0xf0ddc0 },
  [TILES.CHEST]:        { primary: 0x8b6914, secondary: 0xffd700, detail: 0x5a3a1a },
  [TILES.SIGN]:         { primary: 0x8b6914, secondary: 0x5a3a1a, detail: 0xc4a35a },
  [TILES.GUILD_FLOOR]:  { primary: 0x4a3b2c, secondary: 0x5a4b3c, detail: 0x3a2b1c }, // Polished wood
  [TILES.GUILD_WALL]:   { primary: 0x2c3e50, secondary: 0x34495e, detail: 0x1a252f }, // Elegant dark stone
  [TILES.DUMBBELL_RACK]:{ primary: 0x7f8c8d, secondary: 0x95a5a6, detail: 0x2c3e50 }, // Metal and iron weights
  [TILES.CARDIO_ZONE]:  { primary: 0x8e44ad, secondary: 0x9b59b6, detail: 0x2c3e50 }, // Purple mats/dummies
  [TILES.BOOKSHELF]:    { primary: 0x5c4033, secondary: 0x3e2723, detail: 0xd4af37 }, // Wood and gold-trimmed books
  [TILES.MEDITATION_MAT]:{primary: 0x16a085, secondary: 0x1abc9c, detail: 0xf1c40f }, // Teal mats with incense
  [TILES.ARENA_FLOOR]:  { primary: 0xc0392b, secondary: 0xe74c3c, detail: 0x7f8c8d }, // Reddish combat floor
  [TILES.BULLETIN_BOARD]:{ primary: 0x7d4e00, secondary: 0xffd700, detail: 0xe8d5b7 }, // Wooden board with gold notices
  [TILES.DUNGEON_FLOOR]: { primary: 0x2b2b2b, secondary: 0x3b3b3b, detail: 0x1b1b1b }, // Dark stone floor
  [TILES.DUNGEON_WALL]:  { primary: 0x111111, secondary: 0x222222, detail: 0x050505 }, // Pitch black/dark grey wall
  [TILES.LAVA]:          { primary: 0xff4500, secondary: 0xd93800, detail: 0xff8c00 }, // Bright orange/red lava
  [TILES.CAVE_ENTRANCE]: { primary: 0x111111, secondary: 0x000000, detail: 0x333333 }, // Black void entrance
  [TILES.STUDY_TABLE]:   { primary: 0x8b5a2b, secondary: 0x5c4033, detail: 0xd4af37 }, // Wooden desk and chair
};

// ── Enemy Types ──────────────────────────────────────────────
export const ENEMIES = {
  SLIME: {
    name: 'Slime',
    hp: 20,
    damage: 3,
    speed: 40,
    xp: 10,
    color: 0x4caf50,
    size: 12,
    aggroRange: 80,
    patrolRange: 60,
    defense: 0,
  },
  GOBLIN: {
    name: 'Goblin',
    hp: 70,
    damage: 11,
    speed: 25,
    xp: 25,
    color: 0x7cb342,
    size: 14,
    aggroRange: 100,
    patrolRange: 80,
    defense: 3,
  },
  GOBLIN_BOW: {
    name: 'Goblin Arquero',
    hp: 20,
    damage: 3,
    speed: 75,
    xp: 25,
    color: 0x8bc34a,
    size: 13,
    aggroRange: 140,
    patrolRange: 80,
    defense: 0,
  },
  GOBLIN_MAGE: {
    name: 'Goblin Mago',
    hp: 8,
    damage: 18,
    speed: 30,
    xp: 30,
    color: 0x9b59b6,
    size: 13,
    aggroRange: 130,
    patrolRange: 60,
    defense: 0,
  },
  SKELETON: {
    name: 'Esqueleto',
    hp: 50,
    damage: 9,
    speed: 45,
    xp: 40,
    color: 0xe0e0e0,
    size: 14,
    aggroRange: 120,
    patrolRange: 70,
    defense: 1,
  },
  GOBLIN_KING: {
    name: 'Rey Goblin',
    hp: 400,
    damage: 15,
    speed: 50,
    xp: 300,
    color: 0xff9900, // Golden/Orange goblin
    size: 24,        // Big boss
    aggroRange: 180,
    patrolRange: 100,
    isBoss: true,
    defense: 5,
  },
};

// ── UI Colors ────────────────────────────────────────────────
export const UI_COLORS = {
  HEALTH: { start: '#ff4444', end: '#e94560' },
  MANA:   { start: '#4488ff', end: '#6c3483' },
  XP:     { start: '#ffd700', end: '#ff8c00' },
  BG:             'rgba(10, 10, 30, 0.85)',
  BORDER:         'rgba(255, 215, 0, 0.3)',
  TEXT_PRIMARY:   '#ffd700',
  TEXT_SECONDARY: '#e8d5b7',
  TEXT_DIM:       '#8b8b8b',
};

// ── Scene Keys ───────────────────────────────────────────────
export const SCENES = {
  BOOT: 'Boot',
  PRELOAD: 'Preload',
  MENU: 'Menu',
  WORLD: 'World',
  UI: 'UI',
};
