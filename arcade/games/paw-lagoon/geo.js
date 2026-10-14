// geo.js — merge many coloured primitives into one vertex-coloured geometry (1 draw call per prop) + canvas textures.
import { THREE } from './kit/hc.js';

const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), SC = new THREE.Vector3();

/** part(geo, '#f00', { x, y, z, rx, ry, rz, s, sx, sy, sz }) → transformed, vertex-coloured, non-indexed copy */
export function part(geo, color, o = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  const s = o.s ?? 1;
  M4.compose(V.set(o.x || 0, o.y || 0, o.z || 0), Q.setFromEuler(E.set(o.rx || 0, o.ry || 0, o.rz || 0, o.order || 'XYZ')), SC.set((o.sx ?? 1) * s, (o.sy ?? 1) * s, (o.sz ?? 1) * s));
  g.applyMatrix4(M4);
  const c = new THREE.Color(color), n = g.attributes.position.count, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}
export function merge(parts) {
  let n = 0; for (const g of parts) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
  for (const g of parts) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; g.dispose(); }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); m.setAttribute('color', new THREE.BufferAttribute(col, 3));
  m.computeBoundingSphere(); m.computeBoundingBox(); return m;
}
export function canvasTex(w, h, draw, repeat = false) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
/** puffy extruded 2D shape lying flat (top facing +y), base at y=0 */
export function puff(shape, { depth = 0.06, bev = 0.13, size = 0.07, seg = 4, curve = 18 } = {}) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bev, bevelSize: size, bevelSegments: seg, curveSegments: curve });
  g.rotateX(-Math.PI / 2); g.translate(0, bev, 0); return g;
}
export function starShape(n, ro, ri, rot = Math.PI / 2) {
  const s = new THREE.Shape();
  for (let i = 0; i <= n * 2; i++) { const a = rot + i * Math.PI / n, r = i % 2 ? ri : ro; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  return s;
}
