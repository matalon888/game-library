// Tiptoe Tower — original game. Strut down a rooftop runway, grab shoes to stack your heels sky-high, step over brick
// walls (they eat heel blocks), do the splits across rooftop rails, then spend what's left climbing the multiplier podium.
import { THREE, createStage, createUI, input, loop, burst, confetti, sfx, tone, note, buzz, mat, glossy, rounded, store, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { board as worldBoard } from './kit/board.js';
import { bake, vcMat } from './bake.js';

const ST = store('tiptoetower');
const F = flow('tiptoetower');
const WB = worldBoard({ game: 'tiptoe-tower', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 0.15 }, mode: 'sum' });
let level = ST.get('level', 1), best = ST.get('best', 0), total = ST.get('gems', 0);
const { scene, camera, followLight } = createStage({ fov: 50, shadowSize: 14 });
const ui = createUI({ title: 'TIPTOE<br>TOWER', hint: 'Tap a side · grab the shoes', hand: '👆', score: false });
const nextCard = w => (l, x) => { ui.els.win.querySelector('.hint').textContent = 'Level ' + (l + 1) + ' ▶'; w(l, x); }; ui.win = nextCard(ui.win);   // one tap → next level
const $ = id => document.getElementById(id);
const SKIES = [['#3fa9ff', '#c4ecff', '#ff4fa3'], ['#ff7eb6', '#ffe0ef', '#c13aff'], ['#8f6bff', '#ffd1f0', '#ff4fa3'], ['#25c2d9', '#d9fbff', '#ff5d8f']];
const TW = 5.4, BH = 0.34, SPEED = 9, LANES = [-1.7, 0, 1.7];
const HEEL_COLS = ['#ff4fa3', '#ff86c2'];

// ---------------------------------------------------------------- the strutter
const SKIN = '#ffcfb0';
function makeGirl() {
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  const sk = mat(SKIN), top = glossy('#ffffff'), skirt = glossy('#ff4fa3'), hair = mat('#5a2d1a');
  const M = (geo, m, x, y, z, p = inner) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o; };
  const legPiv = (x) => { const p = new THREE.Group(); p.position.set(x, 1.05, 0); inner.add(p); M(new THREE.CapsuleGeometry(0.085, 0.86, 4, 10), sk, 0, -0.5, 0, p); const shoe = M(new THREE.BoxGeometry(0.18, 0.1, 0.32), skirt, 0, -0.98, -0.04, p); return p; };
  const legL = legPiv(-0.12), legR = legPiv(0.12);
  M(new THREE.CylinderGeometry(0.14, 0.36, 0.42, 16), skirt, 0, 1.08, 0);
  const torso = M(new THREE.CapsuleGeometry(0.17, 0.34, 6, 14), top, 0, 1.47, 0); torso.scale.set(1, 1, 0.8);
  M(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 8), sk, 0, 1.78, 0);
  const head = M(new THREE.SphereGeometry(0.17, 20, 16), sk, 0, 1.95, 0);
  M(new THREE.SphereGeometry(0.185, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.6), hair, 0, 1.97, 0.02);
  const pony = M(new THREE.CapsuleGeometry(0.075, 0.34, 4, 8), hair, 0, 1.78, 0.2); pony.rotation.x = 0.35;
  const armPiv = (x, sgn) => { const p = new THREE.Group(); p.position.set(x, 1.66, 0); p.rotation.z = sgn * 0.18; inner.add(p); M(new THREE.CapsuleGeometry(0.06, 0.52, 4, 8), sk, 0, -0.32, 0, p); return p; };
  const armL = armPiv(-0.24, -1), armR = armPiv(0.24, 1);
  Object.assign(g, { inner, legL, legR, armL, armR, pony, head });
  return g;
}
const girl = makeGirl(); scene.add(girl);
// heel blocks (both feet) + loose falling blocks, one instanced mesh
const heelGeo = rounded(0.26, BH * 0.92, 0.38, 0.05);
const heels = new THREE.InstancedMesh(heelGeo, glossy('#ffffff'), 140); heels.castShadow = true; heels.frustumCulled = false; scene.add(heels);
for (let i = 0; i < 140; i++) heels.setColorAt(i, new THREE.Color(HEEL_COLS[i % 2]));
// shoe pickup model
const shoeGeo = bake([
  { geo: new THREE.SphereGeometry(0.2, 16, 10), color: '#ff2d8a', pos: [0, 0.09, -0.36], scl: [0.85, 0.5, 1.45] },
  { geo: new THREE.BoxGeometry(0.28, 0.06, 0.66), color: '#ff2d8a', pos: [0, 0.3, 0.0], rot: [-0.72, 0, 0] },
  { geo: new THREE.BoxGeometry(0.3, 0.26, 0.1), color: '#ff7ab8', pos: [0, 0.6, 0.3] },
  { geo: new THREE.CylinderGeometry(0.045, 0.022, 0.52, 8), color: '#ff2d8a', pos: [0, 0.26, 0.31] },
  { geo: new THREE.TorusGeometry(0.15, 0.028, 6, 18), color: '#ffd23f', pos: [0, 0.5, 0.12], rot: [Math.PI / 2 - 0.7, 0, 0] },
  { geo: new THREE.SphereGeometry(0.05, 8, 6), color: '#ffffff', pos: [0, 0.22, -0.52] },
]);
const gemGeo = new THREE.OctahedronGeometry(0.22, 0); gemGeo.scale(1, 1.25, 1);

// ---------------------------------------------------------------- static scenery: city + clouds (built once)
const scenery = new THREE.Group(); scene.add(scenery);
{
  const parts = [], R = rng(42);
  for (let i = 0; i < 90; i++) {
    const side = i % 2 ? 1 : -1, x = side * (9 + R() * 30), z = 30 - i * 5.5 - R() * 4, w = 3 + R() * 4, h = 14 + R() * 30, c = ['#9fd3ff', '#b9ddff', '#8cc3f7', '#c7e6ff'][Math.floor(R() * 4)];
    parts.push({ geo: new THREE.BoxGeometry(w, h, w), color: c, pos: [x, -30 + h / 2, z] });
    for (let y = -26; y < -30 + h - 1; y += 2.2) parts.push({ geo: new THREE.BoxGeometry(w + 0.04, 0.5, w * 0.8), color: '#e8f5ff', pos: [x, y, z] });
    if (R() < 0.3) parts.push({ geo: new THREE.CylinderGeometry(0.1, 0.1, 6, 6), color: '#ffffff', pos: [x, -30 + h + 3, z] });
  }
  const city = new THREE.Mesh(bake(parts), vcMat({ roughness: 0.7 })); scenery.add(city);
  const cl = [];
  for (let i = 0; i < 26; i++) { const x = (R() < 0.5 ? -1 : 1) * (7 + R() * 30), y = 13 + R() * 14, z = -i * 20 - R() * 10; for (let k = 0; k < 4; k++) cl.push({ geo: new THREE.SphereGeometry(1.6 + R() * 1.4, 12, 8), color: '#ffffff', pos: [x + k * 1.9 - 3, y + (k % 2) * 0.6, z], scl: [1, 0.65, 0.8] }); }
  scenery.add(new THREE.Mesh(bake(cl), vcMat({ roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.35 })));
}

// ---------------------------------------------------------------- level
let world, items = [], walls = [], rails = [], steps = [], debris = [], state = 'ready', G, R, finZ, gems = 0, mult = 1, endT = 0, camY = 4, podiumZ;
let pickMesh, gemMesh;
function buildLevel() {
  if (world) scene.remove(world);
  world = new THREE.Group(); scene.add(world);
  R = rng(level * 4231 + 9); const fk = F.k();
  const sky = SKIES[(level - 1) % SKIES.length];
  document.body.style.setProperty('--bg1', sky[0]); document.body.style.setProperty('--bg2', sky[1]); document.body.style.setProperty('--ui', sky[2]);
  items = []; walls = []; rails = []; steps = []; debris = []; gems = 0; mult = 1; endT = 0;
  let z = -10; const segs = [];
  const nSeg = Math.min(14, 6 + level);
  let heelBudget = 0;
  const pickRow = (zz, lane, n) => { for (let k = 0; k < n; k++) items.push({ kind: 'shoe', x: LANES[lane], z: zz - k * 1.6, got: false }); heelBudget += n; };
  const gemRow = (zz, lane, n) => { for (let k = 0; k < n; k++) items.push({ kind: 'gem', x: LANES[lane], z: zz - k * 1.2, got: false }); };
  if (level === 1) {   // first run: shoes in every lane, one low wall, one easy splits, then the podium (~10 s)
    for (const [l, n] of [[1, 5], [0, 3], [2, 3]]) pickRow(z, l, n);
    gemRow(z - 9, 0, 3); z -= 14;
    addWall(z, -TW / 2, TW / 2, 1); heelBudget -= 1; z -= 10;
    for (const [l, n] of [[1, 4], [0, 2], [2, 2]]) pickRow(z, l, n);
    gemRow(z - 9, 2, 3); z -= 14;
    const need = 2, gap = 2 * (0.98 + need * BH) - 0.25, len = 10;
    rails.push({ z0: z, z1: z - len, gap, need });
    for (let k = 0; k < 4; k++) items.push({ kind: 'gem', x: (k % 2 ? 1 : -1) * gap / 2, z: z - 2 - k * 2.4, got: false, rail: true });
    z -= len + 4;
  } else for (let i = 0; i < nSeg; i++) {
    const kind = i < 1 ? 'pick' : (i % 3 === 2 && heelBudget > 5) ? 'rail' : (i % 2 ? 'wall' : 'pick');
    if (kind === 'pick') {
      const lane = Math.floor(R() * 3); pickRow(z, lane, 4 + Math.floor(R() * 3));
      if (R() < 0.6) { const l2 = (lane + 1 + Math.floor(R() * 2)) % 3; pickRow(z - 2, l2, 2 + Math.floor(R() * 2)); }
      gemRow(z - 9, Math.floor(R() * 3), 3);
      z -= 14;
    } else if (kind === 'wall') {
      if (R() < 0.45) { const k = Math.max(1, Math.round((1 + Math.floor(R() * Math.min(4, 1 + level * 0.5))) * fk)); addWall(z, -TW / 2, TW / 2, k); heelBudget -= k; }
      else { const free = Math.floor(R() * 3); for (let l = 0; l < 3; l++) if (l !== free) addWall(z, LANES[l] - 0.85, LANES[l] + 0.85, Math.round((3 + Math.floor(R() * (3 + level))) * fk)); pickRow(z + 3, free, 2); }
      z -= 10;
    } else {
      const need = Math.min(heelBudget - 2, Math.round((2 + Math.floor(R() * (2 + level * 0.6))) * fk)), gap = 2 * (0.98 + need * BH) - 0.25, len = 10 + R() * 6;
      rails.push({ z0: z, z1: z - len, gap, need });
      for (let k = 0; k < 4; k++) items.push({ kind: 'gem', x: (k % 2 ? 1 : -1) * gap / 2, z: z - 2 - k * 2.4, got: false, rail: true });
      z -= len + 4;
    }
  }
  finZ = z; podiumZ = z - 4;
  // runway pieces (broken where rails span a gap)
  const runwayTex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#fff7fb'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#ffe4f1'; x.fillRect(54, 0, 20, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapT = THREE.RepeatWrapping; return t; })();
  const runway = (za, zb) => {
    const len = za - zb; if (len <= 0.1) return;
    const tx = runwayTex.clone(); tx.needsUpdate = true; tx.repeat.set(1, len / 5);
    const m = new THREE.Mesh(new THREE.BoxGeometry(TW, 0.5, len), mat('#ffffff', { map: tx })); m.position.set(0, -0.25, (za + zb) / 2); m.receiveShadow = true; world.add(m);
    for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.62, len), glossy(sky[2])); e.position.set(sx * (TW / 2 + 0.11), -0.2, m.position.z); world.add(e); }
    const base = new THREE.Mesh(new THREE.BoxGeometry(TW + 1.6, 30, len), mat('#d8ecff', { roughness: 0.8 })); base.position.set(0, -15.6, m.position.z); world.add(base);
  };
  let cur = 14; for (const r of rails) { runway(cur, r.z0); cur = r.z1; } runway(cur, podiumZ - 30);
  for (const r of rails) {
    for (const sx of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, r.z0 - r.z1 + 1, 12), glossy('#3a86ff')); rail.rotation.x = Math.PI / 2; rail.position.set(sx * r.gap / 2, -0.05, (r.z0 + r.z1) / 2); rail.castShadow = true; world.add(rail);
      for (let zz = r.z0; zz >= r.z1; zz -= 3) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 6, 6), mat('#ffffff')); p.position.set(sx * r.gap / 2, -3.1, zz); world.add(p); }
    }
    const warn = new THREE.Mesh(new THREE.PlaneGeometry(TW, 0.6), new THREE.MeshBasicMaterial({ color: '#ffd23f' })); warn.rotation.x = -Math.PI / 2; warn.position.set(0, 0.01, r.z0 + 0.6); world.add(warn);
  }
  // walls
  for (const w of walls) {
    const n = Math.max(1, Math.round((w.x1 - w.x0) / 0.58)), cw = (w.x1 - w.x0) / n;
    const im = new THREE.InstancedMesh(rounded(cw * 0.94, BH * 0.94, 0.6, 0.05), glossy('#ffffff'), n * w.k); const M4 = new THREE.Matrix4(); let k = 0;
    for (let yy = 0; yy < w.k; yy++) for (let xx = 0; xx < n; xx++) { im.setMatrixAt(k, M4.makeTranslation(w.x0 + cw * (xx + 0.5), BH * (yy + 0.5), w.z)); im.setColorAt(k++, new THREE.Color((xx + yy) % 2 ? '#ff4d4d' : '#ff6b5e')); }
    im.castShadow = true; im.receiveShadow = true; world.add(im); w.m = im;
  }
  // pickups
  const shoes = items.filter(i => i.kind === 'shoe'), gs = items.filter(i => i.kind === 'gem');
  pickMesh = new THREE.InstancedMesh(shoeGeo, vcMat({ roughness: 0.25 }), Math.max(1, shoes.length)); pickMesh.castShadow = true; world.add(pickMesh);
  gemMesh = new THREE.InstancedMesh(gemGeo, glossy('#29b6ff', { emissive: '#0a6fd0', emissiveIntensity: 0.4, flatShading: true }), Math.max(1, gs.length)); world.add(gemMesh);
  shoes.forEach((s, i) => s.i = i); gs.forEach((s, i) => s.i = i);
  // multiplier podium
  const COLS = ['#ff4d6d', '#ff8c42', '#ffd23f', '#9ef01a', '#3ab795', '#00c2ff', '#3a86ff', '#7b5cff', '#c77dff', '#ff5d8f'];
  for (let i = 0; i < 30; i++) {
    const y = (i + 1) * BH, sz = podiumZ - i * 0.9, m = 1 + i * 0.1;
    const c = document.createElement('canvas'); c.width = 256; c.height = 40; const x = c.getContext('2d'); x.fillStyle = COLS[i % 10]; x.fillRect(0, 0, 256, 40); x.fillStyle = '#fff'; x.font = '800 30px "Baloo 2", system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('x' + m.toFixed(1), 128, 22);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; const side = mat(COLS[i % 10]);
    const st = new THREE.Mesh(new THREE.BoxGeometry(TW, y, 0.9), [side, side, side, side, mat('#ffffff', { map: tx }), side]); st.position.set(0, y / 2, sz - 0.45); st.receiveShadow = true; st.castShadow = true; world.add(st);
    steps.push({ y, z: sz - 0.45, m, mesh: st });
  }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(TW / 2 + 0.3, 0.18, 10, 32, Math.PI), glossy(sky[2])); arch.position.set(0, 0, finZ + 1); world.add(arch);
  G = { x: 0, tx: 0, z: 0, n: 0, dn: 0, y: 0, vy: 0, ph: 0, rail: null, climb: -1, fall: 0, hop: 0 };
  ui.levels(level); ui.progress(0); hud();
}
function addWall(z, x0, x1, k) { walls.push({ z, x0, x1, k, done: false }); }
function hud() { $('heels').textContent = '👠 ' + G.n; $('gems').textContent = '💎 ' + (total + gems); }

// ---------------------------------------------------------------- input
let dragging = false, botX = null;
input({
  onDown() { if (state === 'play') { dragging = true; botX = null; } },
  onMove(dx) { if (state === 'play' && dragging) G.tx = clamp(G.tx + dx * 0.02, -TW / 2 + 0.45, TW / 2 - 0.45); },
  onUp() { dragging = false; },
  onTap(e) { if (state === 'play') { botX = null; G.tx = clamp(G.tx + (e.clientX < innerWidth / 2 ? -1.7 : 1.7), -TW / 2 + 0.45, TW / 2 - 0.45); } },   // tap a side = step one lane that way
});
ui.onTap(w => { WB.start();
  if (w === 'start') { state = 'play'; sfx.tap(); }
  else if (w === 'win') { level++; ST.set('level', level); buildLevel(); state = 'play'; }
  else { buildLevel(); state = 'play'; }
});

// ---------------------------------------------------------------- events
function shed(k, z, fx = 0) {      // k blocks fall off each heel
  for (let s = 0; s < 2; s++) for (let j = 0; j < k; j++) debris.push({ x: G.x + (s ? 0.13 : -0.13), y: BH * (j + 0.5), z: z + 0.3, vx: (s ? 0.03 : -0.03) + fx, vy: 0.05 + Math.random() * 0.05, vz: 0.05, r: 0, s: (Math.random() - 0.5) * 0.3, c: j % 2 });
}
function lose(t) { if (state !== 'play') return; state = 'lost'; F.level(false, clamp(G.z / podiumZ, 0, 1)); sfx.fail(); buzz([50, 30, 80]); ui.flash(0.4); ui.lose(t, `${gems} 💎 this run`); }
function win() {
  if (state !== 'play') return;
  state = 'won'; F.level(true); WB.submit(1); const pts = Math.round(gems * mult) + Math.round(mult * 10); total += pts; ST.set('gems', total); best = Math.max(best, mult); ST.set('best', best);
  sfx.win(); buzz([20, 40, 20]); ui.flash(0.6); ui.progress(1); hud();
  confetti(world, new THREE.Vector3(G.x, G.y + 3, G.z - 1), 120); setTimeout(() => confetti(world, new THREE.Vector3(G.x, G.y + 3, G.z - 1), 80), 300);
  ui.win(level, `x${mult.toFixed(1)} podium · +${pts} 💎`);
}

// ---------------------------------------------------------------- frame
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1), E = new THREE.Euler();
let pitchI = 0;
loop((dt, t) => {
  if (!G) return;
  const s = dt / 60, play = state === 'play';
  if (play && G.climb < 0 && !G.fall) {
    G.z -= SPEED * s;
    const rail = rails.find(r => G.z < r.z0 && G.z > r.z1);
    if (rail && !G.rail) {
      G.rail = rail; G.tx = 0;
      const reach = 0.98 + G.n * BH;
      if (reach * 2 < rail.gap - 0.2) { G.fall = 1; G.vy = 0; tone(600, 0.5, 'sine', 0.12, 0.3); buzz([60, 40, 60]); ui.pop('TOO SHORT!', '#ff3b4e', 38, 30); setTimeout(() => lose('FELL OFF!'), 700); }
      else { ui.pop('SPLITS!', '#fff', 40, 30); sfx.coin(); buzz(15); }
    }
    if (!rail && G.rail) { G.rail = null; ui.pop('NAILED IT!', '#fff', 32, 30); }
    if (!G.rail) { if (botX !== null && !dragging) G.tx = lerp(G.tx, botX, 0.3 * dt); G.x = lerp(G.x, G.tx, 0.2 * dt); }
    else G.x = lerp(G.x, 0, 0.2 * dt);
    // walls
    for (const w of walls) {
      if (w.done || G.z > w.z + 0.35) continue;
      w.done = true;
      if (G.x + 0.28 < w.x0 || G.x - 0.28 > w.x1) continue;
      if (G.n >= w.k) { G.n -= w.k; shed(w.k, w.z); G.hop = 1; sfx.smash(); buzz([20, 10, 20]); ui.pop('-' + w.k + ' 👠', '#ff3b4e', 34, 30); burst(world, new THREE.Vector3(G.x, w.k * BH, w.z), ['#ff4d4d', '#ffffff'], 12, { speed: 0.1, up: 0.08 }); hud(); }
      else { G.z = w.z + 0.45; shed(G.n, w.z); G.n = 0; hud(); sfx.smash(); ui.flash(0.4); return lose('BONK!'); }
    }
    // pickups
    for (const it of items) {
      if (it.got || Math.abs(it.z - G.z) > 0.6) continue;
      if (it.kind === 'shoe' && Math.abs(it.x - G.x) < 0.75) { it.got = true; G.n = Math.min(60, G.n + 1); note(64 + (pitchI++ % 12) * 1, 0.16, 0.12); buzz(6); burst(world, new THREE.Vector3(it.x, 0.6, it.z), ['#ff4fa3', '#ffffff'], 8, { speed: 0.08, up: 0.07, size: 0.6 }); ui.pop('+1 👠', '#ff2d8a', 30, 34); hud(); }
      else if (it.kind === 'gem' && (it.rail ? true : Math.abs(it.x - G.x) < 0.75)) { it.got = true; gems++; sfx.coin(); buzz(4); burst(world, new THREE.Vector3(it.x, 0.6, it.z), '#29b6ff', 6, { speed: 0.06, up: 0.06, size: 0.5 }); hud(); }
    }
    ui.progress(Math.min(0.92, G.z / podiumZ * 0.92));
    if (G.z < podiumZ + 0.6) { G.climb = 0; G.x = lerp(G.x, 0, 0.5); pitchI = 0; }
  } else if (play && G.climb >= 0) {
    // podium: every step eats one block from each heel
    const st = steps[G.climb];
    G.z = lerp(G.z, st.z, 0.2 * dt); G.x = lerp(G.x, 0, 0.1 * dt);
    if (Math.abs(G.z - st.z) < 0.1) {
      mult = st.m;
      if (G.n > 0 && G.climb < steps.length - 1) { G.n--; shed(1, st.z); G.climb++; note(60 + [0, 2, 4, 5, 7, 9, 11, 12][G.climb % 8] + Math.floor(G.climb / 8) * 12, 0.2, 0.13); buzz(8); ui.pop('x' + steps[G.climb].m.toFixed(1), '#fff', 38 + Math.min(20, G.climb), 30); hud(); }
      else return win();
    }
    ui.progress(0.92 + G.climb / steps.length * 0.08);
  }
  // falling off rails
  if (G.fall) { G.vy -= 0.012 * dt; G.y += G.vy * dt; girl.rotation.z += 0.05 * dt; }
  // heel stack spring
  G.dn = lerp(G.dn, G.n, 0.25 * dt);
  const base = G.climb >= 0 ? steps[G.climb].y : 0;
  const onRail = !!G.rail && !G.fall;
  G.hop = Math.max(0, G.hop - 0.05 * dt);
  const stackH = G.dn * BH;
  if (!G.fall) G.y = lerp(G.y, onRail ? 0.05 : base + stackH + Math.sin(G.hop * Math.PI) * 0.6, 0.3 * dt);
  // pose
  G.ph += s * (play ? 9 : 0);
  const sw = Math.sin(G.ph);
  girl.position.set(G.x, G.y, G.z);
  if (onRail || (G.fall && G.rail)) {
    girl.legL.rotation.set(0, 0, -1.5); girl.legR.rotation.set(0, 0, 1.5); girl.armL.rotation.set(0, 0, -1.2 + Math.sin(t * 6) * 0.15); girl.armR.rotation.set(0, 0, 1.2 - Math.sin(t * 6) * 0.15);
    girl.inner.position.y = lerp(girl.inner.position.y, -1.0, 0.3 * dt); girl.inner.rotation.z = Math.sin(t * 3) * 0.06;
  } else if (state === 'won') {
    endT += s; girl.legL.rotation.set(0, 0, 0); girl.legR.rotation.set(0, 0, 0); girl.armL.rotation.set(0, 0, -2.7 - Math.sin(endT * 9) * 0.25); girl.armR.rotation.set(0, 0, 2.7 + Math.sin(endT * 9) * 0.25); girl.inner.position.y = Math.abs(Math.sin(endT * 6)) * 0.12; girl.rotation.y = lerp(girl.rotation.y, Math.PI, 0.05 * dt);
  } else {
    const a = play ? 0.32 : 0.05;
    girl.legL.rotation.set(sw * a, 0, 0); girl.legR.rotation.set(-sw * a, 0, 0); girl.armL.rotation.set(-sw * 0.5 * a * 2, 0, -0.15); girl.armR.rotation.set(sw * 0.5 * a * 2, 0, 0.15);
    girl.inner.position.y = lerp(girl.inner.position.y, 0, 0.3 * dt); girl.inner.rotation.z = Math.sin(G.ph) * 0.06 * (play ? 1 : 0); girl.inner.rotation.y = Math.sin(G.ph) * 0.12 * (play ? 1 : 0);
    girl.pony.rotation.z = Math.sin(G.ph) * 0.3;
  }
  // heel stack instances
  let k = 0; const nn = Math.round(G.dn);
  for (const sgn of [-1, 1]) {
    const leg = sgn < 0 ? girl.legL : girl.legR, a = leg.rotation.x;
    for (let j = 0; j < nn && k < 120; j++) {
      if (onRail || (G.fall && G.rail)) M4.compose(V.set(G.x + sgn * (1.0 + (j + 0.5) * BH), G.y + 0.04, G.z), Q.setFromEuler(E.set(0, 0, Math.PI / 2)), S.set(1, 1, 1));
      else M4.compose(V.set(G.x + sgn * 0.12 + Math.sin(girl.inner.rotation.y) * 0, G.y - (j + 0.5) * BH, G.z - Math.sin(a) * 0.95), Q.identity(), S.set(1, 1, 1));
      heels.setMatrixAt(k++, M4);
    }
  }
  for (const d of debris) { d.vy -= 0.008 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt * 0.3; d.r += d.s * dt; if (d.y < BH / 2 && Math.abs(d.x) < TW / 2 && !rails.some(r => d.z < r.z0 && d.z > r.z1)) { d.y = BH / 2; d.vy = Math.abs(d.vy) * 0.25; d.vx *= 0.7; } if (k < 140) { M4.compose(V.set(d.x, d.y, d.z), Q.setFromEuler(E.set(d.r, 0, d.r * 0.6)), S.set(1, 1, 1)); heels.setMatrixAt(k++, M4); } }
  if (debris.length > 40) debris.splice(0, debris.length - 40);
  heels.count = k; heels.instanceMatrix.needsUpdate = true;
  // pickups spin
  for (const it of items) {
    const sc = it.got ? 0 : 1, mesh = it.kind === 'shoe' ? pickMesh : gemMesh;
    M4.compose(V.set(it.x, (it.kind === 'gem' ? 0.7 : 0.15) + Math.sin(t * 3 + it.z) * 0.08 + (it.rail ? 0.3 : 0), it.z), Q.setFromEuler(E.set(0, t * 2.2 + it.z, 0)), S.setScalar(sc * (it.kind === 'shoe' ? 1.15 : 1)));
    mesh.setMatrixAt(it.i, M4);
  }
  pickMesh.instanceMatrix.needsUpdate = true; gemMesh.instanceMatrix.needsUpdate = true;
  // camera: behind + above, rising with the heel stack
  const top = G.y + 2;
  camY = lerp(camY, Math.max(top, 2.6) + 2.6, 0.06 * dt);
  const back = 6.5 + Math.max(0, G.y) * 0.45 + (state === 'won' ? 1.5 : 0);
  camera.position.set(G.x * 0.4 + (state === 'won' ? Math.sin(endT * 0.6) * 4 : 0), camY, G.z + back);
  camera.lookAt(G.x * 0.4, Math.max(G.y * 0.55, 0) + 0.8, G.z - 5);
  followLight(V.set(G.x, G.y, G.z - 2));
  scenery.position.z = G.z * 0.6;
});

buildLevel();

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return total + gems; },
  bot() {
    if (state !== 'play' || G.rail || G.climb >= 0) return;
    let bx = G.x, bs = -1e9;
    for (let x = -TW / 2 + 0.5; x <= TW / 2 - 0.5; x += 0.25) {
      let sc = -Math.abs(x - G.x) * 0.25;
      for (const it of items) if (!it.got && !it.rail && it.z < G.z && it.z > G.z - 16 && Math.abs(it.x - x) < 0.6) sc += it.kind === 'shoe' ? 4 : 1;
      let n = G.n;
      for (const w of walls) { if (w.done || w.z > G.z || w.z < G.z - 14) continue; if (x + 0.35 > w.x0 && x - 0.35 < w.x1) { if (n < w.k) sc -= 200; else { sc -= w.k * 3; n -= w.k; } } }
      if (sc > bs) { bs = sc; bx = x; }
    }
    botX = bx;
  },
};
