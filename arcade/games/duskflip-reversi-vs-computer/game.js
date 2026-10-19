// Duskflip — classic reversi (8×8 disc flipping) against a fair computer (Easy / Normal / Hard).
// Legal moves are shown as soft dots, flips ripple out from the placed disc, a player with no move passes,
// and the game ends when neither side can move: most discs wins. CPU thinks in a Web Worker. Undo on Easy.
import { board } from './kit/board.js';
import { duel, DIFFS, rrect, ease, soft, tone, chime, buzz, note } from './duel.js';
import { initial, moves, apply, think, search, count } from './engine.js';

const B = board({ game: 'duskflip', label: 'Wins vs CPU', limits: { maxRun: 2, maxPerSec: 0.5 }, mode: 'sum', corner: 'tr' });
const FELT = '#2e7a5a', FELT2 = '#277052', INK = '#22313a', ACC = '#2f8a66';
const DK = { a: '#4d4a58', b: '#16141b' }, LT = { a: '#ffffff', b: '#d9d3c4' };

let bd = initial(), legal = [], last = -1, flips = new Map(), placed = null, geo = { x: 0, y: 0, s: 40 }, hover = -1;

const P = duel({
  B, key: 'duskflip', name: 'Duskflip: Reversi vs Computer', brand: 'Duskflip', short: 'Reversi', kicker: 'reversi vs computer',
  hint: 'Tap a dot to place a disc and flip the lines it traps.',
  accent: ACC, bg: ['#f1f4ea', '#d6e2ea'], ink: INK,
  youAv: `radial-gradient(circle at 35% 30%,${DK.a},${DK.b})`, cpuAv: `radial-gradient(circle at 35% 30%,${LT.a},${LT.b})`,
  worker: new URL('./ai-worker.js', import.meta.url),
  think, debug: () => ({ geo }),
  newGame() { bd = initial(); legal = moves(bd, 1); last = -1; flips = new Map(); placed = null; },
  layout(a) {
    const r = P.fit(a, 1), pad = Math.round(r.w * 0.03), s = Math.floor((r.w - pad * 2) / 8);
    geo = { s, x: r.x + Math.round((r.w - s * 8) / 2), y: r.y + Math.round((r.h - s * 8) / 2) };
    return r;
  },
  restore(sn) { bd = sn.bd.slice(); last = sn.last; legal = moves(bd, 1); flips = new Map(); placed = null; P.hud(); },
  extra(i) { const n = count(bd, i === 0 ? 1 : -1), c = i === 0 ? DK : LT; return `<span class="du-pill" style="font-size:17px;padding:3px 12px"><i style="display:inline-block;width:14px;height:14px;border-radius:50%;vertical-align:-1px;margin-right:6px;box-shadow:0 0 0 1px rgba(0,0,0,.15);background:radial-gradient(circle at 35% 30%,${c.a},${c.b})"></i>${n}</span>`; },
  youLine: () => 'Dark · moves first',
  statusText: (t) => t === 0 ? `Your move · ${legal.length} option${legal.length === 1 ? '' : 's'}` : t === 1 ? 'CPU is thinking' : '',
  down, hover: (x, y) => { hover = cell(x, y); }, draw,
  bot() { if (placed) return; const m = search(bd, 1, { depth: 3, ms: 45 }); if (m) place(m); },
});

const cell = (x, y) => { const c = Math.floor((x - geo.x) / geo.s), r = Math.floor((y - geo.y) / geo.s); return c < 0 || r < 0 || c > 7 || r > 7 ? -1 : r * 8 + c; };
const center = (i) => [geo.x + ((i & 7) + 0.5) * geo.s, geo.y + ((i >> 3) + 0.5) * geo.s];

function down(x, y) {
  if (placed) return;
  const c = cell(x, y); if (c < 0) return;
  const m = legal.find(m => m.i === c);
  if (m) place(m); else if (!bd[c]) { soft.err(); P.ui.pop('That traps nothing', '#fff', 22, P.popY()); }
}
function place(m) { P.push({ bd: bd.slice(), last }); play(m, 1, () => next(-1)); }
function play(m, side, done) {
  const now = performance.now(), [px, py] = center(m.i);
  placed = { i: m.i, side, at: now };
  flips = new Map(m.flips.map(f => { const [fx, fy] = center(f); return [f, { at: now + P.dur(120) + Math.hypot(fx - px, fy - py) / geo.s * P.dur(70), from: -side }]; }));
  bd = apply(bd, m, side); last = m.i; P.busy = true;
  soft.wood(); buzz(8);
  const span = Math.max(0, ...[...flips.values()].map(f => f.at - now)) + P.dur(260);
  [...flips.values()].sort((a, b) => a.at - b.at).forEach((f, k) => setTimeout(() => tone(700 + k * 45, 0.04, 'triangle', 0.05, 1.1), f.at - now));
  if (m.flips.length >= 5) setTimeout(() => { P.ui.pop(`${m.flips.length} flipped!`, side > 0 ? '#2f8a66' : INK, 28, P.popY()); P.fx.sparks(px, py, side > 0 ? ['#4d4a58', '#fff', '#ffd36e'] : ['#fff', '#cfe9dc'], 14, { speed: 3 }); }, P.dur(200));
  if ([0, 7, 56, 63].includes(m.i)) setTimeout(() => chime(4, 74, 0.1), 120);
  setTimeout(() => { placed = null; P.busy = false; P.hud(); done(); }, span);
}
function next(side) {
  legal = moves(bd, side);
  const other = moves(bd, -side);
  if (!legal.length && !other.length) return finish();
  if (side < 0) {
    if (!legal.length) { P.ui.pop('CPU passes', INK, 26, P.popY()); legal = other; P.setTurn(0); return; }
    cpuTurn();
  } else {
    if (!legal.length) { P.ui.pop('No move: you pass', INK, 26, P.popY()); P.setTurn(1); setTimeout(() => next(-1), P.dur(900)); return; }
    P.setTurn(0);
  }
}
async function cpuTurn() {
  const m = await P.think({ b: bd, side: -1, diff: P.diff, seed: (P.seed + count(bd, 0) * 977) >>> 0, fk: P.F.k() });
  if (!m) return;
  const mm = legal.find(x => x.i === m.i) || legal[0];
  play(mm, -1, () => next(1));
}
function finish() {
  legal = [];
  const a = count(bd, 1), b = count(bd, -1), line = `${a} – ${b}`;
  if (a > b) P.end('win', a - b >= 20 ? 'Landslide!' : 'You win!', `${line} discs`);
  else if (b > a) P.end('loss', 'CPU wins', `${line} discs`);
  else P.end('draw', 'Dead even', `${line} discs: a draw`);
}

// ---------------------------------------------------------------- drawing
function disc(g, x, y, s, side, sx = 1, alpha = 1) {
  const r = s * 0.4, C = side > 0 ? DK : LT;
  g.save(); g.globalAlpha = alpha;
  g.fillStyle = 'rgba(0,20,10,.35)'; g.beginPath(); g.ellipse(x, y + r * 0.18, r * Math.max(0.15, sx), r * 0.98, 0, 0, 7); g.fill();
  g.fillStyle = side > 0 ? '#0c0b10' : '#b9b2a2'; g.beginPath(); g.ellipse(x, y + r * 0.07, r * Math.max(0.06, sx), r, 0, 0, 7); g.fill();
  const gr = g.createRadialGradient(x - r * 0.35 * sx, y - r * 0.4, r * 0.1, x, y, r * 1.05); gr.addColorStop(0, C.a); gr.addColorStop(1, C.b);
  g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r * Math.max(0.06, sx), r, 0, 0, 7); g.fill();
  g.restore();
}
function draw(g, now) {
  const { x: X, y: Y, s } = geo, N = s * 8;
  g.save(); g.shadowColor = 'rgba(20,50,40,.3)'; g.shadowBlur = 28; g.shadowOffsetY = 12;
  rrect(g, X - s * 0.2, Y - s * 0.2, N + s * 0.4, N + s * 0.4, 18); g.fillStyle = '#1d4637'; g.fill(); g.restore();
  g.save(); rrect(g, X, Y, N, N, 6); g.clip();
  const gr = g.createRadialGradient(X + N / 2, Y + N * 0.35, N * 0.1, X + N / 2, Y + N / 2, N * 0.8); gr.addColorStop(0, '#379068'); gr.addColorStop(1, FELT2);
  g.fillStyle = gr; g.fillRect(X, Y, N, N);
  if (last >= 0 && P.state !== 'ready') { const [cx, cy] = center(last); g.fillStyle = 'rgba(255,240,170,.16)'; g.fillRect(cx - s / 2, cy - s / 2, s, s); }
  g.strokeStyle = 'rgba(10,40,28,.55)'; g.lineWidth = 1.5;
  for (let k = 1; k < 8; k++) { g.beginPath(); g.moveTo(X + k * s, Y); g.lineTo(X + k * s, Y + N); g.moveTo(X, Y + k * s); g.lineTo(X + N, Y + k * s); g.stroke(); }
  g.fillStyle = 'rgba(10,40,28,.7)'; for (const [a, b] of [[2, 2], [6, 2], [2, 6], [6, 6]]) { g.beginPath(); g.arc(X + a * s, Y + b * s, Math.max(2.5, s * 0.06), 0, 7); g.fill(); }
  g.restore();
  // discs
  for (let i = 0; i < 64; i++) {
    const v = bd[i]; if (!v) continue;
    const [cx, cy] = center(i);
    if (placed && placed.i === i) { const k = ease.back((now - placed.at) / P.dur(240)); disc(g, cx, cy - (1 - Math.min(1, k)) * s * 0.3, s * (0.7 + 0.3 * k), v); continue; }
    const f = flips.get(i);
    if (f && now < f.at + P.dur(260)) {
      const k = Math.max(0, (now - f.at) / P.dur(260)), sx = Math.abs(Math.cos(k * Math.PI)), lift = Math.sin(k * Math.PI) * s * 0.12;
      disc(g, cx, cy - lift, s * (1 + Math.sin(k * Math.PI) * 0.08), k < 0.5 ? f.from : v, sx); continue;
    }
    disc(g, cx, cy, s, v);
  }
  if (last >= 0 && !placed && P.state !== 'ready') { const [cx, cy] = center(last); g.fillStyle = '#ff6b5a'; g.beginPath(); g.arc(cx, cy, Math.max(3, s * 0.07), 0, 7); g.fill(); }
  // legal moves
  if (P.state === 'play' && P.turn === 0 && !placed) for (const m of legal) {
    const [cx, cy] = center(m.i), h = hover === m.i;
    if (h) disc(g, cx, cy, s, 1, 1, 0.45);
    else { g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.arc(cx, cy, s * 0.15, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 1.5; g.stroke(); }
  }
  void note; void DIFFS;
}

P.start();
