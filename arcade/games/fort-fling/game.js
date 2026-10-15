// Fort Fling — original game. Pull back the wooden slingshot, fling fruit at the greedy raccoons hiding in
// block forts of wood, glass and stone, and knock every last bandit out before you run out of fruit.
import { THREE, createStage, createUI, input, loop, sfx, tone, buzz, store, rng, lerp, clamp, mat, glossy, rounded, burst, confetti } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { board } from './kit/board.js';
import { World, makeBox, makeCircle } from './physics.js';

const stage = createStage({ fov: 40, shadows: true, shadowSize: 14 });
const { scene, camera, sun } = stage;
const ui = createUI({ title: 'FORT<br>FLING', hint: 'Pull back & let go', hand: '👈' });
const css = document.createElement('style');
css.textContent = `body{--bg1:#5fb8f0;--bg2:#ffe6c2;--ui:#ff7a2f}
.hc-score{color:#fff;text-shadow:0 4px 0 rgba(20,70,120,.25)} .hc-sub{color:#fff;font-weight:800;text-shadow:0 2px 0 rgba(20,70,120,.25)}
.hc-pill{background:rgba(255,255,255,.55);color:#38506b;top:calc(54px + env(safe-area-inset-top));font-size:20px;letter-spacing:1px}
.hc-card h1{color:#fff;text-shadow:0 6px 0 rgba(200,80,20,.55),0 0 2px #c55}
.hc-card p,.hc-card .hint{color:#fff;text-shadow:0 2px 0 rgba(20,70,120,.3)}
.hc-card.dim{background:rgba(20,40,70,.28)} .hc-lvl.next{color:#ff7a2f}
.flt{position:fixed;font-weight:800;pointer-events:none;z-index:6;transform:translate(-50%,-50%);animation:fltup 1s ease-out forwards;color:#fff;
  -webkit-text-stroke:1.5px rgba(120,60,0,.5);text-shadow:0 3px 0 rgba(90,40,0,.3)}
@keyframes fltup{0%{opacity:0;transform:translate(-50%,-30%) scale(.5)}15%{opacity:1;transform:translate(-50%,-60%) scale(1.2)}100%{opacity:0;transform:translate(-50%,-170%) scale(1)}}`;
document.head.appendChild(css);
const save = store('fortfling');
const F = flow('fortfling');
const B = board({ game: 'fort-fling', label: 'Points', limits: { maxRun: 150000, maxPerSec: 30000 }, mode: 'sum' });
let fk = 1;
let level = +new URLSearchParams(location.search).get('level') || save.get('level', 1), best = save.get('best', 0);
let state = 'ready', score = 0, shots = 3, totalRac = 1;

// ------------------------------------------------------------------ scenery
stage.hemi.color.set('#ffffff'); stage.hemi.groundColor.set('#d8f0c8'); stage.hemi.intensity = 1.25; sun.intensity = 1.6;
scene.fog = new THREE.Fog('#f3e6cf', 40, 130);
{
  const top = mat('#86d65a', { roughness: 0.9 }), earth = mat('#d59a5c', { roughness: 0.95 }), dark = mat('#c08048');
  const slab = new THREE.Mesh(new THREE.BoxGeometry(240, 60, 40), [earth, earth, top, earth, earth, earth]);
  slab.position.set(20, -30, -18.6); slab.receiveShadow = true; scene.add(slab);
  const strata = ['#c98d52', '#bb7f47', '#ad723f', '#9e6638'];
  for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(240, 30), mat(strata[i], { roughness: 1 })); s.position.set(20, -4.2 - i * 4.2 - 15, 1.405 + i * 0.001); scene.add(s); }
  const pebM = [mat('#e3c7a0'), mat('#8f5c33'), mat('#d9b48a')], pg = new THREE.SphereGeometry(1, 10, 8), Rp = rng(3);
  for (let i = 0; i < 70; i++) { const pb = new THREE.Mesh(pg, pebM[i % 3]); const sc = 0.12 + Rp() * 0.35; pb.scale.set(sc * 1.4, sc, 0.15); pb.position.set(-14 + Rp() * 44, -0.8 - Rp() * 16, 1.43); scene.add(pb); }
  const lip = new THREE.Mesh(rounded(240, 0.35, 0.6, 0.15), mat('#6cc04a')); lip.position.set(20, -0.08, 1.15); scene.add(lip);
  // earth stripes on the front face
  
  const hillM = [mat('#a6e07c', { roughness: 1 }), mat('#93d36d', { roughness: 1 }), mat('#bde8a0', { roughness: 1 })];
  const R = rng(7);
  for (let i = 0; i < 12; i++) { const h = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), hillM[i % 3]); const s = 8 + R() * 10; h.scale.set(s * 1.6, s * (0.7 + R() * 0.5), s); h.position.set(-30 + i * 9 + R() * 4, -s * 0.25, -32 - R() * 18); scene.add(h); }
  const farM = [mat('#9fd0c4', { roughness: 1 }), mat('#b5dcd0', { roughness: 1 })];
  for (let i = 0; i < 8; i++) { const h = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10), farM[i % 2]); const s = 14 + R() * 12; h.scale.set(s * 1.4, s * (0.9 + R() * 0.6), s * 0.6); h.position.set(-40 + i * 15 + R() * 6, -s * 0.2, -75 - R() * 10); scene.add(h); }
  // floating rock islands with a tuft of grass, far behind (pure decoration)
  const rockM = mat('#c79b74', { roughness: 0.9 }), rockD = mat('#a97c58', { roughness: 0.9 }), grassM = mat('#8fd86a', { roughness: 0.9 });
  for (const [x, y, z, s] of [[-6, 15, -45, 2.6], [14, 19, -55, 3.4], [30, 13, -48, 2.2], [4, 24, -70, 2]]) {
    const g = new THREE.Group(); const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1.8, 7), rockM); cone.rotation.x = Math.PI; cone.position.y = -0.9; g.add(cone);
    const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 6), rockD); c2.rotation.x = Math.PI; c2.position.set(0.5, -1.6, 0.2); g.add(c2);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.0, 0.35, 7), grassM); top.position.y = 0.12; g.add(top);
    const tr = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), mat('#5fb84a')); tr.position.set(-0.3, 0.7, 0); g.add(tr);
    g.position.set(x, y, z); g.scale.setScalar(s); scene.add(g);
  }
  const trunk = mat('#9a6a45'), leaf = [mat('#58b947'), mat('#6fcb55'), mat('#4aa83d')];
  const tg = new THREE.CylinderGeometry(0.18, 0.25, 2.2, 8), lg = new THREE.SphereGeometry(1.1, 14, 10);
  for (let i = 0; i < 14; i++) {
    const x = -16 + i * 3.7 + R() * 2, z = -6 - R() * 9; const tr = new THREE.Mesh(tg, trunk); tr.position.set(x, 1.1, z); scene.add(tr);
    const l = new THREE.Mesh(lg, leaf[i % 3]); const s = 0.9 + R() * 0.7; l.scale.set(s, s * 1.15, s); l.position.set(x, 2.4 + s * 0.6, z); l.castShadow = true; scene.add(l);
  }
  const cloudM = mat('#ffffff', { roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.35 }), cg = new THREE.SphereGeometry(1, 16, 10);
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group(); for (let k = 0; k < 4; k++) { const c = new THREE.Mesh(cg, cloudM); c.position.set(k * 1.3 - 2, Math.sin(k * 1.7) * 0.4, 0); c.scale.setScalar(1 + Math.sin(k * 2.3 + i) * 0.35); g.add(c); }
    g.position.set(-14 + i * 6.5 + R() * 3, 7 + R() * 7, -26 - R() * 10); g.scale.set(1.3, 0.75, 0.6); scene.add(g);
  }
  const tuftG = new THREE.ConeGeometry(0.09, 0.42, 5), tuftM = [mat('#5cb83f'), mat('#76cc52'), mat('#4aa83d')];
  for (let i = 0; i < 160; i++) { const t = new THREE.Mesh(tuftG, tuftM[i % 3]); t.position.set(-14 + i * 0.3 + R() * 0.2, 0.12, 1.25 + R() * 0.25); t.rotation.z = (R() - 0.5) * 0.7; t.scale.y = 0.6 + R() * 0.8; scene.add(t); }
  // little flowers along the front
  const fl = [mat('#ffffff'), mat('#ffd23f'), mat('#ff8fb1')], fg = new THREE.SphereGeometry(0.09, 8, 6);
  for (let i = 0; i < 40; i++) { const f = new THREE.Mesh(fg, fl[i % 3]); f.position.set(-12 + i * 1.05 + R(), 0.05, 0.6 + R() * 0.5); scene.add(f); }
}

// ------------------------------------------------------------------ slingshot
const REST = new THREE.Vector2(0, 2.35), MAXPULL = 1.6, PXPULL = 150, VMAX = 19.5, GRAV = -18;
const WOOD = mat('#a8642e', { roughness: 0.7 });
const sling = new THREE.Group(); scene.add(sling);
{
  const cyl = (r, a, b) => { const v = new THREE.Vector3().subVectors(b, a), m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r, v.length(), 10), WOOD); m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()); m.castShadow = true; sling.add(m); };
  cyl(0.17, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1.55, 0));
  cyl(0.13, new THREE.Vector3(0, 1.45, 0), new THREE.Vector3(-0.32, 2.5, -0.18));
  cyl(0.13, new THREE.Vector3(0, 1.45, 0), new THREE.Vector3(0.3, 2.5, 0.22));
  for (const p of [[-0.32, 2.5, -0.18], [0.3, 2.5, 0.22]]) { const k = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), WOOD); k.position.set(...p); sling.add(k); }
  const st = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 0.3, 12), mat('#9aa3ad', { roughness: 0.9 })); st.position.y = 0.1; st.castShadow = true; sling.add(st);
}
const BAND = mat('#5a2f1b', { roughness: 0.6 });
const bandBack = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 6), BAND), bandFront = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 6), BAND);
const pouch = new THREE.Mesh(rounded(0.3, 0.5, 0.5, 0.1), mat('#6b3a22')); scene.add(bandBack, bandFront, pouch);
const TIPB = new THREE.Vector3(-0.32, 2.5, -0.18), TIPF = new THREE.Vector3(0.3, 2.5, 0.22), _u = new THREE.Vector3(0, 1, 0);
function band(m, a, b) { const v = new THREE.Vector3().subVectors(b, a), L = v.length(); m.position.copy(a).add(b).multiplyScalar(0.5); m.scale.set(1, Math.max(0.01, L), 1); m.quaternion.setFromUnitVectors(_u, v.normalize()); }

// ------------------------------------------------------------------ fruit
function stripeTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#5fc24a'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#2d7d2a';
  for (let i = 0; i < 9; i++) { g.beginPath(); for (let y = 0; y <= 128; y += 8) { const x = i * 28.4 + Math.sin(y * 0.15 + i) * 4; y === 0 ? g.moveTo(x, y) : g.lineTo(x, y); } for (let y = 128; y >= 0; y -= 8) { const x = i * 28.4 + 11 + Math.sin(y * 0.15 + i) * 4; g.lineTo(x, y); } g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const FRUITS = [
  { name: 'melon', mat: mat('#ffffff', { map: stripeTex(), roughness: 0.4 }), scale: [1, 0.92, 0.95] },
  { name: 'orange', mat: glossy('#ff9a1f', { roughness: 0.45 }), scale: [1, 1, 1], leaf: true },
  { name: 'plum', mat: glossy('#8b3fc7', { roughness: 0.25 }), scale: [0.95, 1.05, 0.95], leaf: true },
];
const FR = 0.36;
const EYEW = mat('#ffffff', { roughness: 0.2 }), EYEK = mat('#1d1d24'), LEAF = mat('#3fae3a'), STEM = mat('#6b4a2a');
function fruitMesh(k) {
  const f = FRUITS[k % FRUITS.length], g = new THREE.Group();
  const s = new THREE.Mesh(new THREE.SphereGeometry(FR, 24, 18), f.mat); s.scale.set(...f.scale); s.castShadow = true; g.add(s);
  for (const x of [-0.11, 0.11]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), EYEW); e.position.set(x, 0.07, FR * 0.88); g.add(e); const p = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), EYEK); p.position.set(x + 0.02, 0.07, FR * 0.88 + 0.06); g.add(p); }
  const st = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.16, 6), STEM); st.position.y = FR + 0.04; g.add(st);
  if (f.leaf) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 6), LEAF); l.scale.set(1, 0.3, 0.55); l.position.set(0.1, FR + 0.08, 0); l.rotation.z = 0.5; g.add(l); }
  g.kind = f.name; return g;
}

// ------------------------------------------------------------------ raccoons (original design: round grey bandits with striped tails)
const RR = 0.42;
const RAC = { fur: mat('#9aa3ad', { roughness: 0.75 }), belly: mat('#e4e7ea', { roughness: 0.8 }), mask: mat('#2f3238', { roughness: 0.5 }), dark: mat('#4a4f57', { roughness: 0.7 }), nose: glossy('#1c1c20'), pink: mat('#f2a7b3') };
const G = { body: new THREE.SphereGeometry(RR, 26, 18), belly: new THREE.SphereGeometry(RR * 0.62, 18, 12), ear: new THREE.ConeGeometry(0.13, 0.2, 10), mask: new THREE.CapsuleGeometry(0.1, 0.34, 4, 10), eye: new THREE.SphereGeometry(0.07, 10, 8), pupil: new THREE.SphereGeometry(0.038, 8, 6), nose: new THREE.SphereGeometry(0.055, 10, 8), tail: new THREE.CapsuleGeometry(0.1, 0.12, 4, 8) };
function raccoonMesh() {
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  const b = new THREE.Mesh(G.body, RAC.fur); b.castShadow = true; b.scale.set(1.05, 0.95, 1); inner.add(b);
  const be = new THREE.Mesh(G.belly, RAC.belly); be.position.set(0, -0.12, RR * 0.52); be.scale.set(1, 0.8, 0.6); inner.add(be);
  const mk = new THREE.Mesh(G.mask, RAC.mask); mk.rotation.z = Math.PI / 2; mk.position.set(0, 0.1, RR * 0.78); mk.scale.set(1, 1, 0.6); inner.add(mk);
  const eyes = [];
  for (const x of [-0.12, 0.12]) { const e = new THREE.Mesh(G.eye, EYEW); e.position.set(x, 0.11, RR * 0.88); inner.add(e); const p = new THREE.Mesh(G.pupil, EYEK); p.position.set(x, 0.11, RR * 0.88 + 0.05); inner.add(p); eyes.push(e, p); }
  const n = new THREE.Mesh(G.nose, RAC.nose); n.position.set(0, -0.02, RR * 0.98); inner.add(n);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(G.ear, RAC.dark); e.position.set(s * 0.25, RR * 0.82, 0); e.rotation.z = -s * 0.35; inner.add(e); }
  const tail = new THREE.Group(); tail.position.set(RR * 0.75, -0.18, -0.15); inner.add(tail);
  for (let i = 0; i < 5; i++) { const t = new THREE.Mesh(G.tail, i % 2 ? RAC.mask : RAC.fur); t.position.set(0.1 + i * 0.12, i * 0.09, -i * 0.02); t.rotation.z = -1.0 + i * 0.12; t.scale.setScalar(1 - i * 0.07); tail.add(t); }
  g.inner = inner; g.eyes = eyes; g.tail = tail; return g;
}

// ------------------------------------------------------------------ blocks
const MATS = {
  wood: { color: '#eaa95c', density: 1, thr: 0.9, hp: 4.0, fric: 0.7, rest: 0.05, pts: 500, chips: ['#eaa95c', '#c98a43', '#f6d29a'] },
  glass: { color: '#a9e5ff', density: 0.9, thr: 0.45, hp: 1.3, fric: 0.4, rest: 0.1, pts: 300, chips: ['#c6f0ff', '#ffffff', '#8fd8ff'] },
  stone: { color: '#a6adb8', density: 2.4, thr: 2.2, hp: 9, fric: 0.8, rest: 0.02, pts: 800, chips: ['#a6adb8', '#7f8692', '#cfd4db'] },
};
const geoCache = new Map();
function blockGeo(w, h) { const k = w + 'x' + h; if (!geoCache.has(k)) geoCache.set(k, rounded(w, h, 0.95, Math.min(0.06, h * 0.2))); return geoCache.get(k); }
function blockMat(kind) {
  const m = MATS[kind];
  if (kind === 'glass') return new THREE.MeshStandardMaterial({ color: m.color, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.72, emissive: '#5fc4f0', emissiveIntensity: 0.15 });
  return mat(m.color, { roughness: kind === 'stone' ? 0.85 : 0.6 });
}

// ------------------------------------------------------------------ world state
let world, ents = [], fruit = null, fruitMeshes = [], queue = [], phase = 'aim', phaseT = 0, live = false;
let pull = new THREE.Vector2(), aiming = false, fortMin = 8, fortMax = 12, slowT = 0, shake = 0, shotIdx = 0, flyT = 0, slowFruitT = 0;
const R0 = new THREE.Vector2();

function addEnt(body, mesh, kind) { scene.add(mesh); const e = { body, mesh, kind, hp: (kind === 'rac' ? 1.0 : MATS[kind].hp) * fk, thr: kind === 'rac' ? 0.55 : MATS[kind].thr, alive: true }; body.user = e; world.add(body); ents.push(e); return e; }
function addBlock(kind, x, y, w, h) {
  const m = MATS[kind], b = makeBox(x, y, w, h, { density: m.density, fric: m.fric, rest: m.rest });
  const mesh = new THREE.Mesh(blockGeo(w, h), blockMat(kind)); mesh.castShadow = mesh.receiveShadow = true;
  const e = addEnt(b, mesh, kind); e.base = new THREE.Color(m.color); return e;
}
function addRac(x, y) { const b = makeCircle(x, y, RR, { density: 0.8, fric: 0.7, rest: 0.1 }); const e = addEnt(b, raccoonMesh(), 'rac'); e.ph = Math.random() * 6; return e; }

function clearWorld() { for (const e of ents) scene.remove(e.mesh); ents = []; if (fruit) { scene.remove(fruit.mesh); fruit = null; } for (const m of queue) scene.remove(m); queue = []; }

function buildLevel() {
  clearWorld();
  world = new World({ gravity: GRAV, iterations: 12 });
  world.add(makeBox(30, -5, 200, 10, { isStatic: true, fric: 0.8 }));
  world.onHit = onHit;
  const r = rng(level * 7919 + 13); fk = F.k();
  const nT = level === 1 ? 1 : level <= 3 ? 1 + (level === 3 ? 1 : 0) : Math.min(3, 2 + Math.floor(r() * Math.min(2, (level - 2) / 3)));
  const maxF = level === 1 ? 1 : level === 2 ? 2 : Math.min(3, 1 + Math.floor(r() * Math.min(3, 1 + level / 3)));
  const pickMat = () => { if (level <= 2) return r() < 0.75 ? 'wood' : 'glass'; const x = r(); return x < 0.45 ? 'wood' : x < 0.75 ? 'glass' : 'stone'; };
  let x0 = 6.6 + (level > 2 ? r() * 0.5 : 0), nRac = 0;
  fortMin = x0 - 1.4;
  for (let t = 0; t < nT; t++) {
    const floors = t === 0 && level > 1 ? maxF : Math.max(1, Math.min(maxF, 1 + Math.floor(r() * maxF)));
    const gap = 1.5 + (r() < 0.5 ? 0.3 : 0), PW = 0.36, PH = 1.3, PT = 0.34;
    let y = 0; const pm = pickMat(), lm = pickMat();
    for (let f = 0; f < floors; f++) {
      const mPost = f === 0 && level > 4 && r() < 0.4 ? 'stone' : pm;
      addBlock(mPost, x0 - gap / 2, y + PH / 2, PW, PH); addBlock(mPost, x0 + gap / 2, y + PH / 2, PW, PH);
      if (f === floors - 1 || r() < 0.45) { addRac(x0, y + RR + 0.001); nRac++; }
      addBlock(lm, x0, y + PH + PT / 2, gap + PW + 0.3, PT);
      y += PH + PT;
    }
    // roof: a raccoon on top or two little glass cubes guarding a lookout
    if (r() < 0.5 || level === 1) { addBlock('glass', x0 - gap / 2, y + 0.25, 0.5, 0.5); addBlock('glass', x0 + gap / 2, y + 0.25, 0.5, 0.5); if (level > 1) addBlock(level > 3 ? pickMat() : 'wood', x0, y + 0.5 + 0.17, gap + 0.8, 0.34); }
    else { addRac(x0, y + RR + 0.001); nRac++; }
    fortMax = x0 + gap / 2 + 1.2;
    x0 += gap + 1.5 + r() * 0.6;
  }
  totalRac = nRac; shots = clamp(2 + Math.ceil(nRac / 2), 3, 6); shotIdx = 0; score = 0;
  // let the stacks settle silently, then freeze them
  live = false; for (let i = 0; i < 240; i++) world.step(1 / 180); world.sleepAll(); live = true;
  for (let i = 0; i < shots; i++) { const m = fruitMesh(i); m.scale.setScalar(0.85); scene.add(m); queue.push(m); }
  phase = 'intro'; phaseT = 0; slowT = 0; pull.set(0, 0); aiming = false;
  ui.levels(level); ui.progress(0); ui.score(0); ui.sub(''); updatePill();
  camX = (fortMin + fortMax) / 2 + 1; camW = 11; syncMeshes();
}
function updatePill() { ui.pill(`🦝 ${ents.filter(e => e.kind === 'rac' && e.alive).length}`); }
function racLeft() { return ents.filter(e => e.kind === 'rac' && e.alive).length; }

// ------------------------------------------------------------------ damage
const _p = new THREE.Vector3();
function floater(text, x, y, size = 22, color = '#fff') {
  _p.set(x, y, 0).project(camera); if (_p.z > 1) return;
  const d = document.createElement('div'); d.className = 'flt'; d.textContent = text; d.style.left = (_p.x + 1) / 2 * innerWidth + 'px'; d.style.top = (1 - _p.y) / 2 * innerHeight + 'px'; d.style.fontSize = size + 'px'; d.style.color = color;
  document.body.appendChild(d); setTimeout(() => d.remove(), 1000);
}
let lastHitSnd = 0, toKill = [];
function onHit(A, B, imp, px, py) {
  if (!live || state !== 'play') return;
  const fr = (A.isFruit || B.isFruit) ? 1.25 : 1;
  for (const b of [A, B]) {
    const e = b.user; if (!e || !e.alive) continue;
    const d = (imp - e.thr) * fr; if (d <= 0) continue;
    e.hp -= d; e.hit = 1;
    if (e.hp <= 0) { e.alive = false; toKill.push(e); }
  }
  const now = performance.now();
  if (imp > 1.2 && now - lastHitSnd > 70) { lastHitSnd = now; const k = [A, B].find(b => b.user && b.user.kind !== 'rac'); const kind = k ? k.user.kind : 'wood';
    if (kind === 'glass') tone(1400 + Math.random() * 400, 0.06, 'triangle', 0.06, 0.8); else if (kind === 'stone') tone(140, 0.1, 'square', 0.06, 0.6); else tone(240 + Math.random() * 60, 0.07, 'triangle', 0.09, 0.6);
    if (imp > 4) shake = Math.max(shake, Math.min(0.35, imp / 40)); }
}
function processKills() {
  for (const e of toKill) {
    world.remove(e.body); scene.remove(e.mesh);
    const at = new THREE.Vector3(e.body.x, e.body.y, 0.3);
    if (e.kind === 'rac') {
      score += 5000; burst(scene, at, ['#ffffff', '#e4e7ea', '#9aa3ad'], 22, { speed: 0.12, up: 0.06, size: 1.2, shape: 'sphere', gravity: -0.001, life: 0.9 });
      burst(scene, at, ['#ffd23f', '#ff7a2f'], 10, { speed: 0.16, up: 0.12, size: 0.5 });
      floater('5000', e.body.x, e.body.y + 0.6, 30, '#ffd23f'); tone(660, 0.12, 'square', 0.08, 0.5); setTimeout(() => tone(880, 0.15, 'triangle', 0.1, 1.3), 80);
      buzz(25); ui.flash(0.25); shake = Math.max(shake, 0.3);
      const left = racLeft(); ui.progress(1 - left / totalRac); updatePill();
      if (left > 0) ui.pop(['GOTCHA!', 'BONK!', 'SHOO!'][left % 3], '#fff', 40, 24);
      if (left === 0 && state === 'play' && slowT <= 0) { slowT = 1.4; ui.pop('FORT CLEARED!', '#ffd23f', 46, 24); sfx.smash(); }
    } else {
      const m = MATS[e.kind]; score += m.pts;
      burst(scene, at, m.chips, e.kind === 'glass' ? 14 : 10, { speed: 0.1, up: 0.08, size: e.kind === 'glass' ? 0.6 : 0.8, life: 0.8 });
      if (e.kind === 'glass') { tone(2000, 0.08, 'triangle', 0.07, 0.5); tone(1500, 0.12, 'sine', 0.05, 0.7); } else sfx.smash();
      floater(String(m.pts), e.body.x, e.body.y, 18);
    }
    ui.score(score);
  }
  toKill.length = 0;
}

// ------------------------------------------------------------------ input: pull the sling back, release to fling
let downAt = null;
function loadFruit() {
  if (!queue.length) return;
  const m = queue.shift(); m.scale.setScalar(1);
  fruit = { mesh: m, body: null, k: shotIdx };
  phase = 'aim'; phaseT = 0; pull.set(0, 0);
}
function setPull(dxPix, dyPix) {
  pull.set(dxPix / PXPULL * MAXPULL, -dyPix / PXPULL * MAXPULL);
  if (pull.length() > MAXPULL) pull.setLength(MAXPULL);
  if (pull.x > 0.4) pull.x = 0.4;   // you pull the band back, not forward
}
input({
  onDown(e) { if (state !== 'play' || phase !== 'aim' || !fruit) return; downAt = [e.clientX, e.clientY]; aiming = true; tone(300, 0.05, 'sine', 0.08, 1.3); },
  onMove(dx, dy, e) { if (!aiming) return; const old = pull.length(); setPull(e.clientX - downAt[0], e.clientY - downAt[1]); const n = pull.length(); if (Math.floor(n * 5) !== Math.floor(old * 5)) tone(200 + n * 160, 0.03, 'sine', 0.05, 1.1); },
  onUp() {
    if (!aiming) return; aiming = false;
    if (pull.length() < 0.25) { pull.set(0, 0); return; }
    launch();
  },
});
function launch() {
  const p = R0.copy(REST).add(pull), pw = pull.length() / MAXPULL, dir = pull.clone().normalize().multiplyScalar(-1);
  const b = makeCircle(p.x, p.y, FR, { density: 5.5, fric: 0.55, rest: 0.25 }); b.isFruit = true; b.noSleep = true;
  b.vx = dir.x * VMAX * pw; b.vy = dir.y * VMAX * pw; b.w = -4;
  world.add(b); b.asleep = false; fruit.body = b; b.user = null;
  shots--; shotIdx++; phase = 'fly'; flyT = 0; slowFruitT = 0; pull.set(0, 0); bandSnap = 1;
  tone(180, 0.25, 'sawtooth', 0.06, 3); tone(500, 0.12, 'sine', 0.08, 1.8); buzz(12);
  trail.forEach(t => t.visible = false); trailI = 0; trailT = 0;
}

// ------------------------------------------------------------------ trajectory dots + flight trail
const DOTG = new THREE.SphereGeometry(0.07, 8, 6), DOTM = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 });
const dots = Array.from({ length: 22 }, () => { const d = new THREE.Mesh(DOTG, DOTM); d.visible = false; scene.add(d); return d; });
const TRM = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.75 });
const trail = Array.from({ length: 60 }, (_, i) => { const d = new THREE.Mesh(new THREE.SphereGeometry(i % 3 ? 0.06 : 0.1, 6, 5), TRM); d.visible = false; scene.add(d); return d; });
let trailI = 0, trailT = 0, bandSnap = 0;
function predict(px, py, vx, vy, t) { return [px + vx * t, py + vy * t + 0.5 * GRAV * t * t]; }

// ------------------------------------------------------------------ mesh sync + raccoon life
function syncMeshes(t = 0) {
  for (const e of ents) {
    const b = e.body; e.mesh.position.set(b.x, b.y, 0); e.mesh.rotation.z = b.a;
    if (e.kind === 'rac') {
      e.ph += 0.016; const sq = Math.sin(e.ph * 3) * 0.04 + (e.hit || 0) * 0.15;
      e.mesh.inner.scale.set(1 + sq, 1 - sq, 1); e.mesh.tail.rotation.z = Math.sin(e.ph * 2.2) * 0.25;
      const blink = (e.ph % 3.5) < 0.12; for (const m of e.mesh.eyes) m.scale.y = blink ? 0.15 : 1;
      e.mesh.rotation.z = b.a * 0.25;   // keep faces mostly upright while rolling
      if (e.hit) e.hit = Math.max(0, e.hit - 0.05);
    } else if (e.hit !== undefined) {
      const m = MATS[e.kind], dmg = 1 - Math.max(0, e.hp) / (m.hp * fk); e.mesh.material.color.copy(e.base).multiplyScalar(1 - dmg * 0.35);
    }
  }
}

// ------------------------------------------------------------------ camera
let camX = 6, camY = 4, camW = 14;
const camPos = new THREE.Vector3(6, 8, 30), camAt = new THREE.Vector3(6, 4, 0);
function frameFor(x, w, k) {
  const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), asp = camera.aspect;
  const dist = Math.max(w / 2 / (tanH * asp), 9 / tanH * 0.5);
  const visH = 2 * tanH * dist, cy = asp < 1 ? Math.max(3, visH * 0.26) : 3.4;
  camAt.lerp(_v.set(x, cy, 0), k); camPos.lerp(_w.set(x, cy + dist * 0.14, dist), k);
}
const _v = new THREE.Vector3(), _w = new THREE.Vector3();

// ------------------------------------------------------------------ states
ui.onTap(w => {
  if (w === 'start') { state = 'play'; B.start(); }
  else if (w === 'win') { level++; save.set('level', level); state = 'play'; buildLevel(); B.start(); }
  else if (w === 'lose') { state = 'play'; buildLevel(); }
});
function win() {
  state = 'won'; F.level(true); const bonus = shots * 10000; score += bonus; ui.score(score); B.submit(score); sfx.win(); buzz([20, 40, 20]);
  confetti(scene, new THREE.Vector3((fortMin + fortMax) / 2, 5, 0), 90);
  if (score > best) { best = score; save.set('best', best); }
  ui.win(level, `${score.toLocaleString()} pts${bonus ? ' · +' + bonus.toLocaleString() + ' spare fruit' : ''}`);
}
function lose() { state = 'lost'; F.level(false, 1 - racLeft() / totalRac); sfx.fail(); buzz([40, 30, 60]); const n = racLeft(); ui.lose('OUT OF FRUIT!', `${n} raccoon${n > 1 ? 's' : ''} still snacking`); }

// ------------------------------------------------------------------ main loop
let acc = 0, T = 0;
loop((dt60) => {
  const rdt = Math.min(dt60 / 60, 1 / 25);
  let ts = 1; if (slowT > 0) { slowT -= rdt; ts = 0.3; if (slowT <= 0 && state === 'play') win(); }
  T += rdt; phaseT += rdt;
  if (world && (state === 'play' || state === 'won' || state === 'lost')) {
    acc += rdt * ts; const H = 1 / 180; let n = 0;
    while (acc >= H && n < 10) { world.step(H); acc -= H; n++; }
    if (acc > H) acc = 0;
    processKills();
    for (const e of ents) if (e.alive && (e.body.y < -6 || e.body.x > 60)) { e.alive = false; toKill.push(e); }
  }
  if (state === 'play') {
    if (phase === 'intro') { if (phaseT > (level === 1 ? 0.9 : 1.3)) loadFruit(); }
    else if (phase === 'fly') {
      flyT += rdt; const b = fruit.body;
      trailT += rdt; if (trailT > 0.035 && flyT < 3 && !b.hitSomething) { trailT = 0; const d = trail[trailI++ % trail.length]; d.visible = true; d.position.set(b.x, b.y, 0); }
      if (!b.hitSomething && world.arb.size && [...world.arb.values()].some(a => (a.A === b || a.B === b))) { b.hitSomething = true; }
      if (Math.hypot(b.vx, b.vy) < 0.5) slowFruitT += rdt; else slowFruitT = 0;
      if (flyT > 7 || slowFruitT > 0.9 || b.x > 50 || b.y < -5 || b.x < -10) {
        burst(scene, new THREE.Vector3(b.x, b.y, 0.3), ['#ffffff', '#f4f4f4'], 10, { speed: 0.06, up: 0.04, size: 0.9, shape: 'sphere', gravity: -0.001, life: 0.6 });
        world.remove(b); scene.remove(fruit.mesh); fruit = null; phase = 'wait'; phaseT = 0;
      }
    } else if (phase === 'wait') {
      if (racLeft() > 0 && slowT <= 0 && (world.sleeping && phaseT > 0.4 || phaseT > 3.5)) { if (shots > 0) loadFruit(); else lose(); }
    }
  }
  // fruit + sling visuals
  const pp = new THREE.Vector3(REST.x + pull.x, REST.y + pull.y, 0);
  if (fruit && !fruit.body) {
    fruit.mesh.position.copy(pp); fruit.mesh.rotation.set(0, 0, Math.sin(T * 2) * 0.08);
    const s = aiming ? 1 + pull.length() * 0.06 : 1 + Math.sin(T * 5) * 0.03; fruit.mesh.scale.set(s, 1 / s, 1);
  } else if (fruit && fruit.body) { fruit.mesh.position.set(fruit.body.x, fruit.body.y, 0); fruit.mesh.rotation.z = fruit.body.a; fruit.mesh.scale.setScalar(1); }
  if (bandSnap > 0) { bandSnap = Math.max(0, bandSnap - rdt * 5); pp.set(REST.x + Math.sin(bandSnap * 14) * bandSnap * 0.3, REST.y, 0); }
  const pouchAt = pp.clone().add(new THREE.Vector3(-0.22, 0, 0)); if (pull.length() > 0.01) pouchAt.copy(pp).addScaledVector(new THREE.Vector3(pull.x, pull.y, 0).normalize(), FR * 0.7);
  pouch.position.copy(pouchAt); pouch.rotation.z = Math.atan2(pull.y, pull.x);
  band(bandBack, TIPB, pouchAt); band(bandFront, TIPF, pouchAt);
  queue.forEach((m, i) => { m.scale.setScalar(0.72); m.position.set(-0.75 - i * 0.55, FR * 0.72 + Math.abs(Math.sin(T * 4 + i * 1.3)) * 0.1, 0.6 - i * 0.05); });
  // trajectory preview
  const showDots = aiming && pull.length() > 0.25;
  if (showDots) {
    const pw = pull.length() / MAXPULL, dx = -pull.x / pull.length(), dy = -pull.y / pull.length();
    dots.forEach((d, i) => { const [x, y] = predict(pp.x, pp.y, dx * VMAX * pw, dy * VMAX * pw, (i + 1) * 0.06); d.visible = y > 0; d.position.set(x, y, 0); d.scale.setScalar(1 - i * 0.03); });
  } else dots.forEach(d => d.visible = false);
  syncMeshes(T);
  // camera
  let entR = 0; for (const e of ents) if (e.alive && e.body.x < 30) entR = Math.max(entR, e.body.x + 1.0);
  const asp = camera.aspect, aimL = -1.9, aimR = Math.max(entR, asp < 1 ? 8.5 : 15), wide = aimR - aimL;
  if (phase === 'intro') frameFor((fortMin + fortMax) / 2, asp < 1 ? 9 : 14, 0.08);
  else if (phase === 'fly' && fruit && fruit.body) { const W = asp < 1 ? Math.min(wide, 10.5) : wide; frameFor(clamp(fruit.body.x, aimL + W / 2, Math.max(aimL + W / 2, aimR - W / 2)), W, 0.06); }
  else frameFor((aimL + aimR) / 2, wide, 0.07);
  shake = Math.max(0, shake - rdt * 1.6);
  camera.position.copy(camPos).add(_v.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0)); camera.lookAt(camAt);
  stage.followLight(new THREE.Vector3(camAt.x, 0, 0));
});
buildLevel();

// ------------------------------------------------------------------ test hooks
// bot: precomputed ballistic search toward the nearest raccoon (flat power shot first, then a high lob, then the tower base)
let botStep = 0, botPull = null;
function solve() {
  const rac = ents.filter(e => e.kind === 'rac' && e.alive).sort((a, b) => a.body.x - b.body.x);
  if (!rac.length) return null;
  const tgt = rac[(shotIdx % 2 === 1 && rac.length > 1) ? 1 : 0].body;
  const ty = tgt.y + (shotIdx === 2 ? -0.1 : 0.05);
  let bestFlat = null, bestLob = null;
  for (let ang = -5; ang <= 78; ang += 0.5) {
    const a = ang * Math.PI / 180, pw = 1, px = REST.x - Math.cos(a) * MAXPULL * pw, py = REST.y - Math.sin(a) * MAXPULL * pw;
    const vx = Math.cos(a) * VMAX * pw, vy = Math.sin(a) * VMAX * pw;
    const t = (tgt.x - px) / vx; const [, y] = predict(px, py, vx, vy, t); const err = Math.abs(y - ty);
    if (err < 0.35) { if (!bestFlat || ang < bestFlat.ang) bestFlat = { ang, err }; if (!bestLob || ang > bestLob.ang) bestLob = { ang, err }; }
  }
  const pick = shotIdx % 3 === 1 && bestLob ? bestLob : bestFlat || bestLob; if (!pick) return null;
  const a = pick.ang * Math.PI / 180;
  return [-Math.cos(a) * PXPULL, Math.sin(a) * PXPULL];   // screen px drag (y down)
}
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play' || phase !== 'aim' || !fruit || fruit.body || slowT > 0) return;
    const fire = (type, x, y) => dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y }));
    const sx = innerWidth * 0.3, sy = innerHeight * 0.6;
    if (botStep === 0) { botPull = solve(); if (!botPull) return; fire('pointerdown', sx, sy); botStep = 1; return; }
    if (botStep === 1) { fire('pointermove', sx + botPull[0] * 0.5, sy + botPull[1] * 0.5); botStep = 2; return; }
    if (botStep === 2) { fire('pointermove', sx + botPull[0], sy + botPull[1]); botStep = 3; return; }
    fire('pointerup', sx + botPull[0], sy + botPull[1]); botStep = 0;
  },
};
