// Stonerow — classic five-in-a-row (gomoku, freestyle) on a 15 × 15 grid against a fair computer (Easy / Normal / Hard).
// Pinch-free on a phone: tap a point to aim (a ghost stone with guide lines appears), tap it again to place;
// with a mouse a single click places. Five or more in a line wins and lights up. CPU thinks in a Web Worker. Undo on Easy.
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { duel, DIFFS, rrect, ease, soft, tone, chime, buzz } from './duel.js';
import { empty, lineAt, think, search, N } from './engine.js';

const B = board({ game: 'stonerow', label: 'Wins vs CPU', limits: { maxRun: 2, maxPerSec: 0.5 }, mode: 'sum', corner: 'tr' });
const INK = '#3a2c1c', ACC = '#b5762f';
const DK = { a: '#55505e', b: '#141218' }, LT = { a: '#ffffff', b: '#d8d1c2' };

let bd = empty(), aim = -1, last = -1, placed = null, winLine = null, winAt0 = 0, moveNo = 0, geo = { x: 0, y: 0, s: 20 }, ptype = 'touch', hover = -1;
addEventListener('pointerdown', (e) => { ptype = e.pointerType || 'touch'; }, true);

const P = duel({
  B, key: 'stonerow', name: 'Stonerow: Gomoku Five in a Row', brand: 'Stonerow', short: 'Gomoku', kicker: 'five in a row vs computer',
  hint: 'Tap a point, tap again to place. Five in a line wins.', botPace: 380,
  accent: ACC, bg: ['#fbf3e6', '#efdcc0'], ink: INK,
  youAv: `radial-gradient(circle at 35% 30%,${DK.a},${DK.b})`, cpuAv: `radial-gradient(circle at 35% 30%,${LT.a},${LT.b})`,
  worker: new URL('./ai-worker.js', import.meta.url),
  think, debug: () => ({ geo }),
  newGame() { bd = empty(); aim = -1; last = -1; placed = null; winLine = null; moveNo = 0; },
  layout(a) {
    const r = P.fit(a, 1), s = Math.floor(r.w / (N + 0.2));
    geo = { s, x: r.x + Math.round((r.w - s * (N - 1)) / 2), y: r.y + Math.round((r.h - s * (N - 1)) / 2) };
    return r;
  },
  restore(sn) { bd = sn.bd.slice(); last = sn.last; moveNo = sn.moveNo; aim = -1; placed = null; winLine = null; P.hud(); },
  youLine: () => 'Dark · plays first',
  statusText: (t) => t === 0 ? (aim >= 0 ? 'Tap the ghost stone again to place' : 'Your move: tap a point') : t === 1 ? 'CPU is thinking' : '',
  down, hover: (x, y) => { hover = ptype === 'mouse' ? pointAt(x, y) : -1; }, draw,
  bot() { if (placed) return; const i = search(bd, 1, { depth: 2, width: 10, ms: 60 }); if (i >= 0) place(i); },
});

const pointAt = (x, y) => { const c = Math.round((x - geo.x) / geo.s), r = Math.round((y - geo.y) / geo.s); return c < 0 || r < 0 || c >= N || r >= N ? -1 : r * N + c; };
const center = (i) => [geo.x + (i % N) * geo.s, geo.y + ((i / N) | 0) * geo.s];

function down(x, y) {
  if (placed) return;
  const i = pointAt(x, y); if (i < 0) { aim = -1; P.status('Your move: tap a point'); return; }
  if (bd[i]) { soft.err(); return; }
  if (ptype === 'mouse' || aim === i) { place(i); return; }
  aim = i; soft.click(); buzz(5); P.status('Tap the ghost stone again to place');
}
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): in your first game, until the first
// touch, a ghost stone appears on the best point, then is placed (tap, tap again) and the CPU answers; the next move is yours
let demoAt = -1;
demo((n) => {
  if (n === 1) { demoAt = search(bd, 1, { depth: 2, width: 10, ms: 60 }); if (demoAt < 0) return false; aim = demoAt; soft.click(); P.status('Tap the ghost stone again to place'); return; }
  if (aim === demoAt) place(demoAt); return false;
}, { ready: () => P.state === 'play' && P.turn === 0 && !P.busy && !placed && moveNo === 0 && !P.D.isDaily && (r => !r.w && !r.l && !r.d)(P.S.get('rec' + P.diff, { w: 0, l: 0, d: 0 })), wait: 1800, every: 900, max: 2 });
function place(i) { aim = -1; P.push({ bd: bd.slice(), last, moveNo }); put(i, 1, () => { if (!checkEnd(i, 1)) cpuTurn(); }); }
async function cpuTurn() {
  const i = await P.think({ b: bd, side: -1, diff: P.diff, seed: (P.seed + moveNo * 7919) >>> 0, fk: P.F.k() });
  if (i == null || i < 0) return;
  put(bd[i] ? bd.indexOf(0) : i, -1, () => { if (!checkEnd(i, -1)) P.setTurn(0); });
}
function put(i, side, done) {
  bd[i] = side; last = i; moveNo++; placed = { i, at: performance.now() }; P.busy = true;
  const d = P.dur(200);
  setTimeout(() => { placed = null; P.busy = false; tone(side > 0 ? 330 : 390, 0.06, 'triangle', 0.15, 0.7); tone(1300, 0.025, 'sine', 0.05, 0.6); buzz(8); done(); }, d);
}
function checkEnd(i, side) {
  const w = lineAt(bd, i);
  if (w) {
    winLine = w; winAt0 = performance.now();
    w.forEach((j, k) => setTimeout(() => { const [x, y] = center(j); P.fx.sparks(x, y, side > 0 ? ['#fff', '#ffd36e', DK.a] : ['#fff', '#ffe7b0', INK], 10, { speed: 2.8 }); chime(k + 2, 72, 0.1); }, P.dur(100) * k));
    if (side > 0) P.end('win', 'Five in a row!', `${Math.ceil(moveNo / 2)} stones`, 1000);
    else P.end('loss', 'CPU makes five', `The ${DIFFS[P.diff]} CPU found a line`, 1200);
    return true;
  }
  if (!bd.includes(0)) { P.end('draw', 'Board full', 'No five anywhere: a draw'); return true; }
  return false;
}

// ---------------------------------------------------------------- drawing
function stone(g, x, y, s, side, { alpha = 1, glow = 0, scale = 1 } = {}) {
  const C = side > 0 ? DK : LT, r = s * 0.46 * scale; g.save(); g.globalAlpha = alpha;
  g.fillStyle = 'rgba(60,35,10,.32)'; g.beginPath(); g.ellipse(x + r * 0.12, y + r * 0.2, r, r * 0.92, 0, 0, 7); g.fill();
  if (glow) { g.shadowColor = side > 0 ? '#ffd36e' : '#fff'; g.shadowBlur = 16 * glow; }
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.08, x, y, r); gr.addColorStop(0, C.a); gr.addColorStop(1, C.b);
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.restore();
}
function draw(g, now) {
  const { x: X, y: Y, s } = geo, L = s * (N - 1), m = s * 0.75;
  g.save(); g.shadowColor = 'rgba(90,55,20,.28)'; g.shadowBlur = 28; g.shadowOffsetY = 12;
  rrect(g, X - m, Y - m, L + m * 2, L + m * 2, 14);
  const wood = g.createLinearGradient(X - m, Y - m, X + L + m, Y + L + m); wood.addColorStop(0, '#f0cf8e'); wood.addColorStop(0.5, '#e6bd73'); wood.addColorStop(1, '#d9a95c');
  g.fillStyle = wood; g.fill(); g.restore();
  // subtle grain
  g.save(); rrect(g, X - m, Y - m, L + m * 2, L + m * 2, 14); g.clip(); g.strokeStyle = 'rgba(150,95,30,.08)'; g.lineWidth = 2;
  for (let k = 0; k < 14; k++) { const yy = Y - m + (k + 0.5) * (L + m * 2) / 14; g.beginPath(); g.moveTo(X - m, yy); g.bezierCurveTo(X + L * 0.3, yy - 6, X + L * 0.6, yy + 6, X + L + m, yy - 2); g.stroke(); }
  g.restore();
  g.strokeStyle = 'rgba(70,40,10,.62)'; g.lineWidth = 1;
  for (let k = 0; k < N; k++) { g.beginPath(); g.moveTo(X, Y + k * s + 0.5); g.lineTo(X + L, Y + k * s + 0.5); g.moveTo(X + k * s + 0.5, Y); g.lineTo(X + k * s + 0.5, Y + L); g.stroke(); }
  g.lineWidth = 2; g.strokeRect(X, Y, L, L);
  g.fillStyle = 'rgba(70,40,10,.75)'; for (const [a, b] of [[3, 3], [11, 3], [7, 7], [3, 11], [11, 11]]) { g.beginPath(); g.arc(X + a * s, Y + b * s, Math.max(2.2, s * 0.12), 0, 7); g.fill(); }
  // aim guide
  const playing = P.state === 'play' && P.turn === 0 && !placed;
  const ghost = playing ? (aim >= 0 ? aim : hover >= 0 && !bd[hover] ? hover : -1) : -1;
  if (ghost >= 0) {
    const [cx, cy] = center(ghost); g.strokeStyle = 'rgba(181,90,30,.55)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(X, cy); g.lineTo(X + L, cy); g.moveTo(cx, Y); g.lineTo(cx, Y + L); g.stroke();
  }
  // stones
  for (let i = 0; i < N * N; i++) {
    const v = bd[i]; if (!v) continue; const [cx, cy] = center(i);
    let sc = 1; if (placed && placed.i === i) sc = 0.6 + 0.4 * ease.back((now - placed.at) / P.dur(200));
    stone(g, cx, cy, s, v, { scale: sc, glow: winLine && winLine.includes(i) ? 0.6 + 0.4 * Math.sin((now - winAt0) / 160) : 0 });
  }
  if (last >= 0 && P.state !== 'ready' && !winLine) { const [cx, cy] = center(last); g.fillStyle = '#ff5a4a'; g.beginPath(); g.arc(cx, cy, Math.max(2.5, s * 0.13), 0, 7); g.fill(); }
  if (ghost >= 0) {
    const [cx, cy] = center(ghost), pulse = aim >= 0 ? 0.55 + 0.15 * Math.sin(now / 150) : 0.45;
    stone(g, cx, cy, s, 1, { alpha: pulse, scale: aim >= 0 ? 1.15 : 1 });
    if (aim >= 0) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, s * 0.62, 0, 7); g.stroke(); }
  }
  if (winLine) {
    const [ax, ay] = center(winLine[0]), [bx, by] = center(winLine[winLine.length - 1]), k = Math.min(1, (now - winAt0) / 450);
    g.strokeStyle = 'rgba(255,90,74,.85)'; g.lineWidth = Math.max(3, s * 0.16); g.lineCap = 'round';
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax + (bx - ax) * k, ay + (by - ay) * k); g.stroke();
  }
}

P.start();
