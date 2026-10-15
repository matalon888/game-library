// Stormchase — original endless turn runner. A kid in a yellow raincoat sprints along a winding causeway floating above
// a sea of pink clouds, swiping to turn at every corner, jumping logs and gaps, sliding under chime-arches and leaning past
// boulders — while Grumble, a grumpy thundercloud, rumbles right behind. All code, art and sound are original.
import { THREE, createStage, createUI, store, loop, input, buzz, burst, confetti, lerp, clamp, rng, mat, glossy, rounded, stickman } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board as worldBoard } from './kit/board.js';
import * as A from './sound.js';

const NAME = 'Stormchase: Endless Turn Runner';
const W = 1.6, TIER = 400, GRAV = 27, JUMPV = 9.4, SLIDE_T = 0.68, LEAN = 1.05;
const S = store('stormchase');
let best = S.get('best', 0);
const F = flow('stormchase', { par: 700, warmup: 200 });

const stage = createStage({ fov: 58, shadows: true, shadowSize: 18 });
const { scene, camera } = stage;
stage.sun.shadow.mapSize.set(1536, 1536); stage.hemi.intensity = 1.1; stage.sun.intensity = 1.7;
const ui = createUI({ title: 'STORM<br>CHASE', hint: 'Tap left/right to turn · top to jump · bottom to slide · or swipe', hand: '👆' });
const D = daily('stormchase', ui, { name: NAME });
ui.els.win.querySelector('p').innerHTML = 'NEW BEST<span data-l hidden></span>';
const winH = ui.els.win.querySelector('h1');

const SKIES = [
  ['#ff9ec4', '#ffe1c9', '#ffd9d2'], ['#7fd6ff', '#e9f7ff', '#dff1fb'], ['#ffb36b', '#fff0c4', '#ffe5c0'],
  ['#a58bff', '#ffd3f0', '#f0d4f4'], ['#5fe0c9', '#f2ffe8', '#e3f8e8'],
];
scene.fog = new THREE.Fog('#ffd9d2', 40, 150);

// ---------------------------------------------------------------- helpers
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
function pool(geo, material, cap, { cast = true, receive = false, colored = false } = {}) {
  const m = new THREE.InstancedMesh(geo, material, cap); m.frustumCulled = false; m.castShadow = cast; m.receiveShadow = receive; m.count = 0;
  if (colored) for (let i = 0; i < cap; i++) m.setColorAt(i, _c.set('#ffffff'));
  scene.add(m); m.n = 0;
  m.begin = () => { m.n = 0; };
  m.put = (x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, color = null, rx = 0, rz = 0) => {
    if (m.n >= cap) return; _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')); _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
    m.setMatrixAt(m.n, _m); if (color) m.setColorAt(m.n, _c.set(color)); m.n++;
  };
  m.end = () => { m.count = m.n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; };
  return m;
}
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const FWD = { 0: [0, -1], 1: [1, 0], 3: [-1, 0] }, YAW = { 0: 0, 1: -Math.PI / 2, 3: Math.PI / 2 };
const RIGHT = (d) => { const f = FWD[d]; return [-f[1], f[0]]; };

// ---------------------------------------------------------------- meshes
const tiles = pool(new THREE.BoxGeometry(1, 0.55, 1.02), mat('#ffffff', { roughness: 0.75 }), 1100, { colored: true, receive: true, cast: false });
const curbs = pool(new THREE.BoxGeometry(0.26, 0.3, 1.02), mat('#ffffff', { roughness: 0.5 }), 1400, { colored: true, receive: true });
const keels = pool(new THREE.ConeGeometry(1.5, 3.4, 5).rotateX(Math.PI), mat('#ffffff', { flatShading: true, roughness: 0.9 }), 160, { colored: true, cast: false });
const posts = pool(new THREE.CylinderGeometry(0.09, 0.11, 1.3, 8), mat('#8a5a3a'), 120);
const orbs = pool(new THREE.SphereGeometry(0.2, 14, 10), new THREE.MeshStandardMaterial({ color: '#fff3b0', emissive: '#ffcf4d', emissiveIntensity: 1 }), 60, { cast: false, colored: true });
const logs = pool(new THREE.CylinderGeometry(0.36, 0.36, 3.3, 14).rotateZ(Math.PI / 2), mat('#a0663f', { roughness: 0.8 }), 30);
const logRings = pool(new THREE.CylinderGeometry(0.33, 0.33, 0.04, 14).rotateZ(Math.PI / 2), mat('#e9c08a'), 60, { cast: false });
const moss = pool(new THREE.SphereGeometry(0.2, 8, 6), mat('#6cc77a'), 120, { cast: false });
const archPost = pool(new THREE.BoxGeometry(0.34, 2.5, 0.34), mat('#ffffff', { roughness: 0.5 }), 60, { colored: true });
const archBeam = pool(rounded(3.9, 0.5, 0.5, 0.12), mat('#ffffff', { roughness: 0.4 }), 30, { colored: true });
const chimes = pool(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 6), glossy('#fff2a8', { metalness: 0.6 }), 240, { cast: false });
const flags = pool(new THREE.ConeGeometry(0.2, 0.42, 3).rotateX(Math.PI), mat('#ffffff'), 240, { cast: false, colored: true });
const boulders = pool(new THREE.DodecahedronGeometry(0.95, 1), mat('#b9a9d6', { flatShading: true, roughness: 0.8 }), 30);
const crystals = pool(new THREE.OctahedronGeometry(0.32, 0).scale(1, 1.8, 1), new THREE.MeshStandardMaterial({ color: '#7ff0ff', emissive: '#3fd0ff', emissiveIntensity: 0.5, flatShading: true, roughness: 0.2 }), 60, { cast: false });
const gems = pool(new THREE.OctahedronGeometry(0.27, 0).scale(1, 1.25, 1), new THREE.MeshStandardMaterial({ color: '#ffd23f', emissive: '#ff9f1c', emissiveIntensity: 0.45, metalness: 0.3, roughness: 0.25, flatShading: true }), 260, { cast: false });
const clouds = pool(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: false }), 700, { cast: false, colored: true });
const isleTop = pool(new THREE.CylinderGeometry(1, 0.9, 0.6, 9), mat('#7ed47f', { flatShading: true }), 30, { cast: false, colored: true });
const isleRock = pool(new THREE.ConeGeometry(1, 1.6, 9).rotateX(Math.PI), mat('#c7a7e8', { flatShading: true }), 30, { cast: false, colored: true });
const trees = pool(new THREE.ConeGeometry(0.6, 1.6, 7), mat('#4fbf74', { flatShading: true }), 90, { cast: false, colored: true });
const balloons = pool(new THREE.SphereGeometry(1, 16, 12).scale(1, 1.15, 1), glossy('#ffffff'), 12, { cast: false, colored: true });
const baskets = pool(new THREE.BoxGeometry(0.6, 0.5, 0.6), mat('#a0663f'), 12, { cast: false });
const streaks = pool(new THREE.BoxGeometry(0.03, 0.03, 3), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false }), 30, { cast: false });
const rain = pool(new THREE.BoxGeometry(0.03, 0.6, 0.03), new THREE.MeshBasicMaterial({ color: '#8aa6ff', transparent: true, opacity: 0.7 }), 60, { cast: false });

// ---------------------------------------------------------------- hero: kid in a yellow raincoat with a red scarf
const hero = new THREE.Group(); scene.add(hero);
const pivot = new THREE.Group(); pivot.position.y = 0.9; hero.add(pivot);
const man = stickman('#ffd23f', '#f2c09a', 1.0); man.position.y = -0.9; pivot.add(man);
const boots = mat('#ff4f5e'); for (const l of [man.legL, man.legR]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), boots); b.position.y = -0.52; b.scale.set(1, 0.8, 1.4); b.castShadow = true; l.add(b); }
const hood = new THREE.Mesh(new THREE.SphereGeometry(0.235, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), glossy('#ffc41a')); hood.position.set(0, 1.52, 0.03); hood.rotation.x = 0.35; hood.castShadow = true;
const pack = new THREE.Mesh(rounded(0.4, 0.44, 0.22, 0.08), mat('#2ec4b6')); pack.position.set(0, 1.0, 0.24); pack.castShadow = true;
const brolly = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8), mat('#7b5cff')); brolly.position.set(-0.14, 1.15, 0.36); brolly.rotation.z = -0.25;
const scarfPiv = new THREE.Group(); scarfPiv.position.set(0, 1.32, 0.1);
const scarf = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 0.6), mat('#ff4f5e')); scarf.position.z = 0.3; scarfPiv.add(scarf);
man.add(hood, pack, brolly, scarfPiv);
for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mat('#2b2140')); e.position.set(sx * 0.075, 1.53, -0.185); man.add(e); }
const cheek = mat('#ff9bb3'); for (const sx of [-1, 1]) { const c = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), cheek); c.position.set(sx * 0.12, 1.46, -0.16); c.scale.set(1.3, 0.8, 0.6); man.add(c); }
const blob = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.18, depthWrite: false }));
scene.add(blob);

// ---------------------------------------------------------------- chaser: Grumble the thundercloud
const grumble = new THREE.Group(); scene.add(grumble);
const gMat = mat('#6b5f8f', { roughness: 0.9 }), gMat2 = mat('#857aa8', { roughness: 0.9 });
[[0, 0, 0, 1.25], [-1.1, -0.2, 0.2, 0.95], [1.1, -0.15, 0.1, 1.0], [-0.5, 0.75, 0.1, 0.85], [0.6, 0.7, 0.2, 0.8], [-1.9, -0.45, 0.4, 0.6], [1.95, -0.4, 0.4, 0.65], [0, -0.55, -0.2, 0.9]]
  .forEach(([x, y, z, r], i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), i % 2 ? gMat2 : gMat); m.position.set(x, y, z); m.castShadow = true; grumble.add(m); });
for (const sx of [-1, 1]) {
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), new THREE.MeshBasicMaterial({ color: '#fff7c2' })); eye.position.set(sx * 0.45, 0.05, -1.08); eye.scale.z = 0.5;
  const pup = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: '#2b2140' })); pup.position.set(sx * 0.42, 0.0, -1.22);
  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.12), mat('#3e3360')); brow.position.set(sx * 0.45, 0.38, -1.15); brow.rotation.z = sx * 0.5;
  grumble.add(eye, pup, brow);
}
const boltMat = new THREE.MeshBasicMaterial({ color: '#fff36b' });
const bolt = new THREE.Group(); grumble.add(bolt);
{ let y = -0.8, x = 0; for (let i = 0; i < 4; i++) { const nx = x + (i % 2 ? 0.35 : -0.35), ny = y - 0.55; const len = Math.hypot(nx - x, ny - y); const seg = new THREE.Mesh(new THREE.BoxGeometry(0.12, len, 0.12), boltMat); seg.position.set((x + nx) / 2, (y + ny) / 2, -0.3); seg.rotation.z = Math.atan2(nx - x, -(ny - y)) * -1; bolt.add(seg); x = nx; y = ny; } }

// ---------------------------------------------------------------- path (segments of straight causeway joined by 90° corners)
let R, segs = [], cur = 0, s = 0, x = 0, leanT = 0, py = 0, vy = 0, onGround = true, slideT = 0, jumpBuf = 0, turnBuf = null, turnBufT = 0;
const B = worldBoard({ game: 'stormchase', label: 'Points', limits: { maxRun: 20000, maxPerSec: 70 } });   // world board: best run today
let state = 'ready', dist = 0, score = 0, gemCount = 0, speed = 11, tier = 1, sky = 0, stumbleT = 0, chaseGap = 4, runT = 0, deadT = 0, deadHow = '', recorded = false, beatenShown = false;
let off = new THREE.Vector3(), camYaw = 0, camRoll = 0, shake = 0, fovKick = 0, landSq = 0, comboT = 0, combo = 0, lastM = 0, hist = [], gripT = 0;
const camPos = new THREE.Vector3(0, 5, 8);

function newSeg(start, dir, first) {
  const L = first ? 46 : Math.round(30 + R() * 36);
  const turn = dir === 0 ? (R() < 0.5 ? 'left' : 'right') : dir === 1 ? 'left' : 'right';
  const sg = { sx: start[0], sz: start[1], dir, L, turn, floor: new Array(L + 3).fill(0), obs: [], gems: [], first };
  // obstacles between s = 9 (or 22 on the very first stretch) and L - 11
  let at = first ? 24 : 9 + R() * 4;
  const hard = clamp(totalGen / 2500, 0, 1);
  while (at < L - 11) {
    const r = R(); let o;
    if (r < 0.22) o = { s: at, type: 'log' };
    else if (r < 0.42) o = { s: at, type: 'arch' };
    else if (r < 0.6) o = { s: at, type: 'rock', side: R() < 0.5 ? -1 : 1 };
    else if (r < 0.78) { const len = 2.6 + R() * (0.6 + hard * 0.8); o = { s: at, type: 'gap', len }; for (let k = Math.floor(at); k < Math.ceil(at + len); k++) sg.floor[k] = 3; }
    else { const len = 6 + Math.floor(R() * 6), keep = R() < 0.5 ? -1 : 1; o = { s: at, type: 'narrow', len, side: keep }; for (let k = Math.floor(at); k < at + len; k++) sg.floor[k] = keep < 0 ? 1 : 2; }
    sg.obs.push(o);
    // nuggets of sunlight: arcs over jumps, lines past the rest
    if (o.type === 'log' || o.type === 'gap') for (let i = 0; i < 5; i++) { const f = i / 4; sg.gems.push({ s: o.s - 2.2 + f * (4.4 + (o.len || 0)), x: 0, y: 0.7 + Math.sin(f * Math.PI) * 1.4 }); }
    else if (o.type === 'rock') for (let i = 0; i < 5; i++) sg.gems.push({ s: o.s - 4 + i * 2, x: -o.side * LEAN, y: 0.7 });
    else if (o.type === 'narrow') for (let i = 0; i < Math.floor(o.len / 2); i++) sg.gems.push({ s: o.s + 0.5 + i * 2, x: o.side * LEAN, y: 0.7 });
    const end = o.s + (o.len || 1);
    const gap = (clamp(16 - hard * 5, 10.5, 16) + R() * 6) / F.k(score);
    // a free gem line in the gap before the next obstacle
    if (gap > 12 && R() < 0.7) { const lx = [-LEAN, 0, LEAN][Math.floor(R() * 3)]; for (let i = 0; i < 5; i++) sg.gems.push({ s: end + 3 + i * 1.8, x: lx, y: 0.7 }); }
    at = end + gap;
  }
  totalGen += L;
  return sg;
}
let totalGen = 0;
function nextDir(sg) { return sg.dir === 0 ? (sg.turn === 'left' ? 3 : 1) : 0; }
function cornerOf(sg) { const f = FWD[sg.dir]; return [sg.sx + f[0] * sg.L, sg.sz + f[1] * sg.L]; }
function extend() { while (segs.length < cur + 6) { const last = segs[segs.length - 1]; segs.push(newSeg(cornerOf(last), nextDir(last), false)); } }
function worldOf(sg, ss, xx, out) { const f = FWD[sg.dir], r = RIGHT(sg.dir); return out.set(sg.sx + f[0] * ss + r[0] * xx, 0, sg.sz + f[1] * ss + r[1] * xx); }
// floor under (s, x) of the current segment: true if there is ground
function floorAt(sg, ss, xx) {
  if (Math.abs(xx) > W + 0.15) return false;
  if (ss > sg.L + W + 0.1) return false;
  if (ss >= sg.L - W) return true;                       // corner square
  if (ss < W) return true;                               // previous corner square / start pad
  const t = sg.floor[Math.floor(ss)] || 0;
  if (t === 0) return true; if (t === 3) return false;
  return t === 1 ? xx < 0.15 : xx > -0.15;              // narrow: 1 keeps the left half, 2 the right half
}

// ---------------------------------------------------------------- lifecycle
function reset() {
  R = rng((D.seed || (Date.now() % 1e6)) + 29); totalGen = 0;
  segs = [newSeg([0, 0], 0, true)]; cur = 0; extend();
  s = 2; x = 0; leanT = 0; py = 0; vy = 0; onGround = true; slideT = 0; jumpBuf = 0; turnBuf = null; dist = 0; score = 0; gemCount = 0; tier = 1; sky = 0;
  stumbleT = 0; chaseGap = 3.6; runT = 0; deadT = 0; recorded = false; beatenShown = false; off.set(0, 0, 0); camYaw = 0; camRoll = 0; shake = 0; lastM = 0; hist = []; combo = 0;
  speed = 11 * F.k(0); setSky(0);
  man.rotation.set(0, 0, 0); pivot.rotation.set(0, 0, 0); pivot.position.y = 0.9;
  ui.score(0); ui.levels(1); ui.progress(0); ui.sub(best ? 'BEST ' + best : ''); ui.pill('☀️ 0');
}
function setSky(i) {
  const k = SKIES[i % SKIES.length], b = document.body.style;
  b.setProperty('--bg1', k[0]); b.setProperty('--bg2', k[1]); b.setProperty('--ui', '#ff5d8f'); scene.fog.color.set(k[2]);
}
function addScore(n) {
  score += n; ui.score(score);
  if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 44, 30); confetti(scene, hero.position.clone().setY(py + 2.5), 60); A.osc(880, 0.3, 'triangle', 0.12, 1.5); }
}
function gameOver(how, kind) {
  if (state !== 'play') return;
  state = 'lost'; deadT = 0; deadHow = kind; A.stopMusic(0.3);
  if (!recorded) { recorded = true; F.endless(score); B.submit(score); }
  const prev = best; best = Math.max(best, score); S.set('best', best);
  shake = kind === 'fall' ? 0.3 : 1; ui.flash(kind === 'caught' ? 0.9 : 0.6); buzz([40, 30, 90]);
  if (kind === 'fall') { A.hiss(1.1, 2500, 300, 0.2); A.osc(600, 0.9, 'triangle', 0.1, 0.25); }
  else { A.osc(120, 0.35, 'square', 0.15, 0.4); A.hiss(0.5, 1500, 200, 0.28, 'lowpass'); thunder(); }
  if (kind !== 'fall') { vy = 5; burst(scene, hero.position.clone().setY(py + 1), ['#ffd23f', '#ffffff', '#ff4f5e'], 22, { speed: 0.15, up: 0.14, size: 0.8 }); }
  if (score > prev && score >= 50) {
    D.won(score, 'ran'); winH.textContent = String(score);
    ui.win(tier, `${how} · ☀️ ${gemCount}`);
  } else ui.lose(String(score), `${how} · BEST ${best} · ☀️ ${gemCount}`);
  setTimeout(() => (state === 'lost') && ui.els.sc.classList.add('hc-hidden'), 650);
}
function thunder() { A.hiss(1.4, 400, 60, 0.4, 'lowpass'); A.osc(55, 1.0, 'sine', 0.25, 0.6); setTimeout(() => A.hiss(0.8, 300, 80, 0.25, 'lowpass'), 180); }
function stumble() {
  shake = Math.max(shake, 0.6); buzz([25, 20, 25]); ui.flash(0.35); thunder();
  if (stumbleT > 0) { gameOver('Grumble caught you!', 'caught'); return; }
  stumbleT = 6.5; ui.pop('YIKES!', '#ff4f5e', 38, 30); gripT = 0.5;
}

// ---------------------------------------------------------------- input: swipe up/down = jump/slide, left/right = turn at a corner (else lean); drag = lean
function nearCorner() { const sg = segs[cur], rem = sg.L - s; return rem < 7.5 && rem > -W - 0.1; }
function doTurn(dirName) {
  const sg = segs[cur];
  if (sg.turn !== dirName) { leanT = clamp(leanT + (dirName === 'left' ? -1 : 1) * LEAN, -LEAN, LEAN); return false; }   // wrong way: just lean
  const before = worldOf(sg, s, x, new THREE.Vector3()), C = cornerOf(sg), nx = segs[cur + 1];
  const f = FWD[nx.dir], r = RIGHT(nx.dir), dx = before.x - C[0], dz = before.z - C[1];
  const rem = sg.L - s;
  cur++; s = Math.max(dx * f[0] + dz * f[1], -0.5); x = clamp(dx * r[0] + dz * r[1], -0.9, 0.9); leanT = 0;
  off.add(before.sub(worldOf(nx, s, x, new THREE.Vector3())));
  camRoll = (dirName === 'left' ? 1 : -1) * 0.12; fovKick = Math.max(fovKick, 0.5);
  A.hiss(0.25, 700, 3200, 0.12); buzz(8);
  if (rem < 3.2) { ui.pop('PERFECT TURN!', '#fff36b', 30, 34); addScore(10); A.osc(784, 0.12, 'triangle', 0.08); A.osc(1175, 0.18, 'triangle', 0.07, 1, A.ac().currentTime + 0.07); }
  else A.osc(520, 0.08, 'triangle', 0.08, 1.3);
  extend();
  return true;
}
function act(d) {
  if (state !== 'play') return;
  if (d === 'left' || d === 'right') {
    if (nearCorner()) doTurn(d);
    else { turnBuf = d; turnBufT = 0.32; leanT = clamp(leanT + (d === 'left' ? -1 : 1) * LEAN, -LEAN, LEAN); A.hiss(0.12, 900, 2000, 0.05); }
  } else if (d === 'up') {
    if (onGround) { jumpBuf = 0; vy = JUMPV; onGround = false; slideT = 0; A.osc(350, 0.16, 'triangle', 0.13, 2); A.hiss(0.15, 1200, 3500, 0.05); buzz(8); }
    else jumpBuf = 0.18;
  } else if (d === 'down') {
    if (!onGround) vy = Math.min(vy, -18);
    slideT = SLIDE_T; A.hiss(0.3, 3000, 500, 0.1); buzz(6);
  }
}
input({ onMove: (dx, dy, e, st) => {
  if (state !== 'play') return;
  const tx = e.clientX - st.x, ty = e.clientY - st.y;
  if (!st.fired && Math.hypot(tx, ty) > 26) {
    st.fired = true;
    if (Math.abs(ty) > Math.abs(tx)) act(ty > 0 ? 'down' : 'up');
    else { st.horiz = true; if (nearCorner()) doTurn(tx > 0 ? 'right' : 'left'); else { turnBuf = tx > 0 ? 'right' : 'left'; turnBufT = 0.32; } }
  }
  if (!st.fired || st.horiz) leanT = clamp(leanT + dx * 0.018, -LEAN, LEAN);    // drag to lean
}, onTap: (e) => {   // tap: top = jump, bottom = slide, otherwise left / right half = turn that way
  const y = e.clientY / innerHeight; act(y < 0.38 ? 'up' : y > 0.8 ? 'down' : e.clientX < innerWidth / 2 ? 'left' : 'right');
} });
addEventListener('keydown', e => { const k = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down', ' ': 'up' }[e.key]; if (k) { e.preventDefault(); act(k); } });
// tilt to lean where the browser gives orientation without a prompt
addEventListener('deviceorientation', e => { if (state === 'play' && e.gamma != null && Math.abs(e.gamma) > 6) leanT = clamp(lerp(leanT, (e.gamma / 25) * LEAN, 0.2), -LEAN, LEAN); });
ui.onTap(() => { B.start(); reset(); state = 'play'; A.ac(); startSong(); ui.els.sc.classList.remove('hc-hidden'); });

// original loop: bright F-major sky run (four-on-the-floor + bass + bell arpeggio)
const BASS = [41, 41, 53, 41, 38, 38, 50, 38, 46, 46, 58, 46, 48, 48, 60, 43];
const ARP = [77, 81, 84, 81, 74, 77, 81, 77, 70, 74, 77, 74, 72, 76, 79, 84];
function startSong() {
  A.startMusic({ bpm: 140, steps: 32, play(st, t, a) {
    if (st % 2 === 0) a.kick(t, 0.26); if (st % 4 === 2) a.snare(t, 0.06); a.hat(t, st % 2 ? 0.045 : 0.02);
    a.note(BASS[st >> 1], 0.2, 'triangle', 0.2, t);
    if (st % 2 === 1 || st >= 24) a.note(ARP[(st >> 1) % 16] + (st >= 16 ? 0 : 0), 0.22, 'sine', 0.05, t);
  } });
}

// ---------------------------------------------------------------- per-frame
function update(sec) {
  runT += sec;
  const fk = F.k(score);
  speed = Math.min(23, (11 + Math.min(dist / 140, 10)) * fk);
  if (stumbleT > 0) stumbleT -= sec;
  if (gripT > 0) gripT -= sec;
  const step = speed * sec * (gripT > 0 ? 0.6 : 1);
  s += step; dist += step;
  let sg = segs[cur];
  if (turnBufT > 0) { turnBufT -= sec; if (nearCorner() && turnBuf === sg.turn) { turnBufT = 0; doTurn(turnBuf); sg = segs[cur]; } }
  x = lerp(x, leanT, Math.min(1, sec * 9));
  // vertical + floor
  vy -= GRAV * sec * (vy < 0 ? 1.15 : 1); py += vy * sec;
  const ground = floorAt(sg, s, x);
  if (py <= 0 && ground) { if (!onGround && vy < -5) { landSq = 1; A.osc(110, 0.1, 'sine', 0.18, 0.6); } py = 0; vy = 0; onGround = true; }
  else { onGround = false; if (!ground && py < -0.35) { gameOver(s > sg.L ? 'Missed the turn' : 'Fell into the clouds', 'fall'); return; } }
  if (slideT > 0) slideT -= sec;
  if (jumpBuf > 0) { jumpBuf -= sec; if (onGround) act('up'); }
  // obstacles
  const top = py + (slideT > 0 ? 0.75 : 1.7);
  for (const o of sg.obs) {
    if (o.hit) continue;
    const d = s - o.s;
    if (o.type === 'log' && d > -0.35 && d < 0.35 && py < 0.72) { o.hit = true; gameOver('Tripped over a log', 'crash'); return; }
    if (o.type === 'arch' && d > -0.25 && d < 0.25 && top > 1.1 && py < 2.4) { o.hit = true; gameOver('Bonked a chime arch', 'crash'); return; }
    if (o.type === 'rock' && d > -0.6 && d < 0.6 && x * o.side > -0.25 && py < 1.4) { o.hit = true; leanT = -o.side * LEAN; x = -o.side * 0.5; stumble(); if (state !== 'play') return; }
  }
  // gems
  for (const g of sg.gems) {
    if (g.got) continue;
    if (Math.abs(g.s - s) < 0.8 && Math.abs(g.x - x) < 0.75 && g.y > py - 0.2 && g.y < py + 2) {
      g.got = true; g.t = 0; gemCount++; combo = comboT > 0 ? combo + 1 : 0; comboT = 0.5; addScore(5); ui.pill('☀️ ' + gemCount);
      const k = Math.pow(2, Math.min(combo, 12) / 12); A.osc(1046 * k, 0.07, 'sine', 0.07); A.osc(1568 * k, 0.12, 'triangle', 0.05, 1, A.ac().currentTime + 0.04);
      if (combo && combo % 10 === 0) ui.pop(`x${combo}!`, '#ffd23f', 30, 36);
    }
  }
  comboT -= sec;
  const m = Math.floor(dist); if (m > lastM) { addScore(m - lastM); lastM = m; }
  const nt = Math.floor(dist / TIER) + 1;
  if (nt > tier) { tier = nt; ui.levels(tier); sky++; setSky(sky); ui.pop(`${(tier - 1) * TIER} m!`, '#fff', 44, 28); confetti(scene, hero.position.clone().setY(3), 50); [0, 4, 7, 12].forEach((k, i) => setTimeout(() => A.osc(587 * Math.pow(2, k / 12), 0.2, 'triangle', 0.1), i * 90)); }
  ui.progress((dist % TIER) / TIER);
  chaseGap = lerp(chaseGap, stumbleT > 0 ? 3.4 : runT < 2.8 ? 3.8 : 15, Math.min(1, sec * (stumbleT > 0 ? 3 : 0.5)));
  if (Math.random() < sec * 0.25 && chaseGap < 6) thunder();
}

// ---------------------------------------------------------------- render
const tmpV = new THREE.Vector3(), tmpW = new THREE.Vector3();
const TILE_A = '#fff4e2', TILE_B = '#ffe7c7', CURB = ['#ff9ec4', '#b69cff'];
function draw(t, sec) {
  const sg = segs[cur];
  worldOf(sg, s, x, tmpV); off.multiplyScalar(Math.exp(-sec * 11));
  const hx = tmpV.x + off.x, hz = tmpV.z + off.z;
  // history for the chaser (world position by distance)
  if (state === 'play' || state === 'ready') { hist.push([dist, hx, hz]); if (hist.length > 400) hist.shift(); }
  // hero
  let hy = py;
  if (state === 'lost' && deadHow === 'fall') { deadT += sec; vy -= GRAV * 0.6 * sec; py += vy * sec; s += speed * 0.45 * sec * Math.max(0, 1 - deadT); hy = py; pivot.rotation.x += sec * 4; man.armL.rotation.x = man.armR.rotation.x = -2.8 + Math.sin(t * 18) * 0.5; }
  else if (state === 'lost') { deadT += sec; if (py > 0 || vy > 0) { vy -= GRAV * sec; py = Math.max(0, py + vy * sec); } hy = py; pivot.rotation.x = lerp(pivot.rotation.x, 1.4, Math.min(1, sec * 8)); man.run(0, 0); }
  hero.position.set(hx, hy, hz);
  const yaw = YAW[sg.dir];
  hero.rotation.y = lerpAngle(hero.rotation.y, yaw, Math.min(1, sec * 16));
  hero.rotation.z = (leanT - x) * -0.25;
  landSq = Math.max(0, landSq - sec * 5);
  if (state !== 'lost') {
    if (slideT > 0) { pivot.rotation.x = -1.15; pivot.position.y = 0.45; man.armL.rotation.x = man.armR.rotation.x = -2.6; man.legL.rotation.x = man.legR.rotation.x = 0.2; }
    else if (!onGround && state === 'play') { pivot.rotation.x = -0.15; pivot.position.y = 0.9; man.armL.rotation.x = -2.5; man.armR.rotation.x = 1.0; man.legL.rotation.x = -1.1; man.legR.rotation.x = 0.5; }
    else { pivot.rotation.x = state === 'play' ? 0.12 : 0; pivot.position.y = 0.9; pivot.scale.set(1 + landSq * 0.15, 1 - landSq * 0.2, 1 + landSq * 0.15); man.run(state === 'play' ? t * speed / 10 : t * 0.2, state === 'play' ? 1 : 0.1); }
  }
  scarfPiv.rotation.x = -0.15 + Math.sin(t * 20) * 0.2 - (state === 'play' ? 0.15 : 0); scarfPiv.rotation.y = Math.sin(t * 12) * 0.3;
  blob.position.set(hx, 0.02, hz); blob.visible = floorAt(sg, s, x) && hy > -0.2; blob.scale.setScalar(clamp(1 - hy * 0.15, 0.4, 1));
  // chaser: ride the history trail chaseGap metres back
  const want = (state === 'lost' && deadHow !== 'fall') ? lerp(chaseGap, 1.6, Math.min(1, deadT * 2)) : chaseGap;
  const gd = dist - want; let gp = hist[0] || [0, hx, hz + 4];
  for (let i = hist.length - 1; i >= 0; i--) if (hist[i][0] <= gd) { gp = hist[i]; break; }
  const back = hist.length && hist[0][0] > gd;
  const gx = back ? hx - FWD[sg.dir][0] * want : gp[1], gz = back ? hz - FWD[sg.dir][1] * want : gp[2];
  grumble.position.set(lerp(grumble.position.x, gx, Math.min(1, sec * 6)), (state === 'ready' ? 2.1 : 1.35) + Math.sin(t * 3) * 0.2, lerp(grumble.position.z, gz, Math.min(1, sec * 6)));
  grumble.rotation.y = lerpAngle(grumble.rotation.y, yaw, Math.min(1, sec * 5));
  grumble.scale.setScalar((state === 'ready' ? 1 : 0.8) * (1 + Math.sin(t * 5) * 0.04));
  bolt.visible = Math.sin(t * 23) > 0.6 && chaseGap < 7; bolt.position.x = Math.sin(t * 3.7) * 0.8;
  grumble.visible = want < 13;
  rain.begin();
  if (grumble.visible) for (let i = 0; i < 40; i++) { const a = hash(i) * 6.28, rr = hash(i + 9) * 1.8, ph = (t * 6 + hash(i + 3) * 3) % 3; rain.put(grumble.position.x + Math.cos(a) * rr, grumble.position.y - 0.9 - ph, grumble.position.z + Math.sin(a) * rr); }
  rain.end();
  // path tiles around the player
  for (const p of [tiles, curbs, keels, posts, orbs, logs, logRings, moss, archPost, archBeam, chimes, flags, boulders, crystals, gems]) p.begin();
  for (let i = Math.max(0, cur - 1); i < Math.min(segs.length, cur + 5); i++) drawSeg(segs[i], i, t);
  for (const p of [tiles, curbs, keels, posts, orbs, logs, logRings, moss, archPost, archBeam, chimes, flags, boulders, crystals, gems]) p.end();
  // sky dressing: cloud sea, floating isles, balloons (deterministic world grid, drawn near the player)
  clouds.begin(); isleTop.begin(); isleRock.begin(); trees.begin(); balloons.begin(); baskets.begin();
  const G = 13, gx0 = Math.floor(hx / G), gz0 = Math.floor(hz / G);
  for (let i = -8; i <= 8; i++) for (let j = -9; j <= 5; j++) {
    const cx = gx0 + i, cz = gz0 + j, h = hash(cx * 31.7 + cz * 7.3);
    const wx = cx * G + hash(cx + cz * 3) * G, wz = cz * G + hash(cz + cx * 5) * G, sc = 3 + h * 4;
    clouds.put(wx, -7 - h * 3, wz, 0, sc * 1.4, sc * 0.55, sc, h > 0.5 ? '#ffffff' : '#ffeef6');
    if (h > 0.55) clouds.put(wx + 2.5, -6.2 - h * 2, wz + 1.5, 0, sc, sc * 0.5, sc * 0.8, '#ffffff');
  }
  const I = 46, ix0 = Math.floor(hx / I), iz0 = Math.floor(hz / I);
  for (let i = -3; i <= 3; i++) for (let j = -4; j <= 1; j++) {
    const cx = ix0 + i, cz = iz0 + j, h = hash(cx * 13.1 + cz * 71.7); if (h < 0.35) continue;
    let wx = cx * I + I / 2, wz = cz * I + I / 2;
    const wy = -1 + hash(cx + cz * 9) * 14, r = 3 + h * 4;
    // keep isles away from the causeway corridor around the player
    if (nearPath(wx, wz, r + 5)) continue;
    isleTop.put(wx, wy, wz, h * 6, r, 1, r, h > 0.7 ? '#8fdc8a' : '#7ed47f');
    isleRock.put(wx, wy - r * 0.8 - 0.3, wz, h * 6, r * 0.95, r, r * 0.95, h > 0.6 ? '#c7a7e8' : '#e6b0c9');
    for (let k = 0; k < 3; k++) trees.put(wx + (hash(k + h * 9) - 0.5) * r, wy + 0.3 + 0.8 * (0.7 + hash(k * 2 + h) * 0.6), wz + (hash(k * 3 + h * 7) - 0.5) * r, 0, 0.7 + hash(k + h) * 0.6, 0.7 + hash(k + h) * 0.6, 0.7 + hash(k + h) * 0.6, k % 2 ? '#4fbf74' : '#2fa866');
    if (h > 0.85) { const bx = wx + 8, by = wy + 10 + Math.sin(t * 0.8 + h * 9) * 0.6; balloons.put(bx, by, wz, 0, 1.4, 1.4, 1.4, ['#ff5d8f', '#ffd23f', '#3ab795', '#7b5cff'][Math.floor(h * 40) % 4]); baskets.put(bx, by - 2.1, wz); }
  }
  clouds.end(); isleTop.end(); isleRock.end(); trees.end(); balloons.end(); baskets.end();
  // speed streaks
  streaks.begin();
  const sp = state === 'play' ? speed : 0, show = clamp((sp - 13) / 8, 0, 1) + fovKick * 0.6, f = FWD[sg.dir], r = RIGHT(sg.dir);
  if (show > 0.02) for (let i = 0; i < 24; i++) {
    const a = hash(i) * 6.28, rr = 2.4 + hash(i + 50) * 3.2, ph = (t * sp * 0.9 + hash(i + 80) * 36) % 36;
    const along = -26 + ph, lat = Math.cos(a) * rr * 1.3;
    streaks.put(hx + f[0] * along + r[0] * lat, py + 2.6 + Math.sin(a) * rr * 0.8, hz + f[1] * along + r[1] * lat, yaw, 1, 1, 0.5 + show);
  }
  streaks.end(); streaks.material.opacity = 0.35 * Math.min(1, show);
  // camera: chase cam swinging around corners
  camYaw = lerpAngle(camYaw, yaw, Math.min(1, sec * 7));
  camRoll = lerp(camRoll, 0, Math.min(1, sec * 4));
  fovKick = Math.max(0, fovKick - sec * 1.5); shake = Math.max(0, shake - sec * 2.2);
  const cf = [-Math.sin(camYaw), -Math.cos(camYaw)];
  const fallCam = state === 'lost' && deadHow === 'fall';
  const intro = state === 'ready' ? 1 : 0;
  const dBack = 7.2, hUp = 4.6;
  let tx = hx - cf[0] * dBack, tz = hz - cf[1] * dBack, ty = (fallCam ? 1.5 : Math.max(0, hy) * 0.6) + hUp;
  if (intro) { const a = 0.45 + Math.sin(t * 0.4) * 0.12; tx = hx + 6.2 * Math.sin(a) ; tz = hz - 6.2 * Math.cos(a); ty = 2.4; }
  camPos.x = lerp(camPos.x, tx, Math.min(1, sec * 12)); camPos.z = lerp(camPos.z, tz, Math.min(1, sec * 12)); camPos.y = lerp(camPos.y, ty, Math.min(1, sec * 6));
  camera.position.set(camPos.x + (Math.random() - 0.5) * shake * 0.5, camPos.y + (Math.random() - 0.5) * shake * 0.5, camPos.z);
  camera.up.set(Math.cos(camYaw) * camRoll, 1, -Math.sin(camYaw) * camRoll).normalize();
  if (intro) camera.lookAt(hx, 1.9, hz + 1.2);
  else if (fallCam) camera.lookAt(hx, Math.max(hy, -9), hz);
  else camera.lookAt(hx + cf[0] * 8, (fallCam ? Math.max(hy, -6) * 0.5 : Math.max(0, hy) * 0.4) + 0.4, hz + cf[1] * 8);
  const fovT = (camera.aspect < 0.7 ? 66 : 58) + (state === 'play' ? (speed - 11) * 0.5 : 0) + fovKick * 6;
  camera.fov = lerp(camera.fov, fovT, Math.min(1, sec * 4)); camera.updateProjectionMatrix();
  stage.followLight(tmpW.set(hx + cf[0] * 7, 0, hz + cf[1] * 7));
}
function nearPath(px, pz, rad) {
  for (let i = Math.max(0, cur - 1); i < Math.min(segs.length, cur + 6); i++) {
    const sg = segs[i], C = cornerOf(sg), x0 = Math.min(sg.sx, C[0]) - rad, x1 = Math.max(sg.sx, C[0]) + rad, z0 = Math.min(sg.sz, C[1]) - rad, z1 = Math.max(sg.sz, C[1]) + rad;
    if (px > x0 && px < x1 && pz > z0 && pz < z1) return true;
  }
  return false;
}
function lerpAngle(a, b, k) { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * k; }

function drawSeg(sg, idx, t) {
  const yaw = YAW[sg.dir], startS = sg.first ? -4 : W, endS = sg.L + W;
  const shade = (k) => (k & 1 ? TILE_A : TILE_B);
  for (let k = Math.floor(startS); k < endS; k++) {
    const sMid = k + 0.5;
    const tp = sMid >= sg.L - W ? 0 : (sMid < W ? 0 : (sg.floor[k] || 0));
    if (tp === 3) continue;
    if (tp === 0) {
      worldOf(sg, sMid, 0, tmpW); tiles.put(tmpW.x, -0.275, tmpW.z, yaw, W * 2, 1, 1, shade(k));
      if (sMid < sg.L - W) for (const sd of [-1, 1]) { worldOf(sg, sMid, sd * (W + 0.1), tmpW); curbs.put(tmpW.x, 0.0, tmpW.z, yaw, 1, 1, 1, CURB[(k >> 1) & 1]); }
    } else {
      const sd = tp === 1 ? -1 : 1; worldOf(sg, sMid, sd * W / 2, tmpW); tiles.put(tmpW.x, -0.275, tmpW.z, yaw, W, 1, 1, '#ffd9a8');
      worldOf(sg, sMid, sd * (W + 0.1), tmpW); curbs.put(tmpW.x, 0.0, tmpW.z, yaw, 1, 1, 1, CURB[(k >> 1) & 1]);
      worldOf(sg, sMid, -sd * 0.05, tmpW); curbs.put(tmpW.x, 0.0, tmpW.z, yaw, 1, 1, 1, '#ff8fb1');
    }
    if (k % 5 === 0 && tp === 0) { worldOf(sg, sMid, 0, tmpW); { const ky = 0.8 + hash(k + idx) * 0.6; keels.put(tmpW.x, -0.55 - 1.7 * ky, tmpW.z, yaw + k, 1, ky, 1, (k / 5) & 1 ? '#c9a8f0' : '#f0b6d2'); } }
    if (k % 12 === 6 && sMid < sg.L - W - 2 && tp === 0) for (const sd of [-1, 1]) { worldOf(sg, sMid, sd * (W + 0.1), tmpW); posts.put(tmpW.x, 0.65, tmpW.z); orbs.put(tmpW.x, 1.4, tmpW.z, 0, 1, 1, 1, '#fff3b0'); }
  }
  // corner square: outer curbs + corner lamps
  const C = cornerOf(sg), f = FWD[sg.dir], r = RIGHT(sg.dir), turnR = sg.turn === 'right' ? 1 : -1;
  for (let j = -1; j <= 1; j++) {   // far edge curb
    const wx = C[0] + f[0] * (W + 0.1) + r[0] * j * 1.05, wz = C[1] + f[1] * (W + 0.1) + r[1] * j * 1.05;
    curbs.put(wx, 0, wz, yaw + Math.PI / 2, 1, 1, 1.05, CURB[0]);
    const ox = C[0] - r[0] * turnR * (W + 0.1) + f[0] * j * 1.05, oz = C[1] - r[1] * turnR * (W + 0.1) + f[1] * j * 1.05;   // the side you can't turn to
    curbs.put(ox, 0, oz, yaw, 1, 1, 1.05, CURB[1]);
  }
  for (const [a, b] of [[1, 1], [1, -1]]) { const wx = C[0] + f[0] * a * (W + 0.1) + r[0] * b * (W + 0.1), wz = C[1] + f[1] * a * (W + 0.1) + r[1] * b * (W + 0.1); posts.put(wx, 0.65, wz); orbs.put(wx, 1.4 + Math.sin(t * 4) * 0.05, wz, 0, 1.3, 1.3, 1.3, '#ffe066'); }
  keels.put(C[0], -0.55 - 1.7 * 1.1, C[1], 0, 1.4, 1.1, 1.4, '#c9a8f0');
  // obstacles
  for (const o of sg.obs) {
    worldOf(sg, o.s, 0, tmpW);
    if (o.type === 'log') { logs.put(tmpW.x, 0.36, tmpW.z, yaw); for (const sd of [-1, 1]) { worldOf(sg, o.s, sd * 1.66, tmpW); logRings.put(tmpW.x, 0.36, tmpW.z, yaw); } for (let i = 0; i < 4; i++) { worldOf(sg, o.s, -1.2 + i * 0.8, tmpW); moss.put(tmpW.x, 0.68, tmpW.z, 0, 1.2, 0.6, 1.2); } }
    else if (o.type === 'arch') {
      for (const sd of [-1, 1]) { worldOf(sg, o.s, sd * (W + 0.15), tmpW); archPost.put(tmpW.x, 1.25, tmpW.z, yaw, 1, 1, 1, '#3ab795'); }
      worldOf(sg, o.s, 0, tmpW); archBeam.put(tmpW.x, 1.6, tmpW.z, yaw, 1, 1, 1, '#2ec4b6');
      for (let i = 0; i < 6; i++) { worldOf(sg, o.s, -1.25 + i * 0.5, tmpW); const sw = Math.sin(t * 6 + i) * 0.25; chimes.put(tmpW.x, 1.12, tmpW.z, yaw, 1, 1, 1, null, sw); flags.put(tmpW.x, 1.25, tmpW.z + 0.0, yaw, 1, 1, 1, ['#ff5d8f', '#ffd23f', '#7b5cff'][i % 3], sw * 0.6); }
    }
    else if (o.type === 'rock') { worldOf(sg, o.s, o.side * 0.85, tmpW); boulders.put(tmpW.x, 0.75, tmpW.z, o.s, 1.05, 0.95, 1.05); crystals.put(tmpW.x, 1.75, tmpW.z, t + o.s); }
  }
  for (const g of sg.gems) {
    worldOf(sg, g.s, g.x, tmpW);
    if (g.got) { g.t = (g.t || 0) + 0.05; if (g.t < 1) gems.put(lerp(tmpW.x, hero.position.x, g.t), g.y + g.t * 1.6, lerp(tmpW.z, hero.position.z, g.t), t * 10, 1 - g.t, 1 - g.t, 1 - g.t); continue; }
    gems.put(tmpW.x, g.y + Math.sin(t * 4 + g.s) * 0.08, tmpW.z, t * 3 + g.s);
  }
}

loop((dt, t) => {
  const sec = dt / 60;
  if (state === 'play') update(sec);
  draw(t, sec);
  if (state === 'play' && cur > 2) { segs.splice(0, cur - 1); cur = 1; }
});

reset(); state = 'ready'; ui.els.sc.classList.add('hc-hidden'); ui.pill(''); ui.start();
if (D.isDaily) ui.sub('DAILY RUN');

// ---------------------------------------------------------------- test hook + bot
window.__game = {
  get state() { return state; }, get level() { return tier; }, get score() { return score; }, get why() { return deadHow; },
  bot() {
    if (state !== 'play') return;
    const sg = segs[cur], rem = sg.L - s;
    if (rem < 3.6 && rem > -1.2) { act(sg.turn); return; }
    const ahead = sg.obs.filter(o => o.s + (o.len || 0.5) > s - 0.2).sort((a, b) => a.s - b.s);
    let leaned = false;
    for (const o of ahead) {
      const tt = (o.s - s) / speed;
      if (tt > 1.7) break;
      if ((o.type === 'log' || o.type === 'gap') && tt < 0.32 && tt > -0.05) { if (onGround) act('up'); return; }
      if (o.type === 'arch' && tt < 0.32 && tt > -0.05) { if (slideT < 0.3) act('down'); return; }
      if ((o.type === 'rock' || o.type === 'narrow') && !leaned) { leanT = (o.type === 'rock' ? -o.side : o.side) * LEAN; leaned = true; }
    }
    if (leaned) return;
    // drift toward sun-drops
    const g = sg.gems.find(q => !q.got && q.s > s + 1 && q.s < s + speed * 1.2 && q.y < 1.2);
    leanT = g ? g.x : leanT * 0.9;
  },
};
