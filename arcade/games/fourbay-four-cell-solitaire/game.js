// Fourbay — the classic four-cell patience (a public card game) on a harbour-blue felt. All 52 cards face up in eight
// columns, four free cells to park single cards, four foundations to build up by suit. Build columns down in
// alternating colours; runs move together when there is room (free cells and empty columns). Safe cards fly home
// on their own. Every deal is checked winnable by our solver before you see it.
import { createUI, store, buzz } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { css, cardTheme, startCard, fx2d, chime, arp, soft, todayKey, fmtTime } from './calm.js';
import { SUITS, tableCSS, cardEl, tableDOM, shakeEl, homeEl, cascade } from './cards.js';
import { SU, RK, canStack, dealCards, clonePos, capacity, runStart, legal, apply, safeAuto, moves as genMoves, solve } from './rules.js';

const NAME = 'Fourbay: Four Cell Solitaire';
const S = store('fourbay');
const F = flow('fourbay');
const ui = createUI({ title: 'Fourbay', hint: 'Tap to deal', hand: '', score: false });
cardTheme({ accent: '#2f8fb8' });
const D = daily('fourbay', ui, { name: NAME });
const B = board({ game: 'fourbay', label: 'Games won', limits: { maxRun: 1, maxPerSec: 0.1 }, mode: 'sum' });   // world board: games won today
const fx = fx2d(11);
const doneToday = S.get('daily_' + todayKey(), null);
startCard(ui, D, {
  kicker: D.isDaily ? 'Daily deal' : 'four cell solitaire',
  doneLine: doneToday ? (D.isDaily ? `Solved today · ${doneToday.s.toLocaleString()} pts` : 'Daily deal solved ✓') : null,
});
{ const p = document.createElement('p'); p.textContent = 'Every deal is winnable'; p.style.cssText = 'font-size:14px;opacity:.7;margin-top:6px'; ui.els.start.querySelector('.calm-kicker').after(p); }
if (D.isDaily) ui.els.win.querySelector('p').innerHTML = 'Daily deal<span data-l hidden></span>';
else ui.els.win.querySelector('p').innerHTML = 'DEAL <span data-l>1</span>';
ui.els.win.querySelector('h1').textContent = 'Safe harbour!';
ui.els.lose.querySelector('.hint').textContent = 'Tap to replay this deal';
const undoBtn = document.createElement('button'); undoBtn.className = 'hc-btn'; undoBtn.textContent = '↶ Undo last move'; undoBtn.style.marginTop = '14px';
undoBtn.addEventListener('pointerdown', e => e.stopPropagation());
undoBtn.addEventListener('click', e => { e.stopPropagation(); ui.els.lose.classList.add('hc-hidden'); state = 'play'; undo(); });
ui.els.lose.querySelector('[data-x]').after(undoBtn);

tableCSS({ felt: ['#2a7391', '#1a5470', '#0b2a3c'], back: ['#2f8bb3', '#123f58'], trim: '#ffd38a',
  motif: 'polygon(50% 0,61% 39%,100% 50%,61% 61%,50% 100%,39% 61%,0 50%,39% 39%)' });
css(`.cell{border-style:dashed;font-size:calc(var(--cw) * .32);letter-spacing:1px}
#cap{position:fixed;left:0;right:0;z-index:5;text-align:center;color:#fff;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;opacity:.55;pointer-events:none}`);
const T = tableDOM({ stats: [['s', 'Score'], ['m', 'Moves'], ['t', 'Time']], buttons: [['new', '✦', 'New'], ['hint', '💡', 'Hint'], ['undo', '↶', 'Undo']] });
const { table, toast } = T;
const capEl = document.createElement('div'); capEl.id = 'cap'; document.body.appendChild(capEl);
T.btn('new').onclick = () => { if (state !== 'play') return; giveUp(); skip++; S.set('skip', skip); build(); state = 'play'; toast('New deal'); };
T.btn('hint').onclick = () => hint();
T.btn('undo').onclick = () => undo();

function paintDeco() {   // soft harbour swell along the bottom
  const c = T.deco, dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth, H = c.clientHeight || innerHeight * 0.34;
  c.width = W * dpr; c.height = H * dpr; const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (let l = 0; l < 5; l++) {
    const y0 = H * (0.45 + l * 0.12), amp = 6 + l * 2, len = 70 + l * 16;
    g.fillStyle = `rgba(${l % 2 ? '120,200,230' : '6,30,46'},${0.06 + l * 0.03})`; g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W + 10; x += 8) g.lineTo(x, y0 + Math.sin((x + l * 37) / len * Math.PI * 2) * amp);
    g.lineTo(W, H); g.closePath(); g.fill();
  }
}

// ---------------------------------------------------------------- state
let state = 'ready', level = S.get('level', 1), skip = S.get('skip', 0), score = 0, nMoves = 0, t0 = 0, elapsed = 0;
let P = { cols: [[], [], [], [], [], [], [], []], cells: [-1, -1, -1, -1], found: [0, 0, 0, 0] };
let dealing = false, hist = [], recorded = false, beatenShown = false, seedUsed = 0, finishing = false, autoBusy = false, plan = null;
const els = [], pos = [];
let G = { cw: 44, ch: 62, gap: 4, ox: 6, topY: 86, tabY: 170, maxB: 760 };
const cellSlots = [], foundSlots = [], colSlots = [];
const mkSlot = (cls, txt) => { const d = document.createElement('div'); d.className = 'slot ' + cls; d.textContent = txt; table.appendChild(d); return d; };
for (let x = 0; x < 4; x++) cellSlots.push(mkSlot('cell', 'CELL'));
for (let s = 0; s < 4; s++) foundSlots.push(mkSlot('fnd', SUITS[s]));
for (let i = 0; i < 8; i++) colSlots.push(mkSlot('tb', ''));
for (let id = 0; id < 52; id++) {
  const e = cardEl(table, SU(id), RK(id)); els.push(e);
  e.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); grab(id, ev); });
}

const colX = (i) => G.ox + i * (G.cw + G.gap);
function layout() {
  const W = innerWidth, H = innerHeight, aw = Math.min(W, 640);
  G.gap = Math.max(4, Math.round(aw * 0.012)); G.cw = Math.min(80, (aw - 10 - 7 * G.gap) / 8); G.ch = G.cw * 1.42;
  G.ox = (W - (8 * G.cw + 7 * G.gap)) / 2;
  T.stats.style.top = '56px';
  G.topY = 86; G.tabY = G.topY + G.ch + Math.max(22, G.ch * 0.36);
  G.maxB = H - (T.bar.offsetHeight || 70) - 6;
  capEl.style.top = G.topY + G.ch + 5 + 'px';
  table.style.setProperty('--cw', G.cw + 'px'); table.style.setProperty('--ch', G.ch + 'px');
  const put = (el, x, y) => { el.style.left = x + 'px'; el.style.top = y + 'px'; };
  for (let x = 0; x < 4; x++) put(cellSlots[x], colX(x), G.topY);
  for (let s = 0; s < 4; s++) put(foundSlots[s], colX(4 + s), G.topY);
  for (let i = 0; i < 8; i++) put(colSlots[i], colX(i), G.tabY);
  T.toastEl.style.top = G.tabY + 10 + 'px';
  paintDeco(); render();
}
addEventListener('resize', layout);

function uOff(i) {
  const n = P.cols[i].length; let u = G.ch * 0.3;
  if (n > 1) { const need = G.tabY + (n - 1) * u + G.ch; if (need > G.maxB) u = Math.max(G.ch * 0.15, (G.maxB - G.ch - G.tabY) / (n - 1)); }
  return u;
}
const cardPos = (i, k) => ({ x: colX(i), y: G.tabY + k * uOff(i) });
function render() {
  const set = (id, x, y, z) => { pos[id] = { x, y, z }; const e = els[id]; e.classList.remove('down'); e.style.transform = `translate(${x}px,${y}px)`; e.style.zIndex = z; e.style.visibility = ''; };
  const home = [[], [], [], []]; for (let id = 0; id < 52; id++) if (RK(id) <= P.found[SU(id)]) home[SU(id)].push(id);
  home.forEach((a, s) => a.sort((x, y) => RK(x) - RK(y)).forEach((id, k) => { set(id, colX(4 + s), G.topY, 120 + k); els[id].style.visibility = k < a.length - 2 ? 'hidden' : ''; }));
  P.cells.forEach((id, x) => { if (id >= 0) set(id, colX(x), G.topY, 100); });
  P.cols.forEach((col, i) => col.forEach((id, k) => { const p = cardPos(i, k); set(id, p.x, p.y, 200 + k); }));
  T.stat('s', score.toLocaleString()); T.stat('m', nMoves);
  const homeN = P.found.reduce((a, b) => a + b, 0); ui.progress(homeN / 52);
  T.btn('undo').disabled = !hist.length;
  capEl.textContent = state === 'play' || state === 'ready' ? `can move ${capacity(P, false)} card${capacity(P, false) > 1 ? 's' : ''} at once` : '';
}
setInterval(() => { if (state === 'play' && t0) { elapsed = (performance.now() - t0) / 1000; T.stat('t', fmtTime(elapsed)); } }, 500);

// ---------------------------------------------------------------- deal
function build() {
  const base = (D.seed || (level * 7919 + skip * 104729));
  const fk = D.isDaily ? 1 : F.k(), found = [];
  // winnable deals: our solver wins each deal before you see it. Flow: steadier players get the deal that needed the
  // most search, struggling players the most direct one.
  for (let k = 0; k < 12 && found.length < (fk > 1.06 || fk < 0.96 ? 2 : 1); k++) {
    const s = base + k * 31337, cols = dealCards(s), r = solve({ cols, cells: [-1, -1, -1, -1], found: [0, 0, 0, 0] }, 6000);
    if (r.ok) found.push({ seed: s, cols, nodes: r.nodes, path: r.path });
  }
  found.sort((a, b) => a.nodes - b.nodes);
  const pick = found.length ? found[fk > 1.06 ? found.length - 1 : 0] : { seed: base, cols: dealCards(base), path: null };
  seedUsed = pick.seed; start(pick.cols); plan = pick.path ? { path: pick.path, idx: 0 } : null;
  ui.levels(D.isDaily ? 1 : level); if (D.isDaily) { ui.els.top.querySelector('[data-a]').textContent = '★'; ui.els.top.querySelector('[data-b]').textContent = '✓'; }
  // deal animation: cards fly out from the middle of the cells row, row by row
  render();
  els.forEach(e => { e.classList.add('drag'); e.style.transform = `translate(${(innerWidth - G.cw) / 2}px,${G.topY}px)`; e.style.zIndex = 20; e.classList.add('down'); });
  void table.offsetWidth; els.forEach(e => e.classList.remove('drag'));
  let n = 0; dealing = true;
  for (let k = 0; k < 7; k++) for (let i = 0; i < 8; i++) {
    const id = P.cols[i][k]; if (id === undefined) continue; const p = pos[id], delay = 60 + n++ * 18;
    setTimeout(() => { const e = els[id]; e.classList.remove('down'); e.style.transform = `translate(${p.x}px,${p.y}px)`; e.style.zIndex = p.z; if (n % 3 === 0) soft.click(); }, delay);
  }
  setTimeout(() => { dealing = false; if (state === 'play' || state === 'ready') { render(); if (state === 'play') runAuto(); } }, 60 + 52 * 18 + 250);
}
function start(cols) {
  P = { cols: cols.map(c => c.slice()), cells: [-1, -1, -1, -1], found: [0, 0, 0, 0] };
  score = 0; nMoves = 0; t0 = 0; elapsed = 0; hist = []; recorded = false; beatenShown = false; finishing = false; autoBusy = false; plan = null;
  T.stat('t', '0:00'); T.stat('s', 0); T.stat('m', 0); ui.progress(0);
}

// ---------------------------------------------------------------- moves
function snap() { hist.push(JSON.stringify({ P, score, nMoves })); if (hist.length > 500) hist.shift(); }
function undo() {
  if (state !== 'play' || !hist.length || autoBusy || finishing) return;
  plan = null; const s = JSON.parse(hist.pop()); P = s.P; score = s.score; nMoves = s.nMoves + 1;
  soft.swish(); render();
}
function addScore(n) { score = Math.max(0, score + n); if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); fx.confetti(60); } }
function startClock() { if (!t0) t0 = performance.now() - elapsed * 1000; }
const same = (a, b) => a && b && a.length === b.length && a.every((x, q) => x === b[q]);
function goneHome(id) {
  const s = SU(id), fp = { x: colX(4 + s) + G.cw / 2, y: G.topY + G.ch / 2 };
  chime(RK(id) - 1, 67, 0.11); buzz(6); addScore(10);
  setTimeout(() => { fx.sparks(fp.x, fp.y, ['#ffd38a', '#fff', '#a8e4ff'], 9, { speed: 2.4, size: 3 }); homeEl(els[id]); }, 220);
  if (RK(id) === 13) setTimeout(() => { ui.pop(`${SUITS[s]} complete`, '#ffd38a', 30, 34); arp([72, 76, 79, 84], 80, 0.1); }, 250);
}
function exec(m, { quiet = false } = {}) {
  if (!legal(P, m)) return false;
  snap(); startClock();
  if (plan) { if (same(plan.path[plan.idx], m)) plan.idx++; else plan = null; }
  const id = m[0] === 'c' ? P.cols[m[1]][m[2]] : P.cells[m[1]], n = m[0] === 'c' ? P.cols[m[1]].length - m[2] : 1;
  apply(P, m); nMoves++;
  if (m[3] === 'f') goneHome(id); else { soft.wood(); buzz(5); if (n > 2 && !quiet) ui.pop(`${n} cards`, '#ffd38a', 22, 30); }
  render(); runAuto();
  return true;
}
// safe cards go home one by one (the bot and the solver count on the same rule)
function runAuto() {
  const m = safeAuto(P);
  if (!m) { autoBusy = false; after(); return; }
  autoBusy = true;
  setTimeout(() => {
    if (state !== 'play') { autoBusy = false; return; }
    const m2 = safeAuto(P); if (!m2) { autoBusy = false; after(); return; }
    const id = m2[0] === 'c' ? P.cols[m2[1]][m2[2]] : P.cells[m2[1]];
    apply(P, m2); goneHome(id); render(); runAuto();
  }, botOn() ? 40 : 110);
}
const tooMany = (n, toEmpty) => { toast(`Room to move ${capacity(P, toEmpty)} card${capacity(P, toEmpty) > 1 ? 's' : ''}, not ${n}`); };
// tap → the best spot: home, a column that takes the run, an empty column, then a free cell
function autoMove(src) {
  const m0 = src.t === 'col' ? ['c', src.i, src.k] : ['x', src.x, 0];
  const n = src.t === 'col' ? P.cols[src.i].length - src.k : 1;
  if (n === 1 && legal(P, [...m0, 'f', 0])) return exec([...m0, 'f', 0]);
  let best = null, bv = -1;
  for (let j = 0; j < 8; j++) {
    const t = P.cols[j]; if (!t.length) continue;
    const m = [...m0, 'c', j]; if (legal(P, m) && t.length > bv) { bv = t.length; best = m; }
  }
  if (best) return exec(best);
  if (src.t === 'col' && src.k === 0) { /* a whole column into an empty one gains nothing */ }
  else for (let j = 0; j < 8; j++) if (!P.cols[j].length) { const m = [...m0, 'c', j]; if (legal(P, m)) return exec(m); if (n > capacity(P, true)) { tooMany(n, true); return 'msg'; } break; }
  if (n === 1 && src.t === 'col') { const x = P.cells.indexOf(-1); if (x >= 0) return exec([...m0, 'x', x]); toast('All four cells are full'); return 'msg'; }
  if (n > 1) { for (let j = 0; j < 8; j++) { const t = P.cols[j]; if (t.length && canStack(P.cols[src.i][src.k], t[t.length - 1])) { tooMany(n, false); return 'msg'; } } }
  return false;
}

// ---------------------------------------------------------------- drag
let dragS = null;
function locate(id) {
  for (let i = 0; i < 8; i++) { const k = P.cols[i].indexOf(id); if (k >= 0) return { t: 'col', i, k }; }
  const x = P.cells.indexOf(id); if (x >= 0) return { t: 'cell', x };
  return null;
}
function idsOf(src) { return src.t === 'col' ? P.cols[src.i].slice(src.k) : [P.cells[src.x]]; }
function grab(id, e) {
  if (state !== 'play' || finishing || autoBusy || dealing) return;
  const src = locate(id); if (!src) return;
  const ids = idsOf(src);
  for (let q = 1; q < ids.length; q++) if (!canStack(ids[q], ids[q - 1])) { shakeEl(els[id]); soft.err(); return; }
  dragS = { src, ids, sx: e.clientX, sy: e.clientY, moved: false, base: ids.map(i => ({ ...pos[i] })) };
}
addEventListener('pointermove', (e) => {
  if (!dragS) return; const dx = e.clientX - dragS.sx, dy = e.clientY - dragS.sy;
  if (!dragS.moved && Math.hypot(dx, dy) < 8) return;
  dragS.moved = true;
  dragS.ids.forEach((id, k) => { const b = dragS.base[k], el = els[id]; el.classList.add('drag'); el.style.zIndex = 1000 + k; el.style.transform = `translate(${b.x + dx}px,${b.y + dy}px) scale(1.04)`; });
});
addEventListener('pointerup', (e) => {
  if (!dragS) return; const d = dragS; dragS = null; d.ids.forEach(id => els[id].classList.remove('drag'));
  if (!d.moved) { const r = autoMove(d.src); if (!r) { soft.err(); buzz(20); d.ids.forEach(id => shakeEl(els[id])); render(); } else if (r === 'msg') { soft.err(); render(); } return; }
  const dx = e.clientX - d.sx, dy = e.clientY - d.sy, cx = d.base[0].x + dx + G.cw / 2, cy = d.base[0].y + dy + G.ch / 2;
  const m0 = d.src.t === 'col' ? ['c', d.src.i, d.src.k] : ['x', d.src.x, 0];
  let best = null, bd = 1e9;
  const tryT = (m, x, y) => { const dd = Math.hypot(cx - x, (cy - y) * 0.6); if (dd < bd && dd < G.cw * 1.6 && legal(P, m)) { bd = dd; best = m; } };
  for (let s = 0; s < 4; s++) tryT([...m0, 'f', 0], colX(4 + s) + G.cw / 2, G.topY + G.ch / 2);
  for (let x = 0; x < 4; x++) tryT([...m0, 'x', x], colX(x) + G.cw / 2, G.topY + G.ch / 2);
  for (let j = 0; j < 8; j++) { const n = P.cols[j].length, p = n ? cardPos(j, n - 1) : { x: colX(j), y: G.tabY }; tryT([...m0, 'c', j], p.x + G.cw / 2, p.y + G.ch / 2); }
  if (!best) {
    // a run that would fit somewhere but is too long for the free space: say why
    for (let j = 0; j < 8; j++) { const t = P.cols[j]; if (d.ids.length > 1 && (!t.length || canStack(d.ids[0], t[t.length - 1])) && d.ids.length > capacity(P, !t.length)) { tooMany(d.ids.length, !t.length); break; } }
  }
  if (!best || !exec(best)) { soft.err(); render(); }
});

// ---------------------------------------------------------------- after every move: win, stuck
const cleared = () => P.found.reduce((a, b) => a + b, 0) / 52;
function after() {
  if (P.found.every(n => n === 13)) return finish();
  if (!genMoves(P).length) setTimeout(() => { if (state === 'play' && !autoBusy && !genMoves(P).length) lose(); }, 600);
}
function giveUp() { if (!recorded && nMoves > 0 && !D.isDaily) { recorded = true; F.level(false, cleared()); } }

// ---------------------------------------------------------------- hint (our solver looks for a winning line from here)
function hint() {
  if (state !== 'play' || finishing || autoBusy) return;
  table.querySelectorAll('.glow').forEach(e => e.classList.remove('glow'));
  const r = solve(clonePos(P), 4000); let m = r.ok ? r.path[0] : null;
  if (!m) { const ms = genMoves(P); m = ms.find(x => x[3] === 'f') || ms.find(x => x[3] === 'c' && P.cols[x[4]].length) || null; if (!m) { toast('No moves left — try Undo'); return; } toast('No winning line from here — Undo may help'); }
  const id = m[0] === 'c' ? P.cols[m[1]][m[2]] : P.cells[m[1]];
  els[id].classList.add('glow');
  if (m[3] === 'c' && P.cols[m[4]].length) els[P.cols[m[4]][P.cols[m[4]].length - 1]].classList.add('glow');
  else (m[3] === 'x' ? cellSlots[m[4]] : m[3] === 'f' ? foundSlots[SU(id)] : colSlots[m[4]]).animate([{ background: 'rgba(255,211,138,.4)' }, { background: 'rgba(0,0,0,.08)' }], 1200);
  soft.click(); setTimeout(() => table.querySelectorAll('.glow').forEach(e => e.classList.remove('glow')), 1600);
}

// ---------------------------------------------------------------- end states
function finish() {
  if (state !== 'play' || finishing) return; finishing = true;
  const secs = Math.round(elapsed || (performance.now() - t0) / 1000), bonus = Math.max(0, Math.round((600 - secs) * 1.5));
  addScore(bonus); render(); capEl.textContent = '';
  arp([67, 71, 74, 79, 83, 86, 91], 100, 0.12, 0.9); buzz([20, 60, 20]);
  ui.pop(bonus ? `TIME BONUS +${bonus}` : 'ALL HOME', '#ffd38a', 30, 30);
  const cards = []; for (let r = 13; r >= 1; r--) for (let s = 0; s < 4; s++) cards.push({ suit: s, rank: r, x: colX(4 + s), y: G.topY });
  for (let id = 0; id < 52; id++) els[id].style.visibility = 'hidden';
  cascade(cards, G.cw, G.ch, innerHeight - (T.bar.offsetHeight || 70), () => win(secs), (n) => { if (n % 4 === 0) chime(n / 4, 72, 0.05); }, botOn() ? 50 : 200);
}
function win(secs) {
  if (state !== 'play') return;
  state = 'won'; finishing = false; if (!recorded) { recorded = true; if (!D.isDaily) F.level(true); }
  fx.confetti(120, ['#ffd38a', '#fff', '#d03a4c', '#7fd0f0', '#7cc6a4']);
  if (D.isDaily) { const k = 'daily_' + todayKey(), prev = S.get(k, null); if (!prev || score > prev.s) S.set(k, { s: score }); }
  else { level++; S.set('level', level); }
  const best = S.get('best', 0); if (score > best) S.set('best', score);
  D.won(score); B.submit(1);   // world board: games won today
  ui.win(D.isDaily ? '' : level - 1, `${score.toLocaleString()} pts · ${nMoves} moves · ${fmtTime(secs)}${score > best ? ' · new best' : ''}`);
}
function lose() {
  if (state !== 'play') return;
  state = 'lost'; if (!recorded) { recorded = true; if (!D.isDaily) F.level(false, cleared()); }
  undoBtn.style.display = hist.length ? '' : 'none';
  ui.lose('No more moves', `${Math.round(cleared() * 52)} of 52 cards home`);
}
ui.onTap((which) => {
  B.start();
  if (which === 'start') { state = 'play'; if (!dealing) { render(); runAuto(); } return; }
  if (which === 'win' && D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
  if (which === 'lose') { start(dealCards(seedUsed)); recorded = true; state = 'play'; render(); runAuto(); return; }
  build(); state = 'play';
});
layout(); build();

// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on the first deal, until the first real
// touch, three moves from the solver's winning line play out; the clock stays at 0:00 until the player moves
demo(() => {
  if (!plan || plan.idx >= plan.path.length) { const r = solve(clonePos(P), 6000); plan = r.ok ? { path: r.path, idx: 0 } : null; }
  const m = plan && plan.path[plan.idx]; if (!m || !exec(m)) return false; t0 = 0; elapsed = 0;
}, { ready: () => state === 'play' && level === 1 && !D.isDaily && !finishing && !autoBusy && !dragS && !dealing && nMoves < 3, wait: 2000, every: 1300, max: 3 });

// ---------------------------------------------------------------- test hook: the bot follows the solver's line
let lastBot = 0; const botOn = () => performance.now() - lastBot < 1500;
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    lastBot = performance.now();
    if (state !== 'play' || finishing || autoBusy || dragS || dealing) return;
    if (!plan || plan.idx >= plan.path.length) { const r = solve(clonePos(P), 6000); plan = r.ok ? { path: r.path, idx: 0 } : null; }
    const m = plan && plan.path[plan.idx];
    if (m && legal(P, m)) return exec(m);
    plan = null; const ms = genMoves(P); if (ms.length) return exec(ms[0]);
    T.btn('new').onclick();
  },
};
