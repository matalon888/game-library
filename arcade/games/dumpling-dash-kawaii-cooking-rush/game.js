// Dumpling Dash — kawaii cooking rush. Chibi friends queue at the counter with order bubbles; tap machines to cook, tap
// what's ready to serve it (or to put it on a plate), tap a topping jar to dress a plate, tap the plate to serve.
// Patience hearts, tips, combos, days with 3-star coin goals, kitchen upgrades + décor, five restaurants on a map,
// a sticker album, a daily rush with streaks. Art: kawaii AI 3D props + rigged chibis (assets/), room + machines in code.
import { THREE, createUI, store, loop, buzz, confetti, clamp, lerp } from './kit/hc.js';
import { cine } from './kit/cine.js';
import { GLTFLoader } from './kit/addons/loaders/GLTFLoader.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { money } from './kit/money.js';
import { demo } from './kit/demo.js';
import { buildWorld, toppingMesh, jelly, ROOM, PLATE_X } from './world.js';
import { DISH, TOP, STN, REST, LEVELS_PER, FRIENDS, STICKERS, PAGE_GIFT, DECOR_POS, levelConfig } from './data.js';
import { S as SND, music, setMuted, unlock, adPaused } from './audio.js';

const NAME = 'Dumpling Dash: Kawaii Cooking Rush', KEY = 'dumpling-dash';
const Q = new URLSearchParams(location.search);
const ST = store(KEY);
const P = Object.assign({ cur: 0, prog: [1, 1, 1, 1, 1], stars: {}, up: {}, decor: {}, boost: { turbo: 2, calm: 2 }, stickers: [], newSt: [], happy: {}, pagesPaid: [],
  mute: false, dStreak: 0, dLast: 0, dFreezeWk: -1, dWon: 0, seenTip: {} }, ST.get('p', {}));
const saveP = () => { try { ST.set('p', P); } catch (e) {} };
const $ = id => document.getElementById(id);
const sk = (ri, i) => ri + '-' + i;
const totalStars = () => Object.values(P.stars).reduce((a, b) => a + b, 0);
const restOpen = ri => ri === 0 || (P.prog[ri - 1] > LEVELS_PER && totalStars() >= REST[ri].need);

// ---------------------------------------------------------------- kit layers
const M = money({ game: KEY, style: 'B' });
const ui = createUI({ title: 'Dumpling Dash', hint: '', hand: '' });
const D = daily(KEY, ui, { name: NAME });
const B = board({ game: 'dumpling-dash', label: 'Stars earned', mode: 'sum', limits: { maxRun: 3, maxPerSec: 0.5 }, corner: 'tl', accent: '#ff5da2' });
const F = flow(KEY);
const OV = $('ov');
addEventListener('ap:ad', e => { const on = e.detail.phase === 'start'; adPaused(on); paused = on; });

// ---------------------------------------------------------------- renderer + post
const LITE = Q.has('lite') || (Math.min(screen.width, screen.height) < 500 && devicePixelRatio > 2.5);
const R = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
R.setSize(innerWidth, innerHeight); R.info.autoReset = false; R.domElement.className = 'hc-canvas'; document.body.prepend(R.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(REST[0].theme.bg);
const cam = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.3, 90);
const QN = (k, d) => (Q.has(k) ? +Q.get(k) : d);
const C = cine(R, scene, cam, { bloom: QN('bloom', 0.12), bloomThreshold: QN('bth', 1.25), bloomRadius: 0.4, exposure: QN('exp', 0.85), envIntensity: QN('env', 0.35), lite: LITE, grade: { sat: QN('sat', 1.28), contrast: QN('con', 1.12), vignette: 0.08, grain: 0 } });
scene.add(new THREE.HemisphereLight(0xfff4fb, 0xc9a8e0, QN('hemi', 0.7)));
const sun = new THREE.DirectionalLight(0xffffff, QN('sun', 1.6)); sun.position.set(3, 12, 7); sun.target.position.set(0, 0, -1.5);
sun.castShadow = true; sun.shadow.mapSize.set(C.lite ? 1024 : 2048, C.lite ? 1024 : 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025; sun.shadow.radius = 5;
Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 8, bottom: -8, near: 1, far: 34 });
scene.add(sun, sun.target);
const fill = new THREE.PointLight(0xffd6f0, QN('fill', 1.2), 10, 1.6); fill.position.set(0, 3.4, 2.5); scene.add(fill);

// ---------------------------------------------------------------- loading
const loader = new GLTFLoader();
const MODELS = {};
const MODEL_IDS = ['f01', 'f02', 'f03', 'f04', 'f05', 'f06', 'f08', 'f09', 'f10', 't01', 't02', 't03', 't08', 'g08', 'g09', 'g11', 'h05', 'h06', 'h07', 'h10', 'h12', 'r01', 'h11'];
let loaded = 0; const toLoad = MODEL_IDS.length + FRIENDS.length + 1;
const prog = () => { loaded++; const b = document.querySelector('#load i'); if (b) b.style.width = Math.round(loaded / toLoad * 100) + '%'; };
// kawaii props are Z-up + quantized: stand them up by rotating the node (never the geometry), centre x/z, floor y=0, largest side = 1
function prep(sc) {
  sc.rotation.x = Math.PI / 2;
  const w = new THREE.Group(); w.add(sc); w.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(w), sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
  sc.position.set(-c.x, -bb.min.y, -c.z); const m = Math.max(sz.x, sz.y, sz.z); w.scale.setScalar(1 / m);
  const root = new THREE.Group(); root.add(w); root.userData.h = sz.y / m;
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.prop = true; const mt = o.material; if (mt) { mt.envMapIntensity = 0.85; if (mt.metalness > 0.4) mt.metalness = 0.4; } } });
  return root;
}
function place(id, { size = 1, pos = [0, 0, 0], rot = 0, parent = scene } = {}) {
  const o = MODELS[id].clone(); o.scale.setScalar(size); o.position.set(pos[0], pos[1], pos[2]); o.rotation.y = rot; o.userData.h = MODELS[id].userData.h; parent.add(o); return o;
}

// ---------------------------------------------------------------- state
let state = 'loading', W = innerWidth, H = innerHeight, paused = false;
let world = null, stations = {}, grabs = {}, jars = {}, plates = [], chef = null, chefX = 0, chefTX = 0, decorObjs = [], curRI = -1;
let day = null, customers = [], custPool = [], flyers = [], dayCoins = 0, dayTips = 0, served = 0, lost = 0, combo = 0, comboT = 0, bestCombo = 0, outcomes = [];
let dayT = 0, turboT = 0, recorded = false, beatenShown = false, t0run = 0, shake = 0, camMode = 'lobby', camBlend = 0, wantStart = false, extraUsed = false, replay = false;
const upN = id => P.up[id] || 0;
const nSlots = key => 2 + upN(key + '_n');
const nPlates = () => 2 + upN('plates');
const cookTime = key => STN[key].t * Math.pow(0.8, upN(key + '_s'));
const decorOf = ri => P.decor[ri] || [];
const patienceMult = () => 1 + 0.05 * decorOf(curRI).length;
const tipMult = () => 1 + 0.15 * upN('tips');
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- camera framing
const CAMS = { play: null, lobby: null };
function sph(pos, look, fov) { const d = pos.clone().sub(look), r = d.length(); return { t: look, r, el: Math.asin(d.y / r), az: Math.atan2(d.x, d.z), fov }; }
function frameCams() {
  const a = W / H;
  if (a < 0.8) {
    const k = clamp((0.46 - a) / 0.1, -1, 1);
    CAMS.play = sph(V3(0, QN('cy', 10) + k * 0.9, QN('cz', 9.5) + k * 0.9), V3(0, QN('ty', 0.2), QN('tz', -1.2)), QN('fov', 37) + k * 2);
    CAMS.lobby = sph(V3(QN('lx', 0), QN('ly', 3.4), QN('lz', 9)), V3(0, QN('lty', 0.6), QN('ltz', 0)), QN('lfov', 40) + k * 4);
  } else {
    CAMS.play = sph(V3(0, QN('dy', 7.4), QN('dz', 8.2)), V3(0, 0.45, QN('dtz', -0.6)), QN('dfov', 40));
    CAMS.lobby = sph(V3(0.3, 2.9, 9.4), V3(0.3, 1.25, 0), 36);
  }
}
const _cp = V3(0, 0, 0), _cl = V3(0, 0, 0);
function updateCam(dt) {
  camBlend = clamp(camBlend + (camMode === 'play' ? 1 : -1) * dt * 1.1, 0, 1);
  const e = camBlend < 0.5 ? 4 * camBlend ** 3 : 1 - (-2 * camBlend + 2) ** 3 / 2;
  const A = CAMS.lobby, Bc = CAMS.play;
  _cl.lerpVectors(A.t, Bc.t, e);
  const r = lerp(A.r, Bc.r, e), el = lerp(A.el, Bc.el, e), az = lerp(A.az, Bc.az, e);
  _cp.set(_cl.x + r * Math.cos(el) * Math.sin(az), _cl.y + r * Math.sin(el), _cl.z + r * Math.cos(el) * Math.cos(az));
  const tt = performance.now() / 1000;
  if (camMode === 'lobby') { _cp.x += Math.sin(tt * 0.3) * 0.3; _cp.y += Math.sin(tt * 0.37) * 0.08; }
  if (shake > 0) { _cp.x += (Math.random() - 0.5) * shake; _cp.y += (Math.random() - 0.5) * shake; shake = Math.max(0, shake - dt * 0.6); }
  cam.position.copy(_cp); cam.lookAt(_cl);
  const f = lerp(A.fov, Bc.fov, e); if (Math.abs(cam.fov - f) > 0.01) { cam.fov = f; cam.updateProjectionMatrix(); }
}
function resize() { W = innerWidth; H = innerHeight; R.setSize(W, H); cam.aspect = W / H; cam.updateProjectionMatrix(); C.resize(W, H); frameCams(); }
addEventListener('resize', resize); frameCams();
const _v = new THREE.Vector3();
function toScreen(v) { _v.copy(v).project(cam); return [(_v.x + 1) / 2 * W, (1 - _v.y) / 2 * H, _v.z]; }

// ---------------------------------------------------------------- sparkle / steam sprites (pooled)
const softT = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const starT = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.translate(32, 32); x.fillStyle = '#fff'; x.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? 7 : 30, a = i / 8 * Math.PI * 2; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.fill(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const heartT = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(32, 54); x.bezierCurveTo(-4, 30, 10, 2, 32, 20); x.bezierCurveTo(54, 2, 68, 30, 32, 54); x.fill(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const SPR = [];
for (let i = 0; i < 48; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softT, transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; scene.add(s); SPR.push({ s, life: 0 }); }
function puff(pos, { color = 0xffffff, n = 1, size = 0.3, up = 0.6, spread = 0.1, life = 1.2, star = false, heart = false, add = false } = {}) {
  for (let k = 0; k < n; k++) {
    const p = SPR.find(q => q.life <= 0); if (!p) return;
    p.s.material.map = heart ? heartT : star ? starT : softT; p.s.material.color.set(Array.isArray(color) ? color[k % color.length] : color); p.s.material.blending = add ? THREE.AdditiveBlending : THREE.NormalBlending;
    p.s.position.set(pos.x + (Math.random() - 0.5) * spread, pos.y, pos.z + (Math.random() - 0.5) * spread);
    p.v = V3((Math.random() - 0.5) * spread * 2, up * (0.7 + Math.random() * 0.6), (Math.random() - 0.5) * spread * 2);
    p.life = p.max = life * (0.8 + Math.random() * 0.4); p.size = size * (0.7 + Math.random() * 0.6); p.s.visible = true; p.star = star || heart;
  }
}
function updateSprites(dt) {
  for (const p of SPR) {
    if (p.life <= 0) continue; p.life -= dt; const k = 1 - p.life / p.max;
    p.s.position.addScaledVector(p.v, dt); if (p.star) p.v.y -= dt * 1.5;
    const sc = p.size * (p.star ? (1 - k * 0.5) : (0.6 + k * 1.2)); p.s.scale.set(sc, sc, sc);
    p.s.material.opacity = p.star ? Math.min(1, (1 - k) * 2) : Math.sin(k * Math.PI) * 0.55; p.s.material.rotation = k * (p.star ? 2 : 0.6);
    if (p.life <= 0) { p.s.visible = false; p.s.material.opacity = 0; }
  }
}

// ---------------------------------------------------------------- item meshes (pooled clones)
const itemPool = {};
function itemMesh(k) {
  const list = itemPool[k] || (itemPool[k] = []);
  let o = list.find(q => !q.userData.busy);
  if (!o) { o = MODELS[DISH[k].m].clone(); o.userData.h = MODELS[DISH[k].m].userData.h; o.userData.k = k; o.traverse(q => { if (q.isMesh) q.castShadow = false; }); scene.add(o); list.push(o); }
  o.userData.busy = true; o.visible = true; o.scale.setScalar(DISH[k].s); o.rotation.set(0, 0, 0); return o;
}
function freeItem(o) { if (!o) return; o.visible = false; o.userData.busy = false; for (const t of (o.userData.tops || [])) t.parent && t.parent.remove(t); o.userData.tops = []; }
function addTopMesh(o, t) {
  const m = toppingMesh(t, (id, opt) => place(id, { ...opt, parent: o }));
  if (m.parent !== o) o.add(m);
  const n = (o.userData.tops || []).length, h = o.userData.h || 0.8;
  m.scale.multiplyScalar(1 / DISH[o.userData.k].s * 0.95); m.position.set((n - 0.5) * 0.18 / DISH[o.userData.k].s, h * 0.98, 0.1 / DISH[o.userData.k].s);
  (o.userData.tops || (o.userData.tops = [])).push(m); return m;
}

// ---------------------------------------------------------------- topping / dish icons for bubbles
const ICON = {};
function drawIcon(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  if (kind === 'egg') { x.fillStyle = '#fffaf0'; x.strokeStyle = '#e8cfa8'; x.lineWidth = 3; x.beginPath(); x.ellipse(32, 34, 22, 26, 0, 0, 7); x.fill(); x.stroke(); const g = x.createRadialGradient(28, 36, 2, 32, 38, 14); g.addColorStop(0, '#ffd56a'); g.addColorStop(1, '#ff9f1c'); x.fillStyle = g; x.beginPath(); x.arc(32, 38, 13, 0, 7); x.fill(); }
  else { x.fillStyle = '#ffffff'; x.strokeStyle = '#d9c8e8'; x.lineWidth = 3; x.beginPath(); x.ellipse(32, 36, 26, 18, 0, 0, 7); x.fill(); x.stroke(); x.fillStyle = '#7a4a32'; x.beginPath(); x.ellipse(32, 34, 18, 11, 0, 0, 7); x.fill(); x.fillStyle = 'rgba(255,255,255,.5)'; x.beginPath(); x.ellipse(26, 31, 6, 3, -0.3, 0, 7); x.fill(); }
  return c.toDataURL();
}
ICON.egg = drawIcon('egg'); ICON.soy = drawIcon('soy'); ICON.str = './assets/icons/t03.webp';
const dishIcon = k => `./assets/icons/${DISH[k].m}.webp`;

// ---------------------------------------------------------------- restaurant (re)build
const lockTags = [];
function setRestaurant(ri, force = false) {
  if (ri === curRI && !force) return;
  curRI = ri; const Rr = REST[ri];
  if (world) { scene.remove(world.G); world.G.traverse(o => { if (o.isMesh && !o.userData.prop && o.geometry) o.geometry.dispose(); }); }
  for (const s of Object.values(stations)) for (const sl of s.slots) { sl.ring.remove(); if (sl.mesh) freeItem(sl.mesh); }
  for (const p of plates) { if (p.dish) freeItem(p.dish.mesh); }
  for (const o of decorObjs) o.parent && o.parent.remove(o); decorObjs = [];
  scene.background.set(Rr.theme.bg);
  world = buildWorld(scene, Rr, place);
  stations = {}; grabs = {}; jars = {};
  for (const [key, m] of Object.entries(world.machines)) {
    const slots = m.slots.map(([x, z], i) => {
      const ring = document.createElement('div'); ring.className = 'ring'; ring.innerHTML = '<svg viewBox="0 0 34 34"><circle class="bg" cx="17" cy="17" r="12"/><circle class="fg" cx="17" cy="17" r="12"/></svg>'; ring.style.display = 'none'; OV.appendChild(ring);
      return { i, pos: V3(x, m.top, z), state: 'idle', t: 0, dur: 1, mesh: null, ring, fg: ring.querySelector('.fg'), bob: 0 };
    });
    stations[key] = { key, def: STN[key], m, slots, anchor: m.anchor, on: true, act: 0 };
  }
  for (const [k, gb] of Object.entries(world.grabs)) {
    const items = [-0.2, 0.2, 0].map((dx, j) => { const o = place(DISH[k].m, { size: DISH[k].s * 0.85, pos: [gb.pos.x + dx, gb.pos.y + (j === 2 ? 0.0 : 0), gb.pos.z + (j === 2 ? 0.2 : -0.08)], rot: (j - 1) * 0.4, parent: world.G }); return o; });
    grabs[k] = { k, ...gb, items, on: true, wob: 0 };
  }
  for (const [t, jr] of Object.entries(world.jars)) {
    const fills = [];
    for (let j = 0; j < 5; j++) { const m = toppingMesh(t, (id, opt) => place(id, { ...opt, parent: world.G })); if (!m.parent) world.G.add(m); m.position.set(jr.pos.x + Math.cos(j * 2.4) * 0.12, jr.pos.y - 0.18 + Math.floor(j / 3) * 0.12, jr.pos.z + Math.sin(j * 2.4) * 0.12); m.rotation.y = j; fills.push(m); }
    jars[t] = { t, ...jr, on: true, wob: 0 };
  }
  plates = world.plates.map((pos, i) => {
    const g = new THREE.Group(); g.position.copy(pos); world.G.add(g);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.05, 32), jelly('#ffffff')); m.position.y = 0.025; m.receiveShadow = true; g.add(m);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.025, 8, 32), jelly(Rr.theme.counter)); rim.rotation.x = Math.PI / 2; rim.position.y = 0.05; g.add(rim);
    return { i, g, pos: pos.clone().add(V3(0, 0.05, 0)), dish: null, tossT: 0, wob: 0 };
  });
  for (const d of Rr.decor) if (decorOf(ri).includes(d.id)) placeDecor(d, false);
  refreshUnlocks();
  scene.updateMatrixWorld(true);
  const _s = new THREE.Vector3();
  world.G.traverse(o => { if (!o.isMesh || !o.castShadow) return; if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); o.getWorldScale(_s); if (o.geometry.boundingSphere.radius * Math.max(_s.x, _s.y, _s.z) < 0.35) o.castShadow = false; });
}
function placeDecor(d, fresh) {
  const idx = REST[curRI].decor.indexOf(d), pos = d.id === 'h05' ? [0, 0.005, -4.35] : DECOR_POS[idx % DECOR_POS.length], size = d.id === 'h07' ? 0.9 : d.size;
  const o = place(d.id, { size, pos, rot: d.id === 'h05' ? 0 : pos[0] > 0 ? -0.45 : 0.45, parent: world.G }); decorObjs.push(o);
  if (fresh) { const s = o.scale.x; o.scale.setScalar(0.01); popIn.push({ o, t: 0, s }); const p = o.getWorldPosition(V3(0, 0, 0)); confetti(scene, p.clone().add(V3(0, 1, 0)), 30); puff(p.clone().add(V3(0, 0.8, 0)), { color: [0xff9fd0, 0xfff27a, 0xb9a2ff], n: 12, size: 0.25, up: 1.6, spread: 0.8, life: 1.1, star: true }); }
}
const popIn = [];
function updatePop(dt) { for (let i = popIn.length - 1; i >= 0; i--) { const q = popIn[i]; q.t = Math.min(1, q.t + dt * 2.2); const e = 1 + Math.sin(q.t * Math.PI) * 0.3; q.o.scale.setScalar(q.s * Math.max(0.01, q.t < 1 ? q.t * e : 1)); if (q.t >= 1) popIn.splice(i, 1); } }

function refreshUnlocks() {
  const cfg = day && state === 'play' ? day : levelConfig(curRI, curLevel(), { daily: !!D.seed });
  for (const t of lockTags) t.el.remove(); lockTags.length = 0;
  const Rr = REST[curRI];
  const lvlOf = k => (Rr.menu.find(m => m[0] === k) || [0, 99])[1];
  for (const s of Object.values(stations)) { s.on = cfg.menu.includes(s.def.item); if (!s.on) addLock(s.anchor, lvlOf(s.def.item)); }
  for (const g of Object.values(grabs)) { g.on = cfg.menu.includes(g.k); g.items.forEach(o => o.visible = g.on); if (!g.on) addLock(g.anchor, lvlOf(g.k)); }
  for (const j of Object.values(jars)) { j.on = cfg.tops.includes(j.t); if (!j.on) addLock(j.anchor, (Rr.tops.find(m => m[0] === j.t) || [0, 99])[1]); }
  plates.forEach((p, i) => { p.g.visible = i < nPlates(); });
}
function addLock(pos, lvl) { const el = document.createElement('div'); el.className = 'lk'; el.innerHTML = `<i>🔒</i><small>Day ${lvl}</small>`; OV.appendChild(el); lockTags.push({ el, pos }); }
function updateLocks() { const on = state === 'play' && camBlend > 0.97; for (const t of lockTags) { t.el.style.display = on ? '' : 'none'; if (!on) continue; const [sx, sy] = toScreen(t.pos); t.el.style.transform = `translate(${sx}px,${sy}px) translate(-50%,-50%)`; } }

// ---------------------------------------------------------------- characters (chef k01 + chibi friends)
async function loadChar(id, h) {
  const g = await loader.loadAsync(`./assets/chars/${id}.glb`);
  const o = g.scene; o.traverse(q => { if (q.isMesh) { q.frustumCulled = false; q.castShadow = true; q.receiveShadow = false; } });
  const b = new THREE.Box3().setFromObject(o), s = h / Math.max(0.01, b.max.y - b.min.y);
  const root = new THREE.Group(); o.scale.multiplyScalar(s); o.position.y = -b.min.y * s; root.add(o);
  const mixer = new THREE.AnimationMixer(o), actions = {};
  for (const c of g.animations) {
    // the idle mocap slowly turns the whole body around (hips yaw): pin the hips to their first-frame rotation so friends keep facing you
    // the idle mocap turns the whole body around after ~40% of the clip: keep only its front-facing first third, ping-ponged
    if (c.name === 'idle' && h > 1.4) { const sub = THREE.AnimationUtils.subclip(c, 'idle', 0, Math.max(8, Math.round(c.duration * 30 * 0.32)), 30); actions.idle = mixer.clipAction(sub); actions.idle.setLoop(THREE.LoopPingPong); continue; }
    actions[c.name] = mixer.clipAction(c);
  }
  for (const n of ['cheer', 'jump', 'wave']) if (actions[n]) { actions[n].setLoop(THREE.LoopOnce, 1); actions[n].clampWhenFinished = true; }
  let curA = null;
  const play = (n, { fade = 0.25, ts = 1 } = {}) => { const a = actions[n]; if (!a) return; a.timeScale = ts; if (curA === a && !['cheer', 'jump', 'wave'].includes(n)) return; a.reset().fadeIn(fade).play(); if (curA && curA !== a) curA.fadeOut(fade); curA = a; };
  return { id, object: root, mixer, actions, play, get cur() { return curA && curA.getClip().name; } };
}
const CS = 1.38;   // chibi friends a touch bigger than life so faces read on a phone
async function loadCast() {
  try { const k = await loadChar('k01', 1.55); chef = { ...k, cheerT: 0 }; scene.add(k.object); k.object.position.set(0, 0, 3.35); k.play('idle'); } catch (e) { console.warn('chef', e); }
  prog();
  for (const f of FRIENDS) {
    try { const k = await loadChar(f.id, f.h * CS); k.object.visible = false; scene.add(k.object); custPool.push({ f, k, busy: false }); } catch (e) { console.warn('friend', f.id, e); }
    prog();
  }
}

// ---------------------------------------------------------------- customers
const SPOTS = { 2: [-0.95, 0.95], 3: [-1.4, 0, 1.4] };
const spotX = i => SPOTS[day.spots][i];
function freeSpot() { const free = []; for (let i = 0; i < day.spots; i++) if (!customers.some(c => c.spot === i)) free.push(i); return free.length ? free[Math.floor(day.r() * free.length)] : -1; }
function orderHTML(o) { return `<div class="it" data-k="${o.k}"><img alt="" src="${dishIcon(o.k)}">${o.tops.map(t => `<span class="tp"><img alt="" src="${ICON[t]}"></span>`).join('')}</div>`; }
function spawnCustomer(spec, spot) {
  const free = custPool.filter(c => !c.busy);
  if (!free.length) return false;
  const inst = free[spec.who % free.length]; inst.busy = true;
  const o = inst.k.object; o.visible = true; o.position.set(ROOM.doorX + (day.r() - 0.5) * 0.3, 0, ROOM.backZ + 0.6); o.rotation.y = 0;
  const el = document.createElement('div'); el.className = 'bub'; el.style.display = 'none';
  el.innerHTML = `<div class="in"><div class="ord">${spec.order.map(orderHTML).join('')}</div><div class="pat"><i></i></div></div>`;
  OV.appendChild(el);
  const c = { inst, spot, phase: 'in', order: spec.order.map(o => ({ k: o.k, tops: o.tops.slice().sort(), got: false, pend: false })), el, its: [...el.querySelectorAll('.it')], bar: el.querySelector('.pat i'), t: 0, sway: day.r() * 6 };
  c.pat = c.patMax = day.pat * patienceMult() * (1 + 0.2 * (spec.order.length - 1));
  c.tx = spotX(spot); c.tz = ROOM.spotZ;
  el.addEventListener('pointerdown', e => { e.stopPropagation(); if (state === 'play') { unlock(); tapCustomer(c); } });
  customers.push(c); inst.k.play('walk', { ts: 1.2 });
  SND.bell();
  return true;
}
function customerLeave(c, happy) {
  c.phase = 'out'; c.spot = -1; c.happy = happy; c.el.classList.add(happy ? 'happy' : 'mad');
  setTimeout(() => { c.el.style.transition = 'opacity .3s'; c.el.style.opacity = '0'; }, happy ? 600 : 250);
  setTimeout(() => c.el.remove(), 1000);
  c.leaveT = happy ? 1.3 : 0.35;
  if (happy) c.inst.k.play(c.inst.k.actions.cheer ? 'cheer' : 'jump', { fade: 0.15 });
}
const _h = new THREE.Vector3();
function lerpAng(a, b, t) { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; }
function custH(c) { return c.inst.f.h * CS; }
function updateCustomers(dt) {
  for (let i = customers.length - 1; i >= 0; i--) {
    const c = customers[i], o = c.inst.k.object; c.t += dt;
    if (c.phase === 'in' || (c.phase === 'out' && (c.leaveT -= dt) <= 0)) {
      const tx = c.phase === 'in' ? c.tx : ROOM.doorX, tz = c.phase === 'in' ? c.tz : ROOM.backZ + 0.4;
      const dx = tx - o.position.x, dz = tz - o.position.z, d = Math.hypot(dx, dz), sp = c.phase === 'in' ? 2.4 : (c.happy ? 2.4 : 3.2);
      if (c.phase === 'out') c.inst.k.play('walk', { ts: c.happy ? 1.2 : 1.6 });
      if (d < 0.05) {
        if (c.phase === 'in') { c.phase = 'wait'; c.inst.k.play('idle'); c.el.style.display = ''; SND.pop(2); }
        else { o.visible = false; c.inst.busy = false; customers.splice(i, 1); continue; }
      } else {
        const stp = Math.min(d, sp * dt); o.position.x += dx / d * stp; o.position.z += dz / d * stp;
        o.rotation.y = lerpAng(o.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 10));
      }
    } else if (c.phase === 'wait') {
      o.rotation.y = lerpAng(o.rotation.y, Math.sin(c.t * 0.6 + c.sway) * 0.15, Math.min(1, dt * 5));
      if (state === 'play' && !paused) {
        c.pat -= dt;
        const f = c.pat / c.patMax;
        c.bar.style.transform = `scaleX(${clamp(f, 0, 1)})`;
        c.el.classList.toggle('mid', f < 0.5 && f >= 0.25); c.el.classList.toggle('low', f < 0.25);
        if (c.pat <= 0) angry(c);
      }
    } else if (c.phase === 'out') o.rotation.y = lerpAng(o.rotation.y, 0, Math.min(1, dt * 6));
    if (c.el.style.display !== 'none') {
      const [sx, sy] = toScreen(_h.set(o.position.x, custH(c) + 0.12, o.position.z));
      c.el.style.transform = `translate(${sx}px,${sy}px) translate(-50%,-100%)${c.phase === 'out' && c.happy ? ' scale(1.08)' : ''}`;
    }
  }
}
function angry(c) {
  lost++; combo = 0; comboT = 0; showCombo(); outcomes.push('💔');
  floatText(c, 'Hmph!', 'mad'); SND.angry(); buzz(40);
  const o = c.inst.k.object; puff(V3(o.position.x, custH(c) + 0.2, o.position.z), { color: 0xa898b8, n: 6, size: 0.45, up: 0.5, spread: 0.3, life: 1 });
  for (const it of c.order) it.pend = false;
  customerLeave(c, false);
}

// ---------------------------------------------------------------- serving
const sameTops = (a, b) => a.length === b.length && a.every((t, i) => t === b[i]);
function needers(k, tops) {   // waiting customers who still need dish k with exactly these toppings, most impatient first
  return customers.filter(c => c.phase === 'wait' && c.order.some(it => it.k === k && !it.got && !it.pend && sameTops(it.tops, tops))).sort((a, b) => a.pat / a.patMax - b.pat / b.patMax);
}
function wantTops(k) {   // does any waiting customer want dish k with toppings (still unserved)?
  return customers.some(c => c.phase === 'wait' && c.order.some(it => it.k === k && !it.got && !it.pend && it.tops.length));
}
function sendItem(k, tops, from, c, srcMesh) {
  const it = c.order.find(q => q.k === k && !q.got && !q.pend && sameTops(q.tops, tops)); if (!it) return false;
  it.pend = true;
  const m = srcMesh || itemMesh(k); m.visible = true;
  const o = c.inst.k.object;
  flyers.push({ m, k, c, it, a: from.clone(), b: V3(o.position.x, 1.15, o.position.z + 0.5), t: 0, dur: 0.35 + from.distanceTo(o.position) * 0.03 });
  SND.whoosh(); chefLook(c.tx);
  return true;
}
function updateFlyers(dt) {
  for (let i = flyers.length - 1; i >= 0; i--) {
    const f = flyers[i]; f.t += dt / f.dur; const t = Math.min(1, f.t);
    const o = f.c.inst.k.object; f.b.set(o.position.x, 1.15, o.position.z + 0.5);
    f.m.position.lerpVectors(f.a, f.b, t); f.m.position.y += Math.sin(t * Math.PI) * 1.4; f.m.rotation.y += dt * 9;
    f.m.scale.setScalar(DISH[f.k].s * (1 + Math.sin(t * Math.PI) * 0.3) * (t > 0.85 ? 1 - (t - 0.85) * 4 : 1));
    if (t >= 1) { flyers.splice(i, 1); freeItem(f.m); arrive(f.c, f.it); }
  }
}
function arrive(c, it) {
  it.pend = false;
  if (c.phase !== 'wait') return;
  it.got = true; c.its[c.order.indexOf(it)].classList.add('got');
  c.pat = Math.min(c.patMax, c.pat + c.patMax * 0.1);
  SND.serve(); buzz(12);
  const o = c.inst.k.object; puff(V3(o.position.x, 1.4, o.position.z + 0.3), { color: [0xfff27a, 0xff9fd0, 0xffffff], n: 6, size: 0.17, up: 1.4, spread: 0.3, life: 0.7, star: true });
  sticker('d_' + it.k);
  if (c.order.every(q => q.got)) complete(c);
}
function complete(c) {
  const base = c.order.reduce((s, q) => s + DISH[q.k].p + q.tops.reduce((a, t) => a + TOP[t].p, 0), 0), f = clamp(c.pat / c.patMax, 0, 1);
  const tip = Math.round(base * 0.3 * f * tipMult());
  combo = comboT > 0 ? combo + 1 : 1; comboT = 5; bestCombo = Math.max(bestCombo, combo);
  const cb = combo > 1 ? Math.min(5, combo - 1) : 0;
  const total = base + tip + cb; dayCoins += total; dayTips += tip + cb; served++;
  outcomes.push(f > 0.5 ? '💗' : '💛');
  floatText(c, `+${base}`, ''); if (tip + cb > 0) setTimeout(() => floatText(c, `+${tip + cb} tip`, 'tip'), 220);
  coinBurst(c, Math.min(8, 2 + Math.round(total / 5)));
  const o = c.inst.k.object; puff(V3(o.position.x, custH(c) + 0.3, o.position.z), { color: [0xff6fa8, 0xff9fd0], n: 4, size: 0.22, up: 1.1, spread: 0.4, life: 0.9, heart: true });
  showCombo(); if (combo >= 2) { SND.combo(combo); if (combo >= 3) chefCheer(); } if (combo >= 5) sticker('x_combo5');
  P.happy[c.inst.f.id] = (P.happy[c.inst.f.id] || 0) + 1; if (P.happy[c.inst.f.id] >= 5) sticker('f_' + c.inst.f.id);
  customerLeave(c, true); updateHud(true);
  if (!beatenShown && D.beaten(dayCoins)) { beatenShown = true; ui.pop('BEATEN!', '#ffe56b', 40, 30); confetti(scene, V3(0, 2, -1.5), 40); }
}

// ---------------------------------------------------------------- taps
function tapStation(s) {
  const k = s.def.item;
  chefLook(s.anchor.x);
  const ready = s.slots.filter((q, i) => i < nSlots(s.key) && q.state === 'ready');
  if (ready.length) {
    const sl = ready[0];
    const ns = needers(k, []);
    if (ns.length) { const m = sl.mesh; sl.mesh = null; sl.state = 'idle'; sendItem(k, [], m.position.clone(), ns[0], m); return true; }
    const canTop = (DISH[k].tops || []).some(t => day.tops.includes(t));
    const pl = plates.find((p, i) => i < nPlates() && !p.dish);
    if (canTop && pl) { const m = sl.mesh; sl.mesh = null; sl.state = 'idle'; toPlate(pl, k, m); return true; }
  }
  const free = s.slots.find((q, i) => i < nSlots(s.key) && q.state === 'idle');
  if (free) {
    free.state = 'cook'; free.t = 0; free.dur = cookTime(s.key); free.mesh = itemMesh(k); free.mesh.position.copy(free.pos); free.mesh.scale.setScalar(0.001);
    free.ring.style.display = ''; SND.tap(); SND[s.def.snd] && SND[s.def.snd](); squash(s.m.g); return true;
  }
  wobble(s.m.g); SND.no(); return false;
}
function toPlate(pl, k, m) {
  pl.dish = { k, tops: [], mesh: m };
  flyers2.push({ m, a: m.position.clone(), b: pl.pos.clone(), t: 0, dur: 0.28, k });
  SND.plate();
}
const flyers2 = [];   // slot → plate hops
function updateHops(dt) {
  for (let i = flyers2.length - 1; i >= 0; i--) {
    const f = flyers2[i]; f.t += dt / f.dur; const t = Math.min(1, f.t);
    f.m.position.lerpVectors(f.a, f.b, t); f.m.position.y += Math.sin(t * Math.PI) * 0.8; f.m.scale.setScalar(DISH[f.k].s * (1 + Math.sin(t * Math.PI) * 0.2));
    if (t >= 1) { flyers2.splice(i, 1); f.m.rotation.y = 0; }
  }
}
function tapGrab(g) {
  chefLook(g.pos.x);
  const ns = needers(g.k, []);
  if (!ns.length) { g.wob = 1; SND.no(); return false; }
  const m = itemMesh(g.k); m.position.copy(g.pos).add(V3(0, 0.1, 0)); SND.pop(1);
  g.wob = 0.6; sendItem(g.k, [], m.position.clone(), ns[0], m); return true;
}
function plateNeed(p) {   // the toppings still missing for some customer's order matching this plate's dish
  const out = [];
  for (const c of customers) if (c.phase === 'wait') for (const it of c.order) if (it.k === p.dish.k && !it.got && !it.pend && p.dish.tops.every(t => it.tops.includes(t))) out.push(it.tops.filter(t => !p.dish.tops.includes(t)));
  return out;
}
function tapJar(j) {
  chefLook(j.pos.x);
  const cands = plates.filter((p, i) => i < nPlates() && p.dish && (DISH[p.dish.k].tops || []).includes(j.t) && !p.dish.tops.includes(j.t));
  const pl = cands.find(p => plateNeed(p).some(n => n.includes(j.t))) || cands[0];
  if (!pl) { j.wob = 1; SND.no(); return false; }
  pl.dish.tops.push(j.t); pl.dish.tops.sort(); const tm = addTopMesh(pl.dish.mesh, j.t); const s0 = tm.scale.x; tm.scale.setScalar(0.01); popIn.push({ o: tm, t: 0, s: s0 });
  j.wob = 0.7; pl.wob = 0.6; SND.top(); puff(pl.pos.clone().add(V3(0, 0.45, 0)), { color: [0xfff27a, 0xffffff], n: 4, size: 0.13, up: 1, spread: 0.2, life: 0.5, star: true });
  return true;
}
function tapPlate(p) {
  if (!p.dish) return false;
  const ns = needers(p.dish.k, p.dish.tops);
  if (ns.length) { const d = p.dish; p.dish = null; sendItem(d.k, d.tops, d.mesh.position.clone(), ns[0], d.mesh); return true; }
  // nobody wants it like this: a second tap within 1.4 s tosses it
  if (p.tossT > 0) { tossPlate(p); return true; }
  p.tossT = 1.4; p.wob = 1; SND.no();
  const [sx, sy] = toScreen(p.pos.clone().add(V3(0, 0.6, 0))); floatAt(sx, sy, 'tap again to toss', 'hintf');
  return false;
}
function tossPlate(p) { const d = p.dish; p.dish = null; p.tossT = 0; SND.toss(); puff(d.mesh.position.clone().add(V3(0, 0.3, 0)), { color: 0xffffff, n: 6, size: 0.3, up: 0.8, spread: 0.3, life: 0.6 }); freeItem(d.mesh); }
function tapCustomer(c) {
  if (c.phase !== 'wait') return false;
  let any = false;
  for (const it of c.order) {
    if (it.got || it.pend) continue;
    const pl = plates.find((p, i) => i < nPlates() && p.dish && p.dish.k === it.k && sameTops(p.dish.tops, it.tops));
    if (pl) { const d = pl.dish; pl.dish = null; sendItem(d.k, d.tops, d.mesh.position.clone(), c, d.mesh); any = true; continue; }
    if (it.tops.length) continue;
    const st = DISH[it.k].st;
    if (st === 'grab') { const g = grabs[it.k]; if (g && g.on) { const m = itemMesh(it.k); m.position.copy(g.pos); sendItem(it.k, [], g.pos.clone(), c, m); any = true; } continue; }
    const s = stations[st]; if (!s) continue;
    const sl = s.slots.find((q, i) => i < nSlots(st) && q.state === 'ready');
    if (sl) { const m = sl.mesh; sl.mesh = null; sl.state = 'idle'; sendItem(it.k, [], m.position.clone(), c, m); any = true; }
  }
  if (!any) { c.el.animate([{ transform: c.el.style.transform + ' scale(1)' }, { transform: c.el.style.transform + ' scale(1.08)' }, { transform: c.el.style.transform + ' scale(1)' }], { duration: 200 }); SND.tap(); }
  return any;
}
const squashes = [];
function squash(g) { if (squashes.some(q => q.g === g)) return; squashes.push({ g, t: 0, kind: 's', base: g.scale.clone() }); }
function wobble(g) { if (squashes.some(q => q.g === g)) return; squashes.push({ g, t: 0, kind: 'w', base: g.scale.clone(), r: g.rotation.z }); }
function updateSquash(dt) {
  for (let i = squashes.length - 1; i >= 0; i--) {
    const q = squashes[i]; q.t += dt * 4; const e = Math.sin(q.t * Math.PI) * (1 - q.t);
    if (q.kind === 's') q.g.scale.set(q.base.x * (1 + e * 0.14), q.base.y * (1 - e * 0.16), q.base.z * (1 + e * 0.14));
    else q.g.rotation.z = q.r + Math.sin(q.t * 18) * 0.06 * (1 - q.t);
    if (q.t >= 1) { q.g.scale.copy(q.base); if (q.kind === 'w') q.g.rotation.z = q.r; squashes.splice(i, 1); }
  }
}
function pick(x, y) {
  let best = null, bd = 1e9;
  const R1 = Math.max(44, Math.min(W, H) * 0.115);
  const consider = (pos, obj, r) => { const [sx, sy, sz] = toScreen(pos); if (sz > 1) return; const d = Math.hypot(sx - x, sy - y); if (d < r && d < bd) { bd = d; best = obj; } };
  for (const s of Object.values(stations)) consider(s.anchor, { s }, R1);
  for (const g of Object.values(grabs)) consider(g.anchor, { g }, R1 * 0.9);
  for (const j of Object.values(jars)) consider(j.anchor, { j }, R1 * 0.9);
  plates.forEach((p, i) => { if (i < nPlates() && p.dish) consider(p.pos.clone().add(V3(0, 0.25, 0)), { p }, R1 * 0.8); });
  for (const c of customers) if (c.phase === 'wait') { const o = c.inst.k.object; consider(_h.set(o.position.x, custH(c) * 0.75, o.position.z), { c }, R1 * 0.9); }
  return best;
}
R.domElement.addEventListener('pointerdown', e => {
  unlock();
  if (state !== 'play' || paused) return;
  const h = pick(e.clientX, e.clientY); if (!h) return;
  const lk = h.s ? !h.s.on && DISH[h.s.def.item] : h.g ? !h.g.on && DISH[h.g.k] : h.j ? !h.j.on && TOP[h.j.t] : null;
  if (lk) { ui.pop(`${lk.n} unlocks later`, '#fff', 22, 62); SND.no(); return; }
  act(h);
});
const act = h => (h.c ? tapCustomer(h.c) : h.p ? tapPlate(h.p) : h.g ? tapGrab(h.g) : h.j ? tapJar(h.j) : tapStation(h.s));

// ---------------------------------------------------------------- station animation
function updateStations(dt) {
  const turbo = turboT > 0, tt = performance.now() / 1000;
  for (const s of Object.values(stations)) {
    let cooking = false;
    s.slots.forEach((sl, i) => {
      const vis = i < nSlots(s.key) && s.on;
      if (sl.state === 'cook' && !paused) {
        cooking = true; sl.t += dt * (turbo ? 4 : 1); const f = Math.min(1, sl.t / sl.dur);
        sl.mesh.scale.setScalar(DISH[s.def.item].s * (0.25 + 0.6 * f)); sl.mesh.rotation.y = f * 2;
        sl.fg.style.strokeDashoffset = (75.4 * (1 - f)).toFixed(1); sl.ring.classList.toggle('turbo', turbo);
        if (f >= 1) { sl.state = 'ready'; sl.ring.style.display = 'none'; SND.ding(); sl.bob = 1; puff(sl.pos.clone().add(V3(0, 0.3, 0)), { color: [0xfff27a, 0xff9fd0, 0xffffff], n: 7, size: 0.15, up: 1.2, spread: 0.25, life: 0.6, star: true }); }
      }
      if (sl.state === 'ready' && sl.mesh) {
        sl.bob = Math.max(0, sl.bob - dt * 2.5);
        sl.mesh.scale.setScalar(DISH[s.def.item].s * (1 + Math.sin(sl.bob * Math.PI) * 0.35)); sl.mesh.position.y = sl.pos.y + Math.abs(Math.sin(tt * 3 + i)) * 0.04; sl.mesh.rotation.y = Math.sin(tt * 1.5 + i) * 0.35;
      }
      if (sl.ring.style.display !== 'none' && vis) { const [sx, sy] = toScreen(_h.copy(sl.pos).add(V3(0, 0.6, 0))); sl.ring.style.transform = `translate(${sx}px,${sy}px)`; }
    });
    const m = s.m;
    if (m.heat) m.heat.material.opacity = cooking ? 0.22 + Math.sin(tt * 6) * 0.08 : Math.max(0, m.heat.material.opacity - dt);
    if (m.broth) m.broth.position.y = 0.56 + (cooking ? Math.sin(tt * 18) * 0.01 : 0);
    if (m.sign) { m.sign.rotation.y = cooking ? Math.sin(tt * 9) * 0.1 : m.sign.rotation.y * 0.9; m.sign.position.y = m.sign.position.y; }
    if (cooking && Math.random() < dt * 6) { const p = s.anchor.clone(); p.y += 0.35; puff(p, { color: 0xffffff, size: 0.32, up: 0.7, spread: 0.2, life: 1.1 }); }
  }
  for (const g of Object.values(grabs)) { g.wob = Math.max(0, g.wob - dt * 2.2); const e = Math.sin(g.wob * Math.PI * 3) * g.wob; g.items.forEach((o, j) => { o.scale.setScalar(DISH[g.k].s * 0.85 * (1 + e * 0.25)); o.position.y = g.pos.y + Math.abs(Math.sin(tt * 2 + j)) * 0.02; }); }
  for (const j of Object.values(jars)) { j.wob = Math.max(0, j.wob - dt * 2.2); const e = Math.sin(j.wob * Math.PI * 3) * j.wob; j.g.scale.set(1 + e * 0.15, 1 - e * 0.15, 1 + e * 0.15); }
  for (const p of plates) {
    p.tossT = Math.max(0, p.tossT - dt); p.wob = Math.max(0, p.wob - dt * 2.4); const e = Math.sin(p.wob * Math.PI * 3) * p.wob;
    p.g.scale.set(1 + e * 0.12, 1 - e * 0.12, 1 + e * 0.12);
    if (p.dish && !flyers2.some(f => f.m === p.dish.mesh)) { const m = p.dish.mesh; m.position.set(p.pos.x, p.pos.y + Math.abs(Math.sin(tt * 2.6 + p.i)) * 0.02, p.pos.z); m.scale.setScalar(DISH[p.dish.k].s * (1 + e * 0.2)); m.rotation.y = Math.sin(tt + p.i) * 0.2; }
  }
}

// ---------------------------------------------------------------- chef (k01) — trots to whatever you tap, cheers on combos
function chefLook(x) { chefTX = clamp(x * 0.85, -2.3, 2.3); }
function chefWave() { if (!chef) return; chef.cheerT = 2.6; chef.play('wave', { fade: 0.2 }); }
function chefCheer() { if (!chef) return; chef.cheerT = 1.6; chef.play('cheer', { fade: 0.15 }); }
function updateChef(dt) {
  if (!chef) return;
  const o = chef.object;
  o.visible = camMode !== 'play' || camBlend < 0.35;   // the chef steps aside while you cook (never blocks a machine)
  if (state !== 'play') { chefTX = W / H >= 0.8 ? 1.25 : 0; }
  const dx = chefTX - chefX; chefX += clamp(dx, -dt * 5.5, dt * 5.5); o.position.x = chefX; o.position.z = 3.35;
  chef.cheerT = Math.max(0, chef.cheerT - dt);
  const moving = Math.abs(dx) > 0.08;
  const yaw = moving ? Math.sign(dx) * Math.PI / 2 : 0;
  o.rotation.y = lerpAng(o.rotation.y, yaw, Math.min(1, dt * 12));
  if (chef.cheerT > 0) return;
  if (moving) chef.play('walk', { ts: 1.5 }); else chef.play('idle');
}

// ---------------------------------------------------------------- day flow
function curLevel() { return Math.min(P.prog[curRI] || 1, LEVELS_PER); }
let selLevel = null;   // a replayed day (journey tap) or null = next new day
function dayToPlay() { return D.seed ? 6 : selLevel || curLevel(); }
function startDay() {
  if (state === 'loading') { wantStart = true; return; }
  if (state === 'play') return;
  const i = dayToPlay();
  replay = !D.seed && (P.stars[sk(curRI, i)] || 0) > 0;
  const gl = curRI * LEVELS_PER + i;
  if (!D.seed && !replay && gl >= 6 && M.lives().n <= 0) { outOfLives(); return; }
  day = levelConfig(curRI, i, { fk: D.seed || gl <= 5 ? 1 : F.k(), seed: D.seed ? D.seed : null, daily: !!D.seed });
  day.next = 0; day.nextAt = 0.8; day.extra = 0;
  refreshUnlocks();
  for (const s of Object.values(stations)) for (const sl of s.slots) { if (sl.mesh) freeItem(sl.mesh); sl.mesh = null; sl.state = 'idle'; sl.ring.style.display = 'none'; }
  for (const p of plates) { if (p.dish) freeItem(p.dish.mesh); p.dish = null; }
  for (const c of customers) { c.inst.k.object.visible = false; c.inst.busy = false; c.el.remove(); }
  customers = []; for (const f of flyers) freeItem(f.m); flyers = []; flyers2.length = 0;
  dayCoins = 0; dayTips = 0; served = 0; lost = 0; combo = 0; comboT = 0; bestCombo = 0; outcomes = []; showCombo(); dayT = 0; turboT = 0; recorded = false; beatenShown = false; extraUsed = false;
  state = 'play'; camMode = 'play'; t0run = performance.now();
  $('hud').classList.remove('off'); $('boosts').classList.remove('off'); $('hday').textContent = D.seed ? '★' : i;
  updateHud(); updateBoosts();
  M.level(gl);
  ui.pop(D.seed ? 'Daily Rush!' : day.hard ? 'Hard day!' : `Day ${i}`, day.hard ? '#ffb3d9' : '#fff', 42, 34);
  setTimeout(() => state === 'play' && ui.pop(`Goal ${day.goal}`, '#fff27a', 30, 40), 900);
  if (day.debut.length) setTimeout(() => { if (state !== 'play') return; const d = day.debut[0]; ui.pop(d.startsWith('top:') ? `New: ${TOP[d.slice(4)].n}!` : `New: ${DISH[d].n}!`, '#c8ffe9', 30, 46); }, 2000);
  SND.start(); music(!P.mute);
  B.start();
}
function updateDay(dt) {
  if (state !== 'play' || paused) return;
  dayT += dt; turboT = Math.max(0, turboT - dt);
  if (comboT > 0) { comboT -= dt; if (comboT <= 0) { combo = 0; showCombo(); } else { const bar = $('combo').querySelector('i'); bar.style.transform = `scaleX(${comboT / 5})`; } }
  const total = day.n + day.extra;
  if (day.next < total && dayT >= day.nextAt) {
    const sp = freeSpot();
    if (sp >= 0 && spawnCustomer(day.specs[day.next % day.specs.length], sp)) { day.next++; day.nextAt = dayT + day.gap * (0.75 + day.r() * 0.5); updateHud(); }
  }
  if (day.next < total && !customers.some(c => c.phase !== 'out')) day.nextAt = Math.min(day.nextAt, dayT + 0.6);
  if (day.next >= total && !customers.some(c => c.phase !== 'out') && !flyers.length) endDay();
}
function starsFor(coins) { return coins >= day.stars[0] ? 1 + (coins >= day.stars[1] ? 1 : 0) + (coins >= day.stars[2] ? 1 : 0) : 0; }
function endDay() {
  if (recorded) return; recorded = true;
  const won = dayCoins >= day.goal;
  state = won ? 'won' : 'lost'; camMode = 'lobby'; combo = 0; comboT = 0; showCombo();
  $('hud').classList.add('off'); $('boosts').classList.add('off');
  music(false);
  if (won) finishWin(); else { SND.lose(); if (chef) { chef.cheerT = 0; } showLose(); }
}
function recordRun(won) {
  const ms = performance.now() - t0run, stars = starsFor(dayCoins);
  F.level(won, clamp(dayCoins / day.goal, 0, 1));
  B.submit(stars, { ms });
  return stars;
}
function finishWin() {
  const stars = recordRun(true);
  let gift = '';
  if (!D.seed) {
    const key = sk(curRI, day.i), prev = P.stars[key] || 0;
    if (stars > prev) P.stars[key] = stars;
    if (stars === 3 && prev < 3) { const b = day.gl % 2 ? 'turbo' : 'calm'; P.boost[b]++; gift = b === 'turbo' ? '+1 ⚡ Turbo' : '+1 🍵 Calm tea'; }
    if (day.i === P.prog[curRI]) P.prog[curRI]++;
    if (P.prog[curRI] > LEVELS_PER) sticker('r_' + REST[curRI].id);
    if (Object.values(P.stars).filter(s => s === 3).length >= 10) sticker('x_trophy');
  } else dailyWon();
  if (lost === 0) sticker('x_perfect');
  M.add(dayCoins, 'day');
  saveP();
  D.won(dayCoins, 'earned');
  SND.win(); confetti(scene, V3(0, 2.6, -0.8), 80); chefCheer();
  showWin(stars, gift);
}

// ---------------------------------------------------------------- daily streak (with one free freeze a week) + share grid
const dayNum = (d = new Date()) => Math.floor((d.getTime() - d.getTimezoneOffset() * 6e4) / 864e5);
const weekOf = n => Math.floor((n + 3) / 7);
function dailyInfo() {
  const today = dayNum(), done = P.dLast === today;
  const freezeOk = P.dFreezeWk !== weekOf(today);
  const alive = P.dLast >= today - 1 || (P.dLast === today - 2 && freezeOk);
  return { done, streak: alive ? P.dStreak : 0, freeze: freezeOk };
}
let freezeUsed = false;
function dailyWon() {
  const today = dayNum();
  if (P.dLast === today) return;
  if (P.dLast === today - 1) P.dStreak++;
  else if (P.dLast === today - 2 && P.dFreezeWk !== weekOf(today)) { P.dStreak++; P.dFreezeWk = weekOf(today); freezeUsed = true; }
  else P.dStreak = 1;
  P.dLast = today; P.dWon++;
  sticker('x_daily'); if (P.dStreak >= 3) sticker('x_streak');
}
function shareGrid() {
  const st = starsFor(dayCoins), d = new Date();
  const rows = []; for (let i = 0; i < outcomes.length; i += 7) rows.push(outcomes.slice(i, i + 7).join(''));
  const text = `Dumpling Dash · Daily Rush ${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}\n${'⭐'.repeat(st)}${'☆'.repeat(3 - st)}  🔥${P.dStreak}\n${rows.join('\n')}`;
  const url = location.origin + location.pathname + '?daily=1';
  if (navigator.share) navigator.share({ title: NAME, text, url }).catch(() => {});
  else navigator.clipboard && navigator.clipboard.writeText(text + '\n' + url).then(() => ui.pop('Copied!', '#fff', 28, 30)).catch(() => {});
}

// ---------------------------------------------------------------- HUD
function updateHud(bump) {
  if (!day) return;
  const goal3 = day.stars[2], f = Math.min(1, dayCoins / goal3);
  $('hcoins').textContent = dayCoins; $('hgoal').textContent = `goal ${day.goal}`;
  $('hbar').style.width = (f * 100).toFixed(1) + '%';
  const bs = document.querySelectorAll('.hbar b');
  day.stars.forEach((v, i) => { bs[i].style.left = (v / goal3 * 100) + '%'; const on = dayCoins >= v; if (on && !bs[i].classList.contains('on')) { SND.star(i); } bs[i].classList.toggle('on', on); });
  $('hcust').textContent = Math.max(0, day.n + day.extra - day.next + customers.filter(c => c.phase !== 'out').length);
  if (bump) $('hcoins').animate([{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'cubic-bezier(.2,1.6,.4,1)' });
}
function showCombo() {
  const el = $('combo');
  if (combo >= 2) { el.firstChild.textContent = `COMBO x${combo}`; el.classList.add('on'); el.animate([{ transform: 'translateX(-50%) scale(1.3)' }, { transform: 'translateX(-50%) scale(1)' }], { duration: 250 }); }
  else el.classList.remove('on');
}
function floatAt(sx, sy, txt, cls) { const d = document.createElement('div'); d.className = 'float ' + cls; d.textContent = txt; d.style.left = sx + 'px'; d.style.top = sy + 'px'; document.body.appendChild(d); setTimeout(() => d.remove(), 1150); }
function floatText(c, txt, cls) { const o = c.inst.k.object, [sx, sy] = toScreen(_h.set(o.position.x, custH(c) + 0.1, o.position.z)); floatAt(sx, sy, txt, cls); }
function coinBurst(c, n) {
  const o = c.inst.k.object, [sx, sy] = toScreen(_h.set(o.position.x, 1.4, o.position.z));
  const tgt = document.querySelector('#hud .coin').getBoundingClientRect();
  for (let i = 0; i < n; i++) {
    const d = document.createElement('div'); d.className = 'fly'; d.innerHTML = '<span class="coin"></span>';
    d.style.transform = `translate(${sx - 11 + (Math.random() - 0.5) * 40}px,${sy - 11 + (Math.random() - 0.5) * 30}px)`; document.body.appendChild(d);
    setTimeout(() => { d.style.transform = `translate(${tgt.left}px,${tgt.top}px) scale(.8)`; d.style.opacity = '0'; }, 30 + i * 45);
    setTimeout(() => { d.remove(); if (i % 2 === 0) SND.coin(i); }, 760 + i * 45);
  }
}

// ---------------------------------------------------------------- boosters (earned by play; coins buy more)
const BOOST_COST = 150;
function updateBoosts() {
  for (const [id, k] of [['bt', 'turbo'], ['bc', 'calm']]) { const b = $(id); b.querySelector('b').textContent = P.boost[k] || `${BOOST_COST}`; b.classList.toggle('buy', !P.boost[k]); }
  $('bt').classList.toggle('live', turboT > 0);
}
function haveBoost(k) {
  if (P.boost[k] > 0) { P.boost[k]--; return true; }
  if (M.spend(BOOST_COST, 'booster-' + k)) return true;
  M.toast(`${BOOST_COST} coins for a booster`); SND.no(); return false;
}
function useTurbo() { if (state !== 'play' || turboT > 0 || !haveBoost('turbo')) return false; saveP(); turboT = 8; SND.boost(); ui.pop('TURBO KITCHEN!', '#e3d6ff', 34, 30); ui.flash(0.25); updateBoosts(); setTimeout(updateBoosts, 8100); return true; }
function useCalm() {
  if (state !== 'play') return false;
  const w = customers.filter(c => c.phase === 'wait'); if (!w.length) return false;
  if (!haveBoost('calm')) return false;
  saveP(); SND.boost(); ui.pop('Calm tea for all!', '#c8ffe9', 32, 30);
  for (const c of w) { c.pat = c.patMax; const o = c.inst.k.object; puff(V3(o.position.x, custH(c) + 0.2, o.position.z), { color: [0xff8fbf, 0xff6fa8], n: 5, size: 0.2, up: 1, spread: 0.3, life: 0.9, heart: true }); }
  updateBoosts(); return true;
}
for (const [id, fn] of [['bt', useTurbo], ['bc', useCalm]]) { const b = $(id); b.addEventListener('pointerdown', e => { e.stopPropagation(); unlock(); fn(); }); }
$('mute').addEventListener('pointerdown', e => { e.stopPropagation(); P.mute = !P.mute; saveP(); setMuted(P.mute); $('mute').textContent = P.mute ? '🔇' : '🔊'; music(!P.mute && state === 'play'); });
setMuted(P.mute); $('mute').textContent = P.mute ? '🔇' : '🔊';

// ---------------------------------------------------------------- stickers (album)
const stDef = id => STICKERS.find(s => s.id === id);
function sticker(id) {
  if (P.stickers.includes(id) || !stDef(id)) return;
  P.stickers.push(id); P.newSt.push(id); saveP();
  const s = stDef(id), el = document.createElement('div'); el.className = 'stk-pop'; el.innerHTML = `<img alt="" src="${s.icon}"><b>New sticker!</b><small>${s.n}</small>`;
  document.body.appendChild(el); SND.sticker(); setTimeout(() => el.classList.add('go'), 1500); setTimeout(() => el.remove(), 2300);
  renderBadges();
}

// ---------------------------------------------------------------- lobby: logo, coins, map of restaurants, days, play, kitchen, décor, album, daily
const startEl = ui.els.start;
const lob = document.createElement('div'); lob.className = 'lob'; startEl.appendChild(lob);
lob.innerHTML = `
  <div class="ltop"><button class="pill coins" id="lcoins"><span class="coin"></span><b id="lcoinsn">0</b><i>+</i></button><button class="pill lives" id="llives">❤<b id="llivesn">5</b></button><span class="lsp"></span><button class="rbtn" id="lalbum"><img alt="" src="./assets/icons/x05.webp"><small>Album</small><b hidden></b></button></div>
  <div class="logo"><b>Dumpling</b><span>Dash</span></div>
  <div class="map" id="map"></div>
  <div class="rname" id="rname"></div>
  <div class="journey" id="journey"></div>
  <div class="lspace"></div>
  <button class="dailyb" id="dailyb"></button>
  <div class="prow"><button class="sbtn" data-open="up"><img alt="" src="./assets/icons/f10.webp"><small>Kitchen</small><b></b></button><button class="playbtn" id="playbtn">Play</button><button class="sbtn" data-open="decor"><img alt="" src="./assets/icons/h06.webp"><small>Décor</small><b></b></button></div>
  <div class="sheet" id="sheet" hidden><div class="shop" id="shop"><div class="tabs"><button data-tab="up" class="on">Kitchen</button><button data-tab="decor">Décor</button><button data-tab="album">Album</button><span class="bank"><span class="coin"></span><span id="bank">0</span></span><button class="x" id="shopx">✕</button></div><div class="charm" id="charm"></div><div class="row" id="shoprow"></div></div></div>`;
let shopTab = 'up';
const stop = el => ['pointerdown', 'pointerup'].forEach(ev => el.addEventListener(ev, e => e.stopPropagation()));
for (const id of ['sheet', 'journey', 'map', 'lcoins', 'llives', 'lalbum', 'dailyb']) stop($(id));
for (const b of lob.querySelectorAll('.tabs button')) { stop(b); b.addEventListener('click', e => { e.stopPropagation(); shopTab = b.dataset.tab; SND.tap(); renderLobby(); }); }
for (const b of lob.querySelectorAll('.sbtn')) { stop(b); b.addEventListener('click', e => { e.stopPropagation(); openSheet(b.dataset.open); }); }
$('lalbum').addEventListener('click', e => { e.stopPropagation(); openSheet('album'); });
$('lcoins').addEventListener('click', e => { e.stopPropagation(); SND.tap(); M.shop(); });
$('llives').addEventListener('click', e => { e.stopPropagation(); const L = M.lives(); if (L.n < L.max && !L.unlimited) M.rewarded('lives'); else M.toast(L.unlimited ? 'Unlimited hearts ✓' : 'Hearts are full ✓'); });
$('dailyb').addEventListener('click', e => { e.stopPropagation(); SND.tap(); if (D.seed) { location.search = ''; return; } location.search = '?daily=1'; });
$('sheet').addEventListener('click', e => { if (e.target.id === 'sheet' || e.target.id === 'shopx') { e.stopPropagation(); $('sheet').hidden = true; SND.tap(); renderLobby(); } });
$('playbtn').addEventListener('pointerdown', e => { e.stopPropagation(); });
$('playbtn').addEventListener('click', e => { e.stopPropagation(); unlock(); ui.hideStart(); startDay(); });
function openSheet(tab) { shopTab = tab; $('sheet').hidden = false; SND.tap(); renderLobby(); }
M.onChange(() => { if (state !== 'play') renderTop(); });
function renderTop() {
  $('lcoinsn').textContent = M.coins(); $('bank').textContent = M.coins();
  const L = M.lives(); $('llivesn').textContent = L.unlimited ? '∞' : L.n;
}
function renderBadges() {
  const n = P.newSt.length + albumGifts().length; const b = $('lalbum').querySelector('b'); b.textContent = n; b.hidden = !n;
}
function albumGifts() { return [0, 1, 2].filter(pg => !P.pagesPaid.includes(pg) && STICKERS.filter(s => s.page === pg).every(s => P.stickers.includes(s.id))); }

function upgrades() {
  const Rr = REST[curRI], list = [];
  for (const key of Rr.kitchen) {
    const item = STN[key].item, icon = dishIcon(item), s = upN(key + '_s'), n = upN(key + '_n');
    list.push({ id: key + '_s', icon, t: `${STN[key].n} speed`, lv: s, max: 3, cost: [180, 420, 840][s] });
    list.push({ id: key + '_n', icon, t: `${STN[key].n} +1 slot`, lv: n, max: 1, cost: [390][n] });
  }
  list.splice(2, 0, { id: 'plates', em: '🍽️', t: 'Extra plate', lv: upN('plates'), max: 2, cost: [300, 720][upN('plates')] });
  list.splice(4, 0, { id: 'tips', em: '🫙', t: 'Tip jar +15%', lv: upN('tips'), max: 3, cost: [270, 600, 1080][upN('tips')] });
  return list;
}
function renderLobby() {
  renderTop(); renderBadges();
  // map of restaurants
  $('map').innerHTML = REST.map((r, ri) => { const open = restOpen(ri), st = Array.from({ length: LEVELS_PER }, (_, i) => P.stars[sk(ri, i + 1)] || 0).reduce((a, b) => a + b, 0);
    return `<button class="pin ${ri === curRI ? 'on' : ''} ${open ? '' : 'lock'}" data-r="${ri}" style="--pc:${r.theme.sign}"><span class="pb"><img alt="" src="./assets/icons/${r.icon}.webp">${open ? '' : '<i>🔒</i>'}</span><small>${open ? `★ ${st}/${LEVELS_PER * 3}` : `★ ${r.need}`}</small></button>`; }).join('<span class="dots"></span>');
  for (const b of $('map').querySelectorAll('.pin')) b.addEventListener('click', e => { e.stopPropagation(); const ri = +b.dataset.r; if (!restOpen(ri)) { const prevDone = P.prog[ri - 1] > LEVELS_PER; M.toast(prevDone ? `Collect ★ ${REST[ri].need} to open ${REST[ri].n}` : `Clear ${REST[ri - 1].n} first`); SND.no(); return; } if (D.seed) return; SND.tap(); P.cur = ri; selLevel = null; saveP(); setRestaurant(ri); renderLobby(); });
  const Rr = REST[curRI];
  $('rname').innerHTML = `<b>${Rr.n}</b><small>${Rr.tag}</small>`;
  // days in this restaurant
  $('journey').style.visibility = D.seed ? 'hidden' : '';
  const J = $('journey'), top = LEVELS_PER, cur = curLevel(), done = P.prog[curRI] > LEVELS_PER;
  J.innerHTML = Array.from({ length: top }, (_, i) => { const d = i + 1, st = P.stars[sk(curRI, d)] || 0, sel = (selLevel || cur) === d; const hard = (curRI * LEVELS_PER + d) > 6 && (curRI * LEVELS_PER + d) % 6 === 0;
    return `<button class="jd ${sel ? 'cur' : ''} ${d > P.prog[curRI] ? 'lock' : ''} ${hard ? 'hard' : ''}" data-d="${d}">${d}<i>${st ? '★'.repeat(st) + '☆'.repeat(3 - st) : ''}</i></button>`; }).join('');
  for (const b of J.querySelectorAll('.jd')) b.addEventListener('click', e => { e.stopPropagation(); const d = +b.dataset.d; if (d > P.prog[curRI]) { SND.no(); return; } SND.tap(); selLevel = d === curLevel() && !done ? null : d; renderLobby(); });
  const i = dayToPlay(), cfg = levelConfig(curRI, i, { daily: !!D.seed, seed: D.seed || null });
  $('playbtn').innerHTML = D.seed ? `Daily Rush<small>${cfg.n} guests · goal <span class="coin"></span>${cfg.goal}</small>` : `${cfg.hard ? 'Hard ' : ''}Day ${i}<small>${cfg.n} guests · goal <span class="coin"></span>${cfg.goal}</small>`;
  $('playbtn').classList.toggle('hard', !!cfg.hard);
  const di = dailyInfo();
  $('dailyb').innerHTML = D.seed ? '← Back to my café' : di.done ? `Daily Rush ✓ <small>🔥 ${di.streak} · back tomorrow</small>` : `Daily Rush <small>${di.streak ? `🔥 ${di.streak}-day streak` : 'same rush for everyone'}${di.freeze ? ' · ❄️ freeze ready' : ''}</small>`;
  // sheet
  for (const b of lob.querySelectorAll('.tabs button')) b.classList.toggle('on', b.dataset.tab === shopTab);
  const nUp = upgrades().filter(u => u.lv < u.max && u.cost <= M.coins()).length, nDe = Rr.decor.filter(d => !decorOf(curRI).includes(d.id) && d.cost <= M.coins()).length;
  lob.querySelectorAll('.sbtn b').forEach((b, k) => { const n = k ? nDe : nUp; b.textContent = n; b.hidden = !n; });
  const row = $('shoprow'); row.className = 'row ' + shopTab;
  if (shopTab === 'up') {
    $('charm').textContent = 'Faster machines, more slots and plates keep the queue happy.';
    row.innerHTML = upgrades().map(u => { const max = u.lv >= u.max; return `<button class="card ${max ? 'own' : M.coins() < u.cost ? 'no' : ''}" data-id="${u.id}">${u.icon ? `<img alt="" src="${u.icon}">` : `<div class="em">${u.em}</div>`}<b>${u.t}</b><div class="lv">${Array.from({ length: u.max }, (_, k) => `<i class="${k < u.lv ? 'on' : ''}"></i>`).join('')}</div><div class="pr">${max ? 'MAX' : `<span class="coin"></span>${u.cost}`}</div></button>`; }).join('');
  } else if (shopTab === 'decor') {
    $('charm').textContent = `${Rr.n} cuteness ${decorOf(curRI).length}/${Rr.decor.length} · each piece gives guests +5% patience here`;
    row.innerHTML = Rr.decor.map(d => { const own = decorOf(curRI).includes(d.id); return `<button class="card ${own ? 'own' : M.coins() < d.cost ? 'no' : ''}" data-d="${d.id}"><img alt="" src="./assets/icons/${d.id}.webp"><b>${d.n}</b><div class="pr">${own ? '✓ Placed' : `<span class="coin"></span>${d.cost}`}</div></button>`; }).join('');
  } else {
    const gifts = albumGifts();
    $('charm').innerHTML = `Sticker album ${P.stickers.length}/${STICKERS.length} · fill a page for a coin gift`;
    row.innerHTML = [0, 1, 2].map(pg => `<div class="page"><h4>${['Menu', 'Friends & moments', 'Restaurants'][pg]} ${gifts.includes(pg) ? `<button class="claim" data-pg="${pg}">Claim <span class="coin"></span>${PAGE_GIFT[pg]}</button>` : P.pagesPaid.includes(pg) ? '<em>✓ complete</em>' : `<em><span class="coin"></span>${PAGE_GIFT[pg]}</em>`}</h4><div class="stk">${STICKERS.filter(s => s.page === pg).map((s, k) => { const own = P.stickers.includes(s.id), nw = P.newSt.includes(s.id); return `<div class="st ${own ? 'own' : ''} ${nw ? 'new' : ''}" style="--r:${((k * 37) % 9 - 4) * 1.4}deg" title="${s.how}"><img alt="" src="${s.icon}"><small>${own ? s.n : s.how}</small></div>`; }).join('')}</div></div>`).join('');
    for (const b of row.querySelectorAll('.claim')) b.addEventListener('click', e => { e.stopPropagation(); const pg = +b.dataset.pg; if (P.pagesPaid.includes(pg)) return; P.pagesPaid.push(pg); M.add(PAGE_GIFT[pg], 'album-page'); saveP(); SND.buy(); renderLobby(); });
    setTimeout(() => { P.newSt = []; saveP(); renderBadges(); }, 400);
  }
  for (const b of row.querySelectorAll('.card')) b.addEventListener('click', e => { e.stopPropagation(); b.dataset.id ? buyUp(b.dataset.id) : buyDecor(b.dataset.d); });
}
function buyUp(id) {
  const u = upgrades().find(q => q.id === id); if (!u || u.lv >= u.max) return false;
  if (!M.spend(u.cost, 'upgrade-' + id)) { SND.no(); M.toast('Not enough coins yet'); return false; }
  P.up[id] = (P.up[id] || 0) + 1; saveP(); SND.buy(); buzz(15);
  const key = id.split('_')[0]; if (stations[key]) { squash(stations[key].m.g); puff(stations[key].anchor, { color: [0xfff27a, 0xff9fd0], n: 10, size: 0.2, up: 1.4, spread: 0.5, life: 0.9, star: true }); }
  refreshUnlocks(); renderLobby(); return true;
}
function buyDecor(id) {
  const d = REST[curRI].decor.find(q => q.id === id); if (!d || decorOf(curRI).includes(id)) return false;
  if (!M.spend(d.cost, 'decor-' + id)) { SND.no(); M.toast('Not enough coins yet'); return false; }
  P.decor[curRI] = decorOf(curRI).concat(id); saveP(); SND.buy(); buzz(15); placeDecor(d, true); renderLobby(); return true;
}

// ---------------------------------------------------------------- result cards (one offer per screen)
const winBox = document.createElement('div'); winBox.className = 'resbox'; ui.els.win.appendChild(winBox); ui.els.win.classList.add('res');
const loseBox = document.createElement('div'); loseBox.className = 'resbox'; ui.els.lose.appendChild(loseBox); ui.els.lose.classList.add('res');
const shareBtn = ui.els.win.querySelector('.hc-btn');
function lines() {
  const base = dayCoins - dayTips;
  return `<div class="rl"><span>Guests served</span><b>${served}/${day.n + day.extra}</b></div><div class="rl"><span>Sales</span><b><span class="coin"></span>${base}</b></div><div class="rl"><span>Tips & combos</span><b><span class="coin"></span>${dayTips}</b></div><div class="rl"><span>Best combo</span><b>x${Math.max(1, bestCombo)}</b></div>`;
}
function showWin(stars, gift) {
  const fz = freezeUsed; freezeUsed = false;
  winBox.innerHTML = `<div class="rt">${D.seed ? 'Daily Rush' : `${REST[curRI].n} · Day ${day.i}`}</div><h2>${['', 'Yummy!', 'So kawaii!', 'Purr-fect!'][stars]}</h2>
    <div class="stars"><span>★</span><span>★</span><span>★</span></div>${lines()}
    <div class="rl tot"><span>Earned</span><b><span class="coin"></span><em id="wc">${dayCoins}</em></b></div>
    ${gift ? `<div class="gift">🎁 ${gift}</div>` : ''}${D.seed ? `<div class="gift">🔥 ${P.dStreak}-day streak${fz ? ' · ❄️ freeze used' : ''}</div>` : ''}
    <div class="btns"><button class="hc-btn dbl" id="dbl">▶ Double coins</button>${D.seed ? '<button class="hc-btn grid" id="grid">Share grid</button>' : ''}<span class="slot"></span></div><div class="tapc">Tap to continue</div>`;
  if (shareBtn) { if (D.seed) shareBtn.remove(); else winBox.querySelector('.slot').appendChild(shareBtn); }
  const dbl = winBox.querySelector('#dbl');
  stop(dbl); dbl.addEventListener('click', async e => { e.stopPropagation(); dbl.disabled = true; if (await M.rewarded('double', { what: `${dayCoins * 2} coins instead of ${dayCoins}` })) { M.add(dayCoins, 'double'); winBox.querySelector('#wc').textContent = dayCoins * 2; SND.buy(); dbl.remove(); } else dbl.disabled = false; });
  const gb = winBox.querySelector('#grid'); if (gb) { stop(gb); gb.addEventListener('click', e => { e.stopPropagation(); shareGrid(); }); }
  ui.win(day.i, ''); const ss = winBox.querySelectorAll('.stars span'); for (let i = 0; i < stars; i++) setTimeout(() => { ss[i].classList.add('on'); SND.star(i); buzz(10); }, 900 + i * 380);
}
function showLose() {
  loseBox.innerHTML = `<div class="rt">${D.seed ? 'Daily Rush' : `${REST[curRI].n} · Day ${day.i}`}</div><h2>So close!</h2>
    <div class="goalline">You made <span class="coin"></span>${dayCoins} of <span class="coin"></span>${day.goal}</div>${lines()}
    <div class="btns" id="lbtns"></div><div class="tapc">Tap to try again</div>`;
  ui.lose('', '');
  // one offer, never in the first 1.2 s after losing: reopen the doors for 4 more guests (the same day, same rules)
  setTimeout(() => {
    if (state !== 'lost' || extraUsed) return;
    const b = document.createElement('button'); b.className = 'hc-btn dbl'; b.textContent = '▶ +4 more guests'; stop(b); $('lbtns').appendChild(b);
    b.addEventListener('click', async e => { e.stopPropagation(); b.disabled = true; if (await M.rewarded('moves', { what: 'The doors stay open for 4 more guests', title: '4 more guests' })) reopen(); else b.disabled = false; });
  }, 1300);
}
function reopen() {
  extraUsed = true; day.extra = 4; recorded = false; ui.els.lose.classList.add('hc-hidden');
  day.nextAt = dayT + 0.5; state = 'play'; camMode = 'play'; $('hud').classList.remove('off'); $('boosts').classList.remove('off'); updateHud(); music(!P.mute); ui.pop('Doors open!', '#fff', 36, 34);
}
function loseCleanup() {
  const gl = curRI * LEVELS_PER + day.i;
  recordRun(false);
  if (!D.seed && !replay && gl >= 6) M.useLife();
  M.add(Math.floor(dayCoins / 2), 'day-tips');
}
function outOfLives() {
  state = 'ready';
  const L = M.lives(), mins = L.nextAt ? Math.max(1, Math.ceil((L.nextAt - Date.now()) / 60000)) : 0;
  const v = document.createElement('div'); v.className = 'olv'; v.innerHTML = `<div class="resbox"><div class="rt">Out of hearts</div><h2>Take a tea break</h2><p>Next heart in ${mins} min. Replaying a day you already cleared, or the Daily Rush, never costs a heart.</p><div class="btns"><button class="hc-btn dbl" id="olvr">▶ Refill hearts</button></div><div class="tapc">Tap to go back</div></div>`;
  document.body.appendChild(v); stop(v.querySelector('#olvr'));
  v.querySelector('#olvr').addEventListener('click', async e => { e.stopPropagation(); if (await M.rewarded('lives')) { v.remove(); renderLobby(); } });
  v.addEventListener('click', () => { v.remove(); ui.start(); renderLobby(); });
  ui.start(); renderLobby();
}
ui.onTap(async which => {
  unlock();
  if (which === 'start') { /* the lobby has its own play button; tapping the backdrop also plays */ startDay(); return; }
  if (which === 'lose') loseCleanup();
  state = 'ready';
  await M.breakAd('level-end', { level: curRI * LEVELS_PER + (day ? day.i : 1) });
  selLevel = null; renderLobby(); ui.start(); chefWave();
});

// ---------------------------------------------------------------- what to do next (bot plays it; new players see a pointing hand)
function suggest() {
  const wait = customers.filter(c => c.phase === 'wait').sort((a, b) => a.pat / a.patMax - b.pat / b.patMax);
  // 1. a plate that's done → serve it
  for (const p of plates) if (p.dish && needers(p.dish.k, p.dish.tops).length) return { p };
  // 2. a plate missing a topping someone wants → that jar
  for (const p of plates) if (p.dish) { const need = plateNeed(p).find(n => n.length); if (need) { const j = jars[need[0]]; if (j && j.on) return { j }; } }
  // 3. a ready slot someone wants (plain) or that should go to a plate
  for (const c of wait) for (const it of c.order) {
    if (it.got || it.pend) continue;
    const st = DISH[it.k].st; if (st === 'grab') continue;
    const s = stations[st]; if (!s || !s.on) continue;
    const ready = s.slots.some((q, i) => i < nSlots(st) && q.state === 'ready');
    if (ready && (!it.tops.length ? true : plates.some((p, i) => i < nPlates() && !p.dish) && !plates.some(p => p.dish && p.dish.k === it.k && p.dish.tops.every(t => it.tops.includes(t))))) return { s };
  }
  // 4. a grab item someone wants
  for (const c of wait) for (const it of c.order) if (!it.got && !it.pend && DISH[it.k].st === 'grab' && grabs[it.k] && grabs[it.k].on) return { g: grabs[it.k] };
  // 5. cook what's needed but not yet cooking
  for (const c of wait) for (const it of c.order) {
    if (it.got || it.pend || DISH[it.k].st === 'grab') continue;
    const key = DISH[it.k].st, s = stations[key]; if (!s || !s.on) continue;
    const need = customers.reduce((a, q) => a + (q.phase === 'wait' ? q.order.filter(o => o.k === it.k && !o.got && !o.pend).length : 0), 0);
    const have = s.slots.filter((q, i) => i < nSlots(key) && q.state !== 'idle').length + plates.filter(p => p.dish && p.dish.k === it.k).length;
    if (need > have && s.slots.some((q, i) => i < nSlots(key) && q.state === 'idle')) return { s };
  }
  // 6. a plate nobody wants → toss
  for (const p of plates) if (p.dish && !plateNeed(p).length) return { p, toss: true };
  return null;
}
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on day 1, until the first real touch,
// the hinted station starts cooking twice (the dish is the player's to serve; no customer is served for them), so the counter moves
demo(() => { const g = suggest(); if (!g || !g.s || g.s.slots.some(q => q.state === 'ready')) return; act(g); },
  { ready: () => state === 'play' && !paused && !D.seed && day && day.gl === 1 && $('sheet').hidden, wait: 1500, every: 1400, max: 2 });
const hintEl = document.createElement('div'); hintEl.id = 'hint'; hintEl.innerHTML = '<i>👆</i><b></b>'; hintEl.style.display = 'none'; document.body.appendChild(hintEl);
let idleT = 0;
addEventListener('pointerdown', () => { idleT = 0; hintEl.style.display = 'none'; }, true);
function updateHint(dt) {
  const teach = state === 'play' && !D.seed && (day.gl <= 3 || (day.debut.length && served < 2));
  if (!teach) { hintEl.style.display = 'none'; return; }
  idleT += dt; if (idleT < (served ? 3 : 1.4)) { hintEl.style.display = 'none'; return; }
  const g = suggest(); if (!g) { hintEl.style.display = 'none'; return; }
  const pos = g.p ? g.p.pos.clone().add(V3(0, 0.3, 0)) : g.j ? g.j.anchor : g.g ? g.g.anchor : g.s.anchor;
  const [sx, sy] = toScreen(pos);
  hintEl.style.display = ''; hintEl.style.transform = `translate(${sx}px,${sy}px)`;
  hintEl.querySelector('b').textContent = g.p ? (g.toss ? 'Tap twice to toss' : 'Serve!') : g.j ? 'Add topping' : g.g ? 'Tap to serve' : g.s.slots.some(q => q.state === 'ready') ? 'Ready! Tap' : 'Tap to cook';
}

// ---------------------------------------------------------------- test hooks + bot (human pace)
let botNext = 0;
window.__game = {
  perf: () => ({ calls: R.info.render.calls, tris: R.info.render.triangles, geo: R.info.memory.geometries, tex: R.info.memory.textures }),
  get state() { return state === 'loading' ? 'ready' : state; }, get level() { return curRI * LEVELS_PER + dayToPlay(); }, get score() { return state === 'play' ? dayCoins : totalStars(); },
  get coins() { return M.coins(); }, get stars() { return P.stars; }, get customers() { return customers.length; }, get day() { return day && { gl: day.gl, n: day.n, goal: day.goal, stars: day.stars, pat: day.pat, gap: day.gap }; },
  get money() { return M; }, P,
  start: () => { ui.hideStart(); startDay(); },
  bot() {
    if (state === 'loading') return;
    if (state === 'ready') {
      if (!$('sheet').hidden) { $('sheet').hidden = true; return; }
      if (Math.random() < 0.4) { const u = upgrades().filter(q => q.lv < q.max && q.cost <= M.coins() * 0.6).sort((a, b) => a.cost - b.cost)[0]; if (u) { buyUp(u.id); return; } }
      const d = REST[curRI].decor.find(q => !decorOf(curRI).includes(q.id) && q.cost <= M.coins() * 0.4); if (d) { buyDecor(d.id); return; }
      if (document.querySelector('.olv')) { document.querySelector('.olv').click(); return; }
      ui.hideStart(); startDay(); return;
    }
    if (state !== 'play') return;
    const now = performance.now(); if (now < botNext) return; botNext = now + 380 + Math.random() * 260;   // human pace
    const wait = customers.filter(c => c.phase === 'wait');
    if (wait.some(c => c.pat / c.patMax < 0.22) && P.boost.calm && Math.random() < 0.15) { useCalm(); return; }
    const g = suggest(); if (g) { act(g); return; }
    if (P.boost.turbo && wait.length >= 3 && Math.random() < 0.05) useTurbo();
  },
};

// ---------------------------------------------------------------- boot
loop((dt60) => {
  const dt = Math.min(0.05, dt60 / 60);
  if (world) {
    updateDay(dt); updateCustomers(dt); updateFlyers(dt); updateHops(dt); updateStations(dt); updateChef(dt); updateSquash(dt); updateSprites(dt); updatePop(dt); updateLocks(); if (day) updateHint(dt);
    for (const c of custPool) if (c.k.object.visible) c.k.mixer.update(dt);
    if (chef) chef.mixer.update(dt);
    const tt = performance.now() / 1000; world.bulbs.forEach((b, i) => { b.material.emissiveIntensity = 0.85 + Math.sin(tt * 2 + i) * 0.12; b.rotation.z = Math.sin(tt * 0.8 + i) * 0.05; });
  }
  updateCam(dt);
  if (world) world.sign.visible = camBlend > 0.4 || W / H >= 0.8;   // on a phone the lobby logo takes the sign's place
  R.info.reset(); C.render(dt);
});

(async function boot() {
  startEl.style.pointerEvents = 'none';
  await Promise.all(MODEL_IDS.map(id => loader.loadAsync(`./assets/${id}.glb`).then(g => { MODELS[id] = prep(g.scene); prog(); })));
  if (!restOpen(P.cur) && !D.seed) P.cur = 0;
  setRestaurant(D.seed ? D.seed % REST.length : P.cur);
  await loadCast();
  state = 'ready'; renderLobby();
  startEl.style.pointerEvents = '';
  chefWave();
  $('load').classList.add('gone'); setTimeout(() => $('load').remove(), 600);
  if (wantStart) { ui.hideStart(); startDay(); }
})();
