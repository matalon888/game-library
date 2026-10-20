// Koi Court: 3D Mahjong — mahjong solitaire with thick carved ivory-and-jade tiles on a tatami dais in a zen garden.
// Tap two free matching tiles to clear them (free = nothing on top, and an open left or right side). Every deal is
// built backwards from a full solution, so it is always solvable; hints, shuffles and undos are earned by play.
// Stars (by time) restore the garden piece by piece. Art: the AGENTPARK AI 3D library (z = zen garden) + Hero Lab's
// Bao as the garden keeper; tiles, symbols, dais, walls, trees and UI are built in code.
import { THREE, createUI, store, buzz, confetti, updateParticles } from './kit/hc.js';
import { cine } from './kit/cine.js';
import { GLTFLoader } from './kit/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from './kit/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from './kit/addons/utils/BufferGeometryUtils.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { loadHero } from './kit/heroes.js';
import { snd } from './audio.js';
import { drawAtlas, symbolIcon, SYMBOLS, COLS, ROWS, TREASURE } from './tiles.js';
import { makeLayout, computeFree, reversePairs, dealSymbols, reshuffle, freePairs, rng } from './layouts.js';
import { buildGarden, petals } from './garden.js';

const V3 = THREE.Vector3;
const NAME = 'Koi Court: 3D Mahjong';
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const easeBack = t => { t = clamp(t, 0, 1); const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

// ------------------------------------------------------------------ save + meta
const S = store('koicourt');
const save = {
  level: S.get('level', 1), stars: S.get('stars', {}), boost: S.get('boost', { hint: 3, shuffle: 2, undo: 3 }),
  garden: S.get('garden', []), dailyWon: S.get('dailyWon', ''), dailyStars: S.get('dailyStars', 0),
};
const persist = () => { for (const k in save) S.set(k, save[k]); };
const totalStars = () => Object.values(save.stars).reduce((a, b) => a + b, 0) + save.dailyStars;

// ------------------------------------------------------------------ kit layers
const ui = createUI({ title: 'Koi Court', hint: '', hand: '', progress: false, score: false });
const F = flow('koicourt');
buildHomeShell();
const D = daily('koicourt', ui, { name: NAME });
const B = board({ game: 'koi-court', label: 'Stars won', mode: 'sum', limits: { maxRun: 6, maxPerSec: 1 }, corner: 'tl', accent: '#e8492a' });

// ------------------------------------------------------------------ renderer / scene
const R = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
R.domElement.className = 'hc-canvas'; document.body.prepend(R.domElement);
R.setPixelRatio(Math.min(devicePixelRatio, 2)); R.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.5, 260);
const C = cine(R, scene, camera, { bloom: 0.18, bloomThreshold: 0.92, bloomRadius: 0.4, exposure: 0.95, envIntensity: 0.4,
  grade: { sat: 1.15, contrast: 1.05, vignette: 0.1, grain: 0, tint: '#fff9f0' } });
if (C.lite) C.bloom.enabled = false;
const hemi = new THREE.HemisphereLight('#fff4e6', '#d9b48c', 0.55); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff0da', 2.0); sun.position.set(-9, 20, 12); sun.castShadow = true;
sun.shadow.mapSize.set(C.lite ? 1024 : 2048, C.lite ? 1024 : 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 2, far: 60 }); scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight('#ffe0ec', 0.45); fill.position.set(8, 6, 14); scene.add(fill);

const GD = buildGarden(scene);
const PT = petals(scene, C.lite ? 40 : 70);
const gardenReady = (async () => { await Promise.all(save.garden.map(id => GD.apply(id, false))); applyDusk(); if (state === 'ready') renderHome(); })();
function applyDusk() {
  if (!GD.dusk) return;
  hemi.color.set('#ffe2c8'); hemi.intensity = 0.62; sun.color.set('#ffc890'); sun.intensity = 2.2; C.grade.uniforms.uTint.value.set('#fff0e2');
}

// ------------------------------------------------------------------ tiles: geometry, atlas, instanced meshes
const TW = 1, TD = 1.34, TH = 0.62, GAP = 1.035, MAX = 170;
const ATL = drawAtlas();
const mapTex = new THREE.CanvasTexture(ATL.map); mapTex.colorSpace = THREE.SRGBColorSpace; mapTex.anisotropy = 8;
const bumpTex = new THREE.CanvasTexture(ATL.bump); bumpTex.anisotropy = 8;
function bodyGeo() {
  const top = new RoundedBoxGeometry(TW, TH * 0.6, TD, 3, 0.1); top.translate(0, TH * 0.2, 0);
  const bot = new RoundedBoxGeometry(TW * 0.99, TH * 0.44, TD * 0.99, 3, 0.1); bot.translate(0, -TH * 0.28, 0);
  const paint = (g, hex) => { const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); };
  paint(top, '#fff4e2'); paint(bot, '#279a7c');
  return mergeGeometries([top, bot]);
}
const bodyMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.28, envMapIntensity: 0.7 });
const bodies = new THREE.InstancedMesh(bodyGeo(), bodyMat, MAX);
const faceGeo = new THREE.PlaneGeometry(TW * 0.86, TD * 0.89); faceGeo.rotateX(-Math.PI / 2); faceGeo.translate(0, TH / 2 + 0.004, 0);
const aCell = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1); faceGeo.setAttribute('aCell', aCell);
const faceMat = new THREE.MeshStandardMaterial({ map: mapTex, bumpMap: bumpTex, bumpScale: 1.6, roughness: 0.5, metalness: 0, envMapIntensity: 0.3 });
faceMat.onBeforeCompile = sh => {
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aCell;').replace('#include <uv_vertex>', `#include <uv_vertex>
    vec2 kc = vec2(mod(aCell, ${COLS}.0), floor(aCell / ${COLS}.0 + 0.001));
    vec2 kuv = uv * vec2(1.0 / ${COLS}.0, 1.0 / ${ROWS}.0) + vec2(kc.x / ${COLS}.0, 1.0 - (kc.y + 1.0) / ${ROWS}.0);
    #ifdef USE_MAP
    vMapUv = kuv;
    #endif
    #ifdef USE_BUMPMAP
    vBumpMapUv = kuv;
    #endif`);
};
const faces = new THREE.InstancedMesh(faceGeo, faceMat, MAX);
for (const m of [bodies, faces]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0; scene.add(m); }
bodies.castShadow = true; bodies.receiveShadow = true; faces.receiveShadow = true;
for (let i = 0; i < MAX; i++) { bodies.setColorAt(i, new THREE.Color(1, 1, 1)); faces.setColorAt(i, new THREE.Color(1, 1, 1)); }

// ------------------------------------------------------------------ sparkles + rings (juice)
const SPN = 400, spPos = new Float32Array(SPN * 3).fill(-999), spCol = new Float32Array(SPN * 3), spV = new Float32Array(SPN * 3), spL = new Float32Array(SPN), spC = new Float32Array(SPN * 3);
const spGeo = new THREE.BufferGeometry(); spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3)); spGeo.setAttribute('color', new THREE.BufferAttribute(spCol, 3));
const starTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(32, 2); x.lineTo(36, 28); x.lineTo(62, 32); x.lineTo(36, 36); x.lineTo(32, 62); x.lineTo(28, 36); x.lineTo(2, 32); x.lineTo(28, 28); x.closePath(); x.fill(); return new THREE.CanvasTexture(c); })();
const sparks = new THREE.Points(spGeo, new THREE.PointsMaterial({ size: 0.32, map: starTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
sparks.frustumCulled = false; scene.add(sparks);
let spI = 0;
function sparkle(p, color, n = 24, speed = 2.4) {
  const c = new THREE.Color(color);
  for (let k = 0; k < n; k++) {
    const i = spI = (spI + 1) % SPN, a = Math.random() * Math.PI * 2, b = Math.acos(Math.random() * 2 - 1), s = speed * (0.4 + Math.random() * 0.8);
    spPos[i * 3] = p.x; spPos[i * 3 + 1] = p.y; spPos[i * 3 + 2] = p.z;
    spV[i * 3] = Math.sin(b) * Math.cos(a) * s; spV[i * 3 + 1] = Math.abs(Math.cos(b)) * s + speed * 0.4; spV[i * 3 + 2] = Math.sin(b) * Math.sin(a) * s;
    const w = Math.random() < 0.35; spC[i * 3] = w ? 1 : c.r; spC[i * 3 + 1] = w ? 1 : c.g; spC[i * 3 + 2] = w ? 1 : c.b; spL[i] = 0.7 + Math.random() * 0.5;
  }
}
function updSparks(dt) {
  for (let i = 0; i < SPN; i++) {
    if (spL[i] <= 0) continue; spL[i] -= dt * 1.3;
    if (spL[i] <= 0) { spPos[i * 3 + 1] = -999; spCol[i * 3] = spCol[i * 3 + 1] = spCol[i * 3 + 2] = 0; continue; }
    spV[i * 3 + 1] -= 5 * dt; for (let k = 0; k < 3; k++) { spPos[i * 3 + k] += spV[i * 3 + k] * dt; spV[i * 3 + k] *= 0.97; spCol[i * 3 + k] = spC[i * 3 + k] * Math.min(1, spL[i] * 1.6); }
  }
  spGeo.attributes.position.needsUpdate = true; spGeo.attributes.color.needsUpdate = true;
}
const rings = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 48), new THREE.MeshBasicMaterial({ color: '#fff4c2', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); m.userData.t = 1; return m; });
let ringI = 0;
function ring(p, s = 1, color = '#fff4c2') { const r = rings[ringI = (ringI + 1) % rings.length]; r.position.copy(p); r.material.color.set(color); r.userData = { t: 0, s }; r.visible = true; }
function updRings(dt) { for (const r of rings) { if (!r.visible) continue; const u = r.userData; u.t += dt * 2.2; if (u.t >= 1) { r.visible = false; continue; } r.scale.setScalar(u.s * (0.3 + ease(u.t) * 1.6)); r.material.opacity = (1 - u.t) * 0.9; } }

// ------------------------------------------------------------------ level state
const Lv = { n: 1, daily: false, tiles: [], alive: [], sym: {}, free: [], solution: [], sel: -1, hint: null, hintT: 0, hist: [],
  t: 0, par: 60, intro: 0, combo: 0, comboT: 0, points: 0, treasure: 0, recorded: false, busy: 0, hop: 0, hopSwap: null, seed: 1, t0: 0, stuckT: 0, beatShown: false };
let state = 'ready';
let bounds = { w: 4, d: 4, top: 1 };

function kindsFor(n, pairs) {
  const fk = F.k();
  const k = n <= 1 ? 4 : n <= 2 ? 6 : n <= 3 ? 8 : Math.round(clamp((8 + n * 0.55) * fk, 8, 34));
  return Math.min(k, pairs);
}
function prepareLevel(opt = {}) {
  const isDaily = opt.daily ?? D.isDaily;
  const n = isDaily ? 22 : (opt.level || save.level);
  let seed = isDaily ? D.seed : n * 1009 + 7;
  let lay, pairs, r;
  for (let attempt = 0; attempt < 6 && !pairs; attempt++) {
    lay = makeLayout(n, seed + attempt * 7919); r = rng(seed * 13 + attempt);
    const alive = lay.tiles.map(() => true);
    for (let k = 0; k < 40 && !pairs; k++) pairs = reversePairs(lay.tiles, alive, r);
  }
  if (!pairs) {   // never expected: fall back to a flat 4x4 court
    lay = { tiles: [] }; for (let k = 0; k < 16; k++) lay.tiles.push({ x: (k % 4) * 2, z: Math.floor(k / 4) * 2, l: 0 });
    r = rng(seed); pairs = reversePairs(lay.tiles, lay.tiles.map(() => true), r);
  }
  const tiles = lay.tiles.slice(0, MAX);
  const P = pairs.length, treasure = n >= 4 ? (n >= 15 ? 2 : 1) : 0;
  const sym = dealSymbols(pairs, n, r, { kinds: kindsFor(n, P), treasure });
  // world positions, centred
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, top = 0;
  for (const t of tiles) { x0 = Math.min(x0, t.x); x1 = Math.max(x1, t.x + 2); z0 = Math.min(z0, t.z); z1 = Math.max(z1, t.z + 2); top = Math.max(top, t.l); }
  const cx = (x0 + x1) / 4, cz = (z0 + z1) / 4;
  Lv.tiles = tiles.map((t, i) => ({ ...t, i, base: new V3(((t.x / 2 + 0.5) - cx) * TW * GAP, t.l * TH + TH / 2, ((t.z / 2 + 0.5) - cz) * TD * GAP), lift: 0, shake: 0, fly: null, pop: 1, drop: 0, gone: false }));
  bounds = { w: (x1 - x0) / 2 * TW * GAP, d: (z1 - z0) / 2 * TD * GAP, top: (top + 1) * TH };
  Lv.alive = tiles.map(() => true); Lv.sym = sym; Lv.solution = pairs; Lv.n = n; Lv.daily = isDaily; Lv.seed = seed;
  Lv.sel = -1; Lv.hint = null; Lv.hist = []; Lv.t = 0; Lv.combo = 0; Lv.comboT = 0; Lv.points = 0; Lv.treasure = 0; Lv.recorded = false; Lv.busy = 0; Lv.hop = 0; Lv.stuckT = 0; Lv.beatShown = false;
  Lv.par = Math.round(18 + tiles.length * 1.25);
  Lv.free = computeFree(Lv.tiles, Lv.alive);
  for (const t of Lv.tiles) aCell.array[t.i] = Lv.sym[t.i];
  aCell.needsUpdate = true; bodies.count = faces.count = Lv.tiles.length;
  GD.setDais(bounds.w, bounds.d);
  layout();
}
function startLevel(opt = {}) {
  snd.unlock();
  if (opt.fresh !== false || !Lv.tiles.length || Lv.prepared !== (opt.level || save.level) + ':' + (opt.daily ?? D.isDaily)) prepareLevel(opt);
  Lv.prepared = null;
  // tiles drop in, layer by layer
  const order = Lv.tiles.slice().sort((a, b) => a.l - b.l || a.z - b.z || a.x - b.x);
  order.forEach((t, k) => { t.drop = 0.15 + t.l * 0.18 + k * (0.55 / order.length); t.dropK = 0; });
  Lv.intro = 0.15 + 0.55 + 0.18 * 4 + 0.4;
  ui.hideStart(); $('#hud').classList.remove('off'); $('#boosters').classList.remove('off');
  $('#lvl').textContent = Lv.daily ? '★' : Lv.n;
  state = 'play'; mode = 'play'; Lv.t0 = performance.now(); layout();
  refreshBoosters(); paintHud(); bubble(null);
  B.start(); snd.music(true); snd.shuffle();
  if (Lv.n <= 2 && !Lv.daily) setTimeout(() => { if (state === 'play') toast(Lv.n === 1 ? 'Tap two matching tiles!' : 'Only free tiles can be picked', true); }, 1500);
}

// ------------------------------------------------------------------ rules: taps, matches, shuffles
function recomputeFree() { Lv.free = computeFree(Lv.tiles, Lv.alive); paintHud(); }
function tap(i) {
  if (state !== 'play' || Lv.intro > 0 || Lv.hop > 0) return false;
  const t = Lv.tiles[i]; if (!t || !Lv.alive[i]) return false;
  if (!Lv.free[i]) { t.shake = 0.35; snd.blocked(); buzz(15); return false; }
  if (Lv.sel === i) { Lv.sel = -1; snd.deselect(); return true; }
  if (Lv.sel >= 0 && Lv.sym[Lv.sel] === Lv.sym[i]) { match(Lv.sel, i); return true; }
  Lv.sel = i; snd.tap(Lv.sym[i]); buzz(8); return true;
}
function match(a, b) {
  const A = Lv.tiles[a], Bt = Lv.tiles[b];
  Lv.alive[a] = Lv.alive[b] = false; Lv.sel = -1; Lv.hint = null;
  Lv.hist.push([a, b]);
  const mid = A.base.clone().add(Bt.base).multiplyScalar(0.5); mid.y = Math.max(A.base.y, Bt.base.y) + 1.5;
  const dir = new V3(Bt.base.x - A.base.x, 0, Bt.base.z - A.base.z); if (dir.lengthSq() < 0.01) dir.set(1, 0, 0); dir.normalize().multiplyScalar(TW * 0.52);
  A.fly = { t: 0, from: A.base.clone(), to: mid.clone().sub(dir), mid, clack: true }; Bt.fly = { t: 0, from: Bt.base.clone(), to: mid.clone().add(dir), mid, clack: false };
  Lv.combo = Lv.comboT > 0 ? Lv.combo + 1 : 0; Lv.comboT = 3;
  Lv.points += 10 * (1 + Lv.combo);
  const isT = Lv.sym[a] === TREASURE;
  if (isT) Lv.points += 50;
  recomputeFree();
  setTimeout(() => {
    if (state !== 'play' && state !== 'won') return;
    snd.match(Lv.combo); buzz([10, 30, 12]);
    const col = SYMBOLS[Lv.sym[a]]?.col || '#ffd36b';
    sparkle(mid, col, 30, 2.6); sparkle(mid, '#ffffff', 12, 1.8); ring(mid, 0.7);
    if (isT) { Lv.treasure++; treasureReward(mid); }
    else if (Lv.combo >= 1) toast(['Nice!', 'Great!', 'Wonderful!', 'Brilliant!', 'Zen master!'][Math.min(4, Lv.combo - 1)] + (Lv.combo >= 2 ? ` x${Lv.combo + 1}` : ''));
    if (D.beaten(Lv.points) && !Lv.beatShown) { Lv.beatShown = true; toast('BEATEN!'); confetti(scene, mid, 40); }
  }, 330);
  if (Lv.alive.every(v => !v)) { winLevel(); return; }
  if (!countPairs()) Lv.stuckT = 0.9;
}
function countPairs() { const by = {}; Lv.tiles.forEach((t, i) => { if (Lv.alive[i] && Lv.free[i]) by[Lv.sym[i]] = (by[Lv.sym[i]] || 0) + 1; }); return Object.values(by).reduce((a, v) => a + Math.floor(v / 2), 0); }
function treasureReward(p) {
  const k = ['hint', 'shuffle', 'undo'][Math.floor(Math.random() * 3)];
  save.boost[k] = (save.boost[k] || 0) + 1; persist();
  snd.treasure(); toast('Treasure! +1 ' + k, false, 'gold');
  sparkle(p, '#ffd34a', 50, 3.4);
  const s = worldToScreen(p), btn = document.querySelector(`.bst[data-k=${k}]`), r = btn.getBoundingClientRect();
  const im = document.createElement('img'); im.className = 'fly'; im.src = symbolIcon(TREASURE, 80); im.style.left = (s.x - 20) + 'px'; im.style.top = (s.y - 20) + 'px'; document.body.appendChild(im);
  requestAnimationFrame(() => requestAnimationFrame(() => { im.style.transform = `translate(${r.left + r.width / 2 - s.x}px,${r.top + r.height / 2 - s.y}px) scale(.7)`; }));
  setTimeout(() => { im.remove(); refreshBoosters(); btn.classList.remove('shake'); void btn.offsetWidth; btn.classList.add('shake'); snd.coin(); }, 620);
}
// shuffle: tiles hop, symbols swap at the top of the hop; always leaves a solvable board
function doShuffle(free = false) {
  if (state !== 'play' || Lv.hop > 0) return false;
  const r = rng(Lv.seed + Lv.hist.length * 31 + Math.floor(Lv.t * 10));
  let res = reshuffle(Lv.tiles, Lv.alive, Lv.sym, r), relay = null;
  if (!res) {
    // structurally stuck (e.g. a two-tile tower): lay the remaining tiles out flat, then re-deal
    const alive = Lv.tiles.filter((t, i) => Lv.alive[i]); const n = alive.length, cols = Math.min(8, Math.max(2, Math.ceil(Math.sqrt(n * 1.4))));
    relay = alive.map((t, k) => ({ t, x: (k % cols) * 2, z: Math.floor(k / cols) * 2, l: 0 }));
    const rows = Math.ceil(n / cols);
    const tmp = Lv.tiles.map(t => ({ x: t.x, z: t.z, l: t.l }));
    for (const q of relay) tmp[q.t.i] = { x: q.x + 100, z: q.z, l: 0 };
    res = reshuffle(tmp, Lv.alive, Lv.sym, r);
    for (const q of relay) { q.t.x = q.x + 100; q.t.z = q.z; q.t.l = 0; q.t.newBase = new V3(((q.x / 2 + 0.5) - cols / 2) * TW * GAP, TH / 2, ((q.z / 2 + 0.5) - rows / 2) * TD * GAP); }
    if (!res) return false;
  }
  Lv.hop = 0.75; Lv.hopSwap = res; Lv.sel = -1; Lv.hint = null; Lv.solution = res.pairs; Lv.relay = relay;
  snd.shuffle(); buzz(20);
  if (free) toast('No moves left — reshuffling', true);
  return true;
}
function applySwap() {
  const res = Lv.hopSwap; if (!res) return; Lv.hopSwap = null;
  for (const i in res.sym) { Lv.sym[i] = res.sym[i]; aCell.array[i] = res.sym[i]; }
  aCell.needsUpdate = true;
  if (Lv.relay) for (const q of Lv.relay) { q.t.base.copy(q.t.newBase); }
  recomputeFree();
}
function doUndo() {
  if (state !== 'play' || !Lv.hist.length || Lv.hop > 0) return false;
  const [a, b] = Lv.hist.pop();
  for (const i of [a, b]) { const t = Lv.tiles[i]; Lv.alive[i] = true; t.fly = null; t.pop = 0; }
  Lv.sel = -1; Lv.hint = null; Lv.combo = 0; Lv.comboT = 0; Lv.stuckT = 0;
  recomputeFree(); snd.undo();
  return true;
}
function findHint() {
  for (const [a, b] of Lv.solution) if (Lv.alive[a] && Lv.alive[b] && Lv.free[a] && Lv.free[b] && Lv.sym[a] === Lv.sym[b]) return [a, b];
  const { pairs } = freePairs(Lv.tiles, Lv.alive, Lv.sym);
  if (!pairs.length) return null;
  // prefer the pair that frees the most tiles below / beside
  return pairs.sort((p, q) => (Lv.tiles[q[0]].l + Lv.tiles[q[1]].l) - (Lv.tiles[p[0]].l + Lv.tiles[p[1]].l))[0];
}
function doHint() {
  if (state !== 'play' || Lv.hop > 0) return false;
  const h = findHint(); if (!h) return false;
  Lv.hint = h; Lv.hintT = 4; Lv.sel = -1; snd.hint();
  return true;
}

// ------------------------------------------------------------------ boosters
const BOOST = ['hint', 'shuffle', 'undo'];
function refreshBoosters() { for (const b of document.querySelectorAll('.bst')) { const n = save.boost[b.dataset.k] || 0; b.querySelector('b').textContent = n || '+'; b.classList.toggle('zero', !n); } }
function useBooster(k) {
  if (state !== 'play') return false;
  const btn = document.querySelector(`.bst[data-k=${k}]`);
  const nope = () => { btn.classList.remove('shake'); void btn.offsetWidth; btn.classList.add('shake'); snd.deny(); };
  if (!(save.boost[k] > 0)) { nope(); toast('Win levels to earn more', true); return false; }
  const ok = k === 'hint' ? doHint() : k === 'shuffle' ? doShuffle() : doUndo();
  if (!ok) { nope(); return false; }
  save.boost[k]--; persist(); refreshBoosters(); return true;
}
for (const b of document.querySelectorAll('.bst')) { b.addEventListener('pointerdown', e => e.stopPropagation()); b.addEventListener('click', e => { e.stopPropagation(); snd.unlock(); useBooster(b.dataset.k); }); }

// ------------------------------------------------------------------ HUD
const STAR_SVG = '<svg viewBox="0 0 64 64"><path d="M32 4l8.2 17.6 19.3 2.3-14.2 13.2 3.7 19.1L32 46.6 15 56.2l3.7-19.1L4.5 23.9l19.3-2.3z" fill="#ffc94a" stroke="#4a2a1a" stroke-width="4" stroke-linejoin="round"/><path d="M24 22l8-14 3 12z" fill="#fff" opacity=".55"/></svg>';
const meter = $('#meter');
meter.insertAdjacentHTML('beforeend', [0, 1, 2].map(k => `<div class="s" data-s="${k}">${STAR_SVG}</div>`).join(''));
const STAR_AT = [0.04, 0.32, 0.62];   // bar positions of the 1-, 2-, 3-star marks
function starsNow() { return Lv.t <= Lv.par ? 3 : Lv.t <= Lv.par * 1.8 ? 2 : 1; }
function paintMeter() {
  const total = Lv.par / (1 - STAR_AT[2]);           // the bar runs out at total; 3 stars until par
  const f = clamp(1 - Lv.t / total, 0, 1);
  const p2 = 1 - (Lv.par * 1.8) / total;
  meter.querySelector('i').style.width = (f * 100).toFixed(1) + '%';
  const st = meter.querySelectorAll('.s'); const pos = [STAR_AT[0], Math.max(0.12, p2), STAR_AT[2]];
  st.forEach((s, k) => { s.style.left = (pos[k] * 100) + '%'; s.classList.toggle('off', k === 2 ? Lv.t > Lv.par : k === 1 ? Lv.t > Lv.par * 1.8 : false); });
}
function paintHud() {
  $('#pairs').textContent = countPairs(); $('#left').textContent = Lv.alive.filter(Boolean).length;
  $('#pairsChip').classList.toggle('warn', countPairs() === 0);
}
let toastEl = null;
function toast(t, small = false, cls = '') { if (toastEl) toastEl.remove(); const d = toastEl = document.createElement('div'); d.className = 'toast' + (small ? ' small' : '') + (cls ? ' ' + cls : ''); d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 1100); }
const muteBtn = $('#mute');
const paintMute = () => { muteBtn.innerHTML = snd.muted ? '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#ccc" stroke="#4a2a1a" stroke-width="2" stroke-linejoin="round"/><path d="M17 9l5 6M22 9l-5 6" stroke="#4a2a1a" stroke-width="2.4" stroke-linecap="round"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#ffc94a" stroke="#4a2a1a" stroke-width="2" stroke-linejoin="round"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" stroke="#4a2a1a" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg>'; };
paintMute();
for (const b of [muteBtn, $('#home')]) b.addEventListener('pointerdown', e => e.stopPropagation());
muteBtn.addEventListener('click', () => { snd.toggle(); paintMute(); });
$('#home').addEventListener('click', () => { if (state === 'play') { showHome(); } });

// ------------------------------------------------------------------ win
function record(won) { if (Lv.recorded) return; Lv.recorded = true; F.level(won, 1); }
function winLevel() {
  if (state !== 'play') return; state = 'won'; record(true);
  const stars = starsNow(), ms = performance.now() - Lv.t0;
  const rewards = []; let gained = 0;
  Lv.points += Math.max(0, Math.round((Lv.par * 1.8 - Lv.t))) * 2;
  if (Lv.daily) {
    const today = new Date().toISOString().slice(0, 10);
    if (save.dailyWon !== today) { save.dailyWon = today; gained = stars; save.dailyStars += stars; save.boost.shuffle++; rewards.push(['shuffle', 1]); }
  } else {
    const old = save.stars[Lv.n] || 0; if (stars > old) { gained = stars - old; save.stars[Lv.n] = stars; }
    if (Lv.n === save.level) {
      save.level++;
      save.boost.hint++; rewards.push(['hint', 1]);
      if (Lv.n % 2 === 0) { save.boost.shuffle++; rewards.push(['shuffle', 1]); }
      if (Lv.n % 3 === 0) { save.boost.undo++; rewards.push(['undo', 1]); }
      if (Lv.n % 5 === 0) { for (const b of BOOST) save.boost[b]++; rewards.push(['chest', 3]); }
    }
  }
  persist();
  if (gained > 0) B.submit(gained, { ms });
  D.won(Lv.points);
  setTimeout(() => {
    snd.win(); buzz([20, 40, 20]); snd.gong();
    confetti(scene, new V3(0, 3, 0), 80);
    for (let k = 0; k < 5; k++) setTimeout(() => sparkle(new V3((Math.random() - 0.5) * bounds.w, 1.5, (Math.random() - 0.5) * bounds.d), ['#ffd36b', '#ff9fbf', '#7fe0c1', '#9fc8ff', '#ffffff'][k], 40, 3.5), k * 140);
    heroCheer();
  }, 450);
  const w = ui.els.win; w.querySelector('.stars').innerHTML = [0, 1, 2].map(() => `<i>${STAR_SVG}</i>`).join('');
  const ICONS = { hint: boostIcon('hint'), shuffle: boostIcon('shuffle'), undo: boostIcon('undo') };
  w.querySelector('.reward').innerHTML = rewards.map(([k, n]) => k === 'chest' ? `<span><img src="assets/thumbs/z01.webp" alt="">+1 each</span>` : `<span>${ICONS[k]}+${n}</span>`).join('') + `<span>Score ${Lv.points}</span>`;
  setTimeout(() => {
    ui.win(Lv.daily ? 'DAILY' : Lv.n, Lv.daily ? 'Daily puzzle solved!' : `${Lv.tiles.length} tiles in ${fmtTime(Lv.t)}`);
    setTimeout(() => { const st = w.querySelectorAll('.stars i'); for (let k = 0; k < stars; k++) setTimeout(() => { st[k].classList.add('on'); snd.star(k); }, 250 + k * 280); }, 650);
    $('#hud').classList.add('off'); $('#boosters').classList.add('off');
  }, 900);
}
const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function boostIcon(k) { const b = document.querySelector(`.bst[data-k=${k}]`); const bg = { hint: '#f2a01a', shuffle: '#2fa58a', undo: '#e8492a' }[k]; return `<svg viewBox="-3 -3 38 38" style="background:${bg};border-radius:9px">${b.querySelector('svg').innerHTML}</svg>`; }
ui.onTap(which => {
  snd.unlock();
  if (which === 'start') { startLevel(); return; }
  if (which === 'win') { showHome(); return; }
  if (which === 'lose') { startLevel({ level: Lv.n, daily: Lv.daily }); }
});

// ------------------------------------------------------------------ home: garden + next level + restore task
function buildHomeShell() {
  const s = ui.els.start;
  s.innerHTML = `<div id="homeIn"><div class="logo"><h1>Koi <span>Court</span></h1><div class="sub">3D Mahjong</div></div>
    <div id="panel"><div class="k">KOI COURT GARDEN</div><div class="L" id="hL">Level 1</div>
    <div id="path"></div>
    <div class="prog"><i id="gProg"></i><span id="gTxt">Garden restored 0/22</span></div>
    <div id="task"><img id="tImg" alt=""><div class="tx"><b id="tName"></b><small id="tSub"></small></div><button id="taskBtn"></button></div>
    <button id="playBtn">Play</button>
    <div class="meta" id="meta"></div></div></div>`;
  ui.els.win.id = 'winCard'; ui.els.lose.id = 'loseCard'; ui.els.start.id = 'homeCard';
  ui.els.win.querySelector('h1').textContent = 'CLEARED!';
  ui.els.win.querySelector('h1').insertAdjacentHTML('afterend', '<div class="burst"></div><div class="stars"></div><div class="reward"></div>');
  for (const id of ['#task', '#meta']) s.querySelector(id).addEventListener('pointerdown', e => e.stopPropagation());
  s.querySelector('#taskBtn').addEventListener('click', e => { e.stopPropagation(); snd.unlock(); buyTask(); });
}
function spentStars() { return save.garden.reduce((a, id) => a + (GD.tasks.find(t => t.id === id)?.cost || 0), 0); }
function bank() { return Math.max(0, totalStars() - spentStars()); }
function renderHome() {
  const cur = save.level;
  $('#hL').textContent = D.isDaily ? 'Daily puzzle' : `Level ${cur}`;
  let p = '';
  for (let n = Math.max(1, cur - 2); n <= Math.max(1, cur - 2) + 4; n++) {
    const st = save.stars[n] || 0, cls = n < cur ? 'done' : n === cur ? 'cur' : 'lock';
    if (p) p += '<span class="dash"></span>';
    p += `<span class="n ${cls}">${n}${n < cur ? `<i>${'⭐'.repeat(st)}</i>` : ''}</span>`;
  }
  $('#path').innerHTML = p;
  const done = save.garden.length, total = GD.tasks.length;
  $('#gProg').style.width = (done / total * 100) + '%'; $('#gTxt').textContent = `Garden restored ${done}/${total}`;
  const t = GD.nextTask(), b = bank(), btn = $('#taskBtn');
  if (t) {
    $('#tImg').src = t.thumb.startsWith('sym:') ? symbolIcon(+t.thumb.slice(4), 96) : `assets/thumbs/${t.thumb}.webp`;
    $('#tName').textContent = t.name; $('#tSub').textContent = b >= t.cost ? 'Tap to restore' : `Earn stars to restore · you have ${b}`;
    btn.innerHTML = `${STAR_SVG}${t.cost}`; btn.classList.toggle('no', b < t.cost); btn.classList.toggle('glow', b >= t.cost); $('#task').style.display = '';
  } else { $('#tImg').src = symbolIcon(TREASURE, 96); $('#tName').textContent = 'The garden is complete!'; $('#tSub').textContent = 'Keep playing for stars and the world board'; btn.innerHTML = '✓'; btn.classList.add('no'); }
  $('#playBtn').textContent = D.isDaily ? 'Play Daily Puzzle' : `Play Level ${cur}`;
  $('#meta').innerHTML = `<span class="chip">${STAR_SVG.replace('viewBox', 'width="22" height="22" viewBox')} ${b}</span>
    <span class="chip"><img src="${symbolIcon(0, 64)}" alt="">${Object.keys(save.stars).length} solved</span>
    ${D.isDaily ? '<a class="chip" href="./">Journey</a>' : '<a class="chip" href="?daily=1">📅 Daily</a>'}`;
}
async function buyTask() {
  const t = GD.nextTask(); if (!t) return;
  if (bank() < t.cost) { snd.deny(); const b = $('#taskBtn'); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); bubble('Win levels to earn stars!', 2200); return; }
  save.garden.push(t.id); persist();
  focusT = 2.6; focusAt.copy(t.focus);
  snd.restore(); buzz([10, 20, 10]);
  const list = await GD.apply(t.id, true);
  if (t.id === 'dusk') applyDusk();
  setTimeout(() => { sparkle(t.focus.clone().add(new V3(0, 1.5, 0)), '#ffd36b', 60, 4); sparkle(t.focus.clone().add(new V3(0, 1, 0)), '#ff9fbf', 30, 3); confetti(scene, t.focus.clone().add(new V3(0, 2, 0)), 40); }, 500);
  heroCheer(); bubble(['Beautiful!', 'So peaceful…', 'Lovely work!', 'The koi approve!'][save.garden.length % 4], 2400);
  renderHome();
  return list;
}
function showHome() {
  state = 'ready'; mode = 'home'; snd.music(false);
  $('#hud').classList.add('off'); $('#boosters').classList.add('off');
  ui.start(); renderHome();
  // preview the next level's tiles on the dais
  prepareLevel({ level: save.level, daily: D.isDaily }); Lv.prepared = save.level + ':' + D.isDaily;
  layout();
  setTimeout(() => { if (state === 'ready') bubble(bank() >= (GD.nextTask()?.cost || 99) ? 'Restore the garden?' : 'Ready for a game?', 2600); }, 900);
}

// ------------------------------------------------------------------ the garden keeper (Hero Lab: Bao)
let keeper = null;
loadHero(THREE, GLTFLoader, { hero: { char: 'c08', items: {} }, assets: './assets/hero/', height: 2.1, shadows: true }).then(h => {
  keeper = h; h.object.position.set(-4.3, GD.SAND_Y, 6.4); h.object.rotation.y = 0.45; scene.add(h.object);
}).catch(e => console.warn('keeper', e && e.message));
let cheerT = 0;
function heroCheer() { if (!keeper) return; keeper.play('cheer'); cheerT = 2.2; }
let bubbleT = 0;
function bubble(text, ms = 2000) { const b = $('#bubble'); if (!text) { b.classList.remove('on'); bubbleT = 0; return; } b.textContent = text; b.classList.add('on'); bubbleT = ms / 1000; }

// ------------------------------------------------------------------ camera: play view fits the board, home view shows the garden
let mode = 'home', focusT = 0;
const focusAt = new V3();
const cam = { pos: new V3(0, 20, 20), tgt: new V3(), off: 0 }, want = { pos: new V3(0, 20, 20), tgt: new V3(), off: 0 };
const L = { w: innerWidth, h: innerHeight };
const fitCam = new THREE.PerspectiveCamera(34, 1, 0.5, 260);
function fitView(pitch, tgt, pts, rect, yaw = 0) {
  // distance so that pts fit inside rect (px), then a vertical view offset to centre them
  fitCam.aspect = L.w / L.h; fitCam.fov = camera.fov; fitCam.clearViewOffset(); fitCam.updateProjectionMatrix();
  const dirv = new V3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  let d = 20; const pr = new V3();
  const measure = () => { fitCam.position.copy(tgt).addScaledVector(dirv, d); fitCam.lookAt(tgt); fitCam.updateMatrixWorld(); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const p of pts) { pr.copy(p).project(fitCam); const px = (pr.x + 1) / 2 * L.w, py = (1 - pr.y) / 2 * L.h; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); } return { x0, x1, y0, y1 }; };
  for (let it = 0; it < 5; it++) { const m = measure(); d *= Math.max((m.x1 - m.x0) / (rect.x1 - rect.x0), (m.y1 - m.y0) / (rect.y1 - rect.y0)); }
  const m = measure();
  return { pos: tgt.clone().addScaledVector(dirv, d), tgt: tgt.clone(), off: (m.y0 + m.y1) / 2 - (rect.y0 + rect.y1) / 2 };
}
function layout() {
  L.w = innerWidth; L.h = innerHeight;
  R.setSize(L.w, L.h); C.resize(L.w, L.h); camera.aspect = L.w / L.h; camera.updateProjectionMatrix();
  const portrait = L.w / L.h < 0.8;
  if (mode === 'play') {
    const pts = []; const hw = Math.max(bounds.w, portrait ? 4.6 : 7.5) / 2 + 0.25, hd = Math.max(bounds.d, portrait ? 5.5 : 8.5) / 2 + 0.25;   // never zoom in past a mid-size board
    for (const x of [-hw, hw]) for (const z of [-hd, hd]) for (const y of [0, bounds.top]) pts.push(new V3(x, y, z));
    const top = portrait ? 112 : 96, bottom = L.h - (portrait ? 108 : 118);
    const sideW = portrait ? 6 : Math.max(20, (L.w - Math.min(L.w, 760)) / 2);
    const v = fitView(portrait ? 1.0 : 0.92, new V3(0, bounds.top * 0.3, 0), pts, { x0: sideW, x1: L.w - sideW, y0: top, y1: bottom });
    Object.assign(want, v);
  } else {
    // home: the whole court from the front, the board low in the frame, room for the panel below
    const tgt = focusT > 0 ? focusAt.clone() : new V3(0, 0.5, -1);
    const pts = [new V3(-8.5, 0, -7), new V3(8.5, 0, -7), new V3(-8, 0, 8.5), new V3(8, 0, 8.5)];
    const panelH = Math.min(L.h * 0.52, 420);
    const rect = portrait ? { x0: -L.w * 0.02, x1: L.w * 1.02, y0: 170, y1: L.h - panelH + 10 } : { x0: 30, x1: L.w - 460, y0: 120, y1: L.h - 40 };
    const v = fitView(0.6, tgt, pts, rect, 0);
    if (focusT > 0) { v.pos.lerp(tgt, 0.25); }
    Object.assign(want, v);
  }
}
function applyCam(dt, snap = false) {
  const k = snap ? 1 : 1 - Math.exp(-dt * 3.2);
  cam.pos.lerp(want.pos, k); cam.tgt.lerp(want.tgt, k); cam.off += (want.off - cam.off) * k;
  camera.position.copy(cam.pos); camera.lookAt(cam.tgt);
  camera.setViewOffset(L.w, L.h, 0, cam.off, L.w, L.h); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  sun.position.set(cam.tgt.x - 9, 20, cam.tgt.z + 12); sun.target.position.copy(cam.tgt);
}
function worldToScreen(p) { const v = p.clone().project(camera); return { x: (v.x + 1) / 2 * L.w, y: (1 - v.y) / 2 * L.h }; }

// ------------------------------------------------------------------ picking (ray vs tile boxes; topmost hit wins)
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), box = new THREE.Box3(), hitP = new V3();
function pickAt(x, y) {
  ndc.set(x / L.w * 2 - 1, -(y / L.h) * 2 + 1); ray.setFromCamera(ndc, camera);
  let best = -1, bd = 1e9;
  for (const t of Lv.tiles) {
    if (!Lv.alive[t.i]) continue;
    const c = t.base, ly = t.lift;
    box.min.set(c.x - TW / 2, c.y - TH / 2 + ly, c.z - TD / 2); box.max.set(c.x + TW / 2, c.y + TH / 2 + ly, c.z + TD / 2);
    if (ray.ray.intersectBox(box, hitP)) { const d = hitP.distanceTo(ray.ray.origin); if (d < bd) { bd = d; best = t.i; } }
  }
  if (best >= 0) return best;
  // forgiving fallback for fat fingers: nearest free tile top within half a tile
  let fb = -1, fd = 0.6;
  for (const t of Lv.tiles) { if (!Lv.alive[t.i] || !Lv.free[t.i]) continue; const top = t.base.y + TH / 2; const p = ray.ray.at((top - ray.ray.origin.y) / ray.ray.direction.y, hitP); const d = Math.hypot(p.x - t.base.x, (p.z - t.base.z) * 0.8); if (d < fd) { fd = d; fb = t.i; } }
  return fb;
}
R.domElement.addEventListener('pointerdown', e => {
  snd.unlock();
  if (state !== 'play') return;
  const i = pickAt(e.clientX, e.clientY); if (i >= 0) tap(i);
});

// ------------------------------------------------------------------ frame loop
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new V3(), _p = new V3(), _c = new THREE.Color();
const COL = { free: new THREE.Color(1, 1, 1), blocked: new THREE.Color('#d8cfc2'), sel: new THREE.Color('#ffe08a'), hint: new THREE.Color('#b9ffcf'), gold: new THREE.Color('#ffd86a') };
let lastT = performance.now(), perfS = {}, fpsAcc = 0, fpsN = 0;
R.info.autoReset = false;
function frame(now) {
  const dt = Math.min(1 / 20, (now - lastT) / 1000); lastT = now;
  if (state === 'play') {
    if (Lv.intro > 0) Lv.intro -= dt;
    else if (document.visibilityState !== 'hidden') Lv.t += dt;
    if (Lv.comboT > 0) Lv.comboT -= dt;
    if (Lv.hintT > 0) { Lv.hintT -= dt; if (Lv.hintT <= 0) Lv.hint = null; }
    if (Lv.stuckT > 0) { Lv.stuckT -= dt; if (Lv.stuckT <= 0 && !countPairs() && Lv.alive.some(Boolean)) doShuffle(true); }
    paintMeter();
  }
  if (Lv.hop > 0) { const was = Lv.hop; Lv.hop = Math.max(0, Lv.hop - dt); if (was > 0.375 && Lv.hop <= 0.375) applySwap(); }
  updateTiles(dt);
  if (focusT > 0) { focusT -= dt; if (focusT <= 0) layout(); else if (mode === 'home') layout(); }
  applyCam(dt);
  GD.update(dt); PT.update(dt, cam.tgt);
  if (keeper) {
    keeper.object.visible = mode === 'home';
    keeper.mixer.update(dt);
    if (cheerT > 0) { cheerT -= dt; if (cheerT <= 0) keeper.play('idle'); }
  }
  if (bubbleT > 0) {
    bubbleT -= dt; const b = $('#bubble');
    if (keeper && mode === 'home') { const s = worldToScreen(keeper.object.position.clone().add(new V3(0, 2.45, 0))); b.style.left = clamp(s.x, 90, L.w - 90) + 'px'; b.style.top = s.y + 'px'; }
    if (bubbleT <= 0 || mode !== 'home') b.classList.remove('on');
  }
  updSparks(dt); updRings(dt); updateParticles(dt * 60);
  R.info.reset(); C.render(dt); perfS = { calls: R.info.render.calls, tris: R.info.render.triangles };
  fpsAcc += dt; fpsN++;
  requestAnimationFrame(frame);
}
function updateTiles(dt) {
  const tnow = performance.now() / 1000;
  const hopK = Lv.hop > 0 ? Math.sin((1 - Lv.hop / 0.75) * Math.PI) : 0;
  for (const t of Lv.tiles) {
    const i = t.i;
    let y = 0, sc = 1, ry = 0, rz = 0, ox = 0;
    _p.copy(t.base);
    if (t.fly) {
      const f = t.fly; f.t += dt;
      if (f.t < 0.33) { const k = ease(f.t / 0.33); _p.lerpVectors(f.from, f.to, k); _p.y += Math.sin(k * Math.PI) * 0.4; rz = (f.clack ? -1 : 1) * 0.25 * Math.sin(k * Math.PI); }
      else { const k = clamp((f.t - 0.33) / 0.3, 0, 1); _p.copy(f.to); _p.y += k * 0.6; sc = (1 - k) * (1 + Math.sin(k * Math.PI) * 0.35); ry = k * 2.4 * (f.clack ? 1 : -1); }
      if (f.t >= 0.63) { t.fly = null; t.gone = true; }
    } else if (!Lv.alive[i]) { sc = 0; }
    else {
      if (t.drop > 0) { t.drop -= dt; y = 7; if (t.drop <= 0) { t.dropK = 0.0001; } }
      else if (t.dropK > 0 && t.dropK < 1) { t.dropK = Math.min(1, t.dropK + dt / 0.38); const k = t.dropK; y = 7 * Math.pow(1 - k, 2) - Math.sin(k * Math.PI) * 0.0; if (t.dropK >= 1) { t.dropK = 1; if (t.i % 9 === 0) snd.deselect(); } }
      const sel = Lv.sel === i, hint = Lv.hint && (Lv.hint[0] === i || Lv.hint[1] === i);
      const tl = sel ? 0.3 : hint ? 0.12 + Math.sin(tnow * 8) * 0.06 : 0;
      t.lift += (tl - t.lift) * (1 - Math.exp(-dt * 16)); y += t.lift;
      if (t.shake > 0) { t.shake -= dt; ox = Math.sin(t.shake * 60) * t.shake * 0.25; rz = Math.sin(t.shake * 50) * t.shake * 0.12; }
      if (t.pop < 1) { t.pop = Math.min(1, t.pop + dt / 0.35); sc = easeBack(t.pop); }
      if (hopK) { y += hopK * (1.2 + (i % 5) * 0.15); ry += hopK * (i % 2 ? 1 : -1) * 1.2; }
      if (sel) sc *= 1.06;
      // colour: blocked tiles dim, selected warm, hinted glow
      _c.copy(Lv.free[i] ? COL.free : COL.blocked);
      if (Lv.sym[i] === TREASURE) _c.multiply(COL.gold);
      if (sel) _c.copy(COL.sel); else if (hint) _c.lerp(COL.hint, 0.6 + Math.sin(tnow * 8) * 0.3);
      bodies.setColorAt(i, Lv.sym[i] === TREASURE && !sel ? _c : _c); faces.setColorAt(i, sel ? COL.sel : hint ? _c : Lv.free[i] ? COL.free : COL.blocked);
    }
    _p.y += y; _p.x += ox;
    _m.compose(_p, _q.setFromEuler(_e.set(0, ry, rz)), _s.setScalar(Math.max(0.0001, sc)));
    bodies.setMatrixAt(i, _m); faces.setMatrixAt(i, _m);
  }
  bodies.instanceMatrix.needsUpdate = faces.instanceMatrix.needsUpdate = true;
  if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true; if (faces.instanceColor) faces.instanceColor.needsUpdate = true;
}

// ------------------------------------------------------------------ bot (for check.cjs): plays like a careful player
function bot() {
  if (state === 'ready') { autostart(); return; }
  if (state !== 'play' || Lv.intro > 0 || Lv.hop > 0) return;
  if (Lv.sel >= 0) {
    const s = Lv.sym[Lv.sel];
    let j = -1;
    for (const [a, b] of Lv.solution) { if (a === Lv.sel && Lv.alive[b] && Lv.free[b] && Lv.sym[b] === s) j = b; if (b === Lv.sel && Lv.alive[a] && Lv.free[a] && Lv.sym[a] === s) j = a; }
    if (j < 0) for (const t of Lv.tiles) if (t.i !== Lv.sel && Lv.alive[t.i] && Lv.free[t.i] && Lv.sym[t.i] === s) { j = t.i; break; }
    tap(j >= 0 ? j : Lv.sel); return;
  }
  const h = findHint();
  if (h) tap(h[0]);
}
function autostart() {
  if (!booted) return false;
  if (state === 'play') return true;
  if (state === 'won') { ui.els.win.classList.add('hc-hidden'); showHome(); }
  if (state === 'ready') { ui.hideStart(); startLevel({ fresh: false, level: save.level, daily: D.isDaily }); }
  return state === 'play';
}
window.__game = {
  get state() { return state; }, get level() { return Lv.daily ? 'daily' : save.level; }, get score() { return totalStars(); },
  get points() { return Lv.points; }, get tilesLeft() { return Lv.alive.filter(Boolean).length; }, get pairs() { return countPairs(); },
  bot, autostart, start: startLevel, use: useBooster, tap,
  get debug() { return { Lv, save, GD, bounds, want }; },
  get perf() { const r = { ...perfS, fps: fpsN / Math.max(0.001, fpsAcc) }; fpsN = 0; fpsAcc = 0; return r; },
};

// ------------------------------------------------------------------ boot
let booted = false;
addEventListener('resize', () => { layout(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') snd.music(false); else if (state === 'play') snd.music(true); });
refreshBoosters();
showHome();
applyCam(0, true);
booted = true;
requestAnimationFrame(frame);
