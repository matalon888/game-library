// Kingmoat — classic chess against a fair computer (Easy / Normal / Hard). You play White. Full rules: castling,
// en passant, promotion (you choose the piece), check, checkmate, stalemate, 50-move rule, threefold repetition,
// insufficient material. The CPU thinks in a Web Worker so the board never freezes. Undo on Easy.
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { duel, DIFFS, rrect, ease, soft, tone, chime, buzz } from './duel.js';
import { Pos, think, search, PAWN, QUEEN, KING, fileOf, rankOf, sq } from './engine.js';
import { drawPiece, pieceSvg } from './pieces.js';

const B = board({ game: 'kingmoat', label: 'Wins vs CPU', limits: { maxRun: 2, maxPerSec: 0.5 }, mode: 'sum', corner: 'tr' });
const LIGHT = '#efe5cf', DARK = '#8fa77f', INK = '#2f3a2c', ACC = '#3f7d5c';

let pos = new Pos(), legal = [], sel = -1, last = null, seen = new Map(), anim = null, drag = null, pending = -1, promo = null, capW = [], capB = [], flash = null;
let geo = { x: 0, y: 0, s: 40, fx: 0, fy: 0, fw: 0 };
const VAL = [0, 1, 3, 3, 5, 9, 0];

const P = duel({
  B, key: 'kingmoat', name: 'Kingmoat: Chess vs Computer', brand: 'Kingmoat', short: 'Chess', kicker: 'chess vs computer',
  hint: 'Tap a piece, then a dot. You play White.',
  accent: ACC, bg: ['#f7f1e3', '#dfe8d6'], ink: INK,
  youAv: 'radial-gradient(circle at 35% 30%,#fffefa,#ddd1bd)', cpuAv: 'radial-gradient(circle at 35% 30%,#6c6280,#272030)',
  worker: new URL('./ai-worker.js', import.meta.url),
  think,
  newGame() { lastSan = ''; pos = new Pos(); afterSet(); last = null; seen = new Map([[pos.key(), 1]]); capW = []; capB = []; anim = null; drag = null; promo = null; pending = -1; flash = null; },
  layout(a) {
    const r = P.fit(a, 1), pad = Math.round(r.w * 0.03), s = Math.floor((r.w - pad * 2) / 8);
    geo = { s, x: r.x + Math.round((r.w - s * 8) / 2), y: r.y + Math.round((r.h - s * 8) / 2), fx: r.x, fy: r.y, fw: r.w };
    return r;
  },
  restore(sn) { lastSan = sn.san; pos = new Pos(sn.fen); seen = new Map(sn.seen); last = sn.last; capW = sn.capW.slice(); capB = sn.capB.slice(); afterSet(); anim = null; promo = null; P.hud(); },
  extra(i) {
    const caps = i === 0 ? capW : capB, mine = matOf(caps) - matOf(i === 0 ? capB : capW);
    return `<span class="du-pill" style="display:${caps.length ? 'inline-flex' : 'none'};align-items:center;gap:0;padding:2px 8px">${caps.slice().sort((a, b) => b - a).map(t => pieceSvg(t, i === 1, 17)).join('')}${mine > 0 ? `<b style="margin-left:6px;font-size:13px">+${mine}</b>` : ''}</span>`;
  },
  youLine: () => 'White',
  statusText: (t) => t === 0 ? (lastSan && pos.full > 1 ? `CPU played <b>${lastSan}</b> · your move` : 'Your move') : t === 1 ? `You played <b>${lastSan}</b>` : '',
  down, move, up, cancelDrag: () => { drag = null; },
  draw,
  bot() {
    if (anim || promo) return;
    const m = search(pos, { depth: 3, ms: 90, avoid: seen });
    if (m) playerMove(m.f, m.t, m.p || QUEEN);
  },
  debug: () => ({ fen: pos.fen(), geo }),
});
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): in your first game, until the first
// touch, the king's pawn lights up with its dots and steps to e4 (the classic opening); the computer then answers as usual
demo(n => {
  const f = sq(4, 1), t = sq(4, 3); if (!legal.some(m => m.f === f && m.t === t)) return false;
  if (n === 1) { sel = f; soft.click(); return; }
  if (sel !== f) return false; playerMove(f, t); return false;
}, { ready: () => P.state === 'play' && P.turn === 0 && pos.full === 1 && !anim && !promo && !P.busy && window.__game && window.__game.level === 1, wait: 1800, every: 1200, max: 2, ms: 15000 });
const matOf = (arr) => arr.reduce((a, t) => a + VAL[t], 0);
function afterSet() { legal = pos.legal(); sel = -1; }

// ---------------------------------------------------------------- input
const sqAt = (x, y) => { const c = Math.floor((x - geo.x) / geo.s), r = Math.floor((y - geo.y) / geo.s); return c < 0 || r < 0 || c > 7 || r > 7 ? -1 : sq(c, 7 - r); };
const center = (s) => [geo.x + (fileOf(s) + 0.5) * geo.s, geo.y + (7 - rankOf(s) + 0.5) * geo.s];
const dests = (f) => legal.filter(m => m.f === f);
function down(x, y) {
  if (anim) return;
  if (promo) { pickPromo(x, y); return; }
  const s = sqAt(x, y); if (s < 0) { sel = -1; return; }
  if (sel >= 0 && dests(sel).some(m => m.t === s)) { pending = s; return; }
  if (pos.b[s] > 0) { const was = sel === s; sel = s; drag = { s, x, y, sx: x, sy: y, moved: false, was }; if (!was) soft.click(); }
  else sel = -1;
}
function move(x, y) { if (!drag) return; drag.x = x; drag.y = y; if (Math.hypot(x - drag.sx, y - drag.sy) > 7) drag.moved = true; }
function up(x, y) {
  const s = sqAt(x, y);
  if (pending >= 0) { const t = pending; pending = -1; if (s === t) tryMove(sel, t); return; }
  if (!drag) return; const d = drag; drag = null;
  if (d.moved) { if (s >= 0 && s !== d.s && dests(d.s).some(m => m.t === s)) tryMove(d.s, s, true); else if (s !== d.s && s >= 0) soft.err(); }
  else if (d.was) sel = -1;
}
function tryMove(f, t, dropped = false) {
  const ms = legal.filter(m => m.f === f && m.t === t); if (!ms.length) return;
  if (ms.length > 1) { promo = { f, t, opts: [5, 2, 4, 3] }; sel = -1; tone(880, 0.08, 'sine', 0.08, 1.2); return; }
  playerMove(f, t, 0, dropped);
}
function pickPromo(x, y) {
  const [cx] = center(promo.t), s = geo.s, c = Math.floor((y - geo.y) / s);
  if (Math.abs(x - cx) < s / 2 && c >= 0 && c < 4) { const p = promo.opts[c]; const { f, t } = promo; promo = null; playerMove(f, t, p); }
  else { promo = null; soft.swish(); }
}

// ---------------------------------------------------------------- moves
function playerMove(f, t, p = 0, dropped = false) {
  const m = legal.find(x => x.f === f && x.t === t && (!x.p || x.p === (p || QUEEN))); if (!m) return;
  P.push({ san: lastSan, fen: pos.fen(), seen: [...seen], last, capW: capW.slice(), capB: capB.slice() });
  doMove(m, dropped, () => { if (!checkEnd()) cpuTurn(); });
}
async function cpuTurn() {
  const avoid = [...seen].filter(([, n]) => n >= 1);
  const m = await P.think({ fen: pos.fen(), diff: P.diff, seed: (P.seed + pos.full * 31) >>> 0, fk: P.F.k(), avoid });
  if (!m) return;
  const mm = legal.find(x => x.f === m.f && x.t === m.t && x.p === m.p) || legal[0];
  doMove(mm, false, () => { if (!checkEnd()) P.setTurn(0); });
}
const SQN = (q) => 'abcdefgh'[fileOf(q)] + (rankOf(q) + 1);
function san(m) {
  if (m.fl & 2) return m.t > m.f ? 'O-O' : 'O-O-O';
  const a = Math.abs(pos.b[m.f]), cap = pos.b[m.t] || (m.fl & 1);
  let s = '';
  if (a === PAWN) s = (cap ? 'abcdefgh'[fileOf(m.f)] + 'x' : '') + SQN(m.t) + (m.p ? '=' + ' PNBRQK'[m.p] : '');
  else {
    const twins = legal.filter(x => x.t === m.t && x.f !== m.f && Math.abs(pos.b[x.f]) === a);
    let dis = ''; if (twins.length) dis = twins.some(x => fileOf(x.f) === fileOf(m.f)) ? (twins.some(x => rankOf(x.f) === rankOf(m.f)) ? SQN(m.f) : String(rankOf(m.f) + 1)) : 'abcdefgh'[fileOf(m.f)];
    s = ' PNBRQK'[a] + dis + (cap ? 'x' : '') + SQN(m.t);
  }
  return s;
}
let lastSan = '';
function doMove(m, dropped, done) {
  const mover = pos.b[m.f], white = mover > 0, captured = m.fl & 1 ? PAWN : Math.abs(pos.b[m.t]);
  let mv = san(m);
  const u = pos.make(m); afterSet();
  if (pos.inCheck()) mv += legal.length ? '+' : '#';
  lastSan = mv;
  if (captured) (white ? capW : capB).push(captured);
  last = { f: m.f, t: m.t };
  const k = pos.key(); seen.set(k, (seen.get(k) || 0) + 1);
  const dur = dropped ? P.dur(90) : P.dur(230);
  anim = { type: m.p ? m.p : Math.abs(mover), white, f: m.f, t: m.t, start: performance.now(), dur, cap: captured, capSq: u.capSq, capType: captured, rook: m.fl & 2 ? (m.t > m.f ? [m.f + 3, m.f + 1] : [m.f - 4, m.f - 1]) : null };
  P.busy = true;
  setTimeout(() => {
    anim = null; P.busy = false;
    const [x, y] = center(m.t);
    if (captured) { tone(170, 0.12, 'triangle', 0.14, 0.6); tone(520, 0.05, 'square', 0.04, 0.6); P.fx.sparks(x, y, white ? ['#fff', '#ffd36e', DARK] : ['#3b3247', '#ff8f7a', '#fff'], 12, { speed: 3 }); buzz(14); }
    else soft.wood();
    if (m.fl & 2) chime(2, 72, 0.08);
    if (pos.inCheck() && legal.length) { flash = { s: pos.k[pos.side], at: performance.now() }; chime(4, 76, 0.1); P.ui.pop(pos.side > 0 ? 'Check!' : 'Check', pos.side > 0 ? '#c4423a' : ACC, 30, popY()); }
    P.hud(); done();
  }, dur);
}
const popY = () => P.popY();
function checkEnd() {
  if (!legal.length) {
    if (pos.inCheck()) { if (pos.side < 0) P.end('win', 'Checkmate!', `${pos.full} moves`); else P.end('loss', 'Checkmated', `The ${DIFFS[P.diff]} CPU got you in ${pos.full} moves`); }
    else P.end('draw', 'Stalemate', 'No legal moves, no check: a draw');
    return true;
  }
  if (pos.half >= 100) { P.end('draw', 'Draw', '50 moves without a capture or pawn move'); return true; }
  if (pos.insufficient()) { P.end('draw', 'Draw', 'Not enough pieces left to checkmate'); return true; }
  if ((seen.get(pos.key()) || 0) >= 3) { P.end('draw', 'Draw', 'The same position three times'); return true; }
  return false;
}

// ---------------------------------------------------------------- drawing
function draw(g, now) {
  const { x: X, y: Y, s } = geo, N = s * 8;
  // frame
  g.save(); g.shadowColor = 'rgba(40,50,30,.22)'; g.shadowBlur = 28; g.shadowOffsetY = 12;
  rrect(g, X - s * 0.18, Y - s * 0.18, N + s * 0.36, N + s * 0.36, 16); g.fillStyle = '#4b5a45'; g.fill(); g.restore();
  rrect(g, X - s * 0.18, Y - s * 0.18, N + s * 0.36, N + s * 0.36, 16); g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1.5; g.stroke();
  g.save(); rrect(g, X, Y, N, N, 6); g.clip();
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { g.fillStyle = (r + c) & 1 ? DARK : LIGHT; g.fillRect(X + c * s, Y + r * s, s, s); }
  const tint = (q, col) => { const [cx, cy] = center(q); g.fillStyle = col; g.fillRect(cx - s / 2, cy - s / 2, s, s); };
  if (last) { tint(last.f, 'rgba(255,214,90,.42)'); tint(last.t, 'rgba(255,214,90,.55)'); }
  if (sel >= 0) tint(sel, 'rgba(255,196,60,.7)');
  // king in check
  if (pos.inCheck() && P.state !== 'ready') {
    const [cx, cy] = center(pos.k[pos.side]); const gr = g.createRadialGradient(cx, cy, 2, cx, cy, s * 0.7);
    gr.addColorStop(0, 'rgba(235,60,50,.95)'); gr.addColorStop(0.55, 'rgba(235,60,50,.45)'); gr.addColorStop(1, 'rgba(235,60,50,0)'); g.fillStyle = gr; g.fillRect(cx - s / 2, cy - s / 2, s, s);
  }
  // coordinates
  g.font = `700 ${Math.max(9, Math.round(s * 0.2))}px -apple-system,system-ui,sans-serif`; g.textBaseline = 'top';
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i & 1 ? DARK : LIGHT; g.textAlign = 'left'; g.fillText(String(8 - i), X + 3, Y + i * s + 3);
    g.fillStyle = i & 1 ? LIGHT : DARK; g.textAlign = 'right'; g.textBaseline = 'bottom'; g.fillText('abcdefgh'[i], X + (i + 1) * s - 3, Y + N - 2); g.textBaseline = 'top';
  }
  g.restore();
  // drag target outline
  if (drag && drag.moved) { const t = sqAt(drag.x, drag.y); if (t >= 0 && dests(drag.s).some(m => m.t === t)) { const [cx, cy] = center(t); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 3; g.strokeRect(cx - s / 2 + 1.5, cy - s / 2 + 1.5, s - 3, s - 3); } }
  // pieces
  const hide = new Set(); if (anim) { hide.add(anim.t); if (anim.rook) hide.add(anim.rook[1]); } if (drag && drag.moved) hide.add(drag.s);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const q = sq(c, r), v = pos.b[q]; if (!v || hide.has(q)) continue;
    const [cx, cy] = center(q);
    let lift = 0; if (P.state === 'won' && v < 0 && Math.abs(v) === KING) lift = 0;
    drawPiece(g, Math.abs(v), v > 0, cx, cy, s * 0.9, { lift, alpha: sel === q ? 1 : 1 });
  }
  // legal-move dots
  if (sel >= 0 && P.turn === 0 && !anim) for (const m of dests(sel)) {
    const [cx, cy] = center(m.t);
    if (pos.b[m.t] || m.fl & 1) { g.strokeStyle = 'rgba(40,55,35,.32)'; g.lineWidth = s * 0.085; g.beginPath(); g.arc(cx, cy, s * 0.43, 0, 7); g.stroke(); }
    else { g.fillStyle = 'rgba(40,55,35,.28)'; g.beginPath(); g.arc(cx, cy, s * 0.15, 0, 7); g.fill(); }
  }
  // moving piece (+ castling rook, + captured piece fading out)
  if (anim) {
    const k = ease.inout((now - anim.start) / anim.dur), [ax, ay] = center(anim.f), [bx, by] = center(anim.t);
    if (anim.cap) { const [qx, qy] = center(anim.capSq); drawPiece(g, anim.capType, !anim.white, qx, qy, s * 0.9 * (1 - k * 0.3), { alpha: 1 - k }); }
    if (anim.rook) { const [rx, ry] = center(anim.rook[0]), [tx, ty] = center(anim.rook[1]); drawPiece(g, 4, anim.white, rx + (tx - rx) * k, ry + (ty - ry) * k, s * 0.9); }
    const arc = Math.sin(k * Math.PI) * s * 0.12;
    drawPiece(g, anim.type, anim.white, ax + (bx - ax) * k, ay + (by - ay) * k - arc, s * 0.9 * (1 + Math.sin(k * Math.PI) * 0.08));
  }
  if (drag && drag.moved) { const v = pos.b[drag.s]; drawPiece(g, Math.abs(v), v > 0, drag.x, drag.y - s * 0.25, s * 1.1, { lift: 4 }); }
  // check pulse ring
  if (flash && now - flash.at < 700) { const [cx, cy] = center(flash.s), k = (now - flash.at) / 700; g.strokeStyle = `rgba(235,60,50,${1 - k})`; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, s * (0.45 + k * 0.5), 0, 7); g.stroke(); }
  // promotion picker
  if (promo) {
    const [cx] = center(promo.t); g.fillStyle = 'rgba(20,24,18,.35)'; g.fillRect(X, Y, N, N);
    g.save(); g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 18; rrect(g, cx - s / 2 - 3, Y - 3, s + 6, s * 4 + 6, 12); g.fillStyle = '#fffaf0'; g.fill(); g.restore();
    promo.opts.forEach((p, i) => { drawPiece(g, p, true, cx, Y + (i + 0.5) * s, s * 0.88, { shadow: false }); });
  }
}

P.start();
