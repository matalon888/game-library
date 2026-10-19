// Rungrush — the classic race to 100 on a 10×10 board: climb the ladders, whoosh down the playground slides.
// You vs 1–3 CPU racers. Pure luck, fair dice (crypto random; ?daily=1 uses one seeded dice stream for everyone today).
// Land exactly on 100 to win; an overshoot bounces back. Wins vs CPU go on the world board.
import { createUI, store, buzz, tone, note, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { css, cardTheme, startCard, fx2d, arp, soft } from './calm.js';

const NAME = 'Rungrush: Ladders and Slides Board Game';
const S = store('rungrush');
const F = flow('rungrush');   // recorded only: a pure-luck race has no difficulty knob to turn (FLOW_BRIEF rule 4)
const ui = createUI({ title: 'Rungrush', hint: 'Tap to play', hand: '', score: false, progress: false });
cardTheme({ accent: '#ff7a45' });
const D = daily('rungrush', ui, { name: NAME });
const B = board({ game: 'rungrush', label: 'Wins vs CPU', limits: { maxRun: 1, maxPerSec: 0.1 }, mode: 'sum', corner: 'tl' });
const fx = fx2d(11);
let cpus = D.isDaily ? 3 : S.get('cpus', 1);
startCard(ui, D, {
  kicker: D.isDaily ? 'Daily race · same dice for all' : 'ladders & slides',
  chips: D.isDaily ? null : { items: ['vs 1 CPU', 'vs 2 CPUs', 'vs 3 CPUs'], get: () => cpus - 1, set: i => { cpus = i + 1; S.set('cpus', cpus); } },
});
{ const p = document.createElement('p'); p.textContent = 'Roll, climb the ladders, dodge the slides. First to 100 wins!'; p.style.cssText = 'font-size:15px;opacity:.8;margin-top:12px;max-width:320px'; ui.els.start.querySelector('.hint').before(p); }
ui.els.win.querySelector('p').innerHTML = 'Race <span data-l>1</span>';
ui.els.win.querySelector('h1').textContent = 'You win!';

// original layout: 7 ladders up, 9 slides down
const LADDERS = { 4: 25, 13: 46, 33: 49, 42: 63, 50: 69, 62: 81, 74: 92 };
const SLIDES = { 27: 5, 40: 3, 43: 18, 54: 31, 66: 45, 76: 58, 89: 53, 95: 75, 99: 41 };
const SLIDE_COL = [['#ff7fa8', '#ffc2d6'], ['#4fb8ff', '#b9e3ff'], ['#ffb547', '#ffe0a8'], ['#9b7bff', '#d8cbff'], ['#3ccf9a', '#b6f0db']];
const RACERS = [
  { name: 'You', c: '#ff6b4a', d: '#c94a2e', face: 'you' },
  { name: 'Moss', c: '#34c38f', d: '#1f8c64' },
  { name: 'Juno', c: '#5a8dff', d: '#3a63c4' },
  { name: 'Taro', c: '#ffc53d', d: '#c9921a' },
];
const INK = '#3b2f2a';

css(`
body{background:linear-gradient(180deg,#bfe7ff 0%,#fff1dc 60%,#ffe3c4 100%);color:${INK}}
#rg{position:fixed;inset:0;width:100%;height:100%;z-index:2;touch-action:none}
.hc-pop{color:${INK}!important;text-shadow:0 0 14px #fff,0 0 4px #fff!important}
`);
const cv = document.createElement('canvas'); cv.id = 'rg'; document.body.appendChild(cv);
const g = cv.getContext('2d');
const bgc = document.createElement('canvas'), bg = bgc.getContext('2d');

// ---------------------------------------------------------------- state
let state = 'ready', players = [], turn = 0, phase = 'idle', die = { v: 6, rolling: 0, at: 0, face: 6, spin: 0 }, races = S.get('races', 0), wins = S.get('wins', 0);
let roll = null, recorded = false, t0 = 0, anim = null, msg = '', beatenShown = false, lastMove = 0;
const cryptoDie = () => { const a = new Uint32Array(1); let v; do { crypto.getRandomValues(a); v = a[0]; } while (v >= 4294967292); return 1 + (v % 6); };

function newRace() {
  races++; S.set('races', races);
  roll = D.seed ? (() => { const r = rng(D.seed * 11 + 5); return () => 1 + Math.floor(r() * 6); })() : cryptoDie;
  const n = (D.isDaily ? 3 : cpus) + 1;
  players = RACERS.slice(0, n).map((r, i) => ({ ...r, i, pos: 0, x: 0, y: 0, hop: 0, sq: 1, cpu: i > 0, lad: 0, sli: 0 }));
  players.forEach(p => { const [x, y] = startSpot(p.i); p.x = x; p.y = y; });
  turn = 0; phase = 'await'; recorded = false; anim = null; msg = 'Your turn · tap the die';
  state = 'play'; t0 = performance.now(); B.start(); layout();
}
function startSpot(i) { const { x, y, c } = geo; return [x - c * 0.05 + i * c * 0.42 + c * 0.3, y + c * 10 + c * 0.55]; }
const sqCenter = n => { const r = ((n - 1) / 10) | 0, k = (n - 1) % 10, col = r % 2 === 0 ? k : 9 - k; return [geo.x + (col + 0.5) * geo.c, geo.y + (9 - r + 0.5) * geo.c]; };
function spot(p) {
  if (p.pos === 0) return startSpot(p.i);
  const [x, y] = sqCenter(p.pos), same = players.filter(q => q.pos === p.pos);
  if (same.length < 2) return [x, y];
  const k = same.indexOf(p), a = k / same.length * Math.PI * 2 + 0.6, rr = geo.c * 0.2;
  return [x + Math.cos(a) * rr, y + Math.sin(a) * rr];
}

function tapRoll() {
  if (state !== 'play' || phase !== 'await' || players[turn].cpu) return;
  doRoll();
}
function doRoll() {
  phase = 'rolling'; die.rolling = 1; die.at = performance.now(); die.v = roll();
  const p = players[turn];
  for (let k = 0; k < 6; k++) setTimeout(() => tone(260 + Math.random() * 200, 0.03, 'square', 0.05, 0.6), k * 70);
  buzz(8);
  setTimeout(() => {
    die.rolling = 0; die.face = die.v; tone(520, 0.06, 'triangle', 0.1, 1.2); buzz(12);
    if (!p.cpu) fx.sparks(geo.dieX, geo.dieY, ['#fff', p.c], 8, { speed: 2.5 });
    msg = `${p.cpu ? p.name : 'You'} rolled ${die.v}`;
    setTimeout(() => move(p, die.v), 140);
  }, p.cpu ? 380 : 520);
}
function move(p, n) {
  phase = 'moving';
  const path = []; let pos = p.pos;
  for (let k = 0; k < n; k++) { if (pos === 0 && k === 0) pos = 1; else if (pos + 1 <= 100 && !path.bounce) pos++; else { path.bounce = true; pos--; } path.push(pos); }
  if (p.pos === 0) { /* first step from the start lands on 1 */ }
  let k = 0;
  const step = () => {
    if (k >= path.length) return land(p);
    p.pos = path[k++]; p.hop = performance.now();
    tone(440 + p.pos * 4, 0.05, 'sine', 0.08, 1.3); if (!p.cpu) buzz(4);
    setTimeout(step, p.cpu ? 115 : 135);
  };
  step();
}
function land(p) {
  const up = LADDERS[p.pos], down = SLIDES[p.pos];
  if (up) {
    const from = p.pos; msg = `${p.cpu ? p.name : 'You'} climbed a ladder! ${from} → ${up}`;
    anim = { p, kind: 'ladder', from, to: up, at: performance.now(), dur: 260 + (up - from) * 11 };
    arp([60, 64, 67, 72, 76], 60, 0.09, 0.4); if (!p.cpu) { ui.pop('LADDER!', '#ff7a45', 36, 22); buzz([10, 20, 10]); }
    return;
  }
  if (down) {
    const from = p.pos; msg = `${p.cpu ? p.name : 'You'} slid down! ${from} → ${down}`;
    anim = { p, kind: 'slide', from, to: down, at: performance.now(), dur: 380 + (from - down) * 9 };
    tone(900, 0.6, 'sine', 0.08, 0.3); if (!p.cpu) { ui.pop('WHEEE!', '#5a8dff', 34, 22); buzz(20); }
    return;
  }
  afterMove(p);
}
function afterMove(p) {
  if (p.pos === 100) return finish(p);
  turn = (turn + 1) % players.length; phase = 'await';
  const q = players[turn];
  if (q.cpu) { msg = `${q.name} is rolling…`; setTimeout(() => { if (state === 'play' && phase === 'await' && turn === q.i) doRoll(); }, 260); }
  else { msg = 'Your turn · tap the die'; tone(880, 0.05, 'sine', 0.05, 1.1); }
}
function finish(p) {
  phase = 'over'; state = p.cpu ? 'lost' : 'won';
  const [x, y] = sqCenter(100);
  fx.sparks(x, y, [p.c, '#fff', '#ffd23f'], 30, { speed: 5 });
  if (!recorded) { recorded = true; F.level(!p.cpu, players[0].pos / 100); }
  if (!p.cpu) {
    wins++; S.set('wins', wins); B.submit(1, { ms: performance.now() - t0 });
    arp([67, 72, 76, 79, 84, 88], 90, 0.12, 0.8); buzz([20, 40, 20]); setTimeout(() => fx.confetti(), 200);
    if (!beatenShown && D.beaten(wins)) { beatenShown = true; setTimeout(() => ui.pop('BEATEN!', INK, 40, 30), 400); }
    D.won(wins, 'won'); ui.win(races, `First to 100 · ${wins} win${wins === 1 ? '' : 's'} vs CPU`);
  } else {
    [67, 64, 60].forEach((n, i) => setTimeout(() => note(n, 0.35, 0.1), i * 150));
    ui.lose(`${p.name} wins!`, `You reached square ${players[0].pos}. Race again?`);
  }
}
ui.onTap(() => newRace());

// ---------------------------------------------------------------- layout + board art (pre-rendered)
let dpr = 1, W = 0, H = 0, geo = { x: 0, y: 0, c: 36, s: 360, dieX: 0, dieY: 0, dieS: 70 };
function layout() {
  dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr;
  const dieS = 72, s = Math.floor(Math.min(W - 20, (H - 100 - 190) / 1.11, 600) / 10) * 10, c = s / 10;
  const top = Math.round(100 + Math.max(0, H - 100 - s * 1.11 - 190) * 0.4), chipY = top + s + c * 1.1 + 6;
  geo = { x: Math.round((W - s) / 2), y: top, c, s, chipY, dieX: W / 2, dieY: chipY + 58 + dieS / 2, dieS };
  renderBoard();
  players.forEach(p => { const [x, y] = spot(p); p.x = x; p.y = y; });
}
addEventListener('resize', layout);
function rr(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function slideCurve(a, b) {
  const [x1, y1] = sqCenter(a), [x2, y2] = sqCenter(b), dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L, w = Math.min(L * 0.28, geo.c * 1.6) * (a % 2 ? 1 : -1);
  return [x1, y1, x1 + dx * 0.3 + nx * w, y1 + dy * 0.3 + ny * w, x1 + dx * 0.7 - nx * w, y1 + dy * 0.7 - ny * w, x2, y2];
}
function bez(P, t) { const u = 1 - t; return [u * u * u * P[0] + 3 * u * u * t * P[2] + 3 * u * t * t * P[4] + t * t * t * P[6], u * u * u * P[1] + 3 * u * u * t * P[3] + 3 * u * t * t * P[5] + t * t * t * P[7]]; }
function renderBoard() {
  const { x, y, c, s } = geo;
  bgc.width = W * dpr; bgc.height = H * dpr; bg.setTransform(dpr, 0, 0, dpr, 0, 0); bg.clearRect(0, 0, W, H);
  // frame
  bg.save(); bg.shadowColor = 'rgba(90,50,20,.25)'; bg.shadowBlur = 26; bg.shadowOffsetY = 10; rr(bg, x - 9, y - 9, s + 18, s + 18, 18); bg.fillStyle = '#fff8ee'; bg.fill(); bg.restore();
  rr(bg, x - 9, y - 9, s + 18, s + 18, 18); bg.strokeStyle = '#f1d9bd'; bg.lineWidth = 3; bg.stroke();
  bg.save(); rr(bg, x, y, s, s, 10); bg.clip();
  const PAL = ['#fff3d6', '#ffe1cc', '#e3f5d6', '#d9efff', '#efe2ff'];
  for (let n = 1; n <= 100; n++) {
    const [cx, cy] = sqCenter(n), r = ((n - 1) / 10) | 0, k = (n - 1) % 10;
    bg.fillStyle = (r + k) % 2 ? PAL[(r + ((k / 2) | 0)) % 5] : '#fffaf2'; bg.fillRect(cx - c / 2, cy - c / 2, c, c);
    bg.fillStyle = 'rgba(80,50,30,.42)'; bg.font = `700 ${Math.max(8, Math.round(c * 0.24))}px -apple-system,system-ui,sans-serif`; bg.textAlign = 'left'; bg.textBaseline = 'top';
    bg.fillText(n, cx - c / 2 + 3, cy - c / 2 + 2);
  }
  // goal square
  { const [cx, cy] = sqCenter(100); bg.fillStyle = '#ffd23f'; bg.fillRect(cx - c / 2, cy - c / 2, c, c); star(bg, cx, cy + 2, c * 0.3, '#fff'); }
  { const [cx, cy] = sqCenter(1); bg.fillStyle = 'rgba(255,122,69,.25)'; bg.fillRect(cx - c / 2, cy - c / 2, c, c); }
  bg.restore();
  // slides (under ladders)
  Object.entries(SLIDES).forEach(([a, b], i) => {
    const P = slideCurve(+a, b), [c1, c2] = SLIDE_COL[i % SLIDE_COL.length];
    const path = () => { bg.beginPath(); bg.moveTo(P[0], P[1]); bg.bezierCurveTo(P[2], P[3], P[4], P[5], P[6], P[7]); };
    bg.lineCap = 'round';
    bg.save(); bg.shadowColor = 'rgba(60,30,20,.28)'; bg.shadowBlur = 6; bg.shadowOffsetY = 3; path(); bg.strokeStyle = '#fff'; bg.lineWidth = c * 0.46; bg.stroke(); bg.restore();
    path(); bg.strokeStyle = c1; bg.lineWidth = c * 0.38; bg.stroke();
    path(); bg.strokeStyle = c2; bg.lineWidth = c * 0.14; bg.stroke();
    bg.setLineDash([c * 0.1, c * 0.28]); path(); bg.strokeStyle = 'rgba(255,255,255,.7)'; bg.lineWidth = c * 0.3; bg.stroke(); bg.setLineDash([]);
    // top platform + landing puddle
    bg.fillStyle = c1; bg.beginPath(); bg.arc(P[0], P[1], c * 0.26, 0, 7); bg.fill(); bg.strokeStyle = '#fff'; bg.lineWidth = 2.5; bg.stroke();
    bg.fillStyle = 'rgba(255,255,255,.9)'; bg.beginPath(); bg.ellipse(P[6], P[7] + c * 0.08, c * 0.3, c * 0.14, 0, 0, 7); bg.fill();
    bg.fillStyle = c1; bg.beginPath(); bg.ellipse(P[6], P[7] + c * 0.08, c * 0.2, c * 0.09, 0, 0, 7); bg.fill();
  });
  // ladders
  for (const [a, b] of Object.entries(LADDERS)) {
    const [x1, y1] = sqCenter(+a), [x2, y2] = sqCenter(b), dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), nx = -dy / L * c * 0.17, ny = dx / L * c * 0.17;
    const rail = (sx, col, w) => { bg.beginPath(); bg.moveTo(x1 + nx * sx, y1 + ny * sx); bg.lineTo(x2 + nx * sx, y2 + ny * sx); bg.strokeStyle = col; bg.lineWidth = w; bg.lineCap = 'round'; bg.stroke(); };
    bg.save(); bg.shadowColor = 'rgba(60,30,10,.35)'; bg.shadowBlur = 5; bg.shadowOffsetX = 2; bg.shadowOffsetY = 3;
    const rungs = Math.max(3, Math.round(L / (c * 0.34)));
    for (let k = 1; k < rungs; k++) { const t = k / rungs, px = x1 + dx * t, py = y1 + dy * t; bg.beginPath(); bg.moveTo(px - nx, py - ny); bg.lineTo(px + nx, py + ny); bg.strokeStyle = '#c98a4e'; bg.lineWidth = c * 0.09; bg.lineCap = 'round'; bg.stroke(); }
    rail(-1, '#a86a33', c * 0.12); rail(1, '#a86a33', c * 0.12); bg.restore();
    rail(-1.08, 'rgba(255,220,170,.55)', c * 0.03); rail(0.92, 'rgba(255,220,170,.55)', c * 0.03);
  }
}
function star(c, x, y, r, col) { c.fillStyle = col; c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr2 = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); } c.closePath(); c.fill(); }

// ---------------------------------------------------------------- drawing
function racer(p, x, y, s, squash = 0, t = 0) {
  g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(60,30,20,.22)'; g.beginPath(); g.ellipse(0, s * 0.42, s * 0.38 * (1 + squash * 0.3), s * 0.1, 0, 0, 7); g.fill();
  g.scale(1 + squash * 0.18, 1 - squash * 0.18);
  const gr = g.createRadialGradient(-s * 0.15, -s * 0.2, s * 0.05, 0, 0, s * 0.55); gr.addColorStop(0, '#fff'); gr.addColorStop(0.25, p.c); gr.addColorStop(1, p.d);
  g.fillStyle = gr; g.beginPath(); g.moveTo(-s * 0.36, s * 0.4); g.quadraticCurveTo(-s * 0.42, -s * 0.5, 0, -s * 0.5); g.quadraticCurveTo(s * 0.42, -s * 0.5, s * 0.36, s * 0.4); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1.5; g.stroke();
  const blink = ((t + p.i * 1.7) % 3.8) < 0.12;
  for (const sx of [-1, 1]) {
    if (blink) { g.strokeStyle = '#2a1f1a'; g.lineWidth = s * 0.05; g.beginPath(); g.moveTo(sx * s * 0.13 - s * 0.05, -s * 0.12); g.lineTo(sx * s * 0.13 + s * 0.05, -s * 0.12); g.stroke(); continue; }
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(sx * s * 0.13, -s * 0.12, s * 0.09, s * 0.11, 0, 0, 7); g.fill();
    g.fillStyle = '#2a1f1a'; g.beginPath(); g.arc(sx * s * 0.13 + s * 0.015, -s * 0.1, s * 0.05, 0, 7); g.fill();
  }
  g.strokeStyle = '#2a1f1a'; g.lineWidth = s * 0.045; g.lineCap = 'round'; g.beginPath(); g.arc(0, s * 0.02, s * 0.08, 0.2, Math.PI - 0.2); g.stroke();
  if (p.face === 'you') { g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(-s * 0.16, -s * 0.44); g.lineTo(-s * 0.1, -s * 0.62); g.lineTo(0, -s * 0.5); g.lineTo(s * 0.1, -s * 0.62); g.lineTo(s * 0.16, -s * 0.44); g.closePath(); g.fill(); }
  g.restore();
}
function pip(x, y, r) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
function drawDie(now) {
  const { dieX: X, dieY: Y, dieS: s } = geo, rolling = die.rolling, el = (now - die.at) / 1000;
  const p = players[turn], mine = p && !p.cpu && phase === 'await' && state === 'play';
  let bounce = 0, ang = 0;
  if (rolling) { bounce = Math.abs(Math.sin(el * 14)) * s * 0.35 * Math.max(0, 1 - el * 1.4); ang = el * 11; if (((el * 1000) / 70 | 0) !== die.spin) { die.spin = (el * 1000) / 70 | 0; die.face = 1 + Math.floor(Math.random() * 6); } }
  else if (mine) bounce = Math.abs(Math.sin(now / 260)) * s * 0.06;
  g.fillStyle = 'rgba(60,30,20,.2)'; g.beginPath(); g.ellipse(X, Y + s * 0.62, s * 0.55 * (1 - bounce / s * 0.6), s * 0.13, 0, 0, 7); g.fill();
  g.save(); g.translate(X, Y - bounce); g.rotate(rolling ? Math.sin(ang) * 0.6 : 0);
  // depth: bottom + right faces give the cube its 3D look
  const d = s * 0.14;
  rr(g, -s / 2 + d * 0.3, -s / 2 + d, s, s, s * 0.2); g.fillStyle = '#d6cfc6'; g.fill();
  rr(g, -s / 2 + d * 0.15, -s / 2 + d * 0.55, s, s, s * 0.2); g.fillStyle = '#ebe6df'; g.fill();
  rr(g, -s / 2, -s / 2, s, s, s * 0.2); const gr = g.createLinearGradient(0, -s / 2, 0, s / 2); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#f3eee7'); g.fillStyle = gr; g.fill();
  if (mine) { g.strokeStyle = p.c; g.lineWidth = 4; g.stroke(); }
  g.fillStyle = die.face === 1 ? '#ff5d4a' : '#2f2622';
  for (const [a, b] of PIPS[die.face]) pip(a * s * 0.26, b * s * 0.26, s * (die.face === 1 ? 0.12 : 0.085));
  g.restore();
  if (mine) { g.fillStyle = INK; g.globalAlpha = 0.55 + Math.sin(now / 300) * 0.25; g.font = '700 14px -apple-system,system-ui,sans-serif'; g.textAlign = 'center'; g.fillText('TAP TO ROLL', X, Y + s * 0.62 + 22); g.globalAlpha = 1; }
}
function draw(t) {
  const now = performance.now(), { x, y, c, s } = geo;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); g.drawImage(bgc, 0, 0);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!players.length) return;
  // ladder / slide ride
  if (anim) {
    const k = Math.min(1, (now - anim.at) / anim.dur), p = anim.p;
    if (anim.kind === 'ladder') { const [x1, y1] = sqCenter(anim.from), [x2, y2] = sqCenter(anim.to), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; p.x = x1 + (x2 - x1) * e; p.y = y1 + (y2 - y1) * e - Math.abs(Math.sin(k * 18)) * c * 0.08; }
    else { const P = slideCurve(anim.from, anim.to), [bx, by] = bez(P, k * k); p.x = bx; p.y = by; }
    if (k >= 1) { p.pos = anim.to; anim = null; p.hop = now; tone(320, 0.08, "sine", 0.1, 0.7); afterMove(p); }
  }
  // tokens: ease toward their spots with a hop arc
  const order = players.slice().sort((a, b) => (a === players[turn]) - (b === players[turn]) || a.y - b.y);
  for (const p of order) {
    const riding = anim && anim.p === p;
    if (!riding) { const [tx, ty] = spot(p); p.x += (tx - p.x) * 0.35; p.y += (ty - p.y) * 0.35; }
    const hk = (now - p.hop) / 125, lift = hk < 1 ? Math.sin(hk * Math.PI) * c * 0.45 : 0, sq = hk >= 1 && hk < 1.6 ? Math.sin((hk - 1) / 0.6 * Math.PI) * 0.6 : 0;
    const active = p === players[turn] && state === 'play';
    if (active) { g.strokeStyle = p.c; g.globalAlpha = 0.45 + Math.sin(now / 200) * 0.25; g.lineWidth = 3; g.beginPath(); g.ellipse(p.x, p.y + c * 0.32, c * 0.38, c * 0.14, 0, 0, 7); g.stroke(); g.globalAlpha = 1; }
    racer(p, p.x, p.y - lift - c * 0.08, c * (active ? 0.86 : 0.74), sq, t);
  }
  // header: whose turn / last event
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = INK;
  const hy = y - 40;
  if (hy > 58) { g.font = '750 18px -apple-system,system-ui,sans-serif'; g.fillText(msg, W / 2, hy); }
  // racer chips under the board
  const cy = geo.chipY, n = players.length, cw = Math.min(88, (W - 24) / n - 8), x0 = W / 2 - (n * (cw + 8) - 8) / 2;
  players.forEach((p, i) => {
    const cx = x0 + i * (cw + 8), on = i === turn && state === 'play';
    g.save(); g.shadowColor = 'rgba(90,50,20,.14)'; g.shadowBlur = 10; g.shadowOffsetY = 3; rr(g, cx, cy, cw, 40, 14); g.fillStyle = '#fff'; g.fill(); g.restore();
    if (on) { rr(g, cx, cy, cw, 40, 14); g.strokeStyle = p.c; g.lineWidth = 2.5; g.stroke(); }
    racer(p, cx + 18, cy + 22, 24, 0, t);
    g.textAlign = 'left'; g.fillStyle = INK; g.font = '700 13px -apple-system,system-ui,sans-serif'; g.fillText(p.name, cx + 34, cy + 14);
    g.globalAlpha = 0.6; g.font = '600 12px -apple-system,system-ui,sans-serif'; g.fillText(p.pos ? `sq ${p.pos}` : 'start', cx + 34, cy + 29); g.globalAlpha = 1;
  });
  drawDie(now);
}
function frame(t) { draw(t / 1000); requestAnimationFrame(frame); }
cv.addEventListener('pointerdown', e => {
  if (state !== 'play') return;
  const { dieX, dieY, dieS, y, s } = geo;
  if (Math.hypot(e.clientX - dieX, e.clientY - dieY) < dieS * 1.1 || e.clientY > y + s) tapRoll();   // the die, or anywhere below the board
});
addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') tapRoll(); });

layout();
players = RACERS.slice(0, cpus + 1).map((r, i) => ({ ...r, i, pos: 0, x: 0, y: 0, hop: 0, cpu: i > 0 }));
players.forEach(p => { const [x, y] = startSpot(p.i); p.x = x; p.y = y; });
msg = 'First to 100 wins';
requestAnimationFrame(frame);
ui.start();

window.__game = {
  get state() { return state; }, get level() { return races; },
  get score() { return state === 'play' ? players[0].pos : wins; },   // QA: your square during a race, wins after
  bot() { tapRoll(); },   // nothing to decide in this game: just roll when it's your turn
};
