// Drillhaven — mine and defend. AGENTPARK original: code, models, music and sound are our own.
// Between waves, fly your mole-engineer down the mine, drill rock, carry ore back up to the Haven (a glass bell outpost)
// and spend it on upgrades. When the countdown ends, monsters come: swing the Haven's laser to hold them off.
import { THREE, createStage, createUI, loop, confetti, tone, note, buzz, store, clamp, lerp, rng, rounded } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { bake, vcMat } from './merge.js';

const NAME = 'Drillhaven: Mine and Defend';
const S = store('drillhaven');
const F = flow('drillhaven');
const PI = Math.PI;

// ================================================================ stage
const stage = createStage({ fov: 42, shadows: true, shadowSize: 12 });
const { scene, camera, sun, hemi } = stage;
hemi.color.set('#ffe9f4'); hemi.groundColor.set('#6a4a5a'); hemi.intensity = 1.15;
sun.color.set('#ffe2c4'); sun.intensity = 1.5;
document.body.style.setProperty('--bg1', '#6b5bd6'); document.body.style.setProperty('--bg2', '#ffb38a'); document.body.style.setProperty('--ui', '#ff8c42');
const ui = createUI({ title: 'DRILL<br>HAVEN', hint: '', hand: '', progress: true, score: false });
const D = daily('drillhaven', ui, { name: NAME });
const B = board({ game: 'drillhaven', label: 'Waves survived', limits: { maxRun: 80, maxPerSec: 0.25 }, corner: 'tl' });
{ const w = ui.els.win; w.classList.add('dim'); w.children[0].innerHTML = 'WAVE <span data-l>1</span>'; w.querySelector('h1').textContent = 'HELD!'; w.querySelector('.hint').textContent = 'Tap to dig again'; }

const $ = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0.05, ...o });
const VC = vcMat({ roughness: 0.5 });
const SPH = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
const CYL = (a, b, h, s = 14) => new THREE.CylinderGeometry(a, b, h, s);
const CONE = (r, h, s = 10) => new THREE.ConeGeometry(r, h, s);
const TOR = (r, t, a = 8, b = 20) => new THREE.TorusGeometry(r, t, a, b);

// ================================================================ grid
const W = 17, H = 64, X0 = 8;                 // columns 0..16, playable 3..13, x = c - 8; rows go down from y = 0
const PLAY0 = 3, PLAY1 = 13, SHAFT = 8;
const HARD = { 1: 1, 2: 2.2, 3: 4.2, 9: 1e9 };
const ROCK = { 1: '#b07a52', 2: '#8d8a99', 3: '#5f5873', 9: '#3a2f3d' };
let cells, host, hard, prog, seedBase = 1, dugMask = null;
const idx = (c, r) => r * W + c;
const cellOf = (x, y) => [Math.floor(x + X0 + 0.5), Math.floor(-y)];
function genMine(seed) {
  const r = rng(seed); cells = new Uint8Array(W * H); host = new Uint8Array(W * H); hard = new Float32Array(W * H); prog = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let c = 0; c < W; c++) {
    let t;
    if (c < PLAY0 || c > PLAY1 || y === H - 1) t = 9;
    else if (y < 5) t = r() < 0.12 ? 2 : 1;
    else if (y < 15) t = r() < 0.2 + (y - 5) * 0.05 ? 2 : 1;
    else if (y < 30) t = r() < 0.15 + (y - 15) * 0.02 ? 3 : 2;
    else t = r() < 0.55 ? 3 : 2;
    cells[idx(c, y)] = t; host[idx(c, y)] = t;
  }
  // ore veins: amber everywhere, blue from row 5, more blue deeper
  for (let k = 0; k < 70; k++) {
    let y = 1 + Math.floor(Math.pow(r(), 1.25) * (H - 3)), c = PLAY0 + Math.floor(r() * 11);
    const ore = y > 5 && r() < 0.25 + y * 0.012 ? 5 : 4, n = 1 + Math.floor(r() * (ore === 4 ? 4 : 3));
    for (let i = 0; i < n; i++) {
      if (c >= PLAY0 && c <= PLAY1 && y > 0 && y < H - 1 && !(c === SHAFT && y < 2)) cells[idx(c, y)] = ore;
      if (r() < 0.5) c += r() < 0.5 ? -1 : 1; else y += r() < 0.5 ? -1 : 1;
    }
  }
  // seedstone relics: one per band, inside a shell of hard rock
  for (const ry of [8, 19, 31, 44]) { let c = PLAY0 + 1 + Math.floor(r() * 9); if (c === SHAFT) c++; cells[idx(c, ry)] = 6; host[idx(c, ry)] = 3; }
  for (let i = 0; i < W * H; i++) { const y = Math.floor(i / W), t = cells[i]; hard[i] = (t === 9 ? 1e9 : t === 6 ? 5.5 : HARD[host[i]] * (t >= 4 ? 0.85 : 1)) * (1 + y * 0.012); }
  cells[idx(SHAFT, 0)] = 0; cells[idx(SHAFT, 1)] = 0;
}
const solidCell = (c, r) => { if (r < 0) return !(c === SHAFT); if (c < 0 || c >= W || r >= H) return true; return cells[idx(c, r)] !== 0; };
function solidAt(x, y) {
  if (y > 0) return !(Math.abs(x) < 0.55 && y < 1.1);       // above ground only the Haven's hatch is open
  const [c, r] = cellOf(x, y); return solidCell(c, r);
}

// ================================================================ world meshes
function lowBlock(w, r) {
  const s = new THREE.Shape(), x = -w / 2; s.moveTo(x + r, x); s.lineTo(-x - r, x); s.quadraticCurveTo(-x, x, -x, x + r); s.lineTo(-x, -x - r); s.quadraticCurveTo(-x, -x, -x - r, -x); s.lineTo(x + r, -x); s.quadraticCurveTo(x, -x, x, -x - r); s.lineTo(x, x + r); s.quadraticCurveTo(x, x, x + r, x);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.7, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.08, bevelSegments: 2, curveSegments: 2 }); g.translate(0, 0, -0.35); return g;
}
const blockGeo = lowBlock(0.9, 0.1);
const blocks = new THREE.InstancedMesh(blockGeo, M('#ffffff', { roughness: 0.85 }), W * H); blocks.receiveShadow = true; scene.add(blocks);
const crystalGeo = bake([
  { geo: new THREE.OctahedronGeometry(0.2), color: '#ffffff', pos: [0, 0.05, 0], scl: [0.8, 1.4, 0.8] },
  { geo: new THREE.OctahedronGeometry(0.14), color: '#ffffff', pos: [0.2, -0.12, 0], rot: [0, 0, -0.6], scl: [0.8, 1.3, 0.8] },
  { geo: new THREE.OctahedronGeometry(0.12), color: '#ffffff', pos: [-0.2, -0.1, 0.03], rot: [0, 0, 0.6], scl: [0.8, 1.3, 0.8] },
]);
const ORE_COL = { 4: '#ffb02e', 5: '#4fc3ff', 6: '#7dff8a' };
const crystals = {};
for (const t of [4, 5, 6]) { const m = new THREE.InstancedMesh(crystalGeo, vcMat({ color: ORE_COL[t], emissive: ORE_COL[t], emissiveIntensity: 0.55, roughness: 0.2 }), 400); m.count = 0; scene.add(m); crystals[t] = m; }
const grassGeo = rounded(1, 0.26, 1.02, 0.08);
const grass = new THREE.InstancedMesh(grassGeo, M('#7fd36a'), W); scene.add(grass);
const back = new THREE.Mesh(new THREE.PlaneGeometry(W, H), M('#3b2834', { roughness: 1 })); back.position.set(0, -H / 2, -0.5); back.receiveShadow = true; scene.add(back);
const sideL = new THREE.Mesh(new THREE.BoxGeometry(40, H + 2, 2), M('#3a2f3d')); sideL.position.set(-W / 2 - 20, -H / 2 - 1, 0); scene.add(sideL);
const sideR = sideL.clone(); sideR.position.x = W / 2 + 20; scene.add(sideR);
const lawn = new THREE.Mesh(new THREE.BoxGeometry(90, 0.26, 6), M('#7fd36a')); lawn.position.set(0, 0.13, -1.6); lawn.receiveShadow = true; scene.add(lawn);
const lawnL = new THREE.Mesh(new THREE.BoxGeometry(40, 0.26, 2), M('#7fd36a')); lawnL.position.set(-W / 2 - 20, 0.13, 0); scene.add(lawnL);
const lawnR = lawnL.clone(); lawnR.position.x = W / 2 + 20; scene.add(lawnR);
// hills + rocks on the horizon
const hillGeo = bake([{ geo: SPH(1, 18, 10), color: '#ffffff' }]);
const hills = new THREE.InstancedMesh(hillGeo, M('#ffffff', { roughness: 1 }), 14);
{ const o = new THREE.Object3D(), c = new THREE.Color(); for (let i = 0; i < 14; i++) { const x = -42 + i * 6.4 + Math.sin(i * 7) * 2; o.position.set(x, -1, -9 - (i % 3) * 3); o.scale.set(5 + (i % 4) * 1.5, 3 + ((i * 5) % 4), 3); o.updateMatrix(); hills.setMatrixAt(i, o.matrix); hills.setColorAt(i, c.set(['#9a7fd6', '#c08ad0', '#b98ccf', '#8f7ad0'][i % 4])); } }
scene.add(hills);
const dummy = new THREE.Object3D(), tmpC = new THREE.Color();
let oreSlots = { 4: [], 5: [], 6: [] };
function paintGrid() {
  const r = rng(seedBase + 5);
  for (let y = 0; y < H; y++) for (let c = 0; c < W; c++) {
    const i = idx(c, y), t = cells[i];
    dummy.position.set(c - X0, -y - 0.5, 0); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(t ? 1 : 0.0001); dummy.updateMatrix(); blocks.setMatrixAt(i, dummy.matrix);
    const dark = Math.max(0.42, 1 - y * 0.011), j = 0.9 + r() * 0.2;
    tmpC.set(ROCK[host[i] || 1]).multiplyScalar(dark * j); blocks.setColorAt(i, tmpC);
  }
  oreSlots = { 4: [], 5: [], 6: [] };
  for (let i = 0; i < W * H; i++) if (cells[i] >= 4 && cells[i] <= 6) oreSlots[cells[i]].push(i);
  for (const t of [4, 5, 6]) {
    const m = crystals[t]; m.count = oreSlots[t].length;
    oreSlots[t].forEach((i, k) => { const c = i % W, y = Math.floor(i / W); dummy.position.set(c - X0, -y - 0.5, 0.5); dummy.rotation.set(0, 0, (i * 1.7) % 1 - 0.5); dummy.scale.setScalar(t === 6 ? 1.5 : 1.1); dummy.updateMatrix(); m.setMatrixAt(k, dummy.matrix); });
    m.instanceMatrix.needsUpdate = true;
  }
  for (let c = 0; c < W; c++) { dummy.position.set(c - X0, 0.13, 0); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(cells[idx(c, 0)] ? 1 : 0.0001); dummy.updateMatrix(); grass.setMatrixAt(c, dummy.matrix); }
  blocks.instanceMatrix.needsUpdate = true; if (blocks.instanceColor) blocks.instanceColor.needsUpdate = true; grass.instanceMatrix.needsUpdate = true;
}
function setBlock(i, s, wob = 0) {
  const c = i % W, y = Math.floor(i / W);
  dummy.position.set(c - X0 + wob, -y - 0.5, 0); dummy.rotation.set(0, 0, wob * 2); dummy.scale.setScalar(s); dummy.updateMatrix(); blocks.setMatrixAt(i, dummy.matrix); blocks.instanceMatrix.needsUpdate = true;
  const t = cells[i] || 0;
  if (t >= 4 && t <= 6 || s < 0.01) for (const k of [4, 5, 6]) { const j = oreSlots[k].indexOf(i); if (j >= 0) { dummy.position.set(c - X0 + wob, -y - 0.5, 0.5); dummy.scale.setScalar(s < 0.01 ? 0.0001 : (k === 6 ? 1.5 : 1.1) * s); dummy.updateMatrix(); crystals[k].setMatrixAt(j, dummy.matrix); crystals[k].instanceMatrix.needsUpdate = true; } }
  if (y === 0) { dummy.position.set(c - X0, 0.13, 0); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(s < 0.01 ? 0.0001 : 1); dummy.updateMatrix(); grass.setMatrixAt(c, dummy.matrix); grass.instanceMatrix.needsUpdate = true; }
}

// ================================================================ the Haven (glass bell outpost) + laser
const haven = new THREE.Group(); scene.add(haven);
const havenBase = new THREE.Mesh(bake([
  { geo: CYL(1.75, 1.9, 0.35, 32), color: '#5b6178', pos: [0, 0.2, 0] },
  { geo: TOR(1.72, 0.09, 8, 40), color: '#ffcf5a', pos: [0, 0.38, 0], rot: [PI / 2, 0, 0] },
  { geo: CYL(0.5, 0.5, 0.06, 20), color: '#2c2338', pos: [0, 0.38, 0.0] },
  { geo: rounded(0.7, 0.45, 0.5, 0.08), color: '#7a83a6', pos: [0.75, 0.62, -0.5] },
  { geo: rounded(0.42, 0.3, 0.06, 0.03), color: '#5ef2c2', pos: [0.75, 0.66, -0.24] },
  { geo: CYL(0.1, 0.1, 1.1, 10), color: '#7a83a6', pos: [-0.9, 0.9, -0.6] },
  { geo: SPH(0.16), color: '#ff6b8b', pos: [-0.9, 1.5, -0.6] },
]), VC); havenBase.castShadow = true; havenBase.receiveShadow = true; haven.add(havenBase);
const glass = new THREE.Mesh(new THREE.SphereGeometry(1.62, 36, 18, 0, PI * 2, 0, PI / 2), new THREE.MeshStandardMaterial({ color: '#bfeaff', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.32, depthWrite: false })); glass.position.y = 0.36; haven.add(glass);
const shieldMesh = new THREE.Mesh(new THREE.SphereGeometry(2.05, 36, 18, 0, PI * 2, 0, PI / 2), new THREE.MeshBasicMaterial({ color: '#6ff3ff', transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide })); shieldMesh.position.y = 0.2; haven.add(shieldMesh);
const turret = new THREE.Group(); turret.position.set(0, 1.98, 0); haven.add(turret);
const turretMesh = new THREE.Mesh(bake([
  { geo: SPH(0.34, 18, 12), color: '#e8ecf7' }, { geo: CYL(0.1, 0.13, 0.75, 12), color: '#5b6178', pos: [0, 0.42, 0] },
  { geo: TOR(0.13, 0.04, 6, 14), color: '#ff5d8f', pos: [0, 0.78, 0], rot: [PI / 2, 0, 0] }, { geo: SPH(0.08), color: '#ff5d8f', pos: [0, 0.82, 0] },
]), VC); turretMesh.castShadow = true; turret.add(turretMesh);
const beamMat = new THREE.MeshBasicMaterial({ color: '#ff6fa8', transparent: true, opacity: 0.9 }), beamCore = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const bg = CYL(0.14, 0.14, 1, 10); bg.translate(0, 0.5, 0);
const beam = new THREE.Mesh(bg, beamMat), beamIn = new THREE.Mesh(bg, beamCore); beamIn.scale.set(0.4, 1, 0.4); beam.add(beamIn); turret.add(beam); beam.visible = false;
const LASER_O = new THREE.Vector3(0, 1.98, 0.1);
// sentry pod (gadget)
const sentry = new THREE.Mesh(bake([{ geo: CYL(0.3, 0.38, 0.4, 16), color: '#5b6178', pos: [0, 0.2, 0] }, { geo: SPH(0.25, 14, 10), color: '#7dff8a', pos: [0, 0.55, 0] }, { geo: CYL(0.05, 0.05, 0.45, 8), color: '#2c2338', pos: [0, 0.75, 0.0] }]), VC);
sentry.position.set(-2.45, 0.26, 0.2); sentry.visible = false; scene.add(sentry);

// ================================================================ the miner (mole-engineer with drill + jetpack)
const miner = new THREE.Group(); scene.add(miner);
const minerBody = new THREE.Mesh(bake([
  { geo: SPH(0.3, 18, 14), color: '#8a6fc4', scl: [1, 1.05, 0.95] },
  { geo: SPH(0.2, 14, 10), color: '#f4dfcf', pos: [0, -0.06, 0.15], scl: [1, 0.9, 0.7] },
  { geo: SPH(0.075, 10, 8), color: '#ff7ea8', pos: [0, 0.02, 0.32] },
  { geo: TOR(0.07, 0.025, 6, 14), color: '#ffcf5a', pos: [-0.11, 0.13, 0.25] }, { geo: TOR(0.07, 0.025, 6, 14), color: '#ffcf5a', pos: [0.11, 0.13, 0.25] },
  { geo: SPH(0.055, 10, 8), color: '#2b2230', pos: [-0.11, 0.13, 0.26] }, { geo: SPH(0.055, 10, 8), color: '#2b2230', pos: [0.11, 0.13, 0.26] },
  { geo: new THREE.SphereGeometry(0.31, 18, 10, 0, PI * 2, 0, PI / 2), color: '#ffd23f', pos: [0, 0.12, -0.02] },
  { geo: CYL(0.07, 0.07, 0.06, 12), color: '#fff6c2', pos: [0, 0.32, 0.24], rot: [PI / 2.6, 0, 0] },
  { geo: rounded(0.32, 0.36, 0.18, 0.05), color: '#ff8c42', pos: [0, -0.02, -0.33] },
  { geo: CYL(0.06, 0.08, 0.12, 10), color: '#5b6178', pos: [-0.1, -0.24, -0.33] }, { geo: CYL(0.06, 0.08, 0.12, 10), color: '#5b6178', pos: [0.1, -0.24, -0.33] },
  { geo: SPH(0.08, 10, 8), color: '#f4dfcf', pos: [-0.24, -0.2, 0.08] }, { geo: SPH(0.08, 10, 8), color: '#f4dfcf', pos: [0.24, -0.2, 0.08] },
]), VC); minerBody.castShadow = true; miner.add(minerBody);
const drill = new THREE.Group(); miner.add(drill);
const drillBit = new THREE.Mesh(bake([{ geo: CONE(0.14, 0.42, 12), color: '#cfd6e6', pos: [0, 0.42, 0] }, { geo: CYL(0.15, 0.15, 0.1, 12), color: '#5b6178', pos: [0, 0.2, 0] }, { geo: TOR(0.1, 0.025, 6, 12), color: '#8890a8', pos: [0, 0.4, 0], rot: [PI / 2, 0, 0] }]), VC);
drill.add(drillBit);
const flame = new THREE.Mesh(CONE(0.07, 0.3, 8), new THREE.MeshBasicMaterial({ color: '#ffb02e', transparent: true, opacity: 0.85 })); flame.rotation.x = PI; flame.position.set(0, -0.4, -0.33);
const flame2 = flame.clone(); flame.position.x = -0.1; flame2.position.x = 0.1; miner.add(flame, flame2);
const lamp = new THREE.PointLight('#ffe4b0', 0, 9, 1.4); lamp.position.set(0, 0.3, 1.2); miner.add(lamp);

// ore chunks (instanced, carried on a tether)
const chunkGeo = bake([{ geo: new THREE.DodecahedronGeometry(0.17), color: '#ffffff' }]);
const chunkMesh = { 4: new THREE.InstancedMesh(chunkGeo, M(ORE_COL[4], { emissive: ORE_COL[4], emissiveIntensity: 0.4, roughness: 0.3 }), 80), 5: new THREE.InstancedMesh(chunkGeo, M(ORE_COL[5], { emissive: ORE_COL[5], emissiveIntensity: 0.4, roughness: 0.3 }), 80) };
for (const k in chunkMesh) { chunkMesh[k].count = 0; chunkMesh[k].frustumCulled = false; scene.add(chunkMesh[k]); }
const tether = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 16 }, () => new THREE.Vector3())), new THREE.LineBasicMaterial({ color: '#ffe8a8' })); tether.frustumCulled = false; scene.add(tether);

// particles (one draw call)
const MAXP = 600, partMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshStandardMaterial({ roughness: 0.5 }), MAXP);
partMesh.frustumCulled = false; partMesh.count = 0; partMesh.setColorAt(0, new THREE.Color()); scene.add(partMesh);
const parts = [];
function spark(x, y, z, color, n = 6, sp = 2.5, up = 2, size = 1, grav = 9) {
  const cs = [].concat(color).map(c => new THREE.Color(c));
  for (let i = 0; i < n && parts.length < MAXP; i++) { const a = Math.random() * 6.283; parts.push({ x, y, z, vx: Math.cos(a) * sp * (0.3 + Math.random()), vy: Math.sin(a) * sp * 0.6 + up * Math.random(), vz: (Math.random() - 0.3) * sp * 0.5, life: 0.5 + Math.random() * 0.4, c: cs[i % cs.length], s: size * (0.6 + Math.random() * 0.8), r: Math.random() * 3, g: grav }); }
}
const ringGeo = new THREE.RingGeometry(0.9, 1, 48), rings = [];
function ring(x, y, r, color) { let o = rings.find(q => q.t <= 0); if (!o) { o = { m: new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide })), t: 0 }; scene.add(o.m); rings.push(o); } o.m.material.color.set(color); o.m.position.set(x, y, 0.6); o.r = r; o.t = 1; o.m.visible = true; }
const bolts = [], boltGeo = CYL(0.04, 0.04, 1, 6); boltGeo.translate(0, 0.5, 0);
function bolt(x0, y0, x1, y1, color = '#7dff8a') { let o = bolts.find(q => q.t <= 0); if (!o) { o = { m: new THREE.Mesh(boltGeo, new THREE.MeshBasicMaterial({ color, transparent: true })), t: 0 }; scene.add(o.m); bolts.push(o); } o.m.material.color.set(color); o.m.position.set(x0, y0, 0.3); o.m.scale.set(1, Math.hypot(x1 - x0, y1 - y0), 1); o.m.rotation.set(0, 0, Math.atan2(-(x1 - x0), y1 - y0)); o.t = 1; o.m.visible = true; }

// ================================================================ monsters (pooled meshes, one baked geometry per kind)
const MGEO = {
  walker: bake([{ geo: SPH(0.55, 18, 14), color: '#ffffff', pos: [0, 0.05, 0], scl: [1.15, 0.9, 1] },
    { geo: SPH(0.16, 12, 10), color: '#ffffff', pos: [-0.26, 0.38, 0.32] }, { geo: SPH(0.16, 12, 10), color: '#ffffff', pos: [0.26, 0.38, 0.32] },
    { geo: SPH(0.08, 10, 8), color: '#2b2230', pos: [-0.26, 0.38, 0.45] }, { geo: SPH(0.08, 10, 8), color: '#2b2230', pos: [0.26, 0.38, 0.45] },
    { geo: CYL(0.08, 0.06, 0.4, 8), color: '#3d2f4f', pos: [-0.35, -0.42, 0] }, { geo: CYL(0.08, 0.06, 0.4, 8), color: '#3d2f4f', pos: [0.35, -0.42, 0] },
    { geo: CONE(0.1, 0.25, 6), color: '#fff3c9', pos: [-0.15, -0.05, 0.5], rot: [PI, 0, 0] }, { geo: CONE(0.1, 0.25, 6), color: '#fff3c9', pos: [0.15, -0.05, 0.5], rot: [PI, 0, 0] }]),
  flyer: bake([{ geo: SPH(0.38, 16, 12), color: '#ffffff' }, { geo: SPH(0.3, 12, 8), color: '#ffffff', pos: [-0.5, 0.1, -0.05], scl: [1.4, 0.25, 0.9], rot: [0, 0, 0.35] }, { geo: SPH(0.3, 12, 8), color: '#ffffff', pos: [0.5, 0.1, -0.05], scl: [1.4, 0.25, 0.9], rot: [0, 0, -0.35] },
    { geo: SPH(0.13, 10, 8), color: '#fffbe0', pos: [0, 0.02, 0.3] }, { geo: SPH(0.07, 10, 8), color: '#2b2230', pos: [0, 0.02, 0.41] }, { geo: CONE(0.08, 0.2, 6), color: '#2b2230', pos: [-0.17, 0.38, 0], rot: [0, 0, 0.4] }, { geo: CONE(0.08, 0.2, 6), color: '#2b2230', pos: [0.17, 0.38, 0], rot: [0, 0, -0.4] }]),
  burrower: bake([{ geo: new THREE.CapsuleGeometry(0.42, 0.7, 6, 14), color: '#ffffff', rot: [0, 0, 0] }, { geo: TOR(0.43, 0.06, 6, 18), color: '#3d2f4f', pos: [0, -0.1, 0], rot: [PI / 2, 0, 0] }, { geo: TOR(0.43, 0.06, 6, 18), color: '#3d2f4f', pos: [0, -0.4, 0], rot: [PI / 2, 0, 0] },
    { geo: SPH(0.1, 10, 8), color: '#2b2230', pos: [-0.17, 0.5, 0.32] }, { geo: SPH(0.1, 10, 8), color: '#2b2230', pos: [0.17, 0.5, 0.32] }, { geo: CONE(0.12, 0.3, 6), color: '#fff3c9', pos: [0, 0.82, 0.08] }]),
  boss: bake([{ geo: SPH(1.15, 22, 16), color: '#ffffff', scl: [1.1, 0.95, 1] }, { geo: SPH(0.28, 12, 10), color: '#fffbe0', pos: [-0.45, 0.4, 0.85] }, { geo: SPH(0.28, 12, 10), color: '#fffbe0', pos: [0.45, 0.4, 0.85] },
    { geo: SPH(0.13, 10, 8), color: '#2b2230', pos: [-0.45, 0.4, 1.08] }, { geo: SPH(0.13, 10, 8), color: '#2b2230', pos: [0.45, 0.4, 1.08] },
    ...[-0.8, -0.3, 0.3, 0.8].map(x => ({ geo: CONE(0.2, 0.6, 6), color: '#ffcf5a', pos: [x, 1.05 - Math.abs(x) * 0.3, 0], rot: [0, 0, -x * 0.4] })),
    { geo: CYL(0.18, 0.14, 0.7, 8), color: '#3d2f4f', pos: [-0.6, -1.05, 0] }, { geo: CYL(0.18, 0.14, 0.7, 8), color: '#3d2f4f', pos: [0.6, -1.05, 0] }]),
};
const MKIND = {
  walker: { col: '#7ee06a', hp: 44, spd: 1.35, r: 0.62, dmg: 5, every: 1.0, y: 0.72 },
  flyer: { col: '#ff6f9f', hp: 24, spd: 3.2, r: 0.55, dmg: 9, every: 0, y: 7 },
  burrower: { col: '#ffb02e', hp: 50, spd: 2.0, r: 0.6, dmg: 8, every: 1.2, y: 0.82 },
  boss: { col: '#9b6bff', hp: 420, spd: 0.75, r: 1.3, dmg: 22, every: 1.4, y: 1.4 },
};
const pool = [];
function getMonster(kind) {
  let m = pool.find(q => !q.used && q.kind === kind);
  if (!m) { const mesh = new THREE.Mesh(MGEO[kind], vcMat({ color: MKIND[kind].col, roughness: 0.35, emissive: '#ffffff', emissiveIntensity: 0 })); mesh.castShadow = true; scene.add(mesh); m = { kind, mesh }; pool.push(m); }
  m.used = true; m.mesh.visible = true; return m;
}
const spits = [], spitMesh = new THREE.InstancedMesh(SPH(0.22, 10, 8), M('#b6ff5a', { emissive: '#7dff3a', emissiveIntensity: 0.5 }), 30); spitMesh.count = 0; spitMesh.frustumCulled = false; scene.add(spitMesh);
const mounds = [], moundMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.6, 14, 8, 0, PI * 2, 0, PI / 2), M('#8b5e3c'), 12); moundMesh.count = 0; moundMesh.frustumCulled = false; scene.add(moundMesh);

// ================================================================ upgrades + gadgets
const UPS = [
  { k: 'laser', name: 'Laser power', ic: '🔺', base: 5, max: 10, desc: l => `${Math.round(laserDps(l))} dmg/s` },
  { k: 'turn', name: 'Laser swivel', ic: '🔄', base: 4, max: 8, desc: l => `${(turnSpd(l)).toFixed(1)} rad/s` },
  { k: 'shield', name: 'Shield', ic: '🛡️', base: 5, max: 10, desc: l => `${Math.round(shieldMax(l))} shield` },
  { k: 'drill', name: 'Drill', ic: '⛏️', base: 4, max: 10, desc: l => `×${drillPow(l).toFixed(1)} speed` },
  { k: 'carry', name: 'Carry rack', ic: '🎒', base: 3, max: 8, desc: l => `${carryCap(l)} chunks` },
  { k: 'jet', name: 'Jetpack', ic: '🚀', base: 3, max: 8, desc: l => `${jetSpd(l).toFixed(1)} speed` },
  { k: 'pulse', name: 'Shock Pulse', ic: '⚡', base: 6, max: 6, gadget: true, desc: l => `every ${pulseEvery(l).toFixed(0)} s` },
  { k: 'sentry', name: 'Sentry Pod', ic: '🛰️', base: 6, max: 6, gadget: true, desc: l => `${Math.round(sentryDmg(l))} per shot` },
  { k: 'magnet', name: 'Ore Magnet', ic: '🧲', base: 5, max: 6, gadget: true, desc: l => `${magnetR(l).toFixed(1)} m pull` },
];
const GADGETS = ['pulse', 'sentry', 'magnet'];
const laserDps = l => 24 * Math.pow(1.3, l), turnSpd = l => 1.7 * (1 + 0.22 * l), shieldMax = l => 50 + 22 * l, drillPow = l => 2.4 * (1 + 0.35 * l);
const carryCap = l => 4 + 2 * l, jetSpd = l => 3.4 * (1 + 0.14 * l), pulseEvery = l => Math.max(5, 13 - 1.5 * l), sentryDmg = l => 9 * (1 + 0.45 * l), magnetR = l => 1.6 + 0.7 * l;
const costOf = (u, l) => ({ a: Math.round(u.base * Math.pow(1.5, l)), b: l >= 2 ? Math.round(u.base * 0.35 * Math.pow(1.45, l - 1)) : 0 });
const HULL = 120;

// ================================================================ run state
let state = 'ready', phase = 'mine', wave = 0, waves = 0, gs = 1, runT0 = 0, recorded = false, beatenShown = false;
let ore = { a: 0, b: 0 }, lv = {}, got = {}, hull = HULL, shield = 50, shieldCd = 0, mineT = 45, mineMax = 45, phaseT = 0, trips = 0;
const mn = { x: 0, y: 0.25, vx: 0, vy: 0, face: -PI / 2, drillT: 0, drilling: -1, flip: 1 };
let carried = [], loose = [], mons = [], spawnQ = [], waveT = 0, waveTot = 1, killed = 0, laserA = 0, laserTA = 0, pulseT = 0, sentryT = 0;
const joy = { x: 0, y: 0 }; const keys = {};
const lvl = k => lv[k] || 0;

function freshRun() {
  seedBase = D.seed ? D.seed : (Date.now() % 100000) + 7;
  genMine(seedBase); paintGrid();
  wave = 0; waves = 0; ore = { a: 0, b: 0 }; lv = {}; got = {}; hull = HULL; shield = shieldMax(0); carried = []; loose = []; trips = 0;
  recorded = false; beatenShown = false; runT0 = performance.now();
}
function saveRun() {
  if (D.seed || state === 'lost') return;
  let dug = ''; for (let i = 0; i < W * H; i++) dug += cells[i] === 0 ? '1' : '0';
  S.set('run', { seed: seedBase, wave, waves, ore, lv, got, hull, dug, ms: performance.now() - runT0 });
}
function loadRun(R) {
  seedBase = R.seed; genMine(seedBase);
  for (let i = 0; i < W * H; i++) if (R.dug[i] === '1') cells[i] = 0;
  paintGrid(); wave = R.wave; waves = R.waves; ore = R.ore; lv = R.lv || {}; got = R.got || {}; hull = R.hull; shield = shieldMax(lvl('shield'));
  carried = []; loose = []; trips = 0; recorded = false; beatenShown = false; runT0 = performance.now() - (R.ms || 0);
}
function beginMine() {
  phase = 'mine'; state = 'play'; phaseT = 0;
  mineMax = mineT = wave === 0 ? 45 : Math.min(75, 50 + wave * 2.5);
  mn.x = 0; mn.y = 0.25; mn.vx = mn.vy = 0; shield = shieldMax(lvl('shield'));
  for (const m of mons) { m.used = false; m.mesh.visible = false; } mons = []; spits.length = 0; mounds.length = 0;
  beam.visible = false; sentry.visible = !!got.sentry;
  ui.levels(wave + 1); paintHud(); saveRun();
  banner(wave === 0 ? 'DIG FOR ORE<small>bring it back to the Haven before the monsters come</small>' : `WAVE ${wave + 1} IN ${Math.round(mineT)} s<small>dig, bank ore, upgrade</small>`, 2200);
}
function startWave() {
  if (phase !== 'mine' || state !== 'play') return;
  closeShop();
  if (mn.y < -0.5 || Math.abs(mn.x) > 0.6) { spark(mn.x, mn.y, 0.4, ['#ffffff', '#ffcf5a'], 14, 3, 2); tone(880, 0.2, 'sine', 0.08, 0.3); }
  bank(true); mn.x = 0; mn.y = 0.25;
  phase = 'wave'; wave++; phaseT = 0; waveT = 0; killed = 0; laserTA = laserA;
  const k = F.k(), hs = (1 + (wave - 1) * 0.24) * k;
  const list = [], nW = 2 + Math.floor(wave * 1.1), nF = wave >= 2 ? Math.floor((wave - 1) * 0.9) : 0, nB = wave >= 4 ? Math.floor((wave - 2) / 2) : 0;
  for (let i = 0; i < nW; i++) list.push('walker'); for (let i = 0; i < nF; i++) list.push('flyer'); for (let i = 0; i < nB; i++) list.push('burrower');
  const rr = rng(seedBase * 31 + wave);
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rr() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  if (wave % 5 === 0) list.splice(Math.floor(list.length * 0.5), 0, 'boss');
  const gap = Math.max(0.6, 2.2 - wave * 0.06);
  spawnQ = list.map((kind, i) => ({ t: 1 + i * gap * (kind === 'boss' ? 1.5 : 1), kind, side: rr() < 0.5 ? -1 : 1, hp: MKIND[kind].hp * hs * (kind === 'boss' ? 1 + wave * 0.05 : 1) }));
  waveTot = spawnQ.length;
  ui.levels(wave); paintHud(); buzz(40);
  banner(wave % 5 === 0 ? `WAVE ${wave}<small>A Bramble Titan is coming!</small>` : `WAVE ${wave}<small>drag to swing the laser</small>`, 1600);
  tone(220, 0.3, 'sawtooth', 0.08, 1.5); setTimeout(() => tone(330, 0.3, 'sawtooth', 0.08, 1.5), 180);
}
function waveWon() {
  state = 'won'; waves = wave; beam.visible = false; sfxWin();
  B.submit(waves, { ms: performance.now() - runT0 });
  if (!beatenShown && D.beaten(waves)) { beatenShown = true; ui.pop('BEATEN!', '#ffd23f', 44); confetti(scene, new THREE.Vector3(0, 3, 1), 60); }
  const best = Math.max(S.get('best', 0), waves); S.set('best', best);
  D.won(waves, 'held');
  saveRun();
  const bonus = 2 + Math.floor(wave / 2); ore.a += bonus;
  ui.win(wave, `+${bonus} Glowite bonus · ${Math.round(hull)} hull left`);
  confetti(scene, new THREE.Vector3(0, 2.5, 1), 50);
}
function lose() {
  if (state !== 'play') return;
  state = 'lost'; beam.visible = false; buzz([80, 50, 160]); shake = 0.9;
  tone(200, 0.4, 'sawtooth', 0.12, 0.4); setTimeout(() => tone(110, 0.6, 'square', 0.1, 0.5), 250);
  spark(0, 1, 0.5, ['#bfeaff', '#ffffff', '#5b6178'], 60, 6, 6, 2);
  glass.visible = false;
  if (!recorded) { recorded = true; F.level(false, Math.min(1, waves / 20)); B.submit(waves, { ms: performance.now() - runT0 }); }
  const best = Math.max(S.get('best', 0), waves); S.set('best', best);
  if (!D.seed) S.set('run', null);
  ui.lose('HAVEN FELL', `You held ${waves} wave${waves === 1 ? '' : 's'} · best ${best}`);
}

// ================================================================ mining
function bank(silent = false) {
  if (!carried.length) return;
  let a = 0, b = 0; for (const c of carried) { if (c.t === 4) a++; else b++; spark(c.x, c.y, 0.3, ORE_COL[c.t], 4, 2, 2); }
  ore.a += a; ore.b += b; carried = []; trips++;
  if (!silent) { [660, 880, 1100].forEach((f, i) => setTimeout(() => tone(f, 0.08, 'triangle', 0.1, 1.1), i * 60)); ui.pop(`+${a ? a + ' Glowite' : ''}${a && b ? ' · ' : ''}${b ? b + ' Frostcap' : ''}`, '#ffe08a', 26, 30); bumpChip(); }
  paintHud();
}
function breakCell(i) {
  const t = cells[i], c = i % W, y = Math.floor(i / W), x = c - X0, yy = -y - 0.5;
  setBlock(i, 0.0001); cells[i] = 0; prog[i] = 0;
  spark(x, yy, 0.4, [ROCK[host[i]], '#d9c2a8'], 10, 2.6, 2.2, 1.2);
  tone(160 + Math.random() * 40, 0.08, 'square', 0.06, 0.5);
  if (t === 4 || t === 5) { const n = t === 4 && Math.random() < 0.35 ? 2 : 1; for (let k = 0; k < n; k++) loose.push({ t, x: x + (k - 0.5) * 0.2, y: yy, vx: (Math.random() - 0.5) * 2, vy: 1.5 }); tone(1200, 0.06, 'triangle', 0.09, 1.3); spark(x, yy, 0.5, ORE_COL[t], 8, 2, 2); }
  if (t === 6) {
    const g = GADGETS.find(k => !got[k]);
    spark(x, yy, 0.5, ['#7dff8a', '#ffffff'], 30, 3, 3, 1.4); ring(x, yy, 1.6, '#7dff8a');
    if (g) { got[g] = true; lv[g] = lv[g] || 0; const u = UPS.find(q => q.k === g); banner(`SEEDSTONE RELIC!<small>${u.ic} ${u.name} unlocked</small>`, 2400); if (g === 'sentry') sentry.visible = true; }
    else { ore.a += 6; ore.b += 4; banner('SEEDSTONE RELIC!<small>+6 Glowite +4 Frostcap</small>', 2000); }
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.14, 'triangle', 0.12, 1), i * 90)); buzz([20, 30, 40]);
  }
}
function moveMiner(h) {
  let ix = joy.x, iy = joy.y;
  if (keys.a || keys.arrowleft) ix = -1; if (keys.d || keys.arrowright) ix = 1; if (keys.w || keys.arrowup) iy = 1; if (keys.s || keys.arrowdown) iy = -1;
  const len = Math.hypot(ix, iy); if (len > 1) { ix /= len; iy /= len; }
  const slow = Math.max(0.45, 1 - carried.length * 0.05), sp = jetSpd(lvl('jet')) * slow;
  mn.vx = lerp(mn.vx, ix * sp, Math.min(1, h * 10)); mn.vy = lerp(mn.vy, iy * sp, Math.min(1, h * 10));
  const R = 0.31; mn.drilling = -1;
  const horiz = Math.abs(ix) >= Math.abs(iy);
  if (len > 0.25) mn.face = Math.atan2(iy, ix);
  // auto-centre on the row / column you're travelling along so corners never snag
  if (len > 0.25) { if (horiz) { const cy = Math.max(-Math.floor(-mn.y) - 0.5, -0.5) ; if (mn.y < 0) mn.y = lerp(mn.y, cy, Math.min(1, h * 6)); } else { const cx = Math.round(mn.x); mn.x = lerp(mn.x, cx, Math.min(1, h * 6)); } }
  // drill the block ahead
  if (len > 0.25) {
    const dx = horiz ? Math.sign(ix) : 0, dy = horiz ? 0 : Math.sign(iy);
    const [c, r] = cellOf(mn.x + dx * (R + 0.12), mn.y + dy * (R + 0.12));
    if (r >= 0 && c >= 0 && c < W && r < H && cells[idx(c, r)] !== 0 && !(mn.y > 0 && dy > 0)) {
      const i = idx(c, r);
      if (cells[i] === 9) { if (Math.random() < 0.05) tone(1500, 0.03, 'square', 0.03, 0.9); }
      else {
        mn.drilling = i; prog[i] += drillPow(lvl('drill')) * h / hard[i];
        setBlock(i, 1 - prog[i] * 0.12, (Math.random() - 0.5) * 0.05 * (1 + prog[i]));
        if (Math.random() < 0.35) spark(c - X0 - dx * 0.45, -r - 0.5 - dy * 0.45, 0.5, ROCK[host[i]], 1, 1.5, 1, 0.8);
        if (prog[i] >= 1) breakCell(i);
      }
    }
  }
  // move with collision (axis-separated)
  const nx = mn.x + mn.vx * h;
  if (!solidAt(nx + Math.sign(mn.vx) * R, mn.y + R * 0.7) && !solidAt(nx + Math.sign(mn.vx) * R, mn.y - R * 0.7)) mn.x = nx; else mn.vx = 0;
  const ny = mn.y + mn.vy * h;
  if (!solidAt(mn.x + R * 0.7, ny + Math.sign(mn.vy) * R) && !solidAt(mn.x - R * 0.7, ny + Math.sign(mn.vy) * R)) mn.y = ny; else mn.vy = 0;
  mn.y = Math.min(mn.y, 0.45);
  // pick up ore + magnet
  const cap = carryCap(lvl('carry')), mr = got.magnet ? magnetR(lvl('magnet')) : 0;
  for (let i = loose.length - 1; i >= 0; i--) {
    const o = loose[i]; o.vy -= 9 * h; o.x += o.vx * h; o.y += o.vy * h; o.vx *= 0.96;
    const [c, r] = cellOf(o.x, o.y - 0.17); if (solidCell(c, r) || o.y < -H) { o.y = Math.max(o.y, -r + 0.17 - 0.0); o.vy = 0; o.vx *= 0.6; }
    const d = Math.hypot(o.x - mn.x, o.y - mn.y);
    if (mr && d < mr && carried.length < cap) { o.x = lerp(o.x, mn.x, h * 5); o.y = lerp(o.y, mn.y, h * 5); o.vy = 0; }
    if (d < 0.6 && carried.length < cap) { loose.splice(i, 1); carried.push(o); tone(900 + carried.length * 80, 0.05, 'triangle', 0.08, 1.2); if (carried.length === cap) ui.pop('FULL! Head back up', '#ffe08a', 24, 30); }
  }
  // tether chain follows
  let px = mn.x, py = mn.y;
  for (const o of carried) { const dx = o.x - px, dy = o.y - py, d = Math.hypot(dx, dy) || 1; if (d > 0.42) { o.x = px + dx / d * 0.42; o.y = py + dy / d * 0.42; } px = o.x; py = o.y; }
  if (mn.y > -0.6 && Math.abs(mn.x) < 0.7 && carried.length) bank();
}

// ================================================================ defend
function spawnMonster(q) {
  const k = MKIND[q.kind], m = getMonster(q.kind);
  Object.assign(m, { hp: q.hp, max: q.hp, r: k.r, flash: 0, stun: 0, cd: 0.5, st: 'go', t: 0, ph: Math.random() * 6, side: q.side, spitT: 2 });
  if (q.kind === 'flyer') { m.x = q.side * (viewHalf * 1.22 + 2); m.y = 6 + Math.random() * 3; m.hx = q.side * (3 + Math.random() * 3); m.hy = 5.5 + Math.random() * 3; }
  else if (q.kind === 'burrower') { m.x = q.side * (2.8 + Math.random() * 2.6); m.y = -0.6; m.st = 'warn'; m.t = 1.4; mounds.push(m); m.mesh.visible = false; tone(90, 0.3, 'triangle', 0.08, 0.7); }
  else { m.x = q.side * (viewHalf * 1.22 + 1.6); m.y = k.y; }
  mons.push(m);
}
function hurt(d, x, y) {
  shieldCd = 2.5;
  if (shield > 0) { const a = Math.min(shield, d); shield -= a; d -= a; shieldMesh.material.opacity = 0.5; tone(1300, 0.08, 'square', 0.05, 0.6); spark(x, y, 0.6, '#6ff3ff', 8, 2.5, 2); if (shield <= 0) { tone(500, 0.3, 'sawtooth', 0.09, 0.3); ui.pop('SHIELD DOWN!', '#6ff3ff', 28, 30); } }
  if (d > 0) { hull -= d; shake = Math.max(shake, 0.3); redFlash(); tone(120, 0.15, 'square', 0.1, 0.6); buzz(30); spark(x, y, 0.6, ['#ffcf5a', '#ff6f6f'], 8, 2.5, 2); }
  paintBars();
  if (hull <= 0) { hull = 0; lose(); }
}
function killMonster(m) {
  m.used = false; m.mesh.visible = false; killed++;
  const big = m.kind === 'boss';
  spark(m.x, m.y, 0.5, [MKIND[m.kind].col, '#ffffff', '#ffe08a'], big ? 50 : 18, big ? 5 : 3.5, 3, big ? 2 : 1.2);
  ring(m.x, m.y, big ? 3 : 1.4, MKIND[m.kind].col);
  tone(big ? 140 : 420 + Math.random() * 200, big ? 0.4 : 0.1, big ? 'sawtooth' : 'triangle', 0.1, big ? 0.4 : 1.8);
  if (big) { shake = 0.6; ui.pop('TITAN DOWN!', '#ffd23f', 36); buzz([40, 30, 60]); ore.b += 3; }
}
function defend(h) {
  waveT += h;
  while (spawnQ.length && spawnQ[0].t <= waveT) spawnMonster(spawnQ.shift());
  // laser
  let ix = 0; if (keys.a || keys.arrowleft) ix -= 1; if (keys.d || keys.arrowright) ix += 1; if (holdDir) ix += holdDir;
  if (ix) laserTA += ix * turnSpd(lvl('turn')) * h * 1.2;
  laserTA = clamp(laserTA, -1.95, 1.95);
  const ts = turnSpd(lvl('turn')) * h; laserA += clamp(laserTA - laserA, -ts, ts);
  const dxL = Math.sin(laserA), dyL = Math.cos(laserA);
  let best = null, bt = dyL < 0 ? (LASER_O.y - 0.1) / -dyL : 40;
  for (const m of mons) { if (!m.used || m.st === 'warn') continue; const vx = m.x - LASER_O.x, vy = m.y - LASER_O.y, t = vx * dxL + vy * dyL; if (t < 0) continue; const perp = Math.abs(vx * dyL - vy * dxL); if (perp < m.r + 0.12 && t < bt) { bt = t; best = m; } }
  beam.visible = true; beam.rotation.z = -laserA; beam.scale.set(1, Math.max(0.1, bt - 0.2), 1); turretMesh.rotation.z = -laserA; beamMat.opacity = 0.7 + Math.sin(clockT * 40) * 0.2;
  if (best) {
    best.hp -= laserDps(lvl('laser')) * h; best.flash = 1;
    if (Math.random() < 0.5) spark(LASER_O.x + dxL * bt, LASER_O.y + dyL * bt, 0.5, ['#ff6fa8', '#ffffff'], 1, 2.5, 1.5, 0.8);
    if (performance.now() - hitSnd > 70) { hitSnd = performance.now(); tone(700 + Math.random() * 120, 0.05, 'sawtooth', 0.035, 0.8); }
    if (best.hp <= 0) killMonster(best);
  } else if (dyL < 0 && Math.random() < 0.15) spark(LASER_O.x + dxL * bt, 0.2, 0.5, '#d9c2a8', 1, 1.5, 1.5, 0.7);
  // gadgets
  if (got.pulse) { pulseT -= h; if (pulseT <= 0 && mons.some(m => m.used && m.st !== 'warn' && Math.hypot(m.x, m.y) < 5)) { pulseT = pulseEvery(lvl('pulse')); ring(0, 1, 5, '#ffe08a'); tone(160, 0.3, 'square', 0.08, 2); for (const m of mons) if (m.used && Math.hypot(m.x, m.y) < 5.2) { m.hp -= 14 * (1 + 0.5 * lvl('pulse')); m.stun = 1.6; m.flash = 1; if (m.hp <= 0) killMonster(m); } } }
  if (got.sentry) { sentryT -= h; if (sentryT <= 0) { let tg = null, bd = 10; for (const m of mons) { if (!m.used || m.st === 'warn') continue; const d = Math.hypot(m.x - sentry.position.x, m.y - 0.8); if (d < bd) { bd = d; tg = m; } } if (tg) { sentryT = 0.9; bolt(sentry.position.x, 1.0, tg.x, tg.y); tg.hp -= sentryDmg(lvl('sentry')); tg.flash = 1; tone(1500, 0.04, 'square', 0.04, 0.5); if (tg.hp <= 0) killMonster(tg); } else sentryT = 0.2; } }
  // monsters
  for (const m of mons) {
    if (!m.used) continue; const k = MKIND[m.kind]; m.t -= h; m.cd -= h;
    if (m.stun > 0) { m.stun -= h; continue; }
    const edge = 1.75 + m.r;
    if (m.kind === 'flyer') {
      if (m.st === 'go') { const dx = m.hx - m.x, dy = m.hy - m.y, d = Math.hypot(dx, dy); if (d < 0.3) { m.st = 'hover'; m.t = 1 + Math.random(); } else { m.x += dx / d * k.spd * h; m.y += dy / d * k.spd * h; } }
      else if (m.st === 'hover') { m.y += Math.sin(clockT * 4 + m.ph) * h; if (m.t <= 0) m.st = 'dive'; }
      else if (m.st === 'dive') { const dx = -m.x, dy = 2.1 - m.y, d = Math.hypot(dx, dy); m.x += dx / d * k.spd * 2.2 * h; m.y += dy / d * k.spd * 2.2 * h; if (d < 2.3) { hurt(k.dmg, m.x * 0.8, m.y); m.st = 'go'; m.hx = Math.sign(m.x || 1) * (3 + Math.random() * 3); m.hy = 5.5 + Math.random() * 3; } }
    } else if (m.kind === 'burrower' && m.st === 'warn') {
      if (m.t <= 0) { m.st = 'go'; m.y = MKIND.burrower.y; m.mesh.visible = true; mounds.splice(mounds.indexOf(m), 1); spark(m.x, 0.3, 0.4, ['#8b5e3c', '#b07a52'], 16, 3, 3); tone(110, 0.2, 'square', 0.08, 1.6); }
    } else if (m.kind === 'boss') {
      const stop = 5.2;
      if (Math.abs(m.x) > stop) m.x -= Math.sign(m.x) * k.spd * h;
      else { m.spitT -= h; if (m.spitT <= 0) { m.spitT = 2.6; spits.push({ x: m.x - Math.sign(m.x) * 1, y: m.y + 0.8, vx: -Math.sign(m.x) * 3.2, vy: 6.5 }); tone(260, 0.15, 'sine', 0.08, 0.5); } }
    } else {
      if (Math.abs(m.x) > edge) m.x -= Math.sign(m.x) * k.spd * (m.kind === 'burrower' ? 1.4 : 1) * h;
      else if (m.cd <= 0) { m.cd = k.every; hurt(k.dmg, Math.sign(m.x) * 1.8, 0.9); m.bump = 1; }
    }
  }
  for (let i = spits.length - 1; i >= 0; i--) { const s = spits[i]; s.vy -= 6 * h; s.x += s.vx * h; s.y += s.vy * h; if (Math.hypot(s.x, s.y - 0.4) < 2.1 || s.y < 0) { if (s.y >= 0 || Math.abs(s.x) < 2.5) hurt(14, s.x, Math.max(0.5, s.y)); spark(s.x, Math.max(0.2, s.y), 0.5, '#b6ff5a', 10, 2.5, 2); spits.splice(i, 1); } }
  // a laser-hit on a spit? no — spits are dodged by killing the Titan
  if (shieldCd > 0) shieldCd -= h; else shield = Math.min(shieldMax(lvl('shield')), shield + (6 + lvl('shield') * 1.5) * h);
  let j = 0; for (const m of mons) if (m.used) mons[j++] = m; mons.length = j;
  if (!spawnQ.length && !mons.length && state === 'play') waveWon();
}

// ================================================================ HUD / shop DOM
const css = document.createElement('style'); css.textContent = `
.dh-hud{position:fixed;top:calc(54px + env(safe-area-inset-top));left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:5px;z-index:5;pointer-events:none}
.dh-row{display:flex;gap:6px}
.dh-chip{background:rgba(28,20,44,.62);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);border-radius:14px;padding:1px 10px;font-weight:800;font-size:17px;display:flex;gap:6px;align-items:center;box-shadow:0 3px 0 rgba(0,0,0,.14)}
.dh-chip i{width:12px;height:12px;border-radius:3px;transform:rotate(45deg);display:inline-block}.dh-chip.bump{animation:dhb .3s}@keyframes dhb{50%{transform:scale(1.2)}}
.dh-bars{display:flex;flex-direction:column;gap:3px;width:min(220px,56vw)}
.dh-bar{height:9px;border-radius:6px;background:rgba(28,20,44,.55);overflow:hidden}.dh-bar b{display:block;height:100%;border-radius:6px;transition:width .15s}
.dh-tr{position:fixed;top:calc(10px + env(safe-area-inset-top));right:10px;z-index:7;display:flex;gap:6px}
.dh-ib{width:40px;height:40px;border-radius:50%;border:0;background:rgba(28,20,44,.62);color:#fff;font-size:18px;cursor:pointer;display:grid;place-items:center}
.dh-bot{position:fixed;left:0;right:0;bottom:calc(14px + env(safe-area-inset-bottom));display:flex;justify-content:center;align-items:flex-end;gap:10px;z-index:8;padding:0 12px;pointer-events:none}
.dh-bot>*{pointer-events:auto}
.dh-b{border:0;border-radius:20px;font:800 17px/1.05 'Baloo 2',system-ui;color:#fff;background:#7b5cff;padding:10px 14px;box-shadow:0 5px 0 rgba(0,0,0,.25);cursor:pointer;min-width:64px;touch-action:none}
.dh-b small{display:block;font-size:11px;opacity:.9;font-weight:600}.dh-b:active{transform:translateY(3px);box-shadow:0 2px 0 rgba(0,0,0,.25)}
.dh-b.go{background:#ff5d6c}.dh-b.sp{background:rgba(28,20,44,.7);min-width:54px}.dh-b.shop{background:#ffb02e;color:#3a2410}
.dh-b.arrow{width:84px;height:84px;border-radius:50%;font-size:34px;background:rgba(255,111,168,.85)}
.dh-joy{position:fixed;width:110px;height:110px;margin:-55px 0 0 -55px;border-radius:50%;border:3px solid rgba(255,255,255,.5);background:rgba(28,20,44,.25);z-index:6;pointer-events:none}
.dh-joy i{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:rgba(255,255,255,.85)}
.dh-shop{position:fixed;left:0;right:0;bottom:0;z-index:20;display:flex;justify-content:center;background:rgba(20,14,32,.5);top:0;align-items:flex-end}
.dh-sheet{width:min(520px,100%);max-height:78vh;overflow:auto;background:#2a2140;border-radius:22px 22px 0 0;padding:14px 12px calc(14px + env(safe-area-inset-bottom));box-shadow:0 -10px 30px rgba(0,0,0,.4)}
.dh-sheet h2{margin:0 0 4px;font-size:24px;display:flex;justify-content:space-between;align-items:center}
.dh-sheet h2 button{border:0;background:rgba(255,255,255,.14);color:#fff;border-radius:12px;font:800 16px 'Baloo 2';padding:4px 12px;cursor:pointer}
.dh-wallet{font-size:15px;opacity:.9;margin-bottom:8px;font-weight:600}
.dh-up{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.07);border-radius:14px;padding:7px 9px;margin-bottom:6px}
.dh-up .ic{font-size:24px;width:32px;text-align:center}.dh-up .tx{flex:1;line-height:1.1;font-weight:800;font-size:16px}.dh-up .tx small{display:block;font-weight:600;font-size:12px;opacity:.75}
.dh-up button{border:0;border-radius:12px;background:#ffb02e;color:#3a2410;font:800 14px/1.1 'Baloo 2';padding:7px 10px;cursor:pointer;min-width:84px}
.dh-up button.no{background:#4b3f63;color:#b9b0cc}.dh-up.lock{opacity:.45}
.dh-red{position:fixed;inset:0;pointer-events:none;z-index:4;box-shadow:inset 0 0 90px 30px rgba(255,40,60,.7);opacity:0;transition:opacity .3s}
.dh-banner{position:fixed;left:0;right:0;top:30%;text-align:center;font-weight:800;font-size:38px;line-height:1;pointer-events:none;z-index:6;text-shadow:0 4px 0 rgba(0,0,0,.25);opacity:0;transition:opacity .3s,transform .3s;transform:scale(.85);padding:0 16px}
.dh-banner.on{opacity:1;transform:scale(1)}.dh-banner small{display:block;font-size:18px;margin-top:6px}
.dh-mini{border:0;border-radius:14px;background:rgba(255,255,255,.22);color:#fff;font:800 15px/1 'Baloo 2',system-ui;padding:9px 16px;cursor:pointer;margin-top:6px}
.hc-card{background:linear-gradient(rgba(30,18,52,.55),rgba(30,18,52,.1) 55%,rgba(30,18,52,.5))}
.dh-sub{font-size:17px!important}
`; document.head.appendChild(css);
const hud = $(`<div class="dh-hud"><div class="dh-row"><div class="dh-chip" data-o><i style="background:#ffb02e"></i><span data-a>0</span><i style="background:#4fc3ff;margin-left:4px"></i><span data-b>0</span></div><div class="dh-chip" data-c>🎒 <span>0/4</span></div><div class="dh-chip" data-t>⏱ <span>45</span></div></div><div class="dh-bars"><div class="dh-bar"><b data-s style="background:#6ff3ff"></b></div><div class="dh-bar"><b data-h style="background:#ff6f8f"></b></div></div></div>`);
const tr = $(`<div class="dh-tr"><button class="dh-ib" data-mute>🔊</button></div>`);
const bot = $(`<div class="dh-bot"></div>`);
const red = $(`<div class="dh-red"></div>`), ban = $(`<div class="dh-banner"></div>`), joyEl = $(`<div class="dh-joy" hidden><i></i></div>`);
document.body.append(hud, tr, bot, red, ban, joyEl);
for (const el of [tr, bot]) for (const ev of ['pointerdown', 'pointerup']) el.addEventListener(ev, e => e.stopPropagation());
let muted = S.get('muted', false);
const paintMute = () => tr.querySelector('[data-mute]').textContent = muted ? '🔇' : '🔊'; paintMute();
tr.querySelector('[data-mute]').onclick = () => { muted = !muted; S.set('muted', muted); paintMute(); };
let bannerT = 0;
function banner(h, ms = 1500) { ban.innerHTML = h; ban.classList.add('on'); clearTimeout(bannerT); bannerT = setTimeout(() => ban.classList.remove('on'), ms); }
const redFlash = () => { red.style.opacity = 1; setTimeout(() => red.style.opacity = 0, 160); };
const bumpChip = () => { const e = hud.querySelector('[data-o]'); e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump'); };
function paintBars() { hud.querySelector('[data-s]').style.width = (shield / shieldMax(lvl('shield')) * 100) + '%'; hud.querySelector('[data-h]').style.width = (hull / HULL * 100) + '%'; }
let botMode = '';
function paintHud() {
  hud.querySelector('[data-a]').textContent = ore.a; hud.querySelector('[data-b]').textContent = ore.b;
  hud.querySelector('[data-c]').style.display = phase === 'mine' ? '' : 'none'; hud.querySelector('[data-t]').style.display = phase === 'mine' ? '' : 'none';
  hud.querySelector('[data-c] span').textContent = `${carried.length}/${carryCap(lvl('carry'))}`;
  hud.querySelector('[data-t] span').textContent = Math.max(0, Math.ceil(mineT));
  paintBars();
  const mode = state !== 'play' ? 'none' : phase + gs;
  if (mode === botMode) return; botMode = mode;
  if (mode === 'none') { bot.innerHTML = ''; return; }
  if (phase === 'mine') {
    bot.innerHTML = `<button class="dh-b shop" data-shop>⚙️ Upgrades<small>spend ore</small></button><button class="dh-b sp" data-sp>×${gs}<small>speed</small></button><button class="dh-b go" data-go>⚔️ Wave now<small>skip the timer</small></button>`;
    bot.querySelector('[data-shop]').onclick = openShop; bot.querySelector('[data-go]').onclick = () => startWave();
  } else {
    bot.innerHTML = `<button class="dh-b arrow" data-l>◀</button><button class="dh-b sp" data-sp>×${gs}<small>speed</small></button><button class="dh-b arrow" data-r>▶</button>`;
    const hold = (el, d) => { el.addEventListener('pointerdown', e => { e.stopPropagation(); holdDir = d; }); for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(ev, () => { if (holdDir === d) holdDir = 0; }); };
    hold(bot.querySelector('[data-l]'), -1); hold(bot.querySelector('[data-r]'), 1);
  }
  bot.querySelector('[data-sp]').onclick = () => { gs = gs === 1 ? 2 : gs === 2 ? 3 : 1; tone(600, 0.05, 'sine', 0.1); paintHud(); };
}
let holdDir = 0, shopEl = null;
function openShop() {
  if (state !== 'play' || phase !== 'mine') return;
  if (!shopEl) { shopEl = $(`<div class="dh-shop"><div class="dh-sheet"></div></div>`); for (const ev of ['pointerdown', 'pointerup']) shopEl.addEventListener(ev, e => e.stopPropagation()); shopEl.addEventListener('click', e => { if (e.target === shopEl) closeShop(); }); document.body.appendChild(shopEl); }
  shopEl.hidden = false; paintShop(); tone(500, 0.06, 'triangle', 0.1, 1.4);
}
function closeShop() { if (shopEl) shopEl.hidden = true; }
const shopOpen = () => shopEl && !shopEl.hidden;
function paintShop() {
  const sh = shopEl.firstChild;
  sh.innerHTML = `<h2>Haven workshop <button data-x>Done</button></h2><div class="dh-wallet">🟠 ${ore.a} Glowite · 🔷 ${ore.b} Frostcap · hull ${Math.round(hull)}/${HULL}</div>` +
    `<div class="dh-up"><span class="ic">🔧</span><span class="tx">Repair hull<small>+35 hull</small></span><button data-rep class="${ore.a >= repCost() && hull < HULL ? '' : 'no'}">🟠 ${repCost()}</button></div>` +
    UPS.map(u => {
      if (u.gadget && !got[u.k]) return `<div class="dh-up lock"><span class="ic">${u.ic}</span><span class="tx">${u.name}<small>Find a green Seedstone relic deep in the mine</small></span></div>`;
      const l = lvl(u.k), maxed = l >= u.max, c = costOf(u, l), ok = !maxed && ore.a >= c.a && ore.b >= c.b;
      return `<div class="dh-up"><span class="ic">${u.ic}</span><span class="tx">${u.name} · Lv ${l + 1}<small>${u.desc(l)}${maxed ? ' · max' : ` → ${u.desc(l + 1)}`}</small></span>${maxed ? '<button class="no">MAX</button>' : `<button data-u="${u.k}" class="${ok ? '' : 'no'}">🟠 ${c.a}${c.b ? ` 🔷 ${c.b}` : ''}</button>`}</div>`;
    }).join('');
  sh.querySelector('[data-x]').onclick = closeShop;
  sh.querySelector('[data-rep]').onclick = () => repair();
  sh.querySelectorAll('[data-u]').forEach(b => b.onclick = () => buy(b.dataset.u));
}
const repCost = () => 4 + wave;
function repair() { if (ore.a < repCost() || hull >= HULL) return false; ore.a -= repCost(); hull = Math.min(HULL, hull + 35); tone(700, 0.1, 'triangle', 0.1, 1.3); if (shopOpen()) paintShop(); paintHud(); return true; }
function buy(k) {
  const u = UPS.find(q => q.k === k), l = lvl(k); if (l >= u.max || (u.gadget && !got[k])) return false;
  const c = costOf(u, l); if (ore.a < c.a || ore.b < c.b) { tone(160, 0.12, 'square', 0.06); return false; }
  ore.a -= c.a; ore.b -= c.b; lv[k] = l + 1;
  if (k === 'shield') shield = shieldMax(lv[k]);
  [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.1, 'triangle', 0.12, 1), i * 60)); buzz(15);
  spark(0, 1.4, 0.8, ['#ffb02e', '#ffffff', '#6ff3ff'], 16, 2.5, 3);
  if (shopOpen()) paintShop(); paintHud(); return true;
}

// ================================================================ input
const canvas = stage.renderer.domElement;
let jo = null, aimDrag = null;
addEventListener('pointerdown', e => {
  if (e.target !== canvas || state !== 'play') return;
  if (phase === 'mine') { jo = { x: e.clientX, y: e.clientY, id: e.pointerId }; joyEl.hidden = false; joyEl.style.left = e.clientX + 'px'; joyEl.style.top = e.clientY + 'px'; joyEl.firstChild.style.transform = ''; }
  else { aimDrag = { x: e.clientX, a: laserTA }; if (e.pointerType === 'mouse') aimAt(e.clientX, e.clientY); }
});
addEventListener('pointermove', e => {
  if (jo && e.pointerId === jo.id) { let dx = e.clientX - jo.x, dy = e.clientY - jo.y; const d = Math.hypot(dx, dy), m = 48; if (d > m) { dx *= m / d; dy *= m / d; } joy.x = dx / m; joy.y = -dy / m; if (d < 8) joy.x = joy.y = 0; joyEl.firstChild.style.transform = `translate(${dx}px,${dy}px)`; }
  if (phase === 'wave' && state === 'play') { if (e.pointerType === 'mouse' && e.target === canvas) aimAt(e.clientX, e.clientY); else if (aimDrag) laserTA = clamp(aimDrag.a + (e.clientX - aimDrag.x) * 0.012, -1.95, 1.95); }
});
const endJoy = () => { jo = null; joy.x = joy.y = 0; joyEl.hidden = true; aimDrag = null; };
addEventListener('pointerup', endJoy); addEventListener('pointercancel', endJoy);
const ndc = new THREE.Vector3();
function aimAt(cx, cy) { ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1, 0.5).unproject(camera); const dir = ndc.sub(camera.position).normalize(), t = -camera.position.z / dir.z; const x = camera.position.x + dir.x * t, y = camera.position.y + dir.y * t; laserTA = clamp(Math.atan2(x - LASER_O.x, y - LASER_O.y), -1.95, 1.95); }
addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; if (e.key === ' ' && phase === 'mine' && state === 'play') { e.preventDefault(); startWave(); } if (e.key.toLowerCase() === 'u') shopOpen() ? closeShop() : openShop(); });
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

// ================================================================ camera
let zoom = 1, viewHalf = 7, camD = 30, shake = 0, clockT = 0, hitSnd = 0;
const camT = new THREE.Vector3(0, 0, 0);
function fit() {
  const tv = Math.tan(camera.fov * PI / 360), asp = innerWidth / innerHeight;
  camD = clamp(Math.max(6.4 / (tv * asp), 9 / tv), 15, 34); viewHalf = tv * asp * camD;
}
addEventListener('resize', () => setTimeout(fit, 30)); fit();

// ================================================================ music: cave arpeggio while mining, a driving beat in waves
const CAVE = [57, 60, 64, 67, 64, 60, 55, 59, 62, 65, 62, 59], DRIVE = [45, 45, 57, 45, 48, 48, 60, 48, 43, 43, 55, 43, 40, 40, 52, 47];
let ms = 0;
setInterval(() => {
  if (muted || state !== 'play' || document.hidden || shopOpen()) return; const i = ms++;
  if (phase === 'mine') { if (i % 2 === 0) note(CAVE[(i / 2) % 12], 0.6, 0.035); if (i % 16 === 7) tone(1800 + Math.random() * 400, 0.05, 'sine', 0.025, 0.5); }
  else { note(DRIVE[i % 16], 0.16, 0.05); if (i % 4 === 0) tone(70, 0.12, 'sine', 0.14, 0.4); if (i % 4 === 2) tone(3000, 0.02, 'square', 0.015, 0.8); if (i % 8 === 4) note(DRIVE[i % 16] + 24, 0.12, 0.03); }
}, 130);
function sfxWin() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.14, 1), i * 110)); }

// ================================================================ main loop
const O = new THREE.Object3D();
let hudT = 0;
loop((dt, T) => {
  clockT = T;
  if (state === 'play' && !shopOpen()) {
    demoSteer();
    let h = Math.min(dt / 60, 0.05) * gs;
    while (h > 0 && state === 'play') {
      const s = Math.min(h, 1 / 60); h -= s; phaseT += s;
      if (phase === 'mine') { moveMiner(s); mineT -= s; if (mineT <= 0) { startWave(); } }
      else defend(s);
    }
    if (phase === 'mine') ui.progress(1 - mineT / mineMax); else ui.progress(killed / Math.max(1, waveTot));
  }
  // miner pose
  const inMine = phase === 'mine' && state === 'play';
  miner.visible = inMine || state === 'ready';
  miner.position.set(mn.x, mn.y + Math.sin(T * 5) * 0.04, 0.05);
  const moving = Math.hypot(mn.vx, mn.vy) > 0.3 || mn.drilling >= 0;
  if (Math.abs(Math.cos(mn.face)) > 0.3) mn.flip = Math.cos(mn.face) > 0 ? 1 : -1;
  minerBody.rotation.y = lerp(minerBody.rotation.y, mn.flip * 0.5, 0.2); minerBody.rotation.z = -mn.vx * 0.06;
  drill.rotation.z = mn.face - PI / 2; drillBit.rotation.y += mn.drilling >= 0 ? 0.9 : 0.12;
  drill.position.set(Math.cos(mn.face) * 0.05, Math.sin(mn.face) * 0.05, 0.15);
  flame.scale.y = flame2.scale.y = (moving ? 1 : 0.5) * (0.8 + Math.random() * 0.4);
  const depth = Math.max(0, -mn.y);
  lamp.intensity = inMine ? clamp(depth * 2.5, 0, 14) : 0;
  hemi.intensity = phase === 'wave' || state !== 'play' ? 1.15 : lerp(1.15, 0.38, clamp(depth / 18, 0, 1));
  sun.position.set(mn.x + 6, Math.max(mn.y, 0) + 14, 8); sun.target.position.set(mn.x, Math.max(mn.y, -2), 0);
  // ore chunks
  for (const t of [4, 5]) { let n = 0; for (const o of [...loose, ...carried]) { if (o.t !== t || n >= 80) continue; O.position.set(o.x, o.y + 0.05, 0.25); O.rotation.set(T + o.x, T * 1.3, 0); O.scale.setScalar(1); O.updateMatrix(); chunkMesh[t].setMatrixAt(n++, O.matrix); } chunkMesh[t].count = n; chunkMesh[t].instanceMatrix.needsUpdate = true; }
  const tp = tether.geometry.attributes.position; let tx = mn.x, ty = mn.y; for (let i = 0; i < 16; i++) { const o = carried[Math.min(i, carried.length - 1)]; if (o && i < carried.length) { tx = o.x; ty = o.y; } tp.setXYZ(i, i === 0 ? mn.x : tx, i === 0 ? mn.y : ty, 0.22); } tp.needsUpdate = true; tether.visible = carried.length > 0 && inMine;
  // monsters
  for (const m of mons) {
    if (!m.used || m.st === 'warn') continue; const k = MKIND[m.kind];
    m.flash *= 0.8; m.mesh.material.emissiveIntensity = m.flash * 0.6 + (m.stun > 0 ? 0.3 : 0);
    m.bump = (m.bump || 0) * 0.85;
    const wob = Math.sin(T * (m.kind === 'flyer' ? 16 : 7) + m.ph);
    m.mesh.position.set(m.x - Math.sign(m.x) * (m.bump || 0) * 0.3, m.y + (m.kind === 'flyer' ? 0 : Math.abs(wob) * 0.08), 0.2);
    m.mesh.rotation.set(0, m.x > 0 ? -0.6 : 0.6, m.kind === 'flyer' ? wob * 0.15 : wob * 0.06);
    if (m.kind === 'flyer') m.mesh.scale.set(1, 1 + wob * 0.1, 1); else m.mesh.scale.set(1 + wob * 0.04, 1 - wob * 0.05, 1);
  }
  let n = 0; for (const m of mounds) { O.position.set(m.x, 0.25, 0.1); O.rotation.set(0, 0, 0); O.scale.setScalar(0.6 + Math.sin(T * 30) * 0.06 + (1.4 - m.t) * 0.3); O.updateMatrix(); moundMesh.setMatrixAt(n++, O.matrix); if (Math.random() < 0.2) spark(m.x, 0.3, 0.3, '#8b5e3c', 1, 1.5, 2, 0.7); } moundMesh.count = n; moundMesh.instanceMatrix.needsUpdate = true;
  n = 0; for (const s of spits) { O.position.set(s.x, s.y, 0.3); O.scale.setScalar(1); O.updateMatrix(); spitMesh.setMatrixAt(n++, O.matrix); } spitMesh.count = n; spitMesh.instanceMatrix.needsUpdate = true;
  // particles + fx
  const h = dt / 60; n = 0;
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.vy -= p.g * h; p.x += p.vx * h; p.y += p.vy * h; p.z += p.vz * h; p.life -= h; if (p.life <= 0) parts.splice(i, 1); }
  for (const p of parts) { O.position.set(p.x, p.y, p.z); O.rotation.set(p.r + p.life * 6, p.life * 4, 0); O.scale.setScalar(p.s * Math.min(1, p.life * 3)); O.updateMatrix(); partMesh.setMatrixAt(n, O.matrix); partMesh.setColorAt(n, p.c); n++; }
  partMesh.count = n; partMesh.instanceMatrix.needsUpdate = true; if (partMesh.instanceColor) partMesh.instanceColor.needsUpdate = true;
  for (const r of rings) if (r.t > 0) { r.t -= dt * 0.04; const s = r.r * (1.1 - r.t * 0.6); r.m.scale.set(s, s, 1); r.m.material.opacity = Math.max(0, r.t); if (r.t <= 0) r.m.visible = false; }
  for (const b of bolts) if (b.t > 0) { b.t -= dt * 0.12; b.m.material.opacity = Math.max(0, b.t); if (b.t <= 0) b.m.visible = false; }
  shieldMesh.material.opacity = lerp(shieldMesh.material.opacity, shield > 0 ? 0.1 + 0.05 * Math.sin(T * 3) : 0, 0.08); shieldMesh.visible = shield > 0.5 || shieldMesh.material.opacity > 0.02;
  // camera
  const war = phase === 'wave' || state === 'won' || state === 'lost'; zoom = lerp(zoom, war ? 1.22 : 1, Math.min(1, dt * 0.05));
  if (war) camT.set(0, 5.4, 0); else camT.set(0, clamp(mn.y, -H + 8, 0.5) - (state === 'ready' ? 1 : 0), 0);
  const cy = camera.position.y - 2, ny = lerp(cy, camT.y, Math.min(1, dt * 0.08));
  shake *= Math.pow(0.88, dt);
  camera.position.set((Math.random() - 0.5) * shake, ny + 2 + (Math.random() - 0.5) * shake, camD * zoom);
  if (phase === 'mine') { laserA *= 0.95; turretMesh.rotation.z = -laserA; } camera.lookAt(0, ny, 0);
  hudT -= dt; if (hudT <= 0) { hudT = 8; paintHud(); }
});

// ================================================================ start / cards
const startEl = ui.els.start, hint = startEl.querySelector('.hint');
const sub = $(`<p class="dh-sub">Dig for ore · hold the Haven</p>`); startEl.querySelector('h1').after(sub);
const bestP = $(`<p class="dh-sub"></p>`); sub.after(bestP);
const newBtn = $(`<button class="dh-mini">↺ New run</button>`); newBtn.addEventListener('pointerdown', e => { e.stopPropagation(); S.set('run', null); startEl.classList.add('hc-hidden'); go(null); });
function paintStart() {
  const R = !D.seed && S.get('run', null), best = S.get('best', 0);
  bestP.textContent = best ? `Best: ${best} wave${best === 1 ? '' : 's'} held` : 'Drag to fly + drill · WASD on desktop';
  hint.innerHTML = R ? `Tap to continue · wave ${R.wave + 1}` : D.seed ? 'Tap to start today\'s mine' : 'Tap to start digging';
  if (R) hint.after(newBtn); else newBtn.remove();
}
function go(R) {
  glass.visible = true; botMode = '';
  if (R) loadRun(R); else freshRun();
  B.start(); phase = 'mine'; beginMine(); paintHud();
}
ui.onTap(w => {
  if (w === 'start') { const R = !D.seed && S.get('run', null); go(R || null); return; }
  if (w === 'win') { beginMine(); botMode = ''; paintHud(); return; }
  if (w === 'lose') { S.set('run', null); go(null); }
});
genMine(1); paintGrid(); paintStart(); paintHud();
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): in the first mine phase, until the first
// touch, the mole flies down and drills toward the nearest ore by itself (the bot's own steering), then lets go of the stick
const DM = demo(null, { ready: () => state === 'play' && phase === 'mine' && wave === 0 && !D.seed && !shopOpen(), wait: 1200, ms: 4000 });
let demoOn = false;
function demoSteer() { if (DM.on) { const t = nearestOre(); if (t) steer(t[0], t[1]); demoOn = true; } else if (demoOn) { demoOn = false; joy.x = joy.y = 0; } }
camera.position.set(0, 1, camD);

// ================================================================ bot (QA)
function nearestOre() {
  const [c0, r0] = cellOf(mn.x, mn.y); let best = null, bd = 1e9;
  for (const o of loose) { const d = Math.abs(o.x - mn.x) + Math.abs(o.y - mn.y) * 0.8; if (d < bd) { bd = d; best = [Math.floor(o.x + X0 + 0.5), Math.floor(-o.y)]; } }
  for (let i = 0; i < W * H; i++) { const t = cells[i]; if (t < 4 || t > 6) continue; const c = i % W, r = Math.floor(i / W); const d = Math.abs(c - c0) + Math.abs(r - Math.max(0, r0)) * 1.1 - (t === 6 ? 3 : 0); if (d < bd) { bd = d; best = [c, r]; } }
  return best;
}
function steer(gc, gr) {
  const [c, r] = cellOf(mn.x, mn.y), cr = mn.y > 0 ? -1 : r;
  joy.x = joy.y = 0;
  if (gr > cr && c !== gc && cr < gr) { joy.y = -1; if (Math.abs(mn.x - Math.round(mn.x)) > 0.15) joy.x = Math.sign(Math.round(mn.x) - mn.x) * 0.3; return; }   // go down first
  if (c !== gc) { joy.x = Math.sign(gc - c); return; }
  joy.y = gr > cr ? -1 : gr < cr ? 1 : 0; if (!joy.y) joy.x = Math.sign(gc - X0 - mn.x) * 0.5;
}
window.__game = {
  get state() { return state; }, get level() { return wave; }, get score() { return waves; },
  _qa(g) { if (g) gs = g; return { wave, waves, hull: Math.round(hull), ore: ore.a + '/' + ore.b, lv: JSON.stringify(lv), got: Object.keys(got).join(','), mons: mons.length, phase, mineT: Math.round(mineT) }; },
  bot() {
    if (state !== 'play') return;
    if (shopOpen()) closeShop();
    if (gs < 3) { gs = 3; paintHud(); }
    if (window.__turbo) gs = window.__turbo;
    if (phase === 'mine') {
      const cap = carryCap(lvl('carry')), atHaven = mn.y > -0.6 && Math.abs(mn.x) < 0.7;
      if (atHaven && !carried.length && (trips >= (wave === 0 ? 1 : 2) || mineT < 5)) {
        for (let k = 0; k < 4; k++) { const order = ['laser', 'shield', 'laser', 'drill', 'carry', 'turn', 'pulse', 'sentry', 'jet', 'magnet']; let done = false; if (hull < 60 && repair()) done = true; for (const u of order) if (!done && buy(u)) done = true; if (!done) break; }
        if (phaseT > 2 || mineT < 5) { startWave(); return; }
      }
      if (carried.length >= cap || (carried.length && mineT < 7) || (trips === 0 && carried.length >= 2 && phaseT > 5)) steer(SHAFT, -1);
      else { const t = nearestOre(); if (t) steer(t[0], t[1]); }
      if (carried.length >= cap || (carried.length && mineT < 7) || (trips === 0 && carried.length >= 2 && phaseT > 5)) { if (mn.y > -0.6 && Math.abs(mn.x) > 0.1 && Math.abs(mn.x) < 0.7) joy.x = -Math.sign(mn.x) * 0.5; }
    } else {
      let tg = null, bd = 1e9; for (const m of mons) { if (!m.used || m.st === 'warn') continue; const d = Math.hypot(m.x, m.y) - (m.kind === 'flyer' && m.st === 'dive' ? 4 : 0); if (d < bd) { bd = d; tg = m; } }
      if (tg) laserTA = clamp(Math.atan2(tg.x - LASER_O.x, tg.y - LASER_O.y), -1.95, 1.95);
    }
  },
};
