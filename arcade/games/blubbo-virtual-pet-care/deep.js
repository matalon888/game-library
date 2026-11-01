// Blubbo — original virtual pet. Feed, wash, tuck in and dress up a jelly blob with a leaf sprout, and play three
// mini-games with it (Sky Hop, Snack Catch, Bubble Pop). Needs drop while you play, never on a real-time clock.
import { createUI, store, buzz, note, tone, sfx } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { fx2d, startCard, cardTheme, arp, chime, soft } from './calm.js';
import { drawPet, COLORS, HATS, GLASSES, FOODS, drawFood, drawSoap, shade, INK } from './pet.js';
import { STAGES, WORLDS, rowsOf, stats } from './levels.js';

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
const P = Object.assign({ hunger: 72, clean: 80, fun: 55, energy: 85, coins: 30, xp: 0, lvl: 1, color: 0, hat: 'none', glasses: 'none', owned: ['none'], room: 0, asleep: false, trips: [], boxOpen: 0, dayBox: '' }, S.get('pet', {}));
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
  { tab: 'Hats', items: [['none', 0], ['party', 15], ['beanie', 20], ['bow', 25], ['flower', 30], ['chef', 45], ['propeller', 60], ['crown', 120], ['ears', 50], ['wizard', 90], ['halo', 150]].map(([id, price]) => ({ id, price })) },
  { tab: 'Glasses', items: [['none', 0], ['round', 20], ['heart', 30], ['star', 40], ['shades', 55], ['goggles', 70]].map(([id, price]) => ({ id, price })) },
];
const closetGrid = (n) => { const cols = n > 8 ? 6 : n, rows = Math.ceil(n / cols); return { cols, rows, w: (W - 20) / cols, h: rows > 1 ? 40 : 76 }; };
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

// ---------------------------------------------------------------- trips (deep v2): 30 hand-made trips in 3 worlds
const TRIPS = STAGES.map((s, i) => { const st = stats(s); return { ...s, n: i, w: Math.floor(i / 10), rows: rowsOf(s), total: st.pts, goldAll: st.gold, need: s.gold || 0, goal: s.kind === 'hop' ? st.rows + 1 : s.goal }; });
const KIND_ICON = { hop: '☁️', catch: '🍎', pop: '🫧' };
const TIPS = { hop: 'aim for the glowing pad', catch: 'dodge the spikes', pop: 'pop gold first' };
const KIND_HELP = { hop: 'Drag to steer · land on clouds', catch: 'Slide under the snacks', pop: 'Tap the bubbles' };
const HAT_NAMES = { party: 'Party hat', beanie: 'Beanie', bow: 'Bow', flower: 'Flower', chef: 'Chef hat', propeller: 'Propeller cap', crown: 'Crown', ears: 'Cat ears', wizard: 'Wizard hat', halo: 'Halo' };
const GLASS_NAMES = { round: 'Round specs', heart: 'Heart specs', star: 'Star specs', shades: 'Shades', goggles: 'Goggles' };
const RARE = ['crown', 'wizard', 'halo', 'propeller', 'goggles'];
const goal3 = (T) => T.need > 0 ? { k: 'gold', n: T.need } : T.kind === 'hop' ? { k: 'time', s: Math.round(T.rows.length * 1.45) } : { k: 'streak', n: 8 };
const totalStars = () => TRIPS.reduce((a, T) => a + (P.trips[T.n] || 0), 0);
const unlocked = (n) => n === 0 || (P.trips[n - 1] || 0) > 0;
const nextTrip = () => { for (const T of TRIPS) if (!(P.trips[T.n] > 0)) return T.n; for (const T of TRIPS) if (P.trips[T.n] < 3) return T.n; return 29; };
const boxesEarned = () => Math.floor(totalStars() / 6) - P.boxOpen;
const boxesAvail = () => Math.max(0, boxesEarned()) + (P.dayBox !== DAY && totalStars() > 0 ? 1 : 0);
const laneX = (c) => X0 + 30 + c * (W - 60) / 6;
const colX = (c) => X0 + 40 + c * (W - 80) / 6;
const seenKinds = S.get('seen', {});
let R = null, BX = null, MAP = { w: 0, sel: -1, t0: 0 };

function startTrip(n) {
  if (P.asleep) wake();
  const T = TRIPS[n]; mode = 'trip'; R = null; BX = null;
  const m = MG = { trip: T, n, id: T.kind, score: 0, lives: T.lives, hits: 0, gold: 0, combo: 0, maxCombo: 0, fever: 0, age: 0, items: [], floats: [], x: X0 + W / 2, tx: X0 + W / 2, rowI: 0, rowT: 24, flash: 0, shake: 0, inv: 0, mag: 0, over: false, cb: 0, freeze: 0, hold: false, y: 0, vy: 0, t0: now(), hint: seenKinds[T.kind] ? 0 : 200 };
  if (T.kind === 'hop') {
    m.cam = 0; m.plats = []; m.storms = []; const rowY = j => H - 120 - j * 78;
    T.rows.forEach((row, j) => { for (let c = 0; c < 7; c++) { const ch = row[c]; if (ch === '.') continue;
      if (ch === 'x') m.storms.push({ x0: colX(c), x: colX(c), y: rowY(j) - 34, row: j, ph: j * 1.7 + c });
      else m.plats.push({ x: colX(c), x0: colX(c), y: rowY(j), w: T.pw || 84, kind: ch, row: j + 1, vx: ch === 'm' ? (c % 2 ? -1 : 1) * (0.9 + (j % 3) * 0.25) : 0, gone: false, taken: false, crumble: 0 }); } });
    m.plats.push({ x: X0 + W / 2, x0: X0 + W / 2, y: rowY(T.rows.length), w: W - 40, kind: 'f', row: T.rows.length + 1, vx: 0 });
    const p0 = m.plats.find(p => p.row === 1 && Math.abs(p.x - colX(3)) < 1) || m.plats[0]; m.x = m.tx = p0.x; m.y = p0.y - 22; m.vy = -11.5;
  } else { m.y = H - 150; }
  if (!seenKinds[T.kind]) { seenKinds[T.kind] = 1; S.set('seen', seenKinds); }
  ui.pop(T.hard ? 'HARD TRIP' : 'GO!', '#fff', 46, 40); arp([67, 72, 79], 70, 0.1);
}
function award(m, pts, x, y, col = '#fff') {
  m.score += pts; m.combo++; m.maxCombo = Math.max(m.maxCombo, m.combo);
  m.floats.push({ x, y, s: '+' + pts, t: 1, c: col });
  chime(m.combo % 12, 72, 0.1); buzz(6);
  if (m.combo % 5 === 0) { m.cb += m.fever > 0 ? 2 : 1; ui.pop(`×${m.combo}`, '#fff', 30 + Math.min(20, m.combo), 34); fx.ring(x, y, '#ffd23f', 40); }
  if (m.combo === 10 && m.fever <= 0) { m.fever = 420; ui.pop('FEVER!', '#ffe36a', 54, 50); fx.confetti(50); arp([72, 76, 79, 84], 60, 0.12); }
  if (m.score >= m.trip.goal && !m.cleared && m.trip.kind !== 'hop') { m.cleared = true; ui.pop('CLEARED! ⭐', '#fff', 40, 46); fx.confetti(40); sfx.win(); }
}
function hurt(m, x, y, why) {
  if (m.inv > 0) return; m.lives--; m.hits++; (m.causes = m.causes || {})[why] = (m.causes[why] || 0) + 1; m.combo = 0; m.flash = 1; m.shake = 12; m.freeze = 4; m.inv = 70; A.vy += 0.3; sfx.fail(); buzz(40);
  fx.sparks(x, y, ['#ff6b6b', '#fff', '#ffd23f'], 14, { speed: 4 }); ui.pop(why, '#fff', 26, 40);
  if (m.lives <= 0) endTrip(false);
}
function stepTrip(dt) {
  const m = MG, T = m.trip; if (m.over) return;
  if (m.freeze > 0) { m.freeze -= dt; return; }
  m.age += dt; m.inv = Math.max(0, m.inv - dt); m.flash = Math.max(0, m.flash - 0.05 * dt); m.shake = Math.max(0, m.shake - dt); m.fever = Math.max(0, m.fever - dt); m.mag = Math.max(0, m.mag - dt); m.hint = Math.max(0, m.hint - dt);
  for (const f of m.floats) { f.y -= 1.2 * dt; f.t -= 0.02 * dt; } m.floats = m.floats.filter(f => f.t > 0);
  if (T.kind === 'hop') {
    m.x += (m.tx - m.x) * 0.16 * dt; if (T.wind) m.x += Math.sin(m.age / 55) * T.wind * dt; if (m.x < X0 - 10) m.x += W + 20; if (m.x > X0 + W + 10) m.x -= W + 20;
    m.vy += 0.5 * dt; m.y += m.vy * dt;
    m.aim = null; if (m.vy > 0) { let bd = 1e9; for (const p of m.plats) { if (p.gone || p.crumble > 0) continue; const dy = p.y - m.cam - (m.y + 22); if (dy < -4 || dy > 230) continue; const dx = Math.abs(m.x - p.x); if (dx < p.w / 2 + 56 && dy + dx < bd) { bd = dy + dx; m.aim = p; } } if (m.aim && Math.abs(m.x - m.aim.x) > m.aim.w / 2 - 14) m.x += (m.aim.x - m.x) * 0.035 * dt; }
    for (const p of m.plats) { if (p.vx) { p.x += p.vx * dt; if (Math.abs(p.x - p.x0) > 46) p.vx *= -1; } if (p.crumble > 0) { p.crumble -= dt; if (p.crumble <= 0) p.gone = true; } }
    if (m.vy > 0) for (const p of m.plats) { if (p.gone || p.crumble > 0) continue; const py = p.y - m.cam;
      if (Math.abs(m.x - p.x) < p.w / 2 + 12 && m.y + 22 > py - 6 && m.y + 22 < py + 12 + m.vy * dt) {
        const spring = p.kind === 's'; m.vy = spring ? -19 : -11.5; m.y = py - 22; A.vy -= spring ? 0.4 : 0.25;
        tone(500 + Math.min(600, m.score * 12), 0.06, 'sine', 0.08, 1.5); buzz(5);
        if (spring) { fx.ring(m.x, py, '#ff7aa2', 40); ui.pop('BOING!', '#fff', 30, 30); tone(300, 0.2, 'triangle', 0.1, 3); }
        if (p.kind === 'c') p.crumble = 24;
        if (p.row > m.score && p.kind !== 'b') { m.hc = (m.hc || 0) + 1; fx.sparks(m.x, py, ['#fff', '#ffd23f'], 6 + Math.min(10, m.hc), { speed: 2.5 }); A.sy = 0.78; if (m.hc % 5 === 0) { ui.pop('×' + m.hc + ' CLIMB!', '#ffd23f', 30, 30); fx.ring(m.x, py, '#ffd23f', 50); sfx.coin(); } } else if (p.row < m.score) m.hc = 0;
        if (p.kind === 'g' && !p.taken) { p.taken = true; m.gold++; m.cb++; fx.sparks(m.x, m.y - 24, ['#ffd23f', '#fff'], 14, { speed: 3.5 }); sfx.coin(); m.floats.push({ x: m.x, y: m.y - 40, s: '★', t: 1, c: '#ffd23f' }); }
        if (p.kind === 'b') p.gone = true;
        if (p.row > m.score && p.kind !== 'b') { m.score = p.row; }
        if (p.kind === 'f') { m.score = T.goal; endTrip(true); return; }
        break; } }
    for (const s of m.storms) { s.x = s.x0 + Math.sin(m.age / 40 + s.ph) * 22; const sy = s.y - m.cam; if (Math.hypot(m.x - s.x, m.y - sy) < 38) hurt(m, m.x, m.y, 'Zap!'); }
    const lim = H * 0.42; if (m.y < lim) { const d = lim - m.y; m.y = lim; m.cam -= d; }
    m.plats = m.plats.filter(p => !p.gone && p.y - m.cam < H + 120);
    if (m.y > H + 40) { if (m.lives > 1) { m.plats.push({ x: m.x, x0: m.x, y: H - 128 + m.cam, w: 120, kind: 'b', row: 0, vx: 0 }); m.y = H - 160; m.vy = -11.5; fx.ring(m.x, H - 128, '#7ec8ff', 50); } m.inv = 0; hurt(m, m.x, H - 40, 'Whoops!'); m.inv = 0; }
  } else if (T.kind === 'catch') {
    m.x += (m.tx - m.x) * 0.22 * dt; m.x = clamp(m.x, X0 + 36, X0 + W - 36);
    m.rowT -= dt; if (m.rowT <= 0 && m.rowI < T.rows.length) { const row = T.rows[m.rowI++]; m.rowT = T.gap;
      for (let c = 0; c < 7; c++) { const ch = row[c]; if (ch === '.') continue; m.items.push({ ch, x: laneX(c), y: 150, v: T.speed * (ch === 'h' ? 1.6 : ch === 'g' ? 1.15 : 1), f: FOODS[(m.rowI * 3 + c) % 6], r: c, done: false }); } }
    for (const it of m.items) { if (m.mag > 0 && !it.done && (it.ch === 'f' || it.ch === 'h' || it.ch === 'g') && it.y > m.y - 260 && Math.abs(it.x - m.x) < 170) it.x += (m.x - it.x) * 0.1 * dt; it.y += it.v * dt;
      if (!it.done && it.y > m.y - 40 && it.y < m.y + 12 + it.v * dt && Math.abs(it.x - m.x) < (it.ch === 'b' ? 28 : 48)) { it.done = true;
        if (it.ch === 'b') hurt(m, it.x, it.y, 'Ouch!');
        else if (it.ch === 'm') { m.mag = 360; ui.pop('MAGNET!', '#fff', 34, 36); fx.ring(m.x, m.y, '#ff6b6b', 60); sfx.coin(); }
        else { const pts = it.ch === 'h' ? 2 : it.ch === 'g' ? 3 : 1; if (it.ch === 'g') { m.gold++; m.cb += 1; fx.sparks(it.x, it.y, ['#ffd23f', '#fff'], 14, { speed: 4 }); } A.vy -= 0.2; award(m, pts, it.x, it.y - 20, it.ch === 'g' ? '#ffd23f' : '#fff'); fx.sparks(it.x, it.y, ['#ffd36e', '#ff7aa2', '#fff'], 7, { speed: 2.5 }); } }
      if (!it.done && it.y > H - 40) { it.done = true; if (it.ch !== 'b' && it.ch !== 'm') { m.combo = 0; if (it.ch === 'g') ui.pop('Golden missed!', '#ffe36a', 20, 36); } } }
    m.items = m.items.filter(i => !i.done);
    if (m.rowI >= T.rows.length && !m.items.length) endTrip(m.score >= T.goal);
  } else {
    m.rowT -= dt; if (m.rowT <= 0 && m.rowI < T.rows.length) { const row = T.rows[m.rowI++]; m.rowT = T.gap;
      for (let c = 0; c < 7; c++) { const ch = row[c]; if (ch === '.') continue; m.items.push({ ch, x: laneX(c), bx: laneX(c), y: H + 50, r: ch === 'B' ? 44 : ch === 'G' ? 25 : 28, hp: ch === 'B' ? 2 : 1, v: T.speed * (ch === 'G' ? 1.5 : ch === 'Z' ? 1.15 : 1), col: ['#7ec8ff', '#ff9ac0', '#ffd36e', '#9be7b0'][(m.rowI + c) % 4], ph: m.rowI + c * 1.3, age: 0, pulse: 0 }); } }
    for (const b of m.items) { b.age += dt; b.y -= b.v * dt; b.pulse = Math.max(0, b.pulse - dt); b.x = b.bx + (b.ch === 'Z' ? Math.sin(b.age / 14) * 64 : Math.sin(b.age / 25 + b.ph) * 4);
      if (!b.done && b.y < 70) { b.done = true; if (b.ch !== 'T') m.combo = 0; if (b.ch === 'G') ui.pop('Golden escaped!', '#ffe36a', 20, 36); } }
    m.items = m.items.filter(b => !b.done);
    if (m.rowI >= T.rows.length && !m.items.length) endTrip(m.score >= T.goal);
  }
  if (!m.over) { P.energy = clamp(P.energy - 0.25 * dt / 60, 0, 100); P.hunger = clamp(P.hunger - 0.3 * dt / 60, 0, 100); }
}
function tripPop(px, py) {
  const m = MG; if (!m || m.over) return false; let best = null, bd = 1e9;
  for (const b of m.items) { if (b.done) continue; const d = Math.hypot(px - b.x, py - b.y); if (d < b.r + 16 && d < bd) { best = b; bd = d; } }
  if (!best) return false; const b = best;
  if (b.ch === 'T') { b.done = true; fx.sparks(b.x, b.y, ['#7b4fd6', '#fff'], 12, { speed: 4 }); hurt(m, b.x, b.y, 'Prickly!'); return true; }
  if (--b.hp > 0) { b.pulse = 8; tone(300, 0.06, 'triangle', 0.1, 1.2); fx.ring(b.x, b.y, '#fff', b.r); buzz(8); return true; }
  b.done = true; const pts = b.ch === 'B' ? 2 : b.ch === 'G' ? 3 : 1; if (b.ch === 'G') { m.gold++; m.cb++; fx.sparks(b.x, b.y, ['#ffd23f', '#fff'], 16, { speed: 4 }); sfx.coin(); }
  award(m, pts, b.x, b.y - 10, b.ch === 'G' ? '#ffd23f' : '#fff'); fx.ring(b.x, b.y, '#fff', b.r); fx.sparks(b.x, b.y, [b.col, '#fff'], b.ch === 'B' ? 14 : 8, { speed: 3, kind: 'dot' });
  m.items = m.items.filter(i => !i.done); return true;
}
function endTrip(win) {
  const m = MG; if (!m || m.over) return; m.over = true; const T = m.trip, el = m.age / 60, g3 = goal3(T);
  const ok3 = g3.k === 'gold' ? m.gold >= g3.n : g3.k === 'time' ? el <= g3.s : m.maxCombo >= g3.n;
  const stars = [win, win && m.hits === 0, win && ok3], sc = stars.filter(Boolean).length, prev = P.trips[T.n] || 0, before = totalStars();
  P.trips[T.n] = Math.max(prev, sc); const after = totalStars();
  const happy = Math.min(P.hunger, P.clean, P.fun) >= 50;
  let coins = win ? 5 + sc * 4 + Math.floor(m.score / 5) + m.cb : 1 + Math.floor(m.score / 6) + Math.floor(m.cb / 2); if (happy) coins = Math.round(coins * 1.5);
  P.coins += coins; P.fun = clamp(P.fun + 18, 0, 100); P.energy = clamp(P.energy - 3, 0, 100); addXP(4 + sc * 3); save();
  const newBox = Math.floor(after / 6) > Math.floor(before / 6), newWorld = win && T.n % 10 === 9 && prev === 0;
  const hs = S.get('tripbest', {}), prevBest = hs[T.n] || 0; if (m.score > (hs[T.n] || 0)) { hs[T.n] = m.score; S.set('tripbest', hs); }
  const cz = Object.entries(m.causes || {}).sort((a, b) => b[1] - a[1])[0], CZ = { 'Whoops!': 'You fell off the clouds', 'Zap!': 'Storm sparks zapped you', 'Ouch!': 'Spikes got you', 'Prickly!': 'You popped a thorn bubble' };
  R = { cause: !win && cz ? (CZ[cz[0]] || 'Hit by ' + cz[0]) + (cz[1] > 1 ? ` ×${cz[1]}` : '') : '', prevBest, newBest: m.score > prevBest && prevBest > 0, T, win, stars, sc, prev, coins, happy, g3, ok3, score: m.score, hits: m.hits, gold: m.gold, maxCombo: m.maxCombo, el, newBox, newWorld, t0: now(), after, short: T.goal - m.score };
  mode = 'result'; if (win) { fx.confetti(sc === 3 ? 140 : 70); sfx.win(); } else { sfx.fail(); }
  setTimeout(() => say(win ? 'grin' : 'frown', 1500), 0); A.vy -= win ? 0.5 : 0; heart(win ? 4 : 0);
}
function openBox() {
  const pool = []; for (const [tab, key] of [[1, 'hat'], [2, 'glasses']]) for (const it of CLOSET[tab].items) if (it.price > 0 && !P.owned.includes(key + it.id)) pool.push({ tab, key, id: it.id, price: it.price });
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const picks = [0, 1, 2].map(i => pool[i] ? { item: pool[i] } : { coins: 20 + Math.floor(Math.random() * 40) });
  BX = { picks, chosen: -1, t0: now(), from: mode }; mode = 'box'; if (R) R.newBox = false; soft.swish();
}
function boxTap(px, py) {
  if (BX.chosen < 0) { for (let i = 0; i < 3; i++) { const b = giftBox(i); if (Math.hypot(px - b.x, py - b.y) < 62) {
      BX.chosen = i; BX.t1 = now(); if (boxesEarned() > 0) P.boxOpen++; else P.dayBox = DAY;
      const pk = BX.picks[i]; if (pk.item) { const it = pk.item; P.owned.push(it.key + it.id); P[it.key] = it.id; pk.rare = RARE.includes(it.id); } else P.coins += pk.coins;
      fx.confetti(pk.rare ? 160 : 80); arp(pk.rare ? [72, 76, 79, 84, 88, 91] : [72, 76, 79, 84], 70, 0.12); squish(0.4); say('grin', 1500); heart(4); save(); return; } } return; }
  if (now() - BX.t1 > 700) { mode = BX.from === 'result' && R ? 'result' : BX.from === 'map' ? 'map' : 'home'; BX = null; }
}
const giftBox = (i) => ({ x: X0 + W / 2 + (i - 1) * (W * 0.3), y: H * 0.42 + (i === 1 ? -12 : 10) });
// ----- map
const nodePos = (i) => { const idx = i % 10, top = 200, bot = H - 120; return { x: X0 + W / 2 + Math.sin(idx * 0.95 + Math.floor(i / 10) * 1.3) * W * 0.27, y: bot - idx * (bot - top) / 9 }; };
function openMap(w) { mode = 'map'; MAP.w = w ?? Math.floor(nextTrip() / 10); MAP.sel = -1; MAP.t0 = now(); soft.swish(); }
function mapTap(px, py) {
  if (MAP.sel >= 0) { const c = cardBox(); if (inBox(c.go, px, py)) { const n = MAP.sel; MAP.sel = -1; return startTrip(n); } if (!inBox(c.box, px, py)) MAP.sel = -1; return; }
  if (Math.hypot(px - (X0 + W - 34), py - 36) < 28) { mode = 'home'; soft.click(); return; }
  if (py > 20 && py < 100 && px > X0 + W / 2 - 150 && px < X0 + W / 2 - 100) { MAP.w = (MAP.w + 2) % 3; soft.click(); return; }
  if (py > 20 && py < 100 && px > X0 + W / 2 + 100 && px < X0 + W / 2 + 150) { MAP.w = (MAP.w + 1) % 3; soft.click(); return; }
  if (py > H - 70) { if (boxesAvail() > 0) openBox(); return; }
  for (let i = MAP.w * 10; i < MAP.w * 10 + 10; i++) { const p = nodePos(i); if (Math.hypot(px - p.x, py - p.y) < 34) { if (!unlocked(i)) { ui.pop('Clear the trip before it first', '#fff', 22, 30); soft.err(); return; } MAP.sel = i; soft.click(); return; } }
}
const cardBox = () => { const w = Math.min(W - 24, 340), x = X0 + (W - w) / 2, y = H - 330; return { box: { x, y, w, h: 310 }, go: { x: x + w / 2 - 80, y: y + 236, w: 160, h: 56 } }; };
function resultBtns() { const y = H * 0.22 + 340, cx = X0 + W / 2; return { map: { x: cx - 120, y, r: 30 }, retry: { x: cx - 40, y, r: 30 }, next: { x: cx + 62, y, r: 38 } }; }
function resultTap(px, py) {
  if (now() - R.t0 < 900) return; const b = resultBtns();
  if (Math.hypot(px - b.map.x, py - b.map.y) < 38) { const n = R.T.n; R = null; MG = null; openMap(Math.floor(n / 10)); return; }
  if (Math.hypot(px - b.retry.x, py - b.retry.y) < 38) return startTrip(R.T.n);
  if (Math.hypot(px - b.next.x, py - b.next.y) < 48) {
    if (R.newBox && boxesAvail() > 0) return openBox();
    if (R.win && R.T.n < 29) return startTrip(R.T.n + 1); if (!R.win) return startTrip(R.T.n); R = null; MG = null; openMap(2); }
}

// ---------------------------------------------------------------- input
function hitNav(px, py) { if (py < NAV.y || py > NAV.y + NAV.h) return -1; const w = W / 5; const i = Math.floor((px - X0) / w); return i >= 0 && i < 5 ? i : -1; }
function goRoom(i) { if (i === P.room) return; P.room = clamp(i, 0, 4); soft.wood(); A.foam = P.room === 1 ? A.foam : 0; save(); }
const trayBox = (i, n, pad = 10) => { const w = (W - pad * (n + 1)) / n; return { x: X0 + pad + i * (w + pad), y: TRAY.y, w, h: TRAY.h }; };
const inBox = (b, px, py) => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
let swipe = null;
cv.addEventListener('pointerdown', e => {
  if (state !== 'play') return; const px = e.clientX, py = e.clientY; cv.setPointerCapture(e.pointerId);
  if (mode === 'trip') { if (MG.trip.kind === 'pop') tripPop(px, py); else if (MG.trip.kind === 'hop') { MG.ax = px; MG.bx = MG.x; MG.tx = MG.x; MG.hint = Math.min(MG.hint, 20); } else { MG.tx = px; MG.hint = Math.min(MG.hint, 20); } MG.hold = true; return; }
  if (mode === 'map') return mapTap(px, py);
  if (mode === 'result') return resultTap(px, py);
  if (mode === 'box') return boxTap(px, py);
  if (mode === 'game') { if (MG.id === 'pop') popAt(px, py); else MG.tx = px; MG.hold = true; return; }
  const nv = hitNav(px, py); if (nv >= 0) return goRoom(nv);
  if (py >= 150 && py <= 202) { const cx = X0 + W / 2;
    if (px > cx + 102 && px < cx + 150) return openMap();
    if (px > cx - 118 && px < cx + 102) return startTrip(nextTrip());
    if (px > cx - 162 && px < cx - 112 && boxesAvail() > 0) return openBox(); }
  if (py > 108 && py < 148) { if (px < X0 + 60) return goRoom((P.room + 4) % 5); if (px > X0 + W - 60) return goRoom((P.room + 1) % 5); }
  const r = P.room;
  if (r === 0 && py > TRAY.y) {
    if (px < X0 + 70) { foodIdx = (foodIdx + FOODS.length - 1) % FOODS.length; soft.click(); return; }
    if (px > X0 + W - 70) { foodIdx = (foodIdx + 1) % FOODS.length; soft.click(); return; }
    dragging = { kind: 'food', f: FOODS[foodIdx], x: px, y: py, sx: px, sy: py }; A.dragFood = dragging; return;
  }
  if (r === 1 && py > TRAY.y) { if (px < X0 + W / 2) { dragging = { kind: 'soap', x: px, y: py, sx: px, sy: py }; return; } shower(); return; }
  if (r === 2 && py > TRAY.y) { if (py < TRAY.y + 62) return openMap(); for (let i = 0; i < 3; i++) if (inBox({ ...trayBox(i, 3), y: TRAY.y + 66, h: 46 }, px, py)) return startGame(i); return; }
  if (r === 3 && py > TRAY.y) return sleepToggle();
  if (r === 4 && py > TRAY.y) {
    if (py < TRAY.y + 34) { const i = Math.floor((px - X0) / (W / 3)); if (i >= 0 && i < 3) { closetTab = i; soft.click(); } return; }
    const items = CLOSET[closetTab].items, n = items.length, gd = closetGrid(n); const cx2 = Math.floor((px - X0 - 10) / gd.w), cy2 = Math.floor((py - TRAY.y - 36) / gd.h), i = cy2 * gd.cols + cx2; if (cx2 >= 0 && cx2 < gd.cols && cy2 >= 0 && i < n) wear(closetTab, items[i]); return;
  }
  if (Math.hypot(px - PET.x, py - PET.y) < PET.R * 1.1) return tickle();
  swipe = { x: px, y: py };
});
cv.addEventListener('pointermove', e => {
  const px = e.clientX, py = e.clientY; A.look = [clamp((px - PET.x) / 120, -1, 1), clamp((py - PET.y) / 160, -1, 1)];
  if ((mode === 'game' || mode === 'trip') && MG && MG.hold) MG.tx = (mode === 'trip' && MG.trip.kind === 'hop' && MG.ax !== undefined) ? MG.bx + (px - MG.ax) * 1.5 : px;
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
    const pl = 1 + Math.sin(t * 4) * 0.02; g.save(); g.translate(X0 + W / 2, y + 28); g.scale(pl, pl); rrect(-W / 2 + 18, -26 + 5, W - 36, 52, 26, '#c2457a'); rrect(-W / 2 + 18, -26, W - 36, 52, 26, '#ff5d8f'); text(`🗺️ Island trips · ⭐ ${totalStars()}/90`, 0, 7, 18); g.restore();
    GAMES.forEach((gm, i) => { const b = { ...trayBox(i, 3), y: y + 66, h: 46 }; rrect(b.x, b.y + 4, b.w, b.h - 4, 16, shade(gm.col, -0.2)); rrect(b.x, b.y, b.w, b.h - 4, 16, gm.col); text(gm.name, b.x + b.w / 2, b.y + 20, 13); text('Free play · best ' + S.get('gbest_' + gm.id, 0), b.x + b.w / 2, b.y + 35, 10, 'rgba(255,255,255,.9)', 600); });
  } else if (r === 3) {
    rrect(X0 + W / 2 - 90, y + 22, 180, 64, 22, P.asleep ? '#ffd36e' : '#6b55c9'); text(P.asleep ? '💡 Lights on' : '🌙 Lights off', X0 + W / 2, y + 62, 20, P.asleep ? '#5a3a10' : '#fff');
    text(P.asleep ? 'Sleeping… energy filling up' : 'Tuck Blubbo in to refill energy', X0 + W / 2, y + 106, 13, '#4a3a7a', 600);
  } else {
    CLOSET.forEach((c, i) => { const w = (W - 20) / 3; rrect(X0 + 10 + i * w + 3, y, w - 6, 28, 14, i === closetTab ? '#ff7aa2' : 'rgba(255,255,255,.7)'); text(c.tab, X0 + 10 + i * w + w / 2, y + 20, 15, i === closetTab ? '#fff' : '#a0607a'); });
    const items = CLOSET[closetTab].items, n = items.length, key = closetTab === 0 ? 'color' : closetTab === 1 ? 'hat' : 'glasses', gd = closetGrid(n), w = gd.w, ch = gd.h;
    items.forEach((it, i) => { const x = X0 + 10 + (i % gd.cols) * w + w / 2, cy = y + 36 + Math.floor(i / gd.cols) * ch + ch / 2; const on = P[key] === it.id; rrect(x - w / 2 + 3, cy - ch / 2 + 2, w - 6, ch - 4, 12, on ? '#fff' : 'rgba(255,255,255,.55)', on ? '#ff7aa2' : null);
      const own = closetTab === 0 || it.price === 0 || P.owned.includes(key + it.id), sm = gd.rows > 1;
      if (closetTab === 0) { g.beginPath(); g.arc(x, cy - 2, Math.min(16, w * 0.32), 0, 7); g.fillStyle = COLORS[it.id]; g.fill(); g.lineWidth = 2.5; g.strokeStyle = shade(COLORS[it.id], -0.35); g.stroke(); }
      else { if (!own) g.globalAlpha = 0.55; drawPet(g, x, cy + (sm ? 2 : 0), Math.min(sm ? 12 : 15, w * 0.3), { color: COLORS[P.color], hat: closetTab === 1 ? it.id : 'none', glasses: closetTab === 2 ? it.id : 'none', t: 0 }); g.globalAlpha = 1; }
      if (!own) text('🪙' + it.price, x, cy + ch / 2 - 5, 10, it.price > P.coins ? '#c2456a' : '#6a3a5a'); });
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
  drawHUD(); drawTray(t); drawNav(); drawPill(t);
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
// ---------------------------------------------------------------- trip drawing
function cloudShape(x, y, w, fill, shadow = true) {
  if (shadow) { g.fillStyle = 'rgba(60,100,160,.18)'; g.beginPath(); g.ellipse(x, y + 8, w / 2, 9, 0, 0, 7); g.fill(); }
  g.fillStyle = fill; g.beginPath(); g.ellipse(x, y, w / 2, 10, 0, 0, 7); g.ellipse(x - w * 0.2, y - 6, w * 0.22, 9, 0, 0, 7); g.ellipse(x + w * 0.18, y - 7, w * 0.2, 9, 0, 0, 7); g.fill();
}
function pill(x, y, w, h, c, label, size = 15, tc = '#fff') { rrect(x - w / 2, y - h / 2 + 3, w, h, h / 2, shade(c, -0.25)); rrect(x - w / 2, y - h / 2, w, h, h / 2, c); text(label, x, y + size * 0.35, size, tc); }
function drawTrip(t) {
  A.vx += (1 - A.sx) * 0.2; A.vy += (1 - A.sy) * 0.2; A.vx *= 0.8; A.vy *= 0.8; A.sx += A.vx; A.sy += A.vy;
  const m = MG, T = m.trip, wd = WORLDS[T.w], shk = m.shake > 0 ? (Math.random() - 0.5) * m.shake * 0.8 : 0;
  g.save(); g.translate(shk, shk * 0.6);
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, wd.sky[0]); gr.addColorStop(1, wd.sky[1]); g.fillStyle = gr; g.fillRect(-10, -10, innerWidth + 20, H + 20);
  if (m.fever > 0) { g.fillStyle = `hsla(${(t * 200) % 360},90%,75%,${0.12 + 0.05 * Math.sin(t * 12)})`; g.fillRect(-10, -10, innerWidth + 20, H + 20); }
  const po = { color: COLORS[P.color], hat: P.hat, glasses: P.glasses, t, sx: A.sx, sy: A.sy };
  if (T.kind === 'hop') {
    for (let i = 0; i < 6; i++) { const cy = ((i * 170 - m.cam * 0.3) % (H + 100) + H + 100) % (H + 100) - 50; g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.ellipse(X0 + (i * 97) % W, cy, 40, 12, 0, 0, 7); g.fill(); }
    if (T.wind) { g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3; g.lineCap = 'round'; const dir = Math.sign(Math.sin(m.age / 55)) || 1; for (let i = 0; i < 7; i++) { const yy = (i * 131 + m.age * 2) % H, xx = ((i * 83 + m.age * 5 * dir) % W + W) % W + X0; g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx + dir * 36, yy); g.stroke(); } }
    for (const p of m.plats) { const y = p.y - m.cam; if (y < -40 || y > H + 40) continue; const cr = p.crumble > 0 ? p.crumble / 24 : 1;
      if (p.kind === 'f') { rrect(p.x - p.w / 2, y - 6, p.w, 20, 10, '#ffd23f', INK); text('🏁 TOP', p.x, y - 16, 20, '#7a4a00'); continue; }
      if (p.kind === 'b') { g.globalAlpha = 0.6; g.beginPath(); g.ellipse(p.x, y, p.w / 2, 14, 0, 0, 7); g.fillStyle = '#bfe8ff'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke(); g.globalAlpha = 1; continue; }
      if (m.aim === p) { g.save(); g.globalAlpha = 0.45 + Math.sin(t * 10) * 0.15; g.fillStyle = '#ffe36a'; g.beginPath(); g.ellipse(p.x, y + 2, p.w / 2 + 8, 16, 0, 0, 7); g.fill(); g.restore(); }
      g.save(); if (p.crumble > 0) { g.translate((Math.random() - 0.5) * 3, (1 - cr) * 18); g.globalAlpha = cr; }
      if (p.kind === 'c') { cloudShape(p.x, y, p.w, '#ffd9e8'); g.strokeStyle = '#c2457a'; g.lineWidth = 2; g.beginPath(); g.moveTo(p.x - 8, y - 8); g.lineTo(p.x - 2, y); g.lineTo(p.x - 10, y + 6); g.moveTo(p.x + 10, y - 9); g.lineTo(p.x + 4, y); g.stroke(); }
      else if (p.kind === 's') { cloudShape(p.x, y, p.w, '#ffffff'); g.strokeStyle = '#ff5d8f'; g.lineWidth = 4; g.beginPath(); for (let k = 0; k < 6; k++) g.lineTo(p.x + (k % 2 ? 9 : -9), y - 6 - k * 3); g.stroke(); rrect(p.x - 16, y - 28, 32, 8, 4, '#ff5d8f'); }
      else if (p.kind === 'g') { cloudShape(p.x, y, p.w, '#fff7d0'); if (!p.taken) { g.save(); g.translate(p.x, y - 28 + Math.sin(t * 4 + p.x) * 3); g.rotate(Math.sin(t * 2) * 0.2); g.font = '26px system-ui'; g.textAlign = 'center'; g.fillText('⭐', 0, 8); g.restore(); } }
      else cloudShape(p.x, y, p.w, p.vx ? '#fff4c8' : '#ffffff');
      g.restore(); }
    for (const s of m.storms) { const y = s.y - m.cam; if (y < -60 || y > H + 60) continue; g.fillStyle = '#6b6f8a'; g.beginPath(); g.ellipse(s.x, y, 34, 17, 0, 0, 7); g.ellipse(s.x - 16, y - 8, 17, 14, 0, 0, 7); g.ellipse(s.x + 14, y - 10, 16, 13, 0, 0, 7); g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
      if (Math.sin(t * 9 + s.ph) > 0.2) { g.fillStyle = '#ffe36a'; g.beginPath(); g.moveTo(s.x - 4, y + 10); g.lineTo(s.x + 6, y + 10); g.lineTo(s.x - 2, y + 22); g.lineTo(s.x + 7, y + 22); g.lineTo(s.x - 8, y + 38); g.lineTo(s.x - 3, y + 25); g.lineTo(s.x - 9, y + 25); g.closePath(); g.fill(); } }
    if (m.inv > 0 && Math.floor(m.inv / 4) % 2) g.globalAlpha = 0.45;
    drawPet(g, m.x, m.y, 22, { ...po, mouth: m.vy < 0 ? 'grin' : 'o', look: [0, m.vy > 0 ? 1 : -1] }); g.globalAlpha = 1;
  } else if (T.kind === 'catch') {
    g.fillStyle = 'rgba(255,255,255,.28)'; for (let x = 0; x < innerWidth; x += 40) for (let y = 150; y < m.y; y += 40) if (((x + y) / 40) % 2 === 0) g.fillRect(x, y, 40, 40);
    g.fillStyle = '#ffffff'; g.fillRect(0, m.y + 22, innerWidth, 10); g.fillStyle = shade(wd.col, -0.1); g.fillRect(0, m.y + 28, innerWidth, H);
    for (const it of m.items) { const al = clamp((it.y - 130) / 50, 0, 1); g.globalAlpha = al;
      if (it.ch === 'b') { g.save(); g.translate(it.x, it.y); g.rotate(it.y * 0.04); g.beginPath(); for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, q = k % 2 ? 12 : 20; g.lineTo(Math.cos(a) * q, Math.sin(a) * q); } g.closePath(); g.fillStyle = '#7d8494'; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke(); g.restore(); }
      else if (it.ch === 'm') { g.save(); g.translate(it.x, it.y); g.rotate(Math.sin(t * 5) * 0.3); g.lineWidth = 11; g.lineCap = 'butt'; g.strokeStyle = '#ff5d5d'; g.beginPath(); g.arc(0, 0, 16, Math.PI, 0); g.stroke(); g.fillStyle = '#e8eef5'; g.fillRect(-22, 0, 12, 10); g.fillRect(10, 0, 12, 10); g.restore(); }
      else { if (it.ch === 'g') { const gg = g.createRadialGradient(it.x, it.y, 4, it.x, it.y, 46); gg.addColorStop(0, 'rgba(255,230,90,.9)'); gg.addColorStop(1, 'rgba(255,230,90,0)'); g.fillStyle = gg; g.beginPath(); g.arc(it.x, it.y, 46, 0, 7); g.fill(); }
        drawFood(g, it.ch === 'h' ? FOODS[4] : it.f, it.x, it.y, it.ch === 'h' ? 70 : 52); if (it.ch === 'g') { g.save(); g.translate(it.x + 22, it.y - 22); g.rotate(t * 2); g.font = '20px system-ui'; g.textAlign = 'center'; g.fillText('✨', 0, 7); g.restore(); } if (it.ch === 'h') text('×2', it.x + 26, it.y - 24, 16, '#c2457a'); }
      g.globalAlpha = 1; }
    const near = m.items.some(i => i.ch !== 'b' && i.y > m.y - 160 && Math.abs(i.x - m.x) < 60);
    if (m.mag > 0) { g.beginPath(); g.arc(m.x, m.y, 60 + Math.sin(t * 8) * 4, 0, 7); g.lineWidth = 4; g.strokeStyle = `rgba(255,93,93,${0.3 + 0.3 * Math.sin(t * 8)})`; g.stroke(); }
    if (m.inv > 0 && Math.floor(m.inv / 4) % 2) g.globalAlpha = 0.45;
    drawPet(g, m.x, m.y, 34, { ...po, mouth: m.flash > 0.5 ? 'frown' : near ? 'open' : 'grin', look: [0, -1] }); g.globalAlpha = 1;
  } else {
    g.fillStyle = 'rgba(255,255,255,.3)'; for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(X0 + (i * 71) % W, ((i * 133 - m.age * 2) % H + H) % H, 6 + (i % 4) * 4, 0, 7); g.fill(); }
    for (const b of m.items) { const wob = Math.sin(m.age / 12 + b.ph) * 0.06 + (b.pulse > 0 ? 0.12 : 0); g.save(); g.translate(b.x, b.y); g.scale(1 + wob, 1 - wob);
      if (b.ch === 'T') { g.beginPath(); for (let k = 0; k < 20; k++) { const a = k * Math.PI / 10, q = k % 2 ? b.r : b.r + 9; g.lineTo(Math.cos(a) * q, Math.sin(a) * q); } g.closePath(); g.fillStyle = '#7b4fd6'; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke(); text('✖', 0, 8, 22); }
      else { const base = b.ch === 'G' ? '#ffd23f' : b.col; const gr2 = g.createRadialGradient(-b.r * 0.3, -b.r * 0.4, 2, 0, 0, b.r); gr2.addColorStop(0, '#ffffff'); gr2.addColorStop(1, base);
        if (b.ch === 'G') { const gg = g.createRadialGradient(0, 0, 4, 0, 0, b.r * 2); gg.addColorStop(0, 'rgba(255,230,90,.8)'); gg.addColorStop(1, 'rgba(255,230,90,0)'); g.fillStyle = gg; g.beginPath(); g.arc(0, 0, b.r * 2, 0, 7); g.fill(); }
        g.beginPath(); g.arc(0, 0, b.r, 0, 7); g.fillStyle = gr2; g.globalAlpha = 0.88; g.fill(); g.globalAlpha = 1; g.lineWidth = b.ch === 'B' ? 6 : 3; g.strokeStyle = b.ch === 'B' ? '#b9e0ff' : '#fff'; g.stroke();
        if (b.ch === 'B' && b.hp === 1) { g.strokeStyle = '#7a8fb8'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-8, -12); g.lineTo(2, -2); g.lineTo(-6, 8); g.stroke(); }
        if (b.ch === 'Z') { g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-b.r * 0.5, 0); g.quadraticCurveTo(-b.r * 0.25, -8, 0, 0); g.quadraticCurveTo(b.r * 0.25, 8, b.r * 0.5, 0); g.stroke(); }
        g.beginPath(); g.ellipse(-b.r * 0.35, -b.r * 0.4, b.r * 0.2, b.r * 0.1, -0.6, 0, 7); g.fillStyle = '#fff'; g.fill(); }
      g.restore(); }
    drawPet(g, X0 + W / 2, H - 70, 30, { ...po, mouth: m.flash > 0.5 ? 'frown' : 'grin', look: [0, -1] });
  }
  // floating numbers
  for (const f of m.floats) { g.globalAlpha = clamp(f.t * 1.6, 0, 1); g.font = FONT(800, 26); g.textAlign = 'center'; g.lineWidth = 5; g.strokeStyle = 'rgba(90,40,90,.5)'; g.strokeText(f.s, f.x, f.y); g.fillStyle = f.c; g.fillText(f.s, f.x, f.y); g.globalAlpha = 1; }
  g.restore();
  if (m.flash > 0) { g.fillStyle = `rgba(255,60,80,${m.flash * 0.28})`; g.fillRect(0, 0, innerWidth, H); }
  // HUD
  const cx = X0 + W / 2; g.font = FONT(800, 54); g.textAlign = 'center'; g.lineWidth = 8; g.strokeStyle = 'rgba(90,40,90,.35)';
  const sc = T.kind === 'hop' ? Math.max(0, m.score - 1) : m.score; g.strokeText(String(sc), cx, 106); text(String(sc), cx, 106, 54);
  text(`${KIND_ICON[T.kind]} ${T.n + 1} · ${T.name}`.toUpperCase(), cx, 44, 13, 'rgba(60,40,90,.7)');
  const goalN = T.kind === 'hop' ? T.goal - 1 : T.goal, frac = clamp(sc / goalN, 0, 1);
  rrect(cx - 80, 118, 160, 9, 5, 'rgba(255,255,255,.6)'); rrect(cx - 80, 118, Math.max(9, 160 * frac), 9, 5, frac >= 1 ? '#ffd23f' : '#ff7aa2'); text(T.kind === 'hop' ? '🏁' : '⭐ ' + goalN, cx + 100, 128, 13, 'rgba(60,40,90,.8)');
  g.font = '20px system-ui'; g.textAlign = 'right'; g.fillText('❤️'.repeat(Math.max(0, m.lives)) + '🤍'.repeat(Math.max(0, T.lives - m.lives)), X0 + W - 12, 36);
  const g3 = goal3(T), clean = m.hits === 0, done1 = sc >= goalN;
  const chips = [[done1 ? '#ffd23f' : 'rgba(255,255,255,.55)', '⭐', done1 ? 'clear' : 'reach'], [clean ? '#7ed957' : 'rgba(150,150,170,.5)', '✨', clean ? 'clean' : 'hit'],
    [(g3.k === 'gold' ? m.gold >= g3.n : g3.k === 'streak' ? m.maxCombo >= g3.n : (m.age / 60) <= g3.s) ? (g3.k === 'gold' ? (m.gold >= g3.n ? '#ffd23f' : 'rgba(255,255,255,.55)') : g3.k === 'streak' ? (m.maxCombo >= g3.n ? '#ffd23f' : 'rgba(255,255,255,.55)') : 'rgba(255,255,255,.55)') : 'rgba(150,150,170,.5)', g3.k === 'gold' ? '🌟' : g3.k === 'streak' ? '🔥' : '⏱️', g3.k === 'gold' ? `${m.gold}/${g3.n}` : g3.k === 'streak' ? `${m.combo}/${g3.n}` : `${Math.max(0, Math.ceil(g3.s - m.age / 60))}s`]];
  chips.forEach(([c, ic, lb], i) => { const x = cx + (i - 1) * 96, y = 152; rrect(x - 42, y - 13, 84, 26, 13, c); text(ic + ' ' + lb, x, y + 6, 13, '#4a2a5a'); });
  if (m.combo >= 3) { const s = 1 + Math.min(0.5, m.combo * 0.02); g.save(); g.translate(X0 + 52, H * 0.45); g.rotate(-0.12); g.scale(s, s); text('×' + m.combo, 0, 0, 38, m.fever > 0 ? '#ffe36a' : '#fff'); g.restore(); }
  if (m.fever > 0) text('🔥 FEVER', cx, H - 24, 22, `hsl(${(t * 300) % 360},90%,60%)`);
  if (m.hint > 0) { g.globalAlpha = clamp(m.hint / 40, 0, 1); rrect(cx - 130, H - 120, 260, 44, 22, 'rgba(60,30,80,.6)'); text(KIND_HELP[T.kind], cx, H - 91, 16); g.globalAlpha = 1; }
}
function drawStars(x, y, stars, t0, size = 44, gap = 62) {
  const el = (now() - t0) / 1000;
  stars.forEach((on, i) => { const at = 0.35 + i * 0.4, k = clamp((el - at) / 0.35, 0, 1); const sx = x + (i - 1) * gap, sy = y - (i === 1 ? 12 : 0);
    g.save(); g.translate(sx, sy); g.rotate((i - 1) * 0.15);
    if (on && k > 0) { const s = 1 + 0.6 * Math.sin(k * Math.PI) * (1 - k * 0.2); g.scale(k * s, k * s); } else if (!on) g.scale(0.9, 0.9);
    g.font = `${size * 1.5}px system-ui`; g.textAlign = 'center'; g.globalAlpha = on ? 1 : 0.35; g.fillText(on ? '⭐' : '☆', 0, size * 0.5); g.restore();
    if (on && !stars._p) stars._p = {}; if (on && k > 0 && !stars._p[i]) { stars._p[i] = 1; tone(520 + i * 160, 0.14, 'triangle', 0.14, 1.5); fx.sparks(sx, sy, ['#ffd23f', '#fff'], 12, { speed: 3 }); } });
}
function goalLine(T, g3) { return [T.kind === 'hop' ? 'Reach the top 🏁' : `Reach ${T.goal} points`, 'No hits, no falls ✨', g3.k === 'gold' ? `Collect ${g3.n} golden ${T.kind === 'hop' ? 'star clouds' : T.kind === 'catch' ? 'snacks' : 'bubbles'}` : g3.k === 'streak' ? `Streak of ${g3.n}` : `Top in ${g3.s}s`]; }
function drawResult(t) {
  const r = R, cx = X0 + W / 2, y0 = H * 0.22; g.fillStyle = 'rgba(40,20,60,.5)'; g.fillRect(0, 0, innerWidth, H);
  const gN = r.T.kind === 'hop' ? r.T.goal - 1 : r.T.goal, close = r.short > 0 && r.short <= Math.max(2, Math.ceil(gN * 0.2));
  const k = clamp((now() - r.t0) / 250, 0, 1), e = 1 - Math.pow(1 - k, 3); g.save(); g.translate(cx, y0 + 190); g.scale(0.85 + 0.15 * e, 0.85 + 0.15 * e); g.translate(-cx, -(y0 + 190));
  rrect(cx - 160, y0 - 10, 320, 410, 28, 'rgba(255,248,240,.97)', '#ff7aa2');
  text(r.win ? (r.sc === 3 ? 'PERFECT!' : 'CLEARED!') : (close ? 'SO CLOSE!' : 'TRY AGAIN'), cx, y0 + 38, 34, r.win ? '#ff5d8f' : '#8b6cf0');
  text(`${r.T.name}`, cx, y0 + 62, 14, '#6a3a5a', 700);
  drawStars(cx, y0 + 112, r.stars, r.t0);
  const gl = goalLine(r.T, r.g3);
  gl.forEach((s, i) => { const ok = r.stars[i]; text((ok ? '✔ ' : '○ ') + s, cx, y0 + 168 + i * 24, 15, ok ? '#2f9e5b' : '#8a6a7a', 700); });
  const line = r.win ? `${r.score - (r.T.kind === 'hop' ? 1 : 0)} pts · 🪙+${r.coins}${r.happy ? ' · happy ×1.5' : ''}` : (close ? (r.T.kind === 'hop' ? `${r.short} pad${r.short === 1 ? '' : 's'} from the top` : `${r.short} point${r.short === 1 ? '' : 's'} short`) + (r.cause ? ' · ' + r.cause : '') : `${r.score - (r.T.kind === 'hop' ? 1 : 0)} of ${gN} · ${r.cause || TIPS[r.T.kind]}`) + ` · 🪙+${r.coins}`;
  { const parts = line.split(' · '); let l1 = parts[0], l2 = parts.slice(1).join(' · '); while (parts.length > 2 && l1.length + parts[1].length < 26) { l1 += ' · ' + parts.splice(1, 1)[0]; l2 = parts.slice(1).join(' · '); }
    if (l2) { text(l1, cx, y0 + 248, 15, '#6a3a5a'); text(l2, cx, y0 + 268, 13, '#6a3a5a'); } else text(l1, cx, y0 + 256, 15, '#6a3a5a'); }
  if (r.newBox) { const p = 1 + Math.sin(t * 8) * 0.05; g.save(); g.translate(cx, y0 + 290); g.scale(p, p); text('🎁 New surprise box!', 0, 0, 17, '#ff5d8f'); g.restore(); }
  else if (r.newBest) text('🏆 New best!', cx, y0 + 288, 16, '#e0a000');
  else if (r.win && r.sc < 3 && r.prev < 3) text(`${3 - r.sc} more ⭐ here`, cx, y0 + 288, 14, '#a0607a', 700);
  const b = resultBtns();
  [['map', '🗺️', '#8b6cf0'], ['retry', '🔄', '#ffb72e'], ['next', r.win ? '▶️' : '🔄', '#ff5d8f']].forEach(([id, ic, c]) => { const q = b[id]; const bump = id === 'next' ? 1 + Math.sin(t * 6) * 0.04 : 1; g.save(); g.translate(q.x, q.y); g.scale(bump, bump); g.beginPath(); g.arc(0, 4, q.r, 0, 7); g.fillStyle = shade(c, -0.3); g.fill(); g.beginPath(); g.arc(0, 0, q.r, 0, 7); g.fillStyle = c; g.fill(); text(ic, 0, q.r * 0.3, q.r * 0.85); g.restore(); });
  g.restore();
  drawPet(g, cx, H * 0.84, 40, { color: COLORS[P.color], hat: P.hat, glasses: P.glasses, t, mouth: r.win ? 'grin' : 'frown', sx: A.sx, sy: A.sy, look: [0, 0] });
}
function drawMap(t) {
  const w = MAP.w, wd = WORLDS[w], cx = X0 + W / 2; const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, wd.sky[0]); gr.addColorStop(1, wd.sky[1]); g.fillStyle = gr; g.fillRect(0, 0, innerWidth, H);
  for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(X0 + (i * 131 + t * 6) % (W + 80) - 20, 200 + i * 130, 46, 14, 0, 0, 7); g.fill(); }
  // header
  g.beginPath(); g.arc(X0 + W - 34, 36, 22, 0, 7); g.fillStyle = 'rgba(255,255,255,.8)'; g.fill(); text('✕', X0 + W - 34, 44, 20, '#6a3a5a');
  text('‹', cx - 125, 56, 44, 'rgba(60,30,70,.6)'); text('›', cx + 125, 56, 44, 'rgba(60,30,70,.6)');
  text(`${wd.icon} ${wd.name}`, cx, 50, 26, '#4a2a5a'); text(wd.hint, cx, 74, 12, 'rgba(74,42,90,.7)', 600);
  const ws = TRIPS.slice(w * 10, w * 10 + 10).reduce((a, T) => a + (P.trips[T.n] || 0), 0); text(`⭐ ${ws}/30 here · ${totalStars()}/90`, cx, 100, 14, '#6a3a5a');
  rrect(cx - 80, 110, 160, 8, 4, 'rgba(255,255,255,.7)'); rrect(cx - 80, 110, 160 * (totalStars() % 6) / 6, 8, 4, '#ff7aa2'); text(`🎁 every 6 ⭐ · ${6 - totalStars() % 6} to go`, cx, 136, 12, '#6a3a5a', 700);
  // path
  g.lineCap = 'round'; g.lineWidth = 16; g.strokeStyle = 'rgba(255,255,255,.7)'; g.beginPath(); for (let i = w * 10; i < w * 10 + 10; i++) { const p = nodePos(i); i === w * 10 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y); } g.stroke();
  g.setLineDash([2, 18]); g.lineWidth = 5; g.strokeStyle = wd.col; g.stroke(); g.setLineDash([]);
  const nxt = nextTrip();
  for (let i = w * 10; i < w * 10 + 10; i++) { const T = TRIPS[i], p = nodePos(i), un = unlocked(i), st = P.trips[i] || 0, boss = !!T.hard, r = boss ? 31 : 25, cur = i === nxt;
    const pulse = cur ? 1 + Math.sin(t * 5) * 0.08 : 1; g.save(); g.translate(p.x, p.y); g.scale(pulse, pulse);
    g.beginPath(); g.arc(0, 4, r, 0, 7); g.fillStyle = un ? shade(wd.col, -0.4) : '#8a8a9a'; g.fill();
    g.beginPath(); g.arc(0, 0, r, 0, 7); g.fillStyle = !un ? '#b5b5c4' : st === 3 ? '#ffd23f' : st > 0 ? wd.col : '#fff'; g.fill(); g.lineWidth = boss ? 5 : 3; g.strokeStyle = boss ? '#e8335c' : cur ? '#ff5d8f' : '#fff'; g.stroke();
    if (un) { g.font = `${boss ? 24 : 20}px system-ui`; g.textAlign = 'center'; g.fillText(boss ? '👑' : KIND_ICON[T.kind], 0, boss ? 3 : 2); text(String(i + 1), 0, boss ? 24 : 20, 11, '#4a2a5a'); } else text('🔒', 0, 7, 18);
    g.restore();
    if (un) for (let s = 0; s < 3; s++) { g.font = '13px system-ui'; g.textAlign = 'center'; g.globalAlpha = s < st ? 1 : 0.3; g.fillText(s < st ? '⭐' : '☆', p.x + (s - 1) * 15, p.y + r + 16 + (s === 1 ? 3 : 0)); g.globalAlpha = 1; }
    if (cur) text('▼', p.x, p.y - r - 8 + Math.sin(t * 6) * 3, 18, '#ff5d8f'); }
  // blubbo on current node
  if (Math.floor(nxt / 10) === w) { const p = nodePos(nxt); drawPet(g, p.x + 56 * (p.x > cx ? -1 : 1), p.y - 6 + Math.sin(t * 4) * 3, 17, { color: COLORS[P.color], hat: P.hat, glasses: P.glasses, t, mouth: 'grin', look: [0, 0] }); }
  // bottom bar
  const bx = boxesAvail(); rrect(X0 + 12, H - 62, W - 24, 46, 23, bx > 0 ? '#ff7aa2' : 'rgba(255,255,255,.7)'); text(bx > 0 ? `🎁 Open surprise box${bx > 1 ? 'es ×' + bx : ''}` : `🪙 ${P.coins} · ⭐ Lv ${P.lvl}`, cx, H - 32, 18, bx > 0 ? '#fff' : '#6a3a5a');
  if (MAP.sel >= 0) {
    const T = TRIPS[MAP.sel], c = cardBox(), st = P.trips[T.n] || 0, g3 = goal3(T); g.fillStyle = 'rgba(40,20,60,.35)'; g.fillRect(0, 0, innerWidth, H);
    rrect(c.box.x, c.box.y, c.box.w, c.box.h, 26, '#fff8f0', T.hard ? '#e8335c' : '#ff7aa2'); const mx = c.box.x + c.box.w / 2;
    text(`${KIND_ICON[T.kind]} Trip ${T.n + 1}${T.hard ? ' · HARD' : ''}`, mx, c.box.y + 30, 14, T.hard ? '#e8335c' : '#a0607a', 800); text(T.name, mx, c.box.y + 62, 28, '#4a2a5a');
    const words = T.purpose.split(' '); let line = '', ly = c.box.y + 88; g.font = FONT(600, 13); for (const wd2 of words) { if (g.measureText(line + wd2).width > c.box.w - 40) { text(line, mx, ly, 13, '#6a3a5a', 600); ly += 17; line = ''; } line += wd2 + ' '; } text(line, mx, ly, 13, '#6a3a5a', 600);
    goalLine(T, g3).forEach((s, i) => text((i < st || (i === 0 && st > 0) ? '⭐ ' : '☆ ') + s, mx, c.box.y + 150 + i * 24, 15, i < st ? '#2f9e5b' : '#6a3a5a', 700));
    const b = c.go, pl = 1 + Math.sin(t * 6) * 0.03; g.save(); g.translate(b.x + b.w / 2, b.y + b.h / 2); g.scale(pl, pl); rrect(-b.w / 2, -b.h / 2 + 4, b.w, b.h, 28, '#c2457a'); rrect(-b.w / 2, -b.h / 2, b.w, b.h, 28, '#ff5d8f'); text('▶ GO', 0, 8, 26); g.restore();
  }
}
function drawBox(t) {
  const cx = X0 + W / 2, b = BX; const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#4a2a7a'); bg.addColorStop(1, '#8b4a9a'); g.fillStyle = bg; g.fillRect(0, 0, innerWidth, H);
  if (b.chosen < 0) {
    text('🎁 Pick a gift!', cx, H * 0.2, 32, '#fff'); text('One of three holds a new look', cx, H * 0.2 + 28, 15, 'rgba(255,255,255,.8)', 600);
    for (let i = 0; i < 3; i++) { const q = giftBox(i), w = Math.sin(t * 5 + i * 2) * 0.1; g.save(); g.translate(q.x, q.y); g.rotate(w); rrect(-44, -34, 88, 74, 14, ['#ff7aa2', '#7ec8ff', '#ffd23f'][i], '#fff'); g.fillStyle = '#fff'; g.fillRect(-7, -34, 14, 74); rrect(-50, -52, 100, 24, 10, '#fff'); text('?', 0, 28, 40, '#fff'); g.restore(); }
  } else {
    const pk = b.picks[b.chosen], k = clamp((now() - b.t1) / 400, 0, 1);
    text(pk.rare ? '✨ RARE! ✨' : 'You got', cx, H * 0.17, pk.rare ? 38 : 28, pk.rare ? '#ffe36a' : '#fff');
    if (pk.item) { const it = pk.item, nm = (it.key === 'hat' ? HAT_NAMES : GLASS_NAMES)[it.id] || it.id; text(nm + '!', cx, H * 0.17 + 44, 30, '#fff'); drawPet(g, cx, H * 0.46, 92 * (0.6 + 0.4 * k), { color: COLORS[P.color], hat: P.hat, glasses: P.glasses, t, mouth: 'grin', look: [0, 0], sx: A.sx, sy: A.sy }); }
    else { text('🪙 +' + pk.coins, cx, H * 0.4, 46, '#ffe36a'); drawPet(g, cx, H * 0.6, 70, { color: COLORS[P.color], hat: P.hat, glasses: P.glasses, t, mouth: 'grin', look: [0, 0] }); }
    if (now() - b.t1 > 700) text('tap to continue', cx, H * 0.88, 16, 'rgba(255,255,255,.8)');
    // other gifts, dim
    b.picks.forEach((q, i) => { if (i === b.chosen) return; const s = giftBox(i); g.globalAlpha = 0.5; const lab = q.item ? ((q.item.key === 'hat' ? HAT_NAMES : GLASS_NAMES)[q.item.id] || q.item.id) : '🪙' + q.coins; text(lab, s.x, H * 0.76, 13, '#fff', 700); g.globalAlpha = 1; });
  }
}
function drawPill(t) {
  const cx = X0 + W / 2, y = 176, n = nextTrip(), T = TRIPS[n]; const bx = boxesAvail();
  const wpl = 1 + Math.sin(t * 5) * 0.03; g.save(); g.translate(cx - 6, y); g.scale(wpl, wpl);
  rrect(-112, -22 + 4, 224, 44, 22, '#c2457a'); rrect(-112, -22, 224, 44, 22, '#ff5d8f'); text(`▶ Trip ${n + 1} · ${T.name}`, 0, 6, 16); g.restore();
  g.beginPath(); g.arc(cx + 126, y, 22, 0, 7); g.fillStyle = '#8b6cf0'; g.fill(); text('🗺️', cx + 126, y + 8, 22);
  if (bx > 0) { const p = 1 + Math.sin(t * 7) * 0.1; g.save(); g.translate(cx - 136, y); g.scale(p, p); g.beginPath(); g.arc(0, 0, 22, 0, 7); g.fillStyle = '#ffd23f'; g.fill(); text('🎁', 0, 8, 22); g.beginPath(); g.arc(14, -14, 9, 0, 7); g.fillStyle = '#e8335c'; g.fill(); text(String(bx), 14, -9, 12); g.restore(); }
}

let last = now();
function frame() {
  const t = now() / 1000, dt = Math.min(2.5, (now() - last) / 16.67); last = now();
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = '#ffe3cf'; g.fillRect(0, 0, innerWidth, innerHeight);
  if (state === 'play' && (mode === 'trip' || mode === 'result') && MG) { if (mode === 'trip') stepTrip(dt); drawTrip(t); if (mode === 'result' && R) drawResult(t); }
  else if (state === 'play' && mode === 'map') drawMap(t);
  else if (state === 'play' && mode === 'box') { if (BX.from === 'map') drawMap(t); else if (BX.from === 'result' && MG) { drawTrip(t); drawResult(t); } else drawHome(t, 0); drawBox(t); }
  else if (mode === 'game' && MG && state === 'play') { gameStep(dt); if (MG) drawGame(t, dt); else drawHome(t, 0); }
  else drawHome(t, state === 'play' ? dt : 0);
  requestAnimationFrame(frame);
}
ui.onTap(w => { state = 'play'; mode = 'home'; MG = null; if (!(P.trips[0] > 0) && !D.isDaily) startTrip(0); });
frame(); ui.start();

// ---------------------------------------------------------------- test hook
function tripBot(m, skill = 1) {
  const T = m.trip;
  if (T.kind === 'hop') {
    const apex = m.vy < 0 ? m.y - m.vy * m.vy : m.y, rank = (p) => (p.kind === 's' ? 0.5 : 0) + (p.kind === 'g' ? 0.4 : 0) - (p.kind === 'c' ? 0.2 : 0);
    let cs = m.plats.filter(p => p.kind !== 'b' && !p.gone && !p.crumble).map(p => ({ p, y: p.y - m.cam })).filter(o => o.y > apex + 14 && o.y < H + 10 && (m.vy < 0 || o.y > m.y + 10));
    const clear = (o) => !m.storms.some(s => Math.abs((s.y - m.cam) - (o.y - 34)) < 70 && Math.abs(s.x0 - o.p.x) < 56);
    const cs0 = cs; cs = cs.filter(clear); if (!cs.length) cs = cs0;
    const hi = Math.max(...cs.map(o => o.p.row), 0); const pick = cs.filter(o => o.p.row >= hi - 1).sort((a, b) => (b.p.row + rank(b.p)) - (a.p.row + rank(a.p)))[0] || cs[0];
    if (pick) m.tx = pick.p.x; else { const p0 = m.plats.find(p => p.kind === 'b'); if (p0) m.tx = p0.x; }
    for (const s of m.storms) { const sy = s.y - m.cam, dx = m.tx - s.x; if (Math.abs(sy - m.y) < 70 && Math.abs(s.x - m.x) < 64 && (Math.abs(dx) < 64 || Math.sign(m.tx - m.x) !== Math.sign(s.x - m.x))) m.tx = clamp(m.x + (m.x >= s.x ? 1 : -1) * 70, X0 + 20, X0 + W - 20); }
    return;
  }
  if (T.kind === 'catch') {
    // planner: pick the target x whose predicted catches (existing items only) score best; the player's x eases 22% per frame
    const cands = [m.x, m.tx, ...Array.from({ length: 13 }, (_, c) => X0 + 36 + c * (W - 72) / 12)];
    const val = (tx) => { let v = 0; for (const it of m.items) { if (it.done) continue; const t0 = (m.y - 40 - it.y) / it.v, t1 = (m.y + 12 - it.y) / it.v; if (t1 < 0 || t0 > 150) continue;
      const xs = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1].map(k => { const ta = Math.max(0, t0 + (t1 - t0) * k); return Math.abs(tx + (m.x - tx) * Math.pow(0.78, ta) - it.x); });
      const w = 1 / (1 + Math.max(0, t0) / 40); if (it.ch === 'b') { if (xs.some(d => d < 44)) v -= 60 * w; } else if (xs.some(d => d < 46)) v += w * (it.ch === 'g' ? 4 : it.ch === 'h' ? 2.5 : it.ch === 'm' ? 1.2 : 1.2); } return v - Math.abs(tx - m.x) * 0.002; };
    let best = m.tx, bv = val(m.tx) + 0.3; for (const c of cands) { const v = val(c); if (v > bv) { bv = v; best = c; } }
    m.tx = best; return;
  }
  if (m.age % 8 < 1) { const c = m.items.filter(b => b.ch !== 'T' && b.y < H - 10).sort((a, b) => a.y - b.y)[0]; if (c) tripPop(c.x, c.y); }
}
function simTrip(n, skill = 1, maxF = 60 * 160) {
  P.energy = 100; startTrip(n); const m = MG; m.hint = 0;
  window.__dbg = []; let h0 = 0;
  for (let f = 0; f < maxF && mode === 'trip'; f++) { P.energy = 100; tripBot(m, skill); m.items0 = m.items.map(i => ({ ...i })); stepTrip(1); if (m.hits > h0) { h0 = m.hits; window.__dbg.push({ f, row: m.rowI, x: Math.round(m.x), y: Math.round(m.y), tx: Math.round(m.tx), vy: +m.vy.toFixed(1), items: (m.items0 || []).filter(i => i.y > m.y - 200 && i.y < m.y + 60).map(i => i.ch + Math.round(i.x) + '@' + Math.round(i.y)).join(' '), storms: (m.storms || []).map(s => Math.round(s.x) + '/' + Math.round(s.y - m.cam)).join(' ') }); } }
  const r = R; return r && { n, win: r.win, stars: r.stars.filter(Boolean).length, score: r.score, goal: r.T.goal, hits: r.hits, gold: r.gold, need: r.T.need, combo: r.maxCombo, secs: Math.round(r.el) };
}
let botGame = 1;
window.__game = {
  get state() { return state; }, get level() { return P.lvl; }, get score() { return Math.max(bestToday, MG ? MG.score : 0); },
  get mode() { return mode; }, get stars() { return totalStars(); }, TRIPS, P, simTrip, startTrip, openMap, openBox, endTrip, get MG() { return MG; }, get R() { return R; }, resultTap, mapTap, boxTap, get BX() { return BX; },
  bot() {
    if (state !== 'play') return;
    if (mode === 'trip' && MG) { tripBot(MG); return; }
    if (mode === 'result') { if (now() - R.t0 > 1000) resultTap(X0 + W / 2 + 62, H * 0.22 + 340); return; }
    if (mode === 'box') { if (BX.chosen < 0) boxTap(giftBox(1).x, giftBox(1).y); else if (now() - BX.t1 > 800) boxTap(0, 0); return; }
    if (mode === 'map') { mode = 'home'; return; }
    if (mode === 'home' && !P.asleep && P.hunger >= 25) { startTrip(nextTrip()); return; }
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
