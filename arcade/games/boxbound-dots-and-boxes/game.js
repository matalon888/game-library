// Boxbound — the classic pencil-and-paper dots and boxes game, you vs the computer.
// Take turns drawing one line between two neighbouring dots. Close the fourth side of a box to claim it and draw again.
// Most boxes when the grid is full wins. Normal and Hard never hand you a free third side while a safe line is left;
// Hard also plays the "leave the last two" trick to keep control of long chains.
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { store } from './kit/hc.js';
import { duel, rngf, rrect, ease, SVG, buzz, tone, note, soft, chime } from './duel.js';

const NAME = 'Boxbound: Dots and Boxes';
const B = board({ game: 'boxbound', label: 'Wins vs CPU (Hard counts 2)', limits: { maxRun: 2, maxPerSec: 0.2 }, mode: 'sum', corner: 'tl' });
const YOU = '#3f7fd8', CPU = '#e0605a', YOU_L = '#cfe0fb', CPU_L = '#fbd3cf', INK = '#2f3550';
const SIZES = [4, 5, 6];

// ---------------------------------------------------------------- grid model
// edges: horizontal h(r,c) r 0..N c 0..N-1 → index r*N+c ; vertical v(r,c) r 0..N-1 c 0..N → index HN + r*(N+1)+c
let N = 5, HN = 0, E = 0, edgeBoxes = [], boxEdges = [];
function build(n) {
  N = n; HN = (N + 1) * N; E = HN + N * (N + 1); edgeBoxes = []; boxEdges = [];
  for (let e = 0; e < E; e++) edgeBoxes.push([]);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const b = r * N + c, es = [r * N + c, (r + 1) * N + c, HN + r * (N + 1) + c, HN + r * (N + 1) + c + 1];
    boxEdges[b] = es; es.forEach(e => edgeBoxes[e].push(b));
  }
}
const edgeEnds = (e) => e < HN ? { r1: Math.floor(e / N), c1: e % N, r2: Math.floor(e / N), c2: e % N + 1 } : (() => { const k = e - HN, r = Math.floor(k / (N + 1)), c = k % (N + 1); return { r1: r, c1: c, r2: r + 1, c2: c }; })();

let drawn = [], owner = [], who = [], turn = 0, rand = Math.random, undoStack = [], busy = false, ghost = -1, lastCpu = [], anim = {}, boxAnim = {}, sizeIdx = store('boxbound').get('size', 1);
const sides = (b, d = drawn) => boxEdges[b].reduce((a, e) => a + (d[e] ? 1 : 0), 0);
const free = () => { const f = []; for (let e = 0; e < E; e++) if (!drawn[e]) f.push(e); return f; };
const completes = (e, d = drawn) => edgeBoxes[e].filter(b => sides(b, d) === 3).length;
const safe = (e, d = drawn) => edgeBoxes[e].every(b => sides(b, d) <= 1);

// how many boxes the opponent could grab in a row (greedy) after we draw e
function giveaway(e) {
  const sd = []; for (let b = 0; b < N * N; b++) sd[b] = sides(b);
  const d = drawn.slice(), q = []; let n = 0;
  const add = (f) => { d[f] = 1; for (const b of edgeBoxes[f]) { sd[b]++; if (sd[b] === 3) q.push(b); else if (sd[b] === 4) n++; } };
  add(e);
  while (q.length) { const b = q.pop(); if (sd[b] !== 3) continue; const f = boxEdges[b].find(x => !d[x]); if (f !== undefined) add(f); }
  return n;
}
// Hard: at the end of a chain with no safe line left, leave the last two boxes as a gift to keep control
function doubleDeal() {
  for (let b = 0; b < N * N; b++) {
    if (owner[b] >= 0 || sides(b) !== 3) continue;
    const e = boxEdges[b].find(x => !drawn[x]); const nb = edgeBoxes[e].find(x => x !== b);
    if (nb === undefined || owner[nb] >= 0 || sides(nb) !== 2) continue;
    const f = boxEdges[nb].find(x => !drawn[x] && x !== e); if (f === undefined) continue;
    const far = edgeBoxes[f].find(x => x !== nb);
    if (far !== undefined && owner[far] < 0 && sides(far) >= 2) continue;          // the chain goes on: keep eating first
    return { f, a: b, b: nb };
  }
  return null;
}
function playouts(first, me, K = 8) {
  const d0 = drawn.slice(), o0 = owner.slice(); let tot = 0;
  for (let k = 0; k < K; k++) {
    drawn = d0.slice(); owner = o0.slice(); let t = me, e = first;
    for (let guard = 0; guard < E && owner.some(o => o < 0); guard++) {
      drawn[e] = 1; const got = edgeBoxes[e].filter(b => sides(b) === 4 && owner[b] < 0); got.forEach(b => owner[b] = t);
      if (!got.length) t = 1 - t;
      if (!owner.some(o => o < 0)) break;
      e = cpuPick(1, t);
    }
    tot += owner.filter(o => o === me).length - owner.filter(o => o === 1 - me).length;
  }
  drawn = d0; owner = o0;
  return tot / K;
}
function cpuPick(level, me) {
  const fr = free(), take = fr.filter(e => completes(e)), safes = fr.filter(e => safe(e));
  const pick = (a) => a[Math.floor(rand() * a.length)];
  if (level === 0) {                                     // Easy: usually grabs a box, otherwise any line
    if (take.length && rand() < 0.75) return pick(take);
    if (safes.length && rand() < 0.5) return pick(safes);
    return pick(fr);
  }
  if (level === 2 && take.length && !safes.length) {
    const dd = doubleDeal();
    if (dd) {
      // weigh the two endings by playing each out a few times (both sides then play like Normal)
      const take1 = take.find(e => edgeBoxes[e].includes(dd.a)) ?? take[0];
      if (playouts(dd.f, me) > playouts(take1, me) + 0.5) return dd.f;
    }
  }
  if (take.length) {                                     // prefer captures that continue the chain
    const cont = take.filter(e => { const d = drawn.slice(); d[e] = 1; return free().some(f => f !== e && completes(f, d)); });
    return pick(cont.length ? cont : take);
  }
  if (safes.length) return pick(safes);
  // no safe line: give away as little as possible
  let best = [], bv = 1e9;
  for (const e of fr) { const v = giveaway(e); if (v < bv) { bv = v; best = [e]; } else if (v === bv) best.push(e); }
  return pick(best);
}

// ---------------------------------------------------------------- shell
let geo = null, moveCount = 0;
const T = duel({
  key: 'boxbound', name: NAME, brand: 'Boxbound', kicker: 'Dots and boxes vs computer', B,
  rule: 'Draw a line between two dots. Close a box to claim it and draw again. Most boxes wins.',
  accent: '#4f6fd6', bg: ['#fbfaf4', '#ecebe0'], ink: INK, winWord: 'You win!',
  chips2: { label: 'Grid', items: SIZES.map(n => `${n} × ${n}`), get: () => sizeIdx, set: (i) => { sizeIdx = i; store('boxbound').set('size', i); } },
  buttons: [{ id: 'undo', label: 'Undo', svg: SVG.undo, onPress: () => undo() }],
  refresh() { T.setBtn('undo', { gone: T.diff !== 0, dim: !(undoStack.length > 1 && turn === 0 && !busy) }); },
  newGame({ seed, daily, games }) {
    rand = rngf(seed);
    build(daily ? 5 : SIZES[sizeIdx]);
    drawn = new Array(E).fill(0); who = new Array(E).fill(-1); owner = new Array(N * N).fill(-1);
    anim = {}; boxAnim = {}; lastCpu = []; undoStack = []; busy = false; ghost = -1; moveCount = 0;
    layout(T.area());
    turn = daily ? 0 : games % 2;
    head();
    if (turn === 1) { T.status('Computer starts this game', 'CPU'); T.after(800, cpuTurn); } else yourTurn(true);
  },
  idle() { build(SIZES[sizeIdx]); drawn = new Array(E).fill(0); who = new Array(E).fill(-1); owner = new Array(N * N).fill(-1); head(); },
  layout: (a) => layout(a),
  draw, down, move, up,
  frac: () => { const m = owner.filter(o => o === 0).length; return Math.min(1, m / Math.max(1, (N * N) / 2)); },
  bot() { if (busy || turn !== 0) return; play(0, cpuPick(2, 0)); },
  botSpeed: 0.3,
  debug: () => ({ N, drawn: drawn.slice(), owner: owner.slice(), turn, busy }),
});

const count = (s) => owner.filter(o => o === s).length;
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): in the first game, until the first real
// touch, one safe line is drawn for you (one that gives the computer no box) and the computer answers with its line
demo(() => { play(0, cpuPick(2, 0)); },
  { ready: () => T.state === 'play' && turn === 0 && !busy && moveCount === 0 && !store('boxbound').get('games', 0), wait: 2200, max: 1 });

function head() {
  T.header([{ name: 'You', init: 'Y', color: YOU, score: count(0) }, { name: 'CPU', init: 'C', color: CPU, score: count(1) }], T.state === 'play' ? turn : -1);
  T.score(count(0));
}
function yourTurn(first) {
  turn = 0; busy = false; head();
  undoStack.push({ drawn: drawn.slice(), who: who.slice(), owner: owner.slice(), lastCpu: lastCpu.slice() }); if (undoStack.length > 80) undoStack.shift();
  T.status(first ? 'You start · draw a line' : 'Your turn · draw a line', T.diffName.toUpperCase());
  T.refreshButtons();
}
function undo() {
  if (T.diff !== 0 || busy || turn !== 0 || undoStack.length < 2) { soft.err(); return; }
  undoStack.pop(); const s = undoStack[undoStack.length - 1];
  drawn = s.drawn.slice(); who = s.who.slice(); owner = s.owner.slice(); lastCpu = s.lastCpu.slice(); anim = {}; boxAnim = {};
  soft.click(); buzz(6); head(); T.status('Took back your last turn', 'UNDO'); T.refreshButtons();
}

// ---------------------------------------------------------------- play a line
function play(side, e) {
  if (e < 0 || drawn[e] || T.state !== 'play') return;
  busy = true; drawn[e] = 1; who[e] = side; moveCount++;
  if (side === 0) { T.moved(); lastCpu = []; } else lastCpu.push(e);
  anim[e] = performance.now();
  T.refreshButtons();
  tone(side ? 520 : 640, 0.05, 'triangle', 0.08, 1.15); buzz(5);
  const got = edgeBoxes[e].filter(b => sides(b) === 4 && owner[b] < 0);
  got.forEach((b, k) => { owner[b] = side; boxAnim[b] = performance.now() + k * 90; });
  T.after(170, () => {
    if (got.length) {
      head();
      const n = count(side);
      chime(n, side ? 65 : 72, 0.1); if (side === 0) buzz([8, 30, 8]);
      got.forEach(b => { const c = boxCenter(b); T.fx.sparks(c.x, c.y, ['#fff', side ? CPU : YOU, '#ffe08a'], 10, { speed: 2.6, size: 3 }); });
      if (got.length === 2) T.ui.pop(side ? 'CPU: double box' : 'Double box!', side ? CPU : YOU, 30, 44);
    }
    if (owner.every(o => o >= 0)) return T.after(450, finish);
    if (got.length) {
      if (side === 0) { yourTurn(false); return T.status('Box! Draw again', T.diffName.toUpperCase()); }
      T.status('Computer draws again…', 'CPU'); return T.after(330, cpuTurn);
    }
    if (side === 0) { turn = 1; busy = true; head(); T.status('Computer is thinking…', 'CPU'); T.after(520, cpuTurn); }
    else yourTurn(false);
  });
}
function cpuTurn() {
  if (T.state !== 'play') return;
  turn = 1; busy = false; head();
  play(1, cpuPick(T.diff, 1));
}
function finish() {
  const me = count(0), cpu = count(1), line = `${me} – ${cpu} boxes${T.diff === 2 && me > cpu ? ' · Hard win counts 2' : ''}`;
  head();
  if (me > cpu) T.end('win', { line, margin: me - cpu });
  else if (me === cpu) T.end('draw', { line });
  else T.end('lose', { line, frac: Math.min(1, me / (N * N / 2)) });
}

// ---------------------------------------------------------------- geometry + input
function layout(a) {
  const s = Math.floor(Math.min(a.w - 6, a.h - 60, 560) / (N + 0.9));
  geo = { s, x: Math.round(a.x + (a.w - s * N) / 2), y: Math.round(a.y + Math.max(10, (a.h - s * N) / 2 - 10)) };
}
const dot = (r, c) => ({ x: geo.x + c * geo.s, y: geo.y + r * geo.s });
function boxCenter(b) { const r = Math.floor(b / N), c = b % N; return { x: geo.x + (c + 0.5) * geo.s, y: geo.y + (r + 0.5) * geo.s }; }
function nearest(x, y) {
  let best = -1, bd = geo.s * 0.42;
  for (let e = 0; e < E; e++) {
    if (drawn[e]) continue; const k = edgeEnds(e), a = dot(k.r1, k.c1), b = dot(k.r2, k.c2);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const d = e < HN ? Math.hypot(Math.max(0, Math.abs(x - mx) - geo.s * 0.3), y - my) : Math.hypot(x - mx, Math.max(0, Math.abs(y - my) - geo.s * 0.3));
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function down(x, y) { if (busy || turn !== 0) return; ghost = nearest(x, y); if (ghost >= 0) soft.click(); }
function move(x, y) { if (busy || turn !== 0) return; const e = nearest(x, y); if (e !== ghost && e >= 0) { ghost = e; tone(1200, 0.02, 'sine', 0.03, 0.9); } }
function up() { if (busy || turn !== 0) { ghost = -1; return; } const e = ghost; ghost = -1; if (e >= 0) play(0, e); }

// ---------------------------------------------------------------- drawing
function draw(g, t) {
  if (!geo) return;
  const { s, x, y } = geo, now = performance.now();
  // paper card
  g.save(); g.shadowColor = 'rgba(40,40,80,.16)'; g.shadowBlur = 26; g.shadowOffsetY = 8;
  rrect(g, x - s * 0.42, y - s * 0.42, s * (N + 0.84), s * (N + 0.84), 22); g.fillStyle = '#fffef9'; g.fill(); g.restore();
  g.save(); rrect(g, x - s * 0.42, y - s * 0.42, s * (N + 0.84), s * (N + 0.84), 22); g.clip();
  g.strokeStyle = 'rgba(90,130,200,.10)'; g.lineWidth = 1;
  for (let yy = y - s * 0.42 + 12; yy < y + s * (N + 0.42); yy += s / 4) { g.beginPath(); g.moveTo(x - s, yy); g.lineTo(x + s * (N + 1), yy); g.stroke(); }
  g.restore();
  // boxes
  for (let b = 0; b < N * N; b++) {
    if (owner[b] < 0) continue;
    const c = boxCenter(b), p = Math.min(1, Math.max(0, (now - (boxAnim[b] || 0)) / 380)), k = ease.back(p);
    const w = (s - 8) * k;
    g.fillStyle = owner[b] ? CPU_L : YOU_L; rrect(g, c.x - w / 2, c.y - w / 2, w, w, 8 * k); g.fill();
    if (p > 0.2) mark(g, c.x, c.y, s * 0.2 * k, owner[b]);
  }
  // lines
  for (let e = 0; e < E; e++) {
    if (!drawn[e] && e !== ghost) continue;
    const k = edgeEnds(e), a = dot(k.r1, k.c1), b = dot(k.r2, k.c2);
    if (!drawn[e]) { g.strokeStyle = 'rgba(63,127,216,.35)'; g.lineWidth = 7; g.lineCap = 'round'; g.setLineDash([2, 10]); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); g.setLineDash([]); continue; }
    const p = ease.out((now - (anim[e] || 0)) / 170), col = who[e] ? CPU : YOU;
    const isLast = lastCpu.includes(e) && turn === 0;
    if (isLast) { g.strokeStyle = 'rgba(224,96,90,.22)'; g.lineWidth = 14 + Math.sin(t * 5) * 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); }
    g.strokeStyle = col; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(a.x + (b.x - a.x) * p, a.y + (b.y - a.y) * p); g.stroke();
  }
  // dots
  for (let r = 0; r <= N; r++) for (let c = 0; c <= N; c++) {
    const d = dot(r, c); g.fillStyle = 'rgba(30,30,60,.12)'; g.beginPath(); g.arc(d.x, d.y + 1.5, 6.5, 0, 7); g.fill();
    g.fillStyle = INK; g.beginPath(); g.arc(d.x, d.y, 6, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(d.x - 1.6, d.y - 1.8, 2, 0, 7); g.fill();
  }
  // legend under the grid
  g.font = '600 13px -apple-system,system-ui,sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(47,53,80,.5)';
  const left = owner.filter(o => o < 0).length;
  g.fillText(left ? `${left} box${left > 1 ? 'es' : ''} left` : '', x + s * N / 2, y + s * N + s * 0.42 + 26);
}
function mark(g, x, y, r, side) {
  g.save(); g.translate(x, y);
  if (side === 0) {          // you: a star
    g.fillStyle = YOU; g.beginPath();
    for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.45 : r, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    g.closePath(); g.fill();
  } else {                   // computer: a little round bot face
    g.fillStyle = CPU; g.beginPath(); g.arc(0, 0, r * 0.85, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(-r * 0.32, -r * 0.12, r * 0.16, 0, 7); g.arc(r * 0.32, -r * 0.12, r * 0.16, 0, 7); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = Math.max(1.5, r * 0.12); g.lineCap = 'round'; g.beginPath(); g.arc(0, r * 0.12, r * 0.34, 0.25 * Math.PI, 0.75 * Math.PI); g.stroke();
  }
  g.restore();
}

T.start();
