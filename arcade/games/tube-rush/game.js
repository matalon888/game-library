// Tube Rush — original game. Race down a twisting water slide on an inflatable; fly off the curves to cut corners.
import { bake, vcMat } from './merge.js';
import { THREE, createStage, createUI, input, loop, burst, confetti, sfx, tone, buzz, mat, glossy, store, clamp, lerp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';

import { board } from './kit/board.js';
const WB = board({ game: 'tube-rush', label: 'Levels cleared', limits: { maxRun: 1, maxPerSec: 0.15 }, mode: 'sum' });
const R = 3.0;            // half-pipe radius
const RIM = 1.62;         // fly-off angle (rad from bottom)
const WALL = 1.78;        // geometry wall extent
const G = 9.8;
const save = store('tuberush');
const FL = flow('tuberush'); let recd = false;
const rec = (won, c) => { if (!recd) { recd = true; FL.level(won, c); } };
let level = save.get('level', 1), best = save.get('best', 0), score = 0, state = 'ready';

const { scene, camera, renderer, sun, hemi, followLight } = createStage({ fov: 58, shadowSize: 22 });
renderer.shadowMap.autoUpdate = true;
sun.shadow.camera.far = 120;
hemi.intensity = 1.25; hemi.color.set('#ffffff'); hemi.groundColor.set('#bfe9ff');
document.body.style.setProperty('--bg1', '#57c7ff'); document.body.style.setProperty('--bg2', '#d6f4ff'); document.body.style.setProperty('--ui', '#ff5d8f');
scene.fog = new THREE.Fog('#d4f2ff', 120, 420);
const ui = createUI({ title: 'TUBE<br>RUSH', hint: 'Tap left or right to steer', hand: '👆' });
const nextCard = w => (l, x) => { ui.els.win.querySelector('.hint').textContent = 'Level ' + (l + 1) + ' ▶'; w(l, x); }; ui.win = nextCard(ui.win);   // one tap → next level
ui.levels(level);

// ---------------------------------------------------------------- static world (ocean, islands, palms)
const world = new THREE.Group(); scene.add(world);
const ocean = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshStandardMaterial({ color: '#2fc4f2', roughness: 0.25, metalness: 0.05 }));
ocean.rotation.x = -Math.PI / 2; ocean.receiveShadow = true; scene.add(ocean);
function waterTex(stripes = 10, base = '#5fd6ff', line = 'rgba(255,255,255,.55)') {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256; const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, 128, 256);
  x.strokeStyle = line; x.lineWidth = 5; x.lineCap = 'round';
  for (let i = 0; i < stripes; i++) {
    const cx = Math.random() * 128, cy = Math.random() * 256, l = 20 + Math.random() * 40;
    x.lineWidth = 2 + Math.random() * 4; x.beginPath(); x.moveTo(cx, cy); x.bezierCurveTo(cx + 4, cy + l * 0.3, cx - 4, cy + l * 0.6, cx, cy + l * 1.6); x.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
const oceanTex = waterTex(8, '#2fc4f2', 'rgba(255,255,255,.16)'); oceanTex.repeat.set(40, 20); ocean.material.map = oceanTex; ocean.material.color.set('#ffffff');

const SAND = mat('#ffd98a'), GRASS = mat('#7ed957');
const islandGeo = new THREE.SphereGeometry(1, 24, 12);
const islands = new THREE.InstancedMesh(islandGeo, SAND, 40); islands.receiveShadow = true; world.add(islands);
const grassTops = new THREE.InstancedMesh(islandGeo, GRASS, 40); grassTops.receiveShadow = true; world.add(grassTops);
const trunkGeo = new THREE.CylinderGeometry(0.22, 0.38, 1, 7); trunkGeo.translate(0, 0.5, 0);
const leafGeo = new THREE.ConeGeometry(0.7, 3.4, 4, 1); leafGeo.translate(0, 1.7, 0); leafGeo.scale(1, 1, 0.25);
const MAXP = 140;
const trunks = new THREE.InstancedMesh(trunkGeo, mat('#b5793f'), MAXP); trunks.castShadow = true; world.add(trunks);
const leaves = new THREE.InstancedMesh(leafGeo, mat('#3dbb5b'), MAXP * 6); leaves.castShadow = true; world.add(leaves);
const umbGeo = new THREE.ConeGeometry(1.6, 0.6, 10); umbGeo.translate(0, 2.4, 0);
const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.4, 5); poleGeo.translate(0, 1.2, 0);
const umbs = new THREE.InstancedMesh(umbGeo, new THREE.MeshStandardMaterial({ roughness: 0.6 }), 60); umbs.castShadow = true; world.add(umbs);
const umbPoles = new THREE.InstancedMesh(poleGeo, mat('#ffffff'), 60); world.add(umbPoles);
const pillarGeo = new THREE.CylinderGeometry(0.35, 0.45, 1, 8); pillarGeo.translate(0, 0.5, 0);
const pillars = new THREE.InstancedMesh(pillarGeo, mat('#f4f1ff'), 120); pillars.castShadow = true; world.add(pillars);

// ---------------------------------------------------------------- slide
let pts = [], T = [], N = [], U = [], K = [], L = 0, slide = null, poolC = new THREE.Vector3(), POOL_R = 15;
const Y = new THREE.Vector3(0, 1, 0);
const waterSlideTex = waterTex(9, '#6fdcff', 'rgba(255,255,255,.4)'); waterSlideTex.repeat.set(1, 1);
const slideGroup = new THREE.Group(); scene.add(slideGroup);

function buildPath(r) {
  L = Math.min(760, 230 + (level - 1) * 55);
  const ctrl = []; let p = new THREE.Vector3(0, 0, 0), head = 0, i = 0;
  const steps = Math.ceil(L / 9) + 4;
  const plan = [];
  while (plan.length < steps) {               // segments: straights and bends of varied tightness/direction
    const turn = r() < 0.72 && plan.length > 2;
    const n = turn ? 2 + Math.floor(r() * 3) : 1 + Math.floor(r() * 2);
    let d = (r() < 0.5 ? -1 : 1) * (0.32 + r() * 0.22 + Math.min(level, 8) * 0.012);
    if (head + d * n > 1.35 || head + d * n < -1.35) d = -d;   // keep heading roughly downhill (-z)
    for (let k = 0; k < n; k++) plan.push(turn ? d : 0);
    if (plan.length > 2 && turn) head += d * n;
  }
  head = 0;
  for (i = 0; i < steps; i++) {
    head += plan[i];
    ctrl.push(p.clone());
    const drop = i < 2 ? 0.6 : 1.6 + r() * 1.6 + (r() < 0.12 ? 3 : 0);
    p = p.clone().add(new THREE.Vector3(Math.sin(head) * 9, -drop, -Math.cos(head) * 9));
  }
  ctrl.push(p.clone());
  // lift so the end sits just above the finish pool
  const curve = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal');
  const len = curve.getLength(); L = Math.floor(len);
  pts = curve.getSpacedPoints(L);
  const endY = pts[L].y; for (const q of pts) q.y += -endY + 2.2;
  // ease the last 14 m flat-ish into the pool
  for (let j = 0; j < 14; j++) { const q = pts[L - j]; q.y = lerp(q.y, 2.2 + j * 0.25, (14 - j) / 14); }
  T = []; N = []; U = []; K = [];
  for (let j = 0; j <= L; j++) {
    const a = pts[Math.max(0, j - 1)], b = pts[Math.min(L, j + 1)];
    const t = b.clone().sub(a).normalize(); T.push(t);
    const n = new THREE.Vector3().crossVectors(t, Y).normalize(); N.push(n);
    U.push(new THREE.Vector3().crossVectors(n, t).normalize());
  }
  for (let j = 0; j <= L; j++) {
    const a = T[Math.max(0, j - 2)], b = T[Math.min(L, j + 2)];
    K.push(b.clone().sub(a).multiplyScalar(0.25).dot(N[j]));      // signed curvature (right turn > 0)
  }
  for (let pass = 0; pass < 3; pass++) for (let j = 1; j < L; j++) K[j] = (K[j - 1] + K[j] * 2 + K[j + 1]) / 4;
  poolC.copy(pts[L]).addScaledVector(T[L], POOL_R - 2); poolC.y = 0;
}
function frameAt(s, out) {
  const i = clamp(Math.floor(s), 0, L - 1), f = clamp(s - i, 0, 1);
  out.c.lerpVectors(pts[i], pts[i + 1], f); out.t.lerpVectors(T[i], T[i + 1], f).normalize();
  out.n.lerpVectors(N[i], N[i + 1], f).normalize(); out.u.lerpVectors(U[i], U[i + 1], f).normalize(); out.k = lerp(K[i], K[i + 1], f);
  return out;
}
const mkF = () => ({ c: new THREE.Vector3(), t: new THREE.Vector3(), n: new THREE.Vector3(), u: new THREE.Vector3(), k: 0 });
function sweep(rad, a0, a1, na, colorFn, step = 1) {
  const rows = Math.floor(L / step) + 1, pos = [], col = [], uv = [], idx = [], c = new THREE.Color();
  for (let r = 0; r < rows; r++) {
    const j = Math.min(L, r * step);
    for (let k = 0; k <= na; k++) {
      const a = lerp(a0, a1, k / na), sn = Math.sin(a), cs = Math.cos(a);
      const p = pts[j].clone().addScaledVector(N[j], sn * rad).addScaledVector(U[j], -cs * rad);
      pos.push(p.x, p.y, p.z); uv.push(k / na, j / 6);
      c.set(colorFn(j, a)); col.push(c.r, c.g, c.b);
    }
  }
  for (let r = 0; r < rows - 1; r++) for (let k = 0; k < na; k++) {
    const a = r * (na + 1) + k, b = a + na + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
const THEMES = [
  { a: '#9b7bff', b: '#ffffff', water: '#6fdcff' }, { a: '#ff6fa8', b: '#ffffff', water: '#6fdcff' },
  { a: '#ffb02e', b: '#ffffff', water: '#62d2ff' }, { a: '#2ec4b6', b: '#ffffff', water: '#7fe3ff' },
];
function buildSlide() {
  slideGroup.clear();
  const th = THEMES[(level - 1) % THEMES.length];
  const inner = sweep(R, -WALL, WALL, 22, (j, a) => (Math.floor(j / 4) % 2 ? th.a : th.b));
  const m1 = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, side: THREE.DoubleSide });
  const s1 = new THREE.Mesh(inner, m1); s1.receiveShadow = true; s1.castShadow = true; slideGroup.add(s1);
  const outer = sweep(R + 0.28, -WALL, WALL, 14, () => '#ffffff', 2);
  const s2 = new THREE.Mesh(outer, new THREE.MeshStandardMaterial({ color: '#f2f6ff', roughness: 0.5, side: THREE.BackSide })); s2.castShadow = true; slideGroup.add(s2);
  // water film in the bottom of the tube, scrolling
  const wg = sweep(R - 0.04, -1.0, 1.0, 10, () => '#ffffff');
  const wm = new THREE.MeshStandardMaterial({ map: waterSlideTex, transparent: true, opacity: 0.85, roughness: 0.1, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 });
  waterSlideTex.repeat.set(1, 0.6);
  const w = new THREE.Mesh(wg, wm); w.receiveShadow = true; slideGroup.add(w);
  // rim lips
  for (const sgn of [-1, 1]) {
    const rimPts = []; for (let j = 0; j <= L; j += 2) rimPts.push(pts[j].clone().addScaledVector(N[j], Math.sin(WALL * sgn) * (R + 0.14)).addScaledVector(U[j], -Math.cos(WALL) * (R + 0.14)));
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts), rimPts.length, 0.2, 6), mat('#ffffff')); tube.castShadow = true; slideGroup.add(tube);
  }
  // start deck
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 1, 24), mat(th.a)); deck.position.copy(pts[0]).add(new THREE.Vector3(0, -R - 0.2, 4)); deck.castShadow = deck.receiveShadow = true; slideGroup.add(deck);
  // finish pool + arch
  const pool = new THREE.Group(); pool.position.copy(poolC); slideGroup.add(pool);
  const rimP = new THREE.Mesh(new THREE.CylinderGeometry(POOL_R + 1.2, POOL_R + 1.4, 1.6, 40), mat('#ffffff')); rimP.position.y = 0.6; rimP.receiveShadow = rimP.castShadow = true; pool.add(rimP);
  const pw = new THREE.Mesh(new THREE.CylinderGeometry(POOL_R, POOL_R, 0.2, 40), new THREE.MeshStandardMaterial({ map: waterTex(10, '#3fd0ff', 'rgba(255,255,255,.6)'), roughness: 0.1 }));
  pw.position.y = 1.35; pw.receiveShadow = true; pool.add(pw);
  const ck = document.createElement('canvas'); ck.width = 256; ck.height = 32; const x = ck.getContext('2d');
  for (let i = 0; i < 16; i++) for (let k = 0; k < 2; k++) { x.fillStyle = (i + k) % 2 ? '#222' : '#fff'; x.fillRect(i * 16, k * 16, 16, 16); }
  const banner = new THREE.Mesh(new THREE.BoxGeometry(9, 1.2, 0.3), [mat('#fff'), mat('#fff'), mat('#fff'), mat('#fff'), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(ck) }), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(ck) })]);
  const e = L - 4, archC = pts[e].clone();
  banner.position.copy(archC).addScaledVector(U[e], 4.2); banner.lookAt(archC.clone().add(T[e]).addScaledVector(U[e], 4.2)); slideGroup.add(banner);
  for (const sgn of [-1, 1]) { const po = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 9, 8), mat('#ffd23f')); po.position.copy(archC).addScaledVector(N[e], sgn * 4.4).add(new THREE.Vector3(0, 0.6, 0)); po.castShadow = true; slideGroup.add(po); }
  // pillars
  let pc = 0; const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  for (let j = 6; j < L - 6 && pc < 120; j += Math.max(9, Math.floor(L / 110))) {
    const base = pts[j].clone().addScaledVector(U[j], -R - 0.25); const h = Math.max(0.1, base.y);
    m.compose(new THREE.Vector3(base.x, 0, base.z), q.identity(), sc.set(1, h, 1)); pillars.setMatrixAt(pc++, m);
  }
  pillars.count = pc; pillars.instanceMatrix.needsUpdate = true;
}
function nearSlide(x, z, pad) {
  for (let j = 0; j <= L; j += 3) { const dx = pts[j].x - x, dz = pts[j].z - z; if (dx * dx + dz * dz < pad * pad) return true; }
  return Math.hypot(poolC.x - x, poolC.z - z) < POOL_R + pad;
}
function buildScenery(r) {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  const isl = [];
  for (let i = 0; i < 40; i++) {
    const x = lerp(minX - 60, maxX + 60, r()), z = lerp(minZ - 40, maxZ + 30, r()), rad = 8 + r() * 18;
    if (Math.hypot(poolC.x - x, poolC.z - z) < POOL_R + rad + 2) { i--; if (r() < 0.02) break; continue; }
    isl.push({ x, z, rad });
    m.compose(new THREE.Vector3(x, -0.6, z), q.identity(), new THREE.Vector3(rad, 1.6, rad)); islands.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(x, -0.2, z), q.identity(), new THREE.Vector3(rad * 0.72, 1.55, rad * 0.72)); grassTops.setMatrixAt(i, m);
  }
  islands.count = grassTops.count = isl.length; islands.instanceMatrix.needsUpdate = grassTops.instanceMatrix.needsUpdate = true;
  let pc = 0, lc = 0, uc = 0;
  for (let tries = 0; tries < 900 && pc < MAXP; tries++) {
    const is = isl[Math.floor(r() * isl.length)]; if (!is) break;
    const a = r() * 6.28, d = r() * is.rad * 0.85, x = is.x + Math.cos(a) * d, z = is.z + Math.sin(a) * d;
    if (nearSlide(x, z, 4.5)) continue;
    if (r() < 0.75) {
      const h = 4 + r() * 4, lean = (r() - 0.5) * 0.4;
      m.compose(new THREE.Vector3(x, 0.8, z), q.setFromEuler(e.set(lean, 0, lean * 0.5)), new THREE.Vector3(1, h, 1)); trunks.setMatrixAt(pc++, m);
      for (let k = 0; k < 6; k++) {
        m.compose(new THREE.Vector3(x + lean * h * 0.5, 0.8 + h - 0.2, z - lean * h * 0.25), q.setFromEuler(e.set(1.25 + r() * 0.3, k * 1.05 + r() * 0.3, 0, 'YXZ')), new THREE.Vector3(1, 1, 1)); leaves.setMatrixAt(lc++, m);
      }
    } else if (uc < 60) {
      m.compose(new THREE.Vector3(x, 0.8, z), q.identity(), new THREE.Vector3(1, 1, 1)); umbs.setMatrixAt(uc, m); umbPoles.setMatrixAt(uc, m);
      umbs.setColorAt(uc, new THREE.Color(['#ff5d8f', '#ffd23f', '#7b5cff', '#ff8c42', '#ffffff'][uc % 5])); uc++;
    }
  }
  trunks.count = pc; leaves.count = lc; umbs.count = umbPoles.count = uc;
  for (const im of [trunks, leaves, umbs, umbPoles]) im.instanceMatrix.needsUpdate = true;
  if (umbs.instanceColor) umbs.instanceColor.needsUpdate = true;
}

// ---------------------------------------------------------------- riders
const SKINS = [
  { body: '#ffd23f', ring: '#ff5d8f', ear: 'cat' }, { body: '#3a2e39', ring: '#3ab795', ear: 'peng' }, { body: '#ff8c42', ring: '#3a86ff', ear: 'fox' },
  { body: '#ffffff', ring: '#ff4d6d', ear: 'bunny' }, { body: '#8d6e63', ring: '#ffd166', ear: 'bear' }, { body: '#7b5cff', ring: '#00c2a8', ear: 'cat' },
  { body: '#ff6fa8', ring: '#fdfdfd', ear: 'bear' },
];
const PLAYER_SKIN = { body: '#ffffff', ring: '#ffb703', ear: 'bunny', hat: '#ff2e63' };
const GEO = { sph: new THREE.SphereGeometry(1, 18, 12), cap: new THREE.CapsuleGeometry(1, 1, 4, 8), cone: new THREE.ConeGeometry(1, 1, 8), cyl: new THREE.CylinderGeometry(1, 1, 1, 16), tor: new THREE.TorusGeometry(0.62, 0.3, 12, 26), cap2: new THREE.SphereGeometry(1, 16, 8, 0, 6.28, 0, 1.3) };
const RMAT = vcMat({ roughness: 0.28 });
function makeRider(skin) {
  const g = new THREE.Group(), b = skin.body, P = [];
  const ring = new THREE.Mesh(bake([{ geo: GEO.tor, color: skin.ring, rot: [Math.PI / 2, 0, 0], pos: [0, 0.3, 0] }]), RMAT); ring.castShadow = true; g.add(ring);
  P.push({ geo: GEO.sph, color: b, pos: [0, 0.72, 0], scl: [0.5, 0.55, 0.47] }, { geo: GEO.sph, color: b, pos: [0, 1.42, 0.05], scl: 0.42 },
    { geo: GEO.sph, color: skin.ear === 'peng' ? '#ffffff' : '#fff1e0', pos: [0, 0.7, 0.3], scl: [0.36, 0.4, 0.18] },
    { geo: GEO.cone, color: skin.ear === 'peng' ? '#ffa62b' : '#ff7aa2', pos: [0, 1.38, 0.5], rot: [Math.PI / 2, 0, 0], scl: [0.09, 0.2, 0.09] });
  for (const sx of [-1, 1]) {
    P.push({ geo: GEO.sph, color: '#ffffff', pos: [sx * 0.15, 1.5, 0.39], scl: 0.11 }, { geo: GEO.sph, color: '#1b1b2f', pos: [sx * 0.15, 1.5, 0.48], scl: 0.06 });
    if (skin.ear === 'bunny') P.push({ geo: GEO.cap, color: b, pos: [sx * 0.17, 1.95, -0.02], rot: [0, 0, -sx * 0.18], scl: [0.09, 0.45, 0.09] });
    else if (skin.ear === 'cat' || skin.ear === 'fox') P.push({ geo: GEO.cone, color: b, pos: [sx * 0.24, 1.82, 0], rot: [0, 0, -sx * 0.35], scl: [0.14, 0.3, 0.14] });
    else if (skin.ear === 'bear') P.push({ geo: GEO.sph, color: b, pos: [sx * 0.3, 1.76, 0], scl: 0.13 });
    P.push({ geo: GEO.cap, color: b, pos: [sx * 0.52, 0.85, 0.05], rot: [0, 0, sx * 2.3], scl: [0.1, 0.3, 0.1] });
  }
  if (skin.hat) P.push({ geo: GEO.cap2, color: skin.hat, pos: [0, 1.5, 0.02], rot: [-0.15, 0, 0], scl: 0.44 }, { geo: GEO.cyl, color: skin.hat, pos: [0, 1.67, 0.42], scl: [0.3, 0.05, 0.39] });
  const body = new THREE.Mesh(bake(P), RMAT); body.castShadow = true; g.add(body);
  g.body = body; g.scale.setScalar(0.95); scene.add(g); return g;
}
let riders = [], player = null, finished = 0, raceT = 0;
const F = mkF(), F2 = mkF(), tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), basis = new THREE.Matrix4();
function surf(s, th, rr, out) { frameAt(s, F2); return out.copy(F2.c).addScaledVector(F2.n, Math.sin(th) * rr).addScaledVector(F2.u, -Math.cos(th) * rr); }

function spawnRiders(r) {
  for (const rd of riders) scene.remove(rd.g);
  riders = [];
  const nb = 6, botBase = (15.2 + Math.min(level, 12) * 0.22) * FL.k();
  for (let i = 0; i <= nb; i++) {
    const isP = i === nb, skin = isP ? PLAYER_SKIN : SKINS[i % SKINS.length];
    const rd = { g: makeRider(skin), isP, s: isP ? 2 : 4 + (nb - i) * 2.6 + r() * 1.5, th: isP ? 0 : (i % 3 - 1) * 0.55, om: 0, v: 0,
      vmax: isP ? 18.6 : botBase + r() * 1.6 - (level < 3 ? 1.2 : 0), air: false, P: new THREE.Vector3(), V: new THREE.Vector3(), out: false, done: false, place: 0,
      lane: (r() - 0.5) * 1.0, daring: isP ? 0 : 0.15 + r() * 0.35 + Math.min(level, 10) * 0.03, care: isP ? 1 : 0.35 + r() * 0.65 + Math.min(level, 10) * 0.03, wob: r() * 10, spin: 0, landS: 0, tilt: 0, bump: 0 };
    riders.push(rd); if (isP) player = rd;
    placeOnSlide(rd);
  }
}
function placeOnSlide(rd) {
  frameAt(rd.s, F); const rr = R - 0.5;
  rd.P.copy(F.c).addScaledVector(F.n, Math.sin(rd.th) * rr).addScaledVector(F.u, -Math.cos(rd.th) * rr);
  const up = tmpV.copy(F.n).multiplyScalar(-Math.sin(rd.th)).addScaledVector(F.u, Math.cos(rd.th)).normalize();
  const fwd = tmpV2.copy(F.t); const x = new THREE.Vector3().crossVectors(up, fwd).normalize();
  const fz = new THREE.Vector3().crossVectors(x, up);
  basis.makeBasis(x, up, fz); rd.g.position.copy(rd.P); rd.g.quaternion.setFromRotationMatrix(basis);
}

// ---------------------------------------------------------------- level
function buildLevel() {
  const r = rng(level * 7919 + 13);
  buildPath(r); buildSlide(); buildScenery(r); spawnRiders(r);
  finished = 0; raceT = 0; recd = false; ui.levels(level); ui.progress(0); ui.score(''); ui.sub(best ? 'BEST ' + best : '');
  camPos.copy(player.P).add(new THREE.Vector3(0, 6, 9)); camLook.copy(player.P);
}

// ---------------------------------------------------------------- input
let steer = 0, botOn = false, tapSteer = 0;   // tapSteer: a tap = a short push toward that side (fed in over a few frames)
input({ onDown: () => { botOn = false; }, onMove: (dx) => { if (state === 'play') steer += dx; }, onTap: (e) => { if (state === 'play') tapSteer = (e.clientX < innerWidth / 2 ? -1 : 1) * 55; } });
const sky = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 16), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
{ const p = sky.geometry.attributes.position, c = [], a = new THREE.Color('#d4f2ff'), b = new THREE.Color('#3fb6f5'), k = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const y = Math.max(0, p.getY(i) / 450); k.copy(a).lerp(b, Math.pow(y, 0.6)); c.push(k.r, k.g, k.b); }
  sky.geometry.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); }
scene.add(sky);
ui.onTap(w => { WB.start();
  if (w === 'start') { state = 'play'; sfx.tap(); go(); }
  else if (w === 'win') { level++; save.set('level', level); buildLevel(); state = 'play'; go(); }
  else if (w === 'lose') { score = 0; buildLevel(); state = 'play'; go(); }
});
function go() { ui.pop('GO!', '#fff', 64, 30); tone(660, 0.12, 'triangle', 0.14, 1.4); buzz(15); }

const ord = (n) => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');
function rank() { // live place among riders still racing + already finished
  let p = 1; for (const o of riders) if (o !== player && !o.out && (o.done ? (!player.done || o.place < player.place) : (!player.done && o.s > player.s))) p++;
  return player.done ? player.place : p;
}

// ---------------------------------------------------------------- physics
function stepRider(rd, dt) {
  const sec = dt / 60;
  if (rd.out) { rd.V.y -= G * sec * 0.6; rd.P.addScaledVector(rd.V, sec); if (rd.P.y < 0.4) { rd.P.y = 0.4; rd.V.multiplyScalar(0.9); } rd.g.position.copy(rd.P); rd.g.rotation.y += 0.02 * dt; return; }
  if (rd.done) {           // floating in the finish pool
    rd.V.multiplyScalar(Math.pow(0.97, dt)); rd.P.addScaledVector(rd.V, sec);
    const d = tmpV.set(rd.P.x - poolC.x, 0, rd.P.z - poolC.z); if (d.length() > POOL_R - 1.2) { d.setLength(POOL_R - 1.2); rd.P.x = poolC.x + d.x; rd.P.z = poolC.z + d.z; rd.V.multiplyScalar(-0.3); }
    rd.P.y = 1.45 + Math.sin(raceT * 3 + rd.wob) * 0.08; rd.g.position.copy(rd.P);
    rd.g.quaternion.slerp(new THREE.Quaternion().setFromAxisAngle(Y, Math.atan2(rd.V.x, rd.V.z) || 0), 0.05);
    rd.g.body.rotation.z = Math.sin(raceT * 6 + rd.wob) * 0.15; return;
  }
  if (rd.air) {
    rd.airT = (rd.airT || 0) + sec;
    rd.V.y -= G * sec * (rd.airT > 1.8 ? 1.6 : 0.78);
    // homing: curve the flight toward the furthest piece of slide we can still reach (the "shortcut" feel)
    if (((rd.tick = (rd.tick || 0) + 1) % 6) === 1) rd.tgt = findTarget(rd.P, rd.V, rd.landS);
    if (rd.tgt >= 0) {
      const c = pts[rd.tgt], dx = c.x - rd.P.x, dz = c.z - rd.P.z, d = Math.hypot(dx, dz) || 1, vh = Math.hypot(rd.V.x, rd.V.z) || 1;
      const cur = Math.atan2(rd.V.x, rd.V.z), want = Math.atan2(dx, dz); let da = want - cur; da = Math.atan2(Math.sin(da), Math.cos(da));
      const na = cur + clamp(da, -2.2 * sec, 2.2 * sec); const sp = d < 4 ? vh * 0.96 : vh; if (d < 7 && rd.P.y > c.y + 0.5) rd.V.y -= 30 * sec;
      rd.V.x = Math.sin(na) * sp; rd.V.z = Math.cos(na) * sp;
    }
    if (rd.isP) { frameAt(Math.min(L, rd.landS), F); const side = tmpV.crossVectors(rd.V, Y).normalize(); rd.V.addScaledVector(side, steerAir * 0.06); }
    rd.P.addScaledVector(rd.V, sec);
    rd.spin += dt * 0.08;
    rd.g.position.copy(rd.P);
    const hd = Math.atan2(rd.V.x, rd.V.z); rd.g.rotation.set(-0.35 + Math.sin(rd.spin) * 0.15, hd, Math.sin(rd.spin * 0.7) * 0.25, 'YXZ');
    // landing on a later part of the slide?
    if (rd.V.y < 0) {
      for (let j = Math.max(Math.floor(rd.landS) + 4, rd.tgt >= 0 ? rd.tgt - 8 : 0); j <= L; j++) {
        const c = pts[j], dx = rd.P.x - c.x, dz = rd.P.z - c.z;
        if (dx * dx + dz * dz < (R + 0.4) * (R + 0.4) && rd.P.y < c.y + 0.8 && rd.P.y > c.y - R * 0.95) {
          const d = tmpV.subVectors(rd.P, c); rd.th = clamp(Math.atan2(d.dot(N[j]), -d.dot(U[j])), -1.2, 1.2); rd.om = 0;
          const gained = j - rd.landS; rd.s = j; rd.air = false; rd.v = Math.max(rd.v, Math.hypot(rd.V.x, rd.V.z) * 0.95);
          burst(scene, rd.P, ['#ffffff', '#9be7ff'], 14, { speed: 0.16, up: 0.12, shape: 'sphere', size: 1.4 });
          if (rd.isP) { sfx.bounce(); buzz(25); window.__cuts = (window.__cuts || 0) + 1; if (gained > 18) { ui.pop(gained > 50 ? 'MEGA SHORTCUT!' : 'SHORTCUT!', '#ff3d7f', 42, 24); score += Math.round(gained); ui.flash(0.35); tone(880, 0.18, 'triangle', 0.14, 1.5); } }
          return;
        }
      }
      // splash into the finish pool = finished
      if (Math.hypot(rd.P.x - poolC.x, rd.P.z - poolC.z) < POOL_R - 0.5 && rd.P.y < 2.4) { finish(rd); return; }
      if (rd.P.y < 0.6) { wipeout(rd); return; }
    }
    return;
  }
  // on the slide
  frameAt(rd.s, F);
  const slope = -F.t.y;
  const vt = rd.vmax * (0.82 + slope * 1.6) + (rd.isP ? 0 : 0) - rd.bump;
  rd.bump = Math.max(0, rd.bump - sec * 6);
  rd.v = lerp(rd.v, vt, 1 - Math.pow(0.985, dt));
  if (raceT < 0.6) rd.v = Math.max(rd.v, 6);
  const acf = -rd.v * rd.v * F.k;                   // centrifugal (push toward +N when > 0)
  const acc = (acf * Math.cos(rd.th) - G * Math.sin(rd.th)) / R;
  rd.om += acc * sec - rd.om * 2.6 * sec;
  if (rd.isP) {
    rd.th += steer * 0.0085; rd.om += steer * 0.012; steer = 0;
    if (botOn) { const tgt = botTarget(rd); rd.th += clamp(tgt - rd.th, -0.06, 0.06) * dt; rd.om *= 0.8; }
  } else {
    rd.wob += sec;
    if ((rd.jt = (rd.jt || 0) - sec) <= 0) { rd.jt = 0.25; const [gain, sg] = shortcutGain(rd); if (gain > 30 && Math.random() < rd.daring) { rd.th = sg * (RIM + 0.02); return launch(rd); } }
    const tgt = rd.lane + Math.sin(rd.wob * 0.9) * 0.35;
    const want = clamp(tgt - rd.th, -1, 1) * rd.care * 0.05 * dt;
    rd.th += want;
    rd.om *= 1 - 0.04 * rd.care * dt;
  }
  rd.th += rd.om * sec;
  if (rd.jumpNow) { rd.th = rd.jumpNow * (RIM + 0.02); rd.jumpNow = 0; }
  if (Math.abs(rd.th) > RIM) return launch(rd);
  rd.s += rd.v * sec;
  if (rd.s >= L - 0.5) { rd.air = true; rd.airT = 0; rd.V.copy(T[L]).multiplyScalar(rd.v).add(new THREE.Vector3(0, 3, 0)); rd.landS = L; return; }
  placeOnSlide(rd);
  // lean + paddle
  rd.g.body.rotation.z = clamp(-rd.om * 0.25, -0.5, 0.5); rd.g.body.rotation.x = -0.15 - Math.min(0.3, slope);
  if (rd.isP && Math.random() < 0.35 * dt) {                       // spray behind the player
    const pos = rd.P.clone().addScaledVector(F.t, -0.8).addScaledVector(F.u, 0.1);
    burst(scene, pos, '#e8fbff', 1, { speed: 0.04, up: 0.05, shape: 'sphere', size: 0.8, gravity: 0.008 });
  }
}
let steerAir = 0;
function findTarget(P, V, fromS) {   // furthest slide sample reachable by the current ballistic arc (horizontal speed kept)
  const vh = Math.max(8, Math.hypot(V.x, V.z)); let best = -1;
  for (let j = Math.floor(fromS) + 8; j <= Math.min(L, fromS + 260); j += 2) {
    const c = pts[j], d = Math.hypot(c.x - P.x, c.z - P.z); if (d > 55) continue;
    const t = d / vh, y = P.y + V.y * t - 0.5 * G * 0.78 * t * t;
    if (y > c.y - 0.5 && y < c.y + 14 + t * 2) best = j;
  }
  return best;
}
function launchVel(rd, sgn, out) { frameAt(rd.s, F); return out.copy(F.t).multiplyScalar(rd.v).addScaledVector(F.n, sgn * (2.2 + Math.abs(rd.om) * R * 0.5)).addScaledVector(Y, 4.2); }
const JV = new THREE.Vector3();
function shortcutGain(rd) {          // if we jumped off the outside wall right now, how many metres would we skip?
  frameAt(rd.s, F); const sgn = F.k > 0 ? -1 : 1; if (Math.abs(F.k) < 0.035) return [0, sgn];
  launchVel(rd, sgn, JV); const j = findTarget(rd.P, JV, rd.s); return [j < 0 ? 0 : j - rd.s, sgn];
}
function launch(rd) {
  frameAt(rd.s, F);
  const sgn = Math.sign(rd.th);
  rd.air = true; rd.landS = rd.s; rd.airT = 0;
  launchVel(rd, sgn, rd.V); rd.tgt = -1; rd.tick = 0;
  burst(scene, rd.P, ['#ffffff', '#9be7ff'], 12, { speed: 0.14, up: 0.1, shape: 'sphere', size: 1.2 });
  if (rd.isP) { sfx.pick(3); buzz(20); ui.pop('AIR!', '#ff8c42', 44, 24); }
}
function wipeout(rd) {
  rd.out = true; rd.air = false; rd.V.set(rd.V.x * 0.2, 0, rd.V.z * 0.2);
  burst(scene, new THREE.Vector3(rd.P.x, 0.5, rd.P.z), ['#ffffff', '#9be7ff', '#5fd6ff'], 26, { speed: 0.2, up: 0.25, shape: 'sphere', size: 1.6 });
  if (rd.isP) { state = 'lost'; rec(false, player.s / L); sfx.fail(); buzz([40, 30, 60]); ui.flash(0.5); ui.lose('SPLASH!', 'You flew off the slide'); }
  else if (Math.hypot(rd.P.x - player.P.x, rd.P.z - player.P.z) < 40) { tone(300, 0.1, 'sine', 0.06, 0.5); }
}
function finish(rd) {
  rd.done = true; rd.air = false; rd.place = ++finished; rd.V.set(rd.V.x * 0.5, 0, rd.V.z * 0.5);
  burst(scene, rd.P, ['#ffffff', '#9be7ff'], 22, { speed: 0.2, up: 0.2, shape: 'sphere', size: 1.6 });
  if (rd.isP) {
    const p = rd.place; ui.score(ord(p)); ui.progress(1);
    if (p <= 3) {
      state = 'won'; rec(true); WB.submit(1); score += [0, 300, 200, 120][p] + level * 10; best = Math.max(best, score); save.set('best', best);
      sfx.win(); buzz([20, 40, 20]); ui.flash(0.6); confetti(scene, rd.P.clone().add(new THREE.Vector3(0, 3, 0)), 90);
      setTimeout(() => confetti(scene, rd.P.clone().add(new THREE.Vector3(0, 4, 0)), 60), 300);
      ui.pop(p === 1 ? '1ST PLACE!' : ord(p).toUpperCase() + ' PLACE!', '#ffd23f', 52, 30);
      ui.win(level, `You finished ${ord(p)}!`);
    } else { state = 'lost'; rec(false, (7 - p) / 4); sfx.fail(); ui.lose(ord(p).toUpperCase() + '...', 'Top 3 to clear the level'); }
  }
}
function botTarget(rd) {        // the QA bot: hug the inside of curves a bit, dodge riders just ahead
  let tgt = clamp(F.k * -60, -0.6, 0.6) * 0;
  for (const o of riders) if (o !== rd && !o.air && !o.out && !o.done && o.s > rd.s && o.s - rd.s < 6 && Math.abs(o.th - tgt) < 0.5) tgt = o.th > 0 ? o.th - 0.75 : o.th + 0.75;
  return clamp(tgt, -1.0, 1.0);
}
function bumps() {
  for (let i = 0; i < riders.length; i++) for (let j = i + 1; j < riders.length; j++) {
    const a = riders[i], b = riders[j];
    if (a.air || b.air || a.out || b.out || a.done || b.done) continue;
    const ds = a.s - b.s, dth = (a.th - b.th) * R;
    if (Math.abs(ds) < 1.5 && Math.abs(dth) < 1.15) {
      const push = Math.sign(dth || 1) * 1.8;
      a.om += push; b.om -= push;
      const back = ds > 0 ? b : a, front = ds > 0 ? a : b; front.v += 0.6; back.bump = 2;
      if (a.isP || b.isP) {
        const other = a.isP ? b : a; sfx.bounce(); buzz(18); ui.pop('BUMP!', '#ff5d8f', 40, 24);
        burst(scene, player.P.clone().lerp(other.P, 0.5), ['#ffffff', '#9be7ff'], 10, { speed: 0.12, up: 0.1, shape: 'sphere' });
        other.om += Math.sign(other.th - player.th || 1) * 1.5;   // the player hits harder
      }
    }
  }
}

// ---------------------------------------------------------------- camera + loop
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
let shake = 0;
let fpsN = 0, fpsT = 0, fps = 0;
loop((dt, t) => {
  fpsN++; if (t - fpsT > 1) { fps = fpsN / (t - fpsT); fpsN = 0; fpsT = t; }
  const sec = dt / 60;
  if (state === 'play' || state === 'won' || state === 'lost') {
    if (state === 'play') raceT += sec;
    if (tapSteer) { const k = tapSteer * Math.min(1, 0.25 * dt); steer += k; tapSteer -= k; if (Math.abs(tapSteer) < 1) tapSteer = 0; }
    steerAir = player.air ? clamp(steer * 0.12, -3, 3) : 0; if (player.air) steer = 0;
    if (state === 'play' || state === 'won' || player.out) for (const rd of riders) if (state === 'play' || !rd.isP || rd.done) stepRider(rd, dt);
    if (state === 'lost' && !player.out) for (const rd of riders) if (!rd.isP) stepRider(rd, dt);
    bumps();
    if (state === 'play') {
      ui.progress(player.s / L);
      ui.score(ord(rank()));
    }
  }
  waterSlideTex.offset.y -= 0.02 * dt; oceanTex.offset.x += 0.0004 * dt;
  // camera: behind and above the player along the slide; pulls up when airborne
  const p = player.P;
  let want, look;
  if (player.done || player.out) { want = tmpV.set(poolC.x + Math.sin(t * 0.3) * 24, 16, poolC.z + Math.cos(t * 0.3) * 24); look = p; }
  else if (player.air) { const v = tmpV2.copy(player.V).setY(0).normalize(); want = tmpV.copy(p).addScaledVector(v, -8.5).add(new THREE.Vector3(0, 7.5, 0)); look = p.clone().addScaledVector(v, 8).add(new THREE.Vector3(0, -3, 0)); }
  else { frameAt(Math.max(0, player.s - 8.5), F); frameAt(player.s, F2);
    want = tmpV.copy(F.c).addScaledVector(Y, 6.6).addScaledVector(F2.n, Math.sin(player.th) * 0.8); look = F2.c.clone().addScaledVector(F2.t, 7).addScaledVector(Y, -1.2); }
  camPos.lerp(want, 1 - Math.pow(0.88, dt)); camLook.lerp(look, 1 - Math.pow(0.85, dt));
  camera.position.copy(camPos); if (shake > 0) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; shake *= 0.9; }
  camera.lookAt(camLook); sky.position.copy(camera.position).setY(0);
  followLight(p);
});

buildLevel();

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; }, get fps() { return Math.round(fps); }, gains() { const out = []; const fake = { s: 0, v: 22, om: 0, th: 0, P: new THREE.Vector3() }; for (let x = 5; x < L - 10; x += 3) { fake.s = x; frameAt(x, F); fake.P.copy(F.c).addScaledVector(F.u, -R + 0.5); const [g] = shortcutGain(fake); if (g > 0) out.push([x, Math.round(g), +F.k.toFixed(3)]); } return out; }, jump() { player.th = RIM + 0.01; }, get dbg() { return { cuts: window.__cuts,  s: player.s, th: player.th, air: player.air, out: player.out, done: player.done, L, y: player.P.y }; },
  bot() { if (state !== 'play') return; botOn = true; if (!player.air && !player.done) { const [gain, sg] = shortcutGain(player); if (gain > 22) player.jumpNow = sg; } },
};
