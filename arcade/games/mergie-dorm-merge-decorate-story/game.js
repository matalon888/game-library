// Mergie Dorm: Merge & Decorate Story. A 7×7 3D merge board (beauty, sweets and plush chains of kawaii props),
// three generators that spend gently-refilling energy, orders from five chibi dorm-mates, and stars that glow up three
// dorm rooms while a small cupcake mystery unfolds. Habit hooks: ?daily=1 seeded level + streak (weekly freeze) + share
// grid, a sticker album, rooms + story chapters, a sawtooth with short Hard levels. Money: kit/money.js (style B).
import * as THREE from './kit/three.module.min.js';
import { GLTFLoader } from './kit/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from './kit/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from './kit/addons/utils/BufferGeometryUtils.js';
import { cine } from './kit/cine.js';
import { store, rng, buzz } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { money } from './kit/money.js';
import { buildDorm, radialTex } from './dorm.js';
import { snd } from './audio.js';
import { FRIENDS, FRIEND_IDS, CH, CHAIN_NAME, NAMES, GENS, REACT, ROOMS, TASK_TOTAL, roomOf, STORY, NAME_OF } from './story.js';

const $ = s => document.getElementById(s);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const BASE = new URL('./', import.meta.url).href;
const SLUG = 'mergie-dorm', FULL = 'Mergie Dorm';
const LOCAL = /^(127\.0\.0\.1|localhost)$/.test(location.hostname);

// ------------------------------------------------------------ catalogue
const INFO = {};
for (const [chain, ids] of Object.entries(CH)) ids.forEach((id, i) => INFO[id] = { chain, tier: i + 1, max: ids.length, next: ids[i + 1] || null });
const ITEM_IDS = [...CH.beauty, ...CH.sweets, ...CH.plush, 'x01'];
const GEN_IDS = Object.keys(GENS);
const N = 7, TOP = 0.42, SLOT_X = [-2.5, 0, 2.5], SLOT_Z = -4.7, HERO_H = 2.35;
const cellPos = (r, c, y = TOP) => V3(c - 3, y, r - 3);
const thumb = id => `${BASE}assets/thumbs/${id}.webp`;
const E_MAX = 150, E_REGEN = 12e3, WAND_COST = 60, LUCKY_COST = 40, ENERGY_COST = 80, ENERGY_PACK = 50;

// ------------------------------------------------------------ save
const S0 = store(SLUG);
const keys = ['level', 'stars', 'restored', 'wand', 'lucky', 'total', 'seen', 'best', 'energy', 'eAt', 'met', 'pages', 'story', 'dStreak', 'dLast', 'freezeWeek', 'dDone'];
const S = { level: 1, stars: 0, restored: 0, wand: 1, lucky: 1, total: 0, seen: [], best: {}, energy: E_MAX, eAt: Date.now(), met: [], pages: [], story: {}, dStreak: 0, dLast: 0, freezeWeek: '', dDone: 0 };
for (const k of keys) S[k] = S0.get(k, S[k]);
{ const q = new URLSearchParams(location.search); if (LOCAL && q.has('restored')) { S.restored = +q.get('restored'); S.stars = +q.get('stars') || 0; S.story = { intro: 1, room2: 1, room3: 1 }; if (q.has('level')) S.level = +q.get('level'); } }
const save = () => { for (const k of keys) S0.set(k, S[k]); };
// energy regenerates gently while away
function tickEnergy() { const now = Date.now(); if (S.energy >= E_MAX) { S.eAt = now; return; } const k = Math.floor((now - S.eAt) / E_REGEN); if (k > 0) { S.energy = Math.min(E_MAX, S.energy + k); S.eAt += k * E_REGEN; if (S.energy >= E_MAX) S.eAt = now; } }
tickEnergy();

// ------------------------------------------------------------ kit layers: daily, flow, world board, money
const startEl = $('start'), winEl = $('win');
const D = daily(SLUG, { els: { start: startEl.querySelector('.panel'), win: winEl.querySelector('.panel') }, pop: t => toast(t) }, { name: FULL });
const F = flow(SLUG);
const B = board({ game: 'mergie-dorm', label: 'Stars earned', mode: 'sum', limits: { maxRun: 3, maxPerSec: 1 }, corner: 'tl' });
const MON = money({ game: SLUG, style: 'B' });
addEventListener('ap:ad', e => snd.pause(e.detail && e.detail.phase === 'start'));
MON.onChange(() => updateHud());
{ const dp = startEl.querySelector('.panel > p'); if (dp && !D.isDaily) dp.remove(); }   // our own streak line lives on the Daily button

// ------------------------------------------------------------ renderer + scene
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.domElement.id = 'c'; document.body.prepend(renderer.domElement);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight, false);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(44, innerWidth / innerHeight, 0.3, 160);
const C = cine(renderer, scene, camera, { exposure: 0.92, bloom: 0.26, bloomThreshold: 1.5, bloomRadius: 0.45, envIntensity: 0.38,
  grade: { sat: 1.22, contrast: 1.1, vignette: 0.12, grain: 0, tint: '#fffafd' } });
if (C.lite) C.bloom.enabled = false;

// ------------------------------------------------------------ load models (Z-up quantized kawaii props)
const MD = {};
const loader = new GLTFLoader();
function toFloat(src) {
  const g = new THREE.BufferGeometry(); if (src.index) g.setIndex(src.index.clone());
  for (const [n, a] of Object.entries(src.attributes)) { const arr = new Float32Array(a.count * a.itemSize), get = [a.getX, a.getY, a.getZ, a.getW];
    for (let i = 0; i < a.count; i++) for (let j = 0; j < a.itemSize; j++) arr[i * a.itemSize + j] = get[j].call(a, i); g.setAttribute(n, new THREE.BufferAttribute(arr, a.itemSize)); }
  return g;
}
async function loadModel(id) {
  const g = await loader.loadAsync(`${BASE}assets/${id}.glb`);
  let mesh = null; g.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
  g.scene.updateMatrixWorld(true);
  const geo = toFloat(mesh.geometry); geo.applyMatrix4(mesh.matrixWorld); geo.rotateX(Math.PI / 2); geo.computeBoundingBox();
  const b = geo.boundingBox, sz = b.getSize(V3()), k = 1 / Math.max(sz.x, sz.y, sz.z);
  geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); geo.scale(k, k, k);
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const mat = mesh.material; mat.envMapIntensity = 0.6;
  MD[id] = { geo, mat, mm: new THREE.Matrix4(), size: sz.multiplyScalar(k) };
}
const DECOR = [...new Set(ROOMS.flatMap(r => r.tasks.filter(t => t.kind === 'prop').map(t => t.id)))];
const texLoader = new THREE.TextureLoader();
const THUMB_TEX = {};
await Promise.all([...ITEM_IDS, ...GEN_IDS, ...DECOR].map(loadModel).concat(['k01', 'k02', 'k03', 'k04', 'k05'].map(id => texLoader.loadAsync(thumb(id)).then(t => { t.colorSpace = THREE.SRGBColorSpace; THUMB_TEX[id] = t; }).catch(() => {}))));
const W = buildDorm(scene, MD, THUMB_TEX);

// ------------------------------------------------------------ board visuals
const tileGeo = new RoundedBoxGeometry(0.93, 0.12, 0.93, 2, 0.05);
const tiles = new THREE.InstancedMesh(tileGeo, new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.25 }), N * N);
const TILE_A = new THREE.Color('#a57cec'), TILE_B = new THREE.Color('#b791f2'), TILE_HI = new THREE.Color('#ffe58a'), TILE_OK = new THREE.Color('#aef3da');
{ const m = new THREE.Matrix4(); for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { m.makeTranslation(c - 3, TOP - 0.06, r - 3); tiles.setMatrixAt(r * N + c, m); tiles.setColorAt(r * N + c, (r + c) % 2 ? TILE_B : TILE_A); } }
tiles.receiveShadow = true; W.tray.add(tiles);
const IM = {}, CAP = 49;
for (const id of ITEM_IDS) {
  const im = new THREE.InstancedMesh(MD[id].geo, MD[id].mat, CAP); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false; im.count = 0; im.castShadow = true;
  for (let i = 0; i < CAP; i++) im.setColorAt(i, new THREE.Color(1, 1, 1));
  scene.add(im); IM[id] = im;
}
const shadowIM = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: radialTex('rgba(90,30,110,.4)'), transparent: true, depthWrite: false, toneMapped: false }), CAP + 4);
shadowIM.count = 0; shadowIM.frustumCulled = false; shadowIM.renderOrder = 1; scene.add(shadowIM);
// bubble wrap: glossy pastel bubbles around locked items (merge next to it to pop it)
const wrapGeo = (() => {
  const parts = [new THREE.SphereGeometry(0.5, 28, 18)], R = rng(11);
  for (let i = 0; i < 14; i++) { const a = R() * Math.PI * 2, y = 0.1 + R() * 0.75, rr = Math.sqrt(Math.max(0, 0.25 - (y - 0.5) * (y - 0.5) * 0.9)); const s = new THREE.SphereGeometry(0.07 + R() * 0.05, 10, 8); s.translate(Math.cos(a) * rr, y - 0.5, Math.sin(a) * rr); parts.push(s); }
  const g = mergeGeometries(parts.map(p => p.toNonIndexed())); g.translate(0, 0.5, 0); return g;
})();
const wrapIM = new THREE.InstancedMesh(wrapGeo, new THREE.MeshPhysicalMaterial({ color: '#ffa8de', transparent: true, opacity: 0.55, roughness: 0.05, clearcoat: 1, iridescence: 0.8, iridescenceIOR: 1.6, depthWrite: false }), N * N);
wrapIM.count = 0; wrapIM.frustumCulled = false; wrapIM.renderOrder = 2; scene.add(wrapIM);
const ringMat = new THREE.MeshBasicMaterial({ color: '#ff5fa2', transparent: true, opacity: 0.95, toneMapped: false, depthWrite: false });
const selRing = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.48, 40).rotateX(-Math.PI / 2), ringMat); selRing.visible = false; selRing.renderOrder = 2; scene.add(selRing);
const hintIM = new THREE.InstancedMesh(new THREE.RingGeometry(0.38, 0.46, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#5fdcb6', transparent: true, opacity: 0.85, toneMapped: false, depthWrite: false }), N * N);
hintIM.count = 0; hintIM.frustumCulled = false; hintIM.renderOrder = 2; scene.add(hintIM);
const flashRings = Array.from({ length: 5 }, () => { const m = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#fff2a8', transparent: true, opacity: 0, toneMapped: false, depthWrite: false })); m.visible = false; m.renderOrder = 3; scene.add(m); return { m, t: 9 }; });
let flashI = 0;
function ringFlash(p, color = '#fff2a8') { const f = flashRings[flashI++ % flashRings.length]; f.m.position.set(p.x, TOP + 0.03, p.z); f.m.material.color.set(color); f.t = 0; f.m.visible = true; }
// generators (the kawaii bag, oven and plushie box) on glowing pads
const genMesh = {};
for (const id of GEN_IDS) {
  const g = new THREE.Group(), m = new THREE.Mesh(MD[id].geo, MD[id].mat); m.castShadow = true; g.add(m);
  const pad = new THREE.Mesh(new THREE.CircleGeometry(0.47, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffe8f6', transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false })); pad.position.y = 0.006; g.add(pad);
  const rim = new THREE.Mesh(new THREE.RingGeometry(0.44, 0.5, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff8cc6', transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false })); rim.position.y = 0.008; g.add(rim);
  g.userData = { pad, rim, m }; g.visible = false; scene.add(g); genMesh[id] = g;
}

// ------------------------------------------------------------ particles: sparkles (points) + confetti (instanced hearts/stars)
const SPN = 420;
const spGeo = new THREE.BufferGeometry();
const spPos = new Float32Array(SPN * 3), spCol = new Float32Array(SPN * 3), spSize = new Float32Array(SPN), spVel = new Float32Array(SPN * 3), spLife = new Float32Array(SPN), spMax = new Float32Array(SPN);
spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3)); spGeo.setAttribute('aCol', new THREE.BufferAttribute(spCol, 3)); spGeo.setAttribute('size', new THREE.BufferAttribute(spSize, 1));
const starTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#fff'; x.beginPath(); x.moveTo(32, 2); x.quadraticCurveTo(34, 30, 62, 32); x.quadraticCurveTo(34, 34, 32, 62); x.quadraticCurveTo(30, 34, 2, 32); x.quadraticCurveTo(30, 30, 32, 2); x.fill(); return new THREE.CanvasTexture(c); })();
const spMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { map: { value: starTex }, uScale: { value: innerHeight } },
  vertexShader: 'uniform float uScale; attribute float size; attribute vec3 aCol; varying vec3 vC; varying float vA; void main(){ vC = aCol; vA = clamp(size, 0., 1.); vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = size * 0.32 * uScale / -mv.z; gl_Position = projectionMatrix * mv; }',
  fragmentShader: 'uniform sampler2D map; varying vec3 vC; varying float vA; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC * 1.5, t.a * vA); }' });
const sparks = new THREE.Points(spGeo, spMat); sparks.frustumCulled = false; sparks.renderOrder = 5; scene.add(sparks);
let spI = 0;
function sparkle(p, color = '#fff3a0', n = 16, speed = 2.2, up = 2, size = 1) {
  const col = new THREE.Color(color);
  for (let k = 0; k < n; k++) {
    const i = spI++ % SPN, a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
    spPos[i * 3] = p.x; spPos[i * 3 + 1] = p.y; spPos[i * 3 + 2] = p.z;
    spVel[i * 3] = Math.cos(a) * s; spVel[i * 3 + 1] = up * (0.5 + Math.random()); spVel[i * 3 + 2] = Math.sin(a) * s;
    spCol[i * 3] = col.r; spCol[i * 3 + 1] = col.g; spCol[i * 3 + 2] = col.b; spMax[i] = spLife[i] = 0.6 + Math.random() * 0.5; spSize[i] = size * (0.6 + Math.random() * 0.8);
  }
}
const heartGeo = (() => { const s = new THREE.Shape(); s.moveTo(0, -0.06); s.bezierCurveTo(-0.15, 0.04, -0.07, 0.15, 0, 0.07); s.bezierCurveTo(0.07, 0.15, 0.15, 0.04, 0, -0.06); return new THREE.ShapeGeometry(s); })();
const CONF = 240, confIM = new THREE.InstancedMesh(heartGeo, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.4 }), CONF);
confIM.frustumCulled = false; confIM.count = CONF; scene.add(confIM);
const conf = Array.from({ length: CONF }, () => ({ p: V3(0, -50, 0), v: V3(), r: V3(), w: V3(), life: 0 }));
let confI = 0;
const CONF_COL = ['#ff5fa2', '#ffd95e', '#5fdcb6', '#7fc8ff', '#b48cff', '#ffffff', '#ff9e7a'];
function confetti(p, n = 70, spread = 3, colors = CONF_COL) {
  for (let k = 0; k < n; k++) { const c = conf[confI % CONF]; confIM.setColorAt(confI % CONF, new THREE.Color(colors[k % colors.length])); confI++;
    c.p.copy(p); const a = Math.random() * 6.28; c.v.set(Math.cos(a) * spread * Math.random(), 4 + Math.random() * 4, Math.sin(a) * spread * Math.random()); c.r.set(Math.random() * 6, Math.random() * 6, 0); c.w.set(Math.random() * 10 - 5, Math.random() * 10 - 5, 0); c.life = 2.2 + Math.random(); }
  confIM.instanceColor.needsUpdate = true;
}
function updateFx(dt) {
  for (let i = 0; i < SPN; i++) { if (spLife[i] <= 0) { spSize[i] = 0; continue; } spLife[i] -= dt; spVel[i * 3 + 1] -= 3.2 * dt; for (let k = 0; k < 3; k++) spPos[i * 3 + k] += spVel[i * 3 + k] * dt; spSize[i] = Math.max(0, spLife[i] / spMax[i]) * (0.6 + 0.4 * Math.sin(spLife[i] * 30)) + 0.0001; }
  spGeo.attributes.position.needsUpdate = spGeo.attributes.size.needsUpdate = spGeo.attributes.aCol.needsUpdate = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = V3(1.6, 1.6, 1.6), zero = V3(0, 0, 0);
  conf.forEach((c, i) => { if (c.life <= 0) { m.compose(c.p, q, zero); confIM.setMatrixAt(i, m); return; } c.life -= dt; c.v.y -= 7 * dt; c.v.multiplyScalar(1 - 1.6 * dt); if (c.v.y < -1.6) c.v.y = -1.6; c.p.addScaledVector(c.v, dt); c.r.addScaledVector(c.w, dt);
    m.compose(c.p, q.setFromEuler(e.set(c.r.x, c.r.y, c.r.z)), c.life < 0.4 ? one.clone().multiplyScalar(c.life / 0.4) : one); confIM.setMatrixAt(i, m); });
  confIM.instanceMatrix.needsUpdate = true;
  for (const f of flashRings) { if (f.t > 0.5) { f.m.visible = false; continue; } f.t += dt; const k = f.t / 0.5; f.m.scale.setScalar(0.8 + k * 1.6); f.m.material.opacity = (1 - k) * 0.95; }
}

// ------------------------------------------------------------ friends (rigged kawaii chibis k01–k05)
const friends = {};   // id → { obj, mixer, actions, slot, k, out, backT, cur }
let friendsReady = false;
(async () => {
  await Promise.all(FRIEND_IDS.map(async id => {
    try {
      const g = await loader.loadAsync(`${BASE}assets/chars/${id}.glb`);
      g.scene.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = true; if (o.material) o.material.envMapIntensity = 0.7; } });
      const box = new THREE.Box3().setFromObject(g.scene), s = HERO_H / (box.max.y - box.min.y);
      const obj = new THREE.Group(); g.scene.scale.setScalar(s); g.scene.position.y = -box.min.y * s; obj.add(g.scene);
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5).rotateX(-Math.PI / 2), shadowIM.material); sh.position.y = 0.012; sh.renderOrder = 1; obj.add(sh);
      const mixer = new THREE.AnimationMixer(g.scene), actions = {};
      for (const a of g.animations) actions[a.name] = mixer.clipAction(a);
      obj.visible = false; scene.add(obj);
      friends[id] = { id, obj, mixer, actions, slot: -1, k: 1, out: 0, backT: 0, cur: null, home: 0 };
      play(friends[id], 'idle');
    } catch (e) { /* a missing friend just stays off stage */ }
  }));
  friendsReady = true; layoutFriends();
  if (state === 'play') for (const s of slots) if (s.order != null && !s.friend) seatFriend(s, level.orders[s.order]);
})();
function play(f, name, { fade = 0.25, once = false } = {}) {
  const a = f.actions[name] || f.actions.idle; if (!a || f.cur === a) return;
  a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = once; a.enabled = true; a.setEffectiveWeight(1);
  if (f.cur) a.crossFadeFrom(f.cur, fade, false); a.play(); f.cur = a;
  if (once) f.backT = performance.now() / 1000 + Math.max(0.6, a.getClip().duration - fade);
}
const HOME_SPOTS = [[-3.0, -5.3, 0.4], [-1.5, -6.3, 0.2], [0.05, -5.0, 0], [1.55, -6.3, -0.2], [3.05, -5.3, -0.4]];
function layoutFriends() {
  if (!friendsReady) return;
  if (state === 'play' || state === 'won') {
    for (const f of Object.values(friends)) if (f.slot < 0) f.obj.visible = false;
    return;
  }
  FRIEND_IDS.forEach((id, i) => { const f = friends[id]; if (!f) return; const [x, z, ry] = HOME_SPOTS[i]; f.slot = -1; f.obj.position.set(x, 0, z); f.obj.rotation.y = ry; f.obj.visible = true; f.k = 1; f.out = 0; play(f, 'idle'); });
}

// ------------------------------------------------------------ game state
let state = 'ready', level = null, grid = [], ents = [], sel = null, drag = null, taps = 0, delivered = 0, t0 = 0, lucky = 0, recorded = false, perOrder = [];
const slots = SLOT_X.map((x, i) => ({ i, x, order: null, friend: null, el: null, sayT: 0 }));
for (const s of slots) {
  const el = document.createElement('div'); el.className = 'bub gone';
  el.innerHTML = '<div class="say"></div><div class="box"></div><button class="give">Give</button><div class="who"></div>';
  el.querySelector('.give').addEventListener('pointerdown', e => { e.stopPropagation(); deliver(s.i); });
  el.querySelector('.box').addEventListener('pointerdown', e => { e.stopPropagation(); if (s.order != null && canDeliver(level.orders[s.order])) deliver(s.i); else snd.pick(); });
  $('bubbles').appendChild(el); s.el = el;
}

function makeLevel(n, seed, isDaily) {
  const R = rng(seed), fk = isDaily ? 1 : F.k();
  const hard = !isDaily && n >= 6 && n % 6 === 0;
  let cap = n <= 1 ? 2 : n <= 3 ? 3 : n <= 7 ? 4 : n <= 12 ? 5 : 6; if (hard) cap = Math.min(6, cap + 1);
  const chains = n <= 1 ? ['beauty'] : n <= 3 ? ['beauty', 'sweets'] : ['beauty', 'sweets', 'plush'];
  let count = clamp(Math.round((n <= 1 ? 3 : n <= 3 ? 4 : n <= 6 ? 5 : n <= 10 ? 6 : n <= 20 ? 7 : 8) * fk), 3, 9);
  if (hard) count = Math.max(3, Math.round(count * 0.55));
  const pickTier = (chain, maxT = cap) => { const mx = Math.min(maxT, CH[chain].length), mn = Math.max(2, mx - 2); return mn + Math.floor(Math.pow(R(), hard ? 0.5 : 0.8) * (mx - mn + 1)); };
  const orders = [];
  for (let i = 0; i < count; i++) {
    const ch = n === 2 && i < 2 ? 'sweets' : n === 4 && i < 2 ? 'plush' : chains[(R() * chains.length) | 0];
    const items = [CH[ch][(n <= 1 && i === 0 ? 2 : pickTier(ch)) - 1]];
    if (n >= 5 && !hard && R() < 0.3) { const ch2 = chains[(R() * chains.length) | 0]; items.push(CH[ch2][pickTier(ch2, cap - 1) - 1]); }
    orders.push({ items, chain: ch, coins: 3 + items.reduce((a, id) => a + 2 * Math.pow(2, INFO[id].tier - 1), 0) });
  }
  const base = orders.reduce((a, o) => a + o.items.reduce((b, id) => b + Math.pow(2, INFO[id].tier - 1), 0), 0);
  const par = Math.ceil(base * (n <= 5 ? 1.15 : hard ? 0.85 : 0.72) + 2 + count);
  const nb = n <= 1 ? 4 : Math.min(5 + Math.floor(n / 2), 18);
  const wraps = [], pre = [], used = new Set(Object.values(GENS).map(g => g.cell.join(',')));
  const freeCell = rows => { for (let k = 0; k < 200; k++) { const r = rows[(R() * rows.length) | 0], c = (R() * N) | 0; if (!used.has(r + ',' + c)) { used.add(r + ',' + c); return [r, c]; } } return null; };
  for (let i = 0; i < nb; i++) { const cell = freeCell(i < 7 ? [0] : i < 13 ? [0, 1] : [0, 1, 2]); if (!cell) break; const ch = chains[(R() * chains.length) | 0]; wraps.push([...cell, CH[ch][Math.min(CH[ch].length, 1 + ((R() * 3) | 0)) - 1]]); }
  const npre = n <= 1 ? 2 : 3 + Math.min(3, n >> 2);
  for (let i = 0; i < npre; i++) { const cell = freeCell([3, 4, 5]); if (!cell) break; const ch = chains[(R() * chains.length) | 0]; pre.push([...cell, CH[ch][R() < 0.25 ? 1 : 0]]); }
  const gens = GEN_IDS.filter(id => chains.includes(GENS[id].chain));
  return { n, seed, orders, par, par2: Math.ceil(par * 1.45), gens, wraps, pre, hard, chains, free: n <= 5 || isDaily };
}

function ent(id, r, c, o = {}) {
  const e = { id, r, c, kind: GENS[id] ? 'gen' : id === 'x01' ? 'chest' : 'item', locked: false, pos: cellPos(r, c), born: performance.now() / 1000, pop: 0, fly: null, hidden: false, phase: Math.random() * 6, ...o };
  grid[r][c] = e; ents.push(e); return e;
}
function startLevel() {
  if (state !== 'ready') return;
  const isDaily = !!D.seed;
  const n = isDaily ? 8 : S.level;
  level = makeLevel(n, isDaily ? D.seed : n * 7919 + 13, isDaily);
  level.daily = isDaily;
  grid = Array.from({ length: N }, () => Array(N).fill(null)); ents = []; sel = null; drag = null; taps = 0; delivered = 0; lucky = 0; recorded = false; perOrder = [];
  level.rg = rng(level.seed + 99); level.rc = rng(level.seed + 7);
  for (const g of Object.values(genMesh)) g.visible = false;
  for (const id of level.gens) { const [r, c] = GENS[id].cell; ent(id, r, c); genMesh[id].visible = true; }
  for (const [r, c, id] of level.wraps) ent(id, r, c, { locked: true });
  for (const [r, c, id] of level.pre) ent(id, r, c);
  level.queue = level.orders.map((_, i) => i);
  for (const f of Object.values(friends)) { f.obj.visible = false; f.slot = -1; }
  slots.forEach(s => { s.order = null; s.friend = null; s.el.classList.add('gone'); });
  state = 'play'; t0 = performance.now();
  slots.forEach((s, i) => setTimeout(() => assignOrder(s), 300 + i * 240));
  startEl.classList.add('hide'); $('bar').classList.remove('hide'); $('meter').classList.remove('hide');
  W.tray.visible = true; camGoal = 'board'; selectEnt(null); updateHud();
  MON.level(level.n);
  if (!level.daily) {
    if (level.n === 1) setTimeout(() => quip('k01', 'Tap my Makeup Bag, then drag two alike together!', 3600), 700);
    else if (level.n === 2) setTimeout(() => quip('k05', 'I brought the Mini Oven! Sweets incoming 🧁', 2600), 900);
    else if (level.n === 4) setTimeout(() => quip('k03', 'Plushie Box unlocked! Merge next to bubble wrap to pop it.', 3400), 900);
    else if (level.hard) setTimeout(() => quip('k04', 'Hard level! Short but spicy. Double coins.', 2600), 900);
  }
  B.start();
}
function friendFor(order, s) {
  const busy = new Set(slots.filter(x => x !== s && x.friend).map(x => x.friend.id));
  const ok = FRIEND_IDS.filter(id => friends[id] && !busy.has(id));
  const fans = ok.filter(id => FRIENDS[id].likes.includes(order.chain) && FRIENDS[id].likes.length === 1);
  const pool = fans.length ? fans : ok.filter(id => FRIENDS[id].likes.includes(order.chain));
  const list = pool.length ? pool : ok;
  return list.length ? friends[list[(level.rg() * list.length) | 0]] : null;
}
function seatFriend(s, o) {
  const f = friendsReady ? friendFor(o, s) : null;
  if (f && f !== s.friend) {
    if (s.friend) { s.friend.obj.visible = false; s.friend.slot = -1; }
    s.friend = f; f.slot = s.i; f.obj.position.set(s.x, TOP - 0.3, SLOT_Z); f.obj.rotation.y = -s.x * 0.08; f.obj.visible = true; f.k = 0; f.out = 0; play(f, 'wave', { once: true });
  }
  if (s.friend && !S.met.includes(s.friend.id)) { S.met.push(s.friend.id); save(); }
  const who = s.el.querySelector('.who'); who.textContent = s.friend ? NAME_OF(s.friend.id) : ''; who.style.background = s.friend ? FRIENDS[s.friend.id].color : 'transparent';
}
function assignOrder(s) {
  if (state !== 'play' || !level.queue.length) return;
  s.order = level.queue.shift();
  const o = level.orders[s.order], box = s.el.querySelector('.box');
  box.innerHTML = o.items.map(id => `<div class="it" data-id="${id}"><img src="${thumb(id)}" alt="${NAMES[id]}"><div class="ok">✓</div></div>`).join('');
  s.el.classList.remove('gone', 'ready');
  seatFriend(s, o);
  o.t0 = taps;
  refreshOrders(); updateHud();
}
const unlockedOf = id => ents.filter(e => e.id === id && !e.locked && !e.fly && !e.hidden && e.kind !== 'gen');
function canDeliver(o) {
  const need = {}; for (const id of o.items) need[id] = (need[id] || 0) + 1;
  return Object.entries(need).every(([id, k]) => unlockedOf(id).length >= k);
}
function refreshOrders() {
  for (const s of slots) {
    if (s.order == null) continue; const o = level.orders[s.order], counts = {};
    s.el.querySelectorAll('.it').forEach(d => { const id = d.dataset.id; counts[id] = (counts[id] || 0) + 1; d.classList.toggle('have', unlockedOf(id).length >= counts[id]); });
    s.el.classList.toggle('ready', canDeliver(o));
  }
}

// ------------------------------------------------------------ energy
function energyFree() { return level && state === 'play' && level.free; }
function spendEnergy() {
  if (energyFree()) return true;
  tickEnergy();
  if (S.energy < 1) return false;
  if (S.energy >= E_MAX) S.eAt = Date.now();
  S.energy -= 1; return true;
}
function addEnergy(n) { tickEnergy(); S.energy = Math.min(E_MAX + 50, S.energy + n); if (S.energy >= E_MAX) S.eAt = Date.now(); save(); bumpChip('energychip'); updateHud(); }
let sheetOpen = false;
async function outOfEnergy() {
  if (sheetOpen) return;
  sheetOpen = true;
  const ok = await MON.rewarded('energy', { title: 'Energy refill', what: `+${ENERGY_PACK} energy right now` });
  sheetOpen = false;
  if (ok) { addEnergy(ENERGY_PACK); toast(`+${ENERGY_PACK} ⚡`); snd.zap(); }
  else toast(`+1 ⚡ every ${E_REGEN / 1000} s`, 'small');
}
function energySheet() {
  tickEnergy();
  const mins = S.energy >= E_MAX ? 0 : Math.ceil(((E_MAX - S.energy) * E_REGEN - (Date.now() - S.eAt)) / 60000);
  const canBuy = MON.coins() >= ENERGY_COST;
  const w = sheet(`<h3>Energy ⚡ ${Math.floor(S.energy)}/${E_MAX}</h3>
    <p>Each tap on a generator uses 1 ⚡. It refills by itself: +1 every ${E_REGEN / 1000} s${mins ? ` (full in about ${mins} min)` : ' (full now)'}.<br>Levels 1–5 and the Daily are free.</p>
    ${S.energy < E_MAX ? (canBuy ? `<button class="big gold" data-a="buy"><svg viewBox="0 0 24 24"><use href="#bolt"/></svg>+${ENERGY_PACK} for <svg viewBox="0 0 24 24"><use href="#coin"/></svg>${ENERGY_COST}</button>` : `<button class="big" data-a="ad">▶ Watch a video: +${ENERGY_PACK} ⚡</button>`) : ''}
    <button class="big grey" data-a="x">Keep merging</button>`);
  w.addEventListener('click', async e => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return; w.remove();
    if (a === 'buy' && MON.spend(ENERGY_COST, 'energy')) { addEnergy(ENERGY_PACK); snd.zap(); toast(`+${ENERGY_PACK} ⚡`); }
    if (a === 'ad') outOfEnergy();
  });
}
function sheet(html, cls = '') {
  const w = document.createElement('div'); w.className = 'sheet ' + cls; w.innerHTML = `<div class="in"><button class="x" data-a="x" aria-label="Close">×</button>${html}</div>`;
  w.addEventListener('pointerdown', e => { e.stopPropagation(); if (e.target === w) w.remove(); });
  w.addEventListener('click', e => { if (e.target.closest('[data-a="x"]')) w.remove(); });
  document.body.appendChild(w); return w;
}

// ------------------------------------------------------------ actions
function emptyNear(r0, c0) {
  let best = null, bd = 1e9;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!grid[r][c]) { const d = Math.abs(r - r0) + Math.abs(c - c0) + (r < r0 ? 0.01 : 0) + Math.random() * 0.001; if (d < bd) { bd = d; best = [r, c]; } }
  return best;
}
function genTap(g) {
  const cell = emptyNear(g.r, g.c);
  if (!cell) { snd.nope(); g.pop = performance.now() / 1000; toast('Board full! Merge or sell', 'small'); return false; }
  if (!spendEnergy()) { snd.nope(); g.pop = performance.now() / 1000; outOfEnergy(); return false; }
  taps++;
  const chain = GENS[g.id].chain, tier = lucky > 0 ? 2 : level.rg() < 0.1 ? 2 : 1; if (lucky > 0) lucky--;
  const id = CH[chain][tier - 1];
  const e = ent(id, cell[0], cell[1]);
  e.pos = g.pos.clone(); e.fly = { a: g.pos.clone().setY(TOP + 0.4), b: cellPos(cell[0], cell[1]), t0: performance.now() / 1000, dur: 0.32, h: 0.9 };
  g.pop = performance.now() / 1000; snd.pop(); buzz(6);
  sparkle(g.pos.clone().setY(TOP + 0.7), '#ffd2ec', 7, 1.2, 1.5, 0.7);
  if (!S.seen.includes(id)) { S.seen.push(id); save(); }
  hint.gen = true; save(); updateHud(); refreshOrders();
  return true;
}
function moveEnt(e, r, c) { if (grid[e.r][e.c] === e) grid[e.r][e.c] = null; e.r = r; e.c = c; grid[r][c] = e; }
function killEnt(e) { if (grid[e.r][e.c] === e) grid[e.r][e.c] = null; e.hidden = true; ents = ents.filter(x => x !== e); if (sel === e) selectEnt(null); }
function merge(a, b) {
  const nx = INFO[a.id].next; if (!nx) return false;
  const p = cellPos(b.r, b.c), wasLocked = b.locked;
  killEnt(a); killEnt(b);
  const e = ent(nx, b.r, b.c); e.pop = performance.now() / 1000;
  hint.merge = true;
  const tier = INFO[nx].tier;
  snd.merge(tier); buzz(12); ringFlash(p, '#ffc2e2');
  sparkle(p.clone().setY(TOP + 0.45), tier >= 4 ? '#ffd86b' : '#ffd2ec', 10 + tier * 4, 1.8 + tier * 0.25, 2.2, 1 + tier * 0.15);
  if (tier >= 4) confetti(p.clone().setY(TOP + 0.5), 14 + tier * 6, 2);
  if (!S.seen.includes(nx)) { S.seen.push(nx); save(); toast(`New sticker: ${NAMES[nx]}!`); if (tier >= 4) snd.big(); }
  else if (tier >= 5) toast(NAMES[nx] + '!');
  if (wasLocked) unlockFx(e);
  for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = grid[b.r + dr]?.[b.c + dc]; if (n && n.locked) { n.locked = false; unlockFx(n); } }
  selectEnt(e);
  if (state === 'play') { refreshOrders(); updateHud(); }
  return true;
}
function unlockFx(e) { const p = cellPos(e.r, e.c); sparkle(p.clone().setY(TOP + 0.5), '#ffffff', 22, 2.4, 2, 1.1); confetti(p.clone().setY(TOP + 0.4), 12, 1.4, ['#ffd6f0', '#ffffff', '#c8b6ff']); e.pop = performance.now() / 1000; snd.bubble(); }
function deliver(si) {
  const s = slots[si]; if (state !== 'play' || s.order == null) return false;
  const o = level.orders[s.order]; if (!canDeliver(o)) { snd.nope(); return false; }
  const target = V3(s.x, 1.35, SLOT_Z + 0.3);
  for (const id of o.items) {
    const list = unlockedOf(id).sort((a, b) => (a === sel ? -1 : 0) - (b === sel ? -1 : 0)), e = list[0];
    grid[e.r][e.c] = null; if (sel === e) selectEnt(null);
    e.fly = { a: e.pos.clone(), b: target, t0: performance.now() / 1000, dur: 0.5, h: 1.6, shrink: true, onEnd: () => { e.hidden = true; ents = ents.filter(x => x !== e); } };
  }
  const ideal = o.items.reduce((a, id) => a + Math.pow(2, INFO[id].tier - 1), 0);
  perOrder.push((taps - (o.t0 || 0)) / Math.max(1, ideal));
  const coinsAt = toScreen(V3(s.x, HERO_H + 0.6, SLOT_Z));
  s.order = null; delivered++;
  const f = s.friend;
  setTimeout(() => {
    if (f) { play(f, Math.random() < 0.5 ? 'cheer' : 'jump', { once: true }); say(s, REACT[f.id][(Math.random() * REACT[f.id].length) | 0]); }
    sparkle(V3(s.x, 1.6, SLOT_Z), '#ffe08a', 24, 2.4, 2.6, 1.3); confetti(V3(s.x, 2, SLOT_Z), 26, 2); snd.give();
    const coins = o.coins * (level.hard ? 2 : 1); MON.add(coins, 'order'); flyCoins(coinsAt, coins);
  }, 480);
  s.el.classList.remove('ready'); s.el.querySelector('.box').style.visibility = 'hidden'; s.el.querySelector('.give').style.visibility = 'hidden';
  if (level.rc() < 0.3 && delivered < level.orders.length) setTimeout(() => dropChest(s), 900);
  if (delivered >= level.orders.length) { state = 'won'; setTimeout(winLevel, 1100); }
  else if (!level.queue.length) setTimeout(() => { if (state === 'play' && s.order == null && s.friend) { s.friend.out = 1; } }, 1700);
  else setTimeout(() => { if (state !== 'play') return; s.el.querySelector('.box').style.visibility = ''; s.el.querySelector('.give').style.visibility = ''; assignOrder(s); }, 1500);
  updateHud(); refreshOrders(); buzz([10, 30, 10]);
  return true;
}
function say(s, text) { const el = s.el.querySelector('.say'); el.textContent = text; el.classList.add('on'); s.el.classList.remove('gone'); clearTimeout(s.sayT); s.sayT = setTimeout(() => { el.classList.remove('on'); if (s.order == null) s.el.classList.add('gone'); }, 1500); }
function dropChest(s) {
  if (state !== 'play') return;
  const cell = emptyNear(3, 3); if (!cell) return;
  const e = ent('x01', cell[0], cell[1]);
  e.pos = V3(s.x, 1.4, SLOT_Z); e.fly = { a: V3(s.x, 1.4, SLOT_Z), b: cellPos(cell[0], cell[1]), t0: performance.now() / 1000, dur: 0.6, h: 2 };
  snd.chest();
}
function openChest(e) {
  const p = cellPos(e.r, e.c); killEnt(e);
  const coins = 8 + ((level.rc() * 12) | 0); MON.add(coins, 'chest'); flyCoins(toScreen(p), coins);
  snd.chest(); confetti(p.clone().setY(TOP + 0.5), 40, 2.4); sparkle(p.clone().setY(TOP + 0.5), '#ffd86b', 30, 2.6, 2.8, 1.4); buzz(15);
  const need = needByChain(), chains = level.chains.filter(k => need[k] > 0);
  for (let k = 0; k < 2; k++) {
    const cell = emptyNear(e.r, e.c); if (!cell) break; const ch = chains.length ? chains[(level.rc() * chains.length) | 0] : level.chains[0];
    const it = ent(CH[ch][1], cell[0], cell[1]); it.pos = p.clone(); it.fly = { a: p.clone().setY(TOP + 0.4), b: cellPos(cell[0], cell[1]), t0: performance.now() / 1000 + k * 0.1, dur: 0.4, h: 1 };
  }
  const roll = level.rc();
  if (roll < 0.25) { S.wand++; toast('+1 ✨ Upgrade'); } else if (roll < 0.45) { S.lucky++; toast('+1 🌈 Lucky'); } else if (roll < 0.7 && !level.free) { addEnergy(10); toast('+10 ⚡'); }
  save(); updateHud(); refreshOrders();
}
function needByChain() {
  const need = { beauty: 0, sweets: 0, plush: 0 };
  const pending = [...slots.filter(s => s.order != null).map(s => s.order), ...level.queue];
  for (const oi of pending) for (const id of level.orders[oi].items) need[INFO[id].chain] += Math.pow(2, INFO[id].tier - 1);
  for (const e of ents) if (e.kind === 'item' && !e.hidden) need[INFO[e.id].chain] -= Math.pow(2, INFO[e.id].tier - 1) * 0.5;
  for (const k in need) need[k] = Math.max(0, need[k]);
  return need;
}
function sell(e) {
  if (!e || e.kind !== 'item' || e.locked) return;
  const v = INFO[e.id].tier, p = cellPos(e.r, e.c); killEnt(e); MON.add(v, 'sell'); flyCoins(toScreen(p), v); snd.coin();
  sparkle(p.clone().setY(TOP + 0.3), '#ffe28a', 8, 1.4, 1.6, 0.8); updateHud(); refreshOrders();
}
async function useWand() {
  if (!sel || sel.kind !== 'item' || sel.locked || !INFO[sel.id].next) { toast('Pick an item to upgrade', 'small'); snd.nope(); return false; }
  const target = sel;
  if (S.wand > 0) S.wand--;
  else if (MON.spend(WAND_COST, 'upgrade')) {}
  else { if (sheetOpen) return false; sheetOpen = true; const ok = await MON.rewarded('hint', { title: 'Free upgrade', what: `Your ${NAMES[target.id]} becomes a ${NAMES[INFO[target.id].next]}` }); sheetOpen = false; if (!ok || target.hidden || state !== 'play') return false; }
  const e = target, r = e.r, c = e.c, nx = INFO[e.id].next; killEnt(e);
  const n = ent(nx, r, c); n.pop = performance.now() / 1000; snd.big(); sparkle(cellPos(r, c, TOP + 0.4), '#d6b6ff', 30, 2.2, 2.4, 1.3); ringFlash(n.pos, '#d6b6ff');
  if (!S.seen.includes(nx)) { S.seen.push(nx); toast(`New sticker: ${NAMES[nx]}!`); }
  selectEnt(n); save(); updateHud(); refreshOrders(); return true;
}
function useLucky() {
  if (S.lucky > 0) S.lucky--; else if (!MON.spend(LUCKY_COST, 'lucky')) { toast(`Need ${LUCKY_COST} coins`, 'small'); snd.nope(); MON.shop(); return false; }
  lucky += 5;
  for (const g of ents.filter(e => e.kind === 'gen')) { g.pop = performance.now() / 1000; sparkle(g.pos.clone().setY(TOP + 0.6), '#a8ffe0', 20, 1.8, 2.4, 1.1); }
  toast('🌈 Next 5 come out bigger!'); snd.big(); save(); updateHud(); return true;
}

// ------------------------------------------------------------ win + restore
const starsFor = t => t <= level.par ? 3 : t <= level.par2 ? 2 : 1;
let winCoins = 0, lastStars = 0;
function winLevel() {
  const stars = starsFor(taps), ms = performance.now() - t0; lastStars = stars;
  if (!recorded) { recorded = true; F.level(true); }
  let gained = stars, streakLine = '';
  if (level.daily) {
    const today = D.seed;
    if (S.dDone !== today) {
      S.dDone = today;
      const yd = ymd(addDays(-1)), yd2 = ymd(addDays(-2)), wk = isoWeek();
      if (S.dLast === yd) S.dStreak++;
      else if (S.dLast === yd2 && S.freezeWeek !== wk) { S.dStreak++; S.freezeWeek = wk; streakLine = '❄️ Streak freeze used (1 free a week) · '; }
      else S.dStreak = 1;
      S.dLast = today;
    } else gained = 0;
    streakLine += `🔥 Daily streak ${S.dStreak}`;
  } else { const key = String(level.n); S.best[key] = Math.max(S.best[key] || 0, stars); S.level++; }
  S.stars += gained; S.total += gained;
  const en = Math.min(25, 8 + level.n); if (!level.daily) addEnergy(en);
  save();
  if (gained > 0) B.submit(gained, { ms });
  D.won(stars, 'earned stars in');
  winCoins = level.orders.reduce((a, o) => a + o.coins, 0) * (level.hard ? 2 : 1);
  for (const s of slots) if (s.friend && s.friend.obj.visible) play(s.friend, 'cheer', { once: true });
  confetti(V3(0, 2.4, -1), 140, 4); snd.win();
  $('wlevel').textContent = level.daily ? 'Daily Dorm' : level.hard ? `Hard level ${level.n}` : `Level ${level.n}`;
  $('wtitle').textContent = stars === 3 ? ['Slay!', 'Iconic!', 'Ate that!'][level.n % 3] : stars === 2 ? 'So cute!' : 'Done!';
  $('wline').textContent = stars === 3 ? 'Perfect planning, zero wasted taps.' : `${taps} taps used · 3★ at ${level.par}`;
  $('wstars').textContent = gained; $('wcoins').textContent = winCoins; $('wen').textContent = level.daily ? 0 : en;
  $('wen').parentElement.classList.toggle('hide', !!level.daily);
  $('wstreak').textContent = streakLine; $('wstreak').classList.toggle('hide', !level.daily);
  $('grid').classList.toggle('hide', !level.daily);
  const dbl = $('dbl'); dbl.disabled = false; dbl.classList.remove('hide'); dbl.innerHTML = `▶ Double coins <small>video</small>`;
  const best = slots.find(s => s.friend)?.friend; $('wpor').style.backgroundImage = `url(${thumb(best ? best.id : 'k01')})`;
  const svgs = [...$('bigstars').children]; svgs.forEach(s => s.classList.remove('in', 'dim'));
  winEl.classList.remove('hide'); winEl.dataset.t = performance.now();
  if (shareBtn) shareBtn.classList.toggle('hide', !!level.daily);
  svgs.forEach((s, i) => setTimeout(() => { s.classList.add('in'); if (i >= stars) s.classList.add('dim'); else snd.star(i); }, 250 + i * 260));
  $('bar').classList.add('hide'); $('meter').classList.add('hide'); selectEnt(null);
  for (const s of slots) { s.order = null; s.el.classList.add('gone'); }
  updateHud();
}
let leaving = false;
async function toReady() {
  if (leaving) return; leaving = true;
  winEl.classList.add('hide');
  for (const e of ents) e.hidden = true; ents = []; grid = []; for (const g of Object.values(genMesh)) g.visible = false;
  W.tray.visible = false;
  await MON.breakAd('level-end', { level: level ? level.n : S.level });
  state = 'ready'; leaving = false;
  for (const s of slots) { s.order = null; s.friend = null; s.el.classList.add('gone'); }
  camGoal = 'home'; layoutFriends(); renderStart(); startEl.classList.remove('hide'); updateHud();
  checkStory();
}
const curRoom = () => roomOf(S.restored);
function renderStart() {
  const { room, task } = curRoom(), R = ROOMS[room], t = R.tasks[task], all = S.restored >= TASK_TOTAL;
  $('stitle').textContent = D.seed ? 'Daily Dorm · same for everyone' : `Chapter ${room + 1} · ${R.name}`;
  const nextHard = !D.seed && S.level >= 6 && S.level % 6 === 0;
  $('slevel').textContent = D.seed ? (S.dDone === D.seed ? 'Done today ✓' : 'Daily Dorm') : nextHard ? `Hard Level ${S.level}` : `Level ${S.level}`;
  $('slevel').style.color = nextHard ? '#7a4cf0' : '';
  $('gbar').style.width = (Math.min(task, R.tasks.length) / R.tasks.length * 100) + '%'; $('gtext').textContent = all ? 'Dorm complete! 💖' : `${R.name} glow-up ${task}/${R.tasks.length}`;
  const pl = $('play'); pl.textContent = D.seed ? (S.dDone === D.seed ? 'Play again' : 'Play Daily') : nextHard ? `Play Hard ✦` : `Play Level ${S.level}`; pl.classList.toggle('daily', !!D.seed || nextHard);
  $('dailyL').textContent = D.seed ? 'Dorm' : S.dStreak > 0 && (S.dLast === ymd() || S.dLast === ymd(addDays(-1))) ? `Daily 🔥${S.dStreak}` : 'Daily';
  $('dailyBtn').querySelector('img').src = thumb(D.seed ? 'h01' : 'x04');
  $('albumN').textContent = `${albumCount()}/${ALBUM_TOTAL}`;
  const tb = $('tbtn');
  if (all || !t) { $('timg').src = thumb('k07'); $('tname').textContent = 'Cutest dorm on campus!'; $('tsub').textContent = 'Keep merging for stars on the world board'; tb.classList.add('hide'); return; }
  tb.classList.remove('hide');
  $('timg').src = thumb(t.kind === 'prop' ? t.id : { paint: 'x05', curtains: 'h04', lights: 'x04', polaroids: 'k01', neon: 'x02', bunting: 'x05', stars: 'x04', disco: 'x02' }[t.kind] || 'x04');
  $('tname').textContent = t.name; $('tcost').textContent = t.cost;
  $('tsub').textContent = S.stars >= t.cost ? `Tap ⭐ to decorate · you have ${S.stars}` : `Needs ${t.cost} ⭐ · you have ${S.stars}`;
  tb.classList.toggle('off', S.stars < t.cost);
}
let pan = null;
function restoreNext() {
  if (state !== 'ready' || storyOpen) return false;
  const { room, task } = curRoom(), t = ROOMS[room].tasks[task];
  if (!t || S.stars < t.cost) { if (t) { snd.nope(); toast(`Need ${t.cost} ⭐`, 'small'); } return false; }
  S.stars -= t.cost; S.restored++; save();
  const p = W.restore(task); pan = { p: p.clone(), until: performance.now() + 2300 };
  snd.restore(); buzz([10, 40, 20]);
  setTimeout(() => { sparkle(p, '#fff1a0', 50, 3, 3.5, 2.2); confetti(p.clone().setY(p.y + 1.5), 90, 3.5); }, 250);
  setTimeout(() => quip(t.who, t.line, 3400), 450);
  const fr = friends[t.who]; if (fr && fr.slot < 0) play(fr, 'cheer', { once: true });
  renderStart(); updateHud();
  if (task + 1 >= ROOMS[room].tasks.length) setTimeout(checkStory, 2600);
  return true;
}

// ------------------------------------------------------------ story (chapter cards)
let storyOpen = false, storyQ = [], storyDone = null;
function checkStory() {
  if (state !== 'ready' || storyOpen || D.seed) return;
  const done = S.restored, r1 = ROOMS[0].tasks.length, r2 = r1 + ROOMS[1].tasks.length;
  const show = (key, title, sub, after) => { S.story[key] = 1; save(); openStory(STORY[key], title, sub, after); };
  if (!S.story.intro) return show('intro', 'Chapter 1', 'Room 404');
  if (done >= r1 && !S.story.room2) return show('room2', 'Chapter 2', ROOMS[1].name, () => switchRoom());
  if (done >= r2 && !S.story.room3) return show('room3', 'Chapter 3', ROOMS[2].name, () => switchRoom());
  if (done >= TASK_TOTAL && !S.story.ending) return show('ending', 'The End?', 'Dorm complete', () => { confetti(V3(0, 4, -6), 200, 6); snd.win(); S.met.includes('k07') || S.met.push('k07'); save(); renderStart(); });
}
function switchRoom() { const { room, task } = curRoom(); W.setRoom(room, task); renderStart(); }
function openStory(lines, title, sub, after) {
  storyOpen = true; storyQ = lines.slice(); storyDone = after || null;
  const ch = $('stch'); ch.innerHTML = `<small>${sub}</small>${title}`; ch.classList.remove('hide');
  $('story').classList.remove('hide'); startEl.classList.add('hide'); nextLine();
}
function nextLine() {
  const l = storyQ.shift();
  if (!l) { storyOpen = false; $('story').classList.add('hide'); if (state === 'ready') startEl.classList.remove('hide'); const f = storyDone; storyDone = null; if (f) f(); renderStart(); return; }
  const [who, text] = l, nm = $('snm'), por = $('spor');
  por.style.backgroundImage = `url(${thumb(who)})`; por.style.animation = 'none'; void por.offsetWidth; por.style.animation = '';
  nm.textContent = NAME_OF(who); nm.style.background = who === 'k07' ? '#9b7bff' : FRIENDS[who].color;
  $('stx').textContent = text; const sb = $('story').querySelector('.sb'); sb.style.animation = 'none'; void sb.offsetWidth; sb.style.animation = '';
  snd.talk(); if (friends[who] && friends[who].slot < 0) play(friends[who], 'wave', { once: true });
  $('story').dataset.t = performance.now();
}
$('story').addEventListener('pointerdown', e => { e.stopPropagation(); snd.unlock(); if (performance.now() - (+$('story').dataset.t || 0) < 250) return; $('stch').classList.add('hide'); nextLine(); });

// ------------------------------------------------------------ album (sticker collection)
const ALBUM = [{ key: 'beauty', name: 'Beauty', ids: CH.beauty }, { key: 'sweets', name: 'Sweets', ids: CH.sweets }, { key: 'plush', name: 'Plush', ids: CH.plush }, { key: 'friends', name: 'Friends', ids: [...FRIEND_IDS, 'k07'] }];
const ALBUM_TOTAL = ALBUM.reduce((a, p) => a + p.ids.length, 0);
const hasSticker = id => id[0] === 'k' ? S.met.includes(id) : S.seen.includes(id);
const albumCount = () => ALBUM.reduce((a, p) => a + p.ids.filter(hasSticker).length, 0);
function openAlbum(page = 0) {
  const w = sheet('', 'album');
  const draw = () => {
    const P = ALBUM[page], got = P.ids.filter(hasSticker).length, full = got === P.ids.length, claimed = S.pages.includes(P.key);
    w.querySelector('.in').innerHTML = `<button class="x" data-a="x" aria-label="Close">×</button><h3>Sticker Album</h3><div class="tabs">${ALBUM.map((p, i) => `<button data-p="${i}" class="${i === page ? 'on' : ''}">${p.name} ${p.ids.filter(hasSticker).length}/${p.ids.length}</button>`).join('')}</div>
      <div class="stickers">${P.ids.map((id, i) => `<div class="st ${hasSticker(id) ? 'got' : ''}" style="--r:${((i * 37) % 7 - 3) * 0.8}deg">${id[0] === 'g' ? `<span class="tier">${INFO[id].tier}</span>` : ''}<img src="${thumb(id)}" alt=""><span>${hasSticker(id) ? (id[0] === 'k' ? NAME_OF(id) : NAMES[id]) : '?'}</span></div>`).join('')}</div>
      ${full && !claimed ? `<button class="big gold" data-a="claim">Page complete! Claim <svg viewBox="0 0 24 24"><use href="#coin"/></svg>150</button>` : `<p>${claimed ? 'Page complete ✓' : P.key === 'friends' ? 'Meet every friend (and someone fluffy) to finish this page: 150 coins' : 'Merge to discover every sticker: 150 coins per full page'}</p>`}`;
  };
  w.addEventListener('click', e => {
    const p = e.target.closest('[data-p]'); if (p) { page = +p.dataset.p; draw(); snd.pick(); return; }
    if (e.target.closest('[data-a="claim"]')) { S.pages.push(ALBUM[page].key); save(); MON.add(150, 'album'); snd.chest(); toast('+150 coins!'); draw(); renderStart(); }
  });
  draw();
}

// ------------------------------------------------------------ daily helpers + share grid
const ymd = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const addDays = k => { const d = new Date(); d.setDate(d.getDate() + k); return d; };
function isoWeek(d = new Date()) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return t.getUTCFullYear() + '-' + Math.ceil(((t - y0) / 864e5 + 1) / 7); }
function shareGrid() {
  const row = perOrder.map(k => k <= 1.05 ? '💖' : k <= 1.5 ? '💛' : '🤍');
  const d = new Date(), text = `${FULL} Daily ${d.getMonth() + 1}/${d.getDate()} ${'⭐'.repeat(lastStars)}\n${row.join('')}\n⚡${taps} taps · 🔥${S.dStreak}`;
  const url = location.origin + location.pathname + '?daily=1';
  if (navigator.share) navigator.share({ title: FULL, text, url }).catch(() => {});
  else navigator.clipboard?.writeText(`${text}\n${url}`).then(() => toast('Copied!', 'small')).catch(() => {});
}

// ------------------------------------------------------------ HUD + toasts + coin flights
function updateHud() {
  tickEnergy();
  const playing = level && (state === 'play' || state === 'won');
  const lv = playing ? (level.daily ? 0 : level.n) : (D.seed ? 0 : S.level);
  $('lvlchip').textContent = lv ? (playing && level.hard ? `Hard ${lv}` : `Level ${lv}`) : 'Daily';
  $('lvlchip').classList.toggle('hard', !!(playing && level.hard));
  $('lvlchip').classList.toggle('hide', !playing); $('starchip').classList.toggle('hide', !!playing);
  $('stars').textContent = S.stars; $('coins').textContent = MON.coins();
  $('energy').textContent = Math.floor(S.energy);
  const etm = $('etm'); if (S.energy < E_MAX && !playing) { const s = Math.max(0, Math.ceil((E_REGEN - (Date.now() - S.eAt)) / 1000)); etm.textContent = `+1 in 0:${String(s).padStart(2, '0')}`; etm.classList.remove('hide'); } else etm.classList.add('hide');
  $('nwand').textContent = S.wand > 0 ? S.wand : '🪙' + WAND_COST; $('nlucky').textContent = S.lucky > 0 ? S.lucky : '🪙' + LUCKY_COST;
  if (level && state === 'play') {
    $('ordn').textContent = `${delivered}/${level.orders.length}`;
    const st = starsFor(taps); [...$('mstars').children].forEach((s, i) => s.classList.toggle('off', i >= st));
    $('taps').textContent = `taps ${taps}/${st === 3 ? level.par : st === 2 ? level.par2 : '∞'}${level.free ? ' · ⚡free' : ''}`;
    $('hardtag').classList.toggle('hide', !level.hard);
  }
}
function bumpChip(id) { const c = $(id); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
let toastT = 0;
function toast(t, kind) { const el = $('toast'); el.textContent = t; el.style.fontSize = kind === 'small' ? '22px' : '30px'; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 1250); }
let quipT = 0;
function quip(who, text, ms = 2800) { const q = $('quip'); $('qimg').style.backgroundImage = `url(${thumb(who)})`; $('qnm').textContent = NAME_OF(who); $('qnm').style.color = FRIENDS[who]?.color || '#9b7bff'; $('qtx').textContent = text; q.classList.add('on'); snd.talk(); clearTimeout(quipT); quipT = setTimeout(() => q.classList.remove('on'), ms); }
function toScreen(p) { const v = p.clone().project(camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; }
function flyCoins(from, amount) {
  const to = $('coinchip').getBoundingClientRect(), n = Math.min(8, 2 + Math.floor(amount / 4));
  const f = document.createElement('div'); f.className = 'float'; f.style.left = from.x + 'px'; f.style.top = from.y + 'px'; f.textContent = `+${amount}`; document.body.appendChild(f); setTimeout(() => f.remove(), 1000);
  for (let i = 0; i < n; i++) {
    const d = document.createElement('div'); d.className = 'fly'; d.innerHTML = '<svg viewBox="0 0 24 24"><use href="#coin"/></svg>';
    const jx = (Math.random() - 0.5) * 50, jy = (Math.random() - 0.5) * 40;
    d.style.transform = `translate(${from.x + jx - 14}px,${from.y + jy - 14}px)`; document.body.appendChild(d);
    setTimeout(() => { d.style.transform = `translate(${to.left + 4}px,${to.top + 5}px) scale(.8)`; }, 30 + i * 60);
    setTimeout(() => { d.remove(); bumpChip('coinchip'); if (i % 2 === 0) snd.coin(); }, 760 + i * 60);
  }
  setTimeout(updateHud, 800);
}

// ------------------------------------------------------------ info bar / selection
const COIN_SVG = '<svg viewBox="0 0 24 24"><use href="#coin"/></svg>';
function selectEnt(e) {
  sel = e; const img = $('infoimg'), nm = $('infonm'), sub = $('infosub'), ch = $('infochain'), sb = $('sell');
  if (!e) { img.src = thumb(level && level.gens.includes('f10') ? 'g09' : 'g02'); nm.textContent = 'Drag two alike to merge'; sub.textContent = level && level.gens.length > 1 ? 'Tap a generator to make more' : 'Tap the Makeup Bag to make something'; ch.innerHTML = ''; sb.classList.add('hide'); return; }
  if (e.kind === 'gen') { img.src = thumb(e.id); nm.textContent = NAMES[e.id]; sub.textContent = `Tap: makes ${CHAIN_NAME[GENS[e.id].chain].toLowerCase()} · ${level.free ? 'free this level' : '1 ⚡ each'}`; ch.innerHTML = CH[GENS[e.id].chain].map(id => `<img src="${thumb(id)}" class="${S.seen.includes(id) ? 'on' : ''}">`).join(''); sb.classList.add('hide'); return; }
  if (e.kind === 'chest') { img.src = thumb('x01'); nm.textContent = 'Surprise Chest'; sub.textContent = 'Tap to open: coins and gifts'; ch.innerHTML = ''; sb.classList.add('hide'); return; }
  const I = INFO[e.id]; img.src = thumb(e.id); nm.textContent = NAMES[e.id];
  sub.textContent = e.locked ? 'Wrapped: merge next to it' : I.next ? `Tier ${I.tier} · next ${NAMES[I.next]}` : `Top of the ${CHAIN_NAME[I.chain]} chain!`;
  ch.innerHTML = CH[I.chain].map((id, i) => `<img src="${thumb(id)}" class="${i + 1 === I.tier ? 'cur' : S.seen.includes(id) || i + 1 < I.tier ? 'on' : ''}">`).join('');
  sb.classList.toggle('hide', e.locked); sb.innerHTML = `Sell ${COIN_SVG}${I.tier}`;
}
const tapBtn = (id, fn) => $(id).addEventListener('pointerdown', e => { e.stopPropagation(); snd.unlock(); fn(e); });
tapBtn('sell', () => { if (sel) sell(sel); });
tapBtn('bwand', () => useWand());
tapBtn('blucky', () => useLucky());
tapBtn('mute', () => { $('mute').textContent = snd.toggle() ? '🔇' : '🔊'; });
$('mute').textContent = snd.muted ? '🔇' : '🔊';
tapBtn('coinchip', () => MON.shop());
tapBtn('shopBtn', () => MON.shop());
tapBtn('energychip', () => energySheet());
tapBtn('albumBtn', () => openAlbum());
tapBtn('dailyBtn', () => { location.search = D.seed ? '' : '?daily=1'; });
tapBtn('tbtn', () => restoreNext());
tapBtn('play', () => { if (state === 'ready' && !storyOpen) startLevel(); });
startEl.addEventListener('pointerdown', e => e.stopPropagation());
const dbl = $('dbl');
dbl.addEventListener('pointerdown', e => e.stopPropagation());
dbl.addEventListener('click', async e => { e.stopPropagation(); if (dbl.disabled) return; dbl.disabled = true; if (await MON.rewarded('double', { what: `${winCoins * 2} coins instead of ${winCoins}` })) { MON.add(winCoins, 'double'); $('wcoins').textContent = winCoins * 2; dbl.innerHTML = '✓ Doubled!'; snd.coin(); flyCoins({ x: innerWidth / 2, y: innerHeight / 2 }, winCoins); } else dbl.disabled = false; });
$('grid').addEventListener('pointerdown', e => e.stopPropagation());
$('grid').addEventListener('click', e => { e.stopPropagation(); shareGrid(); });
let shareBtn = null;
setTimeout(() => { shareBtn = [...winEl.querySelectorAll('.hc-btn')].find(b => b.textContent === 'Share'); if (shareBtn) $('grid').parentElement.appendChild(shareBtn); }, 0);
winEl.addEventListener('pointerdown', e => { if (e.target.closest('button') || winEl.classList.contains('hide')) return; if (performance.now() - (+winEl.dataset.t || 0) < 600) return; toReady(); });
addEventListener('pointerdown', () => snd.unlock(), { once: true });

// ------------------------------------------------------------ input: drag to merge, tap to make/open/select
const ray = new THREE.Raycaster(), plane = new THREE.Plane(V3(0, 1, 0), -TOP), hit = V3();
function boardHit(x, y) {
  ray.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1), camera);
  if (!ray.ray.intersectPlane(plane, hit)) return null;
  const c = Math.round(hit.x + 3), r = Math.round(hit.z + 3);
  return { r, c, inside: r >= 0 && r < N && c >= 0 && c < N, p: hit.clone() };
}
const cvs = renderer.domElement;
cvs.addEventListener('pointerdown', e => {
  if (state !== 'play') return;
  const h = boardHit(e.clientX, e.clientY); if (!h || !h.inside) { selectEnt(null); return; }
  const en = grid[h.r][h.c];
  if (!en || en.fly) { selectEnt(null); return; }
  drag = { e: en, x: e.clientX, y: e.clientY, moved: false, t: performance.now(), id: e.pointerId };
  if (!en.locked) snd.pick();
});
addEventListener('pointermove', e => {
  if (!drag || state !== 'play') return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 9 && !drag.e.locked && drag.e.kind !== 'gen') { drag.moved = true; drag.e.dragging = true; selectEnt(drag.e); }
  if (drag.moved) { const h = boardHit(e.clientX, e.clientY); if (h) { drag.e.dragTo = V3(h.p.x, TOP + 0.6, h.p.z - 0.3); drag.over = h.inside ? [h.r, h.c] : null; } }
});
addEventListener('pointerup', e => {
  if (!drag) return; const d = drag; drag = null; d.e.dragging = false;
  if (state !== 'play') return;
  if (!d.moved) { tapEnt(d.e); return; }
  const over = d.over; d.e.dragTo = null;
  dropEnt(d.e, over ? over[0] : -1, over ? over[1] : -1, e.clientX, e.clientY);
});
function tapEnt(en) {
  if (en.kind === 'gen') { genTap(en); selectEnt(en); return; }
  if (en.kind === 'chest') { openChest(en); return; }
  selectEnt(en); en.pop = performance.now() / 1000;
}
function dropEnt(a, r, c, sx, sy) {
  if (r < 0 && sx != null) {
    for (const s of slots) { if (s.order == null) continue; const p = toScreen(V3(s.x, 1.3, SLOT_Z)); if (Math.abs(p.x - sx) < 60 && Math.abs(p.y - sy) < 120 && level.orders[s.order].items.includes(a.id) && canDeliver(level.orders[s.order])) { a.pos = cellPos(a.r, a.c); deliver(s.i); return; } }
  }
  const back = () => { a.fly = { a: a.pos.clone(), b: cellPos(a.r, a.c), t0: performance.now() / 1000, dur: 0.18, h: 0.1 }; snd.drop(); };
  if (r < 0 || (r === a.r && c === a.c)) return back();
  const b = grid[r][c];
  if (!b) { const from = a.pos.clone(); moveEnt(a, r, c); a.fly = { a: from, b: cellPos(r, c), t0: performance.now() / 1000, dur: 0.12, h: 0.05 }; snd.drop(); return; }
  if (b.fly) return back();
  if (b.id === a.id && a.kind === 'item' && INFO[a.id].next) { merge(a, b); return; }
  if (b.locked || b.kind === 'gen') { snd.nope(); return back(); }
  const ar = a.r, ac = a.c, from = a.pos.clone();
  grid[ar][ac] = b; b.r = ar; b.c = ac; grid[r][c] = a; a.r = r; a.c = c;
  a.fly = { a: from, b: cellPos(r, c), t0: performance.now() / 1000, dur: 0.12, h: 0.05 };
  b.fly = { a: b.pos.clone(), b: cellPos(ar, ac), t0: performance.now() / 1000, dur: 0.2, h: 0.3 };
  snd.drop();
}

// ------------------------------------------------------------ tutorial hand
const hint = { gen: S.level > 1, merge: S.level > 1 };
const hand = document.createElement('div'); hand.textContent = '👆'; hand.style.cssText = 'position:fixed;left:0;top:0;z-index:6;font-size:46px;pointer-events:none;display:none;filter:drop-shadow(0 3px 2px rgba(90,30,100,.3))';
document.body.appendChild(hand);
function updateHand(t) {
  if (state !== 'play' || (hint.gen && hint.merge) || !level || level.n > 1 || level.daily) { hand.style.display = 'none'; return; }
  let a = null, b = null;
  if (!hint.gen) { const g = ents.find(e => e.kind === 'gen'); if (g) a = toScreen(g.pos.clone().setY(TOP + 0.3)); }
  else { const pair = findPair(); if (pair) { a = toScreen(pair[0].pos); b = toScreen(pair[1].pos); } else { const g = ents.find(e => e.kind === 'gen'); if (g) a = toScreen(g.pos.clone().setY(TOP + 0.3)); } }
  if (!a) { hand.style.display = 'none'; return; }
  hand.style.display = 'block';
  const k = b ? (Math.sin(t * 2.4) * 0.5 + 0.5) : 0, x = b ? a.x + (b.x - a.x) * k : a.x, y = b ? a.y + (b.y - a.y) * k : a.y + Math.sin(t * 7) * 6;
  hand.style.transform = `translate(${x - 14}px,${y - 4}px)`;
}
function findPair(pred = () => true) {
  const by = {};
  for (const e of ents) if (e.kind === 'item' && !e.fly && !e.hidden && INFO[e.id].next && pred(e)) (by[e.id] = by[e.id] || []).push(e);
  for (const id in by) { const l = by[id], free = l.filter(e => !e.locked); if (free.length && l.length >= 2) return [free[0], l.find(e => e !== free[0])]; }
  return null;
}

// ------------------------------------------------------------ bot (real moves at a human pace: deliver, merge, open, sell, generate, decorate)
let botT = 0;
function bot() {
  const nowB = performance.now(); if (nowB - botT < 560) return; botT = nowB;
  if (storyOpen) { if (nowB - (+$('story').dataset.t || 0) > 500) { $('stch').classList.add('hide'); nextLine(); } return; }
  if (document.querySelector('.sheet')) { document.querySelector('.sheet').remove(); return; }
  if (state === 'ready') {
    if (pan && nowB < pan.until) return;
    const { room, task } = curRoom(), t = ROOMS[room].tasks[task];
    if (t && S.stars >= t.cost && !D.seed) { restoreNext(); return; }
    startLevel(); return;
  }
  if (state !== 'play') return;
  for (const s of slots) if (s.order != null && canDeliver(level.orders[s.order])) { deliver(s.i); return; }
  const pending = [...slots.filter(s => s.order != null).map(s => s.order), ...level.queue];
  const maxNeed = {}; for (const oi of pending) for (const id of level.orders[oi].items) { const I = INFO[id]; maxNeed[I.chain] = Math.max(maxNeed[I.chain] || 0, I.tier); }
  const wanted = e => e.kind === 'item' && maxNeed[INFO[e.id].chain] && INFO[e.id].tier < maxNeed[INFO[e.id].chain];
  const pair = findPair(wanted);
  if (pair) { merge(pair[0], pair[1]); return; }
  const chest = ents.find(e => e.kind === 'chest' && !e.fly); if (chest) { openChest(chest); return; }
  const used = ents.filter(e => !e.fly && !e.hidden).length, full = used >= N * N - 2;
  const junk = ents.filter(e => e.kind === 'item' && !e.locked && !e.fly && (!maxNeed[INFO[e.id].chain] || INFO[e.id].tier > maxNeed[INFO[e.id].chain]));
  if (junk.length && (full || junk.length > 3)) { sell(junk[0]); return; }
  const need = needByChain(), order = level.gens.slice().sort((a, b) => need[GENS[b].chain] - need[GENS[a].chain]);
  for (const id of order) { const g = ents.find(e => e.id === id); if (g && need[GENS[id].chain] > 0) { if (genTap(g)) return; else return; } }
  const anyPair = findPair(); if (anyPair && full) { merge(anyPair[0], anyPair[1]); return; }
  if (full) { const it = ents.find(e => e.kind === 'item' && !e.locked && !e.fly); if (it) sell(it); }
}
renderer.info.autoReset = false;
const PERF = { calls: 0, tris: 0 };
window.__dbg = { PERF, renderer, camera, scene, MD, IM, W, S, MON, get ents() { return ents; }, get level() { return level; }, startLevel, restoreNext, openAlbum, energySheet, checkStory };
window.__game = { get state() { return state; }, get level() { return S.level; }, get score() { return S.total; }, bot,
  get info() { return { taps, par: level?.par, delivered, orders: level?.orders.length, stars: S.stars, restored: S.restored, energy: S.energy, coins: MON.coins(), ents: ents.length }; } };

// ------------------------------------------------------------ camera poses
const tmpCam = new THREE.PerspectiveCamera();
const corners = [[-3.9, 3.9], [3.9, 3.9], [-3.9, -3.9], [3.9, -3.9]].map(([x, z]) => V3(x, TOP, z));
function project(cam, p) { const v = p.clone().project(cam); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; }
function poseBoard() {
  const w = innerWidth, h = innerHeight, asp = w / h, portrait = asp < 0.8;
  const fov = portrait ? 44 : 34, pitch = portrait ? 0.9 : 0.8, tgt = V3(0, TOP, 0.2), dir = V3(0, Math.sin(pitch), Math.cos(pitch));
  tmpCam.fov = fov; tmpCam.aspect = asp; tmpCam.clearViewOffset(); tmpCam.updateProjectionMatrix();
  const bottomPad = portrait ? 92 : 96, topLimit = portrait ? Math.max(270, h * 0.37) : h * 0.42;
  const measure = d => { tmpCam.position.copy(tgt).addScaledVector(dir, d); tmpCam.lookAt(tgt); tmpCam.updateMatrixWorld(); const ps = corners.map(c => project(tmpCam, c));
    return { minX: Math.min(...ps.map(p => p.x)), maxX: Math.max(...ps.map(p => p.x)), yN: Math.max(...ps.map(p => p.y)), yF: Math.min(...ps.map(p => p.y)) }; };
  let lo = 4, hi = 80;
  for (let i = 0; i < 28; i++) { const d = (lo + hi) / 2, m = measure(d); if (m.minX >= 2 && m.maxX <= w - 2 && m.yN - m.yF <= h - bottomPad - topLimit) hi = d; else lo = d; }
  const m = measure(hi);
  return { pos: tgt.clone().addScaledVector(dir, hi), tgt, fov, off: -((h - bottomPad) - m.yN) };
}
function poseHome() {
  const portrait = innerWidth / innerHeight < 0.8;
  if (pan && performance.now() < pan.until) { const p = pan.p; return { pos: V3(p.x * 0.5, Math.max(4.5, p.y + 3.5), p.z + (portrait ? 11 : 9)), tgt: p.clone(), fov: portrait ? 50 : 40, off: innerHeight * (portrait ? 0.18 : 0.1) }; }
  return portrait ? { pos: V3(0, 5.6, 6.4), tgt: V3(0, 2.7, -7), fov: 64, off: innerHeight * 0.17 } : { pos: V3(1.8, 5.4, 6.5), tgt: V3(1.6, 2.6, -7), fov: 50, off: 0 };
}
let camGoal = 'home', camCur = null;
function updateCamera(dt) {
  const g = camGoal === 'board' ? poseBoard() : poseHome();
  if (!camCur) camCur = { pos: g.pos.clone(), tgt: g.tgt.clone(), fov: g.fov, off: g.off };
  const k = 1 - Math.exp(-dt * 3.2);
  camCur.pos.lerp(g.pos, k); camCur.tgt.lerp(g.tgt, k); camCur.fov += (g.fov - camCur.fov) * k; camCur.off += (g.off - camCur.off) * k;
  camera.position.copy(camCur.pos); camera.lookAt(camCur.tgt); camera.fov = camCur.fov; camera.aspect = innerWidth / innerHeight;
  camera.setViewOffset(innerWidth, innerHeight, 0, camCur.off, innerWidth, innerHeight); camera.updateProjectionMatrix();
}
function resize() { renderer.setSize(innerWidth, innerHeight, false); C.resize(innerWidth, innerHeight); spMat.uniforms.uScale.value = innerHeight; }
addEventListener('resize', resize);

// ------------------------------------------------------------ per-frame render of the board
const mtx = new THREE.Matrix4(), mq = new THREE.Quaternion(), mv = V3(), ms = V3(), meu = new THREE.Euler(), white = new THREE.Color(1, 1, 1), dimC = new THREE.Color(0.8, 0.72, 0.85), tmpC = new THREE.Color();
function drawBoard(now, dt) {
  for (const id of ITEM_IDS) IM[id].count = 0;
  shadowIM.count = 0; wrapIM.count = 0; hintIM.count = 0;
  const dragId = drag && drag.moved ? drag.e.id : null;
  if (W.tray.visible) {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) tiles.setColorAt(r * N + c, (r + c) % 2 ? TILE_B : TILE_A);
    if (drag && drag.moved && drag.over) { const [r, c] = drag.over, b = grid[r][c]; tiles.setColorAt(r * N + c, b && b !== drag.e && b.id === drag.e.id ? TILE_OK : TILE_HI); }
    tiles.instanceColor.needsUpdate = true;
  }
  const noEnergy = level && !level.free && S.energy < 1;
  for (const e of ents) {
    if (e.hidden) continue;
    if (e.fly) {
      const u = clamp((now - e.fly.t0) / e.fly.dur, 0, 1), ee = 1 - Math.pow(1 - u, 2);
      if (u > 0) { e.pos.lerpVectors(e.fly.a, e.fly.b, ee); e.pos.y += Math.sin(u * Math.PI) * e.fly.h; }
      if (u >= 1) { const f = e.fly; e.fly = null; if (f.onEnd) { f.onEnd(); continue; } e.pos.copy(f.b); e.pop = now; snd.land(); if (state === 'play') refreshOrders(); }
    } else if (e.dragging && e.dragTo) e.pos.lerp(e.dragTo, 1 - Math.exp(-dt * 30));
    else e.pos.lerp(cellPos(e.r, e.c), 1 - Math.exp(-dt * 20));
    const age = now - e.born, grow = e.fly && e.fly.shrink ? 1 - clamp((now - e.fly.t0) / e.fly.dur, 0, 1) * 0.85 : Math.min(1, age * 5);
    const pt = now - e.pop, sq = pt < 0.7 ? Math.sin(pt * 18) * Math.exp(-pt * 6) * 0.28 : 0;
    const lift = e.dragging ? 1.2 : 1;
    let base = e.kind === 'item' ? 0.93 + INFO[e.id].tier * 0.02 : e.kind === 'chest' ? 0.86 : 1.0;
    if (e.kind === 'gen') base *= 1 + (noEnergy ? 0 : Math.sin(now * 3 + e.phase) * 0.03);
    const sy = (1 + sq) * grow * lift * base, sxz = (1 - sq * 0.5) * grow * lift * base;
    const sway = e.kind === 'item' && !e.fly ? Math.sin(now * 1.6 + e.phase) * 0.07 : 0;
    const hop = e.kind === 'item' && !e.fly && !e.locked ? Math.max(0, Math.sin(now * 2.2 + e.phase * 3)) * 0.0 : 0;
    if (e.kind === 'gen') {
      const g = genMesh[e.id]; g.position.copy(e.pos); g.userData.m.scale.set(sxz * 0.95, sy * 0.95, sxz * 0.95); g.rotation.y = 0;
      g.userData.rim.material.opacity = noEnergy ? 0.25 : 0.55 + Math.sin(now * 4 + e.phase) * 0.35; g.userData.rim.scale.setScalar(1 + Math.sin(now * 4 + e.phase) * 0.04);
    } else {
      const im = IM[e.id], i = im.count++;
      mtx.compose(mv.copy(e.pos).setY(e.pos.y + hop), mq.setFromEuler(meu.set(0, sway + (e.kind === 'chest' ? -0.25 : 0), 0)), ms.set(sxz, sy, sxz));
      im.setMatrixAt(i, mtx);
      const fl = now - e.pop < 0.25 ? 1 + (0.25 - (now - e.pop)) * 1.6 : 1;
      im.setColorAt(i, e.locked ? dimC : fl > 1 ? tmpC.setScalar(fl) : white);
    }
    if (!(e.fly && e.fly.shrink) && e.kind !== 'gen') { const si = shadowIM.count++, hgt = Math.max(0, e.pos.y - TOP), s = 0.86 * Math.max(0.4, 1 - hgt * 0.5) * Math.min(1, grow + 0.3);
      mtx.compose(mv.set(e.pos.x, TOP + 0.004, e.pos.z), mq.identity(), ms.set(s, 1, s)); shadowIM.setMatrixAt(si, mtx); }
    if (e.locked) { const bi = wrapIM.count++, wob = 1 + Math.sin(now * 2.5 + e.phase) * 0.03; mtx.compose(mv.set(e.c - 3, TOP - 0.02, e.r - 3), mq.setFromEuler(meu.set(0, e.phase, 0)), ms.set(0.98 * wob, 0.96 / wob, 0.98 * wob)); wrapIM.setMatrixAt(bi, mtx); }
    if (dragId && e !== drag.e && e.id === dragId && !e.fly && INFO[e.id]?.next) { const hi = hintIM.count++; mtx.compose(mv.set(e.c - 3, TOP + 0.012, e.r - 3), mq.identity(), ms.setScalar(1 + Math.sin(now * 8) * 0.06)); hintIM.setMatrixAt(hi, mtx); }
  }
  for (const id of ITEM_IDS) { IM[id].instanceMatrix.needsUpdate = true; if (IM[id].instanceColor) IM[id].instanceColor.needsUpdate = true; }
  shadowIM.instanceMatrix.needsUpdate = wrapIM.instanceMatrix.needsUpdate = hintIM.instanceMatrix.needsUpdate = true;
  hintIM.material.opacity = 0.55 + Math.sin(now * 8) * 0.3;
  if (sel && !sel.hidden && state === 'play') { selRing.visible = true; selRing.position.set(sel.pos.x, TOP + 0.015, sel.pos.z); selRing.scale.setScalar(1 + Math.sin(now * 5) * 0.05); } else selRing.visible = false;
}

// ------------------------------------------------------------ main loop
let last = performance.now(), hudT = 0;
function frame(tms) {
  const dt = Math.min(0.05, (tms - last) / 1000); last = tms; const now = tms / 1000;
  drawBoard(now, dt);
  for (const f of Object.values(friends)) {
    if (!f.obj.visible) continue;
    f.mixer.update(dt);
    f.k = Math.min(1, f.k + dt * 4); let s = f.k < 1 ? 1 + Math.sin(f.k * Math.PI) * 0.12 : 1; s *= f.k < 0.5 ? Math.max(0.01, f.k * 2) : 1;
    f.obj.scale.setScalar(Math.max(0.01, s));
    if (f.out) { f.out += dt * 3; f.obj.scale.setScalar(Math.max(0.01, 1.2 - f.out)); if (f.out > 1.2) { f.obj.visible = false; f.out = 0; } }
    if (f.backT && now > f.backT) { f.backT = 0; play(f, 'idle', { fade: 0.4 }); }
    if (state === 'ready' && f.slot < 0 && !f.backT && Math.random() < dt * 0.06) play(f, Math.random() < 0.6 ? 'wave' : 'jump', { once: true });
  }
  for (const s of slots) { const p = toScreen(V3(s.x, HERO_H + 0.05, SLOT_Z)); s.el.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-100%)`; }
  hudT += dt; if (hudT > 0.25) { hudT = 0; updateHud(); }
  updateHand(now);
  updateFx(dt);
  W.update(dt, now);
  updateCamera(dt);
  renderer.info.reset(); C.render(dt); PERF.calls = renderer.info.render.calls; PERF.tris = renderer.info.render.triangles;
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------ boot
{ const { room, task } = curRoom(); W.setRoom(room, task); }
W.tray.visible = false;
updateHud(); renderStart(); startEl.classList.remove('hide');
resize();
requestAnimationFrame(t => { last = t; frame(t); });
setTimeout(() => { const l = $('loading'); l.style.opacity = 0; setTimeout(() => l.remove(), 500); checkStory(); }, 80);
