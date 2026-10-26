// Crownhop — classic American checkers (8×8 draughts) against a fair computer (Easy / Normal / Hard).
// Captures are forced, multi-jumps are finished hop by hop, men reaching the far row are crowned kings.
// The CPU thinks in a Web Worker so the board never freezes. Undo on Easy.
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { duel, DIFFS, rrect, ease, soft, tone, chime, buzz } from './duel.js';
import { initial, moves, apply, think, search, dark } from './engine.js';

const B = board({ game: 'crownhop', label: 'Wins vs CPU', limits: { maxRun: 2, maxPerSec: 0.5 }, mode: 'sum', corner: 'tr' });
const LIGHT = '#f6e8cf', DARKSQ = '#b8694f', INK = '#3e2a24', ACC = '#d2553f';
const RED = { a: '#ff8a6e', b: '#d8432f', rim: '#a8301f', line: '#ffd2c4' }, BLK = { a: '#5d5668', b: '#2b2632', rim: '#17141b', line: '#8d859a' };

let bd = initial(), legal = [], sel = -1, partial = null, last = null, anim = null, quiet = 0, lost = [0, 0], geo = { x: 0, y: 0, s: 40 }, mustFlash = 0;

const P = duel({
  B, key: 'crownhop', name: 'Crownhop: Checkers vs Computer', brand: 'Crownhop', short: 'Checkers', kicker: 'checkers vs computer',
  hint: 'Tap a piece, then a dot. Jumps are a must.',
  accent: ACC, bg: ['#fbf1e4', '#f1d9cf'], ink: INK,
  youAv: `radial-gradient(circle at 35% 30%,${RED.a},${RED.b})`, cpuAv: `radial-gradient(circle at 35% 30%,${BLK.a},${BLK.b})`,
  worker: new URL('./ai-worker.js', import.meta.url),
  think, debug: () => ({ geo }),
  newGame() { bd = initial(); legal = moves(bd, 1); sel = -1; partial = null; last = null; anim = null; quiet = 0; lost = [0, 0]; },
  layout(a) {
    const r = P.fit(a, 1), pad = Math.round(r.w * 0.03), s = Math.floor((r.w - pad * 2) / 8);
    geo = { s, x: r.x + Math.round((r.w - s * 8) / 2), y: r.y + Math.round((r.h - s * 8) / 2) };
    return r;
  },
  restore(sn) { bd = sn.bd.slice(); quiet = sn.quiet; lost = sn.lost.slice(); last = sn.last; legal = moves(bd, 1); sel = -1; partial = null; anim = null; P.hud(); },
  extra(i) { const n = lost[1 - i]; return n ? `<span class="du-pill">${disc(i === 0 ? BLK : RED)} × ${n}</span>` : ''; },
  youLine: () => 'Red · moves first',
  statusText: (t) => t === 0 ? (legal.length && legal[0].caps.length ? 'You must jump' : 'Your move') : t === 1 ? 'CPU is thinking' : '',
  down, draw,
  bot() {
    if (anim) return;
    if (partial) { const m = legal.find(x => prefix(x)); if (m) return hop(m.path[partial.length]); }
    const m = search(bd, 1, { depth: 6, ms: 40 });
    if (m) { sel = m.path[0]; partial = [sel]; hop(m.path[1]); }
  },
});
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): in the first game, until the first real
// touch, your opening move is shown: a good piece is picked (its dots light up) and then it steps forward; the CPU replies
let demoM = null;
demo(n => {
  if (n === 1) { demoM = search(bd, 1, { depth: 4, ms: 40 }); if (!demoM || demoM.path.length !== 2) return false; sel = demoM.path[0]; partial = [sel]; soft.click(); return; }
  if (partial && partial[0] === demoM.path[0] && partial.length === 1) hop(demoM.path[1]);
}, { ready: () => P.state === 'play' && P.turn === 0 && !P.busy && !anim && !last && !P.D.isDaily && !P.S.get('wins', 0), wait: 2000, every: 1200, max: 2 });
const disc = (c) => `<i style="display:inline-block;width:13px;height:13px;border-radius:50%;vertical-align:-1px;background:radial-gradient(circle at 35% 30%,${c.a},${c.b})"></i>`;

const cell = (x, y) => { const c = Math.floor((x - geo.x) / geo.s), r = Math.floor((y - geo.y) / geo.s); return c < 0 || r < 0 || c > 7 || r > 7 ? -1 : r * 8 + c; };
const center = (i) => [geo.x + ((i & 7) + 0.5) * geo.s, geo.y + ((i >> 3) + 0.5) * geo.s];
const prefix = (m) => partial && partial.every((p, k) => m.path[k] === p) && m.path.length > partial.length;
const nexts = () => { if (!partial) return []; const s = new Set(); for (const m of legal) if (prefix(m)) s.add(m.path[partial.length]); return [...s]; };
const canMove = (i) => legal.some(m => m.path[0] === i);

function down(x, y) {
  if (anim) return;
  const c = cell(x, y); if (c < 0) return;
  if (partial && nexts().includes(c)) { hop(c); return; }
  if (partial && partial.length > 1) { soft.err(); P.ui.pop('Finish the jump', '#fff', 22, P.popY()); return; }   // mid multi-jump
  if (bd[c] > 0) {
    if (canMove(c)) { sel = c; partial = [c]; soft.click(); }
    else { sel = -1; partial = null; soft.err(); if (legal[0] && legal[0].caps.length) { mustFlash = performance.now(); P.ui.pop('A jump is a must', '#fff', 22, P.popY()); } }
  } else { sel = -1; partial = null; }
}
function hop(c) {
  const from = partial[partial.length - 1]; partial.push(c);
  const done = legal.find(m => m.path.length === partial.length && m.path.every((p, k) => p === partial[k]));
  const more = legal.some(m => prefix(m));
  if (done && !more) {
    P.push({ bd: bd.slice(), quiet, lost: lost.slice(), last });
    play(done, 1, () => { if (!checkEnd(-1)) cpuTurn(); }, partial.length - 2);
    partial = null; sel = -1;
  } else { // intermediate landing of a multi-jump: animate this hop only, keep going
    const capIdx = partial.length - 2; anim = { kind: 'hop', from, to: c, v: bd[sel], start: performance.now(), dur: P.dur(170) };
    P.busy = true; setTimeout(() => { anim = null; P.busy = false; tone(240, 0.08, 'triangle', 0.12, 0.7); const [x, y] = center(c); P.fx.sparks(x, y, ['#2b2632', '#fff'], 8, { speed: 2.5 }); }, anim.dur);
    void capIdx;
  }
}
async function cpuTurn() {
  const m = await P.think({ b: bd, side: -1, diff: P.diff, seed: (P.seed + quiet * 131 + bd.reduce((a, v, i) => a + v * i, 0)) >>> 0, fk: P.F.k() });
  if (!m) return;
  const mm = legal.find(x => x.path.join() === m.path.join()) || legal[0];
  play(mm, -1, () => { if (!checkEnd(1)) P.setTurn(0); }, 0);
}
/** animate a full move hop by hop (starting at hop `from`), then apply it */
function play(m, side, done, fromHop = 0) {
  const v = bd[m.path[0]]; P.busy = true;
  const hops = []; for (let k = fromHop; k < m.path.length - 1; k++) hops.push([m.path[k], m.path[k + 1]]);
  let k = 0;
  const step = () => {
    if (k >= hops.length) {
      bd = apply(bd, m); last = { f: m.path[0], t: m.path[m.path.length - 1] }; anim = null;
      if (m.caps.length) lost[side > 0 ? 1 : 0] += m.caps.length;
      quiet = m.caps.length || m.crown ? 0 : quiet + 1;
      legal = moves(bd, -side); P.busy = false;
      if (m.crown) { chime(5, 76, 0.12); setTimeout(() => chime(7, 76, 0.1), 90); const [x, y] = center(last.t); P.fx.sparks(x, y, ['#ffd36e', '#fff', '#ffb84d'], 16, { speed: 3.4 }); P.ui.pop(side > 0 ? 'Crowned!' : 'CPU crowned', side > 0 ? '#d18b00' : INK, 30, P.popY()); buzz(12); }
      P.hud(); done(); return;
    }
    const [a, b] = hops[k], jump = Math.abs((a >> 3) - (b >> 3)) === 2;
    anim = { kind: 'move', from: a, to: b, v, m, upto: fromHop + k, start: performance.now(), dur: P.dur(jump ? 200 : 170) };
    setTimeout(() => {
      if (jump) { tone(240, 0.08, 'triangle', 0.12, 0.7); tone(700, 0.04, 'square', 0.03, 0.6); const [x, y] = center((a + b) / 2); P.fx.sparks(x, y, side > 0 ? ['#2b2632', '#8d859a', '#fff'] : ['#d8432f', '#ffb3a3', '#fff'], 12, { speed: 3 }); buzz(10); }
      else soft.wood();
      k++; step();
    }, anim.dur);
  };
  step();
}
function checkEnd(next) {
  const left = (s) => bd.some(v => Math.sign(v) === s);
  if (!legal.length) {
    if (next < 0) P.end('win', left(-1) ? 'Blocked!' : 'You win!', left(-1) ? 'The CPU has no moves left' : 'Every CPU piece captured');
    else P.end('loss', 'Out of moves', left(1) ? 'Your pieces are blocked' : `The ${DIFFS[P.diff]} CPU took every piece`);
    return true;
  }
  if (quiet >= 80) { P.end('draw', 'Draw', '40 moves each with no capture or crowning'); return true; }
  return false;
}

// ---------------------------------------------------------------- drawing
function piece(g, x, y, s, v, { alpha = 1, lift = 0 } = {}) {
  const C = v > 0 ? RED : BLK, r = s * 0.39; g.save(); g.globalAlpha = alpha;
  g.fillStyle = 'rgba(40,20,15,.28)'; g.beginPath(); g.ellipse(x, y + r * 0.32 + lift * 0.4, r * 1.02, r * 0.9, 0, 0, 7); g.fill();
  y -= lift;
  g.fillStyle = C.rim; g.beginPath(); g.arc(x, y + r * 0.14, r, 0, 7); g.fill();
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.1, x, y, r * 1.05); gr.addColorStop(0, C.a); gr.addColorStop(1, C.b);
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  g.strokeStyle = C.line; g.globalAlpha = alpha * 0.55; g.lineWidth = Math.max(1, s * 0.022);
  g.beginPath(); g.arc(x, y, r * 0.72, 0, 7); g.stroke(); g.beginPath(); g.arc(x, y, r * 0.5, 0, 7); g.stroke(); g.globalAlpha = alpha;
  if (Math.abs(v) === 2) {     // crown
    const w = r * 0.95, h = r * 0.62, cx = x, cy = y + r * 0.05;
    g.fillStyle = '#ffd25c'; g.strokeStyle = '#a8740f'; g.lineWidth = Math.max(1.2, s * 0.028); g.lineJoin = 'round';
    g.beginPath(); g.moveTo(cx - w / 2, cy + h / 2); g.lineTo(cx - w / 2, cy - h * 0.25); g.lineTo(cx - w / 4, cy + h * 0.05); g.lineTo(cx, cy - h / 2); g.lineTo(cx + w / 4, cy + h * 0.05); g.lineTo(cx + w / 2, cy - h * 0.25); g.lineTo(cx + w / 2, cy + h / 2); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#fff6d6'; for (const dx of [-w / 2, 0, w / 2]) { g.beginPath(); g.arc(cx + dx, cy - (dx ? h * 0.25 : h / 2), s * 0.03, 0, 7); g.fill(); }
  }
  g.restore();
}
function draw(g, now) {
  const { x: X, y: Y, s } = geo, N = s * 8;
  g.save(); g.shadowColor = 'rgba(70,30,20,.25)'; g.shadowBlur = 28; g.shadowOffsetY = 12;
  rrect(g, X - s * 0.18, Y - s * 0.18, N + s * 0.36, N + s * 0.36, 16); g.fillStyle = '#5b3a2f'; g.fill(); g.restore();
  g.save(); rrect(g, X, Y, N, N, 6); g.clip();
  for (let i = 0; i < 64; i++) { const [cx, cy] = center(i); g.fillStyle = dark(i) ? DARKSQ : LIGHT; g.fillRect(cx - s / 2, cy - s / 2, s, s); }
  const tint = (q, col) => { const [cx, cy] = center(q); g.fillStyle = col; g.fillRect(cx - s / 2, cy - s / 2, s, s); };
  if (last) { tint(last.f, 'rgba(255,214,90,.32)'); tint(last.t, 'rgba(255,214,90,.42)'); }
  if (sel >= 0) tint(partial ? partial[partial.length - 1] : sel, 'rgba(255,220,110,.55)');
  // pieces that can move (subtle glow when a jump is forced)
  if (P.state === 'play' && P.turn === 0 && !partial && legal.length && legal[0].caps.length) {
    const k = 0.35 + 0.25 * Math.sin(now / 220) + (now - mustFlash < 900 ? 0.4 : 0);
    for (const m of legal) { const [cx, cy] = center(m.path[0]); g.strokeStyle = `rgba(255,236,150,${k})`; g.lineWidth = 3; g.strokeRect(cx - s / 2 + 2, cy - s / 2 + 2, s - 4, s - 4); }
  }
  g.restore();
  // pieces
  const caps = new Set();
  if (partial) for (const m of legal) if (prefix(m) || m.path.length === partial.length) { for (let k = 0; k < partial.length - 1; k++) caps.add(m.caps[k]); }
  if (anim && anim.kind === 'move') for (let k = 0; k < anim.upto; k++) caps.add(anim.m.caps[k]);
  const moving = anim ? anim.from : -1;
  for (let i = 0; i < 64; i++) {
    const v = bd[i]; if (!v) continue;
    if (anim && anim.kind === 'move' && i === anim.m.path[0]) continue;
    if (partial && partial.length > 1 && i === partial[0]) continue;
    if (anim && anim.kind === 'hop' && i === partial[0]) continue;
    const [cx, cy] = center(i), sh = i === sel && !partial ? 0 : 0;
    piece(g, cx, cy - sh, s, v, { alpha: caps.has(i) ? 0.25 : 1, lift: i === sel && partial && partial.length === 1 ? s * 0.06 : 0 });
  }
  if (partial && partial.length > 1 && !(anim && anim.kind === 'hop')) { const [cx, cy] = center(partial[partial.length - 1]); piece(g, cx, cy, s, bd[partial[0]], { lift: s * 0.06 }); }
  if (anim) {
    const k = ease.inout((now - anim.start) / anim.dur), [ax, ay] = center(anim.from), [bx, by] = center(anim.to);
    const v = anim.kind === 'hop' ? bd[partial[0]] : anim.v, jump = Math.abs((anim.from >> 3) - (anim.to >> 3)) === 2;
    piece(g, ax + (bx - ax) * k, ay + (by - ay) * k, s * (1 + Math.sin(k * Math.PI) * (jump ? 0.14 : 0.05)), v, { lift: Math.sin(k * Math.PI) * s * (jump ? 0.35 : 0.1) });
  }
  void moving;
  // legal dots
  if (partial && P.turn === 0 && !anim) for (const t of nexts()) {
    const [cx, cy] = center(t); g.fillStyle = 'rgba(255,240,200,.55)'; g.beginPath(); g.arc(cx, cy, s * 0.17, 0, 7); g.fill();
    g.strokeStyle = 'rgba(80,30,20,.35)'; g.lineWidth = 2; g.stroke();
  }
}

P.start();
