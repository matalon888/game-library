// Hivefall: Alien Horde Shooter. First-person defence of Outpost Kestrel-7 on a dusk desert planet.
import { cine, procTex, THREE } from './kit/cine.js';
import { createUI, store, rng, buzz } from './kit/hc.js';
import { demo } from './kit/demo.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { RoundedBoxGeometry } from './kit/addons/geometries/RoundedBoxGeometry.js';
import { buildSky, buildTerrain, buildOutpost, hiveGeometry, buildDropship, ground, groundNormal, COL, RING, LZ, HIVE_SITES, inGate } from './world.js';
import { Swarm, TYPES } from './bugs.js';
import { Particles, Tracers, Decals, LightPool, Dust, hazePass } from './fx.js';
import { toon, outline, INK } from './style.js';
import { audioInit, S, flameOn, setStorm, setIntensity, setMusic } from './audio.js';

const V3 = THREE.Vector3, NAME = 'Hivefall: Alien Horde Shooter';
const TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const LITE = Math.min(innerWidth, innerHeight) < 560 || TOUCH;
if (TOUCH) document.body.classList.add('touch');
const store_ = store('hivefall');
const F = flow('hivefall', { par: 9000, warmup: 1500 });

// ------------------------------------------------------------------ renderer + scene
const R = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' }); R.info.autoReset = false;
R.setSize(innerWidth, innerHeight); R.domElement.className = 'hc-canvas'; document.body.prepend(R.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 2600); scene.add(camera);
const FOGC = new THREE.Color('#f3cfd2'), STORMC = new THREE.Color('#f0a26e');
scene.fog = new THREE.Fog(FOGC.clone(), 110, 460);
const C = cine(R, scene, camera, { lite: LITE, bloom: 0.32, bloomRadius: 0.45, bloomThreshold: 0.9, exposure: 1.1, envIntensity: 0.5,
  grade: { sat: 1.16, contrast: 1.06, vignette: 0.12, grain: 0 } });
if (C.lite) C.bloom.resolution && C.bloom.resolution.set(innerWidth / 2, innerHeight / 2);
const haze = hazePass(); C.composer.insertPass(haze, 1);
const sunDir = new V3(0.5, 0.42, -1).normalize();
const { sky } = buildSky(scene, sunDir);
const sun = new THREE.DirectionalLight('#fff0d6', 3.1); sun.castShadow = true;
sun.shadow.mapSize.set(LITE ? 1024 : 2048, LITE ? 1024 : 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
Object.assign(sun.shadow.camera, { left: -42, right: 42, top: 42, bottom: -42, near: 1, far: 260 }); scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight('#bcd8ff', '#ff9a7a', 0.95); scene.add(hemi);
const rim = new THREE.DirectionalLight('#b9a8ff', 0.5); rim.position.set(-0.6, 0.5, 0.7); scene.add(rim);
buildTerrain(scene, LITE);
const OP = buildOutpost(scene);
const coreLight = new THREE.PointLight('#53e6ff', 12, 16, 1.6); coreLight.position.set(0, 5, 0); scene.add(coreLight);

// FX
const fxA = new Particles(scene, LITE ? 1800 : 3000, true), fxS = new Particles(scene, LITE ? 1000 : 1600, false);
const tracers = new Tracers(scene, 80), gooDecals = new Decals(scene, 'goo', 150), scorch = new Decals(scene, 'scorch', 60), lights = new LightPool(scene, 4), dust = new Dust(scene, LITE ? 40 : 70);
const flameLight = new THREE.PointLight('#ff8a3a', 0, 16, 1.5); scene.add(flameLight);
const beamLight = new THREE.PointLight('#ff6a5a', 0, 70, 1.2); scene.add(beamLight);

// ------------------------------------------------------------------ helpers
const rand = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
function terrainRay(o, d, max = 180) {
  let prev = 0; for (let t = 0.5; t < max; t += 1.2) { const y = o.y + d.y * t, gy = ground(o.x + d.x * t, o.z + d.z * t); if (y < gy) { let a = prev, b = t; for (let k = 0; k < 6; k++) { const m = (a + b) / 2; if (o.y + d.y * m < ground(o.x + d.x * m, o.z + d.z * m)) b = m; else a = m; } return b; } prev = t; }
  return null;
}
function obstacleRay(o, d, max) {   // spires/rocks/modules as vertical cylinders + boxes, for bullets/rockets
  let best = max;
  for (const c of COL.circles) { const fx = o.x - c.x, fz = o.z - c.z, a = d.x * d.x + d.z * d.z; if (a < 1e-6) continue; const b = fx * d.x + fz * d.z, cc = fx * fx + fz * fz - c.r * c.r; const disc = b * b - a * cc; if (disc < 0) continue; const t = (-b - Math.sqrt(disc)) / a; if (t > 0 && t < best) { const y = o.y + d.y * t; if (y < ground(c.x, c.z) + (c.h || 14)) best = t; } }
  return best < max ? best : null;
}

// ------------------------------------------------------------------ player + input
const PL = { pos: new V3(0, 0, 9), vel: new V3(), yaw: 0, pitch: 0.02, hp: 100, onGround: true, hurtT: 9, stepT: 0, x: 0, y: 0, z: 0, vx: 0, vz: 0, bob: 0, dead: false };
const keys = {}; let mouseDown = false, locked = false;
const IN = { mx: 0, mz: 0, look: [0, 0], fire: false, sprint: false, jump: false };
addEventListener('keydown', e => { keys[e.code] = true; if (state !== 'play') return;
  if (e.code === 'KeyR') reload(); if (e.code === 'Digit1') swap(0); if (e.code === 'Digit2') swap(1); if (e.code === 'Digit3') swap(2);
  if (e.code === 'KeyQ') orbital(); if (e.code === 'KeyE') deployTurret(); if (e.code === 'KeyF') swap((cur + 1) % 3); if (e.code === 'Escape' && !locked) {} });
addEventListener('keyup', e => keys[e.code] = false);
addEventListener('wheel', e => { if (state === 'play') swap((cur + (e.deltaY > 0 ? 1 : 2)) % 3); });
R.domElement.addEventListener('mousedown', e => { if (TOUCH) return; audioInit(); if (state === 'play' && !locked && !navigator.webdriver) lock(); if (e.button === 0) mouseDown = true; });
addEventListener('mouseup', e => { if (e.button === 0) mouseDown = false; });
addEventListener('mousemove', e => { if (locked) { IN.look[0] += e.movementX * 0.0022; IN.look[1] += e.movementY * 0.0022; } });
document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === R.domElement; lockMsg.style.display = !locked && state === 'play' && !TOUCH && wasLocked ? 'block' : 'none'; if (locked) wasLocked = true; });
let wasLocked = false;
function lock() { try { const p = R.domElement.requestPointerLock(); p && p.catch && p.catch(() => {}); } catch (e) {} }

// ------------------------------------------------------------------ UI (kit cards restyled) + HUD
const ui = createUI({ title: 'HIVEFALL', hint: '', hand: '', progress: false, score: false });
const D = daily('hivefall', ui, { name: NAME });
const B = board({ game: 'hivefall', label: 'Mission score', limits: { maxRun: 500000, maxPerSec: 1000 }, corner: 'tr', accent: '#ffb347' });
const el = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
const hud = el(`<div id="hud">
  <div class="obj"><div class="mn" data-mn>MISSION 1</div><div class="ot" data-ot>Hold the uplink</div><div class="bar"><i data-ob></i></div><div class="up" data-upw><span>UPLINK</span><div class="bar"><i data-up></i></div></div></div>
  <div class="compass" data-cmp></div>
  <div class="score"><small data-wv>WAVE 1</small><b data-sc>0</b></div>
  <div class="hp"><div class="lbl"><span>VITALS</span><span data-hpn>100</span></div><div class="bar"><i data-hp style="width:100%"></i></div></div>
  <div class="abil"><div class="ab" data-ab1><span class="k">Q</span><b>☄</b>STRIKE<div class="cd"></div></div><div class="ab" data-ab2><span class="k">E</span><b data-tn>2</b>TURRET<div class="cd"></div></div></div>
  <div class="wpn"><div class="nm" data-wn>AR-9 KESTREL</div><div class="am" data-am>36<small> / 288</small></div></div>
</div>`);
const xh = el(`<div id="xh"><i style="left:-1px;top:-14px;width:2px;height:7px"></i><i style="left:-1px;top:7px;width:2px;height:7px"></i><i style="left:-14px;top:-1px;width:7px;height:2px"></i><i style="left:7px;top:-1px;width:7px;height:2px"></i><i style="left:-1.5px;top:-1.5px;width:3px;height:3px;border-radius:50%"></i><div class="hm"></div></div>`);
const vig = el('<div id="vig"></div>'), dmgEl = el('<div id="dmg"></div>'), banner = el('<div id="banner"><b></b><small></small></div>'), feed = el('<div id="feed"></div>');
const pauseBtn = el('<button id="pause">MENU</button>'), lockMsg = el('<div id="lockmsg">CLICK TO AIM</div>');
document.body.append(hud, xh, vig, dmgEl, banner, feed, pauseBtn, lockMsg);
for (let i = 0; i < 4; i++) dmgEl.append(document.createElement('i'));
const H = q => hud.querySelector(`[data-${q}]`);
xh.style.display = 'none';
pauseBtn.addEventListener('pointerdown', e => { e.stopPropagation(); if (state === 'play') toMenu(); });
const hm = xh.querySelector('.hm'); let hmT = 0;
function hitMark(kill) { hm.classList.toggle('k', !!kill); hm.style.opacity = 1; hmT = kill ? 0.25 : 0.12; S.hit(); }
function say(text, color = '#fff') { const d = document.createElement('div'); d.textContent = text; d.style.color = color; feed.prepend(d); setTimeout(() => d.remove(), 1100); while (feed.children.length > 4) feed.lastChild.remove(); }
let bannerT = 0; function showBanner(big, small = '', t = 2.6) { banner.querySelector('b').textContent = big; banner.querySelector('small').textContent = small; banner.style.opacity = 1; bannerT = t; }

// touch controls
const tc = el(`<div id="tc"><div class="stk"><i></i></div>
  <div class="btn fire" data-b="fire">FIRE</div><div class="btn rl" data-b="reload">RLD</div><div class="btn sw" data-b="swap"><span data-swn>RIFLE</span><b data-swa>36</b></div>
  <div class="btn orb" data-b="orb">☄<br>STRIKE<div class="cd"></div></div><div class="btn tur" data-b="tur">TURRET<br><b data-tn2>2</b><div class="cd"></div></div></div>`);
document.body.append(tc);
const stick = tc.querySelector('.stk'), knob = stick.querySelector('i');
const touches = new Map(); let stickId = null, stickO = null;
function tcDown(e) {
  if (state !== 'play' || e.pointerType === 'mouse') return; audioInit();
  const b = e.target.closest && e.target.closest('[data-b]');
  if (b) { const k = b.dataset.b; b.classList.add('on'); if (k === 'fire') { IN.fire = true; touches.set(e.pointerId, { look: true, x: e.clientX, y: e.clientY, btn: b }); } else { touches.set(e.pointerId, { btn: b });
      if (k === 'reload') reload(); if (k === 'swap') swap((cur + 1) % 3); if (k === 'orb') orbital(); if (k === 'tur') deployTurret(); } e.preventDefault(); return; }
  if (e.clientX < innerWidth * 0.45 && stickId === null) { stickId = e.pointerId; stickO = { x: e.clientX, y: e.clientY }; stick.style.left = (e.clientX - 60) + 'px'; stick.style.bottom = 'auto'; stick.style.top = (e.clientY - 60) + 'px'; }
  else touches.set(e.pointerId, { look: true, x: e.clientX, y: e.clientY });
}
function tcMove(e) {
  if (e.pointerType === 'mouse') return;
  if (e.pointerId === stickId) { const dx = e.clientX - stickO.x, dy = e.clientY - stickO.y, L = Math.min(50, Math.hypot(dx, dy)), a = Math.atan2(dy, dx); knob.style.transform = `translate(${Math.cos(a) * L}px,${Math.sin(a) * L}px)`; IN.mx = Math.cos(a) * L / 50; IN.mz = Math.sin(a) * L / 50; IN.sprint = L > 46 && dy < -30; return; }
  const t = touches.get(e.pointerId); if (t && t.look) { IN.look[0] += (e.clientX - t.x) * 0.0052; IN.look[1] += (e.clientY - t.y) * 0.0052; t.x = e.clientX; t.y = e.clientY; }
}
function tcUp(e) {
  if (e.pointerId === stickId) { stickId = null; IN.mx = IN.mz = 0; IN.sprint = false; knob.style.transform = ''; stick.style.top = ''; stick.style.left = '28px'; stick.style.bottom = ''; }
  const t = touches.get(e.pointerId); if (t) { if (t.btn) { t.btn.classList.remove('on'); if (t.btn.dataset.b === 'fire') IN.fire = false; } touches.delete(e.pointerId); }
}
addEventListener('pointerdown', tcDown, { passive: false }); addEventListener('pointermove', tcMove); addEventListener('pointerup', tcUp); addEventListener('pointercancel', tcUp);

// ------------------------------------------------------------------ weapons + viewmodels
const WPN = [
  { id: 'rifle', name: 'AR-9 KESTREL', short: 'RIFLE', mag: 36, res: 324, ammo: 36, rate: 0.088, dmg: 17, spread: 0.012, reload: 1.55 },
  { id: 'flamer', name: 'EMBER-6 FLAMER', short: 'FLAMER', mag: 100, res: 300, ammo: 100, rate: 0, dmg: 150, spread: 0, reload: 2.0 },
  { id: 'rocket', name: 'RL-2 HAMMER', short: 'ROCKETS', mag: 4, res: 16, ammo: 4, rate: 0.62, dmg: 460, spread: 0, reload: 2.3 },
];
let cur = 0, fireCd = 0, reloadT = 0, swapT = 0, spreadK = 0, recoil = 0, kick = 0;
const vmRoot = new THREE.Group(); camera.add(vmRoot);
const vmMat = {
  dark: toon('#3a4466'), olive: toon('#ff7a2e'), tan: toon('#ffcf2e'), glove: toon('#2a2140'), sleeve: toon('#22c3a6'),
  glow: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.4, 2.8) }), red: new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.5, 0.4) }), orange: toon('#ffcf2e'),
  haz: toon('#ffffff', { map: (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#ffcf2e'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#2a2140'; for (let i = -64; i < 128; i += 22) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 11, 0); x.lineTo(i + 75, 64); x.lineTo(i + 64, 64); x.fill(); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })() }),
};
const ammoCv = document.createElement('canvas'); ammoCv.width = 64; ammoCv.height = 32; const ammoTex = new THREE.CanvasTexture(ammoCv);
function drawAmmo(n) { const x = ammoCv.getContext('2d'); x.fillStyle = '#021014'; x.fillRect(0, 0, 64, 32); x.fillStyle = n < 10 ? '#ff5a3a' : '#5fe8ff'; x.font = 'bold 26px monospace'; x.textAlign = 'center'; x.fillText(String(n).padStart(2, '0'), 32, 25); ammoTex.needsUpdate = true; }
drawAmmo(36);
function mk(geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, parent) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); (parent || this).add(m); return m; }
const rb = (w, h, d, r = 0.008) => new RoundedBoxGeometry(w, h, d, 2, r), cy = (a, b, h, s = 14) => new THREE.CylinderGeometry(a, b, h, s);
function arms(G, gripZ, foreZ, foreY = -0.035) {
  const m = mk.bind(G);
  m(new THREE.CapsuleGeometry(0.035, 0.07, 4, 8), vmMat.glove, 0.0, -0.075, gripZ, 0.4, 0, 0);
  m(new THREE.CapsuleGeometry(0.034, 0.08, 4, 8), vmMat.glove, -0.01, foreY - 0.03, foreZ, 0, 0, 1.2);
}
function buildRifle() {
  const G = new THREE.Group(), m = mk.bind(G);
  m(rb(0.06, 0.075, 0.34), vmMat.dark, 0, 0, 0); m(rb(0.064, 0.03, 0.3), vmMat.olive, 0, 0.05, -0.02);
  m(rb(0.07, 0.07, 0.26), vmMat.olive, 0, -0.005, -0.27); for (let i = 0; i < 5; i++) m(new THREE.BoxGeometry(0.072, 0.012, 0.03), vmMat.dark, 0, 0.012, -0.18 - i * 0.045);
  m(cy(0.012, 0.012, 0.3, 10), vmMat.dark, 0, 0.005, -0.5, Math.PI / 2); m(cy(0.022, 0.022, 0.06, 8), vmMat.dark, 0, 0.005, -0.64, Math.PI / 2);
  for (let i = 0; i < 3; i++) m(new THREE.BoxGeometry(0.046, 0.006, 0.012), vmMat.dark, 0, 0.005, -0.62 - i * 0.015);
  const mag = m(rb(0.038, 0.13, 0.06), vmMat.dark, 0, -0.09, -0.04, 0.25); G.mag = mag;
  m(rb(0.035, 0.11, 0.045), vmMat.dark, 0, -0.08, 0.1, -0.35);
  m(rb(0.045, 0.06, 0.18), vmMat.olive, 0, -0.01, 0.24); m(rb(0.05, 0.09, 0.04), vmMat.dark, 0, -0.025, 0.34);
  m(cy(0.022, 0.022, 0.11, 14), vmMat.dark, 0, 0.09, -0.04, Math.PI / 2); m(new THREE.CircleGeometry(0.016, 14), vmMat.glow, 0, 0.09, 0.0161, 0, 0, 0);
  m(rb(0.02, 0.03, 0.02), vmMat.dark, 0, 0.068, -0.08); m(rb(0.02, 0.03, 0.02), vmMat.dark, 0, 0.068, 0.0);
  m(new THREE.BoxGeometry(0.004, 0.012, 0.2), vmMat.glow, 0.036, 0.02, -0.25);
  const scr = m(new THREE.PlaneGeometry(0.045, 0.022), new THREE.MeshBasicMaterial({ map: ammoTex, toneMapped: false }), 0.0, 0.028, 0.125, -0.5); scr.rotation.x = -0.6;
  m(rb(0.03, 0.08, 0.035), vmMat.dark, 0, -0.06, -0.3, 0.2);
  arms(G, 0.1, -0.3); G.muzzle = new V3(0, 0.005, -0.68); return G;
}
function buildFlamer() {
  const G = new THREE.Group(), m = mk.bind(G);
  m(rb(0.07, 0.08, 0.3), vmMat.dark, 0, 0, 0); m(cy(0.03, 0.035, 0.36, 12), vmMat.dark, 0, 0.01, -0.3, Math.PI / 2);
  for (let i = 0; i < 6; i++) m(new THREE.TorusGeometry(0.04, 0.006, 6, 14), vmMat.olive, 0, 0.01, -0.18 - i * 0.05);
  m(cy(0.045, 0.03, 0.08, 12), vmMat.dark, 0, 0.01, -0.5, Math.PI / 2);
  for (const s of [-1, 1]) { m(cy(0.045, 0.045, 0.26, 16), vmMat.orange, s * 0.05, -0.09, -0.06, Math.PI / 2); m(new THREE.SphereGeometry(0.045, 12, 8), vmMat.orange, s * 0.05, -0.09, -0.19); m(new THREE.SphereGeometry(0.045, 12, 8), vmMat.orange, s * 0.05, -0.09, 0.07); m(cy(0.047, 0.047, 0.03, 16), vmMat.haz, s * 0.05, -0.09, -0.06, Math.PI / 2); }
  const hose = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new V3(0.05, -0.09, 0.08), new V3(0.08, -0.04, 0.12), new V3(0.04, 0.0, 0.05), new V3(0, 0, -0.1)]), 20, 0.008, 6); m(hose, vmMat.glove, 0, 0, 0);
  const pilot = m(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 2.5, 6), toneMapped: false }), 0, -0.035, -0.54); G.pilot = pilot;
  m(rb(0.035, 0.11, 0.045), vmMat.dark, 0, -0.08, 0.1, -0.35); m(rb(0.045, 0.06, 0.12), vmMat.olive, 0, -0.01, 0.2);
  m(new THREE.BoxGeometry(0.004, 0.01, 0.12), vmMat.red, 0.037, 0.02, -0.02);
  arms(G, 0.1, -0.3, -0.06); G.muzzle = new V3(0, 0.01, -0.56); return G;
}
function buildLauncher() {
  const G = new THREE.Group(), m = mk.bind(G);
  m(cy(0.065, 0.065, 0.8, 18), vmMat.olive, 0, 0.02, -0.16, Math.PI / 2); m(cy(0.075, 0.075, 0.06, 18), vmMat.dark, 0, 0.02, -0.56, Math.PI / 2); m(cy(0.08, 0.07, 0.08, 18), vmMat.dark, 0, 0.02, 0.24, Math.PI / 2);
  m(cy(0.076, 0.076, 0.05, 18), vmMat.haz, 0, 0.02, -0.4, Math.PI / 2);
  m(new THREE.ConeGeometry(0.045, 0.1, 12), new THREE.MeshStandardMaterial({ color: '#9e2a1a', metalness: 0.4, roughness: 0.4 }), 0, 0.02, -0.6, -Math.PI / 2); G.tip = G.children[G.children.length - 1];
  m(rb(0.04, 0.08, 0.1), vmMat.dark, -0.07, 0.1, -0.08); m(new THREE.PlaneGeometry(0.03, 0.02), vmMat.glow, -0.07, 0.11, -0.029);
  m(rb(0.035, 0.11, 0.045), vmMat.dark, 0, -0.08, 0.04, -0.3); m(rb(0.035, 0.09, 0.04), vmMat.dark, 0, -0.07, -0.25, 0.2);
  m(new THREE.BoxGeometry(0.004, 0.01, 0.4), vmMat.glow, 0.066, 0.02, -0.16);
  arms(G, 0.04, -0.25, -0.05); G.children.forEach(c => c.position.z -= 0.42); G.muzzle = new V3(0, 0.02, -1.04); return G;
}
const VM = [buildRifle(), buildFlamer(), buildLauncher()];
VM.forEach((g, i) => { g.visible = i === 0; const ms = []; g.traverse(o => { if (o.isMesh) ms.push(o); }); ms.forEach(o => { o.castShadow = false; o.frustumCulled = false; if (o.material.isMeshToonMaterial) { const ol = outline(o, 0.005); ol.frustumCulled = false; } }); vmRoot.add(g); });
const flashTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.translate(64, 64); for (let i = 0; i < 7; i++) { x.rotate(Math.PI * 2 / 7); const g = x.createLinearGradient(0, 0, 60, 0); g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(1, 'rgba(255,140,40,0)'); x.fillStyle = g; x.beginPath(); x.moveTo(0, -7); x.lineTo(62, 0); x.lineTo(0, 7); x.fill(); } const r = x.createRadialGradient(0, 0, 0, 0, 0, 30); r.addColorStop(0, 'rgba(255,255,230,1)'); r.addColorStop(1, 'rgba(255,170,60,0)'); x.fillStyle = r; x.fillRect(-64, -64, 128, 128); return new THREE.CanvasTexture(c); })();
const mflash = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), new THREE.MeshBasicMaterial({ map: flashTex, color: new THREE.Color(3, 2.2, 1.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
const mflash2 = mflash.clone(); mflash2.rotation.y = Math.PI / 2; mflash.add(mflash2); mflash.renderOrder = 11; vmRoot.add(mflash); mflash.visible = false;
function vmBase() { const a = camera.aspect; return a < 0.8 ? new V3(0.11, -0.19, -0.5) : new V3(0.22, -0.2, -0.5); }

function swap(i) { if (i === cur || swapT > 0) return; flameOn(false); cur = i; swapT = 0.4; reloadT = 0; VM.forEach((g, k) => g.visible = k === cur); S.ui(1); drawAmmo(WPN[cur].ammo); }
function reload() { const w = WPN[cur]; if (reloadT > 0 || w.ammo >= w.mag || w.res <= 0) return; reloadT = w.reload; S.reload(); flameOn(false); }
function finishReload() { const w = WPN[cur], n = Math.min(w.mag - w.ammo, w.res); w.ammo += n; w.res -= n; drawAmmo(w.ammo); }

// ------------------------------------------------------------------ game state
let state = 'ready', mission = null, missionIdx = 1, score = 0, runT = 0, kills = 0, uplink = 1000, wave = 0, waveQ = [], waveSpawnT = 0, waveBreak = 0, stormK = 0, stormTarget = 0, seedR = Math.random, recorded = false;
let orbCd = 0, orbital_ = null, turrets = [], turretCharges = 0, hives = [], extract = null, queenSpawned = false, objectiveDone = false, endT = 0, shake = 0, aggro = 1, bossBug = null, lastKillT = 0, multi = 0, beatenShown = false;
const MISSIONS = [
  null,
  { name: 'LANDFALL', type: 'defend', brief: 'Bugs are probing Kestrel-7. Hold the uplink for three waves.', waves: [{ r: 60 }, { r: 90, s: 3 }, { r: 120, s: 5, c: 1 }], turrets: 1 },
  { name: 'SPITTER SEASON', type: 'defend', brief: 'Acid spitters are lobbing from the dunes. Keep moving and hold for four waves.', waves: [{ r: 45, s: 6 }, { r: 60, s: 8 }, { r: 70, s: 10 }, { r: 90, s: 12, c: 1 }], turrets: 2 },
  { name: 'BREAK THE BROOD', type: 'hives', brief: 'Three hives are breeding in the dunes. Push out and burn them to the ground.', hives: [0, 1, 3], turrets: 1 },
  { name: 'DUST WALL', type: 'defend', storm: 1, brief: 'A dust storm is rolling in and the armoured chargers come with it. Hold.', waves: [{ r: 55, c: 2 }, { r: 70, s: 6, c: 3 }, { r: 90, s: 8, c: 4 }], turrets: 2 },
  { name: 'COLD EXTRACTION', type: 'extract', brief: 'Reach the landing zone south of the ridge and hold it until the dropship lands.', turrets: 1 },
  { name: 'SCORCHED EARTH', type: 'hives', storm: 0.55, brief: 'Five hives, one storm. Rockets crack them fastest.', hives: [2, 4, 5, 0, 1], turrets: 2 },
  { name: 'THE TUNNEL QUEEN', type: 'boss', brief: 'Something huge is tunnelling under the outpost. Watch the dust. Kill the queen.', turrets: 2 },
];
const LAST = { name: 'LAST STAND', type: 'endless', brief: 'Endless waves. How long can Kestrel-7 hold? Every wave hits harder.', turrets: 1 };
let unlocked = store_.get('unlocked', 1), bests = store_.get('bests', {});

// ------------------------------------------------------------------ objective visuals: hive mounds, beacon beams
const hiveGeo = hiveGeometry();
const hiveMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.3 });
const hiveU = { t: { value: 0 } };
hiveMat.onBeforeCompile = sh => { sh.uniforms.uT = hiveU.t; sh.vertexShader = 'attribute float aGlow; varying float vG; uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vG = aGlow; transformed *= 1. + sin(uT * 2.2 + position.y * .6) * .025;');
  sh.fragmentShader = 'varying float vG; uniform float uT;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vec3(.45, 1., .3) * vG * (2.2 + 1.4 * sin(uT * 3.)) ;'); };
const beamMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uC: { value: new THREE.Color(1, 0.6, 0.2) }, uT: hiveU.t },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: 'uniform vec3 uC; uniform float uT; varying vec2 vUv; void main(){ float a = (1. - vUv.y) * (.55 + .45 * sin(vUv.y * 40. - uT * 6.)) * smoothstep(0., .5, 1. - abs(vUv.x - .5) * 2.); gl_FragColor = vec4(uC * a * 1.6, a); }', side: THREE.DoubleSide });
function beaconBeam(x, z, color, h = 60) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, h, 10, 1, true), beamMat.clone()); m.material.uniforms.uC.value = new THREE.Color(color); m.material.uniforms.uT = hiveU.t; m.position.set(x, ground(x, z) + h / 2, z); m.renderOrder = 6; scene.add(m); return m; }
const dropship = buildDropship(); dropship.visible = false; scene.add(dropship);
const warnRings = [];
function warnRing(p, r, t) { const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.85, r, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1, 0.4), transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(p.x, ground(p.x, p.z) + 0.3, p.z); scene.add(m); warnRings.push({ m, t, max: t }); }

// turret model
function buildTurret() {
  const G = new THREE.Group(), m = mk.bind(G);
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; m(new THREE.CylinderGeometry(0.04, 0.05, 1.1, 6), vmMat.dark, Math.cos(a) * 0.35, 0.4, Math.sin(a) * 0.35, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); }
  m(new THREE.CylinderGeometry(0.22, 0.28, 0.25, 10), vmMat.olive, 0, 0.85, 0);
  const head = new THREE.Group(); head.position.y = 1.05; G.add(head); const h = mk.bind(head);
  h(new RoundedBoxGeometry(0.5, 0.32, 0.6, 2, 0.04), vmMat.olive, 0, 0, 0); h(new THREE.BoxGeometry(0.52, 0.04, 0.4), vmMat.haz, 0, 0.17, 0.05);
  for (const s of [-1, 1]) { h(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 8), vmMat.dark, s * 0.11, -0.02, -0.55, Math.PI / 2); h(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 8), vmMat.dark, s * 0.11, -0.02, -0.88, Math.PI / 2); }
  h(new THREE.SphereGeometry(0.06, 10, 8), vmMat.red, 0, 0.08, -0.31); h(new THREE.BoxGeometry(0.3, 0.2, 0.25), vmMat.dark, 0, -0.05, 0.35);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), mflash.material); fl.position.set(0, -0.02, -1.0); fl.visible = false; head.add(fl);
  G.head = head; G.fl = fl; const ms = []; G.traverse(o => { if (o.isMesh) ms.push(o); }); ms.forEach(o => { o.castShadow = true; if (o.material.isMeshToonMaterial) outline(o, 0.025); }); return G;
}
function deployTurret() {
  if (state !== 'play' || turretCharges <= 0 || turrets.length >= 3) return;
  const f = new V3(-Math.sin(PL.yaw), 0, -Math.cos(PL.yaw)); const p = PL.pos.clone().addScaledVector(f, 2.6); p.y = ground(p.x, p.z);
  const T = buildTurret(); T.position.copy(p); T.scale.setScalar(0.01); scene.add(T); turrets.push({ g: T, p: p.clone().setY(p.y + 1.05), cd: 0, ammo: 450, t: 0, yaw: PL.yaw });
  turretCharges--; S.deploy(); say('SENTRY DEPLOYED', '#ffcf9a'); fxS.spawn(p.x, p.y + 0.2, p.z, 0, 1, 0, { life: 1, size: 2.5, color: [0.5, 0.35, 0.25], alpha: 0.5, grow: 2 });
}

// ------------------------------------------------------------------ effects services used by the swarm
const GOO = { runner: [0.55, 1.35, 0.15], spitter: [1.45, 0.35, 1.2], charger: [1.5, 1.05, 0.15], queen: [1.1, 0.4, 1.5], hive: [1.2, 0.45, 1.3] };
const gooC = (t, k = 1) => (GOO[t] || GOO.runner).map(v => Math.min(1, v * k));
const G = {
  dirt(p, r = 1) { for (let i = 0; i < 10 + r * 4; i++) { const a = Math.random() * 6.28, s = rand(1, 4) * Math.sqrt(r); fxS.spawn(p.x + Math.cos(a) * r * 0.5, p.y + 0.2, p.z + Math.sin(a) * r * 0.5, Math.cos(a) * s, rand(3, 7) * Math.sqrt(r), Math.sin(a) * s, { life: rand(0.8, 1.6), size: rand(0.5, 1.4) * Math.sqrt(r), color: [0.95, 0.68, 0.52], alpha: 0.9, grav: 12, drag: 1.2, grow: 0.8 }); }
    for (let i = 0; i < 4; i++) fxS.spawn(p.x + rand(-r, r), p.y + 0.5, p.z + rand(-r, r), rand(-1, 1), rand(0.5, 1.5), rand(-1, 1), { life: 2.2, size: 2.5 * r + 1, color: [1, 0.8, 0.66], alpha: 0.55, grow: 1.5, drag: 0.5 }); },
  gooBurst(p, r, kind, type = 'runner') { const gc = GOO[type] || GOO.runner;
    const n = Math.round(14 + r * 10) * (LITE ? 0.6 : 1);
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = rand(2, 7) * Math.sqrt(r); fxA.spawn(p.x, p.y, p.z, Math.cos(a) * s, rand(2, 8), Math.sin(a) * s, { life: rand(0.5, 1.1), size: rand(0.14, 0.4) * Math.sqrt(r), color: gc, grav: 16, drag: 0.6 }); }
    for (let i = 0; i < n * 0.5; i++) { const a = Math.random() * 6.28, s = rand(2, 6); fxS.spawn(p.x, p.y, p.z, Math.cos(a) * s, rand(3, 8), Math.sin(a) * s, { life: rand(0.7, 1.3), size: rand(0.08, 0.2) * Math.sqrt(r), color: gooC(type, 0.75), alpha: 1, grav: 20, soft: 0 }); }
    fxS.spawn(p.x, p.y, p.z, 0, 1, 0, { life: 0.7, size: r * 2.4, color: gooC(type, 0.9), alpha: 0.6, grow: r * 3 });
    for (let i = 0; i < 6; i++) fxA.spawn(p.x, p.y, p.z, rand(-3, 3), rand(1, 5), rand(-3, 3), { life: 0.5, size: 0.12, color: [2, 2, 1.6], grav: 4 });
    gooDecals.add(p.x, ground(p.x, p.z), p.z, r * rand(2.2, 3.2), groundNormal(p.x, p.z), gooC(type)); S.goo();
  },
  onKill(b) {
    kills++; const pts = b.T.score; addScore(pts); hitMark(true);
    const now = runT; multi = now - lastKillT < 0.7 ? multi + 1 : 1; lastKillT = now;
    if (multi === 3) say('TRIPLE KILL  +150', '#ffcf9a'), addScore(150); else if (multi === 6) say('MASSACRE  +500', '#ff9a5a'), addScore(500); else if (multi === 10) say('EXTERMINATOR  +1200', '#ff6a3a'), addScore(1200);
    if (b.type !== 'runner') say(`${b.type.toUpperCase()} DOWN  +${pts}`, b.type === 'queen' ? '#9dff6a' : '#fff');
    if (b.type === 'queen') { S.roar(); shake = 1; showBanner('QUEEN SLAIN', 'THE BROOD IS BROKEN', 3); }
    S.kill();
  },
};
const ctx = {
  player: PL,
  hurtPlayer(d, b, knock = 0) { hurt(d, new V3(b.x, 0, b.z), knock); },
  hurtUplink(d) { if (!mission || (mission.type !== 'defend' && mission.type !== 'endless' && mission.type !== 'boss')) return; uplink = Math.max(0, uplink - d); upHitT = 0.3; },
  sfx(n, d) { S[n] && S[n](d); },
  slam(b) { G.dirt(new V3(b.x, b.y, b.z), 1.5); shake = Math.max(shake, 0.3 * Math.max(0, 1 - Math.hypot(b.x - PL.x, b.z - PL.z) / 30)); S.boom(0.3, Math.hypot(b.x - PL.x, b.z - PL.z)); },
  trail(p) { if (Math.random() < 0.6) fxA.spawn(p.x, p.y, p.z, rand(-.3, .3), rand(-.3, .3), rand(-.3, .3), { life: 0.35, size: 0.45, color: GOO.spitter, drag: 2 }); },
  splash(p, dP) { for (let i = 0; i < 14; i++) { const a = Math.random() * 6.28, s = rand(1, 5); fxA.spawn(p.x, p.y + 0.2, p.z, Math.cos(a) * s, rand(1, 5), Math.sin(a) * s, { life: rand(0.4, 0.9), size: rand(0.15, 0.4), color: GOO.spitter, grav: 12 }); }
    fxS.spawn(p.x, p.y + 0.5, p.z, 0, 0.6, 0, { life: 1.2, size: 3, color: [1, 0.5, 0.9], alpha: 0.5, grow: 2 });
    gooDecals.add(p.x, ground(p.x, p.z), p.z, 2.6, groundNormal(p.x, p.z), gooC('spitter')); if (dP < 2.8) hurt(12 * (1 - dP / 3.2) + 4, p, 0); S.goo(); },
  quake(p, r, d) { G.dirt(p, r * 0.6); explosionFx(p, r * 0.4, false); const dd = Math.hypot(p.x - PL.x, p.z - PL.z); shake = Math.max(shake, Math.max(0, 1 - dd / 40)); if (dd < r) hurt(d * (1 - dd / r * 0.5), p, 12); S.boom(1.2, dd); },
  dirt: (p, r) => G.dirt(p, r), plume(p) { fxS.spawn(p.x + rand(-1.5, 1.5), p.y + 0.3, p.z + rand(-1.5, 1.5), rand(-1, 1), rand(3, 6), rand(-1, 1), { life: 1.6, size: rand(1.5, 3), color: [0.98, 0.72, 0.56], alpha: 0.8, grav: 3, grow: 2, drag: 0.8 }); if (Math.random() < 0.3) shake = Math.max(shake, 0.15); },
  warnRing, aggro: 1,
};
const swarm = new Swarm(scene, G);
let upHitT = 0;

// ------------------------------------------------------------------ damage, scoring
function hurt(d, from, knock) {
  if (state !== 'play' || PL.dead) return;
  PL.hp -= d; PL.hurtT = 0; vigA = Math.min(1, vigA + d / 30); shake = Math.max(shake, Math.min(0.6, d / 40)); S.hurt(); buzz(30);
  const a = Math.atan2(from.x - PL.pos.x, from.z - PL.pos.z), rel = a - Math.atan2(-Math.sin(PL.yaw), -Math.cos(PL.yaw));
  const ind = dmgEl.children[dmgI++ % 4]; ind.style.transform = `rotate(${-rel}rad)`; ind.style.transition = 'none'; ind.style.opacity = 1; requestAnimationFrame(() => { ind.style.transition = 'opacity .9s'; ind.style.opacity = 0; });
  if (knock) { const dx = PL.pos.x - from.x, dz = PL.pos.z - from.z, L = Math.hypot(dx, dz) || 1; PL.vel.x += dx / L * knock; PL.vel.z += dz / L * knock; PL.vel.y = 4; PL.onGround = false; }
  if (PL.hp <= 0) { PL.hp = 0; PL.dead = true; end(false, 'YOU WERE OVERRUN'); }
}
let dmgI = 0, vigA = 0;
function addScore(n) { score += n; if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#9dff6a', 40, 24); } }

// ------------------------------------------------------------------ firing
const _d = new V3(), _o = new V3(), _q = new THREE.Quaternion();
function camDir(out = new V3()) { return out.set(0, 0, -1).applyQuaternion(camera.quaternion); }
function muzzleWorld() { const w = VM[cur]; return w.localToWorld(w.muzzle.clone()); }
function shoot(dt) {
  const w = WPN[cur]; fireCd -= dt;
  const wantFire = (IN.fire || mouseDown || botFire) && state === 'play' && swapT <= 0;
  if (cur === 1) { // flamethrower
    const firing = wantFire && reloadT <= 0 && w.ammo > 0;
    flameOn(firing); haze.uniforms.uHaze.value = lerp(haze.uniforms.uHaze.value, firing ? 1 : 0, dt * 6);
    flameLight.intensity = firing ? rand(14, 26) : 0;
    VM[1].pilot.scale.setScalar(firing ? 1.6 : 0.8 + Math.sin(runT * 30) * 0.2);
    if (!firing) { if (wantFire && w.ammo <= 0 && reloadT <= 0) reload(); return; }
    w.ammo = Math.max(0, w.ammo - dt * 16); if (Math.floor(w.ammo) % 5 === 0) drawAmmo(Math.floor(w.ammo));
    const mz = muzzleWorld(), dir = camDir(_d); flameLight.position.copy(mz).addScaledVector(dir, 2);
    const n = LITE ? 5 : 9;
    for (let i = 0; i < n; i++) { const s = rand(15, 21), sp = 0.08; const vx = dir.x * s + rand(-sp, sp) * s + PL.vel.x, vy = dir.y * s + rand(-sp, sp) * s + 0.6, vz = dir.z * s + rand(-sp, sp) * s + PL.vel.z;
      const t = Math.random(); if (i % 3 === 0) fxA.spawn(mz.x, mz.y, mz.z, vx, vy, vz, { life: rand(0.2, 0.35), size: rand(0.2, 0.35), grow: 3, color: [1.4, 1.0, 0.4], drag: 2.2, soft: 1 });
      fxS.spawn(mz.x, mz.y, mz.z, vx, vy, vz, { life: rand(0.35, 0.6), size: rand(0.2, 0.4), grow: rand(4, 6.5), color: t < 0.35 ? [1, 0.93, 0.5] : t < 0.8 ? [1, 0.62, 0.2] : [1, 0.38, 0.32], alpha: 1, drag: 2.2, grav: -2 }); }
    if (Math.random() < 0.5) fxS.spawn(mz.x + dir.x * 8, mz.y + dir.y * 8 + 1, mz.z + dir.z * 8, dir.x * 3, 2.5, dir.z * 3, { life: 1.4, size: 2.2, grow: 2.5, color: [0.85, 0.8, 0.82], alpha: 0.5, drag: 0.6 });
    // damage cone
    const o = camera.getWorldPosition(_o);
    swarm.forRadius(o.x, o.z, 11, (b, d) => { const vx = b.x - o.x, vy = b.y + b.T.cy - o.y, vz = b.z - o.z, L = Math.hypot(vx, vy, vz) || 1; const cos = (vx * dir.x + vy * dir.y + vz * dir.z) / L; if (cos > 0.93 - Math.min(0.15, b.T.r / L)) { const k = swarm.damage(b, w.dmg * dt * (1.2 - d / 14), 'flame', o); b.burn = 2.2; if (k === true) hitMark(true); else if (Math.random() < 0.1) hitMark(false); } });
    for (const h of hives) if (h.alive && h.p.distanceTo(o) < 13) { const v = h.p.clone().sub(o).normalize(); if (v.dot(dir) > 0.85) damageHive(h, w.dmg * dt * 1.3); }
    if (Math.random() < dt * 3) { const t = terrainRay(o, dir, 10); if (t) scorch.add(o.x + dir.x * t, ground(o.x + dir.x * t, o.z + dir.z * t), o.z + dir.z * t, rand(1.2, 2.2), groundNormal(o.x + dir.x * t, o.z + dir.z * t)); }
    kick = Math.min(1, kick + dt * 0.5);
    return;
  }
  haze.uniforms.uHaze.value = lerp(haze.uniforms.uHaze.value, 0, dt * 6); flameLight.intensity = 0;
  if (!wantFire || reloadT > 0 || fireCd > 0) return;
  if (w.ammo <= 0) { if (w.res > 0) reload(); else if (fireCd <= 0) { S.empty(); fireCd = 0.3; } return; }
  fireCd = w.rate; w.ammo--; drawAmmo(w.ammo);
  const o = camera.getWorldPosition(_o).clone(), mz = muzzleWorld();
  if (TOUCH || botOn()) aimAssist(0.08);
  if (cur === 0) {
    const sp = w.spread + spreadK * 0.045; const dir = camDir(new V3()); dir.x += rand(-sp, sp); dir.y += rand(-sp, sp); dir.z += rand(-sp, sp); dir.normalize();
    hitscan(o, dir, mz, w.dmg);
    spreadK = Math.min(1, spreadK + 0.11); recoil += 0.012 + Math.random() * 0.004; kick = 1; IN.look[0] += rand(-0.004, 0.004);
    S.rifle(); if (Math.random() < 0.5) S.casing();
    lights.flash(mz.clone().addScaledVector(camDir(new V3()), 1.5), '#ffd090', 5, 0.05, 10); mflash.visible = true; mflash.rotation.z = Math.random() * 6; mflash.scale.setScalar(rand(0.8, 1.25)); mflashT = 0.04;
    // shell casing
    const right = new V3(1, 0, 0).applyQuaternion(camera.quaternion); fxA.spawn(mz.x - right.x * 0.0, mz.y, mz.z, right.x * 3 + rand(-0.5, 0.5), rand(2, 3.5), right.z * 3, { life: 0.45, size: 0.04, color: [1.6, 1.1, 0.4], grav: 14 });
  } else if (cur === 2) {
    const dir = camDir(new V3()); fireRocket(mz, dir); recoil += 0.06; kick = 1.6; shake = Math.max(shake, 0.25); S.rocket(); lights.flash(mz, '#ffa050', 30, 0.12, 14);
    VM[2].tip.visible = w.ammo > 0;
    for (let i = 0; i < 10; i++) fxS.spawn(mz.x, mz.y, mz.z, -dir.x * rand(2, 6) + rand(-1, 1), rand(0, 1.5), -dir.z * rand(2, 6) + rand(-1, 1), { life: 1.2, size: 0.8, grow: 2, color: [0.4, 0.38, 0.36], alpha: 0.5, drag: 1.5 });
  }
}
let mflashT = 0;
function hitscan(o, dir, mz, dmg) {
  const tT = terrainRay(o, dir, 200), tO = obstacleRay(o, dir, tT || 200); let maxD = Math.min(tT || 200, tO || 200);
  const hit = swarm.raycast(o, dir, maxD); let hiveHit = null;
  for (const h of hives) if (h.alive) { const c = h.p.clone().sub(o), t = c.dot(dir); if (t > 0 && t < (hit ? hit.dist : maxD)) { const d2 = c.lengthSq() - t * t; if (d2 < 4.6 * 4.6) { hiveHit = { h, dist: t - Math.sqrt(4.6 * 4.6 - d2) }; } } }
  let end;
  if (hiveHit && (!hit || hiveHit.dist < hit.dist)) { end = o.clone().addScaledVector(dir, hiveHit.dist); damageHive(hiveHit.h, dmg); hitMark(false); gooSpray(end, dir, 6, 'hive'); }
  else if (hit) { end = hit.point; const k = swarm.damage(hit.bug, dmg, 'bullet', o);
    if (k === 'armor') { sparks(end, dir, 8); } else { gooSpray(end, dir, k === true ? 4 : 7, hit.bug.type); if (k !== true) hitMark(false); } }
  else { end = o.clone().addScaledVector(dir, maxD); if (tT || tO) { const n = groundNormal(end.x, end.z); for (let i = 0; i < 5; i++) fxS.spawn(end.x, end.y + 0.1, end.z, n.x * 2 + rand(-1, 1), rand(1, 3), n.z * 2 + rand(-1, 1), { life: 0.9, size: 0.5, grow: 1.4, color: [1, 0.78, 0.62], alpha: 0.7, grav: 2, drag: 1 }); sparks(end, dir, 3); } }
  tracers.add(mz, end, 0.022, 0.07);
}
function gooSpray(p, dir, n, type = 'runner') { const c = GOO[type] || GOO.runner; for (let i = 0; i < n; i++) fxA.spawn(p.x, p.y, p.z, -dir.x * rand(1, 4) + rand(-2, 2), rand(0.5, 4), -dir.z * rand(1, 4) + rand(-2, 2), { life: rand(0.3, 0.7), size: rand(0.1, 0.26), color: c, grav: 14 }); fxA.spawn(p.x, p.y, p.z, 0, 0, 0, { life: 0.1, size: 0.7, color: [0.9, 0.9, 0.85], grow: 5 }); }
function sparks(p, dir, n) { for (let i = 0; i < n; i++) fxA.spawn(p.x, p.y, p.z, -dir.x * rand(2, 8) + rand(-3, 3), rand(0, 5), -dir.z * rand(2, 8) + rand(-3, 3), { life: rand(0.15, 0.4), size: rand(0.04, 0.09), color: [2, 1.6, 0.7], grav: 16 }); }
function aimAssist(k) {
  const o = camera.getWorldPosition(_o), dir = camDir(_d); let best = null, bc = Math.cos(0.16);
  for (const b of swarm.all) { if (b.dead || b.state === 'tunnel') continue; const v = new V3(b.x - o.x, b.y + b.T.cy - o.y, b.z - o.z), L = v.length(); if (L > 70) continue; const c = v.dot(dir) / L; if (c > bc) { bc = c; best = v.divideScalar(L); } }
  if (best) { const ty = Math.atan2(-best.x, -best.z), tp = Math.asin(clamp(best.y, -1, 1)); PL.yaw += Math.atan2(Math.sin(ty - PL.yaw), Math.cos(ty - PL.yaw)) * k * 4; PL.pitch += (tp - PL.pitch) * k * 4; }
}

// rockets
const rockets = [];
const rocketGeo = (() => { const g = new THREE.CylinderGeometry(0.07, 0.07, 0.6, 10); g.rotateX(Math.PI / 2); return g; })();
const rocketMat = new THREE.MeshStandardMaterial({ color: '#4a4f45', metalness: 0.6, roughness: 0.4, emissive: '#ff8a3a', emissiveIntensity: 0.4 });
function fireRocket(p, dir) { const m = new THREE.Mesh(rocketGeo, rocketMat); m.position.copy(p); m.lookAt(p.clone().add(dir)); scene.add(m); rockets.push({ m, p: p.clone(), v: dir.clone().multiplyScalar(58), t: 0 }); }
function updateRockets(dt) {
  for (let i = rockets.length - 1; i >= 0; i--) { const r = rockets[i]; r.t += dt; const step = r.v.length() * dt, dir = r.v.clone().normalize();
    const hit = swarm.raycast(r.p, dir, step); let boom = null;
    if (hit) boom = hit.point; else { for (const h of hives) if (h.alive && r.p.distanceTo(h.p) < 5) boom = r.p.clone(); const gy = ground(r.p.x, r.p.z); if (r.p.y < gy + 0.1) boom = r.p.clone().setY(gy + 0.3); if (!boom) { const ob = obstacleRay(r.p, dir, step); if (ob) boom = r.p.clone().addScaledVector(dir, ob); } }
    if (boom || r.t > 3) { explode(boom || r.p, 6.5, WPN[2].dmg); scene.remove(r.m); rockets.splice(i, 1); continue; }
    r.p.addScaledVector(r.v, dt); r.m.position.copy(r.p);
    fxA.spawn(r.p.x, r.p.y, r.p.z, rand(-0.5, 0.5), rand(-0.5, 0.5), rand(-0.5, 0.5), { life: 0.18, size: 0.5, color: [1.5, 0.9, 0.35], drag: 3 });
    fxS.spawn(r.p.x, r.p.y, r.p.z, rand(-0.4, 0.4), rand(0.2, 0.8), rand(-0.4, 0.4), { life: 1.6, size: 0.5, grow: 1.6, color: [0.95, 0.93, 0.92], alpha: 0.7, drag: 0.8 }); }
}
function explosionFx(p, r, decal = true) {
  const n = LITE ? 30 : 55;
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, e = Math.random() * 1.4, s = rand(3, 11) * r / 4; fxS.spawn(p.x, p.y + 0.3, p.z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + 2, Math.sin(a) * Math.cos(e) * s, { life: rand(0.35, 0.75), size: rand(0.8, 1.6) * r / 4, grow: r * 1.3, color: Math.random() < 0.45 ? [1, 0.92, 0.45] : Math.random() < 0.5 ? [1, 0.6, 0.18] : [1, 0.38, 0.3], alpha: 1, drag: 3.2, grav: -3, soft: 0 }); }
  for (let i = 0; i < 6; i++) fxA.spawn(p.x, p.y + 1, p.z, rand(-2, 2), rand(1, 4), rand(-2, 2), { life: 0.25, size: r * 0.6, grow: r * 2, color: [0.9, 0.6, 0.25] });
  for (let i = 0; i < n * 0.6; i++) { const a = Math.random() * 6.28, s = rand(1, 4) * r / 4; fxS.spawn(p.x + rand(-1, 1), p.y + rand(0, 2), p.z + rand(-1, 1), Math.cos(a) * s, rand(1, 5), Math.sin(a) * s, { life: rand(1.0, 2.0), size: rand(1.2, 2.2) * r / 4, grow: r * 0.35, color: [0.92, 0.88, 0.9], alpha: 0.6, drag: 1.2, grav: -0.8 }); }
  for (let i = 0; i < 24; i++) { const a = Math.random() * 6.28, s = rand(5, 16); fxA.spawn(p.x, p.y + 0.4, p.z, Math.cos(a) * s, rand(4, 14), Math.sin(a) * s, { life: rand(0.5, 1.4), size: 0.09, color: [2, 1.5, 0.6], grav: 20 }); }
  for (let i = 0; i < 12; i++) { const a = Math.random() * 6.28, s = rand(3, 9); fxS.spawn(p.x, p.y + 0.4, p.z, Math.cos(a) * s, rand(6, 12), Math.sin(a) * s, { life: rand(1, 1.8), size: rand(0.15, 0.35), color: [0.55, 0.35, 0.5], alpha: 1, grav: 22 }); }
  lights.flash(p.clone().setY(p.y + 2), '#ffb070', 60 * r / 5, 0.45, 26);
  if (decal) scorch.add(p.x, ground(p.x, p.z), p.z, r * 1.5, groundNormal(p.x, p.z));
}
function explode(p, r, dmg) {
  explosionFx(p, r); const d = p.distanceTo(PL.pos); shake = Math.max(shake, Math.max(0, 0.9 - d / 45)); S.boom(1, d);
  let k = 0; swarm.forRadius(p.x, p.z, r, (b, dd) => { if (Math.abs(b.y - p.y) > r + 2) return; if (swarm.damage(b, dmg * (1 - dd / (r + b.T.r) * 0.55), 'blast', p) === true) k++; b.burn = 1.2; });
  for (const h of hives) if (h.alive && h.p.distanceTo(p) < r + 5) damageHive(h, dmg * 1.15);
  if (k) hitMark(true);
}

// orbital strike: beacon → beam from the sky
const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true); beamGeo.translate(0, 0.5, 0);
const orbMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uA: { value: 0 } },
  vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
  fragmentShader: 'uniform float uT, uA; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(abs(dot(vN, vV)), 2.); float s = .7 + .3 * sin(vUv.y * 160. - uT * 60.) * sin(vUv.x * 30. + uT * 20.); vec3 c = mix(vec3(1.6, .5, 1.2), vec3(2., 1.9, 1.7), f) * s; gl_FragColor = vec4(c * uA * (.35 + f), uA * (.3 + f)); }' });
const orbBeam = new THREE.Mesh(beamGeo, orbMat), orbCore = new THREE.Mesh(beamGeo, orbMat); orbBeam.visible = orbCore.visible = false; orbBeam.renderOrder = orbCore.renderOrder = 7; scene.add(orbBeam, orbCore);
const beaconM = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 120, 6, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.6, 0.4), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); beaconM.visible = false; scene.add(beaconM);
function orbital(target) {
  if (state !== 'play' || orbCd > 0 || orbital_) return;
  const o = camera.getWorldPosition(new V3()), dir = camDir(new V3()); let p;
  if (target) p = target.clone(); else { const t = terrainRay(o, dir, 90); p = t ? o.clone().addScaledVector(dir, t) : o.clone().addScaledVector(new V3(dir.x, 0, dir.z).normalize(), 35); }
  if (Math.hypot(p.x - PL.pos.x, p.z - PL.pos.z) < 9) { const f = new V3(dir.x, 0, dir.z).normalize(); p = PL.pos.clone().addScaledVector(f, 14); }
  p.y = ground(p.x, p.z); orbital_ = { p, t: 0 }; orbCd = 40; S.beacon(); say('ORBITAL STRIKE INBOUND', '#ff8a6a');
  beaconM.position.set(p.x, p.y + 60, p.z); beaconM.visible = true;
}
function updateOrbital(dt) {
  orbCd = Math.max(0, orbCd - dt); orbMat.uniforms.uT.value += dt;
  if (!orbital_) { beamLight.intensity = 0; return; }
  const o = orbital_, p = o.p; o.t += dt;
  beaconM.material.opacity = 0.4 + 0.4 * Math.sin(o.t * 20);
  if (o.t < 2.2) { if (Math.random() < 0.3) fxA.spawn(p.x, p.y + 0.3, p.z, rand(-1, 1), rand(1, 3), rand(-1, 1), { life: 0.4, size: 0.3, color: [2, 0.4, 0.3] }); return; }
  if (!o.fired) { o.fired = true; S.beam(); beaconM.visible = false; shake = 1; ui.flash(0.35); }
  const k = o.t - 2.2, A = k < 0.15 ? k / 0.15 : k > 2.0 ? Math.max(0, 1 - (k - 2.0) / 0.4) : 1;
  orbBeam.visible = orbCore.visible = true; orbMat.uniforms.uA.value = A;
  const rr = 3 + Math.sin(k * 30) * 0.3 + k * 1.2; orbBeam.scale.set(rr, 600, rr); orbBeam.position.set(p.x, p.y - 2, p.z); orbCore.scale.set(rr * 0.45, 600, rr * 0.45); orbCore.position.copy(orbBeam.position);
  beamLight.position.set(p.x, p.y + 6, p.z); beamLight.intensity = 120 * A;
  shake = Math.max(shake, 0.35 * A);
  if (k < 2.0) {
    for (let i = 0; i < (LITE ? 6 : 12); i++) { const a = Math.random() * 6.28, s = rand(4, 16); fxS.spawn(p.x + Math.cos(a) * rr, p.y + 0.5, p.z + Math.sin(a) * rr, Math.cos(a) * s, rand(2, 12), Math.sin(a) * s, { life: rand(0.4, 1), size: rand(0.5, 1.3), grow: 3, color: Math.random() < 0.5 ? [1, 0.6, 0.95] : [1, 0.92, 0.5], alpha: 1, drag: 2.5 }); }
    if (Math.random() < 0.5) fxS.spawn(p.x + rand(-6, 6), p.y + 1, p.z + rand(-6, 6), rand(-4, 4), rand(2, 6), rand(-4, 4), { life: 3, size: 4, grow: 4, color: [0.95, 0.9, 0.88], alpha: 0.7, drag: 0.6 });
    swarm.forRadius(p.x, p.z, 10, (b) => { if (swarm.damage(b, 1100 * dt, 'blast', p) === true) hitMark(true); b.burn = 2; });
    for (const h of hives) if (h.alive && Math.hypot(h.p.x - p.x, h.p.z - p.z) < 12) damageHive(h, 1300 * dt);
    if (Math.hypot(PL.pos.x - p.x, PL.pos.z - p.z) < 6) hurt(40 * dt, p, 0);
  }
  if (k > 2.4) { orbBeam.visible = orbCore.visible = false; scorch.add(p.x, p.y, p.z, 16, groundNormal(p.x, p.z)); orbital_ = null; }
}

function updateTurrets(dt) {
  for (let i = turrets.length - 1; i >= 0; i--) { const T = turrets[i]; T.t += dt; T.g.scale.setScalar(Math.min(1, T.t * 3)); T.cd -= dt; T.g.fl.visible = false;
    const tgt = swarm.nearest(T.p.x, T.p.z, b => Math.hypot(b.x - T.p.x, b.z - T.p.z) < 34);
    if (tgt) { const ty = Math.atan2(-(tgt.x - T.p.x), -(tgt.z - T.p.z)); T.yaw += Math.atan2(Math.sin(ty - T.yaw), Math.cos(ty - T.yaw)) * Math.min(1, dt * 10); T.g.head.rotation.y = T.yaw;
      if (T.cd <= 0 && T.t > 0.6 && Math.abs(Math.atan2(Math.sin(ty - T.yaw), Math.cos(ty - T.yaw))) < 0.2) { T.cd = 0.1; T.ammo--; T.g.fl.visible = true; T.g.fl.rotation.z = Math.random() * 6;
        const to = new V3(tgt.x + rand(-0.3, 0.3), tgt.y + tgt.T.cy + rand(-0.3, 0.3), tgt.z + rand(-0.3, 0.3)), from = T.g.head.localToWorld(new V3((T.ammo % 2 ? 1 : -1) * 0.11, -0.02, -0.95));
        tracers.add(from, to, 0.04, 0.06); const k = swarm.damage(tgt, 13, 'bullet', from); if (k !== 'armor') gooSpray(to, to.clone().sub(from).normalize(), 3, tgt.type); else sparks(to, to.clone().sub(from).normalize(), 4);
        if (Math.hypot(T.p.x - PL.pos.x, T.p.z - PL.pos.z) < 40 && Math.random() < 0.5) S.turret(); } }
    if (T.ammo <= 0) { explosionFx(T.p, 2); scene.remove(T.g); turrets.splice(i, 1); say('SENTRY DEPLETED', '#ff9a5a'); } }
}

// hives
function spawnHives(list) {
  hives.forEach(h => { scene.remove(h.m); scene.remove(h.beam); }); hives = [];
  for (const idx of list) { const [x, z] = HIVE_SITES[idx], y = ground(x, z) - 0.6, m = new THREE.Mesh(hiveGeo, hiveMat); m.position.set(x, y, z); m.rotation.y = Math.random() * 6; m.scale.setScalar(1.05); m.castShadow = true; m.receiveShadow = true; scene.add(m);
    hives.push({ m, p: new V3(x, y + 2.4, z), hp: 1700, max: 1700, alive: true, spawnT: rand(1, 3), beam: beaconBeam(x, z, '#9dff6a', 70) }); }
}
function damageHive(h, d) { if (!h.alive) return; h.hp -= d; h.m.scale.setScalar(1.05 + Math.random() * 0.03); if (h.hp <= 0) { h.alive = false; addScore(1500); say('HIVE DESTROYED  +1500', '#9dff6a'); explode(h.p.clone(), 7, 0); G.gooBurst(h.p, 5, 'blast', 'hive'); G.gooBurst(h.p.clone().setY(h.p.y + 2), 4, 'blast', 'hive'); h.m.visible = false; scene.remove(h.beam); scorch.add(h.p.x, ground(h.p.x, h.p.z), h.p.z, 14);
  refill(0.5); showBanner('HIVE DESTROYED', `${hives.filter(q => q.alive).length} REMAINING`, 2); } }

function refill(k) { for (const w of WPN) w.res = Math.min(w.res + Math.round((w.id === 'rifle' ? 324 : w.id === 'flamer' ? 300 : 16) * k), w.id === 'rifle' ? 324 : w.id === 'flamer' ? 300 : 16); }

// ------------------------------------------------------------------ missions + waves
function startMission(idx) {
  audioInit(); setMusic(true);
  mission = idx === 0 ? LAST : idx === -1 ? { ...LAST, name: 'DAILY LAST STAND', daily: true } : MISSIONS[idx]; missionIdx = idx;
  seedR = idx === -1 || D.seed ? rng((D.seed || dayNum()) * 7 + 13) : Math.random;
  swarm.clear(); gooDecals.clear(); scorch.clear(); rockets.forEach(r => scene.remove(r.m)); rockets.length = 0; turrets.forEach(t => scene.remove(t.g)); turrets = []; warnRings.forEach(w => scene.remove(w.m)); warnRings.length = 0;
  hives.forEach(h => { scene.remove(h.m); scene.remove(h.beam); }); hives = []; if (extract && extract.beam) scene.remove(extract.beam); extract = null; dropship.visible = false;
  orbital_ = null; orbBeam.visible = orbCore.visible = beaconM.visible = false; orbCd = 0;
  Object.assign(PL, { hp: 100, dead: false, hurtT: 9, yaw: 0, pitch: 0.03 }); PL.vel.set(0, 0, 0); PL.pos.set(0, 0, 9); vigA = 0;
  WPN.forEach(w => { w.ammo = w.mag; w.res = w.id === 'rifle' ? 324 : w.id === 'flamer' ? 300 : 16; }); cur = 0; VM.forEach((g, k) => g.visible = k === 0); drawAmmo(36); VM[2].tip.visible = true; reloadT = 0;
  score = 0; kills = 0; runT = 0; uplink = 1000; wave = 0; waveQ = []; waveBreak = 2.5; stormK = 0; stormTarget = mission.storm || 0; objectiveDone = false; endT = 0; queenSpawned = false; bossBug = null; recorded = false; beatenShown = false;
  turretCharges = mission.turrets || 1; aggro = 1;
  const fk = F.k(); ctx.aggro = fk; mission.fk = fk;
  if (mission.type === 'hives') spawnHives(mission.hives);
  if (mission.type === 'extract') { extract = { phase: 'go', hold: 55, beam: beaconBeam(LZ.x, LZ.z, '#ffb347', 90) }; PL.pos.set(0, 0, -8); PL.yaw = Math.atan2(-(LZ.x), -(LZ.z)) + Math.PI; PL.yaw = Math.atan2(-(LZ.x - 0), -(LZ.z + 8)); }
  hud.classList.add('on'); xh.style.display = ''; pauseBtn.style.display = 'block'; tc.classList.toggle('on', TOUCH);
  H('upw').style.display = mission.type === 'defend' || mission.type === 'endless' || mission.type === 'boss' ? '' : 'none';
  H('mn').textContent = idx > 0 ? `MISSION ${idx} · ${mission.name}` : mission.name;
  ui.hideStart(); ui.els.win.classList.add('hc-hidden'); ui.els.lose.classList.add('hc-hidden');
  state = 'play'; B.start(); S.deploy();
  showBanner(mission.name, idx > 0 ? mission.brief.split('.')[0].toUpperCase() : (mission.daily ? 'TODAY\'S SEED · SAME FOR EVERYONE' : 'SURVIVE'), 3.2);
}
const dayNum = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
function queueWave(spec) {
  const fk = mission.fk * (mission.type === 'endless' ? F.k(score) / F.k() : 1); const q = [];
  const add = (t, n) => { for (let i = 0; i < Math.round(n); i++) q.push(t); };
  add('runner', spec.r * fk); add('spitter', (spec.s || 0) * (0.8 + 0.2 * fk)); add('charger', spec.c || 0);
  for (let i = q.length - 1; i > 0; i--) { const j = Math.floor(seedR() * (i + 1)); [q[i], q[j]] = [q[j], q[i]]; }
  waveQ = q; waveSpawnT = 0; const dirs = []; const nd = 2 + Math.floor(seedR() * 2); const base = seedR() * 6.28; for (let i = 0; i < nd; i++) dirs.push(base + i * 6.28 / nd + (seedR() - 0.5) * 0.8); waveDirs = dirs;
}
let waveDirs = [0];
function endlessSpec(n) { return { r: 30 + n * 12, s: n >= 2 ? Math.floor(1 + n * 1.2) : 0, c: n >= 4 ? Math.floor((n - 2) / 2) : 0, storm: n >= 3 && seedR() < 0.3, queen: n % 7 === 0 }; }
function spawnFromQueue(dt) {
  if (!waveQ.length) return; waveSpawnT -= dt; if (waveSpawnT > 0) return;
  const alive = swarm.count(); if (alive > (LITE ? 150 : 230)) return;
  const burst = Math.min(waveQ.length, 2 + Math.floor(seedR() * 4)); waveSpawnT = rand(0.2, 0.5);
  for (let i = 0; i < burst; i++) { const t = waveQ.pop(); spawnEdge(t); }
}
function spawnEdge(t, around = null) {
  const c = around || (mission.type === 'extract' || mission.type === 'hives' ? PL.pos : new V3());
  const emerge = seedR() < (t === 'runner' ? 0.25 : 0.1);
  for (let k = 0; k < 8; k++) {
    const a = waveDirs[Math.floor(seedR() * waveDirs.length)] + (seedR() - 0.5) * 0.9, r = emerge ? 22 + seedR() * 14 : 46 + seedR() * 22;
    const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r; if (Math.hypot(x, z) > 215) continue;
    if (COL.circles.some(o => Math.hypot(o.x - x, o.z - z) < o.r + 1)) continue;
    return swarm.spawn(t, x, z, { emerge, target: (mission.type === 'defend' || mission.type === 'endless') && seedR() < 0.45 ? 'uplink' : 'player', hpK: mission.type === 'endless' ? 1 + wave * 0.04 : 1, spdK: 0.94 + 0.06 * mission.fk });
  }
}
function updateMission(dt) {
  const m = mission; let objText = '', prog = 0;
  if (m.type === 'defend' || m.type === 'endless') {
    const total = m.type === 'endless' ? Infinity : m.waves.length;
    if (waveBreak > 0) { waveBreak -= dt; if (waveBreak <= 0) {
      wave++; const spec = m.type === 'endless' ? endlessSpec(wave) : m.waves[wave - 1]; queueWave(spec);
      if (m.type === 'endless') { stormTarget = spec.storm ? 1 : 0; if (spec.queen) spawnQueen(); if (wave % 3 === 0) turretCharges++; }
      showBanner(`WAVE ${wave}`, m.type === 'endless' ? (spec.storm ? 'DUST STORM INBOUND' : spec.queen ? 'THE QUEEN STIRS' : `${waveQ.length} CONTACTS`) : wave === total ? 'FINAL WAVE' : `${waveQ.length} CONTACTS`, 2.2); S.alarm(); } }
    else { spawnFromQueue(dt); if (!waveQ.length && swarm.count() === 0) { addScore(250 * wave); refill(0.35); if (wave >= total) { objectiveDone = true; } else { waveBreak = 6; showBanner('WAVE CLEARED', `+${250 * wave}  ·  RESUPPLIED`, 2.4); } } }
    objText = waveBreak > 0 && wave > 0 ? `Regroup · wave ${wave + 1} in ${Math.ceil(waveBreak)}` : `Hold the uplink · ${swarm.count() + waveQ.length} hostiles`;
    prog = m.type === 'endless' ? (waveQ.length + swarm.count() ? 1 - (waveQ.length + swarm.count()) / Math.max(1, wavesize()) : 1) : (wave - 1 + (1 - (waveQ.length + swarm.count()) / Math.max(1, wavesize()))) / total;
    if (uplink <= 0) end(false, 'UPLINK DESTROYED');
  } else if (m.type === 'hives') {
    const left = hives.filter(h => h.alive).length; objText = `Destroy the hives · ${hives.length - left}/${hives.length}`; prog = 1 - left / hives.length;
    for (const h of hives) if (h.alive) { h.spawnT -= dt; const d = h.p.distanceTo(PL.pos); if (h.spawnT <= 0 && d < 90 && swarm.count() < 120) { h.spawnT = rand(2.6, 4.2) / mission.fk; for (let i = 0; i < 2; i++) { const a = Math.random() * 6.28; swarm.spawn(Math.random() < 0.15 ? 'spitter' : 'runner', h.p.x + Math.cos(a) * 7, h.p.z + Math.sin(a) * 7, { emerge: true }); } } }
    trickle(dt, 0.6);
    if (!left) objectiveDone = true;
  } else if (m.type === 'extract') {
    const d = Math.hypot(PL.pos.x - LZ.x, PL.pos.z - LZ.z);
    if (extract.phase === 'go') { objText = `Reach the landing zone · ${Math.round(d)} m`; prog = 1 - d / 120; trickle(dt, 0.7); if (d < 12) { extract.phase = 'hold'; showBanner('HOLD THE LZ', 'DROPSHIP INBOUND', 2.4); S.alarm(); waveDirs = [0, 2, 4].map(a => a + Math.random()); } }
    else { if (d < 16) extract.hold -= dt; objText = d < 16 ? `Hold the LZ · dropship in ${Math.ceil(extract.hold)}s` : 'Get back to the LZ!'; prog = 1 - extract.hold / 55; trickle(dt, 3.2, LZ);
      if (extract.hold < 14) { dropship.visible = true; const k = Math.max(0, extract.hold) / 14; dropship.position.set(LZ.x + k * 60, ground(LZ.x, LZ.z) + 3.2 + k * 70, LZ.z - k * 120); dropship.rotation.set(-0.15 * k, 0.4 * k, 0); dropship.thrust.forEach(f => f.scale.y = 0.8 + Math.random() * 0.4);
        if (Math.random() < 0.5 && k < 0.3) G.dirt(new V3(LZ.x + rand(-8, 8), ground(LZ.x, LZ.z), LZ.z + rand(-8, 8)), 2); }
      if (extract.hold <= 0 && d < 16) objectiveDone = true; }
  } else if (m.type === 'boss') {
    if (!queenSpawned) { if (wave === 0) { wave = 1; queueWave({ r: 40, s: 2 }); } spawnFromQueue(dt); if (!waveQ.length && swarm.count() < 4) spawnQueen(); objText = 'Clear the vanguard'; prog = 0.1; }
    else { trickle(dt, 0.9); const q = bossBug; objText = q && !q.dead ? (q.state === 'tunnel' ? 'Queen tunnelling · watch the dust!' : 'Kill the Tunnel Queen') : 'Queen slain'; prog = q ? 1 - Math.max(0, q.hp) / q.max : 1; if (q && q.dead) objectiveDone = true; }
    if (uplink <= 0) end(false, 'UPLINK DESTROYED');
  }
  if (objectiveDone && state === 'play') { endT += dt; if (endT > (m.type === 'boss' ? 2.5 : 1.2)) end(true); }
  H('ot').textContent = objText; H('ob').style.width = clamp(prog, 0, 1) * 100 + '%'; H('up').style.width = uplink / 10 + '%';
  H('wv').textContent = m.type === 'defend' || m.type === 'endless' ? `WAVE ${Math.max(1, wave)}` : m.type === 'hives' ? 'HIVES' : m.type === 'boss' ? 'BOSS' : 'EXTRACT';
}
function wavesize() { const s = mission.type === 'endless' ? endlessSpec(Math.max(1, wave)) : mission.waves[Math.max(0, wave - 1)]; return Math.round(s.r * mission.fk) + (s.s || 0) + (s.c || 0); }
let trickleT = 0;
function trickle(dt, rate, around) { trickleT -= dt * rate * mission.fk; if (trickleT > 0 || swarm.count() > (LITE ? 110 : 170)) return; trickleT = rand(0.6, 1.4); const r = seedR(); spawnEdge(r < 0.75 ? 'runner' : r < 0.93 ? 'spitter' : 'charger', around); if (seedR() < 0.4) spawnEdge('runner', around); }
function spawnQueen() { queenSpawned = true; const a = Math.atan2(PL.pos.z, PL.pos.x) + Math.PI + rand(-0.6, 0.6), x = Math.cos(a) * 46, z = Math.sin(a) * 46;
  const q = swarm.spawn('queen', x, z, { emerge: true, hpK: mission.type === 'endless' ? 0.6 + wave * 0.03 : mission.fk }); if (!q) return; q.state = 'emerge'; q.t = 3; q.y = ground(x, z) - 14; bossBug = q; S.roar(); S.rumble(); shake = 0.8; G.dirt(new V3(x, ground(x, z), z), 6); showBanner('THE TUNNEL QUEEN', 'BREACH DETECTED', 3); }

function end(won, why = '') {
  if (state !== 'play') return; state = won ? 'won' : 'lost'; flameOn(false); IN.fire = false; mouseDown = false; setMusic(false);
  if (won) { const bonus = 3000 + Math.round(PL.hp * 10) + (mission.type === 'defend' || mission.type === 'boss' ? Math.round(uplink * 2) : 0); addScore(bonus); }
  const ms = Math.round(runT * 1000); B.submit(score, { ms });
  const key = String(missionIdx), prevBest = bests[key] || 0; if (score > prevBest) { bests[key] = score; store_.set('bests', bests); }
  if (!recorded) { recorded = true; if (mission.type === 'endless') F.endless(score); else won ? F.level(true) : F.level(false, missionProgress()); }
  hud.classList.remove('on'); xh.style.display = 'none'; tc.classList.remove('on'); pauseBtn.style.display = 'none';
  try { document.exitPointerLock && document.exitPointerLock(); } catch (e) {}
  const stats = `<div class="stats"><div>SCORE<b>${score.toLocaleString()}</b></div><div>KILLS<b>${kills}</b></div><div>${mission.type === 'endless' ? 'WAVE' : 'TIME'}<b>${mission.type === 'endless' ? wave : fmtT(runT)}</b></div></div>`;
  if (won || (mission.type === 'endless' && score > prevBest && prevBest > 0)) {
    if (won && missionIdx > 0) { unlocked = Math.max(unlocked, Math.min(8, missionIdx + 1)); store_.set('unlocked', unlocked); }
    D.won(score); S.win();
    const w = ui.els.win; w.querySelector('p').firstChild.textContent = mission.type === 'endless' ? 'NEW BEST · WAVE ' : 'MISSION '; w.querySelector('h1').textContent = mission.type === 'endless' ? 'RECORD!' : 'COMPLETE';
    w.querySelectorAll('.stats').forEach(s => s.remove()); w.querySelector('h1').insertAdjacentHTML('afterend', stats);
    w.querySelector('.hint').textContent = missionIdx > 0 && missionIdx < 7 ? 'Tap for the next mission' : 'Tap to deploy again';
    ui.win(mission.type === 'endless' ? wave : missionIdx, score > prevBest ? 'New personal best' : '');
  } else {
    S.lose(); const l = ui.els.lose; l.querySelectorAll('.stats').forEach(s => s.remove()); l.querySelector('h1').insertAdjacentHTML('afterend', stats);
    ui.lose(mission.type === 'endless' ? 'OVERRUN' : 'MISSION FAILED', mission.type === 'endless' ? `Kestrel-7 held ${wave} waves` : why);
  }
}
function missionProgress() { const m = mission; if (m.type === 'defend') return (wave - 1) / m.waves.length; if (m.type === 'hives') return hives.filter(h => !h.alive).length / hives.length; if (m.type === 'extract') return extract.phase === 'hold' ? 0.5 + 0.5 * (1 - extract.hold / 55) : 0.3; if (m.type === 'boss') return bossBug ? 1 - bossBug.hp / bossBug.max : 0.1; return 0; }
const fmtT = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

// ------------------------------------------------------------------ start menu
const menu = el('<div id="menu"></div>'); let sel = Math.min(unlocked, 7);
ui.els.start.innerHTML = ''; ui.els.start.append(menu);
const dStreak = ui.els.start.querySelector('p');
function renderMenu() {
  const tiles = []; for (let i = 1; i <= 7; i++) { const M = MISSIONS[i], lockd = i > unlocked; tiles.push(`<button class="tile ${sel === i ? 'sel' : ''} ${lockd ? 'lock' : ''}" data-m="${i}"><small>${lockd ? '🔒 ' : ''}MISSION ${i}</small><span>${M.name}</span>${bests[i] ? '<i class="st">✔</i>' : ''}</button>`); }
  tiles.push(`<button class="tile ls ${sel === 0 ? 'sel' : ''}" data-m="0"><small>ENDLESS</small><span>LAST STAND</span></button>`);
  tiles.push(`<button class="tile ls ${sel === -1 ? 'sel' : ''}" data-m="-1"><small>TODAY'S SEED</small><span>DAILY STAND</span></button>`);
  const M = sel > 0 ? MISSIONS[sel] : LAST, best = bests[sel];
  menu.innerHTML = `<div class="tag">SECTOR 9 · OUTPOST KESTREL-7</div><div class="logo">HIVEFALL</div><div class="sub">ALIEN HORDE SHOOTER</div>
    <div class="sp"></div><div class="grid">${tiles.join('')}</div>
    <div class="brief"><b>${sel === -1 ? 'DAILY LAST STAND' : M.name}</b> · ${sel === -1 ? 'Same waves for every player today. One shot at the world board.' : M.brief}${best ? `<br><span style="color:#9dff6a;font-size:12px;letter-spacing:.12em">BEST ${best.toLocaleString()}</span>` : ''}</div>
    <button class="deploy">DEPLOY</button>
    <div class="ctl">${TOUCH ? 'LEFT THUMB MOVE · DRAG TO AIM · HOLD FIRE' : 'WASD · MOUSE · 1 2 3 WEAPONS · R RELOAD · Q STRIKE · E TURRET'}</div>`;
  menu.querySelectorAll('.tile').forEach(t => t.addEventListener('pointerdown', e => { e.stopPropagation(); const i = +t.dataset.m; if (i > unlocked) { S.ui(0); return; } sel = i; audioInit(); S.ui(2); renderMenu(); }));
}
renderMenu();
if (D.seed) sel = -1, renderMenu();
function toMenu() { flameOn(false); state = 'ready'; hud.classList.remove('on'); xh.style.display = 'none'; tc.classList.remove('on'); pauseBtn.style.display = 'none'; try { document.exitPointerLock(); } catch (e) {} swarm.clear(); hives.forEach(h => { scene.remove(h.m); scene.remove(h.beam); }); hives = []; if (extract && extract.beam) scene.remove(extract.beam); extract = null; turrets.forEach(t => scene.remove(t.g)); turrets = []; dropship.visible = false; mission = null; renderMenu(); ui.start(); setMusic(false); }
ui.onTap(which => {
  audioInit(); if (!TOUCH && !navigator.webdriver) lock();
  if (which === 'start') startMission(sel);
  else if (which === 'win') { if (missionIdx > 0 && missionIdx < 7) { sel = missionIdx + 1; startMission(missionIdx + 1); } else startMission(missionIdx); }
  else startMission(missionIdx);
});

// ------------------------------------------------------------------ bot: aims at the nearest threat, picks weapons, moves with the objective
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): in mission 1, until the first real touch,
// the trooper turns, aims and fires at the nearest bugs for about 4.5 s (the bot's own aim; no orbital strike, no turret spent)
const DM = demo(null, { ready: () => state === 'play' && missionIdx === 1 && !D.seed, wait: 1200, ms: 4500 });
let botT = -9, botFire = false; const botOn = () => performance.now() - botT < 600;
let botStrafe = 1, botStrafeT = 0;
function botControl(dt) {
  botFire = false; if (state !== 'play') return;
  const p = PL.pos; let tgt = null, best = 1e9, close = 0, nearC = 0;
  for (const b of swarm.all) { if (b.dead || b.state === 'tunnel' || b.state === 'emerge') continue; const d = Math.hypot(b.x - p.x, b.z - p.z); if (d < 9) close++; let s = d * (b.state === 'rush' ? 0.4 : b.type === 'queen' ? 0.6 : b.type === 'spitter' && d < 30 ? 0.8 : 1); if (s < best) { best = s; tgt = b; } }
  let aimP = null, dist = 1e9;
  if (tgt) { dist = Math.hypot(tgt.x - p.x, tgt.z - p.z); aimP = new V3(tgt.x + tgt.vx * dist / 300, tgt.y + tgt.T.cy * (tgt.type === 'queen' ? 1 : 0.9), tgt.z + tgt.vz * dist / 300); }
  const hv = hives.filter(h => h.alive).sort((a, b) => a.p.distanceTo(p) - b.p.distanceTo(p))[0];
  if (hv && (!tgt || dist > 18) && hv.p.distanceTo(p) < 60) { aimP = hv.p.clone(); dist = hv.p.distanceTo(p); tgt = null; }
  // weapon choice
  const w = WPN; let want = 0;
  if (close >= 4 && (w[1].ammo > 5 || w[1].res > 0)) want = 1;
  else if ((tgt && (tgt.type === 'charger' || tgt.type === 'queen') || (!tgt && hv)) && (w[2].ammo > 0 || w[2].res > 0) && dist > 8) want = 2;
  if (want !== cur && swapT <= 0 && reloadT <= 0) swap(want);
  if (WPN[cur].ammo <= 0 || (cur === 0 && WPN[0].ammo < 10 && close === 0 && dist > 25)) reload();
  // aim
  if (aimP) { const e = camera.getWorldPosition(new V3()), v = aimP.clone().sub(e).normalize(); const ty = Math.atan2(-v.x, -v.z), tp = Math.asin(clamp(v.y, -1, 1));
    const dy = Math.atan2(Math.sin(ty - PL.yaw), Math.cos(ty - PL.yaw)), dp = tp - PL.pitch; const k = Math.min(1, dt * 9); PL.yaw += clamp(dy * k, -0.12, 0.12); PL.pitch += dp * k;
    const err = Math.hypot(dy, dp); botFire = err < (cur === 1 ? 0.25 : cur === 2 ? 0.05 : 0.07) && dist < (cur === 1 ? 10 : 120); }
  // abilities
  if (!DM.on && orbCd <= 0 && !orbital_) { let bestC = null, bn = 0; for (const b of swarm.all) { if (b.dead) continue; const d = Math.hypot(b.x - p.x, b.z - p.z); if (d < 14 || d > 60) continue; let n = 0; swarm.forRadius(b.x, b.z, 9, () => n++); if (b.type === 'queen') n += 10; if (n > bn) { bn = n; bestC = b; } } if (bn >= 7) orbital(new V3(bestC.x, 0, bestC.z)); else if (hv && hv.p.distanceTo(p) < 50 && hv.p.distanceTo(p) > 15) orbital(hv.p.clone()); }
  if (!DM.on && turretCharges > 0 && turrets.length < 3 && runT > 2 && (mission.type !== 'extract' || extract.phase === 'hold')) deployTurret();
  // movement
  let gx = 0, gz = 0;
  if (mission.type === 'hives' && hv) { gx = hv.p.x; gz = hv.p.z; const d = hv.p.distanceTo(p); if (d < 20) { gx = p.x; gz = p.z; } }
  else if (mission.type === 'extract') { gx = LZ.x; gz = LZ.z; }
  else { const a = Math.atan2(p.z, p.x) + 0.4 * botStrafe; gx = Math.cos(a) * 9; gz = Math.sin(a) * 9; }
  { const pr = Math.hypot(p.x, p.z), gr = Math.hypot(gx, gz); if ((pr < RING + 1.5) !== (gr < RING + 1.5) && Math.abs(pr - RING) < 14) { const ga = Math.round(Math.atan2(gz, gx) / (Math.PI / 2)) * Math.PI / 2, gpx = Math.cos(ga) * RING, gpz = Math.sin(ga) * RING; if (Math.hypot(gpx - p.x, gpz - p.z) > 2.5) { gx = gpx; gz = gpz; } else { const out = gr >= RING + 1.5; gx = Math.cos(ga) * (out ? RING + 6 : RING - 6); gz = Math.sin(ga) * (out ? RING + 6 : RING - 6); } } }
  let mx = gx - p.x, mz = gz - p.z; const L = Math.hypot(mx, mz); if (L > 1.5) { mx /= L; mz /= L; } else { mx = mz = 0; }
  if (tgt && dist < (tgt.type === 'queen' ? 20 : 2 + tgt.T.r * 1.5)) { const ax = p.x - tgt.x, az = p.z - tgt.z, l = Math.hypot(ax, az) || 1; const side = botStrafe; mx += (ax / l + az / l * side * 0.8) * 1.2; mz += (az / l - ax / l * side * 0.8) * 1.2; }
  for (const w of warnRings) { const ax = p.x - w.m.position.x, az = p.z - w.m.position.z, l = Math.hypot(ax, az) || 1; if (l < 9) { mx += ax / l * 3; mz += az / l * 3; } }
  botStrafeT -= dt; if (botStrafeT <= 0) { botStrafe = -botStrafe; botStrafeT = rand(2, 5); }
  if (mission.type === 'extract' && extract.phase === 'hold') { mx += -Math.cos(PL.yaw) * botStrafe * 0.4; mz += Math.sin(PL.yaw) * botStrafe * 0.4; }
  // world → local stick
  const fx = -Math.sin(PL.yaw), fz = -Math.cos(PL.yaw), rx = Math.cos(PL.yaw), rz = -Math.sin(PL.yaw);
  IN.botMove = [mx * rx + mz * rz, -(mx * fx + mz * fz)]; IN.dbg = [gx, gz, mx, mz, tgt && tgt.type, dist];
}

// ------------------------------------------------------------------ player movement
let blockedRing = false;
const col = (p, r) => {
  for (const c of COL.circles) { const dx = p.x - c.x, dz = p.z - c.z; if (Math.abs(dx) > c.r + r || Math.abs(dz) > c.r + r) continue; const d = Math.hypot(dx, dz), m = c.r + r; if (d < m && d > 0.001) { p.x = c.x + dx / d * m; p.z = c.z + dz / d * m; } }
  for (const o of COL.boxes) { const dx = p.x - o.x, dz = p.z - o.z, lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c; if (Math.abs(lx) < o.hw + r && Math.abs(lz) < o.hd + r) { const px = o.hw + r - Math.abs(lx), pz = o.hd + r - Math.abs(lz); let nx = lx, nz = lz; if (px < pz) nx = Math.sign(lx) * (o.hw + r); else nz = Math.sign(lz) * (o.hd + r); p.x = o.x + nx * o.c + nz * o.s; p.z = o.z - nx * o.s + nz * o.c; } }
  const rr = Math.hypot(p.x, p.z), a = Math.atan2(p.z, p.x);
  if (Math.abs(rr - RING) < 0.85 + r && !inGate(a) && p.y < 1.3) { blockedRing = true; const s = rr < RING ? -1 : 1; const nr = RING + s * (0.85 + r); p.x = Math.cos(a) * nr; p.z = Math.sin(a) * nr; }
  const m = Math.hypot(p.x, p.z); if (m > 205) { p.x *= 205 / m; p.z *= 205 / m; }
};
function movePlayer(dt) {
  let mx = 0, mz = 0;
  if (keys.KeyW || keys.ArrowUp) mz -= 1; if (keys.KeyS || keys.ArrowDown) mz += 1; if (keys.KeyA || keys.ArrowLeft) mx -= 1; if (keys.KeyD || keys.ArrowRight) mx += 1;
  mx += IN.mx; mz += IN.mz; if (botOn() && IN.botMove) { mx += IN.botMove[0]; mz += IN.botMove[1]; }
  const L = Math.hypot(mx, mz); if (L > 1) { mx /= L; mz /= L; }
  const sprint = (keys.ShiftLeft || keys.ShiftRight || IN.sprint) && mz < 0 && !(IN.fire || mouseDown);
  const sp = (sprint ? 9.5 : 6.2) * (cur === 2 ? 0.92 : 1);
  const fx = -Math.sin(PL.yaw), fz = -Math.cos(PL.yaw), rx = Math.cos(PL.yaw), rz = -Math.sin(PL.yaw);
  const wx = (rx * mx - fx * mz) * sp, wz = (rz * mx - fz * mz) * sp;
  const acc = PL.onGround ? 12 : 3; PL.vel.x += (wx - PL.vel.x) * Math.min(1, dt * acc); PL.vel.z += (wz - PL.vel.z) * Math.min(1, dt * acc);
  if ((keys.Space) && PL.onGround) { PL.vel.y = 6.2; PL.onGround = false; }
  PL.vel.y -= 18 * dt; PL.pos.addScaledVector(PL.vel, dt);
  blockedRing = false; col(PL.pos, 0.45);
  if (blockedRing && PL.onGround && Math.hypot(wx, wz) > 1) { PL.vel.y = 7.4; PL.onGround = false; }   // vault the sandbags
  const gy = ground(PL.pos.x, PL.pos.z); if (PL.pos.y <= gy) { if (!PL.onGround && PL.vel.y < -6) { S.land(); kick = 0.6; } PL.pos.y = gy; PL.vel.y = 0; PL.onGround = true; } else if (PL.pos.y > gy + 0.05) PL.onGround = PL.pos.y - gy < 0.08;
  const hs = Math.hypot(PL.vel.x, PL.vel.z); PL.bob += dt * hs * (sprint ? 1.25 : 1.6);
  PL.stepT -= dt * hs; if (PL.stepT <= 0 && PL.onGround && hs > 1) { PL.stepT = sprint ? 2.6 : 2.2; S.step(sprint); }
  PL.sprinting = sprint && hs > 4;
  PL.x = PL.pos.x; PL.y = PL.pos.y + 1.6; PL.z = PL.pos.z; PL.vx = PL.vel.x; PL.vz = PL.vel.z;
}

// ------------------------------------------------------------------ main loop
let lastSupT = -9, drawCalls = 0, deathT = 0, last = performance.now(), attractT = 0, fpsA = 60;
const camOff = new V3(); let hudT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now; fpsA = fpsA * 0.95 + (1 / Math.max(dt, 1e-3)) * 0.05;
  if (state === 'play') {
    runT += dt;
    if (DM.on) botT = performance.now();
    if (botOn()) botControl(dt);
    PL.yaw -= IN.look[0]; PL.pitch = clamp(PL.pitch - IN.look[1] + recoil * 0, -1.35, 1.35); IN.look[0] = IN.look[1] = 0;
    movePlayer(dt);
    if (reloadT > 0) { reloadT -= dt; if (reloadT <= 0) finishReload(); }
    swapT = Math.max(0, swapT - dt);
    shoot(dt);
    // recoil recovers; it pushes the view up as you fire
    PL.pitch += recoil * dt * 14; recoil = Math.max(0, recoil - dt * recoil * 12 - dt * 0.01); spreadK = Math.max(0, spreadK - dt * 2.2);
    // regen + resupply
    PL.hurtT += dt; if (PL.hurtT > 3.5 && PL.hp < 100) PL.hp = Math.min(100, PL.hp + dt * 12);
    if (Math.hypot(PL.pos.x - 5.2, PL.pos.z - 3.4) < 3.2) { let gave = false; for (const w of WPN) { const mx = w.id === 'rifle' ? 324 : w.id === 'flamer' ? 300 : 16; if (w.res < mx) { w.res = Math.min(mx, w.res + dt * mx * 0.25); gave = true; } } if (gave && runT - lastSupT > 2.5) { lastSupT = runT; say('RESUPPLYING', '#5fe8ff'); } }
    for (const w of WPN) w.res = Math.round(w.res * 100) / 100;
    swarm.update(dt, ctx);
    // burning bugs
    for (const b of swarm.all) if (b.burn > 0 && !b.dead) { b.burn -= dt; swarm.damage(b, 26 * dt, 'flame'); if (Math.random() < dt * 14) fxA.spawn(b.x + rand(-.5, .5) * b.T.r, b.y + b.T.cy + rand(0, .6), b.z + rand(-.5, .5) * b.T.r, 0, rand(1, 3), 0, { life: 0.5, size: rand(0.3, 0.7) * b.T.r, grow: 1, color: [2.4, 0.8, 0.2], soft: 1, grav: -2 }); }
    updateRockets(dt); updateOrbital(dt); updateTurrets(dt); updateMission(dt);
    setIntensity(Math.min(1, swarm.nearMass / 30 + (bossBug && !bossBug.dead ? 0.5 : 0)));
  } else {
    // attract mode: slow orbit over the outpost while a swarm probes the walls
    attractT += dt;
    if (state === 'ready') {
      const a = attractT * 0.035 + 2.6; PL.pos.set(Math.cos(a) * 26.5, 0, Math.sin(a) * 26.5); PL.pos.y = ground(PL.pos.x, PL.pos.z) + 2.6; PL.yaw = Math.atan2(-PL.pos.x, -PL.pos.z) + 0.3; PL.pitch = 0.1;
      PL.x = PL.pos.x * 4; PL.z = PL.pos.z * 4; PL.y = 0; PL.vx = PL.vz = 0;
      if (swarm.count() < (LITE ? 50 : 90) && Math.random() < 0.3) { const aa = Math.random() * 6.28, r = 60 + Math.random() * 40; swarm.spawn(Math.random() < 0.85 ? 'runner' : Math.random() < 0.6 ? 'spitter' : 'charger', Math.cos(aa) * r, Math.sin(aa) * r, { target: 'uplink' }); }
      const ctxA = { ...ctx, player: { x: 0, y: 0, z: 0, vx: 0, vz: 0 }, hurtPlayer() {}, hurtUplink() {}, sfx() {}, slam() {}, splash: () => {}, quake() {} };
      swarm.update(dt, ctxA);
      for (const b of swarm.all) if (!b.dead && Math.hypot(b.x, b.z) < 30) swarm.kill(b, 'bullet');
      // floodlight turret fire for show
      if (Math.random() < dt * 8) { const b = swarm.nearest(0, 0, q => Math.hypot(q.x, q.z) < 50); if (b) { const from = new V3(Math.cos(Math.atan2(b.z, b.x)) * 22, 2.2, Math.sin(Math.atan2(b.z, b.x)) * 22); tracers.add(from, new V3(b.x, b.y + b.T.cy, b.z), 0.05, 0.08); swarm.damage(b, 12, 'bullet', from); gooSpray(new V3(b.x, b.y + b.T.cy, b.z), new V3(0, 0, 1), 3); } }
      stormK = lerp(stormK, 0, dt);
    } else { const k = Math.min(1, dt * 1.5); deathT += dt; if (state === 'lost') { PL.pos.y += (ground(PL.pos.x, PL.pos.z) + 5 - PL.pos.y) * k; PL.pitch += (-0.42 - PL.pitch) * k; PL.yaw += dt * 0.15; } else { PL.pos.y += (ground(PL.pos.x, PL.pos.z) + 1.5 - PL.pos.y) * k; PL.pitch += (0.25 - PL.pitch) * k * 0.5; PL.yaw += dt * 0.1; } }
    updateRockets(dt); updateOrbital(dt);
  }
  // storm
  stormK += ((mission && state === 'play' ? stormTarget : stormK * 0.99) - stormK) * Math.min(1, dt * 0.35);
  scene.fog.near = 110 - stormK * 90; scene.fog.far = 460 - stormK * 290; scene.fog.color.copy(FOGC).lerp(STORMC, stormK);
  sun.intensity = 3.1 * (1 - stormK * 0.5); haze.uniforms.uStorm.value = stormK; setStorm(stormK);
  if (stormK > 0.05) for (let i = 0; i < (LITE ? 3 : 6) * stormK; i++) fxS.spawn(PL.pos.x + rand(-25, 25) - 18, PL.pos.y + rand(0, 5), PL.pos.z + rand(-25, 25), 22 + rand(0, 8), rand(-1, 1), -8 + rand(-2, 2), { life: 1.2, size: rand(0.05, 0.12), color: [1, 0.85, 0.7], alpha: 0.8 });
  // camera
  shake = Math.max(0, shake - dt * 1.6); const s2 = shake * shake;
  camOff.set((Math.random() - 0.5) * s2 * 0.5, (Math.random() - 0.5) * s2 * 0.4, 0);
  const bobY = state === 'play' ? Math.abs(Math.sin(PL.bob * 3.4)) * 0.045 * Math.min(1, Math.hypot(PL.vel.x, PL.vel.z) / 6) : 0;
  camera.position.set(PL.pos.x, PL.pos.y + 1.62 + bobY, PL.pos.z).add(camOff);
  camera.rotation.set(PL.pitch + (Math.random() - 0.5) * s2 * 0.05, PL.yaw, (Math.random() - 0.5) * s2 * 0.05 + (state === 'play' ? Math.sin(PL.bob * 1.7) * 0.004 : 0), 'YXZ');
  camera.updateMatrixWorld();
  // viewmodel: bob, sway, kick, reload dip, swap drop, sprint tilt
  vmRoot.visible = state === 'play';
  const vb = vmBase(), t = PL.bob; kick = Math.max(0, kick - dt * 9);
  const rl = reloadT > 0 ? Math.sin(Math.min(1, (WPN[cur].reload - reloadT) / WPN[cur].reload) * Math.PI) : 0, sw = swapT > 0 ? Math.sin(swapT / 0.4 * Math.PI) : 0;
  vmRoot.scale.setScalar(camera.aspect < 0.8 ? 0.72 : 1);
  vmRoot.position.set(vb.x + Math.sin(t * 1.7) * 0.012 + (PL.sprinting ? -0.04 : 0), vb.y + Math.abs(Math.cos(t * 1.7)) * 0.01 - rl * 0.08 - sw * 0.25 - (PL.sprinting ? 0.03 : 0), vb.z + kick * 0.05);
  vmRoot.rotation.set(kick * 0.06 - rl * 0.5 + (PL.sprinting ? -0.25 : 0), (PL.sprinting ? 0.5 : 0), rl * 0.6 + (PL.sprinting ? 0.25 : 0));
  if (VM[0].mag) VM[0].mag.position.y = -0.09 - (cur === 0 ? Math.max(0, rl - 0.4) * 0.25 : 0);
  mflashT -= dt; if (mflashT <= 0) mflash.visible = false; mflash.position.copy(VM[cur].muzzle).add(new V3(0, 0, -0.08)).applyEuler(vmRoot.rotation).add(vmRoot.position);
  mflash.position.copy(VM[cur].muzzle).add(new V3(0, 0, -0.06));
  VM[cur].add(mflash);
  // sun + shadows follow the player
  sun.position.copy(PL.pos).addScaledVector(new V3(sunDir.x, 0.24, sunDir.z).normalize(), 120); sun.target.position.copy(PL.pos); sun.target.updateMatrixWorld();
  // world animation
  hiveU.t.value += dt; OP.core.rotation.y += dt * 0.8; OP.core.material.color.setRGB(0.6, 2.6, 2.8).multiplyScalar(1 + Math.sin(attractT * 3 + runT * 3) * 0.2 + (upHitT > 0 ? 1.5 : 0)); upHitT -= dt;
  coreLight.intensity = 10 + Math.sin(runT * 3) * 3;
  for (let i = warnRings.length - 1; i >= 0; i--) { const w = warnRings[i]; w.t -= dt; w.m.material.opacity = 0.4 + 0.5 * Math.abs(Math.sin(w.t * 12)); w.m.scale.setScalar(1 + (1 - w.t / w.max) * 0.2); if (w.t <= 0) { scene.remove(w.m); warnRings.splice(i, 1); } }
  fxA.update(dt); fxS.update(dt); tracers.update(dt); lights.update(dt); dust.update(dt, camera, { x: 20, z: -7 }, stormK);
  haze.uniforms.uTime.value += dt; haze.uniforms.uHurt.value = vigA;
  vigA = Math.max(0, vigA - dt * 0.8); const low = state === 'play' && PL.hp < 35; vig.style.opacity = Math.min(1, vigA + (low ? 0.35 + 0.25 * Math.sin(runT * 6) : 0));
  hmT -= dt; if (hmT <= 0) hm.style.opacity = 0;
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) banner.style.opacity = 0; }
  hudT -= dt; if (state === 'play' && hudT <= 0) { hudT = 0.1; updateHud(); }
  R.info.reset(); C.render(dt); drawCalls = R.info.render.calls;
}
function updateHud() {
  const w = WPN[cur];
  H('sc').textContent = score.toLocaleString(); H('hp').style.width = PL.hp + '%'; H('hpn').textContent = Math.ceil(PL.hp); hud.querySelector('.hp').classList.toggle('low', PL.hp < 35);
  H('wn').textContent = reloadT > 0 ? 'RELOADING…' : w.name; const am = Math.floor(w.ammo); H('am').innerHTML = `${am}<small> / ${Math.floor(w.res)}</small>`; H('am').classList.toggle('low', am < w.mag * 0.25);
  const ab1 = H('ab1'), ab2 = H('ab2'); ab1.classList.toggle('ready', orbCd <= 0 && !orbital_); ab1.querySelector('.cd').style.height = (orbCd / 40 * 100) + '%'; H('tn').textContent = turretCharges; ab2.classList.toggle('ready', turretCharges > 0);
  tc.querySelector('[data-swn]').textContent = reloadT > 0 ? 'RELOAD' : w.short; tc.querySelector('[data-swa]').textContent = `${am} / ${Math.floor(w.res)}`; tc.querySelector('.orb .cd').style.height = (orbCd / 40 * 100) + '%'; tc.querySelector('[data-tn2]').textContent = turretCharges; tc.querySelector('.orb').classList.toggle('on', orbCd <= 0 && !orbital_);
  // compass: N/E/S/W + objective markers
  const cmp = H('cmp'), W = cmp.clientWidth || 300, fov = 1.6; const items = [['N', Math.PI], ['E', -Math.PI / 2], ['S', 0], ['W', Math.PI / 2]].map(([n, a]) => ({ n, a, c: '' }));
  if (mission.type === 'hives') hives.filter(h => h.alive).forEach(h => items.push({ n: '◆', a: Math.atan2(-(h.p.x - PL.pos.x), -(h.p.z - PL.pos.z)), c: 'mg' }));
  if (mission.type === 'extract') items.push({ n: '▼', a: Math.atan2(-(LZ.x - PL.pos.x), -(LZ.z - PL.pos.z)), c: 'm' });
  if (mission.type !== 'extract' && mission.type !== 'hives') items.push({ n: '⬢', a: Math.atan2(PL.pos.x, PL.pos.z), c: 'm' });
  if (bossBug && !bossBug.dead) items.push({ n: '☠', a: Math.atan2(-(bossBug.x - PL.pos.x), -(bossBug.z - PL.pos.z)), c: 'mg' });
  cmp.innerHTML = items.map(it => { const d = Math.atan2(Math.sin(it.a - PL.yaw), Math.cos(it.a - PL.yaw)); if (Math.abs(d) > fov / 2) return ''; return `<span class="cs ${it.c}" style="left:${(0.5 - d / fov) * W}px">${it.n}</span>`; }).join('');
}

// resize
function resize() { R.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.fov = camera.aspect < 0.8 ? 84 : 72; camera.updateProjectionMatrix(); C.resize(innerWidth, innerHeight);
  const sc = R.getPixelRatio() * innerHeight / (2 * Math.tan(camera.fov * Math.PI / 360)); fxA.uScale.value = sc; fxS.uScale.value = sc; }
addEventListener('resize', resize); resize();
requestAnimationFrame(frame);

window.__game = {
  get state() { return state; }, get level() { return missionIdx; }, get score() { return score; },
  get wave() { return wave; }, get bugs() { return swarm.count(); }, get fps() { return Math.round(fpsA); }, get calls() { return drawCalls; }, _dbg: { IN, swarm: () => swarm, PL, camera, swap: i => swap(i), orbital: () => orbital(), hives: () => hives, spawn: (t, x, z) => swarm.spawn(t, x, z) },
  bot() { botT = performance.now(); },
  start(i) { startMission(i); },
};
