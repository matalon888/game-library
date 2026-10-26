// Flipwise — turn every tile sunny side up. Tapping a tile flips it and the tiles in the little pattern drawn on it
// (a plus at first; later crosses, rings, knight jumps and bars). Boards are generated (seeded) from a solved board and
// only kept when the press matrix is invertible, so each puzzle has exactly one set of tiles to press: that is the par.
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { shell, rngf, rrect, ease, buzz, tone, soft, chime, arp, note } from './puzzle.js';
import { generate, affected, solution, PATTERNS } from './flipgen.js';

let N = 3, pats = [], inv = null, start = [], st = [], par = 0, moves = 0, geo = { x: 0, y: 0, s: 80, gap: 8 }, flips = new Map(), pressAt = new Map(), hintTile = -1, wonAt = 0, kinds = [];
const NAMES = { plus: 'plus', x: 'cross', ring: 'ring', knight: 'knight', row: 'bar', col: 'bar' };

const B = board({ game: 'flipwise', label: 'Puzzle points', limits: { maxRun: 1500, maxPerSec: 100 }, mode: 'sum' });
const P = shell({
  B,
  key: 'flipwise', name: 'Flipwise: Tile Flip Puzzle', brand: 'Flipwise', kicker: 'tile flip puzzle', accent: '#1f9e8e', ink: '#1f3540',
  bg: ['#eefaf5', '#d5ecf2'], winWord: 'All sunny!', dailyLevel: 12,
  build(level, seed, fk) {
    const p = generate(level, seed, fk, rngf) || generate(1, seed + 9, 1, rngf);
    N = p.N; pats = p.pats; inv = p.inv; start = p.start; st = start.slice(); par = p.par; moves = 0; kinds = p.kinds; flips = new Map(); pressAt = new Map(); hintTile = -1; wonAt = 0;
    prog();
    const kn = [...new Set(kinds.map(k => NAMES[k]))];
    return { label: `${N} × ${N} · ${kn.length > 3 ? kn.length + ' patterns' : kn.join(' · ')}`, sizeKey: 'n' + N + '_' + kinds.length, cells: N * N };
  },
  layout(a) {
    const s = Math.floor(Math.min(a.w, a.h - 80, 470) / N), gap = Math.max(5, Math.round(s * 0.11));
    geo = { s, gap, x: Math.round(a.x + (a.w - s * N) / 2), y: Math.round(a.y + 44 + Math.max(4, (a.h - 90 - s * N) * 0.45)) };
  },
  snapshot: () => ({ st: st.slice(), moves }),
  restore(s) { const before = st; st = s.st; moves = s.moves; st.forEach((v, i) => { if (v !== before[i]) flips.set(i, { from: before[i], to: v, t0: performance.now(), d: 0 }); }); hintTile = -1; prog(); },
  isEmpty: () => moves === 0,
  clear() { const before = st; st = start.slice(); moves = 0; st.forEach((v, i) => { if (v !== before[i]) flips.set(i, { from: before[i], to: v, t0: performance.now(), d: (i % N + ((i / N) | 0)) * 30 }); }); hintTile = -1; prog(); },
  hint() {
    const x = solution(N, inv, st), list = []; x.forEach((v, i) => v && list.push(i));
    if (!list.length) return false;
    hintTile = list[Math.floor(Math.random() * list.length)];
    P.ui.pop('Tap the glowing tile', '#fff', 22, 40);
    return true;
  },
  down(x, y) { const c = cellAt(x, y); if (c >= 0) press(c); },
  draw,
  debug: () => ({ geo, N, st: st.slice(), moves, par }),
  bot() { const x = solution(N, inv, st); const c = x.findIndex(v => v); if (c >= 0) press(c); },
});

function cellAt(x, y) { const cx = Math.floor((x - geo.x) / geo.s), cy = Math.floor((y - geo.y) / geo.s); return cx < 0 || cy < 0 || cx >= N || cy >= N ? -1 : cy * N + cx; }
const center = (c) => [geo.x + (c % N + 0.5) * geo.s, geo.y + (((c / N) | 0) + 0.5) * geo.s];
function prog() { const up = st.filter(v => !v).length; P.progress(up / (N * N)); }

function press(c) {
  P.push(); moves++;
  flipAt(c);
  if (hintTile === c) hintTile = -1;
  soft.wood(); buzz(8);
  prog();
  if (st.every(v => !v) && P.state === 'play') win();
}
function flipAt(c) {   // flip a tile's pattern with its ripple (no move counted)
  const now = performance.now(), cx = c % N, cy = (c / N) | 0;
  pressAt.set(c, now);
  for (const a of affected(N, pats[c], c)) {
    const d = Math.max(Math.abs(a % N - cx), Math.abs(((a / N) | 0) - cy));
    flips.set(a, { from: st[a], to: st[a] ^ 1, t0: now, d: d * 55 });
    st[a] ^= 1;
    setTimeout(() => tone(st[a] ? 330 : 660 + d * 80, 0.06, 'triangle', 0.08, st[a] ? 0.8 : 1.2), d * 55 + 120);
  }
}
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on level 1, until the first touch,
// the middle tile is pressed and its pattern ripples over, then it is pressed back (no move counted, never solves the board)
demo(() => {
  const c = (N * N) >> 1, n0 = N; flipAt(c); soft.wood(); prog();
  setTimeout(() => { if (P.state === 'play' && N === n0) { flipAt(c); prog(); } }, 1000);   // flips commute: this undoes the demo whatever was pressed meanwhile
}, { ready: () => P.state === 'play' && P.level === 1 && moves === 0 && !flips.size && st.some(v => v), wait: 1800, every: 2400, max: 2 });
function win() {
  wonAt = performance.now() + 380;
  const star = moves <= par;
  setTimeout(() => { arp([72, 76, 79, 84, 88], 70, 0.1, 0.8); for (let c = 0; c < N * N; c++) { const [x, y] = center(c); P.fx.sparks(x, y, ['#ffd66b', '#fff', '#7fe0cf'], 4, { speed: 2.6, size: 2.6 }); } if (star) P.ui.pop('PAR!', '#ffd66b', 46, 24); }, 420);
  P.solved(`${moves} moves${star ? ' ★ par' : ' · par ' + par}`, 700);
}

// ---------------------------------------------------------------- drawing
function glyph(g, pat, cx, cy, size, up) {
  const offs = PATTERNS[pat], on = new Set(offs.map(([dx, dy]) => dx + ',' + dy)), st2 = size / 5, r = Math.max(1.6, size * 0.065);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const x = cx + dx * st2, y = cy + dy * st2, isOn = on.has(dx + ',' + dy);
    g.fillStyle = isOn ? (up ? 'rgba(120,70,10,.75)' : 'rgba(170,230,255,.95)') : (up ? 'rgba(120,70,10,.13)' : 'rgba(170,230,255,.14)');
    g.beginPath(); g.arc(x, y, isOn ? r * 1.25 : r * 0.7, 0, 7); g.fill();
  }
  if (!on.has('0,0')) { g.strokeStyle = up ? 'rgba(120,70,10,.75)' : 'rgba(170,230,255,.95)'; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, r * 1.3, 0, 7); g.stroke(); }
}
function tile(g, c, now) {
  const { s, gap } = geo, [x, y] = center(c), f = flips.get(c);
  let face = st[c], sx = 1, lift = 0;
  if (f) {
    const p = Math.min(1, Math.max(0, (now - f.t0 - f.d) / 300));
    if (p >= 1) flips.delete(c); else { sx = Math.abs(Math.cos(p * Math.PI)); face = p < 0.5 ? f.from : f.to; lift = Math.sin(p * Math.PI); }
  }
  if (wonAt && now > wonAt) { const p = Math.min(1, Math.max(0, (now - wonAt - ((c % N) + ((c / N) | 0)) * 60) / 420)); if (p > 0 && p < 1) { sx = Math.abs(Math.cos(p * Math.PI * 2)); lift = Math.sin(p * Math.PI); } }
  const pa = pressAt.get(c), push = pa ? Math.max(0, 1 - (now - pa) / 160) : 0;
  const w = (s - gap) * (1 + lift * 0.1 - push * 0.08), h = w, depth = Math.max(3, s * 0.06) * (1 - push * 0.6);
  g.save(); g.translate(x, y - lift * s * 0.08); g.scale(Math.max(0.02, sx), 1);
  const up = face === 0;
  // shadow + side
  g.fillStyle = 'rgba(20,50,60,.16)'; rrect(g, -w / 2 + 2, -h / 2 + depth + 3 + lift * s * 0.06, w - 4, h, w * 0.18); g.fill();
  g.fillStyle = up ? '#e59a2e' : '#1b2448'; rrect(g, -w / 2, -h / 2 + depth, w, h, w * 0.18); g.fill();
  const gr = g.createLinearGradient(0, -h / 2, 0, h / 2);
  if (up) { gr.addColorStop(0, '#ffe08a'); gr.addColorStop(1, '#ffb84d'); } else { gr.addColorStop(0, '#3d4c80'); gr.addColorStop(1, '#2a3562'); }
  g.fillStyle = gr; rrect(g, -w / 2, -h / 2, w, h, w * 0.18); g.fill();
  g.fillStyle = up ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.07)'; rrect(g, -w / 2 + w * 0.08, -h / 2 + h * 0.06, w * 0.84, h * 0.2, h * 0.1); g.fill();
  glyph(g, pats[c], 0, 2, w * 0.62, up);
  g.restore();
}
function draw(g, t) {
  const { x: X, y: Y, s } = geo, B = s * N, now = performance.now();
  // board tray
  g.save(); g.shadowColor = 'rgba(30,70,80,.16)'; g.shadowBlur = 26; g.shadowOffsetY = 10; rrect(g, X - 12, Y - 12, B + 24, B + 24 + 6, 22); g.fillStyle = '#fbfffd'; g.fill(); g.restore();
  for (let c = 0; c < N * N; c++) tile(g, c, now);
  if (hintTile >= 0) { const [x, y] = center(hintTile), k = 0.5 + 0.5 * Math.sin(now / 160); g.strokeStyle = `rgba(31,158,142,${0.5 + 0.5 * k})`; g.lineWidth = 4; rrect(g, x - s / 2 - 2 - k * 3, y - s / 2 - 2 - k * 3, s + 4 + k * 6, s + 4 + k * 6, s * 0.22); g.stroke(); }
  // moves / par pill above the board
  const txt = `Moves ${moves}   ·   Par ${par}`, under = moves <= par;
  g.font = '750 15px -apple-system,system-ui,sans-serif'; const w = g.measureText(txt).width + 30, px = X + B / 2 - w / 2, py = Y - 52;
  rrect(g, px, py, w, 30, 15); g.fillStyle = 'rgba(255,255,255,.85)'; g.fill();
  g.fillStyle = under ? '#1f3540' : '#c0533a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, X + B / 2, py + 16);
  if (P.level <= 2 && !P.D.isDaily && !wonAt) { g.fillStyle = 'rgba(31,53,64,.55)'; g.font = '600 13px -apple-system,system-ui,sans-serif'; g.fillText('Dots show which tiles flip · make them all sunny', X + B / 2, Y + B + 36); }
}

P.start();
