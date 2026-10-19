// Spatula Sprint — original burger-counter time manager. Customers line up with order tickets; grill patties to
// the green zone, stack the toppings in the right order, add a soda, and serve fast for big tips. Days get busier;
// spend tips on kitchen upgrades between days.
import { createUI, store, buzz, note, tone, sfx } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { fx2d, startCard, cardTheme, arp, chime, soft } from './calm.js';
import { LAYERS, drawStack, drawLayerIcon, drawCup, drawFolk, FOLKS, pattyColor, INK } from './art.js';

const NAME = 'Spatula Sprint: Burger Restaurant Game';
const S = store('spatulasprint');
const F = flow('spatulasprint');
const ui = createUI({ title: 'Spatula<br>Sprint', hint: 'Tap to open the grill', hand: '', score: false });
cardTheme({ accent: '#ff6b3d', font: "'Baloo 2',system-ui,sans-serif", serif: "'Baloo 2',system-ui,sans-serif" });
const D = daily('spatulasprint', ui, { name: NAME });
const B = board({ game: 'spatula-sprint', label: 'Perfect orders', limits: { maxRun: 3, maxPerSec: 2.5 }, mode: 'sum', corner: 'tl' });
startCard(ui, D, { kicker: 'Grill · Stack · Serve' });
const fx = fx2d(9);
const css = document.createElement('style'); css.textContent = `
  body{--ui:#ff6b3d;background:#ffe2c4}
  .hc-card{background:linear-gradient(180deg,rgba(80,30,10,.55),rgba(80,30,10,.75))}
  .hc-card h1{text-shadow:0 5px 0 #c4401c,0 10px 24px rgba(80,20,0,.35)}
  .hc-pop{-webkit-text-stroke:2px rgba(90,30,10,.5);paint-order:stroke fill}`;
document.head.appendChild(css);
ui.els.win.querySelector('h1').textContent = 'DAY DONE!';
ui.els.win.querySelector('p').innerHTML = 'DAY <span data-l>1</span>';

const cv = document.createElement('canvas'); cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;touch-action:none'; document.body.prepend(cv);
const g = cv.getContext('2d');
const FONT = (w, s) => `${w} ${s}px "Baloo 2",system-ui,sans-serif`;
const now = () => performance.now();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function mkRand(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// ---------------------------------------------------------------- persistent
let day = S.get('day', 1), coins = S.get('coins', 0), perfectTotal = S.get('perfect', 0);
const UP = Object.assign({ grill: 0, stools: 0, jar: 0, slot: 0 }, S.get('up', {}));
const UPS = [
  { id: 'grill', name: 'Hot Grill', desc: 'Patties cook 15% faster', max: 3, cost: [20, 45, 80], icon: '🔥' },
  { id: 'stools', name: 'Comfy Stools', desc: 'Customers wait 15% longer', max: 3, cost: [20, 45, 80], icon: '🪑' },
  { id: 'jar', name: 'Tip Jar', desc: '+20% tips', max: 3, cost: [25, 55, 95], icon: '🫙' },
  { id: 'slot', name: 'Extra Grill Spot', desc: 'Cook 4 patties at once', max: 1, cost: [60], icon: '🍳' },
];
const TOPS = ['cheese', 'lettuce', 'tomato', 'onion', 'pickles', 'ketchup', 'mustard'];
const UNLOCK = { cheese: 1, lettuce: 1, tomato: 1, onion: 2, pickles: 3, ketchup: 4, mustard: 5 };
const BINS = ['top', 'cheese', 'lettuce', 'tomato', 'onion', 'pickles', 'ketchup', 'mustard'];

// ---------------------------------------------------------------- day state
let state = 'ready', mode = 'day', rand = Math.random, L = 1, fk = 1, N = 3, spawned = 0, served = 0, walked = 0, nextArrive = 0, dayT0 = 0, recorded = false, beatenShown = false, dayTips = 0, dayPerfect = 0, lastSubmit = now();
let customers = [], grill = [], plate = [{ k: 'bun' }], cup = 0, cupFill = false, dropT = 0;
const slots = () => 3 + UP.slot;
function startDay() {
  L = D.isDaily ? 4 : day; fk = F.k(); rand = D.seed ? mkRand(D.seed * 13 + 5) : mkRand(day * 7717 + 3);
  N = D.isDaily ? 7 : Math.min(12, 2 + day); spawned = 0; served = 0; walked = 0; nextArrive = now() + 600; dayT0 = now(); recorded = false; dayTips = 0; dayPerfect = 0;
  customers = []; grill = Array(slots()).fill(null); plate = [{ k: 'bun' }]; cup = 0; cupFill = false; mode = 'day';
  ui.levels(D.isDaily ? 1 : day); ui.progress(0); layout();
}
function makeOrder() {
  const avail = TOPS.filter(t => UNLOCK[t] <= L);
  const nt = clamp(1 + Math.floor(rand() * Math.min(avail.length, 1 + Math.floor(L / 2) + 1)), 1, 5);
  const pick = avail.slice().sort(() => rand() - 0.5).slice(0, nt);
  const patties = L >= 4 && rand() < 0.35 ? 2 : 1;
  const mid = [...Array(patties).fill('patty'), ...pick].sort(() => rand() - 0.5);
  return { layers: ['bun', ...mid, 'top'], drink: L >= 3 && rand() < 0.5 };
}
function spawnCustomer() {
  const used = new Set(customers.map(c => c.slot)); let slot = [1, 0, 2].find(s => !used.has(s)); if (slot === undefined) return false;
  const o = makeOrder(), max = (26 + o.layers.length * 5 + (o.drink ? 5 : 0)) * (1 + 0.15 * UP.stools) / fk;
  customers.push({ f: FOLKS[Math.floor(rand() * FOLKS.length)], order: o, slot, pat: max, max, x: slot < 1 ? -60 : X0 + W + 60, born: now(), state: 'in', mood: 0, bounce: 0 });
  spawned++; tone(1200, 0.06, 'sine', 0.06, 1.2); setTimeout(() => tone(1500, 0.08, 'sine', 0.06, 1), 90); return true;
}

// ---------------------------------------------------------------- layout
let W, H, X0, dpr = 1, CTR, GR, AS, BN;
function layout() {
  dpr = Math.min(devicePixelRatio || 1, 2); cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  W = Math.min(innerWidth, 480); H = innerHeight; X0 = (innerWidth - W) / 2;
  const binsH = clamp(H * 0.25, 150, 230), asH = clamp(H * 0.18, 120, 170), grH = clamp(H * 0.13, 92, 120);
  BN = { y: H - binsH - 10, h: binsH };
  AS = { y: BN.y - asH - 6, h: asH };
  GR = { y: AS.y - grH - 6, h: grH };
  CTR = { y: GR.y - 8 };
}
addEventListener('resize', layout); layout();
const slotX = i => X0 + W * (i + 1.5) / (slots() + 1.5);
const custX = c => X0 + W * (c.slot * 2 + 1) / 6;
const binRect = i => { const cols = 4, w = (W - 20) / cols, h = (BN.h - 6) / 2; return { x: X0 + 10 + (i % cols) * w, y: BN.y + Math.floor(i / cols) * (h + 6), w: w - 6, h }; };
const inR = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const PLATE = () => ({ x: X0 + W / 2, y: AS.y + AS.h - 22 });
const TRASH = () => ({ x: X0 + 14, y: AS.y + AS.h - 70, w: 60, h: 62 });
const SODA = () => ({ x: X0 + W - 84, y: AS.y + 6, w: 72, h: AS.h - 12 });

// ---------------------------------------------------------------- actions
function addRaw() {
  const i = grill.findIndex(p => !p); if (i < 0) { ui.pop('Grill is full!', '#fff', 24, 46); soft.err(); return false; }
  grill[i] = { d: 0, t0: now() }; tone(180, 0.18, 'sawtooth', 0.04, 0.8); buzz(6); return true;
}
function takePatty(i) {
  const p = grill[i]; if (!p) return false;
  if (p.d > 0.95) { grill[i] = null; fx.sparks(slotX(i), GR.y + GR.h / 2, ['#555', '#888'], 10, { speed: 2, kind: 'dot', g: -0.05 }); soft.swish(); ui.pop('Tossed', '#fff', 22, 50); return true; }
  if (plate[plate.length - 1].k === 'top') { soft.err(); ui.pop('Burger is closed — serve it!', '#fff', 22, 50); return false; }
  grill[i] = null; plate.push({ k: 'patty', d: p.d }); dropT = now();
  const perfect = p.d >= 0.6 && p.d <= 0.8; if (perfect) { ui.pop('Perfect!', '#ffe36a', 26, 52); chime(4, 72, 0.1); }
  tone(300, 0.08, 'triangle', 0.1, 0.7); buzz(8); return true;
}
function addTop(k) {
  if (UNLOCK[k] && UNLOCK[k] > L) { ui.pop(`Unlocks on day ${UNLOCK[k]}`, '#fff', 22, 50); soft.err(); return false; }
  if (plate[plate.length - 1].k === 'top') { soft.err(); ui.pop('Burger is closed — serve it!', '#fff', 22, 50); return false; }
  if (plate.length >= 9) { soft.err(); return false; }
  plate.push({ k }); dropT = now(); tone(k === 'ketchup' || k === 'mustard' ? 300 : 620, 0.06, k === 'top' ? 'triangle' : 'sine', 0.1, 1.2); buzz(6); return true;
}
function trash() { if (plate.length > 1) { plate = [{ k: 'bun' }]; const T = TRASH(); fx.sparks(T.x + 30, T.y + 10, ['#d98a3c', '#7fd35a', '#ef4a4a'], 10, { speed: 3 }); soft.swish(); } }
function startSoda() { if (L < 3) return; if (cup >= 1 || cupFill) return; cupFill = true; tone(400, 0.6, 'sine', 0.03, 1.6); }
function lcs(a, b) { const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0)); for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = a[i - 1] === b[j - 1] ? d[i - 1][j - 1] + 1 : Math.max(d[i - 1][j], d[i][j - 1]); return d[m][n]; }
function serve(c) {
  if (c.state !== 'wait') return false;
  if (plate[plate.length - 1].k !== 'top') { ui.pop('Add the top bun first', '#fff', 22, 30); soft.err(); c.bounce = now(); return false; }
  if (c.order.drink && cup < 1) { ui.pop('They ordered a soda!', '#fff', 22, 30); soft.err(); c.bounce = now(); return false; }
  const got = plate.map(l => l.k), want = c.order.layers;
  const exact = got.length === want.length && got.every((k, i) => k === want[i]);
  const ratio = lcs(got, want) / Math.max(got.length, want.length);
  const pats = plate.filter(l => l.k === 'patty'), cookOk = pats.length && pats.every(p => p.d >= 0.6 && p.d <= 0.8), cookFine = pats.every(p => p.d >= 0.48 && p.d <= 0.93);
  const fast = c.pat / c.max > 0.45;
  let stars = (exact ? 1 : 0) + (cookOk ? 1 : 0) + (fast ? 1 : 0); if (!exact && ratio < 0.6) stars = 0; if (!cookFine) stars = Math.min(stars, 1);
  const tip = Math.round((3 + want.length - 2) * (0.4 + stars * 0.4) * (1 + 0.2 * UP.jar) + (c.order.drink ? 2 : 0));
  coins += tip; dayTips += tip; S.set('coins', coins);
  if (c.order.drink) cup = 0;
  const x = custX(c); fx.sparks(x, CTR.y - 120, ['#ffd23f', '#fff', '#ff6b3d'], 10 + stars * 6, { speed: 3 + stars });
  c.state = 'out'; c.mood = stars >= 2 ? 1 : stars === 0 ? -1 : 0; c.leaveT = now(); served++;
  ui.pop(stars === 3 ? '★★★ PERFECT!' : stars === 2 ? '★★☆ Tasty!' : stars === 1 ? '★☆☆ Okay…' : '☆☆☆ Wrong order!', stars >= 2 ? '#ffe36a' : '#fff', stars === 3 ? 34 : 26, 22);
  if (stars === 3) { dayPerfect++; perfectTotal++; S.set('perfect', perfectTotal); B.submit(1, { ms: Math.max(500, now() - lastSubmit) }); lastSubmit = now(); arp([72, 76, 79, 84], 70, 0.11); buzz([10, 30, 10]); } else if (stars === 0) sfx.fail(); else sfx.coin();
  if (!beatenShown && D.beaten(perfectTotal)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); fx.confetti(60); }
  plate = [{ k: 'bun' }]; ui.progress((served + walked) / N); return true;
}
function endDay() {
  if (state !== 'play' || mode !== 'day') return;
  const ok = walked < 3;
  if (!recorded) { recorded = true; if (!D.isDaily) F.level(ok, (served) / N); }
  if (ok) { state = 'won'; D.won(perfectTotal, 'served perfectly'); sfx.win(); fx.confetti(130); const d = day; if (!D.isDaily) { day++; S.set('day', day); } ui.win(D.isDaily ? 'DAILY' : d, `${served} served · ${dayPerfect} perfect · 🪙 ${dayTips} in tips`); }
  else { state = 'lost'; sfx.fail(); ui.lose('CLOSED EARLY', `${walked} customers walked out. Serve faster!`); }
}

// ---------------------------------------------------------------- input
cv.addEventListener('pointerdown', e => {
  if (state !== 'play') return; const px = e.clientX, py = e.clientY;
  if (mode === 'shop') { shopTap(px, py); return; }
  for (const c of customers) if (c.state === 'wait' && Math.abs(px - custX(c)) < W / 6 && py < CTR.y + 6 && py > 70) { serve(c); return; }
  if (py > GR.y && py < GR.y + GR.h) {
    if (px < X0 + W * 1 / (slots() + 1.5) + 10) { addRaw(); return; }
    let bi = -1, bd = 1e9; for (let i = 0; i < slots(); i++) { const d = Math.abs(px - slotX(i)); if (d < bd) { bd = d; bi = i; } } if (bi >= 0 && bd < 50) takePatty(bi); return;
  }
  if (inR(TRASH(), px, py)) return trash();
  if (L >= 3 && inR(SODA(), px, py)) return startSoda();
  for (let i = 0; i < BINS.length; i++) if (inR(binRect(i), px, py)) return addTop(BINS[i]);
});

// ---------------------------------------------------------------- shop between days
const shopCard = i => ({ x: X0 + 16, y: 190 + i * 92, w: W - 32, h: 80 });
const shopGo = () => ({ x: X0 + W / 2 - 120, y: 190 + 4 * 92 + 16, w: 240, h: 62 });
function buy(u) { const lv = UP[u.id]; if (lv >= u.max) return false; const cost = u.cost[lv]; if (coins < cost) { soft.err(); ui.pop(`Needs 🪙${cost}`, '#fff', 24, 20); return false; } coins -= cost; UP[u.id]++; S.set('coins', coins); S.set('up', UP); sfx.coin(); fx.sparks(X0 + W / 2, 200, ['#ffd23f', '#fff'], 20, { speed: 4 }); return true; }
function shopTap(px, py) { for (let i = 0; i < UPS.length; i++) if (inR(shopCard(i), px, py)) return buy(UPS[i]); if (inR(shopGo(), px, py)) { soft.wood(); startDay(); } }

// ---------------------------------------------------------------- drawing
function rr(x, y, w, h, r, c, st, lw = 3) { g.beginPath(); g.roundRect(x, y, w, h, r); g.fillStyle = c; g.fill(); if (st) { g.lineWidth = lw; g.strokeStyle = st; g.stroke(); } }
function text(s, x, y, size = 16, c = '#fff', w = 800, al = 'center') { g.font = FONT(w, size); g.textAlign = al; g.fillStyle = c; g.fillText(s, x, y); }
function drawDining(t) {
  // wall, menu board, window
  const gr = g.createLinearGradient(0, 0, 0, CTR.y); gr.addColorStop(0, '#ffe8c8'); gr.addColorStop(1, '#ffd2a0'); g.fillStyle = gr; g.fillRect(0, 0, innerWidth, CTR.y);
  g.fillStyle = 'rgba(255,150,90,.18)'; for (let x = 0; x < innerWidth; x += 30) g.fillRect(x, 0, 14, CTR.y);
  for (const wx of [X0 + W * 0.18, X0 + W * 0.82]) { rr(wx - 44, 150, 88, 96, 10, '#bfe9ff', '#c96a3c', 6); g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(wx - 30, 160, 10, 76); g.fillStyle = '#c96a3c'; g.fillRect(wx - 2, 150, 4, 96); g.fillRect(wx - 44, 196, 88, 4); g.fillStyle = '#8fd68a'; g.beginPath(); g.ellipse(wx, 246, 40, 14, 0, Math.PI, 0); g.fill(); }
  text(D.isDaily ? 'Daily' : 'Day ' + day, X0 + 16, 112, 16, '#9a4a2a', 800, 'left'); text('🪙 ' + coins, X0 + W - 16, 112, 17, '#9a4a2a', 800, 'right');
  text('😤'.repeat(walked) + '·'.repeat(Math.max(0, 3 - walked)), X0 + W - 16, 134, 13, '#9a4a2a', 800, 'right');
  // customers behind the counter
  for (const c of customers) {
    const tx = custX(c); c.x += (tx - c.x) * (c.state === 'out' || c.state === 'gone' ? 0 : 0.08);
    if (c.state === 'in' && Math.abs(c.x - tx) < 4) { c.state = 'wait'; c.arrived = now(); }
    if (c.state === 'out' || c.state === 'gone') { const k = (now() - c.leaveT) / 700; c.x += (c.slot === 2 ? 1 : -1) * k * 14; }
    const frac = c.pat / c.max, mood = c.state === 'out' || c.state === 'gone' ? c.mood : frac < 0.25 ? -1 : 0;
    const hop = Math.abs(Math.sin(now() / 120)) * (c.state === 'in' ? 6 : 0) + (c.bounce && now() - c.bounce < 300 ? Math.sin((now() - c.bounce) / 40) * 4 : 0);
    const s = Math.min(34, W / 12);
    drawFolk(g, c.f, c.x, CTR.y - s * 2.2 - hop, s, mood);
    if (c.state === 'wait') {
      // ticket
      const tw = Math.min(118, W / 3 - 10), th = 128, tx0 = c.x - tw / 2, ty0 = CTR.y - s * 2.2 - s - th - 14;
      g.save(); g.translate(c.x, ty0 + th); g.rotate(Math.sin(now() / 700 + c.slot) * 0.02); g.translate(-c.x, -(ty0 + th));
      rr(tx0, ty0 + 4, tw, th, 10, 'rgba(90,40,10,.18)'); rr(tx0, ty0, tw, th, 10, '#fffdf6', '#e8cfa8', 2);
      g.beginPath(); g.moveTo(c.x - 6, ty0 + th); g.lineTo(c.x, ty0 + th + 9); g.lineTo(c.x + 6, ty0 + th); g.fillStyle = '#fffdf6'; g.fill();
      const ow = Math.min(40, tw * 0.38); const sh = c.order.layers.length;
      // stack preview with a numbered list on the side
      drawStack(g, c.order.layers.map(k => ({ k, d: 0.7 })), tx0 + tw * 0.72, ty0 + th - (c.order.drink ? 40 : 14), tw * 0.24 * (sh > 6 ? 0.85 : 1));
      g.font = FONT(700, 11); g.textAlign = 'left'; g.fillStyle = '#7a4a2a';
      c.order.layers.slice(1, -1).reverse().forEach((k, i) => { g.fillText((sh - 2 - i) + '. ' + LAYERS[k].name, tx0 + 7, ty0 + 18 + i * 13); });
      if (c.order.drink) { drawCup(g, tx0 + tw * 0.72, ty0 + th - 18, 22, 1); }
      // patience
      rr(tx0 + 6, ty0 - 10, tw - 12, 7, 4, 'rgba(0,0,0,.12)'); rr(tx0 + 6, ty0 - 10, (tw - 12) * frac, 7, 4, frac > 0.45 ? '#5bc95b' : frac > 0.25 ? '#ffb72e' : '#e8463c');
      g.restore();
    }
  }
  // counter
  g.fillStyle = '#c96a3c'; g.fillRect(0, CTR.y - 22, innerWidth, 30); g.fillStyle = '#e58552'; g.fillRect(0, CTR.y - 26, innerWidth, 8);
}
function drawKitchen(t) {
  g.fillStyle = '#f4ecdf'; g.fillRect(0, CTR.y + 8, innerWidth, H); g.fillStyle = 'rgba(160,130,100,.12)'; for (let x = 0; x < innerWidth; x += 32) for (let y = CTR.y + 8; y < H; y += 32) if (((x + y) / 32) % 2 === 0) g.fillRect(x, y, 32, 32);
  // grill
  rr(X0 + 6, GR.y, W - 12, GR.h, 16, '#4a4f5a'); rr(X0 + 10, GR.y + 4, W - 20, GR.h - 8, 13, '#2f333c');
  g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 3; for (let x = X0 + 20; x < X0 + W - 10; x += 14) { g.beginPath(); g.moveTo(x, GR.y + 8); g.lineTo(x, GR.y + GR.h - 8); g.stroke(); }
  const rbw = W / (slots() + 1.5); rr(X0 + 12, GR.y + 8, rbw - 6, GR.h - 16, 10, '#ffe0e0', '#e8b0b0', 2);
  for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(X0 + 12 + rbw / 2 - 3, GR.y + GR.h - 30 - k * 9, rbw * 0.3, 10, 0, 0, 7); g.fillStyle = pattyColor(0); g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke(); }
  text('+ PATTY', X0 + 12 + rbw / 2 - 3, GR.y + 24, 12, '#b0505a');
  const pr = Math.min(32, rbw * 0.4);
  for (let i = 0; i < slots(); i++) {
    const x = slotX(i), y = GR.y + GR.h / 2, p = grill[i];
    g.beginPath(); g.arc(x, y, pr + 8, 0, 7); g.fillStyle = 'rgba(255,120,40,.12)'; g.fill();
    if (!p) continue;
    const gt = (now() - p.t0) / 1000, cook = 7 / (1 + 0.15 * UP.grill); p.d = clamp(gt / cook, 0, 1.2);
    g.save(); g.translate(x, y + Math.sin(now() / 50 + i) * 0.6);
    g.beginPath(); g.arc(0, 0, pr, 0, 7); g.fillStyle = pattyColor(Math.min(1, p.d)); g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
    if (p.d > 0.35) { g.strokeStyle = 'rgba(30,15,10,.45)'; g.lineWidth = 4; for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(-pr * 0.6, k * pr * 0.4 - pr * 0.2); g.lineTo(pr * 0.6, k * pr * 0.4 + pr * 0.2); g.stroke(); } }
    // doneness ring with the green zone
    g.lineWidth = 6; g.beginPath(); g.arc(0, 0, pr + 7, -Math.PI / 2 + 0.6 * 2 * Math.PI, -Math.PI / 2 + 0.8 * 2 * Math.PI); g.strokeStyle = 'rgba(91,201,91,.55)'; g.stroke();
    g.beginPath(); g.arc(0, 0, pr + 7, -Math.PI / 2, -Math.PI / 2 + Math.min(1, p.d) * 2 * Math.PI); g.strokeStyle = p.d >= 0.6 && p.d <= 0.8 ? '#5bc95b' : p.d > 0.92 ? '#e8463c' : '#ffd23f'; g.lineCap = 'round'; g.stroke();
    if (p.d >= 0.6 && p.d <= 0.8) text('✓', 0, 7, 22, '#fff');
    if (p.d > 0.92) text('🔥', 0, 8, 20);
    g.restore();
    if (Math.random() < 0.2 * Math.min(1, p.d + 0.2)) fx.sparks(x + (Math.random() - 0.5) * pr, y - pr * 0.4, p.d > 0.9 ? ['#666', '#999'] : ['rgba(255,255,255,.7)'], 1, { speed: 0.6, size: 4, kind: 'dot', g: -0.04 });
  }
  // assembly
  rr(X0 + 6, AS.y, W - 12, AS.h, 16, '#e2d3bd'); rr(X0 + 10, AS.y + 4, W - 20, AS.h - 8, 13, '#efe3cf');
  const P = PLATE(); g.beginPath(); g.ellipse(P.x, P.y, 72, 16, 0, 0, 7); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#c9b8a0'; g.stroke();
  const drop = Math.max(0, 1 - (now() - dropT) / 160);
  drawStack(g, plate, P.x, P.y - 4, Math.min(58, AS.h * 0.42), drop);
  const T = TRASH(); rr(T.x, T.y, T.w, T.h, 12, '#9aa3ad', INK); rr(T.x - 4, T.y - 6, T.w + 8, 12, 6, '#7b858f', INK); text('🗑', T.x + T.w / 2, T.y + 40, 22);
  if (L >= 3) { const Sd = SODA(); rr(Sd.x, Sd.y, Sd.w, Sd.h, 12, '#e8463c', INK); rr(Sd.x + 8, Sd.y + 8, Sd.w - 16, 26, 8, '#ffe0dc'); text('SODA', Sd.x + Sd.w / 2, Sd.y + 27, 13, '#e8463c');
    if (cupFill) { cup = Math.min(1, cup + 0.012); if (cup >= 1) { cupFill = false; chime(6, 72, 0.08); } }
    drawCup(g, Sd.x + Sd.w / 2, Sd.y + Sd.h - 28, 34, cup); if (cupFill) { g.fillStyle = '#e8463c'; g.fillRect(Sd.x + Sd.w / 2 - 2, Sd.y + 36, 4, Sd.h - 80); } }
  else { const Sd = SODA(); g.globalAlpha = 0.35; rr(Sd.x, Sd.y, Sd.w, Sd.h, 12, '#b0a090', INK); drawCup(g, Sd.x + Sd.w / 2, Sd.y + Sd.h - 28, 34, 0); g.globalAlpha = 1; text('🔒 Day 3', Sd.x + Sd.w / 2, Sd.y + 28, 13, '#7a6a5a'); }
  const top = plate[plate.length - 1].k === 'top'; if (top) text('Tap the customer to serve!', P.x, AS.y + 20, 14, '#c4401c');
  // bins
  BINS.forEach((k, i) => { const r = binRect(i), lock = UNLOCK[k] && UNLOCK[k] > L;
    rr(r.x, r.y + 4, r.w, r.h, 14, 'rgba(90,60,30,.18)'); rr(r.x, r.y, r.w, r.h, 14, lock ? '#e6dccd' : '#ffffff', '#e0cfb4', 2);
    g.save(); if (lock) g.globalAlpha = 0.35; const iw = r.w * 0.36, n = k === 'top' ? 1 : 3; for (let q = n - 1; q >= 0; q--) drawLayerIcon(g, k, r.x + r.w / 2 + (q - 1) * 3 * (n > 1), r.y + r.h * 0.44 + (q - (n - 1) / 2) * 9, iw); g.restore();
    text(lock ? '🔒 Day ' + UNLOCK[k] : LAYERS[k].name, r.x + r.w / 2, r.y + r.h - 10, 12, lock ? '#a89878' : '#7a4a2a'); });
}
function drawShop() {
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#ffb680'); gr.addColorStop(1, '#ffe2c4'); g.fillStyle = gr; g.fillRect(0, 0, innerWidth, H);
  text('Kitchen upgrades', X0 + W / 2, 120, 30, '#fff'); text('🪙 ' + coins + ' in tips', X0 + W / 2, 156, 20, '#7a3a1a');
  UPS.forEach((u, i) => { const r = shopCard(i), lv = UP[u.id], maxed = lv >= u.max, cost = u.cost[lv], can = !maxed && coins >= cost;
    rr(r.x, r.y + 4, r.w, r.h, 18, 'rgba(120,50,10,.2)'); rr(r.x, r.y, r.w, r.h, 18, '#fffaf2', can ? '#5bc95b' : '#f0d8b8', 3);
    text(u.icon, r.x + 36, r.y + 52, 32); text(u.name, r.x + 70, r.y + 34, 19, '#5a2a10', 800, 'left'); text(u.desc, r.x + 70, r.y + 56, 13, '#9a6a4a', 600, 'left');
    for (let k = 0; k < u.max; k++) { g.beginPath(); g.arc(r.x + 70 + k * 14, r.y + 68, 4.5, 0, 7); g.fillStyle = k < lv ? '#ff6b3d' : '#ecd8c0'; g.fill(); }
    rr(r.x + r.w - 92, r.y + 22, 80, 36, 18, maxed ? '#d8d0c4' : can ? '#5bc95b' : '#e8c8a8'); text(maxed ? 'MAX' : '🪙' + cost, r.x + r.w - 52, r.y + 46, 17, '#fff'); });
  const b = shopGo(), p = 1 + Math.sin(now() / 200) * 0.03; g.save(); g.translate(b.x + b.w / 2, b.y + b.h / 2); g.scale(p, p); g.translate(-b.x - b.w / 2, -b.y - b.h / 2);
  rr(b.x, b.y + 5, b.w, b.h, 31, '#c4401c'); rr(b.x, b.y, b.w, b.h, 31, '#ff6b3d'); text(`Open Day ${day} ▶`, b.x + b.w / 2, b.y + 41, 24, '#fff'); g.restore();
}
let last = now();
function frame() {
  const t = now() / 1000, dt = Math.min(2.5, (now() - last) / 16.67); last = now();
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = '#ffe2c4'; g.fillRect(0, 0, innerWidth, innerHeight);
  if (mode === 'shop') drawShop();
  else {
    if (state === 'play') {
      if (spawned < N && now() > nextArrive && customers.filter(c => c.state === 'in' || c.state === 'wait').length < 3) { if (spawnCustomer()) nextArrive = now() + clamp(7 - L * 0.4, 3.6, 7) * 1000 / fk * (0.8 + rand() * 0.4); }
      for (const c of customers) if (c.state === 'wait') { c.pat -= dt / 60; if (c.pat <= 0) { c.state = 'gone'; c.mood = -1; c.leaveT = now(); walked++; sfx.fail(); buzz(40); ui.pop('Walked out!', '#fff', 26, 22); ui.progress((served + walked) / N); } }
      customers = customers.filter(c => !((c.state === 'out' || c.state === 'gone') && now() - c.leaveT > 1400));
      if (spawned >= N && customers.length === 0) endDay();
      if (walked >= 3) endDay();
    } else for (const p of grill) if (p) p.t0 += dt * 16.67;   // the grill pauses while a card is up
    drawDining(t); drawKitchen(t);
  }
  requestAnimationFrame(frame);
}
ui.onTap(w => {
  B.start();
  if (w === 'win' && D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
  state = 'play';
  if (w === 'win' && day > 1) { mode = 'shop'; ui.levels(day); ui.progress(0); return; }
  startDay();
});
startDay(); state = 'ready'; frame(); ui.start();

// ---------------------------------------------------------------- test hook: one sensible kitchen action per call
let target = null;
window.__game = {
  get state() { return state; }, get level() { return day; }, get score() { return perfectTotal; },
  bot() {
    if (state !== 'play') return;
    if (mode === 'shop') { const u = UPS.find(u => UP[u.id] < u.max && coins >= u.cost[UP[u.id]]); if (u && Math.random() < 0.7) buy(u); else { soft.wood(); startDay(); } return; }
    if (!target || target.state !== 'wait') target = customers.filter(c => c.state === 'wait').sort((a, b) => a.pat - b.pat)[0] || null;
    const burnt = grill.findIndex(p => p && p.d > 0.95); if (burnt >= 0) { takePatty(burnt); return; }
    if (!target) { if (!grill.some(p => p)) addRaw(); return; }
    const want = target.order.layers, got = plate.map(l => l.k);
    if (got.length > want.length || got.some((k, i) => k !== want[i])) { trash(); return; }
    if (target.order.drink && cup < 1 && !cupFill) { startSoda(); return; }
    if (got.length === want.length) { if (!target.order.drink || cup >= 1) serve(target); return; }
    const next = want[got.length];
    if (next === 'patty') {
      const ready = grill.map((p, i) => [p, i]).filter(([p]) => p && p.d >= 0.62 && p.d <= 0.8).sort((a, b) => b[0].d - a[0].d)[0];
      if (ready) { takePatty(ready[1]); return; }
      const need = want.slice(got.length).filter(k => k === 'patty').length, cooking = grill.filter(p => p && p.d < 0.8).length;
      if (cooking < need) addRaw(); return;
    }
    const need = want.slice(got.length).filter(k => k === 'patty').length, cooking = grill.filter(p => p && p.d < 0.8).length;
    if (cooking < need && grill.some(p => !p)) { addRaw(); return; }
    addTop(next);
  },
};
