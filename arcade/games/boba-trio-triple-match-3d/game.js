// Boba Trio: Triple Match 3D — tap kawaii goodies from a squishy heap on a tufted cushion into a 7-slot tray; three alike
// pop. Clear the cushion before the clock runs out. Stars decorate a café and a dorm nook, every new goodie is a sticker,
// ?daily=1 is today's puzzle with a streak. Mechanic inspired by Triple Match 3D / Match Factory; all code original, art =
// the AGENTPARK kawaii AI 3D library (assets/kawaii). Rendering: kit/cine.js; physics: ./physics.js; money: kit/money.js.
import { THREE, createUI, store, rng, buzz, confetti, updateParticles } from './kit/hc.js';
import { cine } from './kit/cine.js';
import { GLTFLoader } from './kit/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from './kit/addons/geometries/RoundedBoxGeometry.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { money } from './kit/money.js';
import { World } from './physics.js';
import { snd } from './audio.js';
import { ITEMS, BY_ID, PAGES, CHAPTERS, ROOMS, chapterOf } from './items.js';
import * as TX from './tex.js';

const M = money({ game: 'boba-trio', style: 'B' });
const V3 = THREE.Vector3, Q4 = THREE.Quaternion, M4 = THREE.Matrix4;
const NAME = 'Boba Trio: Triple Match 3D';
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const TRAY = 7, BOX = { W: 7, D: 9 }, PITCH = 60 * Math.PI / 180, PILE_S = 1.5, RIM = 1.7;
const BOOST = ['shuffle', 'magnet', 'undo', 'freeze'];
const PRICE = { shuffle: 60, magnet: 90, undo: 60, freeze: 80 };
const BNAME = { shuffle: 'Pinwheel shuffle', magnet: 'Heart magnet', undo: 'Star wand', freeze: 'Rainbow pause' };
const BDESC = { shuffle: 'Tosses the heap so hidden goodies come up.', magnet: 'Pulls a matching trio out of the heap for you.', undo: 'Sends your last pick back to the cushion.', freeze: 'Stops the clock for 10 seconds.' };
const BIMG = { shuffle: 'm10', magnet: 'x03', undo: 'x04', freeze: 'x05' };

// ------------------------------------------------------------------ save
const S = store('bobatrio');
const save = {
  level: S.get('level', 1), stars: S.get('stars', {}), boost: S.get('boost', { shuffle: 2, magnet: 2, undo: 3, freeze: 1 }),
  album: S.get('album', []), pages: S.get('pages', []), decor: S.get('decor', {}), spent: S.get('spent', 0),
  dDone: S.get('dDone', 0), dLast: S.get('dLast', 0), dStreak: S.get('dStreak', 0), freezeWeek: S.get('freezeWeek', ''),
};
const persist = () => { for (const k in save) S.set(k, save[k]); };
const totalStars = () => Object.values(save.stars).reduce((a, b) => a + b, 0) + S.get('dailyStars', 0);
const starBank = () => totalStars() - save.spent;

// ------------------------------------------------------------------ kit layers
const ui = createUI({ title: 'Boba Trio', hint: '', hand: '', progress: false, score: false });
const F = flow('bobatrio');
buildCards();
const D = daily('bobatrio', ui, { name: NAME });
const B = board({ game: 'boba-trio', label: 'Stars won', mode: 'sum', limits: { maxRun: 6, maxPerSec: 2 }, corner: 'tl', accent: '#ff6fb5' });

// ------------------------------------------------------------------ renderer / scene
const R = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
R.domElement.className = 'hc-canvas'; document.body.prepend(R.domElement);
R.setPixelRatio(Math.min(devicePixelRatio, 2)); R.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene(); const bgTex = TX.bokeh(); scene.background = bgTex;
const camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.5, 160);
const C = cine(R, scene, camera, { bloom: 0.22, bloomThreshold: 0.92, bloomRadius: 0.5, exposure: 0.9, envIntensity: 0.55,
  grade: { sat: 1.12, contrast: 1.03, vignette: 0.1, grain: 0, tint: '#fff8fe' } });
const LITE = C.lite;
window.__dbg = { C, scene, R, camera };

const hemi = new THREE.HemisphereLight('#fff4fb', '#b590dc', 0.7); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff6fb', 1.9); sun.position.set(-5, 16, 8); sun.castShadow = true;
sun.shadow.mapSize.set(LITE ? 1024 : 2048, LITE ? 1024 : 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 5;
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 2, far: 45 }); scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight('#ffc8ec', 0.45); fill.position.set(7, 4, 12); scene.add(fill);
const rimL = new THREE.DirectionalLight('#b89bff', 0.6); rimL.position.set(4, 6, -10); scene.add(rimL);

const RB = (w, h, d, r, s = 3) => new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
const jellyMat = (c, o = {}) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.18, ...o });

// ------------------------------------------------------------------ play stage: the cushion
const playG = new THREE.Group(); scene.add(playG);
const itemsG = new THREE.Group(); scene.add(itemsG);
{
  const c = TX.cushion(BOX.W, BOX.D, { rim: RIM, roll: 1.05 });
  const m = new THREE.Mesh(c.geo, new THREE.MeshPhysicalMaterial({ map: c.map, roughness: 0.62, sheen: 1, sheenColor: new THREE.Color('#ffe6ff'), sheenRoughness: 0.45 }));
  m.receiveShadow = true; m.castShadow = false; playG.add(m);
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(c.A * 2.5, c.B * 2.4), new THREE.MeshBasicMaterial({ map: TX.blob(), transparent: true, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = -0.85; playG.add(sh);
}

// ------------------------------------------------------------------ model library (lazy, upright, largest side = 1)
const loader = new GLTFLoader();
const TYPES = {}, SYNC = {};
function loadType(id) {
  if (TYPES[id]) return TYPES[id];
  return TYPES[id] = loader.loadAsync(`assets/${id}.glb`).then(g => {
    let mesh = null; g.scene.updateMatrixWorld(true); g.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
    if (!mesh) return null;
    const geo = mesh.geometry, mat = mesh.material;
    mat.side = THREE.FrontSide; mat.envMapIntensity = 1.0;
    const up = new M4().makeRotationX(Math.PI / 2).multiply(mesh.matrixWorld);
    geo.computeBoundingBox(); const bb = geo.boundingBox.clone().applyMatrix4(up);
    const size = bb.getSize(new V3()), center = bb.getCenter(new V3()), norm = 1 / Math.max(size.x, size.y, size.z);
    const base = new M4().makeScale(norm, norm, norm).multiply(new M4().makeTranslation(-center.x, -center.y, -center.z)).multiply(up);
    size.multiplyScalar(norm);
    const tris = (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
    return SYNC[id] = { id, geo, mat, size, base, tris, pile: null, tray: null };
  }).catch(e => { console.warn('missing model', id, e && e.message); return null; });
}
function meshesFor(t) {
  if (!t.pile) {
    t.pile = new THREE.InstancedMesh(t.geo, t.mat, 9); t.pile.castShadow = true; t.pile.receiveShadow = true;
    t.tray = new THREE.InstancedMesh(t.geo, t.mat, 9);
    for (const m of [t.pile, t.tray]) { m.frustumCulled = false; m.count = 0; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); itemsG.add(m); }
  }
}

// ------------------------------------------------------------------ sparkles (additive points) + ring flashes
const SPN = 400, spPos = new Float32Array(SPN * 3), spCol = new Float32Array(SPN * 3), spV = new Float32Array(SPN * 3), spL = new Float32Array(SPN), spC = new Float32Array(SPN * 3);
const spGeo = new THREE.BufferGeometry(); spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3)); spGeo.setAttribute('color', new THREE.BufferAttribute(spCol, 3));
const starTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(32, 2); x.lineTo(36, 28); x.lineTo(62, 32); x.lineTo(36, 36); x.lineTo(32, 62); x.lineTo(28, 36); x.lineTo(2, 32); x.lineTo(28, 28); x.closePath(); x.fill(); return new THREE.CanvasTexture(c); })();
const sparks = new THREE.Points(spGeo, new THREE.PointsMaterial({ size: 0.24, map: starTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
sparks.frustumCulled = false; scene.add(sparks); spPos.fill(-999);
let spI = 0;
function sparkle(p, color, n = 24, speed = 2.2) {
  const c = new THREE.Color(color);
  for (let k = 0; k < n; k++) {
    const i = spI = (spI + 1) % SPN, a = Math.random() * Math.PI * 2, b = Math.acos(Math.random() * 2 - 1), s = speed * (0.4 + Math.random() * 0.8);
    spPos[i * 3] = p.x; spPos[i * 3 + 1] = p.y; spPos[i * 3 + 2] = p.z;
    spV[i * 3] = Math.sin(b) * Math.cos(a) * s; spV[i * 3 + 1] = Math.cos(b) * s + speed * 0.5; spV[i * 3 + 2] = Math.sin(b) * Math.sin(a) * s;
    const w = Math.random() < 0.35 ? 1 : 0; spC[i * 3] = w ? 1 : c.r; spC[i * 3 + 1] = w ? 1 : c.g; spC[i * 3 + 2] = w ? 1 : c.b; spL[i] = 0.7 + Math.random() * 0.5;
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
const heartTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.strokeStyle = '#fff'; x.lineWidth = 12; x.shadowColor = '#fff'; x.shadowBlur = 14; x.beginPath(); x.arc(64, 64, 46, 0, 7); x.stroke(); return new THREE.CanvasTexture(c); })();
const rings = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: heartTex, color: '#ffd0f0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); m.visible = false; scene.add(m); m.userData.t = 1; return m; });
let ringI = 0;
function ring(p, s = 1, color = '#ffd0f0') { const r = rings[ringI = (ringI + 1) % rings.length]; r.position.copy(p); r.quaternion.copy(camera.quaternion); r.material.color.set(color); r.userData = { t: 0, s }; r.visible = true; }
function updRings(dt) { for (const r of rings) { if (!r.visible) continue; const u = r.userData; u.t += dt * 2.4; if (u.t >= 1) { r.visible = false; continue; } r.scale.setScalar(u.s * (0.3 + ease(u.t) * 1.1)); r.material.opacity = (1 - u.t) * 0.95; } }

// ------------------------------------------------------------------ layout: camera fit, tray + girl in screen space
const L = { w: 0, h: 0, trayY: 0, trayX: 0, slot: 40, wpp: 0.01, dTray: 8, camD: 24, pitch: PITCH, target: new V3(0, 0.3, 0.2) };
const trayG = new THREE.Group(); scene.add(trayG);
const girlG = new THREE.Group(); scene.add(girlG);
let mode = 'home';
function placeCam(d) {
  const t = L.target; camera.position.set(t.x, t.y + Math.sin(L.pitch) * d, t.z + Math.cos(L.pitch) * d); camera.lookAt(t); camera.updateMatrixWorld(); L.camD = d;
}
function fitCamera(pts, top, bottom, availW) {
  const w = L.w, h = L.h, proj = new V3(), availH = bottom - top;
  let d = 24; camera.clearViewOffset();
  for (let it = 0; it < 5; it++) {
    placeCam(d); camera.updateProjectionMatrix();
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const p of pts) { proj.copy(p).project(camera); const px = (proj.x + 1) / 2 * w, py = (1 - proj.y) / 2 * h; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
    d *= Math.max((x1 - x0) / availW, (y1 - y0) / availH);
  }
  placeCam(d); camera.updateProjectionMatrix();
  let y0 = 1e9, y1 = -1e9; for (const p of pts) { proj.copy(p).project(camera); const py = (1 - proj.y) / 2 * h; y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
  camera.setViewOffset(w, h, 0, (y0 + y1) / 2 - (top + bottom) / 2, w, h); camera.updateProjectionMatrix();
}
const _ray = new V3(), _fwd = new V3();
function screenToWorld(px, py, depth, out) {
  _ray.set(px / L.w * 2 - 1, -(py / L.h) * 2 + 1, 0.5).unproject(camera).sub(camera.position).normalize();
  camera.getWorldDirection(_fwd); return out.copy(camera.position).addScaledVector(_ray, depth / _ray.dot(_fwd));
}
function worldToScreen(p) { const v = p.clone().project(camera); return { x: (v.x + 1) / 2 * L.w, y: (1 - v.y) / 2 * L.h }; }
function layout() {
  const w = innerWidth, h = innerHeight; L.w = w; L.h = h;
  R.setSize(w, h); C.resize(w, h); camera.aspect = w / h;
  if (mode === 'home') { layoutHome(); return; }
  const portrait = w / h < 0.8, wide = w >= 700;
  // bottom panel: girl column on the left, tray + boosters on the right (mockup B2)
  const girlW = portrait ? clamp(Math.round(w * 0.26), 92, 130) : 190;
  const slot = portrait ? Math.floor((w - girlW + 12 - 8 - 20) / TRAY) : Math.min(66, Math.floor((Math.min(w, 900) - girlW - 40) / TRAY));
  L.slot = clamp(slot, 32, 66);
  const trayW = L.slot * TRAY + 20, trayH = L.slot + 24, bs = clamp(Math.round(L.slot * 1.45), 52, 68);
  const total = girlW - 12 + trayW, x0 = Math.max(4, (w - total) / 2);
  L.trayX = x0 + girlW - 12 + trayW / 2;
  const boostH = bs + 20, botPad = 12;
  const boostTop = h - botPad - boostH;
  L.trayY = boostTop - 10 - trayH / 2;
  L.girlX = x0 + girlW * 0.44; L.girlH = portrait ? clamp(girlW * 2.25, 210, 290) : clamp(h * 0.42, 300, 400); L.girlFeet = h + L.girlH * (portrait ? 0.16 : 0.06);
  const bst = $('#boosters'); Object.assign(bst.style, { left: (L.trayX - trayW / 2) + 'px', width: trayW + 'px', top: boostTop + 'px', height: boostH + 'px' });
  bst.style.setProperty('--bs', bs + 'px');
  const tk = $('#girlTalk'); tk.style.left = Math.max(4, L.girlX - 30) + 'px'; tk.style.top = (L.girlFeet - L.girlH * 1.02 - 62) + 'px';
  // fit the cushion (bed + most of the rim) above the tray
  const top = 76, bottom = L.trayY - trayH / 2 - 4;
  const ax = BOX.W / 2 + RIM * (portrait ? 0.45 : 0.8), az = BOX.D / 2 + RIM * (portrait ? 0.5 : 0.8), pts = [];
  for (const x of [-1, 1]) for (const z of [-1, 1]) for (const y of [0, 0.9]) pts.push(new V3(x * ax, y, z * az));
  L.pitch = PITCH; L.target.set(0, 0.3, 0.2);
  fitCamera(pts, top, bottom, portrait ? w * 1.0 : Math.min(w - 40, 760));
  L.dTray = L.camD * 0.42; L.wpp = 2 * L.dTray * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / h;
  screenToWorld(L.trayX, L.trayY, L.dTray, trayG.position); trayG.quaternion.copy(camera.quaternion); trayG.scale.setScalar(L.wpp); trayG.updateMatrixWorld(true);
  screenToWorld(L.girlX, L.girlFeet, L.dTray * 0.95, girlG.position); girlG.quaternion.copy(camera.quaternion); girlG.scale.setScalar(L.wpp * 0.95); girlG.updateMatrixWorld(true);
  if (girl.root) { girl.root.scale.setScalar(L.girlH / 1.3); girl.root.position.set(0, 0, 30); girl.root.rotation.set(0, portrait ? 0.25 : 0.12, 0); }
  buildTray();
  if (Lv.world) Lv.world.face = new V3(0, Math.sin(PITCH), Math.cos(PITCH));
}
const trayMat = jellyMat('#d7b6ff', { emissive: '#8a4dff', emissiveIntensity: 0.12 });
const glowMat = new THREE.MeshBasicMaterial({ color: '#f0d8ff' });
const innerMat = new THREE.MeshPhysicalMaterial({ color: '#3a2170', roughness: 0.35, clearcoat: 0.6 });
const wellMat = new THREE.MeshPhysicalMaterial({ color: '#2b1757', roughness: 0.5, clearcoat: 0.4 });
const wellGlow = new THREE.MeshPhysicalMaterial({ color: '#5a2a80', roughness: 0.5, emissive: '#ff4fa8', emissiveIntensity: 0 });
let trayKey = '';
function buildTray() {
  const key = L.slot + ''; if (trayKey === key) return; trayKey = key;
  while (trayG.children.length) { const c = trayG.children.pop(); c.geometry.dispose(); }
  const s = L.slot, w = s * TRAY + 14, h = s + 14;
  const glow = new THREE.Mesh(RB(w + 16, h + 16, 6, 14), glowMat); glow.position.z = -26; trayG.add(glow);
  const frame = new THREE.Mesh(RB(w + 10, h + 10, 22, 12, 4), trayMat); frame.position.z = -16; trayG.add(frame);
  const inner = new THREE.Mesh(RB(w - 2, h - 2, 8, 9), innerMat); inner.position.z = -3; trayG.add(inner);
  trayG.userData.wells = [];
  for (let i = 0; i < TRAY; i++) {
    const wl = new THREE.Mesh(RB(s - 5, s - 2, 4, Math.min(8, s * 0.2)), wellMat); wl.position.set((i - (TRAY - 1) / 2) * s, 0, 1.5); trayG.add(wl);
    trayG.userData.wells.push(wl);
  }
}
function slotWorld(i, out) { return trayG.localToWorld(out.set((i - (TRAY - 1) / 2) * L.slot, -L.slot * 0.04, L.slot * 0.6)); }

// ------------------------------------------------------------------ the girl (k01): cheers you on from the corner
const girl = { root: null, mixer: null, acts: {}, cur: null };
loader.loadAsync('assets/chars/k01.glb').then(g => {
  girl.root = g.scene; g.scene.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = mode === 'home'; if (o.material) o.material.envMapIntensity = 0.9; } });
  girl.mixer = new THREE.AnimationMixer(g.scene);
  g.scene.updateMatrixWorld(true);
  for (const n of ['idle', 'cheer', 'jump', 'wave']) {
    let c = THREE.AnimationClip.findByName(g.animations, n); if (!c) continue;
    // the library's idle clip turns all the way round after ~15%: keep only the front-facing start and ping-pong it
    if (n === 'idle') c = THREE.AnimationUtils.subclip(c, 'rest', 0, Math.max(2, Math.round(c.duration * 0.12 * 30)), 30);
    girl.acts[n] = girl.mixer.clipAction(c);
  }
  girl.mixer.addEventListener('finished', () => girlPlay('idle'));
  (mode === 'home' ? roomG : girlG).add(g.scene); girlPlay('idle');
  if (mode === 'home') placeGirlHome(); else layout();
}).catch(e => console.warn('girl', e && e.message));
function girlPlay(n, once = false) {
  const a = girl.acts[n]; if (!a || !girl.mixer) return;
  if (girl.cur === a && !once) return;
  a.reset(); a.setLoop(once ? THREE.LoopOnce : n === 'idle' ? THREE.LoopPingPong : THREE.LoopRepeat); a.clampWhenFinished = once;
  if (girl.cur && girl.cur !== a) a.crossFadeFrom(girl.cur, 0.25, false);
  a.play(); girl.cur = a;
}
let talkT = 0;
function say(t, ms = 1100) {
  const el = $('#girlTalk'); el.firstElementChild.textContent = t; el.classList.remove('off', 'pop'); void el.offsetWidth; el.classList.add('pop');
  talkT = performance.now() + ms;
}

// ------------------------------------------------------------------ level generation (sawtooth, short Hard every 6th)
const Lv = { n: 1, daily: false, objs: [], tray: [], time: 60, left: 60, frozen: 0, intro: 0, world: null, hist: [], combo: 0, comboT: 0, points: 0, t0: 0, matched: 0, total: 0, recorded: false, revived: 0, extra: 0, token: 0, grid: [], hard: false };
let state = 'ready', loadingLevel = false;
function plan(n) {
  if (n <= 5) return { types: [3, 4, 5, 6, 7][n - 1], items: [9, 12, 18, 21, 24][n - 1], hard: false, time: [90, 100, 120, 130, 140][n - 1] };
  const hard = n % 6 === 0, cyc = (n - 1) % 6;
  const types = clamp(Math.round(6 + n * 0.22 + cyc * 0.3), 6, 16) + (hard ? 3 : 0);
  const items = Math.round(clamp((24 + n * 1.1) * (0.85 + cyc * 0.05), 24, 60) * (hard ? 0.8 : 1));
  return { types: Math.min(types, Math.floor(items / 3)), items, hard, time: null };
}
function genLevel(n, seed, fk) {
  const r = rng(seed * 7919 + 13), P = plan(n);
  const ch = CHAPTERS[chapterOf(n)];
  const all = ITEMS.map(i => i.id), pool = (ch.pool || all).slice();
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const nTypes = P.types;
  let types = shuffle(pool).slice(0, nTypes);
  if (types.length < nTypes) types = types.concat(shuffle(all.filter(i => !types.includes(i))).slice(0, nTypes - types.length));
  const total = n <= 5 ? P.items : Math.round(clamp(P.items * fk, 18, 60) / 3) * 3;
  const copies = Object.fromEntries(types.map(t => [t, 3]));
  let sum = types.length * 3, guard = 0;
  while (sum < total && guard++ < 300) { const t = types[Math.floor(r() * types.length)]; if (copies[t] < 9) { copies[t] += 3; sum += 3; } }
  const time = P.time || Math.round((22 + sum * 2.1 * (P.hard ? 0.88 : 1)) / fk / 5) * 5;
  return { n, types, copies, time, hard: P.hard, seed };
}

// ------------------------------------------------------------------ objects
const _p = new V3(), _s = new V3(), _m = new M4(), _v = new V3(), _up = new V3();
async function startLevel(opt = {}) {
  if (loadingLevel) return; loadingLevel = true;
  snd.unlock();
  const isDaily = opt.daily ?? D.isDaily;
  const n = isDaily ? 14 : (opt.level || save.level);
  if (!isDaily && !opt.free && M.lives().n <= 0) { loadingLevel = false; livesSheet(); return; }
  const seed = isDaily ? D.seed : n * 1009 + 7;
  const G = genLevel(n, seed, isDaily ? 1 : F.k());
  $('#loading').classList.add('on');
  const loaded = await Promise.all(G.types.map(id => loadType(id)));
  $('#loading').classList.remove('on');
  G.types.forEach((id, i) => { if (!loaded[i]) delete G.copies[id]; });
  G.types = G.types.filter((id, i) => loaded[i]);
  for (const id in SYNC) { const t = SYNC[id]; if (t && t.pile) { t.pile.count = 0; t.tray.count = 0; } }
  enterPlay();
  Object.assign(Lv, { n, daily: isDaily, G, tray: [], hist: [], matched: 0, time: G.time, left: G.time, frozen: 0, intro: 1.1, combo: 0, comboT: 0, points: 0,
    recorded: false, beatShown: false, revived: 0, extra: 0, grid: [], hard: G.hard });
  const cnt = Object.values(G.copies).reduce((x, y) => x + y, 0), bw = clamp(3.4 + cnt * 0.085, 4.2, BOX.W);
  Lv.box = { W: bw, D: bw * BOX.D / BOX.W };
  Lv.world = new World({ W: Lv.box.W, D: Lv.box.D, H: 9 }); Lv.world.face = new V3(0, Math.sin(PITCH), Math.cos(PITCH));
  Lv.token++; merges.length = 0; clearBoard();
  const objs = []; const r = rng(seed + 99);
  const ids = []; for (const id of G.types) for (let k = 0; k < G.copies[id]; k++) ids.push(id);
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  const cols = 5, rows = 6, cells = [...Array(cols * rows).keys()];
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  const face = new Q4().setFromAxisAngle(new V3(1, 0, 0), -(Math.PI / 2 - PITCH) * 0.6);
  ids.forEach((id, i) => {
    const t = SYNC[id]; meshesFor(t);
    const sc = PILE_S * (BY_ID[id]?.s || 1);
    const layer = Math.floor(i / (cols * rows)), k = cells[i % (cols * rows)];
    const bx = Lv.box.W - 1.2, bz = Lv.box.D - 1.2;
    const p = new V3(((k % cols) + 0.5) / cols * bx - bx / 2 + (r() - 0.5) * 0.4,
      1.4 + layer * 1.4 + r() * 1.6,
      (Math.floor(k / cols) + 0.5) / rows * bz - bz / 2 + (r() - 0.5) * 0.4);
    const q = new Q4().setFromEuler(new THREE.Euler((r() - 0.5) * 1.6, (r() - 0.5) * 2.2, (r() - 0.5) * 1.4)).premultiply(face);
    const body = Lv.world.add([t.size.x * sc, t.size.y * sc, t.size.z * sc], p, q);
    body.v.set((r() - 0.5) * 2, -3 - r() * 3, (r() - 0.5) * 2); body.w.set((r() - 0.5) * 3, (r() - 0.5) * 3, (r() - 0.5) * 3);
    objs.push({ i, id, t, sc, body, state: 'pile', pos: p.clone(), quat: q.clone(), scl: sc, from: null, tp: 0, squash: 0 });
  });
  Lv.objs = objs; Lv.total = objs.length;
  refreshBoosters(); paintHud();
  state = 'play'; loadingLevel = false; Lv.t0 = performance.now();
  M.level(n); B.start(); snd.whoosh(); snd.music(true);
  girlPlay('wave', true); say(isDaily ? 'Daily time!' : G.hard ? 'Hard one!' : ['Let\'s go!', 'You got this!', 'Boba time!'][n % 3], 1300);
  if (G.hard) toast('Hard level!', true);
  if (n === 1 && !isDaily) setTimeout(showTutorial, 1500);
  setTimeout(() => { const nx = genLevel(n + 1, (n + 1) * 1009 + 7, 1); nx.types.forEach(loadType); }, 2500);
}

// ------------------------------------------------------------------ picking
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), probe = new THREE.Mesh(), hits = [];
function instMatrix(o, out) { _s.setScalar(o.scl); if (o.squash) { const a = Math.sin(o.squash * Math.PI) * 0.22; _s.x *= 1 + a; _s.y *= 1 - a; _s.z *= 1 + a; } return out.compose(o.pos, o.quat, _s).multiply(o.t.base); }
function pickAt(x, y) {
  ndc.set(x / L.w * 2 - 1, -(y / L.h) * 2 + 1); ray.setFromCamera(ndc, camera);
  const cands = [];
  for (const o of Lv.objs) {
    if (o.state !== 'pile') continue;
    const d2 = ray.ray.distanceSqToPoint(o.pos), rr = o.body.R * 1.05;
    if (d2 < rr * rr) cands.push({ o, along: _v.subVectors(o.pos, ray.ray.origin).dot(ray.ray.direction), d2 });
  }
  cands.sort((a, b) => a.along - b.along);
  let best = null, bestD = 1e9;
  for (const c of cands.slice(0, 10)) {
    probe.geometry = c.o.t.geo; probe.material = c.o.t.mat; instMatrix(c.o, probe.matrixWorld);
    hits.length = 0; probe.raycast(ray, hits);
    for (const h of hits) if (h.distance < bestD) { bestD = h.distance; best = c.o; }
  }
  if (best) return best;
  let fb = null, fd = 1e9; for (const c of cands) { const s = c.d2 + c.along * 0.01; if (c.d2 < (c.o.body.R * 0.75) ** 2 && s < fd) { fd = s; fb = c.o; } }
  return fb;
}
R.domElement.addEventListener('pointerdown', e => {
  snd.unlock();
  if (state !== 'play' || mode !== 'play' || paused()) return;
  const o = pickAt(e.clientX, e.clientY); if (o) { document.querySelector('.tut')?.remove(); take(o); }
});

// ------------------------------------------------------------------ tray logic
function trayCounts() { const c = {}; for (const o of Lv.tray) c[o.id] = (c[o.id] || 0) + 1; return c; }
function take(o) {
  if (state !== 'play' || o.state !== 'pile') return false;
  if (Lv.tray.length >= TRAY) { snd.deny(); buzz(30); shakeTray(); return false; }
  Lv.world.remove(o.body);
  let idx = -1; for (let i = Lv.tray.length - 1; i >= 0; i--) if (Lv.tray[i].id === o.id) { idx = i + 1; break; }
  if (idx < 0) idx = Lv.tray.length;
  Lv.tray.splice(idx, 0, o);
  o.state = 'fly'; o.tp = 0; o.from = { pos: o.pos.clone(), quat: o.quat.clone(), scl: o.scl };
  Lv.hist.push(o);
  sparkle(o.pos, '#ffffff', 8, 1.4);
  snd.pick(Lv.tray.length); buzz(8);
  if (Lv.tray.length === TRAY - 2 && !Object.values(trayCounts()).some(v => v % 3 === 2)) say('Careful!', 900);
  return true;
}
let trayShake = 0;
function shakeTray() { trayShake = 0.35; }
const dispQ = new Q4().setFromAxisAngle(new V3(1, 0, 0), 0.22);
const merges = [];
function checkMatches() {
  const byType = {};
  for (const o of Lv.tray) if (o.state === 'tray') (byType[o.id] = byType[o.id] || []).push(o);
  for (const id in byType) if (byType[id].length >= 3) { matchSet(byType[id].slice(0, 3)); return true; }
  return false;
}
function matchSet(set, viaMagnet = false) {
  const mid = set[1] || set[0];
  const center = viaMagnet ? screenToWorld(L.trayX, L.trayY - L.slot * 1.6, L.dTray, new V3()) : mid.pos.clone();
  for (const o of set) { const k = Lv.tray.indexOf(o); if (k >= 0) Lv.tray.splice(k, 1); o.state = 'merge'; o.tp = 0; o.from = { pos: o.pos.clone(), quat: o.quat.clone(), scl: o.scl }; }
  merges.push({ set, t: 0, center, id: set[0].id, magnet: viaMagnet });
}
const TINT = {};
function sampleTint(id) {
  if (TINT[id]) return; const im = new Image(); im.src = `assets/thumbs/${id}.webp`;
  im.onload = () => { try { const c = document.createElement('canvas'); c.width = c.height = 16; const x = c.getContext('2d'); x.drawImage(im, 0, 0, 16, 16); const d = x.getImageData(0, 0, 16, 16).data; let r = 0, g = 0, b = 0, n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; } if (n) TINT[id] = new THREE.Color(r / n / 255, g / n / 255, b / n / 255).offsetHSL(0, 0.25, 0.08).getStyle(); } catch (e) {} };
}
ITEMS.forEach(i => sampleTint(i.id));
function finishMerge(m) {
  for (const o of m.set) o.state = 'gone';
  Lv.combo = Lv.comboT > 0 ? Lv.combo + 1 : 0; Lv.comboT = 3.2; Lv.matched += 3;
  Lv.points += 10 * (1 + Lv.combo); Lv.grid.push(Lv.combo);
  snd.match(Lv.combo); buzz([10, 30, 14]);
  const col = TINT[m.id] || '#ffb3e0';
  sparkle(m.center, col, 36, 2.6); sparkle(m.center, '#ffffff', 14, 1.6); ring(m.center, L.slot * L.wpp * 1.5, col);
  if (Lv.combo >= 1) toast(['Sweet!', 'Yummy!', 'So cute!', 'Kawaii!', 'Boba-licious!'][Math.min(4, Lv.combo - 1)] + (Lv.combo >= 2 ? ` x${Lv.combo + 1}` : ''));
  if (Math.random() < 0.55 || Lv.combo >= 1) { say(['Yay!', 'Cute!', 'Sweet!', 'Yum!', 'Wow!', 'Nice!'][(Math.random() * 6) | 0]); if (Lv.combo >= 1 || Math.random() < 0.4) girlPlay(Lv.combo >= 2 ? 'jump' : 'cheer', true); }
  if (!save.album.includes(m.id)) { save.album.push(m.id); persist(); const tok = Lv.token; setTimeout(() => { if (tok === Lv.token) stickerToast(m.id); }, 450); }
  paintHud();
  if (D.beaten(Lv.points) && !Lv.beatShown) { Lv.beatShown = true; toast('BEATEN!'); confetti(scene, m.center, 40); }
  if (Lv.matched >= Lv.total && state === 'play') setTimeout(() => { if (state === 'play' && Lv.matched >= Lv.total) winLevel(); }, 250);
}

// ------------------------------------------------------------------ boosters
function refreshBoosters() { for (const b of document.querySelectorAll('.bst')) { const n = save.boost[b.dataset.k] || 0; b.querySelector('b').textContent = n || '+'; b.classList.toggle('zero', !n); } }
function shakeBtn(k) { const btn = document.querySelector(`.bst[data-k=${k}]`); btn.classList.remove('shake'); void btn.offsetWidth; btn.classList.add('shake'); snd.deny(); }
function useBooster(k, fromBot = false) {
  if (state !== 'play' || paused()) return false;
  if (!(save.boost[k] > 0)) { if (fromBot) return false; boosterSheet(k); return false; }
  let ok = false;
  if (k === 'undo') ok = doUndo();
  if (k === 'magnet') ok = doMagnet();
  if (k === 'shuffle') ok = doShuffle();
  if (k === 'freeze') ok = doFreeze();
  if (!ok) { shakeBtn(k); return false; }
  save.boost[k]--; persist(); refreshBoosters(); return true;
}
for (const b of document.querySelectorAll('.bst')) { b.addEventListener('pointerdown', e => e.stopPropagation()); b.addEventListener('click', e => { e.stopPropagation(); snd.unlock(); useBooster(b.dataset.k); }); }
function doUndo() {
  for (let i = Lv.hist.length - 1; i >= 0; i--) {
    const o = Lv.hist[i]; if (!Lv.tray.includes(o) || o.state !== 'tray') continue;
    Lv.hist.splice(i, 1); Lv.tray.splice(Lv.tray.indexOf(o), 1);
    o.state = 'return'; o.tp = 0; o.from = { pos: o.pos.clone(), quat: o.quat.clone(), scl: o.scl };
    o.to = new V3((Math.random() - 0.5) * 3, 4.5, (Math.random() - 0.5) * 3);
    snd.undo(); sparkle(o.pos, '#ffe27a', 20, 2); return true;
  }
  return false;
}
function doMagnet() {
  const pileBy = {};
  for (const o of Lv.objs) if (o.state === 'pile') (pileBy[o.id] = pileBy[o.id] || []).push(o);
  let best = null, bs = -1;
  for (const id in pileBy) {
    const inTray = Lv.tray.filter(o => o.id === id && o.state === 'tray').length;
    if (inTray + pileBy[id].length < 3) continue;
    const s = inTray * 10 + Math.random(); if (s > bs) { bs = s; best = id; }
  }
  if (!best) return false;
  const fromTray = Lv.tray.filter(o => o.id === best && o.state === 'tray').slice(0, 3);
  const pile = pileBy[best].sort((a, b) => b.pos.y - a.pos.y).slice(0, 3 - fromTray.length);
  for (const o of pile) Lv.world.remove(o.body);
  matchSet(fromTray.concat(pile), true);
  snd.magnet(); buzz(20); say('Magnet!', 800);
  return true;
}
function doShuffle() {
  const W = Lv.world; let n = 0;
  for (const o of Lv.objs) if (o.state === 'pile') { const b = o.body; W.wake(b); b.rt = 2.5; b.v.set((Math.random() - 0.5) * 5, 7 + Math.random() * 5, (Math.random() - 0.5) * 5); b.w.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12); n++; }
  if (!n) return false;
  snd.whoosh(); shake = 0.4; buzz(25); return true;
}
function doFreeze() { if (Lv.frozen > 0) return false; Lv.frozen = 10; $('#frost').classList.add('on'); $('#timeBox').classList.add('ice'); snd.freeze(); say('Time out!', 900); return true; }
function boosterSheet(k) {
  const price = PRICE[k], have = M.coins();
  const w = sheet(`<div class="sh-ic"><img src="assets/thumbs/${BIMG[k]}.webp" alt=""></div><h3>${BNAME[k]}</h3><p>${BDESC[k]}</p>
    ${have >= price ? `<button class="big gold" data-a="buy">Buy 1 for <img src="assets/thumbs/x02.webp" alt="">${price}</button>`
      : k === 'magnet' ? `<button class="big green" data-a="ad">▶ Watch a video: +1 magnet</button>`
      : `<button class="big pink" data-a="shop">Get coins</button><p class="small">You have ${have} coins · win levels to earn more</p>`}
    <button class="x" data-a="x">Not now</button>`);
  w.addEventListener('click', async e => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'x') { closeSheet(w); return; }
    if (a === 'buy') { if (M.spend(price, 'booster:' + k)) { save.boost[k] = (save.boost[k] || 0) + 1; persist(); refreshBoosters(); snd.coin(); closeSheet(w); } return; }
    if (a === 'shop') { closeSheet(w); openShop(); return; }
    if (a === 'ad') { closeSheet(w); if (await M.rewarded('hint', { what: '1 Heart magnet (pulls a matching trio for you)' })) { save.boost.magnet = (save.boost.magnet || 0) + 1; persist(); refreshBoosters(); toast('+1 Magnet', true); snd.coin(); } }
  });
}

// ------------------------------------------------------------------ HUD
function paintHud() {
  $('#lvl').textContent = Lv.daily ? '★' : Lv.n;
  $('#lvlTag').textContent = Lv.daily ? 'DAILY' : Lv.hard ? 'HARD' : 'LEVEL';
  $('#lvlBadge').classList.toggle('hard', !!Lv.hard);
  $('#pts').textContent = Lv.points;
  const n = save.level, left = Lv.daily ? 0 : (5 - (n % 5)) % 5;
  $('#chestN').textContent = left === 0 ? '!' : left; $('#chest').classList.toggle('ready', left === 0 && !Lv.daily);
  paintTime();
}
let lastSec = -1;
function paintTime() {
  const s = Math.max(0, Math.ceil(Lv.left)); $('#time').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  $('#timeBox').classList.toggle('low', s <= 10 && Lv.frozen <= 0 && state === 'play');
  if (s !== lastSec && s <= 5 && s > 0 && state === 'play' && Lv.frozen <= 0 && !paused()) snd.tick(); lastSec = s;
}
let toastEl = null;
function toast(t, small = false) { if (toastEl) toastEl.remove(); const d = toastEl = document.createElement('div'); d.className = 'toast' + (small ? ' small' : ''); d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 1000); }
function stickerToast(id) {
  if (state !== 'play') return;
  snd.sticker();
  const d = document.createElement('div'); d.className = 'stk'; d.innerHTML = `<img src="assets/thumbs/${id}.webp" alt=""><div><small>NEW STICKER</small>${BY_ID[id]?.name || ''}</div>`;
  document.body.appendChild(d); setTimeout(() => d.remove(), 2200);
}
$('#pause').addEventListener('pointerdown', e => e.stopPropagation());
$('#pause').addEventListener('click', () => { if (state === 'play') pauseSheet(); });
$('#chest').addEventListener('pointerdown', e => e.stopPropagation());
$('#chest').addEventListener('click', () => { const left = (5 - (save.level % 5)) % 5; toast(left ? `Gift chest in ${left} level${left > 1 ? 's' : ''}` : 'Win this level: gift chest!', true); });
function showTutorial() {
  if (state !== 'play' || Lv.n !== 1) return;
  const cnt = {}; for (const o of Lv.objs) if (o.state === 'pile') cnt[o.id] = (cnt[o.id] || 0) + 1;
  const o = Lv.objs.filter(o => o.state === 'pile').sort((a, b) => b.pos.y - a.pos.y)[0]; if (!o) return;
  const p = worldToScreen(o.pos);
  const h = document.createElement('div'); h.className = 'tut'; h.innerHTML = `<div class="hand" style="left:${p.x}px;top:${p.y}px">👆</div><div class="tut-t">Tap 3 alike to match!</div>`;
  document.body.appendChild(h); setTimeout(() => h.remove(), 6000);
}

// ------------------------------------------------------------------ pause + sheets (the clock stops while any sheet is open)
let sheetN = 0, adOn = false, pauseMenu = false;
const paused = () => sheetN > 0 || adOn || pauseMenu || !!document.querySelector('.sh-wrap');
function sheet(html, cls = '') {
  const w = document.createElement('div'); w.className = 'sh-wrap ' + cls; w.innerHTML = `<div class="sh">${html}</div>`;
  w.addEventListener('pointerdown', e => { e.stopPropagation(); if (e.target === w) closeSheet(w); });
  document.body.appendChild(w); snd.tap(); return w;
}
function closeSheet(w) { w.remove(); }
async function openShop() { sheetN++; try { await M.shop(); } finally { sheetN--; } }
function pauseSheet() {
  const w = sheet(`<h3>Paused</h3><p>${Lv.daily ? 'Daily puzzle' : `Level ${Lv.n}`} · ${Lv.total - Lv.matched} goodies left</p>
    <button class="big green" data-a="go">Keep playing</button>
    <div class="row2"><button class="big lil" data-a="snd">${snd.muted ? '🔇 Sound off' : '🔊 Sound on'}</button><button class="big lil" data-a="shop">🛍️ Shop</button></div>
    <button class="x" data-a="home">${Lv.daily ? 'Leave daily puzzle' : 'Leave level (uses a life)'}</button>`);
  w.addEventListener('click', e => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'go') closeSheet(w);
    if (a === 'snd') { snd.toggle(); paintMute(); e.target.closest('button').textContent = snd.muted ? '🔇 Sound off' : '🔊 Sound on'; }
    if (a === 'shop') { closeSheet(w); openShop(); }
    if (a === 'home') { closeSheet(w); failAndLeave(); showHome(); }
  });
}
addEventListener('ap:ad', e => { const ph = e.detail && e.detail.phase; if (ph === 'start') { adOn = true; snd.music(false); } else if (ph === 'end') { adOn = false; if (state === 'play' && mode === 'play') snd.music(true); } });

// ------------------------------------------------------------------ win / lose
function starsFor() { const f = Lv.left / Lv.time; return f >= 0.45 ? 3 : f >= 0.2 ? 2 : 1; }
function record(won) {
  if (Lv.recorded) return; Lv.recorded = true;
  F.level(won, Lv.total ? Lv.matched / Lv.total : 0);
}
let winCoins = 0;
const ymd = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const addDays = k => { const d = new Date(); d.setDate(d.getDate() + k); return d; };
function isoWeek(d = new Date()) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return t.getUTCFullYear() + '-' + Math.ceil(((t - y0) / 864e5 + 1) / 7); }
function winLevel() {
  if (state !== 'play') return; state = 'won'; record(true); document.querySelector('.tut')?.remove(); document.querySelectorAll('.stk').forEach(e => setTimeout(() => e.remove(), 500));
  const stars = starsFor(), ms = performance.now() - Lv.t0;
  Lv.points += Math.round(Lv.left) * 2;
  let gained = 0; const rewards = [];
  if (Lv.daily) {
    const today = D.seed;
    if (save.dDone !== today) {
      save.dDone = today; gained = stars; S.set('dailyStars', S.get('dailyStars', 0) + stars);
      const yd = ymd(addDays(-1)), yd2 = ymd(addDays(-2)), wk = isoWeek();
      if (save.dLast === yd) save.dStreak++;
      else if (save.dLast === yd2 && save.freezeWeek !== wk) { save.dStreak++; save.freezeWeek = wk; rewards.push('<span>❄️ Streak freeze saved you</span>'); }
      else save.dStreak = 1;
      save.dLast = today;
    }
  } else {
    const old = save.stars[Lv.n] || 0; if (stars > old) { gained = stars - old; save.stars[Lv.n] = stars; }
    if (Lv.n === save.level) {
      save.level++;
      const k = BOOST[(Lv.n - 1) % 4]; save.boost[k] = (save.boost[k] || 0) + 1; rewards.push(`<span><img src="assets/thumbs/${BIMG[k]}.webp" alt="">+1</span>`);
      if (Lv.n % 5 === 0) { for (const b of BOOST) save.boost[b]++; M.add(50, 'chest'); rewards.push(`<span><img src="assets/thumbs/x01.webp" alt="">Gift chest!</span>`); }
    }
  }
  winCoins = (Lv.hard ? 40 : 20) + stars * 5 + (Lv.daily ? 30 : 0);
  M.add(winCoins, Lv.daily ? 'daily-win' : 'level-win');
  persist();
  if (gained > 0) B.submit(gained, { ms });
  D.won(Lv.points);
  snd.win(); buzz([20, 40, 20]); girlPlay('jump', true); say(['Amazing!', 'We did it!', 'So cute!', 'Perfect!'][(Math.random() * 4) | 0], 1600);
  confetti(scene, new V3(0, 3, 0), 80);
  for (let k = 0; k < 4; k++) setTimeout(() => sparkle(new V3((Math.random() - 0.5) * 5, 2.5, (Math.random() - 0.5) * 6), ['#ffd36b', '#ff8db6', '#7fe0c1', '#c9a2ff'][k], 40, 3.5), k * 150);
  const w = ui.els.win;
  w.querySelector('h1').textContent = Lv.daily ? 'Daily done!' : Lv.hard ? 'Hard cleared!' : 'Sweet!';
  w.querySelector('.stars').innerHTML = [0, 1, 2].map(() => `<i>${STAR_SVG}</i>`).join('');
  w.querySelector('.reward').innerHTML = `<span><img src="assets/thumbs/x02.webp" alt=""><b id="wc">+${winCoins}</b></span>` + rewards.join('');
  const dbl = w.querySelector('#dbl'); dbl.disabled = false; dbl.innerHTML = `▶ Double coins<small>watch a video</small>`;
  w.querySelector('#grid').classList.toggle('hc-hidden', !Lv.daily);
  w.querySelector('#streakL').textContent = Lv.daily ? `🔥 Daily streak ${save.dStreak}` : '';
  shareBtn && shareBtn.classList.toggle('hc-hidden', Lv.daily);
  ui.win(Lv.daily ? '★' : Lv.n, Lv.daily ? `Score ${Lv.points}` : `Score ${Lv.points} · ${CHAPTERS[chapterOf(Lv.n)].name}`);
  setTimeout(() => { const st = w.querySelectorAll('.stars i'); for (let k = 0; k < stars; k++) setTimeout(() => { st[k].classList.add('on'); snd.star(k); buzz(10); }, 250 + k * 300); }, 650);
  setTimeout(() => { $('#hud').classList.add('off'); $('#boosters').classList.add('off'); snd.music(false); }, 600);
}
let loseKind = '';
function loseLevel(kind) {
  if (state !== 'play') return; state = 'lost'; loseKind = kind; document.querySelector('.tut')?.remove();
  snd.lose(); buzz([40, 60, 40]); shakeTray(); girlPlay('idle'); say(kind === 'time' ? 'Oh no!' : 'Too full!', 1400);
  const l = ui.els.lose, off = l.querySelector('.offer');
  off.innerHTML = '';
  // one offer, and never in the first 1.2 s after losing
  if (Lv.revived < 2) setTimeout(() => {
    if (state !== 'lost') return;
    off.innerHTML = kind === 'time' ? '<button class="hc-btn" id="more">▶ +30 seconds<small>watch a video</small></button>' : '<button class="hc-btn" id="rev">▶ Put 3 back<small>watch a video</small></button>';
    const b = off.firstElementChild; b.addEventListener('pointerdown', e => e.stopPropagation());
    b.addEventListener('click', async e => { e.stopPropagation(); b.disabled = true; if (!(await revive(kind))) b.disabled = false; });
  }, 1300);
  ui.lose(kind === 'time' ? 'Time\'s up!' : 'Tray full!', kind === 'time' ? `${Lv.total - Lv.matched} goodies to go` : 'Plan your triples and try again');
  l.querySelector('.sad').src = `assets/thumbs/${Lv.tray[0]?.id || 't01'}.webp`;
  setTimeout(() => { $('#boosters').classList.add('off'); $('#hud').classList.add('off'); snd.music(false); }, 600);
}
async function revive(kind) {
  const ok = kind === 'time' ? await M.rewarded('moves', { what: '+30 seconds on the clock', title: '+30 seconds' }) : await M.rewarded('revive', { what: 'The last 3 goodies go back to the cushion' });
  if (!ok || state !== 'lost') return false;
  ui.els.lose.classList.add('hc-hidden');
  state = 'play'; Lv.revived++;
  $('#boosters').classList.remove('off'); $('#hud').classList.remove('off'); snd.music(true);
  if (kind === 'time') { Lv.left += 30; Lv.time = Math.max(Lv.time, Lv.left); toast('+30 seconds!', true); }
  else for (let k = 0; k < 3; k++) doUndoAny();
  say('Second chance!', 1200); girlPlay('cheer', true);
  return true;
}
function doUndoAny() {
  const o = Lv.tray[Lv.tray.length - 1]; if (!o) return;
  Lv.tray.pop(); const hi = Lv.hist.indexOf(o); if (hi >= 0) Lv.hist.splice(hi, 1);
  o.state = 'return'; o.tp = 0; o.from = { pos: o.pos.clone(), quat: o.quat.clone(), scl: o.scl };
  o.to = new V3((Math.random() - 0.5) * 4, 4 + Math.random(), (Math.random() - 0.5) * 4);
}
function failAndLeave() {
  if (state === 'won') return;
  record(false); if (!Lv.daily) M.useLife();
  state = 'ready';
}
ui.onTap(which => {
  snd.unlock();
  if (which === 'win') { afterWin(); return; }
  if (which === 'lose') {
    failAndLeave(); clearBoard();
    if (!Lv.daily && M.lives().n <= 0) { showHome(); livesSheet(); return; }
    startLevel({ level: Lv.n, daily: Lv.daily });
  }
});
async function afterWin() {
  state = 'ready'; clearBoard();
  await M.breakAd('level-end', { level: Lv.n });
  showHome(true);
}
function clearBoard() { $('#frost').classList.remove('on'); $('#timeBox').classList.remove('ice', 'low'); merges.length = 0; }

// ------------------------------------------------------------------ cards
const STAR_SVG = '<svg viewBox="0 0 64 64"><path d="M32 4l8.2 17.6 19.3 2.3-14.2 13.2 3.7 19.1L32 46.6 15 56.2l3.7-19.1L4.5 23.9l19.3-2.3z" fill="#ffd23f" stroke="#c4247e" stroke-width="4" stroke-linejoin="round"/><path d="M24 22l8-14 3 12z" fill="#fff" opacity=".6"/></svg>';
let shareBtn = null;
function buildCards() {
  ui.els.win.id = 'winCard'; ui.els.lose.id = 'loseCard'; ui.els.start.id = 'startCard';
  const w = ui.els.win;
  w.querySelector('h1').insertAdjacentHTML('afterend', '<div class="burst"></div><div class="stars"></div><div class="reward"></div><p id="streakL"></p><div class="btnrow"><button class="hc-btn dbl" id="dbl"></button><button class="hc-btn grid hc-hidden" id="grid">Share grid</button></div>');
  w.querySelector('.hint').textContent = 'Tap to continue';
  const dbl = w.querySelector('#dbl');
  dbl.addEventListener('pointerdown', e => e.stopPropagation());
  dbl.addEventListener('click', async e => { e.stopPropagation(); dbl.disabled = true; if (await M.rewarded('double', { what: `${winCoins * 2} coins instead of ${winCoins}` })) { M.add(winCoins, 'double'); $('#wc').textContent = '+' + winCoins * 2; dbl.innerHTML = '✓ Doubled!'; snd.coin(); } else dbl.disabled = false; });
  const gb = w.querySelector('#grid');
  gb.addEventListener('pointerdown', e => e.stopPropagation());
  gb.addEventListener('click', e => { e.stopPropagation(); shareGrid(); });
  const l = ui.els.lose;
  l.querySelector('h1').insertAdjacentHTML('beforebegin', '<img class="sad" alt="">');
  l.querySelector('[data-x]').insertAdjacentHTML('afterend', '<div class="offer"></div>');
  l.querySelector('.hint').textContent = 'Tap to try again';
  setTimeout(() => { shareBtn = [...w.querySelectorAll('.hc-btn')].find(b => b.textContent === 'Share'); if (shareBtn) w.querySelector('.btnrow').appendChild(shareBtn); }, 0);
}
function shareGrid() {
  const st = starsFor();
  const row = Lv.grid.map(c => c >= 2 ? '💖' : c === 1 ? '🩷' : '🟪');
  const lines = []; for (let i = 0; i < row.length; i += 8) lines.push(row.slice(i, i + 8).join(''));
  const d = new Date(), text = `Boba Trio Daily ${d.getMonth() + 1}/${d.getDate()} ${'⭐'.repeat(st)}\n${lines.join('\n')}\n🧋 ${Lv.points} · 🔥${save.dStreak}`;
  const url = location.origin + location.pathname + '?daily=1';
  if (navigator.share) navigator.share({ title: NAME, text, url }).catch(() => {});
  else navigator.clipboard?.writeText(`${text}\n${url}`).then(() => toast('Copied!', true)).catch(() => {});
}
function livesSheet() {
  const Lf = M.lives(), mins = Math.max(0, Math.ceil((Lf.nextAt - Date.now()) / 60000));
  const w = sheet(`<div class="sh-ic"><img src="assets/thumbs/m01.webp" alt=""></div><h3>Out of hearts</h3><p>Next heart in ${mins} min. The daily puzzle is always free.</p>
    <button class="big green" data-a="ad">▶ Watch a video: full hearts</button><button class="x" data-a="daily">Play the daily puzzle</button>`);
  w.addEventListener('click', async e => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return; closeSheet(w);
    if (a === 'ad') { if (await M.rewarded('lives')) { paintTop(); toast('Hearts full!', true); } }
    if (a === 'daily') location.search = '?daily=1';
  });
}
function openAlbum() {
  let page = 0;
  const w = sheet('', 'album');
  const draw = () => {
    const pg = PAGES[page], got = pg.items.filter(g => save.album.includes(g.id)).length, done = got === pg.items.length, claimed = save.pages.includes(pg.key);
    w.querySelector('.sh').innerHTML = `<h3>Sticker album</h3><div class="tabs">${PAGES.map((s, i) => `<button data-p="${i}" class="${i === page ? 'on' : ''}">${s.name}</button>`).join('')}</div>
      <p>${got}/${pg.items.length} stickers · fill the page for 150 coins</p>
      <div class="stickers">${pg.items.map(g => `<div class="st ${save.album.includes(g.id) ? 'got' : ''}"><img src="assets/thumbs/${g.id}.webp" alt=""><span>${save.album.includes(g.id) ? g.name : '?'}</span></div>`).join('')}</div>
      ${done && !claimed ? '<button class="big gold" data-a="claim">Claim 150 coins</button>' : claimed ? '<p class="small">Page complete ✓</p>' : ''}<button class="x" data-a="x">Close</button>`;
  };
  draw();
  w.addEventListener('click', e => {
    const p = e.target.closest('[data-p]'); if (p) { page = +p.dataset.p; snd.tap(); draw(); return; }
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'x') closeSheet(w);
    if (a === 'claim') { save.pages.push(PAGES[page].key); persist(); M.add(150, 'album'); snd.coin(); confetti(scene, new V3(0, 3, 0), 40); draw(); }
  });
}

// ------------------------------------------------------------------ home: decorate the Boba Café / Dorm Nook with stars
const roomG = new THREE.Group(); scene.add(roomG); roomG.visible = false;
const roomMats = { floor: new THREE.MeshStandardMaterial({ roughness: 0.45 }), wall: new THREE.MeshStandardMaterial({ roughness: 0.85 }), trim: jellyMat('#ffffff', { roughness: 0.35 }) };
const DECOR = {};
let curRoom = null, nextRing = null, ghost = null;
{
  const fl = new THREE.Mesh(RB(9.6, 0.5, 9, 0.2), roomMats.floor); fl.position.y = -0.25; fl.receiveShadow = true; roomG.add(fl);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 6.2), roomMats.wall); back.position.set(0, 3.1, -4.5); back.receiveShadow = true; roomG.add(back);
  const left = new THREE.Mesh(new THREE.PlaneGeometry(9, 6.2), roomMats.wall); left.position.set(-4.8, 3.1, 0); left.rotation.y = Math.PI / 2; left.receiveShadow = true; roomG.add(left);
  for (const [w, x, z, ry] of [[9.6, 0, -4.42, 0], [9, -4.72, 0, Math.PI / 2]]) { const b = new THREE.Mesh(RB(w, 0.45, 0.14, 0.05), roomMats.trim); b.position.set(x, 0.22, z); b.rotation.y = ry; roomG.add(b); }
  // window with a pink sunset glow on the left wall
  const win = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.4), new THREE.MeshBasicMaterial({ color: '#ffd6f0' })); win.position.set(-4.76, 3.3, -1.0); win.rotation.y = Math.PI / 2; roomG.add(win);
  for (const [w, h, y, z] of [[0.18, 2.7, 3.3, -2.35], [0.18, 2.7, 3.3, 0.35], [0.18, 0.18, 4.6, -1.0], [0.18, 0.18, 2.0, -1.0], [0.12, 2.4, 3.3, -1.0]]) {
    const f = new THREE.Mesh(RB(0.16, h, h > 1 ? 0.18 : 2.9, 0.06), roomMats.trim); f.position.set(-4.7, y, z); roomG.add(f);
  }
  // neon heart sign (bloom catches it)
  const hs = new THREE.Shape(); hs.moveTo(0, -0.55); hs.bezierCurveTo(-1.1, 0.1, -0.6, 0.85, 0, 0.35); hs.bezierCurveTo(0.6, 0.85, 1.1, 0.1, 0, -0.55);
  const pts = hs.getSpacedPoints(60).map(p => new V3(p.x, p.y, 0));
  const neon = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 80, 0.06, 8, true), new THREE.MeshBasicMaterial({ color: '#ff7ad1' }));
  neon.scale.setScalar(1.2); neon.position.set(-1.6, 4.2, -4.4); roomG.add(neon);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.8), new THREE.MeshBasicMaterial({ map: TX.blob(), color: '#ff7ad1', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })); glow.position.set(-1.6, 4.2, -4.45); roomG.add(glow);
  // string lights along the top of the walls (bloom makes them twinkle)
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' }), 34);
  const bc = [new THREE.Color('#ffe9a8'), new THREE.Color('#ff9fd8'), new THREE.Color('#b9f2ff')], mm = new M4();
  for (let i = 0; i < 34; i++) {
    const t = i / 33, onBack = t > 0.42, u = onBack ? (t - 0.42) / 0.58 : t / 0.42;
    const x = onBack ? -4.7 + u * 9.4 : -4.7, z = onBack ? -4.4 : 4.2 - u * 8.6, y = 5.3 - Math.sin(u * Math.PI * (onBack ? 3 : 2)) ** 2 * 0.35;
    bulbs.setMatrixAt(i, mm.makeTranslation(onBack ? x : -4.68, y, z)); bulbs.setColorAt(i, bc[i % 3]);
  }
  roomG.add(bulbs);
  // a menu board and a little shelf of boba on the back wall, so the room never starts empty
  const mc = document.createElement('canvas'); mc.width = 512; mc.height = 340; const mx = mc.getContext('2d');
  mx.fillStyle = '#ff8cc6'; mx.beginPath(); mx.roundRect(0, 0, 512, 340, 48); mx.fill(); mx.fillStyle = '#4a2a86'; mx.beginPath(); mx.roundRect(22, 22, 468, 296, 32); mx.fill();
  mx.fillStyle = '#ffe27a'; mx.font = '800 92px "Baloo 2", system-ui, sans-serif'; mx.textAlign = 'center'; mx.fillText('BOBA', 256, 128);
  mx.fillStyle = '#fff'; mx.font = '700 40px "Baloo 2", system-ui, sans-serif'; mx.fillText('♡ milk tea  ♡ taro', 256, 200); mx.fillText('♡ strawberry  ♡ mochi', 256, 258);
  const menuT = new THREE.CanvasTexture(mc); menuT.colorSpace = THREE.SRGBColorSpace;
  const menu = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.46), new THREE.MeshBasicMaterial({ map: menuT })); menu.position.set(2.1, 3.85, -4.47); roomG.add(menu);
  setTimeout(() => { document.fonts?.ready.then(() => { mx.fillStyle = '#4a2a86'; mx.beginPath(); mx.roundRect(22, 22, 468, 296, 32); mx.fill(); mx.fillStyle = '#ffe27a'; mx.font = '800 92px "Baloo 2", system-ui, sans-serif'; mx.fillText('BOBA', 256, 128); mx.fillStyle = '#fff'; mx.font = '700 40px "Baloo 2", system-ui, sans-serif'; mx.fillText('♡ milk tea  ♡ taro', 256, 200); mx.fillText('♡ strawberry  ♡ mochi', 256, 258); menuT.needsUpdate = true; }); }, 500);
  const shelf = new THREE.Mesh(RB(2.6, 0.16, 0.55, 0.06), roomMats.trim); shelf.position.set(-1.9, 2.55, -4.2); roomG.add(shelf);
  for (const [id, x, sc] of [['t01', -2.9, 0.62], ['t01', -2.35, 0.62], ['g08', -1.75, 0.5], ['t02', -1.15, 0.5], ['t09', -0.75, 0.5]]) {
    loadType(id).then(t => { if (!t) return; const m = new THREE.Mesh(t.geo, t.mat); m.matrixAutoUpdate = false; m.matrix.compose(new V3(x, 2.63 + t.size.y * sc / 2, -4.15), new Q4(), new V3(sc, sc, sc)).multiply(t.base); m.castShadow = true; roomG.add(m); });
  }
  nextRing = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 40), new THREE.MeshBasicMaterial({ color: '#fff3a8', transparent: true, opacity: 0.8, depthWrite: false }));
  nextRing.rotation.x = -Math.PI / 2; nextRing.position.y = 0.03; roomG.add(nextRing);
  ghost = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, opacity: 0.85, depthWrite: false })); ghost.scale.setScalar(2.0); roomG.add(ghost);
}
const thumbTex = {};
function setGhost(d) {
  ghost.visible = !!d; nextRing.visible = !!d; if (!d) return;
  const [id, , , x, z, size, , y = 0] = d;
  thumbTex[id] = thumbTex[id] || new THREE.TextureLoader().load(`assets/thumbs/${id}.webp`, t => { t.colorSpace = THREE.SRGBColorSpace; });
  ghost.material.map = thumbTex[id]; ghost.material.needsUpdate = true;
  ghost.userData = { x, y: y + Math.min(size, 2.2) * 0.55 + 0.5, z };
  nextRing.position.set(x, 0.03, z + (y ? 0.9 : 0)); nextRing.scale.setScalar(1);
}
function roomIdx() { const i = ROOMS.findIndex(r => (save.decor[r.key] || 0) < r.decor.length); return i < 0 ? ROOMS.length - 1 : i; }
async function applyRoom(room) {
  if (curRoom !== room) {
    curRoom = room;
    const ft = TX.checker(room.floor[0], room.floor[1]); ft.repeat.set(3, 3); roomMats.floor.map?.dispose(); roomMats.floor.map = ft; roomMats.floor.needsUpdate = true;
    const wt = TX.wallpaper(room.wall[0], room.wall[1]); wt.repeat.set(3, 2); roomMats.wall.map?.dispose(); roomMats.wall.map = wt; roomMats.wall.needsUpdate = true;
    for (const id in DECOR) { roomG.remove(DECOR[id]); delete DECOR[id]; }
  }
  const n = save.decor[room.key] || 0;
  await Promise.all(room.decor.slice(0, n).map(d => placeDecor(d)));
  setGhost(room.decor[n]);
}
async function placeDecor(d) {
  const [id, , , x, z, size, ry, y = 0] = d; if (DECOR[id]) return DECOR[id];
  const t = await loadType(id); if (!t || DECOR[id]) return DECOR[id];
  const m = new THREE.Mesh(t.geo, t.mat); m.matrixAutoUpdate = false;
  m.matrix.compose(new V3(x, y + t.size.y * size / 2, z), new Q4().setFromAxisAngle(new V3(0, 1, 0), ry), new V3(size, size, size)).multiply(t.base);
  m.castShadow = true; m.receiveShadow = true; roomG.add(m); DECOR[id] = m; return m;
}
function placeGirlHome() {
  if (!girl.root) return;
  if (girl.root.parent !== roomG) roomG.add(girl.root);
  girl.root.scale.setScalar(2.1); girl.root.position.set(1.5, 0, 1.9); girl.root.rotation.set(0, -0.15, 0);
  girl.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
}
function placeGirlPlay() {
  if (!girl.root) return;
  if (girl.root.parent !== girlG) girlG.add(girl.root);
  girl.root.traverse(o => { if (o.isMesh) o.castShadow = false; });
}
function layoutHome() {
  const w = L.w, h = L.h, portrait = w / h < 0.8;
  L.pitch = 0.42; L.target.set(-0.2, 1.4, -0.4);
  const pts = []; for (const x of [-4.4, 4.4]) for (const z of [-4.5, 3.0]) for (const y of [0, 5.4]) pts.push(new V3(x, y, z));
  const top = portrait ? 150 : 150, bottom = h - (portrait ? 250 : 270);
  fitCamera(pts, top, bottom, portrait ? w * 1.12 : Math.min(w - 40, 900));
}
function enterPlay() {
  mode = 'play'; document.body.classList.add('playing');
  roomG.visible = false; playG.visible = true; itemsG.visible = true; trayG.visible = true;
  $('#homeUI').classList.add('off'); $('#hud').classList.remove('off'); $('#boosters').classList.remove('off'); $('#girlTalk').classList.remove('off');
  scene.background = bgTex; hemi.intensity = 0.7; sun.intensity = 1.9; R.toneMappingExposure = 0.9; placeGirlPlay(); layout();
}
async function showHome(fromWin = false) {
  mode = 'home'; state = 'ready'; snd.music(false); document.body.classList.remove('playing');
  $('#hud').classList.add('off'); $('#boosters').classList.add('off'); $('#girlTalk').classList.add('off');
  ui.els.win.classList.add('hc-hidden'); ui.els.lose.classList.add('hc-hidden');
  $('#homeUI').classList.remove('off');
  playG.visible = false; itemsG.visible = false; trayG.visible = false; roomG.visible = true;
  Lv.world = null; Lv.objs = []; Lv.tray = [];
  for (const id in SYNC) { const t = SYNC[id]; if (t && t.pile) { t.pile.count = 0; t.tray.count = 0; } }
  hemi.intensity = 0.42; sun.intensity = 1.35; R.toneMappingExposure = 0.82; placeGirlHome(); girlPlay(fromWin ? 'cheer' : 'idle', fromWin);
  layout();
  await applyRoom(ROOMS[roomIdx()]);
  renderHome();
}
function paintTop() {
  const Lf = M.lives();
  for (const el of document.querySelectorAll('.coinsN')) el.textContent = M.coins();
  $('#livesN').textContent = Lf.unlimited ? '∞' : Lf.n; $('#livesT').textContent = Lf.unlimited || Lf.n >= Lf.max ? 'Full' : `${Math.max(0, Math.ceil((Lf.nextAt - Date.now()) / 60000))}m`;
  $('#starsN').textContent = starBank();
}
function renderHome() {
  paintTop();
  const room = ROOMS[roomIdx()], n = save.decor[room.key] || 0, done = n >= room.decor.length, task = room.decor[n];
  $('#task').innerHTML = done
    ? `<div class="ti"><img src="assets/thumbs/${room.decor[0][0]}.webp" alt=""></div><div class="tt"><small>ALL DONE</small><b>${room.name} is perfect!</b><small>New rooms are on the way</small></div>`
    : `<div class="ti"><img src="assets/thumbs/${task[0]}.webp" alt=""></div><div class="tt"><small>${room.name.toUpperCase()} · ${n}/${room.decor.length}</small><b>${task[1]}</b><i class="bar"><em style="width:${n / room.decor.length * 100}%"></em></i></div>
       <button id="place" class="${starBank() >= task[2] ? 'ready' : ''}">${STAR_SVG}<span>${task[2]}</span></button>`;
  const pb = $('#place'); if (pb) { pb.addEventListener('pointerdown', e => e.stopPropagation()); pb.addEventListener('click', placeTask); }
  const nxt = save.level, hard = !D.isDaily && plan(nxt).hard;
  $('#playBtn').innerHTML = D.isDaily ? (save.dDone === D.seed ? 'Daily solved ✓' : 'Daily Puzzle') : `Level ${nxt}${hard ? '<i class="hardtag">HARD</i>' : ''}`;
  $('#streakN').textContent = save.dStreak > 0 ? `🔥${save.dStreak}` : '';
  $('#albumN').textContent = `${save.album.length}/${ITEMS.length}`;
  $('#dailyL').textContent = D.isDaily ? 'Levels' : 'Daily';
}
async function placeTask() {
  const room = ROOMS[roomIdx()], n = save.decor[room.key] || 0, task = room.decor[n]; if (!task) return;
  if (starBank() < task[2]) { snd.deny(); toast(`Win levels to earn ★${task[2]}`, true); const b = $('#playBtn'); b.classList.remove('nudge'); void b.offsetWidth; b.classList.add('nudge'); return; }
  save.spent += task[2]; save.decor[room.key] = n + 1; persist();
  const m = await placeDecor(task);
  const p = new V3(task[3], (task[7] || 0) + task[5] * 0.5, task[4]);
  snd.win(); buzz([10, 30, 10]); sparkle(p, '#ffd36b', 50, 3.2); sparkle(p, '#ff9ccf', 30, 2.4); ring(p, 2.4);
  if (m) { m.userData.pop = 0; }
  girlPlay('cheer', true);
  if (n + 1 >= room.decor.length) { setTimeout(() => { confetti(scene, new V3(0, 4, 0), 90); toast(`${room.name} done!`); M.add(300, 'room-done'); snd.sticker(); }, 600); setTimeout(() => showHome(), 3000); }
  else setGhost(room.decor[n + 1]);
  renderHome();
}
$('#playBtn').addEventListener('click', () => { snd.unlock(); if (D.isDaily && save.dDone === D.seed) { toast('Come back tomorrow!', true); return; } startLevel(); });
$('#albumBtn').addEventListener('click', () => openAlbum());
$('#dailyBtn').addEventListener('click', () => { location.search = D.isDaily ? '' : '?daily=1'; });
$('#shopBtn').addEventListener('click', () => openShop());
$('#topCoins').addEventListener('click', () => openShop());
$('#topLives').addEventListener('click', () => { const Lf = M.lives(); if (!Lf.unlimited && Lf.n < Lf.max) livesSheet(); else toast('Hearts are full!', true); });
$('#topStars').addEventListener('click', () => toast('Stars decorate your room', true));
for (const el of document.querySelectorAll('#homeUI button, #homeUI .chip')) el.addEventListener('pointerdown', e => e.stopPropagation());
const SVG_SND = '<span class="em">🔊</span>Sound', SVG_MUTE = '<span class="em">🔇</span>Sound';
function paintMute() { $('#hmute').innerHTML = snd.muted ? SVG_MUTE : SVG_SND; }
paintMute();
$('#hmute').addEventListener('click', () => { snd.toggle(); paintMute(); });
M.onChange(() => paintTop());

// ------------------------------------------------------------------ frame loop
let perfS = {}; R.info.autoReset = false;
let shake = 0, lastT = performance.now(), fpsAcc = 0, fpsN = 0;
function frame(now) {
  const dt = Math.min(1 / 30, (now - lastT) / 1000); lastT = now;
  if (Lv.world && mode === 'play') {
    const W = Lv.world; W.step(dt / 2); W.step(dt / 2);
    if (state === 'play' && !paused()) {
      if (Lv.intro > 0) Lv.intro -= dt;
      else if (Lv.frozen > 0) { Lv.frozen -= dt; if (Lv.frozen <= 0) { $('#frost').classList.remove('on'); $('#timeBox').classList.remove('ice'); } }
      else { Lv.left -= dt; if (Lv.left <= 0) { Lv.left = 0; paintTime(); loseLevel('time'); } }
      paintTime();
      if (Lv.comboT > 0) Lv.comboT -= dt;
    }
    updateObjects(dt);
  }
  if (talkT && performance.now() > talkT) { talkT = 0; $('#girlTalk').classList.add('off'); if (mode === 'play') $('#girlTalk').classList.remove('pop'); }
  if (mode === 'play' && talkT === 0) $('#girlTalk').classList.add('off');
  if (girl.mixer) girl.mixer.update(dt);
  if (nextRing && nextRing.visible) { const k = 1 + Math.sin(now / 260) * 0.12; nextRing.scale.setScalar(k); nextRing.material.opacity = 0.55 + Math.sin(now / 260) * 0.3; }
  if (ghost && ghost.visible) { const u = ghost.userData; ghost.position.set(u.x, u.y + Math.sin(now / 400) * 0.15, u.z); ghost.material.opacity = 0.75 + Math.sin(now / 300) * 0.2; }
  if (shake > 0) shake = Math.max(0, shake - dt);
  placeCam(L.camD); if (shake) { camera.position.x += (Math.random() - 0.5) * shake * 0.5; camera.position.y += (Math.random() - 0.5) * shake * 0.5; camera.updateMatrixWorld(); }
  if (trayShake > 0) trayShake = Math.max(0, trayShake - dt);
  updSparks(dt); updRings(dt); updateParticles(dt * 60);
  R.info.reset(); C.render(dt); perfS = { calls: R.info.render.calls, tris: R.info.render.triangles };
  fpsAcc += dt; fpsN++;
  requestAnimationFrame(frame);
}
const _t = new V3(), _mid = new V3(), _qd = new Q4();
function updateObjects(dt) {
  Lv.tray.forEach((o, i) => o.slot = i);
  const trayScale = L.slot * L.wpp * 0.84;
  _up.set(0, 1, 0).applyQuaternion(camera.quaternion);
  const sh = trayShake > 0 ? Math.sin(trayShake * 60) * trayShake * L.slot * L.wpp * 0.4 : 0;
  const bob = performance.now() / 1000;
  for (const o of Lv.objs) {
    if (o.state === 'pile') { o.pos.copy(o.body.p); o.quat.copy(o.body.q); }
    else if (o.state === 'fly' || o.state === 'tray') {
      slotWorld(o.slot, _t); _t.addScaledVector(_v.set(1, 0, 0).applyQuaternion(camera.quaternion), sh);
      _qd.copy(trayG.quaternion).multiply(dispQ);
      const ts = trayScale * (o.sc / PILE_S);
      if (o.state === 'fly') {
        o.tp += dt / 0.3; const k = ease(o.tp);
        _mid.lerpVectors(o.from.pos, _t, 0.5).addScaledVector(_up, 1.6);
        const a = 1 - k; o.pos.set(0, 0, 0).addScaledVector(o.from.pos, a * a).addScaledVector(_mid, 2 * a * k).addScaledVector(_t, k * k);
        o.quat.slerpQuaternions(o.from.quat, _qd, k); o.scl = THREE.MathUtils.lerp(o.from.scl, ts, k) * (1 + Math.sin(k * Math.PI) * 0.25);
        if (o.tp >= 1) { o.state = 'tray'; o.squash = 1; snd.land(o.slot); if (!checkMatches()) checkLose(); }
      } else {
        o.pos.lerp(_t, 1 - Math.exp(-dt * 16)); o.quat.slerp(_qd, 1 - Math.exp(-dt * 10)); o.scl = ts * (1 + Math.sin(bob * 3 + o.slot) * 0.015);
      }
    } else if (o.state === 'return') {
      o.tp += dt / 0.35; const k = ease(o.tp);
      o.pos.lerpVectors(o.from.pos, o.to, k); o.scl = THREE.MathUtils.lerp(o.from.scl, o.sc, k);
      if (o.tp >= 1) { o.state = 'pile'; o.scl = o.sc; const b = o.body; b.p.copy(o.pos); b.q.copy(o.quat); b.v.set(0, -3, 0); b.w.set(Math.random() * 3, Math.random() * 3, 0); b.on = true; b.asleep = false; b.sleepT = 0; b.rt = 2; }
    }
    if (o.squash > 0) o.squash = Math.max(0, o.squash - dt * 4);
  }
  for (let i = merges.length - 1; i >= 0; i--) {
    const m = merges[i]; m.t += dt / (m.magnet ? 0.5 : 0.24);
    const k = ease(m.t);
    for (const o of m.set) {
      o.pos.lerpVectors(o.from.pos, m.center, k);
      o.scl = THREE.MathUtils.lerp(o.from.scl, L.slot * L.wpp * 0.84 * (o.sc / PILE_S), Math.min(1, k * 1.5)) * (1 + Math.sin(Math.min(1, m.t) * Math.PI) * 0.3);
      if (m.magnet) o.quat.slerp(_qd.copy(trayG.quaternion).multiply(dispQ), k);
    }
    if (m.t >= 1) { merges.splice(i, 1); finishMerge(m); }
  }
  for (const id in SYNC) { const t = SYNC[id]; if (t && t.pile) { t.pile.count = 0; t.tray.count = 0; } }
  for (const o of Lv.objs) {
    if (o.state === 'gone') continue;
    const mesh = o.state === 'pile' ? o.t.pile : o.t.tray;
    if (mesh.count >= 9) continue;
    mesh.setMatrixAt(mesh.count++, instMatrix(o, _m));
  }
  for (const id in SYNC) { const t = SYNC[id]; if (t && t.pile) { t.pile.instanceMatrix.needsUpdate = true; t.tray.instanceMatrix.needsUpdate = true; } }
  const full = Lv.tray.length >= 5 && state === 'play';
  const wells = trayG.userData.wells || []; wells.forEach((w, i) => { w.material = full && i >= Lv.tray.length ? wellGlow : wellMat; });
  wellGlow.emissiveIntensity = full ? 0.35 + Math.sin(performance.now() / 150) * 0.25 : 0;
}
function checkLose() {
  if (state !== 'play') return;
  if (Lv.tray.length >= TRAY && Lv.tray.every(o => o.state === 'tray') && !merges.length) loseLevel('full');
}

// ------------------------------------------------------------------ bot (for check.cjs): a careful player at human speed
function exposure(o) { let s = o.pos.y * 2; for (const p of Lv.objs) if (p !== o && p.state === 'pile' && p.pos.y > o.pos.y + 0.3 && Math.hypot(p.pos.x - o.pos.x, p.pos.z - o.pos.z) < 0.9) s -= 3; return s; }
let botT = 0;
function bot() {
  if (mode === 'home' && state === 'ready') {
    if (document.querySelector('.sh-wrap')) { document.querySelector('.sh-wrap').remove(); }
    if (M.lives().n <= 0) M.refillLives();
    if (!loadingLevel) startLevel(); return;
  }
  if (state !== 'play' || loadingLevel || Lv.intro > 0.5 || paused()) return;
  const now = performance.now(); if (now - botT < 430) return; botT = now;
  const cnt = trayCounts(), pile = Lv.objs.filter(o => o.state === 'pile');
  if (!pile.length) return;
  const best = id => pile.filter(o => o.id === id).sort((a, b) => exposure(b) - exposure(a))[0];
  for (const id in cnt) if (cnt[id] % 3 === 2) { const o = best(id); if (o) { take(o); return; } }
  if (Lv.tray.length <= 4) for (const id in cnt) if (cnt[id] % 3 === 1) { const o = best(id); if (o) { take(o); return; } }
  if (Lv.tray.length >= 5) { if (save.boost.magnet > 0 && useBooster('magnet', true)) return; if (save.boost.undo > 0 && Lv.tray.length >= 6 && useBooster('undo', true)) return; }
  if (Lv.left < Lv.time * 0.3 && save.boost.freeze > 0 && Lv.frozen <= 0) { useBooster('freeze', true); return; }
  if (Lv.tray.length >= 5) for (const id in cnt) if (cnt[id] % 3 === 1) { const o = best(id); if (o) { take(o); return; } }
  const ids = [...new Set(pile.map(o => o.id))].sort((a, b) => exposure(best(b)) - exposure(best(a)));
  const o = best(ids[0]); if (o) take(o);
}
window.__game = {
  get state() { return state; }, get level() { return Lv.daily ? 'daily' : save.level; }, get score() { return totalStars(); },
  get mode() { return mode; }, get points() { return Lv.points; }, get tray() { return Lv.tray.map(o => o.id); }, get left() { return Lv.left; },
  forceFill() { const seen = new Set(); for (const o of Lv.objs) if (o.state === 'pile' && !seen.has(o.id) && Lv.tray.length < TRAY) { seen.add(o.id); take(o); } },
  bot, start: startLevel, use: useBooster, money: M, revive, home: showHome, album: openAlbum, save, girl,
  get perf() { const r = { ...perfS, fps: fpsN / Math.max(0.001, fpsAcc) }; fpsN = 0; fpsAcc = 0; return r; },
};

// ------------------------------------------------------------------ boot
addEventListener('resize', () => { layout(); });
setInterval(() => { if (mode === 'home') paintTop(); }, 20000);
showHome();
requestAnimationFrame(frame);
