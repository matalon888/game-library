// Sticky Nook — original cosy sticker-decorating game. Peel stickers off the tray and press them onto their outlined
// spots in an isometric dollhouse room; every sticker brings the room's colour back.
import { createUI, input, loop, sfx, tone, note, buzz, store, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';

import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
const WB = board({ game: 'sticky-nook', label: 'Levels cleared', limits: { maxRun: 1, maxPerSec: 0.4 }, mode: 'sum' });
const ST = store('stickynook');
const F = flow('stickynook');
let fk = 1;
let level = ST.get('level', 1);
const ui = createUI({ title: 'STICKY<br>NOOK', hint: 'Tap a sticker, then tap its spot · or drag', hand: '👆', score: false });
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1;

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

// ------------------------------------------------------------------ level state
let theme, look, stickers = [], fixed = [], tray = [], placedN = 0, mistakes = 0, state = 'ready', colorAmt = 0, colorTarget = 0;
let shellImg = null, shellGrey = null, drag = null, botMove = null, idleT = 0, sparks = [], winT = 0, trayShift = 0;
const TRAY_SLOTS = 3;

function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w * DPR)); c.height = Math.max(1, Math.ceil(h * DPR)); const x = c.getContext('2d'); x.scale(DPR, DPR); return [c, x]; }
function renderItem(key) {
  const meas = new Pen(null); meas.bb = [1e9, 1e9, -1e9, -1e9]; ITEMS[key](meas, look);
  const pad = 10, [x0, y0, x1, y1] = meas.bb, w = x1 - x0 + pad * 2, h = y1 - y0 + pad * 2;
  const [c, cx] = makeCanvas(w, h); ITEMS[key](new Pen(cx, x0 - pad, y0 - pad), look);
  // sticker version: white die-cut border + soft shadow
  const B = Math.max(4, R.s * 0.28), [s, sx] = makeCanvas(w + B * 2, h + B * 2 + 4);
  const [sil, silx] = makeCanvas(w, h); silx.drawImage(c, 0, 0, w, h); silx.globalCompositeOperation = 'source-in'; silx.fillStyle = '#ffffff'; silx.fillRect(0, 0, w, h);
  const [shd, shx] = makeCanvas(w, h); shx.drawImage(c, 0, 0, w, h); shx.globalCompositeOperation = 'source-in'; shx.fillStyle = '#7a5a40'; shx.fillRect(0, 0, w, h);
  sx.globalAlpha = 0.07; for (let a = 0; a < 12; a++) sx.drawImage(shd, B + Math.cos(a / 12 * 6.283) * B, B + 4 + Math.sin(a / 12 * 6.283) * B, w, h);
  sx.globalAlpha = 1;
  for (let a = 0; a < 24; a++) sx.drawImage(sil, B + Math.cos(a / 24 * 6.283) * B, B + Math.sin(a / 24 * 6.283) * B, w, h);
  sx.drawImage(c, B, B, w, h);
  // empty-spot ghost: soft silhouette
  const [g, gx] = makeCanvas(w, h); gx.drawImage(c, 0, 0, w, h); gx.globalCompositeOperation = 'source-in'; gx.fillStyle = 'rgba(120,90,70,.22)'; gx.fillRect(0, 0, w, h);
  return { key, img: c, stk: s, ghost: g, x: x0 - pad, y: y0 - pad, w, h, B, cx: x0 - pad + w / 2, cy: y0 - pad + h / 2 };
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
function buildLevel() {
  const r = rng(level * 131 + 7), th = THEMES[(level - 1) % THEMES.length], pick = a => a[Math.floor(r() * a.length)];
  theme = th; const wi = Math.floor(r() * 2); fk = F.k();
  look = { wallL: th.walls[wi][1], wallR: th.walls[wi][0], floor: pick(th.floor), pattern: th.pattern, accent: pick(th.accent), accent2: pick(th.accent2), furn: pick(th.furn), rug: pick(th.rug) };
  const n = Math.min(th.items.length, Math.max(4, Math.round((5 + level) * fk)));
  const chosen = new Set(); const pool = [...th.items]; while (chosen.size < n) chosen.add(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  stickers = th.items.filter(k => chosen.has(k)).map(k => ({ key: k, placed: false, pop: 0, fade: 0 }));
  fixed = th.items.filter(k => !chosen.has(k));
  tray = [...stickers]; for (let i = tray.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [tray[i], tray[j]] = [tray[j], tray[i]]; }
  placedN = 0; mistakes = 0; colorAmt = colorTarget = 0.3; drag = null; botMove = null; sel = null; fly = null; idleT = 0; sparks = []; winT = 0;
  layout(); ui.levels(level); ui.progress(0); hearts();
}
function layout() {
  DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
  cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const top = 100, trayTop = H * 0.735, availH = trayTop - top - 18;
  R.s = Math.min(W * 0.95 / (20.9 * C30), availH / 19.2);
  R.x = W / 2; R.y = top + 8 + 8.1 * R.s + Math.max(0, (availH - 19.2 * R.s) * 0.45);           // back corner at wall-top height 7.5 + cap
  if (!theme) return;
  const [sc, sx] = makeCanvas(W, H); drawShell(sx, new Pen(sx), false);
  for (const k of fixed) { const it = renderItem(k); sx.drawImage(it.img, it.x, it.y, it.w, it.h); }
  shellImg = sc;
  const [gc, gx] = makeCanvas(W, H); gx.drawImage(sc, 0, 0, W, H); gx.globalCompositeOperation = 'saturation'; gx.fillStyle = '#808080'; gx.fillRect(0, 0, W, H);
  gx.globalCompositeOperation = 'source-over'; gx.globalAlpha = 0.18; gx.fillStyle = '#fff6ea'; gx.fillRect(0, 0, W, H); gx.globalAlpha = 1;
  gx.globalCompositeOperation = 'destination-in'; gx.drawImage(sc, 0, 0, W, H);
  shellGrey = gc;
  for (const s of stickers) Object.assign(s, { it: renderItem(s.key) });
  bgImg = makeBg();
}
let bgImg = null;
function makeBg() {
  const [c, x] = makeCanvas(W, H); x.fillStyle = '#fff4e4'; x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(240,190,140,.18)';
  for (let j = 0; j < H / 70 + 1; j++) for (let i = 0; i < W / 70 + 1; i++) { const px = i * 70 + (j % 2) * 35, py = j * 70; x.beginPath(); x.ellipse(px, py + 6, 9, 7, 0, 0, 7); x.fill(); for (let k = 0; k < 4; k++) { x.beginPath(); x.arc(px - 10 + k * 6.6, py - 7 - (k % 3 ? 3 : 0), 3.6, 0, 7); x.fill(); } }
  return c;
}
addEventListener('resize', () => { if (theme) layout(); });

// ------------------------------------------------------------------ HUD
const heartsEl = document.createElement('div'); heartsEl.className = 'sn-hearts'; document.body.appendChild(heartsEl);
function hearts() { heartsEl.textContent = '❤️'.repeat(3 - mistakes) + '🤍'.repeat(mistakes); }

// ------------------------------------------------------------------ tray geometry
const trayY = () => H * 0.735;
function slotRect(i) { const w = W / TRAY_SLOTS; return { x: i * w + w / 2, y: trayY() + (H - trayY()) * 0.5, w: w * 0.8, h: (H - trayY()) * 0.62 }; }
function trayFit(s, i) { const r = slotRect(i), it = s.it, k = Math.min(r.w / (it.w + it.B * 2), r.h / (it.h + it.B * 2), 1.15); return { x: r.x, y: r.y, k }; }

// ------------------------------------------------------------------ input
input({
  onDown: (e) => {
    if (state !== 'play' || botMove || fly) return;
    idleT = 0;
    if (e.clientY < trayY()) return;
    const i = Math.floor(e.clientX / (W / TRAY_SLOTS)); const s = tray[i]; if (!s) return;
    const f = trayFit(s, i);
    drag = { s, x: f.x, y: f.y, k: f.k, tx: e.clientX, ty: e.clientY - 70, fromI: i }; sfx.tap(); buzz(6); tone(700, 0.05, 'triangle', 0.08, 1.4);
  },
  onMove: (dx, dy, e) => { if (!drag) return; drag.tx = e.clientX; drag.ty = e.clientY - 70; },
  onTap: (e) => {   // tap a tray sticker to pick it up (tap again to put it back), then tap its spot to stick it there
    if (state !== 'play' || botMove || fly) return;
    if (drag) { sel = sel === drag.s ? null : drag.s; drag = null; return; }
    if (!sel || e.clientY >= trayY()) return;
    const i = tray.indexOf(sel), f = trayFit(sel, Math.max(0, i));
    fly = { s: sel, x: f.x, y: f.y - 16, k: f.k * 1.15, tx: e.clientX, ty: e.clientY, fly: true }; sel = null; sfx.tap(); buzz(6);
  },
  onUp: () => { if (!drag) return; drop(drag); drag = null; },
});
let sel = null, fly = null;
function drop(d) {
  const it = d.s.it, dist = Math.hypot(d.x - it.cx, d.y - it.cy), snap = Math.max(40, Math.min(it.w, it.h) * 0.45 / fk);
  if (dist < snap) return place(d.s);
  const other = stickers.find(o => !o.placed && o !== d.s && Math.hypot(d.x - o.it.cx, d.y - o.it.cy) < Math.max(40, Math.min(o.it.w, o.it.h) * 0.35));
  if (other) { mistakes++; hearts(); buzz([30, 30, 30]); tone(180, 0.18, 'square', 0.08, 0.7); ui.pop('Not there!', '#fff', 30, 24); shakeT = 0.4;
    if (mistakes >= 3 && state === 'play') { state = 'lost'; F.level(false, placedN / stickers.length); sfx.fail(); ui.lose('OOPS!', 'Three stickers in the wrong spot'); } }
  else tone(330, 0.07, 'sine', 0.06, 0.8);
  d.s.back = { x: d.x, y: d.y, t: 0 };
}
const PENTA = [72, 74, 76, 79, 81, 84, 86, 88, 91, 93, 96, 98];
const PRAISE = ['Cute!', 'Perfect!', 'So cosy!', 'Nice!', 'Purrfect!', 'Lovely!'];
let shakeT = 0;
function place(s) {
  s.placed = true; s.pop = 1; s.fade = 1; placedN++; tray.splice(tray.indexOf(s), 1); trayShift = 1;
  colorTarget = 0.3 + 0.7 * placedN / stickers.length;
  note(PENTA[Math.min(PENTA.length - 1, placedN - 1)], 0.5, 0.2); setTimeout(() => note(PENTA[Math.min(PENTA.length - 1, placedN + 1)], 0.4, 0.12), 90); buzz(14);
  for (let i = 0; i < 16; i++) { const a = Math.random() * 6.28, v = 1.5 + Math.random() * 3; sparks.push({ x: s.it.cx, y: s.it.cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5, life: 1, c: ['#ffd23f', '#ff8fab', '#8ad6ff', '#ffffff', '#9be38f'][i % 5], star: i % 3 === 0 }); }
  if (placedN % 2 === 0 || placedN === stickers.length) ui.pop(PRAISE[Math.floor(Math.random() * PRAISE.length)], '#fff', 30, 24);
  ui.progress(placedN / stickers.length);
  if (placedN === stickers.length && state === 'play') {
    state = 'won'; F.level(true); WB.submit(1); winT = 0.001;
    setTimeout(() => { sfx.win(); buzz([20, 40, 20]); for (let i = 0; i < 90; i++) { const a = Math.random() * 6.28, v = 2 + Math.random() * 6; sparks.push({ x: W / 2, y: R.y + 6 * R.s, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 4, life: 1.6, c: ['#ffd23f', '#ff8fab', '#8ad6ff', '#9be38f', '#b39ddb'][i % 5], conf: true, rot: Math.random() * 6 }); } }, 250);
    ui.win(level, `${theme.name} decorated!`); level++; ST.set('level', level);
  }
}
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on level 1, if nobody has touched
// the room 2 s in, the first tray sticker peels itself off, glides to its outline and sticks (one sticker, never the last)
demo(() => { const s = tray[0], f = trayFit(s, 0); botMove = { s, sx: f.x, sy: f.y, x: f.x, y: f.y, k: f.k, t: 0, demo: true }; tone(700, 0.05, 'triangle', 0.08, 1.4); return false; },
  { ready: () => state === 'play' && level === 1 && placedN === 0 && tray.length > 1 && !botMove && !drag && !fly && !sel, max: 1 });
ui.onTap(w => { WB.start(); if (w === 'start') state = 'play'; else { buildLevel(); state = 'play'; } });

// ------------------------------------------------------------------ render
function drawSticker(s, x, y, k, lift = 0, rot = 0) {
  const it = s.it, w = (it.w + it.B * 2) * k, h = (it.h + it.B * 2 + 4) * k;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  if (lift) { ctx.globalAlpha = 0.18; ctx.fillStyle = '#5b4636'; ctx.beginPath(); ctx.ellipse(0, h * 0.42 + lift, w * 0.36, h * 0.07, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
  ctx.drawImage(it.stk, -w / 2, -h / 2 - lift, w, h); ctx.restore();
}
const elastic = t => t >= 1 ? 1 : 1 - Math.pow(2, -9 * t) * Math.cos(t * 14);
loop((dt, t) => {
  if (!theme || !shellImg) return;
  const sec = dt / 60;
  colorAmt = lerp(colorAmt, colorTarget, 0.06 * dt); shakeT = Math.max(0, shakeT - sec); trayShift = Math.max(0, trayShift - sec * 4);
  if (state === 'play' && !drag && !botMove) idleT += sec;
  ctx.drawImage(bgImg, 0, 0, W, H);
  const sh = shakeT > 0 ? Math.sin(t * 60) * 5 * shakeT : 0;
  ctx.save(); ctx.translate(sh, 0);
  ctx.drawImage(shellGrey, 0, 0, W, H); ctx.globalAlpha = colorAmt; ctx.drawImage(shellImg, 0, 0, W, H); ctx.globalAlpha = 1;
  // spots + placed stickers in back→front order
  for (const s of stickers) {
    const it = s.it;
    if (!s.placed) {
      const target = (drag && drag.s === s) || (botMove && botMove.s === s) || sel === s || (fly && fly.s === s), pulse = target ? 0.65 + Math.sin(t * 8) * 0.35 : 0.85 + Math.sin(t * 2.5 + it.cx) * 0.15;
      ctx.globalAlpha = pulse; ctx.drawImage(it.ghost, it.x, it.y, it.w, it.h); ctx.globalAlpha = 1;
      if (target) { ctx.save(); ctx.globalAlpha = 0.5 + Math.sin(t * 8) * 0.3; ctx.strokeStyle = '#ffffff'; ctx.setLineDash([7, 6]); ctx.lineDashOffset = -t * 30; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(it.x + 4, it.y + 4, it.w - 8, it.h - 8, 14); ctx.stroke(); ctx.restore(); }
      continue;
    }
    s.pop = Math.max(0, s.pop - sec * 1.8); s.fade = Math.max(0, s.fade - sec * 2.2);
    const k = s.pop > 0 ? 0.75 + 0.25 * elastic(1 - s.pop) + (s.pop > 0.8 ? 0.2 : 0) : 1;
    ctx.save(); ctx.translate(it.cx, it.cy); ctx.scale(k, k);
    if (s.fade > 0) { ctx.globalAlpha = s.fade; const bw = it.w + it.B * 2, bh = it.h + it.B * 2 + 4; ctx.drawImage(it.stk, -bw / 2, -bh / 2, bw, bh); ctx.globalAlpha = 1; }
    ctx.drawImage(it.img, -it.w / 2, -it.h / 2, it.w, it.h); ctx.restore();
  }
  ctx.restore();
  // tray
  const ty = trayY();
  ctx.fillStyle = '#ffd9b3'; ctx.beginPath(); ctx.roundRect(-20, ty, W + 40, H - ty + 40, 34); ctx.fill();
  ctx.fillStyle = '#ffcd9e'; ctx.fillRect(0, ty + 24, W, 3);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#e8a46a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(14, ty - 18, 76, 34, 12); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#9a5b2c'; ctx.font = '800 19px "Baloo 2",system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${placedN}/${stickers.length}`, 52, ty);
  tray.slice(0, TRAY_SLOTS).forEach((s, i) => {
    if ((drag && drag.s === s) || (botMove && botMove.s === s) || (fly && fly.s === s)) return;
    const f = trayFit(s, i), off = trayShift * (W / TRAY_SLOTS);
    let x = f.x + off, y = f.y + Math.sin(t * 2 + i) * 2;
    if (s === sel) { y -= 16; ctx.save(); ctx.globalAlpha = 0.55 + Math.sin(t * 8) * 0.3; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, (W / TRAY_SLOTS) * 0.42, 0, 7); ctx.stroke(); ctx.restore(); drawSticker(s, x, y, f.k * 1.15, 8, Math.sin(t * 6) * 0.06); return; }
    if (s.back) { s.back.t = Math.min(1, s.back.t + sec * 4); const e = 1 - Math.pow(1 - s.back.t, 3); x = lerp(s.back.x, x, e); y = lerp(s.back.y, y, e); if (s.back.t >= 1) s.back = null; }
    drawSticker(s, x, y, f.k, 0, Math.sin(t * 1.5 + i) * 0.03);
  });
  // dragged / bot-moved sticker (full room size, lifted)
  const mv = drag || botMove || fly;
  if (mv) {
    if (botMove) { botMove.t = Math.min(1, botMove.t + sec * 2.4); const e = botMove.t < 0.5 ? 4 * botMove.t ** 3 : 1 - Math.pow(-2 * botMove.t + 2, 3) / 2; botMove.x = lerp(botMove.sx, botMove.s.it.cx, e); botMove.y = lerp(botMove.sy, botMove.s.it.cy, e) - Math.sin(e * Math.PI) * 60; }
    else { mv.x = lerp(mv.x, mv.tx, 0.4); mv.y = lerp(mv.y, mv.ty, 0.4); }
    mv.k = lerp(mv.k, 1, 0.25);
    drawSticker(mv.s, mv.x, mv.y, mv.k, 8, Math.sin(t * 6) * 0.04);
    if (mv === fly && Math.hypot(fly.x - fly.tx, fly.y - fly.ty) < 3) { const d = fly; fly = null; drop(d); }
    if (botMove) { ctx.font = '42px system-ui'; if (!botMove.demo) ctx.fillText('👆', botMove.x + 10, botMove.y + 60); if (botMove.t >= 1) { const s = botMove.s; botMove = null; place(s); } }
  }
  // idle hint: ghost hand drags from the first tray sticker to its spot
  if (state === 'play' && idleT > 4 && tray[0] && !drag && !sel && !fly) {
    const f = trayFit(tray[0], 0), k = ((idleT - 4) % 1.6) / 1.6, e = k * k * (3 - 2 * k), it = tray[0].it;
    ctx.globalAlpha = Math.sin(k * Math.PI); ctx.font = '44px system-ui'; ctx.fillText('👆', lerp(f.x, it.cx, e) + 8, lerp(f.y, it.cy, e) + 40); ctx.globalAlpha = 1;
  }
  // sparkles + confetti
  for (const p of sparks) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.conf ? 0.12 : 0.08) * dt; p.vx *= 0.985; p.life -= sec * (p.conf ? 0.6 : 1.4);
    ctx.globalAlpha = clamp(p.life, 0, 1); ctx.fillStyle = p.c;
    if (p.conf) { p.rot += 0.1 * dt; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-5, -3, 10, 6); ctx.restore(); }
    else if (p.star) { star(p.x, p.y, 7 * p.life + 2); } else { ctx.beginPath(); ctx.arc(p.x, p.y, 3.5 * p.life + 1, 0, 7); ctx.fill(); }
  }
  ctx.globalAlpha = 1; sparks = sparks.filter(p => p.life > 0);
});
function star(x, y, r) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }

buildLevel();
ui.start();

// ------------------------------------------------------------------ test hooks + bot (peels the first tray sticker and presses it on its spot)
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return placedN; },
  bot() {
    if (state !== 'play' || botMove || drag || fly || !tray.length) return;
    const s = tray[0], f = trayFit(s, 0);
    botMove = { s, sx: f.x, sy: f.y, x: f.x, y: f.y, k: f.k, t: 0 }; tone(700, 0.05, 'triangle', 0.08, 1.4);
  },
};
