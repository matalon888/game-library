/**
 * UI rendering: HUD, title screen, game over, win overlay.
 */
import S from './state.js';
import { W, H, T, SKY, C_GND, C_DIRT, C_PIPE, C_PIPE_L, C_PIPE_D,
         NES_WHITE, NES_BLACK, NES_RED, NES_GOLD, NES_ORANGE,
         NES_GREEN, NES_DKGREEN, NES_LTGREEN, NES_BROWN,
         C_STONE_D } from './constants.js';
import { drawHill, drawBush, drawCloud } from './render-world.js';
import { getBunbunSpriteSheet, getBunbunFrameRect, isSpriteReady } from './sprites.js';

// 8-bit arcade font helper
const FONT_8 = '"Press Start 2P", monospace';

function drawTitleText(ctx, text, x, y, options = {}) {
  const {
    color = NES_WHITE,
    shadow = NES_BLACK,
    font = `12px ${FONT_8}`,
    align = 'center',
  } = options;

  const prevAlign = ctx.textAlign;
  const prevFont = ctx.font;
  const prevFill = ctx.fillStyle;

  ctx.textAlign = align;
  ctx.font = font;
  ctx.fillStyle = shadow;
  ctx.fillText(text, x + 2, y + 2);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);

  ctx.textAlign = prevAlign;
  ctx.font = prevFont;
  ctx.fillStyle = prevFill;
}

// =========================
//          HUD
//  (Classic SMB NES layout)
// =========================

export function drawHUD() {
  const { ctx } = S;
  const p = S.player;
  ctx.save();

  // NES: no overlay bar — text renders directly on the game
  ctx.fillStyle = NES_WHITE;
  ctx.font = `16px ${FONT_8}`;

  // HERO label + Score
  ctx.textAlign = 'left';
  ctx.fillText('HERO', 20, 24);
  ctx.fillText(String(S.score).padStart(6, '0'), 20, 46);

  // Carrot coin count (carrot icon via rectangles + count)
  ctx.fillStyle = NES_ORANGE;
  ctx.fillRect(194, 30, 8, 14);
  ctx.fillStyle = NES_DKGREEN;
  ctx.fillRect(195, 26, 4, 6);
  ctx.fillStyle = NES_WHITE;
  ctx.fillText('x' + String(S.coinCount).padStart(2, '0'), 210, 46);

  // World
  ctx.textAlign = 'center';
  ctx.fillStyle = NES_WHITE;
  ctx.fillText('WORLD', W / 2 + 40, 24);
  const worldStr = S.state === 'hub' ? 'HUB' : (S.underground ? `${S.level}-U` : `${S.level}-1`);
  ctx.fillText(worldStr, W / 2 + 40, 46);

  // Time
  if (S.state !== 'hub') {
    ctx.textAlign = 'right';
    ctx.fillStyle = NES_WHITE;
    ctx.fillText('TIME', W - 20, 24);
    ctx.fillStyle = S.time <= 60 ? NES_RED : NES_WHITE;
    ctx.fillText(String(Math.max(0, S.time)).padStart(3, '0'), W - 20, 46);
  }

  // Lives (small blocky bunny head + count)
  ctx.textAlign = 'left';
  ctx.fillStyle = NES_WHITE;
  ctx.fillRect(340, 30, 10, 10);   // tiny bunny head block
  ctx.fillRect(342, 22, 3, 8);     // left ear
  ctx.fillRect(346, 22, 3, 8);     // right ear
  ctx.fillStyle = NES_RED;
  ctx.fillRect(340, 40, 10, 4);    // shirt
  ctx.fillStyle = NES_WHITE;
  ctx.fillText('x' + S.lives, 356, 46);

  // Star power timer bar
  if (S.starTimer > 0) {
    const barW = Math.floor((S.starTimer / 480) * 80);
    const STAR_COLORS = ['#FCE030', '#FC9838', '#F83800', '#F878F8', '#00E8D8'];
    const sci = Math.floor(S.tick * 0.3) % STAR_COLORS.length;
    ctx.fillStyle = STAR_COLORS[sci];
    ctx.fillRect(20, 55, barW, 6);
    ctx.fillStyle = NES_BLACK;
    ctx.fillRect(20 + barW, 55, 80 - barW, 6);
    ctx.fillStyle = NES_WHITE;
    ctx.font = `8px ${FONT_8}`;
    ctx.fillText('\u2605', 104, 62);
  }

  ctx.textAlign = 'left';
  ctx.restore();

}

// =========================
//      Title Screen
// =========================

export function drawTitleScreen() {
  const { ctx } = S;

  ctx.fillStyle = SKY;
  ctx.fillRect(0, 0, W, H);

  // Ground (NES-style)
  ctx.fillStyle = C_GND;
  ctx.fillRect(0, H - 64, W, 10);
  ctx.fillStyle = NES_DKGREEN;
  for (let gi = 0; gi < 30; gi++) ctx.fillRect(gi * 28 + 5, H - 54, 2, 4);
  ctx.fillStyle = C_DIRT;
  ctx.fillRect(0, H - 54, W, 54);

  // Decorations — NES blocky hills
  ctx.fillStyle = NES_DKGREEN;
  drawHill(ctx, 150, H - 64, 200, 80);
  drawHill(ctx, 550, H - 64, 160, 70);
  ctx.fillStyle = NES_GREEN;
  drawHill(ctx, 350, H - 64, 120, 50);
  drawHill(ctx, 700, H - 64, 100, 40);

  // Slowly panning clouds (right -> left loop)
  const cloudSpeed = 0.35;
  const cloudLoopW = W + 320;
  const cloudShift = (S.tick * cloudSpeed) % cloudLoopW;
  const cloudBases = [80, 350, 600, 750, 980, 1180];
  const cloudYs = [70, 45, 80, 55, 38, 68];
  ctx.fillStyle = NES_WHITE;
  for (let i = 0; i < cloudBases.length; i++) {
    let x = cloudBases[i] - cloudShift;
    while (x < -120) x += cloudLoopW;
    drawCloud(ctx, x, cloudYs[i]);
  }

  // Pipe decoration
  ctx.fillStyle = C_PIPE;
  ctx.fillRect(80, H - 104, T, 40);
  ctx.fillStyle = C_PIPE_L;
  ctx.fillRect(80, H - 104, 4, 40);
  ctx.fillStyle = C_PIPE_D;
  ctx.fillRect(108, H - 104, 4, 40);
  ctx.fillStyle = C_PIPE;
  ctx.fillRect(76, H - 108, T + 8, T);
  ctx.fillStyle = NES_DKGREEN;
  ctx.fillRect(76, H - 108, T + 8, 4);

  // Question block (NES gold)
  const qx = 300, qy = H - 180;
  ctx.fillStyle = NES_GOLD;
  ctx.fillRect(qx, qy, T, T);
  ctx.fillStyle = NES_BROWN;
  ctx.fillRect(qx, qy, T, 2); ctx.fillRect(qx, qy, 2, T);
  ctx.fillRect(qx, qy + T - 2, T, 2); ctx.fillRect(qx + T - 2, qy, 2, T);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  drawTitleText(ctx, '?', qx + T / 2, qy + T / 2, {
    color: NES_WHITE,
    shadow: NES_BLACK,
    font: `bold 20px ${FONT_8}`,
    align: 'center',
  });

  // Hero mascot: custom sprite → BunBun sheet → blocky fallback
  if (!drawTitleHero(ctx, W / 2, H - 64, S.tick)) drawTitleBunny(ctx, W / 2 - 30, H - 112, S.tick);

  // Title text — high contrast pixel typography
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if (S.customTitle) {
    drawTitleText(ctx, S.customTitle.toUpperCase(), W / 2, 140, {
      color: NES_GOLD,
      shadow: '#001838',
      font: `${fitFontSize(ctx, S.customTitle.toUpperCase(), 36, W - 60)}px ${FONT_8}`,
      align: 'center',
    });
  } else {
    drawTitleText(ctx, "BUNBUN'S", W / 2, 106, {
      color: NES_RED,
      shadow: '#001838',
      font: `30px ${FONT_8}`,
      align: 'center',
    });
    drawTitleText(ctx, "CARROT RUN", W / 2, 158, {
      color: NES_GOLD,
      shadow: '#001838',
      font: `36px ${FONT_8}`,
      align: 'center',
    });
  }

  // Single CTA only (pulsing)
  const ctaPulse = 0.75 + 0.25 * ((Math.sin(S.tick * 0.08) + 1) / 2);
  ctx.globalAlpha = ctaPulse;
  drawTitleText(ctx, 'PRESS SPACE TO START', W / 2, 308, {
    color: NES_WHITE,
    shadow: '#001838',
    font: `16px ${FONT_8}`,
    align: 'center',
  });
  ctx.globalAlpha = 1;

  ctx.textAlign = 'left';
}

// Largest font size (px) at which `text` fits in maxW
function fitFontSize(ctx, text, maxSize, maxW) {
  let size = maxSize;
  ctx.save();
  while (size > 12) {
    ctx.font = `${size}px ${FONT_8}`;
    if (ctx.measureText(text).width <= maxW) break;
    size -= 2;
  }
  ctx.restore();
  return size;
}

// Draw the hero standing on the title-screen ground. Returns false if no sprite is ready.
function drawTitleHero(ctx, cx, groundY, tick) {
  const drawH = 96;
  const bob = Math.floor(tick / 22) % 2 === 0 ? 0 : -2;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const custom = S.customSprites.player;
  const frames = custom && (custom.idle || custom.frames || custom);
  if (frames && frames.length) {
    const img = frames[Math.floor(tick / 14) % frames.length];
    if (img && img.complete && img.naturalWidth > 0) {
      const w = img.naturalWidth * drawH / img.naturalHeight;
      ctx.drawImage(img, cx - w / 2, groundY - drawH + bob, w, drawH);
      ctx.restore();
      return true;
    }
  }
  const sheet = getBunbunSpriteSheet();
  const r = isSpriteReady(sheet) && getBunbunFrameRect(0, 0);
  if (r) {
    const w = r.w * drawH / r.h;
    ctx.drawImage(sheet, r.x, r.y, r.w, r.h, cx - w / 2, groundY - drawH + bob, w, drawH);
    ctx.restore();
    return true;
  }
  ctx.restore();
  return false;
}

function drawTitleBunny(ctx, bx, by, tick = 0) {
  ctx.save();
  // 2-frame idle bounce / breathing illusion
  const idleFrame = Math.floor(tick / 22) % 2;
  const bob = idleFrame === 0 ? 0 : -2;
  const earAdjust = idleFrame === 0 ? 0 : 1;
  bx = bx;
  by = by + bob;

  // Ears (blocky NES rectangles)
  ctx.fillStyle = NES_WHITE;
  ctx.fillRect(bx + 6, by - 28 + earAdjust, 10, 28 - earAdjust);
  ctx.fillRect(bx + 34, by - 28 + earAdjust, 10, 28 - earAdjust);
  ctx.fillStyle = NES_ORANGE;
  ctx.fillRect(bx + 9, by - 24 + earAdjust, 4, 20 - earAdjust);
  ctx.fillRect(bx + 37, by - 24 + earAdjust, 4, 20 - earAdjust);
  // Head (blocky)
  ctx.fillStyle = NES_WHITE;
  ctx.fillRect(bx + 3, by, 44, 28);
  // Eyes
  ctx.fillStyle = NES_BLACK;
  ctx.fillRect(bx + 30, by + 6, 6, 8);
  ctx.fillRect(bx + 14, by + 6, 5, 7);
  ctx.fillStyle = NES_WHITE;
  ctx.fillRect(bx + 32, by + 7, 3, 3);
  ctx.fillRect(bx + 15, by + 7, 2, 2);
  // Nose
  ctx.fillStyle = NES_RED;
  ctx.fillRect(bx + 39, by + 14, 5, 4);
  // Shirt (NES Mario red)
  ctx.fillStyle = NES_RED;
  ctx.fillRect(bx + 4, by + 30, 42, 16);
  // Overalls (NES blue)
  ctx.fillStyle = '#6888FC';
  ctx.fillRect(bx + 4, by + 46, 42, 16);
  ctx.fillStyle = NES_GOLD;
  ctx.fillRect(bx + 10, by + 46, 4, 4);
  ctx.fillRect(bx + 36, by + 46, 4, 4);
  // Feet (NES brown)
  ctx.fillStyle = NES_BROWN;
  ctx.fillRect(bx + 6, by + 58, 14, 6);
  ctx.fillRect(bx + 30, by + 58, 14, 6);
  // Leek (blocky)
  ctx.fillStyle = NES_LTGREEN;
  ctx.fillRect(bx + 46, by + 34, 24, 4);
  ctx.fillStyle = NES_DKGREEN;
  ctx.fillRect(bx + 66, by + 30, 8, 12);
  ctx.fillStyle = NES_WHITE;
  ctx.fillRect(bx + 72, by + 30, 12, 12);
  ctx.restore();
}

// =========================
//      Game Over
// =========================

export function drawGameOver() {
  const { ctx } = S;

  ctx.fillStyle = NES_BLACK;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';

  ctx.fillStyle = NES_RED;
  ctx.font = `28px ${FONT_8}`;
  ctx.fillText('GAME OVER', W / 2, H / 2 - 50);

  ctx.fillStyle = NES_WHITE;
  ctx.font = `14px ${FONT_8}`;
  ctx.fillText('SCORE ' + String(S.score).padStart(6, '0'), W / 2, H / 2 + 10);
  ctx.fillText('CARROTS ' + S.coinCount, W / 2, H / 2 + 40);

  if (Math.floor(S.tick / 28) % 2 === 0) {
    ctx.fillStyle = NES_GOLD;
    ctx.font = `12px ${FONT_8}`;
    ctx.fillText('PRESS ENTER TO RETRY', W / 2, H / 2 + 100);
  }
  ctx.textAlign = 'left';
}

// =========================
//      Win Overlay
// =========================

export function drawWinOverlay() {
  const { ctx } = S;

  if (S.winTimer > 70) {
    ctx.fillStyle = NES_BLACK;
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.fillStyle = NES_GOLD;
    ctx.font = `28px ${FONT_8}`;

    if (S.level < 3) {
      ctx.fillText(`WORLD ${S.level}-1 CLEAR!`, W / 2, H / 2 - 60);
    } else {
      ctx.fillText('CONGRATULATIONS!', W / 2, H / 2 - 80);
      ctx.fillStyle = NES_WHITE;
      ctx.font = `22px ${FONT_8}`;
      ctx.fillText('LEVEL 3 COMPLETE!', W / 2, H / 2 - 40);
    }

    ctx.fillStyle = NES_WHITE;
    ctx.font = `14px ${FONT_8}`;
    ctx.fillText('SCORE ' + String(S.score).padStart(6, '0'), W / 2, H / 2 + 10);
    ctx.fillText('CARROTS ' + S.coinCount, W / 2, H / 2 + 45);

    if (S.winTimer > 130) {
      if (S.level < 3) {
        const showCursor = Math.floor(S.tick / 18) % 2 === 0;
        const hubSelected = S.winChoice !== 'next';

        ctx.font = `10px ${FONT_8}`;
        ctx.fillStyle = NES_WHITE;
        ctx.fillText('CHOOSE NEXT STEP', W / 2, H / 2 + 82);

        ctx.font = `12px ${FONT_8}`;

        ctx.fillStyle = hubSelected ? NES_GOLD : NES_WHITE;
        ctx.fillText(`${hubSelected && showCursor ? '▶ ' : '  '}RETURN TO HUB`, W / 2, H / 2 + 106);

        ctx.fillStyle = !hubSelected ? NES_GOLD : NES_WHITE;
        ctx.fillText(`${!hubSelected && showCursor ? '▶ ' : '  '}PROCEED TO LEVEL ${S.level + 1}`, W / 2, H / 2 + 128);

        ctx.font = `8px ${FONT_8}`;
        ctx.fillStyle = NES_WHITE;
        ctx.fillText('ARROWS TO CHOOSE • ENTER TO CONFIRM', W / 2, H / 2 + 148);
      } else if (Math.floor(S.tick / 28) % 2 === 0) {
        ctx.fillStyle = NES_GOLD;
        ctx.font = `12px ${FONT_8}`;
        ctx.fillText('PRESS ENTER TO RETURN TO HUB', W / 2, H / 2 + 100);
      }
    }
    ctx.textAlign = 'left';
  }
}
