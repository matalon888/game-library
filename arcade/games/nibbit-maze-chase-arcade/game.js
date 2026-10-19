// Nibbit — maze chase arcade. Steer Nib (a round mint critter with big ears) through a neon maze, eat every
// crumb, and grab glow pellets to make the four critters chasing you go pale and edible for a few seconds.
// Every level is a new symmetric maze built from a seed. The four chasers each think differently:
//   Brute  — goes straight for you            Sneak — aims a few tiles ahead of you
//   Drift  — wanders, but charges when it sees you down a straight corridor
//   Clingy — guards the bottom-left quarter; hunts you only when you step into it
import { createUI, store, buzz, sfx, tone, note, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { css, BASE_CSS, ICON, stage2d, rr, sprite, blit, fx as mkfx, hud as mkhud, keys, swiper, touchy, dressStart, paused } from './neo.js';

const NAME = 'Nibbit: Maze Chase Arcade';
const SAVE = store('nibbit');
let best = SAVE.get('best', 0);
const F = flow('nibbit', { par: 4000, warmup: 600 });
css(BASE_CSS + `body{--acc:#5b7bff;--acc2:#4dffd2;--bgA:#0a0a22;--bgB:#22206a;--bgC:#05051a}
.nb-dpad{position:fixed;left:50%;bottom:calc(12px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:7;display:grid;grid-template-columns:repeat(3,62px);grid-template-rows:repeat(3,52px);gap:6px;pointer-events:none}
.nb-dpad .neo-btn{max-width:none;height:52px;border-radius:18px}
.nb-dpad .u{grid-area:1/2}.nb-dpad .l{grid-area:2/1}.nb-dpad .r{grid-area:2/3}.nb-dpad .d{grid-area:3/2}
.nb-dpad.hide{display:none}
.nb-cast{display:flex;gap:10px;justify-content:center;margin-top:8px}
.nb-cast div{display:flex;flex-direction:column;align-items:center;font:800 12px 'Baloo 2',system-ui;letter-spacing:.06em;gap:2px;width:66px}
.nb-cast canvas{width:46px;height:46px;border-radius:14px;background:rgba(255,255,255,.07);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1)}
.nb-cast small{font-weight:600;font-size:10.5px;opacity:.7;letter-spacing:0;line-height:1.15;text-align:center}`);
const ui = createUI({ title: 'NIBBIT', hint: 'Tap to play', hand: '👆', progress: false, score: false });
const D = daily('nibbit', ui, { name: NAME });
const B = board({ game: 'nibbit', label: 'Points', limits: { maxRun: 300000, maxPerSec: 400 }, corner: 'tl' });
const SD = dressStart(ui, { kicker: 'MAZE CHASE', line: 'Swipe to steer Nib · eat every crumb<br>glow pellets turn the chasers edible', best });
ui.els.lose.querySelector('.hint').textContent = 'Tap to play again';
const S = stage2d(), FX = mkfx(), H = mkhud('SCORE');
let ctx = S.ctx;

// ---------------------------------------------------------------- maze generation (symmetric, loops, no dead ends)
const MW = 19, MH = 23, HX = 9, DOOR = [9, 10], HERO0 = [9, 15], TUN = 11;
let T = [];   // 0 wall, 1 path, 2 house
function genMaze(seed) {
  const r = rng(seed); T = Array.from({ length: MH }, () => new Array(MW).fill(0));
  const CW = 9, CH = 11, house = new Set(['3,5', '4,5', '5,5']), cx = i => 1 + 2 * i, cy = j => 1 + 2 * j;
  const open = (x, y) => { T[y][x] = 1; T[y][MW - 1 - x] = 1; };
  for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) if (!house.has(i + ',' + j)) T[cy(j)][cx(i)] = 1;
  // union-find over the left half + centre column
  const id = (i, j) => j * CW + i, par = []; for (let k = 0; k < CW * CH; k++) par[k] = k;
  const find = k => par[k] === k ? k : (par[k] = find(par[k])), uni = (a, b) => { a = find(a); b = find(b); if (a === b) return false; par[a] = b; return true; };
  const link = (i, j, i2, j2) => { open((cx(i) + cx(i2)) / 2, (cy(j) + cy(j2)) / 2); uni(id(i, j), id(i2, j2)); };
  // ring around the house
  for (const [a, b, c, d] of [[2, 4, 3, 4], [3, 4, 4, 4], [2, 6, 3, 6], [3, 6, 4, 6], [2, 4, 2, 5], [2, 5, 2, 6]]) link(a, b, c, d);
  const edges = [];
  for (let j = 0; j < CH; j++) for (let i = 0; i <= 4; i++) {
    if (house.has(i + ',' + j)) continue;
    if (i < 4 && !house.has((i + 1) + ',' + j)) edges.push([i, j, i + 1, j]);
    if (j < CH - 1 && !house.has(i + ',' + (j + 1))) edges.push([i, j, i, j + 1]);
  }
  for (let k = edges.length - 1; k > 0; k--) { const m = Math.floor(r() * (k + 1)); [edges[k], edges[m]] = [edges[m], edges[k]]; }
  const rest = [];
  for (const e of edges) { if (find(id(e[0], e[1])) !== find(id(e[2], e[3]))) link(...e); else rest.push(e); }
  // horizontal links across the centre column join the halves (mirrored automatically); make sure there are a few
  // remove dead ends
  const deg = (i, j) => { const x = cx(i), y = cy(j); return [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => T[y + dy] && T[y + dy][x + dx] === 1).length; };
  for (let pass = 0; pass < 4; pass++) for (let j = 0; j < CH; j++) for (let i = 0; i <= 4; i++) {
    if (house.has(i + ',' + j) || deg(i, j) > 1) continue;
    const c = rest.filter(e => (e[0] === i && e[1] === j) || (e[2] === i && e[3] === j)).filter(e => T[(cy(e[1]) + cy(e[3])) / 2][(cx(e[0]) + cx(e[2])) / 2] === 0);
    if (c.length) { const e = c[Math.floor(r() * c.length)]; link(...e); }
  }
  for (const e of rest) if (r() < 0.1) link(...e);
  // tunnel
  T[TUN][0] = 1; T[TUN][MW - 1] = 1;
  // house: interior + door
  for (let x = 7; x <= 11; x++) T[11][x] = 2; T[DOOR[1]][DOOR[0]] = 2;
  for (let x = 5; x <= 13; x++) { T[9][x] = 1; T[13][x] = 1; } for (let y = 9; y <= 13; y++) { T[y][5] = 1; T[y][13] = 1; }
}
let HOME = null;
function homeMap() { HOME = new Int16Array(MW * MH).fill(-1); const Q = [9 * MW + 9]; HOME[Q[0]] = 0; while (Q.length) { const k = Q.shift(), x = k % MW, y = (k / MW) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = (x + dx + MW) % MW, ny = y + dy; if (!isPath(nx, ny)) continue; const nk = ny * MW + nx; if (HOME[nk] >= 0) continue; HOME[nk] = HOME[k] + 1; Q.push(nk); } } }
const isPath = (x, y) => { if (y < 0 || y >= MH) return false; x = (x + MW) % MW; return T[y][x] === 1; };

// ---------------------------------------------------------------- state
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }, OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
const GH = [
  { name: 'Brute', c: '#ff4d5e', blurb: 'charges straight at you' },
  { name: 'Sneak', c: '#ff7ad9', blurb: 'cuts you off ahead' },
  { name: 'Drift', c: '#4dc9ff', blurb: 'wanders, then lunges' },
  { name: 'Clingy', c: '#ffa53d', blurb: 'guards its corner' },
];
let state = 'ready', score = 0, lives = 3, level = 1, recorded = false, beatenShown = false, seed = 1;
let dots = new Set(), pellets = new Set(), totalDots = 0, eatenDots = 0, hero, ghosts = [], want = null;
let fright = 0, frightMax = 1, chainN = 0, modeT = 0, modeI = 0, freeze = 0, dying = 0, clearT = -1, readyT = 0, fruit = null, fruitsShown = 0, chompT = 0, mazeCache = null, flashMaze = 0;
const MODES = [7, 20, 7, 20, 5, 1e9];   // scatter, chase, scatter, chase...
const key = (x, y) => y * MW + x;

function placeActors() {
  hero = { x: HERO0[0], y: HERO0[1], dir: 'left', t: 0, moving: true, mouth: 0 }; want = null;
  ghosts = GH.map((g, i) => ({ ...g, i, x: 9, y: 9, dir: 'left', t: 0, mode: i === 0 ? 'grid' : 'house', px: 9, py: 11, slot: [9, 8, 10, 9][i], release: [0, 1.2, 4, 7][i], fr: false, eyes: false, wanderT: 0, wtx: 9, wty: 9 }));
  for (const g of ghosts) if (g.mode === 'house') { g.px = g.slot; g.py = 11; }
  fright = 0; modeT = 0; modeI = 0; readyT = 1.4; fruit = null;
}
function buildLevel(lv) {
  level = lv; genMaze(seed * 31 + lv * 977); mazeCache = null; dots = new Set(); pellets = new Set();
  const pp = [[1, 3], [MW - 2, 3], [1, MH - 4], [MW - 2, MH - 4]];
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    if (T[y][x] !== 1 || (y === TUN && (x < 3 || x > MW - 4)) || (x === HERO0[0] && y === HERO0[1])) continue;
    if (y >= 9 && y <= 13 && x >= 5 && x <= 13) continue;
    dots.add(key(x, y));
  }
  for (const [px, py] of pp) { let best = null, bd = 1e9; for (const k of dots) { const x = k % MW, y = (k / MW) | 0, d = Math.abs(x - px) + Math.abs(y - py); if (d < bd) { bd = d; best = k; } } if (best !== null) { dots.delete(best); pellets.add(best); } }
  homeMap(); totalDots = dots.size + pellets.size; eatenDots = 0; fruitsShown = 0; clearT = -1; placeActors();
}
const lvMul = () => 1 + Math.min(level - 1, 6) * 0.045;
const heroSpeed = () => 7.4 * lvMul() * (fright > 0 ? 1.08 : 1);
function ghostSpeed(g) {
  if (g.eyes) return 15;
  const inTun = g.y === TUN && (g.x < 4 || g.x > MW - 5);
  if (inTun) return 3.8;
  if (g.fr) return 4.3;
  let s = 6.9 * lvMul() * F.k(score); if (g.i === 0 && totalDots - eatenDots < 40) s *= 1.06; return Math.min(s, 10.5);
}
function reset() { seed = D.seed || (Date.now() % 1e6) + 9; score = 0; lives = 3; recorded = false; beatenShown = false; H.score(0); buildLevel(1); }
function addScore(n) { score += n; H.score(score); if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); confetti(); sfx.win(); } }
function confetti() { FX.burst(S.w / 2, S.h * 0.4, ['#4dffd2', '#ffd84d', '#ff7ad9', '#4dc9ff', '#fff'], 60, { speed: 420, life: 1.3, size: 6, grav: 380, drag: 1.4 }); }
const tc = (x, y) => [L.mx + (x + 0.5) * L.s, L.my + (y + 0.5) * L.s];

// ---------------------------------------------------------------- movement
function pos(e) { const [dx, dy] = DIRS[e.dir]; let x = e.x + dx * e.t, y = e.y + dy * e.t; if (x < -0.5) x += MW; if (x > MW - 0.5) x -= MW; return [x, y]; }
function heroArrive() {
  const k = key(hero.x, hero.y);
  if (dots.has(k)) { dots.delete(k); eatenDots++; addScore(10); chompT = 0.14; if (eatenDots % 2) tone(520, 0.045, 'triangle', 0.06, 1.25); else tone(440, 0.045, 'triangle', 0.06, 0.85); afterEat(); }
  if (pellets.has(k)) {
    pellets.delete(k); eatenDots++; addScore(50); frightMax = Math.max(1.6, (7 - (level - 1) * 0.7)) / F.k(score); fright = frightMax; chainN = 0;
    for (const g of ghosts) if (!g.eyes) { g.fr = true; if (g.mode === 'grid' && g.t > 0) { g.x += DIRS[g.dir][0]; g.y += DIRS[g.dir][1]; g.x = (g.x + MW) % MW; g.dir = OPP[g.dir]; g.t = 1 - g.t; } }
    const [cx, cy] = tc(hero.x, hero.y); FX.ring(cx, cy, '#ffffff', 4, L.s * 5, 0.5, 4); FX.flash('#9fb6ff', 0.15); buzz([15, 20, 15]);
    [60, 64, 67, 72].forEach((m, i) => setTimeout(() => note(m, 0.18, 0.12), i * 50)); afterEat();
  }
  if (fruit && hero.x === fruit.x && hero.y === fruit.y) { const p = 100 * level + 100; addScore(p); const [cx, cy] = tc(fruit.x, fruit.y); FX.text(cx, cy, '+' + p, '#ffd84d', 22); FX.burst(cx, cy, ['#ff5f7e', '#ffd84d', '#fff'], 18, { speed: 220, life: 0.6, size: 4 }); sfx.coin(); fruit = null; }
  // turn
  if (want && want !== hero.dir) { const [dx, dy] = DIRS[want]; if (isPath(hero.x + dx, hero.y + dy)) hero.dir = want; }
  const [dx, dy] = DIRS[hero.dir]; hero.moving = isPath(hero.x + dx, hero.y + dy);
}
function afterEat() {
  if ((eatenDots === 70 || eatenDots === 170) && !fruit) fruit = { x: HERO0[0], y: HERO0[1], t: 9 };
  if (!dots.size && !pellets.size) { clearT = 0; flashMaze = 1; sfx.win(); ui.pop(`LEVEL ${level} CLEAR!`, '#4dffd2', 38, 30); confetti(); addScore(500 * level); }
}
function stepHero(dt) {
  if (!hero.moving) {
    if (want) { const [dx, dy] = DIRS[want]; if (isPath(hero.x + dx, hero.y + dy)) { hero.dir = want; hero.moving = true; } }
    if (!hero.moving) return;
  }
  if (want === OPP[hero.dir] && hero.t > 0) { const [dx, dy] = DIRS[hero.dir]; hero.x = (hero.x + dx + MW) % MW; hero.y += dy; hero.dir = want; hero.t = 1 - hero.t; }
  hero.t += heroSpeed() * dt; hero.mouth += dt * 14;
  while (hero.t >= 1 && hero.moving) { const [dx, dy] = DIRS[hero.dir]; hero.x = (hero.x + dx + MW) % MW; hero.y += dy; hero.t -= 1; heroArrive(); if (!hero.moving) hero.t = 0; }
}
function los(g) {
  if (g.x !== hero.x && g.y !== hero.y) return false;
  if (g.x === hero.x) { const a = Math.min(g.y, hero.y), b = Math.max(g.y, hero.y); for (let y = a; y <= b; y++) if (!isPath(g.x, y)) return false; return b - a < 10; }
  const a = Math.min(g.x, hero.x), b = Math.max(g.x, hero.x); for (let x = a; x <= b; x++) if (!isPath(x, g.y)) return false; return b - a < 10;
}
function target(g) {
  if (g.eyes) return [9, 9];
  const scatter = modeI % 2 === 0, corners = [[MW - 2, -2], [1, -2], [MW - 1, MH + 1], [0, MH + 1]];
  if (g.i === 3) { const inQ = hero.x <= 9 && hero.y >= 12; if (inQ && !scatter) return [hero.x, hero.y]; if (g.wanderT <= 0) { g.wtx = 1 + Math.floor(Math.random() * 8); g.wty = 13 + Math.floor(Math.random() * 9); g.wanderT = 2.5; } return [g.wtx, g.wty]; }
  if (scatter) return corners[g.i];
  if (g.i === 0) return [hero.x, hero.y];
  if (g.i === 1) { const [dx, dy] = DIRS[hero.dir]; return [hero.x + dx * 4, hero.y + dy * 4]; }
  if (g.i === 2) { if (los(g)) return [hero.x, hero.y]; return null; }
}
function ghostArrive(g) {
  if (g.eyes && g.x === 9 && g.y === 9) { g.mode = 'enter'; g.px = 9; g.py = 9; return; }
  if (g.eyes) { let bd = 1e9; for (const d of Object.keys(DIRS)) { const nx = (g.x + DIRS[d][0] + MW) % MW, ny = g.y + DIRS[d][1]; if (!isPath(nx, ny)) continue; const v = HOME[ny * MW + nx]; if (v >= 0 && v < bd) { bd = v; g.dir = d; } } return; }
  const opts = Object.keys(DIRS).filter(d => d !== OPP[g.dir] && isPath(g.x + DIRS[d][0], g.y + DIRS[d][1]));
  if (!opts.length) { g.dir = OPP[g.dir]; return; }
  let tg = g.fr && !g.eyes ? null : target(g);
  if (!tg) { g.dir = opts[Math.floor(Math.random() * opts.length)]; return; }
  let bd = 1e9; for (const d of ['up', 'left', 'down', 'right']) { if (!opts.includes(d)) continue; const nx = g.x + DIRS[d][0], ny = g.y + DIRS[d][1], dd = (nx - tg[0]) ** 2 + (ny - tg[1]) ** 2; if (dd < bd) { bd = dd; g.dir = d; } }
}
function stepGhost(g, dt) {
  g.wanderT -= dt;
  if (g.mode === 'house') { g.py = 11 + Math.sin(performance.now() / 160 + g.i) * 0.25; if (g.release <= 0) g.mode = 'exit'; else g.release -= dt; return; }
  if (g.mode === 'exit') { const sp = 3.5 * dt; if (Math.abs(g.px - 9) > 0.05) g.px += Math.sign(9 - g.px) * Math.min(sp, Math.abs(9 - g.px)); else { g.px = 9; g.py -= sp; if (g.py <= 9) { g.mode = 'grid'; g.x = 9; g.y = 9; g.t = 0; g.dir = Math.random() < 0.5 ? 'left' : 'right'; } } return; }
  if (g.mode === 'enter') { g.py += 8 * dt; if (g.py >= 11) { g.py = 11; g.eyes = false; g.fr = false; g.mode = 'house'; g.release = 0.8; } return; }
  g.t += ghostSpeed(g) * dt;
  while (g.t >= 1 && g.mode === 'grid') { const [dx, dy] = DIRS[g.dir]; g.x = (g.x + dx + MW) % MW; g.y += dy; g.t -= 1; ghostArrive(g); }
}
const gpos = g => g.mode === 'grid' ? pos(g) : [g.px, g.py];
function collide() {
  const [hx, hy] = pos(hero);
  for (const g of ghosts) {
    if (g.eyes || g.mode === 'house') continue; const [gx, gy] = gpos(g);
    const dx = Math.min(Math.abs(hx - gx), MW - Math.abs(hx - gx)); if (dx * dx + (hy - gy) ** 2 > 0.45) continue;
    if (g.fr) {
      chainN++; const p = 200 * 2 ** Math.min(3, chainN - 1); addScore(p); g.eyes = true; g.fr = false; freeze = 0.45;
      const [sx, sy] = tc(gx, gy); FX.text(sx, sy, '+' + p, '#4dffd2', 24, 1); FX.burst(sx, sy, ['#b6c4ff', '#ffffff', g.c], 22, { speed: 260, life: 0.6, size: 4 }); FX.ring(sx, sy, '#ffffff', 4, L.s * 3, 0.4, 3);
      FX.shake(5); buzz(20); note(72 + chainN * 2, 0.22, 0.14); note(79 + chainN * 2, 0.22, 0.1);
    } else if (!g.eyes) { die(); return; }
  }
}
function die() {
  dying = 1.5; lives--; FX.shake(10); sfx.fail(); buzz([40, 40, 90]);
  const [hx, hy] = tc(...pos(hero)); FX.burst(hx, hy, ['#4dffd2', '#ffffff', '#b6fff0'], 30, { speed: 260, life: 0.9, size: 5, grav: 120 });
}
function afterDeath() {
  if (lives <= 0) return gameOver();
  placeActors(); ui.pop(lives === 1 ? 'LAST LIFE!' : `${lives} LIVES LEFT`, '#ff7ad9', 30, 40);
}
function gameOver() {
  if (state !== 'play') return; state = 'lost';
  if (!recorded) { recorded = true; F.endless(score); B.submit(score); }
  const nb = score > best && score > 0; best = Math.max(best, score); SAVE.set('best', best); SD.setBest(best);
  ui.lose(nb ? 'NEW BEST!' : 'CAUGHT!', `Score ${score.toLocaleString('en-US')} · Level ${level} · Best ${best.toLocaleString('en-US')}`);
}
function update(dt) {
  if (state !== 'play') return;
  if (clearT >= 0) { clearT += dt; flashMaze = Math.max(0, flashMaze - dt * 0.2); if (clearT > 1.8) buildLevel(level + 1); return; }
  if (dying > 0) { dying -= dt; if (dying <= 0) afterDeath(); return; }
  if (readyT > 0) { readyT -= dt; return; }
  if (freeze > 0) { freeze -= dt; return; }
  if (fright > 0) { fright -= dt; if (fright <= 0) for (const g of ghosts) g.fr = false; }
  else { modeT += dt; if (modeT >= MODES[modeI]) { modeT = 0; modeI++; for (const g of ghosts) if (g.mode === 'grid' && !g.eyes && g.t > 0) { g.x = (g.x + DIRS[g.dir][0] + MW) % MW; g.y += DIRS[g.dir][1]; g.dir = OPP[g.dir]; g.t = 1 - g.t; } } }
  if (fruit) { fruit.t -= dt; if (fruit.t <= 0) fruit = null; }
  chompT = Math.max(0, chompT - dt);
  const n = 3; for (let i = 0; i < n; i++) { stepHero(dt / n); for (const g of ghosts) stepGhost(g, dt / n); collide(); if (dying > 0 || freeze > 0 || clearT >= 0) break; }
}
let runT0 = 0;
ui.onTap(() => { reset(); state = 'play'; B.start(); runT0 = performance.now(); });

// ---------------------------------------------------------------- controls
const steer = d => { if (state === 'play') want = d; };
const dp = document.createElement('div'); dp.className = 'nb-dpad';
for (const [d, cls] of [['up', 'u'], ['left', 'l'], ['right', 'r'], ['down', 'd']]) {
  const b = document.createElement('button'); b.className = 'neo-btn ' + cls; b.innerHTML = ICON[d]; b.setAttribute('aria-label', d);
  b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); b.classList.add('on'); steer(d); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => b.classList.remove('on'));
  dp.appendChild(b);
}
document.body.appendChild(dp);
swiper(S.cv, { step: 18, onDir: steer });
keys({ 'ArrowUp|w|W': { press: () => steer('up') }, 'ArrowDown|s|S': { press: () => steer('down') }, 'ArrowLeft|a|A': { press: () => steer('left') }, 'ArrowRight|d|D': { press: () => steer('right') },
  ' |Enter': { press: () => { for (const k of ['start', 'lose']) { const c = ui.els[k]; if (!c.classList.contains('hc-hidden')) { c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return; } } } } });
const keyHint = document.createElement('div'); keyHint.className = 'neo-keys'; keyHint.innerHTML = '<kbd>←</kbd><kbd>↑</kbd><kbd>↓</kbd><kbd>→</kbd> or <kbd>WASD</kbd> to steer'; document.body.appendChild(keyHint);

// ---------------------------------------------------------------- drawing
const L = { s: 18, mx: 0, my: 0 };
S.onResize = (w, h) => {
  const t = touchy(); dp.classList.toggle('hide', !t); keyHint.style.display = t ? 'none' : 'block';
  const top = 68, bottom = t ? 196 : 44;
  L.s = Math.floor(Math.min((w - 14) / MW, (h - top - bottom) / MH)); L.mx = Math.round((w - L.s * MW) / 2); L.my = Math.round(top + (h - top - bottom - L.s * MH) / 2); mazeCache = null;
};
function renderMaze(col) {
  const s = L.s, c = document.createElement('canvas'); c.width = Math.ceil(MW * s * S.dpr); c.height = Math.ceil(MH * s * S.dpr);
  const x = c.getContext('2d'); x.scale(S.dpr, S.dpr); x.lineCap = 'round'; x.lineJoin = 'round';
  const wall = (tx, ty) => tx >= 0 && ty >= 0 && tx < MW && ty < MH && T[ty][tx] === 0 && !(ty === TUN && (tx === 0 || tx === MW - 1));
  const segs = [];
  for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) if (wall(tx, ty)) {
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].some(([dx, dy]) => { const v = T[ty + dy] && T[ty + dy][tx + dx]; return v === 1 || v === 2; });
    if (!near) continue;
    let any = false;
    if (wall(tx + 1, ty)) { segs.push([tx, ty, tx + 1, ty]); any = true; } if (wall(tx, ty + 1)) { segs.push([tx, ty, tx, ty + 1]); any = true; }
    if (!any && !wall(tx - 1, ty) && !wall(tx, ty - 1)) segs.push([tx, ty, tx, ty]);
  }
  const path = () => { x.beginPath(); for (const [a, b, cc, d] of segs) { x.moveTo((a + 0.5) * s, (b + 0.5) * s); x.lineTo((cc + 0.5) * s + (a === cc && b === d ? 0.01 : 0), (d + 0.5) * s); } };
  x.shadowColor = col; x.shadowBlur = s * 0.6; x.strokeStyle = col; x.lineWidth = s * 0.62; path(); x.stroke(); x.shadowBlur = 0;
  x.strokeStyle = '#11103a'; x.lineWidth = s * 0.62 - 4; path(); x.stroke();
  x.strokeStyle = 'rgba(255,255,255,.08)'; x.lineWidth = s * 0.12; path(); x.stroke();
  // door
  x.fillStyle = '#ff7ad9'; x.fillRect((DOOR[0] - 0.4) * s, (DOOR[1] + 0.35) * s, s * 1.8 - s, s * 0.22);
  return c;
}
const MAZE_COLS = ['#5b7bff', '#b45bff', '#3dd6ff', '#ff5fa8', '#4dffb0', '#ffb43d'];
function drawCritter(x, y, s, g, t, dir) {
  const r = s * 0.48, fr = g.fr && !g.eyes, blink = fr && fright < 2 && Math.sin(t * 22) > 0, body = fr ? (blink ? '#f2f2ff' : '#6d72ff') : g.c;
  const [ex, ey] = DIRS[dir || 'left'];
  ctx.save(); ctx.translate(x, y);
  if (!g.eyes) {
    ctx.shadowColor = body; ctx.shadowBlur = s * 0.6; ctx.fillStyle = body; ctx.beginPath();
    const wob = Math.sin(t * 9 + g.i) * s * 0.04;
    if (g.i === 0) { rr(ctx, -r, -r * 0.9 + wob, r * 2, r * 1.85, r * 0.45); ctx.fill(); ctx.beginPath(); ctx.moveTo(-r * 0.75, -r * 0.7); ctx.lineTo(-r * 0.95, -r * 1.25); ctx.lineTo(-r * 0.35, -r * 0.85); ctx.moveTo(r * 0.75, -r * 0.7); ctx.lineTo(r * 0.95, -r * 1.25); ctx.lineTo(r * 0.35, -r * 0.85); ctx.fill(); }
    else if (g.i === 1) { ctx.moveTo(0, -r * 1.25 + wob); ctx.bezierCurveTo(r * 0.9, -r * 0.4, r * 1.05, r * 0.95, 0, r * 0.95); ctx.bezierCurveTo(-r * 1.05, r * 0.95, -r * 0.9, -r * 0.4, 0, -r * 1.25 + wob); ctx.fill(); }
    else if (g.i === 2) { ctx.arc(0, 0, r * 0.95, Math.PI, 0); ctx.lineTo(r * 0.95, r * 0.2); ctx.lineTo(-r * 0.95, r * 0.2); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0; ctx.strokeStyle = body; ctx.lineWidth = s * 0.11; ctx.lineCap = 'round';
      for (let k = 0; k < 4; k++) { const tx = -r * 0.66 + k * r * 0.44; ctx.beginPath(); ctx.moveTo(tx, r * 0.15); ctx.quadraticCurveTo(tx + Math.sin(t * 10 + k) * r * 0.3, r * 0.6, tx + Math.sin(t * 10 + k + 1) * r * 0.2, r * 1.0); ctx.stroke(); } }
    else { for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2 + t * 0.8, rad = k % 2 ? r * 0.82 : r * 1.08; ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); } ctx.closePath(); ctx.fill(); }
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.ellipse(-r * 0.35, -r * 0.45, r * 0.22, r * 0.12, -0.5, 0, 7); ctx.fill();
  }
  // eyes
  const eyes = g.i === 1 && !g.eyes ? [[0, -r * 0.15, 1.45]] : [[-r * 0.36, -r * 0.12, 1], [r * 0.36, -r * 0.12, 1]];
  for (const [px, py, k] of eyes) {
    ctx.fillStyle = fr ? '#ffffff' : '#ffffff'; ctx.beginPath(); ctx.ellipse(px, py, r * 0.27 * k, r * 0.32 * k, 0, 0, 7); ctx.fill();
    if (fr) { ctx.fillStyle = '#2a2a7a'; ctx.beginPath(); ctx.arc(px, py, r * 0.1 * k, 0, 7); ctx.fill(); }
    else { ctx.fillStyle = '#16133a'; ctx.beginPath(); ctx.arc(px + ex * r * 0.12 * k, py + ey * r * 0.14 * k, r * 0.14 * k, 0, 7); ctx.fill(); }
  }
  if (!g.eyes && g.i === 0 && !fr) { ctx.strokeStyle = '#16133a'; ctx.lineWidth = s * 0.08; ctx.beginPath(); ctx.moveTo(-r * 0.62, -r * 0.5); ctx.lineTo(-r * 0.15, -r * 0.32); ctx.moveTo(r * 0.62, -r * 0.5); ctx.lineTo(r * 0.15, -r * 0.32); ctx.stroke(); }
  if (fr) { ctx.strokeStyle = blink ? '#6d72ff' : '#f2f2ff'; ctx.lineWidth = s * 0.07; ctx.beginPath(); for (let k = 0; k <= 6; k++) ctx.lineTo(-r * 0.5 + k * r / 6, r * 0.42 + (k % 2 ? -1 : 1) * r * 0.09); ctx.stroke(); }
  ctx.restore();
}
function drawNib(x, y, s, dir, mouth, t, scale = 1, alpha = 1) {
  const r = s * 0.5 * scale, [dx, dy] = DIRS[dir], px = -dy, py = dx;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y);
  const sq = 1 + Math.sin(mouth) * 0.04;
  ctx.shadowColor = '#4dffd2'; ctx.shadowBlur = s * 0.7; ctx.fillStyle = '#4dffd2';
  for (const e of [-1, 1]) { ctx.beginPath(); ctx.ellipse(e * r * 0.55, -r * 0.8, r * 0.28, r * 0.36, e * 0.35, 0, 7); ctx.fill(); }
  ctx.beginPath(); ctx.ellipse(0, 0, r * sq, r / sq, 0, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
  ctx.fillStyle = '#ff9ec8'; for (const e of [-1, 1]) { ctx.beginPath(); ctx.ellipse(e * r * 0.55, -r * 0.8, r * 0.13, r * 0.19, e * 0.35, 0, 7); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-r * 0.35, -r * 0.4, r * 0.25, r * 0.13, -0.5, 0, 7); ctx.fill();
  // face looks where it goes
  const fx0 = dx * r * 0.28, fy0 = dy * r * 0.22 + r * 0.02;
  for (const e of [-1, 1]) { const ex = fx0 + (dy ? e * r * 0.32 : e * r * 0.3 + dx * r * 0.08), ey = fy0 - r * 0.18; ctx.fillStyle = '#0d2b26'; ctx.beginPath(); ctx.ellipse(ex, ey, r * 0.11, r * 0.15, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + r * 0.04, ey - r * 0.05, r * 0.045, 0, 7); ctx.fill(); }
  const open = Math.abs(Math.sin(mouth)) * 0.9 + 0.1;
  ctx.fillStyle = '#0d2b26'; ctx.beginPath(); ctx.ellipse(fx0, fy0 + r * 0.28, r * 0.3, r * 0.2 * open + 0.5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.fillRect(fx0 - r * 0.12, fy0 + r * 0.28 - r * 0.2 * open, r * 0.1, r * 0.1 * Math.max(0.3, open)); ctx.fillRect(fx0 + r * 0.02, fy0 + r * 0.28 - r * 0.2 * open, r * 0.1, r * 0.1 * Math.max(0.3, open));
  ctx.restore();
}
function draw(t) {
  S.begin(); const s = L.s, [sx, sy] = FX.offset(); ctx.save(); ctx.translate(sx, sy);
  const mc = MAZE_COLS[(level - 1) % MAZE_COLS.length];
  if (!mazeCache) mazeCache = renderMaze(mc);
  ctx.save(); rr(ctx, L.mx - 4, L.my - 4, MW * s + 8, MH * s + 8, 14); ctx.fillStyle = 'rgba(6,6,24,.65)'; ctx.fill(); ctx.restore();
  if (clearT >= 0) ctx.globalAlpha = 0.45 + 0.55 * (Math.sin(t * 18) > 0 ? 1 : 0);
  ctx.drawImage(mazeCache, L.mx, L.my, MW * s, MH * s); ctx.globalAlpha = 1;
  // crumbs + pellets
  ctx.fillStyle = '#ffd9b0'; ctx.beginPath(); const dr = Math.max(1.6, s * 0.1);
  for (const k of dots) { const x = L.mx + (k % MW + 0.5) * s, y = L.my + (((k / MW) | 0) + 0.5) * s; ctx.moveTo(x + dr, y); ctx.arc(x, y, dr, 0, 7); }
  ctx.fill();
  for (const k of pellets) { const x = k % MW, y = (k / MW) | 0, p = 0.75 + 0.25 * Math.sin(t * 7); ctx.save(); ctx.shadowColor = '#fff4c2'; ctx.shadowBlur = s * 0.9; ctx.fillStyle = '#fff4c2'; ctx.beginPath(); ctx.arc(L.mx + (x + 0.5) * s, L.my + (y + 0.5) * s, s * 0.32 * p, 0, 7); ctx.fill(); ctx.restore(); }
  if (fruit) { const [x, y] = tc(fruit.x, fruit.y); ctx.save(); ctx.translate(x, y + Math.sin(t * 4) * 2); ctx.shadowColor = '#ff5f7e'; ctx.shadowBlur = 14; ctx.fillStyle = '#ff5f7e'; ctx.beginPath(); ctx.moveTo(0, -s * 0.42); ctx.lineTo(s * 0.38, -s * 0.05); ctx.lineTo(0, s * 0.42); ctx.lineTo(-s * 0.38, -s * 0.05); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.moveTo(0, -s * 0.3); ctx.lineTo(s * 0.16, -s * 0.05); ctx.lineTo(0, s * 0.05); ctx.lineTo(-s * 0.16, -s * 0.05); ctx.fill(); ctx.restore(); }
  // actors
  ctx.save(); rr(ctx, L.mx, L.my, MW * s, MH * s, 10); ctx.clip();
  if (state !== 'ready' || true) for (const g of ghosts) { if (dying > 0 && dying < 1.1) continue; const [gx, gy] = gpos(g); drawCritter(...tc(gx, gy), s, g, t, g.mode === 'grid' ? g.dir : 'up'); }
  { const [hx, hy] = pos(hero), [x, y] = tc(hx, hy);
    if (dying > 0) { const k = Math.min(1, (1.5 - dying) / 1.1); drawNib(x, y, s, hero.dir, 0, t, 1 + k * 0.3, 1 - k); }
    else drawNib(x, y, s, hero.dir, hero.moving && state === 'play' && readyT <= 0 ? hero.mouth : 1.2, t); }
  ctx.restore();
  if (state === 'play' && readyT > 0 && dying <= 0) { ctx.font = `800 ${Math.round(s * 1.1)}px 'Baloo 2',system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffd84d'; ctx.shadowColor = '#ffd84d'; ctx.shadowBlur = 12; ctx.fillText('READY!', ...tc(9, 13)); ctx.shadowBlur = 0; }
  // footer: lives + level
  const fy = L.my + MH * s + 14;
  for (let i = 0; i < Math.max(0, lives - (state === 'play' && dying <= 0 ? 1 : 0)); i++) drawNib(L.mx + 12 + i * 26, fy, 18, 'right', 1.2, t, 0.85);
  ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = "800 13px 'Baloo 2',system-ui"; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText('LEVEL ' + level, L.mx + MW * s - 4, fy);
  if (fright > 0 && state === 'play') { const w = 90; ctx.fillStyle = 'rgba(255,255,255,.12)'; rr(ctx, S.w / 2 - w / 2, fy - 4, w, 8, 4); ctx.fill(); ctx.fillStyle = fright < 2 ? '#f2f2ff' : '#6d72ff'; rr(ctx, S.w / 2 - w / 2, fy - 4, w * fright / frightMax, 8, 4); ctx.fill(); }
  FX.draw(ctx); ctx.restore(); FX.drawFlash(ctx, S.w, S.h);
}
S.fit();

// start card: meet the cast
{
  const cast = document.createElement('div'); cast.className = 'nb-cast';
  GH.forEach((g, i) => {
    const d = document.createElement('div'), c = document.createElement('canvas'); c.width = c.height = 80; d.appendChild(c);
    d.insertAdjacentHTML('beforeend', `<span style="color:${g.c}">${g.name}</span><small>${g.blurb}</small>`); cast.appendChild(d);
    const real = ctx; ctx = c.getContext('2d'); try { drawCritter(40, 44, 62, { ...g, i, fr: false, eyes: false }, 0.3 * i, 'down'); } finally { ctx = real; }
  });
  ui.els.start.querySelector('.neo-best').after(cast);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!paused()) update(dt);
  FX.update(dt); H.stats([['BEST', Math.max(best, score).toLocaleString('en-US')]]); draw(now / 1000);
  requestAnimationFrame(frame);
}
reset(); requestAnimationFrame(frame);

// ---------------------------------------------------------------- test hooks + bot (BFS to food, keeps away from chasers)
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; }, get lives() { return lives; }, get dots() { return dots.size + pellets.size; },
  get dbg() { return { h: [hero.x, hero.y, hero.dir, hero.moving, +hero.t.toFixed(2)], want, fright: +fright.toFixed(1), dying, readyT: +readyT.toFixed(1), freeze, clearT, g: ghosts.map(g => [g.x, g.y, g.mode, g.fr ? 'F' : '', g.eyes ? 'E' : '']) }; },
  bot() {
    if (state !== 'play' || dying > 0) return;
    const danger = new Set(), el = (performance.now() - runT0) / 1000, rad = el < 5 ? 2 : el < 8 ? 1 : -1;
    for (const g of ghosts) if (!g.fr && !g.eyes && g.mode === 'grid' && rad >= 0) { for (let dx = -rad; dx <= rad; dx++) for (let dy = -rad; dy <= rad; dy++) if (Math.abs(dx) + Math.abs(dy) <= rad) danger.add(key((g.x + dx + MW) % MW, g.y + dy)); const [ax, ay] = DIRS[g.dir]; danger.add(key((g.x + ax * 3 + MW) % MW, g.y + ay * 3)); }
    const reckless = el > 6 && fright <= 0;   // QA only: late in a test run the bot stops dodging so runs finish
    const chase = reckless ? ghosts.filter(g => g.mode === 'grid' && !g.eyes).map(g => key(g.x, g.y)) : fright > 1.5 && el < 6 ? ghosts.filter(g => g.fr && g.mode === 'grid').map(g => key(g.x, g.y)) : [];
    const hd = DIRS[hero.dir], ahead = hero.moving && hero.t > 0.05, ox = ahead ? (hero.x + hd[0] + MW) % MW : hero.x, oy = ahead ? hero.y + hd[1] : hero.y;
    const start = key(ox, oy), prev = new Map([[start, null]]), Q = [start]; let goal = null;
    while (Q.length) {
      const k = Q.shift(), x = k % MW, y = (k / MW) | 0;
      if (k !== start && (chase.includes(k) || (!chase.length && (dots.has(k) || pellets.has(k))))) { goal = k; break; }
      for (const [d, [dx, dy]] of Object.entries(DIRS)) { const nx = (x + dx + MW) % MW, ny = y + dy; if (!isPath(nx, ny)) continue; const nk = key(nx, ny); if (prev.has(nk) || danger.has(nk)) continue; prev.set(nk, k); Q.push(nk); }
    }
    if (goal !== null) { let k = goal; while (prev.get(k) !== start && prev.get(k) !== null) k = prev.get(k); const nx = k % MW, ny = (k / MW) | 0; for (const [d, [dx, dy]] of Object.entries(DIRS)) if ((ox + dx + MW) % MW === nx && oy + dy === ny) { want = d; return; } }
    // boxed in: step to the neighbour farthest from the nearest chaser
    let bd = -1; for (const [d, [dx, dy]] of Object.entries(DIRS)) { const nx = (hero.x + dx + MW) % MW, ny = hero.y + dy; if (!isPath(nx, ny)) continue; const m = Math.min(...ghosts.filter(g => !g.fr).map(g => Math.abs(g.x - nx) + Math.abs(g.y - ny)), 99); if (m > bd) { bd = m; want = d; } }
  },
};
