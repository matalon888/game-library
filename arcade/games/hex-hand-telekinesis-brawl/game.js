// Hex Hand — original telekinesis brawl. Touch an imp, a crate or a barrel: a beam from your glowing glove lifts it.
// Drag to swing it around, flick to throw. Knock imps into each other, blow up barrels, sling them off the island.
// Clear every island before the horde reaches you; the last one has a big horned chief who takes three hits.
import { THREE, createStage, createUI, input, loop, mat, glossy, rounded, burst, confetti, sfx, tone, note, buzz, store, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { canvasTex } from './geo.js';

const NAME = 'Hex Hand: Telekinesis Brawl';
const S = createStage({ fov: 50, shadowSize: 12 });
const { scene, camera, sun, hemi } = S;
scene.add(camera);
sun.intensity = 1.6; hemi.intensity = 1.25;
const ui = createUI({ title: 'HEX<br>HAND', hint: 'Touch an imp, drag and flick to throw', hand: '👆' });
const D = daily('hexhand', ui, { name: NAME });
const save = store('hexhand');
const F = flow('hexhand');
let level = save.get('level', 1), kos = 0;

const css = document.createElement('style'); css.textContent = `
.hc-pop{-webkit-text-stroke:6px rgba(70,30,110,.5);paint-order:stroke fill}
.hc-score{font-size:40px;-webkit-text-stroke:5px rgba(70,30,110,.3);paint-order:stroke fill}
.hc-card h1{text-shadow:0 6px 0 rgba(70,30,110,.35)}
.hh-hp{position:fixed;top:calc(104px + env(safe-area-inset-top));left:0;right:0;text-align:center;font-size:24px;z-index:5;pointer-events:none;letter-spacing:4px}
.hh-boss{position:fixed;left:50%;transform:translateX(-50%);top:calc(140px + env(safe-area-inset-top));width:min(220px,56vw);height:14px;border-radius:8px;background:rgba(0,0,0,.25);overflow:hidden;z-index:5;pointer-events:none}
.hh-boss i{display:block;height:100%;background:#ff4d6d;border-radius:8px;transition:width .25s}
`; document.head.appendChild(css);
const hpEl = document.createElement('div'); hpEl.className = 'hh-hp'; document.body.appendChild(hpEl);
const bossEl = document.createElement('div'); bossEl.className = 'hh-boss hc-hidden'; bossEl.innerHTML = '<i></i>'; document.body.appendChild(bossEl);

// ---------------------------------------------------------------- world
const R = 6.3, GAP = 30, GRAV = 26;
const THEMES = [
  { sky: ['#7fd3ff', '#e6f8ff'], water: '#47c2ff', grass: '#7ad35a', sand: '#ffe2a8', leaf: '#3db36b', imp: '#8e5cff' },
  { sky: ['#ffb3a7', '#fff0d1'], water: '#5ab8ff', grass: '#9bd65a', sand: '#ffd9a0', leaf: '#4bbf6f', imp: '#3a86ff' },
  { sky: ['#b9a8ff', '#ffe2f4'], water: '#6fb7ff', grass: '#6ed6a0', sand: '#ffe6c2', leaf: '#2fae86', imp: '#ff6b3d' },
  { sky: ['#8ee6d0', '#f2fff2'], water: '#3fb0e8', grass: '#86d84e', sand: '#f7dca0', leaf: '#46b96a', imp: '#d64dff' },
];
let TH = THEMES[0];
const water = new THREE.Mesh(new THREE.PlaneGeometry(400, 400, 1, 1), glossy('#47c2ff', { roughness: 0.25 })); water.rotation.x = -Math.PI / 2; water.position.y = -1.1; water.receiveShadow = true; scene.add(water);
const world = new THREE.Group(); scene.add(world);
const grassMat = mat('#7ad35a'), sandMat = mat('#ffe2a8'), leafMat = mat('#3db36b'), trunkMat = mat('#c08a55'), plankMat = mat('#c98f58'), rockMat = mat('#c7c2d6');
function island(z) {
  const g = new THREE.Group(); g.position.z = z;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.5, 48), grassMat); top.position.y = -0.25; top.receiveShadow = true;
  const side = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.05, R + 0.9, 1.6, 48), sandMat); side.position.y = -1.2; side.receiveShadow = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.02, 0.12, 8, 64), mat('#ffffff', { transparent: true, opacity: 0.6 })); rim.rotation.x = Math.PI / 2; rim.position.y = -1.05;
  g.add(top, side, rim);
  const r = rng(Math.abs(z) * 13 + level + 1);
  for (let i = 0; i < 2; i++) {   // palms on the far left / right rim, clear of the action
    const a = Math.PI + (i ? 1 : -1) * (1.05 + r() * 0.25), px = Math.sin(a) * (R - 0.6), pz = Math.cos(a) * (R - 0.6);
    const palm = new THREE.Group(); palm.position.set(px, 0, pz);
    for (let k = 0; k < 5; k++) { const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.7, 8), trunkMat); seg.position.set(k * k * 0.03, 0.35 + k * 0.65, 0); seg.rotation.z = -k * 0.05; seg.castShadow = true; palm.add(seg); }
    for (let k = 0; k < 6; k++) { const lf = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.2, 4), leafMat); lf.scale.z = 0.3; const aa = k / 6 * Math.PI * 2; lf.position.set(0.5 + Math.cos(aa) * 0.9, 3.4, Math.sin(aa) * 0.9); lf.rotation.set(Math.sin(aa) * 1.2, 0, -Math.cos(aa) * 1.2 - 0.0); lf.castShadow = true; palm.add(lf); }
    palm.scale.setScalar(0.75 + r() * 0.2); g.add(palm);
  }
  for (let i = 0; i < 4; i++) { const a = r() * Math.PI * 2, d = R - 0.4 - r() * 0.4; const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 + r() * 0.3, 0), rockMat); rk.position.set(Math.sin(a) * d, 0, Math.cos(a) * d); if (rk.position.z > 2) continue; g.add(rk); }
  world.add(g); return g;
}
function bridge(z0, z1) {
  const n = Math.ceil((z0 - z1) / 0.8);
  for (let i = 0; i < n; i++) { const p = new THREE.Mesh(rounded(2.6, 0.18, 0.62, 0.05), plankMat); p.position.set(0, -0.12, z0 - i * 0.8 - 0.4); p.rotation.z = (i % 3 - 1) * 0.02; p.receiveShadow = true; world.add(p); }
  for (const s of [-1, 1]) for (let i = 0; i <= n; i += 3) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.9, 8), trunkMat); post.position.set(s * 1.4, -0.4, z0 - i * 0.8); world.add(post); }
}

// ---------------------------------------------------------------- actors
const IMPG = { body: new THREE.CapsuleGeometry(0.42, 0.5, 6, 14), eye: new THREE.SphereGeometry(0.13, 12, 8), pup: new THREE.SphereGeometry(0.065, 8, 6), horn: new THREE.ConeGeometry(0.1, 0.32, 10), limb: new THREE.CapsuleGeometry(0.11, 0.3, 4, 8), belly: new THREE.SphereGeometry(0.3, 14, 10) };
const white = mat('#ffffff'), black = mat('#2b2d42'), hornMat = mat('#ffd23f');
function impModel(color, big = 1) {
  const g = new THREE.Group(), m = glossy(color);
  const body = new THREE.Mesh(IMPG.body, m); body.position.y = 0.72; body.castShadow = true;
  const belly = new THREE.Mesh(IMPG.belly, mat('#ffffff', { transparent: true, opacity: 0.35 })); belly.scale.set(1, 1.1, 0.5); belly.position.set(0, 0.6, 0.27);
  g.add(body, belly);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(IMPG.eye, white); eye.position.set(s * 0.16, 0.98, 0.33); const pup = new THREE.Mesh(IMPG.pup, black); pup.position.set(s * 0.15, 0.97, 0.44);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.05), black); brow.position.set(s * 0.15, 1.12, 0.4); brow.rotation.z = s * 0.4;
    const horn = new THREE.Mesh(IMPG.horn, hornMat); horn.position.set(s * 0.24, 1.33, 0); horn.rotation.z = s * -0.4; horn.castShadow = true;
    const arm = new THREE.Group(); arm.position.set(s * 0.45, 0.85, 0); const al = new THREE.Mesh(IMPG.limb, m); al.position.y = -0.22; al.castShadow = true; arm.add(al);
    const leg = new THREE.Group(); leg.position.set(s * 0.18, 0.32, 0); const ll = new THREE.Mesh(IMPG.limb, black); ll.position.y = -0.16; leg.add(ll);
    g.add(eye, pup, brow, horn, arm, leg); g[s < 0 ? 'armL' : 'armR'] = arm; g[s < 0 ? 'legL' : 'legR'] = leg;
  }
  g.scale.setScalar(big); return g;
}
function barrelModel() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.0, 20), glossy('#ff4d4d')); b.castShadow = true; b.position.y = 0.5;
  for (const y of [0.2, 0.8]) { const band = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.04, 6, 24), mat('#ffffff')); band.rotation.x = Math.PI / 2; band.position.y = y; g.add(band); }
  const sym = new THREE.Mesh(new THREE.CircleGeometry(0.2, 3), new THREE.MeshBasicMaterial({ color: '#ffd23f' })); sym.position.set(0, 0.5, 0.425); sym.rotation.z = Math.PI / 2;
  g.add(b, sym); return g;
}
function crateModel() { const g = new THREE.Group(); g.scale.setScalar(0.85); const c = new THREE.Mesh(rounded(0.85, 0.85, 0.85, 0.08), mat('#d9a066')); c.position.y = 0.425; c.castShadow = true; const x1 = new THREE.Mesh(rounded(0.9, 0.12, 0.88, 0.03), mat('#a8703e')); x1.position.y = 0.425; g.add(c, x1); return g; }

// ---------------------------------------------------------------- hand + beam (attached to the camera)
const hand = new THREE.Group(); camera.add(hand);
const handMat = glossy('#58e0c8', { emissive: '#1a8f7c', emissiveIntensity: 0.35 });
{
  const palm = new THREE.Mesh(rounded(0.55, 0.62, 0.22, 0.1), handMat); palm.position.y = -0.1;
  const idx = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.45, 4, 8), handMat); idx.position.set(-0.12, 0.38, 0);
  const curl = []; for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), handMat); f.position.set(0.02 + i * 0.13, 0.22, 0.1); curl.push(f); hand.add(f); }
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.2, 4, 8), handMat); thumb.position.set(-0.3, 0.05, 0.08); thumb.rotation.z = 0.9;
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.3, 16), mat('#ffffff')); cuff.position.y = -0.5;
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 1.2, 16), glossy('#7b5cff')); sleeve.position.y = -1.2;
  const spark = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), new THREE.MeshBasicMaterial({ color: '#fffbd0' })); spark.position.set(-0.12, 0.66, 0);
  hand.add(palm, idx, thumb, cuff, sleeve, spark); hand.spark = spark; hand.idx = idx;
}
hand.position.set(0.25, -1.35, -3.2); hand.rotation.set(-0.5, 0, 0.12);
const beamCore = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 8, 1, true), new THREE.MeshBasicMaterial({ color: '#fffbd0' }));
const beamGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1, 10, 1, true), new THREE.MeshBasicMaterial({ color: '#ffe14d', transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
scene.add(beamCore, beamGlow); beamCore.visible = beamGlow.visible = false;
const aura = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffe14d', transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending })); aura.visible = false; scene.add(aura);

// ---------------------------------------------------------------- level state
let objs = [], stages = [], si = 0, camZ = 0, camTZ = 0, state = 'ready', sub = 'fight', t = 0, hp = 3, held = null, recorded = false, shake = 0, totalImps = 0, downImps = 0, beatenShown = false;
let fingerT = new THREE.Vector3(), hist = [], botS = { phase: 0, obj: null, aim: null, t: 0 }, travelT = 0;
const camPosFor = (z) => new THREE.Vector3(0, 4.3, z + 9.6);
function stageZ(i) { return -i * GAP; }

function addObj(kind, x, z, extra = {}) {
  const st = stages[extra.stage ?? si];
  const o = { kind, pos: new THREE.Vector3(x, 0, z), vel: new THREE.Vector3(), r: kind === 'crate' ? 0.48 : kind === 'barrel' ? 0.45 : 0.45, ko: false, held: false, thrown: false, alive: true, walk: 0, hp: 1, stage: extra.stage ?? si, active: false, drop: 0, ...extra };
  if (kind === 'imp') { o.mesh = impModel(TH.imp, o.big || 1); o.r = 0.45 * (o.big || 1); o.speed = (o.big ? 0.55 : 0.85 + Math.random() * 0.25) * F.k() * (1 + level * 0.015); }
  else if (kind === 'barrel') o.mesh = barrelModel(); else o.mesh = crateModel();
  o.mesh.position.copy(o.pos); scene.add(o.mesh); objs.push(o); return o;
}
function build() {
  for (const o of objs) scene.remove(o.mesh); objs = []; world.clear(); held = null;
  TH = THEMES[(level - 1) % THEMES.length];
  const bs = document.body.style; bs.setProperty('--bg1', TH.sky[0]); bs.setProperty('--bg2', TH.sky[1]); bs.setProperty('--ui', '#7b5cff');
  water.material.color.set(TH.water); grassMat.color.set(TH.grass); sandMat.color.set(TH.sand); leafMat.color.set(TH.leaf);
  scene.fog = new THREE.Fog(TH.sky[1], 30, 90);
  const seed = D.seed ? D.seed + level : level * 3571 + 7, r = rng(seed), fk = F.k();
  const nst = level === 1 ? 2 : 3; stages = [];
  for (let i = 0; i < nst; i++) { const z = stageZ(i); island(z); if (i === 0) bridge(z + 13.5, z + R - 0.3); stages.push({ z, boss: level >= 2 && i === nst - 1 }); }
  for (let i = 0; i < nst - 1; i++) bridge(stageZ(i) - R + 0.3, stageZ(i + 1) + R - 0.3);
  totalImps = 0; downImps = 0;
  for (let i = 0; i < nst; i++) {
    const z = stageZ(i), st = stages[i];
    const n = st.boss ? Math.min(4, 1 + Math.floor(level / 3)) : Math.min(7, Math.round((2 + i + level * 0.35) * fk));
    st.imps = [];
    for (let k = 0; k < n; k++) { const x = (k - (n - 1) / 2) * (n > 4 ? 1.5 : 1.9) + (r() - 0.5) * 0.6, zz = z - 2.6 - r() * 2.2 - (k % 2) * 0.8; st.imps.push(addObj('imp', clamp(x, -4.4, 4.4), zz, { stage: i })); }
    if (st.boss) { st.chief = addObj('imp', 0, z - 3.8, { stage: i, big: 2.3, hp: 3, boss: true }); st.imps.push(st.chief); }
    const props = 2 + (r() < 0.6 ? 1 : 0) + (st.boss ? 2 : 0);
    for (let k = 0; k < props; k++) { const x = (r() - 0.5) * 7.5, zz = z - 1.2 + r() * 2.8; if (Math.hypot(x, zz - z) > R - 1) continue; addObj(r() < 0.5 ? 'barrel' : 'crate', x, zz, { stage: i }); }
    totalImps += st.imps.length;
  }
  si = 0; camZ = camTZ = stageZ(0); hp = 3; recorded = false; sub = 'fight'; beatenShown = false;
  activateStage(0); setHP(); ui.levels(level); ui.progress(0); ui.score(kos); ui.sub('');
  camera.position.copy(camPosFor(camZ)); camera.lookAt(0, 0.4, camZ - 1.5);
}
function activateStage(i) {
  for (const o of objs) if (o.stage === i) o.active = true;
  const st = stages[i]; bossEl.classList.toggle('hc-hidden', !st.boss); if (st.boss) bossEl.querySelector('i').style.width = '100%';
  if (st.boss) ui.pop('THE CHIEF!', '#fff', 40, 30); else if (i > 0) ui.pop('ISLAND ' + (i + 1), '#fff', 36, 30);
}
function setHP() { hpEl.textContent = '❤️'.repeat(Math.max(0, hp)) + '🤍'.repeat(Math.max(0, 3 - hp)); }

// ---------------------------------------------------------------- combat
function knock(o, v) {
  if (!o.alive || o.ko) return;
  if (o.held) release(false);
  if (o.boss) {
    o.hp--; o.vel.copy(v).multiplyScalar(0.25); o.vel.y = 5; o.stun = 0.8; shake = 0.4; ui.flash(0.25); buzz(30);
    bossEl.querySelector('i').style.width = Math.max(0, o.hp / 3 * 100) + '%';
    tone(140, 0.25, 'square', 0.12, 0.5); burst(scene, o.pos.clone().setY(2), ['#ffffff', '#ffd23f', TH.imp], 18, { speed: 0.15, up: 0.12, size: 0.8 });
    if (o.hp > 0) { ui.pop('OUCH!', '#fff', 40, 30); return; }
  }
  o.ko = true; o.vel.copy(v); o.vel.y = Math.max(o.vel.y, 6); o.spin = new THREE.Vector3((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.4);
  downImps++; kos++; ui.score(kos); ui.progress(downImps / totalImps);
  sfx.smash(); buzz(18); shake = Math.max(shake, 0.2);
  burst(scene, o.pos.clone().setY(1), ['#ffffff', '#ffd23f', TH.imp], 12, { speed: 0.12, up: 0.1, size: 0.6 });
  const combo = ++comboN; comboT = 0.9; if (combo >= 2) ui.pop(combo >= 4 ? `MEGA ×${combo}!` : `COMBO ×${combo}`, '#fff', 34 + combo * 3, 30); else if (o.boss) ui.pop('CHIEF DOWN!', '#ffd23f', 46, 30);
  note(67 + Math.min(combo, 8) * 2, 0.25, 0.14);
  if (!beatenShown && D.beaten(kos)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 44, 24); confetti(scene, o.pos.clone().setY(2), 40); }
}
let comboN = 0, comboT = 0; const shock = [];
function explode(o) {
  if (!o.alive) return; if (o.held) release(false); o.alive = false; scene.remove(o.mesh);
  const p = o.pos.clone();
  burst(scene, p.clone().setY(0.8), ['#ff4d4d', '#ffd23f', '#ff9f43', '#ffffff'], 30, { speed: 0.16, up: 0.14, size: 0.7 });
  burst(scene, p.clone().setY(0.6), ['#5a5470', '#8a849e'], 10, { speed: 0.08, up: 0.1, size: 0.9, gravity: 0.002 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 1, 32), new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.9, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.copy(p).setY(0.05); scene.add(ring); shock.push({ m: ring, t: 0 });
  tone(90, 0.45, 'sawtooth', 0.16, 0.4); tone(60, 0.5, 'square', 0.12, 0.5); buzz([40, 20, 60]); shake = 0.7; ui.flash(0.4); ui.pop('BOOM!', '#ffd23f', 50, 30);
  for (const q of objs) { if (!q.alive || q === o) continue; const d = q.pos.distanceTo(p); if (d < 3.4) { const v = q.pos.clone().sub(p).setY(0).normalize().multiplyScalar(14 * (1 - d / 4)); v.y = 9; if (q.kind === 'imp') knock(q, v); else { q.vel.copy(v); q.thrown = true; } if (q.kind === 'barrel' && d < 2.6) setTimeout(() => explode(q), 120); } }
}
function hitPlayer(o) {
  if (state !== 'play') return;
  o.alive = false; scene.remove(o.mesh); downImps++; ui.progress(downImps / totalImps);
  hp--; setHP(); shake = 0.9; buzz([60, 30, 60]); tone(200, 0.3, 'square', 0.12, 0.5);
  document.body.animate([{ boxShadow: 'inset 0 0 120px 40px rgba(255,40,80,.75)' }, { boxShadow: 'inset 0 0 0 0 rgba(255,40,80,0)' }], { duration: 500 });
  if (hp <= 0) { state = 'lost'; release(false); if (!recorded) { recorded = true; F.level(false, clamp((downImps - 1) / totalImps, 0, 1)); } sfx.fail(); ui.lose('OVERRUN!', `${kos} knockouts`); }
  else ui.pop('OUCH!', '#ff4d6d', 40, 34);
}

// ---------------------------------------------------------------- grab / throw
const ray = new THREE.Raycaster(), _v2 = new THREE.Vector2(), _p = new THREE.Vector3(), holdPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.7);
function screenOf(v) { _p.copy(v).project(camera); return { x: (_p.x + 1) / 2 * innerWidth, y: (1 - _p.y) / 2 * innerHeight, z: _p.z }; }
function pick(x, y) {
  let best = null, bd = 95;
  for (const o of objs) { if (!o.alive || !o.active || o.ko || o.kind === 'gone') continue; const s = screenOf(o.pos.clone().setY(o.r + 0.3 * (o.big || 1))); if (s.z > 1) continue; const d = Math.hypot(s.x - x, s.y - y) - (o.big ? 50 : 0); if (d < bd) { bd = d; best = o; } }
  return best;
}
function fingerToWorld(x, y) { _v2.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(_v2, camera); const hit = new THREE.Vector3(); if (!ray.ray.intersectPlane(holdPlane, hit)) return null; const c = new THREE.Vector3(0, 0, stages[si].z); const d = hit.clone().sub(c).setY(0); if (d.length() > R + 4) d.setLength(R + 4); return c.add(d).setY(1.7); }
function grab(o) {
  if (o.boss) { ui.pop('TOO HEAVY!', '#fff', 34, 34); tone(150, 0.15, 'square', 0.08, 0.7); return false; }
  held = o; o.held = true; o.thrown = false; o.ko = o.kind === 'imp' ? false : o.ko; fingerT.copy(o.pos).setY(1.7); hist = [];
  tone(700, 0.12, 'sine', 0.12, 1.6); buzz(12); hand.idx.rotation.x = 0;
  return true;
}
function release(fling = true, vOverride = null) {
  if (!held) return; const o = held; held = null; o.held = false;
  if (!fling) return;
  let v = vOverride;
  if (!v) {
    v = new THREE.Vector3(); if (hist.length >= 2) { const a = hist[0], b = hist[hist.length - 1], dt = Math.max(0.03, b.t - a.t); v.copy(b.p).sub(a.p).divideScalar(dt); }
    v.y = 0; const sp = v.length();
    if (sp > 26) v.setLength(26);
    // gentle aim help: bend a real flick a little toward the imp it was heading for
    if (sp > 4) { let bestQ = null, bc = Math.cos(0.4); for (const q of objs) { if (q === o || !q.alive || q.ko || q.kind !== 'imp' || !q.active) continue; const dir = q.pos.clone().sub(o.pos).setY(0).normalize(); const c = dir.dot(v.clone().normalize()); if (c > bc) { bc = c; bestQ = q; } } if (bestQ) { const dir = bestQ.pos.clone().sub(o.pos).setY(0).normalize(); v.lerp(dir.multiplyScalar(v.length()), 0.5); } }
    v.y = sp > 4 ? 3 + sp * 0.12 : 0;
  }
  o.vel.copy(v); o.thrown = v.length() > 4;
  if (o.thrown) { tone(420, 0.12, 'triangle', 0.12, 2); sfx.tap(); }
}
input({
  onDown: (e) => { if (state !== 'play' || sub !== 'fight') return; botS.phase = 0; const o = pick(e.clientX, e.clientY); if (o) { grab(o); const w = fingerToWorld(e.clientX, e.clientY); if (w) fingerT.copy(w); } },
  onMove: (dx, dy, e) => { if (!held) return; const w = fingerToWorld(e.clientX, e.clientY); if (w) fingerT.copy(w); },
  onUp: () => { if (held) release(true); },
});
ui.onTap(() => { build(); state = 'play'; ui.hideStart(); });

// ---------------------------------------------------------------- simulation
function updateObj(o, h) {
  if (!o.alive) return;
  const st = stages[o.stage], cz = st.z;
  if (o.held) {
    const prev = o.pos.clone();
    o.pos.lerp(fingerT, clamp(h * 16, 0, 1)); o.vel.copy(o.pos).sub(prev).divideScalar(Math.max(h, 1e-3));
    hist.push({ p: o.pos.clone(), t }); while (hist.length > 2 && t - hist[0].t > 0.1) hist.shift();
    o.mesh.rotation.z = Math.sin(t * 18) * 0.25; if (o.kind === 'imp') { o.mesh.armL.rotation.z = -1.2 + Math.sin(t * 20) * 0.6; o.mesh.armR.rotation.z = 1.2 - Math.sin(t * 20) * 0.6; o.mesh.legL.rotation.x = Math.sin(t * 22) * 0.8; o.mesh.legR.rotation.x = -Math.sin(t * 22) * 0.8; }
    // swinging a held thing through imps knocks them over
    if (o.vel.length() > 7) for (const q of objs) if (q !== o && q.alive && !q.ko && q.kind === 'imp' && q.active && q.pos.distanceTo(o.pos) < q.r + o.r + 0.25 && !q.boss) { knock(q, o.vel.clone().multiplyScalar(0.6)); if (o.kind === 'imp') { release(false); knock(o, o.vel.clone().multiplyScalar(-0.3)); } if (o.kind === 'barrel') { release(false); explode(o); } }
    o.mesh.position.copy(o.pos); return;
  }
  const onIsland = Math.hypot(o.pos.x, o.pos.z - cz) < R;
  const ground = onIsland ? 0 : -50;
  if (o.kind === 'imp' && !o.ko && !o.thrown && o.pos.y <= 0.01 && onIsland && o.active && state === 'play' && sub === 'fight') {
    if (o.stun > 0) o.stun -= h;
    else {   // walk toward the player
      const target = new THREE.Vector3(0, 0, cz + R + 1.5), dir = target.sub(o.pos).setY(0); const d = dir.length(); dir.normalize();
      o.pos.addScaledVector(dir, o.speed * h); o.walk += h * o.speed * 7;
      o.mesh.rotation.y = Math.atan2(dir.x, dir.z);
      const sw = Math.sin(o.walk) * 0.7; o.mesh.legL.rotation.x = sw; o.mesh.legR.rotation.x = -sw; o.mesh.armL.rotation.x = -sw; o.mesh.armR.rotation.x = sw; o.mesh.armL.rotation.z = o.mesh.armR.rotation.z = 0;
      o.mesh.position.y = Math.abs(Math.sin(o.walk)) * 0.08; o.mesh.rotation.z = 0;
      if (o.pos.z > cz + R - 0.6) hitPlayer(o);
    }
  }
  if (o.pos.y > ground + 0.001 || o.vel.y > 0 || !onIsland) {
    o.vel.y -= GRAV * h; o.pos.addScaledVector(o.vel, h);
    if (o.spin) { o.mesh.rotation.x += o.spin.x; o.mesh.rotation.z += o.spin.z; }
    else if (o.thrown) o.mesh.rotation.x += 0.2;
    if (o.pos.y <= 0 && Math.hypot(o.pos.x, o.pos.z - cz) < R) {
      const impact = -o.vel.y + Math.hypot(o.vel.x, o.vel.z) * 0.3;
      o.pos.y = 0;
      if (o.kind === 'barrel' && o.thrown && impact > 7) return explode(o);
      if (o.kind === 'imp' && o.thrown && !o.ko && impact > 8) knock(o, o.vel.clone().multiplyScalar(0.4));
      o.vel.y = impact > 4 ? -o.vel.y * 0.3 : 0; o.vel.x *= 0.6; o.vel.z *= 0.6;
      if (impact < 4) { o.thrown = false; if (!o.ko) { o.mesh.rotation.x = 0; o.mesh.rotation.z = 0; } }
      sfx.bounce();
    }
    if (o.pos.y < -1.2 && o.pos.y > -1.6 && !o.splashed) { o.splashed = true; burst(scene, o.pos.clone().setY(-1.0), ['#ffffff', '#bfeeff', TH.water], 16, { speed: 0.1, up: 0.2, size: 0.8 }); tone(600, 0.25, 'sine', 0.1, 0.3); if (o.kind === 'imp' && !o.ko) knock(o, new THREE.Vector3(0, -1, 0)); }
    if (o.pos.y < -6) { o.alive = false; scene.remove(o.mesh); }
  } else if (Math.hypot(o.vel.x, o.vel.z) > 0.05) { o.pos.addScaledVector(o.vel, h); o.vel.multiplyScalar(Math.pow(0.02, h)); }
  else if (o.thrown) { o.thrown = false; }
  // thrown things knock imps they fly into
  if ((o.thrown || o.ko) && o.vel.length() > 5) for (const q of objs) {
    if (q === o || !q.alive || q.ko || q.held || q.kind !== 'imp' || !q.active) continue;
    if (q.pos.distanceTo(o.pos) < q.r + o.r + (q.big ? 0.6 : 0.15) + 0.1 && Math.abs(q.pos.y + q.r - o.pos.y) < 1.4 * (q.big || 1)) {
      knock(q, o.vel.clone().multiplyScalar(0.7)); if (o.kind === 'barrel') return explode(o);
      if (o.kind === 'imp' && !o.ko) knock(o, o.vel.clone().multiplyScalar(-0.2)); o.vel.multiplyScalar(0.45);
    }
  }
  if (o.ko && o.pos.y <= 0.001 && Math.hypot(o.vel.x, o.vel.z) < 0.3 && onIsland) { o.koT = (o.koT || 0) + h; o.mesh.rotation.x = lerp(o.mesh.rotation.x, -Math.PI / 2, 0.2); if (o.koT > 0.9) { o.alive = false; scene.remove(o.mesh); burst(scene, o.pos.clone().setY(0.4), ['#ffffff', '#e8e0ff'], 10, { speed: 0.06, up: 0.06, size: 0.9, gravity: 0 }); } }
  o.mesh.position.copy(o.pos);
}

// ---------------------------------------------------------------- loop
const tip = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
loop((dt) => {
  const h = Math.min(dt / 60, 0.04); t += h;
  if (state === 'play' || state === 'lost' || state === 'won') for (const o of objs) updateObj(o, h);
  if (state === 'play' && sub === 'fight') {
    const left = objs.filter(o => o.alive && !o.ko && o.kind === 'imp' && o.stage === si).length;
    if (left === 0 && !objs.some(o => o.stage === si && o.kind === 'imp' && o.alive && o.ko && o.pos.y > -1)) {
      if (si < stages.length - 1) { sub = 'travel'; travelT = 0; release(false); ui.pop('CLEAR!', '#fff', 42, 30); [0, 4, 7].forEach((s, i) => setTimeout(() => note(72 + s, 0.25, 0.13), i * 80)); }
      else {
        state = 'won'; release(false); bossEl.classList.add('hc-hidden'); if (!recorded) { recorded = true; F.level(true); }
        confetti(scene, new THREE.Vector3(0, 2.5, stages[si].z + 2), 90); sfx.win(); buzz([20, 40, 20]);
        level++; save.set('level', level); D.won(kos, 'knocked out'); ui.win(level - 1, `${kos} knockouts`);
      }
    }
  }
  if (sub === 'travel' && state === 'play') { travelT += h; if (travelT > 1.5) { si++; sub = 'fight'; activateStage(si); } }
  if (held && (held.ko || !held.alive)) release(false);
  comboT -= h; if (comboT <= 0) comboN = 0;
  for (const k of shock) { k.t += h; k.m.scale.setScalar(1 + k.t * 9); k.m.material.opacity = Math.max(0, 0.9 - k.t * 2.2); if (k.t > 0.5) { scene.remove(k.m); k.m.geometry.dispose(); } }
  for (let i = shock.length - 1; i >= 0; i--) if (shock[i].t > 0.5) shock.splice(i, 1);
  // camera rides the rails between islands
  camTZ = stageZ(sub === 'travel' ? si + clamp(travelT / 1.4, 0, 1) : si);
  camZ = lerp(camZ, camTZ, sub === 'travel' ? 1 : 0.1);
  const cp = camPosFor(camZ); shake = Math.max(0, shake - h * 1.6);
  const bob = sub === 'travel' ? Math.sin(t * 14) * 0.08 : 0;
  camera.position.set(cp.x + (Math.random() - 0.5) * shake * 0.5, cp.y + bob + (Math.random() - 0.5) * shake * 0.5, cp.z);
  camera.lookAt(0, 0.4, camZ - 1.5);
  S.followLight(new THREE.Vector3(0, 0, camZ));
  // hand points at what it holds; beam from the fingertip
  hand.spark.scale.setScalar(1 + Math.sin(t * 20) * 0.3);
  if (held) {
    hand.spark.getWorldPosition(tip);
    const target = held.pos.clone().setY(held.pos.y + held.r * (held.big || 1) + 0.2), d = target.clone().sub(tip), len = d.length();
    for (const bm of [beamCore, beamGlow]) { bm.visible = true; bm.position.copy(tip).addScaledVector(d, 0.5); bm.scale.set(1 + Math.sin(t * 40) * 0.2, len, 1 + Math.sin(t * 40) * 0.2); bm.quaternion.setFromUnitVectors(up, d.clone().normalize()); }
    aura.visible = true; aura.position.copy(target).setY(target.y - 0.2); aura.scale.setScalar(0.85 + Math.sin(t * 16) * 0.08);
    const sx = screenOf(target); hand.rotation.z = lerp(hand.rotation.z, 0.12 - (sx.x / innerWidth - 0.5) * 0.9, 0.2); hand.rotation.x = lerp(hand.rotation.x, -0.5 + (0.5 - sx.y / innerHeight) * 0.6, 0.2);
    hand.position.x = lerp(hand.position.x, 0.25 + (sx.x / innerWidth - 0.5) * 1.0, 0.2);
    if (Math.random() < 0.3) burst(scene, target, ['#ffe14d', '#ffffff'], 1, { speed: 0.04, up: 0.03, size: 0.35, gravity: 0 });
  } else { beamCore.visible = beamGlow.visible = aura.visible = false; hand.rotation.z = lerp(hand.rotation.z, 0.12, 0.1); hand.rotation.x = lerp(hand.rotation.x, -0.5 + Math.sin(t * 2) * 0.03, 0.1); hand.position.x = lerp(hand.position.x, 0.25, 0.1); }
});

build(); ui.start();

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return kos; },
  bot() {
    if (state !== 'play' || sub !== 'fight') return;
    const imps = objs.filter(o => o.alive && o.active && !o.ko && o.kind === 'imp' && o.stage === si);
    if (!imps.length) return;
    const zc = stages[si].z;
    if (!held) {
      // ammo: a barrel near imps, else the imp closest to us (if it isn't the chief), else a crate
      const danger = imps.slice().sort((a, b) => b.pos.z - a.pos.z)[0];
      const barrels = objs.filter(o => o.alive && o.active && o.kind === 'barrel' && !o.thrown && o.stage === si);
      const crates = objs.filter(o => o.alive && o.active && o.kind === 'crate' && !o.thrown && o.stage === si && o.pos.y < 0.1);
      const free = imps.filter(o => !o.boss && !o.thrown && o.pos.y < 0.05);
      let ammo = null;
      if (barrels.length && imps.length > 1) ammo = barrels[0];
      else if (free.length) ammo = free.sort((a, b) => b.pos.z - a.pos.z)[0];
      else if (crates.length) ammo = crates[0];
      else if (barrels.length) ammo = barrels[0];
      if (!ammo) return;
      if (grab(ammo)) { botS.obj = ammo; botS.t = t; botS.target = (ammo.kind === 'imp' ? imps.filter(q => q !== ammo).sort((a, b) => b.pos.z - a.pos.z)[0] : danger) || null; }
      return;
    }
    if (t - botS.t < 0.25) { fingerT.set(held.pos.x, 1.7, held.pos.z); return; }
    // throw: at another imp (ballistic) or, if it's the last one, off the side of the island
    let tg = botS.target && botS.target.alive && !botS.target.ko ? botS.target.pos.clone() : null;
    const T = 0.45; let v;
    if (tg) { tg.y = (botS.target.big ? 1.2 : 0.4); v = tg.sub(held.pos).divideScalar(T); v.y += 0.5 * GRAV * T; }
    else { const side = held.pos.x >= 0 ? 1 : -1; v = new THREE.Vector3(side * 16, 6, -4); }
    v.x += (Math.random() - 0.5) * 2;
    release(true, v); held && (held = null);
  },
};
