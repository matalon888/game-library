// Smooch Roll — original game. Draw ink lines that turn into real falling objects so the blue ball and the pink ball roll together and kiss.
import { createUI, input, loop, sfx, tone, buzz, store, clamp } from './kit/hc.js';
import { StrokeBuilder, makeInk, INK_R, BALL_R } from './physics.js';
import { makeLevel, buildWorld, outOfWorld, WW, WH } from './levels.js';

const TEAL = '#17a096', BLUE = '#33c3de', PINK = '#ff4f8e', INK = '#1d1d22';
const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
const save = store('smoochroll');
let level = save.get('level', 1), stars = save.get('stars', 0), state = 'ready';
const ui = createUI({ title: 'SMOOCH<br><b>ROLL</b>', hint: 'Draw a line so they meet', hand: '✏️', score: false });
ui.els.win.classList.add('lb-win');
const starEls = [...document.querySelectorAll('#stars i')];

// ---------------------------------------------------------------- view
let S = 1, OX = 0, OY = 0, DPR = 1, paper = null;
function resize() {
  DPR = Math.min(devicePixelRatio || 1, 2);
  cv.width = innerWidth * DPR; cv.height = innerHeight * DPR;
  S = Math.min(innerWidth / WW, innerHeight / WH); OX = (innerWidth - WW * S) / 2; OY = Math.max(0, (innerHeight - WH * S) * 0.6);
  paper = null;
}
addEventListener('resize', resize); resize();
const toWorld = (x, y) => ({ x: (x - OX) / S, y: (y - OY) / S });

// ---------------------------------------------------------------- level state
const cache = new Map();
const getLevel = (n) => { if (!cache.has(n)) cache.set(n, makeLevel(n)); return cache.get(n); };
let worker = null, asked = new Set();
try { worker = new Worker(new URL('./gen.js', import.meta.url), { type: 'module' }); worker.onmessage = (e) => { if (!cache.has(e.data.n)) cache.set(e.data.n, e.data.L); }; } catch (e) { worker = null; }
function prefetch(n) { if (cache.has(n) || asked.has(n)) return; asked.add(n); if (worker) worker.postMessage(n); }
let L, world, balls, inks, inkUsed, running, sb = null, drawing = false, pen = null, rest = 0, acc = 0, t = 0, touched = false;
let hearts = [], rings = [], dust = [], botI = 0, botOn = false, firstDraw = true, doodles = [], lastTick = 0, inkShake = 0;

function loadLevel() {
  L = getLevel(level);
  world = buildWorld(L); balls = world.balls; inks = [];
  for (const b of balls) { b.sq = 0; b.sqa = 0; b.mood = 'idle'; b.trail = []; b.blink = Math.random() * 3; }
  world.touch = () => { touched = true; };
  world.onHit = (A, B, v, nx, ny) => {
    for (const b of [A, B]) if (b && b.kind === 'ball') { b.sq = Math.max(b.sq, Math.min(0.28, v / 1500)); b.sqa = Math.atan2(ny, nx); }
    if (v > 260 && t - lastTick > 0.06) { lastTick = t; sfx.bounce(); buzz(8); }
  };
  inkUsed = 0; running = false; sb = null; drawing = false; pen = null; rest = 0; acc = 0; touched = false;
  hearts = []; rings = []; dust = []; botI = 0; botOn = false; firstDraw = true;
  ui.levels(level); ui.progress(1); setStars(3);
  ui.sub(level <= 2 ? 'Draw a line so they meet!' : '');
  makeDoodles();
  prefetch(level + 1); prefetch(level + 2);     // pre-solve upcoming levels off the main thread
}
const inkLeft = () => Math.max(0, L.budget - inkUsed - (sb ? sb.used : 0));
function starCount() { const f = inkLeft() / L.budget; return f >= 0.3 ? 3 : f >= 0.12 ? 2 : 1; }
function setStars(n) { starEls.forEach((e, i) => e.classList.toggle('off', i >= n)); }

// ---------------------------------------------------------------- drawing
function beginStroke(x, y) {
  if (state !== 'play') return;
  if (inkLeft() < 2) { inkShake = 1; sfx.fail(); buzz(20); return; }
  sb = new StrokeBuilder(world, inkLeft()); drawing = true; firstDraw = false; ui.sub('');
  addPoint(x, y);
}
let scratch = 0;
function addPoint(x, y) {
  if (!drawing || !sb) return;
  const before = sb.used; sb.add(x, y); pen = { x, y };
  scratch += sb.used - before;
  if (scratch > 26) { scratch = 0; tone(1500 + Math.random() * 500, 0.018, 'square', 0.018, 0.7); }
  ui.progress(inkLeft() / L.budget); setStars(starCount());
  if (inkLeft() < 1) endStroke();
}
function endStroke() {
  if (!drawing) return;
  drawing = false; pen = null;
  if (sb && sb.samples.length >= 3) {
    const b = makeInk(sb.samples); world.add(b); inks.push(b); inkUsed += sb.used;
    if (!running) { running = true; sfx.pick(3); }
    else sfx.pick(1);
    buzz(10);
  }
  sb = null; ui.progress(inkLeft() / L.budget); setStars(starCount());
}
input({
  onDown: (e) => { const p = toWorld(e.clientX, e.clientY); beginStroke(p.x, p.y); },
  onMove: (dx, dy, e) => { if (drawing && !botOn) { const p = toWorld(e.clientX, e.clientY); addPoint(p.x, p.y); } },
  onUp: () => { if (!botOn) endStroke(); },
});
document.getElementById('retry').addEventListener('pointerdown', (e) => {
  e.stopPropagation(); if (state !== 'play') return; sfx.tap(); loadLevel();
});

// ---------------------------------------------------------------- outcomes
function win() {
  state = 'won'; running = false;
  const [a, b] = balls, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, ang = Math.atan2(b.y - a.y, b.x - a.x);
  for (const q of balls) { q.mood = 'love'; q.sq = 0.22; }
  a.sqa = ang; b.sqa = ang;
  for (let i = 0; i < 34; i++) { const an = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 260;
    hearts.push({ x: mx, y: my, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp - 120, s: 6 + Math.random() * 9, life: 1 + Math.random() * 0.6, rot: (Math.random() - 0.5) * 0.8 }); }
  hearts.push({ x: mx, y: my - 30, vx: 0, vy: -40, s: 26, life: 1.8, rot: 0, big: true });
  rings.push({ x: mx, y: my, r: 10, life: 1 }); rings.push({ x: mx, y: my, r: 0, life: 1.25 });
  const n = starCount(); stars += n; save.set('stars', stars);
  ui.flash(0.35); buzz([25, 40, 25]); sfx.win(); setTimeout(() => tone(1250, 0.09, 'sine', 0.13, 1.7), 60);
  ui.pop(n === 3 ? 'PERFECT!' : n === 2 ? 'SWEET!' : 'PHEW!', n === 3 ? '#ff4f8e' : '#2fbfd9', 42, 36);
  level++; save.set('level', level);
  ui.win(level - 1, '★'.repeat(n) + '☆'.repeat(3 - n));
}
function lose(line) {
  state = 'lost'; running = false;
  for (const q of balls) q.mood = 'sad';
  sfx.fail(); buzz([40, 30, 40]);
  ui.lose('OOPS!', line);
}
ui.onTap((which) => {
  if (which === 'win') loadLevel();
  if (which === 'lose') loadLevel();
  state = 'play';
});

// ---------------------------------------------------------------- bot: draws the stroke the level validator proved works
function bot() {
  if (state !== 'play' || running || (drawing && !botOn)) return;
  const sol = L.solution;
  if (!botOn) { botOn = true; botI = 0; beginStroke(sol[0].x, sol[0].y); botI = 1; return; }
  const n = Math.ceil(sol.length / 7);
  for (let k = 0; k < n && botI < sol.length; k++, botI++) addPoint(sol[botI].x, sol[botI].y);
  if (botI >= sol.length) { endStroke(); botOn = false; }
}
window.__game = { get state() { return state; }, get level() { return level; }, get score() { return stars; }, bot, get L() { return L; }, dbg: () => ({ drawing, botOn, inks: inks.length, inkUsed, sb: sb && sb.samples.length, running, S, OX, OY }),
  load(n) { level = n; ui.hideStart(); ui.els.win.classList.add('hc-hidden'); ui.els.lose.classList.add('hc-hidden'); loadLevel(); state = 'play'; } };

// ---------------------------------------------------------------- simulation tick
function tick(dt) {
  t += dt / 60;
  if (state === 'play' && running) {
    acc += dt / 60; let n = 0;
    while (acc >= 1 / 60 && n < 3) {
      acc -= 1 / 60; n++;
      world.step(1 / 60);
      if (touched) { win(); break; }
      if (balls.some(outOfWorld)) { lose('They rolled away…'); break; }
    }
    if (acc > 0.1) acc = 0;
    for (let i = inks.length - 1; i >= 0; i--) if (inks[i].y > WH + 400) { world.remove(inks[i]); inks.splice(i, 1); }
    if (state === 'play') {
      rest = world.energy() < 8 ? rest + dt / 60 : 0;
      if ((rest > 2.5 && inkLeft() < L.budget * 0.15) || rest > 6) lose('So close! Try another line');
    }
  }
  for (const b of balls) {
    b.sq *= Math.pow(0.86, dt);
    if (state === 'play') b.mood = running && b.vy > 380 ? 'fall' : 'idle';
    b.blink -= dt / 60; if (b.blink < -0.12) b.blink = 2 + Math.random() * 3;
    if (Math.floor(t * 60) % 3 === 0) { b.trail.push({ x: b.x, y: b.y }); if (b.trail.length > 4) b.trail.shift(); }
  }
  const k = dt / 60;
  for (const h of hearts) { h.vy += (h.big ? -10 : 380) * k; h.vx *= 0.985; h.x += h.vx * k; h.y += h.vy * k; h.life -= k * 0.8; }
  hearts = hearts.filter(h => h.life > 0);
  for (const r of rings) { r.r += (190 - r.r) * 0.06 * dt; r.life -= k * 0.9; }
  rings = rings.filter(r => r.life > 0);
  inkShake = Math.max(0, inkShake - k * 3);
}

// ---------------------------------------------------------------- art
function makeDoodles() {
  let s = level * 131 + 7; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const kinds = ['cloud', 'tree', 'star', 'cat', 'house', 'flower', 'sun', 'bunting'];
  doodles = [];
  for (let i = 0; i < 6; i++) doodles.push({ k: kinds[Math.floor(R() * kinds.length)], x: 30 + R() * 340, y: 150 + (i / 6) * 620 + R() * 60, s: 0.8 + R() * 0.6, r: (R() - 0.5) * 0.3 });
  paper = null;
}
function doodle(c, d) {
  c.save(); c.translate(d.x, d.y); c.rotate(d.r); c.scale(d.s, d.s); c.beginPath();
  switch (d.k) {
    case 'cloud': c.arc(-18, 0, 12, Math.PI * 0.5, Math.PI * 1.5); c.arc(-4, -10, 14, Math.PI, Math.PI * 1.9); c.arc(14, -2, 12, Math.PI * 1.3, Math.PI * 0.5); c.closePath(); break;
    case 'tree': for (let i = 0; i < 3; i++) { c.moveTo(0, -40 + i * 16); c.lineTo(-14 - i * 6, -18 + i * 16); c.lineTo(14 + i * 6, -18 + i * 16); c.closePath(); } c.moveTo(0, 30); c.lineTo(0, 46); break;
    case 'star': for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 7 : 17; i ? c.lineTo(Math.cos(a) * r, Math.sin(a) * r) : c.moveTo(Math.cos(a) * r, Math.sin(a) * r); } break;
    case 'cat': c.arc(0, 0, 20, 0, Math.PI * 2); c.moveTo(-18, -8); c.lineTo(-16, -30); c.lineTo(-4, -19); c.moveTo(18, -8); c.lineTo(16, -30); c.lineTo(4, -19);
      c.moveTo(-8, -3); c.arc(-8, -3, 2, 0, 7); c.moveTo(10, -3); c.arc(8, -3, 2, 0, 7); c.moveTo(-26, 4); c.lineTo(-10, 6); c.moveTo(26, 4); c.lineTo(10, 6); break;
    case 'house': c.rect(-18, -10, 36, 30); c.moveTo(-24, -8); c.lineTo(0, -30); c.lineTo(24, -8); c.rect(-5, 6, 10, 14); break;
    case 'flower': for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; c.moveTo(Math.cos(a) * 14 + 7, Math.sin(a) * 14); c.arc(Math.cos(a) * 14, Math.sin(a) * 14, 7, 0, 7); } c.moveTo(0, 20); c.quadraticCurveTo(4, 40, 0, 56); break;
    case 'sun': c.arc(0, 0, 13, 0, 7); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; c.moveTo(Math.cos(a) * 19, Math.sin(a) * 19); c.lineTo(Math.cos(a) * 28, Math.sin(a) * 28); } break;
    case 'bunting': c.moveTo(-40, -10); c.quadraticCurveTo(0, 10, 40, -10); for (let i = 0; i < 4; i++) { const x = -30 + i * 20, y = -3 + (i === 1 || i === 2 ? 4 : 0); c.moveTo(x - 6, y); c.lineTo(x, y + 14); c.lineTo(x + 6, y); } break;
  }
  c.stroke(); c.restore();
}
function buildPaper() {
  paper = document.createElement('canvas'); paper.width = cv.width; paper.height = cv.height;
  const c = paper.getContext('2d');
  c.fillStyle = '#fbfcfc'; c.fillRect(0, 0, paper.width, paper.height);
  c.scale(DPR, DPR);
  const gap = 30 * S; c.strokeStyle = 'rgba(96, 196, 214, .28)'; c.lineWidth = 1.2;
  for (let y = OY % gap + gap * 0.5; y < innerHeight; y += gap) { c.beginPath(); c.moveTo(0, y); c.lineTo(innerWidth, y); c.stroke(); }
  c.strokeStyle = 'rgba(255, 120, 140, .22)'; c.beginPath(); c.moveTo(OX + 26 * S, 0); c.lineTo(OX + 26 * S, innerHeight); c.stroke();
  c.translate(OX, OY); c.scale(S, S);
  c.strokeStyle = 'rgba(110, 125, 135, .16)'; c.lineWidth = 2; c.lineJoin = c.lineCap = 'round';
  for (const d of doodles) doodle(c, d);
}

function staticPath(c, s, dy = 0) {
  c.beginPath();
  if (s.t === 'c') c.arc(s.x, s.y + dy, s.r, 0, Math.PI * 2);
  else if (s.t === 's') { c.lineWidth = s.r * 2; c.moveTo(s.ax, s.ay + dy); c.lineTo(s.bx, s.by + dy); }
  else { c.save(); c.translate(s.x, s.y + dy); c.rotate(s.a); const r = Math.min(5, s.hh); c.roundRect(-s.hw, -s.hh, s.hw * 2, s.hh * 2, r); c.restore(); }
}
function drawStatics() {
  for (const s of world.statics) {
    staticPath(ctx, s, 5); ctx.fillStyle = 'rgba(20, 60, 70, .08)'; ctx.fill();
    staticPath(ctx, s); ctx.fillStyle = TEAL; ctx.fill();
    // soft top highlight
    if (s.t === 'c') { ctx.beginPath(); ctx.arc(s.x - s.r * 0.3, s.y - s.r * 0.35, s.r * 0.42, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fill(); }
  }
}
function inkPath(c, parts) {
  c.beginPath();
  for (let i = 0; i < parts.length; i++) { const p = parts[i], x = p.lx ?? p.x, y = p.ly ?? p.y; if (!p.link) { c.moveTo(x, y); c.lineTo(x + 0.01, y); } else c.lineTo(x, y); }
}
function drawInk() {
  ctx.lineCap = ctx.lineJoin = 'round'; ctx.lineWidth = INK_R * 2;
  for (const b of inks) {
    ctx.save(); ctx.translate(b.x, b.y + 3); ctx.rotate(b.a); inkPath(ctx, b.parts); ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.stroke(); ctx.restore();
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a); inkPath(ctx, b.parts); ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
  }
  if (sb && sb.samples.length) { inkPath(ctx, sb.samples); ctx.strokeStyle = INK; ctx.stroke(); }
}
function pencil(x, y, a = -0.62) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.lineJoin = 'round';
  ctx.fillStyle = '#f2d7a8'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-7, -16); ctx.lineTo(7, -16); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2b2b30'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-2.6, -6); ctx.lineTo(2.6, -6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffc928'; ctx.fillRect(-7, -70, 14, 54); ctx.fillStyle = '#f0a91a'; ctx.fillRect(2.5, -70, 4.5, 54);
  ctx.fillStyle = '#c9d2d8'; ctx.fillRect(-7, -80, 14, 10); ctx.fillStyle = '#ff8fa8'; ctx.beginPath(); ctx.roundRect(-7, -92, 14, 13, 4); ctx.fill();
  ctx.restore();
}
function heart(c, x, y, s) {
  c.beginPath(); c.moveTo(x, y + s * 0.35);
  c.bezierCurveTo(x - s * 1.1, y - s * 0.35, x - s * 0.45, y - s * 1.05, x, y - s * 0.45);
  c.bezierCurveTo(x + s * 0.45, y - s * 1.05, x + s * 1.1, y - s * 0.35, x, y + s * 0.35); c.fill();
}
function drawBall(b, other, col) {
  const r = b.r;
  for (let i = 0; i < b.trail.length - 1; i++) {      // ghost trail like a motion smear
    const g = b.trail[i]; if (Math.hypot(b.x - g.x, b.y - g.y) < 10) continue;
    ctx.globalAlpha = 0.1 + i * 0.05; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(g.x, g.y, r * (0.86 + i * 0.04), 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.save(); ctx.translate(b.x, b.y);
  ctx.rotate(b.sqa); ctx.scale(1 - b.sq, 1 + b.sq * 0.6); ctx.rotate(-b.sqa);
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.beginPath(); ctx.ellipse(-r * 0.38, -r * 0.42, r * 0.28, r * 0.17, -0.6, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.07)'; ctx.beginPath(); ctx.arc(0, 0, r, 0.15 * Math.PI, 0.85 * Math.PI); ctx.arc(0, -r * 0.25, r * 1.02, 0.8 * Math.PI, 0.2 * Math.PI, true); ctx.fill();
  // face looks toward the partner
  const dx = other.x - b.x, dy = other.y - b.y, d = Math.hypot(dx, dy) || 1, lx = dx / d, ly = dy / d;
  const fx = lx * r * 0.16, fy = ly * r * 0.1 - r * 0.05;
  ctx.lineWidth = 1.8; ctx.strokeStyle = '#111'; ctx.lineCap = 'round';
  const mood = b.mood, eye = (ex) => {
    const x = fx + ex, y = fy - r * 0.05;
    if (mood === 'love') { ctx.beginPath(); ctx.arc(x, y + 2, r * 0.15, Math.PI * 1.1, Math.PI * 1.9); ctx.lineWidth = 2.6; ctx.stroke(); return; }
    const er = mood === 'fall' ? r * 0.27 : r * 0.24;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, er, 0, 7); ctx.fill(); ctx.lineWidth = 1.6; ctx.stroke();
    if (b.blink < 0 && mood === 'idle') { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, er + 1, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(x - er, y); ctx.lineTo(x + er, y); ctx.stroke(); return; }
    const pr = mood === 'fall' ? r * 0.09 : r * 0.13, px = x + (mood === 'fall' ? 0 : lx * er * 0.42), py = y + (mood === 'fall' ? -er * 0.3 : ly * er * 0.42);
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(px, py, pr, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px - pr * 0.35, py - pr * 0.35, pr * 0.35, 0, 7); ctx.fill();
    if (mood === 'sad') { ctx.fillStyle = col; ctx.beginPath(); ctx.rect(x - er - 2, y - er - 2, er * 2 + 4, er * 0.9); ctx.fill(); ctx.beginPath(); ctx.moveTo(x - er, y - er * 0.1); ctx.lineTo(x + er, y - er * 0.1); ctx.stroke(); }
  };
  eye(-r * 0.32); eye(r * 0.32);
  const my = fy + r * 0.42;
  if (mood === 'fall') { ctx.fillStyle = '#3a1020'; ctx.beginPath(); ctx.ellipse(fx, my, r * 0.09, r * 0.13, 0, 0, 7); ctx.fill(); }
  else if (mood === 'love') {
    ctx.fillStyle = 'rgba(255, 90, 120, .45)'; ctx.beginPath(); ctx.ellipse(fx - r * 0.5, my - 3, r * 0.15, r * 0.09, 0, 0, 7); ctx.ellipse(fx + r * 0.5, my - 3, r * 0.15, r * 0.09, 0, 0, 7); ctx.fill();
    ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(fx + lx * 3, my - 2, r * 0.16, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  } else if (mood === 'sad') { ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(fx, my + 6, r * 0.14, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
    ctx.fillStyle = '#8fd8ff'; ctx.beginPath(); ctx.ellipse(fx - r * 0.42, fy + r * 0.25 + (t * 30 % 10), 2.6, 3.6, 0, 0, 7); ctx.fill(); }
  ctx.restore();
}

function render() {
  if (!paper) buildPaper();
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(paper, 0, 0);
  ctx.setTransform(DPR * S, 0, 0, DPR * S, DPR * OX, DPR * OY);
  for (const r of rings) { ctx.globalAlpha = Math.max(0, Math.min(1, r.life)) * 0.8; ctx.strokeStyle = '#ff9fae'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, 7); ctx.stroke(); }
  ctx.globalAlpha = 1;
  drawStatics();
  // tutorial hint: dotted solution with a pencil tracing it
  if (firstDraw && level <= 2 && state !== 'won') {
    const sol = L.solution; ctx.setLineDash([2, 11]); ctx.lineCap = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(30,30,40,.22)';
    ctx.beginPath(); sol.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); ctx.setLineDash([]);
    if (state === 'play') { const f = (t * 0.55) % 1.25, p = sol[Math.min(sol.length - 1, Math.floor(Math.min(1, f) * (sol.length - 1)))]; ctx.globalAlpha = f > 1 ? 1 - (f - 1) * 4 : 1; pencil(p.x, p.y); ctx.globalAlpha = 1; }
  }
  drawInk();
  const [a, b] = balls; drawBall(a, b, BLUE); drawBall(b, a, PINK);
  for (const h of hearts) { ctx.globalAlpha = Math.min(1, h.life * 1.5); ctx.fillStyle = h.big ? '#ff3f7f' : (h.s > 11 ? '#ff6f8f' : '#ff3d6a'); heart(ctx, h.x, h.y, h.s * (h.big ? Math.min(1, (1.8 - h.life) * 4) : 1)); }
  ctx.globalAlpha = 1;
  if (pen && drawing) pencil(pen.x, pen.y);
}

loop((dt) => {
  tick(dt); render();
  if (inkShake > 0) { const bar = ui.els.top; bar.classList.add('shake'); setTimeout(() => bar.classList.remove('shake'), 350); inkShake = 0; }
});
loadLevel(); ui.start();
