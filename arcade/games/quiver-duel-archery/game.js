// Quiver Duel — original turn-based archery duel. Press to draw, drag to aim, read the wind, let go to shoot.
// Five arrows each against a rival archer on the same target; highest total wins (tie = one-arrow shoot-off).
import { THREE, createStage, createUI, input, loop, store, mat, glossy, rounded, stickman, burst, confetti, sfx, tone, buzz, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';

const NAME = 'Quiver Duel: Archery';
const S = store('quiverduel');
const F = flow('quiverduel');
let level = S.get('level', 1), best = S.get('best', 0);

const stage = createStage({ fov: 40, shadowSize: 14 });
const { scene, camera, sun } = stage;
const ui = createUI({ title: 'QUIVER<br>DUEL', hint: 'Tap to shoot · or hold, drag to aim, let go', hand: '👆', score: false });
const D = daily('quiverduel', ui, { name: NAME });
const B = board({ game: 'quiver-duel', label: 'Duels won', limits: { maxRun: 1, maxPerSec: 0.2 }, mode: 'sum', corner: 'br' });
const duelEl = document.getElementById('duel'), windEl = document.getElementById('wind');
ui.els.top.style.top = 'calc(132px + env(safe-area-inset-top))';
ui.els.sub.style.top = 'calc(172px + env(safe-area-inset-top))';
const TAU = Math.PI * 2;

// crosshair overlay (only while drawing)
const xh = document.createElement('div');
xh.style.cssText = 'position:fixed;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;border:3px solid rgba(255,255,255,.95);box-shadow:0 0 0 2px rgba(0,0,0,.25),inset 0 0 0 2px rgba(0,0,0,.2);z-index:5;pointer-events:none;display:none';
xh.innerHTML = '<i style="position:absolute;left:50%;top:50%;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%;background:#ff3d6e;box-shadow:0 0 0 2px #fff"></i>';
document.body.appendChild(xh);
const drawBar = document.createElement('div');
drawBar.style.cssText = 'position:fixed;left:50%;bottom:calc(30px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:6;font-weight:800;font-size:20px;text-shadow:0 2px 0 rgba(0,0,0,.2);pointer-events:none';
document.body.appendChild(drawBar);

const THEMES = [
  { bg: ['#9fd8ff', '#fff1d6'], grass: ['#8fd16f', '#83c663'], ui: '#ff5d8f', tree: '#5fbf6a', hill: '#a6dc86', flag: ['#ff5d8f', '#ffd23f', '#3ab795'] },
  { bg: ['#ffb8cf', '#fff3dc'], grass: ['#a5d66b', '#98ca5f'], ui: '#7b5cff', tree: '#7fc96a', hill: '#bfe28c', flag: ['#7b5cff', '#ffd166', '#ff8fab'] },
  { bg: ['#9ee6d8', '#fbffe0'], grass: ['#86d18a', '#79c57e'], ui: '#ff8c42', tree: '#3fae7c', hill: '#9fdca6', flag: ['#ff8c42', '#3a86ff', '#ffffff'] },
  { bg: ['#c8b6ff', '#ffe5f1'], grass: ['#8ed68a', '#81ca7d'], ui: '#00a6fb', tree: '#58b98a', hill: '#b2e2a8', flag: ['#00a6fb', '#ff5d8f', '#ffd23f'] },
];

// ---------------------------------------------------------------- range
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
const groundMat = new THREE.MeshStandardMaterial({ roughness: 1 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 140), groundMat); ground.rotation.x = -Math.PI / 2; ground.position.z = -50; ground.receiveShadow = true; scene.add(ground);
function grassTex(t) { const tx = canvasTex(256, 1024, (g, w, h) => { for (let i = 0; i < 28; i++) { g.fillStyle = t.grass[i % 2]; g.fillRect(0, i * h / 28, w, h / 28 + 1); } for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.08})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 4); } }); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(6, 1); return tx; }
// shooting line + mats
const lineM = new THREE.Mesh(new THREE.BoxGeometry(8, 0.02, 0.12), mat('#ffffff')); lineM.position.set(0, 0.01, -0.6); scene.add(lineM);
// target: straw boss + painted face on an A-frame
const faceTex = canvasTex(512, 512, (g, w, h) => {
  const cols = ['#ffffff', '#ffffff', '#2b2d42', '#2b2d42', '#3fa7ff', '#3fa7ff', '#ff4d5e', '#ff4d5e', '#ffd23f', '#ffd23f'];
  const cx = w / 2, R = w / 2 - 2;
  g.fillStyle = '#e9d29a'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 10; i++) { const r = R * (1 - i / 10); g.fillStyle = cols[i]; g.beginPath(); g.arc(cx, cx, r, 0, TAU); g.fill(); g.strokeStyle = i === 2 || i === 3 ? '#ffffff' : '#2b2d42'; g.globalAlpha = 0.5; g.lineWidth = 2; g.stroke(); g.globalAlpha = 1; }
  g.strokeStyle = '#2b2d42'; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cx, R * 0.05, 0, TAU); g.stroke();
  g.beginPath(); g.moveTo(cx - 6, cx); g.lineTo(cx + 6, cx); g.moveTo(cx, cx - 6); g.lineTo(cx, cx + 6); g.stroke();
});
const TR = 1.2, TY = 1.55;
const target = new THREE.Group(); scene.add(target);
{
  const boss = new THREE.Mesh(new THREE.CylinderGeometry(TR + 0.12, TR + 0.12, 0.34, 40), mat('#e2c27a', { roughness: 1 })); boss.rotation.x = Math.PI / 2; boss.castShadow = true; target.add(boss);
  const face = new THREE.Mesh(new THREE.CircleGeometry(TR, 64), new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.8 })); face.position.z = 0.175; target.add(face);
  for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.4, 8), mat('#a8743f')); leg.position.set(s * 0.9, -0.2, -0.4); leg.rotation.z = s * 0.25; leg.rotation.x = -0.15; leg.castShadow = true; target.add(leg); }
  const back = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 8), mat('#a8743f')); back.position.set(0, -0.6, -1.0); back.rotation.x = 0.5; target.add(back);
}
const targetBlob = new THREE.Mesh(new THREE.CircleGeometry(1.6, 24), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.12, depthWrite: false })); targetBlob.rotation.x = -Math.PI / 2; targetBlob.scale.y = 0.5; scene.add(targetBlob);
// backstop, hay bales, trees, hills, flags
const hay = new THREE.InstancedMesh(rounded(1.6, 0.9, 1.0, 0.18), mat('#efd27d', { roughness: 1 }), 12); hay.castShadow = true; hay.receiveShadow = true; scene.add(hay);
const TREES = 40, tTrunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.28, 2, 6), mat('#9c6b45'), TREES), tCrown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.6, 0), mat('#5fbf6a', { flatShading: true }), TREES);
tCrown.castShadow = true; scene.add(tTrunk, tCrown);
const hillMat = mat('#a6dc86', { roughness: 1 });
{ const R = rng(8); for (let i = 0; i < 7; i++) { const h = new THREE.Mesh(new THREE.SphereGeometry(20 + R() * 15, 18, 10, 0, TAU, 0, Math.PI / 2), hillMat); h.scale.y = 0.4; h.position.set((i - 3) * 30, -1, -110 - R() * 20); scene.add(h); } }
const FLAGS = 7, flags = [];
const flagRope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 14, 4), mat('#ffffff')); flagRope.rotation.z = Math.PI / 2; scene.add(flagRope);
const poleM = mat('#ffffff');
for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.4, 8), poleM); p.userData.s = s; p.castShadow = true; scene.add(p); flags.push(p); }
const pennants = [];
for (let i = 0; i < FLAGS; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.9, 3), mat('#ff5d8f')); f.rotation.z = -Math.PI / 2; const piv = new THREE.Group(); piv.add(f); f.position.x = 0.42; scene.add(piv); pennants.push(piv); }
// wind sock near the shooting line (big, readable)
const sockPole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3, 8), poleM); sockPole.position.set(-3.4, 1.5, -3); scene.add(sockPole);
const sock = new THREE.Group(); sock.position.set(-3.4, 2.9, -3); scene.add(sock);
{ for (let i = 0; i < 4; i++) { const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.22 - i * 0.03, 0.25 - i * 0.03, 0.4, 12, 1, true), mat(i % 2 ? '#ffffff' : '#ff6b35', { side: THREE.DoubleSide })); seg.rotation.z = Math.PI / 2; seg.position.x = 0.2 + i * 0.4; sock.add(seg); } }

// ---------------------------------------------------------------- archers + bows + arrows
function makeArcher(color, hatColor) {
  const g = stickman(color, '#ffd7ba', 1.05);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.42, 14), mat(hatColor)); hat.position.y = 1.78; hat.rotation.x = -0.35; g.add(hat);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.04, 16), mat(hatColor)); brim.position.y = 1.62; g.add(brim);
  const feather = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.4, 6), mat('#ffffff')); feather.position.set(0.15, 1.85, 0.08); feather.rotation.z = -0.6; g.add(feather);
  const quiver = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.6, 10), mat('#8b5a2b')); quiver.position.set(0.12, 1.1, 0.24); quiver.rotation.x = -0.3; quiver.rotation.z = -0.3; g.add(quiver);
  for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.14, 4), mat(color)); f.position.set(0.18 + i * 0.03 - 0.03, 1.48, 0.33 - i * 0.02); g.add(f); }
  // bow in the left hand, held out toward the target (-z)
  const bow = new THREE.Group();
  const limb = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.035, 6, 24, Math.PI * 0.62), mat('#7a4a22')); limb.rotation.z = Math.PI / 2 - Math.PI * 0.31; limb.rotation.y = Math.PI / 2; bow.add(limb);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 8), mat(color)); bow.add(grip);
  const sMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const s1 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 4), sMat), s2 = s1.clone(); bow.add(s1, s2);
  const nock = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.75, 6), mat('#f2e3c6')); nock.rotation.x = Math.PI / 2; bow.add(nock);
  bow.s1 = s1; bow.s2 = s2; bow.nock = nock;
  bow.position.set(-0.05, 1.3, -0.55); g.add(bow); g.bow = bow;
  // limbs tip positions (bow local): the torus arc runs ±0.62*sin(0.31π) on y, behind by cos
  const tipY = 0.62 * Math.sin(Math.PI * 0.31), tipZ = 0.62 * Math.cos(Math.PI * 0.31) - 0.62;
  bow.setDraw = (k) => {
    const pull = 0.12 + k * 0.5, z0 = -tipZ;
    const sz = z0 + pull;
    for (const [s, m] of [[1, s1], [-1, s2]]) { const dy = tipY, dz = sz - z0, L = Math.hypot(dy, dz); m.scale.y = L; m.position.set(0, s * dy / 2, (z0 + sz) / 2); m.rotation.x = s * Math.atan2(dz, dy) * -1; }
    nock.visible = k > 0.02; nock.position.set(0, 0, sz - 0.36);
  };
  bow.setDraw(0);
  g.rotation.y = 0;
  return g;
}
const shaftG = new THREE.CylinderGeometry(0.016, 0.016, 0.8, 6); shaftG.rotateX(Math.PI / 2);
const tipG = new THREE.ConeGeometry(0.035, 0.1, 8); tipG.rotateX(-Math.PI / 2);
const finG = new THREE.PlaneGeometry(0.16, 0.06);
function makeArrow(color) {
  const g = new THREE.Group(), shaft = new THREE.Mesh(shaftG, mat('#f2e3c6')); g.add(shaft);
  const tip = new THREE.Mesh(tipG, glossy('#9aa3b5')); tip.position.z = -0.44; g.add(tip);
  const fm = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide });
  for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(finG, fm); f.position.z = 0.32; f.rotation.z = i * TAU / 3; f.rotation.y = Math.PI / 2; f.position.x = Math.cos(i * TAU / 3) * 0.035; f.position.y = Math.sin(i * TAU / 3) * 0.035; g.add(f); }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(g); return g;
}
const you = makeArcher('#ff5d8f', '#ffd23f'), rival = makeArcher('#3a86ff', '#2b2d42');
you.position.set(-1.1, 0, 0); rival.position.set(1.1, 0, 0);
scene.add(you, rival);
const trailM = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, depthWrite: false });
const trail = []; for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), trailM.clone()); m.visible = false; scene.add(m); trail.push(m); }

// ---------------------------------------------------------------- duel state
const V = 38, G = 9.8; let ARROWS = 5;
let state = 'ready', score = 0, R = rng(1), recorded = false, beatShown = false, theme;
let dist = 20, wind = 0, windMax = 3, windK = 1, sway = 0.06, cpuSigma = 0.4, cpuWindErr = 0.3;
let turn = 'you', phase = 'idle', phaseT = 0, shots = { you: [], rival: [] }, shootOff = false, offDist = { you: 9, rival: 9 };
let aim = { x: 0, y: 0 }, drawT = 0, drawing = false, arrow = null, arrowV = new THREE.Vector3(), stuck = [], impact = null, lastPts = 0;

function windLabel() { const a = Math.abs(wind) < 0.05 ? '•' : wind > 0 ? '→' : '←'; windEl.innerHTML = `WIND <span>${a}</span> ${Math.abs(wind).toFixed(1)}`; }
function drawDuel() {
  const row = (who, nm) => { const s = shots[who], n = Math.max(ARROWS, s.length); let dots = ''; for (let i = 0; i < n; i++) dots += `<span style="${s[i] !== undefined ? `background:${s[i] >= 9 ? '#ffd23f' : s[i] >= 7 ? '#ff4d5e' : s[i] >= 5 ? '#3fa7ff' : 'rgba(255,255,255,.5)'};color:${s[i] >= 9 ? '#2b2d42' : '#fff'}` : ''}">${s[i] !== undefined ? (s[i] === 0 ? 'M' : s[i]) : ''}</span>`; const tot = s.reduce((a, b) => a + b, 0); return `<div class="row ${turn === who && state === 'play' ? 'on' : ''}"><div class="nm">${nm}</div><div class="dots">${dots}</div><div class="tot">${tot}</div></div>`; };
  duelEl.innerHTML = row('you', 'YOU') + row('rival', 'RIVAL');
}
const total = (w) => shots[w].reduce((a, b) => a + b, 0);

function newWind() { wind = (R() * 2 - 1) * windMax; if (Math.abs(wind) < 0.3) wind = 0.3 * Math.sign(wind || 1); windLabel(); }
function buildLevel() {
  theme = THEMES[(level - 1) % THEMES.length];
  document.body.style.setProperty('--bg1', theme.bg[0]); document.body.style.setProperty('--bg2', theme.bg[1]); document.body.style.setProperty('--ui', theme.ui);
  if (groundMat.map) groundMat.map.dispose(); groundMat.map = grassTex(theme); groundMat.needsUpdate = true;
  hillMat.color.set(theme.hill); tCrown.material.color.set(theme.tree);
  pennants.forEach((p, i) => p.children[0].material.color.set(theme.flag[i % 3]));
  R = rng((D.seed || level * 6151) + 9);
  const fk = F.k();
  dist = clamp(16 + level * 1.6, 16, 42); ARROWS = level <= 2 ? 3 : level <= 5 ? 4 : 5;
  windMax = clamp((1.2 + level * 0.35) * fk, 1, 6);
  sway = clamp((0.05 + level * 0.004) * fk, 0.04, 0.12);
  cpuSigma = clamp((0.5 - level * 0.03) / fk, 0.1, 0.6);
  cpuWindErr = clamp(0.45 - level * 0.03, 0.08, 0.5);
  target.position.set(0, TY, -dist); targetBlob.position.set(0, 0.02, -dist + 0.2);
  // scenery placed relative to the target distance
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < 12; i++) { const side = i < 6 ? -1 : 1, k = i % 6; p.set(side * (3.2 + (k % 3) * 1.7), 0.45 + (k > 2 ? 0.9 : 0), -dist - 1.4 - (k % 2) * 0.3); q.setFromEuler(new THREE.Euler(0, (R() - 0.5) * 0.3, 0)); m.compose(p, q, s); hay.setMatrixAt(i, m); }
  hay.instanceMatrix.needsUpdate = true;
  for (let i = 0; i < TREES; i++) { const x = (R() * 2 - 1) * 30, z = -dist - 6 - R() * 25; const x2 = Math.abs(x) < 6 ? x + Math.sign(x || 1) * 6 : x; const sc = 0.8 + R() * 0.8; p.set(x2, sc, z); s.setScalar(sc); q.identity(); m.compose(p, q, s); tTrunk.setMatrixAt(i, m); p.y = sc * 2.6; m.compose(p, q, s); tCrown.setMatrixAt(i, m); }
  tTrunk.instanceMatrix.needsUpdate = true; tCrown.instanceMatrix.needsUpdate = true;
  s.set(1, 1, 1);
  flags[0].position.set(-7, 2.2, -dist + 3); flags[1].position.set(7, 2.2, -dist + 3); flagRope.position.set(0, 4.3, -dist + 3);
  pennants.forEach((pv, i) => pv.position.set(-6 + i * 2, 4.25, -dist + 3));
  for (const a of stuck) scene.remove(a); stuck = [];
  if (arrow) { scene.remove(arrow); arrow = null; }
  shots = { you: [], rival: [] }; shootOff = false; score = 0; recorded = false; beatShown = false;
  turn = 'you'; phase = 'idle'; phaseT = 0; drawing = false; drawT = 0; aim.x = aim.y = 0;
  ui.levels(level); ui.progress(0); ui.sub(`${Math.round(dist * 3)} m`);
  newWind(); drawDuel();
}

// ---------------------------------------------------------------- shooting
const origin = (who) => (who === 'you' ? you : rival).position.clone().add(new THREE.Vector3(-0.05, 1.3, -0.8));
function swayAt(t) { const f = 1 + Math.max(0, drawT - 3) * 0.6; return { x: (Math.sin(t * 1.7) * 0.7 + Math.sin(t * 3.1 + 1) * 0.3) * sway * f * (dist / 20), y: (Math.cos(t * 1.3) * 0.7 + Math.sin(t * 2.6) * 0.3) * sway * f * (dist / 20) }; }
function launch(who, ax, ay) {
  // ballistic shot that would land on (ax, ay) on the target face with no wind; wind then pushes it sideways
  const o = origin(who), tz = -dist + 0.17, T = (o.z - tz) / V;
  arrowV.set((ax - o.x) / T, (TY + ay - o.y) / T + G * T / 2, -V);
  arrow = makeArrow(who === 'you' ? '#ff5d8f' : '#3a86ff'); arrow.position.copy(o); arrow.userData.who = who;
  phase = 'flight'; phaseT = 0; trail.forEach(m => { m.visible = false; m.position.copy(o); });
  tone(160, 0.12, 'triangle', 0.14, 2.2); setTimeout(() => tone(900, 0.25, 'sine', 0.04, 0.5), 30);
  (who === 'you' ? you : rival).bow.setDraw(0);
}
function ringOf(dx, dy) { const r = Math.hypot(dx, dy); if (r > TR) return 0; return Math.max(1, 10 - Math.floor(r / (TR / 10))); }
function land(hitTarget, p) {
  const who = arrow.userData.who;
  let pts = 0, r = 9;
  if (hitTarget) { r = Math.hypot(p.x, p.y - TY); pts = ringOf(p.x, p.y - TY); }
  stuck.push(arrow); arrow = null;
  if (shootOff) offDist[who] = hitTarget ? r : 9;
  shots[who].push(pts); drawDuel();
  impact = { p: p.clone(), who, pts };
  phase = 'impact'; phaseT = 0;
  const col = pts >= 9 ? '#ffd23f' : pts >= 7 ? '#ff4d5e' : pts >= 5 ? '#3fa7ff' : '#ffffff';
  if (pts === 0) { ui.pop('MISS', '#fff', 46, 36); tone(200, 0.2, 'sine', 0.1, 0.6); }
  else {
    ui.pop(pts === 10 ? (r < TR * 0.05 ? 'X · BULLSEYE!' : 'BULLSEYE!') : String(pts), pts >= 9 ? '#fff36b' : '#fff', pts >= 9 ? 56 : 52, 36);
    tone(130, 0.1, 'square', 0.12, 0.5); burst(scene, p, ['#e2c27a', '#fff3c4'], 10, { speed: 0.05, up: 0.04, size: 0.4 });
    if (pts >= 9) { burst(scene, p.clone().setZ(p.z + 0.3), ['#ffd23f', '#ffffff', '#ff5d8f'], 26, { speed: 0.09, up: 0.08, size: 0.5 }); tone(1046, 0.2, 'triangle', 0.12, 1); if (who === 'you') { ui.flash(0.35); buzz([15, 25, 15]); } }
    else if (who === 'you') buzz(12);
  }
  if (who === 'you') { score = total('you') + shots.you.filter(x => x === 10).length * 2; checkBeat(); }
  ui.progress((shots.you.length + shots.rival.length) / (ARROWS * 2));
}
function nextTurn() {
  const ny = shots.you.length, nr = shots.rival.length;
  const n = shootOff ? 1 : ARROWS, base = shootOff ? ARROWS : 0;
  if (ny - base >= n && nr - base >= n) return finish();
  turn = ny > nr ? 'rival' : 'you';
  phase = 'idle'; phaseT = 0; drawing = false; drawT = 0; aim.x = aim.y = 0;
  newWind(); drawDuel();
  ui.pop(turn === 'you' ? 'YOUR SHOT' : 'RIVAL SHOOTS', turn === 'you' ? theme.ui : '#3a86ff', 32, 30);
  if (turn === 'rival') rivalPlan = null;
}
function finish() {
  const a = total('you'), b = total('rival');
  if (!shootOff && a === b) { shootOff = true; ui.pop('SHOOT-OFF!', '#fff36b', 44, 30); setTimeout(() => { turn = 'you'; phase = 'idle'; newWind(); drawDuel(); }, 700); phase = 'wait'; return; }
  const won = shootOff ? offDist.you < offDist.rival || (offDist.you === offDist.rival) : a > b;
  if (won) win(); else lose();
}
function checkBeat() {
  if (score > best) { best = score; S.set('best', best); }
  if (!beatShown && D.beaten(score)) { beatShown = true; setTimeout(() => ui.pop('BEATEN!', '#fff36b', 44, 44), 600); confetti(scene, target.position.clone().setZ(-dist + 1), 60); }
}
function win() {
  if (state !== 'play') return; state = 'won';
  if (!recorded) { recorded = true; F.level(true); }
  score += 20; checkBeat();
  level++; S.set('level', level);
  confetti(scene, you.position.clone().setY(2.5).setZ(-2), 120); sfx.win(); buzz([20, 40, 20, 40, 60]);
  D.won(score); B.submit(1); drawDuel();                   // world board: duels won vs the rival today
  xh.style.display = 'none'; drawBar.textContent = '';
  ui.win(level - 1, `${total('you')} – ${total('rival')} · ${score} pts`);
}
function lose() {
  if (state !== 'play') return; state = 'lost';
  if (!recorded) { recorded = true; F.level(false, clamp(total('you') / Math.max(1, total('rival') + 1), 0, 1)); }
  sfx.fail(); drawDuel(); xh.style.display = 'none'; drawBar.textContent = '';
  ui.lose('OUTSHOT!', `${total('you')} – ${total('rival')} · aim upwind to beat the drift`);
}

// ---------------------------------------------------------------- input
let lastXY = null;
function startDraw() { if (state !== 'play' || turn !== 'you' || phase !== 'idle') return; drawing = true; drawT = 0; phase = 'aim'; tone(220, 0.25, 'sawtooth', 0.03, 1.6); }
function release(tap) { if (!drawing) return; drawing = false; if (drawT < 0.25 && !tap) { phase = 'idle'; you.bow.setDraw(0); return; } const s = swayAt(performance.now() / 1000); launch('you', aim.x + s.x, aim.y + s.y); }   // a quick tap shoots straight at the crosshair
input({
  onDown: (e) => { lastXY = [e.clientX, e.clientY]; startDraw(); },
  onMove: (dx, dy) => { if (!drawing) return; const k = 0.0042 * (dist / 20) * (camera.fov / 18); aim.x = clamp(aim.x + dx * k, -3, 3); aim.y = clamp(aim.y - dy * k, -2.5, 2.5); },
  onUp: (e, st) => release(Math.hypot(e.clientX - st.x, e.clientY - st.y) < 12),
});
ui.onTap(() => { buildLevel(); state = 'play'; B.start(); ui.pop('YOUR SHOT', theme.ui, 32, 30); });

// ---------------------------------------------------------------- rival archer (aims with honest noise and imperfect wind reading)
let rivalPlan = null;
function rivalThink(dt, t) {
  if (!rivalPlan) {
    const T = (0.8 + dist) / V, drift = 0.5 * wind * windK * T * T;
    const g = () => { let u = 0; for (let i = 0; i < 3; i++) u += R() * 2 - 1; return u / 3 * 1.7; };
    rivalPlan = { x: -drift * (1 - (R() * 2 - 1) * cpuWindErr) + g() * cpuSigma, y: g() * cpuSigma, t: 0.6 + R() * 0.5 };
    phase = 'aim'; drawT = 0;
  }
  drawT += dt; rival.bow.setDraw(Math.min(1, drawT * 2.5));
  if (drawT > rivalPlan.t) { launch('rival', rivalPlan.x, rivalPlan.y); rivalPlan = null; }
}

// ---------------------------------------------------------------- loop
const camPos = new THREE.Vector3(0, 2, 4), camLook = new THREE.Vector3(0, TY, -20), _v = new THREE.Vector3(), _w = new THREE.Vector3();
let fov = 40;
loop((rawDt, t) => {
  const dt = rawDt / 60;
  let slow = 1;
  if (state === 'play') {
    if (turn === 'you' && drawing) { drawT += dt; you.bow.setDraw(Math.min(1, drawT * 3)); }
    if (turn === 'rival' && (phase === 'idle' || phase === 'aim')) { phaseT += dt; if (phaseT > 0.3) rivalThink(dt, t); }
    if (phase === 'flight' && arrow) {
      const near = arrow.position.z < -dist + 2.5;
      slow = near ? 0.35 : 1;
      const sdt = dt * slow, steps = 4;
      for (let i = 0; i < steps && arrow; i++) {
        const h = sdt / steps, prev = arrow.position.clone();
        arrowV.y -= G * h; arrowV.x += wind * windK * h;
        arrow.position.addScaledVector(arrowV, h);
        const fz = -dist + 0.17;
        if (prev.z > fz && arrow.position.z <= fz) {
          const k = (prev.z - fz) / (prev.z - arrow.position.z), p = prev.lerp(arrow.position, k);
          if (Math.hypot(p.x, p.y - TY) <= TR + 0.12) { arrow.position.copy(p).add(_v.copy(arrowV).normalize().multiplyScalar(0.25)); land(true, p); break; }
        }
        if (arrow.position.y < 0.05 || arrow.position.z < -dist - 12) { arrow.position.y = Math.max(arrow.position.y, 0.05); land(false, arrow.position.clone()); break; }
      }
      if (arrow) { arrow.lookAt(_v.copy(arrow.position).sub(arrowV)); }
      phaseT += dt;
      for (let i = trail.length - 1; i > 0; i--) trail[i].position.copy(trail[i - 1].position);
      if (arrow) trail[0].position.copy(arrow.position);
      trail.forEach((m, i) => { m.visible = !!arrow && phaseT > i * 0.01; m.material.opacity = 0.6 * (1 - i / trail.length); });
    } else trail.forEach(m => m.visible = false);
    if (phase === 'impact') { phaseT += dt; if (phaseT > 0.85) nextTurn(); }
  }
  // pennants + windsock follow the wind
  const wa = clamp(wind / 6, -1, 1);
  pennants.forEach((p, i) => { p.rotation.y = wa >= 0 ? 0 : Math.PI; p.rotation.z = -1.2 + Math.abs(wa) * 1.1 + Math.sin(t * (4 + Math.abs(wind)) + i) * 0.12; });
  sock.rotation.y = wa >= 0 ? 0 : Math.PI; sock.rotation.z = -1.3 + Math.abs(wa) * 1.25 + Math.sin(t * 6) * 0.05;
  // idle archer motion
  for (const a of [you, rival]) { a.body.position.y = 0.95 + Math.sin(t * 2 + a.position.x) * 0.01; a.armL.rotation.x = -1.5; a.armR.rotation.x = -1.3; a.armR.rotation.z = 0.0; }
  // camera
  const who = turn === 'you' ? you : rival;
  if (state === 'ready') { camPos.set(-0.2, 2.4, 5.2); camLook.set(0, 1.4, -dist * 0.5); fov = 44; }
  else if (phase === 'flight' && arrow) {
    camPos.copy(arrow.position).add(_v.set(0.35, 0.3, 1.6)); camLook.copy(arrow.position).add(_w.copy(arrowV).normalize().multiplyScalar(6)); fov = 34;
  } else if (phase === 'impact' && impact) {
    camPos.set(impact.p.x * 0.5 + 0.7, TY + 0.7, -dist + 6); camLook.set(impact.p.x * 0.6, TY - 0.1, -dist); fov = 32;
  } else if (turn === 'you' && drawing) {
    const s = swayAt(t);
    camPos.set(who.position.x + 0.35, 1.72, 0.9); camLook.set(aim.x + s.x, TY + aim.y + s.y, -dist); fov = lerp(fov, 15 * (dist / 24) + 6, 0.12);
  } else if (turn === 'rival') {
    camPos.set(who.position.x + 0.42, 2.3, 3.0); camLook.set(who.position.x * 0.25, TY + 0.1, -dist); fov = 40;
  } else {
    camPos.set(who.position.x + 0.42, 2.3, 3.0); camLook.set(who.position.x * 0.25, TY + 0.1, -dist); fov = 40;
  }
  const snap = phase === 'flight' ? 0.5 : drawing ? 0.35 : phase === 'impact' ? 0.14 : 0.1;
  camera.position.lerp(camPos, snap);
  _v.copy(camLook); camera.userData.look = (camera.userData.look || _v.clone()).lerp(_v, snap); camera.lookAt(camera.userData.look);
  const f2 = (innerWidth / innerHeight < 0.7 ? 1.12 : 1) * fov; if (Math.abs(camera.fov - f2) > 0.05) { camera.fov = lerp(camera.fov, f2, drawing ? 0.2 : 0.15); camera.updateProjectionMatrix(); }
  xh.style.display = state === 'play' && turn === 'you' && drawing ? 'block' : 'none';
  drawBar.textContent = state === 'play' ? (turn === 'you' ? (drawing ? 'let go to shoot' : phase === 'idle' ? 'tap to shoot · hold to aim' : '') : phase === 'aim' || phase === 'idle' ? 'rival is aiming…' : '') : '';
  stage.followLight(_v.set(0, 0, -dist * 0.5));
});

theme = THEMES[(level - 1) % THEMES.length];
buildLevel(); ui.start();

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play' || turn !== 'you') return;
    if (phase === 'idle') { startDraw(); return; }
    if (!drawing) return;
    // compensate the wind drift, then let go when the sway passes near the centre
    const T = (0.8 + dist) / V, drift = 0.5 * wind * windK * T * T;
    aim.x = lerp(aim.x, -drift + (Math.random() - 0.5) * 0.06, 0.7); aim.y = lerp(aim.y, (Math.random() - 0.5) * 0.06, 0.7);
    const s = swayAt(performance.now() / 1000);
    if (drawT > 0.35 && (Math.hypot(s.x, s.y) < sway * 0.6 || drawT > 2)) release();
  },
};
