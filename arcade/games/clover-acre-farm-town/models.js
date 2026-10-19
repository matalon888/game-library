// models.js — Clover Acre's low-poly farm, built from three.js primitives merged into single vertex-coloured meshes.
import { THREE, rounded } from './kit/hc.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(sx, sy, sz));
export function merge(parts) {
  const pos = [], nor = [], col = [], c = new THREE.Color();
  for (const [g0, m, color] of parts) {
    const g = g0.index ? g0.toNonIndexed() : g0.clone(); g.applyMatrix4(m); c.set(color);
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(c.r, c.g, c.b); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g;
}
export const vmat = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.02, ...o });
export const rbox = (w, h, d, r = 0.06) => { const g = rounded(w - 1.8 * r, d - 1.8 * r, h, r); g.rotateX(-Math.PI / 2); return g; };
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const sph = (r, a = 12, b = 9) => new THREE.SphereGeometry(r, a, b);
const cyl = (a, b, h, s = 10) => new THREE.CylinderGeometry(a, b, h, s);
const cone = (r, h, s = 8) => new THREE.ConeGeometry(r, h, s);
function prism(w, h, d) { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(0, h); s.lineTo(w / 2, 0); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2); return g; }
export function mesh(parts, o) { const m = new THREE.Mesh(merge(parts), vmat(o)); m.castShadow = true; m.receiveShadow = true; return m; }

// ---------------------------------------------------------------- crops (one merged mesh per plot; tinted green while growing)
export const CROP_GEO = {
  wheat: () => { const p = []; for (let i = 0; i < 12; i++) { const x = ((i % 4) - 1.5) * 0.36 + (i % 2) * 0.05, z = (Math.floor(i / 4) - 1) * 0.42; p.push([cyl(0.02, 0.025, 0.55, 5), M(x, 0.3, z, 0.08 * (i % 3 - 1), 0, 0.1 * (i % 2 - 0.5)), '#d9b54a'], [cone(0.07, 0.26, 6), M(x, 0.65, z), '#f2cf55']); } return p; },
  corn: () => { const p = []; for (let i = 0; i < 6; i++) { const x = ((i % 3) - 1) * 0.5, z = (Math.floor(i / 3) - 0.5) * 0.6; p.push([cyl(0.04, 0.05, 1.0, 6), M(x, 0.5, z), '#5fae3e'], [cone(0.12, 0.5, 4), M(x + 0.1, 0.55, z, 0, 0, -0.9), '#6cc04a'], [cone(0.12, 0.5, 4), M(x - 0.1, 0.75, z, 0, 0, 0.9), '#6cc04a'], [new THREE.CapsuleGeometry(0.07, 0.16, 3, 6), M(x + 0.07, 0.62, z + 0.04, 0.2, 0, -0.3), '#ffd23f']); } return p; },
  carrot: () => { const p = []; for (let i = 0; i < 9; i++) { const x = ((i % 3) - 1) * 0.45, z = (Math.floor(i / 3) - 1) * 0.42; p.push([cone(0.08, 0.14, 7), M(x, 0.08, z, Math.PI), '#ff8a2a'], [cone(0.05, 0.3, 4), M(x - 0.04, 0.28, z, 0, 0, 0.3), '#4fbf4a'], [cone(0.05, 0.3, 4), M(x + 0.04, 0.28, z, 0, 0, -0.3), '#5fcf55']); } return p; },
  pumpkin: () => { const p = []; for (const [x, z, s] of [[-0.35, -0.25, 1], [0.38, 0.28, 0.85], [0.3, -0.38, 0.6]]) { for (let k = 0; k < 6; k++) p.push([sph(0.2 * s, 10, 8), M(x + Math.cos(k) * 0.08 * s, 0.17 * s, z + Math.sin(k) * 0.08 * s, 0, k, 0, 1, 0.8, 1), '#ff9a2a']); p.push([cyl(0.03, 0.04, 0.14, 5), M(x, 0.34 * s, z), '#6a8a2a']); } p.push([cone(0.2, 0.08, 5), M(-0.4, 0.06, 0.4, 0, 0.4), '#5fbf55'], [cone(0.2, 0.08, 5), M(0.0, 0.06, 0.05), '#4fae4a']); return p; },
};
export function cropMesh(kind) { const m = new THREE.Mesh(merge(CROP_GEO[kind]()), vmat({ roughness: 0.7 })); m.castShadow = true; return m; }

export function plotMesh() {
  const p = [[rbox(1.72, 0.22, 1.62, 0.07), M(0, 0.06, 0), '#9a6638']];
  for (const z of [-0.5, 0, 0.5]) p.push([rbox(1.5, 0.08, 0.26, 0.04), M(0, 0.19, z), '#7a4c28']);
  return mesh(p);
}
export function lockedPlotMesh() {
  return mesh([[rbox(1.72, 0.1, 1.62, 0.05), M(0, 0.02, 0), '#7cc46a'], [box(0.08, 0.7, 0.08), M(-0.2, 0.35, 0.3), '#8f5c2c'], [box(0.08, 0.7, 0.08), M(0.2, 0.35, 0.3), '#8f5c2c'], [rbox(0.8, 0.4, 0.06, 0.03), M(0, 0.6, 0.3), '#d9a466']]);
}
// ---------------------------------------------------------------- animals
export function chickenMesh() {
  return mesh([[sph(0.22, 12, 9), M(0, 0.28, 0, 0, 0, 0, 1, 0.9, 1.15), '#ffffff'], [sph(0.13, 10, 8), M(0, 0.48, 0.18), '#ffffff'], [cone(0.04, 0.1, 5), M(0, 0.47, 0.32, Math.PI / 2), '#ffb22a'],
    [box(0.04, 0.09, 0.12), M(0, 0.6, 0.17), '#ff4d4d'], [sph(0.03, 6, 5), M(0, 0.4, 0.29), '#ff4d4d'], [sph(0.025, 6, 5), M(0.08, 0.51, 0.27), '#2b2d42'], [sph(0.025, 6, 5), M(-0.08, 0.51, 0.27), '#2b2d42'],
    [cone(0.12, 0.2, 5), M(0, 0.36, -0.24, -1.1), '#f4f4f4'], [cyl(0.02, 0.02, 0.12, 4), M(0.07, 0.06, 0), '#ffb22a'], [cyl(0.02, 0.02, 0.12, 4), M(-0.07, 0.06, 0), '#ffb22a']]);
}
export function cowMesh() {
  const p = [[rbox(0.62, 0.45, 1.0, 0.16), M(0, 0.55, 0), '#ffffff'], [rbox(0.42, 0.38, 0.38, 0.12), M(0, 0.78, 0.58), '#ffffff'], [rbox(0.34, 0.16, 0.14, 0.06), M(0, 0.7, 0.8), '#ffb3c1'],
    [sph(0.03, 6, 5), M(0.11, 0.86, 0.78), '#2b2d42'], [sph(0.03, 6, 5), M(-0.11, 0.86, 0.78), '#2b2d42'], [cone(0.04, 0.12, 5), M(0.14, 1.0, 0.55), '#f2e6c8'], [cone(0.04, 0.12, 5), M(-0.14, 1.0, 0.55), '#f2e6c8'],
    [sph(0.13, 8, 6), M(0.2, 0.72, -0.1, 0, 0, 0, 1, 0.8, 1.3), '#3b3b44'], [sph(0.11, 8, 6), M(-0.24, 0.6, 0.18, 0, 0, 0, 1, 1, 1.2), '#3b3b44'], [sph(0.1, 8, 6), M(-0.1, 0.78, -0.32), '#3b3b44'], [sph(0.08, 8, 6), M(0, 0.32, 0.1), '#ffc2cf']];
  for (const [x, z] of [[0.2, 0.32], [-0.2, 0.32], [0.2, -0.32], [-0.2, -0.32]]) p.push([cyl(0.06, 0.06, 0.36, 6), M(x, 0.18, z), '#f2f2f2'], [cyl(0.065, 0.065, 0.06, 6), M(x, 0.03, z), '#3b3b44']);
  p.push([cyl(0.02, 0.02, 0.3, 4), M(0, 0.6, -0.55, 0.6), '#f2f2f2']);
  return mesh(p);
}
export function fenceMesh(w, d, gap = true) {
  const p = [], wood = '#c8955a', post = (x, z) => p.push([box(0.1, 0.5, 0.1), M(x, 0.25, z), '#a8743e']);
  for (const [x0, z0, x1, z1] of [[-w / 2, -d / 2, w / 2, -d / 2], [w / 2, -d / 2, w / 2, d / 2], [-w / 2, -d / 2, -w / 2, d / 2], [-w / 2, d / 2, gap ? -0.3 : w / 2, d / 2], ...(gap ? [[0.3, d / 2, w / 2, d / 2]] : [])]) {
    const len = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(z1 - z0, x1 - x0), n = Math.max(1, Math.round(len / 0.7));
    for (let i = 0; i <= n; i++) post(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n);
    for (const y of [0.18, 0.38]) p.push([box(len, 0.06, 0.05), M((x0 + x1) / 2, y, (z0 + z1) / 2, 0, -a), wood]);
  }
  return mesh(p);
}
// ---------------------------------------------------------------- buildings
export function houseMesh({ w = 2, d = 1.6, h = 1.2, wall = '#fff3dc', roof = '#e8573c', trim = '#ffffff', chimney = false, awning = null }) {
  const p = [[rbox(w, h, d, 0.08), M(0, h / 2, 0), wall], [prism(w + 0.3, h * 0.65, d + 0.3), M(0, h, 0), roof], [rbox(w * 0.28, h * 0.62, 0.06, 0.03), M(0, h * 0.31, d / 2 + 0.02), '#8f5c2c'],
    [rbox(w * 0.22, h * 0.26, 0.05, 0.03), M(-w * 0.3, h * 0.6, d / 2 + 0.02), '#bfe9ff'], [rbox(w * 0.22, h * 0.26, 0.05, 0.03), M(w * 0.3, h * 0.6, d / 2 + 0.02), '#bfe9ff'],
    [box(w + 0.05, 0.08, d + 0.05), M(0, 0.04, 0), trim]];
  if (chimney) p.push([rbox(0.26, 0.6, 0.26, 0.04), M(w * 0.28, h + 0.45, -0.1), '#b05a3c']);
  if (awning) for (let i = 0; i < 6; i++) p.push([box(w * 0.85 / 6, 0.05, 0.4), M(-w * 0.425 + w * 0.85 / 6 * (i + 0.5), h * 0.9, d / 2 + 0.2, 0.35), i % 2 ? '#ffffff' : awning]);
  return mesh(p);
}
export function barnMesh() {
  const p = [[rbox(2.4, 1.6, 1.9, 0.08), M(0, 0.8, 0), '#d8453a'], [prism(2.7, 1.0, 2.2), M(0, 1.6, 0), '#7a3e30'], [rbox(1.0, 1.1, 0.06, 0.04), M(0, 0.55, 0.96), '#ffffff'],
    [box(0.08, 1.4, 0.04), M(0, 0.6, 1.0, 0, 0, 0.73), '#ffffff'], [box(0.08, 1.4, 0.04), M(0, 0.6, 1.0, 0, 0, -0.73), '#ffffff'], [rbox(0.5, 0.36, 0.05, 0.03), M(0, 1.9, 0.98), '#ffffff'], [box(2.45, 0.08, 1.95), M(0, 0.04, 0), '#ffffff']];
  return mesh(p);
}
export function truckMesh(color = '#3a86ff') {
  const p = [[rbox(0.9, 0.62, 0.95, 0.1), M(0, 0.55, 0.62), color], [rbox(0.78, 0.3, 0.06, 0.04), M(0, 0.7, 1.1), '#bfe9ff'], [rbox(1.0, 0.18, 1.5, 0.05), M(0, 0.32, -0.45), '#5a5f6b'],
    [rbox(1.0, 0.42, 0.06, 0.03), M(0, 0.6, -1.18), color], [rbox(0.06, 0.42, 1.4, 0.03), M(0.47, 0.6, -0.45), color], [rbox(0.06, 0.42, 1.4, 0.03), M(-0.47, 0.6, -0.45), color], [rbox(0.2, 0.1, 0.05, 0.03), M(0.3, 0.45, 1.1), '#fff6a8'], [rbox(0.2, 0.1, 0.05, 0.03), M(-0.3, 0.45, 1.1), '#fff6a8']];
  for (const [x, z] of [[0.48, 0.65], [-0.48, 0.65], [0.48, -0.75], [-0.48, -0.75]]) p.push([cyl(0.2, 0.2, 0.14, 12), M(x, 0.2, z, 0, 0, Math.PI / 2), '#2b2d42'], [cyl(0.09, 0.09, 0.15, 8), M(x, 0.2, z, 0, 0, Math.PI / 2), '#d9dde3']);
  return mesh(p);
}
export function crateMesh() { return mesh([[rbox(0.4, 0.3, 0.4, 0.03), M(0, 0.15, 0), '#d9a466'], [box(0.42, 0.04, 0.05), M(0, 0.2, 0.19), '#a8743e']]); }
export function treesMesh(spots) {
  const p = [];
  spots.forEach(([x, z, s, kind]) => {
    if (kind) { p.push([cyl(0.08 * s, 0.12 * s, 0.6 * s, 6), M(x, 0.3 * s, z), '#8f5c2c'], [cone(0.55 * s, 1.0 * s, 7), M(x, 0.9 * s, z), '#3f9a4e'], [cone(0.42 * s, 0.8 * s, 7), M(x, 1.35 * s, z), '#4fae5a']); }
    else { p.push([cyl(0.08 * s, 0.12 * s, 0.7 * s, 6), M(x, 0.35 * s, z), '#8f5c2c'], [sph(0.55 * s, 9, 7), M(x, 1.0 * s, z), '#5cbf55'], [sph(0.38 * s, 8, 6), M(x + 0.25 * s, 1.25 * s, z + 0.1), '#6fd062']); }
  });
  return mesh(p);
}
export function flowersMesh(spots) { const p = []; spots.forEach(([x, z, c]) => p.push([sph(0.07, 6, 5), M(x, 0.08, z), c], [sph(0.04, 5, 4), M(x, 0.12, z), '#fff6a8'])); return mesh(p); }
