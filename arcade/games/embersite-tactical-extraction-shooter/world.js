// Embersite world: Halvard Valley at golden hour. Terrain from SimplexNoise, a concrete dam holding a lake, the Kessel
// radar station, a forest relay outpost, power pylons, instanced pine forest + wind grass, valley fog, Sky.js sunset.
// Also owns collision (terrain, oriented boxes, tree trunks) and ray / line-of-sight queries.
import { THREE, procTex } from './kit/cine.js';
import { SimplexNoise } from './kit/addons/math/SimplexNoise.js';
import { mergeGeometries } from './kit/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from './kit/addons/geometries/RoundedBoxGeometry.js';
import { RAMP, outline } from './models.js';
const toonOf = m => { const t = new THREE.MeshToonMaterial({ gradientMap: RAMP, color: m.color, map: m.map, emissive: m.emissive, emissiveIntensity: m.emissiveIntensity, emissiveMap: m.emissiveMap, transparent: m.transparent, alphaTest: m.alphaTest, side: m.side, vertexColors: m.vertexColors, polygonOffset: m.polygonOffset, polygonOffsetFactor: m.polygonOffsetFactor }); return t; };

export const SIZE = 720, SEG = 288, STEP = SIZE / SEG, HALF = SIZE / 2;
export const DAM_Z = -40, LAKE_Y = 14.2, RIVER_Y = 0.55, CREST = 22, BOUND = 262;
export const mulberry = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const V3 = THREE.Vector3;

const nz = new SimplexNoise({ random: mulberry(9) });
export const riverX = z => -20 + 35 * Math.sin(z * 0.008) + 15 * Math.sin(z * 0.021 + 1);
export const DAM_X = riverX(DAM_Z);
export const BASE = { x: 150, z: 62, r: 46 };
export const RELAY = { x: -165, z: 112, r: 22 };
export const PYLONS = [{ x: -132, z: -6 }, { x: 72, z: -158 }, { x: 78, z: 176 }];
export const LZS = [{ x: -196, z: 34, name: 'LZ WILLOW' }, { x: 96, z: 206, name: 'LZ MAGPIE' }, { x: 214, z: -38, name: 'LZ HOLLOW' }, { x: -168, z: -150, name: 'LZ CINDER' }];
export const SPAWNS = [{ x: -78, z: 62, yaw: 2.6 }, { x: 38, z: 124, yaw: 3.1 }, { x: 210, z: 150, yaw: 2.4 }, { x: -60, z: -180, yaw: 0.2 }, { x: -205, z: -40, yaw: 1.4 }];
// road: dam east abutment → base gate, plus a spur to the relay outpost
export const ROADS = [
  [[DAM_X + 92, DAM_Z + 2], [DAM_X + 120, DAM_Z + 10], [60, 10], [92, 46], [BASE.x - 52, BASE.z]],
  [[DAM_X - 92, DAM_Z + 2], [-125, -26], [-150, 30], [-162, 80], [RELAY.x + 6, RELAY.z - 16]],
];
const segDist = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz; let t = l ? ((px - ax) * dx + (pz - az) * dz) / l : 0; t = clamp(t, 0, 1); const qx = ax + dx * t - px, qz = az + dz * t - pz; return [Math.sqrt(qx * qx + qz * qz), ax + dx * t, az + dz * t]; };
export function roadDist(x, z) { let best = [1e9, 0, 0]; for (const R of ROADS) for (let i = 0; i < R.length - 1; i++) { const d = segDist(x, z, R[i][0], R[i][1], R[i + 1][0], R[i + 1][1]); if (d[0] < best[0]) best = d; } return best; }

function hills(x, z) {
  let f = 0, amp = 1, fr = 1 / 230;
  for (let i = 0; i < 5; i++) { f += nz.noise(x * fr + i * 17.3, z * fr - i * 9.1) * amp; amp *= 0.5; fr *= 2.03; }
  let h = 28 + f * 14;
  const r = 1 - Math.abs(nz.noise(x / 170 + 40, z / 170)); h += r * r * 12 - 5;
  const d = Math.abs(x - riverX(z)), north = z < DAM_Z;
  const floor = north ? 2.5 + nz.noise(x / 40, z / 40) * 1.5 : -0.8 + nz.noise(x / 25, z / 25) * 0.35;
  const v = smooth(north ? 88 : 62, 13, d);
  h = h * (1 - v) + floor * v;
  const dz = Math.abs(z - DAM_Z);   // crest-level shoulders where the dam meets the hills
  const s = smooth(34, 12, dz) * smooth(66, 77, d) * (1 - smooth(120, 150, d));
  h = h * (1 - s) + (CREST + 0.05) * s;
  return h;
}
const FLATS = [{ ...BASE, r0: 64 }, { ...RELAY, r0: 34 }, ...PYLONS.map(p => ({ ...p, r: 9, r0: 18 })), ...LZS.map(p => ({ ...p, r: 13, r0: 26 }))];
for (const f of FLATS) f.h = Math.max(hills(f.x, f.z), f === FLATS[0] ? 0 : 3) + (f === FLATS[0] ? 1 : 0);
export function rawH(x, z) {
  let h = hills(x, z);
  const [rd, qx, qz] = roadDist(x, z);
  if (rd < 12) { const rh = hills(qx, qz); h = h + (rh - h) * smooth(11, 4, rd); }
  for (const f of FLATS) { const d = Math.hypot(x - f.x, z - f.z); if (d < f.r0) h = h + (f.h - h) * smooth(f.r0, f.r, d); }
  const r = Math.hypot(x, z); if (r > 250) h += Math.pow((r - 250) / 10, 1.5) * 1.7;
  return h;
}

// ------------------------------------------------------------------ textures (canvas, no files)
function canvasTex(n, draw, repeat = 1, srgb = true) {
  const c = document.createElement('canvas'); c.width = c.height = n; draw(c.getContext('2d'), n);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
}
const R0 = mulberry(77), rr = (a, b) => a + R0() * (b - a);
function detailTex() {
  return canvasTex(512, (x, n) => {
    x.fillStyle = '#d8d8d8'; x.fillRect(0, 0, n, n);
    for (let i = 0; i < 9000; i++) { const v = rr(150, 255) | 0; x.fillStyle = `rgba(${v},${v},${v},${rr(.08, .3)})`; const s = rr(1, 4); x.fillRect(rr(0, n), rr(0, n), s, s); }
    for (let i = 0; i < 260; i++) { x.strokeStyle = `rgba(60,50,30,${rr(.05, .18)})`; x.lineWidth = rr(.5, 1.6); x.beginPath(); const px = rr(0, n), py = rr(0, n); x.moveTo(px, py); x.lineTo(px + rr(-9, 9), py + rr(-14, 2)); x.stroke(); }
  }, 1);
}
function waterNormal() {
  const n = 256, c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d'), img = x.createImageData(n, n);
  const W = []; const r = mulberry(5); for (let i = 0; i < 14; i++) W.push([Math.floor(r() * 7) + 1, Math.floor(r() * 7) - 3, r() * 6.28, 0.5 / (i + 2)]);
  const hgt = (u, v) => { let h = 0; for (const [a, b, p, amp] of W) h += Math.sin((u * a + v * b) * 6.2832 + p) * amp; return h; };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const u = i / n, v = j / n, e = 1 / n, dx = hgt(u + e, v) - hgt(u - e, v), dy = hgt(u, v + e) - hgt(u, v - e);
    const N = new V3(-dx * 3, -dy * 3, 1).normalize(), k = (j * n + i) * 4;
    img.data[k] = (N.x * .5 + .5) * 255; img.data[k + 1] = (N.y * .5 + .5) * 255; img.data[k + 2] = (N.z * .5 + .5) * 255; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
export function textTex(lines, { w = 512, h = 256, bg = '#e8e2d0', fg = '#1b1b1b', stripe = null, font = 'bold 64px "Barlow Condensed", Arial Narrow, sans-serif' } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  if (stripe) { x.save(); x.beginPath(); x.rect(0, h - 40, w, 40); x.clip(); for (let i = -40; i < w; i += 40) { x.fillStyle = stripe; x.beginPath(); x.moveTo(i, h); x.lineTo(i + 20, h); x.lineTo(i + 60, h - 40); x.lineTo(i + 40, h - 40); x.fill(); } x.restore(); }
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
  lines.forEach((l, i) => { x.font = i === 0 ? font : font.replace(/\d+px/, m => Math.round(parseInt(m) * .55) + 'px'); x.fillText(l, w / 2, h * (lines.length === 1 ? .45 : .32 + i * .3)); });
  for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(80,60,40,${Math.random() * .12})`; x.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function hazardTex() { return canvasTex(128, (x, n) => { x.fillStyle = '#e0a420'; x.fillRect(0, 0, n, n); x.fillStyle = '#1a1a1a'; for (let i = -n; i < n * 2; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 16, 0); x.lineTo(i + 16 - n, n); x.lineTo(i - n, n); x.fill(); } }); }
function ribTex(col) { return canvasTex(256, (x, n) => { x.fillStyle = col; x.fillRect(0, 0, n, n); for (let i = 0; i < n; i += 16) { x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(i, 0, 4, n); x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(i + 5, 0, 3, n); } for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? '90,50,20' : '0,0,0'},${Math.random() * .12})`; x.fillRect(Math.random() * n, Math.random() * n, 2 + Math.random() * 6, 2 + Math.random() * 10); } }); }
function fenceTex() { return canvasTex(128, (x, n) => { x.clearRect(0, 0, n, n); x.strokeStyle = 'rgba(170,170,165,1)'; x.lineWidth = 3; for (let i = -n; i < 2 * n; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + n, n); x.moveTo(i + n, 0); x.lineTo(i, n); x.stroke(); } }); }
function windowTex() { return canvasTex(256, (x, n) => { x.fillStyle = '#6f6a60'; x.fillRect(0, 0, n, n); for (let j = 0; j < 2; j++) for (let i = 0; i < 4; i++) { const lit = Math.random() < .45; x.fillStyle = '#2b2a28'; x.fillRect(i * 64 + 10, j * 128 + 30, 44, 60); x.fillStyle = lit ? '#ffcf86' : '#1d2a33'; x.fillRect(i * 64 + 13, j * 128 + 33, 38, 54); x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(i * 64 + 31, j * 128 + 33, 2, 54); } for (let i = 0; i < 2000; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * .1})`; x.fillRect(Math.random() * n, Math.random() * n, 2, 2 + Math.random() * 8); } }); }
function softDot(inner = 'rgba(255,255,255,1)') { return canvasTex(64, (x, n) => { const g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); g.addColorStop(0, inner); g.addColorStop(.3, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); }); }

// ------------------------------------------------------------------ geometry helpers
export function boxGeo(w, h, d, uvm = 3) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / uvm, uv.getY(i) * dims[f][1] / uvm); }
  return g;
}
const EUL = new THREE.Euler(), QT = new THREE.Quaternion(), ONE = new V3(1, 1, 1);
const compose = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new V3(x, y, z), QT.setFromEuler(EUL.set(rx, ry, rz)), new V3(sx, sy, sz));
// Builds static props into one merged mesh per material; records colliders in world space.
export class Kit {
  constructor(world) { this.w = world; this.buckets = new Map(); this.m = new THREE.Matrix4(); this.yaw = 0; this.stack = []; }
  push(x, y, z, ry = 0) { this.stack.push([this.m.clone(), this.yaw]); this.m.multiply(compose(x, y, z, 0, ry, 0)); this.yaw += ry; return this; }
  pop() { [this.m, this.yaw] = this.stack.pop(); return this; }
  geo(g, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    g = g.index ? g.toNonIndexed() : g.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(this.m.clone().multiply(compose(x, y, z, rx, ry, rz, sx, sy, sz)));
    if (!this.buckets.has(mat)) this.buckets.set(mat, []); this.buckets.get(mat).push(g); return this;
  }
  box(mat, w, h, d, x, y, z, ry = 0, col = false, uvm = 3, rx = 0, rz = 0) {
    this.geo(boxGeo(w, h, d, uvm), mat, x, y, z, rx, ry, rz);
    if (col) { const p = new V3(x, y, z).applyMatrix4(this.m); this.w.addBox(p.x, p.z, w / 2, d / 2, this.yaw + ry, p.y - h / 2, p.y + h / 2); }
    return this;
  }
  cyl(mat, rt, rb, h, x, y, z, seg = 12, rx = 0, ry = 0, rz = 0, col = false) {
    this.geo(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, rx, ry, rz);
    if (col) { const p = new V3(x, y, z).applyMatrix4(this.m); this.w.addBox(p.x, p.z, rb * .9, rb * .9, this.yaw, p.y - h / 2, p.y + h / 2); }
    return this;
  }
  beam(mat, a, b, t = 0.12) {           // a thin box from point a to point b (local coords)
    const d = new V3().subVectors(b, a), L = d.length(), mid = new V3().addVectors(a, b).multiplyScalar(.5);
    const g = boxGeo(t, t, L, 2); const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 0, 1), d.normalize());
    g.applyMatrix4(new THREE.Matrix4().compose(mid, q, ONE)); return this.geo(g, mat);
  }
  build(scene, { shadow = true, receive = true } = {}) {
    const out = [];
    for (const [mat, list] of this.buckets) { const g = mergeGeometries(list); g.computeBoundingSphere(); const m = new THREE.Mesh(g, mat); m.castShadow = shadow && !mat.transparent; m.receiveShadow = receive; m.matrixAutoUpdate = false; scene.add(m); out.push(m);
      if (!mat.transparent && !(mat.emissiveIntensity > 1) && mat !== this.w.mats.cable) { const o = outline(m, .05); o.matrixAutoUpdate = false; } }
    this.buckets.clear(); return out;
  }
}

// ------------------------------------------------------------------ the world
export function createWorld(scene, renderer, { lite = false } = {}) {
  const W = { boxes: [], trees: [], rocks: [], cover: [], smokes: [], lights: [], spin: [], blink: [], props: {}, time: 0 };
  const N1 = SEG + 1, H = new Float32Array(N1 * N1);
  for (let j = 0; j < N1; j++) for (let i = 0; i < N1; i++) H[j * N1 + i] = rawH(-HALF + i * STEP, -HALF + j * STEP);
  // exact height of the rendered triangle under (x,z)
  W.h = (x, z) => {
    const gx = clamp((x + HALF) / STEP, 0, SEG - 0.001), gz = clamp((z + HALF) / STEP, 0, SEG - 0.001), i = gx | 0, j = gz | 0, fx = gx - i, fz = gz - j;
    const h00 = H[j * N1 + i], h10 = H[j * N1 + i + 1], h01 = H[(j + 1) * N1 + i], h11 = H[(j + 1) * N1 + i + 1];
    return fx + fz < 1 ? h00 + (h10 - h00) * fx + (h01 - h00) * fz : h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
  };
  W.normal = (x, z, out = new V3()) => out.set(W.h(x - 1, z) - W.h(x + 1, z), 2, W.h(x, z - 1) - W.h(x, z + 1)).normalize();
  W.waterY = (x, z) => z < DAM_Z - 3.5 ? LAKE_Y : z > DAM_Z + 3 ? RIVER_Y : -99;
  W.depth = (x, z) => W.waterY(x, z) - W.h(x, z);

  // ---- sky, sun, light, environment
  const sunDir = new V3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 34), THREE.MathUtils.degToRad(318));
  W.sunDir = sunDir;
  // stylised gradient sky dome (bright zenith blue → pale horizon, warm glow + disc around the sun)
  const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uSun: { value: sunDir }, uZen: { value: new THREE.Color('#1a5fd6') }, uHor: { value: new THREE.Color('#9dd3ff') }, uGlow: { value: new THREE.Color('#fff1c8') }, uGnd: { value: new THREE.Color('#9cc7e6') } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position = p.xyww; }',
    fragmentShader: `uniform vec3 uSun, uZen, uHor, uGlow, uGnd; varying vec3 vD;
      void main(){ vec3 d = normalize(vD); float h = d.y; vec3 c = h > 0. ? mix(uHor, uZen, pow(smoothstep(0., .75, h), .6)) : mix(uHor, uGnd, smoothstep(0., -.2, h));
        float s = max(dot(d, uSun), 0.); c += uGlow * (pow(s, 12.) * .55 + pow(s, 120.) * .8) + vec3(1., .95, .85) * smoothstep(.9994, .9997, s) * 6.;
        gl_FragColor = vec4(c, 1.); }` });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2000, 32, 16), skyMat); sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);
  const pm = new THREE.PMREMGenerator(renderer), envScene = new THREE.Scene(); envScene.add(new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), skyMat));
  const gnd = new THREE.Mesh(new THREE.CircleGeometry(800, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x5f9a3a })); gnd.position.y = -5; envScene.add(gnd);
  scene.environment = pm.fromScene(envScene, 0.02, 1, 3000).texture; scene.environmentIntensity = 0.75; pm.dispose();
  const sun = new THREE.DirectionalLight(0xfff0d6, 3.1); sun.castShadow = true;
  const ss = lite ? 1024 : 2048; sun.shadow.mapSize.set(ss, ss); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.06;
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 400 }); sun.shadow.camera.updateProjectionMatrix();
  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x6f8f45, 1.05);
  scene.add(sun, sun.target, hemi); W.sun = sun;
  W.fogColor = new THREE.Color('#a6d6ff');
  scene.fog = new THREE.FogExp2(W.fogColor, 0.0016);
  W.followSun = p => { sun.target.position.set(Math.round(p.x / 4) * 4, p.y, Math.round(p.z / 4) * 4); sun.position.copy(sun.target.position).addScaledVector(sunDir, 200); };
  // stylised cloud puffs (one merged mesh, unfogged)
  { const parts = [], rc = mulberry(88);
    for (let i = 0; i < 18; i++) { const a = rc() * 6.28, d = 380 + rc() * 300, cx = Math.cos(a) * d, cz = Math.sin(a) * d, cy = 130 + rc() * 90, n = 4 + (rc() * 4 | 0), sc = 1 + rc() * 1.4;
      for (let k = 0; k < n; k++) { const g = new THREE.IcosahedronGeometry((10 + rc() * 9) * sc, 2); g.scale(1, .72, 1); g.translate(cx + (k - n / 2) * 13 * sc + rc() * 6, cy + rc() * 8 * sc, cz + rc() * 10); parts.push(g); } }
    const cg = mergeGeometries(parts.map(g => g.index ? g.toNonIndexed() : g));
    const cm = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: RAMP, emissive: 0xdde8ff, emissiveIntensity: .7, fog: false });
    const clouds = new THREE.Mesh(cg, cm); clouds.matrixAutoUpdate = true; scene.add(clouds); W.clouds = clouds; }
  // ---- terrain
  {
    const pos = new Float32Array(N1 * N1 * 3), col = new Float32Array(N1 * N1 * 3), uv = new Float32Array(N1 * N1 * 2);
    const cGrass = new THREE.Color('#5aa83a'), cDry = new THREE.Color('#9cc24a'), cMoss = new THREE.Color('#3f8a36'), cRock = new THREE.Color('#a39a88'), cDirt = new THREE.Color('#c79a62'), cSand = new THREE.Color('#ead59c'), cBed = new THREE.Color('#5aa6a0'), cRoad = new THREE.Color('#d2aa72'), c = new THREE.Color();
    for (let j = 0; j < N1; j++) for (let i = 0; i < N1; i++) {
      const k = j * N1 + i, x = -HALF + i * STEP, z = -HALF + j * STEP, h = H[k];
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z; uv[k * 2] = x / 7; uv[k * 2 + 1] = z / 7;
      const hx = H[j * N1 + Math.min(i + 1, SEG)] - H[j * N1 + Math.max(i - 1, 0)], hz = H[Math.min(j + 1, SEG) * N1 + i] - H[Math.max(j - 1, 0) * N1 + i];
      const slope = Math.hypot(hx, hz) / (2 * STEP);
      const n1 = nz.noise(x / 60, z / 60), n2 = nz.noise(x / 13 + 5, z / 13);
      c.copy(cGrass).lerp(cDry, clamp(.5 + n1 * .6, 0, 1)).lerp(cMoss, clamp(n2 * .5, 0, .5));
      c.lerp(cDirt, clamp(n2 * .8 - .3, 0, .5));
      c.lerp(cRock, smooth(.8, 1.25, slope + n2 * .15));
      const wy = W.waterY(x, z);
      if (h < wy + 1.2) c.lerp(cSand, smooth(wy + 1.2, wy + .2, h)); if (h < wy - .2) c.lerp(cBed, smooth(wy - .2, wy - 2, h));
      const rd = roadDist(x, z)[0]; if (rd < 6) c.lerp(cRoad, smooth(6, 3, rd) * (.85 + n2 * .15));
      for (const f of FLATS.slice(1)) { const d = Math.hypot(x - f.x, z - f.z); if (d < f.r) c.lerp(cDirt, smooth(f.r, f.r * .5, d) * .7); }
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
    }
    const idx = new Uint32Array(SEG * SEG * 6); let q = 0;
    for (let j = 0; j < SEG; j++) for (let i = 0; i < SEG; i++) { const a = j * N1 + i, b = a + 1, d = a + N1, e = d + 1; idx[q++] = a; idx[q++] = d; idx[q++] = b; idx[q++] = d; idx[q++] = e; idx[q++] = b; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, map: detailTex(), roughness: .96, metalness: 0 }));
    m.receiveShadow = true; m.matrixAutoUpdate = false; scene.add(m); W.terrain = m;
  }

  // ---- water: lake behind the dam + river below it
  {
    const nrm = waterNormal(); nrm.repeat.set(26, 26);
    const wm = new THREE.MeshStandardMaterial({ color: 0x2bb3d6, roughness: .08, metalness: .05, normalMap: nrm, normalScale: new THREE.Vector2(.35, .35), transparent: true, opacity: .88, envMapIntensity: 1.2 });
    const lake = new THREE.Mesh(new THREE.PlaneGeometry(720, 360 + DAM_Z - 3.5).rotateX(-Math.PI / 2), wm); lake.position.set(0, LAKE_Y, (-360 + DAM_Z - 3.5) / 2);
    const river = new THREE.Mesh(new THREE.PlaneGeometry(720, 360 - DAM_Z - 3).rotateX(-Math.PI / 2), wm); river.position.set(0, RIVER_Y, (360 + DAM_Z + 3) / 2);
    lake.receiveShadow = river.receiveShadow = true; scene.add(lake, river); W.water = wm;
  }

  // ---- materials for structures
  const M = W.mats = {
    concrete: new THREE.MeshStandardMaterial({ map: procTex('concrete', { color: '#d9d2c2' }), roughness: .85, metalness: 0 }),
    darkcon: new THREE.MeshStandardMaterial({ map: procTex('concrete', { color: '#a7a094' }), roughness: .95 }),
    metal: new THREE.MeshStandardMaterial({ map: procTex('metal', { color: '#7b8794' }), roughness: .4, metalness: .6 }),
    rust: new THREE.MeshStandardMaterial({ map: procTex('rock', { color: '#c0602f' }), roughness: .8, metalness: .5 }),
    panel: new THREE.MeshStandardMaterial({ map: procTex('panel', { color: '#3c8f9a' }), roughness: .6, metalness: .6 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: .45, metalness: .1 }),
    red: new THREE.MeshStandardMaterial({ color: 0xe8462e, roughness: .5, metalness: .1 }),
    asphalt: new THREE.MeshStandardMaterial({ map: procTex('concrete', { color: '#55565c' }), roughness: .9 }),
    hazard: new THREE.MeshStandardMaterial({ map: hazardTex(), roughness: .6, metalness: .3 }),
    contRed: new THREE.MeshStandardMaterial({ map: ribTex('#e2532f'), roughness: .7, metalness: .4 }),
    contBlue: new THREE.MeshStandardMaterial({ map: ribTex('#2f7fd0'), roughness: .7, metalness: .4 }),
    contOlive: new THREE.MeshStandardMaterial({ map: ribTex('#5aa04a'), roughness: .7, metalness: .4 }),
    windows: new THREE.MeshStandardMaterial({ map: windowTex(), emissiveMap: null, roughness: .4, metalness: .2, emissive: 0x000000 }),
    fence: new THREE.MeshStandardMaterial({ map: fenceTex(), transparent: true, alphaTest: .4, side: THREE.DoubleSide, metalness: .6, roughness: .5 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0x221a10, emissive: 0xffc070, emissiveIntensity: 4 }),
    redLight: new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2a1a, emissiveIntensity: 6 }),
    cyan: new THREE.MeshStandardMaterial({ color: 0x002030, emissive: 0x3fd8ff, emissiveIntensity: 3 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x3a6f8f, roughness: .05, metalness: .6 }),
    wood: new THREE.MeshStandardMaterial({ map: procTex('rock', { color: '#b07a48' }), roughness: .9 }),
    rock: new THREE.MeshStandardMaterial({ map: procTex('rock', { color: '#a9a6b8' }), roughness: .9, flatShading: true }),
    cable: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: .6, metalness: .4 }),
  };
  M.windows.emissiveMap = M.windows.map; M.windows.emissive.set(0x8a7050); M.windows.emissiveIntensity = .35;
  for (const k of Object.keys(M)) if (k !== 'glass') M[k] = toonOf(M[k]);
  M.redLight.userData.blink = true; W.blink.push(M.redLight);

  // ---- collision boxes + spatial grid
  const CELL = 16, GN = Math.ceil(SIZE / CELL), grid = Array.from({ length: GN * GN }, () => ({ b: [], t: [] }));
  const cellsOf = (x, z, r) => { const out = []; const i0 = clamp(Math.floor((x - r + HALF) / CELL), 0, GN - 1), i1 = clamp(Math.floor((x + r + HALF) / CELL), 0, GN - 1), j0 = clamp(Math.floor((z - r + HALF) / CELL), 0, GN - 1), j1 = clamp(Math.floor((z + r + HALF) / CELL), 0, GN - 1); for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) out.push(grid[j * GN + i]); return out; };
  W.addBox = (cx, cz, hx, hz, yaw, y0, y1) => { const b = { cx, cz, hx, hz, c: Math.cos(yaw), s: Math.sin(yaw), y0, y1, i: W.boxes.length }; W.boxes.push(b); for (const c of cellsOf(cx, cz, Math.hypot(hx, hz))) c.b.push(b); return b; };
  W.addTree = (x, z, r, top, kind = 'tree') => { const t = { x, z, r, top, y0: W.h(x, z), kind }; W.trees.push(t); for (const c of cellsOf(x, z, r)) c.t.push(t); return t; };
  W.near = (x, z, r) => cellsOf(x, z, r);
  const toLocal = (b, x, z) => { const dx = x - b.cx, dz = z - b.cz; return [dx * b.c - dz * b.s, dx * b.s + dz * b.c]; };   // inverse yaw rotation
  W.groundAt = (x, z, feet = 1e9) => {
    let g = W.h(x, z);
    for (const c of cellsOf(x, z, 0)) for (const b of c.b) { if (b.y1 > feet + 0.75 || b.y1 <= g) continue; const [lx, lz] = toLocal(b, x, z); if (Math.abs(lx) <= b.hx + .15 && Math.abs(lz) <= b.hz + .15) g = b.y1; }
    return g;
  };
  // push a vertical capsule (x,z,radius, feet..feet+height) out of boxes and tree trunks; returns true if hit
  W.collide = (p, rad, feet, height) => {
    let hit = false;
    for (const c of cellsOf(p.x, p.z, rad + 1)) {
      for (const b of c.b) {
        if (b.y1 <= feet + 0.75 || b.y0 >= feet + height) continue;
        const [lx, lz] = toLocal(b, p.x, p.z), ex = b.hx + rad, ez = b.hz + rad;
        if (Math.abs(lx) >= ex || Math.abs(lz) >= ez) continue;
        let nx = 0, nzv = 0; const px = ex - Math.abs(lx), pz = ez - Math.abs(lz);
        if (px < pz) nx = Math.sign(lx) * px; else nzv = Math.sign(lz) * pz;
        // rotate local push back to world (yaw)
        p.x += nx * b.c + nzv * b.s; p.z += -nx * b.s + nzv * b.c; hit = true;
      }
      for (const t of c.t) { if (feet > t.y0 + t.top) continue; const dx = p.x - t.x, dz = p.z - t.z, d = Math.hypot(dx, dz), m = t.r + rad; if (d < m && d > 1e-4) { p.x += dx / d * (m - d); p.z += dz / d * (m - d); hit = true; } }
    }
    return hit;
  };
  const tmp = new V3();
  function rayBox(b, o, d, maxT) {   // slab test in the box's local frame
    const ox = o.x - b.cx, oz = o.z - b.cz, lx = ox * b.c - oz * b.s, lz = ox * b.s + oz * b.c, dx = d.x * b.c - d.z * b.s, dz = d.x * b.s + d.z * b.c;
    let t0 = 0, t1 = maxT, ax = -1;
    const sl = (oo, dd, lo, hi, axis) => { if (Math.abs(dd) < 1e-9) return oo >= lo && oo <= hi; let a = (lo - oo) / dd, bb = (hi - oo) / dd; if (a > bb) [a, bb] = [bb, a]; if (a > t0) { t0 = a; ax = axis; } if (bb < t1) t1 = bb; return t0 <= t1; };
    if (!sl(lx, dx, -b.hx, b.hx, 0) || !sl(o.y, d.y, b.y0, b.y1, 1) || !sl(lz, dz, -b.hz, b.hz, 2)) return null;
    if (t0 <= 0) return null;
    let n; if (ax === 1) n = new V3(0, Math.sign(-d.y), 0); else { const s = ax === 0 ? -Math.sign(dx) : -Math.sign(dz); const nl = ax === 0 ? [s, 0] : [0, s]; n = new V3(nl[0] * b.c + nl[1] * b.s, 0, -nl[0] * b.s + nl[1] * b.c); }
    return { t: t0, n };
  }
  // ray against terrain, water, boxes, trees. returns {t, p, n, kind} or null
  let stamp = 1;
  W.ray = (o, d, maxT, { water = true, trees = true, smoke = false } = {}) => {
    let best = null;
    // terrain march
    let prev = 0, step = 0.8, t = 0;
    const above = s => o.y + d.y * s - W.h(o.x + d.x * s, o.z + d.z * s);
    if (above(0) < 0) best = { t: 0, kind: 'terrain' };
    else while (t < maxT) {
      t = Math.min(maxT, t + step); step = Math.min(3, step * 1.08);
      if (above(t) < 0) { let a = prev, b = t; for (let k = 0; k < 7; k++) { const m = (a + b) / 2; if (above(m) < 0) b = m; else a = m; } best = { t: b, kind: 'terrain' }; break; }
      prev = t;
    }
    if (water) { for (const wy of [LAKE_Y, RIVER_Y]) { if (Math.abs(d.y) < 1e-6) continue; const tw = (wy - o.y) / d.y; if (tw > 0 && tw < (best ? best.t : maxT)) { tmp.copy(o).addScaledVector(d, tw); if (Math.abs(W.waterY(tmp.x, tmp.z) - wy) < .01 && W.h(tmp.x, tmp.z) < wy) best = { t: tw, kind: 'water' }; } } }
    // boxes + trees along the segment
    const lim = best ? best.t : maxT; stamp++;
    for (let s = 0; s <= lim + CELL; s += CELL * .5) {
      const sx = o.x + d.x * Math.min(s, lim), sz = o.z + d.z * Math.min(s, lim);
      for (const c of cellsOf(sx, sz, CELL * .5)) {
        for (const b of c.b) { if (b.st === stamp) continue; b.st = stamp; const r = rayBox(b, o, d, best ? best.t : maxT); if (r) best = { t: r.t, n: r.n, kind: 'box', box: b }; }
        if (trees) for (const tr of c.t) {
          if (tr.st === stamp) continue; tr.st = stamp;
          const fx = o.x - tr.x, fz = o.z - tr.z, a = d.x * d.x + d.z * d.z; if (a < 1e-9) continue;
          const bq = fx * d.x + fz * d.z, cq = fx * fx + fz * fz - tr.r * tr.r, disc = bq * bq - a * cq; if (disc < 0) continue;
          const tt = (-bq - Math.sqrt(disc)) / a; if (tt <= 0 || tt > (best ? best.t : maxT)) continue;
          const yy = o.y + d.y * tt; if (yy < tr.y0 - .5 || yy > tr.y0 + tr.top) continue;
          best = { t: tt, kind: tr.kind, tree: tr, n: new V3(fx + d.x * tt, 0, fz + d.z * tt).normalize() };
        }
      }
      if (s >= lim) break;
    }
    if (smoke) for (const sm of W.smokes) { if (sm.life <= 0) continue; tmp.subVectors(sm.p, o); const tc = tmp.dot(d); if (tc < 0 || tc > (best ? best.t : maxT)) continue; const d2 = tmp.lengthSq() - tc * tc; if (d2 < sm.r * sm.r) best = { t: tc, kind: 'smoke' }; }
    if (!best) return null;
    best.p = new V3().copy(o).addScaledVector(d, best.t);
    if (!best.n) best.n = best.kind === 'water' ? new V3(0, 1, 0) : W.normal(best.p.x, best.p.z);
    return best;
  };
  const dv = new V3();
  W.los = (a, b, smoke = true) => { dv.subVectors(b, a); const L = dv.length(); dv.divideScalar(L); const r = W.ray(a, dv, L - .4, { water: false, trees: true, smoke }); return !r; };

  // ---- vegetation: pine forest (instanced, chunked so the frustum can cull)
  const R = mulberry(31);
  const exclude = (x, z) => {
    if (Math.abs(z - DAM_Z) < 26 && Math.abs(x - DAM_X) < 98) return true;
    for (const f of FLATS) if (Math.hypot(x - f.x, z - f.z) < f.r + 6) return true;
    for (const p of SPAWNS) if (Math.hypot(x - p.x, z - p.z) < 16) return true;
    return roadDist(x, z)[0] < 7;
  };
  W.exclude = exclude;
  const slopeAt = (x, z) => 1 - W.normal(x, z).y;
  {
    const pine = pineGeo(R, 1), fir = pineGeo(R, 2), dead = deadGeo(R);
    const treeMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: RAMP });
    W.treeMat = treeMat; treeMat.userData.t = { value: 0 };
    const CH = 240, CN = Math.ceil(SIZE / CH), chunks = {};
    const want = lite ? 1400 : 2300; let placed = 0, tries = 0;
    const m4 = new THREE.Matrix4();
    while (placed < want && tries++ < 60000) {
      const x = (R() - .5) * 640, z = (R() - .5) * 640;
      if (Math.hypot(x, z) > 330 || exclude(x, z)) continue;
      const f = nz.noise(x / 95 + 3, z / 95 - 7) * .8 + nz.noise(x / 30, z / 30) * .35;
      if (f < .12 + R() * .4) continue;
      const h = W.h(x, z); if (h < W.waterY(x, z) + 1 || slopeAt(x, z) > .32) continue;
      const kind = R() < .3 ? 2 : R() < .3 ? 1 : 0, s = kind === 2 ? .8 + R() * .5 : .75 + R() * .75;
      m4.compose(new V3(x, h - .3, z), QT.setFromEuler(EUL.set((R() - .5) * .08, R() * 6.28, (R() - .5) * .08)), new V3(s, s * (.85 + R() * .35), s));
      const key = Math.floor((x + HALF) / CH) + '_' + Math.floor((z + HALF) / CH) + '_' + kind;
      (chunks[key] = chunks[key] || []).push(m4.clone());
      W.addTree(x, z, kind === 1 ? 2.1 * s + .2 : .32 * s + .1, 14 * s); placed++;
    }
    for (const [key, list] of Object.entries(chunks)) {
      const kind = +key.split('_')[2], im = new THREE.InstancedMesh([pine, fir, dead][kind], treeMat, list.length);
      list.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); scene.add(im); outline(im, .09);
    }
    W.treeCount = placed;
  }
  // ---- rocks / boulders (cover)
  {
    const g = new THREE.IcosahedronGeometry(1, 2), p = g.attributes.position, rn = mulberry(4);
    for (let i = 0; i < p.count; i++) { const v = new V3().fromBufferAttribute(p, i); const k = 1 + nz.noise3d(v.x * 1.3, v.y * 1.3, v.z * 1.3) * .28; v.multiplyScalar(k); v.y *= .7; p.setXYZ(i, v.x, v.y, v.z); }
    g.computeVertexNormals();
    const list = [], m4 = new THREE.Matrix4();
    for (let tries = 0; list.length < (lite ? 260 : 420) && tries < 8000; tries++) {
      const x = (rn() - .5) * 600, z = (rn() - .5) * 600; if (exclude(x, z) && rn() < .8) continue;
      const h = W.h(x, z); if (h < W.waterY(x, z) - 3) continue;
      const big = rn() < .3, s = big ? 1.6 + rn() * 2.4 : .4 + rn() * .9, sl = slopeAt(x, z);
      if (!big && sl < .05 && rn() < .5) continue;
      m4.compose(new V3(x, h + s * .15, z), QT.setFromEuler(EUL.set(rn() * .5, rn() * 6.3, rn() * .4)), new V3(s * (1 + rn() * .6), s, s * (1 + rn() * .4)));
      list.push(m4.clone()); if (big) { const t = W.addTree(x, z, s * 1.05, s * 1.2, 'rock'); W.cover.push({ x, z, r: s * 1.2, kind: 'rock' }); }
    }
    const im = new THREE.InstancedMesh(g, M.rock, list.length); list.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = im.receiveShadow = true; im.computeBoundingSphere(); scene.add(im); outline(im, .05);
  }
  // ---- bushes + flower clusters (instanced, stylised colour pops)
  {
    const rb = mulberry(19), bushG = (() => { const parts = []; for (const [x, y, z, r] of [[0, .55, 0, .75], [.6, .4, .2, .5], [-.55, .42, -.1, .55], [.1, .4, .6, .45]]) { const g = new THREE.IcosahedronGeometry(r, 0); g.translate(x, y, z); parts.push(g); } return mergeGeometries(parts); })();
    const flowerG = (() => { const parts = []; for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28, r = .35 + (i % 3) * .2, g = new THREE.OctahedronGeometry(.11, 0); g.translate(Math.cos(a) * r, .32 + (i % 2) * .12, Math.sin(a) * r); parts.push(g); const st = new THREE.CylinderGeometry(.015, .015, .34, 3).translate(Math.cos(a) * r, .16, Math.sin(a) * r); parts.push(st.toNonIndexed()); } return mergeGeometries(parts.map(g => g.index ? g.toNonIndexed() : g)); })();
    const bm = new THREE.MeshToonMaterial({ gradientMap: RAMP }), fm = new THREE.MeshToonMaterial({ gradientMap: RAMP, emissive: 0x222222 });
    const NB = lite ? 260 : 520, NF = lite ? 300 : 700, bush = new THREE.InstancedMesh(bushG, bm, NB), flw = new THREE.InstancedMesh(flowerG, fm, NF), m4 = new THREE.Matrix4(), col = new THREE.Color();
    const bc = ['#3f9a3a', '#4fae3e', '#2f8a3a', '#62b84a'], fc = ['#ff5d8f', '#ffd23a', '#ffffff', '#a36bff', '#ff8a2a', '#5fc8ff'];
    let nb = 0, nf = 0;
    for (let t = 0; t < 20000 && (nb < NB || nf < NF); t++) {
      const x = (rb() - .5) * 600, z = (rb() - .5) * 600; if (exclude(x, z) || Math.hypot(x, z) > 300) continue;
      const h = W.h(x, z); if (h < W.waterY(x, z) + .5 || slopeAt(x, z) > .3) continue;
      if (rb() < .45 && nb < NB) { const s = .7 + rb() * .9; m4.compose(new V3(x, h - .1, z), QT.setFromEuler(EUL.set(0, rb() * 6.3, 0)), new V3(s, s * (.8 + rb() * .4), s)); bush.setMatrixAt(nb, m4); bush.setColorAt(nb++, col.set(bc[(rb() * 4) | 0])); }
      else if (nf < NF && nz.noise(x / 40, z / 40) > .1) { const s = .8 + rb() * .6; m4.compose(new V3(x, h - .05, z), QT.setFromEuler(EUL.set(0, rb() * 6.3, 0)), new V3(s, s, s)); flw.setMatrixAt(nf, m4); flw.setColorAt(nf++, col.set(fc[(rb() * 6) | 0])); }
    }
    bush.count = nb; flw.count = nf; for (const im of [bush, flw]) { im.receiveShadow = true; im.computeBoundingSphere(); scene.add(im); } bush.castShadow = true; outline(bush, .04);
  }
  // ---- grass: tufts that wrap around the camera, height + density from a data texture
  {
    const D = new Float32Array(N1 * N1 * 4);
    for (let j = 0; j < N1; j++) for (let i = 0; i < N1; i++) {
      const k = j * N1 + i, x = -HALF + i * STEP, z = -HALF + j * STEP;
      let dens = clamp(.55 + nz.noise(x / 22, z / 22) * .6, 0, 1) * (1 - smooth(.25, .45, slopeAt(x, z)));
      if (H[k] < W.waterY(x, z) + .4) dens = 0; if (exclude(x, z)) dens *= roadDist(x, z)[0] < 4 ? 0 : .3;
      if (Math.hypot(x - BASE.x, z - BASE.z) < BASE.r + 2) dens = 0;
      D[k * 4] = H[k]; D[k * 4 + 1] = dens;
    }
    W.grassAt = (x, z) => { const i = clamp(Math.round((x + HALF) / STEP), 0, SEG), j = clamp(Math.round((z + HALF) / STEP), 0, SEG); return D[(j * N1 + i) * 4 + 1]; };
    const tex = new THREE.DataTexture(D, N1, N1, THREE.RGBAFormat, THREE.FloatType); tex.needsUpdate = true;
    const blades = [], br = mulberry(12);
    for (let b = 0; b < 6; b++) { const a = br() * 6.28, ox = (br() - .5) * .35, oz = (br() - .5) * .35, h = .45 + br() * .55, w = .05 + br() * .04, lean = (br() - .5) * .25;
      const ca = Math.cos(a), sa = Math.sin(a);
      const P = [[-w, 0], [w, 0], [lean, h]].map(([u, y]) => [ox + u * ca, y, oz + u * sa]);
      blades.push(...P[0], ...P[1], ...P[2]); }
    const tg = new THREE.InstancedBufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(blades, 3));
    const NI = lite ? 14000 : 30000, RG = 36, off = new Float32Array(NI * 3), hs = new Float32Array(NI);
    for (let i = 0; i < NI; i++) { off[i * 3] = br() * RG * 2; off[i * 3 + 1] = br() * RG * 2; off[i * 3 + 2] = br() * 6.28; hs[i] = .6 + br() * .8; }
    tg.setAttribute('offset', new THREE.InstancedBufferAttribute(off, 3)); tg.setAttribute('hScale', new THREE.InstancedBufferAttribute(hs, 1)); tg.instanceCount = NI;
    const gm = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: { uH: { value: tex }, uCam: { value: new V3() }, uR: { value: RG }, uT: { value: 0 }, uSize: { value: SIZE }, uRes: { value: SEG }, uSun: { value: sunDir }, uFog: { value: W.fogColor }, uDen: { value: .0016 },
        uBase: { value: new THREE.Color('#2f7a24') }, uTip: { value: new THREE.Color('#9fd84a') }, uDry: { value: new THREE.Color('#d8e060') }, uSunC: { value: new THREE.Color('#fff0d6').multiplyScalar(1.15) }, uAmb: { value: new THREE.Color('#bfdcff').multiplyScalar(.5) } },
      vertexShader: `attribute vec3 offset; attribute float hScale; uniform sampler2D uH; uniform vec3 uCam; uniform float uR, uT, uSize, uRes;
        varying float vH; varying vec3 vW; varying float vFd; varying float vN;
        vec2 hd(vec2 xz){ vec2 g = clamp((xz + uSize * .5) / uSize * uRes, vec2(0.), vec2(uRes - 1.001)); vec2 i0 = floor(g), f = g - i0; ivec2 a = ivec2(i0);
          vec2 h00 = texelFetch(uH, a, 0).rg, h10 = texelFetch(uH, a + ivec2(1, 0), 0).rg, h01 = texelFetch(uH, a + ivec2(0, 1), 0).rg, h11 = texelFetch(uH, a + ivec2(1, 1), 0).rg;
          return f.x + f.y < 1. ? h00 + (h10 - h00) * f.x + (h01 - h00) * f.y : h11 + (h01 - h11) * (1. - f.x) + (h10 - h11) * (1. - f.y); }
        void main(){
          vec2 wp = uCam.xz + mod(offset.xy - uCam.xz, 2. * uR) - uR;
          vec2 h = hd(wp); float d = length(wp - uCam.xz);
          float s = clamp(h.y * 1.4 - .15, 0., 1.) * hScale * (1. - smoothstep(uR * .62, uR, d));
          float c = cos(offset.z), sn = sin(offset.z); vec3 p = position; p.xz = mat2(c, -sn, sn, c) * p.xz; p *= s;
          float t = position.y / .9; float w = sin(uT * 1.8 + wp.x * .35 + wp.y * .22) + .45 * sin(uT * 3.3 + wp.x * .9 + wp.y * .4);
          p.x += w * .13 * t * t * s; p.z += w * .07 * t * t * s;
          vec3 world = vec3(wp.x + p.x, h.x + p.y - .04, wp.y + p.z);
          vH = t; vW = world; vN = fract(sin(dot(floor(wp * .25), vec2(12.9, 78.2))) * 43758.5);
          vec4 mv = viewMatrix * vec4(world, 1.); vFd = -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uSun, uFog, uBase, uTip, uDry, uSunC, uAmb, uCam; uniform float uDen; varying float vH; varying vec3 vW; varying float vFd; varying float vN;
        void main(){ vec3 col = mix(uBase, mix(uTip, uDry, vN * .7), smoothstep(0., 1., vH));
          vec3 V = normalize(uCam - vW); float back = pow(max(dot(-V, uSun), 0.), 4.) * vH;
          col *= uAmb + uSunC * (.35 + .5 * vH) + uSunC * back * 1.6;
          float ff = 1. - exp(-uDen * uDen * vFd * vFd); gl_FragColor = vec4(mix(col, uFog, ff), 1.); }`,
    });
    const grass = new THREE.Mesh(tg, gm); grass.frustumCulled = false; scene.add(grass); W.grass = gm;
  }
  // ---- valley fog sheets: thick where the ground sits low under them
  {
    const fogMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uT: { value: 0 }, uC: { value: new THREE.Color('#f2f8ff') }, uCam: { value: new V3() } },
      vertexShader: `attribute float aA; varying float vA; varying vec3 vW; void main(){ vA = aA; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform float uT; uniform vec3 uC, uCam; varying float vA; varying vec3 vW;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
        void main(){ vec2 p = vW.xz * .025 + vec2(uT * .02, uT * .008); float k = n(p) * .6 + n(p * 2.7 + 3.) * .3 + n(p * 6.1) * .1;
          float a = vA * smoothstep(.25, .8, k) * smoothstep(4., 30., distance(uCam, vW)); gl_FragColor = vec4(uC, a * .22); }`,
    });
    for (const [y, z0, z1] of [[2.6, DAM_Z + 30, 330]]) {
      const g = new THREE.PlaneGeometry(520, z1 - z0, 64, 64).rotateX(-Math.PI / 2), p = g.attributes.position, a = new Float32Array(p.count);
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i) + (z0 + z1) / 2; a[i] = smooth(.5, 5, y - W.h(x, z)) * (1 - smooth(200, 260, Math.hypot(x, z))); }
      g.setAttribute('aA', new THREE.BufferAttribute(a, 1));
      const m = new THREE.Mesh(g, fogMat); m.position.set(0, y, (z0 + z1) / 2); m.renderOrder = 5; scene.add(m);
    }
    W.fogMat = fogMat;
  }

  // ---- structures
  const K = new Kit(W);
  buildDam(K, W, M);
  buildBase(K, W, M);
  buildRelay(K, W, M);
  for (const p of PYLONS) buildPylon(K, W, M, p);
  buildPowerLines(K, W, M);
  buildScatter(K, W, M, R);
  K.build(scene);
  // moving / special pieces
  W.dish.position.y += 0; scene.add(W.dish);
  for (const s of W.signs) scene.add(s);
  // spillway water + foam
  {
    const foam = canvasTex(256, (x, n) => { x.fillStyle = '#9fb8bf'; x.fillRect(0, 0, n, n); for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * .5})`; x.fillRect(Math.random() * n, Math.random() * n, 1 + Math.random() * 3, 10 + Math.random() * 60); } }, 1);
    foam.repeat.set(3, 2); W.foam = foam;
    const sm = new THREE.MeshStandardMaterial({ map: foam, transparent: true, opacity: .85, roughness: .2, emissive: 0x6a7c80, emissiveIntensity: .35, emissiveMap: foam, depthWrite: false });
    const g = new THREE.PlaneGeometry(25, 34.5, 1, 1); const sp = new THREE.Mesh(g, sm), a = Math.atan2(24, 25);
    sp.position.set(DAM_X, 8.3 + Math.cos(a) * .25, DAM_Z + 17.5 + Math.sin(a) * .25); sp.rotation.x = -Math.PI / 2 + a; scene.add(sp);
    W.spillSrc = new V3(DAM_X, 1.2, DAM_Z + 25);
  }
  W.update = (dt, cam) => {
    W.time += dt; W.grass.uniforms.uT.value = W.time; W.grass.uniforms.uCam.value.copy(cam.position);
    W.fogMat.uniforms.uT.value = W.time; W.fogMat.uniforms.uCam.value.copy(cam.position);
    W.water.normalMap.offset.set(W.time * .012, W.time * .007); W.foam.offset.y = W.time * 1.4;
    W.dish.rotation.y += dt * .35; W.clouds.rotation.y += dt * .002;
    const bl = Math.sin(W.time * 3.2) > .3 ? 6 : .4; for (const m of W.blink) m.emissiveIntensity = bl;
    for (const s of W.smokes) s.life -= dt;
  };
  return W;
}

function pineGeo(R, kind) {
  const parts = [], col = (g, c, jit = .08) => { const p = g.attributes.position, a = new Float32Array(p.count * 3), cc = new THREE.Color(); for (let i = 0; i < p.count; i++) { cc.copy(c).offsetHSL((R() - .5) * .02, 0, (R() - .5) * jit + p.getY(i) * .004); a[i * 3] = cc.r; a[i * 3 + 1] = cc.g; a[i * 3 + 2] = cc.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  const trunk = new THREE.CylinderGeometry(.1, .24, kind === 1 ? 3 : 6, 6).translate(0, kind === 1 ? 1.5 : 3, 0).toNonIndexed(); parts.push(col(trunk, new THREE.Color('#7a4a2a')));
  const tiers = kind === 1 ? 4 : 6, base = kind === 1 ? 1.5 : 3.6, rad = kind === 1 ? 2.3 : 2.0, step = kind === 1 ? 1.25 : 1.75;
  for (let i = 0; i < tiers; i++) {
    const r = rad * (1 - i / (tiers + .6)) + .25, h = 2.4 - i * .12, y = base + i * step;
    const g = new THREE.ConeGeometry(r, h, 8, 1, true).translate(0, y + h / 2, 0).toNonIndexed(), p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const x = p.getX(k), z = p.getZ(k), yy = p.getY(k); if (yy < y + h * .2) { const a = Math.atan2(z, x), j = 1 + Math.sin(a * 5 + i * 2.3) * .14; p.setXYZ(k, x * j, yy - .25 + Math.sin(a * 3 + i) * .18, z * j); } }
    g.computeVertexNormals();
    parts.push(col(g, new THREE.Color(i % 2 ? '#2f8a3a' : '#277a34').lerp(new THREE.Color('#7cc84a'), i / tiers * .6)));
  }
  return mergeGeometries(parts);
}
function deadGeo(R) {   // round stylised broadleaf tree
  const parts = [];
  const add = (g, c, jit = .06) => { g = g.index ? g.toNonIndexed() : g; const n = g.attributes.position.count, a = new Float32Array(n * 3), cc = new THREE.Color(); for (let i = 0; i < n; i += 3) { cc.set(c).offsetHSL((R() - .5) * .03, 0, (R() - .5) * jit); for (let k = 0; k < 3; k++) { a[(i + k) * 3] = cc.r; a[(i + k) * 3 + 1] = cc.g; a[(i + k) * 3 + 2] = cc.b; } } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); parts.push(g); };
  add(new THREE.CylinderGeometry(.18, .32, 4.4, 7).translate(0, 2.2, 0), '#8a5a34');
  add(new THREE.CylinderGeometry(.06, .12, 2, 5).rotateZ(.8).translate(.6, 3.6, 0), '#8a5a34');
  for (const [x, y, z, r, c] of [[0, 5.6, 0, 2.4, '#5cb340'], [1.5, 4.8, .6, 1.7, '#6cc24a'], [-1.4, 4.9, -.5, 1.8, '#4fa53a'], [.3, 6.9, -.3, 1.6, '#7ed05a'], [-.4, 4.4, 1.4, 1.4, '#5cb340']]) {
    const g = new THREE.IcosahedronGeometry(r, 0); g.scale(1, .85, 1); g.translate(x, y, z); add(g, c, .1);
  }
  return mergeGeometries(parts);
}

// ------------------------------------------------------------------ the Halvard dam
function buildDam(K, W, M) {
  const L = 168, x0 = DAM_X, z0 = DAM_Z;
  // body: extruded trapezoid profile (z,y) along x
  const sh = new THREE.Shape(); sh.moveTo(4, CREST); sh.lineTo(-4, CREST); sh.lineTo(-5, CREST - 2); sh.lineTo(-30, -4); sh.lineTo(6, -4); sh.lineTo(4, CREST);
  const g = new THREE.ExtrudeGeometry(sh, { depth: L, bevelEnabled: false });   // profile (-z, y), extruded along z
  g.rotateY(Math.PI / 2); g.translate(-L / 2, 0, 0);                              // → runs along x, downstream face toward +z
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 6, uv.getY(i) / 6);
  K.push(x0, 0, z0);
  K.geo(g, M.concrete);
  // colliders: crest + stepped downstream mass + upstream face
  W.addBox(x0, z0, L / 2, 4.2, 0, -6, CREST);
  for (let k = 0; k < 4; k++) W.addBox(x0, z0 + 8 + k * 6, L / 2, 3, 0, -6, CREST - 4 - k * 5.5);
  // crest road + parapets
  K.box(M.asphalt, L, .3, 6.4, 0, CREST + .15, 0);
  for (const s of [-1, 1]) {
    K.box(M.concrete, L, 1.1, .45, 0, CREST + .85, s * 3.9, 0, false, 2);
    W.addBox(x0, z0 + s * 3.9, L / 2, .25, 0, CREST, CREST + 1.4);
    for (let x = -L / 2 + 6; x < L / 2; x += 14) {   // lamp posts
      K.cyl(M.metal, .07, .1, 5.2, x, CREST + 3, s * 3.75, 6);
      K.box(M.metal, .12, .12, 1.3, x, CREST + 5.5, s * 3.2);
      K.box(M.lamp, .5, .12, .3, x, CREST + 5.4, s * 2.6);
    }
  }
  // downstream buttress ribs + spillway channel
  for (let x = -L / 2 + 10; x < L / 2 - 4; x += 15) { if (Math.abs(x) < 16) continue; K.box(M.darkcon, 1.6, 2, 34, x, 8.7, 17.5, 0, false, 3, Math.atan2(24, 25)); }
  for (const s of [-1, 1]) K.box(M.darkcon, 1.4, 4, 34, s * 13, 9.6, 17.5, 0, false, 3, Math.atan2(24, 25));
  // spillway gates on the crest (radial gates between piers)
  for (let i = -1; i <= 1; i++) {
    const gx = i * 8.5;
    K.box(M.concrete, 2, 6, 3, gx - 4.3, CREST + 3, -2.3, 0, true);
    K.box(M.rust, 6.4, 4.2, .35, gx, CREST + 2, -2.6);
    for (let r = 0; r < 4; r++) K.box(M.metal, 6.4, .18, .4, gx, CREST + .6 + r, -2.35);
  }
  K.box(M.concrete, 2, 6, 3, 12.8, CREST + 3, -2.3, 0, true);
  // gantry crane over the gates
  for (const s of [-1, 1]) { K.box(M.hazard, .7, 9, .7, s * 14, CREST + 4.5, -2.8, 0, true, 1); K.box(M.hazard, .7, 9, .7, s * 14, CREST + 4.5, 2.8, 0, true, 1); }
  K.box(M.hazard, 29, 1.1, .8, 0, CREST + 9.2, -2.8, 0, false, 1); K.box(M.hazard, 29, 1.1, .8, 0, CREST + 9.2, 2.8, 0, false, 1);
  K.box(M.metal, 3, 1.6, 6.4, -4, CREST + 8.4, 0); K.cyl(M.cable, .04, .04, 5, -4.6, CREST + 5.5, 0, 4); K.cyl(M.cable, .04, .04, 5, -3.4, CREST + 5.5, 0, 4);
  // intake tower in the lake + footbridge
  K.cyl(M.concrete, 4, 4.4, 30, -30, 9, -24, 20, 0, 0, 0, true);
  K.cyl(M.darkcon, 4.6, 4.6, 1, -30, 24.5, -24, 20);
  K.box(M.metal, 2.2, .3, 16, -30, CREST + .3, -12.5, 0, true); for (const s of [-1, 1]) K.box(M.metal, .08, 1, 16, -30 + s * 1.05, CREST + .9, -12.5);
  K.box(M.concrete, 4, 3.4, 4, -30, 26.6, -24, 0, true); K.box(M.redLight, .3, .3, .3, -30, 28.5, -24);
  // outflow pipes at the toe + riprap
  for (const s of [-1, 1]) { K.cyl(M.rust, 1.3, 1.3, 9, s * 30, 1.5, 27, 16, Math.PI / 2, 0, 0); K.cyl(M.darkcon, 1.7, 1.7, 1.6, s * 30, 1.5, 31, 16, Math.PI / 2); }
  K.pop();
  // control house on the east abutment
  { const hx = x0 + 94, hz = z0 - 13, hy = W.h(hx, hz);
    K.push(hx, hy, hz);
    K.box(M.darkcon, 12.4, 1.2, 7.4, 0, -.4, 0);
    K.box(M.concrete, 11, 4.6, 6, 0, 2.3, 0, 0, true);
    K.box(M.windows, 11.02, 1.4, 6.02, 0, 2.7, 0, 0, false, 11);
    K.box(M.darkcon, 11.6, .4, 6.6, 0, 4.8, 0);
    K.box(M.metal, 1.6, 1, 1.2, -2.5, 5.5, 0); K.box(M.metal, 1.6, 1, 1.2, 1, 5.5, 1); K.cyl(M.metal, .05, .05, 6, 4.5, 7.8, 1.5, 5);
    K.box(M.redLight, .2, .2, .2, 4.5, 10.9, 1.5);
    K.box(M.metal, 1.4, 2.4, .12, -2, 1.2, 3.02);
    K.box(M.panel, 1.2, 1.5, .6, 1.2, .75, 3.4, 0, true);
    K.pop();
    W.props.terminal = new V3(hx + 1.2, hy + 1.2, hz + 3.75);
    W.cover.push({ x: hx - 6, z: hz, r: 2, kind: 'box' }, { x: hx + 6, z: hz, r: 2, kind: 'box' }); }
  W.signs = W.signs || [];
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 1.9), new THREE.MeshStandardMaterial({ map: textTex(['HALVARD DAM · UNIT 07', 'KEEP CLEAR OF SPILLWAY'], { w: 1024, h: 160, bg: '#d8cfba', stripe: '#c9a020', font: 'bold 70px "Barlow Condensed", Arial Narrow, sans-serif' }), roughness: .7, polygonOffset: true, polygonOffsetFactor: -2 }));
  sign.position.set(x0 + 34, CREST - 1.05, z0 + 4.62); sign.rotation.x = -Math.atan2(1, 2); W.signs.push(sign);
  W.cover.push(...[-60, -40, -20, 20, 40, 60].map(x => ({ x: x0 + x, z: z0, r: 1, kind: 'dam' })));
}

// ------------------------------------------------------------------ Kessel radar station
function buildBase(K, W, M) {
  const { x: bx, z: bz } = BASE, by = W.h(bx, bz), R = mulberry(51);
  W.props.baseY = by;
  K.push(bx, by, bz);
  K.box(M.concrete, 92, .5, 92, 0, -.1, 0, 0, false, 6);
  // fence with a west gate
  const post = (x, z) => { K.cyl(M.metal, .06, .06, 3.2, x, 1.6, z, 5); K.box(M.metal, .05, .5, .05, x, 3.3, z, 0, false, 1, .5); };
  for (let i = -45; i <= 45; i += 5) { post(i, -45); post(i, 45); post(45, i); if (Math.abs(i) > 7) post(-45, i); }
  const fenceRun = (cx, cz, len, ry) => { K.geo(new THREE.PlaneGeometry(len, 2.8), M.fence, cx, 1.6, cz, 0, ry); const sc = len / 2.8; const g = K.buckets.get(M.fence); const last = g[g.length - 1]; const uv = last.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * sc); };
  fenceRun(0, -45, 90, 0); fenceRun(0, 45, 90, 0); fenceRun(45, 0, 90, Math.PI / 2); fenceRun(-45, -26, 38, Math.PI / 2); fenceRun(-45, 26, 38, Math.PI / 2);
  for (const [cx, cz, hx, hz] of [[0, -45, 45, .3], [0, 45, 45, .3], [45, 0, .3, 45], [-45, -26, .3, 19], [-45, 26, .3, 19]]) W.addBox(bx + cx, bz + cz, hx, hz, 0, by - 1, by + 3.2);
  // gate barrier + guard booth
  K.box(M.hazard, .2, .2, 12, -46, 1.1, 0, 0, false, 1); K.box(M.concrete, 2.4, 2.8, 2.4, -48, 1.4, -9, 0, true); K.box(M.windows, 2.42, 1, 2.42, -48, 1.8, -9, 0, false, 2.4);
  // radar tower: lattice + dish
  const T = 18;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) K.beam(M.white, new V3(sx * 3.2, 0, sz * 3.2), new V3(sx * 1.2, T, sz * 1.2), .3);
  for (let y = 2; y < T; y += 3.2) { const w = 3.2 - (y / T) * 2; for (const [a, b] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) { K.beam(M.red, new V3(a[0] * w, y, a[1] * w), new V3(b[0] * w, y, b[1] * w), .16); K.beam(M.white, new V3(a[0] * w, y, a[1] * w), new V3(b[0] * (w - .35), y + 3.2, b[1] * (w - .35)), .1); } }
  K.box(M.metal, 4.4, .4, 4.4, 0, T, 0); K.cyl(M.metal, .9, 1.1, 2, 0, T + 1.2, 0, 12);
  K.box(M.redLight, .3, .3, .3, 2, T + .4, 2);
  // radar core (objective) at the tower base
  K.box(M.panel, 3.4, 2.6, 2.2, 0, 1.3, 0, 0, true); K.box(M.cyan, .5, 1.8, 2.24, 1.2, 1.4, 0); K.box(M.cyan, .5, 1.8, 2.24, -1.2, 1.4, 0);
  W.props.core = new V3(bx, by + 1.3, bz + 1.4);
  // main operations building
  K.push(-20, 0, 22);
  K.box(M.concrete, 22, 7.6, 12, 0, 3.8, 0, 0, true); K.box(M.windows, 22.02, 5.6, 12.02, 0, 4, 0, 0, false, 5.6);
  K.box(M.darkcon, 22.6, .5, 12.6, 0, 7.85, 0); for (let i = 0; i < 3; i++) K.box(M.metal, 2.2, 1.4, 1.8, -7 + i * 6, 8.8, -2);
  K.cyl(M.white, .05, .05, 7, 9, 11, 4, 5); K.box(M.redLight, .25, .25, .25, 9, 14.6, 4);
  K.geo(new THREE.SphereGeometry(1.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.white, 6, 8.1, 3, -0.6, 0.8, 0);
  // exterior stairs
  for (let s = 0; s < 10; s++) K.box(M.metal, 1.6, .15, .5, 11.9, .4 + s * .38, -4 + s * .4);
  K.box(M.metal, 1.2, 2.4, .12, 0, 1.2, -6.02);
  K.pop();
  // hangar (quonset)
  K.push(22, 0, 24);
  const qg = new THREE.CylinderGeometry(7, 7, 18, 20, 1, true, Math.PI / 2, Math.PI); K.geo(qg, M.contOlive, 0, 0, 0, 0, 0, Math.PI / 2);
  K.geo(new THREE.CircleGeometry(7, 20, 0, Math.PI), M.darkcon, 9, 0, 0, 0, Math.PI / 2); W.addBox(bx + 22, bz + 24, 9, 7, 0, by - 1, by + 7);
  K.box(M.darkcon, .3, 6.8, 13.8, -9.05, 3.2, 0); K.box(M.lamp, .2, .4, 4, -9.2, 6, 0);
  K.pop();
  // containers
  const cm = [M.contRed, M.contBlue, M.contOlive];
  const cont = (x, z, ry, y = 0, m) => { K.box(m || cm[(R() * 3) | 0], 6.1, 2.6, 2.45, x, y + 1.3, z, ry, true, 2.6); W.cover.push({ x: bx + x, z: bz + z, r: 3, kind: 'box' }); };
  cont(12, -18, .1); cont(12, -15, .05); cont(12, -16.5, .2, 2.6); cont(-28, -24, 1.57); cont(-24.5, -24, 1.6); cont(30, -30, .7); cont(-8, 34, 0); cont(2, -34, 1.5); cont(34, 4, 0.3);
  // fuel tanks on cradles
  for (let i = 0; i < 3; i++) { K.cyl(M.white, 1.6, 1.6, 8, 32, 2.1, -16 + i * 4.2, 16, 0, 0, Math.PI / 2, false); K.box(M.metal, .6, 1, 3.4, 29, .5, -16 + i * 4.2); K.box(M.metal, .6, 1, 3.4, 35, .5, -16 + i * 4.2); W.addBox(bx + 32, bz - 16 + i * 4.2, 4, 1.6, 0, by, by + 3.7); }
  // watchtowers with floodlights
  for (const [tx, tz] of [[-40, -40], [40, 40]]) {
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) K.cyl(M.metal, .12, .12, 7, tx + a * 1.2, 3.5, tz + b * 1.2, 6);
    K.box(M.wood, 3.4, .25, 3.4, tx, 7, tz); K.box(M.metal, 3.4, 1.1, .1, tx, 7.6, tz - 1.7); K.box(M.metal, 3.4, 1.1, .1, tx, 7.6, tz + 1.7); K.box(M.metal, .1, 1.1, 3.4, tx + 1.7, 7.6, tz);
    K.box(M.darkcon, 3.8, .2, 3.8, tx, 9.4, tz); K.cyl(M.metal, .05, .05, 2.4, tx + 1.6, 8.2, tz + 1.6, 4); K.box(M.lamp, .7, .5, .4, tx, 8.8, tz - 1.6);
  }
  // jersey barriers + crates along the yard
  for (let i = 0; i < 6; i++) { const x = -30 + i * 4.2, z = -6; K.box(M.concrete, 3.6, 1.1, .7, x, .55, z, 0, true); }
  for (let i = 0; i < 4; i++) K.box(M.concrete, 3.6, 1.1, .7, -36, .55, 30 - i * 4, Math.PI / 2, true);
  W.cover.push({ x: bx - 20, z: bz - 6, r: 2, kind: 'box' }, { x: bx - 26, z: bz - 6, r: 2, kind: 'box' }, { x: bx - 36, z: bz + 24, r: 2, kind: 'box' });
  // generator + cables
  K.box(M.contOlive, 4, 2.2, 2.2, 6, 1.1, 12, 0, true); K.box(M.metal, 1, .6, 1, 7, 2.5, 12); K.cyl(M.rust, .15, .15, 1.4, 4.8, 2.8, 12, 6);
  const cable = (a, b, sag) => { const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new V3().lerpVectors(a, b, t).add(new V3(0, -Math.sin(t * Math.PI) * sag, 0))); } K.geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, .05, 4), M.cable); };
  cable(new V3(6, 2.2, 12), new V3(-9, 6, 16), 1.6); cable(new V3(6, 2.2, 12), new V3(2, .3, 1), .6); cable(new V3(-9, 7, 22), new V3(-11, 11, 26), .4);
  // helipad marking
  const hp = new THREE.Mesh(new THREE.CircleGeometry(6, 32).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: textTex(['H'], { w: 256, h: 256, bg: '#3b3b38', fg: '#d8d0b0', font: 'bold 200px Arial' }), roughness: .8, polygonOffset: true, polygonOffsetFactor: -2 }));
  hp.position.set(bx + 22, by + .17, bz - 26); W.signs.push(hp);
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshStandardMaterial({ map: textTex(['KESSEL RADAR STATION', 'RESTRICTED · WARDEN SECURED'], { w: 1024, h: 256, bg: '#e2dccb', fg: '#7a1d14', stripe: '#a8382b' }) }));
  sg.position.set(bx - 45.3, by + 2, bz + 12); sg.rotation.y = -Math.PI / 2; W.signs.push(sg);
  K.pop();
  // the dish (rotating group): lathe paraboloid + feed struts
  const dish = new THREE.Group(); dish.position.set(bx, by + T + 2.4, bz);
  const pts = []; for (let i = 0; i <= 14; i++) { const r = i / 14 * 7; pts.push(new THREE.Vector2(r, r * r / 20)); }
  const dg = new THREE.LatheGeometry(pts, 40); dg.rotateX(-Math.PI / 2 + .35);
  const dm = new THREE.Mesh(dg, new THREE.MeshStandardMaterial({ color: 0xe6e1d6, roughness: .35, metalness: .5, side: THREE.DoubleSide })); dm.position.set(0, 3.6, 0); dm.castShadow = true;
  const back = new THREE.Mesh(new THREE.CylinderGeometry(.8, 1.4, 2.4, 12), M.metal); back.position.y = 1.4; back.castShadow = true;
  const feed = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, 6, 6), M.metal); feed.position.set(0, 4.6, 2.6); feed.rotation.x = Math.PI / 2 - .35;
  dish.add(dm, back, feed); W.dish = dish;
}

// ------------------------------------------------------------------ forest relay outpost
function buildRelay(K, W, M) {
  const { x, z } = RELAY, y = W.h(x, z);
  K.push(x, y, z, .4);
  K.box(M.darkcon, 18, .4, 14, 0, 0, 0, 0, false, 4);
  K.box(M.contOlive, 7, 3, 4, -3, 1.5, -2, 0, true, 3); K.box(M.windows, 7.02, 1, 4.02, -3, 2, -2, 0, false, 7);
  K.box(M.metal, 1.2, 2.2, .1, -3, 1.1, .02);
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; K.beam(M.white, new V3(5 + Math.cos(a) * 1.6, 0, 3 + Math.sin(a) * 1.6), new V3(5 + Math.cos(a) * .3, 24, 3 + Math.sin(a) * .3), .16); }
  for (let h = 2; h < 23; h += 2.5) K.box(M.red, 2.8 - h / 12, .12, 2.8 - h / 12, 5, h, 3);
  K.box(M.redLight, .3, .3, .3, 5, 24.3, 3);
  K.geo(new THREE.CylinderGeometry(.9, .9, .3, 16), M.white, 5.6, 18, 3, Math.PI / 2, .6, 0); K.geo(new THREE.CylinderGeometry(.7, .7, .3, 16), M.white, 4.4, 14, 3.2, Math.PI / 2, -1.2, 0);
  K.box(M.panel, 2.4, 1.6, 1.4, 3, .8, -4, 0, true); K.box(M.cyan, .2, .6, 1.42, 4.2, 1, -4);
  K.box(M.concrete, 3.6, 1.1, .7, -6, .55, 5, .3, true); K.box(M.concrete, 3.6, 1.1, .7, 1, .55, 6.5, -.2, true);
  K.pop();
  const p = new V3(3, 1, -4).applyAxisAngle(new V3(0, 1, 0), .4); W.props.cell = new V3(x + p.x, y + 1.6, z + p.z);
  W.cover.push({ x: x - 6, z: z + 5, r: 2, kind: 'box' }, { x: x + 1, z: z + 6.5, r: 2, kind: 'box' });
}
function buildPylon(K, W, M, p) {
  const y = W.h(p.x, p.z); K.push(p.x, y, p.z, Math.atan2(p.x, p.z));
  const H = 26;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) K.beam(M.metal, new V3(sx * 3, 0, sz * 3), new V3(sx * .7, H, sz * .7), .22);
  for (let h = 3; h < H; h += 3.5) { const w = 3 - h / H * 2.3; K.beam(M.metal, new V3(-w, h, -w), new V3(w, h + 3.5, w), .1); K.beam(M.metal, new V3(w, h, -w), new V3(-w, h + 3.5, w), .1); K.beam(M.metal, new V3(-w, h, w), new V3(w, h + 3.5, -w), .1); K.beam(M.metal, new V3(w, h, w), new V3(-w, h + 3.5, -w), .1); }
  for (const hh of [H - 6, H - 1]) K.box(M.metal, 12, .4, .4, 0, hh, 0);
  for (const s of [-5.5, 0, 5.5]) K.cyl(M.white, .15, .15, 1.6, s, H - 1.8, 0, 6);
  K.box(M.panel, 2.4, 2.2, 1.6, 0, 1.1, 2.2, 0, true); K.box(M.cyan, 2.42, .3, 1.62, 0, 1.6, 2.2); K.box(M.hazard, 2.42, .3, 1.62, 0, .4, 2.2, 0, false, 1);
  K.pop();
  const q = new V3(0, 1.2, 2.2).applyAxisAngle(new V3(0, 1, 0), Math.atan2(p.x, p.z)); p.target = new V3(p.x + q.x, y + 1.2, p.z + q.z);
  W.addBox(p.x, p.z, 3, 3, 0, y, y + 1.4);
}
function buildPowerLines(K, W, M) {
  const ends = PYLONS.map(p => new V3(p.x, W.h(p.x, p.z) + 25, p.z));
  const chain = [ends[0], ends[2], new V3(BASE.x, W.props.baseY + 12, BASE.z + 30), ends[1], ends[0]];
  for (let i = 0; i < chain.length - 1; i++) for (const off of [-5.5, 0, 5.5]) {
    const a = chain[i], b = chain[i + 1], dir = new V3().subVectors(b, a).setY(0).normalize(), side = new V3(-dir.z, 0, dir.x).multiplyScalar(off * .2);
    const pts = []; for (let k = 0; k <= 16; k++) { const t = k / 16; pts.push(new V3().lerpVectors(a, b, t).add(side).add(new V3(0, -Math.sin(t * Math.PI) * 7, 0))); }
    K.geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, .04, 3), M.cable);
  }
}
// trucks, wrecks, crates, sandbags of rubble across the valley
function buildScatter(K, W, M, R) {
  const truck = (x, z, ry, rusty) => {
    const y = W.h(x, z); K.push(x, y, z, ry);
    const body = rusty ? M.rust : M.contOlive;
    K.box(body, 2.4, 1.6, 2.2, 0, 1.4, 2.6, 0, false, 2); K.box(M.glass, 2.2, .7, .1, 0, 1.9, 3.71); K.box(body, 2.5, .3, 6.4, 0, .75, 0);
    K.box(M.contOlive, 2.5, 1.8, 4, 0, 1.9, -1.1, 0, false, 2); for (const [wx, wz] of [[-1.2, 2.5], [1.2, 2.5], [-1.2, -1], [1.2, -1], [-1.2, -2.4], [1.2, -2.4]]) K.cyl(M.cable, .48, .48, .38, wx, .48, wz, 12, 0, 0, Math.PI / 2);
    K.pop(); W.addBox(x, z, 1.25, 3.3, ry, y, y + 2.8); W.cover.push({ x, z, r: 3.5, kind: 'truck' });
  };
  const rd = ROADS[0];
  truck((rd[1][0] + rd[2][0]) / 2 + 4, (rd[1][1] + rd[2][1]) / 2, .9, true); truck(rd[3][0] - 4, rd[3][1] - 6, 2.2, false); truck(BASE.x - 30, BASE.z - 30, .4, false); truck(-152, 52, 2.9, true);
  truck(DAM_X + 100, DAM_Z - 8, 1.6, false);
  // sandbag + concrete block clusters (cover) near the dam ends
  for (const [x, z] of [[DAM_X + 88, DAM_Z + 12], [DAM_X - 88, DAM_Z + 12], [DAM_X + 90, DAM_Z - 14], [DAM_X - 86, DAM_Z - 12]]) {
    const y = W.h(x, z); K.push(x, y, z, R() * 3); K.box(M.concrete, 3.6, 1.1, .7, 0, .55, 0, 0, true); K.box(M.concrete, 3.6, 1.1, .7, 3, .55, 1.6, .9, true); K.pop(); W.cover.push({ x, z, r: 2, kind: 'box' });
  }
}
