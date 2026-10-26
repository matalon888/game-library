// Sugarloaf Café: Cooking Rush — original café time-management game. Customers (Hero Lab characters) queue at the counter
// with order bubbles; tap machines to brew/cook, tap pastries or ready food to serve, tap a customer to hand over what's
// ready. Patience hearts, tips, combos, days with coin goals and stars, kitchen upgrades and décor between days.
// Art: AI-generated 3D props (assets/*.glb, copied from assets/cozy) + Hero Lab characters; room and machines built in code.
import { THREE, createUI, store, loop, buzz, burst, confetti, clamp, lerp, rng } from './kit/hc.js';
import { cine } from './kit/cine.js';
import { GLTFLoader } from './kit/addons/loaders/GLTFLoader.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { heroBar, selectedHero, loadHero, onHeroesChange } from './kit/heroes.js';
import { buildWorld, ROOM } from './world.js';
import { S as SND, music, setMuted, unlock } from './audio.js';

const NAME = 'Sugarloaf Café: Cooking Rush', KEY = 'sugarloaf-cafe';
const Q = new URLSearchParams(location.search);
const ST = store(KEY);
const P = Object.assign({ level: 1, coins: 0, stars: {}, up: {}, decor: [], boost: { turbo: 2, calm: 2 }, mute: false, best: 0 }, ST.get('p', {}));
const saveP = () => { try { ST.set('p', P); } catch (e) {} };
const $ = id => document.getElementById(id);

// ---------------------------------------------------------------- menu + kitchen data
const IT = {
  cap: { m: 'f01', n: 'Cappuccino', p: 6, st: 'esp', lvl: 1, s: 0.42 },
  cro: { m: 'f02', n: 'Croissant', p: 5, st: 'pastry', lvl: 1, s: 0.46 },
  cup: { m: 'g13', n: 'Cupcake', p: 6, st: 'pastry', lvl: 2, s: 0.4 },
  mil: { m: 'f07', n: 'Milkshake', p: 8, st: 'shake', lvl: 3, s: 0.5 },
  don: { m: 'f04', n: 'Donut', p: 6, st: 'pastry', lvl: 4, s: 0.44 },
  pan: { m: 'f03', n: 'Pancakes', p: 10, st: 'grill', lvl: 5, s: 0.46 },
  mac: { m: 'f05', n: 'Macarons', p: 9, st: 'pastry', lvl: 7, s: 0.42 },
  smo: { m: 'f15', n: 'Smoothie', p: 9, st: 'smoo', lvl: 8, s: 0.46 },
  san: { m: 'f09', n: 'Club sandwich', p: 12, st: 'press', lvl: 10, s: 0.46 },
  waf: { m: 'f16', n: 'Waffle', p: 11, st: 'waf', lvl: 12, s: 0.46 },
  bub: { m: 'f08', n: 'Bubble tea', p: 9, st: 'boba', lvl: 14, s: 0.48 },
  cak: { m: 'g14', n: 'Strawberry cake', p: 10, st: 'pastry', lvl: 16, s: 0.44 },
  cin: { m: 'f17', n: 'Cinnamon roll', p: 8, st: 'pastry', lvl: 18, s: 0.44 },
  cho: { m: 'f06', n: 'Chocolate cake', p: 11, st: 'pastry', lvl: 20, s: 0.44 },
};
const PASTRY = ['cro', 'cup', 'don', 'mac', 'cak', 'cin', 'cho'], PS = 1.3;
const STN = {
  esp: { item: 'cap', t: 2.0, n: 'Espresso', snd: 'steam' },
  shake: { item: 'mil', t: 2.4, n: 'Blender', snd: 'whirr' },
  smoo: { item: 'smo', t: 2.6, n: 'Smoothies', snd: 'whirr' },
  boba: { item: 'bub', t: 2.8, n: 'Boba bar', snd: 'pour' },
  grill: { item: 'pan', t: 3.2, n: 'Griddle', snd: 'sizzle' },
  waf: { item: 'waf', t: 3.4, n: 'Waffle iron', snd: 'press' },
  press: { item: 'san', t: 3.0, n: 'Panini press', snd: 'press' },
};
const DECOR = [
  { id: 'h05', n: 'Monstera', cost: 60, size: 1.35, pos: [-1.35, 0, -6.95], rot: 0.3 },
  { id: 'h16', n: 'Painting', cost: 110, size: 0.9, pos: [-1.55, 2.6, -7.5], rot: 0 },
  { id: 'tea', n: 'Tea set', cost: 160 },
  { id: 'h04', n: 'Brass lamp', cost: 210, size: 1.9, pos: [-2.25, 0, -6.9], rot: 0.2 },
  { id: 'h28', n: 'Lavender', cost: 260, size: 0.8, pos: [2.35, 0, -6.55], rot: -0.2 },
  { id: 'h15', n: 'Gramophone', cost: 320, size: 0.75, pos: [-3.5, 0, -5.2], rot: 0.7 },
  { id: 'h06', n: 'Fiddle fig', cost: 400, size: 1.55, pos: [3.6, 0, -5.3], rot: -0.4 },
  { id: 'h02', n: 'Armchair', cost: 500, size: 1.15, pos: [-4.7, 0, -3.4], rot: 0.9 },
  { id: 'h07', n: 'Bookshelf', cost: 640, size: 2.1, pos: [5.5, 0, -6.9], rot: -0.4 },
  { id: 'h17', n: 'Chandelier', cost: 800, size: 1.2, pos: [0, 3.55, -5.6], rot: 0 },
];
const CUST_IDS = ['p05', 'p08', 'p07', 'p02', 'p06', 'c08', 'p14'];
const CUST_H = { p05: 1.5, p08: 1.68, p07: 1.6, p02: 1.62, p06: 1.7, c08: 1.66, p14: 1.6 };
const OWNER_DEFAULT = 'p14';

// ---------------------------------------------------------------- renderer + post
const LITE = Q.has('lite') || (Math.min(screen.width, screen.height) < 500 && devicePixelRatio > 2.5);
const R = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
R.setSize(innerWidth, innerHeight); R.info.autoReset = false; R.domElement.className = 'hc-canvas'; document.body.prepend(R.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xf4dccb);
const cam = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.3, 90);
const C = cine(R, scene, cam, { bloom: 0.18, bloomThreshold: 1.0, bloomRadius: 0.45, exposure: 0.92, envIntensity: 0.4, lite: LITE, grade: { sat: 1.18, contrast: 1.1, vignette: 0.1, grain: 0 } });
scene.add(new THREE.HemisphereLight(0xfff3e6, 0xb98a74, 0.62));
const sun = new THREE.DirectionalLight(0xffeedd, 1.9); sun.position.set(3.5, 12, 6.5); sun.target.position.set(0, 0, -2.2);
sun.castShadow = true; sun.shadow.mapSize.set(C.lite ? 1024 : 2048, C.lite ? 1024 : 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025; sun.shadow.radius = 4;
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 34 });
scene.add(sun, sun.target);
const warm = new THREE.PointLight(0xffc98a, 3, 8, 1.6); warm.position.set(0, 3.6, -3.6); scene.add(warm);

// ---------------------------------------------------------------- UI + kit layers
const ui = createUI({ title: 'Sugarloaf Café', hint: '', hand: '' });
const D = daily(KEY, ui, { name: NAME });
const B = board({ game: 'sugarloaf-cafe', label: 'Best day (coins)', limits: { maxRun: 4000, maxPerSec: 60 }, corner: 'tl', accent: '#ff5d8f' });
const F = flow(KEY);
const OV = $('ov');

// ---------------------------------------------------------------- loading
const loader = new GLTFLoader();
const MODELS = {};
const MODEL_IDS = ['f01', 'f02', 'f03', 'f04', 'f05', 'f06', 'f07', 'f08', 'f09', 'f10', 'f11', 'f12', 'f13', 'f14', 'f15', 'f16', 'f17', 'g13', 'g14', 'g10', 'g09', 'h18',
  'h05', 'h04', 'h16', 'h28', 'h15', 'h06', 'h02', 'h07', 'h17'];
let loaded = 0, toLoad = MODEL_IDS.length + CUST_IDS.length + 1;
const prog = () => { loaded++; const b = document.querySelector('#load i'); if (b) b.style.width = Math.round(loaded / toLoad * 100) + '%'; };
// the cozy GLBs are Z-up with a node offset: stand them up (+90° about X), centre on x/z, rest on y = 0, largest side = 1
function prep(scene) {
  scene.rotation.x = Math.PI / 2;
  const w = new THREE.Group(); w.add(scene); w.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(w), sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
  scene.position.set(-c.x, -bb.min.y, -c.z); w.scale.setScalar(1 / Math.max(sz.x, sz.y, sz.z));
  const root = new THREE.Group(); root.add(w);
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; const m = o.material; if (m) { if (m.metalness > 0.6) m.metalness = 0.6; m.envMapIntensity = 0.9; } } });
  return root;
}
function place(id, { size = 1, pos = [0, 0, 0], rot = 0, parent = scene } = {}) {
  const o = MODELS[id].clone(); o.scale.setScalar(size); o.position.set(pos[0], pos[1], pos[2]); o.rotation.y = rot; parent.add(o); return o;
}

// ---------------------------------------------------------------- game state
let state = 'loading', W = innerWidth, H = innerHeight;
let world = null, stations = {}, pastries = {}, owner = null, ownerX = -0.15, ownerTX = 0, ownerFace = 0, ownerBusy = 0;
let day = null, customers = [], custPool = [], flyers = [], fx = [], dayCoins = 0, dayTips = 0, served = 0, lost = 0, combo = 0, comboT = 0, bestCombo = 0;
let dayT = 0, turboT = 0, recorded = false, beatenShown = false, t0run = 0, shake = 0, camMode = 'lobby', camBlend = 0, wantStart = false, decorObjs = {};
const priceMult = () => 1 + 0.1 * (P.up.price || 0);
const patienceMult = () => 1 + 0.05 * P.decor.length;
const unlocked = L => Object.keys(IT).filter(k => IT[k].lvl <= L);
const curL = () => (D.seed ? 12 : P.level);

// ---------------------------------------------------------------- camera framing (portrait phone vs wide desktop)
const V3 = (x, y, z) => new THREE.Vector3(x, y, z), LOBX = -0.15;
const CAMS = { play: null, lobby: null };
function frameCams() {
  const a = W / H;
  if (a < 0.8) {   // phone portrait
    const k = clamp((0.46 - a) / 0.1, -1, 1);   // narrower than an iPhone → pull back a bit
    CAMS.play = sph(V3(0, 13.5 + k * 0.8, 13.5 + k * 0.8), V3(0, 1.5, -1.6), 33 + k * 2);
    CAMS.lobby = sph(V3(-0.3, 2.75, -5.6), V3(LOBX, 1.25, -2.3), 40 + k * 4);
  } else {
    CAMS.play = sph(V3(0, 7.4, 5.9), V3(0, 0.9, -1.75), 46);
    CAMS.lobby = sph(V3(0.5, 2.75, -6.9), V3(0.75, 1.3, -2.3), 34);
  }
}
function sph(pos, look, fov) { const d = pos.clone().sub(look), r = d.length(); return { t: look, r, el: Math.asin(d.y / r), az: Math.atan2(d.x, d.z), fov }; }
const _cp = V3(0, 0, 0), _cl = V3(0, 0, 0);
function updateCam(dt) {
  camBlend = clamp(camBlend + (camMode === 'play' ? 1 : -1) * dt * 0.9, 0, 1);
  const e = camBlend < 0.5 ? 4 * camBlend ** 3 : 1 - (-2 * camBlend + 2) ** 3 / 2;
  const A = CAMS.lobby, Bc = CAMS.play;
  _cl.lerpVectors(A.t, Bc.t, e);
  const r = lerp(A.r, Bc.r, e), el = lerp(A.el, Bc.el, e) + Math.sin(e * Math.PI) * 0.35, az = lerp(A.az, Bc.az, e);
  _cp.set(_cl.x + r * Math.cos(el) * Math.sin(az), _cl.y + r * Math.sin(el), _cl.z + r * Math.cos(el) * Math.cos(az));
  const tt = performance.now() / 1000;
  if (camMode === 'lobby') { _cp.x += Math.sin(tt * 0.25) * 0.25; _cp.y += Math.sin(tt * 0.33) * 0.06; }
  if (shake > 0) { _cp.x += (Math.random() - 0.5) * shake; _cp.y += (Math.random() - 0.5) * shake; shake = Math.max(0, shake - dt * 0.6); }
  cam.position.copy(_cp); cam.lookAt(_cl);
  const f = lerp(CAMS.lobby.fov, CAMS.play.fov, e); if (Math.abs(cam.fov - f) > 0.01) { cam.fov = f; cam.updateProjectionMatrix(); }
}
function resize() {
  W = innerWidth; H = innerHeight; R.setSize(W, H); cam.aspect = W / H; cam.updateProjectionMatrix(); C.resize(W, H); frameCams();
}
addEventListener('resize', resize);
frameCams();

// ---------------------------------------------------------------- screen projection helpers
const _v = new THREE.Vector3();
function toScreen(v) { _v.copy(v).project(cam); return [(_v.x + 1) / 2 * W, (1 - _v.y) / 2 * H, _v.z]; }

// ---------------------------------------------------------------- soft steam/sparkle sprites (pooled)
const softT = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const starT = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.translate(32, 32); x.fillStyle = '#fff'; x.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? 7 : 30, a = i / 8 * Math.PI * 2; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.fill(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const SPR = [];
for (let i = 0; i < 40; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softT, transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; scene.add(s); SPR.push({ s, life: 0 }); }
function puff(pos, { color = 0xffffff, n = 1, size = 0.3, up = 0.6, spread = 0.1, life = 1.2, star = false, add = false } = {}) {
  for (let k = 0; k < n; k++) {
    const p = SPR.find(q => q.life <= 0); if (!p) return;
    p.s.material.map = star ? starT : softT; p.s.material.color.set(color); p.s.material.blending = add ? THREE.AdditiveBlending : THREE.NormalBlending;
    p.s.position.set(pos.x + (Math.random() - 0.5) * spread, pos.y, pos.z + (Math.random() - 0.5) * spread);
    p.v = V3((Math.random() - 0.5) * spread * 2, up * (0.7 + Math.random() * 0.6), (Math.random() - 0.5) * spread * 2);
    p.life = p.max = life * (0.8 + Math.random() * 0.4); p.size = size * (0.7 + Math.random() * 0.6); p.s.visible = true; p.star = star;
  }
}
function updateSprites(dt) {
  for (const p of SPR) {
    if (p.life <= 0) continue; p.life -= dt; const k = 1 - p.life / p.max;
    p.s.position.addScaledVector(p.v, dt); if (p.star) p.v.y -= dt * 1.5;
    const sc = p.size * (p.star ? (1 - k * 0.6) : (0.6 + k * 1.2)); p.s.scale.set(sc, sc, sc);
    p.s.material.opacity = p.star ? Math.min(1, (1 - k) * 2) : Math.sin(k * Math.PI) * 0.55; p.s.material.rotation = k * (p.star ? 3 : 0.6);
    if (p.life <= 0) { p.s.visible = false; p.s.material.opacity = 0; }
  }
}

// ---------------------------------------------------------------- item meshes (pooled clones, never removed → shared GPU data stays alive)
const itemPool = {};
function itemMesh(k) {
  const list = itemPool[k] || (itemPool[k] = []);
  let o = list.find(q => !q.userData.busy);
  if (!o) { o = MODELS[IT[k].m].clone(); o.userData.k = k; o.traverse(q => { if (q.isMesh) q.castShadow = false; }); scene.add(o); list.push(o); }
  o.userData.busy = true; o.visible = true; o.scale.setScalar(IT[k].s); o.rotation.set(0, 0, 0); return o;
}
function freeItem(o) { o.visible = false; o.userData.busy = false; }

// ---------------------------------------------------------------- stations
function makeStations() {
  const M = world.machines; scene.updateMatrixWorld(true);
  for (const [key, def] of Object.entries(STN)) {
    const m = M[key], slots = [];
    for (let i = 0; i < 3; i++) {
      const [x, z] = m.slots[i], y = m.top ?? ROOM.kitH;
      const ring = document.createElement('div'); ring.className = 'ring'; ring.innerHTML = '<svg viewBox="0 0 34 34"><circle class="bg" cx="17" cy="17" r="12"/><circle class="fg" cx="17" cy="17" r="12"/></svg>'; ring.style.display = 'none'; OV.appendChild(ring);
      slots.push({ i, pos: V3(x, y, z), state: 'idle', t: 0, dur: 1, mesh: null, ring, fg: ring.querySelector('.fg'), bob: 0 });
    }
    const anchor = m.g.getWorldPosition(V3(0, 0, 0)); anchor.y += 0.3;
    if (['shake', 'smoo', 'boba'].includes(key)) anchor.y += 0.25;
    stations[key] = { key, def, m, slots, anchor, on: false, act: 0 };
  }
  // pastries on cake stands along the front counter
  PASTRY.forEach((k, i) => {
    const pos = world.pastrySpots[i], o = MODELS[IT[k].m].clone(); o.scale.setScalar(IT[k].s * PS); o.position.copy(pos); o.rotation.y = (i % 2 ? -0.3 : 0.3); scene.add(o);
    pastries[k] = { k, o, pos, anchor: pos.clone().add(V3(0, 0.2, 0)), on: false, wob: 0 };
  });
}
function nSlots(key) { return 1 + (P.up[key + '_n'] || 0); }
function cookTime(key) { return STN[key].t * Math.pow(0.8, P.up[key + '_s'] || 0) / (1 + 0); }
const lockTags = [];
function refreshUnlocks() {
  const L = curL(), un = unlocked(L);
  for (const t of lockTags) t.el.remove(); lockTags.length = 0;
  for (const s of Object.values(stations)) { s.on = un.includes(s.def.item); if (!s.on) addLock(s.anchor, IT[s.def.item].lvl); }
  for (const p of Object.values(pastries)) { p.on = un.includes(p.k); p.o.visible = p.on; if (!p.on) addLock(p.pos.clone().add(V3(0, 0.12, 0)), 0); }
}
function addLock(pos, lvl) { const el = document.createElement('div'); el.className = 'lk'; el.innerHTML = lvl ? `🔒<small>${lvl}</small>` : '🔒'; if (!lvl) el.classList.add('sm'); OV.appendChild(el); lockTags.push({ el, pos }); }
function updateLocks() { const on = state === 'play' && camBlend > 0.97; for (const t of lockTags) { t.el.style.display = on ? '' : 'none'; if (!on) continue; const [sx, sy] = toScreen(t.pos); t.el.style.transform = `translate(${sx}px,${sy}px) translate(-50%,-50%)`; } }

// ---------------------------------------------------------------- customers
async function loadCustomers() {
  for (const id of CUST_IDS) {
    try {
      const k = await loadHero(THREE, GLTFLoader, { hero: { char: id }, assets: './assets/heroes/', height: CUST_H[id] || 1.62, shadows: true });
      k.object.visible = false; scene.add(k.object);
      for (const n of ['cheer', 'jump']) if (k.actions[n]) { k.actions[n].setLoop(THREE.LoopOnce, 1); k.actions[n].clampWhenFinished = true; }
      custPool.push({ id, k, busy: false, cur: '' });
    } catch (e) { console.warn('customer', id, e); }
    prog();
  }
}
function play(c, name, ts = 1, fade = 0.25) {
  const a = c.k.actions[name]; if (!a) return;
  a.timeScale = ts;
  if (c.cur === name && !['cheer', 'jump'].includes(name)) return;
  c.k.play(name, { fade }); a.timeScale = ts; c.cur = name;
}
const SPOTS4 = [-1.95, -0.65, 0.65, 1.95], SPOTS3 = [-1.4, 0, 1.4];
function spotX(i) { return (day.spots === 3 ? SPOTS3 : SPOTS4)[i]; }
function freeSpot() { for (let i = 0; i < day.spots; i++) if (!customers.some(c => c.spot === i)) return i; return -1; }
function spawnCustomer(spec, spot) {
  const free = custPool.filter(c => !c.busy && !(owner && owner.char === c.id));
  if (!free.length) return false;
  const inst = free[Math.floor(day.r() * free.length)]; inst.busy = true;
  const o = inst.k.object; o.visible = true; o.position.set(ROOM.doorX + (day.r() - 0.5) * 0.4, 0, ROOM.backZ + 0.7);
  const el = document.createElement('div'); el.className = 'bub'; el.style.display = 'none';
  el.innerHTML = `<div class="in"><div class="ord">${spec.order.map(k => `<div class="it" data-k="${k}"><img alt="" src="./assets/icons/${IT[k].m}.webp"></div>`).join('')}</div><div class="hearts">${'<span>♥</span>'.repeat(5)}</div></div>`;
  OV.appendChild(el);
  const c = { inst, spot, phase: 'in', order: spec.order.map(k => ({ k, got: false, pend: false })), pat: day.pat * patienceMult() * (1 + 0.12 * (spec.order.length - 1)), el, its: [...el.querySelectorAll('.it')], hearts: [...el.querySelectorAll('.hearts span')], t: 0, sway: day.r() * 6 };
  c.patMax = c.pat; c.tx = spotX(spot); c.tz = ROOM.spotZ;
  el.addEventListener('pointerdown', e => { e.stopPropagation(); if (state === 'play') { unlock(); tapCustomer(c); } });
  customers.push(c); play(inst, 'run', 0.5);
  SND.bell();
  return true;
}
function customerLeave(c, happy) {
  c.phase = 'out'; c.spot = -1; c.happy = happy; c.el.classList.add(happy ? 'happy' : 'mad');
  setTimeout(() => { c.el.style.transition = 'opacity .3s, transform .3s'; c.el.style.opacity = '0'; }, happy ? 500 : 200);
  setTimeout(() => c.el.remove(), 900);
  c.leaveT = happy ? 0.95 : 0.25;
  if (happy) play(c.inst, 'cheer', 1.1, 0.15);
}
function updateCustomers(dt) {
  for (let i = customers.length - 1; i >= 0; i--) {
    const c = customers[i], o = c.inst.k.object; c.t += dt;
    if (c.phase === 'in' || (c.phase === 'out' && (c.leaveT -= dt) <= 0)) {
      const tx = c.phase === 'in' ? c.tx : ROOM.doorX, tz = c.phase === 'in' ? c.tz : ROOM.backZ + 0.4;
      const dx = tx - o.position.x, dz = tz - o.position.z, d = Math.hypot(dx, dz), sp = c.phase === 'in' ? 2.1 : (c.happy ? 2.3 : 3.2);
      if (c.phase === 'out') play(c.inst, 'run', c.happy ? 0.62 : 0.85);
      if (d < 0.05) {
        if (c.phase === 'in') { c.phase = 'wait'; play(c.inst, 'idle', 1); c.el.style.display = ''; SND.pop(2); }
        else { o.visible = false; c.inst.busy = false; customers.splice(i, 1); continue; }
      } else {
        const st = Math.min(d, sp * dt); o.position.x += dx / d * st; o.position.z += dz / d * st;
        const yaw = Math.atan2(dx, dz); o.rotation.y = lerpAng(o.rotation.y, yaw, Math.min(1, dt * 10));
        o.position.y = Math.abs(Math.sin(c.t * 7.5)) * 0.035;
      }
    } else if (c.phase === 'wait') {
      o.rotation.y = lerpAng(o.rotation.y, Math.sin(c.t * 0.6 + c.sway) * 0.12, Math.min(1, dt * 5)); o.position.y = 0;
      if (state === 'play') {
        c.pat -= dt;
        const f = c.pat / c.patMax, n = Math.ceil(f * 5 - 0.001);
        c.hearts.forEach((h, j) => h.classList.toggle('off', j >= n));
        c.el.classList.toggle('low', f < 0.22);
        if (c.pat <= 0) angry(c);
      }
    } else if (c.phase === 'out') { o.rotation.y = lerpAng(o.rotation.y, 0, Math.min(1, dt * 6)); }
    // bubble follows the head
    if (c.el.style.display !== 'none') {
      const [sx, sy] = toScreen(_h.set(o.position.x, (CUST_H[c.inst.id] || 1.62) + 0.32, o.position.z));
      c.el.style.transform = `translate(${sx}px,${sy}px) translate(-50%,-100%)${c.phase === 'out' && c.happy ? ' scale(1.08)' : ''}`;
    }
  }
}
const _h = new THREE.Vector3();
function lerpAng(a, b, t) { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; }
function angry(c) {
  lost++; combo = 0; comboT = 0; showCombo();
  floatText(c, '😤', 'mad'); SND.angry(); buzz(40);
  const o = c.inst.k.object; puff(V3(o.position.x, 1.9, o.position.z), { color: 0x9a8a8a, n: 6, size: 0.45, up: 0.5, spread: 0.3, life: 1 });
  for (const it of c.order) it.pend = false;
  customerLeave(c, false);
}

// ---------------------------------------------------------------- serving
function needers(k) {   // waiting customers who still need item k, most impatient first
  return customers.filter(c => c.phase === 'wait' && c.order.some(it => it.k === k && !it.got && !it.pend)).sort((a, b) => a.pat / a.patMax - b.pat / b.patMax);
}
function sendItem(k, from, c, srcMesh = null) {
  const it = c.order.find(q => q.k === k && !q.got && !q.pend); if (!it) return false;
  it.pend = true;
  const m = srcMesh || itemMesh(k); m.visible = true;
  const o = c.inst.k.object;
  flyers.push({ m, k, c, it, a: from.clone(), b: V3(o.position.x, 1.1, o.position.z + 0.35), t: 0, dur: 0.4 + from.distanceTo(o.position) * 0.035 });
  SND.whoosh(); ownerLook(c.tx, -1);
  return true;
}
function updateFlyers(dt) {
  for (let i = flyers.length - 1; i >= 0; i--) {
    const f = flyers[i]; f.t += dt / f.dur; const t = Math.min(1, f.t);
    const o = f.c.inst.k.object; f.b.set(o.position.x, 1.1, o.position.z + 0.35);
    f.m.position.lerpVectors(f.a, f.b, t); f.m.position.y += Math.sin(t * Math.PI) * 1.5; f.m.rotation.y += dt * 9;
    f.m.scale.setScalar(IT[f.k].s * (1 + Math.sin(t * Math.PI) * 0.25) * (t > 0.85 ? 1 - (t - 0.85) * 4 : 1));
    if (t >= 1) { flyers.splice(i, 1); freeItem(f.m); arrive(f.c, f.it); }
  }
}
function arrive(c, it) {
  it.pend = false;
  if (c.phase !== 'wait') return;
  it.got = true; const idx = c.order.indexOf(it); c.its[idx].classList.add('got');
  c.pat = Math.min(c.patMax, c.pat + c.patMax * 0.12);
  SND.serve(); buzz(12);
  const o = c.inst.k.object; puff(V3(o.position.x, 1.3, o.position.z + 0.3), { color: 0xffe08a, n: 5, size: 0.16, up: 1.4, spread: 0.3, life: 0.7, star: true, add: true });
  if (c.order.every(q => q.got)) complete(c);
}
function complete(c) {
  const base = c.order.reduce((s, q) => s + IT[q.k].p, 0), f = clamp(c.pat / c.patMax, 0, 1);
  const pay = Math.round(base * priceMult()), tip = Math.round(base * 0.35 * f);
  combo = comboT > 0 ? combo + 1 : 1; comboT = 4.5; bestCombo = Math.max(bestCombo, combo);
  const cb = combo > 1 ? Math.min(5, combo - 1) : 0;
  const total = pay + tip + cb; dayCoins += total; dayTips += tip + cb; served++;
  floatText(c, `+${pay}`, ''); if (tip + cb > 0) setTimeout(() => floatText(c, `+${tip + cb} tip`, 'tip'), 220);
  coinBurst(c, Math.min(8, 2 + Math.round(total / 6)));
  showCombo(); if (combo >= 2) { SND.combo(combo); if (combo >= 3) ownerCheer(); }
  customerLeave(c, true); updateHud(true);
  if (!beatenShown && D.beaten(dayCoins)) { beatenShown = true; ui.pop('BEATEN!', '#ffe56b', 40, 30); confetti(scene, V3(0, 2, -1.5), 40); }
}

// ---------------------------------------------------------------- taps
function tapStation(s) {
  const st = s.def, k = st.item;
  const ready = s.slots.filter((q, i) => i < nSlots(s.key) && q.state === 'ready');
  const ns = needers(k);
  ownerLook(s.anchor.x, 1);
  if (ready.length && ns.length) {   // hand a ready one to whoever needs it most
    const sl = ready[0], m = sl.mesh; sl.mesh = null; sl.state = 'idle';
    sendItem(k, m.position.clone(), ns[0], m); return true;
  }
  const free = s.slots.find((q, i) => i < nSlots(s.key) && q.state === 'idle');
  if (free) {
    free.state = 'cook'; free.t = 0; free.dur = cookTime(s.key); free.mesh = itemMesh(k); free.mesh.position.copy(free.pos); free.mesh.scale.setScalar(0.001);
    free.ring.style.display = ''; s.act = 1; SND.tap(); SND[st.snd](); squash(s.m.g); return true;
  }
  wobble(s.m.g); SND.no(); return false;
}
function tapPastry(p) {
  const ns = needers(p.k);
  ownerLook(p.pos.x, 1);
  if (!ns.length) { p.wob = 1; SND.no(); return false; }
  const m = itemMesh(p.k); m.position.copy(p.pos); SND.pop(1);
  p.wob = 0.6; sendItem(p.k, p.pos.clone().add(V3(0, 0.1, 0)), ns[0], m); return true;
}
function tapCustomer(c) {
  if (c.phase !== 'wait') return false;
  let any = false;
  for (const it of c.order) {
    if (it.got || it.pend) continue;
    const st = IT[it.k].st; if (st === 'pastry') continue;
    const s = stations[st], sl = s.slots.find((q, i) => i < nSlots(st) && q.state === 'ready');
    if (sl) { const m = sl.mesh; sl.mesh = null; sl.state = 'idle'; sendItem(it.k, m.position.clone(), c, m); any = true; }
  }
  if (!any) { c.el.animate([{ transform: c.el.style.transform + ' scale(1)' }, { transform: c.el.style.transform + ' scale(1.08)' }, { transform: c.el.style.transform + ' scale(1)' }], { duration: 200 }); SND.tap(); }
  return any;
}
const squashes = [];
function squash(g) { squashes.push({ g, t: 0, kind: 's', base: g.scale.clone() }); }
function wobble(g) { squashes.push({ g, t: 0, kind: 'w', base: g.scale.clone(), r: g.rotation.z }); }
function updateSquash(dt) {
  for (let i = squashes.length - 1; i >= 0; i--) {
    const q = squashes[i]; q.t += dt * 4; const e = Math.sin(q.t * Math.PI) * (1 - q.t);
    if (q.kind === 's') q.g.scale.set(q.base.x * (1 + e * 0.12), q.base.y * (1 - e * 0.14), q.base.z * (1 + e * 0.12));
    else q.g.rotation.z = q.r + Math.sin(q.t * 18) * 0.06 * (1 - q.t);
    if (q.t >= 1) { q.g.scale.copy(q.base); if (q.kind === 'w') q.g.rotation.z = q.r; squashes.splice(i, 1); }
  }
}
// pick the nearest thing on screen (forgiving taps on a phone)
function pick(x, y) {
  let best = null, bd = 1e9;
  const R1 = Math.max(46, Math.min(W, H) * 0.12);
  const consider = (pos, obj, r) => { const [sx, sy, sz] = toScreen(pos); if (sz > 1) return; const d = Math.hypot(sx - x, sy - y); if (d < r && d < bd) { bd = d; best = obj; } };
  for (const s of Object.values(stations)) consider(s.anchor, { s }, R1);
  for (const p of Object.values(pastries)) consider(p.anchor, { p }, R1 * 0.85);
  for (const c of customers) if (c.phase === 'wait') { const o = c.inst.k.object; consider(_h.set(o.position.x, 1.25, o.position.z), { c }, R1 * 1.1); }
  return best;
}
R.domElement.addEventListener('pointerdown', e => {
  unlock();
  if (state !== 'play') return;
  const h = pick(e.clientX, e.clientY); if (!h) return;
  const lk = h.s ? !h.s.on && IT[h.s.def.item] : h.p ? !h.p.on && IT[h.p.k] : null;   // locked: say when it opens
  if (lk) { ui.pop(`${lk.n}: unlocks on day ${lk.lvl}`, '#fff', 22, 62); SND.no(); return; }
  if (h.s) tapStation(h.s); else if (h.p) tapPastry(h.p); else if (h.c) tapCustomer(h.c);
});

// ---------------------------------------------------------------- station animation
function updateStations(dt) {
  const turbo = turboT > 0;
  for (const s of Object.values(stations)) {
    if (!s.on) continue;
    let cooking = false;
    s.slots.forEach((sl, i) => {
      const vis = i < nSlots(s.key);
      if (sl.state === 'cook') {
        cooking = true; sl.t += dt * (turbo ? 5 : 1); const f = Math.min(1, sl.t / sl.dur);
        sl.mesh.scale.setScalar(IT[s.def.item].s * (0.25 + 0.6 * f)); sl.mesh.rotation.y = f * 2;
        sl.fg.style.strokeDashoffset = (75.4 * (1 - f)).toFixed(1); sl.ring.classList.toggle('turbo', turbo);
        if (f >= 1) { sl.state = 'ready'; sl.ring.style.display = 'none'; SND.ding(); sl.bob = 1; puff(sl.pos.clone().add(V3(0, 0.3, 0)), { color: 0xfff1a8, n: 6, size: 0.14, up: 1.2, spread: 0.25, life: 0.6, star: true, add: true }); }
      }
      if (sl.state === 'ready' && sl.mesh) {
        sl.bob = Math.max(0, sl.bob - dt * 2.5); const tt = performance.now() / 1000;
        sl.mesh.scale.setScalar(IT[s.def.item].s * (1 + Math.sin(sl.bob * Math.PI) * 0.35)); sl.mesh.position.y = sl.pos.y + Math.abs(Math.sin(tt * 3 + i)) * 0.03; sl.mesh.rotation.y = Math.sin(tt * 1.5 + i) * 0.3;
      }
      if (sl.ring.style.display !== 'none' && vis) { const [sx, sy] = toScreen(_h.copy(sl.pos).add(V3(0, 0.62, 0))); sl.ring.style.transform = `translate(${sx}px,${sy}px)`; }
    });
    // machine-specific motion
    const tt = performance.now() / 1000, m = s.m;
    if (m.jug) { m.jug.g.rotation.z = cooking ? Math.sin(tt * 40) * 0.05 : 0; m.jug.liquid.position.y = 0.27 + (cooking ? Math.sin(tt * 25) * 0.02 : 0); m.jug.liquid.rotation.y += cooking ? dt * 20 : 0; }
    if (m.heat) m.heat.material.opacity = cooking ? 0.22 + Math.sin(tt * 6) * 0.08 : Math.max(0, m.heat.material.opacity - dt);
    if (m.lid) m.lid.rotation.x = lerp(m.lid.rotation.x, cooking ? 0 : -1.05, Math.min(1, dt * 8));
    if (cooking && Math.random() < dt * (s.key === 'esp' ? 9 : s.key === 'grill' || s.key === 'waf' || s.key === 'press' ? 7 : 3)) {
      const p = s.anchor.clone(); p.y += s.key === 'esp' ? 0.45 : 0.1;
      puff(p, { color: 0xffffff, size: 0.32, up: 0.7, spread: 0.18, life: 1.1 });
    }
  }
  for (const p of Object.values(pastries)) {
    if (!p.on) continue;
    p.wob = Math.max(0, p.wob - dt * 2.2); const e = Math.sin(p.wob * Math.PI * 3) * p.wob;
    p.o.scale.setScalar(IT[p.k].s * PS * (1 + e * 0.25)); p.o.rotation.z = e * 0.2;
  }
}

// ---------------------------------------------------------------- owner (the player's Hero Lab hero behind the counter)
let ownerTok = 0;
async function buildOwner() {
  const tok = ++ownerTok, h = selectedHero();
  let k;
  try {
    k = h ? await loadHero(THREE, GLTFLoader, { hero: h, quality: 'game', height: 1.7, shadows: true })
      : await loadHero(THREE, GLTFLoader, { hero: { char: OWNER_DEFAULT }, assets: './assets/heroes/', height: 1.66, shadows: true });
  } catch (e) {
    console.warn('owner', e);
    try { k = await loadHero(THREE, GLTFLoader, { hero: { char: OWNER_DEFAULT }, assets: './assets/heroes/', height: 1.66, shadows: true }); } catch (e2) { return; }
  }
  if (tok !== ownerTok) { k.dispose(); return; }
  for (const n of ['cheer', 'jump', 'fall']) if (k.actions[n]) { k.actions[n].setLoop(THREE.LoopOnce, 1); k.actions[n].clampWhenFinished = true; }
  const old = owner;
  owner = { k, char: h ? h.char : OWNER_DEFAULT, cur: '', cheerT: 0 };
  k.object.position.set(ownerX, 0, ROOM.ownerZ); scene.add(k.object);
  if (old) old.k.dispose();
  // a customer that matches the owner's look gets swapped out of the pool automatically (spawnCustomer skips it)
  oplay(state === 'play' ? 'idle' : 'cheer');
}
function oplay(name, ts = 1) { if (!owner) return; if (owner.cur === name && !['cheer', 'jump'].includes(name)) { const a = owner.k.actions[name]; if (a) a.timeScale = ts; return; } owner.k.play(name, { fade: 0.2 }); const a = owner.k.actions[name]; if (a) a.timeScale = ts; owner.cur = name; }
function ownerLook(x, dir) { ownerTX = clamp(x * 0.8, -1.9, 1.9); ownerFace = dir; ownerBusy = 1.2; }
function ownerCheer() { if (!owner) return; owner.cheerT = 1.4; oplay('cheer'); }
function updateOwner(dt) {
  if (!owner) return;
  const o = owner.k.object;
  if (state !== 'play') { ownerTX = LOBX; ownerFace = -1; }
  const dx = ownerTX - ownerX; ownerX += clamp(dx, -dt * 6, dt * 6); o.position.x = ownerX; o.position.z = ROOM.ownerZ;
  ownerBusy = Math.max(0, ownerBusy - dt); owner.cheerT = Math.max(0, owner.cheerT - dt);
  const moving = Math.abs(dx) > 0.08;
  const yaw = moving ? Math.sign(dx) * Math.PI / 2 : ownerFace > 0 ? 0 : Math.PI;
  o.rotation.y = lerpAng(o.rotation.y, yaw, Math.min(1, dt * 12));
  if (owner.cheerT > 0) return;
  if (moving) oplay('run', 1.25); else if (state === 'play' || owner.cur !== 'cheer') oplay('idle');
}

// ---------------------------------------------------------------- day flow
function dayConfig(L) {
  const fk = F.k();
  const un = unlocked(L), debut = un.filter(k => IT[k].lvl === L);
  const n = Math.round(Math.min(36, 4 + L * 1.0));
  const maxItems = L < 3 ? 1 : L < 8 ? 2 : 3;
  const seed = D.seed ? D.seed : L * 7919 + 13;
  const r = rng(seed);
  const specs = [];
  for (let i = 0; i < n; i++) {
    let cnt = 1 + Math.floor(r() * maxItems); if (L >= 8 && r() < 0.25) cnt = Math.max(cnt, 2);
    if (i < 2) cnt = 1;
    const order = [];
    for (let j = 0; j < cnt; j++) {
      let k = debut.length && r() < 0.45 ? debut[Math.floor(r() * debut.length)] : un[Math.floor(r() * un.length)];
      if (L < 6 && order.includes(k)) k = un.find(q => !order.includes(q)) || k;
      order.push(k);
    }
    specs.push({ order });
  }
  const sum = specs.reduce((s, sp) => s + sp.order.reduce((a, k) => a + IT[k].p, 0), 0);
  const g = L <= 3 ? 0.55 : Math.min(1.15, 0.8 + (L - 3) * 0.013);
  const goal = Math.round(sum * g / 5) * 5, maxPot = sum * 1.35 + 5 * n;
  return {
    L, specs, n, r, spots: L < 4 ? 3 : 4,
    pat: clamp(30 - L * 0.85, 11, 30) / fk,
    gap: clamp(3.5 - L * 0.07, 1.7, 3.5) / fk,
    goal, stars: [goal, Math.max(goal + 5, Math.round(maxPot * 0.8 / 5) * 5), Math.max(goal + 10, Math.round(maxPot * 0.92 / 5) * 5)], sum,
  };
}
function startDay() {
  if (state === 'loading') { wantStart = true; return; }
  if (state === 'play') return;
  day = dayConfig(curL()); day.next = 0; day.nextAt = 1.0;
  refreshUnlocks();
  for (const s of Object.values(stations)) for (const sl of s.slots) { if (sl.mesh) freeItem(sl.mesh); sl.mesh = null; sl.state = 'idle'; sl.ring.style.display = 'none'; }
  for (const c of customers) { c.inst.k.object.visible = false; c.inst.busy = false; c.el.remove(); }
  customers = []; for (const f of flyers) freeItem(f.m); flyers = [];
  dayCoins = 0; dayTips = 0; served = 0; lost = 0; combo = 0; comboT = 0; bestCombo = 0; showCombo(); dayT = 0; turboT = 0; recorded = false; beatenShown = false;
  state = 'play'; camMode = 'play'; t0run = performance.now();
  $('hud').classList.remove('off'); $('boosts').classList.remove('off'); $('hday').textContent = D.seed ? '★' : day.L;
  updateHud(); updateBoosts();
  ui.pop(D.seed ? 'Daily rush!' : `Day ${day.L}`, '#fff', 42, 34);
  setTimeout(() => state === 'play' && ui.pop(`Goal ${day.goal}`, '#ffe56b', 30, 40), 900);
  SND.start(); music(!P.mute); oplay('idle');
  B.start();
}
function updateDay(dt) {
  if (state !== 'play') return;
  dayT += dt; turboT = Math.max(0, turboT - dt);
  if (comboT > 0) { comboT -= dt; if (comboT <= 0) { combo = 0; showCombo(); } else { const bar = $('combo').querySelector('i'); bar.style.transform = `scaleX(${comboT / 4.5})`; } }
  if (day.next < day.n && dayT >= day.nextAt) {
    const sp = freeSpot();
    if (sp >= 0 && spawnCustomer(day.specs[day.next], sp)) { day.next++; day.nextAt = dayT + day.gap * (0.75 + day.r() * 0.5); updateHud(); }
  }
  // the café never sits empty for long: if the counter is empty, the next guest comes sooner
  if (day.next < day.n && !customers.some(c => c.phase !== 'out')) day.nextAt = Math.min(day.nextAt, dayT + 0.6);
  if (day.next >= day.n && !customers.length && !flyers.length) endDay();
}
function endDay() {
  if (recorded) return; recorded = true;
  const ms = performance.now() - t0run, won = dayCoins >= day.goal;
  const stars = won ? 1 + (dayCoins >= day.stars[1] ? 1 : 0) + (dayCoins >= day.stars[2] ? 1 : 0) : 0;
  F.level(won, clamp(dayCoins / day.goal, 0, 1));
  B.submit(dayCoins, { ms });
  P.coins += dayCoins; P.best = Math.max(P.best, dayCoins);
  let gift = '';
  if (won && !D.seed) {
    const L = day.L, prev = P.stars[L] || 0;
    if (stars > prev) P.stars[L] = stars;
    if (stars === 3 && prev < 3) { const b = L % 2 ? 'turbo' : 'calm'; P.boost[b]++; gift = b === 'turbo' ? '+1 ⚡ Turbo' : '+1 🫖 Calm tea'; }
    if (L % 5 === 0 && prev === 0) { P.boost.turbo++; P.boost.calm++; gift = '+1 ⚡ Turbo  +1 🫖 Calm tea'; }
    if (L === P.level) P.level++;
  }
  saveP();
  state = won ? 'won' : 'lost'; camMode = 'lobby'; combo = 0; comboT = 0; showCombo();
  $('hud').classList.add('off'); $('boosts').classList.add('off');
  music(false);
  if (won) { D.won(dayCoins, 'earned'); SND.win(); confetti(scene, V3(0, 2.6, -0.5), 70); ownerCheer(); showResult(true, stars, gift); }
  else { SND.lose(); if (owner) { owner.cheerT = 1.6; oplay('fall'); } showResult(false, 0, ''); }
}

// ---------------------------------------------------------------- HUD
let hudCoins = 0;
function updateHud(bump) {
  if (!day) return;
  const goal3 = day.stars[2], f = Math.min(1, dayCoins / goal3);
  $('hcoins').textContent = dayCoins; $('hgoal').textContent = `goal ${day.goal}`;
  $('hbar').style.width = (f * 100).toFixed(1) + '%';
  const bs = document.querySelectorAll('.hbar b');
  day.stars.forEach((v, i) => { bs[i].style.left = (v / goal3 * 100) + '%'; const on = dayCoins >= v; if (on && !bs[i].classList.contains('on')) { SND.star(i); } bs[i].classList.toggle('on', on); });
  $('hcust').textContent = Math.max(0, day.n - day.next + customers.filter(c => c.phase !== 'out').length);
  if (bump) { const el = $('hcoins'); el.animate([{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'cubic-bezier(.2,1.6,.4,1)' }); }
  hudCoins = dayCoins;
}
function showCombo() {
  const el = $('combo');
  if (combo >= 2) { el.firstChild.textContent = `COMBO x${combo}`; el.classList.add('on'); el.animate([{ transform: 'translateX(-50%) scale(1.3)' }, { transform: 'translateX(-50%) scale(1)' }], { duration: 250 }); }
  else el.classList.remove('on');
}
function floatText(c, txt, cls) {
  const o = c.inst.k.object, [sx, sy] = toScreen(_h.set(o.position.x, (CUST_H[c.inst.id] || 1.6) + 0.1, o.position.z));
  const d = document.createElement('div'); d.className = 'float ' + cls; d.textContent = txt; d.style.left = sx + 'px'; d.style.top = sy + 'px';
  document.body.appendChild(d); setTimeout(() => d.remove(), 1150);
}
function coinBurst(c, n) {
  const o = c.inst.k.object, [sx, sy] = toScreen(_h.set(o.position.x, 1.4, o.position.z));
  const tgt = document.querySelector('.hcoins .coin').getBoundingClientRect();
  for (let i = 0; i < n; i++) {
    const d = document.createElement('div'); d.className = 'fly'; d.innerHTML = '<span class="coin"></span>';
    d.style.transform = `translate(${sx - 11 + (Math.random() - 0.5) * 40}px,${sy - 11 + (Math.random() - 0.5) * 30}px)`; document.body.appendChild(d);
    setTimeout(() => { d.style.transform = `translate(${tgt.left}px,${tgt.top}px) scale(.8)`; d.style.opacity = '0'; }, 30 + i * 45);
    setTimeout(() => { d.remove(); if (i % 2 === 0) SND.coin(i); }, 760 + i * 45);
  }
}

// ---------------------------------------------------------------- boosters
function updateBoosts() {
  $('bt').querySelector('b').textContent = P.boost.turbo; $('bc').querySelector('b').textContent = P.boost.calm;
  $('bt').classList.toggle('dim', !P.boost.turbo); $('bc').classList.toggle('dim', !P.boost.calm); $('bt').classList.toggle('live', turboT > 0);
}
function useTurbo() { if (state !== 'play' || !P.boost.turbo || turboT > 0) return false; P.boost.turbo--; saveP(); turboT = 8; SND.boost(); ui.pop('TURBO KITCHEN!', '#d9ccff', 34, 30); ui.flash(0.25); updateBoosts(); setTimeout(updateBoosts, 8100); return true; }
function useCalm() {
  if (state !== 'play' || !P.boost.calm) return false;
  const w = customers.filter(c => c.phase === 'wait'); if (!w.length) return false;
  P.boost.calm--; saveP(); SND.boost(); ui.pop('Calm tea for all!', '#c8ffe9', 32, 30);
  for (const c of w) { c.pat = c.patMax; const o = c.inst.k.object; puff(V3(o.position.x, 1.8, o.position.z), { color: 0xff8fb1, n: 5, size: 0.2, up: 1, spread: 0.3, life: 0.9, star: true, add: true }); }
  updateBoosts(); return true;
}
for (const [id, fn] of [['bt', useTurbo], ['bc', useCalm]]) { const b = $(id); b.addEventListener('pointerdown', e => { e.stopPropagation(); unlock(); fn(); }); }
$('mute').addEventListener('pointerdown', e => { e.stopPropagation(); P.mute = !P.mute; saveP(); setMuted(P.mute); $('mute').textContent = P.mute ? '🔇' : '🔊'; music(!P.mute && state === 'play'); });
setMuted(P.mute); $('mute').textContent = P.mute ? '🔇' : '🔊';

// ---------------------------------------------------------------- lobby (start card): logo, journey, hero bar, play, shop
const startEl = ui.els.start;
const lob = document.createElement('div'); lob.className = 'lob'; startEl.appendChild(lob);
lob.innerHTML = `<div class="logo"><b>Sugarloaf</b><span>Café</span><small>COOKING RUSH</small></div>
  <div class="streak" id="streak" hidden></div><div class="journey" id="journey"></div><div class="lspace"></div>
  <div class="herowrap" id="herowrap"></div>
  <div class="prow"><button class="sbtn" data-open="up">🛠️<small>Kitchen</small><b></b></button><button class="playbtn" id="playbtn">Play Day 1<small>goal 0</small></button><button class="sbtn" data-open="decor">🪴<small>Décor</small><b></b></button></div>
  <div class="sheet" id="sheet" hidden><div class="shop" id="shop"><div class="tabs"><button data-tab="up" class="on">Kitchen</button><button data-tab="decor">Décor</button><span class="bank"><span class="coin"></span><span id="bank">0</span></span><button class="x" id="shopx">✕</button></div><div class="charm" id="charm"></div><div class="row" id="shoprow"></div></div></div>`;
if (D.streak > 1 || D.beat) { const s = $('streak'); s.hidden = false; s.textContent = D.beat ? `Beat ${D.beat} coins!` : `🔥 ${D.streak}-day streak`; }
let shopTab = 'up';
for (const b of lob.querySelectorAll('.tabs button')) { b.addEventListener('pointerdown', e => e.stopPropagation()); b.addEventListener('click', e => { e.stopPropagation(); shopTab = b.dataset.tab; SND.tap(); renderLobby(); }); }
for (const id of ['sheet', 'journey']) { const el = $(id); ['pointerdown', 'pointerup'].forEach(ev => el.addEventListener(ev, e => e.stopPropagation())); }
for (const b of lob.querySelectorAll('.sbtn')) { b.addEventListener('pointerdown', e => e.stopPropagation()); b.addEventListener('click', e => { e.stopPropagation(); shopTab = b.dataset.open; $('sheet').hidden = false; SND.tap(); renderLobby(); }); }
$('sheet').addEventListener('click', e => { if (e.target.id === 'sheet' || e.target.id === 'shopx') { e.stopPropagation(); $('sheet').hidden = true; SND.tap(); } });
heroBar({ parent: $('herowrap'), title: 'Café owner', noneLabel: 'Milo', noneIcon: '🧑‍🍳', onPick: () => buildOwner() });
onHeroesChange(() => buildOwner());

function upgrades() {
  const L = curL(), list = [];
  for (const [key, def] of Object.entries(STN)) {
    if (IT[def.item].lvl > L) continue;
    const s = P.up[key + '_s'] || 0, n = P.up[key + '_n'] || 0, icon = `./assets/icons/${IT[def.item].m}.webp`;
    list.push({ id: key + '_s', icon, t: `${def.n} speed`, lv: s, max: 3, cost: [50, 130, 280][s] });
    list.push({ id: key + '_n', icon, t: `${def.n} +1 slot`, lv: n, max: 2, cost: [90, 240][n] });
  }
  const pr = P.up.price || 0;
  list.splice(1, 0, { id: 'price', em: '🏷️', t: 'Menu prices +10%', lv: pr, max: 4, cost: [80, 180, 340, 560][pr] });
  return list;
}
function renderLobby() {
  const L = curL(), cfg = dayConfig(L);
  $('playbtn').innerHTML = `${D.seed ? 'Play Daily Rush' : `Play Day ${L}`}<small>goal <span class="coin"></span> ${cfg.goal} · ${cfg.n} guests</small>`;
  $('bank').textContent = P.coins;
  // journey: days so far + a few ahead
  const J = $('journey'), top = Math.max(P.level + 4, 10);
  J.innerHTML = Array.from({ length: top }, (_, i) => { const d = i + 1, st = P.stars[d] || 0; return `<div class="jd ${d === P.level ? 'cur' : d > P.level ? 'lock' : ''}">${d}${d < P.level || st ? `<i>${'★'.repeat(st)}${'☆'.repeat(3 - st)}</i>` : ''}</div>`; }).join('');
  requestAnimationFrame(() => { const c = J.querySelector('.cur'); if (c) J.scrollLeft = Math.max(0, c.offsetLeft - J.offsetLeft - J.clientWidth / 2 + 23); });
  for (const b of lob.querySelectorAll('.tabs button')) b.classList.toggle('on', b.dataset.tab === shopTab);
  const nUp = upgrades().filter(u => u.lv < u.max && u.cost <= P.coins).length, nDe = DECOR.filter(d => !P.decor.includes(d.id) && d.cost <= P.coins).length;
  lob.querySelectorAll('.sbtn b').forEach((b, i) => { const n = i ? nDe : nUp; b.textContent = n; b.hidden = !n; });
  const row = $('shoprow');
  if (shopTab === 'up') {
    $('charm').textContent = 'Faster machines and more slots keep the queue moving.';
    row.innerHTML = upgrades().map(u => { const max = u.lv >= u.max; return `<button class="card ${max ? 'own' : P.coins < u.cost ? 'no' : ''}" data-id="${u.id}">${u.icon ? `<img alt="" src="${u.icon}">` : `<div class="em">${u.em}</div>`}<b>${u.t}</b><div class="lv">${Array.from({ length: u.max }, (_, i) => `<i class="${i < u.lv ? 'on' : ''}"></i>`).join('')}</div><div class="pr">${max ? 'MAX' : `<span class="coin"></span>${u.cost}`}</div></button>`; }).join('');
  } else {
    $('charm').textContent = `Café charm ${P.decor.length}/${DECOR.length} · each piece gives guests +5% patience`;
    row.innerHTML = DECOR.map(d => { const own = P.decor.includes(d.id); return `<button class="card ${own ? 'own' : P.coins < d.cost ? 'no' : ''}" data-d="${d.id}"><img alt="" src="./assets/icons/${d.id === 'tea' ? 'g10' : d.id}.webp"><b>${d.n}</b><div class="pr">${own ? '✓ Placed' : `<span class="coin"></span>${d.cost}`}</div></button>`; }).join('');
  }
  for (const b of row.querySelectorAll('.card')) b.addEventListener('click', e => { e.stopPropagation(); b.dataset.id ? buyUp(b.dataset.id) : buyDecor(b.dataset.d); });
}
function buyUp(id) {
  const u = upgrades().find(q => q.id === id); if (!u || u.lv >= u.max) return false;
  if (P.coins < u.cost) { SND.no(); return false; }
  P.coins -= u.cost; P.up[id] = (P.up[id] || 0) + 1; saveP(); SND.buy(); buzz(15);
  const key = id.split('_')[0]; if (stations[key]) { squash(stations[key].m.g); puff(stations[key].anchor, { color: 0xffe08a, n: 10, size: 0.2, up: 1.4, spread: 0.5, life: 0.9, star: true, add: true }); }
  renderLobby(); return true;
}
function buyDecor(id) {
  const d = DECOR.find(q => q.id === id); if (!d || P.decor.includes(id)) return false;
  if (P.coins < d.cost) { SND.no(); return false; }
  P.coins -= d.cost; P.decor.push(id); saveP(); SND.buy(); buzz(15); placeDecor(d, true); renderLobby(); return true;
}
function placeDecor(d, fresh) {
  if (decorObjs[d.id]) return;
  let o;
  if (d.id === 'tea') {
    o = new THREE.Group(); scene.add(o);
    place('g10', { size: 0.42, pos: [-1.75, 2.39, ROOM.backZ + 0.22], rot: 0.3, parent: o });
    place('g09', { size: 0.3, pos: [-1.25, 2.39, ROOM.backZ + 0.22], rot: -0.2, parent: o });
    place('g09', { size: 0.3, pos: [1.25, 2.39, ROOM.backZ + 0.22], rot: 0.2, parent: o });
    place('g10', { size: 0.36, pos: [1.8, 2.39, ROOM.backZ + 0.22], rot: -0.4, parent: o });
  } else o = place(d.id, { size: d.size, pos: d.pos, rot: d.rot });
  decorObjs[d.id] = o;
  if (fresh) {
    const p = o.getWorldPosition(V3(0, 0, 0)); if (d.id === 'tea') p.set(0, 2.4, ROOM.backZ + 0.3);
    o.scale.multiplyScalar(0.01); popIn.push({ o, t: 0, s: d.size || 1 });
    confetti(scene, p.clone().add(V3(0, 0.8, 0)), 30); puff(p.clone().add(V3(0, 0.6, 0)), { color: 0xffe08a, n: 12, size: 0.25, up: 1.6, spread: 0.8, life: 1.1, star: true, add: true });
  }
}
const popIn = [];
function updatePop(dt) { for (let i = popIn.length - 1; i >= 0; i--) { const q = popIn[i]; q.t = Math.min(1, q.t + dt * 2.2); const e = 1 + Math.sin(q.t * Math.PI) * 0.3; q.o.scale.setScalar(q.s * Math.max(0.01, q.t < 1 ? q.t * e : 1)); if (q.t >= 1) popIn.splice(i, 1); } }

// ---------------------------------------------------------------- result cards
const winBox = document.createElement('div'); winBox.className = 'resbox'; ui.els.win.appendChild(winBox); ui.els.win.classList.add('res');
const loseBox = document.createElement('div'); loseBox.className = 'resbox'; ui.els.lose.appendChild(loseBox); ui.els.lose.classList.add('res');
const shareBtn = ui.els.win.querySelector('.hc-btn');
function showResult(won, stars, gift) {
  const box = won ? winBox : loseBox;
  const base = dayCoins - dayTips;
  box.innerHTML = `<div class="rt">${D.seed ? 'Daily rush' : `Day ${day.L}`}</div><h2>${won ? ['', 'Tasty!', 'Delicious!', 'Sweet perfection!'][stars] : 'Closing time!'}</h2>
    ${won ? '<div class="stars"><span>★</span><span>★</span><span>★</span></div>' : `<div style="font:600 16px 'Baloo 2';margin:4px 0 8px">The goal was <span class="coin"></span> ${day.goal}. Upgrades in the kitchen help!</div>`}
    <div class="rl"><span>Guests served</span><b>${served}/${day.n}</b></div>
    <div class="rl"><span>Sales</span><b><span class="coin"></span>${base}</b></div>
    <div class="rl"><span>Tips & combos</span><b><span class="coin"></span>${dayTips}</b></div>
    <div class="rl"><span>Best combo</span><b>x${Math.max(1, bestCombo)}</b></div>
    <div class="rl tot"><span>Earned</span><b><span class="coin"></span>${dayCoins}</b></div>
    ${gift ? `<div class="gift">🎁 ${gift}</div>` : ''}<div class="slot"></div><div class="tapc">Tap to continue</div>`;
  if (won && shareBtn) box.querySelector('.slot').appendChild(shareBtn);
  if (won) { ui.win(day.L, ''); const ss = box.querySelectorAll('.stars span'); for (let i = 0; i < stars; i++) setTimeout(() => { ss[i].classList.add('on'); SND.star(i); buzz(10); }, 900 + i * 380); }
  else ui.lose('Closing time!', '');
}
ui.onTap(which => {
  unlock();
  if (which === 'start') { startDay(); return; }
  state = 'ready'; renderLobby(); ui.start(); if (owner) oplay('idle');
});

// ---------------------------------------------------------------- what to do next (the bot plays it; new players see it as a pointing hand)
function suggest(wait = customers.filter(c => c.phase === 'wait').sort((a, b) => a.pat / a.patMax - b.pat / b.patMax)) {
  for (const c of wait) for (const it of c.order) { if (it.got || it.pend || IT[it.k].st === 'pastry') continue; const s = stations[IT[it.k].st]; if (s.slots.some((q, i) => i < nSlots(s.key) && q.state === 'ready')) return { c }; }
  for (const c of wait) for (const it of c.order) if (!it.got && !it.pend && IT[it.k].st === 'pastry') return { p: pastries[it.k] };
  for (const c of wait) for (const it of c.order) {
    if (it.got || it.pend || IT[it.k].st === 'pastry') continue;
    const key = IT[it.k].st, s = stations[key];
    const need = customers.reduce((a, q) => a + (q.phase === 'wait' ? q.order.filter(o => o.k === it.k && !o.got && !o.pend).length : 0), 0);
    const have = s.slots.filter((q, i) => i < nSlots(key) && q.state !== 'idle').length;
    if (need > have && s.slots.some((q, i) => i < nSlots(key) && q.state === 'idle')) return { s };
  }
  return null;
}
const act = g => (g.c ? tapCustomer(g.c) : g.p ? tapPastry(g.p) : tapStation(g.s));
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on day 1, until the first touch,
// the station a waiting customer needs starts cooking their order by itself; handing it over (and the coins) is left to you
demo(() => {
  for (const c of customers) if (c.phase === 'wait') for (const it of c.order) {
    if (it.got || it.pend || IT[it.k].st === 'pastry') continue;
    const st = stations[IT[it.k].st]; if (st.slots.some((q, i) => i < nSlots(st.key) && q.state !== 'idle')) continue;
    if (tapStation(st)) return;
  }
  return false;
}, { ready: () => state === 'play' && !D.seed && day && day.L === 1 && customers.some(c => c.phase === 'wait'), wait: 1500, every: 1600, max: 2 });
const hintEl = document.createElement('div'); hintEl.id = 'hint'; hintEl.innerHTML = '<i>👆</i><b></b>'; hintEl.style.display = 'none'; document.body.appendChild(hintEl);
let idleT = 0;
addEventListener('pointerdown', () => { idleT = 0; hintEl.style.display = 'none'; }, true);
function updateHint(dt) {
  const teach = state === 'play' && !D.seed && (day.L <= 2 || (day.L <= 6 && served === 0));
  if (!teach) { hintEl.style.display = 'none'; return; }
  idleT += dt; if (idleT < (served ? 3 : 1.6)) { hintEl.style.display = 'none'; return; }
  const g = suggest(); if (!g) { hintEl.style.display = 'none'; return; }
  const pos = g.c ? _h.set(g.c.inst.k.object.position.x, 1.2, g.c.inst.k.object.position.z) : g.p ? g.p.anchor : g.s.anchor;
  const [sx, sy] = toScreen(pos);
  hintEl.style.display = ''; hintEl.style.transform = `translate(${sx}px,${sy}px)`;
  hintEl.querySelector('b').textContent = g.c ? 'Serve!' : g.p ? 'Tap to serve' : 'Tap to make';
}

// ---------------------------------------------------------------- test hooks + bot
window.__game = {
  perf: () => ({ calls: R.info.render.calls, tris: R.info.render.triangles, geo: R.info.memory.geometries, tex: R.info.memory.textures }),
  _dbg: () => ({ locks: lockTags.map(t => [t.pos.x.toFixed(2), t.pos.y.toFixed(2), t.pos.z.toFixed(2), t.el.style.transform]), st: Object.values(stations).map(s => [s.key, s.anchor.x.toFixed(2), s.anchor.z.toFixed(2)]) }),
  get state() { return state === 'loading' ? 'ready' : state; }, get level() { return curL(); }, get score() { return state === 'play' ? dayCoins : P.best; },
  get coins() { return P.coins; }, get stars() { return P.stars; }, get customers() { return customers.length; },
  start: () => { ui.hideStart(); startDay(); },
  bot() {
    if (state === 'loading') return;
    if (state === 'ready') {
      if (Math.random() < 0.5) { const u = upgrades().filter(q => q.lv < q.max && q.cost <= P.coins).sort((a, b) => a.cost - b.cost)[0]; if (u) { buyUp(u.id); return; } }
      const d = DECOR.find(q => !P.decor.includes(q.id) && q.cost <= P.coins * 0.5); if (d) { buyDecor(d.id); return; }
      ui.hideStart(); startDay(); return;
    }
    if (state !== 'play') return;
    const wait = customers.filter(c => c.phase === 'wait').sort((a, b) => a.pat / a.patMax - b.pat / b.patMax);
    if (wait.some(c => c.pat / c.patMax < 0.25) && P.boost.calm && Math.random() < 0.1) { useCalm(); return; }
    const g = suggest(wait); if (g) { act(g); return; }
    if (P.boost.turbo && wait.length >= 3 && Math.random() < 0.05) useTurbo();
  },
};

// ---------------------------------------------------------------- boot
loop((dt60) => {
  const dt = dt60 / 60;
  if (world) {
    updateDay(dt); updateCustomers(dt); updateFlyers(dt); updateStations(dt); updateOwner(dt); updateSquash(dt); updateSprites(dt); updatePop(dt); updateLocks(); if (day) updateHint(dt);
    for (const c of custPool) if (c.k.object.visible) c.k.mixer.update(dt);
    if (owner) owner.k.mixer.update(dt);
    const tt = performance.now() / 1000; world.bulbs.forEach((b, i) => b.material.emissiveIntensity = 2.4 + Math.sin(tt * 2 + i) * 0.15);
  }
  updateCam(dt);
  if (world) world.frontG.visible = camBlend < 0.5;
  R.info.reset(); C.render(dt);
});

(async function boot() {
  startEl.style.pointerEvents = 'none';
  await Promise.all(MODEL_IDS.map(id => loader.loadAsync(`./assets/${id}.glb`).then(g => { MODELS[id] = prep(g.scene); prog(); })));
  world = buildWorld(scene, MODELS, place);
  makeStations(); refreshUnlocks();
  // small props don't cast shadows (saves a shadow-pass draw call each); windows sit flat on the wall
  scene.updateMatrixWorld(true);
  const _s = new THREE.Vector3();
  scene.traverse(o => { if (!o.isMesh || o.isSkinnedMesh || !o.castShadow) return; if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); o.getWorldScale(_s); if (o.geometry.boundingSphere.radius * Math.max(_s.x, _s.y, _s.z) < 0.5) o.castShadow = false; });
  for (const id of ['h18', 'f13']) scene.traverse(o => { if (o.isMesh && o.geometry === MODELS[id].children[0].children[0].children[0].geometry) o.castShadow = false; });
  for (const d of DECOR) if (P.decor.includes(d.id)) placeDecor(d, false);
  await Promise.all([loadCustomers(), buildOwner().then(prog)]);
  // ambient: two guests chatting at the counter while you're in the lobby
  state = 'ready'; renderLobby();
  startEl.style.pointerEvents = '';
  $('load').classList.add('gone'); setTimeout(() => $('load').remove(), 600);
  if (wantStart) { ui.hideStart(); startDay(); }
})();
