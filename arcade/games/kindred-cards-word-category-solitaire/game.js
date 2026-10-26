// Kindred Cards — original word-category solitaire. Category cards (★) open one of four foundation slots; every word card that
// belongs to that category then stacks on it until the category is complete and clears. Tableau columns hide face-down cards,
// the stock deals one card at a time, and every action costs a move. Deals are seeded and checked solvable by our own solver.
import { createUI, store, buzz } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { demo } from './kit/demo.js';
import { css, cardTheme, startCard, fx2d, chime, arp, soft, todayKey } from './calm.js';
import { CATS } from './categories.js';
import { board } from './kit/board.js';
const B = board({ game: 'kindred-cards', label: 'Deals solved', limits: { maxRun: 2, maxPerSec: 0.15 }, mode: 'sum' });   // world board (RULES.md part C)

const NAME = 'Kindred Cards: Word Category Solitaire';
const S = store('kindred-cards');
const F = flow('kindred-cards');
const ui = createUI({ title: 'Kindred Cards', hint: 'Tap to deal', hand: '', score: false });
cardTheme({ accent: '#e0a23a' });
const D = daily('kindred-cards', ui, { name: NAME });
const fx = fx2d(11);
const doneToday = S.get('daily_' + todayKey(), null);
startCard(ui, D, { kicker: D.isDaily ? 'Daily deal' : 'word category solitaire', doneLine: doneToday ? (D.isDaily ? `Cleared today · ${doneToday.s} pts` : 'Daily deal cleared ✓') : null });
if (D.isDaily) ui.els.win.querySelector('p').innerHTML = 'Daily deal<span data-l hidden></span>';
ui.els.win.querySelector('h1').textContent = 'Table cleared!';

function rngf(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function shuffled(a, r) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const FAM = (c) => (c.family === 'color' ? 'feel' : c.family);   // colours and feelings share a family (both are "describing" words)
const NSLOT = 4, NCOL = 4;

// ---------------------------------------------------------------- styles + DOM
css(`
html,body{color:#2c2a33}
body{background:radial-gradient(130% 90% at 50% 20%,#2a8a83 0%,#1d6d68 55%,#145350 100%)}
body:before{content:'';position:fixed;inset:0;pointer-events:none;opacity:.25;background-image:repeating-linear-gradient(45deg,rgba(255,255,255,.05) 0 2px,transparent 2px 7px),repeating-linear-gradient(-45deg,rgba(0,0,0,.05) 0 2px,transparent 2px 7px)}
.hc-top{z-index:60}.hc-top .hc-lvl{width:28px;height:28px;font-size:14px;font-weight:700;color:#3a2a06;background:#f2c14e}
.hc-top .hc-lvl.next{background:rgba(255,255,255,.2);color:#fff}.hc-top .hc-bar{background:rgba(255,255,255,.2);height:8px}.hc-top .hc-bar i{background:#f2c14e}
.hc-card,.hc-card.dim{background:linear-gradient(180deg,rgba(10,40,38,.72),rgba(8,30,28,.86))}
#table{position:fixed;inset:0;z-index:2}
.slot{position:absolute;border-radius:12px;border:2px dashed rgba(255,255,255,.28);background:rgba(0,0,0,.08)}
.slot.hot{border-color:#f2c14e;background:rgba(242,193,78,.15)}
.rib{position:absolute;height:24px;border-radius:7px 7px 0 0;background:linear-gradient(180deg,#f6cd60,#e7ac33);color:#3d2a04;font-weight:800;display:flex;align-items:center;justify-content:center;white-space:nowrap;overflow:hidden;padding:0 4px;box-shadow:inset 0 -2px 0 rgba(0,0,0,.1);transition:opacity .3s;z-index:1}
.rib.off{opacity:0}
.card{position:absolute;left:0;top:0;border-radius:11px;transition:transform .32s cubic-bezier(.3,1.1,.4,1),opacity .3s;will-change:transform;touch-action:none;cursor:pointer}
.card .fr,.card .bk{position:absolute;inset:0;border-radius:11px;backface-visibility:hidden;-webkit-backface-visibility:hidden;transition:transform .32s ease}
.card .fr{background:linear-gradient(170deg,#fffdf6,#f5efe2);box-shadow:0 1px 0 rgba(255,255,255,.7) inset,0 3px 8px rgba(0,0,0,.28);border:1px solid rgba(0,0,0,.08)}
.card .bk{transform:rotateY(180deg);background:repeating-linear-gradient(45deg,#3d7fd6 0 6px,#5a96e3 6px 12px);border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.25)}
.card.down .fr{transform:rotateY(180deg)}.card.down .bk{transform:rotateY(0)}
.card .w{position:absolute;left:4px;right:4px;top:50%;transform:translateY(-50%);text-align:center;font-weight:800;color:#4a3b2c;line-height:1.05;font-family:ui-rounded,'SF Pro Rounded',system-ui,sans-serif;transition:top .25s,transform .25s}
.card.cov .w{top:5px;transform:none}
.card .ct{position:absolute;right:6px;top:4px;font-size:11px;font-weight:800;color:#a08c6c}
.card .ic{position:absolute;left:0;right:0;top:20%;text-align:center;font-size:24px;line-height:1}
.card.cat .fr{background:linear-gradient(170deg,#fffaf0,#fbefd2);border:2.5px solid #eab53e;box-shadow:0 0 0 1px rgba(0,0,0,.05),0 3px 10px rgba(0,0,0,.28)}
.card.cat .w{top:66%;color:#5a3d06}
.card.cat .cr{position:absolute;left:6px;top:3px;font-size:12px;color:#e2a12a}
.card.cat.cov .w{top:5px;transform:none}.card.cat.cov .ic,.card.cat.cov .ct{display:none}
.card.fc:after{content:attr(data-count);position:absolute;right:6px;top:4px;font-size:11px;font-weight:800;color:#a08c6c;z-index:2}
.card.cat.fc .ct{display:none}
.card.gone{opacity:0;pointer-events:none}
.card.lift{z-index:500!important;transition:none;filter:drop-shadow(0 12px 14px rgba(0,0,0,.35))}
.card.hint .fr{box-shadow:0 0 0 3px #fff,0 0 18px 4px #f2c14e}
.card.nope{animation:nope .35s}
@keyframes nope{25%{margin-left:-6px}50%{margin-left:6px}75%{margin-left:-3px}}
#moves{position:absolute;border-radius:12px;background:linear-gradient(180deg,#38b27a,#22955f);color:#fff;text-align:center;box-shadow:0 4px 0 #1a7249,0 8px 16px rgba(0,0,0,.2);display:flex;flex-direction:column;justify-content:center}
#moves b{font-size:13px;font-weight:700;opacity:.9}
#moves span{font-size:34px;font-weight:800;line-height:1}
#moves.low{background:linear-gradient(180deg,#f0785f,#d9573f);box-shadow:0 4px 0 #a83f2c,0 8px 16px rgba(0,0,0,.2)}
#moves.bump span{animation:bump .3s}
@keyframes bump{50%{transform:scale(1.25)}}
#stockN{position:absolute;min-width:24px;height:22px;border-radius:11px;background:#fff;color:#1d6d68;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;padding:0 6px;box-shadow:0 2px 6px rgba(0,0,0,.25);z-index:400;pointer-events:none}
#recycle{position:absolute;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.75);font-size:30px;pointer-events:none}
.tbtn{position:absolute;width:58px;height:58px;border-radius:16px;border:0;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 5px 0 rgba(0,0,0,.25),0 10px 18px rgba(0,0,0,.18);z-index:450}
.tbtn svg{width:30px;height:30px;stroke:#fff;fill:none;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.tbtn i{position:absolute;top:-7px;right:-7px;font-style:normal;background:#e8503a;color:#fff;font-size:12px;font-weight:800;border-radius:11px;min-width:22px;height:22px;display:flex;align-items:center;justify-content:center;border:2px solid #fff}
.tbtn.off{filter:grayscale(1);opacity:.6}
#pts{position:fixed;z-index:9;left:12px;bottom:calc(30px + env(safe-area-inset-bottom));height:30px;border-radius:16px;font-weight:800;font-size:13px;padding:0 12px;display:flex;align-items:center;background:rgba(0,0,0,.2);color:#fff}
`);
const table = document.createElement('div'); table.id = 'table'; document.body.appendChild(table);
const movesEl = document.createElement('div'); movesEl.id = 'moves'; movesEl.innerHTML = '<b>Moves</b><span>0</span>'; table.appendChild(movesEl);
const stockN = document.createElement('div'); stockN.id = 'stockN'; table.appendChild(stockN);
const recycleEl = document.createElement('div'); recycleEl.id = 'recycle'; recycleEl.textContent = '↻'; table.appendChild(recycleEl);
const slotEls = [], ribEls = [], colEls = [];
for (let i = 0; i < NSLOT; i++) { const s = document.createElement('div'); s.className = 'slot'; table.appendChild(s); slotEls.push(s); const r = document.createElement('div'); r.className = 'rib off'; table.appendChild(r); ribEls.push(r); }
for (let i = 0; i < NCOL; i++) { const s = document.createElement('div'); s.className = 'slot'; s.style.borderStyle = 'solid'; s.style.opacity = '.5'; table.appendChild(s); colEls.push(s); }
const stockSlot = document.createElement('div'); stockSlot.className = 'slot'; table.appendChild(stockSlot);
const mkBtn = (svg, color, shadow) => { const b = document.createElement('button'); b.className = 'tbtn'; b.innerHTML = svg + '<i>3</i>'; b.style.background = color; b.style.boxShadow = `0 5px 0 ${shadow},0 10px 18px rgba(0,0,0,.18)`; table.appendChild(b); return b; };
const hintBtn = mkBtn('<svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 00-3.5 10.9c.6.4 1 1.1 1 1.9V16h5v-.2c0-.8.4-1.5 1-1.9A6 6 0 0012 3z"/></svg>', '#4d8fe6', '#2f69b5');
const undoBtn = mkBtn('<svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/></svg>', '#4d8fe6', '#2f69b5');
const ptsEl = document.createElement('div'); ptsEl.id = 'pts'; document.body.appendChild(ptsEl);

// ---------------------------------------------------------------- level generation
function spec(lvl, fk) {
  const L = Math.min(lvl, 40);
  const C = L <= 1 ? 2 : L <= 3 ? 3 : L <= 7 ? 4 : L <= 14 ? 5 : 6;
  const n = L <= 2 ? 3 : L <= 5 ? 4 : L <= 11 ? 5 : L <= 20 ? 6 : 7;
  const depth = L <= 2 ? [0, 1, 1, 2] : L <= 6 ? [1, 2, 2, 3] : L <= 14 ? [1, 2, 3, 4] : [2, 3, 4, 5];
  // flow scales the move budget: steady players get a tighter budget, players who keep running out get a roomier one
  const slack = Math.max(1.08, (L <= 3 ? 1.6 : L <= 10 ? 1.4 : 1.25) / fk);
  return { C, n, depth, slack };
}
// categories that would make a word fit two piles are never dealt together
const FEEL_OK = new Set(['place', 'time', 'learn', 'sport', 'fun', 'people']);
const PAIRS = new Set(['Loud|Music', 'Loud|Music Styles', 'Quiet|Reading', 'Quiet|School', 'Round|Toys', 'Round|Games', 'Fast|Sports', 'Fast|Heroes', 'Bright|Show Time',
  'Winter|Polar', 'Winter|Weather', 'Winter|Mountains', 'Winter|Clothes', 'Winter|Hats', 'Beach|Water', 'Beach|Islands', 'Beach|Hats', 'Beach|Sea Life', 'Picnic|food', 'Camping|Trees',
  'Baking|Kitchen', 'Baking|Appliances', 'Pizza|Kitchen', 'Desert|Ancient Egypt', 'Pond|Water', 'Pond|Garden', 'Rivers|Water', 'Herbs|Garden', 'Insects|Garden', 'Flowers|Jungle',
  'Gems|Pirates', 'Metals|Robots', 'Airport|Jobs', 'Station|Jobs', 'Halloween|Big Cats', 'Desert|Reptiles', 'Jungle|Fairy Tales', 'Dinosaur Dig|Reptiles', 'Ice Cream|Winter', 'Drinks|Picnic']);
const clash = (a, b) => [a.name + '|' + b.name, b.name + '|' + a.name, a.name + '|' + b.family, b.name + '|' + a.family].some(k => PAIRS.has(k))
  || (FAM(a) === 'feel' && !FEEL_OK.has(FAM(b))) || (FAM(b) === 'feel' && !FEEL_OK.has(FAM(a)));
function pickCats(r, C) {
  for (let t = 0; t < 200; t++) {
    const fams = new Set(), cats = [];
    for (const c of shuffled(CATS, r)) { if (cats.length >= C) break; if (fams.has(FAM(c)) || cats.some(e => clash(c, e))) continue; fams.add(FAM(c)); cats.push(c); }
    if (cats.length === C) return cats;
  }
  return CATS.slice(0, C);
}
function makeLevel(seed, lvl, fk) {
  const sp = spec(lvl, fk);
  for (let attempt = 0; attempt < 40; attempt++) {
    const r = rngf(seed + attempt * 7919);
    const cats = pickCats(r, sp.C), names = new Set(cats.map(c => c.name.toLowerCase()));
    const cards = []; let ok = true;
    cats.forEach((c, ci) => {
      const others = new Set(cats.filter(o => o !== c).flatMap(o => o.words.map(w => w.toLowerCase())));
      const pool = shuffled(c.words.filter(w => !others.has(w.toLowerCase()) && !names.has(w.toLowerCase())), r);
      const n = Math.max(3, Math.min(pool.length, sp.n + (r() < 0.35 ? (r() < 0.5 ? -1 : 1) : 0)));
      if (pool.length < 3) ok = false;
      cards.push({ cat: ci, isCat: true, word: c.name });
      pool.slice(0, n).forEach(w => cards.push({ cat: ci, isCat: false, word: w }));
    });
    if (!ok) continue;
    cards.forEach((c, i) => (c.id = i));
    const need = cats.map((_, ci) => cards.filter(c => c.cat === ci && !c.isCat).length);
    const deck = shuffled(cards.map(c => c.id), r);
    const st = { tab: [], stock: [], waste: [], found: Array(NSLOT).fill(null), done: [], moves: 0 };
    let k = 0;
    for (let col = 0; col < NCOL; col++) { const pile = []; for (let d = 0; d <= sp.depth[col]; d++) pile.push({ id: deck[k++], up: d === sp.depth[col] }); st.tab.push(pile); }
    st.stock = deck.slice(k);
    const L = { cats, cards, need };
    const used = solve(L, clone(st));
    if (used < 0) continue;
    const budget = Math.ceil(used * sp.slack) + 2;
    return { ...L, st, budget, solverMoves: used };
  }
  return null;
}
const clone = (st) => JSON.parse(JSON.stringify(st));

// ---------------------------------------------------------------- rules (shared by the player, the solver, hints and the bot)
let LV = null;   // current level { cats, cards, need }
const card = (id) => LV.cards[id];
function runFrom(st, src) {
  if (src.t === 'waste') return st.waste.length ? [st.waste[st.waste.length - 1]] : null;
  const col = st.tab[src.c]; if (src.i < 0 || src.i >= col.length) return null;
  const run = col.slice(src.i); if (!run.every(x => x.up)) return null;
  const cat = card(run[0].id).cat; if (!run.every(x => card(x.id).cat === cat)) return null;
  return run.map(x => x.id);
}
function canDrop(st, ids, dst) {
  const cat = card(ids[0]).cat;
  if (dst.t === 'found') {
    const f = st.found[dst.s];
    if (!f) return ids.some(id => card(id).isCat);
    return f.cat === cat && ids.every(id => !card(id).isCat);
  }
  if (dst.t === 'tab') { const col = st.tab[dst.c]; if (!col.length) return true; const top = col[col.length - 1]; return top.up && card(top.id).cat === cat; }
  return false;
}
/** apply a move to a state; returns info about what happened ({ completed: catIndex | -1, flipped }) */
function apply(st, mv) {
  st.moves++;
  if (mv.t === 'draw') {
    if (st.stock.length) st.waste.push(st.stock.pop());
    else { st.stock = st.waste.reverse(); st.waste = []; }
    return { completed: -1 };
  }
  const ids = runFrom(st, mv.src); let flipped = false;
  if (mv.src.t === 'waste') st.waste.pop();
  else { const col = st.tab[mv.src.c]; col.splice(mv.src.i); if (col.length && !col[col.length - 1].up) { col[col.length - 1].up = true; flipped = true; } }
  let completed = -1;
  if (mv.dst.t === 'tab') st.tab[mv.dst.c].push(...ids.map(id => ({ id, up: true })));
  else {
    const s = mv.dst.s, cat = card(ids[0]).cat;
    if (!st.found[s]) st.found[s] = { cat, ids: [] };
    const f = st.found[s];
    // the category card always sits at the bottom of its foundation
    const catCard = ids.find(id => card(id).isCat); if (catCard !== undefined) f.ids.unshift(catCard);
    f.ids.push(...ids.filter(id => !card(id).isCat));
    if (f.ids.length - 1 >= LV.need[cat]) { completed = cat; st.done.push(cat); st.found[s] = null; }
  }
  return { completed, flipped };
}
function sources(st) {
  const out = [];
  if (st.waste.length) out.push({ t: 'waste' });
  st.tab.forEach((col, c) => { for (let i = col.length - 1; i >= 0; i--) { if (!col[i].up) break; if (runFrom(st, { t: 'tab', c, i })) out.push({ t: 'tab', c, i }); else break; } });
  return out;
}
/** the greedy policy: the solver, the hint button and the bot all use it */
function bestMove(st, stall = 0) {
  const srcs = sources(st);
  const uncovers = (src) => src.t === 'tab' && src.i > 0 && !st.tab[src.c][src.i - 1].up;
  const empties = (src) => src.t === 'tab' && src.i === 0;
  let cands = [];
  for (const src of srcs) {
    const ids = runFrom(st, src);
    for (let s = 0; s < NSLOT; s++) if (st.found[s] && canDrop(st, ids, { t: 'found', s })) cands.push({ src, dst: { t: 'found', s }, sc: 100 + ids.length + (uncovers(src) ? 20 : 0) + (empties(src) ? 5 : 0) });
    if (ids.some(id => card(id).isCat)) { const s = st.found.findIndex(f => !f); if (s >= 0) cands.push({ src, dst: { t: 'found', s }, sc: 80 + (uncovers(src) ? 20 : 0) + catReady(st, card(ids[0]).cat) }); }
  }
  if (cands.length) return best(cands);
  for (const src of srcs) {
    const ids = runFrom(st, src);
    for (let c = 0; c < NCOL; c++) {
      if (src.t === 'tab' && src.c === c) continue;
      const col = st.tab[c];
      if (!col.length) { if (src.t === 'tab' && src.i === 0) continue; if (src.t === 'tab' && !uncovers(src)) continue; cands.push({ src, dst: { t: 'tab', c }, sc: src.t === 'waste' ? 30 : 40 }); continue; }
      if (!canDrop(st, ids, { t: 'tab', c })) continue;
      if (src.t === 'tab' && !uncovers(src) && !empties(src)) continue;   // shuffling runs around without revealing anything is pointless
      cands.push({ src, dst: { t: 'tab', c }, sc: src.t === 'waste' ? 50 : 60 + (uncovers(src) ? 10 : 0) });
    }
  }
  if (cands.length) return best(cands);
  if (st.stock.length || st.waste.length > 1 || (st.waste.length === 1 && stall < 1)) return { t: 'draw' };
  return null;
}
function catReady(st, cat) { let n = 0; for (const src of sources(st)) { const ids = runFrom(st, src); if (card(ids[0]).cat === cat) n += ids.length; } return n; }
function best(c) { return c.sort((a, b) => b.sc - a.sc)[0]; }
function solve(L, st) {
  const prev = LV; LV = L; let stall = 0, guard = 0;
  try {
    while (st.done.length < L.cats.length && guard++ < 900) {
      const mv = bestMove(st, stall > (st.stock.length + st.waste.length) * 2 + 2 ? 1 : 0); if (!mv) return -1;
      if (mv.t === 'draw') { stall++; if (stall > (st.stock.length + st.waste.length) * 2 + 4) return -1; } else stall = 0;
      apply(st, mv);
    }
    return st.done.length === L.cats.length ? st.moves : -1;
  } finally { LV = prev; }
}

// ---------------------------------------------------------------- state + rendering
let state = 'ready', level = S.get('level', 1), points = S.get('points', 0), G = null, st = null, movesLeft = 0, hist = [], hints = 3, undos = 3, recorded = false, beatenShown = false, dailyPts = 0, geo = {}, cardEls = [], busy = false;
function build() {
  const fk = D.isDaily ? 1 : F.k();
  const lvl = D.isDaily ? 9 : level;
  G = makeLevel(D.seed ? D.seed : level * 3301 + 17, lvl, fk) || makeLevel(level * 3301 + 18, 1, 1);
  LV = G; st = clone(G.st); movesLeft = G.budget; hist = []; hints = 3; undos = 3; recorded = false; beatenShown = false; dailyPts = 0; busy = false;
  cardEls.forEach(e => e.remove()); cardEls = [];
  for (const c of G.cards) {
    const e = document.createElement('div'); e.className = 'card down' + (c.isCat ? ' cat' : '');
    const n = c.isCat ? G.need[c.cat] : 0;
    e.innerHTML = `<div class="fr">${c.isCat ? `<span class="cr">★</span><span class="ct">0/${n}</span><div class="ic">${G.cats[c.cat].icon}</div>` : ''}<div class="w"></div></div><div class="bk"></div>`;
    e.querySelector('.w').textContent = c.word;
    e.addEventListener('pointerdown', (ev) => down(ev, c.id));
    table.appendChild(e); cardEls.push(e);
  }
  ui.levels(D.isDaily ? 1 : level); ui.progress(0);
  if (D.isDaily) { ui.els.top.querySelector('[data-a]').textContent = '★'; ui.els.top.querySelector('[data-b]').textContent = '✓'; }
  layout(); render();
}
function layout() {
  const W = innerWidth, H = innerHeight, pad = 12, gap = 8;
  const cw = Math.min(92, (Math.min(W, 520) - pad * 2 - gap * 3) / 4), ch = cw * 1.32, x0 = (W - (cw * 4 + gap * 3)) / 2;
  const colX = (i) => x0 + i * (cw + gap);
  const topY = 58, fy = topY + ch + 36, ty = fy + ch + 16, btnY = H - 82;
  geo = { cw, ch, colX, topY, fy, ty, btnY, fdOff: Math.max(9, ch * 0.1), fuOff: Math.max(26, ch * 0.27) };
  for (const e of cardEls) { e.style.width = cw + 'px'; e.style.height = ch + 'px'; const w = e.querySelector('.w'); const len = w.textContent.length; w.style.fontSize = Math.max(10.5, Math.min(cw * 0.2, (cw - 10) / (len * 0.62))) + 'px'; }
  Object.assign(movesEl.style, { left: colX(0) + 'px', top: topY + 'px', width: cw + 'px', height: ch * 0.72 + 'px' });
  Object.assign(stockSlot.style, { left: colX(3) + 'px', top: topY + 'px', width: cw + 'px', height: ch + 'px' });
  Object.assign(recycleEl.style, { left: colX(3) + 'px', top: topY + 'px', width: cw + 'px', height: ch + 'px' });
  Object.assign(stockN.style, { left: colX(3) + cw - 20 + 'px', top: topY - 8 + 'px' });
  for (let i = 0; i < NSLOT; i++) { Object.assign(slotEls[i].style, { left: colX(i) + 'px', top: fy + 'px', width: cw + 'px', height: ch + 'px' }); Object.assign(ribEls[i].style, { left: colX(i) + 3 + 'px', top: fy - 22 + 'px', width: cw - 6 + 'px' }); }
  for (let i = 0; i < NCOL; i++) Object.assign(colEls[i].style, { left: colX(i) + 'px', top: ty + 'px', width: cw + 'px', height: ch + 'px' });
  Object.assign(hintBtn.style, { left: W / 2 - 74 + 'px', top: btnY + 'px' });
  Object.assign(undoBtn.style, { left: W / 2 + 16 + 'px', top: btnY + 'px' });
}
addEventListener('resize', () => G && (layout(), render()));
function place(id, x, y, z, down, cov) {
  const e = cardEls[id];
  e.style.transform = `translate(${x}px,${y}px)`; e.style.zIndex = z;
  e.classList.toggle('down', down); e.classList.toggle('cov', !!cov); e.classList.remove('gone');
}
function setRib(r, t) { r.textContent = t; r.style.fontSize = Math.min(12.5, (geo.cw - 12) / (t.length * 0.58)) + 'px'; }
function render() {
  const { cw, ch, colX, topY, fy, ty, btnY, fdOff, fuOff } = geo;
  const seen = new Set();
  cardEls.forEach(e => { e.classList.remove('fc'); delete e.dataset.count; });
  // stock
  st.stock.forEach((id, k) => { place(id, colX(3) - Math.min(k, 3) * 0.8, topY - Math.min(k, 3) * 0.8, 10 + k, true); seen.add(id); });
  stockN.textContent = st.stock.length; stockN.style.display = st.stock.length ? 'flex' : 'none';
  recycleEl.style.display = !st.stock.length && st.waste.length ? 'flex' : 'none';
  // waste: last three fanned to the left of the stock
  const wx = colX(1) + cw * 0.15;
  st.waste.forEach((id, k) => { const fromTop = st.waste.length - 1 - k, slot = Math.max(0, 2 - fromTop); place(id, wx + slot * cw * 0.28, topY, 100 + k, false, fromTop > 0); seen.add(id); });
  // foundations
  st.found.forEach((f, s) => {
    const r = ribEls[s];
    if (!f) { r.classList.add('off'); slotEls[s].classList.remove('hot'); return; }
    r.classList.remove('off'); setRib(r, G.cats[f.cat].name);
    f.ids.forEach((id, k) => { place(id, colX(s), fy, 200 + k, false, false); seen.add(id); });
    const top = cardEls[f.ids[f.ids.length - 1]], n = G.need[f.cat];
    const catEl = cardEls[f.ids[0]]; catEl.querySelector('.ct').textContent = `${f.ids.length - 1}/${n}`;
    top.dataset.count = `${f.ids.length - 1}/${n}`; top.classList.add('fc');
  });
  // tableau
  const avail = btnY - 14 - ty - ch;
  st.tab.forEach((col, c) => {
    const nd = col.filter(x => !x.up).length, nu = col.length - nd;
    let fd = fdOff, fu = fuOff; const need = nd * fd + Math.max(0, nu - 1) * fu;
    if (need > avail && need > 0) { const k = avail / need; fd *= k; fu *= k; }
    let y = ty;
    col.forEach((x, k) => { place(x.id, colX(c), y, 300 + k, !x.up, k < col.length - 1); seen.add(x.id); y += x.up ? fu : fd; });
  });
  G.cards.forEach(c => { if (!seen.has(c.id)) cardEls[c.id].classList.add('gone'); });
  movesEl.querySelector('span').textContent = movesLeft; movesEl.classList.toggle('low', movesLeft <= 5);
  hintBtn.querySelector('i').textContent = hints; hintBtn.classList.toggle('off', !hints);
  undoBtn.querySelector('i').textContent = undos; undoBtn.classList.toggle('off', !undos || !hist.length);
  ptsEl.textContent = '★ ' + (D.isDaily ? dailyPts : points).toLocaleString();
  ui.progress(st.done.length / G.cats.length);
}

// ---------------------------------------------------------------- playing a move (with juice)
function play(mv) {
  if (state !== 'play' || busy) return false;
  hist.push(clone(st)); if (hist.length > 40) hist.shift();
  const before = mv.t !== 'draw' ? runFrom(st, mv.src) : null;
  const res = apply(st, mv); movesLeft--;
  movesEl.classList.remove('bump'); void movesEl.offsetWidth; movesEl.classList.add('bump');
  clearHint();
  if (mv.t === 'draw') { soft.swish(); render(); return endCheck(); }
  if (mv.dst.t === 'found') {
    const n = before.filter(id => !card(id).isCat).length; const p = n * 10; points += p; dailyPts += p; S.set('points', points);
    const sl = slotEls[mv.dst.s].getBoundingClientRect();
    fx.sparks(sl.left + sl.width / 2, sl.top + sl.height / 2, ['#fff', '#f2c14e'], 8, { speed: 3, size: 2.6 });
    chime(4 + (st.found[mv.dst.s] ? st.found[mv.dst.s].ids.length : 6), 67, 0.1); buzz(10);
    if (before.length >= 3) ui.pop(`+${before.length} cards!`, '#f2c14e', 26, 46);
  } else { soft.wood(); buzz(5); }
  if (res.flipped) setTimeout(() => soft.click(), 160);
  if (res.completed >= 0) {
    // show the full stack for a beat, then send it off
    const s = mv.dst.s, ids = [...before, ...(hist[hist.length - 1].found[s] ? hist[hist.length - 1].found[s].ids : [])];
    ids.forEach((id, k) => place(id, geo.colX(s), geo.fy, 200 + k, false, false));
    setRib(ribEls[s], G.cats[res.completed].name); ribEls[s].classList.remove('off');
    busy = true;
    setTimeout(() => {
      const sl = slotEls[s].getBoundingClientRect();
      fx.sparks(sl.left + sl.width / 2, sl.top + sl.height / 2, ['#fff', '#f2c14e', '#7fe0b0', '#7fb7ff'], 26, { speed: 5, size: 3.4 });
      fx.ring(sl.left + sl.width / 2, sl.top + sl.height / 2, '#f2c14e', 40);
      ids.forEach((id, k) => { const e = cardEls[id]; e.style.transform = `translate(${geo.colX(s)}px,${geo.fy - 60 - k * 4}px) scale(.85)`; e.classList.add('gone'); });
      arp([67, 72, 76, 79], 80, 0.11); buzz([15, 30, 15]);
      ui.pop(G.cats[res.completed].name + ' complete!', '#fff', 28, 44);
      const bonus = 50; points += bonus; dailyPts += bonus; S.set('points', points); checkBeat();
      setTimeout(() => { busy = false; render(); endCheck(); }, 380);
    }, 420);
    render(); ids.forEach((id, k) => place(id, geo.colX(s), geo.fy, 200 + k, false, false)); ribEls[s].classList.remove('off'); setRib(ribEls[s], G.cats[res.completed].name);
    return true;
  }
  checkBeat(); render(); return endCheck();
}
function endCheck() {
  if (st.done.length === G.cats.length) { setTimeout(win, 300); return true; }
  if (movesLeft <= 0) { setTimeout(lose, 400); return true; }
  return true;
}
function checkBeat() { const s = D.isDaily ? dailyPts : points; if (!beatenShown && D.beaten(s)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); fx.confetti(60); } }

// ---------------------------------------------------------------- input: tap = auto-move, drag = drop where you like
let drag = null;
function srcOf(id) {
  if (st.waste.length && st.waste[st.waste.length - 1] === id) return { t: 'waste' };
  for (let c = 0; c < NCOL; c++) { const i = st.tab[c].findIndex(x => x.id === id); if (i >= 0) return st.tab[c][i].up ? { t: 'tab', c, i } : null; }
  return null;
}
function down(ev, id) {
  ev.stopPropagation(); if (state !== 'play' || busy) return;
  if (st.stock.includes(id)) { play({ t: 'draw' }); return; }
  const src = srcOf(id); if (!src) return;
  const ids = runFrom(st, src); if (!ids) { nope(id); return; }
  drag = { id, src, ids, x: ev.clientX, y: ev.clientY, moved: false, base: ids.map(i => { const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(cardEls[i].style.transform); return m ? [+m[1], +m[2]] : [0, 0]; }) };
}
addEventListener('pointermove', (ev) => {
  if (!drag) return; const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 8) return;
  drag.moved = true;
  drag.ids.forEach((id, k) => { const e = cardEls[id]; e.classList.add('lift'); e.style.transform = `translate(${drag.base[k][0] + dx}px,${drag.base[k][1] + dy}px)`; e.style.zIndex = 500 + k; });
});
addEventListener('pointerup', (ev) => {
  if (!drag) return; const d = drag; drag = null;
  d.ids.forEach(id => cardEls[id].classList.remove('lift'));
  if (!d.moved) return autoMove(d.src, d.ids);
  const dst = dropTarget(ev.clientX, ev.clientY);
  if (dst && canDrop(st, d.ids, dst) && !(dst.t === 'tab' && d.src.t === 'tab' && dst.c === d.src.c)) play({ src: d.src, dst });
  else { render(); if (dst) nope(d.ids[0]); }
});
function dropTarget(x, y) {
  const { cw, ch, colX, fy, ty } = geo;
  for (let s = 0; s < NSLOT; s++) if (x > colX(s) - 6 && x < colX(s) + cw + 6 && y > fy - 26 && y < fy + ch + 8) return { t: 'found', s };
  for (let c = 0; c < NCOL; c++) if (x > colX(c) - 6 && x < colX(c) + cw + 6 && y > ty - 10) return { t: 'tab', c };
  return null;
}
function autoMove(src, ids) {
  const cat = card(ids[0]).cat;
  let s = st.found.findIndex(f => f && f.cat === cat);
  if (s >= 0 && canDrop(st, ids, { t: 'found', s })) return play({ src, dst: { t: 'found', s } });
  if (ids.some(id => card(id).isCat)) { s = st.found.findIndex(f => !f); if (s >= 0) return play({ src, dst: { t: 'found', s } }); }
  for (let c = 0; c < NCOL; c++) { if (src.t === 'tab' && src.c === c) continue; const col = st.tab[c]; if (col.length && canDrop(st, ids, { t: 'tab', c })) return play({ src, dst: { t: 'tab', c } }); }
  for (let c = 0; c < NCOL; c++) { if (src.t === 'tab' && (src.c === c || src.i === 0)) continue; if (!st.tab[c].length) return play({ src, dst: { t: 'tab', c } }); }
  nope(ids[0]);
  if (ids.every(id => !card(id).isCat) && !st.found.some(f => f && f.cat === cat)) ui.pop(st.found.every(f => f) ? 'Finish a category first' : 'Open its category first', '#fff', 20, 44);
}
function nope(id) { const e = cardEls[id]; e.classList.remove('nope'); void e.offsetWidth; e.classList.add('nope'); soft.err(); buzz(20); }
stockSlot.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (state === 'play' && !busy && (st.stock.length || st.waste.length)) play({ t: 'draw' }); });
let hinted = [];
function clearHint() { hinted.forEach(id => cardEls[id] && cardEls[id].classList.remove('hint')); hinted = []; slotEls.forEach(s => s.classList.remove('hot')); }
hintBtn.addEventListener('pointerdown', (e) => {
  e.stopPropagation(); if (state !== 'play' || busy || !hints) return;
  const mv = bestMove(st); if (!mv) return; hints--; clearHint();
  if (mv.t === 'draw') { hinted = st.stock.length ? [st.stock[st.stock.length - 1]] : []; ui.pop('Draw a card', '#fff', 22, 44); }
  else { hinted = runFrom(st, mv.src); if (mv.dst.t === 'found') slotEls[mv.dst.s].classList.add('hot'); else if (st.tab[mv.dst.c].length) hinted.push(st.tab[mv.dst.c][st.tab[mv.dst.c].length - 1].id); }
  hinted.forEach(id => cardEls[id].classList.add('hint')); chime(4, 76, 0.1); render();
});
undoBtn.addEventListener('pointerdown', (e) => {
  e.stopPropagation(); if (state !== 'play' || busy || !undos || !hist.length) return;
  st = hist.pop(); undos--; movesLeft++; clearHint(); soft.swish(); render();
});

// ---------------------------------------------------------------- win / lose
function win() {
  if (state !== 'play') return;
  state = 'won';
  if (!recorded) { recorded = true; if (!D.isDaily) F.level(true); B.submit(1); }
  const bonus = movesLeft * 5; points += bonus; dailyPts += bonus; S.set('points', points); render();
  arp([67, 72, 76, 79, 84], 100, 0.12, 0.9); fx.confetti(); buzz([20, 50, 20]);
  const shown = D.isDaily ? dailyPts : points;
  if (D.isDaily) { const k = 'daily_' + todayKey(), prev = S.get(k, null); if (!prev || dailyPts > prev.s) S.set(k, { s: dailyPts }); }
  else { level++; S.set('level', level); }
  D.won(shown);
  ui.win(D.isDaily ? '' : level - 1, `${G.cats.length} categories · ${movesLeft} moves to spare · ★ ${shown.toLocaleString()}`);
}
function lose() {
  if (state !== 'play' || st.done.length === G.cats.length) return;
  state = 'lost';
  const total = G.cards.length, placed = G.cards.length - st.stock.length - st.waste.length - st.tab.reduce((a, c) => a + c.length, 0);
  if (!recorded) { recorded = true; if (!D.isDaily) F.level(false, placed / total); }
  soft.err(); buzz([40, 60, 40]);
  ui.lose('Out of moves', `${st.done.length} of ${G.cats.length} categories done`);
}
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on level 1, until the first real touch,
// the solver's next two moves play themselves (a card slides onto its category or column), and each move is given back
demo(() => { const mv = bestMove(st); if (!mv || movesLeft < 10 || play(mv) === false) return false; movesLeft++; movesEl.querySelector('span').textContent = movesLeft; },
  { ready: () => state === 'play' && level === 1 && !D.isDaily && !busy && !drag, wait: 2000, every: 1500, max: 2 });
ui.onTap((which) => {
  B.start();
  if (which === 'start') { state = 'play'; return; }
  if (which === 'win' && D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
  build(); state = 'play';
});
build();

// ---------------------------------------------------------------- test hook: the bot plays the solver's next move
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return D.isDaily ? dailyPts : points; },
  bot() { if (state !== 'play' || busy || drag) return; const mv = bestMove(st); if (mv) play(mv); },
};
