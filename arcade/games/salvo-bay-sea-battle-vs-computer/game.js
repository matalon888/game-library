// Salvo Bay — the classic pencil-and-paper sea battle game, you vs the computer.
// Hide five ships on a 10 × 10 sea, then take turns firing one shot each. Sink the whole enemy fleet first.
// The computer never peeks: it only knows where it has fired and what it was told (miss, hit, sunk).
import { board } from './kit/board.js';
import { store } from './kit/hc.js';
import { duel, rngf, rrect, ease, SVG, buzz, tone, note, soft, chime } from './duel.js';

const NAME = 'Salvo Bay: Sea Battle vs Computer';
const B = board({ game: 'salvo-bay', label: 'Wins vs CPU (Hard counts 2)', limits: { maxRun: 2, maxPerSec: 0.2 }, mode: 'sum', corner: 'tl' });
const FLEET = [{ len: 5, name: 'carrier' }, { len: 4, name: 'cruiser' }, { len: 3, name: 'destroyer' }, { len: 3, name: 'submarine' }, { len: 2, name: 'patrol boat' }];
const YOU = '#2f6fd0', CPU = '#e0605a', INK = '#1f2f48';
const U = 0, MISS = 1, HIT = 2, SUNK = 3;

// ---------------------------------------------------------------- fleets
const cells = (s) => { const a = []; for (let k = 0; k < s.len; k++) a.push((s.r + (s.h ? 0 : k)) * 10 + s.c + (s.h ? k : 0)); return a; };
function fits(ships, s, skip = -1) {
  if (s.r < 0 || s.c < 0 || (s.h ? s.c + s.len > 10 : s.r + s.len > 10)) return false;
  const mine = cells(s);
  for (let i = 0; i < ships.length; i++) {
    if (i === skip) continue;
    for (const x of cells(ships[i])) for (const m of mine) {   // ships never touch, not even at the corners
      if (Math.abs(Math.floor(x / 10) - Math.floor(m / 10)) <= 1 && Math.abs(x % 10 - m % 10) <= 1) return false;
    }
  }
  return true;
}
function autoPlace(r) {
  for (let tries = 0; tries < 200; tries++) {
    const ships = []; let ok = true;
    for (const f of FLEET) {
      let placed = false;
      for (let k = 0; k < 300 && !placed; k++) { const s = { len: f.len, name: f.name, h: r() < 0.5, r: Math.floor(r() * 10), c: Math.floor(r() * 10), hits: 0, sunk: false }; if (fits(ships, s)) { ships.push(s); placed = true; } }
      if (!placed) { ok = false; break; }
    }
    if (ok) return ships;
  }
  return null;
}

// ---------------------------------------------------------------- targeting (shared by the CPU and the QA bot; reads only a shot board)
// shots: U / MISS / HIT / SUNK per cell; left: lengths of ships not yet sunk
function aim(shots, left, level, r) {
  const unknown = []; for (let i = 0; i < 100; i++) if (shots[i] === U) unknown.push(i);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const hits = []; for (let i = 0; i < 100; i++) if (shots[i] === HIT) hits.push(i);
  const nb = (i) => [i - 10, i + 10, i % 10 ? i - 1 : -1, i % 10 < 9 ? i + 1 : -1].filter(j => j >= 0 && j < 100);
  if (level === 0) {                                   // Easy: random sea, sometimes follows up a hit
    if (hits.length && r() < 0.55) { const c = []; hits.forEach(h => nb(h).forEach(j => shots[j] === U && c.push(j))); if (c.length) return pick(c); }
    return pick(unknown);
  }
  if (level === 1) {                                   // Normal: checkerboard hunt, then follow the line of hits
    if (hits.length) {
      for (const h of hits) for (const [d, ok] of [[1, (i) => i % 10 < 9], [10, () => true]]) {
        if (shots[h + d] === HIT && ok(h)) {           // two in a row: extend the line both ways
          const line = [h]; let a = h; while (ok(a) && shots[a + d] === HIT) { a += d; line.push(a); }
          const ends = []; const lo = h - d, hi = a + d;
          if (lo >= 0 && (d === 10 || h % 10 > 0) && shots[lo] === U) ends.push(lo);
          if (hi < 100 && (d === 10 || a % 10 < 9) && shots[hi] === U) ends.push(hi);
          if (ends.length) return pick(ends);
        }
      }
      const c = []; hits.forEach(h => nb(h).forEach(j => shots[j] === U && c.push(j))); if (c.length) return pick(c);
    }
    const par = unknown.filter(i => (Math.floor(i / 10) + i % 10) % 2 === 0);
    return pick(par.length ? par : unknown);
  }
  // Hard: probability map of every way the remaining ships could still lie (sunk ships' neighbours are known water)
  const blocked = new Array(100).fill(false);
  for (let i = 0; i < 100; i++) if (shots[i] === MISS) blocked[i] = true;
  for (let i = 0; i < 100; i++) if (shots[i] === SUNK) { blocked[i] = true; for (const dr of [-1, 0, 1]) for (const dc of [-1, 0, 1]) { const rr = Math.floor(i / 10) + dr, cc = i % 10 + dc; if (rr >= 0 && rr < 10 && cc >= 0 && cc < 10 && shots[rr * 10 + cc] === U) blocked[rr * 10 + cc] = true; } }
  const w = new Array(100).fill(0);
  for (const len of left) for (let rr = 0; rr < 10; rr++) for (let cc = 0; cc < 10; cc++) for (const h of [true, false]) {
    if (h ? cc + len > 10 : rr + len > 10) continue;
    let ok = true, cover = 0; const cs = [];
    for (let k = 0; k < len; k++) { const i = (rr + (h ? 0 : k)) * 10 + cc + (h ? k : 0); if (blocked[i]) { ok = false; break; } if (shots[i] === HIT) cover++; cs.push(i); }
    if (!ok) continue;
    if (hits.length && !cover) { for (const i of cs) w[i] += 0.02; continue; }
    const wt = cover ? Math.pow(30, cover) : 1;
    for (const i of cs) if (shots[i] === U) w[i] += wt;
  }
  let best = [], bv = -1;
  for (const i of unknown) { if (w[i] > bv + 1e-9) { bv = w[i]; best = [i]; } else if (Math.abs(w[i] - bv) < 1e-9) best.push(i); }
  return pick(best.length ? best : unknown);
}

// ---------------------------------------------------------------- state
let phase = 'place', mine = [], foe = [], shotsE = [], shotsY = [], turn = 0, rand = Math.random, busy = false, geo = null, drag = null, sel = -1;
let fx = [], aimCell = -1, lastCpu = -1, myShots = 0, myHits = 0, cpuHits = 0, placeR = Math.random, firstSide = 0;
const S0 = store('salvobay');
const T = duel({
  key: 'salvobay', name: NAME, brand: 'Salvo Bay', kicker: 'Sea battle vs computer', B,
  rule: 'Hide your fleet, then take turns firing one shot. Sink all five enemy ships first.',
  accent: '#2f86c9', bg: ['#eaf6fb', '#cfe6f2'], ink: INK, winWord: 'Fleet sunk!',
  dailyBtn: true, dailyLine: 'Same enemy fleet for everyone today',
  buttons: [
    { id: 'shuffle', label: 'Shuffle', svg: SVG.shuffle, onPress: () => { if (phase !== 'place') return; mine = autoPlace(placeR); sel = -1; soft.swish(); buzz(5); } },
    { id: 'rotate', label: 'Turn', svg: SVG.rotate, onPress: () => { if (phase !== 'place') return; rotate(sel >= 0 ? sel : 0); } },
    { id: 'go', label: 'Battle', svg: SVG.play, onPress: () => startBattle() },
  ],
  refresh() {
    const pl = phase === 'place' && T.state === 'play';
    T.setBtn('shuffle', { gone: !pl }); T.setBtn('rotate', { gone: !pl }); T.setBtn('go', { gone: !pl, go: pl });
  },
  newGame({ seed, daily, games }) {
    rand = rngf(seed + 99); placeR = rngf(seed);
    foe = autoPlace(rngf(seed * 7 + 3)); mine = autoPlace(placeR);
    shotsE = new Array(100).fill(U); shotsY = new Array(100).fill(U); fx = []; aimCell = -1; lastCpu = -1; myShots = 0; myHits = 0; cpuHits = 0;
    phase = 'place'; busy = false; drag = null; sel = -1; firstSide = daily ? 0 : games % 2;
    layout(T.area()); head();
    T.status('Drag a ship to move it · tap it to turn', 'PLACE YOUR FLEET');
  },
  idle() { foe = autoPlace(rngf(5)); mine = autoPlace(rngf(9)); shotsE = new Array(100).fill(U); shotsY = new Array(100).fill(U); phase = 'place'; },
  layout: (a) => layout(a),
  draw, down, move, up,
  frac: () => myHits / 17,
  bot() {
    if (phase === 'place') return startBattle();
    if (busy || turn !== 0) return;
    fire(aim(shotsE, foe.filter(s => !s.sunk).map(s => s.len), 2, rand));
  },
  botSpeed: 0.1,
  debug: () => ({ phase, turn, busy, myHits, cpuHits }),
});

function head() {
  const fl = (ships) => ships.filter(s => !s.sunk).length;
  T.header([{ name: 'You', init: 'Y', color: YOU, score: fl(mine) }, { name: 'CPU', init: 'C', color: CPU, score: fl(foe) }], T.state === 'play' && phase === 'battle' ? turn : -1);
  T.score(myHits);
}
function rotate(i) {
  const s = mine[i]; if (!s) return;
  const t = { ...s, h: !s.h };
  if (fits(mine, t, i)) { mine[i] = t; sel = i; soft.wood(); buzz(5); }
  else { soft.err(); T.toast('No room to turn it there'); }
}
function startBattle() {
  if (phase !== 'place' || T.state !== 'play') return;
  phase = 'battle'; sel = -1; drag = null; layout(T.area()); T.refreshButtons(); T.moved();
  note(67, 0.3, 0.1); setTimeout(() => note(72, 0.4, 0.1), 120);
  turn = firstSide; head();
  if (turn === 0) yourTurn(true); else { T.status('The computer fires first', 'CPU'); T.after(900, cpuTurn); }
}
function yourTurn(first) { turn = 0; busy = false; head(); T.status(first ? 'You fire first · tap the enemy sea' : 'Your shot · tap the enemy sea', T.diffName.toUpperCase()); }

// ---------------------------------------------------------------- firing
function resolve(ships, shots, i) {
  const s = ships.find(s => cells(s).includes(i));
  if (!s) { shots[i] = MISS; return { hit: false }; }
  shots[i] = HIT; s.hits++;
  if (s.hits >= s.len) { s.sunk = true; cells(s).forEach(c => shots[c] = SUNK); return { hit: true, sunk: s }; }
  return { hit: true };
}
function fire(i) {
  if (busy || turn !== 0 || shotsE[i] !== U || T.state !== 'play') return;
  busy = true; myShots++; aimCell = i;
  tone(240, 0.12, 'sawtooth', 0.05, 0.5);
  const at = cellXY('E', i);
  T.anim(260, () => {}, () => {
    aimCell = -1;
    const r = resolve(foe, shotsE, i);
    boom(at, r.hit, 'E', i);
    if (r.hit) { myHits++; head(); }
    if (r.sunk) { T.ui.pop(`You sank their ${r.sunk.name}!`, YOU, 26, 40); chime(5, 72, 0.12); setTimeout(() => chime(7, 72, 0.1), 120); buzz([15, 40, 15]); }
    else if (r.hit) T.ui.pop('Hit!', '#e8562e', 34, 40);
    T.after(r.hit ? 650 : 450, () => {
      if (foe.every(s => s.sunk)) return finish(true);
      turn = 1; head(); T.status('The computer is aiming…', 'CPU'); T.after(550, cpuTurn);
    });
  });
}
function cpuTurn() {
  if (T.state !== 'play') return;
  const i = aim(shotsY, mine.filter(s => !s.sunk).map(s => s.len), T.diff, rand);
  lastCpu = i; const at = cellXY('Y', i);
  tone(200, 0.12, 'sawtooth', 0.04, 0.5);
  T.anim(260, () => {}, () => {
    const r = resolve(mine, shotsY, i);
    boom(at, r.hit, 'Y', i);
    if (r.hit) { cpuHits++; buzz(25); }
    if (r.sunk) T.ui.pop(`They sank your ${r.sunk.name}`, CPU, 24, 40);
    head();
    T.after(r.hit ? 650 : 400, () => { if (mine.every(s => s.sunk)) return finish(false); yourTurn(false); });
  });
}
function boom(p, hit, grid, i) {
  fx.push({ x: p.x, y: p.y, t: performance.now(), hit, grid, i });
  if (hit) { tone(110, 0.28, 'square', 0.12, 0.45); tone(70, 0.35, 'sawtooth', 0.07, 0.5); T.fx.sparks(p.x, p.y, ['#ffd25a', '#ff7a3d', '#e8452e', '#fff'], 16, { speed: 3.4, size: 3.4 }); }
  else { tone(900, 0.16, 'sine', 0.05, 0.3); tone(420, 0.2, 'triangle', 0.04, 0.6); T.fx.sparks(p.x, p.y, ['#ffffff', '#bfe6ff'], 8, { speed: 1.8, size: 2.4, kind: 'dot' }); }
}
function finish(won) {
  busy = true; head();
  const left = mine.filter(s => !s.sunk).length, acc = Math.round(myHits / Math.max(1, myShots) * 100);
  if (won) T.end('win', { line: `${myShots} shots · ${acc}% hits · ${left} ship${left === 1 ? '' : 's'} left${T.diff === 2 ? ' · Hard win counts 2' : ''}`, margin: left });
  else { T.end('lose', { line: `You hit ${myHits} of 17 · ${foe.filter(s => s.sunk).length} ships sunk`, frac: myHits / 17, title: 'Fleet lost' }); }
}

// ---------------------------------------------------------------- geometry
function layout(a) {
  if (phase === 'place') {
    const s = Math.floor(Math.min(a.w - 34, a.h - 90, 520) / 10);
    geo = { Y: { s, x: Math.round(a.x + (a.w - s * 10) / 2 + 8), y: Math.round(a.y + 26 + Math.max(0, (a.h - 90 - s * 10) / 2)) }, E: null };
  } else {
    const se = Math.floor(Math.min(a.w - 34, (a.h - 90) * 0.6, 470) / 10);
    const E = { s: se, x: Math.round(a.x + (a.w - se * 10) / 2 + 8), y: Math.round(a.y + 44) };
    const room = a.y + a.h - (E.y + se * 10) - 36;
    const sy = Math.floor(Math.min((a.w - 20) * 0.52, room, 300) / 10);
    const Y = { s: sy, x: Math.round(E.x - 8), y: Math.round(E.y + se * 10 + 32) };
    geo = { E, Y, panel: { x: Y.x + sy * 10 + 14, y: Y.y, w: E.x + se * 10 - (Y.x + sy * 10 + 14), h: sy * 10 } };
  }
}
function cellXY(g, i) { const G = geo[g]; return { x: G.x + (i % 10 + 0.5) * G.s, y: G.y + (Math.floor(i / 10) + 0.5) * G.s }; }
function cellAt(g, x, y) { const G = geo[g]; if (!G) return -1; const c = Math.floor((x - G.x) / G.s), r = Math.floor((y - G.y) / G.s); return c < 0 || r < 0 || c > 9 || r > 9 ? -1 : r * 10 + c; }

// ---------------------------------------------------------------- input
function down(x, y) {
  if (phase === 'place') {
    const i = cellAt('Y', x, y); if (i < 0) return;
    const k = mine.findIndex(s => cells(s).includes(i)); if (k < 0) return;
    const s = mine[k]; drag = { k, sx: x, sy: y, moved: false, offR: Math.floor(i / 10) - s.r, offC: i % 10 - s.c, ghost: { ...s }, ok: true };
    soft.click(); return;
  }
  if (busy || turn !== 0) return;
  const i = cellAt('E', x, y); if (i < 0) return;
  if (shotsE[i] !== U) { soft.err(); T.toast('Already fired there'); return; }
  aimCell = i; tone(1300, 0.02, 'sine', 0.03, 0.9);
}
function move(x, y) {
  if (phase === 'place' && drag) {
    if (!drag.moved && Math.hypot(x - drag.sx, y - drag.sy) < 8) return;
    drag.moved = true; const G = geo.Y;
    const c = Math.round((x - G.x) / G.s - 0.5) - drag.offC, r = Math.round((y - G.y) / G.s - 0.5) - drag.offR;
    const gh = { ...mine[drag.k], r, c }; if (gh.r !== drag.ghost.r || gh.c !== drag.ghost.c) tone(1100, 0.02, 'sine', 0.03, 0.9);
    drag.ghost = gh; drag.ok = fits(mine, gh, drag.k); drag.px = x; drag.py = y; return;
  }
  if (phase === 'battle' && aimCell >= 0 && !busy) { const i = cellAt('E', x, y); if (i >= 0 && shotsE[i] === U) aimCell = i; }
}
function up(x, y) {
  if (phase === 'place') {
    if (!drag) return; const d = drag; drag = null;
    if (!d.moved) return rotate(d.k);
    if (d.ok) { mine[d.k] = d.ghost; sel = d.k; soft.wood(); buzz(5); } else soft.err();
    return;
  }
  if (aimCell >= 0 && !busy && turn === 0) { const i = aimCell; aimCell = -1; T.moved(); fire(i); }
}

// ---------------------------------------------------------------- drawing
function sea(g, G, t, small) {
  const W = G.s * 10;
  g.save(); g.shadowColor = 'rgba(20,60,100,.25)'; g.shadowBlur = 18; g.shadowOffsetY = 6;
  rrect(g, G.x - 4, G.y - 4, W + 8, W + 8, small ? 10 : 14); g.fillStyle = '#fff'; g.fill(); g.restore();
  g.save(); rrect(g, G.x, G.y, W, W, small ? 7 : 10); g.clip();
  const gr = g.createLinearGradient(G.x, G.y, G.x + W, G.y + W); gr.addColorStop(0, '#5db4e0'); gr.addColorStop(1, '#2f7fbf'); g.fillStyle = gr; g.fillRect(G.x, G.y, W, W);
  g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = 1.4;
  for (let k = 0; k < 9; k++) {           // drifting wave ticks
    const yy = G.y + ((k * 37 + t * 9) % W), xx = G.x + ((k * 71) % W);
    g.beginPath(); for (let d = 0; d < 26; d += 2) g.lineTo(xx + d, yy + Math.sin((d + t * 30) * 0.3) * 1.6); g.stroke();
  }
  g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 1;
  for (let k = 1; k < 10; k++) { g.beginPath(); g.moveTo(G.x + k * G.s, G.y); g.lineTo(G.x + k * G.s, G.y + W); g.moveTo(G.x, G.y + k * G.s); g.lineTo(G.x + W, G.y + k * G.s); g.stroke(); }
  g.restore();
  if (!small) {
    g.fillStyle = 'rgba(31,47,72,.45)'; g.font = `700 ${Math.max(9, G.s * 0.3)}px -apple-system,system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let k = 0; k < 10; k++) { g.fillText('ABCDEFGHIJ'[k], G.x + (k + 0.5) * G.s, G.y - 12); g.fillText(k + 1, G.x - 13, G.y + (k + 0.5) * G.s); }
  }
}
function ship(g, G, s, { alpha = 1, sunk = false, tint = null } = {}) {
  const pad = G.s * 0.13, x = G.x + s.c * G.s + pad, y = G.y + s.r * G.s + pad;
  const L = s.len * G.s - pad * 2, Wd = G.s - pad * 2;
  g.save(); g.globalAlpha = alpha; g.translate(x, y); if (!s.h) { g.translate(Wd, 0); g.rotate(Math.PI / 2); }
  // hull: square stern, pointed bow
  const hull = () => { g.beginPath(); g.moveTo(Wd * 0.25, 0); g.lineTo(L - Wd * 0.75, 0); g.quadraticCurveTo(L, Wd * 0.05, L, Wd / 2); g.quadraticCurveTo(L, Wd * 0.95, L - Wd * 0.75, Wd); g.lineTo(Wd * 0.25, Wd); g.quadraticCurveTo(0, Wd, 0, Wd * 0.75); g.lineTo(0, Wd * 0.25); g.quadraticCurveTo(0, 0, Wd * 0.25, 0); g.closePath(); };
  g.shadowColor = 'rgba(0,30,60,.35)'; g.shadowBlur = 6; g.shadowOffsetY = 2;
  hull(); g.fillStyle = sunk ? '#4b4f5a' : tint || '#8b98b4'; g.fill(); g.shadowColor = 'transparent';
  g.lineWidth = 1.4; g.strokeStyle = sunk ? '#2c2f36' : '#56627d'; g.stroke();
  // deck stripe + details
  g.fillStyle = sunk ? '#5d616c' : '#a9b5cc'; rrect(g, Wd * 0.22, Wd * 0.28, L - Wd * 0.9, Wd * 0.44, Wd * 0.2); g.fill();
  const dots = s.len >= 4 ? [0.22, 0.45, 0.68] : s.len === 3 ? [0.3, 0.6] : [0.42];
  dots.forEach((f, k) => {
    const cx = L * f, cy = Wd / 2;
    g.fillStyle = sunk ? '#3b3e46' : k === 1 && s.len >= 4 ? '#e9eef7' : '#66728e';
    if (k === 1 && s.len >= 4) { rrect(g, cx - Wd * 0.3, cy - Wd * 0.26, Wd * 0.6, Wd * 0.52, 3); g.fill(); g.fillStyle = sunk ? '#3b3e46' : '#f2a03d'; g.fillRect(cx - Wd * 0.08, cy - Wd * 0.1, Wd * 0.16, Wd * 0.2); }
    else { g.beginPath(); g.arc(cx, cy, Wd * 0.2, 0, 7); g.fill(); g.strokeStyle = sunk ? '#3b3e46' : '#56627d'; g.lineWidth = Wd * 0.1; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Wd * 0.38, cy); g.stroke(); }
  });
  if (s.len === 5 && !sunk) { g.strokeStyle = 'rgba(255,255,255,.75)'; g.setLineDash([Wd * 0.25, Wd * 0.2]); g.lineWidth = 1.2; g.beginPath(); g.moveTo(Wd * 0.3, Wd * 0.2); g.lineTo(L - Wd * 0.9, Wd * 0.2); g.stroke(); g.setLineDash([]); }
  g.restore();
}
function marks(g, G, shots, grid, t) {
  const now = performance.now();
  for (let i = 0; i < 100; i++) {
    const v = shots[i]; if (v === U) continue;
    const c = { x: G.x + (i % 10 + 0.5) * G.s, y: G.y + (Math.floor(i / 10) + 0.5) * G.s }, r = G.s * 0.22;
    const f = fx.find(f => f.grid === grid && f.i === i), age = f ? (now - f.t) / 500 : 9;
    if (v === MISS) {
      g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(c.x, c.y, r * 0.55 * Math.min(1, age * 2 + 0.3), 0, 7); g.fill();
      if (age < 1.6) { g.strokeStyle = `rgba(255,255,255,${0.8 * (1 - age / 1.6)})`; g.lineWidth = 2; g.beginPath(); g.arc(c.x, c.y, r * (0.6 + age * 1.6), 0, 7); g.stroke(); }
    } else {
      const flick = 0.85 + Math.sin(t * 11 + i) * 0.12;
      g.fillStyle = v === SUNK ? 'rgba(40,20,20,.35)' : 'rgba(232,69,46,.28)'; g.beginPath(); g.arc(c.x, c.y, r * 1.5, 0, 7); g.fill();
      g.fillStyle = '#e8452e'; g.beginPath(); g.arc(c.x, c.y, r * flick, 0, 7); g.fill();
      g.fillStyle = '#ffd25a'; g.beginPath(); g.arc(c.x, c.y - r * 0.15, r * 0.5 * flick, 0, 7); g.fill();
      if (age < 1) { g.strokeStyle = `rgba(255,190,80,${1 - age})`; g.lineWidth = 3; g.beginPath(); g.arc(c.x, c.y, r * (1 + age * 2.5), 0, 7); g.stroke(); }
    }
  }
}
function label(g, x, y, text, color) { g.font = '800 11px -apple-system,system-ui,sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = color; g.fillText(text.split('').join(String.fromCharCode(8202)), x, y); }

function draw(g, t) {
  if (!geo) return;
  if (phase === 'place') {
    const G = geo.Y; sea(g, G, t, false);
    mine.forEach((s, k) => { if (drag && drag.k === k && drag.moved) ship(g, G, s, { alpha: 0.3 }); else ship(g, G, s, { tint: k === sel ? '#9fb0d4' : null }); });
    if (drag && drag.moved) {
      const gh = drag.ghost, ok = drag.ok;
      g.save(); g.globalAlpha = 0.45; g.fillStyle = ok ? '#7cf0a5' : '#ff6b6b';
      for (const i of cellsSafe(gh)) { const c = i; g.fillRect(G.x + (c % 10) * G.s + 1, G.y + Math.floor(c / 10) * G.s + 1, G.s - 2, G.s - 2); }
      g.restore(); ship(g, G, { ...gh, r: Math.max(-1, Math.min(10, gh.r)), c: Math.max(-1, Math.min(10, gh.c)) }, { alpha: 0.85 });
    }
    g.textAlign = 'center'; g.font = '600 13px -apple-system,system-ui,sans-serif'; g.fillStyle = 'rgba(31,47,72,.55)';
    g.fillText('Ships may not touch · then tap Battle', G.x + G.s * 5, G.y + G.s * 10 + 26);
    return;
  }
  const { E, Y, panel } = geo;
  label(g, E.x - 26, E.y - 32, 'ENEMY WATERS', CPU);
  sea(g, E, t, false);
  foe.forEach(s => s.sunk && ship(g, E, s, { sunk: true }));
  if (T.state !== 'play' && foe.some(s => !s.sunk)) foe.forEach(s => !s.sunk && ship(g, E, s, { alpha: 0.55 }));   // reveal after a loss
  marks(g, E, shotsE, 'E', t);
  if (aimCell >= 0) {
    const c = cellXY('E', aimCell), r = E.s * (0.62 + Math.sin(t * 10) * 0.05);
    g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.beginPath(); g.arc(c.x, c.y, r * 0.7, 0, 7); g.stroke();
    g.beginPath(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { g.moveTo(c.x + dx * r * 0.4, c.y + dy * r * 0.4); g.lineTo(c.x + dx * r, c.y + dy * r); } g.stroke();
  }
  label(g, Y.x, Y.y - 13, 'YOUR FLEET', YOU);
  sea(g, Y, t, true);
  mine.forEach(s => ship(g, Y, s, { sunk: s.sunk }));
  marks(g, Y, shotsY, 'Y', t);
  if (lastCpu >= 0 && turn === 0) { const c = cellXY('Y', lastCpu); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2; g.strokeRect(c.x - Y.s / 2 + 1, c.y - Y.s / 2 + 1, Y.s - 2, Y.s - 2); }
  // fleet panel: what's left of the enemy fleet
  if (panel.w > 70) {
    label(g, panel.x, panel.y + 4, 'ENEMY SHIPS', 'rgba(31,47,72,.6)');
    const u = Math.min(14, (panel.w - 4) / 5), rowH = Math.min(24, (panel.h - 16) / 5);
    foe.forEach((s, k) => {
      const yy = panel.y + 18 + k * rowH;
      for (let q = 0; q < s.len; q++) { g.fillStyle = s.sunk ? 'rgba(232,69,46,.85)' : 'rgba(31,47,72,.22)'; rrect(g, panel.x + q * (u + 2), yy, u, Math.min(u, rowH - 6), 3); g.fill(); }
    });
    g.font = '600 11px -apple-system,system-ui,sans-serif'; g.fillStyle = 'rgba(31,47,72,.55)'; g.textAlign = 'left';
    g.fillText(`Shots ${myShots} · hits ${myHits}`, panel.x, panel.y + 18 + 5 * rowH + 8);
  }
}
function cellsSafe(s) { const a = []; for (let k = 0; k < s.len; k++) { const r = s.r + (s.h ? 0 : k), c = s.c + (s.h ? k : 0); if (r >= 0 && r < 10 && c >= 0 && c < 10) a.push(r * 10 + c); } return a; }

T.start();
void S0;
