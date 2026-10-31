// Boxbound — the classic pencil-and-paper dots and boxes game, you vs the computer.
// Take turns drawing one line between two neighbouring dots. Close the fourth side of a box to claim it and draw again.
// Most boxes when the grid is full wins. Normal and Hard never hand you a free third side while a safe line is left;
// Hard also plays the "leave the last two" trick to keep control of long chains.
import { board } from './kit/board.js';
import { store } from './kit/hc.js';
import { duel, rngf, rrect, ease, SVG, buzz, tone, note, soft, chime } from './duel.js';
import { ab } from './kit/xp.js';
import { createDeep, PENS } from './deep.js';
import { LEVELS } from './levels.js';
import { model, solve } from './solve.js';
// v2 ("deep"): 30 solver-checked puzzle pages in 3 worlds, gold boxes, stars, pens, Daily Page. READY stays false until v2 is checked;
// ?deep=1 forces v2 for QA only while it is false.
const READY = true;
const DEEP = (READY && ab('deep-boxbound')) || (!READY && new URLSearchParams(location.search).get('deep') === '1');

const NAME = 'Boxbound: Dots and Boxes';
const B = board({ game: 'boxbound', label: 'Wins vs CPU (Hard counts 2)', limits: { maxRun: 2, maxPerSec: 0.2 }, mode: 'sum', corner: 'tl' });
let YOU = '#3f7fd8', YOU_L = '#cfe0fb'; const CPU = '#e0605a', CPU_L = '#fbd3cf', INK = '#2f3550', PRE = '#9aa0b8';
const lighten = (hex, k = 0.78) => { const n = parseInt(hex.slice(1), 16), f = (v) => Math.round(v + (255 - v) * k); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
function setPen(c) { YOU = c; YOU_L = lighten(c); }
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

let shakeUntil = 0, chainShow = { n: 0, t: 0, side: 0 }, worst = { e: -1, n: 0 }, feverUntil = 0, WT = [], cur = null, assisted = false, maxRun = 0, run = 0, runSide = -1, hintEdge = -1, deep = null, drawn = [], owner = [], who = [], turn = 0, rand = Math.random, undoStack = [], busy = false, ghost = -1, lastCpu = [], anim = {}, boxAnim = {}, sizeIdx = store('boxbound').get('size', 1);
const sides = (b, d = drawn) => boxEdges[b].reduce((a, e) => a + (d[e] ? 1 : 0), 0);
const free = () => { const f = []; for (let e = 0; e < E; e++) if (!drawn[e]) f.push(e); return f; };
const completes = (e, d = drawn) => edgeBoxes[e].filter(b => sides(b, d) === 3).length;
const safe = (e, d = drawn) => edgeBoxes[e].every(b => sides(b, d) <= 1);

// how many boxes the opponent could grab in a row (greedy) after we draw e
function giveList(e) {
  const sd = []; for (let b = 0; b < N * N; b++) sd[b] = sides(b);
  const d = drawn.slice(), q = [], got = [];
  const add = (f) => { d[f] = 1; for (const b of edgeBoxes[f]) { sd[b]++; if (sd[b] === 3) q.push(b); else if (sd[b] === 4) got.push(b); } };
  add(e);
  while (q.length) { const b = q.pop(); if (sd[b] !== 3) continue; const f = boxEdges[b].find(x => !d[x]); if (f !== undefined) add(f); }
  return got;
}
const giveaway = (e) => giveList(e).reduce((a, b) => a + (WT[b] || 1), 0);
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
  buttons: [{ id: 'undo', label: 'Undo', svg: SVG.undo, onPress: () => undo() }].concat(DEEP ? [{ id: 'hint', label: 'Hint', svg: SVG.hint, onPress: () => hint() }] : []),
  refresh() { T.setBtn('undo', { gone: DEEP ? false : T.diff !== 0, dim: !(undoStack.length > 1 && turn === 0 && !busy) }); if (DEEP) T.setBtn('hint', { dim: !(turn === 0 && !busy) }); },
  onNew: DEEP ? () => { deep.map(); } : null,
  onEnd: DEEP ? (res) => { const me = count(0), cp = count(1); if (res === 'win' && me - cp >= deep.cur.spec.stars[2] && !assisted) { T.fx.confetti(90); T.ui.flash(0.35); buzz([40, 40, 80]); } setTimeout(() => { deep.result({ won: res === 'win', mine: me, cpu: cp, margin: me - cp, assisted, maxRun }); }, res === 'win' ? 1100 : 750); return true; } : null,
  newGame({ seed, daily, games }) {
    rand = rngf(seed);
    if (DEEP && cur) {
      const sp = cur.spec; build(sp.n);
      drawn = new Array(E).fill(0); who = new Array(E).fill(-1); owner = new Array(N * N).fill(-1); WT = new Array(N * N).fill(1);
      sp.edges.forEach(e => { drawn[e] = 1; who[e] = 2; }); sp.gold.forEach(b => WT[b] = 2); sp.claimed.forEach((b, k) => owner[b] = k % 2);
      T.setDiff(sp.cpu); assisted = false; worst = { e: -1, n: 0 }; maxRun = 0; run = 0; runSide = -1; hintEdge = -1;
      anim = {}; boxAnim = {}; lastCpu = []; undoStack = []; busy = false; ghost = -1; moveCount = 0;
      layout(T.area()); turn = sp.cpuFirst ? 1 : 0; head();
      if (turn === 1) { T.status('Computer starts · wait for its line', tag()); T.after(900, cpuTurn); } else yourTurn(true);
      return;
    }
    build(daily ? 5 : SIZES[sizeIdx]); WT = new Array(N * N).fill(1);
    drawn = new Array(E).fill(0); who = new Array(E).fill(-1); owner = new Array(N * N).fill(-1);
    anim = {}; boxAnim = {}; lastCpu = []; undoStack = []; busy = false; ghost = -1; moveCount = 0;
    layout(T.area());
    turn = daily ? 0 : games % 2;
    head();
    if (turn === 1) { T.status('Computer starts this game', 'CPU'); T.after(800, cpuTurn); } else yourTurn(true);
  },
  idle() { build(SIZES[sizeIdx]); WT = new Array(N * N).fill(1); drawn = new Array(E).fill(0); who = new Array(E).fill(-1); owner = new Array(N * N).fill(-1); head(); },
  layout: (a) => layout(a),
  draw, down, move, up,
  frac: () => { const m = owner.filter(o => o === 0).length; return Math.min(1, m / Math.max(1, (N * N) / 2)); },
  bot() { if (busy || turn !== 0) return; play(0, cpuPick(2, 0)); },
  botSpeed: 0.3,
  debug: () => ({ N, drawn: drawn.slice(), owner: owner.slice(), turn, busy }),
});

const count = (s) => owner.reduce((a, o, b) => a + (o === s ? (WT[b] || 1) : 0), 0);
const tag = () => { if (!DEEP || !cur) return ''; const sp = cur.spec, i = cur.index; return `${typeof i === 'number' ? 'PAGE ' + (i + 1) : 'DAILY PAGE'} · WIN BY ${sp.stars[2]} FOR 3 STARS`; };
function head() {
  T.header([{ name: 'You', init: 'Y', color: YOU, score: count(0) }, { name: 'CPU', init: 'C', color: CPU, score: count(1) }], T.state === 'play' ? turn : -1);
  T.score(count(0));
}
function yourTurn(first) {
  turn = 0; busy = false; head();
  undoStack.push({ drawn: drawn.slice(), who: who.slice(), owner: owner.slice(), lastCpu: lastCpu.slice() }); if (undoStack.length > 80) undoStack.shift();
  T.status(first ? 'You start · draw a line' : 'Your turn · draw a line', tag());
  T.refreshButtons();
}
function hint() {
  if (!DEEP || busy || turn !== 0 || T.state !== 'play') { soft.err(); return; }
  T.toast('Thinking…', 900);
  setTimeout(() => {
    const r = solve(model(N), drawn, WT); if (!r) { T.toast('No hint here'); return; }
    let be = -1, bv = -1e9; r.firsts.forEach((v, e) => { if (v > bv || (v === bv && rand() < 0.3)) { bv = v; be = e; } });
    hintEdge = be; assisted = true; soft.click();
    const mm = model(N), gives = mm.edgeBoxes[be].some(b => mm.boxEdges[b].filter(e => drawn[e] || e === be).length === 3 && owner[b] < 0);
    T.toast(gives ? 'Give a box on purpose: it keeps the long chain for you' : 'Best line (no 3 stars with a hint)', 2600);
  }, 40);
}
function undo() {
  if ((!DEEP && T.diff !== 0) || busy || turn !== 0 || undoStack.length < 2) { soft.err(); return; }
  undoStack.pop(); const s = undoStack[undoStack.length - 1]; if (DEEP) { assisted = true; hintEdge = -1; }
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
  tone(side ? 520 : 640, 0.05, 'triangle', 0.08, 1.15); tone(side ? 150 : 190, 0.07, 'sine', 0.16, 0.6); buzz(side ? 3 : 7);
  { const k = edgeEnds(e), a = dot(k.r1, k.c1), b = dot(k.r2, k.c2); T.fx.sparks((a.x + b.x) / 2, (a.y + b.y) / 2, ['#fff', side ? CPU : YOU], 5, { speed: 2, size: 2 }); }
  const got = edgeBoxes[e].filter(b => sides(b) === 4 && owner[b] < 0);
  got.forEach((b, k) => { owner[b] = side; boxAnim[b] = performance.now() + k * 90; });
  hintEdge = -1;
  if (DEEP && side === 0 && !got.length) { drawn[e] = 0; const gn = giveaway(e); drawn[e] = 1; if (gn > worst.n) worst = { e, n: gn }; }
  run = got.length ? (runSide === side ? run : 0) + got.length : 0; runSide = side; if (DEEP && side === 0 && run > maxRun) maxRun = run; if (DEEP && side === 0 && run >= 3) feverUntil = performance.now() + 2500; if (DEEP && run >= 2) { chainShow = { n: run, t: performance.now(), side }; if (run >= 3) { shakeUntil = performance.now() + 120 + run * 40; buzz([20, 20, 40]); } }
  T.after(170, () => {
    if (got.length) {
      head();
      const n = count(side);
      chime(DEEP ? run + 1 : n, side ? 65 : 72, 0.1); if (side === 0) buzz([8, 30, 8]);
      got.forEach(b => { const c = boxCenter(b), gold = WT[b] > 1; T.fx.sparks(c.x, c.y, gold ? ['#fff', '#ffd23a', '#ffb300'] : ['#fff', side ? CPU : YOU, '#ffe08a'], gold ? 22 : 10 + (DEEP ? Math.min(14, run * 3) : 0), { speed: gold ? 3.4 : 2.6, size: gold ? 4 : 3 }); if (gold && DEEP) { T.ui.pop(side ? 'CPU got the gold' : 'GOLD +2!', side ? CPU : '#c98a00', 34, 40); if (!side) { buzz([12, 24, 12]); chime(9, 84, 0.12); } } });
      if (DEEP && !got.some(b => WT[b] > 1) || !DEEP) { if (DEEP && run >= 3) { T.ui.pop(side ? `CPU chain ×${run}` : (run === 3 ? 'TRIPLE!' : `CHAIN ×${run}!`), side ? CPU : YOU, 30 + Math.min(18, run * 3), 44); if (run >= 5 && !side) { T.fx.confetti(60); T.ui.flash(0.3); } if (run >= 4 && side) buzz([30, 30, 30]); }
        else if (got.length === 2) T.ui.pop(side ? 'CPU: double box' : 'Double box!', side ? CPU : YOU, 30, 44); }
    }
    if (owner.every(o => o >= 0)) return T.after(450, finish);
    if (!got.length && twoLeft()) T.ui.pop(side ? 'CPU keeps control' : 'Control kept!', side ? CPU : YOU, 28, 44);
    if (got.length) {
      if (side === 0) { yourTurn(false); return T.status('Box! Draw again', tag()); }
      T.status('Computer draws again…', 'CPU'); return T.after(330, cpuTurn);
    }
    if (side === 0) { turn = 1; busy = true; head(); T.status('Computer is thinking…', 'CPU'); T.after(520, cpuTurn); }
    else yourTurn(false);
  });
}
// a "double-cross" pair: two open boxes with three sides each that share the last line, offered as a gift to keep control
function twoLeft() {
  for (let b = 0; b < N * N; b++) {
    if (owner[b] >= 0 || sides(b) !== 3) continue;
    const e = boxEdges[b].find(x => !drawn[x]), nb = edgeBoxes[e].find(x => x !== b);
    if (nb !== undefined && owner[nb] < 0 && sides(nb) === 3) return true;
  }
  return false;
}
function cpuTurn() {
  if (T.state !== 'play') return;
  turn = 1; busy = false; head();
  play(1, cpuPick(T.diff, 1));
}
function finish() {
  const me = count(0), cpu = count(1), line = `${me} – ${cpu} boxes${!DEEP && T.diff === 2 && me > cpu ? ' · Hard win counts 2' : ''}`;
  head();
  if (me > cpu) T.end('win', { line, margin: me - cpu });
  else if (me === cpu) T.end('draw', { line });
  else T.end('lose', { line: line + (DEEP && worst.n >= 2 ? ` · your biggest gift: ${worst.n}` : ''), frac: Math.min(1, me / (N * N / 2)) });
}

// ---------------------------------------------------------------- geometry + input
function layout(a) {
  const s = Math.floor(Math.min(a.w - 8, a.h - 70, 620) / (N + 0.95));
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
  const shk = DEEP && now < shakeUntil; if (shk) { g.save(); g.translate((Math.random() - .5) * 7, (Math.random() - .5) * 7); }
  if (DEEP && now < feverUntil) { const a = Math.min(1, (feverUntil - now) / 600) * (0.35 + 0.15 * Math.sin(now / 90)); g.save(); g.shadowColor = '#ffb300'; g.shadowBlur = 60; g.fillStyle = `rgba(255,190,40,${a})`; rrect(g, x - s * 0.42, y - s * 0.42, s * (N + 0.84), s * (N + 0.84), 22); g.fill(); g.restore(); }
  // paper card
  g.save(); g.shadowColor = 'rgba(40,40,80,.16)'; g.shadowBlur = 26; g.shadowOffsetY = 8;
  rrect(g, x - s * 0.42, y - s * 0.42, s * (N + 0.84), s * (N + 0.84), 22); g.fillStyle = '#fffef9'; g.fill(); g.restore();
  g.save(); rrect(g, x - s * 0.42, y - s * 0.42, s * (N + 0.84), s * (N + 0.84), 22); g.clip();
  g.strokeStyle = 'rgba(90,130,200,.10)'; g.lineWidth = 1;
  for (let yy = y - s * 0.42 + 12; yy < y + s * (N + 0.42); yy += s / 4) { g.beginPath(); g.moveTo(x - s, yy); g.lineTo(x + s * (N + 1), yy); g.stroke(); }
  g.restore();
  // gold boxes still open
  if (DEEP) for (let b = 0; b < N * N; b++) if (WT[b] > 1 && owner[b] < 0) { const c = boxCenter(b), w = s - 8; g.fillStyle = 'rgba(255,208,70,.38)'; rrect(g, c.x - w / 2, c.y - w / 2, w, w, 8); g.fill(); g.fillStyle = 'rgba(190,130,0,.75)'; g.font = `800 ${Math.round(s * 0.36)}px ui-rounded,system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('2', c.x, c.y + 1); g.textBaseline = 'alphabetic'; }
  // boxes
  for (let b = 0; b < N * N; b++) {
    if (owner[b] < 0) continue;
    const c = boxCenter(b), p = Math.min(1, Math.max(0, (now - (boxAnim[b] || 0)) / 380)), k = ease.back(p);
    const w = (s - 8) * k;
    g.fillStyle = owner[b] ? CPU_L : YOU_L; rrect(g, c.x - w / 2, c.y - w / 2, w, w, 8 * k); g.fill();
    if (p > 0.2) mark(g, c.x, c.y, s * 0.2 * k, owner[b]);
  }
  // preview: what the computer could take if you draw the line you are holding
  if (ghost >= 0 && turn === 0 && !busy && !completes(ghost)) {
    const gl = giveList(ghost), k = edgeEnds(ghost), a = dot(k.r1, k.c1), b2 = dot(k.r2, k.c2), n = gl.reduce((q, bb) => q + (WT[bb] || 1), 0);
    gl.forEach(bb => { const c = boxCenter(bb), w = s - 8; g.fillStyle = 'rgba(224,96,90,.22)'; rrect(g, c.x - w / 2, c.y - w / 2, w, w, 8); g.fill(); g.strokeStyle = 'rgba(224,96,90,.7)'; g.lineWidth = 2; g.setLineDash([5, 4]); g.stroke(); g.setLineDash([]); });
    const lx = (a.x + b2.x) / 2, ly = Math.min(a.y, b2.y) - (a.y === b2.y ? 34 : 4) - (a.y === b2.y ? 0 : 0);
    const txt = n ? `gives ${n}` : 'safe', col = n ? CPU : '#2e9a5a', ty = Math.max(geo.y - 6, ly);
    g.save(); g.font = '800 14px -apple-system,system-ui,sans-serif'; g.textAlign = 'center'; const tw = g.measureText(txt).width + 18;
    g.fillStyle = col; rrect(g, lx - tw / 2, ty - 15, tw, 24, 12); g.fill(); g.fillStyle = '#fff'; g.fillText(txt, lx, ty + 2); g.restore();
  }
  // lines
  for (let e = 0; e < E; e++) {
    if (!drawn[e] && e !== ghost && e !== hintEdge) continue;
    const k = edgeEnds(e), a = dot(k.r1, k.c1), b = dot(k.r2, k.c2);
    if (!drawn[e] && e === hintEdge && e !== ghost) { g.strokeStyle = `rgba(240,170,20,${0.55 + 0.4 * Math.sin(t * 8)})`; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); continue; }
    if (!drawn[e]) { g.strokeStyle = 'rgba(63,127,216,.35)'; g.lineWidth = 7; g.lineCap = 'round'; g.setLineDash([2, 10]); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); g.setLineDash([]); continue; }
    const p = ease.out((now - (anim[e] || 0)) / 170), col = who[e] === 2 ? PRE : who[e] ? CPU : YOU;
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
  if (DEEP && worst.e >= 0 && T.state !== 'play') { const k = edgeEnds(worst.e), a = dot(k.r1, k.c1), b = dot(k.r2, k.c2); g.strokeStyle = '#ffb300'; g.lineWidth = 5; g.setLineDash([6, 6]); g.beginPath(); g.arc((a.x + b.x) / 2, (a.y + b.y) / 2, s * 0.3, 0, 7); g.stroke(); g.setLineDash([]); }
  if (DEEP && chainShow.n >= 2 && now - chainShow.t < 1400) { const q = (now - chainShow.t) / 1400, sc = 1 + 0.4 * Math.max(0, 1 - q * 5); g.save(); g.globalAlpha = Math.min(1, (1 - q) * 2); g.translate(x + s * N / 2, y + s * N / 2); g.scale(sc, sc); g.font = '900 ' + Math.round(s * 1.3) + 'px -apple-system,system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = '#fff'; g.fillStyle = chainShow.side ? CPU : YOU; const tx = '×' + chainShow.n; g.strokeText(tx, 0, 0); g.fillText(tx, 0, 0); g.restore(); }
  // legend under the grid
  g.font = '600 13px -apple-system,system-ui,sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(47,53,80,.5)';
  const left = owner.filter(o => o < 0).length;
  g.fillText(left ? `${left} box${left > 1 ? 'es' : ''} left` : '', x + s * N / 2, y + s * N + s * 0.42 + 26);
  if (shk) g.restore();
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

if (DEEP) {
  deep = createDeep(store('boxbound'), {
    start(c) { cur = c; T.state = 'ready'; T.newGame(); T.toast(c.spec.why.split(/[.:?] /)[0].replace(/\.$/, ''), 2200); },
    abandon() { if (T.state === 'play') { T.abandon(); T.state = 'ready'; } },
    err() { soft.err(); },
    pen() { setPen(deep.pen.c); },
    star(k) { chime(2 + k * 3, 79, 0.12); buzz(10); },
  });
  setPen(deep.pen.c);
  window.__deep = deep;
}
T.start();
if (DEEP) { document.querySelectorAll('.hc-card').forEach(c => c.style.display = 'none'); if (deep.total === 0 && deep.top === 0) deep.play(0); else deep.map(); }
