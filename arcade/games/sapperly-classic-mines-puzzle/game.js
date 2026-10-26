// Sapperly — classic mines. Reveal every safe square; numbers count the mines touching a square.
// Tap to dig, long-press (or Flag mode) to plant a flag, tap a number whose flags are all placed to dig around it.
// The first dig is always safe and opens an area. Beginner / Intermediate / Expert, a daily board, hints, world board.
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { shell, rngf, rrect, ease, buzz, tone, soft, chime, arp, SVG } from './puzzle.js';

const DIFFS = [
  { name: 'Beginner', w: 9, h: 9, m: 10, value: 1 },
  { name: 'Intermediate', w: 16, h: 16, m: 40, value: 1 },
  { name: 'Expert', w: 16, h: 30, m: 99, value: 2 },
];
const NUM = ['', '#3b6fd6', '#2e9a62', '#e0524f', '#6b4fc8', '#b5582a', '#1d97a6', '#3a3340', '#8a8494'];
const GRASS = ['#a9d98b', '#9fd27f'], GRASS_DK = ['#8fc26f', '#86ba66'], DIRT = ['#f3e2c3', '#ecd8b5'];

let diff = 0, cur = DIFFS[0], W = 9, H = 9, M = 10, mine = [], adj = [], open = [], flag = [], first = true, attempt = 0;
let revealAt = new Map(), flagAt = new Map(), boomAt = 0, boomCell = -1, wonAt = 0, flagMode = false, press = null, geo = { x: 0, y: 0, s: 30 }, shakeT = 0, layoutSeed = 0, mineGoal = 10;
let hintCell = -1, hintAt = 0;

const B = board({ game: 'sapperly', label: 'Boards cleared (Expert ×2)', limits: { maxRun: 2, maxPerSec: 1 }, mode: 'sum', corner: 'tl' });
const st0 = JSON.parse(localStorage.getItem('sapperly_diff') || '0');
diff = Math.max(0, Math.min(2, +st0 || 0));
let builtDiff = -1;
const P = shell({
  B,
  key: 'sapperly', name: 'Sapperly: Classic Mines Puzzle', brand: 'Sapperly', kicker: 'classic mines', accent: '#4f9a4a', ink: '#2f3a2b',
  bg: ['#f3f7e9', '#dcebd2'], winWord: 'Field cleared!', dailyLevel: 5, top: 104, bottom: 100,
  rule: 'Dig every safe square. Numbers count touching mines. Long-press to flag.',
  chips: { items: DIFFS.map(d => d.name), get: () => diff, set: (i) => { diff = i; localStorage.setItem('sapperly_diff', i); } },
  needsRebuild: () => builtDiff !== diff,
  seedSalt: () => attempt * 104729 + diff * 7,
  tools: [
    { id: 'flag', label: 'Flag', svg: SVG.flag, onPress: (b) => { flagMode = !flagMode; b.classList.toggle('on', flagMode); soft.click(); buzz(6); } },
    'hint',
    { id: 'menu', label: 'Size', svg: SVG.grid, onPress: () => P.menu() },
  ],
  build(level, seed, fk) {
    const d = P && P.D && P.D.isDaily ? DIFFS[1] : DIFFS[diff];
    cur = d; builtDiff = diff; W = d.w; H = d.h;
    M = P && P.D && P.D.isDaily ? d.m : Math.round(Math.max(d.m * 0.85, Math.min(d.m * 1.2, d.m * fk)));
    mine = new Array(W * H).fill(0); adj = new Array(W * H).fill(0); open = new Array(W * H).fill(0); flag = new Array(W * H).fill(0);
    first = true; revealAt = new Map(); flagAt = new Map(); boomAt = 0; boomCell = -1; wonAt = 0; press = null; hintCell = -1; layoutSeed = seed;
    // place mines now (seeded) so a daily board is the same for everyone; the first dig moves any mine out of its way
    const r = rngf(seed), cells = Array.from({ length: W * H }, (_, i) => i);
    for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
    for (let k = 0; k < M; k++) mine[cells[k]] = 1;
    countAdj(); updateHud(); attempt++;
    return { label: `${d.name} · ${W}×${H} · ${M} mines`, sizeKey: d.name, cells: Math.round(W * H / 3), value: d.value };
  },
  layout(a) {
    const s = Math.floor(Math.min(a.w / W, (a.h - 8) / H, 44));
    geo = { s, x: Math.round(a.x + (a.w - s * W) / 2), y: Math.round(a.y + Math.max(4, (a.h - s * H) * 0.42)) };
  },
  snapshot: () => null, restore() {}, isEmpty: () => true, clear() {},
  hint() {
    if (first) { const c = (H >> 1) * W + (W >> 1); dig(c); flagHint(c); return true; }
    for (let c = 0; c < W * H; c++) if (flag[c] && !mine[c]) { flag[c] = 0; flagHint(c); P.ui.pop('No mine here', '#fff', 22, 40); updateHud(); return true; }
    const f = frontier(); if (f.length) { const c = f[(f.length / 2) | 0]; dig(c); flagHint(c); return true; }
    return false;
  },
  down(x, y) {
    const c = cellAt(x, y); if (c < 0) return;
    press = { c, x, y, t: performance.now(), long: false };
    press.timer = setTimeout(() => { if (press && press.c === c && !press.moved) { press.long = true; toggleFlag(c, true); } }, 340);
  },
  move(x, y) { if (press && Math.hypot(x - press.x, y - press.y) > 14) { press.moved = true; clearTimeout(press.timer); } },
  up(x, y) {
    if (!press) return; clearTimeout(press.timer); const p = press; press = null;
    if (p.long || p.moved) return;
    act(p.c);
  },
  tick() {},
  draw,
  debug: () => ({ W, H, M, first, opened: open.filter(Boolean).length }),
  bot() {
    if (wonAt || boomAt) return;
    if (first) { act((H >> 1) * W + (W >> 1)); return; }
    botN++;
    // every few moves plant a correct flag next to the open area, like a person would
    if (botN % 4 === 0) { for (let c = 0; c < W * H; c++) if (mine[c] && !flag[c] && !open[c] && nb(c).some(n => open[n])) { toggleFlag(c); return; } }
    const f = frontier(); const c = f.length ? f[0] : mine.findIndex((m, i) => !m && !open[i]);
    if (c >= 0) { if (flagMode) { flagMode = false; P.btns.flag.classList.remove('on'); } act(c); }
  },
});
let botN = 0;
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on the first board, until the first real
// touch, the always-safe first dig is made in the middle so the field opens up and shows its numbers
demo(() => { act((H >> 1) * W + (W >> 1)); },
  { ready: () => P.state === 'play' && first && P.level === 1 && !P.D.isDaily && !flagMode, wait: 2000, max: 1 });

function nb(c) { const x = c % W, y = (c / W) | 0, out = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < W && Y < H) out.push(Y * W + X); } return out; }
function countAdj() { for (let c = 0; c < W * H; c++) adj[c] = nb(c).reduce((a, n) => a + mine[n], 0); }
function cellAt(x, y) { const cx = Math.floor((x - geo.x) / geo.s), cy = Math.floor((y - geo.y) / geo.s); return cx < 0 || cy < 0 || cx >= W || cy >= H ? -1 : cy * W + cx; }
function center(c) { return [geo.x + (c % W + 0.5) * geo.s, geo.y + (((c / W) | 0) + 0.5) * geo.s]; }
function flagHint(c) { hintCell = c; hintAt = performance.now(); }
function frontier() { const out = []; for (let c = 0; c < W * H; c++) if (!open[c] && !mine[c] && !flag[c] && nb(c).some(n => open[n])) out.push(c); return out; }
function flagsLeft() { return M - flag.reduce((a, b) => a + b, 0); }
function updateHud() {
  let el = document.getElementById('sp-mines');
  if (!el) { el = document.createElement('span'); el.id = 'sp-mines'; document.getElementById('pz-time').prepend(el); }
  el.textContent = '⚑ ' + flagsLeft();
  const safe = W * H - M, n = open.reduce((a, b) => a + b, 0); P && P.progress && P.progress(n / safe);
}

function act(c) {
  if (P.state !== 'play' || wonAt || boomAt) return;
  if (open[c]) { chord(c); return; }
  if (flagMode) { toggleFlag(c); return; }
  if (flag[c]) { soft.wood(); return; }
  dig(c);
}
function toggleFlag(c, long = false) {
  if (open[c] || P.state !== 'play') return;
  flag[c] = flag[c] ? 0 : 1; flagAt.set(c, performance.now());
  if (flag[c]) { tone(760, 0.06, 'triangle', 0.1, 1.3); buzz(long ? 25 : 10); } else soft.click();
  updateHud();
}
function firstDig(c) {
  // move any mine on or around the first dig to the first free squares away from it (deterministic, so daily boards match)
  const keep = new Set([c, ...nb(c)]); const room = W * H - M >= keep.size;
  const moved = []; for (const k of keep) if (mine[k] && (k === c || room)) { mine[k] = 0; moved.push(k); }
  const r = rngf(layoutSeed + 99991), order = Array.from({ length: W * H }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  for (const k of order) { if (!moved.length) break; if (!mine[k] && !keep.has(k)) { mine[k] = 1; moved.pop(); } }
  countAdj(); first = false;
}
function dig(c) {
  if (first) firstDig(c);
  if (mine[c]) { explode(c); return; }
  // flood fill from c, staggered by distance for a ripple
  const t0 = performance.now(), [cx0, cy0] = [c % W, (c / W) | 0], q = [c], seen = new Set([c]); let n = 0;
  while (q.length) {
    const k = q.shift(); if (open[k] || flag[k]) continue;
    open[k] = 1; n++; revealAt.set(k, t0 + Math.hypot(k % W - cx0, ((k / W) | 0) - cy0) * 28);
    if (adj[k] === 0) for (const m of nb(k)) if (!seen.has(m) && !open[m] && !mine[m]) { seen.add(m); q.push(m); }
  }
  if (n > 8) { arp([72, 76, 79], 60, 0.07, 0.5); const [x, y] = center(c); P.fx.ring(x, y, '#fff', geo.s); }
  else { soft.wood(); tone(300 + adj[c] * 60, 0.05, 'triangle', 0.06, 0.7); }
  buzz(6);
  const [x, y] = center(c); P.fx.sparks(x, y, ['#d8b98a', '#f3e2c3', '#9fd27f'], Math.min(14, 4 + n), { speed: 2, size: 2.4, kind: 'dot', g: 0.12 });
  updateHud(); checkWin();
}
function chord(c) {
  if (!adj[c]) return;
  const ns = nb(c), f = ns.filter(n => flag[n]).length;
  if (f !== adj[c]) { soft.click(); return; }
  const hidden = ns.filter(n => !open[n] && !flag[n]); if (!hidden.length) return;
  for (const n of hidden) { if (mine[n]) { explode(n); return; } }
  for (const n of hidden) dig(n);
}
function checkWin() {
  const safe = W * H - M, n = open.reduce((a, b) => a + b, 0);
  if (n < safe || wonAt) return;
  wonAt = performance.now();
  for (let c = 0; c < W * H; c++) if (mine[c] && !flag[c]) { flag[c] = 1; flagAt.set(c, wonAt + Math.random() * 400); }
  updateHud();
  P.solved(`${cur.name}`, 700);
}
function explode(c) {
  boomAt = performance.now(); boomCell = c; shakeT = boomAt;
  tone(90, 0.4, 'sawtooth', 0.14, 0.4); tone(160, 0.25, 'square', 0.08, 0.5); buzz([60, 40, 80]); P.ui.flash(0.5);
  const [x, y] = center(c); P.fx.sparks(x, y, ['#ff6b4a', '#ffd166', '#3a3340', '#fff'], 30, { speed: 5, size: 4, kind: 'star', g: 0.1 });
  // other mines pop one by one
  const others = []; for (let k = 0; k < W * H; k++) if (mine[k] && k !== c) others.push(k);
  others.sort((a, b) => Math.hypot(a % W - c % W, ((a / W) | 0) - ((c / W) | 0)) - Math.hypot(b % W - c % W, ((b / W) | 0) - ((c / W) | 0)));
  others.forEach((k, i) => revealAt.set(k, boomAt + 250 + i * Math.min(60, 1400 / others.length)));
  revealAt.set(c, boomAt);
  const safe = W * H - M, n = open.reduce((a, b) => a + b, 0);
  P.failed('Boom!', `${Math.round(n / safe * 100)}% cleared · tap for a new field`, 1500);
}

// ---------------------------------------------------------------- drawing
function drawMine(g, cx, cy, r, hot) {
  g.save(); g.translate(cx, cy);
  g.strokeStyle = '#2b2730'; g.lineWidth = Math.max(1.5, r * 0.22); g.lineCap = 'round';
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6); g.lineTo(Math.cos(a) * r * 1.15, Math.sin(a) * r * 1.15); g.stroke(); }
  g.fillStyle = hot ? '#2b2730' : '#3a3540'; g.beginPath(); g.arc(0, 0, r * 0.82, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(-r * 0.28, -r * 0.3, r * 0.22, 0, 7); g.fill();
  g.restore();
}
function drawFlag(g, cx, cy, s, k = 1) {
  g.save(); g.translate(cx, cy + s * 0.04); g.scale(k, k);
  g.fillStyle = 'rgba(40,50,30,.22)'; g.beginPath(); g.ellipse(0, s * 0.3, s * 0.2, s * 0.06, 0, 0, 7); g.fill();
  g.strokeStyle = '#4a3b2f'; g.lineWidth = Math.max(1.4, s * 0.06); g.lineCap = 'round'; g.beginPath(); g.moveTo(-s * 0.08, s * 0.3); g.lineTo(-s * 0.08, -s * 0.3); g.stroke();
  g.fillStyle = '#ef5a4c'; g.beginPath(); g.moveTo(-s * 0.06, -s * 0.31); g.lineTo(s * 0.26, -s * 0.18); g.lineTo(-s * 0.06, -s * 0.04); g.closePath(); g.fill();
  g.restore();
}
function draw(g) {
  const { x: X, y: Y, s } = geo, now = performance.now(), BW = s * W, BH = s * H;
  let ox = 0, oy = 0; if (shakeT && now - shakeT < 500) { const k = 1 - (now - shakeT) / 500; ox = Math.sin(now / 18) * 6 * k; oy = Math.cos(now / 23) * 4 * k; }
  g.save(); g.translate(ox, oy);
  // board card
  g.save(); g.shadowColor = 'rgba(40,70,30,.22)'; g.shadowBlur = 24; g.shadowOffsetY = 10; rrect(g, X - 7, Y - 7, BW + 14, BH + 14, 16); g.fillStyle = '#fbfdf6'; g.fill(); g.restore();
  g.save(); rrect(g, X, Y, BW, BH, 10); g.clip();
  const fs = Math.round(s * 0.62);
  g.font = `800 ${fs}px -apple-system,system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let c = 0; c < W * H; c++) {
    const i = c % W, j = (c / W) | 0, cx = X + i * s, cy = Y + j * s, ch = (i + j) & 1;
    const ra = revealAt.get(c), shown = open[c] && (ra === undefined || now >= ra);
    if (shown) {
      g.fillStyle = DIRT[ch]; g.fillRect(cx, cy, s, s);
      const k = ra ? ease.back((now - ra) / 220) : 1;
      if (adj[c]) { g.save(); g.translate(cx + s / 2, cy + s / 2 + 1); g.scale(k, k); g.fillStyle = NUM[adj[c]]; g.fillText(adj[c], 0, 0); g.restore(); }
    } else {
      g.fillStyle = GRASS[ch]; g.fillRect(cx, cy, s, s);
      // soft bevel: light top-left, darker bottom
      g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(cx, cy, s, Math.max(1, s * 0.08));
      g.fillStyle = GRASS_DK[ch]; g.fillRect(cx, cy + s - Math.max(1, s * 0.1), s, Math.max(1, s * 0.1));
      if (open[c] && ra !== undefined) { // about to open: tiny lift
        const k = Math.max(0, 1 - (ra - now) / 300); g.fillStyle = `rgba(255,255,255,${0.25 * k})`; g.fillRect(cx, cy, s, s);
      }
      if (press && press.c === c && !press.moved) { const k = Math.min(1, (now - press.t) / 340); g.fillStyle = `rgba(255,255,255,${0.15 + 0.25 * k})`; g.fillRect(cx, cy, s, s); }
    }
  }
  // dirt edge shading where dirt meets grass
  g.fillStyle = 'rgba(90,70,40,.13)';
  for (let c = 0; c < W * H; c++) {
    if (!open[c]) continue; const i = c % W, j = (c / W) | 0, cx = X + i * s, cy = Y + j * s, t = Math.max(1.5, s * 0.08);
    if (j > 0 && !open[c - W]) g.fillRect(cx, cy, s, t);
    if (i > 0 && !open[c - 1]) g.fillRect(cx, cy, t, s);
  }
  // mines (after a boom) and flags
  for (let c = 0; c < W * H; c++) {
    const [cx, cy] = center(c);
    if (boomAt && mine[c]) {
      const ra = revealAt.get(c); if (ra !== undefined && now >= ra) {
        const k = ease.back((now - ra) / 260);
        if (c === boomCell) { g.fillStyle = '#ef5a4c'; g.fillRect(cx - s / 2, cy - s / 2, s, s); }
        else if (!flag[c]) { g.fillStyle = 'rgba(239,90,76,.18)'; g.fillRect(cx - s / 2, cy - s / 2, s, s); }
        if (!flag[c]) drawMine(g, cx, cy, s * 0.3 * k, c === boomCell);
      }
    }
    if (flag[c] && !open[c]) {
      const fa = flagAt.get(c), k = fa ? (now < fa ? 0 : ease.back((now - fa) / 240)) : 1;
      if (k > 0) drawFlag(g, cx, cy, s, k);
      if (boomAt && !mine[c]) { g.strokeStyle = '#d23b2f'; g.lineWidth = Math.max(2, s * 0.08); g.beginPath(); g.moveTo(cx - s * 0.3, cy - s * 0.3); g.lineTo(cx + s * 0.3, cy + s * 0.3); g.moveTo(cx + s * 0.3, cy - s * 0.3); g.lineTo(cx - s * 0.3, cy + s * 0.3); g.stroke(); }
    }
  }
  // win shimmer sweeping across
  if (wonAt) for (let c = 0; c < W * H; c++) { const i = c % W, j = (c / W) | 0, k = Math.max(0, 1 - Math.abs((now - wonAt) / 1100 - (i + j) / (W + H)) * 6); if (k > 0) { g.fillStyle = `rgba(255,255,255,${0.5 * k})`; g.fillRect(X + i * s, Y + j * s, s, s); } }
  g.restore();
  rrect(g, X, Y, BW, BH, 10); g.strokeStyle = 'rgba(47,58,43,.55)'; g.lineWidth = 2; g.stroke();
  // hint glow
  if (hintCell >= 0 && now - hintAt < 1600) {
    const k = 1 - (now - hintAt) / 1600, [cx, cy] = center(hintCell);
    g.strokeStyle = `rgba(255,255,255,${k})`; g.lineWidth = 3; rrect(g, cx - s / 2 + 2, cy - s / 2 + 2, s - 4, s - 4, 6); g.stroke();
    g.strokeStyle = `rgba(79,154,74,${k})`; g.lineWidth = 2; rrect(g, cx - s / 2 - (1 - k) * 10, cy - s / 2 - (1 - k) * 10, s + (1 - k) * 20, s + (1 - k) * 20, 8); g.stroke();
  }
  g.restore();
  // flag-mode hint under the board
  if (flagMode && !wonAt && !boomAt) {
    const t = 'Flag mode: taps plant flags'; g.font = '650 13px -apple-system,system-ui,sans-serif'; const w = g.measureText(t).width + 24, cy = Y + BH + 14;
    if (cy + 28 < P.area().H - 96) { rrect(g, (P.area().W - w) / 2, cy, w, 26, 13); g.fillStyle = '#4f9a4a'; g.fill(); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, P.area().W / 2, cy + 13.5); }
  }
}

css2();
function css2() { const s = document.createElement('style'); s.textContent = `#sp-mines{color:#d2463a!important}`; document.head.appendChild(s); }
if (P.D.isDaily && P.btns.menu) P.btns.menu.style.display = 'none';   // the daily puzzle has one fixed size
P.start();
