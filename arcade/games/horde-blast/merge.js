// merge.js — bake many coloured primitive parts into ONE vertex-coloured geometry (1 draw call per model).
import { THREE } from './kit/hc.js';
/** parts: [{ geo, color, pos:[x,y,z], rot:[x,y,z], scl:[x,y,z] | number }] → BufferGeometry with color attribute */
export function bake(parts) {
  const pos = [], nor = [], col = [], c = new THREE.Color(), m = new THREE.Matrix4(), nm = new THREE.Matrix3(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const v = new THREE.Vector3();
  for (const p of parts) {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo;
    const s = p.scl === undefined ? [1, 1, 1] : typeof p.scl === 'number' ? [p.scl, p.scl, p.scl] : p.scl;
    m.compose(new THREE.Vector3(...(p.pos || [0, 0, 0])), q.setFromEuler(e.set(...(p.rot || [0, 0, 0]), p.order || 'XYZ')), new THREE.Vector3(...s));
    if (p.mat) m.premultiply(p.mat);
    nm.getNormalMatrix(m); c.set(p.color);
    const P = g.attributes.position, N = g.attributes.normal;
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(m); pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z);
      col.push(c.r, c.g, c.b);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}
export const vcMat = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.05, ...o });
