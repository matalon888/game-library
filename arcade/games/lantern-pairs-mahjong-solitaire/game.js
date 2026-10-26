// Lantern Pairs — original mahjong solitaire. Match two identical free tiles (nothing on top, a free left or right side)
// to clear the stack. Layouts are generated per level and every deal is built backwards from a full removal order,
// so it is always solvable. Our own tile faces: three numbered suits (Lotus, Wave, Leaf) and nine emblem tiles.
import { createUI, store, buzz } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { css, cardTheme, startCard, fx2d, chime, arp, soft, todayKey } from './calm.js';

const NAME = 'Lantern Pairs: Mahjong Solitaire';
const S = store('lanternpairs');
const F = flow('lanternpairs');
const ui = createUI({ title: 'Lantern Pairs', hint: 'Tap to play', hand: '', score: false });
cardTheme({ accent: '#c9443c' });
const D = daily('lanternpairs', ui, { name: NAME });
const B = board({ game: 'lantern-pairs', label: 'Boards cleared', limits: { maxRun: 2, maxPerSec: 0.3 }, mode: 'sum' });   // world board: boards cleared today (RULES.md)
const fx = fx2d(11);
const doneToday = S.get('daily_' + todayKey(), null);
startCard(ui, D, { kicker: D.isDaily ? 'Daily board' : 'Mahjong solitaire', doneLine: doneToday ? (D.isDaily ? `Cleared today · ${doneToday.s.toLocaleString()} pts` : 'Daily board cleared ✓') : null });
if (D.isDaily) ui.els.win.querySelector('p').innerHTML = 'Daily board<span data-l hidden></span>';
ui.els.win.querySelector('h1').textContent = 'Board cleared!';

const THEMES = [
  { bg: ['#1f5a4c', '#123a33', '#0a2420'], leaf: '#2c7563', body: ['#2f8a70', '#1b5c4b'] },
  { bg: ['#5a2f45', '#3a1e33', '#220f1e'], leaf: '#7a4060', body: ['#a6435a', '#6e2a3d'] },
  { bg: ['#25365e', '#17243f', '#0c1426'], leaf: '#334a7a', body: ['#3f68a8', '#25457a'] },
  { bg: ['#5e4126', '#3d2a18', '#24180c'], leaf: '#7a5632', body: ['#b07a3c', '#7a5226'] },
];

css(`
body{background:#123a33}
.hc-top{z-index:6}.hc-top .hc-lvl{width:28px;height:28px;font-size:14px;font-weight:700;background:#e7b45a;color:#2a1a0a}
.hc-top .hc-lvl.next{background:rgba(255,255,255,.16);color:#fff}
.hc-top .hc-bar{background:rgba(255,255,255,.16);height:8px}.hc-top .hc-bar i{background:#e7b45a}
#cv{position:fixed;inset:0;width:100%;height:100%;z-index:1;touch-action:none}
#bar{position:fixed;left:0;right:0;bottom:calc(14px + env(safe-area-inset-bottom));z-index:5;display:flex;justify-content:center;gap:26px}
.tb{display:flex;flex-direction:column;align-items:center;gap:5px;background:none;border:0;color:#f3ead8;font:inherit;font-size:12px;font-weight:600;letter-spacing:.4px;cursor:pointer;position:relative}
.tb span.o{width:56px;height:56px;border-radius:50%;background:linear-gradient(160deg,#f6ead0,#e1cfa8);box-shadow:0 6px 16px rgba(0,0,0,.35),inset 0 -3px 0 rgba(0,0,0,.12);display:flex;align-items:center;justify-content:center}
.tb svg{width:26px;height:26px;stroke:#5a3a1c;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.tb i{position:absolute;top:-3px;right:-6px;font-style:normal;background:#c9443c;color:#fff;font-size:11px;font-weight:800;border-radius:10px;padding:1px 6px}
.tb i.off{background:#7d7468}
.tb:active span.o{transform:scale(.92)}
.tb.pulse span.o{animation:pl 1s ease-in-out infinite}
@keyframes pl{50%{box-shadow:0 0 0 8px rgba(231,180,90,.35),0 6px 16px rgba(0,0,0,.35)}}
#info{position:fixed;left:0;right:0;top:calc(54px + env(safe-area-inset-top));z-index:5;display:flex;justify-content:center;gap:8px;color:#f3ead8;font-size:12px;letter-spacing:.5px;pointer-events:none;opacity:.9}
#info span{background:rgba(0,0,0,.18);border-radius:14px;padding:4px 12px}
#info b{font-size:15px;font-weight:700;margin-left:4px;font-variant-numeric:tabular-nums}
`);
const cv = document.createElement('canvas'); cv.id = 'cv'; document.body.prepend(cv);
const g = cv.getContext('2d');
const info = document.createElement('div'); info.id = 'info'; info.innerHTML = '<span>Score<b data-s>0</b></span><span>Pairs<b data-p>0</b></span><span>Open matches<b data-m>0</b></span>'; document.body.appendChild(info);
const bar = document.createElement('div'); bar.id = 'bar';
const ICON = { undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>', hint: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 00-3.5 10.9c.6.4 1 1.1 1 1.9V16h5v-.2c0-.8.4-1.5 1-1.9A6 6 0 0012 3z"/>', shuf: '<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>' };
for (const [k, lab] of [['undo', 'Undo'], ['hint', 'Hint'], ['shuf', 'Shuffle']]) bar.insertAdjacentHTML('beforeend', `<button class="tb" data-${k}><span class="o"><svg viewBox="0 0 24 24">${ICON[k]}</svg></span>${k !== 'undo' ? '<i>0</i>' : ''}${lab}</button>`);
document.body.appendChild(bar);
const $ = (s) => document.querySelector(s);

function rngf(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// ---------------------------------------------------------------- faces (36 kinds, drawn in code)
const SUITS = [{ name: 'lotus', col: '#c23d5b' }, { name: 'wave', col: '#2a66b0' }, { name: 'leaf', col: '#2e8657' }];
const EMBLEMS = ['N', 'E', 'S', 'W', 'lantern', 'pine', 'sun', 'moon', 'cloud'];
function emblem(c, kind, x, y, s, col) {
  c.save(); c.translate(x, y); c.fillStyle = col; c.strokeStyle = col; c.lineWidth = s * 0.09; c.lineCap = 'round'; c.lineJoin = 'round';
  if (kind === 'lotus') { for (let i = -2; i <= 2; i++) { c.save(); c.rotate(i * 0.42); c.beginPath(); c.ellipse(0, -s * 0.28, s * 0.13, s * 0.32, 0, 0, 7); c.fill(); c.restore(); } c.beginPath(); c.ellipse(0, s * 0.08, s * 0.42, s * 0.08, 0, 0, 7); c.fill(); }
  else if (kind === 'wave') { for (let k = 0; k < 2; k++) { c.beginPath(); for (let i = 0; i <= 20; i++) { const t = i / 20; c.lineTo((t - 0.5) * s * 0.95, (k - 0.5) * s * 0.34 + Math.sin(t * Math.PI * 3) * s * 0.1); } c.stroke(); } }
  else if (kind === 'leaf') { c.beginPath(); c.moveTo(0, s * 0.45); c.quadraticCurveTo(-s * 0.5, -s * 0.05, 0, -s * 0.45); c.quadraticCurveTo(s * 0.5, -s * 0.05, 0, s * 0.45); c.fill(); c.strokeStyle = '#fbf6ea'; c.lineWidth = s * 0.05; c.beginPath(); c.moveTo(0, s * 0.38); c.lineTo(0, -s * 0.3); c.stroke(); }
  else if (kind === 'lantern') { c.fillStyle = '#c9443c'; c.beginPath(); c.ellipse(0, 0, s * 0.36, s * 0.42, 0, 0, 7); c.fill(); c.fillStyle = '#e7b45a'; c.fillRect(-s * 0.2, -s * 0.52, s * 0.4, s * 0.12); c.fillRect(-s * 0.2, s * 0.4, s * 0.4, s * 0.12); c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = s * 0.04; for (const k of [-0.16, 0, 0.16]) { c.beginPath(); c.ellipse(0, 0, Math.abs(k) * s + s * 0.02, s * 0.4, 0, 0, 7); c.stroke(); } c.strokeStyle = '#e7b45a'; c.beginPath(); c.moveTo(0, s * 0.52); c.lineTo(0, s * 0.7); c.stroke(); }
  else if (kind === 'pine') { c.fillStyle = '#2e7a4a'; for (let k = 0; k < 3; k++) { const w = s * (0.3 + k * 0.14), yy = -s * 0.5 + k * s * 0.27; c.beginPath(); c.moveTo(0, yy); c.lineTo(w, yy + s * 0.36); c.lineTo(-w, yy + s * 0.36); c.fill(); } c.fillStyle = '#6b4a2a'; c.fillRect(-s * 0.06, s * 0.3, s * 0.12, s * 0.22); }
  else if (kind === 'sun') { c.fillStyle = '#e09a26'; c.beginPath(); c.arc(0, 0, s * 0.24, 0, 7); c.fill(); c.strokeStyle = '#e09a26'; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; c.beginPath(); c.moveTo(Math.cos(a) * s * 0.33, Math.sin(a) * s * 0.33); c.lineTo(Math.cos(a) * s * 0.48, Math.sin(a) * s * 0.48); c.stroke(); } }
  else if (kind === 'moon') { c.fillStyle = '#5b6fa8'; c.beginPath(); c.arc(0, 0, s * 0.4, 0, 7); c.fill(); c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(s * 0.18, -s * 0.12, s * 0.34, 0, 7); c.fill(); c.globalCompositeOperation = 'source-over'; c.fillStyle = '#e7b45a'; c.beginPath(); c.arc(s * 0.3, s * 0.22, s * 0.06, 0, 7); c.fill(); }
  else if (kind === 'cloud') { c.strokeStyle = '#7a5aa8'; c.lineWidth = s * 0.08; c.beginPath(); c.arc(-s * 0.18, s * 0.02, s * 0.2, Math.PI * 0.6, Math.PI * 1.9); c.arc(s * 0.12, -s * 0.06, s * 0.24, Math.PI * 1.1, Math.PI * 0.25); c.stroke(); c.beginPath(); c.moveTo(-s * 0.45, s * 0.24); c.lineTo(s * 0.45, s * 0.24); c.stroke(); c.beginPath(); c.arc(0, s * 0.24, s * 0.12, Math.PI, 0); c.stroke(); }
  else { // compass winds: letter inside a ring
    c.strokeStyle = '#2b2d42'; c.lineWidth = s * 0.06; c.beginPath(); c.arc(0, 0, s * 0.44, 0, 7); c.stroke();
    const a = { N: -Math.PI / 2, E: 0, S: Math.PI / 2, W: Math.PI }[kind]; c.fillStyle = '#c9443c'; c.beginPath(); c.moveTo(Math.cos(a) * s * 0.62, Math.sin(a) * s * 0.62); c.lineTo(Math.cos(a + 0.35) * s * 0.44, Math.sin(a + 0.35) * s * 0.44); c.lineTo(Math.cos(a - 0.35) * s * 0.44, Math.sin(a - 0.35) * s * 0.44); c.fill();
    c.fillStyle = '#2b2d42'; c.font = `700 ${s * 0.5}px ui-serif,Georgia,serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(kind, 0, s * 0.03);
  }
  c.restore();
}
function drawFace(c, kind, w, h) {
  if (kind < 27) {
    const suit = SUITS[Math.floor(kind / 9)], n = kind % 9 + 1;
    c.fillStyle = suit.col; c.font = `600 ${h * 0.46}px ui-serif,'New York',Georgia,serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(n, w / 2, h * 0.36);
    emblem(c, suit.name, w / 2, h * 0.73, w * 0.42, suit.col);
  } else emblem(c, EMBLEMS[kind - 27], w / 2, h / 2, w * 0.62, '#2b2d42');
}
let SPR = [], TW = 40, TH = 52, DEP = 5, PAD = 8, dpr = 1;
function makeSprites(th) {
  dpr = Math.min(devicePixelRatio || 1, 2); SPR = [];
  for (let k = 0; k < 36; k++) {
    const c = document.createElement('canvas'); c.width = Math.ceil((TW + DEP + PAD * 2) * dpr); c.height = Math.ceil((TH + DEP + PAD * 2) * dpr);
    const x = c.getContext('2d'); x.scale(dpr, dpr); x.translate(PAD, PAD);
    x.save(); x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = DEP * 1.6; x.shadowOffsetX = DEP * 0.5; x.shadowOffsetY = DEP * 0.9; x.fillStyle = '#000'; x.beginPath(); x.roundRect(DEP * 0.9, DEP * 0.9, TW, TH, TW * 0.14); x.fill(); x.restore();
    const r = TW * 0.14;
    const rr = (ox, oy, w, h) => { x.beginPath(); x.roundRect(ox, oy, w, h, r); };
    // body (thickness toward bottom-right)
    const bd = x.createLinearGradient(0, 0, TW + DEP, TH + DEP); bd.addColorStop(0, th.body[0]); bd.addColorStop(1, th.body[1]);
    x.fillStyle = bd; rr(DEP * 0.9, DEP * 0.9, TW, TH); x.fill();
    x.fillStyle = '#e9dfc8'; rr(DEP * 0.45, DEP * 0.45, TW, TH); x.fill();
    // face
    const fg = x.createLinearGradient(0, 0, 0, TH); fg.addColorStop(0, '#fffdf6'); fg.addColorStop(1, '#f3ead6');
    x.fillStyle = fg; rr(0, 0, TW, TH); x.fill();
    x.strokeStyle = 'rgba(120,90,50,.18)'; x.lineWidth = 1; rr(2.5, 2.5, TW - 5, TH - 5); x.stroke();
    drawFace(x, k, TW, TH);
    SPR.push(c);
  }
}

// ---------------------------------------------------------------- layout generator (units: x/y half-tiles, z layer)
function genLayout(r, target) {
  for (let attempt = 0; attempt < 400; attempt++) {
    const cols = 6 + Math.floor(r() * 3), rows = 7 + Math.floor(r() * 3), shape = Math.floor(r() * 5), cx = cols;  // centre in half units
    const P = [], has = new Set(), key = (x, y, z) => x + ',' + y + ',' + z;
    for (let row = 0; row < rows; row++) {
      const t = rows === 1 ? 0 : row / (rows - 1), m = Math.abs(t - 0.5) * 2;
      let k = shape === 0 ? Math.round(cols - m * (cols - 2)) : shape === 1 ? Math.round(2 + m * (cols - 2)) : shape === 2 ? (row % 3 === 1 ? cols - 2 : cols) : shape === 3 ? (m > 0.6 ? 2 : cols) : Math.round(cols - Math.abs(Math.sin(t * Math.PI * 2)) * (cols - 3));
      k = Math.max(2, Math.min(cols, k));
      for (let i = 0; i < k; i++) { const x = cx - k + 1 + 2 * i, y = row * 2; P.push({ x, y, z: 0 }); has.add(key(x, y, 0)); }
    }
    // stack layers by eroding the one below
    let layer = P.slice(), z = 0;
    const maxZ = 1 + Math.floor(r() * 4);
    while (z < maxZ) {
      const nxt = layer.filter(p => has.has(key(p.x - 2, p.y, z)) && has.has(key(p.x + 2, p.y, z)) && (r() < 0.85));
      if (nxt.length < 2) break;
      z++; layer = nxt.map(p => ({ x: p.x, y: p.y, z })); layer.forEach(p => { P.push(p); has.add(key(p.x, p.y, z)); });
    }
    if (Math.abs(P.length - target) > Math.max(4, target * 0.12)) continue;
    // make the count even (and symmetric-ish) by dropping a top tile
    while (P.length % 2 || P.length > target + 2) { let best = 0; for (let i = 1; i < P.length; i++) if (P[i].z > P[best].z || (P[i].z === P[best].z && Math.abs(P[i].x - cx) < Math.abs(P[best].x - cx))) best = i; P.splice(best, 1); }
    return P;
  }
  return null;
}
const overlaps = (a, b) => Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2;
function freeIn(t, live) {
  let L = false, R = false;
  for (const o of live) {
    if (o === t) continue;
    if (o.z === t.z + 1 && overlaps(o, t)) return false;
    if (o.z === t.z && Math.abs(o.y - t.y) < 2) { if (o.x - t.x === -2) L = true; else if (o.x - t.x === 2) R = true; }
  }
  return !(L && R);
}
// build a removal order backwards: repeatedly remove two random free tiles; that order is a guaranteed solution
function removalOrder(tiles, r) {
  for (let a = 0; a < 300; a++) {
    const live = new Set(tiles), pairs = [];
    while (live.size) {
      const fr = [...live].filter(t => freeIn(t, live)); if (fr.length < 2) break;
      const i = Math.floor(r() * fr.length); let j = Math.floor(r() * (fr.length - 1)); if (j >= i) j++;
      pairs.push([fr[i], fr[j]]); live.delete(fr[i]); live.delete(fr[j]);
    }
    if (!live.size) return pairs;
  }
  return null;
}

// ---------------------------------------------------------------- state
let state = 'ready', level = S.get('level', 1), score = 0, moves = 0, tiles = [], sel = null, history = [], plan = [], hints = 3, shuffles = 2, recorded = false, beatenShown = false;
let th, anims = [], combo = 0, lastMatch = 0, hintPair = null, view = { s: 1, ox: 0, oy: 0 }, totalPairs = 0;

function build() {
  const fk = D.isDaily ? 1 : F.k(), L = D.isDaily ? 8 : level, seed = D.seed || level * 92821 + 5;
  const r = rngf(seed);
  const target = Math.max(24, Math.min(144, Math.round((28 + (L - 1) * 8) * fk / 2) * 2));
  let P = null; for (let k = 0; k < 20 && !P; k++) P = genLayout(r, target);
  tiles = P.map((p, i) => ({ ...p, id: i, face: 0, alive: true }));
  const order = removalOrder(tiles, r);
  const kinds = []; const nk = Math.ceil(tiles.length / 4);
  const sh = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const nums = sh(Array.from({ length: 27 }, (_, i) => i)), embl = sh(Array.from({ length: 9 }, (_, i) => 27 + i)), ne = Math.min(9, Math.max(1, Math.round(nk * 0.3)));
  const pool = sh([...embl.slice(0, ne), ...nums.slice(0, nk - ne)]);
  for (let i = 0; i < order.length; i++) kinds.push(pool[Math.floor(i / 2) % nk]);
  for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
  order.forEach(([a, b], i) => { a.face = b.face = kinds[i]; });
  plan = order.map(([a, b]) => [a.id, b.id]);
  th = THEMES[((D.isDaily ? D.seed : level) - 1) % THEMES.length];
  score = 0; moves = 0; sel = null; history = []; hints = 3; shuffles = Math.max(1, Math.min(3, Math.round(2 / fk))); recorded = false; beatenShown = false; combo = 0; hintPair = null; anims = []; totalPairs = tiles.length / 2;
  ui.levels(D.isDaily ? 1 : level); if (D.isDaily) { ui.els.top.querySelector('[data-a]').textContent = '★'; ui.els.top.querySelector('[data-b]').textContent = '✓'; }
  fit(); hud();
  // entrance: tiles drop in by layer
  tiles.forEach(t => { t.drop = 1 + t.z * 0.5 + Math.random() * 0.3; });
}
function fit() {
  const W = innerWidth, H = innerHeight, top = 84, bottom = 110;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, mz = 0;
  for (const t of tiles) { x0 = Math.min(x0, t.x - 1); x1 = Math.max(x1, t.x + 1); y0 = Math.min(y0, t.y - 1); y1 = Math.max(y1, t.y + 1); mz = Math.max(mz, t.z); }
  const uw = (x1 - x0) / 2, uh = (y1 - y0) / 2;
  TW = Math.floor(Math.min(64, (W - 22) / (uw + 0.15 + mz * 0.1), (H - top - bottom) / (uh * 1.3 + 0.15 + mz * 0.1)));
  TH = Math.round(TW * 1.3); DEP = Math.max(3, Math.round(TW * 0.11)); PAD = DEP * 2;
  view.ox = (W - uw * TW) / 2 - x0 * TW / 2 + mz * DEP * 0.5; view.oy = top + (H - top - bottom - uh * TH) / 2 - y0 * TH / 2 + mz * DEP * 0.5;
  cv.width = W * dpr; cv.height = H * dpr;
  makeSprites(th); cv.width = W * dpr; cv.height = H * dpr; paintBg();
}
let bgCanvas = null;
function paintBg() {
  const W = innerWidth, H = innerHeight; bgCanvas = document.createElement('canvas'); bgCanvas.width = W * dpr; bgCanvas.height = H * dpr;
  const c = bgCanvas.getContext('2d'); c.scale(dpr, dpr);
  const gr = c.createRadialGradient(W / 2, H * 0.42, 20, W / 2, H * 0.5, H * 0.75); th.bg.forEach((col, i) => gr.addColorStop(i / 2, col)); c.fillStyle = gr; c.fillRect(0, 0, W, H);
  // bamboo silhouettes at the edges
  const r = rngf(level * 17 + 3); c.globalAlpha = 0.22; c.fillStyle = th.leaf; c.strokeStyle = th.leaf;
  for (const side of [0, 1]) for (let k = 0; k < 3; k++) {
    const x = side ? W - 14 - k * 22 - r() * 8 : 14 + k * 22 + r() * 8, w = 7 - k;
    c.globalAlpha = 0.22 - k * 0.05;
    for (let y = H; y > H * (0.15 + r() * 0.3); y -= 46) { c.fillRect(x - w / 2, y - 44, w, 42); }
    for (let n = 0; n < 4; n++) { const ly = H * (0.25 + r() * 0.6), d = side ? -1 : 1; c.beginPath(); c.ellipse(x + d * 20, ly, 22, 5, d * 0.5, 0, 7); c.fill(); }
  }
  c.globalAlpha = 1;
  const v = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.4)'); c.fillStyle = v; c.fillRect(0, 0, W, H);
}
addEventListener('resize', () => tiles.length && fit());
const screenPos = (t) => [view.ox + t.x * TW / 2 - TW / 2 - t.z * DEP, view.oy + t.y * TH / 2 - TH / 2 - t.z * DEP];
const liveSet = () => tiles.filter(t => t.alive);
const isFree = (t) => freeIn(t, liveSet());

function render(now) {
  const W = innerWidth, H = innerHeight;
  g.setTransform(1, 0, 0, 1, 0, 0); if (bgCanvas) g.drawImage(bgCanvas, 0, 0); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const live = liveSet(), order = [...live, ...anims.map(a => a.t)].sort((a, b) => a.z - b.z || a.y - b.y || a.x - b.x);
  const freeMap = new Map(live.map(t => [t, freeIn(t, live)]));
  for (const t of order) {
    let [x, y] = screenPos(t); let alpha = 1, sc = 1;
    if (t.drop > 0) { t.drop = Math.max(0, t.drop - 0.045); const e = Math.min(1, t.drop); y -= e * e * 120; alpha = 1 - e; }
    const an = anims.find(a => a.t === t);
    if (an) { const p = Math.min(1, (now - an.t0) / 380), e = p * p; x += (an.mx - x) * e; y += (an.my - y) * e - Math.sin(p * Math.PI) * 30; sc = 1 - e * 0.35; alpha = 1 - Math.max(0, (p - 0.6) / 0.4); }
    if (t === sel) y -= 4;
    if (t.shake) { x += Math.sin(t.shake * 1.3) * t.shake * 0.6; t.shake = Math.max(0, t.shake - 1); }
    g.globalAlpha = alpha;
    const w = (TW + DEP + PAD * 2) * sc, h = (TH + DEP + PAD * 2) * sc;
    g.drawImage(SPR[t.face], x + (TW - TW * sc) / 2 - PAD * sc, y + (TH - TH * sc) / 2 - PAD * sc, w, h);
    if (!an && !freeMap.get(t)) { g.fillStyle = 'rgba(40,30,20,.17)'; g.beginPath(); g.roundRect(x, y, TW, TH, TW * 0.14); g.fill(); }
    if (t === sel) { g.fillStyle = 'rgba(231,180,90,.38)'; g.beginPath(); g.roundRect(x, y, TW, TH, TW * 0.14); g.fill(); g.strokeStyle = '#e7a63a'; g.lineWidth = 2.5; g.stroke(); }
    if (hintPair && hintPair.includes(t) && !an) { g.strokeStyle = `rgba(255,236,170,${0.6 + Math.sin(now / 160) * 0.4})`; g.lineWidth = 3; g.beginPath(); g.roundRect(x - 1, y - 1, TW + 2, TH + 2, TW * 0.15); g.stroke(); }
    g.globalAlpha = 1;
  }
  anims = anims.filter(a => now - a.t0 < 400);
  requestAnimationFrame(render);
}
requestAnimationFrame(render);

function hud() {
  $('[data-s]').textContent = score.toLocaleString(); $('[data-p]').textContent = liveSet().length / 2; $('[data-m]').textContent = availablePairs().length;
  const hi = $('[data-hint] i'), si = $('[data-shuf] i'); hi.textContent = hints; hi.classList.toggle('off', !hints); si.textContent = shuffles; si.classList.toggle('off', !shuffles);
  ui.progress(1 - liveSet().length / tiles.length);
}
function availablePairs() {
  const live = liveSet(), fr = live.filter(t => freeIn(t, live)), out = [];
  for (let i = 0; i < fr.length; i++) for (let j = i + 1; j < fr.length; j++) if (fr[i].face === fr[j].face) out.push([fr[i], fr[j]]);
  return out;
}
function pick(px, py) {
  const live = liveSet().sort((a, b) => b.z - a.z || b.y - a.y || b.x - a.x);
  for (const t of live) { const [x, y] = screenPos(t); if (px >= x && px <= x + TW && py >= y && py <= y + TH) return t; }
  return null;
}
function tap(t) {
  if (state !== 'play' || !t) return;
  if (!isFree(t)) { t.shake = 12; soft.err(); buzz(15); return; }
  if (!sel) { sel = t; soft.wood(); return; }
  if (sel === t) { sel = null; soft.click(); return; }
  if (sel.face !== t.face) { sel = t; soft.wood(); return; }
  match(sel, t);
}
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on level 1, until the first real touch,
// the solver's next free pair is tapped for you, one lantern then the other, and lifts away (points given back); the rest is yours
let demoPair = null;
demo((n) => {
  if (n === 1) { while (plan.length && !(tiles[plan[0][0]].alive && tiles[plan[0][1]].alive)) plan.shift();
    demoPair = plan.length && isFree(tiles[plan[0][0]]) && isFree(tiles[plan[0][1]]) ? [tiles[plan[0][0]], tiles[plan[0][1]]] : availablePairs()[0];
    if (!demoPair || liveSet().length <= 4) return false; sel = null; tap(demoPair[0]); return; }
  if (sel !== demoPair[0]) return false; const s0 = score; tap(demoPair[1]); score = s0; hud();
}, { ready: () => state === 'play' && level === 1 && !D.isDaily && !tiles.some(t => t.drop > 0.2), wait: 1800, every: 800, max: 2 });
function match(a, b) {
  const [ax, ay] = screenPos(a), [bx, by] = screenPos(b), mx = (ax + bx) / 2, my = (ay + by) / 2 - 10, now = performance.now();
  a.alive = b.alive = false; sel = null; hintPair = null; moves++;
  anims.push({ t: a, t0: now, mx, my }, { t: b, t0: now, mx, my });
  history.push([a, b]);
  combo = now - lastMatch < 4000 ? combo + 1 : 1; lastMatch = now;
  const pts = 20 + (combo - 1) * 10; score += pts;
  setTimeout(() => { fx.sparks(mx + TW / 2, my + TH / 2, ['#ffe7a8', '#fff', '#e7a63a'], 14, { speed: 3.4, size: 3.4 }); fx.ring(mx + TW / 2, my + TH / 2, '#ffe7a8', 26); }, 330);
  chime(combo - 1, 69, 0.12); setTimeout(() => soft.wood(), 330); buzz(10);
  if (combo >= 3) ui.pop(`COMBO ×${combo}`, '#ffe7a8', 24 + Math.min(combo, 8) * 2, 22);
  if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); fx.confetti(60); }
  hud();
  if (!liveSet().length) return setTimeout(win, 450);
  if (!availablePairs().length) setTimeout(stuck, 500);
}
function stuck() {
  if (state !== 'play' || availablePairs().length || !liveSet().length) return;
  if (shuffles > 0) { ui.pop('No pairs left — Shuffle', '#fff', 22, 22); $('[data-shuf]').classList.add('pulse'); }
  else lose();
}
function undo() {
  if (state !== 'play') return; const h = history.pop(); if (!h) return;
  h.forEach(t => { t.alive = true; t.drop = 0.4; }); sel = null; hintPair = null; score = Math.max(0, score - 20); moves--; combo = 0; soft.swish(); hud();
}
function hint() {
  if (state !== 'play' || !hints) return; const av = availablePairs(); if (!av.length) return stuck();
  hints--; hintPair = av[0]; chime(4, 76, 0.1); hud();
}
function shuffle() {
  if (state !== 'play' || !shuffles) return;
  const live = liveSet(), faces = live.map(t => t.face).sort((a, b) => a - b), pairFaces = [];
  for (let i = 0; i < faces.length; i += 2) pairFaces.push(faces[i]);
  const r = rngf((Math.random() * 1e9) | 0), order = removalOrder(live, r); if (!order) return;
  for (let i = pairFaces.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pairFaces[i], pairFaces[j]] = [pairFaces[j], pairFaces[i]]; }
  order.forEach(([a, b], i) => { a.face = b.face = pairFaces[i]; a.drop = b.drop = 0.5 + Math.random() * 0.3; });
  plan = order.map(([a, b]) => [a.id, b.id]); history = [];
  shuffles--; sel = null; hintPair = null; $('[data-shuf]').classList.remove('pulse'); arp([72, 76, 79], 60, 0.09); soft.swish(); hud();
}
$('[data-undo]').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); undo(); });
$('[data-hint]').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); hint(); });
$('[data-shuf]').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); shuffle(); });
cv.addEventListener('pointerdown', (e) => { e.preventDefault(); tap(pick(e.clientX, e.clientY)); });

function win() {
  if (state !== 'play') return;
  state = 'won'; if (!recorded) { recorded = true; B.submit(1); if (!D.isDaily) F.level(true); }
  arp([67, 71, 74, 79, 83, 86], 110, 0.12, 0.9); fx.confetti(140, ['#e7b45a', '#fff', '#c9443c', '#7cc6a4', '#f3ead8']); buzz([20, 60, 20]);
  if (D.isDaily) { const k = 'daily_' + todayKey(), prev = S.get(k, null); if (!prev || score > prev.s) S.set(k, { s: score }); }
  else { level++; S.set('level', level); }
  D.won(score);
  ui.win(D.isDaily ? '' : level - 1, `${totalPairs} pairs · ${score.toLocaleString()} pts`);
}
function lose() {
  if (state !== 'play') return;
  state = 'lost'; const cl = 1 - liveSet().length / tiles.length;
  if (!recorded) { recorded = true; if (!D.isDaily) F.level(false, cl); }
  ui.lose('No pairs left', `${Math.round(cl * 100)}% cleared · tap to replay this board`);
}
ui.onTap((which) => { B.start();
  if (which === 'start') { state = 'play'; return; }
  if (which === 'win' && D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
  build(); state = 'play';
});
build();

// ---------------------------------------------------------------- test hook: the bot taps along the known solution (falls back to any free pair)
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play' || tiles.some(t => t.drop > 0.2)) return;
    const byId = (id) => tiles[id];
    while (plan.length && !(byId(plan[0][0]).alive && byId(plan[0][1]).alive)) plan.shift();
    let pair = plan.length && isFree(byId(plan[0][0])) && isFree(byId(plan[0][1])) ? [byId(plan[0][0]), byId(plan[0][1])] : availablePairs()[0];
    if (!pair) { if (shuffles) shuffle(); return; }
    if (sel === pair[0]) tap(pair[1]); else if (sel === pair[1]) tap(pair[0]); else tap(pair[0]);
  },
};
