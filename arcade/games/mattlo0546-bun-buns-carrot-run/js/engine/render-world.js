/**
 * World rendering: sky background, parallax layers, tile drawing, flagpole.
 */
import S from './state.js';
import {
  T, W, H,
  SKY, C_GND, C_DIRT, C_BRICK, C_BRICK_D, C_BRICK_L,
  C_USED, C_STONE, C_STONE_D, C_PIPE, C_PIPE_D, C_PIPE_L,
  C_YPIPE, C_YPIPE_D, C_YPIPE_L,
  NES_WHITE, NES_BLACK, NES_GREEN, NES_DKGREEN, NES_LTGREEN,
  NES_GOLD, NES_ORANGE, NES_BROWN, NES_RED,
  NES_TEAL, NES_PINK, NES_PURPLE, NES_DKPURPLE,
  GND, DIRT, BRICK, QCARROT, QLEEK, QKUMA, USED, STONE,
  QMIKU, QYOSHI, QCHII, LAVA,
  Q1UP, VINE, QSTAR,
  PTL, PTR, PBL, PBR,
  YPTL, YPTR, YPBL, YPBR,
  EMPTY,
} from './constants.js';
import { isLevelLocked } from './progress.js';

// =========================
//   NES-style Background Shapes (blocky)
// =========================

export function drawHill(ctx, x, baseY, w, h) {
  // Blocky stepped hill (NES style)
  const steps = Math.floor(h / 8);
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const sw = w * (1 - t * 0.7);
    const sy = baseY - i * 8;
    ctx.fillRect(x - sw / 2, sy - 8, sw, 10);
  }
}

export function drawBush(ctx, x, y) {
  // Blocky NES bush
  ctx.fillRect(x - 8, y - 12, 56, 12);
  ctx.fillRect(x - 4, y - 20, 48, 10);
  ctx.fillRect(x + 4, y - 26, 32, 8);
}

export function drawCloud(ctx, x, y) {
  // Blocky NES cloud
  ctx.fillRect(x - 10, y - 4, 56, 16);
  ctx.fillRect(x - 4, y - 12, 44, 10);
  ctx.fillRect(x + 4, y - 18, 28, 8);
  ctx.fillRect(x - 2, y + 10, 40, 6);
}

// =========================
//      Sky + Parallax
// =========================

export function drawBackground() {
  const ctx = S.ctx;

  if (S.underground) {
    ctx.fillStyle = NES_BLACK;
    ctx.fillRect(0, 0, W, H);
    return;
  }

  if (S.level >= 2) {
    // Night sky (Level 2)
    ctx.fillStyle = NES_DKPURPLE;
    ctx.fillRect(0, 0, W, H);

    // Stars
    ctx.fillStyle = NES_WHITE;
    for (let i = 0; i < 40; i++) {
      const starSeedX = (i * 137 + 42) % 800;
      const starSeedY = (i * 89 + 126) % 140;
      const parallax = (starSeedX - S.cam.x * 0.03) % W;
      const starX = ((parallax % W) + W) % W;
      const twinkle = Math.sin(S.tick * 0.05 + i * 1.7) > 0.2;
      if (twinkle) {
        ctx.fillRect(starX, starSeedY, 2, 2);
        if (i % 5 === 0) {
          ctx.fillRect(starX - 1, starSeedY + 1, 4, 1);
          ctx.fillRect(starX + 1, starSeedY - 1, 1, 4);
        }
      }
    }

    // Moon (crescent)
    const moonX = ((650 - S.cam.x * 0.02) % W + W) % W;
    ctx.fillStyle = NES_GOLD;
    ctx.fillRect(moonX, 30, 28, 28);
    ctx.fillStyle = '#FCFC00';
    ctx.fillRect(moonX + 2, 32, 24, 24);
    ctx.fillStyle = NES_DKPURPLE;
    ctx.fillRect(moonX + 10, 28, 20, 24);

    // Purple mountains
    const ho = S.cam.x * 0.15;
    ctx.fillStyle = NES_PURPLE;
    drawHill(ctx, (-ho % 900) + 100, H - 64, 200, 100);
    drawHill(ctx, (-ho % 900) + 500, H - 64, 160, 80);
    drawHill(ctx, (-ho % 900) + 800, H - 64, 220, 110);
    drawHill(ctx, (-ho % 900) - 200, H - 64, 180, 90);

    // Darker near mountains
    const ho2 = S.cam.x * 0.3;
    ctx.fillStyle = '#3C2870';
    drawHill(ctx, (-ho2 % 700) + 80, H - 64, 130, 60);
    drawHill(ctx, (-ho2 % 700) + 420, H - 64, 100, 45);
    drawHill(ctx, (-ho2 % 700) + 650, H - 64, 160, 70);
    return;
  }

  // Sky (NES blue)
  ctx.fillStyle = SKY;
  ctx.fillRect(0, 0, W, H);

  // Distant hills (dark green, NES style)
  const ho = S.cam.x * 0.2;
  ctx.fillStyle = NES_DKGREEN;
  drawHill(ctx, (-ho % 900) + 100, H - 64, 180, 90);
  drawHill(ctx, (-ho % 900) + 500, H - 64, 140, 70);
  drawHill(ctx, (-ho % 900) + 800, H - 64, 200, 100);
  drawHill(ctx, (-ho % 900) - 200, H - 64, 160, 80);

  // Near hills
  const ho2 = S.cam.x * 0.35;
  ctx.fillStyle = NES_GREEN;
  drawHill(ctx, (-ho2 % 700) + 80, H - 64, 120, 55);
  drawHill(ctx, (-ho2 % 700) + 420, H - 64, 90, 40);
  drawHill(ctx, (-ho2 % 700) + 650, H - 64, 150, 65);

  // Bushes (bright NES green)
  const ho3 = S.cam.x * 0.45;
  ctx.fillStyle = NES_LTGREEN;
  drawBush(ctx, (-ho3 % 600) + 60, H - 66);
  drawBush(ctx, (-ho3 % 600) + 320, H - 66);
  drawBush(ctx, (-ho3 % 600) + 560, H - 66);

  // Clouds (NES white, no transparency — NES had no alpha)
  const co = S.cam.x * 0.1;
  ctx.fillStyle = NES_WHITE;
  drawCloud(ctx, (-co % 1000) + 100, 55);
  drawCloud(ctx, (-co % 1000) + 380, 35);
  drawCloud(ctx, (-co % 1000) + 620, 70);
  drawCloud(ctx, (-co % 1000) + 860, 48);
  drawCloud(ctx, (-co % 1000) - 100, 80);

  if (S.state === 'hub') {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '32px "Press Start 2P", monospace';
    ctx.fillStyle = NES_BLACK;
    ctx.fillText('WORLD HUB', W / 2 + 3, 120 + 3);
    ctx.fillStyle = NES_WHITE;
    ctx.fillText('WORLD HUB', W / 2, 120);
    ctx.textAlign = 'left';
    ctx.restore();
  }
}

// =========================
//    Block Bump Offset
// =========================

function getBlockAnimOffset(col, row) {
  for (let i = 0; i < S.blockAnims.length; i++) {
    const b = S.blockAnims[i];
    if (b.col === col && b.row === row) {
      const t = b.time;
      return t < 4 ? -t * 2 : -(8 - t) * 2;
    }
  }
  return 0;
}

// =========================
//     Tile Drawing
// =========================

export function drawTile(type, sx, sy, col, row) {
  const ctx = S.ctx;
  const yo = getBlockAnimOffset(col, row);
  const x = sx, y = sy + yo;

  switch (type) {
    case GND:
      ctx.fillStyle = C_GND;
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = NES_LTGREEN;
      ctx.fillRect(x, y, T, 6);
      ctx.fillStyle = NES_DKGREEN;
      for (let gi = 0; gi < 4; gi++) ctx.fillRect(x + gi * 9 + 2, y + 6, 2, 4);
      break;

    case DIRT:
      ctx.fillStyle = C_DIRT;
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = NES_BROWN;
      ctx.fillRect(x + 4, y + 4, 6, 6);
      ctx.fillRect(x + 20, y + 18, 8, 6);
      ctx.fillRect(x + 14, y + 8, 4, 4);
      break;

    case BRICK:
      ctx.fillStyle = C_BRICK;
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = NES_BLACK;
      ctx.fillRect(x, y + 14, T, 2);
      ctx.fillRect(x, y + 30, T, 2);
      ctx.fillRect(x + 14, y, 2, 14);
      ctx.fillRect(x + 6, y + 16, 2, 14);
      ctx.fillRect(x + 22, y + 16, 2, 14);
      ctx.fillStyle = C_BRICK_L;
      ctx.fillRect(x, y, T, 2);
      ctx.fillRect(x, y + 16, T, 1);
      break;

    case QCARROT:
    case QLEEK:
    case QKUMA:
    case QCHII: {
      const pulse = Math.sin(S.tick * 0.12) * 0.12 + 0.88;
      const r = Math.floor(252 * pulse);
      const g = Math.floor(188 * pulse);
      const b = Math.floor(60 * pulse);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = NES_BROWN;
      ctx.fillRect(x, y, T, 2); ctx.fillRect(x, y, 2, T);
      ctx.fillRect(x, y + T - 2, T, 2); ctx.fillRect(x + T - 2, y, 2, T);
      ctx.fillStyle = NES_GOLD;
      ctx.fillRect(x + 2, y + 2, T - 4, 2); ctx.fillRect(x + 2, y + 2, 2, T - 4);
      ctx.fillStyle = NES_WHITE;
      ctx.font = 'bold 20px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const blockMark = type === QKUMA ? 'K' : (type === QCHII ? 'C' : '?');
      ctx.fillText(blockMark, x + T / 2, y + T / 2 + 1);
      ctx.fillStyle = NES_BLACK;
      ctx.fillText(blockMark, x + T / 2 + 1, y + T / 2 + 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      break;
    }

    case USED:
      ctx.fillStyle = C_USED;
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = NES_BLACK;
      ctx.fillRect(x, y, T, 2); ctx.fillRect(x, y, 2, T);
      ctx.fillRect(x, y + T - 2, T, 2); ctx.fillRect(x + T - 2, y, 2, T);
      ctx.fillStyle = '#585858';
      ctx.fillRect(x + 4, y + 4, T - 8, T - 8);
      break;

    case STONE:
      ctx.fillStyle = C_STONE;
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = NES_WHITE;
      ctx.fillRect(x + 1, y + 1, T - 2, 2);
      ctx.fillRect(x + 1, y + 1, 2, T - 2);
      ctx.fillStyle = C_STONE_D;
      ctx.fillRect(x + 1, y + T - 3, T - 2, 2);
      ctx.fillRect(x + T - 3, y + 1, 2, T - 2);
      break;

    case PTL:
      ctx.fillStyle = C_PIPE;
      ctx.fillRect(x - 4, y, T + 4, T);
      ctx.fillStyle = C_PIPE_L;
      ctx.fillRect(x - 4, y, 6, T);
      ctx.fillStyle = C_PIPE_D;
      ctx.fillRect(x + T - 4, y, 8, T);
      ctx.fillStyle = NES_DKGREEN;
      ctx.fillRect(x - 4, y, T + 8, 4);
      ctx.fillStyle = NES_LTGREEN;
      ctx.fillRect(x, y + 4, 6, T - 4);
      break;

    case PTR:
      ctx.fillStyle = C_PIPE;
      ctx.fillRect(x, y, T + 4, T);
      ctx.fillStyle = C_PIPE_D;
      ctx.fillRect(x + T - 2, y, 6, T);
      ctx.fillStyle = NES_DKGREEN;
      ctx.fillRect(x - 2, y, T + 6, 4);
      break;

    case PBL:
      ctx.fillStyle = C_PIPE;
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = C_PIPE_L;
      ctx.fillRect(x, y, 4, T);
      ctx.fillStyle = C_PIPE_D;
      ctx.fillRect(x + T - 4, y, 4, T);
      ctx.fillStyle = NES_LTGREEN;
      ctx.fillRect(x + 6, y, 4, T);
      break;

    case PBR:
      ctx.fillStyle = C_PIPE;
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = C_PIPE_D;
      ctx.fillRect(x + T - 4, y, 4, T);
      break;

    case YPTL:
      ctx.fillStyle = C_YPIPE;
      ctx.fillRect(x - 4, y, T + 4, T);
      ctx.fillStyle = C_YPIPE_L;
      ctx.fillRect(x - 4, y, 6, T);
      ctx.fillStyle = C_YPIPE_D;
      ctx.fillRect(x + T - 4, y, 8, T);
      ctx.fillStyle = NES_BROWN;
      ctx.fillRect(x - 4, y, T + 8, 4);
      ctx.fillStyle = '#FCFC00';
      ctx.fillRect(x, y + 4, 6, T - 4);
      // Down arrow hint
      ctx.fillStyle = NES_WHITE;
      ctx.font = 'bold 14px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('\u25BC', x + T / 2 + 4, y + T - 6);
      ctx.textAlign = 'left';
      break;

    case YPTR:
      ctx.fillStyle = C_YPIPE;
      ctx.fillRect(x, y, T + 4, T);
      ctx.fillStyle = C_YPIPE_D;
      ctx.fillRect(x + T - 2, y, 6, T);
      ctx.fillStyle = NES_BROWN;
      ctx.fillRect(x - 2, y, T + 6, 4);
      break;

    case YPBL:
      ctx.fillStyle = C_YPIPE;
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = C_YPIPE_L;
      ctx.fillRect(x, y, 4, T);
      ctx.fillStyle = C_YPIPE_D;
      ctx.fillRect(x + T - 4, y, 4, T);
      ctx.fillStyle = '#FCFC00';
      ctx.fillRect(x + 6, y, 4, T);
      break;

    case YPBR:
      ctx.fillStyle = C_YPIPE;
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = C_YPIPE_D;
      ctx.fillRect(x + T - 4, y, 4, T);
      break;

    case LAVA: {
      // Animated lava
      const lavaPhase = Math.sin(S.tick * 0.08 + col * 0.5) * 0.5 + 0.5;
      ctx.fillStyle = NES_RED;
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = NES_ORANGE;
      ctx.fillRect(x, y, T, T * (0.3 + lavaPhase * 0.3));
      ctx.fillStyle = NES_GOLD;
      ctx.fillRect(x + 4, y + 2, T - 8, 4);
      // Bubbles
      if (Math.sin(S.tick * 0.12 + col * 2) > 0.6) {
        ctx.fillStyle = NES_GOLD;
        ctx.fillRect(x + 8 + (col % 3) * 6, y + 4, 4, 4);
      }
      break;
    }

    case QMIKU: {
      // Teal Miku block with 'M'
      const mp = Math.sin(S.tick * 0.12) * 0.12 + 0.88;
      ctx.fillStyle = `rgb(${Math.floor(0 + 232 * mp)},${Math.floor(232 * mp)},${Math.floor(216 * mp)})`;
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = '#006868';
      ctx.fillRect(x, y, T, 2); ctx.fillRect(x, y, 2, T);
      ctx.fillRect(x, y + T - 2, T, 2); ctx.fillRect(x + T - 2, y, 2, T);
      ctx.fillStyle = NES_TEAL;
      ctx.fillRect(x + 2, y + 2, T - 4, 2); ctx.fillRect(x + 2, y + 2, 2, T - 4);
      ctx.fillStyle = NES_WHITE;
      ctx.font = 'bold 20px "Press Start 2P", monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('M', x + T / 2, y + T / 2 + 1);
      ctx.fillStyle = NES_BLACK;
      ctx.fillText('M', x + T / 2 + 1, y + T / 2 + 2);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      break;
    }

    case QYOSHI: {
      // Green Yoshi block with 'Y'
      const yp = Math.sin(S.tick * 0.12) * 0.12 + 0.88;
      ctx.fillStyle = `rgb(${Math.floor(60 * yp)},${Math.floor(188 * yp)},${Math.floor(60 * yp)})`;
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = NES_DKGREEN;
      ctx.fillRect(x, y, T, 2); ctx.fillRect(x, y, 2, T);
      ctx.fillRect(x, y + T - 2, T, 2); ctx.fillRect(x + T - 2, y, 2, T);
      ctx.fillStyle = NES_GREEN;
      ctx.fillRect(x + 2, y + 2, T - 4, 2); ctx.fillRect(x + 2, y + 2, 2, T - 4);
      ctx.fillStyle = NES_WHITE;
      ctx.font = 'bold 20px "Press Start 2P", monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Y', x + T / 2, y + T / 2 + 1);
      ctx.fillStyle = NES_BLACK;
      ctx.fillText('Y', x + T / 2 + 1, y + T / 2 + 2);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      break;
    }

    case Q1UP: {
      // Pink 1-UP block with bunny ears icon
      const p1 = Math.sin(S.tick * 0.12) * 0.12 + 0.88;
      ctx.fillStyle = `rgb(${Math.floor(248 * p1)},${Math.floor(120 * p1)},${Math.floor(248 * p1)})`;
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = '#A04080';
      ctx.fillRect(x, y, T, 2); ctx.fillRect(x, y, 2, T);
      ctx.fillRect(x, y + T - 2, T, 2); ctx.fillRect(x + T - 2, y, 2, T);
      ctx.fillStyle = NES_PINK;
      ctx.fillRect(x + 2, y + 2, T - 4, 2); ctx.fillRect(x + 2, y + 2, 2, T - 4);
      // Bunny ears icon
      ctx.fillStyle = NES_WHITE;
      ctx.fillRect(x + 10, y + 6, 4, 10);
      ctx.fillRect(x + 18, y + 6, 4, 10);
      ctx.fillRect(x + 8, y + 14, 16, 10);
      // Eyes
      ctx.fillStyle = NES_BLACK;
      ctx.fillRect(x + 11, y + 18, 3, 3);
      ctx.fillRect(x + 18, y + 18, 3, 3);
      break;
    }

    case QSTAR: {
      // Rainbow-pulsing star block
      const sp = Math.sin(S.tick * 0.15) * 0.15 + 0.85;
      const starColors = ['#FCE030', '#FC9838', '#F83800', '#F878F8', '#00E8D8'];
      const sci = Math.floor(S.tick * 0.08) % starColors.length;
      ctx.fillStyle = starColors[sci];
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = NES_BROWN;
      ctx.fillRect(x, y, T, 2); ctx.fillRect(x, y, 2, T);
      ctx.fillRect(x, y + T - 2, T, 2); ctx.fillRect(x + T - 2, y, 2, T);
      ctx.fillStyle = NES_GOLD;
      ctx.fillRect(x + 2, y + 2, T - 4, 2); ctx.fillRect(x + 2, y + 2, 2, T - 4);
      ctx.fillStyle = NES_WHITE;
      ctx.font = 'bold 20px "Press Start 2P", monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('\u2605', x + T / 2, y + T / 2 + 1);
      ctx.fillStyle = NES_BLACK;
      ctx.fillText('\u2605', x + T / 2 + 1, y + T / 2 + 2);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      break;
    }

    case VINE: {
      // Tree trunk / vine — climbable
      ctx.fillStyle = '#7D4B20';
      ctx.fillRect(x + 10, y, 12, T);
      ctx.fillStyle = '#5A3A1A';
      ctx.fillRect(x + 12, y, 2, T);
      ctx.fillRect(x + 18, y, 2, T);
      // Green leaf accents
      ctx.fillStyle = NES_GREEN;
      const leafSide = (row % 2 === 0) ? -1 : 1;
      if (leafSide > 0) {
        ctx.fillRect(x + 22, y + 4, 8, 6);
        ctx.fillRect(x + 24, y + 2, 6, 3);
      } else {
        ctx.fillRect(x + 2, y + 4, 8, 6);
        ctx.fillRect(x + 2, y + 2, 6, 3);
      }
      ctx.fillStyle = NES_DKGREEN;
      if (leafSide > 0) {
        ctx.fillRect(x + 24, y + 8, 4, 2);
      } else {
        ctx.fillRect(x + 4, y + 8, 4, 2);
      }
      break;
    }
  }
}

// =========================
//      Flagpole
// =========================

export function drawFlagpole() {
  if (!S.flagpole) return;
  const ctx = S.ctx;
  const fx = S.flagpole.x - S.cam.x;

  // Pole (NES style solid colors, no gradients)
  ctx.fillStyle = C_STONE;
  ctx.fillRect(fx + 6, S.flagpole.topY, 4, S.flagpole.baseY - S.flagpole.topY);

  // Ball on top (blocky NES square)
  ctx.fillStyle = NES_GOLD;
  ctx.fillRect(fx + 2, S.flagpole.topY - 8, 12, 10);
  ctx.fillStyle = '#FCFC00';
  ctx.fillRect(fx + 4, S.flagpole.topY - 6, 8, 6);

  // Flag (blocky triangle via rectangles)
  ctx.fillStyle = NES_GREEN;
  ctx.fillRect(fx + 10, S.flagpole.flagY, 20, 4);
  ctx.fillRect(fx + 10, S.flagpole.flagY + 4, 16, 4);
  ctx.fillRect(fx + 10, S.flagpole.flagY + 8, 12, 4);
  ctx.fillRect(fx + 10, S.flagpole.flagY + 12, 8, 4);
  ctx.fillRect(fx + 10, S.flagpole.flagY + 16, 4, 4);

  // Carrot icon on flag (blocky)
  ctx.fillStyle = NES_ORANGE;
  ctx.fillRect(fx + 14, S.flagpole.flagY + 4, 6, 10);
  ctx.fillStyle = NES_DKGREEN;
  ctx.fillRect(fx + 15, S.flagpole.flagY + 2, 4, 4);

  // Base stone
  ctx.fillStyle = C_STONE_D;
  ctx.fillRect(fx, S.flagpole.baseY - 4, 16, 4);
}

// =========================
//     Hub Entrances
// =========================

export function drawHubEntrances() {
  if (S.state !== 'hub' || !S.hubEntrances) return;
  const ctx = S.ctx;
  ctx.font = '10px "Press Start 2P", monospace';
  ctx.textAlign = 'center';

  for (let i = 0; i < S.hubEntrances.length; i++) {
    const e = S.hubEntrances[i];
    const sx = e.x - S.cam.x;
    const sy = e.y;
    const locked = isLevelLocked(e.id);

    if (e.kind === 'door') {
      ctx.fillStyle = C_STONE;
      ctx.fillRect(sx, sy, e.w, e.h);
      ctx.fillStyle = C_STONE_D;
      ctx.fillRect(sx + 2, sy + 2, e.w - 4, e.h - 4);
      ctx.fillStyle = NES_BLACK;
      ctx.fillRect(sx + e.w / 2 - 2, sy + e.h / 2, 4, 4);
    }

    // Number marker above entrance
    ctx.fillStyle = NES_BLACK;
    ctx.fillText(String(e.number || 1), sx + e.w / 2 + 1, sy - 10);
    ctx.fillStyle = locked ? '#888' : NES_WHITE;
    ctx.fillText(String(e.number || 1), sx + e.w / 2, sy - 11);

    if (locked) {
      drawPadlock(ctx, sx + e.w / 2 - 8, sy + 6);
    }

    // Denial pulse: red ring around the entrance the player just bumped.
    if (S.lockDenyTimer > 0 && S.lockDenyEntranceId === e.id) {
      const t = S.lockDenyTimer;
      ctx.save();
      ctx.globalAlpha = Math.min(1, t / 30);
      ctx.strokeStyle = NES_RED;
      ctx.lineWidth = 2;
      const grow = (30 - t) * 0.6;
      ctx.strokeRect(sx - 2 - grow, sy - 2 - grow, e.w + 4 + grow * 2, e.h + 4 + grow * 2);
      ctx.restore();
      // "LOCKED" tag above
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillStyle = NES_BLACK;
      ctx.fillText('LOCKED', sx + e.w / 2 + 1, sy - 24 + 1);
      ctx.fillStyle = NES_RED;
      ctx.fillText('LOCKED', sx + e.w / 2, sy - 24);
      ctx.font = '10px "Press Start 2P", monospace';
    }
  }

  ctx.textAlign = 'left';
}

function drawPadlock(ctx, x, y) {
  // Shackle
  ctx.fillStyle = '#BCBCBC';
  ctx.fillRect(x + 4, y, 8, 2);
  ctx.fillRect(x + 3, y + 2, 2, 4);
  ctx.fillRect(x + 11, y + 2, 2, 4);
  // Body
  ctx.fillStyle = NES_GOLD;
  ctx.fillRect(x, y + 6, 16, 12);
  ctx.fillStyle = '#AC7C00';
  ctx.fillRect(x, y + 16, 16, 2);
  ctx.fillStyle = '#FCFC00';
  ctx.fillRect(x + 1, y + 7, 14, 1);
  // Keyhole
  ctx.fillStyle = NES_BLACK;
  ctx.fillRect(x + 7, y + 10, 2, 4);
  ctx.fillRect(x + 6, y + 10, 4, 2);
}

export function drawCheckpoints() {
  const ctx = S.ctx;
  const cols = S.checkpointCols || [76, 140, 168];
  for (let i = 0; i < cols.length; i++) {
    const col = cols[i];
    const x = col * T - S.cam.x;
    if (x < -20 || x > W + 20) continue;
    const active = !!S.reachedCheckpoints[col];
    const baseY = 13 * T;

    ctx.fillStyle = C_STONE;
    ctx.fillRect(x + 4, baseY - 38, 4, 38);
    // Blocky flag
    ctx.fillStyle = active ? NES_GREEN : NES_GOLD;
    ctx.fillRect(x + 8, baseY - 36, 14, 4);
    ctx.fillRect(x + 8, baseY - 32, 10, 4);
    ctx.fillRect(x + 8, baseY - 28, 6, 4);
  }
}
