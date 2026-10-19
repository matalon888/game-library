// Clumpop — tap clumps of 2+ touching same-colour cubes to pop them. Big clumps leave rockets, bombs and prism orbs.
// Hit every level goal before the moves run out. Levels are seeded (D.seed gives everyone today's level with ?daily=1).
import { createUI, store, sfx, note, tone, buzz, loop } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';

const NAME = 'Clumpop: Cube Crush Puzzle';
const S = store('clumpop');
const F = flow('clumpop');
let level = S.get('level', 1), best = S.get('best', 0);
const ui = createUI({ title: 'CLUMPOP', hint: 'Tap clumps of 2+ cubes', hand: '👆', score: false });
const D = daily('clumpop', ui, { name: NAME });
const B = board({ game: 'clumpop', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 1 }, mode: 'sum', corner: 'tl' });
document.body.style.setProperty('--ui', '#7b4dff');

const COLS = 8, ROWS = 9;
const CUBE = [
  { c: '#ff4560', sym: 'heart' }, { c: '#ffbf1f', sym: 'star' }, { c: '#2f86ff', sym: 'diamond' },
  { c: '#25c25f', sym: 'clover' }, { c: '#a052ff', sym: 'tri' },
];
const SPECIAL = new Set(['rh', 'rv', 'bomb', 'orb']);
const RANK = { rh: 1, rv: 1, bomb: 2, orb: 3 };

// ---------------------------------------------------------------- canvas + layout
const cv = document.getElementById('cv'), g = cv.getContext('2d');
let dpr = 1, W = 0, H = 0, s = 48, X0 = 0, Y0 = 0, PX = 0, PY = 0, PW = 0, PH = 0, bgC = null, spr = [], crateSpr = [];
function hex(c) { return [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)); }
function mix(c, t, k) { const a = hex(c), b = hex(t); return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',')})`; }
function rr(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }
function symPath(x, sym, cx, cy, k) {
  x.beginPath();
  if (sym === 'heart') { x.moveTo(cx, cy + 16 * k); x.bezierCurveTo(cx - 26 * k, cy - 2 * k, cx - 14 * k, cy - 22 * k, cx, cy - 9 * k); x.bezierCurveTo(cx + 14 * k, cy - 22 * k, cx + 26 * k, cy - 2 * k, cx, cy + 16 * k); }
  else if (sym === 'star') { for (let i = 0; i < 10; i++) { const r = (i % 2 ? 8 : 19) * k, a = -Math.PI / 2 + i * Math.PI / 5; x.lineTo(cx + Math.cos(a) * r, cy + 1 * k + Math.sin(a) * r); } x.closePath(); }
  else if (sym === 'diamond') { x.moveTo(cx, cy - 18 * k); x.lineTo(cx + 15 * k, cy); x.lineTo(cx, cy + 18 * k); x.lineTo(cx - 15 * k, cy); x.closePath(); }
  else if (sym === 'clover') { for (const [dx, dy] of [[0, -8], [8, 0], [0, 8], [-8, 0]]) { x.moveTo(cx + dx * k + 8.5 * k, cy + dy * k); x.arc(cx + dx * k, cy + dy * k, 8.5 * k, 0, 7); } }
  else { x.moveTo(cx, cy - 16 * k); x.lineTo(cx + 17 * k, cy + 13 * k); x.lineTo(cx - 17 * k, cy + 13 * k); x.closePath(); }
}
function cubeSprite(ci) {
  const S = Math.round(s * dpr), c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'); x.scale(S / 100, S / 100);
  const col = CUBE[ci].c;
  rr(x, 4, 7, 92, 90, 20); x.fillStyle = mix(col, '#000000', 0.38); x.fill();                       // bottom edge (depth)
  const gr = x.createLinearGradient(0, 2, 0, 90); gr.addColorStop(0, mix(col, '#ffffff', 0.35)); gr.addColorStop(0.5, col); gr.addColorStop(1, mix(col, '#000000', 0.12));
  rr(x, 4, 2, 92, 88, 20); x.fillStyle = gr; x.fill();
  const g2 = x.createLinearGradient(0, 10, 0, 80); g2.addColorStop(0, mix(col, '#ffffff', 0.22)); g2.addColorStop(1, mix(col, '#000000', 0.05));
  rr(x, 12, 9, 76, 72, 14); x.fillStyle = g2; x.fill();
  symPath(x, CUBE[ci].sym, 50, 48, 1.15); x.fillStyle = mix(col, '#000000', 0.35); x.fill();               // emboss shadow
  symPath(x, CUBE[ci].sym, 50, 45, 1.15); x.fillStyle = mix(col, '#ffffff', 0.62); x.fill();
  x.globalAlpha = 0.45; x.fillStyle = '#fff'; x.beginPath(); x.ellipse(36, 18, 20, 6, -0.15, 0, 7); x.fill();         // gloss
  x.globalAlpha = 0.8; x.beginPath(); x.arc(20, 17, 3.2, 0, 7); x.fill();
  return c;
}
function crateSprite(hp) {
  const S = Math.round(s * dpr), c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'); x.scale(S / 100, S / 100);
  rr(x, 4, 7, 92, 90, 12); x.fillStyle = '#7a4a22'; x.fill();
  const gr = x.createLinearGradient(0, 0, 0, 90); gr.addColorStop(0, '#e2a865'); gr.addColorStop(1, '#b97a3c');
  rr(x, 4, 2, 92, 88, 12); x.fillStyle = gr; x.fill();
  x.strokeStyle = '#8a5428'; x.lineWidth = 3; for (const yy of [30, 60]) { x.beginPath(); x.moveTo(10, yy); x.lineTo(90, yy); x.stroke(); }
  x.lineWidth = 9; x.strokeStyle = '#c98c4a'; x.beginPath(); x.moveTo(14, 14); x.lineTo(86, 78); x.stroke(); x.lineWidth = 2.5; x.strokeStyle = '#8a5428'; x.stroke();
  rr(x, 8, 6, 84, 80, 10); x.lineWidth = 6; x.strokeStyle = '#9b6230'; x.stroke();
  x.fillStyle = '#5b3a1e'; for (const [px, py] of [[14, 12], [86, 12], [14, 80], [86, 80]]) { x.beginPath(); x.arc(px, py, 3.5, 0, 7); x.fill(); }
  if (hp === 1 && crateHp2) { x.strokeStyle = '#4a2a10'; x.lineWidth = 3; x.beginPath(); x.moveTo(50, 8); x.lineTo(44, 30); x.lineTo(56, 44); x.lineTo(46, 64); x.moveTo(56, 44); x.lineTo(72, 50); x.stroke(); }
  if (hp === 2) { x.fillStyle = 'rgba(255,255,255,.9)'; x.font = '800 22px system-ui'; x.textAlign = 'center'; x.fillText('×2', 74, 92); }
  return c;
}
let crateHp2 = false;
function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr;
  const top = 154 + safeTop(), bottom = 18;
  s = Math.floor(Math.min((W - 24) / COLS, (H - top - bottom) / ROWS, 64));
  X0 = Math.round((W - s * COLS) / 2); Y0 = Math.round(top + Math.max(0, (H - top - bottom - s * ROWS) * 0.42));
  PW = Math.min(W - 24, 430); PH = 76; PX = Math.round((W - PW) / 2); PY = 62 + safeTop();
  spr = CUBE.map((_, i) => cubeSprite(i)); crateSpr = [null, crateSprite(1), crateSprite(2)];
  bgC = document.createElement('canvas'); bgC.width = W * dpr; bgC.height = H * dpr; const x = bgC.getContext('2d'); x.scale(dpr, dpr);
  const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#7fc8ff'); gr.addColorStop(0.55, '#a99cff'); gr.addColorStop(1, '#ffb3dc'); x.fillStyle = gr; x.fillRect(0, 0, W, H);
  let sd = 7; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 26; i++) { x.globalAlpha = 0.08 + r() * 0.12; x.fillStyle = '#fff'; x.beginPath(); x.arc(r() * W, r() * H, 10 + r() * 60, 0, 7); x.fill(); }
  x.globalAlpha = 1;
}
function safeTop() { const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0; return v; }
addEventListener('resize', resize);

// ---------------------------------------------------------------- state
let grid = [], goals = [], moves = 0, score = 0, state = 'ready', recorded = false, beatenShown = false, lvStart = 0, ncol = 4;
let ghosts = [], parts = [], flyers = [], fxs = [], shake = 0, rnd = Math.random, movePop = 0, startMoves = 0, bonusQ = 0, shuffleT = 0;
function rngf(seed) { let x = (seed >>> 0) || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
const cube = (col, y) => ({ k: 'cube', col, y, vy: 0, sq: 0, sh: 0 });

function build() {
  const L = D.seed ? 8 : level, fk = F.k();
  rnd = rngf((D.seed ? D.seed * 31 + level : level * 7919 + 3) * 2654435761);
  ncol = L <= 2 ? 4 : 5;
  const order = [0, 1, 2, 3, 4].slice(0, ncol).sort(() => rnd() - 0.5);
  goals = [];
  if (L === 1) goals.push({ t: 'col', col: order[0], need: Math.round(Math.min(60, 14 * fk)) });
  else { const n = Math.round(Math.min(60, (8 + L * 3) * fk)); goals.push({ t: 'col', col: order[0], need: n }, { t: 'col', col: order[1], need: Math.round(n * 0.8) }); }
  let crates = 0; crateHp2 = L >= 6;
  if (L >= 3) crates = Math.min(22, 5 + L);
  grid = [];
  for (let r = 0; r < ROWS; r++) { grid.push([]); for (let c = 0; c < COLS; c++) grid[r].push(cube(Math.floor(rnd() * ncol), r - ROWS - 1.5 + r * 0.02)); }
  if (crates) {
    let placed = 0; const rows = Math.ceil(crates / COLS) + 1;
    for (let k = 0; k < 400 && placed < crates; k++) { const r = ROWS - 1 - Math.floor(rnd() * rows), c = Math.floor(rnd() * COLS); if (grid[r][c].k === 'cube') { grid[r][c] = { k: 'crate', hp: crateHp2 && rnd() < 0.5 ? 2 : 1, y: grid[r][c].y, vy: 0, sq: 0, sh: 0 }; placed++; } }
    goals.push({ t: 'crate', need: placed });
  }
  for (const gl of goals) { gl.left = gl.need; gl.bump = 0; }
  crateSpr = [null, crateSprite(1), crateSprite(2)];
  moves = startMoves = Math.round(Math.min(45, Math.max(10, (16 + L * 1.2 + (crates ? 5 : 0)) / fk)));
  ghosts = []; parts = []; flyers = []; fxs = []; recorded = false; beatenShown = false; bonusQ = 0;
  ensureMove(true);
  ui.levels(level); ui.progress(0);
}
const inB = (r, c) => r >= 0 && c >= 0 && r < ROWS && c < COLS;
function groupAt(r, c) {
  const p = grid[r][c]; if (!p || p.k !== 'cube') return [];
  const seen = new Set([r * COLS + c]), out = [[r, c]], q = [[r, c]];
  while (q.length) { const [a, b] = q.pop(); for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nr = a + dr, nc = b + dc, k = nr * COLS + nc; if (!inB(nr, nc) || seen.has(k)) continue; const n = grid[nr][nc]; if (n && n.k === 'cube' && n.col === p.col) { seen.add(k); out.push([nr, nc]); q.push([nr, nc]); } } }
  return out;
}
function allGroups() {
  const seen = new Set(), res = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { if (seen.has(r * COLS + c)) continue; const gp = groupAt(r, c); gp.forEach(([a, b]) => seen.add(a * COLS + b)); if (gp.length >= 2) res.push(gp); }
  return res;
}
const hasSpecial = () => grid.some(row => row.some(p => p && SPECIAL.has(p.k)));
function ensureMove(quiet) {
  if (hasSpecial() || allGroups().length) return;
  for (let t = 0; t < 50; t++) {
    for (const row of grid) for (const p of row) if (p && p.k === 'cube') { p.col = Math.floor(Math.random() * ncol); p.sq = 1; }
    if (allGroups().length) break;
  }
  if (!quiet) { ui.pop('SHUFFLE!', '#fff', 34, 45); tone(500, 0.2, 'sine', 0.1, 2); }
}

// ---------------------------------------------------------------- pixel helpers
const cellX = c => X0 + c * s, cellY = r => Y0 + r * s;
function goalPos(gl) { return [gl.x || W / 2, gl.y || PY + PH / 2]; }
function collect(col, r, c, delay) {
  const gl = goals.find(gg => gg.t === 'col' && gg.col === col && gg.left > 0);
  if (gl) { gl.left--; const [tx, ty] = goalPos(gl); flyers.push({ x: cellX(c) + s / 2, y: cellY(r) + s / 2, tx, ty, t: -delay, img: spr[col], gl }); }
}

// ---------------------------------------------------------------- removing + specials
let queue = [];
function removeCell(r, c, delay, depth, direct) {
  const p = grid[r][c]; if (!p) return;
  if (p.k === 'crate') {
    p.hp--; p.sh = 1; burstAt(cellX(c) + s / 2, cellY(r) + s / 2, ['#e2a865', '#9b6230', '#fff3d6'], 8, delay);
    tone(260, 0.06, 'triangle', 0.1, 0.6);
    if (p.hp > 0) return;
    const gl = goals.find(gg => gg.t === 'crate'); if (gl && gl.left > 0) { gl.left--; const [tx, ty] = goalPos(gl); flyers.push({ x: cellX(c) + s / 2, y: cellY(r) + s / 2, tx, ty, t: -delay, img: crateSpr[1], gl }); }
    grid[r][c] = null; score += 20; return;
  }
  grid[r][c] = null;
  if (SPECIAL.has(p.k)) { if (!direct) queue.push({ k: p.k, r, c, depth: depth + 1 }); ghosts.push({ x: cellX(c), y: cellY(r), t: -delay, p }); score += 50; return; }
  score += 10; movePop++;
  ghosts.push({ x: cellX(c), y: cellY(r), t: -delay, img: spr[p.col], col: CUBE[p.col].c });
  collect(p.col, r, c, delay);
}
function hitCrates(cells) {
  const done = new Set();
  for (const [r, c] of cells) for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nr = r + dr, nc = c + dc, k = nr * COLS + nc; if (inB(nr, nc) && !done.has(k) && grid[nr][nc] && grid[nr][nc].k === 'crate') { done.add(k); removeCell(nr, nc, 0, 0); } }
}
function mostCommon() { const n = new Array(5).fill(0); for (const row of grid) for (const p of row) if (p && p.k === 'cube') n[p.col]++; const want = goals.find(gl => gl.t === 'col' && gl.left > 0 && n[gl.col] > 0); return want ? want.col : n.indexOf(Math.max(...n)); }
function cellsFor(k, r, c) {
  const out = [], add = (a, b) => inB(a, b) && out.push([a, b]);
  const rows = rs => rs.forEach(a => { for (let b = 0; b < COLS; b++) add(a, b); }), cols = cs => cs.forEach(b => { for (let a = 0; a < ROWS; a++) add(a, b); });
  const disc = rad => { for (let a = -rad; a <= rad; a++) for (let b = -rad; b <= rad; b++) if (!(Math.abs(a) === rad && Math.abs(b) === rad)) add(r + a, c + b); };
  if (k === 'rh') rows([r]); else if (k === 'rv') cols([c]);
  else if (k === 'cross') { rows([r]); cols([c]); }
  else if (k === 'big3') { rows([r - 1, r, r + 1]); cols([c - 1, c, c + 1]); }
  else if (k === 'bomb') disc(2); else if (k === 'bomb7') disc(3);
  else if (k === 'all') rows([...Array(ROWS).keys()]);
  return out;
}
function fx(k, r, c, delay) {
  const x = cellX(c) + s / 2, y = cellY(r) + s / 2;
  if (k === 'rh' || k === 'rv' || k === 'cross' || k === 'big3') {
    const lines = k === 'rh' ? [['h', 0]] : k === 'rv' ? [['v', 0]] : k === 'cross' ? [['h', 0], ['v', 0]] : [['h', -1], ['h', 0], ['h', 1], ['v', -1], ['v', 0], ['v', 1]];
    for (const [d, o] of lines) fxs.push({ k: 'streak', d, x: d === 'v' ? x + o * s : x, y: d === 'h' ? y + o * s : y, t: -delay });
    setTimeout(() => { tone(900, 0.25, 'sawtooth', 0.06, 0.3); buzz(15); }, delay * 1000);
    shake = Math.max(shake, 0.4);
  } else if (k === 'bomb' || k === 'bomb7' || k === 'all') {
    fxs.push({ k: 'ring', x, y, t: -delay, R: (k === 'bomb' ? 2.8 : k === 'bomb7' ? 4 : 7) * s });
    setTimeout(() => { sfx.smash(); buzz([30, 20, 30]); shake = Math.max(shake, k === 'bomb' ? 0.8 : 1.2); ui.flash(0.25); }, delay * 1000);
  }
}
function runQueue() {
  let guard = 0;
  while (queue.length && guard++ < 200) {
    const q = queue.shift(), d = q.depth * 0.12;
    if (q.k === 'orb' || q.k === 'orbR' || q.k === 'orbB') {
      const col = mostCommon(), targets = [];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const p = grid[r][c]; if (p && p.k === 'cube' && p.col === col) targets.push([r, c]); }
      fxs.push({ k: 'zap', x: cellX(q.c) + s / 2, y: cellY(q.r) + s / 2, pts: targets.map(([r, c]) => [cellX(c) + s / 2, cellY(r) + s / 2]), t: -d, col: CUBE[col].c });
      setTimeout(() => { [72, 76, 79, 84].forEach((n, i) => setTimeout(() => note(n, 0.2, 0.1), i * 50)); buzz(20); }, d * 1000);
      if (q.k === 'orb') targets.forEach(([r, c], i) => removeCell(r, c, d + 0.25 + i * 0.02, q.depth));
      else targets.forEach(([r, c], i) => { const kk = q.k === 'orbB' ? 'bomb' : (Math.random() < 0.5 ? 'rh' : 'rv'); queue.push({ k: kk, r, c, depth: q.depth + 2 + i * 0.3 }); grid[r][c] = null; ghosts.push({ x: cellX(c), y: cellY(r), t: -(d + 0.3), p: { k: kk } }); });
      continue;
    }
    fx(q.k, q.r, q.c, d);
    const cells = cellsFor(q.k, q.r, q.c);
    for (const [r, c] of cells) removeCell(r, c, d + Math.hypot(r - q.r, c - q.c) * 0.03, q.depth);
  }
}
function fireSpecial(r, c) {
  // every special touching this one joins in
  const comp = [[r, c]], seen = new Set([r * COLS + c]);
  for (let i = 0; i < comp.length; i++) { const [a, b] = comp[i]; for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nr = a + dr, nc = b + dc, k = nr * COLS + nc; if (inB(nr, nc) && !seen.has(k) && grid[nr][nc] && SPECIAL.has(grid[nr][nc].k)) { seen.add(k); comp.push([nr, nc]); } } }
  const kinds = comp.map(([a, b]) => grid[a][b].k).sort((x, y) => RANK[y] - RANK[x]);
  for (const [a, b] of comp) { const p = grid[a][b]; grid[a][b] = null; ghosts.push({ x: cellX(b), y: cellY(a), t: 0, p }); }
  let k = kinds[0];
  if (comp.length >= 2) {
    const [k1, k2] = kinds, rk = x => RANK[x];
    if (k1 === 'orb' && k2 === 'orb') k = 'all';
    else if (k1 === 'orb') k = rk(k2) === 2 ? 'orbB' : 'orbR';
    else if (k1 === 'bomb' && k2 === 'bomb') k = 'bomb7';
    else if (k1 === 'bomb') k = 'big3';
    else k = 'cross';
    ui.pop(k === 'all' ? 'MEGA COMBO!' : 'COMBO!', '#fff36b', 42, 40);
  } else ui.pop({ rh: 'WHOOSH!', rv: 'WHOOSH!', bomb: 'BOOM!', orb: 'PRISM!' }[k], '#fff', 36, 40);
  queue.push({ k, r, c, depth: 0 }); runQueue();
}

// ---------------------------------------------------------------- moves
function tap(r, c) {
  if (state !== 'play' || moves <= 0 || !inB(r, c)) return;
  const p = grid[r][c]; if (!p || Math.abs(p.y - r) > 0.45) return;
  movePop = 0;
  if (SPECIAL.has(p.k)) { moves--; fireSpecial(r, c); }
  else if (p.k === 'cube') {
    const gp = groupAt(r, c);
    if (gp.length < 2) { p.sh = 1; tone(180, 0.08, 'triangle', 0.08, 0.8); buzz(4); return; }
    moves--; const col = p.col;
    gp.forEach(([a, b]) => removeCell(a, b, Math.hypot(a - r, b - c) * 0.025, 0));
    hitCrates(gp);
    const n = gp.length;
    note(64 + Math.min(n, 14), 0.18, 0.13); setTimeout(() => note(71 + Math.min(n, 14), 0.2, 0.1), 50); buzz(8);
    if (n >= 5) {
      const k = n >= 9 ? 'orb' : n >= 7 ? 'bomb' : (Math.random() < 0.5 ? 'rh' : 'rv');
      grid[r][c] = { k, y: r, vy: 0, sq: 1, sh: 0, born: 1 };
      tone(700, 0.18, 'sine', 0.1, 1.8);
      burstAt(cellX(c) + s / 2, cellY(r) + s / 2, ['#fff', '#fff36b', CUBE[col].c], 14, 0.05);
    }
  } else { p.sh = 1; return; }
  if (movePop >= 14) ui.pop('AMAZING!', '#fff36b', 40, 40); else if (movePop >= 9) ui.pop('GREAT!', '#fff', 36, 40);
  afterMove();
}
function gravity() {
  for (let c = 0; c < COLS; c++) {
    let w = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) if (grid[r][c]) { if (r !== w) { grid[w][c] = grid[r][c]; grid[r][c] = null; } w--; }
    const n = w + 1; for (let r = w; r >= 0; r--) grid[r][c] = cube(Math.floor(Math.random() * ncol), r - n - 0.4);
  }
}
const goalsDone = () => goals.every(gl => gl.left <= 0);
const goalFrac = () => goals.reduce((a, gl) => a + (gl.need - gl.left), 0) / Math.max(1, goals.reduce((a, gl) => a + gl.need, 0));
function afterMove() {
  gravity(); ensureMove(false);
  ui.progress(goalFrac());
  if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); confettiFx(); }
  if (goalsDone()) win();
  else if (moves <= 0) { state = 'ending'; setTimeout(() => { if (goalsDone()) win(true); else lose(); }, 700); }
}
function win(late) {
  if (state !== 'play' && !late) return;
  state = 'won';
  if (!recorded) { recorded = true; F.level(true); B.submit(1, { ms: performance.now() - lvStart }); }
  bonusQ = Math.min(moves, 8); const bonus = moves * 50; score += bonus;
  best = Math.max(best, score); S.set('best', best);
  ui.pop('LEVEL DONE!', '#fff36b', 44, 40); sfx.win(); buzz([20, 30, 40]); confettiFx();
  D.won(level, 'cleared level');
  ui.win(level, moves ? `${moves} moves left · +${bonus} · ${score} pts` : `${score} pts`);
  level++; S.set('level', level);
}
function lose() {
  state = 'lost';
  if (!recorded) { recorded = true; F.level(false, goalFrac()); }
  sfx.fail(); buzz([40, 30, 80]);
  const left = goals.filter(gl => gl.left > 0).map(gl => `${gl.left} ${gl.t === 'crate' ? 'crates' : ['red', 'yellow', 'blue', 'green', 'purple'][gl.col]}`).join(' + ');
  ui.lose('OUT OF MOVES', `Still needed: ${left}`);
}

// ---------------------------------------------------------------- particles
function burstAt(x, y, cols, n, delay = 0) { for (let i = 0; i < n; i++) { const a = Math.random() * 7, v = 2 + Math.random() * 5; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, life: 1, col: cols[i % cols.length], sz: s * (0.06 + Math.random() * 0.08), t: -delay, rot: Math.random() * 6 }); } }
function confettiFx() { const c = ['#ff4560', '#ffbf1f', '#2f86ff', '#25c25f', '#a052ff', '#fff']; for (let i = 0; i < 120; i++) parts.push({ x: Math.random() * W, y: -20 - Math.random() * H * 0.3, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 3, life: 2.2, col: c[i % 6], sz: 5 + Math.random() * 4, t: 0, rot: Math.random() * 6, conf: 1 }); }

// ---------------------------------------------------------------- drawing
function drawSpecial(p, x, y, sz, t) {
  const cx = x + sz / 2, cy = y + sz / 2, k = sz / 100;
  g.save(); g.translate(cx, cy);
  if (p.k === 'rh' || p.k === 'rv') {
    if (p.k === 'rv') g.rotate(Math.PI / 2); g.scale(1.12, 1.12);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(0, 30 * k, 40 * k, 8 * k, 0, 0, 7); g.fill();
    for (const sd of [-1, 1]) { g.fillStyle = '#ff5a3c'; g.beginPath(); g.moveTo(sd * 22 * k, -16 * k); g.lineTo(sd * 44 * k, 0); g.lineTo(sd * 22 * k, 16 * k); g.closePath(); g.fill();
      g.fillStyle = '#2f86ff'; g.beginPath(); g.moveTo(sd * 8 * k, -15 * k); g.lineTo(sd * 18 * k, -27 * k); g.lineTo(sd * 22 * k, -12 * k); g.closePath(); g.fill(); g.beginPath(); g.moveTo(sd * 8 * k, 15 * k); g.lineTo(sd * 18 * k, 27 * k); g.lineTo(sd * 22 * k, 12 * k); g.closePath(); g.fill(); }
    const gr = g.createLinearGradient(0, -17 * k, 0, 17 * k); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#c9d6ec');
    rr(g, -26 * k, -17 * k, 52 * k, 34 * k, 16 * k); g.fillStyle = gr; g.fill();
    g.fillStyle = '#ff5a3c'; g.fillRect(-20 * k, -17 * k, 6 * k, 34 * k); g.fillRect(14 * k, -17 * k, 6 * k, 34 * k);
    g.fillStyle = '#ffbf1f'; g.beginPath(); g.arc(0, 0, 10 * k, 0, 7); g.fill(); g.fillStyle = '#7fd3ff'; g.beginPath(); g.arc(0, 0, 6.5 * k, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(-2 * k, -2 * k, 2.2 * k, 0, 7); g.fill();
  } else if (p.k === 'bomb') {
    g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(0, 36 * k, 32 * k, 8 * k, 0, 0, 7); g.fill();
    const gr = g.createRadialGradient(-12 * k, -6 * k, 4 * k, 0, 6 * k, 38 * k); gr.addColorStop(0, '#6c7cff'); gr.addColorStop(0.5, '#2b2f7a'); gr.addColorStop(1, '#141633');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 6 * k, 34 * k, 0, 7); g.fill();
    g.fillStyle = '#8a8fb8'; rr(g, -10 * k, -34 * k, 20 * k, 12 * k, 3 * k); g.fill();
    g.strokeStyle = '#c99a5b'; g.lineWidth = 4 * k; g.beginPath(); g.moveTo(0, -34 * k); g.quadraticCurveTo(10 * k, -46 * k, 20 * k, -40 * k); g.stroke();
    const f = 0.7 + Math.sin(t * 30) * 0.3; g.fillStyle = '#fff36b'; g.beginPath(); g.arc(21 * k, -41 * k, 7 * k * f, 0, 7); g.fill(); g.fillStyle = '#ff7a1a'; g.beginPath(); g.arc(21 * k, -41 * k, 4 * k * f, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(-14 * k, -8 * k, 9 * k, 5 * k, -0.6, 0, 7); g.fill();
  } else if (p.k === 'orb') {
    g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(0, 38 * k, 32 * k, 8 * k, 0, 0, 7); g.fill();
    g.save(); g.beginPath(); g.arc(0, 0, 38 * k, 0, 7); g.clip(); g.rotate(t * 1.5);
    const C = ['#ff4560', '#ffbf1f', '#25c25f', '#2f86ff', '#a052ff', '#ff7ad9'];
    for (let i = 0; i < 12; i++) { g.fillStyle = C[i % 6]; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 40 * k, i * Math.PI / 6, (i + 1) * Math.PI / 6); g.fill(); }
    g.restore();
    const gr = g.createRadialGradient(-12 * k, -14 * k, 2 * k, 0, 0, 40 * k); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(0.35, 'rgba(255,255,255,.15)'); gr.addColorStop(1, 'rgba(40,0,80,.35)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 38 * k, 0, 7); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 3.5 * k; g.stroke();
  }
  g.restore();
}
function miniIcon(kind, x, y, sz, t) { drawSpecial({ k: kind }, x, y, sz, t); }
function drawHeader(t) {
  g.save(); g.shadowColor = 'rgba(50,20,110,.3)'; g.shadowBlur = 16; g.shadowOffsetY = 6;
  rr(g, PX, PY, PW, PH, 22); g.fillStyle = 'rgba(255,255,255,.92)'; g.fill(); g.restore();
  // moves badge
  const mx = PX + 46, my = PY + PH / 2, low = moves <= 5 && state === 'play';
  const pulse = low ? 1 + Math.sin(t * 10) * 0.06 : 1;
  g.save(); g.translate(mx, my); g.scale(pulse, pulse);
  const gr = g.createLinearGradient(0, -32, 0, 32); gr.addColorStop(0, low ? '#ff7a8a' : '#9b7bff'); gr.addColorStop(1, low ? '#e8344d' : '#6a3dea');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 32, 0, 7); g.fill(); g.lineWidth = 4; g.strokeStyle = '#fff'; g.stroke();
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = "800 28px 'Baloo 2',system-ui"; g.fillText(Math.max(0, moves), 0, -2);
  g.font = "800 9px system-ui"; g.fillText('MOVES', 0, 17); g.restore();
  g.fillStyle = '#5a4a8a'; g.textAlign = 'left'; g.font = "800 13px system-ui"; g.fillText(`LEVEL ${level}`, PX + 86, PY + 26);
  g.font = "800 20px 'Baloo 2',system-ui"; g.fillStyle = '#3a2a6a'; g.fillText(`${score}`, PX + 86, PY + 52);
  // goals on the right
  const gw = 64, gap = 6; let gx = PX + PW - 12 - goals.length * gw - (goals.length - 1) * gap;
  for (const gl of goals) {
    gl.bump = Math.max(0, gl.bump - 0.06);
    const cx = gx + gw / 2, cy = PY + PH / 2, isz = 34 * (1 + gl.bump * 0.25);
    gl.x = cx; gl.y = cy - 6;
    rr(g, gx, PY + 8, gw, PH - 16, 14); g.fillStyle = '#efeafc'; g.fill();
    if (gl.t === 'col') g.drawImage(spr[gl.col], cx - isz / 2, cy - 6 - isz / 2 - 4, isz, isz);
    else g.drawImage(crateSpr[1], cx - isz / 2, cy - 6 - isz / 2 - 4, isz, isz);
    if (gl.left <= 0) { g.fillStyle = '#25c25f'; g.beginPath(); g.arc(cx + 16, cy + 14, 11, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx + 11, cy + 14); g.lineTo(cx + 15, cy + 18); g.lineTo(cx + 22, cy + 10); g.stroke(); }
    else { g.fillStyle = '#3a2a6a'; g.font = "800 16px 'Baloo 2',system-ui"; g.textAlign = 'center'; g.fillText(gl.left, cx, cy + 22); }
    gx += gw + gap;
  }
}
function draw(t, dt) {
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.drawImage(bgC, 0, 0, W, H);
  drawHeader(t);
  const sx = shake > 0 ? (Math.random() - 0.5) * 10 * shake : 0, sy = shake > 0 ? (Math.random() - 0.5) * 10 * shake : 0;
  shake = Math.max(0, shake - 0.04 * dt);
  g.save(); g.translate(sx, sy);
  // board backing
  g.save(); g.shadowColor = 'rgba(40,20,100,.35)'; g.shadowBlur = 24; g.shadowOffsetY = 10;
  rr(g, X0 - 10, Y0 - 10, s * COLS + 20, s * ROWS + 20, 20); g.fillStyle = 'rgba(46,32,120,.55)'; g.fill(); g.restore();
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if ((r + c) % 2) { g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(cellX(c), cellY(r), s, s); }
  // group preview icons
  const icon = new Map();
  if (state === 'play') for (const gp of allGroups()) if (gp.length >= 5) { const k = gp.length >= 9 ? 'orb' : gp.length >= 7 ? 'bomb' : 'rh'; gp.forEach(([a, b]) => icon.set(a * COLS + b, k)); }
  g.save(); rr(g, X0 - 6, Y0 - 6, s * COLS + 12, s * ROWS + 12, 16); g.clip();
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const p = grid[r][c]; if (!p) continue;
    const x = cellX(c) + (p.sh ? Math.sin(p.sh * 30) * s * 0.06 * p.sh : 0), y = Y0 + p.y * s;
    const sq = Math.sin(p.sq * Math.PI) * 0.14, w = s * (1 + sq), h = s * (1 - sq), bx = x - (w - s) / 2, by = y + (s - h);
    if (p.k === 'cube') { g.drawImage(spr[p.col], bx, by, w, h); const ic = icon.get(r * COLS + c); if (ic && Math.abs(p.y - r) < 0.05) miniIcon(ic, x + s * 0.52, y + s * 0.5, s * 0.46, t); }
    else if (p.k === 'crate') g.drawImage(crateSpr[Math.max(1, p.hp)], bx, by, w, h);
    else { const b = p.born ? 1 + Math.sin(p.born * Math.PI) * 0.3 : 1; drawSpecial(p, x - s * (b - 1) / 2, y - s * (b - 1) / 2, s * b * (1 + Math.sin(t * 4 + r + c) * 0.03), t); }
  }
  g.restore();
  // ghosts (popping pieces)
  for (const gh of ghosts) {
    if (gh.t < 0) continue; const k = gh.t / 0.16, sc = 1 + k * 0.35; g.globalAlpha = Math.max(0, 1 - k);
    if (gh.img) g.drawImage(gh.img, gh.x - s * (sc - 1) / 2, gh.y - s * (sc - 1) / 2, s * sc, s * sc); else drawSpecial(gh.p, gh.x - s * (sc - 1) / 2, gh.y - s * (sc - 1) / 2, s * sc, t);
    g.globalAlpha = 1;
  }
  // effects
  for (const f of fxs) {
    if (f.t < 0) continue;
    if (f.k === 'streak') {
      const d = f.t * s * 30, a = Math.max(0, 1 - f.t / 0.45);
      g.save(); g.globalAlpha = a; g.translate(f.x, f.y); if (f.d === 'v') g.rotate(Math.PI / 2);
      const gr = g.createLinearGradient(-d, 0, d, 0); gr.addColorStop(0, 'rgba(255,240,150,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,240,150,0)');
      g.fillStyle = gr; g.fillRect(-d, -s * 0.18, d * 2, s * 0.36); g.globalAlpha = 1;
      for (const sd of [-1, 1]) { g.save(); g.translate(sd * d, 0); if (sd < 0) g.rotate(Math.PI); drawSpecial({ k: 'rh' }, -s * 0.35, -s * 0.35, s * 0.7, t); g.restore(); }
      g.restore();
    } else if (f.k === 'ring') {
      const k = f.t / 0.4; g.strokeStyle = `rgba(255,255,255,${Math.max(0, 1 - k)})`; g.lineWidth = 10 * (1 - k) + 2; g.beginPath(); g.arc(f.x, f.y, f.R * Math.min(1, k * 1.2), 0, 7); g.stroke();
      g.fillStyle = `rgba(255,220,120,${Math.max(0, 0.5 - k)})`; g.fill();
    } else if (f.k === 'zap') {
      const a = Math.max(0, 1 - f.t / 0.55); g.strokeStyle = f.col; g.globalAlpha = a; g.lineWidth = 3;
      for (const [x, y] of f.pts) { g.beginPath(); g.moveTo(f.x, f.y); const mx = (f.x + x) / 2 + (Math.random() - 0.5) * 16, my = (f.y + y) / 2 + (Math.random() - 0.5) * 16; g.lineTo(mx, my); g.lineTo(x, y); g.stroke(); }
      g.strokeStyle = '#fff'; g.lineWidth = 1.2; for (const [x, y] of f.pts) { g.beginPath(); g.moveTo(f.x, f.y); g.lineTo(x, y); g.stroke(); }
      g.globalAlpha = 1;
    }
  }
  g.restore();
  // particles + flyers on top
  for (const p of parts) { if (p.t < 0) continue; g.globalAlpha = Math.min(1, p.life); g.fillStyle = p.col; g.save(); g.translate(p.x, p.y); g.rotate(p.rot); if (p.conf) g.fillRect(-p.sz, -p.sz * 0.4, p.sz * 2, p.sz * 0.8); else g.fillRect(-p.sz / 2, -p.sz / 2, p.sz, p.sz); g.restore(); }
  g.globalAlpha = 1;
  for (const f of flyers) { if (f.t < 0) continue; const k = Math.min(1, f.t / 0.55), e = k * k * (3 - 2 * k), x = f.x + (f.tx - f.x) * e, y = f.y + (f.ty - f.y) * e - Math.sin(k * Math.PI) * 80, sz = s * (0.8 - 0.35 * k); g.drawImage(f.img, x - sz / 2, y - sz / 2, sz, sz); }
}

// ---------------------------------------------------------------- loop
loop((dt, t) => {
  const sec = dt / 60;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const p = grid[r][c]; if (!p) continue;
    if (p.y < r) { p.vy += 0.022 * dt; p.y += p.vy * dt; if (p.y >= r) { p.y = r; if (p.vy > 0.08) p.sq = 1; p.vy = 0; } }
    else { p.y = r; p.vy = 0; }
    if (p.sq) p.sq = Math.max(0, p.sq - 0.09 * dt); if (p.sh) p.sh = Math.max(0, p.sh - 0.05 * dt); if (p.born) p.born = Math.max(0, p.born - 0.06 * dt);
  }
  for (const gh of ghosts) { const was = gh.t; gh.t += sec; if (was < 0 && gh.t >= 0 && gh.col) burstAt(gh.x + s / 2, gh.y + s / 2, [gh.col, '#fff', gh.col], 6); }
  ghosts = ghosts.filter(gh => gh.t < 0.16);
  for (const f of fxs) f.t += sec; fxs = fxs.filter(f => f.t < 0.6);
  for (const p of parts) { p.t += sec; if (p.t < 0) continue; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.conf ? 0.05 : 0.3) * dt; if (p.conf) { p.vx *= 0.99; p.vy = Math.min(p.vy, 3); } p.rot += 0.1 * dt; p.life -= (p.conf ? 0.008 : 0.03) * dt; }
  parts = parts.filter(p => p.life > 0 && p.y < H + 40);
  for (const f of flyers) { const was = f.t; f.t += sec; if (was < 0.55 && f.t >= 0.55) { f.gl.bump = 1; tone(1200, 0.04, 'sine', 0.05, 1.2); } }
  flyers = flyers.filter(f => f.t < 0.55);
  // leftover moves fire as bonus rockets after a win
  if (state === 'won' && bonusQ > 0 && Math.random() < 0.18 * dt) {
    bonusQ--; const r = Math.floor(Math.random() * ROWS), c = Math.floor(Math.random() * COLS), k = Math.random() < 0.5 ? 'rh' : 'rv';
    fx(k, r, c, 0); for (const [a, b] of cellsFor(k, r, c)) { const p = grid[a][b]; if (p && p.k === 'cube') { ghosts.push({ x: cellX(b), y: cellY(a), t: -Math.hypot(a - r, b - c) * 0.03, img: spr[p.col], col: CUBE[p.col].c }); grid[a][b] = null; } }
    gravity();
  }
  draw(t, dt);
});

cv.addEventListener('pointerdown', e => {
  const c = Math.floor((e.clientX - X0) / s), r = Math.floor((e.clientY - Y0) / s);
  tap(r, c);
});
ui.onTap(w => { if (w === 'win' || w === 'lose') build(); state = 'play'; lvStart = performance.now(); B.start(); });

resize(); build(); ui.start();

window.__game = {
  get state() { return state === 'ending' ? 'play' : state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play') return;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const p = grid[r][c]; if (p && SPECIAL.has(p.k) && Math.abs(p.y - r) < 0.45) { tap(r, c); return; } }
    let bestG = null, bs = 0;
    for (const gp of allGroups()) {
      const [r, c] = gp[0], p = grid[r][c]; if (gp.some(([a, b]) => Math.abs(grid[a][b].y - a) > 0.45)) continue;
      const want = goals.some(gl => gl.t === 'col' && gl.col === p.col && gl.left > 0);
      let sc = gp.length * (want ? 2 : 1) + (gp.length >= 5 ? 4 : 0);
      if (goals.some(gl => gl.t === 'crate' && gl.left > 0)) sc += gp.filter(([a, b]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dr, dc]) => inB(a + dr, b + dc) && grid[a + dr][b + dc] && grid[a + dr][b + dc].k === 'crate')).length * 1.5;
      if (sc > bs) { bs = sc; bestG = gp; }
    }
    if (bestG) tap(bestG[0][0], bestG[0][1]);
  },
};
