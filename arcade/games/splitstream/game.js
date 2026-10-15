// Splitstream — original game. Roller-skate along twin rails above a sunset city: drag to stretch your legs apart or
// snap them together so each skate stays on its rail; straddle blocks on wide decks, squeeze onto single beams.
import { THREE, createStage, createUI, input, loop, burst, confetti, sfx, tone, note, buzz, mat, glossy, rounded, store, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { board as worldBoard } from './kit/board.js';

const ST = store('splitstream');
const F = flow('splitstream');
const WB = worldBoard({ game: 'splitstream', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 0.15 }, mode: 'sum' });
let level = ST.get('level', 1), total = ST.get('gems', 0);
const { scene, camera, followLight } = createStage({ fov: 58, shadowSize: 12 });
const ui = createUI({ title: 'SPLIT<br>STREAM', hint: 'Tap right = wider · left = narrower · or drag', hand: '👆', score: false });
const $ = id => document.getElementById(id);
const SKIES = [
  { bg: ['#ff9a3c', '#ffe08a'], fog: '#ffc76b', city: ['#ffcf5c', '#ffb347', '#ffd98a'], stripe: '#2ee66b', ui: '#ff6a3d' },
  { bg: ['#ff6fd8', '#fff3a0'], fog: '#ffc6d9', city: ['#ffd1f0', '#ffb3e6', '#ffe0f7'], stripe: '#ff4fa3', ui: '#e0389a' },
  { bg: ['#7b2ff7', '#2ec5ff'], fog: '#5d8dff', city: ['#c6f0ff', '#a3e4ff', '#e2f8ff'], stripe: '#2ee6c3', ui: '#7b2ff7' },
];
const RW = 0.95, SPEED_0 = 12.5, MINS = 0.35, MAXS = 7.2;

// ---------------------------------------------------------------- skater
function makeSkater() {
  const g = new THREE.Group();
  const skin = mat('#f2b48c'), suit = glossy('#3a86ff'), top = glossy('#ff4fa3'), hair = mat('#2b1b12'), boot = glossy('#ff4fa3'), wheel = glossy('#7b5cff');
  const M = (geo, m, x, y, z, p = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o; };
  const body = new THREE.Group(); g.add(body);
  M(new THREE.SphereGeometry(0.26, 16, 12), suit, 0, 0, 0, body).scale.set(1.15, 0.8, 0.9);              // hips
  const torso = M(new THREE.CapsuleGeometry(0.2, 0.42, 6, 14), top, 0, 0.42, 0, body); torso.scale.set(1.1, 1, 0.8);
  M(new THREE.SphereGeometry(0.19, 18, 14), skin, 0, 0.92, 0, body);
  M(new THREE.SphereGeometry(0.205, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, 0.94, 0.02, body);
  const bun = M(new THREE.SphereGeometry(0.11, 12, 10), hair, 0, 1.08, 0.12, body);
  const arm = (sx) => { const p = new THREE.Group(); p.position.set(sx * 0.27, 0.64, 0); body.add(p); M(new THREE.CapsuleGeometry(0.06, 0.5, 4, 8), skin, 0, -0.3, 0, p); return p; };
  const armL = arm(-1), armR = arm(1);
  // legs: unit capsule scaled to hip→foot distance
  const legGeo = new THREE.CapsuleGeometry(0.1, 1, 4, 10); legGeo.translate(0, -0.5, 0);
  const legL = M(legGeo, suit, 0, 0, 0), legR = M(legGeo, suit, 0, 0, 0);
  const skate = () => { const s = new THREE.Group(); g.add(s); M(rounded(0.24, 0.3, 0.42, 0.08), boot, 0, 0.27, 0, s); M(new THREE.BoxGeometry(0.2, 0.05, 0.5), mat('#ffffff'), 0, 0.1, 0, s); for (const z of [-0.17, 0.17]) { const w = M(new THREE.CylinderGeometry(0.07, 0.07, 0.2, 12), wheel, 0, 0.06, z, s); w.rotation.z = Math.PI / 2; } return s; };
  const skL = skate(), skR = skate();
  Object.assign(g, { body, armL, armR, legL, legR, skL, skR, bun });
  return g;
}
const sk = makeSkater(); scene.add(sk);

// rainbow trails (one ribbon per skate)
const TRAIL = 26, RAIN = ['#ff3b5c', '#ff9f1c', '#ffe03b', '#3ddc84', '#2fb7ff', '#8a5cff'];
function makeTrail() {
  const lanes = RAIN.length, verts = (TRAIL - 1) * lanes * 6;
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
  const col = new Float32Array(verts * 3), c = new THREE.Color();
  for (let i = 0; i < TRAIL - 1; i++) for (let l = 0; l < lanes; l++) { c.set(RAIN[l]); for (let v = 0; v < 6; v++) col.set([c.r, c.g, c.b], ((i * lanes + l) * 6 + v) * 3); }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })); m.frustumCulled = false; scene.add(m);
  return { m, pts: [] };
}
const trails = [makeTrail(), makeTrail()];
function updateTrail(tr, x, y, z) {
  tr.pts.unshift([x, y, z]); if (tr.pts.length > TRAIL) tr.pts.pop();
  const p = tr.m.geometry.attributes.position.array, lanes = RAIN.length, W = 0.3; let o = 0;
  for (let i = 0; i < TRAIL - 1; i++) {
    const a = tr.pts[Math.min(i, tr.pts.length - 1)], b = tr.pts[Math.min(i + 1, tr.pts.length - 1)];
    const wa = W * (1 - i / TRAIL), wb = W * (1 - (i + 1) / TRAIL);
    for (let l = 0; l < lanes; l++) {
      const fa0 = -wa / 2 + wa * l / lanes, fa1 = fa0 + wa / lanes, fb0 = -wb / 2 + wb * l / lanes, fb1 = fb0 + wb / lanes;
      const q = [a[0] + fa0, a[1], a[2], a[0] + fa1, a[1], a[2], b[0] + fb1, b[1], b[2], a[0] + fa0, a[1], a[2], b[0] + fb1, b[1], b[2], b[0] + fb0, b[1], b[2]];
      p.set(q, o); o += 18;
    }
  }
  tr.m.geometry.attributes.position.needsUpdate = true;
}

// ---------------------------------------------------------------- scenery (per theme)
let scenery;
function buildScenery(th) {
  if (scenery) scene.remove(scenery);
  scenery = new THREE.Group(); scene.add(scenery);
  const R = rng(5), geo = new THREE.BoxGeometry(1, 1, 1), n = 160, im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.9, emissive: th.city[0], emissiveIntensity: 0.25 }), n), M = new THREE.Matrix4(), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1, x = side * (14 + R() * 60), z = 40 - (i / n) * 520 - R() * 6, w = 4 + R() * 7, h = 18 + R() * 40;
    M.compose(new THREE.Vector3(x, -34 + h / 2, z), new THREE.Quaternion(), new THREE.Vector3(w, h, w)); im.setMatrixAt(i, M); im.setColorAt(i, c.set(th.city[i % 3]));
  }
  scenery.add(im);
  // crescent moon sprite
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.beginPath(); x.arc(64, 64, 50, 0, 7); x.fill(); x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.arc(86, 50, 46, 0, 7); x.fill();
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, fog: false, transparent: true })); moon.scale.set(9, 9, 1); moon.position.set(19, 26, -120); scenery.add(moon); scenery.moon = moon;
}

// ---------------------------------------------------------------- track
let world, segs, gemsArr, gemMesh, blocks = [], state = 'ready', K, R, endZ, th, gems = 0, offT = 0, fall = null, endT = 0, speed = SPEED_0;
const sm = t => t * t * (3 - 2 * t);
function at(z) {   // → { c, g, type, seg }
  for (const s of segs) if (z <= s.z0 && z >= s.z1) { const t = sm((s.z0 - z) / (s.z0 - s.z1)); return { c: lerp(s.c0, s.c1, t), g: lerp(s.g0, s.g1, t), type: s.type, s }; }
  const s = z > segs[0].z0 ? segs[0] : segs[segs.length - 1]; return { c: z > s.z0 ? s.c0 : s.c1, g: z > s.z0 ? s.g0 : s.g1, type: s.type, s };
}
function buildLevel() {
  if (world) scene.remove(world);
  world = new THREE.Group(); scene.add(world);
  R = rng(level * 3301 + 17); th = SKIES[(level - 1) % SKIES.length];
  document.body.style.setProperty('--bg1', th.bg[0]); document.body.style.setProperty('--bg2', th.bg[1]); document.body.style.setProperty('--ui', th.ui);
  scene.fog = new THREE.Fog(th.fog, 30, 120);
  buildScenery(th);
  segs = []; blocks = []; gems = 0; offT = 0; fall = null; endT = 0;
  const fk = F.k(); speed = (SPEED_0 + Math.min(4, level * 0.35)) * fk;
  let z = 8, c = 0, g = 1.6;
  const push = (type, len, g1, c1, extra = {}) => { segs.push({ type, z0: z, z1: z - len, g0: g, g1, c0: c, c1, ...extra }); z -= len; g = g1; c = c1; };
  push('twin', 22, 1.6, 0);
  const L = Math.min(440, (150 + level * 22) * fk); const maxG = Math.min(6.2, 3.4 + level * 0.35);
  while (z > -L) {
    const r = R(), nc = clamp(c + (R() - 0.5) * 3, -2.5, 2.5);
    if (r < 0.5) push('twin', 9 + R() * 8 - Math.min(4, level * 0.3), 0.9 + R() * (maxG - 0.9), nc);
    else if (r < 0.68 && level > 1) { push('twin', 7, 0, nc); push('single', 8 + R() * 6, 0, nc); push('twin', 7, 1.4 + R() * 2, nc); }
    else if (r < 0.86) { const b = 1.4 + R() * 1.8, W = 7.2; push('twin', 7, (b + W) / 2 - 0.4, 0); push('deck', 10 + R() * 4, (b + W) / 2 - 0.4, 0, { b, W }); }
    else push('twin', 12, g, nc);
  }
  push('twin', 10, 1.6, c); endZ = z; push('twin', 30, 1.6, c);
  // geometry: rails as striped ribbons with a deep pale wall under them (fades into fog)
  const pos = [], col = [], C = new THREE.Color(), C2 = new THREE.Color(), quad = (a, b, cc, d, color, bottom = color) => { C.set(color); C2.set(bottom); const cs = [C, C, C2, C, C2, C2]; [a, b, cc, a, cc, d].forEach((v, i) => { pos.push(...v); col.push(cs[i].r, cs[i].g, cs[i].b); }); };
  const STEP = 0.6, H = 0.32, DEEP = 9;
  for (const side of [-1, 1]) {
    for (let zz = segs[0].z0; zz > segs[segs.length - 1].z1; zz -= STEP) {
      const A = at(zz), B = at(zz - STEP); if (A.type === 'deck' || B.type === 'deck') continue;
      const xa = A.c + side * A.g / 2, xb = B.c + side * B.g / 2, z1 = zz - STEP;
      const stripe = Math.floor(-zz / 1.2) % 2 ? th.stripe : '#ffffff';
      quad([xa - RW / 2, 0, zz], [xa + RW / 2, 0, zz], [xb + RW / 2, 0, z1], [xb - RW / 2, 0, z1], '#ffffff');
      for (const e of [-1, 1]) {
        const ea = xa + e * RW / 2, eb = xb + e * RW / 2;
        quad([ea, 0, zz], [eb, 0, z1], [eb, -H, z1], [ea, -H, zz], stripe);
        quad([ea, -H, zz], [eb, -H, z1], [eb, -DEEP, z1], [ea, -DEEP, zz], '#fffaf2', th.fog);
      }
    }
  }
  const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g2.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g2.computeVertexNormals();
  const rails = new THREE.Mesh(g2, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, side: THREE.DoubleSide, emissive: '#ffffff', emissiveIntensity: 0.22 })); rails.receiveShadow = true; world.add(rails);
  // decks with a centre block to straddle
  for (const s of segs) if (s.type === 'deck') {
    const len = s.z0 - s.z1, d = new THREE.Mesh(new THREE.BoxGeometry(s.W, 0.32, len), mat('#ffffff')); d.position.set(0, -0.16, (s.z0 + s.z1) / 2); d.receiveShadow = true; world.add(d);
    for (const e of [-1, 1]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.32, len), mat(th.stripe)); st.position.set(e * s.W / 2, -0.16, d.position.z); world.add(st); }
    const wall = new THREE.Mesh(new THREE.BoxGeometry(s.W - 0.2, 8, len), mat('#fffaf2', { emissive: '#ffffff', emissiveIntensity: 0.2 })); wall.position.set(0, -4.4, d.position.z); world.add(wall);
    const bt = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#ff3b5c'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#fff'; for (let i = -1; i < 4; i++) { x.beginPath(); x.moveTo(i * 24, 64); x.lineTo(i * 24 + 12, 64); x.lineTo(i * 24 + 36, 0); x.lineTo(i * 24 + 24, 0); x.fill(); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, len / 2); return t; })();
    const blk = new THREE.Mesh(new THREE.BoxGeometry(s.b, 1.1, len - 2), mat('#ffffff', { map: bt })); blk.position.set(0, 0.55, d.position.z); blk.castShadow = true; blk.receiveShadow = true; world.add(blk);
    blocks.push(blk);
  }
  // gems on the rails
  gemsArr = [];
  for (let zz = -14; zz > endZ + 5; zz -= 7 + R() * 6) {
    const A = at(zz); const side = R() < 0.5 ? -1 : 1;
    for (let k = 0; k < 3; k++) { const B = at(zz - k * 1.3); const x = B.type === 'deck' ? side * (B.s.b / 2 + (B.s.W / 2 - B.s.b / 2) / 2) : B.c + side * B.g / 2; gemsArr.push({ x, z: zz - k * 1.3, got: false }); }
  }
  gemMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.26, 0), glossy('#ff4fd8', { emissive: '#b0109a', emissiveIntensity: 0.4, flatShading: true }), gemsArr.length || 1); world.add(gemMesh);
  // finish arch + checker
  const fin = new THREE.Group(); fin.position.set(at(endZ).c, 0, endZ); world.add(fin);
  const arch = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.22, 10, 32, Math.PI), glossy(th.ui)); arch.position.y = 0; fin.add(arch);
  const chk = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 8; const x = c.getContext('2d'); for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#222' : '#fff'; x.fillRect(i * 4, j * 4, 4, 4); } const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const line = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 0.6), new THREE.MeshBasicMaterial({ map: chk })); line.rotation.x = -Math.PI / 2; line.position.y = 0.02; fin.add(line);
  K = { z: 0, s: 1.6, t: 1.6, c: 0, ph: 0 };
  for (const tr of trails) tr.pts = [];
  ui.levels(level); ui.progress(0); hud();
}
function hud() { $('gems').textContent = '💎 ' + (total + gems); }

// ---------------------------------------------------------------- input: horizontal drag stretches the legs
let dragging = false, botS = null;
let tapOk = false;
input({
  onDown() { tapOk = state === 'play'; if (tapOk) { dragging = true; botS = null; } },
  onMove(dx) { if (state === 'play' && dragging) K.t = clamp(K.t + dx * 0.022, MINS, MAXS); },
  onUp() { dragging = false; },
  onTap(e) { if (state === 'play' && tapOk) K.t = clamp(K.t + (e.clientX > innerWidth / 2 ? 0.7 : -0.7), MINS, MAXS); },   // tap right half = legs wider, left half = narrower
});
ui.onTap(w => { WB.start();
  if (w === 'start') { state = 'play'; sfx.tap(); }
  else if (w === 'win') { level++; ST.set('level', level); buildLevel(); state = 'play'; }
  else { buildLevel(); state = 'play'; }
});

function ok(A, s) {
  if (A.type === 'deck') return s > A.s.b + 0.2 && s < A.s.W - 0.05;
  return Math.abs(s - A.g) < RW + 0.12;
}
function lose() { if (state === 'play') F.level(false, clamp(K.z / endZ, 0, 1)); state = 'lost'; sfx.fail(); buzz([50, 30, 80]); ui.lose('WIPEOUT!', `${gems} 💎 this run`); }
function win() {
  if (state === 'play') { F.level(true); WB.submit(1); }
  state = 'won'; total += gems; ST.set('gems', total); sfx.win(); buzz([20, 40, 20]); ui.flash(0.6); ui.progress(1);
  confetti(world, new THREE.Vector3(K.c, 3, K.z - 2), 120); setTimeout(() => confetti(world, new THREE.Vector3(K.c, 3, K.z - 2), 80), 300);
  ui.win(level, `${gems} 💎 collected`);
}

// ---------------------------------------------------------------- frame
const V = new THREE.Vector3(), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S3 = new THREE.Vector3(), E = new THREE.Euler(), UP = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0);
let camX = 0, warnT = 0, combo = 0, lastGem = 0;
loop((dt, t) => {
  if (!K) return;
  const s = dt / 60, play = state === 'play';
  if (play && !fall) {
    K.z -= speed * s;
    if (botS !== null && !dragging) K.t = lerp(K.t, botS, 0.45 * dt);
    const A = at(K.z);
    K.c = lerp(K.c, A.c, 0.35 * dt);
    if (!ok(A, K.s)) { offT += s; warnT += s; if (warnT > 0.08) { warnT = 0; buzz(10); tone(180, 0.05, 'square', 0.05, 0.8); burst(world, new THREE.Vector3(K.c, 0.1, K.z), ['#ff3b5c', '#ffe03b'], 3, { speed: 0.06, up: 0.05, size: 0.4 }); } }
    else offT = Math.max(0, offT - s * 2);
    if (offT > 0.16) {
      const fl = A.type === 'deck' ? (K.s <= A.s.b + 0.2 ? 'block' : 'edge') : 'rail';
      fall = { vy: 0.05, rz: (K.s > A.g ? 1 : -1) * (Math.random() < 0.5 ? 1 : -1), why: fl }; sfx.smash(); buzz([60, 40, 60]); ui.flash(0.35); ui.pop(fl === 'block' ? 'CRASH!' : 'SLIPPED!', '#ff3b5c', 40, 30);
      setTimeout(lose, 800);
    }
    for (const gm of gemsArr) if (!gm.got && Math.abs(gm.z - K.z) < 0.6 && (Math.abs(gm.x - (K.c - K.s / 2)) < 0.6 || Math.abs(gm.x - (K.c + K.s / 2)) < 0.6)) { gm.got = true; gems++; combo = t - lastGem < 1.2 ? combo + 1 : 1; lastGem = t; note(72 + (combo % 5) * 2, 0.12, 0.1); buzz(5); burst(world, new THREE.Vector3(gm.x, 0.6, gm.z), ['#ff4fd8', '#ffffff'], 7, { speed: 0.08, up: 0.06, size: 0.5 }); hud(); if (combo % 5 === 0) ui.pop('GEM RUSH x' + combo, '#fff', 30, 30); }
    ui.progress(Math.min(1, K.z / endZ));
    if (K.z < endZ) win();
  }
  K.s = lerp(K.s, K.t, 0.32 * dt);
  // pose: hip lowers as legs spread (splits), body leans + arms balance
  const half = K.s / 2, hipY = clamp(1.25 - Math.max(0, K.s - 1.2) * 0.14, 0.5, 1.25);
  sk.position.set(K.c, 0, K.z);
  if (fall) { fall.vy -= 0.01 * dt; sk.position.y = (sk.position.y || 0); sk.userData.fy = (sk.userData.fy || 0) + fall.vy * dt; sk.rotation.z += 0.04 * fall.rz * dt; sk.rotation.x -= 0.02 * dt; sk.position.y = sk.userData.fy; }
  else { sk.userData.fy = 0; sk.rotation.set(0, 0, 0); }
  K.ph += s * 6 * (play ? 1 : 0);
  const glide = Math.sin(K.ph) * 0.12;
  sk.body.position.set(Math.sin(K.ph * 0.5) * 0.05, hipY, 0);
  sk.body.rotation.x = -0.18; sk.body.rotation.z = Math.sin(K.ph * 0.5) * 0.06;
  const armUp = clamp((K.s - 1) * 0.35, 0.2, 1.35);
  sk.armL.rotation.set(Math.sin(K.ph) * 0.2, 0, -armUp - Math.sin(t * 5) * 0.08); sk.armR.rotation.set(-Math.sin(K.ph) * 0.2, 0, armUp + Math.sin(t * 5) * 0.08);
  if (state === 'won') { endT += s; sk.armL.rotation.set(0, 0, -2.7 - Math.sin(endT * 9) * 0.2); sk.armR.rotation.set(0, 0, 2.7 + Math.sin(endT * 9) * 0.2); }
  for (const [leg, skate, sg, ph] of [[sk.legL, sk.skL, -1, 0], [sk.legR, sk.skR, 1, Math.PI]]) {
    const fz = Math.sin(K.ph + ph) * 0.25 * (K.s < 2.5 ? 1 : 0.4), hx = sg * 0.14 + sk.body.position.x, fx = sg * half;
    skate.position.set(fx, 0, fz);
    const dx = fx - hx, dy = 0.3 - hipY, dz = fz, len = Math.hypot(dx, dy, dz);
    leg.position.set(hx, hipY, 0); leg.quaternion.setFromUnitVectors(DOWN, V.set(dx, dy, dz).normalize()); leg.scale.set(1, len, 1);
    skate.rotation.z = -sg * clamp((K.s - 2) * 0.05, 0, 0.25);
  }
  // trails behind each skate
  if (!fall) { updateTrail(trails[0], K.c - half, 0.03, K.z + 0.25); updateTrail(trails[1], K.c + half, 0.03, K.z + 0.25); }
  // gems spin
  gemsArr.forEach((g, i) => { M4.compose(V.set(g.x, 0.55 + Math.sin(t * 3 + i) * 0.1, g.z), Q.setFromEuler(E.set(0, t * 2 + i, 0)), S3.setScalar(g.got ? 0 : 1)); gemMesh.setMatrixAt(i, M4); }); gemMesh.instanceMatrix.needsUpdate = true;
  // span meter (bottom): knob shows leg spread, centre target shows what the track needs ahead
  $('knob').style.left = ((K.s - MINS) / (MAXS - MINS) * 100) + '%';
  // camera: low chase behind, slight lag sideways
  camX = lerp(camX, K.c, 0.08 * dt);
  const back = 7 + K.s * 0.3 + (state === 'won' ? 2 : 0);
  camera.position.set(camX + (state === 'won' ? Math.sin(endT * 0.6) * 3 : 0), 3.3 + K.s * 0.14, K.z + back);
  camera.lookAt(camX, 0.4, K.z - 7);
  followLight(V.set(K.c, 0, K.z - 2));
  scenery.position.z = K.z * 0.85;
});

buildLevel();

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return total + gems; },
  bot() {
    if (state !== 'play' || fall) return;
    // aim for what the track needs a short distance ahead (the spread lags a little)
    const A = at(K.z - speed * 0.16);
    botS = A.type === 'deck' ? (A.s.b + A.s.W) / 2 : clamp(A.g, MINS, MAXS);
  },
};
