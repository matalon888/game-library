// sim.js — Fling Feud deep v2: the pure throwing physics (no THREE, no DOM), shared by the game, its AI and the QA solver.
// One fixed step (1/240 s) so the game, the foe and the level checker all see the same flight.
export const G = 18, H = 1 / 240, WIND_K = 1;
export const DMG = { head: 50, body: 25 };
// weapon traits (player's pick): spd = launch speed x, r = hit size x, wind = how much wind pushes it, bounce = ground bounces, dh/db = head/body damage x
export const WEAPONS = {
  axe:    { name: 'Axe',    spd: 1,    r: 1,    wind: 1,   bounce: 0, dh: 1,    db: 1,   stars: 0,  tip: 'Balanced' },
  pan:    { name: 'Pan',    spd: 0.95, r: 1.45, wind: 1,   bounce: 0, dh: 0.85, db: 0.85, stars: 3, tip: 'Big hit area' },
  spear:  { name: 'Spear',  spd: 1.12, r: 0.9,  wind: 0.55, bounce: 0, dh: 1,   db: 1.25, stars: 12, tip: 'Flies far, shrugs off wind' },
  shoe:   { name: 'Shoe',   spd: 1,    r: 1.1,  wind: 0.25, bounce: 0, dh: 0.9, db: 0.9, stars: 20, tip: 'Wind barely moves it' },
  wrench: { name: 'Wrench', spd: 1,    r: 1,    wind: 1,   bounce: 1, dh: 1,    db: 1,   stars: 30, tip: 'Bounces once off the ground' },
  baton:  { name: 'Baton',  spd: 1,    r: 0.8,  wind: 1,   bounce: 0, dh: 1.4,  db: 1,   stars: 42, tip: 'Small but hits head hard' },
};
export const WEAPON_ORDER = ['axe', 'pan', 'spear', 'shoe', 'wrench', 'baton'];
export const rngOf = (seed) => { seed = Math.floor(seed) % 2147483647 || 1; return () => (seed = (seed * 16807) % 2147483647) / 2147483647; };

// terrain: same hill recipe as v1, but every number is authored by the level
export function terrain(L) {
  const r = rngOf(L.seed), p0 = -L.d / 2, p1 = L.d / 2, a1 = r() * 6, a2 = r() * 6, amp = L.amp, dy = L.dy;
  const raw = x => Math.sin(x * 0.35 + a1) * amp + Math.sin(x * 0.8 + a2) * amp * 0.35 + (x - p0) / L.d * dy;
  const flat = (x, c) => Math.exp(-((x - c) ** 2) / 1.2);
  const hillF = x => { const w0 = flat(x, p0), w1 = flat(x, p1); return raw(x) * (1 - w0 - w1) + raw(p0) * w0 + raw(p1) * w1; };
  return { hillF, p0, p1 };
}
// ctx: everything a flight needs. foeX is the rival's current spot (it can step between turns).
export function makeCtx(L, foeX) {
  const T = terrain(L), c = { L, hillF: T.hillF, p0: T.p0, p1: T.p1, youX: T.p0, foeX: foeX ?? T.p1, wall: null, bal: null, shield: !!L.shield };
  if (L.wall) { const x = T.p0 + L.wall.fx * L.d; c.wall = { x, top: T.hillF(x) + L.wall.h, w: 0.32 }; }
  if (L.bal) { const x = T.p0 + L.bal.fx * L.d; c.bal = { x, y: T.hillF(x) + L.bal.h, r: 0.7 }; }
  return c;
}
export const handOf = (c, who) => { const x = who === 'you' ? c.youX : c.foeX, f = who === 'you' ? 1 : -1; return { x: x + f * 0.4, y: c.hillF(x) + 2.8 }; };
export const headOf = (c, who) => { const x = who === 'you' ? c.youX : c.foeX; return { x, y: c.hillF(x) + 3.7 }; };
export function launch(c, who, ang, pw, wp = WEAPONS.axe) {
  const v = (8 + pw * 17) * wp.spd, h = handOf(c, who);
  return { who, x: h.x, y: h.y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, t: 0, wp, bal: false, bounces: 0, done: false, kind: null };
}
// one fixed step; sets p.kind when it ends: head | body | shield | wall | miss
export function step(c, p) {
  const wm = (c.L.wind || 0) * WIND_K * (p.wp.wind ?? 1);
  p.vy -= G * H; p.vx += wm * H; p.x += p.vx * H; p.y += p.vy * H; p.t += H;
  if (c.wall && Math.abs(p.x - c.wall.x) < c.wall.w && p.y < c.wall.top && p.y > c.hillF(c.wall.x) - 3) { p.done = true; p.kind = 'wall'; return p; }
  if (p.who === 'you' && c.bal && !p.bal && Math.hypot(p.x - c.bal.x, p.y - c.bal.y) < c.bal.r) p.bal = true;
  if (p.t > 0.08) {
    const tw = p.who === 'you' ? 'foe' : 'you', hd = headOf(c, tw), bx = tw === 'you' ? c.youX : c.foeX, by = c.hillF(bx), R = p.wp.r;
    if (Math.hypot(p.x - hd.x, p.y - hd.y) < 0.6 * R) { p.done = true; p.kind = 'head'; return p; }
    if (tw === 'foe' && c.shield && p.x > bx - 1.05 && p.x < bx - 0.5 && p.y > by + 0.3 && p.y < by + 3.0) { p.done = true; p.kind = 'shield'; return p; }
    if (Math.abs(p.x - bx) < 0.55 * R && p.y > by + 0.4 && p.y < by + 3.05) { p.done = true; p.kind = 'body'; return p; }
  }
  const g = c.hillF(p.x) + 0.05;
  if (p.y < g) {
    if (p.bounces < p.wp.bounce) { p.bounces++; p.y = g; p.vy = Math.abs(p.vy) * 0.62; p.vx *= 0.8; p.hop = true; }
    else { p.done = true; p.kind = 'miss'; p.y = g; }
  }
  if (Math.abs(p.x) > 60 || p.y < -20 || p.t > 8) { p.done = true; p.kind = 'miss'; }
  return p;
}
export function fly(c, who, ang, pw, wp) { const p = launch(c, who, ang, pw, wp); while (!p.done) step(c, p); return p; }
// every (ang, pw) that ends in `want` ('head' by default); stepA/stepP set the grid. Returns [{ang,pw,bal,x,y}]
export function solutions(c, who, wp = WEAPONS.axe, { want = 'head', stepA = 0.01, stepP = 0.01, pmin = 0.2 } = {}) {
  const out = [], f = who === 'you' ? 1 : -1;
  for (let a = -0.3; a <= 1.45; a += stepA) for (let pw = pmin; pw <= 1.0001; pw += stepP) {
    const ang = f > 0 ? a : Math.PI - a, p = fly(c, who, ang, pw, wp);
    if (p.kind === want) out.push({ ang, pw, a, bal: p.bal });
  }
  return out;
}
// the foe's shot / the bot's shot: a head hit with the lowest power that has one (flat, like a thrower would), found in a window around
// the no-wind guess first (fast), over the whole grid if the window finds nothing (walls need lobs)
export function bestShot(c, who, wp = WEAPONS.axe, o = {}) {
  const f = who === 'you' ? 1 : -1, h = handOf(c, who), t = headOf(c, who === 'you' ? 'foe' : 'you');
  const dx = (t.x - h.x) * f, dy = t.y - h.y;
  const ok = (a, pw) => { const ang = f > 0 ? a : Math.PI - a, p = fly(c, who, ang, pw, wp); return p.kind === 'head' ? { ang, a, pw, bal: p.bal } : null; };
  const pickOf = (S) => {
    if (!S.length) return null;
    if (o.balloon) { const B = S.filter(s => s.bal); if (B.length) S = B; }
    const lo = Math.min(...S.map(s => s.pw)), band = S.filter(s => s.pw - lo < 0.04), la = Math.min(...band.map(s => s.a)), cl = band.filter(s => s.a - la < 0.06);
    return cl[Math.floor(cl.length / 2)];
  };
  const S = [];
  for (let pw = 0.3; pw <= 1.0001; pw += 0.05) {
    const v = (8 + pw * 17) * wp.spd, disc = v ** 4 - G * (G * dx * dx + 2 * dy * v * v); if (disc < 0) continue;
    const a0 = Math.atan((v * v - Math.sqrt(disc)) / (G * dx));
    for (let a = a0 - 0.28; a <= a0 + 0.28; a += 0.01) { if (a < -0.3 || a > 1.45) continue; for (let q = pw - 0.04; q <= pw + 0.04; q += 0.01) { const r = ok(a, q); if (r) S.push(r); } }
    if (S.length > 40) break;
  }
  let r = pickOf(S);
  if (!r) { for (let a = -0.3; a <= 1.45; a += 0.015) for (let pw = 0.2; pw <= 1.0001; pw += 0.015) { const q = ok(a, pw); if (q) S.push(q); } r = pickOf(S); }
  return r ? { ang: r.ang, pw: r.pw, bal: r.bal } : null;
}
// damage rules in one place
export function damage(kind, wp, combo, bal) {
  if (kind === 'shield' || kind === 'wall' || kind === 'miss') return 0;
  const base = kind === 'head' ? DMG.head * wp.dh : DMG.body * wp.db;
  return Math.round(base * (1 + 0.25 * Math.min(2, combo)) * (bal ? 1.5 : 1));
}
