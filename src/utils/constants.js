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
// Size in tiles of each map
export const MAP_SIZES = {
  guild: { width: 40, height: 30 },
  deeproot: { width: 60, height: 45 },
  cueva_goblin: { width: 60, height: 45 },
};

export function getMapSize(mapId) {
  return MAP_SIZES[mapId] || MAP_SIZES.deeproot;
}

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
  GUILD_BANNER: 29,
  RECEPTION_DESK: 30,
  GUILD_WALL_TORCH: 31,
  GUILD_RUG: 32,
  GUILD_PLANT: 33,
  TRAINING_DUMMY: 34,
  GUILD_FLAGSTONE: 35,
  GUILD_CHEST: 36,
  SIGN_EXIT: 37,
  SIGN_ARENA: 38,
  ARENA_DUMMY: 39,
  BUSH: 40,
  ROCK: 41,
  MUSHROOMS: 42,
  GUILD_ROOF: 43,
  GUILD_FACADE: 44,
  GUILD_WINDOW: 45,
  GUILD_DOOR_LEFT: 46,
  GUILD_DOOR_RIGHT: 47,
  GUILD_FLAG: 48,
  PULLUP_BAR: 49,
  PARALLEL_BARS: 50,
  LIFT_STONES: 51,
  LOG_BENCH: 52,
  TRACK_LINE: 53,
  TIRE: 54,
  KETTLEBELLS: 55,
  BALANCE_BEAM: 56,
  FOUNTAIN: 57,
  YOGA_MAT: 58,
  LILY_PAD: 59,
  TENT_TOP_LEFT: 60,
  TENT_TOP_RIGHT: 61,
  TENT_BOTTOM_LEFT: 62,
  TENT_BOTTOM_RIGHT: 63,
  CAMPFIRE: 64,
  FENCE_H: 65,
  FENCE_V: 66,
  SKULL_POLE: 67,
  CLIFF_TOP: 68,
  CLIFF: 69,
};

// Cave mouth (4×2, ids 70-77) and the autotile edge variants of water (78-92)
// and dirt (93-107). An edge variant's mask lists the sides that border other
// terrain: 1 north, 2 east, 4 south, 8 west.
const CAVE_MOUTH_FIRST = 70;
for (let i = 0; i < 8; i++) TILES[`CAVE_MOUTH_${i}`] = CAVE_MOUTH_FIRST + i;
for (let mask = 1; mask < 16; mask++) TILES[`WATER_EDGE_${mask}`] = 77 + mask;
for (let mask = 1; mask < 16; mask++) TILES[`DIRT_EDGE_${mask}`] = 92 + mask;

export const waterTile = (mask) => (mask ? TILES[`WATER_EDGE_${mask}`] : TILES.WATER);
export const dirtTile = (mask) => (mask ? TILES[`DIRT_EDGE_${mask}`] : TILES.DIRT);

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
  TILES.GUILD_BANNER,
  TILES.RECEPTION_DESK,
  TILES.GUILD_WALL_TORCH,
  TILES.GUILD_PLANT,
  TILES.TRAINING_DUMMY,
  TILES.GUILD_CHEST,
  TILES.SIGN_EXIT,
  TILES.SIGN_ARENA,
  TILES.ARENA_DUMMY,
  TILES.BUSH,
  TILES.ROCK,
  TILES.GUILD_ROOF,
  TILES.GUILD_FACADE,
  TILES.GUILD_WINDOW,
  TILES.GUILD_FLAG,
  TILES.PULLUP_BAR,
  TILES.PARALLEL_BARS,
  TILES.LIFT_STONES,
  TILES.LOG_BENCH,
  TILES.TIRE,
  TILES.KETTLEBELLS,
  TILES.BALANCE_BEAM,
  TILES.FOUNTAIN,
  TILES.LILY_PAD,
  TILES.TENT_TOP_LEFT,
  TILES.TENT_TOP_RIGHT,
  TILES.TENT_BOTTOM_LEFT,
  TILES.TENT_BOTTOM_RIGHT,
  TILES.CAMPFIRE,
  TILES.FENCE_H,
  TILES.FENCE_V,
  TILES.SKULL_POLE,
  TILES.CLIFF_TOP,
  TILES.CLIFF,
  ...Array.from({ length: 15 }, (_, i) => TILES[`WATER_EDGE_${i + 1}`]),
];

// ── Tile Colors (16-bit pixel-art palette) ───────────────────
// Each tile has primary, secondary, and detail colors for
// procedural rendering with visual variety.
export const TILE_COLORS = {
  [TILES.WALL_STONE]:   { primary: 0x6b6b6b, secondary: 0x7b7b7b, detail: 0x5b5b5b },
  [TILES.HOUSE_WALL]:   { primary: 0xc4a35a, secondary: 0xd4b36a, detail: 0xb4934a },
  [TILES.HOUSE_DOOR]:   { primary: 0x5a3a1a, secondary: 0x6a4a2a, detail: 0xffd700 },
  [TILES.HOUSE_ROOF]:   { primary: 0x8b2500, secondary: 0x9b3510, detail: 0x7b1500 },
  [TILES.SAND]:         { primary: 0xe8d5b7, secondary: 0xd8c5a7, detail: 0xf0ddc0 },
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
