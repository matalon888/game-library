// Dust Descent — original downhill MTB racer. First-person handlebars, canyon trail, rivals, boost pads, kickers.
import { THREE, createStage, createUI, input, loop, confetti, burst, sfx, tone, buzz, store, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { demo } from './kit/demo.js';

import { board as worldBoard } from './kit/board.js';
const WB = worldBoard({ game: 'dust-descent', label: 'Levels cleared', limits: { maxRun: 1, maxPerSec: 0.15 }, mode: 'sum' });
const S = store('dustdescent');
const F = flow('dustdescent');
let level = S.get('level', 1), best = S.get('best', 0);
const stage = createStage({ fov: 64, shadowSize: 16 });
const { scene, camera, renderer, sun, hemi } = stage;
camera.far = 700; camera.updateProjectionMatrix();
const ui = createUI({ title: 'DUST<br>DESCENT', hint: 'Tap left / right to steer · or drag', hand: '👆', score: false });
scene.add(camera);

// ------------------------------------------------------------------ look: warm canyon light, sky dome, fog, sun glare
hemi.color.set('#ffe9d2'); hemi.groundColor.set('#d98a5c'); hemi.intensity = 1.25;
sun.color.set('#fff0d8'); sun.intensity = 2.0;
const FOG = new THREE.Color('#ffcf9f');
scene.fog = new THREE.Fog(FOG, 70, 300);
{
  const g = new THREE.SphereGeometry(500, 32, 18), col = [], top = new THREE.Color('#58adf5'), mid = new THREE.Color('#ffd9ab'), low = new THREE.Color('#ffc78f');
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 500; const c = y > 0 ? mid.clone().lerp(top, Math.pow(Math.min(1, y * 1.6), 0.7)) : mid.clone().lerp(low, Math.min(1, -y * 3)); col.push(c.r, c.g, c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  var sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -10; scene.add(sky);
}
function radialTex(stops, size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
  const gr = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); stops.forEach(([o, col]) => gr.addColorStop(o, col));
  x.fillStyle = gr; x.fillRect(0, 0, size, size); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex([[0, 'rgba(255,255,240,1)'], [0.12, 'rgba(255,250,220,.95)'], [0.35, 'rgba(255,220,160,.35)'], [1, 'rgba(255,200,140,0)']]), blending: THREE.AdditiveBlending, fog: false, depthWrite: false, transparent: true }));
sunGlow.scale.setScalar(260); scene.add(sunGlow);

// ------------------------------------------------------------------ helpers
const V = () => new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
function hash(i, j) { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); }
function noise(x, y) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return lerp(lerp(hash(i, j), hash(i + 1, j), u), lerp(hash(i, j + 1), hash(i + 1, j + 1), u), v);
}
/** merge [geometry, matrix, color] parts into one vertex-coloured geometry (one draw call per model) */
function merge(parts) {
  const pos = [], nor = [], col = [], c = new THREE.Color();
  for (const [g0, m, color] of parts) {
    const g = (g0.index ? g0.toNonIndexed() : g0.clone()); g.applyMatrix4(m); c.set(color);
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(c.r, c.g, c.b); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
/** cylinder between two points */
function tube(a, b, r, color, seg = 8) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), len = d.length();
  const m = new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()), new THREE.Vector3(1, 1, 1));
  return [new THREE.CylinderGeometry(r, r, len, seg), m, color];
}
const vmat = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05, ...o });

// ------------------------------------------------------------------ the trail: a seeded downhill spline
let P = {}, L = 600;
const cx = s => P.a1 * Math.sin(s * P.f1 + P.p1) + P.a2 * Math.sin(s * P.f2 + P.p2) - P.x0;
const cy = s => -s * P.sl + 5 * Math.sin(s * 0.016 + P.p3) + 1.6 * Math.sin(s * 0.05 + P.p2);
function center(s, out = V()) { return out.set(cx(s), cy(s), -s); }
const _a = V(), _b = V();
function frameAt(s, o = { p: V(), T: V(), R: V(), U: V() }) {
  center(s, o.p); center(s - 0.6, _a); center(s + 0.6, _b);
  o.T.subVectors(_b, _a).normalize(); o.R.set(-o.T.z, 0, o.T.x).normalize(); o.U.crossVectors(o.R, o.T).normalize();
  return o;
}
const TRACK_W = 5.2;
function wallH(s, side) { return 12 + 13 * (0.5 + 0.5 * Math.sin(s * 0.011 + side * 2.3 + P.p1)) + 4 * noise(s * 0.03, side * 9); }
/** height of terrain above the centreline at lateral offset d */
function terrainH(s, d) {
  const ad = Math.abs(d), side = d < 0 ? -1 : 1, n = noise(s * 0.08, d * 0.3);
  if (ad <= TRACK_W) return 0.04 * (n - 0.5) - 0.012 * ad * ad * 0.1;
  if (ad <= 9) return (ad - TRACK_W) / 3.8 * 0.7 + 0.25 * n;
  if (ad <= 15) return 0.7 + (ad - 9) / 6 * 2.2 + 0.9 * n;
  const wh = wallH(s, side);
  if (ad <= 27) { const t = (ad - 15) / 12; return 2.9 + (wh - 2.9) * Math.pow(t, 0.75) + 2.6 * (noise(s * 0.12, d * 0.5) - 0.5); }
  return wh + 3 * noise(s * 0.04, d * 0.15) - 1;
}
const ROCK = ['#c35a33', '#dd7a44', '#a5452a', '#e8955a', '#b9502f'].map(c => new THREE.Color(c));
function terrainColor(s, d, h, out) {
  const ad = Math.abs(d), n = noise(s * 0.2, d * 0.4);
  if (ad <= TRACK_W + 0.3) return out.set('#c9784b').offsetHSL(0, 0, (n - 0.5) * 0.05);
  if (ad <= 9) return out.set('#d98a59').offsetHSL(0, 0, (n - 0.5) * 0.06);
  if (ad <= 15) return out.set('#e09a63').offsetHSL(0.01 * (n - 0.5), 0, (n - 0.5) * 0.07);
  if (ad > 27 && n > 0.62) return out.set('#9aa05a').offsetHSL(0, 0, (n - 0.6) * 0.2);   // scrub on the plateau
  const band = Math.floor((h + n * 2.2) / 2.1); return out.copy(ROCK[((band % 5) + 5) % 5]).offsetHSL(0, 0, (n - 0.5) * 0.05);
}

let world = new THREE.Group(); scene.add(world);
function disposeWorld() { world.traverse(o => { if (o.geometry) o.geometry.dispose(); }); scene.remove(world); world = new THREE.Group(); scene.add(world); }

function trailTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512; const x = c.getContext('2d');
  x.fillStyle = '#c87a4c'; x.fillRect(0, 0, 256, 512);
  const r = rng(77);
  for (let i = 0; i < 2600; i++) { const v = r(); x.fillStyle = v < 0.5 ? 'rgba(120,58,30,.18)' : v < 0.8 ? 'rgba(255,214,170,.18)' : 'rgba(90,40,20,.28)'; const s = 1 + r() * 4; x.fillRect(r() * 256, r() * 512, s, s * (0.6 + r())); }
  for (let i = 0; i < 70; i++) { const px = r() * 256, py = r() * 512, s = 3 + r() * 7; x.fillStyle = '#e6a777'; x.beginPath(); x.ellipse(px, py, s, s * 0.7, r() * 3, 0, 7); x.fill(); x.fillStyle = 'rgba(80,35,15,.35)'; x.beginPath(); x.ellipse(px + 1, py + s * 0.5, s, s * 0.35, 0, 0, 7); x.fill(); }
  for (const u of [92, 164]) { x.strokeStyle = 'rgba(110,52,26,.35)'; x.lineWidth = 10; x.beginPath(); for (let y = 0; y <= 512; y += 16) x.lineTo(u + Math.sin(y / 512 * Math.PI * 2) * 8, y); x.stroke(); }
  const g = x.createLinearGradient(0, 0, 256, 0); g.addColorStop(0, 'rgba(217,138,89,1)'); g.addColorStop(0.07, 'rgba(217,138,89,0)'); g.addColorStop(0.93, 'rgba(217,138,89,0)'); g.addColorStop(1, 'rgba(217,138,89,1)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 512);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
}
const TRAIL_TEX = trailTexture();
function chevronTex(bg, fg, glow) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 192; const x = c.getContext('2d');
  x.fillStyle = bg; x.beginPath(); x.roundRect(4, 4, 120, 184, 18); x.fill();
  x.strokeStyle = glow; x.lineWidth = 6; x.stroke();
  x.fillStyle = fg; for (let i = 0; i < 3; i++) { const y = 30 + i * 52; x.beginPath(); x.moveTo(20, y + 40); x.lineTo(64, y); x.lineTo(108, y + 40); x.lineTo(108, y + 58); x.lineTo(64, y + 20); x.lineTo(20, y + 58); x.closePath(); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const BOOST_MAT = new THREE.MeshBasicMaterial({ map: chevronTex('rgba(10,90,200,.88)', '#bff4ff', '#5ee7ff'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
function swirlTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.25, 'rgba(160,120,255,.8)'); g.addColorStop(0.7, 'rgba(40,120,255,.6)'); g.addColorStop(1, 'rgba(30,200,255,.9)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256); x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 5;
  for (let a = 0; a < 6; a++) { x.beginPath(); for (let t = 0; t < 1; t += 0.02) { const r = t * 125, an = a * Math.PI / 3 + t * 4; x.lineTo(128 + Math.cos(an) * r, 128 + Math.sin(an) * r); } x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.center.set(0.5, 0.5); return t;
}
const PORTAL_MAT = new THREE.MeshBasicMaterial({ map: swirlTex(), transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
const RAMP_MAT = new THREE.MeshBasicMaterial({ map: chevronTex('rgba(0,0,0,0)', '#ffffff', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
const PLANK = new THREE.MeshStandardMaterial({ color: '#c8834a', roughness: 0.8, flatShading: true });
const ROCKM = new THREE.MeshStandardMaterial({ color: '#a24c2d', roughness: 0.85, flatShading: true });
const LOGM = vmat({ roughness: 0.8 });

function placeOnTrail(obj, s, lat, h = 0) {
  const f = frameAt(s); obj.position.copy(f.p).addScaledVector(f.R, lat).addScaledVector(UP, h + terrainH(s, lat));
  obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.R, f.U, f.T.clone().negate()));
  return obj;
}

const LOG_GEO = merge([[new THREE.CylinderGeometry(0.42, 0.42, 4.2, 10), M(0, 0.42, 0, 0, 0, Math.PI / 2), '#7a4a2a'], [new THREE.CylinderGeometry(0.36, 0.36, 4.24, 10), M(0, 0.42, 0, 0, 0, Math.PI / 2), '#e6b77c']]);
const BOULDER_GEO = new THREE.IcosahedronGeometry(1, 0);
function rampGeo() {
  const w = 1.7, l = 2.2, h = 1.15, p = [];
  const v = (x, y, z) => p.push(x, y, z);
  const q = (a, b, c, d) => { v(...a); v(...b); v(...c); v(...a); v(...c); v(...d); };
  const bl = [-w, 0, l], br = [w, 0, l], fl = [-w, 0, -l], fr = [w, 0, -l], tl = [-w, h, -l], tr = [w, h, -l];
  q(bl, br, tr, tl); q(fr, fl, tl, tr); v(...bl); v(...tl); v(...fl); v(...br); v(...fr); v(...tr);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.computeVertexNormals(); return g;
}
const RAMP_GEO = rampGeo();

let items = [], finishS = 600;
function buildWorld() {
  disposeWorld();
  const r = rng(level * 7919 + 13);
  P = { a1: 16 + r() * 8, f1: 0.009 + r() * 0.004, p1: r() * 6, a2: 4 + r() * 4, f2: 0.025 + r() * 0.012, p2: r() * 6, p3: r() * 6, sl: 0.13 + Math.min(0.08, level * 0.006), x0: 0 };
  P.x0 = 0; P.x0 = cx(0);
  L = finishS = 250 + Math.min(level, 12) * 40;
  // terrain
  const OFF = [-62, -48, -38, -31, -27, -24, -21, -18, -15, -12, -9, -7, -TRACK_W - 0.3, -3, 0, 3, TRACK_W + 0.3, 7, 9, 12, 15, 18, 21, 24, 27, 31, 38, 48, 62];
  const S0 = -50, S1 = L + 260, STEP = 2.6, rows = Math.ceil((S1 - S0) / STEP);
  const grid = [], f = { p: V(), T: V(), R: V(), U: V() };
  for (let i = 0; i <= rows; i++) {
    const s = S0 + i * STEP; frameAt(s, f); const row = [];
    for (const d0 of OFF) { const ad = Math.abs(d0), d = ad > 10 ? d0 + (hash(i, d0) - 0.5) * 2.2 : d0; const h = terrainH(s, d); row.push([f.p.x + f.R.x * d, f.p.y + h, f.p.z + f.R.z * d, s, d, h]); }
    grid.push(row);
  }
  const pos = [], col = [], c = new THREE.Color();
  for (let i = 0; i < rows; i++) for (let j = 0; j < OFF.length - 1; j++) {
    const a = grid[i][j], b = grid[i][j + 1], cc = grid[i + 1][j + 1], d = grid[i + 1][j];
    for (const tri of [[a, b, cc], [a, cc, d]]) {
      const ms = (tri[0][3] + tri[1][3] + tri[2][3]) / 3, md = (tri[0][4] + tri[1][4] + tri[2][4]) / 3, mh = (tri[0][5] + tri[1][5] + tri[2][5]) / 3;
      terrainColor(ms, md, mh, c);
      for (const q of tri) { pos.push(q[0], q[1], q[2]); col.push(c.r, c.g, c.b); }
    }
  }
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); tg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); tg.computeVertexNormals();
  const terrain = new THREE.Mesh(tg, vmat({ flatShading: true, roughness: 0.92 })); terrain.receiveShadow = true; world.add(terrain);
  // textured trail ribbon on top
  { const tp = [], uv = [], idx = [], N = 9, st = 1.6, R = Math.ceil((L + 220 + 30) / st);
    for (let i = 0; i <= R; i++) { const s = -30 + i * st; frameAt(s, f); for (let k = 0; k < N; k++) { const d = -TRACK_W - 0.3 + (2 * TRACK_W + 0.6) * k / (N - 1); const h = terrainH(s, d) + 0.03; tp.push(f.p.x + f.R.x * d, f.p.y + h, f.p.z + f.R.z * d); uv.push(k / (N - 1), s / 14); } }
    for (let i = 0; i < R; i++) for (let k = 0; k < N - 1; k++) { const a = i * N + k, b = a + 1, c2 = a + N + 1, d = a + N; idx.push(a, b, c2, a, c2, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: TRAIL_TEX, roughness: 1 })); m.receiveShadow = true; world.add(m); }
  // pines + scrub rocks (instanced)
  { const trunks = [], tops = [], rocks = [];
    for (let s = -40; s < L + 240; s += 2.2) for (const side of [-1, 1]) {
      if (r() < 0.32) { const d = side * (10 + r() * 5); trunks.push([s, d, 0.6 + r() * 0.7]); }
      if (r() < 0.55) { const d = side * (28 + r() * 32); trunks.push([s, d, 0.8 + r() * 1]); }
      if (r() < 0.25) { const d = side * (6.6 + r() * 7); rocks.push([s, d, 0.25 + r() * 0.9]); }
    }
    const trunkG = new THREE.CylinderGeometry(0.16, 0.24, 1.6, 6); trunkG.translate(0, 0.8, 0);
    const topG = merge([[new THREE.ConeGeometry(1.5, 3.2, 7), M(0, 2.6, 0), '#3e7d3c'], [new THREE.ConeGeometry(1.15, 2.6, 7), M(0, 3.9, 0), '#4d9446'], [new THREE.ConeGeometry(0.7, 1.8, 7), M(0, 5.0, 0), '#5aa64f']]);
    const ti = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: '#6b4128', roughness: 0.9 }), trunks.length);
    const fi = new THREE.InstancedMesh(topG, vmat({ flatShading: true, roughness: 0.8 }), trunks.length);
    const ri = new THREE.InstancedMesh(BOULDER_GEO, ROCKM, rocks.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    trunks.forEach(([s, d, sc], i) => { frameAt(s, f); const p = f.p.clone().addScaledVector(f.R, d); p.y += terrainH(s, d) - 0.2; e.set(0, hash(s, d) * 6, 0); m4.compose(p, q.setFromEuler(e), new THREE.Vector3(sc, sc * (0.9 + hash(d, s) * 0.4), sc)); ti.setMatrixAt(i, m4); fi.setMatrixAt(i, m4); });
    rocks.forEach(([s, d, sc], i) => { frameAt(s, f); const p = f.p.clone().addScaledVector(f.R, d); p.y += terrainH(s, d); e.set(hash(s, 1) * 3, hash(s, 2) * 3, 0); m4.compose(p, q.setFromEuler(e), new THREE.Vector3(sc * 1.3, sc * 0.8, sc)); ri.setMatrixAt(i, m4); });
    for (const im of [ti, fi, ri]) { im.castShadow = true; im.receiveShadow = true; world.add(im); }
  }
  // trail events: boost pads, kickers, boulders, logs
  items = [];
  const portalS = Math.round(L * 0.48);
  { const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.26, 12, 48), new THREE.MeshStandardMaterial({ color: '#1e6bff', emissive: '#2fb8ff', emissiveIntensity: 1.2, roughness: 0.3 }));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(2.45, 48), PORTAL_MAT); ring.position.y = disc.position.y = 2.75; g.add(ring, disc);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(2.85, 0.08, 6, 48), new THREE.MeshBasicMaterial({ color: '#bff4ff' })); halo.position.y = 2.75; g.add(halo);
    placeOnTrail(g, portalS, 0, 0); world.add(g); g.userData.disc = disc; items.push({ type: 'portal', s: portalS, lat: 0, hw: 2.3, len: 0.6, mesh: g }); }
  let s = 32;
  const hard = Math.min(1, (level - 1) / 8);
  while (s < L - 40) {
    if (s > portalS - 18 && s < portalS + 8) { s += 10; continue; }
    const k = r(), lat = (r() * 2 - 1) * 3.2;
    if (k < 0.42) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.6), BOOST_MAT); m.geometry.rotateX(-Math.PI / 2); placeOnTrail(m, s, lat, 0.07); world.add(m);
      items.push({ type: 'boost', s, lat, hw: 1.2, len: 1.8, mesh: m });
    } else if (k < 0.6) {
      const g = new THREE.Group(), w = new THREE.Mesh(RAMP_GEO, PLANK); w.castShadow = w.receiveShadow = true; g.add(w);
      const ar = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.4), RAMP_MAT); ar.geometry.rotateX(-Math.PI / 2 - Math.atan2(1.15, 4.4)); ar.position.y = 0.6; g.add(ar);
      placeOnTrail(g, s, lat * 0.6, 0); world.add(g); items.push({ type: 'ramp', s, lat: lat * 0.6, hw: 1.7, len: 2.2, mesh: g });
    } else {
      const n = 1 + (r() < 0.35 + hard * 0.4 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const l2 = i === 0 ? lat : clamp(lat + (lat > 0 ? -1 : 1) * (3.4 + r()), -4.2, 4.2);
        if (r() < 0.5) { const m = new THREE.Mesh(BOULDER_GEO, ROCKM); m.scale.set(1.2, 0.9, 1.0); placeOnTrail(m, s, l2, 0.45); m.rotation.y += r() * 3; m.castShadow = m.receiveShadow = true; world.add(m); items.push({ type: 'rock', s, lat: l2, hw: 1.15, len: 1, mesh: m }); }
        else { const m = new THREE.Mesh(LOG_GEO, LOGM); placeOnTrail(m, s, l2, 0); m.rotateY((r() - 0.5) * 0.3); m.castShadow = m.receiveShadow = true; world.add(m); items.push({ type: 'log', s, lat: l2, hw: 2.0, len: 0.6, mesh: m }); }
      }
    }
    s += 22 + r() * 16 - hard * 6;
  }
  // start + finish arches
  for (const [as, txt] of [[finishS, 'FINISH'], [4, '']]) {
    const g = new THREE.Group(), pm = new THREE.MeshStandardMaterial({ color: '#22252f', roughness: 0.5 });
    for (const sd of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6.4, 0.5), pm); p.position.set(sd * 6.4, 3.2, 0); p.castShadow = true; g.add(p); }
    if (txt) {
      const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d');
      for (let i = 0; i < 32; i++) for (let j = 0; j < 6; j++) { x.fillStyle = (i + j) % 2 ? '#fff' : '#111'; x.fillRect(i * 16, j * 16, 16, 16); }
      x.fillStyle = '#ff5d8f'; x.fillRect(150, 10, 212, 76); x.fillStyle = '#fff'; x.font = '900 58px system-ui'; x.textAlign = 'center'; x.fillText(txt, 256, 70);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const b = new THREE.Mesh(new THREE.BoxGeometry(13.3, 1.6, 0.3), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 })); b.position.y = 6; b.castShadow = true; g.add(b);
    } else { const b = new THREE.Mesh(new THREE.BoxGeometry(13.3, 0.7, 0.3), new THREE.MeshStandardMaterial({ color: '#ff5d8f' })); b.position.y = 6.2; g.add(b); }
    placeOnTrail(g, as, 0, 0); g.quaternion.setFromAxisAngle(UP, Math.atan2(-frameAt(as).T.x, -frameAt(as).T.z)); world.add(g);
  }
}

// ------------------------------------------------------------------ riders (one merged mesh + two pedalling legs each)
const SKIN = ['#f1c27d', '#c68642', '#ffdbac', '#8d5524', '#e0ac69'];
function makeRider(jersey, helmet, bike, pants, skin) {
  const parts = [
    // bike faces -z
    [new THREE.TorusGeometry(0.34, 0.07, 8, 22), M(0, 0.37, -0.56, 0, Math.PI / 2, 0), '#1d1d22'], [new THREE.TorusGeometry(0.34, 0.07, 8, 22), M(0, 0.37, 0.56, 0, Math.PI / 2, 0), '#1d1d22'],
    [new THREE.TorusGeometry(0.27, 0.02, 4, 18), M(0, 0.37, -0.56, 0, Math.PI / 2, 0), '#c9ccd4'], [new THREE.TorusGeometry(0.27, 0.02, 4, 18), M(0, 0.37, 0.56, 0, Math.PI / 2, 0), '#c9ccd4'],
    tube([0, 0.4, 0.02], [0, 0.9, -0.36], 0.045, bike), tube([0, 0.86, 0.08], [0, 0.92, -0.36], 0.04, bike), tube([0, 0.4, 0.02], [0, 0.88, 0.12], 0.04, bike),
    tube([0, 0.4, 0.02], [0, 0.37, 0.56], 0.03, bike), tube([0, 0.88, 0.1], [0, 0.37, 0.56], 0.028, bike), tube([0, 0.95, -0.38], [0, 0.37, -0.56], 0.04, '#2a2d36'),
    tube([0, 0.95, -0.38], [0, 1.06, -0.42], 0.035, '#2a2d36'), tube([-0.36, 1.07, -0.43], [0.36, 1.07, -0.43], 0.025, '#22242c'),
    [new THREE.BoxGeometry(0.12, 0.05, 0.28), M(0, 0.95, 0.16), '#1d1d22'],
    // rider (leaning forward)
    [new THREE.CapsuleGeometry(0.17, 0.42, 4, 10), M(0, 1.28, -0.02, -0.95, 0, 0), jersey],
    [new THREE.CapsuleGeometry(0.15, 0.12, 4, 10), M(0, 1.0, 0.12, 0, 0, 0, 1.1, 1, 1), pants],
    [new THREE.SphereGeometry(0.15, 14, 10), M(0, 1.58, -0.3), skin],
    [new THREE.SphereGeometry(0.175, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), M(0, 1.62, -0.3, -0.3, 0, 0, 1, 1, 1.2), helmet],
    [new THREE.BoxGeometry(0.2, 0.03, 0.12), M(0, 1.66, -0.5, 0.25, 0, 0), helmet],
    [new THREE.BoxGeometry(0.06, 0.1, 0.5), M(0, 1.42, 0.18, 0.4, 0, 0), '#30343f'],
  ];
  for (const sd of [-1, 1]) parts.push(tube([sd * 0.2, 1.42, -0.18], [sd * 0.3, 1.1, -0.42], 0.055, jersey), [new THREE.SphereGeometry(0.06, 8, 6), M(sd * 0.32, 1.08, -0.43), skin]);
  const g = new THREE.Group(), body = new THREE.Mesh(merge(parts), vmat()); body.castShadow = true; g.add(body);
  const legG = merge([tube([0, 0, 0], [0, -0.38, -0.12], 0.07, pants), tube([0, -0.38, -0.12], [0, -0.66, 0.02], 0.055, pants), [new THREE.BoxGeometry(0.1, 0.07, 0.2), M(0, -0.69, -0.03), '#f4f4f4']]);
  const lm = vmat();
  g.legs = [-1, 1].map(sd => { const l = new THREE.Mesh(legG, lm); l.position.set(sd * 0.11, 1.0, 0.1); l.castShadow = true; g.add(l); return l; });
  g.pedal = (t) => { g.legs[0].rotation.x = Math.sin(t) * 0.45; g.legs[1].rotation.x = -Math.sin(t) * 0.45; };
  return g;
}

// first-person cockpit: bars, grips, levers, hands, stem, fork + tyre top
const cockpit = new THREE.Group();
{
  const bike = '#e63946', skin = '#f0bf98', parts = [
    tube([-0.3, 0, 0], [0.3, 0, 0], 0.014, '#1b1c22'), tube([-0.3, 0, 0], [-0.17, 0, 0], 0.021, '#111'), tube([0.3, 0, 0], [0.17, 0, 0], 0.021, '#111'),
    tube([0, -0.01, 0.02], [0, -0.05, 0.1], 0.024, '#2b2d36'), tube([0, -0.05, 0.1], [0, -0.42, 0.02], 0.02, bike), tube([0, -0.4, 0.02], [0, -0.9, -0.14], 0.026, bike), [new THREE.BoxGeometry(0.03, 0.06, 0.012), M(0, -0.2, 0.068, -0.25), '#ffffff'],
    [new THREE.BoxGeometry(0.08, 0.035, 0.05), M(0, -0.025, 0.035), '#2b2d36'], [new THREE.BoxGeometry(0.05, 0.03, 0.025), M(0, -0.034, 0.025), '#5ee7ff'],
    
  ];
  for (const sd of [-1, 1]) {
    const hx = sd * 0.235;
    parts.push(tube([sd * 0.15, 0.008, 0.008], [sd * 0.22, 0.016, -0.06], 0.007, '#9aa0aa'), [new THREE.BoxGeometry(0.04, 0.03, 0.03), M(sd * 0.15, 0.0, 0.0), '#222'],
      [new THREE.SphereGeometry(0.05, 12, 8), M(hx, 0.022, 0.012, 0, 0, 0, 1.25, 0.8, 0.95), skin],          // back of hand
      [new THREE.SphereGeometry(0.026, 8, 6), M(hx - sd * 0.06, 0.02, -0.005, 0, 0, 0, 1, 0.9, 1.2), skin]);  // thumb
    for (let k = 0; k < 4; k++) parts.push([new THREE.CapsuleGeometry(0.015, 0.03, 3, 6), M(hx - sd * 0.035 + sd * k * 0.024, -0.005, -0.024, 0.5, 0, 0), skin]);
    parts.push(tube([hx + sd * 0.01, 0.0, 0.04], [sd * 0.3, -0.16, 0.3], 0.03, skin), [new THREE.CylinderGeometry(0.034, 0.034, 0.03, 10), M(hx + sd * 0.02, -0.01, 0.06, 0.6, 0, sd * 0.4), '#2b2d42']);
  }
  const m = new THREE.Mesh(merge(parts), vmat({ roughness: 0.45, fog: false })); m.renderOrder = 5; cockpit.add(m);
  cockpit.position.set(0, -0.36, -1.0); camera.add(cockpit);
}

// player's wingsuit (only shown during the portal glide, third-person)
const suit = new THREE.Group();
{
  const j = '#ff5d8f', w = '#2b2d42', parts = [
    [new THREE.CapsuleGeometry(0.2, 0.7, 4, 10), M(0, 0, 0, Math.PI / 2, 0, 0), j],
    [new THREE.SphereGeometry(0.19, 14, 10), M(0, 0.05, -0.62), '#ffffff'], [new THREE.BoxGeometry(0.26, 0.08, 0.1), M(0, 0.04, -0.78), '#2b2d42'],
    [new THREE.BoxGeometry(0.3, 0.25, 0.4), M(0, 0.2, 0.0), '#30343f'],
  ];
  for (const sd of [-1, 1]) {
    parts.push(tube([sd * 0.18, 0, -0.3], [sd * 0.85, 0, -0.1], 0.06, j), tube([sd * 0.1, 0, 0.35], [sd * 0.3, 0, 1.05], 0.07, '#f4f1de'), [new THREE.BoxGeometry(0.14, 0.12, 0.2), M(sd * 0.31, 0, 1.12), '#ff8c42']);
    const sh = new THREE.Shape(); sh.moveTo(sd * 0.15, -0.3); sh.lineTo(sd * 0.88, -0.12); sh.lineTo(sd * 0.32, 1.0); sh.lineTo(sd * 0.12, 0.3);
    const wg = new THREE.ShapeGeometry(sh); wg.rotateX(Math.PI / 2); parts.push([wg, M(0, 0.01, 0), sd < 0 ? '#3ab795' : '#3ab795']);
  }
  const m = new THREE.Mesh(merge(parts), vmat({ side: THREE.DoubleSide })); m.castShadow = true; suit.add(m);
  suit.flames = [-1, 1].map(sd => { const f = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.45, 10), new THREE.MeshBasicMaterial({ color: '#ff8a3d', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending })); f.geometry.translate(0, -0.3, 0); f.rotation.x = -Math.PI / 2; f.position.set(sd * 0.31, 0, 1.22); suit.add(f); return f; });
  suit.visible = false; scene.add(suit);
}

// dust: one Points cloud
const DUST_N = 160, dustPos = new Float32Array(DUST_N * 3), dustCol = new Float32Array(DUST_N * 4), dustV = [];
const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3)); dustGeo.setAttribute('color', new THREE.BufferAttribute(dustCol, 4));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 1.3, map: radialTex([[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']], 64), vertexColors: true, transparent: true, depthWrite: false }));
dust.frustumCulled = false; scene.add(dust);
for (let i = 0; i < DUST_N; i++) dustV.push({ v: V(), life: 0 });
let dustI = 0;
function puff(p, n = 2, spread = 0.5, color = [0.93, 0.68, 0.5]) {
  for (let k = 0; k < n; k++) { const i = dustI++ % DUST_N, d = dustV[i]; d.life = 1; d.v.set((Math.random() - 0.5) * spread * 0.1, 0.02 + Math.random() * 0.03, (Math.random() - 0.5) * spread * 0.1);
    dustPos[i * 3] = p.x + (Math.random() - 0.5) * spread; dustPos[i * 3 + 1] = p.y + 0.2; dustPos[i * 3 + 2] = p.z + (Math.random() - 0.5) * spread; dustCol.set([...color, 0.6], i * 4); }
}
function updDust(dt) {
  for (let i = 0; i < DUST_N; i++) { const d = dustV[i]; if (d.life <= 0) { dustCol[i * 4 + 3] = 0; continue; } d.life -= 0.018 * dt; dustPos[i * 3] += d.v.x * dt; dustPos[i * 3 + 1] += d.v.y * dt; dustPos[i * 3 + 2] += d.v.z * dt; dustCol[i * 4 + 3] = Math.max(0, d.life) * 0.55; }
  dustGeo.attributes.position.needsUpdate = true; dustGeo.attributes.color.needsUpdate = true;
}

// ------------------------------------------------------------------ HUD
const hud = document.createElement('div'); hud.className = 'dd-hud';
hud.innerHTML = `<div class="dd-timer"><b></b><span id="tm">00:00:00</span></div><div class="dd-boost"><span>⚡</span><div class="bar"><i id="bb"></i></div></div>`;
const board = document.createElement('div'); board.className = 'dd-board';
const posEl = document.createElement('div'); posEl.className = 'dd-pos';
document.body.append(hud, board, posEl);
const $ = id => document.getElementById(id);
const NAMES = ['Kestrel', 'Mako', 'Dusty', 'Rook', 'Pip'], RCOL = ['#ffd23f', '#3a86ff', '#ff6b6b', '#7b5cff', '#3ab795'];
const ord = n => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');

// ------------------------------------------------------------------ race state
const me = { s: 0, lat: 0, v: 0, h: 0, vy: 0, air: false, ramp: null, boost: 0, wob: 0, finished: false, ftime: 0, name: 'YOU', color: '#ff5d8f' };
let riders = [], state = 'ready', t0 = 0, raceT = 0, score = 0, steerVel = 0, shake = 0, boostMeter = 0, lastPos = 6, fovKick = 0, botUntil = 0, botLat = 0;
function buildLevel() {
  buildWorld();
  riders.forEach(r => scene.remove(r.g)); riders = [];
  const r = rng(level * 31 + 5), base = 21 + Math.min(level, 15) * 0.3, fk = 1 + (F.k() - 1) * 0.5;   // half-strength: rival top speed is a sharp knob
  NAMES.forEach((n, i) => {
    const g = makeRider(RCOL[i], ['#ffffff', '#222', '#ffd23f', '#ff5d8f', '#5ee7ff'][i], ['#2b2d42', '#ff8c42', '#3a86ff', '#e63946', '#52b788'][i], ['#3d405b', '#f4f1de', '#2b2d42', '#6d597a', '#e9c46a'][i], SKIN[i]);
    scene.add(g);
    riders.push({ g, name: n, color: RCOL[i], s: 6 + i * 5 + r() * 3, lat: ((i % 3) - 1) * 2.4 + (r() - 0.5), v: 0, vmax: base * (0.83 + i * 0.03 + Math.min(level, 14) * 0.008 + r() * 0.015) * fk, h: 0, vy: 0, air: false, ramp: null, boost: 0, wob: 0, tl: 0, ph: r() * 6, finished: false, ftime: 0 });
  });
  Object.assign(me, { glide: 0, s: 0, lat: 0, v: 0, h: 0, vy: 0, air: false, ramp: null, boost: 0, wob: 0, finished: false, vmax: base * 1.0 });
  raceT = 0; score = 0; boostMeter = 0; lastPos = 6; fovKick = 0;
  ui.levels(level); ui.progress(0);
  board.innerHTML = ''; [...riders, me].forEach(x => { const d = document.createElement('div'); d.className = 'dd-row' + (x === me ? ' me' : ''); d.innerHTML = `<span class="n"></span><span class="c" style="background:${x.color}"></span><span>${x.name}</span>`; board.appendChild(d); x.row = d; });
  updateBoard(); updateCamera(0, 0);
}
function standings() { return [...riders, me].sort((a, b) => (a.finished && b.finished) ? a.ftime - b.ftime : (b.finished - a.finished) || (b.s - a.s)); }
function updateBoard() {
  const st = standings(); st.forEach((x, i) => { x.row.style.transform = `translateY(${i * 25}px)`; x.row.firstChild.textContent = i + 1; });
  const p = st.indexOf(me) + 1;
  if (p !== lastPos && state === 'play') { if (p < lastPos) { ui.pop(p === 1 ? 'TAKE THE LEAD!' : 'OVERTAKE!', '#fff', 30, 40); sfx.pick(6 - p); score += 25; buzz(12); } posEl.classList.remove('bump'); void posEl.offsetWidth; posEl.classList.add('bump'); lastPos = p; }
  posEl.innerHTML = `${p}<small>${p === 1 ? 'ST' : p === 2 ? 'ND' : p === 3 ? 'RD' : 'TH'}</small>`;
  posEl.style.color = p <= 3 ? '#fff' : '#ffe1d1';
}

// ------------------------------------------------------------------ physics for any rider
const f1 = { p: V(), T: V(), R: V(), U: V() };
function stepRider(x, dt, isMe) {
  const sec = dt / 60, prevS = x.s;
  if (isMe && x.glide > 0) {
    x.glide -= sec; x.v += (x.vmax * 1.6 - x.v) * 0.05 * dt; x.s += x.v * sec; x.h = lerp(x.h, 7 + Math.sin(x.glide * 3) * 0.6, 0.04 * dt);
    if (x.glide <= 0) { x.air = true; x.vy = 1; ui.pop('LAND IT!', '#fff', 32, 40); }
    return;
  }
  if (state === 'play' || x.finished || !isMe) {
    const target = (x.vmax + x.boost * 9) * (x.finished && isMe ? 0.4 : 1);
    x.v += (target - x.v) * (x.v < target ? 0.022 : 0.06) * dt;
  }
  x.boost = Math.max(0, x.boost - sec * 0.75);
  x.s += x.v * sec;
  x.wob = Math.max(0, x.wob - sec * 1.6);
  // vertical: kickers + airtime
  if (x.ramp) { const k = (x.s - (x.ramp.s - x.ramp.len)) / (2 * x.ramp.len); if (k >= 1) { x.air = true; x.vy = 6.5 + x.v * 0.12; x.h = 1.15; x.ramp = null; if (isMe) { sfx.bounce(); tone(300, 0.25, 'triangle', 0.1, 2); } } else x.h = Math.max(0, k) * 1.15; }
  if (x.air) { x.vy -= 22 * sec; x.h += x.vy * sec; if (x.h <= 0) { x.h = 0; x.air = false; x.boost = Math.max(x.boost, 0.5); if (isMe) landed(); } }
  for (const it of items) {
    if (it.s - it.len > x.s || it.s + it.len < prevS) continue;
    const over = Math.abs(x.lat - it.lat) < it.hw + (isMe ? 0.25 : 0.1);
    if (!over) continue;
    if (it.type === 'portal') { if (isMe && prevS < it.s && x.s >= it.s) startGlide(); continue; }
    if (it.type === 'boost' && !x.air && prevS < it.s && x.s >= it.s) { x.boost = 1; if (isMe) gotBoost(it); }
    else if (it.type === 'ramp' && !x.air && !x.ramp && prevS <= it.s - it.len + 0.5 && x.s >= it.s - it.len) x.ramp = it;
    else if ((it.type === 'rock' || it.type === 'log') && x.h < 0.6 && prevS < it.s && x.s >= it.s && !(isMe && x.wob > 0.6)) { x.v *= 0.32; x.wob = 1; x.boost = 0; if (isMe) crashed(it); }
  }
}
function gotBoost(it) {
  boostMeter = 1; fovKick = 1; score += 10; sfx.coin(); tone(180, 0.4, 'sawtooth', 0.05, 3); buzz(15); ui.pop('BOOST!', '#5ee7ff', 34, 46);
  frameAt(it.s, f1); puff(f1.p.clone().addScaledVector(f1.R, it.lat), 8, 2, [0.6, 0.9, 1]);
}
function startGlide() {
  me.glide = 3.2; me.air = false; me.ramp = null; me.boost = 1; fovKick = 1.4; score += 60; ui.flash(0.7); ui.pop('WINGSUIT!', '#5ee7ff', 46, 40); buzz([20, 30, 20]);
  [392, 523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.12, 1.5), i * 70));
}
function landed() { score += 30; ui.pop(['NICE AIR!', 'SENT IT!', 'HUGE!'][Math.floor(Math.random() * 3)], '#ffd23f', 36, 40); sfx.smash(); buzz(25); shake = 0.6; frameAt(me.s, f1); puff(f1.p.clone().addScaledVector(f1.R, me.lat), 14, 2.5); }
function crashed(it) { shake = 1.4; ui.flash(0.45); sfx.fail(); buzz([40, 30, 40]); ui.pop('OUCH!', '#ff4d6d', 38, 40); frameAt(it.s, f1); puff(f1.p.clone().addScaledVector(f1.R, it.lat), 20, 3); }

function rivalAI(x, dt) {
  // avoid hazards, sometimes line up a pad or kicker, keep spacing
  if (x.tl <= 0) {
    x.tl = 0.6 + Math.random() * 0.6; x.target = clamp(x.lat + (Math.random() - 0.5) * 2, -3.8, 3.8);
    for (const it of items) { const ds = it.s - x.s; if (ds < 4 || ds > 30) continue;
      if ((it.type === 'boost' || it.type === 'ramp') && Math.random() < 0.45) { x.target = it.lat; break; } }
  }
  x.tl -= dt / 60;
  for (const it of items) { const ds = it.s - x.s; if (ds < 0 || ds > 22) continue;
    if ((it.type === 'rock' || it.type === 'log') && Math.abs(x.target - it.lat) < it.hw + 0.7) x.target = clamp(it.lat + (it.lat > 0 ? -1 : 1) * (it.hw + 1.1), -4.3, 4.3); }
  x.lat += clamp(x.target - x.lat, -1, 1) * 0.05 * dt;
}
function contact(dt) {
  const all = [...riders, me];
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i], b = all[j], ds = b.s - a.s, dl = b.lat - a.lat;
    if (Math.abs(ds) < 1.5 && Math.abs(dl) < 0.85 && Math.abs(a.h - b.h) < 0.8) {
      const push = (0.85 - Math.abs(dl)) * 0.5 * (dl >= 0 ? 1 : -1); a.lat -= push; b.lat += push;
      if (a === me || b === me) {
        const other = a === me ? b : a, behind = me.s < other.s;
        if (behind && me.v > other.v + 1 && other.wob <= 0) { other.wob = 1; other.v *= 0.45; other.lat += (other.lat > me.lat ? 1 : -1) * 0.8; score += 40; ui.pop('BUMPED ' + other.name.toUpperCase() + '!', '#ffd23f', 30, 40); sfx.smash(); buzz(30); shake = 0.7; me.v *= 0.9; }
      }
    }
  }
}

// ------------------------------------------------------------------ camera + rider placement
let camTP = 0;
const camPos = V(), look = V(), tmpQ = new THREE.Quaternion(), mtx = new THREE.Matrix4();
function placeRider(x, t) {
  frameAt(x.s, f1);
  x.g.position.copy(f1.p).addScaledVector(f1.R, x.lat); x.g.position.y += terrainH(x.s, x.lat) + x.h;
  mtx.makeBasis(f1.R, UP, f1.T.clone().negate()); x.g.quaternion.setFromRotationMatrix(mtx);
  const lean = clamp(((x.target ?? x.lat) - x.lat) * 0.25, -0.35, 0.35) + Math.sin(t * 25 + x.ph) * x.wob * 0.5;
  x.g.rotateZ(-lean); if (x.air) x.g.rotateX(x.vy * 0.04);
  x.ph += x.v * 0.012; x.g.pedal(x.ph * 1.6);
  if (x.v > 8 && !x.air && Math.random() < 0.5) puff(x.g.position.clone().addScaledVector(f1.T, -0.6), 1, 0.4);
}
function updateCamera(dt, t) {
  frameAt(me.s, f1);
  const bob = me.air ? 0 : Math.sin(t * 14) * 0.03 * Math.min(1, me.v / 20) + (noise(me.s * 0.9, 3) - 0.5) * 0.06;
  camPos.copy(f1.p).addScaledVector(f1.R, me.lat); camPos.y += terrainH(me.s, me.lat) + 1.62 + me.h + bob;
  const sh = shake * 0.12; camPos.x += (Math.random() - 0.5) * sh; camPos.y += (Math.random() - 0.5) * sh;
  const ah = me.s + 16; frameAt(ah, f1); look.copy(f1.p).addScaledVector(f1.R, me.lat * 0.85); look.y += 0.4 + me.h * 0.5 - (me.air ? me.vy * 0.05 : 0);
  camTP = lerp(camTP, me.glide > 0 ? 1 : 0, 0.06 * dt);
  suit.visible = camTP > 0.3;
  if (camTP > 0.001) {
    frameAt(me.s, f1); const body = f1.p.clone().addScaledVector(f1.R, me.lat); body.y += terrainH(me.s, me.lat) + me.h + 1.1;
    suit.position.copy(body); mtx.makeBasis(f1.R, UP, f1.T.clone().negate()); suit.quaternion.setFromRotationMatrix(mtx); suit.rotateZ(clamp(steerVel * 0.03, -0.5, 0.5)); suit.rotateX(Math.sin(t * 3) * 0.05);
    suit.flames.forEach(fl => fl.scale.set(1, 0.7 + Math.random() * 0.6, 1));
    const tp = body.clone().addScaledVector(f1.T, -4.4).addScaledVector(UP, 1.1), tl = body.clone().addScaledVector(f1.T, 12).addScaledVector(UP, -1.5);
    camPos.lerp(tp, camTP); look.lerp(tl, camTP);
    if (me.glide > 0 && Math.random() < 0.6) puff(body.clone().addScaledVector(f1.T, -0.9), 1, 0.2, [0.6, 0.9, 1]);
  }
  camera.position.copy(camPos);
  camera.lookAt(look);
  cockpit.visible = camTP < 0.35;
  camera.rotateZ(clamp(-steerVel * 0.012, -0.12, 0.12) + Math.sin(t * 30) * me.wob * 0.05);
  const fov = (camera.aspect < 0.7 ? 64 * 1.12 : 64) + fovKick * 9 + Math.max(0, me.v - 18) * 0.25;
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = lerp(camera.fov, fov, 0.15); camera.updateProjectionMatrix(); }
  cockpit.rotation.set(-0.05 + (me.air ? -0.12 : 0) + Math.sin(t * 7) * 0.008, clamp(-steerVel * 0.03, -0.35, 0.35), clamp(steerVel * 0.006, -0.1, 0.1));
  cockpit.position.y = -0.36 + (me.air ? 0.04 : 0) + bob * 0.4 - me.wob * Math.abs(Math.sin(t * 22)) * 0.05;
  sky.position.copy(camera.position);
  frameAt(me.s, f1); sunGlow.position.copy(camera.position).addScaledVector(f1.T, 420).add(new THREE.Vector3(60, 150, 0));
  sun.position.copy(camPos).addScaledVector(f1.T, 30).add(new THREE.Vector3(14, 26, 0)); sun.target.position.copy(camPos).addScaledVector(f1.T, 10);
}

// ------------------------------------------------------------------ flow
function finishRace() {
  const st = standings(), p = st.indexOf(me) + 1;
  F.level(p <= 3, (st.length - p) / (st.length - 1));
  score += Math.max(0, (4 - p)) * 100;
  if (p <= 3) {
    state = 'won'; WB.submit(1); best = Math.max(best, score); S.set('best', best); sfx.win(); buzz([20, 40, 20]); ui.flash(0.6);
    for (let i = 0; i < 3; i++) setTimeout(() => confetti(scene, camera.position.clone().add(new THREE.Vector3(0, 1.5, 0).applyQuaternion(camera.quaternion)).add(camera.getWorldDirection(V()).multiplyScalar(6)), 50), i * 200);
    ui.win(level, `${ord(p)} place · ${score} pts`);
    level++; S.set('level', level);
  } else { state = 'lost'; sfx.fail(); buzz([60, 40, 60]); ui.lose(ord(p).toUpperCase() + ' PLACE', 'Finish top 3 to qualify'); }
}
ui.onTap(w => { WB.start();
  if (w === 'start') { state = 'play'; t0 = performance.now(); ui.pop('GO!', '#7dff6a', 64, 34); sfx.win(); }
  else { buildLevel(); state = 'play'; ui.pop('GO!', '#7dff6a', 64, 34); tone(660, 0.2, 'triangle', 0.14, 1); }
});
let tapLat = null;   // a tap on the left / right half glides the bike one line that way
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s, before touching): on level 1, until the
// first real touch, the bike weaves left and right across the trail (around any rock or log), so the screen shows what a drag does
const D = demo(null, { ready: () => state === 'play' && level === 1 && !me.air && !me.glide, ms: 4500 }); let demoed = false;
function demoSteer() { let target = Math.sin(raceT * 1.7) * 2.6;
  for (const it of items) { const ds = it.s - me.s; if (ds < -1 || ds > 26) continue;
    if ((it.type === 'rock' || it.type === 'log') && Math.abs(target - it.lat) < it.hw + 0.8) target = clamp(it.lat + (it.lat > 0 ? -1 : 1) * (it.hw + 1.2), -4.4, 4.4); }
  tapLat = target; demoed = true; }
input({
  onMove: (dx) => { if (state !== 'play') return; tapLat = null; me.lat = clamp(me.lat + dx * 0.03, -4.5, 4.5); steerVel = lerp(steerVel, dx, 0.5); },
  onTap: (e) => { if (state === 'play') tapLat = clamp((tapLat ?? me.lat) + (e.clientX < innerWidth / 2 ? -1.6 : 1.6), -4.5, 4.5); },
});

let boardT = 0;
loop((dt, t) => {
  if (state === 'play' || me.finished) { stepRider(me, dt, true); }
  if (state === 'play') {
    raceT += dt / 60;
    if (D.on) demoSteer(); else if (demoed) { demoed = false; if (!D.touched) tapLat = 0; }   // demo over: back on the centre line
    if (performance.now() < botUntil) { const d = clamp(botLat - me.lat, -1, 1) * 0.11 * dt; me.lat += d; steerVel = lerp(steerVel, d * 25, 0.3); }
    else if (tapLat != null) { const d = clamp(tapLat - me.lat, -1, 1) * 0.14 * dt; me.lat += d; steerVel = lerp(steerVel, d * 25, 0.3); if (Math.abs(tapLat - me.lat) < 0.05) tapLat = null; }
    if (me.s >= finishS && !me.finished) { me.finished = true; me.ftime = raceT; finishRace(); }
  }
  if (state !== 'ready') for (const x of riders) { if (!x.finished || x.s < finishS + 80) { rivalAI(x, dt); stepRider(x, dt, false); } if (x.s >= finishS && !x.finished) { x.finished = true; x.ftime = raceT; } }
  if (state === 'play') contact(dt);
  for (const x of riders) placeRider(x, t);
  steerVel *= Math.pow(0.85, dt); shake = Math.max(0, shake - dt * 0.05); fovKick = Math.max(0, fovKick - dt * 0.02); boostMeter = Math.max(0, me.boost);
  updateCamera(dt, t); updDust(dt);
  for (const it of items) if (it.type === 'portal') { it.mesh.userData.disc.rotation.z -= 0.06 * dt; }
  for (const it of items) it.mesh.visible = it.s > me.s - 20 && it.s < me.s + 260;
  BOOST_MAT.map.offset.y = -((t * 1.6) % 1);
  if (state === 'play') {
    const ms = Math.floor(raceT * 100); $('tm').textContent = `${String(Math.floor(ms / 6000)).padStart(2, '0')}:${String(Math.floor(ms / 100) % 60).padStart(2, '0')}:${String(ms % 100).padStart(2, '0')}`;
    ui.progress(me.s / finishS); $('bb').style.width = boostMeter * 100 + '%';
    document.getElementById('speedfx').style.opacity = Math.min(1, me.boost * 1.4);
    if ((boardT += dt) > 6) { boardT = 0; updateBoard(); }
  } else document.getElementById('speedfx').style.opacity = 0;
  document.body.classList.toggle('dd-ready', state === 'ready');
});

buildLevel();
ui.start();

// ------------------------------------------------------------------ test hooks
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play') return;
    // aim for pads / kickers ahead, dodge hazards, otherwise chase the next rival's line
    let target = me.lat, bestScore = -1;
    for (const it of items) { const ds = it.s - me.s; if (ds < 3 || ds > 45) continue;
      if (it.type === 'portal' && ds < 50) { bestScore = 999; target = 0; }
      if ((it.type === 'boost' || it.type === 'ramp') && 50 - ds > bestScore) { bestScore = 50 - ds; target = it.lat; } }
    for (const it of items) { const ds = it.s - me.s; if (ds < -1 || ds > 26) continue;
      if ((it.type === 'rock' || it.type === 'log') && Math.abs(target - it.lat) < it.hw + 0.8) target = clamp(it.lat + (it.lat > 0 ? -1 : 1) * (it.hw + 1.2), -4.4, 4.4); }
    botLat = target; botUntil = performance.now() + 400;
  },
};
