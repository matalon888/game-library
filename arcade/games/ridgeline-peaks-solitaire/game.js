// Ridgeline — original three-peaks solitaire (the classic public card game). Tap a face-up card one rank above or below
// the waste card; build streaks; draw from the stock when stuck. Deals are seeded and checked solvable before you see them.
import { createUI, store, buzz, note } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { css, cardTheme, startCard, fx2d, chime, arp, soft, todayKey } from './calm.js';

const NAME = 'Ridgeline: Peaks Solitaire';
const S = store('ridgeline');
const F = flow('ridgeline');
const ui = createUI({ title: 'Ridgeline', hint: 'Tap to deal', hand: '', score: false });
cardTheme({ accent: '#d6a24a' });
const D = daily('ridgeline', ui, { name: NAME });
const fx = fx2d(11);
const doneToday = S.get('daily_' + todayKey(), null);
startCard(ui, D, { kicker: D.isDaily ? 'Daily deal' : 'three-peaks solitaire', doneLine: doneToday ? (D.isDaily ? `Cleared today · ${doneToday.s.toLocaleString()} pts` : 'Daily deal cleared ✓') : null });
if (D.isDaily) ui.els.win.querySelector('p').innerHTML = 'Daily deal<span data-l hidden></span>';
ui.els.win.querySelector('h1').textContent = 'Peaks cleared!';

const THEMES = [
  { sky: ['#123b47', '#1d5a63', '#3f8a85'], ridge: ['#2d6f70', '#215a5e', '#164248', '#0d2e35'], glow: '#f6d58e', back: ['#1f5c63', '#0f3a42'] },
  { sky: ['#2a2346', '#4a3466', '#8a5a7e'], ridge: ['#6b4a74', '#523a62', '#3a2a4e', '#241a36'], glow: '#ffc79a', back: ['#4a3466', '#2a1f44'] },
  { sky: ['#13283f', '#1f4466', '#4f7da0'], ridge: ['#3b6588', '#2b5072', '#1c3a58', '#11263d'], glow: '#ffe2a8', back: ['#24507a', '#132d4a'] },
  { sky: ['#1d3326', '#2f5238', '#6c9466'], ridge: ['#4f7a52', '#3c6342', '#2a4a31', '#1a3122'], glow: '#ffe6a0', back: ['#2f6040', '#173822'] },
];

// ---------------------------------------------------------------- styles
css(`
body{background:#123b47}
#bg{position:fixed;inset:0;width:100%;height:100%;z-index:0}
.hc-top{z-index:40}.hc-top .hc-lvl{width:28px;height:28px;font-size:14px;font-weight:700;color:#1b2430;background:#f0c56a}
.hc-top .hc-lvl.next{background:rgba(255,255,255,.18);color:#fff}
.hc-top .hc-bar{background:rgba(255,255,255,.18);height:8px}.hc-top .hc-bar i{background:#f0c56a}
#table{position:fixed;inset:0;z-index:2}
.cd{position:absolute;left:0;top:0;width:var(--cw);height:var(--ch);transition:transform .34s cubic-bezier(.3,.9,.3,1.05);perspective:600px;cursor:pointer}
.cd .in{position:absolute;inset:0;transition:transform .32s ease;transform-style:preserve-3d}
.cd.down .in{transform:rotateY(180deg)}
.cd .f{position:absolute;inset:0;border-radius:calc(var(--cw) * .12);backface-visibility:hidden;-webkit-backface-visibility:hidden;overflow:hidden}
.cd .fr{background:linear-gradient(160deg,#fffefb,#f4efe6);box-shadow:0 1px 0 rgba(255,255,255,.6) inset,0 3px 8px rgba(0,0,0,.28);border:1px solid rgba(0,0,0,.08)}
.cd .bk{transform:rotateY(180deg);background:linear-gradient(150deg,var(--b1),var(--b2));box-shadow:0 2px 4px rgba(0,0,0,.22);border:1.5px solid rgba(255,255,255,.75)}
.cd .bk:after{content:'';position:absolute;inset:3px;border-radius:calc(var(--cw) * .08);border:1px solid rgba(240,197,106,.55);background:
 radial-gradient(circle at 50% 120%,rgba(240,197,106,.35) 0 18%,transparent 19%),
 repeating-linear-gradient(45deg,rgba(255,255,255,.06) 0 3px,transparent 3px 7px)}
.cd .bk:before{content:'';position:absolute;left:50%;top:50%;width:46%;height:28%;transform:translate(-50%,-40%);background:#f0c56a;opacity:.85;clip-path:polygon(0 100%,30% 30%,45% 60%,65% 0,100% 100%)}
.rk{position:absolute;left:7%;top:3%;font-weight:750;font-size:calc(var(--cw) * .46);line-height:1;letter-spacing:-1px;font-family:-apple-system,'SF Pro Display',system-ui,sans-serif}
.s1{position:absolute;left:9%;top:calc(var(--cw) * .47);font-size:calc(var(--cw) * .28);line-height:1}
.s2{position:absolute;left:30%;bottom:5%;font-size:calc(var(--cw) * .5);line-height:1}
.red{color:#d03a4c}.blk{color:#1f2433}
.wild .fr{background:linear-gradient(160deg,#ffe9a8,#f0c056 60%,#d79a2c)}
.wild .rk{color:#7a4a08;font-size:calc(var(--cw) * .3);top:8%;letter-spacing:0}
.wild .s2{color:#fff8e0;text-shadow:0 2px 0 rgba(122,74,8,.35);right:auto;left:50%;transform:translateX(-50%);bottom:8%}
.cd.shake{animation:shk .32s}
@keyframes shk{20%{margin-left:-5px}40%{margin-left:5px}60%{margin-left:-3px}80%{margin-left:2px}}
.cd.glow .fr{box-shadow:0 0 0 3px #f0c56a,0 0 18px rgba(240,197,106,.8)}
.cd.free:active .fr{filter:brightness(.95)}
#stockBadge{position:absolute;z-index:200;background:#f0c56a;color:#1b2430;font-weight:800;font-size:13px;border-radius:12px;padding:1px 8px;pointer-events:none;box-shadow:0 2px 6px rgba(0,0,0,.25)}
#hud{position:fixed;left:0;right:0;z-index:5;display:flex;flex-direction:column;align-items:center;pointer-events:none;color:#fff}
#hud .sc{font-family:ui-serif,'New York',Georgia,serif;font-weight:600;font-size:42px;line-height:1;text-shadow:0 3px 14px rgba(0,0,0,.3);font-variant-numeric:tabular-nums}
#hud .lab{font-size:11px;letter-spacing:3px;text-transform:uppercase;opacity:.7;font-weight:700;margin-top:4px}
#streak{position:fixed;z-index:5;left:50%;transform:translateX(-50%);display:flex;gap:5px;pointer-events:none}
#streak i{width:14px;height:6px;border-radius:3px;background:rgba(255,255,255,.18);transition:background .2s,transform .2s}
#streak i.on{background:#f0c56a;transform:scaleY(1.4)}
`);
const bgc = document.createElement('canvas'); bgc.id = 'bg'; document.body.prepend(bgc);
const table = document.createElement('div'); table.id = 'table'; document.body.appendChild(table);
const hud = document.createElement('div'); hud.id = 'hud'; hud.innerHTML = '<div class="sc">0</div><div class="lab">score</div>'; document.body.appendChild(hud);
const streakEl = document.createElement('div'); streakEl.id = 'streak'; streakEl.innerHTML = '<i></i>'.repeat(10); document.body.appendChild(streakEl);
const badge = document.createElement('div'); badge.id = 'stockBadge'; table.appendChild(badge);

function rngf(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function paint(th, seed) {
  const dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth, H = innerHeight, r = rngf(seed * 131 + 5);
  bgc.width = W * dpr; bgc.height = H * dpr; const g = bgc.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sk = g.createLinearGradient(0, 0, 0, H); th.sky.forEach((c, i) => sk.addColorStop(i / (th.sky.length - 1) * 0.75, c)); g.fillStyle = sk; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) { g.globalAlpha = 0.15 + r() * 0.5; g.fillStyle = '#fff'; g.beginPath(); g.arc(r() * W, r() * H * 0.45, r() * 1.2 + 0.2, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  const gx = W * (0.3 + r() * 0.4), gy = H * 0.62, gl = g.createRadialGradient(gx, gy, 0, gx, gy, W * 0.7); gl.addColorStop(0, th.glow + '66'); gl.addColorStop(1, th.glow + '00'); g.fillStyle = gl; g.fillRect(0, 0, W, H);
  th.ridge.forEach((col, li) => {
    const base = H * (0.5 + li * 0.075), amp = H * (0.12 - li * 0.02), ph = [r() * 7, r() * 7, r() * 7];
    g.fillStyle = col; g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W + 4; x += 3) { const t = x / W; g.lineTo(x, base - amp * (0.6 * Math.abs(Math.sin(t * 3.2 + ph[0])) + 0.3 * Math.sin(t * 9 + ph[1]) + 0.12 * Math.sin(t * 23 + ph[2]))); }
    g.lineTo(W, H); g.closePath(); g.fill();
  });
  const v = g.createRadialGradient(W / 2, H * 0.45, H * 0.2, W / 2, H * 0.5, H * 0.8); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.35)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------- tableau geometry (3 peaks: rows of 3, 6, 9, 10)
const SLOTS = [];   // { row, x (in pitch units), covers: [] indices of cards that cover this one }
for (let p = 0; p < 3; p++) SLOTS.push({ row: 0, x: 3 * p + 1.5 });
for (let p = 0; p < 3; p++) for (let j = 0; j < 2; j++) SLOTS.push({ row: 1, x: 3 * p + 1 + j });
for (let i = 0; i < 9; i++) SLOTS.push({ row: 2, x: i + 0.5 });
for (let i = 0; i < 10; i++) SLOTS.push({ row: 3, x: i });
SLOTS.forEach((s, i) => { s.coveredBy = SLOTS.map((t, j) => (t.row === s.row + 1 && Math.abs(t.x - s.x) === 0.5) ? j : -1).filter(j => j >= 0); });
const SUITS = ['♠', '♥', '♦', '♣'], RN = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const adj = (a, b) => a === 0 || b === 0 || Math.abs(a - b) === 1 || (a === 1 && b === 13) || (a === 13 && b === 1);

// ---------------------------------------------------------------- solver (DFS with memo over removed-mask × stock index × waste rank)
function solve(ranks, stock, mask0, si0, top0, limit = 250000) {
  const FULL = (1 << 28) - 1 >>> 0, seen = new Set(); let nodes = 0;
  const path = [];
  const free = (mask, i) => SLOTS[i].coveredBy.every(j => mask & (1 << j));
  function rec(mask, si, top) {
    if ((mask >>> 0) === FULL) return true;
    if (++nodes > limit) return false;
    const key = (mask >>> 0) * 1024 + si * 16 + top; if (seen.has(key)) return false; seen.add(key);
    for (let i = 27; i >= 0; i--) {
      if (mask & (1 << i) || !free(mask, i) || !adj(top, ranks[i])) continue;
      path.push(i); if (rec(mask | (1 << i), si, ranks[i])) return true; path.pop();
    }
    if (si < stock.length) { path.push(-1); if (rec(mask, si + 1, stock[si])) return true; path.pop(); }
    return false;
  }
  const ok = rec(mask0, si0, top0);
  return { ok, path: ok ? path : null, nodes };
}

// ---------------------------------------------------------------- deal
function deal(seed, L, fk) {
  const removedStock = Math.max(0, Math.min(11, Math.round(Math.min(10, (L - 1) * 0.7) * fk)));
  const wilds = Math.max(0, Math.min(3, Math.round((2 - (L - 1) * 0.25) / fk)));
  for (let k = 0; k < 60; k++) {
    const r = rngf(seed * 7 + k * 7919 + 1), deck = [];
    for (let s = 0; s < 4; s++) for (let v = 1; v <= 13; v++) deck.push({ r: v, s });
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    const tab = deck.slice(0, 28), first = deck[28];
    let stock = deck.slice(29, 29 + 23 - removedStock);
    for (let w = 0; w < wilds; w++) stock.splice(3 + Math.floor(r() * (stock.length - 3)), 0, { r: 0, s: -1 });
    const res = solve(tab.map(c => c.r), stock.map(c => c.r), 0, 0, first.r);
    if (res.ok) return { tab, first, stock };
  }
  return null;
}

// ---------------------------------------------------------------- state
let state = 'ready', level = S.get('level', 1), score = 0, streak = 0, bestStreak = 0, mask = 0, si = 0, waste = [], stockCards = [], tabCards = [], recorded = false, beatenShown = false, plan = null, th, busy = 0;
let G = { pitch: 36, cw: 44, ch: 62, ox: 0, oy: 0, rowDy: 34, stockX: 0, stockY: 0, wasteX: 0, wasteY: 0 };

function cardEl(c, down = true) {
  const d = document.createElement('div'); d.className = 'cd' + (down ? ' down' : '') + (c.r === 0 ? ' wild' : '');
  const col = c.s === 1 || c.s === 2 ? 'red' : 'blk';
  d.innerHTML = `<div class="in"><div class="f fr ${col}">${c.r === 0 ? '<div class="rk">WILD</div><div class="s2">★</div>' : `<div class="rk">${RN[c.r]}</div><div class="s1">${SUITS[c.s]}</div><div class="s2">${SUITS[c.s]}</div>`}</div><div class="f bk"></div></div>`;
  table.appendChild(d); c.el = d; return d;
}
const place = (c, x, y, z, rot = 0) => { c.el.style.transform = `translate(${x}px,${y}px) rotate(${rot}deg)`; c.el.style.zIndex = z; };
function layout() {
  const W = innerWidth, H = innerHeight, aw = Math.min(W - 10, 520);
  G.pitch = aw / 10.4; G.cw = G.pitch * 1.4; G.ch = G.cw * 1.38; G.rowDy = G.ch * 0.66;
  G.ox = (W - (9 * G.pitch + G.cw)) / 2; G.oy = Math.max(100, H * 0.135);
  G.wasteX = W / 2 + G.cw * 0.2; G.wasteY = H - G.ch * 1.45 - Math.max(40, H * 0.07);
  G.stockX = Math.max(24, W / 2 - G.cw * 2.6); G.stockY = G.wasteY;
  badge.style.left = G.stockX + G.cw * 1.1 - 14 + 'px'; badge.style.top = G.stockY - G.ch * 0.125 - 10 + 'px';
  table.style.setProperty('--cw', G.cw + 'px'); table.style.setProperty('--ch', G.ch + 'px');
  hud.style.top = (G.oy + 3 * G.rowDy + G.ch + Math.max(22, (G.wasteY - (G.oy + 3 * G.rowDy + G.ch)) * 0.3)) + 'px';
  streakEl.style.top = G.wasteY - G.ch * 0.125 - 30 + 'px';
  paint(th, level);
  if (!tabCards.length || !tabCards[0].el) return;
  tabCards.forEach((c, i) => { if (!(mask & (1 << i))) place(c, G.ox + SLOTS[i].x * G.pitch, G.oy + SLOTS[i].row * G.rowDy, 10 + SLOTS[i].row); });
  stockCards.forEach((c, k) => { if (k >= si) stockPlace(c, k); });
  waste.forEach((c, k) => { c.el.style.width = c.el.style.height = ''; place(c, G.wasteX, G.wasteY, 100 + k); c.el.style.transform += ' scale(1.25)'; });
}
addEventListener('resize', () => th && layout());
function stockPlace(c, k) { const d = Math.min(stockCards.length - 1 - k, 6); place(c, G.stockX + d * 1.8, G.stockY - d * 1.8, 50 + (stockCards.length - k)); c.el.style.transform += ' scale(1.25)'; }
const isFree = (i) => SLOTS[i].coveredBy.every(j => mask & (1 << j));
const top = () => waste.length ? waste[waste.length - 1].r : -99;

function build() {
  const fk = D.isDaily ? 1 : F.k(), L = D.isDaily ? 6 : level, seed = D.seed || level * 15485863 + 3;
  const dl = deal(seed, L, fk) || deal(seed + 1, 1, 1);
  table.querySelectorAll('.cd').forEach(e => e.remove());
  th = THEMES[((D.isDaily ? D.seed : level) - 1) % THEMES.length]; document.body.style.setProperty('--b1', th.back[0]); document.body.style.setProperty('--b2', th.back[1]);
  mask = 0; si = 0; score = 0; streak = 0; bestStreak = 0; recorded = false; beatenShown = false; plan = null; busy = 0;
  tabCards = dl.tab.map(c => ({ ...c })); stockCards = dl.stock.map(c => ({ ...c })); waste = [{ ...dl.first }];
  layout();
  // deal animation: everything starts on the stock pile
  const all = [...tabCards, ...stockCards, ...waste];
  all.forEach(c => { cardEl(c, true); c.el.style.transition = 'none'; place(c, G.stockX, G.stockY, 5); });
  void table.offsetWidth;
  all.forEach(c => c.el.style.transition = '');
  tabCards.forEach((c, i) => setTimeout(() => { place(c, G.ox + SLOTS[i].x * G.pitch, G.oy + SLOTS[i].row * G.rowDy, 10 + SLOTS[i].row); if (i % 3 === 0) soft.click(); }, 120 + i * 28));
  stockCards.forEach((c, k) => stockPlace(c, k));
  setTimeout(() => { tabCards.forEach((c, i) => { if (isFree(i)) c.el.classList.remove('down'); }); toWaste(waste[0]); }, 120 + 28 * 28 + 120);
  tabCards.forEach((c, i) => c.el.addEventListener('pointerdown', (e) => { e.preventDefault(); tapCard(i); }));
  stockCards.forEach(c => c.el.addEventListener('pointerdown', (e) => { e.preventDefault(); draw(); }));
  ui.levels(D.isDaily ? 1 : level); if (D.isDaily) { ui.els.top.querySelector('[data-a]').textContent = '★'; ui.els.top.querySelector('[data-b]').textContent = '✓'; } refresh();
}
function toWaste(c) {
  c.el.classList.remove('down'); const k = waste.indexOf(c);
  place(c, G.wasteX, G.wasteY, 100 + k, (Math.random() - 0.5) * 6); c.el.style.transform += ' scale(1.25)';
  waste.slice(0, -4).forEach(w => w.el.style.visibility = 'hidden');
}
let idleT = 0;
setInterval(() => {
  if (state !== 'play') { idleT = 0; return; }
  if (++idleT === 7) for (let i = 0; i < 28; i++) if (!(mask & (1 << i)) && isFree(i) && adj(top(), tabCards[i].r)) { tabCards[i].el.classList.add('glow'); break; }
}, 1000);
function refresh() {
  idleT = 0; table.querySelectorAll('.glow').forEach(e => e.classList.remove('glow'));
  hud.firstChild.textContent = score.toLocaleString();
  const left = stockCards.length - si; badge.textContent = left; badge.style.display = left ? '' : 'none';
  streakEl.querySelectorAll('i').forEach((e, i) => e.classList.toggle('on', i < Math.min(streak, 10)));
  let n = 0; for (let i = 0; i < 28; i++) if (mask & (1 << i)) n++; ui.progress(n / 28);
}

function tapCard(i) {
  if (state !== 'play' || mask & (1 << i) || !isFree(i)) return;
  const c = tabCards[i];
  if (!adj(top(), c.r)) { c.el.classList.remove('shake'); void c.el.offsetWidth; c.el.classList.add('shake'); soft.err(); buzz(20); return; }
  mask |= 1 << i; waste.push(c); streak++; bestStreak = Math.max(bestStreak, streak);
  const pts = 100 + 50 * (Math.min(streak, 12) - 1); score += pts;
  const b = c.el.getBoundingClientRect();
  toWaste(c); chime(streak - 1, 67, 0.12); buzz(8);
  fx.sparks(b.left + b.width / 2, b.top + b.height / 2, ['#f0c56a', '#fff', '#ffe7b0'], 8 + Math.min(streak, 10), { speed: 2.5 + streak * 0.15, size: 3 });
  if (streak >= 3) ui.pop(`STREAK ×${streak}`, '#f0c56a', 22 + Math.min(streak, 10) * 1.6, 40);
  if (SLOTS[i].row === 0) { score += 500; setTimeout(() => { ui.pop('PEAK +500', '#fff', 34, 33); arp([76, 81, 84, 88], 70, 0.11); fx.ring(b.left + b.width / 2, b.top + b.height / 2, '#f0c56a', 50); }, 160); }
  // flip newly uncovered cards
  for (let j = 0; j < 28; j++) if (!(mask & (1 << j)) && tabCards[j].el.classList.contains('down') && isFree(j)) setTimeout(() => { tabCards[j].el.classList.remove('down'); soft.click(); }, 120);
  if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); fx.confetti(60); }
  refresh();
  if ((mask >>> 0) === (1 << 28) - 1 >>> 0) return setTimeout(win, 380);
  checkStuck();
}
function draw() {
  if (state !== 'play' || si >= stockCards.length) return;
  const c = stockCards[si++]; waste.push(c); toWaste(c); soft.swish(); soft.wood();
  if (streak >= 3) ui.pop('Streak ended', 'rgba(255,255,255,.75)', 18, 40);
  streak = 0; refresh(); checkStuck();
}
function checkStuck() {
  if (si < stockCards.length) return;
  for (let i = 0; i < 28; i++) if (!(mask & (1 << i)) && isFree(i) && adj(top(), tabCards[i].r)) return;
  setTimeout(lose, 500);
}
function cleared() { let n = 0; for (let i = 0; i < 28; i++) if (mask & (1 << i)) n++; return n / 28; }
function win() {
  if (state !== 'play') return;
  state = 'won'; if (!recorded) { recorded = true; if (!D.isDaily) F.level(true); }
  const left = stockCards.length - si, bonus = left * 250; score += bonus; refresh();
  stockCards.slice(si).forEach((c, k) => setTimeout(() => { c.el.classList.remove('down'); const x = Math.random() * innerWidth, y = -120; c.el.style.transform = `translate(${x}px,${y}px) rotate(${(Math.random() - 0.5) * 90}deg)`; chime(k, 79, 0.06); }, k * 70));
  arp([67, 71, 74, 79, 83, 86], 110, 0.12, 0.9); fx.confetti(140, ['#f0c56a', '#fff', '#d03a4c', '#7cc6a4', '#9db4ff']); buzz([20, 60, 20]);
  if (D.isDaily) { const k = 'daily_' + todayKey(), prev = S.get(k, null); if (!prev || score > prev.s) S.set(k, { s: score }); }
  else { level++; S.set('level', level); }
  const best = S.get('best', 0); if (score > best) S.set('best', score);
  D.won(score);
  ui.win(D.isDaily ? '' : level - 1, `${score.toLocaleString()} pts · best streak ${bestStreak}${left ? ` · ${left} cards spare` : ''}`);
}
function lose() {
  if (state !== 'play') return;
  state = 'lost'; if (!recorded) { recorded = true; if (!D.isDaily) F.level(false, cleared()); }
  ui.lose('Out of cards', `${Math.round(cleared() * 28)} of 28 cleared · tap to redeal`);
}
ui.onTap((which) => {
  if (which === 'start') { state = 'play'; return; }
  if (which === 'win' && D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
  build(); state = 'play';
});
build();

// ---------------------------------------------------------------- test hook: the bot follows a solver line from the current position
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play' || waste.length && waste[waste.length - 1].el.classList.contains('down')) return;
    const valid = (m) => m === -1 ? si < stockCards.length : !(mask & (1 << m)) && isFree(m) && adj(top(), tabCards[m].r);
    if (!plan || !plan.length || !valid(plan[0])) { const r = solve(tabCards.map(c => c.r), stockCards.map(c => c.r), mask, si, top() < -1 ? 0 : top(), 120000); plan = r.ok ? r.path : null; }
    if (plan && plan.length) { const m = plan.shift(); return m === -1 ? draw() : tapCard(m); }
    for (let i = 0; i < 28; i++) if (valid(i)) return tapCard(i);
    draw();
  },
};
