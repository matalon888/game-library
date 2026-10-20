// Honeyfield Farm: Harvest & Bake — an original farm game. Plant and harvest crops, feed hens, cows and sheep, run the
// feed mill and the bakery, and fill truck orders before the sun sets. Coins buy fields, animals, upgrades and décor.
// Art: AI-generated 3D props (assets/*.glb, copied from assets/cozy) + Hero Lab characters; land, fences, trees in code.
import { THREE, createUI, store, loop, buzz, confetti, clamp, lerp, rng } from './kit/hc.js';
import { cine } from './kit/cine.js';
import { GLTFLoader } from './kit/addons/loaders/GLTFLoader.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { heroBar, selectedHero, loadHero, onHeroesChange } from './kit/heroes.js';
import { buildWorld, LAY } from './world.js';
import { S as SND, music, setMuted, unlock } from './audio.js';
import { MeshoptSimplifier } from './lib/meshopt_simplifier.js';

const NAME = 'Honeyfield Farm: Harvest & Bake', KEY = 'honeyfield';
const Q = new URLSearchParams(location.search);
const ST = store(KEY);
const P = Object.assign({ level: 1, coins: 0, stars: {}, up: {}, decor: [], boost: { rain: 1, hurry: 1 }, mute: false, best: 0 }, ST.get('p', {}));
P.up = P.up || {}; P.boost = P.boost || { rain: 1, hurry: 1 };
const saveP = () => { try { ST.set('p', P); } catch (e) {} };
const $ = id => document.getElementById(id);
const ICON = id => `./assets/icons/${id}.webp`;

// ---------------------------------------------------------------- goods, crops, animals, recipes
const IT = {
  wheat: { n: 'Wheat', i: 'r07', v: 3 }, corn: { n: 'Corn', i: 'r08', v: 4 }, carrot: { n: 'Carrots', i: 't22', v: 5 }, straw: { n: 'Strawberries', i: 't03', v: 6 },
  tomato: { n: 'Tomatoes', i: 'r11', v: 7 }, pumpkin: { n: 'Pumpkin', i: 'r10', v: 9 },
  egg: { n: 'Eggs', i: 'r21', v: 6 }, milk: { n: 'Milk', i: 'r20', v: 8 }, wool: { n: 'Wool', i: 't16', v: 10 }, honey: { n: 'Honey', i: 'r23', v: 9 }, apple: { n: 'Apples', i: 't01', v: 6 },
  feed: { n: 'Feed', i: 'g12', v: 0 }, bread: { n: 'Bread', i: 'r22', v: 13 }, pancake: { n: 'Pancakes', i: 'f03', v: 22 }, cupcake: { n: 'Cupcakes', i: 'g13', v: 22 }, cake: { n: 'Berry cake', i: 'g15', v: 34 },
};
const CROP = {
  wheat: { t: 5, lvl: 1, m: 'r07', s: 0.86, sub: 4 }, corn: { t: 8, lvl: 2, m: 'r08', s: 0.95, sub: 4 }, carrot: { t: 9, lvl: 5, m: 'r09', s: 1.18 },
  straw: { t: 11, lvl: 7, m: 'r26', s: 1.12 }, tomato: { t: 12, lvl: 11, m: 'r11', s: 0.8, sub: 4 }, pumpkin: { t: 14, lvl: 13, m: 'r10', s: 0.95 },
};
const REC = {
  feed: { at: 'mill', in: { wheat: 1, corn: 1 }, out: 2, t: 4, lvl: 3 },
  bread: { at: 'oven', in: { wheat: 3 }, out: 1, t: 6, lvl: 4 },
  pancake: { at: 'oven', in: { wheat: 1, egg: 1, milk: 1 }, out: 1, t: 7, lvl: 6 },
  cupcake: { at: 'oven', in: { wheat: 1, egg: 1, straw: 1 }, out: 1, t: 7, lvl: 8 },
  cake: { at: 'oven', in: { wheat: 2, egg: 1, milk: 1, straw: 1 }, out: 1, t: 9, lvl: 14 },
};
const ANIM = {
  hen: { n: 'Hens', lvl: 3, m: 'r04', out: 'egg', t: 8, size: 0.74, base: 2, max: 5, pen: 'yard', snd: 'cluck' },
  cow: { n: 'Cows', lvl: 6, m: 'r03', out: 'milk', t: 11, size: 1.5, base: 2, max: 3, pen: 'cowPen', snd: 'moo' },
  sheep: { n: 'Sheep', lvl: 11, m: 'r06', out: 'wool', t: 12, size: 1.15, base: 2, max: 3, pen: 'sheepPen', snd: 'baa' },
};
const AUTO = { hive: { n: 'Beehives', lvl: 9, out: 'honey', t: 15, k: 2 }, tree: { n: 'Apple trees', lvl: 10, out: 'apple', t: 13, k: 3 } };
const PRODN = { mill: { n: 'Feed mill', lvl: 3 }, oven: { n: 'Bakery', lvl: 4 } };
const DECOR = [
  { id: 'h26', n: 'Rose bush', cost: 40, size: 1.2, pos: [-4.25, 0, -8.2], rot: 0.4 },
  { id: 'h30', n: 'Lamp posts', cost: 70, size: 1.8, pos: [-0.62, 0, 5.33], rot: 0, twin: [0.62, 0, 5.33] },
  { id: 'r12', n: 'Hay bales', cost: 100, size: 0.8, pos: [-3.55, 0, 4.05], rot: 0.5, twin: [-2.8, 0, 4.2] },
  { id: 'h29', n: 'Topiary pair', cost: 140, size: 1.15, pos: [-0.72, 0, -8.15], rot: 0, twin: [0.72, 0, -8.15] },
  { id: 'h35', n: 'Flower barrow', cost: 180, size: 1.05, pos: [3.55, 0, 4.0], rot: -0.9 },
  { id: 'h34', n: 'Bird bath', cost: 230, size: 0.85, pos: [-2.85, 0, -1.55], rot: -0.3 },
  { id: 'h22', n: 'Garden bench', cost: 290, size: 1.15, pos: [-1.3, 0, -7.85], rot: 0.15 },
  { id: 'r05', n: 'Piglet', cost: 360, size: 0.8, pos: [-1.15, 0, 3.95], rot: 0.8 },
  { id: 'r13', n: 'Wishing well', cost: 440, size: 1.35, pos: [-4.45, 0, 1.0], rot: 0.5 },
  { id: 'r10', n: 'Pumpkin patch', cost: 530, size: 0.7, pos: [4.45, 0, -0.95], rot: 0.3, twin: [2.0, 0, 1.0] },
  { id: 'h28', n: 'Lavender box', cost: 620, size: 0.85, pos: [1.0, 0, 3.95], rot: -0.2 },
  { id: 'h23', n: 'Fountain', cost: 750, size: 1.4, pos: [0, 0, -9.55], rot: 0 },
];
const VISIT = ['p05', 'p08'], VIS_H = { p05: 1.5, p08: 1.68 }, FARMER = 'p12';
const MODEL_IDS = ['r01', 'r02', 'r03', 'r04', 'r06', 'r07', 'r08', 'r09', 'r11', 'r14', 'r15', 'r16', 'r17', 'r18', 'r20', 'r25', 'r26', 'h31', 'g01',
  'r05', 'r10', 'r12', 'r13', 'h22', 'h23', 'h26', 'h28', 'h29', 'h30', 'h34', 'h35'];

// ---------------------------------------------------------------- renderer + post
const LITE = Q.has('lite') || (Math.min(screen.width, screen.height) < 500 && devicePixelRatio > 2.5);
const R = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
R.setSize(innerWidth, innerHeight); R.info.autoReset = false; R.domElement.className = 'hc-canvas'; document.body.prepend(R.domElement);
const scene = new THREE.Scene();
const skyT = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 256; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#6fc4ff'); g.addColorStop(0.55, '#bfe8ff'); g.addColorStop(1, '#fff3d0'); x.fillStyle = g; x.fillRect(0, 0, 4, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
scene.background = skyT;
scene.fog = new THREE.Fog(0xd9f0ff, 30, 75);
const cam = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.3, 140);
const C = cine(R, scene, cam, { bloom: 0.16, bloomThreshold: 1.0, bloomRadius: 0.4, exposure: 1.0, envIntensity: 0.45, lite: LITE, grade: { sat: 1.15, contrast: 1.06, vignette: 0.1, grain: 0 } });
const hemi = new THREE.HemisphereLight(0xfff6e0, 0x7da052, 0.85); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d8, 2.1); sun.position.set(6, 14, 8); sun.target.position.set(0, 0, -1);
sun.castShadow = true; sun.shadow.mapSize.set(C.lite ? 1024 : 2048, C.lite ? 1024 : 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4;
Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 45 });
scene.add(sun, sun.target);

// ---------------------------------------------------------------- UI + kit layers
const ui = createUI({ title: 'Honeyfield', hint: '', hand: '' });
const D = daily(KEY, ui, { name: NAME });
const B = board({ game: 'honeyfield', label: 'Stars earned', mode: 'sum', limits: { maxRun: 3, maxPerSec: 1 }, corner: 'tl', accent: '#ffc23d' });
const F = flow(KEY);
const OV = $('ov');

// ---------------------------------------------------------------- loading: cozy GLBs are Z-up; stand them up, centre, floor, largest side = 1
const loader = new GLTFLoader();
const GEO = {};
let loaded = 0; const toLoad = MODEL_IDS.length + VISIT.length + 2;
const prog = () => { loaded++; const b = document.querySelector('#load i'); if (b) b.style.width = Math.round(loaded / toLoad * 100) + '%'; };
function floatAttr(a) { if (!a) return a; if (a.array instanceof Float32Array && !a.normalized && !a.isInterleavedBufferAttribute) return a; const n = a.count, k = a.itemSize, out = new Float32Array(n * k); for (let i = 0; i < n; i++) for (let j = 0; j < k; j++) out[i * k + j] = a.getComponent ? a.getComponent(i, j) : [a.getX(i), a.getY(i), a.getZ(i), a.getW(i)][j]; return new THREE.BufferAttribute(out, k); }
const SIMPLE = { r07: 1400, r08: 1400, r11: 1500, r09: 2200, r26: 2200, r10: 2000, g01: 500, r04: 2200, r03: 3000, r06: 3000, r17: 2600, r18: 3200, r12: 2000,
  r20: 900, h31: 7000, r01: 5500, r02: 5500, r15: 3500, r14: 3500, r25: 4000, r16: 4000, r13: 3000, r05: 2500, h22: 3000, h23: 3500, h26: 4500, h28: 3500, h29: 3000, h30: 2000, h34: 3000, h35: 3500 };
function prep(gs, id) {
  gs.updateMatrixWorld(true);
  let mesh = null; gs.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
  const src = mesh.geometry, geo = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'uv']) if (src.attributes[k]) geo.setAttribute(k, floatAttr(src.attributes[k]));
  geo.setIndex(src.index ? new THREE.BufferAttribute(Uint32Array.from(src.index.array), 1) : null);
  geo.applyMatrix4(mesh.matrixWorld); geo.rotateX(Math.PI / 2);
  // dense duplicates (crops, animals) get a lighter mesh: meshoptimizer at load time
  if (SIMPLE[id] && geo.index && MeshoptSimplifier.supported) {
    const idx = geo.index.array, target = SIMPLE[id] * 3;
    if (idx.length > target * 1.2) { try { const [ni] = MeshoptSimplifier.simplify(idx, geo.attributes.position.array, 3, target, 0.012, []); if (ni.length > 30) geo.setIndex(new THREE.BufferAttribute(ni, 1)); } catch (e) {} }
  }
  geo.computeBoundingBox(); const bb = geo.boundingBox, sz = bb.getSize(new THREE.Vector3()), k = 1 / Math.max(sz.x, sz.y, sz.z);
  geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2); geo.scale(k, k, k);
  geo.computeBoundingBox(); geo.computeBoundingSphere();
  const mat = mesh.material; if (mat.metalness > 0.5) mat.metalness = 0.5; mat.envMapIntensity = 0.85;
  return { geo, mat, h: geo.boundingBox.max.y };
}
function mk(id, size = 1, x = 0, z = 0, rot = 0, { y = 0, parent = scene, shadow = true } = {}) {
  const g = GEO[id], m = new THREE.Mesh(g.geo, g.mat); m.scale.setScalar(size); m.position.set(x, y, z); m.rotation.y = rot;
  m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
}

// ---------------------------------------------------------------- state
let state = 'loading', W = innerWidth, H = innerHeight, world = null, wantStart = false;
let day = null, inv = {}, orders = [null, null, null], plots = [], stations = {}, animals = [], dayT = 0, t0run = 0, recorded = false, beatenShown = false;
let shipped = 0, dayCoins = 0, camMode = 'lobby', camBlend = 0, shake = 0, farmer = null, visitors = [], truck = null, decorObjs = {};
const curL = () => (D.seed ? 12 : P.level);
const unlockedAt = (lvl, L = curL()) => lvl <= L;
const cropsOpen = (L = curL()) => Object.keys(CROP).filter(k => CROP[k].lvl <= L);
const isDaily = () => !!D.seed;
const up = k => (isDaily() ? 0 : P.up[k] || 0);
const plotCount = (L = curL()) => Math.min(12, Math.min(9, 4 + Math.floor((L - 1) / 2)) + up('plot'));
const animCount = (a, L = curL()) => (ANIM[a].lvl <= L ? Math.min(ANIM[a].max, ANIM[a].base + up(a)) : 0);
const prodSlots = p => 2 + up(p + '_q');
const prodSpeed = p => Math.pow(0.82, up(p + '_s'));
const charm = () => (isDaily() ? 0 : P.decor.length);
const coinMult = () => 1 + 0.03 * charm();

// ---------------------------------------------------------------- camera (portrait phone vs wide desktop), auto-fit to the farm
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const CAMS = { play: null, lobby: null };
const FARM_PTS = [V3(-4.3, 0, -7.3), V3(4.3, 0, -7.3), V3(-3.1, 2.6, -6.4), V3(3.15, 1.6, -6.2), V3(-4.3, 0, 5.3), V3(4.3, 0, 5.3), V3(-4.35, 0, 0), V3(4.35, 0, 0), V3(4.25, 1.6, -4.1), V3(4.25, 1.2, -2.5)];
function fitCam(az, el, fov, safe) {
  // place the camera on a sphere around a target, then scale distance + shift target until the farm fills the safe rect
  const c = new THREE.PerspectiveCamera(fov, W / H, 0.3, 200), tgt = V3(0, 0, -1.2); let r = 30;
  for (let it = 0; it < 40; it++) {
    c.position.set(tgt.x + r * Math.cos(el) * Math.sin(az), tgt.y + r * Math.sin(el), tgt.z + r * Math.cos(el) * Math.cos(az)); c.lookAt(tgt); c.updateMatrixWorld(); c.updateProjectionMatrix();
    let x0 = 9, x1 = -9, y0 = 9, y1 = -9; for (const p of FARM_PTS) { const v = p.clone().project(c); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
    const sx = (x1 - x0) / (safe.x1 - safe.x0), sy = (y1 - y0) / (safe.y1 - safe.y0), s = Math.max(sx, sy);
    r *= 1 + (s - 1) * 0.7;
    // shift the target so the projected box centre sits on the safe centre (move along camera right/up)
    const dx = ((x0 + x1) / 2 - (safe.x0 + safe.x1) / 2), dy = ((y0 + y1) / 2 - (safe.y0 + safe.y1) / 2);
    const right = V3(1, 0, 0).applyQuaternion(c.quaternion), upv = V3(0, 0, -1).applyAxisAngle(V3(0, 1, 0), az);
    const k = r * Math.tan(fov * Math.PI / 360);
    tgt.addScaledVector(right, dx * k * (W / H) * 0.5); tgt.addScaledVector(upv, dy * k * 0.5 / Math.sin(el));
  }
  return { t: tgt, r, el, az, fov };
}
function frameCams() {
  const a = W / H, px = v => v / H * 2, pw = v => v / W * 2;
  if (a < 0.8) {
    CAMS.play = fitCam(0, 0.98, 34, { x0: -1 + pw(4), x1: 1 - pw(4), y0: -1 + px(150), y1: 1 - px(78) });
    CAMS.lobby = sph(V3(1.6, 3.0, 0.2), V3(-1.4, 1.0, -8.2), 44);
  } else {
    CAMS.play = fitCam(0.1, 0.86, 34, { x0: -0.62, x1: 0.62, y0: -1 + px(170), y1: 1 - px(80) });
    CAMS.lobby = sph(V3(2.4, 3.0, -1.2), V3(-0.6, 1.3, -8.4), 40);
  }
}
function sph(pos, look, fov) { const d = pos.clone().sub(look), r = d.length(); return { t: look, r, el: Math.asin(d.y / r), az: Math.atan2(d.x, d.z), fov }; }
const _cp = V3(0, 0, 0), _cl = V3(0, 0, 0);
function updateCam(dt) {
  camBlend = clamp(camBlend + (camMode === 'play' ? 1 : -1) * dt * 0.85, 0, 1);
  const e = camBlend < 0.5 ? 4 * camBlend ** 3 : 1 - (-2 * camBlend + 2) ** 3 / 2;
  const A = CAMS.lobby, Bc = CAMS.play;
  _cl.lerpVectors(A.t, Bc.t, e);
  const r = lerp(A.r, Bc.r, e), el = lerp(A.el, Bc.el, e) + Math.sin(e * Math.PI) * 0.15, az = lerp(A.az, Bc.az, e);
  _cp.set(_cl.x + r * Math.cos(el) * Math.sin(az), _cl.y + r * Math.sin(el), _cl.z + r * Math.cos(el) * Math.cos(az));
  const tt = performance.now() / 1000;
  if (camMode === 'lobby') { _cp.x += Math.sin(tt * 0.25) * 0.2; _cp.y += Math.sin(tt * 0.33) * 0.05; }
  if (shake > 0) { _cp.x += (Math.random() - 0.5) * shake; _cp.y += (Math.random() - 0.5) * shake; shake = Math.max(0, shake - dt * 0.6); }
  cam.position.copy(_cp); cam.lookAt(_cl); scene.fog.near = r * 1.3; scene.fog.far = r * 3.2;
  const f = lerp(A.fov, Bc.fov, e); if (Math.abs(cam.fov - f) > 0.01) { cam.fov = f; cam.updateProjectionMatrix(); }
}
function resize() { W = innerWidth; H = innerHeight; R.setSize(W, H); cam.aspect = W / H; cam.updateProjectionMatrix(); C.resize(W, H); frameCams(); }
addEventListener('resize', resize);
frameCams();
const _v = V3(0, 0, 0);
function toScreen(v) { _v.copy(v).project(cam); return [(_v.x + 1) / 2 * W, (1 - _v.y) / 2 * H, _v.z]; }

// ---------------------------------------------------------------- soft puffs + sparkles (pooled sprites)
const softT = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const starT = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.translate(32, 32); x.fillStyle = '#fff'; x.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? 7 : 30, a = i / 8 * Math.PI * 2; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.fill(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const SPR = [];
for (let i = 0; i < 60; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softT, transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; scene.add(s); SPR.push({ s, life: 0 }); }
function puff(pos, { color = 0xffffff, n = 1, size = 0.3, up = 0.6, spread = 0.1, life = 1.2, star = false, add = false, g = 0 } = {}) {
  for (let k = 0; k < n; k++) {
    const p = SPR.find(q => q.life <= 0); if (!p) return;
    p.s.material.map = star ? starT : softT; p.s.material.color.set(color); p.s.material.blending = add ? THREE.AdditiveBlending : THREE.NormalBlending;
    p.s.position.set(pos.x + (Math.random() - 0.5) * spread, pos.y, pos.z + (Math.random() - 0.5) * spread);
    p.v = V3((Math.random() - 0.5) * spread * 2, up * (0.7 + Math.random() * 0.6), (Math.random() - 0.5) * spread * 2);
    p.life = p.max = life * (0.8 + Math.random() * 0.4); p.size = size * (0.7 + Math.random() * 0.6); p.s.visible = true; p.star = star; p.g = g;
  }
}
function updateSprites(dt) {
  for (const p of SPR) {
    if (p.life <= 0) continue; p.life -= dt; const k = 1 - p.life / p.max;
    p.s.position.addScaledVector(p.v, dt); if (p.star) p.v.y -= dt * 1.5; if (p.g) p.v.y -= dt * p.g;
    const sc = p.size * (p.star ? (1 - k * 0.6) : (0.6 + k * 1.2)); p.s.scale.set(sc, sc, sc);
    p.s.material.opacity = p.star ? Math.min(1, (1 - k) * 2) : Math.sin(k * Math.PI) * 0.6; p.s.material.rotation = k * (p.star ? 3 : 0.6);
    if (p.life <= 0) { p.s.visible = false; p.s.material.opacity = 0; }
  }
}
const dirt = pos => puff(pos, { color: 0xb07a48, n: 6, size: 0.32, up: 0.9, spread: 0.45, life: 0.7, g: 1.5 });
const sparkle = (pos, n = 6, color = 0xffe08a) => puff(pos, { color, n, size: 0.18, up: 1.4, spread: 0.35, life: 0.7, star: true, add: true });

// ---------------------------------------------------------------- squash / wobble tweens
const tweens = [];
function squash(o, amt = 0.14) { if (!o) return; const base = o.userData.base || (o.userData.base = o.scale.clone()); tweens.push({ o, t: 0, base, amt }); }
function updateTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const q = tweens[i]; q.t += dt * 3.5; const e = Math.sin(q.t * Math.PI) * (1 - q.t);
    q.o.scale.set(q.base.x * (1 + e * q.amt * 0.8), q.base.y * (1 - e * q.amt), q.base.z * (1 + e * q.amt * 0.8));
    if (q.t >= 1) { q.o.scale.copy(q.base); tweens.splice(i, 1); }
  }
}

// ---------------------------------------------------------------- world tags (DOM bubbles that follow 3D anchors)
function mkTag() { const el = document.createElement('div'); el.className = 'tag'; el.style.display = 'none'; OV.appendChild(el); return el; }
function ringHTML(f, icon) { return `<div class="ringw"><div class="ring"><svg viewBox="0 0 34 34"><circle class="bg" cx="17" cy="17" r="12"/><circle class="fg" cx="17" cy="17" r="12" style="stroke-dashoffset:${(75.4 * (1 - f)).toFixed(1)}"/></svg></div>${icon ? `<img alt="" src="${ICON(icon)}">` : ''}</div>`; }
function setTag(s, html) { if (s.tagHTML !== html) { s.tag.innerHTML = html; s.tagHTML = html; } }

// ---------------------------------------------------------------- the farm: buildings, stations, plots, animals
function buildFarm() {
  world = buildWorld(scene);
  // buildings
  const house = mk('h31', 3.5, LAY.house[0], LAY.house[1], 0.08);
  const barn = mk('r01', 3.3, LAY.barn[0], LAY.barn[1], -0.1);
  const mill = mk('r02', 2.7, LAY.mill[0], LAY.mill[1], 0.3);
  const oven = mk('r15', 1.75, LAY.oven[0], LAY.oven[1], -0.35);
  const coop = mk('r14', 1.3, LAY.coop[0], LAY.coop[1], 0.45);
  const hives = [mk('r17', 0.9, LAY.hive[0] - 0.48, LAY.hive[1] - 0.1, 0.3), mk('r17', 0.9, LAY.hive[0] + 0.48, LAY.hive[1] + 0.12, -0.3)];
  const trees = [mk('r18', 1.55, LAY.tree[0], LAY.tree[1], 0.3), mk('r18', 1.4, LAY.tree2[0], LAY.tree2[1], 1.4)];
  const stand = mk('r25', 1.75, LAY.stand[0], LAY.stand[1], -0.3);
  mk('r20', 0.5, LAY.cowPen.x0 + 0.4, LAY.cowPen.z0 + 0.45, 0.4);
  mk('r20', 0.45, LAY.cowPen.x0 + 0.78, LAY.cowPen.z0 + 0.35, -0.3);
  truck = { o: mk('r16', 2.1, LAY.truck[0], LAY.roadZ, Math.PI / 2), x: LAY.truck[0], phase: 'park', t: 0 };
  const P3 = (a, y) => V3(a[0], y, a[1]);
  stations = {
    barn: { kind: 'barn', o: barn, anchor: P3(LAY.barn, 1.6), lvl: 1 },
    mill: { kind: 'prod', key: 'mill', o: mill, anchor: P3(LAY.mill, 1.6), tagY: 2.9, lvl: PRODN.mill.lvl, q: [], done: [] },
    oven: { kind: 'prod', key: 'oven', o: oven, anchor: P3(LAY.oven, 0.9), tagY: 1.95, lvl: PRODN.oven.lvl, q: [], done: [] },
    yard: { kind: 'pen', key: 'hen', o: coop, anchor: V3((LAY.yard.x0 + LAY.yard.x1) / 2, 0.8, (LAY.yard.z0 + LAY.yard.z1) / 2), tagY: 1.6, lvl: ANIM.hen.lvl },
    cowPen: { kind: 'pen', key: 'cow', anchor: V3((LAY.cowPen.x0 + LAY.cowPen.x1) / 2, 0.9, (LAY.cowPen.z0 + LAY.cowPen.z1) / 2), tagY: 2.0, lvl: ANIM.cow.lvl },
    sheepPen: { kind: 'pen', key: 'sheep', anchor: V3((LAY.sheepPen.x0 + LAY.sheepPen.x1) / 2, 0.9, (LAY.sheepPen.z0 + LAY.sheepPen.z1) / 2), tagY: 1.8, lvl: ANIM.sheep.lvl },
    hive: { kind: 'auto', key: 'hive', os: hives, anchor: P3(LAY.hive, 0.6), tagY: 1.35, lvl: AUTO.hive.lvl, t: 0, ready: 0 },
    tree: { kind: 'auto', key: 'tree', os: trees, anchor: V3((LAY.tree[0] + LAY.tree2[0]) / 2, 1.3, (LAY.tree[1] + LAY.tree2[1]) / 2), tagY: 2.3, lvl: AUTO.tree.lvl, t: 0, ready: 0 },
    stand: { kind: 'stand', o: stand, anchor: P3(LAY.stand, 1.2), lvl: 1 },
  };
  for (const s of Object.values(stations)) { s.tag = mkTag(); s.tagHTML = ''; }
  // plots
  plots = world.plots.map((p, i) => ({ ...p, i, state: 'empty', crop: null, t: 0, dur: 1, wob: 0 }));
  buildCrops();
  // the farmhouse porch: a little flower dressing that is always there
  scene.updateMatrixWorld(true);
  for (const o of [house, barn, mill]) o.userData.base = o.scale.clone();
}
// animals: rebuilt to match counts (level + purchases)
function buildAnimals() {
  for (const a of animals) scene.remove(a.o);
  animals = [];
  for (const [key, def] of Object.entries(ANIM)) {
    const n = animCount(key), Pn = LAY[def.pen];
    for (let i = 0; i < n; i++) {
      const x = lerp(Pn.x0 + 0.6, Pn.x1 - 0.6, (i + 0.5) / n), z = lerp(Pn.z0 + 0.8, Pn.z1 - 0.6, 0.35 + 0.4 * ((i * 7) % 3) / 2);
      const o = mk(def.m, def.size * (0.94 + 0.12 * ((i * 37) % 10) / 10), x, z, Math.random() * 6.28);
      animals.push({ key, def, o, x, z, tx: x, tz: z, state: 'hungry', t: 0, dur: def.t, hop: 0, wait: Math.random() * 2, pen: Pn });
    }
  }
}
function refreshUnlocks() {
  const L = curL(), pc = plotCount(L);
  for (const p of plots) { const open = p.i < pc; p.open = open; p.soil.visible = open; p.rim.visible = open; p.lock.visible = !open; }
  for (const s of Object.values(stations)) s.open = unlockedAt(s.lvl, L);
  for (const o of stations.hive.os) o.visible = true;
  buildAnimals();
}

// ---------------------------------------------------------------- crops on plots
const CROPI = {}, SUB4 = [[-0.31, -0.29], [0.31, -0.33], [-0.3, 0.31], [0.32, 0.29]], SUB1 = [[0, 0]];
let sproutI = null;
function buildCrops() {
  for (const [k, c] of Object.entries(CROP)) { const g = GEO[c.m], im = new THREE.InstancedMesh(g.geo, g.mat, 12 * (c.sub || 1)); im.count = 0; im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; scene.add(im); CROPI[k] = im; }
  sproutI = new THREE.InstancedMesh(GEO.g01.geo, GEO.g01.mat, 48); sproutI.count = 0; sproutI.frustumCulled = false; sproutI.receiveShadow = true; scene.add(sproutI);
}
const _M = new THREE.Matrix4(), _Q = new THREE.Quaternion(), _E = new THREE.Euler(), _S = V3(1, 1, 1), _P = V3(0, 0, 0);
function updateCrops() {
  const n = {}; for (const k in CROPI) n[k] = 0; let ns = 0; const tt = performance.now() / 1000;
  for (const p of plots) {
    if (!p.crop) continue;
    const c = CROP[p.crop], f = p.state === 'ripe' ? 1 : Math.min(1, p.t / p.dur), subs = c.sub ? SUB4 : SUB1;
    const sp = clamp(1 - (f - 0.3) / 0.15, 0, 1), cs = f < 0.25 ? 0 : 0.3 + 0.7 * ((f - 0.25) / 0.75) ** 0.8, wob = 1 + Math.sin(p.wob * Math.PI * 3) * p.wob * 0.25;
    subs.forEach(([dx, dz], j) => {
      const yaw = (p.i * 2.3 + j * 1.7) % 6.28;
      if (sp > 0.02 && ns < 48 && j < 2) { const s0 = (c.sub ? 0.42 : 0.62) * Math.min(1, f * 5 + 0.25) * sp; _Q.setFromEuler(_E.set(0, yaw, 0)); sproutI.setMatrixAt(ns++, _M.compose(_P.set(p.pos.x + dx, 0.18, p.pos.z + dz), _Q, _S.set(s0, s0, s0))); }
      if (cs > 0.01) { const s1 = c.s * cs * wob * (1 + ((p.i + j) % 3) * 0.04), sw = p.state === 'ripe' ? Math.sin(tt * 2.2 + p.i + j) * 0.05 : 0;
        _Q.setFromEuler(_E.set(sw, yaw, sw * 0.6)); CROPI[p.crop].setMatrixAt(n[p.crop]++, _M.compose(_P.set(p.pos.x + dx * (c.sub ? 1 : 0), 0.19, p.pos.z + dz), _Q, _S.set(s1, s1, s1))); }
    });
  }
  for (const k in CROPI) { CROPI[k].count = n[k]; CROPI[k].instanceMatrix.needsUpdate = true; }
  sproutI.count = ns; sproutI.instanceMatrix.needsUpdate = true;
}
function plant(p, crop, silent = false) {
  if (state !== 'play' || !p.open || p.state !== 'empty' || !CROP[crop] || CROP[crop].lvl > curL()) return false;
  p.state = 'grow'; p.crop = crop; p.t = 0; p.dur = CROP[crop].t;
  dirt(p.pos.clone().add(V3(0, 0.15, 0))); if (!silent) SND.plant(); buzz(6);
  walkTo(p.pos.x + 0.9, p.pos.z + 0.6);
  return true;
}
function harvest(p, n = 0) {
  if (state !== 'play' || p.state !== 'ripe') return false;
  const k = p.crop; p.state = 'empty'; p.crop = null;
  gain(k, 2, p.pos.clone().add(V3(0, 0.6, 0)));
  dirt(p.pos.clone().add(V3(0, 0.2, 0))); sparkle(p.pos.clone().add(V3(0, 0.6, 0)), 5);
  SND.harvest(n); buzz(8); walkTo(p.pos.x + 0.9, p.pos.z + 0.6);
  return true;
}
function updatePlot(p, dt) {
  if (p.state === 'grow') { p.t += dt; if (p.t >= p.dur) { p.state = 'ripe'; p.wob = 1; sparkle(p.pos.clone().add(V3(0, 0.7, 0)), 5); } }
  p.wob = Math.max(0, p.wob - dt * 2.5);
}

// ---------------------------------------------------------------- inventory + flying goods
function gain(k, n, pos3) {
  inv[k] = (inv[k] || 0) + n;
  if (pos3) { const [sx, sy] = toScreen(pos3); flyIcon(k, sx, sy, n); floatText(`+${n}`, sx, sy - 20); }
  renderOrders();
}
function flyIcon(k, sx, sy, n = 1) {
  // fly to the order card that wants it, else to the barn button
  let tgtEl = null; for (let i = 0; i < 3; i++) if (orders[i] && orders[i].lines.some(l => l.k === k)) { tgtEl = ORD[i]; break; }
  const r = (tgtEl || $('barnbtn')).getBoundingClientRect();
  for (let j = 0; j < Math.min(3, n); j++) {
    const d = document.createElement('div'); d.className = 'fly'; d.innerHTML = `<img alt="" src="${ICON(IT[k].i)}">`;
    d.style.transform = `translate(${sx - 17 + (j - 1) * 14}px,${sy - 17}px) scale(1.2)`; document.body.appendChild(d);
    setTimeout(() => { d.style.transform = `translate(${r.left + r.width / 2 - 17}px,${r.top + r.height / 2 - 17}px) scale(.7)`; d.style.opacity = '0'; }, 30 + j * 70);
    setTimeout(() => d.remove(), 760 + j * 70);
  }
}
function floatText(txt, sx, sy, cls = '') {
  const d = document.createElement('div'); d.className = 'float ' + cls; d.textContent = txt; d.style.left = sx + 'px'; d.style.top = sy + 'px';
  document.body.appendChild(d); setTimeout(() => d.remove(), 1150);
}
function floatAt(pos3, txt, cls = '') { const [sx, sy] = toScreen(pos3); floatText(txt, sx, sy, cls); }

// ---------------------------------------------------------------- producers (mill, bakery)
function canMake(r) { return Object.entries(REC[r].in).every(([k, n]) => (inv[k] || 0) >= n); }
function enqueue(s, r) {
  const R0 = REC[r];
  if (state !== 'play' || !s.open || R0.at !== s.key || R0.lvl > curL()) return false;
  if (s.q.length >= prodSlots(s.key)) { floatAt(s.anchor.clone().add(V3(0, 1, 0)), 'Queue full', 'no'); SND.no(); return false; }
  if (!canMake(r)) { const miss = Object.entries(R0.in).find(([k, n]) => (inv[k] || 0) < n); floatAt(s.anchor.clone().add(V3(0, 1, 0)), `Need ${IT[miss[0]].n.toLowerCase()}`, 'no'); SND.no(); return false; }
  for (const [k, n] of Object.entries(R0.in)) inv[k] -= n;
  s.q.push({ r, t: 0, dur: R0.t * prodSpeed(s.key) });
  squash(s.o, 0.1); SND.tap(); SND[s.key === 'mill' ? 'mill' : 'oven'](); walkTo(s.anchor.x + (s.key === 'mill' ? 1.4 : -1.3), s.anchor.z + 1.0);
  renderOrders(); return true;
}
function collectProd(s) {
  if (!s.done.length) return false;
  let i = 0; const pos = s.anchor.clone().add(V3(0, 0.8, 0));
  const by = {}; for (const r of s.done) by[r] = (by[r] || 0) + REC[r].out;
  s.done = [];
  for (const [r, n] of Object.entries(by)) { setTimeout(() => SND.collect(i), i * 60); gain(r, n, pos.clone().add(V3(i * 0.4, 0, 0))); i++; }
  sparkle(pos, 8); squash(s.o, 0.12); buzz(10); walkTo(s.anchor.x + (s.key === 'mill' ? 1.4 : -1.3), s.anchor.z + 1.0);
  return true;
}
function updateProd(s, dt, hurry) {
  if (!s.q.length) return;
  const j = s.q[0]; j.t += dt * (hurry ? 50 : 1);
  if (j.t >= j.dur) { s.q.shift(); s.done.push(j.r); SND.ding(); squash(s.o, 0.12); sparkle(s.anchor.clone().add(V3(0, 1, 0)), 6); }
  if (s.key === 'oven' && Math.random() < dt * 6) puff(s.anchor.clone().add(V3(0.1, 0.85, -0.2)), { color: 0xffffff, size: 0.35, up: 0.8, spread: 0.12, life: 1.2 });
  if (s.key === 'mill' && Math.random() < dt * 3) puff(s.anchor.clone().add(V3(0.6, -1.3, 0.8)), { color: 0xfff1d0, size: 0.25, up: 0.4, spread: 0.3, life: 0.9 });
}

// ---------------------------------------------------------------- animals
function penAnimals(s) { return animals.filter(a => a.key === s.key); }
function feedPen(s) {
  if (state !== 'play' || !s.open) return false;
  const hungry = penAnimals(s).filter(a => a.state === 'hungry'); if (!hungry.length) return false;
  if (!(inv.feed > 0)) { floatAt(s.anchor.clone().add(V3(0, 1.2, 0)), curL() >= 3 ? 'Need feed: tap the mill' : 'Need feed', 'no'); SND.no(); return false; }
  let n = 0;
  for (const a of hungry) { if (!(inv.feed > 0)) break; inv.feed--; a.state = 'eat'; a.t = 0; a.dur = a.def.t; a.hop = 1; n++; puff(a.o.position.clone().add(V3(0, 0.5, 0)), { color: 0xffb3c7, n: 2, size: 0.18, up: 1, spread: 0.2, life: 0.8, star: true, add: true }); }
  SND[ANIM[s.key].snd](); buzz(8); walkTo(s.anchor.x, s.anchor.z - (s.key === 'hen' ? -0.2 : 2.0));
  renderOrders(); return n > 0;
}
function collectPen(s) {
  const rdy = penAnimals(s).filter(a => a.state === 'ready'); if (!rdy.length) return false;
  for (const a of rdy) { a.state = 'hungry'; a.hop = 1; }
  gain(ANIM[s.key].out, rdy.length, s.anchor.clone().add(V3(0, 1, 0))); SND.collect(1); sparkle(s.anchor.clone().add(V3(0, 1, 0)), 8); buzz(10);
  walkTo(s.anchor.x, s.anchor.z - (s.key === 'hen' ? -0.2 : 2.0));
  return true;
}
function updateAnimals(dt, hurry) {
  const tt = performance.now() / 1000;
  for (const a of animals) {
    if (a.state === 'eat') { a.t += dt * (hurry ? 50 : 1); if (a.t >= a.dur) { a.state = 'ready'; a.hop = 1; sparkle(a.o.position.clone().add(V3(0, a.def.size * 0.8, 0)), 4); } }
    // wander inside the pen
    const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz);
    const speed = a.key === 'hen' ? 0.9 : 0.45;
    if (d > 0.05) { const st = Math.min(d, speed * dt); a.x += dx / d * st; a.z += dz / d * st; a.o.rotation.y = lerpAng(a.o.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 6)); a.o.position.y = Math.abs(Math.sin(tt * (a.key === 'hen' ? 14 : 7) + a.x)) * (a.key === 'hen' ? 0.05 : 0.03); }
    else { a.wait -= dt; a.o.position.y = 0; if (a.wait <= 0) { a.wait = 1.5 + Math.random() * 3; const Pn = a.pen, m = a.key === 'hen' ? 0.35 : 0.75; a.tx = Pn.x0 + m + Math.random() * (Pn.x1 - Pn.x0 - 2 * m); a.tz = Pn.z0 + m + Math.random() * (Pn.z1 - Pn.z0 - 2 * m); if (a.key === 'hen' && Math.hypot(a.tx - LAY.coop[0], a.tz - LAY.coop[1]) < 0.9) a.tz += 1.2; } }
    a.o.position.x = a.x; a.o.position.z = a.z;
    a.hop = Math.max(0, a.hop - dt * 2.2); if (a.hop > 0) a.o.position.y += Math.sin(a.hop * Math.PI) * 0.25;
    if (a.state === 'ready') a.o.position.y += Math.abs(Math.sin(tt * 3 + a.x)) * 0.04;
  }
}

// ---------------------------------------------------------------- hives + trees (no input, just collect)
function updateAuto(s, dt, hurry) {
  if (!s.open) return;
  const def = AUTO[s.key];
  if (!s.ready) { s.t += dt * (hurry ? 50 : 1); if (s.t >= def.t) { s.t = 0; s.ready = def.k; sparkle(s.anchor.clone().add(V3(0, 0.6, 0)), 6); if (s.key === 'hive') SND.buzz(); } }
  if (s.key === 'hive' && Math.random() < dt * 4) puff(s.anchor.clone().add(V3((Math.random() - 0.5) * 1.4, 0.4, 0)), { color: 0xffd23f, size: 0.07, up: 0.5, spread: 0.6, life: 1.4, star: true });
}
function collectAuto(s) {
  if (!s.ready) return false;
  const n = s.ready; s.ready = 0; s.t = 0;
  gain(AUTO[s.key].out, n, s.anchor.clone().add(V3(0, 0.8, 0))); SND.collect(2); sparkle(s.anchor.clone().add(V3(0, 0.8, 0)), 8); buzz(10);
  for (const o of s.os) squash(o, 0.1);
  walkTo(s.anchor.x - 1.2, s.anchor.z + 0.9);
  return true;
}

// ---------------------------------------------------------------- orders + the truck
const ORD = [...document.querySelectorAll('#orders .ocard')];
const WHO = ['Granny Gloss', 'Mr Mustard', 'The bakery', 'Corner café', 'Mill town', 'School lunch', 'Market day', 'Picnic club', 'Hotel kitchen', 'Jam shop'];
function orderSpec(r, L, idx) {
  // items the player can make by this day; newer things show up a bit more often
  const pool = [];
  for (const k of cropsOpen(L)) pool.push([k, CROP[k].lvl]);
  for (const [a, d] of Object.entries(ANIM)) if (d.lvl <= L) pool.push([d.out, d.lvl]);
  for (const [a, d] of Object.entries(AUTO)) if (d.lvl <= L) pool.push([d.out, d.lvl]);
  for (const [r0, d] of Object.entries(REC)) if (d.lvl <= L && r0 !== 'feed') pool.push([r0, d.lvl]);
  const wsum = pool.reduce((s, [, l]) => s + 1 + (l >= L - 2 ? 1.6 : 0), 0);
  const pick = () => { let x = r() * wsum; for (const [k, l] of pool) { x -= 1 + (l >= L - 2 ? 1.6 : 0); if (x <= 0) return k; } return pool[0][0]; };
  const nl = L <= 2 ? 1 + (idx % 2 && L === 2 ? 1 : 0) : L <= 5 ? 1 + Math.floor(r() * 2) : 1 + Math.floor(r() * (L < 10 ? 2.6 : 3));
  const lines = [];
  for (let j = 0; j < nl; j++) {
    let k = pick(), tries = 0; while (lines.some(l => l.k === k) && tries++ < 8) k = pick();
    if (lines.some(l => l.k === k)) continue;
    const big = REC[k] ? 1 : ANIM[Object.keys(ANIM).find(a => ANIM[a].out === k)] || AUTO[Object.keys(AUTO).find(a => AUTO[a].out === k)] ? 2 : 4;
    const n = Math.max(1, Math.round((big === 1 ? 1 + r() * (L > 9 ? 1.6 : 0.8) : big === 2 ? 1 + r() * (1.5 + L * 0.08) : 2 + r() * (1.5 + L * 0.12)) * (0.9 + 0.1 * Math.min(1.3, F.k()))));
    lines.push({ k, n });
  }
  const val = lines.reduce((s, l) => s + IT[l.k].v * l.n, 0);
  return { lines, coins: Math.round(val * (1.15 + r() * 0.2)), who: WHO[Math.floor(r() * WHO.length)] };
}
const WORK = { wheat: 2.2, corn: 3, carrot: 3.4, straw: 4, tomato: 4.2, pumpkin: 5.5, egg: 4.5, milk: 6, wool: 7, honey: 5, apple: 3.8, bread: 8, pancake: 14, cupcake: 14, cake: 20 };
function dayConfig(L) {
  const fk = F.k(), seed = D.seed ? D.seed : L * 7919 + 101, r = rng(seed);
  const n = Math.max(3, Math.round(Math.min(9, L <= 1 ? 3 : L <= 3 ? 4 : 4 + L / 4) * Math.min(1.15, fk)));
  const specs = []; for (let i = 0; i < n; i++) specs.push(orderSpec(r, L, i));
  const work = specs.reduce((s, o) => s + o.lines.reduce((a, l) => a + WORK[l.k] * l.n, 0), 0);
  const T = Math.round(clamp((L <= 3 ? 70 : 55) + work * (L <= 3 ? 1.6 : 1.25), 80, 330) / fk);
  return { L, specs, n, T, r };
}
function nextOrder(i) {
  if (day.next >= day.n) { orders[i] = null; return; }
  orders[i] = { ...day.specs[day.next++], id: Math.random() }; orders[i].fresh = true;
}
function canShip(o) { return o && o.lines.every(l => (inv[l.k] || 0) >= l.n); }
function ship(i) {
  const o = orders[i]; if (state !== 'play' || !canShip(o)) { if (o) { ORD[i].classList.remove('shake'); void ORD[i].offsetWidth; ORD[i].classList.add('shake'); SND.no(); } return false; }
  for (const l of o.lines) inv[l.k] -= l.n;
  const coins = Math.round(o.coins * coinMult()); dayCoins += coins; shipped++;
  const r = ORD[i].getBoundingClientRect(); coinFly(r.left + r.width / 2, r.top, Math.min(9, 3 + Math.round(coins / 15)));
  floatText(`+${coins}`, r.left + r.width / 2, r.top - 6, 'gold');
  SND.ship(); buzz(18); farmerCheer(); for (const v of visitors) vplay(v, 'cheer');
  truckGo();
  ORD[i].classList.add('gone');
  const L0 = day.L;
  setTimeout(() => { if (!day || day.L !== L0 || state !== 'play') return; nextOrder(i); renderOrders(); }, 450);
  orders[i] = { gone: true, lines: [] };
  updateHud(true);
  if (!beatenShown && D.beaten(dayCoins)) { beatenShown = true; ui.pop('BEATEN!', '#ffe56b', 40, 30); confetti(scene, V3(0, 2, 0), 40); }
  if (shipped >= day.n) setTimeout(() => endDay(true), 700);
  return true;
}
function coinFly(sx, sy, n) {
  const tgt = $('hcoins').getBoundingClientRect();
  for (let i = 0; i < n; i++) {
    const d = document.createElement('div'); d.className = 'fly c'; d.innerHTML = '<span class="coin"></span>';
    d.style.transform = `translate(${sx - 11 + (Math.random() - 0.5) * 50}px,${sy - 11 + (Math.random() - 0.5) * 30}px)`; document.body.appendChild(d);
    setTimeout(() => { d.style.transform = `translate(${tgt.left}px,${tgt.top}px) scale(.8)`; d.style.opacity = '0'; }, 30 + i * 45);
    setTimeout(() => { d.remove(); if (i % 2 === 0) SND.coin(i); }, 720 + i * 45);
  }
}
function renderOrders() {
  if (!day) return;
  for (let i = 0; i < 3; i++) {
    const o = orders[i], el = ORD[i];
    if (!o) { if (!el.classList.contains('empty')) { el.className = 'ocard empty'; el.innerHTML = day && shipped < day.n ? '' : '✓'; } continue; }
    if (o.gone) continue;
    const key = o.id + '|' + o.lines.map(l => Math.min(inv[l.k] || 0, l.n)).join(',');
    const ready = canShip(o);
    if (el.dataset.key !== key) {
      el.dataset.key = key;
      el.className = 'ocard' + (o.fresh ? ' newo' : '');
      el.innerHTML = `<div class="who">${o.who}</div>${o.lines.map(l => { const h = Math.min(inv[l.k] || 0, l.n); return `<div class="ln"><img alt="" src="${ICON(IT[l.k].i)}"><span class="${h >= l.n ? 'ok' : 'no'}">${h}/${l.n}</span></div>`; }).join('')}<div class="rw"><span class="coin"></span>${Math.round(o.coins * coinMult())}</div>`;
      o.fresh = false;
    }
    el.classList.toggle('ready', ready);
  }
  updateHud();
}
ORD.forEach((el, i) => el.addEventListener('pointerdown', e => { e.stopPropagation(); unlock(); closePop(); if (state === 'play' && orders[i] && !orders[i].gone) ship(i); }));
function truckGo() { if (truck.phase === 'park') { truck.phase = 'out'; truck.t = 0; SND.honk(); setTimeout(() => SND.engine(), 200); } else truck.again = true; }
function updateTruck(dt) {
  const o = truck.o;
  if (truck.phase === 'out') { truck.t += dt; truck.x += dt * (2 + truck.t * 9); o.rotation.y = Math.PI / 2; if (truck.x > 16) { truck.phase = 'back'; truck.x = -16; } }
  else if (truck.phase === 'back') { const d = LAY.truck[0] - truck.x; truck.x += Math.max(0.02, Math.min(d, dt * Math.max(1.5, d * 2.2))); if (d < 0.02) { truck.x = LAY.truck[0]; truck.phase = truck.again ? 'out' : 'park'; truck.again = false; truck.t = 0; squash(o, 0.06); } }
  o.position.x = truck.x; o.position.y = truck.phase === 'park' ? 0 : Math.abs(Math.sin(performance.now() / 70)) * 0.03;
}

// ---------------------------------------------------------------- the farmer (the player's Hero Lab hero) + visitors at the stand
let farmerTok = 0, fx = -0.9, fz = -7.3, ftx = fx, ftz = fz, fCheer = 0;
async function buildFarmer() {
  const tok = ++farmerTok, h = selectedHero();
  let k;
  try {
    k = h ? await loadHero(THREE, GLTFLoader, { hero: h, quality: 'game', height: 1.55, shadows: true })
      : await loadHero(THREE, GLTFLoader, { hero: { char: FARMER }, assets: './assets/heroes/', height: 1.55, shadows: true });
  } catch (e) {
    try { k = await loadHero(THREE, GLTFLoader, { hero: { char: FARMER }, assets: './assets/heroes/', height: 1.55, shadows: true }); } catch (e2) { console.warn('farmer', e2); return; }
  }
  if (tok !== farmerTok) { k.dispose(); return; }
  for (const n of ['cheer', 'jump', 'fall']) if (k.actions[n]) { k.actions[n].setLoop(THREE.LoopOnce, 1); k.actions[n].clampWhenFinished = true; }
  const old = farmer; farmer = { k, cur: '' };
  k.object.position.set(fx, 0, fz); scene.add(k.object);
  if (old) old.k.dispose();
  fplay(state === 'play' ? 'idle' : 'cheer'); if (state !== 'play') fCheer = 1.6;
}
function fplay(name, ts = 1) { if (!farmer) return; const a = farmer.k.actions[name]; if (farmer.cur === name && !['cheer', 'jump'].includes(name)) { if (a) a.timeScale = ts; return; } farmer.k.play(name, { fade: 0.2 }); if (a) a.timeScale = ts; farmer.cur = name; }
function walkTo(x, z) { ftx = clamp(x, -4.4, 4.4); ftz = clamp(z, -7.4, 5.0); }
function farmerCheer() { fCheer = 1.4; fplay('cheer'); }
function updateFarmer(dt) {
  if (!farmer) return;
  const o = farmer.k.object;
  if (state !== 'play') { ftx = -0.9; ftz = -7.3; }
  const dx = ftx - fx, dz = ftz - fz, d = Math.hypot(dx, dz), moving = d > 0.06;
  if (moving) { const sp = Math.min(d, dt * (d > 3 ? 7 : 4.5)); fx += dx / d * sp; fz += dz / d * sp; o.rotation.y = lerpAng(o.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 12)); }
  else if (state === 'play') o.rotation.y = lerpAng(o.rotation.y, 0.2, Math.min(1, dt * 3));
  else o.rotation.y = lerpAng(o.rotation.y, 0.35, Math.min(1, dt * 3));
  o.position.set(fx, 0, fz);
  fCheer = Math.max(0, fCheer - dt);
  if (moving && fCheer <= 0.6) { fplay(d > 3 ? 'sprint' : 'run', 1.1); fCheer = 0; }
  else if (fCheer <= 0 && !moving) fplay('idle');
}
async function loadVisitors() {
  const spots = [[LAY.stand[0] - 0.55, LAY.stand[1] + 1.0, -0.2], [LAY.stand[0] + 0.6, LAY.stand[1] + 1.05, 0.4]];
  for (let i = 0; i < VISIT.length; i++) {
    try {
      const k = await loadHero(THREE, GLTFLoader, { hero: { char: VISIT[i] }, assets: './assets/heroes/', height: VIS_H[VISIT[i]], shadows: true });
      for (const n of ['cheer', 'jump']) if (k.actions[n]) { k.actions[n].setLoop(THREE.LoopOnce, 1); k.actions[n].clampWhenFinished = true; }
      k.object.position.set(spots[i][0], 0, spots[i][1]); k.object.rotation.y = spots[i][2]; scene.add(k.object);
      visitors.push({ k, cur: 'idle', t: 0 });
    } catch (e) { console.warn('visitor', e); }
    prog();
  }
}
function vplay(v, name) { v.k.play(name, { fade: 0.2 }); v.cur = name; v.t = name === 'cheer' ? 1.6 + Math.random() * 0.3 : 0; }
function updateVisitors(dt) { for (const v of visitors) { v.k.mixer.update(dt); if (v.t > 0) { v.t -= dt; if (v.t <= 0) vplay(v, 'idle'); } } }
function lerpAng(a, b, t) { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; }

// ---------------------------------------------------------------- popovers: seeds, recipes, barn
const POP = $('pop');
let popFor = null, armed = null, popT = 0;
['pointerdown', 'pointerup'].forEach(ev => POP.addEventListener(ev, e => e.stopPropagation()));
function placePop(sx, sy) {
  POP.hidden = false; const r = POP.getBoundingClientRect();
  let y = sy - r.height - 30; if (y < 72) y = sy + 34;
  const x = clamp(sx - r.width / 2, 6, W - r.width - 6); y = clamp(y, 72, H - r.height - 150);
  POP.style.transform = `translate(${x}px,${y}px)`;
}
function closePop() { POP.hidden = true; popFor = null; armed = null; }
function openSeeds(p) {
  const [sx, sy] = toScreen(p.pos);
  const L = curL();
  POP.innerHTML = `<h4><span>Plant</span><span>drag over fields</span></h4><div class="row">${Object.entries(CROP).filter(([, c], i, a) => c.lvl <= L || c.lvl === Math.min(...a.filter(([, q]) => q.lvl > L).map(([, q]) => q.lvl))).map(([k, c]) => `<button class="pbtn ${c.lvl > L ? 'lockd' : ''}" data-c="${k}"><img alt="" src="${ICON(IT[k].i)}">${c.lvl > L ? `🔒 ${c.lvl}` : IT[k].n}<small>${c.lvl > L ? 'day' : c.t + 's · ' + (inv[k] || 0)}</small></button>`).join('')}</div>`;
  popFor = { plot: p }; placePop(sx, sy); popT = 0;
  for (const b of POP.querySelectorAll('.pbtn')) b.addEventListener('pointerdown', e => {
    e.stopPropagation(); unlock(); const k = b.dataset.c;
    if (CROP[k].lvl > L) { SND.no(); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); return; }
    armed = k; if (popFor && popFor.plot) plant(popFor.plot, k);
    drag = { mode: 'plant', crop: k, n: 0 }; popT = 0;
  });
}
function openRecipes(s) {
  const L = curL(), list = Object.entries(REC).filter(([, r]) => r.at === s.key);
  const [sx, sy] = toScreen(s.anchor);
  const qn = s.q.length, slots = prodSlots(s.key);
  POP.innerHTML = `<h4><span>${PRODN[s.key].n}</span><span>queue ${qn}/${slots}</span></h4>` + list.map(([k, r]) => {
    const lock = r.lvl > L, ok = canMake(k);
    return `<button class="rec ${lock ? 'lockd' : ok ? '' : 'no'}" data-r="${k}"><img alt="" src="${ICON(IT[k].i)}"><div><div>${IT[k].n}${r.out > 1 ? ' ×' + r.out : ''}</div><div class="ing">${lock ? `🔒 day ${r.lvl}` : Object.entries(r.in).map(([i, n]) => `<span class="${(inv[i] || 0) >= n ? '' : 'bad'}"><img alt="" src="${ICON(IT[i].i)}">${inv[i] || 0}/${n}</span>`).join('')}</div></div><span class="tm">${Math.round(r.t * prodSpeed(s.key))}s</span></button>`;
  }).join('');
  popFor = { st: s }; placePop(sx, sy); popT = 0;
  for (const b of POP.querySelectorAll('.rec')) b.addEventListener('click', e => { e.stopPropagation(); unlock(); const k = b.dataset.r; if (REC[k].lvl > L) { SND.no(); return; } if (enqueue(s, k)) openRecipes(s); else { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); } });
}
function openBarn() {
  const ks = Object.keys(IT).filter(k => (inv[k] || 0) > 0 || isOpenItem(k));
  POP.innerHTML = `<h4><span>Barn</span><span>${ks.reduce((s, k) => s + (inv[k] || 0), 0)} items</span></h4><div class="inv">${ks.map(k => `<div class="${inv[k] ? '' : 'z'}"><img alt="" src="${ICON(IT[k].i)}">${inv[k] || 0}</div>`).join('')}</div>`;
  popFor = { barn: true }; const r = $('barnbtn').getBoundingClientRect(); placePop(r.left + 120, r.top - 6); popT = 0;
}
function isOpenItem(k) { const L = curL(); if (CROP[k]) return CROP[k].lvl <= L; if (REC[k]) return REC[k].lvl <= L; for (const d of Object.values(ANIM)) if (d.out === k) return d.lvl <= L; for (const d of Object.values(AUTO)) if (d.out === k) return d.lvl <= L; return false; }
$('barnbtn').addEventListener('pointerdown', e => { e.stopPropagation(); unlock(); if (state !== 'play') return; if (popFor && popFor.barn) closePop(); else { SND.tap(); openBarn(); } });

// ---------------------------------------------------------------- picking: plots by ground ray, everything else by nearest screen anchor
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), groundPlane = new THREE.Plane(V3(0, 1, 0), -0.2), _gp = V3(0, 0, 0);
function plotAt(x, y) {
  ndc.set(x / W * 2 - 1, -(y / H) * 2 + 1); ray.setFromCamera(ndc, cam); if (!ray.ray.intersectPlane(groundPlane, _gp)) return null;
  const hs = LAY.plotSize / 2 + 0.08;
  return plots.find(p => Math.abs(_gp.x - p.pos.x) < hs && Math.abs(_gp.z - p.pos.z) < hs) || null;
}
function stationAt(x, y) {
  let best = null, bd = 1e9; const R1 = Math.max(44, Math.min(W, H) * 0.11);
  for (const s of Object.values(stations)) { const [sx, sy, sz] = toScreen(s.anchor); if (sz > 1) continue; const d = Math.hypot(sx - x, sy - y); if (d < R1 && d < bd) { bd = d; best = s; } }
  return best;
}
function tapStation(s) {
  if (!s.open) { const lvl = s.lvl; floatAt(s.anchor.clone().add(V3(0, 1, 0)), `Opens on day ${lvl}`, 'no'); SND.no(); return false; }
  if (s.kind === 'barn') { SND.tap(); openBarn(); return true; }
  if (s.kind === 'stand') { squash(s.o, 0.08); SND.tap(); for (const v of visitors) vplay(v, 'jump'); return true; }
  if (s.kind === 'prod') { if (collectProd(s)) return true; SND.tap(); openRecipes(s); return true; }
  if (s.kind === 'pen') { if (collectPen(s)) return true; return feedPen(s); }
  if (s.kind === 'auto') { if (collectAuto(s)) return true; floatAt(s.anchor.clone().add(V3(0, 1, 0)), `${Math.ceil(AUTO[s.key].t - s.t)}s`, ''); SND.tap(); return false; }
  return false;
}
let drag = null;
R.domElement.addEventListener('pointerdown', e => {
  unlock();
  if (state !== 'play') return;
  const p = plotAt(e.clientX, e.clientY);
  if (p) {
    if (!p.open) { closePop(); floatAt(p.pos.clone().add(V3(0, 0.5, 0)), 'Buy fields in the farm shop', 'no'); SND.no(); return; }
    if (p.state === 'ripe') { closePop(); harvest(p); drag = { mode: 'harvest', n: 1 }; return; }
    if (p.state === 'empty') {
      if (armed && popFor && popFor.plot) { plant(p, armed); popFor.plot = p; drag = { mode: 'plant', crop: armed, n: 1 }; popT = 0; return; }
      openSeeds(p); return;
    }
    closePop(); floatAt(p.pos.clone().add(V3(0, 0.6, 0)), `${Math.ceil(p.dur - p.t)}s`, ''); return;
  }
  closePop();
  const s = stationAt(e.clientX, e.clientY); if (s) tapStation(s);
});
addEventListener('pointermove', e => {
  if (!drag || state !== 'play') return;
  const p = plotAt(e.clientX, e.clientY); if (!p) return;
  if (drag.mode === 'harvest' && p.state === 'ripe') harvest(p, drag.n++);
  if (drag.mode === 'plant' && p.state === 'empty' && p.open) { plant(p, drag.crop, drag.n++ % 2 === 1); if (popFor) popFor.plot = p; }
});
addEventListener('pointerup', () => { drag = null; });

// ---------------------------------------------------------------- day flow
function startDay() {
  if (state === 'loading') { wantStart = true; return; }
  if (state === 'play') return;
  day = dayConfig(curL()); day.next = 0;
  refreshUnlocks();
  inv = { wheat: 3 }; if (curL() >= 2) inv.corn = 2; if (curL() >= 3) inv.feed = 2;
  for (const p of plots) { p.state = 'empty'; p.crop = null; }
  for (const s of Object.values(stations)) { if (s.q) { s.q = []; s.done = []; } if (s.kind === 'auto') { s.t = AUTO[s.key].t * 0.5; s.ready = 0; } }
  orders = [null, null, null]; for (const el of ORD) { el.className = 'ocard empty'; el.innerHTML = ''; el.dataset.key = ''; }
  shipped = 0; dayCoins = 0; dayT = 0; hurryT = 0; recorded = false; beatenShown = false;
  state = 'play'; camMode = 'play'; t0run = performance.now(); closePop();
  for (let i = 0; i < 3; i++) setTimeout(() => { if (state === 'play' && !orders[i]) { nextOrder(i); renderOrders(); } }, 500 + i * 220);
  $('hud').classList.remove('off'); $('orders').classList.remove('off'); $('boosts').classList.remove('off'); $('hday').textContent = D.seed ? '★' : day.L;
  updateHud(); updateBoosts();
  ui.pop(D.seed ? 'Daily harvest!' : `Day ${day.L}`, '#fff', 42, 34);
  const nw = newsFor(day.L); if (nw) setTimeout(() => state === 'play' && ui.pop(nw, '#ffe56b', 26, 40), 1100);
  SND.rooster(); music(!P.mute); fplay('idle'); walkTo(0, -5.6);
  B.start();
}
function newsFor(L) {
  if (D.seed) return '';
  const n = []; for (const [k, c] of Object.entries(CROP)) if (c.lvl === L) n.push(IT[k].n); for (const d of Object.values(ANIM)) if (d.lvl === L) n.push(d.n); for (const [k, d] of Object.entries(AUTO)) if (d.lvl === L) n.push(d.n);
  for (const [k, r] of Object.entries(REC)) if (r.lvl === L) n.push(k === 'feed' ? 'Feed mill' : IT[k].n);
  return n.length ? 'New: ' + n.slice(0, 3).join(', ') : '';
}
let hurryT = 0;
function updateDay(dt) {
  if (state !== 'play') return;
  dayT += dt; hurryT = Math.max(0, hurryT - dt);
  const hurry = hurryT > 0;
  for (const p of plots) if (p.open) updatePlot(p, dt);
  for (const s of Object.values(stations)) { if (s.kind === 'prod' && s.open) updateProd(s, dt, hurry); if (s.kind === 'auto') updateAuto(s, dt, hurry); }
  updateAnimals(dt, hurry);
  if (dayT >= day.T && !recorded) endDay(false);
  updateHud();
}
function starsFor(t, T) { const f = t / T; return f <= 0.6 ? 3 : f <= 0.8 ? 2 : 1; }
function endDay(won) {
  if (recorded || state !== 'play') return; recorded = true;
  const ms = performance.now() - t0run, stars = won ? starsFor(dayT, day.T) : 0;
  F.level(won, clamp(shipped / day.n, 0, 1));
  P.coins += dayCoins; P.best = Math.max(P.best, dayCoins);
  let gift = '';
  if (won) {
    B.submit(stars, { ms });
    if (!D.seed) {
      const L = day.L, prev = P.stars[L] || 0;
      if (stars > prev) P.stars[L] = stars;
      if (stars === 3 && prev < 3) { const b = L % 2 ? 'rain' : 'hurry'; P.boost[b]++; gift = b === 'rain' ? '+1 💧 Rain' : '+1 ⏩ Hurry'; }
      if (L % 5 === 0 && prev === 0) { P.boost.rain++; P.boost.hurry++; gift = '+1 💧 Rain  +1 ⏩ Hurry'; }
      if (L === P.level) P.level++;
    }
  }
  saveP();
  state = won ? 'won' : 'lost'; camMode = 'lobby'; closePop(); drag = null;
  $('hud').classList.add('off'); $('orders').classList.add('off'); $('boosts').classList.add('off');
  music(false);
  if (won) { D.won(stars, 'earned stars'); SND.win(); confetti(scene, V3(fx, 2.2, fz), 70); farmerCheer(); showResult(true, stars, gift); }
  else { SND.lose(); if (farmer) { fCheer = 1.6; fplay('fall'); } showResult(false, 0, ''); }
}

// ---------------------------------------------------------------- HUD + sun
function updateHud(bump) {
  if (!day) return;
  const left = clamp(1 - dayT / day.T, 0, 1);
  $('hbar').style.width = (left * 100).toFixed(1) + '%';
  const bs = document.querySelectorAll('.hbar b'); [0.4, 0.2, 0.0].forEach((v, i) => bs[i].classList.toggle('off', i < 2 ? left < v : left <= 0));
  const s = Math.max(0, Math.ceil(day.T - dayT)); $('htime').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  $('hsunt').textContent = left > 0.66 ? 'Morning' : left > 0.33 ? 'Afternoon' : left > 0.12 ? 'Evening' : 'Sunset!';
  $('hord').textContent = `${shipped}/${day.n}`; $('hcoins').textContent = dayCoins;
  if (bump) $('hcoins').animate([{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'cubic-bezier(.2,1.6,.4,1)' });
}
const sunCol = new THREE.Color(), C_NOON = new THREE.Color(0xfff0d8), C_DUSK = new THREE.Color(0xffa060);
function updateSun() {
  const f = state === 'play' && day ? clamp(dayT / day.T, 0, 1) : 0.15;
  const a = lerp(-0.9, 0.9, f);
  sun.position.set(Math.sin(a) * 12, 13 - Math.abs(a) * 3, 8); sun.target.position.set(0, 0, -1);
  sunCol.copy(C_NOON).lerp(C_DUSK, clamp((f - 0.6) / 0.4, 0, 1) ** 1.5); sun.color.copy(sunCol);
  sun.intensity = 2.1 - clamp((f - 0.7) / 0.3, 0, 1) * 0.5; hemi.intensity = 0.85 - clamp((f - 0.7) / 0.3, 0, 1) * 0.15;
}

// ---------------------------------------------------------------- boosters (earned by play only)
function updateBoosts() {
  $('br').querySelector('b').textContent = P.boost.rain; $('bh').querySelector('b').textContent = P.boost.hurry;
  $('br').classList.toggle('dim', !P.boost.rain); $('bh').classList.toggle('dim', !P.boost.hurry);
}
function useRain() {
  if (state !== 'play' || !P.boost.rain) return false;
  const g = plots.filter(p => p.state === 'grow'); if (!g.length) { ui.pop('Plant something first', '#fff', 22, 62); return false; }
  P.boost.rain--; saveP(); SND.rain(); SND.boost(); ui.pop('Rain shower!', '#bfe8ff', 34, 30);
  for (const p of g) { p.t = p.dur; puff(p.pos.clone().add(V3(0, 2.2, 0)), { color: 0x9ad8ff, n: 4, size: 0.16, up: -2.5, spread: 0.8, life: 0.8, star: true }); }
  updateBoosts(); return true;
}
function useHurry() {
  if (state !== 'play' || !P.boost.hurry || hurryT > 0) return false;
  P.boost.hurry--; saveP(); hurryT = 2.5; SND.boost(); ui.pop('Hurry up!', '#ffe56b', 34, 30); ui.flash(0.2);
  updateBoosts(); return true;
}
for (const [id, fn] of [['br', useRain], ['bh', useHurry]]) { const b = $(id); b.addEventListener('pointerdown', e => { e.stopPropagation(); unlock(); fn(); }); }
$('mute').addEventListener('pointerdown', e => { e.stopPropagation(); P.mute = !P.mute; saveP(); setMuted(P.mute); $('mute').textContent = P.mute ? '🔇' : '🔊'; music(!P.mute && state === 'play'); });
setMuted(P.mute); $('mute').textContent = P.mute ? '🔇' : '🔊';

// ---------------------------------------------------------------- lobby (start card): logo, journey, hero bar, play, shop
const startEl = ui.els.start;
const lob = document.createElement('div'); lob.className = 'lob'; startEl.appendChild(lob);
lob.innerHTML = `<div class="logo"><b>Honey<i>field</i></b><span>Farm</span><small>HARVEST · BAKE · DELIVER</small></div>
  <div class="streak" id="streak" hidden></div><div class="charmline" id="charmline"></div><div class="journey" id="journey"></div><div class="lspace"></div>
  <div class="herowrap" id="herowrap"></div>
  <div class="prow"><button class="sbtn" data-open="farm">🐔<small>Farm</small><b></b></button><button class="playbtn" id="playbtn">Play Day 1<small></small></button><button class="sbtn" data-open="decor">🌷<small>Décor</small><b></b></button></div>
  <div class="sheet" id="sheet" hidden><div class="shop"><div class="tabs"><button data-tab="farm" class="on">Farm</button><button data-tab="decor">Décor</button><span class="bank"><span class="coin"></span><span id="bank">0</span></span><button class="x" id="shopx">✕</button></div><div class="charm" id="charm"></div><div class="row" id="shoprow"></div></div></div>`;
if (D.streak > 1 || D.beat) { const s = $('streak'); s.hidden = false; s.textContent = D.beat ? `Beat ${D.beat} stars!` : `🔥 ${D.streak}-day streak`; }
let shopTab = 'farm';
for (const b of lob.querySelectorAll('.tabs button')) { b.addEventListener('pointerdown', e => e.stopPropagation()); b.addEventListener('click', e => { e.stopPropagation(); shopTab = b.dataset.tab; SND.tap(); renderLobby(); }); }
for (const id of ['sheet', 'journey']) { const el = $(id); ['pointerdown', 'pointerup'].forEach(ev => el.addEventListener(ev, e => e.stopPropagation())); }
for (const b of lob.querySelectorAll('.sbtn')) { b.addEventListener('pointerdown', e => e.stopPropagation()); b.addEventListener('click', e => { e.stopPropagation(); unlock(); shopTab = b.dataset.open; $('sheet').hidden = false; SND.tap(); renderLobby(); }); }
$('sheet').addEventListener('click', e => { if (e.target.id === 'sheet' || e.target.id === 'shopx') { e.stopPropagation(); $('sheet').hidden = true; SND.tap(); } });
heroBar({ parent: $('herowrap'), title: 'Your farmer', noneLabel: 'Tex', noneIcon: '🤠', onPick: () => buildFarmer() });
onHeroesChange(() => buildFarmer());

function shopItems() {
  const L = P.level, list = [];
  const base = Math.min(9, 4 + Math.floor((L - 1) / 2)), pl = P.up.plot || 0;
  list.push({ id: 'plot', icon: 'r09', t: 'New field', lv: pl, max: 3, cost: [60, 120, 200][pl], ok: base + pl < 12 });
  for (const [k, d] of Object.entries(ANIM)) { const n = P.up[k] || 0, m = d.max - d.base; list.push({ id: k, icon: d.m, t: `+1 ${d.n.replace(/s$/, '').toLowerCase()}`, lv: n, max: m, cost: [80, 160, 260][n] * (k === 'hen' ? 1 : k === 'cow' ? 1.5 : 1.8) | 0, lock: d.lvl > L ? d.lvl : 0 }); }
  for (const [k, d] of Object.entries(PRODN)) {
    const s = P.up[k + '_s'] || 0, q = P.up[k + '_q'] || 0;
    list.push({ id: k + '_s', icon: k === 'mill' ? 'r02' : 'r15', t: `${d.n} speed`, lv: s, max: 3, cost: [70, 150, 280][s], lock: d.lvl > L ? d.lvl : 0 });
    list.push({ id: k + '_q', icon: k === 'mill' ? 'g12' : 'r22', t: `${d.n} +1 slot`, lv: q, max: 2, cost: [90, 220][q], lock: d.lvl > L ? d.lvl : 0 });
  }
  return list;
}
function renderLobby() {
  const L = curL(), cfg = dayConfig(L);
  $('playbtn').innerHTML = `${D.seed ? 'Daily Harvest' : `Play Day ${L}`}<small>${cfg.n} orders · sunset in ${Math.floor(cfg.T / 60)}:${String(cfg.T % 60).padStart(2, '0')}</small>`;
  $('bank').textContent = P.coins;
  const tot = Object.values(P.stars).reduce((a, b) => a + b, 0);
  $('charmline').textContent = `⭐ ${tot}  ·  🌷 Farm charm ${P.decor.length}/${DECOR.length}`;
  const J = $('journey'), top = Math.max(P.level + 4, 10);
  J.innerHTML = Array.from({ length: top }, (_, i) => { const d = i + 1, st = P.stars[d] || 0; return `<div class="jd ${d === P.level ? 'cur' : d > P.level ? 'lock' : ''}">${d}${d < P.level || st ? `<i>${'★'.repeat(st)}${'☆'.repeat(3 - st)}</i>` : ''}</div>`; }).join('');
  requestAnimationFrame(() => { const c = J.querySelector('.cur'); if (c) J.scrollLeft = Math.max(0, c.offsetLeft - J.offsetLeft - J.clientWidth / 2 + 22); });
  for (const b of lob.querySelectorAll('.tabs button')) b.classList.toggle('on', b.dataset.tab === shopTab);
  const nUp = shopItems().filter(u => !u.lock && u.ok !== false && u.lv < u.max && u.cost <= P.coins).length, nDe = DECOR.filter(d => !P.decor.includes(d.id) && d.cost <= P.coins).length;
  lob.querySelectorAll('.sbtn b').forEach((b, i) => { const n = i ? nDe : nUp; b.textContent = n; b.hidden = !n; });
  const row = $('shoprow');
  if (shopTab === 'farm') {
    $('charm').textContent = 'More fields, animals and faster machines fill orders sooner.';
    row.innerHTML = shopItems().map(u => { const max = u.lv >= u.max || u.ok === false; return `<button class="card ${u.lock ? 'lockd' : max ? 'own' : P.coins < u.cost ? 'no' : ''}" data-id="${u.id}"><img alt="" src="${ICON(u.icon)}"><b>${u.t}</b><div class="lv">${Array.from({ length: u.max }, (_, i) => `<i class="${i < u.lv ? 'on' : ''}"></i>`).join('')}</div><div class="pr">${u.lock ? `🔒 day ${u.lock}` : max ? 'MAX' : `<span class="coin"></span>${u.cost}`}</div></button>`; }).join('');
  } else {
    $('charm').textContent = `Farm charm ${P.decor.length}/${DECOR.length} · each piece adds +3% to every order`;
    row.innerHTML = DECOR.map(d => { const own = P.decor.includes(d.id); return `<button class="card ${own ? 'own' : P.coins < d.cost ? 'no' : ''}" data-d="${d.id}"><img alt="" src="${ICON(d.id)}"><b>${d.n}</b><div class="pr">${own ? '✓ Placed' : `<span class="coin"></span>${d.cost}`}</div></button>`; }).join('');
  }
  for (const b of row.querySelectorAll('.card')) b.addEventListener('click', e => { e.stopPropagation(); b.dataset.id ? buyUp(b.dataset.id) : buyDecor(b.dataset.d); });
}
function buyUp(id) {
  const u = shopItems().find(q => q.id === id); if (!u || u.lock || u.lv >= u.max || u.ok === false) return false;
  if (P.coins < u.cost) { SND.no(); return false; }
  P.coins -= u.cost; P.up[id] = (P.up[id] || 0) + 1; saveP(); SND.buy(); buzz(15);
  refreshUnlocks(); const st = stations[id] || stations[id.split('_')[0]];
  if (st) { squash(st.o, 0.14); sparkle(st.anchor, 12); }
  renderLobby(); return true;
}
function buyDecor(id) {
  const d = DECOR.find(q => q.id === id); if (!d || P.decor.includes(id)) return false;
  if (P.coins < d.cost) { SND.no(); return false; }
  P.coins -= d.cost; P.decor.push(id); saveP(); SND.buy(); buzz(15); placeDecor(d, true); renderLobby(); return true;
}
const popIn = [];
function placeDecor(d, fresh) {
  if (decorObjs[d.id]) return;
  const os = [mk(d.id, d.size, d.pos[0], d.pos[2], d.rot)]; if (d.twin) os.push(mk(d.id, d.size, d.twin[0], d.twin[2], -d.rot + 0.4));
  decorObjs[d.id] = os;
  if (fresh) for (const o of os) { o.scale.setScalar(0.01); popIn.push({ o, t: 0, s: d.size }); confetti(scene, o.position.clone().add(V3(0, 1, 0)), 25); sparkle(o.position.clone().add(V3(0, 0.6, 0)), 10); }
}
function updatePop(dt) { for (let i = popIn.length - 1; i >= 0; i--) { const q = popIn[i]; q.t = Math.min(1, q.t + dt * 2.2); const e = 1 + Math.sin(q.t * Math.PI) * 0.3; q.o.scale.setScalar(q.s * Math.max(0.01, q.t < 1 ? q.t * e : 1)); if (q.t >= 1) popIn.splice(i, 1); } }

// ---------------------------------------------------------------- result cards
const winBox = document.createElement('div'); winBox.className = 'resbox'; ui.els.win.appendChild(winBox); ui.els.win.classList.add('res');
const loseBox = document.createElement('div'); loseBox.className = 'resbox'; ui.els.lose.appendChild(loseBox); ui.els.lose.classList.add('res');
const shareBtn = ui.els.win.querySelector('.hc-btn');
function showResult(won, stars, gift) {
  const box = won ? winBox : loseBox, s = Math.round(dayT);
  box.innerHTML = `<div class="rt">${D.seed ? 'Daily harvest' : `Day ${day.L}`}</div><h2>${won ? ['', 'Good harvest!', 'Great harvest!', 'Golden harvest!'][stars] : 'The sun set!'}</h2>
    ${won ? '<div class="stars"><span>★</span><span>★</span><span>★</span></div>' : `<div style="font:600 16px 'Baloo 2';margin:4px 0 8px">The truck left with ${day.n - shipped} order${day.n - shipped === 1 ? '' : 's'} to go. More fields and animals in the farm shop help!</div>`}
    <div class="rl"><span>Orders shipped</span><b>${shipped}/${day.n}</b></div>
    <div class="rl"><span>Time</span><b>${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}</b></div>
    ${charm() ? `<div class="rl"><span>Farm charm bonus</span><b>+${charm() * 3}%</b></div>` : ''}
    <div class="rl tot"><span>Earned</span><b><span class="coin"></span>${dayCoins}</b></div>
    ${gift ? `<div class="gift">🎁 ${gift}</div>` : ''}<div class="slot"></div><div class="tapc">Tap to continue</div>`;
  if (won && shareBtn) box.querySelector('.slot').appendChild(shareBtn);
  if (won) { ui.win(day.L, ''); const ss = box.querySelectorAll('.stars span'); for (let i = 0; i < stars; i++) setTimeout(() => { ss[i].classList.add('on'); SND.star(i); buzz(10); }, 900 + i * 380); }
  else ui.lose('The sun set!', '');
}
ui.onTap(which => {
  unlock();
  if (which === 'start') { startDay(); return; }
  state = 'ready'; renderLobby(); ui.start(); fplay('cheer'); fCheer = 1.6;
});

// ---------------------------------------------------------------- what to do next: the bot plays it, new players see a pointing hand
function pending(k) {
  let n = 0;
  if (CROP[k]) for (const p of plots) if (p.crop === k) n += 2;
  if (REC[k]) for (const s of [stations.mill, stations.oven]) { for (const j of s.q) if (j.r === k) n += REC[k].out; for (const r of s.done) if (r === k) n += REC[k].out; }
  for (const a of animals) if (a.def.out === k && (a.state === 'eat' || a.state === 'ready')) n++;
  for (const [s0, d] of Object.entries(AUTO)) if (d.out === k && stations[s0].open) n += stations[s0].ready || 0;
  return n;
}
function deficits() {
  const req = {};
  for (const o of orders) if (o && !o.gone) for (const l of o.lines) req[l.k] = (req[l.k] || 0) + l.n;
  // also look one order ahead so the farm never idles
  if (day && day.next < day.n) for (const l of day.specs[day.next].lines) req[l.k] = (req[l.k] || 0) + Math.ceil(l.n / 2);
  const short = k => Math.max(0, (req[k] || 0) - (inv[k] || 0) - pending(k));
  for (const r of ['cake', 'cupcake', 'pancake', 'bread']) { const m = short(r); if (m > 0) for (const [i, n] of Object.entries(REC[r].in)) req[i] = (req[i] || 0) + n * m; }
  let feedNeed = 0;
  for (const [a, d] of Object.entries(ANIM)) { const m = short(d.out); if (m > 0) feedNeed += Math.min(m, animals.filter(q => q.key === a && q.state === 'hungry').length); }
  req.feed = (req.feed || 0) + feedNeed;
  const fm = short('feed'); if (fm > 0) { const c = Math.ceil(fm / 2); req.wheat = (req.wheat || 0) + c; req.corn = (req.corn || 0) + c; }
  const out = {}; for (const k of Object.keys(req)) out[k] = short(k);
  return out;
}
function suggest() {
  for (let i = 0; i < 3; i++) if (canShip(orders[i]) && !orders[i].gone) return { ship: i };
  for (const s of Object.values(stations)) if (s.open && ((s.kind === 'prod' && s.done.length) || (s.kind === 'auto' && s.ready) || (s.kind === 'pen' && penAnimals(s).some(a => a.state === 'ready')))) return { st: s };
  const ripe = plots.find(p => p.state === 'ripe'); if (ripe) return { harvest: ripe };
  const def = deficits();
  for (const s of [stations.yard, stations.cowPen, stations.sheepPen]) if (s.open && inv.feed > 0 && def[ANIM[s.key].out] > 0 && penAnimals(s).some(a => a.state === 'hungry')) return { st: s };
  for (const r of ['cake', 'cupcake', 'pancake', 'bread', 'feed']) { const R0 = REC[r], s = stations[R0.at]; if (R0.lvl <= curL() && s.open && def[r] > 0 && canMake(r) && s.q.length < prodSlots(s.key) && s.q.filter(j => j.r === r).length * R0.out < def[r]) return { make: r, st: s }; }
  const empty = plots.find(p => p.open && p.state === 'empty');
  if (empty) {
    const open = cropsOpen(); let best = null, bv = 0;
    for (const k of open) if ((def[k] || 0) > bv) { bv = def[k]; best = k; }
    if (!best) { const g = {}; for (const p of plots) if (p.crop) g[p.crop] = (g[p.crop] || 0) + 1; best = (g.wheat || 0) <= (g.corn || 0) || curL() < 2 ? 'wheat' : 'corn'; }
    return { plant: empty, crop: best };
  }
  return null;
}
function act(g) {
  if (g.ship !== undefined) return ship(g.ship);
  if (g.harvest) return harvest(g.harvest);
  if (g.make) return enqueue(g.st, g.make);
  if (g.plant) return plant(g.plant, g.crop);
  if (g.st) return tapStation(g.st);
  return false;
}
const hintEl = document.createElement('div'); hintEl.id = 'hint'; hintEl.innerHTML = '<i>👆</i><b></b>'; hintEl.style.display = 'none'; document.body.appendChild(hintEl);
let idleT = 0;
addEventListener('pointerdown', () => { idleT = 0; hintEl.style.display = 'none'; }, true);
function updateHint(dt) {
  const teach = state === 'play' && !D.seed && day && (day.L <= 2 || (day.L <= 4 && shipped === 0));
  if (!teach || !POP.hidden) { hintEl.style.display = 'none'; return; }
  idleT += dt; if (idleT < (shipped ? 3.5 : 1.8)) { hintEl.style.display = 'none'; return; }
  const g = suggest(); if (!g) { hintEl.style.display = 'none'; return; }
  let sx, sy, txt;
  if (g.ship !== undefined) { const r = ORD[g.ship].getBoundingClientRect(); sx = r.left + r.width / 2; sy = r.top + 10; txt = 'Ship it!'; }
  else { const pos = g.harvest ? g.harvest.pos : g.plant ? g.plant.pos : g.st.anchor; [sx, sy] = toScreen(pos); txt = g.harvest ? 'Harvest' : g.plant ? 'Plant ' + IT[g.crop].n.toLowerCase() : g.make ? 'Make ' + IT[g.make].n.toLowerCase() : g.st.kind === 'pen' ? 'Feed / collect' : 'Collect'; }
  hintEl.style.display = ''; hintEl.style.transform = `translate(${sx}px,${sy}px)`; hintEl.querySelector('b').textContent = txt;
}

// ---------------------------------------------------------------- station tags (ready bubbles, progress rings, locks)
function updateTags() {
  const show = state === 'play' && camBlend > 0.97;
  for (const s of Object.values(stations)) {
    let html = '';
    if (show) {
      if (!s.open) { if (s.kind !== 'barn' && s.kind !== 'stand' && s.lvl <= curL() + 2) html = `<div class="lk">🔒 Day ${s.lvl}</div>`; }
      else if (s.kind === 'prod') {
        if (s.done.length) { const r = s.done[s.done.length - 1]; html = `<div class="rdy"><img alt="" src="${ICON(IT[r].i)}">${s.done.length > 1 ? '×' + s.done.length : ''}</div>`; }
        else if (s.q.length) { const j = s.q[0]; html = ringHTML(Math.min(1, j.t / j.dur), IT[j.r].i) + `<div class="q">${s.q.slice(1).map(q => `<img alt="" src="${ICON(IT[q.r].i)}">`).join('')}</div>`; }
      } else if (s.kind === 'pen') {
        const as = penAnimals(s), rd = as.filter(a => a.state === 'ready').length, eat = as.filter(a => a.state === 'eat'), hun = as.filter(a => a.state === 'hungry').length;
        if (rd) html = `<div class="rdy"><img alt="" src="${ICON(IT[ANIM[s.key].out].i)}">×${rd}</div>`;
        else if (eat.length) { const f = Math.max(...eat.map(a => a.t / a.dur)); html = ringHTML(Math.min(1, f), IT[ANIM[s.key].out].i); }
        else if (hun) html = `<div class="rdy hungry"><img alt="" src="${ICON('g12')}"><b>Feed me</b></div>`;
      } else if (s.kind === 'auto') {
        if (s.ready) html = `<div class="rdy"><img alt="" src="${ICON(IT[AUTO[s.key].out].i)}">×${s.ready}</div>`;
        else html = ringHTML(s.t / AUTO[s.key].t, IT[AUTO[s.key].out].i);
      }
    }
    setTag(s, html);
    if (!html) { s.tag.style.display = 'none'; continue; }
    s.tag.style.display = '';
    const [sx, sy] = toScreen(_tp.set(s.anchor.x, s.tagY || s.anchor.y + 1, s.anchor.z));
    s.tag.style.transform = `translate(${sx}px,${sy}px) translate(-50%,-100%)`;
  }
}
const _tp = V3(0, 0, 0);

// ---------------------------------------------------------------- test hooks + bot
window.__game = {
  _tris() { const out = []; scene.traverse(o => { if (!o.isMesh || !o.visible) return; let v = true, q = o; while (q) { if (!q.visible) v = false; q = q.parent; } if (!v) return; const g = o.geometry, t = (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); out.push([(o.name || o.type) + ':' + g.type + ':' + (o.material.color ? o.material.color.getHexString() : '') + ':' + (o.parent && o.parent.type), Math.round(t), o.castShadow ? 'S' : '']); }); out.sort((a, b) => b[1] - a[1]); return { total: out.reduce((a, b) => a + b[1], 0), shadowed: out.filter(x => x[2]).reduce((a, b) => a + b[1], 0), top: out.slice(0, 25) }; },
  get plots() { return plots.map(p => p.open ? (p.crop ? p.crop[0] + p.state[0] : '.') : 'x').join(''); },
  _scr(i) { const p = plots[i]; return p ? toScreen(p.pos) : null; }, _stScr(k) { return toScreen(stations[k].anchor); },
  perf: () => ({ calls: R.info.render.calls, tris: R.info.render.triangles, geo: R.info.memory.geometries, tex: R.info.memory.textures }),
  get state() { return state === 'loading' ? 'ready' : state; }, get level() { return curL(); },
  get score() { return state === 'play' ? shipped : Object.values(P.stars).reduce((a, b) => a + b, 0); },
  get coins() { return P.coins; }, get inv() { return { ...inv }; }, get orders() { return orders.map(o => o && !o.gone ? o.lines.map(l => l.k + 'x' + l.n).join('+') : null); },
  get day() { return day && { L: day.L, n: day.n, T: day.T, t: Math.round(dayT), shipped }; },
  start: () => { ui.hideStart(); startDay(); },
  // the arcade shell calls this until state is 'play': skip the lobby/result card and start the next day
  autostart() {
    if (state === 'loading' || !world) return false;
    if (state === 'play') return true;
    for (const el of [ui.els.start, ui.els.win, ui.els.lose]) el.classList.add('hc-hidden');
    $('sheet').hidden = true; state = 'ready'; startDay();
    return state === 'play';
  },
  bot() {
    if (state === 'loading') return;
    if (state === 'ready') {
      if (Math.random() < 0.5) { const u = shopItems().filter(q => !q.lock && q.ok !== false && q.lv < q.max && q.cost <= P.coins).sort((a, b) => a.cost - b.cost)[0]; if (u) { buyUp(u.id); return; } }
      const d = DECOR.find(q => !P.decor.includes(q.id) && q.cost <= P.coins * 0.5); if (d) { buyDecor(d.id); return; }
      ui.hideStart(); startDay(); return;
    }
    if (state !== 'play') return;
    const g = suggest();
    if (dayT > day.T * 0.55 && shipped < day.n * 0.6 && Math.random() < 0.05) { if (P.boost.rain && plots.some(p => p.state === 'grow')) { useRain(); return; } if (P.boost.hurry) { useHurry(); return; } }
    if (g) act(g);
  },
};

// ---------------------------------------------------------------- boot
loop((dt60) => {
  const dt = dt60 / 60;
  if (world) {
    updateDay(dt); updateCrops(); updateTruck(dt); updateFarmer(dt); updateTweens(dt); updateSprites(dt); updatePop(dt); updateVisitors(dt); updateSun(); updateTags();
    if (state !== 'play') updateAnimals(dt, false);
    if (farmer) farmer.k.mixer.update(dt);
    if (day) updateHint(dt);
    if (!POP.hidden && popFor && !drag) { popT += dt; if (popT > 6) closePop(); }
  }
  updateCam(dt);
  R.info.reset(); C.render(dt);
});

(async function boot() {
  startEl.style.pointerEvents = 'none';
  await MeshoptSimplifier.ready.catch(() => {});
  await Promise.all(MODEL_IDS.map(id => loader.loadAsync(`./assets/${id}.glb`).then(g => { GEO[id] = prep(g.scene, id); prog(); })));
  buildFarm(); refreshUnlocks();
  for (const d of DECOR) if (P.decor.includes(d.id)) placeDecor(d, false);
  await Promise.all([loadVisitors(), buildFarmer().then(prog)]);
  state = 'ready'; renderLobby();
  startEl.style.pointerEvents = '';
  $('load').classList.add('gone'); setTimeout(() => $('load').remove(), 600);
  if (wantStart) { ui.hideStart(); startDay(); }
})();
