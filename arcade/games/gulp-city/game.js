// Gulp City — original game. Be the hole: glide around a toy city, swallow anything smaller than you, grow, out-eat the rival holes.
import { bake, vcMat } from './merge.js';
import { THREE, createStage, createUI, input, loop, burst, confetti, sfx, tone, buzz, mat, glossy, rounded, store, clamp, lerp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';

import { board } from './kit/board.js';
const WB = board({ game: 'gulp-city', label: 'Levels cleared', limits: { maxRun: 1, maxPerSec: 0.15 }, mode: 'sum' });
const save = store('gulpcity');
const F = flow('gulpcity');
let level = save.get('level', 1), best = save.get('best', 0), score = 0, state = 'ready';
const { scene, camera, renderer, sun, hemi, followLight } = createStage({ fov: 48, shadowSize: 22 });
sun.shadow.camera.far = 90; hemi.intensity = 1.25; sun.intensity = 1.55;
document.body.style.setProperty('--bg1', '#8fd3ff'); document.body.style.setProperty('--bg2', '#d6f0ff'); document.body.style.setProperty('--ui', '#3a7bff');
const ui = createUI({ title: 'GULP<br>CITY', hint: 'Drag to move the hole', hand: '👆' });
ui.levels(level);

const BLK = 14, ST = 4.5, ROUND = 90, MAXH = 4;
let N = 4, M = 0;   // blocks per side, map size

// ---------------------------------------------------------------- ground with holes cut out (fragment discard)
const holeU = { value: Array.from({ length: MAXH }, () => new THREE.Vector4(0, 0, -1, 0)) };
function holeCut(m) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.holes = holeU;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vWP; uniform vec4 holes[${MAXH}];`)
      .replace('void main() {', `void main() {\n for (int i = 0; i < ${MAXH}; i++) { if (holes[i].z > 0.0 && distance(vWP.xz, holes[i].xy) < holes[i].z) discard; }`);
  };
  return m;
}
let groundTex = null;
const groundMat = holeCut(new THREE.MeshStandardMaterial({ roughness: 0.95 }));
const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), groundMat); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const skirt = new THREE.Mesh(new THREE.BoxGeometry(1, 3, 1), [mat('#7ec86a'), mat('#7ec86a'), new THREE.MeshBasicMaterial({ visible: false }), new THREE.MeshBasicMaterial({ visible: false }), mat('#6ab857'), mat('#6ab857')]);
skirt.visible = false;
const decoTrees = new THREE.InstancedMesh(bake([{ geo: new THREE.CylinderGeometry(0.12, 0.12, 1, 6), color: '#9a6b3f', pos: [0, 0.5, 0] }, { geo: new THREE.IcosahedronGeometry(0.75, 0), color: '#4cae4f', pos: [0, 1.45, 0] }, { geo: new THREE.IcosahedronGeometry(0.5, 0), color: '#62c35b', pos: [0.25, 1.95, 0.1] }]), vcMat({ flatShading: true }), 400); decoTrees.castShadow = true; scene.add(decoTrees);
function placeDeco(r) { const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(); let n = 0; for (let i = 0; i < 1200 && n < 400; i++) { const x = -40 + r() * (M + 80), z = -40 + r() * (M + 80); if (x > -1.5 && x < M + 1.5 && z > -1.5 && z < M + 1.5) continue; const s = 1 + r() * 1.4; m4.compose(new THREE.Vector3(x, 0, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6), new THREE.Vector3(s, s, s)); decoTrees.setMatrixAt(n++, m4); } decoTrees.count = n; decoTrees.instanceMatrix.needsUpdate = true; }
const outer = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), holeCut(new THREE.MeshStandardMaterial({ color: '#86cf68', roughness: 1 }))); outer.rotation.x = -Math.PI / 2; outer.position.y = -0.03; outer.receiveShadow = true; scene.add(outer);
scene.fog = new THREE.Fog('#bfe6ff', 70, 160);

function drawCity(r) {
  const PX = 22, S = Math.round(M * PX), c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  const P = (v) => v * PX;
  x.fillStyle = '#596173'; x.fillRect(0, 0, S, S);
  const kinds = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const bx = ST + i * (BLK + ST), bz = ST + j * (BLK + ST), kind = r() < 0.3 ? 'park' : r() < 0.5 ? 'houses' : 'tower';
    kinds.push({ i, j, bx, bz, kind });
    x.fillStyle = '#e4e7ee'; x.fillRect(P(bx - 0.2), P(bz - 0.2), P(BLK + 0.4), P(BLK + 0.4));
    x.fillStyle = '#cfd4de'; for (let k = 0; k < BLK; k += 1.5) { x.fillRect(P(bx + k), P(bz - 0.2), 1, P(1.3)); x.fillRect(P(bx + k), P(bz + BLK - 1.1), 1, P(1.3)); }
    x.fillStyle = kind === 'park' ? '#8fd46c' : kind === 'houses' ? '#a7dd7f' : '#f1e7d6';
    x.beginPath(); x.roundRect(P(bx + 1.2), P(bz + 1.2), P(BLK - 2.4), P(BLK - 2.4), P(1)); x.fill();
    if (kind === 'park') { x.fillStyle = '#e9dcc0'; x.fillRect(P(bx + BLK / 2 - 0.8), P(bz + 1.2), P(1.6), P(BLK - 2.4)); x.fillRect(P(bx + 1.2), P(bz + BLK / 2 - 0.8), P(BLK - 2.4), P(1.6)); x.fillStyle = '#7fd0ff'; x.beginPath(); x.arc(P(bx + BLK / 2), P(bz + BLK / 2), P(1.8), 0, 7); x.fill(); }
    if (kind === 'tower') { x.fillStyle = '#ddd1bc'; for (let a = 0; a < BLK - 2.4; a += 2) for (let b = 0; b < BLK - 2.4; b += 2) if ((a + b) % 4 === 0) x.fillRect(P(bx + 1.2 + a), P(bz + 1.2 + b), P(2), P(2)); }
  }
  // lane dashes + crosswalks
  x.fillStyle = 'rgba(255,255,255,.85)';
  for (let k = 0; k <= N; k++) { const s = k * (BLK + ST) + ST / 2; for (let t = 0; t < M; t += 3) { x.fillRect(P(s - 0.08), P(t), P(0.16), P(1.5)); x.fillRect(P(t), P(s - 0.08), P(1.5), P(0.16)); } }
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) { const cx = i * (BLK + ST), cz = j * (BLK + ST);
    for (let t = 0; t < ST; t += 0.8) { x.fillRect(P(cx + t + 0.1), P(cz + ST + 0.2), P(0.45), P(1.2)); x.fillRect(P(cx + ST + 0.2), P(cz + t + 0.1), P(1.2), P(0.45)); } }
  if (groundTex) groundTex.dispose();
  groundTex = new THREE.CanvasTexture(c); groundTex.colorSpace = THREE.SRGBColorSpace; groundTex.anisotropy = 8; groundMat.map = groundTex; groundMat.needsUpdate = true;
  return kinds;
}

// ---------------------------------------------------------------- prop types (instanced, baked vertex colours; white parts take the instance tint)
const G = { box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 14), sph: new THREE.SphereGeometry(1, 12, 9), cone: new THREE.ConeGeometry(1, 1, 14), ico: new THREE.IcosahedronGeometry(1, 0), cap: new THREE.CapsuleGeometry(1, 1, 4, 8) };
const winBands = (w, h, d, floors, col) => { const out = []; for (let f = 0; f < floors; f++) { const y = (f + 0.55) / floors * h; out.push({ geo: G.box, color: col, pos: [0, y, d / 2 + 0.01], scl: [w * 0.82, h / floors * 0.45, 0.04] }, { geo: G.box, color: col, pos: [0, y, -d / 2 - 0.01], scl: [w * 0.82, h / floors * 0.45, 0.04] }, { geo: G.box, color: col, pos: [w / 2 + 0.01, y, 0], scl: [0.04, h / floors * 0.45, d * 0.82] }, { geo: G.box, color: col, pos: [-w / 2 - 0.01, y, 0], scl: [0.04, h / floors * 0.45, d * 0.82] }); } return out; };
const TYPES = {
  person: { size: 0.28, value: 1, max: 260, geo: bake([{ geo: G.cap, color: '#ffffff', pos: [0, 0.55, 0], scl: [0.17, 0.3, 0.14] }, { geo: G.sph, color: '#ffd7ba', pos: [0, 0.98, 0], scl: 0.15 }, { geo: G.cap, color: '#3b4058', pos: [-0.07, 0.2, 0], scl: [0.06, 0.18, 0.06] }, { geo: G.cap, color: '#3b4058', pos: [0.07, 0.2, 0], scl: [0.06, 0.18, 0.06] }]),
    tints: ['#ff5d8f', '#3a86ff', '#ffd23f', '#3ab795', '#ff8c42', '#7b5cff', '#ffffff'] },
  cone: { size: 0.22, value: 1, max: 80, geo: bake([{ geo: G.box, color: '#ff7a1a', pos: [0, 0.03, 0], scl: [0.36, 0.06, 0.36] }, { geo: G.cone, color: '#ff7a1a', pos: [0, 0.32, 0], scl: [0.15, 0.55, 0.15] }, { geo: G.cyl, color: '#ffffff', pos: [0, 0.3, 0], scl: [0.11, 0.08, 0.11] }]) },
  hydrant: { size: 0.22, value: 1, max: 40, geo: bake([{ geo: G.cyl, color: '#ff3b3b', pos: [0, 0.25, 0], scl: [0.13, 0.5, 0.13] }, { geo: G.sph, color: '#ff3b3b', pos: [0, 0.5, 0], scl: 0.13 }, { geo: G.cyl, color: '#d62f2f', pos: [0, 0.32, 0], rot: [0, 0, Math.PI / 2], scl: [0.06, 0.38, 0.06] }]) },
  bin: { size: 0.3, value: 2, max: 50, geo: bake([{ geo: G.cyl, color: '#3ab06a', pos: [0, 0.32, 0], scl: [0.24, 0.64, 0.24] }, { geo: G.cyl, color: '#2d8c54', pos: [0, 0.66, 0], scl: [0.27, 0.06, 0.27] }]) },
  bench: { size: 0.55, value: 2, max: 50, geo: bake([{ geo: G.box, color: '#c98d55', pos: [0, 0.42, 0], scl: [1.2, 0.07, 0.42] }, { geo: G.box, color: '#c98d55', pos: [0, 0.72, -0.2], scl: [1.2, 0.3, 0.06] }, { geo: G.box, color: '#555a66', pos: [-0.5, 0.2, 0], scl: [0.07, 0.42, 0.4] }, { geo: G.box, color: '#555a66', pos: [0.5, 0.2, 0], scl: [0.07, 0.42, 0.4] }]) },
  lamp: { size: 0.32, value: 2, max: 70, geo: bake([{ geo: G.cyl, color: '#4a5068', pos: [0, 1.3, 0], scl: [0.06, 2.6, 0.06] }, { geo: G.cyl, color: '#4a5068', pos: [0, 0.08, 0], scl: [0.16, 0.16, 0.16] }, { geo: G.box, color: '#4a5068', pos: [0.25, 2.6, 0], scl: [0.55, 0.06, 0.08] }, { geo: G.sph, color: '#fff3b0', pos: [0.48, 2.5, 0], scl: [0.14, 0.1, 0.14] }]) },
  tree: { size: 0.6, value: 3, max: 120, geo: bake([{ geo: G.cyl, color: '#9a6b3f', pos: [0, 0.5, 0], scl: [0.12, 1.0, 0.12] }, { geo: G.ico, color: '#4cae4f', pos: [0, 1.45, 0], scl: 0.75 }, { geo: G.ico, color: '#62c35b', pos: [0.25, 1.95, 0.1], scl: 0.5 }]), flat: true },
  car: { size: 1.0, value: 6, max: 50, geo: bake([{ geo: rounded(1.0, 0.5, 2.0, 0.18), color: '#ffffff', pos: [0, 0.45, 0] }, { geo: rounded(0.86, 0.42, 1.1, 0.16), color: '#ffffff', pos: [0, 0.82, -0.1] }, { geo: G.box, color: '#2b3550', pos: [0, 0.84, -0.1], scl: [0.88, 0.28, 1.0] },
    ...[[-0.5, 0.65], [0.5, 0.65], [-0.5, -0.65], [0.5, -0.65]].map(([a, b]) => ({ geo: G.cyl, color: '#22252e', pos: [a, 0.24, b], rot: [0, 0, Math.PI / 2], scl: [0.22, 0.14, 0.22] }))]),
    tints: ['#ff4d4d', '#3a86ff', '#ffd23f', '#ffffff', '#3ab795', '#ff8c42', '#9b6bff'] },
  bus: { size: 1.6, value: 14, max: 10, geo: bake([{ geo: rounded(1.2, 1.3, 4.0, 0.22), color: '#ffffff', pos: [0, 0.95, 0] }, { geo: G.box, color: '#2b3550', pos: [0, 1.25, 0], scl: [1.23, 0.45, 3.6] },
    ...[[-0.6, 1.3], [0.6, 1.3], [-0.6, -1.3], [0.6, -1.3]].map(([a, b]) => ({ geo: G.cyl, color: '#22252e', pos: [a, 0.3, b], rot: [0, 0, Math.PI / 2], scl: [0.3, 0.16, 0.3] }))]), tints: ['#ffc23a', '#ff5d5d'] },
  house: { size: 1.7, value: 18, max: 40, geo: bake([{ geo: G.box, color: '#ffffff', pos: [0, 0.9, 0], scl: [2.4, 1.8, 2.2] }, { geo: new THREE.ConeGeometry(1, 1, 4), color: '#e8665a', pos: [0, 2.3, 0], rot: [0, Math.PI / 4, 0], scl: [1.75, 1.0, 1.65] },
    { geo: G.box, color: '#7a5038', pos: [0, 0.5, 1.11], scl: [0.5, 0.9, 0.04] }, { geo: G.box, color: '#a8dcff', pos: [-0.7, 1.15, 1.11], scl: [0.45, 0.45, 0.04] }, { geo: G.box, color: '#a8dcff', pos: [0.7, 1.15, 1.11], scl: [0.45, 0.45, 0.04] }]), tints: ['#fff3e0', '#ffe0e6', '#e3f1ff', '#fff8c9'] },
  shop: { size: 2.6, value: 34, max: 30, geo: bake([{ geo: G.box, color: '#ffffff', pos: [0, 2.2, 0], scl: [3.6, 4.4, 3.6] }, ...winBands(3.6, 4.4, 3.6, 3, '#5a7fb8'), { geo: G.box, color: '#ff5d8f', pos: [0, 0.9, 1.85], scl: [3.0, 0.25, 0.3] }, { geo: G.box, color: '#e0e4ea', pos: [0, 4.5, 0], scl: [3.7, 0.2, 3.7] }]), tints: ['#ffe9c7', '#d8ecff', '#ffd9d0'] },
  tower: { size: 3.5, value: 70, max: 24, geo: bake([{ geo: G.box, color: '#ffffff', pos: [0, 5, 0], scl: [4.6, 10, 4.6] }, ...winBands(4.6, 10, 4.6, 7, '#4b6fa8'), { geo: G.box, color: '#e0e4ea', pos: [0, 10.15, 0], scl: [4.8, 0.3, 4.8] }, { geo: G.box, color: '#c4ccd8', pos: [1, 10.7, 0.8], scl: [1.2, 0.9, 1.2] }]), tints: ['#9fc6ff', '#ffd2a6', '#c6f0e0', '#e9d6ff', '#ffffff'] },
};
for (const [k, T] of Object.entries(TYPES)) {
  T.mesh = new THREE.InstancedMesh(T.geo, vcMat({ roughness: 0.55, flatShading: !!T.flat }), T.max); T.mesh.castShadow = true; T.mesh.receiveShadow = k === 'tower' || k === 'shop'; T.mesh.frustumCulled = false; scene.add(T.mesh);
  T.mesh.setColorAt(0, new THREE.Color('#ffffff')); T.name = k;
}
let props = [];
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), V = new THREE.Vector3(), SC = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
function addProp(type, x, z, rot, r, scale = 1) {
  const T = TYPES[type]; if (T.count >= T.max) return null;
  const p = { T, i: T.count++, x, z, y: 0, rot, s: scale, size: T.size * scale, value: Math.round(T.value * scale * scale) || 1, state: 0, vx: 0, vy: 0, vz: 0, tilt: 0, tax: new THREE.Vector3(1, 0, 0), hole: null, walk: r ? r() * 6 : 0, home: [x, z] };
  if (T.tints) T.mesh.setColorAt(p.i, col.set(T.tints[Math.floor((r ? r() : Math.random()) * T.tints.length)])); else T.mesh.setColorAt(p.i, col.set('#ffffff'));
  props.push(p); writeProp(p); return p;
}
function writeProp(p) {
  Q.setFromAxisAngle(UP, p.rot); if (p.tilt) Q.premultiply(Q2.setFromAxisAngle(p.tax, p.tilt));
  M4.compose(V.set(p.x, p.y, p.z), Q, SC.setScalar(p.state === 2 ? 0 : p.s)); p.T.mesh.setMatrixAt(p.i, M4); p.T.dirty = true;
}

// ---------------------------------------------------------------- holes
const HCOL = ['#3a7bff', '#ff4d6d', '#ffb000', '#2ec27e'], HNAMES = ['You', 'Gobbler', 'Muncher', 'Chomp'];
const interiorGeo = new THREE.CylinderGeometry(1, 1, 1, 48, 1, true); interiorGeo.translate(0, -0.5, 0);
{ const p = interiorGeo.attributes.position, c = []; for (let i = 0; i < p.count; i++) { const t = -p.getY(i); const k = 0.16 * (1 - t); c.push(k * 0.5, k * 0.6, k + 0.04); } interiorGeo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); }
function makeHole(id) {
  const g = new THREE.Group();
  const well = new THREE.Mesh(interiorGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })); g.add(well);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: '#03040a' })); bottom.rotation.x = -Math.PI / 2; g.add(bottom);
  const rim = new THREE.Mesh(new THREE.RingGeometry(1, 1.12, 64), new THREE.MeshBasicMaterial({ color: HCOL[id], transparent: true, opacity: 0.95 })); rim.rotation.x = -Math.PI / 2; rim.position.y = 0.03; g.add(rim);
  const c = document.createElement('canvas'); c.width = 256; c.height = 72; const x = c.getContext('2d');
  x.font = '800 46px "Baloo 2", system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 10; x.strokeStyle = 'rgba(20,20,50,.5)'; x.strokeText(HNAMES[id], 128, 38); x.fillStyle = '#fff'; x.fillText(HNAMES[id], 128, 38);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false })); tag.renderOrder = 10; scene.add(tag);
  scene.add(g);
  return { id, g, well, bottom, rim, tag, x: 0, z: 0, r: 0.8, rv: 0.8, eaten: 0, vx: 0, vz: 0, dead: false, isP: id === 0, ai: { t: 0, tx: 0, tz: 0 }, punch: 0, combo: 0, comboT: 0 };
}
const holes = [0, 1, 2, 3].map(makeHole);
const radiusFor = (e) => 0.75 + 0.5 * Math.sqrt(e / 3.2);
function placeHole(h) { h.well.scale.set(h.r, 4 + h.r * 2.5, h.r); h.bottom.scale.setScalar(h.r); h.bottom.position.y = -(4 + h.r * 2.5) + 0.01; h.rim.scale.setScalar(h.r * (1 + h.punch * 0.12)); h.g.position.set(h.x, 0, h.z); h.tag.position.set(h.x, 1.2 + h.r * 0.3, h.z - h.r - 0.4); h.tag.scale.set(2.4, 0.68, 1); }

// ---------------------------------------------------------------- level build
let goal = 60, timeLeft = ROUND, cars = [], people = [];
function buildLevel() {
  const r = rng(level * 6151 + 11), fk = F.k();
  N = Math.min(6, 3 + Math.floor((level + 1) / 2)); M = N * (BLK + ST) + ST;
  for (const T of Object.values(TYPES)) T.count = 0;
  props = []; cars = []; people = [];
  const kinds = drawCity(r); placeDeco(r);
  ground.scale.set(M, M, 1); ground.position.set(M / 2, 0, M / 2); groundTex.repeat.set(1, 1);
  skirt.scale.set(M + 0.2, 1, M + 0.2); skirt.position.set(M / 2, -1.51, M / 2);
  for (const b of kinds) {
    const { bx, bz, kind } = b, cx = bx + BLK / 2, cz = bz + BLK / 2;
    // sidewalk furniture all around the block
    for (let k = 1; k < BLK; k += 2.2) for (const [x, z, ro] of [[bx + k, bz + 0.5, 0], [bx + k, bz + BLK - 0.5, Math.PI], [bx + 0.5, bz + k, Math.PI / 2], [bx + BLK - 0.5, bz + k, -Math.PI / 2]]) {
      const q = r(); if (q < 0.16) addProp('lamp', x, z, ro + Math.PI / 2, r); else if (q < 0.27) addProp('cone', x, z, r() * 6, r); else if (q < 0.34) addProp('hydrant', x, z, 0, r); else if (q < 0.43) addProp('bin', x, z, 0, r);
      else if (q < 0.75) { const p = addProp('person', x + (r() - 0.5) * 0.6, z + (r() - 0.5) * 0.6, r() * 6, r); if (p) people.push(p); }
    }
    if (kind === 'park') {
      for (let k = 0; k < 9; k++) { const a = r() * 6.28, d = 3.2 + r() * 2.8; addProp('tree', cx + Math.cos(a) * d, cz + Math.sin(a) * d, r() * 6, r, 0.8 + r() * 0.5); }
      for (const [dx, dz, ro] of [[-2.6, 0, Math.PI / 2], [2.6, 0, -Math.PI / 2], [0, -2.6, 0], [0, 2.6, Math.PI]]) addProp('bench', cx + dx, cz + dz, ro, r);
      for (let k = 0; k < 10; k++) { const p = addProp('person', cx + (r() - 0.5) * 9, cz + (r() - 0.5) * 9, r() * 6, r); if (p) people.push(p); }
    } else if (kind === 'houses') {
      for (const [dx, dz] of [[-3.3, -3.3], [3.3, -3.3], [-3.3, 3.3], [3.3, 3.3]]) addProp('house', cx + dx, cz + dz, Math.floor(r() * 4) * Math.PI / 2, r, 0.9 + r() * 0.25);
      for (let k = 0; k < 4; k++) addProp('tree', cx + (r() - 0.5) * 2, cz + (r() - 0.5) * 9, 0, r, 0.7);
    } else {
      if (r() < 0.5) addProp('tower', cx, cz, 0, r, 1.0 + r() * 0.2);
      else for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) addProp(r() < 0.75 ? 'shop' : 'house', cx + dx, cz + dz, Math.floor(r() * 4) * Math.PI / 2, r, 0.85 + r() * 0.15);
      for (let k = 0; k < 3; k++) { const p = addProp('person', cx + (r() - 0.5) * 11, cz + (r() - 0.5) * 11, r() * 6, r); if (p) people.push(p); }
    }
  }
  // traffic on the streets (lanes along x and z)
  for (let k = 0; k <= N; k++) for (const axis of [0, 1]) {
    const s = k * (BLK + ST) + ST / 2;
    for (let n = 0; n < 2; n++) if (r() < 0.75) { const dir = n ? 1 : -1, lanePos = s + dir * 1.1, t = r() * M;
      const type = r() < 0.12 && TYPES.bus.count < TYPES.bus.max ? 'bus' : 'car';
      const p = addProp(type, axis ? lanePos : t, axis ? t : lanePos, axis ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2), r);
      if (p) { p.axis = axis; p.dir = dir; p.spd = 2.2 + r() * 1.5; cars.push(p); } }
  }
  for (const T of Object.values(TYPES)) { T.mesh.count = T.count; T.mesh.instanceMatrix.needsUpdate = true; if (T.mesh.instanceColor) T.mesh.instanceColor.needsUpdate = true; }
  // holes start in different street intersections
  const spots = [[1, 1], [N - 1, N - 1], [N - 1, 1], [1, N - 1]].map(([i, j]) => [i * (BLK + ST) + ST / 2, j * (BLK + ST) + ST / 2]);
  holes.forEach((h, k) => { h.x = spots[k][0]; h.z = spots[k][1]; h.eaten = 0; h.r = h.rv = radiusFor(0); h.dead = false; h.g.visible = h.tag.visible = true; h.vx = h.vz = 0; h.punch = 0; h.ai.t = 0; h.skill = k ? Math.min(1.25, (0.6 + Math.min(level, 10) * 0.04 + k * 0.03) * fk) : 1; placeHole(h); });
  goal = Math.round((230 + (level - 1) * 95 * (1 + level * 0.06)) * fk);   // ~35-50 s for a good player on level 1
  timeLeft = ROUND;
  ui.levels(level); ui.progress(0); ui.score(0); ui.sub(`Grow to ${goal} · or be biggest at the end`); ui.pill('1:30');
  camPos.set(holes[0].x, 14, holes[0].z + 10);
}

// ---------------------------------------------------------------- input (relative drag = joystick)
let joy = null, botOn = false, mvx = 0, mvz = 0;
input({
  onDown: (e) => { botOn = false; joy = { x: e.clientX, y: e.clientY, cx: e.clientX, cy: e.clientY }; },
  onMove: (dx, dy, e) => { if (!joy) return; joy.cx = e.clientX; joy.cy = e.clientY; const vx = joy.cx - joy.x, vy = joy.cy - joy.y, d = Math.hypot(vx, vy); if (d > 70) { joy.x = joy.cx - vx / d * 70; joy.y = joy.cy - vy / d * 70; } },
  onUp: () => { joy = null; },
});
ui.onTap(w => { WB.start();
  if (w === 'start') { state = 'play'; sfx.tap(); }
  else if (w === 'win') { level++; save.set('level', level); buildLevel(); state = 'play'; }
  else if (w === 'lose') { score = 0; buildLevel(); state = 'play'; }
});

// ---------------------------------------------------------------- eating physics
function hUpdate(h, sec) {
  // swallow props that fit
  for (const p of props) {
    if (p.state === 2) continue;
    if (p.state === 1) continue;
    const dx = p.x - h.x, dz = p.z - h.z, d2 = dx * dx + dz * dz, reach = h.r + p.size;
    if (d2 > reach * reach) continue;
    const d = Math.sqrt(d2);
    if (p.size < h.r * 0.92 && d < h.r - p.size * 0.15) {           // over the hole: start falling in
      p.state = 1; p.hole = h; p.vy = 0; p.vx = 0; p.vz = 0; p.tax.set(dz, 0, -dx).normalize(); if (!isFinite(p.tax.x)) p.tax.set(1, 0, 0);
    } else if (p.size < h.r * 0.92) {                                  // on the rim: lean toward the hole
      p.tilt = Math.min(0.5, (reach - d) / reach * 0.9); p.tax.set(dz, 0, -dx).normalize(); writeProp(p); p.leanT = 0.25;
    } else if (h.isP && d < h.r && !p.bonk) { p.bonk = 0.3; }           // too big: a little shudder
  }
}
function propsUpdate(sec, t) {
  for (const p of props) {
    if (p.state === 2) continue;
    if (p.state === 1) {
      const h = p.hole; const dx = h.x - p.x, dz = h.z - p.z, d = Math.hypot(dx, dz);
      p.vx += dx * 7 * sec; p.vz += dz * 7 * sec; p.vx *= 0.9; p.vz *= 0.9; p.vy -= 26 * sec;
      p.x += p.vx * sec; p.z += p.vz * sec; p.y += p.vy * sec; p.tilt = Math.min(1.5, p.tilt + 3.2 * sec);
      // keep inside the well once below the surface
      if (p.y < -0.2) { const lim = Math.max(0.05, h.r - p.size * 0.7), dd = Math.hypot(p.x - h.x, p.z - h.z); if (dd > lim) { p.x = h.x + (p.x - h.x) / dd * lim; p.z = h.z + (p.z - h.z) / dd * lim; } }
      if (p.y < -(3 + p.size * 3)) { p.state = 2; eat(h, p); }
      writeProp(p); continue;
    }
    if (p.leanT > 0) { p.leanT -= sec; if (p.leanT <= 0) { p.tilt = 0; writeProp(p); } }
    if (p.bonk > 0) { p.bonk -= sec; p.tilt = Math.sin(p.bonk * 40) * 0.04; p.tax.set(1, 0, 0); writeProp(p); if (p.bonk <= 0) { p.tilt = 0; writeProp(p); } }
  }
  // traffic
  for (const c of cars) { if (c.state) continue; if (c.axis) { c.z += c.dir * c.spd * sec; if (c.z > M) c.z -= M; if (c.z < 0) c.z += M; } else { c.x += c.dir * c.spd * sec; if (c.x > M) c.x -= M; if (c.x < 0) c.x += M; } if (!c.tilt) writeProp(c); }
  // people mill about (and run from big holes)
  for (const p of people) {
    if (p.state) continue; p.walk += sec;
    let fx = Math.sin(p.walk * 0.7) * 0.25, fz = Math.cos(p.walk * 0.5) * 0.25;
    for (const h of holes) { if (h.dead) continue; const dx = p.x - h.x, dz = p.z - h.z, d = Math.hypot(dx, dz); if (d < h.r + 2.5) { fx += dx / d * 1.6; fz += dz / d * 1.6; } }
    p.x = clamp(p.x + fx * sec, 0.5, M - 0.5); p.z = clamp(p.z + fz * sec, 0.5, M - 0.5); p.rot = Math.atan2(fx, fz); p.y = Math.abs(Math.sin(p.walk * 9)) * 0.06;
    if (!p.tilt) writeProp(p);
  }
}
function eat(h, p) {
  h.eaten += p.value; h.punch = 1;
  if (h.isP) {
    score += p.value; h.combo++; h.comboT = 0.6;
    const big = p.value >= 14;
    tone(320 + Math.min(900, h.combo * 35), big ? 0.18 : 0.06, big ? 'square' : 'triangle', big ? 0.1 : 0.07, big ? 0.5 : 1.3);
    if (big) { buzz(30); shake = Math.min(1.2, 0.3 + p.value / 60); ui.pop('+' + p.value, '#ff4d6d', 40 + Math.min(20, p.value / 3), 26); burst(scene, new THREE.Vector3(h.x, 0.4, h.z), ['#ffffff', '#ffd23f', HCOL[0]], 18, { speed: 0.18, up: 0.18, size: 1 }); }
    else buzz(6);
    if (h.combo === 10 || h.combo === 25 || h.combo === 50) ui.pop(h.combo + ' COMBO!', '#ff5d8f', 38, 30);
  }
}
function holeVsHole(sec) {
  for (const a of holes) for (const b of holes) {
    if (a === b || a.dead || b.dead || a.r < b.r * 1.2) continue;
    const d = Math.hypot(a.x - b.x, a.z - b.z);
    if (d < a.r - b.r * 0.3) {
      b.dead = true; b.g.visible = b.tag.visible = false; a.eaten += Math.round(b.eaten * 0.5) + 10; a.punch = 1;
      burst(scene, new THREE.Vector3(b.x, 0.4, b.z), [HCOL[b.id], '#ffffff', '#222'], 30, { speed: 0.22, up: 0.2, size: 1.2 });
      if (b.isP) { state = 'lost'; F.level(false, clamp(b.eaten / goal, 0, 1)); sfx.fail(); buzz([60, 40, 80]); ui.flash(0.6); ui.lose('GULPED!', `${HNAMES[a.id]} swallowed you`); }
      else if (a.isP) { score += 50; ui.pop('ATE ' + HNAMES[b.id].toUpperCase() + '!', '#ff4d6d', 40, 26); sfx.smash(); buzz([40, 30, 60]); shake = 1; }
      else b.respawn = 4;
    }
  }
}

// ---------------------------------------------------------------- AI (bots + QA bot)
function aiSteer(h, sec) {
  h.ai.t -= sec;
  if (h.ai.t <= 0) {
    h.ai.t = 0.4 + Math.random() * 0.3;
    let best = null, bs = -1; const cand = [];
    for (const p of props) { if (p.state || p.size >= h.r * 0.9) continue; const d = Math.hypot(p.x - h.x, p.z - h.z); if (d > 24) continue; cand.push([p, d]); }
    cand.sort((a, b) => a[1] - b[1]);
    for (const [p, d] of cand.slice(0, 70)) {      // value of everything edible around the candidate (clusters beat singles)
      let v = 0; for (const [q] of cand) { const e = Math.hypot(q.x - p.x, q.z - p.z); if (e < h.r + 1.5) v += q.value; }
      const s = v / (d + 3); if (s > bs) { bs = s; best = p; } }
    // cluster bonus: look a bit beyond the best target toward its neighbours
    let tx = best ? best.x : M / 2, tz = best ? best.z : M / 2;
    for (const o of holes) { if (o === h || o.dead) continue; const d = Math.hypot(o.x - h.x, o.z - h.z);
      if (o.r > h.r * 1.15 && d < o.r * 2 + 6) { tx = h.x + (h.x - o.x) * 2; tz = h.z + (h.z - o.z) * 2; break; }     // flee
      if (!h.isP && h.r > o.r * 1.3 && d < 10) { tx = o.x; tz = o.z; } }                                               // hunt
    h.ai.tx = clamp(tx, 1, M - 1); h.ai.tz = clamp(tz, 1, M - 1);
  }
  const dx = h.ai.tx - h.x, dz = h.ai.tz - h.z, d = Math.hypot(dx, dz) || 1;
  return [dx / d * Math.min(1, d / 1.2), dz / d * Math.min(1, d / 1.2)];
}

// ---------------------------------------------------------------- loop
const camPos = new THREE.Vector3(); let shake = 0, fpsN = 0, fpsT = 0, fps = 0;
loop((dt, t) => {
  fpsN++; if (t - fpsT > 1) { fps = fpsN / (t - fpsT); fpsN = 0; fpsT = t; }
  const sec = Math.min(dt / 60, 1 / 25), me = holes[0];
  if (state === 'play') {
    timeLeft -= sec;
    for (const h of holes) {
      if (h.dead) { if (h.respawn !== undefined && (h.respawn -= sec) <= 0 && !h.isP) { h.dead = false; h.respawn = undefined; h.eaten = Math.round(h.eaten * 0.3); h.r = radiusFor(h.eaten); h.x = 2 + Math.random() * (M - 4); h.z = 2 + Math.random() * (M - 4); h.g.visible = h.tag.visible = true; } continue; }
      let ix = 0, iz = 0;
      if (h.isP) { if (joy) { const vx = joy.cx - joy.x, vy = joy.cy - joy.y, d = Math.hypot(vx, vy); if (d > 6) { ix = vx / 70; iz = vy / 70; } } else if (botOn) [ix, iz] = aiSteer(h, sec); }
      else { [ix, iz] = aiSteer(h, sec); ix *= h.skill; iz *= h.skill; }
      const sp = 6.2 + h.r * 0.55;
      h.vx = lerp(h.vx, ix * sp, 0.2); h.vz = lerp(h.vz, iz * sp, 0.2);
      h.x = clamp(h.x + h.vx * sec, h.r * 0.6, M - h.r * 0.6); h.z = clamp(h.z + h.vz * sec, h.r * 0.6, M - h.r * 0.6);
      h.r = lerp(h.r, radiusFor(h.eaten), 0.06); h.punch = Math.max(0, h.punch - sec * 5);
      if ((h.comboT -= sec) <= 0) h.combo = 0;
      hUpdate(h, sec);
    }
    holeVsHole(sec);
    if (state === 'play') {
      ui.score(me.eaten); ui.progress(me.eaten / goal);
      const rank = 1 + holes.filter(h => h !== me && !h.dead && h.eaten > me.eaten).length;
      const tl = Math.max(0, Math.ceil(timeLeft)); ui.pill(`${Math.floor(tl / 60)}:${String(tl % 60).padStart(2, '0')}`);
      if (Math.floor(t * 2) % 2 === 0) ui.sub(`Rank #${rank} · goal ${goal}`);
      if (me.eaten >= goal) winNow('BIG ENOUGH!', `Size ${me.eaten} in ${Math.round(ROUND - timeLeft)}s`);
      else if (timeLeft <= 0) { if (rank === 1) winNow('BIGGEST HOLE!', `Rank #1 with ${me.eaten}`); else { state = 'lost'; F.level(false, clamp(me.eaten / goal, 0, 1)); sfx.fail(); ui.lose('TIME UP!', `Rank #${rank} — be #1 or hit ${goal}`); } }
    }
  }
  propsUpdate(state === 'play' ? sec : sec * 0.6, t);
  for (const T of Object.values(TYPES)) if (T.dirty) { T.mesh.instanceMatrix.needsUpdate = true; T.dirty = false; }
  holes.forEach((h, k) => { placeHole(h); holeU.value[k].set(h.x, h.z, h.dead ? -1 : h.r * 0.995, 0); });
  // camera: high 3/4 view, pulls back as the hole grows
  const z = 12.5 + me.r * 3.4;
  const fx = clamp(me.x, Math.min(M / 2, 9), Math.max(M / 2, M - 9)), fz = clamp(me.z, Math.min(M / 2, 15), Math.max(M / 2, M - 4));
  camPos.lerp(new THREE.Vector3(fx, z * 1.45, fz + z * 0.72), 0.08);
  camera.position.copy(camPos); if (shake > 0.01) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; shake *= 0.88; }
  camera.lookAt(camPos.x, 0, camPos.z - z * 0.72 - 1.5);
  followLight(new THREE.Vector3(me.x, 0, me.z - 2));
});
function winNow(t, line) {
  state = 'won'; F.level(true); WB.submit(1); score += 100 + level * 20; best = Math.max(best, score); save.set('best', best);
  sfx.win(); buzz([20, 40, 20]); ui.flash(0.6); confetti(scene, new THREE.Vector3(holes[0].x, 2, holes[0].z), 100);
  ui.pop(t, '#ff4d6d', 46, 26); ui.win(level, line);
}

buildLevel();
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; }, get fps() { return Math.round(fps); },
  get dbg() { return { eaten: holes.map(h => h.eaten), r: holes[0].r, goal, t: Math.round(timeLeft), props: props.length }; },
  bot() { if (state === 'play') botOn = true; },
};
