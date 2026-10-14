// Porch Toss — original newspaper bike ride. Hold to pedal, let go to brake. Letting go beside a waiting mailbox
// tosses the paper (right beside it = PERFECT). Stop in time for crossing cars and trains, deliver enough and reach the depot.
import { THREE, createStage, createUI, store, loop, input, buzz, tone, sfx, note, burst, confetti, lerp, clamp, rng, mat, glossy, rounded, stickman } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';

const KEY = 'porchtoss', NAME = 'Porch Toss: Newspaper Bike Ride';
const S = store(KEY);
let level = S.get('level', 1), best = S.get('best', 0);
const F = flow(KEY);

const stage = createStage({ fov: 50, shadowSize: 18 });
const { scene, camera, sun, hemi } = stage;
sun.intensity = 1.8; hemi.intensity = 1.1;
const ui = createUI({ title: 'PORCH<br>TOSS', hint: 'Hold to ride · let go to toss', hand: '👆' });
const D = daily(KEY, ui, { name: NAME });
ui.els.start.querySelector('.hand').style.animation = 'hcpulse 1s ease-in-out infinite';

const THEMES = [
  { bg: ['#a9dcff', '#e8f7ff'], lawn: '#7fd36b', road: '#5d6474', walk: '#e8e3d8', ui: '#ff6b3d', houses: ['#ffcf5c', '#ff8fa3', '#8fd3ff', '#b9a4ff', '#ffffff', '#ffb38a'], roof: ['#e5484d', '#3a6ea5', '#5b4b8a', '#d9822b'] },
  { bg: ['#ffd9c2', '#fff3e3'], lawn: '#c98f84', road: '#5e5560', walk: '#f0e2d8', ui: '#3a86ff', houses: ['#fff1c9', '#9ad0c2', '#ffd6e0', '#c7b8ff', '#ffffff', '#f6c28b'], roof: ['#2b4c7e', '#7a2e3a', '#3d6b4f', '#4a3f6b'] },
  { bg: ['#c9f0ff', '#f0fff4'], lawn: '#9ad97a', road: '#646b7d', walk: '#eef0e6', ui: '#7b5cff', houses: ['#ffe28a', '#ffb5c2', '#a3e4ff', '#d6c4ff', '#ffffff', '#ffc89a'], roof: ['#c0392b', '#2f5d8a', '#6a4c93', '#e07a2f'] },
  { bg: ['#dcd0ff', '#fff0f8'], lawn: '#8fd9a8', road: '#4e4a63', walk: '#ede8f5', ui: '#ff4f9a', houses: ['#fff5c4', '#ffc4d6', '#b5e8ff', '#c9ffd8', '#ffffff', '#ffd3a8'], roof: ['#ff5d73', '#3c6fd1', '#2fa37a', '#e09a2b'] },
];
const CAR_COLS = ['#ff5d5d', '#4f8bff', '#ffd23f', '#ffffff', '#8b6bff', '#3ac58f', '#ff8a3d'];

// ---------------------------------------------------------------- shared geometry/materials
const ROAD_W = 6, RIDER_X = 1.3, BOX = new THREE.BoxGeometry(1, 1, 1), SPH = new THREE.SphereGeometry(1, 16, 12);
const lawnMat = mat('#7fd36b', { roughness: 0.95 }), roadMat = mat('#5d6474', { roughness: 0.9 }), walkMat = mat('#e8e3d8', { roughness: 0.9 });
const whiteMat = mat('#ffffff'), darkMat = mat('#2b2d42'), paperMat = mat('#f5f1e6');
const world = new THREE.Group(); scene.add(world);

// ---------------------------------------------------------------- rider + bike (our own courier: mint jacket, orange helmet, satchel)
const rider = new THREE.Group(); scene.add(rider); rider.scale.setScalar(1.25);
const bike = new THREE.Group(); rider.add(bike);
const tyre = new THREE.TorusGeometry(0.42, 0.075, 10, 26), rimG = new THREE.TorusGeometry(0.3, 0.025, 6, 20);
const wheels = [];
for (const z of [-0.72, 0.72]) {
  const w = new THREE.Group(); w.position.set(0, 0.48, z);
  const t = new THREE.Mesh(tyre, darkMat); t.rotation.y = Math.PI / 2; t.castShadow = true;
  const r = new THREE.Mesh(rimG, mat('#ffd23f')); r.rotation.y = Math.PI / 2;
  const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.6, 0.03), whiteMat), spoke2 = spoke.clone(); spoke2.rotation.x = Math.PI / 2;
  w.add(t, r, spoke, spoke2); bike.add(w); wheels.push(w);
}
const frameMat = glossy('#ff6b3d');
const bar = (len, x, y, z, rx) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, len, 8), frameMat); m.position.set(x, y, z); m.rotation.x = rx; m.castShadow = true; bike.add(m); return m; };
bar(1.2, 0, 0.82, 0, Math.PI / 2 - 0.12); bar(0.75, 0, 0.75, 0.42, -0.45); bar(0.8, 0, 0.82, -0.55, 0.35); bar(0.6, 0, 0.62, 0.0, 0.1);
const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 8), darkMat); handle.rotation.z = Math.PI / 2; handle.position.set(0, 1.2, -0.72); bike.add(handle);
const seat = new THREE.Mesh(rounded(0.24, 0.08, 0.36, 0.04), darkMat); seat.position.set(0, 1.18, 0.38); bike.add(seat);
// front crate with rolled papers
const crate = new THREE.Mesh(rounded(0.62, 0.32, 0.5, 0.05), glossy('#4fb3ff')); crate.position.set(0, 1.12, -0.98); crate.castShadow = true; bike.add(crate);
const ROLL = new THREE.CylinderGeometry(0.08, 0.08, 0.55, 10);
for (let i = 0; i < 4; i++) { const p = new THREE.Mesh(ROLL, paperMat); p.rotation.z = Math.PI / 2; p.position.set(0, 1.3 + (i % 2) * 0.06, -1.1 + i * 0.08); bike.add(p); }
// rear rack: stack of bundles, one per delivery left
const rack = new THREE.Group(); rack.position.set(0, 1.05, 0.8); bike.add(rack);
const bundleG = rounded(0.6, 0.22, 0.46, 0.05), bundleMats = [mat('#fff4d6'), mat('#ffe0a3')], strapMat = mat('#e5484d');
let bundles = [];
function setBundles(n) {
  for (const b of bundles) rack.remove(b); bundles = [];
  for (let i = 0; i < n; i++) {
    const b = new THREE.Mesh(bundleG, bundleMats[i % 2]); b.position.y = i * 0.24; b.rotation.y = (i % 3 - 1) * 0.08; b.castShadow = true;
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.24, 0.48), strapMat); b.add(s); rack.add(b); bundles.push(b);
  }
}
const courier = stickman('#2ec4a6', '#f1c7a5', 1);
courier.position.set(0, 0.42, 0.25); courier.rotation.y = Math.PI; rider.add(courier);
courier.body.rotation.x = 0.35;
const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), glossy('#ff9f1c')); helmet.position.y = 0.04; courier.head.add(helmet);
const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.14), glossy('#ff9f1c')); visor.position.set(0, 0.04, 0.22); courier.head.add(visor);
const satchel = new THREE.Mesh(rounded(0.36, 0.3, 0.14, 0.04), mat('#8a5a3b')); satchel.position.set(-0.22, 0.85, -0.12); courier.add(satchel);
courier.armL.rotation.x = -1.2; courier.armR.rotation.x = -1.2;

// ---------------------------------------------------------------- instanced scenery
function inst(geo, material, n, shadow = true) { const m = new THREE.InstancedMesh(geo, material, n); m.castShadow = shadow; m.receiveShadow = true; m.count = 0; world.add(m); return m; }
const roofG = new THREE.ConeGeometry(1, 1, 4); roofG.rotateY(Math.PI / 4);
const IH = { walls: inst(rounded(1, 1, 1, 0.06), mat('#fff'), 80), roofs: inst(roofG, mat('#fff'), 80), doors: inst(BOX, mat('#7a4b2a'), 80, false), wins: inst(BOX, mat('#cfefff', { roughness: 0.2, emissive: '#6fbfff', emissiveIntensity: 0.15 }), 200, false),
  trunks: inst(new THREE.CylinderGeometry(0.16, 0.22, 1.2, 8), mat('#8a5a3b'), 120), crowns: inst(new THREE.IcosahedronGeometry(1, 1), mat('#fff', { flatShading: true }), 240),
  dashes: inst(BOX, whiteMat, 200, false), zebra: inst(BOX, whiteMat, 200, false), bushes: inst(SPH, mat('#fff'), 200),
  ties: inst(BOX, mat('#7a5a44'), 200), rails: inst(BOX, mat('#b8bcc8', { metalness: 0.5, roughness: 0.3 }), 40, false), fences: inst(BOX, whiteMat, 300) };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _e = new THREE.Euler();
function put(im, x, y, z, sx, sy, sz, col, ry = 0) {
  const i = im.count++; _q.setFromEuler(_e.set(0, ry, 0)); _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz)); im.setMatrixAt(i, _m);
  if (col) im.setColorAt(i, _c.set(col)); return i;
}

// ---------------------------------------------------------------- level state
let state = 'ready', rz = 0, v = 0, holding = false, botHold = false, score = 0, delivered = 0, perfects = 0, need = 0, recorded = false, beatShown = false;
let Lend = 140, crossings = [], customers = [], papers = [], dyn = [], frames = 0, crash = null, theme, fk = 1, windowW = 2.6, camX = 0, camZ = 0, shake = 0, pedal = 0, lean = 0, tossAnim = 0;
const VMAX = 0.24, ACC = 0.008, BRAKE = 0.022;

function car(col, len = 3.4) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(rounded(len, 0.8, 1.7, 0.18), glossy(col)); body.position.y = 0.72; body.castShadow = true;
  const cab = new THREE.Mesh(rounded(len * 0.52, 0.62, 1.5, 0.16), mat('#dff3ff', { roughness: 0.15, metalness: 0.2 })); cab.position.set(-len * 0.06, 1.38, 0); cab.castShadow = true;
  const axG = new THREE.CylinderGeometry(0.36, 0.36, 1.84, 14); axG.rotateX(Math.PI / 2);
  for (const x of [-len * 0.3, len * 0.3]) { const a = new THREE.Mesh(axG, darkMat); a.position.set(x, 0.36, 0); g.add(a); }
  g.add(body, cab); world.add(g); return g;
}
function bus(col, len) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(rounded(len, 1.9, 2, 0.2), glossy(col)); body.position.y = 1.35; body.castShadow = true;
  const stripe = new THREE.Mesh(BOX, mat('#dff3ff', { roughness: 0.15 })); stripe.scale.set(len * 0.9, 0.55, 2.04); stripe.position.y = 1.7;
  const axG = new THREE.CylinderGeometry(0.4, 0.4, 2.06, 14); axG.rotateX(Math.PI / 2);
  for (const x of [-len * 0.35, len * 0.35]) { const a = new THREE.Mesh(axG, darkMat); a.position.set(x, 0.4, 0); g.add(a); }
  g.add(body, stripe); world.add(g); return g;
}
function train(len) {
  const g = new THREE.Group(), n = Math.round(len / 7);
  for (let i = 0; i < n; i++) {
    const loco = i === 0, c = new THREE.Mesh(rounded(6.6, 2.4, 2.6, 0.3), glossy(loco ? '#ff4d5e' : '#3d8bff')); c.position.set(-len / 2 + 3.5 + i * 7, 1.75, 0); c.castShadow = true;
    const w = new THREE.Mesh(BOX, mat('#e8f6ff', { roughness: 0.15 })); w.scale.set(5.6, 0.7, 2.64); w.position.set(c.position.x, 2.2, 0);
    const base = new THREE.Mesh(BOX, darkMat); base.scale.set(6.4, 0.5, 2.2); base.position.set(c.position.x, 0.45, 0);
    g.add(c, w, base);
  }
  world.add(g); return g;
}
function crossingSign(x, z) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 8), whiteMat); post.position.y = 1.3; post.castShadow = true;
  const arm = new THREE.Group(); arm.position.set(0, 1.1, 0.15);
  for (let i = 0; i < 4; i++) { const seg = new THREE.Mesh(BOX, mat(i % 2 ? '#ffffff' : '#ff4d5e')); seg.scale.set(0.75, 0.16, 0.12); seg.position.x = 0.38 + i * 0.75; seg.castShadow = true; arm.add(seg); }
  const lamp = new THREE.Mesh(SPH, mat('#ff2b2b', { emissive: '#ff0000', emissiveIntensity: 0.2 })); lamp.scale.setScalar(0.16); lamp.position.set(0, 2.4, 0.12);
  g.add(post, arm, lamp); g.position.set(x, 0, z); world.add(g); g.lamp = lamp; g.arm = arm; arm.rotation.z = 1.35; return g;
}

function clearWorld() {
  for (const d of dyn) world.remove(d); dyn = [];
  for (const k in IH) IH[k].count = 0;
  for (const p of papers) scene.remove(p.m); papers = [];
}
function buildLevel() {
  clearWorld();
  theme = THEMES[(level - 1) % THEMES.length];
  const bs = document.body.style; bs.setProperty('--bg1', theme.bg[0]); bs.setProperty('--bg2', theme.bg[1]); bs.setProperty('--ui', theme.ui);
  scene.fog = new THREE.Fog(theme.bg[0], 38, 70);
  lawnMat.color.set(theme.lawn); roadMat.color.set(theme.road); walkMat.color.set(theme.walk);
  const r = rng(D.seed || level * 4241 + 77); fk = F.k();
  windowW = clamp(2.7 / fk, 1.9, 3.4);
  Lend = Math.round(Math.min(130 + level * 10, 230));
  // ground
  const add = (o) => { world.add(o); dyn.push(o); return o; };
  const plane = (w, d, m, x, y, z) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m); p.rotation.x = -Math.PI / 2; p.position.set(x, y, z); p.receiveShadow = true; return add(p); };
  const len = Lend + 80;
  plane(200, len, lawnMat, 0, 0, -len / 2 + 30);
  plane(ROAD_W, len, roadMat, 0, 0.02, -len / 2 + 30);
  for (const sx of [-1, 1]) plane(1.4, len, walkMat, sx * (ROAD_W / 2 + 0.7), 0.025, -len / 2 + 30);
  // layout: customers and crossings along the route
  crossings = []; customers = [];
  let z = -16, side = r() < 0.5 ? 1 : -1, sinceX = 0;
  const nCross = Math.min(2 + Math.floor(level / 2), 6);
  const crossAt = []; for (let i = 0; i < nCross; i++) crossAt.push(-(Lend - 12) * (i + 1) / (nCross + 0.6) - 14);
  const isCross = (zz, pad) => crossAt.some(c => Math.abs(zz - c) < pad);
  while (z > -Lend + 12) {
    if (!isCross(z, 8)) { customers.push({ z, side, done: false }); side = r() < 0.65 ? -side : side; }
    z -= 10 + r() * 6;
  }
  need = Math.max(2, Math.ceil(customers.length * 0.6));
  // crossings with traffic lanes (deterministic loops so the motion is fair and predictable)
  crossAt.forEach((zc, ci) => {
    const isTrain = level >= 3 && ci === nCross - 1 - (level % 2) && ci > 0;
    plane(200, isTrain ? 5 : ROAD_W, isTrain ? mat('#b49b84', { roughness: 1 }) : roadMat, 0, 0.03, zc);
    const X = { z: zc, lanes: [], train: isTrain, half: isTrain ? 2.5 : ROAD_W / 2 };
    if (isTrain) {
      for (let i = 0; i < 70; i++) put(IH.ties, -70 + i * 2, 0.06, zc, 0.5, 0.1, 3.2, null);
      for (const dz of [-0.8, 0.8]) put(IH.rails, 0, 0.16, zc + dz, 140, 0.14, 0.12, null);
      const span = 190, speed = clamp(0.62 * fk, 0.5, 0.8), tl = 21 + Math.min(level, 6) * 3;
      const lane = { z: zc, dir: r() < 0.5 ? 1 : -1, speed, span, cars: [{ off: r() * span, len: tl, m: train(tl), w: 2.6 }] };
      dyn.push(lane.cars[0].m); X.lanes.push(lane);
      X.signs = [crossingSign(-3.5, zc + 3.2), crossingSign(3.5, zc + 3.2)]; X.signs[1].rotation.y = Math.PI; dyn.push(...X.signs);
    } else {
      for (let i = -9; i <= 9; i++) if (Math.abs(i) > 0) put(IH.dashes, i * 4.5, 0.04, zc, 2.2, 0.02, 0.18, null);
      for (let i = 0; i < 7; i++) put(IH.zebra, -2.7 + i * 0.9, 0.04, zc + ROAD_W / 2 + 0.9, 0.5, 0.02, 1.4, null);
      put(IH.zebra, RIDER_X, 0.045, zc + ROAD_W / 2 + 2.1, 2.6, 0.02, 0.22, null);
      for (const lz of [-1.5, 1.5]) {
        const span = 64, dir = lz < 0 ? 1 : -1, speed = clamp((0.17 + level * 0.008 + r() * 0.04) * fk, 0.14, 0.34);
        const n = clamp(Math.round((2 + Math.min(level, 6) * 0.35) * fk), 2, 5), cars = [];
        const gap = span / n;
        for (let i = 0; i < n; i++) {
          const big = level >= 2 && r() < 0.18, L = big ? 6.5 : 3.4 + r() * 0.5;
          const m = big ? bus(r() < 0.5 ? '#ffd23f' : '#3ac58f', L) : car(CAR_COLS[Math.floor(r() * CAR_COLS.length)], L);
          if (dir < 0) m.rotation.y = Math.PI;
          cars.push({ off: i * gap + r() * gap * 0.45, len: L, m, w: big ? 2 : 1.7 }); dyn.push(m);
        }
        X.lanes.push({ z: zc + lz, dir, speed, span, cars });
      }
    }
    crossings.push(X);
  });
  // road centre dashes (skip crossings)
  for (let zz = 10; zz > -Lend - 30; zz -= 4) if (!isCross(zz, 5)) put(IH.dashes, 0, 0.035, zz, 0.16, 0.02, 1.8, null);
  // houses, trees, bushes, fences on both sides
  const custAt = (sx, zz) => customers.find(c => c.side === sx && Math.abs(c.z - zz) < 3);
  for (const sx of [-1, 1]) {
    for (let zz = 6; zz > -Lend - 40; zz -= 9) {
      if (isCross(zz, 7)) continue;
      const c = custAt(sx, zz) || custAt(sx, zz - 4.5) || custAt(sx, zz + 4.5);
      const hz = c ? c.z : zz, hw = 4 + r() * 1.2, hh = 2.4 + r() * 0.8, hd = 3.4, hx = sx * (9.8 + r() * 0.6);
      if (c && c.house) continue;
      if (c) c.house = true;
      const col = theme.houses[Math.floor(r() * theme.houses.length)];
      put(IH.walls, hx, hh / 2, hz, hd, hh, hw, col);
      put(IH.roofs, hx, hh + 0.9, hz, hd * 0.82, 1.8, hw * 0.82, theme.roof[Math.floor(r() * theme.roof.length)]);
      put(IH.doors, hx - sx * (hd / 2 + 0.01), 0.75, hz, 0.06, 1.5, 0.8, null);
      for (const wz of [-1, 1]) put(IH.wins, hx - sx * (hd / 2 + 0.01), hh * 0.6, hz + wz * hw * 0.3, 0.06, 0.7, 0.7, null);
      // little picket fence along the walk
      for (let f = -3; f <= 3; f++) if (!(c && Math.abs(f) <= 1)) put(IH.fences, sx * 5.7, 0.35, hz + f * 0.62, 0.1, 0.7, 0.12, null);
      put(IH.fences, sx * 5.7, 0.5, hz - 2.05, 0.06, 0.08, 1.6, null); put(IH.fences, sx * 5.7, 0.5, hz + 2.05, 0.06, 0.08, 1.6, null);
      // garden
      const tz = hz + 4.5 * (r() < 0.5 ? 1 : -1);
      if (!isCross(tz, 6)) {
        const tx = sx * (6.8 + r() * 1.2), s = 1 + r() * 0.5;
        put(IH.trunks, tx, 0.6, tz, 1, 1, 1, null);
        put(IH.crowns, tx, 1.7 * s, tz, 1.1 * s, 1.1 * s, 1.1 * s, r() < 0.5 ? '#3fae5c' : '#5cc96b');
        put(IH.crowns, tx + 0.3, 2.4 * s, tz + 0.2, 0.75 * s, 0.75 * s, 0.75 * s, '#6fd77d');
      }
      for (let b = 0; b < 2; b++) put(IH.bushes, hx - sx * (hd / 2 + 0.7), 0.4, hz + (b ? 1.6 : -1.6) * (1 + r() * 0.2), 0.55, 0.5, 0.55, r() < 0.5 ? '#4cbf5f' : '#e86fa0');
      // background trees further out
      put(IH.crowns, sx * (16 + r() * 6), 2, zz + r() * 4, 2, 2, 2, '#4fbf63'); put(IH.trunks, sx * (16 + r() * 6), 0.6, zz + 2, 1, 1, 1, null);
    }
  }
  // customers: mailbox + flag + waiting neighbour + floating marker
  for (const c of customers) {
    const mx = c.side * 4.65, g = new THREE.Group(); g.position.set(mx, 0, c.z);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 8), mat('#8a5a3b')); post.position.y = 0.5; post.castShadow = true;
    const box = new THREE.Mesh(rounded(0.5, 0.42, 0.75, 0.12), glossy('#3d8bff')); box.position.y = 1.15; box.castShadow = true;
    const flag = new THREE.Group(); const fp = new THREE.Mesh(BOX, mat('#ff4d5e')); fp.scale.set(0.05, 0.4, 0.05); fp.position.y = 0.2; const ff = new THREE.Mesh(BOX, mat('#ff4d5e')); ff.scale.set(0.05, 0.16, 0.24); ff.position.set(0, 0.34, 0.12); flag.add(fp, ff); flag.position.set(c.side * 0.27, 1.1, 0.15); flag.rotation.x = Math.PI / 2;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.15, 32), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06;
    const marker = new THREE.Group();
    const bub = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.16, 24), glossy('#ffd23f')); bub.rotation.x = Math.PI / 2;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 4), glossy('#ffd23f')); tip.rotation.z = Math.PI; tip.position.y = -0.6;
    const icon = new THREE.Mesh(ROLL, paperMat); icon.rotation.z = Math.PI / 2 - 0.5; icon.scale.set(1.6, 0.9, 1.6); icon.position.z = 0.12;
    marker.add(bub, tip, icon); marker.position.y = 3.0;
    const who = stickman(['#ff8fa3', '#8b6bff', '#ffb703', '#3ac58f', '#4f8bff'][Math.floor(r() * 5)], ['#f1c7a5', '#c68863', '#8d5a3b', '#ffdcc2'][Math.floor(r() * 4)], 1.2);
    who.position.set(c.side * 2.1, 0, -0.9); who.rotation.y = -c.side * Math.PI / 2;
    g.add(post, box, flag, ring, marker, who); world.add(g); dyn.push(g);
    Object.assign(c, { g, flag, ring, marker, who, jump: 0, x: mx });
  }
  // depot finish: arch with checkered banner
  const fin = new THREE.Group(); fin.position.z = -Lend;
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(rounded(0.6, 4.2, 0.6, 0.15), glossy(theme.ui)); p.position.set(sx * 4.3, 2.1, 0); p.castShadow = true; fin.add(p); }
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 32; const cg = cv.getContext('2d');
  for (let i = 0; i < 32; i++) for (let j = 0; j < 4; j++) { cg.fillStyle = (i + j) % 2 ? '#222' : '#fff'; cg.fillRect(i * 8, j * 8, 8, 8); }
  const ct = new THREE.CanvasTexture(cv); ct.colorSpace = THREE.SRGBColorSpace;
  const banner = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.9, 0.3), new THREE.MeshStandardMaterial({ map: ct })); banner.position.y = 4.1; banner.castShadow = true; fin.add(banner);
  world.add(fin); dyn.push(fin);
  for (const k in IH) { IH[k].instanceMatrix.needsUpdate = true; if (IH[k].instanceColor) IH[k].instanceColor.needsUpdate = true; IH[k].computeBoundingSphere(); }

  rz = 0; v = 0; frames = 0; score = 0; delivered = 0; perfects = 0; recorded = false; beatShown = false; crash = null; botHold = false; holding = false;
  rider.position.set(RIDER_X, 0, 0); rider.rotation.set(0, 0, 0); bike.rotation.set(0, 0, 0); courier.position.set(0, 0.42, 0.25); courier.rotation.set(0, Math.PI, 0);
  setBundles(customers.length);
  camX = RIDER_X; camZ = 0;
  ui.levels(level); ui.progress(0); ui.score(0); hud();
  placeTraffic();
}
function hud() { ui.sub(delivered >= need ? `📰 ${delivered} delivered ✓` : `📰 ${delivered} / ${need} delivered`); }

// ---------------------------------------------------------------- traffic (deterministic loops)
const wrap = (x, span) => ((x % span) + span) % span - span / 2;
const carX = (lane, c, f) => wrap(c.off + lane.dir * lane.speed * f, lane.span);
function placeTraffic() {
  for (const X of crossings) for (const lane of X.lanes) for (const c of lane.cars) c.m.position.set(carX(lane, c, frames), 0, lane.z);
}
function hitsRider(lane, c, f, zFront, zBack, pad = 0) {
  if (zFront > lane.z + c.w / 2 + pad || zBack < lane.z - c.w / 2 - pad) return false;
  const x = carX(lane, c, f);
  return Math.abs(x - RIDER_X) < c.len / 2 + 0.5 + pad;
}

// ---------------------------------------------------------------- tossing
function nearestCustomer() {
  let best = null, bd = 1e9;
  for (const c of customers) { if (c.done) continue; const d = Math.abs(c.z - rz); if (d < bd) { bd = d; best = c; } }
  return best;
}
function toss() {
  const c = nearestCustomer(); if (!c) return;
  const dz = rz - c.z, ad = Math.abs(dz);
  if (ad > windowW + 3) return;                              // nobody near: just a brake
  const hit = ad <= windowW, perfect = ad <= 0.85;
  const m = new THREE.Mesh(ROLL, paperMat); m.castShadow = true;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.12, 10), mat('#e5484d')); m.add(band);
  const from = new THREE.Vector3(RIDER_X - 0.2, 1.5, rz - 0.6);
  const to = hit ? new THREE.Vector3(c.x - c.side * 0.05, 1.3, c.z) : new THREE.Vector3(c.x - c.side * 0.4, 0.1, c.z + dz * 0.7 + (dz > 0 ? 1.2 : -1.2));
  m.position.copy(from); scene.add(m);
  papers.push({ m, from, to, t: 0, c, hit, perfect, early: dz > 0 });
  tossAnim = 1; tone(700, 0.08, 'triangle', 0.1, 1.6); buzz(8);
  if (!hit) c.missWait = true;
}
function landPaper(p) {
  const c = p.c;
  if (p.hit && !c.done) {
    c.done = true; delivered++; c.jump = 1;
    const pts = p.perfect ? 20 : 10; score += pts; if (p.perfect) perfects++;
    c.flag.rotation.x = 0; c.ring.material.color.set('#3ac58f');
    burst(scene, p.to.clone().add(new THREE.Vector3(0, 0.4, 0)), p.perfect ? ['#ffd23f', '#ffffff', theme.ui] : ['#ffffff', '#3ac58f'], p.perfect ? 22 : 12, { speed: 0.12, up: 0.12, size: 0.8 });
    if (p.perfect) { ui.pop(perfects > 1 ? `PERFECT ×${perfects}` : 'PERFECT!', '#ffd23f', 42, 30); ui.flash(0.18); [0, 4, 7, 12].forEach((s, i) => setTimeout(() => note(76 + s, 0.25, 0.14), i * 60)); }
    else { ui.pop('+10', '#fff', 34, 32); note(76, 0.2, 0.14); setTimeout(() => note(83, 0.25, 0.14), 70); }
    buzz(p.perfect ? [15, 30, 15] : 12);
    if (bundles.length) { const b = bundles.pop(); rack.remove(b); burst(scene, rider.position.clone().add(new THREE.Vector3(0, 1.8, 0.8)), ['#fff4d6', '#ffe0a3'], 6, { speed: 0.06, up: 0.08, size: 0.6 }); }
    ui.score(score); hud();
    if (!beatShown && D.beaten(score)) { beatShown = true; ui.pop('BEATEN!', '#fff', 42, 38); confetti(scene, rider.position.clone().add(new THREE.Vector3(0, 2, -2)), 60); }
  } else if (!p.hit) {
    ui.pop(p.early ? 'TOO EARLY' : 'TOO LATE', '#fff', 28, 34); tone(260, 0.12, 'square', 0.06, 0.7);
    burst(scene, p.to, ['#f5f1e6'], 6, { speed: 0.05, up: 0.05, size: 0.5 });
  }
  if (!p.hit) { const lie = p.m; p.done = true; setTimeout(() => scene.remove(lie), 1600); } else scene.remove(p.m);
}

// ---------------------------------------------------------------- win / lose
function finish() {
  if (delivered >= need) {
    state = 'won'; if (!recorded) { recorded = true; F.level(true); }
    best = Math.max(best, score); S.set('best', best);
    confetti(scene, new THREE.Vector3(RIDER_X, 3, rz - 3), 90); sfx.win(); buzz([30, 50, 30]);
    D.won(score);
    ui.win(level, `${delivered} papers · ${perfects} perfect · ${score} pts`);
    level++; S.set('level', level);
  } else {
    state = 'lost'; if (!recorded) { recorded = true; F.level(false, clamp(delivered / need, 0, 1) * 0.9); }
    sfx.fail(); buzz([40, 30, 60]);
    ui.lose('ROUTE MISSED', `Delivered ${delivered} of ${need} needed`);
  }
}
function doCrash(lane) {
  if (state !== 'play') return;
  state = 'lost'; if (!recorded) { recorded = true; F.level(false, clamp(-rz / Lend, 0, 1)); }
  crash = { vx: lane.dir * 0.07, vy: 0.24, rot: 0, t: 0 };
  sfx.smash(); tone(330, 0.25, 'square', 0.08, 1); setTimeout(() => tone(300, 0.3, 'square', 0.08, 1), 120);
  buzz([60, 40, 90]); shake = 0.7; ui.flash(0.5);
  burst(scene, rider.position.clone().add(new THREE.Vector3(0, 1.4, 0)), ['#f5f1e6', '#ffffff', '#fff4d6'], 26, { speed: 0.2, up: 0.2, size: 1.2 });
  ui.lose('CRASH!', `${Math.round(clamp(-rz / Lend, 0, 1) * 100)}% of the route · ${delivered} delivered`);
}

// ---------------------------------------------------------------- input: hold = pedal, release = brake + toss
let ptr = false;
input({
  onDown: () => { if (state === 'play') { ptr = true; sfx.tap(); } },
  onUp: () => { if (ptr && state === 'play') toss(); ptr = false; },
});
ui.onTap((which) => {
  if (which === 'win' || which === 'lose') buildLevel();
  state = 'play'; ui.hideStart(); ptr = false;
});

// ---------------------------------------------------------------- loop
loop((dt, t) => {
  if (!crash) frames += dt;
  if (state === 'play') {
    holding = ptr || botHold;
    v = holding ? Math.min(VMAX, v + ACC * dt) : Math.max(0, v - BRAKE * dt);
    rz -= v * dt;
    // collisions with traffic
    for (const X of crossings) for (const lane of X.lanes) for (const c of lane.cars) if (hitsRider(lane, c, frames, rz - 1.25, rz + 1.2)) doCrash(lane);
    // missed customers fade their marker
    for (const c of customers) if (!c.done && !c.passed && rz < c.z - windowW - 3) { c.passed = true; c.marker.visible = false; c.ring.material.color.set('#ff4d5e'); ui.pop('MISSED', '#ffd6d6', 26, 36); tone(200, 0.15, 'triangle', 0.08, 0.7); }
    ui.progress(-rz / Lend);
    if (rz <= -Lend) finish();
  }
  placeTraffic();
  // crossing lamps blink while a train is near
  for (const X of crossings) if (X.signs) { const L = X.lanes[0], c = L.cars[0], x = carX(L, c, frames), near = Math.abs(x) < c.len / 2 + 30; for (const s of X.signs) { s.lamp.material.emissiveIntensity = near && Math.sin(t * 12) > 0 ? 1.4 : 0.1; s.arm.rotation.z = lerp(s.arm.rotation.z, near ? 0 : 1.35, 0.08 * dt); } }
  // rider animation
  if (!crash) {
    rider.position.set(RIDER_X, 0, rz);
    pedal += v * dt * 2.2;
    for (const w of wheels) w.rotation.x -= v * dt / 0.48;
    const s = Math.sin(pedal * 3);
    courier.legL.rotation.x = -0.9 + s * 0.6; courier.legR.rotation.x = -0.9 - s * 0.6;
    lean = lerp(lean, holding ? 0.06 : -0.04, 0.1);
    bike.rotation.x = lean * 0.5; courier.body.rotation.x = 0.35 + lean;
    tossAnim = Math.max(0, tossAnim - 0.06 * dt);
    courier.armL.rotation.x = -1.2 - tossAnim * 1.6; courier.armL.rotation.z = -tossAnim * 0.8;
    bike.rotation.z = Math.sin(pedal * 3) * 0.02 * (v / VMAX);
  } else {
    crash.t += dt; crash.vy -= 0.012 * dt;
    rider.position.x += crash.vx * dt; rider.position.y = Math.max(0, rider.position.y + crash.vy * dt);
    rider.rotation.z -= 0.12 * dt * Math.sign(crash.vx) * (rider.position.y > 0 ? 1 : 0.2); rider.rotation.x += 0.03 * dt * (rider.position.y > 0 ? 1 : 0);
    if (rider.position.y === 0) crash.vx *= 0.9;
  }
  // papers in flight
  for (const p of papers) {
    if (p.done) continue;
    p.t = Math.min(1, p.t + 0.045 * dt);
    p.m.position.lerpVectors(p.from, p.to, p.t); p.m.position.y += Math.sin(p.t * Math.PI) * 2.2;
    p.m.rotation.x += 0.35 * dt; p.m.rotation.z += 0.2 * dt;
    if (p.t >= 1) { landPaper(p); p.done = true; }
  }
  papers = papers.filter(p => !p.done || false);
  // customers: marker bob, in-range glow, cheer jump
  for (const c of customers) {
    c.marker.rotation.y += 0.04 * dt; c.marker.position.y = 3.0 + Math.sin(t * 3 + c.z) * 0.15;
    if (!c.done && !c.passed) {
      const inR = Math.abs(rz - c.z) <= windowW && state === 'play';
      c.ring.material.color.set(inR ? '#ffd23f' : '#ffffff'); c.ring.material.opacity = inR ? 0.95 : 0.55;
      c.ring.scale.setScalar(inR ? 1.25 + Math.sin(t * 14) * 0.08 : 1);
      c.who.armR.rotation.z = Math.sin(t * 8 + c.z) * 0.6 - 2.4; c.who.armR.rotation.x = 0;
    }
    if (c.done) { c.marker.visible = false; c.jump = Math.max(0, c.jump - 0.025 * dt); c.who.position.y = Math.abs(Math.sin(t * 10)) * 0.4 * Math.min(1, c.jump * 3); c.who.armL.rotation.z = 2.6; c.who.armR.rotation.z = -2.6; }
  }
  // camera: behind-right and above, easing
  camX = lerp(camX, crash ? camX : rider.position.x, 0.08 * dt); camZ = lerp(camZ, crash ? camZ : rz, 0.2 * dt);
  const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake; shake = Math.max(0, shake - 0.03 * dt);
  camera.position.set(camX + 1.6 + sx, 13.5 + sy, camZ + 10);
  camera.lookAt(camX - 1.1, 0, camZ - 6.5);
  stage.followLight(new THREE.Vector3(camX, 0, camZ - 4));
});

// ---------------------------------------------------------------- bot: pedal unless the next crossing would be unsafe; toss beside mailboxes
function safeToGo() {
  // simulate riding at full pedal from now: is the rider ever overlapping a car?
  let z = rz, vv = v, f = frames;
  for (let i = 0; i < 160; i++) {
    vv = Math.min(VMAX, vv + ACC); z -= vv; f += 1;
    for (const X of crossings) {
      if (z - 1.25 > X.z + X.half + 1 || z + 1 < X.z - X.half - 1) continue;
      for (const lane of X.lanes) for (const c of lane.cars) if (hitsRider(lane, c, f, z - 1.25, z + 1.2, 0.6)) return false;
    }
    if (crossings.every(X => z + 1 < X.z - X.half - 1 || z - 1.25 > X.z + X.half + 12)) { if (i > 40) break; }
  }
  return true;
}
function botStep() {
  if (state !== 'play') return;
  const c = nearestCustomer();
  if (c && !c.passed) {
    const d = rz - c.z;                                            // >0 before the mailbox
    const perStep = Math.max(v, 0.08) * 7.2;
    if (Math.abs(d) <= 0.85 || (d > 0 && d < perStep && Math.abs(d - perStep) < windowW)) { toss(); }
  }
  // near a crossing? decide go / wait (wait = brake before the stop line)
  const ahead = crossings.find(X => rz - 1.25 > X.z - X.half - 1 && rz - 1.25 - X.z - X.half < 12);
  botHold = !ahead || rz - 1.25 < ahead.z + ahead.half ? true : safeToGo();
}

buildLevel();
ui.start();

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot: botStep,
};
