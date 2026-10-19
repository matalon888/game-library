// Cubeburrow texture atlas: 8×4 tiles of 16×16 pixel art, all painted in code. Plus isometric block icons for the HUD.
import { BLOCKS } from './world.js';

const T = 16;
function rnd(seed) { let s = seed * 9301 + 49297; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
function hex(c) { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function sh([r, g, b], k) { return `rgb(${Math.max(0, Math.min(255, r * k)) | 0},${Math.max(0, Math.min(255, g * k)) | 0},${Math.max(0, Math.min(255, b * k)) | 0})`; }

export function makeAtlas() {
  const cv = document.createElement('canvas'); cv.width = T * 8; cv.height = T * 4;
  const x = cv.getContext('2d');
  const tile = (i, fn) => { const ox = (i % 8) * T, oy = Math.floor(i / 8) * T, r = rnd(i * 31 + 7); const px = (a, b, c) => { x.fillStyle = c; x.fillRect(ox + a, oy + b, 1, 1); }; fn(px, r, ox, oy); };
  const noisy = (px, r, base, amt = 0.12, from = 0, to = T) => { const c = hex(base); for (let b = from; b < to; b++) for (let a = 0; a < T; a++) px(a, b, sh(c, 1 + (r() - 0.5) * 2 * amt)); };
  const grassTop = (px, r) => { noisy(px, r, '#67c04a', 0.1); for (let i = 0; i < 18; i++) px(r() * T | 0, r() * T | 0, r() < 0.5 ? '#86d85f' : '#4f9e38'); };
  const dirt = (px, r) => { noisy(px, r, '#94603a', 0.1); for (let i = 0; i < 16; i++) px(r() * T | 0, r() * T | 0, r() < 0.5 ? '#6f4426' : '#b07a4c'); };
  tile(0, grassTop);
  tile(1, (px, r) => { dirt(px, r); const g = hex('#67c04a'); for (let a = 0; a < T; a++) { const d = 3 + (r() * 3 | 0); for (let b = 0; b < d; b++) px(a, b, sh(g, 0.9 + r() * 0.25)); } });
  tile(2, dirt);
  tile(3, (px, r) => { noisy(px, r, '#a2a3ad', 0.07); for (let i = 0; i < 7; i++) { const a = r() * 14 | 0, b = r() * 15 | 0; px(a, b, '#83848f'); px(a + 1, b, '#83848f'); px(a + 2, b + (r() < .5 ? 1 : 0), '#8c8d98'); } });
  tile(4, (px, r) => { noisy(px, r, '#f3dc93', 0.06); for (let i = 0; i < 14; i++) px(r() * T | 0, r() * T | 0, r() < 0.5 ? '#e2c676' : '#fff0bd'); });
  tile(5, (px, r) => { noisy(px, r, '#f4f8ff', 0.03); for (let i = 0; i < 10; i++) px(r() * T | 0, r() * T | 0, '#d9e6f7'); });
  tile(6, (px, r) => { dirt(px, r); for (let a = 0; a < T; a++) { const d = 4 + (r() * 3 | 0); for (let b = 0; b < d; b++) px(a, b, b === d - 1 ? '#dce7f5' : '#f4f8ff'); } });
  tile(7, (px, r) => { const c = hex('#7d5130'); for (let a = 0; a < T; a++) { const k = a % 4 === 0 ? 0.72 : 1 + (r() - 0.5) * 0.15; for (let b = 0; b < T; b++) px(a, b, sh(c, k * (1 + (r() - 0.5) * 0.1))); } });
  tile(8, (px) => { for (let b = 0; b < T; b++) for (let a = 0; a < T; a++) { const d = Math.max(Math.abs(a - 7.5), Math.abs(b - 7.5)); px(a, b, d > 6.5 ? '#7d5130' : (Math.round(d) % 2 ? '#c9995c' : '#b08048')); } });
  tile(9, (px, r) => { noisy(px, r, '#3fa64a', 0.14); for (let i = 0; i < 26; i++) px(r() * T | 0, r() * T | 0, r() < 0.5 ? '#2c7d35' : '#62c46a'); });
  tile(10, (px, r) => { const c = hex('#cf9f5e'); for (let b = 0; b < T; b++) for (let a = 0; a < T; a++) { const seam = b % 4 === 3 || (a === ((b >> 2) % 2 ? 4 : 11) ); px(a, b, seam ? '#9c6f3a' : sh(c, 1 + (r() - 0.5) * 0.12)); } });
  tile(11, (px) => { for (let b = 0; b < T; b++) for (let a = 0; a < T; a++) { const edge = a === 0 || b === 0 || a === 15 || b === 15; if (edge) px(a, b, '#e8f7ff'); } [[3, 3], [4, 4], [5, 5], [3, 5], [10, 9], [11, 10]].forEach(([a, b]) => px(a, b, '#ffffff')); });
  tile(12, (px, r) => { const c = hex('#c4553f'); for (let b = 0; b < T; b++) for (let a = 0; a < T; a++) { const row = b >> 2, off = row % 2 ? 4 : 0; const mortar = b % 4 === 3 || (a + off) % 8 === 7; px(a, b, mortar ? '#e6d5c3' : sh(c, 1 + (r() - 0.5) * 0.18)); } });
  tile(13, (px, r) => { noisy(px, r, '#6e6f79', 0.05); const cells = [[3, 3], [10, 2], [6, 8], [13, 9], [2, 12], [9, 13]]; for (let b = 0; b < T; b++) for (let a = 0; a < T; a++) { let d1 = 99, d2 = 99; for (const [cx, cy] of cells) { const d = Math.hypot(a - cx, b - cy); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; } if (d2 - d1 > 1.1) px(a, b, sh(hex('#a7a8b2'), 1 + (r() - 0.5) * 0.15)); } });
  tile(14, (px) => { for (let b = 0; b < T; b++) for (let a = 0; a < T; a++) { const e = a === 0 || b === 0 || a === 15 || b === 15, e2 = a === 1 || b === 1 || a === 14 || b === 14; const d = Math.hypot(a - 7.5, b - 7.5); px(a, b, e ? '#8a5a26' : e2 ? '#c9893a' : d < 3 ? '#fffbe0' : d < 5.5 ? '#ffe68a' : '#ffc94d'); } for (let i = 2; i < 14; i++) { px(7, i, '#fff6c0'); px(i, 7, '#fff6c0'); } });
  tile(15, (px, r) => { noisy(px, r, '#3d8ff0', 0.05); for (let i = 0; i < 6; i++) { const a = r() * 12 | 0, b = r() * T | 0; for (let k = 0; k < 4; k++) px(a + k, b, '#6cb2ff'); } });
  tile(16, (px, r) => { noisy(px, r, '#a2a3ad', 0.07); const gems = [[4, 4, '#7ff6ff'], [11, 6, '#ff8af0'], [6, 11, '#7ff6ff'], [12, 12, '#b9a2ff']]; for (const [cx, cy, c] of gems) for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) if (Math.abs(a) + Math.abs(b) <= 2) px(cx + a, cy + b, Math.abs(a) + Math.abs(b) === 0 ? '#ffffff' : c); });
  tile(17, (px, r) => { noisy(px, r, '#d9774a', 0.08); for (let i = 0; i < 10; i++) px(r() * T | 0, r() * T | 0, '#c0603a'); });
  tile(18, (px, r) => { const c = hex('#4caf50'); for (let b = 0; b < T; b++) for (let a = 0; a < T; a++) px(a, b, a % 5 === 2 ? sh(c, 0.75) : sh(c, 1 + (r() - .5) * .12)); for (let i = 0; i < 8; i++) px(r() * T | 0, r() * T | 0, '#e8f5c8'); });
  tile(19, (px) => { for (let b = 0; b < T; b++) for (let a = 0; a < T; a++) { const d = Math.max(Math.abs(a - 7.5), Math.abs(b - 7.5)); px(a, b, d > 6.5 ? '#3c8f40' : d > 3 ? '#5cbf60' : '#7fd383'); } });
  tile(20, (px, r) => { noisy(px, r, '#3a3a44', 0.25); });
  tile(21, (px, r) => { for (let b = 0; b < T; b++) for (let a = 0; a < T; a++) { const e = Math.min(a, b, 15 - a, 15 - b); px(a, b, e === 0 ? '#2f86d6' : e === 2 ? '#a8dcff' : sh(hex('#5fb8ff'), 1 + (r() - .5) * .06)); } });
  tile(22, (px, r) => { for (let b = 0; b < T; b++) for (let a = 0; a < T; a++) { const e = Math.min(a, b, 15 - a, 15 - b); px(a, b, e === 0 ? '#d99a12' : e === 2 ? '#fff1a8' : sh(hex('#ffd23f'), 1 + (r() - .5) * .06)); } });
  return cv;
}

/** isometric icon for block id, drawn from the atlas: returns a data URL */
const iconCache = {};
export function icon(atlas, id, size = 64) {
  if (iconCache[id]) return iconCache[id];
  const B = BLOCKS[id], cv = document.createElement('canvas'); cv.width = cv.height = size;
  const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
  const src = t => [(t % 8) * T, Math.floor(t / 8) * T];
  const s = size * 0.42, cx = size / 2, top = size * 0.08, h = s * 0.5;
  // top face: rhombus
  x.save(); x.setTransform(s / T, h / T, -s / T, h / T, cx, top); x.drawImage(atlas, ...src(B.top), T, T, 0, 0, T, T); x.restore();
  // left face
  x.save(); x.setTransform(s / T, h / T, 0, s / T, cx - s, top + h); x.drawImage(atlas, ...src(B.side), T, T, 0, 0, T, T); x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, 0, T, T); x.restore();
  // right face
  x.save(); x.setTransform(s / T, -h / T, 0, s / T, cx, top + 2 * h); x.drawImage(atlas, ...src(B.side), T, T, 0, 0, T, T); x.fillStyle = 'rgba(0,0,0,.34)'; x.fillRect(0, 0, T, T); x.restore();
  return (iconCache[id] = cv.toDataURL());
}
