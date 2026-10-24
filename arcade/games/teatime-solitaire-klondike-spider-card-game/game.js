// Teatime Solitaire — Klondike (draw 1 / draw 3) and Spider (1 / 2 / 4 suits) on a painted tea-party tablecloth.
// Untimed, unlimited undo, hints, auto-finish, winnable deals (checked by our solvers), tap-to-move or drag, very large
// cards, and a teatime journey: stars from each solved deal unlock painted tea-party scenes; a stamp album fills as you play.
// Art: our storybook library (assets/, painted backs, court portraits, aces, suits); ranks and every word drawn in code.
import { createUI, store, buzz } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { money } from './kit/money.js';
import * as KL from './klondike.js';
import * as SP from './spider.js';
import { snd } from './sound.js';

const NAME = 'Teatime Solitaire: Klondike & Spider Card Game';
const A = p => `assets/${p}.webp`;
const $ = h => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const BOT = () => performance.now() - lastBot < 1500;
let lastBot = -1e9;

// ---------------------------------------------------------------- persistent state
const S = store('teatime');
const sget = (k, d) => { try { return S.get(k, d); } catch (e) { return d; } };
const sset = (k, v) => { try { S.set(k, v); } catch (e) {} };
const P = Object.assign({ level: 1, skip: 0, stars: 0, wins: 0, mode: 'k1', winnable: 1, big: 0, back: 'sage', backs: ['sage'], stamps: 0,
  muted: 0, music: 1, ds: { n: 0, last: 0, fw: -1 }, daily: {}, chapter: 0 }, sget('p', {}));
const save = () => sset('p', P);
snd.muted = !!P.muted; snd.music = !!P.music;
document.body.classList.toggle('big', !!P.big);

const MODES = {
  k1: { kind: 'k', n: 1, name: 'Klondike', sub: 'Draw 1', par: [190, 140] },
  k3: { kind: 'k', n: 3, name: 'Klondike', sub: 'Draw 3', par: [210, 160] },
  s1: { kind: 's', n: 1, name: 'Spider', sub: '1 suit', par: [230, 170] },
  s2: { kind: 's', n: 2, name: 'Spider', sub: '2 suits', par: [270, 200] },
  s4: { kind: 's', n: 4, name: 'Spider', sub: '4 suits', par: [330, 250] },
};
const CHAPTERS = [
  ['lawn-teatime', 'Tea on the Lawn', 'The cloth is laid and the kettle sings.'],
  ['tea-table', 'The Tea Table', 'Scones still warm, jam in the blue bowl.'],
  ['rose-arbour', 'Under the Rose Arbour', 'A shady seat where the roses climb.'],
  ['cottage-june', 'Cottage in June', 'Hollyhocks by the door, a pot of Darjeeling.'],
  ['conservatory', 'The Conservatory', 'Rain on the glass, orchids and Earl Grey.'],
  ['orchard', 'Orchard Picnic', 'Apple blossom drifting onto the plates.'],
  ['kitchen-garden', 'The Kitchen Garden', 'Mint for the tea, straight from the bed.'],
  ['duck-pond', 'By the Duck Pond', 'Crumbs for the ducklings, cake for us.'],
  ['flower-market', 'The Flower Market', 'Buckets of peonies and a flask of tea.'],
  ['cat-window', 'The Cat in the Window', 'Someone is watching the milk jug.'],
  ['lavender-farm', 'Lavender Farm', 'Lavender shortbread under a wide sky.'],
  ['bluebell-wood', 'Bluebell Wood', 'A blanket among the bluebells.'],
  ['harbour', 'Harbour Tea Room', 'Sea air, gulls and a fresh pot.'],
  ['spaniel', 'A Walk with Bramble', 'The spaniel waits patiently for crumbs.'],
  ['snow-cottage', 'Snowy Cottage', 'Toast by the fire, frost on the panes.'],
  ['lighthouse', 'Lighthouse Tea', 'The last cup, watching the lamp come on.'],
];
const NEED = [0, 4, 10, 18, 28, 40, 54, 70, 88, 108, 130, 154, 180, 208, 238, 270];
const STAMPS = ['teacup', 'rose', 'robin', 'teapot', 'cottage', 'bluebells', 'butterfly', 'peony', 'hedgehog', 'strawberry', 'bluetit', 'hydrangea',
  'swan', 'lavender', 'beehive', 'cat', 'sunflower', 'squirrel', 'tulip', 'owl', 'kingfisher', 'fox', 'sailboat', 'lighthouse'];
const BACKS = { sage: { name: 'Sage', price: 0 }, rose: { name: 'Rose', price: 250 }, navy: { name: 'Navy', price: 400 } };
const chapterOf = (stars) => { let c = 0; for (let i = 0; i < NEED.length; i++) if (stars >= NEED[i]) c = i; return c; };
const dayNum = (d = new Date()) => Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
const dayKey = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const weekOf = n => Math.floor((n + 3) / 7);

// ---------------------------------------------------------------- kit layers
const F = flow('teatime');
const M = money({ game: 'teatime-solitaire', style: 'C' });
const ui = createUI({ title: 'Teatime Solitaire', hint: 'Tap to deal', hand: '', progress: false, score: false });
const D = daily('teatime', ui, { name: NAME });
const B = board({ game: 'teatime-solitaire', label: 'Deals solved', limits: { maxRun: 1, maxPerSec: 0.1 }, mode: 'sum', corner: 'tl' });
addEventListener('ap:ad', e => snd.pause(e.detail && e.detail.phase === 'start'));

// ---------------------------------------------------------------- DOM
const bg = document.getElementById('bg');
const table = $('<div id="table"></div>'); document.body.appendChild(table);
const fxc = $('<canvas id="fx"></canvas>'); document.body.appendChild(fxc);
const hdr = $(`<div id="hdr"><div class="ttl"><b></b><small></small></div></div>`); document.body.appendChild(hdr);
const coinsEl = $(`<button id="coins" aria-label="Coins and shop"><i></i><span>0</span></button>`); document.body.appendChild(coinsEl);
coinsEl.addEventListener('pointerdown', e => e.stopPropagation());
coinsEl.onclick = () => { snd.click(); M.shop(); };
const paintCoins = () => { coinsEl.querySelector('span').textContent = M.coins().toLocaleString(); };
M.onChange(() => { paintCoins(); coinsEl.classList.remove('bump'); void coinsEl.offsetWidth; coinsEl.classList.add('bump'); }); paintCoins();
const bar = $(`<div id="bar">
  <button class="tb" data-b="home"><i style="background-image:url(${A('icons/home')})"></i>Menu</button>
  <button class="tb" data-b="new"><i style="background-image:url(${A('icons/shuffle-arrows')})"></i>New</button>
  <button class="tb" data-b="hint"><i style="background-image:url(${A('icons/hint')})"></i>Hint<em></em></button>
  <button class="tb" data-b="undo"><i style="background-image:url(${A('icons/undo')})"></i>Undo</button></div>`);
document.body.appendChild(bar);
bar.addEventListener('pointerdown', e => e.stopPropagation());
const btn = n => bar.querySelector(`[data-b="${n}"]`);
btn('home').onclick = () => { snd.click(); goHome(); };
btn('new').onclick = () => { snd.click(); askNew(); };
btn('hint').onclick = () => hint(true);
btn('undo').onclick = () => { snd.click(); undo(); };
const finBtn = $('<button id="finish" hidden>Finish the deal ✓</button>'); document.body.appendChild(finBtn);
finBtn.addEventListener('pointerdown', e => e.stopPropagation());
finBtn.onclick = () => autoFinish();
function toast(t) { const d = $(`<div class="toast"></div>`); d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2300); }
const setTitle = (a, b) => { hdr.querySelector('b').textContent = a; hdr.querySelector('small').textContent = b; };

// ---------------------------------------------------------------- petals + sparkles (one calm canvas)
const fx = (() => {
  const c = fxc, x = c.getContext('2d'), parts = []; let dpr = 1, running = false;
  const size = () => { dpr = Math.min(2, devicePixelRatio || 1); c.width = innerWidth * dpr; c.height = innerHeight * dpr; };
  size(); addEventListener('resize', size);
  const COL = ['#e8a3b0', '#f2c4cc', '#d97a8c', '#f7e3b0', '#c9a65a', '#b9d1a8', '#fff6e0'];
  function tick() {
    x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.t += 1 / 60; if (p.t > p.life) { parts.splice(i, 1); continue; }
      p.vy += p.g; p.vx *= 0.99; p.x += p.vx + Math.sin(p.t * p.sw + p.ph) * p.sa; p.y += p.vy; p.r += p.vr;
      const a = Math.min(1, (p.life - p.t) / 0.6) * Math.min(1, p.t * 6);
      x.save(); x.globalAlpha = a; x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c;
      if (p.k === 's') { x.beginPath(); for (let k = 0; k < 8; k++) { const rr = k % 2 ? p.s * 0.35 : p.s; x.lineTo(Math.cos(k * Math.PI / 4) * rr, Math.sin(k * Math.PI / 4) * rr); } x.fill(); }
      else { x.beginPath(); x.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, Math.PI * 2); x.fill(); x.globalAlpha = a * 0.35; x.fillStyle = '#fff'; x.beginPath(); x.ellipse(-p.s * 0.2, -p.s * 0.1, p.s * 0.45, p.s * 0.18, 0, 0, Math.PI * 2); x.fill(); }
      x.restore();
    }
    if (parts.length) requestAnimationFrame(tick); else { running = false; x.clearRect(0, 0, innerWidth, innerHeight); }
  }
  const go = () => { if (!running) { running = true; requestAnimationFrame(tick); } };
  return {
    sparkle(px, py, n = 14) {
      for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 2.4;
        parts.push({ k: 's', x: px, y: py, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.6, g: 0.03, r: 0, vr: 0.1, s: 3 + Math.random() * 4, c: i % 3 ? '#e9c873' : '#fff8e2', t: 0, life: 0.7 + Math.random() * 0.4, sw: 0, ph: 0, sa: 0 }); }
      go();
    },
    petals(n = 60, fromTop = true) {
      for (let i = 0; i < n; i++) parts.push({ k: 'p', x: Math.random() * innerWidth, y: fromTop ? -20 - Math.random() * innerHeight * 0.6 : innerHeight * 0.5, vx: (Math.random() - 0.5) * 0.6,
        vy: 0.8 + Math.random() * 1.2, g: 0.004, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.06, s: 5 + Math.random() * 6, c: COL[i % COL.length], t: 0, life: 6 + Math.random() * 3, sw: 1 + Math.random() * 2, ph: Math.random() * 6, sa: 0.6 });
      go();
    },
  };
})();

// ---------------------------------------------------------------- game state
// Klondike: tab[{d,c}] (d = index of the first face-up card), stock (draw order: stock[0] next), waste (last = top),
// found[suit]. Spider: cols[{d,c}], stock (dealt from its end), done (completed runs). Card ids: suit = id/13|0 for
// Klondike (0 ♠ 1 ♥ 2 ♦ 3 ♣); Spider uses su[]/rk[] from its deal.
let G = null, state = 'ready', hist = [], els = {}, Lg = null, busy = false, recorded = false, finishing = false, plan = null, stuckT = 0, finishable = false;
const SUITN = ['spades', 'hearts', 'diamonds', 'clubs'], RN = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const suitOf = id => G.kind === 'k' ? KL.SU(id) : SPS(G.su[id]);
const rankOf = id => G.kind === 'k' ? KL.RK(id) : G.rk[id];
const SPS = s => [0, 1, 2, 3][s];   // spider suit set index → our suit order (♠ ♥ ♦ ♣)
const isRed = s => s === 1 || s === 2;

function cardEl(id) {
  const s = suitOf(id), r = rankOf(id), red = isRed(s);
  let art = '';
  if (r === 1) art = `<div class="art ace" style="background-image:url(${A('cards/ace-' + SUITN[s])})"></div>`;
  else if (r > 10) art = `<div class="art court" style="background-image:url(${A('cards/' + ['jack', 'queen', 'king'][r - 11] + '-' + SUITN[s])})"></div>`;
  else art = `<div class="art pip" style="background-image:url(${A('cards/pip-' + SUITN[s])})"></div>`;
  const e = $(`<div class="cd down"><div class="in"><div class="f fr ${red ? 'red' : 'blk'}"><div class="ix"><b class="${r === 10 ? 'ten' : ''}">${RN[r]}</b><i style="background-image:url(${A('cards/pip-' + SUITN[s])})"></i></div>${art}</div><div class="f bk"></div></div></div>`);
  e.dataset.id = id; e.setAttribute('aria-label', RN[r] + ' of ' + SUITN[s]);
  return e;
}
function paintBacks() { const u = `url(${A('cards/back-' + P.back)})`; table.querySelectorAll('.bk').forEach(b => b.style.backgroundImage = u); }

// ---------------------------------------------------------------- layout
let slots = {};
function layout() {
  const W = innerWidth, H = innerHeight, wide = W / H >= 1;
  bg.style.backgroundImage = `url(${A('bg/teatime-solitaire' + (wide ? '-wide' : '') + (W < 600 && devicePixelRatio < 2 ? '-s' : ''))})`;
  if (!G) return;
  const nc = G.kind === 'k' ? 7 : 10, top = hdr.offsetHeight + 4, botH = getComputedStyle(bar).flexDirection === 'column' ? 12 : bar.offsetHeight;
  const maxW = wide ? Math.min(W - 40, 1080, H * 1.5) : W - (nc === 7 ? 10 : 6);
  const gap = nc === 7 ? clamp(W * 0.013, 4, 16) : clamp(W * 0.009, 3, 12);
  let cw = (maxW - gap * (nc - 1)) / nc;
  cw = Math.min(cw, (H - top - botH) / (nc === 7 ? 6.3 : 7.6), 124);
  const ch = cw * 1.4, bw = cw * nc + gap * (nc - 1), x0 = (W - bw) / 2;
  const big = P.big ? 1.1 : 1, rf = Math.min(cw * (nc === 7 ? 0.5 : 0.56), nc === 7 ? 42 : 34) * big;
  Lg = { W, H, nc, cw, ch, gap, x0, rf, topY: top, tabY: top + ch + Math.max(10, cw * 0.24), botY: H - botH - 6,
    fu: Math.max(rf * 1.12, cw * 0.36), fd: cw * 0.19, colX: i => x0 + i * (cw + gap) };
  table.style.setProperty('--cw', cw + 'px'); table.style.setProperty('--ch', ch + 'px'); table.style.setProperty('--rf', rf + 'px');
  // slots
  for (const k in slots) slots[k].remove(); slots = {};
  const slot = (k, x, y, inner = '', cls = '') => { const e = $(`<div class="slot ${cls}">${inner}</div>`); e.style.transform = `translate(${x}px,${y}px)`; e.dataset.slot = k; table.prepend(e); slots[k] = e; };
  if (G.kind === 'k') {
    slot('stock', Lg.colX(0), Lg.topY, '<b>↻</b>', 'stock');
    for (let s = 0; s < 4; s++) slot('f' + s, Lg.colX(3 + s), Lg.topY, `<i style="background-image:url(${A('cards/pip-' + SUITN[s])})"></i>`);
  } else {
    slot('stock', Lg.colX(0), Lg.topY, '', 'stock');
    slot('done', Lg.colX(nc - 1), Lg.topY, `<i style="background-image:url(${A('cards/pip-spades')})"></i>`);
  }
  for (let i = 0; i < nc; i++) slot('t' + i, Lg.colX(i), Lg.tabY, '<b>K</b>');
  render(true);
}
addEventListener('resize', () => layout());

// positions for every card → transforms
function colOffsets(col) {
  const n = col.c.length, d = Math.min(col.d, n), avail = Lg.botY - Lg.tabY - Lg.ch;
  let fd = Lg.fd, fu = Lg.fu; const nu = Math.max(0, n - 1 - d), need = d * fd + nu * fu;
  if (need > avail && n > 1) { fd = Math.min(fd, Math.max(Lg.cw * 0.08, (avail * 0.18) / Math.max(1, d))); fu = Math.max(Lg.rf * 1.04, (avail - d * fd) / Math.max(1, nu)); if (d * fd + nu * fu > avail) fd = Math.max(3, (avail - nu * fu) / Math.max(1, d)); }
  return { fd, fu };
}
function positions() {
  const out = {};   // id → {x,y,z,down}
  const L = Lg;
  const tabPos = (cols) => cols.forEach((col, i) => {
    const { fd, fu } = colOffsets(col); let y = L.tabY;
    col.c.forEach((id, k) => { out[id] = { x: L.colX(i), y, z: 100 + k, down: k < col.d }; y += k < col.d ? fd : fu; });
  });
  if (G.kind === 'k') {
    G.stock.forEach((id, k) => { out[id] = { x: L.colX(0) - Math.min(4, (G.stock.length - 1 - k) / 8), y: L.topY - Math.min(4, (G.stock.length - 1 - k) / 8), z: 10 + (G.stock.length - k), down: true }; });
    const n = G.waste.length, fan = G.n === 3 ? Math.min(3, n) : 1, step = Math.min(L.cw * 0.42, (L.colX(3) - L.colX(1) - L.cw - 4) / 2 + L.cw * 0.0);
    G.waste.forEach((id, k) => { const f = k - (n - fan); out[id] = { x: L.colX(1) + Math.max(0, f) * (G.n === 3 ? Math.max(L.cw * 0.3, step) : 0), y: L.topY, z: 10 + k, down: false }; });
    G.found.forEach((pile, s) => pile.forEach((id, k) => { out[id] = { x: L.colX(3 + s), y: L.topY, z: 10 + k, down: false }; }));
    tabPos(G.tab);
  } else {
    const groups = Math.ceil(G.stock.length / 10);
    G.stock.forEach((id, k) => { const g = Math.floor(k / 10); out[id] = { x: L.colX(0) + g * L.cw * 0.2, y: L.topY, z: 10 + k, down: true }; });
    G.done.forEach((run, r) => run.forEach((id, q) => { out[id] = { x: L.colX(L.nc - 1) - r * L.cw * 0.34, y: L.topY, z: 10 + r * 20 + (13 - q), down: false }; }));
    void groups; tabPos(G.cols);
  }
  return out;
}
function render(now = false) {
  if (!G || !Lg) return;
  const pos = positions();
  for (const id in pos) {
    const e = els[id], p = pos[id]; if (!e) continue;
    if (e.classList.contains('drag')) continue;
    const moved = e._x !== undefined && (Math.abs(e._x - p.x) > 1 || Math.abs(e._y - p.y) > 1);
    e._x = p.x; e._y = p.y; e._z = p.z;
    if (now) e.classList.add('now');
    e.style.transform = `translate(${p.x}px,${p.y}px)`;
    if (moved && !now) { e.style.zIndex = 1000 + p.z; clearTimeout(e._zt); e._zt = setTimeout(() => { e.style.zIndex = e._z; }, 320); } else e.style.zIndex = p.z;
    if (e.classList.contains('down') !== p.down) { e.classList.toggle('down', p.down); if (!p.down && !now) snd.flip(); }
    e.style.visibility = '';
  }
  if (now) requestAnimationFrame(() => requestAnimationFrame(() => table.querySelectorAll('.cd.now').forEach(e => e.classList.remove('now'))));
  if (G.kind === 's' && slots.stock) slots.stock.style.visibility = G.stock.length ? 'hidden' : '';
  paintHud();
}
function paintHud() {
  if (!G) return;
  const m = MODES[G.mode];
  setTitle(G.daily ? 'Daily Deal' : (G.hard ? `Deal ${G.level} · Hard` : `Deal ${G.level}`), `${G.moves} move${G.moves === 1 ? '' : 's'}`); void m;
  btn('undo').disabled = !hist.length;
  const em = btn('hint').querySelector('em'), free = Math.max(0, 3 - G.hints);
  em.className = free ? '' : 'c'; em.innerHTML = free ? `${free} free` : `<i style="width:16px;height:16px;background:url(${A('kit/coin')}) center/contain"></i>10`;
}

// ---------------------------------------------------------------- deals
function pickDeal(mode, daily) {
  const m = MODES[mode], lvl = P.level, hard = !daily && lvl > 5 && lvl % 6 === 0, easy = !daily && lvl <= 5;
  const base = daily ? dayKey() * 13 + 7 : lvl * 7919 + P.skip * 104729 + (m.kind === 'k' ? m.n * 1009 : m.n * 1000003);
  const fk = daily || easy ? 1 : F.k();
  const want = (P.winnable || daily) ? 1 : 0, found = [];
  if (m.kind === 'k') {
    if (want) for (let k = 0; k < 16 && found.length < (hard || fk > 1.06 || easy ? 3 : 1); k++) {
      const s = base + k * 31337, d = KL.dealCards(s), r = KL.solve(d.tab, d.stock, [0, 0, 0, 0], m.n, 8000);
      if (r.ok) found.push({ seed: s, len: r.path.length, nodes: r.nodes });
    }
    found.sort((a, b) => a.nodes - b.nodes);
    const pick = found.length ? found[hard || fk > 1.06 ? found.length - 1 : 0] : { seed: base };
    return { seed: pick.seed, hard, checked: !!found.length };
  }
  if (want && m.n < 4 || (want && m.n === 4)) for (let k = 0; k < (m.n === 4 ? 4 : 14) && found.length < (hard || fk > 1.06 || easy ? 2 : 1); k++) {
    const s = base + k * 31337, d = SP.makeDeal(s, m.n), r = SP.search(d.cols, d.stock, 0, d.su, d.rk, m.n === 1 ? 3000 : 2500, null, true);
    if (r.win) found.push({ seed: s, nodes: r.nodes });
  }
  found.sort((a, b) => a.nodes - b.nodes);
  const pick = found.length ? found[hard || fk > 1.06 ? found.length - 1 : 0] : { seed: base };
  return { seed: pick.seed, hard, checked: !!found.length };
}
function startDeal({ mode, seed, daily = false, hard = false, checked = false, snap = null, level = P.level }) {
  const m = MODES[mode];
  G = { mode, kind: m.kind, n: m.n, seed, daily, hard, checked, level, moves: 0, hints: 0, t0: performance.now() };
  if (m.kind === 'k') { const d = KL.dealCards(seed); Object.assign(G, { tab: d.tab, stock: d.stock, waste: [], found: [[], [], [], []] }); }
  else { const d = SP.makeDeal(seed, m.n); Object.assign(G, { cols: d.cols, stock: d.stock, done: [], su: d.su, rk: d.rk }); }
  if (snap) restore(snap), G.moves = snap.moves || 0, G.hints = snap.hints || 0;
  hist = []; plan = null; recorded = false; finishing = false; finishable = false; finBtn.hidden = true; clearTimeout(stuckT);
  table.querySelectorAll('.cd').forEach(e => e.remove()); els = {};
  const n = m.kind === 'k' ? 52 : 104;
  for (let id = 0; id < n; id++) { const e = cardEl(id); els[id] = e; table.appendChild(e); }
  paintBacks(); M.level(level);
  layout();
  if (!snap) dealAnim();
  saveCur(); checkFinish();
}
function dealAnim() {
  const sx = Lg.colX(0), sy = Lg.topY, order = [];
  const cols = G.kind === 'k' ? G.tab : G.cols;
  for (let row = 0; row < 7; row++) cols.forEach(col => { if (col.c[row] !== undefined) order.push(col.c[row]); });
  const set = new Set(order);
  for (const id of order) { const e = els[id]; e.classList.add('now', 'down'); e.style.transform = `translate(${sx}px,${sy}px)`; e.style.zIndex = 900; }
  void table.offsetWidth;
  const step = BOT() ? 4 : Math.min(26, 900 / order.length);
  order.forEach((id, i) => { const e = els[id]; e.classList.remove('now'); e.style.transitionDelay = (i * step) + 'ms'; e.querySelector('.in').style.transitionDelay = (i * step + 150) + 'ms'; e._x = undefined; });
  render();
  order.forEach((id, i) => { const e = els[id]; e.style.zIndex = 900 + i; });
  setTimeout(() => { for (const id of set) { const e = els[id]; e.style.transitionDelay = ''; e.querySelector('.in').style.transitionDelay = ''; e.style.zIndex = e._z; } }, order.length * step + 450);
  if (!BOT()) order.forEach((id, i) => i % 4 === 0 && setTimeout(() => snd.draw(), i * step));
}
const snapshot = () => G.kind === 'k'
  ? { tab: G.tab.map(c => ({ d: c.d, c: c.c.slice() })), stock: G.stock.slice(), waste: G.waste.slice(), found: G.found.map(f => f.slice()), moves: G.moves, hints: G.hints }
  : { cols: G.cols.map(c => ({ d: c.d, c: c.c.slice() })), stock: G.stock.slice(), done: G.done.map(r => r.slice()), moves: G.moves, hints: G.hints };
function restore(s) {
  if (G.kind === 'k') { G.tab = s.tab.map(c => ({ d: c.d, c: c.c.slice() })); G.stock = s.stock.slice(); G.waste = s.waste.slice(); G.found = s.found.map(f => f.slice()); }
  else { G.cols = s.cols.map(c => ({ d: c.d, c: c.c.slice() })); G.stock = s.stock.slice(); G.done = s.done.map(r => r.slice()); }
  G.moves = s.moves;
}
function saveCur() { if (!G) return; sset('cur', state === 'won' ? null : { mode: G.mode, seed: G.seed, daily: G.daily, dk: dayKey(), hard: G.hard, checked: G.checked, level: G.level, snap: snapshot() }); }
function push() { hist.push(snapshot()); if (hist.length > 600) hist.shift(); }
function after() { G.moves++; render(); saveCur(); clearGlow(); checkFinish(); checkEnd(); }
function undo() {
  if (state !== 'play' || finishing || !hist.length) return;
  const s = hist.pop(); const h = G.hints; restore(s); G.hints = h; plan = null; render(); saveCur(); checkFinish();
}

// ---------------------------------------------------------------- Klondike moves
const kTop = i => { const c = G.tab[i].c; return c.length ? c[c.length - 1] : -1; };
const kCanF = id => G.found[KL.SU(id)].length === KL.RK(id) - 1;
const kCanT = (id, i) => { const t = kTop(i); return t < 0 ? KL.RK(id) === 13 : KL.canStack(id, t); };
function kFlip(i) { const col = G.tab[i]; if (col.c.length && col.d >= col.c.length) col.d = col.c.length - 1; }
function kDraw() {
  if (!G.stock.length && !G.waste.length) return false;
  push();
  if (G.stock.length) { const n = Math.min(G.n, G.stock.length); G.waste.push(...G.stock.splice(0, n)); snd.draw(); }
  else { G.stock = G.waste; G.waste = []; snd.flip(); }
  after(); return true;
}
// src: {w:'tab',i,k} | {w:'waste'} | {w:'found',s}; dst: {w:'tab',i} | {w:'found'}
function kLegal(src, dst) {
  const ids = kIds(src); if (!ids.length) return false;
  if (dst.w === 'found') return ids.length === 1 && src.w !== 'found' && kCanF(ids[0]);
  if (src.w === 'tab' && src.i === dst.i) return false;
  return kCanT(ids[0], dst.i);
}
function kIds(src) {
  if (src.w === 'tab') { const col = G.tab[src.i]; return src.k >= col.d && src.k < col.c.length ? col.c.slice(src.k) : []; }
  if (src.w === 'waste') return G.waste.length ? [G.waste[G.waste.length - 1]] : [];
  if (src.w === 'found') { const f = G.found[src.s]; return f.length ? [f[f.length - 1]] : []; }
  return [];
}
function kMove(src, dst) {
  if (!kLegal(src, dst)) return false;
  push(); const ids = kIds(src);
  if (src.w === 'tab') { G.tab[src.i].c.splice(src.k); kFlip(src.i); } else if (src.w === 'waste') G.waste.pop(); else G.found[src.s].pop();
  if (dst.w === 'found') { G.found[KL.SU(ids[0])].push(ids[0]); homeFx(ids[0]); } else { G.tab[dst.i].c.push(...ids); snd.place(dst.i); }
  after(); return true;
}
function kLocate(id) {
  for (let i = 0; i < 7; i++) { const k = G.tab[i].c.indexOf(id); if (k >= 0) return { w: 'tab', i, k }; }
  if (G.waste.length && G.waste[G.waste.length - 1] === id) return { w: 'waste' };
  if (G.waste.includes(id)) return { w: 'wasteunder' };
  if (G.stock.includes(id)) return { w: 'stock' };
  for (let s = 0; s < 4; s++) if (G.found[s].length && G.found[s][G.found[s].length - 1] === id) return { w: 'found', s };
  return { w: 'none' };
}
function kBest(src) {   // tap-to-move: foundation first, then a column (one that reveals or keeps order), then an empty column
  const ids = kIds(src); if (!ids.length) return null;
  if (ids.length === 1 && src.w !== 'found' && kCanF(ids[0])) return { w: 'found' };
  const cand = [];
  for (let j = 0; j < 7; j++) {
    if (src.w === 'tab' && j === src.i) continue; if (!kCanT(ids[0], j)) continue;
    const empty = kTop(j) < 0;
    if (empty && src.w === 'tab' && src.k === 0) continue;          // a king already at the bottom of a column: pointless
    cand.push({ j, v: (empty ? 1 : 10) + (src.w === 'tab' ? 0 : 0) - Math.abs(j - (src.i ?? 1)) * 0.01 });
  }
  cand.sort((a, b) => b.v - a.v);
  return cand.length ? { w: 'tab', i: cand[0].j } : null;
}

// ---------------------------------------------------------------- Spider moves
const sAt = i => G.cols[i];
function sMove(i, k, j) {
  if (!SP.canDrop(G.cols, i, k, j, G.su, G.rk)) return false;
  push(); const run = G.cols[i].c.splice(k); G.cols[j].c.push(...run); sFix(i); snd.place(j);
  sSettle(j); after(); return true;
}
function sFix(i) { const col = G.cols[i]; if (col.c.length && col.d >= col.c.length) col.d = col.c.length - 1; }
function sSettle(j) {
  const col = G.cols[j], f = SP.fullRun(col, G.su, G.rk);
  if (f >= 0) { const run = col.c.splice(f); G.done.push(run); sFix(j); snd.run(); const e = els[run[0]]; if (e) { const r = e.getBoundingClientRect(); fx.sparkle(r.left + r.width / 2, r.top + r.height / 2, 26); } buzz(15); }
}
function sDeal() {
  if (!SP.canDeal(G.cols, G.stock)) { if (G.stock.length) { toast('Fill every empty column first'); snd.nope(); } return false; }
  push(); const from = G.stock.length;
  for (let q = 0; q < 10; q++) G.cols[q].c.push(G.stock[from - 10 + q]);
  G.stock.splice(from - 10, 10); snd.draw();
  for (let q = 0; q < 10; q++) sSettle(q);
  after(); return true;
}
function sLocate(id) {
  for (let i = 0; i < 10; i++) { const k = G.cols[i].c.indexOf(id); if (k >= 0) return { w: 'tab', i, k }; }
  if (G.stock.includes(id)) return { w: 'stock' };
  return { w: 'none' };
}
function sBest(i, k) {
  const col = G.cols[i], c = col.c[k], cand = [];
  for (let j = 0; j < 10; j++) {
    if (!SP.canDrop(G.cols, i, k, j, G.su, G.rk)) continue;
    const t = G.cols[j].c, tgt = t.length ? t[t.length - 1] : -1;
    if (tgt < 0 && k === 0) continue;
    cand.push({ j, v: tgt < 0 ? 1 : (G.su[tgt] === G.su[c] ? 100 : 50) - Math.abs(j - i) * 0.01 });
  }
  cand.sort((a, b) => b.v - a.v);
  return cand.length ? cand[0].j : -1;
}

// ---------------------------------------------------------------- end states, auto-finish
function homeFx(id) {
  const e = els[id]; const n = G.found.reduce((a, f) => a + f.length, 0);
  snd.home(n); buzz(8);
  if (e) { e.classList.remove('home'); void e.offsetWidth; e.classList.add('home'); setTimeout(() => { const r = e.getBoundingClientRect(); fx.sparkle(r.left + r.width / 2, r.top + r.height / 2, BOT() ? 4 : 12); }, 260); }
}
const kHome = () => G.found.reduce((a, f) => a + f.length, 0);
function checkFinish() {
  if (!G || state !== 'play') { finBtn.hidden = true; return; }
  let ok = false;
  if (G.kind === 'k') ok = kHome() < 52 && G.tab.every(c => c.d === 0 || !c.c.length) && (G.stock.length + G.waste.length === 0 || KL.solve(G.tab, G.waste.concat(G.stock), G.found.map(f => f.length), G.n, 4000, G.waste.length).ok);
  else ok = G.done.length < 8 && !G.stock.length && G.cols.every(c => c.d === 0 || !c.c.length) && SP.search(G.cols, G.stock, G.done.length, G.su, G.rk, 1500, null, true).win;
  finishable = ok; finBtn.hidden = !ok || finishing;
}
async function autoFinish() {
  if (!finishable || finishing || state !== 'play') return;
  finishing = true; finBtn.hidden = true; clearGlow();
  const gap = BOT() ? 60 : 110;
  if (G.kind === 'k') {
    for (let guard = 0; guard < 600 && kHome() < 52; guard++) {
      let moved = false;
      for (let i = 0; i < 7 && !moved; i++) { const t = kTop(i); if (t >= 0 && kCanF(t)) { kMove({ w: 'tab', i, k: G.tab[i].c.length - 1 }, { w: 'found' }); moved = true; } }
      if (!moved && G.waste.length && kCanF(G.waste[G.waste.length - 1])) { kMove({ w: 'waste' }, { w: 'found' }); moved = true; }
      if (!moved) {   // follow the solver for the talon
        const r = KL.solve(G.tab, G.waste.concat(G.stock), G.found.map(f => f.length), G.n, 4000, G.waste.length);
        const m = r.ok && r.path[0];
        if (m && m.k === 'tt') kMove({ w: 'tab', i: m.from, k: m.at }, { w: 'tab', i: m.to });
        else if (m && (m.k === 'wt') && G.waste.length && G.waste[G.waste.length - 1] === m.card) kMove({ w: 'waste' }, { w: 'tab', i: m.to });
        else kDraw();
      }
      await wait(gap); if (state !== 'play') break;
    }
  } else {
    const r = SP.search(G.cols, G.stock, G.done.length, G.su, G.rk, 3000, null, true);
    for (const mv of (r.win ? r.path : [])) { if (mv[0] === 'deal') sDeal(); else sMove(mv[0], mv[1], mv[2]); await wait(gap + 60); if (state !== 'play') break; }
  }
  finishing = false; checkEnd(); checkFinish();
}
function usefulK() {
  const T = G.waste.concat(G.stock), f = G.found.map(x => x.length);
  const ms = KL.moves(G.tab, T, f, G.n);
  const kingFree = () => G.tab.some(c => c.c.some((id, k) => k > 0 && k >= c.d && KL.RK(id) === 13)) || T.some(id => KL.RK(id) === 13);
  return ms.filter(m => !(m.k === 'tt' && m.at === 0 && G.tab[m.from].d === 0 && kTop(m.to) >= 0 && !kingFree()));
}
function checkEnd() {
  if (!G || state !== 'play') return;
  if (G.kind === 'k' ? kHome() === 52 : G.done.length === 8) return celebrate();
  clearTimeout(stuckT);
  if (finishable || finishing) return;
  const stuck = G.kind === 'k' ? !usefulK().length : (!G.stock.length && !SP.bestMoves(G.cols, G.su, G.rk).length);
  if (stuck) stuckT = setTimeout(() => { if (state === 'play' && !finishing) lose(); }, 900);
}
function cleared() { return G.kind === 'k' ? kHome() / 52 : G.done.length / 8; }
async function celebrate() {
  if (state !== 'play') return;
  state = 'finale'; finBtn.hidden = true; clearTimeout(stuckT); snd.win(); buzz([20, 60, 20]);
  const ids = Object.keys(els).map(Number), cx = innerWidth / 2, cy = innerHeight * 0.44, R = Math.min(innerWidth, innerHeight) * 0.3;
  ids.forEach((id, i) => {
    const e = els[id], a = (i / ids.length) * Math.PI * 2 * (G.kind === 'k' ? 1 : 2), rr = R * (G.kind === 'k' ? 1 : (i % 2 ? 0.75 : 1.05));
    e.style.transitionDelay = (BOT() ? i * 2 : i * 14) + 'ms'; e.style.zIndex = 1200 + i; e.classList.remove('down');
    e.style.transform = `translate(${cx + Math.cos(a) * rr - Lg.cw / 2}px,${cy + Math.sin(a) * rr - Lg.ch / 2}px) rotate(${a * 180 / Math.PI + 90}deg)`;
  });
  fx.petals(BOT() ? 30 : 90);
  await wait(BOT() ? 400 : 1400);
  ids.forEach(id => { els[id].style.transitionDelay = ''; });
  win();
}

// ---------------------------------------------------------------- win / lose cards
ui.els.win.classList.add('win-card'); ui.els.lose.classList.add('lose-card');
ui.els.win.innerHTML = `<div class="panel"><div class="rib"><h1>Well played!</h1></div>
  <div class="corner" style="left:-22px;bottom:-24px;transform:scaleX(-1)"></div><div class="corner" style="right:-22px;bottom:-24px"></div>
  <span data-l hidden></span><div class="stars"><i></i><i></i><i></i></div><div class="wline" data-x></div>
  <div class="coinline"><i></i><span data-c>+0</span></div><div class="gift" data-g></div>
  <div class="prog" data-p style="margin-top:0"></div><div class="cbtns" data-btns></div></div><div class="tapc">Tap anywhere to continue</div>`;
ui.els.lose.innerHTML = `<div class="panel"><div class="rib sage"><h1 data-t>No more moves</h1></div><p data-x class="wline"></p>
  <p class="wline" style="margin:0;color:var(--sage);font-style:italic">Undo is free and unlimited, as many steps as you like.</p>
  <div class="cbtns" data-btns></div></div><div class="tapc">Tap anywhere to try this deal again</div>`;
const mkBtn = (label, cls, icon, fn) => { const b = $(`<button class="btn ${cls}">${icon ? `<i style="background-image:url(${A(icon)})"></i>` : ''}<span></span></button>`); b.querySelector('span').textContent = label;
  b.addEventListener('pointerdown', e => e.stopPropagation()); b.addEventListener('click', e => { e.stopPropagation(); fn(b); }); return b; };
{ const ub = mkBtn('Undo', 'navy', 'icons/undo', () => { ui.els.lose.classList.add('hc-hidden'); state = 'play'; undo(); checkEnd(); });
  const nb = mkBtn('New deal', '', 'icons/shuffle-arrows', () => { ui.els.lose.classList.add('hc-hidden'); newDeal(true); });
  ui.els.lose.querySelector('[data-btns]').append(ub, nb); }
let winInfo = null;
function win() {
  const ms = performance.now() - G.t0, m = MODES[G.mode];
  const stars = 1 + (G.moves <= m.par[0] ? 1 : 0) + (G.moves <= m.par[1] ? 1 : 0);
  const first = !G.daily || !P.daily[dayKey()];
  let coins = (G.daily ? 50 : 20 + stars * 5) * (G.hard ? 2 : 1);
  const before = P.stars, ch0 = chapterOf(P.stars);
  if (!recorded) { recorded = true; if (!G.daily) F.level(true); }
  if (first) P.stars += stars * (G.hard ? 2 : 1);
  P.wins++;
  let stamp = null; if (first && P.stamps < STAMPS.length) { stamp = STAMPS[P.stamps]; P.stamps++; }
  let streakLine = '';
  if (G.daily) {
    const t = dayNum(), ds = P.ds;
    if (ds.last !== t) {
      if (ds.last === t - 1) ds.n++;
      else if (ds.last === t - 2 && ds.fw !== weekOf(t)) { ds.n++; ds.fw = weekOf(t); streakLine = 'Your weekly streak freeze kept the streak going.'; }
      else ds.n = 1;
      ds.last = t;
    }
    if (!P.daily[dayKey()]) P.daily[dayKey()] = { stars, moves: G.moves };
    else coins = 0;
  } else { P.level++; }
  save(); sset('cur', null);
  if (coins) M.add(coins, 'win');
  B.submit(1, { ms });
  D.won(P.stars, 'have collected');
  state = 'won';
  winInfo = { stars, coins, ch0, ch1: chapterOf(P.stars), daily: G.daily, moves: G.moves };
  const w = ui.els.win;
  w.querySelectorAll('.stars i').forEach((s, i) => { s.classList.remove('on'); if (i < stars) setTimeout(() => { s.classList.add('on'); snd.home(i * 3); }, 900 + i * 260); });
  w.querySelector('[data-c]').textContent = coins ? `+${coins}` : 'Solved again';
  w.querySelector('.coinline i').style.display = coins ? '' : 'none';
  const g = w.querySelector('[data-g]');
  g.innerHTML = stamp ? `<i style="background-image:url(${A('stamps/stamp-' + stamp)})"></i><span>New stamp for your album<br><i style="all:unset;font-style:italic;color:var(--sage)">${P.stamps} of ${STAMPS.length} collected</i></span>` : '';
  g.style.display = stamp ? '' : 'none';
  const nx = chapterOf(P.stars) + 1;
  w.querySelector('[data-p]').innerHTML = nx < NEED.length ? `<div class="st"></div><div class="bar"><i style="width:${Math.round(100 * (P.stars - NEED[nx - 1]) / (NEED[nx] - NEED[nx - 1]))}%"></i></div><small>${P.stars} / ${NEED[nx]}</small>` : '<div class="st"></div><small>Every teatime scene is yours</small>';
  const bx = w.querySelector('[data-btns]'); bx.innerHTML = '';
  if (coins) bx.append(mkBtn(`Double to ${coins * 2}`, 'rose', 'icons/video', async (b) => { b.disabled = true; if (await M.rewarded('double', { what: `${coins * 2} coins instead of ${coins}` })) { M.add(coins, 'double'); w.querySelector('[data-c]').textContent = `+${coins * 2}`; b.remove(); } else b.disabled = false; }));
  { const sb = mkBtn('', 'ico', 'icons/share', () => share()); sb.setAttribute('aria-label', 'Share'); bx.append(sb); }
  ui.win('', `${m.name} · ${m.sub} · ${G.moves} moves${G.hard ? ' · hard deal, double stars' : ''}${streakLine ? '\n' + streakLine : ''}`);
  w.querySelector('[data-x]').style.whiteSpace = 'pre-line';
  // first time over a new chapter: reveal after the card
  winInfo.reveal = winInfo.ch1 > P.chapter ? winInfo.ch1 : 0;
  void before;
}
async function share() {
  const i = winInfo; if (!i) return;
  const d = new Date(), date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const stars = '★'.repeat(i.stars) + '☆'.repeat(3 - i.stars);
  const u = new URL(location.href); u.search = i.daily ? '?daily=1' : '';
  const text = i.daily ? `Teatime Solitaire · Daily deal ${date}\n${stars}  🫖🌹🌹🌹🌹\nSolved in ${i.moves} moves · 🔥 ${P.ds.n}-day streak` : `I solved a deal in Teatime Solitaire ${stars} (${i.moves} moves). Come for tea?`;
  try { if (navigator.share) return await navigator.share({ title: NAME, text, url: u.href }); } catch (e) { return; }
  try { await navigator.clipboard.writeText(`${text}\n${u.href}`); toast('Copied, ready to paste'); } catch (e) { toast('Sharing is not available here'); }
}
function lose() {
  if (state !== 'play') return;
  state = 'lost'; if (!recorded && !G.daily) { recorded = true; F.level(false, cleared()); }
  const n = G.kind === 'k' ? `${kHome()} of 52 cards are home.` : `${G.done.length} of 8 runs are complete.`;
  ui.lose('No more moves', n);
  ui.els.lose.querySelector('[data-btns] .btn').style.display = hist.length ? '' : 'none';
}

// ---------------------------------------------------------------- hints
function clearGlow() { table.querySelectorAll('.glow').forEach(e => e.classList.remove('glow')); }
function findHint() {
  if (G.kind === 'k') {
    const T = G.waste.concat(G.stock), f = G.found.map(x => x.length);
    const r = KL.solve(G.tab, T, f, G.n, 12000, G.waste.length);
    let m = r.ok ? r.path[0] : null;
    if (!m) { const ms = usefulK(); m = ms.find(x => x.k !== 'wt' && x.k !== 'wf' || x.card === G.waste[G.waste.length - 1]) || ms[0]; }
    if (!m) return null;
    if ((m.k === 'wt' || m.k === 'wf') && m.card !== G.waste[G.waste.length - 1]) return { stock: true };
    if (m.k === 'tf') return { src: [kTop(m.col)], dst: slots['f' + KL.SU(kTop(m.col))] };
    if (m.k === 'wf') return { src: [m.card], dst: slots['f' + KL.SU(m.card)] };
    if (m.k === 'wt') return { src: [m.card], dst: kTop(m.to) >= 0 ? els[kTop(m.to)] : slots['t' + m.to] };
    if (m.k === 'tt') return { src: G.tab[m.from].c.slice(m.at), dst: kTop(m.to) >= 0 ? els[kTop(m.to)] : slots['t' + m.to] };
  } else {
    const r = SP.search(G.cols, G.stock, G.done.length, G.su, G.rk, 1500, null, true), first = r.path[0];
    let mv = first && first[0] !== 'deal' && (r.win || r.gain > 0) ? first : null;
    if (!mv && !(first && first[0] === 'deal')) { const b = SP.bestMoves(G.cols, G.su, G.rk)[0]; if (b) mv = [b.i, b.k, b.j]; }
    if (mv) { const t = G.cols[mv[2]].c; return { src: G.cols[mv[0]].c.slice(mv[1]), dst: t.length ? els[t[t.length - 1]] : slots['t' + mv[2]] }; }
    if (G.stock.length && SP.canDeal(G.cols, G.stock)) return { stock: true };
  }
  return null;
}
async function hint(user) {
  if (state !== 'play' || finishing) return;
  clearGlow();
  if (user && G.hints >= 3) {   // three free hints per deal; then 10 coins, or a short video
    if (!M.spend(10, 'hint')) { if (!(await M.rewarded('hint', { what: 'One hint for this deal' }))) return; }
  }
  const h = findHint();
  if (!h) { toast(G.kind === 'k' ? 'No helpful moves left. Try Undo.' : 'No helpful moves. Try Undo.'); return; }
  if (user) G.hints++;
  snd.click();
  if (h.stock) { const s = G.kind === 'k' ? (G.stock.length ? els[G.stock[0]] : slots.stock) : els[G.stock[G.stock.length - 1]]; s && s.classList.add('glow'); toast(G.kind === 'k' ? (G.stock.length ? 'Draw from the deck' : 'Turn the deck over') : 'Deal a new row'); }
  else { h.src.forEach(id => els[id] && els[id].classList.add('glow')); h.dst && h.dst.classList.add('glow'); }
  paintHud(); saveCur();
  setTimeout(clearGlow, 2600);
}

// ---------------------------------------------------------------- input: tap or drag
let drag = null;
table.addEventListener('pointerdown', e => {
  if (state !== 'play' || finishing || drag) return;
  const t = e.target.closest('.cd, .slot'); if (!t) return;
  if (t.classList.contains('slot')) { if (t.dataset.slot === 'stock') { G.kind === 'k' ? kDraw() : sDeal(); } return; }
  const id = +t.dataset.id;
  if (G.kind === 'k') {
    const L = kLocate(id);
    if (L.w === 'stock') return void kDraw();
    if (L.w === 'tab' && L.k < G.tab[L.i].d) return;
    if (L.w === 'none' || L.w === 'wasteunder') return;
    drag = { src: L, ids: kIds(L), x0: e.clientX, y0: e.clientY, moved: false, pid: e.pointerId };
  } else {
    const L = sLocate(id);
    if (L.w === 'stock') return void sDeal();
    if (L.w !== 'tab') return;
    const col = sAt(L.i), rs = SP.runStart(col, G.su, G.rk);
    if (L.k < col.d) return;
    if (rs < 0 || L.k < rs) { els[id].classList.remove('shake'); void els[id].offsetWidth; els[id].classList.add('shake'); snd.nope(); return; }
    drag = { src: L, ids: col.c.slice(L.k), x0: e.clientX, y0: e.clientY, moved: false, pid: e.pointerId };
  }
  if (drag && !drag.ids.length) drag = null;
});
addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.pid) return;
  const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
  if (!drag.moved && Math.hypot(dx, dy) < 9) return;
  if (!drag.moved) { drag.moved = true; snd.pick(); drag.ids.forEach((id, q) => { const el = els[id]; el.classList.add('drag', 'lift'); el.style.zIndex = 3000 + q; }); }
  drag.dx = dx; drag.dy = dy;
  drag.ids.forEach(id => { const el = els[id]; el.style.transform = `translate(${el._x + dx}px,${el._y + dy}px)`; });
});
const endDrag = (e, cancel) => {
  if (!drag || (e && e.pointerId !== drag.pid)) return;
  const d = drag; drag = null;
  d.ids.forEach(id => els[id].classList.remove('drag', 'lift'));
  if (state !== 'play') return render();
  if (!d.moved) { if (!cancel) tapMove(d); return; }
  const top = els[d.ids[0]], cx = top._x + d.dx + Lg.cw / 2, cy = top._y + d.dy + Lg.ch * 0.3;
  let ok = false;
  if (G.kind === 'k') {
    if (cy < Lg.tabY - Lg.ch * 0.1 && d.ids.length === 1 && cx > Lg.colX(3) - Lg.gap) ok = kMove(d.src, { w: 'found' });
    else { const i = colAt(cx); if (i >= 0) ok = kMove(d.src, { w: 'tab', i }); }
  } else { const j = colAt(cx); if (j >= 0) ok = sMove(d.src.i, d.src.k, j); }
  if (!ok) { snd.nope(); render(); }
};
addEventListener('pointerup', e => endDrag(e, false));
addEventListener('pointercancel', e => endDrag(e, true));
function colAt(cx) { let best = -1, bd = 1e9; for (let i = 0; i < Lg.nc; i++) { const d = Math.abs(Lg.colX(i) + Lg.cw / 2 - cx); if (d < bd) { bd = d; best = i; } } return bd < Lg.cw * 0.9 ? best : -1; }
function tapMove(d) {
  let ok = false;
  if (G.kind === 'k') { const dst = kBest(d.src); if (dst) ok = kMove(d.src, dst); }
  else { const j = sBest(d.src.i, d.src.k); if (j >= 0) ok = sMove(d.src.i, d.src.k, j); }
  if (!ok) { const el = els[d.ids[0]]; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); snd.nope(); }
}

// ---------------------------------------------------------------- sheets (journey, album, settings, confirm, reveal)
let openSheet = null;
function sheet(html, { onClose } = {}) {
  if (openSheet) openSheet.close(true);
  const w = $(`<div class="sh-wrap"><div class="sh" role="dialog"><button class="sh-x" aria-label="Close"></button>${html}</div></div>`);
  w.addEventListener('pointerdown', e => { e.stopPropagation(); if (e.target === w) close(); });
  w.querySelector('.sh-x').onclick = () => close();
  document.body.appendChild(w); requestAnimationFrame(() => w.classList.add('on'));
  const onKey = e => { if (e.key === 'Escape') close(); }; addEventListener('keydown', onKey);
  function close(silent) { if (!w.isConnected) return; w.remove(); removeEventListener('keydown', onKey); if (openSheet && openSheet.el === w) openSheet = null; if (!silent && onClose) onClose(); }
  openSheet = { el: w, close }; return openSheet;
}
function journey() {
  const cur = chapterOf(P.stars);
  const list = CHAPTERS.map(([img, t, line], i) => {
    const lock = P.stars < NEED[i];
    return `<div class="ch ${lock ? 'lock' : ''}"><div class="pic" style="background-image:url(${A('scenes/' + img)})">${lock ? '<em><i></i></em>' : ''}</div>
      <div><b>${i + 1}. ${t}</b><span>${lock ? `<span class="need">★ ${NEED[i]} to unlock</span>` : line}</span></div></div>`;
  }).join('');
  const s = sheet(`<h2>Teatime Journey</h2><p class="sub">${P.stars} stars · ${cur + 1} of ${CHAPTERS.length} scenes</p><div class="chs">${list}</div>`);
  s.el.querySelectorAll('.ch:not(.lock)').forEach((c, i) => c.onclick = () => reveal(i, true));
}
function album() {
  const cells = STAMPS.map((s, i) => i < P.stamps ? `<div style="background-image:url(${A('stamps/stamp-' + s)})"></div>` : `<div class="no" style="background-image:url(${A('stamps/stamp-' + s)})"></div>`).join('');
  sheet(`<h2>Stamp Album</h2><p class="sub">${P.stamps} of ${STAMPS.length} stamps · one for each deal you solve</p><div class="album">${cells}</div>`);
}
function settings() {
  const row = (k, t, sub) => `<div class="set"><div>${t}${sub ? `<small>${sub}</small>` : ''}</div><button class="tog ${P[k] ? 'on' : ''}" data-k="${k}" aria-label="${t}"></button></div>`;
  const backs = Object.entries(BACKS).map(([k, b]) => `<button class="bkb ${P.back === k ? 'on' : ''}" data-back="${k}"><i style="background-image:url(${A('cards/back-' + k)})"></i><span>${P.backs.includes(k) ? b.name : `<em></em>${b.price}`}</span></button>`).join('');
  const s = sheet(`<h2>Settings</h2><p class="sub">Make the table just right</p>
    ${row('big', 'Larger text', 'Bigger numbers on cards and buttons')}${row('sound', 'Sound', 'Soft plucks and chimes')}${row('music', 'Music', 'A quiet piano in the background')}${row('winnable', 'Winnable deals', 'Every deal checked solvable before you see it')}
    <div class="set" style="border:0;padding-bottom:0"><div>Card backs<small>Buy new backs with coins</small></div></div><div class="backs">${backs}</div>
    <div class="shbtns"><button class="btn" data-shop><i style="background-image:url(${A('icons/shop')})"></i>Coin shop</button></div>
    <p style="margin:14px 4px 0"><b>How to play.</b> Tap a card to send it to its best place, or drag it. Build down in alternating colours (Klondike) or in one suit (Spider). There is no timer: take all the time you like.</p>`);
  const sv = { sound: () => !P.muted, set: {} };
  s.el.querySelectorAll('.tog').forEach(t => {
    const k = t.dataset.k; if (k === 'sound') t.classList.toggle('on', !P.muted);
    t.onclick = () => {
      if (k === 'sound') { P.muted = P.muted ? 0 : 1; snd.muted = !!P.muted; t.classList.toggle('on', !P.muted); }
      else { P[k] = P[k] ? 0 : 1; t.classList.toggle('on', !!P[k]); }
      if (k === 'music') snd.music = !!P.music;
      if (k === 'big') { document.body.classList.toggle('big', !!P.big); layout(); }
      save(); snd.click();
    };
  });
  void sv;
  s.el.querySelectorAll('[data-back]').forEach(b => b.onclick = () => {
    const k = b.dataset.back;
    if (!P.backs.includes(k)) { if (!M.spend(BACKS[k].price, 'card-back')) { toast('Not enough coins yet'); M.shop(); return; } P.backs.push(k); toast(`${BACKS[k].name} back is yours`); }
    P.back = k; save(); paintBacks(); settings();
  });
  s.el.querySelector('[data-shop]').onclick = () => { s.close(true); M.shop(); };
}
function reveal(i, fromList, done) {
  const [img, t, line] = CHAPTERS[i];
  const s = sheet(`<h2>${fromList ? t : 'A new teatime scene'}</h2><p class="sub">${fromList ? line : t}</p><div class="reveal" style="background-image:url(${A('scenes/' + img)})"></div>
    ${fromList ? '' : `<p style="text-align:center;margin:0 0 6px">${line}</p>`}<div class="shbtns"><button class="btn navy" data-ok>Lovely</button></div>`, { onClose: done });
  s.el.querySelector('[data-ok]').onclick = () => s.close();
  if (!fromList) { fx.petals(50); snd.win(); if (BOT()) setTimeout(() => s.close(), 1200); }
  return s;
}
function askNew() {
  if (state !== 'play') return;
  if (G.moves < 3) return newDeal(true);
  const s = sheet(`<h2>Start a new deal?</h2><p class="sub">This deal will be put away.</p><div class="shbtns"><button class="btn navy" data-y>New deal</button><button class="btn" data-n>Keep playing</button></div>`);
  s.el.querySelector('[data-y]').onclick = () => { s.close(true); newDeal(true); };
  s.el.querySelector('[data-n]').onclick = () => s.close(true);
}

// ---------------------------------------------------------------- home screen (the kit start card)
const home = ui.els.start; home.classList.add('home');
function paintHome() {
  const cur = chapterOf(P.stars), nx = cur + 1, [img, t] = CHAPTERS[cur];
  const saved = sget('cur', null), cont = saved && !saved.daily && saved.snap && saved.snap.moves > 0;
  const today = P.daily[dayKey()], dsn = P.ds.last >= dayNum() - 1 ? P.ds.n : 0, freeze = P.ds.fw !== weekOf(dayNum());
  const m = MODES[P.mode];
  home.innerHTML = `<div class="wrap"><h1>Teatime Solitaire</h1><div class="div"></div>
    <div class="scene" style="background-image:url(${A('scenes/' + img)})"><div class="rb"></div></div>
    <div class="prog"><div class="st"></div><div class="bar"><i style="width:${nx < NEED.length ? Math.round(100 * (P.stars - NEED[cur]) / (NEED[nx] - NEED[cur])) : 100}%"></i></div><small>${nx < NEED.length ? `${P.stars} / ${NEED[nx]}` : P.stars}</small></div>
    <div class="lbl">Choose your game</div>
    <div class="rowc">${['k1', 'k3'].map(k => `<button class="chip ${P.mode === k ? 'on' : ''}" data-m="${k}">Klondike ${MODES[k].n}</button>`).join('')}</div>
    <div class="rowc">${['s1', 's2', 's4'].map(k => `<button class="chip ${P.mode === k ? 'on' : ''}" data-m="${k}">Spider ${MODES[k].n}</button>`).join('')}</div>
    <button class="btn navy play" data-play>${D.isDaily ? 'Play the daily deal' : cont && saved.mode === P.mode ? 'Continue' : `Play Deal ${P.level}`}<small>${D.isDaily ? 'Klondike · Draw 1' : `${m.name} · ${m.sub}`}</small></button>
    <div class="icons">
      <button class="ib" data-a="daily"><i style="background-image:url(${A('icons/calendar')})"></i>${today ? 'Daily ✓' : 'Daily'}</button>
      <button class="ib" data-a="journey"><i style="background-image:url(${A('icons/star')})"></i>Journey</button>
      <button class="ib" data-a="album"><i style="background-image:url(${A('icons/album')})"></i>Album</button>
      <button class="ib" data-a="settings"><i style="background-image:url(${A('icons/settings')})"></i>Settings</button></div>
    ${dsn ? `<div class="lbl" style="display:flex;align-items:center;gap:6px"><i style="width:30px;height:30px;background:url(${A('icons/streak')}) center/contain"></i>${dsn}-day daily streak${freeze ? ' · freeze ready' : ''}</div>` : ''}
  </div>`;
  home.querySelector('.rb').textContent = `${cur + 1} · ${t}`;
  home.querySelectorAll('button:not([data-play])').forEach(b => b.addEventListener('pointerdown', e => e.stopPropagation()));
  home.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { P.mode = b.dataset.m; save(); snd.click(); paintHome(); });
  home.querySelector('[data-a="daily"]').onclick = () => { snd.click(); home.classList.add('hc-hidden'); playDaily(); };
  home.querySelector('[data-a="journey"]').onclick = () => { snd.click(); journey(); };
  home.querySelector('[data-a="album"]').onclick = () => { snd.click(); album(); };
  home.querySelector('[data-a="settings"]').onclick = () => { snd.click(); settings(); };
  bar.style.visibility = 'hidden'; hdr.style.visibility = 'hidden'; finBtn.hidden = true;
}
function goHome() { if (state === 'play') saveCur(); state = 'ready'; clearGlow(); paintHome(); ui.start(); }
function playDaily() {
  const pick = pickDeal('k1', true);
  startDeal({ mode: 'k1', seed: pick.seed, daily: true, checked: pick.checked });
  enterPlay();
}
function newDeal(skip) {
  if (skip && G && !G.daily && !recorded && G.moves > 5) { recorded = true; F.level(false, cleared()); }
  if (skip) { P.skip++; save(); }
  const pick = pickDeal(P.mode, false);
  startDeal({ mode: P.mode, seed: pick.seed, hard: pick.hard, checked: pick.checked });
  enterPlay();
  if (pick.hard && !BOT()) toast('A hard deal: double stars and coins');
}
function enterPlay() { state = 'play'; bar.style.visibility = ''; hdr.style.visibility = ''; B.start(); checkFinish(); checkEnd(); }

ui.onTap(async (which) => {
  if (which === 'start') {
    if (D.isDaily) return playDaily();
    const saved = sget('cur', null);
    if (G && !G.daily && G.mode === P.mode && G.level === P.level) return enterPlay();
    if (saved && !saved.daily && saved.mode === P.mode && saved.level === P.level && saved.snap) { startDeal({ ...saved }); return enterPlay(); }
    return newDeal(false);
  }
  if (which === 'lose') {   // the same deal again, from the start
    startDeal({ mode: G.mode, seed: G.seed, daily: G.daily, hard: G.hard, checked: G.checked, level: G.level }); recorded = true; return enterPlay();
  }
  if (which === 'win') {
    const info = winInfo;
    if (info && info.reveal) { P.chapter = info.reveal; save(); await new Promise(r => reveal(info.reveal, false, r)); }
    if (info && info.daily) return goHome();
    await M.breakAd('level-end', { level: P.level - 1 });
    newDeal(false);
  }
});

// ---------------------------------------------------------------- boot
layout();
paintHome();
// a deal waiting behind the home screen so the table is never empty
{ const saved = sget('cur', null); if (saved && saved.snap && !saved.daily) { try { startDeal({ ...saved }); } catch (e) { sset('cur', null); } } }
state = 'ready';
bar.style.visibility = 'hidden'; hdr.style.visibility = 'hidden';

// ---------------------------------------------------------------- test hook: the bot follows a solver line at a human pace
let botT = 0; const botSeen = new Map();
window.__game = {
  get state() { return state === 'finale' ? 'play' : state === 'ready' ? 'ready' : state; }, get level() { return P.level; }, get score() { return P.stars; },
  bot() {
    lastBot = performance.now();
    if (state !== 'play' || finishing || drag || openSheet) return;
    if (performance.now() - botT < 90) return; botT = performance.now();
    if (finishable) return void autoFinish();
    // bot only: a random (unchecked) deal can cycle forever; after a position repeats a few times it asks for a new deal
    const hk = JSON.stringify(snapshot()).replace(/"moves":\d+,"hints":\d+/, ''); botSeen.set(hk, (botSeen.get(hk) || 0) + 1);
    if (botSeen.get(hk) > 4) { botSeen.clear(); return void newDeal(true); }
    if (G.kind === 'k') {
      const T = G.waste.concat(G.stock), f = G.found.map(x => x.length);
      const valid = m => {
        if (!m) return false;
        if (m.k === 'tf') return kTop(m.col) >= 0 && kCanF(kTop(m.col));
        if (m.k === 'wf') return T.includes(m.card) && kCanF(m.card);
        if (m.k === 'wt') return T.includes(m.card) && kCanT(m.card, m.to);
        if (m.k === 'tt') { const col = G.tab[m.from], c = col.c[m.at]; return c !== undefined && m.at >= col.d && kCanT(c, m.to); }
      };
      if (!plan || !valid(plan[0])) { const r = KL.solve(G.tab, T, f, G.n, 30000, G.waste.length); plan = r.ok ? r.path.slice() : null; }
      let m = plan && plan[0];
      if (!m) { const ms = usefulK(); m = ms[0]; if (!m) return void kDraw(); }
      const wt = G.waste.length ? G.waste[G.waste.length - 1] : -1;
      if ((m.k === 'wf' || m.k === 'wt') && m.card !== wt) return void kDraw();
      if (plan) plan.shift();
      if (m.k === 'tf') return void kMove({ w: 'tab', i: m.col, k: G.tab[m.col].c.length - 1 }, { w: 'found' });
      if (m.k === 'wf') return void kMove({ w: 'waste' }, { w: 'found' });
      if (m.k === 'wt') return void kMove({ w: 'waste' }, { w: 'tab', i: m.to });
      if (m.k === 'tt') return void kMove({ w: 'tab', i: m.from, k: m.at }, { w: 'tab', i: m.to });
    } else {
      if (!plan || plan.idx >= plan.path.length || (!plan.win && plan.idx >= 6)) {
        const r = SP.search(G.cols, G.stock, G.done.length, G.su, G.rk, 2000, null, true);
        plan = r.path.length ? { path: r.path, idx: 0, win: r.win } : null;
      }
      const m = plan && plan.path[plan.idx];
      if (m) { plan.idx++; if (m[0] === 'deal') return void sDeal(); if (SP.canDrop(G.cols, m[0], m[1], m[2], G.su, G.rk)) return void sMove(m[0], m[1], m[2]); plan = null; return; }
      if (SP.canDeal(G.cols, G.stock)) return void sDeal();
    }
  },
};
