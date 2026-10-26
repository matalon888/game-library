// Tidebloom — original merge-2 seaside town. Tap a generator to make an item, drag two alike together to merge
// them into the next tier, and hand the finished pieces to the villagers to rebuild their little harbour town.
// Energy is earned by playing (deliveries and big merges), never by waiting or paying.
import { createUI, store, buzz, note, tone, sfx } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { fx2d, startCard, cardTheme, arp, chime, soft } from './calm.js';
import { CHAINS, KINDS, itemBitmap, VILLAGERS, drawVillager, drawProp, PROP_KEYS } from './art.js';

const NAME = 'Tidebloom: Merge Seaside Town';
const S = store('tidebloom');
const F = flow('tidebloom');
const ui = createUI({ title: 'Tidebloom', hint: 'Tap to play', hand: '', score: false });
const D = daily('tidebloom', ui, { name: NAME });
const B = board({ game: 'tidebloom', label: 'Orders delivered', limits: { maxRun: 3, maxPerSec: 3 }, mode: 'sum', corner: 'tl' });
cardTheme({ accent: '#2a9dc8', font: "'Baloo 2',system-ui,sans-serif", serif: "'Baloo 2',system-ui,sans-serif" });
startCard(ui, D, { kicker: 'Merge · Deliver · Rebuild' });
const fx = fx2d(9);
const css = document.createElement('style'); css.textContent = `
  body{--ui:#2a9dc8;background:#bfe9f7}
  .hc-card{background:linear-gradient(180deg,rgba(18,70,100,.55),rgba(18,70,100,.72));-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
  .hc-card h1{text-shadow:0 5px 0 #13658c,0 10px 24px rgba(0,40,70,.35)}
  .hc-card p,.hc-card .hint{text-shadow:0 2px 0 rgba(0,50,80,.45)}
  .hc-pop{-webkit-text-stroke:2px rgba(20,70,100,.55);paint-order:stroke fill}
  .calm-kicker{font-size:13px!important;letter-spacing:3px!important;text-transform:uppercase;opacity:.85}
  .hc-top{top:calc(18px + env(safe-area-inset-top))}`;
document.head.appendChild(css);
ui.els.win.querySelector('h1').textContent = 'RESTORED!';

const cv = document.createElement('canvas'); cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;touch-action:none'; document.body.prepend(cv);
const g = cv.getContext('2d');
const COLS = 7, ROWS = 8, MAXE = 60;
const AREAS = ['Harbour Steps', 'Shell Beach', 'Lemon Point', 'Coral Cove', 'Lighthouse Hill', 'Sunset Pier', 'Gull Rock', 'Palm Bay'];
const TOWN_COLS = [{ wall: '#ffe3c6', roof: '#ff7a5c', acc: '#3fa9f5' }, { wall: '#d6f5ff', roof: '#2a9dc8', acc: '#ff7aa2' }, { wall: '#fff3c4', roof: '#52b788', acc: '#ff8a3c' }, { wall: '#ffe0ef', roof: '#b48cff', acc: '#ffd23f' }];

// ---------------------------------------------------------------- state
let level = S.get('level', 1), total = S.get('total', 0);
let state = 'ready', cells, orders, delivered = 0, needed = 4, energy = 50, rand, fk = 1, recorded = false, beatenShown = false, sel = null, nextId = 1;
let pieces = [], kinds = [], orderSeq = 0, t0run = performance.now(), mergesN = 0;
const fly = [];
const now = () => performance.now();
function mkRand(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const ri = (a, b) => a + Math.floor(rand() * (b - a + 1));
const item = (kind, tier, gen = false) => ({ id: nextId++, kind, tier, gen, x: null, y: null, born: now() });

function areaLevel() { return D.isDaily ? 4 : level; }
function buildArea(fresh = true) {
  const L = areaLevel(); fk = F.k();
  rand = mkRand(D.seed ? D.seed * 31 + 7 : level * 7919 + 13 + (fresh ? 0 : 0));
  kinds = L >= 2 ? KINDS.slice(0, 4) : KINDS.slice(0, 3);
  needed = Math.min(10, 3 + L) + (D.isDaily ? 1 : 0);
  pieces = Array.from({ length: needed }, (_, i) => ({ key: PROP_KEYS[(i * 5 + L * 3) % PROP_KEYS.length], col: TOWN_COLS[(i + L) % TOWN_COLS.length], pop: 0 }));
  const saved = !D.isDaily && S.get('save', null);
  if (saved && saved.level === level && !fresh) {
    cells = saved.cells.map(row => row.map(c => c ? item(c[0], c[1], !!c[2]) : null));
    orders = saved.orders.map(o => ({ ...o, ready: false, wig: 0, born: now() })); delivered = saved.delivered; energy = saved.energy; orderSeq = saved.orderSeq || 0;
  } else {
    cells = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    const gpos = [[ROWS - 1, 1], [ROWS - 1, 3], [ROWS - 1, 5], [ROWS - 2, 3]];
    kinds.forEach((k, i) => { const [r, c] = gpos[i]; cells[r][c] = item(k, 0, true); });
    for (let i = 0; i < 16; i++) { const r = ri(0, ROWS - 3), c = ri(0, COLS - 1); if (!cells[r][c]) cells[r][c] = item(kinds[i % kinds.length], [0, 0, 0, 1, 1, 2][ri(0, 5)]); }
    delivered = 0; energy = Math.round(50 / Math.min(1.3, fk)); orders = []; orderSeq = 0;
    for (let i = 0; i < 3; i++) newOrder();
  }
  for (let i = 0; i < pieces.length; i++) pieces[i].pop = i < delivered ? 1 : 0;
  recorded = false; sel = null; fly.length = 0; t0run = now();
  ui.levels(D.isDaily ? 1 : level); ui.progress(delivered / needed);
  layout(); save();
}
function newOrder() {
  if (delivered + orders.length >= needed) return;
  const L = areaLevel(), n = orderSeq++;
  const maxT = Math.max(1, Math.min(6, Math.round((1.4 + L * 0.55) * fk))), minT = Math.max(1, maxT - 2);
  const two = n >= 2 && rand() < Math.min(0.65, 0.3 + L * 0.06);
  const need = []; const k1 = kinds[ri(0, kinds.length - 1)];
  need.push({ kind: k1, tier: n < 2 ? Math.min(maxT, 1 + n) : ri(minT, maxT) });
  if (two) { let k2 = kinds[ri(0, kinds.length - 1)]; if (k2 === k1) k2 = kinds[(kinds.indexOf(k1) + 1) % kinds.length]; need.push({ kind: k2, tier: Math.max(1, ri(minT, maxT) - 1) }); }
  const cost = need.reduce((a, q) => a + (1 << q.tier), 0);
  const used = new Set(orders.map(o => o.v));
  let v = (n * 2 + L) % VILLAGERS.length; while (used.has(v)) v = (v + 1) % VILLAGERS.length;
  orders.push({ v, need, reward: Math.round(cost * 0.75) + 4, ready: false, wig: 0, born: now() });
}

// ---------------------------------------------------------------- save
let saveT = 0;
function save() {
  if (D.isDaily) return; clearTimeout(saveT);
  saveT = setTimeout(() => S.set('save', { level, delivered, energy, orderSeq, cells: cells.map(row => row.map(c => c ? [c.kind, c.tier, c.gen ? 1 : 0] : null)), orders: orders.map(o => ({ v: o.v, need: o.need, reward: o.reward })) }), 300);
}

// ---------------------------------------------------------------- layout
let W, H, X0, cell, BX, BY, TOWN, ORD, BIN, dpr = 1;
function layout() {
  dpr = Math.min(devicePixelRatio || 1, 2); cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  W = Math.min(innerWidth, 460); H = innerHeight; X0 = (innerWidth - W) / 2;
  const top = 62, cw = Math.floor(Math.min((W - 16) / COLS, (H - 62 - 150 - 74 - 12 - 88) / ROWS)), townH = Math.max(96, Math.min(240, H - top - 74 - 12 - cw * ROWS - 64 - 24));
  TOWN = { x: X0, y: 0, w: W, h: top + townH };
  ORD = { x: X0 + 8, y: top + townH - 30, w: W - 16, h: 104 };
  const by0 = ORD.y + ORD.h + 12, bottomH = 64;
  cell = Math.floor(Math.min(cw, (H - by0 - bottomH - 8) / ROWS));
  BX = X0 + (W - cell * COLS) / 2; BY = by0;
  BIN = { x: BX + cell * COLS - 54, y: BY + cell * ROWS + 8, w: 54, h: 50 };
}
addEventListener('resize', layout);
const cellAt = (px, py) => { const c = Math.floor((px - BX) / cell), r = Math.floor((py - BY) / cell); return r >= 0 && r < ROWS && c >= 0 && c < COLS ? [r, c] : null; };
const cxy = (r, c) => [BX + c * cell + cell / 2, BY + r * cell + cell / 2];
function orderRect(i) { const w = (ORD.w - 16) / 3; return { x: ORD.x + i * (w + 8), y: ORD.y, w, h: ORD.h }; }

// ---------------------------------------------------------------- rules
function each(fn) { for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (cells[r][c]) fn(cells[r][c], r, c); }
function find(kind, tier, skip = new Set()) { let hit = null; each((it, r, c) => { if (!hit && !it.gen && it.kind === kind && it.tier === tier && !skip.has(it.id)) hit = [it, r, c]; }); return hit; }
function readyItems(o) { const skip = new Set(), got = []; for (const q of o.need) { const h = find(q.kind, q.tier, skip); if (!h) return null; skip.add(h[0].id); got.push(h); } return got; }
function emptyNear(r0, c0) {
  let best = null, bd = 1e9;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (!cells[r][c]) { const d = Math.hypot(r - r0, (c - c0) * 1.05) + r * 0.001; if (d < bd) { bd = d; best = [r, c]; } }
  return best;
}
function neededCount(kind, tier) { let n = 0; for (const o of orders) for (const q of o.need) if (q.kind === kind && q.tier === tier) n++; return n; }
function tapGen(r, c) {
  const it = cells[r][c];
  if (energy < 1) { ui.pop('Out of ⚡ — deliver an order!', '#fff', 22, 40); soft.err(); buzz(20); it.wig = now(); return false; }
  const e = emptyNear(r, c);
  if (!e) { ui.pop('Board is full!', '#fff', 26, 40); soft.err(); it.wig = now(); return false; }
  energy--; const tier = rand() < 0.18 ? 1 : 0, n = item(it.kind, tier); const [x0, y0] = cxy(r, c);
  n.x = x0; n.y = y0; n.hop = now(); cells[e[0]][e[1]] = n; it.pop = now();
  tone(420 + tier * 120, 0.07, 'triangle', 0.1, 1.5); buzz(8); save(); return true;
}
function merge(a, ar, ac, br, bc) {
  const b = cells[br][bc]; const tier = b.tier + 1; cells[ar][ac] = null;
  const m = item(b.kind, tier); m.x = cxy(br, bc)[0]; m.y = cxy(br, bc)[1]; m.pop = now(); cells[br][bc] = m;
  const [x, y] = cxy(br, bc); fx.ring(x, y, '#fff', cell * 0.5); fx.sparks(x, y, ['#fff', '#ffe36a', CHAINS[b.kind].color], 10 + tier * 2, { speed: 3 + tier * 0.3, size: 3 });
  chime(tier + 2, 67, 0.12); buzz(12); mergesN++;
  if (tier >= 4) { energy = Math.min(99, energy + tier - 2); ui.pop(`${CHAINS[b.kind].names[tier]}! ⚡+${tier - 2}`, '#fff', 26, 46); }
  if (tier === 8) { fx.confetti(70); arp([72, 76, 79, 84], 90, 0.12); }
  sel = { r: br, c: bc }; save();
}
function deliver(i) {
  const o = orders[i]; if (o.done) return true; const got = readyItems(o); if (!got) return false;
  const R = orderRect(i);
  for (const [it, r, c] of got) { cells[r][c] = null; const [x, y] = cxy(r, c); fly.push({ bmp: itemBitmap(it.kind, it.tier, 128), x0: x, y0: y, x1: R.x + R.w / 2, y1: R.y + 30, t0: now(), dur: 420 }); }
  sel = null; energy = Math.min(99, energy + o.reward); delivered++; total++; S.set('total', total);
  B.submit(1, { ms: Math.max(400, now() - t0run) }); t0run = now();
  const pc = pieces[delivered - 1]; if (pc) pc.popT = now() + 380;
  setTimeout(() => { const P = pieceXY(delivered - 1); fx.sparks(P[0], P[1] - 30, ['#fff', '#ffd23f', '#ff7aa2', '#3fa9f5'], 26, { speed: 4.5, size: 4 }); fx.ring(P[0], P[1] - 24, '#fff', 40); }, 380);
  o.done = now(); arp([76, 79, 84], 70, 0.12); sfx.coin(); buzz([10, 30, 14]);
  ui.pop(`Thank you! ⚡+${o.reward}`, '#fff', 28, 34); ui.progress(delivered / needed);
  if (!beatenShown && D.beaten(total)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); fx.confetti(60); }
  setTimeout(() => { orders.splice(orders.indexOf(o), 1); newOrder(); save(); if (delivered >= needed) win(); }, 600);
  save(); return true;
}
function recycle(r, c) {
  const it = cells[r][c]; if (!it || it.gen) return;
  const back = it.tier >= 1 ? 1 << (it.tier - 1) : 0; cells[r][c] = null; energy = Math.min(99, energy + back);
  fx.sparks(BIN.x + BIN.w / 2, BIN.y + 20, ['#fff', '#9be7ff'], 10, { speed: 3 }); soft.swish(); ui.pop(back ? `Recycled ⚡+${back}` : 'Recycled', '#fff', 22, 46); sel = null; save();
}
function stuck() {
  if (energy >= 1 || state !== 'play') return false;
  if (orders.some(o => readyItems(o))) return false;
  const seen = new Set(); let pair = false, worth = false;
  each(it => { if (it.gen) return; const k = it.kind + it.tier; if (seen.has(k) && it.tier < 8) pair = true; seen.add(k); if (it.tier >= 1) worth = true; });
  return !pair && !worth;
}
function win() {
  if (state !== 'play') return; state = 'won';
  if (!recorded) { recorded = true; if (!D.isDaily) F.level(true); }
  fx.confetti(140); sfx.win(); buzz([20, 40, 20]);
  D.won(total, 'delivered');
  const nm = D.isDaily ? 'Daily island' : AREAS[(level - 1) % AREAS.length];
  if (!D.isDaily) { level++; S.set('level', level); S.set('save', null); }
  ui.win(D.isDaily ? 'DAILY' : level - 1, `${nm} is rebuilt · ${total} orders delivered`);
}
function lose() {
  if (state !== 'play') return; state = 'lost';
  if (!recorded) { recorded = true; if (!D.isDaily) F.level(false, delivered / needed); }
  sfx.fail(); S.set('save', null); ui.lose('OUT OF STEAM', 'No energy and nothing left to merge. Try the area again!');
}

// ---------------------------------------------------------------- input
let drag = null;
cv.addEventListener('pointerdown', e => {
  if (state !== 'play') return; const px = e.clientX, py = e.clientY;
  for (let i = 0; i < orders.length; i++) { const R = orderRect(i); if (px > R.x && px < R.x + R.w && py > R.y && py < R.y + R.h) { if (!deliver(i)) { orders[i].wig = now(); soft.click(); const q = orders[i].need.find(q => !find(q.kind, q.tier)) || orders[i].need[0]; ui.pop(`Needs ${CHAINS[q.kind].names[q.tier]}`, '#fff', 22, 40); } return; } }
  const rc = cellAt(px, py); if (!rc) return; const it = cells[rc[0]][rc[1]]; if (!it) { sel = null; return; }
  drag = { it, r: rc[0], c: rc[1], sx: px, sy: py, x: px, y: py, moved: false }; cv.setPointerCapture(e.pointerId);
});
cv.addEventListener('pointermove', e => { if (!drag) return; drag.x = e.clientX; drag.y = e.clientY; if (Math.hypot(drag.x - drag.sx, drag.y - drag.sy) > 8 && !drag.moved) { drag.moved = true; sel = { r: drag.r, c: drag.c }; soft.click(); } });
cv.addEventListener('pointerup', e => {
  if (!drag) return; const d = drag; drag = null; if (state !== 'play') return;
  if (!d.moved) { if (d.it.gen) tapGen(d.r, d.c); else { sel = { r: d.r, c: d.c }; d.it.pop = now(); tone(600 + d.it.tier * 50, 0.05, 'sine', 0.08, 1.2); } return; }
  const px = e.clientX, py = e.clientY;
  if (px > BIN.x - 6 && px < BIN.x + BIN.w + 6 && py > BIN.y - 6 && py < BIN.y + BIN.h + 6) { recycle(d.r, d.c); return; }
  const rc = cellAt(px, py); d.it.x = px; d.it.y = py;
  if (!rc || (rc[0] === d.r && rc[1] === d.c)) return;
  const tgt = cells[rc[0]][rc[1]];
  if (tgt && !tgt.gen && !d.it.gen && tgt.kind === d.it.kind && tgt.tier === d.it.tier && tgt.tier < 8) { merge(d.it, d.r, d.c, rc[0], rc[1]); return; }
  cells[d.r][d.c] = tgt || null; cells[rc[0]][rc[1]] = d.it; sel = { r: rc[0], c: rc[1] }; soft.wood(); save();
});

// ---------------------------------------------------------------- drawing
const FONT = (w, s) => `${w} ${s}px "Baloo 2",system-ui,sans-serif`;
function pieceXY(i) { const n = pieces.length, w = TOWN.w - 40; return [TOWN.x + 20 + w * ((i + 0.5) / n), TOWN.h - 40 - (i % 2) * 12]; }
function drawTown(t) {
  const { x, w, h } = TOWN;
  let gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#7fd0f5'); gr.addColorStop(0.55, '#c9efff'); gr.addColorStop(1, '#e9f9ff'); g.fillStyle = gr; g.fillRect(0, 0, innerWidth, h);
  g.fillStyle = 'rgba(255,255,255,.75)'; for (let i = 0; i < 4; i++) { const cx = ((i * 137 + t * 6) % (innerWidth + 160)) - 80, cy = 30 + (i % 2) * 22; g.beginPath(); g.ellipse(cx, cy, 34, 10, 0, 0, 7); g.ellipse(cx + 18, cy - 7, 20, 10, 0, 0, 7); g.fill(); }
  const sea = h - Math.max(70, h * 0.42); gr = g.createLinearGradient(0, sea, 0, h); gr.addColorStop(0, '#3db7e4'); gr.addColorStop(1, '#7fd8f2'); g.fillStyle = gr; g.fillRect(0, sea, innerWidth, h - sea);
  g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2; for (let k = 0; k < 3; k++) { g.beginPath(); for (let px = 0; px <= innerWidth; px += 8) g.lineTo(px, sea + 8 + k * 9 + Math.sin(px * 0.05 + t * 2 + k) * 2); g.stroke(); }
  g.fillStyle = '#f7e2b5'; g.beginPath(); g.moveTo(0, h - 58); for (let px = 0; px <= innerWidth; px += 10) g.lineTo(px, h - 62 + Math.sin(px * 0.03) * 5); g.lineTo(innerWidth, h); g.lineTo(0, h); g.fill();
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i], [px, py] = pieceXY(i), on = i < delivered && (!p.popT || now() > p.popT);
    let s = Math.min(0.85, Math.max(0.5, (h - 70) / 120), w / pieces.length / 80);
    if (on && p.popT) { const k = (now() - p.popT) / 1000; if (k < 1) s *= 1 + Math.sin(k * 14) * Math.exp(-k * 5) * 0.4; }
    drawProp(g, p.key, px, py, s, p.col, on ? 0 : 1);
  }
  g.font = FONT(800, 14); g.textAlign = 'left'; g.fillStyle = 'rgba(255,255,255,.92)'; g.strokeStyle = 'rgba(20,90,130,.45)'; g.lineWidth = 3;
  const an = '🏝 ' + (D.isDaily ? 'Daily island' : AREAS[(level - 1) % AREAS.length]).toUpperCase(); g.strokeText(an, x + 14, 84); g.fillText(an, x + 14, 84);
}
function pill(x, y, w, h, bg, txt, icon) { g.fillStyle = bg; g.beginPath(); g.roundRect(x, y, w, h, h / 2); g.fill(); g.fillStyle = '#fff'; g.font = FONT(800, 19); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(icon + ' ' + txt, x + w / 2, y + h / 2 + 1); g.textBaseline = 'alphabetic'; }
function drawOrders(t) {
  for (let i = 0; i < 3; i++) {
    const o = orders[i], R = orderRect(i); if (!o) continue;
    const ready = !!readyItems(o); o.ready = ready;
    const ap = Math.min(1, (now() - o.born) / 350), done = o.done ? Math.min(1, (now() - o.done) / 500) : 0;
    const wig = o.wig ? Math.sin((now() - o.wig) / 30) * Math.exp(-(now() - o.wig) / 200) * 6 : 0;
    g.save(); g.translate(R.x + R.w / 2 + wig, R.y + R.h / 2); const sc = (0.6 + 0.4 * (1 - Math.pow(1 - ap, 3))) * (1 - done * 0.3); g.scale(sc, sc); g.globalAlpha = 1 - done; g.translate(-R.w / 2, -R.h / 2);
    g.fillStyle = 'rgba(20,60,90,.18)'; g.beginPath(); g.roundRect(0, 5, R.w, R.h, 16); g.fill();
    g.fillStyle = ready ? '#eaffd9' : '#fffaf0'; g.beginPath(); g.roundRect(0, 0, R.w, R.h, 16); g.fill();
    g.lineWidth = 3; g.strokeStyle = ready ? '#5bc95b' : '#f1d9b0'; g.stroke();
    drawVillager(g, VILLAGERS[o.v], 24, 26, 15, ready || done ? 1 : 0);
    g.font = FONT(800, 12); g.fillStyle = '#7a5a3a'; g.textAlign = 'left'; g.fillText(VILLAGERS[o.v].name, 44, 20);
    g.fillStyle = '#2a9dc8'; g.fillText('⚡+' + o.reward, 44, 35);
    const n = o.need.length, isz = Math.min(44, (R.w - 12) / n - 4);
    o.need.forEach((q, k) => {
      const ix = (R.w - n * isz - (n - 1) * 4) / 2 + k * (isz + 4), iy = R.h - isz - 8;
      g.fillStyle = '#f3e6cf'; g.beginPath(); g.roundRect(ix, iy, isz, isz, 10); g.fill();
      g.drawImage(itemBitmap(q.kind, q.tier, 128), ix + 2, iy + 2, isz - 4, isz - 4);
      if (find(q.kind, q.tier)) { g.fillStyle = '#5bc95b'; g.beginPath(); g.arc(ix + isz - 4, iy + 6, 8, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(ix + isz - 8, iy + 6); g.lineTo(ix + isz - 5, iy + 9); g.lineTo(ix + isz, iy + 3); g.stroke(); }
    });
    if (ready) { const pulse = 1 + Math.sin(t * 6) * 0.06; g.save(); g.translate(R.w - 22, 22); g.scale(pulse, pulse); g.fillStyle = '#5bc95b'; g.beginPath(); g.roundRect(-20, -12, 40, 24, 12); g.fill(); g.fillStyle = '#fff'; g.font = FONT(800, 13); g.textAlign = 'center'; g.fillText('GIVE', 0, 5); g.restore(); }
    g.restore();
  }
}
function itemScale(it) { if (!it.pop) return 1; const k = (now() - it.pop) / 1000; return k > 0.8 ? 1 : 1 + Math.sin(k * 18) * Math.exp(-k * 6) * 0.3; }
function drawBoard(t) {
  const bw = cell * COLS, bh = cell * ROWS;
  g.fillStyle = 'rgba(120,80,40,.18)'; g.beginPath(); g.roundRect(BX - 6, BY - 2, bw + 12, bh + 12, 18); g.fill();
  g.fillStyle = '#f6e3bd'; g.beginPath(); g.roundRect(BX - 6, BY - 6, bw + 12, bh + 12, 18); g.fill();
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { g.fillStyle = (r + c) % 2 ? '#fbeed2' : '#f3dfb6'; g.beginPath(); g.roundRect(BX + c * cell + 1.5, BY + r * cell + 1.5, cell - 3, cell - 3, 8); g.fill(); }
  const held = drag && drag.moved ? drag.it : null, selIt = sel && cells[sel.r] && cells[sel.r][sel.c];
  // glow on items that can merge with the one you hold / selected
  const ref = held || selIt;
  if (ref && !ref.gen) each((it, r, c) => { if (it !== ref && !it.gen && it.kind === ref.kind && it.tier === ref.tier && it.tier < 8) { const [x, y] = cxy(r, c); g.fillStyle = `rgba(255,255,255,${0.45 + Math.sin(t * 8) * 0.25})`; g.beginPath(); g.roundRect(x - cell / 2 + 2, y - cell / 2 + 2, cell - 4, cell - 4, 9); g.fill(); } });
  if (selIt) { const [x, y] = cxy(sel.r, sel.c); g.strokeStyle = '#2a9dc8'; g.lineWidth = 3; g.beginPath(); g.roundRect(x - cell / 2 + 2, y - cell / 2 + 2, cell - 4, cell - 4, 9); g.stroke(); }
  each((it, r, c) => {
    if (it === held) return; const [tx, ty] = cxy(r, c);
    if (it.x === null) { it.x = tx; it.y = ty; }
    it.x += (tx - it.x) * 0.28; it.y += (ty - it.y) * 0.28;
    let hop = 0; if (it.hop) { const k = Math.min(1, (now() - it.hop) / 300); hop = Math.sin(k * Math.PI) * cell * 0.5; }
    let s = itemScale(it) * (it.gen ? 1 : 0.9);
    if (it.wig) { const k = (now() - it.wig) / 1000; if (k < 0.5) s *= 1 + Math.sin(k * 40) * 0.05; }
    if (it.gen) { g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.roundRect(tx - cell / 2 + 3, ty - cell / 2 + 3, cell - 6, cell - 6, 10); g.fill(); s *= 1 + Math.sin(t * 3 + c) * 0.02; }
    const sz = cell * s; g.drawImage(itemBitmap(it.kind, it.tier, 128, it.gen), it.x - sz / 2, it.y - sz / 2 - hop, sz, sz);
    if (it.gen) { g.fillStyle = '#2a9dc8'; g.beginPath(); g.arc(tx + cell * 0.32, ty - cell * 0.32, 9, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = FONT(800, 11); g.textAlign = 'center'; g.fillText('⚡', tx + cell * 0.32, ty - cell * 0.32 + 4); }
    else if (neededCount(it.kind, it.tier)) { g.fillStyle = '#5bc95b'; g.beginPath(); g.arc(tx + cell * 0.33, ty - cell * 0.33, 7, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(tx + cell * 0.33 - 3.5, ty - cell * 0.33); g.lineTo(tx + cell * 0.33 - 0.5, ty - cell * 0.33 + 3); g.lineTo(tx + cell * 0.33 + 4, ty - cell * 0.33 - 3); g.stroke(); }
  });
  // bottom bar: selected item info + recycle bin
  const iy = BY + bh + 8; g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.roundRect(BX - 6, iy, bw + 12 - BIN.w - 10, 50, 14); g.fill();
  g.textAlign = 'left'; g.fillStyle = '#4b3527';
  const info = ref || null;
  if (info) {
    g.drawImage(itemBitmap(info.kind, info.tier, 128, info.gen), BX, iy + 3, 44, 44);
    const nm = info.gen ? CHAINS[info.kind].gen : CHAINS[info.kind].names[info.tier];
    g.font = FONT(800, 16); g.fillText(nm + (info.gen ? '' : `  ·  Lv ${info.tier + 1}/9`), BX + 50, iy + 22);
    g.font = FONT(600, 13); g.fillStyle = '#8a6a4a';
    g.fillText(info.gen ? `Tap to make ${CHAINS[info.kind].names[0].toLowerCase()}s · costs ⚡1` : info.tier < 8 ? `Merge two to make ${CHAINS[info.kind].names[info.tier + 1]}` : 'Top of the chain!', BX + 50, iy + 40);
  } else { g.font = FONT(800, 15); g.fillText('Tap a crate · drag two alike together', BX + 6, iy + 22); g.font = FONT(600, 13); g.fillStyle = '#8a6a4a'; g.fillText('Fill the orders above to rebuild the town', BX + 6, iy + 40); }
  const over = held && drag.x > BIN.x - 6 && drag.y > BIN.y - 6;
  g.fillStyle = over ? '#ffd6d6' : 'rgba(255,255,255,.75)'; g.beginPath(); g.roundRect(BIN.x, BIN.y, BIN.w, BIN.h, 14); g.fill();
  g.font = '24px system-ui'; g.textAlign = 'center'; g.fillText('♻️', BIN.x + BIN.w / 2, BIN.y + 32);
  if (held) { const sz = cell * 1.12; g.globalAlpha = 0.95; g.drawImage(itemBitmap(held.kind, held.tier, 128, held.gen), drag.x - sz / 2, drag.y - sz / 2 - 10, sz, sz); g.globalAlpha = 1; }
  for (let i = fly.length - 1; i >= 0; i--) {
    const f = fly[i], k = Math.min(1, (now() - f.t0) / f.dur), e = k * k * (3 - 2 * k), x = f.x0 + (f.x1 - f.x0) * e, y = f.y0 + (f.y1 - f.y0) * e - Math.sin(k * Math.PI) * 80, sz = cell * (1 - k * 0.5);
    g.drawImage(f.bmp, x - sz / 2, y - sz / 2, sz, sz); if (k >= 1) fly.splice(i, 1);
  }
}
function frame() {
  const t = now() / 1000;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const gr = g.createLinearGradient(0, 0, 0, innerHeight); gr.addColorStop(0, '#bfe9f7'); gr.addColorStop(1, '#ffe9c9'); g.fillStyle = gr; g.fillRect(0, 0, innerWidth, innerHeight);
  if (cells) { drawTown(t); drawOrders(t); drawBoard(t);
    pill(X0 + W - 92, 62, 82, 32, energy < 1 ? '#e2574c' : '#2a9dc8', Math.floor(energy), '⚡');
    if (state === 'play' && stuck()) lose();
  }
  requestAnimationFrame(frame);
}

ui.onTap(w => {
  B.start(); t0run = now();
  if (w === 'win' && D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
  if (w === 'start') { state = 'play'; return; }
  buildArea(true); state = 'play';
});
buildArea(false);
frame();
ui.start();
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): in the first area, until the first
// touch, a generator pops out two items (the energy is given back), then two matching spare items merge into the next tier
demo(n => {
  if (n <= 2) { let gp = null; each((it, r, c) => { if (!gp && it.gen) gp = [r, c]; }); if (!gp || !tapGen(gp[0], gp[1])) return false; energy++; save(); return; }
  const groups = new Map();
  each((it, r, c) => { if (it.gen || it.tier >= 3) return; const k = it.kind + it.tier; (groups.get(k) || groups.set(k, []).get(k)).push([it, r, c]); });
  for (const [, arr] of groups) { const { kind, tier } = arr[0][0]; if (arr.length - neededCount(kind, tier) < 2) continue; const [a, ar, ac] = arr[0], [, br, bc] = arr[1]; merge(a, ar, ac, br, bc); return false; }
  return false;
}, { ready: () => state === 'play' && level === 1 && !D.isDaily && !drag && delivered === 0, wait: 1800, every: 1100, max: 3 });

// ---------------------------------------------------------------- test hook: one sensible move per call
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return total; },
  bot() {
    if (state !== 'play' || drag) return;
    for (let i = 0; i < orders.length; i++) if (!orders[i].done && readyItems(orders[i])) { deliver(i); return; }
    // what do the orders still lack?
    const want = []; for (const o of orders) if (!o.done) for (const q of o.need) if (!find(q.kind, q.tier) || neededCount(q.kind, q.tier) > 1) want.push(q);
    const groups = new Map();
    each((it, r, c) => { if (it.gen || it.tier >= 8) return; const k = it.kind + it.tier; (groups.get(k) || groups.set(k, []).get(k)).push([it, r, c]); });
    let best = null;
    for (const [, arr] of groups) {
      if (arr.length < 2) continue; const { kind, tier } = arr[0][0];
      const keep = neededCount(kind, tier); if (arr.length - keep < 2) continue;
      const useful = want.some(q => q.kind === kind && q.tier > tier);
      const score = (useful ? 100 : 0) - tier; if (!best || score > best.score) best = { score, arr };
    }
    if (best && (best.score >= 90 || energy < 1 || !emptyNear(0, 0) || rand() < 0.3)) { const [a, ar, ac] = best.arr[0], [, br, bc] = best.arr[1]; merge(a, ar, ac, br, bc); return; }
    if (energy >= 1 && emptyNear(0, 0)) {
      const k = want.length ? want[Math.floor(rand() * want.length)].kind : kinds[Math.floor(rand() * kinds.length)];
      let gp = null; each((it, r, c) => { if (it.gen && it.kind === k) gp = [r, c]; }); if (gp) { tapGen(gp[0], gp[1]); return; }
    }
    if (best) { const [a, ar, ac] = best.arr[0], [, br, bc] = best.arr[1]; merge(a, ar, ac, br, bc); return; }
    let low = null; each((it, r, c) => { if (!it.gen && !neededCount(it.kind, it.tier) && (!low || it.tier < low[0].tier)) low = [it, r, c]; }); if (low) recycle(low[1], low[2]);
  },
};
