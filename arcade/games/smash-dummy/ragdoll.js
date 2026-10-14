// ragdoll.js — a tiny verlet ragdoll + kinematic colliders (our own code).
// Particles joined by distance sticks; collisions against a ground plane, oriented boxes and spheres
// whose motion (driven by the game) is transferred to the body on contact. Impacts are reported for damage.
import { THREE } from './kit/hc.js';

// rest pose: [name, x, y, z, radius]
export const JOINTS = [
  ['head', 0, 1.72, 0, 0.17], ['neck', 0, 1.5, 0, 0.08], ['chest', 0, 1.3, 0, 0.17], ['pelvis', 0, 0.95, 0, 0.16],
  ['shL', -0.21, 1.43, 0, 0.09], ['shR', 0.21, 1.43, 0, 0.09], ['elL', -0.25, 1.13, 0, 0.08], ['elR', 0.25, 1.13, 0, 0.08],
  ['haL', -0.27, 0.84, 0, 0.08], ['haR', 0.27, 0.84, 0, 0.08], ['hipL', -0.11, 0.88, 0, 0.1], ['hipR', 0.11, 0.88, 0, 0.1],
  ['knL', -0.12, 0.5, 0, 0.09], ['knR', 0.12, 0.5, 0, 0.09], ['ftL', -0.12, 0.08, 0.03, 0.08], ['ftR', 0.12, 0.08, 0.03, 0.08],
  ['back', 0, 1.15, -0.13, 0.12],
];
const IDX = Object.fromEntries(JOINTS.map((j, i) => [j[0], i]));
const STICKS = [
  ['head', 'neck'], ['neck', 'chest'], ['chest', 'pelvis'], ['neck', 'shL'], ['neck', 'shR'], ['shL', 'shR'], ['shL', 'chest'], ['shR', 'chest'],
  ['shL', 'pelvis'], ['shR', 'pelvis'], ['shL', 'elL'], ['elL', 'haL'], ['shR', 'elR'], ['elR', 'haR'], ['pelvis', 'hipL'], ['pelvis', 'hipR'],
  ['hipL', 'hipR'], ['hipL', 'chest'], ['hipR', 'chest'], ['hipL', 'knL'], ['knL', 'ftL'], ['hipR', 'knR'], ['knR', 'ftR'], ['head', 'chest'],
  ['back', 'chest'], ['back', 'pelvis'], ['back', 'shL'], ['back', 'shR'], ['back', 'hipL'], ['back', 'hipR'], ['back', 'neck'], ['head', 'shL'], ['head', 'shR'],
];
// soft limits: keep limbs from folding fully flat (min distances)
const MINS = [['shL', 'haL', 0.3], ['shR', 'haR', 0.3], ['hipL', 'ftL', 0.45], ['hipR', 'ftR', 0.45], ['head', 'pelvis', 0.6]];

export function createRagdoll() {
  const P = JOINTS.map(([n, x, y, z, r]) => ({ n, p: new THREE.Vector3(x, y, z), o: new THREE.Vector3(x, y, z), r, rest: new THREE.Vector3(x, y, z), hit: 0 }));
  const S = STICKS.map(([a, b]) => ({ a: IDX[a], b: IDX[b], len: P[IDX[a]].rest.distanceTo(P[IDX[b]].rest) }));
  const L = MINS.map(([a, b, f]) => ({ a: IDX[a], b: IDX[b], min: P[IDX[a]].rest.distanceTo(P[IDX[b]].rest) * f }));
  return { P, S, L, IDX };
}

export function placeRagdoll(rd, at, faceY = 0) {
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), faceY);
  for (const j of rd.P) { j.p.copy(j.rest).applyQuaternion(q).add(at); j.o.copy(j.p); }
}

const _v = new THREE.Vector3(), _d = new THREE.Vector3(), _l = new THREE.Vector3(), _n = new THREE.Vector3(), _vc = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();

/**
 * colliders: [{ type: 'box'|'sphere', obj, half (Vector3 for box), r (sphere), e (bounce), mult (damage multiplier), M, Mprev, inv }]
 * onImpact(joint, speed, collider, point)
 */
let STEP = 0;
const fresh = (j, key) => { j.touch = j.touch || {}; const last = j.touch[key]; j.touch[key] = STEP; return last === undefined || STEP - last > 4; };
export function stepRagdoll(rd, colliders, sdt, frameDt, { gravity = -18, iters = 10, onImpact, groundY = 0, grab = null } = {}) {
  const damp = 0.996; STEP++;
  for (const j of rd.P) {
    _v.subVectors(j.p, j.o).multiplyScalar(damp); j.o.copy(j.p); j.p.add(_v); j.p.y += gravity * sdt * sdt;
  }
  for (let it = 0; it < iters; it++) {
    for (const s of rd.S) {
      const a = rd.P[s.a].p, b = rd.P[s.b].p; _d.subVectors(b, a); const d = _d.length() || 1e-6; const k = (d - s.len) / d * 0.5;
      a.addScaledVector(_d, k); b.addScaledVector(_d, -k);
    }
    for (const s of rd.L) {
      const a = rd.P[s.a].p, b = rd.P[s.b].p; _d.subVectors(b, a); const d = _d.length() || 1e-6; if (d >= s.min) continue; const k = (d - s.min) / d * 0.5;
      a.addScaledVector(_d, k); b.addScaledVector(_d, -k);
    }
    if (grab) { const g = rd.P[grab.i]; g.p.lerp(grab.target, 0.5); }
  }
  // collisions (once per substep, with velocity response)
  for (const j of rd.P) {
    // ground
    if (j.p.y < groundY + j.r && j.p.x > -40) {
      _v.subVectors(j.p, j.o).divideScalar(sdt);
      const vn = _v.y; j.p.y = groundY + j.r;
      const nw = fresh(j, 'g');
      if (vn < 0) { if (nw && -vn > 3.2 && onImpact) onImpact(j, -vn, null, j.p); _v.y = -vn * 0.22; _v.x *= 0.82; _v.z *= 0.82; }
      j.o.copy(j.p).addScaledVector(_v, -sdt);
    }
    for (const c of colliders) {
      if (c.off) continue;
      let pen = 0;
      if (c.type === 'sphere') {
        c.obj.getWorldPosition(_a); _n.subVectors(j.p, _a); const d = _n.length(); pen = c.r + j.r - d; if (pen <= 0) continue; _n.divideScalar(d || 1);
      } else {
        _l.copy(j.p).applyMatrix4(c.inv); const h = c.half, r = j.r;
        const ox = h.x + r - Math.abs(_l.x), oy = h.y + r - Math.abs(_l.y), oz = h.z + r - Math.abs(_l.z);
        if (ox <= 0 || oy <= 0 || oz <= 0) continue;
        if (ox < oy && ox < oz) { _n.set(Math.sign(_l.x) || 1, 0, 0); pen = ox; } else if (oy < oz) { _n.set(0, Math.sign(_l.y) || 1, 0); pen = oy; } else { _n.set(0, 0, Math.sign(_l.z) || 1); pen = oz; }
        _n.transformDirection(c.M);
      }
      // collider surface velocity at this point (from last frame's motion)
      _l.copy(j.p).applyMatrix4(c.inv); _a.copy(_l).applyMatrix4(c.M); _b.copy(_l).applyMatrix4(c.Mprev); _vc.subVectors(_a, _b).divideScalar(frameDt);
      _v.subVectors(j.p, j.o).divideScalar(sdt).sub(_vc);
      j.p.addScaledVector(_n, pen);
      const vn = _v.dot(_n), nw = fresh(j, colliders.indexOf(c));
      if (vn < 0) {
        if (nw && -vn > 3.2 && onImpact) onImpact(j, -vn, c, j.p);
        _v.addScaledVector(_n, -vn * (1 + (c.e ?? 0.25))); _d.copy(_n).multiplyScalar(_v.dot(_n)); _v.sub(_d).multiplyScalar(c.fr ?? 0.85).add(_d);
      }
      _v.add(_vc); j.o.copy(j.p).addScaledVector(_v, -sdt);
    }
  }
}

/** call once per frame after moving collider objects: refreshes matrices (keeps the previous one for surface velocity) */
export function syncCollider(c) {
  c.obj.updateMatrixWorld(true);
  if (!c.M) { c.M = new THREE.Matrix4(); c.Mprev = new THREE.Matrix4(); c.inv = new THREE.Matrix4(); c.M.copy(c.obj.matrixWorld); }
  c.Mprev.copy(c.M); c.M.copy(c.obj.matrixWorld); c.inv.copy(c.M).invert();
}
