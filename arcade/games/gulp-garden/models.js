// models.js — chunky low-poly food/toy props built from primitives, merged into ONE vertex-coloured geometry each
// so a whole field of them is a single InstancedMesh draw call. Our own code.
import { THREE } from './kit/hc.js';

function merge(parts) {   // parts: [geometry, color, (Matrix4 | fn(geo))]
  const pos = [], nor = [], col = [];
  for (const [g0, color, xf] of parts) {
    let g = g0.index ? g0.toNonIndexed() : g0.clone();
    if (xf instanceof THREE.Matrix4) g.applyMatrix4(xf); else if (typeof xf === 'function') xf(g);
    g.computeVertexNormals();
    const p = g.attributes.position.array, n = g.attributes.normal.array, c = new THREE.Color(color);
    const vc = g.attributes.color ? g.attributes.color.array : null;
    for (let i = 0; i < p.length; i += 3) {
      pos.push(p[i], p[i + 1], p[i + 2]); nor.push(n[i], n[i + 1], n[i + 2]);
      if (vc) col.push(vc[i], vc[i + 1], vc[i + 2]); else col.push(c.r, c.g, c.b);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.computeBoundingSphere(); return out;
}
const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1, sy = s, sz = s) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, sy, sz));
const sph = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
const cyl = (r1, r2, h, s = 16, open = false, t0 = 0, tl = Math.PI * 2) => new THREE.CylinderGeometry(r1, r2, h, s, 1, open, t0, tl);
const leaf = (s = 1) => { const g = new THREE.ConeGeometry(0.06 * s, 0.16 * s, 4); return g; };
function stripes(g, a, b, n = 8) {   // colour a sphere in longitudinal stripes
  const p = g.attributes.position, c = new Float32Array(p.count * 3), A = new THREE.Color(a), B = new THREE.Color(b);
  for (let i = 0; i < p.count; i++) { const ang = Math.atan2(p.getZ(i), p.getX(i)); const w = Math.sin(ang * n + Math.sin(p.getY(i) * 9) * 0.6) > 0.25 ? B : A; c.set([w.r, w.g, w.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
}
function speckle(g, base, dot, rate = 0.12, seed = 1) {
  const p = g.attributes.position, c = new Float32Array(p.count * 3), A = new THREE.Color(base), B = new THREE.Color(dot); let s = seed;
  for (let i = 0; i < p.count; i++) { s = (s * 16807) % 2147483647; const w = (s / 2147483647) < rate ? B : A; c.set([w.r, w.g, w.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
}

// every model: { geo, r (footprint radius), emoji, name }
export function buildModels() {
  const D = {};
  const add = (key, name, emoji, r, parts) => { D[key] = { key, name, emoji, r, geo: merge(parts) }; };

  // ---------- garden / picnic
  add('strawberry', 'Strawberry', '🍓', 0.2, [
    [new THREE.ConeGeometry(0.17, 0.32, 10), '#f0304a', M(0, 0.17, 0, Math.PI)], [sph(0.17, 10, 8), '#f0304a', M(0, 0.32, 0, 0, 0, 0, 1, 0.5, 1)],
    ...[0, 1, 2, 3, 4].map(i => [leaf(), '#3fae3a', M(Math.cos(i * 1.26) * 0.08, 0.4, Math.sin(i * 1.26) * 0.08, Math.sin(i * 1.26) * 1.2, 0, -Math.cos(i * 1.26) * 1.2)])]);
  add('orange', 'Orange', '🍊', 0.25, [[speckle(sph(0.25, 16, 12), '#ff9a1f', '#ffb44d', 0.25, 3), null, M(0, 0.25, 0)], [leaf(1.3), '#3fae3a', M(0.04, 0.5, 0, 0, 0, -0.9)]]);
  add('apple', 'Apple', '🍎', 0.28, [[sph(0.28, 16, 12), '#e8313a', M(0, 0.26, 0, 0, 0, 0, 1, 0.92, 1)], [cyl(0.02, 0.025, 0.14, 6), '#6b4423', M(0, 0.56, 0, 0, 0, 0.2)], [leaf(1.4), '#4cbc3c', M(0.08, 0.58, 0, 0, 0, -1.2)]]);
  add('kiwi', 'Kiwi', '🥝', 0.23, [[cyl(0.23, 0.23, 0.14, 18), '#8a5a2b', M(0, 0.07, 0)], [cyl(0.2, 0.2, 0.02, 18), '#7ccf2e', M(0, 0.145, 0)], [cyl(0.07, 0.07, 0.025, 12), '#f3f7d0', M(0, 0.15, 0)]]);
  add('slice', 'Melon slice', '🍉', 0.4, [
    [cyl(0.46, 0.46, 0.12, 14, false, -Math.PI / 6, Math.PI / 3), '#2f9e3a', M(0, 0.02, 0, Math.PI / 2, 0, 0)],
    [cyl(0.42, 0.42, 0.13, 14, false, -Math.PI / 6, Math.PI / 3), '#ff4c5b', M(0, 0.03, 0, Math.PI / 2, 0, 0)],
    ...[[-0.05, 0.22], [0.06, 0.25], [0, 0.15], [-0.03, 0.32], [0.04, 0.34]].map(([x, y]) => [sph(0.022, 6, 4), '#2a1a1a', M(x, -y, 0.07)])].map(p => { p[2] = new THREE.Matrix4().multiplyMatrices(M(0, 0.1, 0.12, -1.15, 0, 0), new THREE.Matrix4().multiplyMatrices(M(0, 0.47, 0, 0, 0, Math.PI), p[2])); return p; }));
  add('papaya', 'Papaya', '🥭', 0.55, [[sph(0.55, 18, 10, 0), '#ff7a3d', M(0, 0.0, 0, 0, 0, 0, 1, 0.55, 0.75)], [sph(0.47, 16, 10), '#ff9d5c', M(0, 0.06, 0, 0, 0, 0, 1, 0.42, 0.66)],
    ...[...Array(9)].map((_, i) => [sph(0.05, 6, 4), '#2b1d1d', M(Math.cos(i) * 0.12 * (i % 3), 0.28, Math.sin(i * 2) * 0.1, 0, 0, 0)])]);
  add('melon', 'Watermelon', '🍉', 0.78, [[stripes(sph(0.78, 22, 16), '#2f8f2f', '#1d5e22', 7), null, M(0, 0.66, 0, Math.PI / 2, 0, 0, 1, 1, 0.85)]]);
  add('basket', 'Picnic basket', '🧺', 1.05, [[cyl(0.95, 0.8, 0.8, 20), '#c88a45', M(0, 0.4, 0)], [cyl(0.97, 0.97, 0.12, 20), '#a96c2c', M(0, 0.78, 0)],
    [new THREE.TorusGeometry(0.7, 0.07, 8, 20, Math.PI), '#a96c2c', M(0, 0.8, 0)], [cyl(0.85, 0.85, 0.06, 20), '#ff5d6c', M(0, 0.86, 0)]]);
  // ---------- kitchen
  add('sushi', 'Sushi', '🍣', 0.22, [[cyl(0.22, 0.22, 0.26, 16), '#1f2a25', M(0, 0.13, 0)], [cyl(0.18, 0.18, 0.02, 16), '#fbfbf5', M(0, 0.265, 0)], [cyl(0.08, 0.08, 0.03, 12), '#ff8a3d', M(0, 0.27, 0)]]);
  add('macaron', 'Macaron', '🍬', 0.22, [[cyl(0.22, 0.2, 0.1, 18), '#ff9ec7', M(0, 0.05, 0)], [cyl(0.2, 0.2, 0.06, 18), '#fff4e8', M(0, 0.13, 0)], [cyl(0.2, 0.22, 0.1, 18), '#ff9ec7', M(0, 0.21, 0)]]);
  add('cookie', 'Cookie', '🍪', 0.27, [[speckle(cyl(0.27, 0.27, 0.07, 18), '#d99a52', '#4a2a17', 0.18, 7), null, M(0, 0.035, 0)]]);
  add('donut', 'Donut', '🍩', 0.36, [[new THREE.TorusGeometry(0.25, 0.12, 10, 20), '#e4a45a', M(0, 0.12, 0, Math.PI / 2)], [new THREE.TorusGeometry(0.25, 0.115, 8, 20), '#ff6fa8', M(0, 0.15, 0, Math.PI / 2, 0, 0, 1, 1, 0.8)]]);
  add('cupcake', 'Cupcake', '🧁', 0.32, [[cyl(0.26, 0.2, 0.28, 14), '#5ec8f0', M(0, 0.14, 0)], [sph(0.3, 14, 10), '#fff1f6', M(0, 0.33, 0, 0, 0, 0, 1, 0.6, 1)], [sph(0.08, 8, 6), '#e8243a', M(0, 0.53, 0)]]);
  add('cake', 'Cake', '🎂', 0.85, [[cyl(0.85, 0.85, 0.42, 24), '#ffe0ec', M(0, 0.21, 0)], [cyl(0.87, 0.87, 0.08, 24), '#ff6fa8', M(0, 0.45, 0)], [cyl(0.6, 0.6, 0.35, 22), '#ffe0ec', M(0, 0.66, 0)],
    [cyl(0.62, 0.62, 0.07, 22), '#ff6fa8', M(0, 0.85, 0)], ...[0, 1, 2, 3, 4].map(i => [sph(0.08, 8, 6), '#e8243a', M(Math.cos(i * 1.256) * 0.42, 0.9, Math.sin(i * 1.256) * 0.42)])]);
  add('pizza', 'Pizza', '🍕', 1.1, [[cyl(1.1, 1.1, 0.1, 28), '#e9b35f', M(0, 0.05, 0)], [cyl(0.98, 0.98, 0.04, 28), '#ffcf4a', M(0, 0.11, 0)],
    ...[...Array(8)].map((_, i) => [cyl(0.13, 0.13, 0.04, 12), '#d8392c', M(Math.cos(i * 0.8 + 0.3) * (0.3 + (i % 2) * 0.4), 0.14, Math.sin(i * 0.8 + 0.3) * (0.3 + (i % 2) * 0.4))])]);
  // ---------- toy room
  add('block', 'Toy block', '🟦', 0.26, [[new THREE.BoxGeometry(0.38, 0.38, 0.38), '#3a86ff', M(0, 0.19, 0)], [new THREE.BoxGeometry(0.22, 0.04, 0.22), '#ffffff', M(0, 0.39, 0)]]);
  add('ball', 'Ball', '⚽', 0.3, [[sph(0.3, 14, 10, 0), '#ff4d6d', M(0, 0.3, 0)], [cyl(0.302, 0.302, 0.12, 16), '#ffffff', M(0, 0.3, 0)], [cyl(0.303, 0.303, 0.06, 16), '#ffd23f', M(0, 0.3, 0, Math.PI / 2)]]);
  add('duck', 'Rubber duck', '🦆', 0.32, [[sph(0.26, 14, 10), '#ffd23f', M(0, 0.22, 0, 0, 0, 0, 1.15, 0.8, 1)], [sph(0.17, 12, 10), '#ffd23f', M(0.12, 0.48, 0)],
    [new THREE.ConeGeometry(0.07, 0.16, 8), '#ff8a1f', M(0.3, 0.46, 0, 0, 0, -Math.PI / 2)], [sph(0.03, 6, 4), '#222', M(0.24, 0.53, 0.09)], [sph(0.03, 6, 4), '#222', M(0.24, 0.53, -0.09)]]);
  add('car', 'Toy car', '🚗', 0.52, [[new THREE.BoxGeometry(0.95, 0.26, 0.5), '#3ab795', M(0, 0.25, 0)], [new THREE.BoxGeometry(0.5, 0.24, 0.44), '#bff3e6', M(-0.05, 0.48, 0)],
    ...[[-0.3, 0.26], [0.3, 0.26], [-0.3, -0.26], [0.3, -0.26]].map(([x, z]) => [cyl(0.13, 0.13, 0.1, 12), '#2b2d42', M(x, 0.13, z, Math.PI / 2)])]);
  add('teddy', 'Teddy', '🧸', 0.75, [[sph(0.45, 16, 12), '#b9773e', M(0, 0.45, 0, 0, 0, 0, 1, 1.05, 0.9)], [sph(0.32, 16, 12), '#b9773e', M(0, 1.05, 0)], [sph(0.12, 10, 8), '#b9773e', M(-0.24, 1.3, 0)], [sph(0.12, 10, 8), '#b9773e', M(0.24, 1.3, 0)],
    [sph(0.13, 10, 8), '#e9c08f', M(0, 0.98, 0.27, 0, 0, 0, 1, 0.8, 0.7)], [sph(0.04, 6, 4), '#222', M(-0.1, 1.12, 0.27)], [sph(0.04, 6, 4), '#222', M(0.1, 1.12, 0.27)], [sph(0.15, 10, 8), '#b9773e', M(-0.38, 0.6, 0.15)], [sph(0.15, 10, 8), '#b9773e', M(0.38, 0.6, 0.15)]]);
  add('rocket', 'Rocket', '🚀', 1.0, [[cyl(0.42, 0.5, 1.5, 18), '#f4f4f8', M(0, 0.95, 0)], [new THREE.ConeGeometry(0.42, 0.6, 18), '#ff4d6d', M(0, 2.0, 0)], [sph(0.18, 12, 10), '#59c3ff', M(0, 1.25, 0.38, 0, 0, 0, 1, 1, 0.5)],
    ...[0, 1, 2].map(i => [new THREE.BoxGeometry(0.08, 0.5, 0.45), '#ff4d6d', M(Math.cos(i * 2.09) * 0.5, 0.35, Math.sin(i * 2.09) * 0.5, 0, -i * 2.09)])]);
  return D;
}

export const THEMES = [
  { name: 'Picnic', ground: ['#86d94a', '#7acb41'], rim: '#5fae35', base: '#a0703d', bg: ['#bfe9ff', '#e9fbff'], small: ['strawberry', 'kiwi', 'orange', 'apple'], mid: ['slice', 'papaya'], big: ['melon', 'basket'], decor: 'blanket' },
  { name: 'Kitchen', ground: ['#fff6ea', '#ffe3cc'], rim: '#f2b183', base: '#c98b5e', bg: ['#ffd9e6', '#fff1d6'], small: ['sushi', 'macaron', 'cookie'], mid: ['donut', 'cupcake'], big: ['cake', 'pizza'], decor: 'tiles' },
  { name: 'Toy room', ground: ['#cfa36d', '#c0925c'], rim: '#9b6b3c', base: '#7a4f2c', bg: ['#d7c8ff', '#ffe0f2'], small: ['block', 'ball', 'duck'], mid: ['car'], big: ['teddy', 'rocket'], decor: 'rug' },
];
