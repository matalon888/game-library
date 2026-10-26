// Stormchase — original endless rail runner. Dash along three sunny city rail tracks while Grumble, a grumpy storm cloud,
// chases you: swipe between tracks, jump barriers, roll under gates, run up ramps onto train roofs, dodge oncoming trains,
// grab coins and power-ups. Models: AI-generated for this game (assets/, see README) + Kenney CC0 track. Code and sound original.
import { THREE, createUI, store, loop, input, buzz, confetti, lerp, clamp, rng } from './kit/hc.js';
import { cine } from './kit/cine.js';
import { GLTFLoader } from './kit/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from './kit/addons/utils/BufferGeometryUtils.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board as worldBoard } from './kit/board.js';
import { heroBar, selectedHero, loadHero as loadMyHero, onHeroesChange } from './kit/heroes.js';
import * as A from './sound.js';
import { demo } from './kit/demo.js';

const NAME = 'Stormchase: Endless Rail Runner';
const LW = 2.6, LX = [-LW, 0, LW], TIER = 400, GRAV = 36, JUMPV = 12, SHOE_JUMPV = 16.5, SLIDE_T = 0.72, ROOF = 3.1, VT = 11;
const HERO_SCALE = 1.45, CAM_BACK = 6.7, CAM_UP = 4.0;
const Q = new URLSearchParams(location.search);
const S = store('stormchase');
let best = S.get('best', 0);
const F = flow('stormchase', { par: 900, warmup: 250 });

// ---------------------------------------------------------------- renderer, scene, light, post
const LITE = Math.min(screen.width, screen.height) < 500 && devicePixelRatio > 2.5;
const R = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
R.setSize(innerWidth, innerHeight); R.domElement.className = 'hc-canvas'; document.body.prepend(R.domElement);
R.info.autoReset = false;
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.3, 260);
const skyTex = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 256; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#2f86ff'); g.addColorStop(0.55, '#8fd4ff'); g.addColorStop(1, '#fff1cf'); x.fillStyle = g; x.fillRect(0, 0, 4, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
scene.background = skyTex;
scene.fog = new THREE.Fog(0xcfeaff, 60, 175);
const C = cine(R, scene, cam, { bloom: 0.22, bloomThreshold: 0.9, bloomRadius: 0.4, exposure: 0.95, envIntensity: 0.4, lite: LITE, grade: { sat: 1.28, contrast: 1.08, vignette: 0.12, grain: 0 } });
if (C.lite) R.shadowMap.type = THREE.PCFShadowMap;
const hemi = new THREE.HemisphereLight(0xe2f2ff, 0x9a7a5a, 1.35); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d0, 2.7); sun.castShadow = true; sun.shadow.mapSize.set(C.lite ? 1024 : 2048, C.lite ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 34, bottom: -34, near: 1, far: 90 }); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

// ---------------------------------------------------------------- UI + kit layers
const ui = createUI({ title: 'STORM<br>CHASE', hint: 'Swipe to dodge the storm!', hand: '👆' });
ui.els.start.id = 'sc-start';
const D = daily('stormchase', ui, { name: NAME });
const B = worldBoard({ game: 'stormchase', label: 'Points', limits: { maxRun: 40000, maxPerSec: 120 }, corner: 'tl', accent: '#ffd23f' });   // world board: best run today
ui.els.win.querySelector('p').innerHTML = 'NEW BEST<span data-l hidden></span>';
const winH = ui.els.win.querySelector('h1');
const hudEl = document.getElementById('sc-hud'), stormEl = document.getElementById('sc-storm');
const loadEl = document.createElement('div'); loadEl.id = 'sc-load'; loadEl.textContent = 'Loading the city…'; document.body.appendChild(loadEl);

// ---------------------------------------------------------------- assets: every model is baked into instanced meshes ("kinds")
const loader = new GLTFLoader();
const load = n => loader.loadAsync('./assets/' + n + '.glb');
function toFloat(g) {   // quantized (int16) attributes → float32 so transforms can be baked in
  for (const k of Object.keys(g.attributes)) {
    const a = g.attributes[k]; if (a.array instanceof Float32Array && !a.isInterleavedBufferAttribute && !a.normalized) continue;
    const n = a.itemSize, out = new Float32Array(a.count * n);
    for (let i = 0; i < a.count; i++) { out[i * n] = a.getX(i); if (n > 1) out[i * n + 1] = a.getY(i); if (n > 2) out[i * n + 2] = a.getZ(i); if (n > 3) out[i * n + 3] = a.getW(i); }
    g.setAttribute(k, new THREE.BufferAttribute(out, n));
  }
  return g;
}
const kinds = [];
function kind(gltf, { rot = 0, fit = 'y', size = 1, dims = null, cap = 8, cast = true, receive = true, thin = false, mat } = {}) {
  gltf.scene.updateMatrixWorld(true);
  const groups = new Map();
  gltf.scene.traverse(m => { if (!m.isMesh) return; const g = toFloat(m.geometry.clone()); g.applyMatrix4(m.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    const key = m.material.uuid; if (!groups.has(key)) groups.set(key, { m: m.material, g: [] }); groups.get(key).g.push(g); });
  const parts = [...groups.values()].map(p => ({ m: p.m, g: p.g.length > 1 ? mergeGeometries(p.g.map(g => g.index ? g.toNonIndexed() : g)) : p.g[0] }));
  let r = rot;
  if (thin) { let bestA = 0, bestD = 1e9; for (let a = 0; a < Math.PI; a += Math.PI / 72) { const b = new THREE.Box3(); for (const p of parts) { const g = p.g.clone().rotateY(a); g.computeBoundingBox(); b.union(g.boundingBox); } const d = b.max.z - b.min.z; if (d < bestD) { bestD = d; bestA = a; } } r += bestA; }
  const box = new THREE.Box3();
  for (const p of parts) { p.g.rotateY(r); p.g.computeBoundingBox(); box.union(p.g.boundingBox); }
  const sz = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  let sx, sy, sz2; if (dims) { [sx, sy, sz2] = [dims[0] / sz.x, dims[1] / sz.y, dims[2] / sz.z]; } else { sx = sy = sz2 = size / sz[fit]; }
  for (const p of parts) { p.g.translate(-c.x, -box.min.y, -c.z); p.g.scale(sx, sy, sz2); p.g.computeBoundingSphere(); }
  const out = { size: new THREE.Vector3(sz.x * sx, sz.y * sy, sz.z * sz2), meshes: [], n: 0 };
  for (const p of parts) {
    let m = p.m; if (m.metalness > 0.3) { m.metalness = 0.15; } if (mat) m = mat(m);
    const im = new THREE.InstancedMesh(p.g, m, cap); im.frustumCulled = false; im.castShadow = cast; im.receiveShadow = receive; im.count = 0; scene.add(im); out.meshes.push(im);
  }
  out.begin = () => { out.n = 0; };
  out.put = (x, y, z, ry = 0, s = 1, rx = 0, rz = 0, sy2 = s) => { if (out.n >= cap) return; _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')); _m.compose(_p.set(x, y, z), _q, _s.set(s, sy2, s)); for (const im of out.meshes) im.setMatrixAt(out.n, _m); out.n++; };
  out.end = () => { for (const im of out.meshes) { im.count = out.n; im.instanceMatrix.needsUpdate = true; } };
  kinds.push(out);
  return out;
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color(), _v = new THREE.Vector3();
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// canvas textures
const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
const graffiti = (seed, bg) => canvasTex(1024, 256, (x, w, h) => {
  x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(0,0,0,.07)'; for (let i = 0; i < w; i += 64) for (let j = 0; j < h; j += 32) x.fillRect(i + (j / 32 % 2) * 32, j, 62, 30);
  x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, 0, w, 16);
  const cols = ['#ff3d7f', '#2fd3ff', '#ffd23f', '#7cff6b', '#a45dff', '#ff8c1a']; let r = seed + 1; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  const words = ['ZAP', 'YO!', 'RUN', 'WOW', 'GO!', 'HEY', 'FLY', 'BOOM', 'DASH', 'ZOOM'];
  for (let i = 0; i < 5; i++) { const cx = 60 + i * 200 + rnd() * 40, cy = 150 + rnd() * 40, col = cols[Math.floor(rnd() * 6)]; x.save(); x.translate(cx, cy); x.rotate((rnd() - 0.5) * 0.3);
    if (rnd() < 0.3) { x.fillStyle = cols[Math.floor(rnd() * 6)]; x.beginPath(); x.arc(30, -10, 60, 0, 7); x.fill(); x.lineWidth = 8; x.strokeStyle = '#1b1530'; x.stroke(); }
    x.font = `900 ${78 + rnd() * 40}px Impact, Arial Black, sans-serif`; const word = words[Math.floor(rnd() * words.length)];
    x.lineJoin = 'round'; x.lineWidth = 18; x.strokeStyle = '#1b1530'; x.strokeText(word, -70, 30); x.lineWidth = 7; x.strokeStyle = '#fff'; x.strokeText(word, -70, 30); x.fillStyle = col; x.fillText(word, -70, 30); x.restore(); }
});
const speckle = (base, cols, n, rep) => { const t = canvasTex(256, 256, (x, w, h) => { x.fillStyle = base; x.fillRect(0, 0, w, h); for (let i = 0; i < n; i++) { x.fillStyle = cols[i % cols.length]; const s = 2 + (i % 3); x.fillRect(Math.random() * w, Math.random() * h, s, s); } }); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); return t; };

// ground: gravel bed for the tracks + warm pavement beyond the walls
const GR_REP = 5;
const gravel = new THREE.Mesh(new THREE.PlaneGeometry(12, 300), new THREE.MeshStandardMaterial({ map: speckle('#9a9083', ['#857c70', '#b0a798', '#756d62', '#c3bbad'], 3500, [12 / GR_REP, 300 / GR_REP]), roughness: 1 }));
gravel.rotation.x = -Math.PI / 2; gravel.receiveShadow = true; scene.add(gravel);
const pave = new THREE.Mesh(new THREE.PlaneGeometry(120, 300), new THREE.MeshStandardMaterial({ map: (() => { const t = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#e7d8bf'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(120,90,60,.25)'; x.lineWidth = 3; for (let i = 0; i <= w; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.moveTo(0, i); x.lineTo(w, i); x.stroke(); } }); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(30, 75); return t; })(), roughness: 0.95 }));
pave.rotation.x = -Math.PI / 2; pave.position.y = -0.02; pave.receiveShadow = true; scene.add(pave);

// graffiti walls between the tracks and the city (instanced, 3 looks)
const WALL_X = 5.5, WALL_L = 24, WALL_H = 2.3;
const wallSide = new THREE.MeshStandardMaterial({ color: 0xd9c7a6, roughness: 0.9 }), wallTop = new THREE.MeshStandardMaterial({ color: 0xbfa98a, roughness: 0.9 });
const walls = [0, 1, 2].map(i => { const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, WALL_H, WALL_L), [new THREE.MeshStandardMaterial({ map: graffiti(i * 7 + 3, ['#e8d7b8', '#d6e3e8', '#ecd2c9'][i]), roughness: 0.85 }), wallSide, wallTop, wallSide, wallSide, wallSide], 20);
  im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; scene.add(im); return im; });
walls.forEach(w => { w.n = 0; });

// sky clouds (puffs far away, drift with the camera)
const cloudIM = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xbcd8ff, emissiveIntensity: 0.25, fog: false }), 60);
cloudIM.frustumCulled = false; scene.add(cloudIM);
{ let k = 0; for (let c = 0; c < 12; c++) { const cx = (hash(c) - 0.5) * 220, cy = 48 + hash(c + 5) * 30, cz = -150 - hash(c + 9) * 60; for (let j = 0; j < 5; j++) { const s = 6 + hash(c * 7 + j) * 6; _m.compose(_p.set(cx + (j - 2) * s * 0.9, cy + hash(c + j) * 3 - (j === 0 || j === 4 ? 2 : 0), cz), _q.identity(), _s.set(s * 1.3, s * 0.8, s)); cloudIM.setMatrixAt(k++, _m); } } cloudIM.count = k; }

// particles: two instanced pools: additive glow (sparkles, rain, speed lines, flames) and solid (dust, debris)
const glowTex = canvasTex(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.75)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
function pool(geo, material, cap, billboard) {
  const im = new THREE.InstancedMesh(geo, material, cap); im.frustumCulled = false; im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); scene.add(im);
  const list = []; for (let i = 0; i < cap; i++) list.push({ life: 0 });
  return { im, list, head: 0, billboard };
}
const GLOW = pool(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), 360, true);
const LINES = pool(new THREE.BoxGeometry(0.035, 0.035, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }), 60, false); LINES.line = true;
const SOLID = pool(new THREE.IcosahedronGeometry(0.16, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, transparent: true, opacity: 0.85, depthWrite: false }), 160, false);
function emitTo(pl, x, y, z, vx, vy, vz, col, size, life, g, stretch) { const p = pl.list[pl.head]; pl.head = (pl.head + 1) % pl.list.length; Object.assign(p, { x, y, z, vx, vy, vz, life, max: life, size, g, stretch, col }); }
const emit = (x, y, z, vx, vy, vz, col, size = 1, life = 0.6, g = 9, stretch = 1) => emitTo(GLOW, x, y, z, vx, vy, vz, col, size, life, g, stretch);
const COLS = {}; const col = c => COLS[c] || (COLS[c] = new THREE.Color(c));
function sparkle(x, y, z, c = '#ffd23f', n = 8, sp = 4) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, b = Math.random() * 3.14; emit(x, y, z, Math.cos(a) * Math.sin(b) * sp, Math.cos(b) * sp + 2, Math.sin(a) * Math.sin(b) * sp, col(c), 0.8 + Math.random() * 0.9, 0.4 + Math.random() * 0.25, 5); } emit(x, y, z, 0, 0, 0, col('#ffffff'), 3.2, 0.18, 0); }
function dust(x, y, z, n = 6, sp = 2.5) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28; emitTo(SOLID, x + Math.cos(a) * 0.3, y + 0.15, z, Math.cos(a) * sp, 0.6 + Math.random() * 0.8, Math.sin(a) * sp * 0.5 + 3, col(i % 2 ? '#e9dfcf' : '#cfc3b0'), 1.4 + Math.random() * 1.2, 0.45, 1, 1); } }
function debris(x, y, z, n, cols) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28; emitTo(SOLID, x, y, z, Math.cos(a) * 5, 3 + Math.random() * 6, Math.sin(a) * 3 + 2, col(cols[i % cols.length]), 1.2 + Math.random(), 1.1, 16, 1); } }
const _qb = new THREE.Quaternion();
function drawPool(pl, dt) {
  let n = 0; const im = pl.im;
  for (const p of pl.list) { if (p.life <= 0) continue; p.life -= dt; if (p.life <= 0) continue; p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    const k = p.life / p.max, sc = p.size * (pl.billboard ? (0.35 + 0.65 * k) : pl.line ? 1 : Math.min(1, k * 2.5));
    _m.compose(_p.set(p.x, p.y, p.z), pl.billboard ? cam.quaternion : _qb.identity(), _s.set(sc, pl.line ? sc : sc * p.stretch, pl.line ? p.stretch : sc)); im.setMatrixAt(n, _m);
    _c.copy(p.col); if (pl.billboard) _c.multiplyScalar(Math.min(1, k * 1.6)); im.setColorAt(n, _c); n++; }
  im.count = n; im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
}
function drawParticles(dt) { drawPool(GLOW, dt); drawPool(SOLID, dt); drawPool(LINES, dt); }
// coin streak glow + train headlights: additive sprites
const lights = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, color: 0xfff2c0 }), 60);
lights.frustumCulled = false; scene.add(lights);

// lightning bolt (one mesh, rebuilt per strike)
const boltMat = new THREE.MeshBasicMaterial({ color: 0xfff7a0, toneMapped: false });
const bolt = new THREE.Mesh(new THREE.BufferGeometry(), boltMat); bolt.visible = false; scene.add(bolt);
function strike(x, y0, z) {
  const segs = []; let px = x, py = y0; while (py > 0.2) { const nx = px + (Math.random() - 0.5) * 1.6, ny = py - 0.8 - Math.random() * 0.8; const len = Math.hypot(nx - px, ny - py);
    const g = new THREE.BoxGeometry(0.16, len, 0.16); g.rotateZ(-Math.atan2(nx - px, ny - py) + Math.PI); g.translate((px + nx) / 2, (py + ny) / 2, z); segs.push(g); px = nx; py = Math.max(0.2, ny); }
  bolt.geometry.dispose(); bolt.geometry = mergeGeometries(segs); bolt.visible = true; boltT = 0.12; flashT = 0.12;
}
let boltT = 0, flashT = 0;

// ---------------------------------------------------------------- tunnels: generated portal (clipped to its front slab) + a brick tube behind it
const TUN_W = 19, TUN_L = 46, TUN_R = 4.9, TUN_Y = 2.2, FACADE = 6.8;   // the portal's facade sits ~6.8 m behind its bbox front (rails stick out)
R.localClippingEnabled = true;
const tunClip = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), tunClip2 = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
const brick = (() => { const t = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#6b3b2e'; x.fillRect(0, 0, w, h); for (let j = 0; j < 16; j++) for (let i = 0; i < 8; i++) { x.fillStyle = ['#8a4b38', '#7d4433', '#94553f', '#734030'][(i * 7 + j * 3) % 4]; x.fillRect(i * 32 + (j % 2) * 16 + 2, j * 16 + 2, 28, 12); } }); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 12); return t; })();
const tubeGeo = (() => { const arch = new THREE.CylinderGeometry(TUN_R, TUN_R, TUN_L, 28, 1, true, Math.PI / 2, Math.PI); arch.rotateX(Math.PI / 2); arch.translate(0, TUN_Y, -TUN_L / 2);
  const parts = [arch]; for (const sd of [-1, 1]) { const w = new THREE.PlaneGeometry(TUN_L, TUN_Y + 0.1); w.rotateY(-sd * Math.PI / 2); w.translate(sd * TUN_R, TUN_Y / 2, -TUN_L / 2); parts.push(w); }
  return mergeGeometries(parts.map(g => g.toNonIndexed())); })();
const tube = new THREE.Mesh(tubeGeo, new THREE.MeshStandardMaterial({ map: brick, roughness: 0.9, side: THREE.DoubleSide }));
tube.castShadow = true; tube.receiveShadow = true; tube.visible = false; scene.add(tube);
let darkK = 0;
// ---------------------------------------------------------------- world kinds (filled after load)
let K = null, TRACK = null;
const TRAINS = ['train-red', 'train-yellow', 'train-blue', 'train-green', 'train-orange', 'train-purple', 'train-silver'];
const BLDS = [['bld-brick', 0], ['bld-teal', -Math.PI / 2], ['bld-purple', -Math.PI / 2], ['bld-apartments', 0], ['bld-cafe', 0], ['bld-shop', 0], ['bld-station', 0], ['bld-tower', -Math.PI / 2], ['bld-warehouse', 0]];
const CHARS = [{ id: 'runner', name: 'Jax', tag: 'the original', col: '#ff9a1f' }, { id: 'hero-rain', name: 'Pip', tag: 'rain or shine', col: '#ffd23f' }, { id: 'hero-volt', name: 'Volt', tag: 'all speed', col: '#2ec4b6' }];
let charIdx = clamp(S.get('char', 0), 0, CHARS.length - 1);

async function loadWorld() {
  const names = [...TRAINS, ...BLDS.map(b => b[0]), 'barrier-low', 'barrier-high', 'ramp', 'signal', 'bench', 'trashcan', 'fence', 'coin', 'gem', 'magnet', 'jetpack', 'sneakers', 'hoverboard', 'storm', 'track', 'tunnel'];
  const g = Object.fromEntries(await Promise.all(names.map(async n => [n, await load(n)])));
  K = {};
  K.trains = TRAINS.map(n => kind(g[n], { rot: -Math.PI / 2, dims: [2.45, ROOF, 10.5], cap: 14 }));
  K.blds = BLDS.map(([n, r]) => kind(g[n], { rot: r, fit: 'y', size: 13, cap: 10, cast: !C.lite }));
  K.low = kind(g['barrier-low'], { rot: Math.PI / 2, dims: [2.3, 1.2, 0.9], cap: 16 });
  K.high = kind(g['barrier-high'], { rot: Math.PI / 2, dims: [2.5, 3.0, 0.7], cap: 16 });
  K.ramp = kind(g.ramp, { rot: -Math.PI / 2, dims: [2.4, ROOF, 7], cap: 10 });
  K.signal = kind(g.signal, { rot: Math.PI / 2, fit: 'y', size: 3.4, cap: 12 });
  K.bench = kind(g.bench, { rot: Math.PI / 2, fit: 'x', size: 0.9, cap: 12 });
  K.trash = kind(g.trashcan, { fit: 'y', size: 1.1, cap: 12 });
  K.fence = kind(g.fence, { fit: 'z', size: 3.2, cap: 12 });
  K.coin = kind(g.coin, { thin: true, fit: 'y', size: 0.78, cap: 240, cast: false, mat: m => { m.emissive = new THREE.Color(0x6a4200); m.emissiveIntensity = 0.55; m.metalness = 0.55; m.roughness = 0.3; return m; } });
  K.gem = kind(g.gem, { fit: 'y', size: 0.8, cap: 12, cast: false, mat: m => { m.emissive = new THREE.Color(0x1aa0ff); m.emissiveIntensity = 0.5; return m; } });
  K.pw = { magnet: kind(g.magnet, { fit: 'y', size: 1.1, cap: 4 }), jet: kind(g.jetpack, { fit: 'y', size: 1.2, cap: 4 }), shoe: kind(g.sneakers, { fit: 'x', size: 1.2, cap: 4 }), board: kind(g.hoverboard, { rot: Math.PI / 2, fit: 'x', size: 1.6, cap: 4 }) };
  K.storm = kind(g.storm, { rot: Math.PI / 2, fit: 'x', size: 6.5, cap: 1, cast: false });
  K.heroBoard = kind(g.hoverboard, { fit: 'z', size: 1.9, cap: 1 });
  K.tunnel = kind(g.tunnel, { rot: -Math.PI / 2, fit: 'x', size: TUN_W, cap: 1, mat: m => { m = m.clone(); m.clippingPlanes = [tunClip, tunClip2]; m.side = THREE.DoubleSide; return m; } });
  const tb = new THREE.Box3().setFromObject(g.track.scene).getSize(new THREE.Vector3());
  const tScale = 2.5 / tb.x; TRACK = kind(g.track, { fit: 'x', size: 2.5, cap: 3 * 110, cast: false }); TRACK.len = tb.z * tScale;
}

// ---------------------------------------------------------------- hero (rigged generated character, crossfaded clips)
const heroG = new THREE.Group(); scene.add(heroG);
const blob = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
scene.add(blob);
let hero = null; const heroCache = {};
async function loadHero(i) {
  if (!heroCache[i]) heroCache[i] = load(CHARS[i].id).then(g => {
    const root = g.scene; root.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = false; m.frustumCulled = false; if (m.material.metalness > 0.3) m.material.metalness = 0.1; } });
    root.scale.setScalar(HERO_SCALE); root.rotation.y = Math.PI;
    const mixer = new THREE.AnimationMixer(root), acts = {};
    for (const c of g.animations) { const a = mixer.clipAction(c); acts[c.name] = a; if (['jump', 'slide', 'fall'].includes(c.name)) { a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; } }
    return { root, mixer, acts, cur: null };
  });
  const h = await heroCache[i];
  if (mine) return;                      // a Hero Lab hero was picked while this runner loaded
  if (hero) heroG.remove(hero.root);
  hero = h; heroG.add(h.root); play('idle', 0);
}
function play(name, fade = 0.15, ts = 1) {
  if (!hero) return; const a = hero.acts[name]; if (!a) return;
  if (hero.cur === a && !['jump', 'slide'].includes(name)) { a.timeScale = ts; return; }
  a.reset(); a.timeScale = ts; a.setEffectiveWeight(1); a.play();
  if (hero.cur && hero.cur !== a) hero.cur.crossFadeTo(a, fade, false); hero.cur = a;
}
const clipLen = n => (hero && hero.acts[n] ? hero.acts[n].getClip().duration : 1);
// My hero (Hero Lab, kit/heroes.js): replaces the runner's look only. Same clips (idle/run/jump/slide/fall/cheer + sprint),
// same heroG transforms; game weight, no shadow casting (this scene is already heavy; the blob shadow stays).
const MY_H = 2.25;   // Jax/Pip/Volt stand 2.2–2.4 at HERO_SCALE
let mine = null, mineSig = null, mineTok = 0;
const heroSig = h => (h ? JSON.stringify({ ...h, thumb: 0 }) : '');
async function useHero() {
  const h = selectedHero(), t = ++mineTok; mineSig = heroSig(h); showPick();
  if (!h) { const old = mine; mine = null; if (old) { if (hero === old) { heroG.remove(old.root); hero = null; } old.kit.dispose(); } await loadHero(charIdx); if (state === 'play') play('run', 0); return; }
  let k;
  try { k = await loadMyHero(THREE, GLTFLoader, { hero: h, quality: 'game', height: MY_H, face: Math.PI, shadows: false }); }
  catch (e) { console.warn('hero', e); if (t === mineTok) { mineSig = null; await loadHero(charIdx); } return; }
  if (t !== mineTok) { k.dispose(); return; }
  for (const n of ['jump', 'slide', 'fall']) if (k.actions[n]) { k.actions[n].setLoop(THREE.LoopOnce, 1); k.actions[n].clampWhenFinished = true; }
  const old = mine; mine = { root: k.object, mixer: k.mixer, acts: k.actions, cur: null, kit: k };
  if (hero) heroG.remove(hero.root);
  hero = mine; heroG.add(mine.root); if (old) old.kit.dispose();
  play(state === 'play' ? 'run' : 'idle', 0);
}

// ---------------------------------------------------------------- run state
let Rr = rng(1), state = 'loading', s = 0, x = 0, lane = 1, y = 0, vy = 0, onGround = true, slideT = 0, groundH = 0, prevS = 0;
let speed = 13, dist = 0, score = 0, coins = 0, tier = 1, runT = 0, deadT = 0, deadHow = '', recorded = false, beatenShown = false, t0run = 0;
let stumbleT = 0, chaseGap = 16, invT = 0, shake = 0, fovKick = 0, comboT = 0, combo = 0, lastM = 0, hornT = 0, landSq = 0, leanV = 0, bumpT = 0, bumpDir = 0;
const pw = { magnet: 0, jet: 0, shoe: 0, board: 0 };
const PW_T = { magnet: 10, jet: 7, shoe: 10, board: 14 }, PW_NAME = { magnet: 'MAGNET!', jet: 'JETPACK!', shoe: 'SUPER SNEAKERS!', board: 'HOVERBOARD!' }, PW_ICON = { magnet: '🧲', jet: '🚀', shoe: '👟', board: '🛹' };
let nextTun = 500, ents = [], genS = 0, safeLane = 1, busy = [0, 0, 0], reserved = [0, 0, 0], nextPw = 260, nextGem = 500, blds = [[], []], deco = [], tick = 0;

function reset() {
  Rr = rng((D.seed || (Date.now() % 1e6)) + 41);
  s = 0; x = 0; lane = 1; y = 0; vy = 0; onGround = true; slideT = 0; groundH = 0; prevS = 0;
  speed = 13 * F.k(0); dist = 0; score = 0; coins = 0; tier = 1; runT = 0; deadT = 0; deadHow = ''; recorded = false; beatenShown = false;
  stumbleT = 0; chaseGap = 2.6; invT = 0; shake = 0; fovKick = 0; combo = 0; lastM = 0; hornT = 0; bumpT = 0;
  for (const k in pw) pw[k] = 0;
  ents = []; genS = 34; safeLane = 1; busy = [0, 0, 0]; reserved = [0, 0, 0]; nextPw = 220 + Rr() * 80; nextGem = 450; blds = [[], []]; deco = []; nextTun = 420 + Rr() * 200;
  ui.score(0); ui.levels(1); ui.progress(0); ui.sub(best ? 'BEST ' + best : ''); ui.pill('🪙 0');
  if (hero) { play('idle', 0); }
}

// ---------------------------------------------------------------- level generation: rows of obstacles with a guaranteed way through
const busyAt = (l, at) => busy[l] > at;
function coinLine(l, s0, n, h = 0) { for (let i = 0; i < n; i++) ents.push({ t: 'coin', l, s0: s0 + i * 2.2, y: 0.95 + h }); }
function genRow(at) {
  const d = clamp(at / 3000, 0, 1);
  const free = [0, 1, 2].filter(l => !busyAt(l, at - 1));
  const r = Rr();
  let placed = false;
  // trains (parked), optionally with a ramp up onto the roof
  if (r < 0.42 && free.length >= 2) {
    const want = 1 + (Rr() < 0.25 + 0.45 * d ? 1 : 0), pick = [...free].sort(() => Rr() - 0.5).slice(0, Math.min(want, free.length - (3 - free.length >= 1 ? 0 : 1)));
    const trainLanes = [0, 1, 2].filter(l => busyAt(l, at - 1) || pick.includes(l));
    if (trainLanes.length <= 2 && pick.length) {
      // the lanes left free at this row must be reachable from the last safe lane without crossing a train
      const open = [0, 1, 2].filter(l => !trainLanes.includes(l));
      const reach = open.filter(f => { const a = Math.min(f, safeLane), b = Math.max(f, safeLane); for (let k = a; k <= b; k++) if (busyAt(k, at - 1)) return false; return true; });
      if (reach.length) {
        for (const l of pick) {
          const cars = 1 + Math.floor(Rr() * (1.6 + d * 1.6)), ramp = cars >= 2 && Rr() < 0.55, kind = Math.floor(Rr() * TRAINS.length);
          const s0 = at + (ramp ? 7 : 0), len = cars * 10.8;
          if (ramp) ents.push({ t: 'ramp', l, s0: at, s1: s0 });
          ents.push({ t: 'train', l, s0, s1: s0 + len, cars, kind, moving: false });
          busy[l] = s0 + len + 3;
          if (ramp) { for (let i = 0; i < 3; i++) ents.push({ t: 'coin', l, s0: at + 1 + i * 2.2, y: 0.95 + ROOF * (1 + i * 2.2) / 7 }); coinLine(l, s0 + 1.5, Math.floor(len / 2.2) - 1, ROOF); }
        }
        safeLane = reach[Math.floor(Rr() * reach.length)];
        if (Rr() < 0.6 && !pick.includes(safeLane) && reserved[safeLane] < at) coinLine(safeLane, at - 4, 6);
        placed = true;
      }
    }
  }
  // an oncoming train: it meets you at this row, in a lane nothing else uses for a while
  if (!placed && r < 0.62 && at > 150) {
    const cand = free.filter(l => reserved[l] < at - 10 && l !== safeLane);
    if (cand.length) {
      const l = cand[Math.floor(Rr() * cand.length)], cars = 1 + (Rr() < 0.4 ? 1 : 0), kind = Math.floor(Rr() * TRAINS.length);
      ents.push({ t: 'train', l, s0: at, s1: at + cars * 10.8, cars, kind, moving: true, meet: at, spawned: false, horn: false });
      reserved[l] = at + 120; busy[l] = Math.max(busy[l], at + 4);
      const others = [0, 1, 2].filter(k => k !== l && !busyAt(k, at - 1));
      if (others.length) { safeLane = others[Math.floor(Rr() * others.length)]; if (Rr() < 0.7) coinLine(safeLane, at - 8, 7); }
      placed = true;
    }
  }
  // barriers: jump the low ones, roll under the high ones
  if (!placed) {
    const n = 1 + (Rr() < 0.35 + 0.4 * d ? 1 : 0) + (Rr() < d * 0.3 ? 1 : 0);
    const cand = free.filter(l => reserved[l] < at - 2 || reserved[l] > at + 200).sort(() => Rr() - 0.5).slice(0, n);
    for (const l of cand) { const high = Rr() < 0.45; ents.push({ t: high ? 'high' : 'low', l, s0: at, s1: at + 0.8 });
      if (!high && Rr() < 0.6) for (let i = 0; i < 7; i++) { const f = i / 6; ents.push({ t: 'coin', l, s0: at - 5.4 + f * 10.8, y: 0.95 + Math.sin(f * Math.PI) * 2.2 }); }
      else if (high && Rr() < 0.5) coinLine(l, at - 4.4, 5, -0.35); }
    const left = free.filter(l => !cand.includes(l));
    if (left.length) { safeLane = left[Math.floor(Rr() * left.length)]; if (Rr() < 0.5 && reserved[safeLane] < at - 2) coinLine(safeLane, at - 6, 6); }
    else if (cand.length) safeLane = cand[0];
  }
  if (at > nextTun) { ents.push({ t: 'tunnel', s0: at - 6, s1: at - 6 + TUN_L }); nextTun = at + 650 + Rr() * 400; }
  // power-ups and gems on the safe lane, between rows
  if (at > nextPw) { const types = ['magnet', 'jet', 'shoe', 'board']; ents.push({ t: 'pw', p: types[Math.floor(Rr() * 4)], l: safeLane, s0: at + 8, y: 1.3 }); nextPw = at + 300 + Rr() * 250; }
  else if (at > nextGem) { ents.push({ t: 'gem', l: safeLane, s0: at + 8, y: 1.2 }); nextGem = at + 350 + Rr() * 300; }
}
function generate() {
  while (genS < s + 190) { genRow(genS); const sp = Math.max(speed, 14); genS += clamp(sp * 1.05, 15, 30) + Rr() * 8; }
  // city: buildings both sides, side-track props
  for (const sd of [0, 1]) { const list = blds[sd]; let z = list.length ? list[list.length - 1].e : -30; while (z < s + 200) { const k = Math.floor(hash(z * 0.37 + sd * 11) * BLDS.length), sc = 0.85 + hash(z + sd) * 0.45, w = K.blds[k].size.z * sc; list.push({ k, sc, c: z + w / 2, e: z + w + 0.3, depth: K.blds[k].size.x * sc }); z += w + 0.3; } while (list.length && list[0].e < s - 20) list.shift(); }
}
// world space: we run toward −z; s is distance along the track
const Z = sv => -sv;

// ---------------------------------------------------------------- collisions + surfaces
function trainS0(e) { return e.s0; }
function laneOverlap(e, px) { return Math.abs(px - LX[e.l]) < 1.25; }
function surfaceAt(px, ps, py) {   // the highest walkable surface under the runner that it can step onto
  let h = 0;
  for (const e of ents) {
    if (e.s0 > ps + 8 || !laneOverlap(e, px)) continue;
    if (e.t === 'train' && ps >= e.s0 - 0.2 && ps <= e.s1 && py >= ROOF - 0.7) h = Math.max(h, ROOF);
    else if (e.t === 'ramp' && ps >= e.s0 && ps <= e.s1 + 0.2 && Math.abs(px - LX[e.l]) < 1.05) h = Math.max(h, ROOF * clamp((ps - e.s0) / (e.s1 - e.s0), 0, 1));
  }
  return h;
}
function blockedLane(l, ps, py) {   // a train body blocks this lane at the runner's position
  for (const e of ents) if (e.t === 'train' && e.l === l && ps >= e.s0 - 0.6 && ps <= e.s1 + 0.3 && py < ROOF - 0.7) return e;
  return null;
}

// ---------------------------------------------------------------- game flow
function addScore(n) { score += n; ui.score(score); if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 44, 30); confetti(scene, heroG.position.clone().setY(y + 2.5), 50); A.osc(880, 0.3, 'triangle', 0.12, 1.5); } }
function gameOver(how, kind) {
  if (state !== 'play') return;
  state = 'lost'; deadT = 0; deadHow = kind; A.stopMusic(0.3);
  if (!recorded) { recorded = true; F.endless(score); B.submit(score, { ms: Math.round(performance.now() - t0run) }); }
  const prev = best; best = Math.max(best, score); S.set('best', best);
  shake = 1; ui.flash(0.8); buzz([40, 30, 90]); hudEl.innerHTML = '';
  A.hiss(0.5, 1500, 200, 0.3, 'lowpass'); A.osc(120, 0.4, 'square', 0.14, 0.4); thunder();
  for (let i = 0; i < 26; i++) { const a = Math.random() * 6.28; emit(x, y + 1.2, Z(s) - 0.6, Math.cos(a) * 5, 3 + Math.random() * 5, Math.sin(a) * 3 + 2, col(['#ffd23f', '#ffffff', '#ff4f5e', '#8fd4ff'][i % 4]), 1.6, 0.9, 14); }
  debris(x, y + 0.8, Z(s) - 0.8, 18, ['#ff4f5e', '#ffffff', '#ffd23f', '#6b5f8f']); play('fall', 0.08); if (hero) hero.acts.fall && (hero.acts.fall.timeScale = 1.3);
  if (score > prev && score >= 50 && hero && hero.kit) setTimeout(() => state === 'lost' && hero && hero.kit && play('cheer', 0.4), 1100);
  if (score > prev && score >= 50) { D.won(score, 'ran'); winH.textContent = String(score); ui.win(tier, `${how} · 🪙 ${coins}`); }
  else ui.lose(String(score), `${how} · BEST ${best} · 🪙 ${coins}`);
  setTimeout(() => (state === 'lost') && ui.els.sc.classList.add('hc-hidden'), 650);
}
function thunder() { A.hiss(1.4, 400, 60, 0.4, 'lowpass'); A.osc(55, 1.0, 'sine', 0.25, 0.6); setTimeout(() => A.hiss(0.8, 300, 80, 0.25, 'lowpass'), 180); }
function crash(how) {
  if (invT > 0 || DM.on) return true;
  if (pw.board > 0) { pw.board = 0; invT = 1.6; shake = 0.7; ui.flash(0.4); ui.pop('BOARD SMASHED!', '#7ff0ff', 32, 30); buzz([20, 20, 30]); A.hiss(0.4, 2500, 400, 0.22); A.osc(300, 0.2, 'square', 0.1, 0.5);
    sparkle(x, y + 0.4, Z(s), '#7ff0ff', 18, 6); return true; }
  gameOver(how, 'crash'); return false;
}
function stumble() {
  if (DM.on) return;
  shake = Math.max(shake, 0.6); buzz([25, 20, 25]); ui.flash(0.3); thunder(); A.osc(180, 0.15, 'square', 0.1, 0.5);
  if (stumbleT > 0) { gameOver('The storm caught you!', 'caught'); return; }
  stumbleT = 6; ui.pop('WHOA!', '#ff4f5e', 38, 30); strike(x + 1.8, 9, Z(s) - 3);
}
function startRun() {
  if (state === 'play') return;
  B.start(); reset(); state = 'play'; runN++; t0run = performance.now(); A.ac(); startSong(); ui.els.sc.classList.remove('hc-hidden');
  play('run', 0.25); started = true; showPick();
}

// ---------------------------------------------------------------- input: swipe left/right = switch track, up = jump, down = roll; taps for the same
function act(d) {
  if (state !== 'play') return;
  if (d === 'left' || d === 'right') {
    const nl = clamp(lane + (d === 'left' ? -1 : 1), 0, 2); if (nl === lane) { bumpT = 0.18; bumpDir = d === 'left' ? -1 : 1; A.osc(140, 0.08, 'square', 0.06, 0.6); return; }
    if (pw.jet <= 0 && blockedLane(nl, s, y)) { bumpT = 0.22; bumpDir = d === 'left' ? -1 : 1; stumble(); return; }
    lane = nl; leanV = d === 'left' ? 1 : -1; A.hiss(0.14, 900, 2600, 0.08); buzz(6);
    if (onGround) dust(x, groundH, Z(s), 3, 1.5);
  } else if (d === 'up') {
    if (pw.jet > 0) return;
    if (onGround) { vy = pw.shoe > 0 ? SHOE_JUMPV : JUMPV; onGround = false; slideT = 0; const air = 2 * vy / GRAV; play('jump', 0.08, clipLen('jump') / Math.max(0.5, air * 1.1)); A.osc(330, 0.16, 'triangle', 0.12, 2); A.hiss(0.15, 1200, 3500, 0.06); buzz(8); dust(x, groundH, Z(s), 4, 2); }
    else jumpBuf = 0.16;
  } else if (d === 'down') {
    if (pw.jet > 0) return;
    if (!onGround) vy = Math.min(vy, -24);
    slideT = SLIDE_T; play('slide', 0.08, clipLen('slide') / (SLIDE_T * 1.05)); A.hiss(0.32, 3000, 500, 0.1); buzz(6);
  }
}
let jumpBuf = 0;
input({ onMove: (dx, dy, e, st) => {
  if (state !== 'play') return;
  const tx = e.clientX - st.x, ty = e.clientY - st.y;
  if (!st.fired && Math.hypot(tx, ty) > 24) { st.fired = true; act(Math.abs(ty) > Math.abs(tx) ? (ty > 0 ? 'down' : 'up') : (tx > 0 ? 'right' : 'left')); }
}, onTap: (e) => { if (state !== 'play') return; const yy = e.clientY / innerHeight; act(yy < 0.36 ? 'up' : yy > 0.8 ? 'down' : e.clientX < innerWidth / 2 ? 'left' : 'right'); } });
addEventListener('keydown', e => { const k = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down', ' ': 'up' }[e.key]; if (k) { e.preventDefault(); if (state === 'play') act(k); } });
ui.onTap(() => { if (state === 'loading') { pendingStart = true; return; } startRun(); });
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on the first run, until the first touch,
// the runner dodges by itself for a few seconds (the game's own bot: switch tracks, jump, roll) and can't be caught meanwhile
let runN = 0;
const DM = demo(null, { ready: () => state === 'play' && runN === 1, wait: 700, ms: 4200 });
let pendingStart = false;

// character picker on the start card
const pick = document.createElement('div'); pick.id = 'sc-pick';
CHARS.forEach((c, i) => { const b = document.createElement('button'); b.innerHTML = `<i style="background:${c.col}"></i>${c.name}<small>${c.tag}</small>`; b.className = i === charIdx ? 'on' : '';
  b.addEventListener('pointerdown', e => e.stopPropagation());
  b.addEventListener('click', async e => { e.stopPropagation(); charIdx = i; S.set('char', i); [...pick.children].forEach((q, j) => q.className = j === i ? 'on' : ''); await loadHero(i); if (state !== 'play') play('cheer', 0.2); A.osc(660, 0.1, 'triangle', 0.1, 1.5); });
  pick.appendChild(b); });
document.body.appendChild(pick);
// hero bar above the runner buttons: "Classic" keeps Jax/Pip/Volt, a saved hero replaces the runner, ＋ opens Hero Lab
let started = false;
const heroWrap = document.createElement('div'); heroWrap.id = 'sc-heroes'; document.body.appendChild(heroWrap);
heroWrap.addEventListener('pointerdown', e => e.stopPropagation());
heroBar({ parent: heroWrap, noneLabel: 'Runners', noneIcon: '🏃', onPick: () => useHero() });
function showPick() { const h = !!selectedHero(); pick.style.display = started || h ? 'none' : ''; heroWrap.style.display = started ? 'none' : ''; document.body.classList.toggle('sc-hb', !started); document.body.classList.toggle('sc-mine', h); }
onHeroesChange(() => { if (heroSig(selectedHero()) !== mineSig) useHero(); });

// original loop: bright city run in D major (kick, snare, hats, bass, plucky lead)
const BASS = [38, 38, 50, 38, 43, 43, 55, 43, 45, 45, 57, 45, 40, 40, 52, 45];
const LEAD = [74, 78, 81, 78, 79, 76, 74, 76, 81, 78, 74, 78, 76, 73, 69, 73];
function startSong() {
  A.startMusic({ bpm: 148, steps: 32, play(st, t, a) {
    if (st % 2 === 0) a.kick(t, 0.26); if (st % 4 === 2) a.snare(t, 0.07); a.hat(t, st % 2 ? 0.045 : 0.02);
    a.note(BASS[st >> 1], 0.18, 'triangle', 0.2, t);
    if (st % 2 === 1 || st >= 24) a.note(LEAD[(st >> 1) % 16], 0.16, 'square', 0.025, t);
  } });
}

// ---------------------------------------------------------------- per-frame simulation
function update(dt) {
  runT += dt; prevS = s;
  const fk = F.k(score);
  speed = Math.min(30, (14 + Math.min(dist / 120, 15)) * fk);
  for (const k in pw) if (pw[k] > 0) { pw[k] -= dt; if (pw[k] <= 0) { pw[k] = 0; if (k === 'jet') { invT = Math.max(invT, 1.2); vy = 0; onGround = false; } A.osc(440, 0.2, 'triangle', 0.08, 0.5); } }
  if (stumbleT > 0) stumbleT -= dt; if (invT > 0) invT -= dt; if (bumpT > 0) bumpT -= dt;
  const step = speed * dt; s += step; dist += step;
  // moving trains roll toward you
  for (const e of ents) if (e.t === 'train' && e.moving) {
    if (!e.spawned) { e.spawned = true; const len = e.s1 - e.s0; e.s0 = e.meet + VT * (e.meet - s) / speed; e.s1 = e.s0 + len; }
    e.s0 -= VT * dt; e.s1 -= VT * dt;
    if (!e.horn && e.s0 - s < 75 && e.s0 > s) { e.horn = true; horn(); }
  }
  // lateral
  const tx = LX[lane] + (bumpT > 0 ? bumpDir * 0.5 * Math.sin(bumpT / 0.22 * Math.PI) : 0);
  const px = x; x = lerp(x, tx, Math.min(1, dt * 13)); leanV = lerp(leanV, 0, Math.min(1, dt * 6));
  // vertical: jetpack flies high, otherwise gravity onto the highest surface
  if (pw.jet > 0) { y = lerp(y, 7.5, Math.min(1, dt * 3)); vy = 0; onGround = false; groundH = 0; if (Math.random() < 0.9) for (let i = 0; i < 2; i++) emit(x + (i ? 0.25 : -0.25), y + 0.9, Z(s) + 0.5, (Math.random() - 0.5), -6, 3, col(i ? '#ffb02e' : '#ff5a1f'), 1.4, 0.35, 0); }
  else {
    vy -= GRAV * dt * (vy < 0 ? 1.2 : 1); y += vy * dt;
    groundH = surfaceAt(x, s, y);
    if (y <= groundH) { if (!onGround && vy < -6) { landSq = 1; A.osc(100, 0.1, 'sine', 0.2, 0.6); dust(x, groundH, Z(s), 6, 2.5); if (slideT <= 0) play('run', 0.1); } if (!onGround && slideT <= 0 && hero && hero.cur === hero.acts.jump) play('run', 0.12); y = groundH; vy = 0; onGround = true; }
    else if (onGround && y > groundH + 0.05) { // ran off a roof or ramp end
      if (y - groundH > 0.6) onGround = false; else y = groundH;
    }
  }
  if (jumpBuf > 0) { jumpBuf -= dt; if (onGround) { jumpBuf = 0; act('up'); } }
  if (slideT > 0) { slideT -= dt; if (slideT <= 0 && state === 'play') play(onGround ? 'run' : 'jump', 0.15); }
  // power-up auras
  if (pw.magnet > 0 && Math.random() < 0.5) { const a = Math.random() * 6.28; emit(x + Math.cos(a) * 0.9, y + 1.2 + Math.sin(a) * 0.9, Z(s), 0, 0, 2, col(Math.random() < 0.5 ? '#ff5d5d' : '#9fd8ff'), 0.6, 0.3, 0); }
  if (pw.shoe > 0 && onGround && Math.random() < 0.6) emit(x + (Math.random() - 0.5) * 0.4, y + 0.1, Z(s) + 0.3, 0, 0.5, 4, col('#7ff0ff'), 0.8, 0.35, 0);
  if (pw.board > 0 && Math.random() < 0.7) emit(x + (Math.random() - 0.5) * 0.6, y + 0.15, Z(s) + 0.9, 0, 0, 5, col('#ffb23f'), 0.7, 0.3, 0);
  // collisions
  if (pw.jet <= 0) for (const e of ents) {
    if (e.s0 > s + 2 || (e.s1 || e.s0) < s - 2 || e.hit) continue;
    if (e.t === 'train') {
      if (!laneOverlap(e, x)) continue;
      const inside = s > e.s0 - 0.4 && s < e.s1 && y < ROOF - 0.7;
      if (!inside) continue;
      const wasBefore = prevS <= e.s0 - 0.4 + (e.moving ? VT * dt + 0.5 : 0.05);
      if (wasBefore || Math.abs(x - LX[e.l]) < 0.7) { e.hit = true; if (!crash(e.moving ? 'Hit an oncoming train' : 'Ran into a train')) return; }
      else { lane = LX.indexOf(LX.reduce((a, b) => Math.abs(b - px) < Math.abs(a - px) ? b : a)); if (lane < 0) lane = 1; x = px; stumble(); if (state !== 'play') return; }
    } else if (e.t === 'low' || e.t === 'high') {
      if (Math.abs(x - LX[e.l]) > 1.0 || s < e.s0 - 0.35 || s > e.s1 + 0.1) continue;
      if (e.t === 'low' && y - groundH < 1.05 && y < 1.2) { e.hit = true; if (!crash('Tripped on a barrier')) return; }
      if (e.t === 'high' && slideT <= 0 && y < 3.0) { e.hit = true; if (!crash('Bonked a gate')) return; }
    }
  }
  // pickups
  const mag = pw.magnet > 0;
  for (const e of ents) {
    if (e.got || (e.t !== 'coin' && e.t !== 'gem' && e.t !== 'pw')) continue;
    if (e.s0 > s + (mag ? 26 : 3) || e.s0 < s - 3) continue;
    if (mag && e.t === 'coin' && !e.pull && Math.abs(e.s0 - s) < 26) e.pull = { x: LX[e.l], y: e.y, s: e.s0 };
    let ex = LX[e.l], ey = e.y, es = e.s0;
    if (e.pull) { const k = Math.min(1, dt * 7); e.pull.x = lerp(e.pull.x, x, k); e.pull.y = lerp(e.pull.y, y + 1, k); e.pull.s = lerp(e.pull.s, s, k); ex = e.pull.x; ey = e.pull.y; es = e.pull.s; }
    if (Math.abs(es - s) < 1.0 && Math.abs(ex - x) < 0.95 && ey > y - 0.3 && ey < y + (slideT > 0 ? 1.4 : 2.6)) {
      e.got = true;
      if (e.t === 'coin') { coins++; combo = comboT > 0 ? combo + 1 : 0; comboT = 0.45; addScore(5); ui.pill('🪙 ' + coins); const k = Math.pow(2, Math.min(combo, 12) / 12); A.osc(1318 * k, 0.06, 'square', 0.035); A.osc(1975 * k, 0.12, 'sine', 0.05, 1, A.ac().currentTime + 0.035); sparkle(ex, ey, Z(es), '#ffe066', 5, 3); }
      else if (e.t === 'gem') { addScore(50); ui.pop('+50 GEM!', '#7ff0ff', 34, 30); [0, 4, 7, 12].forEach((k, i) => setTimeout(() => A.osc(880 * Math.pow(2, k / 12), 0.15, 'triangle', 0.09), i * 60)); sparkle(ex, ey, Z(es), '#7ff0ff', 16, 5); }
      else { pw[e.p] = PW_T[e.p]; if (e.p === 'board') invT = 0; if (e.p === 'jet') skyCoins(); ui.pop(PW_NAME[e.p], '#ffd23f', 36, 30); fovKick = 1; [0, 4, 7, 12, 16].forEach((k, i) => setTimeout(() => A.osc(523 * Math.pow(2, k / 12), 0.16, 'triangle', 0.1), i * 55)); sparkle(ex, ey, Z(es), '#fff6a0', 22, 6); buzz(15); }
    }
  }
  comboT -= dt;
  const m = Math.floor(dist); if (m > lastM) { addScore(m - lastM); lastM = m; }
  const nt = Math.floor(dist / TIER) + 1;
  if (nt > tier) { tier = nt; ui.levels(tier); ui.pop(`${(tier - 1) * TIER} m!`, '#fff', 44, 28); confetti(scene, heroG.position.clone().setY(y + 3), 40); [0, 4, 7, 12].forEach((k, i) => setTimeout(() => A.osc(587 * Math.pow(2, k / 12), 0.2, 'triangle', 0.1), i * 90)); }
  ui.progress((dist % TIER) / TIER);
  chaseGap = lerp(chaseGap, stumbleT > 0 ? 2.2 : runT < 2.5 ? 2.6 : 18, Math.min(1, dt * (stumbleT > 0 ? 3 : 0.6)));
  if (chaseGap < 6 && Math.random() < dt * 0.7) { strike(x + (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 2), 9, Z(s) - 2 - Math.random() * 4); thunder(); }
  // forget what is far behind
  if ((tick++ & 15) === 0) ents = ents.filter(e => (e.s1 || e.s0) > s - 25);
  generate();
}
function skyCoins() {   // a weaving coin trail up where the jetpack flies
  let l = lane; const n = Math.floor(PW_T.jet * speed * 1.15 / 2.3);
  for (let i = 0; i < n; i++) { if (i > 6 && i % 9 === 0) l = clamp(l + (Rr() < 0.5 ? -1 : 1), 0, 2); ents.push({ t: 'coin', l, s0: s + 14 + i * 2.3, y: 8.3, sky: true }); }
}
function horn() { const t = A.ac().currentTime; A.osc(311, 0.55, 'sawtooth', 0.05, 0.98, t); A.osc(370, 0.55, 'sawtooth', 0.045, 0.98, t); A.osc(311, 0.4, 'sawtooth', 0.04, 0.98, t + 0.65); A.osc(370, 0.4, 'sawtooth', 0.035, 0.98, t + 0.65); }

// ---------------------------------------------------------------- render
const camPos = new THREE.Vector3(0, 4, 8), camLook = new THREE.Vector3();
let introT = 0;
function draw(t, dt) {
  const hz = Z(s);
  // hero
  heroG.position.set(x, y, hz);
  heroG.rotation.z = lerp(heroG.rotation.z, leanV * 0.3 + (x - LX[lane]) * 0.14, Math.min(1, dt * 12));
  heroG.rotation.y = lerp(heroG.rotation.y, state === 'ready' ? 0.45 : -leanV * 0.25, Math.min(1, dt * 8));
  landSq = Math.max(0, landSq - dt * 5); heroG.scale.set(1 + landSq * 0.12, 1 - landSq * 0.14, 1 + landSq * 0.12);
  if (hero && hero.kit && state === 'play' && (hero.cur === hero.acts.run || hero.cur === hero.acts.sprint)) { const w = speed > 21 ? 'sprint' : 'run'; if (hero.cur !== hero.acts[w]) play(w, 0.3); }
  if (hero) { hero.root.position.y = pw.board > 0 ? 0.32 : 0; hero.mixer.update(dt * (state === 'play' && hero.cur === hero.acts.run ? clamp(speed / 15, 0.9, 1.5) : state === 'play' && hero.cur === hero.acts.sprint ? clamp(speed / 24, 0.9, 1.25) : 1)); }
  blob.position.set(x, groundH + 0.03, hz); blob.scale.setScalar(clamp(1 - (y - groundH) * 0.15, 0.35, 1)); blob.visible = pw.jet <= 0 || true;
  if (!K) return;
  const sMin = s - 14, sMax = s + 175;
  // tracks
  TRACK.begin(); const i0 = Math.floor(sMin / TRACK.len); for (let i = i0; i * TRACK.len < sMax; i++) for (const lx of LX) TRACK.put(lx, 0, Z(i * TRACK.len)); TRACK.end();
  gravel.position.set(0, 0.0, Math.round(hz / GR_REP) * GR_REP - 120); pave.position.set(0, -0.02, Math.round(hz / 10) * 10 - 120);
  // walls
  walls.forEach(w => { w.n = 0; });
  for (let i = Math.floor(sMin / WALL_L); i * WALL_L < sMax; i++) for (const sd of [-1, 1]) { const w = walls[((i * 7 + (sd > 0 ? 3 : 0)) % 3 + 3) % 3]; _m.compose(_p.set(sd * WALL_X, WALL_H / 2, Z(i * WALL_L + WALL_L / 2)), _q.setFromEuler(_e.set(0, sd > 0 ? Math.PI : 0, 0)), _s.set(1, 1, 1)); w.setMatrixAt(w.n++, _m); }
  walls.forEach(w => { w.count = w.n; w.instanceMatrix.needsUpdate = true; });
  // city
  for (const k of K.blds) k.begin();
  for (const sd of [0, 1]) for (const b of blds[sd]) { if (b.e < sMin || b.c > sMax + 20) continue; const kb = K.blds[b.k], side = sd ? 1 : -1; kb.put(side * (WALL_X + 2.2 + b.depth / 2), 0, Z(b.c), sd ? Math.PI : 0, b.sc); }
  for (const k of K.blds) k.end();
  // side props on a fixed rhythm (deterministic by slot)
  for (const k of [K.signal, K.bench, K.trash, K.fence]) k.begin();
  const tuns = ents.filter(e => e.t === 'tunnel');
  for (let i = Math.floor(sMin / 9); i * 9 < sMax; i++) for (const sd of [-1, 1]) { const h = hash(i * 3.1 + sd * 17), z = Z(i * 9 + 4); if (tuns.some(e => i * 9 + 4 > e.s0 - 3 && i * 9 + 4 < e.s1 + 1)) continue;
    if (h < 0.16) K.signal.put(sd * 4.55, 0, z, sd > 0 ? Math.PI : 0);
    else if (h < 0.3) K.trash.put(sd * (WALL_X + 1.0), 0, z, h * 9);
    else if (h < 0.45) K.bench.put(sd * (WALL_X + 1.0), 0, z, sd > 0 ? Math.PI : 0);
    else if (h < 0.55) K.fence.put(sd * 4.55, 0, z, 0); }
  for (const k of [K.signal, K.bench, K.trash, K.fence]) k.end();
  // obstacles + pickups
  for (const k of K.trains) k.begin(); for (const k of [K.low, K.high, K.ramp, K.coin, K.gem, ...Object.values(K.pw)]) k.begin();
  let ln = 0;
  for (const e of ents) {
    const end = e.s1 || e.s0; if (end < sMin || e.s0 > sMax) continue; if ((e.t === 'coin' || e.t === 'gem' || e.t === 'pw') && !e.pull && (e.s0 < s - 1.5 || (state === 'lost' && e.s0 < s + 9))) continue;
    const lx = LX[e.l];
    if (e.t === 'train') { const kt = K.trains[e.kind]; for (let c = 0; c < e.cars; c++) kt.put(lx, 0, Z(e.s0 + 5.25 + c * 10.8), 0);
      if (e.moving && ln < 38) { const fz = Z(e.s0) + 0.15; for (const sx of [-0.68, 0.68]) { _m.compose(_p.set(lx + sx, 0.95, fz), _q.identity(), _s.setScalar(1.4 + Math.sin(t * 30) * 0.1)); lights.setMatrixAt(ln++, _m); } } }
    else if (e.t === 'low') K.low.put(lx, 0, Z(e.s0 + 0.4));
    else if (e.t === 'high') K.high.put(lx, 0, Z(e.s0 + 0.4));
    else if (e.t === 'ramp') K.ramp.put(lx, 0, Z((e.s0 + e.s1) / 2));
    else if (e.t === 'coin' && !e.got) { if (e.pull) K.coin.put(e.pull.x, e.pull.y - 0.39, Z(e.pull.s), t * 5); else K.coin.put(lx, e.y - 0.39 + Math.sin(t * 4 + e.s0) * 0.06, Z(e.s0), t * 3.2 + e.s0 * 0.4); }
    else if (e.t === 'gem' && !e.got) K.gem.put(lx, e.y - 0.4 + Math.sin(t * 3) * 0.12, Z(e.s0), t * 2);
    else if (e.t === 'pw' && !e.got) { K.pw[e.p].put(lx, e.y - 0.5 + Math.sin(t * 3) * 0.15, Z(e.s0), t * 2.2); if (ln < 40) { _m.compose(_p.set(lx, e.y, Z(e.s0) + 0.6), _q.identity(), _s.setScalar(2.6 + Math.sin(t * 6) * 0.3)); lights.setMatrixAt(ln++, _m); } }
  }
  K.tunnel.begin(); tube.visible = false;
  for (const e of ents) if (e.t === 'tunnel' && e.s1 > sMin && e.s0 < sMax + 30) { const fz = Z(e.s0); K.tunnel.put(0, -0.4, fz - K.tunnel.size.z / 2 + FACADE, 0); tunClip.constant = -(fz - 1.3); tunClip2.constant = fz + 0.7; tube.visible = true; tube.position.set(0, 0, fz - 0.7); }
  K.tunnel.end();
  // magnet/jet sky coins on the ground for jetpack runs are spawned in update; hero board
  K.heroBoard.begin(); if (pw.board > 0 && state !== 'lost') K.heroBoard.put(x, y + 0.12 + Math.sin(t * 8) * 0.04, hz, 0); K.heroBoard.end();
  if (pw.jet > 0) K.pw.jet.put(x, y + 1.25, hz + 0.42, Math.PI, 0.72);
  for (const k of K.trains) k.end(); for (const k of [K.low, K.high, K.ramp, K.coin, K.gem, ...Object.values(K.pw)]) k.end();
  for (const e of ents) if (e.t === 'tunnel' && tube.visible) for (let q = 4; q < TUN_L; q += 7) for (const sd of [-1, 1]) if (ln < 60) { _m.compose(_p.set(sd * (TUN_R - 0.45), 3.4, Z(e.s0 + q)), cam.quaternion, _s.setScalar(1.1)); lights.setMatrixAt(ln++, _m); }
  lights.count = ln; lights.instanceMatrix.needsUpdate = true;
  // the storm (Grumble) behind you
  const sGap = state === 'lost' ? lerp(chaseGap, 1.2, Math.min(1, deadT * 1.5)) : state === 'ready' ? 7 : chaseGap;
  // ready: looming behind the hero (intro shot looks back at it); play: hangs overhead at the top of the screen, glaring back
  // at you, lower and closer after a stumble; lost: swoops down onto the hero (death cam looks from the front)
  const near = clamp((12 - sGap) / 9, 0, 1);
  let stX = x * 0.85, stY, stZ, stS, stR;
  if (state === 'ready') { stY = 5.2; stZ = hz + 7.6; stS = 0.62; stR = 0; }
  else if (state === 'lost') { const k = Math.min(1, deadT * 1.8); stX = x; stY = lerp(6.5, 2.6, k); stZ = hz + lerp(2.5, 2.2, k); stS = 0.62; stR = 0; }
  else { stY = lerp(9.5, 5.6, near) + y * 0.6; stZ = hz + lerp(4, 1.2, near); stS = 0.5; stR = Math.PI; }
  stY += Math.sin(t * 2.5) * 0.2;
  K.storm.begin(); if (sGap < 12 || state !== 'play') K.storm.put(stX, stY, stZ, stR + Math.sin(t * 1.3) * 0.15, stS * (1 + Math.sin(t * 6) * 0.04), 0, Math.sin(t * 1.7) * 0.08); K.storm.end();
  if ((state === 'play' && near > 0.3) || state === 'lost' || state === 'ready') if (Math.random() < 0.6) emit(stX + (Math.random() - 0.5) * 3.2, stY - 0.3, stZ - 0.5 + (Math.random() - 0.5) * 2, 0, -18, 0, col('#5f74c8'), 0.22, 0.3, 0, 6);
  stormEl.style.opacity = state === 'play' ? clamp((7 - chaseGap) / 4, 0, 0.8) : 0;
  // speed lines
  if (state === 'play' && (speed > 19 || fovKick > 0.2 || pw.jet > 0)) for (let i = 0; i < 2; i++) { const a = Math.random() * 6.28, r = 2.5 + Math.random() * 3; emitTo(LINES, x + Math.cos(a) * r * 1.4, y + 2.2 + Math.sin(a) * r * 0.8, hz - 18, 0, 0, speed * 1.6, col('#ffffff'), 1, 0.5, 0, 3 + speed * 0.15); }
  drawParticles(dt);
  // lightning flash
  if (boltT > 0) { boltT -= dt; if (boltT <= 0) bolt.visible = false; }
  let inT = 0; for (const e of ents) if (e.t === 'tunnel') { const a = cam.position.z, z0 = Z(e.s0) - 1, z1 = Z(e.s1) + 4; if (a < z0 && a > z1) inT = 1; }
  darkK = lerp(darkK, inT, Math.min(1, dt * 5));
  if (flashT > 0) flashT -= dt; hemi.intensity = 1.35 * (1 - 0.72 * darkK) + (flashT > 0 ? 1.6 : 0); sun.intensity = 2.7 * (1 - 0.85 * darkK);
  // camera: behind and above, easing with lane and height; intro shot looks back at the hero with the storm behind
  const lostCam = state === 'lost';
  let tx = x * 0.55, ty = CAM_UP + Math.max(0, y) * 0.62, tz = hz + CAM_BACK, lx = x * 0.3, ly = 1.3 + y * 0.55, lz = hz - 10;
  if (pw.jet > 0) { ty = y + 3.2; ly = y - 0.5; }
  if (state === 'ready') { introT += dt; const a = 0.42 + Math.sin(introT * 0.35) * 0.15; tx = Math.sin(a) * 6.4; ty = 1.9; tz = hz - Math.cos(a) * 6.4; lx = 0; ly = 2.9; lz = hz + 2; }
  if (lostCam) { const k = Math.min(1, deadT * 1.2); tx = x + lerp(1.5, 3.2, k); ty = lerp(3.6, 2.4, k); tz = hz + lerp(4, -6.5, k); lx = x; ly = 1.6; lz = hz + 1; }
  const ck = Math.min(1, dt * (state === 'play' ? 10 : 3));
  camPos.x = lerp(camPos.x, tx, ck); camPos.y = lerp(camPos.y, ty, Math.min(1, dt * 6)); camPos.z = state === 'play' ? lerp(camPos.z, tz, Math.min(1, dt * 14)) : lerp(camPos.z, tz, ck);
  camLook.set(lerp(camLook.x, lx, ck), lerp(camLook.y, ly, Math.min(1, dt * 6)), state === 'play' ? lz : lerp(camLook.z, lz, ck));
  shake = Math.max(0, shake - dt * 2.2);
  cam.position.set(camPos.x + (Math.random() - 0.5) * shake * 0.4, camPos.y + (Math.random() - 0.5) * shake * 0.4, camPos.z);
  cam.lookAt(camLook);
  fovKick = Math.max(0, fovKick - dt * 1.4);
  const fovT = (cam.aspect < 0.75 ? 64 : 54) + (state === 'play' ? (speed - 13) * 0.35 : 0) + fovKick * 6;
  cam.fov = lerp(cam.fov, fovT, Math.min(1, dt * 4)); cam.updateProjectionMatrix();
  // sun + shadow camera follow the hero
  sun.position.set(x - 9, 24, hz + 8); sun.target.position.set(x, 0, hz - 12);
  // power-up HUD
  if ((tick & 7) === 0) hudEl.innerHTML = Object.keys(pw).filter(k => pw[k] > 0).map(k => `<div>${PW_ICON[k]}<b><u style="width:${(pw[k] / PW_T[k] * 100).toFixed(0)}%"></u></b></div>`).join('');
}

// ---------------------------------------------------------------- main loop
let lastFrame = performance.now(), fpsAvg = 60;
loop((d, t) => {
  const dt = Math.min(0.05, d / 60);
  fpsAvg = lerp(fpsAvg, 1 / Math.max(1e-3, dt), 0.05);
  if (state === 'play') { if (DM.on) window.__game.bot(); update(dt); }
  else if (state === 'lost') { deadT += dt; if (y > groundH) { vy -= GRAV * dt; y = Math.max(groundH, y + vy * dt); } s += speed * dt * Math.max(0, 0.25 - deadT) ; }
  else if (state === 'ready' && K) { if ((tick++ & 31) === 0) generate(); if (hero && hero.cur === hero.acts.idle && Math.random() < dt * 0.15) { play('cheer', 0.3); setTimeout(() => state === 'ready' && play('idle', 0.4), 2400); } }
  draw(t, dt);
  R.info.reset(); C.render(dt);
});
addEventListener('resize', () => { R.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); C.resize(innerWidth, innerHeight); });

// ---------------------------------------------------------------- boot
ui.els.sc.classList.add('hc-hidden'); ui.pill(''); ui.start();
if (D.isDaily) ui.sub('DAILY RUN');
(async () => {
  await Promise.all([loadWorld(), selectedHero() ? useHero() : (mineSig = '', showPick(), loadHero(charIdx))]);
  reset(); generate(); state = 'ready'; loadEl.remove();
  if (pendingStart) startRun();
})();

if (navigator.webdriver || Q.has('debug')) window.__dbg = { get K() { return K; }, get clip() { return tunClip; }, tunnel: () => { ents.push({ t: 'tunnel', s0: s + 45, s1: s + 45 + TUN_L }); }, act, stumble, give: p => { pw[p] = PW_T[p]; if (p === "jet") skyCoins(); }, crash: () => crash('Debug'), set speedMul(v) { speed *= v; } };
// ---------------------------------------------------------------- test hook + bot
window.__game = {
  get state() { return state === 'loading' ? 'ready' : state; }, get level() { return tier; }, get score() { return score; }, get why() { return deadHow; },
  get info() { return { calls: R.info.render.calls, tris: R.info.render.triangles, fps: Math.round(fpsAvg), ents: ents.length, s: Math.round(s), lane, y: +y.toFixed(2) }; },
  bot() {
    if (state !== 'play') return;
    if (pw.jet > 0) { const c = ents.find(e => e.sky && !e.got && e.s0 > s + 2); if (c && c.l !== lane) act(c.l < lane ? 'left' : 'right'); return; }
    const look = speed * 1.7 + 8;
    // how far each lane is clear of something that would stop you (trains you can't ride, oncoming trains)
    const clear = [0, 1, 2].map(l => {
      let dmin = look, bonus = 0;
      for (const e of ents) {
        if (e.l !== l || e.got) continue;
        const d0 = e.s0 - s;
        if (e.t === 'train') {
          if ((e.s1 - s) < -0.5) continue;
          const onRoof = y >= ROOF - 0.7 && s >= e.s0 - 0.5 && s <= e.s1;
          if (onRoof) continue;
          const ramp = ents.some(r => r.t === 'ramp' && r.l === l && Math.abs(r.s1 - e.s0) < 0.5 && r.s0 > s - 2);
          if (ramp && !e.moving) continue;
          const dd = e.moving ? Math.max(-1, d0) * speed / (speed + VT) : d0;
          dmin = Math.min(dmin, Math.max(-1, dd));
        } else if ((e.t === 'coin' || e.t === 'gem' || e.t === 'pw') && d0 > 0 && d0 < look) bonus += e.t === 'coin' ? 0.4 : 4;
        else if ((e.t === 'low' || e.t === 'high') && d0 > 0 && d0 < 12) bonus -= 1.5;
      }
      return { d: dmin, v: dmin + bonus };
    });
    const here = clear[lane];
    let target = lane;
    for (let l = 0; l < 3; l++) if (clear[l].v > clear[target].v + 2 || (here.d < look * 0.8 && clear[l].d > clear[target].d + 1)) target = l;
    if (target !== lane) { const nl = lane + Math.sign(target - lane); if (!blockedLane(nl, s, y) && clear[nl].d > 1.5) { act(nl < lane ? 'left' : 'right'); return; } }
    // jump / roll for barriers in this lane
    for (const e of ents) {
      if (e.l !== lane || (e.t !== 'low' && e.t !== 'high' && !(e.t === 'train' && pw.shoe > 0))) continue;
      const d0 = e.s0 - s; if (d0 < -0.2 || d0 > speed * 0.45) continue;
      if (e.t === 'low' && onGround && d0 < speed * 0.4) { act('up'); return; }
      if (e.t === 'train' && onGround && y < 1 && d0 < speed * 0.35) { act('up'); return; }
      if (e.t === 'high' && slideT < 0.25 && d0 < speed * 0.38) { act('down'); return; }
    }
  },
};
