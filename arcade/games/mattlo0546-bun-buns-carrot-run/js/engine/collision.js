/**
 * Collision detection, resolution, and block interaction.
 */
import S from './state.js';
import { sfx } from './audio.js';
import {
  T, LEVEL_W, LEVEL_H,
  EMPTY, GND, BRICK, QCARROT, QLEEK, QKUMA, QMIKU, QYOSHI, QCHII, USED, STONE, LAVA,
  Q1UP, QSTAR, VINE,
} from './constants.js';

// =========================
//    Tile Lookup
// =========================

export function tileAt(col, row) {
  if (col < 0 || row < 0 || row >= LEVEL_H) return EMPTY;
  if (!S.tiles[row] || col >= S.tiles[row].length) return EMPTY;
  return S.tiles[row][col];
}

export function isSolid(type) {
  return type >= GND && type !== EMPTY && type !== LAVA && type !== VINE;
}

// =========================
//    AABB Overlap
// =========================

export function rectOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

// =========================
//    Block Interaction
// =========================

export function hitBlock(col, row) {
  const type = S.tiles[row][col];
  const p = S.player;

  if (type === QCARROT) {
    S.tiles[row][col] = USED;
    S.coinCount++;
    S.score += 200;
    sfx.coin();
    S.popups.push({ x: col * T + 8, y: row * T - 10, text: '200', timer: 40, vy: -1.5 });
    S.particles.push({ x: col * T + 8, y: row * T - T, w: 16, h: 16, vx: 0, vy: -6, type: 'coinpop', timer: 30 });
    S.blockAnims.push({ col, row, time: 0 });
  }

  else if (type === QLEEK) {
    S.tiles[row][col] = USED;
    sfx.powerup();
    S.items.push({
      x: col * T + 4, y: (row - 1) * T,
      w: 24, h: 28, type: 'leek',
      collected: false, vy: -2, vx: 0.8,
      grounded: false, anim: 0,
    });
    S.blockAnims.push({ col, row, time: 0 });
  }

  else if (type === QKUMA) {
    S.tiles[row][col] = USED;
    sfx.powerup();
    S.items.push({
      x: col * T + 4, y: (row - 1) * T,
      w: 24, h: 28, type: 'kumamon',
      collected: false, vy: -2, vx: 0.78,
      grounded: false, anim: 0,
    });
    S.blockAnims.push({ col, row, time: 0 });
  }

  else if (type === QMIKU) {
    S.tiles[row][col] = USED;
    sfx.powerup();
    S.items.push({
      x: col * T + 4, y: (row - 1) * T,
      w: 24, h: 28, type: 'miku',
      collected: false, vy: -2, vx: 0.78,
      grounded: false, anim: 0,
    });
    S.blockAnims.push({ col, row, time: 0 });
  }

  else if (type === QYOSHI) {
    S.tiles[row][col] = USED;
    sfx.powerup();
    S.items.push({
      x: col * T + 4, y: (row - 1) * T,
      w: 24, h: 28, type: 'yoshi',
      collected: false, vy: -2, vx: 0.78,
      grounded: false, anim: 0,
    });
    S.blockAnims.push({ col, row, time: 0 });
  }

  else if (type === QCHII) {
    S.tiles[row][col] = USED;
    sfx.powerup();
    S.items.push({
      x: col * T + 4, y: (row - 1) * T,
      w: 24, h: 28, type: 'chiikawa',
      collected: false, vy: -2, vx: 0.78,
      grounded: false, anim: 0,
    });
    S.blockAnims.push({ col, row, time: 0 });
  }

  else if (type === Q1UP) {
    S.tiles[row][col] = USED;
    sfx.oneup();
    S.items.push({
      x: col * T + 4, y: (row - 1) * T,
      w: 24, h: 28, type: '1up',
      collected: false, vy: -2, vx: 0.78,
      grounded: false, anim: 0,
    });
    S.blockAnims.push({ col, row, time: 0 });
  }

  else if (type === QSTAR) {
    S.tiles[row][col] = USED;
    sfx.powerup();
    S.items.push({
      x: col * T + 4, y: (row - 1) * T,
      w: 24, h: 28, type: 'star',
      collected: false, vy: -4, vx: 1.2,
      grounded: false, anim: 0, bounce: true,
    });
    S.blockAnims.push({ col, row, time: 0 });
  }

  else if (type === BRICK) {
    if (p.big) {
      S.tiles[row][col] = EMPTY;
      sfx.breakB();
      S.score += 50;
      for (let i = 0; i < 4; i++) {
        S.particles.push({
          x: col * T + (i % 2) * 16,
          y: row * T + Math.floor(i / 2) * 16,
          w: 12, h: 12,
          vx: (i % 2 === 0 ? -2.5 : 2.5) + Math.random() - 0.5,
          vy: -6 - Math.random() * 3,
          type: 'brick', timer: 45, gy: 0.45,
        });
      }
    } else {
      sfx.bump();
      S.blockAnims.push({ col, row, time: 0 });
    }
  }

  else if (type === USED || type === STONE) {
    sfx.bump();
  }

  // Vine growth trigger: check if this block is a vine spawn point
  if (S.vineSpawns) {
    for (let v = 0; v < S.vineSpawns.length; v++) {
      const vs = S.vineSpawns[v];
      if (vs.col === col && vs.row === row && !vs.triggered) {
        vs.triggered = true;
        if (!S.vineGrowths) S.vineGrowths = [];
        S.vineGrowths.push({
          col: vs.col,
          currentRow: vs.row - 1,
          targetRow: vs.targetRow || 1,
          timer: 0,
        });
        sfx.powerup();
      }
    }
  }

  // Kill enemies sitting on top of the bumped block
  for (let i = 0; i < S.enemies.length; i++) {
    const e = S.enemies[i];
    if (!e.alive || e.stomped) continue;
    const ec = Math.floor((e.x + e.w / 2) / T);
    const er = Math.floor((e.y + e.h) / T);
    if (ec === col && er === row) {
      e.alive = false;
      S.score += 100;
      S.popups.push({ x: e.x, y: e.y - 10, text: '100', timer: 40, vy: -1.5 });
      S.particles.push({ x: e.x, y: e.y, w: 8, h: 8, vx: 0, vy: -5, type: 'poof', timer: 20 });
    }
  }
}

// =========================
//    Movement Resolution
// =========================

export function resolveX(ent) {
  const left = Math.floor(ent.x / T);
  const right = Math.floor((ent.x + ent.w - 1) / T);
  const top = Math.floor(ent.y / T);
  const bottom = Math.floor((ent.y + ent.h - 1) / T);

  for (let r = top; r <= bottom; r++) {
    if (ent.vx > 0 && isSolid(tileAt(right, r))) {
      ent.x = right * T - ent.w;
      ent.vx = 0;
      return;
    }
    if (ent.vx < 0 && isSolid(tileAt(left, r))) {
      ent.x = (left + 1) * T;
      ent.vx = 0;
      return;
    }
  }
}

export function resolveY(ent) {
  ent.grounded = false;

  const left = Math.floor(ent.x / T);
  const right = Math.floor((ent.x + ent.w - 1) / T);
  const top = Math.floor(ent.y / T);
  const bottom = Math.floor((ent.y + ent.h - 1) / T);

  for (let c = left; c <= right; c++) {
    // Landing on ground
    if (ent.vy > 0 && isSolid(tileAt(c, bottom))) {
      ent.y = bottom * T - ent.h;
      ent.vy = 0;
      ent.grounded = true;
      return;
    }
    // Hitting ceiling
    if (ent.vy < 0 && isSolid(tileAt(c, top))) {
      ent.y = (top + 1) * T;
      ent.vy = 0;
      if (ent === S.player) hitBlock(c, top);
      return;
    }
  }

  // Ground snap: when vy is small/zero, check if solid ground is just 1-2px below.
  // This prevents the "grounded flickering" bug that breaks jumping.
  if (!ent.grounded && ent.vy >= 0) {
    const feetRow = Math.floor((ent.y + ent.h + 2) / T);
    for (let c = left; c <= right; c++) {
      if (isSolid(tileAt(c, feetRow))) {
        ent.y = feetRow * T - ent.h;
        ent.vy = 0;
        ent.grounded = true;
        return;
      }
    }
  }
}
