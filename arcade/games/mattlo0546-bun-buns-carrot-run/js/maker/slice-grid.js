/**
 * Spritesheet slicer for the AI-generated sheet.
 *
 * The model produces a 5×5 grid on a known chroma-key background. This module:
 *   1. Splits the sheet into 25 cells.
 *   2. Removes the chroma key, plus a fringe-cleanup pass for leftover
 *      key-tinted edge pixels.
 *   3. Returns one PNG data URL per frame, in row-major order.
 */
import { loadImage } from './key-color.js';

// How close (RGB dist²) a pixel can be to the key and still get knocked out.
// Loose enough to catch JPEG bleed, tight enough not to eat character pixels.
const KILL_DIST_SQ = 110 * 110;
// Edge-fringe pass: pixels within this distance get blended toward transparent.
const FRINGE_DIST_SQ = 160 * 160;

export async function sliceGridSpritesheet(dataUrl, rows = 5, cols = 5, key = { r: 255, g: 0, b: 255 }) {
  const img = await loadImage(dataUrl);
  const cellW = Math.floor(img.naturalWidth / cols);
  const cellH = Math.floor(img.naturalHeight / rows);
  if (cellW <= 0 || cellH <= 0) throw new Error(`Invalid spritesheet size: ${img.naturalWidth}×${img.naturalHeight}`);

  const cells = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      cells.push(extractCell(img, col * cellW, row * cellH, cellW, cellH, key));
    }
  }
  return cells;
}

function extractCell(img, sx, sy, sw, sh, key) {
  const work = document.createElement('canvas');
  work.width = sw;
  work.height = sh;
  const ctx = work.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  const imageData = ctx.getImageData(0, 0, sw, sh);
  keyOut(imageData, key);
  desaturateFringe(imageData, key);
  ctx.putImageData(imageData, 0, 0);
  return work.toDataURL('image/png');
}

/** First pass: zero-alpha any pixel close to the key color. */
function keyOut({ data }, key) {
  for (let i = 0; i < data.length; i += 4) {
    const dr = data[i] - key.r, dg = data[i + 1] - key.g, db = data[i + 2] - key.b;
    if (dr * dr + dg * dg + db * db < KILL_DIST_SQ) data[i + 3] = 0;
  }
}

/**
 * Second pass: visible pixels that are still close to the key AND touch a
 * keyed-out pixel get pulled away from the key color and faded, killing the
 * colored halo a hard cutoff leaves around anti-aliased edges.
 */
function desaturateFringe({ data, width, height }, key) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] === 0) continue;
      const dr = data[i] - key.r, dg = data[i + 1] - key.g, db = data[i + 2] - key.b;
      const d2 = dr * dr + dg * dg + db * db;
      if (d2 >= FRINGE_DIST_SQ) continue;

      const touchesKey =
        (x > 0 && data[i - 4 + 3] === 0) ||
        (x < width - 1 && data[i + 4 + 3] === 0) ||
        (y > 0 && data[i - width * 4 + 3] === 0) ||
        (y < height - 1 && data[i + width * 4 + 3] === 0);
      if (!touchesKey) continue;

      const t = Math.max(0, Math.min(1, (d2 - KILL_DIST_SQ) / (FRINGE_DIST_SQ - KILL_DIST_SQ)));
      data[i]     = Math.round(data[i]     - dr * (1 - t) * 0.5);
      data[i + 1] = Math.round(data[i + 1] - dg * (1 - t) * 0.5);
      data[i + 2] = Math.round(data[i + 2] - db * (1 - t) * 0.5);
      data[i + 3] = Math.round(data[i + 3] * (0.4 + 0.6 * t));
    }
  }
}

/** 5×5 sheet → frames the engine understands (same layout as the prompt). */
export function packFrames(cells) {
  const row = (r) => cells.slice(r * 5, r * 5 + 5);
  const [idle, walk, jump, powered, powerup] = [0, 1, 2, 3, 4].map(row);
  return {
    player: { idle, walk, jump },
    playerPowered: { idle: [powered[0]], walk: powered, jump: [powered[2]] },
    powerup,
  };
}
