// Pebblepit — the classic Kalah rules of mancala (a public-domain count-and-capture board game), you vs the computer.
// Six pits and a store each. Pick up a pit and sow its pebbles one by one counter-clockwise; finish in your store to go
// again, finish in an empty pit of yours to capture the pit across. Most pebbles in your store wins.
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { duel, rngf, rrect, ease, SVG, buzz, tone, note, soft, chime } from './duel.js';

const NAME = 'Pebblepit: Mancala vs Computer';
const B = board({ game: 'pebblepit', label: 'Wins vs CPU (Hard counts 2)', limits: { maxRun: 2, maxPerSec: 0.2 }, mode: 'sum', corner: 'tl' });
const YOU = '#3f7fd8', CPU = '#e0605a';
const STONE = ['#5fb3e8', '#f2a03d', '#7cc36e', '#e86a8a', '#a989e6', '#f2d04b'];
const PER = 4;

// ---------------------------------------------------------------- rules (pure, used by the CPU search too)
// pits 0..5 = yours (left column, top → bottom), 6 = your store (bottom), 7..12 = CPU (right column, bottom → top), 13 = CPU store (top)
const storeOf = (s) => s ? 13 : 6;
const own = (s, i) => s ? i >= 7 && i <= 12 : i >= 0 && i <= 5;
function play(b, s, i) {            // returns { b, again, cap, last, path }
  b = b.slice(); let n = b[i]; b[i] = 0; let j = i; const path = [];
  while (n > 0) { j = (j + 1) % 14; if (j === storeOf(1 - s)) continue; b[j]++; n--; path.push(j); }
  let cap = 0;
  if (own(s, j) && b[j] === 1 && b[12 - j] > 0) { cap = b[12 - j] + 1; b[storeOf(s)] += cap; b[j] = 0; b[12 - j] = 0; }
  const again = j === storeOf(s);
  return { b, again, cap, last: j, path };
}
const moves = (b, s) => { const m = []; for (let i = s ? 7 : 0, k = 0; k < 6; k++, i++) if (b[i] > 0) m.push(i); return m; };
const sideEmpty = (b, s) => moves(b, s).length === 0;
function sweep(b) { b = b.slice(); for (let i = 0; i < 6; i++) { b[6] += b[i]; b[i] = 0; } for (let i = 7; i < 13; i++) { b[13] += b[i]; b[i] = 0; } return b; }
const over = (b) => sideEmpty(b, 0) || sideEmpty(b, 1);

// minimax with alpha-beta; value = (CPU store − your store) seen from side `me`
let nodes = 0;
function search(b, s, me, depth, a, bt) {
  nodes++;
  if (over(b)) { const f = sweep(b); return (f[storeOf(me)] - f[storeOf(1 - me)]) * 100; }
  if (depth <= 0 || nodes > 400000) return (b[storeOf(me)] - b[storeOf(1 - me)]) * 100 + (sideSum(b, me) - sideSum(b, 1 - me)) * 8;
  const ms = order(b, s); let best = s === me ? -1e9 : 1e9;
  for (const i of ms) {
    const r = play(b, s, i), ns = r.again ? s : 1 - s;
    const v = search(r.b, ns, me, depth - (r.again ? 0.5 : 1), a, bt);
    if (s === me) { if (v > best) best = v; if (best > a) a = best; } else { if (v < best) best = v; if (best < bt) bt = best; }
    if (a >= bt) break;
  }
  return best;
}
const sideSum = (b, s) => { let t = 0; for (let i = s ? 7 : 0, k = 0; k < 6; k++, i++) t += b[i]; return t; };
function order(b, s) {   // moves that end in the store first (better pruning)
  const st = storeOf(s);
  return moves(b, s).sort((x, y) => (b[x] % 13 === st - x ? -1 : 0) - (b[y] % 13 === st - y ? -1 : 0) || y - x);
}
function choose(b, s, depth, noise, r) {
  const ms = moves(b, s); if (ms.length === 1) return ms[0];
  nodes = 0;
  const scored = ms.map(i => { const p = play(b, s, i); return { i, v: search(p.b, p.again ? s : 1 - s, s, depth - 1, -1e9, 1e9) + (r() - 0.5) * noise }; });
  scored.sort((x, y) => y.v - x.v);
  return scored[0].i;
}

// ---------------------------------------------------------------- shell
let counts = [], turn = 0, rand = Math.random, firstSide = 0, undoStack = [], busy = false, sel = -1, preview = null, lastMove = -1;
let stones = [], geo = null, boardImg = null, glowT = 0, moveCount = 0;
const T = duel({
  key: 'pebblepit', name: NAME, brand: 'Pebblepit', kicker: 'Mancala vs computer', B,
  rule: 'Tap a pit to sow its pebbles. End in your store to go again, end in an empty pit of yours to capture.',
  accent: '#d9773a', bg: ['#f6f1e7', '#e9dcc6'], ink: '#3b2e25', winWord: 'You win!',
  buttons: [{ id: 'undo', label: 'Undo', svg: SVG.undo, onPress: () => undo() }],
  refresh() { T.setBtn('undo', { gone: T.diff !== 0, dim: !(undoStack.length > 1 && turn === 0 && !busy) }); },
  newGame({ seed, diff, fk, daily, games }) {
    rand = rngf(seed);
    counts = [PER, PER, PER, PER, PER, PER, 0, PER, PER, PER, PER, PER, PER, 0];
    firstSide = daily ? 0 : games % 2; turn = firstSide; undoStack = []; busy = false; sel = -1; preview = null; lastMove = -1; moveCount = 0;
    T.fk = fk;
    layStones(true);
    head();
    if (turn === 1) { T.status('Computer starts this game', 'CPU'); T.after(900, cpuTurn); } else yourTurn(true);
  },
  idle() { counts = [PER, PER, PER, PER, PER, PER, 0, PER, PER, PER, PER, PER, PER, 0]; layStones(true); head(); },
  layout(a) { layout(a); },
  draw, down, move: () => {}, up,
  frac: () => Math.min(1, counts[6] / 25),
  bot() {
    if (busy || turn !== 0) return;
    const i = choose(counts, 0, 7, 0, rand); if (i >= 0) sowFrom(i);
  },
  botSpeed: 0.28,
  debug: () => ({ counts: counts.slice(), turn, busy }),
});

// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): in the first game, until the first
// touch, your best opening pit lights up and sows itself around the board (one move; it doesn't count as you having played)
let demoing = false, demoPit = -1;
demo(n => {
  if (n === 1) { demoPit = choose(counts, 0, 5, 0, Math.random); if (demoPit < 0) return false; sel = demoPit; preview = play(counts, 0, demoPit); soft.click(); return; }
  if (sel !== demoPit) return false;
  demoing = true; sowFrom(demoPit); demoing = false; return false;
}, { ready: () => T.state === 'play' && T.wins === 0 && turn === 0 && !busy && moveCount === 0, wait: 1800, every: 1100, max: 2 });

function head() {
  T.header([{ name: 'You', init: 'Y', color: YOU, score: counts[6] }, { name: 'CPU', init: 'C', color: CPU, score: counts[13] }], T.state === 'play' ? turn : -1);
  T.score(counts[6]);
}
function yourTurn(first) {
  turn = 0; busy = false; head();
  if (sideEmpty(counts, 0)) return finish();
  undoStack.push({ counts: counts.slice(), moveCount });
  if (undoStack.length > 60) undoStack.shift();
  T.status(first ? 'You start · tap one of your pits' : 'Your turn', T.diffName.toUpperCase());
  T.refreshButtons();
}
function undo() {
  if (T.diff !== 0 || busy || turn !== 0 || undoStack.length < 2) { soft.err(); return; }
  undoStack.pop(); const s = undoStack[undoStack.length - 1];
  counts = s.counts.slice(); moveCount = s.moveCount; layStones(false); soft.click(); buzz(6); head(); T.status('Took back your move', 'UNDO'); T.refreshButtons();
}

// ---------------------------------------------------------------- geometry
function layout(a) {
  const p = Math.min(78, (a.h - 8) / 9.5, (a.w - 40) / 4.1);
  const bw = Math.min(a.w - 44, p * 4.4), bh = p * 9.3;
  const bx = a.x + (a.w - bw) / 2, by = a.y + Math.max(0, (a.h - bh) / 2);
  const pad = p * 0.28, colW = (bw - pad * 3) / 2, storeH = p * 1.32;
  const pit = [];
  const rowY = (r) => by + pad + storeH + p * 0.22 + (r + 0.5) * p;
  for (let r = 0; r < 6; r++) {
    pit[r] = { x: bx + pad + colW / 2, y: rowY(r), rx: colW / 2 - 2, ry: p * 0.41 };
    pit[12 - r] = { x: bx + pad * 2 + colW * 1.5, y: rowY(r), rx: colW / 2 - 2, ry: p * 0.41 };
  }
  pit[13] = { x: bx + bw / 2, y: by + pad + storeH / 2, rx: (bw - pad * 2) / 2, ry: storeH / 2, store: true };
  pit[6] = { x: bx + bw / 2, y: by + bh - pad - storeH / 2, rx: (bw - pad * 2) / 2, ry: storeH / 2, store: true };
  geo = { p, bw, bh, bx, by, pit, sr: Math.max(6, Math.min(11, p * 0.125)) };
  paintBoard();
  layStones(false);
}
function slotPos(i, k) {
  const P = geo.pit[i], cap = P.store ? 26 : 12, layer = Math.floor(k / cap), kk = k % cap;
  const h = (i * 7919 + k * 104729) % 1000 / 1000;
  const fr = Math.sqrt((kk + 0.5) / cap) * 0.78, ang = kk * 2.39996 + i * 1.3 + layer * 0.9;
  const sx = P.rx - geo.sr * 1.1, sy = P.ry - geo.sr * 1.0;
  return { x: P.x + Math.cos(ang) * fr * sx + (h - 0.5) * 2, y: P.y + Math.sin(ang) * fr * sy - layer * geo.sr * 0.45 };
}
let stoneId = 0;
function layStones(fresh) {
  if (!geo) return;
  if (fresh || stones.length !== counts.reduce((a, b) => a + b, 0)) {
    stones = []; stoneId = 0;
    for (let i = 0; i < 14; i++) for (let k = 0; k < counts[i]; k++) stones.push({ id: stoneId, c: stoneId++ % STONE.length, pit: i, slot: k, x: 0, y: 0, z: 0, s: 1 });
  } else {           // redistribute existing pebbles to match counts (undo / resize)
    const order = stones.slice().sort((a, b) => a.pit - b.pit || a.slot - b.slot); let n = 0;
    for (let i = 0; i < 14; i++) for (let k = 0; k < counts[i]; k++) { const s = order[n++]; s.pit = i; s.slot = k; }
  }
  for (const s of stones) { const q = slotPos(s.pit, s.slot); s.x = q.x; s.y = q.y; s.z = 0; s.s = 1; }
}

// ---------------------------------------------------------------- moves + animation
const inPit = (i) => stones.filter(s => s.pit === i);
function sowFrom(i) {
  if (busy || T.state !== 'play' || counts[i] === 0) return;
  const side = turn, res = play(counts, side, i);
  busy = true; sel = -1; preview = null; lastMove = i; moveCount++;
  if (side === 0 && !demoing) T.moved();
  T.refreshButtons();
  const hand = inPit(i).sort((a, b) => a.slot - b.slot); counts[i] = 0;
  const P = geo.pit[i];
  soft.wood(); buzz(6);
  // lift: gather the pebbles over the pit
  hand.forEach((s, k) => { const x0 = s.x, y0 = s.y, tx = P.x + (k % 3 - 1) * geo.sr * 0.9, ty = P.y - Math.floor(k / 3) * geo.sr * 0.5; s.pit = -1;
    T.anim(170, (q) => { const e = ease.out(q); s.x = x0 + (tx - x0) * e; s.y = y0 + (ty - y0) * e; s.z = e * 10; }); });
  const step = 150;
  res.path.forEach((j, k) => {
    T.after(190 + k * step, () => {
      const s = hand[k], x0 = s.x, y0 = s.y, slot = counts[j]; counts[j]++;
      s.pit = j; s.slot = slot; const q = slotPos(j, slot);
      const d = Math.hypot(q.x - x0, q.y - y0), hop = 14 + d * 0.18;
      T.anim(230, (t) => { const e = ease.inOut(t); s.x = x0 + (q.x - x0) * e; s.y = y0 + (q.y - y0) * e; s.z = Math.sin(Math.PI * t) * hop + (1 - t) * 10; s.s = 1 + Math.sin(Math.PI * t) * 0.15; },
        () => { s.z = 0; s.s = 1; tone(700 + k * 45, 0.04, 'sine', 0.07, 1.2); if (j === 6 || j === 13) { chime(k, 72, 0.06); head(); } });
    });
  });
  T.after(190 + res.path.length * step + 260, () => {
    if (res.cap) capture(side, res.last, res, () => afterMove(side, res));
    else afterMove(side, res);
  });
}
function capture(side, j, res, done) {
  const st = storeOf(side), opp = 12 - j, take = inPit(j).concat(inPit(opp));
  const P = geo.pit[opp];
  geo && T.fx.ring(P.x, P.y, side ? CPU : YOU, 40);
  T.ui.pop(side ? `CPU captures ${res.cap}` : `Capture +${res.cap}!`, side ? CPU : YOU, 30, 42);
  if (side === 0) { tone(330, 0.12, 'triangle', 0.12, 1.6); buzz([10, 30, 10]); } else tone(260, 0.14, 'triangle', 0.1, 0.8);
  counts[j] = 0; counts[opp] = 0;
  take.forEach((s, k) => {
    const x0 = s.x, y0 = s.y, slot = counts[st]++; s.pit = st; s.slot = slot; const q = slotPos(st, slot);
    T.anim(420 + k * 40, (t) => { const e = ease.inOut(t); s.x = x0 + (q.x - x0) * e; s.y = y0 + (q.y - y0) * e; s.z = Math.sin(Math.PI * t) * 30; });
  });
  T.after(520 + take.length * 40, () => { const S2 = geo.pit[st]; T.fx.sparks(S2.x, S2.y, ['#fff', side ? CPU : YOU, '#ffe08a'], 14, { speed: 3 }); head(); done(); });
}
function afterMove(side, res) {
  // the visual counts must now equal the rules result
  counts = res.b.slice(); busy = false; head();
  if (over(counts)) return finish();
  if (res.again) {
    T.ui.pop(side ? 'CPU goes again' : 'Go again!', side ? CPU : YOU, side ? 26 : 34, 42);
    if (side === 0) { note(76, 0.3, 0.1); note(83, 0.4, 0.08); }
    const S2 = geo.pit[storeOf(side)]; T.fx.sparks(S2.x, S2.y, ['#fff', '#ffe08a'], 10, { speed: 2.5 });
    if (side === 0) return yourTurn(false);
    T.status('Computer goes again…', 'CPU'); return T.after(650, cpuTurn);
  }
  if (side === 0) { turn = 1; head(); T.status('Computer is thinking…', 'CPU'); T.after(600, cpuTurn); }
  else yourTurn(false);
}
function cpuTurn() {
  if (T.state !== 'play') return;
  turn = 1; head();
  if (sideEmpty(counts, 1)) return finish();
  const d = T.diff, fk = T.fk || 1;
  // Easy: shallow look-ahead with a lot of noise. Normal: 4 plies. Hard: 8 plies. (fk widens or narrows the look-ahead.)
  const depth = d === 0 ? 1 : d === 1 ? Math.max(2, Math.round(4 * fk)) : Math.max(6, Math.round(8 * fk));
  const noise = d === 0 ? 900 : d === 1 ? 120 : 0;
  const i = choose(counts, 1, depth, noise, rand);
  sel = i; T.status('Computer plays', 'CPU');
  T.after(380, () => { sel = -1; sowFrom(i); });
}
function finish() {
  busy = true;
  // the side with pebbles left banks them
  const left = [];
  for (let i = 0; i < 13; i++) if (i !== 6 && counts[i] > 0) left.push(i);
  let delay = 0;
  if (left.length) {
    T.status('Board cleared · the rest go home', 'GAME OVER');
    left.forEach(i => {
      const st = i < 6 ? 6 : 13;
      inPit(i).forEach((s) => { const x0 = s.x, y0 = s.y, slot = counts[st]++; s.pit = st; s.slot = slot; const q = slotPos(st, slot);
        T.after(delay, () => T.anim(420, (t) => { const e = ease.inOut(t); s.x = x0 + (q.x - x0) * e; s.y = y0 + (q.y - y0) * e; s.z = Math.sin(Math.PI * t) * 24; }, () => tone(600, 0.03, 'sine', 0.05, 1.1)));
        delay += 45; });
      counts[i] = 0;
    });
  }
  T.after(delay + 600, () => {
    head();
    const me = counts[6], cpu = counts[13];
    const line = `${me} – ${cpu}${T.diff === 2 && me > cpu ? ' · Hard win counts 2' : ''}`;
    if (me > cpu) T.end('win', { line, margin: me - cpu });
    else if (me === cpu) T.end('draw', { line, frac: 0.5 });
    else T.end('lose', { line, frac: Math.min(1, me / 25) });
  });
}

// ---------------------------------------------------------------- input
function pitAt(x, y) {
  if (!geo) return -1;
  for (let i = 0; i < 14; i++) { if (i === 6 || i === 13) continue; const P = geo.pit[i]; if (Math.abs(x - P.x) <= P.rx + 6 && Math.abs(y - P.y) <= geo.p / 2) return i; }
  return -1;
}
function down(x, y) {
  if (busy || turn !== 0) return;
  const i = pitAt(x, y);
  if (i < 0) return;
  if (!own(0, i)) { T.toast('Your pits are the blue column on the left'); soft.err(); return; }
  if (!counts[i]) { soft.err(); T.toast('That pit is empty'); return; }
  sel = i; soft.click();
  preview = T.diff === 0 ? play(counts, 0, i) : null;
}
function up(x, y) {
  if (sel < 0 || busy || turn !== 0) { sel = -1; return; }
  const i = pitAt(x, y), s = sel; sel = -1;
  if (i === s) sowFrom(s); else preview = null;
}

// ---------------------------------------------------------------- drawing
function paintBoard() {
  const { bw, bh, bx, by, pit, p } = geo, dpr = Math.min(devicePixelRatio || 1, 2);
  const c = document.createElement('canvas'); c.width = (bw + 40) * dpr; c.height = (bh + 40) * dpr;
  const g = c.getContext('2d'); g.scale(dpr, dpr); g.translate(20 - bx, 20 - by);
  // board body
  g.save(); g.shadowColor = 'rgba(70,40,15,.35)'; g.shadowBlur = 22; g.shadowOffsetY = 10;
  rrect(g, bx, by, bw, bh, p * 0.55); const wood = g.createLinearGradient(bx, by, bx + bw, by + bh);
  wood.addColorStop(0, '#d9a066'); wood.addColorStop(0.5, '#c88a52'); wood.addColorStop(1, '#b0733f'); g.fillStyle = wood; g.fill(); g.restore();
  // grain
  g.save(); rrect(g, bx, by, bw, bh, p * 0.55); g.clip();
  const r = rngf(11);
  for (let k = 0; k < 26; k++) {
    const x = bx + r() * bw; g.strokeStyle = `rgba(110,60,25,${0.05 + r() * 0.07})`; g.lineWidth = 1 + r() * 1.6;
    g.beginPath(); g.moveTo(x, by - 10); for (let y = by; y <= by + bh + 10; y += 30) g.lineTo(x + Math.sin(y * 0.02 + k) * (4 + r() * 6), y); g.stroke();
  }
  g.strokeStyle = 'rgba(255,240,215,.45)'; g.lineWidth = 3; rrect(g, bx + 2, by + 2, bw - 4, bh - 4, p * 0.53); g.stroke();
  g.restore();
  // pits + stores
  for (let i = 0; i < 14; i++) {
    const P = pit[i];
    g.save();
    if (P.store) rrect(g, P.x - P.rx, P.y - P.ry, P.rx * 2, P.ry * 2, P.ry); else { g.beginPath(); g.ellipse(P.x, P.y, P.rx, P.ry, 0, 0, 7); }
    const gr = g.createRadialGradient(P.x, P.y + P.ry * 0.5, 2, P.x, P.y, Math.max(P.rx, P.ry) * 1.1);
    gr.addColorStop(0, '#8a5129'); gr.addColorStop(1, '#5e3215'); g.fillStyle = gr; g.fill();
    g.clip(); g.strokeStyle = 'rgba(30,12,0,.45)'; g.lineWidth = 10; g.stroke();   // inner shadow
    g.restore();
    g.save();
    if (P.store) rrect(g, P.x - P.rx, P.y - P.ry, P.rx * 2, P.ry * 2, P.ry); else { g.beginPath(); g.ellipse(P.x, P.y, P.rx, P.ry, 0, 0, 7); }
    g.strokeStyle = i === 6 || own(0, i) ? 'rgba(120,170,255,.55)' : 'rgba(255,140,130,.5)'; g.lineWidth = 2; g.stroke();
    g.restore();
  }
  // engraved store words + direction marks
  g.font = `800 ${Math.round(p * 0.22)}px -apple-system,system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(255,230,200,.16)';
  g.fillText('Y O U R   S T O R E', pit[6].x, pit[6].y); g.fillText('C P U   S T O R E', pit[13].x, pit[13].y);
  g.fillStyle = 'rgba(255,235,210,.35)';
  const midX = bx + bw / 2;
  for (let r = 0; r < 6; r++) {
    const y = pit[r].y;
    tri(g, midX - p * 0.06, y, p * 0.07, 1); tri(g, midX + p * 0.06, y, p * 0.07, -1);
  }
  boardImg = { c, x: bx - 20, y: by - 20, w: bw + 40, h: bh + 40 };
}
function tri(g, x, y, s, dir) { g.beginPath(); g.moveTo(x - s, y - s * 0.5 * dir); g.lineTo(x + s, y - s * 0.5 * dir); g.lineTo(x, y + s * 0.7 * dir); g.closePath(); g.fill(); }
const sprites = {};
function stoneSprite(c, r) {
  const k = c + ':' + r; if (sprites[k]) return sprites[k];
  const dpr = Math.min(devicePixelRatio || 1, 2), s = Math.ceil(r * 2 + 4), cv = document.createElement('canvas'); cv.width = s * dpr; cv.height = s * dpr;
  const g = cv.getContext('2d'); g.scale(dpr, dpr); const m = s / 2;
  const gr = g.createRadialGradient(m - r * 0.35, m - r * 0.4, r * 0.1, m, m, r);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, STONE[c]); gr.addColorStop(1, shade(STONE[c], -0.35));
  g.fillStyle = gr; g.beginPath(); g.ellipse(m, m, r, r * 0.92, 0, 0, 7); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(m - r * 0.3, m - r * 0.38, r * 0.28, r * 0.17, -0.5, 0, 7); g.fill();
  return (sprites[k] = { cv, s });
}
function shade(hex, f) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const t = f < 0 ? 0 : 255, a = Math.abs(f); r = Math.round(r + (t - r) * a); g = Math.round(g + (t - g) * a); b = Math.round(b + (t - b) * a); return `rgb(${r},${g},${b})`; }

function draw(g, t) {
  if (!geo) return;
  const { pit, p, sr } = geo;
  g.drawImage(boardImg.c, boardImg.x, boardImg.y, boardImg.w, boardImg.h);
  const myTurn = T.state === 'play' && turn === 0 && !busy;
  // highlights
  for (let i = 0; i < 14; i++) {
    if (i === 6 || i === 13) continue; const P = pit[i];
    const legal = myTurn && own(0, i) && counts[i] > 0;
    if (legal || i === sel || (i === lastMove && busy)) {
      g.save(); g.beginPath(); g.ellipse(P.x, P.y, P.rx + 3, P.ry + 3, 0, 0, 7);
      const pulse = 0.45 + 0.3 * Math.sin(t * 4 + i);
      g.strokeStyle = i === sel ? '#fff7d6' : own(0, i) ? `rgba(130,190,255,${pulse})` : `rgba(255,150,140,.8)`; g.lineWidth = i === sel ? 4 : 3; g.stroke(); g.restore();
    }
  }
  if (preview && sel >= 0) {
    const P = pit[preview.last]; g.save(); g.setLineDash([5, 5]); g.strokeStyle = '#fff7d6'; g.lineWidth = 2.5;
    if (P.store) rrect(g, P.x - P.rx + 4, P.y - P.ry + 4, P.rx * 2 - 8, P.ry * 2 - 8, P.ry - 4); else { g.beginPath(); g.ellipse(P.x, P.y, P.rx - 4, P.ry - 4, 0, 0, 7); }
    g.stroke(); g.restore();
    g.font = '700 12px -apple-system,system-ui,sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fff7d6';
    if (preview.again) g.fillText('lands in your store: go again', P.x, P.y - P.ry - 8);
    else if (preview.cap) g.fillText(`captures ${preview.cap}`, P.x, P.y + P.ry + 13);
  }
  // pebbles: shadows then bodies, lifted ones last
  const list = stones.slice().sort((a, b) => a.z - b.z || a.y - b.y);
  for (const s of list) { g.fillStyle = `rgba(30,10,0,${0.28 - Math.min(0.18, s.z * 0.006)})`; g.beginPath(); g.ellipse(s.x + 1, s.y + sr * 0.55, sr * 0.9, sr * 0.38, 0, 0, 7); g.fill(); }
  for (const s of list) { const sp = stoneSprite(s.c, sr), w = sp.s * s.s; g.drawImage(sp.cv, s.x - w / 2, s.y - s.z - w / 2, w, w); }
  // counts: pills outside the board next to each pit, big numbers on the stores
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < 14; i++) {
    const P = pit[i];
    if (P.store) {
      g.font = `800 ${Math.round(p * 0.36)}px -apple-system,system-ui,sans-serif`; g.fillStyle = 'rgba(255,248,235,.92)';
      g.fillText(counts[i], P.x + P.rx - p * 0.42, P.y);
      continue;
    }
    const left = own(0, i), x = left ? geo.bx - 13 : geo.bx + geo.bw + 13;
    g.fillStyle = counts[i] ? (left ? YOU : CPU) : 'rgba(80,60,40,.25)';
    g.beginPath(); g.arc(x, P.y, 11, 0, 7); g.fill();
    g.font = '800 12px -apple-system,system-ui,sans-serif'; g.fillStyle = '#fff'; g.fillText(counts[i], x, P.y + 0.5);
  }
}

T.start();
