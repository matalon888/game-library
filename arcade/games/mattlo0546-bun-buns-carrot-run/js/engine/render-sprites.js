/**
 * Sprite rendering: bunny player, fox enemies, items, leek projectiles, particles.
 * Uses authentic NES color palette and blocky pixel-art style.
 */
import S from './state.js';
import { T } from './constants.js';
import { getBunbunSpriteSheet, getBunbunRow, getBunbunFrameRect, getBunbunFrameSize, isSpriteReady, BUNBUN_COLS,
         getPYSpriteSheet, getPYFrameRect, getPYFrameSize } from './sprites.js';
import { C_BRICK, C_BRICK_D,
         NES_RED, NES_BROWN, NES_BLUE, NES_WHITE, NES_BLACK,
         NES_SKIN, NES_GOLD, NES_ORANGE, NES_DKGREEN, NES_GREEN, NES_LTGREEN,
         NES_TEAL, NES_PINK
       } from './constants.js';

// =========================
//     Bunny (Player)
// =========================

function drawBunnySprite(px, py, p) {
  const rowInfo = getBunbunRow(p);
  const usePY = rowInfo.sheet === 'py';

  const sheet = usePY ? getPYSpriteSheet() : getBunbunSpriteSheet();
  if (!isSpriteReady(sheet)) return false;

  const { ctx } = S;
  const size = usePY ? getPYFrameSize() : getBunbunFrameSize();
  const frameW = size.w;
  const frameH = size.h;
  const dstW = p.spriteWidth || 24;
  const dstH = p.spriteHeight || 32;
  const frame = Math.min(p.currentFrame || 0, BUNBUN_COLS - 1);
  const row = rowInfo.row;
  const rect = usePY ? getPYFrameRect(row, frame) : getBunbunFrameRect(row, frame);
  const sx = rect ? rect.x : frame * frameW;
  const sy = rect ? rect.y : row * frameH;
  const sw = rect ? rect.w : frameW;
  const sh = rect ? rect.h : frameH;
  const skinScale = p.hasKumamon ? 1.2 : 1;
  const scale = Math.min(dstW / sw, dstH / sh) * skinScale;
  const drawW = Math.max(1, Math.floor(sw * scale));
  const drawH = Math.max(1, Math.floor(sh * scale));
  const dx = Math.floor((dstW - drawW) / 2);
  const dy = Math.floor(dstH - drawH);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(px, py);
  if (p.facing < 0) {
    ctx.scale(-1, 1);
    ctx.translate(-dstW, 0);
  }
  ctx.drawImage(
    sheet,
    sx, sy, sw, sh,
    dx, dy, drawW, drawH
  );
  ctx.restore();
  return true;
}

function drawBunnyFallback(px, py, p) {
  const { ctx } = S;
  const w = p.spriteWidth || 24;
  const h = p.spriteHeight || 32;

  ctx.save();
  ctx.translate(px, py);
  if (p.facing < 0) {
    ctx.scale(-1, 1);
    ctx.translate(-w, 0);
  }

  ctx.fillStyle = NES_WHITE;
  ctx.fillRect(2, 2, w - 4, h - 6);
  ctx.fillStyle = NES_BLACK;
  ctx.fillRect(w - 8, 10, 3, 4);
  ctx.fillRect(6, 10, 3, 4);
  ctx.fillStyle = NES_RED;
  ctx.fillRect(4, h - 10, w - 8, 6);
  ctx.restore();
}

export function drawBunny(px, py) {
  const { ctx } = S;
  const p = S.player;
  if (S.invTimer > 0 && Math.floor(S.invTimer / 3) % 2 === 0) return;

  // Custom Image Override (frame-animated)
  if (S.customSprites.player) {
    const powered = !!(p.hasLeek || p.hasKumamon || p.hasMiku || p.hasYoshi || p.hasChiikawa);
    const custom = powered && S.customSprites.playerPowered ? S.customSprites.playerPowered : S.customSprites.player;
    const raw = custom.frames || custom;

    // Schema v3: { idle, walk, jump } arrays — pick by player state.
    // Schema v1 fallback: flat array where [0]=idle, [1+]=walk cycle.
    let img;
    let moving;
    if (raw && !Array.isArray(raw) && (raw.idle || raw.walk || raw.jump)) {
      const airborne = !p.grounded;
      moving = Math.abs(p.vx) > 0.4 && p.grounded;
      let arr = airborne ? raw.jump : (moving ? raw.walk : raw.idle);
      if (!arr || arr.length === 0) arr = raw.idle || raw.walk || raw.jump || [];
      // idle = slow breathing, walk = brisk, jump = held on apex frame
      let frameIdx;
      if (airborne && arr.length > 0) {
        // Use vy to pick frame in jump arc: rising→early, apex→middle, falling→late
        const vy = p.vy || 0;
        const t = Math.max(0, Math.min(1, (vy + 8) / 16));
        frameIdx = Math.min(arr.length - 1, Math.floor(t * arr.length));
      } else {
        const tickRate = moving ? 6 : 14;
        frameIdx = arr.length > 0 ? Math.floor(S.tick / tickRate) % arr.length : 0;
      }
      img = arr[frameIdx];
    } else {
      const frames = raw;
      moving = Math.abs(p.vx) > 0.4 && p.grounded;
      const frameIdx = moving
        ? 1 + (Math.floor(S.tick / 8) % Math.max(1, frames.length - 1))
        : 0;
      img = frames[Math.min(frameIdx, frames.length - 1)];
    }

    if (img && img.complete && img.naturalWidth > 0) {
      const w = p.spriteWidth || p.w;
      const h = p.spriteHeight || p.h;

      // Keep custom sprites stable (no squash/stretch) to avoid jitter/squish.
      const sx = 1;
      const sy = 1;

      const bob = moving ? Math.sin(S.tick * 0.28) * 2.5 : 0;

      ctx.save();
      ctx.imageSmoothingEnabled = false;
      
      if (custom.anchor) {
        // Schema v2: Use anchor
        const playerHeight = p.h;
        const scale = playerHeight / custom.dimensions.canvasH;
        
        const drawW = custom.dimensions.canvasW * scale;
        const drawH = custom.dimensions.canvasH * scale;
        const offsetX = custom.anchor.x * drawW;
        const offsetY = custom.anchor.y * drawH;

        ctx.translate(px + p.w / 2, py + p.h + bob);
        if (p.facing < 0) ctx.scale(-1, 1);
        ctx.scale(sx, sy);
        ctx.drawImage(img, -offsetX, -offsetY, drawW, drawH);
      } else {
        // Schema v1: Scaling to fit hitbox (preserving aspect ratio)
        const imgW = img.naturalWidth || img.width;
        const imgH = img.naturalHeight || img.height;
        const scale = Math.min(w / imgW, h / imgH);
        const drawW = imgW * scale;
        const drawH = imgH * scale;

        ctx.translate(px + w / 2, py + h + bob);
        if (p.facing < 0) ctx.scale(-1, 1);
        ctx.scale(sx, sy);
        // Draw centered horizontally, bottom-aligned, rounded for pixel perfection
        ctx.drawImage(img, Math.round(-drawW / 2), Math.round(-drawH), Math.round(drawW), Math.round(drawH));
      }
      ctx.restore();
      return;
    }
  }

  // Star power rainbow flash
  const hasStar = S.starTimer > 0;
  if (hasStar) {
    const starFlash = Math.floor(S.tick / 2) % 2 === 0;
    if (S.starTimer < 90 && Math.floor(S.tick / 4) % 2 === 0) {
      // Blinking warning when star almost over
    } else {
      const STAR_COLORS = ['#FCE030', '#FC9838', '#F83800', '#F878F8', '#00E8D8', '#80D010'];
      const ci = Math.floor(S.tick * 0.4) % STAR_COLORS.length;
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = STAR_COLORS[ci];
      ctx.fillRect(px - 4, py - 4, (p.spriteWidth || p.w) + 8, (p.spriteHeight || p.h) + 8);
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  // When using sprite sheets, Yoshi is part of the Bun Bun sprite row
  if (!drawBunnySprite(px, py, p)) {
    drawBunnyFallback(px, py, p);
  }

  if (p.hasChiikawa && p.chiiRollTimer > 0) {
    const w = p.spriteWidth || p.w;
    const h = p.spriteHeight || p.h;
    const cx = px + Math.floor(w / 2);
    const cy = py + Math.floor(h * 0.72);
    const r = Math.max(8, Math.floor(Math.min(w, h) * 0.28));
    const spin = Math.floor(S.tick / 2) % 4;
    ctx.save();
    ctx.fillStyle = '#F8F8F8';
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = NES_PINK;
    ctx.fillRect(cx - r + 2, cy - r + 2, r - 2, r - 2);
    ctx.fillRect(cx + 1, cy - r + 2, r - 3, r - 2);
    ctx.fillStyle = NES_BLACK;
    if (spin === 0 || spin === 2) {
      ctx.fillRect(cx - r + 3, cy - 1, r * 2 - 6, 2);
    } else {
      ctx.fillRect(cx - 1, cy - r + 3, 2, r * 2 - 6);
    }
    ctx.restore();
  }

  // Ground pound speed lines
  if (p.groundPounding) {
    const w = p.spriteWidth || p.w;
    const h = p.spriteHeight || p.h;
    const lineTick = Math.floor(S.tick / 2) % 2;
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 4; i++) {
      const xL = px - 8 - i * 4;
      const xR = px + w + 6 + i * 4;
      const y = py + 6 + ((i + lineTick) % 2) * 3;
      const len = Math.max(8, h - 8 + i * 3);
      ctx.fillRect(xL, y, 2, len);
      ctx.fillRect(xR, y, 2, len);
    }
    ctx.fillStyle = 'rgba(252,184,56,0.75)';
    ctx.fillRect(px + Math.floor(w / 2) - 1, py + 4, 2, Math.max(10, h - 4));
  }

  // Yoshi tongue/eat/spit overlay trickery (no dedicated sprite frames needed)
  if (p.hasYoshi) {
    const w = p.spriteWidth || p.w;
    const h = p.spriteHeight || p.h;
    const facing = p.facing < 0 ? -1 : 1;
    const mouthX = px + (facing > 0 ? Math.floor(w * 0.74) : Math.floor(w * 0.26));
    const mouthY = py + Math.floor(h * 0.56);

    if (p.yoshiTongueTimer > 0) {
      const t = p.yoshiTongueTimer;
      const ext = 10 + Math.floor((10 - t) * 3.1);
      const dir = facing > 0 ? 1 : -1;

      ctx.fillStyle = NES_PINK;
      if (dir > 0) {
        ctx.fillRect(mouthX, mouthY - 2, ext, 4);
        ctx.fillRect(mouthX + ext - 3, mouthY - 3, 4, 6);
      } else {
        ctx.fillRect(mouthX - ext, mouthY - 2, ext, 4);
        ctx.fillRect(mouthX - ext - 1, mouthY - 3, 4, 6);
      }
      ctx.fillStyle = '#FC6868';
      if (dir > 0) ctx.fillRect(mouthX + ext - 2, mouthY - 1, 2, 2);
      else ctx.fillRect(mouthX - ext, mouthY - 1, 2, 2);
    }

    if (p.yoshiEatTimer > 0) {
      const pulse = (p.yoshiEatTimer % 2 === 0) ? 1 : 0;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(mouthX - 3 - pulse, mouthY - 4 - pulse, 8 + pulse * 2, 8 + pulse * 2);
    }

    if (p.yoshiSpitTimer > 0) {
      const flare = (p.yoshiSpitTimer % 2 === 0) ? 1 : 0;
      ctx.fillStyle = NES_GOLD;
      if (facing > 0) ctx.fillRect(mouthX + 1, mouthY - 5, 10 + flare * 4, 10);
      else ctx.fillRect(mouthX - 11 - flare * 4, mouthY - 5, 10 + flare * 4, 10);
      ctx.fillStyle = NES_ORANGE;
      if (facing > 0) ctx.fillRect(mouthX + 4, mouthY - 3, 8 + flare * 2, 6);
      else ctx.fillRect(mouthX - 12 - flare * 2, mouthY - 3, 8 + flare * 2, 6);
    }
  }
}

function drawKumamonSkin(ctx, p) {
  const w = p.w;
  const headH = p.big ? 22 : 16;
  const bodyH = p.big ? 14 : 9;
  const legH = p.big ? 14 : 8;
  const shirtY = headH;
  const overY = shirtY + bodyH;
  const footY = overY + legH;

  // Shadow
  ctx.fillStyle = '#3C3C3C';
  ctx.fillRect(1, p.h - 2, w - 2, 2);

  // === EARS (round, on top of head) ===
  ctx.fillStyle = NES_BLACK;
  ctx.fillRect(-1, -5, 10, 10);
  ctx.fillRect(w - 9, -5, 10, 10);
  // Inner ear
  ctx.fillStyle = '#3C3C3C';
  ctx.fillRect(1, -3, 6, 6);
  ctx.fillRect(w - 7, -3, 6, 6);

  // === HEAD (large blocky black face) ===
  ctx.fillStyle = NES_BLACK;
  ctx.fillRect(-2, 1, w + 4, headH + 2);

  // === EYES (large white ovals — blocky NES Kumamon) ===
  ctx.fillStyle = NES_WHITE;
  ctx.fillRect(w / 2 - 9, headH / 2 - 7, 8, 10);
  ctx.fillRect(w / 2 + 1, headH / 2 - 7, 8, 10);
  // Pupils
  ctx.fillStyle = '#181818';
  ctx.fillRect(w / 2 - 6, headH / 2 - 3, 4, 4);
  ctx.fillRect(w / 2 + 2, headH / 2 - 3, 4, 4);
  // Shine
  ctx.fillStyle = NES_WHITE;
  ctx.fillRect(w / 2 - 8, headH / 2 - 6, 2, 2);
  ctx.fillRect(w / 2 + 2, headH / 2 - 6, 2, 2);

  // === RED CHEEKS (blocky NES) ===
  ctx.fillStyle = NES_RED;
  ctx.fillRect(w / 2 - 12, headH / 2 + 1, 6, 5);
  ctx.fillRect(w / 2 + 6, headH / 2 + 1, 6, 5);

  // === WHITE MUZZLE (blocky) ===
  ctx.fillStyle = '#E8E8E8';
  ctx.fillRect(w / 2 - 4, headH / 2 + 3, 8, 6);

  // === NOSE ===
  ctx.fillStyle = '#181818';
  ctx.fillRect(w / 2 - 2, headH / 2 + 2, 4, 2);

  // === MOUTH ===
  ctx.fillStyle = '#3C3C3C';
  ctx.fillRect(w / 2 - 2, headH / 2 + 6, 4, 1);

  // === RED SHIRT (NES) ===
  ctx.fillStyle = NES_RED;
  ctx.fillRect(0, shirtY, w, bodyH);
  ctx.fillStyle = '#FC6868';
  ctx.fillRect(2, shirtY, w - 4, 3);

  // === POCKY BACKPACK (behind character) ===
  ctx.fillStyle = '#5A3A1A';
  ctx.fillRect(-8, shirtY - 2, 12, bodyH + 6);
  ctx.fillStyle = '#7D4B20';
  ctx.fillRect(-6, shirtY, 8, bodyH + 2);
  // Pocky sticks poking out of backpack
  ctx.fillStyle = '#F3C89A';
  ctx.fillRect(-5, shirtY - 8, 2, 8);
  ctx.fillRect(-2, shirtY - 10, 2, 10);
  ctx.fillRect(1, shirtY - 7, 2, 7);
  // Chocolate tips on pocky sticks
  ctx.fillStyle = '#7D2B14';
  ctx.fillRect(-5, shirtY - 8, 2, 3);
  ctx.fillRect(-2, shirtY - 10, 2, 3);
  ctx.fillRect(1, shirtY - 7, 2, 3);

  // === ROCKET LAUNCHER (extends to front) ===
  ctx.fillStyle = '#4A4A4A';
  ctx.fillRect(-2, shirtY, w + 14, 6);
  ctx.fillStyle = '#6A6A6A';
  ctx.fillRect(0, shirtY + 1, w + 10, 3);
  // Launcher muzzle (wider barrel end)
  ctx.fillStyle = '#3A3A3A';
  ctx.fillRect(w + 8, shirtY - 2, 8, 10);
  ctx.fillStyle = '#5A5A5A';
  ctx.fillRect(w + 10, shirtY, 4, 6);
  // Grip under launcher
  ctx.fillStyle = '#4A4A4A';
  ctx.fillRect(w / 2, shirtY + 6, 4, 5);

  // Muzzle flash when firing
  if (p.attackTimer > 8) {
    ctx.fillStyle = NES_ORANGE;
    ctx.fillRect(w + 14, shirtY - 5, 14, 16);
    ctx.fillStyle = NES_GOLD;
    ctx.fillRect(w + 16, shirtY - 3, 10, 12);
    ctx.fillStyle = NES_WHITE;
    ctx.fillRect(w + 18, shirtY - 1, 6, 8);
  }

  // === BLUE OVERALLS (NES) ===
  ctx.fillStyle = NES_BLUE;
  ctx.fillRect(0, overY, w, legH);
  ctx.fillRect(3, overY - 4, 5, 5);
  ctx.fillRect(w - 8, overY - 4, 5, 5);
  ctx.fillStyle = NES_GOLD;
  ctx.fillRect(4, overY, 3, 3);
  ctx.fillRect(w - 7, overY, 3, 3);
  ctx.fillStyle = '#4868A8';
  ctx.fillRect(6, overY + 4, w - 12, legH - 6);

  // === FEET (NES Brown) ===
  ctx.fillStyle = NES_BROWN;
  if (p.grounded && Math.abs(p.vx) > 0.5) {
    const step = Math.sin(p.animTimer * 0.35) * 4;
    ctx.fillRect(1 + step, footY - 5, 10, 5);
    ctx.fillRect(w - 11 - step, footY - 5, 10, 5);
  } else {
    ctx.fillRect(2, footY - 5, 9, 5);
    ctx.fillRect(w - 11, footY - 5, 9, 5);
  }
}

// =========================
//   Hatsune Miku Skin
// =========================

function drawMikuSkin(ctx, p) {
  const w = p.w;
  const headH = p.big ? 20 : 15;
  const bodyH = p.big ? 14 : 9;
  const legH = p.big ? 14 : 8;
  const shirtY = headH;
  const overY = shirtY + bodyH;
  const footY = overY + legH;

  // Shadow
  ctx.fillStyle = '#3C3C3C';
  ctx.fillRect(1, p.h - 2, w - 2, 2);

  // === TWIN-TAILS (long teal pigtails) ===
  ctx.fillStyle = NES_TEAL;
  ctx.fillRect(-2, -8, 6, 12);
  ctx.fillRect(-4, 4, 5, p.h - 4);
  ctx.fillRect(w - 4, -8, 6, 12);
  ctx.fillRect(w - 1, 4, 5, p.h - 4);
  // Pigtail tips
  ctx.fillStyle = '#00B8A8';
  ctx.fillRect(-4, p.h - 8, 5, 8);
  ctx.fillRect(w - 1, p.h - 8, 5, 8);

  // === HEAD (pale skin) ===
  ctx.fillStyle = NES_SKIN;
  ctx.fillRect(0, 0, w, headH);

  // === HAIR BANGS (teal) ===
  ctx.fillStyle = NES_TEAL;
  ctx.fillRect(0, -4, w, 6);
  ctx.fillRect(0, 0, w, 3);
  ctx.fillRect(0, 0, 4, headH / 2);
  ctx.fillRect(w - 4, 0, 4, headH / 2);

  // Hair accessories (red ribbons)
  ctx.fillStyle = NES_RED;
  ctx.fillRect(-1, -2, 4, 4);
  ctx.fillRect(w - 3, -2, 4, 4);

  // Eyes (big anime eyes - teal)
  const eyeY = Math.floor(headH / 2) - 2;
  ctx.fillStyle = NES_TEAL;
  ctx.fillRect(3, eyeY, 6, 6);
  ctx.fillRect(w - 9, eyeY, 6, 6);
  ctx.fillStyle = NES_BLACK;
  ctx.fillRect(5, eyeY + 1, 3, 4);
  ctx.fillRect(w - 7, eyeY + 1, 3, 4);
  ctx.fillStyle = NES_WHITE;
  ctx.fillRect(3, eyeY, 2, 2);
  ctx.fillRect(w - 9, eyeY, 2, 2);

  // Mouth
  ctx.fillStyle = NES_PINK;
  ctx.fillRect(w / 2 - 2, headH - 3, 4, 2);

  // === GREY SHIRT (Miku outfit) ===
  ctx.fillStyle = '#7C7C7C';
  ctx.fillRect(0, shirtY, w, bodyH);
  // Teal tie
  ctx.fillStyle = NES_TEAL;
  ctx.fillRect(w / 2 - 2, shirtY, 4, bodyH);
  ctx.fillRect(w / 2 - 3, shirtY, 6, 3);
  ctx.fillStyle = '#9C9C9C';
  ctx.fillRect(2, shirtY, w - 4, 2);

  // Singing effect when attacking
  if (p.attackTimer > 8) {
    ctx.fillStyle = NES_TEAL;
    ctx.fillRect(w + 2, shirtY - 4, 10, 10);
    ctx.fillStyle = NES_PINK;
    ctx.fillRect(w + 8, shirtY - 8, 6, 6);
    ctx.fillRect(w - 2, shirtY + 2, 6, 6);
  }

  // === HEADSET (blocky) ===
  ctx.fillStyle = '#7C7C7C';
  ctx.fillRect(-3, headH / 2 - 2, 3, 5);

  // === BLACK SKIRT ===
  ctx.fillStyle = '#2C2C2C';
  ctx.fillRect(0, overY, w, 4);

  // === BLACK THIGH-HIGHS + BOOTS ===
  ctx.fillStyle = '#2C2C2C';
  ctx.fillRect(0, overY + 4, w, legH - 4);
  ctx.fillStyle = NES_TEAL;
  ctx.fillRect(0, overY + 4, w, 2);

  // === FEET (teal-trimmed boots) ===
  ctx.fillStyle = '#2C2C2C';
  if (p.grounded && Math.abs(p.vx) > 0.5) {
    const step = Math.sin(p.animTimer * 0.35) * 4;
    ctx.fillRect(1 + step, footY - 5, 10, 5);
    ctx.fillRect(w - 11 - step, footY - 5, 10, 5);
  } else {
    ctx.fillRect(2, footY - 5, 9, 5);
    ctx.fillRect(w - 11, footY - 5, 9, 5);
  }
  ctx.fillStyle = NES_TEAL;
  ctx.fillRect(2, footY - 1, 9, 1);
  ctx.fillRect(w - 11, footY - 1, 9, 1);
}

// =========================
//   Yoshi Mount
// =========================

function drawYoshiMount(ctx, px, footY, p) {
  ctx.save();
  const cx = px + p.w / 2;
  ctx.translate(cx, footY);
  if (p.facing < 0) ctx.scale(-1, 1);
  ctx.translate(-p.w / 2, 0);

  const w = p.w;

  // Tail
  ctx.fillStyle = NES_GREEN;
  ctx.fillRect(-8, -10, 8, 5);
  ctx.fillStyle = NES_LTGREEN;
  ctx.fillRect(-6, -8, 4, 3);

  // Body (green)
  ctx.fillStyle = NES_GREEN;
  ctx.fillRect(-4, -16, w + 8, 16);
  // White belly
  ctx.fillStyle = NES_WHITE;
  ctx.fillRect(0, -12, w, 10);
  // Red saddle
  ctx.fillStyle = NES_RED;
  ctx.fillRect(2, -20, w - 4, 6);
  ctx.fillRect(4, -22, w - 8, 3);

  // Head (extends forward)
  ctx.fillStyle = NES_GREEN;
  ctx.fillRect(w - 2, -26, 16, 14);
  // Eye
  ctx.fillStyle = NES_WHITE;
  ctx.fillRect(w + 6, -25, 7, 8);
  ctx.fillStyle = NES_BLACK;
  ctx.fillRect(w + 8, -23, 4, 5);
  ctx.fillStyle = NES_WHITE;
  ctx.fillRect(w + 6, -25, 2, 2);
  // Snout
  ctx.fillStyle = NES_GREEN;
  ctx.fillRect(w + 10, -18, 10, 8);
  ctx.fillStyle = NES_DKGREEN;
  ctx.fillRect(w + 16, -16, 3, 2);

  // Puffed cheeks when holding enemy
  if (p.yoshiHeldEnemy) {
    ctx.fillStyle = NES_LTGREEN;
    ctx.fillRect(w + 8, -20, 14, 12);
    ctx.fillStyle = NES_RED;
    ctx.fillRect(w + 12, -16, 4, 4);
  }

  // Red crest
  ctx.fillStyle = NES_RED;
  ctx.fillRect(w + 2, -30, 4, 6);
  ctx.fillRect(w + 6, -28, 4, 4);
  ctx.fillRect(w + 10, -26, 4, 3);

  // Feet (orange)
  ctx.fillStyle = NES_ORANGE;
  const walk = p.grounded && Math.abs(p.vx) > 0.5 ? Math.sin(p.animTimer * 0.35) * 3 : 0;
  ctx.fillRect(-2 + walk, -2, 10, 4);
  ctx.fillRect(w - 8 - walk, -2, 10, 4);

  ctx.restore();
}

// =========================
//     Fox Enemy (NES palette)
// =========================

export function drawEnemy(e) {
  if (!e.alive) return;
  const { ctx } = S;
  const sx = e.x - S.cam.x;
  const sy = e.y;

  // Custom Image Override (frame-animated patrol)
  if (S.customSprites.enemy && !e.stomped) {
    const custom = S.customSprites.enemy;
    const frames = custom.frames || custom;
    // Walk frames [0]=idle [1]=walk-A [2]=walk-B cycle at patrol speed
    const frameIdx = 1 + (Math.floor(S.tick / 10) % (frames.length - 1));
    const img = frames[Math.min(frameIdx, frames.length - 1)];
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;

      if (custom.anchor) {
        const scale = 2;
        const drawW = custom.dimensions.canvasW * scale;
        const drawH = custom.dimensions.canvasH * scale;
        const offsetX = custom.anchor.x * drawW;
        const offsetY = custom.anchor.y * drawH;

        ctx.translate(sx + e.w / 2, sy + e.h);
        if (e.vx > 0) ctx.scale(-1, 1);
        ctx.drawImage(img, -offsetX, -offsetY, drawW, drawH);
      } else {
        ctx.translate(sx + e.w / 2, sy + e.h);
        if (e.vx > 0) ctx.scale(-1, 1);
        ctx.drawImage(img, -e.w, -e.h * 2, e.w * 2, e.h * 2);
      }
      ctx.restore();
      return;
    }
  }

  if (e.kind === 'koopa') {
    drawKoopa(ctx, sx, sy, e);
    return;
  }

  if (e.kind === 'drillmole') {
    drawDrillmole(ctx, sx, sy, e);
    return;
  }

  if (e.stomped) {
    ctx.fillStyle = NES_BROWN;
    ctx.fillRect(sx, sy + 2, e.w, e.h - 2);
    ctx.fillStyle = NES_BLACK;
    ctx.fillRect(sx + 4, sy + 3, 4, 2);
    ctx.fillRect(sx + e.w - 8, sy + 3, 4, 2);
    return;
  }

  // Body (blocky)
  ctx.fillStyle = NES_BROWN;
  ctx.fillRect(sx + 2, sy + 4, e.w - 4, e.h - 6);

  // Head
  ctx.fillStyle = NES_ORANGE;
  ctx.fillRect(sx + 2, sy - 2, e.w - 4, 16);

  // Ears (blocky triangles via rectangles)
  ctx.fillStyle = NES_BROWN;
  ctx.fillRect(sx + 2, sy - 8, 6, 6);
  ctx.fillRect(sx + e.w - 8, sy - 8, 6, 6);
  ctx.fillStyle = NES_ORANGE;
  ctx.fillRect(sx + 4, sy - 6, 2, 4);
  ctx.fillRect(sx + e.w - 6, sy - 6, 2, 4);

  // Eyes
  ctx.fillStyle = NES_WHITE;
  ctx.fillRect(sx + 4, sy + 2, 6, 6);
  ctx.fillRect(sx + e.w - 10, sy + 2, 6, 6);
  const pupilOff = Math.sin(e.frame) > 0 ? 1 : -1;
  ctx.fillStyle = NES_BLACK;
  ctx.fillRect(sx + 6 + pupilOff, sy + 3, 3, 4);
  ctx.fillRect(sx + e.w - 8 + pupilOff, sy + 3, 3, 4);

  // Angry eyebrows
  ctx.fillStyle = NES_BLACK;
  ctx.fillRect(sx + 3, sy, 6, 2);
  ctx.fillRect(sx + e.w - 9, sy, 6, 2);

  // Snout + Nose
  ctx.fillStyle = NES_SKIN;
  ctx.fillRect(sx + e.w / 2 - 4, sy + 8, 8, 6);
  ctx.fillStyle = NES_BLACK;
  ctx.fillRect(sx + e.w / 2 - 2, sy + 7, 4, 3);

  // Belly
  ctx.fillStyle = NES_SKIN;
  ctx.fillRect(sx + e.w / 2 - 5, sy + e.h / 2 + 1, 10, 12);

  // Feet
  ctx.fillStyle = '#6C4400';
  const walkAnim = Math.sin(e.frame * 4) * 3;
  ctx.fillRect(sx + 3 + walkAnim, sy + e.h - 5, 8, 5);
  ctx.fillRect(sx + e.w - 11 - walkAnim, sy + e.h - 5, 8, 5);

  // Tail (blocky)
  ctx.fillStyle = NES_WHITE;
  const tailX = e.vx > 0 ? sx - 4 : sx + e.w;
  ctx.fillRect(tailX, sy + 12, 6, 5);
}

function drawDrillmole(ctx, sx, sy, e) {
  const walk = Math.sin(e.frame * 4.2) > 0 ? 1 : 0;
  // Body
  ctx.fillStyle = '#8C5A2B';
  ctx.fillRect(sx + 2, sy + 6, e.w - 4, e.h - 6);
  // Belly
  ctx.fillStyle = '#C89560';
  ctx.fillRect(sx + 7, sy + 12, e.w - 14, e.h - 12);
  // Drill nose
  const dir = e.vx >= 0 ? 1 : -1;
  ctx.fillStyle = '#BCBCBC';
  if (dir > 0) {
    ctx.fillRect(sx + e.w - 2, sy + 11, 6, 6);
    ctx.fillRect(sx + e.w + 4, sy + 12, 3, 4);
  } else {
    ctx.fillRect(sx - 4, sy + 11, 6, 6);
    ctx.fillRect(sx - 7, sy + 12, 3, 4);
  }
  ctx.fillStyle = '#7C7C7C';
  if (dir > 0) ctx.fillRect(sx + e.w + 1, sy + 12, 2, 4);
  else ctx.fillRect(sx - 3, sy + 12, 2, 4);
  // Eyes
  ctx.fillStyle = NES_WHITE;
  ctx.fillRect(sx + 6, sy + 8, 4, 4);
  ctx.fillRect(sx + e.w - 10, sy + 8, 4, 4);
  ctx.fillStyle = NES_BLACK;
  ctx.fillRect(sx + 7, sy + 9, 2, 2);
  ctx.fillRect(sx + e.w - 9, sy + 9, 2, 2);
  // Claws
  ctx.fillStyle = '#D8A060';
  ctx.fillRect(sx + 3 + walk, sy + e.h - 4, 6, 4);
  ctx.fillRect(sx + e.w - 9 - walk, sy + e.h - 4, 6, 4);
}

function drawKoopa(ctx, sx, sy, e) {
  if (e.stomped) {
    // Shell only when stomped (blocky NES)
    ctx.fillStyle = NES_GREEN;
    ctx.fillRect(sx + 2, sy + e.h - 14, e.w - 4, 14);
    // Shell rim
    ctx.fillStyle = NES_GOLD;
    ctx.fillRect(sx + 3, sy + e.h - 4, e.w - 6, 4);
    // Shell pattern
    ctx.fillStyle = NES_DKGREEN;
    ctx.fillRect(sx + e.w / 2 - 4, sy + e.h - 12, 8, 6);
    ctx.fillRect(sx + 4, sy + e.h - 8, e.w - 8, 2);
    return;
  }

  const walk = Math.sin(e.frame * 3.8) * 2;
  const bodyMidX = sx + e.w / 2;
  const shellY = sy + 10;
  const headDir = e.vx > 0 ? 1 : -1;

  // === FEET (NES orange) ===
  ctx.fillStyle = NES_ORANGE;
  ctx.fillRect(sx + 2 + walk, sy + e.h - 6, 10, 6);
  ctx.fillRect(sx + e.w - 12 - walk, sy + e.h - 6, 10, 6);
  ctx.fillStyle = NES_BROWN;
  ctx.fillRect(sx + 2 + walk, sy + e.h - 2, 10, 2);
  ctx.fillRect(sx + e.w - 12 - walk, sy + e.h - 2, 10, 2);

  // === SHELL (NES green blocky) ===
  ctx.fillStyle = NES_GREEN;
  ctx.fillRect(bodyMidX - 13, shellY - 5, 26, 22);
  // Shell belly (cream)
  ctx.fillStyle = NES_GOLD;
  ctx.fillRect(bodyMidX - 11, shellY + 12, 22, 5);
  // Shell inner dome
  ctx.fillStyle = NES_LTGREEN;
  ctx.fillRect(bodyMidX - 8, shellY - 2, 16, 14);
  // Shell hexagonal pattern
  ctx.fillStyle = NES_DKGREEN;
  ctx.fillRect(bodyMidX - 4, shellY, 8, 6);
  ctx.fillRect(bodyMidX - 8, shellY + 4, 16, 2);
  ctx.fillRect(bodyMidX, shellY - 2, 2, 8);
  // Shell highlight
  ctx.fillStyle = '#58D858';
  ctx.fillRect(bodyMidX - 6, shellY - 2, 4, 3);

  // === HEAD (NES yellow, blocky) ===
  const headX = bodyMidX + headDir * 7;
  ctx.fillStyle = NES_GOLD;
  ctx.fillRect(headX - 7, sy - 2, 14, 16);
  // Eyes
  const eyeBase = headX + headDir * 2;
  ctx.fillStyle = NES_WHITE;
  ctx.fillRect(eyeBase - 5, sy, 6, 8);
  ctx.fillRect(eyeBase + 1, sy, 6, 8);
  // Pupils
  ctx.fillStyle = NES_BLACK;
  ctx.fillRect(eyeBase - 3 + headDir, sy + 2, 3, 5);
  ctx.fillRect(eyeBase + 2 + headDir, sy + 2, 3, 5);
  // Beak/mouth
  ctx.fillStyle = NES_ORANGE;
  ctx.fillRect(headX + headDir * 6, sy + 8, 7, 4);
  ctx.fillStyle = NES_BROWN;
  ctx.fillRect(headX + headDir * 6, sy + 10, 7, 1);
  // Eyebrow ridges
  ctx.fillStyle = NES_BLACK;
  ctx.fillRect(eyeBase - 5, sy - 2, 4, 2);
  ctx.fillRect(eyeBase + 2, sy - 2, 4, 2);
}

// =========================
//   Leek Projectile
// =========================

export function drawLeekProj(p) {
  const { ctx } = S;

  // Musical note projectile (Miku)
  if (p.type === 'note') {
    const sx = p.x - S.cam.x;
    const sy = p.y;
    const noteColor = Math.floor(S.tick / 4) % 2 === 0 ? NES_TEAL : NES_PINK;
    ctx.fillStyle = noteColor;
    // Note head
    ctx.fillRect(sx, sy + 4, 6, 5);
    ctx.fillRect(sx - 1, sy + 5, 8, 3);
    // Note stem
    ctx.fillRect(sx + 5, sy - 4, 2, 10);
    // Note flag
    ctx.fillRect(sx + 7, sy - 4, 4, 3);
    ctx.fillRect(sx + 9, sy - 2, 3, 3);
    // Sparkle trail
    ctx.fillStyle = NES_PINK;
    ctx.fillRect(sx - 6, sy + 2, 2, 2);
    ctx.fillRect(sx - 10, sy + 6, 2, 2);
    ctx.fillStyle = NES_TEAL;
    ctx.fillRect(sx - 8, sy, 2, 2);
    return;
  }

  // Spit projectile (spat-out enemy)
  if (p.type === 'spit') {
    const sx = p.x - S.cam.x;
    const sy = p.y;
    ctx.save();
    ctx.translate(sx + p.w / 2, sy + p.h / 2);
    ctx.rotate(p.rot);
    // Draw a spinning enemy ball
    ctx.fillStyle = NES_GREEN;
    ctx.fillRect(-10, -10, 20, 20);
    ctx.fillStyle = NES_WHITE;
    ctx.fillRect(-6, -8, 12, 6);
    ctx.fillStyle = NES_BLACK;
    ctx.fillRect(-4, -6, 4, 4);
    ctx.fillRect(2, -6, 4, 4);
    // Saliva trail
    ctx.restore();
    ctx.fillStyle = '#88E888';
    ctx.fillRect(sx - 3, sy + p.h / 2, 3, 3);
    ctx.fillRect(sx - 7, sy + p.h / 2 + 2, 2, 2);
    return;
  }

  ctx.save();
  const sx = p.x - S.cam.x + p.w / 2;
  const sy = p.y + p.h / 2;
  ctx.translate(sx, sy);
  ctx.rotate(p.rot);

  if (p.type === 'pocky') {
    if (p.muzzleTimer > 0) {
      const t = p.muzzleTimer;
      const pulse = (t % 2 === 0) ? 1 : 0;
      const len = 24 + pulse * 6;

      // Big launch flash cone
      ctx.fillStyle = NES_GOLD;
      ctx.fillRect(-3, -7, len, 14);
      ctx.fillStyle = NES_ORANGE;
      ctx.fillRect(2, -5, len - 7, 10);
      ctx.fillStyle = NES_RED;
      ctx.fillRect(7, -3, len - 14, 6);

      // Exhaust bloom near launcher mouth
      ctx.fillStyle = '#F4F4F4';
      ctx.fillRect(-10, -4, 8, 8);
      ctx.fillStyle = '#BCBCBC';
      ctx.fillRect(-14, -3, 5, 6);
      ctx.fillStyle = '#9C9C9C';
      ctx.fillRect(-17, -2, 3, 4);

      // Tiny pocky just emerging
      ctx.fillStyle = '#F3C89A';
      ctx.fillRect(-1, -1, 7, 2);
      ctx.fillStyle = '#7D2B14';
      ctx.fillRect(5, -1, 2, 2);

      ctx.restore();
      return;
    }

    // === SMALL POCKY SHOT ===
    // Biscuit body
    ctx.fillStyle = '#F3C89A';
    ctx.fillRect(-8, -2, 13, 4);
    // Top highlight
    ctx.fillStyle = '#F7D7B0';
    ctx.fillRect(-7, -2, 10, 1);
    // Chocolate-dipped tip
    ctx.fillStyle = '#7D2B14';
    ctx.fillRect(4, -2, 4, 4);
    // Tiny trailing crumbs/speed marks
    ctx.fillStyle = '#D2B48C';
    ctx.fillRect(-12, -1, 2, 1);
    ctx.fillRect(-15, 0, 2, 1);
    ctx.fillStyle = '#BCBCBC';
    ctx.fillRect(-18, 0, 1, 1);
    ctx.restore();
    return;
  }

  // === Y-SHAPED LEEK PROJECTILE ===
  // White stem/handle
  ctx.fillStyle = NES_WHITE;
  ctx.fillRect(-8, -2, 14, 4);
  ctx.fillStyle = '#BCBCBC';
  ctx.fillRect(-6, 1, 10, 1);
  // Fork junction
  ctx.fillStyle = NES_LTGREEN;
  ctx.fillRect(4, -2, 4, 4);
  // Upper branch of Y
  ctx.fillRect(6, -7, 3, 6);
  ctx.fillRect(8, -11, 3, 5);
  // Lower branch of Y
  ctx.fillRect(6, 2, 3, 6);
  ctx.fillRect(8, 7, 3, 5);
  // Leafy tips
  ctx.fillStyle = NES_GREEN;
  ctx.fillRect(9, -13, 5, 4);
  ctx.fillRect(9, 10, 5, 4);
  ctx.fillStyle = NES_DKGREEN;
  ctx.fillRect(10, -11, 3, 2);
  ctx.fillRect(10, 10, 3, 2);
  // Trail sparkle
  ctx.fillStyle = NES_LTGREEN;
  ctx.fillRect(-12, -1, 4, 2);

  ctx.restore();
}

// =========================
//       Items
// =========================

export function drawItems() {
  const { ctx } = S;

  for (let i = 0; i < S.items.length; i++) {
    const item = S.items[i];
    if (item.collected) continue;
    const sx = item.x - S.cam.x;
    const sy = item.y;

    // Custom Image Override (for powerups/leeks) — alternates glow frames
    if (S.customSprites.powerup && item.type === 'leek') {
      const custom = S.customSprites.powerup;
      const frames = custom.frames || custom;
      const frameIdx = Math.floor(S.tick / 18) % frames.length;
      const img = frames[frameIdx];
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        const bob = Math.sin(S.tick * 0.1) * 4;
        const pulse = 1 + Math.sin(S.tick * 0.08) * 0.06;
        const dir = item.vx < 0 ? -1 : 1;

        if (custom.anchor) {
          const targetW = item.w || custom.dimensions.canvasW;
          const targetH = item.h || custom.dimensions.canvasH;
          const scaleX = targetW / custom.dimensions.canvasW;
          const scaleY = targetH / custom.dimensions.canvasH;
          const drawW = custom.dimensions.canvasW * scaleX;
          const drawH = custom.dimensions.canvasH * scaleY;
          const offsetX = custom.anchor.x * drawW;
          const offsetY = custom.anchor.y * drawH;

          ctx.translate(sx + item.w / 2, sy + item.h / 2 + bob);
          if (dir < 0) ctx.scale(-1, 1);
          ctx.scale(pulse, pulse);
          ctx.drawImage(img, -offsetX, -offsetY, drawW, drawH);
        } else {
          const drawW = item.w || 24;
          const drawH = item.h || 24;
          ctx.translate(sx + item.w / 2, sy + item.h / 2 + bob);
          if (dir < 0) ctx.scale(-1, 1);
          ctx.scale(pulse, pulse);
          ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        }
        ctx.restore();
        continue;
      }
    }

    if (item.type === 'carrot') {
      const bob = Math.sin(item.anim) * 3;
      // Blocky NES carrot
      ctx.fillStyle = NES_ORANGE;
      ctx.fillRect(sx + 4, sy + bob, 8, 18);
      ctx.fillRect(sx + 6, sy + 18 + bob, 4, 2);
      // Carrot lines
      ctx.fillStyle = '#E05000';
      ctx.fillRect(sx + 5, sy + 6 + bob, 6, 1);
      ctx.fillRect(sx + 5, sy + 10 + bob, 6, 1);
      ctx.fillRect(sx + 5, sy + 14 + bob, 6, 1);
      // Greens
      ctx.fillStyle = NES_GREEN;
      ctx.fillRect(sx + 4, sy - 5 + bob, 3, 7);
      ctx.fillRect(sx + 8, sy - 7 + bob, 3, 9);
      ctx.fillRect(sx + 6, sy - 3 + bob, 3, 5);
      // Highlight
      ctx.fillStyle = NES_WHITE;
      ctx.fillRect(sx + 10, sy + 3 + bob, 2, 8);
    }

    if (item.type === 'leek') {
      // Y-shaped leek powerup item
      const cx = sx + 12;
      const cy = sy + 14;
      // White stem (vertical)
      ctx.fillStyle = NES_WHITE;
      ctx.fillRect(cx - 2, cy + 2, 4, 14);
      ctx.fillStyle = '#E8E8E8';
      ctx.fillRect(cx - 1, cy + 4, 2, 10);
      // Fork junction
      ctx.fillStyle = NES_LTGREEN;
      ctx.fillRect(cx - 3, cy - 1, 6, 5);
      // Upper-left branch
      ctx.fillRect(cx - 7, cy - 5, 4, 5);
      ctx.fillRect(cx - 10, cy - 9, 4, 5);
      // Upper-right branch
      ctx.fillRect(cx + 3, cy - 5, 4, 5);
      ctx.fillRect(cx + 6, cy - 9, 4, 5);
      // Leafy tips
      ctx.fillStyle = NES_GREEN;
      ctx.fillRect(cx - 12, cy - 12, 5, 5);
      ctx.fillRect(cx + 7, cy - 12, 5, 5);
      ctx.fillStyle = NES_DKGREEN;
      ctx.fillRect(cx - 11, cy - 10, 3, 2);
      ctx.fillRect(cx + 8, cy - 10, 3, 2);
    }

    if (item.type === 'kumamon') {
      const bounce = Math.sin(S.tick * 0.16) * 2;
      const cx = sx + 12;
      const cy = sy + 14 + bounce;

      // Backpack body (brown)
      ctx.fillStyle = '#5A3A1A';
      ctx.fillRect(cx - 10, cy - 4, 20, 16);
      ctx.fillStyle = '#7D4B20';
      ctx.fillRect(cx - 8, cy - 2, 16, 12);
      // Pocky sticks poking out top
      ctx.fillStyle = '#F3C89A';
      ctx.fillRect(cx - 6, cy - 12, 2, 10);
      ctx.fillRect(cx - 2, cy - 14, 2, 12);
      ctx.fillRect(cx + 2, cy - 11, 2, 9);
      ctx.fillRect(cx + 5, cy - 10, 2, 8);
      // Chocolate tips
      ctx.fillStyle = '#7D2B14';
      ctx.fillRect(cx - 6, cy - 12, 2, 3);
      ctx.fillRect(cx - 2, cy - 14, 2, 3);
      ctx.fillRect(cx + 2, cy - 11, 2, 3);
      ctx.fillRect(cx + 5, cy - 10, 2, 3);
      // Rocket launcher tube across
      ctx.fillStyle = '#4A4A4A';
      ctx.fillRect(cx - 12, cy + 4, 24, 5);
      ctx.fillStyle = '#6A6A6A';
      ctx.fillRect(cx - 10, cy + 5, 20, 3);
      // Muzzle end
      ctx.fillStyle = '#3A3A3A';
      ctx.fillRect(cx + 10, cy + 2, 5, 8);
      // Backpack strap
      ctx.fillStyle = '#4A3020';
      ctx.fillRect(cx - 4, cy - 2, 2, 14);
      ctx.fillRect(cx + 2, cy - 2, 2, 14);
    }

    if (item.type === 'miku') {
      const bounce = Math.sin(S.tick * 0.16) * 2;
      const cx = sx + 12;
      const cy = sy + 14 + bounce;
      // Teal microphone body
      ctx.fillStyle = NES_TEAL;
      ctx.fillRect(cx - 4, cy - 8, 8, 16);
      // Microphone head (grey)
      ctx.fillStyle = '#7C7C7C';
      ctx.fillRect(cx - 6, cy - 12, 12, 6);
      ctx.fillStyle = '#BCBCBC';
      ctx.fillRect(cx - 4, cy - 10, 8, 3);
      // Musical note sparkles
      ctx.fillStyle = NES_PINK;
      ctx.fillRect(cx + 8, cy - 14, 4, 4);
      ctx.fillRect(cx - 10, cy - 10, 3, 3);
      ctx.fillStyle = NES_TEAL;
      ctx.fillRect(cx + 6, cy - 6, 3, 3);
    }

    if (item.type === 'chiikawa') {
      const bounce = Math.sin(S.tick * 0.16) * 2;
      const cx = sx + 12;
      const cy = sy + 14 + bounce;
      ctx.fillStyle = '#F8F8F8';
      ctx.fillRect(cx - 10, cy - 10, 20, 20);
      ctx.fillStyle = '#FFD0D0';
      ctx.fillRect(cx - 9, cy - 9, 7, 7);
      ctx.fillRect(cx + 2, cy - 9, 7, 7);
      ctx.fillStyle = NES_BLACK;
      ctx.fillRect(cx - 4, cy - 1, 2, 2);
      ctx.fillRect(cx + 2, cy - 1, 2, 2);
      ctx.fillRect(cx - 1, cy + 3, 2, 2);
      // Roll hint arrows
      ctx.fillStyle = NES_GOLD;
      ctx.fillRect(cx - 14, cy + 5, 4, 2);
      ctx.fillRect(cx + 10, cy + 5, 4, 2);
    }

    if (item.type === 'yoshi') {
      const bounce = Math.sin(S.tick * 0.18) * 2;
      const cx = sx + 12;
      const cy = sy + 14 + bounce;
      // Egg shape (white with green spots)
      ctx.fillStyle = NES_WHITE;
      ctx.fillRect(cx - 8, cy - 10, 16, 20);
      ctx.fillRect(cx - 6, cy - 12, 12, 24);
      // Green spots
      ctx.fillStyle = NES_GREEN;
      ctx.fillRect(cx - 4, cy - 6, 6, 6);
      ctx.fillRect(cx + 2, cy + 2, 5, 5);
      ctx.fillRect(cx - 6, cy + 4, 4, 4);
      // Highlight
      ctx.fillStyle = '#E8E8E8';
      ctx.fillRect(cx - 4, cy - 10, 4, 4);
    }

    if (item.type === '1up') {
      const bounce = Math.sin(S.tick * 0.16) * 2;
      const cx = sx + 12;
      const cy = sy + 14 + bounce;
      // Bunny head (matches lives HUD icon)
      ctx.fillStyle = NES_WHITE;
      ctx.fillRect(cx - 8, cy - 6, 16, 14);
      // Ears
      ctx.fillRect(cx - 6, cy - 16, 4, 12);
      ctx.fillRect(cx + 2, cy - 16, 4, 12);
      // Inner ears (pink)
      ctx.fillStyle = NES_PINK;
      ctx.fillRect(cx - 5, cy - 14, 2, 8);
      ctx.fillRect(cx + 3, cy - 14, 2, 8);
      // Eyes
      ctx.fillStyle = NES_BLACK;
      ctx.fillRect(cx - 5, cy - 2, 3, 3);
      ctx.fillRect(cx + 2, cy - 2, 3, 3);
      // Nose
      ctx.fillStyle = NES_PINK;
      ctx.fillRect(cx - 1, cy + 2, 2, 2);
      // "1UP" text below
      ctx.fillStyle = NES_GREEN;
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('1UP', cx, cy + 18);
      ctx.textAlign = 'left';
    }

    if (item.type === 'star') {
      const bounce = Math.sin(S.tick * 0.2) * 3;
      const cx = sx + 12;
      const cy = sy + 10 + bounce;
      // Rainbow flashing star
      const colors = ['#FCE030', '#FC9838', '#F83800', '#F878F8', '#00E8D8', '#80D010'];
      const ci = Math.floor(S.tick * 0.3) % colors.length;
      ctx.fillStyle = colors[ci];
      // Star shape (blocky NES)
      ctx.fillRect(cx - 2, cy - 12, 4, 4);    // top point
      ctx.fillRect(cx - 8, cy - 6, 16, 4);     // top bar
      ctx.fillRect(cx - 10, cy - 2, 20, 6);    // middle wide
      ctx.fillRect(cx - 6, cy + 4, 12, 4);     // lower
      ctx.fillRect(cx - 8, cy + 8, 4, 4);      // bottom left
      ctx.fillRect(cx + 4, cy + 8, 4, 4);      // bottom right
      // Inner highlight
      ctx.fillStyle = NES_WHITE;
      ctx.fillRect(cx - 4, cy - 4, 3, 3);
      // Eyes
      ctx.fillStyle = NES_BLACK;
      ctx.fillRect(cx - 3, cy - 1, 2, 2);
      ctx.fillRect(cx + 1, cy - 1, 2, 2);
    }
  }
}

// =========================
//  Particles & Popups
// =========================

export function drawParticles() {
  const { ctx } = S;

  for (let i = 0; i < S.particles.length; i++) {
    const p = S.particles[i];
    const sx = p.x - S.cam.x;

    if (p.type === 'brick') {
      ctx.save();
      ctx.translate(sx + p.w / 2, p.y + p.h / 2);
      ctx.rotate(p.timer * 0.2 * (p.vx > 0 ? 1 : -1));
      ctx.fillStyle = C_BRICK;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.fillStyle = C_BRICK_D;
      ctx.fillRect(-p.w / 2, 0, p.w, 1);
      ctx.restore();
    } else if (p.type === 'coinpop') {
      const alpha = Math.min(1, p.timer / 15);
      ctx.globalAlpha = alpha;
      // Blocky NES carrot pop
      ctx.fillStyle = NES_ORANGE;
      ctx.fillRect(sx + 4, p.y, 8, 14);
      ctx.fillStyle = NES_GREEN;
      ctx.fillRect(sx + 3, p.y - 4, 3, 5);
      ctx.fillRect(sx + 7, p.y - 5, 3, 6);
      ctx.globalAlpha = 1;
    } else if (p.type === 'poof') {
      const alpha = p.timer / 20;
      const rad = (20 - p.timer) * 1.5;
      // Blocky poof (NES: no smooth circles)
      ctx.globalAlpha = Math.min(1, alpha * 0.8);
      ctx.fillStyle = NES_WHITE;
      ctx.fillRect(sx - rad / 2, p.y - rad / 2, rad, rad);
      ctx.globalAlpha = 1;
    } else if (p.type === 'firework') {
      const alpha = Math.min(1, p.timer / 15);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color || NES_GOLD;
      ctx.fillRect(sx - 2, p.y - 2, p.w, p.h);
      ctx.globalAlpha = 1;
    } else if (p.type === 'explosion') {
      const progress = 1 - p.timer / 22;
      const radius = 10 + progress * 50;
      const alpha = (1 - progress) * 0.7;
      // NES-style blocky explosion
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.fillStyle = NES_ORANGE;
      ctx.fillRect(sx - radius / 2, p.y - radius / 2, radius, radius);
      ctx.fillStyle = NES_GOLD;
      ctx.fillRect(sx - radius / 3, p.y - radius / 3, radius * 0.6, radius * 0.6);
      ctx.globalAlpha = 1;
    } else if (p.type === 'fire') {
      const alpha = Math.min(1, p.timer / 12);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color || NES_ORANGE;
      ctx.fillRect(sx - p.w / 2, p.y - p.w / 2, p.w, p.w);
      ctx.globalAlpha = 1;
    } else if (p.type === 'yoshi_flee') {
      const fleeAlpha = Math.min(1, p.timer / 20);
      ctx.globalAlpha = fleeAlpha;
      // Mini Yoshi running away
      ctx.fillStyle = NES_GREEN;
      ctx.fillRect(sx - 6, p.y - 8, 12, 12);
      ctx.fillStyle = NES_WHITE;
      ctx.fillRect(sx - 4, p.y - 6, 4, 4);
      ctx.fillStyle = NES_BLACK;
      ctx.fillRect(sx - 3, p.y - 5, 2, 3);
      ctx.fillStyle = NES_RED;
      ctx.fillRect(sx - 6, p.y - 12, 12, 4);
      ctx.fillStyle = NES_ORANGE;
      ctx.fillRect(sx - 4, p.y + 2, 4, 3);
      ctx.fillRect(sx + 2, p.y + 2, 4, 3);
      ctx.globalAlpha = 1;
    }
  }

  // Score popups (NES 8-bit font)
  for (let i = 0; i < S.popups.length; i++) {
    const pop = S.popups[i];
    const alpha = Math.min(1, pop.timer / 20);
    const prevAlign = ctx.textAlign;
    if (pop.centered) ctx.textAlign = 'center';
    ctx.globalAlpha = alpha;
    // BOOM! popups get bigger, colored text
    if (pop.color) {
      ctx.font = '18px "Press Start 2P", monospace';
      ctx.fillStyle = NES_BLACK;
      ctx.fillText(pop.text, pop.x - S.cam.x + 2, pop.y + 2);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x - S.cam.x, pop.y);
      ctx.fillStyle = NES_WHITE;
      ctx.fillText(pop.text, pop.x - S.cam.x, pop.y - 1);
      ctx.globalAlpha = Math.min(1, alpha * 0.6);
      ctx.fillText(pop.text, pop.x - S.cam.x, pop.y - 1);
    } else {
      ctx.font = '14px "Press Start 2P", monospace';
      ctx.fillStyle = NES_BLACK;
      ctx.fillText(pop.text, pop.x - S.cam.x + 1, pop.y + 1);
      ctx.fillStyle = NES_WHITE;
      ctx.fillText(pop.text, pop.x - S.cam.x, pop.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = prevAlign;
  }
}
