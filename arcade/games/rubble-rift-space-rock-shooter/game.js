// Rubble Rift — steer a little pod ship through a field of space rocks that split when you shoot them.
// Clear every rock to start the next, busier wave. A hunter drone shows up from wave 2. Endless; best score counts.
// Phone: left thumb = steer stick (push far to thrust), right thumb = hold to fire. Desktop: arrows/WASD + Space.
import { createUI, store, buzz, sfx, tone, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { css, arcadeCards, startCard, canvas2d, particles, shaker, keys, rr } from './arc.js';

const NAME = 'Rubble Rift: Space Rock Shooter';
const S = store('rubble-rift');
let best = S.get('best', 0);
const F = flow('rubble-rift', { par: 6000, warmup: 1500 });

const ui = createUI({ title: 'RUBBLE RIFT', hint: 'Tap to launch', hand: '🚀' });
arcadeCards({ accent: '#ff7a59', glass: 'rgba(8,6,28,.55)', glass2: 'rgba(8,6,28,.85)' });
const D = daily('rubble-rift', ui, { name: NAME });
startCard(ui, D, { kicker: 'Space rock shooter', keys: 'Arrows / WASD steer + thrust · Space fires' });
const B = board({ game: 'rubble-rift', label: 'Points', limits: { maxRun: 200000, maxPerSec: 300 }, corner: 'tl' });
css(`body{background:#0b0a24}.hc-score{font-size:40px;top:calc(48px + env(safe-area-inset-top))}.hc-sub{top:calc(90px + env(safe-area-inset-top));font-size:14px;opacity:.75}
.hc-top .hc-lvl{background:#ff7a59}.hc-top .hc-lvl.next{background:rgba(255,255,255,.15);color:#fff}.hc-top .hc-bar{background:rgba(255,255,255,.14)}.hc-top .hc-bar i{background:linear-gradient(90deg,#ff7a59,#ffd166)}`);

const V = canvas2d(), g = V.g, P = particles(), SH = shaker(), K = keys();
let W = V.W, H = V.H, U = 1, bgCache = null, stars = [];
function layout() {
  W = V.W; H = V.H; U = Math.max(0.85, Math.min(1.5, Math.min(W, H) / 420));
  bgCache = document.createElement('canvas'); bgCache.width = Math.round(W * V.dpr); bgCache.height = Math.round(H * V.dpr);
  const b = bgCache.getContext('2d'); b.scale(V.dpr, V.dpr);
  const lg = b.createLinearGradient(0, 0, 0, H); lg.addColorStop(0, '#0d0b2e'); lg.addColorStop(0.55, '#170f3d'); lg.addColorStop(1, '#25124a'); b.fillStyle = lg; b.fillRect(0, 0, W, H);
  const r = rng(77);
  for (const [cx, cy, rad, col] of [[0.2, 0.25, 0.6, 'rgba(255,94,148,.16)'], [0.85, 0.6, 0.7, 'rgba(80,140,255,.16)'], [0.45, 0.95, 0.5, 'rgba(255,170,90,.12)'], [0.7, 0.1, 0.4, 'rgba(120,255,210,.08)']]) {
    const rg = b.createRadialGradient(cx * W, cy * H, 0, cx * W, cy * H, rad * Math.max(W, H)); rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)'); b.fillStyle = rg; b.fillRect(0, 0, W, H);
  }
  for (let i = 0; i < (W * H) / 900; i++) { b.fillStyle = `rgba(255,255,255,${0.15 + r() * 0.35})`; b.fillRect(r() * W, r() * H, 1, 1); }
  stars = []; for (let i = 0; i < (W * H) / 6000; i++) stars.push({ x: r() * W, y: r() * H, s: 0.8 + r() * 1.6, p: r() * 6, d: 0.2 + r() * 0.6 });
}
V.onResize = layout; layout();

// ---------------------------------------------------------------- state
const ROCK = { 3: { r: 46, pts: 20, sp: 1 }, 2: { r: 27, pts: 50, sp: 1.5 }, 1: { r: 15, pts: 100, sp: 2.1 } };
const COLS = [['#9a7be0', '#5d3fa8', '#c8b6ff'], ['#e58a68', '#9c4a34', '#ffc4a8'], ['#d9b36c', '#8a6a2c', '#fff0b8'], ['#6fb6c9', '#2f6f82', '#c4f2ff']];
let state = 'ready', score = 0, wave = 1, lives = 3, recorded = false, beatenShown = false, nextLife = 10000;
let ship, rocks = [], shots = [], dshots = [], drone = null, droneT = 0, waveMass = 1, waveT = 0, respawnT = 0, t0 = 0, floats = [], clock = 0, fireCd = 0, rr0 = rng(1);
const ctl = { panic: 0, stick: null, fire: null, botUntil: 0, botHead: 0, botFire: false, botThrust: false };

function newShip() { return { x: W / 2, y: H * 0.5, vx: 0, vy: 0, a: -Math.PI / 2, inv: 2.5, alive: true, thrust: 0, squash: 0 }; }
function rockShape(r) {
  const n = 10 + Math.floor(r() * 4), pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, k = 0.8 + r() * 0.26; pts.push([Math.cos(a) * k, Math.sin(a) * k]); }
  const craters = []; for (let i = 0; i < 3; i++) { const a = r() * 6.28, d = r() * 0.5; craters.push([Math.cos(a) * d, Math.sin(a) * d, 0.12 + r() * 0.14]); }
  return { pts, craters };
}
function addRock(size, x, y, dir, col) {
  const fk = F.k(score), base = (40 + rr0() * 38) * U * ROCK[size].sp * Math.min(2, 1 + (wave - 1) * 0.08) * fk;
  const a = dir == null ? rr0() * Math.PI * 2 : dir;
  rocks.push({ size, x, y, vx: Math.cos(a) * base, vy: Math.sin(a) * base, r: ROCK[size].r * U, rot: rr0() * 6, vr: (rr0() - 0.5) * 1.6, shape: rockShape(rr0), col: col || COLS[Math.floor(rr0() * COLS.length)], hit: 0 });
}
function startWave(n) {
  wave = n; ui.levels(wave);
  const count = Math.min(3 + wave, 11);
  for (let i = 0; i < count; i++) {
    let x, y, k = 0;
    do { const e = rr0() * 4 | 0; x = e < 2 ? rr0() * W : (e === 2 ? 0 : W); y = e < 2 ? (e ? 0 : H) : rr0() * H; k++; } while (k < 20 && Math.hypot(x - ship.x, y - ship.y) < 180 * U);
    addRock(3, x, y);
  }
  waveMass = count * 7; droneT = 9 + rr0() * 6; ui.progress(0);
}
function massLeft() { return rocks.reduce((s, r) => s + (r.size === 3 ? 7 : r.size === 2 ? 3 : 1), 0); }

function reset() {
  rr0 = rng(D.seed || (Date.now() % 100000) + 11);
  rocks = []; shots = []; dshots = []; drone = null; floats = []; P.clear();
  score = 0; lives = 3; recorded = false; beatenShown = false; nextLife = 10000; respawnT = 0; waveT = 0;
  ship = newShip(); startWave(1);
  ui.score(0); ui.sub(D.isDaily ? 'DAILY CHALLENGE' : best ? 'BEST ' + best : '');
}

function addScore(n, x, y) {
  if (DM.on) return;   // the self-playing demo scores nothing
  score += n; ui.score(score);
  floats.push({ x, y, t: 0.8, s: '+' + n });
  if (score >= nextLife) { nextLife += 10000; lives = Math.min(lives + 1, 6); ui.pop('EXTRA SHIP!', '#7ef0c8', 34, 26); sfx.coin(); }
  if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); P.burst(W / 2, H * 0.3, ['#ff5d8f', '#ffd23f', '#3ab795', '#3a86ff', '#fff'], 80, { speed: 420, size: 5, g: 300, kind: 'conf', life: 1.6 }); }
}

function breakRock(i, bvx = 0, bvy = 0) {
  const k = rocks[i]; rocks.splice(i, 1);
  addScore(ROCK[k.size].pts, k.x, k.y);
  const n = k.size === 3 ? 26 : k.size === 2 ? 16 : 10;
  P.burst(k.x, k.y, [k.col[0], k.col[2], k.col[1]], n, { speed: 70 + k.r * 4, size: 2 + k.size * 1.2, life: 0.8, kind: 'square', drag: 0.97 });
  P.burst(k.x, k.y, ['#fff', '#ffe08a'], 8, { speed: 260, size: 3, kind: 'spark', life: 0.35 });
  P.ring(k.x, k.y, k.col[2], k.r * 1.2);
  SH.kick(k.size * 3); buzz(k.size === 3 ? 30 : 12);
  if (k.size === 3) sfx.smash(); else tone(140 + (3 - k.size) * 60, 0.16, 'sawtooth', 0.09, 0.4);
  if (k.size > 1) {
    const ba = Math.atan2(k.vy + bvy * 0.05, k.vx + bvx * 0.05);
    for (const s of [-1, 1]) addRock(k.size - 1, k.x + Math.cos(ba + s * 1.4) * k.r * 0.4, k.y + Math.sin(ba + s * 1.4) * k.r * 0.4, ba + s * (0.5 + rr0() * 0.6), k.col);
  }
  ui.progress(1 - massLeft() / waveMass);
}

function killShip() {
  if (!ship.alive) return;
  ship.alive = false; lives--; respawnT = 1.8;
  P.burst(ship.x, ship.y, ['#7ef0c8', '#ff7a59', '#fff', '#ffd166'], 40, { speed: 260, size: 4, life: 1.1, kind: 'square' });
  P.burst(ship.x, ship.y, ['#fff'], 14, { speed: 420, size: 3, kind: 'spark', life: 0.5 }); P.ring(ship.x, ship.y, '#fff', 60);
  SH.kick(16); sfx.fail(); buzz([60, 40, 90]); ui.flash(0.35);
  if (lives <= 0) gameOver();
}
function gameOver() {
  state = 'lost';
  if (!recorded) { recorded = true; F.endless(score); B.submit(score, { ms: performance.now() - t0 }); }
  const nb = score > best; best = Math.max(best, score); S.set('best', best);
  ui.lose('GAME OVER', nb && score > 0 ? `New best: ${score}!` : `Score ${score} · wave ${wave} · best ${best}`);
}

// ---------------------------------------------------------------- input: floating stick (left half) + fire (right half)
const stickR = () => 56 * Math.min(1.2, U);
const fireXY = () => ({ x: W - 78 * Math.min(1.2, U), y: H - 120 * Math.min(1.15, U) });
const stickHome = () => ({ x: 82 * Math.min(1.2, U), y: H - 120 * Math.min(1.15, U) });
addEventListener('pointerdown', e => {
  if (state !== 'play') return;
  if (e.clientX < W / 2) { const h = (e.clientY > H * 0.45) ? { x: e.clientX, y: e.clientY } : stickHome(); ctl.stick = { id: e.pointerId, ox: h.x, oy: h.y, x: e.clientX, y: e.clientY }; }
  else { ctl.fire = { id: e.pointerId }; if (fireCd <= 0) fire(); }
});
addEventListener('pointermove', e => { if (ctl.stick && ctl.stick.id === e.pointerId) { ctl.stick.x = e.clientX; ctl.stick.y = e.clientY; } });
const up = e => { if (ctl.stick && ctl.stick.id === e.pointerId) ctl.stick = null; if (ctl.fire && ctl.fire.id === e.pointerId) ctl.fire = null; };
addEventListener('pointerup', up); addEventListener('pointercancel', up);

ui.onTap(w => { if (w !== 'start') reset(); state = 'play'; t0 = performance.now(); B.start(); ctl.stick = ctl.fire = null; });
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): in wave 1, until the first touch,
// the ship turns on the spot to lead the nearest rock and blasts it (shield kept up meanwhile, never the last rocks of the wave)
const DM = demo(null, { ready: () => state === 'play' && wave === 1 && ship.alive && !ctl.stick && !ctl.fire, wait: 1500, ms: 3500 });

function fire() {
  if (!ship.alive || shots.length >= 8) return;
  const c = Math.cos(ship.a), s = Math.sin(ship.a), sp = 600 * U;
  shots.push({ x: ship.x + c * 16 * U, y: ship.y + s * 16 * U, vx: ship.vx + c * sp, vy: ship.vy + s * sp, t: 0.8 });
  fireCd = 0.15; ship.squash = 1; tone(900, 0.05, 'square', 0.045, 0.5);
}

// ---------------------------------------------------------------- update
const wrapD = (d, L) => (d > L / 2 ? d - L : d < -L / 2 ? d + L : d);
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
function update(dt) {
  clock += dt; P.update(dt); SH.update(dt);
  for (const f of floats) { f.t -= dt; f.y -= 30 * dt; } floats = floats.filter(f => f.t > 0);
  for (const k of rocks) { k.x = (k.x + k.vx * dt + W) % W; k.y = (k.y + k.vy * dt + H) % H; k.rot += k.vr * dt; k.hit = Math.max(0, k.hit - dt * 5); }
  if (state !== 'play') return;
  fireCd -= dt;
  // controls
  let turn = 0, thrust = 0, head = null, firing = false;
  if (K.has('ArrowLeft') || K.has('KeyA')) turn -= 1;
  if (K.has('ArrowRight') || K.has('KeyD')) turn += 1;
  if (K.has('ArrowUp') || K.has('KeyW')) thrust = 1;
  if (K.has('Space') || K.has('KeyJ')) firing = true;
  if (ctl.stick) {
    const dx = ctl.stick.x - ctl.stick.ox, dy = ctl.stick.y - ctl.stick.oy, m = Math.hypot(dx, dy) / stickR();
    if (m > 0.18) head = Math.atan2(dy, dx);
    if (m > 0.6) thrust = Math.min(1, (m - 0.6) / 0.3 + 0.5);
  }
  if (ctl.fire) firing = true;
  if (clock < ctl.botUntil) { head = ctl.botHead; firing = firing || ctl.botFire; thrust = Math.max(thrust, ctl.botThrust ? 1 : 0); }
  if (DM.on && ship.alive && rocks.length && massLeft() > 12) {
    let tgt = null, td = 1e9;
    for (const k of rocks) { const dx = wrapD(k.x - ship.x, W), dy = wrapD(k.y - ship.y, H), d = Math.hypot(dx, dy); if (d < td) { td = d; tgt = { k, dx, dy, d }; } }
    const tt = tgt.d / (600 * U); head = Math.atan2(tgt.dy + (tgt.k.vy - ship.vy) * tt, tgt.dx + (tgt.k.vx - ship.vx) * tt);
    firing = Math.abs(angDiff(head, ship.a)) < 0.2; ship.inv = Math.max(ship.inv, 0.4);
  }
  if (ship.alive) {
    if (head != null) { const d = angDiff(head, ship.a); ship.a += Math.sign(d) * Math.min(Math.abs(d), 10 * dt); }
    ship.a += turn * 5 * dt;
    ship.thrust = thrust;
    if (thrust) { ship.vx += Math.cos(ship.a) * 430 * U * thrust * dt; ship.vy += Math.sin(ship.a) * 430 * U * thrust * dt;
      if (Math.random() < 0.8) P.burst(ship.x - Math.cos(ship.a) * 13 * U, ship.y - Math.sin(ship.a) * 13 * U, ['#ffd166', '#ff7a59', '#ff4d6d'], 1, { speed: 90, size: 3, life: 0.35, dir: ship.a + Math.PI, spread: 0.6, vx: ship.vx, vy: ship.vy }); }
    const sp = Math.hypot(ship.vx, ship.vy), mx = 380 * U; if (sp > mx) { ship.vx *= mx / sp; ship.vy *= mx / sp; }
    const fr = Math.pow(0.55, dt); ship.vx *= fr; ship.vy *= fr;
    ship.x = (ship.x + ship.vx * dt + W) % W; ship.y = (ship.y + ship.vy * dt + H) % H;
    ship.inv = Math.max(0, ship.inv - dt); ship.squash = Math.max(0, ship.squash - dt * 8);
    if (firing && fireCd <= 0) fire();
  } else if (lives > 0) {
    respawnT -= dt;
    if (respawnT <= 0) { const clear = rocks.every(k => Math.hypot(wrapD(k.x - W / 2, W), wrapD(k.y - H / 2, H)) > k.r + 70 * U); if (clear || respawnT < -2) { ship = newShip(); ship.inv = 2.5; tone(520, 0.2, 'triangle', 0.1, 1.6); } }
  }
  // shots
  for (const s of shots) { s.x = (s.x + s.vx * dt + W) % W; s.y = (s.y + s.vy * dt + H) % H; s.t -= dt; }
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i]; if (s.t <= 0) { shots.splice(i, 1); continue; }
    let hit = false;
    for (let j = rocks.length - 1; j >= 0; j--) { const k = rocks[j]; if (Math.hypot(wrapD(s.x - k.x, W), wrapD(s.y - k.y, H)) < k.r * 0.95) { breakRock(j, s.vx, s.vy); hit = true; break; } }
    if (!hit && drone && Math.hypot(s.x - drone.x, s.y - drone.y) < drone.r) { killDrone(); hit = true; }
    if (hit) shots.splice(i, 1);
  }
  // ship vs rocks
  if (ship.alive && ship.inv <= 0) {
    for (const k of rocks) if (Math.hypot(wrapD(ship.x - k.x, W), wrapD(ship.y - k.y, H)) < k.r * 0.88 + 10 * U) { killShip(); break; }
  }
  // drone
  if (wave >= 2 && !drone) { droneT -= dt; if (droneT <= 0) spawnDrone(); }
  if (drone) {
    drone.t += dt; drone.x += drone.vx * dt; drone.y = drone.by + Math.sin(drone.t * 1.6) * 60 * U;
    drone.fire -= dt * F.k(score);
    if (drone.fire <= 0 && ship.alive) { drone.fire = 1.4; const a = Math.atan2(ship.y - drone.y, ship.x - drone.x) + (rr0() - 0.5) * Math.max(0.2, 0.6 - wave * 0.04), sp = 250 * U;
      dshots.push({ x: drone.x, y: drone.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 2.2 }); tone(420, 0.1, 'triangle', 0.06, 0.6); }
    if (drone.x < -60 || drone.x > W + 60) { drone = null; droneT = 16 + rr0() * 8; }
    else if (ship.alive && ship.inv <= 0 && Math.hypot(ship.x - drone.x, ship.y - drone.y) < drone.r + 9 * U) { killDrone(); killShip(); }
  }
  for (const s of dshots) { s.x += s.vx * dt; s.y += s.vy * dt; s.t -= dt; if (ship.alive && ship.inv <= 0 && Math.hypot(s.x - ship.x, s.y - ship.y) < 10 * U) { s.t = 0; killShip(); } }
  dshots = dshots.filter(s => s.t > 0);
  // wave clear
  if (!rocks.length && state === 'play') {
    waveT += dt;
    if (waveT > 0.05 && waveT - dt <= 0.05) { ui.pop(`WAVE ${wave} CLEAR!`, '#ffd166', 38, 30); sfx.win(); buzz([20, 30, 20]); P.burst(W / 2, H * 0.35, ['#ff5d8f', '#ffd23f', '#7ef0c8', '#3a86ff', '#fff'], 70, { speed: 380, size: 5, g: 260, kind: 'conf', life: 1.6 }); }
    if (waveT > 1.6) { waveT = 0; startWave(wave + 1); }
  }
}
function spawnDrone() {
  const L = rr0() < 0.5; drone = { x: L ? -40 : W + 40, by: H * (0.2 + rr0() * 0.5), y: 0, vx: (L ? 1 : -1) * 95 * U, t: 0, r: 17 * U, fire: 1.2 };
  tone(300, 0.3, 'sine', 0.08, 1.8);
}
function killDrone() {
  addScore(1000, drone.x, drone.y); ui.pop('DRONE! +1000', '#7ef0c8', 32, 30);
  P.burst(drone.x, drone.y, ['#7ef0c8', '#fff', '#b388ff'], 30, { speed: 260, size: 4, kind: 'square', life: 1 }); P.ring(drone.x, drone.y, '#7ef0c8', 50);
  SH.kick(10); sfx.coin(); buzz(30); drone = null; droneT = 16 + rr0() * 8;
}

// ---------------------------------------------------------------- draw
function drawRock(k, ox = 0, oy = 0) {
  g.save(); g.translate(k.x + ox, k.y + oy); g.rotate(k.rot);
  const R = k.r, pts = k.shape.pts;
  g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x * R, y * R) : g.moveTo(x * R, y * R)); g.closePath();
  const gr = g.createRadialGradient(-R * 0.35, -R * 0.35, R * 0.1, 0, 0, R * 1.1); gr.addColorStop(0, k.col[2]); gr.addColorStop(0.45, k.col[0]); gr.addColorStop(1, k.col[1]);
  g.fillStyle = gr; g.fill(); g.lineWidth = 2.5; g.strokeStyle = k.col[1]; g.stroke();
  g.fillStyle = 'rgba(0,0,0,.18)';
  for (const [x, y, s] of k.shape.craters) { g.beginPath(); g.arc(x * R, y * R, s * R, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(255,255,255,.14)';
  for (const [x, y, s] of k.shape.craters) { g.beginPath(); g.arc(x * R - s * R * 0.25, y * R - s * R * 0.25, s * R * 0.45, 0, 7); g.fill(); }
  g.restore();
}
function drawWrapped(x, y, r, fn) {
  fn(0, 0);
  const ex = x < r ? W : x > W - r ? -W : 0, ey = y < r ? H : y > H - r ? -H : 0;
  if (ex) fn(ex, 0); if (ey) fn(0, ey); if (ex && ey) fn(ex, ey);
}
function drawShip(sx, sy, a, sc = 1, alpha = 1) {
  g.save(); g.translate(sx, sy); g.rotate(a); g.scale(U * sc * (1 - ship.squash * 0.08), U * sc * (1 + ship.squash * 0.05)); g.globalAlpha = alpha;
  if (ship.thrust && sc === 1) { const f = 10 + Math.random() * 8; const fg = g.createLinearGradient(-10, 0, -10 - f, 0); fg.addColorStop(0, '#fff3b0'); fg.addColorStop(0.5, '#ffb347'); fg.addColorStop(1, 'rgba(255,77,109,0)');
    g.fillStyle = fg; g.beginPath(); g.moveTo(-9, -5); g.quadraticCurveTo(-10 - f, 0, -9, 5); g.closePath(); g.fill(); }
  // fins
  g.fillStyle = '#ff7a59'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(-2, s * 6); g.quadraticCurveTo(-8, s * 15, -14, s * 14); g.quadraticCurveTo(-10, s * 7, -9, s * 3); g.closePath(); g.fill(); }
  // hull (teardrop pod)
  const hg = g.createLinearGradient(0, -9, 0, 9); hg.addColorStop(0, '#c9fff0'); hg.addColorStop(0.5, '#7ef0c8'); hg.addColorStop(1, '#2fa786');
  g.fillStyle = hg; g.beginPath(); g.moveTo(17, 0); g.bezierCurveTo(10, -10, -8, -10, -11, 0); g.bezierCurveTo(-8, 10, 10, 10, 17, 0); g.fill();
  g.strokeStyle = '#1d6f5b'; g.lineWidth = 1.5; g.stroke();
  // cockpit
  g.fillStyle = '#2b2d6e'; g.beginPath(); g.ellipse(5, 0, 5, 3.6, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(6.5, -1.3, 1.8, 1, 0, 0, 7); g.fill();
  g.restore(); g.globalAlpha = 1;
}
function drawDrone() {
  const d = drone; g.save(); g.translate(d.x, d.y); const R = d.r, pul = 1 + Math.sin(clock * 10) * 0.06;
  g.globalCompositeOperation = 'lighter'; const gl = g.createRadialGradient(0, 0, 0, 0, 0, R * 2.2); gl.addColorStop(0, 'rgba(126,240,200,.45)'); gl.addColorStop(1, 'rgba(126,240,200,0)'); g.fillStyle = gl; g.beginPath(); g.arc(0, 0, R * 2.2, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#b388ff'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * R * 0.95, R * 0.1, R * 0.55, R * 0.22, s * 0.4 + Math.sin(clock * 12) * 0.2, 0, 7); g.fill(); }
  const bg = g.createRadialGradient(-R * 0.3, -R * 0.4, 1, 0, 0, R); bg.addColorStop(0, '#e9fffa'); bg.addColorStop(0.6, '#7ef0c8'); bg.addColorStop(1, '#2a8f78');
  g.fillStyle = bg; g.beginPath(); g.arc(0, 0, R * 0.8 * pul, 0, 7); g.fill();
  g.fillStyle = '#1b1830'; g.beginPath(); g.arc(0, R * 0.05, R * 0.32, 0, 7); g.fill(); g.fillStyle = '#ff4d6d'; g.beginPath(); g.arc(Math.cos(clock * 3) * R * 0.1, R * 0.05, R * 0.15, 0, 7); g.fill();
  g.restore();
}
function drawControls() {
  if (state !== 'play' || matchMedia('(hover:hover) and (pointer:fine)').matches && !ctl.stick && !ctl.fire) return;
  const R = stickR(), h = ctl.stick ? { x: ctl.stick.ox, y: ctl.stick.oy } : stickHome();
  g.globalAlpha = ctl.stick ? 0.9 : 0.55;
  g.fillStyle = 'rgba(255,255,255,.08)'; g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2;
  g.beginPath(); g.arc(h.x, h.y, R, 0, 7); g.fill(); g.stroke();
  g.setLineDash([4, 6]); g.beginPath(); g.arc(h.x, h.y, R * 0.6, 0, 7); g.stroke(); g.setLineDash([]);
  let kx = h.x, ky = h.y;
  if (ctl.stick) { const dx = ctl.stick.x - h.x, dy = ctl.stick.y - h.y, m = Math.hypot(dx, dy), c = Math.min(m, R); if (m > 0) { kx += dx / m * c; ky += dy / m * c; } }
  const kg = g.createRadialGradient(kx - 6, ky - 6, 2, kx, ky, 26); kg.addColorStop(0, '#ffffff'); kg.addColorStop(1, '#a9b4ff');
  g.fillStyle = kg; g.beginPath(); g.arc(kx, ky, 24 * Math.min(1.2, U), 0, 7); g.fill();
  const f = fireXY(), on = !!ctl.fire, FR = 46 * Math.min(1.2, U);
  g.globalAlpha = on ? 0.95 : 0.6;
  const fg = g.createRadialGradient(f.x - 10, f.y - 12, 4, f.x, f.y, FR); fg.addColorStop(0, '#ffd9cc'); fg.addColorStop(1, on ? '#ff4d6d' : '#ff7a59');
  g.fillStyle = fg; g.beginPath(); g.arc(f.x, f.y + (on ? 2 : 0), FR, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.font = `800 ${Math.round(17 * Math.min(1.2, U))}px 'Baloo 2',system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('FIRE', f.x, f.y + (on ? 3 : 1));
  if (!ctl.stick) { g.fillStyle = 'rgba(255,255,255,.75)'; g.font = `700 12px 'Baloo 2',system-ui`; g.fillText('STEER · push to thrust', h.x + 8, h.y + R + 14); }
  g.globalAlpha = 1;
}
function draw() {
  V.begin(); g.drawImage(bgCache, 0, 0, W, H);
  for (const s of stars) { g.globalAlpha = 0.4 + 0.5 * Math.abs(Math.sin(clock * s.d * 2 + s.p)); g.fillStyle = '#fff'; g.fillRect(s.x, s.y, s.s, s.s); } g.globalAlpha = 1;
  g.save(); g.translate(SH.x, SH.y);
  for (const k of rocks) drawWrapped(k.x, k.y, k.r, (ox, oy) => drawRock(k, ox, oy));
  g.globalCompositeOperation = 'lighter';
  for (const s of shots) { const a = Math.atan2(s.vy, s.vx); g.save(); g.translate(s.x, s.y); g.rotate(a);
    g.fillStyle = 'rgba(255,190,70,.85)'; rr(g, -12, -5, 24, 10, 5); g.fill(); g.fillStyle = 'rgba(255,236,150,1)'; rr(g, -9, -3, 18, 6, 3); g.fill(); g.fillStyle = '#ffffff'; rr(g, -5, -1.5, 10, 3, 1.5); g.fill(); g.restore(); }
  for (const s of dshots) { g.fillStyle = 'rgba(255,77,109,.35)'; g.beginPath(); g.arc(s.x, s.y, 7, 0, 7); g.fill(); g.fillStyle = '#ffd0da'; g.beginPath(); g.arc(s.x, s.y, 3, 0, 7); g.fill(); }
  g.globalCompositeOperation = 'source-over';
  if (drone) drawDrone();
  if (ship.alive && (state === 'play' || state === 'ready')) {
    const blink = ship.inv > 0 && state === 'play' ? (Math.sin(clock * 30) > 0 ? 1 : 0.35) : 1;
    if (ship.inv > 0 && state === 'play') { g.strokeStyle = `rgba(126,240,200,${0.25 + 0.2 * Math.sin(clock * 8)})`; g.lineWidth = 2; g.beginPath(); g.arc(ship.x, ship.y, 22 * U, 0, 7); g.stroke(); }
    drawWrapped(ship.x, ship.y, 20 * U, (ox, oy) => drawShip(ship.x + ox, ship.y + oy, ship.a, 1, blink));
  }
  P.draw(g);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const f of floats) { g.globalAlpha = Math.min(1, f.t * 2); g.fillStyle = '#fff'; g.font = `800 ${Math.round(15 * U)}px 'Baloo 2',system-ui`; g.fillText(f.s, f.x, f.y); } g.globalAlpha = 1;
  g.restore();
  // lives (top right)
  for (let i = 0; i < lives; i++) drawShip(W - 22 * U - i * 24 * U, 74, -Math.PI / 2, 0.62, 0.95);
  drawControls();
}

let last = performance.now();
function frame(t) { const dt = Math.min(0.05, (t - last) / 1000); last = t; update(dt); draw(); requestAnimationFrame(frame); }
reset(); ui.start(); requestAnimationFrame(frame);

// ---------------------------------------------------------------- test hooks
window.__game = {
  get state() { return state; }, get level() { return wave; }, get score() { return score; }, get dbg() { return { lives, rocks: rocks.length, alive: ship.alive, inv: +ship.inv.toFixed(1) }; },
  bot() {
    if (state !== 'play' || !ship.alive) return;
    if (clock < ctl.panic) return;                                    // mid-scramble: keep flying where we panicked
    ctl.botUntil = clock + 1.0; ctl.botThrust = false;
    if (Math.random() < 0.04) { ctl.panic = clock + 1.1; ctl.botHead = Math.random() * 6.28; ctl.botThrust = true; ctl.botFire = true; ctl.botUntil = clock + 1.2; return; }   // a human-like scramble now and then
    // danger: anything about to hit us → turn away and thrust
    let danger = null, dd = 1e9;
    for (const k of rocks) { const dx = wrapD(k.x - ship.x, W), dy = wrapD(k.y - ship.y, H), d = Math.hypot(dx, dy) - k.r;
      const closing = -(dx * (k.vx - ship.vx) + dy * (k.vy - ship.vy)) / Math.max(1, Math.hypot(dx, dy)); if (d < 55 * U + closing * 0.5 && d < dd) { dd = d; danger = { dx, dy }; } }
    let tgt = null, td = 1e9;
    for (const k of rocks) { const dx = wrapD(k.x - ship.x, W), dy = wrapD(k.y - ship.y, H), d = Math.hypot(dx, dy); if (d < td) { td = d; tgt = { k, dx, dy, d }; } }
    if (drone) { const dx = drone.x - ship.x, dy = drone.y - ship.y, d = Math.hypot(dx, dy); if (d < td * 1.3) tgt = { k: drone, dx, dy, d }; }
    if (danger && dd < 30 * U && ship.inv <= 0 && Math.random() < 0.08) { ctl.botHead = Math.atan2(-danger.dy, -danger.dx) + 0.5; ctl.botThrust = true; ctl.botFire = false; return; }
    if (!tgt) { ctl.botFire = false; ctl.botHead = ship.a; return; }
    const tt = tgt.d / (600 * U), k = tgt.k;
    const ax = tgt.dx + ((k.vx || 0) - ship.vx) * tt, ay = tgt.dy + ((k.vy || 0) - ship.vy) * tt;
    ctl.botHead = Math.atan2(ay, ax) + Math.sin(clock * 1.7) * 0.22;   // a thumb is not a laser: the aim wobbles
    ctl.botFire = Math.abs(angDiff(ctl.botHead, ship.a)) < 0.3 && tgt.d < Math.min(W, H) * 0.75;
    if (tgt.d > Math.min(W, H) * 0.3) ctl.botThrust = true;   // flies at its targets like most players do
  },
};
