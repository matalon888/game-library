// Patience Pine — original Klondike patience (the classic public card game) on a pine-green felt.
// Tap a card to send it to its best spot, or drag runs between columns. Draw 1 or 3, unlimited undo, hints,
// winnable deals (every deal checked by our solver before you see it) and a daily deal.
import { createUI, store, buzz } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { css, cardTheme, startCard, fx2d, chime, arp, soft, todayKey, fmtTime } from './calm.js';
import { SU, RK, RED, canStack, dealCards, solve, moves as genMoves, reach } from './solver.js';

const NAME = 'Patience Pine: Klondike Solitaire';
const S = store('patiencepine');
const F = flow('patiencepine');
const ui = createUI({ title: 'Patience Pine', hint: 'Tap to deal', hand: '', score: false });
cardTheme({ accent: '#3f9a6b' });
const D = daily('patiencepine', ui, { name: NAME });
const B = board({ game: 'patience-pine', label: 'Games won', limits: { maxRun: 1, maxPerSec: 0.05 }, mode: 'sum' });
const fx = fx2d(11);
let drawN = S.get('draw', 1), winnable = S.get('winnable', 1);
const doneToday = S.get('daily_' + todayKey(), null);
const sc = startCard(ui, D, {
  kicker: D.isDaily ? 'Daily deal' : 'Klondike solitaire',
  doneLine: doneToday ? (D.isDaily ? `Solved today · ${doneToday.s.toLocaleString()} pts` : 'Daily deal solved ✓') : null,
  chips: { items: ['Draw 1', 'Draw 3'], get: () => drawN === 3 ? 1 : 0, set: (i) => { drawN = i ? 3 : 1; S.set('draw', drawN); build(); } },
});
{ // second chip row: winnable deals toggle
  const row = document.createElement('div'); row.className = 'calm-row'; row.style.marginTop = '8px';
  row.addEventListener('pointerdown', e => e.stopPropagation());
  const b = document.createElement('button'); const lab = () => { b.className = 'calm-chip' + (winnable ? ' on' : ''); b.textContent = winnable ? '✓ Winnable deals' : 'Random deals'; };
  lab(); b.onclick = (e) => { e.stopPropagation(); winnable = winnable ? 0 : 1; S.set('winnable', winnable); lab(); build(); };
  row.appendChild(b); if (!D.isDaily) sc.row.after(row);
}
if (D.isDaily) ui.els.win.querySelector('p').innerHTML = 'Daily deal<span data-l hidden></span>';
else ui.els.win.querySelector('p').innerHTML = 'DEAL <span data-l>1</span>';
ui.els.win.querySelector('h1').textContent = 'Solved!';
ui.els.lose.querySelector('.hint').textContent = 'Tap to replay this deal';
const undoBtn = document.createElement('button'); undoBtn.className = 'hc-btn'; undoBtn.textContent = '↶ Undo last move'; undoBtn.style.marginTop = '14px';
undoBtn.addEventListener('pointerdown', e => e.stopPropagation());
undoBtn.addEventListener('click', e => { e.stopPropagation(); ui.els.lose.classList.add('hc-hidden'); state = 'play'; undo(); });
ui.els.lose.querySelector('[data-x]').after(undoBtn);

const SUITS = ['♠', '♥', '♦', '♣'], RN = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// ---------------------------------------------------------------- styles
css(`
body{background:#16492f}
#felt{position:fixed;inset:0;z-index:0;background:radial-gradient(ellipse 120% 80% at 50% 28%,#2f8158 0%,#20623f 48%,#143f29 100%)}
#felt:after{content:'';position:absolute;inset:0;opacity:.18;background:repeating-radial-gradient(circle at 30% 20%,rgba(255,255,255,.05) 0 1px,transparent 1px 3px)}
#pines{position:fixed;left:0;right:0;bottom:0;height:34vh;z-index:0;pointer-events:none}
.hc-top{z-index:40}.hc-top .hc-lvl{width:28px;height:28px;font-size:14px;font-weight:700;color:#173b28;background:#f3d27a}
.hc-top .hc-lvl.next{background:rgba(255,255,255,.18);color:#fff}
.hc-top .hc-bar{background:rgba(255,255,255,.16);height:8px}.hc-top .hc-bar i{background:#f3d27a}
#table{position:fixed;inset:0;z-index:2}
#stats{position:fixed;left:0;right:0;z-index:5;display:flex;justify-content:center;gap:18px;color:#fff;pointer-events:none;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700}
#stats span{opacity:.62}#stats b{font-size:15px;letter-spacing:.3px;opacity:1;margin-left:5px;font-variant-numeric:tabular-nums}
.slot{position:absolute;width:var(--cw);height:var(--ch);border-radius:calc(var(--cw) * .12);border:1.5px solid rgba(255,255,255,.22);background:rgba(0,0,0,.08);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.28);font-size:calc(var(--cw) * .5);z-index:1}
.slot.stock{cursor:pointer;font-size:calc(var(--cw) * .55)}
.cd{position:absolute;left:0;top:0;width:var(--cw);height:var(--ch);transition:transform .26s cubic-bezier(.25,.9,.3,1.04);perspective:600px;cursor:pointer;touch-action:none}
.cd.drag{transition:none}
.cd .in{position:absolute;inset:0;transition:transform .3s ease;transform-style:preserve-3d}
.cd.down .in{transform:rotateY(180deg)}
.cd .f{position:absolute;inset:0;border-radius:calc(var(--cw) * .12);backface-visibility:hidden;-webkit-backface-visibility:hidden;overflow:hidden}
.cd .fr{background:linear-gradient(160deg,#fffefb,#f3eee4);box-shadow:0 1px 0 rgba(255,255,255,.7) inset,0 2px 6px rgba(0,0,0,.3);border:1px solid rgba(0,0,0,.1)}
.cd.drag .fr{box-shadow:0 10px 22px rgba(0,0,0,.35)}
.cd .bk{transform:rotateY(180deg);background:linear-gradient(150deg,#2d7b52,#174a31);box-shadow:0 2px 4px rgba(0,0,0,.28);border:1.5px solid rgba(255,255,255,.85)}
.cd .bk:after{content:'';position:absolute;inset:3px;border-radius:calc(var(--cw) * .08);border:1px solid rgba(243,210,122,.5);background:repeating-linear-gradient(135deg,rgba(255,255,255,.05) 0 3px,transparent 3px 7px)}
.cd .bk:before{content:'';position:absolute;left:50%;top:50%;width:44%;height:46%;transform:translate(-50%,-50%);background:#f3d27a;opacity:.9;clip-path:polygon(50% 0,72% 30%,62% 30%,82% 58%,68% 58%,92% 86%,56% 86%,56% 100%,44% 100%,44% 86%,8% 86%,32% 58%,18% 58%,38% 30%,28% 30%)}
.rk{position:absolute;left:6%;top:2%;font-weight:760;font-size:calc(var(--cw) * .36);line-height:1.05;letter-spacing:-1px;font-family:-apple-system,'SF Pro Display',system-ui,sans-serif}
.s1{position:absolute;right:7%;top:3%;font-size:calc(var(--cw) * .3);line-height:1.1;font-style:normal}
.s2{position:absolute;left:0;right:0;bottom:7%;text-align:center;font-size:calc(var(--cw) * .62);line-height:1;font-style:normal}
.ct{position:absolute;left:50%;bottom:9%;transform:translateX(-50%);width:68%;aspect-ratio:1;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:ui-serif,'New York',Georgia,serif;font-weight:700;font-size:calc(var(--cw) * .42)}
.red .ct{background:rgba(208,58,76,.12)}.blk .ct{background:rgba(31,36,51,.1)}
.ct small{font-size:.55em;margin-left:1px}
.red{color:#d03a4c}.blk{color:#1f2433}
.cd.shake{animation:shk .32s}
@keyframes shk{20%{margin-left:-5px}40%{margin-left:5px}60%{margin-left:-3px}80%{margin-left:2px}}
.cd.glow .fr{box-shadow:0 0 0 3px #f3d27a,0 0 16px rgba(243,210,122,.9)}
.cd.home .fr{animation:hm .45s}
@keyframes hm{30%{filter:brightness(1.15);box-shadow:0 0 0 3px #fff,0 0 22px rgba(255,255,255,.9)}}
#bar{position:fixed;left:0;right:0;bottom:0;z-index:30;display:flex;justify-content:center;gap:10px;padding:8px 12px calc(10px + env(safe-area-inset-bottom));background:linear-gradient(0deg,rgba(8,30,18,.55),rgba(8,30,18,0))}
#bar button{font:inherit;color:#fff;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);border-radius:16px;min-width:76px;padding:6px 10px 5px;display:flex;flex-direction:column;align-items:center;gap:1px;cursor:pointer;font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:700}
#bar button i{font-style:normal;font-size:21px;line-height:1.1;letter-spacing:0}
#bar button:active{transform:translateY(1px);background:rgba(255,255,255,.2)}
#bar button[disabled]{opacity:.35}
#toast{position:fixed;left:50%;transform:translateX(-50%);z-index:35;background:rgba(10,30,20,.82);color:#fff;font-weight:700;padding:8px 16px;border-radius:20px;font-size:15px;pointer-events:none;opacity:0;transition:opacity .25s}
#cascade{position:fixed;inset:0;width:100%;height:100%;z-index:9;pointer-events:none;transition:opacity .6s}
`);
const felt = document.createElement('div'); felt.id = 'felt'; document.body.prepend(felt);
const pines = document.createElement('canvas'); pines.id = 'pines'; felt.after(pines);
const table = document.createElement('div'); table.id = 'table'; document.body.appendChild(table);
const stats = document.createElement('div'); stats.id = 'stats'; stats.innerHTML = '<div><span>Score</span><b data-s>0</b></div><div><span>Moves</span><b data-m>0</b></div><div><span>Time</span><b data-t>0:00</b></div>'; document.body.appendChild(stats);
const bar = document.createElement('div'); bar.id = 'bar';
bar.innerHTML = '<button data-new><i>✦</i>New</button><button data-hint><i>💡</i>Hint</button><button data-undo><i>↶</i>Undo</button>';
document.body.appendChild(bar);
const toastEl = document.createElement('div'); toastEl.id = 'toast'; document.body.appendChild(toastEl);
let toastT = 0; const toast = (t) => { toastEl.textContent = t; toastEl.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => toastEl.style.opacity = 0, 1400); };
bar.addEventListener('pointerdown', e => e.stopPropagation());
bar.querySelector('[data-new]').onclick = () => { if (state !== 'play') return; giveUp(); skip++; S.set('skip', skip); build(); state = 'play'; toast('New deal'); };
bar.querySelector('[data-hint]').onclick = () => hint();
bar.querySelector('[data-undo]').onclick = () => undo();

function paintPines() {
  const dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth, H = pines.clientHeight || innerHeight * 0.34;
  pines.width = W * dpr; pines.height = H * dpr; const g = pines.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let layer = 0; layer < 2; layer++) {
    g.fillStyle = layer ? 'rgba(10,40,26,.55)' : 'rgba(14,52,34,.35)';
    for (let x = -20; x < W + 20; x += 18 + r() * 26) {
      const h = H * (0.35 + r() * 0.45) * (layer ? 0.75 : 1), w = h * 0.36, by = H;
      g.beginPath(); g.moveTo(x, by - h);
      for (let k = 1; k <= 4; k++) { const yy = by - h + h * k / 4.4; g.lineTo(x + w * k / 4, yy); g.lineTo(x + w * k / 9, yy); }
      g.lineTo(x + w * 0.08, by); g.lineTo(x - w * 0.08, by);
      for (let k = 4; k >= 1; k--) { const yy = by - h + h * k / 4.4; g.lineTo(x - w * k / 9, yy); g.lineTo(x - w * k / 4, yy); }
      g.closePath(); g.fill();
    }
  }
}

// ---------------------------------------------------------------- state
let state = 'ready', level = S.get('level', 1), skip = S.get('skip', 0), score = 0, nMoves = 0, t0 = 0, elapsed = 0;
let tab = [], stock = [], waste = [], found = [[], [], [], []], hist = [], recorded = false, beatenShown = false, plan = null, auto = false, seedUsed = 0;
const els = []; const pos = [];
let G = { cw: 50, ch: 70, gap: 5, ox: 6, topY: 86, tabY: 170, maxB: 760 };
const slots = { stock: null, found: [], tab: [] };

function mkSlot(cls, txt) { const d = document.createElement('div'); d.className = 'slot ' + cls; d.textContent = txt; table.appendChild(d); return d; }
slots.stock = mkSlot('stock', '↻'); slots.stock.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (state === 'play') draw(true); });
for (let s = 0; s < 4; s++) slots.found.push(mkSlot('fnd', SUITS[s]));
for (let i = 0; i < 7; i++) slots.tab.push(mkSlot('tb', ''));

function cardEl(id) {
  const d = document.createElement('div'), r = RK(id), s = SU(id);
  d.className = 'cd down';
  const face = r > 10 ? `<div class="ct">${RN[r]}<small>${SUITS[s]}</small></div>` : `<i class="s2">${SUITS[s]}</i>`;
  d.innerHTML = `<div class="in"><div class="f fr ${RED(id) ? 'red' : 'blk'}"><b class="rk">${RN[r]}</b><i class="s1">${SUITS[s]}</i>${face}</div><div class="f bk"></div></div>`;
  d.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); grab(id, e); });
  table.appendChild(d); return d;
}
for (let id = 0; id < 52; id++) els[id] = cardEl(id);

const colX = (i) => G.ox + i * (G.cw + G.gap);
function layout() {
  const W = innerWidth, H = innerHeight, aw = Math.min(W, 620);
  G.gap = Math.max(4, Math.round(aw * 0.012)); G.cw = Math.min(92, (aw - 12 - 6 * G.gap) / 7); G.ch = G.cw * 1.42;
  G.ox = (W - (7 * G.cw + 6 * G.gap)) / 2;
  const safeTop = 0;
  stats.style.top = safeTop + 56 + 'px';
  G.topY = safeTop + 86; G.tabY = G.topY + G.ch + Math.max(12, G.ch * 0.22);
  G.maxB = H - (bar.offsetHeight || 70) - 6;
  table.style.setProperty('--cw', G.cw + 'px'); table.style.setProperty('--ch', G.ch + 'px');
  const put = (el, x, y) => { el.style.left = x + 'px'; el.style.top = y + 'px'; };
  put(slots.stock, colX(0), G.topY);
  for (let s = 0; s < 4; s++) put(slots.found[s], colX(3 + s), G.topY);
  for (let i = 0; i < 7; i++) put(slots.tab[i], colX(i), G.tabY);
  toastEl.style.top = G.tabY - 46 + 'px';
  paintPines();
  render();
}
addEventListener('resize', layout);

// card positions from state
function colOffsets(col) {
  const n = col.c.length, dOff = G.ch * 0.13; let uOff = G.ch * 0.3;
  const up = n - col.d; if (up > 1) { const need = G.tabY + col.d * dOff + (up - 1) * uOff + G.ch; if (need > G.maxB) uOff = Math.max(G.ch * 0.16, (G.maxB - G.ch - G.tabY - col.d * dOff) / (up - 1)); }
  return { dOff, uOff };
}
function cardPos(i, k) { const col = tab[i], o = colOffsets(col); return { x: colX(i), y: G.tabY + Math.min(k, col.d) * o.dOff + Math.max(0, k - col.d) * o.uOff }; }
function render(skipIds = null) {
  const set = (id, x, y, z, up) => {
    pos[id] = { x, y, z }; const e = els[id]; e.classList.toggle('down', !up);
    if (skipIds && skipIds.has(id)) return; e.style.transform = `translate(${x}px,${y}px)`; e.style.zIndex = z;
  };
  stock.forEach((id, k) => { const d = Math.min(stock.length - 1 - k, 5) * 0; set(id, colX(0) - d, G.topY, 20 + (stock.length - k), false); });
  const fan = Math.min(3, drawN === 3 ? waste.length : 1), fanStart = waste.length - fan;
  waste.forEach((id, k) => { const fi = Math.max(0, k - fanStart); set(id, colX(1) + (k >= fanStart ? fi * G.cw * 0.42 : 0), G.topY, 60 + k, true); els[id].style.visibility = k < waste.length - 4 ? 'hidden' : ''; });
  found.forEach((a, s) => a.forEach((id, k) => { set(id, colX(3 + s), G.topY, 120 + k, true); els[id].style.visibility = k < a.length - 2 ? 'hidden' : ''; }));
  tab.forEach((col, i) => col.c.forEach((id, k) => { const p = cardPos(i, k); set(id, p.x, p.y, 200 + k, k >= col.d); els[id].style.visibility = ''; }));
  stock.forEach(id => els[id].style.visibility = '');
  slots.stock.style.opacity = stock.length ? 0 : 1;
  stats.querySelector('[data-s]').textContent = score.toLocaleString(); stats.querySelector('[data-m]').textContent = nMoves;
  ui.progress(found.reduce((a, b) => a + b.length, 0) / 52);
  bar.querySelector('[data-undo]').disabled = !hist.length;
}
setInterval(() => { if (state === 'play' && t0) { elapsed = (performance.now() - t0) / 1000; stats.querySelector('[data-t]').textContent = fmtTime(elapsed); } }, 500);

// ---------------------------------------------------------------- deal
function pickDeal() {
  const base = (D.seed || (level * 7919 + skip * 104729)) + drawN * 1000003;
  if (!winnable && !D.isDaily) return { seed: base, d: dealCards(base) };
  const fk = D.isDaily ? 1 : F.k(), cands = [];
  for (let k = 0; k < 80 && cands.length < 3; k++) {
    const d = dealCards(base + k * 31337), r = solve(d.tab, d.stock, [0, 0, 0, 0], drawN, 8000);
    if (r.ok) cands.push({ seed: base + k * 31337, d, nodes: r.nodes, len: r.path.length });
  }
  if (!cands.length) return { seed: base, d: dealCards(base) };
  // flow: steadier players get the deal that took the solver longest, struggling players the most direct one
  cands.sort((a, b) => a.nodes - b.nodes);
  const idx = fk > 1.06 ? cands.length - 1 : fk < 0.96 ? 0 : Math.min(1, cands.length - 1);
  return cands[idx];
}
function build() {
  const pk = pickDeal(); seedUsed = pk.seed;
  tab = pk.d.tab.map(c => ({ d: c.d, c: c.c.slice() })); stock = pk.d.stock.slice(); waste = []; found = [[], [], [], []];
  score = 0; nMoves = 0; t0 = 0; elapsed = 0; hist = []; recorded = false; beatenShown = false; plan = null; auto = false;
  stats.querySelector('[data-t]').textContent = '0:00';
  ui.levels(D.isDaily ? 1 : level); if (D.isDaily) { ui.els.top.querySelector('[data-a]').textContent = '★'; ui.els.top.querySelector('[data-b]').textContent = '✓'; }
  const cv = document.getElementById('cascade'); if (cv) cv.remove();
  // deal animation: everything flies out of the stock
  els.forEach(e => { e.classList.add('drag'); e.classList.add('down'); e.style.transform = `translate(${colX(0)}px,${G.topY}px)`; e.style.zIndex = 20; e.style.visibility = ''; });
  void table.offsetWidth;
  render(new Set(tab.flatMap(c => c.c)));
  els.forEach(e => e.classList.remove('drag'));
  let n = 0;
  for (let k = 0; k < 7; k++) for (let i = k; i < 7; i++) {
    const id = tab[i].c[k], p = pos[id], delay = 60 + n++ * 34;
    setTimeout(() => { els[id].style.transform = `translate(${p.x}px,${p.y}px)`; els[id].style.zIndex = p.z; if (n % 2) soft.click(); }, delay);
  }
  tab.forEach(col => col.c.forEach((id, k) => { if (k >= col.d) els[id].classList.add('down'); }));
  setTimeout(() => tab.forEach(col => col.c.forEach((id, k) => { if (k >= col.d) els[id].classList.remove('down'); })), 60 + 28 * 34 + 120);
}

// ---------------------------------------------------------------- moves
const fCounts = () => found.map(a => a.length);
const canF = (id) => found[SU(id)].length === RK(id) - 1;
const top = (i) => tab[i].c.length ? tab[i].c[tab[i].c.length - 1] : -1;
function snap() { hist.push(JSON.stringify({ tab, stock, waste, found, score, nMoves })); if (hist.length > 400) hist.shift(); }
function undo() {
  if (state !== 'play' || !hist.length || auto) return;
  const s = JSON.parse(hist.pop()); tab = s.tab; stock = s.stock; waste = s.waste; found = s.found; score = s.score; nMoves = s.nMoves + 1; plan = null;
  soft.swish(); render();
}
function addScore(n) { score = Math.max(0, score + n); if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); fx.confetti(60); } }
function startClock() { if (!t0) t0 = performance.now() - elapsed * 1000; }
function revealTop(i) {
  const col = tab[i]; if (col.c.length && col.d >= col.c.length) { col.d = col.c.length - 1; addScore(5); setTimeout(() => soft.click(), 140); return true; } return false;
}
function centerOf(id) { const p = pos[id]; return { x: p.x + G.cw / 2, y: p.y + G.ch / 2 }; }

/** src: {t:'tab',i,k} | {t:'waste'} | {t:'found',s}; dst: {t:'found'} | {t:'tab',i} */
function legal(src, dst) {
  const ids = srcIds(src); if (!ids.length) return false; const c = ids[0];
  if (dst.t === 'found') return ids.length === 1 && canF(c) && !(src.t === 'found');
  if (dst.t === 'tab') { if (src.t === 'tab' && src.i === dst.i) return false; const t = top(dst.i); return t < 0 ? RK(c) === 13 : canStack(c, t); }
  return false;
}
function srcIds(src) {
  if (src.t === 'tab') return tab[src.i].c.slice(src.k);
  if (src.t === 'waste') return waste.length ? [waste[waste.length - 1]] : [];
  if (src.t === 'found') return found[src.s].length ? [found[src.s][found[src.s].length - 1]] : [];
  return [];
}
function exec(src, dst, { user = true } = {}) {
  if (!legal(src, dst)) return false;
  snap(); startClock(); plan = user ? plan : plan;
  const ids = srcIds(src);
  if (src.t === 'tab') tab[src.i].c.splice(src.k); else if (src.t === 'waste') waste.pop(); else found[src.s].pop();
  if (dst.t === 'found') {
    found[SU(ids[0])].push(ids[0]); addScore(10);
    const c = centerOf(ids[0]); const fp = { x: colX(3 + SU(ids[0])) + G.cw / 2, y: G.topY + G.ch / 2 };
    chime(RK(ids[0]) - 1, 67, 0.12); buzz(8);
    setTimeout(() => { fx.sparks(fp.x, fp.y, ['#f3d27a', '#fff', '#bdf0cf'], 10, { speed: 2.6, size: 3 }); els[ids[0]].classList.remove('home'); void els[ids[0]].offsetWidth; els[ids[0]].classList.add('home'); }, 230);
    if (RK(ids[0]) === 13) setTimeout(() => { ui.pop(`${SUITS[SU(ids[0])]} complete`, '#f3d27a', 30, 34); arp([72, 76, 79, 84], 80, 0.1); }, 250);
    void c;
  } else {
    tab[dst.i].c.push(...ids); soft.wood(); buzz(5);
    if (src.t === 'waste') addScore(5); if (src.t === 'found') addScore(-15);
  }
  if (src.t === 'tab') revealTop(src.i);
  nMoves++; render(); after();
  return true;
}
function draw(user = false) {
  if (state !== 'play' || auto) return;
  if (!stock.length && !waste.length) return;
  snap(); startClock();
  if (!stock.length) { stock = waste.reverse(); waste = []; soft.swish(); nMoves++; render(); after(); return; }
  const n = Math.min(drawN, stock.length), got = stock.splice(0, n); waste.push(...got);
  soft.swish(); soft.click(); nMoves++; render(); after();
  void user;
}

// tap → the best spot for that card (foundation first, then a column; empty columns only for kings)
function autoMove(src) {
  const ids = srcIds(src); if (!ids.length) return false;
  if (ids.length === 1 && src.t !== 'found' && legal(src, { t: 'found' })) return exec(src, { t: 'found' });
  const order = [];
  for (let i = 0; i < 7; i++) if (top(i) >= 0) order.push(i);
  for (let i = 0; i < 7; i++) if (top(i) < 0 && !(src.t === 'tab' && src.k === 0)) order.push(i);
  // prefer a column that reveals the most / is the longest
  for (const i of order) if (legal(src, { t: 'tab', i })) return exec(src, { t: 'tab', i });
  return false;
}
function shake(ids) { soft.err(); buzz(20); for (const id of ids) { els[id].classList.remove('shake'); void els[id].offsetWidth; els[id].classList.add('shake'); } }

// ---------------------------------------------------------------- drag
let dragS = null;
function locate(id) {
  for (let i = 0; i < 7; i++) { const k = tab[i].c.indexOf(id); if (k >= 0) return k >= tab[i].d ? { t: 'tab', i, k } : null; }
  if (waste.length && waste[waste.length - 1] === id) return { t: 'waste' };
  for (let s = 0; s < 4; s++) if (found[s].length && found[s][found[s].length - 1] === id) return { t: 'found', s };
  if (stock.includes(id)) return { t: 'stock' };
  return null;
}
function grab(id, e) {
  if (state !== 'play' || auto) return;
  const src = locate(id); if (!src) return;
  if (src.t === 'stock') return draw(true);
  const ids = srcIds(src);
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
  if (!d.moved) { if (!autoMove(d.src)) { shake(d.ids); render(); } return; }
  const dx = e.clientX - d.sx, dy = e.clientY - d.sy, cx = d.base[0].x + dx + G.cw / 2, cy = d.base[0].y + dy + G.ch / 2;
  let best = null, bd = 1e9;
  const tryT = (dst, x, y) => { const dd = Math.hypot(cx - x, cy - y); if (dd < bd && dd < G.cw * 1.5 && legal(d.src, dst)) { bd = dd; best = dst; } };
  for (let s = 0; s < 4; s++) tryT({ t: 'found' }, colX(3 + s) + G.cw / 2, G.topY + G.ch / 2);
  for (let i = 0; i < 7; i++) { const n = tab[i].c.length, p = n ? cardPos(i, n - 1) : { x: colX(i), y: G.tabY }; tryT({ t: 'tab', i }, p.x + G.cw / 2, p.y + G.ch / 2 + (n ? G.ch * 0.25 : 0)); }
  if (!best || !exec(d.src, best)) { soft.err(); render(); }
});

// ---------------------------------------------------------------- after every move: win, auto-finish, stuck
function cleared() { return found.reduce((a, b) => a + b.length, 0) / 52; }
function after() {
  if (found.every(a => a.length === 13)) return finish();
  if (!auto && !stock.length && !waste.length && tab.every(c => c.d === 0)) { auto = true; toast('Auto finish ✨'); setTimeout(autoStep, 350); return; }
  if (stuck()) setTimeout(() => { if (state === 'play' && stuck()) lose(); }, 700);
}
function autoStep() {
  if (state !== 'play') return;
  let best = -1, br = 99;
  for (let i = 0; i < 7; i++) { const t = top(i); if (t >= 0 && canF(t) && RK(t) < br) { br = RK(t); best = i; } }
  if (best < 0) { auto = false; return; }
  exec({ t: 'tab', i: best, k: tab[best].c.length - 1 }, { t: 'found' }, { user: false });
  if (state === 'play' && !found.every(a => a.length === 13)) setTimeout(autoStep, 85);
}
function extraTalon() {
  const out = []; if (waste.length) out.push(waste[waste.length - 1]);
  for (let i = 0; i < stock.length; i++) if (drawN === 1 || (i + 1) % drawN === 0 || i === stock.length - 1) out.push(stock[i]);
  return out;
}
function stuck() {
  if (found.every(a => a.length === 13)) return false;
  return genMoves(tab, waste.concat(stock), fCounts(), drawN, extraTalon()).length === 0;
}
function giveUp() { if (!recorded && nMoves > 0 && !D.isDaily) { recorded = true; F.level(false, cleared()); } }

// ---------------------------------------------------------------- hint
function hint() {
  if (state !== 'play' || auto) return;
  table.querySelectorAll('.glow').forEach(e => e.classList.remove('glow'));
  const ms = genMoves(tab, waste.concat(stock), fCounts(), drawN, extraTalon());
  const wt = waste.length ? waste[waste.length - 1] : -1;
  const m = ms.find(m => m.k === 'tf') || ms.find(m => m.k === 'tt' && tab[m.from].d > 0) || ms.find(m => (m.k === 'wt' || m.k === 'wf') && m.card === wt) || ms.find(m => m.k === 'tt');
  if (!m) { if (stock.length || waste.length) { slots.stock.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], 500); if (stock.length) els[stock[0]].classList.add('glow'); toast('Draw a card'); } else toast('No moves — try Undo'); return; }
  const id = m.k === 'tf' ? top(m.col) : m.k === 'tt' ? tab[m.from].c[m.at] : m.card;
  els[id].classList.add('glow'); soft.click();
  setTimeout(() => els[id].classList.remove('glow'), 1600);
}

// ---------------------------------------------------------------- end states + cascade flourish
function faceCanvas(id, w, h) {
  const c = document.createElement('canvas'), dpr = Math.min(devicePixelRatio || 1, 2); c.width = w * dpr; c.height = h * dpr; const g = c.getContext('2d'); g.scale(dpr, dpr);
  const r = w * 0.12; g.fillStyle = '#fffdf8'; g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1;
  g.beginPath(); g.roundRect(0.5, 0.5, w - 1, h - 1, r); g.fill(); g.stroke();
  g.fillStyle = RED(id) ? '#d03a4c' : '#1f2433'; g.font = `700 ${w * 0.36}px -apple-system,system-ui,sans-serif`; g.textBaseline = 'top';
  g.fillText(RN[RK(id)], w * 0.07, h * 0.04); g.font = `${w * 0.6}px system-ui`; g.textAlign = 'center'; g.fillText(SUITS[SU(id)], w / 2, h * 0.42);
  return c;
}
function finish() {
  if (state !== 'play') return; state = 'finishing'; auto = false;
  const secs = Math.round(elapsed || (performance.now() - t0) / 1000), bonus = Math.max(0, Math.round((700 - secs) * 1.5));
  addScore(bonus); render();
  arp([67, 71, 74, 79, 83, 86, 91], 100, 0.12, 0.9); buzz([20, 60, 20]);
  ui.pop(bonus ? `TIME BONUS +${bonus}` : 'SOLVED', '#f3d27a', 30, 30);
  // classic bouncing-card cascade, off the foundations
  const cv = document.createElement('canvas'); cv.id = 'cascade'; document.body.appendChild(cv);
  const dpr = Math.min(devicePixelRatio || 1, 2); cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; const g = cv.getContext('2d'); g.scale(dpr, dpr);
  const faces = {}, flying = [], floor = innerHeight - (bar.offsetHeight || 70); let launched = 0, frame = 0;
  const order = []; for (let r = 13; r >= 1; r--) for (let s = 0; s < 4; s++) order.push(s * 13 + r - 1);
  const tick = () => {
    frame++;
    if (frame % 3 === 0 && launched < order.length) {
      const id = order[launched++], s = SU(id); faces[id] = faces[id] || faceCanvas(id, G.cw, G.ch);
      flying.push({ id, x: colX(3 + s), y: G.topY, vx: (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 3.5), vy: -Math.random() * 5 });
      const fs = found[s]; fs.pop(); els[id].style.visibility = 'hidden'; if (fs.length) els[fs[fs.length - 1]].style.visibility = '';
      if (launched % 4 === 0) chime(launched / 4, 72, 0.05);
    }
    for (const f of flying) {
      f.vy += 0.42; f.x += f.vx; f.y += f.vy;
      if (f.y + G.ch > floor) { f.y = floor - G.ch; f.vy *= -0.74; }
      if (f.x > -G.cw - 10 && f.x < innerWidth + 10) g.drawImage(faces[f.id], f.x, f.y, G.cw, G.ch);
    }
    if (frame < 210) requestAnimationFrame(tick); else { cv.style.opacity = 0; win(); }
  };
  requestAnimationFrame(tick);
}
function win() {
  if (state !== 'finishing') return;
  state = 'won'; if (!recorded) { recorded = true; if (!D.isDaily) F.level(true); }
  fx.confetti(120, ['#f3d27a', '#fff', '#d03a4c', '#7cc6a4', '#9db4ff']);
  if (D.isDaily) { const k = 'daily_' + todayKey(), prev = S.get(k, null); if (!prev || score > prev.s) S.set(k, { s: score }); }
  else { level++; S.set('level', level); }
  const best = S.get('best', 0); if (score > best) S.set('best', score);
  D.won(score); B.submit(1);   // world board: games won today
  ui.win(D.isDaily ? '' : level - 1, `${score.toLocaleString()} pts · ${nMoves} moves · ${fmtTime(elapsed)}${score > best ? ' · new best' : ''}`);
}
function lose() {
  if (state !== 'play') return;
  state = 'lost'; if (!recorded) { recorded = true; if (!D.isDaily) F.level(false, cleared()); }
  undoBtn.style.display = hist.length ? '' : 'none';
  ui.lose('No more moves', `${Math.round(cleared() * 52)} of 52 cards home`);
}
ui.onTap((which) => {
  B.start();
  if (which === 'start') { state = 'play'; return; }
  if (which === 'win' && D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
  if (which === 'lose') { replay(); state = 'play'; return; }
  build(); state = 'play';
});
function replay() {   // same deal again
  const d = dealCards(seedUsed);
  tab = d.tab.map(c => ({ d: c.d, c: c.c.slice() })); stock = d.stock.slice(); waste = []; found = [[], [], [], []];
  score = 0; nMoves = 0; t0 = 0; elapsed = 0; hist = []; recorded = true; beatenShown = false; plan = null; auto = false; render();
}
layout(); build();

// ---------------------------------------------------------------- test hook: the bot follows a solver line from the current position
window.__game = {
  get state() { return state === 'finishing' ? 'play' : state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play' || auto || dragS) return;
    const T = waste.concat(stock), f = fCounts();
    const valid = (m) => {
      if (!m) return false;
      if (m.k === 'tf') return top(m.col) >= 0 && canF(top(m.col));
      if (m.k === 'wf') return T.includes(m.card) && canF(m.card);
      if (m.k === 'wt') { const t = top(m.to); return T.includes(m.card) && (t < 0 ? RK(m.card) === 13 : canStack(m.card, t)); }
      if (m.k === 'tt') { const col = tab[m.from], c = col.c[m.at], t = top(m.to); return c !== undefined && m.at >= col.d && (t < 0 ? RK(c) === 13 : canStack(c, t)); }
    };
    if (!plan || !valid(plan[0])) { const r = solve(tab, T, f, drawN, 30000, waste.length); plan = r.ok ? r.path.slice() : null; }
    let m = plan && plan[0];
    if (!m) { const ms = genMoves(tab, T, f, drawN, extraTalon()); m = ms[0]; if (!m) return draw(); }
    const wt = waste.length ? waste[waste.length - 1] : -1;
    if ((m.k === 'wf' || m.k === 'wt') && m.card !== wt) return draw();
    if (plan) plan.shift();
    if (m.k === 'tf') return exec({ t: 'tab', i: m.col, k: tab[m.col].c.length - 1 }, { t: 'found' });
    if (m.k === 'wf') return exec({ t: 'waste' }, { t: 'found' });
    if (m.k === 'wt') return exec({ t: 'waste' }, { t: 'tab', i: m.to });
    if (m.k === 'tt') return exec({ t: 'tab', i: m.from, k: m.at }, { t: 'tab', i: m.to });
  },
};
