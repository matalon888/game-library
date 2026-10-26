// Bumperlark — one pinball table: two flippers, three pop bumpers, slingshots, three top lanes that raise the
// multiplier, a drop-target bank and a left orbit. Three balls; best score counts.
// Phone: tap/hold the left or right half for each flipper; hold and release to launch. Desktop: Z / M (or ← / →), Space launches.
import { createUI, store, buzz, sfx, tone, note } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { css, arcadeCards, startCard, canvas2d, particles, shaker } from './arc.js';

const NAME = 'Bumperlark: Pinball Table';
const S = store('bumperlark');
let best = S.get('best', 0);
const F = flow('bumperlark', { par: 60000, warmup: 15000 });

const ui = createUI({ title: 'BUMPERLARK', hint: 'Tap left / right to flip', hand: '👆', progress: false, score: false });
arcadeCards({ accent: '#ff5fa2', glass: 'rgba(20,8,40,.5)', glass2: 'rgba(20,8,40,.86)' });
const D = daily('bumperlark', ui, { name: NAME });
startCard(ui, D, { kicker: 'Pinball table', dailyBtn: false, keys: 'Z / M or ← / → flippers · Space launches' });
const B = board({ game: 'bumperlark', label: 'Points', limits: { maxRun: 1000000, maxPerSec: 4000 }, corner: 'tl' });
css(`body{background:#140a2c}`);

// ---------------------------------------------------------------- geometry (logical units, y down)
const TW = 400, TH = 760, HEAD = 70, BR = 9;
const segs = [], posts = [];
const seg = (x1, y1, x2, y2, o = {}) => segs.push({ x1, y1, x2, y2, e: 0.45, t: 0, ...o });
const poly = (pts, o) => { for (let i = 0; i < pts.length - 1; i++) seg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], o); };
const arc = (cx, cy, r, a0, a1, n) => { const p = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return p; };
// outer shell + top arc
poly([[10, TH + 40], [10, 200]]);
poly(arc(200, 200, 190, Math.PI, Math.PI * 2, 48));
poly([[390, 200], [390, TH + 40]]);
// plunger lane
poly([[360, TH + 40], [360, 236]]);
const gate = { x1: 360, y1: 236, x2: 390, y2: 206, e: 0.3, t: 0, gate: true }; segs.push(gate);
// left orbit: inner wall + mouth, one-way gate at the top
const orbitInner = [[88, 468], [60, 440], [60, 200], ...arc(200, 200, 140, Math.PI, Math.PI * 1.25, 10).slice(1)];
poly(orbitInner);
const ogate = { x1: orbitInner[orbitInner.length - 1][0], y1: orbitInner[orbitInner.length - 1][1], x2: 200 + Math.cos(Math.PI * 1.25) * 190, y2: 200 + Math.sin(Math.PI * 1.25) * 190, e: 0.4, t: 0, oneway: [-Math.SQRT1_2, Math.SQRT1_2] };
segs.push(ogate);
seg(10, 452, 44, 482, { e: 0.6 });
// inlane guides
poly([[52, 522], [52, 602], [116, 652]]); posts.push({ x: 52, y: 522, r: 4, e: 0.5 });
poly([[318, 522], [318, 602], [254, 652]]); posts.push({ x: 318, y: 522, r: 4, e: 0.5 });
// slingshots (kicker face = first edge)
const slings = [
  { a: [80, 532], b: [114, 618], c: [80, 598], flash: 0 },
  { a: [290, 532], b: [256, 618], c: [290, 598], flash: 0 },
];
for (const s of slings) { s.face = { x1: s.a[0], y1: s.a[1], x2: s.b[0], y2: s.b[1], e: 0.5, t: 0, sling: s }; segs.push(s.face); seg(...s.b, ...s.c); seg(...s.c, ...s.a); }
// top lanes
const laneX = [118, 162, 208, 252];
for (const x of laneX) { seg(x, 98, x, 132, { e: 0.3 }); posts.push({ x, y: 98, r: 3, e: 0.3 }); }
const lanes = [0, 1, 2].map(i => ({ x0: laneX[i], x1: laneX[i + 1], lit: false, cd: 0 }));
// pop bumpers
const bumpers = [{ x: 140, y: 252 }, { x: 236, y: 252 }, { x: 188, y: 330 }].map(b => ({ ...b, r: 23, flash: 0 }));
// drop targets
const drops = [292, 328, 364].map(y => ({ x: 344, y, h: 15, down: false, t: 0 }));
// flippers
const FL = 60;
const flips = [
  { px: 116, py: 655, rest: 0.5, up: -0.46, a: 0.5, w: 0, on: false, side: -1 },
  { px: 254, py: 655, rest: Math.PI - 0.5, up: Math.PI + 0.46, a: Math.PI - 0.5, w: 0, on: false, side: 1 },
];

// ---------------------------------------------------------------- canvas + layout
const V = canvas2d(), g = V.g, P = particles(), SH = shaker();
let sc = 1, ox = 0, oy = 0, art = null;
function layout() {
  sc = Math.min(V.W / TW, (V.H - 8) / (TH + HEAD)); ox = (V.W - TW * sc) / 2; oy = Math.max(0, (V.H - (TH + HEAD) * sc) / 2) + HEAD * sc;
  art = document.createElement('canvas'); art.width = Math.round(TW * sc * V.dpr); art.height = Math.round(TH * sc * V.dpr);
  const t = art.getContext('2d'); t.scale(sc * V.dpr, sc * V.dpr); paintArt(t);
}
V.onResize = () => layout();

function paintArt(t) {
  // playfield
  const bg = t.createLinearGradient(0, 0, 0, TH); bg.addColorStop(0, '#2a1260'); bg.addColorStop(0.5, '#3d1673'); bg.addColorStop(1, '#1b0b3d');
  t.save(); t.beginPath(); t.moveTo(10, TH); t.lineTo(10, 200); t.arc(200, 200, 190, Math.PI, 0); t.lineTo(390, TH); t.closePath(); t.fillStyle = bg; t.fill(); t.clip();
  // soft spotlights + sunburst
  for (const [x, y, r, c] of [[188, 300, 260, 'rgba(255,95,162,.20)'], [80, 600, 180, 'rgba(90,200,255,.12)'], [300, 600, 180, 'rgba(255,200,90,.10)']]) { const rg = t.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, c); rg.addColorStop(1, 'rgba(0,0,0,0)'); t.fillStyle = rg; t.fillRect(0, 0, TW, TH); }
  t.globalAlpha = 0.07; t.fillStyle = '#ffd6f0';
  for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; t.beginPath(); t.moveTo(188, 300); t.arc(188, 300, 420, a, a + 0.09); t.closePath(); t.fill(); }
  t.globalAlpha = 1;
  // the lark: an original little songbird emblem under the bumpers
  t.save(); t.translate(188, 450); t.globalAlpha = 0.28;
  t.fillStyle = '#ffb3d6'; t.beginPath(); t.ellipse(0, 0, 34, 24, -0.2, 0, 7); t.fill();
  t.beginPath(); t.arc(26, -18, 14, 0, 7); t.fill();
  t.fillStyle = '#ffd166'; t.beginPath(); t.moveTo(38, -20); t.lineTo(52, -16); t.lineTo(38, -12); t.fill();
  t.fillStyle = '#ff5fa2'; t.beginPath(); t.moveTo(-10, -6); t.quadraticCurveTo(-40, -40, -60, -20); t.quadraticCurveTo(-36, -10, -10, 4); t.fill();
  t.beginPath(); t.moveTo(-30, 8); t.lineTo(-62, 20); t.lineTo(-56, 6); t.fill();
  t.fillStyle = '#2a1260'; t.beginPath(); t.arc(30, -21, 2.6, 0, 7); t.fill();
  t.restore();
  t.font = '800 15px "Baloo 2",system-ui'; t.textAlign = 'center'; t.fillStyle = 'rgba(255,214,240,.35)'; t.fillText('BUMPERLARK', 188, 500);
  // orbit channel floor
  t.fillStyle = 'rgba(0,0,0,.18)'; t.beginPath(); t.moveTo(10, 470); t.lineTo(10, 200); t.arc(200, 200, 190, Math.PI, Math.PI * 1.25); t.lineTo(orbitInner[orbitInner.length - 1][0], orbitInner[orbitInner.length - 1][1]); t.arc(200, 200, 140, Math.PI * 1.25, Math.PI, true); t.lineTo(60, 440); t.closePath(); t.fill();
  // plunger lane floor
  t.fillStyle = 'rgba(0,0,0,.25)'; t.fillRect(360, 236, 30, TH);
  // drain apron
  const ap = t.createLinearGradient(0, 640, 0, TH); ap.addColorStop(0, 'rgba(0,0,0,0)'); ap.addColorStop(1, 'rgba(0,0,0,.45)'); t.fillStyle = ap; t.fillRect(10, 640, 350, 120);
  t.restore();
  // rails
  t.lineCap = 'round'; t.lineJoin = 'round';
  const railPath = () => { t.beginPath(); for (const s of segs) { if (s.gate || s.oneway || s.sling) continue; t.moveTo(s.x1, s.y1); t.lineTo(s.x2, s.y2); } };
  t.strokeStyle = 'rgba(0,0,0,.45)'; t.lineWidth = 9; t.save(); t.translate(2, 3); railPath(); t.stroke(); t.restore();
  t.strokeStyle = '#b9a6e8'; t.lineWidth = 7; railPath(); t.stroke();
  t.strokeStyle = '#efe6ff'; t.lineWidth = 2.5; railPath(); t.stroke();
  for (const p of posts) { t.fillStyle = '#ffd166'; t.beginPath(); t.arc(p.x, p.y, p.r + 2.5, 0, 7); t.fill(); }
  // lane guide arrows (inserts painted dark; lit versions drawn live)
  for (const L of lanes) { t.fillStyle = 'rgba(0,0,0,.35)'; t.beginPath(); t.arc((L.x0 + L.x1) / 2, 150, 8, 0, 7); t.fill(); }
  arrow(t, 34, 380, -Math.PI / 2, 'rgba(0,0,0,.35)'); arrow(t, 318, 400, 0, 'rgba(0,0,0,.35)');
  for (let i = 0; i < 4; i++) { t.fillStyle = 'rgba(0,0,0,.35)'; t.beginPath(); t.arc(140 + i * 32, 560, 11, 0, 7); t.fill(); }
}
function arrow(t, x, y, a, col) { t.save(); t.translate(x, y); t.rotate(a); t.fillStyle = col; t.beginPath(); t.moveTo(14, 0); t.lineTo(-8, -11); t.lineTo(-3, 0); t.lineTo(-8, 11); t.closePath(); t.fill(); t.restore(); }
layout();

// ---------------------------------------------------------------- state
let state = 'ready', score = 0, ballN = 1, mult = 1, recorded = false, beatenShown = false, t0 = 0, clock = 0;
let ball = null, saveT = 0, plunge = 0, plungeHeld = false, orbitArm = 0, orbits = 0, extraGiven = false, extra = 0, stuckT = 0, drainT = 0, msg = '', msgT = 0, tilt = 0;
const press = { L: new Set(), R: new Set() }, keyL = { v: false }, keyR = { v: false }, keyP = { v: false };
const bot = { until: 0, plungeAt: 0 };

function newBall() { ball = { x: 375, y: 735, vx: 0, vy: 0, inLane: true, trail: [] }; plunge = 0; saveT = 0; }
function reset() {
  score = 0; ballN = 1; mult = 1; recorded = false; beatenShown = false; orbits = 0; extraGiven = false; extra = 0; orbitArm = 0;
  for (const L of lanes) L.lit = false; for (const d of drops) d.down = false;
  newBall(); P.clear(); dmd('BALL 1');
}
function addScore(n, x, y, col = '#fff') {
  const v = n * mult; score += v;
  if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); confettiAt(V.W / 2, V.H * 0.3); }
  return v;
}
function confettiAt(x, y) { P.burst(x, y, ['#ff5d8f', '#ffd23f', '#3ab795', '#3a86ff', '#7b5cff', '#fff'], 70, { speed: 420, size: 5, g: 380, kind: 'conf', life: 1.8 }); }
function dmd(text, secs = 1.6) { msg = text; msgT = secs; }

// ---------------------------------------------------------------- input
const flipOn = (f, on) => {
  if (on && !f.on) { tone(180, 0.04, 'square', 0.05, 0.6); buzz(6); if (lanes.some(l => l.lit) && lanes.some(l => !l.lit)) rotateLanes(f.side); }
  f.on = on;
};
function rotateLanes(dir) { const v = lanes.map(l => l.lit); for (let i = 0; i < 3; i++) lanes[i].lit = v[(i - dir + 3) % 3]; }
const toTX = cx => (cx - ox) / sc;
addEventListener('pointerdown', e => {
  if (state !== 'play') return;
  (toTX(e.clientX) < 185 ? press.L : press.R).add(e.pointerId);
  if (ball && ball.inLane) plungeHeld = true;
});
const pup = e => { press.L.delete(e.pointerId); press.R.delete(e.pointerId); if (!press.L.size && !press.R.size && plungeHeld) release(); };
addEventListener('pointerup', pup); addEventListener('pointercancel', pup);
addEventListener('keydown', e => {
  if (state !== 'play' || e.repeat) return;
  if (['KeyZ', 'ArrowLeft', 'ShiftLeft', 'KeyA'].includes(e.code)) keyL.v = true;
  if (['KeyM', 'ArrowRight', 'ShiftRight', 'Slash', 'KeyL'].includes(e.code)) keyR.v = true;
  if (['Space', 'ArrowDown', 'Enter'].includes(e.code) && ball && ball.inLane) { plungeHeld = true; e.preventDefault(); }
});
addEventListener('keyup', e => {
  if (['KeyZ', 'ArrowLeft', 'ShiftLeft', 'KeyA'].includes(e.code)) keyL.v = false;
  if (['KeyM', 'ArrowRight', 'ShiftRight', 'Slash', 'KeyL'].includes(e.code)) keyR.v = false;
  if (['Space', 'ArrowDown', 'Enter'].includes(e.code) && plungeHeld) release();
});
function release() {
  plungeHeld = false;
  if (!ball || !ball.inLane || ball.y < 700) { plunge = 0; return; }
  const pw = plunge < 0.2 ? 0.8 : plunge;
  ball.vy = -(1000 + 900 * pw); plunge = 0; saveT = Math.max(saveT, 8 / F.k(score));
  tone(120, 0.18, 'sawtooth', 0.1, 2.4); buzz(20);
}
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on ball 1, until the first real touch,
// the plunger launches and the flippers flick by themselves for about 4.5 s (the bot's own timing, under ball save)
const DM = demo(null, { ready: () => state === 'play' && ballN === 1 && score < 2000 && !D.seed, wait: 1500, ms: 4500 });
ui.onTap(w => { if (w !== 'start') reset(); state = 'play'; t0 = performance.now(); B.start(); press.L.clear(); press.R.clear(); });

// ---------------------------------------------------------------- physics
function collideSeg(s, r) {
  const dx = s.x2 - s.x1, dy = s.y2 - s.y1, L2 = dx * dx + dy * dy;
  let u = ((ball.x - s.x1) * dx + (ball.y - s.y1) * dy) / L2; u = u < 0 ? 0 : u > 1 ? 1 : u;
  const qx = s.x1 + dx * u, qy = s.y1 + dy * u, ex = ball.x - qx, ey = ball.y - qy, d2 = ex * ex + ey * ey, R = r + s.t;
  if (d2 >= R * R) return false;
  const d = Math.sqrt(d2) || 1e-4, nx = ex / d, ny = ey / d;
  if (s.oneway && (ball.vx * s.oneway[0] + ball.vy * s.oneway[1]) <= 0) return false;
  ball.x = qx + nx * R; ball.y = qy + ny * R;
  const vn = ball.vx * nx + ball.vy * ny;
  if (vn < 0) {
    ball.vx -= (1 + s.e) * vn * nx; ball.vy -= (1 + s.e) * vn * ny;
    if (s.sling && -vn > 60) kickSling(s.sling, nx, ny);
    else if (-vn > 250) tone(700 + Math.random() * 300, 0.02, 'square', Math.min(0.04, -vn / 30000), 0.5);
  }
  return true;
}
function kickSling(sl, nx, ny) {
  ball.vx += nx * 620; ball.vy += ny * 620; sl.flash = 1;
  const v = addScore(10); tone(520, 0.06, 'square', 0.08, 1.4); buzz(10); SH.kick(2);
  P.burst(ball.x, ball.y, ['#7af0ff', '#fff'], 8, { speed: 200, size: 2, kind: 'spark', life: 0.3 });
}
function collideCircle(c, r, kick) {
  const dx = ball.x - c.x, dy = ball.y - c.y, d = Math.hypot(dx, dy), R = r + c.r;
  if (d >= R || d < 1e-4) return false;
  const nx = dx / d, ny = dy / d; ball.x = c.x + nx * R; ball.y = c.y + ny * R;
  const vn = ball.vx * nx + ball.vy * ny;
  if (kick) { const out = Math.max(560, -vn * 0.6 + 480); ball.vx = ball.vx - vn * nx + nx * out; ball.vy = ball.vy - vn * ny + ny * out; return true; }
  if (vn < 0) { ball.vx -= (1 + c.e) * vn * nx; ball.vy -= (1 + c.e) * vn * ny; }
  return true;
}
function flipper(f, h) {
  const target = f.on ? f.up : f.rest, dir = Math.sign(target - f.a);
  const sp = f.on ? 24 : 13;
  if (Math.abs(target - f.a) < sp * h) { f.w = 0; f.a = target; } else { f.w = dir * sp; f.a += f.w * h; }
  const tx = f.px + Math.cos(f.a) * FL, ty = f.py + Math.sin(f.a) * FL;
  const dx = tx - f.px, dy = ty - f.py;
  let u = ((ball.x - f.px) * dx + (ball.y - f.py) * dy) / (FL * FL); u = u < 0 ? 0 : u > 1 ? 1 : u;
  const thick = 8.5 - 4 * u, qx = f.px + dx * u, qy = f.py + dy * u, ex = ball.x - qx, ey = ball.y - qy, d = Math.hypot(ex, ey), R = BR + thick;
  if (d >= R) return;
  const nx = ex / (d || 1e-4), ny = ey / (d || 1e-4);
  ball.x = qx + nx * R; ball.y = qy + ny * R;
  const cx = ball.x - nx * BR - f.px, cy = ball.y - ny * BR - f.py;
  const svx = -f.w * cy, svy = f.w * cx;   // surface velocity at the contact
  const rvx = ball.vx - svx, rvy = ball.vy - svy, vn = rvx * nx + rvy * ny;
  if (vn < 0) {
    ball.vx -= (1 + 0.28) * vn * nx; ball.vy -= (1 + 0.28) * vn * ny;
    if (f.w !== 0 && -vn > 300) { tone(240, 0.05, 'triangle', 0.08, 0.7); buzz(8); }
  }
}
function step(h) {
  const grav = 1150 * Math.min(1.12, F.k(score));
  ball.vy += grav * h;
  const sp = Math.hypot(ball.vx, ball.vy), mx = 2300; if (sp > mx) { ball.vx *= mx / sp; ball.vy *= mx / sp; }
  ball.x += ball.vx * h; ball.y += ball.vy * h;
  for (const f of flips) flipper(f, h);
  // plunger floor
  if (ball.inLane) {
    const floorY = 745 + plunge * 22 - BR;
    if (ball.x > 360 && ball.y > floorY) { ball.y = floorY; if (ball.vy > 0) ball.vy = -ball.vy * 0.2; ball.vx = 0; ball.x = 375; }
    if (ball.y < 190) ball.inLane = false;
  }
  for (const s of segs) { if (s.gate && ball.inLane) continue; collideSeg(s, BR); }
  for (const p of posts) collideCircle(p, BR, false);
  for (const b of bumpers) if (collideCircle(b, BR, true)) hitBumper(b);
  for (const d of drops) if (!d.down && Math.abs(ball.y - d.y) < d.h + BR * 0.4 && ball.x > d.x - BR - 4 && ball.x < d.x + 6 && ball.vx > -40) hitDrop(d);
  // sensors
  for (const L of lanes) { L.cd -= h; if (L.cd <= 0 && ball.y > 112 && ball.y < 120 && ball.x > L.x0 && ball.x < L.x1) { L.cd = 0.4; hitLane(L); } }
  if (ball.x < 60 && ball.y > 280 && ball.y < 430 && ball.vy < -200) orbitArm = 1.6;
  if (orbitArm > 0 && ball.x > 270 && ball.y < 110) { orbitArm = 0; hitOrbit(); }
}
function hitBumper(b) {
  b.flash = 1; const v = addScore(100); tone(330 + Math.random() * 40, 0.08, 'square', 0.1, 1.6); buzz(14); SH.kick(3);
  P.burst(b.x, b.y, ['#ffd166', '#ff5fa2', '#fff'], 10, { speed: 220, size: 2.4, kind: 'spark', life: 0.35 }); P.ring(b.x, b.y, '#ffd166', 32);
  floatTxt(b.x, b.y - 30, '+' + v);
}
function hitDrop(d) {
  d.down = true; d.t = 1; ball.vx = -Math.abs(ball.vx) * 0.6 - 120;
  const v = addScore(250); tone(880, 0.06, 'square', 0.07, 0.7); buzz(12); floatTxt(d.x - 30, d.y, '+' + v);
  P.burst(d.x, d.y, ['#7af0ff', '#fff'], 8, { speed: 160, size: 2, kind: 'spark', life: 0.3 });
  if (drops.every(x => x.down)) { const b = addScore(2500); dmd('TARGETS ' + b); ui.pop('TARGETS! +' + b, '#7af0ff', 32, 40); sfx.coin(); setTimeout(() => drops.forEach(x => { x.down = false; x.t = 0; }), 1500); }
}
function hitLane(L) {
  if (!L.lit) { L.lit = true; const v = addScore(250); floatTxt((L.x0 + L.x1) / 2, 150, '+' + v); note(76 + lanes.indexOf(L) * 4, 0.2, 0.12); }
  else { const v = addScore(50); floatTxt((L.x0 + L.x1) / 2, 150, '+' + v); }
  if (lanes.every(l => l.lit)) {
    const v = addScore(1000); setTimeout(() => lanes.forEach(l => l.lit = false), 500);
    if (mult < 5) { mult++; dmd(mult + 'X MULTIPLIER'); ui.pop(`${mult}× MULTIPLIER!`, '#ffd166', 38, 36); } else { dmd('LANES ' + v); ui.pop('LANES +' + v, '#ffd166', 34, 36); }
    sfx.win(); buzz([20, 30, 20]); confettiAt(ox + 185 * sc, oy + 140 * sc);
  }
}
function hitOrbit() {
  orbits++; const v = addScore(1000); ui.pop(`ORBIT! +${v}`, '#7af0ff', 36, 32); dmd('ORBIT ' + v);
  [67, 71, 74, 79].forEach((n, i) => setTimeout(() => note(n, 0.25, 0.12), i * 60)); buzz([15, 20, 15]);
  if (orbits === 3 && !extraGiven) { extraGiven = true; extra++; setTimeout(() => { ui.pop('EXTRA BALL!', '#ffd166', 40, 40); dmd('EXTRA BALL'); sfx.win(); }, 700); }
}
const floats = [];
function floatTxt(x, y, s) { floats.push({ x, y, s, t: 0.8 }); }
function drain() {
  if (saveT > 0) { saveT = 0; dmd('BALL SAVED'); ui.pop('BALL SAVED!', '#7af0ff', 34, 46); tone(660, 0.2, 'triangle', 0.1, 1.5); newBall(); bot.plungeAt = clock + 0.4; return; }
  sfx.fail(); buzz([50, 40, 80]); SH.kick(8);
  if (extra > 0) { extra--; dmd('SHOOT AGAIN'); ui.pop('SHOOT AGAIN', '#ffd166', 36, 46); newBall(); return; }
  if (ballN >= 3) { ball = null; gameOver(); return; }
  ballN++; mult = 1; dmd('BALL ' + ballN); ui.pop('BALL ' + ballN, '#fff', 40, 46); newBall();
}
function gameOver() {
  state = 'lost';
  if (!recorded) { recorded = true; F.endless(score); B.submit(score, { ms: performance.now() - t0 }); }
  const nb = score > best; best = Math.max(best, score); S.set('best', best);
  ui.lose('GAME OVER', nb && score > 0 ? `New best: ${score.toLocaleString('en-US')}!` : `Score ${score.toLocaleString('en-US')} · best ${best.toLocaleString('en-US')}`);
}

// ---------------------------------------------------------------- loop
let last = performance.now();
function frame(t) {
  const dt = Math.min(0.033, (t - last) / 1000); last = t; clock += dt;
  P.update(dt); SH.update(dt);
  for (const b of bumpers) b.flash = Math.max(0, b.flash - dt * 5);
  for (const s of slings) s.flash = Math.max(0, s.flash - dt * 6);
  for (const f of floats) { f.t -= dt; f.y -= 40 * dt; } while (floats.length && floats[0].t <= 0) floats.shift();
  msgT -= dt; orbitArm -= dt;
  if (state === 'play' && ball) {
    if (clock < bot.until || DM.on) botThink();
    flipOn(flips[0], press.L.size > 0 || keyL.v || (botFlip[0] > clock && botWait[0] < clock));
    flipOn(flips[1], press.R.size > 0 || keyR.v || (botFlip[1] > clock && botWait[1] < clock));
    if (plungeHeld && ball.inLane) plunge = Math.min(1, plunge + dt / 0.9);
    if (!ball.inLane) saveT -= dt;
    const n = Math.ceil(dt / (1 / 700)); for (let i = 0; i < n; i++) { step(dt / n); if (ball.y > TH + 20) break; }
    ball.trail.push([ball.x, ball.y]); if (ball.trail.length > 6) ball.trail.shift();
    if (ball.y > TH + 20) drain();
    else if (!ball.inLane && Math.hypot(ball.vx, ball.vy) < 8 && !flips.some(f => Math.hypot(ball.x - f.px, ball.y - f.py) < FL + 16)) { stuckT += dt; if (stuckT > 2.5) { ball.vy = -500; ball.vx = (Math.random() - 0.5) * 300; stuckT = 0; } } else stuckT = 0;
  } else { for (const f of flips) { f.on = false; f.a += ((f.rest) - f.a) * 0.3; } }
  draw();
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- draw
const dmdC = document.createElement('canvas'); dmdC.width = 128; dmdC.height = 20; const dmdG = dmdC.getContext('2d', { willReadFrequently: true });
let dmdKey = '', dmdPix = null;
function dmdRender(text) {
  if (text === dmdKey) return; dmdKey = text;
  dmdG.clearRect(0, 0, 128, 20); dmdG.fillStyle = '#fff'; dmdG.font = '800 17px "Baloo 2",system-ui'; dmdG.textAlign = 'center'; dmdG.textBaseline = 'middle'; dmdG.fillText(text, 64, 11);
  dmdPix = dmdG.getImageData(0, 0, 128, 20).data;
}
function drawHead() {
  const W = TW, x0 = 62, x1 = W - 12, y0 = -HEAD + 8, h = HEAD - 16;
  g.fillStyle = '#0c0618'; g.strokeStyle = '#5b3c9a'; g.lineWidth = 2; g.beginPath(); g.roundRect(x0, y0, x1 - x0, h, 10); g.fill(); g.stroke();
  const text = msgT > 0 ? msg : score.toLocaleString('en-US');
  dmdRender(text);
  const cols = 128, rows = 20, pw = (x1 - x0 - 90) / cols, ph = (h - 10) / rows, px0 = x0 + 6, py0 = y0 + 5;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const on = dmdPix[(j * 128 + i) * 4 + 3] > 100;
    g.fillStyle = on ? '#ffad3b' : 'rgba(255,140,40,.08)';
    g.fillRect(px0 + i * pw, py0 + j * ph, pw * 0.72, ph * 0.72);
  }
  // ball + multiplier box
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffd6f0'; g.font = '800 12px "Baloo 2",system-ui';
  g.fillText('BALL', x1 - 62, y0 + 15); g.fillText('MULT', x1 - 24, y0 + 15);
  g.font = '800 22px "Baloo 2",system-ui'; g.fillStyle = '#fff'; g.fillText(ball || state !== 'lost' ? ballN : '-', x1 - 62, y0 + 38); g.fillStyle = '#ffd166'; g.fillText(mult + '×', x1 - 24, y0 + 38);
}
function draw() {
  V.begin(); const W = V.W, H = V.H;
  const bg = g.createRadialGradient(W / 2, H * 0.4, 50, W / 2, H / 2, Math.max(W, H)); bg.addColorStop(0, '#2c1458'); bg.addColorStop(1, '#0a0418'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.save(); g.translate(ox + SH.x, oy + SH.y); g.scale(sc, sc);
  drawHead();
  g.drawImage(art, 0, 0, TW, TH);
  // lit inserts
  const blink = Math.sin(clock * 10) > 0;
  for (const L of lanes) { const cx = (L.x0 + L.x1) / 2; glow(cx, 150, 8, L.lit ? '#ffd166' : null); }
  glow(34 + 3, 380, 0, null); arrow(g, 34, 380, -Math.PI / 2, orbitArm > 0 || blink && orbits < 3 ? '#7af0ff' : 'rgba(122,240,255,.25)');
  arrow(g, 318, 400, 0, drops.some(d => !d.down) && blink ? 'rgba(255,95,162,.9)' : 'rgba(255,95,162,.3)');
  for (let i = 0; i < 4; i++) { const on = mult >= i + 2; glow(140 + i * 32, 560, 11, on ? '#ff5fa2' : null); g.fillStyle = on ? '#fff' : 'rgba(255,214,240,.4)'; g.font = '800 11px "Baloo 2",system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText((i + 2) + '×', 140 + i * 32, 561); }
  if (saveT > 0 && state === 'play' && (saveT > 2 || blink)) { g.fillStyle = '#7af0ff'; g.font = '800 12px "Baloo 2",system-ui'; g.textAlign = 'center'; g.fillText('BALL SAVE', 185, 720); }
  // slingshots
  for (const s of slings) {
    g.beginPath(); g.moveTo(...s.a); g.lineTo(...s.b); g.lineTo(...s.c); g.closePath();
    g.fillStyle = s.flash > 0 ? `rgba(122,240,255,${0.3 + s.flash * 0.6})` : 'rgba(122,240,255,.25)'; g.fill();
    g.lineWidth = 5; g.strokeStyle = s.flash > 0 ? '#ffffff' : '#7af0ff'; g.stroke();
  }
  // drop targets
  for (const d of drops) {
    if (d.down) { g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(d.x - 3, d.y - d.h, 6, d.h * 2); continue; }
    const gr = g.createLinearGradient(d.x - 5, 0, d.x + 5, 0); gr.addColorStop(0, '#ff9ccc'); gr.addColorStop(1, '#c2186b');
    g.fillStyle = gr; g.beginPath(); g.roundRect(d.x - 5, d.y - d.h, 10, d.h * 2, 3); g.fill();
  }
  // bumpers
  for (const b of bumpers) {
    const s = 1 + b.flash * 0.12;
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(b.x + 3, b.y + 5, b.r * s, 0, 7); g.fill();
    g.fillStyle = b.flash > 0 ? '#ffffff' : '#ff5fa2'; g.beginPath(); g.arc(b.x, b.y, b.r * s, 0, 7); g.fill();
    const cg = g.createRadialGradient(b.x - 6, b.y - 7, 2, b.x, b.y, b.r * 0.78 * s); cg.addColorStop(0, '#fff6d6'); cg.addColorStop(1, b.flash > 0 ? '#ffd166' : '#ffb03b');
    g.fillStyle = cg; g.beginPath(); g.arc(b.x, b.y, b.r * 0.74 * s, 0, 7); g.fill();
    g.fillStyle = '#2a1260'; g.font = '800 10px "Baloo 2",system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('100', b.x, b.y + 1);
    if (b.flash > 0) { g.globalCompositeOperation = 'lighter'; const lg = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * 2.4); lg.addColorStop(0, `rgba(255,209,102,${b.flash * 0.7})`); lg.addColorStop(1, 'rgba(255,209,102,0)'); g.fillStyle = lg; g.beginPath(); g.arc(b.x, b.y, b.r * 2.4, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over'; }
  }
  // gates
  g.strokeStyle = ball && ball.inLane ? 'rgba(255,214,240,.3)' : '#ffd166'; g.lineWidth = 3; g.beginPath(); g.moveTo(gate.x1, gate.y1); g.lineTo(gate.x2, gate.y2); g.stroke();
  g.strokeStyle = 'rgba(255,214,240,.45)'; g.lineWidth = 2; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(ogate.x1, ogate.y1); g.lineTo(ogate.x2, ogate.y2); g.stroke(); g.setLineDash([]);
  // plunger
  const py = 745 + plunge * 22;
  g.fillStyle = '#5b3c9a'; g.fillRect(366, py, 18, TH - py); g.fillStyle = '#ffd166'; g.beginPath(); g.roundRect(363, py - 2, 24, 7, 3); g.fill();
  if (ball && ball.inLane && state === 'play') { g.fillStyle = `rgba(255,209,102,${0.5 + 0.5 * Math.sin(clock * 6)})`; g.font = '800 11px "Baloo 2",system-ui'; g.textAlign = 'center'; g.save(); g.translate(375, 640); g.rotate(-Math.PI / 2); g.fillText(plungeHeld ? 'RELEASE!' : 'HOLD · LAUNCH', 0, 0); g.restore(); }
  // flippers
  for (const f of flips) {
    const tx = f.px + Math.cos(f.a) * FL, ty = f.py + Math.sin(f.a) * FL;
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 15; g.beginPath(); g.moveTo(f.px + 3, f.py + 5); g.lineTo(tx + 3, ty + 5); g.stroke();
    g.strokeStyle = '#ff5fa2'; g.lineWidth = 16; g.beginPath(); g.moveTo(f.px, f.py); g.lineTo(tx, ty); g.stroke();
    g.strokeStyle = '#ffffff'; g.lineWidth = 10; g.beginPath(); g.moveTo(f.px, f.py); g.lineTo(tx, ty); g.stroke();
    g.fillStyle = '#ffd166'; g.beginPath(); g.arc(f.px, f.py, 3.5, 0, 7); g.fill();
  }
  // ball
  if (ball) {
    ball.trail.forEach(([x, y], i) => { g.globalAlpha = i / ball.trail.length * 0.25; g.fillStyle = '#d8e4ff'; g.beginPath(); g.arc(x, y, BR * 0.9, 0, 7); g.fill(); }); g.globalAlpha = 1;
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(ball.x + 2.5, ball.y + 4, BR, 0, 7); g.fill();
    const bg2 = g.createRadialGradient(ball.x - 3, ball.y - 4, 1, ball.x, ball.y, BR); bg2.addColorStop(0, '#ffffff'); bg2.addColorStop(0.35, '#dfe6f5'); bg2.addColorStop(0.8, '#8c96b8'); bg2.addColorStop(1, '#5d6688');
    g.fillStyle = bg2; g.beginPath(); g.arc(ball.x, ball.y, BR, 0, 7); g.fill();
  }
  P.draw(g);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 15px "Baloo 2",system-ui';
  for (const f of floats) { g.globalAlpha = Math.min(1, f.t * 2.5); g.fillStyle = '#fff'; g.fillText(f.s, f.x, f.y); } g.globalAlpha = 1;
  g.restore();
}
function glow(x, y, r, col) {
  if (!col) return;
  g.globalCompositeOperation = 'lighter'; const lg = g.createRadialGradient(x, y, 0, x, y, r * 2.4); lg.addColorStop(0, col); lg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = lg; g.beginPath(); g.arc(x, y, r * 2.4, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over';
  g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
}

reset(); ui.start(); requestAnimationFrame(frame);

// ---------------------------------------------------------------- test hooks
const botFlip = [0, 0], botWait = [0, 0];
function botThink() {
  if (!ball) return;
  if (ball.inLane) { if (!plungeHeld && clock > bot.plungeAt) { plungeHeld = true; bot.plungeAt = clock + 0.6; } else if (plungeHeld && clock > bot.plungeAt) release(); return; }
  flips.forEach((f, i) => {
    // flip when the ball is over the outer two thirds of this flipper and coming down (or resting on it)
    const lx = (ball.x - f.px) * -f.side, dy = f.py - ball.y;
    if (lx > 14 && lx < FL + 8 && dy > -18 && dy < 42 && ball.vy > -150 && botFlip[i] < clock - 0.25) {
      if (Math.random() < 0.18) { botFlip[i] = clock + 0.18 + 0.35; botWait[i] = clock + 0.35; }   // flips late now and then, like a person
      else botFlip[i] = clock + 0.18;
    }
  });
}
window.__game = {
  get state() { return state; }, get level() { return ballN; }, get score() { return score; },
  get dbg() { return ball ? { x: ball.x | 0, y: ball.y | 0, vx: ball.vx | 0, vy: ball.vy | 0, lane: ball.inLane, mult, orbits } : null; },
  bot() { if (state === 'play') bot.until = clock + 1.0; },
};
