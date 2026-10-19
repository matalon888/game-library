// cars.js — Piston Pop's twelve car tiers, each built from three.js primitives (body merged into one vertex-coloured
// mesh, wheels as their own meshes so they can spin). Plus the stretchy launcher and track helpers.
import { THREE, rounded } from './kit/hc.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(sx, sy, sz));
export function merge(parts) {
  const pos = [], nor = [], col = [], c = new THREE.Color();
  for (const [g0, m, color] of parts) {
    const g = g0.index ? g0.toNonIndexed() : g0.clone(); g.applyMatrix4(m); c.set(color);
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(c.r, c.g, c.b); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g;
}
export const vmat = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.15, ...o });
const rb = (w, h, d, r = 0.08) => { r = Math.min(r, w / 2.2, h / 2.2, d / 2.2); const g = rounded(w - 1.8 * r, d - 1.8 * r, h, r); g.rotateX(-Math.PI / 2); return g; };
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (a, b, h, s = 12) => new THREE.CylinderGeometry(a, b, h, s);
const GLASS = '#2a3b55', LIGHT = '#fff6c8', TAIL = '#ff3b3b', DARK = '#2b2d42';

// x = sideways, y = up, z = forward (car faces +z)
export const TIERS = [
  { name: 'Pebble Buggy', c: '#e0b070', a: '#5a4a3a', w: 0.42 },
  { name: 'Hatchling', c: '#7ec8ff', a: '#ffffff', w: 0.32 },
  { name: 'Sedanito', c: '#ff8fa3', a: '#ffffff', w: 0.32 },
  { name: 'Pickup Pal', c: '#ffb23a', a: '#7a4f2a', w: 0.36 },
  { name: 'Vanjo', c: '#9be7b0', a: '#ffffff', w: 0.33 },
  { name: 'Coupe Zip', c: '#b48cff', a: '#2b2d42', w: 0.32 },
  { name: 'Muscle Max', c: '#ff4d4d', a: '#ffffff', w: 0.36 },
  { name: 'Rally Bolt', c: '#3fa9f5', a: '#ffd23f', w: 0.35 },
  { name: 'Sport Sprite', c: '#ffd23f', a: '#2b2d42', w: 0.33 },
  { name: 'Hyper Hex', c: '#2bd9a8', a: '#2b2d42', w: 0.34 },
  { name: 'Jet Rail', c: '#f2f2f7', a: '#ff5d8f', w: 0.33 },
  { name: 'Comet X', c: '#7b5cff', a: '#ffd23f', w: 0.34 },
];
function body(t) {
  const T = TIERS[t], c = T.c, a = T.a, p = [];
  const lights = (z, y, x = 0.32) => { p.push([rb(0.2, 0.1, 0.05, 0.03), M(x, y, z), LIGHT], [rb(0.2, 0.1, 0.05, 0.03), M(-x, y, z), LIGHT]); };
  const tails = (z, y, x = 0.32) => { p.push([rb(0.2, 0.08, 0.05, 0.03), M(x, y, z), TAIL], [rb(0.2, 0.08, 0.05, 0.03), M(-x, y, z), TAIL]); };
  switch (t) {
    case 0: p.push([rb(0.9, 0.18, 1.5, 0.06), M(0, 0.42, 0), c], [rb(0.7, 0.12, 0.5, 0.05), M(0, 0.55, -0.15), a], [cyl(0.04, 0.04, 0.7, 6), M(0.33, 0.8, -0.3, 0, 0, 0), DARK], [cyl(0.04, 0.04, 0.7, 6), M(-0.33, 0.8, -0.3), DARK], [cyl(0.04, 0.04, 0.7, 6), M(0, 1.14, -0.3, 0, 0, Math.PI / 2), DARK], [rb(0.5, 0.12, 0.3, 0.05), M(0, 0.55, 0.5), '#8f5c2c']); lights(0.76, 0.45, 0.25); break;
    case 1: p.push([rb(1.0, 0.45, 1.5, 0.18), M(0, 0.55, 0), c], [rb(0.86, 0.38, 0.8, 0.16), M(0, 0.92, -0.15), c], [rb(0.8, 0.26, 0.05, 0.05), M(0, 0.95, 0.26), GLASS], [rb(0.05, 0.24, 0.6, 0.03), M(0.43, 0.95, -0.15), GLASS], [rb(0.05, 0.24, 0.6, 0.03), M(-0.43, 0.95, -0.15), GLASS]); lights(0.76, 0.6); tails(-0.76, 0.6); break;
    case 2: p.push([rb(1.0, 0.36, 2.0, 0.14), M(0, 0.5, 0), c], [rb(0.86, 0.34, 0.95, 0.14), M(0, 0.82, -0.1), a], [rb(0.8, 0.24, 0.05, 0.05), M(0, 0.84, 0.38), GLASS], [rb(0.05, 0.22, 0.75, 0.03), M(0.43, 0.84, -0.1), GLASS], [rb(0.05, 0.22, 0.75, 0.03), M(-0.43, 0.84, -0.1), GLASS]); lights(1.0, 0.52); tails(-1.0, 0.55); break;
    case 3: p.push([rb(1.05, 0.4, 2.1, 0.12), M(0, 0.55, 0), c], [rb(0.95, 0.42, 0.8, 0.14), M(0, 0.95, 0.35), c], [rb(0.85, 0.26, 0.05, 0.05), M(0, 0.98, 0.76), GLASS], [rb(0.95, 0.18, 0.06, 0.03), M(0, 0.84, -1.02), a], [rb(0.06, 0.18, 1.0, 0.03), M(0.5, 0.84, -0.5), a], [rb(0.06, 0.18, 1.0, 0.03), M(-0.5, 0.84, -0.5), a], [rb(0.8, 0.08, 0.95, 0.03), M(0, 0.76, -0.5), '#7a4f2a']); lights(1.06, 0.58); tails(-1.06, 0.62); break;
    case 4: p.push([rb(1.05, 0.95, 2.0, 0.2), M(0, 0.85, -0.1), c], [rb(1.05, 0.45, 0.5, 0.16), M(0, 0.55, 0.95), c], [rb(0.9, 0.36, 0.05, 0.06), M(0, 1.05, 0.91), GLASS], [rb(0.05, 0.3, 1.2, 0.04), M(0.53, 1.05, -0.2), GLASS], [rb(0.05, 0.3, 1.2, 0.04), M(-0.53, 1.05, -0.2), GLASS], [rb(1.07, 0.14, 2.0, 0.04), M(0, 0.7, -0.1), a]); lights(1.21, 0.6); tails(-1.11, 0.7); break;
    case 5: p.push([rb(1.05, 0.34, 2.1, 0.14), M(0, 0.47, 0), c], [rb(0.85, 0.3, 0.9, 0.16), M(0, 0.76, -0.25), c], [rb(0.8, 0.22, 0.05, 0.05), M(0, 0.78, 0.2, -0.5), GLASS], [rb(0.9, 0.06, 0.3, 0.02), M(0, 0.7, -1.0), a]); lights(1.05, 0.48); tails(-1.05, 0.5); break;
    case 6: p.push([rb(1.1, 0.4, 2.3, 0.12), M(0, 0.5, 0), c], [rb(0.9, 0.3, 0.85, 0.12), M(0, 0.82, -0.35), c], [rb(0.84, 0.22, 0.05, 0.05), M(0, 0.84, 0.08, -0.45), GLASS], [rb(0.18, 0.02, 2.32, 0.01), M(0.16, 0.71, 0), a], [rb(0.18, 0.02, 2.32, 0.01), M(-0.16, 0.71, 0), a], [rb(0.4, 0.12, 0.4, 0.05), M(0, 0.76, 0.6), DARK], [rb(1.0, 0.06, 0.25, 0.02), M(0, 0.82, -1.08), DARK], [cyl(0.06, 0.06, 0.24, 8), M(0.3, 0.36, -1.18, Math.PI / 2), '#c0c4cc'], [cyl(0.06, 0.06, 0.24, 8), M(-0.3, 0.36, -1.18, Math.PI / 2), '#c0c4cc']); lights(1.16, 0.52); tails(-1.16, 0.55); break;
    case 7: p.push([rb(1.05, 0.45, 1.9, 0.16), M(0, 0.55, 0), c], [rb(0.9, 0.36, 0.95, 0.16), M(0, 0.9, -0.15), c], [rb(0.82, 0.25, 0.05, 0.05), M(0, 0.92, 0.33, -0.4), GLASS], [rb(0.3, 0.1, 0.35, 0.04), M(0, 1.1, -0.05), DARK], [rb(1.1, 0.06, 0.3, 0.02), M(0, 1.15, -0.95), a], [rb(0.05, 0.25, 0.1, 0.02), M(0.45, 1.0, -0.95), a], [rb(0.05, 0.25, 0.1, 0.02), M(-0.45, 1.0, -0.95), a], [rb(1.07, 0.1, 1.92, 0.03), M(0, 0.45, 0), a], [rb(0.6, 0.12, 0.1, 0.04), M(0, 0.58, 0.97), LIGHT]); tails(-0.96, 0.6); break;
    case 8: p.push([rb(1.1, 0.3, 2.2, 0.12), M(0, 0.42, 0), c], [rb(0.8, 0.26, 0.85, 0.14), M(0, 0.66, -0.25), DARK], [rb(1.12, 0.06, 0.35, 0.02), M(0, 0.86, -1.0), DARK], [rb(0.06, 0.22, 0.12, 0.02), M(0.4, 0.72, -1.0), DARK], [rb(0.06, 0.22, 0.12, 0.02), M(-0.4, 0.72, -1.0), DARK], [rb(0.5, 0.04, 0.8, 0.02), M(0, 0.58, 0.6), a]); lights(1.1, 0.42); tails(-1.1, 0.45); break;
    case 9: p.push([rb(1.25, 0.26, 2.3, 0.1), M(0, 0.36, 0), c], [rb(0.75, 0.22, 0.8, 0.12), M(0, 0.56, -0.2), GLASS], [rb(0.12, 0.35, 0.6, 0.04), M(0.55, 0.55, -0.85), a], [rb(0.12, 0.35, 0.6, 0.04), M(-0.55, 0.55, -0.85), a], [rb(1.3, 0.05, 0.3, 0.02), M(0, 0.78, -1.05), a], [rb(1.2, 0.08, 0.2, 0.03), M(0, 0.22, 1.15), a]); lights(1.15, 0.38, 0.4); tails(-1.15, 0.4, 0.4); break;
    case 10: p.push([rb(1.0, 0.3, 2.6, 0.14), M(0, 0.45, 0), c], [new THREE.ConeGeometry(0.45, 0.8, 12), M(0, 0.45, 1.6, Math.PI / 2), c], [rb(0.6, 0.24, 0.8, 0.12), M(0, 0.68, 0.1), GLASS], [rb(1.8, 0.05, 0.5, 0.02), M(0, 0.48, -0.5), a], [rb(0.06, 0.5, 0.5, 0.02), M(0, 0.8, -1.1), a], [cyl(0.24, 0.3, 0.4, 12), M(0, 0.48, -1.45, Math.PI / 2), '#8890a0'], [cyl(0.16, 0.16, 0.05, 12), M(0, 0.48, -1.66, Math.PI / 2), '#ff8a3c']); break;
    default: p.push([new THREE.CapsuleGeometry(0.5, 2.0, 6, 14), M(0, 0.6, 0, Math.PI / 2), c], [new THREE.SphereGeometry(0.34, 14, 10), M(0, 0.86, 0.35, 0, 0, 0, 1, 0.7, 1.4), GLASS], [rb(0.06, 0.6, 0.6, 0.02), M(0.5, 0.95, -0.9, 0, 0, -0.5), a], [rb(0.06, 0.6, 0.6, 0.02), M(-0.5, 0.95, -0.9, 0, 0, 0.5), a], [cyl(0.3, 0.4, 0.4, 14), M(0, 0.6, -1.5, Math.PI / 2), '#6a7080'], [cyl(0.22, 0.22, 0.05, 14), M(0, 0.6, -1.72, Math.PI / 2), '#ffd23f'], [rb(1.3, 0.06, 0.4, 0.02), M(0, 0.4, 0.4), a]);
  }
  return p;
}
const WHEEL = cyl(1, 1, 1, 16); WHEEL.rotateZ(Math.PI / 2);
const HUB = cyl(1, 1, 1, 10); HUB.rotateZ(Math.PI / 2);
const tireM = new THREE.MeshStandardMaterial({ color: '#2b2d42', roughness: 0.8 }), hubM = new THREE.MeshStandardMaterial({ color: '#dfe3ea', roughness: 0.3, metalness: 0.5 });
export function carModel(t) {
  const g = new THREE.Group(), T = TIERS[t];
  const b = new THREE.Mesh(merge(body(t)), vmat()); b.castShadow = true; g.add(b); g.body = b;
  const len = [0.62, 0.55, 0.72, 0.75, 0.75, 0.75, 0.82, 0.68, 0.8, 0.85, 0.95, 0.9][t], wx = [0.5, 0.5, 0.5, 0.53, 0.53, 0.53, 0.56, 0.55, 0.56, 0.62, 0.55, 0.55][t];
  g.wheels = [];
  for (const [x, z] of [[wx, len], [-wx, len], [wx, -len], [-wx, -len]]) {
    const w = new THREE.Group(); w.position.set(x, T.w, z);
    const tire = new THREE.Mesh(WHEEL, tireM); tire.scale.set(0.2, T.w, T.w); tire.castShadow = true;
    const hub = new THREE.Mesh(HUB, hubM); hub.scale.set(0.21, T.w * 0.5, T.w * 0.5);
    w.add(tire, hub); g.add(w); g.wheels.push(w);
  }
  if (t >= 10) { const flame = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.9, 10), new THREE.MeshBasicMaterial({ color: '#ffb23a', transparent: true, opacity: 0.85 })); flame.rotation.x = -Math.PI / 2; flame.position.set(0, t === 10 ? 0.48 : 0.6, t === 10 ? -2.05 : -2.15); flame.visible = false; g.add(flame); g.flame = flame; }
  g.tier = t; return g;
}
