// Sandstep — classic pyramid solitaire (the public card game) at desert dusk. Clear a 28-card pyramid by pairing any
// two open cards that add up to 13 (Jack 11, Queen 12, Kings go alone). Draw from the stock when stuck; three passes.
// Every deal is checked clearable by our solver before you see it.
import { createUI, store, buzz } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { css, cardTheme, startCard, fx2d, chime, arp, soft, todayKey, fmtTime } from './calm.js';
import { tableCSS, cardEl, tableDOM, shakeEl, cascade } from './cards.js';
import { SU, RK, ROW, COL, PASSES, dealCards, fresh, exposed, wasteTop, stockNext, moves as genMoves, apply, legal, solve, cleared } from './rules.js';

const NAME = 'Sandstep: Pyramid Solitaire';
const S = store('sandstep');
const F = flow('sandstep');
const ui = createUI({ title: 'Sandstep', hint: 'Tap to deal', hand: '', score: false });
cardTheme({ accent: '#d9813f' });
const D = daily('sandstep', ui, { name: NAME });
const B = board({ game: 'sandstep', label: 'Pyramids cleared', limits: { maxRun: 1, maxPerSec: 0.1 }, mode: 'sum' });   // world board: pyramids cleared today
const fx = fx2d(11);
const doneToday = S.get('daily_' + todayKey(), null);
startCard(ui, D, {
  kicker: D.isDaily ? 'Daily deal' : 'pyramid solitaire',
  doneLine: doneToday ? (D.isDaily ? `Cleared today · ${doneToday.s.toLocaleString()} pts` : 'Daily deal cleared ✓') : null,
});
{ const p = document.createElement('p'); p.textContent = 'Pair cards that add up to 13 · Kings go alone'; p.style.cssText = 'font-size:15px;opacity:.8;margin-top:8px'; ui.els.start.querySelector('.calm-kicker').after(p); }
if (D.isDaily) ui.els.win.querySelector('p').innerHTML = 'Daily deal<span data-l hidden></span>';
else ui.els.win.querySelector('p').innerHTML = 'PYRAMID <span data-l>1</span>';
ui.els.win.querySelector('h1').textContent = 'Cleared!';
ui.els.lose.querySelector('.hint').textContent = 'Tap to replay this deal';
const undoBtn = document.createElement('button'); undoBtn.className = 'hc-btn'; undoBtn.textContent = '↶ Undo last move'; undoBtn.style.marginTop = '14px';
undoBtn.addEventListener('pointerdown', e => e.stopPropagation());
undoBtn.addEventListener('click', e => { e.stopPropagation(); ui.els.lose.classList.add('hc-hidden'); state = 'play'; undo(); });
ui.els.lose.querySelector('[data-x]').after(undoBtn);

tableCSS({ felt: ['#b8673c', '#7c3a22', '#2e140d'], back: ['#d98a45', '#7a3519'], trim: '#ffe0a3',
  motif: 'polygon(0 100%,0 80%,14% 80%,14% 60%,28% 60%,28% 40%,42% 40%,42% 20%,58% 20%,58% 40%,72% 40%,72% 60%,86% 60%,86% 80%,100% 80%,100% 100%)' });
css(`.cd.sel{transform-origin:50% 100%}
.cd.sel .fr{box-shadow:0 0 0 3px #ffe0a3,0 0 22px rgba(255,224,163,.95)}
.cd.off .s2,.cd.off .ct{visibility:hidden}
.cd.off .fr:after{content:'';position:absolute;inset:0;background:rgba(60,25,10,.22)}
.lbl{position:absolute;z-index:3;color:#fff;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;opacity:.6;text-align:center;pointer-events:none;white-space:nowrap}
.sum{position:absolute;z-index:3;pointer-events:none;color:#ffe0a3;font-family:ui-serif,Georgia,serif;font-weight:700;font-size:26px;text-shadow:0 2px 10px rgba(0,0,0,.4);transition:opacity .3s}`);
const T = tableDOM({ stats: [['s', 'Score'], ['m', 'Moves'], ['t', 'Time']], buttons: [['new', '✦', 'New'], ['hint', '💡', 'Hint'], ['undo', '↶', 'Undo']] });
const { table, toast } = T;
T.btn('new').onclick = () => { if (state !== 'play') return; giveUp(); skip++; S.set('skip', skip); build(); state = 'play'; toast('New deal'); };
T.btn('hint').onclick = () => hint();
T.btn('undo').onclick = () => undo();

function paintDeco() {   // dunes and a low sun
  const c = T.deco, dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth, H = c.clientHeight || innerHeight * 0.34;
  c.width = W * dpr; c.height = H * dpr; const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sun = g.createRadialGradient(W * 0.72, H * 0.42, 4, W * 0.72, H * 0.42, H * 0.5); sun.addColorStop(0, 'rgba(255,214,150,.22)'); sun.addColorStop(1, 'rgba(255,214,150,0)');
  g.fillStyle = sun; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,220,160,.10)'; g.beginPath(); g.arc(W * 0.72, H * 0.42, H * 0.09, 0, 7); g.fill();
  const dune = (y0, amp, ph, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W + 8; x += 8) g.lineTo(x, y0 - Math.sin(x / W * Math.PI * 1.3 + ph) * amp - Math.sin(x / W * 5 + ph) * amp * 0.25); g.lineTo(W, H); g.fill(); };
  dune(H * 0.62, H * 0.12, 0.4, 'rgba(40,14,6,.22)'); dune(H * 0.78, H * 0.1, 2.1, 'rgba(30,10,4,.30)');
  // a tiny far pyramid on the horizon
  g.fillStyle = 'rgba(40,14,6,.22)'; g.beginPath(); g.moveTo(W * 0.18, H * 0.58); g.lineTo(W * 0.25, H * 0.44); g.lineTo(W * 0.32, H * 0.58); g.fill();
}

// ---------------------------------------------------------------- state
let state = 'ready', level = S.get('level', 1), skip = S.get('skip', 0), score = 0, nMoves = 0, t0 = 0, elapsed = 0;
let st = fresh({ pyr: [...Array(28).keys()], talon: [...Array(24).keys()].map(i => i + 28) }), disc = [], hist = [], recorded = false, beatenShown = false, seedUsed = 0, plan = null, sel = -1, finishing = false;
const els = [], pos = [];
let G = { cw: 49, ch: 70, gap: 5, cx: 195, pyTop: 140, step: 38, rowY: 620 };
const stockSlot = document.createElement('div'); stockSlot.className = 'slot'; stockSlot.style.cursor = 'pointer'; table.appendChild(stockSlot);
const wasteSlot = document.createElement('div'); wasteSlot.className = 'slot'; table.appendChild(wasteSlot);
const discSlot = document.createElement('div'); discSlot.className = 'slot'; discSlot.textContent = '13'; discSlot.style.fontSize = 'calc(var(--cw) * .34)'; discSlot.style.fontFamily = 'ui-serif,Georgia,serif'; table.appendChild(discSlot);
const passLbl = document.createElement('div'); passLbl.className = 'lbl'; table.appendChild(passLbl);
const sumEl = document.createElement('div'); sumEl.className = 'sum'; sumEl.style.opacity = 0; table.appendChild(sumEl);
stockSlot.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (state === 'play') drawOrRedeal(); });
for (let id = 0; id < 52; id++) {
  const e = cardEl(table, SU(id), RK(id)); els.push(e);
  e.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); grab(id, ev); });
}

function layout() {
  const W = innerWidth, H = innerHeight, aw = Math.min(W, 560);
  G.gap = Math.max(4, Math.round(aw * 0.014)); G.cw = Math.min(78, (aw - 14 - 6 * G.gap) / 7); G.ch = G.cw * 1.42;
  G.step = G.ch * 0.62; G.cx = W / 2;
  T.stats.style.top = '56px';
  const maxB = H - (T.bar.offsetHeight || 70) - 10;
  G.rowY = maxB - G.ch - 22;
  const ph = G.ch + 6 * G.step, top = 92, room = G.rowY - 26 - top;
  G.pyTop = top + Math.max(0, (room - ph) * 0.55);
  table.style.setProperty('--cw', G.cw + 'px'); table.style.setProperty('--ch', G.ch + 'px');
  const put = (el, x, y) => { el.style.left = x + 'px'; el.style.top = y + 'px'; };
  put(stockSlot, slotX(1), G.rowY); put(wasteSlot, slotX(2.15), G.rowY); put(discSlot, slotX(5), G.rowY);
  passLbl.style.left = slotX(1) - 20 + 'px'; passLbl.style.width = G.cw + 40 + 'px'; passLbl.style.top = G.rowY + G.ch + 6 + 'px';
  T.toastEl.style.top = G.rowY - 48 + 'px';
  paintDeco(); render();
}
addEventListener('resize', layout);
const slotX = (k) => G.cx - 3.5 * G.cw - 3 * G.gap + k * (G.cw + G.gap);   // bottom-row grid of the pyramid
const pyrPos = (i) => ({ x: G.cx - (ROW[i] + 1) * (G.cw + G.gap) / 2 + G.gap / 2 + COL[i] * (G.cw + G.gap), y: G.pyTop + ROW[i] * G.step });

function render() {
  const set = (id, x, y, z, up = true) => { pos[id] = { x, y, z }; const e = els[id]; e.classList.toggle('down', !up); e.style.transform = `translate(${x}px,${y - (id === selId() ? 8 : 0)}px)`; e.style.zIndex = z; e.style.visibility = ''; };
  const wt = wasteTop(st);
  for (let i = 0; i < 28; i++) { const id = st.pyr[i]; if (st.gone & (1 << i)) continue; const p = pyrPos(i); set(id, p.x, p.y, 100 + ROW[i]); els[id].classList.toggle('off', !exposed(st, i)); }
  st.talon.forEach((id, q) => {
    els[id].classList.remove('off');
    if (st.tgone & (1 << q)) return;
    if (q < st.p) { set(id, slotX(2.15), G.rowY, 60 + q); els[id].style.visibility = q < wt - 2 ? 'hidden' : ''; }
    else { const d = Math.min(3, Math.floor((st.talon.length - q) / 4)); set(id, slotX(1) - d * 1.5, G.rowY - d * 1.5, 40 + (st.talon.length - q), false); }
  });
  disc.forEach((id, k) => { set(id, slotX(5) + Math.min(k, 6) * 0.6, G.rowY - Math.min(k, 6) * 0.6, 300 + k); els[id].classList.remove('off'); els[id].style.visibility = k < disc.length - 2 ? 'hidden' : ''; });
  els.forEach((e, id) => e.classList.toggle('sel', id === selId()));
  const sn = stockNext(st);
  stockSlot.textContent = sn < 0 ? (st.pass < PASSES ? '↻' : '✕') : '';
  passLbl.textContent = `pass ${st.pass} of ${PASSES}`;
  T.stat('s', score.toLocaleString()); T.stat('m', nMoves);
  ui.progress(popcount(st.gone) / 28);
  T.btn('undo').disabled = !hist.length;
}
const popcount = (x) => { let n = 0; while (x) { x &= x - 1; n++; } return n; };
setInterval(() => { if (state === 'play' && t0) { elapsed = (performance.now() - t0) / 1000; T.stat('t', fmtTime(elapsed)); } }, 500);

// selection: a pyramid slot (0..27) or 'w' for the waste top
const selId = () => sel === -1 ? -1 : sel === 'w' ? (wasteTop(st) >= 0 ? st.talon[wasteTop(st)] : -1) : st.pyr[sel];

// ---------------------------------------------------------------- deal
function build() {
  const base = (D.seed || (level * 7919 + skip * 104729));
  const fk = D.isDaily ? 1 : F.k(), found = [];
  // clearable deals only: our solver clears each one before you see it. Flow: steadier players get the deal that
  // needed the most search, struggling players the most direct one.
  for (let k = 0; k < 30 && found.length < (fk > 1.06 || fk < 0.96 ? 2 : 1); k++) {
    const s = base + k * 31337, d = dealCards(s), r = solve(fresh(d), 20000);
    if (r.ok) found.push({ seed: s, d, nodes: r.nodes, path: r.path });
  }
  found.sort((a, b) => a.nodes - b.nodes);
  const pick = found.length ? found[fk > 1.06 ? found.length - 1 : 0] : { seed: base, d: dealCards(base), path: null };
  seedUsed = pick.seed; start(pick.d); plan = pick.path ? { path: pick.path, idx: 0 } : null;
  ui.levels(D.isDaily ? 1 : level); if (D.isDaily) { ui.els.top.querySelector('[data-a]').textContent = '★'; ui.els.top.querySelector('[data-b]').textContent = '✓'; }
  render();
  els.forEach(e => { e.classList.add('drag'); e.style.transform = `translate(${slotX(1)}px,${G.rowY}px)`; e.classList.add('down'); });
  void table.offsetWidth; els.forEach(e => e.classList.remove('drag'));
  dealing = true; let n = 0;
  for (let i = 0; i < 28; i++) { const id = st.pyr[i], p = pos[id]; setTimeout(() => { els[id].style.transform = `translate(${p.x}px,${p.y}px)`; els[id].classList.remove('down'); if (n++ % 2) soft.click(); }, 60 + i * 30); }
  st.talon.forEach(id => { const p = pos[id]; setTimeout(() => { els[id].style.transform = `translate(${p.x}px,${p.y}px)`; }, 60); });
  setTimeout(() => { dealing = false; render(); }, 60 + 28 * 30 + 260);
}
let dealing = false;
function start(d) {
  st = fresh(d); disc = []; sel = -1;
  score = 0; nMoves = 0; t0 = 0; elapsed = 0; hist = []; recorded = false; beatenShown = false; plan = null; finishing = false;
  T.stat('t', '0:00');
}

// ---------------------------------------------------------------- moves
function snap() { hist.push({ st, disc: disc.slice(), score, nMoves }); if (hist.length > 400) hist.shift(); }
function undo() {
  if (state !== 'play' || !hist.length || finishing) return;
  plan = null; const s = hist.pop(); st = s.st; disc = s.disc; score = s.score; nMoves = s.nMoves + 1; sel = -1;
  soft.swish(); render();
}
function addScore(n) { score = Math.max(0, score + n); if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); fx.confetti(60); } }
function startClock() { if (!t0) t0 = performance.now() - elapsed * 1000; }
const same = (a, b) => a && b && a.length === b.length && a.every((x, q) => x === b[q]);
function exec(m) {
  if (!legal(st, m)) return false;
  snap(); startClock();
  if (plan) { if (same(plan.path[plan.idx], m)) plan.idx++; else plan = null; }
  const prevGone = st.gone, w = wasteTop(st), ids = [];
  if (m[0] === 'k') ids.push(st.pyr[m[1]]); else if (m[0] === 'kw') ids.push(st.talon[w]);
  else if (m[0] === 'pp') ids.push(st.pyr[m[1]], st.pyr[m[2]]); else if (m[0] === 'pw') ids.push(st.pyr[m[1]], st.talon[w]);
  st = apply(st, m); nMoves++; sel = -1;
  if (ids.length) {
    disc.push(...ids); addScore(ids.length === 1 ? 5 : 10);
    // a little "13" over the pair, sparks and a chime that climbs as the pyramid empties
    const p0 = pos[ids[0]], p1 = pos[ids[ids.length - 1]], mx = (p0.x + p1.x) / 2 + G.cw / 2, my = (p0.y + p1.y) / 2 + G.ch / 2;
    sumEl.textContent = ids.length === 1 ? 'K' : '13'; sumEl.style.left = mx - 18 + 'px'; sumEl.style.top = my - 20 + 'px'; sumEl.style.opacity = 1; setTimeout(() => sumEl.style.opacity = 0, 380);
    fx.sparks(mx, my, ['#ffe0a3', '#fff', '#ffb27a'], 12, { speed: 3, size: 3.2 });
    chime(popcount(st.gone) / 2 | 0, 67, 0.11); buzz(8);
    // rows that just emptied
    for (let r = 0; r < 7; r++) { let was = true, now = true; for (let i = r * (r + 1) / 2; i < r * (r + 1) / 2 + r + 1; i++) { if (!(prevGone & (1 << i))) was = false; if (!(st.gone & (1 << i))) now = false; } if (now && !was) { addScore(25); setTimeout(() => { ui.pop(r === 0 ? 'SUMMIT!' : `ROW ${7 - r} CLEAR +25`, '#ffe0a3', r === 0 ? 34 : 24, 30); arp([72, 76, 79], 70, 0.09); }, 120); } }
  } else soft.swish();
  render(); after(); return true;
}
function drawOrRedeal() {
  if (state !== 'play' || finishing || dealing) return;
  if (stockNext(st) >= 0) { exec(['d']); soft.click(); return; }
  if (st.pass < PASSES && wasteTop(st) >= 0) { exec(['r']); toast(`Pass ${st.pass} of ${PASSES}`); return; }
  shakeEl(stockSlot); soft.err(); toast('No redeals left');
}

// ---------------------------------------------------------------- tap / drag
function slotOf(id) { const i = st.pyr.indexOf(id); if (i >= 0 && !(st.gone & (1 << i))) return i; const w = wasteTop(st); if (w >= 0 && st.talon[w] === id) return 'w'; if (st.talon.includes(id) && stockNext(st) >= 0 && st.talon.indexOf(id) >= st.p) return 's'; return null; }
const rankOf = (s) => s === 'w' ? RK(st.talon[wasteTop(st)]) : RK(st.pyr[s]);
const open = (s) => s === 'w' || (s !== null && s !== 's' && exposed(st, s));
function pairMove(a, b) {
  if (a === 'w' && b === 'w') return null;
  if (a === 'w') return ['pw', b]; if (b === 'w') return ['pw', a];
  return ['pp', Math.min(a, b), Math.max(a, b)];
}
function tapSlot(s) {
  if (s === 's') return drawOrRedeal();
  if (!open(s)) { const id = st.pyr[s]; shakeEl(els[id]); soft.err(); return; }
  if (rankOf(s) === 13) return exec(s === 'w' ? ['kw'] : ['k', s]);
  if (sel === -1 || sel === s) { sel = sel === s ? -1 : s; soft.click(); render(); return; }
  if (rankOf(sel) + rankOf(s) === 13) { exec(pairMove(sel, s)); return; }
  const id = s === 'w' ? st.talon[wasteTop(st)] : st.pyr[s]; shakeEl(els[selId()]); sel = s; soft.click(); render(); void id;
}
let dragS = null;
function grab(id, e) {
  if (state !== 'play' || finishing || dealing) return;
  const s = slotOf(id); if (s === null) return;
  dragS = { id, s, sx: e.clientX, sy: e.clientY, moved: false, base: { ...pos[id] } };
}
addEventListener('pointermove', (e) => {
  if (!dragS || !open(dragS.s)) return; const dx = e.clientX - dragS.sx, dy = e.clientY - dragS.sy;
  if (!dragS.moved && Math.hypot(dx, dy) < 8) return;
  dragS.moved = true; const el = els[dragS.id]; el.classList.add('drag'); el.style.zIndex = 1000; el.style.transform = `translate(${dragS.base.x + dx}px,${dragS.base.y + dy}px) scale(1.06)`;
});
addEventListener('pointerup', (e) => {
  if (!dragS) return; const d = dragS; dragS = null; els[d.id].classList.remove('drag');
  if (!d.moved) return tapSlot(d.s);
  const cx = d.base.x + e.clientX - d.sx + G.cw / 2, cy = d.base.y + e.clientY - d.sy + G.ch / 2;
  let best = null, bd = 1e9;
  const cands = []; for (let i = 0; i < 28; i++) if (exposed(st, i)) cands.push(i); if (wasteTop(st) >= 0) cands.push('w');
  for (const c of cands) { if (c === d.s) continue; const id = c === 'w' ? st.talon[wasteTop(st)] : st.pyr[c], p = pos[id], dd = Math.hypot(cx - p.x - G.cw / 2, cy - p.y - G.ch / 2); if (dd < bd && dd < G.cw * 1.1 && rankOf(c) + rankOf(d.s) === 13) { bd = dd; best = c; } }
  if (best !== null && exec(pairMove(d.s, best))) return;
  if (rankOf(d.s) === 13) return exec(d.s === 'w' ? ['kw'] : ['k', d.s]);
  soft.err(); render();
});

// ---------------------------------------------------------------- after every move: win, stuck
function after() {
  if (cleared(st)) return finish();
  if (!genMoves(st).length) setTimeout(() => { if (state === 'play' && !genMoves(st).length && !cleared(st)) lose(); }, 600);
}
function giveUp() { if (!recorded && nMoves > 0 && !D.isDaily) { recorded = true; F.level(false, popcount(st.gone) / 28); } }

// ---------------------------------------------------------------- hint (the solver looks for a clearing line from here)
function hint() {
  if (state !== 'play' || finishing || dealing) return;
  table.querySelectorAll('.glow').forEach(e => e.classList.remove('glow'));
  const r = solve(st, 20000); let m = r.ok ? r.path[0] : null;
  if (!m) { const ms = genMoves(st); m = ms[0]; if (!m) { toast('No moves left — try Undo'); return; } if (!r.ok) toast('No clearing line from here — Undo may help'); }
  const glow = (id) => els[id].classList.add('glow'), w = wasteTop(st);
  if (m[0] === 'k') glow(st.pyr[m[1]]); else if (m[0] === 'kw') glow(st.talon[w]);
  else if (m[0] === 'pp') { glow(st.pyr[m[1]]); glow(st.pyr[m[2]]); } else if (m[0] === 'pw') { glow(st.pyr[m[1]]); glow(st.talon[w]); }
  else { stockSlot.animate([{ background: 'rgba(255,224,163,.4)' }, { background: 'rgba(0,0,0,.08)' }], 1200); if (stockNext(st) >= 0) glow(st.talon[stockNext(st)]); toast(m[0] === 'd' ? 'Draw a card' : 'Turn the waste over'); }
  soft.click(); setTimeout(() => table.querySelectorAll('.glow').forEach(e => e.classList.remove('glow')), 1600);
}

// ---------------------------------------------------------------- end states
function finish() {
  if (state !== 'play' || finishing) return; finishing = true;
  const secs = Math.round(elapsed || (performance.now() - t0) / 1000), left = 24 - popcount(st.tgone);
  const bonus = 100 + Math.max(0, Math.round((300 - secs) * 1.5)) + (PASSES - st.pass) * 50;
  addScore(bonus); render();
  arp([67, 71, 74, 79, 83, 86, 91], 100, 0.12, 0.9); buzz([20, 60, 20]);
  ui.pop(`CLEARED +${bonus}`, '#ffe0a3', 30, 30);
  const cards = disc.slice(-28).reverse().map(id => ({ suit: SU(id), rank: RK(id), x: slotX(5), y: G.rowY }));
  disc.forEach(id => els[id].style.visibility = 'hidden');
  cascade(cards, G.cw, G.ch, innerHeight - (T.bar.offsetHeight || 70), () => win(secs, left), (n) => { if (n % 3 === 0) chime(n / 3, 72, 0.05); }, botOn() ? 50 : 170);
}
function win(secs, left) {
  if (state !== 'play') return;
  state = 'won'; finishing = false; if (!recorded) { recorded = true; if (!D.isDaily) F.level(true); }
  fx.confetti(120, ['#ffe0a3', '#fff', '#d03a4c', '#ffb27a', '#7cc6a4']);
  if (D.isDaily) { const k = 'daily_' + todayKey(), prev = S.get(k, null); if (!prev || score > prev.s) S.set(k, { s: score }); }
  else { level++; S.set('level', level); }
  const best = S.get('best', 0); if (score > best) S.set('best', score);
  D.won(score); B.submit(1);   // world board: pyramids cleared today
  ui.win(D.isDaily ? '' : level - 1, `${score.toLocaleString()} pts · pass ${st.pass} · ${fmtTime(secs)}${score > best ? ' · new best' : ''}`);
  void left;
}
function lose() {
  if (state !== 'play') return;
  state = 'lost'; if (!recorded) { recorded = true; if (!D.isDaily) F.level(false, popcount(st.gone) / 28); }
  undoBtn.style.display = hist.length ? '' : 'none';
  ui.lose('Out of moves', `${popcount(st.gone)} of 28 pyramid cards cleared`);
}
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on deal 1, until the first real touch,
// the solver's first two moves play themselves (a pair making 13 lifts off the pyramid, or a card is drawn), so the move is shown
demo(() => { const r = solve(st, 20000), m = r.ok ? r.path[0] : genMoves(st)[0]; if (!m || !legal(st, m)) return false; plan = null; exec(m); },
  { ready: () => state === 'play' && level === 1 && !D.isDaily && !finishing && !dealing && !dragS && nMoves < 2, wait: 2000, every: 1500, max: 2 });
ui.onTap((which) => {
  B.start();
  if (which === 'start') { state = 'play'; return; }
  if (which === 'win' && D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
  if (which === 'lose') { start(dealCards(seedUsed)); recorded = true; state = 'play'; render(); return; }
  build(); state = 'play';
});
layout(); build();

// ---------------------------------------------------------------- test hook: the bot follows the solver's line
let lastBot = 0; const botOn = () => performance.now() - lastBot < 1500;
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    lastBot = performance.now();
    if (state !== 'play' || finishing || dealing || dragS) return;
    if (!plan || plan.idx >= plan.path.length) { const r = solve(st, 20000); plan = r.ok ? { path: r.path, idx: 0 } : null; }
    const m = plan && plan.path[plan.idx];
    if (m && legal(st, m)) return exec(m);
    plan = null; const ms = genMoves(st); if (ms.length) return exec(ms[0]);
  },
};
