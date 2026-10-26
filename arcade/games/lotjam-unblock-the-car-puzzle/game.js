// Lotjam — unblock the car. Slide the cars and trucks along their lanes until the red car can drive out of the lot.
// Levels come from a BFS-graded pack (makepack.mjs): difficulty = the shortest solution in moves ("par").
// Hints and the test bot use a breadth-first solver on the current lot, so they always play an optimal next move.
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { shell, rngf, rrect, ease, buzz, tone, soft, chime, arp, SVG } from './puzzle.js';
import { N, EXIT_ROW, cellsOf, occupancy, range, solve } from './lotgen.js';
import { PACK } from './pack.js';

const BUCKETS = Object.keys(PACK).map(Number).sort((a, b) => a - b);
const LOTS = {}; for (const d of BUCKETS) { LOTS[d] = []; for (let i = 0; i < PACK[d].length; i += 36) LOTS[d].push(PACK[d].slice(i, i + 36)); }
const MAXD = BUCKETS[BUCKETS.length - 1];
const COLORS = ['#3fb6a8', '#f5b840', '#8a6be0', '#4a8fe6', '#f08a3c', '#5fbf6a', '#ef7fb0', '#55c3e8', '#c7a26a', '#7d8bd8', '#e3c34f', '#6fcfa0'];

let V = [], pos = [], start = [], disp = [], par = 0, moves = 0, drag = null, geo = { x: 0, y: 0, s: 50 }, wonAt = 0, exitAt = 0, hintV = -1, hintAt = 0, botTick = 0, botPath = null, bump = new Map();

const B = board({ game: 'lotjam', label: 'Lots cleared', limits: { maxRun: 1, maxPerSec: 0.75 }, mode: 'sum', corner: 'tl' });
const P = shell({
  B,
  key: 'lotjam', name: 'Lotjam: Unblock the Car Puzzle', brand: 'Lotjam', kicker: 'unblock the car', accent: '#e8524a', ink: '#283044',
  bg: ['#f1f4f9', '#dfe6f0'], winWord: 'Out you go!', dailyLevel: 14, restartLabel: 'Reset',
  rule: 'Slide the cars and trucks along their lanes to get the red car out.',
  tools: ['undo', 'restart', 'hint'],
  build(level, seed, fk) {
    const r = rngf(seed);
    const want = Math.round(Math.min(MAXD, (4 + (level - 1) * 0.75 + (level > 12 ? (level - 12) * 0.35 : 0)) * fk));
    let d = BUCKETS.reduce((a, b) => Math.abs(b - want) < Math.abs(a - want) ? b : a, BUCKETS[0]);
    d = Math.max(d, BUCKETS.find(b => b >= 4) || BUCKETS[0]);
    const list = LOTS[d], lot = list[Math.floor(r() * list.length)];
    parse(lot, r); par = d; moves = 0; drag = null; wonAt = 0; exitAt = 0; hintV = -1; botPath = null; bump = new Map();
    hud();
    const grade = d <= 7 ? 'beginner' : d <= 13 ? 'intermediate' : d <= 20 ? 'advanced' : 'expert';
    return { label: `${grade} · par ${d} moves`, sizeKey: 'p' + Math.min(30, d), cells: 12 + d * 2, value: 1 };
  },
  layout(a) {
    const s = Math.floor(Math.min((a.w - 34) / N, (a.h - 70) / N, 74));
    geo = { s, x: Math.round(a.x + (a.w - s * N) / 2 - 6), y: Math.round(a.y + Math.max(16, (a.h - 40 - s * N) * 0.45)) };
  },
  snapshot: () => ({ p: pos.slice(), m: moves }),
  restore(s) { pos = s.p.slice(); moves = s.m; botPath = null; hud(); },
  isEmpty: () => moves === 0 && pos.every((p, i) => p === start[i]),
  clear() { pos = start.slice(); moves = 0; botPath = null; hud(); },
  hint() {
    const path = solve(V, pos); if (!path || !path.length) return false;
    const [i, p] = path[0]; P.push(); doMove(i, p, true); hintV = i; hintAt = performance.now(); return true;
  },
  down(x, y) {
    if (wonAt) return;
    const c = cellAt(x, y); if (c < 0) return;
    const occ = occupancy(V, pos), i = occ[c]; if (i < 0) return;
    const [lo, hi] = range(V, pos, i, occ);
    drag = { i, x, y, p0: pos[i], lo, hi, f: pos[i] }; soft.click(); buzz(4);
  },
  move(x, y) {
    if (!drag) return; const v = V[drag.i];
    const delta = (v.h ? x - drag.x : y - drag.y) / geo.s;
    const f = drag.p0 + delta, cl = Math.max(drag.lo, Math.min(drag.hi + (drag.i === 0 && drag.hi === N - 2 ? 0.3 : 0), f));
    if ((f < drag.lo - 0.05 || f > drag.hi + 0.05) && !drag.hitWall) { drag.hitWall = true; bump.set(drag.i, performance.now()); tone(140, 0.05, 'sine', 0.06, 0.7); }
    if (f >= drag.lo && f <= drag.hi) drag.hitWall = false;
    drag.f = cl; disp[drag.i] = cl;
  },
  up() {
    if (!drag) return; const d = drag; drag = null;
    const p = Math.max(d.lo, Math.min(d.hi, Math.round(d.f)));
    if (p !== d.p0) { P.push(); doMove(d.i, p, false); } else { disp[d.i] = d.f; }
  },
  tick(dt) {
    for (let i = 0; i < V.length; i++) if (!(drag && drag.i === i)) {
      const target = i === 0 && exitAt ? N + 1.5 : pos[i];
      const k = i === 0 && exitAt ? 0.09 : 0.32;
      disp[i] += (target - disp[i]) * Math.min(1, k * dt); if (Math.abs(target - disp[i]) < 0.002) disp[i] = target;
    }
  },
  draw,
  debug: () => ({ par, moves, n: V.length }),
  bot() {
    if (wonAt || drag) return;
    if (++botTick % 3) return;
    if (V.some((_, i) => Math.abs(disp[i] - pos[i]) > 0.05)) return;
    if (!botPath || !botPath.length) botPath = solve(V, pos);
    if (!botPath || !botPath.length) return;
    const [i, p] = botPath.shift(); P.push(); doMove(i, p, false, true);
  },
});

function parse(lot, r) {
  V = []; pos = [];
  const seen = {};
  for (let c = 0; c < 36; c++) { const ch = lot[c]; if (ch === '.') continue; (seen[ch] = seen[ch] || []).push(c); }
  const keys = Object.keys(seen).sort();
  const cols = COLORS.slice(); for (let i = cols.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cols[i], cols[j]] = [cols[j], cols[i]]; }
  keys.forEach((k, n) => {
    const cs = seen[k], h = cs.length > 1 && ((cs[1] / N) | 0) === ((cs[0] / N) | 0);
    const v = { h, len: cs.length, line: h ? (cs[0] / N) | 0 : cs[0] % N, red: k === 'A', color: k === 'A' ? '#e8524a' : cols[(n - 1) % cols.length], face: r() < 0.5 ? 1 : -1 };
    if (v.red) v.face = 1;
    V.push(v); pos.push(h ? cs[0] % N : (cs[0] / N) | 0);
  });
  start = pos.slice(); disp = pos.slice();
}
function cellAt(x, y) { const cx = Math.floor((x - geo.x) / geo.s), cy = Math.floor((y - geo.y) / geo.s); return cx < 0 || cy < 0 || cx >= N || cy >= N ? -1 : cy * N + cx; }
function hud() {
  let el = document.getElementById('lj-moves');
  if (!el) { el = document.createElement('span'); el.id = 'lj-moves'; document.getElementById('pz-time').prepend(el); }
  el.textContent = `${moves} / par ${par}`;
  // progress: how close the red car is to the exit lane being clear, measured by the solver's distance
  P && P.progress && P.progress(wonAt ? 1 : Math.min(0.95, moves / Math.max(1, par)) * 0.9);
}
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on lot 1, until the first real touch,
// a car that has room slides along its lane and then glides back (no move counted, no hint given), so the lot shows the drag
let demoCar = null;
demo((n) => {
  if (n === 2) { if (!demoCar) return false; pos[demoCar.i] = demoCar.p0; tone(260, 0.06, 'triangle', 0.08, 0.75); return; }
  const occ = occupancy(V, pos);
  for (let i = 1; i < V.length; i++) { const [lo, hi] = range(V, pos, i, occ); if (hi > lo) { const p = pos[i] < hi ? hi : lo; demoCar = { i, p0: pos[i] }; pos[i] = p; tone(240 + V[i].len * 20, 0.07, 'triangle', 0.1, 0.75); buzz(8); return; } }
  return false;
}, { ready: () => P.state === 'play' && P.level === 1 && !P.D.isDaily && !wonAt && !drag && moves === 0, wait: 1800, every: 2200, max: 2 });

function doMove(i, p, fromHint, isBot) {
  if (pos[i] === p) return;
  const dist = Math.abs(p - pos[i]); pos[i] = p; moves++;
  if (!isBot) botPath = null;
  tone(V[i].red ? 330 : 240 + V[i].len * 20, 0.07, 'triangle', 0.1, 0.75); setTimeout(() => tone(1200, 0.02, 'sine', 0.04, 0.8), 90); buzz(8);
  bump.set(i, performance.now() + 120 + dist * 30);
  hud();
  if (i === 0 && p === N - 2) win();
}
function win() {
  wonAt = performance.now(); exitAt = wonAt + 180;
  tone(520, 0.1, 'square', 0.05, 1.6); setTimeout(() => tone(780, 0.14, 'square', 0.05, 1.4), 120);
  setTimeout(() => { const y = geo.y + (EXIT_ROW + 0.5) * geo.s, x = geo.x + N * geo.s + 8; P.fx.sparks(x, y, ['#e8524a', '#ffd166', '#fff'], 22, { speed: 4, size: 3.5 }); }, 450);
  hud();
  P.solved(moves <= par ? 'perfect — par!' : `${moves} moves (par ${par})`, 700);
}

// ---------------------------------------------------------------- drawing
function shade(hex, k) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const f = (c) => Math.max(0, Math.min(255, Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k)))); return `rgb(${f(r)},${f(g)},${f(b)})`; }
function vehicle(g, v, x, y, L, Wd, glow) {
  // local drawing along +x (length L, width Wd), facing +x
  g.save(); g.translate(x, y);
  const r = Wd * 0.28, s = geo.s;
  g.save(); g.shadowColor = 'rgba(20,25,40,.35)'; g.shadowBlur = s * 0.16; g.shadowOffsetY = s * 0.06; rrect(g, 0, 0, L, Wd, r); g.fillStyle = v.color; g.fill(); g.restore();
  const body = g.createLinearGradient(0, 0, 0, Wd); body.addColorStop(0, shade(v.color, 0.22)); body.addColorStop(0.5, v.color); body.addColorStop(1, shade(v.color, -0.14));
  rrect(g, 0, 0, L, Wd, r); g.fillStyle = body; g.fill();
  if (glow) { g.strokeStyle = '#fff'; g.lineWidth = 3; rrect(g, -2, -2, L + 4, Wd + 4, r + 2); g.stroke(); }
  if (v.len === 3) {
    // truck: cab at the front, cargo box behind
    const cab = s * 0.92, box = L - cab;
    rrect(g, Wd * 0.08, Wd * 0.1, box - Wd * 0.12, Wd * 0.8, r * 0.6); g.fillStyle = shade(v.color, 0.38); g.fill();
    g.strokeStyle = shade(v.color, -0.08); g.lineWidth = Math.max(1, s * 0.03);
    for (let k = 1; k < 5; k++) { const xx = Wd * 0.08 + (box - Wd * 0.12) * k / 5; g.beginPath(); g.moveTo(xx, Wd * 0.16); g.lineTo(xx, Wd * 0.84); g.stroke(); }
    rrect(g, box + cab * 0.22, Wd * 0.14, cab * 0.42, Wd * 0.72, r * 0.5); g.fillStyle = '#2b3a55'; g.fill();
    g.fillStyle = 'rgba(255,255,255,.35)'; rrect(g, box + cab * 0.28, Wd * 0.2, cab * 0.12, Wd * 0.6, 3); g.fill();
  } else {
    // car: racing stripes on the hero, then windscreen, roof, rear window
    if (v.red) { g.fillStyle = 'rgba(255,255,255,.92)'; g.fillRect(L * 0.04, Wd * 0.38, L * 0.92, Wd * 0.08); g.fillRect(L * 0.04, Wd * 0.54, L * 0.92, Wd * 0.08); }
    rrect(g, L * 0.54, Wd * 0.13, L * 0.2, Wd * 0.74, r * 0.5); g.fillStyle = '#2b3a55'; g.fill();
    g.fillStyle = 'rgba(255,255,255,.32)'; rrect(g, L * 0.58, Wd * 0.2, L * 0.05, Wd * 0.6, 3); g.fill();
    rrect(g, L * 0.3, Wd * 0.16, L * 0.25, Wd * 0.68, r * 0.4); g.fillStyle = shade(v.color, 0.12); g.fill();
    rrect(g, L * 0.16, Wd * 0.18, L * 0.13, Wd * 0.64, r * 0.4); g.fillStyle = '#334262'; g.fill();
  }
  // lights
  g.fillStyle = '#fff6c8'; for (const yy of [0.2, 0.8]) { g.beginPath(); g.ellipse(L - Wd * 0.07, Wd * yy, Wd * 0.05, Wd * 0.09, 0, 0, 7); g.fill(); }
  g.fillStyle = '#ff5a5a'; for (const yy of [0.2, 0.8]) { g.fillRect(Wd * 0.02, Wd * yy - Wd * 0.07, Wd * 0.05, Wd * 0.14); }
  // mirrors
  if (v.len === 2) { g.fillStyle = shade(v.color, -0.2); g.fillRect(L * 0.6, -Wd * 0.05, L * 0.06, Wd * 0.08); g.fillRect(L * 0.6, Wd * 0.97, L * 0.06, Wd * 0.08); }
  g.restore();
}
function draw(g) {
  const { x: X, y: Y, s } = geo, now = performance.now(), BW = s * N, fr = Math.max(10, s * 0.24);
  // lot frame
  g.save(); g.shadowColor = 'rgba(30,40,70,.25)'; g.shadowBlur = 30; g.shadowOffsetY = 12;
  rrect(g, X - fr, Y - fr, BW + fr * 2, BW + fr * 2, fr + 10); g.fillStyle = '#c9d2e0'; g.fill(); g.restore();
  rrect(g, X - fr, Y - fr, BW + fr * 2, BW + fr * 2, fr + 10); g.fillStyle = '#d8dfeb'; g.fill();
  // asphalt
  rrect(g, X, Y, BW, BW, 10); const asp = g.createLinearGradient(0, Y, 0, Y + BW); asp.addColorStop(0, '#4c5670'); asp.addColorStop(1, '#414a62'); g.fillStyle = asp; g.fill();
  // exit gap on the right of the exit row
  const ey = Y + EXIT_ROW * s;
  g.fillStyle = '#414a62'; g.fillRect(X + BW - 2, ey + 3, fr + 4, s - 6);
  // exit chevrons
  const pulse = 0.5 + 0.5 * Math.sin(now / 300);
  g.fillStyle = `rgba(255,214,102,${0.5 + 0.4 * pulse})`;
  for (let k = 0; k < 2; k++) { const cx = X + BW + fr * 0.25 + k * fr * 0.35; g.beginPath(); g.moveTo(cx, ey + s * 0.36); g.lineTo(cx + fr * 0.3, ey + s * 0.5); g.lineTo(cx, ey + s * 0.64); g.lineTo(cx + fr * 0.1, ey + s * 0.5); g.closePath(); g.fill(); }
  // parking bay lines
  g.save(); rrect(g, X, Y, BW, BW, 10); g.clip();
  g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 1.5; g.setLineDash([s * 0.18, s * 0.14]);
  for (let i = 1; i < N; i++) { g.beginPath(); g.moveTo(X + i * s, Y + 4); g.lineTo(X + i * s, Y + BW - 4); g.moveTo(X + 4, Y + i * s); g.lineTo(X + BW - 4, Y + i * s); g.stroke(); }
  g.setLineDash([]);
  // the exit lane tint
  g.fillStyle = 'rgba(232,82,74,.10)'; g.fillRect(X, ey, BW, s);
  g.restore();
  // vehicles
  const pad = Math.max(3, s * 0.07);
  V.forEach((v, i) => {
    if (i === 0) return;
    drawV(g, v, i, pad, now);
  });
  // red car last (it drives out over the frame)
  if (V.length) drawV(g, V[0], 0, pad, now);
  // hint target glow
  if (hintV >= 0 && now - hintAt < 1400) { const k = 1 - (now - hintAt) / 1400, v = V[hintV]; const [x, y, w, h] = rectOf(v, disp[hintV], pad); g.strokeStyle = `rgba(255,214,102,${k})`; g.lineWidth = 4; rrect(g, x - 4 - (1 - k) * 8, y - 4 - (1 - k) * 8, w + 8 + (1 - k) * 16, h + 8 + (1 - k) * 16, 14); g.stroke(); }
  // tip under the lot on the first levels
  if (P.level <= 2 && !P.D.isDaily && moves === 0) {
    const t = 'Drag a car along its lane'; g.font = '650 14px -apple-system,system-ui,sans-serif'; const w = g.measureText(t).width + 26, cy = Y + BW + fr + 16;
    rrect(g, X + BW / 2 - w / 2, cy, w, 28, 14); g.fillStyle = 'rgba(255,255,255,.85)'; g.fill(); g.fillStyle = '#283044'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, X + BW / 2, cy + 14.5);
  }
}
function rectOf(v, p, pad) { const s = geo.s; return v.h ? [geo.x + p * s + pad, geo.y + v.line * s + pad, v.len * s - pad * 2, s - pad * 2] : [geo.x + v.line * s + pad, geo.y + p * s + pad, s - pad * 2, v.len * s - pad * 2]; }
function drawV(g, v, i, pad, now) {
  const [x, y, w, h] = rectOf(v, disp[i], pad);
  const lifted = drag && drag.i === i, b = bump.get(i);
  let sq = 1; if (b && now > b && now - b < 260) sq = 1 + Math.sin((now - b) / 260 * Math.PI) * 0.05;
  g.save();
  const cx = x + w / 2, cy = y + h / 2; g.translate(cx, cy); if (lifted) g.scale(1.04, 1.04);
  if (v.h) g.scale(1 / sq, sq); else g.scale(sq, 1 / sq);
  // rotate so the vehicle's nose points where it faces
  const L = v.h ? w : h, Wd = v.h ? h : w;
  const ang = v.h ? (v.face > 0 ? 0 : Math.PI) : (v.face > 0 ? Math.PI / 2 : -Math.PI / 2);
  g.rotate(ang);
  vehicle(g, v, -L / 2, -Wd / 2, L, Wd, lifted);
  g.restore();
}

P.start();
