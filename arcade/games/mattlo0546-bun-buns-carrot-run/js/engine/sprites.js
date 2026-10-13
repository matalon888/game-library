// =============================================
//   Main spritesheet  (5 rows × 4 cols)
// =============================================
let bunbunSheet = null;
if (typeof window !== 'undefined') bunbunSheet = new Image();

let bunbunFrameRects = null;

export const BUNBUN_COLS = 4;
export const BUNBUN_ROWS = 5;
const FALLBACK_FRAME_W = 24;
const FALLBACK_FRAME_H = 32;

// =============================================
//   Powerup-Yoshi spritesheet  (3 rows × 4 cols)
//   Row 0 = Leek+Yoshi, Row 1 = Kumamon+Yoshi, Row 2 = Miku+Yoshi
// =============================================
let pySheet = null;
if (typeof window !== 'undefined') pySheet = new Image();
let pyFrameRects = null;
const PY_COLS = 4;
const PY_ROWS = 5;  // sheet has 5 rows (same grid as main), only first 3 used

// =============================================
//   Preload both sheets
// =============================================
export function preloadSprites() {
  const loadMain = new Promise((resolve) => {
    bunbunSheet.onload = () => { computeFrameRects(bunbunSheet, BUNBUN_ROWS, BUNBUN_COLS, (r) => { bunbunFrameRects = r; }); resolve(true); };
    bunbunSheet.onerror = () => resolve(false);
    bunbunSheet.src = 'assets/bun-bun-spritesheet.png';
  });
  const loadPY = new Promise((resolve) => {
    pySheet.onload = () => { computeFrameRects(pySheet, PY_ROWS, PY_COLS, (r) => { pyFrameRects = r; }); resolve(true); };
    pySheet.onerror = () => resolve(false);
    pySheet.src = 'assets/bun-bun-powerup-yoshi-spritesheet.png';
  });
  return Promise.all([loadMain, loadPY]).then(([a]) => a);
}

export function isSpriteReady(img) {
  return !!img && img.complete && img.naturalWidth > 0;
}

export function getBunbunFrameSize() {
  if (!isSpriteReady(bunbunSheet)) {
    return { w: FALLBACK_FRAME_W, h: FALLBACK_FRAME_H };
  }
  return {
    w: Math.floor(bunbunSheet.naturalWidth / BUNBUN_COLS),
    h: Math.floor(bunbunSheet.naturalHeight / BUNBUN_ROWS),
  };
}

// =============================================
//   Generic alpha-scan frame rect builder
// =============================================
function computeFrameRects(sheet, rows, cols, storeFn) {
  const cellW = Math.floor(sheet.naturalWidth / cols);
  const cellH = Math.floor(sheet.naturalHeight / rows);

  const canvas = document.createElement('canvas');
  canvas.width = sheet.naturalWidth;
  canvas.height = sheet.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(sheet, 0, 0);

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const rects = [];

  for (let row = 0; row < rows; row++) {
    rects[row] = [];
    for (let col = 0; col < cols; col++) {
      const x0 = col * cellW;
      const y0 = row * cellH;
      let minX = cellW, minY = cellH, maxX = -1, maxY = -1;

      for (let y = 0; y < cellH; y++) {
        for (let x = 0; x < cellW; x++) {
          const ix = x0 + x;
          const iy = y0 + y;
          const idx = (iy * canvas.width + ix) * 4 + 3;
          if (img[idx] > 0) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (maxX >= 0 && maxY >= 0) {
        rects[row][col] = {
          x: x0 + minX,
          y: y0 + minY,
          w: (maxX - minX + 1),
          h: (maxY - minY + 1),
        };
      } else {
        rects[row][col] = { x: x0, y: y0, w: cellW, h: cellH };
      }
    }
  }

  storeFn(rects);
}

// =============================================
//   Main sheet accessors
// =============================================
export function getBunbunSpriteSheet() {
  return bunbunSheet;
}

export function getBunbunFrameRect(row, col) {
  if (!isSpriteReady(bunbunSheet)) return null;
  if (!bunbunFrameRects) computeFrameRects(bunbunSheet, BUNBUN_ROWS, BUNBUN_COLS, (r) => { bunbunFrameRects = r; });
  const rect = bunbunFrameRects?.[row]?.[col] || null;

  // Border cleanup: Miku jump frame can include extra bottom fringe in some sheets.
  // Keep the jump frame's foot baseline aligned with the other Miku frames.
  if (rect && row === 3 && col === 3 && bunbunFrameRects?.[3]) {
    const refs = [0, 1, 2]
      .map((c) => bunbunFrameRects[3][c])
      .filter((r) => !!r);
    if (refs.length > 0) {
      const targetBottom = Math.max(...refs.map((r) => r.y + r.h));
      const currentBottom = rect.y + rect.h;
      const extra = currentBottom - targetBottom;
      if (extra > 0) {
        return { ...rect, h: Math.max(1, rect.h - extra) };
      }
    }
  }

  return rect;
}

// =============================================
//   Powerup-Yoshi sheet accessors
// =============================================
export function getPYSpriteSheet() {
  return pySheet;
}

export function getPYFrameRect(row, col) {
  if (!isSpriteReady(pySheet)) return null;
  if (!pyFrameRects) computeFrameRects(pySheet, PY_ROWS, PY_COLS, (r) => { pyFrameRects = r; });
  return pyFrameRects?.[row]?.[col] || null;
}

export function getPYFrameSize() {
  if (!isSpriteReady(pySheet)) return null;
  return {
    w: Math.floor(pySheet.naturalWidth / PY_COLS),
    h: Math.floor(pySheet.naturalHeight / PY_ROWS),
  };
}

// =============================================
//   Row / sheet selection
//   Returns { sheet, rects getter, row, cols, frameSize getter }
// =============================================
export function getBunbunRow(p) {
  // Powerup + Yoshi combos → use the powerup-yoshi sheet
  if (p.hasYoshi && (p.hasLeek || p.hasKumamon || p.hasMiku)) {
    let pyRow = 0;
    if (p.hasKumamon) pyRow = 1;
    if (p.hasMiku) pyRow = 2;
    return { sheet: 'py', row: pyRow };
  }
  // Everything else → main sheet
  if (p.hasMiku) return { sheet: 'main', row: 3 };
  if (p.hasKumamon) return { sheet: 'main', row: 2 };
  if (p.hasLeek) return { sheet: 'main', row: 1 };
  if (p.hasYoshi) return { sheet: 'main', row: 4 };
  return { sheet: 'main', row: 0 };
}
