// Knobble — calm jigsaw puzzles with real tab-and-blank pieces. Every picture is painted in code (lakes, balloons,
// reefs, mandalas, window cats, night villages, quilts). 9 / 16 / 36 / 64 pieces; drag pieces from the tray (edge sort:
// All / Edges / Inside) onto the board, they snap when close. ?daily=1 gives everyone today's picture.
import { createUI, store, buzz, tone, note } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { css, cardTheme, startCard, fx2d, arp, soft, chime, fmtTime } from './calm.js';
import { paint, rngOf } from './pictures.js';

const NAME = 'Knobble: Jigsaw Puzzles';
const S = store('knobble');
const F = flow('knobble');   // recorded only: a jigsaw has no fail state, so no difficulty knob (FLOW_BRIEF rule 4)
const SIZES = [3, 4, 6, 8];
const ACC = '#e0703c', INK = '#33291f';
const ui = createUI({ title: 'Knobble', hint: 'Tap to play', hand: '', score: false });
cardTheme({ accent: ACC });
const D = daily('knobble', ui, { name: NAME });
const B = board({ game: 'knobble', label: 'Puzzles completed', limits: { maxRun: 1, maxPerSec: 0.5 }, mode: 'sum', corner: 'tl' });
let sizeI = S.get('size', 1);
startCard(ui, D, { kicker: D.isDaily ? "today's jigsaw" : 'jigsaw puzzles', chips: { items: SIZES.map(n => `${n * n} pieces`), get: () => sizeI, set: i => { sizeI = i; S.set('size', i); } } });
const fx = fx2d(11);
ui.els.win.querySelector('h1').textContent = 'Complete!';
ui.els.win.querySelector('p').innerHTML = 'Puzzle <span data-l>1</span>';

css(`
body{background:radial-gradient(120% 70% at 50% 0%,#fff7ec,#f3e3d3);color:${INK}}
body:before{content:'';position:fixed;inset:0;background-image:radial-gradient(rgba(160,110,60,.10) 1.2px,transparent 1.6px);background-size:22px 22px;pointer-events:none}
#kb{position:fixed;inset:0;width:100%;height:100%;z-index:2;touch-action:none}
.hc-top .hc-lvl{width:28px;height:28px;font-size:14px;font-family:inherit;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,.12)}
.hc-top .hc-lvl.next{background:rgba(255,255,255,.85);color:${ACC}}
.hc-top .hc-bar{background:rgba(255,255,255,.75);height:8px}
.hc-sub{top:calc(50px + env(safe-area-inset-top));font-size:11px;letter-spacing:3px;text-transform:uppercase;font-weight:750;color:${INK};opacity:.55;text-shadow:none}
.hc-pop{color:${INK}!important;text-shadow:0 0 14px #fff,0 0 4px #fff!important}
#kb-bar{position:fixed;left:0;right:0;bottom:calc(14px + env(safe-area-inset-bottom));display:flex;justify-content:center;gap:28px;z-index:5}
.kb-b{display:flex;flex-direction:column;align-items:center;gap:4px;font:inherit;font-size:11px;font-weight:750;color:${INK};background:none;border:0;cursor:pointer;letter-spacing:1px;text-transform:uppercase;padding:0;touch-action:none}
.kb-b .c{width:50px;height:50px;border-radius:50%;background:#fff;box-shadow:0 6px 18px rgba(90,50,20,.14);display:flex;align-items:center;justify-content:center;transition:transform .12s}
.kb-b:active .c,.kb-b.on .c{transform:scale(.92);background:${ACC}} .kb-b.on svg{stroke:#fff}
.kb-b svg{width:24px;height:24px;stroke:${INK};fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
`);
const cv = document.createElement('canvas'); cv.id = 'kb'; document.body.appendChild(cv);
const g = cv.getContext('2d');
const bar = document.createElement('div'); bar.id = 'kb-bar'; document.body.appendChild(bar);
function button(label, svg) { const b = document.createElement('button'); b.className = 'kb-b'; b.innerHTML = `<div class="c">${svg}</div>${label}`; bar.appendChild(b); b.addEventListener('pointerdown', e => e.stopPropagation()); return b; }
const hintB = button('Hint', '<svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 00-3.5 10.9c.6.4 1 1.1 1 1.9V16h5v-.2c0-.8.4-1.5 1-1.9A6 6 0 0012 3z"/></svg>');
const peekB = button('Peek', '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>');
const ghostB = button('Ghost', '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 15l5-5 4 4 3-3 6 6"/></svg>');
let peek = false, ghost = S.get('ghost', true);
peekB.addEventListener('pointerdown', () => { peek = true; peekB.classList.add('on'); soft.click(); });
addEventListener('pointerup', () => { if (peek) { peek = false; peekB.classList.remove('on'); } });
ghostB.addEventListener('click', () => { ghost = !ghost; S.set('ghost', ghost); ghostB.classList.toggle('on', ghost); soft.click(); });
ghostB.classList.toggle('on', ghost);
hintB.addEventListener('click', () => hint());

// ---------------------------------------------------------------- state
let state = 'ready', level = S.get('level', 1), solved = S.get('solved', 0), N = 4, pieces = [], title = '', t0 = 0, secs = 0, filter = 0, scroll = 0, recorded = false, doneAt = 0;
let pic = null, hT = [], vT = [], hJ = [], vJ = [], drag = null, sel = null, flies = [], hintAt = 0, hintP = null, beatenShown = false;
const PAD = 0.36;

function newPuzzle() {
  N = SIZES[sizeI]; const seed = D.seed ? D.seed * 13 + 7 : level * 7919 + 101, r = rngOf(seed + N);
  hT = []; vT = []; hJ = []; vJ = [];
  for (let i = 0; i < N; i++) { hT.push([]); vT.push([]); hJ.push([]); vJ.push([]); for (let j = 0; j < N; j++) { hT[i].push(r() < 0.5 ? 1 : -1); vT[i].push(r() < 0.5 ? 1 : -1); hJ[i].push((r() - 0.5) * 0.1); vJ[i].push((r() - 0.5) * 0.1); } }
  pieces = [];
  for (let i = 0; i < N * N; i++) { const pr = (i / N) | 0, pc = i % N; pieces.push({ i, r: pr, c: pc, edge: pr === 0 || pc === 0 || pr === N - 1 || pc === N - 1, placed: false, at: 0, ord: r(), can: null }); }
  pieces.sort((a, b) => a.ord - b.ord).forEach((p, k) => p.ord = k); pieces.sort((a, b) => a.i - b.i);
  title = '';
  state = 'play'; t0 = performance.now(); secs = 0; scroll = 0; filter = 0; recorded = false; doneAt = 0; drag = null; sel = null; flies = []; hintP = null;
  layout(seed);
  ui.levels(D.isDaily ? 1 : level); ui.progress(0);
  if (D.isDaily) { ui.els.top.querySelector('[data-a]').textContent = '★'; ui.els.top.querySelector('[data-b]').textContent = '✓'; }
  ui.sub(`${D.isDaily ? 'Daily · ' : ''}${title} · ${N * N} pieces`);
  B.start();
}

// ---------------------------------------------------------------- geometry
let dpr = 1, W = 0, H = 0, geo = { x: 0, y: 0, s: 300, c: 75, tx: 0, ty: 0, tw: 300, ts: 70, chipY: 0 }, lastSeed = 0;
function layout(seed = lastSeed) {
  lastSeed = seed; dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr;
  const ts = Math.max(60, Math.min(84, W / 5.3)), trayH = ts * 2 + 8, chipH = 34, bottom = 76, top = 108;
  const s = Math.floor(Math.min(W - 28, H - top - trayH - chipH - bottom - 22, 560) / N) * N;
  const y = Math.round(top + Math.max(0, (H - top - trayH - chipH - bottom - 22 - s) * 0.3));
  const tw = Math.min(W - 16, Math.max(s + 40, 720));
  geo = { x: Math.round((W - s) / 2), y, s, c: s / N, ts, chipY: y + s + 16, tx: Math.round((W - tw) / 2), ty: y + s + 16 + chipH + 6, tw };
  if (!pieces.length) return;
  // the picture at board size, then one canvas per piece
  pic = document.createElement('canvas'); pic.width = pic.height = Math.round(s * dpr);
  title = paint(pic.getContext('2d'), pic.width, seed);
  for (const p of pieces) p.can = cut(p);
}
function edge(x0, y0, x1, y1, t, j, path) {
  const dx = x1 - x0, dy = y1 - y0, nx = dy, ny = -dx, P = (u, v) => [x0 + dx * u + nx * v * t, y0 + dy * u + ny * v * t];
  if (!t) { path.lineTo(x1, y1); return; }
  const K = [[0.37 + j, 0], [0.42 + j, 0, 0.45 + j, 0.08, 0.40 + j, 0.14], [0.33 + j, 0.24, 0.42 + j, 0.32, 0.50 + j, 0.32], [0.58 + j, 0.32, 0.67 + j, 0.24, 0.60 + j, 0.14], [0.55 + j, 0.08, 0.58 + j, 0, 0.63 + j, 0]];
  path.lineTo(...P(K[0][0], K[0][1]));
  for (let k = 1; k < 5; k++) { const q = K[k]; path.bezierCurveTo(...P(q[0], q[1]), ...P(q[2], q[3]), ...P(q[4], q[5])); }
  path.lineTo(x1, y1);
}
function piecePath(p, ox, oy, c) {
  const path = new Path2D(), { r, c: k } = p;
  path.moveTo(ox, oy);
  edge(ox, oy, ox + c, oy, r === 0 ? 0 : -hT[r - 1][k], r === 0 ? 0 : -hJ[r - 1][k], path);
  edge(ox + c, oy, ox + c, oy + c, k === N - 1 ? 0 : vT[r][k], k === N - 1 ? 0 : vJ[r][k], path);
  edge(ox + c, oy + c, ox, oy + c, r === N - 1 ? 0 : hT[r][k], r === N - 1 ? 0 : hJ[r][k], path);
  edge(ox, oy + c, ox, oy, k === 0 ? 0 : -vT[r][k - 1], k === 0 ? 0 : -vJ[r][k - 1], path);
  path.closePath(); return path;
}
function cut(p) {
  const c = geo.c, size = c * (1 + 2 * PAD), can = document.createElement('canvas'); can.width = can.height = Math.ceil(size * dpr);
  const x = can.getContext('2d'); x.scale(dpr, dpr);
  const path = piecePath(p, PAD * c, PAD * c, c);
  x.save(); x.clip(path);
  x.drawImage(pic, (p.c * c - PAD * c) * dpr, (p.r * c - PAD * c) * dpr, size * dpr, size * dpr, 0, 0, size, size);
  // bevel: light top-left, shade bottom-right
  x.lineWidth = Math.max(2, c * 0.05);
  x.translate(1, 1); x.strokeStyle = 'rgba(0,0,0,.28)'; x.stroke(path);
  x.translate(-2, -2); x.strokeStyle = 'rgba(255,255,255,.5)'; x.stroke(path);
  x.restore();
  x.lineWidth = 1; x.strokeStyle = 'rgba(60,40,20,.35)'; x.stroke(path);
  return can;
}
addEventListener('resize', () => { if (pieces.length) layout(); });

// tray contents (unplaced, filtered, in shuffled order)
const trayList = () => pieces.filter(p => !p.placed && p !== (drag && drag.p) && !flies.some(f => f.p === p) && (filter === 0 || (filter === 1 ? p.edge : !p.edge))).sort((a, b) => a.ord - b.ord);
function slotOf(k) { const { tx, ty, ts } = geo; return [tx + 12 + Math.floor(k / 2) * ts + ts / 2 - scroll, ty + (k % 2) * ts + ts / 2 + 4]; }
const maxScroll = () => Math.max(0, Math.ceil(trayList().length / 2) * geo.ts + 24 - geo.tw);
const trayScale = () => (geo.ts * 0.6) / geo.c;
const target = p => [geo.x + (p.c + 0.5) * geo.c, geo.y + (p.r + 0.5) * geo.c];
const CHIPS = ['All', 'Edges', 'Inside'];
function chipRects() { const w = 76, gap = 8, x0 = W / 2 - (w * 3 + gap * 2) / 2; return CHIPS.map((t, i) => [x0 + i * (w + gap), geo.chipY, w, 30]); }

// ---------------------------------------------------------------- input
function place(p, fromX, fromY, fromS) {
  const [x, y] = target(p);
  flies.push({ p, x0: fromX, y0: fromY, s0: fromS, x1: x, y1: y, s1: 1, at: performance.now(), dur: 180, done: () => {
    p.placed = true; p.at = performance.now(); soft.wood(); tone(880 + Math.random() * 120, 0.05, 'sine', 0.06, 1.3); buzz(8);
    fx.sparks(x, y, ['#fff', '#ffe08a', ACC], 7, { speed: 2.4, size: 3 });
    const n = pieces.filter(q => q.placed).length; ui.progress(n / pieces.length);
    if (n === pieces.length) finish();
    else if (n % Math.max(3, N) === 0) chime(n / N, 72, 0.06);
  } });
}
function flyBack(p, fromX, fromY) {
  flies.push({ p, x0: fromX, y0: fromY, s0: 1, x1: fromX, y1: Math.max(fromY, geo.ty + geo.ts), s1: trayScale(), at: performance.now(), dur: 200, done: () => {} });
  soft.err(); buzz([5, 20, 5]);
}
const loc = e => [e.clientX, e.clientY];
let down = null;
cv.addEventListener('pointerdown', e => {
  if (state !== 'play') return;
  const [x, y] = loc(e); try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  // filter chips
  const ch = chipRects().findIndex(([cx, cy, w, h]) => x >= cx && x < cx + w && y >= cy && y < cy + h);
  if (ch >= 0) { filter = ch; scroll = 0; soft.click(); return; }
  // tray piece?
  if (y >= geo.ty - 4 && y <= geo.ty + geo.ts * 2 + 10) {
    const L = trayList(); let hit = null;
    L.forEach((p, k) => { const [sx, sy] = slotOf(k); if (Math.abs(x - sx) < geo.ts / 2 && Math.abs(y - sy) < geo.ts / 2) hit = p; });
    down = { x, y, p: hit, mode: null, scroll0: scroll }; return;
  }
  // board tap while a piece is selected: place it if this is its spot
  if (sel && x >= geo.x && x < geo.x + geo.s && y >= geo.y && y < geo.y + geo.s) {
    const c = Math.floor((x - geo.x) / geo.c), r = Math.floor((y - geo.y) / geo.c);
    const L = trayList(), k = L.indexOf(sel), [sx, sy] = k >= 0 ? slotOf(k) : [x, y];
    if (sel.r === r && sel.c === c) { const p = sel; sel = null; place(p, sx, sy, trayScale()); } else { soft.err(); buzz([5, 20, 5]); hintP = sel; hintAt = performance.now() - 1200; }
  }
});
cv.addEventListener('pointermove', e => {
  if (!down && !drag) return;
  const [x, y] = loc(e);
  if (drag) { drag.x = x; drag.y = y; return; }
  const dx = x - down.x, dy = y - down.y;
  if (!down.mode) {
    if (down.p && Math.abs(dy) > 7 && Math.abs(dy) > Math.abs(dx) * 0.8) { down.mode = 'drag'; drag = { p: down.p, x, y }; sel = null; tone(660, 0.04, 'sine', 0.05, 1.3); buzz(4); }
    else if (Math.abs(dx) > 7) down.mode = 'scroll';
  }
  if (down.mode === 'scroll') scroll = Math.max(0, Math.min(maxScroll(), down.scroll0 - dx));
});
const up = e => {
  if (drag) {
    const p = drag.p, [tx, ty] = target(p), cx = drag.x, cy = drag.y - geo.c * 0.35;
    drag = null; down = null;
    if (Math.hypot(cx - tx, cy - ty) < geo.c * 0.5) place(p, cx, cy, 1); else flyBack(p, cx, cy);
    return;
  }
  if (down && !down.mode && down.p) { sel = sel === down.p ? null : down.p; soft.click(); }
  down = null;
};
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
cv.addEventListener('wheel', e => { scroll = Math.max(0, Math.min(maxScroll(), scroll + (e.deltaX || e.deltaY))); }, { passive: true });

function hint() {
  if (state !== 'play') return;
  const L = pieces.filter(p => !p.placed && !flies.some(f => f.p === p));
  if (!L.length) return;
  const p = L.find(q => q.edge) || L[0];
  if (filter === 2 && p.edge) filter = 0; if (filter === 1 && !p.edge) filter = 0;
  const k = trayList().indexOf(p); scroll = Math.max(0, Math.min(maxScroll(), Math.floor(k / 2) * geo.ts - geo.tw / 2 + geo.ts));
  hintP = p; hintAt = performance.now(); sel = p; chime(4, 76, 0.08);
}
function finish() {
  state = 'won'; doneAt = performance.now();
  const ms = performance.now() - t0, t = Math.round(ms / 1000);
  solved++; S.set('solved', solved);
  if (!recorded) { recorded = true; if (!D.isDaily) F.level(true); B.submit(1, { ms }); }
  const bk = 'best_' + N, prev = S.get(bk, 0), nb = !prev || t < prev; if (nb) S.set(bk, t);
  if (!D.isDaily) { level++; S.set('level', level); }
  arp([67, 72, 76, 79, 84, 88], 85, 0.11, 0.9); buzz([20, 40, 20]); setTimeout(() => fx.confetti(), 500);
  if (!beatenShown && D.beaten(solved)) { beatenShown = true; setTimeout(() => ui.pop('BEATEN!', INK, 40, 30), 600); }
  D.won(solved, 'completed');
  setTimeout(() => ui.win(D.isDaily ? 'Daily' : level - 1, `${title} · ${N * N} pieces · ${fmtTime(t)}${nb && prev ? ' · new best!' : ''}`), 900);
}
ui.onTap(which => { if (which === 'win' && D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; } newPuzzle(); });

// ---------------------------------------------------------------- drawing
function rr(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function drawPiece(p, cx, cy, sc, shadow = 0) {
  const c = geo.c, size = c * (1 + 2 * PAD) * sc;
  if (shadow) { g.save(); g.shadowColor = 'rgba(60,30,10,.35)'; g.shadowBlur = shadow; g.shadowOffsetY = shadow * 0.4; }
  g.drawImage(p.can, cx - size / 2, cy - size / 2, size, size);
  if (shadow) g.restore();
}
const ease = t => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
function draw() {
  const now = performance.now();
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  if (!pieces.length || !pic) return;
  const { x, y, s, c } = geo;
  // board
  g.save(); g.shadowColor = 'rgba(90,50,20,.22)'; g.shadowBlur = 26; g.shadowOffsetY = 10; rr(x - 10, y - 10, s + 20, s + 20, 16); g.fillStyle = '#fffaf3'; g.fill(); g.restore();
  rr(x, y, s, s, 4); g.fillStyle = '#efe2d2'; g.fill();
  if (ghost) { g.globalAlpha = 0.2; g.drawImage(pic, x, y, s, s); g.globalAlpha = 1; }
  g.strokeStyle = 'rgba(120,80,40,.12)'; g.lineWidth = 1; for (let i = 1; i < N; i++) { g.beginPath(); g.moveTo(x + i * c, y); g.lineTo(x + i * c, y + s); g.moveTo(x, y + i * c); g.lineTo(x + s, y + i * c); g.stroke(); }
  // placed pieces
  for (const p of pieces) if (p.placed) { const k = (now - p.at) / 220, pop = k < 1 ? 1 + Math.sin(k * Math.PI) * 0.06 : 1; const [tx, ty] = target(p); drawPiece(p, tx, ty, pop, k < 1 ? 8 : 0); }
  if (doneAt) { const k = ease((now - doneAt) / 700); g.globalAlpha = k; g.drawImage(pic, x, y, s, s); g.globalAlpha = 1;
    const sw = ((now - doneAt) / 900) % 3; if (sw < 1) { g.save(); rr(x, y, s, s, 4); g.clip(); const gx = x - s * 0.3 + sw * s * 1.6, gr = g.createLinearGradient(gx - 60, 0, gx + 60, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x, y, s, s); g.restore(); } }
  if (peek) { g.drawImage(pic, x, y, s, s); }
  // hint target
  if (hintP && now - hintAt < 2000 && !hintP.placed) { const k = 1 - (now - hintAt) / 2000; g.save(); g.globalAlpha = k; g.translate(x + hintP.c * c - PAD * c * 0, y + hintP.r * c); g.strokeStyle = ACC; g.lineWidth = 3; g.stroke(piecePath(hintP, 0, 0, c)); g.restore(); }
  // time + count line
  g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 15px -apple-system,system-ui,sans-serif';
  if (state === 'play') secs = (now - t0) / 1000;
  const left = pieces.filter(p => !p.placed).length;
  g.globalAlpha = 0.75; g.fillText(`⏱ ${fmtTime(secs)}   ·   ${left} left`, W / 2, y - 26); g.globalAlpha = 1;
  // chips
  chipRects().forEach(([cx, cy, w, h], i) => { rr(cx, cy, w, h, h / 2); g.fillStyle = i === filter ? ACC : 'rgba(255,255,255,.9)'; g.fill(); g.fillStyle = i === filter ? '#fff' : INK; g.font = '700 13px -apple-system,system-ui,sans-serif';
    const n = pieces.filter(p => !p.placed && (i === 0 || (i === 1 ? p.edge : !p.edge))).length; g.fillText(`${CHIPS[i]} ${n}`, cx + w / 2, cy + h / 2 + 1); });
  // tray
  const { tx, ty, tw, ts } = geo;
  g.save(); g.shadowColor = 'rgba(90,50,20,.15)'; g.shadowBlur = 16; g.shadowOffsetY = 5; rr(tx, ty - 2, tw, ts * 2 + 12, 18); g.fillStyle = 'rgba(255,255,255,.72)'; g.fill(); g.restore();
  g.save(); rr(tx, ty - 2, tw, ts * 2 + 12, 18); g.clip();
  const L = trayList(), sc = trayScale();
  L.forEach((p, k) => { const [sx, sy] = slotOf(k); if (sx < tx - ts || sx > tx + tw + ts) return;
    if (p === sel) { rr(sx - ts / 2 + 3, sy - ts / 2 + 3, ts - 6, ts - 6, 12); g.fillStyle = 'rgba(224,112,60,.22)'; g.fill(); }
    const bob = hintP === p && now - hintAt < 2000 ? Math.sin(now / 90) * 3 : 0;
    drawPiece(p, sx, sy + bob, sc, 4); });
  if (!L.length && state === 'play') { g.fillStyle = INK; g.globalAlpha = 0.5; g.font = '600 14px -apple-system,system-ui,sans-serif'; g.fillText(filter ? 'No pieces here · try All' : '', tx + tw / 2, ty + ts); g.globalAlpha = 1; }
  // scroll hint fades at the ends
  if (scroll > 0) { const gr = g.createLinearGradient(tx, 0, tx + 30, 0); gr.addColorStop(0, 'rgba(243,227,211,.9)'); gr.addColorStop(1, 'rgba(243,227,211,0)'); g.fillStyle = gr; g.fillRect(tx, ty - 2, 30, ts * 2 + 12); }
  if (scroll < maxScroll()) { const gr = g.createLinearGradient(tx + tw - 30, 0, tx + tw, 0); gr.addColorStop(0, 'rgba(243,227,211,0)'); gr.addColorStop(1, 'rgba(243,227,211,.9)'); g.fillStyle = gr; g.fillRect(tx + tw - 30, ty - 2, 30, ts * 2 + 12); }
  g.restore();
  // flying + dragged pieces on top
  flies = flies.filter(f => { const k = ease((now - f.at) / f.dur); drawPiece(f.p, f.x0 + (f.x1 - f.x0) * k, f.y0 + (f.y1 - f.y0) * k, f.s0 + (f.s1 - f.s0) * k, 10); if (k >= 1) { f.done(); return false; } return true; });
  if (drag) drawPiece(drag.p, drag.x, drag.y - geo.c * 0.35, 1.06, 18);
}
function frame() { draw(); requestAnimationFrame(frame); }
requestAnimationFrame(frame);
ui.start();

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return solved * 1000 + pieces.filter(p => p.placed).length; },
  bot() {   // a steady human: edges first, then the middle, one piece every other beat
    if (state !== 'play' || drag || flies.length || (this._t = !this._t)) return;
    const L = pieces.filter(p => !p.placed).sort((a, b) => (b.edge - a.edge) || a.ord - b.ord);
    if (!L.length) return;
    const p = L[0]; filter = 0; const k = trayList().indexOf(p);
    scroll = Math.max(0, Math.min(maxScroll(), Math.floor(k / 2) * geo.ts - geo.tw / 2 + geo.ts));
    const [sx, sy] = slotOf(trayList().indexOf(p)); place(p, sx, sy, trayScale());
  },
};
