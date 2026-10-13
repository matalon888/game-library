/**
 * Render orchestrator — composes all render sub-modules into screen drawing.
 *
 * Uses a half-resolution off-screen buffer (400×240) scaled up 2× with
 * imageSmoothingEnabled=false for authentic NES-style pixel rendering.
 * T=32 at display res → 16px base tiles.  Player 24×32 → 12×16 base pixels.
 */
import S from './state.js';
import { T, W, H, COLS, LEVEL_H, LEVEL_W, EMPTY } from './constants.js';
import { drawBackground, drawTile, drawFlagpole, drawCheckpoints, drawHubEntrances } from './render-world.js';
import { drawBunny, drawEnemy, drawLeekProj, drawItems, drawParticles } from './render-sprites.js';
import { drawHUD, drawTitleScreen, drawGameOver, drawWinOverlay } from './render-ui.js';

// =========================
//   NES Pixel Buffer
// =========================
const NES_SCALE = 2;
const BASE_W = W / NES_SCALE;
const BASE_H = H / NES_SCALE;
let bufCanvas = null;
if (typeof document !== 'undefined') {
  bufCanvas = document.createElement('canvas');
  bufCanvas.width = W;
  bufCanvas.height = H;
}
const bufCtx = bufCanvas ? bufCanvas.getContext('2d') : null;

if (bufCtx) bufCtx.imageSmoothingEnabled = false;

// =========================
//   Level (gameplay) view
// =========================

function renderLevel() {
  const { ctx } = S;

  drawBackground();

  // Tiles
  const startCol = Math.floor(S.cam.x / T);
  const lvlW = S.tiles[0] ? S.tiles[0].length : 212;
  const endCol = Math.min(startCol + COLS, lvlW);
  for (let row = 0; row < LEVEL_H; row++) {
    for (let col = startCol; col < endCol; col++) {
      const type = S.tiles[row][col];
      if (type !== EMPTY) {
        drawTile(type, col * T - S.cam.x, row * T, col, row);
      }
    }
  }

  // Items (behind player)
  drawItems();

  // Hub entrances (numbers/doors)
  drawHubEntrances();

  // Flagpole (behind player)
  drawFlagpole();

  // Checkpoints
  drawCheckpoints();

  // Enemies
  for (let i = 0; i < S.enemies.length; i++) {
    const e = S.enemies[i];
    if (e.alive && e.x > S.cam.x - T * 2 && e.x < S.cam.x + W + T * 2) {
      drawEnemy(e);
    }
  }

  // Leek projectiles
  for (let i = 0; i < S.leekProjectiles.length; i++) {
    drawLeekProj(S.leekProjectiles[i]);
  }

  // Player
  if (!S.player.dead || S.state === 'dying') {
    const sinkingInPipe = (S.state === 'pipe' || S.state === 'hubPipe') && S.pipeAnim && S.pipeAnim.phase === 'sinking';
    if (sinkingInPipe) {
      // Clip player so they sink behind/into the pipe
      ctx.save();
      const pipeTopY = (S.pipeAnim.pipeTopRow || 11) * T;
      ctx.beginPath();
      ctx.rect(0, 0, W, pipeTopY);
      ctx.clip();
      drawBunny(S.player.x - S.cam.x, S.player.y);
      ctx.restore();

      // In hub transition, redraw the pipe lip on top so player is clearly beneath it.
      if (S.state === 'hubPipe' && typeof S.pipeAnim.pipeLipX === 'number' && typeof S.pipeAnim.pipeLipW === 'number') {
        const row = S.pipeAnim.pipeTopRow || 11;
        const startCol = Math.floor(S.pipeAnim.pipeLipX / T);
        const endCol = Math.floor((S.pipeAnim.pipeLipX + S.pipeAnim.pipeLipW - 1) / T);
        for (let col = startCol; col <= endCol; col++) {
          const type = S.tiles[row]?.[col];
          if (type !== undefined && type !== EMPTY) {
            drawTile(type, col * T - S.cam.x, row * T, col, row);
          }
        }
      }
    } else {
      drawBunny(S.player.x - S.cam.x, S.player.y);
    }
  }

  // Particles & popups
  drawParticles();

  // HUD
  drawHUD();
}

// =========================
//    Main render dispatch
// =========================

export function render() {
  const realCtx = S.ctx;

  // --- Redirect all drawing to the half-res NES buffer ---
  bufCtx.save();
  bufCtx.scale(1 / NES_SCALE, 1 / NES_SCALE);
  S.ctx = bufCtx;

  try {
    bufCtx.clearRect(0, 0, W, H);   // scaled coords

    switch (S.state) {
      case 'title':
        drawTitleScreen();
        break;
      case 'hub':
      case 'hubPipe':
      case 'playing':
      case 'dying':
        renderLevel();
        break;
      case 'gameover':
        renderLevel();
        drawGameOver();
        break;
      case 'win':
        renderLevel();
        drawParticles();
        drawWinOverlay();
        break;
      case 'pipe':
        renderLevel();
        break;
    }

    // Pipe transition overlay
    if (S.pipeAnim) {
      let alpha = 0;
      if (S.pipeAnim.phase === 'sinking') alpha = S.pipeAnim.timer / 30;
      else if (S.pipeAnim.phase === 'black') alpha = 1;
      else if (S.pipeAnim.phase === 'fading') alpha = 1 - S.pipeAnim.timer / 30;
      bufCtx.fillStyle = `rgba(0,0,0,${alpha})`;
      bufCtx.fillRect(0, 0, W, H);
    }
  } finally {
    bufCtx.restore();

    // --- Blit the NES buffer up to the display canvas (2× integer scale) ---
    S.ctx = realCtx;
    realCtx.imageSmoothingEnabled = false;
    realCtx.clearRect(0, 0, W, H);
    realCtx.drawImage(bufCanvas, 0, 0, BASE_W, BASE_H, 0, 0, W, H);
  }
}
