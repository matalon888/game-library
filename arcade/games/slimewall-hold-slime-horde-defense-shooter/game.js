// Slimewall Hold — original wave-defense shooter: hold the core against slime hordes, build with scrap between waves.
import { THREE, createStage, createUI, loop, rounded, tone, note, sfx, buzz, store, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { GLTFLoader } from './kit/addons/loaders/GLTFLoader.js';
import { heroBar, selectedHero, loadHero, onHeroesChange } from './kit/heroes.js';
import { part, merge, vmat, canvasTex, G, hudCSS, H, btn, banner, feed, vignette, controls, Pool, healthBars, floaters, shaker, music, robot } from './lib.js';

const NAME = 'Slimewall Hold: Slime Horde Defense Shooter';
const TAU = Math.PI * 2, ARENA = 36, CORE_R = 2.2;
const S = createStage({ fov: 50, shadowSize: 30 });
const { scene, camera, sun, hemi, renderer } = S;
sun.intensity = 1.8; hemi.intensity = 1.1; sun.color.set('#fff2dc');
scene.add(camera);
hudCSS('#7dffb0');
document.body.style.setProperty('--bg1', '#8fd9ff'); document.body.style.setProperty('--bg2', '#e8ffe0');
const ui = createUI({ title: 'SLIMEWALL<br>HOLD', hint: 'Tap to hold the line', hand: '🛡️', progress: false, score: false });
const D = daily('slimewall', ui, { name: NAME });
const F = flow('slimewall', { par: 6000 });
const B = board({ game: 'slimewall-hold', label: 'Wave score', limits: { maxRun: 90000, maxPerSec: 120 }, corner: 'tl' });
const save = store('slimewall');
const P = { bestWave: save.get('bestWave', 0), best: save.get('best', 0), runs: save.get('runs', 0), kit: save.get('kit', 0), kills: save.get('kills', 0) };
const saveP = () => { for (const k in P) save.set(k, P[k]); };
const KITS = [
  { name: 'Steady', need: 0, txt: 'balanced start' },
  { name: 'Builder', need: 3, txt: '+40 scrap at start' },
  { name: 'Gunner', need: 6, txt: '+25% blaster damage' },
  { name: 'Medic', need: 10, txt: 'core +400 HP' },
];

// ---------------------------------------------------------------- world
const LANES = [{ a: -Math.PI / 2, name: 'NORTH' }, { a: -Math.PI / 2 - 0.75, name: 'WEST' }, { a: -Math.PI / 2 + 0.75, name: 'EAST' }, { a: Math.PI / 2 + 0.9, name: 'SOUTHWEST' }, { a: Math.PI / 2 - 0.9, name: 'SOUTHEAST' }];
const lanePt = (l, d) => new THREE.Vector3(Math.cos(LANES[l].a) * d, 0, Math.sin(LANES[l].a) * d);
const PADS = [[0, 9.5], [0, 15], [1, 10], [1, 16], [2, 10], [2, 16], [0, 21], [3, 11], [4, 11]].map(([l, d], i) => { const p = lanePt(l, d); const side = i < 7 ? (i % 2 ? 1.9 : -1.9) : 0; const a = LANES[l].a + Math.PI / 2; return { id: i, lane: l, x: p.x + Math.cos(a) * side, z: p.z + Math.sin(a) * side, b: null }; });
const world = new THREE.Group(); scene.add(world);
{
  const tex = canvasTex(1024, 1024, (g, W) => {
    const s = W / 100, X = v => (v + 50) * s;
    g.fillStyle = '#7fcf6b'; g.fillRect(0, 0, W, W);
    for (let k = 0; k < 60; k++) { g.fillStyle = Math.random() < 0.5 ? '#76c463' : '#8ad877'; g.beginPath(); g.ellipse(Math.random() * W, Math.random() * W, 30 + Math.random() * 80, 20 + Math.random() * 50, Math.random() * 3, 0, TAU); g.fill(); }
    g.lineCap = 'round';
    for (const l of LANES) { g.strokeStyle = '#d9b77c'; g.lineWidth = 6.5 * s; g.beginPath(); g.moveTo(X(0), X(0)); g.lineTo(X(Math.cos(l.a) * 46), X(Math.sin(l.a) * 46)); g.stroke(); g.strokeStyle = '#e6c78e'; g.lineWidth = 4.5 * s; g.stroke(); }
    g.fillStyle = '#cdb8a0'; g.beginPath(); g.arc(X(0), X(0), 9.5 * s, 0, TAU); g.fill();
    g.strokeStyle = '#b8a084'; g.lineWidth = 3; for (let r = 3; r < 9.5; r += 2) { g.beginPath(); g.arc(X(0), X(0), r * s, 0, TAU); g.stroke(); }
    for (let k = 0; k < 4000; k++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.04)' : 'rgba(255,255,255,.08)'; g.fillRect(Math.random() * W, Math.random() * W, 2 + Math.random() * 4, 2 + Math.random() * 3); }
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 4; g.setLineDash([12, 10]); g.beginPath(); g.arc(X(0), X(0), ARENA * s, 0, TAU); g.stroke();
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; world.add(ground);
  const far = new THREE.Mesh(new THREE.CircleGeometry(220, 40), new THREE.MeshStandardMaterial({ color: '#7fcf6b', roughness: 1 })); far.rotation.x = -Math.PI / 2; far.position.y = -0.03; world.add(far);
  const P = [];
  // base: platform, hedges with gates on the lanes, lamps
  P.push(part(new THREE.CylinderGeometry(3.4, 3.8, 0.5, 6), '#a39484', { y: 0.25 }));
  for (let k = 0; k < 72; k++) {
    const a = k / 72 * TAU; if (LANES.some(l => Math.abs(Math.atan2(Math.sin(a - l.a), Math.cos(a - l.a))) < 0.24)) continue;
    P.push(part(G.box, k % 2 ? '#4fae5f' : '#5cbf6b', { x: Math.cos(a) * 8.2, y: 0.45, z: Math.sin(a) * 8.2, sx: 0.85, sy: 0.9, sz: 0.8, ry: -a }));
  }
  for (const l of LANES) for (const s of [-1, 1]) { const a = l.a + s * 0.27; P.push(part(G.cyl, '#8a5a32', { x: Math.cos(a) * 8.2, y: 1.1, z: Math.sin(a) * 8.2, sx: 0.18, sz: 0.18, sy: 2.2 })); P.push(part(G.sph, '#fff3b0', { x: Math.cos(a) * 8.2, y: 2.3, z: Math.sin(a) * 8.2, s: 0.25 })); }
  // forest ring + rocks outside the arena
  const r = rng(5);
  for (let k = 0; k < 120; k++) { const a = r() * TAU, d = ARENA + 2 + r() * 14; if (LANES.some(l => Math.abs(Math.atan2(Math.sin(a - l.a), Math.cos(a - l.a))) < 0.12)) continue; const x = Math.cos(a) * d, z = Math.sin(a) * d, s = 0.9 + r() * 0.7; P.push(part(G.cyl, '#8a5a32', { x, y: s, z, sx: 0.25 * s, sz: 0.25 * s, sy: 2 * s })); P.push(part(G.ico, r() < 0.5 ? '#3fae5a' : '#58c26b', { x, y: 2.8 * s, z, s: 1.5 * s })); }
  for (let k = 0; k < 26; k++) { const a = r() * TAU, d = 12 + r() * 22; if (LANES.some(l => Math.abs(Math.atan2(Math.sin(a - l.a), Math.cos(a - l.a))) < 0.2)) continue; P.push(part(G.dod, '#b9b4c4', { x: Math.cos(a) * d, y: 0.3, z: Math.sin(a) * d, s: 0.5 + r() * 0.6, sy: 0.6 })); }
  for (let k = 0; k < 40; k++) { const a = r() * TAU, d = 10 + r() * 25; if (LANES.some(l => Math.abs(Math.atan2(Math.sin(a - l.a), Math.cos(a - l.a))) < 0.18)) continue; const x = Math.cos(a) * d, z = Math.sin(a) * d; P.push(part(G.ico, '#4fbf6a', { x, y: 0.35, z, s: 0.55 })); P.push(part(G.sph, ['#ff6b9a', '#ffd23f', '#ffffff'][k % 3], { x: x + 0.2, y: 0.7, z, s: 0.1 })); }
  const m = new THREE.Mesh(merge(P), vmat({ roughness: 0.7 })); m.castShadow = true; m.receiveShadow = true; world.add(m);
  // slime portals at the lane mouths
  for (const l of LANES) {
    const p = lanePt(LANES.indexOf(l), ARENA + 1);
    const portal = new THREE.Mesh(merge([part(new THREE.TorusGeometry(2.2, 0.4, 8, 24), '#5a3d8a', { rx: Math.PI / 2, y: 0.15 }), ...[0, 1, 2, 3, 4, 5].map(k => part(G.cone, '#7a52b8', { x: Math.cos(k * 1.05) * 2.4, z: Math.sin(k * 1.05) * 2.4, y: 0.6, s: 0.35, sy: 1.2 }))]), vmat());
    portal.position.copy(p); world.add(portal);
    const goo = new THREE.Mesh(new THREE.CircleGeometry(2, 24), new THREE.MeshBasicMaterial({ color: '#b56bff', transparent: true, opacity: 0.85 })); goo.rotation.x = -Math.PI / 2; goo.position.set(p.x, 0.08, p.z); world.add(goo); l.goo = goo;
  }
  scene.fog = new THREE.Fog('#e8ffe0', 55, 120);
}
// core crystal
const core = new THREE.Group(); scene.add(core);
const coreGem = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 0), new THREE.MeshStandardMaterial({ color: '#7df9ff', emissive: '#3ad7ff', emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.1 }));
coreGem.scale.y = 1.5; coreGem.position.y = 2.6; coreGem.castShadow = true; core.add(coreGem);
const coreBase = new THREE.Mesh(merge([part(G.cyl, '#5d6b8a', { y: 0.9, sx: 1.3, sz: 1.3, sy: 0.8 }), part(G.cyl, '#ffd23f', { y: 1.35, sx: 1.4, sz: 1.4, sy: 0.12 }), ...[0, 1, 2, 3].map(k => part(G.box, '#5d6b8a', { x: Math.cos(k * 1.57) * 1.2, z: Math.sin(k * 1.57) * 1.2, y: 1.7, sx: 0.25, sy: 0.9, sz: 0.25, ry: -k * 1.57 }))]), vmat()); coreBase.castShadow = true; core.add(coreBase);
const coreRing = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.08, 8, 40), new THREE.MeshBasicMaterial({ color: '#9ff3ff' })); coreRing.rotation.x = Math.PI / 2; coreRing.position.y = 2.6; core.add(coreRing);

// pads
const padGeo = new THREE.CylinderGeometry(1.25, 1.35, 0.14, 6), padMats = [];
const padTex = canvasTex(128, 128, (g, W) => { g.fillStyle = '#4fdc8f'; g.fillRect(0, 0, W, W); g.fillStyle = '#c8ffe0'; g.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; g.lineTo(64 + Math.cos(a) * 52, 64 + Math.sin(a) * 52); } g.fill(); g.fillStyle = '#1f8f55'; g.fillRect(56, 34, 16, 60); g.fillRect(34, 56, 60, 16); });
for (const p of PADS) {
  const top = new THREE.MeshStandardMaterial({ map: padTex, emissive: '#7dffb0', emissiveIntensity: 0.3, roughness: 0.4 }), side = new THREE.MeshStandardMaterial({ color: '#2f9e63', roughness: 0.5 });
  const m = new THREE.Mesh(padGeo, [side, top, side]); m.material = [side, top, side]; p.top = top;
  m.position.set(p.x, 0.07, p.z); m.receiveShadow = true; world.add(m); p.mesh = m;
}

// ---------------------------------------------------------------- buildings (turrets + barricades)
const BUILD = {
  wall: { name: 'Barricade', cost: 20, need: 0, hp: 320, icon: '🧱', txt: 'blocks a lane' },
  blaster: { name: 'Blaster', cost: 40, need: 0, range: 12, rate: 3, dmg: 11, icon: '🔫', txt: 'steady foam fire' },
  frost: { name: 'Frost', cost: 60, need: 4, range: 9, rate: 0.8, dmg: 6, icon: '❄️', txt: 'slows a crowd' },
  spark: { name: 'Spark', cost: 85, need: 8, range: 11, rate: 1, dmg: 26, icon: '⚡', txt: 'chains 3 slimes' },
};
const upCost = b => Math.round(BUILD[b.type].cost * (0.8 + b.lvl * 0.7));
function buildMesh(type) {
  const g = new THREE.Group(); let head = null;
  if (type === 'wall') {
    const parts = [];
    for (let k = -2; k <= 2; k++) parts.push(part(rounded(0.5, 1.6 + (k % 2 ? 0.2 : 0), 0.4, 0.06), k % 2 ? '#b07a45' : '#c98e52', { x: k * 0.5, y: 0.85 }));
    parts.push(part(G.box, '#8a5a32', { y: 1.1, sx: 2.7, sy: 0.18, sz: 0.5 })); parts.push(part(G.box, '#8a5a32', { y: 0.5, sx: 2.7, sy: 0.18, sz: 0.5 }));
    for (let k = -2; k <= 2; k++) parts.push(part(G.cone, '#d9d9e3', { x: k * 0.5, y: 0.8, z: -0.45, s: 0.12, sy: 0.5, rx: -Math.PI / 2 }));
    const m = new THREE.Mesh(merge(parts), vmat()); m.castShadow = true; g.add(m);
  } else {
    const col = type === 'blaster' ? '#ff8c42' : type === 'frost' ? '#5ad7ff' : '#b26bff';
    const base = new THREE.Mesh(merge([part(G.cyl, '#5d6b8a', { y: 0.35, sx: 0.9, sz: 0.9, sy: 0.7 }), part(G.cyl, col, { y: 0.72, sx: 0.95, sz: 0.95, sy: 0.1 })]), vmat()); base.castShadow = true; g.add(base);
    head = new THREE.Group(); head.position.y = 1.15; g.add(head);
    let hp;
    if (type === 'blaster') hp = [part(rounded(0.9, 0.6, 0.9, 0.12), col, {}), part(G.cyl, '#2b2d42', { z: 0.6, rx: Math.PI / 2, sx: 0.13, sz: 0.13, sy: 0.7, x: -0.18 }), part(G.cyl, '#2b2d42', { z: 0.6, rx: Math.PI / 2, sx: 0.13, sz: 0.13, sy: 0.7, x: 0.18 }), part(G.box, '#9ff3ff', { y: 0.12, z: 0.42, sx: 0.5, sy: 0.14, sz: 0.1 })];
    else if (type === 'frost') hp = [part(G.cone, '#bff4ff', { y: 0.4, s: 0.5, sy: 1.3 }), part(G.cone, '#7fe3ff', { y: 0.2, x: 0.35, s: 0.25, sy: 0.7, rz: -0.4 }), part(G.cone, '#7fe3ff', { y: 0.2, x: -0.35, s: 0.25, sy: 0.7, rz: 0.4 }), part(new THREE.TorusGeometry(0.6, 0.06, 6, 20), '#ffffff', { rx: Math.PI / 2, y: 0.1 })];
    else hp = [part(G.cyl, '#3d3a4b', { y: 0.5, sx: 0.22, sz: 0.22, sy: 1.4 }), ...[0, 1, 2].map(k => part(new THREE.TorusGeometry(0.36 - k * 0.06, 0.06, 6, 18), col, { rx: Math.PI / 2, y: 0.1 + k * 0.35 })), part(G.sph, '#e9d4ff', { y: 1.35, s: 0.3 })];
    const hm = new THREE.Mesh(merge(hp), vmat({ emissive: new THREE.Color(type === 'blaster' ? '#000000' : col), emissiveIntensity: 0.25 })); hm.castShadow = true; head.add(hm);
  }
  g.head = head; return g;
}

// ---------------------------------------------------------------- slimes (instanced: body, eyes, shells = 3 draw calls)
const ST = {
  blob: { hp: 30, sp: 2.5, r: 0.9, col: '#5ee06a', dmg: 9, scrap: 2 },
  hopper: { hp: 18, sp: 4.4, r: 0.68, col: '#ffd23f', dmg: 6, scrap: 2 },
  shell: { hp: 95, sp: 1.7, r: 1.1, col: '#a77bff', dmg: 14, scrap: 5, armor: 0.5 },
  spitter: { hp: 40, sp: 2.1, r: 0.88, col: '#ff6fb1', dmg: 8, scrap: 4, ranged: 8.5 },
  splitter: { hp: 60, sp: 2.2, r: 1.15, col: '#3fd8c8', dmg: 10, scrap: 4, split: 3 },
  mini: { hp: 14, sp: 3.4, r: 0.55, col: '#3fd8c8', dmg: 4, scrap: 1 },
};
const MAXS = 260;
const blobGeo = (() => { const g = new THREE.SphereGeometry(1, 20, 14); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setY(i, y < 0 ? y * 0.55 : y * 0.95); } g.computeVertexNormals(); g.translate(0, 0.55, 0); return g; })();
const slimeBody = new THREE.InstancedMesh(blobGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.22, metalness: 0.05, emissive: '#ffffff', emissiveIntensity: 0.06 }), MAXS);
slimeBody.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAXS * 3), 3);
const eyeGeo = merge([part(G.sph, '#ffffff', { x: -0.33, y: 0.85, z: 0.78, s: 0.24 }), part(G.sph, '#ffffff', { x: 0.33, y: 0.85, z: 0.78, s: 0.24 }), part(G.sph, '#1d1d28', { x: -0.33, y: 0.85, z: 0.97, s: 0.12 }), part(G.sph, '#1d1d28', { x: 0.33, y: 0.85, z: 0.97, s: 0.12 }), part(G.box, '#1d1d28', { y: 0.55, z: 0.92, sx: 0.35, sy: 0.06, sz: 0.06 })]);
const slimeEyes = new THREE.InstancedMesh(eyeGeo, vmat({ roughness: 0.3 }), MAXS);
const shellGeo = merge([part(new THREE.SphereGeometry(1, 14, 8, 0, TAU, 0, Math.PI / 2.2), '#6b4a9e', { y: 0.65, s: 0.92 }), ...[0, 1, 2, 3, 4].map(k => part(G.cone, '#ffd23f', { x: Math.cos(k * 1.26) * 0.55, z: Math.sin(k * 1.26) * 0.55, y: 1.35, s: 0.16, sy: 0.4 }))]);
const slimeShell = new THREE.InstancedMesh(shellGeo, vmat(), 60);
for (const m of [slimeBody, slimeEyes, slimeShell]) { m.castShadow = true; m.frustumCulled = false; m.count = 0; scene.add(m); }
// King Slime boss
const king = new THREE.Group(); king.visible = false; scene.add(king);
const kingBody = new THREE.Mesh(blobGeo, new THREE.MeshStandardMaterial({ color: '#4cd964', roughness: 0.2, emissive: '#ffffff', emissiveIntensity: 0 })); kingBody.castShadow = true; king.add(kingBody);
const kingDeco = new THREE.Mesh(merge([eyeGeo.clone(), ...[0, 1, 2, 3, 4].map(k => part(G.cone, '#ffd23f', { x: Math.cos(k * 1.26) * 0.4, z: Math.sin(k * 1.26) * 0.4, y: 1.55, s: 0.13, sy: 0.4 })), part(G.cyl, '#ffd23f', { y: 1.4, sx: 0.45, sz: 0.45, sy: 0.14 }), part(G.sph, '#ff4d6d', { y: 1.4, z: 0.45, s: 0.08 })]), vmat()); king.add(kingDeco);
let slimes = [], boss = null;

// ---------------------------------------------------------------- pools + fx
const BUL = new THREE.SphereGeometry(0.16, 8, 6);
const bullets = new Pool(scene, BUL, new THREE.MeshBasicMaterial({ color: '#ffffff' }), 300, { colors: true });
const goos = new Pool(scene, new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshStandardMaterial({ color: '#ff6fb1', roughness: 0.2, emissive: '#ff3d9a', emissiveIntensity: 0.3 }), 80);
const sparks = new Pool(scene, new THREE.SphereGeometry(0.12, 6, 5), new THREE.MeshBasicMaterial({ color: '#ffffff' }), 600, { colors: true });
const rings = new Pool(scene, (() => { const g = new THREE.RingGeometry(0.85, 1, 32); g.rotateX(-Math.PI / 2); return g; })(), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }), 60, { colors: true });
const splats = new Pool(scene, (() => { const g = new THREE.CircleGeometry(1, 16); g.rotateX(-Math.PI / 2); return g; })(), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, depthWrite: false }), 80, { colors: true });
const nade = new THREE.Mesh(merge([part(G.sph, '#7dffb0', { s: 0.32 }), part(G.cyl, '#2b2d42', { s: 0.33, sy: 0.08 })]), vmat({ emissive: new THREE.Color('#7dffb0'), emissiveIntensity: 0.3 })); nade.visible = false; scene.add(nade);
const zapGeo = new THREE.BufferGeometry(); zapGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(64 * 6 * 3), 3));
const zaps = new THREE.LineSegments(zapGeo, new THREE.LineBasicMaterial({ color: '#e9d4ff' })); zaps.frustumCulled = false; scene.add(zaps); let zapList = [];
function spark(pos, cols, n = 10, sp = 0.1, up = 0.08) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, b = Math.random() * 0.9 + 0.1; sparks.spawn({ p: pos.clone(), v: new THREE.Vector3(Math.cos(a) * sp * b * 60, (up + Math.random() * up) * 60, Math.sin(a) * sp * b * 60), life: 0.45 + Math.random() * 0.4, color: cols[i % cols.length], s: 0.7 + Math.random() * 0.9 }); } }
function ring(pos, color, size = 1, life = 0.5, grow = 8) { rings.spawn({ p: pos.clone().setY(0.1), v: new THREE.Vector3(), life, color, s: size, grow }); }
const bars = healthBars(scene, camera, 70), fl = floaters(camera, 30), shake = shaker();

// ---------------------------------------------------------------- hero
const hero = robot({ body: '#2ec4b6', trim: '#ff9f1c', visor: '#e8fffb', kind: 'heavy', s: 1.05 }); scene.add(hero);
const heroRing = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 32), new THREE.MeshBasicMaterial({ color: '#ff9f1c', transparent: true, opacity: 0.85 })); heroRing.rotation.x = -Math.PI / 2; heroRing.position.y = 0.05; hero.add(heroRing);
const H0 = { hp: 100, rate: 6, dmg: 10, pierce: 0, multi: 1, speed: 6.4, nadeCd: 8, range: 13 };
let h = null;

// ---------------------------------------------------------------- my hero (Hero Lab): replaces the robot's look; `hero` (position, yaw, muzzle, ring) still drives the game
const RING_C = new THREE.Color('#ff9f1c'), HURT_C = new THREE.Color('#ff3355');
let my = null, myTok = 0, myClip = '', myShown = '', myB = null, myPhase = 'build', myCheer = 0, mySlide = 0, myHp = 100, myHurt = 0;
const myGun = new THREE.Mesh(merge([part(G.box, '#2ec4b6', { y: 0.02, z: 0.16, sx: 0.13, sy: 0.17, sz: 0.46 }), part(G.cyl, '#2b2d42', { z: 0.47, rx: Math.PI / 2, sx: 0.085, sz: 0.085, sy: 0.24 }), part(G.cyl, '#ff9f1c', { z: 0.6, rx: Math.PI / 2, sx: 0.1, sz: 0.1, sy: 0.05 }), part(G.box, '#ff9f1c', { y: 0.12, z: 0.12, sx: 0.05, sy: 0.07, sz: 0.2 }), part(G.box, '#2b2d42', { y: -0.13, z: 0.02, sx: 0.08, sy: 0.16, sz: 0.09 })]), vmat());
myGun.castShadow = true; myGun.visible = false; scene.add(myGun);
const robotParts = () => [hero.torso, ...hero.legs];     // hidden, not removed: hero.muzzle (under the torso) still places the shots
async function useHero() {
  const hc = selectedHero(), tok = ++myTok; myShown = JSON.stringify(hc);
  if (my) { my.dispose(); my = null; myB = null; }
  robotParts().forEach(o => o.visible = true); myGun.visible = false;
  if (!hc) return;
  try {
    // the foam blaster takes the right hand, so the hand item stays in the lab
    const n = await loadHero(THREE, GLTFLoader, { hero: { ...hc, items: { ...hc.items, hand: null } }, height: 2.3 / 1.05, quality: 'game', clip: 'idle' });
    if (tok !== myTok) { n.dispose(); return; }
    const b = k => n.object.getObjectByName(k);
    my = n; myClip = 'idle'; myB = { ua: b('RightArm'), fa: b('RightForeArm'), hand: b('RightHand'), la: b('LeftArm'), lf: b('LeftForeArm'), lh: b('LeftHand') };
    hero.add(n.object); robotParts().forEach(o => o.visible = false);
  } catch (e) { console.warn('hero', e); }
}
const _ha = new THREE.Vector3(), _hb = new THREE.Vector3(), _hq = new THREE.Quaternion(), _hq2 = new THREE.Quaternion(), _hq3 = new THREE.Quaternion(), _hd = new THREE.Vector3(), _hf = new THREE.Vector3(), _hr = new THREE.Vector3();
function aimBone(bone, tip, dir) {   // turn `bone` so bone→tip points along world `dir`
  if (!bone || !tip) return;
  bone.getWorldPosition(_ha); tip.getWorldPosition(_hb);
  _hq.setFromUnitVectors(_hb.sub(_ha).normalize(), dir);
  bone.getWorldQuaternion(_hq2); _hq.multiply(_hq2);
  bone.parent.getWorldQuaternion(_hq3); bone.quaternion.copy(_hq3.invert().multiply(_hq));
}
function heroTick(s) {
  if (!my) return;
  if (h && phase === 'build' && myPhase === 'wave' && wave > 0 && state === 'play') myCheer = 1.8;      // wave held
  myPhase = phase;
  if (h && h.hp < myHp - 0.5) myHurt = 0.3; myHp = h ? h.hp : 100;
  myCheer = Math.max(0, myCheer - s); myHurt = Math.max(0, myHurt - s);
  if (h && h.dashT > 0) mySlide = 0.38; else mySlide = Math.max(0, mySlide - s);
  const v = h ? Math.hypot(h.vel.x, h.vel.z) : 0;
  const want = state === 'lost' ? 'fall' : state !== 'play' ? 'idle' : mySlide > 0 ? 'slide' : v > 7.4 ? 'sprint' : v > 0.6 ? 'run' : myCheer > 0 ? 'cheer' : 'idle';
  if (want !== myClip) { my.play(want, { fade: want === 'slide' ? 0.08 : 0.2 }); myClip = want; }
  if (my.actions.run) my.actions.run.timeScale = clamp(v / 5, 0.6, 1.4);
  my.mixer.update(s);
  heroRing.material.color.copy(myHurt > 0 && Math.floor(myHurt * 20) % 2 ? HURT_C : RING_C);
  // both hands on the foam blaster, pointing where the hero aims (not while cheering / down / sliding)
  const armed = state !== 'lost' && hero.visible && want !== 'cheer' && want !== 'slide';
  myGun.visible = armed;
  if (!armed) return;
  const fw = _hf.set(Math.sin(hero.rotation.y), 0, Math.cos(hero.rotation.y)), rt = _hr.set(-fw.z, 0, fw.x);   // rt = the hero's own right side
  aimBone(myB.ua, myB.fa, _hd.copy(fw).multiplyScalar(0.55).setY(-0.8).normalize());
  aimBone(myB.fa, myB.hand, _hd.copy(fw).setY(0.05).normalize());
  aimBone(myB.la, myB.lf, _hd.copy(fw).multiplyScalar(0.5).addScaledVector(rt, 0.1).setY(-0.8).normalize());
  aimBone(myB.lf, myB.lh, _hd.copy(fw).addScaledVector(rt, 0.75).setY(0.1).normalize());
  myB.hand.getWorldPosition(myGun.position); myGun.position.addScaledVector(fw, 0.06);
  myGun.rotation.set(0, hero.rotation.y, 0);
}

// ---------------------------------------------------------------- HUD
const css = document.createElement('style'); css.textContent = `
.sw-top{position:fixed;top:calc(10px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:6;display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 12px;pointer-events:none;min-width:190px}
.sw-top b{font:900 18px/1 'Baloo 2',system-ui,sans-serif;white-space:nowrap}
.sw-core{width:170px;height:12px;border-radius:7px;background:rgba(0,0,0,.35);overflow:hidden}.sw-core i{display:block;height:100%;background:linear-gradient(90deg,#3ad7ff,#bff4ff);transition:width .2s}
.sw-core.low i{background:linear-gradient(90deg,#ff4d6d,#ffb3c1)}
.sw-scrap{position:fixed;right:calc(10px + env(safe-area-inset-right));top:calc(10px + env(safe-area-inset-top));z-index:6;padding:6px 12px;font:900 18px/1 'Baloo 2',system-ui,sans-serif;pointer-events:none;white-space:nowrap}
.sw-score{position:fixed;right:calc(10px + env(safe-area-inset-right));top:calc(48px + env(safe-area-inset-top));z-index:6;font:800 13px/1 system-ui,sans-serif;pointer-events:none;text-shadow:0 1px 3px rgba(0,0,0,.5)}
.sw-hp{position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom));transform:translateX(-50%);width:150px;height:11px;border-radius:7px;background:rgba(14,20,36,.6);overflow:hidden;z-index:6;border:1px solid rgba(255,255,255,.3);pointer-events:none}
.sw-hp i{display:block;height:100%;background:linear-gradient(90deg,#3ddc84,#b6f7d0)}
.sw-next{position:fixed;left:50%;bottom:calc(150px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:9;font:900 20px/1 'Baloo 2',system-ui,sans-serif;color:#10301c;background:#7dffb0;border:3px solid #fff;border-radius:40px;padding:12px 26px;box-shadow:0 6px 0 rgba(0,0,0,.2);cursor:pointer;white-space:nowrap;display:none}
.sw-tip{position:fixed;left:50%;bottom:calc(205px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:9;font:800 13px/1.2 system-ui,sans-serif;text-align:center;pointer-events:none;text-shadow:0 1px 4px rgba(0,0,0,.6);display:none;white-space:nowrap}
.sw-sheet{position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:12;display:none;flex-direction:column;gap:8px;padding:12px;width:min(370px,calc(100% - 20px))}
.sw-sheet h3{margin:0;font:900 18px/1 'Baloo 2',system-ui,sans-serif;display:flex;justify-content:space-between}
.sw-opts{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.sw-opt{font:800 14px/1.2 system-ui,sans-serif;color:#fff;background:rgba(255,255,255,.1);border:2px solid rgba(255,255,255,.25);border-radius:12px;padding:9px 6px;cursor:pointer;text-align:center}
.sw-opt small{display:block;font-size:11px;opacity:.8;font-weight:600}.sw-opt b{color:#ffd23f}
.sw-opt[disabled]{opacity:.4}
.sw-cards{position:fixed;inset:0;z-index:13;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:rgba(10,20,30,.55)}
.sw-cards h2{margin:0;font:900 30px/1 'Baloo 2',system-ui,sans-serif;-webkit-text-stroke:5px rgba(10,14,30,.8);paint-order:stroke fill}
.sw-card{width:min(300px,86vw);padding:14px;border-radius:16px;background:linear-gradient(180deg,#2ec4b6,#1b8f86);border:3px solid #fff;font:800 18px/1.2 system-ui,sans-serif;cursor:pointer;box-shadow:0 6px 0 rgba(0,0,0,.25)}
.sw-card small{display:block;font-size:13px;opacity:.9;font-weight:600;margin-top:3px}
.sw-mute{position:fixed;left:calc(10px + env(safe-area-inset-left));top:calc(62px + env(safe-area-inset-top));z-index:8;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;font-size:16px;cursor:pointer}
.hc-card .sw-meta{font:800 15px/1.35 system-ui,sans-serif}
.hc-card.dim{background:linear-gradient(180deg,rgba(60,10,60,.55),rgba(10,14,40,.3))}
`; document.head.appendChild(css);
const top = H('<div class="sw-top ax-glass"><b data-w>WAVE 1</b><div class="sw-core"><i></i></div></div>');
const scrapEl = H('<div class="sw-scrap ax-glass">⚙️ 0</div>'), scoreEl = H('<div class="sw-score">0</div>');
const hpEl = H('<div class="sw-hp"><i></i></div>');
const nextB = H('<div class="sw-next">▶ START WAVE</div>'), tip = H('<div class="sw-tip">Tap a glowing pad to build · scrap from slimes</div>');
const sheet = H('<div class="sw-sheet ax-glass"><h3><span data-t></span><span data-x style="cursor:pointer">✕</span></h3><div class="sw-opts"></div></div>');
const cards = H('<div class="sw-cards"><h2>PICK AN UPGRADE</h2></div>');
const mute = H('<div class="sw-mute ax-glass">🔊</div>');
const say = banner(), vign = vignette(), kfeed = feed({ right: 10, top: 74 });
const ctl = controls({ mode: 'stick', labels: ['MOVE', 'AIM'] });
const nadeB = btn('GOO<br>BOMB', { right: 20, bottom: 210, size: 66 }, () => throwNade());
const dashB = btn('DASH', { right: 100, bottom: 250, size: 52 }, () => dash());
[nextB, sheet, cards, mute].forEach(e => e.addEventListener('pointerdown', ev => ev.stopPropagation()));
nextB.addEventListener('click', () => { if (phase === 'build') startWave(); });
sheet.querySelector('[data-x]').addEventListener('click', () => closeSheet());
mute.addEventListener('click', () => { mute.textContent = song.toggle() ? '🔊' : '🔈'; if (song.on && state === 'play') song.start(); });
const song = music({ bpm: 132, bars: [[60, 'min'], [56, 'maj'], [63, 'maj'], [58, 'maj']], lead: [72, 0, 75, 72, 0, 70, 72, 0, 67, 0, 68, 0, 70, 0, 0, 0, 72, 0, 75, 0, 79, 77, 75, 0, 74, 0, 75, 74, 72, 0, 0, 0] });
mute.textContent = song.on ? '🔊' : '🔈';
ctl.onKey = c => { if (state !== 'play') return; if (c === 'KeyQ' || c === 'KeyG') throwNade(); if (c === 'ShiftLeft' || c === 'ShiftRight' || c === 'Space') dash(); if ((c === 'Enter' || c === 'KeyN') && phase === 'build') startWave(); };
const hudEls = [top, scrapEl, scoreEl, hpEl, nadeB, dashB];
const showHud = v => { hudEls.forEach(e => e.style.display = v ? '' : 'none'); ctl.enabled = v; ctl.refresh(); if (!v) { nextB.style.display = 'none'; tip.style.display = 'none'; closeSheet(); cards.style.display = 'none'; } };
const startMeta = H('<div class="sw-meta"></div>', ui.els.start), chips = H('<div class="ax-chips"></div>', ui.els.start);
ui.els.start.querySelector('h1').after(startMeta); startMeta.after(chips);
function paintStart() {
  startMeta.innerHTML = `Best wave ${P.bestWave} · best score ${P.best}${D.isDaily ? '<br>Daily siege' : ''}<br>Loadout:`;
  chips.innerHTML = KITS.map((k, i) => `<button class="ax-chip" data-k="${i}" aria-pressed="${i === P.kit}" ${P.bestWave < k.need ? 'disabled' : ''}>${k.name}<small>${P.bestWave < k.need ? '🔒 reach wave ' + k.need : k.txt}</small></button>`).join('');
  chips.querySelectorAll('button').forEach(b => { b.addEventListener('pointerdown', e => e.stopPropagation()); b.onclick = e => { e.stopPropagation(); if (b.disabled) return; P.kit = +b.dataset.k; saveP(); paintStart(); sfx.tap(); }; });
}

// ---------------------------------------------------------------- run state
let state = 'ready', phase = 'build', wave = 0, score = 0, scrap = 0, coreHp = 1000, coreMax = 1000, kills = 0, t0 = 0, recorded = false, beatenShown = false, fk = 1, buildT = 0, spawnQ = [], spawnT = 0, nadeCd = 0, dashCd = 0, nadeF = null, sel = null, hurtV = 0, r = Math.random, picks = 0;
function newRun() {
  for (const p of PADS) { if (p.b) scene.remove(p.b.mesh); p.b = null; }
  slimes = []; boss = null; king.visible = false; spawnQ = []; bullets.clear(); goos.clear(); sparks.clear(); rings.clear(); splats.clear(); fl.clear();
  h = { ...H0, p: new THREE.Vector3(0, 0, 5), yaw: Math.PI, vel: new THREE.Vector3(), cd: 0, alive: true, respawn: 0, walkT: 0, dashT: 0, lastHit: 9 };
  if (P.kit === 2) h.dmg *= 1.25;
  coreMax = P.kit === 3 ? 1400 : 1000; coreHp = coreMax;
  state = 'ready'; phase = 'build'; wave = 0; score = 0; scrap = P.kit === 1 ? 80 : 40; kills = 0; recorded = false; beatenShown = false; picks = 0; nadeCd = 0; dashCd = 0; nadeF = null; nade.visible = false;
  r = rng(D.seed || (Date.now() % 1e6) + 3);
  hero.position.copy(h.p); hero.visible = true; paintStart(); hud();
}
function begin() {
  state = 'play'; t0 = performance.now(); B.start(); showHud(true); song.start(); song.intensity = 0.35;
  buildT = 6; phase = 'build'; nextB.style.display = 'block'; tip.style.display = 'block'; nextB.textContent = '▶ START WAVE 1';
  say('HOLD THE CORE', 'Slimes come from the portals', 1800);
}
function waveSize(n) { return Math.round((7 + n * 3.4 + Math.max(0, n - 8) * 1.5) * fk); }
function startWave() {
  if (phase !== 'build') return;
  closeSheet(); wave++; phase = 'wave'; fk = F.k(); nextB.style.display = 'none'; tip.style.display = 'none';
  const n = waveSize(wave), lanes = wave === 1 ? [0] : wave === 2 ? [0, 1] : wave < 6 ? [0, 1, 2] : [0, 1, 2, 3, 4];
  spawnQ = [];
  for (let i = 0; i < n; i++) {
    const roll = r(); let t = 'blob';
    if (wave >= 2 && roll < 0.25) t = 'hopper'; else if (wave >= 3 && roll < 0.38) t = 'shell'; else if (wave >= 4 && roll < 0.5) t = 'spitter'; else if (wave >= 6 && roll < 0.6) t = 'splitter';
    spawnQ.push({ t, lane: lanes[Math.floor(r() * lanes.length)], delay: Math.max(0.28, 0.85 - wave * 0.035) / fk });
  }
  if (wave % 5 === 0) spawnQ.splice(Math.floor(n / 2), 0, { t: 'king', lane: 0, delay: 1 });
  spawnT = 0.5;
  say(wave % 5 === 0 ? `👑 WAVE ${wave}` : `WAVE ${wave}`, wave % 5 === 0 ? 'The King Slime is coming!' : `${n} slimes · lanes: ${lanes.map(l => LANES[l].name).join(' · ')}`, 1700);
  for (const l of lanes) ring(lanePt(l, ARENA + 1), '#b56bff', 1, 0.8, 6);
  tone(110, 0.5, 'sawtooth', 0.08, 1.5); setTimeout(() => tone(165, 0.5, 'sawtooth', 0.07, 1.4), 200);
  hud();
}
function spawnSlime(t, lane, at = null) {
  if (t === 'king') {
    const p = lanePt(lane, ARENA);
    boss = { t: 'king', p, hp: (1400 + wave * 260) * fk, max: (1400 + wave * 260) * fk, r: 2.6, sp: 1.25, slamT: 4, slam: 0, ph: 0, flash: 0, slow: 0, spawnT: 5, yaw: 0, hop: 0 };
    king.visible = true; king.position.copy(p); say('👑 KING SLIME', 'Dodge the slam rings!', 1500); sfx.smash(); shake.kick(0.4);
    return;
  }
  const T = ST[t], hpk = (1 + (wave - 1) * 0.13) * fk;
  const p = at ? at.clone() : lanePt(lane, ARENA + 0.5).add(new THREE.Vector3((r() - 0.5) * 2.5, 0, (r() - 0.5) * 2.5));
  slimes.push({ t, T, p, hp: T.hp * hpk, max: T.hp * hpk, lane, ph: r() * 6, flash: 0, slow: 0, yaw: 0, atk: 0, spit: 1 + r() * 2, vx: 0, vz: 0, kb: new THREE.Vector3() });
}
function waveCleared() {
  phase = 'build'; buildT = 15; const bonus = 12 + wave * 3; scrap += bonus;
  score += 1000; P.bestWave = Math.max(P.bestWave, wave); saveP();
  addScore(0); B.submit(score, { ms: performance.now() - t0 });   // best mode: a held wave is banked right away
  say(`WAVE ${wave} HELD!`, `+${bonus} ⚙️ scrap · build up`, 1700); sfx.win(); buzz([20, 40, 20]);
  for (let i = 0; i < 3; i++) setTimeout(() => spark(new THREE.Vector3(0, 3, 0), ['#7dffb0', '#ffd23f', '#9ff3ff', '#ffffff'], 30, 0.18, 0.15), i * 200);
  nextB.style.display = 'block'; nextB.textContent = `▶ START WAVE ${wave + 1}`; tip.style.display = 'block';
  if (wave % 3 === 0) offerCards();
  hud();
}

// ---------------------------------------------------------------- hero upgrades (pick 1 of 3)
const UPS = [
  { n: 'Rapid Foam', d: '+25% fire rate', f: () => h.rate *= 1.25 },
  { n: 'Heavy Foam', d: '+30% damage', f: () => h.dmg *= 1.3 },
  { n: 'Piercing Shots', d: 'shots pass through +1 slime', f: () => h.pierce++ },
  { n: 'Twin Barrel', d: '+1 shot per volley', f: () => h.multi++ },
  { n: 'Quick Boots', d: '+18% move speed', f: () => h.speed *= 1.18 },
  { n: 'Goo Recharge', d: 'goo bomb cooldown −30%', f: () => h.nadeCd *= 0.7 },
  { n: 'Core Patch', d: 'repair the core +35%', f: () => coreHp = Math.min(coreMax, coreHp + coreMax * 0.35) },
  { n: 'Long Barrel', d: '+20% range', f: () => h.range *= 1.2 },
];
let cardOpts = [];
function offerCards() {
  cardOpts = [...UPS].sort(() => Math.random() - 0.5).slice(0, 3);
  [...cards.querySelectorAll('.sw-card')].forEach(e => e.remove());
  for (const u of cardOpts) { const e = H(`<div class="sw-card">${u.n}<small>${u.d}</small></div>`, cards); e.addEventListener('click', () => pickCard(u)); }
  cards.style.display = 'flex'; sfx.coin();
}
function pickCard(u) { if (cards.style.display === 'none') return; u.f(); picks++; cards.style.display = 'none'; ui.pop(u.n.toUpperCase(), '#7dffb0', 30, 30); sfx.win(); hud(); }

// ---------------------------------------------------------------- build sheet
let sheetScrap = -1;
function openSheet(p) {
  sel = p; sheetScrap = scrap; const o = sheet.querySelector('.sw-opts'); o.innerHTML = '';
  if (!p.b) {
    sheet.querySelector('[data-t]').textContent = `Build · ⚙️ ${scrap}`;
    for (const [k, b] of Object.entries(BUILD)) {
      const locked = P.bestWave < b.need && wave < b.need, e = H(`<button class="sw-opt" ${locked || scrap < b.cost ? 'disabled' : ''}>${b.icon} ${b.name} <b>⚙️${b.cost}</b><small>${locked ? '🔒 reach wave ' + b.need : b.txt}</small></button>`, o);
      e.addEventListener('click', () => { if (!e.disabled) build(p, k); });
    }
  } else {
    const b = p.b, d = BUILD[b.type], c = upCost(b);
    sheet.querySelector('[data-t]').textContent = `${d.icon} ${d.name} · level ${b.lvl} · ⚙️ ${scrap}`;
    const up = H(`<button class="sw-opt" ${b.lvl >= 3 || scrap < c ? 'disabled' : ''}>⬆️ Upgrade <b>${b.lvl >= 3 ? 'MAX' : '⚙️' + c}</b><small>${b.type === 'wall' ? '+60% wall HP' : '+50% power, +range'}</small></button>`, o);
    up.addEventListener('click', () => { if (!up.disabled) upgrade(p); });
    const refund = Math.round(d.cost * 0.6 * b.lvl), sell = H(`<button class="sw-opt">♻️ Recycle <b>+⚙️${refund}</b><small>free the pad</small></button>`, o);
    sell.addEventListener('click', () => { scrap += refund; scene.remove(b.mesh); p.b = null; closeSheet(); sfx.tap(); hud(); });
  }
  sheet.style.display = 'flex';
}
function closeSheet() { sheet.style.display = 'none'; sel = null; }
function build(p, type) {
  const d = BUILD[type]; if (scrap < d.cost || p.b) return;
  scrap -= d.cost; const mesh = buildMesh(type); mesh.position.set(p.x, 0.12, p.z);
  if (type === 'wall') mesh.rotation.y = -LANES[p.lane].a - Math.PI / 2;
  scene.add(mesh); p.b = { type, lvl: 1, mesh, cd: 0, hp: d.hp || 0, max: d.hp || 0, yaw: 0, pop: 1 };
  ring(new THREE.Vector3(p.x, 0, p.z), '#7dffb0', 0.6, 0.5, 6); spark(new THREE.Vector3(p.x, 1, p.z), ['#7dffb0', '#ffffff', '#ffd23f'], 16, 0.1);
  sfx.coin(); buzz(15); closeSheet(); hud();
}
function upgrade(p) {
  const b = p.b, c = upCost(b); if (scrap < c || b.lvl >= 3) return;
  scrap -= c; b.lvl++; b.pop = 1; if (b.type === 'wall') { b.max *= 1.6; b.hp = b.max; }
  ring(new THREE.Vector3(p.x, 0, p.z), '#ffd23f', 0.6, 0.5, 6); spark(new THREE.Vector3(p.x, 1.5, p.z), ['#ffd23f', '#ffffff'], 14, 0.1); sfx.win(); closeSheet(); hud();
}
// tap a pad (tap = short press with no drag)
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let tapStart = null;
addEventListener('pointerdown', e => { tapStart = { x: e.clientX, y: e.clientY, t: performance.now() }; });
addEventListener('pointerup', e => {
  if (!tapStart || state !== 'play') return; const moved = Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y), dt = performance.now() - tapStart.t; tapStart = null;
  if (moved > 12 || dt > 350) return;
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const hit = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3()); if (!hit) return;
  let best = null, bd = 2.2; for (const p of PADS) { const d = Math.hypot(p.x - hit.x, p.z - hit.z); if (d < bd) { bd = d; best = p; } }
  if (best) { sfx.tap(); openSheet(best); } else if (sheet.style.display !== 'none') closeSheet();
});

// ---------------------------------------------------------------- combat
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
function targets() { return boss ? [...slimes, boss] : slimes; }
function nearestSlime(p, range) { let best = null, bd = range; for (const s of targets()) { const d = Math.hypot(s.p.x - p.x, s.p.z - p.z) - (s.t === 'king' ? 2 : 0); if (d < bd) { bd = d; best = s; } } return best; }
function hitSlime(s, dmg, src = 'hero', pos = null) {
  if (s.hp <= 0) return;
  if (s.T && s.T.armor && src !== 'hero') dmg *= s.T.armor;
  s.hp -= dmg; s.flash = 1;
  if (src === 'hero' || dmg >= 20) fl.add(Math.round(dmg), (pos || s.p).clone().setY(s.t === 'king' ? 4.5 : 1.8), dmg >= 25 ? '#ffd23f' : '#ffffff', dmg >= 25 ? 22 : 16);
  if (s.hp <= 0) popSlime(s);
}
function popSlime(s) {
  const T = s.T, col = s.t === 'king' ? '#4cd964' : T.col;
  spark(s.p.clone().setY(0.8), [col, '#ffffff', col, '#fff3b0'], s.t === 'king' ? 60 : 14, s.t === 'king' ? 0.25 : 0.12, 0.1);
  splats.spawn({ p: s.p.clone().setY(0.04 + Math.random() * 0.01), v: new THREE.Vector3(), life: 4, color: col, s: (s.t === 'king' ? 4 : T.r * 1.3) });
  kills++; P.kills++;
  const sc = s.t === 'king' ? 80 : T.scrap; scrap += sc; score += s.t === 'king' ? 500 : 10;
  fl.add(`+${sc}⚙️`, s.p.clone().setY(1.2), '#ffd23f', 16);
  tone(300 + Math.random() * 200, 0.12, 'sine', 0.07, 2.2);
  if (s.t === 'king') { boss = null; king.visible = false; say('👑 KING POPPED!', `+80 ⚙️ · +500`, 1600); sfx.win(); shake.kick(0.6); buzz([30, 30, 60]); for (let i = 0; i < 6; i++) spawnSlime('mini', 0, s.p.clone().add(new THREE.Vector3(Math.cos(i) * 2, 0, Math.sin(i) * 2))); }
  else { const i = slimes.indexOf(s); if (i >= 0) slimes.splice(i, 1); if (T.split) for (let k = 0; k < T.split; k++) spawnSlime('mini', s.lane, s.p.clone().add(new THREE.Vector3(Math.cos(k * 2.1) * 0.8, 0, Math.sin(k * 2.1) * 0.8))); }
  addScore(0); hud();
}
function addScore() {
  scoreEl.textContent = `SCORE ${score}`;
  if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); spark(h.p.clone().setY(2), ['#ff5d8f', '#ffd23f', '#3ab795', '#3a86ff'], 40, 0.2, 0.15); }
}
function heroShoot(yaw) {
  h.cd = 1 / h.rate; hero.recoil(); hero.updateMatrixWorld(); hero.muzzle.getWorldPosition(tmp); tmp.y = 1.1;
  for (let k = 0; k < h.multi; k++) { const a = yaw + (k - (h.multi - 1) / 2) * 0.12 + (Math.random() - 0.5) * 0.04; bullets.spawn({ p: tmp.clone(), v: new THREE.Vector3(Math.sin(a), 0, Math.cos(a)).multiplyScalar(30), life: h.range / 30, dmg: h.dmg, pierce: h.pierce, hit: new Set(), color: '#ffe066', s: 1.2, src: 'hero' }); }
  tone(820 + Math.random() * 80, 0.04, 'square', 0.035, 0.5); shake.kick(0.02);
}
function throwNade() {
  if (state !== 'play' || !h.alive || nadeCd > 0 || nadeF) return;
  const t = nearestSlime(h.p, 14), to = t ? t.p.clone() : h.p.clone().add(new THREE.Vector3(Math.sin(h.yaw) * 8, 0, Math.cos(h.yaw) * 8));
  nadeF = { from: h.p.clone().setY(1.5), to, t: 0 }; nade.visible = true; nadeCd = h.nadeCd; tone(500, 0.12, 'sine', 0.08, 1.6);
}
function dash() {
  if (state !== 'play' || !h.alive || dashCd > 0) return;
  dashCd = 2.6; h.dashT = 0.22; const mx = ctl.mx, mz = -ctl.my, l = Math.hypot(mx, mz);
  h.dashDir = l > 0.2 ? new THREE.Vector3(mx / l, 0, mz / l) : new THREE.Vector3(Math.sin(h.yaw), 0, Math.cos(h.yaw));
  tone(300, 0.15, 'triangle', 0.08, 2); ring(h.p, '#ff9f1c', 0.5, 0.3, 6);
}
function hurtHero(d) {
  if (!h.alive || h.dashT > 0) return; h.hp -= d; h.lastHit = 0; hero.flash('#ff4d6d', 1); hurtV = 0.6; shake.kick(0.1); buzz(10);
  if (h.hp <= 0) { h.alive = false; h.respawn = 4; hero.visible = false; spark(h.p.clone().setY(1), ['#2ec4b6', '#ff9f1c', '#ffffff'], 24, 0.15); say('DOWNED', 'Rebooting at the core in 4 s', 1500); sfx.fail(); }
}
function hurtCore(d) {
  coreHp -= d; coreGem.material.emissiveIntensity = 1.6; hurtV = Math.max(hurtV, 0.3);
  if (coreHp <= 0 && state === 'play') gameOver();
}
function gameOver() {
  state = 'lost'; coreHp = 0; showHud(false); song.intensity = 0.15;
  spark(new THREE.Vector3(0, 2.5, 0), ['#7df9ff', '#ffffff', '#b56bff'], 70, 0.25, 0.2); shake.kick(0.8); sfx.fail(); buzz([60, 40, 120]); coreGem.visible = false;
  if (!recorded) { recorded = true; F.endless(score); B.submit(score, { ms: performance.now() - t0 }); }
  const held = Math.max(0, wave - 1), nb = score > P.best; P.best = Math.max(P.best, score); P.bestWave = Math.max(P.bestWave, held); P.runs++; saveP();
  const unl = KITS.find(k => k.need > 0 && held >= k.need && held - 1 < k.need) || (held >= 4 && held - 1 < 4 ? { name: 'Frost turret' } : held >= 8 && held - 1 < 8 ? { name: 'Spark tower' } : null);
  ui.lose('CORE OVERRUN', `Held ${held} wave${held === 1 ? '' : 's'} · ${kills} slimes popped · score ${score}${nb ? ' · NEW BEST' : ''}${unl ? ` · ${unl.name} unlocked` : ''}`);
}

// ---------------------------------------------------------------- update
const DM = new THREE.Object3D(), CC = new THREE.Color(), FROSTC = new THREE.Color(0.7, 0.9, 1), WHITEC = new THREE.Color(1, 1, 1);
function aimFromMouse(mx, my) {
  ndc.set(mx / innerWidth * 2 - 1, -(my / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const p = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -1), tmp2); return p ? Math.atan2(p.x - h.p.x, p.z - h.p.z) : h.yaw;
}
function updateHero(s, dt) {
  if (!h.alive) { h.respawn -= s; if (h.respawn <= 0) { h.alive = true; h.hp = 100; h.p.set(0, 0, 4); hero.visible = true; hero.flash('#7dffb0', 1.5); ring(h.p, '#7dffb0', 0.5, 0.5, 8); } return; }
  h.cd -= s; h.lastHit += s; if (h.lastHit > 3 && h.hp < 100) h.hp = Math.min(100, h.hp + 12 * s);
  let mx = ctl.mx, mz = -ctl.my; const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
  let sp = h.speed;
  if (h.dashT > 0) { h.dashT -= s; mx = h.dashDir.x * 3.2; mz = h.dashDir.z * 3.2; spark(h.p.clone().setY(0.5), ['#ff9f1c', '#ffffff'], 1, 0.02, 0.02); }
  h.vel.x = lerp(h.vel.x, mx * sp, Math.min(1, 14 * s)); h.vel.z = lerp(h.vel.z, mz * sp, Math.min(1, 14 * s));
  h.p.x += h.vel.x * s; h.p.z += h.vel.z * s;
  const d = Math.hypot(h.p.x, h.p.z); if (d > ARENA) { h.p.x *= ARENA / d; h.p.z *= ARENA / d; }
  if (d < CORE_R + 0.7) { const k = (CORE_R + 0.7) / Math.max(d, 0.01); h.p.x *= k; h.p.z *= k; }
  for (const p of PADS) if (p.b) { const dx = h.p.x - p.x, dz = h.p.z - p.z, dd = Math.hypot(dx, dz), m = p.b.type === 'wall' ? 1.4 : 1.2; if (dd < m && dd > 1e-4) { h.p.x += dx / dd * (m - dd); h.p.z += dz / dd * (m - dd); } }
  // aim: manual stick / mouse first, else auto-aim at the nearest slime
  let yaw = null;
  if (ctl.touch && ctl.aiming) yaw = Math.atan2(ctl.ax, -ctl.ay);
  else if (!ctl.touch && ctl.mouse && ctl.fire) yaw = aimFromMouse(ctl.mouse.x, ctl.mouse.y);
  const t = nearestSlime(h.p, h.range);
  if (yaw === null && t) yaw = Math.atan2(t.p.x - h.p.x, t.p.z - h.p.z);
  if (yaw !== null) { h.yaw += clamp(angDiff(h.yaw, yaw), -12 * s, 12 * s); if (h.cd <= 0 && Math.abs(angDiff(h.yaw, yaw)) < 0.35 && (t || ctl.fire)) heroShoot(h.yaw); }
  else if (l > 0.1) h.yaw += clamp(angDiff(h.yaw, Math.atan2(mx, mz)), -10 * s, 10 * s);
  hero.position.set(h.p.x, 0, h.p.z); hero.rotation.y = h.yaw; h.walkT += s * (0.4 + Math.hypot(h.vel.x, h.vel.z) / 7); hero.walk(h.walkT, Math.min(1, Math.hypot(h.vel.x, h.vel.z) / 5)); hero.update(dt);
}
function slimeTarget(sl) {   // walls on the lane first, then the hero if close, else the core
  for (const p of PADS) if (p.b && p.b.type === 'wall' && Math.hypot(p.x - sl.p.x, p.z - sl.p.z) < 2.4 + sl.r) return { kind: 'wall', p: new THREE.Vector3(p.x, 0, p.z), pad: p };
  if (h.alive && Math.hypot(h.p.x - sl.p.x, h.p.z - sl.p.z) < 4.5) return { kind: 'hero', p: h.p };
  return { kind: 'core', p: new THREE.Vector3(0, 0, 0) };
}
function updateSlimes(s, tt) {
  const all = slimes;
  for (const sl of all) {
    const T = sl.T; sl.r = T.r; sl.flash = Math.max(0, sl.flash - s * 6); sl.slow = Math.max(0, sl.slow - s); sl.ph += s * (T.sp * 1.6);
    const tg = slimeTarget(sl), dx = tg.p.x - sl.p.x, dz = tg.p.z - sl.p.z, d = Math.hypot(dx, dz), reach = tg.kind === 'core' ? CORE_R + T.r : tg.kind === 'wall' ? 1.2 + T.r : 0.6 + T.r;
    sl.yaw = Math.atan2(dx, dz);
    const sp = T.sp * (sl.slow > 0 ? 0.45 : 1);
    if (T.ranged && tg.kind !== 'wall' && d < T.ranged) {
      sl.spit -= s; if (sl.spit <= 0) { sl.spit = 2.4; goos.spawn({ p: sl.p.clone().setY(0.9), from: sl.p.clone().setY(0.9), to: tg.p.clone(), v: new THREE.Vector3(), life: 1, t: 0, dur: Math.max(0.5, d / 10), tk: tg.kind, dmg: T.dmg * 1.4, s: 1 }); tone(240, 0.1, 'sine', 0.04, 1.6); }
    } else if (d > reach) { const hop = Math.max(0, Math.sin(sl.ph * 2)); sl.vx = dx / d * sp * (0.4 + hop); sl.vz = dz / d * sp * (0.4 + hop); }
    else { sl.vx = 0; sl.vz = 0; sl.atk -= s; if (sl.atk <= 0) { sl.atk = 1; if (tg.kind === 'core') hurtCore(T.dmg * 2.2); else if (tg.kind === 'hero') hurtHero(T.dmg); else { tg.pad.b.hp -= T.dmg * 1.8; tg.pad.b.pop = 0.5; if (tg.pad.b.hp <= 0) wreck(tg.pad); } } }
    sl.p.x += (sl.vx + sl.kb.x) * s; sl.p.z += (sl.vz + sl.kb.z) * s; sl.kb.multiplyScalar(Math.pow(0.02, s));
  }
  // separation (cheap grid)
  const cell = new Map();
  for (const sl of all) { const k = Math.floor(sl.p.x / 2) * 1000 + Math.floor(sl.p.z / 2); if (!cell.has(k)) cell.set(k, []); cell.get(k).push(sl); }
  for (const sl of all) {
    const cx = Math.floor(sl.p.x / 2), cz = Math.floor(sl.p.z / 2);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const l = cell.get((cx + i) * 1000 + cz + j); if (!l) continue; for (const o of l) { if (o === sl) continue; const dx = sl.p.x - o.p.x, dz = sl.p.z - o.p.z, d = Math.hypot(dx, dz), m = (sl.r + o.r) * 0.85; if (d < m && d > 1e-4) { sl.p.x += dx / d * (m - d) * 0.35; sl.p.z += dz / d * (m - d) * 0.35; } } }
    const dc = Math.hypot(sl.p.x, sl.p.z); if (dc < CORE_R + sl.r * 0.8) { const k = (CORE_R + sl.r * 0.8) / dc; sl.p.x *= k; sl.p.z *= k; }
    for (const p of PADS) if (p.b) { const dx = sl.p.x - p.x, dz = sl.p.z - p.z, dd = Math.hypot(dx, dz), m = (p.b.type === 'wall' ? 1.35 : 1.0) + sl.r * 0.7; if (dd < m && dd > 1e-4) { sl.p.x += dx / dd * (m - dd); sl.p.z += dz / dd * (m - dd); } }
  }
  // instanced draw
  let si = 0;
  for (const sl of all) {
    if (si >= MAXS) break;
    const hop = Math.max(0, Math.sin(sl.ph * 2)), sq = 1 + (hop > 0.05 ? 0.18 * hop : -0.12 * Math.min(1, Math.abs(Math.sin(sl.ph * 2)) * 3));
    const R = sl.r;
    DM.position.set(sl.p.x, hop * 0.6 * (sl.T.sp > 4 ? 1.6 : 1), sl.p.z); DM.rotation.set(0, sl.yaw, 0); DM.scale.set(R / Math.sqrt(sq), R * sq, R / Math.sqrt(sq)); DM.updateMatrix();
    slimeBody.setMatrixAt(si, DM.matrix); slimeEyes.setMatrixAt(si, DM.matrix);
    CC.set(sl.T.col); if (sl.slow > 0) CC.lerp(FROSTC, 0.5); if (sl.flash > 0) CC.lerp(WHITEC, sl.flash * 0.8);
    slimeBody.setColorAt(si, CC); si++;
  }
  slimeBody.count = slimeEyes.count = si; slimeBody.instanceMatrix.needsUpdate = slimeEyes.instanceMatrix.needsUpdate = true; slimeBody.instanceColor.needsUpdate = true;
  let shI = 0; for (let i = 0; i < Math.min(all.length, MAXS); i++) if (all[i].t === 'shell' && shI < 60) { slimeBody.getMatrixAt(i, DM.matrix); slimeShell.setMatrixAt(shI++, DM.matrix); }
  slimeShell.count = shI; slimeShell.instanceMatrix.needsUpdate = true;
}
function updateBoss(s) {
  const b = boss; if (!b) return;
  b.flash = Math.max(0, b.flash - s * 6); b.ph += s * 1.6; b.slow = Math.max(0, b.slow - s);
  const tgt = h.alive && Math.hypot(h.p.x - b.p.x, h.p.z - b.p.z) < 9 ? h.p : tmp2.set(0, 0, 0), dx = tgt.x - b.p.x, dz = tgt.z - b.p.z, d = Math.hypot(dx, dz);
  b.yaw = Math.atan2(dx, dz);
  if (b.slam > 0) { b.slam -= s; if (b.slam <= 0) { // land the slam
      ring(b.p, '#ffffff', 1, 0.5, 14); spark(b.p.clone().setY(0.5), ['#4cd964', '#ffffff', '#ffd23f'], 30, 0.22, 0.08); shake.kick(0.6); sfx.smash(); buzz(40);
      if (h.alive && Math.hypot(h.p.x - b.p.x, h.p.z - b.p.z) < 5.5) hurtHero(30);
      for (const p of PADS) if (p.b && Math.hypot(p.x - b.p.x, p.z - b.p.z) < 5.5) { p.b.hp = (p.b.hp || 0) - 120; if (p.b.type === 'wall' && p.b.hp <= 0) wreck(p); }
      if (Math.hypot(b.p.x, b.p.z) < 5.5 + CORE_R) hurtCore(60);
    } }
  else {
    b.slamT -= s; b.spawnT -= s;
    if (b.slamT <= 0 && d < 7) { b.slamT = 5.5; b.slam = 1.2; ring(b.p, '#ff4d6d', 5.5, 1.2, 0); tone(80, 1, 'sawtooth', 0.08, 2); }
    else if (d > CORE_R + 2.2) { const sp = b.sp * (b.slow > 0 ? 0.5 : 1); b.p.x += dx / d * sp * s; b.p.z += dz / d * sp * s; }
    else { b.atk = (b.atk || 0) - s; if (b.atk <= 0) { b.atk = 1.2; hurtCore(45); } }
    if (b.spawnT <= 0) { b.spawnT = 6; for (let k = 0; k < 3; k++) spawnSlime('blob', 0, b.p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 0, (Math.random() - 0.5) * 4))); }
  }
  const up = b.slam > 0 ? Math.sin((1 - b.slam / 1.2) * Math.PI) * 3 : Math.max(0, Math.sin(b.ph * 2)) * 0.4;
  king.position.set(b.p.x, up, b.p.z); king.rotation.y = b.yaw; const sq = b.slam > 0 ? 0.85 : 1 + Math.sin(b.ph * 2) * 0.06; king.scale.set(b.r / Math.sqrt(sq), b.r * sq, b.r / Math.sqrt(sq));
  kingBody.material.emissiveIntensity = b.flash * 0.6; kingBody.material.color.set(b.slow > 0 ? '#9ee6c0' : '#4cd964');
}
function wreck(p) { spark(new THREE.Vector3(p.x, 1, p.z), ['#c98e52', '#8a5a32', '#ffffff'], 20, 0.14); scene.remove(p.b.mesh); p.b = null; sfx.smash(); hud(); }
function updateBuildings(s, tt) {
  for (const p of PADS) {
    const b = p.b; if (!b) continue;
    b.pop = Math.max(0, b.pop - s * 3); b.mesh.scale.setScalar(1 + b.pop * 0.25);
    if (b.type === 'wall') continue;
    const d = BUILD[b.type], k = 1 + (b.lvl - 1) * 0.5, range = d.range * (1 + (b.lvl - 1) * 0.12);
    b.cd -= s; const t = nearestSlime(new THREE.Vector3(p.x, 0, p.z), range);
    if (b.type === 'frost') { b.mesh.head.rotation.y += s * 2; if (t && b.cd <= 0) { b.cd = 1 / d.rate; ring(new THREE.Vector3(p.x, 0, p.z), '#9ff3ff', 1, 0.5, range * 1.6); for (const sl of targets()) if (Math.hypot(sl.p.x - p.x, sl.p.z - p.z) < range) { sl.slow = 1.6; hitSlime(sl, d.dmg * k, 'turret'); } tone(1400, 0.08, 'sine', 0.025, 0.5); } continue; }
    if (!t) continue;
    const yaw = Math.atan2(t.p.x - p.x, t.p.z - p.z); b.yaw += clamp(angDiff(b.yaw, yaw), -8 * s, 8 * s); b.mesh.head.rotation.y = b.yaw;
    if (b.cd > 0) continue;
    b.cd = 1 / (d.rate * (1 + (b.lvl - 1) * 0.25));
    if (b.type === 'blaster') { const from = new THREE.Vector3(p.x + Math.sin(b.yaw) * 0.7, 1.25, p.z + Math.cos(b.yaw) * 0.7); bullets.spawn({ p: from, v: new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(26), life: range / 26 + 0.1, dmg: d.dmg * k, pierce: 0, hit: new Set(), color: '#ff8c42', s: 1, src: 'turret' }); tone(600, 0.03, 'square', 0.02, 0.6); }
    else if (b.type === 'spark') {
      let cur = t, from = new THREE.Vector3(p.x, 2.5, p.z); const hitL = new Set();
      for (let j = 0; j < 3 && cur; j++) { hitL.add(cur); zapList.push({ a: from.clone(), b: cur.p.clone().setY(1), t: 0.15 }); hitSlime(cur, d.dmg * k, 'turret'); from = cur.p.clone().setY(1); let nb = null, nd = 5; for (const o of targets()) if (!hitL.has(o) && o.hp > 0) { const dd = Math.hypot(o.p.x - cur.p.x, o.p.z - cur.p.z); if (dd < nd) { nd = dd; nb = o; } } cur = nb; }
      tone(1800, 0.08, 'sawtooth', 0.03, 0.4);
    }
  }
}
function updatePools(s, dt) {
  bullets.update(dt, b => {
    b.life -= s; if (b.life <= 0) return false; b.p.addScaledVector(b.v, s);
    for (const sl of targets()) {
      if (b.hit.has(sl)) continue; const rr = sl.t === 'king' ? sl.r * 0.8 : sl.r;
      if (Math.abs(sl.p.x - b.p.x) < rr + 0.2 && Math.abs(sl.p.z - b.p.z) < rr + 0.2 && Math.hypot(sl.p.x - b.p.x, sl.p.z - b.p.z) < rr + 0.2) {
        b.hit.add(sl); if (sl.kb && b.src === 'hero') sl.kb.addScaledVector(tmp.copy(b.v).normalize(), 2.2);
        spark(b.p.clone(), [sl.T ? sl.T.col : '#4cd964', '#ffffff'], 3, 0.06, 0.04); hitSlime(sl, b.dmg, b.src, b.p);
        if (b.pierce-- <= 0) return false;
      }
    }
  });
  goos.update(dt, g => { g.t += s; const k = Math.min(1, g.t / g.dur); g.p.lerpVectors(g.from, g.to, k); g.p.y = 0.9 + Math.sin(k * Math.PI) * 3; if (k >= 1) { splats.spawn({ p: g.to.clone().setY(0.05), v: new THREE.Vector3(), life: 2, color: '#ff6fb1', s: 1 }); if (g.tk === 'core') hurtCore(g.dmg); else if (g.tk === 'hero' && h.alive && Math.hypot(h.p.x - g.to.x, h.p.z - g.to.z) < 1.4) hurtHero(g.dmg); return false; } });
  sparks.update(dt, p => { p.life -= s; p.v.y -= 16 * s; p.p.addScaledVector(p.v, s); if (p.p.y < 0.05) { p.p.y = 0.05; p.v.y *= -0.4; p.v.x *= 0.7; p.v.z *= 0.7; } p.s = Math.max(0.01, p.life * 1.8); return p.life > 0; });
  rings.update(dt, p => { p.life -= s; p.s += p.grow * s; return p.life > 0; });
  splats.update(dt, p => { p.life -= s; return p.life > 0; });
  // spark chains
  const arr = zapGeo.attributes.position.array; let n = 0;
  zapList = zapList.filter(z => (z.t -= s) > 0);
  for (const z of zapList) { let a = z.a.clone(); for (let k = 1; k <= 6 && n < 64 * 6; k++) { const b = z.a.clone().lerp(z.b, k / 6); if (k < 6) b.add(new THREE.Vector3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6)); arr.set([a.x, a.y, a.z, b.x, b.y, b.z], n * 6); n++; a = b; } }
  zapGeo.setDrawRange(0, n * 2); zapGeo.attributes.position.needsUpdate = true;
}

// ---------------------------------------------------------------- HUD paint
function hud() {
  top.querySelector('[data-w]').textContent = phase === 'build' ? (wave ? `WAVE ${wave} HELD · BUILD ${Math.ceil(buildT)}s` : `GET READY · ${Math.ceil(buildT)}s`) : `WAVE ${wave} · ${slimes.length + spawnQ.length + (boss ? 1 : 0)} LEFT`;
  const c = top.querySelector('.sw-core'); c.querySelector('i').style.width = Math.max(0, coreHp / coreMax * 100) + '%'; c.classList.toggle('low', coreHp < coreMax * 0.3);
  scrapEl.textContent = `⚙️ ${scrap}`; scoreEl.textContent = `SCORE ${score}`;
  if (h) hpEl.querySelector('i').style.width = Math.max(0, h.hp) + '%';
  for (const p of PADS) { const can = !p.b && scrap >= 20; p.top.emissiveIntensity = p.b ? 0 : can ? 0.45 : 0.05; }
  if (sel && sheetScrap !== scrap) openSheet(sel);
}

// ---------------------------------------------------------------- main loop
let tt = 0;
loop((dt) => {
  const s = dt / 60; tt += s;
  ctl.poll();
  coreGem.rotation.y += s * 0.8; coreGem.position.y = 2.6 + Math.sin(tt * 2) * 0.15; coreRing.rotation.z += s; coreGem.material.emissiveIntensity = lerp(coreGem.material.emissiveIntensity, 0.6, 0.1);
  for (const l of LANES) l.goo.rotation.z += s;
  for (const p of PADS) if (!p.b) p.mesh.position.y = 0.07 + Math.sin(tt * 3 + p.id) * 0.03;
  if (state === 'play') {
    demoFight();
    nadeCd = Math.max(0, nadeCd - s); dashCd = Math.max(0, dashCd - s);
    nadeB.cool(nadeCd / h.nadeCd); dashB.cool(dashCd / 2.6);
    if (phase === 'build') { if (cards.style.display === 'none') buildT -= s; if (buildT <= 0) startWave(); }
    else {
      spawnT -= s;
      if (spawnQ.length && spawnT <= 0) { const q = spawnQ.shift(); spawnSlime(q.t, q.lane); spawnT = q.delay; }
      if (!spawnQ.length && !slimes.length && !boss) waveCleared();
    }
    updateHero(s, dt); updateSlimes(s, tt); updateBoss(s); updateBuildings(s, tt);
    if (nadeF) { nadeF.t += s / 0.7; const k = Math.min(1, nadeF.t); nade.position.lerpVectors(nadeF.from, nadeF.to, k); nade.position.y = 1.5 + Math.sin(k * Math.PI) * 4 - k * 1.2; nade.rotation.x += 0.3 * dt;
      if (k >= 1) { nade.visible = false; const c = nadeF.to; nadeF = null; ring(c, '#7dffb0', 0.6, 0.5, 12); spark(c.clone().setY(0.6), ['#7dffb0', '#ffffff', '#bfffd8'], 34, 0.2, 0.12); splats.spawn({ p: c.clone().setY(0.05), v: new THREE.Vector3(), life: 3, color: '#7dffb0', s: 3.5 }); sfx.smash(); shake.kick(0.35); buzz(25);
        for (const sl of [...targets()]) { const d = Math.hypot(sl.p.x - c.x, sl.p.z - c.z); if (d < 4.6 + (sl.t === 'king' ? 2 : 0)) { if (sl.kb) sl.kb.add(tmp.set(sl.p.x - c.x, 0, sl.p.z - c.z).normalize().multiplyScalar(9)); hitSlime(sl, 60 * (h.dmg / 10) * (1 - d / 7), 'hero'); } } } }
    song.intensity = phase === 'build' ? 0.3 : 0.55 + Math.min(0.4, slimes.length / 60) + (boss ? 0.2 : 0);
    if (Math.floor(tt * 4) !== Math.floor((tt - s) * 4)) hud();
  }
  updatePools(s, dt);
  // camera: tilted top-down chase, biased north toward the portals
  const fx = h ? h.p.x * 0.85 : 0, fz = h ? h.p.z * 0.85 - 3 : -3;
  const want = state === 'ready' ? tmp.set(Math.sin(tt * 0.2) * 6, 26, 22) : tmp.set(fx, 26, fz + 18);
  camera.position.lerp(want, state === 'ready' ? 0.03 : 0.1); camera.lookAt(camera.position.x, 0, camera.position.z - (state === 'ready' ? 26 : 18));
  shake.apply(camera, dt); S.followLight(tmp.set(h ? h.p.x * 0.6 : 0, 0, h ? h.p.z * 0.6 - 4 : -4));
  bars.begin();
  if (boss) bars.add(tmp.set(boss.p.x, 6.2, boss.p.z), boss.hp / boss.max, '#ff4d6d', 3);
  for (const sl of slimes) if (sl.hp < sl.max) bars.add(tmp.set(sl.p.x, sl.r * 2 + 0.6, sl.p.z), sl.hp / sl.max, '#ff5d5d', 0.9);
  for (const p of PADS) if (p.b && p.b.type === 'wall' && p.b.hp < p.b.max) bars.add(tmp.set(p.x, 2.4, p.z), p.b.hp / p.b.max, '#ffd23f', 1.6);
  bars.end();
  fl.update(dt);
  heroTick(s);
  hurtV = Math.max(0, hurtV - s * 1.4); vign(state === 'play' ? Math.max(hurtV, coreHp < coreMax * 0.25 ? 0.25 + Math.sin(tt * 6) * 0.1 : 0) : 0);
});

ui.onTap(w => { if (w === 'lose') { newRun(); coreGem.visible = true; } begin(); });
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on a fresh run, until the first touch,
// wave 1 is sent in (the ▶ button) and the hero runs out between the core and the nearest slime, auto-firing, for a few seconds
const DEMO = demo(null, { ready: () => state === 'play' && wave <= 1 && P.bestWave < 2 && !D.seed && cards.style.display === 'none' && h.alive, wait: 1500, ms: 4500 });
function demoFight() {
  if (!DEMO.on) return;
  if (phase === 'build') { if (wave === 0) startWave(); return; }
  const t = nearestSlime(h.p, 40); let gx = 0, gz = 4;
  if (t) { const a = Math.atan2(t.p.z, t.p.x), k = Math.min(Math.hypot(t.p.x, t.p.z) - 6, 12); gx = Math.cos(a) * Math.max(4, k); gz = Math.sin(a) * Math.max(4, k); }
  const dx = gx - h.p.x, dz = gz - h.p.z, d = Math.hypot(dx, dz);
  ctl.drive(d > 1 ? { mx: dx / d, my: -dz / d } : { mx: 0, my: 0 });
}
newRun(); showHud(false); ui.start();
// hero bar on the start card, under the loadout chips and above "tap to hold the line"
{ const hb = heroBar({ parent: ui.els.start, onPick: () => useHero() }); hb.el.style.width = 'min(360px,100%)'; ui.els.start.querySelector('.hint').before(hb.el); }
onHeroesChange(() => { if (JSON.stringify(selectedHero()) !== myShown) useHero(); });
useHero();

// ---------------------------------------------------------------- test hooks + bot
window.__game = {
  get state() { return state; }, get level() { return Math.max(1, wave); }, get score() { return score; },
  get dbg() { return { wave, phase, core: Math.round(coreHp), scrap, slimes: slimes.length, boss: !!boss, kills, built: PADS.filter(p => p.b).map(p => p.b.type + p.b.lvl).join(','), draw: renderer.info.render.calls }; },
  bot() {
    if (state !== 'play') return;
    if (cards.style.display !== 'none') { pickCard(cardOpts[0]); return; }
    // spend scrap: blasters on the inner pads, then walls/frost/spark, then upgrades
    const order = [0, 2, 4, 1, 3, 5, 6, 7, 8];
    for (const i of order) { const p = PADS[i]; if (p.b) continue; const want = (i === 1 || i === 3 || i === 5) && wave >= 2 ? 'wall' : wave >= 4 && i >= 6 && (P.bestWave >= 8 || wave >= 8) ? 'spark' : wave >= 4 && i >= 6 ? 'frost' : 'blaster'; if (scrap >= BUILD[want].cost && (P.bestWave >= BUILD[want].need || wave >= BUILD[want].need)) { build(p, want); return; } break; }
    for (const i of order) { const p = PADS[i]; if (p.b && p.b.lvl < 3 && scrap >= upCost(p.b) + 10) { upgrade(p); return; } }
    if (phase === 'build' && (buildT < 13 || wave === 0)) { startWave(); return; }
    if (!h.alive) return;
    // fight: hold a spot between the core and the nearest slime, kite if crowded
    const t = nearestSlime(h.p, 40); let gx = 0, gz = 4;
    if (t) { const a = Math.atan2(t.p.z, t.p.x), dT = Math.hypot(t.p.x, t.p.z); const k = Math.min(dT - 6, 12); gx = Math.cos(a) * Math.max(4, k); gz = Math.sin(a) * Math.max(4, k); const close = slimes.filter(sl => Math.hypot(sl.p.x - h.p.x, sl.p.z - h.p.z) < 3.5).length; if (close >= 2) { gx = h.p.x - (t.p.x - h.p.x); gz = h.p.z - (t.p.z - h.p.z); } if (nadeCd <= 0 && slimes.filter(sl => Math.hypot(sl.p.x - t.p.x, sl.p.z - t.p.z) < 4).length >= 4) throwNade(); if (close >= 3 && dashCd <= 0) dash(); }
    const dx = gx - h.p.x, dz = gz - h.p.z, d = Math.hypot(dx, dz);
    ctl.drive(d > 1 ? { mx: dx / d, my: -dz / d } : { mx: 0, my: 0 });
  },
};
