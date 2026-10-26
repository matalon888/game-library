// Silkline — classic spider solitaire (the public card game) on an indigo felt. 104 cards, 10 columns, 1, 2 or 4 suits.
// Build down in any suit, move only same-suit runs, complete King-to-Ace runs of one suit to clear them. Tap a card to
// send it to its best spot, drag runs, deal a new row from the stock, unlimited undo, hints and a daily deal.
import { createUI, store, buzz } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { css, cardTheme, startCard, fx2d, chime, arp, soft, todayKey, fmtTime } from './calm.js';
import { SUITS, tableCSS, cardEl, tableDOM, shakeEl, homeEl, cascade } from './cards.js';
import { makeDeal, runStart, canDrop, canDeal, fullRun, bestMoves, hashOf, search, posKey } from './rules.js';

const NAME = 'Silkline: Spider Solitaire';
const S = store('silkline');
const F = flow('silkline');
const ui = createUI({ title: 'Silkline', hint: 'Tap to deal', hand: '', score: false });
cardTheme({ accent: '#7b6fd6' });
const D = daily('silkline', ui, { name: NAME });
const B = board({ game: 'silkline', label: 'Games won', limits: { maxRun: 1, maxPerSec: 0.1 }, mode: 'sum' });   // world board: games won today
const fx = fx2d(11);
let nSuits = S.get('suits', 1);
const SUIT_SETS = { 1: [0, 0, 0, 0, 0, 0, 0, 0], 2: [0, 0, 0, 0, 1, 1, 1, 1], 4: [0, 0, 1, 1, 2, 2, 3, 3] };
const doneToday = S.get('daily_' + todayKey(), null);
startCard(ui, D, {
  kicker: D.isDaily ? 'Daily deal' : 'spider solitaire',
  doneLine: doneToday ? (D.isDaily ? `Solved today · ${doneToday.s.toLocaleString()} pts` : 'Daily deal solved ✓') : null,
  chips: { items: ['1 suit', '2 suits', '4 suits'], get: () => [1, 2, 4].indexOf(nSuits), set: (i) => { nSuits = [1, 2, 4][i]; S.set('suits', nSuits); build(); } },
});
if (D.isDaily) ui.els.win.querySelector('p').innerHTML = 'Daily deal<span data-l hidden></span>';
else ui.els.win.querySelector('p').innerHTML = 'DEAL <span data-l>1</span>';
ui.els.win.querySelector('h1').textContent = 'Spun it!';
ui.els.lose.querySelector('.hint').textContent = 'Tap to replay this deal';
const undoBtn = document.createElement('button'); undoBtn.className = 'hc-btn'; undoBtn.textContent = '↶ Undo last move'; undoBtn.style.marginTop = '14px';
undoBtn.addEventListener('pointerdown', e => e.stopPropagation());
undoBtn.addEventListener('click', e => { e.stopPropagation(); ui.els.lose.classList.add('hc-hidden'); state = 'play'; undo(); });
ui.els.lose.querySelector('[data-x]').after(undoBtn);

tableCSS({ felt: ['#4a4592', '#2c2a68', '#17163c'], back: ['#5a54b8', '#25225e'], trim: '#f0c987',
  motif: 'polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)' });
css(`.rk{font-size:calc(var(--cw) * .42)}.s1{font-size:calc(var(--cw) * .34)}
.fslot{position:absolute;width:var(--cw);height:var(--ch);border-radius:calc(var(--cw) * .12);border:1.5px dashed rgba(255,255,255,.2);z-index:1}
.stk{cursor:pointer}`);
const T = tableDOM({ stats: [['s', 'Score'], ['m', 'Moves'], ['t', 'Time']], buttons: [['new', '✦', 'New'], ['hint', '💡', 'Hint'], ['undo', '↶', 'Undo']] });
const { table, toast } = T;
T.btn('new').onclick = () => { if (state !== 'play') return; giveUp(); skip++; S.set('skip', skip); build(); state = 'play'; toast('New deal'); };
T.btn('hint').onclick = () => hint();
T.btn('undo').onclick = () => undo();

function paintDeco() {   // faint silk web in the lower corners
  const c = T.deco, dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth, H = c.clientHeight || innerHeight * 0.34;
  c.width = W * dpr; c.height = H * dpr; const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const web = (cx, cy, R, a0, a1) => {
    g.strokeStyle = 'rgba(220,215,255,.10)'; g.lineWidth = 1.2; const n = 9;
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.stroke(); }
    for (let r = R * 0.14; r < R; r *= 1.28) { g.beginPath(); for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n, rr = r * (1 - 0.06 * Math.sin(i * 1.7)); const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; i ? g.quadraticCurveTo(cx + Math.cos(a - (a1 - a0) / n / 2) * rr * 0.9, cy + Math.sin(a - (a1 - a0) / n / 2) * rr * 0.9, x, y) : g.moveTo(x, y); } g.stroke(); }
  };
  web(0, H, H * 0.95, -Math.PI / 2, 0); web(W, H, H * 0.8, Math.PI, Math.PI * 1.5);
}

// ---------------------------------------------------------------- state
let state = 'ready', level = S.get('level', 1), skip = S.get('skip', 0), score = 500, nMoves = 0, t0 = 0, elapsed = 0;
let cols = [], stock = [], done = [], hist = [], recorded = false, beatenShown = false, seedUsed = 0, finishing = false;
const SU = new Int8Array(104), RK = new Int8Array(104);
let els = []; const pos = [];
let G = { cw: 35, ch: 50, gap: 3, ox: 6, topY: 86, tabY: 160, maxB: 760 };
const fslot = document.createElement('div'); fslot.className = 'fslot'; table.appendChild(fslot);
const stockHit = document.createElement('div'); stockHit.className = 'slot stk'; stockHit.textContent = '↻'; table.appendChild(stockHit);
stockHit.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (state === 'play') deal(); });
const colSlots = []; for (let i = 0; i < 10; i++) { const d = document.createElement('div'); d.className = 'slot'; table.appendChild(d); colSlots.push(d); }

function makeEls() {
  els.forEach(e => e.remove()); els = [];
  for (let id = 0; id < 104; id++) {
    const e = cardEl(table, SU[id], RK[id]); els.push(e);
    e.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); grab(id, ev); });
  }
}

const colX = (i) => G.ox + i * (G.cw + G.gap);
function layout() {
  const W = innerWidth, H = innerHeight, aw = Math.min(W, 760);
  G.gap = Math.max(3, Math.round(aw * 0.009)); G.cw = Math.min(74, (aw - 8 - 9 * G.gap) / 10); G.ch = G.cw * 1.42;
  G.ox = (W - (10 * G.cw + 9 * G.gap)) / 2;
  T.stats.style.top = '56px';
  G.topY = 86; G.tabY = G.topY + G.ch + Math.max(12, G.ch * 0.25);
  G.maxB = H - (T.bar.offsetHeight || 70) - 6;
  table.style.setProperty('--cw', G.cw + 'px'); table.style.setProperty('--ch', G.ch + 'px');
  const put = (el, x, y) => { el.style.left = x + 'px'; el.style.top = y + 'px'; };
  put(fslot, colX(0), G.topY);
  put(stockHit, colX(9), G.topY);
  for (let i = 0; i < 10; i++) put(colSlots[i], colX(i), G.tabY);
  T.toastEl.style.top = G.tabY - 40 + 'px';
  paintDeco(); render();
}
addEventListener('resize', layout);

function colOffsets(col) {
  const n = col.c.length, dOff = G.ch * 0.12; let uOff = G.ch * 0.36;
  const up = n - col.d; if (up > 1) { const need = G.tabY + col.d * dOff + (up - 1) * uOff + G.ch; if (need > G.maxB) uOff = Math.max(G.ch * 0.18, (G.maxB - G.ch - G.tabY - col.d * dOff) / (up - 1)); }
  return { dOff, uOff };
}
function cardPos(i, k) { const col = cols[i], o = colOffsets(col); return { x: colX(i), y: G.tabY + Math.min(k, col.d) * o.dOff + Math.max(0, k - col.d) * o.uOff }; }
const stockX = (j) => colX(9) - j * G.cw * 0.22;   // j = which deal (0 = the next one, drawn on top)
function render(skipIds = null) {
  const set = (id, x, y, z, up) => {
    pos[id] = { x, y, z }; const e = els[id]; e.classList.toggle('down', !up);
    if (skipIds && skipIds.has(id)) return; e.style.transform = `translate(${x}px,${y}px)`; e.style.zIndex = z;
  };
  const deals = Math.ceil(stock.length / 10);
  stock.forEach((id, k) => { const j = deals - 1 - Math.floor(k / 10); set(id, stockX(j), G.topY, 20 + (deals - j), false); els[id].style.visibility = ''; });
  done.forEach((run, r) => run.forEach((id, k) => { set(id, colX(0) + r * G.cw * 0.3, G.topY, 100 + r * 14 + k, true); els[id].style.visibility = k === 0 ? '' : 'hidden'; }));
  cols.forEach((col, i) => col.c.forEach((id, k) => { const p = cardPos(i, k); set(id, p.x, p.y, 200 + k, k >= col.d); els[id].style.visibility = ''; }));
  stockHit.style.opacity = stock.length ? 0 : 0.6;
  T.stat('s', score.toLocaleString()); T.stat('m', nMoves);
  ui.progress(done.length / 8);
  T.btn('undo').disabled = !hist.length;
}
setInterval(() => { if (state === 'play' && t0) { elapsed = (performance.now() - t0) / 1000; T.stat('t', fmtTime(elapsed)); } }, 500);

// ---------------------------------------------------------------- deal
function build() {
  const base = (D.seed || (level * 7919 + skip * 104729)) + nSuits * 1000003;
  let pick = null;
  if (nSuits < 4) {
    // winnable deals: our solver plays each candidate deal through before you see it. Flow: steadier players get the
    // winnable deal the solver needed the most work for, struggling players the most direct one.
    const fk = D.isDaily ? 1 : F.k(), found = [];
    for (let k = 0; k < 14 && found.length < (fk > 1.06 || fk < 0.96 ? 2 : 1); k++) {
      const s = base + k * 31337, dl = makeDeal(s, nSuits), r = search(dl.cols, dl.stock, 0, dl.su, dl.rk, nSuits === 1 ? 3000 : 2500, null, true);
      if (r.win) found.push({ seed: s, dl, nodes: r.nodes, path: r.path });
    }
    found.sort((a, b) => a.nodes - b.nodes);
    pick = found.length ? found[fk > 1.06 ? found.length - 1 : 0] : null;
  }
  if (!pick) pick = { seed: base, dl: makeDeal(base, nSuits), path: null };
  seedUsed = pick.seed; start(pick.dl);
  plan = pick.path ? { path: pick.path, idx: 0, win: true } : null;
  ui.levels(D.isDaily ? 1 : level); if (D.isDaily) { ui.els.top.querySelector('[data-a]').textContent = '★'; ui.els.top.querySelector('[data-b]').textContent = '✓'; }
  // deal animation: everything flies out of the stock
  els.forEach(e => { e.classList.add('drag'); e.classList.add('down'); e.style.transform = `translate(${colX(9)}px,${G.topY}px)`; e.style.zIndex = 20; });
  void table.offsetWidth;
  render(new Set(cols.flatMap(c => c.c)));
  els.forEach(e => e.classList.remove('drag'));
  let n = 0;
  for (let k = 0; k < 6; k++) for (let i = 0; i < 10; i++) {
    const id = cols[i].c[k]; if (id === undefined) continue; const p = pos[id], delay = 60 + n++ * 16;
    setTimeout(() => { els[id].style.transform = `translate(${p.x}px,${p.y}px)`; els[id].style.zIndex = p.z; if (n % 3 === 0) soft.click(); }, delay);
  }
  cols.forEach(col => col.c.forEach((id, k) => { if (k >= col.d) els[id].classList.add('down'); }));
  setTimeout(() => cols.forEach(col => col.c.forEach((id, k) => { if (k >= col.d) els[id].classList.remove('down'); })), 60 + 54 * 16 + 120);
}
function start(dl) {
  SU.set(dl.su); RK.set(dl.rk); makeEls();
  cols = dl.cols.map(c => ({ d: c.d, c: c.c.slice() })); stock = dl.stock.slice(); done = [];
  score = 500; nMoves = 0; t0 = 0; elapsed = 0; hist = []; recorded = false; beatenShown = false; finishing = false; seen = new Set(); avoid = new Set(); plan = null;
  T.stat('t', '0:00');
}

// ---------------------------------------------------------------- moves
let seen = new Set(), avoid = new Set(), plan = null, dealing = false;
const onPlan = (mv) => { if (!plan) return; const p = plan.path[plan.idx]; if (p && p.length === mv.length && p.every((x, q) => x === mv[q])) plan.idx++; else plan = null; };
function snap() { hist.push(JSON.stringify({ cols, stock, done, score, nMoves })); if (hist.length > 500) hist.shift(); }
function undo() {
  if (state !== 'play' || !hist.length || finishing) return;
  plan = null; const s = JSON.parse(hist.pop()); cols = s.cols; stock = s.stock; done = s.done; score = s.score; nMoves = s.nMoves + 1;
  soft.swish(); render();
}
function addScore(n) { score = Math.max(0, score + n); if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); fx.confetti(60); } }
function startClock() { if (!t0) t0 = performance.now() - elapsed * 1000; }
function reveal(i) { const col = cols[i]; if (col.c.length && col.d >= col.c.length) { col.d = col.c.length - 1; setTimeout(() => soft.click(), 140); } }
function settle(j) {
  const f = fullRun(cols[j], SU, RK); if (f < 0) return false;
  const run = cols[j].c.splice(f); done.push(run.reverse()); addScore(100); reveal(j);
  const r = done.length - 1, x = colX(0) + r * G.cw * 0.3 + G.cw / 2, y = G.topY + G.ch / 2;
  setTimeout(() => { fx.sparks(x, y, ['#f0c987', '#fff', '#c9c2ff'], 18, { speed: 3, size: 3.4 }); homeEl(els[run[0]]); }, 260);
  arp([67, 71, 74, 79], 70, 0.11); buzz([10, 30, 10]); setTimeout(() => ui.pop(`${SUITS[SU[run[0]]]} run complete`, '#f0c987', 28, 34), 150);
  return true;
}
function exec(i, k, j) {
  if (!canDrop(cols, i, k, j, SU, RK)) return false;
  snap(); startClock(); onPlan([i, k, j]);
  const run = cols[i].c.splice(k); cols[j].c.push(...run);
  reveal(i); addScore(-1); nMoves++;
  const sameSuit = cols[j].c.length > run.length && SU[cols[j].c[cols[j].c.length - run.length - 1]] === SU[run[0]];
  soft.wood(); buzz(5); if (sameSuit) setTimeout(() => chime(14 - RK[run[0]], 67, 0.07), 60);
  settle(j);
  seen.add(hashOf(cols)); avoid.add(posKey(cols, stock.length));
  render(); after(); return true;
}
function deal() {
  if (state !== 'play' || finishing || dealing) return;
  if (!stock.length) return;
  if (!canDeal(cols, stock)) { toast('Fill every column before dealing'); shakeEl(stockHit); for (let i = 0; i < 10; i++) if (!cols[i].c.length) colSlots[i].animate([{ background: 'rgba(240,201,135,.35)' }, { background: 'rgba(0,0,0,.08)' }], 700); soft.err(); return; }
  snap(); startClock(); onPlan(['deal']);
  const got = stock.splice(stock.length - 10, 10);
  render();   // stock shrinks first, then cards fly out one by one
  got.forEach((id, i) => { cols[i].c.push(id); });
  const ps = got.map((id, i) => cardPos(i, cols[i].c.length - 1));
  const gap = botOn() ? 8 : 35;
  got.forEach((id, i) => { const e = els[id]; e.classList.remove('down'); setTimeout(() => { e.style.transform = `translate(${ps[i].x}px,${ps[i].y}px)`; e.style.zIndex = 200 + cols[i].c.length; if (i % 2) soft.click(); }, i * gap); });
  dealing = true; setTimeout(() => { dealing = false; for (let i = 0; i < 10; i++) settle(i); render(); after(); }, 10 * gap + (botOn() ? 40 : 120));
  addScore(-1); nMoves++; soft.swish();
  for (let i = 0; i < 10; i++) pos[got[i]] = { ...ps[i], z: 200 };
}
// tap → best spot: a same-suit card above, then any card one rank higher, then an empty column
function autoMove(i, k) {
  const c = cols[i].c[k], cand = [];
  for (let j = 0; j < 10; j++) {
    if (!canDrop(cols, i, k, j, SU, RK)) continue; const t = cols[j].c;
    if (!t.length) { if (k > 0) cand.push({ j, v: 1 }); continue; }
    cand.push({ j, v: SU[t[t.length - 1]] === SU[c] ? 10 + t.length * 0.01 : 5 + t.length * 0.01 });
  }
  if (!cand.length) return false;
  cand.sort((a, b) => b.v - a.v); return exec(i, k, cand[0].j);
}

// ---------------------------------------------------------------- drag
let dragS = null;
function locate(id) {
  for (let i = 0; i < 10; i++) { const k = cols[i].c.indexOf(id); if (k >= 0) return k >= cols[i].d ? { i, k } : null; }
  if (stock.includes(id)) return { stock: true };
  return null;
}
function grab(id, e) {
  if (state !== 'play' || finishing) return;
  const src = locate(id); if (!src) return;
  if (src.stock) return deal();
  const ids = cols[src.i].c.slice(src.k);
  dragS = { src, ids, sx: e.clientX, sy: e.clientY, moved: false, base: ids.map(i => ({ ...pos[i] })) };
}
addEventListener('pointermove', (e) => {
  if (!dragS) return; const dx = e.clientX - dragS.sx, dy = e.clientY - dragS.sy;
  if (!dragS.moved && Math.hypot(dx, dy) < 8) return;
  if (!dragS.moved && runStart(cols[dragS.src.i], SU, RK) > dragS.src.k) { dragS = null; return; }   // not a movable run
  dragS.moved = true;
  dragS.ids.forEach((id, k) => { const b = dragS.base[k], el = els[id]; el.classList.add('drag'); el.style.zIndex = 1000 + k; el.style.transform = `translate(${b.x + dx}px,${b.y + dy}px) scale(1.04)`; });
});
addEventListener('pointerup', (e) => {
  if (!dragS) return; const d = dragS; dragS = null; d.ids.forEach(id => els[id].classList.remove('drag'));
  if (!d.moved) { if (!autoMove(d.src.i, d.src.k)) { soft.err(); buzz(20); d.ids.forEach(id => shakeEl(els[id])); render(); } return; }
  const dx = e.clientX - d.sx, dy = e.clientY - d.sy, cx = d.base[0].x + dx + G.cw / 2, cy = d.base[0].y + dy + G.ch / 2;
  let best = -1, bd = 1e9;
  for (let j = 0; j < 10; j++) {
    const n = cols[j].c.length, p = n ? cardPos(j, n - 1) : { x: colX(j), y: G.tabY };
    const dd = Math.hypot(cx - (p.x + G.cw / 2), (cy - (p.y + G.ch / 2)) * 0.5);
    if (dd < bd && dd < G.cw * 1.6 && canDrop(cols, d.src.i, d.src.k, j, SU, RK)) { bd = dd; best = j; }
  }
  if (best < 0 || !exec(d.src.i, d.src.k, best)) { soft.err(); render(); }
});

// ---------------------------------------------------------------- after every move: win, stuck
const cleared = () => done.length / 8;
function anyLegal() { for (let i = 0; i < 10; i++) { const rs = runStart(cols[i], SU, RK); if (rs < 0) continue; for (let k = rs; k < cols[i].c.length; k++) for (let j = 0; j < 10; j++) if (canDrop(cols, i, k, j, SU, RK)) return true; } return false; }
function after() {
  if (done.length === 8) return finish();
  if (!stock.length && !anyLegal()) setTimeout(() => { if (state === 'play' && !stock.length && !anyLegal() && done.length < 8) lose(); }, 700);
}
function giveUp() { if (!recorded && nMoves > 0 && !D.isDaily) { recorded = true; F.level(false, cleared()); } }

// ---------------------------------------------------------------- hint
function hint() {
  if (state !== 'play' || finishing) return;
  table.querySelectorAll('.glow').forEach(e => e.classList.remove('glow'));
  // the solver looks ahead from here; fall back to the plain greedy pick
  const r = search(cols, stock, done.length, SU, RK, 1200, avoid, true), first = r.path[0];
  let ms = first && first[0] !== 'deal' && (r.win || r.gain > 0) ? [{ i: first[0], k: first[1], j: first[2] }] : [];
  if (!ms.length && !(first && first[0] === 'deal')) ms = bestMoves(cols, SU, RK).filter(m => !wouldRepeat(m));
  if (ms.length) {
    const m = ms[0], src = cols[m.i].c[m.k], t = cols[m.j].c;
    els[src].classList.add('glow'); if (t.length) els[t[t.length - 1]].classList.add('glow'); else colSlots[m.j].animate([{ background: 'rgba(240,201,135,.4)' }, { background: 'rgba(0,0,0,.08)' }], 1200);
    soft.click(); setTimeout(() => table.querySelectorAll('.glow').forEach(e => e.classList.remove('glow')), 1600); return;
  }
  if (stock.length) { if (canDeal(cols, stock)) { els[stock[stock.length - 1]].classList.add('glow'); toast('Deal a new row'); setTimeout(() => els[stock[stock.length - 1]] && els[stock[stock.length - 1]].classList.remove('glow'), 1600); } else toast('Fill the empty column, then deal'); }
  else toast('No helpful moves — try Undo');
}
function wouldRepeat(m) {
  const run = cols[m.i].c.slice(m.k), a = cols.map(c => ({ d: c.d, c: c.c }));
  a[m.i] = { d: cols[m.i].d, c: cols[m.i].c.slice(0, m.k) }; a[m.j] = { d: cols[m.j].d, c: cols[m.j].c.concat(run) };
  if (a[m.i].c.length && a[m.i].d >= a[m.i].c.length) a[m.i].d = a[m.i].c.length - 1;
  return seen.has(hashOf(a));
}

// ---------------------------------------------------------------- end states
function finish() {
  if (state !== 'play' || finishing) return; finishing = true;
  const secs = Math.round(elapsed || (performance.now() - t0) / 1000);
  render(); arp([67, 71, 74, 79, 83, 86, 91], 100, 0.12, 0.9); buzz([20, 60, 20]);
  ui.pop('ALL EIGHT RUNS!', '#f0c987', 30, 30);
  const cards = []; for (let q = 0; q < 13; q++) done.forEach((run, r) => cards.push({ suit: SU[run[q]], rank: RK[run[q]], x: colX(0) + r * G.cw * 0.3, y: G.topY }));
  done.forEach(run => run.forEach(id => els[id].style.visibility = 'hidden'));
  cascade(cards, G.cw, G.ch, innerHeight - (T.bar.offsetHeight || 70), () => win(secs), (n) => { if (n % 6 === 0) chime(n / 6, 72, 0.05); }, botOn() ? 50 : 200);
}
function win(secs) {
  if (state !== 'play') return;
  state = 'won'; finishing = false; if (!recorded) { recorded = true; if (!D.isDaily) F.level(true); }
  fx.confetti(120, ['#f0c987', '#fff', '#d03a4c', '#9d93ff', '#7cc6a4']);
  if (D.isDaily) { const k = 'daily_' + todayKey(), prev = S.get(k, null); if (!prev || score > prev.s) S.set(k, { s: score }); }
  else { level++; S.set('level', level); }
  const best = S.get('best_' + nSuits, 0); if (score > best) S.set('best_' + nSuits, score);
  D.won(score); B.submit(1);   // world board: games won today
  ui.win(D.isDaily ? '' : level - 1, `${nSuits} suit${nSuits > 1 ? 's' : ''} · ${score.toLocaleString()} pts · ${nMoves} moves · ${fmtTime(secs)}${score > best ? ' · new best' : ''}`);
}
function lose() {
  if (state !== 'play') return;
  state = 'lost'; if (!recorded) { recorded = true; if (!D.isDaily) F.level(false, cleared()); }
  undoBtn.style.display = hist.length ? '' : 'none';
  ui.lose('No more moves', `${done.length} of 8 runs complete`);
}
ui.onTap((which) => {
  B.start();
  if (which === 'start') { state = 'play'; return; }
  if (which === 'win' && D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
  if (which === 'lose') { start(makeDeal(seedUsed, nSuits)); render(); recorded = true; state = 'play'; return; }
  build(); state = 'play';
});
layout(); build();
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on the first deal, until the first
// touch, a good move glides a card onto the next rank down and then glides it back, so the deal is left exactly as it was
let demoMarks = [];
demo(n => {
  if (n === 2) { if (hist.length !== 1) return false; undo(); demoMarks.forEach(f => f()); nMoves = 0; t0 = 0; elapsed = 0; render(); T.stat('t', fmtTime(0)); return false; }
  const ms = bestMoves(cols, SU, RK).filter(x => !wouldRepeat(x)), m = ms.find(x => x.k !== cols[x.i].d) || ms[0]; if (!m || hist.length) return false;
  const s0 = score; if (!exec(m.i, m.k, m.j)) return false;
  const h = hashOf(cols), pk = posKey(cols, stock.length);   // forget the demo position, so hints still offer this move
  demoMarks = [() => seen.delete(h), () => avoid.delete(pk)];
  score = s0; nMoves = 0; t0 = 0; elapsed = 0; render(); T.stat('t', fmtTime(0));
}, { ready: () => state === 'play' && level === 1 && !finishing && !dealing && !dragS && done.length === 0, wait: 1800, every: 1500, max: 2, ms: 15000 });

// ---------------------------------------------------------------- test hook: the bot plays the greedy line a careful player would
let lastBot = 0; const botOn = () => performance.now() - lastBot < 1500;
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    lastBot = performance.now();
    if (state !== 'play' || finishing || dragS || dealing) return;
    if (!plan || plan.idx >= plan.path.length || (!plan.win && plan.idx >= 6)) {
      const r = search(cols, stock, done.length, SU, RK, 2000, avoid, true);
      plan = r.path.length ? { path: r.path, idx: 0, win: r.win } : null;
    }
    const m = plan && plan.path[plan.idx];
    if (m) { if (m[0] === 'deal') return deal(); if (canDrop(cols, m[0], m[1], m[2], SU, RK)) return exec(m[0], m[1], m[2]); plan = null; return; }
    if (canDeal(cols, stock)) return deal();
    T.btn('new').onclick();   // nothing useful left: a fresh deal
  },
};
