// Noggin Cup — original 1v1 side-view soccer with big-noggin players. Drag to run, tap to jump and kick.
// 60 second matches (or first to N goals) against a CPU rival that plays by the same physics.
import { THREE, createStage, createUI, input, loop, store, mat, glossy, rounded, burst, confetti, sfx, tone, buzz, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import * as world from './kit/board.js';           // `board` is taken here

const NAME = 'Noggin Cup: 1v1 Soccer';
const S = store('noggincup');
const F = flow('noggincup');
let level = S.get('level', 1), best = S.get('best', 0);

const stage = createStage({ fov: 40, shadowSize: 12 });
const { scene, camera, sun } = stage;
const ui = createUI({ title: 'NOGGIN<br>CUP', hint: 'Tap the ball to run and kick · or drag to run', hand: '👆', progress: true, score: false });
const D = daily('noggincup', ui, { name: NAME });
const WB = world.board({ game: 'noggin-cup', label: 'Matches won', limits: { maxRun: 1, maxPerSec: 0.2 }, mode: 'sum' });
const boardEl = document.getElementById('board'), powerEl = document.getElementById('power');
ui.els.top.style.top = 'calc(66px + env(safe-area-inset-top))';
const TAU = Math.PI * 2;

const FW = 7.2, GD = 1.3, GH = 2.6, BR = 0.36, HR = 0.6, MATCH = 60;
const THEMES = [
  { bg: ['#86c8ff', '#ffe3c9'], grass: ['#7ed36b', '#6cc55c'], ui: '#ff5d8f', stand: '#5a6fd6' },
  { bg: ['#ffa8c5', '#ffe9c4'], grass: ['#8edb7a', '#7bcc68'], ui: '#7b5cff', stand: '#d65a8a' },
  { bg: ['#7fd9d0', '#fff1c9'], grass: ['#93d96a', '#82cc59'], ui: '#ff8c42', stand: '#2f9e8f' },
  { bg: ['#b9a6ff', '#ffd9ec'], grass: ['#79d18a', '#68c47a'], ui: '#00a6fb', stand: '#7b5cff' },
];
const KITS = [
  { shirt: '#ff5d8f', shorts: '#ffffff', boot: '#ffd23f', hair: '#3b2a20', skin: '#ffd2b0', style: 'spike' },
  { shirt: '#3a86ff', shorts: '#1b263b', boot: '#ff6b6b', hair: '#ffcf4a', skin: '#f4c39c', style: 'bowl' },
  { shirt: '#22c39a', shorts: '#ffffff', boot: '#ff8c42', hair: '#7a3b1e', skin: '#c98d62', style: 'puff' },
  { shirt: '#ffb703', shorts: '#3d3a4b', boot: '#3a86ff', hair: '#222222', skin: '#ffe0c4', style: 'band' },
  { shirt: '#9b5de5', shorts: '#ffffff', boot: '#00f5d4', hair: '#e85d75', skin: '#e8b48c', style: 'spike' },
  { shirt: '#ffffff', shorts: '#073b4c', boot: '#ffd166', hair: '#2b2d42', skin: '#8d5a3b', style: 'puff' },
];

// ---------------------------------------------------------------- stadium
function canvasTex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); } return t;
}
const pitchMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
const pitch = new THREE.Mesh(new THREE.BoxGeometry(FW * 2 + 8, 0.4, 13), pitchMat); pitch.position.set(0, -0.2, 1);
const apron = new THREE.Mesh(new THREE.BoxGeometry(FW * 2 + 40, 0.4, 30), mat('#5fb653', { roughness: 0.95 })); apron.position.set(0, -0.22, 10); apron.receiveShadow = true; scene.add(apron); pitch.receiveShadow = true; scene.add(pitch);
function pitchTex(t) {
  return canvasTex(1024, 256, (g, w, h) => {
    const n = 12; for (let i = 0; i < n; i++) for (let j = 0; j < 4; j++) { g.fillStyle = t.grass[(i + j) % 2]; g.fillRect(i * w / n, j * h / 4, w / n + 1, h / 4 + 1); }
    const sx = w / (FW * 2 + 8), cx = w / 2, zf = (z) => (z + 5.5) / 13 * h;   // world → texture
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(cx, zf(-2.6)); g.lineTo(cx, zf(2.4)); g.stroke();
    g.beginPath(); g.ellipse(cx, zf(-0.1), 1.6 * sx, (zf(2.4) - zf(-2.6)) * 0.3, 0, 0, TAU); g.stroke();
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(cx + s * FW * sx, zf(-2.6)); g.lineTo(cx + s * FW * sx, zf(2.4)); g.stroke();
      g.beginPath(); g.moveTo(cx + s * FW * sx, zf(-1.8)); g.lineTo(cx + s * (FW - 2.4) * sx, zf(-1.8)); g.lineTo(cx + s * (FW - 2.4) * sx, zf(1.6)); g.lineTo(cx + s * FW * sx, zf(1.6)); g.stroke();
    }
    g.beginPath(); g.moveTo(cx - FW * sx, zf(-2.6)); g.lineTo(cx + FW * sx, zf(-2.6)); g.moveTo(cx - FW * sx, zf(2.4)); g.lineTo(cx + FW * sx, zf(2.4)); g.stroke();
    for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`; g.fillRect(Math.random() * w, Math.random() * h, 3, 1); }
  });
}
// stands with an instanced, bobbing crowd
const standMat = mat('#5a6fd6', { roughness: 0.8 });
const STEPS = 6;
for (let i = 0; i < STEPS; i++) { const st = new THREE.Mesh(new THREE.BoxGeometry(FW * 2 + 30, 0.9, 1.4), standMat); st.position.set(0, 0.5 + i * 0.9, -6.8 - i * 1.3); st.receiveShadow = true; scene.add(st); }
const roof = new THREE.Mesh(new THREE.BoxGeometry(FW * 2 + 40, 0.5, 10), mat('#ffffff')); roof.position.set(0, 7.9, -11.5); scene.add(roof);
const roofEdge = new THREE.Mesh(new THREE.BoxGeometry(FW * 2 + 40, 0.5, 0.3), mat('#ffd23f')); roofEdge.position.set(0, 7.9, -6.4); scene.add(roofEdge);
const CROWD = 260, crowd = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.2, 0.3, 4, 8), mat('#ffffff'), CROWD), crowdData = [];
const crowdHeads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 10, 8), mat('#ffd2b0'), CROWD);
{ const R = rng(5); for (let i = 0; i < CROWD; i++) { const row = i % STEPS; crowdData.push({ x: -22 + R() * 44, y: 1.3 + row * 0.9, z: -6.9 - row * 1.3, ph: R() * 6 }); } }
scene.add(crowd, crowdHeads);
const CC = ['#ff5d8f', '#ffd23f', '#ffffff', '#3ab795', '#74c0fc', '#ff8c42', '#b197fc'], SK = ['#ffd2b0', '#f4c39c', '#c98d62', '#8d5a3b', '#ffe0c4'];
{ const c = new THREE.Color(); for (let i = 0; i < CROWD; i++) { crowd.setColorAt(i, c.set(CC[i % CC.length])); crowdHeads.setColorAt(i, c.set(SK[(i * 7) % SK.length])); } }
// pastel boards along the back of the pitch
const boardTex = canvasTex(1024, 64, (g, w, h) => {
  const cols = ['#ff5d8f', '#ffd23f', '#3ab795', '#7b5cff'];
  for (let i = 0; i < 8; i++) { g.fillStyle = cols[i % 4]; g.fillRect(i * w / 8, 0, w / 8, h); g.fillStyle = '#fff'; g.font = '800 34px system-ui'; g.textAlign = 'center'; g.fillText(i % 2 ? '★ ★ ★' : 'NOGGIN CUP', i * w / 8 + w / 16, 45); }
});
boardTex.wrapS = THREE.RepeatWrapping; boardTex.repeat.set(2, 1);
const boards = new THREE.Mesh(new THREE.BoxGeometry(FW * 2 + 14, 0.7, 0.2), new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.6, emissive: '#ffffff', emissiveIntensity: 0.15, emissiveMap: boardTex }));
boards.position.set(0, 0.35, -4.9); scene.add(boards);
// floodlights
for (const s of [-1, 1]) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 10, 8), mat('#e8e8f0')); pole.position.set(s * 16, 5, -10); scene.add(pole);
  const lamp = new THREE.Mesh(rounded(2.6, 1.4, 0.4, 0.1), mat('#ffffff', { emissive: '#fff6c8', emissiveIntensity: 0.9 })); lamp.position.set(s * 16, 10.2, -9.8); lamp.rotation.x = 0.3; scene.add(lamp);
}
// goals
function makeGoal(s) {
  const g = new THREE.Group(), w = mat('#ffffff'), r = 0.08;
  const netTex = canvasTex(128, 128, (c, W, H) => { c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 3; for (let i = 0; i <= 8; i++) { c.beginPath(); c.moveTo(i * W / 8, 0); c.lineTo(i * W / 8, H); c.stroke(); c.beginPath(); c.moveTo(0, i * H / 8); c.lineTo(W, i * H / 8); c.stroke(); } }, [4, 4]);
  const netM = new THREE.MeshBasicMaterial({ map: netTex, transparent: true, side: THREE.DoubleSide, depthWrite: false });
  for (const z of [-1.7, 1.5]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(r, r, GH, 10), w); post.position.set(s * FW, GH / 2, z); post.castShadow = true; g.add(post);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(r, r, GD, 8), w); bar.rotation.z = Math.PI / 2; bar.position.set(s * (FW + GD / 2), GH, z); g.add(bar);
    const back = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r * 0.7, GH, 8), w); back.position.set(s * (FW + GD), GH / 2, z); g.add(back);
  }
  const cross = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.4, r * 1.4, 3.2, 10), w); cross.rotation.x = Math.PI / 2; cross.position.set(s * FW, GH, -0.1); cross.castShadow = true; g.add(cross);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(GD, 3.2), netM); top.rotation.x = -Math.PI / 2; top.position.set(s * (FW + GD / 2), GH, -0.1); g.add(top);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(3.2, GH), netM); back.rotation.y = Math.PI / 2; back.position.set(s * (FW + GD), GH / 2, -0.1); g.add(back);
  const side = new THREE.Mesh(new THREE.PlaneGeometry(GD, GH), netM); side.position.set(s * (FW + GD / 2), GH / 2, -1.7); g.add(side);
  g.net = back; scene.add(g); return g;
}
const goals = [makeGoal(-1), makeGoal(1)];

// ---------------------------------------------------------------- characters (original big-noggin players)
function makePlayer(kit, face) {
  const g = new THREE.Group(), skin = mat(kit.skin), shirt = mat(kit.shirt), shorts = mat(kit.shorts), boot = glossy(kit.boot), hairM = mat(kit.hair), dark = mat('#1f1f2b');
  const inner = new THREE.Group(); g.add(inner);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.24, 6, 12), shirt); body.position.y = 0.62; body.castShadow = true;
  const pants = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.24, 0.2, 12), shorts); pants.position.y = 0.4; pants.castShadow = true;
  inner.add(body, pants);
  const head = new THREE.Group(); head.position.y = 1.32; inner.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(HR, 28, 20), skin); skull.castShadow = true; head.add(skull);
  // hair styles
  if (kit.style === 'spike') { for (let i = 0; i < 7; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.42, 6), hairM); const a = -1.1 + i * 0.37; c.position.set(Math.sin(a) * 0.5 - face * 0.1, Math.cos(a) * 0.5 + 0.05, 0); c.rotation.z = -a; head.add(c); } const cap = new THREE.Mesh(new THREE.SphereGeometry(HR * 1.02, 24, 12, 0, TAU, 0, 1.0), hairM); cap.rotation.z = face * 0.35; head.add(cap); }
  else if (kit.style === 'bowl') { const cap = new THREE.Mesh(new THREE.SphereGeometry(HR * 1.06, 24, 14, 0, TAU, 0, 1.45), hairM); cap.rotation.z = face * 0.25; head.add(cap); }
  else if (kit.style === 'puff') { for (let i = 0; i < 9; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), hairM); const a = -1.5 + i * 0.37; b.position.set(Math.sin(a) * 0.55 - face * 0.12, Math.cos(a) * 0.5 + 0.1, (i % 2 - 0.5) * 0.2); head.add(b); } }
  else { const cap = new THREE.Mesh(new THREE.SphereGeometry(HR * 1.03, 24, 12, 0, TAU, 0, 1.1), hairM); head.add(cap); const band = new THREE.Mesh(new THREE.TorusGeometry(HR * 0.93, 0.07, 6, 28), mat('#ffffff')); band.rotation.x = Math.PI / 2; band.position.y = 0.2; head.add(band); }
  // face looks toward the camera and the direction of play
  const eyes = new THREE.Group(); head.add(eyes);
  for (const dx of [-0.2, 0.2]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), mat('#ffffff')); e.position.set(dx, 0.08, 0.5); e.scale.z = 0.6;
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), dark); p.position.set(dx + face * 0.05, 0.07, 0.6);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.06), hairM); brow.position.set(dx, 0.28, 0.54); brow.rotation.z = (dx > 0 ? -1 : 1) * 0.18 * face;
    eyes.add(e, p, brow);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 6, 14, Math.PI), dark); mouth.rotation.z = Math.PI; mouth.position.set(face * 0.06, -0.22, 0.55); eyes.add(mouth);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), skin); nose.position.set(face * 0.08, -0.04, 0.6); eyes.add(nose);
  eyes.rotation.y = face * 0.45;
  // legs: back leg + the kicking leg with a big boot
  const leg = (z, kick) => {
    const piv = new THREE.Group(); piv.position.set(0, 0.36, z); inner.add(piv);
    const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.16, 4, 8), skin); l.position.y = -0.14; piv.add(l);
    const b = new THREE.Mesh(rounded(kick ? 0.46 : 0.36, 0.2, 0.22, 0.08), kick ? boot : dark); b.position.set(face * 0.08, -0.3, 0); b.castShadow = true; piv.add(b);
    return piv;
  };
  g.back = leg(-0.12, false); g.kickLeg = leg(0.14, true);
  g.head = head; g.inner = inner; g.mouth = mouth; g.face = face;
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.6, 20), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.18, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.02; scene.add(blob); g.blob = blob;
  scene.add(g); return g;
}
// ball
const ballTex = canvasTex(256, 128, (g, w, h) => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
  const cols = ['#ff5d8f', '#2b2d42', '#ffd23f'];
  for (let i = 0; i < 10; i++) { const x = (i % 5) * w / 5 + (i > 4 ? w / 10 : 0), y = i > 4 ? h * 0.72 : h * 0.3; g.fillStyle = cols[i % 3 === 2 ? 1 : 1]; g.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * TAU - Math.PI / 2; g.lineTo(x + Math.cos(a) * 15, y + Math.sin(a) * 15 * 0.9); } g.fill(); }
  g.fillStyle = '#ff5d8f'; g.fillRect(0, h * 0.48, w, 6);
});
const ball = new THREE.Mesh(new THREE.SphereGeometry(BR, 28, 20), new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.35, emissive: '#ff5a00', emissiveIntensity: 0 }));
ball.castShadow = true; scene.add(ball);
const ballBlob = new THREE.Mesh(new THREE.CircleGeometry(BR * 1.1, 18), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.2, depthWrite: false }));
ballBlob.rotation.x = -Math.PI / 2; ballBlob.position.y = 0.02; scene.add(ballBlob);
const trailM = new THREE.MeshBasicMaterial({ color: '#ffb000', transparent: true, opacity: 0.5, depthWrite: false });
const trail = []; for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(BR * (1 - i * 0.07), 10, 8), trailM.clone()); m.visible = false; scene.add(m); trail.push(m); }

// ---------------------------------------------------------------- match state
let state = 'ready', score = 0, R = rng(1), recorded = false, beatShown = false;
let phase = 'kickoff', phaseT = 0, clock = MATCH, goalsP = 0, goalsC = 0, goalLimit = 2, golden = false, slow = 1, shake = 0, totalScore = 0;
let pl, cpu, pk = null, ck = null;
const B = { x: 0, y: 5, vx: 0, vy: 0, spin: 0, fire: 0, last: null };
function newActor(g, x, face) { return { g, x, y: 0, vx: 0, vy: 0, face, kickT: 0, kicked: false, power: 0, stun: 0, ground: true, squash: 1 }; }
let ai = { tx: 3, think: 0, speed: 0.7, react: 0.3, jumpSkill: 0.5, kickSkill: 0.6 };

function updateBoard() {
  const m = Math.max(0, Math.ceil(clock)), mm = golden ? 'GOLDEN' : `0:${String(m).padStart(2, '0')}`;
  boardEl.innerHTML = `<div class="n">YOU</div><div class="t">${goalsP}</div><div class="clk">${mm}</div><div class="t">${goalsC}</div><div class="n">RIVAL</div>`;
}
function updatePower() { powerEl.firstChild.style.width = Math.min(1, pl.power) * 100 + '%'; powerEl.classList.toggle('full', pl.power >= 1); powerEl.lastChild.textContent = pl.power >= 1 ? 'POWER SHOT READY' : 'POWER'; }

function resetPositions() {
  pl.x = -3.2; pl.y = 0; pl.vx = pl.vy = 0; cpu.x = 3.2; cpu.y = 0; cpu.vx = cpu.vy = 0; pl.stun = cpu.stun = 0;
  B.x = 0; B.y = 5.2; B.vx = (R() - 0.5) * 1.2; B.vy = 0; B.fire = 0; B.spin = 0;
  phase = 'kickoff'; phaseT = 0.6; tapX = null;
}
function buildLevel() {
  const t = THEMES[(level - 1) % THEMES.length];
  document.body.style.setProperty('--bg1', t.bg[0]); document.body.style.setProperty('--bg2', t.bg[1]); document.body.style.setProperty('--ui', t.ui);
  if (pitchMat.map) pitchMat.map.dispose(); pitchMat.map = pitchTex(t); pitchMat.needsUpdate = true; standMat.color.set(t.stand);
  R = rng((D.seed || level * 104729) + 17);
  if (pk) { scene.remove(pk.g, pk.g.blob); scene.remove(ck.g, ck.g.blob); }
  const pKit = KITS[0], cKit = KITS[1 + Math.floor(R() * (KITS.length - 1))];
  pk = newActor(makePlayer(pKit, 1), -3.2, 1); ck = newActor(makePlayer(cKit, -1), 3.2, -1);
  pl = pk; cpu = ck;
  const fk = F.k();
  ai.speed = clamp((0.52 + level * 0.045) * fk, 0.45, 1.02);
  ai.react = clamp((0.42 - level * 0.022) / fk, 0.08, 0.48);
  ai.jumpSkill = clamp(0.35 + level * 0.05, 0.3, 0.9);
  ai.kickSkill = clamp(0.36 + level * 0.06, 0.3, 0.95);
  goalLimit = level <= 2 ? 2 : 3;
  goalsP = goalsC = 0; clock = MATCH; golden = false; score = 0; recorded = false; beatShown = false; totalScore = 0;
  pl.power = 0; cpu.power = 0;
  ui.levels(level); ui.progress(0); ui.sub(''); updateBoard(); updatePower();
  resetPositions();
}

// ---------------------------------------------------------------- controls
let dragX = null, botTarget = null, tapX = null, tapEnd = 0;   // tapX: a tap away from you = run there, then jump-kick
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), _v2 = new THREE.Vector2(), _hit = new THREE.Vector3();
function worldX(cx, cy) { _v2.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(_v2, camera); return ray.ray.intersectPlane(plane, _hit) ? _hit.x : null; }
function action(a) {
  if (state !== 'play' || a.stun > 0) return;
  const lowBall = Math.abs(B.x - a.x) < 1.5 && B.y < 1.3;
  if (a.ground && !lowBall) { a.vy = 9.2; a.ground = false; a.squash = 0.75; if (a === pl) tone(420, 0.08, 'sine', 0.08, 1.6); }
  if (a.kickT <= 0) { a.kickT = 0.28; a.kicked = false; }
}
input({
  onDown: (e, st) => { if (state !== 'play') return; st.drag = false; tapX = null; dragX = worldX(e.clientX, e.clientY); },
  onMove: (dx, dy, e, st) => { if (state !== 'play') return; if (!st.drag && (Math.abs(st.lx - st.x) > 12 || performance.now() - st.t > 160)) st.drag = true; if (st.drag) dragX = worldX(st.lx, st.ly); },
  onUp: (e, st) => { if (state !== 'play') { dragX = null; return; } if (!st.drag && performance.now() - st.t < 260) { const x = worldX(e.clientX, e.clientY); if (x !== null && Math.abs(x - pl.x) > 1.2) { tapX = clamp(x, -FW, FW); tapEnd = performance.now() + 1500; } else action(pl); } dragX = null; },
});

// ---------------------------------------------------------------- physics
const G_P = 24, G_B = 13.5;
function moveActor(a, target, maxSp, dt) {
  let want = 0;
  if (target !== null && a.stun <= 0) { const d = target - a.x; if (Math.abs(d) > 0.18) want = Math.sign(d) * maxSp * Math.min(1, Math.abs(d) / 0.7); }
  a.vx = lerp(a.vx, want, Math.min(1, dt * (a.ground ? 14 : 6)));
  a.vy -= G_P * dt; a.x += a.vx * dt; a.y += a.vy * dt;
  if (a.y <= 0) { if (!a.ground && a.vy < -4) a.squash = 0.8; a.y = 0; a.vy = 0; a.ground = true; }
  a.x = clamp(a.x, -FW - 0.4, FW + 0.4);
  a.kickT = Math.max(0, a.kickT - dt); a.stun = Math.max(0, a.stun - dt);
}
function footPos(a) { const k = a.kickT > 0 ? Math.sin((1 - a.kickT / 0.28) * Math.PI) : 0; return { x: a.x + a.face * (0.35 + k * 0.35), y: a.y + 0.18 + k * 0.45 }; }
function touch(a, kind) {
  B.last = a;
  a.power = Math.min(1, a.power + (kind === 'kick' ? 0.14 : 0.09));
  if (a === pl) { updatePower(); totalScore += 1; }
}
function collideHead(a) {
  const hx = a.x, hy = a.y + 1.32, dx = B.x - hx, dy = B.y - hy, d = Math.hypot(dx, dy), min = BR + HR;
  if (d < min && d > 0.0001) {
    const nx = dx / d, ny = dy / d; B.x = hx + nx * min; B.y = hy + ny * min;
    const rvx = B.vx - a.vx, rvy = B.vy - a.vy, vn = rvx * nx + rvy * ny;
    if (vn < 0) {
      const e = 0.82; B.vx -= (1 + e) * vn * nx; B.vy -= (1 + e) * vn * ny;
      B.vx += a.vx * 0.35 + a.face * (a.ground ? 0.4 : 2.2); B.vy += Math.max(0, a.vy) * 0.3 + (a.ground ? 0 : 1.2);
      if (B.fire > 0 && B.last !== a) { a.stun = 1.1; a.vx = -a.face * 3; shake = 0.4; ui.pop('DAZED!', '#fff', 30, 34); sfx.smash(); B.fire = 0; }
      if (Math.abs(vn) > 2) { tone(300 + Math.random() * 60, 0.07, 'sine', 0.12, 0.7); a.squash = 0.85; if (a === pl) buzz(10); }
      touch(a, 'head');
    }
  }
  // body: a smaller circle at the torso
  const bx = a.x, by = a.y + 0.55, ex = B.x - bx, ey = B.y - by, e2 = Math.hypot(ex, ey), m2 = BR + 0.32;
  if (e2 < m2 && e2 > 0.0001) { const nx = ex / e2, ny = ey / e2; B.x = bx + nx * m2; B.y = by + ny * m2; const vn = (B.vx - a.vx) * nx + (B.vy - a.vy) * ny; if (vn < 0) { B.vx -= 1.6 * vn * nx; B.vy -= 1.6 * vn * ny; } }
}
function tryKick(a) {
  if (a.kickT <= 0 || a.kicked || a.stun > 0) return;
  const f = footPos(a), d = Math.hypot(B.x - f.x, B.y - f.y);
  const front = (B.x - a.x) * a.face > -0.25;
  if (d < BR + 0.55 && front) {
    a.kicked = true;
    if (a.power >= 1) {
      a.power = 0; B.fire = 1.1; B.vx = a.face * 17; B.vy = clamp((GH * 0.55 - B.y) * 2.2, -3, 5) + 1.5;
      shake = 0.5; ui.flash(0.35); sfx.smash(); buzz([20, 30, 40]); ui.pop(a === pl ? 'POWER SHOT!' : 'RIVAL POWER!', '#ffd23f', 40, 30);
      burst(scene, new THREE.Vector3(B.x, B.y, 0), ['#ffd23f', '#ff7b2e', '#ffffff'], 18, { speed: 0.12, up: 0.08, shape: 'sphere' });
      if (a === pl) updatePower();
    } else {
      const dist = Math.abs(a.face * FW - B.x);
      const lift = a.ground ? clamp(dist * 0.62, 3.2, 7) : 2.6;
      B.vx = a.face * (8.6 + Math.abs(a.vx) * 0.25); B.vy = lift;
      tone(180, 0.1, 'triangle', 0.16, 0.6); if (a === pl) buzz(15);
      touch(a, 'kick');
    }
    burst(scene, new THREE.Vector3(B.x, B.y, 0.2), ['#ffffff', '#fff3b0'], 8, { speed: 0.08, up: 0.06, size: 0.6, shape: 'sphere' });
  }
}
function ballStep(dt) {
  B.fire = Math.max(0, B.fire - dt);
  B.vy -= G_B * dt * (B.fire > 0 ? 0.15 : 1);
  B.x += B.vx * dt; B.y += B.vy * dt; B.spin += B.vx * dt / BR;
  // ground
  if (B.y < BR) { B.y = BR; if (B.vy < -1.5) tone(140, 0.05, 'sine', 0.06, 0.8); B.vy = Math.abs(B.vy) * 0.68; if (B.vy < 0.6) B.vy = 0; B.vx *= 0.985; }
  if (B.y <= BR + 0.01) B.vx *= Math.pow(0.6, dt);
  // ceiling
  if (B.y > 10) { B.y = 10; B.vy = -Math.abs(B.vy) * 0.6; }
  for (const s of [-1, 1]) {
    // crossbar (a thick horizontal bar from the goal line to the back of the net)
    const x0 = s > 0 ? FW - 0.1 : -FW - GD, x1 = s > 0 ? FW + GD : -FW + 0.1;
    const cx = clamp(B.x, x0, x1), cy = GH, dx = B.x - cx, dy = B.y - cy, d = Math.hypot(dx, dy);
    if (d < BR + 0.1 && d > 0.0001) { const nx = dx / d, ny = dy / d; B.x = cx + nx * (BR + 0.1); B.y = cy + ny * (BR + 0.1); const vn = B.vx * nx + B.vy * ny; if (vn < 0) { B.vx -= 1.7 * vn * nx; B.vy -= 1.7 * vn * ny; if (Math.abs(vn) > 2) { tone(900, 0.12, 'triangle', 0.1, 0.9); ui.pop('CROSSBAR!', '#fff', 28, 36); } } }
    // back walls (stadium) above the goal and the net's back
    if (s * B.x > FW + GD - BR) { B.x = s * (FW + GD - BR); B.vx = -B.vx * (B.y < GH ? 0.15 : 0.6); if (B.y < GH) goals[s > 0 ? 1 : 0].net.scale.x = 1.4; }
  }
}
function goalCheck() {
  if (phase !== 'live') return;
  for (const s of [-1, 1]) if (s * B.x > FW + BR * 0.8 && B.y < GH) { scored(s > 0 ? 'p' : 'c', s); return; }
}
function scored(who, s) {
  phase = 'goal'; phaseT = 1.8; slow = 0.35;
  const pos = new THREE.Vector3(s * (FW + 0.6), 1.4, 0);
  if (who === 'p') {
    goalsP++; totalScore += 10 + (B.fire > 0 ? 5 : 0); score = totalScore; checkBeat();
    ui.pop('GOAL!', getComputedStyle(document.body).getPropertyValue('--ui') || '#ff5d8f', 76, 30); confetti(scene, pos, 90); sfx.win(); buzz([30, 40, 60]); ui.flash(0.5); shake = 0.6;
    pl.vy = 7; pl.ground = false;
  } else {
    goalsC++; ui.pop('RIVAL SCORES', '#fff', 40, 30); sfx.fail(); buzz(60); shake = 0.3;
    burst(scene, pos, ['#ffffff', '#cccccc'], 20, { speed: 0.1, up: 0.1, shape: 'sphere' });
  }
  updateBoard(); ui.progress(goalsP / goalLimit);
}

function checkBeat() {
  if (score > best) { best = score; S.set('best', best); }
  if (!beatShown && D.beaten(score)) { beatShown = true; setTimeout(() => { ui.pop('BEATEN!', '#fff36b', 44, 44); confetti(scene, new THREE.Vector3(pl.x, 3, 0), 60); }, 900); }
}
function endMatch() {
  if (state !== 'play') return;
  if (goalsP > goalsC) {
    state = 'won'; if (!recorded) { recorded = true; F.level(true); }
    score = totalScore + Math.max(0, Math.ceil(clock)) + (goalsP - goalsC) * 10; checkBeat();
    level++; S.set('level', level);
    confetti(scene, new THREE.Vector3(pl.x, 3, 0), 120); sfx.win(); buzz([20, 40, 20, 40, 60]);
    D.won(score); WB.submit(1);                            // world board: matches won vs the CPU today
    ui.win(level - 1, `${goalsP} – ${goalsC} · ${score} pts`);
  } else {
    state = 'lost'; if (!recorded) { recorded = true; F.level(false, clamp(goalsP / goalLimit, 0, 1)); }
    sfx.fail(); ui.lose(goalsP === goalsC ? 'DRAW!' : 'FULL TIME', `${goalsP} – ${goalsC} · first to score wins in golden time`);
  }
  powerEl.style.display = 'none';
}
ui.onTap(() => { buildLevel(); state = 'play'; WB.start(); powerEl.style.display = ''; });

// ---------------------------------------------------------------- CPU brain (same physics, reaction delay, imperfect choices)
function brain(me, foe, goalSide, dt, skill) {
  // goalSide: +1 = defends the right goal (attacks left)
  skill.think -= dt;
  const attackDir = -goalSide;
  if (skill.think <= 0) {
    skill.think = skill.react * (0.7 + Math.random() * 0.6);
    const lead = B.x + B.vx * 0.25;
    const ballOnMyHalf = (B.x * goalSide) > 0;
    // stand behind the ball (between ball and own goal), a bit closer when it is coming at our goal
    let tx = lead - attackDir * (0.55 + (ballOnMyHalf ? 0.2 : 0.4));
    if (B.vx * goalSide > 6 && ballOnMyHalf) tx = goalSide * (FW - 0.9);         // fast shot coming: retreat to the line
    skill.tx = clamp(tx, -FW + 0.2, FW - 0.2);
    // jump for high balls coming close
    const dx = B.x - me.x;
    if (me.ground && B.y > 1.7 && B.y < 4.2 && Math.abs(dx) < 1.5 && B.vy < 2 && Math.random() < skill.jumpSkill) action(me);
    // kick when the ball is in front and low
    else if (dx * attackDir > -0.1 && Math.abs(dx) < 1.15 && B.y < 1.4 && Math.random() < skill.kickSkill) action(me);
  }
  return skill.tx;
}
const botSkill = { think: 0, react: 0.1, jumpSkill: 0.85, kickSkill: 0.95, tx: -3 };

// ---------------------------------------------------------------- loop
const STEP = 1 / 120; let acc = 0, botActive = 0;
const camP = new THREE.Vector3(0, 3.6, 17), _t = new THREE.Vector3();
let lastSec = 60;
loop((rawDt, t) => {
  const real = rawDt / 60;
  if (phase === 'goal') { slow = lerp(slow, 1, 0.02); }
  else slow = lerp(slow, 1, 0.1);
  if (state === 'play') {
    acc += real * slow;
    let n = 0;
    while (acc >= STEP && n < 12) {
      acc -= STEP; n++;
      if (phase === 'kickoff') { phaseT -= STEP; if (phaseT <= 0) phase = 'live'; }
      if (phase === 'goal') { phaseT -= STEP; if (phaseT <= 0) { if (golden || goalsP >= goalLimit || goalsC >= goalLimit) { endMatch(); break; } resetPositions(); } }
      if (phase === 'live' || phase === 'kickoff') {
        clock -= STEP;
        pl.power = Math.min(1, pl.power + STEP / 14); cpu.power = Math.min(1, cpu.power + STEP / 14);
      }
      if (clock <= 0 && phase !== 'goal') {
        if (goalsP === goalsC && !golden) { golden = true; clock = 20; ui.pop('GOLDEN GOAL!', '#fff36b', 40, 30); tone(660, 0.3, 'triangle', 0.12, 1); }
        else { clock = 0; endMatch(); break; }
      }
      if (tapX !== null && (dragX !== null || Math.abs(pl.x - tapX) < 0.45 || performance.now() > tapEnd)) { if (dragX === null) action(pl); tapX = null; }
      const pTarget = performance.now() < botActive ? botTarget : dragX !== null ? dragX : tapX;
      const cT = brain(cpu, pl, 1, STEP, ai);
      moveActor(pl, pTarget, 6.6, STEP);
      moveActor(cpu, cT, 6.6 * ai.speed, STEP);
      // players don't overlap
      const dx = cpu.x - pl.x; if (Math.abs(dx) < 1.05 && Math.abs(cpu.y - pl.y) < 1.4) { const push = (1.05 - Math.abs(dx)) / 2 * Math.sign(dx || 1); pl.x -= push; cpu.x += push; }
      if (phase !== 'kickoff') { ballStep(STEP); collideHead(pl); collideHead(cpu); tryKick(pl); tryKick(cpu); goalCheck(); }
      else { B.vy -= G_B * STEP * 0.3; B.y = Math.max(B.y + B.vy * STEP, BR); }
    }
    if (Math.ceil(clock) !== lastSec) { lastSec = Math.ceil(clock); updateBoard(); if (lastSec <= 5 && lastSec > 0 && phase === 'live') tone(880, 0.06, 'square', 0.05, 1); }
    if (n) updatePower();
  }
  // visuals
  for (const a of [pl, cpu]) {
    const g = a.g; g.position.set(a.x, a.y, 0);
    a.squash = lerp(a.squash, 1, 0.15); g.inner.scale.set(1 / Math.sqrt(a.squash), a.squash, 1 / Math.sqrt(a.squash));
    const run = Math.abs(a.vx) > 0.5 && a.ground ? Math.sin(t * 18) * 0.7 : 0;
    const k = a.kickT > 0 ? Math.sin((1 - a.kickT / 0.28) * Math.PI) : 0;
    g.back.rotation.z = -run * a.face * 0.6; g.kickLeg.rotation.z = a.face * (run * 0.6 + k * 1.6);
    g.head.rotation.z = a.stun > 0 ? Math.sin(t * 20) * 0.25 : -a.vx * 0.02;
    g.head.position.y = 1.32 + (a.ground ? Math.abs(run) * 0.05 : 0);
    g.blob.position.set(a.x, 0.02, 0); g.blob.scale.setScalar(1 / (1 + a.y * 0.4));
  }
  ball.position.set(B.x, B.y, 0); ball.rotation.z = -B.spin;
  ball.material.emissiveIntensity = B.fire > 0 ? 0.6 + Math.sin(t * 30) * 0.2 : 0;
  ballBlob.position.set(B.x, 0.02, 0); ballBlob.scale.setScalar(1 / (1 + B.y * 0.3));
  for (let i = trail.length - 1; i > 0; i--) trail[i].position.copy(trail[i - 1].position);
  trail[0].position.set(B.x, B.y, 0);
  trail.forEach((m, i) => { m.visible = B.fire > 0 && i > 0; m.material.opacity = 0.5 * (1 - i / trail.length); });
  for (const gl of goals) gl.net.scale.x = lerp(gl.net.scale.x, 1, 0.1);
  // crowd bobs harder after goals
  { const m = new THREE.Matrix4(), ex = phase === 'goal' ? 1 : 0.15; for (let i = 0; i < CROWD; i++) { const c = crowdData[i]; m.makeTranslation(c.x, c.y + Math.abs(Math.sin(t * (phase === 'goal' ? 14 : 3) + c.ph)) * 0.3 * ex, c.z); crowd.setMatrixAt(i, m); m.elements[13] += 0.38; crowdHeads.setMatrixAt(i, m); } crowd.instanceMatrix.needsUpdate = true; crowdHeads.instanceMatrix.needsUpdate = true; }
  // camera follows the ball, clamped so the goal stays framed
  shake = Math.max(0, shake - real * 1.5);
  const tx = state === 'ready' ? 0 : clamp(B.x * 0.7 + (pl.x + cpu.x) * 0.12, -(FW - 3.4), FW - 3.4);
  camP.x = lerp(camP.x, tx, 0.08);
  camera.position.set(camP.x + (Math.random() - 0.5) * shake, 7.2 + (Math.random() - 0.5) * shake, 23);
  camera.lookAt(camP.x, 3.3, 0);
  stage.followLight(_t.set(camP.x, 0, 0));
});

pk = null; buildLevel(); ui.start(); powerEl.style.display = 'none';

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play') return;
    // the bot uses the same brain as the CPU (with quicker reactions) and the same action() a tap triggers
    const savedT = botSkill.think; botSkill.think = 0;
    const tx = brain(pl, cpu, -1, 0, botSkill); botSkill.think = savedT;
    botTarget = tx; botActive = performance.now() + 250;
    if (pl.power >= 1 && Math.abs(B.x - pl.x) < 1.2 && B.x > pl.x - 0.1 && B.y < 1.4) action(pl);
  },
};
