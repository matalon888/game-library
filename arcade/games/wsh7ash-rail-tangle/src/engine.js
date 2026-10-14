"use strict";

const DIRS = {
  N: { dx: 0, dy: -1, opposite: "S" },
  E: { dx: 1, dy: 0, opposite: "W" },
  S: { dx: 0, dy: 1, opposite: "N" },
  W: { dx: -1, dy: 0, opposite: "E" },
};

const DIR_ORDER = ["N", "E", "S", "W"];

const oppositeOf = (d) => DIRS[d].opposite;

function dirBetweenCells(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 1 && dy === 0) return "E";
  if (dx === -1 && dy === 0) return "W";
  if (dx === 0 && dy === 1) return "S";
  if (dx === 0 && dy === -1) return "N";
  return null;
}

const PIECES = {
  // piece id : base connections (two directions)
  0: [], // empty
  1: ["E", "W"], // straight horizontal
  2: ["N", "S"], // straight vertical
  3: ["N", "E"], // curve
  4: ["E", "S"], // curve
  5: ["S", "W"], // curve
  6: ["W", "N"], // curve
};

const PIECE_NAMES = {
  0: "empty",
  1: "straight-h",
  2: "straight-v",
  3: "curve-ne",
  4: "curve-se",
  5: "curve-sw",
  6: "curve-nw",
};

// Rotate a direction clockwise by `steps` quarter-turns.
function rotateDir(dir, steps) {
  const i = DIR_ORDER.indexOf(dir);
  if (i === -1) return dir;
  return DIR_ORDER[(i + steps + 4) % 4];
}

// Return the two connection directions for a tile, after applying rotation.
function connections(tile) {
  const base = PIECES[tile.base] || [];
  const steps = tile.rotation || 0;
  return base.map((d) => rotateDir(d, steps)).sort();
}

// Rotate a tile clockwise (mutates) and return the new rotation.
function rotateTile(tile, steps = 1) {
  tile.rotation = ((tile.rotation || 0) + steps + 4) % 4;
  return tile.rotation;
}

// Follow a route across the board. Returns null on failure or a path array
// of {x,y,dir} steps ending at the goal cell.
function followRoute(board, route) {
  const { start, goal, startDir } = route;
  const visited = new Set();
  const path = [{ x: start.x, y: start.y, dir: startDir }];
  let cur = { x: start.x, y: start.y };
  let travel = startDir;

  for (let step = 0; step < 4096; step++) {
    const nd = DIRS[travel];
    cur = { x: cur.x + nd.dx, y: cur.y + nd.dy };
    if (cur.x < 0 || cur.y < 0 || cur.x >= board.width || cur.y >= board.height) {
      return null;
    }
    if (cur.x === goal.x && cur.y === goal.y) {
      path.push({ x: cur.x, y: cur.y, dir: travel });
      return path;
    }
    const key = cur.x + "," + cur.y;
    if (visited.has(key)) return null;
    visited.add(key);
    const tile = board.get(cur.x, cur.y);
    if (!tile || !tile.base) return null;
    const incoming = DIRS[travel].opposite;
    const conns = connections(tile);
    if (!conns.includes(incoming)) return null;
    const outgoing = conns.find((d) => d !== incoming);
    if (!outgoing) return null;
    path.push({ x: cur.x, y: cur.y, dir: travel });
    travel = outgoing;
  }
  return null;
}

// Check whether a full board satisfies every route.
function isSolved(board) {
  for (const route of board.routes) {
    if (!followRoute(board, route)) return false;
  }
  return true;
}

// Determine which routes are currently solved.
function solvedRoutes(board) {
  return board.routes
    .map((route) => ({ route, solved: Boolean(followRoute(board, route)) }))
    .map((r) => ({ id: r.route.id, solved: r.solved }));
}

// Create a board object from a level definition.
// Level shape: { width, height, tiles: { "x,y": {base, rotation, fixed} }, routes: [...] }
function createBoard(level) {
  const grid = [];
  for (let y = 0; y < level.height; y++) {
    grid.push([]);
    for (let x = 0; x < level.width; x++) {
      grid[y].push(null);
    }
  }
  const tiles = level.tiles || [];
  for (const key of Object.keys(tiles)) {
    const [x, y] = key.split(",").map(Number);
    const t = tiles[key];
    grid[y][x] = { base: t.base, rotation: t.rotation || 0, fixed: Boolean(t.fixed) };
  }
  const board = {
    width: level.width,
    height: level.height,
    grid,
    routes: (level.routes || []).map((r, i) => ({ ...r, id: r.id || "route-" + i })),
    name: level.name || "Untitled",
    index: level.index || 0,
  };
  board.get = (x, y) => {
    if (y < 0 || y >= board.height || x < 0 || x >= board.width) return null;
    return board.grid[y][x];
  };
  return board;
}

// Generate a random solvable level by carving a random path from each route
// start to its goal and scattering decoy rotatable pieces elsewhere.
// The result is verified by unscrambling and re-checking every route.
function generateLevel(seed = 1, width = 6, height = 6, numRoutes = 2) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const level = tryGenerateLevel(seed + attempt * 997, width, height, numRoutes);
    const board = createBoard(level);
    const undo = solutionRotationsInternal(level);
    for (const [k, steps] of Object.entries(undo)) {
      const [x, y] = k.split(",").map(Number);
      const tile = board.get(x, y);
      if (tile) rotateTile(tile, steps);
    }
    if (isSolved(board) && level.routes.length === numRoutes) return level;
  }
  return tryGenerateLevel(seed, width, height, numRoutes);
}

function solutionRotationsInternal(level) {
  const out = {};
  for (const [k, r] of Object.entries(level.scramble || {})) {
    out[k] = (4 - r) % 4;
  }
  return out;
}

function tryGenerateLevel(seed, width, height, numRoutes) {
  const rand = mulberry32(seed);
  const routes = [];
  const used = new Set();
  const key = (x, y) => x + "," + y;

  function freeCell() {
    for (let i = 0; i < 400; i++) {
      const x = Math.floor(rand() * width);
      const y = Math.floor(rand() * height);
      if (!used.has(key(x, y))) return { x, y };
    }
    return null;
  }

  // Pick a departure direction that points toward the middle of the board.
  function inwardDir(p) {
    const options = [
      { d: "E", space: width - 1 - p.x },
      { d: "W", space: p.x },
      { d: "S", space: height - 1 - p.y },
      { d: "N", space: p.y },
    ]
      .filter((o) => o.space > 0)
      .sort((a, b) => b.space - a.space);
    return options[0] ? options[0].d : "E";
  }

  for (let r = 0; r < numRoutes; r++) {
    const start = freeCell();
    const goal = freeCell();
    if (!start || !goal) break;
    used.add(key(start.x, start.y));
    used.add(key(goal.x, goal.y));
    const startDir = inwardDir(start);
    routes.push({ id: "route-" + (r + 1), start, goal, startDir });
  }

  const tiles = {};
  const scramble = {};

  for (const route of routes) {
    let path = null;
    for (let attempt = 0; path === null && attempt < 12; attempt++) {
      path = randomWalk(rand, route, width, height, tiles, used);
    }
    if (path === null) continue;
    const n = path.length;
    for (let i = 0; i < n; i++) {
      const step = path[i];
      const tile = tiles[key(step.x, step.y)];
      if (!tile) continue;
      const k = key(step.x, step.y);
      // Anchor the first and last tiles; scramble the middle ones.
      if (i === 0 || i === n - 1) {
        tile.rotation = 0;
        tile.fixed = true;
      } else {
        tile.rotation = 3;
        tile.fixed = false;
        scramble[k] = 3;
      }
    }
  }

  // Scatter rotatable decoys on empty cells.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const k = key(x, y);
      if (tiles[k] || used.has(k)) continue;
      if (rand() < 0.4) {
        const base = [1, 2, 3, 4, 5, 6][Math.floor(rand() * 6)];
        tiles[k] = { base, rotation: Math.floor(rand() * 4), fixed: rand() < 0.25 };
      }
    }
  }

  return {
    name: "Random " + seed,
    width,
    height,
    tiles,
    routes,
    scramble,
  };
}

// Build a random path for a single route, placing matching pieces.
// Returns the ordered list of tile cells on the path, or null if the board
// cannot accommodate a route between the two stations.
function randomWalk(rand, route, width, height, tiles, used) {
  const key = (x, y) => x + "," + y;
  const inBounds = (x, y) => x >= 0 && y >= 0 && x < width && y < height;
  const dist = (x, y) => Math.abs(x - route.goal.x) + Math.abs(y - route.goal.y);
  const startPos = {
    x: route.start.x + DIRS[route.startDir].dx,
    y: route.start.y + DIRS[route.startDir].dy,
  };
  if (!inBounds(startPos.x, startPos.y)) return null;
  if (startPos.x === route.goal.x && startPos.y === route.goal.y) return [];

  const visited = new Set([key(startPos.x, startPos.y)]);
  const path = [];
  let cur = { x: startPos.x, y: startPos.y };
  let incoming = DIRS[route.startDir].opposite;

  const free = (x, y) =>
    inBounds(x, y) && !tiles[key(x, y)] && !used.has(key(x, y)) && !visited.has(key(x, y));

  for (let step = 0; step < 500; step++) {
    // Reached a cell adjacent to the goal: final tile points at the station.
    const adj = DIR_ORDER.find((d) => {
      const gx = cur.x + DIRS[d].dx;
      const gy = cur.y + DIRS[d].dy;
      return gx === route.goal.x && gy === route.goal.y;
    });
    if (adj !== undefined) {
      const base = pieceFor(incoming, adj);
      if (base === 0) return null;
      tiles[key(cur.x, cur.y)] = { base, rotation: 0, fixed: false };
      used.add(key(cur.x, cur.y));
      path.push({ x: cur.x, y: cur.y });
      return path;
    }

    const opts = [];
    for (const d of DIR_ORDER) {
      if (d === incoming) continue;
      const nx = cur.x + DIRS[d].dx;
      const ny = cur.y + DIRS[d].dy;
      if (nx === route.goal.x && ny === route.goal.y) {
        opts.push(d);
        continue;
      }
      if (free(nx, ny)) opts.push(d);
    }
    opts.sort(
      (a, b) =>
        dist(cur.x + DIRS[a].dx, cur.y + DIRS[a].dy) -
        dist(cur.x + DIRS[b].dx, cur.y + DIRS[b].dy)
    );

    if (opts.length === 0) {
      if (path.length === 0) return null;
      const last = path.pop();
      delete tiles[key(last.x, last.y)];
      used.delete(key(last.x, last.y));
      visited.delete(key(last.x, last.y));
      if (path.length) {
        const prev = path[path.length - 1];
        cur = { x: prev.x, y: prev.y };
        incoming = oppositeOf(dirBetweenCells(prev, last));
      } else {
        cur = { x: startPos.x, y: startPos.y };
        incoming = DIRS[route.startDir].opposite;
      }
      continue;
    }

    let out = opts[0];
    // Small randomness bias among equal-distance options.
    const best = dist(cur.x + DIRS[out].dx, cur.y + DIRS[out].dy);
    const tied = opts.filter(
      (d) => dist(cur.x + DIRS[d].dx, cur.y + DIRS[d].dy) === best
    );
    if (tied.length > 1) out = tied[Math.floor(rand() * tied.length)];

    const base = pieceFor(incoming, out);
    if (base === 0) return null;
    tiles[key(cur.x, cur.y)] = { base, rotation: 0, fixed: false };
    used.add(key(cur.x, cur.y));
    visited.add(key(cur.x, cur.y));
    path.push({ x: cur.x, y: cur.y });
    const nx = cur.x + DIRS[out].dx;
    const ny = cur.y + DIRS[out].dy;
    if (nx === route.goal.x && ny === route.goal.y) return path;
    cur = { x: nx, y: ny };
    incoming = oppositeOf(out);
  }
  return null;
}

// Find a base piece id whose base connections equal the two given directions,
// or return 0 if impossible.
function pieceFor(a, b) {
  if (a == null || b == null) return 0;
  const want = [a, b].sort();
  for (const [id, conns] of Object.entries(PIECES)) {
    if (conns.length === 2 && conns.slice().sort().join() === want.join()) return Number(id);
  }
  return 0;
}

// Small deterministic PRNG for level generation.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

module.exports = {
  DIRS,
  DIR_ORDER,
  PIECES,
  PIECE_NAMES,
  rotateDir,
  connections,
  rotateTile,
  followRoute,
  isSolved,
  solvedRoutes,
  createBoard,
  generateLevel,
  pieceFor,
  mulberry32,
};