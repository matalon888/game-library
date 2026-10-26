// Slimeplow — original side-view smash-driving game. Hold gas, fly the ramps, plow through a goofy slime horde,
// earn parts by distance, upgrade the truck in the garage and reach the rescue blimp at the end of each of 5 roads.
import { THREE, createStage, createUI, store, loop, buzz, tone, note, sfx, burst, confetti, lerp, clamp, rng, rounded, mat, glossy } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';

const NAME = 'Slimeplow: Car Smash Driving';
const S = store('slimeplow');
const F = flow('slimeplow');
const stage = createStage({ fov: 42, shadowSize: 16 });
const { scene, camera, sun, hemi, renderer } = stage;
const ui = createUI({ title: 'SLIME<br>PLOW', hint: 'Hold right to drive · left to brake', hand: '🚚' });
const D = daily('slimeplow', ui, { name: NAME });
const B = board({ game: 'slimeplow', label: 'Best distance (m)', mode: 'best', limits: { maxRun: 4000, maxPerSec: 60 }, corner: 'tl' });
ui.els.win.querySelector('p').innerHTML = 'ROAD <span data-l>1</span>';

// ---------------------------------------------------------------- stages
const STAGES = [
  { name: 'Meadow Run', len: 500, bg: ['#8fdcff', '#e6fbff'], top: '#7fd36b', road: '#c9a46a', face: '#b5814f', deep: '#7a5235', hill: ['#a8e6a0', '#c9f0c4'], blob: ['#7be05a', '#b6f04a', '#ff8fd0'], deco: 'tree', dens: 0.15, ramp: 0.3 },
  { name: 'Sunny Dunes', len: 800, bg: ['#ffcf8f', '#fff2d6'], top: '#f2c879', road: '#e0b06a', face: '#d99a55', deep: '#9c6236', hill: ['#ffd9a0', '#ffe9c4'], blob: ['#ff8fb0', '#ff9f43', '#ffd23f'], deco: 'cactus', dens: 0.18, ramp: 0.34 },
  { name: 'Bubble Bog', len: 1100, bg: ['#a9e3c4', '#eef8de'], top: '#6fae6a', road: '#8d7650', face: '#7a5b3d', deep: '#4a3626', hill: ['#8fcf9a', '#b9e3b5'], blob: ['#a77bff', '#d16bff', '#7b5cff'], deco: 'shroom', dens: 0.21, ramp: 0.36 },
  { name: 'Frosty Pass', len: 1400, bg: ['#bfe0ff', '#f6fbff'], top: '#f4fbff', road: '#c6d5ea', face: '#9fb7d6', deep: '#5f7aa3', hill: ['#dceaff', '#eef5ff'], blob: ['#3fd0e0', '#5aa9ff', '#7ef0c9'], deco: 'pine', dens: 0.24, ramp: 0.38 },
  { name: 'Gloomworks', len: 1800, bg: ['#2f3463', '#8a72b8'], top: '#8a8fa8', road: '#6d7189', face: '#4b4f66', deep: '#2a2c3d', hill: ['#4a4f80', '#5d5a92'], blob: ['#ff5dbb', '#ffe14d', '#5dffb0'], deco: 'chimney', dens: 0.27, ramp: 0.4, night: true },
];

// ---------------------------------------------------------------- upgrades
const UPG = [
  { id: 'engine', ic: '⚙️', name: 'Engine', d: 'Faster, more push', cost: [60, 140, 260, 420, 650] },
  { id: 'fuel', ic: '⛽', name: 'Fuel tank', d: 'Drive longer', cost: [40, 100, 190, 320, 500] },
  { id: 'plow', ic: '🛡️', name: 'Plow & armor', d: 'Smash blobs, take less goo', cost: [70, 160, 290, 460, 700] },
  { id: 'boost', ic: '🔥', name: 'Booster', d: 'Rocket push, more charge', cost: [80, 170, 300, 480, 720] },
  { id: 'tires', ic: '🛞', name: 'Tires', d: 'Grip and bounce', cost: [50, 120, 220, 360, 560] },
];
let parts = S.get('parts', 0), lv = S.get('lv', { engine: 0, fuel: 0, plow: 0, boost: 0, tires: 0 });
let unlocked = S.get('unlocked', 1), stageN = Math.min(S.get('stage', 1), unlocked), runs = S.get('runs', 0);
const bestOf = n => S.get('best_s' + n, 0);

// ---------------------------------------------------------------- terrain
const DX = 1;
let H = new Float32Array(10), ST, evacX = 500, seed = 1;
const ground = x => { const f = x / DX; let i = Math.floor(f); if (i < 0) return H[0]; if (i >= H.length - 1) return H[H.length - 1]; const t = f - i; return H[i] * (1 - t) + H[i + 1] * t; };
const slope = x => (ground(x + 0.5) - ground(x - 0.5));
let terrainMesh = null, faceMesh = null;
const C = new THREE.Color();
function genTerrain(r) {
  const len = ST.len, N = len + 260;
  H = new Float32Array(N);
  const A1 = 2.2 + stageN * 0.55, p1 = r() * 6, p2 = r() * 6, p3 = r() * 6;
  for (let i = 0; i < N; i++) { const x = i * DX; H[i] = A1 * Math.sin(x * 0.03 + p1) + 0.9 * Math.sin(x * 0.11 + p2) + 0.35 * Math.sin(x * 0.27 + p3) + x * 0.004 * stageN; }
  // starting flat + blend
  const h0 = H[40]; for (let i = 0; i < 40; i++) H[i] = h0;
  const feats = [];
  let x = 70 + r() * 30;
  while (x < len - 70) {
    const roll = r();
    if (roll < ST.ramp) { // launch ramp: rise then a sharp lip
      const L = 12 + r() * 6, Ht = 2.6 + r() * 2.4 + stageN * 0.25, i0 = Math.floor(x);
      for (let k = 0; k <= L; k++) H[i0 + k] += Ht * Math.pow(k / L, 1.4);
      for (let k = 1; k <= 3; k++) H[i0 + L + k] += Ht * (1 - k / 3);
      feats.push({ type: 'ramp', x: i0 + L }); x += L + 34 + r() * 30;
    } else if (roll < ST.ramp + 0.25) { // rolling bump
      const L = 10 + r() * 10, Ht = 1.2 + r() * 1.5, i0 = Math.floor(x);
      for (let k = 0; k <= L; k++) H[i0 + k] += Ht * Math.sin(Math.PI * k / L);
      x += L + 20 + r() * 25;
    } else { feats.push({ type: 'pack', x }); x += 30 + r() * 30; }
  }
  // evac pad: flatten
  const e0 = Math.floor(len - 30), he = H[e0];
  for (let i = e0; i < N; i++) H[i] = lerp(H[i], he, clamp((i - e0) / 12, 0, 1));
  // smooth a little (except ramp lips)
  return feats;
}
function buildTerrainMesh() {
  if (terrainMesh) { scene.remove(terrainMesh); scene.remove(faceMesh); }
  const N = H.length, Z = [3.2, 2.4, 1.9, -1.9, -2.6, -18], cols = [ST.top, ST.top, ST.road, ST.road, ST.top, ST.top].map(c => new THREE.Color(c));
  const pos = [], col = [], idx = [];
  const R = rng(seed + 17);
  for (let i = 0; i < N; i++) {
    const x = i * DX, y = H[i];
    for (let j = 0; j < Z.length; j++) {
      pos.push(x, y + (j === 5 ? -0.3 : 0), Z[j]);
      C.copy(cols[j]); const n = (R() - 0.5) * 0.05; C.offsetHSL(0, 0, n + (j >= 2 && j <= 3 ? Math.sin(i * 0.7) * 0.015 : 0)); col.push(C.r, C.g, C.b);
    }
    if (i < N - 1) for (let j = 0; j < Z.length - 1; j++) { const a = i * Z.length + j, b = a + Z.length; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  terrainMesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 })); terrainMesh.receiveShadow = true; terrainMesh.frustumCulled = false; scene.add(terrainMesh);
  // front cut face: grass lip, dirt, deep dirt
  const fp = [], fc = [], fi = [], rows = [0, -0.45, -0.5, -2.6, -2.75, -3.3, -3.45, -6.5, -6.7, -7.4, -7.6, -40], dk = new THREE.Color(ST.face).offsetHSL(0, 0, -0.08), lt = new THREE.Color(ST.face).offsetHSL(0, 0.02, 0.06),
    rc = [ST.top, ST.top, ST.face, ST.face, dk, dk, ST.face, lt, ST.deep, ST.deep, ST.deep, ST.deep].map(c => new THREE.Color(c));
  for (let i = 0; i < N; i++) {
    const x = i * DX, y = H[i];
    for (let j = 0; j < rows.length; j++) { fp.push(x, j === rows.length - 1 ? -40 : y + rows[j] + (j > 2 ? Math.sin(i * 0.13 + j) * 0.25 : 0), 3.2); C.copy(rc[j]); fc.push(C.r, C.g, C.b); }
    if (i < N - 1) for (let j = 0; j < rows.length - 1; j++) { const a = i * rows.length + j, b = a + rows.length; fi.push(a, a + 1, b, b, a + 1, b + 1); }
  }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)); fg.setAttribute('color', new THREE.Float32BufferAttribute(fc, 3)); fg.setIndex(fi); fg.computeVertexNormals();
  const np = Math.floor(N / 3), peb = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), mat('#ffffff', { flatShading: true, roughness: 0.8 }), np), m4p = new THREE.Matrix4(), qp = new THREE.Quaternion(), ep = new THREE.Euler();
  for (let k = 0; k < np; k++) { const x = R() * N, sc = 0.15 + R() * 0.35; ep.set(R() * 3, R() * 3, R() * 3); qp.setFromEuler(ep); m4p.compose(new THREE.Vector3(x, ground(x) - 0.9 - R() * 9, 3.2), qp, new THREE.Vector3(sc * 1.4, sc, sc * 0.6)); peb.setMatrixAt(k, m4p); peb.setColorAt(k, C.set(ST.deep).offsetHSL(0, 0, 0.1 + R() * 0.15)); }
  peb.frustumCulled = false;
  faceMesh = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); faceMesh.frustumCulled = false; faceMesh.add(peb); scene.add(faceMesh);
}

// ---------------------------------------------------------------- background: parallax hills + clouds
const bgGroup = new THREE.Group(); scene.add(bgGroup);
let hillA, hillB;
function buildHills(r) {
  bgGroup.clear();
  const mk = (z, amp, colr, yb, freq) => {
    const s = new THREE.Shape(); s.moveTo(-200, -40); let x = -200;
    while (x <= 400) { s.lineTo(x, yb + amp * (0.5 + 0.5 * Math.sin(x * freq + r() * 0.6)) + r() * amp * 0.3); x += 9 + r() * 10; }
    s.lineTo(400, -40); s.lineTo(-200, -40);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshBasicMaterial({ color: colr, fog: false })); m.position.z = z; bgGroup.add(m); return m;
  };
  hillA = mk(-70, 18, ST.hill[0], -2, 0.05); hillB = mk(-45, 10, ST.hill[1], -4, 0.09);
  // clouds (or stars at night)
  const cg = new THREE.IcosahedronGeometry(1, 1), cm = new THREE.MeshBasicMaterial({ color: ST.night ? '#fff6c2' : '#ffffff', transparent: true, opacity: ST.night ? 0.9 : 0.85, fog: false });
  const n = ST.night ? 60 : 16, cl = new THREE.InstancedMesh(cg, cm, n * (ST.night ? 1 : 4)); let k = 0;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const cx = -150 + r() * 500, cy = 18 + r() * 22;
    if (ST.night) { p.set(cx, cy + r() * 10, -90); sc.setScalar(0.15 + r() * 0.2); m4.compose(p, q, sc); cl.setMatrixAt(k++, m4); continue; }
    for (let j = 0; j < 4; j++) { p.set(cx + j * 2.2 - 3, cy + (j % 2) * 0.8, -80); sc.set(2.2 + r() * 1.2, 1.4 + r(), 1); m4.compose(p, q, sc); cl.setMatrixAt(k++, m4); }
  }
  cl.count = k; cl.frustumCulled = false; bgGroup.add(cl);
  if (ST.night) { const moon = new THREE.Mesh(new THREE.CircleGeometry(4, 32), new THREE.MeshBasicMaterial({ color: '#fff3c4', fog: false })); moon.position.set(60, 34, -95); bgGroup.add(moon); }
  else { const sunD = new THREE.Mesh(new THREE.CircleGeometry(4.5, 32), new THREE.MeshBasicMaterial({ color: '#fff7c9', fog: false })); sunD.position.set(70, 30, -95); bgGroup.add(sunD); }
}

// ---------------------------------------------------------------- roadside decor (instanced, per stage look)
let decoA = null, decoB = null;
function buildDecor(r) {
  if (decoA) { scene.remove(decoA); scene.remove(decoB); }
  const t = ST.deco; let gA, gB, cA, cB;
  if (t === 'tree') { gA = new THREE.CylinderGeometry(0.22, 0.3, 2.2, 7); gA.translate(0, 1.1, 0); gB = new THREE.IcosahedronGeometry(1.5, 1); gB.translate(0, 3, 0); cA = ['#8a5a3c']; cB = ['#5cc46a', '#7ad66b', '#49b37a', '#9be06b']; }
  else if (t === 'cactus') { gA = new THREE.CapsuleGeometry(0.4, 2.4, 4, 10); gA.translate(0, 1.6, 0); gB = new THREE.CapsuleGeometry(0.26, 0.9, 4, 8); gB.rotateZ(Math.PI / 2.6); gB.translate(0.7, 2, 0); cA = ['#4fb36b', '#62c47a']; cB = ['#4fb36b', '#62c47a']; }
  else if (t === 'shroom') { gA = new THREE.CylinderGeometry(0.3, 0.4, 1.8, 8); gA.translate(0, 0.9, 0); gB = new THREE.SphereGeometry(1.3, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2); gB.translate(0, 1.7, 0); cA = ['#fff2df']; cB = ['#ff6b8b', '#ffb347', '#c38bff']; }
  else if (t === 'pine') { gA = new THREE.CylinderGeometry(0.2, 0.28, 1.4, 7); gA.translate(0, 0.7, 0); gB = new THREE.ConeGeometry(1.4, 3.6, 8); gB.translate(0, 2.9, 0); cA = ['#8a5a3c']; cB = ['#3f9a7a', '#4fae86', '#e9f6ff']; }
  else { gA = new THREE.BoxGeometry(1.6, 4, 1.6); gA.translate(0, 2, 0); gB = new THREE.CylinderGeometry(0.35, 0.45, 3, 8); gB.translate(0.3, 5.2, 0); cA = ['#5a5f80', '#6b6f92', '#4c5072']; cB = ['#ff8a5c', '#ffd25c']; }
  const n = Math.floor(H.length / 7);
  decoA = new THREE.InstancedMesh(gA, mat('#ffffff', { roughness: 0.7 }), n); decoB = new THREE.InstancedMesh(gB, mat('#ffffff', { roughness: 0.6, flatShading: t === 'tree' }), n);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), e = new THREE.Euler();
  for (let i = 0; i < n; i++) {
    const x = i * 7 + r() * 5 - 20, z = -4.5 - r() * 9, s = 0.75 + r() * 0.6;
    p.set(x, ground(Math.max(0, x)) - 0.2, z); e.set(0, r() * 6, 0); q.setFromEuler(e); sc.setScalar(s); m4.compose(p, q, sc);
    decoA.setMatrixAt(i, m4); decoB.setMatrixAt(i, m4);
    decoA.setColorAt(i, C.set(cA[Math.floor(r() * cA.length)])); decoB.setColorAt(i, C.set(cB[Math.floor(r() * cB.length)]));
  }
  for (const d of [decoA, decoB]) { d.castShadow = true; d.frustumCulled = false; scene.add(d); }
}

// ---------------------------------------------------------------- evac: helipad + rescue blimp + finish arch + best flag
const evac = new THREE.Group(); scene.add(evac);
{
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.8, 0.4, 40), mat('#3d405b')); pad.position.y = 0.2; pad.receiveShadow = true; evac.add(pad);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.18, 8, 40), new THREE.MeshBasicMaterial({ color: '#ffd23f' })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.42; evac.add(ring);
  const hm = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  for (const x of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 2.6), hm); b.position.set(x, 0.43, 0); evac.add(b); }
  const hb = new THREE.Mesh(new THREE.BoxGeometry(2, 0.05, 0.4), hm); hb.position.y = 0.43; evac.add(hb);
  const blimp = new THREE.Group(); blimp.position.set(3, 11, -1); evac.add(blimp); evac.blimp = blimp;
  const env = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), glossy('#ff5d8f')); env.scale.set(5.2, 2.3, 2.3); env.castShadow = true; blimp.add(env);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(2.33, 2.33, 1.1, 28, 1, true), mat('#ffffff', { side: THREE.DoubleSide })); stripe.rotation.z = Math.PI / 2; blimp.add(stripe);
  for (const [y, z] of [[1.6, 0], [-1.6, 0], [0, 1.6], [0, -1.6]]) { const fin = new THREE.Mesh(new THREE.BoxGeometry(1.6, y ? 1.4 : 0.15, z ? 1.4 : 0.15), mat('#ffd23f')); fin.position.set(-4.8, y, z); blimp.add(fin); }
  const gond = new THREE.Mesh(rounded(2.6, 1.1, 1.4, 0.3), mat('#ffd23f')); gond.position.set(0.3, -2.8, 0); blimp.add(gond);
  const win = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 1.46), new THREE.MeshBasicMaterial({ color: '#bdf1ff' })); win.position.set(0.3, -2.7, 0); blimp.add(win);
  const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6.2, 0.08), mat('#c98f5a')); ladder.position.set(0.3, -6.3, 0.75); blimp.add(ladder);
  // finish arch with checker banner
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const cx = cv.getContext('2d');
  for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { cx.fillStyle = (i + j) % 2 ? '#2d3047' : '#ffffff'; cx.fillRect(i * 16, j * 16, 16, 16); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  for (const z of [3, -3]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 6, 10), mat('#ffffff')); post.position.set(-8, 3, z); post.castShadow = true; evac.add(post); }
  const banner = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.2, 6.4), [mat('#fff'), mat('#fff'), mat('#fff'), mat('#fff'), mat('#ffffff', { map: tex }), mat('#ffffff', { map: tex })]);
  banner.rotation.y = Math.PI / 2; banner.position.set(-8, 6, 0); banner.material[4].map = tex; evac.add(banner);
}
const bestFlag = new THREE.Group(); scene.add(bestFlag);
{
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.4, 8), mat('#ffffff')); pole.position.y = 1.7; bestFlag.add(pole);
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64; const x = cv.getContext('2d');
  x.fillStyle = '#ffd23f'; x.fillRect(0, 0, 128, 64); x.fillStyle = '#2d3047'; x.font = '800 34px system-ui'; x.textAlign = 'center'; x.fillText('BEST', 64, 45);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide })); fl.position.set(0.85, 2.9, 0); bestFlag.add(fl);
}

// ---------------------------------------------------------------- the truck
const car = new THREE.Group(); scene.add(car);
const carParts = {};
function buildCar() {
  car.clear();
  const body = new THREE.Mesh(rounded(3.5, 0.9, 1.9, 0.3), glossy('#ff8c42')); body.position.set(0, 0.05, 0); body.castShadow = true; car.add(body);
  const bed = new THREE.Mesh(rounded(1.3, 0.5, 1.7, 0.12), mat('#e86f2a')); bed.position.set(-1.0, 0.62, 0); car.add(bed);
  const cab = new THREE.Mesh(rounded(1.55, 1.0, 1.7, 0.28), glossy('#ff8c42')); cab.position.set(0.45, 0.88, 0); cab.castShadow = true; car.add(cab);
  const glass = new THREE.Mesh(rounded(1.25, 0.6, 1.76, 0.18), new THREE.MeshStandardMaterial({ color: '#bdf1ff', roughness: 0.1, metalness: 0.2 })); glass.position.set(0.55, 0.98, 0); car.add(glass);
  // driver: a round goggled pilot
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), mat('#ffd7ba')); head.position.set(0.35, 1.05, 0.25); car.add(head);
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.33, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), glossy('#3a86ff')); helm.position.set(0.35, 1.1, 0.25); car.add(helm);
  const gog = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.04, 6, 14), mat('#2d3047')); gog.position.set(0.6, 1.08, 0.3); gog.rotation.y = Math.PI / 2; car.add(gog);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff7b0' })); lamp.position.set(1.72, 0.2, 0.6); car.add(lamp);
  const bump = new THREE.Mesh(rounded(0.25, 0.4, 1.95, 0.1), mat('#5b5f7a')); bump.position.set(1.78, -0.25, 0); car.add(bump);
  // wheels
  const R = 0.55 + lv.tires * 0.045;
  carParts.R = R; carParts.wheels = [];
  for (const wx of [-1.15, 1.2]) {
    const w = new THREE.Group();
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.55, 22), mat('#2d3047', { roughness: 0.85 })); tyre.rotation.x = Math.PI / 2; tyre.castShadow = true; w.add(tyre);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.5, R * 0.5, 0.58, 6), glossy('#ffd23f')); hub.rotation.x = Math.PI / 2; w.add(hub);
    if (lv.tires >= 2) for (let k = 0; k < 10; k++) { const kn = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.56), mat('#2d3047')); const a = k / 10 * Math.PI * 2; kn.position.set(Math.cos(a) * R, Math.sin(a) * R, 0); kn.rotation.z = a; w.add(kn); }
    const wz = new THREE.Group(); wz.add(w); w.position.z = 0; car.add(wz); wz.position.set(wx, -0.35, 0);
    // two wheels (front + back side) share one group visually offset in z
    const w2 = w.clone(); w2.position.z = -1.1; w.position.z = 0.95; wz.add(w2);
    carParts.wheels.push({ g: wz, spin: [w, w2] });
  }
  // plow (front wedge), grows with level
  if (lv.plow > 0) {
    const s = 0.8 + lv.plow * 0.12;
    const pl = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.2 * s, 2.3), glossy('#b8c0d8', { metalness: 0.5 })); pl.position.set(2.05, -0.05, 0); pl.rotation.z = -0.45; pl.castShadow = true; car.add(pl);
    for (let k = 0; k < Math.min(5, lv.plow + 1); k++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.45, 8), mat('#ffd23f')); sp.rotation.z = -Math.PI / 2 - 0.45; sp.position.set(2.3, -0.4 + k * 0.25 * s, ((k % 2) - 0.5) * 0.9); car.add(sp); }
    if (lv.plow >= 3) { const cage = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.06, 6, 16, Math.PI), mat('#5b5f7a')); cage.position.set(0.5, 1.35, 0.9); car.add(cage); const c2 = cage.clone(); c2.position.z = -0.9; car.add(c2); }
  }
  // booster rockets
  carParts.flame = null;
  if (lv.boost > 0) {
    const rk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 1.1, 12), glossy('#7b5cff')); rk.rotation.z = Math.PI / 2; rk.position.set(-1.55, 0.95, 0); car.add(rk);
    if (lv.boost >= 3) { const rk2 = rk.clone(); rk2.position.z = 0.55; car.add(rk2); const rk3 = rk.clone(); rk3.position.z = -0.55; car.add(rk3); }
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.4, 10), new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.9 })); fl.rotation.z = Math.PI / 2; fl.position.set(-2.75, 0.95, 0); fl.visible = false; car.add(fl);
    carParts.flame = fl;
  }
  // fuel cans on the bed
  for (let k = 0; k < lv.fuel; k++) { const can = new THREE.Mesh(rounded(0.35, 0.5, 0.5, 0.06), mat(k % 2 ? '#ff4d6d' : '#3ab795')); can.position.set(-1.45 + (k % 3) * 0.42, 1.1, k < 3 ? 0.4 : -0.4); car.add(can); }
  if (lv.engine >= 2) { const sc = new THREE.Mesh(rounded(0.6, 0.3, 0.6, 0.08), glossy('#c0c6dd', { metalness: 0.6 })); sc.position.set(1.15, 0.6, 0); car.add(sc); }
  if (lv.engine >= 4) { for (const z of [0.3, -0.3]) { const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.8, 8), glossy('#c0c6dd', { metalness: 0.6 })); pipe.position.set(0.95, 1.4, z); car.add(pipe); } }
}

// ---------------------------------------------------------------- slime blobs (instanced: body, eye whites, pupils)
const MAXI = 170;
const blobGeo = new THREE.SphereGeometry(1, 20, 14);
const blobMesh = new THREE.InstancedMesh(blobGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.25, metalness: 0.05 }), MAXI); blobMesh.castShadow = true; blobMesh.frustumCulled = false; scene.add(blobMesh);
const eyeMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 10), new THREE.MeshBasicMaterial({ color: '#ffffff' }), MAXI * 2); eyeMesh.frustumCulled = false; scene.add(eyeMesh);
const pupMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: '#1d1b2f' }), MAXI * 2); pupMesh.frustumCulled = false; scene.add(pupMesh);
blobMesh.setColorAt(0, C.set('#fff'));
let blobs = [];
// crates
const MAXC = 40;
const crateMesh = new THREE.InstancedMesh(rounded(1, 1, 1, 0.08), mat('#ffffff', { roughness: 0.7 }), MAXC); crateMesh.castShadow = true; crateMesh.frustumCulled = false; scene.add(crateMesh);
let crates = [];
// goo droplets (pooled, instanced)
const MAXG = 320;
const gooMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.2 }), MAXG); gooMesh.frustumCulled = false; scene.add(gooMesh); gooMesh.setColorAt(0, C.set('#fff'));
let goo = [];
function spawnGoo(x, y, col, n, sp = 6) {
  for (let i = 0; i < n; i++) {
    if (goo.length >= MAXG) goo.shift();
    const a = Math.random() * Math.PI * 2;
    goo.push({ x, y, z: (Math.random() - 0.5) * 2, vx: Math.cos(a) * sp * Math.random() + P.vx * 0.3, vy: Math.abs(Math.sin(a)) * sp * (0.6 + Math.random()), vz: (Math.random() - 0.5) * 4, s: 0.08 + Math.random() * 0.16, life: 0.8 + Math.random() * 0.4, col });
  }
}
function genObstacles(r, feats) {
  blobs = []; crates = [];
  const dens = ST.dens * F.k();
  const add = (x, rad) => { const col = ST.blob[Math.floor(r() * ST.blob.length)]; blobs.push({ x, r: rad, col: new THREE.Color(col), hex: col, alive: true, ph: r() * 6, hp: rad * 10, dmg: 0, fly: false, vx: 0, vy: 0, y: 0, rot: 0, sq: 0, hop: r() < 0.5 }); };
  for (let x = 45; x < ST.len - 25; x += 1) {
    if (r() < dens * 0.5) add(x + r(), 0.5 + r() * 0.35 + (r() < 0.12 + stageN * 0.03 ? 0.45 : 0));
  }
  for (const f of feats) {
    if (f.type === 'pack') { const n = 3 + Math.floor(r() * (3 + stageN * 1.5)); for (let k = 0; k < n; k++) add(f.x + k * (0.9 + r() * 0.8), 0.45 + r() * 0.35 + (k === n - 1 && r() < 0.5 ? 0.6 : 0)); }
    if (f.type === 'ramp' && r() < 0.5) for (let k = 0; k < 3; k++) crates.push({ x: f.x + 14 + k * 1.05, y: 0, vx: 0, vy: 0, rot: 0, w: 0, hit: false, s: 0.9 });
  }
  if (stageN >= 3) for (let x = 120; x < ST.len - 60; x += 140 + r() * 80) add(x, 1.4 + stageN * 0.12);   // big boss blobs
  for (let x = 60; x < ST.len - 40; x += 70 + r() * 70) if (r() < 0.45) for (let k = 0; k < 2; k++) crates.push({ x: x + k * 1.05, y: 0, vx: 0, vy: 0, rot: 0, w: 0, hit: false, s: 0.9 });
  blobs.sort((a, b) => a.x - b.x);
  for (const b of blobs) b.y = ground(b.x);
  for (const c of crates) c.y = ground(c.x) + c.s / 2;
  crates = crates.slice(0, MAXC);
}

// ---------------------------------------------------------------- car physics state
// body: position (x,y), angle a, velocity, angular velocity w. Two spring wheels; impulse contacts for body corners.
car.vx = 0;
let P = { x: 0, y: 0, a: 0, vx: 0, vy: 0, w: 0 };
let stats, fuel, hp, boostCharge, wheelC = [0, 0], wheelOn = [false, false], wheelSpin = 0, airT = 0, airRot = 0, roofT = 0, slowT = 0, stuckT = 0, stuckX = 0;
const G = 20, M = 1, I = 1.7, ANCH = [[-1.15, -0.35], [1.2, -0.35]], REST = 0.55, KS = 115, DS = 9;
const CORN = [[-1.8, -0.4], [1.85, -0.35], [-1.7, 0.55], [1.3, 1.35], [-0.3, 1.4]];
function computeStats() {
  stats = {
    acc: 10 + lv.engine * 3.2, fuelMax: 13 + lv.fuel * 5.5, hpMax: 100 + lv.plow * 40, plow: lv.plow,
    boostMax: lv.boost ? 1.6 + lv.boost * 0.9 : 0, boostAcc: 12 + lv.boost * 2.5, mu: 1.25 + lv.tires * 0.18, R: 0.55 + lv.tires * 0.045, ks: KS + lv.tires * 8,
  };
}
const ctl = { gas: false, brake: false, boost: false }, botC = { gas: false, brake: false, boost: false };
const gasOn = () => ctl.gas || botC.gas, brakeOn = () => ctl.brake || botC.brake, boostOn = () => ctl.boost || botC.boost;

let phase = 'ready', won = false, score = 0, pops = 0, runT0 = 0, recorded = false, beatenShown = false, lastMark = 0, timeScale = 1, slowmoT = 0, shake = 0, earned = 0, flips = 0, endWhy = '';
function setupStage() {
  ST = STAGES[stageN - 1];
  seed = D.seed ? D.seed * 7 + stageN : stageN * 1009 + 7;
  const r = rng(seed);
  const feats = genTerrain(r);
  evacX = ST.len; buildTerrainMesh(); buildHills(rng(seed + 3)); buildDecor(rng(seed + 5)); genObstacles(rng(seed + 11), feats);
  evac.position.set(evacX + 6, ground(evacX + 6), -0.5);
  const b = bestOf(stageN); bestFlag.visible = b > 20 && b < ST.len; bestFlag.position.set(b + 8, ground(b + 8), -2.6);
  document.body.style.setProperty('--bg1', ST.bg[0]); document.body.style.setProperty('--bg2', ST.bg[1]); document.body.style.setProperty('--ui', '#ff8c42');
  scene.fog = new THREE.Fog(ST.bg[1], 60, 140);
  hemi.intensity = ST.night ? 0.75 : 1.15; sun.intensity = ST.night ? 0.9 : 1.7; hemi.groundColor.set(ST.night ? '#46407a' : '#ffe8f0');
  ui.levels(stageN); ui.els.top.querySelector('[data-b]').textContent = '🚁';
}
function resetCar() {
  computeStats(); buildCar();
  P = { x: 8, y: ground(8) + 0.35 + REST + stats.R - 0.05, a: 0, vx: 0, vy: 0, w: 0 };
  fuel = stats.fuelMax; hp = stats.hpMax; boostCharge = stats.boostMax; airT = 0; airRot = 0; roofT = 0; slowT = 0; stuckT = 0; stuckX = P.x;
}

// ---------------------------------------------------------------- HUD + controls (DOM)
const mk = (cls, html = '', parent = document.body) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; parent.appendChild(d); return d; };
const brakeBtn = mk('sp-ctl sp-brake sp-hud', '<b>◀</b>BRAKE'), gasBtn = mk('sp-ctl sp-gas sp-hud', '<b>▶</b>GAS'), boostBtn = mk('sp-ctl sp-boost sp-hud', '<b>🔥</b>');
const gauges = mk('sp-gauges sp-hud', '<div class="sp-spd"><span data-s>0</span><small> km/h</small></div><div class="sp-g">⛽<span><i data-f style="background:linear-gradient(#ffe066,#ffb703)"></i></span></div><div class="sp-g">🛡️<span><i data-h style="background:linear-gradient(#8ef0a6,#2bb673)"></i></span></div>');
const gF = gauges.querySelector('[data-f]'), gH = gauges.querySelector('[data-h]'), gS = gauges.querySelector('[data-s]');
const muteBtn = document.createElement('button'); muteBtn.className = 'sp-mute'; document.body.appendChild(muteBtn);
let muted = S.get('muted', false); const paintMute = () => muteBtn.textContent = muted ? '🔇' : '🎵'; paintMute();
muteBtn.addEventListener('pointerdown', e => e.stopPropagation()); muteBtn.addEventListener('click', e => { e.stopPropagation(); muted = !muted; S.set('muted', muted); paintMute(); });
function hud(on) { document.querySelectorAll('.sp-hud').forEach(e => e.classList.toggle('off', !on)); }
const pointers = new Map();
function refreshCtl() {
  ctl.gas = ctl.brake = ctl.boost = false;
  for (const v of pointers.values()) ctl[v] = true;
  if (keys.has('ArrowRight') || keys.has('KeyD') || keys.has('ArrowUp') || keys.has('KeyW')) ctl.gas = true;
  if (keys.has('ArrowLeft') || keys.has('KeyA') || keys.has('ArrowDown') || keys.has('KeyS')) ctl.brake = true;
  if (keys.has('Space') || keys.has('ShiftLeft')) ctl.boost = true;
  gasBtn.classList.toggle('on', gasOn()); brakeBtn.classList.toggle('on', brakeOn()); boostBtn.classList.toggle('on', boostOn());
}
addEventListener('pointerdown', e => {
  if (phase !== 'drive') return;
  ensureAudio();
  const t = e.target.closest && e.target.closest('.sp-ctl');
  const what = t === boostBtn ? 'boost' : t === brakeBtn ? 'brake' : t === gasBtn ? 'gas' : e.clientX < innerWidth / 2 ? 'brake' : 'gas';
  pointers.set(e.pointerId, what); refreshCtl();
});
const up = e => { pointers.delete(e.pointerId); refreshCtl(); };
addEventListener('pointerup', up); addEventListener('pointercancel', up);
const keys = new Set();
addEventListener('keydown', e => { if (e.repeat) return; keys.add(e.code); if (e.code === 'Space') e.preventDefault(); ensureAudio(); refreshCtl(); if (phase === 'garage' && (e.code === 'Enter' || e.code === 'Space')) startRun(); });
addEventListener('keyup', e => { keys.delete(e.code); refreshCtl(); });
addEventListener('blur', () => { keys.clear(); pointers.clear(); refreshCtl(); });

function splat(hex) {
  const d = document.createElement('div'); d.className = 'sp-splat'; const s = 60 + Math.random() * 110;
  d.style.cssText = `left:${Math.random() * (innerWidth - s)}px;top:${innerHeight * 0.15 + Math.random() * innerHeight * 0.45}px;width:${s}px;height:${s * (0.8 + Math.random() * 0.4)}px;background:radial-gradient(circle at 35% 35%,rgba(255,255,255,.55),${hex} 30%,${hex}cc 60%,transparent 72%)`;
  document.body.appendChild(d); setTimeout(() => d.remove(), 1700);
}

// ---------------------------------------------------------------- garage (DOM sheet + turntable camera)
const gar = mk('sp-gar off', `<div class="sp-gtop"><h2>🔧 Garage</h2><div class="sp-parts">🔩 <span data-p>0</span></div></div>
  <div class="sp-stage"><button data-prev>◀</button><div data-st></div><button data-next>▶</button></div><div class="sp-rows"></div><button class="sp-drive">DRIVE ▶</button>`);
['pointerdown', 'touchstart', 'mousedown'].forEach(t => gar.addEventListener(t, e => e.stopPropagation()));
const rowsEl = gar.querySelector('.sp-rows');
function renderGarage() {
  gar.querySelector('[data-p]').textContent = parts;
  const b = bestOf(stageN);
  gar.querySelector('[data-st]').innerHTML = `Road ${stageN}: ${STAGES[stageN - 1].name}<small>${STAGES[stageN - 1].len} m to the blimp${b ? ` · best ${b} m` : ''}${D.isDaily ? ' · daily road' : ''}</small>`;
  gar.querySelector('[data-prev]').disabled = stageN <= 1; gar.querySelector('[data-next]').disabled = stageN >= unlocked;
  rowsEl.innerHTML = UPG.map(u => { const l = lv[u.id], c = u.cost[l]; return `<div class="sp-row"><div class="ic">${u.ic}</div><div class="nm">${u.name}<small>${u.d}</small><div class="sp-pips">${[0, 1, 2, 3, 4].map(i => `<i class="${i < l ? 'on' : ''}"></i>`).join('')}</div></div>
    <button data-u="${u.id}" class="${l >= 5 ? 'max' : ''}" ${l >= 5 || parts < c ? 'disabled' : ''}>${l >= 5 ? 'MAX' : '🔩 ' + c}</button></div>`; }).join('');
  rowsEl.querySelectorAll('[data-u]').forEach(bt => bt.onclick = () => buy(bt.dataset.u));
}
function buy(id) {
  const u = UPG.find(x => x.id === id), l = lv[id]; if (l >= 5 || parts < u.cost[l]) return false;
  parts -= u.cost[l]; lv[id]++; S.set('parts', parts); S.set('lv', lv);
  computeStats(); buildCar(); renderGarage(); sfx.coin(); buzz(12);
  const row = rowsEl.querySelector(`[data-u="${id}"]`); if (row) row.closest('.sp-row').classList.add('sp-bump');
  burst(scene, new THREE.Vector3(P.x, P.y + 1, 1), ['#ffd23f', '#ff8c42', '#ffffff'], 14, { speed: 0.12, up: 0.12, size: 0.6 });
  return true;
}
gar.querySelector('[data-prev]').onclick = () => { if (stageN > 1) { stageN--; S.set('stage', stageN); setupStage(); resetCar(); renderGarage(); } };
gar.querySelector('[data-next]').onclick = () => { if (stageN < unlocked) { stageN++; S.set('stage', stageN); setupStage(); resetCar(); renderGarage(); } };
gar.querySelector('.sp-drive').onclick = () => startRun();
function openGarage() {
  phase = 'garage'; hud(false); gar.classList.remove('off'); ui.els.sc.classList.add('hc-hidden'); ui.sub(''); ui.els.top.classList.add('hc-hidden');
  setupStage(); resetCar(); renderGarage();
}

// ---------------------------------------------------------------- runs
function startRun() {
  ensureAudio();
  gar.classList.add('off'); hud(true); ui.els.sc.classList.remove('hc-hidden'); ui.els.top.classList.remove('hc-hidden');
  if (phase !== 'garage') setupStage();
  resetCar();
  phase = 'drive'; won = false; score = 0; pops = 0; flips = 0; recorded = false; beatenShown = false; lastMark = 0; earned = 0; timeScale = 1;
  runT0 = performance.now(); B.start();
  ui.score('0 m'); ui.progress(0); ui.sub(D.isDaily ? 'DAILY ROAD' : bestOf(stageN) ? `BEST ${bestOf(stageN)} m` : ST.name.toUpperCase());
  ui.pop(ST.name.toUpperCase(), '#fff', 34, 28);
  runs++; S.set('runs', runs);
}
function endRun(reached, why) {
  if (phase !== 'drive') return;
  phase = 'over'; won = reached; endWhy = why;
  pointers.clear(); refreshCtl(); botC.gas = botC.brake = botC.boost = false; hud(false);
  const dist = score, ms = performance.now() - runT0;
  earned = Math.floor(dist / 3) + pops * 2 + flips * 15 + (reached ? 120 + stageN * 60 : 0);
  parts += earned; S.set('parts', parts);
  const prevBest = bestOf(stageN); if (dist > prevBest) S.set('best_s' + stageN, dist);
  if (!recorded) { recorded = true; F.level(reached, clamp(dist / ST.len, 0, 1)); B.submit(dist, { ms }); }
  const cleared = stageN;
  if (reached) {
    if (stageN < 5) { unlocked = Math.max(unlocked, stageN + 1); S.set('unlocked', unlocked); stageN++; S.set('stage', stageN); }
    D.won(dist, 'drove');
    sfx.win(); confetti(scene, new THREE.Vector3(P.x + 2, P.y + 3, 0), 80); buzz([30, 40, 30]);
    ui.win(cleared, `${dist} m · +${earned} 🔩 parts${cleared < 5 ? ' · next road unlocked!' : ' · every road cleared!'}`);
  } else {
    sfx.fail(); buzz([40, 30, 60]);
    ui.lose(why, `${dist} m${dist > prevBest && prevBest ? ' · NEW BEST!' : ''} · +${earned} 🔩 parts`);
  }
}
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on the first run, until the first real
// touch, the truck drives off by itself (the game's own driving bot: gas, boost on flats) and plows the first slime; fuel and boost are given back
const DM = demo(null, { ready: () => phase === 'drive' && stageN === 1 && runs === 1 && !D.isDaily, wait: 1200, ms: 3500 });
let demoFuel = null;
function demoDrive() {
  if (DM.on && phase === 'drive') { if (demoFuel === null) demoFuel = [fuel, boostCharge]; window.__game.bot(); }
  else if (demoFuel !== null) { if (phase === 'drive') { fuel = Math.max(fuel, demoFuel[0]); boostCharge = Math.max(boostCharge, demoFuel[1]); } demoFuel = null; botC.gas = botC.brake = botC.boost = false; refreshCtl(); }
}
ui.onTap(w => {
  ensureAudio();
  if (w === 'start') { if (runs === 0) startRun(); else openGarage(); return; }
  openGarage();
});

// ---------------------------------------------------------------- physics step
const fwd = { x: 1, y: 0 }, upv = { x: 0, y: 1 };
function applyImpulse(rx, ry, jx, jy) { P.vx += jx / M; P.vy += jy / M; P.w += (rx * jy - ry * jx) / I; }
function physStep(h) {
  const ca = Math.cos(P.a), sa = Math.sin(P.a);
  fwd.x = ca; fwd.y = sa; upv.x = -sa; upv.y = ca;
  const driving = phase === 'drive';
  const engineOK = driving && fuel > 0 && hp > 0;
  const gas = driving && gasOn() && engineOK, brake = driving && brakeOn(), boosting = driving && boostOn() && boostCharge > 0 && hp > 0;
  P.vy -= G * h;
  let contacts = 0;
  for (let i = 0; i < 2; i++) {
    const [ax, ay] = ANCH[i];
    const rx = ca * ax - sa * ay, ry = sa * ax + ca * ay;
    const Ax = P.x + rx, Ay = P.y + ry;
    const Cx = Ax - upv.x * REST, Cy = Ay - upv.y * REST;
    const g = ground(Cx), comp = (g + stats.R) - Cy;
    wheelOn[i] = comp > 0;
    if (comp > 0) {
      contacts++;
      const sl = slope(Cx), nl = Math.hypot(sl, 1), nx = -sl / nl, ny = 1 / nl, tx = ny, ty = -nx;
      const vAx = P.vx - P.w * ry, vAy = P.vy + P.w * rx;
      const vn = vAx * nx + vAy * ny, vt = vAx * tx + vAy * ty;
      const c = Math.min(comp, 0.5);
      let Fs = stats.ks * c - DS * vn; if (comp > 0.5) Fs += (comp - 0.5) * 900 - Math.min(0, vn) * 30;
      Fs = Math.max(0, Fs);
      let Ft = 0;
      const grip = stats.mu * Fs;
      if (gas) Ft += Math.min(stats.acc * 0.5, grip);
      if (brake) Ft += vt > 0.8 ? -Math.min(14, grip) : -Math.min(5, grip);
      if (!gas && !brake) Ft -= clamp(vt * 0.6, -grip * 0.3, grip * 0.3);
      const fx = nx * Fs + tx * Ft, fy = ny * Fs + ty * Ft;
      P.vx += fx * h / M; P.vy += fy * h / M; P.w += (rx * fy - ry * fx) * h / I;
      wheelC[i] = clamp(comp, 0, 0.5);
      if (i === 0) wheelSpin -= vt * h / stats.R;
    } else wheelC[i] = lerp(wheelC[i], 0, 0.2);
  }
  // body corners vs ground (impulse)
  let roof = false;
  for (let k = 0; k < CORN.length; k++) {
    const [lx, ly] = CORN[k], rx = ca * lx - sa * ly, ry = sa * lx + ca * ly, Qx = P.x + rx, Qy = P.y + ry, g = ground(Qx);
    if (Qy < g) {
      const sl = slope(Qx), nl = Math.hypot(sl, 1), nx = -sl / nl, ny = 1 / nl;
      const pen = g - Qy; P.x += nx * pen * 0.6; P.y += ny * pen * 0.6;
      const vQx = P.vx - P.w * ry, vQy = P.vy + P.w * rx, vn = vQx * nx + vQy * ny;
      if (vn < 0) {
        const rn = rx * ny - ry * nx, j = -(1.15) * vn / (1 / M + rn * rn / I);
        applyImpulse(rx, ry, nx * j, ny * j);
        const tx = ny, ty = -nx, vt = (P.vx - P.w * ry) * tx + (P.vy + P.w * rx) * ty, rt = rx * ty - ry * tx, jt = clamp(-vt / (1 / M + rt * rt / I), -0.4 * j, 0.4 * j);
        applyImpulse(rx, ry, tx * jt, ty * jt);
        if (k >= 2 && driving && -vn > 6) { hp -= (-vn - 6) * 1.5; shake = Math.max(shake, 0.3); tone(120, 0.12, 'square', 0.08, 0.6); }
      }
      if (k >= 3) roof = true;
    }
  }
  // air control + engine torque feel
  if (contacts === 0) {
    if (driving) { if (gasOn()) P.w += 7.5 * h; if (brakeOn()) P.w -= 7.5 * h; }
    P.w = clamp(P.w, -5.5, 5.5); airT += h; airRot += P.w * h;
  } else {
    if (airT > 1.1 && driving) { ui.pop(`AIR ${airT.toFixed(1)}s!`, '#fff', 30, 34); tone(660, 0.1, 'triangle', 0.1, 1.3); }
    if (Math.abs(airRot) > Math.PI * 1.7 && driving && P.a > -1 && Math.cos(P.a) > 0.3) { flips++; ui.pop('FLIP! +15 🔩', '#ffd23f', 38, 30); confetti(scene, new THREE.Vector3(P.x, P.y + 1, 0), 30); sfx.coin(); }
    airT = 0; airRot = 0; P.w *= 0.995;
  }
  if (boosting) { P.vx += fwd.x * stats.boostAcc * h; P.vy += fwd.y * stats.boostAcc * h; boostCharge = Math.max(0, boostCharge - h); }
  // drag
  const sp = Math.hypot(P.vx, P.vy), cd = 0.03; P.vx -= P.vx * sp * cd * h; P.vy -= P.vy * sp * cd * h * 0.4;
  P.w *= 1 - 0.4 * h;
  P.x += P.vx * h; P.y += P.vy * h; P.a += P.w * h;
  if (P.x < 2) { P.x = 2; P.vx = Math.max(0, P.vx); }
  if (driving) {
    if (gasOn() && fuel > 0) fuel = Math.max(0, fuel - h); else fuel = Math.max(0, fuel - h * 0.15);
  }
  return { contacts, roof };
}

// ---------------------------------------------------------------- collisions with blobs + crates
function hitBlob(b, now) {
  if (now < (b.cd || 0)) return;
  const sp = P.vx, impact = Math.max(0, sp) * (1 + 0.28 * stats.plow), need = b.hp - b.dmg;
  if (impact >= need) {
    // pop (small) or launch (big)
    const loss = clamp(0.3 * need / Math.max(impact, 1) * (1 - 0.1 * stats.plow), 0.03, 0.55);
    P.vx *= 1 - loss; hp -= b.r * 4 * (1 - 0.13 * stats.plow);
    pops++;
    if (b.r > 0.8) { b.fly = true; b.vx = sp * 0.9 + 3; b.vy = 7 + sp * 0.25; b.alive = false; b.flyT = 0; shake = Math.max(shake, 0.5); slowmoT = 0.35; ui.pop('SPLAT!', b.hex, 40, 30); tone(140, 0.18, 'sawtooth', 0.1, 0.5); buzz(30); }
    else popBlob(b, true);
  } else {
    // too slow to smash it: bonk, squish it, back off a little (each bonk softens it up)
    b.cd = now + 0.45; b.dmg += impact * 0.7 + 1.5; b.sq = 1; P.vx = -Math.min(3, 1 + sp * 0.25); hp -= b.r * 4 * (1 - 0.13 * stats.plow); shake = Math.max(shake, 0.35);
    tone(90, 0.15, 'square', 0.1, 0.6); buzz(25); spawnGoo(b.x - b.r, b.y + b.r, b.hex, 6, 4);
  }
}
function popBlob(b, byCar) {
  b.alive = false; b.fly = false;
  spawnGoo(b.x, b.y + b.r, b.hex, 10 + Math.floor(b.r * 10), 5 + b.r * 3);
  if (byCar) { if (Math.random() < 0.35) splat(b.hex); }
  tone(300 + Math.random() * 200 - b.r * 120, 0.09, 'sine', 0.13, 0.4); tone(900 + Math.random() * 300, 0.04, 'triangle', 0.05, 0.5); buzz(10);
  shake = Math.max(shake, 0.12 + b.r * 0.15);
}
function collide() {
  const ca = Math.cos(P.a), sa = Math.sin(P.a);
  for (const b of blobs) {
    if (b.x > P.x + 6) break;
    if (!b.alive || b.x < P.x - 6) continue;
    const by = b.y + b.r * 0.85, dx = b.x - P.x, dy = by - P.y;
    const lx = ca * dx + sa * dy, ly = -sa * dx + ca * dy;
    if (Math.abs(lx) < 1.85 + b.r * 0.9 && ly > -0.9 - b.r && ly < 0.9 + b.r) {
      if (lx > 0.4) hitBlob(b, performance.now() / 1000); else { popBlob(b, false); pops++; }   // run-overs from above just pop
    }
  }
  for (const c of crates) {
    if (c.hit || Math.abs(c.x - P.x) > 2.5) continue;
    const dx = c.x - P.x, dy = c.y - P.y, lx = ca * dx + sa * dy, ly = -sa * dx + ca * dy;
    if (Math.abs(lx) < 2.2 && Math.abs(ly) < 1.3) { c.hit = true; c.vx = Math.max(P.vx, 4) * 1.15 + Math.random() * 2; c.vy = 4 + Math.random() * 4; c.w = -3 - Math.random() * 5; P.vx *= 0.93; hp -= 2; tone(180, 0.1, 'square', 0.08, 0.6); burst(scene, new THREE.Vector3(c.x, c.y, 0), ['#d9a066', '#b5814f'], 6, { speed: 0.1, up: 0.08, size: 0.6 }); shake = Math.max(shake, 0.2); }
  }
}

// ---------------------------------------------------------------- render instanced things
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pv = new THREE.Vector3(), sv = new THREE.Vector3(), eu = new THREE.Euler();
function drawBlobs(t, dt) {
  let n = 0, e = 0;
  const lo = P.x - 30, hi = P.x + 45;
  for (const b of blobs) {
    if (b.fly) {
      b.vy -= G * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += 8 * dt; b.flyT += dt;
      if (b.y < ground(b.x) && b.vy < 0) { b.fly = false; popBlob(b, false); spawnGoo(b.x, b.y + 0.5, b.hex, 16, 7); continue; }
    } else if (!b.alive) continue;
    if (b.x < lo) continue; if (b.x > hi) break; if (n >= MAXI) break;
    if (b.alive && phase === 'drive' && b.hop && b.x > P.x + 2 && b.x < P.x + 16) b.x -= 0.9 * dt;
    if (b.alive) b.y = ground(b.x);
    b.sq = Math.max(0, b.sq - dt * 3);
    const wob = Math.sin(t * 5 + b.ph), hop = b.alive && b.hop ? Math.max(0, Math.sin(t * 6 + b.ph)) * 0.35 * b.r : 0;
    const sx = b.r * (1 + 0.08 * wob + b.sq * 0.3), sy = b.r * (0.86 - 0.08 * wob - b.sq * 0.3);
    pv.set(b.x, b.y + sy + hop, -0.2 + (b.ph - 3) * 0.12); eu.set(0, 0, b.fly ? b.rot : Math.sin(t * 3 + b.ph) * 0.08); q.setFromEuler(eu); sv.set(sx, sy, b.r);
    m4.compose(pv, q, sv); blobMesh.setMatrixAt(n, m4); blobMesh.setColorAt(n, b.col);
    // googly eyes face the camera, pupils look at the truck
    for (const s of [-1, 1]) {
      const ex = b.x + s * b.r * 0.34 - b.r * 0.1, ey = pv.y + sy * 0.35, ez = pv.z + b.r * 0.82, er = b.r * 0.27;
      pv.set(ex, ey, ez); sv.setScalar(er); m4.compose(pv, q.identity(), sv); eyeMesh.setMatrixAt(e, m4);
      const look = clamp((P.x - b.x) * 0.05, -1, 1), wig = b.fly ? Math.sin(t * 20 + s) : 0;
      pv.set(ex + look * er * 0.45 + wig * er * 0.3, ey - er * 0.15 + Math.sin(t * 4 + b.ph + s) * er * 0.15, ez + er * 0.7); sv.setScalar(er * 0.5); m4.compose(pv, q, sv); pupMesh.setMatrixAt(e, m4); e++;
    }
    n++;
  }
  blobMesh.count = n; eyeMesh.count = e; pupMesh.count = e;
  blobMesh.instanceMatrix.needsUpdate = true; if (blobMesh.instanceColor) blobMesh.instanceColor.needsUpdate = true; eyeMesh.instanceMatrix.needsUpdate = true; pupMesh.instanceMatrix.needsUpdate = true;
  // crates
  let c = 0;
  for (const k of crates) {
    if (k.hit) { k.vy -= G * dt; k.x += k.vx * dt; k.y += k.vy * dt; k.rot += k.w * dt; const g = ground(k.x) + k.s / 2; if (k.y < g) { k.y = g; k.vy = Math.abs(k.vy) * 0.3; k.vx *= 0.7; k.w *= 0.6; } }
    if (k.x < lo || k.x > hi) continue;
    pv.set(k.x, k.y, 0.4); eu.set(0, 0.3, k.rot); q.setFromEuler(eu); sv.setScalar(k.s); m4.compose(pv, q, sv); crateMesh.setMatrixAt(c, m4); crateMesh.setColorAt(c, C.set(c % 2 ? '#d9a066' : '#c98f5a')); c++;
  }
  crateMesh.count = c; crateMesh.instanceMatrix.needsUpdate = true; if (crateMesh.instanceColor) crateMesh.instanceColor.needsUpdate = true;
  // goo
  let g = 0;
  for (let i = goo.length - 1; i >= 0; i--) {
    const d = goo[i]; d.vy -= G * 0.8 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.life -= dt * (d.vy === 0 ? 1.6 : 0.7);
    const gy = ground(d.x) + d.s * 0.4; if (d.y < gy) { d.y = gy; d.vy = 0; d.vx *= 0.8; d.vz *= 0.8; }
    if (d.life <= 0) { goo.splice(i, 1); continue; }
    pv.set(d.x, d.y, d.z); sv.set(d.s * (d.vy === 0 ? 1.6 : 1), d.s * (d.vy === 0 ? 0.5 : 1), d.s * (d.vy === 0 ? 1.6 : 1)).multiplyScalar(Math.min(1, d.life * 2)); m4.compose(pv, q.identity(), sv);
    gooMesh.setMatrixAt(g, m4); gooMesh.setColorAt(g, C.set(d.col)); g++;
  }
  gooMesh.count = g; gooMesh.instanceMatrix.needsUpdate = true; if (gooMesh.instanceColor) gooMesh.instanceColor.needsUpdate = true;
}

// ---------------------------------------------------------------- audio: engine hum + music loop composed in code
let AC = null, eng = null;
function ensureAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), o2 = AC.createOscillator(), f = AC.createBiquadFilter(), g = AC.createGain();
    o.type = 'sawtooth'; o2.type = 'square'; o.frequency.value = 50; o2.frequency.value = 25; f.type = 'lowpass'; f.frequency.value = 520; g.gain.value = 0;
    const g2 = AC.createGain(); g2.gain.value = 0.35; o2.connect(g2); g2.connect(f);
    o.connect(f); f.connect(g); g.connect(AC.destination); o.start(); o2.start(); eng = { o, o2, g, f };
  } catch (e) {}
}
function engineSound(on, rpm) {
  if (!eng) return;
  const t = AC.currentTime, hidden = document.visibilityState === 'hidden';
  eng.g.gain.setTargetAtTime(on && !hidden && !muted ? 0.045 : 0, t, 0.08);
  eng.o.frequency.setTargetAtTime(48 + rpm * 70, t, 0.06); eng.o2.frequency.setTargetAtTime(24 + rpm * 35, t, 0.06); eng.f.frequency.setTargetAtTime(400 + rpm * 500, t, 0.1);
}
// a jaunty surf-rock-ish loop: bass line + kick/snare + a little lead, 8th notes at 132 bpm
const BASS = [40, 40, 52, 40, 43, 43, 55, 43, 45, 45, 57, 45, 43, 47, 50, 47];
const LEAD = [64, 0, 67, 0, 69, 67, 64, 0, 62, 0, 64, 0, 67, 0, 0, 0, 64, 0, 67, 0, 71, 69, 67, 0, 69, 0, 67, 64, 62, 0, 0, 0];
let step = 0;
setInterval(() => {
  if (muted || document.visibilityState === 'hidden' || !AC || (phase !== 'drive' && phase !== 'garage')) return;
  const i = step++ % 32, b = BASS[(i >> 1) % 16];
  if (i % 2 === 0) tone(440 * Math.pow(2, (b - 69) / 12), 0.16, 'square', 0.035, 1);
  if (i % 8 === 0 || i % 8 === 5) tone(95, 0.13, 'sine', 0.13, 0.35);
  if (i % 8 === 4) { tone(190, 0.07, 'triangle', 0.05, 0.5); tone(2400, 0.03, 'square', 0.012, 0.7); }
  if (i % 2 === 1) tone(5200, 0.015, 'square', 0.006, 0.9);
  if (phase === 'drive' && LEAD[i]) note(LEAD[i] + 12, 0.18, 0.045);
}, 60000 / 132 / 2);

// ---------------------------------------------------------------- main loop
let camX = 0, camY = 0, camZ = 26, tAcc = 0, spinVis = 0;
const look = new THREE.Vector3();
loop((dt, t) => {
  const dts = dt / 60;
  slowmoT = Math.max(0, slowmoT - dts); timeScale = lerp(timeScale, slowmoT > 0 ? 0.35 : 1, 0.2);
  const simDt = dts * timeScale;
  let info = { contacts: 2, roof: false };
  demoDrive();
  if (phase === 'drive' || phase === 'over') {
    const SUB = 4; for (let i = 0; i < SUB; i++) info = physStep(simDt / SUB);
    if (phase === 'drive') collide();
  } else if (phase === 'garage' || phase === 'ready') {
    // parked on the start line, gently idling
    P.x = 8; P.y = ground(8) + 0.35 + REST + stats.R - 0.08 + Math.sin(t * 9) * 0.015; wheelC[0] = wheelC[1] = 0.08; P.a = Math.atan(slope(8)); P.vx = P.vy = P.w = 0;
  }
  // car visuals
  car.position.set(P.x, P.y, 0); car.rotation.z = P.a;
  for (let i = 0; i < 2; i++) { const w = carParts.wheels[i]; w.g.position.y = -0.35 - REST + wheelC[i] + (phase === 'drive' || phase === 'over' ? 0 : 0.0); for (const s of w.spin) s.rotation.z = wheelSpin; }
  if (carParts.flame) { const on = phase === 'drive' && boostOn() && boostCharge > 0; carParts.flame.visible = on; if (on) { carParts.flame.scale.set(1, 0.8 + Math.random() * 0.6, 1); if (Math.random() < 0.5) spawnGoo(P.x - 2.8 * Math.cos(P.a), P.y + 0.95 - 2.8 * Math.sin(P.a), '#ffb347', 1, 2); } }
  drawBlobs(t, simDt);
  evac.blimp.position.y = 11 + Math.sin(t * 1.4) * 0.4; evac.blimp.rotation.z = Math.sin(t * 0.9) * 0.04;

  if (phase === 'drive') {
    const sp = Math.hypot(P.vx, P.vy);
    score = Math.max(score, Math.floor(P.x - 8));
    ui.score(score + ' m'); ui.progress(score / (ST.len - 8));
    if (Math.floor(score / 100) > lastMark) { lastMark = Math.floor(score / 100); ui.pop(`${lastMark * 100} m`, '#fff', 30, 34); note(76, 0.15, 0.08); }
    if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); confetti(scene, new THREE.Vector3(P.x + 2, P.y + 3, 0), 50); }
    gF.style.width = (fuel / stats.fuelMax * 100) + '%'; gH.style.width = (Math.max(0, hp) / stats.hpMax * 100) + '%'; gS.textContent = Math.round(Math.max(0, P.vx) * 3.6);
    boostBtn.style.setProperty('--p', (stats.boostMax ? boostCharge / stats.boostMax * 100 : 0) + '%'); boostBtn.style.opacity = stats.boostMax ? 1 : 0.35;
    engineSound(true, clamp(sp / 28, 0, 1.2) + (gasOn() && fuel > 0 ? 0.3 : 0));
    if (fuel <= 0 && !ui.__fuelPop) { ui.__fuelPop = 1; ui.pop('OUT OF FUEL!', '#ffd23f', 34, 34); }
    if (hp <= 0 && !ui.__hpPop) { ui.__hpPop = 1; ui.pop('ENGINE GOOED!', '#ff5d8f', 34, 34); }
    // ends
    if (P.x >= evacX) endRun(true, 'RESCUED!');
    else {
      const upY = Math.cos(P.a);
      if (upY < 0.1 && sp < 2.5) roofT += dts; else roofT = 0;
      if (roofT > 1.2) endRun(false, 'FLIPPED!');
      if ((fuel <= 0 || hp <= 0) && sp < 0.7) slowT += dts; else slowT = 0;
      if (slowT > 1) endRun(false, hp <= 0 ? 'GOOED UP!' : 'OUT OF FUEL!');
      if (P.x > stuckX + 0.6) { stuckX = P.x; stuckT = 0; } else stuckT += dts;
      if (stuckT > 4.5) endRun(false, 'STUCK!');
    }
  } else engineSound(phase === 'garage' || phase === 'ready', 0.1);
  if (phase !== 'drive') { ui.__fuelPop = 0; ui.__hpPop = 0; }

  // camera
  const portrait = innerWidth / innerHeight < 0.8;
  if (phase === 'garage' || phase === 'ready') {
    const a = t * 0.25;
    const tx = P.x + Math.sin(a) * 9, tz = Math.cos(a) * 9 + 2;
    camera.position.set(lerp(camera.position.x, tx, 0.05), lerp(camera.position.y, P.y + (portrait ? 3.4 : 2.6), 0.05), lerp(camera.position.z, tz + (portrait ? 5 : 1), 0.05));
    look.set(P.x, P.y + (phase === 'garage' ? (portrait ? -4.4 : 0.3) : (portrait ? 1.2 : 0.2)), 0);
    const side = phase === 'garage' && !portrait && innerWidth >= 900;
    if (side) camera.setViewOffset(innerWidth, innerHeight, 240, 0, innerWidth, innerHeight); else if (camera.view) camera.clearViewOffset(); camera.lookAt(look); camX = P.x; camY = P.y; camZ = portrait ? 36 : 20;
  } else {
    if (camera.view && camera.view.enabled) camera.clearViewOffset();
    const sp = Math.max(0, P.vx);
    camX = lerp(camX, P.x + (portrait ? 3 : 7) + sp * 0.12, 0.08); camY = lerp(camY, P.y + 1.2, 0.07);
    camZ = lerp(camZ, (portrait ? 30 : 20) + sp * 0.14, 0.04);
    shake = Math.max(0, shake - dts * 1.6);
    const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
    camera.position.set(camX + sx, camY + (portrait ? 10 : 6) + sy, camZ); look.set(camX + sx * 0.5, camY + (portrait ? -0.6 : 0.2), 0); camera.lookAt(look);
  }
  bgGroup.position.set(camera.position.x * 0.75, camY * 0.5 - 3, 0);
  stage.followLight(new THREE.Vector3(P.x + 4, P.y, 0));
});

// ---------------------------------------------------------------- boot
setupStage(); resetCar(); hud(false); ui.start(); ui.els.sc.classList.add('hc-hidden');
ui.sub(''); camera.position.set(P.x + 2, P.y + 4, 22);

// ---------------------------------------------------------------- test hooks
window.__game = {
  get state() { return phase === 'ready' ? 'ready' : phase === 'over' ? (won ? 'won' : 'lost') : 'play'; },
  get level() { return stageN; }, get score() { return score; },
  get dbg() { return { x: +P.x.toFixed(1), y: +P.y.toFixed(1), a: +P.a.toFixed(2), vx: +P.vx.toFixed(1), fuel: +fuel.toFixed(1), hp: Math.round(hp), parts, lv, phase }; },
  bot() {
    if (phase === 'garage') {
      // buy the cheapest useful upgrade we can afford (fuel and engine first), then drive
      const pri = ['fuel', 'engine', 'plow', 'boost', 'tires'];
      const opts = pri.filter(id => lv[id] < 5 && parts >= UPG.find(u => u.id === id).cost[lv[id]]).sort((a, b) => UPG.find(u => u.id === a).cost[lv[a]] - UPG.find(u => u.id === b).cost[lv[b]]);
      if (opts.length) { buy(opts[0]); return; }
      startRun(); return;
    }
    if (phase !== 'drive') return;
    const air = !wheelOn[0] && !wheelOn[1];
    botC.gas = true; botC.brake = false; botC.boost = false;
    if (air) {
      const target = Math.atan(slope(P.x + Math.max(3, P.vx * 0.5)));
      if (P.a > target + 0.12) { botC.gas = false; botC.brake = true; } else if (P.a < target - 0.2) botC.gas = true; else botC.gas = false;
    } else {
      if (P.a > 0.7) { botC.gas = false; }              // about to wheelie over: ease off
      if (Math.abs(P.a - Math.atan(slope(P.x))) < 0.25 && P.vx < 30) botC.boost = true;
    }
    refreshCtl();
  },
};
