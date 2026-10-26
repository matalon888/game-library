// Bonk Brawl — original dodgeball arena. Drag to run and dodge, run over a ball to grab it, let go to throw.
// Knock out every rival on the far side; three hearts per level.
import { THREE, createStage, createUI, input, loop, store, mat, glossy, rounded, burst, confetti, sfx, tone, buzz, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { GLTFLoader } from './kit/addons/loaders/GLTFLoader.js';
import { heroBar, selectedHero, loadHero, onHeroesChange } from './kit/heroes.js';

const NAME = 'Bonk Brawl: Dodgeball Arena';
const S = store('bonkbrawl');
const F = flow('bonkbrawl');
const B = board({ game: 'bonk-brawl', label: 'Points', limits: { maxRun: 200, maxPerSec: 30 }, mode: 'sum' });
let level = S.get('level', 1), best = S.get('best', 0);

const stage = createStage({ fov: 48, shadowSize: 11 });
const { scene, camera } = stage;
const ui = createUI({ title: 'BONK<br>BRAWL', hint: 'Tap the floor to run · tap a rival to throw', hand: '👆' });
const D = daily('bonkbrawl', ui, { name: NAME });
const stickEl = document.getElementById('stick'), heartsEl = document.getElementById('hearts');

const lerpA = (a, b, k) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return a + d * k; };
const AW = 3.6, AL = 7.2, BALL_R = 0.26, BODY_R = 0.5;     // arena half-width / half-length
const THEMES = [
  { bg: ['#9fb4ff', '#e4e9ff'], floor: '#f4f8ff', line: '#ff5d8f', rail: '#ffd23f', out: '#6c7ae0', crowd: ['#ff8fab', '#ffd166', '#8ce99a', '#74c0fc', '#ffffff'] },
  { bg: ['#ffb3c6', '#fff0f3'], floor: '#fffaf5', line: '#7b5cff', rail: '#3ab795', out: '#e07a9a', crowd: ['#7b5cff', '#ffd166', '#3ab795', '#ffffff', '#00a6fb'] },
  { bg: ['#9be7d8', '#e8fff8'], floor: '#f6fffd', line: '#ff8c42', rail: '#ff5d8f', out: '#3a9f8f', crowd: ['#ff5d8f', '#ffd23f', '#7b5cff', '#ffffff', '#ff8c42'] },
  { bg: ['#ffd29d', '#fff6e5'], floor: '#fffdf8', line: '#00a6fb', rail: '#7b5cff', out: '#e09a5a', crowd: ['#00a6fb', '#ff5d8f', '#52b788', '#ffffff', '#ffd23f'] },
];

// ---------------------------------------------------------------- arena
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const outFloor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), mat('#6c7ae0', { roughness: 0.9 }));
outFloor.rotation.x = -Math.PI / 2; outFloor.position.y = -0.4; outFloor.receiveShadow = true; scene.add(outFloor);
const floorMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.02 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(AW * 2, AL * 2), floorMat); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const base = new THREE.Mesh(rounded(AW * 2 + 0.6, AL * 2 + 0.6, 0.3, 0.14), mat('#ffffff')); base.rotation.x = -Math.PI / 2; base.position.y = -0.17; base.receiveShadow = true; scene.add(base);
function floorTexture(t) {
  return canvasTex(512, 1024, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, t.floor); gr.addColorStop(1, '#ffffff'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) { g.strokeStyle = `rgba(140,170,220,${Math.random() * 0.12})`; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); const x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 120, y + (Math.random() - 0.5) * 60); g.stroke(); }
    g.strokeStyle = t.line; g.lineWidth = 10; g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
    g.lineWidth = 6; g.globalAlpha = 0.7; g.beginPath(); g.arc(w / 2, h / 2, w * 0.18, 0, Math.PI * 2); g.stroke();
    g.globalAlpha = 0.35; g.lineWidth = 5; for (const y of [h * 0.22, h * 0.78]) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.globalAlpha = 1; g.strokeStyle = 'rgba(0,0,0,0.08)'; g.lineWidth = 14; g.strokeRect(0, 0, w, h);
  });
}
// glass walls + rails
const glass = new THREE.MeshStandardMaterial({ color: '#dff4ff', transparent: true, opacity: 0.28, roughness: 0.1, depthWrite: false, side: THREE.DoubleSide });
const railMat = glossy('#ffd23f');
const WH = 1.25;
for (const [w, x, z, ry] of [[AW * 2, 0, -AL, 0], [AL * 2, -AW, 0, Math.PI / 2], [AL * 2, AW, 0, Math.PI / 2], [AW * 2, 0, AL, 0]]) {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, WH), glass); p.position.set(x, WH / 2, z); p.rotation.y = ry; p.renderOrder = 2; scene.add(p);
  const r = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, w, 4, 10), railMat); r.rotation.z = Math.PI / 2; r.rotation.y = ry; r.position.set(x, WH, z); r.castShadow = true; scene.add(r);
  const r2 = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 0.16), railMat); r2.rotation.y = ry; r2.position.set(x, 0.06, z); scene.add(r2);
}
for (const x of [-AW, AW]) for (const z of [-AL, 0, AL]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, WH + 0.1, 12), railMat); p.position.set(x, WH / 2, z); p.castShadow = true; scene.add(p); }
// bleachers with a bobbing instanced crowd on both long sides
const bleach = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat('#ffffff', { roughness: 0.8 }), 8);
{ const m = new THREE.Matrix4(); let i = 0; for (const s of [-1, 1]) for (let row = 0; row < 4; row++) { m.compose(new THREE.Vector3(s * (AW + 1.3 + row * 0.9), 0.25 + row * 0.45, 0), new THREE.Quaternion(), new THREE.Vector3(0.9, 0.5 + row * 0.9, AL * 2 + 2)); bleach.setMatrixAt(i++, m); } }
bleach.receiveShadow = true; scene.add(bleach);
const CROWD = 64, crowd = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.2, 0.25, 4, 8), mat('#ffffff'), CROWD), crowdData = [];
for (let i = 0; i < CROWD; i++) { const s = i % 2 ? 1 : -1, row = (i >> 1) % 4, k = i >> 3; crowdData.push({ x: s * (AW + 1.3 + row * 0.9), y: 0.5 + row * 0.9 + 0.2, z: -AL + 0.8 + k * 1.75 + (row % 2) * 0.5, ph: Math.random() * 6 }); }
crowd.castShadow = true; scene.add(crowd);
// flags along the far end
const flagM = new THREE.InstancedMesh(new THREE.ConeGeometry(0.22, 0.42, 3), mat('#ffffff'), 12);
{ const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0)); for (let i = 0; i < 12; i++) { m.compose(new THREE.Vector3(-AW + 0.3 + i * (AW * 2 - 0.6) / 11, WH + 0.85, -AL - 0.6), q, new THREE.Vector3(1, 1, 0.3)); flagM.setMatrixAt(i, m); } }
scene.add(flagM);
const flagLine = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, AW * 2, 4), mat('#ffffff')); flagLine.rotation.z = Math.PI / 2; flagLine.position.set(0, WH + 1.06, -AL - 0.6); scene.add(flagLine);
for (const x of [-AW - 0.1, AW + 0.1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 8), mat('#ffffff')); p.position.set(x, 1.2, -AL - 0.6); scene.add(p); }

let theme;
function applyTheme(t) {
  theme = t;
  document.body.style.setProperty('--bg1', t.bg[0]); document.body.style.setProperty('--bg2', t.bg[1]); document.body.style.setProperty('--ui', t.line);
  if (floorMat.map) floorMat.map.dispose(); floorMat.map = floorTexture(t); floorMat.needsUpdate = true;
  railMat.color.set(t.rail); outFloor.material.color.set(t.out);
  const c = new THREE.Color(); for (let i = 0; i < CROWD; i++) crowd.setColorAt(i, c.set(t.crowd[i % t.crowd.length]));
  for (let i = 0; i < 12; i++) flagM.setColorAt(i, c.set([t.line, t.rail, '#ffffff'][i % 3]));
  crowd.instanceColor.needsUpdate = true; flagM.instanceColor.needsUpdate = true;
}

// ---------------------------------------------------------------- characters: round "bean" brawlers with goggles
const eyeW = mat('#ffffff'), eyeB = mat('#1d1d2c'), feetM = mat('#2b2d42');
function bean(color, accent, kind = 0) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const m = mat(color), a = mat(accent);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.5, 6, 18), m); torso.position.y = 0.78; torso.castShadow = true;
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), mat('#ffffff')); belly.scale.set(1, 1.1, 0.5); belly.position.set(0, 0.62, 0.27);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 8, 24), a); band.rotation.x = Math.PI / 2; band.position.y = 1.08;
  const lens = (x) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), eyeW); e.position.set(x, 1.08, 0.36); const p = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), eyeB); p.position.set(x, 1.08, 0.48); const rim = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.03, 6, 16), a); rim.position.set(x, 1.08, 0.42); body.add(e, p, rim); };
  lens(-0.15); lens(0.15);
  // headgear: player gets an antenna pom, rivals get spikes / a crest
  if (kind === 0) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 6), a); st.position.y = 1.55; const pom = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), a); pom.position.y = 1.72; body.add(st, pom); }
  else if (kind === 1) { for (let i = -1; i <= 1; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 8), a); sp.position.set(i * 0.17, 1.5 - Math.abs(i) * 0.05, -0.02); sp.rotation.z = -i * 0.35; body.add(sp); } }
  else { const cr = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.55), a); cr.position.set(0, 1.5, -0.05); body.add(cr); }
  body.add(torso, belly, band);
  const arm = (x) => { const piv = new THREE.Group(); piv.position.set(x, 0.92, 0); const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.28, 4, 8), m); l.position.y = -0.2; l.castShadow = true; piv.add(l); body.add(piv); return piv; };
  g.armL = arm(-0.48); g.armR = arm(0.48); g.armL.rotation.z = -0.4; g.armR.rotation.z = 0.4;
  const foot = (x) => { const f = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), feetM); f.scale.set(1, 0.6, 1.4); f.position.set(x, 0.08, 0.05); f.castShadow = true; g.add(f); return f; };
  g.footL = foot(-0.2); g.footR = foot(0.2);
  g.body = body; g.mats = [m];
  return g;
}

// ---------------------------------------------------------------- shared FX meshes
const BALL_G = new THREE.SphereGeometry(BALL_R, 22, 16);
const ringGeo = new THREE.RingGeometry(0.5, 0.62, 32); ringGeo.rotateX(-Math.PI / 2);
const reticle = new THREE.Group();
{ const rm = new THREE.MeshBasicMaterial({ color: '#ff3355', transparent: true, opacity: 0.95, depthTest: false });
  const r = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.42, 28), rm); reticle.add(r);
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.22), rm); const a = i * Math.PI / 2; b.position.set(Math.cos(a) * 0.48, Math.sin(a) * 0.48, 0); b.rotation.z = a + Math.PI / 2; reticle.add(b); }
  reticle.renderOrder = 10; reticle.visible = false; scene.add(reticle); }
const blobTex = canvasTex(64, 64, (g, w) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(0,0,40,0.3)'); r.addColorStop(1, 'rgba(0,0,40,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false });
const blobGeo = new THREE.PlaneGeometry(1, 1); blobGeo.rotateX(-Math.PI / 2);

// ---------------------------------------------------------------- state
const player = bean('#2ec4b6', '#ffd23f', 0); scene.add(player);

// ---------------------------------------------------------------- my hero (Hero Lab): swaps the bean's look only; position, hitbox, throws stay the player's
const beanParts = [...player.children];
let my = null, myTok = 0, myClip = '', myShown = '', myArm = null, throwT = 0;
async function useHero() {
  const hc = selectedHero(), tok = ++myTok; myShown = JSON.stringify(hc);
  if (my) { my.dispose(); my = null; myArm = null; }
  beanParts.forEach(o => o.visible = true);
  if (!hc) return;
  try {
    // the ball goes in the right hand, so the hand item stays in the lab
    const n = await loadHero(THREE, GLTFLoader, { hero: { ...hc, items: { ...hc.items, hand: null } }, height: 1.75, quality: 'game', clip: 'idle' });
    if (tok !== myTok) { n.dispose(); return; }
    const b = k => n.object.getObjectByName(k);
    my = n; myClip = 'idle'; myArm = { ua: b('RightArm'), fa: b('RightForeArm'), hand: b('RightHand') };
    player.add(n.object); beanParts.forEach(o => o.visible = false);
  } catch (e) { console.warn('hero', e); }
}
const _ha = new THREE.Vector3(), _hb = new THREE.Vector3(), _hq = new THREE.Quaternion(), _hq2 = new THREE.Quaternion(), _hq3 = new THREE.Quaternion(), _hI = new THREE.Quaternion(), _hd = new THREE.Vector3(), _hf = new THREE.Vector3();
function aimBone(bone, tip, dir, w = 1) {   // turn `bone` so bone→tip points along world `dir` (w blends from the clip pose)
  if (!bone || !tip || w <= 0) return;
  bone.getWorldPosition(_ha); tip.getWorldPosition(_hb);
  _hq.setFromUnitVectors(_hb.sub(_ha).normalize(), dir);
  if (w < 1) { _hq2.copy(_hq); _hq.copy(_hI).slerp(_hq2, w); }
  bone.getWorldQuaternion(_hq2); _hq.multiply(_hq2);
  bone.parent.getWorldQuaternion(_hq3); bone.quaternion.copy(_hq3.invert().multiply(_hq));
}
function heroTick(s) {
  if (!my) return;
  const sp = pv.length();
  const want = state === 'lost' ? 'fall' : state === 'won' ? 'cheer' : state !== 'play' ? 'idle' : sp > 4.8 ? 'sprint' : sp > 0.4 ? 'run' : 'idle';
  if (want !== myClip) { myClip = want; my.play(want, { fade: want === 'fall' ? 0.12 : 0.2 }); }
  if (my.actions.run) my.actions.run.timeScale = clamp(sp / 3.6, 0.7, 1.35);
  my.mixer.update(s);
  if (state !== 'play' && state !== 'won') return;
  // arm: ball held out in front, whipped overhead on a throw
  const fw = _hf.set(Math.sin(player.rotation.y), 0, Math.cos(player.rotation.y));
  throwT = Math.max(0, throwT - s);
  if (throwT > 0) { aimBone(myArm.ua, myArm.fa, _hd.copy(fw).multiplyScalar(0.7).setY(1).normalize(), Math.min(1, throwT / 0.12)); aimBone(myArm.fa, myArm.hand, _hd, Math.min(1, throwT / 0.12)); }
  else if (held) { aimBone(myArm.ua, myArm.fa, _hd.copy(fw).setY(-0.45).normalize()); aimBone(myArm.fa, myArm.hand, _hd.copy(fw).setY(0.15).normalize()); }
}
// held ball sits in the hero's right hand (look only; throws still start from the player's position)
function heroHand(out) { myArm.hand.getWorldPosition(out); return out.addScaledVector(_hf, 0.2).setY(out.y - 0.04); }
let enemies = [], balls = [], held = null, hearts = 3, inv = 0, state = 'ready', score = 0, R = rng(1), beatShown = false, recorded = false;
let goal = null; const fRay = new THREE.Raycaster(), fPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), fHit = new THREE.Vector3();
function floorAt(x, y) { fRay.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1), camera); return fRay.ray.intersectPlane(fPlane, fHit) ? Object.assign(new THREE.Vector2(clamp(fHit.x, -AW + BODY_R, AW - BODY_R), clamp(fHit.z, 0.7, AL - BODY_R)), { mine: fHit.z > 0.4 }) : null; }
let ctrl = new THREE.Vector2(), botCtrl = new THREE.Vector2(), botUntil = 0, pv = new THREE.Vector3(), shake = 0, slow = 1, slowT = 0, winT = -1, totalE = 1;
let noBallT = 0, throwInterval = 2.4, ballSpeed = 10, dodgeChance = 0.05, leadSkill = 0.3, clock = 0, pickCool = 0;

function mkBall(color) {
  const m = new THREE.Mesh(BALL_G, glossy(color, { emissive: color, emissiveIntensity: 0.15 })); m.castShadow = true; scene.add(m);
  const blob = new THREE.Mesh(blobGeo, blobMat); blob.scale.setScalar(0.7); scene.add(blob);
  const b = { m, blob, pos: new THREE.Vector3(), vel: new THREE.Vector3(), st: 'loose', owner: null, age: 0, bounced: 0, trail: [], nearMiss: false };
  balls.push(b); return b;
}
function killBall(b) { scene.remove(b.m); scene.remove(b.blob); b.m.material.dispose(); balls.splice(balls.indexOf(b), 1); }

function updateHearts() { heartsEl.innerHTML = [0, 1, 2].map(i => `<span class="${i < hearts ? '' : 'off'}">❤️</span>`).join(''); }

function buildLevel() {
  R = rng((D.seed || level * 4241) + 5);
  applyTheme(THEMES[(level - 1) % THEMES.length]);
  enemies.forEach(e => scene.remove(e.g)); enemies = [];
  [...balls].forEach(killBall); held = null;
  const fk = F.k();
  const n = Math.min(2 + Math.floor((level - 1) / 2), 5);
  throwInterval = clamp((2.9 - level * 0.12) / fk, 1.0, 3.3);
  ballSpeed = clamp((8.5 + level * 0.35) * fk, 7, 16);
  dodgeChance = Math.min(0.04 + level * 0.035, 0.38);
  leadSkill = Math.min(0.15 + level * 0.06, 0.8);
  const cols = [['#ff6b6b', '#2b2d42'], ['#ff9f43', '#2b2d42'], ['#a66bff', '#ffd23f'], ['#ff5d8f', '#ffffff'], ['#f9c74f', '#7b5cff']];
  for (let i = 0; i < n; i++) {
    const [c, a] = cols[(i + level) % cols.length];
    const g = bean(c, a, 1 + (i % 2)); g.rotation.y = 0;
    const x = (n === 1 ? 0 : -AW + 0.9 + i * (AW * 2 - 1.8) / (n - 1)), z = -3.6 - (i % 2) * 1.2;
    g.position.set(x, 0, z); scene.add(g);
    const hp = level >= 4 && i % 3 === 1 ? 2 : 1;
    enemies.push({ g, hp, maxHp: hp, alive: true, tgt: new THREE.Vector3(x, 0, z), cool: 0.8 + i * 0.7 + R() * 0.8, wind: 0, aim: null, ring: null, vy: 0, ko: 0, hitFlash: 0, dodgeT: 0, spin: 0 });
  }
  totalE = n; hearts = 3; inv = 0; score = 0; beatShown = false; recorded = false; winT = -1; slow = 1;
  player.position.set(0, 0, 4); player.rotation.set(0, Math.PI, 0); player.body.rotation.set(0, 0, 0); pv.set(0, 0, 0);
  // the first ball waits right in front of you
  const b = mkBall('#ff3d6e'); b.pos.set(0, BALL_R, 2.4); b.st = 'loose';
  ui.levels(level); ui.progress(0); ui.score(0); ui.sub(best ? 'BEST ' + best : ''); updateHearts();
}

// ---------------------------------------------------------------- actions
function nearestEnemy() { let best = null, d = 1e9; for (const e of enemies) if (e.alive) { const dd = e.g.position.distanceTo(player.position); if (dd < d) { d = dd; best = e; } } return best; }
function throwBall() {
  if (!held || state !== 'play') return;
  const e = nearestEnemy(); if (!e) return;
  const b = held; held = null; b.st = 'fly'; b.owner = 'p'; b.age = 0; b.bounced = 0;
  const from = player.position.clone().add(new THREE.Vector3(0.35, 1.0, -0.3));
  b.pos.copy(from);
  const sp = 15, tgt = e.g.position.clone().add(new THREE.Vector3(0, 0.8, 0));
  const tt = tgt.distanceTo(from) / sp; tgt.addScaledVector(e.vel || new THREE.Vector3(), tt * 0.6);
  b.vel.copy(tgt).sub(from).normalize().multiplyScalar(sp); b.vel.y += 2.2;
  player.armR.rotation.x = -2.4; player.body.rotation.x = -0.2; throwT = 0.3;
  tone(520, 0.12, 'sawtooth', 0.08, 0.4); buzz(12);
  e.incoming = b;
}
function enemyThrow(e) {
  const b = mkBall('#ffb000'); b.st = 'fly'; b.owner = 'e'; b.age = 0;
  const from = e.g.position.clone().add(new THREE.Vector3(0, 1.0, 0.5)); b.pos.copy(from);
  const aim = e.aim.clone().setY(0.85);
  b.vel.copy(aim).sub(from); b.vel.y = 0; b.vel.normalize().multiplyScalar(ballSpeed); b.vel.y = 0.6;
  e.g.armR.rotation.x = -2.6;
  tone(330, 0.1, 'sawtooth', 0.06, 0.5);
  if (e.ring) { scene.remove(e.ring); e.ring.material.dispose(); e.ring = null; }
}
function hitPlayer(b) {
  if (inv > 0 || state !== 'play' || DM.on) return;
  hearts--; inv = 1.3; updateHearts(); shake = 0.45; ui.flash(0.5);
  document.body.animate([{ filter: 'saturate(2) hue-rotate(-20deg)' }, { filter: 'none' }], { duration: 300 });
  tone(140, 0.25, 'square', 0.14, 0.5); buzz([40, 30, 60]); ui.pop('OUCH!', '#ff3355', 40, 40);
  burst(scene, player.position.clone().setY(1), ['#ffffff', '#ff3355', '#ffd23f'], 16, { speed: 0.1, up: 0.08, size: 0.6 });
  pv.addScaledVector(b.vel.clone().setY(0).normalize(), 0.25);
  b.vel.multiplyScalar(-0.3); b.vel.y = 3; b.owner = null; b.st = 'loose';
  if (held) { const hb = held; held = null; hb.st = 'loose'; hb.vel.set((Math.random() - 0.5) * 3, 3, 1); }
  if (hearts <= 0) lose();
}
function hitEnemy(e, b) {
  e.hp--; e.hitFlash = 1; shake = 0.25;
  burst(scene, e.g.position.clone().setY(1.1), ['#ffffff', '#ffd23f', b.m.material.color.getStyle()], 22, { speed: 0.14, up: 0.1, size: 0.6 });
  b.vel.set(b.vel.x * -0.2, 4, -b.vel.z * 0.25); b.owner = null; b.st = 'loose';
  if (e.hp <= 0) {
    e.alive = false; e.ko = 0.0001; e.vy = 0.24; e.kx = (e.g.position.x - player.position.x) * 0.02; e.spin = (Math.random() - 0.5) * 0.5;
    if (e.ring) { scene.remove(e.ring); e.ring = null; }
    const left = enemies.filter(x => x.alive).length;
    score += 10; ui.score(score); checkBeat();
    ui.pop(left === 0 ? 'KNOCKOUT!' : ['BONK!', 'POW!', 'BOOM!'][Math.floor(Math.random() * 3)], '#fff', 46, 28);
    tone(880, 0.1, 'square', 0.09, 0.5); setTimeout(() => tone(660, 0.18, 'triangle', 0.13, 0.4), 70); buzz([20, 30, 40]); ui.flash(0.3);
    ui.progress(1 - left / totalE);
    if (left === 0) { slow = 0.25; slowT = 0.9; winT = 1.1; }
  } else { ui.pop('HIT!', '#fff', 34, 30); tone(700, 0.08, 'square', 0.08, 0.6); }
}
function checkBeat() {
  if (score > best) { best = score; S.set('best', best); }
  if (!beatShown && D.beaten(score)) { beatShown = true; ui.pop('BEATEN!', '#fff36b', 44, 40); confetti(scene, player.position.clone().setY(2), 60); }
}
function win() {
  if (state !== 'play') return; state = 'won';
  if (!recorded) { recorded = true; F.level(true); }
  score += hearts * 5; ui.score(score); checkBeat();
  level++; S.set('level', level);
  confetti(scene, new THREE.Vector3(0, 2, 0), 100); confetti(scene, player.position.clone().setY(2), 50);
  sfx.win(); buzz([20, 40, 20, 40, 60]);
  D.won(score); B.submit(score);
  ui.win(level - 1, `${score} pts · ${'❤️'.repeat(hearts)}`);
}
function lose() {
  if (state !== 'play') return; state = 'lost';
  if (!recorded) { recorded = true; F.level(false, enemies.filter(e => !e.alive).length / totalE); }
  sfx.fail(); stickEl.style.display = 'none';
  player.body.rotation.x = -1.4;
  ui.lose('KNOCKED OUT', `${enemies.filter(e => !e.alive).length} / ${totalE} rivals out`);
}

// ---------------------------------------------------------------- input: floating thumbstick
let touch = null;
input({
  onDown: (e, st) => { if (state !== 'play') return; touch = st; stickEl.style.display = 'block'; stickEl.style.left = st.x + 'px'; stickEl.style.top = st.y + 'px'; stickEl.firstChild.style.transform = ''; },
  onMove: (dx, dy, e, st) => {
    if (!touch || state !== 'play') return;
    const vx = st.lx - st.x, vy = st.ly - st.y, L = Math.hypot(vx, vy), k = Math.min(1, L / 50);
    ctrl.set(L ? vx / L * k : 0, L ? vy / L * k : 0);
    const c = Math.min(L, 40); stickEl.firstChild.style.transform = `translate(${L ? vx / L * c : 0}px,${L ? vy / L * c : 0}px)`;
  },
  onUp: (e, st) => {
    if (!touch) return; touch = null; ctrl.set(0, 0); stickEl.style.display = 'none'; if (state !== 'play') return;
    const g = st && Math.hypot(e.clientX - st.x, e.clientY - st.y) < 12 && floorAt(e.clientX, e.clientY);   // tap your half = run there, tap the rivals = throw
    if (g && (g.mine || !held)) goal = g; else throwBall();
  },
});
ui.onTap(() => { buildLevel(); state = 'play'; B.start(); ui.els.sc.classList.remove('hc-hidden'); });
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on level 1, until the first touch,
// your bean runs to the ball, grabs it ("GOT IT!") and sidesteps rival throws (the test bot, minus the throw); no hit costs a heart
const DM = demo(null, { ready: () => state === 'play' && level === 1 && !touch, wait: 1200, ms: 3500 });

// ---------------------------------------------------------------- loop
const _v = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
loop((rawDt, t) => {
  if (slowT > 0) { slowT -= rawDt / 60; if (slowT <= 0) slow = 1; }
  const dt = rawDt * slow, ds = dt / 60;
  clock += ds;
  // crowd bob
  for (let i = 0; i < CROWD; i++) { const c = crowdData[i], hop = Math.max(0, Math.sin(t * (state === 'won' ? 14 : 5) + c.ph)) * (state === 'won' ? 0.35 : 0.1); _m.compose(_s.set(c.x, c.y + hop, c.z), _q.identity(), _v.set(1, 1, 1)); crowd.setMatrixAt(i, _m); }
  crowd.instanceMatrix.needsUpdate = true;

  if (state === 'play' || state === 'won') {
    // ---- player
    if (DM.on && state === 'play') botMove(true);
    if (touch || performance.now() < botUntil) goal = null;
    const gv = goal && new THREE.Vector2(goal.x - player.position.x, goal.y - player.position.z); if (gv && gv.length() < 0.3) goal = null; else if (gv) gv.multiplyScalar(Math.min(1, gv.length()) / gv.length());
    const c = performance.now() < botUntil ? botCtrl : goal ? gv : ctrl;
    const speed = 6.2;
    const want = _v.set(c.x, 0, c.y).multiplyScalar(speed);
    pv.lerp(want, Math.min(1, 0.25 * dt));
    if (state === 'play') player.position.addScaledVector(pv, ds);
    player.position.x = clamp(player.position.x, -AW + BODY_R, AW - BODY_R);
    player.position.z = clamp(player.position.z, 0.7, AL - BODY_R);
    const moving = pv.length() > 0.4;
    if (moving) player.rotation.y = lerpA(player.rotation.y, Math.atan2(pv.x, pv.z), 0.3);
    else { const e = nearestEnemy(); if (e) { const a = Math.atan2(e.g.position.x - player.position.x, e.g.position.z - player.position.z); player.rotation.y = lerpA(player.rotation.y, a, 0.15); } }
    const ph = t * 16;
    player.body.position.y = moving ? Math.abs(Math.sin(ph)) * 0.12 : Math.sin(t * 3) * 0.02;
    player.footL.position.z = 0.05 + (moving ? Math.sin(ph) * 0.18 : 0); player.footR.position.z = 0.05 - (moving ? Math.sin(ph) * 0.18 : 0);
    player.body.rotation.x = lerp(player.body.rotation.x, moving ? 0.18 : 0, 0.2);
    player.armR.rotation.x = lerp(player.armR.rotation.x, held ? -1.2 : (moving ? Math.sin(ph) * 0.8 : 0), 0.18);
    player.armL.rotation.x = lerp(player.armL.rotation.x, moving ? -Math.sin(ph) * 0.8 : 0, 0.18);
    inv = Math.max(0, inv - ds); player.visible = inv <= 0 || Math.floor(t * 14) % 2 === 0;
    pickCool = Math.max(0, pickCool - ds);
    heroTick(ds);

    // ---- enemies
    for (const e of enemies) {
      const g = e.g;
      if (!e.alive) {
        if (e.ko > 0) { e.ko += ds; e.vy -= 0.012 * dt; g.position.y = Math.max(0, g.position.y + e.vy * dt); g.position.z -= 0.06 * dt * (g.position.y > 0 ? 1 : 0); g.position.x += e.kx * dt; g.rotation.x = Math.min(g.rotation.x + 0.12 * dt, Math.PI / 2); g.rotation.y += e.spin * dt * (g.position.y > 0 ? 1 : 0);
          g.position.z = Math.max(g.position.z, -AL + 0.6); if (e.ko > 1.6) g.scale.setScalar(Math.max(0.001, 1 - (e.ko - 1.6) * 2)); }
        continue;
      }
      // wander: pick new target points in own half, sidestep incoming player balls
      if (g.position.distanceTo(e.tgt) < 0.2 || R() < 0.004) e.tgt.set((R() * 2 - 1) * (AW - 0.7), 0, -1.4 - R() * (AL - 2.4));
      const inc = e.incoming && e.incoming.st === 'fly' && e.incoming.owner === 'p' ? e.incoming : null;
      if (inc && !e.dodged) { e.dodged = true; if (R() < dodgeChance) { e.tgt.set(clamp(g.position.x + (g.position.x > inc.pos.x ? 1.6 : -1.6), -AW + 0.7, AW - 0.7), 0, g.position.z); e.dodgeT = 0.4; } }
      if (!inc) e.dodged = false;
      const spd = e.wind > 0 ? 0.6 : (e.dodgeT > 0 ? 7.5 : 1.8);
      e.dodgeT = Math.max(0, e.dodgeT - ds);
      _v.copy(e.tgt).sub(g.position); const dl = _v.length(); if (dl > 0.01) g.position.addScaledVector(_v.normalize(), Math.min(dl, spd * ds));
      e.vel = _v.clone().multiplyScalar(spd);
      // always face the player
      g.rotation.y = Math.atan2(player.position.x - g.position.x, player.position.z - g.position.z);
      g.body.position.y = Math.abs(Math.sin(t * 9 + g.position.x)) * 0.06;
      // throwing: cooldown -> telegraph ring at aim -> throw
      if (state === 'play') {
        if (e.wind > 0) {
          e.wind -= ds; e.g.armR.rotation.x = lerp(e.g.armR.rotation.x, -2.8, 0.2); e.g.body.rotation.x = -0.15;
          if (e.ring) { const k = Math.max(0, e.wind / 0.75); e.ring.scale.setScalar(0.8 + k * 1.2); e.ring.material.opacity = 0.9 - k * 0.5; }
          if (e.wind <= 0) { enemyThrow(e); e.cool = throwInterval * (0.8 + R() * 0.5); }
        } else {
          e.cool -= ds; e.g.armR.rotation.x = lerp(e.g.armR.rotation.x, 0, 0.1); e.g.body.rotation.x = 0;
          const busy = enemies.some(o => o !== e && o.alive && o.wind > 0);
          if (e.cool <= 0 && !busy) {
            e.wind = 0.75;
            e.aim = player.position.clone().addScaledVector(pv, leadSkill * 0.6);
            e.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ff3355', transparent: true, opacity: 0.4, depthWrite: false }));
            e.ring.position.copy(e.aim).setY(0.03); scene.add(e.ring);
          }
        }
      }
      e.hitFlash = Math.max(0, e.hitFlash - ds * 3);
      e.g.mats[0].emissive.setRGB(e.hitFlash, e.hitFlash, e.hitFlash);
    }

    // ---- balls
    for (const b of [...balls]) {
      b.age += ds;
      if (b === held && my && myArm.hand) heroHand(b.pos);
      else if (b === held) { b.pos.copy(player.position).add(_v.set(Math.sin(player.rotation.y + 0.9) * 0.55, 1.05 + player.body.position.y, Math.cos(player.rotation.y + 0.9) * 0.55)); }
      else {
        b.vel.y -= (b.st === 'fly' ? 4 : 18) * ds;
        b.pos.addScaledVector(b.vel, ds);
        if (b.pos.y < BALL_R) { b.pos.y = BALL_R; if (b.vel.y < -1) { tone(200, 0.05, 'sine', 0.06, 0.7); } b.vel.y = Math.abs(b.vel.y) * 0.5; b.vel.x *= 0.93; b.vel.z *= 0.93; if (b.st === 'fly') { b.bounced++; if (b.bounced > 0) b.st = 'loose'; } }
        if (Math.abs(b.pos.x) > AW - BALL_R) { b.pos.x = Math.sign(b.pos.x) * (AW - BALL_R); b.vel.x *= -0.6; }
        if (Math.abs(b.pos.z) > AL - BALL_R) { b.pos.z = Math.sign(b.pos.z) * (AL - BALL_R); b.vel.z *= -0.5; if (b.st === 'fly') { b.st = 'loose'; tone(150, 0.06, 'triangle', 0.08, 0.7); } }
        if (b.st === 'loose') { b.vel.x *= Math.pow(0.985, dt); b.vel.z *= Math.pow(0.985, dt); }
        // hits
        if (b.st === 'fly' && b.owner === 'e' && b.pos.y < 1.7) {
          const d = Math.hypot(b.pos.x - player.position.x, b.pos.z - player.position.z);
          if (d < BODY_R + BALL_R) hitPlayer(b);
          else if (d < 1.25 && !b.nearMiss && b.pos.z > player.position.z) { b.nearMiss = true; if (inv <= 0) { score += 2; ui.score(score); checkBeat(); ui.pop('CLOSE!', '#fff', 28, 46); tone(990, 0.06, 'sine', 0.07, 1.3); } }
        }
        if (b.st === 'fly' && b.owner === 'p') for (const e of enemies) if (e.alive && b.pos.y < 1.8 && Math.hypot(b.pos.x - e.g.position.x, b.pos.z - e.g.position.z) < BODY_R + BALL_R + 0.05) { hitEnemy(e, b); break; }
        // pick up loose balls on your side
        if (!held && b.st === 'loose' && pickCool <= 0 && state === 'play' && b.pos.y < 1 && b.pos.z > 0.3 && Math.hypot(b.pos.x - player.position.x, b.pos.z - player.position.z) < 0.85) {
          held = b; b.st = 'held'; b.owner = 'p'; pickCool = 0.3; tone(660, 0.07, 'triangle', 0.12, 1.5); buzz(8); ui.pop('GOT IT!', '#fff', 26, 52);
          player.scale.set(1.15, 0.85, 1.15);
        }
        // loose balls on the rivals' side vanish into their hands
        if (b.st === 'loose' && b.pos.z < -0.3 && b.age > 1.2) { b.m.scale.multiplyScalar(0.92); if (b.m.scale.x < 0.05) { killBall(b); continue; } }
        // too many loose balls on your side: oldest fades
      }
      b.m.position.copy(b.pos); b.m.rotation.x += b.vel.z * ds * 3; b.m.rotation.z -= b.vel.x * ds * 3;
      b.blob.position.set(b.pos.x, 0.02, b.pos.z); b.blob.scale.setScalar(0.8 / (1 + b.pos.y * 0.5));
    }
    if (balls.filter(b => b.st === 'loose' && b.pos.z > 0).length > 3) { const old = balls.find(b => b.st === 'loose' && b.pos.z > 0); old && killBall(old); }
    // safety: if nothing is in play on your side for a while, roll a fresh ball in
    if (state === 'play' && !held && !balls.some(b => b.owner === 'p' || (b.st === 'loose' && b.pos.z > 0))) {
      if ((noBallT += ds) > 1.8) { noBallT = 0; const b = mkBall('#ff3d6e'); b.pos.set((R() * 2 - 1) * (AW - 1), 2.5, 1.6 + R() * 3); b.vel.set(0, 0, 0); b.st = 'loose'; }
    }
    player.scale.lerp(_v.set(1, 1, 1), 0.15);
    // reticle above the target rival when you hold a ball
    const tgtE = held ? nearestEnemy() : null;
    reticle.visible = !!tgtE && state === 'play';
    if (tgtE) { reticle.position.copy(tgtE.g.position).setY(1.1); reticle.quaternion.copy(camera.quaternion); reticle.scale.setScalar(1 + Math.sin(t * 10) * 0.08); reticle.rotation.z += 0; }
    if (winT > 0) { winT -= rawDt / 60; if (winT <= 0) win(); }
  }

  if (state !== 'play' && state !== 'won') heroTick(rawDt / 60);
  // camera: high, behind your half, gently follows you
  shake = Math.max(0, shake - rawDt * 0.012);
  const px = state === 'ready' ? 0 : player.position.x * 0.25;
  camera.position.set(px + (Math.random() - 0.5) * shake, 14.6 + (Math.random() - 0.5) * shake, 13.4);
  camera.lookAt(px * 0.6, 0, -0.4);
  stage.followLight(_v.set(0, 0, 0));
});

applyTheme(THEMES[(level - 1) % THEMES.length]);
buildLevel(); ui.start(); ui.els.sc.classList.add('hc-hidden');
// hero bar on the start card, between the title and "tap to play"
{ const hb = heroBar({ parent: ui.els.start, onPick: () => useHero() }); hb.el.style.width = 'min(360px,100%)'; ui.els.start.querySelector('.hint').before(hb.el); }
onHeroesChange(() => { if (JSON.stringify(selectedHero()) !== myShown) useHero(); });
useHero();

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() { botMove(false); },
};
function botMove(noThrow) {
    if (state !== 'play') return;
    const p = player.position;
    let mv = null;
    // 1) dodge: rival ball on course to hit us soon → step out of its line
    for (const b of balls) {
      if (b.st !== 'fly' || b.owner !== 'e') continue;
      const rel = _v.set(p.x - b.pos.x, 0, p.z - b.pos.z), vv = new THREE.Vector3(b.vel.x, 0, b.vel.z), sp2 = vv.lengthSq();
      const tc = rel.dot(vv) / sp2; if (tc < 0 || tc > 1.1) continue;
      const closest = rel.clone().addScaledVector(vv, -tc), miss = closest.length();
      if (miss < 1.3) { let side = closest.x === 0 ? (p.x > 0 ? -1 : 1) : Math.sign(closest.x); if (Math.abs(p.x + side * 1.5) > AW - 0.6) side = -side; mv = new THREE.Vector2(side, 0); }
    }
    // dodge the telegraph ring before the throw
    if (!mv) for (const e of enemies) if (e.alive && e.wind > 0 && e.wind < 0.35 && e.aim && Math.hypot(e.aim.x - p.x, e.aim.z - p.z) < 1.0) { let side = p.x > e.aim.x ? 1 : -1; if (Math.abs(p.x + side * 1.5) > AW - 0.6) side = -side; mv = new THREE.Vector2(side, 0); }
    if (!mv && held && !noThrow) { throwBall(); mv = new THREE.Vector2(0, 0); }
    if (!mv) {
      let tb = null, d = 1e9; for (const b of balls) if (b.st === 'loose' && b.pos.z > 0.3) { const dd = Math.hypot(b.pos.x - p.x, b.pos.z - p.z); if (dd < d) { d = dd; tb = b; } }
      if (tb) mv = new THREE.Vector2(tb.pos.x - p.x, tb.pos.z - p.z).normalize();
      else mv = new THREE.Vector2(-p.x * 0.3, (3.5 - p.z) * 0.3);
    }
    botCtrl.copy(mv); botUntil = performance.now() + 220;
}
