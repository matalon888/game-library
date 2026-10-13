/**
 * Non-player entity updates: enemies, leek projectiles, items, particles, camera.
 */
import S from './state.js';
import { sfx } from './audio.js';
import { tileAt, isSolid, rectOverlap } from './collision.js';
import { T, W, LEVEL_H, NES_ORANGE, VINE } from './constants.js';

// =========================
//        Enemies
// =========================

export function updateEnemies() {
  for (let i = 0; i < S.enemies.length; i++) {
    const e = S.enemies[i];
    if (!e.alive) continue;

    if (e.stomped) {
      e.stompTimer--;
      if (e.stompTimer <= 0) e.alive = false;
      continue;
    }

    // Activate when player approaches
    if (!e.activated) {
      if (e.x < S.cam.x + W + T * 2) e.activated = true;
      else continue;
    }

    // Movement
    e.x += e.vx;
    e.frame += 0.08;

    if (e.kind === 'drillmole') {
      e.drillTimer = (e.drillTimer || 0) + 1;
      if (e.drillTimer % 80 === 0) {
        const dir = S.player.x > e.x ? 1 : -1;
        e.vx = dir * 1.9;
      } else if (e.drillTimer % 80 === 24) {
        e.vx *= 0.45;
      }
    }

    // Simple gravity
    const ecol = Math.floor((e.x + e.w / 2) / T);
    const erow = Math.floor((e.y + e.h) / T);
    if (!isSolid(tileAt(ecol, erow))) {
      e.y += 2;
    } else {
      e.y = erow * T - e.h;
    }

    // Wall collision — reverse direction
    const wCol = e.vx > 0 ? Math.floor((e.x + e.w) / T) : Math.floor(e.x / T);
    const wRow = Math.floor((e.y + e.h / 2) / T);
    if (isSolid(tileAt(wCol, wRow))) {
      e.vx *= -1;
    }

    // Edge detection — don't walk off cliffs
    const aCol = e.vx > 0 ? Math.floor((e.x + e.w + 4) / T) : Math.floor((e.x - 4) / T);
    const bRow = Math.floor((e.y + e.h + 4) / T);
    if (!isSolid(tileAt(aCol, bRow)) && isSolid(tileAt(ecol, erow))) {
      e.vx *= -1;
    }

    // Fall in pit
    if (e.y > LEVEL_H * T + 64) e.alive = false;
  }
}

// =========================
//    Explosive Pocky
// =========================

function createExplosion(cx, cy) {
  const RADIUS = 96;
  for (let j = 0; j < S.enemies.length; j++) {
    const e = S.enemies[j];
    if (!e.alive || e.stomped) continue;
    const dx = (e.x + e.w / 2) - cx;
    const dy = (e.y + e.h / 2) - cy;
    if (Math.sqrt(dx * dx + dy * dy) < RADIUS) {
      e.alive = false;
      S.score += 300;
      sfx.stomp();
      S.popups.push({ x: e.x, y: e.y - 10, text: '300', timer: 40, vy: -1.5 });
    }
  }
  sfx.explode();
  S.popups.push({ x: cx - 20, y: cy - 30, text: 'BOOM!', timer: 55, vy: -0.8, color: NES_ORANGE });
  S.particles.push({ x: cx, y: cy, w: 10, h: 10, vx: 0, vy: 0, type: 'explosion', timer: 22 });
  for (let k = 0; k < 12; k++) {
    const angle = (k / 12) * Math.PI * 2;
    const speed = 2.5 + Math.random() * 3;
    S.particles.push({
      x: cx, y: cy, w: 5, h: 5,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1,
      type: 'fire', timer: 18 + Math.floor(Math.random() * 12),
      gy: 0.12,
      color: ['#ff4400', '#ff8800', '#ffcc00', '#ff6600'][k % 4],
    });
  }
}

// =========================
//    Leek Projectiles
// =========================

export function updateProjectiles() {
  for (let i = S.leekProjectiles.length - 1; i >= 0; i--) {
    const p = S.leekProjectiles[i];

    // === Musical note (Miku) — sine wave, piercing ===
    if (p.type === 'note') {
      p.sineTimer += 0.15;
      p.x += p.vx;
      p.y = p.sineBase + Math.sin(p.sineTimer) * 30;
      p.timer--;
      if (p.timer <= 0 || p.x < S.cam.x - 100 || p.x > S.cam.x + W + 100) {
        S.leekProjectiles.splice(i, 1); continue;
      }
      for (let j = 0; j < S.enemies.length; j++) {
        const e = S.enemies[j];
        if (!e.alive || e.stomped) continue;
        if (p.hitEnemies.includes(j)) continue;
        if (rectOverlap(p, { x: e.x, y: e.y, w: e.w, h: e.h })) {
          e.alive = false;
          S.score += 200;
          sfx.stomp();
          S.popups.push({ x: e.x, y: e.y - 10, text: '200', timer: 40, vy: -1.5 });
          S.particles.push({ x: e.x, y: e.y, w: 8, h: 8, vx: 0, vy: -4, type: 'poof', timer: 20 });
          p.hitEnemies.push(j);
        }
      }
      continue;
    }

    // === Spit projectile — spat-out enemy ===
    if (p.type === 'spit') {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.2;
      p.rot += 0.25;
      p.timer--;
      if (p.timer <= 0 || p.x < S.cam.x - 100 || p.x > S.cam.x + W + 100) {
        S.leekProjectiles.splice(i, 1); continue;
      }
      // Bounce off ground
      const pcol = Math.floor((p.x + p.w / 2) / T);
      const prow = Math.floor((p.y + p.h) / T);
      if (isSolid(tileAt(pcol, prow)) && p.vy > 0) {
        if (p.bounced) { S.leekProjectiles.splice(i, 1); continue; }
        p.vy = -4;
        p.y = prow * T - p.h;
        p.bounced = true;
      }
      // Hit enemies
      for (let j = 0; j < S.enemies.length; j++) {
        const e = S.enemies[j];
        if (!e.alive || e.stomped) continue;
        if (rectOverlap(p, { x: e.x, y: e.y, w: e.w, h: e.h })) {
          e.alive = false;
          S.score += 400;
          sfx.stomp();
          S.popups.push({ x: e.x, y: e.y - 10, text: '400', timer: 40, vy: -1.5 });
          S.particles.push({ x: e.x, y: e.y, w: 8, h: 8, vx: 0, vy: -4, type: 'poof', timer: 20 });
          S.leekProjectiles.splice(i, 1);
          break;
        }
      }
      continue;
    }

    // === Leek / Pocky ===
    const isPocky = p.type === 'pocky';
    if (isPocky && p.muzzleTimer > 0) {
      p.muzzleTimer--;
      p.timer--;
      if (p.timer <= 0) {
        S.leekProjectiles.splice(i, 1);
      }
      continue;
    }
    const prevX = p.x;
    const prevY = p.y;
    p.x += p.vx;
    p.y += p.vy;
    if (!isPocky) {
      p.vy += 0.3;
      p.rot += 0.3;
    }
    p.timer--;

    // Ground bounce
    const pcol = Math.floor((p.x + p.w / 2) / T);
    const prow = Math.floor((p.y + p.h) / T);
    if (isSolid(tileAt(pcol, prow)) && p.vy > 0) {
      if (isPocky) { createExplosion(p.x + p.w / 2, p.y + p.h); S.leekProjectiles.splice(i, 1); continue; }
      if (p.bounced) { S.leekProjectiles.splice(i, 1); continue; }
      p.vy = -5;
      p.y = prow * T - p.h;
      p.bounced = true;
    }

    // Wall collision
    const sideCol = p.vx > 0 ? Math.floor((p.x + p.w) / T) : Math.floor(p.x / T);
    const sideRow = Math.floor((p.y + p.h / 2) / T);
    if (isSolid(tileAt(sideCol, sideRow))) {
      if (isPocky) createExplosion(p.x + p.w / 2, p.y + p.h / 2);
      S.leekProjectiles.splice(i, 1);
      continue;
    }

    // Lifetime / out of bounds
    if (p.timer <= 0 || p.y > LEVEL_H * T) {
      S.leekProjectiles.splice(i, 1);
      continue;
    }

    // Hit enemies
    let hit = false;
    for (let j = 0; j < S.enemies.length; j++) {
      const e = S.enemies[j];
      if (!e.alive || e.stomped) continue;
      const enemyBody = { x: e.x - 3, y: e.y - 3, w: e.w + 6, h: e.h + 6 };
      const projectilePath = {
        x: Math.min(prevX, p.x),
        y: Math.min(prevY, p.y),
        w: Math.abs(p.x - prevX) + p.w,
        h: Math.abs(p.y - prevY) + p.h,
      };
      if (rectOverlap(p, enemyBody) || rectOverlap(projectilePath, enemyBody)) {
        if (isPocky) {
          createExplosion(e.x + e.w / 2, e.y + e.h / 2);
        } else {
          e.alive = false;
          S.score += 200;
          sfx.stomp();
          S.popups.push({ x: e.x, y: e.y - 10, text: '200', timer: 40, vy: -1.5 });
          S.particles.push({ x: e.x, y: e.y, w: 8, h: 8, vx: 0, vy: -4, type: 'poof', timer: 20 });
        }
        hit = true;
        break;
      }
    }
    if (hit) S.leekProjectiles.splice(i, 1);
  }
}

// =========================
//         Items
// =========================

export function updateItems() {
  for (let i = 0; i < S.items.length; i++) {
    const item = S.items[i];
    if (item.collected) continue;

    if (item.type === 'leek' || item.type === 'kumamon' || item.type === 'miku' || item.type === 'yoshi' || item.type === 'chiikawa' || item.type === '1up') {
      item.vy += 0.4;
      item.y += item.vy;
      const irow = Math.floor((item.y + item.h) / T);
      const icol = Math.floor((item.x + item.w / 2) / T);
      if (isSolid(tileAt(icol, irow))) {
        item.y = irow * T - item.h;
        item.vy = 0;
        item.grounded = true;
      }
      if (item.grounded) {
        item.x += item.vx;
        const sc = item.vx > 0 ? Math.floor((item.x + item.w) / T) : Math.floor(item.x / T);
        const sr = Math.floor((item.y + item.h / 2) / T);
        if (isSolid(tileAt(sc, sr))) item.vx *= -1;
      }
      if (item.y > LEVEL_H * T) item.collected = true;
    }

    // Star bounces along the ground
    if (item.type === 'star') {
      item.vy += 0.4;
      item.y += item.vy;
      item.anim += 0.15;
      const irow = Math.floor((item.y + item.h) / T);
      const icol = Math.floor((item.x + item.w / 2) / T);
      if (isSolid(tileAt(icol, irow))) {
        item.y = irow * T - item.h;
        item.vy = -5; // bouncy!
        item.grounded = true;
      }
      item.x += item.vx;
      const sc = item.vx > 0 ? Math.floor((item.x + item.w) / T) : Math.floor(item.x / T);
      const sr = Math.floor((item.y + item.h / 2) / T);
      if (isSolid(tileAt(sc, sr))) item.vx *= -1;
      if (item.y > LEVEL_H * T) item.collected = true;
    }

    if (item.type === 'carrot') {
      item.anim += 0.06;
    }
  }
}

// =========================
//      Vine Growth
// =========================

export function updateVineGrowths() {
  if (!S.vineGrowths) return;
  for (let i = S.vineGrowths.length - 1; i >= 0; i--) {
    const v = S.vineGrowths[i];
    v.timer++;
    if (v.timer % 4 === 0) { // grow one tile every 4 frames
      if (v.currentRow >= v.targetRow) {
        S.tiles[v.currentRow][v.col] = VINE;
        v.currentRow--;
      } else {
        S.vineGrowths.splice(i, 1);
      }
    }
  }
}

// =========================
//       Particles
// =========================

export function updateParticles() {
  // Physics particles
  for (let i = S.particles.length - 1; i >= 0; i--) {
    const p = S.particles[i];
    p.timer--;
    if (p.timer <= 0) { S.particles.splice(i, 1); continue; }
    if (p.vx != null) p.x += p.vx;
    if (p.vy != null) { p.y += p.vy; if (p.gy) p.vy += p.gy; }
  }

  // Score popups
  for (let i = S.popups.length - 1; i >= 0; i--) {
    S.popups[i].y += S.popups[i].vy;
    S.popups[i].timer--;
    if (S.popups[i].timer <= 0) S.popups.splice(i, 1);
  }

  // Block bump animations
  for (let i = S.blockAnims.length - 1; i >= 0; i--) {
    S.blockAnims[i].time++;
    if (S.blockAnims[i].time > 8) S.blockAnims.splice(i, 1);
  }
}

// =========================
//         Camera
// =========================

export function updateCamera() {
  const target = S.player.x - W / 3;
  S.cam.x = Math.max(S.cam.x, target);
  const maxCam = S.tiles[0].length * T - W;
  S.cam.x = Math.max(0, Math.min(S.cam.x, maxCam));
}
