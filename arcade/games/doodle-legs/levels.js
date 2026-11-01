// levels.js — Doodle Legs v2: 30 hand-made races in 3 worlds. A level = a string of track pieces, in order.
// Pieces: S step (S.5 = 0.5 high) · T stairs · W wall (W1.1) · D drop (D.9) · U tunnel (U1.2 = roof height) · B bumps · G gap (G1.6 = width)
//         · C chicane = wall then tunnel right after (one redraw in 1 s) · R rest = flat run (R4 = 4 long)
// Each level: purpose = what it teaches/tests, rv = rival speed feel (0.70 slow … 0.88 quick; the tuner's flow.k() still scales it),
// par = seconds to the flag for 3 stars. Gems (3 per level) are placed by buildCourse on the hard line of the 3 hardest pieces.
import { BEAM } from './physics.js';

export const WORLDS = [
  { name: 'Doodle Meadow', ico: '🌼', bg: ['#8f9cf7', '#e9b9f4'], ui: '#ff5d8f', tag: 'big legs climb' },
  { name: 'Tunnel Town', ico: '🏘️', bg: ['#7fb6ff', '#c7f0ff'], ui: '#2f8fff', tag: 'small legs squeeze' },
  { name: 'Gap Peaks', ico: '🏔️', bg: ['#ff9ec7', '#ffd9a8'], ui: '#ff7a3d', tag: 'bridge the gaps' },
];

export const LEVELS = [
  // ---- world 1: Doodle Meadow — one idea: bigger loops climb bigger things
  { p: 'tap to grow legs and race', t: 'T R2 S T R2 D.6 T', rv: 0.55, par: 14 },
  { p: 'a single step, tap or draw', t: 'S T D.5 S T S R2 T', rv: 0.62, par: 16 },
  { p: 'first wall: draw a BIG loop', t: 'S W.9 R2 S W.9 T D.6 W.9', rv: 0.68, par: 17 },
  { p: 'drop then climb: legs keep working', t: 'D.7 S W1 R2 D.8 T W1 D.6 S', rv: 0.70, par: 19 },
  { p: 'bumps: rough ground, any legs', t: 'B S B R2 B T B S W.9', rv: 0.72, par: 20 },
  { p: 'stairs into a wall', t: 'T W1 R2 T W1 D.9 T W1.1', rv: 0.74, par: 21 },
  { p: 'two walls, rest between', t: 'W1 R3 W1.1 B R2 W1.1 T W1.2', rv: 0.62, par: 24 },
  { p: 'staircase of drops and steps', t: 'S D.9 S T D.6 S W1 D.9 T D.6 B', rv: 0.68, par: 26 },
  { p: 'HARD: tall wall twice', t: 'W1.2 B W1.25 R2 T W1.2 D1 W1.3', rv: 0.71, par: 28, hard: 1 },
  { p: 'breather: long easy hills', t: 'T D.8 T D.8 S T D.8 S B T', rv: 0.66, par: 24 },
  // ---- world 2: Tunnel Town — tiny circles squeeze under roofs; draw small, then big again
  { p: 'first tunnel: tap the small wheel', t: 'R3 U1.45 R3 U1.45 S', rv: 0.5, par: 16 },
  { p: 'tunnel, step, tunnel', t: 'U1.35 S U1.35 T U1.3 S U1.25 R2', rv: 0.6, par: 20 },
  { p: 'stairs then a low roof', t: 'T U1.2 D.6 T U1.2 S U1.2 B', rv: 0.70, par: 20 },
  { p: 'bumps under a roof: small legs bounce less', t: 'B U1.2 B R2 U1.2 B S U1.2', rv: 0.72, par: 22 },
  { p: 'long tunnel, hold the small wheel', t: 'U1.15 R2 W.9 U1.15 R2 W.9 U1.15 T', rv: 0.74, par: 24 },
  { p: 'chicane: wall then roof at once', t: 'C S C R2 T C D.8 C', rv: 0.76, par: 26 },
  { p: 'drops into tunnels', t: 'D.8 U1.2 D.6 U1.2 T D.7 U1.2 S U1.2', rv: 0.76, par: 26 },
  { p: 'low roofs, tall walls, in turn', t: 'W1.1 U1.15 W1.1 U1.15 B W1.1 U1.15 W1.2', rv: 0.78, par: 28 },
  { p: 'HARD: chicanes back to back', t: 'C C B C T C C D.9 C', rv: 0.82, par: 36, hard: 1 },
  { p: 'breather: wide tunnels, kind stairs', t: 'T U1.35 T U1.35 D.8 U1.35 T D.8 U1.35', rv: 0.66, par: 30 },
  // ---- world 3: Gap Peaks — pits: bridge with big legs, rivals fall in too
  { p: 'first gap: a big loop bridges it', t: 'R2 G1.0 S G1.0 R2 G1.1 T', rv: 0.64, par: 16 },
  { p: 'two gaps, steps between', t: 'G1.2 S G1.3 T G1.3 S D.6 G1.4', rv: 0.70, par: 20 },
  { p: 'a gap after a wall', t: 'W.9 G1.4 S W1 G1.5 R2 W1 G1.4', rv: 0.72, par: 22 },
  { p: 'gap, tunnel: switch size mid-air', t: 'G1.2 R1 U1.2 G1.3 R1 U1.2 S G1.4 U1.2', rv: 0.74, par: 24 },
  { p: 'stairs up, gap, drop down', t: 'T G1.5 D.9 S G1.5 T G1.6 D.9 G1.4', rv: 0.76, par: 25 },
  { p: 'wide gap: draw the biggest loop you can', t: 'S G2.0 S G2.0 T G1.8 D.7 G2.2 S', rv: 0.77, par: 27 },
  { p: 'bumps then gap then roof', t: 'B G1.4 U1.2 B G1.5 U1.2 T G1.6 U1.2', rv: 0.79, par: 28 },
  { p: 'everything: wall, gap, roof, drop', t: 'W1.1 G1.5 U1.2 D.8 W1.1 G1.6 U1.2 D.8 B G1.5', rv: 0.80, par: 30 },
  { p: 'HARD: chicane over a gap', t: 'C G1.8 C G1.6 T C G2.0 C', rv: 0.84, par: 34, hard: 1 },
  { p: 'FINAL: the long peak road', t: 'T W1 G1.6 C B G1.8 U1.2 D.9 W1.2 G1.8 C B T G2.0 C W1.3', rv: 0.86, par: 40, hard: 1 },
];

const num = (s, d) => (s.length > 1 ? parseFloat(s.slice(1)) : d);

/** returns { rects, features, finish, startY, gems:[{x,y}], gaps:[{x0,x1}] } — same shape as physics.course() plus gems/gaps */
export function buildCourse(spec) {
  const rects = [], features = [], gems = [], gaps = []; let x = -6, top = 0, prevTop = 0;
  const floor = (len, t) => { const q = { x0: x, x1: x + len, y0: Math.min(t, prevTop) - BEAM, y1: t, kind: 'floor' }; rects.push(q); prevTop = t; top = t; x += len; return q; };
  const tunnel = (c, len) => { const t = top; floor(2.6, t); const cx0 = x; floor(len, t); floor(3, t); rects.push({ x0: cx0, x1: cx0 + len, y0: t + c, y1: t + c + 5, kind: 'ceil' }); features.push({ x0: cx0 - 0.9, x1: cx0 + len, kind: 'tunnel', h: c }); return cx0 + len / 2; };
  const wall = (hh) => { const x0 = x; floor(3.8, top + hh); features.push({ x0, x1: x0 + 0.5, kind: 'wall', h: hh }); return x0; };
  floor(9, 0);
  const hard = [];   // gem spots: [x, y, weight]
  for (const tok of spec.t.split(/\s+/)) {
    const k = tok[0], x0 = x;
    if (k === 'S') { const hh = num(tok, 0.5); floor(3.4, top + hh); features.push({ x0, x1: x0 + 0.5, kind: 'step', h: hh }); hard.push([x0 + 0.6, top + 0.95, hh]); }
    else if (k === 'T') { const m = 4, hh = 0.3; for (let j = 0; j < m; j++) floor(0.85, top + hh); floor(2.5, top); features.push({ x0, x1: x, kind: 'stairs', h: hh * m }); hard.push([x0 + 2.2, top - 0.2, 1.2]); }
    else if (k === 'W') { const hh = num(tok, 1); const wx = wall(hh); hard.push([wx + 0.9, top + 0.9, hh * 1.4]); }
    else if (k === 'D') { const hh = num(tok, 0.8); floor(3.4, top - hh); features.push({ x0, x1: x0 + 0.5, kind: 'down', h: hh }); }
    else if (k === 'U') { const c = num(tok, 1.2), len = 4.2; const mx = tunnel(c, len); hard.push([mx, top + 0.45, 2 - c + 1]); }
    else if (k === 'B') { const t = top; floor(1, t); const bx = x; floor(4.6, t); for (let j = 0; j < 2; j++) rects.push({ x0: bx + 0.6 + j * 2.1, x1: bx + 1.15 + j * 2.1, y0: t - 0.05, y1: t + 0.45, kind: 'block' }); features.push({ x0: bx, x1: bx + 4.6, kind: 'bumps', h: 0.55 }); hard.push([bx + 1.9, t + 1.05, 0.9]); }
    else if (k === 'G') { const w = num(tok, 1.4); floor(2.2, top); const gx = x; x += w; gaps.push({ x0: gx, x1: gx + w }); prevTop = top; floor(3.2, top); features.push({ x0: gx - 0.6, x1: gx + w, kind: 'gap', h: w }); hard.push([gx + w / 2, top + 1.15, 1 + w]); }
    else if (k === 'C') { const wx = wall(1.0); const mx = tunnel(1.25, 3.4); hard.push([mx, top + 0.45, 2.2]); features.push({ x0: wx, x1: wx + 0.5, kind: 'chicane', h: 1 }); }
    else if (k === 'R') floor(num(tok, 3), top);
  }
  floor(2, top); const finish = x; floor(10, top);
  rects.sort((a, b) => a.x0 - b.x0);
  hard.sort((a, b) => b[2] - a[2]);
  const pick = hard.slice(0, 3).sort((a, b) => a[0] - b[0]);
  for (const [gx, gy] of pick) gems.push({ x: gx, y: gy });
  return { rects, features, finish, startY: 0, gems, gaps };
}

/** a gem is picked up when the cube centre or any point of the drawn legs comes within r of it */
export function touchGem(r, g, rad = 0.5) {
  if (Math.hypot(r.x - g.x, r.y - g.y) < rad + 0.25) return true;
  const c = Math.cos(r.th), s = Math.sin(r.th);
  for (let i = 0; i < r.pts.length; i += 2) { const [lx, ly] = r.pts[i]; if (Math.hypot(r.x + c * lx - s * ly - g.x, r.y + s * lx + c * ly - g.y) < rad) return true; }
  return false;
}

// Daily Race: same course for everyone today. 9 pieces from the pieces the player has met, tamer values, seeded by the date.
export function dailySpec(day) {
  let s = day % 2147483647 || 1; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const pool = ['S', 'S.6', 'T', 'W.9', 'W1', 'W1.1', 'D.7', 'D.9', 'U1.25', 'U1.2', 'B', 'G1.3', 'G1.5', 'G1.7', 'C', 'R2'];
  const out = []; let last = '';
  for (let i = 0; i < 9; i++) { let k = pool[Math.floor(R() * pool.length)]; if (k[0] === last) k = pool[(pool.indexOf(k) + 5) % pool.length]; last = k[0]; out.push(k); }
  return { p: 'Daily Race: same track for everyone today', t: out.join(' '), rv: 0.74 + R() * 0.04, par: 0 };
}

// hats: every 4 stars unlocks the next one (worn on the player's cube only)
export const HATS = ['none', 'cap', 'party', 'bow', 'antenna', 'tophat', 'halo', 'horns', 'flower', 'phones', 'wizard', 'prop'];
