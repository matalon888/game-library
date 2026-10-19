// Slinko — the classic grid snake. Swipe (or use the pad / arrow keys) to turn, eat berries to grow, don't bite
// yourself. Every 5 berries the snake gets faster and berries are worth more. Golden fruit shows up for a few
// seconds. Two modes: Walls (classic) or Wrap (edges loop around, half points).
import { createUI, store, buzz, sfx, tone, note, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { css, BASE_CSS, ICON, stage2d, rr, fx as mkfx, hud as mkhud, keys, swiper, touchy, dressStart, paused } from './neo.js';

const NAME = 'Slinko: Classic Snake Game';
const SAVE = store('slinko');
let best = SAVE.get('best', 0), wrap = SAVE.get('wrap', 0);
const F = flow('slinko', { par: 250, warmup: 40 });
css(BASE_CSS + `body{--acc:#3dffb0;--acc2:#ffe066;--bgA:#082019;--bgB:#14523f;--bgC:#04120d}
.sl-dpad{position:fixed;left:50%;bottom:calc(14px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:7;display:grid;grid-template-columns:repeat(3,62px);grid-template-rows:repeat(3,54px);gap:6px;pointer-events:none}
.sl-dpad .neo-btn{max-width:none;height:54px;border-radius:18px}
.sl-dpad .u{grid-area:1/2}.sl-dpad .l{grid-area:2/1}.sl-dpad .r{grid-area:2/3}.sl-dpad .d{grid-area:3/2}
.sl-dpad .hub{grid-area:2/2;border-radius:50%;margin:10px;background:radial-gradient(circle,rgba(61,255,176,.25),rgba(61,255,176,0) 70%)}
.sl-dpad.hide{display:none}`);
const ui = createUI({ title: 'SLINKO', hint: 'Tap to play', hand: '👆', progress: false, score: false });
const D = daily('slinko', ui, { name: NAME });
const B = board({ game: 'slinko', label: 'Points', limits: { maxRun: 30000, maxPerSec: 40 }, corner: 'tl' });
const SD = dressStart(ui, { kicker: 'CLASSIC SNAKE', line: 'Swipe to turn · eat berries · don\'t bite your tail', best,
  chips: { items: ['Walls', 'Wrap · ½ pts'], get: () => wrap, set: i => { wrap = i; SAVE.set('wrap', i); } } });
ui.els.lose.querySelector('.hint').textContent = 'Tap to play again';
const S = stage2d(), ctx = S.ctx, FX = mkfx(), H = mkhud('SCORE');

const GW = 16, GH = 22, DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }, OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
let state = 'ready', score = 0, eaten = 0, recorded = false, beatenShown = false, R = Math.random;
let snake = [], prev = [], dir = 'right', q = [], acc = 0, food = null, gold = null, grow = 0, gulps = [], deadT = 0, popI = 0, tickMs = 150, speedTier = 0, lastMode = 0;

const level = () => 1 + Math.floor(eaten / 5);
const interval = () => Math.max(50, 136 - eaten * 2.2) / F.k(score);
const occupied = (x, y, skipTail = false) => snake.some((s, i) => (!skipTail || i < snake.length - 1) && s[0] === x && s[1] === y);
function freeCell() {
  for (let k = 0; k < 400; k++) { const x = Math.floor(R() * GW), y = Math.floor(R() * GH); if (!occupied(x, y) && !(food && food[0] === x && food[1] === y) && !(gold && gold.x === x && gold.y === y)) return [x, y]; }
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (!occupied(x, y)) return [x, y]; return null;
}
function reset() {
  R = rng(D.seed || (Date.now() % 1e9) + 5); lastMode = wrap;
  const y = Math.floor(GH / 2); snake = [[6, y], [5, y], [4, y], [3, y]]; prev = snake.map(s => s.slice());
  dir = 'right'; q = []; acc = 0; grow = 0; eaten = 0; score = 0; recorded = false; beatenShown = false; gold = null; gulps = []; speedTier = 0; deadT = 0; popI = 0;
  food = freeCell(); food.t = 0; H.score(0);
}
function turn(d) {
  if (state !== 'play') return;
  const lastD = q.length ? q[q.length - 1] : dir;
  if (d === lastD || d === OPP[lastD] || q.length >= 2) return;
  q.push(d); tone(380 + Object.keys(DIRS).indexOf(d) * 40, 0.035, 'sine', 0.05, 1.1);
}
function addScore(n) { score += n; H.score(score); if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); confetti(); sfx.win(); } }
function confetti() { FX.burst(S.w / 2, S.h * 0.4, ['#3dffb0', '#ffe066', '#ff5f7e', '#5ec8ff', '#fff'], 60, { speed: 420, life: 1.3, size: 6, grav: 380, drag: 1.4 }); }
const cellC = (x, y) => [L.bx + (x + 0.5) * L.c, L.by + (y + 0.5) * L.c];

function tick() {
  if (q.length) dir = q.shift();
  const [dx, dy] = DIRS[dir], h = snake[0]; let nx = h[0] + dx, ny = h[1] + dy;
  if (wrap) { nx = (nx + GW) % GW; ny = (ny + GH) % GH; }
  else if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) return die('BONK!');
  const willEat = food && nx === food[0] && ny === food[1], willGold = gold && nx === gold.x && ny === gold.y;
  if (occupied(nx, ny, grow === 0)) return die('OUCH!');
  prev = snake.map(s => s.slice());
  snake.unshift([nx, ny]);
  if (grow > 0) { grow--; prev.push(prev[prev.length - 1].slice()); } else snake.pop();
  if (willEat) {
    eaten++; grow += 1; const pts = Math.round(10 * level() * (wrap ? 0.5 : 1)); addScore(pts);
    const [cx, cy] = cellC(nx, ny);
    FX.burst(cx, cy, ['#ff5f7e', '#ffd1dc', '#ffffff'], 16, { speed: 220, life: 0.55, size: 4, grav: 200 }); FX.ring(cx, cy, '#ff5f7e', 4, L.c * 1.6, 0.4, 3);
    FX.text(cx, cy - L.c * 0.6, '+' + pts, '#ffe066', 20, 0.8);
    note(60 + [0, 2, 4, 7, 9, 12, 14, 16][eaten % 8], 0.16, 0.13); buzz(10); gulps.push(0);
    if (eaten % 5 === 0) { ui.pop(`FASTER! ×${level()}`, '#3dffb0', 36, 30); FX.flash('#3dffb0', 0.12); sfx.coin(); }
    if (eaten % 7 === 0 && !gold) { const c = freeCell(); if (c) gold = { x: c[0], y: c[1], t: 6 }; }
    food = freeCell(); if (food) food.t = 0;
  }
  if (willGold) {
    const pts = Math.round(50 * level() * (wrap ? 0.5 : 1)); addScore(pts); grow += 2; const [cx, cy] = cellC(nx, ny);
    FX.burst(cx, cy, ['#ffe066', '#fff4b0', '#ffffff'], 26, { speed: 300, life: 0.8, size: 5, grav: 160 }); FX.ring(cx, cy, '#ffe066', 4, L.c * 2.4, 0.5, 4);
    FX.text(cx, cy - L.c * 0.6, 'GOLDEN +' + pts, '#ffe066', 24, 1); sfx.coin(); buzz([10, 20, 10]); gold = null; gulps.push(0);
  }
  if (!food) die('FULL!');
}
function die(why) {
  if (state !== 'play') return; state = 'lost'; deadT = 0; popI = 0;
  if (!recorded) { recorded = true; F.endless(score); B.submit(score); }
  const nb = score > best && score > 0; best = Math.max(best, score); SAVE.set('best', best); SD.setBest(best);
  FX.shake(12); FX.flash('#ff4d6d', 0.3); sfx.fail(); buzz([40, 30, 80]);
  ui.lose(nb ? 'NEW BEST!' : why, `Score ${score} · Length ${snake.length} · Best ${best}`);
}
let runT0 = 0;
ui.onTap(() => { reset(); state = 'play'; B.start(); runT0 = performance.now(); });

// ---------------------------------------------------------------- controls
const dp = document.createElement('div'); dp.className = 'sl-dpad';
for (const [d, cls] of [['up', 'u'], ['left', 'l'], ['right', 'r'], ['down', 'd']]) {
  const b = document.createElement('button'); b.className = 'neo-btn ' + cls; b.innerHTML = ICON[d]; b.setAttribute('aria-label', d);
  b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); b.classList.add('on'); turn(d); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => b.classList.remove('on'));
  dp.appendChild(b);
}
const hub = document.createElement('div'); hub.className = 'hub'; dp.appendChild(hub); document.body.appendChild(dp);
swiper(S.cv, { step: 20, onDir: d => turn(d) });
keys({ 'ArrowUp|w|W': { press: () => turn('up') }, 'ArrowDown|s|S': { press: () => turn('down') }, 'ArrowLeft|a|A': { press: () => turn('left') }, 'ArrowRight|d|D': { press: () => turn('right') },
  ' |Enter': { press: () => { for (const k of ['start', 'lose']) { const c = ui.els[k]; if (!c.classList.contains('hc-hidden')) { c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return; } } } } });
const keyHint = document.createElement('div'); keyHint.className = 'neo-keys'; keyHint.innerHTML = '<kbd>←</kbd><kbd>↑</kbd><kbd>↓</kbd><kbd>→</kbd> or <kbd>WASD</kbd> to turn'; document.body.appendChild(keyHint);

// ---------------------------------------------------------------- layout + drawing
const L = { c: 20, bx: 0, by: 0 };
S.onResize = (w, h) => {
  const t = touchy(); dp.classList.toggle('hide', !t); keyHint.style.display = t ? 'none' : 'block';
  const top = 70, bottom = t ? 206 : 44;
  L.c = Math.floor(Math.min((w - 24) / GW, (h - top - bottom) / GH)); L.bx = Math.round((w - L.c * GW) / 2); L.by = Math.round(top + (h - top - bottom - L.c * GH) / 2);
};
S.fit();
function drawFood(x, y, c, t, kind) {
  const r = c * 0.36 * (1 + 0.06 * Math.sin(t * 6));
  ctx.save(); ctx.translate(x, y);
  if (kind === 'gold') {
    ctx.rotate(t * 1.5); ctx.shadowColor = '#ffe066'; ctx.shadowBlur = 18; ctx.fillStyle = '#ffe066'; ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr2 = i % 2 ? r * 0.5 : r * 1.15; ctx.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); } ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(-r * 0.2, -r * 0.25, r * 0.22, 0, 7); ctx.fill();
  } else {
    ctx.shadowColor = '#ff5f7e'; ctx.shadowBlur = 16; ctx.fillStyle = '#ff5f7e'; ctx.beginPath(); ctx.arc(0, r * 0.1, r, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#3dffb0'; ctx.beginPath(); ctx.ellipse(r * 0.35, -r * 0.95, r * 0.45, r * 0.2, -0.6, 0, 7); ctx.fill();
    ctx.strokeStyle = '#2a8a5c'; ctx.lineWidth = Math.max(1.5, c * 0.07); ctx.beginPath(); ctx.moveTo(0, -r * 0.7); ctx.lineTo(r * 0.05, -r * 1.05); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.15, r * 0.22, 0, 7); ctx.fill();
  }
  ctx.restore();
}
function draw(t, a) {
  S.begin(); const c = L.c, [sx, sy] = FX.offset(); ctx.save(); ctx.translate(sx, sy);
  const bw = c * GW, bh = c * GH;
  ctx.save(); ctx.shadowColor = wrap ? '#5ec8ff' : '#3dffb0'; ctx.shadowBlur = 26; rr(ctx, L.bx - 6, L.by - 6, bw + 12, bh + 12, 18); ctx.fillStyle = '#0a2a20'; ctx.fill(); ctx.restore();
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if ((x + y) % 2) { ctx.fillStyle = 'rgba(255,255,255,.035)'; ctx.fillRect(L.bx + x * c, L.by + y * c, c, c); }
  rr(ctx, L.bx - 6, L.by - 6, bw + 12, bh + 12, 18); ctx.lineWidth = 2.5;
  if (wrap) { ctx.setLineDash([8, 7]); ctx.lineDashOffset = -t * 20; ctx.strokeStyle = '#5ec8ff'; } else ctx.strokeStyle = 'rgba(61,255,176,.8)';
  ctx.stroke(); ctx.setLineDash([]);
  ctx.save(); rr(ctx, L.bx - 2, L.by - 2, bw + 4, bh + 4, 14); ctx.clip();
  if (food) drawFood(...cellC(food[0], food[1]), c, t, 'berry');
  if (gold) { ctx.globalAlpha = gold.t < 2 ? 0.4 + 0.6 * Math.abs(Math.sin(t * 10)) : 1; drawFood(...cellC(gold.x, gold.y), c, t, 'gold'); ctx.globalAlpha = 1;
    const [gx, gy] = cellC(gold.x, gold.y); ctx.strokeStyle = 'rgba(255,224,102,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(gx, gy, c * 0.62, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * gold.t / 6); ctx.stroke(); }
  // snake body: interpolated points, thick rounded strokes with a head-to-tail gradient
  const n = snake.length, pts = [], live = state === 'play';
  const lerpP = (o, p, k) => (Math.abs(p[0] - o[0]) + Math.abs(p[1] - o[1]) === 1 && live) ? [o[0] + (p[0] - o[0]) * k, o[1] + (p[1] - o[1]) * k] : p;
  const toS = ([x, y]) => [L.bx + (x + 0.5) * c, L.by + (y + 0.5) * c];
  pts.push(toS(lerpP(snake[1] || snake[0], snake[0], a)));
  for (let i = 1; i < n; i++) pts.push(toS(snake[i]));
  const pt = prev[n - 1] || snake[n - 1]; if (n > 1) pts.push(toS(lerpP(pt, snake[n - 1], a)));
  const dead = state === 'lost';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = pts.length - 1; i >= 1; i--) {
    if (dead && i < popI) continue;
    const [x1, y1] = pts[i], [x0, y0] = pts[i - 1]; if (Math.abs(x1 - x0) > c * 1.5 || Math.abs(y1 - y0) > c * 1.5) continue;
    const k = Math.min(1, i / Math.max(1, n - 1)), gb = gulps.reduce((m, g) => Math.max(m, 1 - Math.min(1, Math.abs(g * 1 - i) / 1.5)), 0);
    ctx.strokeStyle = dead ? `hsl(${150 - k * 30},20%,${55 - k * 15}%)` : `hsl(${92 + k * 70},100%,${62 - k * 10}%)`;
    ctx.lineWidth = c * (0.78 - k * 0.22 + gb * 0.25); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x0, y0); ctx.stroke();
  }
  // glossy stripe along the body
  ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = c * 0.12; ctx.beginPath(); let started = false;
  for (let i = 0; i < pts.length; i++) { const [x, y] = pts[i]; if (i && (Math.abs(x - pts[i - 1][0]) > c * 1.5 || Math.abs(y - pts[i - 1][1]) > c * 1.5)) { started = false; } if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y); }
  ctx.stroke();
  // head
  if (!(dead && popI > 0)) {
    const [hx, hy] = pts[0], [dx, dy] = DIRS[dir], px = -dy, py = dx;
    ctx.save(); ctx.shadowColor = '#b8ff4a'; ctx.shadowBlur = dead ? 0 : 16; ctx.fillStyle = dead ? '#8aa79a' : '#c4ff5a'; ctx.beginPath(); ctx.arc(hx, hy, c * 0.47, 0, 7); ctx.fill(); ctx.restore();
    if (!dead && Math.sin(t * 7) > 0.6) { ctx.strokeStyle = '#ff5f7e'; ctx.lineWidth = Math.max(1.5, c * 0.08); ctx.beginPath(); ctx.moveTo(hx + dx * c * 0.42, hy + dy * c * 0.42); ctx.lineTo(hx + dx * c * 0.75, hy + dy * c * 0.75); ctx.lineTo(hx + dx * c * 0.85 + px * c * 0.1, hy + dy * c * 0.85 + py * c * 0.1); ctx.moveTo(hx + dx * c * 0.75, hy + dy * c * 0.75); ctx.lineTo(hx + dx * c * 0.85 - px * c * 0.1, hy + dy * c * 0.85 - py * c * 0.1); ctx.stroke(); }
    for (const s of [-1, 1]) {
      const ex = hx + dx * c * 0.12 + px * s * c * 0.22, ey = hy + dy * c * 0.12 + py * s * c * 0.22;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, c * 0.15, 0, 7); ctx.fill();
      ctx.fillStyle = '#0a2a20'; if (dead) { ctx.strokeStyle = '#0a2a20'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ex - c * 0.08, ey - c * 0.08); ctx.lineTo(ex + c * 0.08, ey + c * 0.08); ctx.moveTo(ex + c * 0.08, ey - c * 0.08); ctx.lineTo(ex - c * 0.08, ey + c * 0.08); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(ex + dx * c * 0.05, ey + dy * c * 0.05, c * 0.08, 0, 7); ctx.fill(); }
    }
    ctx.fillStyle = 'rgba(255,120,150,.45)'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(hx - dx * c * 0.12 + px * s * c * 0.32, hy - dy * c * 0.12 + py * s * c * 0.32, c * 0.08, 0, 7); ctx.fill(); }
  }
  ctx.restore();
  // speed meter under the board
  ctx.fillStyle = 'rgba(255,255,255,.62)'; ctx.font = "800 12px 'Baloo 2',system-ui"; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(`SPEED ${level()}  ·  LENGTH ${snake.length}${wrap ? '  ·  WRAP ½' : ''}`, L.bx, L.by + bh + 12);
  FX.draw(ctx); ctx.restore(); FX.drawFlash(ctx, S.w, S.h);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!paused()) {
    if (state === 'play') {
      acc += dt * 1000; const iv = interval();
      while (acc >= iv && state === 'play') { acc -= iv; tick(); }
      if (gold) { gold.t -= dt; if (gold.t <= 0) { gold = null; } }
      gulps = gulps.map(g => g + dt * 1000 / iv).filter(g => g < snake.length + 2);
    } else if (state === 'lost') {
      deadT += dt; const want = Math.floor(deadT * 26);
      while (popI < Math.min(want, snake.length)) { const [x, y] = cellC(snake[popI][0], snake[popI][1]); FX.burst(x, y, ['#b8ff4a', '#3dffb0', '#fff'], 5, { speed: 140, life: 0.5, size: 4, grav: 250 }); if (popI % 3 === 0) tone(300 + popI * 9, 0.04, 'triangle', 0.05, 0.8); popI++; }
    }
  }
  FX.update(dt); H.stats([['BEST', Math.max(best, score)]]);
  draw(now / 1000, state === 'play' ? Math.min(1, acc / interval()) : 1);
  requestAnimationFrame(frame);
}
reset(); requestAnimationFrame(frame);

// ---------------------------------------------------------------- test hooks + bot (BFS to the berry, flood-fill when boxed in)
function bfs(sx, sy, tx, ty, blocked) {
  const prevA = new Int16Array(GW * GH).fill(-1), Q = [sy * GW + sx]; prevA[sy * GW + sx] = sy * GW + sx;
  while (Q.length) { const cur = Q.shift(), cx = cur % GW, cy = (cur / GW) | 0; if (cx === tx && cy === ty) { let k = cur; while (prevA[k] !== sy * GW + sx) k = prevA[k]; return k; }
    for (const [dx, dy] of Object.values(DIRS)) { let nx = cx + dx, ny = cy + dy; if (wrap) { nx = (nx + GW) % GW; ny = (ny + GH) % GH; } if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue; const id = ny * GW + nx; if (prevA[id] !== -1 || blocked[id]) continue; prevA[id] = cur; Q.push(id); } }
  return -1;
}
function area(x, y, blocked) { const seen = new Uint8Array(GW * GH), st = [y * GW + x]; let n = 0; seen[st[0]] = 1; while (st.length && n < 200) { const c = st.pop(); n++; const cx = c % GW, cy = (c / GW) | 0; for (const [dx, dy] of Object.values(DIRS)) { let nx = cx + dx, ny = cy + dy; if (wrap) { nx = (nx + GW) % GW; ny = (ny + GH) % GH; } if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue; const id = ny * GW + nx; if (seen[id] || blocked[id]) continue; seen[id] = 1; st.push(id); } } return n; }
window.__game = {
  get state() { return state; }, get level() { return level(); }, get score() { return score; }, get length() { return snake.length; },
  bot() {
    if (state !== 'play' || q.length) return;
    const blocked = new Uint8Array(GW * GH); snake.forEach((s, i) => { if (i < snake.length - 1) blocked[s[1] * GW + s[0]] = 1; });
    const [hx, hy] = snake[0], tgt = gold || (food && { x: food[0], y: food[1] });
    let step = tgt ? bfs(hx, hy, tgt.x, tgt.y, blocked) : -1, want = null;
    const opts = Object.keys(DIRS).filter(d => d !== OPP[dir]).map(d => { let nx = hx + DIRS[d][0], ny = hy + DIRS[d][1]; if (wrap) { nx = (nx + GW) % GW; ny = (ny + GH) % GH; } const ok = nx >= 0 && ny >= 0 && nx < GW && ny < GH && !blocked[ny * GW + nx]; return { d, nx, ny, ok, a: ok ? area(nx, ny, blocked) : -1 }; });
    if (step >= 0) { const o = opts.find(o => o.ny * GW + o.nx === step); if (o && o.a > snake.length * 0.6) want = o.d; }
    if (!want) { opts.sort((a, b) => b.a - a.a); want = opts[0].d; }
    if (Math.random() < 0.02 + (performance.now() - runT0) / 1000 * 0.01) want = opts[Math.floor(Math.random() * opts.length)].d;   // a human-ish slip now and then
    if (want !== dir) turn(want);
  },
};
