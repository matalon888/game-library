// Ironsquall models: every machine is built from code (primitives, bevels, emissive trims) and merged per rigid part
// into ONE draw call with a shared vertex-colour + vertex-emissive PBR material.
import * as THREE from './kit/three.module.min.js';
import { RoundedBoxGeometry } from './kit/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from './kit/addons/utils/BufferGeometryUtils.js';
import { procTex } from './kit/cine.js';

// ------------------------------------------------------------------ shared material: vertexColors + per-vertex emissive
function mechCompile(sh) {
  sh.uniforms.uFlash = this.userData.uFlash;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 emi; varying vec3 vEmi;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvEmi = emi;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vEmi; uniform float uFlash;')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vEmi + vec3(uFlash * 1.6, uFlash * 1.2, uFlash);');
}
let PANEL = null, GRAD = null;
export function toonGrad() {
  if (!GRAD) { GRAD = new THREE.DataTexture(new Uint8Array([105, 105, 105, 255, 180, 180, 180, 255, 255, 255, 255, 255]), 3, 1); GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter; GRAD.needsUpdate = true; }
  return GRAD;
}
// stylised toon material: vertex colours, per-vertex emissive, 3-step light ramp, faint panel-line texture
export function mechMat(o = {}) {
  PANEL = PANEL || (() => { const t = procTex('panel', { color: '#f2f2f2', size: 512 }); return t; })();
  const m = new THREE.MeshToonMaterial({ vertexColors: true, map: o.map === false ? null : (o.map || PANEL), gradientMap: toonGrad() });
  m.userData.uFlash = { value: 0 };
  m.onBeforeCompile = mechCompile;
  return m;
}
// inverted-hull outline: a back-face shell pushed out along normals (works with instancing)
const OL = {};
export function outlineMat(th = 0.05, col = '#1b1626') {
  const k = th + col; if (OL[k]) return OL[k];
  const m = new THREE.MeshBasicMaterial({ color: col, side: THREE.BackSide });
  m.onBeforeCompile = sh => { sh.uniforms.uTh = { value: th }; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTh;').replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normal * uTh;'); };
  m.customProgramCacheKey = () => 'ol' + th;
  return (OL[k] = m);
}
export function addOutline(mesh, th = 0.05, col) {
  const o = mesh.isInstancedMesh ? new THREE.InstancedMesh(mesh.geometry, outlineMat(th, col), mesh.count) : new THREE.Mesh(mesh.geometry, outlineMat(th, col));
  if (mesh.isInstancedMesh) { o.instanceMatrix = mesh.instanceMatrix; o.frustumCulled = false; }
  o.castShadow = false; o.receiveShadow = false; o.raycast = () => {}; mesh.add(o); if (mesh.isInstancedMesh) { o.matrixAutoUpdate = false; } return o;
}

// ------------------------------------------------------------------ geometry builder
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();
export class GB {
  constructor() { this.g = []; }
  push(geo, col, o = {}) {
    geo = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    if (!geo.attributes.normal) geo.computeVertexNormals();
    if (o.uv) { const u = geo.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) * o.uv, u.getY(i) * o.uv); }
    _m.compose(_p.set(o.x || 0, o.y || 0, o.z || 0), _q.setFromEuler(_e.set(o.rx || 0, o.ry || 0, o.rz || 0, o.order || 'XYZ')), _s.set(o.sx || 1, o.sy || 1, o.sz || 1));
    geo.applyMatrix4(_m);
    if (o.m) geo.applyMatrix4(o.m);
    const n = geo.attributes.position.count, ca = new Float32Array(n * 3), ea = new Float32Array(n * 3);
    _c.set(col); for (let i = 0; i < n; i++) { ca[i * 3] = _c.r; ca[i * 3 + 1] = _c.g; ca[i * 3 + 2] = _c.b; }
    if (o.e) { _c.set(o.ec || col).multiplyScalar(o.e); for (let i = 0; i < n; i++) { ea[i * 3] = _c.r; ea[i * 3 + 1] = _c.g; ea[i * 3 + 2] = _c.b; } }
    geo.setAttribute('color', new THREE.BufferAttribute(ca, 3)); geo.setAttribute('emi', new THREE.BufferAttribute(ea, 3));
    geo.clearGroups(); geo.morphAttributes = {};
    this.g.push(geo); return this;
  }
  box(w, h, d, x, y, z, col, o = {}) {
    const r = o.r ?? Math.min(w, h, d) * 0.12;
    const geo = r > 0.01 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, Math.min(w, h, d) / 2 - 0.001)) : new THREE.BoxGeometry(w, h, d);
    return this.push(geo, col, { ...o, x, y, z });
  }
  cyl(rt, rb, h, x, y, z, col, o = {}) { return this.push(new THREE.CylinderGeometry(rt, rb, h, o.seg || 14, 1, !!o.open), col, { ...o, x, y, z }); }
  sph(r, x, y, z, col, o = {}) { return this.push(new THREE.SphereGeometry(r, o.seg || 16, o.seg2 || 10), col, { ...o, x, y, z }); }
  tor(r, t, x, y, z, col, o = {}) { return this.push(new THREE.TorusGeometry(r, t, 6, o.seg || 20), col, { ...o, x, y, z }); }
  geo(g, col, o = {}) { return this.push(g, col, o); }
  get empty() { return !this.g.length; }
  build() { const g = mergeGeometries(this.g, false); this.g.forEach(x => x.dispose()); this.g = []; g.computeBoundingSphere(); return g; }
  mesh(mat, shadow = true) { const m = new THREE.Mesh(this.build(), mat); m.castShadow = shadow; m.receiveShadow = true; return m; }
}

// wedge (prism) helper for angled armour plates
export function wedge(w, h, d, slope = 0.5) {
  const s = new THREE.Shape(); s.moveTo(-d / 2, 0); s.lineTo(d / 2, 0); s.lineTo(d / 2 - d * slope, h); s.lineTo(-d / 2, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1 });
  g.translate(0, 0, -w / 2); g.rotateY(-Math.PI / 2); return g;
}

// ------------------------------------------------------------------ mech rig (player "Halberd" frame + enemy "Raptor" frame)
// Forward is +z. Returns { root, legs:[{thigh,knee,foot}], hips, torso, armL, armR, gun (spinning barrels), tips {gun,rocket,laser}, mat, meshes }
const P = { // palettes
  player: { a: '#f3efe6', b: '#3a4250', c: '#ff7a1a', acc: '#ffd23f', glow: '#2be8ff', glow2: '#ffb02a', glass: '#1f4a6e' },
  raptor: { a: '#8a4dff', b: '#2c2440', c: '#d94cff', acc: '#ffd23f', glow: '#ff2d6a', glow2: '#ff8a1a', glass: '#3a0f30' },
};
export function buildMech(kind = 'player') {
  const c = P[kind], mat = mechMat({ map: false }), meshes = [];
  const root = new THREE.Group(), hips = new THREE.Group(), torso = new THREE.Group();
  const mk = (gb, parent, shadow = true) => { const m = gb.mesh(mat, shadow); parent.add(m); meshes.push(m); addOutline(m, 0.06); return m; };
  const raptor = kind === 'raptor';
  const HIP_Y = raptor ? 3.6 : 3.45;
  hips.position.y = HIP_Y; root.add(hips);
  // pelvis
  let g = new GB();
  g.box(2.3, 0.85, 1.5, 0, 0, 0, c.b, { r: 0.18 });
  g.box(1.3, 0.9, 0.5, 0, -0.25, 0.75, c.a, { r: 0.1, rx: 0.25 });
  g.box(0.12, 0.5, 0.08, 0, -0.2, 1.02, c.glow, { e: 3, r: 0.02 });
  for (const s of [-1, 1]) { g.cyl(0.42, 0.42, 0.4, s * 1.15, 0, 0, c.c, { rz: Math.PI / 2, seg: 18 }); g.cyl(0.2, 0.2, 0.46, s * 1.15, 0, 0, c.glow2, { rz: Math.PI / 2, e: 1.6, seg: 10 }); }
  mk(g, hips);
  // legs
  const legs = [];
  for (const s of [-1, 1]) {
    const thigh = new THREE.Group(), knee = new THREE.Group(), foot = new THREE.Group();
    thigh.position.set(s * 1.38, 0, 0); hips.add(thigh);
    g = new GB();
    if (!raptor) {
      g.box(0.85, 1.85, 1.0, 0, -0.85, 0, c.a, { r: 0.16 });
      g.box(0.95, 1.2, 0.35, 0, -0.75, 0.55, c.c, { r: 0.08, rx: -0.08 });
      g.box(0.3, 0.9, 0.06, 0, -0.75, 0.74, c.acc, { r: 0.02, rx: -0.08 });
      g.cyl(0.11, 0.11, 1.4, s * 0.48, -0.9, -0.2, '#9aa3ad', { metal: 1 });
      g.box(0.6, 0.3, 0.4, 0, -1.6, -0.35, c.b, { r: 0.08 });
      knee.position.set(0, -1.78, 0);
    } else {
      g.box(0.75, 2.2, 0.9, 0, -1.0, 0.25, c.a, { r: 0.15, rx: -0.45 });
      g.box(0.85, 1.2, 0.3, 0, -0.7, 0.75, c.c, { r: 0.06, rx: -0.45 });
      g.cyl(0.1, 0.1, 1.6, s * 0.44, -1.0, 0.0, '#8a8e94', { rx: -0.45 });
      knee.position.set(0, -1.8, 0.95);
    }
    mk(g, thigh); thigh.add(knee);
    g = new GB();
    if (!raptor) {
      g.box(0.95, 0.95, 1.05, 0, 0, 0.08, c.b, { r: 0.3 });
      g.box(0.78, 1.7, 0.85, 0, -0.85, -0.05, c.a, { r: 0.14 });
      g.box(1.0, 1.0, 0.55, 0, -0.45, 0.42, c.c, { r: 0.12, rx: 0.12 });
      g.box(0.5, 0.08, 0.06, 0, -0.1, 0.72, c.glow, { e: 3.5, r: 0.02 });
      g.cyl(0.09, 0.09, 1.3, 0, -0.8, -0.55, '#9aa3ad');
      foot.position.set(0, -1.62, -0.05);
    } else {
      g.sph(0.48, 0, 0, 0, c.b);
      g.box(0.6, 2.1, 0.7, 0, -0.95, -0.55, c.a, { r: 0.12, rx: 0.55 });
      g.box(0.7, 1.0, 0.25, 0, -0.5, -0.05, c.c, { r: 0.06, rx: 0.55 });
      g.box(0.08, 0.6, 0.06, 0, -0.6, 0.12, c.glow, { e: 3.5, r: 0.02, rx: 0.55 });
      foot.position.set(0, -1.75, -1.2);
    }
    mk(g, knee); knee.add(foot);
    g = new GB();
    g.box(1.05, 0.42, 1.9, 0, -0.2, 0.35, c.b, { r: 0.12 });
    g.box(0.95, 0.3, 0.9, 0, 0.08, 0.15, c.c, { r: 0.08 });
    for (const t of [-0.32, 0.32]) g.box(0.36, 0.3, 0.7, t, -0.25, 1.3, c.a, { r: 0.08 });
    g.box(0.5, 0.3, 0.5, 0, -0.25, -0.75, c.a, { r: 0.08 });
    mk(g, foot);
    legs.push({ s, thigh, knee, foot });
  }
  // torso
  torso.position.y = 0.45; hips.add(torso);
  g = new GB();
  if (!raptor) {
    g.box(2.7, 1.9, 2.1, 0, 1.05, 0, c.a, { r: 0.28 });                                    // chest
    g.geo(wedge(2.5, 0.9, 0.9, 0.55), c.c, { x: 0, y: 1.25, z: 1.25 });                     // sloped glacis
    g.box(2.2, 0.75, 0.5, 0, 0.35, 1.05, c.b, { r: 0.12 });                                  // belly
    g.box(1.25, 0.42, 0.25, 0, 0.82, 1.3, c.glass, { r: 0.08 });                             // cockpit glass
    g.box(1.05, 0.08, 0.05, 0, 0.88, 1.44, c.glow, { e: 5, r: 0.02 });                       // visor strip
    for (const s of [-1, 1]) { g.box(0.12, 0.12, 0.05, s * 0.75, 0.62, 1.37, c.glow, { e: 4, r: 0.03 }); g.box(0.5, 0.08, 0.05, s * 0.9, 1.65, 1.08, c.acc, { r: 0.02 }); }
    g.box(0.9, 0.5, 0.8, 0, 2.15, 0.25, c.c, { r: 0.12 });                                   // sensor head
    for (let i = -1; i <= 1; i++) g.sph(0.08, i * 0.24, 2.15, 0.66, c.glow, { e: 6, seg: 8, seg2: 6 });
    g.cyl(0.03, 0.03, 1.4, 0.35, 2.9, -0.1, '#808890'); g.cyl(0.02, 0.02, 0.9, -0.3, 2.7, -0.2, '#808890');
    g.box(2.3, 1.75, 1.0, 0, 1.05, -1.35, c.c, { r: 0.32 });                                 // backpack
    g.box(1.7, 1.15, 0.3, 0, 1.15, -1.9, c.b, { r: 0.12 });
    for (const s of [-1, 1]) { g.cyl(0.44, 0.52, 0.5, s * 0.52, 0.88, -2.05, c.b, { rx: Math.PI / 2, seg: 18 }); g.cyl(0.31, 0.31, 0.53, s * 0.52, 0.88, -2.06, c.glow, { rx: Math.PI / 2, e: 1.6, seg: 16 }); }
    g.box(1.3, 0.16, 0.08, 0, 1.6, -2.07, c.acc, { r: 0.03 }); g.box(0.16, 0.16, 0.08, -0.5, 1.6, -2.08, '#ff3b5c', { r: 0.03, e: 1 }); g.box(0.16, 0.16, 0.08, 0.5, 1.6, -2.08, '#5cf27a', { r: 0.03, e: 1 });
    for (const s of [-1, 1]) { g.cyl(0.2, 0.24, 1.2, s * 0.85, 2.15, -1.45, c.b, { seg: 12 }); g.cyl(0.24, 0.24, 0.16, s * 0.85, 2.72, -1.45, c.c, { seg: 12 }); }
    g.cyl(0.04, 0.04, 1.6, -0.6, 2.6, -0.9, '#e8e8f0', { seg: 5 }); g.sph(0.12, -0.6, 3.42, -0.9, '#ff3b5c', { e: 1.5, seg: 8 });
  } else {
    g.box(2.4, 1.6, 2.6, 0, 0.95, -0.1, c.a, { r: 0.3 });
    g.geo(wedge(2.2, 1.0, 1.6, 0.8), c.c, { x: 0, y: 0.6, z: 1.3 });
    g.box(1.6, 0.35, 0.6, 0, 0.55, 1.75, c.b, { r: 0.1 });
    g.box(1.4, 0.18, 0.06, 0, 1.0, 1.75, c.glow, { e: 6, r: 0.03, rx: -0.6 });
    for (const s of [-1, 1]) g.sph(0.14, s * 0.42, 1.25, 1.55, c.glow, { e: 7, seg: 10 });
    g.box(1.8, 1.1, 1.2, 0, 1.55, -1.25, c.b, { r: 0.15 });
    for (let i = 0; i < 3; i++) g.box(0.9, 0.08, 0.06, 0, 1.25 + i * 0.25, -1.88, c.glow2, { e: 4, r: 0.02 });
    for (const s of [-1, 1]) for (let i = 0; i < 2; i++) g.cyl(0.13, 0.13, 0.6, s * 0.45 + i * 0.25 * s, 2.25, -1.1, c.c, { rx: Math.PI / 2 - 0.4 });
    g.box(0.9, 0.1, 0.06, 0, 1.6, 0.4, c.acc, { r: 0.02 });
  }
  mk(g, torso);
  // shoulders + arms
  const arm = (s) => {
    const sh = new THREE.Group(), elbow = new THREE.Group();
    sh.position.set(s * (raptor ? 1.55 : 1.75), raptor ? 1.15 : 1.55, raptor ? 0.2 : 0); torso.add(sh);
    g = new GB();
    if (!raptor) {
      g.box(1.35, 1.05, 1.7, s * 0.25, 0.2, 0, c.a, { r: 0.22 });
      g.box(1.4, 0.12, 1.75, s * 0.25, -0.1, 0, c.acc, { r: 0.04 });
      g.box(0.65, 1.2, 0.75, s * 0.3, -0.75, 0, c.b, { r: 0.14 });
      g.cyl(0.32, 0.32, 0.5, s * 0.3, -1.35, 0, c.c, { rz: Math.PI / 2 });
      if (s < 0) { // rocket pod
        g.box(1.25, 0.95, 1.55, s * 0.25, 1.15, 0.05, c.c, { r: 0.12 });
        for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { g.cyl(0.15, 0.15, 0.1, s * 0.25 + (i - 1) * 0.36, 0.98 + j * 0.36, 0.84, '#0a0a0c', { rx: Math.PI / 2, seg: 10 }); g.cyl(0.07, 0.07, 0.11, s * 0.25 + (i - 1) * 0.36, 0.98 + j * 0.36, 0.84, c.glow2, { rx: Math.PI / 2, e: 2, seg: 8 }); }
        g.box(0.08, 0.6, 1.3, s * 0.25 + s * 0.66, 1.15, 0.05, c.acc, { r: 0.02 }); for (let k = 0; k < 3; k++) g.box(0.25, 0.7, 0.06, s * 0.25 - 0.4 + k * 0.4, 1.15, -0.74, k % 2 ? c.b : c.acc, { r: 0.02 });
      } else {    // laser lance
        g.cyl(0.26, 0.3, 2.1, s * 0.15, 1.05, 0.35, c.c, { rx: Math.PI / 2 });
        for (let i = 0; i < 5; i++) g.cyl(0.38, 0.38, 0.06, s * 0.15, 1.05, -0.3 + i * 0.2, c.b, { rx: Math.PI / 2 });
        g.cyl(0.18, 0.18, 0.1, s * 0.15, 1.05, 1.42, c.glow, { rx: Math.PI / 2, e: 6 });
        g.box(0.5, 0.35, 0.8, s * 0.15, 0.7, -0.2, c.b, { r: 0.08 });
      }
    } else {
      g.box(1.0, 0.9, 1.3, s * 0.2, 0.0, 0, c.a, { r: 0.2 });
      g.box(0.55, 1.0, 0.6, s * 0.25, -0.6, 0, c.b, { r: 0.12 });
    }
    const shm = mk(g, sh);
    elbow.position.set(s * (raptor ? 0.25 : 0.3), raptor ? -1.1 : -1.35, 0); sh.add(elbow);
    g = new GB();
    const gun = new THREE.Group();
    if (!raptor && s > 0) {   // autocannon forearm
      g.box(0.85, 0.85, 1.9, 0, 0, 0.6, c.b, { r: 0.14 });
      g.box(0.9, 0.35, 1.2, 0, 0.45, 0.5, c.a, { r: 0.1 });
      g.box(0.4, 0.5, 0.6, -0.5, -0.1, 0.4, c.c, { r: 0.08 });
      g.box(0.06, 0.06, 1.0, 0.46, 0.2, 0.6, c.glow, { e: 4, r: 0.02 });
      g.box(0.95, 0.12, 0.3, 0, 0.66, 0.1, c.acc, { r: 0.03 });
      gun.position.set(0, -0.05, 1.6);
      const bg = new GB();
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; bg.cyl(0.075, 0.075, 1.5, Math.cos(a) * 0.19, Math.sin(a) * 0.19, 0.75, '#3a3f46', { rx: Math.PI / 2, seg: 8 }); }
      bg.cyl(0.3, 0.3, 0.2, 0, 0, 0.1, c.c, { rx: Math.PI / 2 }); bg.cyl(0.3, 0.28, 0.25, 0, 0, 1.4, c.b, { rx: Math.PI / 2 });
      bg.cyl(0.07, 0.07, 0.05, 0, 0, 1.53, c.glow2, { rx: Math.PI / 2, e: 2, seg: 8 });
      const bm = bg.mesh(mat); gun.add(bm); meshes.push(bm); addOutline(bm, 0.04);
    } else if (!raptor) {     // left arm: shield fist
      g.box(0.8, 0.8, 1.5, 0, 0, 0.45, c.b, { r: 0.14 });
      g.box(0.25, 1.5, 1.7, -0.5, 0, 0.5, c.a, { r: 0.1 });
      g.box(0.06, 1.2, 0.08, -0.64, 0, 1.25, c.acc, { r: 0.02 });
      for (let i = 0; i < 3; i++) g.box(0.18, 0.3, 0.4, 0.15, -0.15 + i * 0.0, 1.3 + i * 0.0, c.c, { r: 0.05, x: 0 });
      gun.position.set(0, 0, 1.3);
    } else {                  // raptor twin cannons on both arms
      g.box(0.7, 0.7, 1.8, 0, 0, 0.6, c.b, { r: 0.12 });
      g.box(0.75, 0.3, 1.2, 0, 0.42, 0.4, c.a, { r: 0.08 });
      for (const t of [-0.16, 0.16]) g.cyl(0.1, 0.12, 1.4, t, -0.05, 1.9, '#2a2a2e', { rx: Math.PI / 2, seg: 10 });
      g.box(0.08, 0.08, 0.9, s * 0.38, 0.1, 0.6, c.glow, { e: 4, r: 0.02 });
      gun.position.set(0, -0.05, 2.65);
    }
    mk(g, elbow); elbow.add(gun);
    elbow.rotation.x = -Math.PI / 2 + 0.05;
    return { sh, elbow, gun, shm };
  };
  const armL = arm(-1), armR = arm(1);
  // muzzle anchors
  const tips = { gun: new THREE.Object3D(), gun2: new THREE.Object3D(), rocket: new THREE.Object3D(), laser: new THREE.Object3D() };
  armR.gun.add(tips.gun); tips.gun.position.z = raptor ? 0 : 1.6;
  armL.gun.add(tips.gun2);
  armL.sh.add(tips.rocket); tips.rocket.position.set(-0.25, 1.15, 0.9);
  armR.sh.add(tips.laser); tips.laser.position.set(0.15, 1.05, 1.5);
  if (raptor) { torso.add(tips.rocket); tips.rocket.position.set(0, 2.4, -0.9); }
  root.traverse(o => { o.layers.set(0); });
  const M = { root, hips, torso, legs, armL, armR, tips, mat, meshes, HIP_Y, phase: 0, raptor, legYaw: 0, spin: 0, recoil: 0 };
  // walk/idle animation. fwd = forward walk speed (+/-), side = strafe speed, dt seconds. Returns true on a footfall.
  M.animate = (dt, fwd, side, t) => {
    const sp = Math.hypot(fwd, side), amt = Math.min(1, sp / 7);
    const dir = fwd < -0.5 ? -1 : 1;
    const prev = Math.sin(M.phase);
    M.phase += dt * (1.6 + sp * 0.62) * dir * (amt > 0.05 ? 1 : 0);
    const ph = M.phase, foot = Math.sin(ph) * prev < 0 && amt > 0.2;
    for (const L of legs) {
      const p = ph + (L.s > 0 ? 0 : Math.PI), sw = Math.sin(p) * amt, lift = Math.max(0, Math.cos(p)) * amt;
      if (!raptor) {
        L.thigh.rotation.x = -sw * 0.55 - lift * 0.25 - 0.18;
        L.knee.rotation.x = 0.36 + lift * 0.8;
        L.foot.rotation.x = -(L.thigh.rotation.x + L.knee.rotation.x);
      } else {
        L.thigh.rotation.x = -sw * 0.5 - lift * 0.3;
        L.knee.rotation.x = -lift * 0.6;
        L.foot.rotation.x = -(L.thigh.rotation.x + L.knee.rotation.x);
      }
      L.thigh.rotation.z = (side / 9) * 0.18 * Math.sin(p) * amt;
    }
    hips.position.y = M.HIP_Y - Math.abs(Math.cos(ph)) * 0.16 * amt - (1 - amt) * 0.04 * (1 + Math.sin(t * 1.6));
    hips.rotation.z = Math.sin(ph) * 0.04 * amt;
    torso.rotation.z = -hips.rotation.z * 0.7;
    // breathing idle on arms + recoil
    M.recoil = Math.max(0, M.recoil - dt * 8);
    armR.elbow.rotation.x = -Math.PI / 2 + 0.05 + M.recoil * 0.12 + Math.sin(t * 1.3) * 0.015;
    armR.elbow.position.z = -M.recoil * 0.25;
    armL.elbow.rotation.x = -Math.PI / 2 + 0.12 + Math.sin(t * 1.3 + 1) * 0.015;
    return foot;
  };
  M.flash = (v) => { mat.userData.uFlash.value = v; };
  return M;
}

// ------------------------------------------------------------------ drone ("Wasp") single geometry for instancing
export function droneGeo() {
  const g = new GB(), dk = '#3a2c5a', mid = '#9a5cff', red = '#ff2d6a';
  g.sph(0.75, 0, 0, 0, dk, { sy: 0.62, seg: 20, seg2: 12 });
  g.sph(0.62, 0, 0.18, -0.05, mid, { sy: 0.55, seg: 18, seg2: 10 });
  g.box(0.9, 0.12, 0.06, 0, -0.05, 0.68, red, { e: 6, r: 0.02 });
  g.sph(0.2, 0, 0.0, 0.66, red, { e: 9, seg: 12 });
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2, x = Math.cos(a) * 1.15, z = Math.sin(a) * 1.15;
    g.box(1.2, 0.12, 0.2, Math.cos(a) * 0.65, 0.05, Math.sin(a) * 0.65, mid, { ry: -a, r: 0.04 });
    g.tor(0.42, 0.05, x, 0.1, z, dk, { rx: Math.PI / 2, seg: 18 });
    g.cyl(0.08, 0.08, 0.2, x, 0.1, z, mid, { seg: 8 });
    g.box(0.8, 0.02, 0.07, x, 0.16, z, '#7a828e', { ry: i, r: 0 });
    g.sph(0.05, x, -0.05, z, '#ffd23f', { e: 3, seg: 6, seg2: 4 });
  }
  g.cyl(0.02, 0.02, 0.5, 0.25, 0.55, -0.3, '#8a929e', { seg: 5 });
  g.box(0.4, 0.2, 0.5, 0, -0.42, 0.05, dk, { r: 0.05 });
  g.cyl(0.08, 0.06, 0.5, 0, -0.5, 0.4, '#30343a', { rx: Math.PI / 2, seg: 8 });
  return g.build();
}

// ------------------------------------------------------------------ turret ("Bastion")
export function buildTurret() {
  const mat = mechMat({ metal: 0.55, rough: 0.45 }), root = new THREE.Group(), head = new THREE.Group();
  let g = new GB();
  g.box(3.4, 1.0, 3.4, 0, 0.5, 0, '#5a5470', { r: 0.12 });
  for (let i = 0; i < 4; i++) g.box(3.45, 0.18, 0.5, 0, 0.75, -1.2 + i * 0.8, i % 2 ? '#1a1a1a' : '#e0b030', { r: 0.02, sx: 1, sz: 0.25 });
  g.cyl(1.25, 1.45, 1.1, 0, 1.55, 0, '#3a2c5a', { seg: 20 });
  g.tor(1.32, 0.08, 0, 2.05, 0, '#ff3040', { rx: Math.PI / 2, e: 3.5, seg: 28 });
  const base = g.mesh(mat); root.add(base); addOutline(base, 0.07);
  head.position.y = 2.6; root.add(head);
  g = new GB();
  g.box(2.2, 1.25, 2.4, 0, 0, 0, '#8a4dff', { r: 0.25 });
  g.geo(wedge(2.0, 0.6, 1.2, 0.7), '#d94cff', { y: 0.55, z: 0.6 });
  for (const s of [-1, 1]) { g.box(0.5, 1.4, 2.0, s * 1.25, 0, -0.1, '#3a2c5a', { r: 0.12 }); g.cyl(0.16, 0.2, 2.6, s * 0.42, -0.05, 2.2, '#26282c', { rx: Math.PI / 2, seg: 12 }); g.cyl(0.22, 0.22, 0.4, s * 0.42, -0.05, 3.3, '#1a1b1e', { rx: Math.PI / 2, seg: 12 }); }
  g.sph(0.22, 0, 0.25, 1.2, '#ff2a3a', { e: 9, seg: 12 });
  g.box(1.6, 0.08, 0.05, 0, -0.35, 1.21, '#ff6a20', { e: 3, r: 0.02 });
  g.cyl(0.03, 0.03, 0.9, -0.6, 0.95, -0.6, '#8a8a8a', { seg: 5 });
  const hm = g.mesh(mat); head.add(hm); addOutline(hm, 0.07);
  const tip = new THREE.Object3D(); tip.position.set(0, -0.05, 3.5); head.add(tip);
  return { root, head, mat, tip };
}

// ------------------------------------------------------------------ power core (mission 5 objective)
export function buildCore() {
  const mat = mechMat({ metal: 0.5, rough: 0.4 }), root = new THREE.Group();
  let g = new GB();
  g.box(6, 0.8, 6, 0, 0.4, 0, '#5a5470', { r: 0.15 });
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; g.box(0.7, 7, 0.7, Math.cos(a) * 2.2, 4.2, Math.sin(a) * 2.2, '#3a2c5a', { r: 0.12 }); g.box(0.12, 6, 0.08, Math.cos(a) * 1.85, 4.2, Math.sin(a) * 1.85, '#c040ff', { e: 3, r: 0.02, ry: -a }); }
  g.box(5.2, 0.6, 5.2, 0, 7.9, 0, '#8a4dff', { r: 0.12 });
  g.cyl(0.95, 0.95, 6.2, 0, 4.2, 0, '#e080ff', { e: 6, seg: 20 });
  g.cyl(1.2, 1.2, 0.3, 0, 1.2, 0, '#3a3e44', { seg: 20 }); g.cyl(1.2, 1.2, 0.3, 0, 7.3, 0, '#3a3e44', { seg: 20 });
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.cyl(0.12, 0.12, 3.2, Math.cos(a) * 3.4, 0.25, Math.sin(a) * 3.4, '#15161a', { rz: Math.PI / 2, ry: -a, seg: 6 }); }
  const cm = g.mesh(mat); root.add(cm); addOutline(cm, 0.07);
  g = new GB(); g.tor(1.9, 0.12, 0, 0, 0, '#ff60ff', { e: 4, seg: 36, rx: Math.PI / 2 }); g.tor(1.9, 0.12, 0, 0, 0, '#ff60ff', { e: 4, seg: 36 });
  const ring = g.mesh(mat, false); ring.position.y = 4.2; root.add(ring);
  return { root, ring, mat };
}

// ------------------------------------------------------------------ spider-tank boss ("Weaver")
export function buildBoss() {
  const mat = mechMat({ metal: 0.65, rough: 0.35 }), root = new THREE.Group(), body = new THREE.Group(), turret = new THREE.Group();
  root.add(body);
  const A = '#8a4dff', B = '#2c2440', C = '#d94cff', R = '#ff2d6a', O = '#ffb02a';
  let g = new GB();
  g.sph(4.2, 0, 0, 0.5, B, { sx: 1.25, sy: 0.6, sz: 1.35, seg: 28, seg2: 16 });
  for (let i = 0; i < 5; i++) g.box(6.8 - i * 0.6, 0.5, 1.9, 0, 2.15 + Math.sin(i / 4 * Math.PI) * 0.3, -3 + i * 1.6, i % 2 ? A : C, { r: 0.2, rx: 0.05 });
  for (const s of [-1, 1]) { g.box(0.6, 2.0, 8.5, s * 4.8, 0.4, 0.4, A, { r: 0.22, rz: s * 0.25 }); g.box(0.12, 0.25, 7.5, s * 5.12, 0.3, 0.4, R, { e: 3, r: 0.04, rz: s * 0.25 }); }
  g.box(4.6, 1.8, 1.6, 0, 0.2, 5.8, A, { r: 0.35 });
  for (let i = 0; i < 6; i++) g.sph(0.22 + (i < 2 ? 0.1 : 0), (i % 3 - 1) * 0.9, 0.35 + Math.floor(i / 3) * 0.55 - 0.2, 6.6, R, { e: 10, seg: 10 });
  for (const s of [-1, 1]) g.box(0.35, 0.35, 2.2, s * 1.9, -0.6, 7.0, '#9aa0a8', { r: 0.06, ry: s * 0.25 });   // mandibles
  // abdomen + weak core
  g.sph(3.2, 0, 0.6, -6.0, A, { sx: 1.05, sy: 0.8, sz: 1.2, seg: 22, seg2: 14 });
  for (let i = 0; i < 4; i++) g.box(5.4 - i * 0.7, 0.35, 0.9, 0, 2.6 - i * 0.15, -4.4 - i * 1.3, C, { r: 0.12 });
  for (let i = 0; i < 5; i++) g.box(0.18, 1.2, 0.12, (i - 2) * 0.7, 0.6, -9.75, O, { e: 5, r: 0.03 });
  g.sph(1.5, 0, -0.6, -7.6, O, { e: 7, seg: 16 });
  // leg sockets
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) g.sph(0.9, s * 4.6, -0.2, 3.6 - i * 2.4, B, { seg: 12 });
  const bdm = g.mesh(mat); body.add(bdm); addOutline(bdm, 0.12);
  // turret
  turret.position.set(0, 3.0, 1.2); body.add(turret);
  g = new GB();
  g.cyl(2.2, 2.6, 1.2, 0, 0, 0, B, { seg: 24 });
  g.box(3.6, 1.5, 3.6, 0, 1.0, 0, A, { r: 0.4 });
  for (const s of [-1, 1]) { g.cyl(0.32, 0.38, 5.0, s * 0.9, 1.0, 3.4, B, { rx: Math.PI / 2, seg: 14 }); g.cyl(0.45, 0.45, 0.8, s * 0.9, 1.0, 5.8, '#121216', { rx: Math.PI / 2, seg: 14 }); g.cyl(0.18, 0.18, 0.1, s * 0.9, 1.0, 6.22, O, { rx: Math.PI / 2, e: 4 }); }
  g.cyl(0.4, 0.5, 2.4, 0, 2.1, 1.4, C, { rx: Math.PI / 2 }); g.sph(0.3, 0, 2.1, 2.65, R, { e: 9 });
  g.box(2.2, 0.1, 0.06, 0, 1.4, 1.82, R, { e: 4, r: 0.02 });
  const tm = g.mesh(mat); turret.add(tm); addOutline(tm, 0.1);
  // legs: femur + tibia meshes along +z (lookAt-oriented each frame)
  const legs = [];
  const femurG = (() => { const g = new GB(); g.box(0.9, 1.0, 6.4, 0, 0, 3.2, A, { r: 0.3 }); g.box(0.5, 0.25, 5.2, 0, 0.6, 3.2, C, { r: 0.1 }); g.box(0.08, 0.1, 4.6, 0, 0.75, 3.2, R, { e: 3, r: 0.02 }); g.cyl(0.12, 0.12, 5.0, 0.5, -0.3, 3.2, '#9aa0a8', { rx: Math.PI / 2, seg: 6 }); g.sph(0.75, 0, 0, 6.4, B, { seg: 12 }); return g.build(); })();
  const tibiaG = (() => { const g = new GB(); g.box(0.7, 0.8, 7.6, 0, 0, 3.8, B, { r: 0.25 }); g.box(0.85, 0.9, 2.4, 0, 0.1, 1.3, A, { r: 0.25 }); g.cyl(0.08, 0.38, 1.2, 0, 0, 8.0, '#8a9098', { rx: Math.PI / 2, seg: 8 }); g.box(0.06, 0.08, 5, 0, 0.45, 4, O, { e: 3, r: 0.02 }); return g.build(); })();
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
    const f = new THREE.Mesh(femurG, mat), tb = new THREE.Mesh(tibiaG, mat); f.castShadow = tb.castShadow = true; addOutline(f, 0.1); addOutline(tb, 0.1);
    legs.push({ f, t: tb, s, i, rest: new THREE.Vector3(s * (11 + (i === 0 || i === 3 ? -1 : 1)), 0, 6.5 - i * 4.4), foot: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(), k: 1, group: (i + (s > 0 ? 1 : 0)) % 2 });
  }
  const tips = { cannon: [new THREE.Object3D(), new THREE.Object3D()], laser: new THREE.Object3D(), core: new THREE.Object3D() };
  tips.cannon[0].position.set(-0.9, 1.0, 6.3); tips.cannon[1].position.set(0.9, 1.0, 6.3); tips.laser.position.set(0, 2.1, 2.8);
  turret.add(tips.cannon[0], tips.cannon[1], tips.laser); tips.core.position.set(0, -0.6, -7.6); body.add(tips.core);
  return { root, body, turret, legs, mat, tips };
}
