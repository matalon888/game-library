// Voidlance models: every ship is built from primitives in code, merged per material (few draw calls, lots of detail).
// All ships face +Z. Hostile "Choir" machines: gunmetal + red; friendly Tessarine fleet: pale grey + cyan.
import * as THREE from './kit/three.module.min.js';
import { mergeGeometries } from './kit/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from './kit/addons/geometries/RoundedBoxGeometry.js';
import { procTex } from './kit/cine.js';

const E = new THREE.Euler(), Qt = new THREE.Quaternion(), Mt = new THREE.Matrix4(), Vp = new THREE.Vector3(), Vs = new THREE.Vector3();
export class Builder {
  constructor() { this.parts = {}; }
  add(k, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    Mt.compose(Vp.set(x, y, z), Qt.setFromEuler(E.set(rx, ry, rz)), Vs.set(sx, sy, sz)); g.applyMatrix4(Mt);
    (this.parts[k] ||= []).push(g); return this;
  }
  box(k, w, h, d, x, y, z, rx, ry, rz) { return this.add(k, new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz); }
  rbox(k, w, h, d, r, x, y, z, rx, ry, rz) { return this.add(k, new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.1, h / 2.1, d / 2.1)), x, y, z, rx, ry, rz); }
  cyl(k, rt, rb, h, seg, x, y, z, rx = 0, ry = 0, rz = 0, open = false) { return this.add(k, new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), x, y, z, rx, ry, rz); }
  sph(k, r, x, y, z, sx = 1, sy = 1, sz = 1, ws = 16, hs = 12) { return this.add(k, new THREE.SphereGeometry(r, ws, hs), x, y, z, 0, 0, 0, sx, sy, sz); }
  geos() { const o = {}; for (const k in this.parts) { o[k] = mergeGeometries(this.parts[k]); o[k].computeBoundingSphere(); } return o; }
}
export function meshFrom(geos, mats, outline = 0) {
  const g = new THREE.Group();
  if (outline) { if (!geos.__ol) Object.defineProperty(geos, '__ol', { value: outlineGeo(geos), enumerable: false }); g.add(new THREE.Mesh(geos.__ol, outlineMat(outline))); }
  for (const k in geos) { const m = new THREE.Mesh(geos[k], mats[k]); m.name = k; if (mats[k].blending === THREE.AdditiveBlending) m.renderOrder = 4; g.add(m); }
  return g;
}

// ---------------------------------------------------------------- materials
function windowTex(color = '#ffcc88', density = 0.35) {
  const n = 512, c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, n, n);
  for (let row = 6; row < n; row += 14) { if (Math.random() < 0.35) continue; for (let col = 4; col < n; col += 9) if (Math.random() < density) { x.fillStyle = Math.random() < 0.15 ? '#ffffff' : color; x.globalAlpha = 0.5 + Math.random() * 0.5; x.fillRect(col, row, 5, 3); } }
  x.globalAlpha = 1; const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function toonGrad() {
  const d = new Uint8Array([90, 170, 255]); const t = new THREE.DataTexture(d, 3, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
}
export const GRAD = toonGrad();
export const toon = (color, o = {}) => new THREE.MeshToonMaterial({ color, gradientMap: GRAD, ...o });
export function makeMats() {
  const panel = procTex('panel', { color: '#ececf4' }), metal = procTex('metal', { color: '#e4e4ee' }), lightPanel = procTex('panel', { color: '#ffffff' });
  panel.repeat.set(2, 2); lightPanel.repeat.set(2, 2);
  const glow = (r, g, b, i = 1) => new THREE.MeshToonMaterial({ color: new THREE.Color(r, g, b), emissive: new THREE.Color(r, g, b), emissiveIntensity: i, gradientMap: GRAD });
  const add = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  return {
    // hostile "Choir" bots: violet + indigo + hot magenta + yellow eyes
    dark: toon(0x7b52ff, { map: panel }),
    mid: toon(0x34307e, { map: metal }),
    hullWin: toon(0x8a63ff, { map: panel, emissive: new THREE.Color(1, 0.85, 0.3), emissiveMap: windowTex('#ffe066', 0.3), emissiveIntensity: 1.6 }),
    red: glow(1, 0.18, 0.6, 3.5), redSoft: glow(1, 0.3, 0.6, 1.5), amber: glow(1, 0.85, 0.15, 3), core: glow(1, 0.6, 0.15, 5),
    eye: glow(1, 0.95, 0.25, 3.2),
    shieldGen: new THREE.MeshToonMaterial({ color: 0x6ff6ff, emissive: new THREE.Color(0.2, 0.9, 1), emissiveIntensity: 1.6, gradientMap: GRAD, transparent: true, opacity: 0.9 }),
    plumeR: add(3, 0.6, 2), plumeA: add(3, 1.8, 0.4), plumeB: add(0.5, 2.4, 3),
    // friendly Tessarine fleet: white + orange + teal
    light: toon(0xf6f7fc, { map: lightPanel }),
    lightWin: toon(0xf0f2fa, { map: lightPanel, emissive: new THREE.Color(0.3, 1, 0.95), emissiveMap: windowTex('#7ffff0', 0.35), emissiveIntensity: 1.4 }),
    blue: glow(0.25, 1, 0.92, 3), accent: toon(0xff8a1f),
    glass: toon(0x46e6ff, { emissive: new THREE.Color(0.1, 0.5, 0.7), emissiveIntensity: 0.6 }),
    debris: toon(0x6a46e0, { emissive: new THREE.Color(1, 0.45, 0.1), emissiveIntensity: 0.35 }),
  };
}
// cartoon outline: one back-face hull pushed out along normals (one extra draw call per ship)
const OUT_CACHE = new Map();
export function outlineMat(th, color = 0x1a1340) {
  const k = th + ':' + color; if (OUT_CACHE.has(k)) return OUT_CACHE.get(k);
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = position + normal * ${th.toFixed(3)};`); };
  m.customProgramCacheKey = () => 'ol' + k; OUT_CACHE.set(k, m); return m;
}
export function outlineGeo(geos) {
  const list = []; for (const k in geos) if (!k.startsWith('plume')) list.push(geos[k]);
  return mergeGeometries(list);
}

const rnd = (a, b) => a + Math.random() * (b - a);
function greebles(b, key, n, w, h, l, y, zc = 0, top = true, side = true) {
  for (let i = 0; i < n; i++) {
    const gw = rnd(0.5, 2.6) * w * 0.08, gh = rnd(0.3, 1.2) * h * 0.08, gl = rnd(0.5, 3) * l * 0.015, z = zc + rnd(-0.48, 0.48) * l;
    if (top && (!side || Math.random() < 0.6)) b.box(key, gw, gh, gl, rnd(-0.45, 0.45) * w, y + h / 2 + gh / 2, z);
    else { const s = Math.random() < 0.5 ? -1 : 1; b.box(key, gh, gw, gl, s * (w / 2 + gh / 2), y + rnd(-0.4, 0.4) * h, z); }
  }
}

// ---------------------------------------------------------------- small craft
export function wispGeos() {          // Choir drone fighter, ~6 long
  const b = new Builder();
  b.sph('dark', 1.15, 0, 0, 0.1, 1, 0.78, 1.45, 20, 14);
  b.add('mid', new THREE.TorusGeometry(0.62, 0.11, 8, 20), 0, 0, 1.35);
  b.sph('eye', 0.48, 0, 0, 1.36, 1, 1, 0.6);
  b.cyl('mid', 0.55, 0.42, 1.2, 12, 0, 0, -1.55, Math.PI / 2);
  b.cyl('red', 0.36, 0.36, 0.08, 12, 0, 0, -2.18, Math.PI / 2);
  b.add('plumeR', new THREE.ConeGeometry(0.34, 2.6, 10, 1, true), 0, 0, -3.5, -Math.PI / 2);
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + k * Math.PI / 2, cx = Math.cos(a), cy = Math.sin(a);
    b.box('dark', 0.16, 2.4, 2.6, cx * 1.85, cy * 1.85, -0.3, 0.25 * cy, -0.25 * cx, a - Math.PI / 2);
    b.box('mid', 0.2, 0.5, 3.0, cx * 2.95, cy * 2.95, -0.45, 0, 0, a - Math.PI / 2);
    b.box('red', 0.06, 0.08, 2.4, cx * 3.22, cy * 3.22, -0.35, 0, 0, a);
    b.cyl('mid', 0.06, 0.06, 1.6, 5, cx * 2.95, cy * 2.95, 1.3, Math.PI / 2);
  }
  b.box('mid', 0.1, 0.1, 1.2, 0.5, 0.75, 0.6); b.box('mid', 0.1, 0.1, 1.2, -0.5, -0.75, 0.6);
  return b.geos();
}
export function hammerGeos() {        // Choir bomber, ~13 long
  const b = new Builder();
  b.rbox('dark', 3.2, 1.7, 8.5, 0.4, 0, 0, 0);
  b.add('dark', new THREE.CylinderGeometry(0.2, 1.6, 3.2, 4), 0, 0, 5.6, Math.PI / 2, Math.PI / 4, 0, 1, 1, 0.55);
  b.box('red', 1.8, 0.16, 0.12, 0, 0.35, 4.55);
  for (const s of [-1, 1]) {
    b.cyl('mid', 0.95, 0.95, 7.5, 14, s * 2.9, -0.2, -0.6, Math.PI / 2);
    b.cyl('dark', 0.75, 0.95, 1.2, 14, s * 2.9, -0.2, 3.7, Math.PI / 2);
    b.sph('amber', 0.32, s * 2.9, -0.2, 4.35);
    b.box('dark', 4.6, 0.22, 3.2, s * 4.8, 0, -1.6, 0, s * 0.35, s * -0.08);
    b.box('red', 0.1, 0.12, 2.6, s * 7.0, 0, -2.5, 0, s * 0.35, 0);
    b.cyl('mid', 0.8, 0.6, 0.6, 14, s * 2.9, -0.2, -4.6, Math.PI / 2);
    b.cyl('amber', 0.55, 0.55, 0.1, 14, s * 2.9, -0.2, -4.92, Math.PI / 2);
    b.add('plumeA', new THREE.ConeGeometry(0.5, 3.4, 10, 1, true), s * 2.9, -0.2, -6.6, -Math.PI / 2);
    b.box('mid', 0.3, 1.4, 1.8, s * 1.0, 1.2, -2.5, 0, 0, s * 0.3);
  }
  b.box('amber', 1.2, 0.1, 3.0, 0, -0.9, 0.5);
  greebles(b, 'mid', 14, 3.2, 1.7, 8.5, 0);
  return b.geos();
}
export function lanceGeos() {         // friendly fighter (wingmen), ~9 long
  const b = new Builder();
  b.rbox('light', 1.5, 1.0, 7.5, 0.35, 0, 0, 0);
  b.add('light', new THREE.CylinderGeometry(0.05, 0.75, 2.6, 6), 0, 0, 5.0, Math.PI / 2, 0, 0, 1, 0.7, 1);
  b.sph('glass', 0.55, 0, 0.55, 1.6, 1, 0.7, 2.2);
  for (const s of [-1, 1]) {
    b.box('light', 5.2, 0.16, 2.6, s * 3.0, -0.1, -1.4, 0, s * 0.25, s * 0.06);
    b.box('accent', 2.4, 0.18, 0.6, s * 3.6, -0.08, -0.6, 0, s * 0.25, s * 0.06);
    b.cyl('light', 0.14, 0.14, 3.4, 6, s * 5.6, -0.25, 0.4, Math.PI / 2);
    b.box('light', 0.16, 1.6, 1.6, s * 0.7, 0.9, -3, 0, 0, s * 0.35);
    b.cyl('light', 0.5, 0.45, 2.2, 12, s * 0.75, -0.1, -3.6, Math.PI / 2);
    b.cyl('blue', 0.36, 0.36, 0.06, 12, s * 0.75, -0.1, -4.72, Math.PI / 2);
    b.add('plumeB', new THREE.ConeGeometry(0.32, 3, 10, 1, true), s * 0.75, -0.1, -6.2, -Math.PI / 2);
  }
  return b.geos();
}
export function missileGeos(friendly = true) {
  const b = new Builder(), k = friendly ? 'light' : 'dark';
  b.cyl(k, 0.18, 0.18, 2.2, 8, 0, 0, 0, Math.PI / 2);
  b.add(k, new THREE.ConeGeometry(0.18, 0.6, 8), 0, 0, 1.4, Math.PI / 2);
  for (let i = 0; i < 4; i++) b.box('mid', 0.04, 0.5, 0.5, Math.cos(i * Math.PI / 2) * 0.25, Math.sin(i * Math.PI / 2) * 0.25, -0.8, 0, 0, i * Math.PI / 2);
  b.sph(friendly ? 'blue' : 'amber', 0.2, 0, 0, -1.15);
  return b.geos();
}
export function torpGeos() {
  const b = new Builder();
  b.sph('dark', 0.7, 0, 0, 0, 1, 1, 1.8, 12, 8); b.sph('amber', 0.45, 0, 0, 1.0, 1, 1, 0.8, 12, 8);
  for (let i = 0; i < 3; i++) b.box('mid', 0.08, 1.2, 0.9, Math.cos(i * 2.09) * 0.6, Math.sin(i * 2.09) * 0.6, -0.9, 0, 0, i * 2.09 + Math.PI / 2);
  return b.geos();
}

// ---------------------------------------------------------------- turret (base + head; head aims, barrels along +Z)
export function turretGeos(big = false) {
  const s = big ? 1.7 : 1, b = new Builder(), h = new Builder();
  b.cyl('mid', 2.6 * s, 3.0 * s, 1.0 * s, 16, 0, 0.5 * s, 0); b.cyl('dark', 2.2 * s, 2.6 * s, 0.6 * s, 16, 0, 1.2 * s, 0);
  h.rbox('dark', 3.4 * s, 2.0 * s, 3.6 * s, 0.4 * s, 0, 0, 0); h.box('red', 2.2 * s, 0.18 * s, 0.1 * s, 0, 0.3 * s, 1.82 * s);
  for (const x of [-0.75, 0.75]) { h.cyl('mid', 0.28 * s, 0.34 * s, 4.6 * s, 10, x * s, -0.2 * s, 3.6 * s, Math.PI / 2); h.cyl('dark', 0.42 * s, 0.42 * s, 1.0 * s, 10, x * s, -0.2 * s, 2.0 * s, Math.PI / 2); }
  h.box('mid', 0.6 * s, 0.6 * s, 1.2 * s, 1.5 * s, 0.6 * s, -1 * s);
  return { base: b.geos(), head: h.geos() };
}

// ---------------------------------------------------------------- capital ships
export function frigateGeos() {       // Cantor-class frigate, ~130 long. returns geos + mount points
  const b = new Builder();
  b.rbox('hullWin', 16, 12, 84, 2, 0, 0, 0);
  b.add('dark', new THREE.CylinderGeometry(0.5, 11, 34, 4), 0, -1, 58, Math.PI / 2, Math.PI / 4, 0, 1, 1, 0.62);
  b.rbox('dark', 22, 6, 40, 1.5, 0, -6, 6);
  b.rbox('hullWin', 10, 8, 26, 1.5, 0, 9, -22); b.rbox('dark', 7, 5, 12, 1, 0, 15, -26); b.box('red', 6.4, 0.5, 0.2, 0, 15.6, -19.9);
  b.cyl('mid', 0.3, 0.3, 14, 5, 2, 22, -28); b.cyl('mid', 0.2, 0.2, 10, 5, -2, 20, -30); b.sph('red', 0.6, 2, 29, -28);
  for (const s of [-1, 1]) {
    b.rbox('hullWin', 6, 7, 52, 1, s * 11, 0, -6);
    b.cyl('mid', 0.7, 0.7, 70, 8, s * 8.6, 4.8, 4, Math.PI / 2); b.cyl('mid', 0.45, 0.45, 70, 8, s * 8.4, 3.2, 4, Math.PI / 2);
    for (let z = -26; z <= 26; z += 13) b.box('dark', 1.6, 9, 3, s * 14.3, 0, z - 6);
    b.box('red', 0.2, 0.3, 30, s * 14.2, 3.9, -6);
    b.sph('red', 0.5, s * 11, -5.5, 70);
  }
  // engine bank
  for (const [x, y] of [[-5, 3], [5, 3], [-5, -3.5], [5, -3.5]]) {
    b.cyl('mid', 3.2, 2.6, 6, 16, x, y, -45, Math.PI / 2); b.cyl('red', 2.4, 2.4, 0.3, 16, x, y, -48.1, Math.PI / 2);
    b.add('plumeR', new THREE.ConeGeometry(2.3, 16, 16, 1, true), x, y, -56, -Math.PI / 2);
  }
  greebles(b, 'dark', 70, 16, 12, 84, 0);
  greebles(b, 'mid', 40, 22, 6, 40, -6, 6);
  const mounts = [{ p: [0, 6.2, 22], up: [0, 1, 0] }, { p: [0, 12.6, -8], up: [0, 1, 0] }, { p: [0, -9.2, 14], up: [0, -1, 0] }, { p: [13.8, 0, 16], up: [1, 0, 0] }, { p: [-13.8, 0, 16], up: [-1, 0, 0] }];
  const hull = [[0, 0, 52, 9], [0, 0, 34, 14], [0, 0, 14, 15], [0, 0, -6, 16], [0, 2, -26, 15], [0, 0, -44, 10]];
  return { geos: b.geos(), mounts, hull };
}
export function dreadGeos() {         // Requiem dreadnought, ~460 long
  const b = new Builder();
  b.rbox('hullWin', 54, 38, 300, 4, 0, 0, 0);
  b.add('dark', new THREE.CylinderGeometry(1, 36, 130, 4), 0, -2, 214, Math.PI / 2, Math.PI / 4, 0, 1, 1, 0.66);
  b.rbox('dark', 40, 20, 120, 3, 0, 26, -40); b.rbox('hullWin', 22, 26, 40, 3, 0, 46, -90); b.rbox('dark', 30, 6, 22, 2, 0, 61, -92); b.box('red', 26, 1, 0.5, 0, 52, -69.6);
  for (let i = 0; i < 4; i++) b.cyl('mid', 0.6, 0.6, 30 - i * 5, 6, -8 + i * 5, 74 - i * 2, -96);
  b.sph('red', 1.6, -8, 89, -96);
  for (const s of [-1, 1]) {
    b.rbox('hullWin', 30, 22, 220, 3, s * 60, -4, -20);
    b.add('dark', new THREE.CylinderGeometry(1, 16, 50, 4), s * 60, -4, 114, Math.PI / 2, Math.PI / 4, 0, 1, 1, 0.8);
    for (let z = -110; z <= 70; z += 30) { b.box('dark', 12, 8, 6, s * 33, 0, z); b.box('mid', 4, 4, 4, s * 39, 6, z + 8); }
    for (let z = -100; z <= 60; z += 32) b.box('red', 0.6, 5, 18, s * 75.3, -4, z);
    b.cyl('mid', 1.5, 1.5, 260, 8, s * 28, 15, 0, Math.PI / 2); b.cyl('mid', 1.0, 1.0, 260, 8, s * 28, 10.5, 0, Math.PI / 2);
    b.cyl('mid', 1.2, 1.2, 200, 8, s * 45, -14, -20, Math.PI / 2);
    b.sph('red', 1.2, s * 75, 8, 90);
  }
  // reactor cradle under the belly
  b.add('mid', new THREE.TorusGeometry(17, 2.2, 10, 32), 0, -27, 20, Math.PI / 2); b.add('mid', new THREE.TorusGeometry(17, 2.2, 10, 32), 0, -27, 30, Math.PI / 2);
  for (let i = 0; i < 8; i++) b.box('dark', 2, 2, 16, Math.cos(i * 0.785) * 16, -27 + Math.sin(i * 0.785) * 16, 25);
  greebles(b, 'dark', 220, 54, 38, 300, 0);
  greebles(b, 'mid', 90, 40, 20, 120, 26, -40, true, false);
  return { geos: b.geos() };
}
export function dreadParts() {        // separately destructible meshes: shield generators, engine banks, reactor core, armour shells
  const gen = new Builder(); gen.cyl('mid', 9, 12, 6, 20, 0, 3, 0); gen.cyl('dark', 7, 9, 4, 20, 0, 8, 0); gen.add('shieldGen', new THREE.SphereGeometry(9, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), 0, 9, 0);
  for (let i = 0; i < 6; i++) gen.box('mid', 1.2, 14, 1.2, Math.cos(i * 1.047) * 10, 9, Math.sin(i * 1.047) * 10, Math.sin(i * 1.047) * 0.3, 0, -Math.cos(i * 1.047) * 0.3);
  const eng = new Builder();
  for (const [x, y] of [[-11, 9], [11, 9], [0, -9]]) { eng.cyl('mid', 11, 9, 22, 20, x, y, 0, Math.PI / 2); eng.cyl('red', 8, 8, 0.6, 20, x, y, -11.2, Math.PI / 2); eng.add('plumeR', new THREE.ConeGeometry(7.5, 60, 18, 1, true), x, y, -41, -Math.PI / 2); }
  eng.rbox('dark', 34, 34, 14, 2, 0, 0, 10);
  const core = new Builder(); core.sph('core', 11, 0, 0, 0, 1, 1, 1, 32, 20); core.add('mid', new THREE.TorusGeometry(13, 1.2, 8, 40), 0, 0, 0, 0.4, 0, 0); core.add('mid', new THREE.TorusGeometry(13, 1.2, 8, 40), 0, 0, 0, -0.4, 1.2, 0);
  const shell = new Builder(); shell.add('dark', new THREE.SphereGeometry(16, 24, 12, 0, Math.PI, 0, Math.PI), 0, 0, 0, 0, 0, 0); greebles(shell, 'mid', 14, 20, 8, 20, 6);
  return { gen: gen.geos(), eng: eng.geos(), core: core.geos(), shell: shell.geos() };
}
export function carrierGeos() {       // Halcyon: friendly carrier, ~240 long
  const b = new Builder();
  b.rbox('lightWin', 34, 22, 170, 3, 0, 0, 0);
  b.add('light', new THREE.CylinderGeometry(1, 22, 70, 6), 0, 0, 118, Math.PI / 2, 0, 0, 1, 1, 0.6);
  b.rbox('light', 50, 6, 120, 2, 0, -12, 10); b.box('blue', 30, 0.6, 0.4, 0, -12, 70.2); b.box('glass', 26, 3.5, 2, 0, -12, 70.5);
  b.rbox('lightWin', 12, 24, 30, 2, 12, 22, -40); b.box('glass', 10, 2, 0.4, 12, 30, -24.8); b.cyl('light', 0.5, 0.5, 16, 6, 14, 42, -44); b.sph('blue', 0.8, 14, 50, -44);
  for (const s of [-1, 1]) {
    b.cyl('light', 1.2, 1.2, 150, 8, s * 17.5, 8, 0, Math.PI / 2); b.box('accent', 0.4, 3, 120, s * 17.2, 0, 10); b.box('blue', 0.3, 0.4, 100, s * 25.2, -12, 10);
    for (let z = -50; z <= 60; z += 22) b.box('light', 4, 14, 8, s * 19, 0, z);
  }
  for (const [x, y] of [[-9, 5], [9, 5], [-9, -6], [9, -6], [0, 0]]) { b.cyl('light', 5, 4.2, 10, 16, x, y, -88, Math.PI / 2); b.cyl('blue', 3.8, 3.8, 0.3, 16, x, y, -93.2, Math.PI / 2); b.add('plumeB', new THREE.ConeGeometry(3.6, 26, 16, 1, true), x, y, -106, -Math.PI / 2); }
  greebles(b, 'light', 80, 34, 22, 170, 0);
  const hull = [[0, 0, 110, 12], [0, 0, 70, 20], [0, 0, 30, 22], [0, 0, -10, 22], [0, 0, -50, 22], [0, 0, -85, 16], [12, 22, -40, 14]];
  return { geos: b.geos(), hull };
}

// ---------------------------------------------------------------- cockpit (attached to the camera; -Z is forward)
export function buildCockpit(mats) {
  const g = new THREE.Group(), dashG = new THREE.Group(), dash = new Builder(); g.add(dashG);
  const panel = procTex('panel', { color: '#ffffff' }); panel.repeat.set(3, 1);
  const cm = {
    dash: toon(0x2c2866, { map: panel }),
    trim: toon(0x1f1d48),
    stripe: toon(0x8a3412),
    cyan: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.9, 1.1) }),
    amber: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.6, 0.3) }),
    red: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.4, 0.9) }),
  };
  // dashboard: one console tilted toward the pilot (its top face is what we see), screens + buttons lie on it
  const tilt = new THREE.Group(); tilt.rotation.x = 0.5; tilt.position.z = -0.95; dashG.add(tilt);
  dash.rbox('dash', 2.6, 0.08, 0.9, 0.03, 0, 0, 0);
  dash.rbox('stripe', 2.6, 0.05, 0.05, 0.02, 0, 0.04, -0.45);
  dash.box('cyan', 2.5, 0.004, 0.004, 0, 0.068, -0.43);
  dash.rbox('trim', 0.74, 0.03, 0.3, 0.012, 0, 0.045, -0.12);
  for (let i = 0; i < 18; i++) dash.rbox(i % 5 === 0 ? 'amber' : i % 7 === 3 ? 'red' : 'cyan', 0.03, 0.012, 0.02, 0.004, -0.78 + i * 0.03 + (i > 8 ? 1.0 : 0), 0.046, 0.12);
  for (let i = 0; i < 6; i++) dash.cyl('stripe', 0.018, 0.018, 0.02, 10, -0.62 + i * 0.05 + (i > 2 ? 1.1 : 0), 0.05, 0.22);
  const dg = dash.geos(); for (const k in dg) { const m = new THREE.Mesh(dg[k], cm[k]); m.renderOrder = 10; tilt.add(m); }
  // instrument screens (canvas textures, redrawn by the HUD)
  const mkScreen = (w, h, x, y, z) => {
    const c = document.createElement('canvas'); c.width = 256; c.height = Math.round(256 * h / w); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(0.95, 0.95, 0.95), polygonOffset: true, polygonOffsetFactor: -2 }));
    m.position.set(x, y, z); m.rotation.x = -Math.PI / 2; m.renderOrder = 11; tilt.add(m); return { c, t, x: c.getContext('2d'), m };
  };
  const scrL = mkScreen(0.3, 0.17, -0.5, 0.052, -0.26), scrR = mkScreen(0.3, 0.17, 0.5, 0.052, -0.26);
  // canopy frame: placed to the viewport edges on resize
  const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1, 0.06), cm.trim), pillarR = pillar.clone(), top = new THREE.Mesh(new THREE.BoxGeometry(1, 0.05, 0.06), cm.trim);
  const glowL = new THREE.Mesh(new THREE.BoxGeometry(0.012, 1, 0.008), cm.stripe), glowR = glowL.clone();
  for (const m of [pillar, pillarR, top, glowL, glowR]) { m.renderOrder = 10; g.add(m); }
  // nose guns visible in the lower corners
  const gun = new Builder();
  for (const s of [-1, 1]) {
    gun.cyl('trim', 0.035, 0.05, 1.6, 10, s * 0.62, -0.42, -2.1, Math.PI / 2); gun.cyl('dash', 0.07, 0.07, 0.5, 10, s * 0.62, -0.42, -1.45, Math.PI / 2);
    gun.box('cyan', 0.01, 0.01, 0.9, s * 0.62, -0.37, -1.9);
  }
  const gunG = new THREE.Group(); g.add(gunG);
  const gunMesh = []; const gg = gun.geos(); for (const k in gg) { const m = new THREE.Mesh(gg[k], cm[k]); m.renderOrder = 10; gunG.add(m); gunMesh.push(m); }
  // muzzle flashes
  const ft = new THREE.SpriteMaterial({ map: null, color: new THREE.Color(3, 6, 8), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
  const flashes = [-1, 1].map(s => { const sp = new THREE.Sprite(ft.clone()); sp.position.set(s * 0.62, -0.42, -2.95); sp.scale.setScalar(0.001); sp.renderOrder = 12; gunG.add(sp); return sp; });
  const lamp = new THREE.PointLight(0x55ccff, 0.6, 3, 2); lamp.position.set(0, -0.2, -0.5); g.add(lamp);
  function fit(cam) {     // lay the canopy frame along the visible frustum at depth 1
    const hh = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)), hw = hh * cam.aspect, z = -1;
    const bx = hw * 0.97, tx = hw * 0.55, by = -hh * 0.4, ty = hh * 0.97, len = Math.hypot(bx - tx, ty - by), ang = Math.atan2(bx - tx, ty - by);
    pillar.scale.y = pillarR.scale.y = glowL.scale.y = glowR.scale.y = len;
    pillar.position.set(-(bx + tx) / 2, (by + ty) / 2, z); pillar.rotation.z = -ang; pillarR.position.set((bx + tx) / 2, (by + ty) / 2, z); pillarR.rotation.z = ang;
    glowL.position.set(-(bx + tx) / 2 + 0.03, (by + ty) / 2, z + 0.031); glowL.rotation.z = -ang; glowR.position.set((bx + tx) / 2 - 0.03, (by + ty) / 2, z + 0.031); glowR.rotation.z = ang;
    top.scale.x = tx * 2.2; top.position.set(0, ty, z);
    const portrait = cam.aspect < 0.8;
    const r = portrait ? 0.56 : 0.62; tilt.position.y = -0.242 - r * 1.331 * hh;
    gunG.position.y = -(r - 0.03) * 2.1 * hh + 0.42; g.userData.gunY = gunG.position.y;
    // keep the gun barrels inside the frame on narrow screens
    const gs = portrait ? 0.62 : 1; for (const m of gunMesh) m.scale.set(gs, 1, 1); flashes.forEach((f, i) => (f.position.x = (i ? 1 : -1) * 0.62 * gs));
    g.userData.portrait = portrait;
  }
  return { group: g, dashG, scrL, scrR, flashes, lamp, fit, mats: cm };
}
