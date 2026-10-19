// Stormdrop Isle — original battle royale on a toy island: 25 robots, foam blasters, a shrinking storm. All art built in code.
import { THREE, createStage, createUI, loop, rounded, tone, note, sfx, buzz, store, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { part, merge, vmat, canvasTex, G, hudCSS, H, btn, banner, feed, vignette, controls, Pool, healthBars, floaters, minimap, shaker, music, robot } from './lib.js';

const NAME = 'Stormdrop Isle: Battle Royale Island Shooter';
const TAU = Math.PI * 2, N = 25, R = 0.6, WORLD = 120;
const S = createStage({ fov: 50, shadowSize: 30 });
const { scene, camera, sun, hemi, renderer } = S;
sun.intensity = 1.85; hemi.intensity = 1.1;
scene.add(camera);
hudCSS('#ffcf3a');
document.body.style.setProperty('--bg1', '#5cc8f0'); document.body.style.setProperty('--bg2', '#bff0ff');
const ui = createUI({ title: 'STORMDROP<br>ISLE', hint: 'Tap to board the sky barge', hand: '🪂', progress: false, score: false });
const D = daily('stormdrop', ui, { name: NAME });
const F = flow('stormdrop', { par: 320 });
const B = board({ game: 'stormdrop-isle', label: 'Match score', limits: { maxRun: 4000, maxPerSec: 25 }, corner: 'tl' });
const save = store('stormdrop');
const P = { xp: save.get('xp', 0), matches: save.get('matches', 0), wins: save.get('wins', 0), best: save.get('best', 0), bestPlace: save.get('bestPlace', 25), elims: save.get('elims', 0), perk: save.get('perk', 0) };
const saveP = () => { for (const k in P) save.set(k, P[k]); };
const rankOf = xp => { let r = 1; while (xp >= 300 * r * (r + 1) / 2) r++; return r; };
const rankXp = r => 300 * (r - 1) * r / 2;

// ---------------------------------------------------------------- loot tables
const RAR = [{ n: 'Common', c: '#c9ced8', m: 1 }, { n: 'Rare', c: '#4da3ff', m: 1.12 }, { n: 'Epic', c: '#b26bff', m: 1.25 }, { n: 'Legend', c: '#ffb703', m: 1.4 }];
const GUNS = [
  { name: 'Pea Popper', rate: 4, dmg: 14, spread: 0.03, speed: 55, range: 26, mag: 12, reload: 1.1, pellets: 1, col: '#ffe066' },
  { name: 'Foam SMG', rate: 11, dmg: 8, spread: 0.07, speed: 55, range: 22, mag: 30, reload: 1.4, pellets: 1, col: '#9ff3ff' },
  { name: 'Splat Shotgun', rate: 1.2, dmg: 11, spread: 0.12, speed: 48, range: 12, mag: 5, reload: 1.8, pellets: 8, col: '#ffb3d9' },
  { name: 'Burst Rifle', rate: 7, dmg: 12, spread: 0.028, speed: 65, range: 34, mag: 25, reload: 1.6, pellets: 1, col: '#b6ff8a' },
  { name: 'Paint Lance', rate: 0.8, dmg: 72, spread: 0.004, speed: 130, range: 60, mag: 4, reload: 2.1, pellets: 1, col: '#c7a6ff' },
];
const PERKS = [
  { name: 'Spare Kit', rank: 1, txt: 'start with a repair kit' },
  { name: 'Shield Start', rank: 2, txt: 'land with 30 shield' },
  { name: 'Swift Glide', rank: 3, txt: 'glide 35% faster' },
  { name: 'Lucky Loot', rank: 5, txt: 'better chest rarity' },
];
const TOWN_NAMES = ['Pepper Port', 'Sprocket Farm', 'Gumdrop Hills', 'Rivet Row', 'Lantern Bay', 'Fizz Factory', 'Old Mill', 'Pinwheel Park', 'Kettle Cove'];

// ---------------------------------------------------------------- island
let seed = 1, rand = Math.random, phi = [0, 0, 0];
const isleR = a => 84 + 9 * Math.sin(3 * a + phi[0]) + 6 * Math.sin(5 * a + phi[1]) + 3 * Math.sin(9 * a + phi[2]);
const onIsle = (x, z, m = 0) => Math.hypot(x, z) < isleR(Math.atan2(z, x)) - m;
let world = null, obs = [], grid = new Map(), towns = [], items = [], itemMeshes = null, stamp = 0;
const CELL = 10, key = (i, j) => i * 1000 + j;
function addObs(o) {
  obs.push(o);
  const x0 = o.box ? o.x0 : o.x - o.r, x1 = o.box ? o.x1 : o.x + o.r, z0 = o.box ? o.z0 : o.z - o.r, z1 = o.box ? o.z1 : o.z + o.r;
  for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) { const k = key(i, j); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(o); }
}
function near(x0, z0, x1, z1, fn) {   // visit obstacles in the cells overlapping a rectangle (each once)
  stamp++;
  for (let i = Math.floor(Math.min(x0, x1) / CELL); i <= Math.floor(Math.max(x0, x1) / CELL); i++) for (let j = Math.floor(Math.min(z0, z1) / CELL); j <= Math.floor(Math.max(z0, z1) / CELL); j++) {
    const l = grid.get(key(i, j)); if (!l) continue;
    for (const o of l) { if (o.st === stamp) continue; o.st = stamp; if (fn(o) === true) return true; }
  }
  return false;
}
function segBox(ax, az, bx, bz, b, pad = 0) {
  let t0 = 0, t1 = 1; const dx = bx - ax, dz = bz - az;
  for (const [p, d, lo, hi] of [[ax, dx, b.x0 - pad, b.x1 + pad], [az, dz, b.z0 - pad, b.z1 + pad]]) {
    if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) return -1; continue; }
    let u0 = (lo - p) / d, u1 = (hi - p) / d; if (u0 > u1) [u0, u1] = [u1, u0];
    t0 = Math.max(t0, u0); t1 = Math.min(t1, u1); if (t0 > t1) return -1;
  }
  return t0;
}
function segCirc(ax, az, bx, bz, o) {
  const dx = bx - ax, dz = bz - az, fx = ax - o.x, fz = az - o.z, a = dx * dx + dz * dz, b = 2 * (fx * dx + fz * dz), c = fx * fx + fz * fz - o.r * o.r;
  const disc = b * b - 4 * a * c; if (disc < 0 || a < 1e-9) return c < 0 ? 0 : -1;
  const t = (-b - Math.sqrt(disc)) / (2 * a); return t >= 0 && t <= 1 ? t : c < 0 ? 0 : -1;
}
const segHit = (ax, az, bx, bz, o) => o.box ? segBox(ax, az, bx, bz, o) : o.block ? segCirc(ax, az, bx, bz, o) : -1;
function los(a, b) { return !near(a.x, a.z, b.x, b.z, o => segHit(a.x, a.z, b.x, b.z, o) >= 0); }
function blocked(x, z, r = R) {
  if (!onIsle(x, z, r + 0.5)) return true;
  return near(x - r, z - r, x + r, z + r, o => o.box ? (x > o.x0 - r && x < o.x1 + r && z > o.z0 - r && z < o.z1 + r) : Math.hypot(x - o.x, z - o.z) < o.r + r);
}
function collide(p, r = R) {
  const a = Math.atan2(p.z, p.x), lim = isleR(a) - 1.2, d = Math.hypot(p.x, p.z); if (d > lim) { p.x *= lim / d; p.z *= lim / d; }
  near(p.x - r, p.z - r, p.x + r, p.z + r, o => {
    if (o.box) {
      const cx = clamp(p.x, o.x0, o.x1), cz = clamp(p.z, o.z0, o.z1), dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) { if (d2 > 1e-8) { const dd = Math.sqrt(d2), k = (r - dd) / dd; p.x += dx * k; p.z += dz * k; } else { const m = [[o.x0 - r - p.x, 0], [o.x1 + r - p.x, 0], [0, o.z0 - r - p.z], [0, o.z1 + r - p.z]].sort((u, v) => Math.abs(u[0] + u[1]) - Math.abs(v[0] + v[1]))[0]; p.x += m[0]; p.z += m[1]; } }
    } else { const dx = p.x - o.x, dz = p.z - o.z, dd = Math.hypot(dx, dz), m = o.r + r; if (dd < m && dd > 1e-6) { p.x += dx / dd * (m - dd); p.z += dz / dd * (m - dd); } }
  });
}
const shade = (c, a) => { const k = new THREE.Color(c); return a > 0 ? '#' + k.lerp(new THREE.Color('#ffffff'), a).getHexString() : '#' + k.multiplyScalar(1 + a).getHexString(); };

function buildIsland() {
  if (world) scene.remove(world);
  world = new THREE.Group(); scene.add(world); obs = []; grid = new Map(); towns = []; items = [];
  rand = rng(seed); phi = [rand() * TAU, rand() * TAU, rand() * TAU];
  // towns
  const names = [...TOWN_NAMES].sort(() => rand() - 0.5);
  for (let k = 0; k < 7; k++) {
    for (let tries = 0; tries < 40; tries++) {
      const a = rand() * TAU, d = k === 0 ? rand() * 12 : 24 + rand() * 42, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (!onIsle(x, z, 14) || towns.some(t => Math.hypot(t.x - x, t.z - z) < 30)) continue;
      towns.push({ x, z, name: names[k], r: 11 + rand() * 4 }); break;
    }
  }
  const P = [], PAL = ['#ff7b7b', '#ffd166', '#7bdff2', '#b8a1ff', '#9be15d', '#ffa36c', '#f78fb3'];
  const house = (x, z, w, d, h) => {
    const col = PAL[Math.floor(rand() * PAL.length)], roof = ['#e85d5d', '#5d7be8', '#3a9e6a', '#8c5be8', '#e8a35d'][Math.floor(rand() * 5)];
    P.push(part(rounded(w, h, d, 0.12), col, { x, y: h / 2, z }));
    const rf = new THREE.ConeGeometry(Math.hypot(w, d) / 2 + 0.3, 2.2, 4); P.push(part(rf, roof, { x, y: h + 1.1, z, ry: Math.PI / 4, sx: w / Math.max(w, d), sz: d / Math.max(w, d) }));
    P.push(part(G.box, '#7a4a2a', { x, y: 0.9, z: z + d / 2 + 0.02, sx: 1, sy: 1.8, sz: 0.08 }));
    for (const s of [-1, 1]) P.push(part(G.box, '#bff0ff', { x: x + s * w / 4, y: h * 0.62, z: z + d / 2 + 0.02, sx: 0.9, sy: 0.8, sz: 0.06 }));
    P.push(part(G.box, '#ffffff', { x: x + w * 0.3, y: h + 1.4, z, sx: 0.5, sy: 1.4, sz: 0.5 }));
    addObs({ box: true, x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, h });
  };
  for (const t of towns) {
    const n = 4 + Math.floor(rand() * 4);
    for (let k = 0; k < n; k++) {
      const a = k / n * TAU + rand() * 0.4, d = t.r * (0.55 + rand() * 0.3), w = 4 + rand() * 3, dd = 4 + rand() * 2.5, x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
      if (!onIsle(x, z, 6) || blocked(x, z, Math.max(w, dd) * 0.75)) continue;
      house(x, z, w, dd, 2.8 + rand() * 1.2);
      // loot around each house (front and side), the best stuff in chests
      for (let q = 0; q < 2; q++) addItem(x + (rand() - 0.5) * (w + 3), z + dd / 2 + 1.4 + rand() * 1.5);
      if (rand() < 0.55) addItem(x - w / 2 - 1.3, z, 'chest');
    }
    for (let k = 0; k < 4; k++) { const a = rand() * TAU, x = t.x + Math.cos(a) * 3.5, z = t.z + Math.sin(a) * 3.5; if (!blocked(x, z, 1.5)) { P.push(part(rounded(1.6, 1.4, 1.6, 0.08), '#c98e52', { x, y: 0.7, z, ry: 0 })); addObs({ box: true, x0: x - 0.8, x1: x + 0.8, z0: z - 0.8, z1: z + 0.8, h: 1.4 }); } }
    addItem(t.x, t.z, 'chest');
  }
  // lone sheds and watchtowers out in the fields
  for (let k = 0; k < 12; k++) { const a = rand() * TAU, d = 15 + rand() * 60, x = Math.cos(a) * d, z = Math.sin(a) * d; if (!onIsle(x, z, 8) || blocked(x, z, 5) || towns.some(t => Math.hypot(t.x - x, t.z - z) < t.r + 6)) continue; house(x, z, 3.5, 3.5, 2.6); addItem(x, z + 3, 'chest'); addItem(x + 2.6, z); }
  // rocks (block), trees (trunks block movement only), bushes (decor)
  const rocks = [], trees = [], bushes = [], tufts = [];
  for (let k = 0; k < 500 && trees.length < 230; k++) { const a = rand() * TAU, d = Math.sqrt(rand()) * 88, x = Math.cos(a) * d, z = Math.sin(a) * d; if (!onIsle(x, z, 5) || towns.some(t => Math.hypot(t.x - x, t.z - z) < t.r + 2) || blocked(x, z, 1.4)) continue; const s = 0.8 + rand() * 0.6; trees.push([x, z, s, rand() * TAU]); addObs({ x, z, r: 0.45 * s }); }
  for (let k = 0; k < 200 && rocks.length < 55; k++) { const a = rand() * TAU, d = Math.sqrt(rand()) * 86, x = Math.cos(a) * d, z = Math.sin(a) * d; if (!onIsle(x, z, 3) || towns.some(t => Math.hypot(t.x - x, t.z - z) < t.r) || blocked(x, z, 2.2)) continue; const s = 1 + rand() * 1.3; rocks.push([x, z, s, rand() * TAU]); addObs({ x, z, r: s * 0.95, block: true }); }
  for (let k = 0; k < 160; k++) { const a = rand() * TAU, d = Math.sqrt(rand()) * 86, x = Math.cos(a) * d, z = Math.sin(a) * d; if (onIsle(x, z, 3) && !blocked(x, z, 1)) bushes.push([x, z, 0.7 + rand() * 0.6, rand() * TAU]); }
  for (let k = 0; k < 700; k++) { const a = rand() * TAU, d = Math.sqrt(rand()) * 88, x = Math.cos(a) * d, z = Math.sin(a) * d; if (onIsle(x, z, 4)) tufts.push([x, z, 0.6 + rand() * 0.7, rand() * TAU]); }
  for (let k = 0; k < 70; k++) { const a = rand() * TAU, d = Math.sqrt(rand()) * 84, x = Math.cos(a) * d, z = Math.sin(a) * d; if (onIsle(x, z, 3) && !blocked(x, z, 1)) addItem(x, z); }
  const inst = (geo, list, shadow = true) => {
    const m = new THREE.InstancedMesh(geo, vmat({ roughness: 0.75 }), list.length), d = new THREE.Object3D();
    list.forEach(([x, z, s, r], i) => { d.position.set(x, 0, z); d.rotation.set(0, r, 0); d.scale.setScalar(s); d.updateMatrix(); m.setMatrixAt(i, d.matrix); });
    m.castShadow = shadow; m.receiveShadow = true; world.add(m); return m;
  };
  inst(merge([part(G.cyl, '#8a5a32', { y: 1, sx: 0.28, sz: 0.28, sy: 2 }), part(G.ico, '#3fae5a', { y: 2.9, s: 1.5 }), part(G.ico, '#58c26b', { y: 3.9, x: 0.2, s: 1.05 }), part(G.ico, '#4cb35f', { y: 2.6, x: -0.8, z: 0.4, s: 0.85 })]), trees);
  inst(merge([part(G.dod, '#b9b4c4', { y: 0.55, sx: 1.2, sy: 0.9, sz: 1 }), part(G.dod, '#a7a2b5', { y: 0.3, x: 0.7, z: 0.3, s: 0.6 })]), rocks);
  inst(merge([part(G.ico, '#4fbf6a', { y: 0.45, s: 0.7 }), part(G.ico, '#66d17e', { y: 0.55, x: 0.5, s: 0.5 }), part(G.sph, '#ff6b9a', { y: 0.95, x: 0.1, s: 0.12 })]), bushes, false);
  inst(merge([part(G.cone, '#5fbf5f', { y: 0.25, s: 0.12, sy: 0.5, x: 0 }), part(G.cone, '#6ccf6a', { y: 0.2, s: 0.1, sy: 0.4, x: 0.15, rz: -0.3 }), part(G.cone, '#57b058', { y: 0.2, s: 0.1, sy: 0.4, x: -0.15, rz: 0.3 })]), tufts, false);
  const hm = new THREE.Mesh(merge(P), vmat({ roughness: 0.6 })); hm.castShadow = true; hm.receiveShadow = true; world.add(hm);
  // ground: one painted canvas for the whole island
  const tex = canvasTex(2048, 2048, (g, W) => {
    const s = W / (WORLD * 2), X = v => (v + WORLD) * s;
    g.fillStyle = '#3fb6e8'; g.fillRect(0, 0, W, W);
    const shape = (m) => { g.beginPath(); for (let k = 0; k <= 240; k++) { const a = k / 240 * TAU, r = isleR(a) + m; g.lineTo(X(Math.cos(a) * r), X(Math.sin(a) * r)); } g.closePath(); };
    g.fillStyle = '#7fd3f0'; shape(9); g.fill(); g.fillStyle = '#a8e6f7'; shape(4); g.fill();
    g.fillStyle = '#f6e2a8'; shape(1); g.fill(); g.fillStyle = '#86cf6a'; shape(-4); g.fill();
    const r2 = rng(seed + 9);
    for (let k = 0; k < 90; k++) { const a = r2() * TAU, d = r2() * 80; g.fillStyle = r2() < 0.5 ? '#79c45e' : '#93d877'; g.beginPath(); g.ellipse(X(Math.cos(a) * d), X(Math.sin(a) * d), (4 + r2() * 10) * s, (3 + r2() * 7) * s, r2() * 3, 0, TAU); g.fill(); }
    g.strokeStyle = '#e9d39a'; g.lineWidth = 2.6 * s; g.lineCap = 'round';
    for (let k = 0; k < towns.length; k++) { const a = towns[k], b = towns[(k + 1) % towns.length]; g.beginPath(); g.moveTo(X(a.x), X(a.z)); g.quadraticCurveTo(X((a.x + b.x) / 2 + 8), X((a.z + b.z) / 2 - 8), X(b.x), X(b.z)); g.stroke(); }
    for (const t of towns) { g.fillStyle = '#e9d39a'; g.beginPath(); g.arc(X(t.x), X(t.z), t.r * 0.9 * s, 0, TAU); g.fill(); g.fillStyle = '#ddc386'; g.beginPath(); g.arc(X(t.x), X(t.z), 4 * s, 0, TAU); g.fill(); }
    for (let k = 0; k < 9000; k++) { const x = r2() * W, y = r2() * W; g.fillStyle = r2() < 0.5 ? 'rgba(0,0,0,.035)' : 'rgba(255,255,255,.07)'; g.fillRect(x, y, 2 + r2() * 3, 2 + r2() * 3); }
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD * 2, WORLD * 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; world.add(ground);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshStandardMaterial({ color: '#3fb6e8', roughness: 0.25, metalness: 0.05 })); sea.rotation.x = -Math.PI / 2; sea.position.y = -0.05; world.add(sea);
  scene.fog = new THREE.Fog('#bfeeff', 90, 260);
  buildItemMeshes();
}

// ---------------------------------------------------------------- items (instanced: 4 draw calls for all loot)
function addItem(x, z, kind = null) {
  if (!onIsle(x, z, 2)) return;
  const chest = kind === 'chest', r = rand();
  let it;
  if (chest) it = { kind: 'chest', x, z };
  else if (r < 0.48) it = { kind: 'gun', gun: Math.floor(rand() * 4), rar: rand() < 0.7 ? 0 : 1, x, z };
  else if (r < 0.75) it = { kind: 'shield', x, z };
  else it = { kind: 'kit', x, z };
  it.taken = false; it.ph = rand() * 6; items.push(it);
}
function rollChest(it, u) {   // chest opens into a better blaster + a shield or kit
  const lucky = u && u.me && P.perk === 3 ? 0.18 : 0;
  const rr = Math.random() + lucky, rar = rr > 0.93 ? 3 : rr > 0.7 ? 2 : 1, gun = Math.random() < 0.12 ? 4 : Math.floor(Math.random() * 4);
  it.taken = true;
  items.push({ kind: 'gun', gun, rar, x: it.x + 0.8, z: it.z + 0.6, taken: false, ph: 0 });
  items.push({ kind: Math.random() < 0.5 ? 'shield' : 'kit', x: it.x - 0.8, z: it.z + 0.6, taken: false, ph: 1 });
  spark(new THREE.Vector3(it.x, 1, it.z), ['#ffd23f', '#ffffff'], 16, 0.1); ring(new THREE.Vector3(it.x, 0, it.z), '#ffd23f', 0.5, 0.5, 6);
}
function buildItemMeshes() {
  const mk = (geo, max) => { const m = new THREE.InstancedMesh(geo, vmat({ emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.12 }), max); m.userData.cap = max; m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3).fill(1), 3); m.castShadow = true; m.frustumCulled = false; world.add(m); return m; };
  itemMeshes = {
    gun: mk(merge([part(rounded(0.9, 0.3, 0.3, 0.08), '#ffffff', {}), part(G.box, '#3a3f55', { x: -0.25, y: -0.25, sx: 0.18, sy: 0.35, sz: 0.2, rz: 0.2 }), part(G.cyl, '#3a3f55', { x: 0.55, rz: Math.PI / 2, sx: 0.1, sz: 0.1, sy: 0.3 }), part(G.box, '#ffffff', { x: 0.1, y: 0.2, sx: 0.3, sy: 0.1, sz: 0.12 })]), 400),
    shield: mk(merge([part(G.cyl, '#4da3ff', { sx: 0.25, sz: 0.25, sy: 0.6 }), part(G.cyl, '#ffffff', { y: 0.33, sx: 0.18, sz: 0.18, sy: 0.08 }), part(G.cyl, '#bfe3ff', { sx: 0.27, sz: 0.27, sy: 0.12 })]), 400),
    kit: mk(merge([part(rounded(0.6, 0.45, 0.4, 0.08), '#ffffff', {}), part(G.box, '#3ddc84', { sx: 0.34, sy: 0.1, sz: 0.42 }), part(G.box, '#3ddc84', { sx: 0.1, sy: 0.34, sz: 0.42 })]), 400),
    chest: mk(merge([part(rounded(1.3, 0.8, 0.9, 0.1), '#ffcf3a', { y: 0.4 }), part(G.box, '#c98e52', { y: 0.55, sx: 1.34, sy: 0.12, sz: 0.94 }), part(G.box, '#ffffff', { y: 0.45, z: 0.46, sx: 0.2, sy: 0.24, sz: 0.06 })]), 120),
  };
  const gm = new THREE.RingGeometry(0.55, 0.85, 24); gm.rotateX(-Math.PI / 2);
  itemMeshes.glow = new THREE.InstancedMesh(gm, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.75, depthWrite: false }), 800);
  itemMeshes.glow.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(800 * 3), 3); itemMeshes.glow.frustumCulled = false; world.add(itemMeshes.glow);
}
const DM = new THREE.Object3D(), CC = new THREE.Color();
function drawItems(t) {
  const c = { gun: 0, shield: 0, kit: 0, chest: 0 }; let gi = 0;
  const cx = camera.position.x, cz = camera.position.z - 14;
  for (const it of items) {
    if (it.taken || Math.abs(it.x - cx) > 40 || Math.abs(it.z - cz) > 44) continue;
    const m = itemMeshes[it.kind]; if (c[it.kind] >= m.userData.cap || gi >= 800) continue; const i = c[it.kind]++;
    const ch = it.kind === 'chest';
    DM.position.set(it.x, ch ? 0 : 0.7 + Math.sin(t * 3 + it.ph) * 0.15, it.z); DM.rotation.set(0, ch ? 0 : t * 1.5 + it.ph, 0); DM.scale.setScalar(1); DM.updateMatrix(); m.setMatrixAt(i, DM.matrix);
    const col = it.kind === 'gun' ? RAR[it.rar].c : it.kind === 'shield' ? '#4da3ff' : it.kind === 'kit' ? '#ffffff' : '#ffcf3a';
    m.setColorAt(i, CC.set(it.kind === 'gun' ? col : '#ffffff'));
    DM.position.y = 0.06; DM.rotation.set(0, 0, 0); DM.scale.setScalar(ch ? 1.6 : 1 + Math.sin(t * 4 + it.ph) * 0.08); DM.updateMatrix(); itemMeshes.glow.setMatrixAt(gi, DM.matrix); itemMeshes.glow.setColorAt(gi++, CC.set(it.kind === 'gun' ? col : it.kind === 'shield' ? '#4da3ff' : it.kind === 'kit' ? '#3ddc84' : '#ffcf3a'));
  }
  for (const k in c) { const m = itemMeshes[k]; m.count = c[k]; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
  itemMeshes.glow.count = gi; itemMeshes.glow.instanceMatrix.needsUpdate = true; itemMeshes.glow.instanceColor.needsUpdate = true;
}

// ---------------------------------------------------------------- effects
const BULLET = new THREE.CapsuleGeometry(0.08, 0.6, 2, 6); BULLET.rotateX(Math.PI / 2);
const bullets = new Pool(scene, BULLET, new THREE.MeshBasicMaterial({ color: '#ffffff' }), 360, { colors: true });
const sparks = new Pool(scene, new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshBasicMaterial({ color: '#ffffff' }), 500, { colors: true });
const chunks = new Pool(scene, rounded(0.34, 0.24, 0.28, 0.05), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 }), 160, { colors: true });
const flashes = new Pool(scene, new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0.9 }), 50);
const rings = new Pool(scene, (() => { const g = new THREE.RingGeometry(0.85, 1, 32); g.rotateX(-Math.PI / 2); return g; })(), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }), 40, { colors: true });
function spark(pos, cols, n = 10, sp = 0.1, up = 0.08) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, b = Math.random() * 0.9 + 0.1; sparks.spawn({ p: pos.clone(), v: new THREE.Vector3(Math.cos(a) * sp * b * 60, (up + Math.random() * up) * 60, Math.sin(a) * sp * b * 60), life: 0.5 + Math.random() * 0.4, color: cols[i % cols.length], s: 0.6 + Math.random() * 0.8 }); } }
function ring(pos, color, size = 1, life = 0.5, grow = 8) { rings.spawn({ p: pos.clone().setY(0.1), v: new THREE.Vector3(), life, color, s: size, grow }); }
const bars = healthBars(scene, camera, 24), fl = floaters(camera), shake = shaker();

// storm wall + next-circle marker
const storm = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 60, 96, 1, true), new THREE.MeshBasicMaterial({ color: '#8a4dff', transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }));
storm.position.y = 20; scene.add(storm);
const stormEdge = new THREE.Mesh((() => { const g = new THREE.RingGeometry(0.985, 1, 128); g.rotateX(-Math.PI / 2); return g; })(), new THREE.MeshBasicMaterial({ color: '#d9b3ff', transparent: true, opacity: 0.9, depthWrite: false })); stormEdge.position.y = 0.12; scene.add(stormEdge);
const nextMark = new THREE.Mesh((() => { const g = new THREE.RingGeometry(0.99, 1, 128); g.rotateX(-Math.PI / 2); return g; })(), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false })); nextMark.position.y = 0.13; scene.add(nextMark);
// sky barge
const barge = new THREE.Group(); scene.add(barge);
{ const b = new THREE.Mesh(merge([part(new THREE.CapsuleGeometry(3, 9, 6, 16), '#ff7b54', { rx: Math.PI / 2 }), part(G.cyl, '#ffffff', { rx: Math.PI / 2, sx: 3.05, sz: 3.05, sy: 1.2, z: -1 }), part(G.cyl, '#ffffff', { rx: Math.PI / 2, sx: 3.05, sz: 3.05, sy: 1.2, z: 2.5 }), part(rounded(2.4, 1.2, 5, 0.3), '#2b2d42', { y: -3.6 }), part(G.box, '#ffd23f', { y: -3.6, sx: 2.5, sy: 0.3, sz: 5.1 }), ...[-1, 1].map(s => part(G.box, '#ff7b54', { x: s * 1.6, z: -6.5, sx: 3, sy: 0.25, sz: 1.6 })), part(G.box, '#ff7b54', { y: 1.6, z: -6.5, sx: 0.25, sy: 3, sz: 1.6 })]), vmat()); b.castShadow = true; barge.add(b); }

// ---------------------------------------------------------------- units
const TEAMC = ['#3a86ff', '#ff7a3d', '#ff5d8f', '#3ddc84', '#8d99ae', '#7b5cff', '#00c2d1', '#ff4d6d', '#9be15d', '#f78fb3', '#ffa36c', '#5d7be8'];
const CALL = ['Sprocket', 'Nimbus', 'Widget', 'Ferro', 'Gizmo', 'Rivet', 'Kepler', 'Tinker', 'Dynamo', 'Piston', 'Quark', 'Servo', 'Volta', 'Bramble', 'Cog', 'Pixel', 'Ratchet', 'Echo', 'Zinc', 'Bolt', 'Flux', 'Jolt', 'Nova', 'Orbit', 'Patch', 'Spark'];
const KINDS = ['bolt', 'scout', 'heavy', 'tank'];
const PAINTS = [{ body: '#ffd23f', trim: '#2b2d42', visor: '#9ff3ff' }, { body: '#20c997', trim: '#ffd23f', visor: '#e8fffb' }, { body: '#ff5d8f', trim: '#ffffff', visor: '#9ff3ff' }, { body: '#7b5cff', trim: '#ffe066', visor: '#ffb3ff' }];
const units = []; let player = null;
const CANOPY = merge([part(new THREE.SphereGeometry(1, 16, 8, 0, TAU, 0, Math.PI / 2.4), '#ffffff', { sy: 0.55, s: 1.6 }), ...[0, 1, 2, 3].map(k => part(G.cyl, '#2b2d42', { x: Math.cos(k * 1.57 + 0.78) * 0.7, z: Math.sin(k * 1.57 + 0.78) * 0.7, y: -0.9, sx: 0.02, sz: 0.02, sy: 1.8, rz: Math.cos(k * 1.57 + 0.78) * 0.35, rx: -Math.sin(k * 1.57 + 0.78) * 0.35 }))]);
function makeUnits() {
  for (const u of units) scene.remove(u.mesh); units.length = 0;
  const r = rng(seed + 77), names = [...CALL].sort(() => r() - 0.5);
  const paint = PAINTS[Math.min(PAINTS.length - 1, Math.floor((rankOf(P.xp) - 1) / 2))];
  for (let i = 0; i < N; i++) {
    const me = i === 0, c = TEAMC[i % TEAMC.length];
    const mesh = robot(me ? { ...paint, kind: 'bolt' } : { body: c, trim: i % 3 ? '#2b2d42' : '#ffffff', visor: '#ffe066', kind: KINDS[i % 4] });
    const can = new THREE.Mesh(CANOPY, vmat()); can.position.y = 3.6; can.visible = false; mesh.add(can);
    can.material.color.set(me ? '#ffd23f' : c);
    scene.add(mesh);
    const u = { id: i, me, name: me ? 'You' : names[i], col: me ? '#ffd23f' : c, mesh, can, p: new THREE.Vector3(), y: 45, yaw: 0, hp: 100, sh: 0, alive: true, phase: 'barge', dropAt: 1.5 + r() * 11, land: null,
      slots: [null, null], calm: !me && r() < 0.6, cur: 0, ammo: [0, 0], reload: 0, cd: 0, kits: 0, healT: 0, kills: 0, vel: new THREE.Vector3(), walkT: r() * 10, target: null, react: 0, think: 0, goal: null, goalT: 0, strafe: 1, strafeT: 0, side: r() < 0.5 ? 1 : -1, lastP: new THREE.Vector3(), stuckT: 0, lastHit: 9, by: null };
    if (me) { const ringM = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 32), new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.85 })); ringM.rotation.x = -Math.PI / 2; ringM.position.y = 0.05; mesh.add(ringM); player = u; }
    units.push(u);
  }
}

// ---------------------------------------------------------------- storm ring
const PHASES = [[40, 28, 0.62, 1], [32, 24, 0.6, 2], [28, 20, 0.55, 4], [24, 16, 0.5, 6], [20, 14, 0.4, 8], [15, 14, 0, 10]];   // wait s, shrink s, radius factor, dmg/s
let ring0 = { x: 0, z: 0, r: 105 }, ringN = null, ringCur = { x: 0, z: 0, r: 105 }, phaseI = 0, phaseT = 0, shrinking = false;
function nextCircle() {
  const [, , f] = PHASES[phaseI], r = Math.max(0, ringCur.r * f);
  for (let k = 0; k < 30; k++) { const a = rand() * TAU, d = rand() * (ringCur.r - r) * 0.9, x = ringCur.x + Math.cos(a) * d, z = ringCur.z + Math.sin(a) * d; if (onIsle(x, z, Math.min(r, 25) * 0.6)) return { x, z, r }; }
  return { x: ringCur.x, z: ringCur.z, r };
}
function updateStorm(s) {
  phaseT += s;
  const [wait, shrink] = PHASES[phaseI];
  if (!shrinking && phaseT >= wait) { shrinking = true; phaseT = 0; ring0 = { ...ringCur }; say('⚡ STORM MOVING', 'Get inside the white circle', 1500); tone(90, 0.6, 'sawtooth', 0.08, 0.6); }
  if (shrinking) {
    const k = Math.min(1, phaseT / shrink); ringCur = { x: lerp(ring0.x, ringN.x, k), z: lerp(ring0.z, ringN.z, k), r: lerp(ring0.r, ringN.r, k) };
    if (k >= 1) { shrinking = false; phaseT = 0; if (phaseI < PHASES.length - 1) { phaseI++; ringN = nextCircle(); } }
  }
  storm.position.set(ringCur.x, 20, ringCur.z); storm.scale.set(Math.max(0.01, ringCur.r), 1, Math.max(0.01, ringCur.r));
  stormEdge.position.set(ringCur.x, 0.12, ringCur.z); stormEdge.scale.setScalar(Math.max(0.01, ringCur.r));
  nextMark.position.set(ringN.x, 0.13, ringN.z); nextMark.scale.setScalar(Math.max(0.01, ringN.r)); nextMark.visible = ringN.r < ringCur.r - 0.5;
}
const inStorm = p => Math.hypot(p.x - ringCur.x, p.z - ringCur.z) > ringCur.r;

// ---------------------------------------------------------------- HUD + controls
const css = document.createElement('style'); css.textContent = `
.sd-top{position:fixed;top:calc(10px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:6;display:flex;gap:10px;align-items:center;padding:6px 12px;font:900 17px/1 'Baloo 2',system-ui,sans-serif;pointer-events:none;white-space:nowrap}
.sd-zone{position:fixed;top:calc(50px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:6;font:800 12px/1 system-ui,sans-serif;padding:5px 10px;border-radius:10px;background:rgba(80,30,140,.55);pointer-events:none;white-space:nowrap}
.sd-zone.out{background:#8a2be2;animation:hcpulse .5s infinite}
.sd-bot{position:fixed;left:50%;bottom:calc(14px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:8;display:flex;flex-direction:column;align-items:center;gap:5px;font:800 12px/1 system-ui,sans-serif}
.sd-bar{width:180px;height:11px;border-radius:7px;background:rgba(14,20,36,.6);overflow:hidden;border:1px solid rgba(255,255,255,.3)}
.sd-bar i{display:block;height:100%;transition:width .15s}.sd-hp i{background:linear-gradient(90deg,#3ddc84,#b6f7d0)}.sd-sh i{background:linear-gradient(90deg,#4da3ff,#bfe3ff)}
.sd-slots{display:flex;gap:6px}
.sd-slot{width:96px;padding:5px 6px;border-radius:10px;background:rgba(14,20,36,.6);border:2px solid rgba(255,255,255,.2);text-align:center;cursor:pointer;line-height:1.15;white-space:nowrap;overflow:hidden}
.sd-slot.on{border-color:#ffcf3a;box-shadow:0 0 10px rgba(255,207,58,.6)}.sd-slot small{display:block;font-size:10px;opacity:.85}
.sd-drop{position:fixed;left:50%;bottom:calc(120px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:9;font:900 26px/1 'Baloo 2',system-ui,sans-serif;color:#1a1300;background:#ffcf3a;border:3px solid #fff;border-radius:40px;padding:14px 40px;box-shadow:0 6px 0 rgba(0,0,0,.25);cursor:pointer;animation:hcpulse 1s infinite}
.sd-mute{position:fixed;left:calc(10px + env(safe-area-inset-left));top:calc(62px + env(safe-area-inset-top));z-index:8;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;font-size:16px;cursor:pointer}
.sd-aim{position:fixed;left:0;top:0;z-index:5;pointer-events:none;width:30px;height:30px;margin:-15px 0 0 -15px;border:3px solid rgba(255,255,255,.9);border-radius:50%;box-shadow:0 0 4px rgba(0,0,0,.5)}
.hc-card .sd-meta{font:800 15px/1.35 system-ui,sans-serif}.hc-card .sd-xp{width:220px;height:10px;border-radius:6px;background:rgba(0,0,0,.25);overflow:hidden;margin:3px auto}.hc-card .sd-xp i{display:block;height:100%;background:#ffcf3a}
.hc-card.dim{background:linear-gradient(180deg,rgba(40,10,80,.55),rgba(10,14,40,.3))}
`; document.head.appendChild(css);
const top = H('<div class="sd-top ax-glass"><span>👥 <b data-a>25</b></span><span>⚡ <b data-k>0</b></span><span>⭐ <b data-s>0</b></span></div>');
const zone = H('<div class="sd-zone"></div>');
const bot = H('<div class="sd-bot"><div class="sd-slots"><div class="sd-slot" data-i="0"></div><div class="sd-slot" data-i="1"></div></div><div class="sd-bar sd-sh"><i></i></div><div class="sd-bar sd-hp"><i></i></div></div>');
const dropB = H('<div class="sd-drop">🪂 DROP</div>');
const aimEl = H('<div class="sd-aim"></div>');
const mute = H('<div class="sd-mute ax-glass">🔊</div>');
const say = banner(), kfeed = feed({ right: 10, top: 128 }), vign = vignette();
const mm = minimap(108, { right: 10, top: 10 });
const ctl = controls({ mode: 'stick', labels: ['MOVE', 'AIM + FIRE'] });
const healB = btn('KIT<br>0', { right: 18, bottom: 300, size: 56 }, () => startHeal(player));
const swapB = btn('SWAP', { right: 90, bottom: 330, size: 50 }, () => swap(player));
bot.querySelectorAll('.sd-slot').forEach(e => e.addEventListener('pointerdown', ev => { ev.stopPropagation(); if (player.slots[+e.dataset.i]) { player.cur = +e.dataset.i; player.reload = 0; hud(); sfx.tap(); } }));
dropB.addEventListener('pointerdown', e => { e.stopPropagation(); if (player.phase === 'barge') jump(player); });
mute.addEventListener('pointerdown', e => { e.stopPropagation(); mute.textContent = song.toggle() ? '🔊' : '🔈'; if (song.on && state === 'play') song.start(); });
const song = music({ bpm: 112, bars: [[62, 'min'], [58, 'maj'], [53, 'maj'], [60, 'maj']], lead: [74, 0, 77, 0, 81, 0, 79, 77, 0, 74, 0, 72, 74, 0, 0, 0, 70, 0, 74, 0, 77, 0, 76, 74, 0, 72, 0, 69, 72, 0, 0, 0] });
mute.textContent = song.on ? '🔊' : '🔈';
ctl.onKey = c => { if (state !== 'play') return; if (c === 'Space' && player.phase === 'barge') jump(player); if (c === 'KeyQ' || c === 'Tab') swap(player); if (c === 'KeyH' || c === 'KeyE') startHeal(player); if (c === 'KeyR') startReload(player); if (c === 'Digit1' || c === 'Digit2') { const i = +c.slice(-1) - 1; if (player.slots[i]) { player.cur = i; hud(); } } };
const hudEls = [top, zone, bot, healB, swapB, mm.el, aimEl];
const showHud = v => { hudEls.forEach(e => e.style.display = v ? '' : 'none'); ctl.enabled = v; ctl.refresh(); if (!v) dropB.style.display = 'none'; };

const startMeta = H('<div class="sd-meta"></div>', ui.els.start), chips = H('<div class="ax-chips"></div>', ui.els.start);
ui.els.start.querySelector('h1').after(startMeta); startMeta.after(chips);
function paintStart() {
  const r = rankOf(P.xp), lo = rankXp(r), hi = rankXp(r + 1);
  startMeta.innerHTML = `RANK ${r} · ${P.wins} crowns · best #${P.bestPlace}<div class="sd-xp"><i style="width:${Math.round((P.xp - lo) / (hi - lo) * 100)}%"></i></div>Drop perk:`;
  chips.innerHTML = PERKS.map((k, i) => `<button class="ax-chip" data-k="${i}" aria-pressed="${i === P.perk}" ${r < k.rank ? 'disabled' : ''}>${k.name}<small>${r < k.rank ? '🔒 rank ' + k.rank : k.txt}</small></button>`).join('');
  chips.querySelectorAll('button').forEach(b => { b.addEventListener('pointerdown', e => e.stopPropagation()); b.onclick = e => { e.stopPropagation(); if (b.disabled) return; P.perk = +b.dataset.k; saveP(); paintStart(); sfx.tap(); }; });
}

// ---------------------------------------------------------------- match flow
let state = 'ready', score = 0, alive = N, t0 = 0, recorded = false, beatenShown = false, fk = 1, matchT = 0, bargeA = new THREE.Vector3(), bargeB = new THREE.Vector3(), bargeT = 0, placeOut = 0, hurtV = 0, lastTown = null;
const BARGE_S = 15;
function newMatch() {
  seed = D.seed ? D.seed : (Date.now() % 1e7) + 11;
  buildIsland(); fk = F.k(); makeUnits();
  state = 'ready'; score = 0; alive = N; recorded = false; beatenShown = false; matchT = 0; placeOut = 0;
  ring0 = { x: 0, z: 0, r: 105 }; ringCur = { ...ring0 }; phaseI = 0; phaseT = 0; shrinking = false; ringN = nextCircle(); updateStorm(0);
  const a = rand() * TAU; bargeA.set(Math.cos(a) * 115, 45, Math.sin(a) * 115); bargeB.set(-Math.cos(a + 0.3) * 115, 45, -Math.sin(a + 0.3) * 115); bargeT = 0;
  barge.position.copy(bargeA); barge.lookAt(bargeB.x, 45, bargeB.z); barge.visible = true;
  for (const u of units) { u.mesh.visible = false; u.p.copy(bargeA); }
  bullets.clear(); sparks.clear(); chunks.clear(); fl.clear(); paintStart(); hud();
}
function begin() {
  state = 'play'; t0 = performance.now(); B.start(); showHud(true); song.start(); song.intensity = 0.3; dropB.style.display = 'block';
  say('🪂 DROP ZONE', 'Tap DROP over a town · steer with the stick', 2200); sfx.tap();
}
function jump(u) {
  if (u.phase !== 'barge') return;
  u.phase = 'glide'; u.p.copy(barge.position); u.p.y = 0; u.y = 42; u.mesh.visible = true; u.can.visible = true;
  if (u.me) { dropB.style.display = 'none'; tone(500, 0.3, 'sine', 0.1, 0.5); buzz(15); }
  else { const t = towns[Math.floor(Math.random() * towns.length)]; u.land = Math.random() < 0.25 ? new THREE.Vector3(t.x + (Math.random() - 0.5) * 16, 0, t.z + (Math.random() - 0.5) * 16) : (() => { const a = Math.random() * TAU, d = 15 + Math.random() * 65; return new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d); })(); }
}
function landed(u) {
  u.phase = 'ground'; u.y = 0; u.can.visible = false; collide(u.p);
  for (let k = 0; k < 20 && blocked(u.p.x, u.p.z); k++) { u.p.x += (Math.random() - 0.5) * 4; u.p.z += (Math.random() - 0.5) * 4; collide(u.p); }
  if (u.me) {
    ring(u.p, '#ffd23f', 0.5, 0.5, 8); sfx.bounce(); shake.kick(0.2); buzz(20);
    if (P.perk === 0) u.kits = 1; if (P.perk === 1) u.sh = 30;
    say('LANDED!', 'Loot a blaster', 1100); song.intensity = 0.5; hud();
  }
}

// ---------------------------------------------------------------- weapons
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
const fwd = (yaw, v = new THREE.Vector3()) => v.set(Math.sin(yaw), 0, Math.cos(yaw));
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const curGun = u => u.slots[u.cur];
function shoot(u, err = 0) {
  const w = curGun(u); if (!w || u.reload > 0 || u.cd > 0 || u.healT > 0) return;
  const g = GUNS[w.gun];
  if (u.ammo[u.cur] <= 0) { startReload(u); return; }
  u.cd = 1 / g.rate; u.ammo[u.cur]--;
  u.mesh.updateMatrixWorld(); u.mesh.muzzle.getWorldPosition(tmp); tmp.y = 1.25;
  for (let k = 0; k < g.pellets; k++) { const a = u.yaw + (Math.random() - 0.5) * 2 * (g.spread + err); bullets.spawn({ p: tmp.clone(), v: fwd(a).multiplyScalar(g.speed), life: g.range / g.speed, owner: u, dmg: g.dmg * RAR[w.rar].m, color: u.me ? g.col : '#ffffff', s: g.dmg > 50 ? 1.8 : 1 }); }
  flashes.spawn({ p: tmp.clone(), v: new THREE.Vector3(), life: 0.06, s: g.pellets > 1 ? 1.8 : 1.2 });
  u.mesh.recoil();
  const d = u.me ? 0 : u.p.distanceTo(player.p);
  if (d < 30) { const v = u.me ? 0.07 : 0.035 * (1 - d / 30); if (v > 0.004) tone(u.me ? (g.pellets > 1 ? 220 : g.dmg > 50 ? 1200 : 760) : 540, g.pellets > 1 ? 0.12 : 0.05, u.me ? 'square' : 'triangle', v, g.dmg > 50 ? 0.3 : 0.45); }
  if (u.me) { shake.kick(g.pellets > 1 ? 0.2 : g.dmg > 50 ? 0.3 : 0.04); buzz(g.pellets > 1 ? 18 : 5); }
  if (u.ammo[u.cur] <= 0) startReload(u);
}
function startReload(u) { const w = curGun(u); if (!w || u.reload > 0 || u.ammo[u.cur] >= GUNS[w.gun].mag) return; u.reload = GUNS[w.gun].reload; if (u.me) { tone(300, 0.08, 'square', 0.05, 1.4); setTimeout(() => tone(420, 0.06, 'square', 0.05, 1.2), 250); } }
function swap(u) { const o = 1 - u.cur; if (!u.slots[o]) return; u.cur = o; u.reload = 0; if (u.me) { sfx.tap(); hud(); } }
function startHeal(u) { if (u.kits <= 0 || u.healT > 0 || u.hp >= 100) return; u.healT = 2; if (u.me) { tone(600, 0.2, 'sine', 0.08, 1.4); hud(); } }
function score1(v) { return (v.gun + 1) * 10 + v.rar * 14 + (v.gun === 4 ? 6 : 0); }
function pickup(u, it) {
  if (it.kind === 'chest') { rollChest(it, u); if (u.me) { sfx.coin(); ui.pop('CHEST!', '#ffcf3a', 30, 62); } return; }
  if (it.kind === 'gun') {
    const w = { gun: it.gun, rar: it.rar };
    let slot = u.slots[0] ? (u.slots[1] ? -1 : 1) : 0;
    if (slot < 0) { const worst = score1(u.slots[0]) < score1(u.slots[1]) ? 0 : 1; if (score1(w) <= score1(u.slots[worst]) || u.slots.some(s => s.gun === w.gun && s.rar >= w.rar)) return; slot = worst; }
    else if (u.slots.some(s => s && s.gun === w.gun && s.rar >= w.rar)) return;
    u.slots[slot] = w; u.ammo[slot] = GUNS[w.gun].mag; if (!u.slots[u.cur]) u.cur = slot; if (u.slots[slot] && slot !== u.cur && score1(w) > score1(u.slots[u.cur])) u.cur = slot;
    it.taken = true;
    if (u.me) { ui.pop(`${RAR[w.rar].n.toUpperCase()} ${GUNS[w.gun].name.toUpperCase()}`, RAR[w.rar].c, 26, 62); sfx.coin(); buzz(10); hud(); }
  } else if (it.kind === 'shield') { if (u.sh >= 100) return; u.sh = Math.min(100, u.sh + 50); it.taken = true; if (u.me) { ui.pop('+50 SHIELD', '#4da3ff', 26, 62); sfx.pick(3); hud(); } }
  else if (it.kind === 'kit') { if (u.kits >= 3) return; u.kits++; it.taken = true; if (u.me) { ui.pop('+1 REPAIR KIT', '#3ddc84', 26, 62); sfx.pick(1); hud(); } }
  if (it.taken) ring(tmp.set(it.x, 0, it.z), '#ffffff', 0.4, 0.35, 5);
}
function damage(v, dmg, from, pos, storm = false) {
  if (!v.alive || state !== 'play') return;
  v.healT = 0; v.lastHit = 0;
  const raw = dmg;
  if (!storm && v.sh > 0) { const a = Math.min(v.sh, dmg); v.sh -= a; dmg -= a; }
  v.hp -= dmg; if (!storm) v.mesh.flash(v.me ? '#ff4d6d' : '#ffffff', 1);
  if (from) v.by = from;
  if (from && from.me) { fl.add(Math.round(raw), pos.clone().setY(2.1), v.sh > 0 ? '#7cc4ff' : dmg >= 40 ? '#ffcf3a' : '#ffffff', dmg >= 40 ? 26 : 18); tone(1500, 0.03, 'square', 0.04, 0.8); }
  if (v.me && !storm) { hurtV = 0.7; shake.kick(0.12); buzz(12); }
  if (!v.me && from && !v.target) { v.target = from; v.react = 0.3; }
  if (v.hp <= 0) eliminate(v, from);
}
function eliminate(v, by) {
  v.alive = false; v.hp = 0; v.mesh.visible = false; alive--;
  const c = v.mesh.position.clone().setY(1.1);
  spark(c, ['#ffd23f', '#ffffff', v.col, '#9ff3ff'], 26, 0.16, 0.12);
  for (let i = 0; i < 9; i++) { const a = Math.random() * TAU; chunks.spawn({ p: c.clone(), v: new THREE.Vector3(Math.cos(a) * (2 + Math.random() * 4), 4 + Math.random() * 5, Math.sin(a) * (2 + Math.random() * 4)), life: 1.6, color: i % 3 ? v.col : '#2b2d42', s: 0.8 + Math.random() * 0.7 }); }
  ring(c, v.col, 0.5, 0.45, 9);
  // drop loot box contents
  for (const w of v.slots) if (w) items.push({ kind: 'gun', gun: w.gun, rar: w.rar, x: v.p.x + (Math.random() - 0.5) * 2, z: v.p.z + (Math.random() - 0.5) * 2, taken: false, ph: Math.random() * 6 });
  if (v.kits) items.push({ kind: 'kit', x: v.p.x + 1, z: v.p.z, taken: false, ph: 0 });
  if (by && by !== v && by.alive) by.kills++;
  const d = v.p.distanceTo(player.p);
  if (d < 35) { tone(180, 0.25, 'square', 0.08 * (1 - d / 40) + 0.02, 0.4); tone(90, 0.3, 'sawtooth', 0.05, 0.5); }
  kfeed(`<span style="color:${by ? by.col : '#c58bff'}">${by ? by.name : '⚡ Storm'}</span> ✦ <span style="color:${v.col}">${v.name}</span>`);
  if (v.me) { endMatch(false); return; }
  if (player.alive) addScore(10, false);
  if (by && by.me) { addScore(50, true); ui.pop(`ELIMINATED! +60 · ${by.kills}`, '#ffcf3a', 32, 24); [0, 4, 7].forEach((s, i) => setTimeout(() => note(76 + s, 0.18, 0.12), i * 60)); buzz([10, 20, 30]); shake.kick(0.2); }
  else if (player.alive && alive <= 10 && alive > 1) ui.pop(`${alive} LEFT`, '#fff', 26, 30);
  hud();
  if (player.alive && alive === 1) endMatch(true);
}
function addScore(n) {
  score += n; hud();
  if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); spark(player.p.clone().setY(2), ['#ff5d8f', '#ffd23f', '#3ab795', '#3a86ff'], 40, 0.2, 0.15); }
  B.submit(score, { ms: performance.now() - t0 });   // best mode: the match score only grows while you're alive
}
function endMatch(won) {
  if (state !== 'play') return;
  const place = won ? 1 : alive + 1;
  if (won) addScore(300);
  state = won ? 'won' : 'lost'; showHud(false); song.intensity = 0.2;
  if (!recorded) { recorded = true; F.endless(score); B.submit(score, { ms: performance.now() - t0 }); }
  const r0 = rankOf(P.xp); P.xp += score + 20; P.matches++; P.elims += player.kills; if (won) P.wins++; const nb = score > P.best; P.best = Math.max(P.best, score); P.bestPlace = Math.min(P.bestPlace, place); saveP();
  const r1 = rankOf(P.xp), unl = PERKS.find(k => k.rank > r0 && k.rank <= r1);
  const line = `${player.kills} elims · score ${score}${nb ? ' · NEW BEST' : ''} · +${score + 20} XP${r1 > r0 ? ` · RANK ${r1}!` : ''}${unl ? ` · ${unl.name} unlocked` : ''}`;
  if (won) { sfx.win(); D.won(score); ui.win(P.matches, line); setTimeout(() => { ui.els.win.querySelector('h1').innerHTML = 'STORM<br>CHAMPION!'; ui.els.win.querySelector('p').textContent = '#1 OF 25 · LAST BOT STANDING'; }, 0); for (let i = 0; i < 4; i++) setTimeout(() => spark(player.p.clone().setY(2.5), ['#ff5d8f', '#ffd23f', '#3ab795', '#3a86ff', '#ffffff'], 40, 0.22, 0.2), i * 250); }
  else { sfx.fail(); ui.lose(`#${place} OF 25`, `${player.by ? 'Popped by ' + (player.by === player ? 'the storm' : player.by.name) : 'Caught by the storm'} · ` + line); }
}

// ---------------------------------------------------------------- AI
function seeTarget(u, range) {
  let best = null, bd = 1e9;
  for (const e of units) { if (e === u || !e.alive || e.phase !== 'ground') continue; const d = Math.hypot(e.p.x - u.p.x, e.p.z - u.p.z); if (d < range && d < bd && los(u.p, e.p)) { bd = d; best = e; } }
  return best;
}
const ANG = [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.3, -2.3];
function steer(u, dir) { for (const a0 of ANG) { const a = dir + a0 * u.side; if (!blocked(u.p.x + Math.sin(a) * 1.4, u.p.z + Math.cos(a) * 1.4, R + 0.05)) return a; } u.side = -u.side; return dir + Math.PI; }
function wantItem(u, it) {
  if (it.taken) return false;
  if (it.kind === 'chest') return true;
  if (it.kind === 'gun') { const w = { gun: it.gun, rar: it.rar }; if (!u.slots[0] || !u.slots[1]) return !u.slots.some(s => s && s.gun === w.gun && s.rar >= w.rar); return score1(w) > Math.min(score1(u.slots[0]), score1(u.slots[1])) + 8; }
  if (it.kind === 'shield') return u.sh < 60;
  return u.kits < 2;
}
function think(u, s) {
  const o = u.brain || (u.brain = { move: null, yaw: u.yaw, fire: false, speed: 1 });
  u.think -= s;
  const w = curGun(u), g = w ? GUNS[w.gun] : null;
  if (u.think <= 0) {
    u.think = 0.25 + Math.random() * 0.15;
    let t = g ? seeTarget(u, Math.min(g.range + 4, 36)) : null;
    const aggr = clamp(matchT / 300, 0.2, 1);   // early on most bots loot quietly; fights heat up as the storm closes
    if (t && t !== u.by && u.p.distanceTo(t.p) > (u.calm ? 4 + 10 * aggr : 6 + 14 * aggr)) t = null;   // calm bots loot and rotate unless pressed
    if (t !== u.target) { u.target = t; u.react = (0.85 + Math.random() * 0.6) / fk; }
    const dC = Math.hypot(u.p.x - ringN.x, u.p.z - ringN.z), safe = dC < ringN.r * 0.8, urgent = inStorm(u.p) || (!safe && (shrinking || phaseT > PHASES[phaseI][0] - 18));
    if (urgent) { u.goal = new THREE.Vector3(ringN.x + (Math.random() - 0.5) * ringN.r * 0.5, 0, ringN.z + (Math.random() - 0.5) * ringN.r * 0.5); u.goalT = 6; }
    else if (!u.goal || u.goal.item && !wantItem(u, u.goal.item) || u.p.distanceTo(u.goal) < 1.2 || (u.goalT -= 0.3) < 0) {
      let best = null, bd = !w ? 45 : 20;
      for (const it of items) { const d = Math.hypot(it.x - u.p.x, it.z - u.p.z); if (d < bd && wantItem(u, it)) { bd = d; best = it; } }
      if (best) { u.goal = new THREE.Vector3(best.x, 0, best.z); u.goal.item = best; u.goalT = 8; }
      else { const a = Math.random() * TAU, d = Math.random() * ringN.r * 0.7; u.goal = new THREE.Vector3(ringN.x + Math.cos(a) * d, 0, ringN.z + Math.sin(a) * d); u.goalT = 10; }
    }
    if (u.p.distanceTo(u.lastP) < 0.4 && !u.target) { u.stuckT += 0.3; if (u.stuckT > 1.2) { u.goal = null; u.side = -u.side; u.stuckT = 0; } } else u.stuckT = 0;
    u.lastP.copy(u.p);
    if (u.hp < 50 && u.kits > 0 && !u.target) startHeal(u);
  }
  u.react -= s; u.strafeT -= s;
  if (u.strafeT <= 0) { u.strafe = Math.random() < 0.5 ? -1 : 1; u.strafeT = 0.8 + Math.random() * 1.6; }
  const t = u.target;
  if (t && t.alive && g) {
    const d = u.p.distanceTo(t.p), want = g.pellets > 1 ? 5 : g.dmg > 50 ? 22 : 12, lead = 0.5 * d / g.speed;
    o.yaw = Math.atan2(t.p.x + t.vel.x * lead - u.p.x, t.p.z + t.vel.z * lead - u.p.z);
    const toT = Math.atan2(t.p.x - u.p.x, t.p.z - u.p.z), radial = d > want + 3 ? 1 : d < want - 3 ? -1 : 0;
    o.move = steer(u, Math.atan2(Math.sin(toT) * radial + Math.sin(toT + Math.PI / 2) * u.strafe * 0.9, Math.cos(toT) * radial + Math.cos(toT + Math.PI / 2) * u.strafe * 0.9));
    o.speed = 0.85; o.fire = u.react <= 0 && Math.abs(angDiff(u.yaw, o.yaw)) < 0.15 && d < g.range + 2;
    if (inStorm(u.p)) o.move = steer(u, Math.atan2(ringN.x - u.p.x, ringN.z - u.p.z));
  } else {
    o.move = u.goal ? steer(u, Math.atan2(u.goal.x - u.p.x, u.goal.z - u.p.z)) : null; o.yaw = o.move ?? u.yaw; o.speed = 1; o.fire = false;
    if (w && u.reload <= 0 && u.ammo[u.cur] < GUNS[w.gun].mag * 0.5) startReload(u);
  }
  return o;
}

// ---------------------------------------------------------------- update
function aimFromMouse(mx, my) {
  const ndc = tmp.set(mx / innerWidth * 2 - 1, -(my / innerHeight) * 2 + 1, 0.5).unproject(camera).sub(camera.position).normalize();
  const t = (1.25 - camera.position.y) / ndc.y; return Math.atan2(camera.position.x + ndc.x * t - player.p.x, camera.position.z + ndc.z * t - player.p.z);
}
let aimAssistT = null;
function updateUnit(u, s, dt) {
  if (!u.alive) return;
  if (u.phase === 'barge') { u.p.copy(barge.position); if (!u.me && bargeT > u.dropAt) jump(u); return; }
  if (u.phase === 'glide') {
    const sp = (u.me && P.perk === 2 ? 15 : 11);
    let mx = 0, mz = 0;
    if (u.me) { mx = ctl.mx; mz = -ctl.my; }
    else if (u.land) { const dx = u.land.x - u.p.x, dz = u.land.z - u.p.z, d = Math.hypot(dx, dz); if (d > 1) { mx = dx / d; mz = dz / d; } }
    u.p.x += mx * sp * s; u.p.z += mz * sp * s; u.y -= 7.5 * s;
    if (mx || mz) u.yaw = Math.atan2(mx, mz);
    const a = Math.atan2(u.p.z, u.p.x), lim = isleR(a) - 2, d = Math.hypot(u.p.x, u.p.z); if (d > lim) { u.p.x *= lim / d; u.p.z *= lim / d; }
    u.mesh.position.set(u.p.x, u.y, u.p.z); u.mesh.rotation.set(Math.sin(matchT * 2 + u.id) * 0.08, u.yaw, mx * 0.2); u.can.rotation.z = Math.sin(matchT * 3 + u.id) * 0.06;
    if (u.y <= 0) landed(u);
    return;
  }
  u.cd -= s; u.lastHit += s;
  if (u.reload > 0) { u.reload -= s; if (u.reload <= 0) { u.reload = 0; const w = curGun(u); if (w) u.ammo[u.cur] = GUNS[w.gun].mag; } }
  if (u.healT > 0) { u.healT -= s; u.hp = Math.min(100, u.hp + 22 * s); if (u.healT <= 0) { u.kits--; if (u.me) { ui.pop('REPAIRED', '#3ddc84', 24, 62); hud(); } } }
  let mvx = 0, mvz = 0; const sp = 6.4 * (u.healT > 0 ? 0.45 : 1);
  if (u.me) {
    const botOn = performance.now() < ctl.bot;
    mvx = ctl.mx; mvz = -ctl.my; const l = Math.hypot(mvx, mvz); if (l > 1) { mvx /= l; mvz /= l; }
    let aimYaw = null, firing = false;
    if (botOn && u.brain) { aimYaw = u.brain.yaw; firing = u.brain.fire; }
    else if (ctl.touch && ctl.aiming) { aimYaw = Math.atan2(ctl.ax, -ctl.ay); firing = ctl.fire; }
    else if (!ctl.touch && ctl.mouse) { aimYaw = aimFromMouse(ctl.mouse.x, ctl.mouse.y); firing = ctl.fire; }
    // aim assist: snap toward the nearest robot within ~14° of the stick
    if (aimYaw !== null && !botOn && curGun(u)) {
      const g = GUNS[curGun(u).gun]; let best = null, bd = 0.25;
      for (const e of units) { if (e === u || !e.alive || e.phase !== 'ground') continue; const d = u.p.distanceTo(e.p); if (d > g.range + 4) continue; const a = Math.abs(angDiff(aimYaw, Math.atan2(e.p.x - u.p.x, e.p.z - u.p.z))); if (a < bd && los(u.p, e.p)) { bd = a; best = e; } }
      if (best) aimYaw = Math.atan2(best.p.x - u.p.x, best.p.z - u.p.z);
      aimAssistT = best;
    }
    if (aimYaw !== null) u.yaw += clamp(angDiff(u.yaw, aimYaw), -14 * s, 14 * s); else if (l > 0.1) u.yaw += clamp(angDiff(u.yaw, Math.atan2(mvx, mvz)), -10 * s, 10 * s);
    if (firing && aimYaw !== null && Math.abs(angDiff(u.yaw, aimYaw)) < 0.3) shoot(u);
  } else {
    const o = think(u, s);
    u.yaw += clamp(angDiff(u.yaw, o.yaw), -5 * s * fk, 5 * s * fk);
    if (o.move !== null) { mvx = Math.sin(o.move) * o.speed; mvz = Math.cos(o.move) * o.speed; }
    u.burst = (u.burst || 0) + (o.fire ? s : 0); if (u.burst > 1.3) { u.burst = -0.9; } if (o.fire && u.burst >= 0) shoot(u, 0.19 / fk + (u.vel.lengthSq() > 4 ? 0.025 : 0));
  }
  u.vel.x = lerp(u.vel.x, mvx * sp, Math.min(1, 12 * s)); u.vel.z = lerp(u.vel.z, mvz * sp, Math.min(1, 12 * s));
  u.p.x += u.vel.x * s; u.p.z += u.vel.z * s; collide(u.p);
  // storm damage
  if (inStorm(u.p)) { u.stormT = (u.stormT || 0) + s; if (u.stormT > 0.5) { u.stormT = 0; damage(u, PHASES[phaseI][3] * 0.5 * (shrinking ? 1 : 1), null, u.p, true); if (u.me) { hurtV = Math.max(hurtV, 0.45); tone(140, 0.12, 'sawtooth', 0.05, 0.8); } } }
  for (const it of items) if (!it.taken && Math.abs(it.x - u.p.x) < 1.3 && Math.abs(it.z - u.p.z) < 1.3) pickup(u, it);
  const m = u.mesh, spd = Math.hypot(u.vel.x, u.vel.z);
  m.position.set(u.p.x, 0, u.p.z); m.rotation.set(0, u.yaw, 0); u.walkT += s * (0.4 + spd / 7); m.walk(u.walkT, Math.min(1, spd / 5)); m.update(dt);
  m.visible = Math.abs(u.p.x - camera.position.x) < 45 && Math.abs(u.p.z - camera.position.z + 14) < 50;
}
function updatePools(dt) {
  const s = dt / 60;
  bullets.update(dt, b => {
    b.life -= s; if (b.life <= 0) return false;
    const nx = b.p.x + b.v.x * s, nz = b.p.z + b.v.z * s; let tHit = 2, hitU = null;
    near(b.p.x, b.p.z, nx, nz, o => { const t = segHit(b.p.x, b.p.z, nx, nz, o); if (t >= 0 && t < tHit) tHit = t; });
    const dx = nx - b.p.x, dz = nz - b.p.z, L2 = dx * dx + dz * dz || 1;
    for (const u of units) {
      if (!u.alive || u === b.owner || u.phase !== 'ground' || Math.abs(u.p.x - b.p.x) > 6 || Math.abs(u.p.z - b.p.z) > 6) continue;
      const t = clamp(((u.p.x - b.p.x) * dx + (u.p.z - b.p.z) * dz) / L2, 0, 1), cx = b.p.x + dx * t - u.p.x, cz = b.p.z + dz * t - u.p.z;
      if (cx * cx + cz * cz < 0.62 * 0.62 && t < tHit) { tHit = t; hitU = u; }
    }
    if (tHit <= 1) {
      const hp = new THREE.Vector3(b.p.x + dx * tHit, 1.25, b.p.z + dz * tHit);
      if (hitU) { damage(hitU, b.dmg, b.owner, hp); spark(hp, hitU.sh > 0 ? ['#7cc4ff', '#ffffff'] : ['#ffffff', hitU.col, '#ffd23f'], 5, 0.07); }
      else spark(hp, [b.color, '#ffffff'], 3, 0.05, 0.05);
      return false;
    }
    b.p.x = nx; b.p.z = nz;
  });
  sparks.update(dt, p => { p.life -= s; p.v.y -= 18 * s; p.p.addScaledVector(p.v, s); if (p.p.y < 0.05) { p.p.y = 0.05; p.v.y *= -0.4; p.v.x *= 0.7; p.v.z *= 0.7; } p.s = Math.max(0.01, p.life * 1.6); return p.life > 0; });
  chunks.update(dt, p => { p.life -= s; p.v.y -= 22 * s; p.p.addScaledVector(p.v, s); if (p.p.y < 0.12) { p.p.y = 0.12; p.v.y *= -0.35; p.v.x *= 0.6; p.v.z *= 0.6; } p.s = Math.min(1, p.life * 2) * (p.s0 || (p.s0 = p.s)); return p.life > 0; });
  flashes.update(dt, p => { p.life -= s; return p.life > 0; });
  rings.update(dt, p => { p.life -= s; p.s += p.grow * s; return p.life > 0; });
}

// ---------------------------------------------------------------- HUD paint
function hud() {
  if (!player) return;
  top.querySelector('[data-a]').textContent = alive; top.querySelector('[data-k]').textContent = player.kills; top.querySelector('[data-s]').textContent = score;
  bot.querySelector('.sd-hp i').style.width = Math.max(0, player.hp) + '%'; bot.querySelector('.sd-sh i').style.width = player.sh + '%';
  bot.querySelectorAll('.sd-slot').forEach((e, i) => {
    const w = player.slots[i]; e.classList.toggle('on', i === player.cur && !!w);
    e.style.borderColor = w ? (i === player.cur ? '#ffcf3a' : RAR[w.rar].c) : '';
    e.innerHTML = w ? `<span style="color:${RAR[w.rar].c}">${GUNS[w.gun].name}</span><small>${i === player.cur && player.reload > 0 ? 'RELOADING' : `${player.ammo[i]}/${GUNS[w.gun].mag}`}</small>` : `<span style="opacity:.6">Empty</span><small>slot ${i + 1}</small>`;
  });
  healB.querySelector('span').innerHTML = `KIT<br>${player.kits}`; healB.style.opacity = player.kits ? 1 : 0.45; healB.cool(player.healT > 0 ? player.healT / 2 : 0);
  swapB.style.opacity = player.slots[0] && player.slots[1] ? 1 : 0.4;
  const t = shrinking ? 0 : Math.ceil(PHASES[phaseI][0] - phaseT);
  zone.classList.toggle('out', player.alive && player.phase === 'ground' && inStorm(player.p));
  zone.textContent = player.phase === 'barge' ? `Sky barge · drop before it leaves (${Math.max(0, Math.ceil(BARGE_S - bargeT))})` : inStorm(player.p) && player.phase === 'ground' ? '⚡ IN THE STORM · RUN TO THE CIRCLE' : shrinking ? '⚡ Storm closing in' : ringN.r >= ringCur.r - 0.5 ? 'Final circle' : `Storm moves in ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}
function drawMini() {
  const g = mm.g, s = mm.size, k = s / 200, X = v => (v + 100) * k;
  g.clearRect(0, 0, s, s); g.fillStyle = '#3fb6e8'; g.fillRect(0, 0, s, s);
  g.fillStyle = '#86cf6a'; g.beginPath(); for (let i = 0; i <= 60; i++) { const a = i / 60 * TAU, r = isleR(a); g.lineTo(X(Math.cos(a) * r), X(Math.sin(a) * r)); } g.fill();
  g.fillStyle = 'rgba(233,211,154,.9)'; for (const t of towns) { g.beginPath(); g.arc(X(t.x), X(t.z), t.r * k, 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(110,40,200,.35)'; g.beginPath(); g.rect(0, 0, s, s); g.arc(X(ringCur.x), X(ringCur.z), ringCur.r * k, 0, TAU, true); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.beginPath(); g.arc(X(ringN.x), X(ringN.z), ringN.r * k, 0, TAU); g.stroke();
  if (barge.visible) { g.strokeStyle = 'rgba(255,255,255,.6)'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(X(bargeA.x), X(bargeA.z)); g.lineTo(X(bargeB.x), X(bargeB.z)); g.stroke(); g.setLineDash([]); g.fillStyle = '#ff7b54'; g.beginPath(); g.arc(X(barge.position.x), X(barge.position.z), 3, 0, TAU); g.fill(); }
  for (const u of units) if (u.alive && !u.me && u.phase !== 'barge' && u.p.distanceTo(player.p) < 22) { g.fillStyle = '#ff4d6d'; g.beginPath(); g.arc(X(u.p.x), X(u.p.z), 2, 0, TAU); g.fill(); }
  g.save(); g.translate(X(player.p.x), X(player.p.z)); g.rotate(Math.PI - player.yaw); g.fillStyle = '#ffd23f'; g.strokeStyle = '#2b2d42'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -5); g.lineTo(3.5, 4); g.lineTo(-3.5, 4); g.closePath(); g.fill(); g.stroke(); g.restore();
}

// ---------------------------------------------------------------- main loop
let tt = 0, camH = 60;
loop((dt) => {
  const s = dt / 60; tt += s;
  ctl.poll();
  if (state === 'play') {
    matchT += s;
    if (barge.visible) {
      bargeT += s; barge.position.lerpVectors(bargeA, bargeB, Math.min(1, bargeT / BARGE_S));
      if (bargeT >= BARGE_S) { for (const u of units) if (u.phase === 'barge') jump(u); barge.visible = false; }
    }
    if (player.phase === 'ground' || bargeT > 4) updateStorm(s);
    for (const u of units) updateUnit(u, s, dt);
    for (const u of units) if (u.alive && u.phase === 'ground') for (const o of units) if (o !== u && o.alive && o.phase === 'ground') { const dx = u.p.x - o.p.x, dz = u.p.z - o.p.z, d = Math.hypot(dx, dz); if (d < 1.1 && d > 1e-4) { u.p.x += dx / d * (1.1 - d) * 0.5; u.p.z += dz / d * (1.1 - d) * 0.5; } }
    song.intensity = player.phase !== 'ground' ? 0.3 : 0.45 + Math.min(0.5, (N - alive) / 30) + (inStorm(player.p) ? 0.2 : 0);
    if (Math.floor(tt * 4) !== Math.floor((tt - s) * 4)) { hud(); drawMini(); }
  } else for (const u of units) u.mesh.update(dt);
  updatePools(dt);
  // camera: high over the barge, swoops down while gliding, top-down chase on the ground
  if (player) {
    const tgt = player.phase === 'barge' ? barge.position : player.p;
    const h = state === 'ready' ? 80 : player.phase === 'barge' ? 70 : player.phase === 'glide' ? 28 + player.y * 0.9 : 26;
    camH = lerp(camH, h, 0.05);
    const lookAhead = player.phase === 'ground' ? fwd(player.yaw, tmp2).multiplyScalar(2.5) : tmp2.set(0, 0, 0);
    const cy = player.phase === 'glide' ? player.y : player.phase === 'barge' && state === 'play' ? 40 : 0;
    const want = tmp.set(tgt.x + lookAhead.x, cy + camH, tgt.z + lookAhead.z + camH * 0.62);
    if (state === 'ready') want.set(Math.cos(tt * 0.1) * 30, 85, 70 + Math.sin(tt * 0.1) * 20);
    camera.position.lerp(want, state === 'ready' ? 0.02 : 0.12);
    camera.lookAt(camera.position.x, cy, camera.position.z - camH * 0.62 - (state === 'ready' ? 0 : 0));
    shake.apply(camera, dt);
    S.followLight(tmp.set(player.phase === 'barge' ? barge.position.x : player.p.x, 0, player.phase === 'barge' ? barge.position.z : player.p.z));
    // aim reticle on the target the assist picked / where the blaster points
    if (state === 'play' && player.phase === 'ground' && curGun(player)) {
      const g = GUNS[curGun(player).gun], at = aimAssistT && aimAssistT.alive ? tmp.set(aimAssistT.p.x, 1.25, aimAssistT.p.z) : tmp.copy(player.p).addScaledVector(fwd(player.yaw, tmp2), Math.min(g.range, 9)).setY(1.25);
      at.project(camera); aimEl.style.display = ''; aimEl.style.transform = `translate(${(at.x * 0.5 + 0.5) * innerWidth}px,${(-at.y * 0.5 + 0.5) * innerHeight}px)`; aimEl.style.borderColor = aimAssistT && aimAssistT.alive ? '#ff5d5d' : 'rgba(255,255,255,.8)';
    } else aimEl.style.display = 'none';
    bars.begin();
    for (const u of units) if (u.alive && !u.me && u.mesh.visible && u.phase === 'ground' && (u.hp < 100 || u.sh > 0 || u === aimAssistT) && u.p.distanceTo(player.p) < 26) { bars.add(tmp.set(u.p.x, 2.7, u.p.z), u.hp / 100, '#ff5d5d', 1.1); if (u.sh > 0) bars.add(tmp.set(u.p.x, 2.95, u.p.z), u.sh / 100, '#4da3ff', 1.1); }
    bars.end();
    if (itemMeshes) drawItems(tt);
  }
  fl.update(dt);
  hurtV = Math.max(0, hurtV - s * 1.4);
  vign(state === 'play' && player && player.alive ? Math.max(hurtV, (50 - player.hp) / 90) : 0);
});

ui.onTap(w => { if (w === 'win' || w === 'lose') newMatch(); begin(); });
newMatch(); showHud(false); ui.start();

window.__game = {
  get state() { return state; }, get level() { return P.matches + 1; }, get score() { return score; },
  get dbg() { return { alive, phase: player.phase, hp: player.hp, sh: player.sh, kills: player.kills, slots: player.slots, ring: ringCur, draw: renderer.info.render.calls }; },
  bot() {
    if (state !== 'play' || !player.alive) return;
    if (player.phase === 'barge') { if (bargeT > 2.5) { const t = towns.reduce((b, t) => Math.hypot(t.x - barge.position.x, t.z - barge.position.z) < Math.hypot(b.x - barge.position.x, b.z - barge.position.z) ? t : b, towns[0]); if (Math.hypot(t.x - barge.position.x, t.z - barge.position.z) < 45 || bargeT > 8) { jump(player); player.land = new THREE.Vector3(t.x, 0, t.z); } } return; }
    if (player.phase === 'glide') { const l = player.land || towns[0]; const dx = l.x - player.p.x, dz = l.z - player.p.z, d = Math.hypot(dx, dz) || 1; ctl.drive({ mx: d > 2 ? dx / d : 0, my: d > 2 ? -dz / d : 0 }); return; }
    const o = think(player, 0.12);
    if (o.move === null) ctl.drive({ mx: 0, my: 0 }); else ctl.drive({ mx: Math.sin(o.move) * o.speed, my: -Math.cos(o.move) * o.speed });
    if (player.hp < 55 && player.kits && !player.target) startHeal(player);
  },
};
