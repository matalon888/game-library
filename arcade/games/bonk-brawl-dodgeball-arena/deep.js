// Bonk Brawl — original dodgeball arena. Drag to run and dodge, run over a ball to grab it, let go to throw.
// Knock out every rival on the far side; three hearts per level.
import { THREE, createStage, createUI, input, loop, store, mat, glossy, rounded, burst, confetti, sfx, tone, note, buzz, lerp, clamp, rng, updateParticles } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { GLTFLoader } from './kit/addons/loaders/GLTFLoader.js';
import { LEVELS, WORLDS, BOSS, TRICK, OUTFITS, genLevel } from './levels.js';
import { heroBar, selectedHero, loadHero, onHeroesChange } from './kit/heroes.js';

const NAME = 'Bonk Brawl: Dodgeball Arena';
const S = store('bonkbrawl');
const F = flow('bonkbrawl');
const B = board({ game: 'bonk-brawl', label: 'Points', limits: { maxRun: 200, maxPerSec: 30 }, mode: 'sum' });
let best = S.get('best', 0);
// v2 progress: stars per level, outfits owned, the one worn, chests opened (one per 6 stars), tutorial seen
const PG = Object.assign({ stars: {}, owned: [0], wear: 0, chests: 0, endless: 0, seen: {} }, S.get('d2', {}));
const savePG = () => S.set('d2', PG);

const stage = createStage({ fov: 48, shadowSize: 11 });
const { scene, camera } = stage;
const ui = createUI({ title: 'BONK<br>BRAWL', hint: 'Tap to play', hand: '👆' });
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
function hatMesh(hat, a, body) {
  const A = mat(a), W = mat('#ffffff'), add = (m, x = 0, y = 1.5, z = 0) => { m.position.set(x, y, z); body.add(m); return m; };
  if (hat === 'pom') { add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 6), A), 0, 1.55); add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), A), 0, 1.72); }
  else if (hat === 'crown') { for (let i = -1; i <= 1; i++) add(new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.26, 4), glossy('#ffd23f')), i * 0.2, 1.52 + (i ? 0 : 0.06)); add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.1, 14), glossy('#ffd23f')), 0, 1.42); }
  else if (hat === 'party') { add(new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.55, 12), A), 0, 1.7); add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), W), 0, 2.0); }
  else if (hat === 'prop') { add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 6), A), 0, 1.55); const bl = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 0.12), A); add(bl, 0, 1.68); bl.userData.spin = 1; body.userData.prop = bl; }
  else if (hat === 'ears') { for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.4, 4, 8), W); add(e, s * 0.2, 1.7); e.rotation.z = -s * 0.2; } }
  else if (hat === 'top') { add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 16), mat('#2b2d42')), 0, 1.43); add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.42, 16), mat('#2b2d42')), 0, 1.66); add(new THREE.Mesh(new THREE.CylinderGeometry(0.305, 0.305, 0.08, 16), A), 0, 1.54); }
  else if (hat === 'halo') { const h = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 24), glossy('#fff36b', { emissive: '#fff36b', emissiveIntensity: 0.5 })); h.rotation.x = Math.PI / 2; add(h, 0, 1.75); }
  else if (hat === 'horns') { for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.34, 8), A); add(h, s * 0.26, 1.55); h.rotation.z = -s * 0.5; } }
  else if (hat === 'sprout') { add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.3, 6), mat('#3a9f5f')), 0, 1.55); for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), mat('#52b788')); l.scale.set(1, 0.4, 0.6); add(l, s * 0.13, 1.72); l.rotation.z = s * 0.4; } }
  else if (hat === 'cap') { add(new THREE.Mesh(new THREE.SphereGeometry(0.43, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), A), 0, 1.3); add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.3), A), 0, 1.33, 0.4); }
  else if (hat === 'visor') { add(new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.07, 16), A), 0, 1.4); add(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.03, 0.3), A), 0, 1.4, 0.4); }
  else if (hat === 'star') { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), glossy('#ffd23f', { emissive: '#ffd23f', emissiveIntensity: 0.4 })); add(s, 0, 1.78); body.userData.star = s; }
  else if (hat === 'spikes') { for (let i = -1; i <= 1; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 8), A); add(sp, i * 0.17, 1.5 - Math.abs(i) * 0.05, -0.02); sp.rotation.z = -i * 0.35; } }
  else if (hat === 'crest') { add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.55), A), 0, 1.5, -0.05); }
  else if (hat === 'bosscrown') { for (let i = -2; i <= 2; i++) add(new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.34 - Math.abs(i) * 0.05, 4), glossy('#ffd23f', { emissive: '#ffb000', emissiveIntensity: 0.3 })), i * 0.17, 1.55); add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 14), glossy('#ffd23f')), 0, 1.4); }
}
function bean(color, accent, hat = 'pom') {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const m = mat(color), a = mat(accent);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.5, 6, 18), m); torso.position.y = 0.78; torso.castShadow = true;
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), mat('#ffffff')); belly.scale.set(1, 1.1, 0.5); belly.position.set(0, 0.62, 0.27);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 8, 24), a); band.rotation.x = Math.PI / 2; band.position.y = 1.08;
  const lens = (x) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), eyeW); e.position.set(x, 1.08, 0.36); const p = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), eyeB); p.position.set(x, 1.08, 0.48); const rim = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.03, 6, 16), a); rim.position.set(x, 1.08, 0.42); body.add(e, p, rim); };
  lens(-0.15); lens(0.15);
  hatMesh(hat, accent, body);
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
let player = null, beanParts = [];
function makePlayer() {
  if (player) scene.remove(player);
  const o = OUTFITS[PG.wear] || OUTFITS[0];
  player = bean(o.c, o.a, o.hat); scene.add(player); beanParts = [...player.children];
  if (typeof my !== 'undefined' && my) { player.add(my.object); beanParts.forEach(x => x.visible = false); }
}

// ---------------------------------------------------------------- my hero (Hero Lab): swaps the bean's look only; position, hitbox, throws stay the player's
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

// ---------------------------------------------------------------- rival types, level state
const TYPES = {
  g: { hp: 1, col: ['#ff6b6b', '#2b2d42'], hat: 'spikes', sc: 1, spd: 1.8, dodge: 0.06, wind: 0.75, ivm: 1 },
  d: { hp: 1, col: ['#ff9f43', '#2b2d42'], hat: 'crest', sc: 1, spd: 2.2, dodge: 0.55, wind: 0.75, ivm: 1.05 },
  t: { hp: 2, col: ['#a66bff', '#ffd23f'], hat: 'spikes', sc: 1.18, spd: 1.3, dodge: 0.04, wind: 0.85, ivm: 1.1 },
  s: { hp: 1, col: ['#3ab795', '#ffffff'], hat: 'crest', sc: 1.05, spd: 1.5, dodge: 0.08, wind: 0.8, ivm: 1.05, shield: 1 },
  f: { hp: 1, col: ['#ff5d8f', '#ffffff'], hat: 'spikes', sc: 0.85, spd: 4.2, dodge: 0.3, wind: 0.5, ivm: 0.8 },
  c: { hp: 1, col: ['#f9c74f', '#7b5cff'], hat: 'crest', sc: 1, spd: 1.9, dodge: 0.1, wind: 0.8, ivm: 1, curve: 1 },
  B: { hp: 4, col: ['#e63946', '#ffd23f'], hat: 'bosscrown', sc: 1.7, spd: 1.4, dodge: 0, wind: 1.0, ivm: 1 },
};
const W = AW - BALL_R, TOTAL = LEVELS.length;
const HPW = { g: [1, 2, 2], d: [1, 1, 2], t: [2, 3, 4], s: [1, 2, 2], f: [1, 1, 2], c: [1, 2, 2], B: [1, 1, 1] };   // hits to knock out, by world
const SPW = [1, 1.2, 1.4];
const starsOf = i => PG.stars[i] || 0;
const starTotal = () => Object.values(PG.stars).reduce((a, b) => a + b, 0);
const clearedTo = () => { let n = 0; while (n < TOTAL && starsOf(n + 1) > 0) n++; return n; };   // levels cleared in a row
let enemies = [], balls = [], pillars = [], belts = [], pickups = [], held = null, hearts = 3, inv = 0, state = 'ready', score = 0, R = rng(1), beatShown = false, recorded = false;
let spec = null, idx = 1, tries = 0, levelT = 0, st = {}, marked = null, comboN = 0, comboT = 0, meter = 0, catchT = 0, catchCool = 0, punch = 0, flashT = 0;
let ctrl = new THREE.Vector2(), botCtrl = new THREE.Vector2(), botUntil = 0, pv = new THREE.Vector3(), shake = 0, slow = 1, slowT = 0, winT = -1, totalE = 1, totalHp = 1;
let noBallT = 0, ballSpeed = 10, clock = 0, pickCool = 0, goal = null, fx = [], touch = null;
const fRay = new THREE.Raycaster(), fPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), fHit = new THREE.Vector3();
const floorRaw = (x, y) => { fRay.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1), camera); return fRay.ray.intersectPlane(fPlane, fHit) ? new THREE.Vector2(fHit.x, fHit.z) : null; };
const floorAt = (x, y) => { const r = floorRaw(x, y); return r && Object.assign(new THREE.Vector2(clamp(r.x, -AW + BODY_R, AW - BODY_R), clamp(r.y, 0.7, AL - BODY_R)), { mine: r.y > 0.4 }); };
const _p = new THREE.Vector3();
function toScreen(v) { _p.copy(v).project(camera); return [(_p.x + 1) / 2 * innerWidth, (1 - _p.y) / 2 * innerHeight]; }

// ---------------------------------------------------------------- balls, pillars, belts, pickups
function mkBall(color, gold = false) {
  const m = new THREE.Mesh(BALL_G, glossy(color, { emissive: color, emissiveIntensity: gold ? 0.7 : 0.15 })); m.castShadow = true; scene.add(m);
  if (gold) m.scale.setScalar(1.25);
  const blob = new THREE.Mesh(blobGeo, blobMat); blob.scale.setScalar(0.7); scene.add(blob);
  const b = { m, blob, pos: new THREE.Vector3(), vel: new THREE.Vector3(), st: 'loose', owner: null, age: 0, bounced: 0, nearMiss: false, gold, bank: false, hot: false, kos: 0, hit: [], cv: null, trail: [], tk: 0 };
  balls.push(b); return b;
}
function killBall(b) { scene.remove(b.m); scene.remove(b.blob); b.m.material.dispose(); for (const t of b.trail) { scene.remove(t); t.material.dispose(); } balls.splice(balls.indexOf(b), 1); }
const TR_G = new THREE.SphereGeometry(0.12, 8, 6);
function trailStep(b, ds) {
  if ((b.tk -= ds) > 0) return; b.tk = 0.025;
  const t = new THREE.Mesh(TR_G, new THREE.MeshBasicMaterial({ color: b.gold ? '#ffd23f' : b.owner === 'p' ? '#ffffff' : '#ffb000', transparent: true, opacity: 0.6, depthWrite: false }));
  t.position.copy(b.pos); t.userData.life = 1; scene.add(t); b.trail.push(t);
}
function trailFade(b, dt) {
  for (let i = b.trail.length - 1; i >= 0; i--) { const t = b.trail[i]; t.userData.life -= dt * 0.1; t.scale.setScalar(Math.max(0.01, t.userData.life)); t.material.opacity = t.userData.life * 0.6; if (t.userData.life <= 0) { scene.remove(t); t.material.dispose(); b.trail.splice(i, 1); } }
}
const beltTex = canvasTex(128, 64, (g, w, h) => { g.fillStyle = 'rgba(30,40,90,0.35)'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(34, 14); g.lineTo(72, 32); g.lineTo(34, 50); g.stroke(); });
beltTex.wrapS = beltTex.wrapT = THREE.RepeatWrapping;
const heartTex = canvasTex(96, 96, (g, w) => { g.font = '70px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('❤️', w / 2, w / 2 + 4); });
function clearField() {
  for (const e of enemies) { scene.remove(e.g); for (const r of e.rings) { scene.remove(r); r.material.dispose(); } }
  enemies = []; [...balls].forEach(killBall); held = null;
  pillars.forEach(p => scene.remove(p.m)); pillars = [];
  belts.forEach(b => { scene.remove(b.m); b.m.material.map.dispose(); b.m.material.dispose(); }); belts = [];
  pickups.forEach(p => scene.remove(p.s)); pickups = [];
  fx.forEach(f => { scene.remove(f.m); f.m.material.dispose(); }); fx = [];
}

// ---------------------------------------------------------------- level setup
function levelSpec(i) {
  if (i === 'daily') { const r = rng(D.seed || 1); return { ...genLevel(31 + (D.seed % 40), r), n: 'Daily Brawl' }; }
  if (i <= TOTAL) return LEVELS[i - 1];
  return genLevel(i, rng(i * 977 + 13));
}
function buildLevel(i) {
  idx = i; spec = levelSpec(i); tries++;
  R = rng((D.seed || (typeof i === 'number' ? i : 77) * 4241) + 5 + tries * 17);
  applyTheme(THEMES[typeof i === 'number' ? Math.min(2, spec.w) : 3]);
  clearField();
  const fk = F.k(), bossCfg = typeof i === 'number' ? BOSS[i] : null;
  ballSpeed = clamp(spec.bs * fk, 5.5, 14);
  const ivBase = clamp(spec.iv / fk, 1.3, 6);
  totalE = spec.r.length; totalHp = 0;
  spec.r.forEach(([code, x, z, hpOver], k) => {
    const T = TYPES[code], boss = code === 'B' ? bossCfg || BOSS[10] : null, hp = boss ? boss.hp : (hpOver || HPW[code][Math.min(2, spec.w)]);
    const g = bean(T.col[0], T.col[1], T.hat); g.scale.setScalar(T.sc); g.position.set(x, 0, z); scene.add(g);
    let sh = null;
    if (T.shield || (boss && boss.shield)) { sh = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.95, 18, 1, true, -0.225 * Math.PI, 0.45 * Math.PI), new THREE.MeshStandardMaterial({ color: '#8fe9ff', emissive: '#37c8ff', emissiveIntensity: 0.5, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false })); sh.position.y = 0.8; g.add(sh); }
    totalHp += hp;
    enemies.push({ g, T, code, boss, hp, maxHp: hp, alive: true, home: new THREE.Vector3(x, 0, z), tgt: new THREE.Vector3(x, 0, z), cool: (spec.soft ? 2.2 : 0.9) + k * 0.7 + R() * 0.8, wind: 0, aims: [], rings: [], vy: 0, ko: 0, hitFlash: 0, dodgeT: 0, spin: 0, recover: 0, stun: 0, sh, sc: T.sc, iv: ivBase * T.ivm * (boss ? 1 : 1), vel: new THREE.Vector3(), dodged: new Set(), shieldUp: !!sh, id: k });
  });
  enemies.forEach(drawPips);
  for (const [x, z, r] of spec.pil || []) {
    const m = new THREE.Group(), c = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, 1.5, 20), glossy(theme.line)); c.position.y = 0.75; c.castShadow = true;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.1, r * 1.1, 0.12, 20), glossy(theme.rail)); cap.position.y = 1.55; m.add(c, cap); m.position.set(x, 0, z); scene.add(m); pillars.push({ x, z, r, m });
  }
  for (const [z0, z1, vx] of spec.cv || []) {
    const tx = beltTex.clone(); tx.needsUpdate = true; tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(AW * 2 / 1.1, 1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(AW * 2, z1 - z0), new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; if (vx < 0) m.rotation.z = Math.PI; m.position.set(0, 0.02, (z0 + z1) / 2); scene.add(m); belts.push({ z0, z1, vx, m });
  }
  hearts = spec.hearts || 3; inv = 0; score = 0; beatShown = false; recorded = false; winT = -1; slow = 1; slowT = 0; levelT = 0; marked = null; comboN = 0; comboT = 0; meter = 0; catchT = 0; catchCool = 0; goal = null; noBallT = 0;
  st = { trick: false, hits: 0, close: 0, catches: 0, kos: 0, heartSpawned: false, byBank: 0 };
  player.position.set(0, 0, 4); player.rotation.set(0, Math.PI, 0); player.body.rotation.set(0, 0, 0); pv.set(0, 0, 0); player.visible = true;
  const nb = spec.balls === undefined ? 1 : spec.balls;
  const slots = [[0, 2.4], [-1.7, 1.6], [1.7, 1.6]];
  for (let k = 0; k < nb; k++) { const b = mkBall('#ff3d6e'); b.pos.set(slots[k][0], BALL_R, slots[k][1]); }
  if (spec.gold) { const b = mkBall('#ffd23f', true); b.gold = true; b.pos.set(spec.gold[0], BALL_R * 1.25, spec.gold[1]); }
  ui.levels(typeof i === 'number' ? i : 31); ui.progress(0); ui.score(0); updateHearts(); updateMeter(); updateSub();
}
function drawPips(e) {
  if (e.maxHp < 2) return;
  if (!e.pip) { const c = document.createElement('canvas'); c.width = 200; c.height = 40; const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; e.pip = { c, tx, s: new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, depthTest: false })) }; e.pip.s.scale.set(0.35 * Math.min(e.maxHp, 10) + 0.2, 0.2 * 0.35 * 5 / 1, 1); e.pip.s.scale.set(Math.min(e.maxHp, 10) * 0.28 + 0.2, 0.28, 1); e.pip.s.position.y = 2.15; e.pip.s.renderOrder = 8; e.g.add(e.pip.s); }
  const g = e.pip.c.getContext('2d'), n = Math.min(e.maxHp, 10); g.clearRect(0, 0, 200, 40);
  for (let i = 0; i < n; i++) { g.beginPath(); g.arc(100 + (i - (n - 1) / 2) * 18, 20, 7, 0, 7); g.fillStyle = i < e.hp ? '#ffffff' : 'rgba(0,0,0,0.35)'; g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(0,0,0,0.5)'; g.stroke(); }
  e.pip.s.scale.x = (n * 18 + 12) / 200 * 2.6 * 1; e.pip.s.scale.y = 0.52; e.pip.tx.needsUpdate = true;
}
function updateHearts() { heartsEl.innerHTML = [0, 1, 2].map(i => `<span class="${i < hearts ? '' : 'off'}">❤️</span>`).join(''); }
function updateSub() { const tr = TRICK[spec.trick]; ui.sub(tr ? `${st.trick ? '✅' : tr[2]} ${tr[0]}${spec.trick === 'fast' && !st.trick ? ' · ' + spec.par + 's' : ''}` : ''); }
function trick(name) {
  if (spec.trick !== name || st.trick || state !== 'play') return; st.trick = true; updateSub();
  score += 20; ui.score(score); wpop('⭐ ' + TRICK[name][0] + '!', player.position, '#ffd23f', 30, 1.9); sfx.win && 0; note(84, 0.3, 0.16); setTimeout(() => note(88, 0.4, 0.16), 90); buzz(30);
}

// ---------------------------------------------------------------- world-space popups + rings
function wpop(text, pos, color = '#fff', size = 28, lift = 1.8) {
  const [x, y] = toScreen(_v.copy(pos).setY(lift)), d = document.createElement('div'); d.className = 'bb-pop'; d.textContent = text;
  d.style.cssText = `left:${clamp(x, 60, innerWidth - 60)}px;top:${y}px;color:${color};font-size:${size}px`; document.body.appendChild(d); setTimeout(() => d.remove(), 900);
}
function shockwave(pos, color = '#ffffff', size = 1) {
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false })); m.position.copy(pos).setY(Math.max(0.05, pos.y * 0.3)); m.scale.setScalar(0.3 * size);
  m.userData = { life: 1, size }; scene.add(m); fx.push({ m });
}
function fxStep(dt) {
  for (let i = fx.length - 1; i >= 0; i--) { const m = fx[i].m, u = m.userData; u.life -= dt * 0.05; m.scale.setScalar((1.8 - u.life * 1.5) * u.size * 1.6); m.material.opacity = Math.max(0, u.life); if (u.life <= 0) { scene.remove(m); m.material.dispose(); fx.splice(i, 1); } }
}

// ---------------------------------------------------------------- throwing: aim, bank off the glass, pierce with gold
function segHitsPillar(ax, az, bx, bz, pad) {
  for (const p of pillars) { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1, t = clamp(((p.x - ax) * dx + (p.z - az) * dz) / l2, 0, 1); if (Math.hypot(ax + dx * t - p.x, az + dz * t - p.z) < p.r + pad) return true; }
  return false;
}
function pickTarget() { if (marked && marked.alive) return marked; let best = null, d = 1e9; for (const e of enemies) if (e.alive) { const dd = e.g.position.distanceTo(player.position); if (dd < d) { d = dd; best = e; } } return best; }
// returns { x, z, bank, len } the point to throw at (mirrored target when the throw banks off a side wall)
function planThrow(e, gold) {
  const P = player.position, T = e.g.position, sp = 15, dl = Math.hypot(T.x - P.x, T.z - P.z), tt = dl / sp;
  const tx = T.x + e.vel.x * tt * 0.6, tz = T.z + e.vel.z * tt * 0.6;
  const fx_ = P.x - T.x, fz_ = P.z - T.z, fl = Math.hypot(fx_, fz_) || 1, fxn = fx_ / fl, fzn = fz_ / fl;   // rival's front (it faces you)
  const shielded = e.shieldUp && !gold;
  const arrives = (cx, cz) => { const dx = tx - cx, dz = tz - cz, l = Math.hypot(dx, dz) || 1; return -(dx / l) * fxn + -(dz / l) * fzn; };   // cos of angle between where the ball came from and the shield front
  const direct = { x: tx, z: tz, bank: false, len: Math.hypot(tx - P.x, tz - P.z) };
  const directOk = !segHitsPillar(P.x, P.z, tx, tz, BALL_R) && !(shielded && arrives(P.x, P.z) > 0.5);
  if (directOk) return direct;
  let best = null;
  for (const s of [-1, 1]) {
    const mx = s * 2 * W - tx, mz = tz, X = s * W;
    if (Math.abs(mx - P.x) < 0.01) continue;
    const zc = P.z + (mz - P.z) * (X - P.x) / (mx - P.x);
    if (Math.abs(zc) > AL - 0.6 || Math.abs(P.x) > W - 0.05) continue;
    if (segHitsPillar(P.x, P.z, X, zc, BALL_R) || segHitsPillar(X, zc, tx, tz, BALL_R)) continue;
    if (shielded && arrives(X, zc) > 0.5) continue;
    if (e.alive && Math.hypot(X - tx, zc - tz) < 0.5) continue;
    const len = Math.hypot(X - P.x, zc - P.z) + Math.hypot(tx - X, tz - zc);
    if (!best || len < best.len) best = { x: mx, z: mz, bank: true, len, X, zc };
  }
  return best || direct;
}
function throwBall() {
  if (!held || state !== 'play') return;
  const e = pickTarget(); if (!e) return;
  const b = held; held = null; b.st = 'fly'; b.owner = 'p'; b.age = 0; b.bounced = 0; b.bank = false; b.hit = []; b.kos = 0;
  const plan = planThrow(e, b.gold), P = player.position;
  b.pos.set(P.x + Math.sin(player.rotation.y + 0.9) * 0.45, 1.0, P.z + Math.cos(player.rotation.y + 0.9) * 0.45);
  const sp = b.gold ? 18 : b.hot ? 20 : 15, dx = plan.x - b.pos.x, dz = plan.z - b.pos.z, L = Math.hypot(dx, dz) || 1, t = L / sp;
  b.vel.set(dx / L * sp, 0, dz / L * sp); b.vel.y = (0.9 - 1.0 + 2 * t * t) / t;
  player.armR.rotation.x = -2.4; player.body.rotation.x = -0.2; throwT = 0.3; player.scale.set(0.88, 1.15, 0.88);
  tone(b.gold ? 760 : 520, 0.12, 'sawtooth', 0.08, 0.4); buzz(12);
  shockwave(b.pos.clone(), b.gold ? '#ffd23f' : '#ffffff', 0.5);
}

// ---------------------------------------------------------------- rivals
function enemyThrow(e) {
  const n = e.aims.length;
  for (let i = 0; i < n; i++) {
    const b = mkBall(e.boss ? '#ff6b3d' : '#ffb000'); b.st = 'fly'; b.owner = 'e'; b.age = 0;
    const from = e.g.position.clone().add(new THREE.Vector3(0, 1.0 * e.sc, 0.5 * e.sc)); b.pos.copy(from);
    const aim = e.aims[i].clone().setY(0.85);
    b.vel.copy(aim).sub(from); b.vel.y = 0; const dist = b.vel.length(); b.vel.normalize().multiplyScalar(ballSpeed); b.vel.y = 0.6;
    if (e.T.curve || (e.boss && e.boss.curve && i % 2 === 0)) b.cv = { aim: aim.clone(), phi: (R() < 0.5 ? -1 : 1) * 0.55, total: dist };
  }
  e.g.armR.rotation.x = -2.6; tone(e.boss ? 240 : 330, 0.1, 'sawtooth', 0.06, 0.5);
  for (const r of e.rings) { scene.remove(r); r.material.dispose(); } e.rings = []; e.aims = [];
  e.recover = e.sh ? 0.6 : 0; e.cool = e.iv * (0.8 + R() * 0.5);
}
// the ring follows you until 0.35 s before the throw, then locks: move after it locks
function aimAt(e, i, a) {
  const lead = clamp(0.15 + (typeof idx === 'number' ? idx : 20) * 0.03, 0.15, 0.8) * 0.6;
  a.copy(player.position).addScaledVector(pv, lead); a.x += e.offs[i]; if (spec.soft) a.x += (a.x > 0 ? -1 : 1) * 1.6;
  a.x = clamp(a.x, -AW + 0.3, AW - 0.3); a.z = clamp(a.z, 0.2, AL - 0.3);
}
function startWind(e) {
  const T = e.T, n = e.boss ? e.boss.volley : 1;
  e.wind = T.wind * [1, 0.85, 0.72][Math.min(2, spec.w)] * (e.boss && e.hp <= 2 ? 0.8 : 1); e.windMax = e.wind; e.offs = [];
  for (let i = 0; i < n; i++) {
    const a = new THREE.Vector3(); e.offs.push(n > 1 ? (i - (n - 1) / 2) * 1.25 : 0); aimAt(e, i, a); e.aims.push(a);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ff3355', transparent: true, opacity: 0.4, depthWrite: false })); ring.position.copy(a).setY(0.03); scene.add(ring); e.rings.push(ring);
  }
}
function hitEnemy(e, b) {
  const g = e.g.position, bpos = b.pos;
  // a shield blocks everything except a golden ball, a side/back hit (bank shot) or a rival with its shield down
  if (e.shieldUp && !b.gold) {
    const dx = b.vel.x, dz = b.vel.z, l = Math.hypot(dx, dz) || 1, fx_ = player.position.x - g.x, fz_ = player.position.z - g.z, fl = Math.hypot(fx_, fz_) || 1;
    if (-(dx / l) * (fx_ / fl) + -(dz / l) * (fz_ / fl) > 0.5) {
      b.vel.set(-b.vel.x * 0.35, 3.5, -b.vel.z * 0.35); b.owner = null; b.st = 'loose'; shake = 0.3; shockwave(bpos.clone().setY(1), '#8fe9ff', 0.9);
      wpop('CLANG!', g, '#8fe9ff', 30, 2.3); tone(1200, 0.1, 'square', 0.1, 0.5); buzz(15); return;
    }
  }
  e.hp--; drawPips(e); e.hitFlash = 1; shake = 0.25; punch = 0.5; b.hit.push(e);
  burst(scene, g.clone().setY(1.1), ['#ffffff', '#ffd23f', b.m.material.color.getStyle()], 22, { speed: 0.14, up: 0.1, size: 0.6 });
  shockwave(g.clone().setY(1), b.gold ? '#ffd23f' : '#ffffff', 1);
  if (b.gold) { b.vel.multiplyScalar(0.92); } else { b.vel.set(b.vel.x * -0.2, 4, -b.vel.z * 0.25); b.owner = null; b.st = 'loose'; }
  slow = 0.12; slowT = 0.07;
  if (e.hp <= 0) {
    e.alive = false; e.ko = 0.0001; e.vy = 0.24; e.kx = (g.x - player.position.x) * 0.02; e.spin = (Math.random() - 0.5) * 0.5;
    for (const r of e.rings) { scene.remove(r); r.material.dispose(); } e.rings = []; e.aims = []; e.wind = 0; if (e.sh) e.sh.visible = false;
    if (marked === e) marked = null;
    const left = enemies.filter(x => x.alive).length;
    st.kos++; b.kos++; comboN = comboT > 0 ? comboN + 1 : 1; comboT = 3; if (comboN >= 2) trick('combo');
    if (b.bank) { st.byBank++; trick('bank'); score += 10; wpop('BANK SHOT! +10', g, '#ffd23f', 26, 2.9); meter += 0.2; }
    if (b.gold && b.kos >= 2) trick('pierce');
    const pts = 10 * Math.min(comboN, 5); score += pts; ui.score(score); checkBeat(); meter += 0.25;
    const word = left === 0 ? 'KNOCKOUT!' : comboN >= 5 ? 'UNSTOPPABLE!' : comboN >= 3 ? 'x' + comboN + ' MEGA COMBO!' : comboN === 2 ? 'x2 COMBO!' : ['BONK!', 'POW!', 'BOOM!'][Math.floor(Math.random() * 3)];
    ui.pop(word, comboN >= 3 ? '#ffd23f' : '#fff', 40 + Math.min(comboN, 5) * 5, 28); wpop('+' + pts, g, '#fff', 30 + comboN * 3, 2.4);
    tone(880 + comboN * 90, 0.1, 'square', 0.09, 0.5); setTimeout(() => tone(660 + comboN * 90, 0.18, 'triangle', 0.13, 0.4), 70); buzz([20, 30, 40]); ui.flash(0.3 + comboN * 0.05);
    ui.progress(1 - enemies.reduce((a, x) => a + (x.alive ? x.hp : 0), 0) / totalHp);
    if (comboN >= 3) { confetti(scene, g.clone().setY(2), 30); shake = 0.5; }
    if (left === 0) { slow = 0.25; slowT = 0.9; winT = 1.1; punch = 1; confetti(scene, g.clone().setY(2), 60); }
  } else {
    ui.pop(e.boss ? 'OUCH! ' + e.hp + ' left' : 'HIT!', '#fff', 34, 30); tone(700, 0.08, 'square', 0.08, 0.6); score += 3; ui.score(score); meter += 0.1;
    ui.progress(1 - enemies.reduce((a, x) => a + (x.alive ? x.hp : 0), 0) / totalHp);
    if (e.boss) { e.stun = 1.5; e.iv *= 0.86; e.cool = 1.6; e.wind = 0; for (const r of e.rings) { scene.remove(r); r.material.dispose(); } e.rings = []; e.aims = []; wpop('STUNNED!', g, '#ffd23f', 28, 3.4); }
  }
  checkMeter();
}
function hitPlayer(b) {
  if (inv > 0 || state !== 'play') return;
  hearts--; st.hits++; inv = 1.3; updateHearts(); shake = 0.45; ui.flash(0.5); comboN = 0; comboT = 0; meter = Math.max(0, meter - 0.15); updateMeter();
  document.body.animate([{ filter: 'saturate(2) hue-rotate(-20deg)' }, { filter: 'none' }], { duration: 300 });
  tone(140, 0.25, 'square', 0.14, 0.5); buzz([40, 30, 60]); ui.pop('OUCH!', '#ff3355', 40, 40); punch = 0.4;
  burst(scene, player.position.clone().setY(1), ['#ffffff', '#ff3355', '#ffd23f'], 16, { speed: 0.1, up: 0.08, size: 0.6 });
  pv.addScaledVector(b.vel.clone().setY(0).normalize(), 0.25);
  b.vel.multiplyScalar(-0.3); b.vel.y = 3; b.owner = null; b.st = 'loose'; b.cv = null;
  if (held) { const hb = held; held = null; hb.st = 'loose'; hb.vel.set((Math.random() - 0.5) * 3, 3, 1); }
  if (hearts <= 0) lose();
}
function checkBeat() { if (score > best) { best = score; S.set('best', best); } if (!beatShown && D.beaten(score)) { beatShown = true; ui.pop('BEATEN!', '#fff36b', 44, 40); confetti(scene, player.position.clone().setY(2), 60); } }
// the style meter: close calls, catches, KOs and bank shots fill it; full = a golden ball (or a heart when you are hurt) drops in
const meterEl = document.createElement('div'); meterEl.className = 'bb-meter'; meterEl.innerHTML = '<i></i><b>⭐</b>'; document.body.appendChild(meterEl);
function updateMeter() { meterEl.firstChild.style.width = clamp(meter, 0, 1) * 100 + '%'; }
function checkMeter() {
  if (meter >= 1 && state === 'play') {
    meter = 0;
    if (hearts < 3 && R() < 0.5) { dropHeart(); wpop('HEART!', player.position, '#ff5d8f', 30, 2.6); }
    else if (!balls.some(x => x.gold)) { const b = mkBall('#ffd23f', true); b.gold = true; b.pos.set((R() * 2 - 1) * (AW - 1), 3, 1.6 + R() * 2.5); wpop('GOLD BALL!', player.position, '#ffd23f', 34, 2.6); ui.flash(0.4); }
    note(91, 0.35, 0.16); buzz(25);
  }
  updateMeter();
}
function dropHeart(x, z) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTex, depthTest: false })); s.scale.set(0.9, 0.9, 1);
  const p = { s, x: x ?? (R() * 2 - 1) * (AW - 1.2), z: z ?? 1.6 + R() * 2.4, t: 0 }; s.position.set(p.x, 1.2, p.z); s.renderOrder = 9; scene.add(s); pickups.push(p);
}
function win() {
  if (state !== 'play') return; state = 'won';
  if (!recorded) { recorded = true; F.level(true); }
  score += hearts * 5; if (spec.trick === 'fast' && levelT <= spec.par) { st.trick = true; score += 20; }
  if (spec.trick === 'flawless' && st.hits === 0) { st.trick = true; score += 20; }
  score = Math.min(score, 199); ui.score(score); checkBeat();
  const stars = 1 + (hearts >= 2 ? 1 : 0) + (st.trick ? 1 : 0);
  confetti(scene, new THREE.Vector3(0, 2, 0), 100); confetti(scene, player.position.clone().setY(2), 50);
  sfx.win(); buzz([20, 40, 20, 40, 60]); D.won(score); B.submit(score);
  let chestMsg = '';
  if (typeof idx === 'number' && idx <= TOTAL) {
    const was = starsOf(idx), prevTotal = starTotal(); if (stars > was) PG.stars[idx] = stars;
    const earned = Math.floor(starTotal() / 6);
    while (PG.chests < earned) { PG.chests++; const locked = OUTFITS.map((o, i) => i).filter(i => !PG.owned.includes(i)); if (locked.length) { const pick = locked[Math.floor(Math.random() * locked.length)]; PG.owned.push(pick); PG.wear = pick; chestMsg = `🎁 NEW OUTFIT: ${OUTFITS[pick].n}`; makePlayer(); } }
    if (idx === TOTAL && was === 0) PG.seen.finale = 1;
    savePG(); result.show({ win: true, stars, prev: was, chestMsg, prevTotal });
  } else { PG.endless = Math.max(PG.endless, typeof idx === 'number' ? idx - TOTAL : 0); savePG(); result.show({ win: true, stars, prev: 0, chestMsg: '', prevTotal: starTotal() }); }
}
function lose() {
  if (state !== 'play') return; state = 'lost';
  if (!recorded) { recorded = true; F.level(false, enemies.filter(e => !e.alive).length / totalE); }
  sfx.fail(); stickEl.style.display = 'none'; player.body.rotation.x = -1.4;
  result.show({ win: false });
}

// ---------------------------------------------------------------- UI: result card, level map, closet
const CSS2 = `
.bb-pop{position:fixed;transform:translate(-50%,-50%);font-weight:800;pointer-events:none;z-index:7;white-space:nowrap;text-shadow:0 3px 0 rgba(0,0,0,.2);animation:bbup .9s ease-out forwards}
@keyframes bbup{0%{opacity:0;transform:translate(-50%,-30%) scale(.6)}20%{opacity:1;transform:translate(-50%,-50%) scale(1.15)}100%{opacity:0;transform:translate(-50%,-190%) scale(1)}}
.bb-meter{position:fixed;left:50%;bottom:calc(74px + env(safe-area-inset-bottom));width:min(210px,54vw);height:16px;transform:translateX(-50%);border-radius:10px;background:rgba(255,255,255,.55);z-index:6;pointer-events:none;box-shadow:0 3px 0 rgba(0,0,0,.12);overflow:visible}
.bb-meter i{position:absolute;left:0;top:0;bottom:0;width:0;border-radius:10px;background:linear-gradient(90deg,#ffd23f,#ff8c42);transition:width .25s}
.bb-meter b{position:absolute;right:-12px;top:-7px;font-size:26px;color:#ffd23f;text-shadow:0 2px 0 rgba(0,0,0,.25)}
.bb-hand{position:fixed;font-size:46px;z-index:7;pointer-events:none;transform:translate(-30%,-10%);animation:bbtap 1s ease-in-out infinite}
@keyframes bbtap{50%{transform:translate(-30%,10%) scale(.9)}}
.bb-card{position:fixed;inset:0;z-index:12;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:20px;text-align:center;background:rgba(20,20,60,.32)}
.bb-card.hidden,.bb-map.hidden,.bb-closet.hidden{display:none}
.bb-card h2{margin:0;font-size:clamp(34px,10vw,54px);line-height:1;text-shadow:0 5px 0 rgba(0,0,0,.18)}
.bb-card .nm{font-size:18px;font-weight:600;opacity:.9}
.bb-stars{display:flex;gap:6px;font-size:64px;line-height:1;margin:4px 0}
.bb-stars span{filter:grayscale(1) opacity(.35);transition:transform .35s cubic-bezier(.2,2,.4,1),color .2s;transform:scale(.7)}
.bb-stars span.on{filter:none;transform:scale(1.15);text-shadow:0 4px 0 rgba(0,0,0,.2)}
.bb-line{font-size:19px;font-weight:700;text-shadow:0 2px 0 rgba(0,0,0,.18)}
.bb-btns{display:flex;gap:12px;align-items:center;margin-top:8px}
.bb-btns .hc-btn{font-size:20px;padding:10px 22px}
.bb-btns .big{font-size:28px;padding:14px 46px;background:#3cc46a;box-shadow:0 6px 0 #2a9a50}
.bb-btns .sm{background:rgba(255,255,255,.28);box-shadow:0 4px 0 rgba(0,0,0,.15);padding:10px 16px}
.bb-map,.bb-closet{position:fixed;inset:0;z-index:20;display:flex;flex-direction:column;background:linear-gradient(180deg,#7ea6ff,#cfe0ff)}
.bb-closet{z-index:22;background:linear-gradient(180deg,#b79cff,#ecdcff)}
.bb-mh{display:flex;align-items:center;gap:10px;padding:calc(12px + env(safe-area-inset-top)) 14px 10px 74px;font-weight:800;font-size:19px;background:rgba(0,0,40,.18)}
.bb-mh .grow{flex:1;height:14px;border-radius:8px;background:rgba(255,255,255,.4);position:relative;overflow:hidden}
.bb-mh .grow i{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,#ffd23f,#ff8c42);border-radius:8px}
.bb-mh .hc-btn{font-size:18px;padding:6px 14px}
.bb-ms{flex:1;overflow-y:auto;padding:10px 0 40px;-webkit-overflow-scrolling:touch;touch-action:pan-y}
.bb-wb{margin:22px 14px 8px;padding:10px 14px;border-radius:18px;font-weight:800;font-size:22px;display:flex;justify-content:space-between;color:#fff;box-shadow:0 5px 0 rgba(0,0,0,.15)}
.bb-row{display:flex;flex-direction:column;align-items:center;margin:6px 0}
.bb-n{width:66px;height:66px;border-radius:50%;border:0;font:inherit;font-weight:800;font-size:26px;color:#fff;background:#8aa0d8;box-shadow:0 6px 0 rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center;cursor:pointer;pointer-events:auto}
.bb-n.done{background:#3cc46a;box-shadow:0 6px 0 #2a9a50}
.bb-n.cur{background:#ff5d8f;box-shadow:0 6px 0 #c23a68;animation:hcpulse 1.1s ease-in-out infinite}
.bb-n.lock{background:#aab4cf;color:#e8ecf8;opacity:.8;box-shadow:0 5px 0 rgba(0,0,0,.12)}
.bb-n.boss{width:84px;height:84px;font-size:34px;border-radius:26px}
.bb-sr{font-size:17px;letter-spacing:2px;margin-top:2px}
.bb-sr i{font-style:normal;filter:grayscale(1) opacity(.4)}
.bb-grid{flex:1;overflow-y:auto;display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:16px;align-content:start}
.bb-o{border-radius:18px;background:rgba(255,255,255,.5);padding:10px 4px;font-weight:800;font-size:14px;text-align:center;color:#3a2d6b;box-shadow:0 4px 0 rgba(0,0,0,.12);pointer-events:auto;cursor:pointer}
.bb-o.on{outline:4px solid #ff5d8f}.bb-o.lock{opacity:.55;cursor:default}
.bb-o .dot{width:54px;height:54px;border-radius:50%;margin:0 auto 4px;display:flex;align-items:center;justify-content:center;font-size:30px;border:4px solid rgba(255,255,255,.8)}
`;
{ const s = document.createElement('style'); s.textContent = CSS2; document.head.appendChild(s); }
const HATS = { pom: '🔴', crown: '👑', party: '🎉', prop: '🚁', ears: '🐰', top: '🎩', halo: '😇', horns: '😈', sprout: '🌱', cap: '🧢', visor: '😎', star: '⭐' };
const mk = (cls, html = '') => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; document.body.appendChild(d); return d; };
const btn = (txt, cls, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'hc-btn ' + cls; b.innerHTML = txt; b.addEventListener('pointerdown', e => e.stopPropagation()); b.addEventListener('click', e => { e.stopPropagation(); fn(); }); return b; };
const worldOf = i => typeof i === 'number' && i <= TOTAL ? LEVELS[i - 1].w : 2;

const result = (() => {
  const el = mk('bb-card hidden'); let timer = [], again = null;
  const clear = () => { timer.forEach(clearTimeout); timer = []; };
  return {
    hide() { clear(); el.classList.add('hidden'); },
    show(r) {
      clear(); el.innerHTML = ''; el.classList.remove('hidden');
      const T = TRICK[spec.trick], num = typeof idx === 'number' && idx <= TOTAL ? `LEVEL ${idx}` : 'ARENA';
      const next = () => startLevel(typeof idx === 'number' ? idx + 1 : idx), retry = () => startLevel(idx), map = () => openMap();
      const ph = (html, cls = '') => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; el.appendChild(d); return d; };
      if (r.win) {
        const h = document.createElement('h2'); h.textContent = 'CLEARED!'; el.appendChild(h); ph(`${num} · ${spec.n.toUpperCase()}`, 'nm');
        const sr = ph('<span>⭐</span><span>⭐</span><span>⭐</span>', 'bb-stars');
        [...sr.children].forEach((s, i) => { if (i < r.stars) timer.push(setTimeout(() => { s.classList.add('on'); note(72 + i * 4, 0.3, 0.16); buzz(10); }, 450 + i * 330)); });
        ph(`${score} pts · ${'❤️'.repeat(hearts)}`, 'bb-line');
        if (T) ph(`${st.trick ? '✅' : T[2]} ${T[0]} · ${T[1]}`, 'bb-line');
        if (r.chestMsg) timer.push(setTimeout(() => { ph(r.chestMsg, 'bb-line').style.color = '#ffd23f'; note(86, 0.4, 0.18); confetti(scene, new THREE.Vector3(0, 2, 2), 40); }, 1500));
        else if (typeof idx === 'number' && idx <= TOTAL) { const tot = starTotal(), nx = (Math.floor(tot / 6) + 1) * 6; ph(`🎁 ${nx - tot} ⭐ to the next chest`, 'bb-line'); }
        const row = ph('', 'bb-btns'); row.append(btn('▶️ NEXT', 'big', next)); const row2 = ph('', 'bb-btns'); row2.append(btn('🔄', 'sm', retry), btn('🗺', 'sm', map), btn('Share', 'sm', () => D.share(score)));
        again = null;
      } else {
        const left = enemies.filter(e => e.alive).reduce((a, e) => a + e.hp, 0);
        const h = document.createElement('h2'); h.textContent = 'KNOCKED OUT'; el.appendChild(h);
        ph(left <= 1 ? `SO CLOSE: ${left} hit left!` : `${totalE - enemies.filter(e => e.alive).length} / ${totalE} rivals out`, 'bb-line');
        ph(`${num} · ${spec.n.toUpperCase()}`, 'nm');
        const row = ph('', 'bb-btns'); row.append(btn('🔄 RETRY', 'big', retry)); row.append(btn('🗺', 'sm', map));
        again = retry; el.onpointerdown = e => { if (e.target === el && again) again(); };
      }
    },
  };
})();

const mapEl = mk('bb-map hidden'), closetEl = mk('bb-closet hidden');
function openMap() { result.hide(); state = state === 'play' ? state : 'map'; stickEl.style.display = 'none'; renderMap(); mapEl.classList.remove('hidden'); const cur = mapEl.querySelector('.cur'); if (cur) cur.scrollIntoView({ block: 'center' }); }
function closeMap() { mapEl.classList.add('hidden'); closetEl.classList.add('hidden'); }
function renderMap() {
  const tot = starTotal(), pct = (tot % 6) / 6 * 100, cl = clearedTo();
  mapEl.innerHTML = '';
  const hd = document.createElement('div'); hd.className = 'bb-mh'; hd.innerHTML = `<span>⭐ ${tot}</span><div class="grow"><i style="width:${pct}%"></i></div><span>🎁</span>`;
  hd.append(btn('👕', '', openCloset), btn('❌', '', () => { closeMap(); if (state === 'map') { state = 'ready'; startLevel(Math.min(clearedTo() + 1, TOTAL + 1 + PG.endless)); } }));
  const sc = document.createElement('div'); sc.className = 'bb-ms';
  if (cl >= TOTAL) { const r = document.createElement('div'); r.className = 'bb-row'; const n = btn('∞', 'bb-n', () => startLevel(TOTAL + 1 + PG.endless)); n.classList.add('boss'); n.style.background = '#ff5d8f'; r.append(n); const s = document.createElement('div'); s.className = 'bb-sr'; s.textContent = 'ENDLESS ARENAS · ' + PG.endless; r.append(s); sc.append(r); }
  for (let w = 2; w >= 0; w--) {
    const wsum = LEVELS.reduce((a, l, i) => a + (l.w === w ? starsOf(i + 1) : 0), 0);
    const wb = document.createElement('div'); wb.className = 'bb-wb'; wb.style.background = WORLDS[w].col; wb.innerHTML = `<span>${WORLDS[w].icon} ${WORLDS[w].name}</span><span>⭐ ${wsum}/30</span>`; sc.append(wb);
    for (let i = 10 * w + 10; i > 10 * w; i--) {
      const s0 = starsOf(i), open = i <= cl + 1, row = document.createElement('div'); row.className = 'bb-row'; row.style.transform = `translateX(${Math.sin(i * 1.1) * 72}px)`;
      const boss = !!BOSS[i], n = btn(boss ? '👑' : i, 'bb-n' + (boss ? ' boss' : '') + (!open ? ' lock' : i === cl + 1 ? ' cur' : s0 ? ' done' : ''), () => { if (open) startLevel(i); else wpop2('🔒'); });
      row.append(n); const sr = document.createElement('div'); sr.className = 'bb-sr'; sr.innerHTML = [1, 2, 3].map(k => k <= s0 ? '⭐' : '<i>⭐</i>').join(''); row.append(sr); sc.append(row);
    }
  }
  mapEl.append(hd, sc);
}
const wpop2 = t => { note(50, 0.1, 0.1); };
function openCloset() {
  closetEl.innerHTML = ''; closetEl.classList.remove('hidden');
  const hd = document.createElement('div'); hd.className = 'bb-mh'; hd.innerHTML = `<span>👕 CLOSET ${PG.owned.length}/${OUTFITS.length}</span><div class="grow" style="background:none"></div>`;
  hd.append(btn('❌', '', () => closetEl.classList.add('hidden')));
  const gr = document.createElement('div'); gr.className = 'bb-grid';
  OUTFITS.forEach((o, i) => {
    const has = PG.owned.includes(i), d = document.createElement('div'); d.className = 'bb-o' + (has ? '' : ' lock') + (PG.wear === i ? ' on' : '');
    d.innerHTML = `<div class="dot" style="background:${has ? o.c : '#9aa0b8'}">${has ? HATS[o.hat] : '🔒'}</div>${has ? o.n : '?'}`;
    if (has) d.addEventListener('click', () => { PG.wear = i; savePG(); makePlayer(); openCloset(); });
    gr.append(d);
  });
  const ft = document.createElement('div'); ft.className = 'bb-line'; ft.style.cssText = 'text-align:center;padding:10px;color:#3a2d6b'; ft.textContent = `🎁 a new outfit every 6 ⭐ · ${6 - starTotal() % 6} to go`;
  closetEl.append(hd, gr, ft);
}

// ---------------------------------------------------------------- input: floating thumbstick, tap a rival to mark, tap to catch
const catchRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#4dc3ff', transparent: true, opacity: 0.9, depthWrite: false })); catchRing.visible = false; scene.add(catchRing);
function rivalAtScreen(x, y) {
  let best = null, d = 74;
  for (const e of enemies) if (e.alive) { const [sx, sy] = toScreen(_v.copy(e.g.position).setY(1.0 * e.sc)); const dd = Math.hypot(sx - x, sy - y); if (dd < d) { d = dd; best = e; } }
  return best;
}
const incoming = () => balls.some(b => b.st === 'fly' && b.owner === 'e' && Math.hypot(b.pos.x - player.position.x, b.pos.z - player.position.z) < 7 && b.vel.x * (player.position.x - b.pos.x) + b.vel.z * (player.position.z - b.pos.z) > 0);
function tryCatch() { if (held || catchCool > 0 || catchT > 0) return; catchT = 0.34; catchCool = 1.0; tone(500, 0.08, 'sine', 0.08, 1.6); player.armL.rotation.x = -2; player.armR.rotation.x = -2; }
input({
  onDown: (e, s) => { if (state !== 'play') return; touch = s; stickEl.style.display = 'block'; stickEl.style.left = s.x + 'px'; stickEl.style.top = s.y + 'px'; stickEl.firstChild.style.transform = ''; },
  onMove: (dx, dy, e, s) => {
    if (!touch || state !== 'play') return;
    const vx = s.lx - s.x, vy = s.ly - s.y, L = Math.hypot(vx, vy), k = Math.min(1, L / 50);
    ctrl.set(L ? vx / L * k : 0, L ? vy / L * k : 0);
    const c = Math.min(L, 40); stickEl.firstChild.style.transform = `translate(${L ? vx / L * c : 0}px,${L ? vy / L * c : 0}px)`;
  },
  onUp: (e, s) => {
    if (!touch) return; touch = null; ctrl.set(0, 0); stickEl.style.display = 'none'; if (state !== 'play') return;
    if (!(s && Math.hypot(e.clientX - s.x, e.clientY - s.y) < 12)) { throwBall(); return; }   // lift after a drag = throw
    const rv = rivalAtScreen(e.clientX, e.clientY);
    if (rv) { marked = rv; if (held) throwBall(); else tone(700, 0.05, 'sine', 0.06, 1.2); return; }
    if (!held && incoming()) { tryCatch(); return; }
    const g = floorAt(e.clientX, e.clientY); if (g && (g.mine || !held)) goal = g; else throwBall();
  },
});
function curLevel() { if (D.isDaily) return 'daily'; return Math.min(clearedTo() + 1, TOTAL + 1 + PG.endless); }
const LABEL = { d: '💨 DODGER', t: '💪 TANK', s: '🛡️ SHIELD', f: '⚡ SPRINTER', c: '🌀 CURVER' };
let handEl = null;
function startLevel(i) {
  result.hide(); closeMap(); ui.hideStart(); buildLevel(i); state = 'play'; B.start(); ui.els.sc.classList.remove('hc-hidden');
  const boss = typeof i === 'number' && BOSS[i];
  ui.pop(boss ? '👑 ' + boss.name : spec.n.toUpperCase(), '#fff', boss ? 40 : 30, 22);
  let k = 0; for (const e of enemies) { const lab = LABEL[e.code]; if (lab && !PG.seen[e.code]) { PG.seen[e.code] = 1; savePG(); setTimeout(() => state === 'play' && wpop(lab, e.g.position, '#fff', 24, 2.6 * e.sc), 500 + 300 * k++); } }
  if (i === 1 && !PG.seen.l1) { handEl = handEl || mk('bb-hand', '👆'); handEl.style.display = ''; }
}
ui.onTap(w => { if (w === 'start') startLevel(curLevel()); });

// ---------------------------------------------------------------- loop
const _v = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
const aimLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, depthTest: false })); aimLine.renderOrder = 9; aimLine.visible = false; aimLine.frustumCulled = false; scene.add(aimLine);
function setLoose(b) { b.st = 'loose'; if ((b.gold || b.hot) && b.owner !== 'p-held') { if (b.gold) { b.m.scale.setScalar(1); b.m.material.color.set('#ff3d6e'); b.m.material.emissive.set('#ff3d6e'); b.m.material.emissiveIntensity = 0.15; } b.gold = false; b.hot = false; } b.cv = null; }
function tick(rawDt, t) {
  if (slowT > 0) { slowT -= rawDt / 60; if (slowT <= 0) slow = 1; }
  const dt = rawDt * slow, ds = dt / 60;
  clock += ds;
  for (let i = 0; i < CROWD; i++) { const c = crowdData[i], hop = Math.max(0, Math.sin(t * (state === 'won' ? 14 : 5) + c.ph)) * (state === 'won' ? 0.35 : 0.1); _m.compose(_s.set(c.x, c.y + hop, c.z), _q.identity(), _v.set(1, 1, 1)); crowd.setMatrixAt(i, _m); }
  crowd.instanceMatrix.needsUpdate = true;
  for (const b of belts) b.m.material.map.offset.x -= Math.abs(b.vx) * 0.012 * dt;
  fxStep(dt);
  if (handEl) { if (state === 'play' && idx === 1 && !PG.seen.l1) { const tb = held ? null : balls[0]; if (tb) { const [x, y] = toScreen(tb.pos); handEl.style.left = x + 'px'; handEl.style.top = y + 'px'; handEl.style.display = ''; } else handEl.style.display = 'none'; } else handEl.style.display = 'none'; }

  if (state === 'play' || state === 'won') {
    if (state === 'play') levelT += ds;
    comboT = Math.max(0, comboT - ds); if (comboT <= 0) comboN = 0;
    // ---- player
    if (touch) goal = null;
    const gv = goal && new THREE.Vector2(goal.x - player.position.x, goal.y - player.position.z); if (gv && gv.length() < 0.3) goal = null; else if (gv) gv.multiplyScalar(Math.min(1, gv.length()) / gv.length());
    const c = clock < botUntil ? botCtrl : goal ? gv : ctrl;
    const speed = 6.2;
    const want = _v.set(c.x, 0, c.y).multiplyScalar(speed);
    pv.lerp(want, Math.min(1, 0.25 * dt));
    if (state === 'play') {
      player.position.addScaledVector(pv, ds);
      for (const bt of belts) if (player.position.z > bt.z0 && player.position.z < bt.z1) player.position.x += bt.vx * ds;
    }
    player.position.x = clamp(player.position.x, -AW + BODY_R, AW - BODY_R);
    player.position.z = clamp(player.position.z, 0.7, AL - BODY_R);
    for (const p of pillars) { const dx = player.position.x - p.x, dz = player.position.z - p.z, d = Math.hypot(dx, dz), mn = p.r + BODY_R * 0.8; if (d < mn) { player.position.x = p.x + dx / (d || 1) * mn; player.position.z = p.z + dz / (d || 1) * mn; } }
    const moving = pv.length() > 0.4;
    if (moving) player.rotation.y = lerpA(player.rotation.y, Math.atan2(pv.x, pv.z), 0.3);
    else { const e = pickTarget(); if (e) { const a = Math.atan2(e.g.position.x - player.position.x, e.g.position.z - player.position.z); player.rotation.y = lerpA(player.rotation.y, a, 0.15); } }
    const ph = t * 16;
    player.body.position.y = moving ? Math.abs(Math.sin(ph)) * 0.12 : Math.sin(t * 3) * 0.02;
    player.footL.position.z = 0.05 + (moving ? Math.sin(ph) * 0.18 : 0); player.footR.position.z = 0.05 - (moving ? Math.sin(ph) * 0.18 : 0);
    player.body.rotation.x = lerp(player.body.rotation.x, moving ? 0.18 : 0, 0.2);
    player.armR.rotation.x = lerp(player.armR.rotation.x, held ? -1.2 : (moving ? Math.sin(ph) * 0.8 : 0), 0.18);
    player.armL.rotation.x = lerp(player.armL.rotation.x, moving ? -Math.sin(ph) * 0.8 : 0, 0.18);
    if (player.body.userData.prop) player.body.userData.prop.rotation.y += 0.5 * dt; if (player.body.userData.star) player.body.userData.star.rotation.y += 0.08 * dt;
    inv = Math.max(0, inv - ds); player.visible = inv <= 0 || Math.floor(t * 14) % 2 === 0;
    pickCool = Math.max(0, pickCool - ds);
    catchCool = Math.max(0, catchCool - ds); catchT = Math.max(0, catchT - ds);
    catchRing.visible = catchT > 0; if (catchT > 0) { catchRing.position.set(player.position.x, 0.05, player.position.z); catchRing.scale.setScalar(2.2 - catchT * 2); }
    heroTick(ds);
    if (spec.heart && !st.heartSpawned && levelT > 6 && state === 'play') { st.heartSpawned = true; dropHeart(spec.heart[0], spec.heart[1]); }
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i]; p.t += ds; p.s.position.y = 1.0 + Math.sin(p.t * 4) * 0.15; p.s.scale.setScalar(0.9 + Math.sin(p.t * 8) * 0.06);
      if (state === 'play' && hearts < 3 && Math.hypot(p.x - player.position.x, p.z - player.position.z) < 0.95) { hearts++; updateHearts(); scene.remove(p.s); pickups.splice(i, 1); wpop('+❤️', player.position, '#ff5d8f', 34, 2.2); note(79, 0.2, 0.15); buzz(15); burst(scene, player.position.clone().setY(1), ['#ff5d8f', '#ffffff'], 12, { speed: 0.08, up: 0.1, size: 0.5 }); }
    }

    // ---- rivals
    for (const e of enemies) {
      const g = e.g;
      if (!e.alive) {
        if (e.ko > 0) { e.ko += ds; e.vy -= 0.012 * dt; g.position.y = Math.max(0, g.position.y + e.vy * dt); g.position.z -= 0.06 * dt * (g.position.y > 0 ? 1 : 0); g.position.x += e.kx * dt; g.rotation.x = Math.min(g.rotation.x + 0.12 * dt, Math.PI / 2); g.rotation.y += e.spin * dt * (g.position.y > 0 ? 1 : 0);
          g.position.z = Math.max(g.position.z, -AL + 0.6); if (e.ko > 1.6) g.scale.setScalar(Math.max(0.001, e.sc * (1 - (e.ko - 1.6) * 2))); }
        continue;
      }
      e.recover = Math.max(0, e.recover - ds); e.stun = Math.max(0, e.stun - ds);
      e.shieldUp = !!e.sh && e.wind <= 0 && e.recover <= 0 && e.stun <= 0;
      if (e.sh) { e.sh.visible = e.shieldUp; e.sh.material.opacity = 0.45 + Math.sin(t * 6 + e.id) * 0.12; }
      const spread = e.boss ? 1.9 : 1.5;
      if (g.position.distanceTo(e.tgt) < 0.2 || R() < 0.007) e.tgt.set(clamp(e.home.x + (R() * 2 - 1) * spread, -AW + 0.7, AW - 0.7), 0, clamp(e.home.z + (R() * 2 - 1) * 0.9, -AL + 0.8, -1.4));
      // sidestep a ball that is flying at me (once per ball)
      for (const b of balls) if (b.st === 'fly' && b.owner === 'p' && !e.dodged.has(b) && b.vel.z < 0 && b.pos.z - g.position.z > 0 && b.pos.z - g.position.z < 6 && Math.abs(b.pos.x - g.position.x) < 1.4) {
        e.dodged.add(b);
        if (!b.gold && e.stun <= 0 && e.wind <= 0 && e.recover <= 0 && R() < (e.T.dodge + [0, 0.12, 0.22][Math.min(2, spec.w)]) * (typeof idx === 'number' && idx < 4 ? 0.8 : 1)) { e.tgt.set(clamp(g.position.x + (g.position.x > b.pos.x ? 1.7 : -1.7), -AW + 0.7, AW - 0.7), 0, g.position.z); e.dodgeT = 0.4; wpop2(); }
      }
      const spd = e.wind > 0 ? 0.6 : e.stun > 0 ? 0.2 : (e.dodgeT > 0 ? 7.5 : e.T.spd * SPW[Math.min(2, spec.w)]);
      e.dodgeT = Math.max(0, e.dodgeT - ds);
      _v.copy(e.tgt).sub(g.position); const dl = _v.length(); if (dl > 0.01) { _v.normalize(); g.position.addScaledVector(_v, Math.min(dl, spd * ds)); e.vel.copy(_v).multiplyScalar(spd); } else e.vel.set(0, 0, 0);
      for (const p of pillars) { const dx = g.position.x - p.x, dz = g.position.z - p.z, d = Math.hypot(dx, dz), mn = p.r + 0.5 * e.sc; if (d < mn) { g.position.x = p.x + dx / (d || 1) * mn; g.position.z = p.z + dz / (d || 1) * mn; } }
      g.rotation.y = Math.atan2(player.position.x - g.position.x, player.position.z - g.position.z);
      g.body.position.y = Math.abs(Math.sin(t * 9 + g.position.x)) * 0.06;
      if (g.body.userData.star) g.body.userData.star.rotation.y += 0.08 * dt;
      if (state === 'play') {
        if (e.wind > 0) {
          e.wind -= ds; if (e.wind > 0.35) e.aims.forEach((a, i) => { aimAt(e, i, a); e.rings[i].position.set(a.x, 0.03, a.z); }); g.armR.rotation.x = lerp(g.armR.rotation.x, -2.8, 0.2); g.body.rotation.x = -0.15;
          const k = Math.max(0, e.wind / e.windMax); for (const r of e.rings) { r.scale.setScalar(0.8 + k * 1.2); r.material.opacity = 0.9 - k * 0.5; }
          if (e.wind <= 0) enemyThrow(e);
        } else {
          e.cool -= ds; g.armR.rotation.x = lerp(g.armR.rotation.x, 0, 0.1); g.body.rotation.x = 0;
          const busy = enemies.filter(o => o.alive && o.wind > 0).length >= (spec.wc || 1);
          if (e.cool <= 0 && !busy && e.stun <= 0) startWind(e);
        }
      }
      e.hitFlash = Math.max(0, e.hitFlash - ds * 3);
      const fl = e.stun > 0 ? (Math.sin(t * 30) > 0 ? 0.6 : 0.1) : e.hitFlash; e.g.mats[0].emissive.setRGB(fl, fl, fl);
    }

    // ---- balls
    for (const b of [...balls]) {
      b.age += ds;
      if (b === held && my && myArm.hand) heroHand(b.pos);
      else if (b === held) { b.pos.copy(player.position).add(_v.set(Math.sin(player.rotation.y + 0.9) * 0.55, 1.05 + player.body.position.y, Math.cos(player.rotation.y + 0.9) * 0.55)); }
      else {
        if (b.st === 'fly') trailStep(b, ds);
        if (b.cv) { const dx = b.cv.aim.x - b.pos.x, dz = b.cv.aim.z - b.pos.z, d = Math.hypot(dx, dz); if (d < 0.5 || d > b.cv.total + 1) b.cv = null; else { const a = Math.atan2(dz, dx) + b.cv.phi * clamp(d / b.cv.total, 0, 1), sp = Math.hypot(b.vel.x, b.vel.z); b.vel.x = Math.cos(a) * sp; b.vel.z = Math.sin(a) * sp; } }
        b.vel.y -= (b.st === 'fly' ? 4 : 18) * ds;
        b.pos.addScaledVector(b.vel, ds);
        if (b.pos.y < BALL_R) { b.pos.y = BALL_R; if (b.vel.y < -1) { tone(200, 0.05, 'sine', 0.06, 0.7); } b.vel.y = Math.abs(b.vel.y) * 0.5; b.vel.x *= 0.93; b.vel.z *= 0.93; if (b.st === 'fly') setLoose(b); }
        if (Math.abs(b.pos.x) > W) { b.pos.x = Math.sign(b.pos.x) * W; b.vel.x *= b.owner === 'p' && b.st === 'fly' ? -1 : -0.6; b.cv = null; if (b.owner === 'p' && b.st === 'fly') { b.bank = true; b.bounced++; shockwave(b.pos.clone(), '#ffffff', 0.4); tone(900, 0.04, 'triangle', 0.07, 0.8); if (b.gold && b.bounced > 3) setLoose(b); } }
        if (Math.abs(b.pos.z) > AL - BALL_R) { b.pos.z = Math.sign(b.pos.z) * (AL - BALL_R); b.vel.z *= -0.5; if (b.st === 'fly') { setLoose(b); tone(150, 0.06, 'triangle', 0.08, 0.7); } }
        for (const p of pillars) if (b.pos.y < 1.55) { const dx = b.pos.x - p.x, dz = b.pos.z - p.z, d = Math.hypot(dx, dz), mn = p.r + BALL_R; if (d < mn) { const nx = dx / (d || 1), nz = dz / (d || 1); b.pos.x = p.x + nx * mn; b.pos.z = p.z + nz * mn; const vn = b.vel.x * nx + b.vel.z * nz; if (vn < 0) { b.vel.x -= 2 * vn * nx; b.vel.z -= 2 * vn * nz; b.vel.x *= 0.9; b.vel.z *= 0.9; if (b.owner === 'p' && b.st === 'fly') b.bank = true; b.cv = null; tone(760, 0.05, 'triangle', 0.08, 0.7); shockwave(b.pos.clone(), '#ffffff', 0.4); } } }
        if (b.st === 'loose') { b.vel.x *= Math.pow(0.985, dt); b.vel.z *= Math.pow(0.985, dt); for (const bt of belts) if (b.pos.z > bt.z0 && b.pos.z < bt.z1 && b.pos.y < 0.4) b.pos.x = clamp(b.pos.x + bt.vx * ds * 0.8, -W, W); }
        // rival ball vs me: catch window, then a hit, else a close call
        if (b.st === 'fly' && b.owner === 'e' && b.pos.y < 1.7 && state === 'play') {
          const d = Math.hypot(b.pos.x - player.position.x, b.pos.z - player.position.z);
          if (catchT > 0 && !held && d < 1.7) {
            held = b; b.st = 'held'; b.owner = 'p'; b.cv = null; b.hot = true; b.m.material.emissive.set('#4dc3ff'); b.m.material.emissiveIntensity = 0.6; catchT = 0; catchCool = 0.2; st.catches++;
            score += 15; ui.score(score); meter += 0.3; shockwave(player.position.clone().setY(1), '#4dc3ff', 1); wpop('CATCH! +15', player.position, '#4dc3ff', 34, 2.4); trick('catch'); checkMeter(); sfx.win && tone(900, 0.12, 'square', 0.1, 1.5); buzz(25); player.scale.set(1.25, 0.8, 1.25); slow = 0.2; slowT = 0.1; checkBeat();
          } else if (d < BODY_R + BALL_R) hitPlayer(b);
          else if (d < 1.45 && !b.nearMiss && b.pos.z > player.position.z) {
            b.nearMiss = true; if (inv <= 0) { score += 2; st.close++; ui.score(score); checkBeat(); ui.pop('CLOSE!', '#fff', 28, 46); tone(990, 0.06, 'sine', 0.07, 1.3); meter += 0.15; if (st.close >= 3) trick('dodge'); checkMeter(); }
          }
        }
        if (b.st === 'fly' && b.owner === 'p') for (const e of enemies) if (e.alive && !b.hit.includes(e) && b.pos.y < 1.8 && Math.hypot(b.pos.x - e.g.position.x, b.pos.z - e.g.position.z) < BODY_R * e.sc * 0.95 + BALL_R + 0.05) { hitEnemy(e, b); if (b.st !== 'fly') break; }
        if (!held && b.st === 'loose' && pickCool <= 0 && state === 'play' && b.pos.y < 1 && b.pos.z > 0.3 && Math.hypot(b.pos.x - player.position.x, b.pos.z - player.position.z) < 0.85) {
          held = b; b.st = 'held'; b.owner = 'p'; pickCool = 0.3; tone(660, 0.07, 'triangle', 0.12, 1.5); buzz(8);
          ui.pop(b.gold ? 'GOLD BALL!' : (idx === 1 && !PG.seen.l1 ? 'LET GO TO THROW!' : 'GOT IT!'), b.gold ? '#ffd23f' : '#fff', 26, 52);
          if (idx === 1 && !PG.seen.l1) { PG.seen.l1 = 1; savePG(); }
          player.scale.set(1.15, 0.85, 1.15);
        }
        if (b.st === 'loose' && b.pos.z < -0.3 && b.age > 1.2) { b.m.scale.multiplyScalar(0.92); if (b.m.scale.x < 0.05) { killBall(b); continue; } }
      }
      b.m.position.copy(b.pos); b.m.rotation.x += b.vel.z * ds * 3; b.m.rotation.z -= b.vel.x * ds * 3;
      b.blob.position.set(b.pos.x, 0.02, b.pos.z); b.blob.scale.setScalar(0.8 / (1 + b.pos.y * 0.5));
      trailFade(b, dt);
    }
    if (balls.filter(b => b.st === 'loose' && b.pos.z > 0).length > 3) { const old = balls.find(b => b.st === 'loose' && b.pos.z > 0 && !b.gold); old && killBall(old); }
    if (state === 'play' && !held && !balls.some(b => b.owner === 'p' || (b.st === 'loose' && b.pos.z > 0))) {
      if ((noBallT += ds) > 1.8) { noBallT = 0; const b = mkBall('#ff3d6e'); b.pos.set((R() * 2 - 1) * (AW - 1), 2.5, 1.6 + R() * 3); b.vel.set(0, 0, 0); b.st = 'loose'; }
    }
    player.scale.lerp(_v.set(1, 1, 1), 0.15);
    // reticle above the target; a bank shot draws its path
    const tgtE = (held || marked) ? pickTarget() : null;
    reticle.visible = !!tgtE && state === 'play';
    aimLine.visible = false;
    if (tgtE) {
      reticle.position.copy(tgtE.g.position).setY(1.1 * tgtE.sc + 0.1); reticle.quaternion.copy(camera.quaternion); reticle.scale.setScalar(1 + Math.sin(t * 10) * 0.08);
      reticle.children.forEach(c => c.material.color.set(held ? '#ff3355' : '#4dc3ff'));
      if (held && state === 'play') { const pl = planThrow(tgtE, held.gold); if (pl.bank) { const pa = aimLine.geometry.attributes.position; pa.setXYZ(0, player.position.x, 1, player.position.z); pa.setXYZ(1, pl.X, 1, pl.zc); pa.setXYZ(2, tgtE.g.position.x, 1, tgtE.g.position.z); pa.needsUpdate = true; aimLine.visible = true; } }
    }
    if (winT > 0) { winT -= rawDt / 60; if (winT <= 0) win(); }
  }

  if (state !== 'play' && state !== 'won') heroTick(rawDt / 60);
  shake = Math.max(0, shake - rawDt * 0.012); punch = Math.max(0, punch - rawDt * 0.03);
  const px = state === 'ready' ? 0 : player.position.x * 0.25;
  camera.position.set(px + (Math.random() - 0.5) * shake, 14.6 - punch * 0.5 + (Math.random() - 0.5) * shake, 13.4 - punch * 0.8);
  camera.lookAt(px * 0.6, 0, -0.4);
  stage.followLight(_v.set(0, 0, 0));
}
loop(tick);

makePlayer(); applyTheme(THEMES[0]);
buildLevel(curLevel()); state = 'ready'; ui.start(); ui.els.sc.classList.add('hc-hidden');
{
  const hb = heroBar({ parent: ui.els.start, onPick: () => useHero() }); hb.el.style.width = 'min(360px,100%)'; ui.els.start.querySelector('.hint').before(hb.el);
  const c = curLevel(), p = document.createElement('p'); p.textContent = typeof c === 'number' && c <= TOTAL ? `${WORLDS[LEVELS[c - 1].w].icon} LEVEL ${c}` : c === 'daily' ? 'DAILY BRAWL' : '∞ ARENAS';
  ui.els.start.querySelector('h1').after(p);
  const row = document.createElement('div'); row.className = 'bb-btns'; row.append(btn('🗺', 'sm', openMap), btn('👕', 'sm', openCloset)); ui.els.start.querySelector('.hint').before(row);
}
onHeroesChange(() => { if (JSON.stringify(selectedHero()) !== myShown) useHero(); });
useHero();

// ---------------------------------------------------------------- QA hooks: sim() steps the game without rendering, bot() plays
let simT = 0;
window.__game = {
  get state() { return state; }, get level() { return idx; }, get score() { return score; }, get hearts() { return hearts; }, get stars() { return PG.stars; }, get PG() { return PG; },
  get trick() { return st.trick; }, get st() { return st; }, get time() { return levelT; }, get left() { return enemies.filter(e => e.alive).length; }, get spec() { return spec; },
  start: startLevel, openMap, openCloset, lose() { hearts = 0; lose(); }, sim(n = 1) { for (let i = 0; i < n; i++) { tick(1, simT += 1 / 60); updateParticles(1); } },
  bot() {
    if (state !== 'play') return;
    const p = player.position;
    let mv = null;
    if (!held && catchCool <= 0 && spec.trick === 'catch' && !st.trick) for (const b of balls) if (b.st === 'fly' && b.owner === 'e' && Math.hypot(b.pos.x - p.x, b.pos.z - p.z) < 3.2 && b.vel.x * (p.x - b.pos.x) + b.vel.z * (p.z - b.pos.z) > 0) { tryCatch(); mv = new THREE.Vector2(0, 0); }
    for (const b of balls) {
      if (mv) break;
      if (b.st !== 'fly' || b.owner !== 'e') continue;
      const rel = _v.set(p.x - b.pos.x, 0, p.z - b.pos.z), vv = new THREE.Vector3(b.vel.x, 0, b.vel.z), sp2 = vv.lengthSq() || 1;
      const tc = rel.dot(vv) / sp2; if (tc < 0 || tc > 1.1) continue;
      const closest = rel.clone().addScaledVector(vv, -tc), miss = closest.length();
      if (miss < 1.3) { let side = closest.x === 0 ? (p.x > 0 ? -1 : 1) : Math.sign(closest.x); if (Math.abs(p.x + side * 1.5) > AW - 0.6) side = -side; mv = new THREE.Vector2(side, 0); }
    }
    if (!mv) for (const e of enemies) if (e.alive && e.wind > 0 && e.wind < 0.4) for (const a of e.aims) if (Math.hypot(a.x - p.x, a.z - p.z) < 1.1) { let side = p.x > a.x ? 1 : -1; if (Math.abs(p.x + side * 1.5) > AW - 0.6) side = -side; mv = new THREE.Vector2(side, 0); }
    if (!mv && held) { const te = pickTarget(); if (!te || held.gold || !te.shieldUp || planThrow(te, false).bank || enemies.every(x => !x.alive || x.shieldUp)) { if (te && te.shieldUp && !held.gold && !planThrow(te, false).bank) { /* wait for the shield to drop */ } else throwBall(); } mv = new THREE.Vector2(0, 0); }
    if (!mv) {
      let tb = null, d = 1e9; for (const b of balls) if (b.st === 'loose' && b.pos.z > 0.3) { const dd = Math.hypot(b.pos.x - p.x, b.pos.z - p.z) - (b.gold ? 3 : 0); if (dd < d) { d = dd; tb = b; } }
      if (tb) mv = new THREE.Vector2(tb.pos.x - p.x, tb.pos.z - p.z).normalize();
      else mv = new THREE.Vector2(-p.x * 0.3, (3.5 - p.z) * 0.3);
    }
    botCtrl.copy(mv); botUntil = clock + 0.22;
  },
};
