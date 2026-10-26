// Pondguard — a 3D critter tower defense. Original game: code, art and sound are our own.
// Layered goo slimes march down a garden path toward the lily pond. Place critter towers beside the path, upgrade each
// along two paths, speed up, and survive 40 rounds on three maps.
import { THREE, createStage, createUI, loop, confetti, sfx, tone, note, buzz, store, clamp, lerp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { vcMat } from './merge.js';
import { towerGeo, slimeGeo, shellGeo, bulkGeo, beeGeo, quillGeo, shellShotGeo, treeGeo, canopyGeo, icon } from './models.js';
import { MAPS, UNLOCK, buildPath, roundSpawns, TIER_COL, TIER_SPD, TIER_SIZE, rbe, BULK_HP, GIANT_HP, BULK_RBE } from './maps.js';

const NAME = 'Pondguard: Tower Defense';
const S = store('pondguard');
const F = flow('pondguard');
const ROUNDS = 40;

// ================================================================ stage
const stage = createStage({ fov: 38, shadows: true, shadowSize: 13 });
const { scene, camera, renderer, sun, hemi } = stage;
hemi.color.set('#ffffff'); hemi.groundColor.set('#7da86a'); hemi.intensity = 1.2;
sun.intensity = 1.65; sun.color.set('#fff3dc'); sun.position.set(5, 16, 7);
document.body.style.setProperty('--bg1', '#8fd17a'); document.body.style.setProperty('--bg2', '#6fb85e'); document.body.style.setProperty('--ui', '#3ab795');

const ui = createUI({ title: 'POND<br>GUARD', hint: '', hand: '', progress: true, score: false });
const D = daily('pondguard', ui, { name: NAME });
const B = board({ game: 'pondguard', label: 'Rounds survived', limits: { maxRun: 80, maxPerSec: 1 }, corner: 'tl' });

const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0, ...o });
const VC = vcMat({ roughness: 0.55 });
const $ = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };

// ================================================================ towers
const TW = {
  hog: { name: 'Quill Hog', cost: 200, proj: 'quill', base: { range: 2.3, rate: 1.35, dmg: 1, pierce: 2 },
    A: [['Sharp Quills', 140, s => s.pierce += 1, '+1 pierce'], ['Barbed Quills', 240, s => { s.pierce += 2; s.dmg += 1; }, '+2 pierce, 2 layers per hit'], ['Quill Storm', 950, s => { s.spread = 3; s.pierce += 2; }, '3 quills per throw']],
    B: [['Long Toss', 110, s => s.range += 0.8, 'more range'], ['Quick Paws', 260, s => s.rate *= 1.6, 'throws 60% faster'], ['Iron Quills', 800, s => { s.shells = true; s.dmg += 1; s.rate *= 1.3; }, 'pops shells, +1 layer']] },
  frog: { name: 'Bubble Frog', cost: 380, proj: 'bubble', base: { range: 2.5, rate: 0.95, dmg: 1, pierce: 14, shells: true, splash: 1.05 },
    A: [['Big Bubbles', 300, s => { s.splash += 0.35; s.pierce += 8; }, 'bigger splash'], ['Fizz Bombs', 520, s => { s.dmg += 1; s.pierce += 6; }, '2 layers per pop'], ['Geyser Croak', 1700, s => { s.splash += 0.45; s.dmg += 2; s.pierce += 20; s.bulkX = 2; }, 'huge splash, 4 layers']],
    B: [['Fast Croak', 260, s => s.rate *= 1.4, '40% faster'], ['Sticky Suds', 420, s => s.slow = 0.45, 'slows slimes'], ['Twin Tongues', 1300, s => { s.multi = 2; s.rate *= 1.3; }, 'two targets at once']] },
  hive: { name: 'Bumble Hive', cost: 300, proj: 'bee', base: { range: 2.7, rate: 2.4, dmg: 1, pierce: 1 },
    A: [['Busy Bees', 220, s => s.rate *= 1.4, '40% more bees'], ['Swarm', 480, s => s.multi = 2, '2 bees per launch'], ["Queen's Court", 1500, s => { s.multi = 3; s.dmg += 1; s.pierce += 1; }, '3 strong bees']],
    B: [['Honey Drip', 240, s => s.slow = 0.3, 'stings slow slimes'], ['Wide Meadow', 300, s => s.range += 1.2, 'much more range'], ['Steel Stingers', 1000, s => { s.shells = true; s.dmg += 1; s.bulkX = 2; }, 'pops shells, +1 layer']] },
  snail: { name: 'Shellshock Snail', cost: 550, unlock: 10, proj: 'shell', base: { range: 4.6, rate: 0.45, dmg: 4, pierce: 6, shells: true, splash: 0.55, bulkX: 3 },
    A: [['Heavy Shell', 420, s => s.dmg += 3, '+3 layers per hit'], ['Quake Shell', 900, s => { s.splash += 0.5; s.pierce += 10; }, 'bigger blast'], ['Boulder Snail', 2600, s => { s.dmg += 11; s.bulkX = 4; }, 'crushes Bulk Blobs']],
    B: [['Spring Coil', 320, s => s.rate *= 1.4, '40% faster'], ['Scope Stalks', 400, s => s.range += 2, 'long range'], ['Rapid Shells', 1900, s => s.rate *= 2, 'fires twice as fast']] },
  owl: { name: 'Hoot Sniper', cost: 450, unlock: 20, proj: 'beam', base: { range: 99, rate: 0.8, dmg: 2, pierce: 1 },
    A: [['Keen Eyes', 350, s => { s.dmg += 2; s.shells = true; }, 'pops shells, +2 layers'], ['Deadeye', 900, s => s.dmg += 4, '+4 layers'], ['Night Hunter', 2700, s => { s.dmg += 12; s.bulkX = 2; }, '+12 layers']],
    B: [['Swift Wings', 300, s => s.rate *= 1.5, '50% faster'], ['Double Hoot', 650, s => s.rate *= 1.6, '60% faster'], ['Hoot Storm', 2100, s => { s.rate *= 1.8; s.multi = 3; }, 'hits 3 slimes']] },
};
const ORDER = ['hog', 'frog', 'hive', 'snail', 'owl'];
function statsOf(t) {
  const d = TW[t.type], s = Object.assign({ shells: false, spread: 1, splash: 0, slow: 0, bulkX: 1, multi: 1 }, d.base);
  for (let i = 0; i < t.a; i++) d.A[i][2](s);
  for (let i = 0; i < t.b; i++) d.B[i][2](s);
  return s;
}
const canUp = (t, p) => { const a = t.a + (p === 'A'), b = t.b + (p === 'B'); return Math.max(a, b) <= 3 && Math.min(a, b) <= 2; };
const upCost = (t, p) => TW[t.type][p][p === 'A' ? t.a : t.b][1];

// ================================================================ save / progress
let best = S.get('best', [0, 0, 0]), reach = S.get('reach', 0), mapI = S.get('map', 0);
const unlocked = (i) => i === 0 || best[i - 1] >= UNLOCK[i];
const towerOpen = (type) => !TW[type].unlock || reach >= TW[type].unlock;
if (!unlocked(mapI)) mapI = 0;

// ================================================================ world
let world = null, P = null, pondG = null, MAP = MAPS[0];
const spots = [], covCache = new Map();
function grassTex() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256; const x = c.getContext('2d');
  for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? '#94d56f' : '#a9e384'; x.fillRect(0, i * 16, 128, 16); }
  for (let i = 0; i < 260; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(80,150,60,.18)' : 'rgba(255,255,255,.12)'; x.fillRect(Math.random() * 128, Math.random() * 256, 2, 3); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const GT = grassTex();
function ribbon(w, y, color, every = 2) {
  const pos = [], idx = []; let n = 0;
  for (let i = 0; i < P.x.length; i += every) {
    const a = P.a[i], cx = Math.cos(a), cz = -Math.sin(a);
    pos.push(P.x[i] - cx * w / 2, y, P.z[i] - cz * w / 2, P.x[i] + cx * w / 2, y, P.z[i] + cz * w / 2);
    if (n) idx.push((n - 1) * 2, (n - 1) * 2 + 1, n * 2, (n - 1) * 2 + 1, n * 2 + 1, n * 2); n++;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, M(color, { roughness: 0.9, side: THREE.DoubleSide })); m.receiveShadow = true; return m;
}
function inst(geo, mat, list, shadow = true) {
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length)), o = new THREE.Object3D(), col = new THREE.Color();
  list.forEach((it, i) => { o.position.set(it[0], it[1], it[2]); o.rotation.set(0, it[4] || 0, 0); const s = it[3]; o.scale.set(...(Array.isArray(s) ? s : [s, s, s])); o.updateMatrix(); im.setMatrixAt(i, o.matrix); if (it[5]) im.setColorAt(i, col.set(it[5])); });
  im.count = list.length; im.castShadow = shadow; im.receiveShadow = true; return im;
}
function distPath(x, z) { let m = 1e9; for (let i = 0; i < P.x.length; i += 2) { const d = (P.x[i] - x) ** 2 + (P.z[i] - z) ** 2; if (d < m) m = d; } return Math.sqrt(m); }
const inPond = (x, z, pad = 0) => Math.hypot(x - MAP.pond[0], z - MAP.pond[1]) < MAP.pond[2] + pad;
const RX = 4.85, RZ0 = -8.75, RZ1 = 8.75;
function buildMap(i) {
  if (world) scene.remove(world);
  MAP = MAPS[i]; P = buildPath(MAP.pts); world = new THREE.Group(); scene.add(world);
  const r = rng(77 + i * 13);
  const out = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), M('#74bd5e')); out.rotation.x = -Math.PI / 2; out.position.y = -0.5; out.receiveShadow = true; world.add(out);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(RX * 2 + 0.6, 0.5, RZ1 - RZ0 + 0.6), M('#9b7653')); slab.position.y = -0.25; slab.receiveShadow = true; world.add(slab);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(RX * 2 + 0.75, 0.12, RZ1 - RZ0 + 0.75), M('#86c86a')); lip.position.y = -0.04; lip.receiveShadow = true; world.add(lip);
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(RX * 2 + 0.6, RZ1 - RZ0 + 0.6), M('#ffffff', { map: GT })); grass.rotation.x = -Math.PI / 2; grass.position.y = 0.005; grass.receiveShadow = true; world.add(grass);
  world.add(ribbon(1.5, 0.012, '#c49a62'), ribbon(1.18, 0.022, '#efd7a0'));
  // pebbles along the path edges, flowers + tufts on the grass
  const peb = [], fl = [], tuft = [];
  for (let k = 0; k < P.x.length; k += 6) { const a = P.a[k], side = k % 12 ? 1 : -1; peb.push([P.x[k] + Math.cos(a) * 0.74 * side, 0.03, P.z[k] - Math.sin(a) * 0.74 * side, [0.09 + r() * 0.05, 0.05, 0.08 + r() * 0.05], r() * 3, r() < 0.5 ? '#c9c2b6' : '#ddd6c9']); }
  for (let k = 0; k < 90; k++) { const x = (r() * 2 - 1) * RX, z = RZ0 + r() * (RZ1 - RZ0); if (distPath(x, z) < 0.9 || inPond(x, z, 0.2)) continue; (k % 3 ? tuft : fl).push([x, 0.04, z, k % 3 ? [0.12, 0.1, 0.12] : 0.07, r() * 3, k % 3 ? '#7cc95a' : ['#ffffff', '#ffd23f', '#ff8fb1', '#b9a6ff'][k % 4]]); }
  const sph = new THREE.SphereGeometry(1, 8, 6);
  world.add(inst(sph, M('#ffffff', { roughness: 0.8 }), peb, false), inst(sph, M('#ffffff'), fl, false), inst(new THREE.ConeGeometry(1, 2.2, 5), M('#ffffff'), tuft, false));
  // the pond: water, rim stones, lily pads, reeds
  const [px, pz, pr] = MAP.pond; pondG = new THREE.Group(); pondG.position.set(px, 0, pz); world.add(pondG);
  const water = new THREE.Mesh(new THREE.CircleGeometry(pr, 40), new THREE.MeshStandardMaterial({ color: '#4fc0ec', roughness: 0.12, metalness: 0.1 })); water.rotation.x = -Math.PI / 2; water.position.y = 0.04; pondG.add(water);
  const rim = [], lily = [], reed = [];
  for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2; rim.push([Math.cos(a) * pr, 0.06, Math.sin(a) * pr, [0.24, 0.13, 0.2], a, k % 2 ? '#b8b2a6' : '#cfc9bc']); }
  for (let k = 0; k < 5; k++) { const a = k * 1.3 + 0.4, d = pr * (0.35 + 0.35 * (k % 2)); lily.push([Math.cos(a) * d, 0.06, Math.sin(a) * d, [0.26, 0.02, 0.26], a, '#5fb04e']); }
  for (let k = 0; k < 7; k++) { const a = Math.PI * (0.9 + k * 0.1); reed.push([Math.cos(a) * (pr + 0.2), 0.45, Math.sin(a) * (pr + 0.2) - 0.05, [0.03, 0.9, 0.03], 0, '#5d9e47']); }
  pondG.add(inst(sph, M('#ffffff', { roughness: 0.8 }), rim), inst(new THREE.CylinderGeometry(1, 1, 1, 14), M('#ffffff'), lily, false), inst(new THREE.CylinderGeometry(1, 1, 1, 5), M('#ffffff'), reed));
  pondG.add(inst(new THREE.CapsuleGeometry(1, 2, 4, 6), M('#8a5a3a'), reed.map(q => [q[0], 0.92, q[2], [0.06, 0.08, 0.06]])));
  // the burrow the slimes pour out of
  const [sx, sz] = MAP.pts[0], ha = P.a[0];
  const mound = new THREE.Mesh(new THREE.SphereGeometry(0.95, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), M('#8b6a49')); mound.scale.set(1.25, 0.75, 1); mound.position.set(sx - Math.sin(ha) * 0.35, 0, sz - Math.cos(ha) * 0.35); mound.rotation.y = ha; mound.castShadow = true; world.add(mound);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), M('#2a1d14')); hole.position.set(sx + Math.sin(ha) * 0.55, 0.36, sz + Math.cos(ha) * 0.55); hole.rotation.set(-0.35, ha, 0, 'YXZ'); world.add(hole);
  // trees all around the plateau
  const tr = [], cn = [];
  for (let k = 0; k < 120 && tr.length < 64; k++) { const x = (r() * 2 - 1) * 15, z = (r() * 2 - 1) * 17; if (Math.abs(x) < RX + 1.1 && z > RZ0 - 1.3 && z < RZ1 + 1.1) continue; if (z > RZ1 && z < RZ1 + 5 && Math.abs(x) < RX + 3) continue; const s = 0.9 + r() * 0.9; tr.push([x, -0.5, z, s, r() * 6]); cn.push([x, -0.5, z, s, r() * 6, ['#5dbb4c', '#4fae45', '#7acb55', '#ffb3c7', '#6cc04f'][k % 5]]); }
  world.add(inst(treeGeo(), VC, tr), inst(canopyGeo(), vcMat({ roughness: 0.8 }), cn));
  // build spots the bot (and the tap helper) can use
  spots.length = 0;
  for (let x = -RX + 0.45; x <= RX - 0.45; x += 0.45) for (let z = RZ0 + 0.5; z <= RZ1 - 0.5; z += 0.45) if (distPath(x, z) > 0.9 && !inPond(x, z, 0.5)) spots.push([x, z]);
  covCache.clear();
  fit();
}

// ================================================================ camera fit (map always fills the space between HUD and shop)
const PITCH = 1.1, camT = new THREE.Vector3(), camPos = new THREE.Vector3(); let shake = 0;
function fit() {
  const W = innerWidth, H = innerHeight, top = 96 / H, bot = (bar ? bar.offsetHeight + 6 : 120) / H;
  const ay0 = -1 + 2 * bot, ay1 = 1 - 2 * top, ax = 1 - 12 / W;
  const cs = [[-RX - 0.3, RZ0 - 1.1], [RX + 0.3, RZ0 - 1.1], [-RX - 0.3, RZ1 + 0.3], [RX + 0.3, RZ1 + 0.3]], v = new THREE.Vector3();
  let D = 28, tz = 0;
  for (let it = 0; it < 40; it++) {
    camera.position.set(0, Math.sin(PITCH) * D, tz + Math.cos(PITCH) * D); camera.lookAt(0, 0, tz); camera.updateMatrixWorld();
    let y0 = 9, y1 = -9, x0 = 9, x1 = -9;
    for (const [x, z] of cs) { v.set(x, 0, z).project(camera); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); }
    const sc = Math.max((y1 - y0) / (ay1 - ay0), (x1 - x0) / (2 * ax));
    D *= Math.pow(sc, 0.7); tz += ((y0 + y1) / 2 - (ay0 + ay1) / 2) * -D * 0.18;
  }
  camT.set(0, 0, tz); camPos.copy(camera.position);
}
addEventListener('resize', () => setTimeout(fit, 30));

// ================================================================ instanced actors
const MAXE = 900, slimeMesh = new THREE.InstancedMesh(slimeGeo(), vcMat({ roughness: 0.22, metalness: 0.05 }), MAXE);
slimeMesh.castShadow = true; slimeMesh.frustumCulled = false; scene.add(slimeMesh);
slimeMesh.setColorAt(0, new THREE.Color('#fff')); slimeMesh.count = 0;
const shellMesh = new THREE.InstancedMesh(shellGeo(), vcMat({ roughness: 0.35, metalness: 0.3 }), 300); shellMesh.castShadow = true; shellMesh.frustumCulled = false; shellMesh.count = 0; scene.add(shellMesh);
const BG = bulkGeo(), bulkMats = [vcMat({ color: '#5a6fa8', roughness: 0.3 }), vcMat({ color: '#ff6fcf', roughness: 0.3 })];
const bulkPool = [];
function bulkObj() {
  let b = bulkPool.find(q => !q.used); if (b) { b.used = true; b.g.visible = true; return b; }
  const g = new THREE.Group(), body = new THREE.Mesh(BG, bulkMats[0]); body.castShadow = true; g.add(body);
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.13), new THREE.MeshBasicMaterial({ color: '#2b2230' })), fg = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.13), new THREE.MeshBasicMaterial({ color: '#7dff8a' }));
  const bar = new THREE.Group(); fg.position.z = 0.01; bar.add(bg, fg); bar.position.y = 1.55; g.add(bar); scene.add(g);
  b = { g, body, bar, fg, used: true }; bulkPool.push(b); return b;
}
const quillMesh = new THREE.InstancedMesh(quillGeo(), VC, 400), beeMesh = new THREE.InstancedMesh(beeGeo(), VC, 300), shotMesh = new THREE.InstancedMesh(shellShotGeo(), VC, 80);
const bubbleMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 14, 10), new THREE.MeshStandardMaterial({ color: '#bdeeff', roughness: 0.05, transparent: true, opacity: 0.75 }), 120);
for (const m of [quillMesh, beeMesh, shotMesh, bubbleMesh]) { m.count = 0; m.frustumCulled = false; scene.add(m); }
// particles (one draw call)
const MAXP = 700, partMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshStandardMaterial({ roughness: 0.5 }), MAXP);
partMesh.frustumCulled = false; partMesh.count = 0; partMesh.setColorAt(0, new THREE.Color()); scene.add(partMesh);
const parts = [];
function spark(x, y, z, color, n = 6, sp = 2.5, up = 2.5, size = 1) {
  const c = new THREE.Color(color);
  for (let i = 0; i < n && parts.length < MAXP; i++) { const a = Math.random() * 6.283; parts.push({ x, y, z, vx: Math.cos(a) * sp * (0.4 + Math.random()), vy: up * (0.5 + Math.random()), vz: Math.sin(a) * sp * (0.4 + Math.random()), life: 0.5 + Math.random() * 0.4, c, s: size * (0.6 + Math.random() * 0.8), r: Math.random() * 3 }); }
}
// rings (splash), beams (owl) and the range / select indicators
const rings = [], ringGeo = new THREE.RingGeometry(0.86, 1, 40);
function ring(x, z, r, color = '#ffffff') {
  let o = rings.find(q => q.t <= 0); if (!o) { o = { m: new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })), t: 0 }; o.m.rotation.x = -Math.PI / 2; scene.add(o.m); rings.push(o); }
  o.m.material.color.set(color); o.m.position.set(x, 0.08, z); o.r = r; o.t = 1; o.m.visible = true;
}
const beams = [], beamGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 6); beamGeo.translate(0, 0.5, 0); beamGeo.rotateX(Math.PI / 2);
function beam(x0, y0, z0, x1, y1, z1) {
  let o = beams.find(q => q.t <= 0); if (!o) { o = { m: new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: '#fff6b0', transparent: true })), t: 0 }; scene.add(o.m); beams.push(o); }
  o.m.position.set(x0, y0, z0); o.m.lookAt(x1, y1, z1); o.m.scale.set(1, 1, Math.hypot(x1 - x0, y1 - y0, z1 - z0)); o.t = 1; o.m.visible = true;
}
const rangeG = new THREE.Group(), rangeFill = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.16, depthWrite: false })), rangeLine = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 64), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false }));
rangeG.add(rangeFill, rangeLine); rangeG.rotation.x = -Math.PI / 2; rangeG.position.y = 0.05; rangeG.visible = false; scene.add(rangeG);
const ghostMat = vcMat({ transparent: true, opacity: 0.6 }); let ghost = null;

// ================================================================ HUD + shop (DOM)
const css = document.createElement('style'); css.textContent = `
.pg-hud{position:fixed;top:calc(56px + env(safe-area-inset-top));left:0;right:0;display:flex;justify-content:center;gap:8px;z-index:5;pointer-events:none}
.pg-chip{background:rgba(22,44,30,.62);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);border-radius:14px;padding:2px 11px;font-weight:800;font-size:18px;display:flex;gap:5px;align-items:center;box-shadow:0 3px 0 rgba(0,0,0,.12)}
.pg-chip.bump{animation:pgb .25s}@keyframes pgb{50%{transform:scale(1.18)}}
.pg-tr{position:fixed;top:calc(10px + env(safe-area-inset-top));right:10px;display:flex;gap:6px;z-index:7}
.pg-ib{width:40px;height:40px;border-radius:50%;border:0;background:rgba(22,44,30,.62);color:#fff;font-size:18px;cursor:pointer;display:grid;place-items:center;backdrop-filter:blur(5px)}
.pg-bar{position:fixed;left:0;right:0;bottom:0;z-index:8;display:flex;justify-content:center;padding:10px 6px calc(10px + env(safe-area-inset-bottom));background:linear-gradient(to top,rgba(26,48,30,.88) 55%,rgba(26,48,30,0))}
.pg-row{display:flex;gap:5px;align-items:flex-end;max-width:520px;width:100%;justify-content:center}
.pg-card{flex:0 1 56px;min-width:0;height:84px;border-radius:15px;background:#fff8e8;box-shadow:0 4px 0 rgba(0,0,0,.28);display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:4px;color:#3a2e39;font-weight:800;font-size:15px;line-height:1;cursor:pointer;position:relative;border:3px solid transparent;transition:transform .12s}
.pg-card canvas{width:46px;height:46px;margin-bottom:4px}
.pg-card.sel{border-color:#ffd23f;transform:translateY(-8px)}
.pg-card.poor b{color:#d64550}.pg-card.lock{background:#d9d4c9}.pg-card.lock canvas{filter:grayscale(1) opacity(.45)}
.pg-card small{position:absolute;top:30px;left:0;right:0;font-size:12px;color:#5c5360}
.pg-go{flex:0 0 68px;height:68px;margin-left:2px;border-radius:50%;border:0;background:#ff8c42;color:#fff;font:800 26px/1 'Baloo 2',system-ui;box-shadow:0 5px 0 rgba(0,0,0,.25);cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center}
.pg-go small{font-size:12px;margin-top:2px}.pg-go.run{background:#3a86ff}
.pg-up{position:fixed;left:0;right:0;bottom:0;z-index:9;display:flex;justify-content:center;padding:8px 8px calc(10px + env(safe-area-inset-bottom));background:rgba(26,48,30,.94)}
.pg-up[hidden]{display:none}.pg-up>div{max-width:520px;width:100%}
.pg-uh{display:flex;align-items:center;gap:6px;margin-bottom:6px;font-weight:800;font-size:18px}
.pg-uh .nm{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pg-sb{border:0;border-radius:12px;font:800 14px/1 'Baloo 2',system-ui;padding:8px 10px;cursor:pointer;color:#fff;background:rgba(255,255,255,.16)}
.pg-sb.sell{background:#d64550}
.pg-paths{display:flex;gap:6px}
.pg-path{flex:1;border:0;border-radius:14px;background:#fff8e8;color:#3a2e39;padding:7px 8px;text-align:left;font:800 15px/1.15 'Baloo 2',system-ui;cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.25);min-height:62px}
.pg-path i{font-style:normal;font-size:12px;color:#7a6f7c;display:block}.pg-path b{color:#2a9d6f}.pg-path.poor b{color:#d64550}.pg-path.max{opacity:.55}
.pg-pips{float:right;letter-spacing:1px}
.pg-red{position:fixed;inset:0;pointer-events:none;z-index:4;box-shadow:inset 0 0 90px 30px rgba(255,40,60,.75);opacity:0;transition:opacity .35s}
.pg-banner{position:fixed;left:0;right:0;top:34%;text-align:center;font-weight:800;font-size:40px;line-height:1;pointer-events:none;z-index:6;text-shadow:0 4px 0 rgba(0,0,0,.2);opacity:0;transition:opacity .3s,transform .3s;transform:scale(.8)}
.pg-banner.on{opacity:1;transform:scale(1)}.pg-banner small{display:block;font-size:20px;margin-top:6px}
.pg-tip{position:fixed;left:0;right:0;bottom:calc(118px + env(safe-area-inset-bottom));text-align:center;z-index:7;pointer-events:none;font-weight:800;font-size:18px;text-shadow:0 2px 0 rgba(0,0,0,.25);animation:hcpulse 1.2s ease-in-out infinite}
.pg-maps{display:flex;flex-direction:column;gap:8px;margin-top:14px;width:min(320px,86vw)}
.pg-map{border:0;border-radius:16px;background:rgba(255,255,255,.92);color:#2c3b2c;font:800 18px/1.1 'Baloo 2',system-ui;padding:9px 14px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.2)}
.pg-map span{white-space:nowrap}.pg-map small{font-size:13px;color:#6d7a6a;font-weight:600;text-align:right;max-width:52%}.pg-map.sel{background:#ffd23f}.pg-map.lock{opacity:.6}
.pg-sub2{font-size:15px!important;opacity:.95}
.pg-mini{border:0;border-radius:14px;background:rgba(255,255,255,.25);color:#fff;font:800 15px/1 'Baloo 2',system-ui;padding:8px 14px;cursor:pointer;margin-top:4px}
.hc-card{background:linear-gradient(rgba(18,44,26,.55),rgba(18,44,26,.15) 60%,rgba(18,44,26,.45))}
`; document.head.appendChild(css);
const hud = $(`<div class="pg-hud"><div class="pg-chip" data-l>❤️ <span>150</span></div><div class="pg-chip" data-c>🪙 <span>650</span></div></div>`);
const tr = $(`<div class="pg-tr"><button class="pg-ib" data-mute>🔊</button></div>`);
const bar = $(`<div class="pg-bar"><div class="pg-row"></div></div>`);
const upEl = $(`<div class="pg-up" hidden><div></div></div>`);
const tip = $(`<div class="pg-tip" hidden>Drag a critter onto the grass, then press ▶</div>`), red = $(`<div class="pg-red"></div>`), banner = $(`<div class="pg-banner"></div>`);
document.body.append(hud, tr, bar, upEl, red, banner, tip);
for (const el of [hud, tr, bar, upEl]) el.addEventListener('pointerdown', e => e.stopPropagation());
const cards = {};
for (const type of ORDER) {
  const c = $(`<div class="pg-card" data-t="${type}"><small></small><b>${TW[type].cost}</b></div>`); c.prepend(icon(type));
  c.addEventListener('pointerdown', e => { e.stopPropagation(); if (state !== 'play') return; if (!towerOpen(type)) { pop(`Reach round ${TW[type].unlock} to unlock`, '#fff', 22); return; } select(null); setPlacing(placing === type && !dragging ? null : type); dragging = { x: e.clientX, y: e.clientY, type: e.pointerType }; });
  bar.firstChild.appendChild(c); cards[type] = c;
}
const go = $(`<button class="pg-go">▶<small>Round 1</small></button>`); bar.firstChild.appendChild(go);
go.addEventListener('click', e => { e.stopPropagation(); if (state !== 'play') return; if (!inRound) startRound(); else setSpeed(gs === 1 ? 2 : gs === 2 ? 3 : 1); });
let muted = S.get('muted', false);
tr.querySelector('[data-mute]').onclick = e => { e.stopPropagation(); muted = !muted; S.set('muted', muted); paintMute(); };
const paintMute = () => tr.querySelector('[data-mute]').textContent = muted ? '🔇' : '🔊'; paintMute();
const pop = (t, c = '#fff', s = 30, top = 24) => ui.pop(t, c, s, top);
function bump(k) { const el = hud.querySelector(k); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
let bannerT = 0;
function showBanner(h, ms = 1400) { banner.innerHTML = h; banner.classList.add('on'); clearTimeout(bannerT); bannerT = setTimeout(() => banner.classList.remove('on'), ms); }

// ================================================================ run state
let state = 'ready', round = 0, inRound = false, spawnQ = [], qi = 0, roundT = 0, coins = 650, lives = 150, gs = 1, roundsDone = 0;
let towers = [], en = [], runT0 = 0, recorded = false, baseSeed = 1, roundTot = 1, roundDone = 0, beatenShown = false, eid = 0, autoNext = false;
const proj = { quill: [], bubble: [], bee: [], shell: [] };
let placing = null, dragging = null, selected = null;

function paintHud() {
  hud.querySelector('[data-l] span').textContent = Math.max(0, Math.ceil(lives));
  hud.querySelector('[data-c] span').textContent = Math.floor(coins);
  for (const type of ORDER) { const c = cards[type], open = towerOpen(type); c.classList.toggle('lock', !open); c.classList.toggle('poor', open && coins < TW[type].cost); c.querySelector('small').textContent = open ? '' : '🔒 R' + TW[type].unlock; c.classList.toggle('sel', placing === type); }
  go.classList.toggle('run', inRound);
  go.innerHTML = inRound ? `${gs === 1 ? '▶' : gs === 2 ? '▶▶' : '▶▶▶'}<small>Speed ×${gs}</small>` : `▶<small>Round ${round + 1}</small>`;
  if (selected) paintUp();
  tip.hidden = !(state === 'play' && !selected && (towers.length === 0 || (round === 0 && !inRound)));
  tip.textContent = towers.length ? 'Press ▶ to send the goo' : 'Drag a critter onto the grass';
}
function setSpeed(s) { gs = s; paintHud(); sfx.tap(); }

function newRun(cont = null) {
  for (const t of towers) scene.remove(t.mesh);
  towers = []; en = []; for (const k in proj) proj[k].length = 0; parts.length = 0;
  baseSeed = D.seed ? D.seed : 1000 + mapI * 31;
  buildMap(mapI);
  round = 0; roundsDone = 0; inRound = false; coins = 650; lives = MAP.lives; gs = Math.min(gs, 3) || 1; recorded = false; beatenShown = false;
  if (cont) {
    round = roundsDone = cont.round; coins = cont.coins; lives = cont.lives;
    for (const q of cont.towers) addTower(q.type, q.x, q.z, q);
  }
  runT0 = performance.now(); placing = null; select(null); setPlacing(null);
  ui.levels(round + 1); ui.progress(0); paintHud(); B.start();
  state = 'play';
  if (!cont) showBanner(`${MAP.name}<small>${MAP.diff} · ${lives} lives</small>`, 2000);
}
function saveRun() { if (D.seed) return; S.set('run', { map: mapI, round: roundsDone, coins: Math.floor(coins), lives: Math.ceil(lives), towers: towers.map(t => ({ type: t.type, x: t.x, z: t.z, a: t.a, b: t.b, mode: t.mode, spent: t.spent })) }); }

function startRound() {
  if (inRound || state !== 'play') return;
  round++; inRound = true; qi = 0; roundT = 0;
  spawnQ = roundSpawns(round, rng(baseSeed * 97 + round * 7919), F.k());
  roundTot = spawnQ.reduce((s, q) => s + (q.bulk === 2 ? GIANT_HP + 3 * BULK_RBE : q.bulk ? BULK_RBE : rbe(q.tier) + (q.shell ? 4 : 0)), 0); roundDone = 0;
  ui.levels(round); ui.progress(0); paintHud(); sfx.tap(); tone(330, 0.12, 'triangle', 0.1, 1.5);
  if (round % 10 === 0 || spawnQ.some(q => q.bulk)) showBanner(round === ROUNDS ? 'THE GOO GIANT!<small>Final round</small>' : spawnQ.some(q => q.bulk) ? `ROUND ${round}<small>A Bulk Blob is coming!</small>` : `ROUND ${round}`, 1500);
}
function endRound() {
  inRound = false; roundsDone = round;
  const bonus = 100 + round * 2; coins += bonus; bump('[data-c]'); sfx.coin();
  ui.progress(1); B.submit(roundsDone, { ms: performance.now() - runT0 });
  if (round > reach) { const was = reach; reach = round; S.set('reach', reach); for (const t of ORDER) if (TW[t].unlock && was < TW[t].unlock && reach >= TW[t].unlock) setTimeout(() => showBanner(`NEW CRITTER!<small>${TW[t].name} unlocked</small>`, 2200), 900); }
  if (!D.seed && roundsDone > best[mapI]) { best[mapI] = roundsDone; S.set('best', best); for (let i = 1; i < 3; i++) if (best[i - 1] === UNLOCK[i] && roundsDone === UNLOCK[i] && i - 1 === mapI) setTimeout(() => showBanner(`NEW MAP!<small>${MAPS[i].name} unlocked</small>`, 2200), 1700); }
  if (!beatenShown && D.beaten(roundsDone)) { beatenShown = true; pop('BEATEN!', '#ffd23f', 44); confetti(scene, new THREE.Vector3(0, 1, 0), 60); }
  if (round >= ROUNDS) return winRun();
  saveRun();
  pop(`ROUND ${round} CLEARED  +${bonus} 🪙`, '#ffe066', 26, 30);
  ui.levels(round + 1); ui.progress(0); paintHud();
  if (autoNext) setTimeout(startRound, 900);
}
function winRun() {
  state = 'won'; sfx.win(); buzz([30, 40, 60]); confetti(scene, new THREE.Vector3(MAP.pond[0], 1, MAP.pond[1]), 120);
  if (!recorded) { recorded = true; F.level(true); B.submit(ROUNDS, { ms: performance.now() - runT0 }); }
  S.set('run', null); D.won(ROUNDS, 'held all 40 rounds on ' + MAP.name + ' and scored');
  ui.els.win.children[0].innerHTML = `ROUND <span data-l>40</span>`;
  ui.win(ROUNDS, `${MAP.name} is safe! ${Math.ceil(lives)} lives left`);
}
function loseRun() {
  if (state !== 'play') return;
  state = 'lost'; inRound = false; sfx.fail(); buzz([60, 40, 120]); shake = 0.6;
  if (!recorded) { recorded = true; F.level(false, roundsDone / ROUNDS); B.submit(roundsDone, { ms: performance.now() - runT0 }); }
  if (!D.seed) S.set('run', null);
  ui.lose('OVERRUN!', `${MAP.name}: survived ${roundsDone} round${roundsDone === 1 ? '' : 's'} · best ${Math.max(best[mapI], roundsDone)}`);
}

// ================================================================ towers: place, select, upgrade, sell
function addTower(type, x, z, q = {}) {
  const t = { type, x, z, a: q.a || 0, b: q.b || 0, mode: q.mode || 'first', spent: q.spent || TW[type].cost, cd: 0.2, yaw: 0, recoil: 0, pops: 0, mesh: null, born: 0 };
  t.st = statsOf(t); remesh(t); towers.push(t); return t;
}
function remesh(t) {
  if (t.mesh) scene.remove(t.mesh);
  t.mesh = new THREE.Mesh(towerGeo(t.type, t.a, t.b), VC); t.mesh.userData.k = 1.22; t.mesh.castShadow = true; t.mesh.position.set(t.x, 0, t.z); t.mesh.rotation.y = t.yaw; scene.add(t.mesh); t.born = 1;
}
function validSpot(x, z, ignore = null) {
  if (Math.abs(x) > RX - 0.35 || z < RZ0 + 0.35 || z > RZ1 - 0.35) return false;
  if (distPath(x, z) < 0.95 || inPond(x, z, 0.5)) return false;
  for (const t of towers) if (t !== ignore && Math.hypot(t.x - x, t.z - z) < 0.98) return false;
  return true;
}
function place(type, x, z) {
  if (!towerOpen(type) || coins < TW[type].cost || !validSpot(x, z)) return null;
  coins -= TW[type].cost; const t = addTower(type, x, z); t.yaw = Math.atan2(-x, -z) || 0;
  spark(x, 0.3, z, ['#fff8e8', '#9ddb78'], 1); for (let i = 0; i < 3; i++) spark(x, 0.2, z, '#e9dcc0', 6, 2, 2);
  ring(x, z, 1.2, '#ffffff'); tone(440, 0.08, 'triangle', 0.14, 1.6); setTimeout(() => tone(660, 0.1, 'triangle', 0.12, 1.2), 70); buzz(15);
  paintHud(); return t;
}
function setPlacing(type) {
  placing = type; if (ghost) { scene.remove(ghost); ghost = null; }
  if (type) { ghost = new THREE.Mesh(towerGeo(type), ghostMat); ghost.scale.setScalar(1.22); ghost.visible = false; scene.add(ghost); rangeG.visible = false; }
  else if (!selected) rangeG.visible = false;
  paintHud();
}
function select(t) {
  selected = t; upEl.hidden = !t; bar.style.visibility = t ? 'hidden' : '';
  if (t) { paintUp(); showRange(t.x, t.z, t.st.range, true); sfx.tap(); } else if (!placing) rangeG.visible = false;
}
function showRange(x, z, r, ok) { rangeG.visible = true; rangeG.position.set(x, 0.05, z); const rr = Math.min(r, 14); rangeG.scale.set(rr, rr, 1); rangeFill.material.color.set(ok ? '#ffffff' : '#ff4d5e'); rangeLine.material.color.set(ok ? '#ffffff' : '#ff4d5e'); }
const MODES = { first: 'First', strong: 'Strong', close: 'Close' };
function paintUp() {
  const t = selected, d = TW[t.type], wrap = upEl.firstChild;
  const path = p => { const n = p === 'A' ? t.a : t.b, ok = canUp(t, p), up = n < 3 ? d[p][n] : null;
    const pips = [0, 1, 2].map(i => i < n ? '●' : '○').join('');
    if (!up) return `<button class="pg-path max" data-p="${p}"><span class="pg-pips">${pips}</span>${d[p][2][0]}<i>Fully upgraded</i></button>`;
    if (!ok) return `<button class="pg-path max" data-p="${p}"><span class="pg-pips">${pips}</span>${up[0]}<i>Other path is maxed</i></button>`;
    return `<button class="pg-path ${coins < up[1] ? 'poor' : ''}" data-p="${p}"><span class="pg-pips">${pips}</span>${up[0]}<i>${up[3]} · <b>🪙 ${up[1]}</b></i></button>`; };
  wrap.innerHTML = `<div class="pg-uh"><span class="nm">${d.name} <small style="opacity:.7;font-size:13px">· ${t.pops} pops</small></span><button class="pg-sb" data-m>🎯 ${MODES[t.mode]}</button><button class="pg-sb sell" data-s>Sell ${Math.floor(t.spent * 0.7)}</button><button class="pg-sb" data-x>✕</button></div><div class="pg-paths">${path('A')}${path('B')}</div>`;
  wrap.querySelector('[data-x]').onclick = () => select(null);
  wrap.querySelector('[data-m]').onclick = () => { t.mode = t.mode === 'first' ? 'strong' : t.mode === 'strong' ? 'close' : 'first'; paintUp(); sfx.tap(); };
  wrap.querySelector('[data-s]').onclick = () => sell(t);
  wrap.querySelectorAll('[data-p]').forEach(b => b.onclick = () => upgrade(t, b.dataset.p));
}
function upgrade(t, p) {
  if (!canUp(t, p) || state !== 'play') return false; const c = upCost(t, p); if (coins < c) { tone(160, 0.12, 'square', 0.06); return false; }
  coins -= c; t.spent += c; if (p === 'A') t.a++; else t.b++; t.st = statsOf(t); remesh(t);
  spark(t.x, 0.6, t.z, p === 'A' ? '#ffcf33' : '#2ec4b6', 18, 2.2, 3.5); ring(t.x, t.z, 1, p === 'A' ? '#ffcf33' : '#2ec4b6');
  [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.1, 'triangle', 0.12, 1), i * 60)); buzz(20);
  if (selected === t) { showRange(t.x, t.z, t.st.range, true); paintUp(); } paintHud(); return true;
}
function sell(t) {
  coins += Math.floor(t.spent * 0.7); scene.remove(t.mesh); towers = towers.filter(q => q !== t); spark(t.x, 0.4, t.z, '#e9dcc0', 14); sfx.coin(); select(null); paintHud();
}

// ================================================================ pointer: drag a critter from the shop, or tap a card then the grass
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ndc = new THREE.Vector2(), hit = new THREE.Vector3();
function ground(cx, cy) { ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.ray.intersectPlane(plane, hit) ? hit : null; }
let downAt = null;
function ghostAt(cx, cy, lift) {
  if (!ghost) return null; const g = ground(cx, cy - lift); if (!g) { ghost.visible = false; return null; }
  const ok = validSpot(g.x, g.z) && coins >= TW[placing].cost; ghost.visible = true; ghost.position.set(g.x, 0, g.z); ghostMat.color.set(ok ? '#ffffff' : '#ff8a8a');
  showRange(g.x, g.z, statsOf({ type: placing, a: 0, b: 0 }).range, ok); return { x: g.x, z: g.z, ok };
}
addEventListener('pointerdown', e => { if (e.target !== renderer.domElement) return; downAt = { x: e.clientX, y: e.clientY }; if (placing) ghostAt(e.clientX, e.clientY, e.pointerType === 'touch' ? 40 : 0); });
addEventListener('pointermove', e => {
  if (!placing) return;
  if (dragging) { const far = Math.hypot(e.clientX - dragging.x, e.clientY - dragging.y) > 24; if (far) dragging.moved = true; if (dragging.moved) ghostAt(e.clientX, e.clientY, e.pointerType === 'touch' ? 60 : 0); }
  else if (e.target === renderer.domElement && (e.pointerType === 'mouse' || downAt)) ghostAt(e.clientX, e.clientY, e.pointerType === 'touch' ? 40 : 0);
});
addEventListener('pointerup', e => {
  if (state !== 'play') { dragging = null; downAt = null; return; }
  if (dragging) {
    const d = dragging; dragging = null;
    if (d.moved && document.elementFromPoint(e.clientX, e.clientY) === renderer.domElement) { const g = ghostAt(e.clientX, e.clientY, e.pointerType === 'touch' ? 60 : 0); if (g && g.ok) { place(placing, g.x, g.z); setPlacing(null); } else if (g) { tone(160, 0.12, 'square', 0.06); } }
    return;
  }
  if (!downAt || e.target !== renderer.domElement) { downAt = null; return; }
  const tap = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 14; downAt = null;
  if (placing) { const g = ghostAt(e.clientX, e.clientY, e.pointerType === 'touch' ? 40 : 0); if (g && g.ok) { place(placing, g.x, g.z); setPlacing(null); } else if (g && tap) { tone(160, 0.12, 'square', 0.06); pop(coins < TW[placing].cost ? 'Not enough coins' : 'Not on the path!', '#fff', 22, 30); } return; }
  if (!tap) return;
  const g = ground(e.clientX, e.clientY); if (!g) return;
  let bt = null, bd = 0.6; for (const t of towers) { const d = Math.hypot(t.x - g.x, t.z - g.z); if (d < bd) { bd = d; bt = t; } }
  select(bt);
});
addEventListener('keydown', e => {
  if (state !== 'play') return;
  const i = '12345'.indexOf(e.key); if (i >= 0 && towerOpen(ORDER[i])) { select(null); setPlacing(ORDER[i]); }
  if (e.key === ' ') { e.preventDefault(); go.click(); }
  if (e.key === 'Escape') { setPlacing(null); select(null); }
});

// ================================================================ slimes
const pathX = (s) => { const f = clamp(s / 0.1, 0, P.x.length - 1), i = Math.floor(f), j = Math.min(P.x.length - 1, i + 1), u = f - i; return [P.x[i] + (P.x[j] - P.x[i]) * u, P.z[i] + (P.z[j] - P.z[i]) * u, P.a[i]]; };
function spawn(q) {
  const e = { id: ++eid, s: 0, tier: q.tier, shell: q.shell ? 4 : 0, bulk: q.bulk, hp: q.bulk === 2 ? GIANT_HP : q.bulk ? BULK_HP : 0, off: (Math.random() - 0.5) * 0.36, slowT: 0, slowF: 0, dead: false, x: 0, z: 0, flash: 0, ph: Math.random() * 6, obj: null };
  if (e.bulk) { e.obj = bulkObj(); e.obj.body.material = bulkMats[e.bulk - 1]; e.obj.g.scale.setScalar(e.bulk === 2 ? 1.75 : 1.1); e.max = e.hp; }
  setXZ(e); en.push(e); return e;
}
function setXZ(e) { const [x, z, a] = pathX(e.s); e.x = x + Math.cos(a) * e.off; e.z = z - Math.sin(a) * e.off; e.a = a; }
const speedOf = (e) => (e.bulk === 2 ? 0.62 : e.bulk ? 1.0 : TIER_SPD[e.tier] * (e.shell ? 0.8 : 1)) * (e.slowT > 0 ? 1 - e.slowF : 1);
function child(p, tier, back) { const e = spawn({ tier, shell: false, bulk: 0 }); e.s = Math.max(0, p.s - back); e.off = clamp(p.off + (Math.random() - 0.5) * 0.3, -0.3, 0.3); e.slowT = p.slowT; e.slowF = p.slowF; setXZ(e); return e; }
let popSnd = 0;
function popFx(e, tier, n) {
  const sz = TIER_SIZE[tier] || 0.6; spark(e.x, 0.35, e.z, tier === 7 ? ['#ff4d5e', '#ffd23f', '#3fa7ff'][n % 3] : TIER_COL[tier], 3 + Math.min(4, n), 2.2, 2.4, sz * 1.1);
  const now = performance.now(); if (now - popSnd > 38 && !muted) { popSnd = now; tone(520 + tier * 70 + Math.random() * 60, 0.05, 'sine', 0.07, 1.8); }
}
/** returns layers popped */
function damage(e, dmg, st) {
  if (e.dead || dmg <= 0) return 0;
  if (e.bulk) {
    const d = Math.min(e.hp, dmg * (st.bulkX || 1)); e.hp -= d; e.flash = 1; roundDone += d;
    if (e.hp <= 0) {
      e.dead = true; e.obj.used = false; e.obj.g.visible = false; coins += e.bulk === 2 ? 300 : 40; bump('[data-c]');
      spark(e.x, 0.8, e.z, ['#5a6fa8', '#d9dde6', '#ffffff'], 40, 4, 4, 2); ring(e.x, e.z, 2.2, '#ffffff'); sfx.smash(); shake = Math.max(shake, 0.35); buzz(40);
      if (e.bulk === 2) for (let i = 0; i < 3; i++) { const c = spawn({ tier: 0, shell: false, bulk: 1 }); c.s = Math.max(0, e.s - i * 0.6); setXZ(c); }
      else for (let i = 0; i < 4; i++) child(e, 7, i * 0.22);
      pop(e.bulk === 2 ? 'GIANT POPPED!' : 'BULK POPPED!', '#ffd23f', 34, 26);
    }
    return d;
  }
  if (e.shell > 0) {
    if (!st.shells) { if (performance.now() - popSnd > 60 && !muted) { popSnd = performance.now(); tone(1400, 0.03, 'square', 0.04, 0.9); } spark(e.x, 0.6, e.z, '#e6e9ef', 2, 1.5, 1.5, 0.6); return -1; }
    const d = Math.min(e.shell, dmg); e.shell -= d; roundDone += d; e.flash = 1;
    if (e.shell <= 0) { spark(e.x, 0.6, e.z, ['#a2a9b4', '#6f7784'], 12, 2.5, 3); tone(300, 0.08, 'square', 0.08, 0.6); }
    return d;
  }
  let popped = 0;
  while (dmg > 0 && !e.dead) {
    const t = e.tier;
    if (t >= 6) { e.tier = t - 1; child(e, t - 1, 0.2); dmg--; popped++; popFx(e, t, popped); }
    else { const p = Math.min(dmg, t); e.tier -= p; dmg -= p; popped += p; popFx(e, t, p); if (e.tier <= 0) e.dead = true; }
  }
  coins += popped; roundDone += popped; return popped;
}
function leak(e) {
  e.dead = true; let cost;
  if (e.bulk) { cost = e.bulk === 2 ? lives : e.hp + 4 * rbe(7); e.obj.used = false; e.obj.g.visible = false; }
  else cost = rbe(e.tier) + e.shell;
  roundDone += cost; lives -= cost; bump('[data-l]');
  spark(MAP.pond[0], 0.2, MAP.pond[1], ['#bdeeff', '#4fc0ec', e.bulk ? '#5a6fa8' : TIER_COL[e.tier] || '#fff'], 10, 2.5, 3);
  red.style.opacity = 1; setTimeout(() => red.style.opacity = 0, 160); shake = Math.max(shake, 0.25); buzz(30);
  if (!muted) tone(180, 0.15, 'sawtooth', 0.08, 0.5);
  if (lives <= 0) { lives = 0; paintHud(); loseRun(); }
}

// ================================================================ targeting + shooting
function targets(t, n) {
  const st = t.st, r2 = st.range * st.range, out = [];
  for (const e of en) {
    if (e.dead || e.s < 0.4) continue;
    const dx = e.x - t.x, dz = e.z - t.z, d2 = dx * dx + dz * dz; if (d2 > r2) continue;
    if (e.shell > 0 && !st.shells) continue;
    const v = t.mode === 'first' ? e.s : t.mode === 'close' ? -d2 : (e.bulk ? 1e5 + e.hp : rbe(e.tier) * 10 + e.shell * 10 + e.s * 0.01);
    if (out.length < n) { out.push([v, e]); out.sort((a, b) => b[0] - a[0]); }
    else if (v > out[n - 1][0]) { out[n - 1] = [v, e]; out.sort((a, b) => b[0] - a[0]); }
  }
  return out.map(q => q[1]);
}
function lead(e, tt) { const [x, z, a] = pathX(e.s + speedOf(e) * tt); return [x + Math.cos(a) * e.off, z - Math.sin(a) * e.off]; }
function fire(t) {
  const st = t.st, d = TW[t.type], list = targets(t, st.multi); if (!list.length) return false;
  const e0 = list[0]; t.yaw = Math.atan2(e0.x - t.x, e0.z - t.z); t.recoil = 1;
  for (const e of list) {
    if (d.proj === 'quill') {
      const dist = Math.hypot(e.x - t.x, e.z - t.z), [lx, lz] = lead(e, dist / 15), base = Math.atan2(lx - t.x, lz - t.z);
      for (let k = 0; k < st.spread; k++) { const a = base + (k - (st.spread - 1) / 2) * 0.22; proj.quill.push({ x: t.x + Math.sin(a) * 0.3, z: t.z + Math.cos(a) * 0.3, vx: Math.sin(a) * 15, vz: Math.cos(a) * 15, a, life: (st.range + 1.2) / 15, pierce: st.pierce, hit: new Set(), t }); }
      if (!muted && Math.random() < 0.6) tone(900, 0.03, 'triangle', 0.04, 0.7);
    } else if (d.proj === 'bubble' || d.proj === 'shell') {
      const T = d.proj === 'bubble' ? 0.42 : 0.75, [lx, lz] = lead(e, T);
      proj[d.proj].push({ x0: t.x, z0: t.z, x1: lx, z1: lz, t: 0, T, h: d.proj === 'bubble' ? 1.3 : 3.2, tw: t });
      if (!muted) tone(d.proj === 'bubble' ? 300 : 140, 0.1, d.proj === 'bubble' ? 'sine' : 'square', 0.08, d.proj === 'bubble' ? 2 : 0.6);
    } else if (d.proj === 'bee') {
      proj.bee.push({ x: t.x, y: 0.95, z: t.z, tg: e, life: 3, pierce: st.pierce, hit: new Set(), tw: t, a: 0, ph: Math.random() * 6 });
    } else if (d.proj === 'beam') {
      beam(t.x, 0.82, t.z, e.x, 0.35, e.z); const p = damage(e, st.dmg, st); if (p > 0) t.pops += p; spark(e.x, 0.4, e.z, '#fff6b0', 4, 1.5, 1.5);
      if (!muted) tone(1200, 0.06, 'sine', 0.06, 0.5);
    }
  }
  return true;
}
function splash(x, z, st, tw, color) {
  ring(x, z, st.splash, color); let n = st.pierce;
  for (const e of en) { if (n <= 0) break; if (e.dead) continue; const r = st.splash + (e.bulk ? 0.6 : 0.25); if ((e.x - x) ** 2 + (e.z - z) ** 2 > r * r) continue;
    const p = damage(e, st.dmg, st); if (p > 0) tw.pops += p; if (st.slow && !e.bulk) { e.slowT = 1.6; e.slowF = st.slow; } n--; }
}
function stepProj(h) {
  const Q = proj.quill;
  for (let i = Q.length - 1; i >= 0; i--) {
    const q = Q[i]; q.x += q.vx * h; q.z += q.vz * h; q.life -= h;
    for (const e of en) {
      if (e.dead || q.hit.has(e.id)) continue; const r = e.bulk ? 0.75 : 0.34;
      if ((e.x - q.x) ** 2 + (e.z - q.z) ** 2 < r * r) { q.hit.add(e.id); const p = damage(e, q.t.st.dmg, q.t.st); if (p > 0) q.t.pops += p; q.pierce--; if (p < 0) q.pierce = 0; if (q.pierce <= 0) break; }
    }
    if (q.pierce <= 0 || q.life <= 0) Q.splice(i, 1);
  }
  for (const k of ['bubble', 'shell']) {
    const L = proj[k];
    for (let i = L.length - 1; i >= 0; i--) { const q = L[i]; q.t += h; if (q.t >= q.T) { splash(q.x1, q.z1, q.tw.st, q.tw, k === 'bubble' ? '#bdeeff' : '#ffb98a'); if (k === 'shell') { spark(q.x1, 0.2, q.z1, ['#c9b79c', '#8b6a49'], 10, 2.5, 3); if (!muted) tone(90, 0.18, 'square', 0.09, 0.5); shake = Math.max(shake, 0.08); } else { spark(q.x1, 0.3, q.z1, ['#ffffff', '#bdeeff'], 8, 2.5, 2); if (!muted) tone(700, 0.06, 'sine', 0.06, 0.4); } L.splice(i, 1); } }
  }
  const Bs = proj.bee;
  for (let i = Bs.length - 1; i >= 0; i--) {
    const b = Bs[i]; b.life -= h;
    if (!b.tg || b.tg.dead) { b.tg = null; let bd = 2.8 * 2.8; for (const e of en) { if (e.dead || b.hit.has(e.id) || (e.shell > 0 && !b.tw.st.shells)) continue; const d = (e.x - b.x) ** 2 + (e.z - b.z) ** 2; if (d < bd) { bd = d; b.tg = e; } } }
    if (!b.tg) { if (b.life < 2.6) { Bs.splice(i, 1); continue; } b.z += h; continue; }
    const dx = b.tg.x - b.x, dz = b.tg.z - b.z, dy = 0.45 - b.y, d = Math.hypot(dx, dz) || 1, sp = 8;
    b.a = Math.atan2(dx, dz); b.x += dx / d * sp * h; b.z += dz / d * sp * h; b.y += dy * Math.min(1, h * 6);
    if (d < 0.3) { b.hit.add(b.tg.id); const p = damage(b.tg, b.tw.st.dmg, b.tw.st); if (p > 0) b.tw.pops += p; if (b.tw.st.slow && !b.tg.bulk) { b.tg.slowT = 1; b.tg.slowF = b.tw.st.slow; } b.pierce--; b.tg = null; if (b.pierce <= 0 || p < 0) { Bs.splice(i, 1); continue; } }
    if (b.life <= 0) Bs.splice(i, 1);
  }
}

// ================================================================ simulation step (seconds)
function step(h) {
  if (inRound) { roundT += h; while (qi < spawnQ.length && spawnQ[qi].t <= roundT) spawn(spawnQ[qi++]); }
  for (const e of en) { if (e.dead) continue; e.slowT -= h; e.s += speedOf(e) * h; if (e.s >= P.len) { leak(e); if (state !== 'play') return; continue; } setXZ(e); }
  for (const t of towers) { t.cd -= h; if (t.cd <= 0) t.cd = fire(t) ? 1 / t.st.rate : 0.06; }
  stepProj(h);
  let j = 0; for (let i = 0; i < en.length; i++) if (!en[i].dead) en[j++] = en[i]; en.length = j;
  if (inRound) { ui.progress(roundDone / Math.max(1, roundTot)); if (qi >= spawnQ.length && en.length === 0) endRound(); }
}

// ================================================================ render
const O = new THREE.Object3D(), COL = new THREE.Color(), camQ = new THREE.Quaternion();
let clock = 0, hudT = 0;
function render(dt, T) {
  // slimes
  let n = 0, sn = 0;
  for (const e of en) {
    if (e.dead) continue;
    if (e.bulk) { const o = e.obj; o.g.position.set(e.x, 0, e.z); o.body.rotation.y = e.a; o.body.scale.set(1 + Math.sin(T * 6 + e.ph) * 0.03, 1 - Math.sin(T * 6 + e.ph) * 0.04, 1); o.fg.scale.x = Math.max(0.001, e.hp / e.max); o.fg.position.x = -0.55 * (1 - e.hp / e.max); o.bar.quaternion.copy(camQ); e.flash *= 0.85; continue; }
    if (n >= MAXE) continue;
    const sz = TIER_SIZE[e.tier], b = Math.sin(T * (8 + e.tier) + e.ph), sq = 1 + b * 0.09;
    O.position.set(e.x, Math.max(0, b) * 0.06, e.z); O.rotation.set(0, e.a, 0); O.scale.set(sz / Math.sqrt(sq), sz * sq, sz / Math.sqrt(sq)); O.updateMatrix(); slimeMesh.setMatrixAt(n, O.matrix);
    if (e.tier === 7) COL.setHSL((T * 0.5 + e.ph) % 1, 0.85, 0.62); else COL.set(TIER_COL[e.tier]);
    if (e.slowT > 0) COL.lerp(new THREE.Color('#ffe08a'), 0.35);
    slimeMesh.setColorAt(n, COL); n++;
    if (e.shell > 0 && sn < 300) { O.scale.multiplyScalar(1); O.updateMatrix(); shellMesh.setMatrixAt(sn++, O.matrix); }
  }
  slimeMesh.count = n; slimeMesh.instanceMatrix.needsUpdate = true; if (slimeMesh.instanceColor) slimeMesh.instanceColor.needsUpdate = true;
  shellMesh.count = sn; shellMesh.instanceMatrix.needsUpdate = true;
  // projectiles
  let k = 0; for (const q of proj.quill) { if (k >= 400) break; O.position.set(q.x, 0.45, q.z); O.rotation.set(0, q.a, 0); O.scale.setScalar(1); O.updateMatrix(); quillMesh.setMatrixAt(k++, O.matrix); } quillMesh.count = k; quillMesh.instanceMatrix.needsUpdate = true;
  k = 0; for (const b of proj.bee) { if (k >= 300) break; O.position.set(b.x + Math.sin(T * 30 + b.ph) * 0.03, b.y + Math.sin(T * 24 + b.ph) * 0.05, b.z); O.rotation.set(0, b.a, 0); O.scale.setScalar(1.2); O.updateMatrix(); beeMesh.setMatrixAt(k++, O.matrix); } beeMesh.count = k; beeMesh.instanceMatrix.needsUpdate = true;
  for (const [kind, mesh, mx] of [['bubble', bubbleMesh, 120], ['shell', shotMesh, 80]]) {
    k = 0; for (const q of proj[kind]) { if (k >= mx) break; const u = q.t / q.T; O.position.set(lerp(q.x0, q.x1, u), 0.6 + Math.sin(u * Math.PI) * q.h, lerp(q.z0, q.z1, u)); O.rotation.set(u * 9, 0, u * 5); O.scale.setScalar(kind === 'bubble' ? 1 + u * 0.4 : 1); O.updateMatrix(); mesh.setMatrixAt(k++, O.matrix); }
    mesh.count = k; mesh.instanceMatrix.needsUpdate = true;
  }
  // particles
  const h = dt / 60; k = 0;
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.vy -= 9 * h; p.x += p.vx * h; p.y += p.vy * h; p.z += p.vz * h; if (p.y < 0.05) { p.y = 0.05; p.vy *= -0.3; p.vx *= 0.7; p.vz *= 0.7; } p.life -= h; if (p.life <= 0) { parts.splice(i, 1); continue; } }
  for (const p of parts) { O.position.set(p.x, p.y, p.z); O.rotation.set(p.r + p.life * 6, p.life * 4, 0); O.scale.setScalar(p.s * Math.min(1, p.life * 3)); O.updateMatrix(); partMesh.setMatrixAt(k, O.matrix); partMesh.setColorAt(k, p.c); k++; }
  partMesh.count = k; partMesh.instanceMatrix.needsUpdate = true; if (partMesh.instanceColor) partMesh.instanceColor.needsUpdate = true;
  for (const r of rings) if (r.t > 0) { r.t -= dt * 0.05; const s = r.r * (1.15 - r.t * 0.5); r.m.scale.set(s, s, 1); r.m.material.opacity = Math.max(0, r.t) * 0.8; if (r.t <= 0) r.m.visible = false; }
  for (const b of beams) if (b.t > 0) { b.t -= dt * 0.12; b.m.material.opacity = Math.max(0, b.t); if (b.t <= 0) b.m.visible = false; }
  // towers: aim + recoil + pop-in
  for (const t of towers) {
    let dy = t.yaw - t.mesh.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); t.mesh.rotation.y += dy * Math.min(1, dt * 0.35);
    t.recoil *= Math.pow(0.82, dt); t.born *= Math.pow(0.85, dt);
    const r = t.recoil, bn = t.born; t.mesh.scale.set(1 + r * 0.07 + bn * 0.3, 1 - r * 0.12 - bn * 0.25 + Math.sin(T * 3 + t.x) * 0.012, 1 + r * 0.07 + bn * 0.3).multiplyScalar(1.22);
  }
  if (selected) { rangeG.position.set(selected.x, 0.05, selected.z); }
  if (pondG) pondG.children[0].material.color.setHSL(0.54, 0.8, 0.6 + Math.sin(T * 1.3) * 0.02);
  // camera
  shake *= Math.pow(0.88, dt);
  camera.position.set(camPos.x + (Math.random() - 0.5) * shake, camPos.y + (Math.random() - 0.5) * shake * 0.5, camPos.z + (Math.random() - 0.5) * shake);
  camera.lookAt(camT); camQ.copy(camera.quaternion);
}

// ================================================================ music: a small garden march composed in code
const MEL = [76, 0, 79, 81, 79, 0, 76, 74, 72, 0, 74, 76, 74, 0, 67, 0, 76, 0, 79, 81, 84, 0, 83, 81, 79, 0, 76, 74, 72, 0, 0, 0];
const BAS = [48, 55, 52, 55, 45, 52, 48, 52, 41, 48, 45, 48, 43, 50, 47, 50];
let mstep = 0;
setInterval(() => {
  if (muted || state !== 'play' || document.hidden) return;
  const i = mstep++ % 32; if (MEL[i]) note(MEL[i], 0.22, inRound ? 0.045 : 0.035);
  if (i % 2 === 0) note(BAS[(i / 2) % 16], 0.3, 0.05);
  if (inRound && i % 4 === 0) tone(90, 0.06, 'sine', 0.06, 0.5);
}, 150);

// ================================================================ main loop
loop((dt, T) => {
  clock = T;
  if (state === 'play') { let h = Math.min(dt / 60, 0.05) * gs; while (h > 0 && state === 'play') { const s = Math.min(h, 1 / 60); step(s); h -= s; } }
  render(dt, T);
  hudT -= dt; if (hudT <= 0) { hudT = 10; if (state === 'play') paintHud(); }
  if (world) sun.position.set(5, 16, 7);
});

// ================================================================ start card: map picker + continue
const startEl = ui.els.start, hintEl = startEl.querySelector('.hint');
const sub = $(`<p class="pg-sub2">Stop the goo before it reaches the pond</p>`); startEl.querySelector('h1').after(sub);
const mapsEl = $(`<div class="pg-maps"></div>`); hintEl.before(mapsEl);
const newBtn = $(`<button class="pg-mini">↺ New run on this map</button>`); newBtn.addEventListener('pointerdown', e => { e.stopPropagation(); S.set('run', null); startEl.classList.add('hc-hidden'); newRun(); });
function paintStart() {
  best = S.get('best', [0, 0, 0]);
  if (D.seed) { mapI = D.seed % 3; mapsEl.innerHTML = `<button class="pg-map sel"><span>${MAPS[mapI].name}</span><small>Daily challenge · ${MAPS[mapI].diff}</small></button>`; hintEl.innerHTML = 'Tap to start today\'s run'; return; }
  mapsEl.innerHTML = MAPS.map((m, i) => `<button class="pg-map ${i === mapI ? 'sel' : ''} ${unlocked(i) ? '' : 'lock'}" data-m="${i}"><span>${unlocked(i) ? '' : '🔒 '}${m.name}</span><small>${unlocked(i) ? `${m.diff} · best ${best[i]}/40` : `Reach round ${UNLOCK[i]} on ${MAPS[i - 1].name}`}</small></button>`).join('');
  mapsEl.querySelectorAll('[data-m]').forEach(b => b.addEventListener('pointerdown', e => { e.stopPropagation(); const i = +b.dataset.m; if (!unlocked(i)) { tone(160, 0.12, 'square', 0.06); return; } mapI = i; S.set('map', i); buildMap(mapI); paintStart(); sfx.tap(); }));
  const run = S.get('run', null);
  if (run && run.map === mapI && run.round > 0) { hintEl.innerHTML = `Tap to continue · round ${run.round + 1}`; hintEl.after(newBtn); }
  else { hintEl.innerHTML = 'Tap to defend the pond'; newBtn.remove(); }
}
const mapsBtn = $(`<button class="pg-mini">🗺️ Maps</button>`); ui.els.lose.querySelector('.hint').after(mapsBtn);
mapsBtn.addEventListener('pointerdown', e => { e.stopPropagation(); ui.els.lose.classList.add('hc-hidden'); state = 'ready'; paintStart(); ui.start(); });
ui.onTap(w => {
  if (w === 'start') { const run = S.get('run', null); newRun(!D.seed && run && run.map === mapI && run.round > 0 ? run : null); return; }
  if (w === 'win') { if (!D.seed && mapI < 2 && unlocked(mapI + 1)) { mapI++; S.set('map', mapI); } state = 'ready'; paintStart(); ui.start(); return; }
  if (w === 'lose') newRun();
});
buildMap(mapI); paintStart(); paintHud();
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on a fresh run of the first map, until
// the first touch, the first critter tower drops onto the spot that covers the most path (the bot's pick); its coins are given back
demo(() => { const w = BUILD.find(t => towerOpen(t)) || 'hog', sp = bestSpot(w); if (!sp) return false; const c = TW[w].cost; if (place(w, sp[0], sp[1])) { coins += c; paintHud(); } return false; },
  { ready: () => state === 'play' && mapI === 0 && !D.seed && round === 0 && !inRound && !towers.length && !placing && !selected, wait: 1800 });

// ================================================================ bot (QA): builds on the best-covering spots, upgrades, runs at ×3
function coverage(x, z, R) { let c = 0; for (let i = 0; i < P.x.length; i += 3) if ((P.x[i] - x) ** 2 + (P.z[i] - z) ** 2 < R * R) c += 1 + i / P.x.length; return c; }
function bestSpot(type) {
  const R = Math.min(TW[type].base.range, 4.5); let bs = null, bv = -1;
  for (const [x, z] of spots) { if (!validSpot(x, z)) continue; const key = R + ':' + x + ':' + z; let v = covCache.get(key); if (v === undefined) { v = coverage(x, z, R); covCache.set(key, v); } if (v > bv) { bv = v; bs = [x, z]; } }
  return bs;
}
const PLAN = { hog: 'BBAAA', frog: 'AABBA', hive: 'AABBA', snail: 'AABBA', owl: 'ABBAB' };
const BUILD = ['hog', 'hog', 'frog', 'hive', 'hog', 'frog', 'snail', 'hive', 'owl', 'frog', 'snail', 'owl', 'hog', 'snail', 'frog', 'owl', 'hive', 'snail'];
function botAct() {
  const want = BUILD.slice(towers.length).find(t => towerOpen(t)) || 'frog';
  const maxT = 2 + Math.floor(round / 2);
  let cheapest = null;
  for (const t of towers) { const p = PLAN[t.type][t.a + t.b]; if (p && canUp(t, p)) { const c = upCost(t, p) * (1 + (t.a + t.b) * 0.25); if (!cheapest || c < cheapest[2]) cheapest = [t, p, c]; } }
  if (towers.length < Math.min(maxT, 18) && coins >= TW[want].cost) { const s = bestSpot(want); if (s) { place(want, s[0], s[1]); return; } }
  if (towers.length >= Math.min(maxT, 18) && cheapest && coins >= upCost(cheapest[0], cheapest[1])) upgrade(cheapest[0], cheapest[1]);
}
window.__game = {
  get state() { return state; }, get level() { return round; }, get score() { return roundsDone; },
  _qa(g) { gs = g; return { round, lives, coins: Math.floor(coins), towers: towers.map(t => t.type + t.a + t.b).join(' '), en: en.length }; },
  bot() {
    if (state !== 'play') return;
    if (placing) setPlacing(null);
    if (selected) select(null);
    botAct();
    if (!inRound) { startRound(); if (gs < 3) setSpeed(3); if (window.__turbo) gs = window.__turbo; }
    else if (gs < 3) setSpeed(3);
    if (window.__turbo) gs = window.__turbo;
  },
};
