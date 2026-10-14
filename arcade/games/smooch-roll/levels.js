// levels.js — seeded procedural levels for Smooch Roll. Every level is proven solvable: we simulate candidate ink strokes
// with the real physics and keep the first one that makes the balls touch (that stroke is also what bot() draws).
import { World, StrokeBuilder, makeBall, makeInk, BALL_R, INK_R } from './physics.js';
function rng(seed) { seed = Math.floor(seed) % 2147483647 || 1; return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }

export const WW = 400, WH = 820;

// sine-sag curve from (x0,y0) to (x1,y1), sagging `sag` px at the middle (negative = bulge up)
function curve(x0, y0, x1, y1, sag, n = 0) {
  const len = Math.hypot(x1 - x0, y1 - y0) + Math.abs(sag) * 2, N = n || Math.max(12, Math.ceil(len / 3)), pts = [];
  for (let i = 0; i <= N; i++) { const t = i / N; pts.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t + sag * Math.sin(Math.PI * t) }); }
  return pts;
}
const box = (x, y, hw, hh, a = 0) => ({ t: 'b', x, y, hw, hh, a });
const circ = (x, y, r) => ({ t: 'c', x, y, r });
function topPoint(b, lx, lift) { // point on the top face of a box at local x, lifted along the normal
  const c = Math.cos(b.a), s = Math.sin(b.a), nx = s, ny = -c;
  return { x: b.x + lx * c + nx * (b.hh + lift), y: b.y + lx * s + ny * (b.hh + lift) };
}

function tCatch(R, level, variant) {
  const sep = Math.min(230, 120 + Math.min(level, 16) * 5 + R() * 40);
  const cx = 200 + (R() - 0.5) * 40, yL = 300 + R() * 90, yR = yL + (level > 3 ? (R() - 0.5) * 70 : 0);
  const xL = cx - sep / 2, xR = cx + sep / 2, yM = Math.max(yL, yR), statics = [];
  if (variant === 0) {
    statics.push(circ(xL - 20 - R() * 20, yM + 150 + R() * 60, 16 + R() * 14));
    statics.push(circ(xR + 20 + R() * 20, yM + 150 + R() * 60, 16 + R() * 14));
  } else if (variant === 1) {
    statics.push(circ(xL - 28 - R() * 12, yM + 140 + R() * 40, 36 + R() * 12));
    statics.push(circ(xR + 34 + R() * 12, yM + 175 + R() * 40, 9 + R() * 4));
  } else {
    const w = 50 + R() * 30; statics.push(box(cx + (R() - 0.5) * 30, yM + 200 + R() * 40, w, 12, (R() - 0.5) * 0.2));
    statics.push(circ(xL - 50, yM + 250 + R() * 40, 10)); statics.push(circ(xR + 50, yM + 250 + R() * 40, 10));
  }
  if (level >= 4 && R() < 0.55) statics.push(circ(cx + (R() - 0.5) * 20, (yL + yR) / 2 + R() * 20, 14 + R() * 10));
  if (level >= 6 && R() < 0.5) statics.push(box(cx, Math.min(yL, yR) - 70 - R() * 40, 30 + R() * 30, 9, (R() - 0.5) * 0.6));
  const cands = [];
  for (const d of [80, 115, 150, 60]) for (const ext of [48, 72]) for (const e0 of [28, 0])
    cands.push(curve(xL - ext, yL + e0, xR + ext, yR + e0, (yM + d) - ((yL + yR) / 2 + e0)));
  return { balls: [{ x: xL, y: yL }, { x: xR, y: yR }], statics, cands, kind: 'catch' };
}

function tLedges(R, level) {
  const g = 92 + R() * 40 + Math.min(level, 20) * 2, L = Math.min(128 + R() * 30, (372 - g) / 2), hh = 10;
  const aL = 0.12 + R() * 0.12, aR = 0.12 + R() * 0.12;
  const yi = 430 + R() * 120, yj = yi + (level > 4 ? (R() - 0.5) * 90 : 0);
  const xi = 200 - g / 2, xj = 200 + g / 2;
  const bl = box(xi - Math.cos(aL) * L / 2, yi - Math.sin(aL) * L / 2, L / 2, hh, aL);
  const br = box(xj + Math.cos(aR) * L / 2, yj - Math.sin(aR) * L / 2, L / 2, hh, -aR);
  const pb = topPoint(bl, -L / 2 + 27, BALL_R), pp = topPoint(br, L / 2 - 27, BALL_R);
  const statics = [bl, br], yb = Math.max(yi, yj);
  statics.push(circ(xi + 6 + R() * 16, yb + 105 + R() * 50, 10 + R() * 9), circ(xj - 6 - R() * 16, yb + 105 + R() * 50, 10 + R() * 9));
  if (level >= 5 && R() < 0.5) statics.push(circ(200 + (R() - 0.5) * 30, Math.min(yi, yj) - 60 - R() * 50, 14 + R() * 12));
  const cands = [];
  for (const sag of [70, 100, 45, 130]) {
    const a = topPoint(bl, L / 2, -3), b = topPoint(br, -L / 2, -3);
    cands.push(curve(a.x + INK_R + 4, a.y, b.x - INK_R - 4, b.y, sag));
  }
  for (const inset of [30, 12, 50]) for (const sag of [45, 75, 25, 110]) {
    const a = topPoint(bl, L / 2 - inset, INK_R + 3), b = topPoint(br, -L / 2 + inset, INK_R + 3);
    cands.push(curve(a.x, a.y, b.x, b.y, sag));
  }
  return { balls: [pb, pp], statics, cands, kind: 'ledges' };
}

function tRamp(R, level) {
  const L1 = 120 + R() * 30, a1 = 0.09 + R() * 0.08, y1 = 290 + R() * 90;
  const hi = box(26 + L1 / 2 + R() * 14, y1, L1 / 2, 10, a1);
  const L2 = 110 + R() * 25, y2 = y1 + 230 + R() * 110, x2 = 268 + R() * 22;
  const lo = box(x2 + L2 / 2 - 30, y2, L2 / 2, 10, 0);
  const statics = [hi, lo, circ(lo.x + L2 / 2 - 8, y2 - 24, 12)];
  const pb = topPoint(hi, -L1 / 2 + 28, BALL_R), pp = topPoint(lo, L2 / 2 - 38, BALL_R);
  if (level >= 5 && R() < 0.5) statics.push(circ((hi.x + lo.x) / 2 + 10, (y1 + y2) / 2 - 70 - R() * 30, 14 + R() * 10));
  const cands = [];
  for (const sag of [10, 30, -12, 55]) for (const inset of [6, 24]) {
    const a = topPoint(hi, L1 / 2 - inset, INK_R + 3), b = topPoint(lo, -L2 / 2 + 3, INK_R + 3);
    cands.push(curve(a.x, a.y, b.x - 2, b.y, sag));
  }
  return { balls: [pb, pp], statics, cands, kind: 'ramp' };
}

function mirror(spec) {
  const m = (p) => ({ ...p, x: WW - p.x });
  spec.balls = spec.balls.map(m).reverse();     // blue stays first, now on the right
  spec.statics = spec.statics.map(s => s.t === 'b' ? { ...s, x: WW - s.x, a: -s.a } : m(s));
  spec.cands = spec.cands.map(c => c.map(m).reverse());
  return spec;
}

export function buildWorld(spec) {
  const w = new World();
  for (const s of spec.statics) w.addStatic(s);
  w.balls = [w.add(makeBall(spec.balls[0].x, spec.balls[0].y, 'blue')), w.add(makeBall(spec.balls[1].x, spec.balls[1].y, 'pink'))];
  return w;
}
export const outOfWorld = (b) => b.y > WH + 60 || b.x < -70 || b.x > WW + 70;

/** run the real physics with one stroke; returns { win, used } */
export function simulate(spec, raw, maxT = 7) {
  const w = buildWorld(spec), sb = new StrokeBuilder(w, 1e9);
  for (const p of raw) sb.add(p.x, p.y);
  if (sb.samples.length < 3) return { win: false, used: 0 };
  w.add(makeInk(sb.samples));
  let win = false, rest = 0; w.touch = () => { win = true; };
  for (let f = 0; f < maxT * 60; f++) {
    w.step(1 / 60);
    if (win) return { win: true, used: sb.used, t: f / 60 };
    if (w.balls.some(outOfWorld)) return { win: false, used: sb.used };
    rest = w.energy() < 6 ? rest + 1 : 0; if (rest > 60) break;
  }
  return { win: false, used: sb.used };
}

function design(level, attempt) {
  const R = rng(level * 7919 + attempt * 104729 + 13);
  let t;
  if (level === 1) t = tCatch(R, 1, 1);
  else if (level === 2) t = tLedges(R, 2);
  else if (level === 3) t = tCatch(R, 3, 0);
  else if (level === 4) t = tRamp(R, 4);
  else { const k = Math.floor(R() * 5); t = k < 2 ? tCatch(R, level, Math.floor(R() * 3)) : k < 4 ? tLedges(R, level) : tRamp(R, level); }
  if (level > 2 && R() < 0.5) mirror(t);
  return t;
}

export function makeLevel(level) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const spec = design(level, attempt);
    if (simulate(spec, curve(6, 806, 26, 806, 0), 5).win) continue;     // must not solve itself
    for (const c of spec.cands) {
      const r = simulate(spec, c);
      if (r.win) {
        const budget = Math.round(Math.max(r.used * Math.max(1.3, 1.75 - level * 0.02), r.used + 90));
        return { ...spec, solution: c, solUsed: r.used, budget, attempt };
      }
    }
  }
  const spec = design(1, 0); const c = spec.cands[0];
  return { ...spec, solution: c, solUsed: 300, budget: 600, attempt: -1 };
}
