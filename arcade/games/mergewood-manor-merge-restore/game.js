// Mergewood Manor: Merge & Restore. A 7×7 3D merge board (flower, tea and cake chains), generators that recharge in
// seconds, orders from Hero Lab guests, and stars that restore the manor garden behind the board.
import * as THREE from './kit/three.module.min.js';
import { GLTFLoader } from './kit/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from './kit/addons/geometries/RoundedBoxGeometry.js';
import { cine } from './kit/cine.js';
import { store, rng, buzz } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { loadHero } from './kit/heroes.js';
import { buildWorld, radialTex } from './garden.js';
import { snd } from './audio.js';

const $ = s => document.getElementById(s);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const BASE = new URL('./', import.meta.url).href;

// ------------------------------------------------------------ catalogue
const CH = { flower: ['g01', 'g02', 'g03', 'g04', 'g05', 'g06'], tea: ['g07', 'g08', 'g09', 'g10', 'g11'], cake: ['g12', 'g13', 'g14', 'g15', 'g16'] };
const NAMES = { g01: 'Sprout', g02: 'Seedling', g03: 'Potted Daisy', g04: 'Tulip Pot', g05: 'Spring Bouquet', g06: 'Blossom Bonsai', g07: 'Tea Leaf', g08: 'Tea Bag',
  g09: 'Cup of Tea', g10: 'Floral Teapot', g11: 'Afternoon Tea Stand', g12: 'Flour Sack', g13: 'Cupcake', g14: 'Cake Slice', g15: 'Strawberry Cake', g16: 'Wedding Cake',
  g17: 'Seed Basket', oven: 'Brick Oven', g18: 'Treasure Chest' };
const INFO = {};
for (const [chain, ids] of Object.entries(CH)) ids.forEach((id, i) => INFO[id] = { chain, tier: i + 1, max: ids.length, next: ids[i + 1] || null });
const ITEM_IDS = [...CH.flower, ...CH.tea, ...CH.cake, 'g18'];
const GUESTS = [{ char: 'p05', name: 'Granny Gloss' }, { char: 'p08', name: 'Mr Mustard' }, { char: 'p07', name: 'Bijou' }, { char: 'p14', name: 'Cozy Milo' }, { char: 'c08', name: 'Bao' }];
const N = 7, TOP = 0.42, SLOT_X = [-2.45, 0, 2.45], SLOT_Z = -4.55, HERO_H = 2.25;
const cellPos = (r, c, y = TOP) => V3(c - 3, y, r - 3);
const thumb = id => `${BASE}assets/thumbs/${id}.webp`;

// ------------------------------------------------------------ save
const S0 = store('mergewood');
const S = { level: S0.get('level', 1), stars: S0.get('stars', 0), coins: S0.get('coins', 0), restored: S0.get('restored', 0), wand: S0.get('wand', 1), lucky: S0.get('lucky', 1),
  total: S0.get('total', 0), seen: S0.get('seen', []), best: S0.get('best', {}) };
{ const q = new URLSearchParams(location.search); if (q.has('restored') && /^(127\.0\.0\.1|localhost)$/.test(location.hostname)) { S.restored = +q.get('restored'); S.stars = +q.get('stars') || 0; } }
const save = () => { for (const k of ['level', 'stars', 'coins', 'restored', 'wand', 'lucky', 'total', 'seen', 'best']) S0.set(k, S[k]); };

// ------------------------------------------------------------ kit layers: daily, flow, world board
const startEl = $('start'), winEl = $('win');
const D = daily('mergewood', { els: { start: startEl.querySelector('.panel'), win: winEl.querySelector('.panel') }, pop: t => toast(t) }, { name: 'Mergewood Manor' });
const F = flow('mergewood');
const B = board({ game: 'mergewood', label: 'Stars earned', mode: 'sum', limits: { maxRun: 3, maxPerSec: 1 }, corner: 'tl' });

// ------------------------------------------------------------ renderer + scene
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.domElement.id = 'c'; document.body.prepend(renderer.domElement);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight, false);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(44, innerWidth / innerHeight, 0.3, 160);
const C = cine(renderer, scene, camera, { exposure: 1.0, bloom: 0.25, bloomThreshold: 2.2, bloomRadius: 0.4, envIntensity: 0.55,
  grade: { sat: 1.22, contrast: 1.08, vignette: 0.1, grain: 0, tint: '#fffaf3' } });
if (C.lite) C.bloom.enabled = false;

// ------------------------------------------------------------ load models
const M = {};
const loader = new GLTFLoader();
async function loadModel(id) {
  const g = await loader.loadAsync(`${BASE}assets/${id}.glb`);
  let mesh = null; g.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
  g.scene.updateMatrixWorld(true);
  mesh.material.envMapIntensity = 0.8;
  // the cozy GLBs come out of tools/optprops.mjs with their height along −Z: stand them up
  const mm = new THREE.Matrix4().makeRotationX(Math.PI / 2).multiply(mesh.matrixWorld); mesh.geometry.computeBoundingBox();
  const bb = mesh.geometry.boundingBox.clone().applyMatrix4(mm), sz = bb.getSize(V3()), k = 1 / Math.max(sz.x, sz.y, sz.z);
  const fix = new THREE.Matrix4().makeScale(k, k, k).multiply(new THREE.Matrix4().makeTranslation(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2));
  M[id] = { geo: mesh.geometry, mat: mesh.material, mm: fix.multiply(mm), size: sz.multiplyScalar(k) };
}
await Promise.all([...ITEM_IDS, 'g17', 'h22', 'h23', 'h24', 'h25', 'h26', 'h27', 'h28', 'h34', 'h35'].map(loadModel));
const W = buildWorld(scene, M, renderer);

// ------------------------------------------------------------ board visuals
const tileGeo = new RoundedBoxGeometry(0.93, 0.1, 0.93, 1, 0.04);
const tiles = new THREE.InstancedMesh(tileGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.55 }), N * N);
const TILE_A = new THREE.Color('#fff3da'), TILE_B = new THREE.Color('#e5f0c8'), TILE_HI = new THREE.Color('#ffe08a'), TILE_OK = new THREE.Color('#b7f09a');
{ const m = new THREE.Matrix4(); for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { m.makeTranslation(c - 3, TOP - 0.05, r - 3); tiles.setMatrixAt(r * N + c, m); tiles.setColorAt(r * N + c, (r + c) % 2 ? TILE_B : TILE_A); } }
tiles.receiveShadow = true; scene.add(tiles);
const IM = {};
const CAP = 60;
for (const id of ITEM_IDS) {
  const im = new THREE.InstancedMesh(M[id].geo, M[id].mat, CAP); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false; im.count = 0;
  for (let i = 0; i < CAP; i++) im.setColorAt(i, new THREE.Color(1, 1, 1));
  scene.add(im); IM[id] = im;
}
const shadowIM = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: radialTex('rgba(60,30,0,.42)'), transparent: true, depthWrite: false, toneMapped: false }), CAP + 4);
shadowIM.count = 0; shadowIM.frustumCulled = false; shadowIM.renderOrder = 1; scene.add(shadowIM);
// brambles: leafy thorny cage around locked items
const brambleGeo = (() => {
  const parts = [], R = rng(7);
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, g = new THREE.IcosahedronGeometry(0.13 + R() * 0.07, 1); g.translate(Math.cos(a) * 0.38, 0.08 + R() * 0.35, Math.sin(a) * 0.38); parts.push(g.toNonIndexed()); }
  for (let k = 0; k < 2; k++) { const t = new THREE.TorusGeometry(0.4, 0.03, 5, 22); t.rotateX(Math.PI / 2 + (k ? 0.25 : -0.2)); t.translate(0, 0.18 + k * 0.2, 0); parts.push(t.toNonIndexed()); }
  for (let i = 0; i < 10; i++) { const a = R() * 6.3, c = new THREE.ConeGeometry(0.025, 0.12, 4); c.rotateZ(Math.PI / 2); c.rotateY(-a); c.translate(Math.cos(a) * 0.44, 0.12 + R() * 0.3, Math.sin(a) * 0.44); parts.push(c.toNonIndexed()); }
  return (function merge(list) { let n = 0; for (const g of list) n += g.attributes.position.count; const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
    for (const g of list) { g.computeVertexNormals(); pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; }
    const b = new THREE.BufferGeometry(); b.setAttribute('position', new THREE.BufferAttribute(pos, 3)); b.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); return b; })(parts);
})();
const brambleIM = new THREE.InstancedMesh(brambleGeo, new THREE.MeshStandardMaterial({ color: '#4f7f35', roughness: 0.8, flatShading: true }), N * N);
brambleIM.count = 0; brambleIM.frustumCulled = false; brambleIM.castShadow = true; scene.add(brambleIM);
const ringMat = new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false });
const selRing = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.47, 40).rotateX(-Math.PI / 2), ringMat); selRing.visible = false; selRing.renderOrder = 2; scene.add(selRing);
const hintIM = new THREE.InstancedMesh(new THREE.RingGeometry(0.38, 0.45, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#9dff7a', transparent: true, opacity: 0.8, toneMapped: false, depthWrite: false }), N * N);
hintIM.count = 0; hintIM.frustumCulled = false; hintIM.renderOrder = 2; scene.add(hintIM);
const flashRings = Array.from({ length: 5 }, () => { const m = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#fff2a8', transparent: true, opacity: 0, toneMapped: false, depthWrite: false })); m.visible = false; m.renderOrder = 3; scene.add(m); return { m, t: 9 }; });
let flashI = 0;
function ringFlash(p, color = '#fff2a8') { const f = flashRings[flashI++ % flashRings.length]; f.m.position.set(p.x, TOP + 0.03, p.z); f.m.material.color.set(color); f.t = 0; f.m.visible = true; }

// ------------------------------------------------------------ generator models (code-built oven + the basket GLB)
function brickTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#e8d2b8'; x.fillRect(0, 0, 128, 128);
  for (let r = 0; r < 8; r++) for (let k = 0; k < 5; k++) { const o = (r % 2) * 13; x.fillStyle = `hsl(${12 + Math.random() * 10},${48 + Math.random() * 12}%,${50 + Math.random() * 10}%)`; x.beginPath(); x.roundRect ? x.roundRect(k * 26 - o + 1.5, r * 16 + 1.5, 23, 13, 3) : x.rect(k * 26 - o + 1.5, r * 16 + 1.5, 23, 13); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function makeOven() {
  const g = new THREE.Group(), bt = brickTex(), brick = new THREE.MeshStandardMaterial({ map: bt, roughness: 0.8 });
  const base = new THREE.Mesh(new RoundedBoxGeometry(0.86, 0.24, 0.78, 2, 0.06), new THREE.MeshStandardMaterial({ color: '#cdb59a', roughness: 0.9 })); base.position.y = 0.12;
  const domeGeo = new THREE.SphereGeometry(0.4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2); const dome = new THREE.Mesh(domeGeo, brick); dome.position.y = 0.24; dome.scale.set(1, 1.15, 1);
  bt.repeat.set(3, 1.5);
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24, 0, Math.PI), new THREE.MeshStandardMaterial({ color: '#3a1a0a', emissive: '#ff7a1a', emissiveIntensity: 1.6 })); mouth.position.set(0, 0.25, 0.375);
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 8, 20, Math.PI), new THREE.MeshStandardMaterial({ color: '#d9c3a6', roughness: 0.7 })); arch.position.set(0, 0.25, 0.37);
  const chim = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.3, 10), new THREE.MeshStandardMaterial({ color: '#a46a4c' })); chim.position.set(0.12, 0.66, -0.12);
  const loaf = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.14, 4, 10), new THREE.MeshStandardMaterial({ color: '#e6a85c', roughness: 0.6 })); loaf.rotation.z = Math.PI / 2; loaf.position.set(-0.18, 0.28, 0.42);
  for (const m of [base, dome, chim]) { m.castShadow = true; m.receiveShadow = true; }
  g.add(base, dome, mouth, arch, chim, loaf); g.userData.glow = mouth.material; return g;
}
function makeBasket() { const g = new THREE.Group(), m = new THREE.Mesh(M.g17.geo, M.g17.mat); m.matrixAutoUpdate = false; m.matrix.copy(M.g17.mm); m.castShadow = true; g.add(m); g.scale.setScalar(0.92); return g; }
const genMesh = { g17: makeBasket(), oven: makeOven() };
for (const g of Object.values(genMesh)) { g.visible = false; scene.add(g); }
// generator charge badges
const genBadge = {};
for (const id of ['g17', 'oven']) { const d = document.createElement('div'); d.className = 'gbadge'; d.style.cssText = 'position:fixed;left:0;top:0;z-index:4;pointer-events:none;transform:translate(-50%,-50%);min-width:30px;height:22px;padding:0 6px;border-radius:11px;background:#fff;box-shadow:0 2px 0 #d9b98c;font:700 13px Fredoka,sans-serif;color:#5b3a2e;display:none;align-items:center;justify-content:center;gap:2px;white-space:nowrap'; document.body.appendChild(d); genBadge[id] = d; }

// ------------------------------------------------------------ particles: sparkles (points) + confetti (instanced)
const SPN = 400;
const spGeo = new THREE.BufferGeometry();
const spPos = new Float32Array(SPN * 3), spCol = new Float32Array(SPN * 3), spSize = new Float32Array(SPN), spVel = new Float32Array(SPN * 3), spLife = new Float32Array(SPN), spMax = new Float32Array(SPN);
spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3)); spGeo.setAttribute('aCol', new THREE.BufferAttribute(spCol, 3)); spGeo.setAttribute('size', new THREE.BufferAttribute(spSize, 1));
const starTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#fff'; x.beginPath(); x.moveTo(32, 2); x.quadraticCurveTo(34, 30, 62, 32); x.quadraticCurveTo(34, 34, 32, 62); x.quadraticCurveTo(30, 34, 2, 32); x.quadraticCurveTo(30, 30, 32, 2); x.fill(); return new THREE.CanvasTexture(c); })();
const spMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { map: { value: starTex }, uScale: { value: innerHeight } },
  vertexShader: 'uniform float uScale; attribute float size; attribute vec3 aCol; varying vec3 vC; varying float vA; void main(){ vC = aCol; vA = clamp(size, 0., 1.); vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = size * 0.32 * uScale / -mv.z; gl_Position = projectionMatrix * mv; }',
  fragmentShader: 'uniform sampler2D map; varying vec3 vC; varying float vA; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC * 1.6, t.a * vA); }' });
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
const CONF = 220, confIM = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.12, 0.2), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.5 }), CONF);
confIM.frustumCulled = false; confIM.count = CONF; scene.add(confIM);
const conf = Array.from({ length: CONF }, () => ({ p: V3(0, -50, 0), v: V3(), r: V3(), w: V3(), life: 0 }));
let confI = 0;
const CONF_COL = ['#ff6f9c', '#ffd23f', '#6cc551', '#5aa9e6', '#b27cff', '#ffffff', '#ff9e5e'];
function confetti(p, n = 70, spread = 3, colors = CONF_COL) {
  for (let k = 0; k < n; k++) { const c = conf[confI % CONF]; confIM.setColorAt(confI % CONF, new THREE.Color(colors[k % colors.length])); confI++;
    c.p.copy(p); const a = Math.random() * 6.28; c.v.set(Math.cos(a) * spread * Math.random(), 4 + Math.random() * 4, Math.sin(a) * spread * Math.random()); c.r.set(Math.random() * 6, Math.random() * 6, 0); c.w.set(Math.random() * 10 - 5, Math.random() * 10 - 5, 0); c.life = 2.2 + Math.random(); }
  confIM.instanceColor.needsUpdate = true;
}
function updateFx(dt) {
  for (let i = 0; i < SPN; i++) { if (spLife[i] <= 0) { spSize[i] = 0; continue; } spLife[i] -= dt; spVel[i * 3 + 1] -= 3.2 * dt; for (let k = 0; k < 3; k++) spPos[i * 3 + k] += spVel[i * 3 + k] * dt; spSize[i] = Math.max(0, spLife[i] / spMax[i]) * (spSize[i] > 0 ? 1 : 0) * (0.6 + 0.4 * Math.sin(spLife[i] * 30)) + 0.0001; }
  spGeo.attributes.position.needsUpdate = spGeo.attributes.size.needsUpdate = spGeo.attributes.aCol.needsUpdate = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = V3(1, 1, 1), zero = V3(0, 0, 0);
  conf.forEach((c, i) => { if (c.life <= 0) { m.compose(c.p, q, zero); confIM.setMatrixAt(i, m); return; } c.life -= dt; c.v.y -= 7 * dt; c.v.multiplyScalar(1 - 1.6 * dt); if (c.v.y < -1.6) c.v.y = -1.6; c.p.addScaledVector(c.v, dt); c.r.addScaledVector(c.w, dt);
    m.compose(c.p, q.setFromEuler(e.set(c.r.x, c.r.y, c.r.z)), c.life < 0.4 ? one.clone().multiplyScalar(c.life / 0.4) : one); confIM.setMatrixAt(i, m); });
  confIM.instanceMatrix.needsUpdate = true;
  for (const f of flashRings) { if (f.t > 0.5) { f.m.visible = false; continue; } f.t += dt; const k = f.t / 0.5; f.m.scale.setScalar(0.8 + k * 1.6); f.m.material.opacity = (1 - k) * 0.95; }
}

// ------------------------------------------------------------ guests (Hero Lab characters)
const HERO_ASSETS = `${BASE}assets/hero/`;
const heroes = [];   // { h, guest, slot }
const slots = SLOT_X.map((x, i) => ({ i, x, order: null, hero: null, el: null, swap: 0 }));
for (const s of slots) {
  const el = document.createElement('div'); el.className = 'bub gone';
  el.innerHTML = '<div class="box"></div><button class="give">Give</button><div class="who"></div>';
  el.querySelector('.give').addEventListener('pointerdown', e => { e.stopPropagation(); deliver(s.i); });
  el.querySelector('.box').addEventListener('pointerdown', e => { e.stopPropagation(); if (s.order != null && canDeliver(level.orders[s.order])) deliver(s.i); else { snd.pick(); } });
  $('bubbles').appendChild(el); s.el = el;
}
let heroesReady = false;
(async () => {
  const list = await Promise.all(GUESTS.map(g => loadHero(THREE, GLTFLoader, { hero: { char: g.char, items: {} }, assets: HERO_ASSETS, height: HERO_H, shadows: true }).catch(() => null)));
  list.forEach((h, i) => { if (!h) return; h.object.visible = false; scene.add(h.object); heroes.push({ h, guest: GUESTS[i], slot: -1, k: 0 }); });
  heroesReady = true; seatGuests();
})();
function seatGuests() {
  if (!heroesReady || !level) return;
  const R = rng(level.seed + 3), free = heroes.slice().sort(() => R() - 0.5);
  for (const hh of heroes) { hh.slot = -1; hh.h.object.visible = false; }
  slots.forEach((s, i) => { const hh = free[i]; if (!hh) return; s.hero = hh; hh.slot = i; placeHero(hh, s); hh.k = 0; hh.h.object.visible = s.order != null; });
}
function cheer(hh) { hh.h.play('cheer'); const c = hh.h.actions.cheer; hh.backT = performance.now() / 1000 + (c ? c.getClip().duration - 0.25 : 1.2); }
function placeHero(hh, s) { hh.h.object.position.set(s.x, 0.07, SLOT_Z); hh.h.object.rotation.y = -s.x * 0.09; hh.h.play('idle'); }

// ------------------------------------------------------------ game state
let state = 'ready', level = null, grid = [], ents = [], sel = null, drag = null, taps = 0, delivered = 0, t0 = 0, lucky = 0, nextChest = 0, merges = 0, hintDone = S.level > 2;
const gens = {};
const GEN = { g17: { max: 12, regen: 0.55, chains: ['flower', 'tea'] }, oven: { max: 10, regen: 0.6, chains: ['cake'] } };

function makeLevel(n, seed) {
  const R = rng(seed), fk = F.k();
  const cap = n <= 1 ? 2 : n <= 3 ? 3 : n <= 6 ? 4 : n <= 11 ? 5 : 6;
  const chains = n >= 3 ? ['flower', 'tea', 'cake'] : ['flower', 'tea'];
  const count = clamp(Math.round((n <= 1 ? 3 : n <= 3 ? 4 : n <= 6 ? 5 : n <= 10 ? 6 : n <= 20 ? 7 : 8) * fk), 3, 9);
  const pickTier = (chain, maxT = cap) => { const mx = Math.min(maxT, CH[chain].length), mn = Math.max(2, mx - 2); return mn + Math.floor(Math.pow(R(), 0.75) * (mx - mn + 1)); };
  const orders = [];
  for (let i = 0; i < count; i++) {
    const ch = n === 3 && i < 2 ? 'cake' : chains[(R() * chains.length) | 0];
    const items = [CH[ch][pickTier(ch) - 1]];
    if (n >= 5 && R() < 0.3) { const ch2 = chains[(R() * chains.length) | 0]; items.push(CH[ch2][pickTier(ch2, cap - 1) - 1]); }
    orders.push({ items, coins: 3 + items.reduce((a, id) => a + 2 * Math.pow(2, INFO[id].tier - 1), 0) });
  }
  const base = orders.reduce((a, o) => a + o.items.reduce((b, id) => b + Math.pow(2, INFO[id].tier - 1), 0), 0);
  const par = Math.ceil(base * 1.2 + 2 + count);
  const nb = n >= 4 ? Math.min(3 + Math.floor((n - 4) / 2), 14) : 0;
  const brambles = [], pre = [], used = new Set(['6,1', '6,5']);
  const freeCell = rows => { for (let k = 0; k < 200; k++) { const r = rows[(R() * rows.length) | 0], c = (R() * N) | 0; if (!used.has(r + ',' + c)) { used.add(r + ',' + c); return [r, c]; } } return null; };
  for (let i = 0; i < nb; i++) { const cell = freeCell(i < 7 ? [0, 1] : [0, 1, 2]); if (!cell) break; const ch = chains[(R() * chains.length) | 0]; brambles.push([...cell, CH[ch][Math.min(CH[ch].length, 1 + ((R() * 3) | 0)) - 1]]); }
  const npre = n <= 1 ? 2 : 3 + Math.min(3, n >> 2);
  for (let i = 0; i < npre; i++) { const cell = freeCell([3, 4, 5]); if (!cell) break; const ch = chains[(R() * chains.length) | 0]; pre.push([...cell, CH[ch][R() < 0.25 ? 1 : 0]]); }
  return { n, seed, orders, par, par2: Math.ceil(par * 1.45), gens: n >= 3 ? ['g17', 'oven'] : ['g17'], brambles, pre };
}

function ent(id, r, c, o = {}) {
  const e = { id, r, c, kind: id === 'g17' || id === 'oven' ? 'gen' : id === 'g18' ? 'chest' : 'item', locked: false, pos: cellPos(r, c), born: performance.now() / 1000, pop: 0, fly: null, hidden: false, phase: Math.random() * 6, ...o };
  grid[r][c] = e; ents.push(e); return e;
}
function startLevel() {
  const daily_ = !!D.seed;
  const n = daily_ ? 8 : S.level;
  level = makeLevel(n, daily_ ? D.seed : n * 7919 + 13);
  level.daily = daily_;
  grid = Array.from({ length: N }, () => Array(N).fill(null)); ents = []; sel = null; drag = null; taps = 0; delivered = 0; lucky = 0; merges = 0;
  level.rg = rng(level.seed + 99); level.rc = rng(level.seed + 7);
  for (const g of Object.values(genMesh)) g.visible = false;
  for (const id of level.gens) { const [r, c] = id === 'g17' ? [6, 1] : [6, 5]; ent(id, r, c); gens[id] = { charge: GEN[id].max, t: 0 }; genMesh[id].visible = true; }
  for (const [r, c, id] of level.brambles) ent(id, r, c, { locked: true });
  for (const [r, c, id] of level.pre) ent(id, r, c);
  level.queue = level.orders.map((_, i) => i);
  slots.forEach(s => { s.order = null; s.el.classList.add('gone'); });
  slots.forEach((s, i) => { if (level.queue.length) setTimeout(() => assignOrder(s), 300 + i * 220); });
  seatGuests();
  state = "play"; t0 = performance.now(); if (/[?&]dbg/.test(location.search)) console.log("DBG start", level.n, Math.round(t0));
  startEl.classList.add('hide'); $('bar').classList.remove('hide'); $('meter').classList.remove('hide');
  camGoal = 'board'; selectEnt(null); updateHud();
  if (level.n === 3 && !level.daily) setTimeout(() => toast('New: Brick Oven! 🎂'), 900);
  else if (level.n === 4 && !level.daily) setTimeout(() => toast('Merge next to brambles to clear them'), 900);
  B.start();
}
function assignOrder(s) {
  if (state !== 'play' || !level.queue.length) return;
  s.order = level.queue.shift();
  const o = level.orders[s.order], box = s.el.querySelector('.box');
  box.innerHTML = o.items.map(id => `<div class="it" data-id="${id}"><img src="${thumb(id)}" alt="${NAMES[id]}"><div class="ok">✓</div></div>`).join('');
  s.el.classList.remove('gone', 'ready');
  if (s.hero) { s.hero.h.object.visible = true; s.hero.k = 0; s.hero.h.play('idle'); }
  refreshOrders(); updateHud();
}
const unlockedOf = id => ents.filter(e => e.id === id && !e.locked && !e.fly && !e.hidden && e.kind !== 'gen');
function canDeliver(o) {
  const need = {}; for (const id of o.items) need[id] = (need[id] || 0) + 1;
  return Object.entries(need).every(([id, k]) => unlockedOf(id).length >= k);
}
function refreshOrders() {
  for (const s of slots) {
    if (s.order == null) continue; const o = level.orders[s.order];
    const counts = {};
    s.el.querySelectorAll('.it').forEach(d => { const id = d.dataset.id; counts[id] = (counts[id] || 0) + 1; d.classList.toggle('have', unlockedOf(id).length >= counts[id]); });
    s.el.classList.toggle('ready', canDeliver(o));
    s.el.querySelector('.who').textContent = s.hero ? s.hero.guest.name : '';
  }
}

// ------------------------------------------------------------ actions
function emptyNear(r0, c0) {
  let best = null, bd = 1e9;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!grid[r][c]) { const d = Math.abs(r - r0) + Math.abs(c - c0) + (r < r0 ? 0.01 : 0) + Math.random() * 0.001; if (d < bd) { bd = d; best = [r, c]; } }
  return best;
}
function genTap(g) {
  const G = gens[g.id], cfg = GEN[g.id];
  if (G.charge < 1) { snd.nope(); g.pop = performance.now() / 1000; toast('Recharging…', 'small'); return false; }
  const cell = emptyNear(g.r, g.c);
  if (!cell) { snd.nope(); g.pop = performance.now() / 1000; toast('Board full! Merge or sell', 'small'); return false; }
  G.charge -= 1; taps++;
  let chain = cfg.chains[0];
  if (cfg.chains.length > 1) { const need = needByChain(); const a = need.flower + 1, b = need.tea + 1; chain = level.rg() < a / (a + b) ? 'flower' : 'tea'; }
  const tier = lucky > 0 ? 2 : level.rg() < 0.07 ? 2 : 1; if (lucky > 0) lucky--;
  const id = CH[chain][tier - 1];
  const e = ent(id, cell[0], cell[1]);
  e.pos = g.pos.clone(); e.fly = { a: g.pos.clone().setY(TOP + 0.3), b: cellPos(cell[0], cell[1]), t0: performance.now() / 1000, dur: 0.32, h: 0.9 };
  g.pop = performance.now() / 1000; snd.pop(); buzz(6);
  sparkle(g.pos.clone().setY(TOP + 0.6), '#fff7c0', 6, 1.2, 1.5, 0.7);
  if (state === 'play') { updateHud(); refreshOrders(); }
  hint.gen = true;
  return true;
}
function needByChain() {
  const need = { flower: 0, tea: 0, cake: 0 };
  const pending = [...slots.filter(s => s.order != null).map(s => s.order), ...level.queue];
  for (const oi of pending) for (const id of level.orders[oi].items) need[INFO[id].chain] += Math.pow(2, INFO[id].tier - 1);
  for (const e of ents) if (e.kind === 'item' && !e.hidden) need[INFO[e.id].chain] -= Math.pow(2, INFO[e.id].tier - 1) * 0.5;
  for (const k in need) need[k] = Math.max(0, need[k]);
  return need;
}
function moveEnt(e, r, c) { grid[e.r][e.c] = grid[e.r][e.c] === e ? null : grid[e.r][e.c]; e.r = r; e.c = c; grid[r][c] = e; }
function killEnt(e) { if (grid[e.r][e.c] === e) grid[e.r][e.c] = null; e.hidden = true; ents = ents.filter(x => x !== e); if (sel === e) selectEnt(null); }
function merge(a, b) {
  const nx = INFO[a.id].next; if (!nx) return false;
  const p = cellPos(b.r, b.c), wasLocked = b.locked;
  killEnt(a); killEnt(b);
  const e = ent(nx, b.r, b.c); e.pop = performance.now() / 1000; e.grow = 1;
  merges++; hint.merge = true;
  const tier = INFO[nx].tier;
  snd.merge(tier); buzz(12); ringFlash(p, '#fff2a8');
  sparkle(p.clone().setY(TOP + 0.4), tier >= 4 ? '#ffd86b' : '#fff7d0', 10 + tier * 4, 1.8 + tier * 0.25, 2.2, 1 + tier * 0.15);
  if (tier >= 4) confetti(p.clone().setY(TOP + 0.5), 14 + tier * 6, 2);
  if (!S.seen.includes(nx)) { S.seen.push(nx); save(); if (tier >= 2) { toast(`New: ${NAMES[nx]}!`); if (tier >= 4) snd.big(); } }
  else if (tier >= 5) toast(NAMES[nx] + '!');
  // brambles next to a merge (or the merged-into cell) open up
  if (wasLocked) unlockFx(e);
  for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = grid[b.r + dr]?.[b.c + dc]; if (n && n.locked) { n.locked = false; unlockFx(n); } }
  selectEnt(e);
  if (state === 'play') { refreshOrders(); updateHud(); }
  return true;
}
function unlockFx(e) { const p = cellPos(e.r, e.c); confetti(p.clone().setY(TOP + 0.4), 16, 1.4, ['#5f9e3a', '#87c45a', '#3d7a2a', '#ff9ec4']); e.pop = performance.now() / 1000; snd.pick(); }
function deliver(si) {
  const s = slots[si]; if (state !== 'play' || s.order == null) return false;
  const o = level.orders[s.order]; if (!canDeliver(o)) { snd.nope(); return false; }
  const target = V3(s.x, 1.25, SLOT_Z + 0.2);
  for (const id of o.items) {
    const list = unlockedOf(id).sort((a, b) => (a === sel ? -1 : 0) - (b === sel ? -1 : 0)), e = list[0];
    grid[e.r][e.c] = null; if (sel === e) selectEnt(null);
    e.fly = { a: e.pos.clone(), b: target, t0: performance.now() / 1000, dur: 0.5, h: 1.6, shrink: true, onEnd: () => { e.hidden = true; ents = ents.filter(x => x !== e); } };
  }
  const coinsAt = toScreen(V3(s.x, HERO_H + 0.5, SLOT_Z));
  s.order = null; delivered++;
  setTimeout(() => { if (s.hero) cheer(s.hero); sparkle(V3(s.x, 1.4, SLOT_Z), '#ffe08a', 24, 2.4, 2.6, 1.3); confetti(V3(s.x, 1.8, SLOT_Z), 26, 2); snd.give(); flyCoins(coinsAt, o.coins); }, 480);
  s.el.classList.add('gone'); s.el.classList.remove('ready');
  S.coins += o.coins;
  // a treasure chest now and then
  if (level.rc() < 0.3 && delivered < level.orders.length) setTimeout(() => dropChest(s), 900);
  if (delivered >= level.orders.length) { state = 'won'; setTimeout(winLevel, 900); }
  else setTimeout(() => {
    if (state !== 'play') return;
    if (s.hero) swapGuest(s);
    setTimeout(() => assignOrder(s), 420);
  }, 1300);
  updateHud(); refreshOrders(); buzz([10, 30, 10]);
  return true;
}
function swapGuest(s) {
  const spare = heroes.filter(h => h.slot === -1); if (!spare.length || !s.hero) return;
  const old = s.hero, nu = spare[(Math.random() * spare.length) | 0];
  old.out = performance.now() / 1000; nu.slot = s.i;
  setTimeout(() => { old.h.object.visible = false; old.slot = -1; old.out = 0; nu.slot = s.i; s.hero = nu; placeHero(nu, s); nu.h.object.visible = true; nu.k = 0; refreshOrders(); }, 300);
}
function dropChest(s) {
  if (state !== 'play') return;
  const cell = emptyNear(3, 3); if (!cell) return;
  const e = ent('g18', cell[0], cell[1]);
  e.pos = V3(s.x, 1.4, SLOT_Z); e.fly = { a: V3(s.x, 1.4, SLOT_Z), b: cellPos(cell[0], cell[1]), t0: performance.now() / 1000, dur: 0.6, h: 2 };
  snd.chest();
}
function openChest(e) {
  const p = cellPos(e.r, e.c); killEnt(e);
  const coins = 8 + ((level.rc() * 12) | 0); S.coins += coins; flyCoins(toScreen(p), coins);
  snd.chest(); confetti(p.clone().setY(TOP + 0.5), 40, 2.4); sparkle(p.clone().setY(TOP + 0.5), '#ffd86b', 30, 2.6, 2.8, 1.4); buzz(15);
  const need = needByChain(), chains = Object.keys(need).filter(k => need[k] > 0 && (k !== 'cake' || gens.oven && level.gens.includes('oven')));
  for (let k = 0; k < 2; k++) {
    const cell = emptyNear(e.r, e.c); if (!cell) break; const ch = chains.length ? chains[(level.rc() * chains.length) | 0] : 'flower';
    const it = ent(CH[ch][1], cell[0], cell[1]); it.pos = p.clone(); it.fly = { a: p.clone().setY(TOP + 0.4), b: cellPos(cell[0], cell[1]), t0: performance.now() / 1000 + k * 0.1, dur: 0.4, h: 1 };
  }
  if (level.rc() < 0.4) { const b = level.rc() < 0.5 ? 'wand' : 'lucky'; S[b]++; toast(b === 'wand' ? '+1 ✨ Upgrade' : '+1 🍀 Lucky'); }
  save(); updateHud(); refreshOrders();
}
function sell(e) {
  if (!e || e.kind !== 'item' || e.locked) return;
  const v = INFO[e.id].tier, p = cellPos(e.r, e.c); killEnt(e); S.coins += v; flyCoins(toScreen(p), v); snd.coin();
  sparkle(p.clone().setY(TOP + 0.3), '#ffe28a', 8, 1.4, 1.6, 0.8); updateHud(); refreshOrders();
}
function useWand() {
  if (!sel || sel.kind !== 'item' || sel.locked || !INFO[sel.id].next) { toast('Pick an item to upgrade', 'small'); snd.nope(); return false; }
  if (S.wand > 0) S.wand--; else if (S.coins >= 60) S.coins -= 60; else { toast('Need 🪙60', 'small'); snd.nope(); return false; }
  const e = sel, r = e.r, c = e.c, nx = INFO[e.id].next; killEnt(e);
  const n = ent(nx, r, c); n.pop = performance.now() / 1000; n.grow = 1; snd.big(); sparkle(cellPos(r, c, TOP + 0.4), '#d6b6ff', 30, 2.2, 2.4, 1.3); ringFlash(n.pos, '#d6b6ff');
  if (!S.seen.includes(nx)) S.seen.push(nx);
  selectEnt(n); save(); updateHud(); refreshOrders(); return true;
}
function useLucky() {
  if (S.lucky > 0) S.lucky--; else if (S.coins >= 40) S.coins -= 40; else { toast('Need 🪙40', 'small'); snd.nope(); return false; }
  lucky += 5; for (const id in gens) gens[id].charge = GEN[id].max;
  for (const g of ents.filter(e => e.kind === 'gen')) { g.pop = performance.now() / 1000; sparkle(g.pos.clone().setY(TOP + 0.6), '#a8ffb0', 20, 1.8, 2.4, 1.1); }
  toast('🍀 Next 5 grow bigger!'); snd.big(); save(); updateHud(); return true;
}

// ------------------------------------------------------------ win + restore
function starsFor(t) { return t <= level.par ? 3 : t <= level.par2 ? 2 : 1; }
function winLevel() {
  const stars = starsFor(taps), ms = performance.now() - t0;
  F.level(true);
  S.stars += stars; S.total += stars;
  const key = level.daily ? 'daily' : String(level.n); S.best[key] = Math.max(S.best[key] || 0, stars);
  if (!level.daily) S.level++;
  save();
  B.submit(stars, { ms }); if (/[?&]dbg/.test(location.search)) console.log("DBG win", level.n, stars, Math.round(ms));
  D.won(stars, 'earned stars on a level of');
  for (const s of slots) if (s.hero && s.hero.h.object.visible) cheer(s.hero);
  confetti(V3(0, 2, -1), 120, 4); snd.win();
  $('wlevel').textContent = level.daily ? 'Daily Garden' : `Level ${level.n}`;
  $('wline').textContent = stars === 3 ? 'Perfect planning! Every seed counted.' : stars === 2 ? `Lovely! ${taps} seeds used (3★ at ${level.par})` : `Done! Use fewer seeds for more stars (3★ at ${level.par})`;
  $('wstars').textContent = stars; $('wcoins').textContent = level.orders.reduce((a, o) => a + o.coins, 0);
  const svgs = [...$('bigstars').children]; svgs.forEach(s => s.classList.remove('in', 'dim'));
  winEl.classList.remove('hide'); winEl.dataset.t = performance.now();
  svgs.forEach((s, i) => setTimeout(() => { s.classList.add('in'); if (i >= stars) s.classList.add('dim'); else snd.star(i); }, 250 + i * 260));
  $('bar').classList.add('hide'); $('meter').classList.add('hide'); selectEnt(null);
  for (const s of slots) { s.order = null; s.el.classList.add('gone'); }
  updateHud();
}
function toReady() {
  state = 'ready'; winEl.classList.add('hide');
  for (const s of slots) { s.order = null; s.el.classList.add('gone'); }
  camGoal = 'garden'; renderStart(); startEl.classList.remove('hide');
}
function renderStart() {
  const n = W.tasks.length, done = S.restored;
  $('slevel').textContent = D.seed ? 'Daily Garden' : `Level ${S.level}`;
  $('stitle').textContent = 'Mergewood Manor';
  $('gbar').style.width = (done / n * 100) + '%'; $('gtext').textContent = `Garden restored ${done}/${n}`;
  $('play').textContent = D.seed ? 'Play Daily' : `Play Level ${S.level}`;
  const t = W.tasks[done], tb = $('tbtn');
  if (!t) { $('timg').src = thumb('h24'); $('tname').textContent = 'The garden is restored!'; $('tsub').textContent = 'Keep merging for stars on the world board'; tb.classList.add('hide'); return; }
  tb.classList.remove('hide');
  $('timg').src = t.thumb.startsWith('g') || t.thumb.startsWith('h') ? thumb(t.thumb) : emojiImg(t.thumb);
  $('tname').textContent = t.name; $('tcost').textContent = t.cost;
  $('tsub').textContent = S.stars >= t.cost ? `Tap to restore · you have ⭐${S.stars}` : `Needs ⭐${t.cost} · win levels to earn stars`;
  tb.classList.toggle('off', S.stars < t.cost);
}
function emojiImg(e) { const c = document.createElement('canvas'); c.width = c.height = 96; const x = c.getContext('2d'); x.font = '64px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(e, 48, 54); return c.toDataURL(); }
let pan = null;
function restoreNext() {
  const t = W.tasks[S.restored]; if (!t || S.stars < t.cost || state !== 'ready') { if (t) { snd.nope(); toast(`Need ⭐${t.cost}`, 'small'); } return false; }
  S.stars -= t.cost; S.restored++; save();
  const p = W.restore(t.i); pan = { x: t.x, z: t.z, until: performance.now() + 2200 };
  snd.restore(); buzz([10, 40, 20]);
  setTimeout(() => { sparkle(p, '#fff1a0', 50, 3, 3.5, 2.2); confetti(p.clone().setY(2.5), 90, 3.5); }, 250);
  setTimeout(() => toast(`${t.name}!`), 300);
  renderStart(); updateHud();
  if (S.restored === W.tasks.length) setTimeout(() => { toast('Garden restored! 🌸'); confetti(V3(0, 4, -13), 200, 6); snd.win(); }, 1400);
  return true;
}

// ------------------------------------------------------------ HUD + toasts + coin flights
function updateHud() {
  const lv = level && state !== 'ready' ? (level.daily ? 0 : level.n) : (D.seed ? 0 : S.level); $('lvlchip').textContent = lv ? `Level ${lv}` : 'Daily';
  $('stars').textContent = S.stars; $('coins').textContent = S.coins;
  $('nwand').textContent = S.wand > 0 ? S.wand : '🪙60'; $('nrefill').textContent = S.lucky > 0 ? S.lucky : '🪙40';
  if (level && state === 'play') {
    $('ordn').textContent = `${delivered}/${level.orders.length}`;
    const st = starsFor(taps); [...$('mstars').children].forEach((s, i) => s.classList.toggle('off', i >= st));
    $('seeds').textContent = `🌱 ${taps}/${st === 3 ? level.par : st === 2 ? level.par2 : '∞'}`;
  }
  for (const id of ['g17', 'oven']) { const G = gens[id], on = level && state === 'play' && level.gens.includes(id); genBadge[id].style.display = on ? 'flex' : 'none'; if (on) genBadge[id].innerHTML = G.charge >= 1 ? `⚡${Math.floor(G.charge)}` : '⏳'; }
}
let toastT = 0;
function toast(t, kind) { const el = $('toast'); el.textContent = t; el.style.fontSize = kind === 'small' ? '22px' : '30px'; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 1150); }
function toScreen(p) { const v = p.clone().project(camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; }
function flyCoins(from, amount) {
  const to = $('coinchip').getBoundingClientRect(), n = Math.min(8, 2 + Math.floor(amount / 4));
  const f = document.createElement('div'); f.className = 'float'; f.style.left = from.x + 'px'; f.style.top = from.y + 'px'; f.textContent = `+${amount}`; document.body.appendChild(f); setTimeout(() => f.remove(), 1000);
  for (let i = 0; i < n; i++) {
    const d = document.createElement('div'); d.className = 'fly'; d.innerHTML = '<svg viewBox="0 0 24 24"><use href="#coin"/></svg>';
    const jx = (Math.random() - 0.5) * 50, jy = (Math.random() - 0.5) * 40;
    d.style.transform = `translate(${from.x + jx - 13}px,${from.y + jy - 13}px)`; document.body.appendChild(d);
    setTimeout(() => { d.style.transform = `translate(${to.left + 4}px,${to.top + 5}px) scale(.8)`; }, 30 + i * 60);
    setTimeout(() => { d.remove(); const c = $('coinchip'); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); if (i % 2 === 0) snd.coin(); }, 760 + i * 60);
  }
  setTimeout(updateHud, 800);
}

// ------------------------------------------------------------ info bar / selection
function selectEnt(e) {
  sel = e; const img = $('infoimg'), nm = $('infonm'), sub = $('infosub'), ch = $('infochain'), sb = $('sell');
  if (!e) { img.src = thumb(level && level.gens.includes('oven') ? 'g13' : 'g03'); nm.textContent = 'Drag two alike to merge'; sub.textContent = level && level.gens.includes('oven') ? 'Tap the basket or the oven to make more' : 'Tap the basket to grow something'; ch.innerHTML = ''; sb.classList.add('hide'); return; }
  if (e.kind === 'gen') { img.src = e.id === 'g17' ? thumb('g17') : thumb('g12'); nm.textContent = NAMES[e.id]; const G = gens[e.id]; sub.textContent = e.id === 'g17' ? `Tap: sprouts & tea leaves · ⚡${Math.floor(G.charge)}/${GEN.g17.max}` : `Tap: flour for cakes · ⚡${Math.floor(G.charge)}/${GEN.oven.max}`; ch.innerHTML = ''; sb.classList.add('hide'); return; }
  if (e.kind === 'chest') { img.src = thumb('g18'); nm.textContent = 'Treasure Chest'; sub.textContent = 'Tap to open: coins and gifts'; ch.innerHTML = ''; sb.classList.add('hide'); return; }
  const I = INFO[e.id]; img.src = thumb(e.id); nm.textContent = NAMES[e.id];
  sub.textContent = e.locked ? 'In brambles: merge next to it to free it' : I.next ? `Level ${I.tier} of ${I.max} · merge 2 → ${NAMES[I.next]}` : `Top of the ${I.chain} chain!`;
  ch.innerHTML = CH[I.chain].map((id, i) => `<img src="${thumb(id)}" class="${i + 1 === I.tier ? 'cur' : S.seen.includes(id) || i + 1 < I.tier ? 'on' : ''}">`).join('');
  sb.classList.toggle('hide', e.locked); sb.textContent = `Sell +${I.tier}`;
}
$('sell').addEventListener('pointerdown', e => { e.stopPropagation(); if (sel) sell(sel); });
$('bwand').addEventListener('pointerdown', e => { e.stopPropagation(); useWand(); });
$('brefill').addEventListener('pointerdown', e => { e.stopPropagation(); useLucky(); });
$('mute').addEventListener('pointerdown', e => { e.stopPropagation(); $('mute').textContent = snd.toggle() ? '🔇' : '🔊'; });
$('mute').textContent = snd.muted ? '🔇' : '🔊';
$('tbtn').addEventListener('pointerdown', e => { e.stopPropagation(); snd.unlock(); restoreNext(); });
startEl.addEventListener('pointerdown', e => { if (e.target.closest('.bd-trophy,.bd-wrap')) return; snd.unlock(); if (state === 'ready') startLevel(); });
winEl.addEventListener('pointerdown', e => { if (e.target.closest('button') || winEl.classList.contains('hide')) return; if (performance.now() - (+winEl.dataset.t || 0) < 450) return; toReady(); });
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
  if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 9 && !drag.e.locked) { drag.moved = true; drag.e.dragging = true; selectEnt(drag.e); }
  if (drag.moved) { const h = boardHit(e.clientX, e.clientY); if (h) { drag.e.dragTo = V3(h.p.x, TOP + 0.55, h.p.z - 0.3); drag.over = h.inside ? [h.r, h.c] : null; } }
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
  // dropped on a guest? deliver if that order is exactly ready
  if (r < 0 && sx != null) {
    for (const s of slots) { if (s.order == null) continue; const p = toScreen(V3(s.x, 1.2, SLOT_Z)); if (Math.abs(p.x - sx) < 60 && Math.abs(p.y - sy) < 110 && level.orders[s.order].items.includes(a.id) && canDeliver(level.orders[s.order])) { a.pos = cellPos(a.r, a.c); deliver(s.i); return; } }
  }
  const back = () => { a.fly = { a: a.pos.clone(), b: cellPos(a.r, a.c), t0: performance.now() / 1000, dur: 0.18, h: 0.1 }; snd.drop(); };
  if (r < 0 || (r === a.r && c === a.c)) return back();
  const b = grid[r][c];
  if (!b) { const from = a.pos.clone(); moveEnt(a, r, c); a.fly = { a: from, b: cellPos(r, c), t0: performance.now() / 1000, dur: 0.12, h: 0.05 }; snd.drop(); return; }
  if (b.fly) return back();
  if (b.id === a.id && a.kind === 'item' && INFO[a.id].next) { merge(a, b); return; }
  if (b.locked) { snd.nope(); return back(); }
  // swap
  const ar = a.r, ac = a.c, from = a.pos.clone();
  grid[ar][ac] = b; b.r = ar; b.c = ac; grid[r][c] = a; a.r = r; a.c = c;
  a.fly = { a: from, b: cellPos(r, c), t0: performance.now() / 1000, dur: 0.12, h: 0.05 };
  b.fly = { a: b.pos.clone(), b: cellPos(ar, ac), t0: performance.now() / 1000, dur: 0.2, h: 0.3 };
  snd.drop();
}

// ------------------------------------------------------------ tutorial hand
const hint = { gen: S.level > 1, merge: S.level > 1 };
const hand = document.createElement('div'); hand.textContent = '👆'; hand.style.cssText = 'position:fixed;left:0;top:0;z-index:6;font-size:44px;pointer-events:none;display:none;filter:drop-shadow(0 3px 2px rgba(0,0,0,.3));transition:transform .5s';
document.body.appendChild(hand);
function updateHand(t) {
  if (state !== 'play' || (hint.gen && hint.merge) || !level || level.n > 1 || level.daily) { hand.style.display = 'none'; return; }
  let a = null, b = null;
  if (!hint.gen) { const g = ents.find(e => e.kind === 'gen'); if (g) a = toScreen(g.pos.clone().setY(TOP + 0.3)); }
  else { const pair = findPair(); if (pair) { a = toScreen(pair[0].pos); b = toScreen(pair[1].pos); } else { const g = ents.find(e => e.kind === 'gen'); if (g) a = toScreen(g.pos.clone().setY(TOP + 0.3)); } }
  if (!a) { hand.style.display = 'none'; return; }
  hand.style.display = 'block'; hand.style.transition = 'none';
  const k = b ? (Math.sin(t * 2.4) * 0.5 + 0.5) : 0, x = b ? a.x + (b.x - a.x) * k : a.x, y = b ? a.y + (b.y - a.y) * k : a.y + Math.sin(t * 7) * 6;
  hand.style.transform = `translate(${x - 14}px,${y - 4}px)`;
}
function findPair(pred = () => true) {
  const by = {};
  for (const e of ents) if (e.kind === 'item' && !e.fly && !e.hidden && INFO[e.id].next && pred(e)) (by[e.id] = by[e.id] || []).push(e);
  for (const id in by) { const l = by[id], free = l.filter(e => !e.locked); if (free.length && l.length >= 2) return [free[0], l.find(e => e !== free[0])]; }
  return null;
}

// ------------------------------------------------------------ bot (real moves: deliver, merge, open, sell, tap generators, restore)
let botT = 0;
function bot() {
  const nowB = performance.now(); if (nowB - botT < 330) return; botT = nowB;   // human-ish pace: about 3 moves a second
  if (state === 'ready') { if (W.tasks[S.restored] && S.stars >= W.tasks[S.restored].cost && (!pan || performance.now() > pan.until)) { restoreNext(); return; } if (!pan || performance.now() > pan.until) startLevel(); return; }
  if (state !== 'play') return;
  for (const s of slots) if (s.order != null && canDeliver(level.orders[s.order])) { deliver(s.i); return; }
  const pending = [...slots.filter(s => s.order != null).map(s => s.order), ...level.queue];
  const maxNeed = {}; for (const oi of pending) for (const id of level.orders[oi].items) { const I = INFO[id]; maxNeed[I.chain] = Math.max(maxNeed[I.chain] || 0, I.tier); }
  const wanted = e => e.kind === 'item' && maxNeed[INFO[e.id].chain] && INFO[e.id].tier < maxNeed[INFO[e.id].chain];
  const pair = findPair(wanted);
  if (pair) { merge(pair[0], pair[1]); return; }
  const chest = ents.find(e => e.kind === 'chest' && !e.fly); if (chest) { openChest(chest); return; }
  const free = ents.filter(e => !e.fly && !e.hidden).length, full = free >= N * N - 2;
  const junk = ents.filter(e => e.kind === 'item' && !e.locked && !e.fly && (!maxNeed[INFO[e.id].chain] || INFO[e.id].tier > maxNeed[INFO[e.id].chain]));
  if (junk.length && (full || junk.length > 3)) { sell(junk[0]); return; }
  const need = needByChain();
  const order = [need.cake > need.flower + need.tea ? 'oven' : 'g17', 'oven', 'g17'];
  for (const id of order) { const g = ents.find(e => e.id === id); if (g && gens[id].charge >= 1 && (id !== 'oven' || need.cake > 0) && (id !== 'g17' || need.flower + need.tea > 0)) { if (genTap(g)) return; } }
  const anyPair = findPair(); if (anyPair && full) { merge(anyPair[0], anyPair[1]); return; }
  if (full) { const it = ents.find(e => e.kind === 'item' && !e.locked && !e.fly); if (it) sell(it); }
}
renderer.info.autoReset = false;
const PERF = { calls: 0, tris: 0 };
window.__dbg = { PERF, renderer, camera, scene, poseBoard, poseGarden, M, IM, get ents() { return ents; } };
window.__game = { get state() { return state; }, get level() { return S.level; }, get score() { return S.total; }, bot,
  autostart() { if (state !== 'ready' || startEl.classList.contains('hide')) return false; startLevel(); },   // arcade: no tap needed (false = still loading)
  get info() { return { taps, par: level?.par, delivered, orders: level?.orders.length, stars: S.stars, restored: S.restored, ents: ents.length }; } };

// ------------------------------------------------------------ camera poses
const tmpCam = new THREE.PerspectiveCamera();
const corners = [[-3.9, 3.9], [3.9, 3.9], [-3.9, -3.9], [3.9, -3.9]].map(([x, z]) => V3(x, TOP, z));
function project(cam, p) { const v = p.clone().project(cam); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; }
function poseBoard() {
  const w = innerWidth, h = innerHeight, asp = w / h, portrait = asp < 0.8;
  const fov = portrait ? 44 : 34, pitch = portrait ? 0.86 : 0.8, tgt = V3(0, TOP, 0.2), dir = V3(0, Math.sin(pitch), Math.cos(pitch));
  tmpCam.fov = fov; tmpCam.aspect = asp; tmpCam.clearViewOffset(); tmpCam.updateProjectionMatrix();
  const bottomPad = portrait ? 92 : 96, topLimit = portrait ? Math.max(250, h * 0.36) : h * 0.4;
  const measure = d => { tmpCam.position.copy(tgt).addScaledVector(dir, d); tmpCam.lookAt(tgt); tmpCam.updateMatrixWorld(); const ps = corners.map(c => project(tmpCam, c));
    return { minX: Math.min(...ps.map(p => p.x)), maxX: Math.max(...ps.map(p => p.x)), yN: Math.max(...ps.map(p => p.y)), yF: Math.min(...ps.map(p => p.y)) }; };
  let lo = 4, hi = 80;
  for (let i = 0; i < 28; i++) { const d = (lo + hi) / 2, m = measure(d); if (m.minX >= 4 && m.maxX <= w - 4 && m.yN - m.yF <= h - bottomPad - topLimit) hi = d; else lo = d; }
  const m = measure(hi);
  return { pos: tgt.clone().addScaledVector(dir, hi), tgt, fov, off: -((h - bottomPad) - m.yN) };
}
function poseGarden() {
  const portrait = innerWidth / innerHeight < 0.8;
  const tx = pan && performance.now() < pan.until ? pan.x * 0.8 : 0, tz = pan && performance.now() < pan.until ? pan.z : -13;
  return { pos: V3(tx * 0.6, portrait ? 12.5 : 10, tz + (portrait ? 19 : 17)), tgt: V3(tx, 0.8, tz), fov: portrait ? 52 : 40, off: innerHeight * (portrait ? 0.2 : 0.16) };
}
let camGoal = 'garden', camCur = null;
function updateCamera(dt) {
  const g = camGoal === 'board' ? poseBoard() : poseGarden();
  if (!camCur) camCur = { pos: g.pos.clone(), tgt: g.tgt.clone(), fov: g.fov, off: g.off };
  const k = 1 - Math.exp(-dt * 3.2);
  camCur.pos.lerp(g.pos, k); camCur.tgt.lerp(g.tgt, k); camCur.fov += (g.fov - camCur.fov) * k; camCur.off += (g.off - camCur.off) * k;
  camera.position.copy(camCur.pos); camera.lookAt(camCur.tgt); camera.fov = camCur.fov; camera.aspect = innerWidth / innerHeight;
  camera.setViewOffset(innerWidth, innerHeight, 0, camCur.off, innerWidth, innerHeight); camera.updateProjectionMatrix();
}
function resize() { renderer.setSize(innerWidth, innerHeight, false); C.resize(innerWidth, innerHeight); spMat.uniforms.uScale.value = innerHeight; }
addEventListener('resize', resize);

// ------------------------------------------------------------ per-frame render of the board
const mtx = new THREE.Matrix4(), mq = new THREE.Quaternion(), mv = V3(), ms = V3(), meu = new THREE.Euler(), white = new THREE.Color(1, 1, 1), dimC = new THREE.Color(0.62, 0.66, 0.6), tmpC = new THREE.Color();
function drawBoard(now, dt) {
  for (const id of ITEM_IDS) IM[id].count = 0;
  shadowIM.count = 0; brambleIM.count = 0; hintIM.count = 0;
  const dragId = drag && drag.moved ? drag.e.id : null;
  // tiles: highlight drop target
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) tiles.setColorAt(r * N + c, (r + c) % 2 ? TILE_B : TILE_A);
  if (drag && drag.moved && drag.over) { const [r, c] = drag.over, b = grid[r][c]; tiles.setColorAt(r * N + c, b && b !== drag.e && b.id === drag.e.id ? TILE_OK : TILE_HI); }
  tiles.instanceColor.needsUpdate = true;
  for (const e of ents) {
    if (e.hidden) continue;
    // position
    if (e.fly) {
      const u = clamp((now - e.fly.t0) / e.fly.dur, 0, 1), ee = 1 - Math.pow(1 - u, 2);
      if (u > 0) { e.pos.lerpVectors(e.fly.a, e.fly.b, ee); e.pos.y += Math.sin(u * Math.PI) * e.fly.h; }
      if (u >= 1) { const f = e.fly; e.fly = null; if (f.onEnd) { f.onEnd(); continue; } e.pos.copy(f.b); e.pop = now; snd.land(); if (state === 'play') refreshOrders(); }
    } else if (e.dragging && e.dragTo) e.pos.lerp(e.dragTo, 1 - Math.exp(-dt * 30));
    else e.pos.lerp(cellPos(e.r, e.c), 1 - Math.exp(-dt * 20));
    // scale: spawn growth + squash after pops
    const age = now - e.born, grow = e.fly && e.fly.shrink ? 1 - clamp((now - e.fly.t0) / e.fly.dur, 0, 1) * 0.85 : Math.min(1, age * 5);
    const pt = now - e.pop, sq = pt < 0.7 ? Math.sin(pt * 18) * Math.exp(-pt * 6) * 0.28 : 0;
    const lift = e.dragging ? 1.18 : 1;
    let base = e.kind === 'item' ? 0.86 + INFO[e.id].tier * 0.016 : e.kind === 'chest' ? 0.86 : 1.08;
    if (e.kind === 'gen') { const G = gens[e.id], breathe = G && G.charge >= 1 ? Math.sin(now * 3 + e.phase) * 0.025 : 0; base *= 1 + breathe; }
    const sy = (1 + sq) * grow * lift * base, sxz = (1 - sq * 0.5) * grow * lift * base;
    const sway = e.kind === 'item' && !e.fly ? Math.sin(now * 1.6 + e.phase) * 0.06 : 0;
    if (e.kind === 'gen') {
      const g = genMesh[e.id]; g.position.copy(e.pos); g.scale.set(sxz * (e.id === 'g17' ? 0.92 : 1), sy * (e.id === 'g17' ? 0.92 : 1), sxz * (e.id === 'g17' ? 0.92 : 1)); g.rotation.y = e.id === 'g17' ? -0.3 : 0.25;
      if (g.userData.glow) g.userData.glow.emissiveIntensity = 1.2 + Math.sin(now * 5) * 0.4 + (gens[e.id].charge >= 1 ? 0.4 : -0.6);
    } else {
      const im = IM[e.id], i = im.count++;
      mtx.compose(e.pos, mq.setFromEuler(meu.set(0, sway + (e.kind === 'chest' ? -0.3 : 0), 0)), ms.set(sxz, sy, sxz)).multiply(M[e.id].mm);
      im.setMatrixAt(i, mtx);
      const fl = now - e.pop < 0.25 ? 1 + (0.25 - (now - e.pop)) * 2 : 1;
      im.setColorAt(i, e.locked ? dimC : fl > 1 ? tmpC.setScalar(fl) : white);
    }
    // contact shadow
    if (!(e.fly && e.fly.shrink)) { const si = shadowIM.count++, hgt = Math.max(0, e.pos.y - TOP), s = (e.kind === 'gen' ? 1.05 : 0.86) * Math.max(0.4, 1 - hgt * 0.5) * Math.min(1, grow + 0.3);
      mtx.compose(mv.set(e.pos.x, TOP + 0.004, e.pos.z), mq.identity(), ms.set(s, 1, s)); shadowIM.setMatrixAt(si, mtx); }
    if (e.locked) { const bi = brambleIM.count++; mtx.compose(mv.set(e.r !== undefined ? e.c - 3 : 0, TOP, e.r - 3), mq.setFromEuler(meu.set(0, e.phase, 0)), ms.set(1, 1 + Math.sin(now * 2 + e.phase) * 0.03, 1)); brambleIM.setMatrixAt(bi, mtx); }
    if (dragId && e !== drag.e && e.id === dragId && !e.fly && INFO[e.id]?.next) { const hi = hintIM.count++; mtx.compose(mv.set(e.c - 3, TOP + 0.012, e.r - 3), mq.identity(), ms.setScalar(1 + Math.sin(now * 8) * 0.06)); hintIM.setMatrixAt(hi, mtx); }
  }
  for (const id of ITEM_IDS) { IM[id].instanceMatrix.needsUpdate = true; if (IM[id].instanceColor) IM[id].instanceColor.needsUpdate = true; }
  shadowIM.instanceMatrix.needsUpdate = brambleIM.instanceMatrix.needsUpdate = hintIM.instanceMatrix.needsUpdate = true;
  hintIM.material.opacity = 0.55 + Math.sin(now * 8) * 0.3;
  if (sel && !sel.hidden && state === 'play') { selRing.visible = true; selRing.position.set(sel.pos.x, TOP + 0.015, sel.pos.z); selRing.scale.setScalar(1 + Math.sin(now * 5) * 0.05); } else selRing.visible = false;
}

// ------------------------------------------------------------ main loop
let last = performance.now(), hudT = 0;
function frame(tms) {
  const dt = Math.min(0.05, (tms - last) / 1000); last = tms; const now = tms / 1000;
  if (state === 'play' && level) for (const id of level.gens) { const G = gens[id]; if (G.charge < GEN[id].max) { G.charge = Math.min(GEN[id].max, G.charge + dt / GEN[id].regen); } }
  drawBoard(now, dt);
  // guests
  for (const hh of heroes) {
    if (!hh.h.object.visible) continue;
    hh.h.mixer.update(dt);
    hh.k = Math.min(1, hh.k + dt * 4); let s = hh.k < 1 ? 1 + Math.sin(hh.k * Math.PI) * 0.12 : 1; s *= hh.k < 0.5 ? hh.k * 2 : 1;
    if (hh.out) s *= Math.max(0.01, 1 - (now - hh.out) / 0.3);
    hh.h.object.scale.setScalar(Math.max(0.01, s));
    if (hh.backT && now > hh.backT) { hh.backT = 0; hh.h.play('idle', { fade: 0.4 }); }
  }
  // bubbles + generator badges follow the 3D scene
  for (const s of slots) { const p = toScreen(V3(s.x, HERO_H + 0.28, SLOT_Z)); s.el.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-100%)`; }
  for (const id of ['g17', 'oven']) { const g = ents.find(e => e.id === id); if (g) { const p = toScreen(g.pos.clone().add(V3(0.28, 0.95, 0))); genBadge[id].style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-50%)`; } }
  hudT += dt; if (hudT > 0.25) { hudT = 0; if (state === 'play') updateHud(); }
  updateHand(now);
  updateFx(dt);
  W.update(dt, now);
  updateCamera(dt);
  renderer.info.reset(); C.render(dt); PERF.calls = renderer.info.render.calls; PERF.tris = renderer.info.render.triangles;
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------ boot
W.setRestored(S.restored);
updateHud(); renderStart(); startEl.classList.remove('hide');
resize();
requestAnimationFrame(t => { last = t; frame(t); });
setTimeout(() => { const l = $('loading'); l.style.opacity = 0; setTimeout(() => l.remove(), 500); }, 60);
