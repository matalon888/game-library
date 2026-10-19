// Pipsnake — the classic draw game of dominoes (public-domain double-six rules), you vs one to three computer players.
// Match a tile to either open end of the line; if you can't, draw from the boneyard until you can (or pass when it's
// empty). Go out first and score every pip left in the other hands; a blocked hand goes to the lightest hand.
// First to 50 points wins the match. Computer players only know their own tiles, the table, and who drew or passed.
import { board } from './kit/board.js';
import { store } from './kit/hc.js';
import { duel, rngf, fair, shuffle, rrect, ease, SVG, buzz, tone, note, soft, chime } from './duel.js';

const NAME = 'Pipsnake: Dominoes vs Computer';
const B = board({ game: 'pipsnake', label: 'Matches won vs CPU (Hard counts 2)', limits: { maxRun: 2, maxPerSec: 0.1 }, mode: 'sum', corner: 'tl' });
const TARGET = 50;
const SEATS = [
  { name: 'You', init: 'Y', color: '#3f7fd8' },
  { name: 'Rio', init: 'R', color: '#e0605a' },
  { name: 'Juno', init: 'J', color: '#3aa875' },
  { name: 'Kip', init: 'K', color: '#9a6fd8' },
];
const TILES = []; for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) TILES.push({ id: TILES.length, a, b });
const pips = (t) => t.a + t.b;
const isD = (t) => t.a === t.b;
const S0 = store('pipsnake');
let rivals = S0.get('rivals', 1);

// ---------------------------------------------------------------- state
let NP = 2, hands = [], bone = [], line = [], leftCount = 0, turn = 0, scores = [], handNo = 0, passes = 0, rand = fair, dealR = fair, seed0 = 1;
let busy = false, sel = -1, lacks = [], vis = {}, layoutInfo = null, geo = null, ended = false, msg = '', reveal = false, lastPlayed = -1;
const T = duel({
  key: 'pipsnake', name: NAME, brand: 'Pipsnake', kicker: 'Dominoes vs computer', B,
  rule: 'Match either end of the line. No match? Draw. Go out first to score the pips left in the other hands. First to 50 wins.',
  accent: '#2f8f7a', bg: ['#f3efe4', '#dfe9df'], ink: '#24332e', winWord: 'Match won!',
  dailyBtn: true, dailyLine: 'Same tiles for everyone today',
  chips2: { label: 'Rivals', items: ['1 CPU', '2 CPUs', '3 CPUs'], get: () => rivals - 1, set: (i) => { rivals = i + 1; S0.set('rivals', rivals); } },
  buttons: [{ id: 'draw', label: 'Draw', svg: SVG.draw, onPress: () => youDraw() }],
  refresh() {
    const can = T.state === 'play' && hands[0] && turn === 0 && !busy && !ended && !playable(0).length && bone.length > 0;
    T.setBtn('draw', { dim: !can, go: can, label: `Draw · ${bone.length}` });
  },
  newGame({ seed, daily }) {
    seed0 = seed; NP = (daily ? 1 : rivals) + 1; scores = new Array(NP).fill(0); handNo = 0;
    rand = rngf(seed + 5);
    dealHand();
  },
  idle() { NP = rivals + 1; scores = new Array(NP).fill(0); dealR = rngf(3); deal(); head(); },
  layout: (a) => { geo = a; relayout(); },
  draw, down, up,
  frac: () => Math.min(1, scores[0] / TARGET),
  bot() {
    if (busy || turn !== 0 || ended) return;
    const opts = options(0);
    if (!opts.length) { if (bone.length) youDraw(); return; }
    const o = choose(0, opts, 2); play(0, o.t, o.side);
  },
  botSpeed: 0.05,
  debug: () => ({ NP, hands: hands.map(h => h.length), bone: bone.length, line: line.length, scores: scores.slice(), turn, busy }),
});

// ---------------------------------------------------------------- deal + rules
function deal() {
  const ids = shuffle(TILES.map(t => t.id), dealR);
  const per = NP === 2 ? 7 : 5;
  hands = []; for (let p = 0; p < NP; p++) hands.push(ids.splice(0, per));
  bone = ids; line = []; leftCount = 0; passes = 0; lacks = []; for (let p = 0; p < NP; p++) lacks.push(new Set());
  vis = {}; ended = false; reveal = false; sel = -1; lastPlayed = -1;
  hands[0].sort((x, y) => TILES[x].a - TILES[y].a || TILES[x].b - TILES[y].b);
  relayout(true);
}
function dealHand() {
  handNo++;
  dealR = T.D.seed ? rngf(seed0 * 13 + handNo * 101) : fair;
  deal();
  // the highest double opens; with no double out, the heaviest tile
  let best = null;
  for (let p = 0; p < NP; p++) for (const id of hands[p]) { const t = TILES[id], v = isD(t) ? 100 + t.a : pips(t); if (!best || v > best.v) best = { p, id, v }; }
  head(); T.refreshButtons();
  busy = true;
  T.status(`Hand ${handNo} · ${SEATS[best.p].name} ${best.p ? 'opens' : 'open'} with ${TILES[best.id].a}–${TILES[best.id].b}`, `FIRST TO ${TARGET}`);
  T.after(1000, () => { busy = false; play(best.p, best.id, 'R', true); });
}
const ends = () => line.length ? [line[0].a, line[line.length - 1].b] : null;
const fitsSide = (t, side) => { const e = ends(); if (!e) return true; const v = side === 'L' ? e[0] : e[1]; return t.a === v || t.b === v; };
function options(p) {
  const o = [];
  for (const id of hands[p]) { const t = TILES[id]; if (!line.length) { o.push({ t: id, side: 'R' }); continue; }
    if (fitsSide(t, 'L')) o.push({ t: id, side: 'L' });
    if (fitsSide(t, 'R')) { const e = ends(); if (!(fitsSide(t, 'L') && e[0] === e[1])) o.push({ t: id, side: 'R' }); } }
  return o;
}
const playable = (p) => [...new Set(options(p).map(o => o.t))];
const handPips = (p) => hands[p].reduce((a, id) => a + pips(TILES[id]), 0);

// computer choices: Easy any tile, Normal the heaviest, Hard keeps variety and blocks numbers a rival is known to lack
function choose(p, opts, level) {
  const pick = (a) => a[Math.floor(rand() * a.length)];
  if (level === 0) return pick(opts);
  const score = (o) => {
    const t = TILES[o.t]; let v = pips(t) + (isD(t) ? 3 : 0);
    if (level === 2) {
      const e = ends(), ne = e ? (o.side === 'L' ? [t.a === e[0] ? t.b : t.a, e[1]] : [e[0], t.a === e[1] ? t.b : t.a]) : [t.a, t.b];
      const rest = hands[p].filter(id => id !== o.t);
      v += rest.filter(id => { const u = TILES[id]; return ne.includes(u.a) || ne.includes(u.b); }).length * 2.5;   // I can still follow
      const nx = (p + 1) % NP;
      if (lacks[nx].has(ne[0]) && lacks[nx].has(ne[1])) v += 6;              // the next player is known to be stuck on both ends
      for (let q = 0; q < NP; q++) if (q !== p && hands[q].length <= 2 && ne.every(x => lacks[q].has(x))) v += 4;
    }
    return v + rand() * 0.5;
  };
  return opts.reduce((a, b) => score(b) > score(a) ? b : a);
}

// ---------------------------------------------------------------- turns
function head() {
  T.header(SEATS.slice(0, NP).map((s, i) => ({ ...s, score: scores[i] || 0 })), T.state === 'play' && !ended ? turn : -1);
  T.score(scores[0] || 0);
}
function play(p, id, side, opening = false) {
  if (T.state !== 'play' || ended) return;
  const t = TILES[id];
  if (line.length && !fitsSide(t, side)) return;
  hands[p] = hands[p].filter(x => x !== id); sel = -1; lastPlayed = id;
  if (!line.length) line.push({ id, a: t.a, b: t.b });
  else if (side === 'R') { const e = line[line.length - 1].b; line.push(t.a === e ? { id, a: t.a, b: t.b } : { id, a: t.b, b: t.a }); }
  else { const e = line[0].a; line.unshift(t.b === e ? { id, a: t.a, b: t.b } : { id, a: t.b, b: t.a }); leftCount++; }
  lacks[p].delete(t.a); lacks[p].delete(t.b);
  passes = 0;
  if (p === 0 && !opening) T.moved();
  relayout();
  tone(p === 0 ? 300 : 260, 0.06, 'triangle', 0.12, 0.7); tone(1500, 0.02, 'square', 0.03, 0.8); buzz(p === 0 ? 8 : 0);
  const e = ends();
  if (line.length > 1 && (e[0] + e[1]) % 5 === 0 && p === 0) chime(3, 72, 0.06);
  if (!hands[p].length) { busy = true; return T.after(500, () => endHand(p, 'domino')); }
  next(p);
}
function next(p) {
  busy = true; head();
  T.after(p === 0 ? 450 : 520, () => { turn = (p + 1) % NP; busy = false; head(); startTurn(); });
}
function startTurn() {
  if (ended || T.state !== 'play') return;
  head(); T.refreshButtons();
  if (turn === 0) {
    const can = playable(0).length;
    if (can) T.status('Your turn · tap a glowing tile', T.diffName.toUpperCase());
    else if (bone.length) { T.status('No match · draw from the boneyard', 'YOUR TURN'); }
    else { T.status('No match and the boneyard is empty · you pass', 'YOUR TURN'); busy = true; T.after(1100, () => { busy = false; pass(0); }); }
    return;
  }
  busy = true;
  T.status(`${SEATS[turn].name} is thinking…`, 'CPU');
  T.after(650, () => cpuStep(turn));
}
function cpuStep(p) {
  if (ended || T.state !== 'play' || turn !== p) return;
  const opts = options(p);
  if (opts.length) { busy = false; const o = choose(p, opts, T.diff); return play(p, o.t, o.side); }
  if (bone.length) { draw1(p); T.status(`${SEATS[p].name} draws…`, 'CPU'); return T.after(330, () => cpuStep(p)); }
  busy = false; pass(p);
}
function draw1(p) {
  const id = bone.pop(); const e = ends(); if (e) { lacks[p].add(e[0]); lacks[p].add(e[1]); }
  hands[p].push(id);
  if (p === 0) { hands[0].sort((x, y) => TILES[x].a - TILES[y].a || TILES[x].b - TILES[y].b); soft.wood(); buzz(5); } else tone(900, 0.03, 'sine', 0.04, 0.8);
  vis[id] = vis[id] || boneVis();
  relayout(); T.refreshButtons();
  return id;
}
function youDraw() {
  if (busy || turn !== 0 || ended || playable(0).length || !bone.length) { if (turn === 0 && playable(0).length) { soft.err(); T.toast('You have a tile that fits'); } return; }
  T.moved();
  const id = draw1(0);
  if (playable(0).includes(id)) T.status('That one fits · tap it', 'YOUR TURN');
  else if (!bone.length) { T.status('Still no match · you pass', 'YOUR TURN'); busy = true; T.after(900, () => { busy = false; pass(0); }); }
  head(); T.refreshButtons();
}
function pass(p) {
  const e = ends(); if (e) { lacks[p].add(e[0]); lacks[p].add(e[1]); }
  passes++; T.toast(`${SEATS[p].name} ${p ? 'passes' : 'pass'}`, 900);
  if (passes >= NP) return endHand(-1, 'blocked');
  next(p);
}
function endHand(winner, why) {
  ended = true; busy = true; reveal = true; relayout(); head(); T.refreshButtons();
  let pts = 0, line2 = '';
  if (why === 'blocked') {
    const tot = hands.map((h, p) => handPips(p)), low = Math.min(...tot), who = tot.map((v, p) => v === low ? p : -1).filter(p => p >= 0);
    if (who.length === 1) { winner = who[0]; pts = tot.reduce((a, b) => a + b, 0) - low; }
    line2 = 'Blocked! ' + (winner >= 0 ? `${SEATS[winner].name} ${winner ? 'has' : 'have'} the lightest hand` : 'Tied lightest hands · no score');
  } else { pts = hands.reduce((a, h, p) => a + handPips(p), 0); line2 = `${SEATS[winner].name} ${winner ? 'goes' : 'go'} out!`; }
  if (winner >= 0) scores[winner] += pts;
  head();
  T.status(winner >= 0 ? `${line2} +${pts}` : line2, `HAND ${handNo}`);
  if (winner === 0) { T.ui.pop(`+${pts}`, SEATS[0].color, 44, 40); chime(4, 72, 0.12); setTimeout(() => chime(7, 72, 0.1), 140); T.fx.sparks(T.W / 2, T.H * 0.42, ['#fff', '#ffe08a', SEATS[0].color], 18, { speed: 3.4 }); buzz([15, 40, 15]); }
  else if (winner > 0) { T.ui.pop(`${SEATS[winner].name} +${pts}`, SEATS[winner].color, 30, 40); soft.err(); }
  const top = Math.max(...scores), leaders = scores.map((s, p) => s === top ? p : -1).filter(p => p >= 0);
  T.after(T.bot ? 600 : 2600, () => {
    if (top >= TARGET && leaders.length === 1) {
      const w = leaders[0], others = scores.filter((_, p) => p !== 0), line = SEATS.slice(0, NP).map((s, p) => `${s.name} ${scores[p]}`).join(' · ');
      if (w === 0) T.end('win', { line: line + (T.diff === 2 ? ' · Hard win counts 2' : ''), margin: scores[0] - Math.max(...others) });
      else T.end('lose', { line, frac: scores[0] / TARGET, title: `${SEATS[w].name} wins` });
      return;
    }
    turn = 0; dealHand();
  });
}

// ---------------------------------------------------------------- layout: the snake of tiles
function snake(X) {
  const pos = {}; if (!line.length) return { pos, minX: 0, maxX: 0, minY: 0, maxY: 0 };
  const st = line[leftCount], sd = st.a === st.b;
  pos[st.id] = { x: 0, y: 0, v: sd, A: st.a, B: st.b, far: { L: [sd ? -0.5 : -1, 0], R: [sd ? 0.5 : 1, 0] } };
  const branch = (list, dir, s) => {
    let x = (sd ? 0.5 : 1) * dir, y = 0, prevD = sd;
    for (const t of list) {
      const d = t.a === t.b;
      const nv = t.near, fv = t.farv;
      if (!d && (x + dir * 2) * dir > X) {          // turn the corner: one tile upright under / over the row end
        const top = prevD ? 1 : 0.5, cx = x - dir * 0.5, cy = y + s * (top + 1);
        pos[t.id] = { x: cx, y: cy, v: true, A: s > 0 ? nv : fv, B: s > 0 ? fv : nv, end: [cx, y + s * (top + 1.5)] };
        y = y + s * (top + 1.5); x = x - dir; dir = -dir; prevD = false; continue;
      }
      if (d) { pos[t.id] = { x: x + dir * 0.5, y, v: true, A: nv, B: fv, end: [x + dir * 0.5, y] }; x += dir; }
      else { pos[t.id] = { x: x + dir, y, v: false, A: dir > 0 ? nv : fv, B: dir > 0 ? fv : nv, end: [x + dir * 1.5, y] }; x += dir * 2; }
      prevD = d;
    }
  };
  branch(line.slice(leftCount + 1).map(t => ({ id: t.id, a: t.a, b: t.b, near: t.a, farv: t.b })), 1, 1);
  branch(line.slice(0, leftCount).reverse().map(t => ({ id: t.id, a: t.a, b: t.b, near: t.b, farv: t.a })), -1, -1);
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (const k in pos) { const p = pos[k], hw = p.v ? 0.5 : 1, hh = p.v ? 1 : 0.5; minX = Math.min(minX, p.x - hw); maxX = Math.max(maxX, p.x + hw); minY = Math.min(minY, p.y - hh); maxY = Math.max(maxY, p.y + hh); }
  return { pos, minX, maxX, minY, maxY };
}
function regions() {
  const a = geo; if (!a) return null;
  const handH = Math.min(200, Math.max(120, a.h * 0.26));
  const cpuH = 46;
  return { cpu: { x: a.x, y: a.y, w: a.w, h: cpuH }, table: { x: a.x + 4, y: a.y + cpuH + 6, w: a.w - 8, h: a.h - cpuH - handH - 14 }, hand: { x: a.x, y: a.y + a.h - handH, w: a.w, h: handH } };
}
function boneVis() { const a = geo || { x: 0, y: 0, w: 390, h: 600 }; return { x: a.x + a.w - 30, y: a.y + a.h + 40, ang: 0, u: 10, face: false, tx: 0, ty: 0, ta: 0, tu: 10, tface: false }; }
function relayout(snap = false) {
  const R = regions(); if (!R) return;
  // table: largest unit size whose snake fits
  let u = 34, L = null;
  for (; u >= 9; u -= 1) { const X = (R.table.w / u) / 2 - 0.3; L = snake(X); if ((L.maxY - L.minY) * u <= R.table.h - 10 && (L.maxX - L.minX) * u <= R.table.w) break; }
  const cx = R.table.x + R.table.w / 2 - ((L.maxX + L.minX) / 2) * u, cy = R.table.y + R.table.h / 2 - ((L.maxY + L.minY) / 2) * u;
  layoutInfo = { u, cx, cy, L };
  const set = (id, x, y, ang, uu, face, A, B) => {
    let v = vis[id]; if (!v) v = vis[id] = { x, y, ang, u: uu, face, A, B };
    Object.assign(v, { tx: x, ty: y, ta: ang, tu: uu, tface: face, A: A ?? v.A, B: B ?? v.B });
    if (snap) Object.assign(v, { x, y, ang, u: uu, face });
  };
  for (const k in L.pos) { const p = L.pos[k]; set(+k, cx + p.x * u, cy + p.y * u, p.v ? Math.PI / 2 : 0, u, true, p.A, p.B); }
  // your hand: upright tiles in one or two rows
  const n = hands[0] ? hands[0].length : 0, H = R.hand;
  const rows = n > 9 ? 2 : 1, perRow = Math.ceil(n / rows) || 1;
  const hu = Math.max(13, Math.min(34, (H.w - 16) / perRow / 1.18, (H.h - 34) / rows / 2.15));
  (hands[0] || []).forEach((id, i) => {
    const r = Math.floor(i / perRow), c = i % perRow, inRow = Math.min(perRow, n - r * perRow);
    const x = H.x + H.w / 2 + (c - (inRow - 1) / 2) * hu * 1.18, y = H.y + 30 + hu + r * hu * 2.15;
    const t = TILES[id]; set(id, x, y, Math.PI / 2, hu, true, t.a, t.b);
  });
  // computer hands: small backs (face up once the hand is over)
  const C = R.cpu, groups = NP - 1;
  for (let p = 1; p < NP && hands[p]; p++) {
    const gw = C.w / groups, gx = C.x + gw * (p - 1) + gw / 2, m = hands[p].length, su = Math.min(9, (gw - 50) / Math.max(1, m) / 1.15);
    hands[p].forEach((id, i) => { const t = TILES[id]; set(id, gx + 18 + (i - (m - 1) / 2) * su * 1.15, C.y + C.h / 2 + 2, Math.PI / 2, reveal ? Math.max(su, 7) : su, reveal, t.a, t.b); });
  }
  for (const id of bone) { if (!vis[id]) vis[id] = boneVis(); Object.assign(vis[id], { tx: R.hand.x + R.hand.w + 40, ty: R.hand.y, tface: false }); }
}

// ---------------------------------------------------------------- input
function hit(x, y) {
  const R = regions(); if (!R || !hands[0]) return -1;
  for (const id of hands[0]) { const v = vis[id]; if (Math.abs(x - v.tx) <= v.tu * 0.6 && Math.abs(y - v.ty) <= v.tu * 1.05) return id; }
  return -1;
}
function endMarkers() {
  if (!layoutInfo || !line.length) return null;
  const { u, cx, cy, L } = layoutInfo, a = line[0], b = line[line.length - 1];
  const pa = L.pos[a.id], pb = L.pos[b.id];
  if (line.length === 1) { const f = pa.far; return { L: [cx + (pa.x + f.L[0]) * u - (pa.v ? u * 0.6 : u * 0.6), cy + pa.y * u], R: [cx + (pa.x + f.R[0]) * u + u * 0.6, cy + pa.y * u] }; }
  return { L: [cx + pa.end[0] * u, cy + pa.end[1] * u], R: [cx + pb.end[0] * u, cy + pb.end[1] * u] };
}
let pressed = -1;
function down(x, y) {
  if (busy || turn !== 0 || ended) return;
  if (sel >= 0) {
    const m = endMarkers(); if (m) for (const side of ['L', 'R']) { const [mx, my] = m[side]; if (Math.hypot(x - mx, y - my) < Math.max(30, layoutInfo.u * 1.3)) { const id = sel; sel = -1; return play(0, id, side); } }
  }
  pressed = hit(x, y);
  if (pressed < 0) { sel = -1; return; }
}
function up(x, y) {
  if (pressed < 0 || busy || turn !== 0 || ended) { pressed = -1; return; }
  const id = pressed; pressed = -1; if (hit(x, y) !== id) return;
  const o = options(0).filter(o => o.t === id);
  if (!o.length) { soft.err(); vis[id].shake = performance.now(); T.toast(playable(0).length ? 'That tile doesn’t fit an end' : bone.length ? 'No match · tap Draw' : 'No match'); return; }
  const e = ends();
  if (o.length === 1 || (e && e[0] === e[1])) return play(0, id, o[o.length - 1].side);
  sel = sel === id ? -1 : id; soft.click();
  if (sel >= 0) T.status('Tap the end where it goes', 'YOUR TURN');
}

// ---------------------------------------------------------------- drawing
const PIPS = { 0: [], 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
function tile(g, v, t) {
  const u = v.u, w = 2 * u, h = u;
  g.save(); g.translate(v.x, v.y - (v.lift || 0)); g.rotate(v.ang);
  if (v.shake) { const k = (performance.now() - v.shake) / 300; if (k < 1) g.translate(Math.sin(k * 30) * 4 * (1 - k), 0); }
  g.shadowColor = 'rgba(20,40,30,.28)'; g.shadowBlur = Math.max(2, u * 0.25); g.shadowOffsetY = Math.max(1, u * 0.08);
  rrect(g, -w / 2, -h / 2, w, h, u * 0.18);
  if (v.face) { const gr = g.createLinearGradient(0, -h / 2, 0, h / 2); gr.addColorStop(0, '#fffdf6'); gr.addColorStop(1, '#ece5d4'); g.fillStyle = gr; }
  else { const gr = g.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); gr.addColorStop(0, '#2f9a82'); gr.addColorStop(1, '#1f6e5c'); g.fillStyle = gr; }
  g.fill(); g.shadowColor = 'transparent';
  g.lineWidth = Math.max(0.8, u * 0.05); g.strokeStyle = v.face ? 'rgba(80,70,50,.35)' : 'rgba(255,255,255,.55)'; g.stroke();
  if (v.glow) { g.lineWidth = 3; g.strokeStyle = v.glow; rrect(g, -w / 2 - 2.5, -h / 2 - 2.5, w + 5, h + 5, u * 0.22); g.stroke(); }
  if (v.face) {
    g.strokeStyle = 'rgba(80,70,50,.35)'; g.lineWidth = Math.max(0.8, u * 0.06); g.beginPath(); g.moveTo(0, -h / 2 + u * 0.14); g.lineTo(0, h / 2 - u * 0.14); g.stroke();
    if (u > 10) { g.fillStyle = '#c9a24a'; g.beginPath(); g.arc(0, 0, u * 0.07, 0, 7); g.fill(); }
    const pr = Math.max(0.9, u * 0.085), sp = u * 0.25;
    for (const [half, val] of [[-1, v.A], [1, v.B]]) {
      g.fillStyle = '#26302c';
      for (const [px, py] of PIPS[val] || []) { g.beginPath(); g.arc(half * u / 2 + py * sp, px * sp, pr, 0, 7); g.fill(); }
    }
  } else {
    g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1; rrect(g, -w / 2 + u * 0.15, -h / 2 + u * 0.15, w - u * 0.3, h - u * 0.3, u * 0.1); g.stroke();
    if (u > 6) { g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(0, 0, u * 0.12, 0, 7); g.fill(); }
  }
  g.restore();
}
function draw(g, t) {
  const R = regions(); if (!R) return;
  // felt table
  const tb = R.table;
  g.save(); g.shadowColor = 'rgba(30,60,45,.25)'; g.shadowBlur = 20; g.shadowOffsetY = 6;
  rrect(g, tb.x - 4, tb.y - 4, tb.w + 8, tb.h + 8, 22); const fg = g.createRadialGradient(tb.x + tb.w / 2, tb.y + tb.h * 0.4, 20, tb.x + tb.w / 2, tb.y + tb.h / 2, tb.w * 0.8);
  fg.addColorStop(0, '#3f9c7e'); fg.addColorStop(1, '#2a7560'); g.fillStyle = fg; g.fill(); g.restore();
  g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 2; rrect(g, tb.x + 6, tb.y + 6, tb.w - 12, tb.h - 12, 17); g.stroke();
  if (!line.length) { g.fillStyle = 'rgba(255,255,255,.35)'; g.font = '700 15px -apple-system,system-ui,sans-serif'; g.textAlign = 'center'; g.fillText('Highest double opens', tb.x + tb.w / 2, tb.y + tb.h / 2); }
  // ends readout
  const e = ends();
  if (e) { g.fillStyle = 'rgba(255,255,255,.65)'; g.font = '700 11px -apple-system,system-ui,sans-serif'; g.textAlign = 'left'; g.fillText(`ENDS  ${e[0]} · ${e[1]}`, tb.x + 14, tb.y + tb.h - 12); g.textAlign = 'right'; g.fillText(`BONEYARD  ${bone.length}`, tb.x + tb.w - 14, tb.y + tb.h - 12); }
  // computer seats
  const C = R.cpu;
  for (let p = 1; p < NP; p++) {
    const gw = C.w / (NP - 1), gx = C.x + gw * (p - 1) + gw / 2, m = hands[p] ? hands[p].length : 0, on = turn === p && !ended && T.state === 'play';
    const span = Math.min(gw - 8, 60 + m * 10.5);
    g.fillStyle = on ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.6)'; rrect(g, gx - span / 2 - 4, C.y + 4, span + 8, C.h - 6, 16); g.fill();
    if (on) { g.strokeStyle = SEATS[p].color; g.lineWidth = 2; g.stroke(); }
    const ax = gx - span / 2 + 14; g.fillStyle = SEATS[p].color; g.beginPath(); g.arc(ax, C.y + C.h / 2 + 1, 11, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.font = '800 11px -apple-system,system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(SEATS[p].init, ax, C.y + C.h / 2 + 1.5);
    g.textBaseline = 'alphabetic';
  }
  // tiles: ease toward their targets
  const ids = Object.keys(vis).map(Number);
  const playables = turn === 0 && !busy && !ended && T.state === 'play' ? new Set(playable(0)) : new Set();
  const order = ids.sort((a, b) => (vis[a].u - vis[b].u));
  for (const id of order) {
    const v = vis[id], k = Math.min(1, 0.2 / Math.max(0.3, T.speed));
    v.x += (v.tx - v.x) * k; v.y += (v.ty - v.y) * k; v.u += (v.tu - v.u) * k;
    let da = v.ta - v.ang; v.ang += da * k; v.face = v.tface;
    const inHand = hands[0] && hands[0].includes(id);
    v.glow = inHand && id === sel ? '#ffd25a' : inHand && playables.has(id) ? `rgba(255,210,90,${0.55 + 0.35 * Math.sin(t * 5)})` : (id === lastPlayed && !inHand && line.some(l => l.id === id) ? 'rgba(255,255,255,.55)' : null);
    v.lift = inHand ? (id === sel ? 12 : playables.has(id) ? 5 : 0) : 0;
    if (inHand && playables.size && !playables.has(id)) { g.save(); g.globalAlpha = 0.55; tile(g, v, t); g.restore(); }
    else if (bone.includes(id)) continue;
    else tile(g, v, t);
  }
  // end markers while choosing a side
  if (sel >= 0) {
    const m = endMarkers(), o = options(0).filter(o => o.t === sel);
    if (m) for (const side of ['L', 'R']) {
      if (!o.some(q => q.side === side)) continue;
      const [mx, my] = m[side], r = Math.max(16, layoutInfo.u * 0.9) + Math.sin(t * 6) * 2;
      g.fillStyle = 'rgba(255,210,90,.35)'; g.beginPath(); g.arc(mx, my, r, 0, 7); g.fill();
      g.strokeStyle = '#ffd25a'; g.lineWidth = 3; g.beginPath(); g.arc(mx, my, r, 0, 7); g.stroke();
      g.fillStyle = '#fff'; g.font = '800 13px -apple-system,system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(side === 'L' ? '◀' : '▶', mx, my); g.textBaseline = 'alphabetic';
    }
  }
  // hand label
  const H = R.hand; g.fillStyle = 'rgba(36,51,46,.5)'; g.font = '700 11px -apple-system,system-ui,sans-serif'; g.textAlign = 'center';
  g.fillText(`YOUR TILES · ${hands[0] ? handPips(0) : 0} PIPS`, H.x + H.w / 2, H.y + 14);
}

T.start();
