// Swish Street — original street-basketball shooter. Hold to charge the shot meter, release in the green zone.
// Real ball physics: the meter decides how far the ball lands from the rim centre; rim, backboard and floor do the rest.
import { THREE, createStage, createUI, input, loop, store, mat, glossy, rounded, burst, confetti, sfx, tone, note, buzz, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';

const NAME = 'Swish Street: Basketball Shooting';
const S = store('swish');
const F = flow('swish');
let level = S.get('level', 1), best = S.get('best', 0);

const stage = createStage({ fov: 50, shadowSize: 9 });
const { scene, camera, renderer } = stage;
const ui = createUI({ title: 'SWISH<br>STREET', hint: 'Hold, then release in the green', hand: '👆' });
const D = daily('swish', ui, { name: NAME });
const $ = (id) => document.getElementById(id);
const meterEl = $('meter'), zoneEl = $('zone'), fillEl = $('fill'), tickEl = $('tick'), mlabel = $('mlabel'), rack = $('rack');

// ---------------------------------------------------------------- constants (game units ≈ metres, slightly enlarged hoop)
const RIM = new THREE.Vector3(0, 3.0, 0), RIM_R = 0.34, TUBE = 0.028, BALL_R = 0.165, BOARD_Z = -0.44, G = 9.8;
const BOARD = { x: 0.95, y0: 2.82, y1: 3.95 };

const THEMES = [
  { sky: ['#ffa98a', '#ffe4c4'], court: '#6f8df0', paint: '#ff7f8a', line: '#ffffff', bld: ['#ff9f80', '#ffc29a', '#f58a8a', '#ffd3a8'], fence: '#4b4f73' },
  { sky: ['#8fd3ff', '#e2f6ff'], court: '#ff9a5c', paint: '#3dbb8f', line: '#ffffff', bld: ['#a0c4ff', '#bde0fe', '#90b8f8', '#cfe4ff'], fence: '#38506e' },
  { sky: ['#c3a6ff', '#ffd6ec'], court: '#3dc4a0', paint: '#7b5cff', line: '#ffffff', bld: ['#b69cff', '#f3a6d8', '#9f8cf0', '#ffc6e3'], fence: '#433a63' },
  { sky: ['#ffcf6b', '#fff3cf'], court: '#e8607a', paint: '#ffb84d', line: '#ffffff', bld: ['#ffbf69', '#ff9e6b', '#ffd59a', '#f7a072'], fence: '#5a4a3f' },
];

// ---------------------------------------------------------------- textures
function canvasTex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
const ballTex = canvasTex(512, 256, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ff9a4d'); gr.addColorStop(1, '#f2652a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(120,40,0,${Math.random() * 0.12})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  g.strokeStyle = '#3a1a0a'; g.lineWidth = 7;
  g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
  for (const x of [w * 0.25, w * 0.75]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  for (const x0 of [0, w / 2]) { g.beginPath(); for (let y = 0; y <= h; y += 4) { const x = x0 + w * 0.25 + Math.sin(y / h * Math.PI) * w * 0.17 * (x0 ? 1 : -1); y ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
});
const fenceTex = canvasTex(64, 64, (g, w, h) => {
  g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h); g.moveTo(w, 0); g.lineTo(0, h); g.stroke();
}, [40, 6]);
const winTex = canvasTex(128, 256, (g, w, h) => {
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
  for (let y = 20; y < h - 20; y += 40) for (let x = 16; x < w - 16; x += 36) { g.fillStyle = Math.random() < 0.3 ? '#fff6c9' : 'rgba(60,70,120,0.28)'; g.fillRect(x, y, 22, 26); }
});
winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping;

// ---------------------------------------------------------------- world (static parts rebuilt per theme)
const world = new THREE.Group(); scene.add(world);
let theme, courtMat, fenceMat, bldMats = [];
const floor = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.MeshStandardMaterial({ roughness: 0.85 }));
floor.rotation.x = -Math.PI / 2; floor.position.z = 4; floor.receiveShadow = true; world.add(floor);
function courtTexture(t) {
  return canvasTex(1024, 1024, (g, w, h) => {
    // canvas covers x∈[-13,13], z∈[-9,17]  → 1 unit = w/26 px
    const u = w / 26, X = (x) => (x + 13) * u, Z = (z) => (z + 9) * u;
    g.fillStyle = t.court; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
    g.fillStyle = t.paint; g.fillRect(X(-1.9), Z(-1.6), 3.8 * u, 5.4 * u);
    g.strokeStyle = t.line; g.lineWidth = 0.09 * u;
    g.strokeRect(X(-1.9), Z(-1.6), 3.8 * u, 5.4 * u);
    g.beginPath(); g.arc(X(0), Z(3.8), 1.6 * u, 0, Math.PI); g.stroke();
    g.setLineDash([0.4 * u, 0.3 * u]); g.beginPath(); g.arc(X(0), Z(3.8), 1.6 * u, Math.PI, Math.PI * 2); g.stroke(); g.setLineDash([]);
    g.beginPath(); g.moveTo(X(-13), Z(-1.6)); g.lineTo(X(13), Z(-1.6)); g.stroke();
    g.beginPath(); g.arc(X(0), Z(0), 6.4 * u, 0.02, Math.PI - 0.02); g.stroke();
    g.beginPath(); g.arc(X(0), Z(12), 1.8 * u, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(X(-13), Z(12)); g.lineTo(X(13), Z(12)); g.stroke();
  });
}
// hoop: pole, arm, backboard, rim, net
const hoop = new THREE.Group(); scene.add(hoop);
const poleM = glossy('#41466b');
const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 3.9, 16), poleM); pole.position.set(0, 1.95, -1.35); pole.castShadow = true;
const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.95), poleM); arm.position.set(0, 3.55, -0.9); arm.castShadow = true;
const boardMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3, transparent: true, opacity: 0.94 });
const board = new THREE.Mesh(rounded(BOARD.x * 2, BOARD.y1 - BOARD.y0, 0.07, 0.04), boardMat); board.position.set(0, (BOARD.y0 + BOARD.y1) / 2, BOARD_Z - 0.035); board.castShadow = true;
const boxFrame = new THREE.Group();
{ const fm = mat('#ff5d5d'); const bar = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.02), fm); m.position.set(x, y, BOARD_Z + 0.012); boxFrame.add(m); };
  bar(0.62, 0.05, 0, 3.47); bar(0.62, 0.05, 0, 3.08); bar(0.05, 0.44, -0.29, 3.275); bar(0.05, 0.44, 0.29, 3.275);
  bar(1.88, 0.06, 0, BOARD.y1 - 0.03); bar(1.88, 0.06, 0, BOARD.y0 + 0.03); bar(0.06, 1.13, -0.93, 3.385); bar(0.06, 1.13, 0.93, 3.385); }
const rimMat = glossy('#ff5d3a', { emissive: '#5a1000', emissiveIntensity: 0.25 });
const rim = new THREE.Mesh(new THREE.TorusGeometry(RIM_R, TUBE * 1.3, 10, 36), rimMat); rim.rotation.x = Math.PI / 2; rim.position.copy(RIM); rim.castShadow = true;
const rimArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.12), rimMat); rimArm.position.set(0, RIM.y, BOARD_Z + 0.06);
const netGeo = new THREE.CylinderGeometry(RIM_R * 0.98, RIM_R * 0.6, 0.5, 14, 4, true);
const net = new THREE.Mesh(netGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true, transparent: true, opacity: 0.9 }));
net.position.set(RIM.x, RIM.y - 0.25, RIM.z);
const netPivot = new THREE.Group(); netPivot.position.copy(RIM); net.position.set(0, -0.25, 0); netPivot.add(net);
hoop.add(pole, arm, board, boxFrame, rim, rimArm, netPivot);

// fence + posts behind the hoop, buildings + trees beyond
fenceMat = new THREE.MeshBasicMaterial({ map: fenceTex, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, color: '#4b4f73' });
const fence = new THREE.Mesh(new THREE.PlaneGeometry(26, 3.6), fenceMat); fence.position.set(0, 1.8, -4.2); world.add(fence);
const fenceL = fence.clone(); fenceL.rotation.y = Math.PI / 2; fenceL.position.set(-8.5, 1.8, 4); world.add(fenceL);
const fenceR = fenceL.clone(); fenceR.position.x = 8.5; world.add(fenceR);
const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 3.7, 8), postMat = mat('#8a8fb3');
const posts = new THREE.InstancedMesh(postGeo, postMat, 13);
{ const m = new THREE.Matrix4(); let i = 0; for (let x = -12; x <= 12; x += 4) { m.makeTranslation(x, 1.85, -4.2); posts.setMatrixAt(i++, m); } for (let z = -2; z <= 10; z += 4) { m.makeTranslation(-8.5, 1.85, z); posts.setMatrixAt(i++, m); m.makeTranslation(8.5, 1.85, z); if (i < 13) posts.setMatrixAt(i++, m); } posts.count = i; }
world.add(posts);
const buildings = [];
for (let i = 0; i < 7; i++) {
  const w = 3 + (i % 3), h = 6 + ((i * 37) % 7);
  const bm = new THREE.MeshStandardMaterial({ map: winTex.clone(), roughness: 0.9 }); bm.map.repeat.set(w / 3, h / 5);
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 3), bm); b.position.set(-15 + i * 5 + (i % 2) * 0.8, h / 2 - 0.2, -11 - (i % 3) * 2.2);
  bldMats.push(bm); world.add(b); buildings.push(b);
}
const trunkM = mat('#8a5a44'), leafM = mat('#5fcf8a');
for (const [x, z, s] of [[-6.5, -6, 1.3], [6.8, -6.5, 1.5], [-10, -3, 1.1], [10.5, -2.5, 1.2]]) {
  const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.16 * s, 1.6 * s, 8), trunkM); tr.position.set(x, 0.8 * s, z);
  const lf = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1 * s, 1), leafM); lf.position.set(x, 2.1 * s, z); lf.castShadow = true;
  world.add(tr, lf);
}
// bench at the side
const benchM = mat('#ffcf5c');
const bench = new THREE.Mesh(rounded(2.4, 0.18, 0.6, 0.06), benchM); bench.position.set(-6.4, 0.55, 3); bench.rotation.y = Math.PI / 2; bench.castShadow = true; world.add(bench);

function applyTheme(t) {
  theme = t;
  document.body.style.setProperty('--bg1', t.sky[0]); document.body.style.setProperty('--bg2', t.sky[1]); document.body.style.setProperty('--ui', t.paint);
  if (floor.material.map) floor.material.map.dispose();
  floor.material.map = courtTexture(t); floor.material.needsUpdate = true;
  fenceMat.color.set(t.fence);
  bldMats.forEach((m, i) => m.color.set(t.bld[i % t.bld.length]));
  leafM.color.set(t === THEMES[3] ? '#7fd17a' : '#5fcf8a');
}

// ---------------------------------------------------------------- hero: chunky toy baller with a bucket hat (seen from behind)
function makeHero() {
  const g = new THREE.Group();
  const skin = mat('#b9774f'), jersey = mat('#2ec4b6'), trim = mat('#ffffff'), shoe = mat('#ffffff'), sole = mat('#ff5d8f'), hat = mat('#ffd23f'), band2 = mat('#ff5d8f');
  const torso = new THREE.Mesh(rounded(0.62, 0.72, 0.36, 0.14), jersey); torso.position.y = 1.32; torso.castShadow = true;
  const shorts = new THREE.Mesh(rounded(0.64, 0.34, 0.38, 0.12), mat('#5b4bd8')); shorts.position.y = 0.9; shorts.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 22, 16), skin); head.position.y = 1.92; head.castShadow = true;
  const hatTop = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.2, 20), hat); hatTop.position.y = 2.07;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.03, 24), hat); brim.position.y = 1.98;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.255, 0.255, 0.05, 20), band2); band.position.y = 2.0;
  // big star on the back of the jersey
  const st = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.07 : 0.16, a = Math.PI / 2 + i * Math.PI / 5; i ? st.lineTo(Math.cos(a) * r, Math.sin(a) * r) : st.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const star = new THREE.Mesh(new THREE.ShapeGeometry(st), trim); star.position.set(0, 1.36, 0.19);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.06, 0.37), trim); stripe.position.y = 1.0;
  g.add(torso, shorts, head, hatTop, brim, band, star);
  const limb = (x, y, len, r, m, parent = g) => { const piv = new THREE.Group(); piv.position.set(x, y, 0); const l = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), m); l.position.y = -len / 2 - r * 0.5; l.castShadow = true; piv.add(l); parent.add(piv); return piv; };
  g.armL = limb(-0.38, 1.58, 0.5, 0.085, skin); g.armR = limb(0.38, 1.58, 0.5, 0.085, skin);
  g.legL = limb(-0.15, 0.82, 0.55, 0.1, skin); g.legR = limb(0.15, 0.82, 0.55, 0.1, skin);
  for (const leg of [g.legL, g.legR]) { const s = new THREE.Mesh(rounded(0.2, 0.14, 0.34, 0.06), shoe); s.position.set(0, -0.72, 0.05); const so = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.04, 0.35), sole); so.position.set(0, -0.79, 0.05); leg.add(s, so); }
  for (const arm of [g.armL, g.armR]) { const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.16, 12), jersey); sl.position.y = -0.04; arm.add(sl); }
  g.torso = torso; g.head = head; g.hatParts = [hatTop, brim, band];
  return g;
}
const hero = makeHero(); scene.add(hero);
// shadow blob for nicer grounding
const blobTex = canvasTex(64, 64, (g, w) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(0,0,0,0.35)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false })); blob.rotation.x = -Math.PI / 2; blob.position.y = 0.01; scene.add(blob);

// ---------------------------------------------------------------- ball
const ballMat = new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.55, emissive: '#000000' });
const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 28, 20), ballMat); ball.castShadow = true; scene.add(ball);
const trail = []; const trailMat = new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.5, depthWrite: false });
for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(BALL_R * (1 - i * 0.07), 10, 8), trailMat.clone()); m.visible = false; scene.add(m); trail.push(m); }

// ---------------------------------------------------------------- state
let state = 'ready', score = 0, made = 0, target = 3, ballsTotal = 6, ballsLeft = 6, streak = 0, fire = false, beatShown = false, recorded = false;
let phase = 'aim', charging = false, m = 0, mDir = 1, mSpeed = 0.9, zoneC = 0.7, zoneW = 0.16;
let shooterP = new THREE.Vector3(0, 0, 4.6), fwd = new THREE.Vector3(0, 0, -1), heroTargetP = shooterP.clone();
let vel = new THREE.Vector3(), flyT = 0, touched = false, scored = false, floorHits = 0, crouch = 0, jump = 0, jumpV = 0, netKick = 0, shake = 0, botPending = false;
let camPos = new THREE.Vector3(0, 4, 10), camLook = new THREE.Vector3(0, 2.6, 0), R = rng(1), resolveT = 0, levelDone = false;
const prevB = new THREE.Vector3();

function buildLevel() {
  R = rng((D.seed || level * 7919) + 13);
  applyTheme(THEMES[(level - 1) % THEMES.length]);
  const fk = F.k();
  target = Math.min(3 + Math.floor((level - 1) / 2), 9);
  ballsTotal = target + Math.max(2, 4 - Math.floor(level / 3));
  ballsLeft = ballsTotal; made = 0; score = 0; streak = 0; fire = false; beatShown = false; recorded = false; levelDone = false;
  mSpeed = clamp((0.85 + level * 0.035) * fk, 0.6, 1.9);
  ui.levels(level); ui.progress(0); ui.score(0); ui.sub(best ? 'BEST ' + best : '');
  rack.innerHTML = ''; for (let i = 0; i < ballsTotal; i++) rack.appendChild(document.createElement('i'));
  nextShot(true);
}
function zoneFor() {
  const fk = F.k();
  zoneW = clamp((0.2 - level * 0.007) / fk, 0.07, 0.22);
  zoneC = 0.45 + R() * (0.88 - 0.45 - zoneW / 2);
  zoneEl.style.bottom = `calc(${(zoneC - zoneW / 2) * 100}% )`; zoneEl.style.height = `${zoneW * 100}%`;
}
function nextShot(first) {
  phase = 'aim'; charging = false; m = 0; mDir = 1; scored = false; touched = false; floorHits = 0; flyT = 0; resolveT = 0;
  // pick a new spot on the court: further and wider as levels go up
  const spread = Math.min(0.15 + level * 0.06, 0.75), dist = 4.2 + R() * Math.min(0.6 + level * 0.15, 2.0);
  const ang = first && level === 1 ? 0 : (R() * 2 - 1) * spread;
  heroTargetP.set(Math.sin(ang) * dist, 0, Math.cos(ang) * dist);
  zoneFor(); meterEl.classList.remove('off'); updateMeter();
  mlabel.textContent = '';
}
function updateMeter() {
  fillEl.style.height = `calc(${m * 100}% - ${m * 8}px)`;
  tickEl.style.top = `${(1 - m) * 100}%`;
  const inZone = Math.abs(m - zoneC) <= zoneW / 2;
  tickEl.style.background = inZone ? '#20c477' : '#2b2d42';
}
function heldBallPos(out) {
  const up = 2.38 - crouch * 0.28 + jump;
  return out.copy(shooterP).addScaledVector(fwd, 0.1).setY(up);
}

function shoot() {
  if (phase !== 'aim' || !charging) return;
  charging = false; phase = 'fly'; ballsLeft--;
  rack.children[ballsTotal - ballsLeft - 1]?.classList.add('used');
  const off = m - zoneC, inZone = Math.abs(off) <= zoneW / 2, perfect = Math.abs(off) <= zoneW * 0.15;
  // where the ball comes down at rim height: 0 = dead centre; edge of green ≈ 0.12 off (still in)
  const K = 0.125 / (zoneW / 2);
  let depth = off * K, side = 0;
  if (!inZone) side = (R() * 2 - 1) * Math.min(0.12, Math.abs(depth) * 0.25);
  if (perfect) depth *= 0.3;
  depth = clamp(depth, -1.6, 1.4);
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const T = RIM.clone().addScaledVector(fwd, depth).addScaledVector(right, side);
  const S0 = heldBallPos(new THREE.Vector3());
  ball.position.copy(S0);
  const th = THREE.MathUtils.degToRad(54), dx = Math.hypot(T.x - S0.x, T.z - S0.z), dh = T.y - S0.y;
  const v = Math.sqrt(G * dx * dx / (2 * Math.cos(th) ** 2 * (dx * Math.tan(th) - dh)));
  const hdir = new THREE.Vector3(T.x - S0.x, 0, T.z - S0.z).normalize();
  vel.copy(hdir).multiplyScalar(v * Math.cos(th)); vel.y = v * Math.sin(th);
  jumpV = 0.075; crouch = 0;
  tone(300, 0.12, 'triangle', 0.14, 1.8); buzz(10);
  if (perfect) { ui.pop('PERFECT!', '#fff36b', 38, 30); }
  else if (inZone) { ui.pop('GREAT!', '#fff', 32, 30); }
  else { ui.pop(off > 0 ? 'TOO HARD' : 'TOO SOFT', 'rgba(255,255,255,.85)', 24, 30); }
  meterEl.classList.add('off');
  for (const t of trail) t.position.copy(ball.position);
}

function addScore(n) {
  score += n; ui.score(score);
  if (!beatShown && D.beaten(score)) { beatShown = true; ui.pop('BEATEN!', '#fff36b', 44, 40); confetti(scene, RIM.clone(), 60); }
  if (score > best) { best = score; S.set('best', best); }
}
function onScore() {
  scored = true; made++; streak++;
  const swish = !touched; let pts = swish ? 3 : 2;
  if (fire) pts *= 2;
  addScore(pts);
  netKick = 1; shake = 0.12;
  const rc = rack.children[ballsTotal - ballsLeft - 1]; rc && rc.classList.add('made');
  if (swish) { ui.pop(fire ? `SWISH! +${pts}` : `SWISH! +${pts}`, '#fff', 44, 24); [0, 4, 7, 12].forEach((s, i) => setTimeout(() => note(72 + s + (fire ? 5 : 0), 0.3, 0.15), i * 60)); ui.flash(0.35); }
  else { ui.pop(`+${pts}`, '#fff', 40, 24); [0, 7].forEach((s, i) => setTimeout(() => note(69 + s, 0.3, 0.14), i * 80)); ui.flash(0.18); }
  burst(scene, RIM.clone().add(new THREE.Vector3(0, -0.3, 0)), ['#ffffff', '#fff36b', theme.paint], swish ? 26 : 14, { speed: 0.07, up: 0.04, size: 0.5, gravity: 0.004 });
  buzz(swish ? [15, 30, 15] : 15);
  if (streak === 3 && !fire) { fire = true; ui.pop('ON FIRE! x2', '#ff7a2f', 46, 36); tone(180, 0.5, 'sawtooth', 0.1, 3); }
  ui.progress(made / target);
  if (made >= target) levelDone = true;
}
function onMissResolved() {
  if (!scored) { streak = 0; if (fire) { fire = false; ui.pop('FIRE OUT', '#fff', 26, 36); } }
}

function win() {
  if (state !== 'play') return; state = 'won';
  if (!recorded) { recorded = true; F.level(true); }
  // bonus for unused balls
  if (ballsLeft > 0) addScore(ballsLeft * 2);
  level++; S.set('level', level);
  confetti(scene, RIM.clone().add(new THREE.Vector3(0, 0.5, 0)), 90); confetti(scene, hero.position.clone().add(new THREE.Vector3(0, 2.5, 0)), 50);
  sfx.win(); buzz([20, 40, 20, 40, 60]);
  D.won(score);
  ui.win(level - 1, `${score} pts${ballsLeft ? ` · ${ballsLeft} balls spare` : ''}`);
}
function lose() {
  if (state !== 'play') return; state = 'lost';
  if (!recorded) { recorded = true; F.level(false, made / target); }
  sfx.fail(); buzz([40, 60, 40]); meterEl.classList.add('off');
  ui.lose('OUT OF BALLS', `${made} / ${target} baskets`);
}

// ---------------------------------------------------------------- physics
const _n = new THREE.Vector3(), _q = new THREE.Vector3();
function collide() {
  const p = ball.position;
  // rim: nearest point on the ring
  _q.set(p.x - RIM.x, 0, p.z - RIM.z); const rho = _q.length() || 1e-5;
  const nx = RIM.x + _q.x / rho * RIM_R, nz = RIM.z + _q.z / rho * RIM_R;
  _n.set(p.x - nx, p.y - RIM.y, p.z - nz); const d = _n.length();
  if (d < BALL_R + TUBE) {
    _n.divideScalar(d || 1); p.addScaledVector(_n, BALL_R + TUBE - d);
    const vn = vel.dot(_n); if (vn < 0) { vel.addScaledVector(_n, -1.55 * vn); vel.multiplyScalar(0.86); }
    if (!touched || flyT > 0.05) { tone(900 + Math.random() * 200, 0.06, 'square', 0.06, 0.6); }
    touched = true; buzz(6);
  }
  // rim arm / board front face
  if (p.z - BALL_R < BOARD_Z && prevB.z - BALL_R >= BOARD_Z - 0.05 && Math.abs(p.x) < BOARD.x && p.y > BOARD.y0 - 0.05 && p.y < BOARD.y1 && vel.z < 0) {
    p.z = BOARD_Z + BALL_R; vel.z = -vel.z * 0.6; vel.x *= 0.85; touched = true; tone(160, 0.1, 'triangle', 0.14, 0.7); board.scale.set(1.02, 1.02, 1);
  }
  // floor
  if (p.y < BALL_R) { p.y = BALL_R; if (vel.y < -0.6) { floorHits++; tone(120, 0.08, 'sine', Math.min(0.18, -vel.y * 0.03), 0.6); } vel.y = -vel.y * 0.62; vel.x *= 0.92; vel.z *= 0.92; }
}
const _tmp = new THREE.Vector3();
function stepBall(dt) {
  const sub = 5, h = dt / 60 / sub;
  for (let i = 0; i < sub; i++) {
    prevB.copy(ball.position);
    vel.y -= G * h; ball.position.addScaledVector(vel, h); flyT += h;
    collide();
    // through the hoop: crossing rim height downward, inside the ring
    if (!scored && prevB.y >= RIM.y && ball.position.y < RIM.y && vel.y < 0) {
      const r = Math.hypot(ball.position.x - RIM.x, ball.position.z - RIM.z);
      if (r < RIM_R - BALL_R * 0.25) onScore();
    }
  }
  ball.rotation.x -= 0.25 * dt; ball.rotation.z += vel.x * 0.02 * dt;
}

// ---------------------------------------------------------------- input
input({
  onDown: () => { if (state === 'play' && phase === 'aim' && hero.position.distanceTo(heroTargetP) < 0.15) { charging = true; m = 0; mDir = 1; tone(220, 0.08, 'sine', 0.08, 1.4); } },
  onUp: () => { if (state === 'play' && charging) shoot(); },
});
ui.onTap((which) => {
  if (which === 'win' || which === 'lose' || which === 'start') { buildLevel(); state = 'play'; ui.els.sc.classList.remove('hc-hidden'); }
});

// ---------------------------------------------------------------- loop
const fireCols = ['#ff7a2f', '#ffd23f', '#ff3d3d'];
let fireTick = 0;
loop((dt, t) => {
  // meter ping-pong while held
  if (charging) {
    m += mDir * mSpeed * dt / 60;
    if (m >= 1) { m = 1; mDir = -1; } else if (m <= 0) { m = 0; mDir = 1; }
    crouch = lerp(crouch, 1, 0.15 * dt);
    if (Math.floor(t * 12) !== Math.floor((t - dt / 60) * 12)) tone(300 + m * 500, 0.03, 'sine', 0.04, 1);
    updateMeter();
  } else crouch = lerp(crouch, 0, 0.2 * dt);

  // hero walks to the next spot, always faces the hoop
  hero.position.lerp(heroTargetP, 0.16 * dt);
  if (phase === 'aim') shooterP.copy(hero.position);
  fwd.set(RIM.x - shooterP.x, 0, RIM.z - shooterP.z).normalize();
  hero.rotation.y = Math.atan2(-fwd.x, -fwd.z);
  // jump
  jump += jumpV * dt; jumpV -= 0.006 * dt; if (jump < 0) { jump = 0; jumpV = 0; }
  const walking = hero.position.distanceTo(heroTargetP) > 0.05;
  hero.position.y = jump;
  hero.torso.position.y = 1.32 - crouch * 0.12; hero.head.position.y = 1.92 - crouch * 0.12; hero.hatParts.forEach((h, i) => h.position.y = [2.07, 1.98, 2.0][i] - crouch * 0.12);
  hero.scale.set(1 + crouch * 0.05, 1 - crouch * 0.06 + (jumpV > 0 ? 0.04 : 0), 1 + crouch * 0.05);
  const armUp = phase === 'aim' ? -2.6 - crouch * 0.2 : (flyT < 0.6 ? -3.0 : lerp(hero.armL.rotation.x, 0, 0.1));
  hero.armL.rotation.x = lerp(hero.armL.rotation.x, armUp, 0.25 * dt); hero.armR.rotation.x = hero.armL.rotation.x;
  hero.armL.rotation.z = -0.25; hero.armR.rotation.z = 0.25;
  const leg = walking ? Math.sin(t * 14) * 0.6 : crouch * 0.35;
  hero.legL.rotation.x = walking ? leg : -leg; hero.legR.rotation.x = walking ? -leg : -leg;
  blob.position.set(hero.position.x, 0.01, hero.position.z); blob.scale.setScalar(1 - jump * 0.6);

  // ball
  if (state !== 'ready' && phase === 'aim') { heldBallPos(ball.position); ball.rotation.y += 0.02 * dt; }
  else if (phase === 'fly') {
    stepBall(dt);
    resolveT += dt / 60;
    const done = floorHits >= 1 && resolveT > 0.9 || resolveT > 2.6 || (ball.position.y < 1.2 && resolveT > 1.1 && !scored) || (scored && resolveT > 0.75);
    if (done) {
      phase = 'wait'; onMissResolved();
      if (state === 'play') {
        if (levelDone) win();
        else if (ballsLeft <= 0) lose();
        else setTimeout(() => { if (state === 'play') nextShot(false); }, 120);
      }
    }
  } else if (phase === 'wait') { stepBall(dt); }
  if (state === 'ready') { heldBallPos(ball.position); }
  // fire trail
  const flying = phase === 'fly';
  ballMat.emissive.set(fire ? '#ff3a00' : '#000000'); ballMat.emissiveIntensity = fire ? 0.45 + Math.sin(t * 20) * 0.15 : 0;
  trail.forEach((tm, i) => { tm.visible = flying && flyT > 0.04; if (i === 0) tm.position.lerp(ball.position, 0.6); else tm.position.lerp(trail[i - 1].position, 0.55); tm.material.opacity = (fire ? 0.6 : 0.28) * (1 - i / trail.length); tm.material.color.set(fire ? fireCols[i % 3] : '#ffffff'); });
  if (fire && flying && (fireTick += dt) > 3) { fireTick = 0; burst(scene, ball.position.clone(), fireCols, 3, { speed: 0.02, up: 0.02, size: 0.5, gravity: -0.002, life: 0.6 }); }

  // net + board wobble
  netKick = Math.max(0, netKick - dt * 0.05);
  net.scale.set(1 - netKick * 0.25, 1 + Math.sin(netKick * 12) * 0.25 * netKick + netKick * 0.3, 1 - netKick * 0.25);
  netPivot.rotation.x = Math.sin(t * 9) * 0.06 * netKick;
  board.scale.lerp(_tmp.set(1, 1, 1), 0.15);

  // camera: behind and above the shooter, framing the hoop
  const back = _tmp.copy(fwd).negate();
  const want = new THREE.Vector3().copy(shooterP).addScaledVector(back, 4.6).add(new THREE.Vector3(0, 3.5, 0)).addScaledVector(new THREE.Vector3(-fwd.z, 0, fwd.x), 0.7);
  const look = new THREE.Vector3().copy(RIM).lerp(shooterP, 0.38); look.y = 2.25;
  if (flying && ball.position.y > RIM.y) look.y += (ball.position.y - RIM.y) * 0.18;
  camPos.lerp(want, 0.06 * dt); camLook.lerp(look, 0.08 * dt);
  shake = Math.max(0, shake - dt * 0.006);
  camera.position.set(camPos.x + (Math.random() - 0.5) * shake, camPos.y + (Math.random() - 0.5) * shake, camPos.z);
  camera.lookAt(camLook);
  stage.followLight(new THREE.Vector3(shooterP.x * 0.5, 0, shooterP.z * 0.5));
});

applyTheme(THEMES[(level - 1) % THEMES.length]);
heroTargetP.set(0, 0, 4.6); hero.position.copy(heroTargetP); shooterP.copy(heroTargetP);
camPos.set(0, 3.1, 8); ui.levels(level); ui.start(); ui.els.sc.classList.add('hc-hidden');

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play' || phase !== 'aim' || botPending) return;
    if (!charging) { if (hero.position.distanceTo(heroTargetP) < 0.15) { charging = true; m = 0; mDir = 1; } return; }
    // release when the rising/falling tick reaches the zone centre (with a little human error)
    const aim = zoneC + (Math.random() - 0.5) * zoneW * (Math.random() < 0.2 ? 2.6 : 0.8);
    const v = mSpeed / 1000;   // meter units per ms
    let tms = mDir > 0 ? (aim >= m ? (aim - m) / v : (1 - m + 1 - aim) / v) : (aim <= m ? (m - aim) / v : (m + aim) / v);
    if (tms < 140) { botPending = true; setTimeout(() => { botPending = false; if (charging) shoot(); }, Math.max(0, tms)); }
  },
};
