// Pocket Pom: Cozy Pet Café — a kawaii pet café life sim. Adopt pets, feed / play / groom them, serve chibi customers
// boba and treats in short café shifts, earn coins to decorate and adopt more, fill the sticker album.
// Pets have gentle needs that never punish: they never get sick, never leave, and needs never drop below 30%.
// Art: kawaii AI 3D props + rigged chibi characters (assets/, copied from assets/kawaii); café built in code.
import { THREE, buzz, clamp, lerp, rng } from './kit/hc.js';
import { cine } from './kit/cine.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { money } from './kit/money.js';
import { buildCafe, loadProps, loadChar, prop, iconOf, MODELS, sparkles, updateSparkles, blob, kibbleBowl, brush, FLOOR, K, FY } from './world.js';
import { S as SND, music, setMuted, unlock, pauseAll } from './audio.js';

const NAME = 'Pocket Pom: Cozy Pet Café', KEY = 'pocket-pom';
const Q = new URLSearchParams(location.search);
const $ = id => document.getElementById(id);
const PI = Math.PI;

// ---------------------------------------------------------------- data
const MENU = [
  { k: 'boba', id: 't01', n: 'Boba', price: 6, lv: 1, s: 0.46 },
  { k: 'cup', id: 'g09', n: 'Cupcake', price: 5, lv: 1, s: 0.4 },
  { k: 'mac', id: 'g08', n: 'Macaron', price: 6, lv: 3, s: 0.38 },
  { k: 'don', id: 't05', n: 'Donut', price: 7, lv: 5, s: 0.4 },
  { k: 'ice', id: 't08', n: 'Soft serve', price: 7, lv: 8, s: 0.44 },
  { k: 'pan', id: 'f08', n: 'Pancakes', price: 9, lv: 11, s: 0.44 },
];
const MI = Object.fromEntries(MENU.map(m => [m.k, m]));
const PETS = [
  { id: 'p01', name: 'Pom', kind: 'kitten', fee: 0, stars: 0, size: 0.66, likes: 'cup' },
  { id: 'p02', name: 'Biscuit', kind: 'puppy', fee: 120, stars: 3, size: 0.66, likes: 'don' },
  { id: 'p03', name: 'Mochi', kind: 'hamster', fee: 180, stars: 7, size: 0.56, likes: 'mac' },
  { id: 'p04', name: 'Bonbon', kind: 'bunny', fee: 260, stars: 12, size: 0.68, likes: 'cup' },
  { id: 'p05', name: 'Lulu', kind: 'axolotl', fee: 340, stars: 18, size: 0.72, likes: 'mac' },
  { id: 'p06', name: 'Waffles', kind: 'corgi', fee: 420, stars: 24, size: 0.78, likes: 'don' },
  { id: 'k06', name: 'Snowdrop', kind: 'bunny friend', fee: 600, stars: 32, mascot: true, h: 0.8, likes: 'mac' },
  { id: 'k07', name: 'Lilac', kind: 'kitty friend', fee: 800, stars: 40, mascot: true, h: 0.8, likes: 'cup' },
];
const PI_ = Object.fromEntries(PETS.map(p => [p.id, p]));
const TABLES = [{ x: -1.75, z: -0.15 }, { x: 1.2, z: 0.05 }, { x: -0.55, z: 2.05, decor: 'h10' }];
const DECOR = [
  { id: 'h05', n: 'Cloud rug', cost: 60, st: 0, size: 2.2, pos: [-0.5, 0.075, 4.15], rot: 0 },
  { id: 'h07', n: 'Succulent', cost: 70, st: 1, size: 0.42, pos: [-0.05, 1.06, -2.05], rot: 0.3 },
  { id: 'h06', n: 'Mushroom lamp', cost: 90, st: 2, size: 0.95, pos: [-3.2, 0.075, 0.95], rot: 0.6, ob: 0.5 },
  { id: 'f09', n: 'Teapot', cost: 80, st: 3, size: 0.42, pos: [0.85, 1.06, -2.35], rot: 0.4 },
  { id: 'h08', n: 'Wall shelf', cost: 120, st: 4, size: 1.25, pos: [-3.75, 1.45, -1.55], rot: PI / 2 },
  { id: 'h12', n: 'Cat tree', cost: 160, st: 6, size: 1.75, pos: [-3.05, 0.075, -0.95], rot: 0.5, ob: 0.55 },
  { id: 'r03', n: 'Street lamp', cost: 150, st: 8, size: 2.0, pos: [3.5, 0.075, 4.95], rot: 0 },
  { id: 'h02', n: 'Beanbag', cost: 200, st: 10, size: 1.0, pos: [2.45, 0.075, 4.1], rot: -0.7, ob: 0.6 },
  { id: 'g16', n: 'Cat-loaf pillow', cost: 220, st: 13, size: 0.62, pos: [3.05, 0.075, -1.2], rot: -0.6, ob: 0.4 },
  { id: 'h10', n: 'Extra table', cost: 260, st: 15, size: 1.6, pos: [-0.55, 0.075, 2.05], rot: 0, ob: 1.0, note: '+1 seat' },
  { id: 'r01', n: 'Blossom tree', cost: 320, st: 18, size: 2.5, pos: [-3.15, 0.075, 4.55], rot: 0.3, ob: 0.8 },
  { id: 'g18', n: 'Plush pile', cost: 380, st: 22, size: 1.15, pos: [2.55, 0.075, 2.55], rot: -0.6, ob: 0.65 },
];
for (const t of TABLES) { t.x *= K; t.z *= K; }
for (const d of DECOR) { d.pos = d.pos.map(v => v * K); d.size *= K; if (d.ob) d.ob *= K; }
const CUST = [{ id: 'k02', name: 'Momo' }, { id: 'k03', name: 'Kiki' }, { id: 'k04', name: 'Yuzu' }];
const LV_XP = [0, 8, 20, 36, 56, 80, 110, 145, 185, 230];       // friendship level thresholds (lv 1..10)
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ---------------------------------------------------------------- save
const SAVE_K = 'pocketpom_v1';
const P = Object.assign({ level: 1, stars: {}, decor: [], pets: {}, album: {}, newSt: [], served: {}, vipDay: 0, dStreak: 0, dLast: 0, freezeWeek: '', dDone: 0, dBest: 0, mute: false, seen: 0, last: Date.now(), tut: 0 },
  (() => { try { return JSON.parse(localStorage.getItem(SAVE_K) || '{}'); } catch (e) { return {}; } })());
const save = () => { P.last = Date.now(); try { localStorage.setItem(SAVE_K, JSON.stringify(P)); } catch (e) {} };
if (!P.pets.p01) P.pets.p01 = { hunger: 70, fun: 60, fluff: 80, xp: 0 };
const totalStars = () => Object.values(P.stars).reduce((a, b) => a + b, 0);
const ymd = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const addDays = k => { const d = new Date(); d.setDate(d.getDate() + k); return d; };
function isoWeek(d = new Date()) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const dd = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dd); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return t.getUTCFullYear() + '-' + Math.ceil(((t - y0) / 864e5 + 1) / 7); }
// gentle offline needs: drift down while away, never below 30
{ const mins = clamp((Date.now() - (P.last || Date.now())) / 60000, 0, 60 * 24 * 7);
  for (const s of Object.values(P.pets)) { s.hunger = Math.max(Math.min(s.hunger, 30), s.hunger - mins * 0.5); s.fun = Math.max(Math.min(s.fun, 30), s.fun - mins * 0.6); s.fluff = Math.max(Math.min(s.fluff, 30), s.fluff - mins * 0.35); } }
const petLv = s => { let l = 1; for (let i = 0; i < LV_XP.length; i++) if (s.xp >= LV_XP[i]) l = i + 1; return l; };

// ---------------------------------------------------------------- kit layers
const M = money({ game: KEY, style: 'B' });
const D = daily(KEY, null, { name: NAME });
const F = flow(KEY);
const B = board({ game: 'pocket-pom', label: 'Happy customers', mode: 'sum', limits: { maxRun: 30, maxPerSec: 0.6 }, corner: 'tl', accent: '#ff8cc6' });
addEventListener('ap:ad', e => { const ph = e.detail && e.detail.phase; if (ph === 'start') { music(false); pauseAll(true); } else if (ph === 'end') { pauseAll(false); if (!P.mute) music(true); } });

// ---------------------------------------------------------------- renderer
const LITE = Q.has('lite') || (Math.min(screen.width, screen.height) < 500 && devicePixelRatio > 2.5);
const R = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
R.setSize(innerWidth, innerHeight); R.domElement.id = 'c'; document.body.prepend(R.domElement); R.info.autoReset = false;
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.5, 120);
const C = cine(R, scene, cam, { bloom: Q.has('nobloom') ? 0 : 0.2, bloomThreshold: 1.0, bloomRadius: 0.35, exposure: 0.95, envIntensity: 0.42, lite: LITE, grade: { sat: 1.12, contrast: 1.04, vignette: 0.08, grain: 0 } });
scene.add(new THREE.HemisphereLight('#fff4fb', '#b98ae0', 0.95));
const sun = new THREE.DirectionalLight('#fff6f0', 1.75); sun.position.set(4, 11, 7); sun.target.position.set(0, 0, 0);
sun.castShadow = true; sun.shadow.mapSize.set(C.lite ? 1024 : 2048, C.lite ? 1024 : 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; sun.shadow.radius = 5;
Object.assign(sun.shadow.camera, { left: -6.5, right: 6.5, top: 6.5, bottom: -6.5, near: 2, far: 30 }); scene.add(sun, sun.target);
const rimL = new THREE.DirectionalLight('#ffc2ea', 0.8); rimL.position.set(-5, 4, -6); scene.add(rimL);
const fillL = new THREE.PointLight('#fff0d6', 1.4, 9, 1.5); fillL.position.set(0.8, 3.0, -1.0); scene.add(fillL);

let cafe = null, owner = null;
const custPool = [], pets = [], decorObjs = {}, flyers = [], squash = [];

// ---------------------------------------------------------------- camera
const camS = { pos: new THREE.Vector3(0, 12, 30), tgt: new THREE.Vector3(0, 0.9, 0), wantPos: new THREE.Vector3(), wantTgt: new THREE.Vector3() };
let W = innerWidth, H = innerHeight, focus = null;
function viewFor(target, wdt, hgt, up = 0.82) {
  const vf = THREE.MathUtils.degToRad(cam.fov / 2), tv = Math.tan(vf), th = tv * cam.aspect;
  const d = Math.max((wdt / 2) / th, (hgt / 2) / tv);
  const dir = new THREE.Vector3(0, up, 1).normalize();
  return [target.clone().addScaledVector(dir, d), target];
}
function layoutCam() {
  W = innerWidth; H = innerHeight; cam.aspect = W / H;
  const portrait = H > W;
  // keep the diorama between the HUD and the bottom panel
  const top = 120, bottom = focus ? 360 : state === 'play' ? 120 : 170;
  cam.setViewOffset(W, H, 0, (bottom - top) / 2 * (portrait ? 1 : 0.3), W, H);
  cam.updateProjectionMatrix();
  if (focus) { const p = focus.obj.position, h = (focus.def.mascot ? 0.5 : focus.def.size * 0.5); [camS.wantPos, camS.wantTgt] = viewFor(new THREE.Vector3(p.x, h + 0.1, p.z), portrait ? 2.0 : 3.0, 1.9, 0.5); }
  else [camS.wantPos, camS.wantTgt] = viewFor(new THREE.Vector3(0, 0.6, 0.85), portrait ? 5.2 : 8.4, portrait ? 6.0 : 8.6);
}
function updateCam(dt) {
  const k = 1 - Math.exp(-dt * 4);
  camS.pos.lerp(camS.wantPos, k); camS.tgt.lerp(camS.wantTgt, k);
  cam.position.copy(camS.pos); cam.lookAt(camS.tgt);
}
addEventListener('resize', () => { R.setSize(innerWidth, innerHeight); C.resize(innerWidth, innerHeight); layoutCam(); });
const _v = new THREE.Vector3();
function toScreen(v) { _v.copy(v).project(cam); return [(_v.x + 1) / 2 * W, (1 - _v.y) / 2 * H, _v.z]; }

// ---------------------------------------------------------------- UI helpers
const ICON = {};
const coinsEl = $('coins');
let shownCoins = M.coins();
M.onChange(s => { bumpCoins(s.coins); });
function bumpCoins(n) { shownCoins = n; coinsEl.textContent = n; $('coinP').animate([{ transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 250 }); }
function hud() {
  coinsEl.textContent = M.coins(); $('stars').textContent = totalStars();
  $('lvl').textContent = shift && shift.daily ? '☀' : (state === 'play' && shift ? shift.n : P.level);
  $('badgeT').textContent = shift && shift.daily && state !== 'ready' ? 'DAILY' : 'SHIFT';
  const dot = (id, n) => { const b = $(id); let d = b.querySelector('.dot'); if (n) { if (!d) { d = document.createElement('i'); d.className = 'dot'; b.appendChild(d); } d.textContent = n; } else if (d) d.remove(); };
  dot('bAlbum', P.newSt.length || 0);
  const canAdopt = PETS.some(p => !P.pets[p.id] && totalStars() >= p.stars && M.coins() >= p.fee);
  dot('bPets', canAdopt ? '!' : 0);
  const canDecor = DECOR.some(d => !P.decor.includes(d.id) && totalStars() >= d.st && M.coins() >= d.cost);
  dot('bDecor', canDecor ? '!' : 0);
  dot('bDaily', P.dDone === ymd() ? 0 : '!');
}
const toastQ = []; let toastBusy = false;
function toast(text, icon) { if (toastQ.length < 4) toastQ.push([text, icon]); if (!toastBusy) nextToast(); }
function nextToast() {
  const n = toastQ.shift(); if (!n) { toastBusy = false; return; } toastBusy = true;
  const t = document.createElement('div'); t.className = 'tst'; t.innerHTML = (n[1] ? `<img src="${n[1]}">` : '') + `<span>${n[0]}</span>`;
  $('toast').appendChild(t); setTimeout(() => t.remove(), 2500); setTimeout(nextToast, 1300);
}
function floatText(text, x, y, color = '#ff4f9e') {
  const d = document.createElement('div'); d.className = 'flt ol'; d.textContent = text; d.style.left = x + 'px'; d.style.top = y + 'px';
  if (color !== '#ff4f9e') d.style.color = color; document.body.appendChild(d); setTimeout(() => d.remove(), 1000);
}
function coinFly(x, y, n = 3) {
  const r = $('coinI').getBoundingClientRect(), tx = r.left + r.width / 2, ty = r.top + r.height / 2;
  for (let i = 0; i < n; i++) {
    const c = document.createElement('img'); c.className = 'fcoin'; c.src = ICON.coin; c.style.left = (x - 17) + 'px'; c.style.top = (y - 17) + 'px';
    document.body.appendChild(c);
    setTimeout(() => { c.style.transform = `translate(${tx - x + (Math.random() - 0.5) * 10}px,${ty - y}px) scale(.7)`; }, 30 + i * 80);
    setTimeout(() => { c.remove(); if (i === n - 1) SND.coin(); }, 800 + i * 80);
  }
}

// ---------------------------------------------------------------- album
function stickers() {
  const L = [];
  for (const p of PETS) {
    L.push({ id: `${p.id}_met`, g: 'Pets', icon: p.id, cap: p.name, badge: '💗' });
    L.push({ id: `${p.id}_l3`, g: 'Pets', icon: p.id, cap: `${p.name} Lv3`, badge: '🎀' });
    L.push({ id: `${p.id}_l5`, g: 'Pets', icon: p.id, cap: `${p.name} Lv5`, badge: '⭐' });
    L.push({ id: `${p.id}_l8`, g: 'Pets', icon: p.id, cap: `${p.name} Lv8`, badge: '👑' });
  }
  for (const c of CUST) for (const [n, b] of [[1, '☕'], [10, '💌'], [30, '🌈']]) L.push({ id: `${c.id}_${n}`, g: 'Regulars', icon: c.id, cap: n === 1 ? `Met ${c.name}` : `${c.name} ×${n}`, badge: b });
  for (let d = 0; d < 7; d++) L.push({ id: `post_${d}`, g: 'Visitor postcards', icon: 'm12', cap: `${DAYS[d]} visit`, badge: '💌' });
  for (const d of DECOR) L.push({ id: `dec_${d.id}`, g: 'Café decor', icon: d.id, cap: d.n, badge: '✨' });
  return L;
}
function award(id) {
  if (P.album[id]) return false;
  P.album[id] = Date.now(); P.newSt.push(id); save();
  const s = stickers().find(x => x.id === id);
  if (s) setTimeout(() => { toast(`New sticker: ${s.cap}!`, ICON[s.icon]); SND.sparkle(); hud(); }, 400);
  return true;
}

// ---------------------------------------------------------------- pets
function addPetObj(id, intro = false) {
  const def = PI_[id], st = P.pets[id];
  const obj = new THREE.Group(), body = new THREE.Group(); obj.add(body);
  let ch = null;
  if (def.mascot) { ch = charCache[id]; body.add(ch.object); }
  else body.add(prop(id, def.size));
  const bl = blob(def.mascot ? 0.8 : def.size * 1.05); obj.add(bl);
  const p0 = intro ? new THREE.Vector3(cafe.anchors.door.x - 0.4, FY, cafe.anchors.door.z) : randSpot();
  obj.position.copy(p0); obj.rotation.y = Math.random() * PI * 2; scene.add(obj);
  const pet = { id, def, st, obj, body, ch, target: null, wait: 1 + Math.random() * 2, hop: 0, jumpT: 0, jumpDur: 0.8, spin: 0, chomp: 0, wig: 0, cool: 0, held: false, heading: obj.rotation.y, happyT: 2 + Math.random() * 4, look: null };
  pets.push(pet);
  if (intro) { pet.target = randSpot(); happyJump(pet); }
  return pet;
}
const charCache = {};
function obstacles() {
  const L = TABLES.filter(t => !t.decor || P.decor.includes(t.decor)).map(t => [t.x, t.z, 0.85]);
  for (const t of TABLES) L.push([t.x + 0.95 * K, t.z + 0.35 * K, 0.4]);
  for (const d of DECOR) if (d.ob && P.decor.includes(d.id)) L.push([d.pos[0], d.pos[2], d.ob]);
  return L;
}
function randSpot(r = Math.random) {
  const ob = obstacles();
  for (let i = 0; i < 40; i++) {
    const x = lerp(FLOOR.x0 + 0.2, FLOOR.x1 - 0.5, r()), z = lerp(FLOOR.z0 + 0.1, FLOOR.z1 - 0.2, r());
    if (ob.every(([ox, oz, rr]) => Math.hypot(x - ox, z - oz) > rr + 0.3) && pets.every(p => Math.hypot(p.obj.position.x - x, p.obj.position.z - z) > 0.6)) return new THREE.Vector3(x, FY, z);
  }
  return new THREE.Vector3(0.2, FY, 1.0);
}
function happyJump(p, big = false) {
  p.jumpT = 0.0001; p.jumpDur = big ? 0.95 : 0.65; p.spin = big ? PI * 2 : 0; p.jumpH = big ? 0.75 : 0.42;
  if (p.ch) p.ch.play(big ? 'cheer' : 'jump', { once: true, then: 'idle' });
  SND.squeak();
}
function hearts(pos, n = 7, kind = 'heart', colors = ['#ff6fa8', '#ff9ad0', '#ffffff']) { sparkles(scene, pos, { kind, colors, n }); }
const needsOf = s => Math.min(s.hunger, s.fun, s.fluff);
const happyPets = () => pets.filter(p => needsOf(p.st) >= 50);
function gainXP(p, n, pos) {
  const before = petLv(p.st); p.st.xp += n;
  const after = petLv(p.st); save();
  if (after > before) {
    SND.levelup(); happyJump(p, true); sparkles(scene, (pos || p.obj.position).clone().setY(0.8), { kind: 'star', colors: ['#ffd54f', '#ff8cc6', '#c9adff'], n: 18, speed: 2.4, up: 3 });
    toast(`${p.def.name} is now friendship Lv ${after}! 💗`, ICON[p.id]);
    if (after >= 3) award(`${p.id}_l3`); if (after >= 5) award(`${p.id}_l5`); if (after >= 8) award(`${p.id}_l8`);
  }
  if (focus === p) renderCare();
}
function updatePets(dt) {
  const ob = obstacles();
  for (const p of pets) {
    const s = p.st;
    // gentle real-time needs while the café is open (never below 30)
    if (s.fluff < 85) p.fluffed = false; if (s.fun < 85) p.funned = false;
    s.hunger = Math.max(Math.min(s.hunger, 30), s.hunger - dt / 25); s.fun = Math.max(Math.min(s.fun, 30), s.fun - dt / 20); s.fluff = Math.max(Math.min(s.fluff, 30), s.fluff - dt / 35);
    p.cool = Math.max(0, p.cool - dt);
    const o = p.obj, pos = o.position;
    let moving = false;
    if (p.held) { /* dragged by the player */ }
    else if (focus === p) { p.target = null; const want = Math.atan2(cam.position.x - pos.x, cam.position.z - pos.z); p.heading = lerpAngle(p.heading, p.look != null ? p.look : want, 1 - Math.exp(-dt * 8)); }
    else {
      if (!p.target) { p.wait -= dt; if (p.wait <= 0) { p.target = randSpot(); } }
      if (p.target) {
        const dx = p.target.x - pos.x, dz = p.target.z - pos.z, d = Math.hypot(dx, dz);
        if (d < 0.08) { p.target = null; p.wait = 2 + Math.random() * 4; }
        else {
          const sp = (p.def.mascot ? 0.8 : 0.95) * dt; pos.x += dx / d * Math.min(sp, d); pos.z += dz / d * Math.min(sp, d);
          p.heading = lerpAngle(p.heading, Math.atan2(dx, dz), 1 - Math.exp(-dt * 7)); moving = true;
        }
      }
      // little idle happy hop now and then when content
      p.happyT -= dt; if (p.happyT <= 0) { p.happyT = 5 + Math.random() * 6; if (needsOf(s) >= 60 && !moving && Math.random() < 0.5) { p.jumpT = 0.0001; p.jumpDur = 0.5; p.jumpH = 0.25; p.spin = 0; } }
    }
    pos.x = clamp(pos.x, FLOOR.x0, FLOOR.x1); pos.z = clamp(pos.z, FLOOR.z0 - (p.held ? 0.4 : 0), FLOOR.z1 + 0.25);
    o.rotation.y = p.heading;
    // body animation: hop while walking, jump arcs, chomp squash, groom wiggle, breathing
    let y = p.held ? 0.55 + Math.sin(performance.now() / 120) * 0.04 : 0, sx = 1, sy = 1, rz = 0, ry = 0;
    if (p.ch) { p.ch.mixer.update(dt); if (!p.held && !p.jumpT) p.ch.play(moving ? 'walk' : 'idle'); }
    else if (moving) { p.hop += dt * 11; y += Math.abs(Math.sin(p.hop)) * 0.13; const c = Math.cos(p.hop * 2); sy = 1 + c * 0.05; sx = 1 - c * 0.03; rz = Math.sin(p.hop) * 0.08; }
    else { const b = Math.sin(performance.now() / 420 + p.obj.id) * 0.025; sy = 1 + b; sx = 1 - b * 0.6; }
    if (p.jumpT > 0) {
      p.jumpT += dt; const t = Math.min(1, p.jumpT / p.jumpDur);
      y += Math.sin(t * PI) * p.jumpH; ry = p.spin * easeOut(t);
      if (t < 0.12) { sy *= 0.82; sx *= 1.12; } else if (t > 0.9) { sy *= 0.88; sx *= 1.08; } else { sy *= 1.08; sx *= 0.95; }
      if (t >= 1) { p.jumpT = 0; }
    }
    if (p.chomp > 0) { p.chomp -= dt; const c = Math.abs(Math.sin(p.chomp * 16)); sy *= 1 - c * 0.12; sx *= 1 + c * 0.08; }
    if (p.wig > 0) { p.wig -= dt; rz += Math.sin(p.wig * 30) * 0.12 * Math.min(1, p.wig * 3); }
    p.body.position.y = y; p.body.scale.set(sx, sy, sx); p.body.rotation.set(0, ry, rz);
    o.children[1].position.y = 0.085 - y; o.children[1].scale.setScalar(1 - Math.min(0.5, y * 0.6));
  }
}
const easeOut = t => 1 - Math.pow(1 - t, 3);
function lerpAngle(a, b, t) { let d = ((b - a + PI) % (2 * PI) + 2 * PI) % (2 * PI) - PI; return a + d * t; }

// ---------------------------------------------------------------- customers
function makeCustomers(chars) {
  for (const [i, c] of CUST.entries()) {
    const k = chars[i]; k.object.visible = false; scene.add(k.object);
    const bl = blob(0.9); k.object.add(bl);
    custPool.push({ ...c, k, busy: false });
  }
}
function seats() { return TABLES.map((t, i) => ({ i, t, on: !t.decor || P.decor.includes(t.decor) })).filter(s => s.on); }
function standOf(t) { return new THREE.Vector3(t.x + 0.98 * K, FY, t.z + 0.42 * K); }
function tableTop(t, k = 0) { return new THREE.Vector3(t.x + 0.2 * K + k * 0.3, 0.86 * K, t.z + 0.04); }

// ---------------------------------------------------------------- shift
let state = 'loading', shift = null, wantStart = false, careTool = 'feed';
const customers = [];
function levelCfg(n, isDaily) {
  const L = isDaily ? 7 : n;
  const hard = !isDaily && L > 5 && L % 6 === 0;
  const fk = isDaily ? 1 : F.k();
  const goal = Math.min(14, 3 + Math.floor((L - 1) * 0.55));
  const seatsN = seats().length;
  let patience = L <= 5 ? 30 : clamp(26 - (L - 5) * 0.55, 13, 26) / fk;
  let clock = Math.round(goal * (L <= 5 ? 9 : 7.2) + 10);
  if (hard) { patience *= 0.82; clock = Math.round(clock * 0.86); }
  const gap = L <= 2 ? 0.9 : clamp(2.6 - L * 0.06, 1.2, 2.6) / fk;
  const dbl = L < 5 ? 0 : clamp(0.15 + (L - 5) * 0.03, 0, 0.5) * fk;
  const menu = MENU.filter(m => m.lv <= Math.max(L, 1)).map(m => m.k);
  return { goal, patience, clock, gap, dbl, menu, hard, seatsN, L };
}
function startShift(isDaily = false) {
  if (state === 'play') return;
  closeCare(); closeSheet(); hideCard();
  const n = P.level, cfg = levelCfg(n, isDaily);
  const seed = isDaily ? (D.seed || ymd()) : n * 7919 + 13;
  shift = { n, daily: isDaily, cfg, served: 0, missed: 0, hearts: [], coins: 0, time: cfg.clock, spawnT: 0.6, rnd: rng(seed), t0: performance.now(), ended: false, vipDone: false, log: [] };
  for (const c of customers.splice(0)) releaseCust(c);
  state = 'play'; M.level(n); B.start();
  unlock(); if (!P.mute) music(true);
  buildTray(); showMode(); hud(); layoutCam();
  say(owner, cfg.hard ? 'Rush hour! ⚡' : isDaily ? 'Daily shift! ☀' : ['Let’s open!', 'Welcome in!', 'Café time!'][n % 3]);
  if (owner) owner.play('wave', { once: true });
  SND.door();
}
function spawnCustomer() {
  const free = seats().filter(s => !customers.some(c => c.seat === s.i));
  const pool = custPool.filter(c => !c.busy);
  if (!free.length || !pool.length) return false;
  const r = shift.rnd, seat = free[Math.floor(r() * free.length)], cp = pool[Math.floor(r() * pool.length)];
  const cfg = shift.cfg;
  const nItems = r() < cfg.dbl ? 2 : 1, want = [];
  for (let i = 0; i < nItems; i++) want.push(cfg.menu[Math.floor(r() * cfg.menu.length)]);
  const vip = !shift.daily && !shift.vipDone && P.vipDay !== ymd() && shift.served + customers.length === 0;
  if (vip) shift.vipDone = true;
  cp.busy = true;
  const k = cp.k; k.object.visible = true; k.object.position.copy(cafe.anchors.doorOut); k.play('walk');
  const c = { cp, seat: seat.i, t: TABLES[seat.i], want, got: [], phase: 'enter', path: [cafe.anchors.door.clone(), standOf(TABLES[seat.i])], pat: cfg.patience * (vip ? 1.3 : 1), patMax: cfg.patience * (vip ? 1.3 : 1), vip, el: null, items: [], shown: 0, leaveT: 0 };
  customers.push(c);
  return true;
}
function releaseCust(c) {
  c.cp.busy = false; c.cp.k.object.visible = false; if (c.el) c.el.remove();
  for (const it of c.items) scene.remove(it);
}
function orderBubble(c) {
  const el = document.createElement('div'); el.className = 'ob';
  el.innerHTML = `<div class="in">${c.vip ? '<span class="vip">👑 Daily visitor</span>' : ''}${c.want.map((w, i) => `<img data-i="${i}" src="${ICON[MI[w].id]}">`).join('')}<div class="pat"><i></i></div></div>`;
  el.addEventListener('pointerdown', e => { e.stopPropagation(); const m = c.want.find((w, i) => !c.got[i]); if (m) serve(m, c); });
  el.style.pointerEvents = 'auto';
  $('bub').appendChild(el); c.el = el; buildTray();
}
function updateCustomers(dt) {
  for (const c of [...customers]) {
    const o = c.cp.k.object; c.cp.k.mixer.update(dt);
    if (c.phase === 'enter' || c.phase === 'leave') {
      const tgt = c.path[0];
      if (!tgt) {
        if (c.phase === 'enter') { c.phase = 'order'; c.cp.k.play('wave', { once: true }); o.rotation.y = -0.75; orderBubble(c); SND.pop(); }
        else { releaseCust(c); customers.splice(customers.indexOf(c), 1); }
        continue;
      }
      const dx = tgt.x - o.position.x, dz = tgt.z - o.position.z, d = Math.hypot(dx, dz), sp = 1.7 * dt;
      if (d < 0.05) { c.path.shift(); continue; }
      o.position.x += dx / d * Math.min(sp, d); o.position.z += dz / d * Math.min(sp, d); o.position.y = FY;
      o.rotation.y = lerpAngle(o.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-dt * 10));
    } else if (c.phase === 'order') {
      c.shown += dt;
      // a pet cuddling nearby makes waiting nicer (patience drains slower)
      const near = pets.some(p => Math.hypot(p.obj.position.x - o.position.x, p.obj.position.z - o.position.z) < 1.0);
      c.pat -= dt * (near ? 0.5 : 1);
      o.rotation.y = lerpAngle(o.rotation.y, -0.75, 1 - Math.exp(-dt * 6));
      if (c.pat <= 0) { c.phase = 'leave'; c.el && c.el.remove(); c.el = null; shift.missed++; shift.log.push(0); say(c, '💭'); c.path = [cafe.anchors.door.clone(), cafe.anchors.doorOut.clone()]; c.cp.k.play('walk'); buildTray(); }
    } else if (c.phase === 'eat') {
      c.leaveT -= dt; if (c.leaveT <= 0) { c.phase = 'leave'; c.path = [cafe.anchors.door.clone(), cafe.anchors.doorOut.clone()]; c.cp.k.play('walk'); for (const it of c.items) shrinkAway(it); c.items = []; }
    }
    if (c.el) {
      const [x, y] = toScreen(_h.set(o.position.x, 1.42, o.position.z));
      c.el.style.transform = `translate(${x}px,${y}px)`;
      const f = clamp(c.pat / c.patMax, 0, 1), bar = c.el.querySelector('.pat i');
      bar.style.width = f * 100 + '%'; bar.style.background = f > 0.55 ? '#5fdcb6' : f > 0.25 ? '#ffd54f' : '#ff6f9e';
    }
  }
}
const _h = new THREE.Vector3();
function serve(k, prefer = null) {
  if (state !== 'play') return;
  const cands = customers.filter(c => c.phase === 'order' && c.want.some((w, i) => w === k && !c.got[i]));
  const btn = document.querySelector(`.ti[data-k="${k}"]`);
  if (!cands.length) { SND.nope(); if (btn) { btn.classList.remove('shake'); void btn.offsetWidth; btn.classList.add('shake'); } return; }
  const c = prefer && cands.includes(prefer) ? prefer : cands.sort((a, b) => a.pat / a.patMax - b.pat / b.patMax)[0];
  const i = c.want.findIndex((w, j) => w === k && !c.got[j]); c.got[i] = true;
  const img = c.el && c.el.querySelector(`img[data-i="${i}"]`); if (img) img.classList.add('ok');
  SND.pop(); buzz(12); tutStep(1);
  if (btn) btn.animate([{ transform: 'scale(.85)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 220 });
  const it = prop(MI[k].id, MI[k].s); scene.add(it);
  const from = cafe.anchors.serveFrom.clone(), to = tableTop(c.t, c.items.length);
  it.position.copy(from); c.items.push(it);
  flyers.push({ o: it, from, to, t: 0, dur: 0.45, h: 1.2, done: () => { squashObj(it); sparkles(scene, to.clone().setY(1.1), { kind: 'sparkle', colors: ['#fff', '#ffe07a'], n: 5, speed: 1, up: 1.5, size: 0.2 }); } });
  if (owner) owner.play('wave', { once: true, speed: 1.4 });
  if (c.got.length === c.want.length && c.got.every(Boolean)) setTimeout(() => finishCustomer(c), 460);
}
function finishCustomer(c) {
  if (!shift || shift.ended || c.phase !== 'order') return;
  const f = clamp(c.pat / c.patMax, 0, 1), h = f >= 0.55 ? 3 : f >= 0.25 ? 2 : 1;
  c.phase = 'eat'; c.leaveT = 1.6; c.el && c.el.remove(); c.el = null;
  c.cp.k.play('cheer', { once: true, then: 'idle' });
  const o = c.cp.k.object.position;
  hearts(_h.set(o.x, 1.4, o.z).clone(), 4 + h * 2);
  const hp = happyPets().length, tip = h + Math.min(3, hp);
  const coins = c.want.reduce((a, w) => a + MI[w].price, 0) + tip;
  shift.coins += coins; shift.served++; shift.hearts.push(h); shift.log.push(h);
  M.add(coins, 'serve');
  const [sx, sy] = toScreen(_h.set(o.x, 1.7, o.z));
  floatText('💗'.repeat(h), sx, sy - 30); coinFly(sx, sy, 3);
  if (hp && Math.random() < 0.5) setTimeout(() => floatText(`+${Math.min(3, hp)} pet tip 🐾`, sx, sy - 70, '#ffffff'), 250);
  SND.serve(); setTimeout(() => SND.heart(), 160);
  P.served[c.cp.id] = (P.served[c.cp.id] || 0) + 1;
  for (const n of [1, 10, 30]) if (P.served[c.cp.id] >= n) award(`${c.cp.id}_${n}`);
  if (c.vip) {
    P.vipDay = ymd(); M.add(25, 'daily-visitor'); shift.coins += 25;
    const gift = prop('m12', 0.42); gift.position.copy(tableTop(c.t, 1.4)); scene.add(gift); c.items.push(gift); squashObj(gift);
    sparkles(scene, gift.position.clone().setY(1.2), { kind: 'star', colors: ['#ffd54f', '#ff8cc6', '#c9adff', '#7fe3c4'], n: 16, speed: 2, up: 3 });
    toast(`${c.cp.name} left a gift! +25`, ICON.m12); award(`post_${new Date().getDay()}`);
  }
  if (Math.random() < 0.6) say(owner, ['Yay!', 'Enjoy! ♡', 'Thank you!', 'Yummy!'][Math.floor(Math.random() * 4)]);
  save(); hud(); buildTray();
  if (shift.served >= shift.cfg.goal) endShift(true);
}
function updateShift(dt) {
  if (state !== 'play' || !shift || shift.ended) return;
  shift.time -= dt;
  shift.spawnT -= dt;
  if (shift.spawnT <= 0) {
    const need = shift.cfg.goal - shift.served - customers.filter(c => c.phase !== 'leave').length;
    if (need > 0 && spawnCustomer()) shift.spawnT = shift.cfg.gap * (0.7 + shift.rnd() * 0.6); else shift.spawnT = 0.4;
  }
  const t = Math.max(0, Math.ceil(shift.time));
  $('clock').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  $('clockP').classList.toggle('low', t <= 10);
  $('goal').textContent = `${shift.served}/${shift.cfg.goal}`; $('goalbar').firstChild.style.width = (shift.served / shift.cfg.goal * 100) + '%';
  if (t <= 10 && t !== shift.lastTick) { shift.lastTick = t; if (t > 0) SND.tick(); }
  if (shift.time <= 0) endShift(false);
}
let recorded = false;
function endShift(won) {
  if (shift.ended) return; shift.ended = true; clearHand();
  const ms = performance.now() - shift.t0;
  if (!shift.recorded) { shift.recorded = true; if (!shift.daily) F.level(won, shift.served / shift.cfg.goal); }
  if (shift.served > 0) B.submit(shift.served, { ms });
  if (won) {
    state = 'won';
    const avg = shift.hearts.reduce((a, b) => a + b, 0) / Math.max(1, shift.hearts.length);
    const stars = avg >= 2.5 ? 3 : avg >= 1.8 ? 2 : 1; shift.stars = stars;
    let gained = 0;
    if (shift.daily) {
      const today = ymd();
      if (P.dDone !== today) {
        P.dDone = today; const yd = ymd(addDays(-1)), yd2 = ymd(addDays(-2)), wk = isoWeek();
        if (P.dLast === yd) P.dStreak++;
        else if (P.dLast === yd2 && P.freezeWeek !== wk) { P.dStreak++; P.freezeWeek = wk; shift.freeze = true; }
        else P.dStreak = 1;
        P.dLast = today;
      }
      D.won(shift.served, 'served');
    } else {
      const old = P.stars[shift.n] || 0; if (stars > old) { gained = stars - old; P.stars[shift.n] = stars; }
      if (shift.n === P.level) P.level++;
    }
    const bonus = 10 + stars * 5; shift.bonus = bonus; M.add(bonus, 'shift-win'); shift.coins += bonus;
    // happy pets share the joy of a good shift
    for (const p of happyPets()) gainXP(p, 2);
    save();
    SND.win(); buzz([20, 40, 20]);
    if (owner) owner.play('cheer', { once: true });
    for (const c of customers) if (c.phase === 'order' || c.phase === 'eat') c.cp.k.play('cheer', { once: true });
    for (const p of pets) happyJump(p, true);
    sparkles(scene, new THREE.Vector3(0, 2.2, 0.5), { kind: 'star', colors: ['#ffd54f', '#ff8cc6', '#c9adff', '#7fe3c4', '#ffffff'], n: 30, speed: 3.5, up: 4.5, spread: 2, size: 0.34 });
    sparkles(scene, new THREE.Vector3(0, 2.0, 0.5), { kind: 'heart', colors: ['#ff6fa8', '#ff9ad0'], n: 16, speed: 3, up: 4, spread: 2 });
    setTimeout(() => winCard(gained), 900);
  } else {
    state = 'lost'; SND.lose();
    if (owner) owner.play('idle');
    setTimeout(loseCard, 700);
  }
  for (const c of customers) { if (c.el) { c.el.remove(); c.el = null; } if (c.phase === 'order') { c.phase = 'eat'; c.leaveT = 1.2 + Math.random(); } }
  $('tray').classList.add('hidden'); $('shiftbar').classList.add('hidden');
  hud();
}

// ---------------------------------------------------------------- cards
const card = document.createElement('div'); card.id = 'card'; card.className = 'hidden'; document.body.appendChild(card);
let cardTap = null;
card.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; e.stopPropagation(); if (cardTap) { const f = cardTap; cardTap = null; f(); } });
function hideCard() { card.classList.add('hidden'); cardTap = null; }
function splash() {
  const kit = ICON.p01;
  const streak = P.dStreak > 1 && P.dLast >= ymd(addDays(-1)) ? `<p>🔥 ${P.dStreak}-day daily streak</p>` : '';
  const vip = P.vipDay !== ymd() ? `<p>👑 A daily visitor is coming today!</p>` : '';
  card.innerHTML = `<div class="cbox"><img class="hero" src="${kit}"><h1 class="logo ol">Pocket Pom<span>✿ cozy pet café ✿</span></h1>${streak}${vip}<p>Serve treats, pamper your pets, make friends.</p></div><div class="btns"><div class="hint">Tap to open the café</div></div>`;
  card.classList.remove('hidden');
  cardTap = () => { hideCard(); unlock(); startShift(Q.get('daily') === '1'); };
}
function winCard(gained) {
  const s = shift, st = s.stars;
  const row = s.log.map(h => h === 3 ? '💗' : h === 2 ? '💛' : h === 1 ? '🤍' : '💭').join('');
  card.innerHTML = `<div class="cbox"><img class="hero" src="${ICON.p01}"><h1 class="ol">${s.daily ? 'Daily done!' : s.cfg.hard ? 'Rush cleared!' : 'Shift cleared!'}</h1>
    <div class="stars">${[1, 2, 3].map(i => `<span class="${i <= st ? '' : 'off'}" style="animation-delay:${0.15 + i * 0.18}s">⭐</span>`).join('')}</div>
    <div class="grid2">${row}</div>
    <div class="rw"><span><img src="${ICON.coin}"> <b id="wc">+${s.coins}</b></span>${gained ? `<span>⭐ +${gained}</span>` : ''}</div>
    ${s.daily ? `<p>🔥 ${P.dStreak}-day streak${s.freeze ? ' · ❄️ freeze used' : ''}</p>` : `<p>${s.served} happy customers</p>`}
    ${nextUnlockLine()}</div>
    <div class="btns"><button class="jb butter" id="dbl">🎬 Double coins <small>watch a short video</small></button>${s.daily ? '<button class="jb lilac" id="shr">Share my day ✿</button>' : ''}<div class="hint">Tap to continue</div></div>`;
  card.classList.remove('hidden');
  if (st === 3) setTimeout(() => sparkles(scene, new THREE.Vector3(0, 2.5, 1), { kind: 'star', colors: ['#ffd54f', '#fff'], n: 20, speed: 3, up: 4, spread: 2 }), 600);
  const dbl = $('dbl');
  dbl.addEventListener('click', async e => { e.stopPropagation(); dbl.disabled = true; const c = s.coins; if (await M.rewarded('double', { what: `${c * 2} coins instead of ${c}` })) { M.add(c, 'double'); $('wc').textContent = '+' + c * 2; dbl.innerHTML = '✓ Doubled!'; SND.coin(); } else dbl.disabled = false; });
  const shr = $('shr'); if (shr) shr.addEventListener('click', e => { e.stopPropagation(); shareGrid(); });
  cardTap = async () => { hideCard(); toReady(); await M.breakAd('level-end', { level: s.n }); };
}
function nextUnlockLine() {
  const ts = totalStars();
  const p = PETS.find(p => !P.pets[p.id]); const d = DECOR.find(d => !P.decor.includes(d.id));
  if (p && ts >= p.stars) return `<p>🐾 ${p.name} the ${p.kind} can be adopted now!</p>`;
  if (p) return `<p>🐾 ${p.name} the ${p.kind} at ⭐${p.stars}</p>`;
  if (d) return `<p>✨ New decor: ${d.n}</p>`;
  return '';
}
function loseCard() {
  const s = shift;
  card.innerHTML = `<div class="cbox"><img class="hero" src="${ICON.p01}"><h1 class="ol">Closing time!</h1><p>${s.served} of ${s.cfg.goal} customers served.</p><p>${s.served >= s.cfg.goal - 1 ? 'So close! Your pets saved you a cookie 🍪' : 'No worries, the pets still love you ♡'}</p></div>
    <div class="btns"><div class="hint">Tap to try again</div></div>`;
  card.classList.remove('hidden');
  // one offer, never in the first 1.2 s after losing
  setTimeout(() => {
    if (card.classList.contains('hidden') || state !== 'lost') return;
    const b = document.createElement('button'); b.className = 'jb mint'; b.id = 'rev'; b.innerHTML = '🎬 +20 seconds open <small>watch a short video</small>';
    card.querySelector('.btns').prepend(b);
    b.addEventListener('click', async e => { e.stopPropagation(); b.disabled = true; if (await M.rewarded('moves', { what: '20 more seconds before the café closes' })) resumeShift(20); else b.disabled = false; });
  }, 1300);
  cardTap = () => { hideCard(); toReady(true); };
}
function resumeShift(sec) {
  hideCard(); state = 'play'; shift.ended = false; shift.time = sec;
  if (!recorded) {} // already recorded once for this run
  for (const c of customers) if (c.phase === 'eat' && !c.items.length) { c.phase = 'leave'; c.path = [cafe.anchors.door.clone(), cafe.anchors.doorOut.clone()]; c.cp.k.play('walk'); }
  showMode(); buildTray(); say(owner, 'Extra time! ♡');
}
function shareGrid() {
  const s = shift, d = new Date();
  const row = s.log.map(h => h === 3 ? '💗' : h === 2 ? '💛' : h === 1 ? '🤍' : '💭').join('');
  const text = `Pocket Pom ☀ Daily ${d.getMonth() + 1}/${d.getDate()} ${'⭐'.repeat(s.stars || 1)}\n${row}\n🐾 ${pets.length} pets · 🔥${P.dStreak}`;
  const url = location.origin + location.pathname + '?daily=1';
  if (navigator.share) navigator.share({ title: NAME, text, url }).catch(() => {});
  else navigator.clipboard && navigator.clipboard.writeText(`${text}\n${url}`).then(() => toast('Copied! ✿')).catch(() => {});
}
function toReady(retry = false) {
  state = 'ready';
  for (const c of customers) if (c.phase !== 'leave') { if (c.el) { c.el.remove(); c.el = null; } c.phase = 'leave'; c.path = [cafe.anchors.door.clone(), cafe.anchors.doorOut.clone()]; c.cp.k.play('walk'); for (const it of c.items) shrinkAway(it); c.items = []; }
  const keepDaily = retry && shift && shift.daily; shift = null; showMode(); hud(); layoutCam();
  if (keepDaily) $('openB').dataset.daily = '1'; else delete $('openB').dataset.daily;
  $('openB').innerHTML = keepDaily ? 'Retry daily ☀' : `Open café ☀ <small>Shift ${P.level}${levelCfg(P.level, false).hard ? ' · Rush hour ⚡' : ''}</small>`;
  const hungry = pets.find(p => needsOf(p.st) < 45);
  $('freeLine').textContent = hungry ? `${hungry.def.name} would love some attention ♡ tap to care` : 'Tap a pet to feed, play & groom ♡';
  if (P.tut === 1 && pets[0]) { P.tut = 2; save(); setTimeout(() => pointAtPet(pets[0]), 600); }
}

// ---------------------------------------------------------------- tray + modes
function buildTray() {
  const tray = $('tray');
  if (state !== 'play' || !shift) return;
  const wants = new Set(customers.filter(c => c.phase === 'order').flatMap(c => c.want.filter((w, i) => !c.got[i])));
  const menu = MENU.filter(m => shift.cfg.menu.includes(m.k));
  if (tray.dataset.sig !== menu.map(m => m.k).join()) {
    tray.dataset.sig = menu.map(m => m.k).join();
    tray.innerHTML = menu.map(m => `<button class="ti" data-k="${m.k}" aria-label="${m.n}"><img src="${ICON[m.id]}"><i>${m.n}</i></button>`).join('');
    tray.querySelectorAll('.ti').forEach(b => b.addEventListener('pointerdown', e => { e.stopPropagation(); unlock(); serve(b.dataset.k); }));
  }
  tray.querySelectorAll('.ti').forEach(b => b.classList.toggle('want', wants.has(b.dataset.k)));
  if (P.tut < 1 && wants.size) { const b = tray.querySelector('.ti.want'); if (b) pointAt(b); }
}
function showMode() {
  const play = state === 'play';
  $('tray').classList.toggle('hidden', !play); $('shiftbar').classList.toggle('hidden', !play);
  $('free').classList.toggle('hidden', state !== 'ready' || !!focus);
  $('care').classList.toggle('hidden', !focus);
  $('side').classList.toggle('hidden', state !== 'ready' || !!focus);
  document.querySelectorAll('.th').forEach(t => t.style.display = play ? 'none' : '');
}
let handEl = null;
function pointAt(elm) { clearHand(); const r = elm.getBoundingClientRect(); handEl = document.createElement('div'); handEl.id = 'hand'; handEl.textContent = '👆'; handEl.style.left = (r.left + r.width / 2) + 'px'; handEl.style.top = (r.top + r.height * 0.55) + 'px'; document.body.appendChild(handEl); }
function pointAtPet(p) { clearHand(); if (state !== 'ready') return; handEl = document.createElement('div'); handEl.id = 'hand'; handEl.textContent = '👆'; handEl.dataset.pet = p.id; document.body.appendChild(handEl); }
function clearHand() { if (handEl) { handEl.remove(); handEl = null; } }
function tutStep(n) { if (P.tut < n) { P.tut = n; save(); } clearHand(); }

// ---------------------------------------------------------------- speech + thought bubbles
const says = [];
function say(who, text) {
  if (!who) return; const o = who.k ? who.k.object : who.object;
  const el = document.createElement('div'); el.className = 'say'; el.innerHTML = `<div class="in">${text}</div>`; $('bub').appendChild(el);
  says.push({ el, o, t: 1.6, h: who.k ? 1.5 : 2.0 });
}
function updateBubbles(dt) {
  for (let i = says.length - 1; i >= 0; i--) {
    const s = says[i]; s.t -= dt; const [x, y] = toScreen(_h.set(s.o.position.x, s.h, s.o.position.z));
    s.el.style.transform = `translate(${x}px,${y}px)`; s.el.style.opacity = Math.min(1, s.t * 3);
    if (s.t <= 0) { s.el.remove(); says.splice(i, 1); }
  }
  for (const p of pets) {
    const s = p.st, low = s.hunger < 40 ? '🍪' : s.fun < 40 ? '🪄' : s.fluff < 40 ? '🫧' : null;
    if (low && focus !== p && !p.held) {
      if (!p.th) { p.th = document.createElement('div'); p.th.className = 'th'; p.th.innerHTML = '<div class="in"></div>'; $('bub').appendChild(p.th); }
      p.th.firstChild.textContent = low; p.th.style.display = state === 'play' ? 'none' : '';
      const top = (p.def.mascot ? 0.95 : p.def.size * 1.05) + 0.25 + p.body.position.y;
      const [x, y] = toScreen(_h.set(p.obj.position.x, top, p.obj.position.z)); p.th.style.transform = `translate(${x}px,${y}px)`;
    } else if (p.th) { p.th.remove(); p.th = null; }
  }
  if (handEl && handEl.dataset.pet) { const p = pets.find(q => q.id === handEl.dataset.pet); if (p && state === 'ready' && !focus) { const [x, y] = toScreen(_h.set(p.obj.position.x, p.def.size * 0.5, p.obj.position.z)); handEl.style.left = x + 'px'; handEl.style.top = y + 'px'; } else clearHand(); }
}

// ---------------------------------------------------------------- flyers + squash
function updateFlyers(dt) {
  for (let i = flyers.length - 1; i >= 0; i--) {
    const f = flyers[i]; f.t += dt; const t = Math.min(1, f.t / f.dur), e = t;
    f.o.position.lerpVectors(f.from, f.to, e); f.o.position.y += Math.sin(t * PI) * f.h;
    f.o.rotation.y = t * PI * 2 * (f.spin ?? 1);
    if (t >= 1) { f.o.rotation.y = 0; flyers.splice(i, 1); f.done && f.done(); }
  }
  for (let i = squash.length - 1; i >= 0; i--) {
    const s = squash[i]; s.t += dt; const t = s.t / 0.45;
    const k = t >= 1 ? 1 : 1 + Math.sin(t * PI * 2.5) * 0.28 * (1 - t);
    s.o.scale.set(s.base * (2 - k) ** 0.5, s.base * k, s.base * (2 - k) ** 0.5);
    if (t >= 1) { s.o.scale.setScalar(s.base); squash.splice(i, 1); }
  }
}
function squashObj(o, base = 1) { squash.push({ o, t: 0, base }); }
function shrinkAway(o) { const t0 = performance.now(); const f = () => { const t = (performance.now() - t0) / 300; o.scale.setScalar(Math.max(0.001, 1 - t)); if (t < 1) requestAnimationFrame(f); else scene.remove(o); }; f(); }

// ---------------------------------------------------------------- care mode
function openCare(p) {
  if (state !== 'ready') return;
  clearHand(); focus = p; careTool = careTool || 'feed'; p.target = null;
  if (!P.album[`${p.id}_met`]) award(`${p.id}_met`);
  renderCare(); showMode(); layoutCam(); setTool(careTool);
  SND.squeak(); happyJump(p); hearts(p.obj.position.clone().setY(0.8), 5);
}
function closeCare() { if (!focus) return; focus.look = null; focus = null; setTool(null); showMode(); layoutCam(); }
function renderCare() {
  const p = focus; if (!p) return; const s = p.st, lv = petLv(s), cur = LV_XP[lv - 1], nxt = LV_XP[lv] ?? cur + 60;
  const fill = (v) => v >= 60 ? 'linear-gradient(90deg,#7fe3c4,#3fd1a6)' : v >= 40 ? 'linear-gradient(90deg,#ffe07a,#ffc22e)' : 'linear-gradient(90deg,#ffb3d0,#ff6f9e)';
  const el = $('care');
  el.innerHTML = `<div class="care-h"><img src="${ICON[p.id]}"><div class="nm"><b class="">${p.def.name}</b><small>${p.def.kind} · loves ${MI[p.def.likes].n.toLowerCase()}s</small>
    <div class="fr"><em>💗 Lv ${lv}</em><div class="bar"><i style="width:${lv >= 10 ? 100 : (s.xp - cur) / (nxt - cur) * 100}%"></i></div></div></div><button class="xbtn" id="cx" aria-label="Close">✕</button></div>
    <div class="needs">${[['feed', '🍪', 'Feed', s.hunger], ['play', '🪄', 'Play', s.fun], ['groom', '🫧', 'Groom', s.fluff]].map(([k, ic, n, v]) => `<button class="need ${careTool === k ? 'on' : ''} ${v < 40 ? 'low' : ''}" data-t="${k}"><span class="ic">${ic}</span>${n}<span class="nb"><i style="width:${v}%;background:${fill(v)}"></i></span></button>`).join('')}</div>
    <div id="careTool"></div>`;
  $('cx').addEventListener('pointerdown', e => { e.stopPropagation(); closeCare(); SND.soft(); });
  el.querySelectorAll('.need').forEach(b => b.addEventListener('pointerdown', e => { e.stopPropagation(); setTool(b.dataset.t); SND.tap(); }));
  renderTool();
}
function renderTool() {
  const t = $('careTool'); if (!t) return;
  if (careTool === 'feed') {
    const L = [{ k: 'kib', n: 'Kibble', c: 0, icon: ICON.kib }, ...['cup', 'mac', 'don'].map(k => ({ k, n: MI[k].n, c: k === focus.def.likes ? 3 : 5, icon: ICON[MI[k].id] }))];
    t.innerHTML = L.map(x => `<button class="treat" data-k="${x.k}" aria-label="${x.n}"><img src="${x.icon}"><i>${x.c ? `<img class="ci" src="${ICON.coin}">` + x.c : 'free'}</i></button>`).join('');
    t.querySelectorAll('.treat').forEach(b => b.addEventListener('pointerdown', e => { e.stopPropagation(); feed(b.dataset.k, b); }));
  } else t.innerHTML = `<div class="careHint">${careTool === 'play' ? '🪄 Wave the star wand around ' + focus.def.name + '!' : '🫧 Rub ' + focus.def.name + ' with the brush!'}</div>`;
}
function setTool(k) {
  careTool = k || careTool;
  tool.wand.visible = !!focus && k === 'play'; tool.brush.visible = !!focus && k === 'groom';
  if (focus && k) { const el = $('care'); el.querySelectorAll('.need').forEach(b => b.classList.toggle('on', b.dataset.t === k)); renderTool(); placeTool(); }
}
const tool = { wand: null, brush: null, pos: new THREE.Vector3(), last: new THREE.Vector3(), rub: 0, bubbleT: 0, jumpT: 0 };
function placeTool() { if (!focus) return; const p = focus.obj.position; tool.pos.set(p.x + 0.5, (focus.def.mascot ? 0.6 : focus.def.size * 0.6) + 0.3, p.z + 0.4); tool.last.copy(tool.pos); }
function feed(k, btn) {
  const p = focus; if (!p || p.chomp > 0) return;
  const cost = k === 'kib' ? 0 : (k === p.def.likes ? 3 : 5);
  if (cost && !M.spend(cost, 'treat')) { SND.nope(); toast('Not enough coins: kibble is free ♡'); return; }
  const it = k === 'kib' ? kibbleBowl() : prop(MI[k].id, 0.32);
  if (k === 'kib') it.scale.setScalar(0.42);
  const r = btn.getBoundingClientRect(), ndc = new THREE.Vector3((r.left + r.width / 2) / W * 2 - 1, -((r.top) / H) * 2 + 1, 0.5);
  ndc.unproject(cam); const dir = ndc.sub(cam.position).normalize(), from = cam.position.clone().addScaledVector(dir, cam.position.distanceTo(p.obj.position) * 0.7);
  const fwd = new THREE.Vector3(Math.sin(p.heading), 0, Math.cos(p.heading));
  const to = p.obj.position.clone().addScaledVector(fwd, (p.def.mascot ? 0.35 : p.def.size * 0.55)).setY(k === 'kib' ? 0.08 : 0.12);
  it.position.copy(from); scene.add(it); SND.pop();
  flyers.push({ o: it, from, to, t: 0, dur: 0.5, h: 0.6, spin: 0.5, done: () => {
    p.chomp = 1.0; SND.munch(); buzz(15);
    sparkles(scene, to.clone().setY(0.35), { kind: 'dot', colors: ['#f5c27a', '#ffd9a6', '#ffffff'], n: 8, speed: 1.2, up: 1.6, size: 0.1, gravity: 5 });
    setTimeout(() => { shrinkAway(it); const gain = k === 'kib' ? 25 : k === p.def.likes ? 60 : 45; const was = p.st.hunger; p.st.hunger = Math.min(100, p.st.hunger + gain);
      happyJump(p, k === p.def.likes); hearts(p.obj.position.clone().setY(0.9), k === p.def.likes ? 12 : 6);
      const [x, y] = toScreen(_h.set(p.obj.position.x, 1.1, p.obj.position.z)); floatText(k === p.def.likes ? 'Favourite!! 💗' : 'Yum! ♡', x, y);
      if (was < 95) gainXP(p, k === 'kib' ? 2 : k === p.def.likes ? 6 : 4); else { const [x2, y2] = toScreen(_h.set(p.obj.position.x, 1.4, p.obj.position.z)); floatText('So full! 😋', x2, y2 - 30, '#ffffff'); } renderCare(); save(); }, 900);
  } });
}
function careMove(ray, down, dt) {
  const p = focus; if (!p || (careTool !== 'play' && careTool !== 'groom')) return;
  // move the tool on a camera-facing plane through the pet
  const n = cam.getWorldDirection(new THREE.Vector3()).negate(); const pl = new THREE.Plane().setFromNormalAndCoplanarPoint(n, p.obj.position.clone().setY(0.4));
  const hit = ray.ray.intersectPlane(pl, new THREE.Vector3()); if (!hit) return;
  hit.y = clamp(hit.y, 0.15, 1.8); tool.pos.copy(hit);
  const sp = tool.pos.distanceTo(tool.last) / Math.max(dt, 1 / 120); const moved = tool.pos.distanceTo(tool.last); tool.last.copy(tool.pos);
  if (careTool === 'play') {
    p.look = Math.atan2(tool.pos.x - p.obj.position.x, tool.pos.z - p.obj.position.z);
    if (moved > 0.02 && Math.random() < 0.35) sparkles(scene, tool.pos.clone(), { kind: 'sparkle', colors: ['#ffe07a', '#ffffff', '#ff9ad0'], n: 1, speed: 0.3, up: 0.3, size: 0.18, gravity: 0.5 });
    tool.jumpT -= dt;
    if (sp > 4 && tool.jumpT <= 0 && !p.jumpT) {
      tool.jumpT = 0.7; happyJump(p, Math.random() < 0.25); const was = p.st.fun; p.st.fun = Math.min(100, p.st.fun + 8);
      hearts(p.obj.position.clone().setY(0.9), 3); tool.plays = (tool.plays || 0) + 1;
      if (tool.plays % 2 === 0 && was < 95) gainXP(p, 1);
      if (!p.funned && p.st.fun >= 100) { p.funned = true; const [x, y] = toScreen(_h.set(p.obj.position.x, 1.2, p.obj.position.z)); floatText('So much fun!! ✨', x, y); SND.sparkle(); gainXP(p, 3); }
      renderCareBars();
    }
  } else if (careTool === 'groom' && down) {
    const c = p.obj.position.clone().setY((p.def.mascot ? 0.45 : p.def.size * 0.45)), r = (p.def.mascot ? 0.5 : p.def.size * 0.6);
    if (ray.ray.distanceSqToPoint(c) < r * r && moved > 0.005) {
      tool.rub += moved; p.wig = 0.3; const was = p.st.fluff; p.st.fluff = Math.min(100, p.st.fluff + moved * 22);
      tool.bubbleT -= dt; if (tool.bubbleT <= 0) { tool.bubbleT = 0.06; sparkles(scene, tool.pos.clone(), { kind: 'bubble', colors: ['#d8f6ff', '#ffe0f2', '#efe0ff'], n: 2, speed: 0.6, up: 0.9, size: 0.2, gravity: -0.4, life: 1.2 }); SND.bubble(); }
      if (tool.rub > 1.6) { tool.rub = 0; if (was < 95) gainXP(p, 1); SND.brush(); }
      if (!p.fluffed && p.st.fluff >= 100) { p.fluffed = true; const [x, y] = toScreen(_h.set(p.obj.position.x, 1.2, p.obj.position.z)); floatText('Sparkly clean! ✨', x, y); SND.sparkle(); happyJump(p, true); sparkles(scene, c.clone().setY(0.9), { kind: 'sparkle', colors: ['#ffffff', '#fff3a6', '#c9f6ff'], n: 14, speed: 1.8, up: 2 }); gainXP(p, 3); }
      renderCareBars();
    }
  }
}
let barT = 0;
function renderCareBars() { const now = performance.now(); if (now - barT < 120) return; barT = now; const el = $('care'); if (!el || !focus) return; const s = focus.st; const v = [s.hunger, s.fun, s.fluff];
  el.querySelectorAll('.need .nb i').forEach((b, i) => { b.style.width = v[i] + '%'; b.style.background = v[i] >= 60 ? 'linear-gradient(90deg,#7fe3c4,#3fd1a6)' : v[i] >= 40 ? 'linear-gradient(90deg,#ffe07a,#ffc22e)' : 'linear-gradient(90deg,#ffb3d0,#ff6f9e)'; b.parentNode.parentNode.classList.toggle('low', v[i] < 40); }); }
function updateTool(dt) {
  if (tool.wand.visible) { tool.wand.position.lerp(tool.pos, 1 - Math.exp(-dt * 18)); tool.wand.rotation.z = Math.sin(performance.now() / 200) * 0.3; }
  if (tool.brush.visible) { tool.brush.position.lerp(tool.pos, 1 - Math.exp(-dt * 20)); tool.brush.rotation.z = 0.5 + Math.sin(performance.now() / 90) * (input.down ? 0.25 : 0.05); }
}

// ---------------------------------------------------------------- input: pets (tap = care, drag = carry / cuddle)
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const input = { down: false, x: 0, y: 0, sx: 0, sy: 0, pet: null, drag: false, lastT: 0 };
function setRay(e) { ndc.set(e.clientX / W * 2 - 1, -(e.clientY / H) * 2 + 1); ray.setFromCamera(ndc, cam); }
function pickPet() {
  let best = null, bd = 1e9;
  for (const p of pets) { const c = p.obj.position.clone().setY((p.def.mascot ? 0.4 : p.def.size * 0.45) + p.body.position.y), r = (p.def.mascot ? 0.5 : p.def.size * 0.62) + 0.12; const d = ray.ray.distanceSqToPoint(c); if (d < r * r && d < bd) { bd = d; best = p; } }
  return best;
}
const floorPl = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.1);
R.domElement.addEventListener('pointerdown', e => {
  unlock(); input.down = true; input.sx = input.x = e.clientX; input.sy = input.y = e.clientY; input.drag = false; input.lastT = performance.now();
  setRay(e);
  if (focus) { careMove(ray, true, 1 / 60); return; }
  if (state === 'ready' || state === 'play') input.pet = pickPet();
});
addEventListener('pointermove', e => {
  if (!focus && !input.down) return;
  setRay(e); const now = performance.now(), dt = Math.max(0.004, (now - input.lastT) / 1000); input.lastT = now;
  if (focus) { careMove(ray, input.down, dt); return; }
  if (input.pet && !input.drag && Math.hypot(e.clientX - input.sx, e.clientY - input.sy) > 12) { input.drag = true; input.pet.held = true; input.pet.target = null; SND.squeak(); }
  if (input.drag && input.pet) { const hit = ray.ray.intersectPlane(floorPl, new THREE.Vector3()); if (hit) { input.pet.obj.position.x = hit.x; input.pet.obj.position.z = hit.z; } }
});
addEventListener('pointerup', e => {
  input.down = false; const p = input.pet; input.pet = null;
  if (focus) return;
  if (!p) return;
  if (input.drag) {
    p.held = false; squashLand(p);
    // dropped next to a waiting customer: a cuddle makes them happier to wait
    const c = customers.find(c => c.phase === 'order' && Math.hypot(c.cp.k.object.position.x - p.obj.position.x, c.cp.k.object.position.z - p.obj.position.z) < 1.3);
    if (c && state === 'play') {
      if (p.cool <= 0) { c.pat = Math.min(c.patMax, c.pat + c.patMax * 0.5); p.cool = 12; happyJump(p, true); hearts(c.cp.k.object.position.clone().setY(1.3), 10); c.cp.k.play('jump', { once: true }); gainXP(p, 2); const [x, y] = toScreen(_h.set(c.cp.k.object.position.x, 1.7, c.cp.k.object.position.z)); floatText('Cuddle! 💗', x, y); SND.heart(); }
      else { const [x, y] = toScreen(_h.set(p.obj.position.x, 1, p.obj.position.z)); floatText('Sleepy… 💤', x, y, '#ffffff'); }
    }
  } else if (state === 'ready') { openCare(p); }
  else if (state === 'play') { happyJump(p); hearts(p.obj.position.clone().setY(0.8), 4); p.st.fun = Math.min(100, p.st.fun + 2); }
});
function squashLand(p) { p.jumpT = 0.0001; p.jumpDur = 0.35; p.jumpH = 0.08; p.spin = 0; SND.boing(); }

// ---------------------------------------------------------------- sheets: pets, decor, album
function sheet(html) {
  closeSheet(); const w = document.createElement('div'); w.id = 'sheet'; w.innerHTML = `<div class="sh">${html}</div>`; document.body.appendChild(w);
  w.addEventListener('pointerdown', e => { e.stopPropagation(); if (e.target === w) closeSheet(); });
  w.querySelector('.xbtn')?.addEventListener('click', closeSheet);
  return w;
}
function closeSheet() { const s = $('sheet'); if (s) { s.remove(); hud(); } }
function petsSheet() {
  const ts = totalStars();
  const w = sheet(`<div class="top"><span style="width:40px"></span><h2 class="ol">Pet friends</h2><button class="xbtn">✕</button></div><div class="sub">Adopt with coins once you have enough ⭐ stars</div>
    <div class="grid">${PETS.map(p => { const own = !!P.pets[p.id], lv = own ? petLv(P.pets[p.id]) : 0, ok = ts >= p.stars;
      return `<div class="cardi ${own ? 'own' : ok ? '' : 'lock'}"><img src="${ICON[p.id]}"><b>${p.name}</b><small>${p.kind}</small>${own ? `<small>💗 Lv ${lv}</small>` : ok ? `<button class="jb" data-a="${p.id}"><img class="ci" src="${ICON.coin}">${p.fee}</button>` : `<small>🔒 ⭐ ${p.stars}</small>`}</div>`; }).join('')}</div>`);
  w.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', async e => { e.stopPropagation(); adopt(b.dataset.a); }));
}
async function adopt(id) {
  const def = PI_[id]; if (P.pets[id]) return;
  if (!M.spend(def.fee, 'adopt')) { SND.nope(); closeSheet(); toast('Need a few more coins ♡'); M.shop(); return; }
  P.pets[id] = { hunger: 80, fun: 80, fluff: 90, xp: 0 }; save(); closeSheet();
  if (def.mascot && !charCache[id]) { try { charCache[id] = await loadChar(id, def.h); } catch (e) { return; } ICON[id] = ICON[id] || ICON.p01; }
  const p = addPetObj(id, true); award(`${id}_met`);
  SND.levelup(); sparkles(scene, p.obj.position.clone().setY(1), { kind: 'heart', colors: ['#ff6fa8', '#ff9ad0', '#fff'], n: 18, speed: 2.5, up: 3.5 });
  toast(`Welcome home, ${def.name}! 💗`, ICON[id]); hud();
}
function decorSheet() {
  const ts = totalStars();
  const w = sheet(`<div class="top"><span style="width:40px"></span><h2 class="ol">Decorate</h2><button class="xbtn">✕</button></div><div class="sub">Make the café yours ✿ stars from shifts unlock more</div>
    <div class="grid">${DECOR.map(d => { const own = P.decor.includes(d.id), ok = ts >= d.st;
      return `<div class="cardi ${own ? 'own' : ok ? '' : 'lock'}"><img src="${ICON[d.id]}"><b>${d.n}</b>${d.note ? `<small>${d.note}</small>` : ''}${own ? '<small>✓ placed</small>' : ok ? `<button class="jb mint" data-a="${d.id}"><img class="ci" src="${ICON.coin}">${d.cost}</button>` : `<small>🔒 ⭐ ${d.st}</small>`}</div>`; }).join('')}</div>`);
  w.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); buyDecor(b.dataset.a); }));
}
function buyDecor(id) {
  const d = DECOR.find(x => x.id === id); if (!d || P.decor.includes(id)) return;
  if (!M.spend(d.cost, 'decor')) { SND.nope(); closeSheet(); toast('Need a few more coins ♡'); M.shop(); return; }
  P.decor.push(id); save(); closeSheet(); placeDecor(d, true); award(`dec_${id}`); hud();
}
function placeDecor(d, anim) {
  const o = prop(d.id, d.size, d.rot || 0); o.position.set(...d.pos); scene.add(o); decorObjs[d.id] = o;
  if (anim) { o.scale.setScalar(0.01); const t0 = performance.now(); const f = () => { const t = Math.min(1, (performance.now() - t0) / 500); o.scale.setScalar(Math.max(0.01, 1 + Math.sin(t * PI * 2.2) * 0.25 * (1 - t) - (1 - t) * 0.8 * (t < 0.3 ? 1 : 0))); if (t < 1) requestAnimationFrame(f); else o.scale.setScalar(1); }; f();
    SND.sparkle(); sparkles(scene, o.position.clone().setY(o.position.y + 0.8), { kind: 'star', colors: ['#ffd54f', '#ff8cc6', '#c9adff', '#7fe3c4'], n: 16, speed: 2, up: 3 }); }
}
function albumSheet() {
  const L = stickers(), got = L.filter(s => P.album[s.id]).length, newS = new Set(P.newSt);
  const groups = [...new Set(L.map(s => s.g))];
  sheet(`<div class="top"><span style="width:40px"></span><h2 class="ol">Sticker album</h2><button class="xbtn">✕</button></div><div class="sub">${got} / ${L.length} stickers collected</div>
    <div class="prog"><i style="width:${got / L.length * 100}%"></i></div><div style="overflow:auto">
    ${groups.map(g => `<div class="album-h">${g}</div><div class="agrid">${L.filter(s => s.g === g).map(s => `<div class="st ${P.album[s.id] ? 'got' : ''} ${newS.has(s.id) ? 'new' : ''}">${P.album[s.id] ? `<span class="bd">${s.badge}</span>` : ''}<img src="${ICON[s.icon] || ICON.m12}" style="transform:rotate(${(s.id.length * 7 % 13) - 6}deg)"><small>${s.cap}</small></div>`).join('')}</div>`).join('')}</div>`);
  P.newSt = []; save(); hud();
}

// ---------------------------------------------------------------- side buttons
const bind = (id, fn) => $(id).addEventListener('click', e => { e.stopPropagation(); unlock(); SND.tap(); fn(); });
bind('bPets', petsSheet); bind('bDecor', decorSheet); bind('bAlbum', albumSheet);
bind('bDaily', () => { if (P.dDone === ymd()) toast('Today’s daily is done ✓ play again for fun!'); startShift(true); });
bind('bMute', () => { P.mute = !P.mute; save(); setMuted(P.mute); music(!P.mute && state !== 'loading'); $('bMute').textContent = P.mute ? '🔇' : '🔊'; });
bind('plus', () => M.shop());
$('openB').addEventListener('click', e => { e.stopPropagation(); unlock(); SND.tap(); startShift($('openB').dataset.daily === '1'); });
['hud', 'side', 'bottom'].forEach(id => $(id).addEventListener('pointerdown', e => { if (e.target.closest('button')) e.stopPropagation(); }));
setMuted(P.mute); $('bMute').textContent = P.mute ? '🔇' : '🔊';

// ---------------------------------------------------------------- test hooks + bot
let botT = 0;
window.__game = {
  get state() { return state === 'loading' ? 'ready' : state; }, get level() { return shift ? shift.n : P.level; }, get score() { return shift ? shift.served : totalStars(); },
  get coins() { return M.coins(); }, get pets() { return pets.map(p => ({ id: p.id, ...p.st, lv: petLv(p.st) })); },
  perf: () => ({ calls: R.info.render.calls, tris: R.info.render.triangles }),
  start: () => startShift(false), _lose: () => { if (shift) shift.time = 0; }, care: (i = 0) => openCare(pets[i]), closeCare, adopt, buyDecor, album: albumSheet, petsSheet, decorSheet, feed: (k = 'kib') => feed(k, document.querySelector('.treat')),
  bot() {
    if (state === 'loading') { wantStart = true; return; }
    const now = performance.now(); if (now - botT < 650) return;
    if (state === 'ready') { botT = now; if (!card.classList.contains('hidden')) { cardTap && cardTap(); return; } closeCare(); closeSheet(); startShift(false); return; }
    if (state !== 'play') return;
    const c = customers.filter(c => c.phase === 'order' && c.shown > 0.7).sort((a, b) => a.pat / a.patMax - b.pat / b.patMax)[0];
    if (!c) return;
    const k = c.want.find((w, i) => !c.got[i]); if (k) { botT = now; serve(k, c); }
  },
};

// ---------------------------------------------------------------- loop + boot
let last = performance.now();
function frame(t) {
  const dt = Math.min(0.05, (t - last) / 1000); last = t;
  if (cafe) {
    updateShift(dt); updateCustomers(dt); updatePets(dt); updateFlyers(dt); updateSparkles(dt); updateBubbles(dt); updateTool(dt);
    if (owner) owner.mixer.update(dt);
    const tt = t / 1000; for (const o of Object.values(decorObjs)) if (o.userData.id === 'h06') o.rotation.y = Math.sin(tt) * 0.02;
    ambT -= dt; if (ambT <= 0) { ambT = 0.35; sparkles(scene, new THREE.Vector3((Math.random() - 0.5) * 5.6, 0.3 + Math.random() * 2.2, -1.5 + Math.random() * 5.2), { kind: Math.random() < 0.7 ? 'sparkle' : 'heart', colors: ['#ffffff', '#fff3a6', '#ffd1ea'], n: 1, speed: 0.1, up: 0.25, size: 0.13, gravity: -0.05, life: 2.2 }); }
    savePulse += dt; if (savePulse > 10) { savePulse = 0; save(); if (focus) renderCareBars(); }
  }
  updateCam(dt);
  R.info.reset(); C.render(dt);
  requestAnimationFrame(frame);
}
let savePulse = 0, ambT = 0;
requestAnimationFrame(frame);
card.classList.add('hidden');
document.addEventListener('pointerdown', () => { if (state === 'loading') wantStart = true; }, { capture: true });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { save(); music(false); } else if (!P.mute && state !== 'loading') music(true); });

(async function boot() {
  const propIds = ['p01', 'p02', 'p03', 'p04', 'p05', 'p06', 'h02', 'h05', 'h06', 'h07', 'h08', 'h09', 'h10', 'h11', 'h12', 'g08', 'g09', 'g16', 'g18', 't01', 't05', 't08', 'f08', 'f09', 'r01', 'r03', 'm12', 'x02', 'x04', 'w10'];
  const charIds = ['k01', 'k02', 'k03', 'k04', ...PETS.filter(p => p.mascot && P.pets[p.id]).map(p => p.id)];
  let done = 0; const tot = propIds.length + charIds.length;
  const prog = () => { done++; const b = document.querySelector('#load i'); if (b) b.style.width = Math.round(done / tot * 100) + '%'; };
  try { await document.fonts.load('800 40px "Baloo 2"'); } catch (e) {}
  const charsP = Promise.all(charIds.map(id => loadChar(id, id === 'k01' ? 1.32 : PI_[id] ? PI_[id].h : 1.26).then(c => { prog(); return c; })));
  await loadProps(propIds, prog);
  cafe = buildCafe(scene);
  // base café props
  const counter = prop('h09', 1.75 * K, 0.0); counter.position.copy(cafe.anchors.counterAt); scene.add(counter);
  const cake = prop('h11', 0.95 * K, -0.2); cake.position.copy(cafe.anchors.caseAt); scene.add(cake);
  const boba = prop('t01', 0.42 * K, 0.3); boba.position.copy(cafe.anchors.bobaAt); scene.add(boba);
  const arch = prop('w10', 2.1 * K, -0.95); arch.position.set(3.55 * K, FY, 1.45 * K); scene.add(arch);
  for (const t of TABLES) if (!t.decor) { const o = prop('h10', 1.6 * K, 0); o.position.set(t.x, FY, t.z); scene.add(o); }
  for (const d of DECOR) if (P.decor.includes(d.id)) placeDecor(d, false);
  tool.wand = prop('x04', 0.5, 0); tool.wand.visible = false; scene.add(tool.wand);
  tool.brush = brush(); tool.brush.scale.setScalar(0.8); tool.brush.visible = false; scene.add(tool.brush);
  // icons for the UI
  for (const id of propIds) ICON[id] = iconOf(MODELS[id].clone(), { yaw: id.startsWith('p') ? -0.4 : -0.3, pad: 0.78 });
  ICON.coin = ICON.x02; ICON.kib = iconOf(kibbleBowl(), { pitch: 0.6, pad: 0.8 });
  const chars = await charsP;
  for (const c of chars) {
    if (['k01', 'k02', 'k03', 'k04'].includes(c.id) || PI_[c.id]) {
      const tmp = c.object; const par = tmp.parent; c.mixer.update(0.3);
      ICON[c.id] = iconOf(tmp, { yaw: 0, pitch: 0.12, pad: 0.72 }); if (par) par.add(tmp); tmp.rotation.y = 0;
    }
  }
  owner = chars.find(c => c.id === 'k01'); owner.object.position.copy(cafe.anchors.owner); scene.add(owner.object);
  makeCustomers(chars.filter(c => ['k02', 'k03', 'k04'].includes(c.id)));
  for (const c of chars) if (PI_[c.id]) charCache[c.id] = c;
  for (const id of PETS.map(p => p.id)) if (P.pets[id]) addPetObj(id);
  $('coinI').src = ICON.coin;
  for (const [b, id] of [['bPets', 'p01'], ['bDecor', 'h06'], ['bAlbum', 'r04' in ICON ? 'r04' : 'm12'], ['bDaily', 't01']]) $(b).querySelector('img').src = ICON[id];
  // shadows: small props don't cast (saves draw calls)
  scene.updateMatrixWorld(true);
  state = 'ready'; layoutCam(); camS.pos.copy(camS.wantPos); camS.tgt.copy(camS.wantTgt);
  hud(); toReady(); showMode();
  $('load').classList.add('gone'); setTimeout(() => $('load').remove(), 600);
  if (wantStart || Q.has('autostart')) startShift(Q.get('daily') === '1'); else splash();
  if (!P.album.p01_met) { P.album.p01_met = Date.now(); save(); }
  P.seen++; save();
  // mascots: load in the background for their icons (and an instant adoption later)
  for (const p of PETS.filter(p => p.mascot && !charCache[p.id])) loadChar(p.id, p.h).then(c => { charCache[p.id] = c; c.mixer.update(0.3); ICON[p.id] = iconOf(c.object, { yaw: 0, pitch: 0.12, pad: 0.72 }); c.object.rotation.y = 0; }).catch(() => {});
})();
