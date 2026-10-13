/**
 * Shared level-building helpers — tile placement, enemy/item spawners, structures.
 */
import S from './state.js';
import {
  T, LEVEL_H,
  EMPTY, GND, DIRT, STONE,
  PTL, PTR, PBL, PBR,
  YPTL, YPTR, YPBL, YPBR,
} from './constants.js';

export function ground(x1, x2) {
  for (let x = x1; x <= x2; x++) {
    S.tiles[13][x] = GND;
    S.tiles[14][x] = DIRT;
  }
}

export function blk(type, x, y) {
  S.tiles[y][x] = type;
}

export function pipe(x, h) {
  const top = 13 - h;
  S.tiles[top][x] = PTL;
  S.tiles[top][x + 1] = PTR;
  for (let r = top + 1; r < 13; r++) {
    S.tiles[r][x] = PBL;
    S.tiles[r][x + 1] = PBR;
  }
}

export function yellowPipe(x, h) {
  const top = 13 - h;
  S.tiles[top][x] = YPTL;
  S.tiles[top][x + 1] = YPTR;
  for (let r = top + 1; r < 13; r++) {
    S.tiles[r][x] = YPBL;
    S.tiles[r][x + 1] = YPBR;
  }
}

export function stair(x, h, dir = 1) {
  for (let i = 0; i < h; i++) {
    for (let j = 0; j <= i; j++) {
      S.tiles[12 - j][x + (dir > 0 ? i : h - 1 - i)] = STONE;
    }
  }
}

/**
 * Spawn a fox (goomba-type) enemy.
 * @param {number} col  Tile column
 * @param {number} row  Tile row the enemy stands ON (default 13 = ground)
 */
export function fox(col, row = 13) {
  S.enemies.push({
    x: col * T + 2, y: row * T - 28,
    w: 28, h: 28, vx: -0.7,
    kind: 'goomba',
    alive: true, stomped: false, stompTimer: 0,
    frame: 0, activated: false,
  });
}

/**
 * Spawn a koopa enemy.
 * @param {number} col  Tile column
 * @param {number} row  Tile row the enemy stands ON (default 13 = ground)
 */
export function koopa(col, row = 13) {
  S.enemies.push({
    x: col * T + 2, y: row * T - 32,
    w: 28, h: 32, vx: -0.5,
    kind: 'koopa',
    alive: true, stomped: false, stompTimer: 0,
    frame: 0, activated: false,
  });
}

/**
 * Spawn a drillmole enemy.
 * @param {number} col  Tile column
 * @param {number} row  Tile row the enemy stands ON (default 13 = ground)
 */
export function drillmole(col, row = 13) {
  S.enemies.push({
    x: col * T + 3, y: row * T - 26,
    w: 26, h: 26, vx: -0.6,
    kind: 'drillmole',
    alive: true, stomped: false, stompTimer: 0,
    frame: 0, activated: false,
    drillTimer: 0,
  });
}

export function carrot(x, y) {
  S.items.push({
    x: x * T + 8, y: y * T + 4,
    w: 16, h: 24, type: 'carrot',
    collected: false, vy: 0, anim: Math.random() * 6,
  });
}

/**
 * Initialise an empty tile grid of (rows × cols).
 */
export function initTileGrid(cols) {
  S.tiles = [];
  for (let y = 0; y < LEVEL_H; y++) {
    S.tiles[y] = new Array(cols).fill(EMPTY);
  }
  S.enemies = [];
  S.items = [];
}
