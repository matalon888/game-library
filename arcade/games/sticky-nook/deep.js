// Sticky Nook v2 ("deep"): same cosy sticker-pressing game, now with 30 authored rooms in 3 worlds (twins, locks, dust sheets,
// turning tray, rush clock), chain + perfect presses + COZY FEVER, stars, a level map, a sticker album, wand chests and a daily room.
// Art (Pen, ITEMS, THEMES, shell) is the v1 art, unchanged. Level data + solver live in levels.js.
import { createUI, input, loop, sfx, tone, note, buzz, store, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { LEVELS, WORLDS, EMOJI, NAMES, finish, gen, TINT } from './levels.js';
const WB = board({ game: 'sticky-nook', label: 'Levels cleared', limits: { maxRun: 1, maxPerSec: 0.4 }, mode: 'sum' });
const SV = store('sn2');
const F = flow('stickynook');
let fk = 1;
const ui = createUI({ title: 'STICKY<br>NOOK', hint: '', hand: '', button: 'PLAY', score: false });
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1;
const hexA = (h, a) => { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
// ------------------------------------------------------------------ colour helpers
function shade(hex, amt) {         // amt -1..1 : darken / lighten
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = amt < 0 ? 0 : 255, t = Math.abs(amt); r = Math.round(r + (f - r) * t); g = Math.round(g + (f - g) * t); b = Math.round(b + (f - b) * t);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
const LINE = '#5b4636';

// ------------------------------------------------------------------ iso pen: same primitives draw items, measure them, and draw the room shell
const C30 = Math.cos(Math.PI / 6);
let R = { x: 0, y: 0, s: 20 };       // screen position of the back floor corner + unit size
const P = (u, v, z) => [R.x + (u - v) * C30 * R.s, R.y + (u + v) * 0.5 * R.s - z * R.s];
class Pen {
  constructor(c, ox = 0, oy = 0) { this.c = c; this.ox = ox; this.oy = oy; this.bb = null; }
  pt(p) { if (this.bb) { const b = this.bb; b[0] = Math.min(b[0], p[0]); b[1] = Math.min(b[1], p[1]); b[2] = Math.max(b[2], p[0]); b[3] = Math.max(b[3], p[1]); } return [p[0] - this.ox, p[1] - this.oy]; }
  poly(pts, fill, stroke = true) {
    const q = pts.map(p => this.pt(p)); if (this.bb) return;
    const c = this.c; c.beginPath(); q.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.closePath(); c.fillStyle = fill; c.fill();
    if (stroke) { c.strokeStyle = LINE; c.lineWidth = Math.max(1.1, R.s * 0.07); c.lineJoin = 'round'; c.stroke(); }
  }
  line(a, b, w = 0.06, col = LINE) { const p = this.pt(a), q = this.pt(b); if (this.bb) return; const c = this.c; c.beginPath(); c.moveTo(...p); c.lineTo(...q); c.strokeStyle = col; c.lineWidth = Math.max(1, R.s * w); c.lineCap = 'round'; c.stroke(); }
  box(u, v, z, du, dv, dz, col, o = {}) {
    this.poly([P(u + du, v, z), P(u + du, v + dv, z), P(u + du, v + dv, z + dz), P(u + du, v, z + dz)], o.right || shade(col, -0.13));
    this.poly([P(u, v + dv, z), P(u + du, v + dv, z), P(u + du, v + dv, z + dz), P(u, v + dv, z + dz)], o.left || col);
    this.poly([P(u, v, z + dz), P(u + du, v, z + dz), P(u + du, v + dv, z + dz), P(u, v + dv, z + dz)], o.top || shade(col, 0.16));
  }
  ell(cx, cy, rx, ry, fill, stroke = true) {
    const p = this.pt([cx, cy]); if (this.bb) { this.pt([cx - rx, cy - ry]); this.pt([cx + rx, cy + ry]); return; }
    const c = this.c; c.beginPath(); c.ellipse(p[0], p[1], rx, ry, 0, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = LINE; c.lineWidth = Math.max(1.1, R.s * 0.07); c.stroke(); }
  }
  cyl(u, v, z, r, h, col, top) {
    const [bx, by] = P(u, v, z), [tx, ty] = P(u, v, z + h), rx = r * R.s * 1.2247, ry = r * R.s * 0.7071;
    if (this.bb) { this.pt([bx - rx, by + ry]); this.pt([tx + rx, ty - ry]); return; }
    const c = this.c, [bx2, by2] = [bx - this.ox, by - this.oy], [tx2, ty2] = [tx - this.ox, ty - this.oy];
    c.beginPath(); c.moveTo(bx2 - rx, by2); c.ellipse(bx2, by2, rx, ry, 0, Math.PI, 0, true); c.lineTo(tx2 + rx, ty2); c.ellipse(tx2, ty2, rx, ry, 0, 0, Math.PI, true); c.closePath();
    c.fillStyle = col; c.fill(); c.strokeStyle = LINE; c.lineWidth = Math.max(1.1, R.s * 0.07); c.stroke();
    c.beginPath(); c.ellipse(tx2, ty2, rx, ry, 0, 0, Math.PI * 2); c.fillStyle = top || shade(col, 0.18); c.fill(); c.stroke();
  }
  ball(u, v, z, r, col) { const [x, y] = P(u, v, z); this.ell(x, y, r * R.s, r * R.s, col); if (!this.bb) { const p = this.pt([x - r * R.s * 0.35, y - r * R.s * 0.35]); this.c.beginPath(); this.c.arc(p[0], p[1], r * R.s * 0.22, 0, 7); this.c.fillStyle = 'rgba(255,255,255,.55)'; this.c.fill(); } }
  wallR(u, z, du, dz, col, d = 0.04) { this.poly([P(u, d, z), P(u + du, d, z), P(u + du, d, z + dz), P(u, d, z + dz)], col); }
  wallL(v, z, dv, dz, col, d = 0.04) { this.poly([P(d, v, z), P(d, v + dv, z), P(d, v + dv, z + dz), P(d, v, z + dz)], col); }
  floor(u, v, du, dv, col) { this.poly([P(u, v, 0.02), P(u + du, v, 0.02), P(u + du, v + dv, 0.02), P(u, v + dv, 0.02)], col); }
  rug(u, v, ru, col, col2) { const [x, y] = P(u, v, 0.02), rx = ru * R.s * 1.2247, ry = ru * R.s * 0.7071; this.ell(x, y, rx, ry, col); if (col2) this.ell(x, y, rx * 0.7, ry * 0.7, col2, false); }
  cat(u, v, z, sc = 1, col = '#ffffff') {
    const [x, y] = P(u, v, z), k = R.s * sc;
    this.ell(x, y - k * 0.55, k * 0.75, k * 0.62, col);                       // body
    this.poly([[x - k * 0.62, y - k * 1.45], [x - k * 0.5, y - k * 2.05], [x - k * 0.15, y - k * 1.6]], col);
    this.poly([[x + k * 0.62, y - k * 1.45], [x + k * 0.5, y - k * 2.05], [x + k * 0.15, y - k * 1.6]], col);
    this.ell(x, y - k * 1.35, k * 0.68, k * 0.52, col);                       // head
    if (this.bb) return;
    const c = this.c, h = this.pt([x, y - k * 1.35]);
    c.fillStyle = LINE; for (const s of [-1, 1]) { c.beginPath(); c.arc(h[0] + s * k * 0.26, h[1], k * 0.07, 0, 7); c.fill(); }
    c.fillStyle = '#ff9fb2'; for (const s of [-1, 1]) { c.beginPath(); c.ellipse(h[0] + s * k * 0.42, h[1] + k * 0.15, k * 0.1, k * 0.06, 0, 0, 7); c.fill(); }
    c.strokeStyle = LINE; c.lineWidth = Math.max(1, k * 0.05); c.beginPath(); c.arc(h[0] - k * 0.05, h[1] + k * 0.1, k * 0.06, 0, Math.PI); c.arc(h[0] + k * 0.07, h[1] + k * 0.1, k * 0.06, 0, Math.PI); c.stroke();
  }
}

// ------------------------------------------------------------------ item library (u, v along the floor, z up; room is 10 × 10 × 7.5)
const WOOD = '#d9a066', WOOD2 = '#b97f4c';
const ITEMS = {
  bed: (p, t) => { p.box(0, 4.3, 0, 0.35, 3.0, 2.4, WOOD2); p.box(0.3, 4.5, 0, 4.1, 2.7, 0.75, WOOD); p.box(0.4, 4.6, 0.75, 3.9, 2.5, 0.45, '#fffaf2'); p.box(1.8, 4.5, 0.8, 2.65, 2.7, 0.5, t.accent); p.box(0.55, 4.85, 1.2, 0.95, 1.95, 0.4, '#ffffff'); },
  wardrobe: (p, t) => { p.box(7.0, 0.1, 0, 2.7, 1.6, 5.2, t.furn); p.line(P(8.35, 1.7, 0.4), P(8.35, 1.7, 4.9), 0.05); p.ball(8.1, 1.75, 2.6, 0.12, '#ffd166'); p.ball(8.6, 1.75, 2.6, 0.12, '#ffd166'); p.box(7.2, 0.4, 5.2, 1.1, 0.9, 0.8, '#f4c27a'); },
  desk: (p, t) => { for (const [a, b] of [[1.3, 0.2], [4.1, 0.2], [1.3, 1.5], [4.1, 1.5]]) p.box(a, b, 0, 0.25, 0.25, 2.1, WOOD2); p.box(1.15, 0.1, 2.1, 3.4, 1.8, 0.25, WOOD); p.box(2.0, 0.3, 2.35, 1.6, 1.1, 0.12, '#cfd6e0'); p.poly([P(2.0, 0.35, 2.47), P(3.6, 0.35, 2.47), P(3.6, 0.35, 3.6), P(2.0, 0.35, 3.6)], '#9fb4cc'); },
  chair: (p, t) => { for (const [a, b] of [[2.3, 2.5], [3.3, 2.5], [2.3, 3.5], [3.3, 3.5]]) p.box(a, b, 0, 0.18, 0.18, 1.2, WOOD2); p.box(2.2, 2.4, 1.2, 1.4, 1.35, 0.25, t.accent2); p.box(2.2, 3.55, 1.45, 1.4, 0.22, 1.5, t.accent2); },
  window: (p, t) => { p.wallR(4.7, 2.7, 2.6, 2.8, '#ffffff'); p.wallR(4.9, 2.9, 2.2, 2.4, '#bfe6ff'); p.line(P(6.0, 0.05, 2.9), P(6.0, 0.05, 5.3), 0.08, '#fff'); p.line(P(4.9, 0.05, 4.1), P(7.1, 0.05, 4.1), 0.08, '#fff'); p.wallR(4.4, 2.4, 0.7, 3.5, t.accent, 0.08); p.wallR(6.9, 2.4, 0.7, 3.5, t.accent, 0.08); p.wallR(4.3, 5.8, 3.4, 0.25, WOOD2, 0.1); },
  frame: (p, t) => { p.wallL(5.0, 3.9, 2.0, 1.6, WOOD); p.wallL(5.2, 4.1, 1.6, 1.2, '#fff3d6'); p.poly([P(0.05, 5.4, 4.2), P(0.05, 6.0, 4.9), P(0.05, 6.6, 4.2)], '#7cc68a'); p.ball(0.05, 6.3, 4.95, 0.15, '#ffcf5a'); },
  rug: (p, t) => { p.rug(5.8, 6.2, 2.3, t.rug, shade(t.rug, 0.25)); },
  plant: (p, t) => { p.cyl(9.0, 8.9, 0, 0.55, 1.0, '#e58a5f'); p.ball(9.0, 8.9, 1.6, 0.75, '#5cb85c'); p.ball(8.7, 9.1, 2.2, 0.55, '#6fcf6f'); p.ball(9.3, 8.7, 2.3, 0.5, '#4ea84e'); },
  lamp: (p, t) => { p.box(0.3, 7.6, 0, 1.3, 1.4, 1.3, WOOD); p.cyl(0.95, 8.3, 1.3, 0.2, 0.7, '#ffffff'); p.cyl(0.95, 8.3, 2.0, 0.55, 0.6, '#ffe08a'); },
  cat: (p, t) => { p.cat(5.9, 6.4, 0.05, 1.0, '#ffffff'); },
  shelf: (p, t) => { p.box(0.05, 4.6, 4.4, 0.7, 2.8, 0.18, WOOD2); ['#ff8fa3', '#7bb7ff', '#ffd166', '#8ad6a0'].forEach((c, i) => p.box(0.15, 4.8 + i * 0.45, 4.58, 0.5, 0.35, 0.9 + (i % 2) * 0.25, c)); p.ball(0.4, 7.0, 4.85, 0.28, '#5cb85c'); },
  clock: (p, t) => { const [x, y] = P(2.8, 0.05, 6.0); p.ell(x, y, R.s * 0.75, R.s * 0.85, '#ffffff'); p.line([x, y], [x, y - R.s * 0.5], 0.08); p.line([x, y], [x + R.s * 0.35, y + R.s * 0.1], 0.08); },
  // kitchen
  fridge: (p, t) => { p.box(7.7, 0.1, 0, 2.0, 1.8, 5.6, '#e9f4ff'); p.line(P(7.7, 1.9, 3.6), P(9.7, 1.9, 3.6), 0.05); p.box(8.0, 1.9, 4.1, 0.15, 0.1, 1.0, '#9aa7b8'); p.box(8.0, 1.9, 1.6, 0.15, 0.1, 1.4, '#9aa7b8'); p.ball(9.0, 1.95, 4.6, 0.2, '#ff8fa3'); },
  counter: (p, t) => { p.box(1.8, 0.1, 0, 5.6, 1.9, 2.3, t.furn); p.box(1.7, 0.05, 2.3, 5.8, 2.05, 0.22, '#f4efe8'); for (let i = 0; i < 3; i++) p.line(P(2.0 + i * 1.8 + 1.6, 2.0, 0.3), P(2.0 + i * 1.8 + 1.6, 2.0, 2.0), 0.05); },
  stove: (p, t) => { p.box(4.3, 0.2, 2.52, 1.9, 1.6, 0.12, '#4a4a55'); p.ell(...P(4.8, 0.7, 2.66), R.s * 0.45, R.s * 0.26, '#2c2c33'); p.ell(...P(5.7, 1.3, 2.66), R.s * 0.45, R.s * 0.26, '#2c2c33'); p.cyl(4.8, 0.7, 2.66, 0.45, 0.6, '#ff7b6b'); },
  cabinets: (p, t) => { p.box(1.9, 0.05, 4.4, 2.4, 1.0, 1.4, t.furn); p.box(4.5, 0.05, 4.9, 2.6, 0.5, 0.15, WOOD2); ['#ffffff', '#ffd166', '#7bb7ff'].forEach((c, i) => p.cyl(4.9 + i * 0.8, 0.3, 5.05, 0.22, 0.45, c)); },
  table: (p, t) => { p.cyl(5.6, 6.0, 0, 0.25, 1.9, WOOD2); p.cyl(5.6, 6.0, 1.9, 1.6, 0.22, WOOD); },
  cake: (p, t) => { p.cyl(5.6, 6.0, 2.15, 0.6, 0.55, '#ffd6e0', '#fff'); p.ball(5.6, 6.0, 2.85, 0.16, '#ff4d6d'); },
  stool: (p, t) => { p.cyl(3.4, 6.9, 0, 0.15, 1.3, WOOD2); p.cyl(3.4, 6.9, 1.3, 0.7, 0.25, t.accent2); },
  kwindow: (p, t) => { p.wallL(3.0, 2.8, 2.6, 2.6, '#ffffff'); p.wallL(3.2, 3.0, 2.2, 2.2, '#bfe6ff'); p.line(P(0.05, 4.3, 3.0), P(0.05, 4.3, 5.2), 0.08, '#fff'); p.wallL(2.8, 5.4, 3.0, 0.5, t.accent, 0.1); },
  mugs: (p, t) => { p.box(0.05, 6.4, 4.2, 0.6, 2.4, 0.15, WOOD2); ['#ff8fa3', '#7bb7ff', '#ffd166'].forEach((c, i) => p.cyl(0.35, 6.8 + i * 0.75, 4.35, 0.22, 0.4, c)); },
  // bathroom
  tub: (p, t) => { p.box(0.2, 2.0, 0, 2.4, 4.8, 1.8, '#ffffff'); p.poly([P(0.5, 2.3, 1.8), P(2.3, 2.3, 1.8), P(2.3, 6.5, 1.8), P(0.5, 6.5, 1.8)], '#9fdcff'); p.ball(1.2, 3.0, 2.0, 0.28, '#ffffff'); p.ball(1.6, 3.4, 2.0, 0.22, '#ffffff'); },
  duck: (p, t) => { p.ball(1.6, 5.4, 2.05, 0.3, '#ffd23f'); p.ball(1.75, 5.25, 2.45, 0.2, '#ffd23f'); const q = P(1.95, 5.2, 2.42); p.ell(q[0] + R.s * 0.12, q[1], R.s * 0.12, R.s * 0.06, '#ff8c42'); },
  toilet: (p, t) => { p.box(6.8, 0.1, 0, 1.3, 0.6, 2.4, '#ffffff'); p.cyl(7.45, 1.4, 0, 0.45, 1.1, '#ffffff'); p.cyl(7.45, 1.45, 1.1, 0.65, 0.18, '#f1f6ff'); },
  sink: (p, t) => { p.box(3.3, 0.1, 0, 2.2, 1.5, 2.1, t.furn); p.box(3.2, 0.05, 2.1, 2.4, 1.65, 0.25, '#ffffff'); p.ell(...P(4.35, 0.9, 2.37), R.s * 0.8, R.s * 0.38, '#cfe9ff'); p.box(4.25, 0.15, 2.35, 0.2, 0.3, 0.7, '#aab4c3'); },
  mirror: (p, t) => { const [x, y] = P(4.4, 0.05, 4.7); p.ell(x, y, R.s * 1.15, R.s * 1.35, WOOD); p.ell(x, y, R.s * 0.95, R.s * 1.15, '#dff3ff'); p.line([x - R.s * 0.4, y - R.s * 0.3], [x + R.s * 0.1, y - R.s * 0.75], 0.08, '#fff'); },
  washer: (p, t) => { p.box(8.4, 0.1, 0, 1.4, 1.6, 2.6, '#f4f7fb'); const q = P(9.1, 1.72, 1.2); p.ell(q[0], q[1], R.s * 0.55, R.s * 0.6, '#b8d8f0'); p.ell(q[0], q[1], R.s * 0.38, R.s * 0.42, '#7fb6e0'); p.box(8.6, 0.1, 2.6, 1.0, 0.3, 0.12, '#cfd6e0'); },
  towels: (p, t) => { p.line(P(0.05, 7.0, 4.6), P(0.05, 9.0, 4.6), 0.1, '#aab4c3'); p.wallL(7.2, 3.0, 0.8, 1.6, t.accent, 0.12); p.wallL(8.1, 3.3, 0.7, 1.3, '#8ad6c7', 0.12); },
  bottles: (p, t) => { p.box(0.05, 2.4, 3.9, 0.6, 3.4, 0.15, '#ffffff'); ['#ff8fa3', '#8ad6c7', '#ffd166', '#b39ddb'].forEach((c, i) => p.cyl(0.35, 2.8 + i * 0.8, 4.05, 0.2, 0.55 + (i % 2) * 0.25, c)); },
  bathrug: (p, t) => { p.floor(3.3, 3.2, 2.2, 3.2, t.rug); },
  // living room
  sofa: (p, t) => { p.box(0.2, 2.4, 0, 2.4, 5.0, 1.1, t.accent); p.box(0.1, 2.3, 0, 0.7, 5.2, 2.4, shade(t.accent, -0.06)); p.box(0.2, 2.2, 0, 2.4, 0.5, 1.8, shade(t.accent, -0.06)); p.box(0.2, 7.3, 0, 2.4, 0.5, 1.8, shade(t.accent, -0.06)); },
  cushions: (p, t) => { p.box(0.8, 3.0, 1.1, 0.5, 1.4, 1.1, '#ffd166'); p.box(0.8, 5.6, 1.1, 0.5, 1.4, 1.1, '#8ad6c7'); },
  tvstand: (p, t) => { p.box(3.0, 0.1, 0, 3.8, 1.5, 1.4, WOOD); p.box(3.4, 0.4, 1.4, 3.0, 0.3, 2.0, '#2f3340'); p.poly([P(3.55, 0.71, 1.55), P(6.25, 0.71, 1.55), P(6.25, 0.71, 3.25), P(3.55, 0.71, 3.25)], '#6ec6ff'); },
  coffee: (p, t) => { p.box(4.0, 4.3, 0, 2.6, 1.7, 0.9, WOOD); p.cyl(4.7, 4.9, 0.9, 0.22, 0.35, '#ffffff'); p.box(5.4, 4.6, 0.9, 0.9, 0.7, 0.18, '#ff8fa3'); },
  bookshelf: (p, t) => { p.box(7.2, 0.1, 0, 2.5, 1.4, 5.6, WOOD2); for (let r = 0; r < 4; r++) for (let i = 0; i < 4; i++) p.box(7.35 + i * 0.55, 1.2, 0.25 + r * 1.35, 0.42, 0.2, 0.95 - (i % 2) * 0.2, ['#ff8fa3', '#7bb7ff', '#ffd166', '#8ad6a0', '#b39ddb'][(r + i) % 5]); },
  floorlamp: (p, t) => { p.cyl(1.0, 9.0, 0, 0.5, 0.15, '#4a4a55'); p.cyl(1.0, 9.0, 0.15, 0.08, 3.6, '#4a4a55'); p.cyl(1.0, 9.0, 3.6, 0.7, 0.8, '#ffe08a'); },
  painting: (p, t) => { p.wallL(3.0, 4.2, 3.2, 2.0, '#ffffff'); p.wallL(3.2, 4.4, 2.8, 1.6, '#ffe3c2'); p.poly([P(0.05, 3.4, 4.5), P(0.05, 4.4, 5.6), P(0.05, 5.4, 4.5)], '#8fb8ff'); p.poly([P(0.05, 4.4, 4.5), P(0.05, 5.2, 5.2), P(0.05, 5.9, 4.5)], '#6d9cf0'); p.ball(0.05, 5.4, 5.6, 0.2, '#ffb347'); },
  sofacat: (p, t) => { p.cat(1.6, 4.6, 1.1, 0.9, '#ffffff'); },
  lrug: (p, t) => { p.floor(3.4, 3.6, 4.0, 3.2, t.rug); p.floor(3.8, 4.0, 3.2, 2.4, shade(t.rug, 0.25)); },
  wclock: (p, t) => { const [x, y] = P(1.6, 0.05, 5.3); p.ell(x, y, R.s * 0.7, R.s * 0.8, '#fff'); p.line([x, y], [x, y - R.s * 0.45], 0.08); p.line([x, y], [x + R.s * 0.3, y], 0.08); },
  bigplant: (p, t) => { p.cyl(8.9, 8.6, 0, 0.6, 1.2, '#f2f2f2'); for (let i = 0; i < 5; i++) p.ball(8.9 + Math.cos(i * 1.3) * 0.5, 8.6 + Math.sin(i * 1.3) * 0.5, 2.0 + i * 0.4, 0.55, ['#5cb85c', '#4ea84e', '#6fcf6f'][i % 3]); },
};
// order matters: drawing order back → front (wall items first, then by depth)
const THEMES = [
  { name: 'Cosy Bedroom', items: ['window', 'frame', 'shelf', 'clock', 'rug', 'wardrobe', 'desk', 'bed', 'chair', 'lamp', 'cat', 'plant'], walls: [['#ffd9e2', '#ffc8d6'], ['#d9ecff', '#c4ddfa']], floor: ['#f0c99a', '#e6b882'], pattern: 'planks', accent: ['#9b8cff', '#ff8fa3'], accent2: ['#7ec8ff', '#ffd166'], furn: ['#fff2dc', '#e3f1ff'], rug: ['#ff9fb2', '#8fd3c0'] },
  { name: 'Sunny Kitchen', items: ['kwindow', 'mugs', 'cabinets', 'rug', 'fridge', 'counter', 'stove', 'table', 'cake', 'stool', 'cat', 'plant'], walls: [['#fff1c9', '#ffe6a6'], ['#dff6e6', '#c9ecd4']], floor: ['#f7f1e6', '#e6dccb'], pattern: 'tiles', accent: ['#ff8fa3', '#7ec8ff'], accent2: ['#ffb347', '#8ad6a0'], furn: ['#8ad6c7', '#ffb38a'], rug: ['#ffcf7a', '#ff9fb2'] },
  { name: 'Bubble Bath', items: ['bottles', 'towels', 'mirror', 'bathrug', 'tub', 'duck', 'sink', 'toilet', 'washer', 'cat', 'plant'], walls: [['#d6f2ff', '#bfe6fb'], ['#eadcff', '#ddc9ff']], floor: ['#ffffff', '#e2eef6'], pattern: 'tiles', accent: ['#ff8fa3', '#ffd166'], accent2: ['#7ec8ff', '#8ad6a0'], furn: ['#b8a4ff', '#8ad6c7'], rug: ['#8ad6c7', '#ffb3c6'] },
  { name: 'Lazy Lounge', items: ['painting', 'wclock', 'lrug', 'bookshelf', 'tvstand', 'sofa', 'cushions', 'sofacat', 'coffee', 'floorlamp', 'bigplant'], walls: [['#e9e2ff', '#d9cfff'], ['#ffe3cc', '#ffd2b0']], floor: ['#e8c193', '#d6a874'], pattern: 'planks', accent: ['#7ec8ff', '#ff8fa3'], accent2: ['#ffd166', '#b39ddb'], furn: ['#fff2dc', '#e3f1ff'], rug: ['#8fd3c0', '#ffb38a'] },
];
// ------------------------------------------------------------------ extra stickers (tinted twins): a,b = floor spot, c = colour
const XI = {
  pouf: (p, t, x) => { p.cyl(x.a, x.b, 0, 0.72, 0.62, x.c); p.ell(...P(x.a, x.b, 0.62), R.s * 0.42, R.s * 0.22, shade(x.c, -0.12), false); },
  pot: (p, t, x) => { p.cyl(x.a, x.b, 0, 0.5, 0.85, x.c); p.ball(x.a, x.b, 1.45, 0.6, '#5cb85c'); p.ball(x.a + 0.3, x.b - 0.2, 1.95, 0.4, '#6fcf6f'); p.ball(x.a - 0.3, x.b + 0.1, 1.9, 0.36, '#4ea84e'); },
  gift: (p, t, x) => { p.box(x.a, x.b, 0, 1.15, 1.15, 1.0, x.c); p.box(x.a + 0.45, x.b, 0, 0.25, 1.15, 1.02, '#ffffff'); p.box(x.a, x.b + 0.45, 0, 1.15, 0.25, 1.02, '#ffffff'); p.ball(x.a + 0.55, x.b + 0.55, 1.2, 0.3, '#ffffff'); },
  balloon: (p, t, x) => { p.line(P(x.a, x.b, 0.1), P(x.a, x.b, 2.6), 0.04, '#8a7a6a'); p.ball(x.a, x.b, 3.5, 0.85, x.c); p.ball(x.a, x.b, 2.55, 0.12, shade(x.c, -0.15)); },
};
function drawItem(p, spec) { if (spec.kind) XI[spec.kind](p, look, spec); else ITEMS[spec.key](p, look); }
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w * DPR)); c.height = Math.max(1, Math.ceil(h * DPR)); const x = c.getContext('2d'); x.scale(DPR, DPR); return [c, x]; }
function renderItem(spec) {
  const key = spec.key;
  const meas = new Pen(null); meas.bb = [1e9, 1e9, -1e9, -1e9]; drawItem(meas, spec);
  const pad = 10, [x0, y0, x1, y1] = meas.bb, w = x1 - x0 + pad * 2, h = y1 - y0 + pad * 2;
  const [c, cx] = makeCanvas(w, h); drawItem(new Pen(cx, x0 - pad, y0 - pad), spec);
  // sticker version: white die-cut border + soft shadow
  const B = Math.max(4, R.s * 0.28), [s, sx] = makeCanvas(w + B * 2, h + B * 2 + 4);
  const [sil, silx] = makeCanvas(w, h); silx.drawImage(c, 0, 0, w, h); silx.globalCompositeOperation = 'source-in'; silx.fillStyle = '#ffffff'; silx.fillRect(0, 0, w, h);
  const [shd, shx] = makeCanvas(w, h); shx.drawImage(c, 0, 0, w, h); shx.globalCompositeOperation = 'source-in'; shx.fillStyle = '#7a5a40'; shx.fillRect(0, 0, w, h);
  sx.globalAlpha = 0.07; for (let a = 0; a < 12; a++) sx.drawImage(shd, B + Math.cos(a / 12 * 6.283) * B, B + 4 + Math.sin(a / 12 * 6.283) * B, w, h);
  sx.globalAlpha = 1;
  for (let a = 0; a < 24; a++) sx.drawImage(sil, B + Math.cos(a / 24 * 6.283) * B, B + Math.sin(a / 24 * 6.283) * B, w, h);
  sx.drawImage(c, B, B, w, h);
  // empty-spot ghost: soft silhouette
  const [g, gx] = makeCanvas(w, h); gx.drawImage(c, 0, 0, w, h); gx.globalCompositeOperation = 'source-in'; gx.fillStyle = spec.tint ? hexA(spec.tint, 0.62) : 'rgba(120,90,70,.22)'; gx.fillRect(0, 0, w, h);
  return { key, spec, img: c, stk: s, ghost: g, x: x0 - pad, y: y0 - pad, w, h, B, cx: x0 - pad + w / 2, cy: y0 - pad + h / 2 };
}
function drawShell(c, p, grey) {
  const t = look, Hh = 7.5, wallL = t.wallL, wallR = t.wallR;
  // floor slab + floor
  p.poly([P(10, 0, 0), P(10, 10, 0), P(10, 10, -0.7), P(10, 0, -0.7)], '#e9cfb2');
  p.poly([P(0, 10, 0), P(10, 10, 0), P(10, 10, -0.7), P(0, 10, -0.7)], '#f6dfc4');
  p.poly([P(0, 0, 0), P(10, 0, 0), P(10, 10, 0), P(0, 10, 0)], t.floor);
  c.save(); c.beginPath(); [P(0, 0, 0), P(10, 0, 0), P(10, 10, 0), P(0, 10, 0)].forEach((q, i) => i ? c.lineTo(...q) : c.moveTo(...q)); c.clip();
  c.strokeStyle = shade(t.floor, -0.12); c.lineWidth = Math.max(1, R.s * 0.05);
  if (t.pattern === 'planks') { for (let v = 1.2; v < 10; v += 1.2) { c.beginPath(); c.moveTo(...P(0, v, 0)); c.lineTo(...P(10, v, 0)); c.stroke(); for (let u = (v * 3.7) % 3; u < 10; u += 3) { c.beginPath(); c.moveTo(...P(u, v - 1.2, 0)); c.lineTo(...P(u, v, 0)); c.stroke(); } } }
  else { for (let k = 1.25; k < 10; k += 1.25) { c.beginPath(); c.moveTo(...P(k, 0, 0)); c.lineTo(...P(k, 10, 0)); c.stroke(); c.beginPath(); c.moveTo(...P(0, k, 0)); c.lineTo(...P(10, k, 0)); c.stroke(); } }
  c.restore();
  // walls with wallpaper
  p.poly([P(0, 0, 0), P(0, 10, 0), P(0, 10, Hh), P(0, 0, Hh)], wallL);
  p.poly([P(0, 0, 0), P(10, 0, 0), P(10, 0, Hh), P(0, 0, Hh)], wallR);
  c.save(); c.globalAlpha = 0.35; c.strokeStyle = shade(wallL, -0.1); c.lineWidth = R.s * 0.35;
  for (let v = 0.8; v < 10; v += 1.6) { c.beginPath(); c.moveTo(...P(0.02, v, 0.4)); c.lineTo(...P(0.02, v, Hh)); c.stroke(); }
  c.fillStyle = shade(wallR, -0.12); for (let u = 0.8; u < 10; u += 1.5) for (let z = 1.2; z < Hh; z += 1.5) { const q = P(u + (z % 3 ? 0.75 : 0), 0.02, z); c.beginPath(); c.arc(q[0], q[1], R.s * 0.13, 0, 7); c.fill(); }
  c.restore();
  // baseboards + wall caps
  p.poly([P(0.02, 0, 0), P(0.02, 10, 0), P(0.02, 10, 0.4), P(0.02, 0, 0.4)], '#ffffff');
  p.poly([P(0, 0.02, 0), P(10, 0.02, 0), P(10, 0.02, 0.4), P(0, 0.02, 0.4)], '#ffffff');
  p.poly([P(0, 0, Hh), P(0, 10, Hh), P(-0.45, 10, Hh), P(-0.45, -0.45, Hh)], '#fff8ef');
  p.poly([P(0, 0, Hh), P(10, 0, Hh), P(10, -0.45, Hh), P(-0.45, -0.45, Hh)], '#fff8ef');
  p.poly([P(0, 10, 0), P(0, 10, Hh), P(-0.45, 10, Hh), P(-0.45, 10, -0.7), P(0, 10, -0.7)], '#f3dcc3');
  p.poly([P(10, 0, 0), P(10, 0, Hh), P(10, -0.45, Hh), P(10, -0.45, -0.7), P(10, 0, -0.7)], '#e9cfb2');
}
// ------------------------------------------------------------------ save
const dayNo = () => { const d = new Date(); return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5); };
const DAY0 = Math.floor(Date.UTC(2026, 9, 31) / 864e5);
const stars = () => SV.get('stars', {});
const totalStars = () => Object.values(stars()).reduce((a, b) => a + b, 0);
const unlockedTo = () => { const s = stars(); let n = 1; while (s[n]) n++; return Math.min(n, 31); };
const wands = () => SV.get('wands', 2);
function touchDay() {                     // streak = consecutive days a sticker was pressed
  const t = dayNo(), last = SV.get('last', 0); if (last === t) return;
  SV.set('streak', last === t - 1 ? SV.get('streak', 0) + 1 : 1); SV.set('last', t);
}
const streak = () => { const t = dayNo(), last = SV.get('last', 0); return last === t || last === t - 1 ? SV.get('streak', 0) : 0; };
const dailyLevel = () => { const g = gen(dayNo() * 7919 + 13, 3); g.name = 'Daily room #' + (dayNo() - DAY0 + 1); return g; };
const levelSpec = n => n <= LEVELS.length ? finish(LEVELS[n - 1]) : gen(n * 131, 3);

// ------------------------------------------------------------------ level state
let theme, look, stickers = [], order = [], fixed = [], tray = [], placedN = 0, hearts_ = 3, maxH = 3, state = 'map', colorAmt = 0, colorTarget = 0;
let shellImg = null, shellGrey = null, drag = null, botMove = null, idleT = 0, sparks = [], winT = 0, trayShift = 0, sel = null, fly = null, shakeT = 0;
let slowT = 6, cur = null, lvNo = 1, mode = 'level', t0 = null, tm = 0, chain = 0, chainT = 0, bestChain = 0, fever = 0, perfects = 0, wandUsed = 0, peeks = 0;
let convT = 0, rushLeft = 0, floaters = [], ts = 1, tsT = 0, wandHit = false, wasNewClear = false, bannerT = 0, bannerTxt = '', pillAt = 0;
const TRAY_SLOTS = 3, CHAIN_WIN = 3.2;
const PENTA = [72, 74, 76, 79, 81, 84, 86, 88, 91, 93, 96, 98];
let bgImg = null;

function buildLevel(lv) {
  cur = lv; theme = THEMES[lv.th]; const th = theme, wi = lv.look; fk = F.k();
  const hr = (c, d) => { const n = parseInt(c.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const a = d * Math.PI / 180, co = Math.cos(a), si = Math.sin(a);
    const m = [r * (.213 + co * .787 - si * .213) + g * (.715 - co * .715 - si * .715) + b * (.072 - co * .072 + si * .928), r * (.213 - co * .213 + si * .143) + g * (.715 + co * .285 + si * .140) + b * (.072 - co * .072 - si * .283), r * (.213 - co * .213 - si * .787) + g * (.715 - co * .715 + si * .715) + b * (.072 + co * .928 + si * .072)];
    return '#' + m.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); };
  const dh = mode === 'level' ? ((lvNo * 47) % 120) - 60 : 0;
  look = { wallL: hr(th.walls[wi][1], dh), wallR: hr(th.walls[wi][0], dh), floor: hr(th.floor[wi], dh * 0.5), pattern: th.pattern, accent: th.accent[wi], accent2: th.accent2[wi], furn: th.furn[wi], rug: th.rug[wi] };
  stickers = lv.stickers.map(s => ({ ...s, placed: false, pop: 0, fade: 0, shake: 0, unl: 0, peek: 0, hidden: !!s.sheet, wob: Math.random() * 6 }));
  const keys = new Set(stickers.filter(s => !s.kind).map(s => s.key));
  fixed = th.items.filter(k => !keys.has(k)).map(k => ({ key: k }));
  // draw order back→front: theme items in their authored order, then extras by depth
  order = [...th.items.map(k => stickers.find(s => !s.kind && s.key === k)).filter(Boolean), ...stickers.filter(s => s.kind).sort((a, b) => (a.a + a.b) - (b.a + b.b))];
  tray = [...stickers];
  placedN = 0; maxH = lvNo >= 5 ? 2 : 3; hearts_ = maxH; colorAmt = colorTarget = 0.3; drag = null; botMove = null; sel = null; fly = null; idleT = 0; sparks = []; winT = 0; floaters = [];
  slowT = 6; t0 = null; tm = 0; chain = 0; chainT = 0; bestChain = 0; fever = 0; perfects = 0; wandUsed = 0; peeks = 0; convT = lv.conv || 0; rushLeft = Math.round((lv.rush || 0) * 0.72); ts = 1; tsT = 0; shakeT = 0;
  bannerT = lv.tip && !seenTip(lv) ? 3.2 : 0; bannerTxt = lv.tip || ''; if (bannerT) markTip(lv);
  layout(); ui.levels(mode === 'daily' ? '★' : lvNo); ui.progress(0); setHearts(); hudPill(true);
  ttl.textContent = (mode === 'daily' ? '' : lvNo + ' · ') + lv.name + (lv.boss ? ' · BOSS' : '');
}
const seenTip = lv => (SV.get('tips', {}))[lv.tip];
const markTip = lv => { const t = SV.get('tips', {}); t[lv.tip] = 1; SV.set('tips', t); };
function layout() {
  DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
  cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const top = 100, trayTop = H * 0.735, availH = trayTop - top - 18;
  R.s = Math.min(W * 0.95 / (20.9 * C30), availH / 19.2);
  R.x = W / 2; R.y = top + 8 + 8.1 * R.s + Math.max(0, (availH - 19.2 * R.s) * 0.45);
  if (!theme) return;
  const [sc, sx] = makeCanvas(W, H); drawShell(sx, new Pen(sx), false);
  for (const f of fixed) { const it = renderItem(f); sx.drawImage(it.img, it.x, it.y, it.w, it.h); }
  shellImg = sc;
  const [gc, gx] = makeCanvas(W, H); gx.drawImage(sc, 0, 0, W, H); gx.globalCompositeOperation = 'saturation'; gx.fillStyle = '#808080'; gx.fillRect(0, 0, W, H);
  gx.globalCompositeOperation = 'source-over'; gx.globalAlpha = 0.18; gx.fillStyle = '#fff6ea'; gx.fillRect(0, 0, W, H); gx.globalAlpha = 1;
  gx.globalCompositeOperation = 'destination-in'; gx.drawImage(sc, 0, 0, W, H);
  shellGrey = gc;
  for (const s of stickers) { s.it = renderItem(s); if (s.tint) { /* ghost tint is baked in renderItem */ } }
  bgImg = makeBg();
}
function makeBg() {
  const [c, x] = makeCanvas(W, H); x.fillStyle = '#fff4e4'; x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(240,190,140,.18)';
  for (let j = 0; j < H / 70 + 1; j++) for (let i = 0; i < W / 70 + 1; i++) { const px = i * 70 + (j % 2) * 35, py = j * 70; x.beginPath(); x.ellipse(px, py + 6, 9, 7, 0, 0, 7); x.fill(); for (let k = 0; k < 4; k++) { x.beginPath(); x.arc(px - 10 + k * 6.6, py - 7 - (k % 3 ? 3 : 0), 3.6, 0, 7); x.fill(); } }
  return c;
}
addEventListener('resize', () => { if (theme && state !== 'map') layout(); });

// ------------------------------------------------------------------ HUD
const heartsEl = document.createElement('div'); heartsEl.className = 'sn-hearts'; document.body.appendChild(heartsEl);
const ttl = document.createElement('div'); ttl.className = 'sn-ttl'; document.body.appendChild(ttl);
function setHearts() { heartsEl.textContent = '❤️'.repeat(hearts_) + '🤍'.repeat(maxH - hearts_); heartsEl.style.display = state === 'map' ? 'none' : ''; }
function hudPill(force) {
  const now = performance.now(); if (!force && now - pillAt < 200) return; pillAt = now;
  if (state !== 'play') { if (force) ui.pill(''); return; }
  if (cur.rush) ui.pill('⏰ ' + Math.ceil(rushLeft)); else ui.pill('⏱ ' + Math.floor(tm) + ' / ' + cur.par);
  ui.els.pill.style.color = cur.rush ? (rushLeft < 10 ? '#ff4d4d' : '#fff') : (tm > cur.par ? '#ff4d4d' : tm > cur.par * 0.8 ? '#ffd9a0' : '#fff');
}
const style = document.createElement('style');
style.textContent = `
.hc-card .hc-play{margin-bottom:30vh!important}
.hc-pill{top:calc(54px + env(safe-area-inset-top))!important}.sn-hearts{top:calc(92px + env(safe-area-inset-top))!important}
.sn-ttl{position:fixed;top:calc(54px + env(safe-area-inset-top));left:12px;z-index:5;font:800 14px "Baloo 2",system-ui;color:#b46a35;pointer-events:none;max-width:55%}
.sn-ov{position:fixed;inset:0;z-index:20;display:flex;flex-direction:column;align-items:center;background:#fff4e4;color:#7a4a22;font-family:"Baloo 2",system-ui;overflow:hidden}
.sn-ov.card{background:rgba(120,70,30,.35);justify-content:center;padding:20px}
.sn-hid{display:none!important}
.sn-head{display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;padding:calc(14px + env(safe-area-inset-top)) 10px 6px 58px;width:100%;box-sizing:border-box}
.sn-chip{background:#fff;border-radius:18px;padding:3px 12px;font-weight:800;font-size:17px;box-shadow:0 3px 0 #f0d3b3;border:0;color:#7a4a22;font-family:inherit}
button.sn-chip{cursor:pointer}
.sn-scroll{flex:1;overflow-y:auto;width:100%;max-width:460px;padding:6px 14px calc(110px + env(safe-area-inset-bottom));-webkit-overflow-scrolling:touch}
.sn-w{margin:8px 0 4px;font-weight:800;font-size:21px;display:flex;justify-content:space-between;align-items:baseline}
.sn-w small{font-size:14px;opacity:.7}
.sn-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px 8px;padding:6px 0 18px}
.sn-node{position:relative;aspect-ratio:1;border-radius:50%;border:0;background:#f0a35e;color:#fff;font:800 20px "Baloo 2",system-ui;box-shadow:0 4px 0 #d9783a;cursor:pointer;display:flex;align-items:center;justify-content:center}
.sn-node.lock{background:#e6d6c3;box-shadow:0 4px 0 #d3bfa6;color:#b9a48c;cursor:default}
.sn-node.done{background:#8ad6a0;box-shadow:0 4px 0 #5db37a}
.sn-node.boss{background:#ff8fa3;box-shadow:0 4px 0 #e0607c}
.sn-node.boss.lock{background:#e6d6c3;box-shadow:0 4px 0 #d3bfa6}
.sn-node.next{animation:snp 1s ease-in-out infinite;background:#ffb347;box-shadow:0 4px 0 #e0902a, 0 0 0 4px #fff, 0 0 18px 4px #ffd27a}
.sn-node i{position:absolute;bottom:-17px;left:0;right:0;font-style:normal;font-size:13px;letter-spacing:0;color:#ffb800;-webkit-text-stroke:.6px #b57f00}
@keyframes snp{50%{transform:scale(1.12)}}
.sn-foot{position:fixed;bottom:0;left:0;right:0;display:flex;gap:10px;justify-content:center;padding:10px 12px calc(14px + env(safe-area-inset-bottom));background:linear-gradient(transparent,#fff4e4 40%)}
.sn-btn{white-space:nowrap;font:800 19px "Baloo 2",system-ui;color:#fff;background:#3cc46a;border:0;border-radius:40px;padding:11px 26px;box-shadow:0 5px 0 #2a9a50;cursor:pointer}
.sn-btn.alt{background:#f0a35e;box-shadow:0 5px 0 #d9783a}
.sn-btn:active{transform:translateY(3px);box-shadow:0 2px 0 rgba(0,0,0,.2)}
.sn-box{background:#fff8ee;border-radius:28px;padding:22px 22px 18px;width:min(92vw,360px);text-align:center;box-shadow:0 10px 0 rgba(160,90,40,.25);animation:snin .35s cubic-bezier(.3,1.5,.5,1)}
@keyframes snin{from{transform:scale(.7);opacity:0}}
.sn-box h2{margin:0;font-size:38px;color:#ff8a3d;line-height:1}
.sn-box p{margin:4px 0;font-weight:700;font-size:17px}
.sn-stars{font-size:46px;letter-spacing:4px;margin:6px 0;height:56px}
.sn-stars span{display:inline-block;opacity:.25;filter:grayscale(1)}
.sn-stars span.on{opacity:1;filter:none;animation:snstar .3s cubic-bezier(.3,1.8,.5,1)}
@keyframes snstar{from{transform:scale(0) rotate(-90deg)}}
.sn-row{display:flex;gap:10px;justify-content:center;margin-top:12px}
.sn-new{font-size:54px;margin:2px 0;animation:snin .6s cubic-bezier(.3,1.8,.5,1)}
.sn-alb{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;padding:8px 0}
.sn-slot{aspect-ratio:1;border-radius:14px;background:#f3e3d0;display:flex;align-items:center;justify-content:center;font-size:30px;position:relative}
.sn-slot.have{background:#fff;box-shadow:0 3px 0 #f0d3b3}.sn-slot.gold{background:#fff3b8;box-shadow:0 3px 0 #e8c84a,0 0 10px #ffe27a}
.sn-slot.q{color:#c9b39a;font-size:18px;font-weight:800}
.sn-slot small{position:absolute;bottom:1px;right:4px;font-size:10px;font-weight:800;opacity:.6}
`;
document.head.appendChild(style);
const el = (cls, html) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html || ''; document.body.appendChild(d); return d; };

// ------------------------------------------------------------------ tray geometry
const trayY = () => H * 0.735;
function slotRect(i) { const w = W / TRAY_SLOTS; return { x: i * w + w / 2, y: trayY() + (H - trayY()) * 0.5, w: w * 0.8, h: (H - trayY()) * 0.62 }; }
function trayFit(s, i) { const r = slotRect(i), it = s.it, k = Math.min(r.w / (it.w + it.B * 2), r.h / (it.h + it.B * 2), 1.15); return { x: r.x, y: r.y, k }; }
const isLocked = s => !!s.lock && !stickers.find(o => o.id === s.lock)?.placed;
const wandRect = () => ({ x: W - 96, y: trayY() - 20, w: 82, h: 38 });
const baseName = s => { const b = stickers.find(o => o.id === s.lock); return b ? (NAMES[b.key] || b.kind || 'base') : ''; };

// ------------------------------------------------------------------ input
input({
  onDown: (e) => {
    if (state !== 'play' || botMove || fly) return;
    idleT = 0;
    const wr = wandRect(); if (e.clientX > wr.x && e.clientX < wr.x + wr.w && e.clientY > wr.y && e.clientY < wr.y + wr.h) { wandHit = true; useWand(); return; }
    if (e.clientY < trayY()) return;
    const i = Math.floor(e.clientX / (W / TRAY_SLOTS)); const s = tray[i]; if (!s) return;
    if (isLocked(s)) { s.shake = 0.5; tone(200, 0.1, 'square', 0.06, 0.8); buzz(10); floatText('🔒 ' + baseName(s) + ' first', W / 2, trayY() - 30, '#b46a35', 22); return; }
    if (t0 === null) t0 = performance.now();
    const f = trayFit(s, i);
    drag = { s, x: f.x, y: f.y, k: f.k, tx: e.clientX, ty: e.clientY - 70, fromI: i, snapped: false }; sfx.tap(); buzz(6); tone(700, 0.05, 'triangle', 0.08, 1.4);
  },
  onMove: (dx, dy, e) => { if (!drag) return; drag.tx = e.clientX; drag.ty = e.clientY - 70; },
  onTap: (e) => {
    if (wandHit) { wandHit = false; return; }
    if (state !== 'play' || botMove || fly) return;
    if (drag) { sel = sel === drag.s ? null : drag.s; drag = null; return; }
    if (e.clientY >= trayY()) return;
    if (!sel) { peekAt(e.clientX, e.clientY); return; }
    const i = tray.indexOf(sel), f = trayFit(sel, Math.max(0, i));
    fly = { s: sel, x: f.x, y: f.y - 16, k: f.k * 1.15, tx: e.clientX, ty: e.clientY, fly: true }; sel = null; sfx.tap(); buzz(6);
  },
  onUp: () => { wandHit = false; if (!drag) return; drop(drag); drag = null; },
});
function peekAt(x, y) {
  for (const s of stickers) { if (s.placed || !s.hidden) continue; const it = s.it; if (x > it.x && x < it.x + it.w && y > it.y && y < it.y + it.h) {
    s.peek = 1.5; s.peeked = true; peeks++; sfx.tap(); tone(520, 0.12, 'sine', 0.07, 1.6); buzz(8); floatText('👀', it.cx, it.y, '#fff', 30); return; } }
}
function snapR(s) { const it = s.it; return Math.max(40, Math.min(it.w, it.h) * 0.45 / fk) * (fever > 0 ? 1.4 : 1); }
function drop(d) {
  const s = d.s, it = s.it, snap = snapR(s), dist = Math.min(Math.hypot(d.x - it.cx, d.y - it.cy), d.ty !== undefined ? Math.hypot(d.tx - it.cx, d.ty + 70 - it.cy) : 1e9); // finger OR sticker on the spot counts
  if (dist < snap) return place(s, dist < snap * 0.4);
  const other = stickers.find(o => !o.placed && o !== s && Math.hypot(d.x - o.it.cx, d.y - o.it.cy) < Math.max(40, Math.min(o.it.w, o.it.h) * 0.35));
  if (other) {
    hearts_--; setHearts(); buzz([30, 30, 30]); tone(180, 0.18, 'square', 0.08, 0.7); floatText(hearts_ === 1 ? 'ONE LEFT!!' : 'Not there!', other.it.cx, other.it.cy, '#ff5d5d', hearts_ === 1 ? 40 : 28); shakeT = hearts_ === 1 ? 0.9 : 0.5; other.shake = 0.6; if (hearts_ === 1) { ts = 0.4; tsT = 0.5; ui.flash(0.4); buzz([60, 40, 60]); tone(140, 0.3, 'sawtooth', 0.1, 0.6); }
    if (chain > 1) floatText('chain lost', W / 2, R.y + 3 * R.s, '#b46a35', 20); chain = 0; chainT = 0; fever = 0;
    if (hearts_ <= 0 && state === 'play') lose('OOPS!', 'Three stickers on the wrong spot');
  } else tone(330, 0.07, 'sine', 0.06, 0.8);
  s.back = { x: d.x, y: d.y, t: 0 };
}
function floatText(text, x, y, col = '#fff', size = 24) { floaters.push({ text, x, y, vy: -0.9, life: 1, col, size }); }

// ------------------------------------------------------------------ placing
function place(s, perfect) {
  if (t0 === null) t0 = performance.now(); touchDay();
  const it = s.it; s.placed = true; s.pop = 1; s.fade = 1; s.hidden = false; placedN++; tray.splice(tray.indexOf(s), 1); trayShift = 1;
  chain = chainT > 0 ? chain + 1 : 1; chainT = perfect ? CHAIN_WIN + 0.8 : CHAIN_WIN; bestChain = Math.max(bestChain, chain); if (perfect) perfects++;
  if (chain === 5 && fever <= 0) { fever = 6; floatText('COZY FEVER!', W / 2, R.y + 2 * R.s, '#ff8a3d', 40); sfx.win && 0; tone(880, 0.3, 'triangle', 0.12, 1.6); ts = 0.45; tsT = 0.35; ui.flash(0.5); }
  else if (fever > 0) fever = Math.min(9, fever + 1);
  colorTarget = 0.3 + 0.7 * placedN / stickers.length;
  const ci = Math.min(PENTA.length - 3, chain - 1);
  note(PENTA[ci], 0.5, 0.2); setTimeout(() => note(PENTA[Math.min(PENTA.length - 1, ci + 2)], 0.4, 0.12), 90); if (perfect) setTimeout(() => note(PENTA[Math.min(PENTA.length - 1, ci + 4)], 0.3, 0.1), 180);
  buzz(perfect ? [14, 20, 14] : 14);
  if (perfect || chain >= 3) shakeT = Math.max(shakeT, perfect ? 0.22 : 0.14); // placement thump
  const n = fever > 0 ? 28 : 16;
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = 1.5 + Math.random() * (fever > 0 ? 5 : 3); sparks.push({ x: it.cx, y: it.cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5, life: 1, c: ['#ffd23f', '#ff8fab', '#8ad6ff', '#ffffff', '#9be38f'][i % 5], star: i % 3 === 0 }); }
  if (perfect) { sparks.push({ ring: true, x: it.cx, y: it.cy, life: 1, vx: 0, vy: 0, c: '#ffffff' }); floatText('PERFECT', it.cx, it.cy - it.h * 0.3, '#fff', 26); }
  if (chain >= 2) floatText('x' + chain, it.cx + (perfect ? 0 : 0), it.cy - (perfect ? it.h * 0.3 + 30 : it.h * 0.3), chain >= 5 ? '#ffd23f' : '#ffe9c2', 24 + Math.min(18, chain * 3));
  if (s.sheet && !s.peeked) floatText('Lucky!', it.cx, it.cy, '#fff', 26);
  // unlock stickers taped to this one
  for (const o of stickers) if (o.lock === s.id && !o.placed) { o.unl = 1; tone(660, 0.12, 'triangle', 0.1, 1.5); setTimeout(() => tone(990, 0.12, 'triangle', 0.1, 1.2), 80); floatText('🔓', W * 0.5, trayY() - 20, '#fff', 30); }
  ui.progress(placedN / stickers.length);
  if (placedN === stickers.length && state === 'play') win();
}
function stats() {
  const t = tm, lostH = maxH - hearts_;
  const n = 1 + (lostH <= 1 ? 1 : 0) + (lostH === 0 && !wandUsed && t <= cur.par * (lvNo <= 2 ? 0.7 : 0.6) && bestChain >= Math.min(6, Math.ceil(stickers.length * 0.6)) ? 1 : 0);
  return { t, n };
}
function win() {
  state = 'won'; const { t, n } = stats(); F.level(true); winT = 0.001;
  const key = mode === 'daily' ? 'd' + dayNo() : mode === 'level' ? String(lvNo) : 'e' + lvNo;
  const st = stars(), prev = st[key] || 0, first = !prev; st[key] = Math.max(prev, n);
  if (mode === 'level' || mode === 'daily') SV.set('stars', st); else SV.set('stars', st);
  if (mode === 'daily') { if (SV.get('dailyDone', 0) !== dayNo()) { SV.set('dailyDone', dayNo()); SV.set('wands', wands() + 1); wasNewClear = true; WB.submit(1); } else wasNewClear = false; }
  else if (first) { wasNewClear = true; WB.submit(1); } else wasNewClear = false;
  if (mode === 'endless' && first) SV.set('endless', lvNo + 1);
  // chest every 6 stars
  const tot = totalStars(), chestsHad = SV.get('chests', 0), chestsDue = Math.floor(tot / 6); let chest = null;
  if (chestsDue > chestsHad) { SV.set('chests', chestsDue); const r = Math.random(); chest = r < 0.07 ? 5 : r < 0.4 ? 2 : 1; SV.set('wands', wands() + chest); }
  const boss = cur.boss; const ms = boss ? 700 : 250;
  if (boss) { ts = 0.3; tsT = 0.7; }
  setTimeout(() => { sfx.win(); buzz([20, 40, 20]); for (let i = 0; i < (boss ? 160 : 90); i++) { const a = Math.random() * 6.28, v = 2 + Math.random() * 6; sparks.push({ x: W / 2, y: R.y + 6 * R.s, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 4, life: 1.6, c: ['#ffd23f', '#ff8fab', '#8ad6ff', '#9be38f', '#b39ddb'][i % 5], conf: true, rot: Math.random() * 6 }); } }, ms);
  setTimeout(() => resultCard({ n, prev, first, t, chest }), ms + 700);
}
function lose(title, line) {
  state = 'lost'; F.level(false, placedN / stickers.length); sfx.fail();
  const left = stickers.length - placedN;
  setTimeout(() => loseCard(title, line, left), 600);
}

// ------------------------------------------------------------------ wand (helper): presses the first free tray sticker
function useWand() {
  if (state !== 'play' || botMove || drag || fly) return;
  if (wands() <= 0) { floatText('no wands yet', W - 60, trayY() - 40, '#b46a35', 18); tone(200, 0.1, 'square', 0.05, 0.8); return; }
  const s = tray.slice(0, TRAY_SLOTS).find(x => !isLocked(x)); if (!s) return;
  SV.set('wands', wands() - 1); wandUsed++;
  const f = trayFit(s, tray.indexOf(s)); botMove = { s, sx: f.x, sy: f.y, x: f.x, y: f.y, k: f.k, t: 0, wand: true }; tone(900, 0.2, 'triangle', 0.1, 1.8); buzz(10);
}

// the first seconds play themselves on the very first level (Oct 26: under-1-minute players left within 10 s)
demo(() => { const s = tray[0], f = trayFit(s, 0); botMove = { s, sx: f.x, sy: f.y, x: f.x, y: f.y, k: f.k, t: 0, demo: true }; tone(700, 0.05, 'triangle', 0.08, 1.4); return false; },
  { ready: () => state === 'play' && mode === 'level' && lvNo === 1 && placedN === 0 && tray.length > 1 && !botMove && !drag && !fly && !sel, max: 1 });

// ------------------------------------------------------------------ screens: map, album, result, lose
let mapEl = null, cardEl = null, albEl = null;
function closeCard() { if (cardEl) { cardEl.remove(); cardEl = null; } }
function tomorrowLine() { const sk = Math.max(1, streak()); return `Tomorrow: Daily Room #${dayNo() - DAY0 + 2} · 🔥 day ${sk + (SV.get('last', 0) === dayNo() ? 1 : 0)}`; }
function resultCard({ n, prev, first, t, chest }) {
  closeCard();
  const album = mode === 'level' ? EMOJI[lvNo - 1] : mode === 'daily' ? '🌟' : '🏅';
  const newSticker = mode === 'level' && (first || (n === 3 && prev < 3));
  cardEl = el('sn-ov card', `<div class="sn-box"><p>${cur.name}${cur.boss ? ' · BOSS' : ''}</p><h2>${n === 3 ? 'PERFECT HOME!' : n === 2 ? 'SO COZY!' : 'DECORATED!'}</h2>
    <div class="sn-stars">${[1, 2, 3].map(i => `<span data-i="${i}">⭐</span>`).join('')}</div>
    <p>⏱ ${t.toFixed(1)}s <small>(par ${cur.par}s)</small> · best chain x${bestChain}${perfects ? ' · ✨' + perfects : ''}</p>
    ${newSticker ? `<div class="sn-new">${album}</div><p>${n === 3 ? 'GOLD sticker for your album!' : 'New album sticker!'}</p>` : ''}
    ${chest ? `<div class="sn-new">🎁</div><p>Chest! +${chest} 🪄 ${chest >= 5 ? 'JACKPOT!' : ''}</p>` : ''}
    ${n < 3 ? `<p style="color:#ff8a3d">${n === 1 ? (maxH - hearts_ > 1 ? 'No wrong spots next time → ⭐⭐' : '⭐⭐⭐: no wrong spots, under ' + Math.round(cur.par * (lvNo <= 2 ? 0.7 : 0.6)) + 's and a big chain') : t > cur.par * (lvNo <= 2 ? 0.7 : 0.6) ? 'So close! ' + (t - cur.par * (lvNo <= 2 ? 0.7 : 0.6)).toFixed(0) + 's over for ⭐⭐⭐' : 'One more try for ⭐⭐⭐'}</p>` : ''}
    ${chest ? '' : `<p style="font-size:15px;color:#b46a35">🎁 ${6 - totalStars() % 6} ⭐ to the next chest</p>`}
    ${n >= 2 ? `<p style="font-size:14px;opacity:.75">${tomorrowLine()}</p>` : ''}
    <div class="sn-row">${n < 3 ? '<button class="sn-btn alt" data-a="retry">🔄</button>' : ''}<button class="sn-btn" data-a="next">${mode === 'daily' ? 'Map' : 'Next ▶'}</button></div></div>`);
  const spans = cardEl.querySelectorAll('.sn-stars span'); spans.forEach((sp, i) => { if (i < n) setTimeout(() => { sp.classList.add('on'); tone(600 + i * 160, 0.16, 'triangle', 0.12, 1.3); buzz(10); }, 30 + i * 170); });
  cardEl.addEventListener('pointerdown', e => { e.stopPropagation(); const a = e.target.closest('[data-a]'); if (!a) return; e.preventDefault();
    if (a.dataset.a === 'retry') startAgain(); else nextLevel(); });
}
function loseCard(title, line, left) {
  closeCard();
  cardEl = el('sn-ov card', `<div class="sn-box"><h2>${title}</h2><p>${line}</p>${left <= 3 && left > 0 && placedN > 0 ? `<p style="color:#ff8a3d;font-size:22px">SO CLOSE: ${left} left!</p>` : ''}
    <div class="sn-row"><button class="sn-btn" data-a="retry">🔄 Again</button><button class="sn-btn alt" data-a="map">Map</button></div></div>`);
  cardEl.addEventListener('pointerdown', e => { e.stopPropagation(); const a = e.target.closest('[data-a]'); closeCard(); if (a && a.dataset.a === 'map') openMap(); else startAgain(); });
}
function startAgain() { closeCard(); begin(lvNo, mode); }
function nextLevel() {
  closeCard();
  if (mode === 'daily') return openMap();
  if (mode === 'endless') return begin(lvNo + 1, 'endless');
  if (lvNo === 10 || lvNo === 20 || lvNo === 30) return openMap();    // a world is done: back to the map to see it
  begin(lvNo + 1, lvNo + 1 > LEVELS.length ? 'endless' : 'level');
}
function begin(n, m) { closeMap(); closeAlbum(); closeCard(); lvNo = n; mode = m; state = 'play'; buildLevel(m === 'daily' ? dailyLevel() : levelSpec(n)); ui.hideStart(); }
function closeMap() { if (mapEl) { mapEl.remove(); mapEl = null; } }
function closeAlbum() { if (albEl) { albEl.remove(); albEl = null; } }
function openMap() {
  closeMap(); closeCard(); state = 'map'; setHearts(); ui.pill(''); ui.hideStart(); ttl.textContent = '';
  const st = stars(), up = unlockedTo(), dd = SV.get('dailyDone', 0) === dayNo();
  let html = `<div class="sn-head"><span class="sn-chip">⭐ ${totalStars()}</span><span class="sn-chip">🪄 ${wands()}</span><span class="sn-chip">🔥 ${Math.max(0, streak())}</span><button class="sn-chip" data-a="album">📖 ${Object.keys(st).filter(k => /^\d+$/.test(k) && +k <= 30).length}/30</button></div><div class="sn-scroll">`;
  WORLDS.forEach((w, wi) => {
    const lo = wi * 10 + 1, got = Array.from({ length: 10 }, (_, i) => st[lo + i] || 0).reduce((a, b) => a + b, 0);
    html += `<div class="sn-w"><span>${w.icon} ${w.name}</span><small>⭐ ${got}/30</small></div><div class="sn-grid">`;
    for (let i = 0; i < 10; i++) { const n = lo + i, s = st[n] || 0, lock = n > up, boss = i === 9;
      html += `<button class="sn-node ${lock ? 'lock' : s ? 'done' : 'next'} ${boss ? 'boss' : ''}" data-n="${n}" style="${boss ? 'grid-column:span 1' : ''}">${lock ? '🔒' : boss ? '👑' : n}${s ? `<i>${'★'.repeat(s)}${'☆'.repeat(3 - s)}</i>` : ''}</button>`; }
    html += '</div>';
  });
  if (up > 30 || st[30]) html += `<div class="sn-w"><span>♾️ Endless rooms</span><small>room ${SV.get('endless', 31)}</small></div><div class="sn-grid"><button class="sn-node next" data-a="endless">∞</button></div>`;
  html += '</div>';
  html += `<div class="sn-foot"><button class="sn-btn alt" data-a="daily">${dd ? '✅ Daily room' : '🎁 Daily Room #' + (dayNo() - DAY0 + 1)}</button><button class="sn-btn" data-a="play">Play ▶</button></div>`;
  mapEl = el('sn-ov', html);
  const nx = mapEl.querySelector('.sn-node.next'); if (nx) setTimeout(() => nx.scrollIntoView({ block: 'center' }), 30);
  mapEl.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const a = b.dataset.a;
    if (b.dataset.n) { const n = +b.dataset.n; if (n <= up) { sfx.tap(); begin(n, 'level'); } else { tone(200, 0.1, 'square', 0.05, 0.8); b.style.animation = 'snp .2s 2'; } }
    else if (a === 'play') begin(Math.min(up, 30) <= 30 && up <= 30 ? up : SV.get('endless', 31), up <= 30 ? 'level' : 'endless');
    else if (a === 'daily') begin(0, 'daily');
    else if (a === 'endless') begin(SV.get('endless', 31), 'endless');
    else if (a === 'album') openAlbum();
  });
}
function openAlbum() {
  closeAlbum(); const st = stars();
  let html = `<div class="sn-head"><button class="sn-chip" data-a="back">◀ Map</button><span class="sn-chip">📖 Sticker album</span></div><div class="sn-scroll"><p style="text-align:center;font-weight:700;margin:4px 0">Finish a room for its sticker · 3 stars makes it gold</p><div class="sn-alb">`;
  for (let i = 1; i <= 30; i++) { const s = st[i] || 0; html += `<div class="sn-slot ${s ? (s === 3 ? 'gold' : 'have') : 'q'}">${s ? EMOJI[i - 1] : '?'}<small>${i}</small></div>`; }
  html += '</div></div>';
  albEl = el('sn-ov', html); albEl.style.zIndex = 21;
  albEl.addEventListener('click', e => { if (e.target.closest('[data-a="back"]')) closeAlbum(); });
}
ui.onTap(w => { if (w === 'start') { if (totalStars() === 0 && !stars()[1]) begin(1, 'level'); else openMap(); } });

// ------------------------------------------------------------------ render
function drawSticker(s, x, y, k, lift = 0, rot = 0) {
  const it = s.it, w = (it.w + it.B * 2) * k, h = (it.h + it.B * 2 + 4) * k;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  if (lift) { ctx.globalAlpha = 0.18; ctx.fillStyle = '#5b4636'; ctx.beginPath(); ctx.ellipse(0, h * 0.42 + lift, w * 0.36, h * 0.07, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
  ctx.drawImage(it.stk, -w / 2, -h / 2 - lift, w, h); ctx.restore();
}
function drawTape(s, x, y, k, t) {       // locked sticker: dulled + tape + padlock
  const it = s.it, w = (it.w + it.B * 2) * k, h = (it.h + it.B * 2 + 4) * k;
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = 'rgba(244,228,205,.55)'; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 12); ctx.fill();
  ctx.rotate(-0.5); ctx.fillStyle = 'rgba(233,196,120,.92)'; ctx.fillRect(-w * 0.62, -7, w * 1.24, 14); ctx.strokeStyle = 'rgba(160,110,40,.5)'; ctx.lineWidth = 1.5; ctx.strokeRect(-w * 0.62, -7, w * 1.24, 14);
  ctx.rotate(1.0); ctx.fillRect(-w * 0.62, -7, w * 1.24, 14); ctx.strokeRect(-w * 0.62, -7, w * 1.24, 14); ctx.restore();
  ctx.font = '24px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🔒', x, y);
}
const elastic = t => t >= 1 ? 1 : 1 - Math.pow(2, -9 * t) * Math.cos(t * 14);
loop((dt0, t) => {
  if (!theme || !shellImg || state === 'map') return;
  tsT = Math.max(0, tsT - dt0 / 60); if (tsT === 0) ts = lerp(ts, 1, 0.2);
  const dt = dt0 * ts, sec = dt / 60;
  if (state === 'play') {
    if (t0 !== null) { tm += dt0 / 60; if (rushLeft > 0 && !drag0()) { } }
    if (t0 !== null && cur.rush) { rushLeft -= dt0 / 60; if (rushLeft <= 0) { rushLeft = 0; lose('TIME\'S UP!', 'The guests arrived'); } }
    if (t0 !== null && mode === 'level' && lvNo >= 5 && !cur.rush && tm > cur.par * 1.2 && !drag && !botMove) { slowT -= dt0 / 60; if (slowT <= 0) { slowT = 6; hearts_--; setHearts(); buzz([30, 30]); tone(200, 0.2, 'square', 0.08, 0.7); floatText('TOO SLOW!', W / 2, R.y + 3 * R.s, '#ff5d5d', 32); shakeT = 0.4; if (hearts_ <= 0) lose('TOO SLOW!', 'The room took too long'); } }
    if (chainT > 0) { chainT -= dt0 / 60; if (chainT <= 0) { if (chain >= 2) floatText('chain ended', W / 2, R.y + 3 * R.s, '#b46a35', 18); chain = 0; } }
    if (fever > 0) { fever -= dt0 / 60; if (fever <= 0) { fever = 0; floatText('fever over', W / 2, R.y + 2 * R.s, '#b46a35', 20); } }
    if (cur.conv && t0 !== null && !drag && !botMove && !fly && !sel && tray.length > 3) { convT -= dt0 / 60; if (convT <= 0) { convT = cur.conv; tray.push(tray.shift()); trayShift = 1; tone(420, 0.05, 'triangle', 0.05, 1.2); } }
    hudPill();
  }
  colorAmt = lerp(colorAmt, colorTarget, 0.06 * dt); shakeT = Math.max(0, shakeT - sec); trayShift = Math.max(0, trayShift - sec * 4); bannerT = Math.max(0, bannerT - sec);
  if (state === 'play' && !drag && !botMove) idleT += sec;
  ctx.drawImage(bgImg, 0, 0, W, H);
  const sh = shakeT > 0 ? Math.sin(t * 60) * 5 * shakeT : 0;
  ctx.save(); ctx.translate(sh, 0);
  ctx.drawImage(shellGrey, 0, 0, W, H); ctx.globalAlpha = colorAmt; ctx.drawImage(shellImg, 0, 0, W, H); ctx.globalAlpha = 1;
  const nearest = drag && !drag.s.placed ? drag.s : null;
  for (const s of order) {
    const it = s.it;
    if (!s.placed) {
      s.peek = Math.max(0, s.peek - sec);
      const target = (drag && drag.s === s) || (botMove && botMove.s === s) || sel === s || (fly && fly.s === s), pulse = target ? 0.65 + Math.sin(t * 8) * 0.35 : (0.85 + Math.sin(t * 2.5 + it.cx) * 0.15) * (lvNo >= 12 && mode === 'level' ? 0.6 : 1);
      if (s.hidden && s.peek <= 0) {                // dust sheet over the spot
        const w = it.w * 0.96, h = it.h * 0.9, cx = it.cx, cy = it.cy + it.h * 0.04, b = Math.sin(t * 2 + s.wob) * 2;
        ctx.save(); ctx.fillStyle = '#fbf7ff'; ctx.strokeStyle = '#cfc3dc'; ctx.lineWidth = 2.5; ctx.beginPath();
        ctx.moveTo(cx - w / 2, cy + h / 2); ctx.quadraticCurveTo(cx - w / 2 - 6, cy - h * 0.2, cx - w * 0.2, cy - h / 2 + 4 + b); ctx.quadraticCurveTo(cx, cy - h / 2 - 8 + b, cx + w * 0.22, cy - h / 2 + 4 + b); ctx.quadraticCurveTo(cx + w / 2 + 6, cy - h * 0.2, cx + w / 2, cy + h / 2);
        for (let i = 4; i >= 0; i--) ctx.quadraticCurveTo(cx - w / 2 + (i + 0.5) * w / 5, cy + h / 2 + (i % 2 ? 10 : -2), cx - w / 2 + i * w / 5, cy + h / 2); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#b7a9c9'; ctx.font = '800 ' + Math.min(34, h * 0.4) + 'px "Baloo 2",system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', cx, cy + 2); ctx.restore();
      } else {
        const fa = s.hidden ? Math.min(1, s.peek * 2) : 1;
        ctx.globalAlpha = pulse * fa * (fever > 0 && !target ? 1 : 1); ctx.drawImage(it.ghost, it.x, it.y, it.w, it.h); ctx.globalAlpha = 1;
      }
      if (target) { ctx.save(); ctx.globalAlpha = 0.5 + Math.sin(t * 8) * 0.3; ctx.strokeStyle = '#ffffff'; ctx.setLineDash([7, 6]); ctx.lineDashOffset = -t * 30; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(it.x + 4, it.y + 4, it.w - 8, it.h - 8, 14); ctx.stroke(); ctx.restore(); }
      continue;
    }
    s.pop = Math.max(0, s.pop - sec * 1.8); s.fade = Math.max(0, s.fade - sec * 2.2);
    const k = s.pop > 0 ? 0.75 + 0.25 * elastic(1 - s.pop) + (s.pop > 0.8 ? 0.2 : 0) : 1;
    ctx.save(); ctx.translate(it.cx, it.cy); ctx.scale(k, k);
    if (s.fade > 0) { ctx.globalAlpha = s.fade; const bw = it.w + it.B * 2, bh = it.h + it.B * 2 + 4; ctx.drawImage(it.stk, -bw / 2, -bh / 2, bw, bh); ctx.globalAlpha = 1; }
    ctx.drawImage(it.img, -it.w / 2, -it.h / 2, it.w, it.h); ctx.restore();
  }
  // snap-range hint: the target spot lights up when the sticker is close
  if (drag) { const s = drag.s, it = s.it, d = Math.hypot(drag.x - it.cx, drag.y - it.cy), sn = snapR(s); const near = d < sn;
    if (near && !drag.snapped) { drag.snapped = true; tone(880, 0.04, 'sine', 0.05, 1.1); buzz(5); } else if (!near) drag.snapped = false;
    if (near) { ctx.save(); ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 14); ctx.strokeStyle = d < sn * 0.4 ? '#ffd23f' : '#ffffff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(it.cx, it.cy, it.w * 0.55, it.h * 0.55, 0, 0, 7); ctx.stroke(); ctx.restore(); } }
  ctx.restore();
  if (fever > 0) { const g = ctx.createRadialGradient(W / 2, H * 0.4, W * 0.2, W / 2, H * 0.4, W * 0.8); g.addColorStop(0, 'rgba(255,210,100,0)'); g.addColorStop(1, `rgba(255,170,60,${0.28 + 0.1 * Math.sin(t * 10)})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  // tray
  const ty = trayY();
  ctx.fillStyle = '#ffd9b3'; ctx.beginPath(); ctx.roundRect(-20, ty, W + 40, H - ty + 40, 34); ctx.fill();
  ctx.fillStyle = '#ffcd9e'; ctx.fillRect(0, ty + 24, W, 3);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#e8a46a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(14, ty - 18, 76, 34, 12); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#9a5b2c'; ctx.font = '800 19px "Baloo 2",system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${placedN}/${stickers.length}`, 52, ty);
  const wr = wandRect(); ctx.fillStyle = wands() > 0 ? '#fff' : '#f3e3d0'; ctx.beginPath(); ctx.roundRect(wr.x, wr.y, wr.w, wr.h, 12); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#9a5b2c'; ctx.fillText('🪄 ' + wands(), wr.x + wr.w / 2, wr.y + wr.h / 2 + 1);
  if (cur.conv && tray.length > 3) { const p = 1 - convT / cur.conv; ctx.fillStyle = '#f3c9a0'; ctx.beginPath(); ctx.roundRect(W / 2 - 50, ty - 12, 100, 8, 4); ctx.fill(); ctx.fillStyle = '#ff8a3d'; ctx.beginPath(); ctx.roundRect(W / 2 - 50, ty - 12, 100 * clamp(p, 0, 1), 8, 4); ctx.fill(); ctx.font = '14px system-ui'; ctx.fillStyle = '#9a5b2c'; ctx.fillText('↻', W / 2 - 62, ty - 8); }
  tray.slice(0, TRAY_SLOTS).forEach((s, i) => {
    if ((drag && drag.s === s) || (botMove && botMove.s === s) || (fly && fly.s === s)) return;
    const f = trayFit(s, i), off = trayShift * (W / TRAY_SLOTS);
    let x = f.x + off, y = f.y + Math.sin(t * 2 + i) * 2;
    s.shake = Math.max(0, s.shake - sec); if (s.shake > 0) x += Math.sin(t * 70) * 7 * s.shake;
    if (s === sel) { y -= 16; ctx.save(); ctx.globalAlpha = 0.55 + Math.sin(t * 8) * 0.3; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, (W / TRAY_SLOTS) * 0.42, 0, 7); ctx.stroke(); ctx.restore(); drawSticker(s, x, y, f.k * 1.15, 8, Math.sin(t * 6) * 0.06); return; }
    if (s.back) { s.back.t = Math.min(1, s.back.t + sec * 4); const e = 1 - Math.pow(1 - s.back.t, 3); x = lerp(s.back.x, x, e); y = lerp(s.back.y, y, e); if (s.back.t >= 1) s.back = null; }
    drawSticker(s, x, y, f.k, 0, Math.sin(t * 1.5 + i) * 0.03);
    if (isLocked(s)) drawTape(s, x, y, f.k, t);
    else if (s.unl > 0) { s.unl = Math.max(0, s.unl - sec * 2); ctx.save(); ctx.globalAlpha = s.unl; ctx.translate(x, y - (1 - s.unl) * 40); ctx.rotate((1 - s.unl) * 0.8); ctx.fillStyle = 'rgba(233,196,120,.95)'; ctx.fillRect(-40, -7, 80, 14); ctx.restore(); }
  });
  // dragged / bot-moved sticker (full room size, lifted)
  const mv = drag || botMove || fly;
  if (mv) {
    if (botMove) { botMove.t = Math.min(1, botMove.t + sec * 2.4); const e = botMove.t < 0.5 ? 4 * botMove.t ** 3 : 1 - Math.pow(-2 * botMove.t + 2, 3) / 2; botMove.x = lerp(botMove.sx, botMove.s.it.cx, e); botMove.y = lerp(botMove.sy, botMove.s.it.cy, e) - Math.sin(e * Math.PI) * 60; }
    else { mv.x = lerp(mv.x, mv.tx, 0.4); mv.y = lerp(mv.y, mv.ty, 0.4); }
    mv.k = lerp(mv.k, 1, 0.25);
    drawSticker(mv.s, mv.x, mv.y, mv.k, 8, Math.sin(t * 6) * 0.04);
    if (mv === fly && Math.hypot(fly.x - fly.tx, fly.y - fly.ty) < 3) { const d = fly; fly = null; drop(d); }
    if (botMove) { ctx.font = '42px system-ui'; ctx.textAlign = 'center'; if (!botMove.demo && !botMove.wand) ctx.fillText('👆', botMove.x + 10, botMove.y + 60); if (botMove.wand) ctx.fillText('🪄', botMove.x + 10, botMove.y + 10); if (botMove.t >= 1) { const s = botMove.s; botMove = null; place(s, false); } }
  }
  // idle hint: ghost hand drags from the first free tray sticker to its spot
  const hs = tray.slice(0, TRAY_SLOTS).find(x => !isLocked(x));
  if (state === 'play' && idleT > (lvNo === 1 && mode === 'level' ? 0.9 : 4) && hs && !drag && !sel && !fly) {
    const f = trayFit(hs, tray.indexOf(hs)), k = ((idleT - (lvNo === 1 && mode === 'level' ? 0.9 : 4)) % 1.6) / 1.6, e = k * k * (3 - 2 * k), it = hs.it;
    ctx.globalAlpha = Math.sin(k * Math.PI); ctx.font = '44px system-ui'; ctx.textAlign = 'center'; ctx.fillText('👆', lerp(f.x, it.cx, e) + 8, lerp(f.y, it.cy, e) + 40); ctx.globalAlpha = 1;
  }
  // chain meter
  if (state === 'play' && chain >= 2) { const w = 120, x = W / 2 - w / 2, y = 104; ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.roundRect(x, y, w, 8, 4); ctx.fill(); ctx.fillStyle = fever > 0 ? '#ffb000' : '#ff8a3d'; ctx.beginPath(); ctx.roundRect(x, y, w * clamp(chainT / (CHAIN_WIN + 0.8), 0, 1), 8, 4); ctx.fill();
    ctx.fillStyle = fever > 0 ? '#e08a00' : '#b46a35'; ctx.font = '800 18px "Baloo 2",system-ui'; ctx.textAlign = 'center'; ctx.fillText((fever > 0 ? '🔥 ' : '') + 'chain x' + chain, W / 2, y - 8); }
  // banner for a new mechanic
  if (bannerT > 0 && bannerTxt) { ctx.save(); ctx.globalAlpha = Math.min(1, bannerT); ctx.font = '60px system-ui'; ctx.textAlign = 'center'; ctx.fillText(bannerTxt, W / 2, R.y + 8 * R.s); ctx.restore(); }
  // sparkles + confetti + rings
  for (const p of sparks) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.conf ? 0.12 : 0.08) * dt; p.vx *= 0.985; p.life -= sec * (p.conf ? 0.6 : p.ring ? 2.2 : 1.4);
    ctx.globalAlpha = clamp(p.life, 0, 1); ctx.fillStyle = p.c;
    if (p.ring) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 4 * p.life; ctx.beginPath(); ctx.arc(p.x, p.y, 20 + (1 - p.life) * 70, 0, 7); ctx.stroke(); }
    else if (p.conf) { p.rot += 0.1 * dt; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-5, -3, 10, 6); ctx.restore(); }
    else if (p.star) { star(p.x, p.y, 7 * p.life + 2); } else { ctx.beginPath(); ctx.arc(p.x, p.y, 3.5 * p.life + 1, 0, 7); ctx.fill(); }
  }
  ctx.globalAlpha = 1; sparks = sparks.filter(p => p.life > 0);
  for (const f of floaters) { f.y += f.vy * dt; f.life -= sec * 1.1; ctx.globalAlpha = clamp(f.life * 1.5, 0, 1); ctx.font = `800 ${f.size}px "Baloo 2",system-ui`; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = '#d9783a'; ctx.lineJoin = 'round'; ctx.strokeText(f.text, f.x, f.y); ctx.fillStyle = f.col; ctx.fillText(f.text, f.x, f.y); }
  ctx.globalAlpha = 1; floaters = floaters.filter(f => f.life > 0);
});
const drag0 = () => !!drag;
function star(x, y, r) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }

// first paint: build level 1 behind the start card so the room is visible
levelSpec(1); buildLevel(levelSpec(Math.min(unlockedTo(), 30))); lvNo = Math.min(unlockedTo(), 30); state = 'ready';
ui.start();
document.querySelector('.sn-ttl').textContent = '';

// ------------------------------------------------------------------ test hooks + bot
window.__game = {
  get state() { return state; }, get level() { return lvNo; }, get score() { return placedN; }, get stars() { return stars(); },
  start(n, m = 'level') { begin(n, m); }, map() { openMap(); },
  bot() {
    if (state !== 'play' || botMove || drag || fly || !tray.length) return;
    const s = tray.slice(0, TRAY_SLOTS).find(x => !isLocked(x)); if (!s) { window.__stuck = true; return; }
    const f = trayFit(s, tray.indexOf(s)); botMove = { s, sx: f.x, sy: f.y, x: f.x, y: f.y, k: f.k, t: 0 };
  },
  spot() { const s = tray.slice(0, 3).find(x => !isLocked(x)); const i = tray.indexOf(s), f = trayFit(s, i), o = stickers.find(x => !x.placed && x !== s); return { from: [f.x, f.y], to: [s.it.cx, s.it.cy], wrong: o ? [o.it.cx, o.it.cy] : null, locked: tray.slice(0, 3).map(isLocked), hidden: stickers.filter(x => x.hidden && !x.placed).map(x => [x.it.cx, x.it.cy]) }; },
  get info() { return { placedN, n: stickers.length, hearts: hearts_, chain, bestChain, fever, tm, par: cur && cur.par }; },
};
