// physics.js — tiny 2D "wheel-legs" racer sim for Doodle Legs (our own code, no libraries).
// A racer is an upright cube with an axle; the drawn stroke is a rigid shape bolted to the axle and spun by a motor.
// Position-based dynamics: predict -> spin legs -> stick the deepest leg contact (friction drives the body) -> push out
// of terrain (rects) -> velocity from the corrected position. 8 substeps / frame, side-aware push-out = no tunnelling.
export const G = 24, HALF = 0.32, MU = 0.92, VMAX = 13;

// cube perimeter samples (so step corners can't poke through the body)
const CUBE = [];
for (let i = 0; i < 6; i++) { const t = -HALF + (2 * HALF * i) / 5; CUBE.push([t, -HALF], [t, HALF], [-HALF, t], [HALF, t]); }

export function makeRacer(x, y) {
  return { x, y, vx: 0, vy: 0, th: 0, pts: [], R: 0, contact: false, wasContact: false, air: 0, ground: false, impact: 0 };
}

/** resample a polyline (world units, relative to the axle) to even spacing */
export function resample(pts, sp = 0.05) {
  if (pts.length < 2) return pts.slice();
  const out = [pts[0].slice()]; let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    let [ax, ay] = pts[i - 1]; const [bx, by] = pts[i]; let seg = Math.hypot(bx - ax, by - ay), d = sp - carry;
    while (d <= seg) { const t = d / seg; out.push([ax + (bx - ax) * t, ay + (by - ay) * t]); d += sp; }
    carry = seg - (d - sp);
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}

export function setShape(r, pts, rects) {
  r.pts = resample(pts, 0.045); r.R = 0;
  for (const [x, y] of r.pts) r.R = Math.max(r.R, Math.hypot(x, y));
  if (rects) {   // pop up so the new legs stand on the ground instead of spawning inside it
    const c = Math.cos(r.th), s = Math.sin(r.th); let lift = 0;
    for (const [lx, ly] of r.pts) {
      const wx = r.x + c * lx - s * ly, wy = r.y + s * lx + c * ly;
      for (const q of rects) if (q.kind !== 'ceil' && wx > q.x0 && wx < q.x1 && wy < q.y1 && wy > q.y0 - 2) lift = Math.max(lift, q.y1 - wy + 0.02);
    }
    r.y += lift; if (lift > 0) r.vy = Math.max(r.vy, 2);
  }
}

// point vs rect: returns [nx, ny, depth] or null. (ax, ay) = where the point was before this substep (decides the side)
function pen(wx, wy, ax, ay, q) {
  if (wx <= q.x0 || wx >= q.x1 || wy <= q.y0 || wy >= q.y1) return null;
  const e = 0.002;
  if (ay >= q.y1 - e) return [0, 1, q.y1 - wy];
  if (ay <= q.y0 + e) return [0, -1, wy - q.y0];
  if (ax <= q.x0 + e) return [-1, 0, wx - q.x0];
  if (ax >= q.x1 - e) return [1, 0, q.x1 - wx];
  const dU = q.y1 - wy, dD = wy - q.y0, dL = wx - q.x0, dR = q.x1 - wx, m = Math.min(dU, dD, dL, dR);
  return m === dU ? [0, 1, dU] : m === dD ? [0, -1, dD] : m === dL ? [-1, 0, dL] : [1, 0, dR];
}

/** advance one racer by dt seconds. rects: [{x0,x1,y0,y1}] sorted by x0. omega: motor rad/s (negative = forward) */
export function step(r, rects, dt, omega, N = 8) {
  const h = dt / N; r.contact = false; r.ground = false; r.impact = 0;
  const reach = r.R + HALF + 0.6;
  const near = rects.filter(q => q.x1 > r.x - reach - 1 && q.x0 < r.x + reach + 1);
  const P = r.pts, n = P.length, hasCeil = near.some(q => q.kind === 'ceil');
  for (let s = 0; s < N; s++) {
    const ox = r.x, oy = r.y, c0 = Math.cos(r.th), s0 = Math.sin(r.th);
    r.vy -= G * h;
    let px = ox + r.vx * h, py = oy + r.vy * h;
    if (n) r.th += omega * h;
    const c1 = Math.cos(r.th), s1 = Math.sin(r.th);
    // 1) friction: the deepest leg contact sticks to the surface -> the spinning shape walks the body
    let best = null, bd = 0;
    for (let i = 0; i < n; i++) {
      const lx = P[i][0], ly = P[i][1];
      const wx = px + c1 * lx - s1 * ly, wy = py + s1 * lx + c1 * ly, ax = ox + c0 * lx - s0 * ly, ay = oy + s0 * lx + c0 * ly;
      for (const q of near) { const p = pen(wx, wy, ax, ay, q); if (p && p[2] > bd) { bd = p[2]; best = [p[0], p[1], wx - ax, wy - ay]; } }
    }
    if (best) {
      const tx = -best[1], ty = best[0], sl = best[2] * tx + best[3] * ty;
      px -= tx * sl * MU; py -= ty * sl * MU; r.contact = true;
    }
    // 2) push out of terrain (legs + cube), deepest first, a few iterations
    for (let it = 0; it < 6; it++) {
      let bx = 0, by = 0, bdep = 0, cube = false;
      for (let i = 0; i < n; i++) {
        const lx = P[i][0], ly = P[i][1];
        const wx = px + c1 * lx - s1 * ly, wy = py + s1 * lx + c1 * ly, ax = ox + c0 * lx - s0 * ly, ay = oy + s0 * lx + c0 * ly;
        for (const q of near) { const p = pen(wx, wy, ax, ay, q); if (p && p[2] > bdep) { bdep = p[2]; bx = p[0]; by = p[1]; cube = false; } }
      }
      for (const [cx, cy] of CUBE) {
        for (const q of near) { const p = pen(px + cx, py + cy, ox + cx, oy + cy, q); if (p && p[2] > bdep) { bdep = p[2]; bx = p[0]; by = p[1]; cube = true; } }
      }
      if (bdep <= 0) break;
      px += bx * bdep; py += by * bdep;
      if (by > 0.5) r.ground = true;
      if (cube && by > 0.5) { const vx = (px - ox) / h; px = ox + vx * 0.86 * h; }   // cube skids, it doesn't walk
    }
    // 3) jammed (shape wedged between floor and ceiling / inside a step): the motor stalls, the body stays put
    if (n && hasCeil) {
      let res = 0;
      for (let i = 0; i < n; i += 2) {
        const lx = P[i][0], ly = P[i][1], wx = px + c1 * lx - s1 * ly, wy = py + s1 * lx + c1 * ly;
        for (const q of near) { if (q.kind !== 'ceil') continue; const p = pen(wx, wy, wx, wy, q); if (p && p[2] > res) res = p[2]; }
      }
      if (res > 0.05) { r.th -= omega * h; px = ox + (px - ox) * 0.3; r.jam = (r.jam || 0) + h; }
      else r.jam = Math.max(0, (r.jam || 0) - h * 0.5);
    }
    let vx = (px - ox) / h, vy = (py - oy) / h;
    if (r.vy < -6 && vy > r.vy + 4) r.impact = Math.max(r.impact, -r.vy);
    const sp = Math.hypot(vx, vy); if (sp > VMAX) { vx *= VMAX / sp; vy *= VMAX / sp; }
    r.x = px; r.y = py; r.vx = vx * 0.999; r.vy = vy;
  }
  if (r.contact || r.ground) r.air = 0; else r.air += dt;
}

// ---------------------------------------------------------------- course generation (seeded)
function rng(seed) { seed = Math.floor(seed) % 2147483647 || 1; return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
export const BEAM = 0.55;

/** returns { rects, floor: [{x0,x1,top}], ceil: rects, finish, features:[{x0,x1,kind,h}] } */
export function course(level) {
  const R = rng(level * 7919 + 13), rects = [], features = [];
  let x = -6, top = 0, prevTop = 0;
  const floor = (len, t) => { const q = { x0: x, x1: x + len, y0: Math.min(t, prevTop) - BEAM, y1: t, kind: 'floor' }; rects.push(q); prevTop = t; top = t; x += len; return q; };
  floor(9, 0);
  const n = Math.min(5 + 2 * level, 16), pool = ['step', 'stairs', 'wall', 'down', 'tunnel', 'bumps'];
  let last = '';
  for (let i = 0; i < n; i++) {
    let k = pool[Math.floor(R() * pool.length)];
    if (level <= 1 && i === 0) k = 'stairs';
    if (level <= 2 && k === 'tunnel' && i < 2) k = 'step';
    if (k === last) k = pool[(pool.indexOf(k) + 1) % pool.length];
    last = k;
    const x0 = x;
    if (k === 'step') { const hh = 0.35 + R() * Math.min(0.5, 0.15 + level * 0.06); floor(3 + R() * 2, top + hh); features.push({ x0, x1: x0 + 0.5, kind: k, h: hh }); }
    else if (k === 'stairs') { const m = 3 + Math.floor(R() * 2), hh = 0.28 + R() * 0.1; for (let j = 0; j < m; j++) floor(0.85, top + hh); floor(2.5, top); features.push({ x0, x1: x, kind: k, h: hh * m }); }
    else if (k === 'wall') { const hh = Math.min(1.25, 0.85 + R() * 0.2 + level * 0.03); floor(3.5 + R() * 2, top + hh); features.push({ x0, x1: x0 + 0.5, kind: k, h: hh }); }
    else if (k === 'down') { const hh = 0.6 + R() * 0.9; floor(3 + R() * 2, top - hh); features.push({ x0, x1: x0 + 0.5, kind: k, h: hh }); }
    else if (k === 'tunnel') {
      const len = 3.5 + R() * 2, c = 1.12 + R() * 0.18, t = top;
      floor(2.6, t); const cx0 = x; floor(len, t); floor(3, t);
      rects.push({ x0: cx0, x1: cx0 + len, y0: t + c, y1: t + c + 5, kind: 'ceil' });
      features.push({ x0: cx0 - 0.9, x1: cx0 + len, kind: k, h: c });
    } else if (k === 'bumps') {
      const t = top; floor(1, t); const bx = x; floor(4.6, t);
      for (let j = 0; j < 2; j++) { const hh = 0.35 + R() * 0.2; rects.push({ x0: bx + 0.6 + j * 2.1, x1: bx + 1.15 + j * 2.1, y0: t - 0.05, y1: t + hh, kind: 'block' }); }
      features.push({ x0: bx, x1: bx + 4.6, kind: k, h: 0.55 });
    }
  }
  floor(2, top); const finish = x; floor(10, top);
  rects.sort((a, b) => a.x0 - b.x0);
  return { rects, features, finish, startY: 0 };
}

/** floor height under x (for spawning) */
export function floorAt(c, x) { let t = -99; for (const q of c.rects) if (q.kind === 'floor' && x >= q.x0 && x < q.x1) t = Math.max(t, q.y1); return t; }
