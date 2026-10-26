// Pointrun — classic backgammon (the public-domain race game) vs the computer, on an upright board made for phones.
// Roll two dice, move your ivory checkers home and bear them off before the computer does. Hit lone checkers to send
// them to the bar. Doubles play four times. Dice are fair (crypto random; the daily game uses one shared seeded stream)
// and the computer only knows its own roll.
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { duel, rngf, fair, rrect, ease, SVG, buzz, tone, note, soft, chime } from './duel.js';
import { START, copy, flip, apply, legalNext, sequences, maxLen, pips, judge } from './rules.js';

const NAME = 'Pointrun: Backgammon vs Computer';
const B = board({ game: 'pointrun', label: 'Wins vs CPU (Hard counts 2)', limits: { maxRun: 2, maxPerSec: 0.1 }, mode: 'sum', corner: 'tl' });
const YOU = '#3f7fd8', CPU = '#e0605a';

// ---------------------------------------------------------------- state (absolute: you = side 0, positive, run 24 → 1)
let R = START(), side = 0, phase = 'idle', dice = [], left = [], turnStart = null, made = [], hist = [], sel = -1, targets = new Map();
let rollR = fair, geo = null, flying = [], diceAnim = 0, diceShown = [1, 1], commitT = 0, lastCpuMoves = [], undoTurns = [], hits = 0;
const rel = () => side === 0 ? R : flip(R);         // the position from the mover's side
const setRel = (X) => { R = side === 0 ? X : flip(X); };
const absPt = (s, p) => p === 25 ? 'bar' : p === 0 ? 'off' : s === 0 ? p : 25 - p;

const T = duel({
  key: 'pointrun', name: NAME, brand: 'Pointrun', kicker: 'Backgammon vs computer', B,
  rule: 'Move all 15 checkers home, then bear them off first. Tap a checker, then a glowing point. Doubles play four times.',
  accent: '#b5523b', bg: ['#f5efe4', '#e6dccb'], ink: '#33281f', winWord: 'You win!',
  dailyBtn: true, dailyLine: 'Same dice for everyone today',
  buttons: [
    { id: 'undo', label: 'Undo', svg: SVG.undo, onPress: () => undo() },
    { id: 'act', label: 'Roll', svg: SVG.play, onPress: () => act() },
  ],
  refresh() {
    const mine = T.state === 'play' && side === 0;
    T.setBtn('undo', { dim: !(mine && (made.length || (T.diff === 0 && phase !== 'anim' && undoTurns.length))) });
    const lab = phase === 'roll' ? 'Roll' : phase === 'done' ? 'Done' : 'Roll';
    T.setBtn('act', { label: lab, dim: !(mine && (phase === 'roll' || phase === 'done')), go: mine && (phase === 'roll' || phase === 'done') });
  },
  newGame({ seed, daily }) {
    rollR = daily ? rngf(seed) : fair;
    R = START(); side = 0; phase = 'opening'; dice = []; left = []; made = []; sel = -1; targets = new Map(); flying = []; lastCpuMoves = []; undoTurns = []; hits = 0;
    head(); opening();
  },
  idle() { R = START(); head(); },
  layout: (a) => layout(a),
  draw, down,
  frac: () => Math.max(0, Math.min(1, (167 - pips(R).me) / 167)),
  bot() { botMove(); },
  botSpeed: 0.08,
  debug: () => ({ phase, side, dice: dice.slice(), left: left.slice(), R }),
});
let botAuto = false;
function botMove() {
  {
    if (side !== 0) return;
    if (phase === 'roll') { botAuto = true; return roll(); }
    if (phase === 'done') return commit();
    if (phase !== 'move') return;
    const seqs = sequences(rel(), left); let best = seqs[0], bv = -1e9;
    for (const s of seqs) { const v = judge(s.R, true); if (v > bv) { bv = v; best = s; } }
    if (best && best.moves.length) { phase = 'anim'; playMoves(best.moves.slice(), 0, () => afterMove()); }
  }
}

// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on your first turn of game 1, until
// the first touch, the dice roll if needed, the best checker lights its glowing points, then hops one die's worth; the rest is yours
let demoSeq = null;
demo(() => {
  if (phase === 'roll') { roll(); return; }
  if (phase !== 'move' || made.length) return false;
  if (!demoSeq) {
    const seqs = sequences(rel(), left); let best = seqs[0], bv = -1e9;
    for (const q of seqs) { const v = judge(q.R, true); if (v > bv) { bv = v; best = q; } }
    if (!best || !best.moves.length) return false;
    demoSeq = best.moves[0]; select(demoSeq.from); return sel === -1 ? false : undefined;
  }
  sel = -1; targets = new Map(); phase = 'anim'; T.refreshButtons(); playMoves([demoSeq], 0, () => afterMove()); return false;
}, { ready: () => T.state === 'play' && T.wins === 0 && !T.D.isDaily && side === 0 && undoTurns.length <= 1 && (phase === 'roll' || phase === 'move'), wait: 1800, every: 1100, max: 3 });

function head() {
  T.header([{ name: 'You', init: 'Y', color: YOU, score: R.off }, { name: 'CPU', init: 'C', color: CPU, score: R.ooff }], T.state === 'play' ? side : -1);
  T.score(Math.max(0, 167 - pips(R).me));
}
const die = () => 1 + Math.floor(rollR() * 6);

// ---------------------------------------------------------------- turn flow
function opening() {
  let a, b; do { a = die(); b = die(); } while (a === b);
  diceShown = [a, b]; spin(() => {
    side = a > b ? 0 : 1;
    T.status(`You rolled ${a}, computer ${b} · ${side ? 'computer starts' : 'you start'}`, 'OPENING ROLL');
    dice = [a, b]; left = a > b ? [a, b] : [b, a];
    T.after(1200, () => startMoves());
  });
}
function spin(done) {
  phase = 'anim'; diceAnim = performance.now(); T.refreshButtons();
  for (let k = 0; k < 5; k++) setTimeout(() => tone(1400 + Math.random() * 600, 0.025, 'square', 0.03, 0.7), k * 70 * T.speed);
  T.anim(520, () => {}, () => { diceAnim = 0; tone(500, 0.05, 'triangle', 0.1, 0.8); done(); });
}
function roll() {
  if (side !== 0 || phase !== 'roll') return;
  const a = die(), b = die(); diceShown = [a, b];
  spin(() => { dice = a === b ? [a, a, a, a] : [a, b]; left = dice.slice(); if (a === b) T.ui.pop('Doubles!', YOU, 30, 46); startMoves(); });
}
function startMoves() {
  made = []; sel = -1; targets = new Map(); turnStart = { R: copy(R), left: left.slice() };
  head();
  if (side === 0) {
    undoTurns.push({ R: copy(R), dice: dice.slice(), left: left.slice() }); if (undoTurns.length > 30) undoTurns.shift();
    if (!maxLen(rel(), left)) { phase = 'anim'; T.status('No legal move with this roll', 'YOUR TURN'); T.refreshButtons(); return T.after(1500, () => endTurn()); }
    phase = 'move'; T.status(R.bar ? 'Enter from the bar first' : 'Tap a checker to move it', `YOUR ROLL ${dice.slice(0, 2).join(' · ')}`);
    autoSelect();
    if (botAuto) { botAuto = false; T.refreshButtons(); return botMove(); }
  } else cpuMoves();
  T.refreshButtons();
}
function autoSelect() { if (R.bar && side === 0) select(25); }
function afterMove() {
  head();
  if (R.off === 15) return finish(0);
  if (!left.length || !legalNext(rel(), left, made.length ? null : dice).length) {
    if (side === 0) { phase = 'done'; sel = -1; targets = new Map(); T.status('Tap Done to end your turn', 'YOUR TURN'); T.refreshButtons(); commitT = T.after(T.bot ? 50 : 1400, commit); return; }
  }
  if (side === 0) { phase = 'move'; T.status(R.bar ? 'Enter from the bar first' : 'Keep going · tap a checker', 'YOUR TURN'); autoSelect(); T.refreshButtons(); }
}
function commit() { if (side !== 0 || phase !== 'done') return; clearTimeout(commitT); endTurn(); }
function endTurn() {
  sel = -1; targets = new Map(); made = []; hist = [];
  if (R.off === 15) return finish(0); if (R.ooff === 15) return finish(1);
  side = 1 - side; head(); T.refreshButtons();
  if (side === 1) {
    phase = 'anim'; T.status('Computer rolls…', 'CPU');
    T.after(500, () => { const a = die(), b = die(); diceShown = [a, b]; spin(() => { dice = a === b ? [a, a, a, a] : [a, b]; left = dice.slice(); startMoves(); }); });
  } else { phase = 'roll'; T.status('Tap Roll (or the dice)', 'YOUR TURN'); T.refreshButtons(); }
}
function cpuMoves() {
  phase = 'anim';
  const seqs = sequences(rel(), left), d = T.diff, fk = T.fk || 1;
  let best = seqs[0], bv = -1e9;
  // Easy: races for pips and ignores safety. Normal: weighs blots, points and primes with some slack. Hard: always its best judgement.
  for (const s of seqs) { const v = d === 0 ? judge(s.R, false) + fair() * 8 : judge(s.R, true) + (d === 1 ? fair() * 14 / fk : 0); if (v > bv) { bv = v; best = s; } }
  if (!best.moves.length) { T.status(`Computer rolled ${dice.slice(0, 2).join(' · ')} · no move`, 'CPU'); return T.after(1300, () => endTurn()); }
  T.status(`Computer plays ${dice.slice(0, 2).join(' · ')}${dice.length === 4 ? ' (doubles)' : ''}`, 'CPU');
  lastCpuMoves = [];
  T.after(450, () => playMoves(best.moves.slice(), 1, () => { head(); if (R.ooff === 15) return finish(1); T.after(500, () => endTurn()); }));
}
/** animate relative moves one at a time for `who`, then done() */
function playMoves(list, who, done) {
  if (!list.length) return done();
  const m = list.shift(); move(m, who, () => T.after(who ? 120 : 30, () => playMoves(list, who, done)));
}
function move(m, who, done) {
  const from = absPt(who, m.from), to = absPt(who, m.to);
  const before = copy(R);
  setRel(apply(rel(), m));
  left.splice(left.indexOf(m.die), 1);
  if (who === 0) { made.push(m); hist.push({ R: before, left: left.concat([m.die]) }); T.moved(); }
  else lastCpuMoves.push(to);
  const p0 = slotXY(from, who, countAt(before, from, who) - 1), p1 = slotXY(to, who, Math.max(0, countAt(R, to, who) - 1));
  const f = { who, x: p0.x, y: p0.y, to }; flying.push(f);
  let hitF = null;
  if (m.hit) { const hp = slotXY(to, 1 - who, 0), bp = slotXY('bar', 1 - who, (who ? R.bar : R.obar) - 1); hitF = { who: 1 - who, x: hp.x, y: hp.y, to: 'bar' }; flying.push(hitF); hitF.p0 = hp; hitF.p1 = bp; }
  T.anim(who ? 300 : 240, (q) => { const e = ease.inOut(q); f.x = p0.x + (p1.x - p0.x) * e; f.y = p0.y + (p1.y - p0.y) * e - Math.sin(Math.PI * q) * 26; f.s = 1 + Math.sin(Math.PI * q) * 0.12; },
    () => {
      flying = flying.filter(x => x !== f);
      tone(who ? 420 : 520, 0.05, 'triangle', 0.1, 0.7); tone(1600, 0.02, 'square', 0.025, 0.8); buzz(who ? 0 : 6);
      if (to === 'off') { T.fx.sparks(p1.x, p1.y, ['#fff', who ? CPU : YOU, '#ffe08a'], 10, { speed: 2.4 }); chime((who ? R.ooff : R.off), 72, 0.07); }
      if (hitF) {
        if (who === 0) { hits++; T.ui.pop('Hit!', YOU, 34, 46); buzz([10, 30, 10]); } else T.ui.pop('Hit!', CPU, 28, 46);
        tone(160, 0.18, 'square', 0.08, 0.6);
        T.anim(320, (q) => { const e = ease.out(q); hitF.x = hitF.p0.x + (hitF.p1.x - hitF.p0.x) * e; hitF.y = hitF.p0.y + (hitF.p1.y - hitF.p0.y) * e; }, () => { flying = flying.filter(x => x !== hitF); done(); });
      } else done();
    });
}
function countAt(S, pt, who) {
  if (pt === 'bar') return who === 0 ? S.bar : S.obar;
  if (pt === 'off') return who === 0 ? S.off : S.ooff;
  const v = S.b[pt]; return who === 0 ? Math.max(0, v) : Math.max(0, -v);
}
function undo() {
  if (side !== 0) return;
  if (made.length && (phase === 'move' || phase === 'done')) {
    clearTimeout(commitT); const h = hist.pop(); made.pop(); R = h.R; left = h.left; phase = 'move'; sel = -1; targets = new Map();
    soft.click(); head(); T.status('Move taken back', 'YOUR TURN'); autoSelect(); T.refreshButtons(); return;
  }
  if (T.diff === 0 && undoTurns.length > 1 && (phase === 'move' || phase === 'roll')) {
    // Easy: take back your whole previous turn (and the computer's reply); you replay it with the same dice
    if (phase === 'move') undoTurns.pop();
    const s = undoTurns.pop(); R = copy(s.R); dice = s.dice.slice(); left = s.left.slice(); diceShown = [dice[0], dice[1]];
    soft.swish(); buzz(6); T.toast('Back to your last turn · same dice');
    startMoves(); return;
  }
  soft.err();
}
function act() { if (phase === 'roll') roll(); else if (phase === 'done') commit(); }
function finish(w) {
  phase = 'over'; head();
  const loserOff = w === 0 ? R.ooff : R.off;
  const loserBack = w === 0 ? (R.obar > 0 || R.b.slice(1, 7).some(v => v < 0)) : (R.bar > 0 || R.b.slice(19, 25).some(v => v > 0));
  const kind = loserOff ? 'single game' : loserBack ? 'backgammon (triple)' : 'gammon (double)';
  if (w === 0) T.end('win', { line: `${kind}${hits ? ` · ${hits} hit${hits > 1 ? 's' : ''}` : ''}${T.diff === 2 ? ' · Hard win counts 2' : ''}`, margin: 15 - R.ooff });
  else T.end('lose', { line: `${kind} · you bore off ${R.off} of 15`, frac: Math.min(1, (167 - pips(R).me) / 167) });
}

// ---------------------------------------------------------------- selection
function select(src) {
  targets = new Map(); sel = -1;
  if (phase !== 'move' || side !== 0) return;
  // every destination this checker can reach with one or more dice in a row (each step legal)
  const walk = (S, ls, at, path, first) => {
    for (const m of legalNext(S, ls, first ? dice : null)) {
      if (m.from !== at) continue;
      const p = path.concat([m]); if (!targets.has(m.to) || targets.get(m.to).length > p.length) targets.set(m.to, p);
      if (m.to !== 0) { const r = ls.slice(); r.splice(r.indexOf(m.die), 1); walk(apply(S, m), r, m.to, p, false); }
    }
  };
  walk(rel(), left, src, [], !made.length);
  if (targets.size) { sel = src; soft.click(); } else { soft.err(); T.toast(R.bar && src !== 25 ? 'Enter from the bar first' : 'That checker can’t move'); }
}
function down(x, y) {
  if (side !== 0 || T.state !== 'play') return;
  if (geo && Math.hypot(x - geo.dice.x, y - geo.dice.y) < 44 && (phase === 'roll' || phase === 'done')) return act();
  if (phase !== 'move') { if (phase === 'roll') T.toast('Roll the dice first'); return; }
  const pt = pointAt(x, y);
  if (sel !== -1 && pt !== null && targets.has(pt === 'off' ? 0 : pt)) {
    const path = targets.get(pt === 'off' ? 0 : pt); sel = -1; targets = new Map(); phase = 'anim'; T.refreshButtons();
    return playMoves(path.slice(), 0, () => afterMove());
  }
  if (pt === null || pt === 'off') { sel = -1; targets = new Map(); return; }
  if (pt === 'bar') return R.bar ? select(25) : null;
  if (R.b[pt] > 0) select(pt); else { sel = -1; targets = new Map(); }
}

// ---------------------------------------------------------------- geometry: upright board
// left column top → bottom: 12…7 | bar | 6…1 (your home at the bottom left); right column: 13…18 | bar | 19…24
function layout(a) {
  const trayH = 40, bw = Math.min(a.w, 470), bh = Math.min(a.h - trayH - 34, bw * 1.75);
  const bx = a.x + (a.w - bw) / 2, by = a.y + Math.max(0, (a.h - trayH - 34 - bh) / 2);
  const fr = 9, gap = 10, barH = Math.max(40, bh * 0.075);
  const ph = (bh - fr * 2 - barH) / 12, cw = (bw - fr * 2 - gap) / 2, cd = Math.min(ph * 0.92, cw / 4.6);
  geo = { bx, by, bw, bh, fr, gap, barH, ph, cw, cd, tray: { x: bx, y: by + bh + 8, w: bw, h: trayH }, dice: { x: bx + bw / 2, y: by + fr + 6 * ph + barH / 2 } };
}
function rowOf(p) { return p <= 12 ? 12 - p : p - 13; }
function rowY(r) { return geo.by + geo.fr + r * geo.ph + (r >= 6 ? geo.barH : 0) + geo.ph / 2; }
const leftCol = (p) => p <= 12;
function slotXY(pt, who, k) {
  const { bx, bw, fr, cw, cd } = geo;
  if (pt === 'bar') { const cx = bx + bw / 2 + (who === 0 ? 1 : -1) * (cd * 1.6 + Math.min(k, 3) * cd * 0.55); return { x: cx, y: geo.dice.y }; }
  if (pt === 'off') { const t = geo.tray, half = t.w / 2; return { x: (who === 0 ? t.x + 12 : t.x + half + 12) + Math.min(k, 14) * Math.min(9, (half - 30) / 15) + 4, y: t.y + t.h / 2 }; }
  const y = rowY(rowOf(pt)), n = Math.max(k + 1, 5), step = Math.min(cd, (cw - cd) / (n - 1));
  const off = cd / 2 + k * step;
  return { x: leftCol(pt) ? bx + fr + off : bx + bw - fr - off, y };
}
function pointAt(x, y) {
  const { bx, by, bw, bh, fr, cw, gap, barH } = geo, t = geo.tray;
  if (y >= t.y - 4 && y <= t.y + t.h + 8 && x >= t.x && x <= t.x + t.w) return 'off';
  if (y < by || y > by + bh) return null;
  const top = by + fr, mid = top + 6 * geo.ph;
  if (y >= mid && y < mid + barH) return 'bar';
  let r = y < mid ? Math.floor((y - top) / geo.ph) : 6 + Math.floor((y - mid - barH) / geo.ph); r = Math.max(0, Math.min(11, r));
  if (x < bx + bw / 2) return 12 - r; return 13 + r;
}

// ---------------------------------------------------------------- drawing
function draw(g, t) {
  if (!geo) return;
  const { bx, by, bw, bh, fr, gap, barH, ph, cw, cd } = geo;
  // frame + linen field
  g.save(); g.shadowColor = 'rgba(60,35,15,.35)'; g.shadowBlur = 22; g.shadowOffsetY = 8;
  rrect(g, bx, by, bw, bh, 16); const wood = g.createLinearGradient(bx, by, bx + bw, by + bh); wood.addColorStop(0, '#7b4f2c'); wood.addColorStop(1, '#5a361b'); g.fillStyle = wood; g.fill(); g.restore();
  for (const half of [0, 1]) {
    const x = half ? bx + bw / 2 + gap / 2 : bx + fr, w = cw;
    for (const [y0, h] of [[by + fr, ph * 6], [by + fr + ph * 6 + barH, ph * 6]]) {
      rrect(g, x, y0, w, h, 6); const lin = g.createLinearGradient(x, y0, x + w, y0); lin.addColorStop(0, '#efe3c9'); lin.addColorStop(1, '#e6d6b5'); g.fillStyle = lin; g.fill();
    }
  }
  // points (triangles from the outer edge toward the middle)
  const legal = new Set([...targets.keys()]);
  for (let p = 1; p <= 24; p++) {
    const r = rowOf(p), y = rowY(r), L = leftCol(p), x0 = L ? bx + fr : bx + bw - fr, dir = L ? 1 : -1, len = cw * 0.9;
    g.beginPath(); g.moveTo(x0, y - ph * 0.46); g.lineTo(x0 + dir * len, y); g.lineTo(x0, y + ph * 0.46); g.closePath();
    g.fillStyle = (p % 2) ? '#c4583f' : '#2f6f6a'; g.fill();
    if (legal.has(p)) { g.fillStyle = `rgba(255,214,90,${0.45 + 0.25 * Math.sin(t * 6)})`; g.fill(); }
    if (lastCpuMoves.includes(p) && side === 0) { g.strokeStyle = 'rgba(224,96,90,.8)'; g.lineWidth = 2; g.stroke(); }
    g.fillStyle = 'rgba(80,50,25,.35)'; g.font = `700 ${Math.max(8, ph * 0.2)}px -apple-system,system-ui,sans-serif`; g.textAlign = L ? 'right' : 'left'; g.textBaseline = 'middle';
    g.fillText(p, L ? bx + bw / 2 - gap / 2 - 3 : bx + bw / 2 + gap / 2 + 3, y);
  }
  // home markers
  g.fillStyle = 'rgba(255,240,215,.75)'; g.font = '800 9px -apple-system,system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.save(); g.translate(bx + fr / 2, rowY(9)); g.rotate(-Math.PI / 2); g.fillText('YOUR HOME', 0, 0); g.restore();
  g.save(); g.translate(bx + bw - fr / 2, rowY(9)); g.rotate(Math.PI / 2); g.fillText('CPU HOME', 0, 0); g.restore();
  // bar band
  const barY = by + fr + 6 * ph;
  g.fillStyle = '#4d2d16'; g.fillRect(bx + fr, barY, bw - fr * 2, barH);
  // checkers on points
  const flyingTo = (pt, who) => flying.filter(f => f.to === pt && f.who === who).length;
  for (let p = 1; p <= 24; p++) {
    const v = R.b[p]; if (!v) continue; const who = v > 0 ? 0 : 1, n = Math.abs(v) - flyingTo(p, who);
    for (let k = 0; k < n; k++) { const q = slotXY(p, who, k); checker(g, q.x, q.y, who, (p === sel && k === n - 1)); }
    if (n > 5) { const q = slotXY(p, who, n - 1); g.fillStyle = who ? '#fff' : '#33281f'; g.font = `800 ${cd * 0.4}px -apple-system,system-ui,sans-serif`; g.textAlign = 'center'; g.fillText(n, q.x, q.y + 1); }
  }
  for (const who of [0, 1]) { const n = (who ? R.obar : R.bar) - flyingTo('bar', who); for (let k = 0; k < n; k++) { const q = slotXY('bar', who, k); checker(g, q.x, q.y, who, who === 0 && sel === 25 && k === n - 1); } }
  // dice in the middle of the bar
  drawDice(g, t);
  // bear-off tray
  const tr = geo.tray;
  rrect(g, tr.x, tr.y, tr.w, tr.h, 12); g.fillStyle = 'rgba(90,55,25,.14)'; g.fill();
  if (legal.has(0)) { g.strokeStyle = `rgba(230,170,40,${0.6 + 0.3 * Math.sin(t * 6)})`; g.lineWidth = 3; rrect(g, tr.x + 2, tr.y + 2, tr.w / 2 - 6, tr.h - 4, 10); g.stroke(); }
  for (const who of [0, 1]) {
    const n = (who ? R.ooff : R.off) - flyingTo('off', who);
    for (let k = 0; k < n; k++) { const q = slotXY('off', who, k); g.fillStyle = who ? '#3b3b46' : '#fbf6ea'; rrect(g, q.x - 3, q.y - cd * 0.36, 7, cd * 0.72, 2); g.fill(); g.strokeStyle = who ? CPU : YOU; g.lineWidth = 1.2; g.stroke(); }
    if (!n) { g.fillStyle = 'rgba(51,40,31,.4)'; g.font = '700 11px -apple-system,system-ui,sans-serif'; g.textAlign = 'left'; g.fillText(who ? 'CPU borne off' : 'Bear off here', (who ? tr.x + tr.w / 2 : tr.x) + 14, tr.y + tr.h / 2 + 1); }
  }
  const P = pips(R); g.fillStyle = 'rgba(51,40,31,.55)'; g.font = '700 11px -apple-system,system-ui,sans-serif'; g.textAlign = 'center';
  g.fillText(`PIPS  you ${P.me} · cpu ${P.op}`, bx + bw / 2, tr.y + tr.h + 14);
  // flying checkers on top
  for (const f of flying) checker(g, f.x, f.y, f.who, false, f.s || 1);
}
function checker(g, x, y, who, on, s = 1) {
  const r = geo.cd / 2 * s;
  g.fillStyle = 'rgba(30,15,5,.3)'; g.beginPath(); g.ellipse(x + 1, y + r * 0.22, r, r * 0.95, 0, 0, 7); g.fill();
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  if (who === 0) { gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#e7dfcc'); } else { gr.addColorStop(0, '#5a5a68'); gr.addColorStop(1, '#2c2c36'); }
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  g.strokeStyle = who === 0 ? 'rgba(90,70,40,.45)' : 'rgba(0,0,0,.5)'; g.lineWidth = 1; g.stroke();
  g.strokeStyle = who === 0 ? 'rgba(63,127,216,.75)' : 'rgba(224,96,90,.85)'; g.lineWidth = Math.max(1.5, r * 0.14); g.beginPath(); g.arc(x, y, r * 0.6, 0, 7); g.stroke();
  if (on) { g.strokeStyle = '#ffd25a'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, r + 2.5, 0, 7); g.stroke(); }
}
const DP = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
function drawDice(g, t) {
  const { x, y } = geo.dice, s = Math.min(geo.barH * 0.72, 32);
  const spinning = diceAnim > 0, show = spinning ? [1 + Math.floor((t * 23) % 6), 1 + Math.floor((t * 17 + 3) % 6)] : diceShown;
  const dbl = !spinning && dice.length === 4 && phase !== 'opening';
  const vals = dbl ? [show[0], show[0], show[0], show[0]] : show;
  const n = vals.length, sz = dbl ? s * 0.78 : s, gapx = sz * 1.18;
  const used = (i) => { if (spinning || phase === 'roll' || phase === 'opening') return false; const usedN = dice.length - left.length; if (dbl) return i < usedN; const rem = left.slice(); const v = vals[i]; const j = rem.indexOf(v); if (i === 1 && vals[0] === vals[1]) return false; return j < 0; };
  for (let i = 0; i < n; i++) {
    const cx = x + (i - (n - 1) / 2) * gapx, rot = spinning ? Math.sin(t * 30 + i) * 0.5 : 0;
    g.save(); g.translate(cx, y); g.rotate(rot); g.globalAlpha = used(i) ? 0.35 : 1;
    g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 6; g.shadowOffsetY = 2;
    rrect(g, -sz / 2, -sz / 2, sz, sz, sz * 0.2); g.fillStyle = side === 1 && phase !== 'opening' ? '#3b3b46' : '#fffdf6'; g.fill(); g.shadowColor = 'transparent';
    g.fillStyle = side === 1 && phase !== 'opening' ? '#fff' : '#33281f';
    for (const [px, py] of DP[vals[i]]) { g.beginPath(); g.arc(px * sz * 0.26, py * sz * 0.26, sz * 0.085, 0, 7); g.fill(); }
    g.restore();
  }
  if (phase === 'roll' && side === 0) {
    const p = 0.5 + 0.5 * Math.sin(t * 5); g.strokeStyle = `rgba(255,214,90,${0.5 + p * 0.4})`; g.lineWidth = 2.5;
    rrect(g, x - gapx - sz * 0.15, y - sz * 0.68, gapx * 2 + sz * 0.3, sz * 1.36, 10); g.stroke();
  }
}

T.start();
