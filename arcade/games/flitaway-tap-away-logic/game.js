// Flitaway — tap an arrow and it slides along its own body and flies off the board, but only if the way out is clear.
// A blocked arrow bonks into the one in its way and costs a heart. Clear every arrow to win the level.
// Levels are generated (seeded): arrows are added one by one, each with a clear way out at the moment it is added,
// so removing them in reverse order always works: every level is solvable.
import { createUI, store, sfx, note, tone, buzz, input, rng, clamp } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';

const NAME = 'Flitaway: Tap Away Logic';
const S = store('flitaway');
const F = flow('flitaway');
const ui = createUI({ title: 'Flitaway', hint: 'Tap an arrow with a clear way out', hand: '👆', score: true });
const D = daily('flitaway', ui, { name: NAME });
const B = board({ game: 'flitaway', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 1 }, mode: 'sum', corner: 'tl' });

const css = document.createElement('style');
css.textContent = `
.hc-card,.hc-card.dim{background:linear-gradient(180deg,rgba(48,42,96,.58),rgba(48,42,96,.74))}
.hc-card p.kick{font-size:14px;letter-spacing:4px;text-transform:uppercase;opacity:.85}
.hc-score{font-size:42px;top:calc(52px + env(safe-area-inset-top));color:#4b3f8f;text-shadow:0 3px 0 rgba(255,255,255,.7)}
.hc-sub{top:calc(94px + env(safe-area-inset-top));color:#6b62a6;text-shadow:none;font-weight:800;font-size:14px;letter-spacing:.5px}
.hc-pop{text-shadow:0 3px 0 rgba(40,30,90,.25)}
.hc-lvl.next{color:var(--ui)}`;
document.head.appendChild(css);
{ const k = document.createElement('p'); k.className = 'kick'; k.textContent = 'tap away logic'; ui.els.start.querySelector('h1').after(k); }

const THEMES = [
  { bg: ['#eef0ff', '#ffe9f2'], ui: '#7b5cff', cols: ['#7b5cff', '#ff5d8f', '#ffb020', '#22b8a7', '#4d8dff'] },
  { bg: ['#e4fbf3', '#fff4dd'], ui: '#16a383', cols: ['#16a383', '#ff7a45', '#5b6cff', '#e8508a', '#f2b600'] },
  { bg: ['#fff0e3', '#f1e9ff'], ui: '#ff7a45', cols: ['#ff7a45', '#7b5cff', '#1fb5d6', '#ff4f79', '#3fbf6a'] },
  { bg: ['#e6f3ff', '#ffeef6'], ui: '#2f7cf6', cols: ['#2f7cf6', '#ff5d8f', '#00b894', '#ff9f1a', '#9b6bff'] },
  { bg: ['#fdf0ff', '#e8fff6'], ui: '#c04fd8', cols: ['#c04fd8', '#16a383', '#ff8a3d', '#3d8bff', '#ff4f6d'] },
];
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

// ---------------------------------------------------------------- canvas
const cv = document.createElement('canvas'); cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block'; document.body.prepend(cv);
const g = cv.getContext('2d'); let W = 0, H = 0, dpr = 1;
function resize() { dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; layout(); }
addEventListener('resize', resize);

// ---------------------------------------------------------------- state
let level = S.get('level', 1), best = S.get('best', 0), dLevel = 1;
let state = 'ready', score = 0, cols = 6, rows = 6, occ = null, arrows = [], hearts = 3, maxHearts = 3, theme = THEMES[0];
let geo = { x: 0, y: 0, cs: 40 }, parts = [], combo = 0, lastClear = 0, recorded = false, beatenShown = false, total = 0, shakeT = 0, wonAt = 0, t0 = 0;

function generate(lv, seed, fk) {
  const r = rng(seed * 2654435761 % 2147483647 + 7);
  const c = clamp(5 + Math.floor((lv - 1) * 0.8), 5, 13), rw = clamp(6 + Math.floor((lv - 1) * 1.0), 6, 16);
  const maxLen = clamp(Math.round((3.5 + lv * 0.6) * fk), 3, 13);
  const o = new Int16Array(c * rw).fill(-1), list = [];
  const inb = (x, y) => x >= 0 && y >= 0 && x < c && y < rw;
  const tries = c * rw * 90;
  for (let a = 0; a < tries; a++) {
    const hx = (r() * c) | 0, hy = (r() * rw) | 0; if (o[hy * c + hx] >= 0) continue;
    const di = (r() * 4) | 0, [dx, dy] = DIRS[di];
    let ok = true; const ray = new Set();
    for (let x = hx + dx, y = hy + dy; inb(x, y); x += dx, y += dy) { if (o[y * c + x] >= 0) { ok = false; break; } ray.add(y * c + x); }
    if (!ok) continue;
    const nx = hx - dx, ny = hy - dy; if (!inb(nx, ny) || o[ny * c + nx] >= 0) continue;
    const body = [[hx, hy], [nx, ny]], used = new Set([hy * c + hx, ny * c + nx]);
    const target = 2 + Math.floor(Math.sqrt(r()) * (maxLen - 1));
    let cx = nx, cy = ny, pd = di;
    while (body.length < target) {
      const opts = [];
      for (let k = 0; k < 4; k++) {
        const [ex, ey] = DIRS[k], x = cx - ex, y = cy - ey, i = y * c + x;     // walking backwards from the head
        if (!inb(x, y) || o[i] >= 0 || used.has(i) || ray.has(i)) continue;
        opts.push({ k, x, y, w: k === pd ? 1.6 : 1 });
      }
      if (!opts.length) break;
      let s = r() * opts.reduce((q, p) => q + p.w, 0), pick = opts[0];
      for (const p of opts) { s -= p.w; if (s <= 0) { pick = p; break; } }
      body.push([pick.x, pick.y]); used.add(pick.y * c + pick.x); cx = pick.x; cy = pick.y; pd = pick.k;
    }
    const id = list.length; for (const i of used) o[i] = id;
    list.push({ cells: body.reverse(), dir: di });
  }
  return { cols: c, rows: rw, occ: o, list };
}

function buildLevel() {
  const lv = D.isDaily ? dLevel + 3 : level;
  const seed = D.seed ? D.seed * 31 + dLevel : lv * 7919 + 13;
  const fk = F.k();
  theme = THEMES[(lv - 1) % THEMES.length];
  const bs = document.body.style; bs.setProperty('--bg1', theme.bg[0]); bs.setProperty('--bg2', theme.bg[1]); bs.setProperty('--ui', theme.ui);
  const L = generate(lv, seed, fk);
  cols = L.cols; rows = L.rows; occ = L.occ;
  const cr = rng(seed + 99);
  arrows = L.list.map((a, id) => ({ id, cells: a.cells, dir: a.dir, len: a.cells.length, col: theme.cols[(cr() * theme.cols.length) | 0], st: 'idle', o: 0, v: 0, back: 0, hit: 0, shake: 0, path: null }));
  for (const a of arrows) {
    const [dx, dy] = DIRS[a.dir], h = a.cells[a.len - 1], p = a.cells.slice();
    for (let k = 1; k <= cols + rows + a.len + 4; k++) p.push([h[0] + dx * k, h[1] + dy * k]);
    a.path = p; a.free = freeAhead(a);
  }
  maxHearts = hearts = clamp(Math.round(3 / Math.sqrt(fk)), 2, 4);
  total = arrows.length; combo = 0; recorded = false; wonAt = 0; parts = [];
  ui.levels(lv); ui.progress(0); layout(); hud();
}
function freeAhead(a) {       // free cells ahead of the head before a blocker; Infinity if the way out is clear
  const [dx, dy] = DIRS[a.dir], h = a.cells[a.len - 1]; let n = 0;
  for (let x = h[0] + dx, y = h[1] + dy; x >= 0 && y >= 0 && x < cols && y < rows; x += dx, y += dy) { const o = occ[y * cols + x]; if (o >= 0 && o !== a.id) return { n, by: o }; n++; }
  return { n: Infinity, by: -1 };
}
function layout() {
  const top = 128, bottom = 70, aw = W - 28, ah = H - top - bottom;
  const cs = Math.floor(Math.min(aw / cols, ah / rows, 58));
  geo = { cs, x: Math.round((W - cs * cols) / 2), y: Math.round(top + (ah - cs * rows) * 0.42) };
}
const left = () => arrows.filter(a => a.st === 'idle' || a.st === 'bonk').length;
function hud() {
  ui.score(left());
  ui.sub(`${D.isDaily ? 'DAILY ' + dLevel + ' · ' : ''}ARROWS LEFT   ${'❤️'.repeat(hearts)}${'🤍'.repeat(Math.max(0, maxHearts - hearts))}`);
}

// ---------------------------------------------------------------- play
function tapAt(px, py) {
  if (state !== 'play') return;
  const { cs } = geo; let bestA = null, bd = Math.max(cs * 0.8, 24);
  for (const a of arrows) {
    if (a.st !== 'idle') continue;
    for (let i = 0; i < a.len; i++) {
      const [x1, y1] = cen(a.cells[i]); const [x2, y2] = cen(a.cells[Math.min(a.len - 1, i + 1)]);
      const d = segDist(px, py, x1, y1, x2, y2); if (d < bd) { bd = d; bestA = a; }
    }
  }
  if (bestA) fire(bestA);
}
function segDist(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1, vy = y2 - y1, l = vx * vx + vy * vy, t = l ? clamp(((px - x1) * vx + (py - y1) * vy) / l, 0, 1) : 0;
  return Math.hypot(px - x1 - vx * t, py - y1 - vy * t);
}
const cen = ([x, y]) => [geo.x + (x + 0.5) * geo.cs, geo.y + (y + 0.5) * geo.cs];

function fire(a) {
  const f = freeAhead(a);
  if (f.n === Infinity) {
    a.st = 'fly'; a.v = 0.06; for (const c of a.cells) occ[c[1] * cols + c[0]] = -1;
    const now = performance.now(); combo = now - lastClear < 1300 ? combo + 1 : 1; lastClear = now;
    const pts = 10 * Math.min(combo, 8); score += pts;
    const cleared = total - left(); ui.progress(cleared / total);
    note(67 + [0, 2, 4, 7, 9, 12, 14, 16, 19][Math.min(cleared, 50) % 9] + (cleared > 8 ? 0 : 0), 0.32, 0.13);
    tone(900, 0.12, 'sine', 0.05, 1.8); buzz(8);
    if (combo >= 3) ui.pop(`COMBO ×${combo}`, theme.ui, 30 + Math.min(combo, 6) * 2, 16);
    const [hx, hy] = cen(a.cells[a.len - 1]); sparks(hx, hy, [a.col, '#fff'], 10, 3);
    if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); confetti(70); }
    hud();
  } else {
    a.st = 'bonk'; a.target = f.n + 0.32; a.back = 0; a.by = f.by; a.o = 0;
    tone(320, 0.05, 'triangle', 0.1, 0.9);
  }
}
function bonkHit(a) {
  hearts--; hud(); shakeT = 1; buzz([20, 40, 30]); sfx.fail();
  const b = arrows[a.by]; if (b) b.shake = 1; a.hit = 1;
  const [hx, hy] = sample(a, a.o + a.len - 1); sparks(hx, hy, ['#ff4f6d', '#ffffff', '#ffd23f'], 12, 3.5);
  if (hearts > 0) ui.pop('BLOCKED!', '#ff4f6d', 30, 22);
  if (hearts <= 0) lose();
}
function win() {
  if (state !== 'play') return;
  state = 'won'; wonAt = performance.now();
  if (!recorded) { recorded = true; F.level(true); B.submit(1, { ms: performance.now() - t0 }); }
  const lv = D.isDaily ? dLevel : level;
  if (D.isDaily) dLevel++; else { level++; S.set('level', level); }
  best = Math.max(best, score); S.set('best', best);
  sfx.win(); buzz([20, 30, 20]); confetti(120); ui.flash(0.4);
  D.won(lv, 'cleared level');
  ui.win(lv, D.isDaily ? `Daily set ${lv} · ${score} pts` : `${score} pts`);
}
function lose() {
  if (state !== 'play') return;
  state = 'lost';
  if (!recorded) { recorded = true; F.level(false, (total - left()) / Math.max(1, total)); }
  ui.lose('OUT OF HEARTS', `${total - left()} of ${total} arrows out`);
}

// ---------------------------------------------------------------- particles
function sparks(x, y, colors, n = 10, sp = 3) {
  for (let i = 0; i < n; i++) { const a = Math.random() * 7, s = sp * (0.4 + Math.random()); parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0.05, life: 1, d: 0.025 + Math.random() * 0.02, s: 2 + Math.random() * 3, c: colors[i % colors.length], k: 'dot' }); }
}
function confetti(n) {
  const cs = theme.cols.concat(['#ffffff', '#ffd23f']);
  for (let i = 0; i < n; i++) parts.push({ x: W * Math.random(), y: -20 - Math.random() * H * 0.3, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 3, g: 0.06, life: 1, d: 0.006 + Math.random() * 0.004, s: 4 + Math.random() * 4, c: cs[i % cs.length], k: 'conf', r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3 });
}

// ---------------------------------------------------------------- drawing
function sample(a, t) {
  const p = a.path, i = clamp(Math.floor(t), 0, p.length - 2), f = clamp(t - i, 0, 1);
  const [x1, y1] = p[i], [x2, y2] = p[i + 1];
  return [geo.x + (x1 + (x2 - x1) * f + 0.5) * geo.cs, geo.y + (y1 + (y2 - y1) * f + 0.5) * geo.cs];
}
function rrect(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function shade(hex, k) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, gg = (n >> 8) & 255, b = n & 255; r = clamp(Math.round(r * k), 0, 255); gg = clamp(Math.round(gg * k), 0, 255); b = clamp(Math.round(b * k), 0, 255); return `rgb(${r},${gg},${b})`; }
function drawArrow(a, now) {
  const { cs } = geo, t0a = a.o, t1 = a.o + a.len - 1;
  const pts = [sample(a, t0a)]; for (let k = Math.ceil(t0a + 1e-6); k < t1; k++) pts.push(sample(a, k)); pts.push(sample(a, t1));
  let sx = 0, sy = 0;
  if (a.shake > 0) { sx = Math.sin(now / 22) * cs * 0.12 * a.shake; }
  const lw = Math.max(5, cs * 0.24), col = a.hit > 0 ? mix(a.col, '#ff3355', a.hit) : a.col;
  g.save(); g.translate(sx, sy); g.lineCap = 'round'; g.lineJoin = 'round';
  const stroke = (c, w, oy) => { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y + oy) : g.moveTo(x, y + oy)); g.stroke(); };
  stroke('rgba(40,30,90,.16)', lw, lw * 0.45);
  stroke(shade(col, 0.78), lw, lw * 0.18);
  stroke(col, lw, 0);
  stroke('rgba(255,255,255,.35)', lw * 0.28, -lw * 0.18);
  // arrow head along the last segment direction
  const [hx, hy] = pts[pts.length - 1], [px, py] = sample(a, t1 - 0.2); let ang = Math.atan2(hy - py, hx - px);
  if (!isFinite(ang) || (hx === px && hy === py)) ang = Math.atan2(DIRS[a.dir][1], DIRS[a.dir][0]);
  const hs = cs * 0.36 + lw * 0.3;
  const tri = (oy, c) => { g.save(); g.translate(hx, hy + oy); g.rotate(ang); g.fillStyle = c; g.beginPath(); g.moveTo(hs * 0.75, 0); g.lineTo(-hs * 0.45, -hs * 0.62); g.quadraticCurveTo(-hs * 0.2, 0, -hs * 0.45, hs * 0.62); g.closePath(); g.fill(); g.restore(); };
  tri(lw * 0.45, 'rgba(40,30,90,.16)'); tri(lw * 0.18, shade(col, 0.78)); tri(0, col);
  g.restore();
  if (a.st === 'fly' && Math.random() < 0.6) parts.push({ x: hx, y: hy, vx: (Math.random() - 0.5), vy: (Math.random() - 0.5), g: 0, life: 0.7, d: 0.04, s: lw * 0.35, c: a.col, k: 'dot' });
}
function mix(a, b, k) { const p = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; const A = p(a), Bc = p(b); return '#' + A.map((v, i) => Math.round(v + (Bc[i] - v) * k).toString(16).padStart(2, '0')).join(''); }

function draw(now) {
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const { x, y, cs } = geo, bw = cs * cols, bh = cs * rows;
  let ox = 0; if (shakeT > 0) ox = Math.sin(now / 18) * 6 * shakeT;
  g.save(); g.translate(ox, 0);
  // board card
  g.save(); g.shadowColor = 'rgba(70,50,140,.16)'; g.shadowBlur = 30; g.shadowOffsetY = 12; rrect(x - 12, y - 12, bw + 24, bh + 24, 22); g.fillStyle = 'rgba(255,255,255,.88)'; g.fill(); g.restore();
  g.fillStyle = 'rgba(90,70,170,.13)';
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { g.beginPath(); g.arc(x + (i + 0.5) * cs, y + (j + 0.5) * cs, Math.max(1.5, cs * 0.05), 0, 7); g.fill(); }
  if (wonAt) { const k = clamp((now - wonAt) / 600, 0, 1); g.fillStyle = `rgba(255,255,255,${0.5 * (1 - k)})`; rrect(x - 12, y - 12, bw + 24, bh + 24, 22); g.fill(); }
  // clip flying arrows softly to a generous area so they leave the screen cleanly
  for (const a of arrows) if (a.st !== 'gone' && a.st !== 'fly') drawArrow(a, now);
  for (const a of arrows) if (a.st === 'fly') drawArrow(a, now);
  g.restore();
  // particles
  for (const p of parts) {
    p.vy += p.g; p.x += p.vx; p.y += p.vy; p.life -= p.d; g.globalAlpha = clamp(p.life * 1.5, 0, 1); g.fillStyle = p.c;
    if (p.k === 'conf') { p.r += p.vr; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.scale(1, Math.cos(p.r * 2)); g.fillRect(-p.s, -p.s * 0.45, p.s * 2, p.s * 0.9); g.restore(); }
    else { g.beginPath(); g.arc(p.x, p.y, p.s * Math.max(0.2, p.life), 0, 7); g.fill(); }
  }
  g.globalAlpha = 1; parts = parts.filter(p => p.life > 0 && p.y < H + 40);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(2.5, (now - last) / 16.67); last = now;
  for (const a of arrows) {
    if (a.st === 'fly') {
      a.v = Math.min(a.v + 0.035 * dt, 1.1); a.o += a.v * dt;
      const [hx, hy] = sample(a, a.o); if (a.o > a.len + 2 && (hx < -60 || hy < -60 || hx > W + 60 || hy > H + 60 || a.o > a.path.length - a.len - 1)) a.st = 'gone';
    } else if (a.st === 'bonk') {
      if (!a.back) { a.o = Math.min(a.target, a.o + 0.45 * dt); if (a.o >= a.target) { a.back = 1; bonkHit(a); } }
      else { a.o = Math.max(0, a.o - 0.22 * dt); if (a.o <= 0) { a.o = 0; a.st = 'idle'; } }
    }
    a.hit = Math.max(0, a.hit - 0.03 * dt); a.shake = Math.max(0, a.shake - 0.04 * dt);
  }
  shakeT = Math.max(0, shakeT - 0.06 * dt);
  if (state === 'play' && arrows.every(a => a.st === 'gone' || a.st === 'fly') && arrows.filter(a => a.st === 'fly').every(a => a.o > a.len)) win();
  draw(now); requestAnimationFrame(frame);
}

input({ onTap: e => tapAt(e.clientX, e.clientY) });
ui.onTap(w => {
  if (w === 'win' || w === 'lose') buildLevel();
  state = 'play'; t0 = performance.now(); B.start(); score = w === 'lose' ? score : score; hud();
});
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on level 1, until the first touch,
// two arrows with a clear way out fly off the board by themselves (points handed back, never the last arrows)
demo(() => {
  if (arrows.filter(q => q.st === 'idle').length < 4) return false;
  const a = arrows.find(q => q.st === 'idle' && freeAhead(q).n === Infinity); if (!a) return false;
  const s0 = score; fire(a); score = s0; hud();
}, { ready: () => state === 'play' && (D.isDaily ? dLevel : level) === 1, wait: 1800, every: 1300, max: 2, ms: 15000 });

resize(); buildLevel(); ui.start(); requestAnimationFrame(frame);

window.__game = {
  get state() { return state; }, get level() { return D.isDaily ? dLevel : level; }, get score() { return score; },
  bot() {
    if (state !== 'play') return;
    const a = arrows.find(q => q.st === 'idle' && freeAhead(q).n === Infinity);
    if (a) fire(a);
  },
};
