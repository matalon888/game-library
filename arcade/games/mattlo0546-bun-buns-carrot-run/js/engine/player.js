/**
 * Player creation, movement, physics, and game interactions.
 */
import S from './state.js';
import { sfx } from './audio.js';
import { stopMusic } from './audio.js';
import { isDown, wasPressed } from './input.js';
import { markLevelCompleted } from './progress.js';
import { tileAt, isSolid, rectOverlap, resolveX, resolveY, hitBlock } from './collision.js';
import {
  T, LEVEL_W, LEVEL_H,
  GRAV, GRAV_LOW, JUMP_VEL, MAX_FALL,
  MOVE_ACC, MOVE_DEC, AIR_DEC, MAX_WALK, MAX_RUN,
  JUMP_BUFFER_FRAMES, COYOTE_FRAMES, JUMP_HOLD_FRAMES,
  YPTL, YPTR, VINE,
  EMPTY, BRICK, USED, QCARROT, QLEEK, QKUMA, QMIKU, QYOSHI, QCHII, Q1UP, QSTAR,
} from './constants.js';

const CHECKPOINT_COLS_DEFAULT = [76, 140, 168];
const BASE_W = 24;
const BASE_H = 32;
const BASE_SCALE = 1.5;
const POWER_SCALE = 2;

// Jump-assist state (module-private)
let jumpBuffer = 0;
let coyoteTime = 0;
let jumpHoldTimer = 0;

// =========================
//    Factory & Reset
// =========================

function createPlayer() {
  const scale = BASE_SCALE;
  return {
    x: 3 * T, y: 13 * T - BASE_H * scale,
    w: BASE_W * scale,
    h: BASE_H * scale,
    vx: 0, vy: 0,
    facing: 1,
    grounded: false,
    big: false,
    hasLeek: false,
    hasKumamon: false,
    hasMiku: false,
    hasYoshi: false,
    hasChiikawa: false,
    yoshiHeldEnemy: null,
    yoshiTongueTimer: 0,
    yoshiEatTimer: 0,
    yoshiSpitTimer: 0,
    currentFrame: 0,
    frameTimer: 0,
    frameSpeed: 7,
    spriteWidth: BASE_W * scale,
    spriteHeight: BASE_H * scale,
    sizeScale: scale,
    groundPounding: false,
    groundPoundWindup: 0,
    groundPoundCueX: 0,
    groundPoundCueY: 0,
    chiiRollTimer: 0,
    attackTimer: 0,
    climbing: false,
    dead: false,
  };
}

function stompEnemy(e) {
  e.alive = false;
  S.score += 200;
  sfx.stomp();
  S.popups.push({ x: e.x, y: e.y - 10, text: '200', timer: 40, vy: -1.5 });
  S.particles.push({ x: e.x, y: e.y, w: 8, h: 8, vx: 0, vy: -4, type: 'poof', timer: 20 });
}

function groundPoundImpact(p) {
  const impactZone = {
    x: p.x - 8,
    y: p.y + p.h - 12,
    w: p.w + 16,
    h: 18,
  };

  for (let i = 0; i < S.enemies.length; i++) {
    const e = S.enemies[i];
    if (!e.alive || e.stomped) continue;
    if (rectOverlap(impactZone, { x: e.x, y: e.y, w: e.w, h: e.h })) {
      stompEnemy(e);
    }
  }

  const footRow = Math.floor((p.y + p.h) / T);
  const leftCol = Math.floor((p.x + 2) / T);
  const rightCol = Math.floor((p.x + p.w - 2) / T);
  const questionBlocks = new Set([QCARROT, QLEEK, QKUMA, QMIKU, QYOSHI, QCHII, Q1UP, QSTAR]);

  let brokeAny = false;
  let hitAnyQuestion = false;
  for (let col = leftCol; col <= rightCol; col++) {
    const type = tileAt(col, footRow);

    // Lucky blocks: release item without breaking
    if (questionBlocks.has(type)) {
      hitBlock(col, footRow);
      hitAnyQuestion = true;
      continue;
    }

    // Only break bricks
    if (type !== BRICK) continue;

    S.tiles[footRow][col] = EMPTY;
    brokeAny = true;
    S.score += 50;

    for (let i = 0; i < 4; i++) {
      S.particles.push({
        x: col * T + (i % 2) * 16,
        y: footRow * T + Math.floor(i / 2) * 16,
        w: 10,
        h: 10,
        vx: (i % 2 === 0 ? -2.3 : 2.3) + Math.random() - 0.5,
        vy: -4.5 - Math.random() * 2,
        type: 'brick',
        timer: 32,
        gy: 0.38,
      });
    }
  }

  if (brokeAny) sfx.breakB();
  else if (!hitAnyQuestion) sfx.bump();
}

function updatePlayerSize(p, keepFeet = true) {
  const wantsPowerSize = p.big || p.hasYoshi || p.hasLeek || p.hasKumamon || p.hasMiku || p.hasChiikawa;
  const scale = wantsPowerSize ? POWER_SCALE : BASE_SCALE;
  const kumaBoost = 0;
  const effScale = scale + kumaBoost;
  const prevH = p.h;
  p.sizeScale = effScale;
  p.w = Math.round(BASE_W * effScale);
  p.h = Math.round(BASE_H * effScale);
  p.spriteWidth = p.w;
  p.spriteHeight = p.h;
  if (keepFeet) p.y -= (p.h - prevH);
}

export function resetPlayer(spawn) {
  S.player = createPlayer();
  if (spawn && typeof spawn.x === 'number' && typeof spawn.y === 'number') {
    S.player.x = spawn.x;
    S.player.y = spawn.y;
    if (typeof spawn.facing === 'number') S.player.facing = spawn.facing;
  } else if (S.underground) {
    S.player.x = 6 * T;
    S.player.y = 13 * T - S.player.h;
  } else {
    S.player.x = S.checkpointX;
    S.player.y = 13 * T - S.player.h;
  }
  S.invTimer = S.state === 'hub' ? 0 : 120;
  jumpBuffer = 0;
  coyoteTime = 0;
  jumpHoldTimer = 0;
  updatePlayerSize(S.player, false);
}

export function getPlayerPowerState() {
  const p = S.player;
  if (!p) return null;
  return {
    big: !!p.big,
    hasLeek: !!p.hasLeek,
    hasKumamon: !!p.hasKumamon,
    hasMiku: !!p.hasMiku,
    hasYoshi: !!p.hasYoshi,
    hasChiikawa: !!p.hasChiikawa,
    yoshiHeldEnemy: p.yoshiHeldEnemy || null,
  };
}

export function applyPlayerPowerState(state) {
  if (!state || !S.player) return;
  const p = S.player;
  p.big = !!state.big;
  p.hasLeek = !!state.hasLeek;
  p.hasKumamon = !!state.hasKumamon;
  p.hasMiku = !!state.hasMiku;
  p.hasYoshi = !!state.hasYoshi;
  p.hasChiikawa = !!state.hasChiikawa;
  p.yoshiHeldEnemy = state.yoshiHeldEnemy || null;
  updatePlayerSize(p, true);
}

// =========================
//    Death
// =========================

export function playerDie() {
  const p = S.player;
  if (p.dead) return;
  p.dead = true;
  p.vy = -8;
  p.vx = 0;
  sfx.die();
  S.lives--;
  S.deathTimer = 100;
  S.state = 'dying';
}

// =========================
//    Item Collection
// =========================

function collectItems(p) {
  for (let i = 0; i < S.items.length; i++) {
    const item = S.items[i];
    if (item.collected || !rectOverlap(p, item)) continue;

    if (item.type === 'carrot') {
      item.collected = true;
      S.coinCount++;
      S.score += 200;
      sfx.coin();
      S.popups.push({ x: item.x, y: item.y - 10, text: '200', timer: 40, vy: -1.5 });
    }

    if (item.type === '1up') {
      item.collected = true;
      S.lives++;
      sfx.oneup();
      S.score += 0;
      S.popups.push({ x: item.x, y: item.y - 16, text: '1UP!', timer: 60, vy: -1.2, color: '#80D010' });
    }

    if (item.type === 'star') {
      item.collected = true;
      S.starTimer = 480; // ~8 seconds at 60fps
      sfx.powerup();
      S.score += 1000;
      S.popups.push({ x: item.x, y: item.y - 16, text: 'STAR!', timer: 60, vy: -1.2, color: '#FCE030' });
    }

    if (item.type === 'leek') {
      item.collected = true;
      p.big = true;
      updatePlayerSize(p, true);
      p.hasLeek = true;
      p.hasKumamon = false;
      p.hasMiku = false;
      p.hasChiikawa = false;
      sfx.powerup();
      S.score += 1000;
      S.popups.push({ x: item.x, y: item.y - 10, text: '1000', timer: 40, vy: -1.5 });
    }

    if (item.type === 'kumamon') {
      item.collected = true;
      p.big = true;
      updatePlayerSize(p, true);
      p.hasKumamon = true;
      p.hasLeek = false;
      p.hasMiku = false;
      p.hasChiikawa = false;
      sfx.powerup();
      S.score += 1200;
      S.popups.push({ x: item.x, y: item.y - 10, text: 'KUMA!', timer: 90, vy: -0.8 });
    }

    if (item.type === 'miku') {
      item.collected = true;
      p.big = true;
      updatePlayerSize(p, true);
      p.hasMiku = true;
      p.hasLeek = false;
      p.hasKumamon = false;
      p.hasChiikawa = false;
      sfx.powerup();
      S.score += 1500;
      S.popups.push({ x: item.x, y: item.y - 10, text: 'MIKU!', timer: 55, vy: -1.2 });
    }

    if (item.type === 'yoshi') {
      item.collected = true;
      p.hasYoshi = true;
      updatePlayerSize(p, true);
      sfx.powerup();
      S.score += 1000;
      S.popups.push({ x: item.x, y: item.y - 10, text: 'YOSHI!', timer: 55, vy: -1.2 });
    }

    if (item.type === 'chiikawa') {
      item.collected = true;
      p.big = true;
      p.hasChiikawa = true;
      p.hasLeek = false;
      p.hasKumamon = false;
      p.hasMiku = false;
      p.hasYoshi = false;
      p.yoshiHeldEnemy = null;
      p.chiiRollTimer = 0;
      updatePlayerSize(p, true);
      sfx.powerup();
      S.score += 1300;
      S.popups.push({ x: item.x, y: item.y - 10, text: 'CHII!', timer: 60, vy: -1.1 });
    }
  }
}

// =========================
//    Update (per frame)
// =========================

export function updatePlayer() {
  const p = S.player;
  if (p.dead) return;

  if (p.yoshiTongueTimer > 0) p.yoshiTongueTimer--;
  if (p.yoshiEatTimer > 0) p.yoshiEatTimer--;
  if (p.yoshiSpitTimer > 0) p.yoshiSpitTimer--;
  if (p.chiiRollTimer > 0) p.chiiRollTimer--;

  // --- Yellow Pipe Entry ---
  if (S.state !== 'hub' && p.grounded && isDown('ArrowDown')) {
    const footRow = Math.floor((p.y + p.h) / T);
    const footCol = Math.floor((p.x + p.w / 2) / T);
    const tBelow = tileAt(footCol, footRow);
    if (tBelow === YPTL || tBelow === YPTR) {
      const pipeTopRow = footRow;
      sfx.pipe();
      S.pipeAnim = { phase: 'sinking', timer: 0, pipeTopRow };
      S.state = 'pipe';
      p.vx = 0;
      return;
    }
  }

  // --- Vine Climbing ---
  const pcCol = Math.floor((p.x + p.w / 2) / T);
  const pcRow = Math.floor((p.y + p.h / 2) / T);
  const onVine = tileAt(pcCol, pcRow) === VINE || tileAt(pcCol, pcRow + 1) === VINE
    || tileAt(pcCol, pcRow - 1) === VINE;

  if (onVine && (isDown('ArrowUp') || isDown('ArrowDown')) && !p.groundPounding) {
    p.climbing = true;
  }
  if (p.climbing && !onVine) {
    p.climbing = false;
  }

  if (p.climbing) {
    p.vx *= 0.5;
    p.vy = 0;
    p.grounded = false;
    const climbSpeed = 2.5;
    if (isDown('ArrowUp')) {
      p.y -= climbSpeed;
    }
    if (isDown('ArrowDown')) {
      p.y += climbSpeed;
    }
    // Jump off vine
    if (wasPressed('Space') || wasPressed('ArrowUp') && isDown('ArrowLeft') || wasPressed('ArrowUp') && isDown('ArrowRight')) {
      p.climbing = false;
      p.vy = JUMP_VEL * 0.8;
      sfx.jump();
      jumpBuffer = 0;
      coyoteTime = 0;
    }
    // Still allow left/right movement while climbing (slower)
    if (isDown('ArrowRight')) { p.vx = 0.5; p.facing = 1; }
    else if (isDown('ArrowLeft')) { p.vx = -0.5; p.facing = -1; }
    else { p.vx = 0; }

    p.x += p.vx;
    resolveX(p);

    // Animation
    p.frameTimer++;
    p.currentFrame = Math.floor(S.tick / 8) % 2;

    // Don't fall through normal movement below
    // Boundaries
    const lvlW = S.tiles[0] ? S.tiles[0].length : 212;
    if (p.x < S.cam.x) { p.x = S.cam.x; p.vx = 0; }
    if (p.x + p.w > lvlW * T) p.x = lvlW * T - p.w;
    if (p.y < 0) p.y = 0;

    // Still collect items while climbing
    collectItems(p);

    // Star timer
    if (S.starTimer > 0) {
      S.starTimer--;
      if (S.starTimer === 0) {
        S.popups.push({ x: p.x, y: p.y - 20, text: 'STAR OFF', timer: 40, vy: -1.2 });
      }
    }

    return; // Skip normal movement when climbing
  }

  // --- Horizontal Movement ---
  const run = isDown('ShiftLeft') || isDown('ShiftRight');
  const rollBoost = p.hasChiikawa && p.chiiRollTimer > 0 ? 2.2 : 0;
  const maxV = (run ? MAX_RUN : MAX_WALK) + rollBoost;

  if (isDown('ArrowRight')) {
    p.vx += MOVE_ACC;
    p.facing = 1;
  } else if (isDown('ArrowLeft')) {
    p.vx -= MOVE_ACC;
    p.facing = -1;
  } else {
    p.vx *= p.grounded ? MOVE_DEC : AIR_DEC;
  }

  if (p.vx > maxV) p.vx = maxV;
  if (p.vx < -maxV) p.vx = -maxV;
  if (Math.abs(p.vx) < 0.02) p.vx = 0;

  if (p.hasChiikawa && p.chiiRollTimer > 0) {
    const rollDir = p.facing >= 0 ? 1 : -1;
    p.vx += rollDir * 0.22;
    if (Math.abs(p.vx) < 2.8) p.vx = rollDir * 2.8;
  }

  // --- Jump Buffering ---
  // Store the jump intent for several frames so it isn't lost
  if (wasPressed('Space') || wasPressed('ArrowUp')) {
    jumpBuffer = JUMP_BUFFER_FRAMES;
  }
  if (jumpBuffer > 0) jumpBuffer--;

  // --- Coyote Time ---
  // Allow jumping for a few frames after walking off an edge
  if (p.grounded) {
    coyoteTime = COYOTE_FRAMES;
  } else {
    if (coyoteTime > 0) coyoteTime--;
  }

  // --- Execute Jump ---
  if (jumpBuffer > 0 && coyoteTime > 0) {
    p.vy = JUMP_VEL;
    p.grounded = false;
    p.groundPounding = false;
    jumpBuffer = 0;
    coyoteTime = 0;
    jumpHoldTimer = JUMP_HOLD_FRAMES;
    sfx.jump();
  }

  // --- Gravity (variable height based on held button) ---
  const holdJump = isDown('Space') || isDown('ArrowUp');
  if (holdJump && p.vy < 0 && jumpHoldTimer > 0) {
    p.vy += GRAV_LOW;
    jumpHoldTimer--;
  } else {
    p.vy += GRAV;
    if (!holdJump) jumpHoldTimer = 0;
  }
  if (p.vy > MAX_FALL) p.vy = MAX_FALL;

  // --- Yoshi Flutter Jump (slow fall while holding jump) ---
  if (p.hasYoshi && holdJump && p.vy > 0 && !p.grounded) {
    p.vy = Math.min(p.vy, 1.8);
  }

  // --- Ground Pound ---
  if (!p.grounded && !p.groundPounding && p.groundPoundWindup <= 0 && wasPressed('ArrowDown')) {
    p.groundPoundWindup = 7;
    p.groundPoundCueX = p.x;
    p.groundPoundCueY = p.y;
    p.vx *= 0.2;
    p.vy = Math.min(p.vy, 0.6);
    jumpBuffer = 0;
    coyoteTime = 0;
  }

  if (p.groundPoundWindup > 0) {
    p.groundPoundWindup--;
    p.vx *= 0.82;
    p.vy = Math.min(p.vy, 0.9);
    if (p.groundPoundWindup === 0) {
      S.popups.push({
        x: p.groundPoundCueX + p.w * 0.5,
        y: p.groundPoundCueY - 20,
        text: 'GROUND POUND!',
        centered: true,
        timer: 52,
        vy: -0.3,
      });
      p.groundPounding = true;
      p.vy = Math.max(p.vy, 8.4);
      p.vx *= 0.25;
    }
  }

  if (p.groundPounding) {
    p.vx *= 0.85;
    p.vy += GRAV * 0.9;
    if (p.vy > MAX_FALL * 1.8) p.vy = MAX_FALL * 1.8;
  }

  // --- Attack (multi-weapon support) ---
  const wantsAttack = wasPressed('KeyZ') || wasPressed('KeyX');
  if (wantsAttack && p.attackTimer <= 0) {
    if (p.hasMiku) {
      // Musical note attack
      p.attackTimer = 14;
      sfx.sing();
      S.leekProjectiles.push({
        x: p.x + (p.facing > 0 ? p.w : -16),
        y: p.y + (p.big ? 14 : 6),
        w: 16, h: 16,
        vx: p.facing * 4.5 + p.vx * 0.3,
        vy: 0,
        timer: 80,
        bounced: false,
        rot: 0,
        type: 'note',
        sineBase: p.y + (p.big ? 14 : 6),
        sineTimer: 0,
        hitEnemies: [],
      });
    } else if (p.hasLeek || p.hasKumamon) {
      // Leek / Rocket launcher attack
      p.attackTimer = 18;
      const isPocky = p.hasKumamon;
      if (isPocky) sfx.rocket(); else sfx.leek();
      S.leekProjectiles.push({
        x: p.x + (p.facing > 0 ? p.w : -20),
        y: isPocky ? (p.y + Math.floor(p.h * 0.62) - 2) : (p.y + (p.big ? 14 : 6)),
        w: isPocky ? 16 : 20,
        h: isPocky ? 5 : 10,
        vx: p.facing * (isPocky ? 5.5 : 5) + p.vx * 0.3,
        vy: isPocky ? 0 : -2.2,
        timer: isPocky ? 95 : 70,
        bounced: false,
        rot: 0,
        muzzleTimer: isPocky ? 6 : 0,
        type: isPocky ? 'pocky' : 'leek',
      });
    } else if (p.hasChiikawa && p.grounded) {
      p.attackTimer = 16;
      p.chiiRollTimer = 52;
      p.vx += (p.facing >= 0 ? 1 : -1) * 2.4;
      sfx.bump();
      S.popups.push({ x: p.x + p.w * 0.5, y: p.y - 14, text: 'ROLL!', centered: true, timer: 26, vy: -0.6 });
    } else if (p.hasYoshi) {
      if (p.yoshiHeldEnemy) {
        // Spit out held enemy as a projectile
        p.attackTimer = 18;
        p.yoshiSpitTimer = 10;
        sfx.tongue();
        S.leekProjectiles.push({
          x: p.x + (p.facing > 0 ? p.w : -20),
          y: p.y + (p.big ? 10 : 4),
          w: 20, h: 20,
          vx: p.facing * 7,
          vy: -1.5,
          timer: 80,
          bounced: false,
          rot: 0,
          type: 'spit',
          enemyType: p.yoshiHeldEnemy,
        });
        p.yoshiHeldEnemy = null;
      } else {
        // Yoshi tongue attack (no detached projectile)
        p.attackTimer = 22;
        p.yoshiTongueTimer = 10;
        sfx.tongue();

        const tongueBox = {
          x: p.facing > 0 ? p.x + p.w - 2 : p.x - 42,
          y: p.y + Math.floor(p.h * 0.42) - 8,
          w: 42,
          h: 16,
        };

        let ateEnemy = false;
        for (let i = 0; i < S.enemies.length; i++) {
          const e = S.enemies[i];
          if (!e.alive || e.stomped) continue;
          if (rectOverlap(tongueBox, { x: e.x, y: e.y, w: e.w, h: e.h })) {
            p.yoshiHeldEnemy = e.kind || 'fox';
            e.alive = false;
            p.yoshiEatTimer = 12;
            S.score += 200;
            sfx.stomp();
            S.popups.push({ x: e.x, y: e.y - 10, text: 'NOM!', timer: 40, vy: -1.5 });
            S.particles.push({ x: e.x, y: e.y, w: 8, h: 8, vx: 0, vy: -4, type: 'poof', timer: 20 });
            ateEnemy = true;
            break;
          }
        }

        if (!ateEnemy) {
          const mx = p.facing > 0 ? p.x + p.w + 2 : p.x - 6;
          const my = p.y + Math.floor(p.h * 0.44);
          S.particles.push({ x: mx, y: my, w: 4, h: 4, vx: p.facing * 1.2, vy: -0.4, type: 'poof', timer: 10 });
        }
      }
    }
  }
  if (p.attackTimer > 0) p.attackTimer--;

  // --- Move & Resolve Collisions ---
  p.x += p.vx;
  resolveX(p);

  const wasGroundPounding = p.groundPounding;
  p.y += p.vy;
  resolveY(p);
  if (wasGroundPounding && p.grounded) {
    p.groundPounding = false;
    groundPoundImpact(p);
  }

  // --- Animation ---
  p.frameTimer++;
  if (!p.grounded) {
    p.currentFrame = 3;
  } else if (Math.abs(p.vx) > 0.5) {
    if (p.frameTimer >= p.frameSpeed) {
      p.frameTimer = 0;
      p.currentFrame = (p.currentFrame + 1) % 3;
    }
  } else {
    p.currentFrame = 0;
  }

  // --- Boundaries ---
  const lvlW = S.tiles[0] ? S.tiles[0].length : 212;
  if (p.x < S.cam.x) { p.x = S.cam.x; p.vx = 0; }
  if (p.x + p.w > lvlW * T) p.x = lvlW * T - p.w;

  // --- Pit Death ---
  if (p.y > LEVEL_H * T + 48) {
    playerDie();
  }

  // --- Invincibility Timer ---
  if (S.invTimer > 0) S.invTimer--;

  // --- Star Timer ---
  if (S.starTimer > 0) {
    S.starTimer--;
    // Sparkle trail
    if (S.tick % 3 === 0) {
      const STAR_COLORS = ['#FCE030', '#FC9838', '#F83800', '#F878F8', '#00E8D8', '#80D010'];
      S.particles.push({
        x: p.x + Math.random() * p.w,
        y: p.y + Math.random() * p.h,
        w: 4 + Math.random() * 4,
        h: 4 + Math.random() * 4,
        vx: (Math.random() - 0.5) * 2,
        vy: -1 - Math.random() * 2,
        type: 'firework',
        color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
        timer: 15,
      });
    }
    if (S.starTimer === 0) {
      S.popups.push({ x: p.x, y: p.y - 20, text: 'STAR OFF', timer: 40, vy: -1.2 });
    }
  }

  // --- Collect Items ---
  collectItems(p);

  // --- Enemy Collision ---
  for (let i = 0; i < S.enemies.length; i++) {
    const e = S.enemies[i];
    if (!e.alive || e.stomped) continue;
    if (!rectOverlap(
      { x: p.x + 2, y: p.y, w: p.w - 4, h: p.h },
      { x: e.x, y: e.y, w: e.w, h: e.h },
    )) continue;

    // Star power: instant kill on contact
    if (S.starTimer > 0) {
      e.alive = false;
      S.score += 500;
      sfx.stomp();
      S.popups.push({ x: e.x, y: e.y - 10, text: '500', timer: 40, vy: -1.5 });
      S.particles.push({ x: e.x, y: e.y, w: 12, h: 12, vx: e.vx * 2, vy: -6, type: 'poof', timer: 25 });
      continue;
    }

    if (p.hasChiikawa && p.chiiRollTimer > 0) {
      e.alive = false;
      S.score += 300;
      sfx.stomp();
      p.vx *= 1.02;
      S.popups.push({ x: e.x, y: e.y - 10, text: 'ROLL 300', timer: 34, vy: -1.2 });
      S.particles.push({ x: e.x, y: e.y, w: 8, h: 8, vx: 0, vy: -4, type: 'poof', timer: 20 });
      continue;
    }

    if (p.vy > 0 && p.y + p.h - e.y < 18) {
      // Stomp
      e.stomped = true;
      e.stompTimer = 30;
      e.h = 10;
      e.y = 13 * T - 10;
      p.vy = -6.5;
      S.score += 100;
      sfx.stomp();
      S.popups.push({ x: e.x, y: e.y - 10, text: '100', timer: 40, vy: -1.5 });
    } else if (S.invTimer <= 0 && S.starTimer <= 0) {
      if (p.hasYoshi) {
        p.hasYoshi = false;
        p.yoshiHeldEnemy = null;
        updatePlayerSize(p, true);
        S.invTimer = 100;
        sfx.bump();
        S.popups.push({ x: p.x, y: p.y - 20, text: 'YOSHI!', timer: 40, vy: -2 });
        S.particles.push({ x: p.x, y: p.y, w: 24, h: 24, vx: -p.facing * 3, vy: -5, type: 'yoshi_flee', timer: 60, gy: 0.3 });
      } else if (p.big) {
        p.big = false;
        p.hasLeek = false;
        p.hasKumamon = false;
        p.hasMiku = false;
        p.hasChiikawa = false;
        p.chiiRollTimer = 0;
        updatePlayerSize(p, true);
        S.invTimer = 100;
        sfx.bump();
      } else {
        playerDie();
      }
    }
  }

  // --- Flagpole ---
  if (S.flagpole && !S.flagpole.captured) {
    const f = S.flagpole;
    if (p.x + p.w > f.x + 4 && p.x < f.x + 12 &&
        p.y + p.h > f.topY && p.y < f.baseY) {
      f.captured = true;
      sfx.flag();
      stopMusic();
      S.state = 'win';
      S.winTimer = 0;
      // Mark this level cleared so the next world unlocks in the hub.
      if (S.currentLevelId) markLevelCompleted(S.currentLevelId);
      const heightRatio = 1 - ((p.y - f.topY) / (f.baseY - f.topY));
      const bonus = Math.floor(Math.max(0, heightRatio) * 5000);
      S.score += bonus;
      S.popups.push({ x: f.x - 20, y: p.y, text: String(bonus), timer: 80, vy: -1 });
      S.score += S.time * 50;
    }
  }

  // --- Checkpoints ---
  const pCol = Math.floor((p.x + p.w / 2) / T);
  const checkCols = S.checkpointCols || CHECKPOINT_COLS_DEFAULT;
  for (let i = 0; i < checkCols.length; i++) {
    const cp = checkCols[i];
    if (pCol >= cp && !S.reachedCheckpoints[cp]) {
      S.reachedCheckpoints[cp] = true;
      S.checkpointX = cp * T;
      S.score += 300;
      sfx.oneup();
      S.popups.push({ x: p.x, y: p.y - 20, text: 'CHECKPOINT', timer: 70, vy: -0.8 });
    }
  }
}
