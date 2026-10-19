// phys.js — a tiny 2D rigid-body engine for Grumble Drop (boxes + circles, sequential impulses with warm starting).
// Our own code, MIT. y points up, units are metres.
const cross = (ax, ay, bx, by) => ax * by - ay * bx;

let NEXT_ID = 1;
export function body({ x = 0, y = 0, rot = 0, w = 1, h = 1, r = 0, mass = 1, fixed = false, friction = 0.6, ...extra }) {
  const circle = r > 0;
  const m = fixed ? 0 : mass;
  const I = fixed ? 0 : circle ? 0.5 * m * r * r : m * (w * w + h * h) / 12;
  return { id: NEXT_ID++, x, y, rot, vx: 0, vy: 0, w: 0, hw: w / 2, hh: h / 2, r, circle, fixed,
    im: m ? 1 / m : 0, iI: I ? 1 / I : 0, friction, ...extra };
}

// ---------------------------------------------------------------- collision
// contacts: { x, y (world point), sep, id (feature) }, normal (nx, ny) from A to B
function boxBox(A, B) {
  const ca = Math.cos(A.rot), sa = Math.sin(A.rot), cb = Math.cos(B.rot), sb = Math.sin(B.rot);
  const dx = B.x - A.x, dy = B.y - A.y;
  const axA = [[ca, sa, A.hw], [-sa, ca, A.hh]], axB = [[cb, sb, B.hw], [-sb, cb, B.hh]];
  const proj = (axes, nx, ny) => Math.abs(axes[0][0] * nx + axes[0][1] * ny) * axes[0][2] + Math.abs(axes[1][0] * nx + axes[1][1] * ny) * axes[1][2];
  let best = null;
  for (let ref = 0; ref < 2; ref++) {
    const RA = ref ? axB : axA, IA = ref ? axA : axB;
    for (let k = 0; k < 2; k++) {
      const [nx, ny, he] = RA[k];
      const d = (dx * nx + dy * ny) * (ref ? -1 : 1);
      const sep = Math.abs(d) - he - proj(IA, nx, ny);
      if (sep > 0) return null;
      const bias = ref ? 0.95 * sep - 0.01 : sep;   // prefer A as the reference (stable feature ids)
      if (!best || bias > best.bias) { const s = d >= 0 ? 1 : -1; best = { bias, sep, ref, k, nx: nx * s, ny: ny * s }; }
    }
  }
  const R = best.ref ? B : A, Ib = best.ref ? A : B, RA = best.ref ? axB : axA, IA = best.ref ? axA : axB;
  const nx = best.nx, ny = best.ny;                          // reference normal, pointing from R to I
  const he = RA[best.k][2], tx = -ny, ty = nx, te = RA[1 - best.k][2];
  const fcx = R.x + nx * he, fcy = R.y + ny * he;
  // incident face: the face of I most anti-parallel to n
  let fi = 0, md = Infinity;
  const faces = [[IA[0][0], IA[0][1], IA[0][2], IA[1]], [-IA[0][0], -IA[0][1], IA[0][2], IA[1]], [IA[1][0], IA[1][1], IA[1][2], IA[0]], [-IA[1][0], -IA[1][1], IA[1][2], IA[0]]];
  for (let i = 0; i < 4; i++) { const d = faces[i][0] * nx + faces[i][1] * ny; if (d < md) { md = d; fi = i; } }
  const [fnx, fny, fe, side] = faces[fi];
  const cx = Ib.x + fnx * fe, cy = Ib.y + fny * fe;
  let p = [[cx + side[0] * side[2], cy + side[1] * side[2]], [cx - side[0] * side[2], cy - side[1] * side[2]]];
  // clip against the reference face's side planes
  const clip = (pts, sx, sy, off) => {
    const out = [], d0 = (pts[0][0] - fcx) * sx + (pts[0][1] - fcy) * sy - off, d1 = (pts[1][0] - fcx) * sx + (pts[1][1] - fcy) * sy - off;
    if (d0 <= 0) out.push([pts[0][0], pts[0][1], 0]); if (d1 <= 0) out.push([pts[1][0], pts[1][1], 1]);
    if (d0 * d1 < 0) { const t = d0 / (d0 - d1); out.push([pts[0][0] + t * (pts[1][0] - pts[0][0]), pts[0][1] + t * (pts[1][1] - pts[0][1]), d0 > 0 ? 2 : 3]); }
    return out;
  };
  let c1 = clip(p, tx, ty, te); if (c1.length < 2) return null;
  let c2 = clip(c1, -tx, -ty, te); if (c2.length < 2) return null;
  const out = [];
  for (let i = 0; i < c2.length; i++) {
    const q = c2[i], sep = (q[0] - fcx) * nx + (q[1] - fcy) * ny;
    if (sep <= 0.01) out.push({ x: q[0] - nx * sep * 0.5, y: q[1] - ny * sep * 0.5, sep, id: best.ref * 1000 + best.k * 100 + fi * 10 + i });
  }
  if (!out.length) return null;
  // normal from A to B
  const s = best.ref ? -1 : 1;
  return { nx: nx * s, ny: ny * s, pts: out };
}
function circleBox(C, B, flip) {      // returns normal from B to C (box to circle) unless flip handled by caller
  const c = Math.cos(B.rot), s = Math.sin(B.rot), dx = C.x - B.x, dy = C.y - B.y;
  const lx = dx * c + dy * s, ly = -dx * s + dy * c;
  const qx = Math.max(-B.hw, Math.min(B.hw, lx)), qy = Math.max(-B.hh, Math.min(B.hh, ly));
  let nlx, nly, sep;
  if (qx === lx && qy === ly) {             // centre inside the box
    const ex = B.hw - Math.abs(lx), ey = B.hh - Math.abs(ly);
    if (ex < ey) { nlx = Math.sign(lx) || 1; nly = 0; sep = -ex - C.r; } else { nlx = 0; nly = Math.sign(ly) || 1; sep = -ey - C.r; }
  } else {
    const ddx = lx - qx, ddy = ly - qy, d = Math.hypot(ddx, ddy);
    if (d > C.r + 0.01) return null; nlx = ddx / d; nly = ddy / d; sep = d - C.r;
  }
  const nx = nlx * c - nly * s, ny = nlx * s + nly * c;
  const px = B.x + qx * c - qy * s, py = B.y + qx * s + qy * c;
  return { nx, ny, pts: [{ x: px, y: py, sep, id: 7 }] };   // normal: box -> circle
}
function collide(A, B) {
  if (!A.circle && !B.circle) return boxBox(A, B);
  if (A.circle && B.circle) {
    const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
    if (d > A.r + B.r + 0.01 || d < 1e-6) return null;
    const nx = dx / d, ny = dy / d;
    return { nx, ny, pts: [{ x: A.x + nx * A.r, y: A.y + ny * A.r, sep: d - A.r - B.r, id: 9 }] };
  }
  if (A.circle) { const m = circleBox(A, B); if (!m) return null; m.nx = -m.nx; m.ny = -m.ny; return m; }  // box->circle reversed: A(circle)->B(box)
  return circleBox(B, A);                  // box A -> circle B
}
const radius = (b) => b.circle ? b.r : Math.hypot(b.hw, b.hh);

// ---------------------------------------------------------------- world
export function world({ gravity = -15, iters = 10 } = {}) {
  const bodies = [], arb = new Map();
  const W = {
    bodies, gravity,
    add(b) { bodies.push(b); return b; },
    remove(b) { const i = bodies.indexOf(b); if (i >= 0) bodies.splice(i, 1); for (const k of [...arb.keys()]) { const a = arb.get(k); if (a.A === b || a.B === b) arb.delete(k); } },
    contactsOf(b) { const out = []; for (const a of arb.values()) if (a.A === b || a.B === b) out.push(a); return out; },
    step(dt) {
      // broadphase + narrowphase
      const seen = new Set();
      for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
        let A = bodies[i], B = bodies[j];
        if (A.fixed && B.fixed) continue;
        if (A.id > B.id) [A, B] = [B, A];
        const rr = radius(A) + radius(B) + 0.05;
        if (Math.abs(A.x - B.x) > rr || Math.abs(A.y - B.y) > rr) continue;
        const key = A.id * 100000 + B.id, m = collide(A, B);
        if (!m) continue;
        seen.add(key);
        const old = arb.get(key);
        const cs = m.pts.map(p => { const o = old && old.cs.find(q => q.id === p.id); return { ...p, Pn: o ? o.Pn : 0, Pt: o ? o.Pt : 0 }; });
        arb.set(key, { A, B, nx: m.nx, ny: m.ny, cs, mu: Math.sqrt(A.friction * B.friction) });
      }
      for (const k of [...arb.keys()]) if (!seen.has(k)) arb.delete(k);
      // forces
      for (const b of bodies) if (!b.fixed) { b.vy += gravity * dt; b.vx *= 0.999; b.vy *= 0.999; b.w *= b.circle ? 0.985 : 0.995; }
      // pre-step
      const inv = 1 / dt;
      for (const a of arb.values()) {
        const { A, B, nx, ny } = a, tx = ny, ty = -nx;
        for (const c of a.cs) {
          c.rax = c.x - A.x; c.ray = c.y - A.y; c.rbx = c.x - B.x; c.rby = c.y - B.y;
          const rna = cross(c.rax, c.ray, nx, ny), rnb = cross(c.rbx, c.rby, nx, ny);
          c.mn = 1 / (A.im + B.im + A.iI * rna * rna + B.iI * rnb * rnb);
          const rta = cross(c.rax, c.ray, tx, ty), rtb = cross(c.rbx, c.rby, tx, ty);
          c.mt = 1 / (A.im + B.im + A.iI * rta * rta + B.iI * rtb * rtb);
          c.bias = -0.2 * inv * Math.min(0, c.sep + 0.01);
          const Px = c.Pn * nx + c.Pt * tx, Py = c.Pn * ny + c.Pt * ty;
          A.vx -= A.im * Px; A.vy -= A.im * Py; A.w -= A.iI * cross(c.rax, c.ray, Px, Py);
          B.vx += B.im * Px; B.vy += B.im * Py; B.w += B.iI * cross(c.rbx, c.rby, Px, Py);
        }
      }
      // iterations
      for (let it = 0; it < iters; it++) for (const a of arb.values()) {
        const { A, B, nx, ny, mu } = a, tx = ny, ty = -nx;
        for (const c of a.cs) {
          let dvx = B.vx - B.w * c.rby - A.vx + A.w * c.ray, dvy = B.vy + B.w * c.rbx - A.vy - A.w * c.rax;
          const vn = dvx * nx + dvy * ny;
          let dPn = c.mn * (-vn + c.bias); const P0 = c.Pn; c.Pn = Math.max(P0 + dPn, 0); dPn = c.Pn - P0;
          let Px = dPn * nx, Py = dPn * ny;
          A.vx -= A.im * Px; A.vy -= A.im * Py; A.w -= A.iI * cross(c.rax, c.ray, Px, Py);
          B.vx += B.im * Px; B.vy += B.im * Py; B.w += B.iI * cross(c.rbx, c.rby, Px, Py);
          dvx = B.vx - B.w * c.rby - A.vx + A.w * c.ray; dvy = B.vy + B.w * c.rbx - A.vy - A.w * c.rax;
          const vt = dvx * tx + dvy * ty, maxPt = mu * c.Pn;
          let dPt = c.mt * -vt; const T0 = c.Pt; c.Pt = Math.max(-maxPt, Math.min(maxPt, T0 + dPt)); dPt = c.Pt - T0;
          Px = dPt * tx; Py = dPt * ty;
          A.vx -= A.im * Px; A.vy -= A.im * Py; A.w -= A.iI * cross(c.rax, c.ray, Px, Py);
          B.vx += B.im * Px; B.vy += B.im * Py; B.w += B.iI * cross(c.rbx, c.rby, Px, Py);
        }
      }
      for (const b of bodies) if (!b.fixed) { b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.w * dt; }
    },
    /** largest speed of any moving body (for "has it settled?") */
    energy() { let m = 0; for (const b of bodies) if (!b.fixed) m = Math.max(m, Math.hypot(b.vx, b.vy) + Math.abs(b.w) * radius(b)); return m; },
    /** world point inside a body? */
    hit(b, px, py, pad = 0) {
      if (b.circle) return Math.hypot(px - b.x, py - b.y) <= b.r + pad;
      const c = Math.cos(b.rot), s = Math.sin(b.rot), dx = px - b.x, dy = py - b.y;
      return Math.abs(dx * c + dy * s) <= b.hw + pad && Math.abs(-dx * s + dy * c) <= b.hh + pad;
    },
  };
  return W;
}
