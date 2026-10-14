// Nugget Rush — original 3-lane canyon rail runner. A moustached little prospector sprints down the mine tracks of a sunset canyon,
// swiping between rails to dodge parked ore wagons, runaway engines, barricades and low beams, grabbing gold nuggets
// while Rumble the grumpy boulder rolls after them. All code, art and sound are original.
import { THREE, createStage, createUI, store, loop, input, buzz, burst, confetti, lerp, clamp, rng, mat, glossy, rounded, stickman } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import * as A from './sound.js';

const NAME = 'Nugget Rush: Mine Cart Runner';
const LX = [-2.1, 0, 2.1], TOP = 2.25, CAR = 7.2, CGAP = 0.5, RAMP = 6.5, TIER = 500;
const GRAV = 30, JUMPV = 10.2, PADV = 16.5, ROLL_T = 0.62, MAGNET_T = 9;
const S = store('nuggetrush');
let best = S.get('best', 0);
const F = flow('nuggetrush', { par: 900, warmup: 250 });

const stage = createStage({ fov: 60, shadows: true, shadowSize: 20 });
const { scene, camera, renderer } = stage;
stage.sun.shadow.mapSize.set(1536, 1536);
stage.hemi.intensity = 1.05; stage.sun.intensity = 1.85;
const ui = createUI({ title: 'NUGGET<br>RUSH', hint: 'Swipe to dodge', hand: '👆' });
const D = daily('nuggetrush', ui, { name: NAME });
// endless game: the "win" card is our NEW BEST card (the only place a Share button appears; never after a normal run end)
ui.els.win.querySelector('p').innerHTML = 'NEW BEST<span data-l hidden></span>';
const winH = ui.els.win.querySelector('h1');

// sky moods per distance tier: [top, horizon, fog]
const SKIES = [
  ['#6cc7ff', '#ffe6c4', '#ffe2c6'], ['#ffb88c', '#ffe3c2', '#ffdcbc'], ['#ff8fb1', '#ffd9c0', '#ffd0c0'],
  ['#b49cff', '#ffd1e8', '#f4cde3'], ['#72e0d1', '#fff4cf', '#f1eccf'], ['#ff9a6b', '#ffe6a8', '#fbdcab'],
];
scene.fog = new THREE.Fog('#ffdcbc', 50, 165);

// ---------------------------------------------------------------- helpers
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
function pool(geo, material, cap, { cast = true, receive = false, colored = false } = {}) {
  const m = new THREE.InstancedMesh(geo, material, cap); m.frustumCulled = false; m.castShadow = cast; m.receiveShadow = receive; m.count = 0;
  if (colored) for (let i = 0; i < cap; i++) m.setColorAt(i, _c.set('#ffffff'));
  scene.add(m); m.n = 0;
  m.begin = () => { m.n = 0; };
  m.put = (x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, color = null, rx = 0, rz = 0) => {
    if (m.n >= cap) return; _q.setFromEuler(_e.set(rx, ry, rz)); _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
    m.setMatrixAt(m.n, _m); if (color) m.setColorAt(m.n, _c.set(color)); m.n++;
  };
  m.end = () => { m.count = m.n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; };
  return m;
}
function stripeTex(a, b, n = 4) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 32; const g = c.getContext('2d');
  g.fillStyle = a; g.fillRect(0, 0, 128, 32); g.fillStyle = b;
  for (let i = -2; i < n * 2; i++) { g.beginPath(); const x = i * 128 / n; g.moveTo(x, 32); g.lineTo(x + 16, 0); g.lineTo(x + 16 + 128 / n / 2, 0); g.lineTo(x + 128 / n / 2, 32); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ---------------------------------------------------------------- world meshes
const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 400).rotateX(-Math.PI / 2), mat('#f3c690', { roughness: 0.95 }));
ground.receiveShadow = true; scene.add(ground);
const beds = LX.map(x => { const b = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 400).rotateX(-Math.PI / 2), mat('#c99a6b', { roughness: 1 })); b.position.x = x; b.position.y = 0.01; b.receiveShadow = true; scene.add(b); return b; });
const railMat = glossy('#b7b2c4', { metalness: 0.6, roughness: 0.25 });
const rails = []; for (const x of LX) for (const o of [-0.62, 0.62]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 400), railMat); r.position.set(x + o, 0.13, 0); r.receiveShadow = true; scene.add(r); rails.push(r); }
const sleepers = pool(new THREE.BoxGeometry(1.75, 0.1, 0.36), mat('#9b6845'), 3 * 120, { cast: false, receive: true });
const rocks = pool(new THREE.BoxGeometry(1, 1, 1), mat('#ffffff', { flatShading: true, roughness: 0.9 }), 260, { colored: true, receive: true });
const cacti = pool(new THREE.CapsuleGeometry(0.28, 1.2, 4, 10), mat('#54b36d', { roughness: 0.7 }), 70, { colored: true });
const posts = pool(new THREE.BoxGeometry(0.42, 10, 0.42), mat('#8a5a3a'), 16);
const beams = pool(new THREE.BoxGeometry(9.2, 0.55, 0.6), mat('#9c6a45'), 8);
const lanterns = pool(new THREE.SphereGeometry(0.26, 12, 10), new THREE.MeshStandardMaterial({ color: '#ffe08a', emissive: '#ffb347', emissiveIntensity: 1.1 }), 48, { cast: false, colored: true });
const mesas = []; for (let i = 0; i < 7; i++) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(9 + hash(i) * 8, 13 + hash(i + 3) * 8, 14 + hash(i + 7) * 16, 7), new THREE.MeshBasicMaterial({ color: '#f6b49a', fog: false }));
  m.userData = { x: (i - 3) * 26 + (hash(i + 9) - 0.5) * 10, z: -230 - hash(i + 5) * 40 }; scene.add(m); mesas.push(m);
}
// wagons
const PAINT = ['#2ec4b6', '#ffbe3d', '#7b6cff', '#4f9dff', '#ff7eb6', '#5bd17a'];
const carBody = pool(rounded(1.9, 1.62, CAR, 0.2), mat('#ffffff', { roughness: 0.45 }), 70, { colored: true, receive: true });
const carBand = pool(new THREE.BoxGeometry(1.98, 0.22, CAR - 0.3), mat('#ffffff', { roughness: 0.4 }), 70, { colored: true });
const carBase = pool(new THREE.BoxGeometry(1.7, 0.36, CAR - 0.4), mat('#3e3550'), 70);
const carDeck = pool(new THREE.BoxGeometry(1.6, 0.06, CAR - 0.6), mat('#d8a36a'), 70, { cast: false, receive: true });
const wheels = pool(new THREE.CylinderGeometry(0.4, 0.4, 0.22, 16).rotateZ(Math.PI / 2), mat('#2c2638', { metalness: 0.4, roughness: 0.35 }), 280);
const carFace = pool(rounded(1.3, 0.8, 0.12, 0.08), mat('#3e3550'), 70);
const lampG = pool(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshBasicMaterial({ color: '#fff6c8' }), 16, { cast: false });
const halo = pool(new THREE.CircleGeometry(0.75, 24), new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }), 16, { cast: false });
const chimney = pool(new THREE.CylinderGeometry(0.28, 0.2, 0.9, 12), mat('#2c2638'), 16);
const grill = pool(new THREE.ConeGeometry(0.95, 1.1, 4, 1).rotateY(Math.PI / 4).rotateX(Math.PI / 2), mat('#ffd23f', { roughness: 0.35 }), 16);
const rampG = (() => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(RAMP, 0); s.lineTo(0, TOP); s.lineTo(0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 1.8, bevelEnabled: false }); g.translate(0, 0, -0.9); g.rotateY(-Math.PI / 2); return g; })();
const ramps = pool(rampG, mat('#d99a5b', { roughness: 0.7 }), 20, { receive: true });
const rampSlats = pool(new THREE.BoxGeometry(1.84, 0.06, 0.18), mat('#a8683c'), 20 * 7, { cast: false });
// barricades
const stripeRW = stripeTex('#ffffff', '#ff4f5e', 4), stripeYB = stripeTex('#ffd23f', '#3e3550', 4);
const lowBar = pool(rounded(1.95, 0.5, 0.24, 0.08), new THREE.MeshStandardMaterial({ map: stripeRW, roughness: 0.5 }), 40);
const lowLegs = pool(new THREE.BoxGeometry(0.14, 0.85, 0.14), mat('#ffffff'), 160);
const hiBar = pool(rounded(2.05, 0.6, 0.3, 0.1), new THREE.MeshStandardMaterial({ map: stripeYB, roughness: 0.5 }), 40);
const hiPost = pool(new THREE.BoxGeometry(0.18, 2.9, 0.18), mat('#8a5a3a'), 80);
const hiSign = pool(new THREE.BoxGeometry(0.7, 0.5, 0.06), mat('#ff4f5e'), 40, { cast: false });
const pads = pool(new THREE.CylinderGeometry(0.75, 0.85, 0.28, 24), glossy('#4dd6ff', { emissive: '#1aa7d6', emissiveIntensity: 0.35 }), 12);
const padTop = pool(new THREE.ConeGeometry(0.42, 0.5, 3).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff' }), 12, { cast: false });
const nug = pool(new THREE.IcosahedronGeometry(0.3, 0), new THREE.MeshStandardMaterial({ color: '#ffc531', emissive: '#ff9a00', emissiveIntensity: 0.38, metalness: 0.35, roughness: 0.28, flatShading: true }), 240, { cast: false });
const streaks = pool(new THREE.BoxGeometry(0.03, 0.03, 3), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false }), 40, { cast: false });
// magnet pickup (two pooled groups)
function magnetModel() {
  const g = new THREE.Group();
  const u = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.13, 10, 20, Math.PI), glossy('#ff3d5a')); u.rotation.z = Math.PI;
  for (const x of [-0.36, 0.36]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.22, 12), glossy('#e9eef5', { metalness: 0.5 })); t.position.set(x, 0.1, 0); g.add(t); }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.04, 6, 32), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 }));
  g.add(u, ring); g.ring = ring; g.visible = false; scene.add(g); return g;
}
const magnetModels = [magnetModel(), magnetModel()];

// ---------------------------------------------------------------- hero: young prospector (orange jacket, yellow hard hat, red scarf)
const hero = new THREE.Group(); scene.add(hero);
const pivot = new THREE.Group(); pivot.position.y = 0.9; hero.add(pivot);
const man = stickman('#ff7b39', '#b5764e', 1.05); man.position.y = -0.9; pivot.add(man);
const denim = mat('#3d5a99'); for (const l of [man.legL, man.legR]) l.children[0].material = denim;
const hat = new THREE.Mesh(new THREE.SphereGeometry(0.235, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), glossy('#ffd23f')); hat.position.y = 1.56; hat.castShadow = true;
const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 22), glossy('#ffbf1a')); brim.position.y = 1.57;
const hlamp = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.1, 12), new THREE.MeshBasicMaterial({ color: '#fffbd0' })); hlamp.rotation.x = Math.PI / 2; hlamp.position.set(0, 1.66, -0.22);
const pack = new THREE.Mesh(rounded(0.42, 0.46, 0.22, 0.07), mat('#7a4a2b')); pack.position.set(0, 1.0, 0.25); pack.castShadow = true;
const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.5, 12).rotateZ(Math.PI / 2), mat('#3ab795')); roll.position.set(0, 1.27, 0.27);
const pickH = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.85, 8), mat('#c98a4b')); pickH.position.set(0.12, 1.12, 0.37); pickH.rotation.z = 0.5;
const pickHead = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.07), mat('#c8ccd8', { metalness: 0.5 })); pickHead.position.set(0.3, 1.47, 0.37); pickHead.rotation.z = 0.5;
const scarfPiv = new THREE.Group(); scarfPiv.position.set(0, 1.33, 0.12);
const scarf = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.55), mat('#ff3d6e')); scarf.position.z = 0.27; scarfPiv.add(scarf);
man.add(hat, brim, hlamp, pack, roll, pickH, pickHead, scarfPiv);
for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mat('#2b2140')); e.position.set(sx * 0.075, 1.5, -0.185); man.add(e); }
const stache = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.1, 4, 8).rotateZ(Math.PI / 2), mat('#5a3420')); stache.position.set(0, 1.43, -0.19); man.add(stache);
const ringFx = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.05, 8, 40).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff3d5a', transparent: true, opacity: 0 }));
hero.add(ringFx);
const blob = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.18, depthWrite: false }));
scene.add(blob);

// ---------------------------------------------------------------- chaser: Rumble, a grumpy rolling boulder with eyebrows
const rumble = new THREE.Group(); scene.add(rumble);
const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.35, 1), mat('#9d8a86', { flatShading: true, roughness: 0.85 })); rock.castShadow = true; rumble.add(rock);
for (const sx of [-1, 1]) {
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), mat('#ffffff', { roughness: 0.3 })); eye.position.set(sx * 0.42, 0.25, -1.12); eye.scale.z = 0.6;
  const pup = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), mat('#22202c')); pup.position.set(sx * 0.4, 0.22, -1.3);
  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.13, 0.15), mat('#4b3f3d')); brow.position.set(sx * 0.42, 0.62, -1.22); brow.rotation.z = sx * 0.45;
  rumble.add(eye, pup, brow);
}

// ---------------------------------------------------------------- state
let state = 'ready', R, dist = 0, score = 0, nuggets = 0, speed = 15, tier = 1, clock = 0, runT = 0;
let lane = 1, px = 0, py = 0, vy = 0, onGround = true, rollT = 0, magnetT = 0, stumbleT = 0, chaseGap = 4.5, shake = 0, lean = 0, landSq = 0;
let trains = [], bars = [], padsL = [], coins = [], powers = [], genZ = 0, busyEnd = [0, 0, 0], beatenShown = false, recorded = false;
let combo = 0, comboT = 0, sky = 0, deadT = 0, fovKick = 0, dustT = 0;
let introK = 1, camY = 5.3, camX = 0, lastDeath = '', jumpBuf = 0;
const pz = () => -dist;

function setSky(i) {
  const s = SKIES[i % SKIES.length], b = document.body.style;
  b.setProperty('--bg1', s[0]); b.setProperty('--bg2', s[1]); b.setProperty('--ui', '#ff7b39');
  scene.fog.color.set(s[2]);
  for (const m of mesas) m.material.color.set(s[2]).lerp(_c.set('#e98b6b'), 0.35);
}

// ---------------------------------------------------------------- generation (seeded, endless)
function laneFreeAt(l, z) { return z < busyEnd[l] - 4; }
function busyCount(z) { let n = 0; for (let l = 0; l < 3; l++) if (!laneFreeAt(l, z)) n++; return n; }
function addCoinLine(l, z, n, y = 0.75) { for (let i = 0; i < n; i++) coins.push({ l, x: LX[l], y, z: z - i * 2.3, got: false, t: 0 }); }
function addArc(l, z, n, h, len) { for (let i = 0; i < n; i++) { const f = i / (n - 1); coins.push({ l, x: LX[l], y: 0.75 + Math.sin(f * Math.PI) * h, z: z - f * len, got: false, t: 0 }); } }
function addTrain(l, zBack, cars, { ramp = false, moving = false } = {}) {
  const len = cars * CAR + (cars - 1) * CGAP;
  const t = { l, z0: zBack - len, z1: zBack, cars, ramp, moving, v: moving ? 9 + R() * 4 : 0, go: false, color: moving ? '#ff4f5e' : PAINT[Math.floor(R() * PAINT.length)], travel: 0, honked: false };
  trains.push(t); busyEnd[l] = Math.min(busyEnd[l], t.z0 - (ramp ? 0 : 0)); return t;
}
function genRow() {
  const fk = F.k(score);
  const gap = clamp(24 - dist / 160, 14, 24) / fk + R() * 6;
  genZ -= gap;
  const z = genZ, free = [0, 1, 2].filter(l => laneFreeAt(l, z) && laneFreeAt(l, z - 2));
  if (!free.length) return;
  const r = R(), movingP = clamp(0.08 + dist / 6000, 0.08, 0.3) * fk;
  if (r < 0.46 && busyCount(z) < 2 && free.length >= 1) {
    // parked train(s)
    const l = free[Math.floor(R() * free.length)], cars = 1 + Math.floor(R() * (dist > 600 ? 3 : 2)), ramp = R() < 0.5;
    const t = addTrain(l, z, cars, { ramp });
    if (ramp) { addCoinLine(l, z + RAMP - 1, 3, 0.75 + 0.0); for (let i = 0; i < Math.floor((t.z1 - t.z0) / 2.4); i++) coins.push({ l, x: LX[l], y: TOP + 0.75, z: t.z0 + 1.2 + i * 2.4, got: false, t: 0 }); }
    const others = free.filter(o => o !== l);
    if (others.length && busyCount(z) < 2 && R() < 0.45) { const l2 = others[Math.floor(R() * others.length)]; addTrain(l2, z - R() * 6, 1 + Math.floor(R() * 2), { ramp: R() < 0.35 }); }
    // the remaining open lane sometimes gets a barricade further along the train
    const open = [0, 1, 2].filter(o => laneFreeAt(o, z - 3));
    if (open.length === 1 && R() < 0.5) bars.push({ l: open[0], z: z - 5 - R() * 4, type: R() < 0.5 ? 'low' : 'high' });
    else if (open.length) addCoinLine(open[Math.floor(R() * open.length)], z, 5);
  } else if (r < 0.46 + movingP && busyCount(z) < 2) {
    // runaway engine: placed further on, its lane kept clear on the way in
    const l = free[Math.floor(R() * free.length)], travel = 26 + R() * 10;
    const t = addTrain(l, z - travel, 1 + Math.floor(R() * 2), { moving: true }); t.travel = travel; busyEnd[l] = Math.min(busyEnd[l], t.z0);
    const others = free.filter(o => o !== l); if (others.length) addCoinLine(others[Math.floor(R() * others.length)], z, 6);
  } else if (r < 0.58 + movingP) {
    // jump pad in front of a parked train: launch onto the roofs
    if (free.length && busyCount(z) < 2) {
      const l = free[Math.floor(R() * free.length)]; padsL.push({ l, z, used: false });
      addTrain(l, z - 9, 2 + Math.floor(R() * 2), { ramp: false });
      addArc(l, z - 0.5, 7, 3.8, 9);
      for (let i = 0; i < 6; i++) coins.push({ l, x: LX[l], y: TOP + 0.75, z: z - 11 - i * 2.4, got: false, t: 0 });
    }
  } else {
    // barricade row: 1–3 lanes, at least one never needs a move
    const n = R() < 0.55 ? 1 : R() < 0.75 ? 2 : 3, ls = free.slice().sort(() => R() - 0.5).slice(0, n);
    for (const l of ls) {
      const type = R() < 0.55 ? 'low' : 'high'; bars.push({ l, z, type });
      if (type === 'low' && R() < 0.6) addArc(l, z + 3.2, 5, 1.7, 6.4);
    }
    const rest = free.filter(l => !ls.includes(l)); if (rest.length && R() < 0.7) addCoinLine(rest[0], z + 2, 5);
    if (R() < 0.07 && magnetT <= 0 && !powers.length) { const l = rest.length ? rest[0] : ls[0]; powers.push({ l, z: z - 8, y: 1.1, got: false }); }
  }
}
function extend() { while (genZ > pz() - 190) genRow(); }

// ---------------------------------------------------------------- physics queries
function groundAt(l, z) {
  let h = 0;
  for (const t of trains) {
    if (t.l !== l) continue;
    if (z >= t.z0 && z <= t.z1) h = Math.max(h, TOP);
    else if (t.ramp && z > t.z1 && z <= t.z1 + RAMP) h = Math.max(h, TOP * (1 - (z - t.z1) / RAMP));
  }
  return h;
}
const laneOf = (x) => clamp(Math.round(x / 2.1) + 1, 0, 2);

// ---------------------------------------------------------------- run lifecycle
function reset() {
  R = rng((D.seed || (Date.now() % 1e6)) + 17);
  trains = []; bars = []; padsL = []; coins = []; powers = []; busyEnd = [0, 0, 0]; genZ = -26;
  dist = 0; score = 0; nuggets = 0; tier = 1; speed = 15 * F.k(0); lane = 1; px = 0; py = 0; vy = 0; onGround = true; rollT = 0; magnetT = 0; stumbleT = 0;
  chaseGap = 4.5; shake = 0; lean = 0; combo = 0; deadT = 0; beatenShown = false; recorded = false; runT = 0; update.lastM = 0; jumpBuf = 0;
  addCoinLine(1, -8, 6);
  extend(); sky = 0; setSky(0);
  man.rotation.set(0, 0, 0); pivot.rotation.set(0, 0, 0); hero.rotation.set(0, 0, 0);
  ui.score(0); ui.levels(1); ui.progress(0); ui.sub(best ? 'BEST ' + best : ''); ui.pill('💰 0');
  ui.els.sc.classList.remove('hc-hidden');
}
function addScore(n) {
  score += n; ui.score(score);
  if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 44, 30); confetti(scene, new THREE.Vector3(px, py + 2.5, pz() - 3), 60); A.osc(880, 0.3, 'triangle', 0.12, 1.5); }
}
function gameOver(how) {
  if (state !== 'play') return;
  state = 'lost'; deadT = 0; A.stopMusic(0.3); lastDeath = how;
  if (!recorded) { recorded = true; F.endless(score); }
  const prev = best; best = Math.max(best, score); S.set('best', best);
  shake = 1; ui.flash(0.75); buzz([40, 30, 80]);
  A.osc(120, 0.35, 'square', 0.16, 0.4); A.hiss(0.5, 1200, 200, 0.3, 'lowpass'); setTimeout(() => A.osc(70, 0.5, 'sine', 0.3, 0.5), 120);
  burst(scene, new THREE.Vector3(px, py + 1, pz() - 0.5), ['#ffd23f', '#ffffff', '#ff7b39', '#c99a6b'], 26, { speed: 0.16, up: 0.15, size: 0.9 });
  vy = 6; lean = 0;
  if (score > prev && score >= 50) {
    D.won(score, 'ran'); winH.textContent = String(score);
    confetti(scene, new THREE.Vector3(px, py + 2, pz() - 2), 70);
    ui.win(tier, `${how} · 💰 ${nuggets} nuggets`);
  } else ui.lose(String(score), `${how} · BEST ${best} · 💰 ${nuggets}`);
  setTimeout(() => (state === 'lost') && ui.els.sc.classList.add('hc-hidden'), 650);
}
function stumble() {
  shake = Math.max(shake, 0.5); buzz([25, 20, 25]); A.osc(140, 0.16, 'square', 0.12, 0.6); A.hiss(0.2, 600, 200, 0.18, 'lowpass');
  if (stumbleT > 0) { gameOver('Rumble got you!'); return; }
  stumbleT = 6; ui.pop('WHOA!', '#ff4f5e', 36, 30);
}

// ---------------------------------------------------------------- input (swipe fires mid-drag, like the real thing) + keys
function act(d) {
  if (state !== 'play') return;
  if (d === 'left' || d === 'right') {
    const to = lane + (d === 'left' ? -1 : 1); if (to < 0 || to > 2) { shake = Math.max(shake, 0.15); A.osc(180, 0.06, 'square', 0.06, 0.7); return; }
    const h = Math.max(groundAt(to, pz()), groundAt(to, pz() - 0.6));
    if (h > py + 0.5) { lean = (d === 'left' ? -1 : 1) * 0.6; stumble(); return; }        // side-bump into a wagon
    lane = to; lean = (d === 'left' ? 1 : -1) * 0.35; A.hiss(0.14, 900, 2600, 0.09); buzz(5);
  } else if (d === 'up') {
    if (!onGround) { jumpBuf = 0.18; return; }
    if (onGround) { jumpBuf = 0; vy = JUMPV; onGround = false; rollT = 0; A.osc(330, 0.16, 'triangle', 0.13, 2.1); A.hiss(0.15, 1200, 3500, 0.05); buzz(8); }
  } else if (d === 'down') {
    if (!onGround) vy = Math.min(vy, -20);
    rollT = ROLL_T; A.hiss(0.22, 2500, 500, 0.1); buzz(6);
  }
}
input({ onMove: (dx, dy, e, st) => { if (st.fired) return; const tx = e.clientX - st.x, ty = e.clientY - st.y; if (Math.hypot(tx, ty) > 26) { st.fired = true; act(Math.abs(tx) > Math.abs(ty) ? (tx > 0 ? 'right' : 'left') : (ty > 0 ? 'down' : 'up')); } } });
addEventListener('keydown', e => { const k = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down', ' ': 'up' }[e.key]; if (k) { e.preventDefault(); act(k); } });
ui.onTap(which => { reset(); state = 'play'; A.ac(); startSong(); });

// original loop: boom-chick canyon swing in D minor (bass + hats + pluck riff)
const BASS = [38, 45, 38, 45, 41, 48, 41, 48, 34, 41, 34, 41, 36, 43, 40, 43];
const RIFF = [74, 0, 77, 74, 0, 72, 69, 0, 72, 0, 74, 77, 79, 0, 77, 74, 70, 0, 74, 77, 0, 74, 72, 0, 72, 0, 76, 79, 81, 79, 76, 72];
function startSong() {
  A.startMusic({ bpm: 132, steps: 32, play(s, t, a) {
    if (s % 4 === 0) a.kick(t); if (s % 4 === 2) a.snare(t, 0.07); a.hat(t, s % 2 ? 0.05 : 0.025);
    if (s % 2 === 0) a.note(BASS[(s >> 1) % 16], 0.22, 'triangle', 0.22, t);
    const m = RIFF[s]; if (m && s >= 0) a.note(m, 0.14, 'square', 0.035, t);
  } });
}

// ---------------------------------------------------------------- per-frame
function update(sec) {
  runT += sec;
  const fk = F.k(score);
  speed = Math.min(31, (15 + Math.min(dist / 110, 13)) * fk);
  if (stumbleT > 0) { stumbleT -= sec; }
  dist += speed * sec;
  const z = pz();
  // lateral
  const tx = LX[lane]; px += (tx - px) * Math.min(1, sec * 15);
  const cl = laneOf(px);
  // vertical
  const g = Math.max(groundAt(cl, z), groundAt(cl, z - 0.3));
  if (g > py + 0.55) { gameOver('Crashed into a wagon'); return; }
  vy -= GRAV * sec * (vy < 0 ? 1.15 : 1); py += vy * sec;
  if (py <= g) { if (!onGround && vy < -6) { landSq = 1; shake = Math.max(shake, 0.12); A.osc(110, 0.1, 'sine', 0.2, 0.6); burst(scene, new THREE.Vector3(px, g + 0.1, z), '#e8c39a', 6, { speed: 0.06, up: 0.04, size: 0.6 }); } py = g; vy = 0; onGround = true; }
  else onGround = py - g < 0.02;
  if (rollT > 0) rollT -= sec;
  if (jumpBuf > 0) { jumpBuf -= sec; if (onGround) act('up'); }
  // pads
  for (const p of padsL) if (!p.used && p.l === cl && Math.abs(p.z - z) < 0.9 && py < 0.4) {
    p.used = true; vy = PADV; onGround = false; rollT = 0; fovKick = 1; ui.pop('BOING!', '#4dd6ff', 38, 30); A.osc(220, 0.35, 'sine', 0.2, 3); A.osc(440, 0.25, 'triangle', 0.08, 2.5); buzz(15);
    burst(scene, new THREE.Vector3(px, 0.4, z), ['#4dd6ff', '#ffffff'], 14, { speed: 0.1, up: 0.12, size: 0.6 });
  }
  // barricades
  const hTop = py + (rollT > 0 ? 0.75 : 1.7);
  for (const b of bars) {
    if (b.l !== cl || b.hit) continue;
    const dz = Math.abs(b.z - z); if (dz > 0.35) continue;
    if (b.type === 'low' && py < 0.95) { b.hit = true; gameOver('Tripped on a barricade'); return; }
    if (b.type === 'high' && hTop > 1.15 && py < 2.6) { b.hit = true; gameOver('Bonked a low beam'); return; }
  }
  // wagons: start runaways, honk
  for (const t of trains) {
    if (t.moving && !t.go) { const gapZ = z - t.z1; if (gapZ <= t.travel * (speed + t.v) / t.v) t.go = true; }
    if (t.go) { t.z0 += t.v * sec; t.z1 += t.v * sec; if (!t.honked && z - t.z1 < 55) { t.honked = true; A.osc(330, 0.45, 'sawtooth', 0.05, 0.98); A.osc(415, 0.45, 'sawtooth', 0.04, 0.98); } }
  }
  // coins
  for (const c of coins) {
    if (c.got) { c.t += sec * 4; continue; }
    const dz = c.z - z;
    if (magnetT > 0 && dz < 2 && dz > -18) { c.x = lerp(c.x, px, Math.min(1, sec * 9)); c.y = lerp(c.y, py + 1, Math.min(1, sec * 9)); c.z = lerp(c.z, z, Math.min(1, sec * (dz < -9 ? 3 : 10))); }
    if (Math.abs(c.z - z) < 0.9 && Math.abs(c.x - px) < 0.9 && c.y > py - 0.2 && c.y < py + 2.1) {
      c.got = true; c.t = 0; nuggets++; combo = comboT > 0 ? combo + 1 : 0; comboT = 0.45; addScore(5); ui.pill('💰 ' + nuggets);
      A.osc(988 * Math.pow(2, Math.min(combo, 12) / 12), 0.06, 'square', 0.045); A.osc(1318 * Math.pow(2, Math.min(combo, 12) / 12), 0.1, 'square', 0.04, 1, A.ac().currentTime + 0.05);
      if (combo && combo % 10 === 0) ui.pop('x' + combo + ' NUGGETS!', '#ffd23f', 30, 34);
    }
  }
  comboT -= sec;
  for (const p of powers) if (!p.got && Math.abs(p.z - z) < 1 && Math.abs(LX[p.l] - px) < 1 && py < 2.2) {
    p.got = true; magnetT = MAGNET_T; ui.pop('MAGNET!', '#ff3d5a', 40, 30); A.osc(440, 0.4, 'sine', 0.15, 2); A.osc(660, 0.3, 'triangle', 0.08, 1.5); buzz([10, 20, 10]);
    burst(scene, new THREE.Vector3(px, py + 1, z), ['#ff3d5a', '#ffffff'], 18, { speed: 0.1, up: 0.1, size: 0.6 });
  }
  if (magnetT > 0) magnetT -= sec;
  // distance scoring + tiers
  const m = Math.floor(dist); if (m > (update.lastM || 0)) { addScore(m - (update.lastM || 0)); update.lastM = m; }
  const nt = Math.floor(dist / TIER) + 1;
  if (nt > tier) { tier = nt; ui.levels(tier); sky++; setSky(sky); ui.pop(`${(tier - 1) * TIER} m!`, '#fff', 44, 28); confetti(scene, new THREE.Vector3(px, py + 3, z - 6), 50); [0, 4, 7, 12].forEach((s, i) => setTimeout(() => A.osc(523 * Math.pow(2, s / 12), 0.2, 'triangle', 0.1), i * 90)); }
  ui.progress((dist % TIER) / TIER);
  // chaser distance
  chaseGap = lerp(chaseGap, stumbleT > 0 ? 3.6 : runT < 2.5 ? 4.6 : 16, Math.min(1, sec * (stumbleT > 0 ? 3 : 0.6)));
  // recycle
  const behind = z + 25;
  trains = trains.filter(t => t.z0 < behind + 10); bars = bars.filter(b => b.z < behind); padsL = padsL.filter(p => p.z < behind);
  coins = coins.filter(c => c.z < behind && !(c.got && c.t > 1)); powers = powers.filter(p => p.z < behind && !p.got);
  extend();
  // dust from the boots
  dustT -= sec; if (onGround && dustT <= 0 && rollT <= 0) { dustT = 0.09; burst(scene, new THREE.Vector3(px + (Math.random() - 0.5) * 0.3, py + 0.08, z + 0.3), '#efcfa6', 1, { speed: 0.02, up: 0.025, size: 0.55, gravity: 0.001 }); }
}
update.lastM = 0;

// ---------------------------------------------------------------- render
function draw(t, sec) {
  const z = state === 'ready' ? 0 : pz();
  // hero pose
  hero.position.set(px, py, z);
  lean = lerp(lean, 0, Math.min(1, sec * 6));
  hero.rotation.z = lean * 0.6; hero.rotation.y = lean * 0.5;
  landSq = Math.max(0, landSq - sec * 5);
  if (state === 'lost') {
    deadT += sec; pivot.rotation.x = lerp(pivot.rotation.x, 1.35, Math.min(1, sec * 8)); man.run(0, 0);
    if (py > 0) { vy -= GRAV * sec; py = Math.max(groundAt(laneOf(px), z), py + vy * sec); }
  } else if (rollT > 0) {
    const f = 1 - rollT / ROLL_T; pivot.rotation.x = -f * Math.PI * 2; pivot.position.y = 0.55; pivot.scale.setScalar(0.78);
    man.armL.rotation.x = man.armR.rotation.x = -2.2; man.legL.rotation.x = man.legR.rotation.x = -1.6;
  } else {
    pivot.rotation.x = 0; pivot.position.y = 0.9; pivot.scale.set(1 + landSq * 0.15, 1 - landSq * 0.2, 1 + landSq * 0.15);
    if (onGround || state !== 'play') man.run(state === 'play' ? t * speed / 13 : t * 0.25, state === 'play' ? 1 : 0.15);
    else { man.armL.rotation.x = man.armR.rotation.x = -2.6 + Math.sin(t * 10) * 0.2; man.legL.rotation.x = -1.0; man.legR.rotation.x = 0.4; pivot.rotation.x = vy > 0 ? -0.15 : 0.1; }
  }
  scarfPiv.rotation.x = -0.2 + Math.sin(t * 22) * 0.18 - (state === 'play' ? speed * 0.012 : 0); scarfPiv.rotation.y = Math.sin(t * 13) * 0.25;
  ringFx.material.opacity = magnetT > 0 ? 0.45 + Math.sin(t * 12) * 0.25 : 0; ringFx.position.y = 0.2 + (t * 1.5 % 1) * 1.6; ringFx.scale.setScalar(1 + Math.sin(t * 6) * 0.08);
  const gnd = groundAt(laneOf(px), z); blob.position.set(px, gnd + 0.02, z); blob.scale.setScalar(clamp(1 - (py - gnd) * 0.15, 0.4, 1));
  // chaser
  const rz = z + (state === 'ready' ? 4.6 : state === 'lost' ? lerp(chaseGap, 3.3, Math.min(1, deadT * 2)) : chaseGap);
  rumble.position.set(lerp(rumble.position.x, px, Math.min(1, sec * 3)), 1.35 + Math.abs(Math.sin(t * 9)) * 0.12, rz);
  rock.rotation.x -= (state === 'play' ? speed : 3) * sec / 1.35; rumble.rotation.z = Math.sin(t * 7) * 0.06;
  rumble.visible = rz - z < 12;
  if (rumble.visible && state === 'play' && Math.random() < 0.35) burst(scene, new THREE.Vector3(rumble.position.x + (Math.random() - 0.5) * 2, 0.2, rz + 1), ['#e8c39a', '#d6ab80'], 1, { speed: 0.05, up: 0.06, size: 1.1, gravity: 0.002 });
  // ground & track recycle around the player
  ground.position.z = z - 120; for (const b of beds) b.position.z = z - 120; for (const r of rails) r.position.z = z - 120;
  sleepers.begin(); const sz0 = Math.floor(z / 1.5) * 1.5;
  for (let i = -6; i < 110; i++) for (const x of LX) sleepers.put(x, 0.05, sz0 - i * 1.5);
  sleepers.end();
  // canyon walls (stratified mesas), cacti, gates — deterministic by slot so they stay put
  rocks.begin(); cacti.begin(); posts.begin(); beams.begin(); lanterns.begin();
  const COLS = ['#f08a5d', '#f6a06b', '#e47450', '#f7b47e', '#e9925f'];
  const k0 = Math.floor(-z / 7) - 3;
  for (let k = k0; k < k0 + 30; k++) {
    const wz = -k * 7;
    for (const sd of [-1, 1]) {
      const h = hash(k * 2 + (sd > 0 ? 1 : 0)), w = 4 + h * 4, hh = 4 + hash(k * 3.1 + sd) * 12;
      const x = sd * (7.6 + w / 2 + hash(k + sd * 9) * 2);
      rocks.put(x, hh / 2, wz, 0, w, hh, 7.2, COLS[Math.floor(h * 5)]);
      rocks.put(x + sd * 1.2, hh + 1.2, wz + 0.6, 0, w * 0.75, 2.4, 5.6, COLS[Math.floor(hash(k + 5) * 5)]);
      if (h > 0.45) rocks.put(x + sd * 2, hh + 3.2, wz, 0.2, w * 0.45, 1.8, 3.8, COLS[(Math.floor(h * 5) + 2) % 5]);
      if (hash(k * 7 + sd) > 0.55) { const cx = sd * (4.4 + hash(k + 33) * 1.6), ch = 0.8 + hash(k + 44); cacti.put(cx, ch, wz + 2, 0, 1, ch, 1, '#54b36d'); cacti.put(cx + 0.45, ch + 0.25, wz + 2, 0, 0.55, 0.45, 0.55, '#5fc278', 0, -0.9); }
    }
    if (k % 9 === 0 && k > 2) {
      posts.put(-4.4, 5, wz, 0); posts.put(4.4, 5, wz, 0); beams.put(0, 9.8, wz, 0);
      for (let j = 0; j < 6; j++) lanterns.put(-3.4 + j * 1.36, 9.0 - Math.sin(j / 5 * Math.PI) * 0.5, wz, 0, 1, 1, 1, ['#ffe08a', '#ff9bb3', '#9be7ff'][j % 3]);
    }
  }
  rocks.end(); cacti.end(); posts.end(); beams.end(); lanterns.end();
  for (const m of mesas) m.position.set(m.userData.x, 4, z + m.userData.z);
  // wagons
  for (const p of [carBody, carBand, carBase, carDeck, wheels, carFace, lampG, halo, chimney, grill, ramps, rampSlats]) p.begin();
  for (const tr of trains) {
    if (tr.z0 > z + 12 || tr.z1 < z - 180) continue;
    const x = LX[tr.l];
    for (let c = 0; c < tr.cars; c++) {
      const cz = tr.z0 + c * (CAR + CGAP) + CAR / 2, bob = tr.go ? Math.sin(t * 20 + c) * 0.03 : 0;
      carBody.put(x, 1.3 + bob, cz, 0, 1, 1, 1, tr.color); carBand.put(x, 1.55 + bob, cz, 0, 1, 1, 1, '#ffffff');
      carBase.put(x, 0.5, cz); carDeck.put(x, TOP - 0.06 + bob, cz);
      for (const wz of [-CAR / 2 + 1.2, CAR / 2 - 1.2]) for (const wx of [-0.82, 0.82]) wheels.put(x + wx, 0.42, cz + wz, 0, 1, 1, 1, null, tr.go ? -t * 20 : 0);
      if (c === tr.cars - 1) {
        const fz = cz + CAR / 2 + 0.02;
        if (tr.moving) {
          carFace.put(x, 1.2 + bob, fz, 0, 1.1, 1.25, 1); lampG.put(x, 1.62 + bob, fz + 0.14); halo.put(x, 1.62 + bob, fz + 0.32, 0, 1 + Math.sin(t * 14) * 0.15, 1 + Math.sin(t * 14) * 0.15, 1);
          chimney.put(x + 0.5, TOP + 0.4, fz - 1.2); grill.put(x, 0.42, fz + 0.5, 0, 1, 0.5, 0.9);
          if (tr.go && Math.random() < 0.25) burst(scene, new THREE.Vector3(x + 0.5, TOP + 1, fz - 1.2), ['#ffffff', '#e8e4f0'], 1, { speed: 0.02, up: 0.05, size: 2.2, gravity: -0.001, shape: 'sphere' });
        } else carFace.put(x, 1.35, fz, 0, 1, 1, 1);
      }
    }
    if (tr.ramp) { ramps.put(x, 0, tr.z1); for (let j = 0; j < 6; j++) { const f = (j + 0.5) / 6; rampSlats.put(x, TOP * (1 - f) + 0.02, tr.z1 + f * RAMP, 0, 1, 1, 1, null, Math.atan2(TOP, RAMP)); } }
  }
  for (const p of [carBody, carBand, carBase, carDeck, wheels, carFace, lampG, halo, chimney, grill, ramps, rampSlats]) p.end();
  // barricades, pads
  lowBar.begin(); lowLegs.begin(); hiBar.begin(); hiPost.begin(); hiSign.begin(); pads.begin(); padTop.begin();
  for (const b of bars) {
    const x = LX[b.l];
    if (b.type === 'low') { lowBar.put(x, 0.72, b.z); for (const o of [-0.75, 0.75]) { lowLegs.put(x + o, 0.42, b.z - 0.15, 0, 1, 1, 1, null, 0.3); lowLegs.put(x + o, 0.42, b.z + 0.15, 0, 1, 1, 1, null, -0.3); } }
    else { hiBar.put(x, 1.55, b.z); hiPost.put(x - 0.98, 1.45, b.z); hiPost.put(x + 0.98, 1.45, b.z); hiSign.put(x, 1.0, b.z + 0.05, 0, 1, 1, 1, null, 0, Math.sin(t * 3 + b.z) * 0.15); }
  }
  for (const p of padsL) { const s = p.used ? 1 + Math.max(0, 0.3 - (pz() - p.z) * -0.02) : 1 + Math.sin(t * 8) * 0.05; pads.put(LX[p.l], 0.18, p.z, 0, s, 1, s); padTop.put(LX[p.l], 0.4 + Math.sin(t * 8) * 0.06, p.z, 0); }
  lowBar.end(); lowLegs.end(); hiBar.end(); hiPost.end(); hiSign.end(); pads.end(); padTop.end();
  // nuggets
  nug.begin();
  for (const c of coins) {
    if (c.z > z + 4 || c.z < z - 150) continue;
    if (c.got) { const f = c.t; nug.put(lerp(c.x, px, f), c.y + f * 1.5, lerp(c.z, z, f), t * 9, Math.max(0.01, 1 - f), Math.max(0.01, 1 - f), Math.max(0.01, 1 - f)); continue; }
    nug.put(c.x, c.y + Math.sin(t * 4 + c.z) * 0.08, c.z, t * 3 + c.z, 1, 1.1, 1, null, 0.3);
  }
  nug.end();
  magnetModels.forEach((g, i) => { const p = powers[i]; g.visible = !!p; if (p) { g.position.set(LX[p.l], p.y + Math.sin(t * 4) * 0.12, p.z); g.rotation.y = t * 2.5; g.ring.rotation.x = Math.PI / 2; g.ring.scale.setScalar(1 + Math.sin(t * 8) * 0.1); } });
  // speed streaks
  streaks.begin();
  const sp = state === 'play' ? speed : 0, show = clamp((sp - 17) / 10, 0, 1) + fovKick * 0.8;
  if (show > 0.02) for (let i = 0; i < 26; i++) {
    const a = hash(i) * Math.PI * 2, r = 2.6 + hash(i + 50) * 3.5, phase = ((t * sp * 0.9 + hash(i + 80) * 40) % 40);
    streaks.put(px + Math.cos(a) * r * 1.3, py + 2.4 + Math.sin(a) * r * 0.9, z - 30 + phase + 4, 0, 1, 1, 0.5 + show);
  }
  streaks.end(); streaks.material.opacity = 0.35 * Math.min(1, show);
  // camera: low, behind, slight lag; FOV kicks with speed + pads; shake on hits
  fovKick = Math.max(0, fovKick - sec * 1.2);
  camX = lerp(camX, px * 0.75, Math.min(1, sec * 7)); camY = lerp(camY, 5.3 + py * 0.75, Math.min(1, sec * (py > camY - 4 ? 5 : 3)));
  shake = Math.max(0, shake - sec * 2.2);
  const shx = (Math.random() - 0.5) * shake * 0.6, shy = (Math.random() - 0.5) * shake * 0.6;
  introK = state === 'ready' ? 1 : Math.max(0, introK - sec * 2); const e = introK * introK * (3 - 2 * introK);
  const ia = 0.5 + Math.sin(t * 0.4) * 0.12;
  camera.position.set(lerp(camX + shx, px + Math.sin(ia) * 5.6, e), lerp(camY + shy + (state === 'lost' ? Math.min(1, deadT * 2) * 2.2 : 0), 2.3, e), lerp(z + 8.4 + (state === 'lost' ? Math.min(1, deadT * 2) * 1.5 : 0), z - Math.cos(ia) * 5.6, e));
  _p.set(lerp(camX * 0.9, px - 0.4, e), lerp(camY - 4.3 - (state === 'lost' ? Math.min(1, deadT * 2) * 0.8 : 0), 1.75, e), lerp(z - 10, z + 1.6, e)); camera.lookAt(_p);
  const fovT = (camera.aspect < 0.7 ? 67 : 60) + (state === 'play' ? (speed - 15) * 0.45 : 0) + fovKick * 7;
  camera.fov = lerp(camera.fov, fovT, Math.min(1, sec * 4)); camera.updateProjectionMatrix();
  stage.followLight(_p.set(px, 0, z - 8));
}

loop((dt, t) => {
  const sec = dt / 60; clock += sec;
  if (state === 'play') update(sec);
  draw(t, sec);
});

reset(); state = 'ready'; ui.els.sc.classList.add('hc-hidden'); ui.pill(''); ui.start();
if (D.isDaily) ui.sub('DAILY RUN');

// ---------------------------------------------------------------- test hook + bot
function laneThreat(l, z, onTopOf) {
  // seconds until something in lane l would stop us (wagon face we can't get onto); Infinity if clear
  let tmin = Infinity;
  for (const t of trains) {
    if (t.l !== l || t.z0 > z + 0.5) continue;
    const ahead = z - t.z1;
    if (t.moving) { const rel = speed + (t.go ? t.v : 0); if (ahead > -0.5 && py < TOP - 0.2) tmin = Math.min(tmin, Math.max(0, ahead) / rel); continue; }
    if (t.z1 >= z - 0.5 && t.z0 <= z + 0.5) { if (py < TOP - 0.4) tmin = 0; continue; }   // alongside it right now
    if (t.ramp || py >= TOP - 0.2) continue;
    if (onGround && padsL.some(p => p.l === l && !p.used && p.z > t.z1 && p.z < t.z1 + 12 && p.z < z + 0.5)) continue;   // a pad will launch us onto it
    if (ahead > -0.5) tmin = Math.min(tmin, Math.max(0, ahead) / speed);
  }
  return tmin;
}
function canEnter(l) { return l >= 0 && l <= 2 && Math.max(groundAt(l, pz()), groundAt(l, pz() - 1)) <= py + 0.5; }
window.__game = {
  get state() { return state; }, get level() { return tier; }, get score() { return score; }, get why() { return lastDeath; },
  bot() {
    if (state !== 'play') return;
    const z = pz(), cl = lane, here = laneThreat(cl, z);
    const barIn = (l, within) => bars.filter(b => b.l === l && b.z < z + 0.2 && (z - b.z) / speed < within).sort((a, b) => b.z - a.z)[0];
    if (here < 1.15) {
      const opts = [cl - 1, cl + 1].filter(canEnter).sort((a, b) => laneThreat(b, z) - laneThreat(a, z));
      if (opts.length && laneThreat(opts[0], z) > here + 0.2) { act(opts[0] < cl ? 'left' : 'right'); return; }
    }
    const b = barIn(cl, 0.42);
    if (b) {
      if (b.type === 'low' && onGround && (z - b.z) / speed < 0.34) { act('up'); return; }
      if (b.type === 'high' && rollT < 0.25 && (z - b.z) / speed < 0.34) { act('down'); return; }
      return;
    }
    // drift toward nuggets / magnets when it's safe
    if (here > 2.2 && Math.abs(px - LX[cl]) < 0.2) {
      const want = (l) => coins.filter(c => !c.got && c.l === l && c.z < z - 2 && c.z > z - speed * 1.2 && Math.abs(c.y - (groundAt(l, c.z) + 0.75)) < 1).length + powers.filter(p => p.l === l && p.z < z && p.z > z - 25).length * 5;
      for (const l of [cl - 1, cl + 1]) if (canEnter(l) && laneThreat(l, z) > 2.2 && !barIn(l, 0.6) && want(l) > want(cl) + 1) { act(l < cl ? 'left' : 'right'); return; }
    }
  },
};
