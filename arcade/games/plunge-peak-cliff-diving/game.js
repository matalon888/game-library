// Plunge Peak — original cliff diving game. Press to leap, hold to tuck and spin, let go to open up and
// enter the water in a straight line. Three dives per level from ever higher ledges.
import { THREE, createStage, createUI, input, loop, store, mat, glossy, rounded, burst, confetti, sfx, tone, buzz, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';

const NAME = 'Plunge Peak: Cliff Diving';
const S = store('plungepeak');
const F = flow('plungepeak');
let level = S.get('level', 1), best = S.get('best', 0);

const stage = createStage({ fov: 44, shadowSize: 14 });
const { scene, camera, sun } = stage;
const ui = createUI({ title: 'PLUNGE<br>PEAK', hint: 'Hold to flip · let go to straighten', hand: '👆' });
const D = daily('plungepeak', ui, { name: NAME });
const B = board({ game: 'plunge-peak', label: 'Levels cleared', limits: { maxRun: 1, maxPerSec: 0.2 }, mode: 'sum' });
const meterEl = document.getElementById('meter');
const TAU = Math.PI * 2;

const THEMES = [
  { bg: ['#7cc8ff', '#ffe7c2'], ui: '#ff6b4a', rock: ['#d9a46c', '#c98f58', '#e8b880'], grass: '#7bd06a', water: '#1fc3d6', deep: '#118fb8', trunks: '#ff4f6d', cap: '#ffd23f' },
  { bg: ['#8fb8ff', '#ffd6e8'], ui: '#7b5cff', rock: ['#c7a7e0', '#b08fd0', '#dcc4f0'], grass: '#8ee0a5', water: '#3fd0e0', deep: '#2196c8', trunks: '#7b5cff', cap: '#ff7bac' },
  { bg: ['#6fd6e8', '#fff3c4'], ui: '#ff8c42', rock: ['#e0b48a', '#cf9b6e', '#efc9a0'], grass: '#a5dc5a', water: '#2ad0bf', deep: '#139c9a', trunks: '#ff8c42', cap: '#3a86ff' },
  { bg: ['#ff9eb5', '#ffe6b0'], ui: '#e8456b', rock: ['#b9a0a0', '#a38787', '#cdb6b2'], grass: '#7fcf8a', water: '#38bde8', deep: '#1f84c4', trunks: '#22c39a', cap: '#ff4f6d' },
];

// ---------------------------------------------------------------- world: water, sky props
const water = new THREE.Mesh(new THREE.BoxGeometry(260, 8, 80), glossy('#1fc3d6', { transparent: true, opacity: 0.94, roughness: 0.12 }));
water.position.set(0, -4.02, -26); water.receiveShadow = true; scene.add(water);
function waveTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256);
  const R = rng(11);
  for (let i = 0; i < 26; i++) {
    const x = R() * 256, y = R() * 256, w = 20 + R() * 50;
    g.strokeStyle = `rgba(255,255,255,0)`; g.fillStyle = `rgba(150,215,235,${0.25 + R() * 0.3})`;
    g.beginPath(); g.ellipse(x, y, w, 3 + R() * 3, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = `rgba(255,255,255,0.9)`; g.beginPath(); g.ellipse(x + 6, y - 3, w * 0.5, 1.6, 0, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(26, 8); t.anisotropy = 8; return t;
}
const waterTop = new THREE.Mesh(new THREE.PlaneGeometry(260, 80), new THREE.MeshStandardMaterial({ color: '#7fe6ef', map: waveTex(), roughness: 0.15, metalness: 0.05 }));
waterTop.rotation.x = -Math.PI / 2; waterTop.position.set(0, 0.01, -26); waterTop.receiveShadow = true; scene.add(waterTop);
// sparkle stripes on the water front
const stripeMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35 });
const stripes = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 0.08), stripeMat, 40);
{ const m = new THREE.Matrix4(), R = rng(7); for (let i = 0; i < 40; i++) { m.compose(new THREE.Vector3(-30 + R() * 90, -0.3 - R() * 3, 14.05), new THREE.Quaternion(), new THREE.Vector3(0.6 + R() * 2.5, 1, 1)); stripes.setMatrixAt(i, m); } }
scene.add(stripes);
// distant islands + clouds
const far = new THREE.Group(); scene.add(far);
const islandMat = mat('#8fd3a0', { roughness: 0.9 }), cloudMat = mat('#ffffff', { roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.25 });
{
  const R = rng(3);
  for (let i = 0; i < 6; i++) {
    const s = 4 + R() * 7, isl = new THREE.Mesh(new THREE.SphereGeometry(s, 16, 10, 0, TAU, 0, Math.PI / 2), islandMat);
    isl.scale.set(1.6, 0.55 + R() * 0.4, 1); isl.position.set(-10 + i * 16 + R() * 6, -0.2, -58 - R() * 10); far.add(isl);
  }
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Group();
    for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(1.2 + R() * 1.2, 14, 10), cloudMat); b.position.set(k * 1.5 - 2, R() * 0.6, R() * 0.5); b.scale.y = 0.75; c.add(b); }
    c.position.set(-20 + R() * 60, 6 + R() * 34, -40 - R() * 15); c.userData.v = 0.004 + R() * 0.006; far.add(c);
  }
}
// spectators' boat
const boat = new THREE.Group(); scene.add(boat);
{
  const hull = new THREE.Mesh(rounded(3.4, 0.7, 1.4, 0.3), mat('#ffffff')); hull.position.y = 0.15; hull.castShadow = true; boat.add(hull);
  const band = new THREE.Mesh(new THREE.BoxGeometry(3.42, 0.16, 1.42), mat('#ff5d73')); band.position.y = 0.32; boat.add(band);
  boat.fans = [];
  for (const [x, c] of [[-0.7, '#3a86ff'], [0.5, '#ffd23f']]) {
    const f = new THREE.Group(), body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.3, 4, 8), mat(c)); body.position.y = 0.85; body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 10), mat('#ffd7ba')); head.position.y = 1.32;
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.38, 4, 6), mat(c)); arm.position.set(0, 1.25, 0.2); f.arm = arm;
    const arm2 = arm.clone(); arm2.position.z = -0.2; f.arm2 = arm2;
    f.add(body, head, arm, arm2); f.position.x = x; boat.add(f); boat.fans.push(f);
  }
}

// ---------------------------------------------------------------- cliff (instanced rounded rock blocks) + ledge
const ROCKS = 90;
const rockMesh = new THREE.InstancedMesh(rounded(1, 1, 1, 0.18), mat('#ffffff', { roughness: 0.85 }), ROCKS);
rockMesh.castShadow = true; rockMesh.receiveShadow = true; scene.add(rockMesh);
const GRASS = 40;
const grassMesh = new THREE.InstancedMesh(rounded(1, 0.25, 1, 0.1), mat('#ffffff', { roughness: 0.8 }), GRASS);
grassMesh.castShadow = true; grassMesh.receiveShadow = true; scene.add(grassMesh);
const BUSH = 30;
const bushMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 1), mat('#ffffff', { roughness: 0.8, flatShading: true }), BUSH);
bushMesh.castShadow = true; scene.add(bushMesh);
const ledge = new THREE.Group(); scene.add(ledge);
const plankMat = mat('#c98a52'), postMat = mat('#ffffff');
{
  const plank = new THREE.Mesh(rounded(2.4, 0.22, 1.3, 0.08), plankMat); plank.position.set(0.0, -0.11, 0); plank.castShadow = true; plank.receiveShadow = true; ledge.add(plank);
  for (let i = 0; i < 5; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.01, 1.3), mat('#a86f3f')); l.position.set(-1 + i * 0.5, 0.005, 0); ledge.add(l); }
  for (const z of [-0.6, 0.6]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8), postMat); p.position.set(-0.9, 0.4, z); ledge.add(p);
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 8), postMat); r.rotation.z = Math.PI / 2; r.position.set(-0.35, 0.8, z); ledge.add(r);
  }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 8), postMat); pole.position.set(-1.6, 1.3, -0.5); ledge.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), new THREE.MeshStandardMaterial({ color: '#ff5d73', side: THREE.DoubleSide })); flag.position.set(-1.12, 2.3, -0.5); ledge.add(flag); ledge.flag = flag;
}
// height ticks painted on the cliff (little boards)
const tickMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 });
const ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.06, 0.05), tickMat, 60); scene.add(ticks);

let theme, cliffTop = 10;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
function buildCliff(H, R) {
  cliffTop = H;
  let i = 0, gi = 0, bi = 0;
  // stacked strata from the water up to the ledge, slightly irregular, receding to the left
  const rows = Math.ceil(H / 1.6) + 1;
  for (let r = 0; r < rows && i < ROCKS - 4; r++) {
    const y0 = r * 1.6, front = -0.9 - Math.sin(r * 1.7 + R() * 2) * 0.55 - R() * 0.4;
    const w = 3 + R() * 2;
    for (let k = 0; k < 3 && i < ROCKS; k++) {
      const h = 1.6 + R() * 0.5, d = 4 + R() * 3, x = front - w / 2 - k * (w * 0.8), z = -1.5 - k * 1.2 + (R() - 0.5);
      _p.set(x, y0 + h / 2 - 0.3, z); _q.setFromEuler(new THREE.Euler(0, (R() - 0.5) * 0.25, (R() - 0.5) * 0.08)); _s.set(w, h, d);
      _m.compose(_p, _q, _s); rockMesh.setMatrixAt(i, _m); rockMesh.setColorAt(i, _c.set(theme.rock[(r + k) % 3])); i++;
      if (k === 0 && R() < 0.45 && gi < GRASS) { _p.set(x + 0.1, y0 + h - 0.25, z); _s.set(w * 0.9, 1, d * 0.9); _m.compose(_p, _q, _s); grassMesh.setMatrixAt(gi, _m); grassMesh.setColorAt(gi, _c.set(theme.grass)); gi++; }
      if (k === 0 && R() < 0.35 && bi < BUSH) { _p.set(x + w * 0.3, y0 + h - 0.1, z + 1); _s.setScalar(0.6 + R() * 0.6); _m.compose(_p, _q, _s); bushMesh.setMatrixAt(bi, _m); bushMesh.setColorAt(bi, _c.set(theme.grass).offsetHSL(0, 0, -0.08)); bi++; }
    }
  }
  // cap: big flat top block behind the ledge
  _p.set(-3.2, H - 0.8, -1.5); _q.identity(); _s.set(6.4, 1.6, 6); _m.compose(_p, _q, _s); rockMesh.setMatrixAt(i, _m); rockMesh.setColorAt(i, _c.set(theme.rock[0])); i++;
  _p.set(-3.2, H + 0.05, -1.5); _s.set(6.5, 1, 6.1); _m.compose(_p, _q, _s); grassMesh.setMatrixAt(gi, _m); grassMesh.setColorAt(gi, _c.set(theme.grass)); gi++;
  for (let k = 0; k < 4 && bi < BUSH; k++) { _p.set(-2 - k * 1.3, H + 0.35, -3 + R()); _s.setScalar(0.7 + R() * 0.7); _m.compose(_p, _q, _s); bushMesh.setMatrixAt(bi, _m); bushMesh.setColorAt(bi, _c.set(theme.grass).offsetHSL(0, 0.05, -0.1)); bi++; }
  // big rocks at the waterline
  for (let k = 0; k < 3; k++) { _p.set(-1.5 - k * 2.2, 0.2, 0.8 + k * 0.4); _q.setFromEuler(new THREE.Euler(R(), R(), R())); _s.set(1.6 + R(), 1.1 + R() * 0.6, 1.4 + R()); _m.compose(_p, _q, _s); rockMesh.setMatrixAt(i, _m); rockMesh.setColorAt(i, _c.set(theme.rock[2])); i++; }
  rockMesh.count = i; grassMesh.count = gi; bushMesh.count = bi;
  rockMesh.instanceMatrix.needsUpdate = true; rockMesh.instanceColor.needsUpdate = true;
  grassMesh.instanceMatrix.needsUpdate = true; grassMesh.instanceColor.needsUpdate = true;
  bushMesh.instanceMatrix.needsUpdate = true; if (bushMesh.instanceColor) bushMesh.instanceColor.needsUpdate = true;
  ledge.position.set(0.3, H, 0);
  let ti = 0; for (let y = 2; y < H && ti < 60; y += 2) { _q.identity(); _p.set(-0.35, y, 2.2); _s.set(y % 10 === 0 ? 1.6 : 1, 1, 1); _m.compose(_p, _q, _s); ticks.setMatrixAt(ti++, _m); }
  ticks.count = ti; ticks.instanceMatrix.needsUpdate = true;
}

// ---------------------------------------------------------------- diver (pivot = centre of mass, faces +x, flips about z)
function makeDiver() {
  const g = new THREE.Group(), skin = mat('#ffcfa8'), trunks = mat('#ff4f6d'), cap = glossy('#ffd23f'), dark = glossy('#263046');
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.48, 6, 12), skin); torso.position.y = 0.2; torso.castShadow = true;
  const pants = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.25, 0.3, 14), trunks); pants.position.y = -0.18; pants.castShadow = true;
  const head = new THREE.Group(); head.position.y = 0.82;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.25, 20, 14), skin); skull.castShadow = true;
  const capM = new THREE.Mesh(new THREE.SphereGeometry(0.265, 20, 12, 0, TAU, 0, Math.PI * 0.55), cap); capM.rotation.z = -0.25;
  const gog = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.035, 6, 20, Math.PI * 0.9), dark); gog.rotation.set(Math.PI / 2, 0, -Math.PI * 0.45); gog.position.y = 0.03;
  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), glossy('#3ad0ff')); lens.position.set(0.22, 0.04, 0.09); const lens2 = lens.clone(); lens2.position.z = -0.09;
  head.add(skull, capM, gog, lens, lens2);
  g.add(torso, pants, head);
  const limb = (x, y, z, r, len, m) => { const piv = new THREE.Group(); piv.position.set(x, y, z); const l = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 8), m); l.position.y = -len / 2 - r * 0.5; l.castShadow = true; piv.add(l); g.add(piv); piv.len = len + r; return piv; };
  g.armL = limb(0, 0.58, 0.33, 0.08, 0.5, skin); g.armR = limb(0, 0.58, -0.33, 0.08, 0.5, skin);
  g.legL = limb(0, -0.3, 0.13, 0.1, 0.34, skin); g.legR = limb(0, -0.3, -0.13, 0.1, 0.34, skin);
  for (const leg of [g.legL, g.legR]) {
    const knee = new THREE.Group(); knee.position.y = -0.46; leg.add(knee);
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.34, 4, 8), skin); shin.position.y = -0.21; shin.castShadow = true; knee.add(shin);
    const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.14, 4, 6), skin); foot.rotation.z = Math.PI / 2; foot.position.set(0.07, -0.42, 0); knee.add(foot);
    leg.knee = knee;
  }
  g.mats = { trunks, cap };
  return g;
}
const diver = makeDiver(); scene.add(diver);
const shadowBlob = new THREE.Mesh(new THREE.CircleGeometry(0.6, 20), new THREE.MeshBasicMaterial({ color: '#0a5a7a', transparent: true, opacity: 0.25, depthWrite: false }));
shadowBlob.rotation.x = -Math.PI / 2; shadowBlob.position.y = 0.03; scene.add(shadowBlob);

// pose: 0 stand, tuck 0..1, stream 0..1 (arms overhead)
function pose(tuck, stream, t = 0) {
  const armT = 1.25, armS = Math.PI * 0.98, armStand = 0.1 + Math.sin(t * 2) * 0.05;
  const arm = lerp(lerp(armStand, armS, stream), armT, tuck);
  diver.armL.rotation.z = arm; diver.armR.rotation.z = arm;
  diver.armL.rotation.x = lerp(0, 0.35, tuck); diver.armR.rotation.x = -diver.armL.rotation.x;
  const thigh = lerp(0, 2.0, tuck), knee = lerp(0, -2.3, tuck);
  diver.legL.rotation.z = thigh; diver.legR.rotation.z = thigh; diver.legL.knee.rotation.z = knee; diver.legR.knee.rotation.z = knee;
}

// ---------------------------------------------------------------- dive physics (fixed step so the bot can predict exactly)
const STEP = 1 / 120, G = 15;
let state = 'ready', score = 0, dive = 0, DIVES = 3, recorded = false, beatShown = false, R = rng(1);
let phase = 'stand';    // stand | air | under | done
let P = { x: 0, y: 0, vx: 0, vy: 0, a: 0, w: 0, tuck: 0, t: 0 };
let hold = false, botHold = false, botReleaseAt = -1, acc = 0, slow = 1, shake = 0, entryT = 0, H = 10;
let spinFast = 2.1, spinOpen = 0.16, tol = 40, jumpVx = 2.3, jumpVy = 5.6;
const ripples = [];

function stepPhys(s, held) {
  const wt = held ? spinFast * TAU : spinOpen * TAU;
  s.w += (wt - s.w) * Math.min(1, STEP * (held ? 7 : 5.5));
  s.tuck += ((held ? 1 : 0) - s.tuck) * Math.min(1, STEP * 12);
  s.vy -= G * STEP; s.x += s.vx * STEP; s.y += s.vy * STEP; s.a += s.w * STEP; s.t += STEP;
}
// angle error at entry (degrees) vs. head-first along the velocity, and vs. feet-first
function entryError(s) {
  const head = Math.atan2(s.vx, s.vy);           // a that points the head along the velocity
  const d = (x) => { let e = ((x % TAU) + TAU) % TAU; if (e > Math.PI) e = TAU - e; return e * 180 / Math.PI; };
  return { head: d(s.a - head), feet: d(s.a - head - Math.PI) };
}
// simulate until water with release at step `rel` (Infinity = keep holding); returns final state
function predict(relAt) {
  const s = { ...P }; let n = 0;
  while (s.y > 0.15 && n < 2000) { stepPhys(s, s.t < relAt); n++; }
  return s;
}

function buildDive() {
  const fk = F.k();
  R = rng((D.seed || level * 7919) + dive * 31 + 3);
  H = Math.min(9 + (level - 1) * 1.7 + dive * 3.2, 46);
  spinFast = clamp((1.9 + level * 0.04) * (0.9 + fk * 0.1), 1.9, 2.8);
  tol = clamp((44 - level * 1.2) / fk, 20, 50);
  buildCliff(H, R);
  phase = 'stand'; hold = false; botHold = false; botReleaseAt = -1;
  P = { x: 1.2, y: H, vx: 0, vy: 0, a: 0, w: 0, tuck: 0, t: 0 };
  diver.position.set(P.x, H + 1.12, 0); diver.rotation.set(0, 0, 0); diver.visible = true; pose(0, 0);
  ui.sub(`Dive ${dive + 1} of ${DIVES}`);
  meterEl.textContent = Math.round(H) + ' m';
}
function buildLevel() {
  theme = THEMES[(level - 1) % THEMES.length];
  document.body.style.setProperty('--bg1', theme.bg[0]); document.body.style.setProperty('--bg2', theme.bg[1]); document.body.style.setProperty('--ui', theme.ui);
  water.material.color.set(theme.deep); waterTop.material.color.set(theme.water).offsetHSL(0, 0, 0.04);
  diver.mats.trunks.color.set(theme.trunks); diver.mats.cap.color.set(theme.cap);
  ledge.flag.material.color.set(theme.ui);
  dive = 0; score = 0; recorded = false; beatShown = false;
  ui.levels(level); ui.progress(0); ui.score(0);
  buildDive();
}

function leap() {
  if (phase !== 'stand' || state !== 'play') return;
  phase = 'air'; P.vx = jumpVx; P.vy = jumpVy; P.y = H + 1.1; P.w = 1.2;
  sfx.tap(); tone(300, 0.15, 'sine', 0.1, 1.8); buzz(10);
  diver.scale.set(1.15, 0.85, 1.15);
}

function enter() {
  phase = 'under'; entryT = 0;
  const e = entryError(P), flips = Math.max(0, Math.round((P.a - Math.PI) / TAU));
  const headFirst = e.head <= e.feet, err = Math.min(e.head, e.feet);
  const pos = new THREE.Vector3(P.x, 0.05, 0);
  const ok = err <= tol && P.tuck < 0.5;
  if (!ok) {
    burst(scene, pos, ['#ffffff', '#bff4ff', theme.water], 46, { speed: 0.2, up: 0.32, size: 1.4, shape: 'sphere', gravity: 0.012 });
    ripple(pos, 3.4); shake = 0.9; ui.flash(0.5); sfx.smash(); buzz([40, 30, 80]);
    ui.pop(P.tuck >= 0.5 ? 'CANNONBALL!' : 'SPLAT!', '#fff', 54, 34);
    diver.visible = false;
    setTimeout(() => lose(), 700);
    return;
  }
  const flipPts = (headFirst ? flips : Math.max(0, Math.round(P.a / TAU))) * 20;
  let label, bonus, size;
  if (err <= 8) { label = 'PERFECT!'; bonus = 40; size = 0.5; }
  else if (err <= 18) { label = 'GREAT!'; bonus = 22; size = 0.9; }
  else { label = 'GOOD'; bonus = 8; size = 1.3; }
  if (!headFirst) { label = 'PENCIL'; bonus = Math.round(bonus / 2); }
  const pts = Math.round((10 + flipPts + bonus) * (1 + H / 25));
  score += pts; ui.score(score); checkBeat();
  const fl = headFirst ? flips : Math.round(P.a / TAU);
  ui.pop(label, label === 'PERFECT!' ? '#fff36b' : '#fff', label === 'PERFECT!' ? 54 : 44, 28);
  setTimeout(() => ui.pop(`${fl > 0 ? fl + '× FLIP  ' : ''}+${pts}`, '#fff', 34, 36), 450);
  burst(scene, pos, ['#ffffff', '#bff4ff'], Math.round(10 + size * 18), { speed: 0.06 + size * 0.06, up: 0.12 + size * 0.12, size: 0.8 + size * 0.4, shape: 'sphere', gravity: 0.01 });
  ripple(pos, 1.4 + size * 1.5);
  if (label === 'PERFECT!') { ui.flash(0.35); confetti(scene, pos.clone().setY(2.5), 40); tone(1200, 0.25, 'sine', 0.12, 1.5); buzz([10, 20, 30]); cheer = 1.6; }
  else { tone(700, 0.12, 'triangle', 0.1, 1.3); buzz(15); cheer = 0.8; }
  tone(180, 0.25, 'sine', 0.14, 0.4);
  dive++; ui.progress(dive / DIVES);
  setTimeout(() => {
    if (state !== 'play') return;
    if (dive >= DIVES) win(); else { buildDive(); camSnap = true; }
  }, 1300);
}
let cheer = 0, camSnap = true;

function ripple(pos, size) {
  const r = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.55, 32), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
  r.rotation.x = -Math.PI / 2; r.position.copy(pos).setY(0.04); scene.add(r); ripples.push({ m: r, t: 0, size });
}

function checkBeat() {
  if (score > best) { best = score; S.set('best', best); }
  if (!beatShown && D.beaten(score)) { beatShown = true; setTimeout(() => ui.pop('BEATEN!', '#fff36b', 44, 46), 700); confetti(scene, new THREE.Vector3(P.x, 3, 0), 60); }
}
function win() {
  if (state !== 'play') return; state = 'won';
  if (!recorded) { recorded = true; F.level(true); }
  level++; S.set('level', level);
  confetti(scene, new THREE.Vector3(P.x, 3, 0), 110); sfx.win(); buzz([20, 40, 20, 40, 60]);
  D.won(score); B.submit(1);                               // world board: levels cleared today
  ui.win(level - 1, `${score} pts`);
}
function lose() {
  if (state !== 'play') return; state = 'lost';
  if (!recorded) { recorded = true; F.level(false, dive / DIVES); }
  sfx.fail();
  ui.lose('BELLY FLOP!', `Dive ${dive + 1} of ${DIVES} · open up straight before the water`);
}

input({
  onDown: () => { if (state !== 'play') return; hold = true; if (phase === 'stand') leap(); },
  onUp: () => { hold = false; },
});
ui.onTap(() => { buildLevel(); state = 'play'; B.start(); ui.els.sc.classList.remove('hc-hidden'); camSnap = true; });

// ---------------------------------------------------------------- loop
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
loop((rawDt, t) => {
  const real = rawDt / 60;
  if (phase === 'air') {
    const nearWater = P.y < 3.2 && P.vy < 0;
    slow = lerp(slow, nearWater ? 0.42 : 1, 0.2);
    acc += real * slow;
    while (acc >= STEP && phase === 'air') {
      acc -= STEP;
      const held = botReleaseAt >= 0 ? (P.t < botReleaseAt) : (hold || botHold);
      const wasT = P.tuck;
      stepPhys(P, held);
      if (wasT < 0.5 && P.tuck >= 0.5) tone(420, 0.06, 'sine', 0.06, 1.3);
      if (P.y <= 0.15) { enter(); break; }
    }
    diver.position.set(P.x, P.y, 0); diver.rotation.z = -P.a;
    pose(P.tuck, (1 - P.tuck) * clamp((P.t - 0.15) * 3, 0, 1), t);
    // whoosh per half flip
    const half = Math.floor(P.a / Math.PI); if (half !== diver.userData.half) { diver.userData.half = half; if (P.tuck > 0.5) tone(260 + (half % 4) * 40, 0.05, 'sine', 0.05, 1.4); }
    meterEl.textContent = Math.max(0, Math.round(P.y)) + ' m';
  } else if (phase === 'stand') {
    acc = 0; slow = 1;
    pose(0, 0, t); diver.position.y = H + 1.12 + Math.sin(t * 3) * 0.015;
    diver.rotation.z = Math.sin(t * 1.5) * 0.03;
  } else if (phase === 'under') {
    entryT += real; slow = 1;
    P.y -= 6 * real; diver.position.y = P.y;
    if (entryT > 0.25) diver.visible = false;
  }
  diver.scale.lerp(_s.set(1, 1, 1), 0.12);
  shadowBlob.position.x = diver.position.x; shadowBlob.visible = phase === 'air';
  shadowBlob.scale.setScalar(clamp(1.4 - diver.position.y / 25, 0.3, 1.4));
  // ripples
  for (let i = ripples.length - 1; i >= 0; i--) { const r = ripples[i]; r.t += real; const k = r.t / 1.4; r.m.scale.setScalar(1 + k * r.size * 4); r.m.material.opacity = 0.9 * (1 - k); if (k >= 1) { scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); ripples.splice(i, 1); } }
  // props
  for (const c of far.children) if (c.userData.v) { c.position.x += c.userData.v * rawDt; if (c.position.x > 45) c.position.x = -25; }
  boat.position.set(9 + Math.sin(t * 0.4) * 0.3, Math.sin(t * 1.6) * 0.08, -2.5); boat.rotation.z = Math.sin(t * 1.3) * 0.04; boat.rotation.y = -0.3;
  cheer = Math.max(0, cheer - real);
  for (const [i, f] of boat.fans.entries()) { const up = cheer > 0 ? 2.6 + Math.sin(t * 18 + i) * 0.4 : 0.25; f.arm.rotation.x = lerp(f.arm.rotation.x, -up, 0.2); f.arm2.rotation.x = lerp(f.arm2.rotation.x, up, 0.2); f.position.y = cheer > 0 ? Math.abs(Math.sin(t * 12 + i)) * 0.2 : 0; }
  ledge.flag.rotation.y = Math.sin(t * 4) * 0.25;
  stripes.position.x = Math.sin(t * 0.5) * 0.4; waterTop.material.map.offset.set(t * 0.01, Math.sin(t * 0.6) * 0.02);
  // camera: side-on, a little above, follows the diver; frames ledge + water distance when standing
  shake = Math.max(0, shake - real * 1.5);
  const dy = diver.position.y;
  let tx, ty, dist;
  if (state === 'ready') { tx = 0.5; ty = H * 0.55; dist = 14 + H * 0.55; }
  else if (phase === 'stand') { tx = 1.6; ty = H - 1.4; dist = 13; }
  else if (phase === 'air') { tx = P.x - 0.3; ty = Math.max(dy - 1.2, 1.4); dist = 15; }
  else { tx = P.x; ty = 1.5; dist = 12; }
  camLook.set(tx, ty, 0); camPos.set(tx + 1.2, ty + 2.4, dist);
  if (camSnap) { camera.position.copy(camPos); camSnap = false; } else camera.position.lerp(camPos, phase === 'air' ? 0.18 : 0.08);
  camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake;
  camera.lookAt(camera.position.x - 1.2, camera.position.y - 2.4 - (camera.position.z - dist) * 0, 0);
  stage.followLight(_p.set(diver.position.x - 2, Math.max(diver.position.y, 4) - 4, 0));
});

theme = THEMES[(level - 1) % THEMES.length];
buildLevel(); ui.start(); ui.els.sc.classList.add('hc-hidden');

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play') return;
    if (phase === 'stand') { botHold = true; botReleaseAt = -1; leap(); return; }
    if (phase !== 'air' || botReleaseAt >= 0) return;
    // find the latest release (most flips) that still gives a clean head-first entry
    let bestT = -1, bestErr = 1e9;
    for (let tr = P.t + 0.02; tr < P.t + 3; tr += 1 / 120) {
      const s = predict(tr); if (s.y > 0.2) break;
      const e = entryError(s);
      if (e.head < 7) bestT = tr;
      if (e.head < bestErr) bestErr = e.head;
      if (s.tuck > 0.4) break;
    }
    if (bestT < 0) { for (let tr = P.t + 0.02; tr < P.t + 3; tr += 1 / 120) { const s = predict(tr); const e = entryError(s); if (Math.abs(e.head - bestErr) < 0.01) { bestT = tr; break; } } }
    botReleaseAt = bestT >= 0 ? bestT + (Math.random() - 0.5) * 0.02 : P.t;
  },
};
