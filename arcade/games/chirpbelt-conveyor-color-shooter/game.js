// Chirpbelt — tap a chick to hop it onto the conveyor belt. It rides one lap around the picture and pecks every
// pixel of its own colour that it can see from the belt. Out of ammo → it flies home. Lap over with ammo left →
// it waits in a holding slot. Fill all 5 slots and the belt jams. Clear the whole picture to win.
import { createUI, store, sfx, note, tone, buzz, loop } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { COL, MOTIFS, ORDER, BGS } from './motifs.js';

const NAME = 'Chirpbelt: Conveyor Color Shooter';
const S = store('chirpbelt');
const F = flow('chirpbelt');
const ui = createUI({ title: 'Chirpbelt', hint: 'Tap a chick to send it round', hand: '👆', score: false });
const D = daily('chirpbelt', ui, { name: NAME });
const B = board({ game: 'chirpbelt', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 0.5 }, mode: 'sum', corner: 'tl' });
const CAP = 5, NH = 5;
const LKEY = D.isDaily ? 'dlevel' : 'level';

const st = document.createElement('style');
st.textContent = `.hc-card{background:rgba(48,32,84,.34)}.hc-card.dim{background:rgba(48,32,84,.5)}.hc-sub{display:none}
.hc-pop{text-shadow:0 3px 0 rgba(40,20,70,.35),0 0 14px rgba(255,255,255,.9)!important}.hc-card h1{letter-spacing:.5px}.hc-card .hint{margin-bottom:9vh}`;
document.head.appendChild(st);

const cv = document.createElement('canvas'); cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block;z-index:1;touch-action:none';
document.body.prepend(cv);
const g = cv.getContext('2d');
let W = 0, H = 0, dpr = 1;

// ---------------------------------------------------------------- helpers
function rng(seed) { let s = (Math.floor(seed) % 2147483647) || 1; if (s < 0) s += 2147483646; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function shade(hex, a) {   // a > 0 lighter, a < 0 darker
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, gg = (n >> 8) & 255, b = n & 255;
  const t = a > 0 ? 255 : 0, k = Math.abs(a);
  r = Math.round(r + (t - r) * k); gg = Math.round(gg + (t - gg) * k); b = Math.round(b + (t - b) * k);
  return `rgb(${r},${gg},${b})`;
}
function rr(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const ease = t => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
const SKY = [['#ffd6e8', '#fff1c9'], ['#c8f1ff', '#eafff3'], ['#e2d6ff', '#ffe3f4'], ['#ffe2bf', '#fff8de'], ['#c9f7e2', '#e8f1ff'], ['#ffd9d0', '#f1e6ff']];

// ---------------------------------------------------------------- state
let level = S.get(LKEY, 1), state = 'ready', score = S.get('score', 0);
let G = 10, grid = [], cols = [], colors = [], remaining = 0, total = 0, queues = [], hold = [], belt = [], shots = [], parts = [], pops = [], leavers = [];
let lay = {}, L = 0, speed = 300, sk = [], dieAt = [], recorded = false, beatShown = false, t0 = 0, now = 0, streak = 0, lastShot = 0, nextMilestone = 15, winAt = 0, sky = SKY[0], jamFlash = 0, bid = 0;

function build() {
  const seed = D.seed ? D.seed * 31 + level * 7 : level * 7919 + 13, r = rng(seed), fk = F.k();
  G = Math.round(Math.min(24, Math.max(10, (10 + (level - 1) * 1.15) * fk)));
  if (level === 1) G = 10;
  const name = level <= ORDER.length && !D.seed ? ORDER[level - 1] : ORDER[Math.floor(r() * ORDER.length)];
  const fn = MOTIFS[name]({ alt: r() < 0.4 });
  const useBg = level >= 3 && r() < 0.85;
  const names = [], cells = [];
  for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
    const u = ((x + 0.5) / G) * 2 - 1, v = ((y + 0.5) / G) * 2 - 1;
    cells.push(fn(u * 1.04, v * 1.04));
  }
  if (useBg) {
    const inPic = new Set(cells.filter(Boolean)); const opts = BGS.filter(b => !inPic.has(b));
    const bg = opts[Math.floor(r() * opts.length)] || 'sky';
    for (let i = 0; i < cells.length; i++) if (!cells[i]) cells[i] = bg;
  }
  for (const c of cells) if (c && !names.includes(c)) names.push(c);
  colors = names.map(n => COL[n]);
  grid = cells.map(c => c ? names.indexOf(c) : -1);
  dieAt = new Array(G * G).fill(0);
  total = remaining = grid.filter(v => v >= 0).length;
  // ammo: each colour's pixel count split into chunks; queue order leans outer colours first, with noise
  const cnt = colors.map((_, i) => grid.filter(v => v === i).length);
  const depth = colors.map((_, i) => { let s = 0, n = 0; grid.forEach((v, j) => { if (v === i) { const x = j % G, y = (j / G) | 0; s += Math.min(x, y, G - 1 - x, G - 1 - y); n++; } }); return n ? s / n : 0; });
  const base = G <= 13 ? 10 : G <= 17 ? 15 : 20, birds = [];
  cnt.forEach((n, c) => {
    let left = n;
    while (left > 0) { let k = Math.min(left, base * (1 + Math.floor(r() * 2))); if (left - k > 0 && left - k < 5) k = left; birds.push({ c, ammo: k, key: depth[c] + r() * G * Math.min(0.9, 0.3 + level * 0.05) }); left -= k; }
  });
  birds.sort((a, b) => a.key - b.key);
  const nq = Math.max(2, Math.min(5, Math.round((3 + Math.floor((level - 1) / 4)) / fk)));
  queues = Array.from({ length: nq }, () => []);
  birds.forEach((b, i) => { b.id = ++bid; b.px = 0; b.py = 0; b.sc = 1; queues[i % nq].push(b); });
  hold = new Array(NH).fill(null); belt = []; shots = []; parts = []; pops = []; leavers = [];
  recorded = false; beatShown = false; streak = 0; nextMilestone = 15; winAt = 0; jamFlash = 0;
  sky = SKY[(level - 1) % SKY.length];
  layout();
  for (const q of queues) q.forEach((b, i) => { const p = queuePos(queues.indexOf(q), i); b.px = p.x; b.py = p.y + 300; });
  ui.levels(level); ui.progress(0);
}

function layout() {
  dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  const S0 = Math.max(240, Math.min(W - 24, 440, H - 410)), m = Math.max(30, S0 * 0.09), X0 = (W - S0) / 2, Y0 = 64;
  const cell = (S0 - 2 * m) / G;
  const xl = X0 + m / 2, xr = X0 + S0 - m / 2, yt = Y0 + m / 2, yb = Y0 + S0 - m / 2;
  L = S0 - m;
  const sz = Math.min(58, (W - 40) / NH - 8), holdY = Y0 + S0 + 58;
  const nq = queues.length || 3, cw = Math.min(90, (W - 20) / nq), br = Math.min(31, cw * 0.36), qy = holdY + sz / 2 + 30 + br;
  lay = { S: S0, m, X0, Y0, cell, xl, xr, yt, yb, sz, holdY, cw, br, qy, gap: Math.max(br * 2.2, Math.min(br * 2.9, (H - 34 - qy) / 2.6)) };
  // belt coordinate of every row / column on each side
  sk = [[], [], [], []];
  for (let k = 0; k < G; k++) {
    const rc = Y0 + m + (k + 0.5) * cell, cc = X0 + m + (k + 0.5) * cell;
    sk[0][k] = yb - rc; sk[1][k] = L + (cc - xl); sk[2][k] = 2 * L + (rc - yt); sk[3][k] = 3 * L + (xr - cc);
  }
  const lapT = Math.min(4.4, 2.6 + (G - 10) * 0.12);
  speed = 4 * L / lapT;
}
addEventListener('resize', layout);

function beltPos(s) {
  const { xl, xr, yt, yb } = lay;
  if (s < L) return { x: xl, y: yb - s }; if (s < 2 * L) return { x: xl + (s - L), y: yt };
  if (s < 3 * L) return { x: xr, y: yt + (s - 2 * L) }; return { x: xr - Math.min(L, s - 3 * L), y: yb };
}
const holdPos = i => ({ x: W / 2 + (i - (NH - 1) / 2) * (lay.sz + 8), y: lay.holdY });
const queuePos = (q, i) => ({ x: W / 2 + (q - (queues.length - 1) / 2) * lay.cw, y: lay.qy + i * lay.gap });
const pixCenter = i => ({ x: lay.X0 + lay.m + ((i % G) + 0.5) * lay.cell, y: lay.Y0 + lay.m + (((i / G) | 0) + 0.5) * lay.cell });

// ---------------------------------------------------------------- rules
function firstFrom(side, k) {
  for (let j = 0; j < G; j++) {
    const i = side === 0 ? k * G + j : side === 1 ? j * G + k : side === 2 ? k * G + (G - 1 - j) : (G - 1 - j) * G + k;
    if (grid[i] >= 0) return i;
  }
  return -1;
}
function exposure() {
  const ex = new Set(); for (let s = 0; s < 4; s++) for (let k = 0; k < G; k++) { const i = firstFrom(s, k); if (i >= 0) ex.add(i); }
  const per = colors.map(() => 0); for (const i of ex) per[grid[i]]++; return per;
}
const canLaunch = () => state === 'play' && belt.length < CAP && !belt.some(rd => rd.s < 42);

function launch(b, from) {
  if (!canLaunch()) { buzz(8); tone(180, 0.06, 'square', 0.05, 0.8); if (belt.length >= CAP) ui.pop('Belt full!', '#fff', 26, 52); return false; }
  if (from.q !== undefined) queues[from.q].shift(); else hold[from.h] = null;
  belt.push({ b, s: 0, e: 0, x0: b.px, y0: b.py, hits: 0 });
  sfx.pick(belt.length); buzz(6);
  return true;
}
function fire(rd, side, k) {
  const i = firstFrom(side, k); if (i < 0 || grid[i] !== rd.b.c || rd.b.ammo <= 0) return;
  grid[i] = -1; remaining--; rd.b.ammo--; rd.hits++; score++;
  const p = beltPos(rd.s), q = pixCenter(i), d = Math.hypot(q.x - p.x, q.y - p.y), dur = Math.max(0.05, d / 1500);
  dieAt[i] = now + dur; shots.push({ x0: p.x, y0: p.y, x1: q.x, y1: q.y, t0: now, dur, c: rd.b.c, i });
  streak = now - lastShot < 0.45 ? streak + 1 : 1; lastShot = now;
  tone(620 + Math.min(streak, 40) * 14, 0.035, 'square', 0.035, 1.25);
  if (streak >= nextMilestone) { ui.pop(nextMilestone >= 50 ? 'AMAZING!' : nextMilestone >= 30 ? 'GREAT!' : 'NICE!', '#ff4f8b', 34 + Math.min(16, nextMilestone / 4), 47); nextMilestone += 15; buzz(10); }
  ui.progress(1 - remaining / total);
}
function update(dt) {
  now += dt;
  if (state !== 'play') return;
  for (let n = belt.length - 1; n >= 0; n--) {
    const rd = belt[n], ps = rd.s; rd.s += speed * dt; rd.e = Math.min(1, rd.e + dt / 0.22);
    for (let side = 0; side < 4; side++) for (let k = 0; k < G; k++) { const v = sk[side][k]; if (v > ps && v <= rd.s) fire(rd, side, k); }
    const p = beltPos(Math.min(rd.s, 4 * L - 0.01));
    if (rd.b.ammo <= 0) {           // empty: fly home
      belt.splice(n, 1); leavers.push({ b: rd.b, x: p.x, y: p.y, vx: (Math.random() - 0.5) * 120, vy: -260, t: 0 });
      tone(1250, 0.07, 'triangle', 0.08, 1.3); setTimeout(() => tone(1600, 0.09, 'triangle', 0.07, 1.2), 70);
      if (rd.hits >= 8) ui.pop(`+${rd.hits}`, colors[rd.b.c], 30, 46);
      continue;
    }
    if (rd.s >= 4 * L) {           // lap done with ammo left: into a holding slot or the belt jams
      belt.splice(n, 1); rd.b.px = p.x; rd.b.py = p.y;
      const h = hold.indexOf(null);
      if (h < 0) { lose(rd.b); return; }
      hold[h] = rd.b; tone(330, 0.08, 'triangle', 0.1, 0.8); buzz(8);
      if (hold.every(Boolean)) { ui.pop('Slots full!', '#ff5d6c', 28, 52); }
    }
  }
  if (remaining === 0 && !winAt) winAt = now + 0.35;
  if (winAt && now >= winAt) win();
}
function win() {
  if (state !== 'play') return;
  state = 'won';
  if (!recorded) { recorded = true; F.level(true); B.submit(1, { ms: performance.now() - t0 }); }
  for (const rd of belt) leavers.push({ b: rd.b, ...beltPos(rd.s), vx: (Math.random() - 0.5) * 160, vy: -300, t: 0 }); belt = [];
  confettiBurst(); sfx.win(); buzz([20, 40, 20]); ui.flash(0.45);
  [72, 76, 79, 84].forEach((n, i) => setTimeout(() => note(n, 0.4, 0.13), 420 + i * 90));
  const done = level; level++; S.set(LKEY, level); S.set('score', score);
  if (!beatShown && D.beaten(done)) { beatShown = true; setTimeout(() => ui.pop('BEATEN!', '#fff', 44, 30), 300); confettiBurst(); }
  D.won(done, 'cleared level');
  ui.win(done, `Picture painted · ${total} pixels`);
}
function lose(b) {
  if (state !== 'play') return;
  state = 'lost'; jamFlash = 1;
  if (!recorded) { recorded = true; F.level(false, 1 - remaining / total); }
  S.set('score', score);
  sfx.fail(); buzz([40, 30, 80]); ui.flash(0.3);
  ui.lose('BELT JAM!', `No slot left · ${Math.round(100 * (1 - remaining / total))}% painted`);
}

// ---------------------------------------------------------------- particles
function sparks(x, y, col, n = 6, sp = 140) {
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = sp * (0.4 + Math.random()); parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: 1, col, sz: 2 + Math.random() * 3.5, rot: Math.random() * 6, conf: false }); }
}
function confettiBurst() {
  const C = ['#ff5d8f', '#ffd23f', '#3ab795', '#3a86ff', '#9b6bff', '#ffffff'];
  for (let i = 0; i < 130; i++) parts.push({ x: W * Math.random(), y: -20 - Math.random() * 200, vx: (Math.random() - 0.5) * 120, vy: 120 + Math.random() * 200, life: 2.6, col: C[i % C.length], sz: 4 + Math.random() * 4, rot: Math.random() * 6, conf: true });
}

// ---------------------------------------------------------------- drawing
function drawBird(x, y, r, c, ammo, o = {}) {
  const base = colors[c] || '#ccc', sq = o.sq || 0, look = o.look || 0;
  g.save(); g.translate(x, y); g.scale(1 + sq * 0.12, 1 - sq * 0.12); g.globalAlpha = o.alpha ?? 1;
  g.fillStyle = 'rgba(40,20,60,.18)'; g.beginPath(); g.ellipse(0, r * 0.92, r * 0.8, r * 0.2, 0, 0, 7); g.fill();
  // tuft
  g.fillStyle = shade(base, -0.18);
  for (const [dx, dy, s] of [[-0.18, -0.98, 0.2], [0.04, -1.08, 0.24], [0.24, -0.96, 0.18]]) { g.beginPath(); g.ellipse(dx * r, dy * r, s * r * 0.8, s * r * 1.2, dx * 2, 0, 7); g.fill(); }
  // wings
  g.fillStyle = shade(base, -0.22);
  for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(sx * r * 0.9, r * 0.12, r * 0.28, r * 0.42, sx * (0.5 + (o.flap || 0)), 0, 7); g.fill(); }
  // body
  const gr = g.createRadialGradient(-r * 0.35, -r * 0.45, r * 0.15, 0, 0, r * 1.1);
  gr.addColorStop(0, shade(base, 0.38)); gr.addColorStop(0.55, base); gr.addColorStop(1, shade(base, -0.28));
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
  g.strokeStyle = shade(base, -0.4); g.lineWidth = Math.max(1.2, r * 0.07); g.stroke();
  // belly
  g.fillStyle = 'rgba(255,255,255,.32)'; g.beginPath(); g.ellipse(0, r * 0.38, r * 0.62, r * 0.5, 0, 0, 7); g.fill();
  // eyes + beak
  const ey = -r * 0.22;
  for (const sx of [-1, 1]) {
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(sx * r * 0.32, ey, r * 0.2, r * 0.23, 0, 0, 7); g.fill();
    g.fillStyle = '#2b2440'; g.beginPath(); g.arc(sx * r * 0.32 + look * r * 0.06, ey + r * 0.03, r * 0.11, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(sx * r * 0.32 + r * 0.04, ey - r * 0.04, r * 0.04, 0, 7); g.fill();
  }
  g.fillStyle = '#ffb02e'; g.beginPath(); g.moveTo(-r * 0.15, -r * 0.02); g.lineTo(r * 0.15, -r * 0.02); g.lineTo(0, r * 0.2); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,110,140,.35)'; for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(sx * r * 0.56, r * 0.06, r * 0.12, r * 0.07, 0, 0, 7); g.fill(); }
  // ammo
  if (ammo !== undefined) {
    const fs = Math.max(10, r * 0.62); g.font = `800 ${fs}px 'Baloo 2',system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = Math.max(2.5, fs * 0.22); g.strokeStyle = shade(base, -0.55); g.strokeText(ammo, 0, r * 0.5); g.fillStyle = '#fff'; g.fillText(ammo, 0, r * 0.5);
  }
  g.restore();
}
function draw() {
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const bgG = g.createLinearGradient(0, 0, 0, H); bgG.addColorStop(0, sky[0]); bgG.addColorStop(1, sky[1]); g.fillStyle = bgG; g.fillRect(0, 0, W, H);
  // soft dots in the background
  g.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 14; i++) { g.beginPath(); g.arc((i * 97) % W, (i * 173 + 40) % H, 3 + (i % 4) * 3, 0, 7); g.fill(); }
  const { S: S0, m, X0, Y0, cell, xl, yt } = lay;
  // machine body
  g.save(); g.shadowColor = 'rgba(60,30,90,.28)'; g.shadowBlur = 24; g.shadowOffsetY = 10; rr(X0 - 4, Y0 - 4, S0 + 8, S0 + 8, m * 0.7); g.fillStyle = '#6d63a8'; g.fill(); g.restore();
  rr(X0, Y0, S0, S0, m * 0.62); g.fillStyle = '#4b4380'; g.fill();
  // belt treads
  g.save(); g.lineCap = 'butt'; rr(xl, yt, L, L, m * 0.3); g.lineWidth = m * 0.74; g.strokeStyle = '#38315f'; g.stroke();
  g.setLineDash([3, 9]); g.lineDashOffset = -(now * speed) % 12; g.lineWidth = m * 0.6; g.strokeStyle = '#575089'; g.stroke(); g.restore();
  // picture panel
  const px = X0 + m - 5, py = Y0 + m - 5, pw = S0 - 2 * m + 10;
  rr(px, py, pw, pw, 10); g.fillStyle = '#efeaf7'; g.fill(); g.strokeStyle = '#2f2858'; g.lineWidth = 3; g.stroke();
  g.fillStyle = 'rgba(80,60,140,.07)';
  for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) if ((x + y) & 1) g.fillRect(X0 + m + x * cell, Y0 + m + y * cell, cell, cell);
  // pixels
  const pad = Math.max(0.6, cell * 0.06), rad = Math.max(1, cell * 0.2);
  for (let i = 0; i < G * G; i++) {
    let c = grid[i]; if (c < 0 && dieAt[i] > now) c = -2;
    if (c === -1) continue;
    const col = c === -2 ? null : colors[c];
    const x = X0 + m + (i % G) * cell + pad, y = Y0 + m + ((i / G) | 0) * cell + pad, w = cell - pad * 2;
    if (!col) continue;
    rr(x, y, w, w, rad); g.fillStyle = shade(col, -0.25); g.fill();
    rr(x, y, w, w - Math.max(1.5, w * 0.16), rad); g.fillStyle = col; g.fill();
    g.fillStyle = 'rgba(255,255,255,.38)'; g.fillRect(x + w * 0.2, y + w * 0.14, w * 0.32, Math.max(1, w * 0.12));
  }
  // targeted pixels (shot in flight) + pops
  for (const s of shots) {
    const k = (now - s.t0) / s.dur, x = X0 + m + (s.i % G) * cell + pad, y = Y0 + m + ((s.i / G) | 0) * cell + pad, w = cell - pad * 2;
    if (k < 1) { rr(x, y, w, w, rad); g.fillStyle = colors[s.c]; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke(); }
  }
  for (let n = pops.length - 1; n >= 0; n--) {
    const p = pops[n], k = (now - p.t0) / 0.22; if (k >= 1) { pops.splice(n, 1); continue; }
    const s = cell * (1 + k * 0.7); g.globalAlpha = 1 - k; rr(p.x - s / 2, p.y - s / 2, s, s, s * 0.25); g.fillStyle = '#fff'; g.fill(); g.globalAlpha = 1;
  }
  // shots
  for (let n = shots.length - 1; n >= 0; n--) {
    const s = shots[n], k = (now - s.t0) / s.dur;
    if (k >= 1) { shots.splice(n, 1); pops.push({ x: s.x1, y: s.y1, t0: now }); sparks(s.x1, s.y1, colors[s.c], 4, 110); continue; }
    const hx = s.x0 + (s.x1 - s.x0) * k, hy = s.y0 + (s.y1 - s.y0) * k, tk = Math.max(0, k - 0.35), tx = s.x0 + (s.x1 - s.x0) * tk, ty = s.y0 + (s.y1 - s.y0) * tk;
    g.lineCap = 'round'; g.strokeStyle = shade(colors[s.c], 0.5); g.lineWidth = 5; g.beginPath(); g.moveTo(tx, ty); g.lineTo(hx, hy); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(hx, hy, 3, 0, 7); g.fill();
  }
  // entry chute marker + belt count
  const fullB = belt.length >= CAP;
  g.font = `800 15px 'Baloo 2',system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const label = `${belt.length}/${CAP}`; rr(X0 + 8, Y0 + S0 + 6, 58, 24, 12); g.fillStyle = fullB ? '#ff5d6c' : 'rgba(75,67,128,.85)'; g.fill();
  g.fillStyle = '#fff'; g.fillText('🐤 ' + label, X0 + 37, Y0 + S0 + 19);
  // holding slots
  const nFull = hold.filter(Boolean).length;
  for (let i = 0; i < NH; i++) {
    const p = holdPos(i), s = lay.sz;
    rr(p.x - s / 2, p.y - s / 2, s, s, 14);
    g.fillStyle = nFull >= NH - 1 ? `rgba(255,93,108,${0.25 + 0.15 * Math.sin(now * 8)})` : 'rgba(75,67,128,.18)'; g.fill();
    g.strokeStyle = 'rgba(75,67,128,.35)'; g.lineWidth = 2; g.setLineDash([5, 5]); g.stroke(); g.setLineDash([]);
  }
  for (let i = 0; i < NH; i++) { const b = hold[i]; if (!b) continue; const p = holdPos(i); b.px += (p.x - b.px) * 0.25; b.py += (p.y - b.py) * 0.25; drawBird(b.px, b.py, lay.sz * 0.36, b.c, b.ammo, { sq: Math.sin(now * 3 + i) * 0.08 }); }
  // queues
  queues.forEach((q, qi) => {
    for (let i = Math.min(q.length, 3) - 1; i >= 0; i--) {
      const b = q[i], p = queuePos(qi, i); b.px += (p.x - b.px) * 0.22; b.py += (p.y - b.py) * 0.22;
      const front = i === 0, r = lay.br * (front ? 1 : 0.86 - i * 0.04);
      drawBird(b.px, b.py + (front ? Math.sin(now * 4 + qi) * 2 : 0), r, b.c, b.ammo, { alpha: front ? 1 : 0.8 - i * 0.12, sq: front ? Math.max(0, Math.sin(now * 4 + qi)) * 0.1 : 0 });
    }
    if (q.length > 3) { const p = queuePos(qi, 3); g.fillStyle = 'rgba(75,67,128,.7)'; g.font = `800 14px 'Baloo 2',system-ui,sans-serif`; g.fillText(`+${q.length - 3}`, p.x, p.y - lay.gap * 0.35); }
  });
  // riders on the belt
  for (const rd of belt) {
    const p = beltPos(Math.min(rd.s, 4 * L - 0.01)), e = ease(rd.e), hop = Math.sin(Math.min(1, rd.e) * Math.PI) * 40;
    const x = rd.x0 + (p.x - rd.x0) * e, y = rd.y0 + (p.y - rd.y0) * e - hop + Math.sin(now * 14 + rd.b.id) * 1.2;
    rd.b.px = x; rd.b.py = y;
    drawBird(x, y, m * 0.5, rd.b.c, rd.b.ammo, { sq: Math.abs(Math.sin(now * 14 + rd.b.id)) * 0.12 });
  }
  // leavers
  for (let n = leavers.length - 1; n >= 0; n--) {
    const l = leavers[n]; l.t += 1 / 60; l.x += l.vx / 60; l.y += l.vy / 60; l.vy += 120 / 60;
    if (l.t > 1.1) { leavers.splice(n, 1); continue; }
    drawBird(l.x, l.y, m * 0.43 * (1 + l.t * 0.3), l.b.c, undefined, { alpha: 1 - l.t / 1.1, flap: Math.sin(l.t * 40) * 0.8 });
    g.globalAlpha = 1 - l.t / 1.1; g.font = '16px system-ui'; g.fillText('♥', l.x + 16, l.y - 18 - l.t * 20); g.globalAlpha = 1;
  }
  // particles
  for (let n = parts.length - 1; n >= 0; n--) {
    const p = parts[n]; p.x += p.vx / 60; p.y += p.vy / 60; p.vy += (p.conf ? 40 : 380) / 60; p.rot += 0.15; p.life -= p.conf ? 1 / 60 : 2 / 60;
    if (p.life <= 0 || p.y > H + 20) { parts.splice(n, 1); continue; }
    g.save(); g.globalAlpha = Math.min(1, p.life); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.col;
    if (p.conf) { g.scale(1, Math.cos(p.rot * 2)); g.fillRect(-p.sz, -p.sz * 0.4, p.sz * 2, p.sz * 0.8); } else g.fillRect(-p.sz / 2, -p.sz / 2, p.sz, p.sz);
    g.restore();
  }
}

// ---------------------------------------------------------------- input
cv.addEventListener('pointerdown', e => {
  if (state !== 'play') return;
  const x = e.clientX, y = e.clientY;
  for (let i = 0; i < NH; i++) { const p = holdPos(i); if (hold[i] && Math.abs(x - p.x) < lay.sz / 2 + 4 && Math.abs(y - p.y) < lay.sz / 2 + 4) { launch(hold[i], { h: i }); return; } }
  for (let q = 0; q < queues.length; q++) {
    const p = queuePos(q, 0);
    if (Math.abs(x - p.x) < lay.cw / 2 && y > p.y - lay.br * 1.4 && y < p.y + lay.gap * 2.5) { if (queues[q].length) launch(queues[q][0], { q }); return; }
  }
});
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on level 1, until the first real touch,
// two birds hop from their queues onto the belt and shoot their colour (the bot's own pick), so tap-to-launch is shown
demo(() => { const n = belt.length; window.__game.bot(); if (belt.length === n) return false; },
  { ready: () => state === 'play' && level === 1 && !D.seed && canLaunch(), wait: 1800, every: 1500, max: 2 });
ui.onTap(w => {
  if (w === 'win' || w === 'lose') build();
  state = 'play'; t0 = performance.now(); B.start();
});

let last = performance.now();
loop(() => { const t = performance.now(), dt = Math.min(0.05, (t - last) / 1000); last = t; update(dt); draw(); });

build(); ui.start();

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  get dbg() { return { G, remaining, total, belt: belt.length, hold: hold.filter(Boolean).length, q: queues.map(q => q.length) }; },
  bot() {
    if (!canLaunch()) return;
    const ex = exposure(), onBelt = colors.map(() => 0); for (const rd of belt) onBelt[rd.b.c] += rd.b.ammo;
    let best = null, bv = -Infinity;
    const consider = (b, from, bonus) => { const v = Math.min(b.ammo, ex[b.c] - onBelt[b.c] * 0.6) + bonus; if (v > bv) { bv = v; best = { b, from }; } };
    hold.forEach((b, h) => b && consider(b, { h }, 0.5));
    queues.forEach((q, qi) => q.length && consider(q[0], { q: qi }, 0));
    if (!best) return;
    if (ex[best.b.c] <= 0 && belt.length) return;   // nothing to hit yet: wait for the belt to open things up
    if (bv <= 0 && belt.length && hold.filter(Boolean).length >= 3) return;
    launch(best.b, best.from);
  },
};
