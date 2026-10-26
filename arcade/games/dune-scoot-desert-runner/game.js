// Dune Scoot — an endless desert runner. Scoot, a big-eared hopping critter, races across the dunes:
// tap to jump (hold for a higher jump), swipe down to duck under low fliers. The sun sets and rises as you run.
import { createUI, store, buzz, sfx, tone, note, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { css, arcadeCards, startCard, canvas2d, particles, shaker, keys, lerpc } from './arc.js';

const NAME = 'Dune Scoot: Desert Runner';
const S = store('dune-scoot');
let best = S.get('best', 0);
const F = flow('dune-scoot', { par: 600, warmup: 150 });

const ui = createUI({ title: 'DUNE SCOOT', hint: 'Tap to jump · swipe down to duck', hand: '👆' });
arcadeCards({ accent: '#ff8c42', glass: 'rgba(60,30,10,.42)', glass2: 'rgba(40,20,8,.8)' });
const D = daily('dune-scoot', ui, { name: NAME });
startCard(ui, D, { kicker: 'Desert runner', keys: 'Space / ↑ jump (hold = higher) · ↓ duck' });
const B = board({ game: 'dune-scoot', label: 'Points', limits: { maxRun: 20000, maxPerSec: 40 }, corner: 'tl' });
css(`.hc-top .hc-lvl{font-size:13px}.hc-score{text-shadow:0 3px 0 rgba(0,0,0,.18)}`);

const V = canvas2d(), g = V.g, P = particles(), SH = shaker(), K = keys();
let W = V.W, H = V.H, s = 1, gy = 0, heroSX = 0;
function layout() { W = V.W; H = V.H; s = Math.min(W / 430, H / 420, 2.2); gy = H * (W < H ? 0.6 : 0.72); heroSX = Math.max(46, W * 0.14); }
V.onResize = layout; layout();

// ---------------------------------------------------------------- sky keyframes over one day (0..1)
const SKY = [
  [0.00, '#7cc9f2', '#fbe7b5', '#f0b56e', '#d9894a'],   // morning
  [0.45, '#5fb4ee', '#fff1c9', '#f3bd73', '#dd9150'],   // noon
  [0.58, '#f39a6b', '#ffd38a', '#d9895a', '#b9633d'],   // dusk
  [0.66, '#3a2d6b', '#a8558a', '#8a5a6e', '#6b3f54'],   // twilight
  [0.74, '#141a3f', '#2d2f66', '#4b4a78', '#38365e'],   // night
  [0.90, '#1c2250', '#3a3a74', '#565083', '#433d69'],   // late night
  [0.96, '#e98f8a', '#ffd0a0', '#c98568', '#a86a50'],   // dawn
  [1.00, '#7cc9f2', '#fbe7b5', '#f0b56e', '#d9894a'],
];
function skyAt(t) {
  for (let i = 0; i < SKY.length - 1; i++) { const a = SKY[i], b = SKY[i + 1]; if (t >= a[0] && t <= b[0]) { const k = (t - a[0]) / (b[0] - a[0]); return [1, 2, 3, 4].map(j => lerpc(a[j], b[j], k)); } }
  return SKY[0].slice(1);
}
const DAY = 650;   // points per full day

// ---------------------------------------------------------------- parallax layers (seeded, tiled every 1600 units)
const layers = [];
(function makeLayers() {
  const r = rng(4242);
  const mk = (n, base, amp, par, kind) => { const pts = []; for (let i = 0; i <= n; i++) pts.push(base + (r() - 0.5) * amp); layers.push({ pts, par, kind, n }); };
  mk(16, 120, 70, 0.12, 'mesa'); mk(24, 70, 40, 0.3, 'dune'); mk(30, 34, 22, 0.55, 'dune');
})();
const stars = []; { const r = rng(9); for (let i = 0; i < 90; i++) stars.push({ x: r(), y: r() * 0.6, s: 0.6 + r() * 1.6, p: r() * 6 }); }
const pebbles = []; { const r = rng(5); for (let i = 0; i < 40; i++) pebbles.push({ x: r() * 1600, y: 6 + r() * 70, w: 2 + r() * 5, c: r() }); }

// ---------------------------------------------------------------- state
const GRAV = 2700, JUMP = 780, HOLD_G = 1150, HOLD_T = 0.22;
let state = 'ready', score = 0, dist = 0, speed = 330, recorded = false, beatenShown = false, t0 = 0, clock = 0, rr0 = rng(1), lastMile = 0;
let obs = [], nextGap = 600;
const hero = { y: 0, vy: 0, ground: true, hold: false, holdT: 0, duck: false, duckT: 0, squash: 0, run: 0, dead: false, blink: 0, jumpT: 9 };
const ptr = { down: false, x: 0, y: 0, swiped: false, id: null };
const bot = { until: 0, holdUntil: 0, duckUntil: 0 };
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on the first run, until the first real
// touch, the scooter hops (or ducks) the first obstacles by itself with the game's own bot (never a late reaction), then it's yours
const DN = demo(null, { ready: () => state === 'play' && !hero.dead && score < DAY && !D.isDaily, wait: 500, ms: 4500 });

function reset() {
  rr0 = rng(D.seed || (Date.now() % 100000) + 5);
  obs = []; P.clear(); score = 0; dist = 0; speed = 330; recorded = false; beatenShown = false; lastMile = 0; nextGap = 700;
  Object.assign(hero, { y: 0, vy: 0, ground: true, hold: false, duck: false, duckT: 0, squash: 0, dead: false, jumpT: 9 });
  ui.score(0); ui.levels(1); ui.progress(0); ui.sub(D.isDaily ? 'DAILY CHALLENGE' : best ? 'BEST ' + best : '');
}

// ---------------------------------------------------------------- obstacles
function spawn(x) {
  const sc = score, r = rr0();
  let o;
  if (sc > 220 && r < 0.26) {
    const hk = rr0(), h = hk < 0.35 ? 22 : hk < 0.75 ? 50 : 84;   // low: jump · mid: duck (or a big jump) · high: stay low
    o = { kind: 'bird', x, y: h, w: 40, h: 20, flap: rr0() * 6, extra: 40 };
  } else if (sc > 80 && r < 0.42) o = { kind: 'weed', x, y: 16, w: 30, h: 30, rot: 0, extra: 70 + rr0() * 40, bounce: rr0() * 6 };
  else {
    const k = rr0();
    if (k < 0.32) o = { kind: 'cactus', x, w: 22, h: 40, arms: 1 };
    else if (k < 0.58) o = { kind: 'cactus', x, w: 26, h: 56, arms: 2 };
    else if (k < 0.8 && sc > 60) o = { kind: 'cluster', x, w: 56, h: 42 };
    else o = { kind: 'rock', x, w: 36, h: 22 };
    o.y = o.h / 2; o.extra = 0;
  }
  o.baseX = x; o.x = x + o.extra * 1.4;   // fast movers start a little further out, so the gap you see stays fair
  obs.push(o);
  const fk = F.k(score);
  const minGap = speed * 0.78 + 90;
  nextGap = Math.max(minGap, (speed * (0.75 + rr0() * 0.8) + 60) / Math.min(1.25, fk));
}

// ---------------------------------------------------------------- input
function jumpPress() {
  if (state !== 'play' || hero.dead) return;
  hero.hold = true;
  if (hero.ground) {
    hero.vy = JUMP; hero.ground = false; hero.holdT = 0; hero.jumpT = 0; hero.squash = -0.35; hero.duck = false;
    tone(520, 0.09, 'sine', 0.1, 1.8); buzz(8);
    P.burst(heroSX, gy, ['#f6d9a8', '#e8c28a'], 6, { speed: 80, size: 3, life: 0.4, dir: Math.PI, spread: 1.4 });
  }
}
function jumpRelease() { hero.hold = false; }
function duckPress() {
  if (state !== 'play' || hero.dead) return;
  if (!hero.ground) { hero.vy = Math.min(hero.vy, -1300); hero.hold = false; }   // swipe down mid-air: drop fast
  hero.duck = true; hero.duckT = 0.45;
}
addEventListener('pointerdown', e => { if (state !== 'play') return; ptr.down = true; ptr.x = e.clientX; ptr.y = e.clientY; ptr.swiped = false; ptr.id = e.pointerId; jumpPress(); });
addEventListener('pointermove', e => {
  if (!ptr.down || e.pointerId !== ptr.id || ptr.swiped) return;
  if (e.clientY - ptr.y > 26 && Math.abs(e.clientY - ptr.y) > Math.abs(e.clientX - ptr.x)) { ptr.swiped = true; duckPress(); }
});
const pu = e => { if (e.pointerId !== ptr.id) return; ptr.down = false; jumpRelease(); };
addEventListener('pointerup', pu); addEventListener('pointercancel', pu);
addEventListener('keydown', e => { if (e.repeat) return; if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) jumpPress(); if (['ArrowDown', 'KeyS'].includes(e.code)) duckPress(); });
addEventListener('keyup', e => { if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) jumpRelease(); });

ui.onTap(w => { if (w !== 'start') reset(); state = 'play'; t0 = performance.now(); B.start(); });

// ---------------------------------------------------------------- update
function heroBox() {
  const ducking = hero.duck && hero.ground, h = ducking ? 22 : 38, w = ducking ? 46 : 30;
  return { x0: -w / 2 + 4, x1: w / 2 - 2, y0: hero.y + 2, y1: hero.y + h };
}
function update(dt) {
  clock += dt; P.update(dt); SH.update(dt);
  hero.blink -= dt; if (hero.blink < -3) hero.blink = 0.12;
  if (state !== 'play') { if (state === 'ready') { hero.run += dt * 10; } return; }
  if (hero.dead) return;
  const fk = F.k(score);
  speed = Math.min(780, (330 + score * 0.42) * Math.min(1.2, fk));
  dist += speed * dt;
  const ns = Math.floor(dist / 40);
  if (ns !== score) {
    score = ns; ui.score(score);
    const day = Math.floor(score / DAY) + 1; ui.levels(day); ui.progress((score % DAY) / DAY);
    if (score >= lastMile + 100) { lastMile = Math.floor(score / 100) * 100; note(84, 0.12, 0.08); setTimeout(() => note(88, 0.16, 0.08), 70); ui.els.sc.animate([{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 300 }); }
    if (score % DAY === 0 && score > 0) { ui.pop(`DAY ${day}!`, '#ffd166', 40, 28); sfx.win(); }
    if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); P.burst(W / 2, H * 0.3, ['#ff5d8f', '#ffd23f', '#3ab795', '#3a86ff', '#fff'], 80, { speed: 420, size: 5, g: 400, kind: 'conf', life: 1.6 }); }
  }
  // hero
  hero.run += dt * (6 + speed / 60);
  if (DN.on) { for (const o of obs) o.botLate = false; bot.until = clock + 0.05; }
  if (clock < bot.until) botThink();
  const held = hero.hold || clock < bot.holdUntil;
  if (!hero.ground) {
    hero.jumpT += dt;
    const gg = held && hero.vy > 0 && hero.holdT < HOLD_T ? HOLD_G : GRAV; if (held) hero.holdT += dt;
    hero.vy -= gg * dt; hero.y += hero.vy * dt;
    if (hero.y <= 0) {
      hero.y = 0; hero.ground = true; hero.squash = 0.35; const hard = hero.vy < -900; hero.vy = 0;
      P.burst(heroSX, gy, ['#f6d9a8', '#e8c28a', '#fff1d8'], hard ? 12 : 6, { speed: hard ? 140 : 90, size: 3, life: 0.45, dir: -Math.PI / 2, spread: 2.6, g: 200 });
      tone(200, 0.05, 'sine', 0.06, 0.7);
      if (ptr.down && !ptr.swiped && hero.hold) hero.hold = false;
    }
  }
  if (hero.duck) { const keep = (ptr.down && ptr.swiped) || K.has('ArrowDown') || K.has('KeyS') || clock < bot.duckUntil; hero.duckT -= dt; if (hero.duckT <= 0 && !keep) hero.duck = false; }
  hero.squash *= Math.pow(0.0005, dt);
  if (hero.ground && Math.random() < dt * 8) P.burst(heroSX - 14, gy - 2, ['rgba(246,217,168,.8)'], 1, { speed: 40, size: 2.5, life: 0.35, dir: Math.PI + 0.3, spread: 0.6 });
  // obstacles
  for (const o of obs) {
    o.x -= o.extra * dt;
    if (o.kind === 'weed') { o.rot -= (speed + o.extra) * dt / 15; o.bounce += dt * 7; o.y = 16 + Math.abs(Math.sin(o.bounce)) * 14; }
    if (o.kind === 'bird') o.flap += dt * 12;
  }
  while (obs.length && obs[0].x - dist < -200) obs.shift();
  const edge = dist + W / s + 80;
  if (!obs.length) spawn(edge);
  else { const lastX = obs[obs.length - 1].baseX; if (lastX + nextGap < edge + 200) spawn(Math.max(lastX + nextGap, edge)); }
  // collisions (forgiving boxes)
  const hb = heroBox();
  for (const o of obs) {
    const ox = o.x - dist, sh = o.kind === 'bird' ? 0.75 : 0.72;
    const x0 = ox - o.w / 2 * sh, x1 = ox + o.w / 2 * sh, y0 = o.y - o.h / 2 * sh, y1 = o.y + o.h / 2 * sh;
    if (hb.x1 > x0 && hb.x0 < x1 && hb.y1 > y0 && hb.y0 < y1) { crash(o); break; }
  }
}
let lastCrash = '';
function crash(o) {
  lastCrash = o.kind + ' y' + o.y + ' h' + o.h + ' hy' + hero.y.toFixed(0) + ' duck' + hero.duck + ' sp' + speed.toFixed(0);
  hero.dead = true; state = 'lost';
  SH.kick(14); ui.flash(0.4); sfx.fail(); buzz([60, 40, 100]);
  P.burst(heroSX, gy - hero.y * s - 20 * s, ['#ffd166', '#fff', '#f2b366'], 22, { speed: 260, size: 4, life: 0.8, kind: 'square', g: 500 });
  if (!recorded) { recorded = true; F.endless(score); B.submit(score, { ms: performance.now() - t0 }); }
  const nb = score > best; best = Math.max(best, score); S.set('best', best);
  ui.lose('OUCH!', nb && score > 0 ? `New best: ${score}!` : `Score ${score} · best ${best}`);
}

// ---------------------------------------------------------------- draw
const X = wx => heroSX + wx * s, Y = wy => gy - wy * s;
function drawLayer(L, cols, tday) {
  const tile = 1600, off = (dist * L.par) % tile;
  g.fillStyle = cols; g.beginPath(); g.moveTo(0, gy);
  for (let rep = -1; rep < 3; rep++) {
    for (let i = 0; i <= L.n; i++) {
      const wx = rep * tile + (i / L.n) * tile - off, sx = wx * s;
      if (sx < -tile * s || sx > W + tile * s) continue;
      const h = L.pts[i % L.n] * s * (W < H ? 1.1 : 1);
      if (L.kind === 'mesa') { const w = tile / L.n * s; g.lineTo(sx, gy - h * 0.2); g.lineTo(sx + w * 0.18, gy - h); g.lineTo(sx + w * 0.6, gy - h); g.lineTo(sx + w * 0.8, gy - h * 0.2); }
      else g.quadraticCurveTo(sx - tile / L.n * s * 0.5, gy - h * 1.25, sx, gy - h);
    }
  }
  g.lineTo(W, gy); g.closePath(); g.fill();
}
function drawCactus(x, base, w, h, arms, col, dark) {
  g.fillStyle = col; g.strokeStyle = dark; g.lineWidth = 2 * s;
  const rr = (x0, y0, ww, hh) => { g.beginPath(); g.roundRect(x0, y0, ww, hh, ww / 2); g.fill(); g.stroke(); };
  rr(x - w * 0.22 * s, base - h * s, w * 0.44 * s, h * s + 2);
  if (arms >= 1) { rr(x - w * 0.62 * s, base - h * 0.62 * s, w * 0.26 * s, h * 0.3 * s); rr(x - w * 0.6 * s, base - h * 0.4 * s, w * 0.4 * s, w * 0.22 * s); }
  if (arms >= 2) { rr(x + w * 0.36 * s, base - h * 0.82 * s, w * 0.26 * s, h * 0.34 * s); rr(x + w * 0.18 * s, base - h * 0.56 * s, w * 0.44 * s, w * 0.22 * s); }
  g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1.2 * s; g.beginPath(); g.moveTo(x - w * 0.05 * s, base - h * s + 6 * s); g.lineTo(x - w * 0.05 * s, base - 4 * s); g.stroke();
  if (h > 50) { g.fillStyle = '#ff7eb6'; g.beginPath(); g.arc(x, base - h * s + 1, 3.4 * s, 0, 7); g.fill(); }
}
function drawObs(o, night) {
  const x = X(o.x - dist), cacCol = night ? '#4f8f6a' : '#57b37a', cacDark = night ? '#2c5a44' : '#2f7d52';
  if (o.kind === 'cactus') drawCactus(x, gy + 2, o.w, o.h, o.arms, cacCol, cacDark);
  else if (o.kind === 'cluster') { drawCactus(x - 16 * s, gy + 2, 18, 34, 1, cacCol, cacDark); drawCactus(x + 4 * s, gy + 2, 22, 44, 2, cacCol, cacDark); drawCactus(x + 20 * s, gy + 2, 16, 26, 0, cacCol, cacDark); }
  else if (o.kind === 'rock') {
    g.fillStyle = night ? '#8a7c88' : '#b9a189'; g.strokeStyle = night ? '#5b5060' : '#7d6650'; g.lineWidth = 2 * s;
    g.beginPath(); g.moveTo(x - 18 * s, gy + 2); g.quadraticCurveTo(x - 16 * s, gy - 20 * s, x - 2 * s, gy - 22 * s); g.quadraticCurveTo(x + 16 * s, gy - 22 * s, x + 18 * s, gy + 2); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.ellipse(x - 6 * s, gy - 14 * s, 5 * s, 3 * s, -0.4, 0, 7); g.fill();
  } else if (o.kind === 'weed') {
    const y = Y(o.y); g.save(); g.translate(x, y); g.rotate(o.rot); g.strokeStyle = night ? '#b5926a' : '#c99a5b'; g.lineWidth = 2 * s;
    for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(0, 0, 15 * s, (5 + i % 3 * 4) * s, i * 0.7, 0, 7); g.stroke(); }
    g.restore();
    g.fillStyle = 'rgba(0,0,0,.12)'; g.beginPath(); g.ellipse(x, gy + 3, 14 * s, 3 * s, 0, 0, 7); g.fill();
  } else if (o.kind === 'bird') {
    const y = Y(o.y), wv = Math.sin(o.flap);
    g.fillStyle = night ? '#9b7fd9' : '#7b5cff';
    g.beginPath(); g.ellipse(x, y, 15 * s, 7 * s, 0, 0, 7); g.fill();
    g.beginPath(); g.moveTo(x - 4 * s, y - 2 * s); g.quadraticCurveTo(x + 2 * s, y - 22 * s * wv, x + 12 * s, y - 16 * s * wv); g.quadraticCurveTo(x + 6 * s, y - 4 * s, x + 4 * s, y); g.fill();
    g.fillStyle = '#ffd166'; g.beginPath(); g.moveTo(x - 15 * s, y - 2 * s); g.lineTo(x - 23 * s, y + 1 * s); g.lineTo(x - 15 * s, y + 3 * s); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x - 9 * s, y - 2 * s, 3 * s, 0, 7); g.fill(); g.fillStyle = '#1b1830'; g.beginPath(); g.arc(x - 10 * s, y - 2 * s, 1.5 * s, 0, 7); g.fill();
    g.fillStyle = night ? '#7d64b8' : '#5d43d6'; g.beginPath(); g.moveTo(x + 13 * s, y); g.lineTo(x + 22 * s, y - 4 * s); g.lineTo(x + 21 * s, y + 4 * s); g.fill();
    if (state === 'play' && o.x - dist < W / s && o.x - dist > 60) { g.fillStyle = 'rgba(0,0,0,.08)'; g.beginPath(); g.ellipse(x, gy + 3, 12 * s, 2.5 * s, 0, 0, 7); g.fill(); }
  }
}
function drawHero(night) {
  const ducking = hero.duck && hero.ground && !hero.dead, air = !hero.ground;
  const x = heroSX, base = Y(hero.y);
  const hop = hero.ground && !ducking && state !== 'lost' ? Math.abs(Math.sin(hero.run)) * 5 * s : 0;
  g.fillStyle = 'rgba(0,0,0,.14)'; g.beginPath(); g.ellipse(x, gy + 2, Math.max(6, 18 - hero.y * 0.08) * s, 3.5 * s, 0, 0, 7); g.fill();
  g.save(); g.translate(x, base - hop);
  const sq = hero.squash; g.scale(1 + sq * 0.5 + (ducking ? 0.25 : 0), 1 - sq * 0.5 - (ducking ? 0.38 : 0));
  if (hero.dead) g.rotate(-0.5);
  else if (air) g.rotate(-Math.max(-0.4, Math.min(0.4, hero.vy / 2200)));
  const k = s, body = '#f2b366', belly = '#fff1d8', dark = '#b8763a';
  // tail (long with a tuft)
  const tw = Math.sin(hero.run * 0.5) * 0.25;
  g.strokeStyle = body; g.lineWidth = 3 * k; g.lineCap = 'round'; g.beginPath(); g.moveTo(-12 * k, -14 * k);
  g.quadraticCurveTo(-30 * k, (-14 + (air ? -8 : 6)) * k + tw * 20 * k, -42 * k, (-24 + (air ? -6 : 0)) * k + tw * 30 * k); g.stroke();
  g.fillStyle = '#fff6ea'; g.beginPath(); g.ellipse(-44 * k, (-25 + (air ? -6 : 0)) * k + tw * 30 * k, 6 * k, 4 * k, 0.5, 0, 7); g.fill();
  g.fillStyle = '#3b2a2a'; g.beginPath(); g.ellipse(-47 * k, (-26 + (air ? -6 : 0)) * k + tw * 30 * k, 3.5 * k, 2.6 * k, 0.5, 0, 7); g.fill();
  // feet
  const ph = hero.run, fa = air ? 0.9 : Math.sin(ph) * 0.8;
  g.fillStyle = dark;
  for (const [dx, a] of [[-4, fa], [4, -fa]]) { g.save(); g.translate(dx * k, -6 * k); g.rotate(a * 0.5); g.beginPath(); g.ellipse(4 * k, 4 * k, 9 * k, 3.2 * k, 0, 0, 7); g.fill(); g.restore(); }
  // body
  g.fillStyle = body; g.beginPath(); g.ellipse(0, -18 * k, 15 * k, 13 * k, 0, 0, 7); g.fill();
  g.fillStyle = belly; g.beginPath(); g.ellipse(4 * k, -14 * k, 9 * k, 8 * k, 0, 0, 7); g.fill();
  // head + ears
  const hx = 10 * k, hy = -31 * k, earA = ducking ? 1.25 : air ? 0.85 : 0.35 + Math.sin(hero.run) * 0.06;
  for (const [ex, ea] of [[-3, earA + 0.15], [3, earA]]) {
    g.save(); g.translate(hx + ex * k - 4 * k, hy - 6 * k); g.rotate(-ea);
    g.fillStyle = body; g.beginPath(); g.ellipse(0, -13 * k, 6 * k, 14 * k, 0, 0, 7); g.fill();
    g.fillStyle = '#ffb0b8'; g.beginPath(); g.ellipse(0, -13 * k, 3.4 * k, 10 * k, 0, 0, 7); g.fill(); g.restore();
  }
  g.fillStyle = body; g.beginPath(); g.ellipse(hx, hy, 11 * k, 10 * k, 0, 0, 7); g.fill();
  g.fillStyle = '#ffb0b8'; g.beginPath(); g.arc(hx + 10 * k, hy + 1 * k, 2.2 * k, 0, 7); g.fill();
  if (hero.dead) { g.strokeStyle = '#2b1d1d'; g.lineWidth = 1.8 * k; for (const sgn of [-1, 1]) { g.beginPath(); g.moveTo(hx + 1 * k + sgn * 2.5 * k, hy - 4.5 * k); g.lineTo(hx + 1 * k - sgn * 2.5 * k, hy + 0.5 * k); g.stroke(); } }
  else if (hero.blink > 0) { g.strokeStyle = '#2b1d1d'; g.lineWidth = 1.8 * k; g.beginPath(); g.moveTo(hx - 2 * k, hy - 2 * k); g.lineTo(hx + 4 * k, hy - 2 * k); g.stroke(); }
  else { g.fillStyle = '#2b1d1d'; g.beginPath(); g.ellipse(hx + 1.5 * k, hy - 2 * k, 3.4 * k, 4 * k, 0, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(hx + 2.6 * k, hy - 3.5 * k, 1.3 * k, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(255,120,120,.35)'; g.beginPath(); g.ellipse(hx + 2 * k, hy + 4 * k, 3.2 * k, 2 * k, 0, 0, 7); g.fill();
  // little scarf so he reads at a glance
  g.fillStyle = '#3ab795'; g.beginPath(); g.roundRect(-1 * k, -26 * k, 15 * k, 4 * k, 2 * k); g.fill();
  g.beginPath(); g.moveTo(0, -25 * k); g.lineTo(-10 * k, (-24 + Math.sin(clock * 18) * 3) * k); g.lineTo(-9 * k, (-20 + Math.sin(clock * 18 + 1) * 3) * k); g.closePath(); g.fill();
  g.restore();
}
function draw() {
  V.begin();
  const tday = ((dist / 40) % DAY) / DAY, [top, hor, far, near] = skyAt(tday), night = tday > 0.64 && tday < 0.93;
  const sg = g.createLinearGradient(0, 0, 0, gy); sg.addColorStop(0, top); sg.addColorStop(1, hor); g.fillStyle = sg; g.fillRect(0, 0, W, gy + 2);
  // stars
  const sa = night ? Math.min(1, (Math.min(tday - 0.64, 0.93 - tday)) * 25) : 0;
  if (sa > 0) for (const st of stars) { g.globalAlpha = sa * (0.5 + 0.5 * Math.sin(clock * 2 + st.p)); g.fillStyle = '#fff'; g.fillRect(st.x * W, st.y * gy, st.s, st.s); }
  g.globalAlpha = 1;
  // sun and moon on an arc
  const arcY = (p) => gy - Math.sin(p * Math.PI) * gy * 0.82;
  const sunP = tday / 0.66; if (sunP >= 0 && sunP <= 1) { const sx = W * (0.08 + 0.84 * sunP), sy = arcY(sunP);
    const gl = g.createRadialGradient(sx, sy, 0, sx, sy, 90 * s); gl.addColorStop(0, 'rgba(255,240,180,.55)'); gl.addColorStop(1, 'rgba(255,240,180,0)'); g.fillStyle = gl; g.beginPath(); g.arc(sx, sy, 90 * s, 0, 7); g.fill();
    g.fillStyle = tday > 0.5 ? '#ffb35c' : '#fff1b0'; g.beginPath(); g.arc(sx, sy, 26 * s, 0, 7); g.fill(); }
  const moonP = (tday - 0.62) / 0.36; if (moonP >= 0 && moonP <= 1) { const mx = W * (0.08 + 0.84 * moonP), my = arcY(moonP);
    g.fillStyle = '#f4f1ff'; g.beginPath(); g.arc(mx, my, 20 * s, 0, 7); g.fill(); g.fillStyle = top; g.beginPath(); g.arc(mx + 8 * s, my - 5 * s, 17 * s, 0, 7); g.fill(); }
  // parallax
  drawLayer(layers[0], lerpc(far, hor, 0.45), tday);
  drawLayer(layers[1], far, tday);
  drawLayer(layers[2], near, tday);
  // ground
  const gg = g.createLinearGradient(0, gy, 0, H); gg.addColorStop(0, night ? '#7d6a78' : '#f3cf92'); gg.addColorStop(1, night ? '#4b3f55' : '#e2a865'); g.fillStyle = gg; g.fillRect(0, gy, W, H - gy);
  g.fillStyle = night ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.35)'; g.fillRect(0, gy, W, 2.5 * s);
  for (const p of pebbles) { const px = ((p.x - dist) % 1600 + 1600) % 1600 * s; for (const o2 of [0, 1600 * s]) { const xx = px + o2 - 100; if (xx > W) continue; g.fillStyle = p.c < 0.5 ? 'rgba(160,100,50,.25)' : 'rgba(255,255,255,.25)'; g.fillRect(xx, gy + p.y * s, p.w * s, 2 * s); } }
  drawForeground(night);
  g.save(); g.translate(SH.x, SH.y);
  for (const o of obs) drawObs(o, night);
  drawHero(night);
  P.draw(g);
  g.restore();
  // night tint
  if (night) { g.fillStyle = `rgba(20,20,70,${0.18 * sa})`; g.fillRect(0, 0, W, H); }
}

// foreground: sand ripples, a closer dune band and little desert props scrolling faster than the track
const props = []; { const r = rng(77); for (let i = 0; i < 14; i++) props.push({ x: r() * 2400, k: r(), y: r(), s: 0.7 + r() * 0.6 }); }
function drawForeground(night) {
  const depth = H - gy; if (depth < 60) return;
  // ripples
  g.strokeStyle = night ? 'rgba(255,255,255,.06)' : 'rgba(190,120,50,.18)'; g.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    const yy = gy + depth * (0.12 + i * 0.13), par = 1.1 + i * 0.12, off = (dist * par * s) % 180;
    g.beginPath(); for (let x = -off - 180; x < W + 180; x += 180) { g.moveTo(x, yy); g.quadraticCurveTo(x + 45, yy - 6, x + 90, yy); g.quadraticCurveTo(x + 135, yy + 6, x + 180, yy); } g.stroke();
  }
  // props (succulents, bones, pebbles) in the near sand
  for (const p of props) {
    const par = 1.25 + p.y * 0.5, px = ((p.x - dist * par) % 2400 + 2400) % 2400 * s - 60, py = gy + depth * (0.3 + p.y * 0.6);
    if (px > W + 60) continue;
    const k = s * p.s * (1 + p.y * 0.5);
    if (p.k < 0.4) { g.fillStyle = night ? '#4f7d68' : '#6cc08a'; for (let j = -2; j <= 2; j++) { g.beginPath(); g.ellipse(px + j * 5 * k, py - 7 * k, 3.5 * k, 10 * k, j * 0.35, 0, 7); g.fill(); } }
    else if (p.k < 0.6) { g.fillStyle = night ? '#d8d0dc' : '#fff7ea'; g.beginPath(); g.roundRect(px - 12 * k, py - 3 * k, 24 * k, 5 * k, 2.5 * k); g.fill(); for (const sx of [-1, 1]) { g.beginPath(); g.arc(px + sx * 12 * k, py - 3 * k, 3.5 * k, 0, 7); g.arc(px + sx * 12 * k, py + 2 * k, 3.5 * k, 0, 7); g.fill(); } }
    else { g.fillStyle = night ? '#6b5c70' : '#c9a27a'; g.beginPath(); g.ellipse(px, py, 9 * k, 5 * k, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.ellipse(px - 3 * k, py - 2 * k, 3 * k, 1.5 * k, 0, 0, 7); g.fill(); }
  }
}

let last = performance.now();
function frame(t) { const dt = Math.min(0.04, (t - last) / 1000); last = t; update(dt); draw(); requestAnimationFrame(frame); }
reset(); ui.start(); requestAnimationFrame(frame);

// ---------------------------------------------------------------- test hooks
function botThink() {
  const o = obs.find(o => o.x - dist + o.w / 2 > -14);
  if (!o) return;
  if (o.botLate == null) o.botLate = Math.random() < 0.12;   // about one obstacle in eight: a late, human-like reaction
  if (o.botLate && o.x - dist > 40) return;
  const dx = o.x - dist - o.w / 2 - 15, v = speed + o.extra, t = dx / v;
  if (o.kind === 'bird' && o.y > 70) return;                          // high flier: stay on the ground
  if (o.kind === 'bird' && o.y > 40) { if (t < 0.35 && hero.ground) { bot.duckUntil = clock + 0.12; if (!hero.duck) duckPress(); } return; }
  const tall = o.h > 44 || o.kind === 'cluster' || o.kind === 'weed';
  if (hero.ground && t < (tall ? 0.2 : 0.16) + o.w / v * 0.3 && t > 0) { jumpPress(); hero.hold = false; bot.holdUntil = clock + (tall ? 0.2 : 0.06); }
}
window.__game = {
  get state() { return state; }, get level() { return Math.floor(score / DAY) + 1; }, get score() { return score; }, get dbg() { return lastCrash + ' | ' + obs.map(o => o.kind[0] + Math.round(o.x - dist)).join(','); },
  bot() { if (state === 'play') bot.until = clock + 1.0; },
};
