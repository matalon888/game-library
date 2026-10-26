// Sumweave — original math grid puzzle. Equations (a op b = c) cross each other across and down on a sheet of paper;
// fill every blank from the tray of numbers. Grids are generated from a seed; the tray is exactly the removed numbers.
import { createUI, store, buzz } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { css, cardTheme, startCard, fx2d, chime, arp, soft, todayKey, fmtTime } from './calm.js';

const NAME = 'Sumweave: Math Grid Puzzle';
const S = store('sumweave');
const F = flow('sumweave');
const ui = createUI({ title: 'Sumweave', hint: 'Tap to play', hand: '', score: false });
cardTheme({ accent: '#2f7d74' });
const D = daily('sumweave', ui, { name: NAME });
const B = board({ game: 'sumweave', label: 'Puzzles solved', limits: { maxRun: 1, maxPerSec: 0.1 }, mode: 'sum' });
const fx = fx2d(11);
const doneToday = S.get('daily_' + todayKey(), null);
startCard(ui, D, { kicker: D.isDaily ? 'Daily puzzle' : 'math crossword', doneLine: doneToday ? (D.isDaily ? `Solved today · ${doneToday.s.toLocaleString()} pts` : 'Daily puzzle solved ✓') : null });
if (D.isDaily) ui.els.win.querySelector('p').innerHTML = 'Daily puzzle<span data-l hidden></span>';
ui.els.win.querySelector('h1').textContent = 'Woven!';

const ACC = '#2f7d74', OPC = '#c46a3d';
css(`
body{background:radial-gradient(120% 70% at 50% 0%,#fbf5e8 0%,#f1e6d0 60%,#e8d9bd 100%);color:#2b2a33}
.hc-top{z-index:40}.hc-top .hc-lvl{width:28px;height:28px;font-size:14px;font-weight:700;color:#fff;background:${ACC}}
.hc-top .hc-lvl.next{background:rgba(47,125,116,.14);color:${ACC}}
.hc-top .hc-bar{background:rgba(47,125,116,.14);height:8px}.hc-top .hc-bar i{background:${ACC}}
#status{position:fixed;left:16px;right:16px;top:calc(58px + env(safe-area-inset-top));display:flex;align-items:center;justify-content:space-between;z-index:5;font-weight:700;color:#4a4350;pointer-events:none}
#status .hearts{font-size:20px;letter-spacing:2px;color:#d9534f;min-width:90px}
#status .hearts i{font-style:normal;display:inline-block;transition:transform .25s,opacity .25s}
#status .hearts i.gone{opacity:.22;filter:grayscale(1);transform:scale(.8)}
#status .mid{text-align:center;line-height:1}
#status .mid b{display:block;font-family:ui-serif,'New York',Georgia,serif;font-size:28px;font-weight:600;color:#2b2a33;font-variant-numeric:tabular-nums}
#status .mid span{font-size:10px;letter-spacing:3px;text-transform:uppercase;opacity:.6}
#status .time{min-width:90px;text-align:right;font-size:17px;font-variant-numeric:tabular-nums;opacity:.75}
#sheet{position:fixed;z-index:2;background:#fffdf7;border-radius:20px;box-shadow:0 1px 0 #fff inset,0 14px 34px rgba(90,64,30,.16),0 2px 6px rgba(90,64,30,.08)}
#sheet:before{content:'';position:absolute;inset:0;border-radius:20px;background:repeating-linear-gradient(0deg,rgba(47,125,116,.035) 0 1px,transparent 1px 22px);pointer-events:none}
.c{position:absolute;display:flex;align-items:center;justify-content:center;border-radius:9px;font-weight:700;font-size:var(--fs);font-variant-numeric:tabular-nums;letter-spacing:-.5px;transition:background .25s,color .25s,box-shadow .2s,transform .25s cubic-bezier(.3,1.5,.5,1),opacity .25s}
.c.n{background:#f8eed6;color:#2b2a33;box-shadow:inset 0 -2px 0 rgba(120,90,40,.12)}
.c.o{color:${OPC};font-size:calc(var(--fs) * 1.05)}
.c.e{color:#9a8f80}
.c.b{background:#fff;box-shadow:inset 0 0 0 2px #e2d3b3;cursor:pointer}
.c.b.empty{background:repeating-linear-gradient(135deg,#fff 0 6px,#fbf6ea 6px 12px)}
.c.b.u{color:#2f5fb3;box-shadow:inset 0 0 0 2px #bcd0f0;background:#f4f8ff}
.c.b.sel{box-shadow:inset 0 0 0 3px ${ACC},0 0 0 4px rgba(47,125,116,.18);transform:scale(1.06);z-index:3}
.c.b.hl{box-shadow:inset 0 0 0 2px #9cc9bf}
.c.n.hl{background:#e9f2e8}
.c.o.hl,.c.e.hl{background:rgba(47,125,116,.06)}
.c.ok{background:#dcefe0!important;color:#2c6e3f!important;box-shadow:inset 0 0 0 2px #b8dcc0!important}
.c.bad{background:#fde3e0!important;color:#c0392b!important;box-shadow:inset 0 0 0 2px #f2b5ae!important;animation:shk .4s}
.c.pop{animation:pop .42s cubic-bezier(.3,1.6,.5,1)}
.c.land{animation:land .3s cubic-bezier(.3,1.6,.5,1)}
.c.wave{animation:wave .5s ease}
@keyframes shk{20%{transform:translateX(-5px)}40%{transform:translateX(5px)}60%{transform:translateX(-3px)}80%{transform:translateX(2px)}}
@keyframes pop{40%{transform:scale(1.22)}}
@keyframes land{0%{transform:scale(1.35)}}
@keyframes wave{40%{transform:translateY(-8px) scale(1.12)}}
#tray{position:fixed;z-index:4;left:12px;right:12px;bottom:calc(18px + env(safe-area-inset-bottom));background:rgba(255,253,247,.7);border-radius:22px;padding:10px 12px 14px;box-shadow:0 8px 24px rgba(90,64,30,.12);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
#tray .hd{display:flex;align-items:center;justify-content:space-between;margin:0 4px 8px;font-size:11px;letter-spacing:3px;text-transform:uppercase;font-weight:700;color:#8a7f70}
#tray .hint{font:inherit;font-size:13px;letter-spacing:.5px;text-transform:none;font-weight:700;color:${ACC};background:#fff;border:0;border-radius:16px;padding:6px 12px;box-shadow:0 2px 0 rgba(0,0,0,.08);cursor:pointer}
#tray .hint[disabled]{opacity:.4}
#tray .tiles{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;align-content:flex-start;min-height:var(--th)}
.t{width:var(--tw);height:var(--tw);border-radius:13px;background:#fff;color:#2b2a33;display:flex;align-items:center;justify-content:center;font-weight:750;font-size:21px;font-variant-numeric:tabular-nums;box-shadow:0 3px 0 #e1d2b4,0 6px 12px rgba(90,64,30,.1);cursor:pointer;transition:transform .15s,background .15s,opacity .2s}
.t:active{transform:translateY(2px)}
.t.sel{background:${ACC};color:#fff;transform:translateY(-4px);box-shadow:0 5px 0 #1e5952,0 10px 16px rgba(47,125,116,.3)}
.t.used{display:none}
.t.back{animation:pop .4s cubic-bezier(.3,1.6,.5,1)}
.fly{position:fixed;z-index:30;pointer-events:none;border-radius:11px;background:#fff;color:#2f5fb3;display:flex;align-items:center;justify-content:center;font-weight:750;box-shadow:0 8px 18px rgba(0,0,0,.18);transition:transform .2s cubic-bezier(.4,.1,.3,1),width .2s,height .2s,font-size .2s}
`);

const status = document.createElement('div'); status.id = 'status';
status.innerHTML = '<div class="hearts"><i>♥</i><i>♥</i><i>♥</i></div><div class="mid"><b>0</b><span>score</span></div><div class="time">0:00</div>';
const sheet = document.createElement('div'); sheet.id = 'sheet';
const tray = document.createElement('div'); tray.id = 'tray';
tray.innerHTML = '<div class="hd"><span>Numbers</span><button class="hint">💡 Hint <b>1</b></button></div><div class="tiles"></div>';
document.body.append(status, sheet, tray);
const tilesEl = tray.querySelector('.tiles'), hintBtn = tray.querySelector('.hint');

// ---------------------------------------------------------------- seeded rng
function rngf(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const pick = (r, a) => a[Math.floor(r() * a.length)];
function shuffle(r, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---------------------------------------------------------------- equation table: every a op b = c within the level's ranges
function eqTable(ops, maxN, mulMax) {
  const T = new Map(), all = [];
  const add = (a, op, b, c) => { const e = [a, op, b, c]; all.push(e); [a, b, c].forEach((v, k) => { const key = op + '|' + (k * 2) + '|' + v; (T.get(key) || T.set(key, []).get(key)).push(e); }); };
  for (const op of ops) {
    if (op === '+') for (let a = 1; a <= maxN; a++) for (let b = 1; b <= maxN; b++) add(a, op, b, a + b);
    if (op === '−') for (let a = 2; a <= maxN * 1.5; a++) for (let b = 1; b < a && b <= maxN; b++) add(a, op, b, a - b);
    if (op === '×') for (let a = 2; a <= mulMax; a++) for (let b = 2; b <= mulMax; b++) add(a, op, b, a * b);
    if (op === '÷') for (let b = 2; b <= mulMax; b++) for (let c = 2; c <= mulMax; c++) add(b * c, op, b, c);
  }
  return { T, all };
}

// ---------------------------------------------------------------- generator: grow a crossword of 5-cell equations
const MAXC = 9, MAXR = 11;
function generate(seed, L, fk) {
  const ops = L <= 2 ? ['+', '−'] : L <= 4 ? ['+', '−', '×'] : ['+', '−', '×', '÷'];
  const maxN = Math.min(40, 9 + L * 3), mulMax = Math.min(12, 5 + L);
  const want = Math.max(3, Math.min(13, Math.round((2.6 + L * 0.75) * fk)));
  const frac = Math.max(0.3, Math.min(0.8, (0.34 + L * 0.035) * fk));
  const { T, all } = eqTable(ops, maxN, mulMax);
  let best = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    const r = rngf(seed * 977 + attempt * 7919 + 13);
    const grid = new Map(), eqs = [];   // grid key "x,y" → { kind:'n'|'o'|'e', v, dirs:Set }
    const K = (x, y) => x + ',' + y;
    const bounds = () => { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const k of grid.keys()) { const [x, y] = k.split(',').map(Number); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { x0, x1, y0, y1 }; };
    const cellsOf = (x, y, d, e) => [0, 1, 2, 3, 4].map(i => ({ x: x + (d ? 0 : i), y: y + (d ? i : 0), kind: i % 2 ? (i === 1 ? 'o' : 'e') : 'n', v: i === 1 ? e[1] : i === 3 ? '=' : e[i === 0 ? 0 : i === 2 ? 2 : 3] }));
    function fits(x, y, d, e) {
      const cs = cellsOf(x, y, d, e), b = bounds();
      const bx0 = Math.min(b.x0, x), by0 = Math.min(b.y0, y), bx1 = Math.max(b.x1, cs[4].x), by1 = Math.max(b.y1, cs[4].y);
      if (bx1 - bx0 + 1 > MAXC || by1 - by0 + 1 > MAXR) return false;
      const bx = d ? x : x - 1, by = d ? y - 1 : y, ax = d ? x : x + 5, ay = d ? y + 5 : y;
      if (grid.has(K(bx, by)) || grid.has(K(ax, ay))) return false;
      let shared = 0;
      for (const c of cs) {
        const g = grid.get(K(c.x, c.y));
        if (g) { if (g.kind !== 'n' || c.kind !== 'n' || g.v !== c.v || g.dirs.has(d)) return false; shared++; continue; }
        const s1 = d ? K(c.x - 1, c.y) : K(c.x, c.y - 1), s2 = d ? K(c.x + 1, c.y) : K(c.x, c.y + 1);
        if (grid.has(s1) || grid.has(s2)) return false;
      }
      return eqs.length === 0 || shared >= 1;
    }
    function put(x, y, d, e) {
      const cs = cellsOf(x, y, d, e), keys = [];
      for (const c of cs) { const k = K(c.x, c.y); const g = grid.get(k) || grid.set(k, { kind: c.kind, v: c.v, dirs: new Set() }).get(k); g.dirs.add(d); keys.push(k); }
      eqs.push({ e, keys, d });
    }
    put(0, 0, 0, pick(r, all.filter(e => e[1] === ops[ops.length - 1] || r() < 0.3)) || pick(r, all));
    for (let tries = 0; eqs.length < want && tries < 400; tries++) {
      const anchors = [...grid.entries()].filter(([k, g]) => g.kind === 'n' && g.dirs.size === 1);
      if (!anchors.length) break;
      const [k, g] = pick(r, anchors), [ax, ay] = k.split(',').map(Number), d = g.dirs.has(0) ? 1 : 0;
      const pos = pick(r, [0, 2, 4]), op = pick(r, ops), list = T.get(op + '|' + pos + '|' + g.v);
      if (!list) continue;
      const e = pick(r, list), x = d ? ax : ax - pos, y = d ? ay - pos : ay;
      if (fits(x, y, d, e)) put(x, y, d, e);
    }
    if (!best || eqs.length > best.eqs.length) best = { grid, eqs, r };
    if (eqs.length >= want) break;
  }
  // normalise coordinates, build cell list
  const { grid, eqs, r } = best;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const k of grid.keys()) { const [x, y] = k.split(',').map(Number); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const idx = new Map(), cells = [];
  for (const [k, g] of grid) { const [x, y] = k.split(',').map(Number); idx.set(k, cells.length); cells.push({ x: x - x0, y: y - y0, kind: g.kind, v: g.v, eqs: [] }); }
  const E = eqs.map((q, i) => { const ids = q.keys.map(k => idx.get(k)); ids.forEach(id => cells[id].eqs.push(i)); return { ids, op: q.e[1], done: false }; });
  // blanks: number cells, at most 2 of the 3 numbers per equation
  const nums = shuffle(r, cells.map((c, i) => i).filter(i => cells[i].kind === 'n'));
  const nBlank = Math.max(Math.min(3, nums.length), Math.round(nums.length * frac));
  const blankCount = E.map(() => 0); let made = 0;
  for (const i of nums) {
    if (made >= nBlank) break;
    if (cells[i].eqs.some(q => blankCount[q] >= 2)) continue;
    cells[i].blank = true; cells[i].eqs.forEach(q => blankCount[q]++); made++;
  }
  return { cells, E, cols: x1 - x0 + 1, rows: y1 - y0 + 1, tray: shuffle(r, cells.filter(c => c.blank).map(c => c.v)) };
}

// ---------------------------------------------------------------- state
let state = 'ready', level = S.get('level', 1), score = 0, hearts = 3, P = null, fills = [], tiles = [], selCell = -1, selTile = -1,
  t0 = 0, elapsed = 0, recorded = false, beatenShown = false, hintsLeft = 1, cellEls = [], tileEls = [], busy = false;
const G = { cs: 40, ox: 0, oy: 0 };

const valOf = (i) => { const c = P.cells[i]; return c.blank ? (fills[i] ? fills[i].v : null) : c.v; };
function eqTrue(q) {
  const [a, , b, , c] = P.E[q].ids.map(valOf), op = P.E[q].op;
  return op === '+' ? a + b === c : op === '−' ? a - b === c : op === '×' ? a * b === c : b !== 0 && a === b * c;
}
const eqFull = (q) => P.E[q].ids.every(i => valOf(i) !== null);

function layout() {
  if (!P) return;
  const W = innerWidth, H = innerHeight;
  const perRow = Math.max(5, Math.min(8, Math.floor((Math.min(W, 520) - 48) / 54)));
  const tw = Math.min(50, Math.floor((Math.min(W, 520) - 48 - (perRow - 1) * 8) / perRow));
  tray.style.setProperty('--tw', tw + 'px');
  if (W > 560) { tray.style.left = tray.style.right = (W - 520) / 2 + 'px'; } else { tray.style.left = tray.style.right = '12px'; }
  const rowsT = Math.max(1, Math.ceil(P.tray.length / perRow));
  const trayH = 24 + 26 + rowsT * tw + (rowsT - 1) * 8;
  tray.style.setProperty('--th', (rowsT * tw + (rowsT - 1) * 8) + 'px');
  const top = 104, bottom = H - trayH - 18 - 18;
  const aw = Math.min(W - 24, 500) - 24, ah = bottom - top - 40;
  G.cs = Math.floor(Math.min(52, aw / P.cols, ah / P.rows));
  const bw = G.cs * P.cols, bh = G.cs * P.rows;
  const sw = Math.min(W - 24, Math.max(bw + 28, Math.min(W - 24, 500))), sh = bh + 28;
  const sx = (W - sw) / 2, sy = top + Math.max(0, (ah + 24 - sh) * 0.45);
  Object.assign(sheet.style, { left: sx + 'px', top: sy + 'px', width: sw + 'px', height: sh + 'px' });
  G.ox = (sw - bw) / 2; G.oy = 14;
  sheet.style.setProperty('--fs', Math.round(G.cs * (G.cs < 36 ? 0.5 : 0.46)) + 'px');
  const gap = Math.max(2, Math.round(G.cs * 0.07));
  P.cells.forEach((c, i) => Object.assign(cellEls[i].style, { left: G.ox + c.x * G.cs + gap / 2 + 'px', top: G.oy + c.y * G.cs + gap / 2 + 'px', width: G.cs - gap + 'px', height: G.cs - gap + 'px' }));
}
addEventListener('resize', layout);

function build() {
  const fk = D.isDaily ? 1 : F.k(), L = D.isDaily ? 7 : level, seed = D.seed || level * 15485863 + 7;
  P = generate(seed, L, fk);
  sheet.querySelectorAll('.c').forEach(e => e.remove()); tilesEl.innerHTML = '';
  fills = []; selCell = -1; selTile = -1; hearts = 3; score = 0; elapsed = 0; recorded = false; beatenShown = false; hintsLeft = 1; busy = false;
  P.E.forEach(q => q.done = false);
  cellEls = P.cells.map((c, i) => {
    const d = document.createElement('div');
    d.className = 'c ' + (c.blank ? 'b empty' : c.kind);
    d.textContent = c.blank ? '' : c.v;
    if (c.blank) d.addEventListener('pointerdown', (e) => { e.preventDefault(); tapCell(i); });
    sheet.appendChild(d); return d;
  });
  tiles = P.tray.map(v => ({ v, used: false }));
  tileEls = tiles.map((t, k) => {
    const d = document.createElement('div'); d.className = 't'; d.textContent = t.v;
    d.addEventListener('pointerdown', (e) => { e.preventDefault(); tapTile(k); });
    tilesEl.appendChild(d); return d;
  });
  // pre-mark equations with no blanks as done (never happens by construction, but harmless)
  P.E.forEach((q, k) => { if (q.ids.every(i => !P.cells[i].blank)) q.done = true; });
  layout();
  ui.levels(D.isDaily ? 1 : level); if (D.isDaily) { ui.els.top.querySelector('[data-a]').textContent = '★'; ui.els.top.querySelector('[data-b]').textContent = '✓'; }
  // entrance: cells ripple in
  cellEls.forEach((d, i) => { d.style.opacity = 0; d.style.transform = 'scale(.6)'; setTimeout(() => { d.style.opacity = ''; d.style.transform = ''; }, 30 + (P.cells[i].x + P.cells[i].y) * 28); });
  selectNext(); refresh();
}

function refresh() {
  status.querySelectorAll('.hearts i').forEach((h, i) => h.classList.toggle('gone', i >= hearts));
  status.querySelector('.mid b').textContent = score.toLocaleString();
  hintBtn.querySelector('b').textContent = hintsLeft; hintBtn.disabled = hintsLeft <= 0;
  const blanks = P.cells.filter(c => c.blank).length, okN = P.cells.filter((c, i) => c.blank && cellEls[i].classList.contains('ok')).length;
  ui.progress(blanks ? okN / blanks : 0);
  cellEls.forEach((d, i) => { d.classList.toggle('sel', i === selCell); d.classList.remove('hl'); });
  if (selCell >= 0) P.cells[selCell].eqs.forEach(q => P.E[q].ids.forEach(i => i !== selCell && cellEls[i].classList.add('hl')));
  tileEls.forEach((d, k) => { d.classList.toggle('sel', k === selTile); d.classList.toggle('used', tiles[k].used); });
}
function selectNext() {
  // prefer an empty blank in an equation that is closest to complete
  let bestI = -1, bestS = -1;
  P.cells.forEach((c, i) => {
    if (!c.blank || fills[i]) return;
    const s = Math.max(...c.eqs.map(q => P.E[q].ids.filter(j => valOf(j) !== null).length)) * 100 - (c.y * 10 + c.x);
    if (s > bestS) { bestS = s; bestI = i; }
  });
  selCell = bestI;
}

function tapCell(i) {
  if (state !== 'play' || busy) return;
  const d = cellEls[i];
  if (d.classList.contains('ok')) return;
  if (fills[i]) {   // take a placed number back
    const k = fills[i].tile; tiles[k].used = false; fills[i] = undefined;
    d.textContent = ''; d.classList.remove('u'); d.classList.add('empty');
    tileEls[k].classList.remove('back'); void tileEls[k].offsetWidth; tileEls[k].classList.add('back');
    soft.swish(); selCell = i; selTile = -1; refresh(); return;
  }
  soft.click();
  if (selTile >= 0) return place(i, selTile);
  selCell = selCell === i ? -1 : i; refresh();
}
function tapTile(k) {
  if (state !== 'play' || busy || tiles[k].used) return;
  soft.wood();
  if (selCell >= 0 && !fills[selCell]) return place(selCell, k);
  selTile = selTile === k ? -1 : k; refresh();
}

// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on level 1, until the first touch,
// the number tile that fits the most nearly-finished sum lights up, flies into its blank and the sum turns green
demo(() => {
  selectNext(); const i = selCell; if (i < 0 || P.cells.filter((c, j) => c.blank && !fills[j]).length < 3) return false;
  const k = tiles.findIndex(t => !t.used && t.v === P.cells[i].v); if (k < 0) return false;
  selTile = k; refresh(); setTimeout(() => { if (state === 'play' && !busy && selTile === k && !fills[i]) place(i, k); }, 600); return false;
}, { ready: () => state === 'play' && level === 1 && !D.isDaily && !busy && P && selTile < 0, wait: 1800 });
function flyTo(k, i, a, cb) {
  const b = cellEls[i].getBoundingClientRect();
  const f = document.createElement('div'); f.className = 'fly'; f.textContent = tiles[k].v;
  Object.assign(f.style, { left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px', fontSize: '21px' });
  document.body.appendChild(f); void f.offsetWidth;
  Object.assign(f.style, { transform: `translate(${b.left - a.left}px,${b.top - a.top}px)`, width: b.width + 'px', height: b.height + 'px', fontSize: getComputedStyle(cellEls[i]).fontSize });
  setTimeout(() => { f.remove(); cb(); }, 200);
}

function place(i, k) {
  const a = tileEls[k].getBoundingClientRect();
  tiles[k].used = true; fills[i] = { v: tiles[k].v, tile: k }; selTile = -1; busy = true; refresh();
  flyTo(k, i, a, () => {
    busy = false;
    const d = cellEls[i]; d.textContent = tiles[k].v; d.classList.remove('empty'); d.classList.add('u');
    d.classList.remove('land'); void d.offsetWidth; d.classList.add('land'); buzz(6);
    const full = P.cells[i].eqs.filter(q => !P.E[q].done && eqFull(q));
    const bad = full.filter(q => !eqTrue(q));
    if (bad.length) return mistake(i, k, bad);
    full.forEach((q, n) => setTimeout(() => solveEq(q), n * 180));
    if (!full.length) { selectNext(); refresh(); }
  });
}

function solveEq(q) {
  const E = P.E[q]; E.done = true;
  let gained = 0;
  E.ids.forEach((id, n) => setTimeout(() => {
    const d = cellEls[id];
    if (P.cells[id].blank && !d.classList.contains('ok')) gained++;
    d.classList.add('ok'); d.classList.remove('u', 'pop'); void d.offsetWidth; d.classList.add('pop');
  }, n * 45));
  const pts = 25 + E.ids.filter(id => P.cells[id].blank).length * 10; score += pts;
  const solved = P.E.filter(e => e.done).length;
  chime(solved - 1, 67, 0.12); buzz(10);
  const r0 = cellEls[E.ids[0]].getBoundingClientRect(), r4 = cellEls[E.ids[4]].getBoundingClientRect();
  const cx = (r0.left + r4.right) / 2, cy = (r0.top + r4.bottom) / 2;
  fx.sparks(cx, cy, ['#2f7d74', '#f2c66d', '#ffffff', '#7cc6a4'], 14, { speed: 3.2, size: 3.4 });
  fx.ring(cx, cy, '#7cc6a4', 34);
  if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#2f7d74', 40, 15); fx.confetti(60); }
  setTimeout(() => {
    selectNext(); refresh();
    if (P.cells.every((c, i) => !c.blank || cellEls[i].classList.contains('ok'))) win();
    else if (P.E.filter(e => e.done).length % 3 === 0) ui.pop(['Nice!', 'Neat!', 'Sharp!', 'Smooth!'][Math.floor(Math.random() * 4)], '#2f7d74', 28, 16.5);
  }, 260);
}

function mistake(i, k, bad) {
  hearts--; soft.err(); buzz([30, 40, 30]); ui.flash(0.12);
  const ids = new Set(bad.flatMap(q => P.E[q].ids));
  ids.forEach(id => { const d = cellEls[id]; d.classList.remove('bad'); void d.offsetWidth; d.classList.add('bad'); });
  busy = true;
  setTimeout(() => {
    ids.forEach(id => cellEls[id].classList.remove('bad'));
    fills[i] = undefined; tiles[k].used = false;
    const d = cellEls[i]; d.textContent = ''; d.classList.remove('u'); d.classList.add('empty');
    tileEls[k].classList.remove('back'); void tileEls[k].offsetWidth; tileEls[k].classList.add('back');
    busy = false; selCell = i; refresh();
    if (hearts <= 0) lose();
  }, 520);
  refresh();
}

function useHint() {
  if (state !== 'play' || busy || hintsLeft <= 0) return;
  const i = selCell >= 0 && !fills[selCell] ? selCell : P.cells.findIndex((c, j) => c.blank && !fills[j]);
  if (i < 0) return;
  const k = tiles.findIndex(t => !t.used && t.v === P.cells[i].v);
  if (k < 0) return;
  hintsLeft--; place(i, k);
}
hintBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); useHint(); });

function cleared() { const b = P.cells.filter(c => c.blank).length; return b ? P.cells.filter((c, i) => c.blank && cellEls[i].classList.contains('ok')).length / b : 0; }
function win() {
  if (state !== 'play') return;
  state = 'won'; if (!recorded) { recorded = true; if (!D.isDaily) F.level(true); }
  const secs = Math.floor(elapsed), bonus = hearts * 100 + Math.max(0, 300 - secs) * 2; score += bonus; refresh();
  cellEls.forEach((d, i) => setTimeout(() => { d.classList.remove('pop', 'wave'); void d.offsetWidth; d.classList.add('wave'); }, (P.cells[i].x + P.cells[i].y) * 40));
  arp([67, 71, 74, 79, 83, 86], 110, 0.12, 0.9); fx.confetti(140, ['#2f7d74', '#f2c66d', '#c46a3d', '#7cc6a4', '#9db4ff', '#ffffff']); buzz([20, 60, 20]);
  if (D.isDaily) { const k = 'daily_' + todayKey(), prev = S.get(k, null); if (!prev || score > prev.s) S.set(k, { s: score }); }
  else { level++; S.set('level', level); }
  const best = S.get('best', 0); if (score > best) S.set('best', score);
  D.won(score); B.submit(1);   // world board: puzzles solved today
  ui.win(D.isDaily ? '' : level - 1, `${score.toLocaleString()} pts · ${fmtTime(secs)} · ${'♥'.repeat(hearts)}`);
}
function lose() {
  if (state !== 'play') return;
  state = 'lost'; if (!recorded) { recorded = true; if (!D.isDaily) F.level(false, cleared()); }
  ui.lose('Out of hearts', `${Math.round(cleared() * 100)}% of the grid woven · tap to retry`);
}

let lastT = performance.now();
(function tick(t) {
  if (state === 'play') { elapsed += (t - lastT) / 1000; const s = '⏱ ' + fmtTime(elapsed), el = status.querySelector('.time'); if (el.textContent !== s) el.textContent = s; }
  lastT = t; requestAnimationFrame(tick);
})(performance.now());

ui.onTap((which) => {
  B.start();
  if (which === 'start') { state = 'play'; return; }
  if (which === 'win' && D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
  build(); state = 'play';
});
build();

// ---------------------------------------------------------------- test hook: the bot places one correct number per call
let botN = 0;
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play' || busy || ++botN % 3) return;
    const i = P.cells.findIndex((c, j) => c.blank && !fills[j]);
    if (i < 0) return;
    const k = tiles.findIndex(t => !t.used && t.v === P.cells[i].v);
    if (k >= 0) { selCell = i; place(i, k); }
  },
};
