// Tiny rigid-body physics for the trinket heap: every body is a cluster of spheres (built from the model's bounding box),
// colliding with a box (floor + 4 walls) and with each other. Sequential impulses with friction, position projection
// and sleeping. Good enough for a heap that tumbles, settles and shuffles; cheap enough for ~70 bodies on a phone.
import { THREE } from './kit/hc.js';

const V = THREE.Vector3, Q = THREE.Quaternion;
const tmp = new V(), tmp2 = new V(), rA = new V(), rB = new V(), vel = new V(), cr = new V(), imp = new V(), tng = new V();

/** sphere cluster for a box of size [x, y, z] (already scaled). Returns [{l: Vector3 (local), r}] */
export function clusterFor(size) {
  const ax = [0, 1, 2].sort((a, b) => size[b] - size[a]);           // largest → smallest
  const a = size[ax[0]], b = size[ax[1]], c = size[ax[2]];
  const r = Math.max(c * 0.5, a * 0.17);                            // radius from the thin side (never needle-thin)
  const n1 = Math.max(1, Math.min(3, Math.round(a / (2 * r) + 0.2)));
  const n2 = Math.max(1, Math.min(2, Math.round(b / (2 * r) + 0.1)));
  const out = [];
  for (let i = 0; i < n1; i++) for (let j = 0; j < n2; j++) {
    const l = new V();
    const u = n1 === 1 ? 0 : (i / (n1 - 1) - 0.5) * (a - 2 * r) * 0.95;
    const w = n2 === 1 ? 0 : (j / (n2 - 1) - 0.5) * (b - 2 * r) * 0.95;
    l.setComponent(ax[0], u); l.setComponent(ax[1], w);
    const rr = n1 === 1 && n2 === 1 ? Math.min(a, b, Math.max(c, (a + b + c) / 3)) * 0.5 : r;
    out.push({ l, r: rr, c: new V() });
  }
  return out;
}

export class World {
  constructor({ W = 7, D = 10, H = 7, g = 22 } = {}) {
    this.W = W; this.D = D; this.H = H; this.g = g; this.bodies = []; this.contacts = [];
    this.mu = 0.55;
  }
  add(size, p, q) {
    const sph = clusterFor(size);
    let R = 0; for (const s of sph) R = Math.max(R, s.l.length() + s.r);
    const b = { p: p.clone(), q: q.clone(), v: new V(), w: new V(), sph, R, invM: 1, invI: 1 / (0.4 * R * R + 0.05), sleepT: 0, asleep: false, on: true };
    this.bodies.push(b); this.place(b); return b;
  }
  place(b) { for (const s of b.sph) s.c.copy(s.l).applyQuaternion(b.q).add(b.p); }
  wake(b) { if (b.asleep) { b.asleep = false; b.sleepT = 0; } }
  wakeNear(p, rad) { for (const b of this.bodies) if (b.on && b.p.distanceTo(p) < rad + b.R) this.wake(b); }
  remove(b) { b.on = false; for (const o of this.bodies) if (o.on && o.p.distanceTo(b.p) < b.R + o.R + 0.6) this.wake(o); }
  awakeCount() { let n = 0; for (const b of this.bodies) if (b.on && !b.asleep) n++; return n; }

  step(dt) {
    const B = this.bodies, C = this.contacts; C.length = 0;
    const { W, D, H } = this, hx = W / 2, hz = D / 2;
    for (const b of B) {
      if (!b.on || b.asleep) continue;
      b.v.y -= this.g * dt;
      b.v.multiplyScalar(Math.pow(0.985, dt * 60)); b.w.multiplyScalar(Math.pow(0.95, dt * 60));
      const sp = b.v.length(); if (sp > 14) b.v.multiplyScalar(14 / sp);
      this.place(b);
    }
    // contacts with the box
    for (const b of B) {
      if (!b.on || b.asleep) continue;
      for (const s of b.sph) {
        const c = s.c, r = s.r;
        if (c.y - r < 0) C.push(mk(b, null, c.x, c.y - r, c.z, 0, 1, 0, r - c.y));
        if (c.x - r < -hx) C.push(mk(b, null, -hx, c.y, c.z, 1, 0, 0, -hx - (c.x - r)));
        if (c.x + r > hx) C.push(mk(b, null, hx, c.y, c.z, -1, 0, 0, c.x + r - hx));
        if (c.z - r < -hz) C.push(mk(b, null, c.x, c.y, -hz, 0, 0, 1, -hz - (c.z - r)));
        if (c.z + r > hz) C.push(mk(b, null, c.x, c.y, hz, 0, 0, -1, c.z + r - hz));
        if (c.y + r > H) C.push(mk(b, null, c.x, H, c.z, 0, -1, 0, c.y + r - H));
      }
    }
    // body pairs
    for (let i = 0; i < B.length; i++) {
      const a = B[i]; if (!a.on) continue;
      for (let j = i + 1; j < B.length; j++) {
        const b = B[j]; if (!b.on || (a.asleep && b.asleep)) continue;
        const rr = a.R + b.R; tmp.subVectors(a.p, b.p); if (tmp.lengthSq() > rr * rr) continue;
        for (const sa of a.sph) for (const sb of b.sph) {
          tmp.subVectors(sa.c, sb.c); const d2 = tmp.lengthSq(), rs = sa.r + sb.r; if (d2 >= rs * rs) continue;
          const d = Math.sqrt(d2) || 1e-4; tmp.divideScalar(d);
          if (d < 1e-4) tmp.set(0, 1, 0);
          const px = sb.c.x + tmp.x * sb.r, py = sb.c.y + tmp.y * sb.r, pz = sb.c.z + tmp.z * sb.r;
          // A is pushed along n (from B to A)
          let A = a, Bb = b;
          if (a.asleep) { const rel = tmp2.subVectors(b.v, a.v).dot(tmp); if (rel > 1.2 || rs - d > 0.12) this.wake(a); }
          if (b.asleep) { const rel = tmp2.subVectors(a.v, b.v).dot(tmp); if (-rel > 1.2 || rs - d > 0.12) this.wake(b); }
          C.push(mk(A, Bb, px, py, pz, tmp.x, tmp.y, tmp.z, rs - d));
        }
      }
    }
    // solve velocities
    for (const c of C) {
      c.ia = c.a.asleep ? 0 : c.a.invM; c.iia = c.a.asleep ? 0 : c.a.invI;
      c.ib = c.b && !c.b.asleep ? c.b.invM : 0; c.iib = c.b && !c.b.asleep ? c.b.invI : 0;
      c.jn = 0; c.jt = 0;
    }
    for (let it = 0; it < 7; it++) {
      for (const c of C) {
        const a = c.a, b = c.b;
        rA.set(c.px - a.p.x, c.py - a.p.y, c.pz - a.p.z);
        vel.copy(a.v).add(cr.crossVectors(a.w, rA));
        if (b) { rB.set(c.px - b.p.x, c.py - b.p.y, c.pz - b.p.z); vel.sub(b.v).sub(cr.crossVectors(b.w, rB)); }
        const n = c.n, vn = vel.dot(n);
        let K = c.ia + c.ib + c.iia * cr.crossVectors(rA, n).lengthSq() + (b ? c.iib * cr.crossVectors(rB, n).lengthSq() : 0);
        if (K <= 0) continue;
        const bias = Math.min(3, Math.max(0, c.pen - 0.01) * 6);
        let dj = (-(vn < -2 ? 1.18 : 1) * vn + bias) / K;
        const jn = Math.max(0, c.jn + dj); dj = jn - c.jn; c.jn = jn;
        imp.copy(n).multiplyScalar(dj); applyImp(c, imp);
        // friction
        tng.copy(vel).addScaledVector(n, -vn); const tl = tng.length();
        if (tl > 1e-5) {
          tng.divideScalar(tl);
          const Kt = c.ia + c.ib + c.iia * cr.crossVectors(rA, tng).lengthSq() + (b ? c.iib * cr.crossVectors(rB, tng).lengthSq() : 0);
          let jt = -tl / Kt; const max = this.mu * c.jn;
          const nt = Math.max(-max, Math.min(max, c.jt + jt)); jt = nt - c.jt; c.jt = nt;
          imp.copy(tng).multiplyScalar(jt); applyImp(c, imp);
        }
      }
    }
    // integrate
    for (const b of B) {
      if (!b.on || b.asleep) continue;
      b.p.addScaledVector(b.v, dt);
      const wl = b.w.length();
      if (wl > 1e-6) { const dq = new Q().setFromAxisAngle(tmp.copy(b.w).divideScalar(wl), wl * dt); b.q.premultiply(dq).normalize(); }
      if (b.v.lengthSq() < 0.03 && b.w.lengthSq() < 0.08) { b.sleepT += dt; if (b.sleepT > 0.5) { b.asleep = true; b.v.set(0, 0, 0); b.w.set(0, 0, 0); } }
      else b.sleepT = 0;
    }
    // position projection (resolve the remaining overlap)
    for (const c of C) {
      const pen = c.pen - 0.015; if (pen <= 0) continue;
      const sa = c.ia, sb = c.ib, s = sa + sb; if (s <= 0) continue;
      const k = 0.35 * pen / s;
      if (sa) c.a.p.addScaledVector(c.n, k * sa);
      if (sb) c.b.p.addScaledVector(c.n, -k * sb);
    }
    // hard clamp inside the box
    for (const b of B) {
      if (!b.on) continue;
      b.p.x = Math.max(-hx + 0.1, Math.min(hx - 0.1, b.p.x)); b.p.z = Math.max(-hz + 0.1, Math.min(hz - 0.1, b.p.z));
      if (b.p.y < 0.05) b.p.y = 0.05;
    }
  }
}

function mk(a, b, px, py, pz, nx, ny, nz, pen) { return { a, b, px, py, pz, n: new V(nx, ny, nz), pen, jn: 0, jt: 0 }; }
function applyImp(c, P) {
  const a = c.a, b = c.b;
  if (c.ia) { a.v.addScaledVector(P, c.ia); a.w.addScaledVector(cr.crossVectors(rA, P), c.iia); }
  if (b && c.ib) { b.v.addScaledVector(P, -c.ib); b.w.addScaledVector(cr.crossVectors(rB, P), -c.iib); }
}
