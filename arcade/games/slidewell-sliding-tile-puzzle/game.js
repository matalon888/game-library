// Slidewell — the sliding tile puzzle. Slide numbered tiles (or pieces of a picture drawn in code) back into order.
// Tap a tile in the gap's row or column to slide it (and the ones between) into the gap, or swipe it. 3×3, 4×4, 5×5.
// Every shuffle is checked for solvability (permutation parity); hints and the test bot use a layer-by-layer exact solver.
import { board } from './kit/board.js';
import { shell, rngf, rrect, ease, buzz, tone, soft, chime, arp, SVG } from './puzzle.js';
import { solve, shuffled, isSolved } from './slidesolve.js';

const SIZES = [3, 4, 5];
const IMG = '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>';
const SCENES = ['dunes', 'lake', 'balloons', 'koi'];
let sizeI = Math.max(0, Math.min(2, +(localStorage.getItem('slidewell_size') || 0)));
let picture = localStorage.getItem('slidewell_pic') === '1';
let n = 3, a = [], disp = {}, moves = 0, geo = { x: 0, y: 0, s: 80 }, wonAt = 0, scene = 'dunes', art = null, artKey = '', press = null, peek = false, hintTile = -1, hintAt = 0, botPath = null, builtSize = -1, popAt = new Map();

const B = board({ game: 'slidewell', label: 'Puzzles solved', limits: { maxRun: 1, maxPerSec: 0.4 }, mode: 'sum', corner: 'tl' });
const P = shell({
  B,
  key: 'slidewell', name: 'Slidewell: Sliding Tile Puzzle', brand: 'Slidewell', kicker: 'sliding tile puzzle', accent: '#4c6fd8', ink: '#25304a',
  bg: ['#f2f5fc', '#dfe5f4'], winWord: 'In order!', dailyLevel: 4,
  rule: 'Tap or swipe tiles into the gap until they are back in order.',
  chips: { items: SIZES.map(s => `${s} × ${s}`), get: () => sizeI, set: (i) => { sizeI = i; localStorage.setItem('slidewell_size', i); } },
  needsRebuild: () => builtSize !== sizeI,
  tools: [
    { id: 'style', label: picture ? 'Numbers' : 'Picture', svg: IMG, onPress: (b) => { picture = !picture; localStorage.setItem('slidewell_pic', picture ? '1' : '0'); b.querySelector('.lb').textContent = picture ? 'Numbers' : 'Picture'; soft.swish(); buzz(6); } },
    { id: 'peek', label: 'Peek', svg: SVG.eye, onPress: () => { peek = true; soft.click(); }, onRelease: () => { peek = false; } },
    'hint',
    { id: 'menu', label: 'Size', svg: SVG.grid, onPress: () => P.menu() },
  ],
  build(level, seed, fk) {
    n = P.D.isDaily ? 4 : SIZES[sizeI]; builtSize = sizeI;
    const r = rngf(seed);
    a = shuffled(n, r); moves = 0; wonAt = 0; hintTile = -1; botPath = null; popAt = new Map();
    scene = SCENES[(P.D.isDaily ? Math.floor(r() * 4) : (level - 1)) % SCENES.length];
    disp = {}; a.forEach((v, i) => { if (v) disp[v] = { x: i % n, y: (i / n) | 0 }; });
    artKey = ''; hud();
    return { label: `${n} × ${n} · ${picture ? 'picture' : 'numbers'}`, sizeKey: 'n' + n, cells: n * n * 2, value: 1 };
  },
  layout(ar) {
    const s = Math.floor(Math.min(ar.w - 8, ar.h - 40, 520) / n);
    geo = { s, x: Math.round(ar.x + (ar.w - s * n) / 2), y: Math.round(ar.y + Math.max(10, (ar.h - 30 - s * n) * 0.45)) };
    artKey = '';
  },
  snapshot: () => null, restore() {}, isEmpty: () => true, clear() {},
  hint() {
    const p = solve(a, n); if (!p || !p.length) return false;
    const m = p[0], t = a[m]; slideFrom(m, true); hintTile = t; hintAt = performance.now(); botPath = null; return true;
  },
  down(x, y) { const c = cellAt(x, y); press = { x, y, c }; },
  up(x, y) {
    if (!press || wonAt) { press = null; return; }
    const p = press; press = null; if (p.c < 0) return;
    const dx = x - p.x, dy = y - p.y, dist = Math.hypot(dx, dy);
    const g = a.indexOf(0), gr = (g / n) | 0, gc = g % n, r = (p.c / n) | 0, c = p.c % n;
    if (dist < 12) { if (r === gr || c === gc) slideFrom(p.c); else { soft.err(); popAt.set(a[p.c], -performance.now()); } return; }
    // swipe: only toward the gap along the tile's row / column
    const dir = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
    if (dir[1] === 0 && r === gr && Math.sign(gc - c) === dir[0]) slideFrom(p.c);
    else if (dir[0] === 0 && c === gc && Math.sign(gr - r) === dir[1]) slideFrom(p.c);
  },
  tick(dt) {
    const k = Math.min(1, 0.34 * dt);
    a.forEach((v, i) => { if (!v) return; const d = disp[v], tx = i % n, ty = (i / n) | 0; d.x += (tx - d.x) * k; d.y += (ty - d.y) * k; if (Math.abs(tx - d.x) < 0.002) d.x = tx; if (Math.abs(ty - d.y) < 0.002) d.y = ty; });
  },
  draw,
  debug: () => ({ n, moves, solved: isSolved(a) }),
  bot() {
    if (wonAt) return;
    if (!botPath || !botPath.length || !adjacent(a.indexOf(0), botPath[0])) botPath = solve(a, n);
    if (!botPath || !botPath.length) return;
    slideFrom(botPath.shift(), false, true);
  },
});

function adjacent(g, m) { return Math.abs(g - m) === n || (Math.abs(g - m) === 1 && ((g / n) | 0) === ((m / n) | 0)); }
function cellAt(x, y) { const cx = Math.floor((x - geo.x) / geo.s), cy = Math.floor((y - geo.y) / geo.s); return cx < 0 || cy < 0 || cx >= n || cy >= n ? -1 : cy * n + cx; }
function hud() {
  let el = document.getElementById('sw-moves');
  if (!el) { el = document.createElement('span'); el.id = 'sw-moves'; document.getElementById('pz-time').prepend(el); }
  el.textContent = `${moves} moves`;
  let ok = 0; for (let i = 0; i < n * n - 1; i++) if (a[i] === i + 1) ok++;
  P.progress && P.progress(ok / (n * n - 1));
}
/** slide the tile at cell c (and every tile between it and the gap) one step toward the gap */
function slideFrom(c, fromHint = false, isBot = false) {
  if (P.state !== 'play' || wonAt) return;
  let g = a.indexOf(0); const gr = (g / n) | 0, gc = g % n, r = (c / n) | 0, col = c % n;
  if (!(r === gr || col === gc) || c === g) return;
  const step = r === gr ? Math.sign(col - gc) : Math.sign(r - gr) * n;
  let count = 0;
  while (g !== c) { const m = g + step; a[g] = a[m]; a[m] = 0; g = m; count++; }
  moves += count; if (!isBot) botPath = null;
  const before = a.slice();
  tone(380 + Math.random() * 40, 0.05, 'triangle', 0.09, 0.8); setTimeout(() => tone(900, 0.02, 'sine', 0.03, 0.8), 70); buzz(5);
  // a tile that just landed home gets a small chime
  for (let i = 0; i < n * n - 1; i++) if (a[i] === i + 1 && popAt.get(a[i]) === undefined) { popAt.set(a[i], performance.now()); }
  for (const [v, t] of popAt) { if (a[v - 1] !== v) popAt.delete(v); }
  hud();
  if (isSolved(a)) win();
}
function win() {
  wonAt = performance.now();
  arp([67, 71, 74, 79], 80, 0.1, 0.8);
  setTimeout(() => { P.fx.ring(geo.x + (n - 0.5) * geo.s, geo.y + (n - 0.5) * geo.s, '#fff', geo.s * 0.6); }, 250);
  P.solved(`${n}×${n} · ${moves} moves`, 900);
}

// ---------------------------------------------------------------- pictures drawn in code
function paintScene(g, W, H, name, rand) {
  const lin = (y0, y1, stops) => { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; };
  const hill = (base, amp, freq, phase, color) => { g.fillStyle = color; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += W / 60) g.lineTo(x, base + Math.sin(x / W * freq + phase) * amp + Math.sin(x / W * freq * 2.3 + phase * 1.7) * amp * 0.35); g.lineTo(W, H); g.closePath(); g.fill(); };
  if (name === 'dunes') {
    g.fillStyle = lin(0, H, [[0, '#ffcf9e'], [0.45, '#ff9a8b'], [1, '#c77dab']]); g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff3c4'; g.beginPath(); g.arc(W * 0.66, H * 0.4, W * 0.15, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,243,196,.35)'; g.beginPath(); g.arc(W * 0.66, H * 0.4, W * 0.21, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineCap = 'round'; for (const [x, y, w] of [[0.08, 0.12, 0.3], [0.2, 0.18, 0.18], [0.55, 0.1, 0.25], [0.12, 0.42, 0.22], [0.82, 0.24, 0.14]]) { g.lineWidth = H * 0.012; g.beginPath(); g.moveTo(x * W, y * H); g.lineTo((x + w) * W, y * H); g.stroke(); }
    hill(H * 0.55, H * 0.05, 5, 1, '#f08b6f'); hill(H * 0.66, H * 0.06, 4, 2.4, '#d9667a'); hill(H * 0.78, H * 0.05, 3, 0.4, '#a9507f'); hill(H * 0.9, H * 0.04, 4.5, 3, '#6f3f78');
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = H * 0.006; for (let k = 0; k < 14; k++) { const y = H * (0.6 + k * 0.028), x = W * ((k * 0.37) % 1); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + W * 0.08, y - H * 0.012, x + W * 0.18, y); g.stroke(); }
    g.fillStyle = '#4b2f5e'; for (const [x, h] of [[0.12, 0.09], [0.16, 0.06], [0.86, 0.07]]) { const bx = x * W, by = H * 0.93; g.fillRect(bx - W * 0.006, by - h * H, W * 0.012, h * H); g.fillRect(bx - W * 0.03, by - h * H * 0.65, W * 0.03, W * 0.01); g.fillRect(bx, by - h * H * 0.8, W * 0.025, W * 0.01); }
    g.strokeStyle = '#5a3466'; g.lineWidth = W * 0.008; g.lineCap = 'round';
    for (const [bx, by, bs] of [[0.22, 0.24, 1], [0.3, 0.3, 0.7], [0.16, 0.33, 0.6]]) { const x = bx * W, y = by * H, s = W * 0.03 * bs; g.beginPath(); g.moveTo(x - s, y); g.quadraticCurveTo(x - s / 2, y - s * 0.6, x, y); g.quadraticCurveTo(x + s / 2, y - s * 0.6, x + s, y); g.stroke(); }
  } else if (name === 'lake') {
    g.fillStyle = lin(0, H * 0.55, [[0, '#9fd3ff'], [1, '#e8f5ff']]); g.fillRect(0, 0, W, H * 0.56);
    const mtn = (x0, w, h, c, snow) => { g.fillStyle = c; g.beginPath(); g.moveTo(x0 - w / 2, H * 0.56); g.lineTo(x0, H * 0.56 - h); g.lineTo(x0 + w / 2, H * 0.56); g.closePath(); g.fill(); if (snow) { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x0 - w * 0.12, H * 0.56 - h * 0.76); g.lineTo(x0, H * 0.56 - h); g.lineTo(x0 + w * 0.12, H * 0.56 - h * 0.76); g.lineTo(x0 + w * 0.04, H * 0.56 - h * 0.7); g.lineTo(x0 - w * 0.03, H * 0.56 - h * 0.78); g.closePath(); g.fill(); } };
    mtn(W * 0.3, W * 0.8, H * 0.42, '#7d8fc9', true); mtn(W * 0.72, W * 0.7, H * 0.34, '#6577b8', true); mtn(W * 0.05, W * 0.5, H * 0.22, '#5a9b85', false); mtn(W * 0.95, W * 0.5, H * 0.25, '#4f8d78', false);
    g.fillStyle = lin(H * 0.56, H, [[0, '#7fb6e6'], [1, '#3f78b8']]); g.fillRect(0, H * 0.56, W, H * 0.44);
    g.save(); g.globalAlpha = 0.28; g.translate(0, H * 1.12); g.scale(1, -1); mtn(W * 0.3, W * 0.8, H * 0.42, '#7d8fc9', true); mtn(W * 0.72, W * 0.7, H * 0.34, '#6577b8', true); g.restore();
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = W * 0.006; for (let k = 0; k < 9; k++) { const y = H * (0.62 + k * 0.04), x = W * (0.1 + rand() * 0.7); g.beginPath(); g.moveTo(x, y); g.lineTo(x + W * (0.06 + rand() * 0.1), y); g.stroke(); }
    for (let k = 0; k < 7; k++) { const x = W * (0.02 + k * 0.045), h = H * (0.12 + (k % 3) * 0.03); g.fillStyle = k % 2 ? '#2f6b55' : '#3a7c62'; g.beginPath(); g.moveTo(x, H * 0.6 - h); g.lineTo(x - W * 0.035, H * 0.6); g.lineTo(x + W * 0.035, H * 0.6); g.closePath(); g.fill(); }
  } else if (name === 'balloons') {
    g.fillStyle = lin(0, H, [[0, '#7ec8f2'], [1, '#d9f0ff']]); g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,.9)'; for (const [cx, cy, s] of [[0.2, 0.75, 1], [0.75, 0.85, 1.3], [0.85, 0.2, 0.7], [0.1, 0.25, 0.6]]) { for (const [dx, dy, r] of [[0, 0, 0.08], [0.07, 0.02, 0.06], [-0.07, 0.02, 0.055], [0.02, -0.04, 0.06]]) { g.beginPath(); g.arc((cx + dx * s) * W, (cy + dy * s) * H, r * s * W, 0, 7); g.fill(); } }
    const balloon = (cx, cy, r, cols) => {
      g.save(); g.translate(cx, cy);
      g.beginPath(); g.moveTo(0, r * 1.25); g.bezierCurveTo(-r * 1.35, r * 0.2, -r * 1.05, -r * 1.1, 0, -r * 1.1); g.bezierCurveTo(r * 1.05, -r * 1.1, r * 1.35, r * 0.2, 0, r * 1.25); g.closePath(); g.save(); g.clip();
      for (let k = -3; k <= 3; k++) { g.fillStyle = cols[(k + 3) % cols.length]; g.fillRect(k * r * 0.34 - r * 0.17, -r * 1.2, r * 0.34, r * 2.6); }
      g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(-r * 0.35, -r * 0.4, r * 0.25, r * 0.5, -0.3, 0, 7); g.fill(); g.restore();
      g.strokeStyle = '#6b4a2f'; g.lineWidth = r * 0.04; g.beginPath(); g.moveTo(-r * 0.25, r * 1.2); g.lineTo(-r * 0.18, r * 1.55); g.moveTo(r * 0.25, r * 1.2); g.lineTo(r * 0.18, r * 1.55); g.stroke();
      g.fillStyle = '#9a6a3f'; rrect(g, -r * 0.22, r * 1.55, r * 0.44, r * 0.3, r * 0.06); g.fill();
      g.restore();
    };
    balloon(W * 0.32, H * 0.36, W * 0.17, ['#ff6b6b', '#ffd166', '#ff6b6b', '#ffffff']);
    balloon(W * 0.72, H * 0.52, W * 0.12, ['#6c63ff', '#4ecdc4', '#6c63ff', '#ffe66d']);
    balloon(W * 0.6, H * 0.18, W * 0.07, ['#06d6a0', '#ffffff']);
    g.fillStyle = '#7fc97a'; hill(H * 0.93, H * 0.03, 4, 1, '#79c27d'); hill(H * 0.97, H * 0.02, 6, 2, '#5fae6a');
  } else {
    g.fillStyle = lin(0, H, [[0, '#4fc1b5'], [1, '#257d8a']]); g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = W * 0.01; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(W * (0.2 + rand() * 0.6), H * (0.2 + rand() * 0.6), W * (0.05 + rand() * 0.12), 0, 7); g.stroke(); }
    const pad = (x, y, r, ang) => { g.fillStyle = '#5fb86a'; g.beginPath(); g.moveTo(x, y); g.arc(x, y, r, ang + 0.35, ang + Math.PI * 2 - 0.05); g.closePath(); g.fill(); g.strokeStyle = '#4a9a56'; g.lineWidth = r * 0.05; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ang + 1.5) * r * 0.8, y + Math.sin(ang + 1.5) * r * 0.8); g.stroke(); };
    pad(W * 0.15, H * 0.2, W * 0.12, 0.3); pad(W * 0.85, H * 0.78, W * 0.14, 2.2); pad(W * 0.82, H * 0.15, W * 0.08, 4);
    g.fillStyle = '#ffb3c7'; g.beginPath(); for (let k = 0; k < 8; k++) { const an = k * Math.PI / 4; g.ellipse(W * 0.85 + Math.cos(an) * W * 0.03, H * 0.78 + Math.sin(an) * W * 0.03, W * 0.03, W * 0.014, an, 0, 7); } g.fill(); g.fillStyle = '#ffe08a'; g.beginPath(); g.arc(W * 0.85, H * 0.78, W * 0.018, 0, 7); g.fill();
    const koi = (x, y, s, ang, body, spot) => {
      g.save(); g.translate(x, y); g.rotate(ang);
      g.fillStyle = body; g.beginPath(); g.moveTo(s * 0.5, 0); g.bezierCurveTo(s * 0.4, -s * 0.2, -s * 0.2, -s * 0.18, -s * 0.45, 0); g.bezierCurveTo(-s * 0.2, s * 0.18, s * 0.4, s * 0.2, s * 0.5, 0); g.fill();
      g.beginPath(); g.moveTo(-s * 0.4, 0); g.lineTo(-s * 0.68, -s * 0.16); g.quadraticCurveTo(-s * 0.6, 0, -s * 0.68, s * 0.16); g.closePath(); g.fill();
      g.fillStyle = spot; g.beginPath(); g.ellipse(s * 0.12, -s * 0.03, s * 0.12, s * 0.08, 0.3, 0, 7); g.fill(); g.beginPath(); g.ellipse(-s * 0.15, s * 0.04, s * 0.08, s * 0.06, 0, 0, 7); g.fill();
      g.fillStyle = '#222'; g.beginPath(); g.arc(s * 0.38, -s * 0.06, s * 0.025, 0, 7); g.fill();
      g.restore();
    };
    koi(W * 0.42, H * 0.45, W * 0.42, -0.5, '#fff6ee', '#ff7a3c');
    koi(W * 0.6, H * 0.68, W * 0.34, 2.6, '#ff8a3c', '#fff6ee');
  }
}
function ensureArt() {
  const size = geo.s * n, dpr = Math.min(devicePixelRatio || 1, 2), key = `${scene}_${size}_${dpr}`;
  if (artKey === key && art) return;
  art = document.createElement('canvas'); art.width = size * dpr; art.height = size * dpr;
  const g = art.getContext('2d'); g.scale(dpr, dpr); paintScene(g, size, size, scene, rngf(scene.length * 97)); artKey = key;
}

// ---------------------------------------------------------------- drawing
const TINTS = ['#6f8ff0', '#7f7ae8', '#5ea6e8', '#58b8c9', '#6dc0a0'];
function tileColor(v) { const i = v - 1, r = (i / n) | 0, c = i % n; const t = (r + c) / (2 * n - 2); return mix('#7b9cf5', '#a585ef', t); }
function mix(h1, h2, t) { const p = (h) => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16)); const A = p(h1), Bc = p(h2); return `rgb(${A.map((v, k) => Math.round(v + (Bc[k] - v) * t)).join(',')})`; }
function draw(g) {
  const { x: X, y: Y, s } = geo, now = performance.now(), BW = s * n, gap = Math.max(3, s * 0.05), rad = Math.max(6, s * 0.13);
  if (picture) ensureArt();
  // tray
  g.save(); g.shadowColor = 'rgba(40,50,90,.22)'; g.shadowBlur = 26; g.shadowOffsetY = 10; rrect(g, X - 10, Y - 10, BW + 20, BW + 20, rad + 10); g.fillStyle = '#e9edf7'; g.fill(); g.restore();
  rrect(g, X - 10, Y - 10, BW + 20, BW + 20, rad + 10); g.fillStyle = '#d5dcee'; g.fill();
  rrect(g, X - 4, Y - 4, BW + 8, BW + 8, rad + 4); g.fillStyle = '#c3cce4'; g.fill();
  // empty slots
  g.fillStyle = 'rgba(255,255,255,.25)'; for (let i = 0; i < n * n; i++) { rrect(g, X + (i % n) * s + gap / 2, Y + ((i / n) | 0) * s + gap / 2, s - gap, s - gap, rad); g.fill(); }
  const showSolved = peek || (wonAt && now - wonAt > 250);
  if (showSolved && picture) {
    const k = wonAt ? Math.min(1, (now - wonAt - 250) / 400) : 1;
    g.save(); g.globalAlpha = k; rrect(g, X, Y, BW, BW, rad); g.clip(); g.drawImage(art, X, Y, BW, BW); g.restore();
    if (peek) return;
  }
  for (let v = 1; v < n * n; v++) {
    const d = peek ? { x: (v - 1) % n, y: ((v - 1) / n) | 0 } : disp[v]; if (!d) continue;
    const x = X + d.x * s + gap / 2, y = Y + d.y * s + gap / 2, w = s - gap;
    const home = a[v - 1] === v;
    const pa = popAt.get(v); let sc = 1, shakeX = 0;
    if (pa > 0 && now - pa < 300) sc = 1 + Math.sin((now - pa) / 300 * Math.PI) * 0.06;
    if (pa < 0 && now + pa < 320) shakeX = Math.sin((now + pa) / 30) * 3 * (1 - (now + pa) / 320);
    if (hintTile === v && now - hintAt < 900) sc *= 1 + 0.06 * Math.sin((now - hintAt) / 900 * Math.PI);
    g.save(); g.translate(x + w / 2 + shakeX, y + w / 2); g.scale(sc, sc); g.translate(-w / 2, -w / 2);
    if (picture) {
      g.save(); g.shadowColor = 'rgba(30,40,80,.28)'; g.shadowBlur = 6; g.shadowOffsetY = 3; rrect(g, 0, 0, w, w, rad); g.fillStyle = '#fff'; g.fill(); g.restore();
      g.save(); rrect(g, 0, 0, w, w, rad); g.clip();
      const dpr = art.width / (s * n), sx = ((v - 1) % n) * s + gap / 2, sy = (((v - 1) / n) | 0) * s + gap / 2;
      g.drawImage(art, sx * dpr, sy * dpr, w * dpr, w * dpr, 0, 0, w, w);
      g.fillStyle = 'rgba(255,255,255,.16)'; g.fillRect(0, 0, w, w * 0.08);
      g.restore();
      if (!showSolved) { const bs = Math.max(16, s * 0.26); rrect(g, 4, 4, bs, bs * 0.8, bs * 0.3); g.fillStyle = 'rgba(20,25,45,.55)'; g.fill(); g.fillStyle = '#fff'; g.font = `750 ${Math.round(bs * 0.5)}px -apple-system,system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(v, 4 + bs / 2, 4 + bs * 0.42); }
    } else {
      const col = home && !peek ? '#f6b24f' : tileColor(v);
      g.save(); g.shadowColor = 'rgba(30,40,80,.25)'; g.shadowBlur = 6; g.shadowOffsetY = 4; rrect(g, 0, 0, w, w, rad); g.fillStyle = col; g.fill(); g.restore();
      const gr = g.createLinearGradient(0, 0, 0, w); gr.addColorStop(0, 'rgba(255,255,255,.28)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,.08)');
      rrect(g, 0, 0, w, w, rad); g.fillStyle = gr; g.fill();
      rrect(g, 0, w - Math.max(3, w * 0.06), w, Math.max(3, w * 0.06), rad); g.fillStyle = 'rgba(0,0,0,.08)'; g.fill();
      g.fillStyle = '#fff'; g.font = `800 ${Math.round(w * (n === 5 ? 0.42 : 0.44))}px -apple-system,system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = 'rgba(0,0,0,.18)'; g.shadowOffsetY = 2; g.fillText(v, w / 2, w / 2 + 2); g.shadowColor = 'transparent';
    }
    g.restore();
  }
  // win: the missing corner piece fades in, then a light sweep
  if (wonAt) {
    const k = Math.min(1, (now - wonAt) / 350), i = n * n - 1, x = X + (n - 1) * s + gap / 2, y = Y + (n - 1) * s + gap / 2, w = s - gap;
    g.save(); g.globalAlpha = k;
    if (picture) { g.save(); rrect(g, x, y, w, w, rad); g.clip(); const dpr = art.width / (s * n); g.drawImage(art, ((n - 1) * s + gap / 2) * dpr, ((n - 1) * s + gap / 2) * dpr, w * dpr, w * dpr, x, y, w, w); g.restore(); }
    else { rrect(g, x, y, w, w, rad); g.fillStyle = '#f6b24f'; g.fill(); g.fillStyle = '#fff'; g.font = `800 ${Math.round(w * 0.4)}px -apple-system,system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('★', x + w / 2, y + w / 2 + 2); }
    g.restore();
    const t = (now - wonAt) / 1000; if (t < 1.4) { g.save(); rrect(g, X, Y, BW, BW, rad); g.clip(); const sx = X - BW + t * BW * 2.2; const sw = g.createLinearGradient(sx, 0, sx + BW * 0.5, 0); sw.addColorStop(0, 'rgba(255,255,255,0)'); sw.addColorStop(0.5, 'rgba(255,255,255,.45)'); sw.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = sw; g.fillRect(X, Y, BW, BW); g.restore(); }
  }
  // small "goal" thumbnail under the board in picture mode
  if (picture && !peek) {
    const ts = Math.min(64, P.area().H - 96 - (Y + BW + 26)); if (ts > 36) { const tx = X + BW / 2 - ts / 2, ty = Y + BW + 22; g.save(); g.shadowColor = 'rgba(30,40,80,.2)'; g.shadowBlur = 8; rrect(g, tx, ty, ts, ts, 8); g.fillStyle = '#fff'; g.fill(); g.restore(); g.save(); rrect(g, tx + 2, ty + 2, ts - 4, ts - 4, 6); g.clip(); g.drawImage(art, tx + 2, ty + 2, ts - 4, ts - 4); g.restore(); }
  }
}

if (P.D.isDaily && P.btns.menu) P.btns.menu.style.display = 'none';   // the daily puzzle has one fixed size
P.start();
