// Blubbo — original virtual pet. Feed, wash, tuck in and dress up a jelly blob with a leaf sprout, and play three
// mini-games with it (Sky Hop, Snack Catch, Bubble Pop). Needs drop while you play, never on a real-time clock.
import { createUI, store, buzz, note, tone, sfx } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { fx2d, startCard, cardTheme, arp, chime, soft } from './calm.js';
import { drawPet, COLORS, HATS, GLASSES, FOODS, drawFood, drawSoap, shade, INK } from './pet.js';

const NAME = 'Blubbo: Virtual Pet Care';
const S = store('blubbo');
const F = flow('blubbo', { par: 30, warmup: 5 });
const ui = createUI({ title: 'Blubbo', hint: 'Tap to play', hand: '', score: false, progress: false });
cardTheme({ accent: '#ff7aa2', font: "'Baloo 2',system-ui,sans-serif", serif: "'Baloo 2',system-ui,sans-serif" });
const D = daily('blubbo', ui, { name: NAME });
const B = board({ game: 'blubbo', label: 'Mini-game points', limits: { maxRun: 300, maxPerSec: 6 }, corner: 'tl' });
startCard(ui, D, { kicker: 'Your pocket jelly pet' });
const fx = fx2d(9);
const css = document.createElement('style'); css.textContent = `
  body{background:#ffe3cf}
  .hc-card{background:linear-gradient(180deg,rgba(90,40,90,.5),rgba(90,40,90,.72))}
  .hc-card h1{text-shadow:0 5px 0 #c2457a,0 10px 24px rgba(80,0,40,.35)}
  .hc-pop{-webkit-text-stroke:2px rgba(90,40,90,.5);paint-order:stroke fill}`;
document.head.appendChild(css);
ui.els.lose.querySelector('.hint').textContent = 'Tap to go home';
ui.els.win.querySelector('.hint').textContent = 'Tap to go home';

const cv = document.createElement('canvas'); cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;touch-action:none'; document.body.prepend(cv);
const g = cv.getContext('2d');
const FONT = (w, s) => `${w} ${s}px "Baloo 2",system-ui,sans-serif`;
const now = () => performance.now();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------- persistent pet
const P = Object.assign({ hunger: 72, clean: 80, fun: 55, energy: 85, coins: 30, xp: 0, lvl: 1, color: 0, hat: 'none', glasses: 'none', owned: ['none'], room: 0, asleep: false }, S.get('pet', {}));
const DAY = new Date().toISOString().slice(0, 10);
let bestToday = S.get('best_' + DAY, 0);
let state = 'ready', mode = 'home', lastScore = 0, saveT = 0;
const save = () => { clearTimeout(saveT); saveT = setTimeout(() => S.set('pet', P), 400); };

const ROOMS = [
  { name: 'Kitchen', icon: '🍽️', wall: '#ffd9b8', wall2: '#ffcfa6', floor: '#e9a77a' },
  { name: 'Bathroom', icon: '🛁', wall: '#c6f0fc', wall2: '#b2e7f7', floor: '#7fc8e0' },
  { name: 'Playroom', icon: '🎮', wall: '#dcf6c8', wall2: '#cdefb4', floor: '#9fd486' },
  { name: 'Bedroom', icon: '🛏️', wall: '#ddd2fd', wall2: '#cfc1fb', floor: '#a995e6' },
  { name: 'Closet', icon: '👕', wall: '#ffdcea', wall2: '#ffcde0', floor: '#f2a7c3' },
];
const STATS = [['hunger', '🍎', '#ff6b6b'], ['clean', '🧼', '#3fb6e8'], ['fun', '🎈', '#ffb72e'], ['energy', '💤', '#8b6cf0']];
const GAMES = [
  { id: 'hop', name: 'Sky Hop', star: 35, col: '#7ec8ff' },
  { id: 'catch', name: 'Snack Catch', star: 28, col: '#ffb36b' },
  { id: 'pop', name: 'Bubble Pop', star: 30, col: '#c7a6ff' },
];

// ---------------------------------------------------------------- layout
let W, H, X0, dpr = 1, PET, TRAY, NAV;
function layout() {
  dpr = Math.min(devicePixelRatio || 1, 2); cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  W = Math.min(innerWidth, 480); H = innerHeight; X0 = (innerWidth - W) / 2;
  NAV = { y: H - 62, h: 52 };
  TRAY = { y: H - 62 - 128, h: 118 };
  const R = clamp(Math.min(W * 0.33, (TRAY.y - 190) * 0.42), 60, 150);
  PET = { x: X0 + W / 2, y: TRAY.y - R * 0.95 - 30, R };
}
addEventListener('resize', layout); layout();

// ---------------------------------------------------------------- pet animation
const A = { sx: 1, sy: 1, vx: 0, vy: 0, blink: 0, nextBlink: 2, look: [0, 0], mouth: 'smile', mouthT: 0, chewT: 0, giggleT: 0, foam: 0, hearts: [] };
function squish(a = 0.25) { A.vy -= a; A.vx += a * 0.8; }
function say(m, ms = 700) { A.mouth = m; A.mouthT = now() + ms; }
function heart(n = 3) { for (let i = 0; i < n; i++) A.hearts.push({ x: PET.x + (Math.random() - 0.5) * PET.R, y: PET.y - PET.R * 0.6, vy: -1.2 - Math.random(), t: 1, ch: Math.random() < 0.5 ? '💗' : '✨' }); }
function addXP(n) { P.xp += n; while (P.xp >= 40 * P.lvl) { P.xp -= 40 * P.lvl; P.lvl++; fx.confetti(90); arp([72, 76, 79, 84, 88], 80, 0.12); ui.pop(`LEVEL ${P.lvl}!`, '#fff', 40, 30); } save(); }
function moodFace() {
  if (P.asleep) return 'sleep';
  if (now() < A.mouthT) return A.mouth;
  const low = Math.min(P.hunger, P.clean, P.fun, P.energy);
  if (A.dragFood && A.dragFood.near) return 'open';
  return low < 20 ? 'frown' : low < 45 ? 'smile' : 'grin';
}

// ---------------------------------------------------------------- care actions
let foodIdx = 0, closetTab = 0, dragging = null, rubT = 0, showerT = 0;
function feed(f) {
  if (P.asleep) return wake();
  if (P.hunger > 96) { say('frown', 600); ui.pop("I'm full!", '#fff', 26, 30); soft.err(); return false; }
  if (P.coins < f.price) { ui.pop('Play a game for coins!', '#fff', 24, 30); soft.err(); return false; }
  P.coins -= f.price; P.hunger = clamp(P.hunger + f.food, 0, 100); if (f.fun) P.fun = clamp(P.fun + f.fun, 0, 100); P.clean = clamp(P.clean - 3, 0, 100);
  A.chewT = now() + 900; say('chew', 900); squish(0.3); heart(2);
  for (let i = 0; i < 4; i++) setTimeout(() => tone(260 + Math.random() * 80, 0.06, 'square', 0.06, 0.6), i * 180);
  fx.sparks(PET.x, PET.y + PET.R * 0.3, ['#ffd36e', '#fff'], 8, { speed: 2.5, size: 3, kind: 'dot', g: 0.15 });
  addXP(3); buzz(10); save(); return true;
}
function rub(amount) { if (P.asleep) return; A.foam = clamp(A.foam + amount, 0, 1); if (now() - rubT > 90) { rubT = now(); tone(900 + Math.random() * 400, 0.04, 'sine', 0.05, 1.3); A.vx += 0.04; } }
function shower() {
  if (P.asleep) return wake();
  showerT = now() + 1400; const gain = 12 + A.foam * 60; P.clean = clamp(P.clean + gain, 0, 100);
  setTimeout(() => { A.foam = 0; say('grin', 900); heart(3); }, 900); for (let i = 0; i < 6; i++) setTimeout(() => tone(1800 - i * 120, 0.08, 'sine', 0.03, 0.5), i * 90);
  addXP(3); squish(0.2); save();
}
function sleepToggle() { if (P.asleep) wake(); else { P.asleep = true; soft.swish(); note(60, 0.8, 0.08); save(); } }
function wake() { P.asleep = false; say('o', 700); squish(0.35); tone(700, 0.1, 'triangle', 0.1, 1.6); save(); }
function tickle() { if (P.asleep) return wake(); if (now() - A.giggleT < 250) return; A.giggleT = now(); squish(0.4); say('grin', 600); heart(2); P.fun = clamp(P.fun + 1.5, 0, 100); tone(880 + Math.random() * 200, 0.07, 'triangle', 0.09, 1.4); buzz(8); save(); }
const CLOSET = [
  { tab: 'Colour', items: COLORS.map((c, i) => ({ id: i, price: 0 })) },
  { tab: 'Hats', items: [['none', 0], ['party', 15], ['beanie', 20], ['bow', 25], ['flower', 30], ['chef', 45], ['propeller', 60], ['crown', 120]].map(([id, price]) => ({ id, price })) },
  { tab: 'Glasses', items: [['none', 0], ['round', 20], ['heart', 30], ['star', 40], ['shades', 55]].map(([id, price]) => ({ id, price })) },
];
function wear(tab, it) {
  const key = tab === 0 ? 'color' : tab === 1 ? 'hat' : 'glasses';
  const own = tab === 0 || it.price === 0 || P.owned.includes(key + it.id);
  if (!own) { if (P.coins < it.price) { ui.pop(`Needs 🪙${it.price}`, '#fff', 26, 30); soft.err(); return; } P.coins -= it.price; P.owned.push(key + it.id); sfx.coin(); fx.sparks(PET.x, PET.y - PET.R, ['#ffd23f', '#fff', '#ff7aa2'], 22, { speed: 4 }); addXP(5); }
  P[key] = it.id; squish(0.35); say('grin', 700); chime(3, 72, 0.1); save();
}

// ---------------------------------------------------------------- mini-games
let MG = null; let mrand = Math.random;
function mkRand(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function startGame(i) {
  if (P.energy < 12) { ui.pop('Too sleepy — bedtime first!', '#fff', 24, 30); say('frown', 800); soft.err(); return; }
  if (P.asleep) wake();
  mrand = D.seed ? mkRand(D.seed * 7 + i) : Math.random;
  const gm = GAMES[i]; mode = 'game'; B.start();
  MG = { i, id: gm.id, score: 0, lives: 3, t0: now(), time: 20, items: [], x: X0 + W / 2, tx: X0 + W / 2, beaten: false, spawn: 0, coins: 0 };
  if (gm.id === 'hop') { MG.y = H - 160; MG.vy = -12; MG.cam = 0; MG.top = H - 120; MG.plats = []; for (let y = H - 120; y > -H; y -= 80) addPlat(y); MG.plats[0].x = MG.x; MG.plats[0].w = 110; }
  if (gm.id === 'catch') { MG.y = H - 150; }
  ui.pop('GO!', '#fff', 46, 40); arp([67, 72, 79], 70, 0.1);
}
function addPlat(y) {
  const h = MG.top - y, k = F.k(MG.score);
  const moving = h > 1600 && mrand() < Math.min(0.5, h / 9000) * k;
  MG.plats.push({ x: X0 + 40 + mrand() * (W - 80), y, w: clamp(84 - h / 160, 56, 84), vx: moving ? (mrand() < 0.5 ? -1 : 1) * (1 + mrand()) * k : 0, star: mrand() < 0.15, broke: false });
}
function gameStep(dt) {
  const m = MG, k = F.k(m.score), el = (now() - m.t0) / 1000;
  if (m.id === 'hop') {
    m.x += (m.tx - m.x) * 0.16 * dt; if (m.x < X0 - 10) m.x += W + 20; if (m.x > X0 + W + 10) m.x -= W + 20;
    m.vy += 0.5 * dt; m.y += m.vy * dt;
    if (m.vy > 0) for (const p of m.plats) { const py = p.y - m.cam; if (Math.abs(m.x - p.x) < p.w / 2 + 12 && m.y + 22 > py - 6 && m.y + 22 < py + 12 + m.vy * dt) { m.vy = -11.5; m.y = py - 22; A.vy -= 0.25; tone(500 + Math.min(600, m.score * 6), 0.06, 'sine', 0.08, 1.5); if (p.star) { p.star = false; m.coins += 2; fx.sparks(m.x, m.y - 20, ['#ffd23f', '#fff'], 8, { speed: 3 }); sfx.coin(); } break; } }
    for (const p of m.plats) { p.x += p.vx * dt; if (p.x < X0 + 40 || p.x > X0 + W - 40) p.vx *= -1; }
    const lim = H * 0.42; if (m.y < lim) { const d = lim - m.y; m.y = lim; m.cam -= d; }
    m.score = Math.max(m.score, Math.floor(-m.cam / 40));
    const topY = Math.min(...m.plats.map(p => p.y)); if (topY - m.cam > -40) { const gap = clamp(72 + (-m.cam) / 60 * k, 72, 168); addPlat(topY - gap * (0.85 + mrand() * 0.3)); }
    m.plats = m.plats.filter(p => p.y - m.cam < H + 40);
    if (m.y > H + 40) endGame();
  } else if (m.id === 'catch') {
    m.x += (m.tx - m.x) * 0.22 * dt; m.x = clamp(m.x, X0 + 36, X0 + W - 36);
    m.spawn -= dt; if (m.spawn <= 0) { m.spawn = clamp(46 - el * 1.3, 18, 46) / k; const bad = mrand() < 0.22 + el * 0.006; m.items.push({ x: X0 + 30 + mrand() * (W - 60), y: 160, v: (2.6 + el * 0.12) * k, bad, f: FOODS[Math.floor(mrand() * 6)], r: mrand() * 6 }); }
    for (const it of m.items) { it.y += it.v * dt; it.r += 0.05 * dt;
      if (!it.done && it.y > m.y - 40 && it.y < m.y + 10 && Math.abs(it.x - m.x) < 46) { it.done = true;
        if (it.bad) { m.lives--; sfx.fail(); buzz(40); A.vy += 0.3; fx.sparks(it.x, it.y, ['#8a8f9c', '#fff'], 10); ui.pop('Ouch!', '#fff', 26, 40); }
        else { m.score++; A.vy -= 0.2; tone(520 + (m.score % 8) * 60, 0.06, 'triangle', 0.1, 1.4); fx.sparks(it.x, it.y, ['#ffd36e', '#ff7aa2', '#fff'], 7, { speed: 2.5 }); if (m.score % 10 === 0) { m.coins += 3; ui.pop(`×${m.score}!`, '#fff', 30, 36); } } }
      if (!it.done && it.y > H - 40) { it.done = true; if (!it.bad) { m.lives--; soft.err(); ui.pop('Missed!', '#fff', 22, 40); } } }
    m.items = m.items.filter(i => !i.done && i.y < H);
    if (m.lives <= 0 || el >= m.time) endGame();
  } else {
    m.spawn -= dt; if (m.spawn <= 0) { m.spawn = clamp(34 - el * 0.9, 13, 34) / k; const thorn = el > 3 && mrand() < 0.16; m.items.push({ x: X0 + 40 + mrand() * (W - 80), y: H + 40, r: 26 + mrand() * 12, v: (1.6 + el * 0.09) * k * (0.8 + mrand() * 0.4), thorn, c: ['#7ec8ff', '#ff9ac0', '#ffd36e', '#9be7b0'][Math.floor(mrand() * 4)], ph: mrand() * 6 }); }
    for (const b of m.items) { b.y -= b.v * dt; b.x += Math.sin(now() / 400 + b.ph) * 0.4; if (!b.done && b.y < 70) { b.done = true; if (!b.thorn) { m.lives--; soft.err(); ui.pop('Escaped!', '#fff', 22, 40); } } }
    m.items = m.items.filter(b => !b.done);
    if (m.lives <= 0 || el >= m.time) endGame();
  }
  if (!m.beaten && D.beaten(m.score)) { m.beaten = true; ui.pop('BEATEN!', '#fff', 40, 30); fx.confetti(60); }
  P.energy = clamp(P.energy - 0.25 * dt / 60, 0, 100); P.hunger = clamp(P.hunger - 0.3 * dt / 60, 0, 100); P.clean = clamp(P.clean - 0.25 * dt / 60, 0, 100);
}
function popAt(px, py) {
  const m = MG; for (let i = m.items.length - 1; i >= 0; i--) { const b = m.items[i]; if (Math.hypot(px - b.x, py - b.y) < b.r + 10) {
    b.done = true;
    if (b.thorn) { m.lives--; sfx.fail(); buzz(40); fx.sparks(b.x, b.y, ['#7b4fd6', '#fff'], 12, { speed: 4 }); ui.pop('Prickly!', '#fff', 24, 40); }
    else { m.score++; note(72 + [0, 2, 4, 7, 9, 12][m.score % 6], 0.25, 0.1); fx.ring(b.x, b.y, '#fff', b.r); fx.sparks(b.x, b.y, [b.c, '#fff'], 8, { speed: 3, kind: 'dot' }); buzz(6); if (m.score % 10 === 0) { m.coins += 3; ui.pop(`×${m.score}!`, '#fff', 30, 36); } }
    return true; } }
  return false;
}
function endGame() {
  const m = MG; if (!m || mode !== 'game') return; mode = 'home';
  const sc = m.score, coins = Math.floor(sc / 3) + m.coins; lastScore = sc;
  P.coins += coins; P.fun = clamp(P.fun + 22, 0, 100); P.energy = clamp(P.energy - 8, 0, 100); addXP(5 + Math.floor(sc / 2));
  F.endless(sc); B.submit(sc, { ms: now() - m.t0 });
  if (sc > bestToday) { bestToday = sc; S.set('best_' + DAY, sc); }
  const gb = S.get('gbest_' + m.id, 0); if (sc > gb) S.set('gbest_' + m.id, sc);
  const gm = GAMES[m.i]; MG = null; save();
  if (sc >= gm.star) { state = 'won'; D.won(sc); fx.confetti(120); sfx.win(); ui.win(gm.name.toUpperCase(), `${sc} points · 🪙+${coins}`); ui.els.win.querySelector('h1').textContent = 'SUPER!'; }
  else { state = 'lost'; sfx.fail(); ui.lose('GAME OVER', `${sc} points · 🪙+${coins} · ⭐ at ${gm.star}`); }
}

// ---------------------------------------------------------------- input
function hitNav(px, py) { if (py < NAV.y || py > NAV.y + NAV.h) return -1; const w = W / 5; const i = Math.floor((px - X0) / w); return i >= 0 && i < 5 ? i : -1; }
function goRoom(i) { if (i === P.room) return; P.room = clamp(i, 0, 4); soft.wood(); A.foam = P.room === 1 ? A.foam : 0; save(); }
const trayBox = (i, n, pad = 10) => { const w = (W - pad * (n + 1)) / n; return { x: X0 + pad + i * (w + pad), y: TRAY.y, w, h: TRAY.h }; };
const inBox = (b, px, py) => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
let swipe = null;
cv.addEventListener('pointerdown', e => {
  if (state !== 'play') return; const px = e.clientX, py = e.clientY; cv.setPointerCapture(e.pointerId);
  if (mode === 'game') { if (MG.id === 'pop') popAt(px, py); else MG.tx = px; MG.hold = true; return; }
  const nv = hitNav(px, py); if (nv >= 0) return goRoom(nv);
  if (py > 108 && py < 148) { if (px < X0 + 60) return goRoom((P.room + 4) % 5); if (px > X0 + W - 60) return goRoom((P.room + 1) % 5); }
  const r = P.room;
  if (r === 0 && py > TRAY.y) {
    if (px < X0 + 70) { foodIdx = (foodIdx + FOODS.length - 1) % FOODS.length; soft.click(); return; }
    if (px > X0 + W - 70) { foodIdx = (foodIdx + 1) % FOODS.length; soft.click(); return; }
    dragging = { kind: 'food', f: FOODS[foodIdx], x: px, y: py, sx: px, sy: py }; A.dragFood = dragging; return;
  }
  if (r === 1 && py > TRAY.y) { if (px < X0 + W / 2) { dragging = { kind: 'soap', x: px, y: py, sx: px, sy: py }; return; } shower(); return; }
  if (r === 2 && py > TRAY.y) { for (let i = 0; i < 3; i++) if (inBox(trayBox(i, 3), px, py)) return startGame(i); return; }
  if (r === 3 && py > TRAY.y) return sleepToggle();
  if (r === 4 && py > TRAY.y) {
    if (py < TRAY.y + 34) { const i = Math.floor((px - X0) / (W / 3)); if (i >= 0 && i < 3) { closetTab = i; soft.click(); } return; }
    const items = CLOSET[closetTab].items, n = items.length, w = (W - 20) / Math.min(n, 8); const i = Math.floor((px - X0 - 10) / w); if (i >= 0 && i < n) wear(closetTab, items[i]); return;
  }
  if (Math.hypot(px - PET.x, py - PET.y) < PET.R * 1.1) return tickle();
  swipe = { x: px, y: py };
});
cv.addEventListener('pointermove', e => {
  const px = e.clientX, py = e.clientY; A.look = [clamp((px - PET.x) / 120, -1, 1), clamp((py - PET.y) / 160, -1, 1)];
  if (mode === 'game' && MG && MG.hold) MG.tx = px;
  if (!dragging) return; dragging.x = px; dragging.y = py;
  if (dragging.kind === 'food') dragging.near = Math.hypot(px - PET.x, py - (PET.y + PET.R * 0.2)) < PET.R * 0.9;
  if (dragging.kind === 'soap' && Math.hypot(px - PET.x, py - PET.y) < PET.R * 1.1) rub(Math.hypot(e.movementX || 4, e.movementY || 4) * 0.004);
});
cv.addEventListener('pointerup', e => {
  if (MG) MG.hold = false;
  const d = dragging; dragging = null; A.dragFood = null;
  if (swipe) { const dx = e.clientX - swipe.x; if (Math.abs(dx) > 60) goRoom((P.room + (dx < 0 ? 1 : 4)) % 5); swipe = null; }
  if (!d) return; const moved = Math.hypot(d.x - d.sx, d.y - d.sy) > 12;
  if (d.kind === 'food') { if (d.near || !moved) feed(d.f); }
  if (d.kind === 'soap' && !moved) { rub(0.35); A.foam > 0.9 && shower(); }
});
addEventListener('keydown', e => { if (mode === 'game' && MG && MG.id !== 'pop') { if (e.key === 'ArrowLeft') MG.tx = MG.x - 80; if (e.key === 'ArrowRight') MG.tx = MG.x + 80; } });

// ---------------------------------------------------------------- drawing
function rrect(x, y, w, h, r, c, stroke) { g.beginPath(); g.roundRect(x, y, w, h, r); g.fillStyle = c; g.fill(); if (stroke) { g.lineWidth = 3; g.strokeStyle = stroke; g.stroke(); } }
function text(s, x, y, size = 16, c = '#fff', w = 800, align = 'center') { g.font = FONT(w, size); g.textAlign = align; g.fillStyle = c; g.fillText(s, x, y); }
function drawRoom(t) {
  const rm = ROOMS[P.room], dark = P.room === 3 && P.asleep, floorY = PET.y + PET.R * 0.7;
  g.fillStyle = rm.wall; g.fillRect(0, 0, innerWidth, floorY);
  g.fillStyle = rm.wall2; if (P.room === 0 || P.room === 1) { for (let x = 0; x < innerWidth; x += 36) for (let y = 160; y < floorY; y += 36) if (((x + y) / 36) % 2 === 0) g.fillRect(x, y, 36, 36); }
  else for (let x = 0; x < innerWidth; x += 44) g.fillRect(x, 0, 18, floorY);
  g.fillStyle = rm.floor; g.fillRect(0, floorY, innerWidth, H - floorY); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, floorY, innerWidth, 8);
  const L = X0 + 20, R = X0 + W - 20, wy = floorY;
  // room props
  if (P.room === 0) { rrect(L, wy - 170, 70, 170, 10, '#f4f7fb', INK); g.fillStyle = INK; g.fillRect(L, wy - 110, 70, 3); rrect(L + 56, wy - 150, 6, 30, 3, '#9aa0a6'); rrect(L + 56, wy - 96, 6, 30, 3, '#9aa0a6'); rrect(R - 90, wy - 220, 90, 70, 10, '#bfe9ff', INK); g.fillStyle = INK; g.fillRect(R - 46, wy - 220, 3, 70); g.fillRect(R - 90, wy - 186, 90, 3); }
  if (P.room === 1) { rrect(R - 110, wy - 60, 110, 60, 26, '#ffffff', INK); rrect(R - 64, wy - 110, 8, 52, 4, '#9aa0a6'); rrect(L, wy - 200, 56, 66, 28, '#d8f4ff', INK); }
  if (P.room === 2) { g.beginPath(); g.arc(R - 36, wy - 26, 26, 0, 7); g.fillStyle = '#ff7a8a'; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke(); g.beginPath(); g.moveTo(R - 62, wy - 26); g.quadraticCurveTo(R - 36, wy - 40, R - 10, wy - 26); g.strokeStyle = '#fff'; g.lineWidth = 4; g.stroke(); rrect(L, wy - 60, 60, 60, 8, '#ffd36e', INK); text('A', L + 30, wy - 18, 34, '#ff7a8a'); }
  if (P.room === 3) { rrect(L, wy - 120, 30, 120, 6, '#b38a5a', INK); rrect(L - 6, wy - 150, 42, 34, 10, P.asleep ? '#5a4a7a' : '#ffe36a', INK); g.beginPath(); g.arc(R - 50, 210, 30, 0, 7); g.fillStyle = P.asleep ? '#fff6c8' : '#bfe9ff'; g.fill(); if (P.asleep) { g.beginPath(); g.arc(R - 38, 202, 26, 0, 7); g.fillStyle = rm.wall; g.fill(); } }
  if (P.room === 4) { for (let i = 0; i < 4; i++) rrect(L + i * 26, wy - 190, 22, 70, 6, ['#ff7aa2', '#7ec8ff', '#ffd36e', '#9be7b0'][i], INK); g.fillStyle = INK; g.fillRect(L - 6, wy - 196, 112, 4); rrect(R - 70, wy - 230, 70, 120, 34, '#e6f7ff', INK); }
  if (P.room === 1 && now() < showerT) { for (let i = 0; i < 26; i++) { const x = PET.x + ((i * 37) % (PET.R * 2.4)) - PET.R * 1.2, y = ((now() / 2 + i * 53) % (PET.R * 2.6)) + PET.y - PET.R * 1.8; g.fillStyle = 'rgba(80,170,240,.75)'; g.beginPath(); g.ellipse(x, y, 3, 7, 0, 0, 7); g.fill(); } }
  if (dark) { g.fillStyle = 'rgba(20,10,50,.55)'; g.fillRect(0, 0, innerWidth, H); }
}
function drawHUD() {
  // stats
  const n = 4, w = Math.min(64, (W - 140) / 4);
  STATS.forEach(([k, ic, c], i) => {
    const x = X0 + W / 2 + (i - 1.5) * (w + 6), y = 34, v = P[k] / 100;
    g.beginPath(); g.arc(x, y, 21, 0, 7); g.fillStyle = 'rgba(255,255,255,.85)'; g.fill();
    g.beginPath(); g.arc(x, y, 21, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * v); g.lineWidth = 5; g.strokeStyle = v < 0.25 ? '#e8335c' : c; g.lineCap = 'round'; g.stroke();
    g.font = '18px system-ui'; g.textAlign = 'center'; g.fillText(ic, x, y + 6);
    if (v < 0.25 && Math.sin(now() / 150) > 0) { g.beginPath(); g.arc(x + 15, y - 15, 5, 0, 7); g.fillStyle = '#e8335c'; g.fill(); }
  });
  rrect(X0 + W - 78, 74, 70, 28, 14, 'rgba(90,50,30,.25)'); text('🪙 ' + P.coins, X0 + W - 43, 94, 17);
  rrect(X0 + 8, 74, 70, 28, 14, 'rgba(90,50,30,.25)'); text('⭐ Lv ' + P.lvl, X0 + 43, 94, 15);
  g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(X0 + 14, 104, 58, 4); g.fillStyle = '#ffd23f'; g.fillRect(X0 + 14, 104, 58 * P.xp / (40 * P.lvl), 4);
  // room title
  const ty = 136; text('‹', X0 + 30, ty + 6, 40, 'rgba(60,30,70,.55)'); text('›', X0 + W - 30, ty + 6, 40, 'rgba(60,30,70,.55)');
  g.font = FONT(800, 24); g.textAlign = 'center'; g.lineWidth = 6; g.strokeStyle = 'rgba(80,40,90,.25)'; g.strokeText(ROOMS[P.room].name, X0 + W / 2, ty); text(ROOMS[P.room].name, X0 + W / 2, ty, 24);
}
function drawTray(t) {
  const r = P.room, y = TRAY.y;
  rrect(X0 + 8, y - 4, W - 16, TRAY.h + 4, 22, 'rgba(255,255,255,.55)');
  if (r === 0) {
    const f = FOODS[foodIdx]; text('‹', X0 + 36, y + 66, 46, '#a0607a'); text('›', X0 + W - 36, y + 66, 46, '#a0607a');
    if (!dragging) drawFood(g, f, X0 + W / 2, y + 48 + Math.sin(t * 3) * 3, 64);
    text(f.name, X0 + W / 2, y + 100, 17, '#6a3a5a'); text(f.price ? '🪙' + f.price : 'FREE', X0 + W / 2 - 70, y + 30, 15, f.price > P.coins ? '#e8335c' : '#6a3a5a'); text('🍎+' + f.food, X0 + W / 2 + 70, y + 30, 15, '#6a3a5a');
    text('drag to the mouth', X0 + W / 2, y + 116, 11, 'rgba(106,58,90,.7)', 600);
  } else if (r === 1) {
    if (!dragging) drawSoap(g, X0 + W * 0.28, y + 50, 70); text('Soap · rub', X0 + W * 0.28, y + 100, 16, '#2a6a8a');
    rrect(X0 + W * 0.56, y + 20, W * 0.34, 64, 20, A.foam > 0.3 ? '#3fb6e8' : '#8fd3ef'); text('🚿 Rinse', X0 + W * 0.73, y + 60, 20);
    text('Foam ' + Math.round(A.foam * 100) + '%', X0 + W * 0.73, y + 104, 14, '#2a6a8a');
  } else if (r === 2) {
    GAMES.forEach((gm, i) => { const b = trayBox(i, 3); const pulse = 1 + Math.sin(t * 4 + i) * 0.02; g.save(); g.translate(b.x + b.w / 2, b.y + b.h / 2); g.scale(pulse, pulse); g.translate(-b.x - b.w / 2, -b.y - b.h / 2);
      rrect(b.x, b.y + 6, b.w, b.h - 10, 18, shade(gm.col, -0.2)); rrect(b.x, b.y, b.w, b.h - 12, 18, gm.col);
      g.save(); g.translate(b.x + b.w / 2, b.y + 40);
      if (gm.id === 'hop') { rrect(-26, 10, 52, 12, 6, '#fff'); drawPet(g, 0, -10, 13, { color: COLORS[P.color], mouth: 'grin', t }); }
      else if (gm.id === 'catch') { drawFood(g, FOODS[0], -16, -12, 22); drawFood(g, FOODS[3], 14, -2, 22); drawPet(g, 0, 16, 10, { color: COLORS[P.color], mouth: 'open', t }); }
      else for (const [bx, by, br, c] of [[-14, -6, 12, '#7ec8ff'], [12, -14, 9, '#ff9ac0'], [8, 10, 11, '#ffd36e']]) { g.beginPath(); g.arc(bx, by, br, 0, 7); g.fillStyle = c; g.fill(); g.lineWidth = 2; g.strokeStyle = '#fff'; g.stroke(); }
      g.restore(); text(gm.name, b.x + b.w / 2, b.y + 84, 15); text('Best ' + S.get('gbest_' + gm.id, 0), b.x + b.w / 2, b.y + 100, 12, 'rgba(255,255,255,.85)', 600); g.restore(); });
  } else if (r === 3) {
    rrect(X0 + W / 2 - 90, y + 22, 180, 64, 22, P.asleep ? '#ffd36e' : '#6b55c9'); text(P.asleep ? '💡 Lights on' : '🌙 Lights off', X0 + W / 2, y + 62, 20, P.asleep ? '#5a3a10' : '#fff');
    text(P.asleep ? 'Sleeping… energy filling up' : 'Tuck Blubbo in to refill energy', X0 + W / 2, y + 106, 13, '#4a3a7a', 600);
  } else {
    CLOSET.forEach((c, i) => { const w = (W - 20) / 3; rrect(X0 + 10 + i * w + 3, y, w - 6, 28, 14, i === closetTab ? '#ff7aa2' : 'rgba(255,255,255,.7)'); text(c.tab, X0 + 10 + i * w + w / 2, y + 20, 15, i === closetTab ? '#fff' : '#a0607a'); });
    const items = CLOSET[closetTab].items, n = items.length, w = (W - 20) / Math.min(n, 8), key = closetTab === 0 ? 'color' : closetTab === 1 ? 'hat' : 'glasses';
    items.forEach((it, i) => { const x = X0 + 10 + i * w + w / 2, cy = y + 72; const on = P[key] === it.id; rrect(x - w / 2 + 3, cy - 32, w - 6, 64, 12, on ? '#fff' : 'rgba(255,255,255,.55)', on ? '#ff7aa2' : null);
      if (closetTab === 0) { g.beginPath(); g.arc(x, cy - 4, Math.min(16, w * 0.32), 0, 7); g.fillStyle = COLORS[it.id]; g.fill(); g.lineWidth = 2.5; g.strokeStyle = shade(COLORS[it.id], -0.35); g.stroke(); }
      else drawPet(g, x, cy, Math.min(15, w * 0.3), { color: COLORS[P.color], hat: closetTab === 1 ? it.id : 'none', glasses: closetTab === 2 ? it.id : 'none', t: 0 });
      const own = closetTab === 0 || it.price === 0 || P.owned.includes(key + it.id); if (!own) text('🪙' + it.price, x, cy + 27, 11, it.price > P.coins ? '#c2456a' : '#6a3a5a'); });
  }
}
function drawNav() {
  const w = W / 5; rrect(X0 + 6, NAV.y, W - 12, NAV.h, 22, 'rgba(70,40,80,.82)');
  const low = [P.hunger, P.clean, P.fun, P.energy];
  ROOMS.forEach((rm, i) => { const x = X0 + w * i + w / 2, y = NAV.y + NAV.h / 2; if (i === P.room) { g.beginPath(); g.arc(x, y, 20, 0, 7); g.fillStyle = '#ff7aa2'; g.fill(); }
    g.font = '22px system-ui'; g.textAlign = 'center'; g.fillText(rm.icon, x, y + 8);
    const need = i === 0 ? low[0] : i === 1 ? low[1] : i === 2 ? low[2] : i === 3 ? low[3] : 100; if (need < 30) { g.beginPath(); g.arc(x + 14, y - 14, 6, 0, 7); g.fillStyle = '#ffd23f'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#fff'; g.stroke(); } });
}
function petOpts(t) {
  const face = moodFace();
  return { color: COLORS[P.color], look: A.dragFood ? [clamp((A.dragFood.x - PET.x) / 100, -1, 1), clamp((A.dragFood.y - PET.y) / 100, -1, 1)] : A.look, blink: A.blink, mouth: face, sx: A.sx, sy: A.sy, dirt: clamp((60 - P.clean) / 60, 0, 1), foam: A.foam, hat: P.hat, glasses: P.glasses, sad: face === 'frown', t };
}
function drawHome(t, dt) {
  drawRoom(t);
  // pet bob + spring
  const breathe = Math.sin(t * (P.asleep ? 1.5 : 2.6)) * 0.025;
  A.vx += (1 - A.sx) * 0.18; A.vy += (1 - A.sy) * 0.18; A.vx *= 0.82; A.vy *= 0.82; A.sx += A.vx; A.sy += A.vy;
  if (t > A.nextBlink) { A.blink = 1; A.nextBlink = t + 2 + Math.random() * 3; } A.blink = Math.max(0, A.blink - 0.15);
  const o = petOpts(t); o.sx *= 1 + breathe; o.sy *= 1 - breathe;
  drawPet(g, PET.x, PET.y, PET.R, o);
  if (P.asleep) { for (let i = 0; i < 3; i++) { const k = ((t * 0.5 + i / 3) % 1); text('z', PET.x + PET.R * 0.6 + k * 40, PET.y - PET.R - k * 60, 18 + k * 18, `rgba(255,255,255,${1 - k})`); } }
  else { const low = [[P.hunger, '🍎'], [P.clean, '🛁'], [P.energy, '💤'], [P.fun, '🎈']].filter(a => a[0] < 30).sort((a, b) => a[0] - b[0])[0];
    if (low) { const bx = PET.x + PET.R * 0.95, by = PET.y - PET.R * 1.25 + Math.sin(t * 2) * 4; g.beginPath(); g.arc(bx, by, 24, 0, 7); g.arc(bx - 24, by + 26, 6, 0, 7); g.arc(bx - 32, by + 36, 3.5, 0, 7); g.fillStyle = '#fff'; g.fill(); g.font = '24px system-ui'; g.textAlign = 'center'; g.fillText(low[1], bx, by + 8); } }
  for (const h of A.hearts) { h.y += h.vy * dt; h.t -= 0.015 * dt; g.globalAlpha = Math.max(0, h.t); g.font = '22px system-ui'; g.fillText(h.ch, h.x, h.y); g.globalAlpha = 1; } A.hearts = A.hearts.filter(h => h.t > 0);
  drawHUD(); drawTray(t); drawNav();
  if (dragging) { if (dragging.kind === 'food') drawFood(g, dragging.f, dragging.x, dragging.y - 20, 64); else drawSoap(g, dragging.x, dragging.y - 10, 70); }
  // needs drift (play-time only)
  const s = dt / 60;
  if (P.asleep) { P.energy = clamp(P.energy + 5 * s, 0, 100); P.hunger = clamp(P.hunger - 0.15 * s, 0, 100); if (P.energy >= 100) wake(); }
  else { P.hunger = clamp(P.hunger - 0.45 * s, 0, 100); P.clean = clamp(P.clean - 0.22 * s, 0, 100); P.fun = clamp(P.fun - 0.35 * s, 0, 100); P.energy = clamp(P.energy - 0.18 * s, 0, 100); }
}
function drawGame(t, dt) {
  const m = MG, sky = m.id === 'hop' ? ['#7ec8ff', '#d9f2ff'] : m.id === 'catch' ? ['#ffd9b8', '#fff1e3'] : ['#d6c8ff', '#f3eeff'];
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, sky[0]); gr.addColorStop(1, sky[1]); g.fillStyle = gr; g.fillRect(0, 0, innerWidth, H);
  A.vx += (1 - A.sx) * 0.2; A.vy += (1 - A.sy) * 0.2; A.vx *= 0.8; A.vy *= 0.8; A.sx += A.vx; A.sy += A.vy;
  const po = { color: COLORS[P.color], hat: P.hat, glasses: P.glasses, t, sx: A.sx, sy: A.sy };
  if (m.id === 'hop') {
    for (let i = 0; i < 6; i++) { const cy = ((i * 170 - m.cam * 0.3) % (H + 100) + H + 100) % (H + 100) - 50; g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.ellipse(X0 + (i * 97) % W, cy, 40, 12, 0, 0, 7); g.fill(); }
    for (const p of m.plats) { const y = p.y - m.cam; g.fillStyle = 'rgba(60,100,160,.18)'; g.beginPath(); g.ellipse(p.x, y + 8, p.w / 2, 9, 0, 0, 7); g.fill(); g.fillStyle = p.vx ? '#fff4c8' : '#ffffff'; g.beginPath(); g.ellipse(p.x, y, p.w / 2, 10, 0, 0, 7); g.ellipse(p.x - p.w * 0.2, y - 6, p.w * 0.22, 9, 0, 0, 7); g.ellipse(p.x + p.w * 0.18, y - 7, p.w * 0.2, 9, 0, 0, 7); g.fill(); if (p.star) text('⭐', p.x, y - 18, 20); }
    drawPet(g, m.x, m.y, 22, { ...po, mouth: m.vy < 0 ? 'grin' : 'o', look: [0, m.vy > 0 ? 1 : -1] });
  } else if (m.id === 'catch') {
    g.fillStyle = 'rgba(255,200,160,.45)'; for (let x = 0; x < innerWidth; x += 40) for (let y = 150; y < m.y; y += 40) if (((x + y) / 40) % 2 === 0) g.fillRect(x, y, 40, 40);
    g.fillStyle = '#ffffff'; g.fillRect(0, m.y + 22, innerWidth, 10); g.fillStyle = '#e9a77a'; g.fillRect(0, m.y + 28, innerWidth, H);
    for (const it of m.items) { if (it.bad) { g.save(); g.translate(it.x, it.y); g.rotate(it.r); g.beginPath(); for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, q = k % 2 ? 12 : 20; g.lineTo(Math.cos(a) * q, Math.sin(a) * q); } g.closePath(); g.fillStyle = '#7d8494'; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke(); g.restore(); } else drawFood(g, it.f, it.x, it.y, 52); }
    const near = m.items.some(i => !i.bad && i.y > m.y - 160 && Math.abs(i.x - m.x) < 60);
    drawPet(g, m.x, m.y, 34, { ...po, mouth: near ? 'open' : 'grin', look: [0, -1] });
  } else {
    g.fillStyle = 'rgba(255,255,255,.3)'; for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(X0 + (i * 71) % W, ((i * 133 - now() / 30) % H + H) % H, 6 + (i % 4) * 4, 0, 7); g.fill(); }
    for (const b of m.items) { const wob = Math.sin(now() / 200 + b.ph) * 0.06; g.save(); g.translate(b.x, b.y); g.scale(1 + wob, 1 - wob);
      if (b.thorn) { g.beginPath(); for (let k = 0; k < 20; k++) { const a = k * Math.PI / 10, q = k % 2 ? b.r : b.r + 9; g.lineTo(Math.cos(a) * q, Math.sin(a) * q); } g.closePath(); g.fillStyle = '#7b4fd6'; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke(); text('✖', 0, 8, 22); }
      else { const gr2 = g.createRadialGradient(-b.r * 0.3, -b.r * 0.4, 2, 0, 0, b.r); gr2.addColorStop(0, '#ffffff'); gr2.addColorStop(1, b.c); g.beginPath(); g.arc(0, 0, b.r, 0, 7); g.fillStyle = gr2; g.globalAlpha = 0.85; g.fill(); g.globalAlpha = 1; g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke(); g.beginPath(); g.ellipse(-b.r * 0.35, -b.r * 0.4, b.r * 0.2, b.r * 0.1, -0.6, 0, 7); g.fillStyle = '#fff'; g.fill(); }
      g.restore(); }
    drawPet(g, X0 + W / 2, H - 70, 30, { ...po, mouth: 'grin', look: [0, -1] });
  }
  // HUD
  g.font = FONT(800, 54); g.textAlign = 'center'; g.lineWidth = 8; g.strokeStyle = 'rgba(90,40,90,.35)'; g.strokeText(String(m.score), X0 + W / 2, 112); text(String(m.score), X0 + W / 2, 112, 54);
  text(GAMES[m.i].name.toUpperCase(), X0 + W / 2, 60, 15, 'rgba(60,40,90,.6)');
  if (m.id !== 'hop') { const left = Math.max(0, m.time - (now() - m.t0) / 1000); rrect(X0 + W / 2 - 80, 128, 160, 8, 4, 'rgba(255,255,255,.6)'); rrect(X0 + W / 2 - 80, 128, 160 * left / m.time, 8, 4, '#ff7aa2'); text('❤️'.repeat(Math.max(0, m.lives)), X0 + W - 56, 64, 18); }
  text('⭐ ' + GAMES[m.i].star, X0 + W - 56, 92, 14, 'rgba(60,40,90,.6)');
}
let last = now();
function frame() {
  const t = now() / 1000, dt = Math.min(2.5, (now() - last) / 16.67); last = now();
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = '#ffe3cf'; g.fillRect(0, 0, innerWidth, innerHeight);
  if (mode === 'game' && MG && state === 'play') { gameStep(dt); if (MG) drawGame(t, dt); else drawHome(t, 0); }
  else drawHome(t, state === 'play' ? dt : 0);
  requestAnimationFrame(frame);
}
ui.onTap(w => { state = 'play'; mode = 'home'; MG = null; });
frame(); ui.start();

// ---------------------------------------------------------------- test hook
let botGame = 1;
window.__game = {
  get state() { return state; }, get level() { return P.lvl; }, get score() { return Math.max(bestToday, MG ? MG.score : 0); },
  bot() {
    if (state !== 'play') return;
    if (mode === 'game' && MG) {
      const m = MG;
      if (m.id === 'pop') { const b = m.items.filter(b => !b.thorn && b.y < H - 20).sort((a, b) => a.y - b.y)[0]; if (b) popAt(b.x, b.y); return; }
      if (m.id === 'catch') { const f = m.items.filter(i => !i.bad && !i.done && i.y < m.y).sort((a, b) => b.y - a.y)[0]; let tx = f ? f.x : X0 + W / 2; const bad = m.items.find(i => i.bad && i.y > m.y - 120 && i.y < m.y && Math.abs(i.x - tx) < 50); if (bad) tx += bad.x > tx ? -60 : 60; m.tx = tx; return; }
      const apex = m.vy < 0 ? m.y - m.vy * m.vy / 1.0 : m.y;
      const c = m.plats.map(p => ({ p, y: p.y - m.cam })).filter(o => o.y > apex + 20 && o.y < H).sort((a, b) => a.y - b.y)[0]; if (c) m.tx = c.p.x + (Math.random() - 0.5) * 20; return;
    }
    if (P.asleep) { if (P.energy > 60) { goRoom(3); sleepToggle(); } return; }
    if (P.hunger < 45) { if (P.room !== 0) return goRoom(0); const f = FOODS.filter(f => f.price <= P.coins).sort((a, b) => b.food - a.food)[0]; return feed(f); }
    if (P.clean < 40) { if (P.room !== 1) return goRoom(1); if (A.foam < 0.8) return rub(0.3); return shower(); }
    if (P.energy < 20) { if (P.room !== 3) return goRoom(3); return sleepToggle(); }
    if (P.room !== 2) return goRoom(2);
    startGame(botGame); botGame = (botGame + 1) % 3;
  },
};
