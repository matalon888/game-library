// people.js — baked vertex-coloured models + an instanced crowd whose limbs swing in the vertex shader (1 draw call for hundreds of runners).
import { THREE } from './kit/hc.js';

/** parts: [{ geo, color, pos, rot, scl, part }] → one non-indexed BufferGeometry with color + aPart attributes */
export function bake(parts) {
  const pos = [], nor = [], col = [], prt = [], c = new THREE.Color(), m = new THREE.Matrix4(), nm = new THREE.Matrix3(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3();
  for (const p of parts) {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo;
    const s = p.scl === undefined ? [1, 1, 1] : typeof p.scl === 'number' ? [p.scl, p.scl, p.scl] : p.scl;
    m.compose(new THREE.Vector3(...(p.pos || [0, 0, 0])), q.setFromEuler(e.set(...(p.rot || [0, 0, 0]))), new THREE.Vector3(...s));
    nm.getNormalMatrix(m); c.set(p.color || '#ffffff');
    const P = g.attributes.position, N = g.attributes.normal;
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(m); pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z);
      col.push(c.r, c.g, c.b); prt.push(p.part || 0);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.setAttribute('aPart', new THREE.Float32BufferAttribute(prt, 1));
  out.computeBoundingSphere();
  return out;
}
export const vcMat = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.05, ...o });

/** chunky faceless hyper-casual person, feet at y=0, ~1.85 tall. part ids: 0 torso/head, 1 legL, 2 legR, 3 armL, 4 armR */
export function personGeometry() {
  const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 3, 10);
  return bake([
    { geo: cap(0.25, 0.38), pos: [0, 0.98, 0], part: 0 },
    { geo: new THREE.SphereGeometry(0.235, 14, 10), pos: [0, 1.6, 0], part: 0 },
    { geo: cap(0.1, 0.42), pos: [-0.13, 0.32, 0], part: 1 },
    { geo: cap(0.1, 0.42), pos: [0.13, 0.32, 0], part: 2 },
    { geo: cap(0.08, 0.4), pos: [-0.34, 0.98, 0], rot: [0, 0, -0.18], part: 3 },
    { geo: cap(0.08, 0.4), pos: [0.34, 0.98, 0], rot: [0, 0, 0.18], part: 4 },
  ]);
}

const PATCH = (shader, uni) => {
  shader.uniforms.uTime = uni.uTime;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute float aPart;\nattribute float aRun;\nattribute float aPop;')
    .replace('#include <begin_vertex>', `vec3 transformed = vec3(position);
      float ph = uTime * 13.0 + float(gl_InstanceID) * 2.399;
      float sw = sin(ph) * aRun;
      int pt = int(aPart + 0.5);
      if (pt > 0) {
        float piv = pt < 3 ? 0.64 : 1.24;
        float sg = (pt == 1 || pt == 4) ? 1.0 : -1.0;
        float a = sw * sg * (pt < 3 ? 0.85 : 0.9);
        float dy = transformed.y - piv, dz = transformed.z;
        transformed.y = piv + dy * cos(a) - dz * sin(a); transformed.z = dy * sin(a) + dz * cos(a);
        if (pt > 2 && aRun < 0.01) { transformed.x *= 1.0; }
      }
      transformed.y += abs(cos(ph)) * 0.07 * aRun;
      transformed *= 1.0 + aPop * 0.45;`);
};
/** InstancedMesh of people with per-instance colour (setColorAt), aRun (0 idle..1 sprint) and aPop (0..1 squash pop) */
export function crowdMesh(max, { geo = personGeometry(), roughness = 0.4 } = {}) {
  const uni = { uTime: { value: 0 } };
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness, metalness: 0.02 });
  m.onBeforeCompile = s => PATCH(s, uni);
  const dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  dm.onBeforeCompile = s => PATCH(s, uni);
  const run = new THREE.InstancedBufferAttribute(new Float32Array(max), 1), pop = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
  geo.setAttribute('aRun', run); geo.setAttribute('aPop', pop);
  const mesh = new THREE.InstancedMesh(geo, m, max);
  mesh.customDepthMaterial = dm; mesh.castShadow = true; mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for (let i = 0; i < max; i++) mesh.setColorAt(i, new THREE.Color('#ffffff'));
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  // x-ray pass: draws people only where something (a building) hides them, as flat tinted silhouettes
  const xm = new THREE.MeshBasicMaterial({ color: '#ffffff', vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false, depthFunc: THREE.GreaterDepth });
  xm.onBeforeCompile = s => PATCH(s, uni);
  const xray = new THREE.InstancedMesh(geo, xm, max); xray.instanceMatrix = mesh.instanceMatrix; xray.instanceColor = mesh.instanceColor; xray.frustumCulled = false; xray.renderOrder = 5; xray.count = 0;
  mesh.add(xray);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), C = new THREE.Color();
  return {
    mesh, uni, run, pop,
    set(i, x, y, z, rotY, s = 1, sy = s) { Q.setFromAxisAngle(Y, rotY); M.compose(V.set(x, y, z), Q, S.set(s, sy, s)); mesh.setMatrixAt(i, M); },
    color(i, c) { mesh.setColorAt(i, C.set(c)); mesh.instanceColor.needsUpdate = true; },
    commit(n, t) { mesh.count = n; xray.count = n; uni.uTime.value = t; mesh.instanceMatrix.needsUpdate = true; run.needsUpdate = true; pop.needsUpdate = true; },
  };
}
