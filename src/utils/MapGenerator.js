import { getMapSize, TILES, ENEMIES, waterTile, dirtTile } from './constants.js';
import { DEEPROOT_LAYOUT, DEEPROOT_CHEST_SPOTS, DEEPROOT_ENEMIES } from './deeprootLayout.js';

const GUILD = getMapSize('guild');

export function generateMap(mapId, width, height) {
  if (mapId === 'deeproot') {
    return _generateDeeproot();
  } else if (mapId === 'cueva_goblin') {
    return _generateDungeon(width, height);
  }
  return _generateGuild(width, height);
}

// The guild is a building of six rooms around a central hall (40×30):
// weights and cardio to the west, library, meditation and practice arena to the
// east, and the entrance to Deeproot at the bottom of the hall.
function _generateGuild(width, height) {
  const T = TILES;
  const mapData = Array.from({ length: height }, () => Array(width).fill(T.GUILD_FLOOR));
  const set = (x, y, tile) => { mapData[y][x] = tile; };
  const fillRect = (x0, y0, x1, y1, tile) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, tile);
  };
  const hWall = (y, x0, x1, gaps = []) => {
    for (let x = x0; x <= x1; x++) set(x, y, gaps.includes(x) ? T.GUILD_FLOOR : T.GUILD_WALL);
  };
  const vWall = (x, y0, y1, gaps = []) => {
    for (let y = y0; y <= y1; y++) set(x, y, gaps.includes(y) ? T.GUILD_FLOOR : T.GUILD_WALL);
  };

  // Outer walls; the doorway at the bottom center leads to Deeproot
  hWall(0, 0, width - 1);
  hWall(height - 1, 0, width - 1, [19, 20]);
  vWall(0, 0, height - 1);
  vWall(width - 1, 0, height - 1);

  // West wing (weights above, cardio below) and east wing (library, meditation, arena)
  vWall(13, 1, height - 2, [7, 8, 21, 22]);
  hWall(14, 1, 12, [6, 7]);
  vWall(26, 1, height - 2, [5, 6, 14, 15, 23, 24]);
  hWall(10, 27, 38, [32, 33]);
  hWall(19, 27, 38);

  for (const x of [3, 9, 16, 23, 30, 36]) set(x, 0, T.GUILD_WALL_TORCH);
  for (const x of [6, 19, 20, 33]) set(x, 0, T.GUILD_BANNER);

  // Hall: stone vestibule, red runner up to the reception counter, missions board
  fillRect(14, 22, 25, 28, T.GUILD_FLAGSTONE);
  for (let y = 6; y <= 28; y++) { set(19, y, T.GUILD_RUG); set(20, y, T.GUILD_RUG); }
  // Counter on both sides of the receptionist (x=20, y=4) so players can still reach her
  for (const x of [17, 18, 21, 22]) set(x, 4, T.RECEPTION_DESK);
  set(15, 9, T.BULLETIN_BOARD);
  for (const [x, y] of [[14, 1], [25, 1], [14, 21]]) set(x, y, T.GUILD_PLANT);
  set(17, 27, T.SIGN_EXIT);
  set(25, 21, T.SIGN_ARENA);

  // Weights room
  for (const y of [1, 4]) for (const x of [2, 3, 4, 8, 9, 10, 11]) set(x, y, T.DUMBBELL_RACK);
  set(3, 9, T.TRAINING_DUMMY);
  set(10, 9, T.TRAINING_DUMMY);
  set(1, 12, T.GUILD_PLANT);
  set(12, 12, T.GUILD_PLANT);

  // Cardio room
  for (const y of [16, 19, 22, 25]) for (const x of [2, 4, 6, 8, 10]) set(x, y, T.CARDIO_ZONE);
  set(1, 27, T.GUILD_PLANT);
  set(12, 27, T.GUILD_PLANT);

  // Library
  for (let x = 27; x <= 38; x++) set(x, 1, T.BOOKSHELF);
  for (const x of [28, 29, 30, 35, 36, 37]) set(x, 4, T.BOOKSHELF);
  set(30, 7, T.STUDY_TABLE);
  set(35, 7, T.STUDY_TABLE);
  set(27, 9, T.GUILD_PLANT);
  set(38, 9, T.GUILD_PLANT);

  // Meditation room
  for (const y of [12, 15]) for (const x of [28, 31, 34, 37]) set(x, y, T.MEDITATION_MAT);
  for (const [x, y] of [[27, 11], [38, 11], [27, 18], [38, 18]]) set(x, y, T.GUILD_PLANT);

  // Practice arena
  fillRect(27, 20, 38, 28, T.ARENA_FLOOR);
  set(28, 21, T.ARENA_DUMMY);
  set(37, 21, T.ARENA_DUMMY);

  return mapData;
}

export function getChestSpawns(mapId, mapData, count = 5) {
  if (mapId === 'deeproot') return DEEPROOT_CHEST_SPOTS.map((spot) => ({ ...spot }));

  const height = mapData.length;
  const width  = mapData[0].length;

  // Define which tile types are valid floors for chest placement per map
  let validTiles;
  if (mapId === 'cueva_goblin') {
    validTiles = new Set([TILES.DUNGEON_FLOOR]);
  } else {
    // guild — place on guild floor only, away from walls
    validTiles = new Set([TILES.GUILD_FLOOR]);
  }

  // Collect all candidate positions (at least 3 tiles from border to avoid overlap)
  const candidates = [];
  const margin = 3;
  for (let y = margin; y < height - margin; y++) {
    for (let x = margin; x < width - margin; x++) {
      if (validTiles.has(mapData[y][x])) {
        candidates.push({ x, y });
      }
    }
  }

  // Fisher-Yates shuffle then take first `count` items
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  return candidates.slice(0, count);
}

// Character codes of DEEPROOT_LAYOUT (see deeprootLayout.js); dirt and water
// are resolved separately so their edges match the neighbouring tiles
const DEEPROOT_CODES = {
  C: TILES.TREE_TOP, e: TILES.TREE_TRUNK, g: TILES.GRASS, v: TILES.GRASS_FLOWER, Y: TILES.DARK_GRASS,
  h: TILES.BUSH, r: TILES.ROCK, m: TILES.MUSHROOMS, y: TILES.LILY_PAD, D: TILES.BRIDGE,
  p: TILES.STONE_PATH, o: TILES.GUILD_ROOF, f: TILES.GUILD_FACADE, W: TILES.GUILD_WINDOW,
  '(': TILES.GUILD_DOOR_LEFT, ')': TILES.GUILD_DOOR_RIGHT, F: TILES.GUILD_FLAG,
  P: TILES.PULLUP_BAR, B: TILES.PARALLEL_BARS, L: TILES.LIFT_STONES, b: TILES.LOG_BENCH,
  l: TILES.TRACK_LINE, O: TILES.TIRE, Q: TILES.KETTLEBELLS, Z: TILES.BALANCE_BEAM,
  U: TILES.FOUNTAIN, M: TILES.YOGA_MAT,
  '[': TILES.TENT_TOP_LEFT, ']': TILES.TENT_TOP_RIGHT, '{': TILES.TENT_BOTTOM_LEFT, '}': TILES.TENT_BOTTOM_RIGHT,
  c: TILES.CAMPFIRE, '-': TILES.FENCE_H, '|': TILES.FENCE_V, s: TILES.SKULL_POLE, S: TILES.SIGN,
  k: TILES.CLIFF_TOP, K: TILES.CLIFF,
};
for (let i = 0; i < 8; i++) DEEPROOT_CODES[String(i)] = TILES[`CAVE_MOUTH_${i}`];

// Codes drawn on top of dirt or water count as that terrain when picking edges
const DIRT_LIKE = new Set(['d', 'l', '[', ']', '{', '}', 'c', 's']);
const WATER_LIKE = new Set(['w', 'y', 'D']);

function _edgeMask(layout, x, y, sameTerrain) {
  let mask = 0;
  const sides = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]];
  for (const [dx, dy, bit] of sides) {
    const code = layout[y + dy]?.[x + dx];
    if (code !== undefined && !sameTerrain.has(code)) mask |= bit;
  }
  return mask;
}

function _generateDeeproot() {
  return DEEPROOT_LAYOUT.map((row, y) => [...row].map((code, x) => {
    if (code === 'd') return dirtTile(_edgeMask(DEEPROOT_LAYOUT, x, y, DIRT_LIKE));
    if (code === 'w') return waterTile(_edgeMask(DEEPROOT_LAYOUT, x, y, WATER_LIKE));
    return DEEPROOT_CODES[code];
  }));
}

function _generateDungeon(width, height) {
  const mapData = [];
  
  // Fill with solid walls initially
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      row.push(TILES.DUNGEON_WALL);
    }
    mapData.push(row);
  }

  // Helper to carve rooms/paths
  const carve = (sx, sy, w, h) => {
    for (let y = sy; y < sy + h; y++) {
      for (let x = sx; x < sx + w; x++) {
        if (x > 0 && x < width - 1 && y > 0 && y < height - 1) {
          mapData[y][x] = TILES.DUNGEON_FLOOR;
        }
      }
    }
  };

  // Entrance area (top)
  carve(25, 1, 10, 8);
  
  // Winding corridors
  carve(28, 8, 4, 15);
  carve(15, 20, 15, 4);
  carve(15, 20, 4, 10);
  
  // Small side rooms
  carve(10, 25, 8, 8);
  carve(35, 12, 10, 6);
  
  // Path to boss room
  carve(15, 30, 20, 4);
  carve(32, 25, 4, 15);
  
  // Boss Room (bottom center/right)
  carve(30, 32, 20, 10);

  const addLava = (sx, sy, w, h) => {
    for (let y = sy; y < sy + h; y++) {
      for (let x = sx; x < sx + w; x++) {
        mapData[y][x] = TILES.LAVA;
      }
    }
  };
  addLava(12, 27, 4, 4);
  addLava(38, 13, 5, 3);
  addLava(45, 33, 4, 8); // Boss room hazard

  return mapData;
}

export function getSpawnPoint(mapId, spawnId) {
  if (mapId === 'deeproot') {
    // On the plaza in front of the guild door, or on the path above the cave
    if (spawnId === 'from_cueva_goblin') return { x: 30, y: 37 };
    return { x: 30, y: 5 };
  }
  if (mapId === 'cueva_goblin') {
    if (spawnId === 'from_deeproot') return { x: 30, y: 5 }; // Top entrance
    return { x: 30, y: 5 };
  }
  if (mapId === 'guild') {
    // Both land in the stone vestibule, on the runner facing the reception
    if (spawnId === 'from_deeproot') return { x: 20, y: 26 };
    return { x: 20, y: 24 };
  }

  return { x: 30, y: 15 };
}

export function getEnemySpawns(mapId) {
  const spawns = [];
  
  if (mapId === 'deeproot') {
    // Each enemy keeps to its zone, nudged a little so respawns don't stack
    for (const enemy of DEEPROOT_ENEMIES) {
      spawns.push({ ...enemy, x: enemy.x + Math.random() - 0.5, y: enemy.y + Math.random() - 0.5 });
    }
  } else if (mapId === 'cueva_goblin') {
    // Melee goblins - moved out of the entrance corridor
    for (let i = 0; i < 3; i++) {
      spawns.push({ x: 36 + Math.random()*8, y: 13 + Math.random()*4, type: ENEMIES.GOBLIN });
    }
    for (let i = 0; i < 3; i++) {
      spawns.push({ x: 28 + Math.random()*4, y: 18 + Math.random()*4, type: ENEMIES.GOBLIN });
    }
    // Archer goblins - moved out of the entrance corridor
    for (let i = 0; i < 4; i++) {
      spawns.push({ x: 37 + Math.random()*6, y: 14 + Math.random()*3, type: ENEMIES.GOBLIN_BOW });
    }
    // Mage goblins - moved out of the entrance corridor
    for (let i = 0; i < 3; i++) {
      spawns.push({ x: 11 + Math.random()*6, y: 26 + Math.random()*6, type: ENEMIES.GOBLIN_MAGE });
    }
    // Skeletons - reduced quantity slightly for spacing
    for (let i = 0; i < 5; i++) {
      spawns.push({ x: 12 + Math.random()*6, y: 27 + Math.random()*4, type: ENEMIES.SKELETON });
    }
    for (let i = 0; i < 5; i++) {
      spawns.push({ x: 32 + Math.random()*4, y: 26 + Math.random()*6, type: ENEMIES.SKELETON });
    }
    // The Boss
    spawns.push({ x: 40, y: 37, type: ENEMIES.GOBLIN_KING });
  } else {
    // Guild practice arena (x 27-38, y 20-28)
    for(let i=0; i<3; i++) spawns.push({ x: 29 + Math.random()*8, y: 23 + Math.random()*4, type: ENEMIES.SLIME });
    for(let i=0; i<3; i++) spawns.push({ x: 29 + Math.random()*8, y: 23 + Math.random()*4, type: ENEMIES.GOBLIN });
    spawns.push({ x: 33, y: 25, type: ENEMIES.SKELETON });
  }

  return spawns;
}

// Signposts with their own text; other signs show a random tutorial tip
const SIGN_TEXTS = {
  deeproot: {
    '22,6': '⬅ Parque de entrenamiento · ➡ Lago · ⬇ Cueva Goblin',
    '21,17': 'Parque de entrenamiento de Deeproot. Abierto 24 horas. Las excusas se quedan en la entrada.',
    '35,21': 'Lago de Deeproot. Prohibido bañarse: los Slimes lo consideran su piscina privada.',
    '27,37': '⚠ Cueva Goblin. Entra con la espada, sale con las pantorrillas.',
  },
};

export function getSignText(mapId, x, y) {
  return SIGN_TEXTS[mapId]?.[`${x},${y}`] ?? null;
}

export function getTransitions(mapId) {
  if (mapId === 'guild') {
    return [
      { 
        x: 19, y: GUILD.height - 2, w: 2, h: 2,
        targetMap: 'deeproot', targetSpawnId: 'from_guild'
      }
    ];
  } else if (mapId === 'deeproot') {
    return [
      // The guild's double door and the cave mouth
      { x: 29, y: 3, w: 2, h: 1, targetMap: 'guild', targetSpawnId: 'from_deeproot' },
      { x: 28, y: 39, w: 4, h: 2, targetMap: 'cueva_goblin', targetSpawnId: 'from_deeproot' },
    ];
  } else if (mapId === 'cueva_goblin') {
    return [
      {
        x: 25, y: 0, w: 10, h: 2,
        targetMap: 'deeproot', targetSpawnId: 'from_cueva_goblin'
      }
    ];
  }
  return [];
}
