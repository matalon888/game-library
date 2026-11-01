// Pose Rush deep v2 — same fighter, same slow-mo posing, now with 36 hand-made gauntlets in 3 worlds, stars, a map, outfits, a daily gauntlet.
import { THREE, createStage, createUI, input, loop, burst, confetti, sfx, tone, note, buzz, mat, glossy, rounded, store, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { WORLDS, LEVELS, parse, dailyBeats } from './levels.js';
const Q = new URLSearchParams(location.search), QAK = +Q.get('qa') || 1;
const WB = board({ game: 'pose-rush', label: 'Levels cleared', limits: { maxRun: 1, maxPerSec: 0.25 }, mode: 'sum' });
const ST = store('poserush');
const F = flow('poserush'); let fk = 1;
const NL = LEVELS.length;
// ---- progress: prog[n] = { s: stars }, outfit, daily streak
let prog = ST.get('p2', {}), outfit = ST.get('outfit', 0), best = ST.get('best', 0), seenOut = ST.get('seenOut', 0);
let dly = ST.get('daily', { last: 0, streak: 0, days: 0 }), goldN = ST.get('gold', 0);
const dayNum = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const yest = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayNum(d); };
const save = () => { ST.set('p2', prog); ST.set('outfit', outfit); ST.set('best', best); ST.set('seenOut', seenOut); ST.set('daily', dly); ST.set('gold', goldN); };
const starsOf = n => (prog[n] && prog[n].s) || 0;
const totalStars = () => { let t = (dly.days || 0) + goldN; for (let i = 1; i <= NL; i++) t += starsOf(i); return t; };
const isOpen = n => n === 1 || starsOf(n - 1) >= 1 || starsOf(n) >= 1;
const nextOpen = () => { for (let i = 1; i <= NL; i++) if (starsOf(i) < 1) return i; return NL; };
const OUTFITS = [
  { name: 'Violet', need: 0, shirt: '#8e44ff', pants: '#2f6fe4' }, { name: 'Red Hero', need: 3, shirt: '#e63946', pants: '#f1faee', band: '#ffffff' },
  { name: 'Sunny', need: 8, shirt: '#ffc83d', pants: '#2b3a67', band: '#ff7a1a' }, { name: 'Ninja', need: 15, shirt: '#22223b', pants: '#2b2d42', band: '#e63946', hair: '#111' },
  { name: 'Teal Racer', need: 24, shirt: '#2ec4b6', pants: '#1b263b', cape: '#ffffff' }, { name: 'Pink Punk', need: 36, shirt: '#ff5d8f', pants: '#3a0ca3', band: '#ffe14d', cape: '#ffe14d' },
  { name: 'Gold Champ', need: 50, shirt: '#ffd23f', pants: '#b5179e', band: '#ff3d3d', cape: '#ff3d3d' },
];
const unlockedOut = () => OUTFITS.filter(o => totalStars() >= o.need).length;
const { scene, camera, followLight, sun, hemi } = createStage({ fov: 50, shadowSize: 10 });
const ui = createUI({ title: 'POSE<br>RUSH', hint: 'Tap in slow-mo to strike · or drag limbs', hand: '👆', score: true });
const $ = id => document.getElementById(id);
const setUi = c => document.body.style.setProperty('--ui', c);
setUi('#ff7a1a');
try { sun.shadow.mapSize.set(1024, 1024); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } } catch (e) {}

// ---------------------------------------------------------------- environment (instanced, cheap); recoloured per world
const env = new THREE.Group(); scene.add(env);
const E = {};
{
  E.grass = new THREE.Mesh(new THREE.PlaneGeometry(220, 600), mat('#6fd25a', { roughness: 0.9 })); E.grass.rotation.x = -Math.PI / 2; E.grass.position.set(0, -0.02, -250); E.grass.receiveShadow = true; env.add(E.grass);
  E.road = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 600), mat('#8d93a3', { roughness: 0.85 })); E.road.rotation.x = -Math.PI / 2; E.road.position.set(0, 0, -250); E.road.receiveShadow = true; env.add(E.road);
  E.walk = [];
  for (const x of [-3.4, 3.4]) { const sw = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.14, 600), mat('#e3e6ee')); sw.position.set(x, 0.05, -250); sw.receiveShadow = true; env.add(sw); E.walk.push(sw); }
  const dash = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, 1.4), mat('#ffffff'), 120), m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  for (let i = 0; i < 120; i++) { m4.compose(new THREE.Vector3(-1.3, 0.01, 20 - i * 4), q, new THREE.Vector3(1, 1, 1)); dash.setMatrixAt(i, m4); } env.add(dash);
  const R = rng(99), N = 46;
  E.trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.2, 1.6, 8), mat('#8a5a3b'), N); E.crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.25, 0), mat('#3fbf4a', { flatShading: true }), N);
  E.houses = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat('#ffffff'), 30); E.roofs = new THREE.InstancedMesh(new THREE.ConeGeometry(0.75, 0.5, 4), mat('#ffffff', { flatShading: true }), 30);
  for (let i = 0; i < N; i++) {
    const side = i % 2 ? 1 : -1, x = side * (6 + R() * 14), z = 20 - i * 6.5 - R() * 3, s = 0.8 + R() * 0.6;
    m4.compose(new THREE.Vector3(x, 0.8 * s, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s)); E.trunks.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(x, 2.4 * s, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(R(), R(), 0)), new THREE.Vector3(s, s, s)); E.crowns.setMatrixAt(i, m4);
  }
  for (let i = 0; i < 30; i++) {
    const side = i % 2 ? 1 : -1, w = 4 + R() * 3, h = 2.6 + R() * 2.5, d = 4 + R() * 2, x = side * (9 + w / 2 + R() * 6), z = 10 - i * 9;
    m4.compose(new THREE.Vector3(x, h / 2, z), new THREE.Quaternion(), new THREE.Vector3(w, h, d)); E.houses.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(x, h + w * 0.25, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 4, 0)), new THREE.Vector3(w * 0.95, w, d * 0.95)); E.roofs.setMatrixAt(i, m4);
  }
  for (const m of [E.trunks, E.crowns, E.houses, E.roofs]) { m.castShadow = true; env.add(m); }
}
let envWorld = -1;
function applyWorld(wi) {
  if (envWorld === wi) return; envWorld = wi; const W = WORLDS[wi];
  E.grass.material.color.set(W.grass); E.road.material.color.set(W.road); E.walk.forEach(s => s.material.color.set(W.walk));
  E.crowns.material.color.set(wi === 0 ? '#3fbf4a' : wi === 1 ? '#c98b3c' : '#7b5cff'); E.trunks.material.color.set(wi === 2 ? '#3a2d5f' : '#8a5a3b');
  for (let i = 0; i < 30; i++) { E.houses.setColorAt(i, new THREE.Color(W.houses[i % W.houses.length])); E.roofs.setColorAt(i, new THREE.Color(W.roofs[i % W.roofs.length])); }
  E.houses.instanceColor.needsUpdate = true; E.roofs.instanceColor.needsUpdate = true;
  document.body.style.setProperty('--bg1', W.bg[0]); document.body.style.setProperty('--bg2', W.bg[1]); setUi(W.ui); hemi.intensity = wi === 2 ? 0.8 : 1.15; sun.intensity = wi === 2 ? 1.1 : 1.7;
}
// ---------------------------------------------------------------- people: segment rig + 2-bone IK in the sagittal plane (local +z = forward)
const UP = new THREE.Vector3(0, 1, 0);
const A1 = 0.3, A2 = 0.32, L1 = 0.44, L2 = 0.44;
function makePerson({ shirt, pants, skin = '#f5c9a6', hair = '#2b2d42', shoes = '#22223b', bulk = 1 }) {
  const g = new THREE.Group(), ms = mat(shirt), mp = mat(pants), mk = mat(skin), mh = mat(hair), mo = mat(shoes);
  const add = (geo, m) => { const o = new THREE.Mesh(geo, m); o.castShadow = true; g.add(o); return o; };
  const p = { g, lean: 0.15, hipY: 0.92, phase: 0, hands: [[0.1, 1.0], [0.1, 1.0]], feet: [[0, 0.08], [0, 0.08]], cur: null };
  p.torso = add(new THREE.CapsuleGeometry(0.2 * bulk, 0.36, 4, 12), ms); p.torso.scale.set(1.25, 1, 0.9);
  p.pelvis = add(new THREE.SphereGeometry(0.2 * bulk, 14, 10), mp); p.pelvis.scale.set(1.2, 0.8, 0.9);
  p.head = add(new THREE.SphereGeometry(0.17, 18, 14), mk);
  p.hair = add(new THREE.SphereGeometry(0.18, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), mh);
  p.seg = [];
  for (let s = 0; s < 2; s++) {
    p.seg.push({ ua: add(new THREE.CapsuleGeometry(0.075 * bulk, A1, 4, 8), ms), la: add(new THREE.CapsuleGeometry(0.068, A2 - 0.04, 4, 8), mk),
      ul: add(new THREE.CapsuleGeometry(0.1 * bulk, L1, 4, 8), mp), ll: add(new THREE.CapsuleGeometry(0.088 * bulk, L2 - 0.06, 4, 8), mp), shoe: add(rounded(0.17, 0.12, 0.3, 0.05), mo) });
  }
  p.world = { hands: [new THREE.Vector3(), new THREE.Vector3()], feet: [new THREE.Vector3(), new THREE.Vector3()], head: new THREE.Vector3(), chest: new THREE.Vector3(), hips: new THREE.Vector3() };
  p.joints = {};
  return p;
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3();
function place(mesh, x1, y1, z1, x2, y2, z2) {
  _a.set(x1, y1, z1); _b.set(x2, y2, z2); mesh.position.copy(_a).add(_b).multiplyScalar(0.5);
  _d.copy(_b).sub(_a); const l = _d.length(); if (l > 1e-4) mesh.quaternion.setFromUnitVectors(UP, _d.multiplyScalar(1 / l));
}
function ik(rz, ry, tz, ty, a, b, bend) {
  let dz = tz - ry * 0 - rz, dy = ty - ry, d = Math.hypot(dz, dy); const mx = a + b - 0.003;
  if (d > mx) { dz *= mx / d; dy *= mx / d; d = mx; } if (d < 0.08) { d = 0.08; dy = -0.08; dz = 0; }
  const base = Math.atan2(dy, dz), al = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1)) * bend;
  return [rz + Math.cos(base + al) * a, ry + Math.sin(base + al) * a, rz + dz, ry + dy];
}
function pose(p) {
  const L = p.lean, hy = p.hipY, sx = Math.sin(L), cy = Math.cos(L);
  const sh = [sx * 0.5, hy + cy * 0.5], nk = [sx * 0.62, hy + cy * 0.62], hd = [sx * 0.82, hy + cy * 0.82];
  place(p.torso, 0, hy + cy * 0.08, sx * 0.08, 0, hy + cy * 0.5, sx * 0.5);
  p.pelvis.position.set(0, hy, 0);
  p.head.position.set(0, hd[1], hd[0]); p.hair.position.copy(p.head.position).add(_a.set(0, 0.015, -0.02)); p.hair.rotation.x = L - 0.25;
  p.world.headL = [hd[0], hd[1]]; p.world.neckL = [nk[0], nk[1]];
  for (let s = 0; s < 2; s++) {
    const x = s ? 0.27 : -0.27, hx = s ? 0.11 : -0.11, sg = p.seg[s], h = p.hands[s], f = p.feet[s];
    const [ez, ey, wz, wy] = ik(sh[0], sh[1], h[0], h[1], A1, A2, -1);
    place(sg.ua, x, sh[1], sh[0], x * 1.05, ey, ez); place(sg.la, x * 1.05, ey, ez, x * 1.05, wy, wz);
    const [kz, ky, az, ay] = ik(0, hy - 0.05, f[0], f[1], L1, L2, 1);
    place(sg.ul, hx, hy - 0.05, 0, hx, ky, kz); place(sg.ll, hx, ky, kz, hx, ay, az);
    sg.shoe.position.set(hx, ay - 0.02, az + 0.07); sg.shoe.rotation.x = Math.atan2(az - kz, ky - ay) * 0.4;
    p.joints[s] = { hand: [wz, wy], foot: [az, ay], sh, hip: [0, hy - 0.05] };
    p.g.localToWorld(p.world.hands[s].set(x * 1.05, wy, wz)); p.g.localToWorld(p.world.feet[s].set(hx, ay, az));
  }
  p.g.localToWorld(p.world.head.set(0, hd[1], hd[0])); p.g.localToWorld(p.world.chest.set(0, sh[1] - 0.1 * cy, sh[0] - 0.1 * sx)); p.g.localToWorld(p.world.hips.set(0, hy, 0));
}
function runCycle(p, ph, amt = 1) {
  const out = { hipY: 0.9 + Math.abs(Math.cos(ph)) * 0.06 * amt, lean: 0.2 * amt, hands: [], feet: [] };
  for (let s = 0; s < 2; s++) {
    const q = ph + s * Math.PI;
    out.feet.push([Math.sin(q) * 0.42 * amt + 0.05, 0.07 + Math.max(0, Math.cos(q)) * 0.3 * amt]);
    out.hands.push([-Math.sin(q) * 0.34 * amt + 0.18, 0.98 + Math.max(0, -Math.sin(q)) * 0.2 * amt]);
  }
  return out;
}
const STANCE = { hipY: 0.86, lean: 0.05, hands: [[0.32, 1.38], [0.22, 1.32]], feet: [[0.25, 0.07], [-0.2, 0.07]] };


// ---------------------------------------------------------------- dom handles
const HNAMES = ['hand0', 'hand1', 'foot0', 'foot1', 'chest'];
const handles = HNAMES.map(() => { const d = document.createElement('div'); d.className = 'hdl'; document.body.appendChild(d); return d; });
const tgtEl = document.createElement('div'); tgtEl.className = 'tgt'; document.body.appendChild(tgtEl);
const toScreen = (v) => { const p = v.clone().project(camera); return [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight]; };

// ---------------------------------------------------------------- level state
const RUN = 7.5;
const PERFECT_MS = [2000, 1700, 1450];
let cur = 1, isDaily = false, curW = 0, snapCam = true, state = 'menu', score = 0, runner, events, finishZ, ts = 1, tsT = 1, hitStop = 0, active = null, locks, grabbed = null, camShake = 0, worldG, winT = 0, R, endT = 0, finishArch;
let combo = 0, results = [], dragUsed = false, tapUsed = false, killT = 0, fails = {}, beatT0 = 0, fever = false, capeM = null, hopHint = 0;
const ENEMY_LOOKS = [{ shirt: '#e63946', pants: '#ffffff' }, { shirt: '#22223b', pants: '#22223b', hair: '#111' }, { shirt: '#2a9d8f', pants: '#264653' }, { shirt: '#ffb703', pants: '#3d405b', hair: '#6b3e1f' }, { shirt: '#ffffff', pants: '#e63946', hair: '#c1121f' }];
const BULLET_G = new THREE.CapsuleGeometry(0.05, 0.14, 4, 8); BULLET_G.rotateX(Math.PI / 2);
const BARREL_G = new THREE.CylinderGeometry(0.34, 0.34, 0.62, 14); BARREL_G.rotateZ(Math.PI / 2);
const fkey = () => isDaily ? 'd' : cur;
const curLevel = () => isDaily ? { w: Math.floor(((dayNum() % 3) + 3) % 3), p: 'daily', b: dailyBeats(dayNum()) } : LEVELS[cur - 1];

function buildRunner() {
  const o = OUTFITS[outfit];
  runner = makePerson({ shirt: o.shirt, pants: o.pants, hair: o.hair || '#2b2d42', bulk: 1.05 });
  if (o.band) { const b = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.03, 8, 20), mat(o.band)); b.rotation.x = Math.PI / 2 - 0.1; runner.g.add(b); runner.bandM = b; }
  capeM = null;
  if (o.cape) { capeM = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.75), mat(o.cape, { side: THREE.DoubleSide })); capeM.castShadow = true; runner.g.add(capeM); }
}
function buildLevel() {
  if (worldG) scene.remove(worldG);
  worldG = new THREE.Group(); scene.add(worldG);
  const L = curLevel(); curW = L.w; applyWorld(curW); const W = WORLDS[curW];
  R = rng((isDaily ? dayNum() : cur) * 337 + 11); fk = F.k(); rings.length = 0;
  buildRunner();
  runner.g.rotation.y = Math.PI; runner.g.position.set(0, 0, 0); worldG.add(runner.g);
  runner.cur = runCycle(runner, 0); runner.dead = false; runner.vel = null;
  locks = { hand0: null, hand1: null, foot0: null, foot1: null, chest: null };
  const beats = parse(L.b); events = [];
  let z = -16;
  beats.forEach((b, i) => {
    if (i > 0) z -= b.close ? 5.4 : (b.t === 'gun' || b.t === 'barrel' ? 18 : 15.5) + R() * 2;
    let look = ENEMY_LOOKS[Math.floor(R() * ENEMY_LOOKS.length)];
    const gold = !b.boss && b.t !== 'barrel' && (cur >= 3 || isDaily) && Math.random() < 0.07; if (gold) look = { shirt: '#ffd23f', pants: '#ffb703', hair: '#b8860b' };
    const e = makePerson({ ...look, bulk: b.boss ? 1.55 : 1.1 });
    if (b.boss) e.g.scale.setScalar(1.18);
    e.g.position.set(0, 0, z); worldG.add(e.g);
    e.cur = { ...STANCE, hands: STANCE.hands.map(h => h.slice()), feet: STANCE.feet.map(f => f.slice()) };
    const ev = { type: b.t, hs: b.hs ? b.hs.slice() : [[1.3, 1.68, 1.0][Math.floor(R() * 3)]], hi: 0, z, e, st: 'wait', fired: false, bullet: null, low: !!b.low, boss: !!b.boss, ph: R() * 6, close: b.close, idx: i, gold };
    if (b.t === 'gun') {
      const gunM = new THREE.Mesh(rounded(0.1, 0.16, 0.3, 0.03), mat('#2b2d42')); gunM.castShadow = true; e.g.add(gunM); ev.gun = gunM;
      e.cur.hands[0] = ev.low ? [0.62, 0.95] : [0.62, 1.42]; e.cur.hands[1] = ev.low ? [0.5, 0.92] : [0.5, 1.38];
    }
    if (b.t === 'barrel') { e.cur.hands[0] = [0.35, 1.7]; e.cur.hands[1] = [0.3, 1.72]; }
    if (b.t === 'shield') {   // a plank-shield in front of the thug
      const sh = new THREE.Mesh(rounded(0.7, 1.15, 0.12, 0.05), mat(b.boss ? '#ffb703' : '#9aa5b8')); sh.castShadow = true; sh.position.set(0, 1.0, 0.5); e.g.add(sh); ev.shield = sh;
    }
    events.push(ev);
  });
  ev0 = events[0]; finishZ = z - 12;
  finishArch = new THREE.Group();
  const arch = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.25, 10, 36, Math.PI), glossy(W.ui)); finishArch.add(arch);
  const ck = document.createElement('canvas'); ck.width = 64; ck.height = 16; const cx = ck.getContext('2d'); for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { cx.fillStyle = (i + j) % 2 ? '#222' : '#fff'; cx.fillRect(i * 4, j * 4, 4, 4); }
  const tex = new THREE.CanvasTexture(ck); tex.magFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
  const line = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.3), new THREE.MeshBasicMaterial({ map: tex })); line.rotation.x = -Math.PI / 2; line.position.y = 0.02; finishArch.add(line);
  finishArch.position.z = finishZ; worldG.add(finishArch);
  ts = tsT = 1; active = null; grabbed = null; winT = 0; endT = 0; hitStop = 0; combo = 0; results = []; dragUsed = false; tapUsed = false; killT = 0; fever = false; score = 0;
  ui.levels(isDaily ? 'D' : cur); ui.progress(0); ui.score(0); ui.sub(isDaily ? 'DAILY GAUNTLET' : (cur === 12 || cur === 24 || cur === 36 ? 'BOSS' : /^HARD/.test(L.p) ? 'HARD' : starsOf(cur) < 1 ? L.p.replace(/^[A-Z]+: /, '').split(' (')[0].replace(/^(.{0,30})(\s.*)?$/,(m,a,b)=>b&&m.length>30?a:m) : ''));
  if (!isDaily && (cur === 1 || cur === 13 || cur === 25)) ui.pop(WORLDS[curW].name.toUpperCase(), '#ffffff', 40, 22);
  setCombo(0); hideHandles(); snapCam = true;
}
let ev0, frameDt = 0;
function hideHandles() { handles.forEach(h => h.classList.remove('on', 'grab', 'hint')); tgtEl.classList.remove('on'); $('tip').classList.remove('on'); $('slow').classList.remove('on'); }

// ---------------------------------------------------------------- input: grab nearest handle, drag it in the runner's body plane
const ray = new THREE.Raycaster(), bodyPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
function handlePoints() { const w = runner.world; return [w.hands[0], w.hands[1], w.feet[0], w.feet[1], w.chest]; }
function dragTo(name, px, py) {
  ray.setFromCamera(new THREE.Vector2(px / innerWidth * 2 - 1, -(py / innerHeight) * 2 + 1), camera);
  bodyPlane.constant = -runner.g.position.x;
  const hit = ray.ray.intersectPlane(bodyPlane, new THREE.Vector3()); if (!hit) return;
  setLock(name, runner.g.worldToLocal(hit));
}
function setLock(name, local) {
  if (name === 'chest') { locks.chest = clamp(Math.atan2(local.z, local.y - runner.hipY), -1.25, 1.25); return; }
  locks[name] = [local.z, Math.max(0.03, local.y)];
}
const playing = () => state === 'play' && active && active.phase === 'slow';
input({
  onDown(e) {
    if (!playing()) return;
    let bi = -1, bd = 80; handlePoints().forEach((v, i) => { const [x, y] = toScreen(v); const d = Math.hypot(x - e.clientX, y - e.clientY); if (d < bd) { bd = d; bi = i; } });
    if (bi >= 0) { grabbed = HNAMES[bi]; handles[bi].classList.add('grab'); tone(600, 0.04, 'sine', 0.08, 1.4); buzz(5); dragUsed = true; }
  },
  onMove(dx, dy, e) { if (grabbed && state === 'play') dragTo(grabbed, e.clientX, e.clientY); },
  onUp() { grabbed = null; handles.forEach(h => h.classList.remove('grab')); },
  onTap() { if (playing()) { tapUsed = true; autoPose(); sfx.tap(); buzz(8); } },
});
let demoHit = false;
demo(() => { if (active.type === 'gun' || active.type === 'barrel') return false; demoHit = true; autoPose(); },
  { ready: () => state === 'play' && cur === 1 && !isDaily && !!active && active.phase === 'slow' && !grabbed, wait: 1400, max: 1 });

ui.onTap(w => { WB.start(); if (w === 'start') { sfx.tap(); startLevel(nextOpen(), false); } });
function startLevel(n, daily) {
  cur = clamp(n, 1, NL); isDaily = !!daily; closeOverlays(); buildLevel(); state = 'play'; ui.hideStart(); mapBtn.classList.remove('hc-hidden');
}

// ---------------------------------------------------------------- encounters
const curPerfectMs = (styled) => PERFECT_MS[curW] + (styled ? 500 : 0);
function startSlow(ev, tip) {
  if (ev.boss && !ev.intro) { ev.intro = true; ui.pop(BOSSES[cur] || 'BOSS', '#ff5d8f', 46, 26); sfx.fail(); }
  active = ev; ev.phase = 'slow'; beatT0 = performance.now(); dragUsed = false; tapUsed = false;
  const proj = (ev.type === 'gun' || ev.type === 'barrel') && !ev.dodged;
  tsT = (proj ? 0.09 : 0.12) * fk * (fails[fkey()] >= 3 && !isDaily ? 0.75 : 1);
  $('slow').classList.add('on'); $('tip').textContent = tip; $('tip').classList.add('on');
  handles.forEach(h => h.classList.add('on'));
  // after two losses the limb to use pulses
  if (!isDaily && fails[fkey()] >= 2) { const hint = proj ? (ev.low || ev.type === 'barrel' ? [2, 3] : [4]) : [curTarget(ev)[1] < 1.25 ? 3 : 1]; hint.forEach(i => handles[i].classList.add('hint')); }
  tone(180, 0.5, 'sine', 0.14, 0.5); buzz(10);
}
function endSlow() {
  active = null; tsT = 1; hideHandles(); grabbed = null;
  locks = { hand0: null, hand1: null, foot0: null, foot1: null, chest: null };
}
const curTarget = ev => { const h = ev.hs[Math.min(ev.hi, ev.hs.length - 1)]; return [0, ev.type === 'sway' ? 1.3 + 0.34 * Math.sin(performance.now() / 1000 * WORLDS[curW].swayW + ev.ph) : h]; };
const BOSSES = { 12: 'BIG MIKE', 24: 'ROOFTOP RITA', 36: 'SHADOW SAM' };
const BANGS = ['BANG!', 'POW!', 'WHAM!', 'BOOM!', 'KO!'];
function setCombo(c) {
  combo = c; const el = $('combo'); el.textContent = c >= 2 ? 'x' + c + (c >= 5 ? ' FEVER' : '') : ''; el.classList.toggle('on', c >= 2); el.classList.toggle('fev', c >= 5);
  fever = c >= 5; $('slow').classList.toggle('fev', fever);
}
function judge(perfect, styled, base, at, label) {
  results.push({ perfect, styled });
  if (perfect) setCombo(combo + 1); else setCombo(0);
  const mul = (1 + 0.25 * Math.min(combo, 8)) * (styled ? 1.5 : 1) * (fever ? 2 : 1);
  score += demoHit ? 0 : Math.round(base * mul); demoHit = false; ui.score(score);
  const txt = (perfect ? (combo >= 5 ? 'UNSTOPPABLE' : combo >= 3 ? 'PERFECT x' + combo : 'PERFECT') : 'LATE') + (styled ? ' STYLE!' : '');
  ui.pop(label || txt, perfect ? (combo >= 5 ? '#ff5d8f' : '#ffe14d') : '#ffffff', perfect ? 38 + Math.min(combo, 6) * 3 : 30, 24);
  if (perfect) note(60 + Math.min(combo, 10) * 2, 0.25, 0.14);
  if (combo >= 3) confetti(worldG, at, 8 + combo * 3);
}
function hitEnemy(ev, at, byFoot) {
  const styled = dragUsed && !tapUsed, dd = runner.g.position.z - ev.z; ev.minD = Math.min(ev.minD ?? 9, dd); const perfect = ev.minD >= (styled ? 0.7 : 0.85);
  if (ev.hi < ev.hs.length - 1) {   // guard break: next target
    ev.hi++; ev.coolT = 0.3; ev.z -= 0.6; ev.e.g.position.z = ev.z; locks = { hand0: null, hand1: null, foot0: null, foot1: null, chest: null }; tapUsed = false; dragUsed = false; hitStop = 5; camShake = 0.6; beatT0 = performance.now();
    burst(worldG, at, ['#ffffff', '#9aa5b8', '#ffe14d'], 16, { speed: 0.1, up: 0.06, size: 0.7 });
    sfx.smash(); buzz(20); ui.pop(ev.boss ? 'GUARD CRACKED!' : 'GUARD BREAK!', '#ffffff', 28, 26);
    if (ev.shield) ev.shield.rotation.z = (ev.hi % 2 ? 1 : -1) * 0.25 * ev.hi;
    return;
  }
  ev.st = 'done'; const e = ev.e;
  const last = events.every(x => x === ev || x.st === 'done');
  e.vel = new THREE.Vector3((R() - 0.5) * 0.04, 0.12, -0.3); e.spin = 0.12 + R() * 0.08; e.dead = true;
  if (ev.shield) { ev.shield.visible = false; }
  hitStop = last ? 16 : 9;
  judge(perfect, styled, ev.gold ? 500 : ev.hs.length > 1 ? 150 : 100, at, perfect ? null : 'LATE ' + Math.max(0.1, (0.85 - ev.minD) * 0.6).toFixed(1) + 's' + (styled ? ' STYLE!' : ''));
  if (ev.gold) { goldN++; save(); ui.pop('GOLDEN THUG! +1 STAR', '#ffd23f', 40, 30); confetti(worldG, at, 60); sfx.coin(); setTimeout(() => sfx.coin(), 140); }
  ring(at, ev.gold ? '#ffd23f' : '#ffffff', ev.boss ? 1.6 : 1);
  const b = $('bang'); b.textContent = BANGS[Math.floor(Math.random() * BANGS.length)]; b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 520);
  burst(worldG, at, ['#ffe14d', '#ffffff', '#ff7a1a'], 22, { speed: 0.12, up: 0.08, size: 0.8, gravity: 0.003 });
  sfx.smash(); buzz([30, 20, 40]); ui.flash(0.55); camShake = ev.boss ? 1.6 : 1;
  if (last) killT = 1.0;
  endSlow(); if (last) tsT = 0.18;
  ui.progress(events.filter(x => x.st === 'done').length / events.length);
}
function die(reason, push) {
  if (state !== 'play') return;
  state = 'lost'; F.level(false, events.filter(x => x.st === 'done').length / events.length); runner.dead = true; runner.vel = push; runner.spin = -0.1; endSlow(); tsT = 0.35; setCombo(0);
  fails[fkey()] = (fails[fkey()] || 0) + 1;
  sfx.fail(); buzz([60, 40, 80]); ui.flash(0.4); camShake = 1;
  best = Math.max(best, score); save();
  const done = events.filter(x => x.st === 'done').length;
  setTimeout(() => showResult(false, reason, done), 420);
}
function win() {
  state = 'won'; F.level(true); tsT = 1; ui.progress(1); setCombo(0);
  const n = results.length, perf = results.filter(r => r.perfect).length, sty = results.filter(r => r.styled).length;
  let s = 1; if (n && perf / n >= 0.7 && (sty >= 1 || cur <= 2)) s = 2; if (n && perf === n && sty >= Math.ceil(n / 2)) s = 3;
  score += 50 * (isDaily ? 3 : cur); ui.score(score); best = Math.max(best, score);
  const before = totalStars(), beforeS = starsOf(cur), first = isDaily ? dly.last !== dayNum() : beforeS < 1;
  let dailyMsg = '';
  if (isDaily) { if (dly.last !== dayNum()) { dly.streak = dly.last === yest() ? dly.streak + 1 : 1; dly.last = dayNum(); dly.days = (dly.days || 0) + 1; } }
  else { if (s > beforeS) prog[cur] = { s }; if (first) WB.submit(1); }
  fails[fkey()] = 0; save();
  sfx.win(); buzz([20, 40, 20]); ui.flash(0.6);
  const p = runner.g.position.clone().add(new THREE.Vector3(0, 2, -1)); confetti(worldG, p, 100); setTimeout(() => confetti(worldG, p, 70), 300);
  setTimeout(() => showResult(true, '', s, { first, before, perf, n, sty }), 900);
}
function segDist(p, a, b) { const ab = _d.copy(b).sub(a), t = clamp(_a.copy(p).sub(a).dot(ab) / ab.lengthSq(), 0, 1); return _b.copy(a).addScaledVector(ab, t).distanceTo(p); }
function bulletHits(ev, bp) {
  const w = runner.world;
  if (ev.type === 'barrel') return w.feet.some(f => f.y < 0.8);
  if (ev.low) return segDist(bp, w.hips, w.feet[0]) < 0.17 || segDist(bp, w.hips, w.feet[1]) < 0.17;
  if (bp.distanceTo(w.head) < 0.27) return true;
  return segDist(bp, w.hips, w.chest) < 0.24;
}
function shave(ev, bp) {
  const w = runner.world; let m = 9;
  if (ev.type !== 'barrel') { if (!ev.low) m = Math.min(bp.distanceTo(w.head), segDist(bp, w.hips, w.chest)); else m = Math.min(segDist(bp, w.hips, w.feet[0]), segDist(bp, w.hips, w.feet[1])); }
  else m = Math.min(...w.feet.map(f => f.y - 0.8)) + 0.3;
  return m < 0.5;
}

// ---------------------------------------------------------------- loop
const camPos = new THREE.Vector3(5, 3, 6), camLook = new THREE.Vector3(), tv = new THREE.Vector3();
const V3 = THREE.Vector3;
const rings = [];
function ring(at, color = '#ffffff', big = 1) { const m = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.32, 28), new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthTest: false })); m.position.copy(at); m.renderOrder = 8; worldG.add(m); rings.push({ m, t: 0, big }); }
function stepEvent(ev, r, wdt, pz) {
  const d = r.g.position.z - ev.z, W = WORLDS[curW];
  if ((ev.type === 'gun' || ev.type === 'barrel') && !ev.dodged) {
    const barrel = ev.type === 'barrel';
    if (!ev.fired && d < 13) {
      ev.fired = true;
      if (barrel) {
        const bm = new THREE.Mesh(BARREL_G, glossy('#c1782f', { metalness: 0.2 })); bm.position.set(0, 0.34, ev.z + 0.9); bm.castShadow = true; worldG.add(bm); ev.bullet = bm; ev.bz0 = bm.position.z;
        ev.e.cur.hands[0] = [0.7, 1.2]; ev.e.cur.hands[1] = [0.65, 1.1]; sfx.tap();
      } else {
        const bm = new THREE.Mesh(BULLET_G, glossy('#ffcf33', { metalness: 0.6 })); const by = ev.low ? 0.4 : 1.72; bm.position.set(0, by, ev.z + 0.7);
        const trail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6 })); trail.rotation.x = Math.PI / 2; worldG.add(bm, trail);
        ev.bullet = bm; ev.trail = trail; ev.bz0 = bm.position.z; ev.by = by; sfx.smash(); burst(worldG, bm.position, ['#ffe14d', '#ff7a1a'], 8, { speed: 0.05, up: 0.02, size: 0.5 });
      }
    }
    if (ev.bullet) {
      const prevZ = ev.bullet.position.z, sp = barrel ? 8.5 * W.bulletK : 17 * fk * W.bulletK; ev.bullet.position.z += sp * wdt;
      if (barrel) ev.bullet.rotation.x -= sp * wdt / 0.34;
      else { ev.trail.scale.y = Math.min(6, ev.bullet.position.z - ev.bz0); ev.trail.position.set(0, ev.by, ev.bullet.position.z - ev.trail.scale.y / 2); }
      if (!active && r.g.position.z - ev.bullet.position.z < (barrel ? 5 : 6)) startSlow(ev, barrel || ev.low ? 'TAP TO HOP!' : 'TAP TO LEAN BACK!');
      if (prevZ < pz && ev.bullet.position.z >= r.g.position.z) {   // crossed (the runner moved first this frame)
        if (bulletHits(ev, ev.bullet.position)) { die(barrel ? 'TRIPPED!' : 'SHOT!', new V3(0, 0.05, 0.12)); burst(worldG, ev.bullet.position, '#ff3d3d', 14, { speed: 0.08 }); }
        else {
          ev.dodged = true; const close = shave(ev, ev.bullet.position), styled = dragUsed && !tapUsed;
          judge(true, styled, close ? 90 : 50, ev.bullet.position, close ? 'CLOSE SHAVE!' : null); sfx.coin(); buzz(15); endSlow();
          worldG.remove(ev.bullet); if (ev.trail) worldG.remove(ev.trail); ev.bullet = null; ev.e.cur.hands[0] = [0.62, 1.42];
        }
      }
    }
    return;
  }
  if (!active && d < W.startD) startSlow(ev, ev.type === 'sway' ? 'TIME YOUR TAP!' : ev.hs.length > 1 ? 'BREAK HIS GUARD!' : 'TAP TO HIT!');
  if (active === ev) {
    const ty = curTarget(ev)[1], target = ev.e.g.localToWorld(new V3(0, ty, 0.28)); ev.tgt = target;
    if (ev.coolT > 0) ev.coolT -= frameDt / 60; else for (const v of [...r.world.hands, ...r.world.feet]) { const dv = v.distanceTo(target); ev.near = Math.min(ev.near ?? 9, dv); if (dv < 0.42) { hitEnemy(ev, target); break; } }
    if (ev.st !== 'done' && !(cur === 1 && !isDaily)) {   // real-time window: dawdle and the slow-mo fades, he arrives
      const win = ([3.2, 2.7, 2.3][curW]) * (fails[fkey()] >= 3 && !isDaily ? 1.4 : 1) + (ev.hs.length > 1 ? 0.8 : 0), el = (performance.now() - beatT0) / 1000;
      if (el > win) { tsT = Math.min(0.9, 0.12 + (el - win) * 0.5); if (!ev.hurry) { ev.hurry = true; $('tip').textContent = 'TOO SLOW!'; sfx.fail(); } }
    }
    if (ev.st !== 'done' && cur === 1 && !isDaily && d < 1.0) tsT = 0.02;     // level 1 cannot be lost
    if (ev.st !== 'done' && d < 0.5) { ev.e.cur.hands[0] = [0.75, 1.55]; die(ev.near < 0.9 ? 'SO CLOSE! A TAP EARLIER' : 'KNOCKED OUT!', new V3(0, 0.1, 0.22)); }
  }
}
loop((dt0, t) => {
  if (!runner) return;
  const dt = dt0 * QAK; frameDt = dt;
  if (killT > 0) { killT -= dt / 60; tsT = 0.18; if (killT <= 0 && !active && state !== 'lost') tsT = 1; }
  if (hitStop > 0) { hitStop -= dt; ts = 0.02; } else ts = lerp(ts, tsT, (tsT > ts ? 0.12 : 0.2) * Math.min(dt, 2.5));
  const wdt = dt / 60 * ts;     // world seconds this frame
  const r = runner;
  if (state === 'play') {
    const pz = r.g.position.z; r.g.position.z -= RUN * wdt;
    const ev = events.find(x => x.st !== 'done');
    if (ev) stepEvent(ev, r, wdt, pz);
    else if (!active && r.g.position.z < finishZ && killT <= 0) win();
    if (state === 'play') ui.progress(Math.min(0.98, -r.g.position.z / -finishZ));
  }
  // runner pose
  if (r.dead && r.vel) {
    r.vel.y -= 0.006 * dt; r.g.position.addScaledVector(r.vel, dt); if (r.g.position.y < 0) { r.g.position.y = 0; r.vel.multiplyScalar(0.6); r.vel.y = Math.abs(r.vel.y) * 0.3; }
    r.g.rotation.x = Math.max(-1.45, r.g.rotation.x + r.spin * dt);
  } else if (state === 'won' || state === 'result-won') {
    endT += dt / 60; const c = r.cur;
    c.hipY = 0.92 + Math.abs(Math.sin(endT * 7)) * 0.25; c.lean = 0; c.hands = [[0.05, 2.0], [0.05, 2.0]]; c.feet = [[0.05, 0.07 + Math.abs(Math.sin(endT * 7)) * 0.2], [-0.05, 0.07 + Math.abs(Math.sin(endT * 7)) * 0.2]];
    r.g.rotation.y = lerp(r.g.rotation.y, 0, 0.05 * dt);
  } else {
    r.phase += wdt * 11.5;
    const anim = runCycle(r, r.phase), c = r.cur, k = Math.min(1, 0.35 * dt);
    c.hipY = lerp(c.hipY, anim.hipY, k);
    c.lean = lerp(c.lean, locks.chest ?? anim.lean, k);
    for (let s = 0; s < 2; s++) {
      const h = locks['hand' + s] || anim.hands[s], f = locks['foot' + s] || anim.feet[s];
      c.hands[s] = [lerp(c.hands[s][0], h[0], k), lerp(c.hands[s][1], h[1], k)];
      c.feet[s] = [lerp(c.feet[s][0], f[0], k), lerp(c.feet[s][1], f[1], k)];
    }
    const kickUp = Math.max(...[0, 1].map(s => locks['foot' + s] ? Math.max(0, locks['foot' + s][1] - 0.4) : 0));
    c.hipY += Math.min(0.35, kickUp * 0.3) - Math.max(0, Math.abs(c.lean) - 0.6) * 0.25;
  }
  Object.assign(r, { hipY: r.cur.hipY, lean: r.cur.lean, hands: r.cur.hands, feet: r.cur.feet });
  r.g.updateMatrixWorld(); pose(r);
  if (r.bandM) r.bandM.position.set(0, r.head.position.y + 0.06, r.head.position.z);
  if (capeM) { capeM.position.set(0, r.hipY + 0.5, -0.2 + Math.sin(r.lean) * 0.2); capeM.rotation.x = -0.35 - Math.min(0.9, (state === 'play' ? 0.5 : 0.1) * (0.6 + Math.sin(t * 9) * 0.25)); }
  // enemies
  for (const ev of events) {
    const e = ev.e;
    if (e.dead) { e.vel.y -= 0.005 * dt * Math.max(ts, 0.05); e.g.position.addScaledVector(e.vel, dt * Math.max(ts, 0.05)); e.g.rotation.x = Math.max(-1.5, e.g.rotation.x - e.spin * dt * Math.max(ts, 0.05)); if (e.g.position.y < 0) { e.g.position.y = 0; e.vel.set(0, 0, e.vel.z * 0.85); } }
    else { e.phase += wdt * 3; e.cur.hipY = 0.86 + Math.sin(e.phase * 2) * 0.02; }
    Object.assign(e, { hipY: e.cur.hipY, lean: e.cur.lean, hands: e.cur.hands, feet: e.cur.feet });
    if (Math.abs(e.g.position.z - r.g.position.z) < 40) {
      e.g.visible = true; e.g.updateMatrixWorld(); pose(e);
      if (ev.gun) { ev.gun.position.set(-0.29, e.joints[0].hand[1] + 0.02, e.joints[0].hand[0] + 0.06); }
    } else e.g.visible = false;
  }
  for (let i = rings.length - 1; i >= 0; i--) { const q = rings[i]; q.t += dt / 60; const k = q.t / 0.4; q.m.scale.setScalar(0.3 + k * 3.2 * q.big); q.m.material.opacity = Math.max(0, 1 - k); q.m.lookAt(camera.position); if (k >= 1) { worldG.remove(q.m); rings.splice(i, 1); } }
  // handles + target ring
  if (active && active.phase === 'slow' && state === 'play') {
    handlePoints().forEach((v, i) => { const [x, y] = toScreen(v); handles[i].style.left = x + 'px'; handles[i].style.top = y + 'px'; });
    if (active.tgt && !((active.type === 'gun' || active.type === 'barrel') && !active.dodged)) { const [x, y] = toScreen(active.tgt); tgtEl.style.left = x + 'px'; tgtEl.style.top = y + 'px'; tgtEl.classList.add('on'); } else tgtEl.classList.remove('on');
  }
  // camera: behind-right over the shoulder; closer and lower in slow-mo; kill-cam swings round the last thug
  const rp = r.g.position, slow = active ? 1 : 0;
  if (state === 'won' || state === 'result-won') { winT += dt / 60; tv.set(rp.x + Math.sin(winT * 0.8 + 0.6) * 4.5, 2.2, rp.z - Math.cos(winT * 0.8 + 0.6) * 4.5); camLook.lerp(_a.set(rp.x, 1.1, rp.z), 0.08 * dt); }
  else if (killT > 0) { const k = 1 - killT; tv.set(rp.x + 2.2 + k * 1.5, 1.5, rp.z - 2.4 + k * 3); camLook.lerp(_a.set(rp.x, 1.2, rp.z - 4.5), 0.14 * dt); }
  else {
    tv.set(rp.x + lerp(4.4, 3.1, slow), lerp(3.0, 1.9, slow), rp.z + lerp(5.0, 2.6, slow));
    const focus = active ? active.z * 0.45 + rp.z * 0.55 : rp.z - 3;
    camLook.lerp(_a.set(rp.x - 0.3, lerp(1.2, 1.15, slow), focus), 0.1 * dt);
  }
  if (snapCam) { camPos.copy(tv); camLook.set(rp.x - 0.3, 1.2, rp.z - 3); snapCam = false; }
  camPos.lerp(tv, 0.08 * Math.min(dt, 2.5)); camera.position.copy(camPos);
  if (camShake > 0) { camera.position.x += (Math.random() - 0.5) * camShake * 0.25; camera.position.y += (Math.random() - 0.5) * camShake * 0.25; camShake = Math.max(0, camShake - 0.06 * dt); }
  camera.lookAt(camLook);
  followLight(rp);
});

// ---------------------------------------------------------------- bot / QA helper
function autoPose() {
  if (state !== 'play' || !active || active.phase !== 'slow') return;
  if ((active.type === 'gun' || active.type === 'barrel') && !active.dodged) {
    if (active.low || active.type === 'barrel') { locks.foot0 = [0.0, 0.95]; locks.foot1 = [0.1, 0.9]; locks.hand0 = [0.4, 1.5]; locks.hand1 = [0.3, 1.5]; }
    else { locks.chest = -1.1; locks.hand0 = [-0.2, 1.7]; locks.hand1 = [-0.1, 1.65]; }
    return;
  }
  if (!active.tgt) return;
  const loc = runner.g.worldToLocal(active.tgt.clone());
  const useFoot = loc.y < 1.5;
  setLock(useFoot ? 'foot1' : 'hand1', loc);
  if (useFoot) locks.chest = -0.35;
}

// ---------------------------------------------------------------- UI: HUD, result cards, map, wardrobe
const css = document.createElement('style'); css.textContent = `
.pr-btn{pointer-events:auto;font:inherit;font-weight:800;font-size:18px;color:#fff;background:var(--ui,#ff7a1a);border:0;border-radius:30px;padding:9px 22px;box-shadow:0 4px 0 rgba(0,0,0,.2);cursor:pointer}
.pr-btn:active{transform:translateY(3px);box-shadow:0 1px 0 rgba(0,0,0,.2)}
.pr-btn.big{font-size:26px;padding:14px 54px;background:#3cc46a;box-shadow:0 5px 0 #2a9a50}
.pr-btn.sm{font-size:15px;padding:6px 16px;background:rgba(0,0,0,.28);box-shadow:none}
.pr-map{position:fixed;right:12px;top:calc(12px + env(safe-area-inset-top));z-index:6;width:42px;height:42px;border-radius:14px;border:0;background:rgba(0,0,0,.25);color:#fff;font-size:20px;font-weight:800;cursor:pointer}
.pr-combo{position:fixed;right:14px;top:calc(136px + env(safe-area-inset-top));z-index:6;font-weight:800;font-size:30px;color:#ffe14d;-webkit-text-stroke:2px #2b2d42;opacity:0;transform:scale(.6);transition:all .15s;pointer-events:none}
.pr-combo.on{opacity:1;transform:scale(1)} .pr-combo.fev{color:#ff5d8f;font-size:36px}
.slow.fev{background:radial-gradient(ellipse at center,rgba(255,60,140,0) 40%,rgba(255,40,120,.45) 100%)}
.hdl.hint{animation:hdlp .5s ease-in-out infinite;border-color:#ffe14d}
@keyframes hdlp{50%{transform:scale(1.45)}}
.pr-ov{position:fixed;inset:0;z-index:12;display:flex;flex-direction:column;align-items:center;padding:calc(36px + env(safe-area-inset-top)) 16px 24px;gap:10px;text-align:center;background:rgba(20,24,60,.9);overflow:auto}
.pr-ov h2{margin:0;font-size:34px;font-weight:800;text-shadow:0 4px 0 rgba(0,0,0,.2)}
.pr-ov p{margin:0;font-size:17px;font-weight:600}
.pr-res{z-index:11;background:rgba(10,14,40,.5);justify-content:flex-start;padding-top:calc(110px + env(safe-area-inset-top))}
.pr-stars{display:flex;gap:6px;justify-content:center}
.pr-stars svg{width:64px;height:64px;filter:drop-shadow(0 4px 0 rgba(0,0,0,.2));animation:prstar .5s cubic-bezier(.3,1.8,.5,1) both}
.pr-stars svg.dim{opacity:.35;animation:none}
@keyframes prstar{0%{transform:scale(0) rotate(-40deg)}100%{transform:scale(1) rotate(0)}}
.pr-tabs{display:flex;gap:6px}
.pr-tab{font:inherit;font-weight:800;font-size:13px;color:#fff;background:rgba(255,255,255,.18);border:0;border-radius:14px;padding:6px 10px;cursor:pointer}
.pr-tab.on{background:var(--ui,#ff7a1a)} .pr-tab.lk{opacity:.4}
.pr-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;width:min(340px,92vw)}
.pr-lv{font:inherit;position:relative;border:0;border-radius:16px;background:#fff;color:#2b2d42;font-weight:800;font-size:22px;padding:8px 0 4px;cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.22)}
.pr-lv small{display:block;font-size:12px;color:#e0a000;letter-spacing:1px;min-height:15px}
.pr-lv.lk{background:rgba(255,255,255,.25);color:#ffffff88;pointer-events:none;box-shadow:none}
.pr-lv.nx{background:#3cc46a;color:#fff;animation:hcpulse 1s ease-in-out infinite} .pr-lv.nx small{color:#fff}
.pr-lv.boss{background:#ffe14d} .pr-lv i{position:absolute;right:4px;top:2px;font-size:9px;font-style:normal;color:#b3261e}
.pr-bar{width:min(300px,80vw);height:12px;border-radius:8px;background:rgba(255,255,255,.25);overflow:hidden}
.pr-bar b{display:block;height:100%;background:#ffe14d}
.pr-sk{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;width:min(340px,92vw)}
.pr-o{font:inherit;border:3px solid transparent;border-radius:14px;background:rgba(255,255,255,.16);color:#fff;font-weight:700;font-size:13px;padding:8px 2px;cursor:pointer}
.pr-o.on{border-color:#ffe14d} .pr-o.lk{opacity:.4}
.pr-o span{display:block;width:34px;height:34px;border-radius:50%;margin:0 auto 4px;border:3px solid #fff}
.pr-new{color:#ffe14d;font-weight:800;font-size:20px;animation:hcpulse 1s ease-in-out infinite}
`; document.head.appendChild(css);
const dom = html => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };
const STAR = (on, z = 64, delay = 0) => `<svg viewBox="0 0 24 24" class="${on ? '' : 'dim'}" style="width:${z}px;height:${z}px;animation-delay:${delay}s"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.8-6.3 3.8 1.7-7L2 9.2l7.1-.6z" fill="${on ? '#ffd23f' : '#ffffff'}" stroke="#b07a00" stroke-width="1"/></svg>`;
const SS = (on, z = 13) => `<svg viewBox="0 0 24 24" style="width:${z}px;height:${z}px;vertical-align:-1px"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.8-6.3 3.8 1.7-7L2 9.2l7.1-.6z" fill="${on ? '#ffc400' : '#c9cbe0'}"/></svg>`;
const mapBtn = dom('<button class="pr-map hc-hidden" aria-label="Levels"><svg width="22" height="22" viewBox="0 0 22 22" fill="#fff"><rect x="2" y="2" width="7" height="7" rx="2"/><rect x="13" y="2" width="7" height="7" rx="2"/><rect x="2" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/></svg></button>'), comboEl = dom('<div class="pr-combo" id="combo"></div>');
document.body.append(mapBtn, comboEl);
mapBtn.addEventListener('pointerdown', e => e.stopPropagation());
mapBtn.addEventListener('click', () => { if (state === 'play' || state === 'result' || state === 'menu') showMap(); });
let resEl = null;
function closeOverlays() { document.querySelectorAll('.pr-ov').forEach(x => x.remove()); resEl = null; }
const nextOutfit = () => OUTFITS.find(o => o.need > totalStars());
function tomorrowLine() { const D = dly; const doneToday = D.last === dayNum(); return doneToday ? `Tomorrow: new Daily Gauntlet · day ${D.streak + 1}` : 'Daily Gauntlet is waiting on the map'; }
function showResult(won, reason, a, info) {
  closeOverlays(); ui.sub(''); state = won ? 'result-won' : 'result';
  const total = events.length;
  let html;
  if (won) {
    const s = a, newOut = unlockedOut() > seenOut; const no = nextOutfit(), have = totalStars();
    const prev = OUTFITS[Math.max(0, OUTFITS.indexOf(no) - 1)];
    html = `<h2>${isDaily ? 'DAILY CLEARED!' : 'LEVEL ' + cur + ' CLEARED!'}</h2>
      <div class="pr-stars">${[0, 1, 2].map(i => STAR(i < s, 64, 0.15 + i * 0.25)).join('')}</div>
      <p>${info.perf}/${info.n} perfect · ${info.sty} with style · ${score} points</p>
      ${s < 3 ? `<p style="opacity:.85">${s < 2 ? (info.sty < 1 && cur > 2 ? 'DRAG a limb by hand = 2 stars (taps alone stay at 1)' : 'More PERFECT = 2 stars: strike fast') : 'All perfect + drag half the limbs by hand = 3 stars'}</p>` : '<p class="pr-new">3 STARS!</p>'}
      ${newOut ? `<div class="pr-new">NEW OUTFIT: ${OUTFITS[unlockedOut() - 1].name}!</div>` : ''}
      ${no ? `<div class="pr-bar"><b style="width:${Math.min(100, (have - prev.need) / (no.need - prev.need) * 100)}%"></b></div><p style="font-size:13px">${no.need - have} ${SS(true, 13)} to the ${no.name} outfit</p>` : ''}
      <p style="font-size:13px">${tomorrowLine()}</p>
      <button class="pr-btn big" data-a="next">${isDaily ? 'Map' : cur >= NL ? 'Map' : 'Next'}</button>
      <div style="display:flex;gap:8px"><button class="pr-btn sm" data-a="again">${s < 3 ? 'Again for more stars' : 'Replay'}</button><button class="pr-btn sm" data-a="map">Map</button></div>`;
    seenOut = unlockedOut();
  } else {
    const near = a / total >= 0.6;
    const tip = reason === 'SHOT!' ? 'Tap in slow-mo: lean back before it lands' : reason === 'TRIPPED!' ? 'Tap in slow-mo: hop the barrel' : 'Tap fast when time slows: be quicker than his stride';
    html = `<h2>${near ? 'SO CLOSE!' : reason}</h2><p>${a} of ${total} thugs down${near ? ' · one more try!' : ''}</p><p style="font-size:14px;opacity:.85">${tip}</p>
      <button class="pr-btn big" data-a="again">Retry</button><button class="pr-btn sm" data-a="map">Map</button>`;
  }
  resEl = dom(`<div class="pr-ov pr-res">${html}</div>`);
  resEl.addEventListener('pointerdown', e => { e.stopPropagation(); const a2 = e.target.closest('[data-a]'); act(a2 ? a2.dataset.a : (won ? 'next' : 'again')); });
  document.body.appendChild(resEl);
  if (won) { tone(660, 0.1, 'triangle', 0.12, 1.5); }
}
function act(a) {
  if (state !== 'result' && state !== 'result-won') return;
  const wasDaily = isDaily;
  if (a === 'again') startLevel(cur, wasDaily);
  else if (a === 'next') { if (wasDaily || cur >= NL) showMap(); else startLevel(cur + 1, false); }
  else if (a === 'map') showMap();
}
let mapWorld = 0;
const worldOpen = i => i === 0 || starsOf(i * 12) >= 1;
const wStars = i => { let t = 0; for (let k = 1; k <= 12; k++) t += starsOf(i * 12 + k); return t; };
function showMap(wi) {
  closeOverlays(); const fromState = state; if (state === 'play') { state = 'menu'; }
  mapWorld = wi == null ? Math.floor((nextOpen() - 1) / 12) : wi; const nx = nextOpen(), have = totalStars(), no = nextOutfit();
  const lv = k => { const n = mapWorld * 12 + k + 1, s = starsOf(n), open = isOpen(n);
    return `<button class="pr-lv ${!open ? 'lk' : n === nx ? 'nx' : ''} ${k === 11 ? 'boss' : ''}" data-l="${n}">${n}<small>${open ? [0, 1, 2].map(i => SS(i < s)).join('') : '🔒'}</small>${k === 11 ? '<i>BOSS</i>' : ''}</button>`; };
  const D = dly, doneToday = D.last === dayNum();
  const el = dom(`<div class="pr-ov"><h2>${WORLDS[mapWorld].name}</h2>
    <div class="pr-tabs">${WORLDS.map((w, i) => `<button class="pr-tab ${i === mapWorld ? 'on' : ''} ${worldOpen(i) ? '' : 'lk'}" data-w="${i}">${i + 1} · ${wStars(i)}/36 ${SS(true, 12)}</button>`).join('')}</div>
    <div class="pr-grid" style="${worldOpen(mapWorld) ? '' : 'opacity:.5;pointer-events:none'}">${Array.from({ length: 12 }, (_, k) => lv(k)).join('')}</div>
    ${no ? `<div class="pr-bar"><b style="width:${Math.min(100, (have - OUTFITS[OUTFITS.indexOf(no) - 1].need) / (no.need - OUTFITS[OUTFITS.indexOf(no) - 1].need) * 100)}%"></b></div><p style="font-size:13px">${no.need - have} ${SS(true, 13)} to the ${no.name} outfit</p>` : '<p style="font-size:13px">All outfits unlocked!</p>'}
    <button class="pr-btn" data-a="daily" style="background:${doneToday ? '#5b6396' : '#ff5d8f'}">Daily Gauntlet ${doneToday ? '· done · day ' + D.streak : D.streak && D.last === yest() ? '· day ' + (D.streak + 1) + ' streak' : ''}</button>
    <div style="display:flex;gap:8px"><button class="pr-btn sm" data-a="wear">Outfits</button><button class="pr-btn sm" data-a="back">Back</button></div></div>`);
  el.addEventListener('pointerdown', e => e.stopPropagation());
  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.l) { sfx.tap(); startLevel(+b.dataset.l, false); }
    else if (b.dataset.w) { if (worldOpen(+b.dataset.w)) showMap(+b.dataset.w); else tone(180, 0.1, 'square', 0.08, 0.7); }
    else if (b.dataset.a === 'daily') { sfx.tap(); startLevel(cur, true); }
    else if (b.dataset.a === 'wear') showWardrobe();
    else if (b.dataset.a === 'back') { closeOverlays(); if (state === 'menu' && events && events.length && runner && !runner.dead) { state = 'play'; } else if (fromState === 'result' || fromState === 'result-won') startLevel(cur, isDaily); else startLevel(cur, isDaily); }
  });
  document.body.appendChild(el);
}
function showWardrobe() {
  closeOverlays(); const have = totalStars();
  const el = dom(`<div class="pr-ov"><h2>Outfits</h2><p>${have} ${SS(true, 14)} collected</p><div class="pr-sk">${OUTFITS.map((o, i) => `<button class="pr-o ${have < o.need ? 'lk' : ''} ${i === outfit ? 'on' : ''}" data-o="${i}"><span style="background:${o.shirt}"></span>${have >= o.need ? o.name : o.need + ' ★'}</button>`).join('')}</div><button class="pr-btn" data-a="map">Back</button></div>`);
  el.addEventListener('pointerdown', e => e.stopPropagation());
  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.o != null) { const i = +b.dataset.o; if (have < OUTFITS[i].need) { tone(180, 0.1, 'square', 0.08, 0.7); return; } outfit = i; save(); sfx.tap(); showWardrobe(); }
    else showMap();
  });
  document.body.appendChild(el);
}

ui.sub(totalStars() ? `${totalStars()} stars · level ${nextOpen()}` : '');
buildLevel();
window.__game = {
  get state() { return state; }, get level() { return cur; }, get score() { return score; }, get stars() { return totalStars(); }, get prog() { return prog; }, get results() { return results; }, get active() { return !!active; },
  bot: (style) => { if (style) { dragUsed = true; tapUsed = false; } else tapUsed = true; autoPose(); },
  load: (n, daily) => startLevel(n, daily), map: showMap, NL, act, set outfit(i) { outfit = i; }, get ev() { return events; },
  reset() { prog = {}; dly = { last: 0, streak: 0, days: 0 }; outfit = 0; seenOut = 0; save(); },
};
