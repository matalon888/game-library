// Quadrop — the classic falling-blocks puzzle: seven four-square pieces, hold, a next queue of three, ghost piece,
// hard drop, line clears, levels that speed up. Endless; the run ends when the stack reaches the top.
import { createUI, store, buzz, sfx, tone, note, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { css, BASE_CSS, stage2d, rr, sprite, blit, fx as mkfx, hud as mkhud, pad as mkpad, keys, touchy, dressStart, paused } from './neo.js';

const NAME = 'Quadrop: Falling Blocks Puzzle';
const SAVE = store('quadrop');
let best = SAVE.get('best', 0);
const F = flow('quadrop', { par: 6000, warmup: 800 });
css(BASE_CSS + `body{--acc:#ff5fa8;--acc2:#5ef2ff;--bgA:#0c0a26;--bgB:#2c1b6b;--bgC:#05041a}`);
const ui = createUI({ title: 'QUADROP', hint: 'Tap to play', hand: '👆', progress: false, score: false });
const D = daily('quadrop', ui, { name: NAME });
const B = board({ game: 'quadrop', label: 'Points', limits: { maxRun: 999999, maxPerSec: 1500 }, corner: 'tl' });
const SD = dressStart(ui, { kicker: 'FALLING BLOCKS', line: 'Slide to move · tap to turn<br>flick down to drop · flick up to hold', best });
ui.els.lose.querySelector('.hint').textContent = 'Tap to play again';

const S = stage2d(), ctx = S.ctx, FX = mkfx(), H = mkhud('SCORE');

// ---------------------------------------------------------------- pieces (SRS rotation + wall kicks)
const TYPES = 'IOTSZJL';
const COL = [null, '#ff5fa8', '#3dffc0', '#ffc23d', '#9a86ff', '#3db8ff', '#b8ff4a', '#ff7058'];
const SH = { I: [4, [[0, 1], [1, 1], [2, 1], [3, 1]]], O: [2, [[0, 0], [1, 0], [0, 1], [1, 1]]], T: [3, [[1, 0], [0, 1], [1, 1], [2, 1]]],
  S: [3, [[1, 0], [2, 0], [0, 1], [1, 1]]], Z: [3, [[0, 0], [1, 0], [1, 1], [2, 1]]], J: [3, [[0, 0], [0, 1], [1, 1], [2, 1]]], L: [3, [[2, 0], [0, 1], [1, 1], [2, 1]]] };
const ROT = {};
for (const t of TYPES) { const [n, c] = SH[t]; ROT[t] = [c]; for (let r = 1; r < 4; r++) ROT[t].push(ROT[t][r - 1].map(([x, y]) => [n - 1 - y, x])); if (t === 'O') ROT[t] = [c, c, c, c]; }
// kick tables in (x, y-up); key = from*10+to
const KJ = { 1: [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]], 10: [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]], 12: [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]], 21: [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  23: [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]], 32: [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]], 30: [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]], 3: [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]] };
const KI = { 1: [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]], 10: [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]], 12: [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]], 21: [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  23: [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]], 32: [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]], 30: [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]], 3: [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]] };

const W = 10, HH = 22, HID = 2, LOCK = 0.5, CLEAR_T = 0.3;
let grid = [], cur = null, hold = null, holdUsed = false, queue = [], bag = [], R = Math.random;
let state = 'ready', score = 0, lines = 0, level = 1, combo = -1, b2b = false, recorded = false, beatenShown = false;
let gravAcc = 0, lockT = 0, lockResets = 0, lowY = 0, softOn = false, clearing = null, dropAnim = new Array(HH).fill(0), dropT = 1;
let trails = [], lockFlash = [], levelGlow = 0, deadT = 0, plan = null, pieceN = 0;

const emptyRow = () => new Array(W).fill(0);
const fits = (t, r, x, y) => { for (const [cx, cy] of ROT[t][r]) { const gx = x + cx, gy = y + cy; if (gx < 0 || gx >= W || gy >= HH) return false; if (gy >= 0 && grid[gy][gx]) return false; } return true; };
function nextType() { if (!bag.length) { bag = TYPES.split(''); for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; } } return bag.pop(); }
function fillQueue() { while (queue.length < 5) queue.push(nextType()); }
function spawn(t) {
  cur = { t, r: 0, x: t === 'O' ? 4 : 3, y: 0 };
  if (!fits(t, 0, cur.x, cur.y)) return gameOver();
  if (fits(t, 0, cur.x, cur.y + 1)) cur.y++;
  gravAcc = 0; lockT = 0; lockResets = 0; lowY = cur.y; plan = null; pieceN++;
}
function spawnNext() { fillQueue(); spawn(queue.shift()); fillQueue(); holdUsed = false; }
const grounded = () => !fits(cur.t, cur.r, cur.x, cur.y + 1);
function touched() { if (grounded() && lockResets < 15) { lockT = 0; lockResets++; } }

function move(dx) {
  if (state !== 'play' || !cur || clearing) return false;
  if (fits(cur.t, cur.r, cur.x + dx, cur.y)) { cur.x += dx; touched(); tone(330, 0.03, 'triangle', 0.05, 1); return true; }
  return false;
}
function rotate(dir) {
  if (state !== 'play' || !cur || clearing || cur.t === 'O') { if (cur && cur.t === 'O' && state === 'play') tone(520, 0.04, 'sine', 0.05, 1.1); return false; }
  const to = (cur.r + dir + 4) % 4, K = (cur.t === 'I' ? KI : KJ)[cur.r * 10 + to];
  for (const [kx, ky] of K) if (fits(cur.t, to, cur.x + kx, cur.y - ky)) { cur.x += kx; cur.y -= ky; cur.r = to; touched(); tone(600 + to * 40, 0.05, 'triangle', 0.07, 1.25); buzz(4); return true; }
  return false;
}
function softStep() { if (fits(cur.t, cur.r, cur.x, cur.y + 1)) { cur.y++; addScore(1); return true; } return false; }
function hardDrop() {
  if (state !== 'play' || !cur || clearing) return;
  const y0 = cur.y; let d = 0; while (fits(cur.t, cur.r, cur.x, cur.y + 1)) { cur.y++; d++; }
  addScore(2 * d);
  const cs = ROT[cur.t][cur.r], cols = {};
  for (const [cx, cy] of cs) { const gx = cur.x + cx; cols[gx] = Math.min(cols[gx] ?? 99, y0 + cy); }
  for (const gx in cols) trails.push({ x: +gx, y0: cols[gx], y1: cur.y + Math.max(...cs.filter(c => c[0] + cur.x === +gx).map(c => c[1])), c: COL[TYPES.indexOf(cur.t) + 1], t: 0 });
  FX.shake(d > 2 ? 7 : 3); buzz(12); tone(160, 0.1, 'square', 0.07, 0.5);
  lockPiece(true);
}
function holdPiece() {
  if (state !== 'play' || !cur || clearing || holdUsed) return;
  const t = cur.t; if (hold) { const h = hold; hold = t; spawn(h); } else { hold = t; fillQueue(); spawn(queue.shift()); fillQueue(); }
  holdUsed = true; tone(440, 0.06, 'sine', 0.08, 1.4); tone(660, 0.08, 'sine', 0.06, 1.2);
}
function addScore(n) {
  score += n; H.score(score);
  if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); confettiAt(L.bx + L.bw / 2, L.by + L.bh * 0.3); sfx.win(); }
}
function confettiAt(x, y) { FX.burst(x, y, ['#ff5fa8', '#ffc23d', '#3dffc0', '#3db8ff', '#9a86ff', '#fff'], 60, { speed: 420, life: 1.3, size: 6, grav: 380, drag: 1.4 }); }

function lockPiece(hard = false) {
  const ci = TYPES.indexOf(cur.t) + 1; let above = true;
  for (const [cx, cy] of ROT[cur.t][cur.r]) { const gx = cur.x + cx, gy = cur.y + cy; if (gy >= 0) grid[gy][gx] = ci; if (gy >= HID) above = false; lockFlash.push({ x: gx, y: gy, t: 0 }); }
  if (!hard) { tone(220, 0.06, 'triangle', 0.08, 0.7); buzz(6); }
  const px = L.bx + (cur.x + 1.5) * L.c, py = L.by + (cur.y + 1 - HID) * L.c;
  FX.burst(px, py + L.c, [COL[ci], '#fff'], hard ? 12 : 6, { speed: 160, life: 0.45, size: 3.5, grav: 500, dir: -Math.PI / 2, spread: 2.4 });
  cur = null;
  if (above) return gameOver();
  const full = []; for (let y = 0; y < HH; y++) if (grid[y].every(v => v)) full.push(y);
  if (full.length) {
    clearing = { rows: full, t: 0 }; const n = full.length;
    let pts = [0, 100, 300, 500, 800][n] * level, tag = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'QUAD!'][n];
    if (n === 4) { if (b2b) { pts = Math.round(pts * 1.5); tag = 'B2B QUAD!'; } b2b = true; } else b2b = false;
    combo++; if (combo > 0) pts += 50 * combo * level;
    addScore(pts);
    const cy = L.by + (full.reduce((a, b) => a + b, 0) / n - HID + 0.5) * L.c;
    FX.text(L.bx + L.bw / 2, cy - 10, tag, n === 4 ? '#ffe14d' : '#fff', n === 4 ? 34 : 26, 1.1);
    FX.text(L.bx + L.bw / 2, cy + 22, '+' + pts.toLocaleString('en-US') + (combo > 0 ? `  combo ×${combo + 1}` : ''), '#5ef2ff', 18, 1.1);
    FX.shake(4 + n * 3); FX.flash(n === 4 ? '#ffe9a8' : '#ffffff', 0.12 + n * 0.06); buzz(n === 4 ? [30, 30, 60] : 18 + n * 6);
    const base = [60, 64, 67, 72][Math.min(3, combo % 4)];
    [0, 4, 7, 12, 16].slice(0, n + 1).forEach((s, i) => setTimeout(() => note(base + s, 0.24, 0.13), i * 60));
    for (const y of full) for (let x = 0; x < W; x++) FX.burst(L.bx + (x + 0.5) * L.c, L.by + (y - HID + 0.5) * L.c, [COL[grid[y][x]], '#ffffff'], 3, { speed: 260, life: 0.7, size: 4, grav: 420 });
  } else { combo = -1; spawnNext(); }
}
function collapse() {
  const rows = clearing.rows, set = new Set(rows), n = rows.length;
  const old = grid; grid = []; dropAnim = new Array(HH).fill(0);
  for (let i = 0; i < n; i++) grid.push(emptyRow());
  for (let y = 0; y < HH; y++) if (!set.has(y)) { const shift = rows.filter(r => r > y).length; dropAnim[grid.length] = shift; grid.push(old[y]); }
  dropT = 0; clearing = null;
  const prevLv = level; lines += n; level = 1 + Math.floor(lines / 10);
  if (grid.every(r => r.every(v => !v))) { addScore(1000 * level); FX.text(L.bx + L.bw / 2, L.by + L.bh * 0.4, 'ALL CLEAR!', '#3dffc0', 34, 1.4); confettiAt(L.bx + L.bw / 2, L.by + L.bh * 0.4); }
  if (level > prevLv) { levelGlow = 1; ui.pop(`LEVEL ${level}`, '#ffe14d', 42, 34); sfx.win(); confettiAt(L.bx + L.bw / 2, L.by + L.bh * 0.5); }
  spawnNext();
}
function gravity() { const lv = Math.min(level, 20); return Math.max(1 / 60, Math.pow(0.8 - (lv - 1) * 0.007, lv - 1)) / F.k(score); }

function reset() {
  grid = []; for (let y = 0; y < HH; y++) grid.push(emptyRow());
  R = rng(D.seed || (Date.now() % 1e9) + 11); bag = []; queue = []; hold = null; holdUsed = false;
  score = 0; lines = 0; level = 1; combo = -1; b2b = false; recorded = false; beatenShown = false; clearing = null; trails = []; lockFlash = []; deadT = 0; pieceN = 0;
  dropAnim.fill(0); softOn = false; H.score(0); spawnNext();
}
function gameOver() {
  if (state !== 'play') return;
  state = 'lost'; deadT = 0;
  if (!recorded) { recorded = true; F.endless(score); B.submit(score); }
  const nb = score > best && score > 0; best = Math.max(best, score); SAVE.set('best', best); SD.setBest(best);
  sfx.fail(); buzz([40, 30, 90]); FX.shake(12); FX.flash('#ff3d6e', 0.3);
  ui.lose(nb ? 'NEW BEST!' : 'TOPPED OUT', `Score ${score.toLocaleString('en-US')} · Lines ${lines} · Best ${best.toLocaleString('en-US')}`);
}
function startRun() { reset(); state = 'play'; B.start(); }
ui.onTap(() => startRun());
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): at the start of a run, until the
// first touch, the first two pieces turn, slide to a good spot and slam down by themselves (their drop points are handed back)
let demoPlan = null;
demo(() => {
  if (pieceN > 2) return false;
  if (!demoPlan || demoPlan.n !== pieceN) { const o = options(cur.t); if (!o.length) return false; demoPlan = o[0]; demoPlan.n = pieceN; demoPlan.acts = 0; }
  if (++demoPlan.acts > 10) return false;
  if (cur.r !== demoPlan.r) { if (!rotate(1)) demoPlan.acts += 3; }
  else if (cur.x !== demoPlan.x) { if (!move(cur.x < demoPlan.x ? 1 : -1)) demoPlan.acts += 4; }
  else { const s0 = score; hardDrop(); score = s0; H.score(score); }
}, { ready: () => state === 'play' && cur && !clearing && lines === 0 && pieceN <= 2 && !paused(), wait: 1200, every: 260, max: 24, ms: 15000 });

// ---------------------------------------------------------------- controls: touch buttons, gestures, keyboard
const P = mkpad([
  { icon: 'left', aria: 'Left', press: () => move(-1), repeat: [170, 55] },
  { icon: 'right', aria: 'Right', press: () => move(1), repeat: [170, 55] },
  { icon: 'down', aria: 'Soft drop', press: () => { softOn = true; }, release: () => { softOn = false; } },
  { icon: 'hold', sub: 'HOLD', press: () => holdPiece() },
  { icon: 'rot', aria: 'Rotate', press: () => rotate(1) },
  { icon: 'drop', aria: 'Hard drop', press: () => hardDrop() },
]);
const keyHint = document.createElement('div'); keyHint.className = 'neo-keys';
keyHint.innerHTML = '<kbd>←</kbd><kbd>→</kbd> move · <kbd>↑</kbd> turn · <kbd>Z</kbd> turn back · <kbd>↓</kbd> soft · <kbd>Space</kbd> drop · <kbd>C</kbd> hold';
document.body.appendChild(keyHint);
keys({
  'ArrowLeft|a|A': { press: () => move(-1), repeat: [150, 45] }, 'ArrowRight|d|D': { press: () => move(1), repeat: [150, 45] },
  'ArrowDown|s|S': { press: () => { softOn = true; }, release: () => { softOn = false; } },
  'ArrowUp|x|X|w|W': { press: () => rotate(1) }, 'z|Z|Control': { press: () => rotate(-1) },
  ' ': { press: () => { if (state === 'play') hardDrop(); else cardGo(); } }, 'c|C|Shift': { press: () => holdPiece() }, 'Enter': { press: () => cardGo() },
});
function cardGo() { for (const k of ['start', 'lose']) { const c = ui.els[k]; if (!c.classList.contains('hc-hidden')) { c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return; } } }
// gestures on the play area: drag sideways = step per cell, drag down = soft drop, tap = rotate, flick down = hard drop, flick up = hold
let G = null;
S.cv.addEventListener('pointerdown', e => { if (state !== 'play') return; G = { x0: e.clientX, y0: e.clientY, ax: e.clientX, ay: e.clientY, t0: performance.now(), moved: false, hz: 0, soft: 0, samp: [[e.clientX, e.clientY, performance.now()]] }; });
addEventListener('pointermove', e => {
  if (!G || state !== 'play') return; const now = performance.now(); G.samp.push([e.clientX, e.clientY, now]); while (G.samp.length > 2 && now - G.samp[0][2] > 90) G.samp.shift();
  const step = Math.max(18, L.c * 0.85);
  while (e.clientX - G.ax >= step) { G.ax += step; move(1); G.moved = true; G.hz++; }
  while (G.ax - e.clientX >= step) { G.ax -= step; move(-1); G.moved = true; G.hz++; }
  const dy = e.clientY - G.ay;
  if (dy >= step * 1.1 && Math.abs(e.clientY - G.y0) > Math.abs(e.clientX - G.x0) * 0.8) { const v = (e.clientY - G.samp[0][1]) / Math.max(1, now - G.samp[0][2]); if (v < 1.1 && cur && !clearing) { G.ay += step; softStep(); G.soft++; G.moved = true; } }
  if (Math.abs(e.clientX - G.x0) > 10) G.ay = Math.min(G.ay, e.clientY);
});
addEventListener('pointerup', e => {
  if (!G || state !== 'play') { G = null; return; }
  const now = performance.now(), dx = e.clientX - G.x0, dy = e.clientY - G.y0, s0 = G.samp[0], v = (e.clientY - s0[1]) / Math.max(1, now - s0[2]);
  if (!G.moved && Math.hypot(dx, dy) < 14 && now - G.t0 < 320) rotate(1);
  else if (dy > 40 && v > 0.9 && Math.abs(dy) > Math.abs(dx) * 1.2) hardDrop();
  else if (dy < -50 && Math.abs(dy) > Math.abs(dx) * 1.3 && G.hz === 0) holdPiece();
  G = null;
});
addEventListener('pointercancel', () => G = null);

// ---------------------------------------------------------------- layout
const L = { c: 24, bx: 0, by: 0, bw: 240, bh: 480, side: 50, mini: 10 };
let isTouch = touchy();
S.onResize = (w, h) => {
  isTouch = touchy(); P.show(isTouch); keyHint.style.display = isTouch ? 'none' : 'block';
  const top = 66 + (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0);
  const bottom = isTouch ? 86 : 44, gap = 8;
  const availH = h - top - bottom - 10, side = Math.round(Math.max(44, Math.min(96, w * 0.118)));
  const c = Math.floor(Math.min((w - 2 * side - 4 * gap - 8) / W, availH / 20));
  L.c = c; L.bw = c * W; L.bh = c * 20; L.bx = Math.round((w - L.bw) / 2); L.by = Math.round(top + (availH - L.bh) / 2); L.side = side; L.mini = Math.floor(Math.min(side - 6, 84) / 4);
  L.hx = L.bx - gap - side; L.nx = L.bx + L.bw + gap;
};
S.fit();

// ---------------------------------------------------------------- drawing
function cellSprite(ci, c, ghost = false) {
  return sprite('q' + ci + (ghost ? 'g' : ''), c, c, S.dpr, Math.ceil(c * 0.45), (x, w, h) => {
    const col = COL[ci];
    if (ghost) { x.strokeStyle = col; x.globalAlpha = 0.55; x.lineWidth = Math.max(1.5, w * 0.08); rr(x, 2, 2, w - 4, h - 4, w * 0.22); x.stroke(); x.globalAlpha = 0.12; x.fillStyle = col; x.fill(); return; }
    x.shadowColor = col; x.shadowBlur = w * 0.4; rr(x, 1, 1, w - 2, h - 2, w * 0.24); x.fillStyle = col; x.fill(); x.shadowBlur = 0;
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,.5)'); g.addColorStop(0.5, 'rgba(255,255,255,.06)'); g.addColorStop(1, 'rgba(0,0,0,.28)');
    rr(x, 1, 1, w - 2, h - 2, w * 0.24); x.fillStyle = g; x.fill();
    x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 1; rr(x, 1.5, 1.5, w - 3, h - 3, w * 0.22); x.stroke();
    x.fillStyle = 'rgba(255,255,255,.7)'; rr(x, w * 0.2, h * 0.14, w * 0.34, h * 0.11, h * 0.06); x.fill();
  });
}
function drawMini(t, cx, cy, m, alpha = 1) {
  if (!t) return; const cs = ROT[t][0], xs = cs.map(c => c[0]), ys = cs.map(c => c[1]);
  const w = (Math.max(...xs) - Math.min(...xs) + 1) * m, h = (Math.max(...ys) - Math.min(...ys) + 1) * m, ci = TYPES.indexOf(t) + 1, sp = cellSprite(ci, m);
  ctx.globalAlpha = alpha;
  for (const [x, y] of cs) blit(ctx, sp, cx - w / 2 + (x - Math.min(...xs)) * m, cy - h / 2 + (y - Math.min(...ys)) * m, m, m);
  ctx.globalAlpha = 1;
}
const orbs = Array.from({ length: 7 }, (_, i) => ({ x: Math.random(), y: Math.random(), r: 0.18 + Math.random() * 0.25, s: 0.01 + Math.random() * 0.02, c: ['#ff5fa8', '#3db8ff', '#9a86ff', '#3dffc0'][i % 4], p: Math.random() * 6 }));
function drawBg(t) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const o of orbs) {
    const x = (o.x + Math.sin(t * o.s * 6 + o.p) * 0.06) * S.w, y = (o.y + Math.cos(t * o.s * 5 + o.p) * 0.05) * S.h, r = o.r * Math.max(S.w, S.h);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, o.c + '22'); g.addColorStop(1, o.c + '00'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.restore();
}
function panel(x, y, w, h, label) {
  rr(ctx, x, y, w, h, 14); ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.62)'; ctx.font = "800 11px 'Baloo 2',system-ui"; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(label, x + w / 2, y + 7);
}
const lvColor = () => COL[1 + ((level - 1) % 7)];

function draw(t, dt) {
  S.begin(); drawBg(t);
  const [sx, sy] = FX.offset(); ctx.save(); ctx.translate(sx, sy);
  const { c, bx, by, bw, bh } = L, ac = lvColor();
  // board well
  ctx.save(); ctx.shadowColor = ac; ctx.shadowBlur = 18 + levelGlow * 30; rr(ctx, bx - 6, by - 6, bw + 12, bh + 12, 16); ctx.fillStyle = 'rgba(8,6,28,.82)'; ctx.fill(); ctx.restore();
  rr(ctx, bx - 6, by - 6, bw + 12, bh + 12, 16); ctx.strokeStyle = ac; ctx.globalAlpha = 0.55 + levelGlow * 0.45; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255,255,255,.045)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let x = 1; x < W; x++) { ctx.moveTo(bx + x * c + 0.5, by); ctx.lineTo(bx + x * c + 0.5, by + bh); }
  for (let y = 1; y < 20; y++) { ctx.moveTo(bx, by + y * c + 0.5); ctx.lineTo(bx + bw, by + y * c + 0.5); }
  ctx.stroke();
  // danger glow when the stack is high
  let topRow = HH; for (let y = 0; y < HH; y++) if (grid[y].some(v => v)) { topRow = y; break; }
  if (state === 'play' && topRow < HID + 5) { const a = (0.22 + 0.16 * Math.sin(t * 8)) * (1 - (topRow - HID) / 5); const g = ctx.createLinearGradient(0, by, 0, by + c * 5); g.addColorStop(0, `rgba(255,50,90,${a})`); g.addColorStop(1, 'rgba(255,50,90,0)'); ctx.fillStyle = g; ctx.fillRect(bx, by, bw, c * 5); }
  ctx.save(); rr(ctx, bx - 2, by - 2, bw + 4, bh + 4, 12); ctx.clip();
  // locked cells
  dropT = Math.min(1, dropT + dt / 0.16); const de = 1 - Math.pow(1 - dropT, 3);
  const dead = state === 'lost' ? deadT : -1;
  for (let y = HID; y < HH; y++) {
    const row = grid[y], off = dropAnim[y] ? -dropAnim[y] * c * (1 - de) : 0, clr = clearing && clearing.rows.includes(y);
    for (let x = 0; x < W; x++) {
      const v = row[x]; if (!v) continue;
      const px = bx + x * c, py = by + (y - HID) * c + off;
      if (clr) {
        const k = clearing.t / CLEAR_T, s = 1 - Math.max(0, (k - 0.35) / 0.65);
        ctx.globalAlpha = 1; blit(ctx, cellSprite(v, c), px + c * (1 - s) / 2, py + c * (1 - s) / 2, c * s, c * s);
        ctx.globalAlpha = Math.min(1, k * 3) * s; ctx.fillStyle = '#fff'; rr(ctx, px + 1 + c * (1 - s) / 2, py + 1 + c * (1 - s) / 2, (c - 2) * s, (c - 2) * s, c * 0.22); ctx.fill(); ctx.globalAlpha = 1;
        continue;
      }
      const grey = dead >= 0 && (HH - 1 - y) < dead * 30;
      blit(ctx, cellSprite(grey ? 0 : v, c), px, py, c, c);
    }
  }
  // lock flashes
  for (const f of lockFlash) { f.t += dt; if (f.y < HID) continue; ctx.globalAlpha = Math.max(0, 0.75 - f.t * 4); ctx.fillStyle = '#fff'; rr(ctx, bx + f.x * c + 1, by + (f.y - HID) * c + 1, c - 2, c - 2, c * 0.22); ctx.fill(); }
  lockFlash = lockFlash.filter(f => f.t < 0.2); ctx.globalAlpha = 1;
  // hard drop trails
  for (const tr of trails) {
    tr.t += dt; const a = Math.max(0, 1 - tr.t / 0.28), y0 = by + (tr.y0 - HID) * c, y1 = by + (tr.y1 - HID + 1) * c;
    const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, tr.c + '00'); g.addColorStop(1, tr.c); ctx.globalAlpha = a * 0.55; ctx.fillStyle = g; ctx.fillRect(bx + tr.x * c + c * 0.15, y0, c * 0.7, y1 - y0);
  }
  trails = trails.filter(tr => tr.t < 0.28); ctx.globalAlpha = 1;
  // ghost + current piece
  if (cur && state !== 'lost') {
    const ci = TYPES.indexOf(cur.t) + 1, cs = ROT[cur.t][cur.r];
    let gy = cur.y; while (fits(cur.t, cur.r, cur.x, gy + 1)) gy++;
    if (gy !== cur.y) for (const [x, y] of cs) if (gy + y >= HID) blit(ctx, cellSprite(ci, c, true), bx + (cur.x + x) * c, by + (gy + y - HID) * c, c, c);
    const lockK = grounded() ? Math.min(1, lockT / LOCK) : 0;
    for (const [x, y] of cs) if (cur.y + y >= HID) {
      blit(ctx, cellSprite(ci, c), bx + (cur.x + x) * c, by + (cur.y + y - HID) * c, c, c);
      if (lockK > 0) { ctx.globalAlpha = lockK * 0.35; ctx.fillStyle = '#fff'; rr(ctx, bx + (cur.x + x) * c + 1, by + (cur.y + y - HID) * c + 1, c - 2, c - 2, c * 0.22); ctx.fill(); ctx.globalAlpha = 1; }
    }
  }
  ctx.restore();
  // side panels: hold + stats (left), next queue (right)
  const sd = L.side, m = L.mini;
  panel(L.hx, by, sd, sd + 12, 'HOLD'); drawMini(hold, L.hx + sd / 2, by + 22 + sd / 2 - 4, m, holdUsed ? 0.35 : 1);
  const nh = Math.round(sd * 2.6 + 18); panel(L.nx, by, sd, nh, 'NEXT');
  queue.slice(0, 3).forEach((q, i) => drawMini(q, L.nx + sd / 2, by + 26 + i * (sd * 0.82) + sd * 0.3, i === 0 ? m : Math.floor(m * 0.8), i === 0 ? 1 : 0.8));
  const stY = by + sd + 24;
  [['LEVEL', level], ['LINES', lines]].forEach(([k, v], i) => {
    const y = stY + i * 56; panel(L.hx, y, sd, 48, k);
    ctx.fillStyle = i === 0 ? ac : '#fff'; ctx.font = `800 ${sd > 60 ? 24 : 20}px 'Baloo 2',system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(v, L.hx + sd / 2, y + 31);
  });
  if (combo > 0 && state === 'play') { ctx.fillStyle = '#5ef2ff'; ctx.font = "800 13px 'Baloo 2',system-ui"; ctx.textAlign = 'center'; ctx.fillText('COMBO', L.nx + sd / 2, by + nh + 16); ctx.font = "800 22px 'Baloo 2',system-ui"; ctx.fillText('×' + (combo + 1), L.nx + sd / 2, by + nh + 36); }
  FX.draw(ctx); ctx.restore(); FX.drawFlash(ctx, S.w, S.h);
}
COL[0] = '#4a4766';

// ---------------------------------------------------------------- loop
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; const t = now / 1000;
  if (paused()) { /* frozen */ } else if (state === 'play' && cur && !clearing) {
    const iv = softOn ? Math.min(gravity(), 0.035) : gravity();
    if (!grounded()) {
      gravAcc += dt;
      while (gravAcc >= iv && fits(cur.t, cur.r, cur.x, cur.y + 1)) { cur.y++; gravAcc -= iv; if (softOn) addScore(1); }
      if (cur.y > lowY) { lowY = cur.y; lockResets = 0; lockT = 0; }
    } else { gravAcc = 0; lockT += dt; if (lockT >= LOCK) lockPiece(); }
  } else if (clearing) { clearing.t += dt; if (clearing.t >= CLEAR_T) collapse(); }
  if (state === 'lost') deadT += dt;
  levelGlow = Math.max(0, levelGlow - dt * 0.8);
  FX.update(dt);
  H.stats([['BEST', Math.max(best, score).toLocaleString('en-US')]]);
  draw(t, dt);
  requestAnimationFrame(frame);
}
reset(); H.score(0); requestAnimationFrame(frame);

// ---------------------------------------------------------------- test hooks + bot (sensible placements, with some human-like slips)
function evalBoard(g) {
  let agg = 0, holes = 0, bump = 0, prev = -1, wells = 0; const hs = [];
  for (let x = 0; x < W; x++) { let h = 0; for (let y = 0; y < HH; y++) if (g[y][x]) { h = HH - y; break; } hs.push(h); agg += h; if (prev >= 0) bump += Math.abs(h - prev); prev = h; let seen = false; for (let y = 0; y < HH; y++) { if (g[y][x]) seen = true; else if (seen) holes++; } }
  for (let x = 0; x < W; x++) { const l = x ? hs[x - 1] : 99, r = x < W - 1 ? hs[x + 1] : 99; if (hs[x] < l && hs[x] < r) wells += Math.min(l, r) - hs[x] > 2 ? 1 : 0; }
  return { agg, holes, bump, wells, maxH: Math.max(...hs) };
}
function options(t) {
  const out = [];
  for (let r = 0; r < 4; r++) { if (t === 'O' && r) break; for (let x = -2; x < W; x++) {
    let y = cur.y; if (!fits(t, r, x, y)) { y = 0; if (!fits(t, r, x, y)) continue; }
    while (fits(t, r, x, y + 1)) y++;
    const g = grid.map(row => row.slice()); for (const [cx, cy] of ROT[t][r]) if (y + cy >= 0) g[y + cy][x + cx] = 1;
    let cl = 0; for (let yy = 0; yy < HH; yy++) if (g[yy].every(v => v)) { g.splice(yy, 1); g.unshift(emptyRow()); cl++; }
    const e = evalBoard(g); out.push({ r, x, v: -0.51 * e.agg + 0.76 * cl - 0.36 * e.holes * 2 - 0.18 * e.bump - 0.3 * e.wells });
  } }
  return out.sort((a, b) => b.v - a.v);
}
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; }, get lines() { return lines; },
  bot() {
    if (state !== 'play' || !cur || clearing) return;
    if (!plan || plan.n !== pieceN) {
      const o = options(cur.t); if (!o.length) { hardDrop(); return; }
      plan = Math.random() < Math.min(0.85, 0.03 + pieceN * 0.03) ? o[Math.floor(Math.random() * o.length)] : o[0]; plan.n = pieceN; plan.acts = 0;
    }
    for (let k = 0; k < 3 && cur && plan.n === pieceN; k++) {
      plan.acts++;
      if (plan.acts > 12) return hardDrop();
      if (cur.r !== plan.r) { if (!rotate(1)) plan.acts += 3; }
      else if (cur.x < plan.x) { if (!move(1)) plan.acts += 4; }
      else if (cur.x > plan.x) { if (!move(-1)) plan.acts += 4; }
      else return hardDrop();
    }
  },
};
