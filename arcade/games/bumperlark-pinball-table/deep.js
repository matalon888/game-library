// Bumperlark v2 (deep) — the same table, now with 30 authored missions in 3 tables, stars, a map and ball skins (levels.js).
// v1 text: one pinball table: two flippers, three pop bumpers, slingshots, three top lanes that raise the
// multiplier, a drop-target bank and a left orbit. Three balls; best score counts.
// Phone: tap/hold the left or right half for each flipper; hold and release to launch. Desktop: Z / M (or ← / →), Space launches.
import { createUI, store, buzz, sfx, tone, note } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { LEVELS, WORLDS } from './levels.js';
import { css, arcadeCards, startCard, canvas2d, particles, shaker } from './arc.js';

const NAME = 'Bumperlark: Pinball Table';
const S = store('bumperlark');
let best = S.get('best', 0);
let stars = S.get('stars', []), reach = S.get('reach', 1), skin = S.get('skin', 0), owned = S.get('owned', [0]), LV = LEVELS[0], level = 1;
const NL = LEVELS.length;
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
const LAYOUTS = {
  tri: [[140, 252], [236, 252], [188, 330]], wide: [[112, 280], [188, 232], [264, 280]], diamond: [[188, 226], [130, 290], [246, 290], [188, 354]],
  five: [[122, 240], [254, 240], [188, 292], [130, 352], [246, 352]], line: [[112, 300], [188, 300], [264, 300]],
};
let bumpers = LAYOUTS.tri.map(([x, y]) => ({ x, y, bx: x, r: 23, flash: 0 }));
// drop targets
const drops = [292, 328, 364].map(y => ({ x: 344, y, h: 15, down: false, t: 0, hp: 1 }));
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
let autoT = 0, ball = null, saveT = 0, plunge = 0, plungeHeld = false, orbitArm = 0, orbits = 0, extraGiven = false, extra = 0, stuckT = 0, drainT = 0, msg = '', msgT = 0, tilt = 0;
const press = { L: new Set(), R: new Set() }, keyL = { v: false }, keyR = { v: false }, keyP = { v: false };
const bot = { until: 0, plungeAt: 0 };

function newBall() { ball = { x: 375, y: 735, vx: 0, vy: 0, inLane: true, trail: [] }; plunge = 0; saveT = 0; }
let combo = 0, comboT = 0, jackpots = 0, freeze = 0, spin = null, magnet = null, walls = [];
let run = 0, prog = {}, won = false, goalDone = [], hotB = null, hotT = 0, warp = 1, lastPaid = 0;
function reset() {
  score = 0; ballN = 1; mult = 1; recorded = false; beatenShown = false; orbits = 0; extraGiven = false; extra = 0; orbitArm = 0;
  prog = { score: 0, bump: 0, drops: 0, orbit: 0, mult: 1, lanes: 0, hot: 0, sling: 0, spin: 0, jackpot: 0 }; won = false; goalDone = LV.goal.map(() => false); stuckT = 0; floats.length = 0;
  bumpers = LAYOUTS[LV.lay].map(([x, y], i) => ({ x, y, bx: x, r: 23, flash: 0, mv: LV.mover && i === (LV.lay === 'line' ? 1 : 0) ? 1 : 0, hot: false }));
  buildGimmicks();
  hotB = null; hotT = 0; if (LV.hot) hop();
  for (const d of drops) { d.down = false; d.hp = LV.armor ? 2 : 1; d.t = 0; }
  for (const L of lanes) L.lit = false;
  newBall(); P.clear(); dmd('BALL 1');
}
function buildGimmicks() {
  // permanent walls from the last table build go away; each mission may add: spin (spinner), wall (diverter posts), magnet (pocket)
  for (const w of walls) { const i = segs.indexOf(w); if (i >= 0) segs.splice(i, 1); } walls = [];
  combo = 0; comboT = 0; jackpots = 0; freeze = 0; spin = null; magnet = null;
  const gm = LV.gim || '';
  if (gm.includes('spin')) spin = { x: 188, y: 420, a: 0, w: 0, hits: 0 };
  if (gm.includes('wall')) { for (const [a, b] of [[[150, 400], [186, 420]], [[226, 400], [190, 420]]]) { const w = { x1: a[0], y1: a[1], x2: b[0], y2: b[1], e: 0.6, t: 3, wall: true }; walls.push(w); segs.push(w); } }
  if (gm.includes('magnet')) magnet = { x: 188, y: 505, r: 46, on: 0 };
}
function hop() {
  const pool = bumpers.filter(b => b !== hotB && !b.mv); if (!pool.length) return;
  if (hotB) hotB.hot = false; hotB = pool[Math.floor(Math.random() * pool.length)]; hotB.hot = true; hotT = 7;
}
function addScore(n, x, y, col = '#fff') {
  const v = n * mult; score += v; prog.score = score; checkGoals();
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
ui.onTap(w => { startLevel(reach); });

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
  freeze = 0.02;
  ball.vx += nx * 620; ball.vy += ny * 620; sl.flash = 1; prog.sling++;
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
  if (magnet && !ball.inLane) { const dx = magnet.x - ball.x, dy = magnet.y - ball.y, d = Math.hypot(dx, dy); if (d < magnet.r && d > 1) { const k = (1 - d / magnet.r) * 1500 * h; ball.vx += dx / d * k; ball.vy += dy / d * k; ball.vx *= 1 - 1.2 * h; if (magnet.on <= 0) { magnet.on = 1; addScore(75); floatTxt(magnet.x, magnet.y - 22, 'MAGNET'); tone(220, 0.1, 'sine', 0.09, 1.8); } } }
  if (spin && !ball.inLane && Math.abs(ball.x - spin.x) < 44 && Math.abs(ball.y - spin.y) < 14) { const sp = Math.abs(ball.vx) + Math.abs(ball.vy) * 0.3; if (sp > 160 && clock - (spin.kick || 0) > 0.35) { spin.kick = clock; spin.w = Math.min(16, spin.w + 5 + sp * 0.006); } }
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
  b.flash = 1; prog.bump++; chain(b.x, b.y); if (b.hot) { prog.hot++; hop(); const hv = addScore(500); floatTxt(b.x, b.y - 46, 'HOT +' + hv); sfx.coin(); ui.pop('HOT!', '#ffd166', 30, 34); P.ring(b.x, b.y, '#fff', 54); SH.kick(5); }
  const v = addScore(100); tone(330 + Math.random() * 40, 0.08, 'square', 0.1, 1.6); buzz(14); SH.kick(3);
  P.burst(b.x, b.y, ['#ffd166', '#ff5fa2', '#fff'], 10, { speed: 220, size: 2.4, kind: 'spark', life: 0.35 }); P.ring(b.x, b.y, '#ffd166', 32);
  floatTxt(b.x, b.y - 30, '+' + v);
}
function chain(x, y) {
  combo = comboT > 0 ? combo + 1 : 1; comboT = 1.6; freeze = Math.min(0.05, 0.015 + combo * 0.004);
  if (combo >= 4 && combo % 2 === 0) { floatTxt(x, y - 52, 'COMBO ×' + combo); SH.kick(Math.min(10, 3 + combo / 2)); tone(400 + combo * 40, 0.1, 'triangle', 0.1, 1.5); }
  if (combo === 10 + jackpots * 8) { jackpots++; const v = addScore(5000); ui.pop('JACKPOT! +' + v, '#ffd166', 44, 40); dmd('JACKPOT ' + v); sfx.win(); buzz([20, 30, 20, 30, 40]); confettiAt(V.W / 2, V.H * 0.4); SH.kick(14); freeze = 0.12; prog.jackpot = (prog.jackpot || 0) + 1; }
}
function hitDrop(d) {
  if (d.hp > 1) { d.hp--; d.t = 1; ball.vx = -Math.abs(ball.vx) * 0.6 - 160; addScore(80); tone(300, 0.08, 'square', 0.1, 0.8); buzz(10); floatTxt(d.x - 30, d.y, 'CRACK'); P.burst(d.x, d.y, ['#fff'], 6, { speed: 160, size: 2, kind: 'spark', life: 0.25 }); return; }
  d.down = true; d.t = 1; ball.vx = -Math.abs(ball.vx) * 0.6 - 120;
  const v = addScore(250); tone(880, 0.06, 'square', 0.07, 0.7); buzz(12); floatTxt(d.x - 30, d.y, '+' + v);
  P.burst(d.x, d.y, ['#7af0ff', '#fff'], 8, { speed: 160, size: 2, kind: 'spark', life: 0.3 });
  if (drops.every(x => x.down)) { prog.drops++; const b = addScore(2500); dmd('TARGETS ' + b); ui.pop('TARGETS! +' + b, '#7af0ff', 32, 40); sfx.coin(); setTimeout(() => drops.forEach(x => { x.down = false; x.t = 0; x.hp = LV.armor ? 2 : 1; }), 1500); }
}
function hitLane(L) {
  if (!L.lit) { L.lit = true; const v = addScore(250); floatTxt((L.x0 + L.x1) / 2, 150, '+' + v); note(76 + lanes.indexOf(L) * 4, 0.2, 0.12); }
  else { const v = addScore(50); floatTxt((L.x0 + L.x1) / 2, 150, '+' + v); }
  if (lanes.every(l => l.lit)) {
    const v = addScore(1000); setTimeout(() => lanes.forEach(l => l.lit = false), 500);
    prog.lanes++; if (mult < 5) { mult++; prog.mult = mult; dmd(mult + 'X MULTIPLIER'); ui.pop(`${mult}× MULTIPLIER!`, '#ffd166', 38, 36); } else { dmd('LANES ' + v); ui.pop('LANES +' + v, '#ffd166', 34, 36); }
    sfx.win(); buzz([20, 30, 20]); confettiAt(ox + 185 * sc, oy + 140 * sc);
  }
}
function hitOrbit() {
  orbits++; prog.orbit++; const v = addScore(1000); ui.pop(`ORBIT! +${v}`, '#7af0ff', 36, 32); dmd('ORBIT ' + v);
  [67, 71, 74, 79].forEach((n, i) => setTimeout(() => note(n, 0.25, 0.12), i * 60)); buzz([15, 20, 15]);
  if (orbits === 3 && !extraGiven) { extraGiven = true; extra++; setTimeout(() => { ui.pop('EXTRA BALL!', '#ffd166', 40, 40); dmd('EXTRA BALL'); sfx.win(); }, 700); }
}
const floats = [];
function floatTxt(x, y, s) { floats.push({ x, y, s, t: 0.8 }); }
function drain() {
  if (saveT > 0) { saveT = 0; dmd('BALL SAVED'); ui.pop('BALL SAVED!', '#7af0ff', 34, 46); tone(660, 0.2, 'triangle', 0.1, 1.5); newBall(); bot.plungeAt = clock + 0.4; return; }
  sfx.fail(); buzz([50, 40, 80]); SH.kick(8);
  if (extra > 0) { extra--; dmd('SHOOT AGAIN'); ui.pop('SHOOT AGAIN', '#ffd166', 36, 46); newBall(); return; }
  if (ballN >= LV.balls) { ball = null; gameOver(); return; }
  ballN++; mult = 1; dmd('BALL ' + ballN); ui.pop('BALL ' + ballN, '#fff', 40, 46); newBall();
}
function goalMet(g) { return g.t === 'score' ? score >= g.n : (prog[g.t] || 0) >= g.n; }
function checkGoals() {
  if (won || state !== 'play') return;
  LV.goal.forEach((g, i) => {
    if (!goalDone[i] && goalMet(g)) { goalDone[i] = true; if (!goalDone.every(Boolean)) { dmd('GOAL ' + (i + 1) + ' DONE'); ui.pop('GOAL DONE!', '#7af0ff', 34, 34); sfx.coin(); buzz([15, 20, 15]); confettiAt(V.W / 2, V.H * 0.35); } }
  });
  if (goalDone.every(Boolean)) { won = true; const r = run; setTimeout(() => r === run && winLevel(), 900); }
}
function finishRun() {
  if (!recorded) { recorded = true; F.endless(score); B.submit(score, { ms: performance.now() - t0 }); }
  best = Math.max(best, score); S.set('best', best);
}
function winLevel() {
  if (state !== 'play') return;
  state = 'won'; finishRun(); sfx.win(); buzz([20, 30, 20, 30, 40]); confettiAt(V.W / 2, V.H * 0.4);
  const st = 1 + (ballN < LV.balls || extra > 0 ? 1 : 0) + (score >= LV.s3 ? 1 : 0);
  const old = stars[level - 1] || 0; stars[level - 1] = Math.max(old, st); S.set('stars', stars);
  const before = totalStars() - (stars[level - 1] - old);
  if (level >= reach && level < NL) { reach = level + 1; S.set('reach', reach); }
  const gain = stars[level - 1] - old, unlocked = checkSkins(before);
  const r = run; setTimeout(() => r === run && showWin(st, gain, unlocked), 700);
}
function gameOver() {
  state = 'lost'; finishRun(); const open = LV.goal.map((g, i) => goalDone[i] ? null : g).filter(Boolean);
  const g0 = open[0], need = g0 ? Math.max(0, g0.n - (g0.t === 'score' ? score : (prog[g0.t] || 0))) : 0;
  const near = g0 && need > 0 && need <= Math.ceil(g0.n * 0.25);
  const r = run; setTimeout(() => r === run && showLose(near ? `SO CLOSE: ${need} ${GN[g0.t]} to go` : `Score ${score.toLocaleString('en-US')}`), 600);
}
const GN = { score: 'points', bump: 'bumper hits', drops: 'bank', orbit: 'orbit', mult: 'multiplier', lanes: 'lane sets', hot: 'hot hits', sling: 'sling kicks', spin: 'spins', jackpot: 'jackpot' };
const GT = { score: g => `${g.n.toLocaleString('en-US')} pts`, bump: g => `${g.n} bumps`, drops: g => `${g.n} bank${g.n > 1 ? 's' : ''}`, orbit: g => `${g.n} orbit${g.n > 1 ? 's' : ''}`, mult: g => `${g.n}× mult`, lanes: g => `${g.n} lanes`, hot: g => `${g.n} hot`, sling: g => `${g.n} slings`, spin: g => `${g.n} spins`, jackpot: g => `${g.n} jackpot` };
const GI = { score: '⭐', bump: '🔴', drops: '🎯', orbit: '🌀', mult: '✖️', lanes: '🔆', hot: '🔥', sling: '🏹', spin: '🌀', jackpot: '💎' };
const totalStars = () => stars.reduce((a, b) => a + (b || 0), 0);
const SKINS = [{ n: 'Steel', c: ['#ffffff', '#dfe6f5', '#8c96b8'] }, { n: 'Rose', c: ['#fff0f6', '#ff9ccc', '#c2186b'] }, { n: 'Sky', c: ['#f0fbff', '#7af0ff', '#1b8fc2'] }, { n: 'Sun', c: ['#fffbe6', '#ffd166', '#c27a00'] },
  { n: 'Mint', c: ['#f0fff6', '#7be8b0', '#1b9a62'] }, { n: 'Grape', c: ['#f6f0ff', '#b08cff', '#5b3cb0'] }, { n: 'Ember', c: ['#fff4e6', '#ff8a3d', '#a8340a'] }, { n: 'Night', c: ['#c8d0ff', '#4a4f9c', '#14143a'] }];
const SKIN_EVERY = 5;
function checkSkins(before) {
  const have = Math.min(SKINS.length - 1, Math.floor(totalStars() / SKIN_EVERY)), got = [];
  for (let i = 1; i <= have; i++) if (!owned.includes(i)) { owned.push(i); got.push(i); }
  if (got.length) { S.set('owned', owned); skin = got[got.length - 1]; S.set('skin', skin); }
  return got;
}

// ---------------------------------------------------------------- cards, map, balls
const cs = css(`
.bl-layer{position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;background:rgba(14,6,34,.72);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px);font-family:'Baloo 2',system-ui,sans-serif;color:#fff;text-align:center;overflow:auto}
.bl-layer.hc-hidden{display:none}
.bl-box{width:min(92vw,400px);padding:18px 14px}
.bl-box h2{font-size:34px;margin:0;line-height:1;text-shadow:0 3px 0 rgba(0,0,0,.3)}
.bl-box p{margin:6px 0;font-size:15px;opacity:.9;font-weight:700}
.bl-row{display:flex;justify-content:center;gap:10px;margin-top:12px;flex-wrap:wrap}
.bl-sm{padding:9px 18px;border-radius:22px;background:#fff;color:#2a1260;font:800 16px 'Baloo 2',system-ui,sans-serif;box-shadow:0 3px 0 rgba(0,0,0,.25);cursor:pointer;position:relative}
.bl-sm.big{background:#ff5fa2;color:#fff;font-size:20px;padding:10px 26px}
.bl-sm.on{outline:3px solid #ffd166}
.bl-sm i{position:absolute;top:-7px;right:-5px;background:#ff3048;color:#fff;font-style:normal;font-size:11px;padding:1px 6px;border-radius:9px}
.bl-stars{display:flex;justify-content:center;gap:6px;margin:8px 0}
.bl-stars svg.pop{animation:blstar .5s cubic-bezier(.2,1.6,.4,1) backwards}
@keyframes blstar{from{transform:scale(0) rotate(-90deg)}}
.bl-goal{display:flex;justify-content:space-between;background:rgba(255,255,255,.14);border-radius:12px;padding:5px 12px;margin:5px 0;font-weight:800;font-size:15px}
.bl-goal.done{background:rgba(80,220,120,.45)}
.bl-map{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:10px}
.bl-node{aspect-ratio:1;border-radius:14px;background:rgba(255,255,255,.92);color:#2a1260;font:800 20px 'Baloo 2',system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 4px 0 rgba(0,0,0,.25);position:relative;line-height:1;cursor:pointer}
.bl-node.lock{opacity:.4}.bl-node.cur{background:#ffd166;animation:blbeat .7s ease-in-out infinite alternate}.bl-node.boss{background:#ffb3d6}.bl-node.boss.cur{background:#ff5fa2;color:#fff}
.bl-node em{font-style:normal;font-size:9px;color:#c2186b;position:absolute;top:2px}.bl-node span{display:flex;margin-top:2px}
@keyframes blbeat{to{transform:scale(1.07)}}
.bl-bar{height:14px;border-radius:8px;background:rgba(0,0,0,.35);overflow:hidden;margin:8px auto;width:230px}.bl-bar i{display:block;height:100%;background:linear-gradient(90deg,#ffd166,#ff5fa2)}
.bl-skins{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:12px}.bl-skin{border-radius:14px;background:rgba(255,255,255,.16);padding:8px 2px;font-size:12px;font-weight:800;cursor:pointer}.bl-skin.on{outline:3px solid #ffd166}
.bl-skin b{display:block;width:34px;height:34px;border-radius:50%;margin:0 auto 4px;box-shadow:inset -4px -5px 0 rgba(0,0,0,.25)}.bl-skin.lock b{background:#4b4566!important;box-shadow:none}
.bl-btn{position:fixed;left:10px;bottom:calc(14px + env(safe-area-inset-bottom));z-index:30;width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.88);display:flex;align-items:center;justify-content:center;box-shadow:0 3px 0 rgba(0,0,0,.25)}
`);
const H = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); const e = d.firstElementChild; document.body.appendChild(e); return e; };
const layer = H('<div class="bl-layer hc-hidden"></div>');
const show = (html) => { layer.innerHTML = html; layer.classList.remove('hc-hidden'); };
const hide = () => { layer.classList.add('hc-hidden'); layer.innerHTML = ''; };
const STAR = (on, s = 22, cls = '') => `<svg class="${cls}" width="${s}" height="${s}" viewBox="0 0 24 24"><path d="M12 2l3 7 7.5.6-5.7 5 1.8 7.4L12 18l-6.6 4 1.8-7.4-5.7-5L9 9z" fill="${on ? '#ffd23f' : 'rgba(0,0,0,.3)'}" stroke="${on ? '#b8860b' : 'rgba(0,0,0,.2)'}" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
const starsRow = (n, sz = 40, anim = false) => `<div class="bl-stars">${[1, 2, 3].map(i => STAR(i <= n, sz, anim && i <= n ? 'pop" style="animation-delay:' + (0.2 + i * 0.22) + 's' : '')).join('')}</div>`;
const mapBtn = H('<div class="bl-btn" style="display:none"><svg width="22" height="22" viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 18h18" stroke="#2a1260" stroke-width="3" stroke-linecap="round"/></svg></div>');
mapBtn.addEventListener('pointerdown', e => { e.stopPropagation(); if (state === 'ready') showMap(); });
const skinCss = k => `radial-gradient(circle at 35% 30%,${SKINS[k].c[0]},${SKINS[k].c[1]} 45%,${SKINS[k].c[2]})`;
const goalRows = (ds) => LV.goal.map((g, i) => `<div class="bl-goal ${ds && ds[i] ? 'done' : ''}"><span>${GI[g.t]} ${GT[g.t](g)}</span><span>${ds && ds[i] ? '✔' : ''}</span></div>`).join('');
function skinBar() {
  const t = totalStars(), nx = Math.min(SKINS.length, Math.floor(t / SKIN_EVERY) + 1), full = owned.length >= SKINS.length;
  return full ? '<p>All balls found!</p>' : `<div class="bl-bar"><i style="width:${(t % SKIN_EVERY) / SKIN_EVERY * 100}%"></i></div><p>${SKIN_EVERY - t % SKIN_EVERY} star${SKIN_EVERY - t % SKIN_EVERY > 1 ? 's' : ''} to a new ball · ${t} stars</p>`;
}
function showWin(st, gain, unlocked) {
  const nextOk = level < NL;
  const tip = st < 3 ? (score < LV.s3 ? `3rd star: ${LV.s3.toLocaleString('en-US')} pts (you: ${score.toLocaleString('en-US')})` : 'Finish before your last ball for the 2nd star') : 'Perfect table!';
  show(`<div class="bl-box"><h2>${LV.boss ? 'BOSS CLEARED!' : 'MISSION ' + level + ' DONE!'}</h2><p>${LV.n}</p>${starsRow(st, 46, true)}
    <p>${tip}</p>${unlocked.length ? `<p style="font-size:20px;color:#ffd166">NEW BALL: ${SKINS[unlocked[unlocked.length - 1]].n}!</p><div class="bl-skin" style="width:80px;margin:0 auto"><b style="background:${skinCss(unlocked[unlocked.length - 1])}"></b></div>` : skinBar()}
    <div class="bl-row"><div class="bl-sm" data-a="retry">AGAIN</div>${nextOk ? '<div class="bl-sm big" data-a="next">NEXT</div>' : ''}<div class="bl-sm" data-a="map">MAP</div></div></div>`);
}
function showLose(line) {
  const open = goalDone;
  show(`<div class="bl-box"><h2>${ballN >= LV.balls ? 'OUT OF BALLS' : 'MISSION OVER'}</h2><p style="color:#ffd166;font-size:17px">${line}</p>${goalRows(open)}
    <div class="bl-row"><div class="bl-sm big" data-a="retry">TRY AGAIN</div><div class="bl-sm" data-a="map">MAP</div></div></div>`);
}
let mapWorld = 0;
function showMap(w) {
  state = 'ready'; mapBtn.style.display = 'none'; ui.els.start.classList.add('hc-hidden');
  mapWorld = w === undefined ? Math.floor((Math.min(reach, NL) - 1) / 10) : w;
  const nodes = [];
  for (let i = 1; i <= 10; i++) {
    const n = mapWorld * 10 + i, st = stars[n - 1] || 0, lock = n > reach, cur = n === reach, boss = LEVELS[n - 1].boss;
    nodes.push(`<div class="bl-node ${lock ? 'lock' : ''} ${cur ? 'cur' : ''} ${boss ? 'boss' : ''}" data-a="${lock ? 'x' : 'lvl'}" data-n="${n}">${boss ? '<em>BOSS</em>' : ''}${n}<span>${[1, 2, 3].map(k => STAR(k <= st, 10)).join('')}</span></div>`);
  }
  show(`<div class="bl-box"><h2>${WORLDS[mapWorld].icon} ${WORLDS[mapWorld].name}</h2><p>${WORLDS[mapWorld].tag}</p>
    <div class="bl-row" style="margin-top:6px">${WORLDS.map((x, i) => `<div class="bl-sm ${i === mapWorld ? 'on' : ''}" data-a="${i * 10 + 1 > reach ? 'x' : 'world'}" data-n="${i}" style="${i * 10 + 1 > reach ? 'opacity:.4' : ''}">${x.icon}</div>`).join('')}</div>
    <div class="bl-map">${nodes.join('')}</div>${skinBar()}<div class="bl-row"><div class="bl-sm" data-a="balls">BALLS</div></div></div>`);
}
function showBalls() {
  show(`<div class="bl-box"><h2>BALLS</h2>${skinBar()}<div class="bl-skins">${SKINS.map((k, i) => `<div class="bl-skin ${owned.includes(i) ? '' : 'lock'} ${skin === i ? 'on' : ''}" data-a="${owned.includes(i) ? 'skin' : 'x'}" data-n="${i}"><b style="background:${skinCss(i)}"></b>${owned.includes(i) ? k.n : '?'}</div>`).join('')}</div>
    <div class="bl-row"><div class="bl-sm" data-a="map">BACK</div></div></div>`);
}
layer.addEventListener('pointerdown', e => {
  const t = e.target.closest('[data-a]'); e.stopPropagation(); if (!t) return;
  const a = t.dataset.a, n = +t.dataset.n;
  if (a === 'x') { tone(160, 0.1, 'square', 0.08, 0.7); return; }
  tone(520, 0.05, 'triangle', 0.08, 1.3);
  if (a === 'retry') startLevel(level);
  else if (a === 'next') startLevel(Math.min(NL, level + 1));
  else if (a === 'map') showMap();
  else if (a === 'world') showMap(n);
  else if (a === 'lvl') startLevel(n);
  else if (a === 'balls') showBalls();
  else if (a === 'skin') { skin = n; S.set('skin', skin); showBalls(); }
});
function startLevel(n) {
  run++; level = Math.max(1, Math.min(NL, n)); LV = LEVELS[level - 1]; hide(); ui.els.start.classList.add('hc-hidden'); reset();
  state = 'play'; t0 = performance.now(); B.start(); press.L.clear(); press.R.clear(); mapBtn.style.display = 'none';
  dmd('MISSION ' + level, 2.2);
}

// ---------------------------------------------------------------- loop
let last = performance.now();
function tick(dt) {
  clock += dt;
  comboT -= dt; if (comboT <= 0) combo = 0;
  if (magnet) magnet.on = Math.max(0, magnet.on - dt * 1.5);
  if (spin) { const prev = Math.floor(spin.a / Math.PI); spin.a += spin.w * dt; spin.w *= Math.pow(0.18, dt); if (Math.floor(spin.a / Math.PI) !== prev && spin.w > 2) { spin.hits++; prog.spin = (prog.spin || 0) + 1; const v = addScore(20); if (spin.hits % 4 === 0) floatTxt(spin.x, spin.y - 24, '+' + v); tone(900 + Math.min(600, spin.w * 20), 0.02, 'square', 0.04, 0.5); } }
  if (freeze > 0) { freeze -= dt; return; }
  for (const b of bumpers) { b.flash = Math.max(0, b.flash - dt * 5); if (b.mv) b.x = b.bx + Math.sin(clock * 1.25) * 34; }
  if (hotB && state === 'play') { hotT -= dt; if (hotT <= 0) hop(); }
  for (const s of slings) s.flash = Math.max(0, s.flash - dt * 6);
  for (const f of floats) { f.t -= dt; f.y -= 40 * dt; } while (floats.length && floats[0].t <= 0) floats.shift();
  msgT -= dt; orbitArm -= dt;
  if (state === 'play' && ball) {
    if (clock < bot.until) botThink();
    flipOn(flips[0], press.L.size > 0 || keyL.v || (botFlip[0] > clock && botWait[0] < clock));
    flipOn(flips[1], press.R.size > 0 || keyR.v || (botFlip[1] > clock && botWait[1] < clock));
    if (plungeHeld && ball.inLane) plunge = Math.min(1, plunge + dt / 0.9);
    if (ball.inLane && level <= 3 && !plungeHeld) { autoT += dt; if (autoT > 1.4) { autoT = 0; plunge = 0.85; plungeHeld = true; release(); } } else autoT = 0;
    if (!ball.inLane) saveT -= dt;
    const n = Math.ceil(dt / (1 / 700)); for (let i = 0; i < n; i++) { step(dt / n); if (!ball || ball.y > TH + 20) break; }
    if (ball) {
      ball.trail.push([ball.x, ball.y]); if (ball.trail.length > 6) ball.trail.shift();
      if (ball.y > TH + 20) drain();
      else if (!ball.inLane && Math.hypot(ball.vx, ball.vy) < 8 && !flips.some(f => Math.hypot(ball.x - f.px, ball.y - f.py) < FL + 16)) { stuckT += dt; if (stuckT > 2.5) { ball.vy = -500; ball.vx = (Math.random() - 0.5) * 300; stuckT = 0; } } else stuckT = 0;
    }
  } else { for (const f of flips) { f.on = false; f.a += ((f.rest) - f.a) * 0.3; } }
}
function frame(t) {
  const dt = Math.min(0.033, (t - last) / 1000); last = t;
  P.update(dt); SH.update(dt);
  for (let k = 0; k < warp; k++) tick(dt);
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
  if (state === 'play' || state === 'won') drawGoals();
  if (combo >= 3 && state === 'play') { const w = 120 * Math.min(1, comboT / 1.6); g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.roundRect(140, 58, 120, 8, 4); g.fill(); g.fillStyle = combo >= 8 ? '#ff5fa2' : '#ffd166'; g.beginPath(); g.roundRect(140, 58, Math.max(6, w), 8, 4); g.fill(); g.fillStyle = '#fff'; g.font = '800 11px "Baloo 2",system-ui'; g.textAlign = 'center'; g.fillText('COMBO ×' + combo, 200, 52); }
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
    g.fillStyle = d.hp > 1 ? '#9aa4c8' : gr; g.beginPath(); g.roundRect(d.x - 5, d.y - d.h, 10, d.h * 2, 3); g.fill();
    if (d.hp > 1) { g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke(); }
  }
  // table gimmicks
  for (const w of walls) { g.lineCap = 'round'; g.strokeStyle = '#7af0ff'; g.lineWidth = 8; g.beginPath(); g.moveTo(w.x1, w.y1); g.lineTo(w.x2, w.y2); g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke(); }
  if (spin) { const c = Math.cos(spin.a), sn = Math.sin(spin.a), L = 40 * Math.abs(c) + 4; g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(spin.x - 44, spin.y - 1, 88, 3); g.strokeStyle = spin.w > 2 ? '#ffd166' : '#ffb3d6'; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(spin.x - L, spin.y + sn * 3); g.lineTo(spin.x + L, spin.y + sn * 3); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(spin.x, spin.y, 4, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '800 10px "Baloo 2",system-ui'; g.textAlign = 'center'; g.fillText('SPIN', spin.x, spin.y + 22); }
  if (magnet) { const pu = 0.5 + 0.5 * Math.sin(clock * 5); glow(magnet.x, magnet.y, 8 + magnet.on * 6, `rgba(180,120,255,${0.5 + 0.4 * pu})`); g.strokeStyle = `rgba(200,160,255,${0.25 + 0.3 * pu})`; g.lineWidth = 2; g.beginPath(); g.arc(magnet.x, magnet.y, magnet.r * (0.6 + 0.4 * pu), 0, 7); g.stroke(); }
  // bumpers
  for (const b of bumpers) {
    const s = 1 + b.flash * 0.12;
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(b.x + 3, b.y + 5, b.r * s, 0, 7); g.fill();
    g.fillStyle = b.flash > 0 ? '#ffffff' : b.hot ? '#ffd166' : '#ff5fa2'; g.beginPath(); g.arc(b.x, b.y, b.r * s, 0, 7); g.fill();
    if (b.hot) { g.strokeStyle = `rgba(255,255,255,${0.5 + 0.5 * Math.sin(clock * 12)})`; g.lineWidth = 3; g.beginPath(); g.arc(b.x, b.y, b.r * s + 5, 0, 7); g.stroke(); }
    const cg = g.createRadialGradient(b.x - 6, b.y - 7, 2, b.x, b.y, b.r * 0.78 * s); cg.addColorStop(0, '#fff6d6'); cg.addColorStop(1, b.flash > 0 ? '#ffd166' : '#ffb03b');
    g.fillStyle = cg; g.beginPath(); g.arc(b.x, b.y, b.r * 0.74 * s, 0, 7); g.fill();
    g.fillStyle = '#2a1260'; g.font = '800 10px "Baloo 2",system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(b.hot ? '500' : '100', b.x, b.y + 1);
    if (b.flash > 0) { g.globalCompositeOperation = 'lighter'; const lg = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * 2.4); lg.addColorStop(0, `rgba(255,209,102,${b.flash * 0.7})`); lg.addColorStop(1, 'rgba(255,209,102,0)'); g.fillStyle = lg; g.beginPath(); g.arc(b.x, b.y, b.r * 2.4, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over'; }
  }
  // gates
  g.strokeStyle = ball && ball.inLane ? 'rgba(255,214,240,.3)' : '#ffd166'; g.lineWidth = 3; g.beginPath(); g.moveTo(gate.x1, gate.y1); g.lineTo(gate.x2, gate.y2); g.stroke();
  g.strokeStyle = 'rgba(255,214,240,.45)'; g.lineWidth = 2; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(ogate.x1, ogate.y1); g.lineTo(ogate.x2, ogate.y2); g.stroke(); g.setLineDash([]);
  // plunger
  const py = 745 + plunge * 22;
  g.fillStyle = '#5b3c9a'; g.fillRect(366, py, 18, TH - py); g.fillStyle = '#ffd166'; g.beginPath(); g.roundRect(363, py - 2, 24, 7, 3); g.fill();
  if (ball && ball.inLane && state === 'play') { g.fillStyle = `rgba(255,209,102,${0.5 + 0.5 * Math.sin(clock * 6)})`; g.font = '800 15px "Baloo 2",system-ui'; g.textAlign = 'center'; g.save(); g.translate(375, 640); g.rotate(-Math.PI / 2); g.fillText(plungeHeld ? 'RELEASE!' : (level <= 3 ? 'TAP · LAUNCH' : 'HOLD · LAUNCH'), 0, 0); g.restore(); }
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
    const bg2 = g.createRadialGradient(ball.x - 3, ball.y - 4, 1, ball.x, ball.y, BR); const sk = SKINS[skin].c; bg2.addColorStop(0, '#ffffff'); bg2.addColorStop(0.35, sk[0]); bg2.addColorStop(0.8, sk[1]); bg2.addColorStop(1, sk[2]);
    g.fillStyle = bg2; g.beginPath(); g.arc(ball.x, ball.y, BR, 0, 7); g.fill();
  }
  P.draw(g);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 15px "Baloo 2",system-ui';
  for (const f of floats) { g.globalAlpha = Math.min(1, f.t * 2.5); g.fillStyle = '#fff'; g.fillText(f.s, f.x, f.y); } g.globalAlpha = 1;
  g.restore();
}
function drawGoals() {
  g.textBaseline = 'middle'; g.textAlign = 'center'; g.font = '800 11px "Baloo 2",system-ui';
  const n = LV.goal.length, cols = n > 2 ? 2 : n, rows = Math.ceil(n / cols), w = 108;
  LV.goal.forEach((q, i) => {
    const c = i % cols, r = Math.floor(i / cols), x = 200 + (c - (cols - 1) / 2) * (w + 6), y = 36 + r * 18 - (rows - 1) * 7, done = goalDone[i];
    const cur = Math.min(q.n, q.t === 'score' ? score : (prog[q.t] || 0));
    g.fillStyle = done ? 'rgba(80,220,120,.7)' : 'rgba(0,0,0,.45)'; g.beginPath(); g.roundRect(x - w / 2, y - 8, w, 16, 8); g.fill();
    if (!done) { g.fillStyle = 'rgba(255,209,102,.55)'; g.beginPath(); g.roundRect(x - w / 2, y - 8, Math.max(8, w * cur / q.n), 16, 8); g.fill(); }
    const close = !done && cur / q.n >= 0.8 && Math.sin(clock * 9) > 0;
    if (close) { g.strokeStyle = '#ffd166'; g.lineWidth = 2; g.beginPath(); g.roundRect(x - w / 2, y - 8, w, 16, 8); g.stroke(); }
    g.fillStyle = '#fff'; g.fillText(close ? `${GI[q.t]} ${q.t === 'score' ? Math.ceil((q.n - cur) / 100) * 100 : q.n - cur} TO GO!` : `${GI[q.t]} ${q.t === 'score' ? (cur / 1000).toFixed(1) + '/' + q.n / 1000 + 'k' : cur + '/' + q.n}`, x, y + 1);
  });
}
function glow(x, y, r, col) {
  if (!col) return;
  g.globalCompositeOperation = 'lighter'; const lg = g.createRadialGradient(x, y, 0, x, y, r * 2.4); lg.addColorStop(0, col); lg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = lg; g.beginPath(); g.arc(x, y, r * 2.4, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over';
  g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
}

reset(); ui.start(); if (reach > 1 || totalStars() > 0) mapBtn.style.display = 'flex'; requestAnimationFrame(frame);

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
  get state() { return state; }, get level() { return level; }, get score() { return score; }, get ball() { return ballN; },
  get prog() { return { ...prog, done: goalDone.slice() }; }, get stars() { return stars.slice(); }, reach: () => reach,
  get dbg() { return ball ? { x: ball.x | 0, y: ball.y | 0, vx: ball.vx | 0, vy: ball.vy | 0, lane: ball.inLane, mult, orbits } : null; },
  bot() { if (state === 'play') bot.until = clock + 1.0; },
  start: n => startLevel(n), openMap: () => showMap(), openBalls: () => { showBalls(); }, warp: k => { warp = k; }, levels: NL,
  unlockAll() { reach = NL; S.set('reach', reach); },
};
