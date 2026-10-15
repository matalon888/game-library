// Inkpath — draw one unbroken ink line that passes the numbered stops 1 → 2 → 3 … in order and fills every square.
// Later puzzles add little walls the line can't cross. Every puzzle is generated (seeded) and checked by an exhaustive
// solver to have exactly one line, so it can always be finished by reasoning.
import { shell, rngf, rrect, ease, buzz, tone, soft, chime, arp, note } from './puzzle.js';
import { generate, neighbours, wallKey } from './inkgen.js';

const INK = [[74, 95, 193], [38, 166, 154]];   // line colour runs indigo → teal along its length
let N = 5, sol = [], stops = [], stopIdx = new Map(), walls = new Set(), wallList = [], path = [], geo = { x: 0, y: 0, s: 50 }, drag = false, wonAt = 0, hintCell = -1, hintAt = 0, pulse = new Map(), bump = { c: -1, t: 0 };

const P = shell({
  key: 'inkpath', name: 'Inkpath: Number Line Puzzle', brand: 'Inkpath', kicker: 'one-line number puzzle', accent: '#4a5fc1', ink: '#252a44',
  bg: ['#fbf7ee', '#e9eef8'], winWord: 'Inked!', dailyLevel: 10,
  build(level, seed, fk) {
    const p = generate(level, seed, fk, rngf) || generate(1, seed + 3, 1, rngf);
    N = p.N; sol = p.path; stops = p.stops; stopIdx = new Map(stops.map((c, i) => [c, i])); wallList = p.walls; walls = new Set(p.walls);
    path = [stops[0]]; wonAt = 0; hintCell = -1; pulse = new Map();
    return { label: `${N} × ${N} · ${stops.length} stops${wallList.length ? ' · ' + wallList.length + ' walls' : ''}`, sizeKey: 'n' + N + (wallList.length ? 'w' : ''), cells: N * N };
  },
  layout(a) {
    const s = Math.floor(Math.min(a.w, a.h - 20, 480) / N);
    geo = { s, x: Math.round(a.x + (a.w - s * N) / 2), y: Math.round(a.y + Math.max(6, (a.h - s * N) * 0.42)) };
  },
  snapshot: () => path.slice(),
  restore(s) { path = s; changed(false); },
  isEmpty: () => path.length <= 1,
  clear() { path = [stops[0]]; changed(false); },
  hint() {
    let k = 0; while (k < path.length && path[k] === sol[k]) k++;
    P.push();
    if (k < path.length) { path = path.slice(0, k); P.ui.pop('Back to here', '#fff', 24, 40); }
    if (path.length < sol.length) { path.push(sol[path.length]); }
    hintCell = path[path.length - 1]; hintAt = performance.now(); changed(true);
    return true;
  },
  down(x, y) {
    const c = cellAt(x, y); if (c < 0) return;
    const i = path.indexOf(c);
    if (i >= 0) { P.push(); if (i < path.length - 1) { path = path.slice(0, i + 1); soft.click(); changed(false); } drag = true; return; }
    // grabbing next to the head also works
    if (neighbours(N, path[path.length - 1], walls).includes(c)) { P.push(); drag = true; extend(c); return; }
    bump = { c: path[path.length - 1], t: performance.now() }; soft.err();
  },
  move(x, y) {
    if (!drag) return; const c = cellAt(x, y); if (c < 0) return;
    // walk toward the finger one square at a time (fast swipes skip no squares)
    for (let guard = 0; guard < 12; guard++) {
      const h = path[path.length - 1]; if (c === h) break;
      const hx = h % N, hy = (h / N) | 0, tx = c % N, ty = (c / N) | 0;
      const dx = Math.sign(tx - hx), dy = Math.sign(ty - hy);
      const opts = Math.abs(tx - hx) >= Math.abs(ty - hy) ? [[dx, 0], [0, dy]] : [[0, dy], [dx, 0]];
      let moved = false;
      for (const [ox, oy] of opts) { if (!ox && !oy) continue; const d = (hy + oy) * N + hx + ox; if (extend(d)) { moved = true; break; } }
      if (!moved) break;
    }
  },
  up() { drag = false; },
  draw,
  debug: () => ({ geo, N, path: path.slice(), sol }),
  bot() {
    let k = 0; while (k < path.length && path[k] === sol[k]) k++;
    if (k < path.length) { path = path.slice(0, Math.max(1, k)); changed(false); return; }
    extend(sol[path.length]);
  },
});

function cellAt(x, y) { const cx = Math.floor((x - geo.x) / geo.s), cy = Math.floor((y - geo.y) / geo.s); return cx < 0 || cy < 0 || cx >= N || cy >= N ? -1 : cy * N + cx; }
const center = (c) => [geo.x + (c % N + 0.5) * geo.s, geo.y + (((c / N) | 0) + 0.5) * geo.s];
const nextStop = () => { let k = 0; for (const c of path) if (stopIdx.has(c)) k = stopIdx.get(c) + 1; return k; };

function extend(d) {
  const h = path[path.length - 1];
  if (path.length >= 2 && path[path.length - 2] === d) { path.pop(); tone(500 + path.length * 8, 0.03, 'sine', 0.05, 0.8); changed(false); return true; }
  if (!neighbours(N, h, walls).includes(d) || path.includes(d)) return false;
  if (h === stops[stops.length - 1]) return false;                // the last stop ends the line
  if (stopIdx.has(d) && stopIdx.get(d) !== nextStop()) { bump = { c: d, t: performance.now() }; soft.err(); buzz([6, 20, 6]); return false; }
  path.push(d);
  if (stopIdx.has(d)) { const k = stopIdx.get(d); pulse.set(d, performance.now()); chime(k + 3, 67, 0.12); buzz(12); const [x, y] = center(d); P.fx.ring(x, y, '#4a5fc1', geo.s * 0.35); P.fx.sparks(x, y, ['#fff', '#7fd6cc', '#a9b6ff'], 8, { speed: 2.4, size: 2.6 }); }
  else { tone(640 + (path.length % 12) * 22, 0.035, 'sine', 0.06, 1.1); buzz(4); }
  changed(false);
  return true;
}
function changed() {
  P.progress((path.length - 1) / (N * N - 1));
  if (path.length === N * N && path[path.length - 1] === stops[stops.length - 1] && P.state === 'play') {
    wonAt = performance.now();
    stops.forEach((c, i) => setTimeout(() => { note(72 + [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28][i % 13], 0.5, 0.1); const [x, y] = center(c); P.fx.sparks(x, y, ['#fff', '#ffe08a', '#7fd6cc'], 10, { speed: 3 }); }, i * 60));
    P.solved();
  }
}

// ---------------------------------------------------------------- drawing
const mix = (t) => { const [a, b] = INK; return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`; };
function draw(g) {
  const { x: X, y: Y, s } = geo, B = s * N, now = performance.now();
  g.save(); g.shadowColor = 'rgba(40,50,90,.16)'; g.shadowBlur = 28; g.shadowOffsetY = 10; rrect(g, X - 9, Y - 9, B + 18, B + 18, 20); g.fillStyle = '#fffdf8'; g.fill(); g.restore();
  // squares
  const onPath = new Set(path);
  for (let c = 0; c < N * N; c++) {
    const cx = X + (c % N) * s, cy = Y + ((c / N) | 0) * s;
    rrect(g, cx + 2, cy + 2, s - 4, s - 4, s * 0.16);
    g.fillStyle = onPath.has(c) ? 'rgba(122,140,230,.12)' : '#f1efe8'; g.fill();
  }
  // walls
  g.strokeStyle = '#252a44'; g.lineCap = 'round'; g.lineWidth = Math.max(5, s * 0.11);
  for (const w of wallList) {
    const [a, b] = w.split(':').map(Number), ax = a % N, ay = (a / N) | 0, bx = b % N, by = (b / N) | 0;
    g.beginPath();
    if (ay === by) { const xx = X + Math.max(ax, bx) * s; g.moveTo(xx, Y + ay * s + 3); g.lineTo(xx, Y + (ay + 1) * s - 3); }
    else { const yy = Y + Math.max(ay, by) * s; g.moveTo(X + ax * s + 3, yy); g.lineTo(X + (ax + 1) * s - 3, yy); }
    g.stroke();
  }
  // the line: segments coloured along its length, with a light sweep after a win
  const lw = s * 0.42, L = path.length;
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (L > 1) {
    g.lineWidth = lw + 4; g.strokeStyle = 'rgba(255,255,255,.9)'; g.beginPath(); path.forEach((c, i) => { const [x, y] = center(c); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    for (let i = 1; i < L; i++) {
      const [x0, y0] = center(path[i - 1]), [x1, y1] = center(path[i]); const t = i / (N * N - 1);
      g.strokeStyle = mix(t); g.lineWidth = lw; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      if (wonAt) { const k = Math.max(0, 1 - Math.abs((now - wonAt) / 1100 - t) * 6); if (k > 0) { g.strokeStyle = `rgba(255,255,255,${0.75 * k})`; g.lineWidth = lw * 0.55; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); } }
    }
  }
  // head
  if (!wonAt) { const [hx, hy] = center(path[L - 1]); const pr = lw * (0.62 + 0.08 * Math.sin(now / 180)); g.fillStyle = mix((L - 1) / (N * N - 1)); g.beginPath(); g.arc(hx, hy, pr, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 3; g.stroke(); }
  // stops
  const nk = nextStop();
  stops.forEach((c, i) => {
    let [x, y] = center(c); const p0 = pulse.get(c), k = p0 ? 1 + 0.25 * Math.sin(Math.min(1, (now - p0) / 300) * Math.PI) : 1;
    if (bump.c === c && now - bump.t < 380) x += Math.sin((now - bump.t) / 22) * s * 0.06 * (1 - (now - bump.t) / 380);
    const r = s * 0.3 * k, done = onPath.has(c) && i < nk;
    if (i === nk && !wonAt) { g.strokeStyle = `rgba(74,95,193,${0.35 + 0.25 * Math.sin(now / 220)})`; g.lineWidth = 3; g.beginPath(); g.arc(x, y, r + 5 + 2 * Math.sin(now / 220), 0, 7); g.stroke(); }
    g.fillStyle = '#252a44'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    if (done) { g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, r - 3, 0, 7); g.stroke(); }
    g.fillStyle = '#fff'; g.font = `800 ${Math.round(s * (i + 1 >= 10 ? 0.27 : 0.32) * k)}px -apple-system,system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(i + 1, x, y + 1);
  });
  if (hintCell >= 0 && now - hintAt < 1500) { const k = 1 - (now - hintAt) / 1500, [x, y] = center(hintCell); g.strokeStyle = `rgba(255,190,60,${k})`; g.lineWidth = 4; g.beginPath(); g.arc(x, y, s * (0.35 + (1 - k) * 0.3), 0, 7); g.stroke(); }
  // helper line under the board
  g.fillStyle = 'rgba(37,42,68,.5)'; g.font = `600 13px -apple-system,system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  if (P.level <= 3 && !P.D.isDaily) g.fillText('Connect 1 → ' + stops.length + ' in order and fill every square', X + B / 2, Y + B + 34);
}

P.start();
