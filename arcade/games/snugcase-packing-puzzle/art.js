// art.js — Snugcase drawing helpers: rounded polyomino outlines and the packable items, all drawn in code. Our own code, MIT.
export const INK = '#3a2c4d';

// ---------------------------------------------------------------- polyomino outline → rounded path
// cells: array of [x,y]. Returns loops of corner points (grid units), traversed with the inside on the right (screen coords).
export function outline(cells) {
  const has = new Set(cells.map(c => c[0] + ',' + c[1])), H = (x, y) => has.has(x + ',' + y);
  const edges = [];
  for (const [x, y] of cells) {
    if (!H(x, y - 1)) edges.push([x, y, x + 1, y]);
    if (!H(x + 1, y)) edges.push([x + 1, y, x + 1, y + 1]);
    if (!H(x, y + 1)) edges.push([x + 1, y + 1, x, y + 1]);
    if (!H(x - 1, y)) edges.push([x, y + 1, x, y]);
  }
  const from = new Map(); edges.forEach((e, i) => { const k = e[0] + ',' + e[1]; if (!from.has(k)) from.set(k, []); from.get(k).push(i); });
  const used = new Set(), loops = [];
  for (let s = 0; s < edges.length; s++) {
    if (used.has(s)) continue;
    const pts = []; let i = s;
    while (i !== undefined && !used.has(i)) {
      used.add(i); const e = edges[i]; pts.push([e[0], e[1]]);
      const nx = (from.get(e[2] + ',' + e[3]) || []).filter(j => !used.has(j));
      // at a pinch point prefer the right turn so loops stay simple
      i = nx.length > 1 ? nx.sort((a, b) => turn(e, edges[b]) - turn(e, edges[a]))[0] : nx[0];
    }
    // drop collinear points
    const out = pts.filter((p, k) => { const a = pts[(k - 1 + pts.length) % pts.length], b = pts[(k + 1) % pts.length]; return !((a[0] === p[0] && p[0] === b[0]) || (a[1] === p[1] && p[1] === b[1])); });
    if (out.length >= 4) loops.push(out);
  }
  return loops;
}
function turn(e, f) { const dx = e[2] - e[0], dy = e[3] - e[1], fx = f[2] - f[0], fy = f[3] - f[1]; return dx * fy - dy * fx; }

/** trace the outline (scaled by cs, inset by d px; negative d = outset) as a rounded path on g */
export function roundPath(g, loops, cs, d = 0, r = 8) {
  g.beginPath();
  for (const L of loops) {
    const n = L.length, P = [];
    for (let k = 0; k < n; k++) {
      const a = L[(k - 1 + n) % n], p = L[k], b = L[(k + 1) % n];
      const d1 = [Math.sign(p[0] - a[0]), Math.sign(p[1] - a[1])], d2 = [Math.sign(b[0] - p[0]), Math.sign(b[1] - p[1])];
      const n1 = [-d1[1], d1[0]], n2 = [-d2[1], d2[0]];
      P.push([p[0] * cs + d * (n1[0] + n2[0]), p[1] * cs + d * (n1[1] + n2[1])]);
    }
    const mid = (u, v) => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2], len = (u, v) => Math.hypot(u[0] - v[0], u[1] - v[1]);
    const m0 = mid(P[n - 1], P[0]); g.moveTo(m0[0], m0[1]);
    for (let k = 0; k < n; k++) {
      const p = P[k], q = P[(k + 1) % n], o = P[(k - 1 + n) % n], m = mid(p, q);
      g.arcTo(p[0], p[1], m[0], m[1], Math.max(0.1, Math.min(r, len(o, p) / 2 - 0.5, len(p, q) / 2 - 0.5)));
    }
    g.closePath();
  }
}

// ---------------------------------------------------------------- shape classes → item names
export function classify(cells) {
  const w = Math.max(...cells.map(c => c[0])) + 1, h = Math.max(...cells.map(c => c[1])) + 1, n = cells.length;
  const has = new Set(cells.map(c => c[0] + ',' + c[1]));
  const nb = ([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, b]) => has.has((x + a) + ',' + (y + b))).length;
  const rect = n === w * h;
  if (n === 1) return 'one';
  if (rect && (w === 1 || h === 1)) return n === 2 ? 'two' : 'long';
  if (rect && w === 2 && h === 2) return 'square';
  if (rect) return 'rect';
  if (Math.max(...cells.map(nb)) >= 3) return 'branch';
  if (n === w + h - 1) return 'L';
  return 'blob';
}
export const ITEMS = {
  travel: { one: ['ball', 'apple'], two: ['phone', 'soap'], long: ['toothbrush', 'bottle', 'pencil'], square: ['camera', 'clock'], rect: ['book', 'towel'], branch: ['shirt'], L: ['sock', 'scarf'], blob: ['plush'] },
  food: { one: ['egg', 'tomato'], two: ['sushi'], long: ['sushi', 'skewer'], square: ['donut', 'onigiri'], rect: ['sandwich', 'cake'], branch: ['broccoli'], L: ['shrimp', 'tamago'], blob: ['jelly'] },
};
// base fill per item (null = use the piece's own bright colour)
const FILL = { ball: '#d6ec4a', apple: '#ff5a5a', egg: '#ffffff', tomato: '#ff5b4d', sushi: '#2f4a3a', skewer: '#ffe7c4', donut: '#f2b46b', onigiri: '#ffffff',
  sandwich: '#f0c27b', cake: '#fff1e2', broccoli: '#5cbf5a', shrimp: '#ff9f43', tamago: '#ffd54a', camera: null, phone: null };

// ---------------------------------------------------------------- item art (drawn in the piece's base frame, clipped to its shape)
const circ = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); };
function ink(g, lw) { g.strokeStyle = INK; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round'; }
function shade(hex, f) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, gg = (n >> 8) & 255, b = n & 255; const t = f < 0 ? 0 : 255, p = Math.abs(f); r = Math.round((t - r) * p + r); gg = Math.round((t - gg) * p + gg); b = Math.round((t - b) * p + b); return '#' + ((1 << 24) + (r << 16) + (gg << 8) + b).toString(16).slice(1); }
export { shade };

/** fill colour for this piece */
export const fillOf = (p) => FILL[p.item] || p.color;

/** draw details. g is translated to the base bbox top-left; cells in base frame; s = cell size px */
export function drawItem(g, p, s) {
  const cells = p.cells, w = p.w, h = p.h, col = fillOf(p), lw = Math.max(1.6, s * 0.055);
  const has = new Set(cells.map(c => c[0] + ',' + c[1]));
  const nbs = ([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, b]) => has.has((x + a) + ',' + (y + b)));
  g.save();
  // long items: draw along +x
  let W = w, Hh = h;
  if ((p.cls === 'long' || p.cls === 'two' || p.cls === 'rect') && h > w) { g.translate(w * s, 0); g.rotate(Math.PI / 2); W = h; Hh = w; }
  const X = W * s, Y = Hh * s, cx = X / 2, cy = Y / 2;
  ink(g, lw);
  switch (p.item) {
    case 'ball': { circ(g, cx, cy, s * 0.36); g.fillStyle = '#e8f75c'; g.fill(); g.stroke(); g.lineWidth = lw * 0.9; g.strokeStyle = '#fff';
      g.beginPath(); g.arc(cx - s * 0.36, cy, s * 0.28, -1, 1); g.stroke(); g.beginPath(); g.arc(cx + s * 0.36, cy, s * 0.28, Math.PI - 1, Math.PI + 1); g.stroke(); break; }
    case 'apple': { g.fillStyle = '#ffffff55'; circ(g, cx - s * 0.16, cy - s * 0.08, s * 0.1); g.fill(); g.strokeStyle = '#6b3f1f'; g.lineWidth = lw * 1.2; g.beginPath(); g.moveTo(cx, cy - s * 0.18); g.lineTo(cx + s * 0.04, cy - s * 0.36); g.stroke();
      g.fillStyle = '#6cc04a'; g.beginPath(); g.ellipse(cx + s * 0.16, cy - s * 0.3, s * 0.13, s * 0.07, -0.5, 0, 7); g.fill(); ink(g, lw * 0.8); g.stroke(); break; }
    case 'egg': { g.fillStyle = '#ffc62e'; circ(g, cx + s * 0.03, cy + s * 0.03, s * 0.2); g.fill(); g.stroke(); g.fillStyle = '#fff6'; circ(g, cx - s * 0.03, cy - s * 0.03, s * 0.06); g.fill(); break; }
    case 'tomato': { g.fillStyle = '#ffffff66'; circ(g, cx - s * 0.17, cy - s * 0.12, s * 0.09); g.fill(); g.fillStyle = '#4fae45'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, r = i % 2 ? s * 0.07 : s * 0.2; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath(); g.fill(); ink(g, lw * 0.8); g.stroke(); break; }
    case 'phone': { g.fillStyle = '#2b2740'; g.beginPath(); g.roundRect(s * 0.2, s * 0.18, X - s * 0.48, Y - s * 0.36, s * 0.08); g.fill();
      const gr = g.createLinearGradient(0, 0, X, Y); gr.addColorStop(0, '#7fd6ff'); gr.addColorStop(1, '#b28cff'); g.fillStyle = gr; g.beginPath(); g.roundRect(s * 0.26, s * 0.24, X - s * 0.6, Y - s * 0.48, s * 0.05); g.fill();
      g.fillStyle = '#2b2740'; circ(g, X - s * 0.17, cy, s * 0.06); g.fill(); g.fillStyle = '#ffffff88'; g.fillRect(s * 0.36, s * 0.32, s * 0.5, s * 0.05); break; }
    case 'soap': { g.fillStyle = '#ffffffaa'; for (const [a, b, r] of [[0.3, 0.3, 0.12], [0.55, 0.62, 0.08], [0.8, 0.35, 0.1], [1.3, 0.6, 0.13], [1.6, 0.3, 0.07]]) { circ(g, a * s, b * s, r * s); g.fill(); g.lineWidth = lw * 0.6; g.strokeStyle = '#ffffff'; g.stroke(); }
      g.fillStyle = shade(col, -0.18); g.beginPath(); g.roundRect(s * 0.5, cy - s * 0.12, X - s, s * 0.24, s * 0.12); g.fill(); break; }
    case 'toothbrush': { g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(X - s * 0.95, s * 0.16, s * 0.75, Y - s * 0.32, s * 0.1); g.fill(); ink(g, lw * 0.8); g.stroke();
      g.strokeStyle = '#5ac8fa'; g.lineWidth = lw; for (let i = 0; i < 5; i++) { const x = X - s * 0.85 + i * s * 0.14; g.beginPath(); g.moveTo(x, s * 0.24); g.lineTo(x, Y - s * 0.24); g.stroke(); }
      g.fillStyle = shade(col, 0.45); g.beginPath(); g.roundRect(s * 0.3, cy - s * 0.1, X - s * 1.5, s * 0.2, s * 0.1); g.fill(); break; }
    case 'bottle': { g.fillStyle = shade(col, -0.25); g.fillRect(X - s * 0.38, 0, s * 0.4, Y); ink(g, lw); g.beginPath(); g.moveTo(X - s * 0.38, 0); g.lineTo(X - s * 0.38, Y); g.stroke();
      g.fillStyle = '#ffffff'; g.fillRect(s * 0.55, s * 0.12, X - s * 1.5, Y - s * 0.24); g.strokeStyle = col; g.lineWidth = lw * 1.2; g.beginPath(); for (let x = s * 0.65; x < X - s * 1.05; x += 4) g.lineTo(x, cy + Math.sin(x / s * 6) * s * 0.08); g.stroke();
      g.fillStyle = '#ffffff66'; g.fillRect(s * 0.15, s * 0.16, s * 0.3, s * 0.08); break; }
    case 'pencil': { g.fillStyle = '#ffb3c7'; g.fillRect(0, 0, s * 0.34, Y); g.fillStyle = '#c9cbd6'; g.fillRect(s * 0.34, 0, s * 0.2, Y); ink(g, lw * 0.8); g.beginPath(); g.moveTo(s * 0.34, 0); g.lineTo(s * 0.34, Y); g.moveTo(s * 0.54, 0); g.lineTo(s * 0.54, Y); g.stroke();
      g.fillStyle = '#ffe2b8'; g.beginPath(); g.moveTo(X - s * 0.7, 0); g.lineTo(X, cy); g.lineTo(X - s * 0.7, Y); g.lineTo(X + 5, Y + 5); g.lineTo(X + 5, -5); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(X - s * 0.7, 0); g.lineTo(X, cy); g.lineTo(X - s * 0.7, Y); g.stroke(); g.fillStyle = INK; g.beginPath(); g.moveTo(X - s * 0.22, cy - s * 0.15); g.lineTo(X, cy); g.lineTo(X - s * 0.22, cy + s * 0.15); g.fill();
      g.strokeStyle = shade(col, -0.2); g.lineWidth = lw; g.beginPath(); g.moveTo(s * 0.6, cy); g.lineTo(X - s * 0.75, cy); g.stroke(); break; }
    case 'camera': { g.fillStyle = shade(col, -0.35); g.fillRect(0, 0, X, Y * 0.3); ink(g, lw); g.beginPath(); g.moveTo(0, Y * 0.3); g.lineTo(X, Y * 0.3); g.stroke();
      g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(X * 0.62, Y * 0.08, X * 0.24, Y * 0.14, 3); g.fill(); g.stroke();
      circ(g, cx, cy + Y * 0.1, s * 0.62); g.fillStyle = '#f4f1f8'; g.fill(); g.stroke(); circ(g, cx, cy + Y * 0.1, s * 0.42); g.fillStyle = '#2b2740'; g.fill();
      const gr = g.createRadialGradient(cx - s * 0.12, cy, 2, cx, cy + Y * 0.1, s * 0.42); gr.addColorStop(0, '#9fd8ff'); gr.addColorStop(1, '#3b3460'); circ(g, cx, cy + Y * 0.1, s * 0.3); g.fillStyle = gr; g.fill();
      g.fillStyle = '#fff'; circ(g, cx - s * 0.1, cy + Y * 0.02, s * 0.07); g.fill(); g.fillStyle = '#ff6b6b'; circ(g, X * 0.18, Y * 0.15, s * 0.1); g.fill(); g.stroke(); break; }
    case 'clock': { g.fillStyle = shade(col, -0.25); circ(g, X * 0.22, Y * 0.18, s * 0.26); g.fill(); g.stroke(); circ(g, X * 0.78, Y * 0.18, s * 0.26); g.fill(); g.stroke();
      circ(g, cx, cy + s * 0.06, s * 0.74); g.fillStyle = col; g.fill(); g.stroke(); circ(g, cx, cy + s * 0.06, s * 0.58); g.fillStyle = '#fffaf0'; g.fill(); g.stroke();
      g.lineWidth = lw * 1.2; g.beginPath(); g.moveTo(cx, cy + s * 0.06); g.lineTo(cx, cy - s * 0.32); g.moveTo(cx, cy + s * 0.06); g.lineTo(cx + s * 0.26, cy + s * 0.14); g.stroke();
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.fillStyle = INK; circ(g, cx + Math.cos(a) * s * 0.48, cy + s * 0.06 + Math.sin(a) * s * 0.48, s * 0.03); g.fill(); } break; }
    case 'book': { g.fillStyle = shade(col, -0.25); g.fillRect(0, 0, s * 0.3, Y); g.fillStyle = '#fffaf0'; g.fillRect(X - s * 0.22, 0, s * 0.22, Y);
      ink(g, lw); g.beginPath(); g.moveTo(s * 0.3, 0); g.lineTo(s * 0.3, Y); g.moveTo(X - s * 0.22, 0); g.lineTo(X - s * 0.22, Y); g.stroke();
      g.lineWidth = lw * 0.5; for (let y = s * 0.2; y < Y - s * 0.1; y += s * 0.14) { g.beginPath(); g.moveTo(X - s * 0.18, y); g.lineTo(X - s * 0.04, y); g.stroke(); }
      g.fillStyle = '#fffaf0'; g.beginPath(); g.roundRect(cx - s * 0.32 + s * 0.05, cy - s * 0.2, s * 0.64, s * 0.4, 4); g.fill(); ink(g, lw * 0.8); g.stroke();
      g.lineWidth = lw * 0.7; g.beginPath(); g.moveTo(cx - s * 0.16, cy - s * 0.04); g.lineTo(cx + s * 0.26, cy - s * 0.04); g.moveTo(cx - s * 0.16, cy + s * 0.08); g.lineTo(cx + s * 0.16, cy + s * 0.08); g.stroke(); break; }
    case 'towel': { g.fillStyle = '#ffffff'; for (let x = s * 0.35; x < X - s * 0.3; x += s * 0.5) g.fillRect(x, 0, s * 0.18, Y);
      ink(g, lw * 0.6); for (let y = s * 0.12; y < Y; y += s * 0.16) { g.beginPath(); g.moveTo(0, y); g.lineTo(s * 0.14, y); g.moveTo(X, y); g.lineTo(X - s * 0.14, y); g.stroke(); } break; }
    case 'shirt': { const hub = cells.find(c => nbs(c).length >= 3) || cells[0], hx = (hub[0] + 0.5) * s, hy = (hub[1] + 0.5) * s;
      g.fillStyle = '#ffffff55'; for (const [x, y] of cells) for (let k = 0; k < 2; k++) g.fillRect(x * s, y * s + s * (0.22 + k * 0.42), s, s * 0.14);
      const miss = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([a, b]) => !has.has((hub[0] + a) + ',' + (hub[1] + b))) || [0, -1];
      g.save(); g.translate(hx, hy); g.rotate(Math.atan2(miss[1], miss[0]) + Math.PI / 2);
      g.fillStyle = '#fffaf0'; g.beginPath(); g.moveTo(-s * 0.32, -s * 0.5); g.lineTo(0, -s * 0.12); g.lineTo(s * 0.32, -s * 0.5); g.closePath(); g.fill(); ink(g, lw); g.stroke();
      g.fillStyle = INK; for (let k = 0; k < 2; k++) { circ(g, 0, s * (0.05 + k * 0.25), s * 0.05); g.fill(); } g.restore(); break; }
    case 'sock': { const corner = cells.find(c => { const n = nbs(c); return n.length === 2 && n[0][0] !== -n[1][0] && n[0][1] !== -n[1][1]; }) || cells[0];
      const ends = cells.filter(c => nbs(c).length <= 1);
      const dist = (a) => Math.abs(a[0] - corner[0]) + Math.abs(a[1] - corner[1]);
      ends.sort((a, b) => dist(b) - dist(a));
      const cuff = ends[0], toe = ends[1] || ends[0];
      // stripes run across the leg (perpendicular to the cuff arm)
      const legX = cuff && cuff[1] === corner[1];
      g.fillStyle = p.alt || '#fff';
      for (const [x, y] of cells) { if (legX) g.fillRect(x * s + s * 0.38, y * s, s * 0.22, s); else g.fillRect(x * s, y * s + s * 0.38, s, s * 0.22); }
      g.fillStyle = shade(col, -0.18);
      g.beginPath(); g.arc((corner[0] + 0.5) * s, (corner[1] + 0.5) * s, s * 0.34, 0, 7); g.fill();
      if (toe !== cuff) { g.beginPath(); g.arc((toe[0] + 0.5) * s, (toe[1] + 0.5) * s, s * 0.32, 0, 7); g.fill(); }
      if (cuff) { const [x, y] = cuff; g.fillStyle = '#fffaf0'; g.fillRect(x * s, y * s, s, s); ink(g, lw * 0.6);
        for (let k = 1; k < 5; k++) { g.beginPath(); if (legX) { g.moveTo(x * s + 3, y * s + k * s / 5); g.lineTo(x * s + s - 3, y * s + k * s / 5); } else { g.moveTo(x * s + k * s / 5, y * s + 3); g.lineTo(x * s + k * s / 5, y * s + s - 3); } g.stroke(); } }
      break; }
    case 'scarf': { const ends = cells.filter(c => nbs(c).length <= 1);
      for (const [x, y] of cells) { g.fillStyle = (x + y) % 2 ? (p.alt || '#fff') : col; g.fillRect(x * s, y * s, s, s); g.fillStyle = '#ffffff44'; g.fillRect(x * s, y * s + s * 0.44, s, s * 0.12); g.fillRect(x * s + s * 0.44, y * s, s * 0.12, s); }
      ink(g, lw * 0.6); for (const [x, y] of ends) for (let k = 1; k < 6; k++) { g.beginPath(); g.moveTo(x * s + k * s / 6, y * s + s * 0.15); g.lineTo(x * s + k * s / 6, y * s + s * 0.85); g.stroke(); }
      break; }
    case 'tamago': { for (const [x, y] of cells) { ink(g, lw * 0.7); g.strokeStyle = '#d99a1e'; g.beginPath(); for (let a = 0; a < 12; a += 0.3) { const r = a * s * 0.032; g.lineTo((x + 0.5) * s + Math.cos(a) * r, (y + 0.5) * s + Math.sin(a) * r); } g.stroke();
      g.fillStyle = '#2f4a3a'; g.fillRect(x * s, (y + 0.42) * s, s, s * 0.16); } break; }
    case 'plush': case 'jelly': {
      if (p.item === 'plush') { g.fillStyle = '#ffffff55'; for (const [x, y] of cells) { circ(g, (x + 0.25) * s, (y + 0.3) * s, s * 0.1); g.fill(); circ(g, (x + 0.75) * s, (y + 0.72) * s, s * 0.08); g.fill(); } }
      else { g.fillStyle = '#ffffff66'; for (const [x, y] of cells) { g.beginPath(); g.ellipse((x + 0.3) * s, (y + 0.28) * s, s * 0.16, s * 0.07, -0.6, 0, 7); g.fill(); } }
      const f = cells.reduce((b, c) => (nbs(c).length > nbs(b).length ? c : b), cells[0]), fx = (f[0] + 0.5) * s, fy = (f[1] + 0.5) * s;
      g.fillStyle = INK; circ(g, fx - s * 0.17, fy - s * 0.04, s * 0.065); g.fill(); circ(g, fx + s * 0.17, fy - s * 0.04, s * 0.065); g.fill();
      g.fillStyle = '#ff7aa2aa'; circ(g, fx - s * 0.3, fy + s * 0.1, s * 0.08); g.fill(); circ(g, fx + s * 0.3, fy + s * 0.1, s * 0.08); g.fill();
      ink(g, lw * 0.8); g.beginPath(); g.arc(fx, fy + s * 0.04, s * 0.09, 0.3, Math.PI - 0.3); g.stroke(); break; }
    case 'sushi': { for (let i = 0; i < W; i++) { const x = (i + 0.5) * s, y = cy; circ(g, x, y, s * 0.4); g.fillStyle = '#ffffff'; g.fill(); ink(g, lw * 0.7); g.stroke();
      g.fillStyle = ['#ff8a65', '#7ed36b', '#ffd54f'][(i + (p.seed | 0)) % 3]; circ(g, x, y, s * 0.17); g.fill(); g.stroke(); } break; }
    case 'skewer': { g.strokeStyle = '#b07a46'; g.lineWidth = s * 0.08; g.beginPath(); g.moveTo(0, cy); g.lineTo(X, cy); g.stroke();
      for (let i = 0; i < W; i++) { circ(g, (i + 0.5) * s, cy, s * 0.34); g.fillStyle = ['#c0672e', '#7ed36b', '#ff6b5b', '#ffd54f'][(i + (p.seed | 0)) % 4]; g.fill(); ink(g, lw * 0.8); g.stroke(); g.fillStyle = '#ffffff55'; circ(g, (i + 0.4) * s, cy - s * 0.12, s * 0.08); g.fill(); } break; }
    case 'donut': { circ(g, cx, cy, s * 0.82); g.fillStyle = '#ff9ec7'; g.fill(); ink(g, lw); g.stroke(); circ(g, cx, cy, s * 0.26); g.fillStyle = p.bg || '#fff4f6'; g.fill(); g.stroke();
      const cs = ['#fff', '#7ed6ff', '#ffe066', '#a786ff']; for (let i = 0; i < 14; i++) { const a = i * 2.4, r = s * (0.42 + (i % 3) * 0.12); g.save(); g.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.rotate(a * 3); g.fillStyle = cs[i % 4]; g.fillRect(-s * 0.06, -s * 0.02, s * 0.12, s * 0.04); g.restore(); } break; }
    case 'onigiri': { g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(cx, s * 0.15); g.quadraticCurveTo(X - s * 0.05, Y - s * 0.2, X - s * 0.2, Y - s * 0.18); g.lineTo(s * 0.2, Y - s * 0.18); g.quadraticCurveTo(s * 0.05, Y - s * 0.2, cx, s * 0.15); g.fill(); ink(g, lw); g.stroke();
      g.fillStyle = '#2f4a3a'; g.fillRect(cx - s * 0.32, Y - s * 0.62, s * 0.64, s * 0.44); g.fillStyle = INK; for (let i = 0; i < 7; i++) { circ(g, cx + Math.cos(i * 2.1) * s * 0.4, s * 0.75 + Math.sin(i * 1.7) * s * 0.18, s * 0.025); g.fill(); } break; }
    case 'sandwich': { g.fillStyle = '#fff1c9'; g.beginPath(); g.roundRect(s * 0.14, s * 0.14, X - s * 0.28, Y - s * 0.28, s * 0.14); g.fill();
      g.strokeStyle = '#7ed36b'; g.lineWidth = s * 0.1; g.beginPath(); for (let x = s * 0.2; x < X - s * 0.2; x += 3) g.lineTo(x, s * 0.2 + Math.sin(x / s * 12) * s * 0.04); g.stroke();
      g.fillStyle = '#ff6b5b'; for (let i = 0; i < W; i++) { circ(g, (i + 0.5) * s, Y - s * 0.42, s * 0.14); g.fill(); }
      ink(g, lw * 0.8); g.beginPath(); g.moveTo(s * 0.14, s * 0.14); g.lineTo(X - s * 0.14, Y - s * 0.14); g.stroke(); break; }
    case 'cake': { for (let x = 0; x < X; x += s * 0.5) { g.fillStyle = (x / (s * 0.5)) % 2 < 1 ? '#ffb3cf' : '#fff1e2'; g.fillRect(x, 0, s * 0.25, Y); }
      for (let i = 0; i < W; i++) { g.fillStyle = '#ff4f6d'; circ(g, (i + 0.5) * s, s * 0.32, s * 0.15); g.fill(); ink(g, lw * 0.7); g.stroke(); g.fillStyle = '#6cc04a'; g.fillRect((i + 0.47) * s, s * 0.12, s * 0.06, s * 0.08); } break; }
    case 'broccoli': { for (const [x, y] of cells) { const bx = (x + 0.5) * s, by = (y + 0.5) * s; for (let k = 0; k < 5; k++) { const a = k * 1.26 + x; circ(g, bx + Math.cos(a) * s * 0.2, by + Math.sin(a) * s * 0.2, s * 0.17); g.fillStyle = k % 2 ? '#4caf50' : '#69c85f'; g.fill(); ink(g, lw * 0.5); g.stroke(); } g.fillStyle = '#2e7d32'; circ(g, bx, by, s * 0.05); g.fill(); } break; }
    case 'shrimp': { const tail = cells.find(c => nbs(c).length === 1) || cells[0];
      for (const [x, y] of cells) { ink(g, lw * 0.6); g.strokeStyle = '#c4621a'; for (let k = 1; k < 3; k++) { g.beginPath(); g.arc((x + 0.5) * s, (y + 0.5) * s, s * 0.14 * k, 0.3, 2.8); g.stroke(); } g.fillStyle = '#ffd58a'; for (let k = 0; k < 4; k++) { circ(g, (x + 0.2 + (k % 2) * 0.6) * s, (y + 0.2 + (k >> 1) * 0.6) * s, s * 0.04); g.fill(); } }
      const tx = (tail[0] + 0.5) * s, ty = (tail[1] + 0.5) * s; g.fillStyle = '#ff5b3a'; for (const a of [-0.5, 0.5]) { g.beginPath(); g.ellipse(tx + Math.cos(a) * s * 0.18, ty + Math.sin(a) * s * 0.18, s * 0.26, s * 0.14, a, 0, 7); g.fill(); ink(g, lw * 0.6); g.stroke(); } break; }
  }
  g.restore();
}
