// Jellyfit — original 8×8 block puzzle. Drag the three offered jelly shapes onto the board; full rows and columns blast away.
// Keep clearing every few moves to grow a combo. The run ends when none of the offered shapes fits anywhere.
import { board as worldBoard } from './kit/board.js';
import { createUI, store, buzz, tone, loop } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { css, cardTheme, startCard, fx2d, chime, arp, soft, todayKey } from './calm.js';

const NAME = 'Jellyfit: Block Puzzle';
const S = store('jellyfit');
const F = flow('jellyfit', { par: 1500, warmup: 400 });
const ui = createUI({ title: 'Jellyfit', hint: 'Tap to play', hand: '', score: true, progress: true });
cardTheme({ accent: '#ffb627', font: "'Baloo 2',system-ui,sans-serif", serif: "'Baloo 2',system-ui,sans-serif" });
const D = daily('jellyfit', ui, { name: NAME });
const fx = fx2d(11);
const doneToday = S.get('daily_' + todayKey(), null);
startCard(ui, D, { kicker: D.isDaily ? 'Daily blocks' : 'block puzzle', doneLine: doneToday ? (D.isDaily ? `Today's best · ${doneToday.s.toLocaleString()} pts` : `Daily played ✓ ${doneToday.s.toLocaleString()} pts`) : null });
ui.els.win.querySelector('p').innerHTML = 'Run over<span data-l hidden></span>';
ui.els.win.querySelector('h1').textContent = 'New best!';
ui.els.win.querySelector('.hint').textContent = 'Tap to play again';
ui.els.lose.querySelector('.hint').textContent = 'Tap to play again';

css(`
body{background:#2b2386}
#jf{position:fixed;inset:0;width:100%;height:100%;display:block;touch-action:none}
.hc-score{font-family:'Baloo 2',system-ui,sans-serif;text-shadow:0 4px 0 rgba(0,0,0,.25);top:calc(44px + env(safe-area-inset-top))}
.hc-sub{top:calc(98px + env(safe-area-inset-top));font-weight:800;color:#ffd35c;opacity:1;text-shadow:0 2px 0 rgba(0,0,0,.25)}
.hc-top .hc-lvl{background:#ffb627;color:#3a2b00}.hc-top .hc-lvl.next{background:rgba(255,255,255,.18);color:#fff}
.hc-top .hc-bar{background:rgba(255,255,255,.16)}.hc-top .hc-bar i{background:linear-gradient(90deg,#ffb627,#ffd95c)}
.hc-pill{background:#ffb627;color:#3a2b00}
.hc-pop{font-family:'Baloo 2',system-ui,sans-serif;font-weight:800;text-shadow:0 4px 0 rgba(30,10,80,.55),0 0 18px rgba(30,10,80,.35)}
`);
const cv = document.createElement('canvas'); cv.id = 'jf'; document.body.prepend(cv);
const g = cv.getContext('2d');

// ---------------------------------------------------------------- colours + jelly block sprites
const COLS = [
  ['#ff4f6d', '#ff93a6', '#c12b4b'], ['#ff9a2e', '#ffc785', '#cc6a10'], ['#ffd23a', '#fff09a', '#d29f12'],
  ['#3fd476', '#9cf2b8', '#1f9a4e'], ['#27cfe8', '#a2f1fb', '#1393ad'], ['#3d7dff', '#9fc0ff', '#2350c8'], ['#a35cff', '#d4b0ff', '#6e2fd0'],
];
const GREY = ['#8a8aa8', '#c4c4d8', '#5e5e7a'];
const spriteCache = new Map();
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function sprite(col, size) {
  const key = col[0] + '|' + Math.round(size * 4);
  let s = spriteCache.get(key); if (s) return s;
  const dpr = Math.min(devicePixelRatio || 1, 2), px = Math.max(4, Math.round(size * dpr));
  s = document.createElement('canvas'); s.width = s.height = px; const c = s.getContext('2d'); c.scale(px / 100, px / 100);
  // outer bevel: darker frame with a bright top-left rim
  rr(c, 1, 1, 98, 98, 16); const og = c.createLinearGradient(0, 0, 100, 100); og.addColorStop(0, col[1]); og.addColorStop(0.5, col[0]); og.addColorStop(1, col[2]); c.fillStyle = og; c.fill();
  // inner face: glossy jelly gradient
  rr(c, 13, 13, 74, 74, 11); const ig = c.createLinearGradient(0, 13, 0, 87); ig.addColorStop(0, col[1]); ig.addColorStop(0.45, col[0]); ig.addColorStop(1, col[2]); c.fillStyle = ig; c.fill();
  c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2; c.stroke();
  // gloss highlight
  c.save(); rr(c, 13, 13, 74, 74, 11); c.clip();
  const hg = c.createLinearGradient(0, 13, 0, 50); hg.addColorStop(0, 'rgba(255,255,255,.75)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = hg; c.beginPath(); c.ellipse(42, 24, 30, 13, -0.15, 0, 7); c.fill(); c.restore();
  c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.ellipse(24, 22, 5, 3.4, -0.6, 0, 7); c.fill();
  spriteCache.set(key, s); return s;
}

// ---------------------------------------------------------------- shapes
const BASE = [
  ['1', 2], ['11', 4], ['111', 4], ['1111', 3], ['11111', 1.4, 1], ['11/11', 4], ['111/111/111', 1.1, 1], ['111/111', 2.4],
  ['10/11', 4], ['100/111', 3], ['100/100/111', 1.5, 1], ['111/010', 3], ['110/011', 2.4],
];
function cellsOf(str) { const out = []; str.split('/').forEach((row, r) => [...row].forEach((ch, c) => ch === '1' && out.push([r, c]))); return out; }
const rot = (cells) => { const h = Math.max(...cells.map(p => p[0])); return cells.map(([r, c]) => [c, h - r]); };
const norm = (cells) => { const mr = Math.min(...cells.map(p => p[0])), mc = Math.min(...cells.map(p => p[1])); return cells.map(([r, c]) => [r - mr, c - mc]).sort((a, b) => a[0] - b[0] || a[1] - b[1]); };
const SHAPES = BASE.map(([s, w, big]) => {
  const vars = [], seen = new Set(); let c = cellsOf(s);
  for (let k = 0; k < 4; k++) { const n = norm(c), key = JSON.stringify(n); if (!seen.has(key)) { seen.add(key); vars.push(n); } c = rot(c); }
  return { vars, w, big: !!big };
});

// ---------------------------------------------------------------- state
const N = 8;
let board = new Int8Array(64).fill(-1), pop = new Float32Array(64), grey = new Float32Array(64);
const B = worldBoard({ game: 'jellyfit', label: 'Points', limits: { maxRun: 400000, maxPerSec: 400 } });
let tray = [null, null, null], drag = null, state = 'ready', score = 0, shown = 0, best = S.get('best', 0), combo = 0, sinceClear = 9;
let level = 1, recorded = false, beatenShown = false, overT = 0, R = Math.random, shake = 0, clears = [], floats = [], comboT = 0, trayT = 0;
const L = { cell: 44, bx: 0, by: 0, size: 352, trayY: 640, slotW: 130 };
const T = (n) => 150 * n * (n + 1);   // score milestones that drive the level bar

function rngf(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function fits(cells, r0, c0, b = board) { for (const [r, c] of cells) { const rr2 = r0 + r, cc = c0 + c; if (rr2 < 0 || cc < 0 || rr2 >= N || cc >= N || b[rr2 * N + cc] >= 0) return false; } return true; }
function fitsAnywhere(cells, b = board) { for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (fits(cells, r, c, b)) return true; return false; }

function drawPiece() {
  const fk = F.k(score), tot = SHAPES.reduce((a, s) => a + s.w * (s.big ? fk * fk : 1), 0);
  let x = R() * tot, sh = SHAPES[0];
  for (const s of SHAPES) { x -= s.w * (s.big ? fk * fk : 1); if (x <= 0) { sh = s; break; } }
  const cells = sh.vars[Math.floor(R() * sh.vars.length)];
  return { cells, h: Math.max(...cells.map(p => p[0])) + 1, w: Math.max(...cells.map(p => p[1])) + 1, col: Math.floor(R() * COLS.length) };
}
function refill() {
  let set;
  for (let k = 0; k < 24; k++) { set = [drawPiece(), drawPiece(), drawPiece()]; if (set.some(p => fitsAnywhere(p.cells))) break; }
  tray = set; trayT = performance.now(); soft.swish();
}

// ---------------------------------------------------------------- layout
function layout() {
  const W = innerWidth, H = innerHeight, dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const top = Math.max(138, H * 0.165);
  L.size = Math.min(W - 24, (H - top) * 0.62, 460); L.cell = L.size / N;
  L.bx = (W - L.size) / 2; L.by = top;
  const below = L.by + L.size;
  L.trayY = below + Math.min(150, (H - below) * 0.5);
  L.slotW = Math.min(W, 520) / 3; L.trayX = (W - L.slotW * 3) / 2;
  spriteCache.clear();
}
addEventListener('resize', layout);

// ---------------------------------------------------------------- run
function newRun() {
  board.fill(-1); pop.fill(0); grey.fill(0); clears = []; floats = [];
  B.start(); score = 0; shown = 0; combo = 0; sinceClear = 9; level = 1; recorded = false; beatenShown = false; overT = 0; drag = null;
  R = rngf(D.seed ? D.seed * 977 + 13 : (Date.now() % 2147483647) ^ 0x5f3759df);
  ui.levels(1); ui.progress(0); ui.score(0); ui.sub(best ? '👑 ' + best.toLocaleString() : ''); ui.pill(D.isDaily ? 'DAILY' : '');
  refill();
}

function addScore(n) {
  score += n;
  while (score >= T(level)) {
    level++; ui.levels(level); const lv = level; setTimeout(() => ui.pop('LEVEL ' + lv + '!', '#ffd35c', 44, 40), 520); arp([72, 76, 79, 84], 70, 0.1); fx.confetti(50);
  }
  ui.progress((score - T(level - 1)) / (T(level) - T(level - 1)));
  if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 42, 30); fx.confetti(70); }
}

const WORDS = ['', 'Good!', 'Great!', 'Excellent!', 'Amazing!', 'Unbelievable!'];
const WCOL = ['', '#7cf0ff', '#9cff8a', '#ffd35c', '#ff9de0', '#ffffff'];
function place(slot, r0, c0) {
  const p = tray[slot]; if (!p || !fits(p.cells, r0, c0)) return false;
  for (const [r, c] of p.cells) { const i = (r0 + r) * N + c0 + c; board[i] = p.col; pop[i] = 1; }
  tray[slot] = null;
  addScore(p.cells.length);
  soft.wood(); tone(180, 0.09, 'sine', 0.12, 0.6); buzz(10);
  // full lines
  const rows = [], colsF = [];
  for (let r = 0; r < N; r++) { let f = true; for (let c = 0; c < N; c++) if (board[r * N + c] < 0) { f = false; break; } if (f) rows.push(r); }
  for (let c = 0; c < N; c++) { let f = true; for (let r = 0; r < N; r++) if (board[r * N + c] < 0) { f = false; break; } if (f) colsF.push(c); }
  const lines = rows.length + colsF.length;
  const cr = r0 + p.h / 2, cc = c0 + p.w / 2;
  if (lines) {
    combo = sinceClear <= 2 ? combo + 1 : 1; sinceClear = 0;
    const set = new Set(); rows.forEach(r => { for (let c = 0; c < N; c++) set.add(r * N + c); }); colsF.forEach(c => { for (let r = 0; r < N; r++) set.add(r * N + c); });
    const now = performance.now();
    for (const i of set) { const r = Math.floor(i / N), c = i % N; clears.push({ i, col: board[i], t0: now + Math.hypot(r + 0.5 - cr, c + 0.5 - cc) * 32, sp: false, tint: p.col }); board[i] = -1; }
    let gain = 80 * lines * (1 + 0.5 * (lines - 1)) * (1 + 0.5 * (combo - 1));
    gain = Math.round(gain / 10) * 10;
    const allClear = board.every(v => v < 0);
    if (allClear) gain += 300;
    addScore(gain);
    floats.push({ x: L.bx + cc * L.cell, y: L.by + Math.max(1, cr) * L.cell, t0: now, text: '+' + gain });
    shake = Math.min(16, 5 + lines * 3 + combo);
    const w = Math.min(lines, 5);
    if (lines >= 2 || combo < 2) ui.pop(WORDS[w], WCOL[w], 40 + w * 5, 33);
    if (combo >= 2) comboT = now;
    if (allClear) setTimeout(() => { ui.pop('BOARD CLEAR +300', '#fff', 32, 40); fx.confetti(90); }, 380);
    for (let k = 0; k < lines; k++) setTimeout(() => chime(k + combo + 1, 67, 0.12), k * 70);
    setTimeout(() => tone(90, 0.25, 'sine', 0.14, 0.5), 60);
    buzz(lines > 1 ? [20, 30, 30] : 25); ui.flash(Math.min(0.35, 0.08 * lines));
  } else { sinceClear++; if (sinceClear === 3 && combo >= 2) ui.pop('Combo ended', 'rgba(255,255,255,.75)', 22, 66); if (sinceClear >= 3) combo = 0; }
  if (tray.every(t => !t)) refill();
  checkOver();
  return true;
}
function checkOver() {
  if (state !== 'play' || overT) return;
  if (tray.some(t => t && fitsAnywhere(t.cells))) return;
  overT = performance.now(); soft.err(); buzz([30, 40, 60]);
  setTimeout(() => ui.pop('No space left!', '#fff', 38, 36), 200);
  setTimeout(endRun, 1250);
}
function endRun() {
  if (state !== 'play') return;
  if (!recorded) { recorded = true; F.endless(score); B.submit(score); }
  const old = best, newBest = score > best;
  if (newBest) { best = score; S.set('best', best); }
  if (D.isDaily) { const k = 'daily_' + todayKey(), prev = S.get(k, null); if (!prev || score > prev.s) S.set(k, { s: score }); }
  if (newBest && score > 0) {
    state = 'won'; D.won(score); fx.confetti(140); arp([67, 71, 74, 79, 83, 86], 100, 0.12, 0.9);
    ui.win('', `${score.toLocaleString()} pts · level ${level}${old ? ` · old best ${old.toLocaleString()}` : ''}`);
  } else { state = 'lost'; ui.lose(score.toLocaleString(), `best ${best.toLocaleString()} · level ${level}`); }
}

// ---------------------------------------------------------------- input (drag a tray piece onto the board)
function slotAt(x, y) {
  if (Math.abs(y - L.trayY) > Math.max(70, L.cell * 1.7)) return -1;
  const s = Math.floor((x - L.trayX) / L.slotW); return s >= 0 && s < 3 && tray[s] ? s : -1;
}
function dragOrigin(d) { const p = tray[d.slot], k = L.cell * 0.98; return { x: d.x - p.w * k / 2, y: d.y - p.h * k - L.cell * 1.1, k }; }
function snap(d) {
  const o = dragOrigin(d), p = tray[d.slot];
  const c0 = Math.round((o.x - L.bx) / L.cell), r0 = Math.round((o.y - L.by) / L.cell);
  return fits(p.cells, r0, c0) ? { r0, c0 } : null;
}
cv.addEventListener('pointerdown', e => {
  if (state !== 'play' || overT) return;
  const s = slotAt(e.clientX, e.clientY); if (s < 0) return;
  cv.setPointerCapture(e.pointerId);
  drag = { slot: s, x: e.clientX, y: e.clientY, t0: performance.now() }; soft.click(); buzz(6);
});
cv.addEventListener('pointermove', e => { if (drag) { drag.x = e.clientX; drag.y = e.clientY; } });
const endDrag = () => {
  if (!drag) return; const d = drag; drag = null;
  const sn = snap(d);
  if (sn && state === 'play') place(d.slot, sn.r0, sn.c0);
  else { tray[d.slot] && (tray[d.slot].back = performance.now()); tone(300, 0.06, 'sine', 0.05, 0.7); }
};
cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);

// ---------------------------------------------------------------- render
function bg(W, H, t) {
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#4636c9'); gr.addColorStop(0.55, '#3527a6'); gr.addColorStop(1, '#231a72'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.globalAlpha = 0.045; g.fillStyle = '#ffffff';
  for (let i = 0; i < 6; i++) { const x = (i * 97 + t * 6 * (i % 2 ? 1 : -1)) % (W + 160) - 80, y = H * (0.1 + 0.16 * i); g.beginPath(); g.arc(x, y, 40 + i * 14, 0, 7); g.fill(); }
  g.globalAlpha = 1;
}
const ease = (x) => 1 - Math.pow(1 - x, 3);
const back = (x) => { const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
function cellRect(i) { return [L.bx + (i % N) * L.cell, L.by + Math.floor(i / N) * L.cell]; }
function blk(col, x, y, s, scale = 1, alpha = 1) {
  if (alpha <= 0 || scale <= 0) return; const sp = sprite(col, s); g.globalAlpha = alpha;
  const d = s * scale; g.drawImage(sp, x + (s - d) / 2, y + (s - d) / 2, d, d); g.globalAlpha = 1;
}
function render(dt, tsec) {
  const W = innerWidth, H = innerHeight, now = performance.now();
  bg(W, H, tsec);
  shake *= Math.pow(0.86, dt); const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
  g.save(); g.translate(sx, sy);
  // board panel
  const pad = L.cell * 0.16;
  rr(g, L.bx - pad, L.by - pad, L.size + pad * 2, L.size + pad * 2, L.cell * 0.28); g.fillStyle = '#1a1550'; g.fill();
  g.strokeStyle = 'rgba(160,150,255,.35)'; g.lineWidth = 2; g.stroke();
  for (let i = 0; i < 64; i++) { const [x, y] = cellRect(i); rr(g, x + 1.5, y + 1.5, L.cell - 3, L.cell - 3, L.cell * 0.14); g.fillStyle = (Math.floor(i / N) + i) % 2 ? '#221c62' : '#251f68'; g.fill(); }
  // preview (ghost + lines that would clear, recoloured in the piece colour)
  let ghost = null, hiRows = [], hiCols = [];
  if (drag && tray[drag.slot]) {
    const sn = snap(drag), p = tray[drag.slot];
    if (sn) {
      ghost = { ...sn, p }; const tmp = board.slice(); for (const [r, c] of p.cells) tmp[(sn.r0 + r) * N + sn.c0 + c] = p.col;
      for (let r = 0; r < N; r++) { let f = true; for (let c = 0; c < N; c++) if (tmp[r * N + c] < 0) f = false; if (f) hiRows.push(r); }
      for (let c = 0; c < N; c++) { let f = true; for (let r = 0; r < N; r++) if (tmp[r * N + c] < 0) f = false; if (f) hiCols.push(c); }
    }
  }
  const hiCol = ghost ? COLS[ghost.p.col] : null;
  for (let i = 0; i < 64; i++) {
    if (board[i] < 0) continue; const [x, y] = cellRect(i);
    if (pop[i] > 0) pop[i] = Math.max(0, pop[i] - 0.07 * dt);
    const sc = pop[i] > 0 ? 1 + Math.sin((1 - pop[i]) * Math.PI) * 0.14 - pop[i] * 0.1 : 1;
    let col = COLS[board[i]];
    const r = Math.floor(i / N), c = i % N;
    if (hiCol && (hiRows.includes(r) || hiCols.includes(c))) col = hiCol;
    if (overT) { const gt = (now - overT - r * 70) / 160; if (gt > 0) col = gt >= 1 ? GREY : (gt > 0.5 ? GREY : col); }
    blk(col, x, y, L.cell, sc);
  }
  if (ghost) {
    for (const [r, c] of ghost.p.cells) { const [x, y] = cellRect((ghost.r0 + r) * N + ghost.c0 + c); blk(COLS[ghost.p.col], x, y, L.cell, 0.96, 0.38); }
    g.globalAlpha = 0.18 + 0.08 * Math.sin(now / 90); g.fillStyle = hiCol ? hiCol[1] : '#fff';
    for (const r of hiRows) g.fillRect(L.bx, L.by + r * L.cell, L.size, L.cell);
    for (const c of hiCols) g.fillRect(L.bx + c * L.cell, L.by, L.cell, L.size);
    g.globalAlpha = 1;
  }
  // clearing blocks: flash white, swell, then burst into jelly crumbs
  clears = clears.filter(cl => {
    const [x, y] = cellRect(cl.i), t = (now - cl.t0) / 260;
    if (t < 0) { blk(COLS[cl.tint], x, y, L.cell, 1); return true; }
    if (!cl.sp) { cl.sp = true; const col = COLS[cl.col] || COLS[0]; fx.sparks(x + L.cell / 2 + sx, y + L.cell / 2 + sy, [col[0], col[1], '#ffffff'], 6, { speed: 4.5, size: L.cell * 0.12, kind: 'conf', g: 0.22 }); }
    if (t >= 1) return false;
    blk(COLS[cl.tint], x, y, L.cell, 1 + ease(Math.min(1, t * 2)) * 0.25 - Math.max(0, t - 0.5) * 2.4, 1 - Math.max(0, t - 0.5) * 2);
    g.globalAlpha = Math.max(0, 0.7 - t); g.fillStyle = '#fff'; rr(g, x + 3, y + 3, L.cell - 6, L.cell - 6, L.cell * 0.15); g.fill(); g.globalAlpha = 1;
    return true;
  });
  g.restore();
  // combo badge
  if (combo >= 2 && now - comboT < 1400) {
    const k = Math.min(1, (now - comboT) / 180), a = 1 - Math.max(0, (now - comboT - 1000) / 400);
    g.save(); g.globalAlpha = a; g.translate(W / 2, L.by + L.size + (L.trayY - L.cell * 0.9 - L.by - L.size) / 2); g.scale(back(k), back(k));
    g.font = `800 ${Math.round(L.cell * 0.5)}px 'Baloo 2',system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const txt = `COMBO ${combo}`, tw = g.measureText(txt).width + 30;
    rr(g, -tw / 2, -L.cell * 0.36, tw, L.cell * 0.72, L.cell * 0.36); g.fillStyle = '#ff5fb0'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke();
    g.fillStyle = '#fff'; g.fillText(txt, 0, 2); g.restore();
  }
  // floating points
  floats = floats.filter(f => {
    const t = (now - f.t0) / 900; if (t >= 1) return false;
    g.save(); g.globalAlpha = 1 - t * t; g.font = `800 ${Math.round(L.cell * 0.62)}px 'Baloo 2',system-ui`; g.textAlign = 'center';
    g.lineWidth = 5; g.strokeStyle = 'rgba(30,10,80,.6)'; g.strokeText(f.text, f.x, f.y - t * 50); g.fillStyle = '#fff'; g.fillText(f.text, f.x, f.y - t * 50); g.restore(); return true;
  });
  // tray
  for (let s = 0; s < 3; s++) {
    const p = tray[s]; if (!p || (drag && drag.slot === s)) continue;
    const k = Math.min(L.cell * 0.64, (L.slotW - 16) / Math.max(p.w, 3)), cx = L.trayX + L.slotW * (s + 0.5);
    const at = Math.max(0, Math.min(1, (now - trayT - s * 90) / 380)), off = (1 - ease(at)) * W * 0.7;
    const bt = p.back ? Math.min(1, (now - p.back) / 260) : 1, bs = 1 + (1 - bt) * 0.25 * Math.sin(bt * Math.PI);
    const ok = fitsAnywhere(p.cells), a = ok || overT ? 1 : 0.32;
    const x0 = cx - p.w * k / 2 + off, y0 = L.trayY - p.h * k / 2;
    for (const [r, c] of p.cells) blk(overT && !ok ? GREY : COLS[p.col], x0 + c * k, y0 + r * k, k, 0.97 * bs, a);
  }
  // dragged piece: full size, lifted above the finger
  if (drag && tray[drag.slot]) {
    const p = tray[drag.slot], o = dragOrigin(drag), lift = Math.min(1, (now - drag.t0) / 120);
    g.save(); g.globalAlpha = 0.25; g.fillStyle = '#0a0630';
    for (const [r, c] of p.cells) { rr(g, o.x + c * o.k + 6, o.y + r * o.k + 10, o.k - 4, o.k - 4, o.k * 0.16); g.fill(); }
    g.restore();
    for (const [r, c] of p.cells) blk(COLS[p.col], o.x + c * o.k, o.y + r * o.k, o.k, 0.6 + 0.4 * ease(lift) * 0.98 + 0.02);
  }
  // rolling score
  if (shown !== score) { shown = score - shown < 2 ? score : shown + Math.ceil((score - shown) * 0.2); ui.score(shown.toLocaleString()); }
}

layout(); newRun();
loop((dt, t) => render(dt, t));
ui.onTap((which) => {
  if (which === 'start') { state = 'play'; checkOver(); return; }
  if (D.isDaily && which !== 'start') { newRun(); state = 'play'; return; }
  newRun(); state = 'play';
});
ui.start();

// ---------------------------------------------------------------- test hook: the bot plays a greedy placement each call
function evalBoard(b) {
  let holes = 0, edges = 0;
  for (let i = 0; i < 64; i++) {
    if (b[i] >= 0) continue; const r = Math.floor(i / N), c = i % N; let n = 0;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const rr2 = r + dr, cc = c + dc; if (rr2 < 0 || cc < 0 || rr2 >= N || cc >= N || b[rr2 * N + cc] >= 0) n++; }
    if (n === 4) holes++; edges += n;
  }
  return -holes * 30 - edges * 1.5;
}
function bestMove() {
  let bestM = null;
  for (let s = 0; s < 3; s++) {
    const p = tray[s]; if (!p) continue;
    for (let r0 = 0; r0 <= N - p.h; r0++) for (let c0 = 0; c0 <= N - p.w; c0++) {
      if (!fits(p.cells, r0, c0)) continue;
      const b = board.slice(); for (const [r, c] of p.cells) b[(r0 + r) * N + c0 + c] = p.col;
      let lines = 0; const fr = [], fc = [];
      for (let r = 0; r < N; r++) { let f = true; for (let c = 0; c < N; c++) if (b[r * N + c] < 0) f = false; if (f) fr.push(r); }
      for (let c = 0; c < N; c++) { let f = true; for (let r = 0; r < N; r++) if (b[r * N + c] < 0) f = false; if (f) fc.push(c); }
      fr.forEach(r => { for (let c = 0; c < N; c++) b[r * N + c] = -1; }); fc.forEach(c => { for (let r = 0; r < N; r++) b[r * N + c] = -1; }); lines = fr.length + fc.length;
      let v = lines * 120 + evalBoard(b) + p.cells.length * 2;
      for (let o = 0; o < 3; o++) if (o !== s && tray[o] && !fitsAnywhere(tray[o].cells, b)) v -= 200;
      if (!bestM || v > bestM.v) bestM = { s, r0, c0, v };
    }
  }
  return bestM;
}
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() { if (state !== 'play' || overT || drag) return; const m = bestMove(); if (m) place(m.s, m.r0, m.c0); },
};
