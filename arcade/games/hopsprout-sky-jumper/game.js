// Hopsprout — Sprig, a little bean with a two-leaf sprout, bounces up forever on floating pads.
// Steer left/right (drag, tilt, mouse or arrows); run off one side and you come back on the other.
// Springs fling you high, blue pads slide, cracked pads crumble, cloud pads hold only one bounce. Endless; best height counts.
import { createUI, store, buzz, sfx, tone, note, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { css, arcadeCards, startCard, canvas2d, particles, shaker, keys, lerpc } from './arc.js';

const NAME = 'Hopsprout: Sky Jumper';
const S = store('hopsprout');
let best = S.get('best', 0);
const F = flow('hopsprout', { par: 2500, warmup: 600 });
const MODES = ['Drag', 'Tilt'];
let mode = S.get('mode', 0);

const ui = createUI({ title: 'HOPSPROUT', hint: 'Tap to hop', hand: '🌱' });
arcadeCards({ accent: '#3ab795', glass: 'rgba(10,40,40,.42)', glass2: 'rgba(8,30,34,.82)' });
const D = daily('hopsprout', ui, { name: NAME });
startCard(ui, D, { kicker: 'Sky jumper', chips: { items: MODES, get: () => mode, set: i => { mode = i; S.set('mode', i); } }, keys: '← → or A / D, or steer with the mouse' });
const B = board({ game: 'hopsprout', label: 'Height', limits: { maxRun: 100000, maxPerSec: 60 }, corner: 'tl' });
css(`.hc-score{text-shadow:0 3px 0 rgba(0,0,0,.2)}`);

// ---------------------------------------------------------------- view
const LW = 400, G = 1500, JV = 880, SPRING = 1520, MAXV = 460;
const V = canvas2d(), g = V.g, P = particles(), SH = shaker(), K = keys();
let W = V.W, H = V.H, s = 1, colX = 0, viewH = 800;
function layout() { W = V.W; H = V.H; s = Math.min(W / LW, H / 640); colX = (W - LW * s) / 2; viewH = H / s; }
V.onResize = layout; layout();
const SX = x => colX + x * s, SY = y => H - (y - camY) * s;

// background zones by height
const ZONES = [
  { at: 0, name: 'Meadow', top: '#8fd6ff', bot: '#e6fbe0' },
  { at: 4000, name: 'High Sky', top: '#5bb4f5', bot: '#cdeeff' },
  { at: 9000, name: 'Sunset', top: '#ff9a8b', bot: '#ffe0a3' },
  { at: 15000, name: 'Dusk', top: '#5b4a9e', bot: '#ff9bb3' },
  { at: 22000, name: 'Starfield', top: '#141a44', bot: '#3d3a8a' },
  { at: 32000, name: 'Deep Space', top: '#07081e', bot: '#1d1550' },
];
function zoneAt(y) { let i = 0; while (i < ZONES.length - 1 && y >= ZONES[i + 1].at) i++; return i; }
function skyAt(y) {
  const i = zoneAt(y), a = ZONES[i], b = ZONES[Math.min(i + 1, ZONES.length - 1)];
  const k = b === a ? 0 : Math.max(0, Math.min(1, (y - (b.at - 1500)) / 1500));
  return [lerpc(a.top, b.top, k), lerpc(a.bot, b.bot, k)];
}
const stars = []; { const r = rng(8); for (let i = 0; i < 120; i++) stars.push({ x: r(), y: r(), s: 0.6 + r() * 1.8, p: r() * 6 }); }
const clouds = []; { const r = rng(3); for (let i = 0; i < 14; i++) clouds.push({ x: r() * 1.4 - 0.2, y: r() * 6000, w: 60 + r() * 90, par: 0.25 + r() * 0.35 }); }

// ---------------------------------------------------------------- state
let state = 'ready', score = 0, camY = 0, maxY = 0, recorded = false, beatenShown = false, t0 = 0, clock = 0, rr0 = rng(1), genY = 0, zoneN = 0, fallT = 0;
let pads = [], boosts = [];
const hero = { x: LW / 2, y: 40, vx: 0, vy: 0, face: 1, squash: 0, spin: 0, rocket: 0, tx: null };
const ptr = { down: false, lx: 0, mouse: false };
let tilt = 0, tiltSeen = false;
const bot = { until: 0 };

function addPad(y, kind, x) {
  const w = kind === 'cloud' ? 70 : 64;
  x = x != null ? x : 34 + rr0() * (LW - 68);
  const p = { x, y, w, kind, vx: 0, alive: true, crumble: 0, spring: null, used: false, bob: 0, ph: rr0() * 6 };
  if (kind === 'move') { p.vx = (60 + rr0() * 80 + Math.min(120, y / 150)) * (rr0() < 0.5 ? -1 : 1); }
  pads.push(p); return p;
}
function generate(upTo) {
  while (genY < upTo) {
    const h = genY, fk = F.k(score);
    const gmin = Math.min(150, 55 + h / 260), gmax = Math.min(206, (95 + h / 150) * Math.min(1.15, fk));
    genY += gmin + rr0() * Math.max(10, gmax - gmin);
    const r = rr0(), pMove = Math.min(0.42, Math.max(0, (h - 1500) / 12000) * fk), pCloud = Math.min(0.2, Math.max(0, (h - 5000) / 30000));
    const kind = r < pMove ? 'move' : r < pMove + pCloud ? 'cloud' : 'pad';
    const p = addPad(genY, kind);
    if (kind === 'pad' && rr0() < 0.09 && h > 400) p.spring = { x: (rr0() - 0.5) * 30, c: 0 };
    if (h > 2500 && rr0() < 0.012) boosts.push({ x: p.x, y: p.y + 30, alive: true });
    // decoys: cracked pads between the real ones (never the only way up)
    if (h > 900 && rr0() < Math.min(0.5, (0.15 + h / 25000) * fk)) addPad(genY - (gmin * 0.5) - rr0() * 30, 'crack');
  }
}
function reset() {
  rr0 = rng(D.seed || (Date.now() % 100000) + 9);
  pads = []; boosts = []; P.clear(); score = 0; camY = 0; maxY = 0; recorded = false; beatenShown = false; zoneN = 0; fallT = 0;
  Object.assign(hero, { x: LW / 2, y: 26, vx: 0, vy: 0, face: 1, squash: 0, spin: 0, rocket: 0, tx: null });
  addPad(10, 'pad', LW / 2); genY = 10;
  for (let i = 0; i < 4; i++) { genY += 70 + rr0() * 30; addPad(genY, 'pad'); }
  generate(1400);
  ui.score(0); ui.levels(1); ui.progress(0); ui.sub(D.isDaily ? 'DAILY CHALLENGE' : best ? 'BEST ' + best : '');
}

// ---------------------------------------------------------------- input
addEventListener('pointerdown', e => { if (state !== 'play') return; ptr.down = true; ptr.lx = e.clientX; ptr.mouse = e.pointerType === 'mouse'; });
addEventListener('pointermove', e => {
  if (state !== 'play') return;
  if (e.pointerType === 'mouse') { hero.tx = Math.max(0, Math.min(LW, (e.clientX - colX) / s)); return; }
  if (!ptr.down) return;
  const dx = (e.clientX - ptr.lx) / s; ptr.lx = e.clientX;
  hero.x += dx * 1.35; hero.vx = dx * 1.35 * 60; if (Math.abs(dx) > 0.5) hero.face = Math.sign(dx);
  hero.tx = null;
});
const pu = () => { ptr.down = false; }; addEventListener('pointerup', pu); addEventListener('pointercancel', pu);
addEventListener('deviceorientation', e => { if (e.gamma == null) return; tiltSeen = true; tilt = Math.max(-1, Math.min(1, e.gamma / 28)); });
ui.onTap(w => {
  if (mode === 1 && typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) DeviceOrientationEvent.requestPermission().catch(() => {});
  if (w !== 'start') reset(); state = 'play'; t0 = performance.now(); B.start(); bounce(0.8);
});

// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on the first climb, until the first
// touch, the sprout steers itself from pad to pad (the game's own bot) for a few seconds, then the steering is yours
const DM = demo(null, { ready: () => state === 'play' && zoneN === 0 && !D.isDaily, wait: 800, ms: 3500 });

// ---------------------------------------------------------------- update
function bounce(k = 1, pad = null) {
  hero.vy = JV * k; hero.squash = 0.45;
  const n = 64 + Math.min(12, Math.floor(maxY / 1500)); note(n + (Math.random() < 0.5 ? 0 : 3), 0.14, 0.07);
  if (pad) P.burst(SX(hero.x), SY(pad.y), pad.kind === 'cloud' ? ['#ffffff', '#e8f4ff'] : ['#bff5a8', '#7fd36a', '#fff'], 6, { speed: 90, size: 2.6, life: 0.4, dir: -Math.PI / 2, spread: 2.4, g: 300 });
}
function update(dt) {
  clock += dt; P.update(dt); SH.update(dt);
  for (const p of pads) { p.bob = Math.max(0, p.bob - dt * 6); if (p.spring) p.spring.c = Math.max(0, p.spring.c - dt * 5); }
  if (state === 'ready') { hero.y = 26 + Math.abs(Math.sin(clock * 3.2)) * 70; hero.squash = Math.max(0, 0.4 - Math.abs(Math.sin(clock * 3.2)) * 3) ; return; }
  if (state !== 'play') { hero.vy -= G * dt; hero.y += hero.vy * dt; hero.spin += dt * 8; return; }
  // steering
  let ax = 0;
  if (K.has('ArrowLeft') || K.has('KeyA')) ax -= 1;
  if (K.has('ArrowRight') || K.has('KeyD')) ax += 1;
  if (mode === 1 && tiltSeen && !ptr.down) ax += tilt;
  if (DM.on) bot.until = clock + 0.05;
  if (clock < bot.until) botThink();
  if (ax) { hero.vx += ax * 2600 * dt; hero.vx = Math.max(-MAXV, Math.min(MAXV, hero.vx)); hero.face = Math.sign(ax); hero.tx = null; }
  else if (hero.tx != null) {
    let d = hero.tx - hero.x; if (clock < bot.until) { if (d > LW / 2) d -= LW; if (d < -LW / 2) d += LW; }
    const want = Math.max(-MAXV, Math.min(MAXV, d * 9)); hero.vx += (want - hero.vx) * Math.min(1, dt * 14); if (Math.abs(d) > 3) hero.face = Math.sign(d);
  } else if (!ptr.down) hero.vx *= Math.pow(0.02, dt);
  if (!ptr.down || ax || hero.tx != null) hero.x += hero.vx * dt; else hero.vx *= 0.8;
  hero.x = ((hero.x % LW) + LW) % LW;
  // vertical
  const py = hero.y;
  if (hero.rocket > 0) { hero.rocket -= dt; hero.vy = 1350; if (Math.random() < 0.8) P.burst(SX(hero.x), SY(hero.y - 6), ['#fff', '#fff6c2', '#d9f7ff'], 1, { speed: 80, size: 3, life: 0.5, dir: Math.PI / 2, spread: 0.8 }); }
  else hero.vy -= G * dt;
  hero.y += hero.vy * dt;
  hero.squash *= Math.pow(0.002, dt); hero.spin = Math.max(0, hero.spin - dt * 2.2);
  // landings
  if (hero.vy < 0) for (const p of pads) {
    if (!p.alive) continue;
    const top = p.y + 7;
    if (py >= top && hero.y <= top) {
      let dx = Math.abs(hero.x - p.x); dx = Math.min(dx, LW - dx);
      if (dx > p.w / 2 + 10) continue;
      if (p.kind === 'crack') { p.alive = false; p.crumble = 1; tone(160, 0.12, 'sawtooth', 0.07, 0.6); P.burst(SX(p.x), SY(p.y), ['#a77b52', '#d9b48a', '#7a5434'], 12, { speed: 120, size: 3.5, life: 0.7, kind: 'square', g: 500 }); continue; }
      hero.y = top;
      if (p.spring && Math.abs(hero.x - (p.x + p.spring.x)) < 16) {
        hero.vy = SPRING; hero.squash = 0.6; hero.spin = 1; p.spring.c = 1;
        tone(300, 0.25, 'sine', 0.12, 3); buzz(18); ui.pop('BOING!', '#ffd166', 30, 34); SH.kick(3);
        P.burst(SX(p.x + p.spring.x), SY(top), ['#ffd166', '#fff'], 10, { speed: 160, size: 2.6, kind: 'spark', life: 0.35 });
      } else { bounce(1, p); buzz(5); p.bob = 1; }
      if (p.kind === 'cloud') { p.alive = false; P.burst(SX(p.x), SY(p.y), ['#ffffff', '#eaf6ff'], 14, { speed: 110, size: 5, life: 0.7, g: -40 }); tone(700, 0.12, 'sine', 0.06, 0.5); }
      break;
    }
  }
  for (const b of boosts) if (b.alive && Math.abs(hero.y - b.y) < 28 && Math.min(Math.abs(hero.x - b.x), LW - Math.abs(hero.x - b.x)) < 24) {
    b.alive = false; hero.rocket = 1.3; ui.pop('PUFF RIDE!', '#ffffff', 32, 34); [72, 76, 79, 84].forEach((n, i) => setTimeout(() => note(n, 0.2, 0.1), i * 60)); buzz(25);
  }
  // pads move / cleanup / generate
  for (const p of pads) if (p.kind === 'move' && p.alive) { p.x += p.vx * dt; if (p.x < p.w / 2 || p.x > LW - p.w / 2) { p.vx *= -1; p.x = Math.max(p.w / 2, Math.min(LW - p.w / 2, p.x)); } }
  for (const p of pads) if (p.crumble > 0) { p.crumble -= dt * 1.4; p.y -= 260 * dt; }
  pads = pads.filter(p => p.y > camY - 120 && (p.alive || p.crumble > 0));
  boosts = boosts.filter(b => b.alive && b.y > camY - 120);
  generate(camY + viewH + 400);
  // camera + score
  if (hero.y > maxY) {
    maxY = hero.y; const sc = Math.floor(maxY / 10);
    if (sc !== score) {
      score = sc; ui.score(score);
      if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); P.burst(W / 2, H * 0.3, ['#ff5d8f', '#ffd23f', '#3ab795', '#3a86ff', '#fff'], 80, { speed: 420, size: 5, g: 400, kind: 'conf', life: 1.6 }); }
    }
    const z = zoneAt(maxY); if (z !== zoneN) { zoneN = z; ui.levels(z + 1); ui.pop(ZONES[z].name.toUpperCase() + '!', '#fff', 36, 26); sfx.win(); }
    const nz = ZONES[Math.min(zoneN + 1, ZONES.length - 1)]; ui.progress(nz.at > ZONES[zoneN].at ? (maxY - ZONES[zoneN].at) / (nz.at - ZONES[zoneN].at) : 1);
  }
  const want = hero.y - viewH * 0.42; if (want > camY) camY += (want - camY) * Math.min(1, dt * 10);
  if (hero.y < camY - 30) die();
}
function die() {
  state = 'lost'; hero.vy = -200;
  sfx.fail(); buzz([40, 30, 80]); ui.flash(0.3);
  if (!recorded) { recorded = true; F.endless(score); B.submit(score, { ms: performance.now() - t0 }); }
  const nb = score > best; best = Math.max(best, score); S.set('best', best);
  ui.lose('WHOOPS!', nb && score > 0 ? `New best: ${score}!` : `Height ${score} · best ${best}`);
}

// ---------------------------------------------------------------- draw
function drawPad(p) {
  const x = SX(p.x), y = SY(p.y) + p.bob * 4 * s, w = p.w * s, h = 13 * s;
  if (p.crumble > 0) g.globalAlpha = Math.max(0, p.crumble);
  const offs = [0], wo = p.x < p.w / 2 ? LW * s : p.x > LW - p.w / 2 ? -LW * s : 0; if (wo) offs.push(wo);
  for (const ox of offs) {
    const xx = x + ox;
    if (p.kind === 'cloud') {
      g.fillStyle = 'rgba(80,120,170,.18)'; g.beginPath(); g.ellipse(xx, y + 6 * s, w * 0.5, h * 0.55, 0, 0, 7); g.fill();
      g.fillStyle = '#ffffff'; for (const [dx, dy, r] of [[-22, 0, 11], [-6, -5, 14], [12, -3, 12], [26, 1, 9]]) { g.beginPath(); g.arc(xx + dx * s, y + dy * s, r * s, 0, 7); g.fill(); }
      continue;
    }
    const cols = p.kind === 'move' ? ['#7cc6ff', '#3a86ff', '#2a5fb8'] : p.kind === 'crack' ? ['#d9b48a', '#a77b52', '#7a5434'] : ['#9be67a', '#4fb35c', '#2f7d42'];
    g.fillStyle = 'rgba(0,0,0,.14)'; g.beginPath(); g.roundRect(xx - w / 2 + 2 * s, y - h / 2 + 5 * s, w, h, h / 2); g.fill();
    const gr = g.createLinearGradient(0, y - h / 2, 0, y + h / 2); gr.addColorStop(0, cols[0]); gr.addColorStop(1, cols[1]);
    g.fillStyle = gr; g.beginPath(); g.roundRect(xx - w / 2, y - h / 2, w, h, h / 2); g.fill();
    g.strokeStyle = cols[2]; g.lineWidth = 1.5 * s; g.stroke();
    if (p.kind === 'pad') { g.fillStyle = '#c9f7a8'; for (let i = -2; i <= 2; i++) { g.beginPath(); g.ellipse(xx + i * 12 * s, y - h / 2 + 1 * s, 4 * s, 2.4 * s, 0, 0, 7); g.fill(); } }
    if (p.kind === 'crack') { g.strokeStyle = '#5a3a20'; g.lineWidth = 1.6 * s; g.beginPath(); g.moveTo(xx - 6 * s, y - h / 2); g.lineTo(xx - 1 * s, y); g.lineTo(xx - 7 * s, y + h / 2); g.moveTo(xx + 14 * s, y - h / 2); g.lineTo(xx + 18 * s, y + 2 * s); g.stroke(); }
    if (p.kind === 'move') { g.fillStyle = 'rgba(255,255,255,.7)'; for (const sg of [-1, 1]) { g.beginPath(); g.moveTo(xx + sg * (w / 2 - 6 * s), y); g.lineTo(xx + sg * (w / 2 - 12 * s), y - 3.5 * s); g.lineTo(xx + sg * (w / 2 - 12 * s), y + 3.5 * s); g.fill(); } }
    if (p.spring) {
      const sx = xx + p.spring.x * s, c = p.spring.c, top = y - h / 2 - (9 + c * 10) * s;
      g.strokeStyle = '#8a8fa8'; g.lineWidth = 2.4 * s; g.beginPath();
      for (let i = 0; i <= 6; i++) { const yy = y - h / 2 - (i / 6) * (9 + c * 10) * s; g.lineTo(sx + (i % 2 ? 6 : -6) * s, yy); } g.stroke();
      g.fillStyle = '#ff5d8f'; g.beginPath(); g.roundRect(sx - 9 * s, top - 3 * s, 18 * s, 5 * s, 2.5 * s); g.fill();
    }
  }
  g.globalAlpha = 1;
}
function drawHero() {
  const x = SX(hero.x), y = SY(hero.y), k = s;
  const st = state === 'play' ? Math.max(-0.12, Math.min(0.2, hero.vy / 5000)) : 0, sq = hero.squash;
  const offs = [0], wo = hero.x < 22 ? LW * s : hero.x > LW - 22 ? -LW * s : 0; if (wo) offs.push(wo);
  for (const ox of offs) {
    g.save(); g.translate(x + ox, y);
    g.rotate(hero.spin * Math.PI * 2 * (hero.face || 1) + (state === 'lost' ? clock * 6 : 0));
    g.scale((1 + sq * 0.45 - st) * hero.face, 1 - sq * 0.4 + st);
    // feet
    g.fillStyle = '#2f7d42'; for (const fx of [-7, 6]) { g.beginPath(); g.ellipse(fx * k, -3 * k, 6 * k, 3.5 * k, 0, 0, 7); g.fill(); }
    // body (bean)
    const bg = g.createLinearGradient(-14 * k, -40 * k, 14 * k, 0); bg.addColorStop(0, '#b6f08c'); bg.addColorStop(1, '#4fb35c');
    g.fillStyle = bg; g.beginPath(); g.ellipse(0, -20 * k, 15 * k, 18 * k, 0.08, 0, 7); g.fill();
    g.strokeStyle = '#2f7d42'; g.lineWidth = 1.6 * k; g.stroke();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(-6 * k, -28 * k, 4 * k, 6 * k, -0.3, 0, 7); g.fill();
    // sprout
    const flap = Math.sin(clock * 14) * 0.25 + (hero.vy < 0 ? 0.35 : -0.1);
    g.strokeStyle = '#2f7d42'; g.lineWidth = 2.2 * k; g.beginPath(); g.moveTo(0, -37 * k); g.quadraticCurveTo(1 * k, -43 * k, 0, -47 * k); g.stroke();
    for (const sd of [-1, 1]) { g.save(); g.translate(0, -46 * k); g.rotate(sd * (0.6 + flap)); g.fillStyle = sd < 0 ? '#7fd36a' : '#9be67a'; g.beginPath(); g.ellipse(sd * 8 * k, 0, 8 * k, 4.2 * k, 0, 0, 7); g.fill(); g.restore(); }
    // face
    const lose = state === 'lost';
    for (const ex of [3, 10]) { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(ex * k, -23 * k, 3.6 * k, 4.4 * k, 0, 0, 7); g.fill(); g.fillStyle = '#1b1830'; g.beginPath(); g.arc((ex + 1) * k, (lose ? -21 : -24) * k, 2 * k, 0, 7); g.fill(); }
    g.strokeStyle = '#1b1830'; g.lineWidth = 1.5 * k; g.beginPath();
    if (lose) g.arc(7 * k, -12 * k, 3 * k, Math.PI * 1.15, Math.PI * 1.85); else g.arc(7 * k, -16 * k, 3.4 * k, 0.2, Math.PI - 0.2); g.stroke();
    g.fillStyle = 'rgba(255,120,140,.45)'; g.beginPath(); g.ellipse(14 * k, -16 * k, 2.6 * k, 1.8 * k, 0, 0, 7); g.fill();
    if (hero.rocket > 0) { g.fillStyle = 'rgba(255,255,255,.9)'; for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + clock * 3; g.beginPath(); g.arc(Math.cos(a) * 9 * k, -60 * k + Math.sin(a) * 5 * k, 5 * k, 0, 7); g.fill(); } g.strokeStyle = '#d9f7ff'; g.beginPath(); g.moveTo(0, -48 * k); g.lineTo(0, -58 * k); g.stroke(); }
    g.restore();
  }
}
function draw() {
  V.begin();
  const [top, bot2] = skyAt(camY + viewH * 0.5);
  const sg = g.createLinearGradient(0, 0, 0, H); sg.addColorStop(0, top); sg.addColorStop(1, bot2); g.fillStyle = sg; g.fillRect(0, 0, W, H);
  const starA = Math.max(0, Math.min(1, (camY - 14000) / 6000));
  if (starA > 0) for (const st of stars) { g.globalAlpha = starA * (0.5 + 0.5 * Math.sin(clock * 2 + st.p)); g.fillStyle = '#fff'; g.fillRect(st.x * W, ((st.y * H + camY * 0.05 * s) % H), st.s, st.s); }
  g.globalAlpha = 1;
  // clouds (parallax, repeat every 6000 units)
  const cloudA = 1 - Math.max(0, Math.min(1, (camY - 18000) / 6000));
  if (cloudA > 0) for (const c of clouds) {
    const cy = H - (((c.y - camY * c.par) % 6000 + 6000) % 6000 - 600) * s * 0.5, cx = c.x * W;
    if (cy < -80 || cy > H + 80) continue;
    g.globalAlpha = 0.55 * cloudA; g.fillStyle = '#ffffff';
    for (const [dx, dy, r] of [[0, 0, 1], [0.35, -0.2, 0.8], [-0.35, 0.05, 0.7], [0.65, 0.1, 0.55]]) { g.beginPath(); g.arc(cx + dx * c.w * s * 0.7, cy + dy * c.w * s * 0.4, c.w * r * s * 0.32, 0, 7); g.fill(); }
  }
  g.globalAlpha = 1;
  // meadow hills at the start
  if (camY < 900) {
    const by = SY(0);
    g.fillStyle = '#a6e3a0'; g.beginPath(); g.moveTo(0, by); for (let i = 0; i <= 8; i++) g.quadraticCurveTo(W * (i - 0.5) / 8, by - 50 * s, W * i / 8, by - 20 * s * (i % 2)); g.lineTo(W, H + 400); g.lineTo(0, H + 400); g.fill();
    g.fillStyle = '#7fd36a'; g.fillRect(0, by, W, H + 400);
    for (let i = 0; i < 18; i++) { const fx = (i * 97) % W, fy = by + 8 * s + (i % 3) * 7 * s; g.fillStyle = ['#ff8fb3', '#ffd166', '#ffffff'][i % 3]; g.beginPath(); g.arc(fx, fy, 3 * s, 0, 7); g.fill(); }
  }
  // column edges on wide screens
  if (colX > 4) { g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(colX - 3, 0, 3, H); g.fillRect(colX + LW * s, 0, 3, H); g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(0, 0, colX - 3, H); g.fillRect(colX + LW * s + 3, 0, W, H); }
  g.save(); g.translate(SH.x, SH.y);
  for (const p of pads) drawPad(p);
  for (const b of boosts) { if (!b.alive) continue; const x = SX(b.x), y = SY(b.y) + Math.sin(clock * 4) * 4 * s;
    g.strokeStyle = '#ffffff'; g.lineWidth = 1.4 * s; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 13 * s, y + Math.sin(a) * 13 * s); g.stroke(); }
    g.fillStyle = '#fff6c2'; g.beginPath(); g.arc(x, y, 4 * s, 0, 7); g.fill(); g.strokeStyle = '#7fd36a'; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 20 * s); g.stroke(); }
  drawHero();
  P.draw(g);
  g.restore();
  if (state === 'play' && ptr.down === false && score === 0 && mode === 0) { g.fillStyle = 'rgba(255,255,255,.9)'; g.font = `800 ${Math.round(18)}px 'Baloo 2',system-ui`; g.textAlign = 'center'; g.fillText('⟵ drag to steer ⟶', W / 2, H * 0.62); }
}

let last = performance.now();
function frame(t) { const dt = Math.min(0.033, (t - last) / 1000); last = t; update(dt); draw(); requestAnimationFrame(frame); }
reset(); ui.start(); requestAnimationFrame(frame);

// ---------------------------------------------------------------- test hooks
function botThink() {
  const apex = hero.vy > 0 ? hero.y + hero.vy * hero.vy / (2 * G) : hero.y;
  let bestP = null;
  for (const p of pads) {
    if (!p.alive || p.kind === 'crack') continue;
    if (p.y + 7 > apex - 12 || p.y < hero.y - 520) continue;
    if (!bestP || p.y > bestP.y) bestP = p;
  }
  if (!bestP) return;
  if (bestP !== bot.last) { bot.last = bestP; bot.miss = Math.random() < 0.06 ? (Math.random() - 0.5) * 260 : 0; }   // now and then misjudges a jump
  if (bot.miss) { hero.tx = ((bestP.x + bot.miss) % LW + LW) % LW; return; }
  const t = hero.vy > 0 ? (hero.vy + Math.sqrt(Math.max(0, hero.vy * hero.vy - 2 * G * (bestP.y - hero.y)))) / G : 0.2;
  hero.tx = ((bestP.x + bestP.vx * Math.min(t, 1) + (bestP.spring ? bestP.spring.x : 0)) % LW + LW) % LW;
}
window.__game = {
  get state() { return state; }, get level() { return zoneN + 1; }, get score() { return score; },
  bot() { if (state === 'play') bot.until = clock + 1.0; },
};
