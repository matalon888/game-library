// Dropline — the classic four-in-a-row drop game (7 × 6) against a fair computer (Easy / Normal / Hard).
// Tap a column: your disc falls and bounces into place behind the frame. Four in a row across, down or diagonally wins;
// the winning line lights up. A full board is a draw. CPU thinks in a Web Worker. Undo on Easy.
import { board } from './kit/board.js';
import { duel, DIFFS, rrect, ease, soft, tone, chime, buzz } from './duel.js';
import { empty, dropRow, winAt, legalCols, think, search, COLS, ROWS } from './engine.js';

const B = board({ game: 'dropline', label: 'Wins vs CPU', limits: { maxRun: 2, maxPerSec: 0.5 }, mode: 'sum', corner: 'tr' });
const INK = '#1f2d4d', ACC = '#2f6fe0', FRAME = '#2f6fe0';
const YOU = { a: '#ff8a96', b: '#e63a52', rim: '#b8233a' }, CPU = { a: '#ffe27a', b: '#f2b51c', rim: '#c48a06' };

let bd = empty(), drops = [], winLine = null, winAt0 = 0, hoverCol = -1, lastI = -1, geo = { x: 0, y: 0, s: 40, top: 0 };

const P = duel({
  B, key: 'dropline', name: 'Dropline: Four in a Row', brand: 'Dropline', short: 'Four in a row', kicker: 'four in a row vs computer',
  hint: 'Tap a column to drop a disc. Line up four to win.', botPace: 700,
  accent: ACC, bg: ['#eef5ff', '#d7e5fb'], ink: INK,
  youAv: `radial-gradient(circle at 35% 30%,${YOU.a},${YOU.b})`, cpuAv: `radial-gradient(circle at 35% 30%,${CPU.a},${CPU.b})`,
  worker: new URL('./ai-worker.js', import.meta.url),
  think, debug: () => ({ geo }),
  newGame() { bd = empty(); drops = []; winLine = null; lastI = -1; },
  layout(a) {
    const r = P.fit(a, COLS / (ROWS + 1)), s = Math.floor(Math.min(r.w / (COLS + 0.4), r.h / (ROWS + 1.3)));
    const w = s * COLS, h = s * ROWS;
    geo = { s, x: Math.round(r.x + (r.w - w) / 2), y: Math.round(r.y + r.h - h - s * 0.25), top: r.y };
    return r;
  },
  restore(sn) { bd = sn.bd.slice(); lastI = sn.lastI; drops = []; winLine = null; P.hud(); },
  youLine: () => 'Red · drops first',
  statusText: (t) => t === 0 ? 'Your move: tap a column' : t === 1 ? 'CPU is thinking' : '',
  down: (x, y) => { const c = colAt(x); if (c >= 0) hoverCol = c; },
  move: (x, y) => { hoverCol = colAt(x); },
  up: (x, y) => { const c = colAt(x); hoverCol = -1; if (c >= 0) tryDrop(c); },
  hover: (x, y) => { hoverCol = P.turn === 0 ? colAt(x) : -1; },
  draw,
  bot() { if (drops.some(d => !d.done)) return; const c = search(bd, 1, { depth: 6, ms: 40 }); if (c >= 0) tryDrop(c); },
});

const colAt = (x) => { const c = Math.floor((x - geo.x) / geo.s); return c < 0 || c >= COLS ? -1 : c; };
const center = (i) => [geo.x + ((i % COLS) + 0.5) * geo.s, geo.y + (Math.floor(i / COLS) + 0.5) * geo.s];

function tryDrop(c) {
  const r = dropRow(bd, c); if (r < 0) { soft.err(); P.ui.pop('Column full', '#fff', 22, P.popY()); return; }
  P.push({ bd: bd.slice(), lastI });
  drop(c, 1, () => { if (!checkEnd(1)) cpuTurn(); });
}
async function cpuTurn() {
  const c = await P.think({ b: bd, side: -1, diff: P.diff, seed: (P.seed + bd.reduce((a, v, i) => a + (v + 2) * i, 0)) >>> 0, fk: P.F.k() });
  if (c == null || c < 0) return;
  drop(dropRow(bd, c) >= 0 ? c : legalCols(bd)[0], -1, () => { if (!checkEnd(-1)) P.setTurn(0); });
}
function drop(c, side, done) {
  const r = dropRow(bd, c), i = r * COLS + c; bd[i] = side; lastI = i;
  const d = { i, side, start: performance.now(), dur: P.dur(180 + r * 55), done: false }; drops.push(d); P.busy = true;
  tone(500 - r * 20, 0.05, 'sine', 0.06, 0.7);
  setTimeout(() => {
    d.done = true; P.busy = false;
    tone(150 + r * 15, 0.09, 'triangle', 0.16, 0.6); tone(900, 0.03, 'square', 0.03, 0.5); buzz(10);
    done();
  }, d.dur);
}
function checkEnd(side) {
  const w = winAt(bd, lastI);
  if (w) {
    winLine = w; winAt0 = performance.now();
    w.forEach((j, k) => setTimeout(() => { const [x, y] = center(j); P.fx.sparks(x, y, side > 0 ? ['#fff', YOU.a, '#ffd36e'] : ['#fff', CPU.a, INK], 12, { speed: 3.2 }); chime(k + 2, 72, 0.1); }, P.dur(110) * k));
    if (side > 0) P.end('win', 'Four in a row!', `${Math.ceil(bd.filter(v => v).length / 2)} discs`, 900);
    else P.end('loss', 'CPU connects four', `The ${DIFFS[P.diff]} CPU found a line`, 1100);
    return true;
  }
  if (!legalCols(bd).length) { P.end('draw', 'Full board', 'Nobody lined up four: a draw'); return true; }
  return false;
}

// ---------------------------------------------------------------- drawing
function disc(g, x, y, s, side, { alpha = 1, glow = 0 } = {}) {
  const C = side > 0 ? YOU : CPU, r = s * 0.4; g.save(); g.globalAlpha = alpha;
  if (glow) { g.shadowColor = '#fff'; g.shadowBlur = 18 * glow; }
  g.fillStyle = C.rim; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.shadowBlur = 0;
  const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r); gr.addColorStop(0, C.a); gr.addColorStop(1, C.b);
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 0.88, 0, 7); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = Math.max(1, s * 0.03); g.beginPath(); g.arc(x, y, r * 0.6, 0, 7); g.stroke();
  g.restore();
}
function draw(g, now) {
  const { x: X, y: Y, s } = geo, w = s * COLS, h = s * ROWS, pad = s * 0.18;
  // back panel (darker, seen through the holes)
  rrect(g, X - pad, Y - pad, w + pad * 2, h + pad * 2, s * 0.35); g.fillStyle = '#c9daf6'; g.fill();
  // column hover
  const playing = P.state === 'play' && P.turn === 0 && !P.busy;
  if (playing && hoverCol >= 0) { g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(X + hoverCol * s + s * 0.08, Y - pad, s * 0.84, h + pad); }
  // discs (behind the frame)
  for (let i = 0; i < COLS * ROWS; i++) {
    const v = bd[i]; if (!v) continue;
    const [cx, cy] = center(i), d = drops.find(q => q.i === i && !q.fin);
    let y = cy;
    if (d) {
      const k = Math.min(1, (now - d.start) / d.dur), startY = Y - s * 0.75;
      if (k < 1) y = startY + (cy - startY) * k * k;
      else { const t = (now - d.start - d.dur) / P.dur(220); if (t < 1) y = cy - Math.abs(Math.sin(t * Math.PI)) * s * 0.12 * (1 - t); else d.fin = true; }
    }
    const inWin = winLine && winLine.includes(i);
    disc(g, cx, y, s, v, { glow: inWin ? 0.6 + 0.4 * Math.sin((now - winAt0) / 160) : 0 });
  }
  // frame with holes (even-odd)
  g.save(); g.shadowColor = 'rgba(20,40,90,.3)'; g.shadowBlur = 24; g.shadowOffsetY = 10;
  g.beginPath(); const fx = X - pad, fy = Y - pad, fw = w + pad * 2, fh = h + pad * 2, fr = s * 0.35;
  g.moveTo(fx + fr, fy); g.arcTo(fx + fw, fy, fx + fw, fy + fh, fr); g.arcTo(fx + fw, fy + fh, fx, fy + fh, fr); g.arcTo(fx, fy + fh, fx, fy, fr); g.arcTo(fx, fy, fx + fw, fy, fr); g.closePath();
  for (let i = 0; i < COLS * ROWS; i++) { const [cx, cy] = center(i); g.moveTo(cx + s * 0.4, cy); g.arc(cx, cy, s * 0.4, 0, Math.PI * 2, true); }
  const fg = g.createLinearGradient(0, fy, 0, fy + fh); fg.addColorStop(0, '#4a86f0'); fg.addColorStop(1, '#2559c4');
  g.fillStyle = fg; g.fill('evenodd'); g.restore();
  // hole rims
  g.strokeStyle = 'rgba(10,30,90,.35)'; g.lineWidth = Math.max(1.5, s * 0.045);
  for (let i = 0; i < COLS * ROWS; i++) { const [cx, cy] = center(i); g.beginPath(); g.arc(cx, cy, s * 0.4, Math.PI * 0.15, Math.PI * 1.1); g.stroke(); }
  g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = Math.max(1, s * 0.03);
  for (let i = 0; i < COLS * ROWS; i++) { const [cx, cy] = center(i); g.beginPath(); g.arc(cx, cy, s * 0.4, Math.PI * 1.15, Math.PI * 2.1); g.stroke(); }
  // winning line stroke
  if (winLine) {
    const [ax, ay] = center(winLine[0]), [bx, by] = center(winLine[3]), k = Math.min(1, (now - winAt0) / 450);
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = s * 0.14; g.lineCap = 'round';
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax + (bx - ax) * k, ay + (by - ay) * k); g.stroke();
  }
  // ghost disc above the hovered column
  if (playing) {
    const c = hoverCol >= 0 ? hoverCol : -1;
    if (c >= 0 && dropRow(bd, c) >= 0) { const bob = Math.sin(now / 200) * s * 0.05; disc(g, X + (c + 0.5) * s, Y - s * 0.75 + bob, s * 0.9, 1, { alpha: 0.9 }); }
    else if (c < 0) { // gentle arrows over the open columns
      g.fillStyle = 'rgba(47,111,224,.35)';
      for (const cc of legalCols(bd)) { const ax = X + (cc + 0.5) * s, ay = Y - s * 0.55 + Math.sin(now / 300 + cc) * s * 0.04; g.beginPath(); g.moveTo(ax - s * 0.12, ay - s * 0.08); g.lineTo(ax + s * 0.12, ay - s * 0.08); g.lineTo(ax, ay + s * 0.08); g.closePath(); g.fill(); }
    }
  }
}

P.start();
