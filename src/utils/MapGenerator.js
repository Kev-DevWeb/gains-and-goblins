import { MAP_WIDTH, MAP_HEIGHT, TILES, ENEMIES } from './constants.js';

export function generateMap(mapId, width, height) {
  if (mapId === 'deeproot') {
    return _generateDeeproot(width, height);
  } else if (mapId === 'cueva_goblin') {
    return _generateDungeon(width, height);
  }
  return _generateGuild(width, height);
}

function _generateGuild(width, height) {
  const mapData = [];
  
  // Fill everything with Guild Floor first
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      row.push(TILES.GUILD_FLOOR);
    }
    mapData.push(row);
  }

  // Guild Walls (Border of the whole map)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        mapData[y][x] = TILES.GUILD_WALL;
      }
    }
  }

  // Helper to draw rectangles
  const fillRect = (startX, startY, w, h, tile) => {
    for (let y = startY; y < startY + h; y++) {
      for (let x = startX; x < startX + w; x++) {
        if (x > 0 && x < width - 1 && y > 0 && y < height - 1) {
          mapData[y][x] = tile;
        }
      }
    }
  };

  // --- ZONAS ---

  // 1. ZONA DE FUERZA (Pesas) - Arriba Izquierda
  fillRect(5, 5, 10, 8, TILES.DUMBBELL_RACK);
  fillRect(15, 5, 1, 8, TILES.GUILD_WALL);

  // 2. ZONA DE CARDIO (Destreza/Velocidad) - Abajo Izquierda
  fillRect(5, 20, 10, 8, TILES.CARDIO_ZONE);
  fillRect(15, 20, 1, 8, TILES.GUILD_WALL);

  // 3. ZONA DE MAGIA (Inteligencia - Grimorios) - Arriba Derecha
  fillRect(width - 15, 5, 10, 8, TILES.GUILD_FLOOR); 
  fillRect(width - 16, 5, 1, 8, TILES.GUILD_WALL);   
  for(let x = width - 15; x < width - 5; x++) {
    mapData[5][x] = TILES.BOOKSHELF;
    mapData[12][x] = TILES.BOOKSHELF;
  }

  // 4. ZONA DE MEDITACIÓN (Voluntad - Alfombras) - Medio Derecha
  fillRect(width - 15, 18, 10, 8, TILES.MEDITATION_MAT);

  // 5. RECEPCIÓN / TIENDA - Centro Arriba
  fillRect(25, 5, 10, 3, TILES.STONE_PATH); 

  // 6. ARENA DE ENTRENAMIENTO - Abajo Derecha
  fillRect(35, 30, 23, 12, TILES.ARENA_FLOOR);
  for(let x = 35; x <= 58; x++) {
    mapData[29][x] = TILES.GUILD_WALL; 
    mapData[42][x] = TILES.GUILD_WALL; 
  }
  for(let y = 30; y <= 42; y++) {
    mapData[y][35] = TILES.GUILD_WALL; 
    mapData[y][58] = TILES.GUILD_WALL; 
  }
  mapData[29][46] = TILES.GUILD_FLOOR; // Puerta arena

  // Carteles
  mapData[28][36] = TILES.SIGN; 
  mapData[4][28] = TILES.SIGN;  

  // --- TABLÓN DE MISIONES DIARIAS --- (centro del gremio, bien visible)
  mapData[15][20] = TILES.BULLETIN_BOARD; // Tablón principal

  // --- PUERTA PRINCIPAL HACIA DEEPROOT ---
  // Zona inferior centro
  for(let x = 27; x <= 33; x++) {
    mapData[height - 1][x] = TILES.GUILD_FLOOR; // Abrir muro
    mapData[height - 2][x] = TILES.GUILD_FLOOR;
    mapData[height - 3][x] = TILES.STONE_PATH;
  }
  mapData[height - 4][30] = TILES.SIGN; // Cartel de salida al bosque

  return mapData;
}

// ─────────────────────────────────────────────────────────────────────────────
// CHEST SPAWN HELPERS
// Returns an array of { x, y } tile positions for random chest placement.
// Positions are validated against passable tiles for each map type.
// ─────────────────────────────────────────────────────────────────────────────
export function getChestSpawns(mapId, mapData, count = 5) {
  const height = mapData.length;
  const width  = mapData[0].length;

  // Define which tile types are valid floors for chest placement per map
  let validTiles;
  if (mapId === 'cueva_goblin') {
    validTiles = new Set([TILES.DUNGEON_FLOOR]);
  } else if (mapId === 'deeproot') {
    validTiles = new Set([TILES.GRASS, TILES.GRASS_FLOWER, TILES.DARK_GRASS, TILES.DIRT]);
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

function _generateDeeproot(width, height) {
  const mapData = [];
  
  // Base grass
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      if (Math.random() < 0.1) row.push(TILES.GRASS_FLOWER);
      else if (Math.random() < 0.05) row.push(TILES.DARK_GRASS);
      else row.push(TILES.GRASS);
    }
    mapData.push(row);
  }

  // Very dense forest borders (Thick trees)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // 5 tiles thick border of trees
      if (x < 5 || x > width - 6 || y < 5 || y > height - 6) {
        mapData[y][x] = Math.random() > 0.5 ? TILES.TREE_TRUNK : TILES.TREE_TOP;
      }
    }
  }

  // Central dirt path
  for (let y = 0; y < height; y++) {
    for (let x = 25; x <= 35; x++) {
      // Create a winding path using some noise/randomness
      const offset = Math.floor(Math.sin(y / 5) * 4);
      const pathX = x + offset;
      if (pathX > 0 && pathX < width) {
        if (Math.random() > 0.1) {
          mapData[y][pathX] = TILES.DIRT;
        }
      }
    }
  }

  // Entrance from Guild at the top
  for(let x = 27; x <= 33; x++) {
    mapData[0][x] = TILES.STONE_PATH;
    mapData[1][x] = TILES.STONE_PATH;
    mapData[2][x] = TILES.STONE_PATH;
    mapData[3][x] = TILES.STONE_PATH;
    mapData[4][x] = TILES.STONE_PATH;
  }

  // Sign near entrance
  mapData[5][28] = TILES.SIGN;

  // Some scattered water ponds
  for (let i = 0; i < 3; i++) {
    const px = 10 + Math.floor(Math.random() * (width - 20));
    const py = 10 + Math.floor(Math.random() * (height - 20));
    for(let dy=0; dy<4; dy++){
      for(let dx=0; dx<4; dx++){
        mapData[py+dy][px+dx] = TILES.WATER;
      }
    }
  }

  // Cave entrance to the Cueva Goblin at the bottom
  for(let x = 28; x <= 32; x++) {
    mapData[height - 6][x] = TILES.CAVE_ENTRANCE;
    mapData[height - 7][x] = TILES.CAVE_ENTRANCE;
  }
  mapData[height - 8][27] = TILES.SIGN;

  return mapData;
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

  // Add some lava pools
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
    if (spawnId === 'from_guild') return { x: 30, y: 6 };
    if (spawnId === 'from_cueva_goblin') return { x: 30, y: MAP_HEIGHT - 9 };
    return { x: 30, y: 6 };
  }
  if (mapId === 'cueva_goblin') {
    if (spawnId === 'from_deeproot') return { x: 30, y: 5 }; // Top entrance
    return { x: 30, y: 5 };
  }
  if (mapId === 'guild') {
    if (spawnId === 'from_deeproot') return { x: 30, y: MAP_HEIGHT - 5 };
    return { x: 30, y: 17 }; // Normal spawn near maestro
  }

  return { x: 30, y: 15 };
}

export function getEnemySpawns(mapId) {
  const spawns = [];
  
  if (mapId === 'deeproot') {
    // Deeproot is full of slimes
    for(let i=0; i < 40; i++) {
      const x = 5 + Math.random() * (MAP_WIDTH - 10);
      const y = 8 + Math.random() * (MAP_HEIGHT - 16);
      spawns.push({ x, y, type: ENEMIES.SLIME });
    }
    // And some goblins in the deep forest
    for(let i=0; i < 10; i++) {
      const x = 10 + Math.random() * (MAP_WIDTH - 20);
      const y = 20 + Math.random() * (MAP_HEIGHT - 30);
      spawns.push({ x, y, type: ENEMIES.GOBLIN });
    }
  } else if (mapId === 'cueva_goblin') {
    // Skeletons and Goblins in the corridors
    for (let i = 0; i < 15; i++) {
      spawns.push({ x: 28 + Math.random()*4, y: 10 + Math.random()*10, type: ENEMIES.GOBLIN });
    }
    for (let i = 0; i < 10; i++) {
      spawns.push({ x: 12 + Math.random()*6, y: 26 + Math.random()*6, type: ENEMIES.SKELETON });
    }
    for (let i = 0; i < 10; i++) {
      spawns.push({ x: 32 + Math.random()*4, y: 26 + Math.random()*6, type: ENEMIES.SKELETON });
    }
    // The Boss
    spawns.push({ x: 40, y: 37, type: ENEMIES.GOBLIN_KING });
  } else {
    // Guild Arena
    for(let i=0; i<3; i++) spawns.push({ x: 38 + Math.random()*15, y: 32 + Math.random()*7, type: ENEMIES.SLIME });
    for(let i=0; i<3; i++) spawns.push({ x: 38 + Math.random()*15, y: 32 + Math.random()*7, type: ENEMIES.GOBLIN });
    spawns.push({ x: 47, y: 36, type: ENEMIES.SKELETON });
  }

  return spawns;
}

export function getTransitions(mapId) {
  if (mapId === 'guild') {
    return [
      { 
        x: 27, y: MAP_HEIGHT - 2, w: 7, h: 2, 
        targetMap: 'deeproot', targetSpawnId: 'from_guild' 
      }
    ];
  } else if (mapId === 'deeproot') {
    return [
      { 
        x: 27, y: 0, w: 7, h: 2, 
        targetMap: 'guild', targetSpawnId: 'from_deeproot' 
      },
      {
        x: 28, y: MAP_HEIGHT - 6, w: 5, h: 2,
        targetMap: 'cueva_goblin', targetSpawnId: 'from_deeproot'
      }
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
