// Ninefold — original daily sudoku. Unique-solution puzzles generated in the browser (seeded), four difficulties,
// pencil notes, 3-mistake limit, hints, undo, and a daily challenge that is the same puzzle for everyone today.
import { createUI, store, buzz, note } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { css, cardTheme, startCard, fx2d, chime, arp, soft, fmtTime, todayKey } from './calm.js';

const NAME = 'Ninefold: Daily Sudoku Puzzle';
const S = store('ninefold');
const F = flow('ninefold');
const DIFFS = ['Easy', 'Medium', 'Hard', 'Expert'];
const HOLES = [40, 47, 52, 56];          // empty cells targeted per difficulty (before flow)
const PTS = [20, 35, 55, 80];
const MAX_MISTAKES = 3;

const ui = createUI({ title: 'Ninefold', hint: 'Tap to play', hand: '', score: false });
cardTheme({ accent: '#4b62c9' });
const D = daily('ninefold', ui, { name: NAME });
const LB = board({ game: 'ninefold', label: 'Puzzles solved', limits: { maxRun: 2, maxPerSec: 0.05 }, mode: 'sum', corner: 'br' });   // world board: puzzles solved today (RULES.md)
const fx = fx2d(11);

let diff = D.isDaily ? 1 : S.get('diff', 0);
const doneToday = S.get('daily_' + todayKey(), null);
startCard(ui, D, {
  kicker: D.isDaily ? 'Daily Sudoku · Medium' : 'Daily Sudoku',
  doneLine: D.isDaily ? (doneToday ? `Solved today in ${fmtTime(doneToday.t)} · ${doneToday.s} pts` : null) : (doneToday ? `Solved today ✓ ${fmtTime(doneToday.t)}` : null),
  chips: D.isDaily ? null : { items: DIFFS, get: () => diff, set: (i) => { diff = i; S.set('diff', i); } },
});

// ---------------------------------------------------------------- styles + DOM
css(`
body{background:linear-gradient(180deg,#f4f1ea 0%,#e9edf4 100%);color:#22304a}
.hc-card,.hc-card.dim{background:linear-gradient(180deg,rgba(44,58,122,.84),rgba(24,30,66,.9))}
.hc-top .hc-lvl{width:28px;height:28px;font-size:14px;box-shadow:none;font-family:inherit;font-weight:700;color:#fff}
.hc-top .hc-lvl.next{background:rgba(34,48,74,.08);color:#4b62c9}
.hc-top .hc-bar{background:rgba(34,48,74,.1);height:8px}
#app{position:fixed;left:0;right:0;top:calc(52px + env(safe-area-inset-top));bottom:env(safe-area-inset-bottom);display:flex;flex-direction:column;align-items:center;padding:0 10px}
.stats{display:flex;justify-content:space-between;width:var(--g);margin:6px 0 10px;font-size:12px;color:#7a8499}
.stats div{display:flex;flex-direction:column;gap:2px;cursor:default}
.stats b{font-size:15px;color:#22304a;font-weight:650;font-variant-numeric:tabular-nums}
.stats .r{text-align:right}.stats .m{text-align:center}
.stats .tap{cursor:pointer}
.stats .tap b:after{content:' ▾';font-size:10px;color:#4b62c9}
.grid{width:var(--g);height:var(--g);display:grid;grid-template-columns:repeat(9,1fr);grid-template-rows:repeat(9,1fr);background:#fff;border-radius:14px;box-shadow:0 1px 0 rgba(34,48,74,.06),0 14px 40px -12px rgba(34,48,74,.25);position:relative;overflow:hidden;border:2px solid #2b3956}
.c{position:relative;display:flex;align-items:center;justify-content:center;border-right:1px solid #d9dee8;border-bottom:1px solid #d9dee8;font-size:calc(var(--g) / 15);font-weight:500;color:#22304a;cursor:pointer;transition:background .18s}
.c.bx{border-right:2px solid #2b3956}.c.by{border-bottom:2px solid #2b3956}
.c.l9{border-right:0}.c.b9{border-bottom:0}
.c.peer{background:#eaeff8}.c.same{background:#d3def6}.c.sel{background:#b9cdf6}
.c.user .v{color:#3d55c4}.c.bad .v{color:#d9434f}.c.bad{background:#fbe3e5}
.c .v{position:relative;z-index:1}
.c.pop .v{animation:pop .35s cubic-bezier(.2,1.6,.4,1)}
.c.shake{animation:shake .35s}
.c.wave:before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,#ffe7a6,#c9dcff);opacity:0;animation:wave .9s ease-out forwards;animation-delay:var(--d,0s)}
.n{position:absolute;inset:2px;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);font-size:calc(var(--g) / 36);color:#6a7590;font-weight:600}
.n span{display:flex;align-items:center;justify-content:center}
.n span.hl{color:#3d55c4;font-weight:800}
@keyframes pop{0%{transform:scale(.4);opacity:.2}100%{transform:scale(1);opacity:1}}
@keyframes shake{20%{transform:translateX(-4px)}40%{transform:translateX(4px)}60%{transform:translateX(-3px)}80%{transform:translateX(2px)}}
@keyframes wave{0%{opacity:0}30%{opacity:.95}100%{opacity:0}}
.mid{flex:1;display:flex;flex-direction:column;justify-content:center;width:var(--g);padding-bottom:env(safe-area-inset-bottom)}
.tools{display:flex;justify-content:space-around;width:100%}
.tool{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:12px;color:#5d6880;cursor:pointer;position:relative;background:none;border:0;font-family:inherit;padding:6px 10px}
.tool svg{width:26px;height:26px;stroke:#3a4763;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.tool .badge{position:absolute;top:0;right:4px;background:#4b62c9;color:#fff;font-size:10px;font-weight:800;border-radius:9px;padding:1px 6px}
.tool .badge.off{background:#aab2c4}
.tool.on svg{stroke:#4b62c9}.tool.on{color:#4b62c9}
.pad{display:flex;justify-content:space-between;width:100%;margin:14px 0 0}
.k{flex:1;display:flex;flex-direction:column;align-items:center;font-size:calc(var(--g) / 10.5);font-weight:400;color:#3d55c4;cursor:pointer;line-height:1.1;border-radius:10px;padding:4px 0;transition:transform .1s,opacity .3s}
.k small{font-size:11px;color:#9aa3b6;font-weight:600}
.k:active{transform:scale(.9);background:rgba(75,98,201,.08)}
.k.gone{opacity:0;pointer-events:none}
.notes-on .k{color:#7a8499}
`);
const app = document.createElement('div'); app.id = 'app';
app.innerHTML = `
<div class="stats"><div data-diff><span>Difficulty</span><b>Easy</b></div><div class="m"><span>Mistakes</span><b data-mis>0/3</b></div><div class="m"><span>Score</span><b data-sc>0</b></div><div class="r"><span>Time</span><b data-t>0:00</b></div></div>
<div class="grid"></div>
<div class="mid"><div class="tools">
 <button class="tool" data-undo><svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/></svg>Undo</button>
 <button class="tool" data-erase><svg viewBox="0 0 24 24"><path d="M20 20H8.5L3.6 15.1a2 2 0 010-2.8l9.2-9.2a2 2 0 012.8 0l4.3 4.3a2 2 0 010 2.8L12 18.4"/><path d="M8 10l6 6"/></svg>Erase</button>
 <button class="tool" data-notes><svg viewBox="0 0 24 24"><path d="M15.2 4.8l4 4L8 20H4v-4z"/><path d="M13 7l4 4"/></svg><span class="badge off">OFF</span>Notes</button>
 <button class="tool" data-hint><svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 00-3.5 10.9c.6.4 1 1.1 1 1.9V16h5v-.2c0-.8.4-1.5 1-1.9A6 6 0 0012 3z"/></svg><span class="badge">3</span>Hint</button>
</div>
<div class="pad"></div></div>`;
document.body.appendChild(app);
const gridEl = app.querySelector('.grid'), padEl = app.querySelector('.pad');
const $ = (s) => app.querySelector(s);
const cells = [], keys = [];
for (let i = 0; i < 81; i++) {
  const r = Math.floor(i / 9), c = i % 9, d = document.createElement('div');
  d.className = 'c' + (c % 3 === 2 && c < 8 ? ' bx' : '') + (r % 3 === 2 && r < 8 ? ' by' : '') + (c === 8 ? ' l9' : '') + (r === 8 ? ' b9' : '');
  d.innerHTML = '<span class="v"></span><div class="n">' + Array.from({ length: 9 }, () => '<span></span>').join('') + '</div>';
  d.addEventListener('pointerdown', (e) => { e.preventDefault(); select(i); });
  gridEl.appendChild(d); cells.push(d);
}
for (let k = 1; k <= 9; k++) { const d = document.createElement('div'); d.className = 'k'; d.innerHTML = `${k}<small></small>`; d.addEventListener('pointerdown', (e) => { e.preventDefault(); press(k); }); padEl.appendChild(d); keys.push(d); }
function layout() {
  const w = Math.min(innerWidth - 20, 520), h = innerHeight - 52 - 50 - 200;
  app.style.setProperty('--g', Math.floor(Math.min(w, h)) + 'px');
}
addEventListener('resize', layout); layout();

// ---------------------------------------------------------------- generator (bitmask solver, unique solution)
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const BOX = (i) => Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3);
const PEERS = Array.from({ length: 81 }, (_, i) => { const s = new Set(); for (let j = 0; j < 81; j++) if (j !== i && (Math.floor(j / 9) === Math.floor(i / 9) || j % 9 === i % 9 || BOX(j) === BOX(i))) s.add(j); return [...s]; });
const popc = (m) => { let n = 0; while (m) { m &= m - 1; n++; } return n; };
function solve(g, limit = 2, rand = null) {
  const R = new Array(9).fill(0), C = new Array(9).fill(0), B = new Array(9).fill(0); g = g.slice();
  for (let i = 0; i < 81; i++) if (g[i]) { const b = 1 << g[i]; R[Math.floor(i / 9)] |= b; C[i % 9] |= b; B[BOX(i)] |= b; }
  let count = 0, sol = null;
  (function rec() {
    if (count >= limit) return;
    let best = -1, bm = 0, bc = 10;
    for (let i = 0; i < 81; i++) if (!g[i]) { const m = ~(R[Math.floor(i / 9)] | C[i % 9] | B[BOX(i)]) & 0x3fe, n = popc(m); if (n < bc) { bc = n; best = i; bm = m; if (n <= 1) break; } }
    if (best < 0) { count++; if (!sol) sol = g.slice(); return; }
    if (!bc) return;
    const ds = []; for (let d = 1; d <= 9; d++) if (bm & (1 << d)) ds.push(d);
    if (rand) for (let k = ds.length - 1; k > 0; k--) { const j = Math.floor(rand() * (k + 1)); [ds[k], ds[j]] = [ds[j], ds[k]]; }
    const r = Math.floor(best / 9), c = best % 9, b = BOX(best);
    for (const d of ds) { const bit = 1 << d; g[best] = d; R[r] |= bit; C[c] |= bit; B[b] |= bit; rec(); R[r] &= ~bit; C[c] &= ~bit; B[b] &= ~bit; g[best] = 0; if (count >= limit) return; }
  })();
  return { count, sol };
}
function generate(seed, holes) {
  const rand = rng(seed * 2654435761 + 12345);
  const full = solve(new Array(81).fill(0), 1, rand).sol, puz = full.slice();
  const order = Array.from({ length: 41 }, (_, i) => i); // symmetric pairs (i, 80-i)
  for (let k = order.length - 1; k > 0; k--) { const j = Math.floor(rand() * (k + 1)); [order[k], order[j]] = [order[j], order[k]]; }
  let removed = 0;
  for (const i of order) {
    if (removed >= holes) break;
    const j = 80 - i, a = puz[i], b = puz[j];
    puz[i] = 0; puz[j] = 0;
    if (solve(puz, 2).count === 1) removed += i === j ? 1 : 2; else { puz[i] = a; puz[j] = b; }
  }
  return { puz, full };
}

// ---------------------------------------------------------------- state
let state = 'ready', level = S.get('level', 1), score = 0, mistakes = 0, hints = 3, notesMode = false, sel = -1, time = 0, recorded = false, beatenShown = false;
let puz, sol, val, given, notes, history, curDiff = -1, lastTick = 0, built = false;

function build() {
  const fk = D.isDaily ? 1 : F.k();
  const holes = Math.max(30, Math.min(60, Math.round(HOLES[diff] * (1 + (fk - 1) * 0.5))));
  const seed = D.seed ? D.seed : level * 7919 + diff * 104729 + 17;
  const g = generate(seed, holes);
  puz = g.puz; sol = g.full; val = puz.slice(); given = puz.map(v => v > 0); notes = new Array(81).fill(0); history = [];
  score = 0; mistakes = 0; hints = 3; notesMode = false; sel = -1; time = 0; recorded = false; beatenShown = false; curDiff = diff; built = true;
  ui.levels(D.isDaily ? 1 : level); if (D.isDaily) { ui.els.top.querySelector('[data-a]').textContent = '★'; ui.els.top.querySelector('[data-b]').textContent = '✓'; }
  $('[data-diff] b').textContent = DIFFS[diff]; $('[data-diff]').classList.toggle('tap', !D.isDaily);
  render(); updateHud();
}
function filledFrac() { let n = 0, e = 0; for (let i = 0; i < 81; i++) if (!given[i]) { e++; if (val[i] === sol[i]) n++; } return e ? n / e : 1; }
function updateHud() {
  $('[data-mis]').textContent = `${mistakes}/${MAX_MISTAKES}`; $('[data-mis]').style.color = mistakes ? '#d9434f' : '';
  $('[data-sc]').textContent = score; $('[data-t]').textContent = fmtTime(time);
  const nb = $('[data-notes] .badge'); nb.textContent = notesMode ? 'ON' : 'OFF'; nb.classList.toggle('off', !notesMode); $('[data-notes]').classList.toggle('on', notesMode);
  const hb = $('[data-hint] .badge'); hb.textContent = hints; hb.classList.toggle('off', !hints);
  app.classList.toggle('notes-on', notesMode);
  ui.progress(filledFrac());
}
function render() {
  const sv = sel >= 0 ? val[sel] : 0, peers = sel >= 0 ? new Set(PEERS[sel]) : new Set();
  const counts = new Array(10).fill(0); for (let i = 0; i < 81; i++) if (val[i] && val[i] === sol[i]) counts[val[i]]++;
  for (let i = 0; i < 81; i++) {
    const d = cells[i], v = val[i], cl = d.classList;
    d.firstChild.textContent = v || '';
    cl.toggle('user', !given[i] && v > 0); cl.toggle('bad', v > 0 && v !== sol[i]);
    cl.toggle('sel', i === sel); cl.toggle('peer', peers.has(i)); cl.toggle('same', sv > 0 && v === sv && i !== sel);
    const ns = d.lastChild.children, m = v ? 0 : notes[i];
    for (let k = 0; k < 9; k++) { ns[k].textContent = m & (1 << (k + 1)) ? k + 1 : ''; ns[k].classList.toggle('hl', sv === k + 1); }
  }
  keys.forEach((k, j) => { k.classList.toggle('gone', counts[j + 1] >= 9); k.lastChild.textContent = 9 - counts[j + 1] > 0 ? 9 - counts[j + 1] : ''; });
}
const popY = () => (gridEl.getBoundingClientRect().bottom + 40) / innerHeight * 100;
function cellCenter(i) { const r = cells[i].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }

function select(i) { if (state !== 'play') return; sel = i; soft.click(); render(); }
function unitDone(cellsIdx) { return cellsIdx.every(j => val[j] === sol[j]); }
const UNITS = (i) => { const r = Math.floor(i / 9), c = i % 9, b = BOX(i); return [Array.from({ length: 9 }, (_, k) => r * 9 + k), Array.from({ length: 9 }, (_, k) => k * 9 + c), Array.from({ length: 81 }, (_, k) => k).filter(k => BOX(k) === b)]; };
function wave(list, from, delay = 0.045) {
  const [fr, fc] = [Math.floor(from / 9), from % 9];
  for (const j of list) { const d = cells[j]; d.classList.remove('wave'); void d.offsetWidth; d.style.setProperty('--d', (Math.hypot(Math.floor(j / 9) - fr, j % 9 - fc) * delay).toFixed(2) + 's'); d.classList.add('wave'); }
}

function press(k, fromHint = false) {
  if (state !== 'play' || sel < 0 || given[sel] || val[sel] === sol[sel]) return;
  const i = sel;
  if (notesMode && !fromHint) {
    history.push({ i, v: val[i], n: notes[i] }); notes[i] ^= 1 << k; val[i] = 0; soft.click(); render(); return;
  }
  history.push({ i, v: val[i], n: notes[i] });
  val[i] = k; notes[i] = 0;
  const d = cells[i]; d.classList.remove('pop', 'shake'); void d.offsetWidth;
  if (k !== sol[i]) {
    mistakes++; d.classList.add('shake'); soft.err(); buzz([30, 40, 30]); updateHud(); render();
    if (mistakes >= MAX_MISTAKES) return lose();
    return;
  }
  for (const p of PEERS[i]) notes[p] &= ~(1 << k);
  d.classList.add('pop'); chime(k + 2, 69, 0.11); buzz(8);
  const [x, y] = cellCenter(i); fx.sparks(x, y, ['#ffd36e', '#9db4ff', '#ffffff'], 8, { speed: 2.4, size: 3 });
  if (!fromHint) score += PTS[curDiff];
  // completed rows / columns / boxes ripple and add a bonus
  let units = 0;
  for (const u of UNITS(i)) if (unitDone(u)) { units++; wave(u, i); if (!fromHint) score += PTS[curDiff] * 2; }
  if (units) { arp([72, 76, 79, 84].slice(0, 2 + units), 70, 0.1); ui.pop(units > 1 ? `${units}× COMPLETE` : 'COMPLETE', '#3d55c4', 26, popY()); }
  let digitDone = 0; for (let j = 0; j < 81; j++) if (val[j] === k && sol[j] === k) digitDone++;
  if (digitDone === 9) setTimeout(() => note(84, 0.8, 0.08), 200);
  if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#d18b00', 40, popY()); fx.confetti(60); }
  updateHud(); render();
  if (val.every((v, j) => v === sol[j])) win();
}
function erase() {
  if (state !== 'play' || sel < 0 || given[sel] || val[sel] === sol[sel]) return;
  if (!val[sel] && !notes[sel]) return;
  history.push({ i: sel, v: val[sel], n: notes[sel] }); val[sel] = 0; notes[sel] = 0; soft.swish(); render(); updateHud();
}
function undo() {
  if (state !== 'play') return;
  const h = history.pop(); if (!h) return;
  if (val[h.i] === sol[h.i] && h.v !== sol[h.i]) { history.push(h); return; }   // correct digits stay; undo works on notes and wrong digits
  val[h.i] = h.v; notes[h.i] = h.n; sel = h.i; soft.swish(); render(); updateHud();
}
function hint() {
  if (state !== 'play' || !hints) return;
  let i = sel >= 0 && !given[sel] && val[sel] !== sol[sel] ? sel : -1;
  if (i < 0) { let best = 99; for (let j = 0; j < 81; j++) if (val[j] !== sol[j]) { const c = candidates(j); if (c < best) { best = c; i = j; } } }
  if (i < 0) return;
  hints--; sel = i; press(sol[i], true); ui.pop('HINT', '#3d55c4', 24, popY());
}
function candidates(i) { let m = 0x3fe; for (const p of PEERS[i]) if (val[p] && val[p] === sol[p]) m &= ~(1 << val[p]); return popc(m); }

$('[data-undo]').addEventListener('pointerdown', (e) => { e.preventDefault(); undo(); });
$('[data-erase]').addEventListener('pointerdown', (e) => { e.preventDefault(); erase(); });
$('[data-notes]').addEventListener('pointerdown', (e) => { e.preventDefault(); if (state !== 'play') return; notesMode = !notesMode; soft.click(); updateHud(); });
$('[data-hint]').addEventListener('pointerdown', (e) => { e.preventDefault(); hint(); });
$('[data-diff]').addEventListener('pointerdown', (e) => { e.preventDefault(); if (state !== 'play' || D.isDaily) return; state = 'ready'; ui.start(); });
addEventListener('keydown', (e) => {
  if (state !== 'play') return;
  if (/^[1-9]$/.test(e.key)) press(+e.key);
  else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') erase();
  else if (e.key === 'n' || e.key === 'N') { notesMode = !notesMode; updateHud(); }
  else if (e.key === 'z' && (e.metaKey || e.ctrlKey)) undo();
  else if (e.key.startsWith('Arrow')) { if (sel < 0) sel = 40; const r = Math.floor(sel / 9), c = sel % 9; sel = e.key === 'ArrowUp' ? ((r + 8) % 9) * 9 + c : e.key === 'ArrowDown' ? ((r + 1) % 9) * 9 + c : e.key === 'ArrowLeft' ? r * 9 + (c + 8) % 9 : r * 9 + (c + 1) % 9; render(); }
});

function win() {
  if (state !== 'play') return;
  state = 'won';
  if (!recorded) { recorded = true; LB.submit(1); if (!D.isDaily) F.level(true); }
  const t = Math.round(time);
  wave(Array.from({ length: 81 }, (_, k) => k), sel >= 0 ? sel : 40, 0.07);
  arp([67, 71, 74, 79, 83, 86], 110, 0.12, 0.9); fx.confetti(); buzz([20, 60, 20]);
  if (D.isDaily) { const prev = S.get('daily_' + todayKey(), null); if (!prev || score > prev.s) S.set('daily_' + todayKey(), { t, s: score }); }
  else { level++; S.set('level', level); }
  const best = S.get('best_' + curDiff, 0); if (!best || t < best) S.set('best_' + curDiff, t);
  D.won(score);
  ui.win(D.isDaily ? 'DAILY' : level - 1, `${DIFFS[curDiff]} · ${fmtTime(t)} · ${score} pts${mistakes ? '' : ' · no mistakes'}`);
}
function lose() {
  state = 'lost';
  if (!recorded) { recorded = true; if (!D.isDaily) F.level(false, filledFrac()); }
  ui.lose('Three strikes', `${Math.round(filledFrac() * 100)}% solved · same puzzle, fresh start`);
}
ui.onTap((which) => { LB.start();
  if (which === 'start') {
    if (!built || curDiff !== diff) build();
    state = 'play'; lastTick = performance.now();
  } else if (which === 'win') {
    if (D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
    build(); state = 'play';
  } else { const keepLevel = level; level = keepLevel; build(); state = 'play'; }
});

// timer
(function t() { const now = performance.now(); if (state === 'play' && !document.hidden) { time += Math.min(1, (now - lastTick) / 1000); $('[data-t]').textContent = fmtTime(time); } lastTick = now; requestAnimationFrame(t); })();
build();

// ---------------------------------------------------------------- test hook: the bot fills the most constrained cell correctly
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play') return;
    if (notesMode) { notesMode = false; updateHud(); }
    let best = 99, i = -1; for (let j = 0; j < 81; j++) if (val[j] !== sol[j]) { const c = candidates(j); if (c < best) { best = c; i = j; } }
    if (i < 0) return; sel = i; render(); press(sol[i]);
  },
};
