// IRONSQUALL: Mech Shooter — third-person mech combat in a sunny stylised megacity.
import * as THREE from './kit/three.module.min.js';
import { cine } from './kit/cine.js';
import { createUI, store, buzz } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { buildMech, droneGeo, buildTurret, buildCore, buildBoss, mechMat, GB, addOutline } from './models.js';
import { buildCity, MAP0, MAP1 } from './world.js';
import { createFX } from './fx.js';
import { initAudio, S as SND, laserLoop, setIntensity, setMuted } from './audio.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const rngF = (s) => { s = Math.floor(s) % 2147483647 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const Q = new URLSearchParams(location.search);

// ================================================================ renderer, scene, lights
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' }); renderer.info.autoReset = false; let CALLS = 0;
renderer.setSize(innerWidth, innerHeight); renderer.domElement.className = 'hc-canvas'; document.body.prepend(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#9fd0ff');
scene.fog = new THREE.FogExp2('#dfe7f0', 0.0029);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.3, 2600);
const C = cine(renderer, scene, camera, { bloom: 0.32, bloomThreshold: 0.95, bloomRadius: 0.4, exposure: 1.1, envIntensity: 0.5, grade: { sat: 1.16, contrast: 1.06, vignette: 0.12, grain: 0 } });
const LITE = C.lite;
const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x9a7a5a, 1.25); scene.add(hemi);
const SUN_DIR = V3(0.5, 0.62, -0.6).normalize();
const sun = new THREE.DirectionalLight(0xfff0d6, 2.7); sun.castShadow = true;
sun.shadow.mapSize.set(LITE ? 1024 : 2048, LITE ? 1024 : 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.5;
Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 320 });
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight(0xffc8e8, 0.5); fill.position.set(-1, 0.4, 1); scene.add(fill);

// ================================================================ missions (layout first so the city keeps spawn spots clear)
const MISSIONS = [
  { name: 'FIRST LIGHT', brief: 'Destroy the drone swarm', start: [120, 285, Math.PI] },
  { name: 'GUN ALLEY', brief: 'Destroy the 4 Bastion turrets', start: [60, 292, Math.PI], turrets: [[67, 224], [53, 176], [66, 122], [55, 74]] },
  { name: 'DEAD SIGNAL', brief: 'Hold the 3 uplinks', start: [180, 292, Math.PI], uplinks: [[180, 232], [180, 180], [240, 180]] },
  { name: 'RIVALS', brief: 'Defeat the Hexwire Raptors', start: [120, 236, Math.PI] },
  { name: 'BLACKOUT', brief: 'Destroy the 3 power cores', start: [120, 236, Math.PI], cores: [[120, 120], [60, 60], [180, 60]], turrets: [[128, 132], [52, 70], [188, 70]] },
  { name: 'WEAVER', brief: 'Bring down the spider-tank', start: [150, 186, Math.PI] },
];
const SIEGE = { name: 'SIEGE', start: [150, 182, Math.PI], spawns: [[120, 90], [180, 90], [90, 120], [210, 120], [90, 180], [210, 180], [120, 214], [180, 214]] };
const keep = [];
for (const m of MISSIONS) { keep.push([m.start[0], m.start[1], 8]); for (const k of ['turrets', 'uplinks', 'cores']) (m[k] || []).forEach(p => keep.push([p[0], p[1], 8])); }
SIEGE.spawns.forEach(p => keep.push([p[0], p[1], 6])); keep.push([150, 182, 8], [130, 180, 6], [170, 180, 6], [150, 120, 6]);
const W = buildCity(scene, { lite: LITE, keep });
const FX = createFX(scene, camera, renderer, { lite: LITE });

// ================================================================ collision (static grid + dynamic list)
const GC = 20, GO = -80, GN = 24, grid = []; for (let i = 0; i < GN * GN; i++) grid.push([]);
const gi = v => clamp(Math.floor((v - GO) / GC), 0, GN - 1);
for (const c of W.colliders) for (let i = gi(c.x0); i <= gi(c.x1); i++) for (let j = gi(c.z0); j <= gi(c.z1); j++) grid[i * GN + j].push(c);
const dyn = []; let stamp = 1;
function near(x0, z0, x1, z1, fn) { stamp++; for (let i = gi(Math.min(x0, x1)); i <= gi(Math.max(x0, x1)); i++) for (let j = gi(Math.min(z0, z1)); j <= gi(Math.max(z0, z1)); j++) for (const c of grid[i * GN + j]) { if (c._s === stamp) continue; c._s = stamp; if (fn(c)) return; } for (const c of dyn) if (fn(c)) return; }
function pushOut(p, r, yTop = 99) {
  near(p.x - r, p.z - r, p.x + r, p.z + r, c => {
    if (p.y >= c.h - 0.2) return;
    const x0 = c.x0 - r, x1 = c.x1 + r, z0 = c.z0 - r, z1 = c.z1 + r;
    if (p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1) { const a = p.x - x0, b = x1 - p.x, d = p.z - z0, e = z1 - p.z, m = Math.min(a, b, d, e); if (m === a) p.x = x0; else if (m === b) p.x = x1; else if (m === d) p.z = z0; else p.z = z1; }
  });
  p.x = clamp(p.x, MAP0, MAP1); p.z = clamp(p.z, MAP0, MAP1);
}
// first hit along segment a→b (fraction 0..1), including the ground
function segHit(a, b, coverToo = true, lotsOnly = false) {
  let best = 1; const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  if (dy < 0 && a.y > 0) best = Math.min(best, a.y / -dy); else if (a.y <= 0) return 0;
  near(a.x, a.z, b.x, b.z, c => {
    if (!coverToo && c.cover) return; if (lotsOnly && !c.lot) return;
    let t0 = 0, t1 = best;
    for (const [o, d, lo, hi] of [[a.x, dx, c.x0, c.x1], [a.y, dy, 0, c.h], [a.z, dz, c.z0, c.z1]]) {
      if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return; continue; }
      let u = (lo - o) / d, v = (hi - o) / d; if (u > v) [u, v] = [v, u]; t0 = Math.max(t0, u); t1 = Math.min(t1, v); if (t0 > t1) return;
    }
    if (t0 < best) best = t0;
  });
  return best;
}
const los = (a, b) => segHit(a, b) > 0.985;
const free = (x, z, r = 3) => { const p = V3(x, 0, z), q = p.clone(); pushOut(q, r); return q.distanceTo(p) < 0.01; };
function raySphere(o, d, c, r) { const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z, b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r, h = b * b - cc; if (h < 0) return -1; const t = -b - Math.sqrt(h); return t >= 0 ? t : (cc < 0 ? 0 : -1); }

// ================================================================ UI (kit cards restyled) + HUD
const ui = createUI({ title: 'IRONSQUALL', hint: 'Tap to deploy', hand: '' });
const D = daily('ironsquall', ui, { name: 'Ironsquall: Mech Shooter' });
const B = board({ game: 'ironsquall', label: 'Points', limits: { maxRun: 200000, maxPerSec: 450 }, mode: 'best', corner: 'tr', accent: '#ffd23f' });
const Fc = flow('ironsquall_c'), Fs = flow('ironsquall_s', { par: 20000, warmup: 6000 });
const ST = store('ironsquall');
document.body.insertAdjacentHTML('beforeend', `
<div id="hud" class="off">
  <div id="obj"><b id="mname">MISSION 1</b><span id="mobj">Destroy the drones</span><div class="bar"><i id="mprog"></i></div></div>
  <div id="hp"><div class="lbl">ARMOR</div><div class="bar"><i id="hpb"></i><s id="hpd"></s></div><em id="shi">🛡</em></div>
  <canvas id="radar" width="200" height="200"></canvas>
  <div id="score"><b id="sc">0</b><span id="sub">00:00</span></div>
  <div id="feed"></div>
  <div id="boss" class="off"><span>WEAVER · SPIDER-TANK</span><div class="bar"><i id="bossb"></i></div></div>
  <div id="ret"><i></i><i></i><i></i><i></i><b></b></div><div id="hm"></div>
  <div id="reload" class="off"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16"/><circle id="rlc" cx="20" cy="20" r="16"/></svg></div>
  <div id="banner"></div><div id="dmgdir"></div><div id="marks"></div>
  <div id="pad" class="${TOUCH ? '' : 'off'}">
    <button class="ab big" id="bFire"><span>🔥</span><small id="ammo1">48</small></button>
    <button class="ab" id="bRocket"><span>🚀</span><i></i></button>
    <button class="ab" id="bLaser"><span>⚡</span><i></i></button>
    <button class="ab" id="bShield"><span>🛡</span><i></i></button>
    <button class="ab sm" id="bDash"><span>💨</span><i></i></button>
    <button class="ab sm" id="bJump"><span>⤒</span></button>
    <button class="ab xs" id="bReload"><span>↻</span></button>
  </div>
  <div id="keys" class="${TOUCH ? 'off' : ''}">
    <div class="k" id="kAmmo"><b>CANNON</b><span id="ammo2">48 / 48</span><small>LMB · R</small></div>
    <div class="k" id="kRocket"><b>🚀 ROCKETS</b><i></i><small>Q</small></div>
    <div class="k" id="kLaser"><b>⚡ LANCE</b><i></i><small>E</small></div>
    <div class="k" id="kShield"><b>🛡 SHIELD</b><i></i><small>F</small></div>
    <div class="k" id="kDash"><b>💨 DASH</b><i></i><small>SHIFT</small></div>
  </div>
  <div id="stick" class="off"><i></i></div>
  <div id="lockhint" class="off">Click to aim with the mouse</div>
</div>
<div id="vig"></div><div id="flashw"></div>
<button id="mute" title="Sound">🔊</button>`);
const $ = id => document.getElementById(id);
// start card: brand, mission picker, siege
const startCard = ui.els.start;
startCard.classList.add('is-start');
startCard.querySelector('h1').insertAdjacentHTML('afterend', `<p class="gen">MECH SHOOTER</p>`);
startCard.querySelector('.hint').insertAdjacentHTML('beforebegin', `<div id="menu">
  <div id="mlist"></div>
  <div class="row"><button class="hc-btn alt" id="bSiege">⚔ SIEGE</button><button class="hc-btn alt2" id="bDaily">📅 DAILY SIEGE</button></div>
  <p id="ctrl">${TOUCH ? 'Left thumb: walk · Right thumb: aim · Buttons: fire &amp; abilities' : 'WASD walk · Mouse aim · Click fire · Q rockets · E lance · F shield · Shift dash · Space jump · R reload'}</p></div>`);
ui.els.win.querySelector('p').innerHTML = '<span data-l></span>';
ui.els.win.querySelector('h1').textContent = 'MISSION COMPLETE';
for (const el of startCard.querySelectorAll('#menu button')) el.addEventListener('pointerdown', e => e.stopPropagation());
function renderMenu() {
  const un = ST.get('unlocked', 1), cur = ST.get('mission', 1);
  $('mlist').innerHTML = MISSIONS.map((m, i) => `<button class="mch ${i + 1 === cur ? 'on' : ''} ${i + 1 > un ? 'lock' : ''}" data-m="${i + 1}"><b>${i + 1}</b><span>${i + 1 > un ? '🔒' : m.name}</span></button>`).join('');
  for (const b of $('mlist').querySelectorAll('button')) { b.addEventListener('pointerdown', e => e.stopPropagation()); b.onclick = e => { e.stopPropagation(); const m = +b.dataset.m; if (m > ST.get('unlocked', 1)) return; ST.set('mission', m); renderMenu(); begin('campaign', m); }; }
  startCard.querySelector('.hint').textContent = D.isDaily ? 'Tap to start today\'s Siege' : `Tap to deploy · Mission ${cur}: ${MISSIONS[cur - 1].name}`;
  const bs = ST.get('bestSiege', 0); $('bSiege').textContent = bs ? `⚔ SIEGE · best ${bs.toLocaleString()}` : '⚔ SIEGE';
}
$('bSiege').onclick = e => { e.stopPropagation(); begin('siege'); };
$('bDaily').onclick = e => { e.stopPropagation(); if (!D.isDaily) { location.search = '?daily=1'; return; } begin('siege'); };
let muted = ST.get('muted', false); $('mute').textContent = muted ? '🔇' : '🔊'; setMuted(muted);
$('mute').addEventListener('pointerdown', e => e.stopPropagation()); $('mute').onclick = e => { e.stopPropagation(); muted = !muted; ST.set('muted', muted); setMuted(muted); $('mute').textContent = muted ? '🔇' : '🔊'; };

// ================================================================ input
const keys = {}, IN = { mx: 0, mz: 0, fire: false, look: [0, 0] };
addEventListener('keydown', e => { keys[e.code] = true; if (G.state !== 'play') return; if (e.code === 'KeyR') reload(); if (e.code === 'KeyQ') fireRockets(); if (e.code === 'KeyE') fireLaser(); if (e.code === 'KeyF') raiseShield(); if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') dash(); if (e.code === 'Space') { jump(); e.preventDefault(); } });
addEventListener('keyup', e => { keys[e.code] = false; });
let locked = false, mouseDown = false;
document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === renderer.domElement; $('lockhint').classList.toggle('off', locked || TOUCH || G.state !== 'play'); });
renderer.domElement.addEventListener('mousedown', e => { initAudio(); if (TOUCH || G.state !== 'play') return; if (!locked) { try { renderer.domElement.requestPointerLock(); } catch (er) {} } if (e.button === 0) mouseDown = true; });
addEventListener('mouseup', e => { if (e.button === 0) mouseDown = false; });
addEventListener('mousemove', e => { if (TOUCH || G.state !== 'play') return; if (locked) { IN.look[0] += e.movementX; IN.look[1] += e.movementY; } else if (mouseDown) { IN.look[0] += e.movementX * 0.8; IN.look[1] += e.movementY * 0.8; } });
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('pointerdown', () => initAudio(), { capture: true });
// touch: left half = floating stick, right half = look; fire button also drags to aim
const touches = new Map();
const stickEl = $('stick');
renderer.domElement.addEventListener('pointerdown', e => {
  if (!TOUCH || G.state !== 'play' || e.pointerType === 'mouse') return;
  if (e.clientX < innerWidth * 0.45 && !touches.has('stick')) { touches.set(e.pointerId, { kind: 'stick', x: e.clientX, y: e.clientY }); touches.set('stick', 1); stickEl.classList.remove('off'); stickEl.style.left = e.clientX + 'px'; stickEl.style.top = e.clientY + 'px'; }
  else touches.set(e.pointerId, { kind: 'look', x: e.clientX, y: e.clientY });
});
addEventListener('pointermove', e => {
  const t = touches.get(e.pointerId); if (!t) return;
  if (t.kind === 'stick') { const dx = e.clientX - t.x, dy = e.clientY - t.y, l = Math.hypot(dx, dy), m = Math.min(1, l / 55); IN.mx = l ? dx / l * m : 0; IN.mz = l ? -dy / l * m : 0; stickEl.firstChild.style.transform = `translate(${IN.mx * 40}px,${-IN.mz * 40}px)`; }
  else { IN.look[0] += (e.clientX - t.x) * 1.5; IN.look[1] += (e.clientY - t.y) * 1.3; t.x = e.clientX; t.y = e.clientY; }
});
const endTouch = e => { const t = touches.get(e.pointerId); if (!t) return; if (t.kind === 'stick') { IN.mx = IN.mz = 0; touches.delete('stick'); stickEl.classList.add('off'); } if (t.kind === 'fire') IN.fire = false; touches.delete(e.pointerId); };
addEventListener('pointerup', endTouch); addEventListener('pointercancel', endTouch);
const bindBtn = (id, fn) => { const b = $(id); b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); initAudio(); fn(e); }); };
bindBtn('bFire', e => { IN.fire = true; touches.set(e.pointerId, { kind: 'fire', x: e.clientX, y: e.clientY }); });
addEventListener('pointermove', e => { const t = touches.get(e.pointerId); if (t && t.kind === 'fire') { IN.look[0] += (e.clientX - t.x) * 1.3; IN.look[1] += (e.clientY - t.y) * 1.1; t.x = e.clientX; t.y = e.clientY; } });
bindBtn('bRocket', () => fireRockets()); bindBtn('bLaser', () => fireLaser()); bindBtn('bShield', () => raiseShield()); bindBtn('bDash', () => dash()); bindBtn('bJump', () => jump()); bindBtn('bReload', () => reload());
for (const [id, fn] of [['kRocket', () => fireRockets()], ['kLaser', () => fireLaser()], ['kShield', () => raiseShield()], ['kDash', () => dash()], ['kAmmo', () => reload()]]) { const b = $(id); b.addEventListener('pointerdown', e => e.stopPropagation()); b.onclick = e => { e.stopPropagation(); fn(); }; }

// ================================================================ game state
const G = { state: 'ready', mode: 'campaign', mission: ST.get('mission', 1), score: 0, t: 0, runT: 0, kills: 0, wave: 0, combo: 0, comboT: 0, slow: 1, shake: 0, obj: null, beatenShown: false, recorded: false, rng: Math.random, boss: null, endT: 0 };
const P = { mech: buildMech('player'), pos: V3(), vel: V3(), vy: 0, yaw: Math.PI, pitch: 0.05, legYaw: Math.PI, hp: 1000, max: 1000, lastHurt: -9, ammo: 48, mag: 48, reloadT: 0, fireCD: 0, heat: 0, rocketCD: 0, laserCD: 0, laserT: 0, shieldCD: 0, shieldT: 0, dashCD: 0, dashT: 0, dashDir: V3(), alive: true, salvo: 0, salvoT: 0, lockT: null, stopLaser: null, onGround: true, stepT: 0 };
scene.add(P.mech.root);
const kD = () => (G.mode === 'siege' ? Fs.k(G.score) : Fc.k());   // enemy aggression multiplier (warm-up only on ranked boards)
const enemies = [], eShots = [], rockets = [];
const rocketMesh = (() => { const g = new GB(); g.cyl(0.18, 0.18, 1.2, 0, 0, 0, '#f4f1ea', { rx: Math.PI / 2, seg: 8 }); g.cyl(0.0, 0.18, 0.5, 0, 0, 0.85, '#ff4d6d', { rx: Math.PI / 2, seg: 8 }); for (let i = 0; i < 4; i++) g.box(0.04, 0.35, 0.3, 0, 0, -0.5, '#ffd23f', { rz: i * Math.PI / 2, r: 0, m: new THREE.Matrix4().makeTranslation(0, 0.2, 0).premultiply(new THREE.Matrix4().makeRotationZ(i * Math.PI / 2)) }); const m = new THREE.InstancedMesh(g.build(), mechMat({ map: false }), 48); m.frustumCulled = false; m.count = 0; return m; })();
scene.add(rocketMesh);
// drones: one instanced mesh + outline
const NDR = 40, dGeo = droneGeo(), droneIM = new THREE.InstancedMesh(dGeo, mechMat({ map: false }), NDR); droneIM.castShadow = true; droneIM.frustumCulled = false; scene.add(droneIM);
const droneCol = new THREE.Color('#ffffff'); for (let i = 0; i < NDR; i++) { droneIM.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0)); droneIM.setColorAt(i, droneCol); }
addOutline(droneIM, 0.06);
const droneSlots = Array.from({ length: NDR }, (_, i) => i);
// uplink zone visuals + objective markers
const markers = [];
function marker(get, label, col = '#ffd23f') { const el = document.createElement('div'); el.className = 'mk'; el.innerHTML = `<i style="border-color:${col}"></i><span>${label}</span>`; $('marks').appendChild(el); const m = { el, get, alive: true }; markers.push(m); return m; }
function clearMarkers() { markers.forEach(m => m.el.remove()); markers.length = 0; }

// ================================================================ enemies
const _v = V3(), _w = V3(), _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
function hurtFlash(e) { e.flash = 1; }
class Drone {
  constructor(p, kind = 'wasp') {
    this.type = 'drone'; this.kind = kind; this.pos = p.clone(); this.vel = V3(); this.hp = this.max = kind === 'swarm' ? 35 : 55; this.r = 2.0;
    this.slot = droneSlots.pop(); this.ang = G.rng() * 6.28; this.rad = 15 + G.rng() * 12; this.h = 5 + G.rng() * 8; this.orbit = (G.rng() < 0.5 ? -1 : 1) * (0.25 + G.rng() * 0.25);
    this.cd = 1 + G.rng() * 2; this.tele = 0; this.pts = kind === 'swarm' ? 120 : 100; this.flash = 0; this.yaw = 0; this.alive = this.slot != null; this.name = kind === 'swarm' ? 'SWARMER' : 'WASP DRONE';
  }
  spheres() { return [{ c: this.pos, r: this.r, m: 1 }]; }
  get center() { return this.pos; }
  update(dt) {
    const pp = _v.copy(P.pos).setY(P.pos.y + 3), d = this.pos.distanceTo(pp);
    let tgt;
    if (this.kind === 'swarm' && d < 40) tgt = pp;
    else { this.ang += this.orbit * dt; tgt = _w.set(P.pos.x + Math.cos(this.ang) * this.rad, P.pos.y + this.h, P.pos.z + Math.sin(this.ang) * this.rad); }
    const sp = this.kind === 'swarm' ? (d < 40 ? 21 : 14) : 11;
    const des = tgt.clone().sub(this.pos); const dl = des.length(); des.multiplyScalar(Math.min(1, dl / 6) * sp / Math.max(dl, 0.01));
    this.vel.lerp(des, Math.min(1, dt * 2.2));
    for (const o of enemies) if (o !== this && o.type === 'drone' && o.pos.distanceToSquared(this.pos) < 9) this.vel.add(_w.subVectors(this.pos, o.pos).normalize().multiplyScalar(dt * 30));
    this.pos.addScaledVector(this.vel, dt); this.pos.y = Math.max(2.2, this.pos.y);
    pushOut(this.pos, 1.5);
    this.yaw = Math.atan2(pp.x - this.pos.x, pp.z - this.pos.z);
    if (this.kind === 'swarm') { if (d < 3.6) { this.hp = 0; kill(this, true); explodeAt(this.pos, 6.5, 90, false); } return; }
    this.cd -= dt * kD();
    if (this.tele > 0) {
      this.tele -= dt; FX.orb(this.eye(), '#ff2d6a', 0.3 + (0.55 - this.tele) * 1.2);
      if (this.tele <= 0) { const lead = P.vel.clone().multiplyScalar(d / 45 * 0.6); const dir = pp.clone().add(lead).sub(this.pos).normalize(); dir.x += (G.rng() - 0.5) * 0.06; dir.y += (G.rng() - 0.5) * 0.04; eShoot(this.eye(), dir.normalize().multiplyScalar(45), 22, 'bolt'); SND.bolt(); }
    } else if (this.cd <= 0 && d < 60) { this.cd = 2.4 + G.rng() * 1.6; if (los(this.pos, pp)) this.tele = 0.55; }
  }
  eye() { return V3(Math.sin(this.yaw) * 0.8, 0, Math.cos(this.yaw) * 0.8).add(this.pos); }
  draw(t) {
    const tilt = this.vel.clone().multiplyScalar(0.03);
    _e.set(clamp(tilt.z * Math.cos(this.yaw) + tilt.x * Math.sin(this.yaw), -0.4, 0.4), this.yaw, 0, 'YXZ');
    _m4.compose(_w.copy(this.pos).setY(this.pos.y + Math.sin(t * 3 + this.ang) * 0.15), _q.setFromEuler(_e), V3(1, 1, 1).multiplyScalar(this.kind === 'swarm' ? 1.1 : 1.4));
    droneIM.setMatrixAt(this.slot, _m4); this.flash = Math.max(0, this.flash - 0.12);
    droneIM.setColorAt(this.slot, droneCol.set(this.kind === 'swarm' ? '#ff9a6a' : '#ffffff').lerp(new THREE.Color(4, 4, 4), this.flash));
  }
  remove() { droneIM.setMatrixAt(this.slot, _m4.makeScale(0, 0, 0)); droneSlots.push(this.slot); }
}
class Turret {
  constructor(x, z) {
    this.type = 'turret'; this.T = buildTurret(); this.T.root.position.set(x, 0, z); this.T.root.scale.setScalar(1.35); scene.add(this.T.root); this.pos = V3(x, 0, z); this.hp = this.max = 520; this.pts = 300; this.name = 'BASTION TURRET';
    this.cd = 1.5 + G.rng() * 2; this.tele = 0; this.burst = 0; this.bt = 0; this.yaw = 0; this.pitch = 0; this.alive = true; this.flash = 0;
    this.col = { x0: x - 2.3, z0: z - 2.3, x1: x + 2.3, z1: z + 2.3, h: 4.4 }; dyn.push(this.col);
  }
  get center() { return V3(this.pos.x, 3.5, this.pos.z); }
  spheres() { return [{ c: V3(this.pos.x, 3.6, this.pos.z), r: 2.5, m: 1 }, { c: V3(this.pos.x, 1.3, this.pos.z), r: 2.5, m: 0.8 }]; }
  update(dt) {
    const pp = _v.copy(P.pos).setY(P.pos.y + 3), c = this.center, d = c.distanceTo(pp);
    const ty = Math.atan2(pp.x - c.x, pp.z - c.z), tp = Math.atan2(pp.y - c.y, Math.hypot(pp.x - c.x, pp.z - c.z));
    const turn = (this.tele > 0 || this.burst > 0 ? 0.9 : 2) * dt;
    this.yaw += clamp(angDiff(this.yaw, ty), -turn, turn); this.pitch += clamp(tp - this.pitch, -turn, turn);
    this.T.head.rotation.set(-this.pitch, this.yaw, 0, 'YXZ');
    this.cd -= dt * kD();
    if (this.burst > 0) { this.bt -= dt; if (this.bt <= 0) { this.bt = 0.11; this.burst--; const tip = this.T.tip.getWorldPosition(V3()), dir = V3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch)); dir.x += (G.rng() - 0.5) * 0.05; dir.y += (G.rng() - 0.5) * 0.03; eShoot(tip, dir.normalize().multiplyScalar(70), 17, 'shell'); FX.muzzle(tip, dir, '#ff6a9a', 0.9); SND.bolt(); } }
    else if (this.tele > 0) { this.tele -= dt; G.sights.push([this.T.tip.getWorldPosition(V3()), pp.clone(), this.tele]); if (Math.floor(this.tele * 8) !== Math.floor((this.tele + dt) * 8)) SND.beep(); if (this.tele <= 0) this.burst = 5; }
    else if (this.cd <= 0 && d < 75) { this.cd = 3.2 + G.rng() * 1.5; if (los(c, pp)) this.tele = 1.0; }
    this.flash = Math.max(0, this.flash - dt * 6); this.T.mat.userData.uFlash.value = this.flash;
  }
  remove() { scene.remove(this.T.root); dyn.splice(dyn.indexOf(this.col), 1); }
}
class Raptor {
  constructor(x, z) {
    this.type = 'mech'; this.M = buildMech('raptor'); this.M.root.scale.setScalar(0.92); this.pos = V3(x, 0, z); this.M.root.position.copy(this.pos); scene.add(this.M.root);
    this.hp = this.max = 1100; this.pts = 750; this.name = 'HEXWIRE RAPTOR'; this.goal = this.pos.clone(); this.vel = V3(); this.yaw = 0; this.legYaw = 0; this.alive = true; this.flash = 0;
    this.think = 0; this.cd = 2 + G.rng() * 2; this.tele = 0; this.burst = 0; this.bt = 0; this.rk = 6 + G.rng() * 4; this.side = 1; this.drop = 0;
  }
  get center() { return V3(this.pos.x, this.pos.y + 4.4, this.pos.z); }
  spheres() { return [{ c: V3(this.pos.x, this.pos.y + 4.6, this.pos.z), r: 2.2, m: 1.15 }, { c: V3(this.pos.x, this.pos.y + 2.6, this.pos.z), r: 1.7, m: 1 }, { c: V3(this.pos.x, this.pos.y + 1.0, this.pos.z), r: 1.4, m: 0.8 }]; }
  pickGoal() {
    // prefer a spot 20–34 m from the player, behind cover, off the player's aim line (flank)
    let best = null, bs = -1e9;
    for (let k = 0; k < 14; k++) {
      const a = G.rng() * 6.28, r = 20 + G.rng() * 14, x = P.pos.x + Math.cos(a) * r, z = P.pos.z + Math.sin(a) * r;
      if (!free(x, z, 2.4)) continue;
      const p = V3(x, 4, z); let s = -Math.abs(p.distanceTo(this.pos) - 12) * 0.2;
      if (!los(p, _v.copy(P.pos).setY(4))) s += 6;                                  // hidden behind something
      const aimA = Math.abs(angDiff(P.yaw, Math.atan2(x - P.pos.x, z - P.pos.z))); s += aimA * 1.8;   // flank
      for (const o of enemies) if (o !== this && o.type === 'mech') s -= Math.max(0, 14 - o.pos.distanceTo(p)) * 0.6;
      if (s > bs) { bs = s; best = p.setY(0); }
    }
    if (best) this.goal = best;
  }
  update(dt, t) {
    if (this.drop > 0) { this.drop -= dt; this.pos.y = Math.max(0, this.drop * 30); if (this.pos.y === 0 && !this.landed) { this.landed = 1; FX.dust(this.pos, 3); SND.land(); G.shake += 0.3; } this.M.root.position.copy(this.pos); return; }
    const pp = _v.copy(P.pos).setY(P.pos.y + 3), c = this.center, d = c.distanceTo(pp);
    this.think -= dt; if (this.think <= 0) { this.think = 3.5 + G.rng() * 3; this.pickGoal(); }
    const to = this.goal.clone().sub(this.pos).setY(0), dl = to.length();
    const des = dl > 1.5 ? to.multiplyScalar(6.5 / dl) : V3();
    this.vel.lerp(des, Math.min(1, dt * 3)); this.pos.addScaledVector(this.vel, dt); pushOut(this.pos, 2.0);
    for (const o of enemies) if (o !== this && o.type === 'mech' && o.pos.distanceTo(this.pos) < 5) this.pos.add(_w.subVectors(this.pos, o.pos).setY(0).normalize().multiplyScalar(dt * 4));
    this.yaw += clamp(angDiff(this.yaw, Math.atan2(pp.x - this.pos.x, pp.z - this.pos.z)), -3 * dt, 3 * dt);
    const sp = this.vel.length(); if (sp > 0.5) this.legYaw += clamp(angDiff(this.legYaw, Math.atan2(this.vel.x, this.vel.z)), -4 * dt, 4 * dt);
    const lf = Math.cos(angDiff(this.legYaw, Math.atan2(this.vel.x, this.vel.z))) * sp;
    if (this.M.animate(dt, lf, 0, t)) { FX.dust(this.pos, 1.2); if (d < 50) SND.step(0.5); }
    this.M.root.position.copy(this.pos); this.M.root.rotation.y = this.legYaw; this.M.torso.rotation.y = angDiff(this.legYaw, this.yaw);
    this.cd -= dt * kD(); this.rk -= dt * kD();
    if (this.burst > 0) { this.bt -= dt; if (this.bt <= 0) { this.bt = 0.1; this.burst--; const tip = (this.burst % 2 ? this.M.tips.gun : this.M.tips.gun2).getWorldPosition(V3()); const dir = pp.clone().add(P.vel.clone().multiplyScalar(0.25)).sub(tip).normalize(); dir.x += (G.rng() - 0.5) * 0.07; dir.y += (G.rng() - 0.5) * 0.04; eShoot(tip, dir.normalize().multiplyScalar(62), 15, 'shell'); FX.muzzle(tip, dir, '#ff6a9a', 1); SND.bolt(); this.M.recoil = 1; } }
    else if (this.tele > 0) { this.tele -= dt; G.sights.push([this.M.tips.gun.getWorldPosition(V3()), pp.clone(), this.tele]); if (this.tele <= 0) this.burst = 6; }
    else if (this.cd <= 0 && d < 70) { this.cd = 2.6 + G.rng() * 1.6; if (los(c, pp)) this.tele = 0.6; }
    if (this.rk <= 0 && d < 70 && this.burst === 0) { this.rk = 9 + G.rng() * 4; const tip = this.M.tips.rocket.getWorldPosition(V3()); for (let i = 0; i < 3; i++) setTimeout(() => { if (!this.alive || G.state !== 'play') return; const dir = V3((G.rng() - 0.5) * 0.6, 1, (G.rng() - 0.5) * 0.6).normalize(); eMissile(tip.clone(), dir.multiplyScalar(18), P.pos.clone().add(V3((G.rng() - 0.5) * 6, 0, (G.rng() - 0.5) * 6)), 45); SND.rocket(); }, i * 160); }
    this.flash = Math.max(0, this.flash - dt * 6); this.M.flash(this.flash);
  }
  remove() { scene.remove(this.M.root); }
}
class Core {
  constructor(x, z) { this.type = 'core'; this.K = buildCore(); this.K.root.position.set(x, 0, z); scene.add(this.K.root); this.pos = V3(x, 0, z); this.hp = this.max = 1500; this.pts = 500; this.name = 'POWER CORE'; this.alive = true; this.flash = 0; this.col = { x0: x - 3, z0: z - 3, x1: x + 3, z1: z + 3, h: 8 }; dyn.push(this.col); }
  get center() { return V3(this.pos.x, 4.2, this.pos.z); }
  spheres() { return [{ c: this.center, r: 2.6, m: 1 }]; }
  update(dt, t) { this.K.ring.rotation.y = t * 1.5; this.K.ring.rotation.x = Math.sin(t) * 0.4; if (Math.random() < dt * 6) FX.orb(this.center.add(V3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 2)), '#ff60ff', 0.5); this.flash = Math.max(0, this.flash - dt * 6); this.K.mat.userData.uFlash.value = this.flash; }
  remove() { scene.remove(this.K.root); dyn.splice(dyn.indexOf(this.col), 1); }
}
class Boss {
  constructor(x, z, hp = 14000) {
    this.type = 'boss'; this.W = buildBoss(); scene.add(this.W.root); for (const L of this.W.legs) scene.add(L.f, L.t);
    this.pos = V3(x, 0, z); this.yaw = 0; this.hp = this.max = hp; this.pts = 6000; this.name = 'WEAVER'; this.alive = true; this.flash = 0;
    this.st = 'enter'; this.stT = 2.2; this.atk = 0; this.vel = V3(); this.sweep = null; this.drop = 2.2;
    this.W.root.position.copy(this.pos); this.W.root.updateMatrixWorld(true);
    for (const L of this.W.legs) { L.foot.copy(L.rest).applyMatrix4(this.W.root.matrixWorld); L.from.copy(L.foot); L.to.copy(L.foot); L.k = 1; }
  }
  get center() { return this.W.body.getWorldPosition(V3()); }
  spheres() { const b = this.W.body, w = (x, y, z) => V3(x, y, z).applyMatrix4(b.matrixWorld); return [{ c: this.W.tips.core.getWorldPosition(V3()), r: 1.9, m: 2.2, weak: true }, { c: w(0, 0.3, 0.5), r: 5.6, m: 1 }, { c: w(0, 0, 5.6), r: 3.4, m: 1 }, { c: w(0, 0.6, -6), r: 4, m: 1 }]; }
  update(dt, t) {
    const W = this.W, pp = _v.copy(P.pos).setY(P.pos.y + 3), phase2 = this.hp < this.max * 0.55;
    // walk: keep ~30 m from the player, inside the plaza district
    if (this.st !== 'enter') {
      const away = this.pos.clone().sub(P.pos).setY(0); const dl = away.length() || 1; const goal = P.pos.clone().add(away.multiplyScalar(30 / dl));
      goal.x = clamp(goal.x, 100, 200); goal.z = clamp(goal.z, 95, 205);
      const to = goal.sub(this.pos).setY(0), tl = to.length(); this.vel.lerp(tl > 2 ? to.multiplyScalar((phase2 ? 5.5 : 4) / tl) : V3(), dt * 1.5); this.pos.addScaledVector(this.vel, dt);
    }
    this.yaw += clamp(angDiff(this.yaw, Math.atan2(P.pos.x - this.pos.x, P.pos.z - this.pos.z)), -0.6 * dt, 0.6 * dt);
    W.root.position.copy(this.pos); W.root.rotation.y = this.yaw;
    W.body.position.y = (this.drop > 0 ? this.drop * 22 : 0) + 7.2 + Math.sin(t * 1.6) * 0.25; W.body.rotation.z = Math.sin(t * 0.8) * 0.03;
    if (this.drop > 0) { this.drop -= dt; if (this.drop <= 0) { G.shake += 1.2; SND.thud(); FX.dust(this.pos, 8); FX.ring(this.pos, 30, '#ffffff', 0.6); } }
    W.root.updateMatrixWorld(true);
    W.turret.rotation.y = clamp(angDiff(this.yaw, Math.atan2(P.pos.x - this.pos.x, P.pos.z - this.pos.z)), -1.2, 1.2);
    // legs: tetrapod gait + 2-bone IK
    const hipL = V3(), K = V3(), up = V3(0, 1, 0);
    for (const L of W.legs) {
      const want = L.rest.clone().applyMatrix4(W.root.matrixWorld).setY(0);
      if (L.k >= 1 && want.distanceTo(L.foot) > 5.5 && !W.legs.some(o => o.group === L.group && o !== L && o.k < 1 && false) && W.legs.filter(o => o.k < 1).every(o => o.group === L.group)) { L.from.copy(L.foot); L.to.copy(want).add(this.vel.clone().multiplyScalar(0.6)); L.k = 0; }
      if (L.k < 1) { L.k = Math.min(1, L.k + dt / 0.38); L.foot.lerpVectors(L.from, L.to, L.k); L.foot.y = Math.sin(L.k * Math.PI) * 3; if (L.k >= 1) { L.foot.y = 0; if (P.pos.distanceTo(L.foot) < 60) { SND.step(1); G.shake += 0.12; } FX.dust(L.foot, 1.4); } }
      hipL.set(L.s * 4.6, -0.2, 3.6 - L.i * 2.4).applyMatrix4(W.body.matrixWorld);
      const dv = L.foot.clone().sub(hipL), dist = clamp(dv.length(), 2, 6.4 + 8.2 - 0.05), u = dv.normalize();
      const a = Math.acos(clamp((6.4 * 6.4 + dist * dist - 8.2 * 8.2) / (2 * 6.4 * dist), -1, 1));
      const wv = up.clone().sub(u.clone().multiplyScalar(up.dot(u))).normalize();
      K.copy(hipL).addScaledVector(u, Math.cos(a) * 6.4).addScaledVector(wv, Math.sin(a) * 6.4);
      L.f.position.copy(hipL); L.f.lookAt(K); L.t.position.copy(K); L.t.lookAt(L.foot); L.t.scale.z = K.distanceTo(L.foot) / 8.2;
    }
    if (this.st === 'enter') { this.stT -= dt; if (this.stT <= 0) { this.st = 'idle'; this.stT = 1.5; } return; }
    // attacks
    this.stT -= dt * (phase2 ? 1.3 : 1) * kD();
    if (this.st === 'idle' && this.stT <= 0) {
      const opts = ['volley', 'rain', 'sweep']; if (phase2) opts.push('drones');
      this.st = opts[this.atk++ % opts.length]; this.stT = { volley: 1.6, rain: 2.6, sweep: 3.4, drones: 1.0 }[this.st]; this.fired = 0;
      if (this.st === 'sweep') { const base = Math.atan2(P.pos.x - this.pos.x, P.pos.z - this.pos.z), dir = G.rng() < 0.5 ? 1 : -1; this.sweep = { a0: base - dir * 0.75, a1: base + dir * 0.75, t: 0 }; SND.alarm(); }
      if (this.st === 'rain') { SND.alarm(); this.rainPts = []; for (let i = 0; i < (phase2 ? 12 : 9); i++) { const a = G.rng() * 6.28, r = i === 0 ? 0 : 4 + G.rng() * 14; this.rainPts.push(V3(P.pos.x + Math.cos(a) * r + P.vel.x * 0.8, 0, P.pos.z + Math.sin(a) * r + P.vel.z * 0.8)); } this.rainPts.forEach(p => G.warn.push({ p, t: 1.6 })); }
    }
    const tips = W.tips;
    if (this.st === 'volley') { G.sights.push([tips.cannon[0].getWorldPosition(V3()), pp.clone(), this.stT - 0.6]); if (this.stT < 0.6 && !this.fired) { this.fired = 1; for (let i = 0; i < (phase2 ? 10 : 8); i++) { const tip = tips.cannon[i % 2].getWorldPosition(V3()), dir = pp.clone().sub(tip).normalize(), sp = (i - 3.5) * 0.06; dir.applyAxisAngle(up, sp); eShoot(tip, dir.multiplyScalar(48), 32, 'heavy'); FX.muzzle(tip, dir, '#ff4dc4', 2); } SND.boom(0.6); G.shake += 0.3; } }
    if (this.st === 'rain' && this.stT < 2.0 && !this.fired) { this.fired = 1; const from = this.center.add(V3(0, 4, 0)); this.rainPts.forEach((p, i) => setTimeout(() => { if (this.alive && G.state === 'play') { eMissile(from.clone(), V3((G.rng() - 0.5) * 8, 26, (G.rng() - 0.5) * 8), p, 70, 1.3); SND.rocket(); } }, i * 60)); }
    if (this.st === 'sweep' && this.sweep) {
      const s = this.sweep; s.t += dt; const tip = tips.laser.getWorldPosition(V3());
      const k = clamp((s.t - 1.0) / 2.2, 0, 1), a = lerp(s.a0, s.a1, k), end = V3(this.pos.x + Math.sin(a) * 75, 1.0, this.pos.z + Math.cos(a) * 75);
      if (s.t < 1.0) G.sights.push([tip, V3(this.pos.x + Math.sin(s.a0) * 75, 1.0, this.pos.z + Math.cos(s.a0) * 75), 1 - s.t]);
      else if (k < 1) {
        FX.setBeam(1, tip, end, 0.9, '#ff3ad6', 1, G.t); FX.light(end.clone().lerp(tip, 0.7), '#ff3ad6', 20, 20);
        // damage: distance from the player's legs to the beam's ground line
        const seg = end.clone().sub(tip), tt = clamp(P.pos.clone().setY(1).sub(tip).dot(seg) / seg.lengthSq(), 0, 1), cp = tip.clone().addScaledVector(seg, tt);
        if (cp.distanceTo(P.pos.clone().setY(clamp(cp.y, P.pos.y, P.pos.y + 5))) < 2.6) hurt(340 * dt, tip, 'beam');
        if (Math.random() < 0.5) FX.sparks(end.clone().lerp(tip, 0.02), 2, '#ff8ae8', 12);
      } else { FX.setBeam(1, tip, end, 0, '#fff', 0); this.sweep = null; }
    }
    if (this.st === 'drones' && !this.fired) { this.fired = 1; for (let i = 0; i < 4; i++) spawn(new Drone(this.center.add(V3((G.rng() - 0.5) * 6, 4, (G.rng() - 0.5) * 6)), i % 2 ? 'swarm' : 'wasp')); }
    if (this.stT <= 0 && this.st !== 'idle') { this.st = 'idle'; this.stT = phase2 ? 1.6 : 2.4; FX.setBeam(1, V3(), V3(), 0, '#fff', 0); }
    if (Math.random() < dt * 8) FX.orb(tips.core.getWorldPosition(V3()), '#ffb02a', 0.8 + (phase2 ? 0.6 : 0));
    this.flash = Math.max(0, this.flash - dt * 6); W.mat.userData.uFlash.value = this.flash;
  }
  remove() { scene.remove(this.W.root); for (const L of this.W.legs) scene.remove(L.f, L.t); FX.setBeam(1, V3(), V3(), 0, '#fff', 0); }
}
function spawn(e) { if (e.type === 'drone' && !e.alive) return null; enemies.push(e); return e; }
function eShoot(p, v, dmg, kind) { eShots.push({ p: p.clone(), v, dmg, kind, life: 3 }); }
function eMissile(p, v, target, dmg, T = 0) { rockets.push({ p, v, target, dmg, enemy: true, life: 6, t: 0, T, from: p.clone(), arc: T > 0 }); }
function clearEnemies() { for (const e of enemies) e.remove(); enemies.length = 0; eShots.length = 0; rockets.length = 0; G.boss = null; $('boss').classList.add('off'); }

// ================================================================ damage, kills, score
function hitEnemy(e, dmg, at, mult = 1) {
  if (!e.alive) return;
  e.hp -= dmg * mult; e.flash = Math.max(e.flash || 0, e.type === "boss" ? 0.25 : e.type === "drone" ? 0.8 : 0.45);
  if (e.hp <= 0) kill(e); else { hitMarker(false); }
}
function kill(e, quiet) {
  if (!e.alive) return; e.alive = false;
  const i = enemies.indexOf(e); if (i >= 0) enemies.splice(i, 1);
  const c = e.center.clone(), big = e.type === 'boss' ? 3 : e.type === 'mech' ? 1.8 : e.type === 'turret' || e.type === 'core' ? 1.5 : 0.9;
  if (e.type === 'boss') { for (let k = 0; k < 6; k++) setTimeout(() => { FX.explode(c.clone().add(V3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 12)), 2); SND.boom(1.5); G.shake += 0.6; }, k * 220); }
  FX.explode(c, big, e.type === 'core' ? '#ff60ff' : '#ff8a1a'); FX.debris(c, (big * 6) | 0, e.type === 'drone' ? '#9a5cff' : '#8a4dff', 16 * big, 0.5 * big);
  e.remove(); SND[big > 1.2 ? 'boom' : 'small'](big); G.shake += 0.15 * big; buzz(big > 1.2 ? 40 : 15);
  if (quiet) return;
  G.kills++; G.combo = G.comboT > 0 ? G.combo + 1 : 1; G.comboT = 2.6;
  const bonus = G.combo > 1 ? 50 * (G.combo - 1) : 0; addScore(e.pts + bonus);
  feed(`+${e.pts + bonus} ${e.name}`);
  if (G.combo >= 2) ui.pop(['', '', 'DOUBLE KILL', 'TRIPLE KILL', 'RAMPAGE', 'UNSTOPPABLE'][Math.min(5, G.combo)], '#ffd23f', 30, 24);
  hitMarker(true); SND.kill();
  G.onKill && G.onKill(e);
}
function addScore(n) { G.score += n; $('sc').textContent = G.score.toLocaleString(); if (!G.beatenShown && D.beaten(G.score)) { G.beatenShown = true; ui.pop('BEATEN!', '#ffd23f', 44, 30); } }
function explodeAt(p, r, dmg, byPlayer) {
  FX.explode(p, r / 6, byPlayer ? '#ff8a1a' : '#ff4dc4'); SND.boom(r / 6); G.shake += r / 14;
  if (byPlayer) { for (const e of [...enemies]) for (const s of e.spheres()) { const d = s.c.distanceTo(p) - s.r; if (d < r) { hitEnemy(e, dmg * (1 - Math.max(0, d) / r * 0.6), p, s.m > 1.5 ? 1.5 : 1); break; } } }
  else { const d = P.pos.clone().setY(P.pos.y + 2.5).distanceTo(p); if (d < r + 1.5) hurt(dmg * (1 - Math.max(0, d - 1.5) / r * 0.5), p, 'splash'); }
}
let hmT = 0, hsT = 0; function hitMarker(k) { const h = $('hm'); h.className = k ? 'kill on' : 'on'; hmT = k ? 0.35 : 0.12; if (!k && G.t - hsT > 0.07) { hsT = G.t; SND.hit(); } }
function feed(t) { const f = $('feed'), d = document.createElement('div'); d.textContent = t; f.prepend(d); setTimeout(() => d.remove(), 2200); while (f.children.length > 4) f.lastChild.remove(); }
function banner(t, s = '', ms = 2200) { const b = $('banner'); b.innerHTML = `<b>${t}</b>${s ? `<span>${s}</span>` : ''}`; b.className = 'on'; clearTimeout(banner.t); banner.t = setTimeout(() => b.className = '', ms); }
function hurt(dmg, from, kind) {
  if (!P.alive || G.state !== 'play') return;
  if (P.dashT > 0) return;
  if (P.shieldT > 0) { FX.shield.material.uniforms.uHit.value = 1; SND.shieldHit(); return; }
  dmg *= G.mode === 'siege' ? Math.min(1.35, Fs.k(G.score)) : Fc.k();
  P.hp -= dmg; P.lastHurt = G.t; G.hurtA = Math.min(1, (G.hurtA || 0) + dmg / 120); G.shake += Math.min(0.5, dmg / 120);
  if (kind !== 'beam' || Math.random() < 0.1) SND.hurt(); buzz(20);
  if (from) { const a = Math.atan2(from.x - P.pos.x, from.z - P.pos.z), rel = angDiff(P.yaw, a); const dd = $('dmgdir'); dd.style.transform = `translate(-50%,-50%) rotate(${-rel}rad)`; dd.style.opacity = 1; G.ddT = 0.8; }
  if (P.hp <= 0) die();
}

// ================================================================ player abilities
function reload() { if (P.reloadT > 0 || P.ammo === P.mag || !P.alive) return; P.reloadT = 1.6; SND.reload(); $('reload').classList.remove('off'); }
function fireRockets() { if (P.rocketCD > 0 || !P.alive || G.state !== 'play') return; P.rocketCD = 7; P.salvo = 6; P.salvoT = 0; P.lockT = aimTarget(0.3); }
function fireLaser() { if (P.laserCD > 0 || !P.alive || G.state !== 'play') return; P.laserCD = 11; P.laserT = 1.7; P.stopLaser = laserLoop(); }
function raiseShield() { if (P.shieldCD > 0 || !P.alive || G.state !== 'play') return; P.shieldCD = 14; P.shieldT = 4.5; SND.shield(); }
function dash() { if (P.dashCD > 0 || !P.alive || G.state !== 'play') return; P.dashCD = 2.2; P.dashT = 0.24; const f = V3(Math.sin(P.yaw), 0, Math.cos(P.yaw)), r = V3(-Math.cos(P.yaw), 0, Math.sin(P.yaw)); const m = moveInput(); P.dashDir.copy(Math.hypot(m[0], m[1]) > 0.2 ? f.multiplyScalar(m[1]).add(r.multiplyScalar(m[0])).normalize() : f); SND.dash(); for (let i = 0; i < 6; i++) FX.puff(P.pos.clone().add(V3(0, 2 + i * 0.4, 0)), 1.2); }
function jump() { if (!P.onGround || !P.alive || G.state !== 'play') return; P.vy = 15; P.onGround = false; SND.jump(); FX.dust(P.pos, 2); }
function moveInput() {
  let x = IN.mx, z = IN.mz;
  if (keys.KeyA || keys.ArrowLeft) x -= 1; if (keys.KeyD || keys.ArrowRight) x += 1; if (keys.KeyW || keys.ArrowUp) z += 1; if (keys.KeyS || keys.ArrowDown) z -= 1;
  if (BOT.until > G.t) { x = BOT.mx; z = BOT.mz; }
  const l = Math.hypot(x, z); if (l > 1) { x /= l; z /= l; } return [x, z];
}
// camera ray → first thing it hits (enemy or world)
const camF = V3(), camR = V3();
function aimRay(range = 400) {
  const o = camera.position.clone(), d = camF.clone();
  const end = o.clone().addScaledVector(d, range), t = segHit(o, end, false); let best = t * range, hitE = null, hitS = null;
  for (const e of enemies) for (const s of e.spheres()) { const tt = raySphere(o, d, s.c, s.r); if (tt >= 0 && tt < best) { best = tt; hitE = e; hitS = s; } }
  return { p: o.addScaledVector(d, best), e: hitE, s: hitS, dist: best };
}
// enemy nearest the crosshair inside a cone (aim assist, rocket lock)
function aimTarget(cone = 0.12) {
  let best = null, ba = cone;
  for (const e of enemies) { const c = e.center; const v = c.clone().sub(camera.position), dist = v.length(); v.normalize(); const a = Math.acos(clamp(v.dot(camF), -1, 1)); if (a < ba && dist < 160 && los(camera.position, c)) { ba = a; best = e; } }
  return best;
}
function shootCannon() {
  const tip = P.mech.tips.gun.getWorldPosition(V3());
  let A = aimRay();
  if (TOUCH || BOT.until > G.t) { const tg = aimTarget(0.075); if (tg) { const s = tg.spheres()[0]; A = { p: s.c.clone(), e: tg, s, dist: s.c.distanceTo(camera.position) }; } }
  const dir = A.p.clone().sub(tip).normalize(), spread = 0.012 + P.heat * 0.025;
  dir.x += (Math.random() - 0.5) * spread; dir.y += (Math.random() - 0.5) * spread; dir.z += (Math.random() - 0.5) * spread; dir.normalize();
  const end = tip.clone().addScaledVector(dir, 300), t = segHit(tip, end, true); let dist = t * 300, he = null, hs = null;
  for (const e of enemies) for (const s of e.spheres()) { const tt = raySphere(tip, dir, s.c, s.r); if (tt >= 0 && tt < dist) { dist = tt; he = e; hs = s; } }
  const hp = tip.clone().addScaledVector(dir, dist);
  FX.streak(tip.clone().addScaledVector(dir, 1.5), dir.clone().multiplyScalar(320), Math.min(7, dist * 0.5), 0.13, '#ffe066', Math.max(0.02, dist / 320));
  FX.muzzle(tip, dir, '#ffd23f', 1); if (Math.random() < 0.5) FX.light(tip, '#ffcf6a', 14, 22);
  setTimeout(() => { if (he) { hitEnemy(he, 13, hp, hs.m); FX.hit(hp, hs.weak ? '#ffb02a' : '#ffd23f'); } else if (t < 1) { FX.hit(hp, '#ffe8b0'); if (hp.y < 0.3 && Math.random() < 0.3) FX.decal(hp, 0.9); } }, dist / 320 * 1000);
  SND.cannon(); P.mech.recoil = 1; P.heat = Math.min(1, P.heat + 0.08); G.shake += 0.025; P.pitch += 0.0025;
  P.ammo--; if (P.ammo <= 0) reload();
}

// ================================================================ missions + siege director
const uplinkGroups = [];
function uplinkVisual(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const ring = new THREE.Mesh(new THREE.RingGeometry(6.4, 7, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color('#2be8ff').multiplyScalar(1.6), transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; g.add(ring);
  const fillM = new THREE.Mesh(new THREE.CircleGeometry(6.4, 64), new THREE.MeshBasicMaterial({ color: '#2be8ff', transparent: true, opacity: 0.18, depthWrite: false })); fillM.rotation.x = -Math.PI / 2; fillM.position.y = 0.07; g.add(fillM);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(6.6, 6.6, 60, 40, 1, true), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uA: { value: 0.5 } }, vertexShader: 'varying vec2 vU; varying float vF, vD; void main(){ vU = uv; vec4 mv = modelViewMatrix * vec4(position, 1.); vD = -mv.z; vec3 n = normalize(normalMatrix * normal); vF = 1. - abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }', fragmentShader: 'uniform float uA; varying vec2 vU; varying float vF, vD; void main(){ gl_FragColor = vec4(vec3(.2, .9, 1.) * pow(1. - vU.y, 2.) * uA * (pow(vF, 3.) * .9 + .06) * smoothstep(6., 22., vD), 1.); }' }));
  col.position.y = 30; g.add(col);
  const pyl = new GB(); pyl.box(1.4, 3, 1.4, 0, 1.5, 0, '#3a86ff', { r: 0.3 }); pyl.cyl(0.15, 0.15, 3, 0, 4.5, 0, '#e8f0ff'); pyl.sph(0.5, 0, 6.2, 0, '#2be8ff', { e: 3 }); const pm = pyl.mesh(mechMat({ map: false })); addOutline(pm, 0.06); g.add(pm);
  scene.add(g); uplinkGroups.push(g); return { g, ring, fillM, col };
}
function clearUplinks() { uplinkGroups.forEach(g => scene.remove(g)); uplinkGroups.length = 0; }
const airSpawn = (x, z, h = 16) => V3(x + (G.rng() - 0.5) * 10, h + G.rng() * 6, z + (G.rng() - 0.5) * 10);
function droneWave(n, x, z, swarm = 0) { for (let i = 0; i < n; i++) spawn(new Drone(airSpawn(x, z), i < swarm ? 'swarm' : 'wasp')); }
function dropRaptor(x, z) { const r = new Raptor(x, z); r.drop = 1.2; r.pos.y = 36; spawn(r); FX.ring(V3(x, 0.2, z), 8, '#ff2d6a', 1.2); return r; }
function setObjective(text, prog) { $('mobj').textContent = text; $('mprog').style.width = clamp(prog, 0, 1) * 100 + '%'; }

function setupMission(m) {
  const M = MISSIONS[m - 1], O = { m, done: false, t: 0 }; G.obj = O; G.rng = Math.random;
  $('mname').textContent = `MISSION ${m} · ${M.name}`;
  if (m === 1) {
    O.goal = 10; O.n = 0; O.wave = 0; droneWave(4, 120, 245);
    G.onKill = e => { if (e.type === 'drone') O.n++; };
    O.update = () => { if (enemies.length <= 1 && O.n < O.goal) { O.wave++; droneWave(O.wave === 1 ? 3 : 4, 120, P.pos.z - 40, O.wave >= 2 ? 2 : 0); banner(`WAVE ${O.wave + 1}`, 'More drones inbound', 1400); } setObjective(`Destroy drones ${O.n}/${O.goal}`, O.n / O.goal); return O.n >= O.goal; };
  }
  if (m === 2) {
    O.goal = 4; O.n = 0; for (const [x, z] of M.turrets) { const t = spawn(new Turret(x, z)); marker(() => t.alive ? t.center.add(V3(0, 3, 0)) : null, 'TURRET', '#ff4d6d'); }
    droneWave(3, 60, 240); O.dt = 12;
    G.onKill = e => { if (e.type === 'turret') O.n++; };
    O.update = (dt) => { O.dt -= dt; if (O.dt <= 0 && enemies.filter(e => e.type === 'drone').length < 3) { O.dt = 14; droneWave(3, 60, P.pos.z - 50, 1); } setObjective(`Destroy turrets ${O.n}/${O.goal}`, O.n / O.goal); return O.n >= O.goal; };
  }
  if (m === 3) {
    O.i = 0; O.hold = 0; O.vis = M.uplinks.map(([x, z]) => uplinkVisual(x, z)); O.dt = 2;
    marker(() => O.i < 3 ? V3(M.uplinks[O.i][0], 7, M.uplinks[O.i][1]) : null, 'UPLINK', '#2be8ff');
    G.onKill = () => {};
    O.update = (dt) => {
      const [ux, uz] = M.uplinks[Math.min(2, O.i)], inside = Math.hypot(P.pos.x - ux, P.pos.z - uz) < 7 && P.alive;
      O.vis.forEach((v, k) => { v.col.material.uniforms.uA.value = k === O.i ? 0.55 + Math.sin(G.t * 4) * 0.1 : k < O.i ? 0.12 : 0.2; v.fillM.material.opacity = k === O.i ? 0.12 + O.hold / 5 * 0.6 : 0.08; v.ring.material.color.set(k < O.i ? '#7cff6a' : '#2be8ff').multiplyScalar(1.6); });
      if (inside) { O.hold += dt; if (Math.random() < dt * 10) FX.orb(V3(ux + (Math.random() - 0.5) * 12, 0.5 + Math.random() * 8, uz + (Math.random() - 0.5) * 12), '#2be8ff', 0.4); }
      if (O.hold >= 5) { O.i++; O.hold = 0; SND.win(); addScore(400); feed('+400 UPLINK SECURED'); if (O.i < 3) banner(`UPLINK ${O.i}/3 SECURED`, 'Move to the next uplink', 1600); if (O.i === 2) dropRaptor(M.uplinks[2][0] + 16, M.uplinks[2][1] + 8); }
      O.dt -= dt; if (O.dt <= 0 && O.i < 3) { O.dt = 7; if (enemies.filter(e => e.type === 'drone').length < 6) droneWave(3, ux + (G.rng() - 0.5) * 30, uz - 30, O.i); }
      setObjective(O.i < 3 ? (inside ? `Holding uplink ${O.i + 1}… ${Math.ceil(5 - O.hold)}s` : `Reach uplink ${O.i + 1}/3`) : 'Uplinks secured', (O.i + O.hold / 5) / 3);
      return O.i >= 3;
    };
  }
  if (m === 4) {
    O.goal = 3; O.n = 0; O.stage = 0;
    const r1 = dropRaptor(130, 178), r2 = dropRaptor(172, 178); droneWave(2, 150, 200);
    G.onKill = e => { if (e.type === 'mech') { O.n++; if (O.n === 2) { const r3 = dropRaptor(150, 122); droneWave(3, 150, 140, 1); banner('RAPTOR LEADER', 'Incoming from the plaza', 1600); } } };
    O.update = () => { setObjective(`Defeat Raptors ${O.n}/${O.goal}`, O.n / O.goal); return O.n >= O.goal; };
  }
  if (m === 5) {
    O.goal = 3; O.n = 0;
    for (const [x, z] of M.cores) { const c = spawn(new Core(x, z)); marker(() => c.alive ? c.center.add(V3(0, 5, 0)) : null, 'CORE', '#ff60ff'); }
    for (const [x, z] of M.turrets) spawn(new Turret(x, z));
    droneWave(3, 120, 170); O.dt = 10;
    G.onKill = e => { if (e.type === 'core') { O.n++; if (O.n === 1) dropRaptor(P.pos.x + 20, P.pos.z - 25); if (O.n === 2) dropRaptor(P.pos.x - 20, P.pos.z - 25); } };
    O.update = (dt) => { O.dt -= dt; if (O.dt <= 0) { O.dt = 13; if (enemies.filter(e => e.type === 'drone').length < 5) droneWave(3, P.pos.x, P.pos.z - 40, 1); } setObjective(`Destroy power cores ${O.n}/${O.goal}`, O.n / O.goal); return O.n >= O.goal; };
  }
  if (m === 6) {
    O.n = 0; const b = spawn(new Boss(150, 150)); G.boss = b; $('boss').classList.remove('off'); SND.alarm();
    G.onKill = e => { if (e.type === 'boss') O.n = 1; };
    O.update = () => { $('bossb').style.width = clamp(b.hp / b.max, 0, 1) * 100 + '%'; setObjective(O.n ? 'Weaver destroyed' : 'Destroy the Weaver · hit its core', b.alive ? 1 - b.hp / b.max : 1); if (O.n && !O.doneT) O.doneT = G.t + 1.6; return O.doneT && G.t > O.doneT; };
  }
}
function setupSiege() {
  const seed = D.seed || ((Math.random() * 1e9) | 0); G.rng = rngF(seed);
  const O = { wave: 0, brk: 2.5, active: false }; G.obj = O; G.onKill = () => {};
  $('mname').textContent = D.isDaily ? `DAILY SIEGE · ${String(D.seed).slice(4, 6)}/${String(D.seed).slice(6)}` : 'SIEGE';
  O.update = (dt) => {
    if (!O.active) { O.brk -= dt; setObjective(`Wave ${O.wave + 1} in ${Math.ceil(O.brk)}s`, 0); if (O.brk <= 0) startWave(); return false; }
    const left = enemies.length; setObjective(`Wave ${O.wave} · ${left} hostile${left === 1 ? '' : 's'} left`, 1 - left / Math.max(1, O.total));
    if (left === 0) { O.active = false; O.brk = 4; const b = 300 * O.wave; addScore(b); P.hp = Math.min(P.max, P.hp + P.max * 0.3); banner(`WAVE ${O.wave} CLEARED`, `+${b} · armor patched`, 1800); SND.win(); }
    return false;
  };
  function startWave() {
    O.wave++; G.wave = O.wave; O.active = true; const n = O.wave, sp = SIEGE.spawns, k = G.mode === 'siege' ? Fs.k(G.score) : 1;
    const pick = () => sp[(G.rng() * sp.length) | 0];
    if (n % 8 === 0) { const b = spawn(new Boss(150, 140, 9000 + n * 400)); G.boss = b; $('boss').classList.remove('off'); banner(`WAVE ${n}`, 'THE WEAVER RETURNS', 2200); }
    else banner(`WAVE ${n}`, n % 3 === 0 ? 'Turrets deploying' : n >= 3 ? 'Raptors inbound' : 'Drones inbound', 1600);
    const drones = Math.round((3 + n * 1.2) * k), swarm = Math.floor(n / 2);
    for (let i = 0; i < drones; i++) { const [x, z] = pick(); spawn(new Drone(airSpawn(x, z, 14), i < swarm ? 'swarm' : 'wasp')); }
    if (n >= 3 && n % 8) for (let i = 0; i < Math.min(3, Math.floor((n - 1) / 3)); i++) { const [x, z] = pick(); dropRaptor(x, z); }
    if (n % 3 === 0) for (let i = 0; i < Math.min(3, n / 3); i++) { const [x, z] = pick(); spawn(new Turret(x + (G.rng() - 0.5) * 6, z + (G.rng() - 0.5) * 6)); }
    O.total = enemies.length;
  }
}

// ================================================================ run lifecycle
function resetPlayer(x, z, yaw) {
  Object.assign(P, { hp: P.max, ammo: P.mag, reloadT: 0, fireCD: 0, heat: 0, rocketCD: 0, laserCD: 0, laserT: 0, shieldCD: 0, shieldT: 0, dashCD: 0, dashT: 0, alive: true, salvo: 0, vy: 0, onGround: true, yaw, pitch: 0.06, legYaw: yaw, lastHurt: -9 });
  P.pos.set(x, 0, z); P.vel.set(0, 0, 0); P.mech.root.visible = true; if (P.stopLaser) { P.stopLaser(); P.stopLaser = null; }
}
function begin(mode, m) {
  initAudio(); ui.hideStart(); ui.els.win.classList.add('hc-hidden'); ui.els.lose.classList.add('hc-hidden');
  clearEnemies(); clearMarkers(); clearUplinks(); FX.setBeam(0, V3(), V3(), 0, '#fff', 0);
  G.mode = D.isDaily && mode !== 'campaign' ? 'siege' : mode; if (mode === 'campaign') G.mission = m || G.mission;
  G.wall0 = performance.now(); G.score = 0; G.kills = 0; G.wave = 0; G.combo = 0; G.runT = 0; G.beatenShown = false; G.recorded = false; G.endT = 0; G.warn = []; addScore(0);
  const L = G.mode === 'siege' ? SIEGE : MISSIONS[G.mission - 1]; resetPlayer(L.start[0], L.start[1], L.start[2]);
  if (G.mode === 'siege') setupSiege(); else setupMission(G.mission);
  G.state = 'play'; $('hud').classList.remove('off'); B.start();
  banner(G.mode === 'siege' ? (D.isDaily ? 'DAILY SIEGE' : 'SIEGE') : `MISSION ${G.mission}`, G.mode === 'siege' ? 'Survive the waves' : `${MISSIONS[G.mission - 1].name} · ${MISSIONS[G.mission - 1].brief}`, 2600);
  SND.ready(); $('lockhint').classList.toggle('off', TOUCH || locked);
}
function endRun(won) {
  if (G.state !== 'play') return;
  G.state = won ? 'won' : 'lost'; G.slow = 0.35; if (P.stopLaser) { P.stopLaser(); P.stopLaser = null; } FX.setBeam(0, V3(), V3(), 0, '#fff', 0);
  if (document.pointerLockElement) document.exitPointerLock();
  const ms = Math.max(G.runT * 1000, performance.now() - G.wall0);
  if (G.mode === 'siege') {
    if (!G.recorded) { G.recorded = true; Fs.endless(G.score); }
    const best = Math.max(ST.get('bestSiege', 0), G.score); ST.set('bestSiege', best);
    B.submit(G.score, { ms });
    ui.lose('MECH DOWN', `Siege · wave ${G.wave} · ${G.score.toLocaleString()} pts${G.score >= best && G.score > 0 ? ' · NEW BEST' : ''}`);
  } else if (won) {
    const par = [60, 100, 120, 110, 160, 200][G.mission - 1], tb = Math.max(0, Math.round((par - G.runT) * 8)), hb = Math.round(P.hp / P.max * 500), cb = 500 * G.mission;
    addScore(tb + hb + cb);
    if (!G.recorded) { G.recorded = true; Fc.level(true); }
    B.submit(G.score, { ms });
    const un = Math.max(ST.get('unlocked', 1), Math.min(6, G.mission + 1)); ST.set('unlocked', un);
    ST.set('mission', G.mission < 6 ? G.mission + 1 : G.mission);
    D.won(G.score); SND.win(); buzz([30, 40, 60]);
    ui.win(`MISSION ${G.mission} · ${MISSIONS[G.mission - 1].name}`, `${G.score.toLocaleString()} pts · clear +${cb} · time +${tb} · armor +${hb}`);
  } else {
    if (!G.recorded) { G.recorded = true; Fc.level(false, clamp(parseFloat($('mprog').style.width) / 100 || 0, 0, 1)); }
    B.submit(G.score, { ms });
    ui.lose('MECH DOWN', `Mission ${G.mission} · ${MISSIONS[G.mission - 1].name} · ${G.score.toLocaleString()} pts`);
  }
  setIntensity(0.2); renderMenu(); setTimeout(() => { if (G.state !== 'play') $('hud').classList.add('off'); }, 600);
}
function die() {
  P.alive = false; P.hp = 0; const c = P.pos.clone().setY(P.pos.y + 4);
  FX.explode(c, 2.2); SND.boom(2); G.shake += 1.4; P.mech.root.visible = false; FX.debris(c, 14, '#f3efe6', 20, 0.8); FX.debris(c, 8, '#ff7a1a', 18, 0.7);
  setTimeout(() => endRun(false), 1300);
}
ui.onTap(which => {
  if (which === 'start') { begin(D.isDaily ? 'siege' : 'campaign', ST.get('mission', 1)); return; }
  if (which === 'win') { if (G.mission >= 6) begin('siege'); else begin('campaign', G.mission + 1); return; }
  if (which === 'lose') { begin(G.mode, G.mission); }
});

// ================================================================ HUD painting
const radar = $('radar').getContext('2d');
function drawRadar() {
  const c = radar, s = 200, R = 70; c.clearRect(0, 0, s, s);
  c.save(); c.translate(100, 100); c.beginPath(); c.arc(0, 0, 96, 0, 7); c.fillStyle = 'rgba(20,24,40,.55)'; c.fill(); c.lineWidth = 4; c.strokeStyle = 'rgba(255,255,255,.85)'; c.stroke(); c.clip();
  const sc = 96 / R; c.rotate(P.yaw + Math.PI);
  c.fillStyle = 'rgba(255,255,255,.22)';
  for (let i = -1; i <= 5; i++) for (let j = -1; j <= 5; j++) { if (i === 2 && j === 2) continue; const x0 = (i * 60 + 16 - P.pos.x) * sc, z0 = (j * 60 + 16 - P.pos.z) * sc; if (Math.abs(x0) > 200 || Math.abs(z0) > 200) continue; c.fillRect(-x0 - 28 * sc, z0, 28 * sc, 28 * sc); }
  for (const e of enemies) { const x = -(e.pos.x - P.pos.x) * sc, z = (e.pos.z - P.pos.z) * sc; c.fillStyle = e.type === 'boss' ? '#ff2d6a' : e.type === 'drone' ? '#ff8a8a' : '#ff3b5c'; c.beginPath(); c.arc(clamp(x, -90, 90), clamp(z, -90, 90), e.type === 'drone' ? 4 : e.type === 'boss' ? 10 : 6, 0, 7); c.fill(); }
  for (const m of markers) { const p = m.get(); if (!p) continue; const x = -(p.x - P.pos.x) * sc, z = (p.z - P.pos.z) * sc; c.save(); c.translate(clamp(x, -88, 88), clamp(z, -88, 88)); c.rotate(Math.PI / 4); c.fillStyle = '#ffd23f'; c.fillRect(-6, -6, 12, 12); c.restore(); }
  c.restore();
  c.fillStyle = '#2be8ff'; c.beginPath(); c.moveTo(100, 86); c.lineTo(110, 108); c.lineTo(100, 103); c.lineTo(90, 108); c.fill();
}
const setCD = (el, v, max) => { const i = el.querySelector('i'); if (!i) return; i.style.height = (v > 0 ? v / max * 100 : 0) + '%'; el.classList.toggle('ready', v <= 0); };
function hud(dt) {
  const hp = clamp(P.hp / P.max, 0, 1); $('hpb').style.width = hp * 100 + '%'; $('hpd').style.width = Math.max(parseFloat($('hpd').style.width) || 0, hp * 100) - dt * 30 + '%';
  $('hpb').style.background = hp < 0.3 ? '#ff3b5c' : hp < 0.6 ? '#ffb02a' : '#5cf27a'; $('shi').style.opacity = P.shieldT > 0 ? 1 : 0.25;
  const mm = Math.floor(G.runT / 60), ss = Math.floor(G.runT % 60); $('sub').textContent = (G.mode === 'siege' ? `WAVE ${G.wave} · ` : '') + `${mm}:${String(ss).padStart(2, '0')}`;
  const ammoT = P.reloadT > 0 ? '…' : P.ammo; $('ammo1').textContent = ammoT; $('ammo2').textContent = P.reloadT > 0 ? 'RELOADING' : `${P.ammo} / ${P.mag}`;
  for (const [a, b, v, m] of [['bRocket', 'kRocket', P.rocketCD, 7], ['bLaser', 'kLaser', P.laserCD, 11], ['bShield', 'kShield', P.shieldCD, 14], ['bDash', 'kDash', P.dashCD, 2.2]]) { setCD($(a), v, m); setCD($(b), v, m); }
  if (P.reloadT > 0) $('rlc').style.strokeDashoffset = 100.5 * (P.reloadT / 1.6); else $('reload').classList.add('off');
  hmT -= dt; if (hmT <= 0) $('hm').className = '';
  G.ddT = (G.ddT || 0) - dt; $('dmgdir').style.opacity = Math.max(0, G.ddT);
  G.hurtA = Math.max(0, (G.hurtA || 0) - dt * 1.2);
  $('vig').style.opacity = Math.min(1, G.hurtA + (hp < 0.3 ? 0.35 + Math.sin(G.t * 6) * 0.15 : 0));
  // reticle spread
  const sp = 10 + P.heat * 22; $('ret').style.setProperty('--sp', sp + 'px');
  // markers
  let nm = null, nd = 1e9; for (const m of markers) { const p = m.get(); if (p) { const d = p.distanceTo(P.pos); if (d < nd) { nd = d; nm = m; } } }
  for (const m of markers) { const p = m.get(); if (!p || p.distanceTo(P.pos) < 14) { m.el.style.display = 'none'; continue; } m.el.classList.toggle('far', m !== nm); m.el.style.display = ''; const v = p.clone().project(camera); let x = (v.x * 0.5 + 0.5) * innerWidth, y = (-v.y * 0.5 + 0.5) * innerHeight; if (v.z > 1) { x = innerWidth - x; y = innerHeight - 60; } x = clamp(x, 30, innerWidth - 30); y = clamp(y, 120, innerHeight - 140); m.el.style.transform = `translate(${x}px,${y}px)`; m.el.querySelector('span').textContent = m.el.querySelector('span').textContent.split(' ')[0] + ' ' + Math.round(p.distanceTo(P.pos)) + 'm'; }
  drawRadar();
}

// ================================================================ camera
const camPos = V3(), camLook = V3(); let portrait = innerHeight > innerWidth, shakeT = 0;
function updateCamera(dt, t) {
  portrait = innerHeight > innerWidth;
  const f = V3(Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), Math.cos(P.yaw) * Math.cos(P.pitch)), r = V3(-Math.cos(P.yaw), 0, Math.sin(P.yaw));
  const D = portrait ? 19 : 15.5, sx = portrait ? 0.8 : 3.6, piv = P.pos.clone().add(V3(0, portrait ? 8.4 : 6.6, 0)).addScaledVector(r, sx);
  let want = piv.clone().addScaledVector(f, -D).add(V3(0, portrait ? 2.2 : 2.6, 0));
  if (G.state === 'ready') { const a = t * 0.12; want = P.pos.clone().add(V3(Math.sin(a) * 16, 6.5 + Math.sin(t * 0.3) * 1.5, Math.cos(a) * 16)); camPos.lerp(want, 0.05); camera.position.copy(camPos); camera.lookAt(P.pos.clone().add(V3(0, 5.5, 0))); camF.set(0, 0, -1).applyQuaternion(camera.quaternion); return; }
  let ht = segHit(piv, want, false); if (ht < 1) { const hi = want.clone().add(V3(0, 9, 0)), h2 = segHit(piv, hi, false); if (h2 > ht) { want = hi; ht = h2; } } if (ht < 1) want = piv.clone().lerp(want, Math.max(0.15, ht - 0.05));
  want.y = Math.max(1.2, want.y);
  camPos.lerp(want, 1 - Math.pow(0.0001, dt)); camera.position.copy(camPos);
  camLook.copy(piv).addScaledVector(f, 40); camera.lookAt(camLook);
  // shake (trauma²)
  G.shake = Math.min(1.6, G.shake); const s = G.shake * G.shake * 0.35; shakeT += dt * 40;
  if (s > 0.0005) { camera.position.x += Math.sin(shakeT * 1.3) * s; camera.position.y += Math.sin(shakeT * 1.7 + 1) * s; camera.rotation.z += Math.sin(shakeT * 0.9) * s * 0.03; }
  G.shake = Math.max(0, G.shake - dt * 1.6);
  camF.set(0, 0, -1).applyQuaternion(camera.quaternion);
  const fov = (portrait ? 72 : 62) + (P.dashT > 0 ? 8 : 0); camera.fov = lerp(camera.fov, fov, 0.15); camera.updateProjectionMatrix();
}

// ================================================================ main loop
const BOT = { mx: 0, mz: 0, fire: false, until: -1 };
let last = performance.now(), fpsA = 60, perfT = 0, pr = renderer.getPixelRatio();
const sunOff = SUN_DIR.clone().multiplyScalar(140);
function frame(now) {
  requestAnimationFrame(frame); CALLS = renderer.info.render.calls; renderer.info.reset();
  const rdt = Math.min(0.05, (now - last) / 1000); last = now; fpsA = lerp(fpsA, 1 / Math.max(rdt, 0.001), 0.05);
  G.slow = lerp(G.slow, 1, rdt * 1.5); const dt = rdt * (G.state === 'play' ? 1 : G.slow); G.t += dt;
  const t = G.t;
  // dynamic resolution
  perfT += rdt; if (perfT > 2) { perfT = 0; if (fpsA < 40 && pr > 0.85) { pr = Math.max(0.85, pr - 0.2); renderer.setPixelRatio(pr); C.composer.setPixelRatio(pr); C.resize(innerWidth, innerHeight); FX.resize(innerHeight, camera.fov); } }
  G.sights = []; G.warn = (G.warn || []).filter(w => (w.t -= dt) > 0);
  if (G.state === 'play') { G.runT += dt; stepPlayer(dt, t); if (G.obj && G.obj.update && P.alive) { if (G.obj.update(dt)) endRun(true); } }
  else if (G.state === 'ready') { P.mech.animate(dt, 0, 0, t); P.mech.root.position.copy(P.pos); P.mech.root.rotation.y = P.legYaw; }
  for (const e of [...enemies]) if (e.alive) e.update(dt, t);
  for (const e of enemies) if (e.type === 'drone') e.draw(t);
  droneIM.instanceMatrix.needsUpdate = true; if (droneIM.instanceColor) droneIM.instanceColor.needsUpdate = true;
  stepShots(dt); stepRockets(dt);
  // telegraph sight lines (beams 2..5) + missile warning rings
  for (let i = 0; i < 4; i++) { const s = G.sights[i]; if (s) FX.setBeam(2 + i, s[0], s[1], 0.06 + (1 - clamp(s[2], 0, 1)) * 0.1, '#ff2d55', 0.9, t); else FX.setBeam(2 + i, V3(), V3(), 0, '#fff', 0); }
  for (const w of G.warn) if (Math.random() < 0.3) FX.ring(w.p, 5.5, '#ff2d55', 0.3);
  // combo timer, music intensity
  G.comboT -= dt; const near = enemies.filter(e => e.pos.distanceTo(P.pos) < 70).length;
  setIntensity(G.state !== 'play' ? 0.15 : G.boss ? 1 : near > 0 ? 0.62 + Math.min(0.3, near * 0.04) : 0.3);
  // world + sun follow
  W.update(t); sun.position.copy(P.pos).add(sunOff); sun.target.position.copy(P.pos);
  // steam from manholes near the player
  for (const v of W.vents) if (v.distanceToSquared(P.pos) < 6400 && Math.random() < dt * 3) FX.smoke.spawn(v.clone().add(V3((Math.random() - 0.5), 0, (Math.random() - 0.5))), V3(0.3, 2.4, 0.2), 2.4, 1.2, 4.5, '#ffffff', '#eef2f8', 0.35);
  FX.shield.visible = P.shieldT > 0; if (P.shieldT > 0) { FX.shield.position.copy(P.pos).setY(P.pos.y + 3.2); FX.shield.scale.setScalar(5.6); FX.shield.material.uniforms.uA.value = Math.min(1, P.shieldT * 2) * (P.shieldT < 1 ? 0.6 + Math.sin(t * 30) * 0.4 : 1); }
  updateCamera(rdt, t); FX.resize(innerHeight, camera.fov);
  FX.update(dt, t);
  if (G.state === 'play') hud(rdt);
  C.render(rdt);
}
function stepPlayer(dt, t) {
  const M = P.mech;
  if (!P.alive) return;
  // look
  const sens = TOUCH ? 0.0042 : 0.0024; P.yaw -= IN.look[0] * sens; P.pitch = clamp(P.pitch - IN.look[1] * sens, -0.42, 0.8); IN.look[0] = IN.look[1] = 0;
  // aim assist (touch): ease toward the target under the crosshair while firing
  const firing = (IN.fire || mouseDown && locked || keys.KeyJ || (BOT.until > t && BOT.fire)) && P.reloadT <= 0;
  if ((TOUCH || BOT.until > t) && firing) { const tg = aimTarget(0.16); if (tg) { const c = tg.center, v = c.clone().sub(camera.position); const ty = Math.atan2(v.x, v.z), tp = Math.atan2(v.y, Math.hypot(v.x, v.z)); P.yaw += angDiff(P.yaw, ty) * Math.min(1, dt * 3); P.pitch += (tp + 0.03 - P.pitch) * Math.min(1, dt * 3); } }
  // move
  const [ix, iz] = moveInput(), f = V3(Math.sin(P.yaw), 0, Math.cos(P.yaw)), r = V3(-Math.cos(P.yaw), 0, Math.sin(P.yaw));
  const want = f.clone().multiplyScalar(iz * 10.5).addScaledVector(r, ix * 9);
  P.vel.lerp(want, Math.min(1, dt * (P.onGround ? 6 : 2)));
  if (P.dashT > 0) { P.dashT -= dt; P.pos.addScaledVector(P.dashDir, 40 * dt); if (Math.random() < 0.6) FX.puff(P.pos.clone().add(V3(0, 1.5, 0)), 1.3); }
  P.pos.addScaledVector(P.vel, dt);
  if (!P.onGround) { P.vy -= 34 * dt; P.pos.y += P.vy * dt; FX.glow.spawn(P.pos.clone().add(V3(0, 2.2, -1.5).applyAxisAngle(V3(0, 1, 0), P.legYaw)), V3(0, -14, 0), 0.15, 2, 0.5, '#fff0a0', '#ff7a1a', 1); if (P.pos.y <= 0) { P.pos.y = 0; P.onGround = true; P.vy = 0; SND.land(); FX.dust(P.pos, 2.4); G.shake += 0.35; } }
  pushOut(P.pos, 2.0);
  // legs turn toward travel, torso follows aim
  const sp = Math.hypot(P.vel.x, P.vel.z);
  if (sp > 1) { let my = Math.atan2(P.vel.x, P.vel.z); if (Math.abs(angDiff(P.yaw, my)) > 1.9) my += Math.PI; P.legYaw += clamp(angDiff(P.legYaw, my), -5 * dt, 5 * dt); }
  else P.legYaw += clamp(angDiff(P.legYaw, P.yaw), -2 * dt, 2 * dt);
  const lf = Math.cos(angDiff(P.legYaw, Math.atan2(P.vel.x, P.vel.z))) * sp;
  if (M.animate(dt, P.onGround ? lf : 0, 0, t) && P.onGround) { SND.step(1); FX.dust(P.pos.clone().addScaledVector(r, (M.phase % 6.28 < 3.14 ? 1 : -1) * 1.3), 0.9); G.shake += 0.06; buzz(8); }
  M.root.position.copy(P.pos); M.root.rotation.y = P.legYaw; M.torso.rotation.y = angDiff(P.legYaw, P.yaw); M.torso.rotation.x = -P.pitch * 0.5;
  M.armR.sh.rotation.x = -P.pitch * 0.5; M.armL.sh.rotation.x = -P.pitch * 0.5;
  // weapons
  P.fireCD -= dt; P.heat = Math.max(0, P.heat - dt * (firing ? 0.3 : 1.6));
  if (P.reloadT > 0) { P.reloadT -= dt; if (P.reloadT <= 0) { P.ammo = P.mag; SND.ready(); } }
  if (firing && P.fireCD <= 0 && P.ammo > 0 && P.laserT <= 0) { P.fireCD = 1 / 9; shootCannon(); }
  M.spin = lerp(M.spin, firing ? 28 : 0, dt * 5); const barrels = M.armR.gun.children[0]; if (barrels) barrels.rotation.z += M.spin * dt;
  for (const k of ['rocketCD', 'laserCD', 'shieldCD', 'dashCD']) P[k] = Math.max(0, P[k] - dt);
  if (P.salvo > 0) { P.salvoT -= dt; if (P.salvoT <= 0) { P.salvoT = 0.09; P.salvo--; const tip = M.tips.rocket.getWorldPosition(V3()), A = aimRay(); const dir = A.p.clone().sub(tip).normalize().add(V3((Math.random() - 0.5) * 0.5, 0.35, (Math.random() - 0.5) * 0.5)).normalize();
    rockets.push({ p: tip, v: dir.multiplyScalar(40), target: P.lockT && P.lockT.alive ? P.lockT : null, aim: A.p.clone(), dmg: 95, life: 4, t: 0 }); SND.rocket(); FX.muzzle(tip, dir, '#ffb02a', 1.4); G.shake += 0.08; } }
  if (P.shieldT > 0) P.shieldT -= dt;
  if (P.laserT > 0) {
    P.laserT -= dt; const tip = M.tips.laser.getWorldPosition(V3()), A = aimRay(); const dir = A.p.clone().sub(tip).normalize(); const end = tip.clone().addScaledVector(dir, tip.distanceTo(A.p));
    const w = 0.5 + Math.sin(t * 50) * 0.08; FX.setBeam(0, tip, end, w, '#2be8ff', Math.min(1, P.laserT * 3), t);
    if (A.e) hitEnemy(A.e, 520 * dt, end, A.s.m); FX.sparks(end, 2, '#9ff6ff', 16); FX.light(end, '#2be8ff', 16, 30); FX.glow.spawn(tip, V3(), 0.05, 2.4, 3.2, '#ffffff', '#2be8ff', 1);
    if (Math.random() < 0.15) FX.decal(end, 1.2); G.shake += dt * 0.6;
    if (P.laserT <= 0) { FX.setBeam(0, V3(), V3(), 0, '#fff', 0); if (P.stopLaser) { P.stopLaser(); P.stopLaser = null; } }
  }
  if (t - P.lastHurt > 4 && P.hp < P.max) P.hp = Math.min(P.max, P.hp + 60 * dt);
}
function stepShots(dt) {
  const pc = V3();
  for (let i = eShots.length - 1; i >= 0; i--) {
    const s = eShots[i], a = s.p.clone(); s.p.addScaledVector(s.v, dt); s.life -= dt;
    const col = s.kind === 'heavy' ? '#ff4dc4' : s.kind === 'bolt' ? '#ff2d6a' : '#ff6a9a';
    FX.orb(s.p, col, s.kind === 'heavy' ? 1.0 : 0.5); FX.streak(s.p, s.v, s.kind === 'heavy' ? 4 : 2.2, s.kind === 'heavy' ? 0.35 : 0.18, col, 0.02);
    pc.copy(P.pos).setY(P.pos.y + 3);
    // shield bubble / mech body
    const segD = (() => { const ab = s.p.clone().sub(a), tt = clamp(pc.clone().sub(a).dot(ab) / Math.max(ab.lengthSq(), 1e-6), 0, 1); return a.clone().addScaledVector(ab, tt).distanceTo(pc); })();
    if (P.alive && P.shieldT > 0 && segD < 5.6) { FX.sparks(s.p, 6, '#9ff6ff', 14); hurt(s.dmg, a); eShots.splice(i, 1); continue; }
    if (P.alive && segD < 2.6) { hurt(s.dmg, a, s.kind); FX.hit(s.p, col); eShots.splice(i, 1); continue; }
    const ht = segHit(a, s.p); if (ht < 1 || s.life <= 0) { const hp = a.lerp(s.p, ht); FX.hit(hp, col); if (s.kind === 'heavy') explodeAt(hp, 4, 20, false); eShots.splice(i, 1); }
  }
}
function stepRockets(dt) {
  let n = 0;
  for (let i = rockets.length - 1; i >= 0; i--) {
    const r = rockets[i], a = r.p.clone(); r.t += dt; r.life -= dt;
    if (r.arc) { const k = clamp(r.t / r.T, 0, 1); r.p.lerpVectors(r.from, r.target, k).y += Math.sin(k * Math.PI) * 32 + (1 - k) * r.from.y * 0; r.v.subVectors(r.p, a).divideScalar(Math.max(dt, 1e-4)); if (k >= 1) { explodeAt(r.target.clone().setY(0.5), 5.5, r.dmg, false); rockets.splice(i, 1); continue; } }
    else {
      const goal = r.enemy ? r.target.clone().setY(1.5) : r.target && r.target.alive ? r.target.center : r.aim;
      const want = goal.clone().sub(r.p).normalize().multiplyScalar(r.enemy ? 26 : 70 + r.t * 40), turn = Math.min(1, dt * (r.t > 0.18 ? (r.enemy ? 2.2 : 5) : 0.5));
      r.v.lerp(want, turn); r.p.addScaledVector(r.v, dt);
      if (!r.enemy) { let hitE = false; for (const e of enemies) { for (const s of e.spheres()) if (s.c.distanceTo(r.p) < s.r + 0.6) { hitE = true; break; } if (hitE) break; }
        if (hitE || segHit(a, r.p) < 1 || r.life <= 0 || r.p.distanceTo(goal) < 1.2) { explodeAt(r.p, 6, r.dmg, true); rockets.splice(i, 1); continue; } }
      else { if (P.alive && P.shieldT > 0 && r.p.distanceTo(P.pos.clone().setY(P.pos.y + 3)) < 5.6) { FX.sparks(r.p, 8, '#9ff6ff', 16); FX.shield.material.uniforms.uHit.value = 1; rockets.splice(i, 1); continue; }
        if (segHit(a, r.p) < 1 || r.life <= 0 || r.p.distanceTo(P.pos.clone().setY(P.pos.y + 3)) < 2.4) { explodeAt(r.p, 5, r.dmg, false); rockets.splice(i, 1); continue; } }
    }
    FX.trail(r.p);
    if (n < 48) { _m4.compose(r.p, _q.setFromUnitVectors(V3(0, 0, 1), r.v.clone().normalize()), V3(1, 1, 1).multiplyScalar(r.arc ? 1.6 : 1)); rocketMesh.setMatrixAt(n++, _m4); }
  }
  rocketMesh.count = n; rocketMesh.instanceMatrix.needsUpdate = true;
}

// ================================================================ resize, boot, hooks
function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); C.resize(innerWidth, innerHeight); FX.resize(innerHeight, camera.fov); }
addEventListener('resize', resize); resize();
// attract pose: mech at mission start
{ const L = D.isDaily ? SIEGE : MISSIONS[G.mission - 1]; resetPlayer(L.start[0], L.start[1], L.start[2]); camPos.set(L.start[0] + 10, 7, L.start[1] - 14); }
renderMenu(); ui.start();
requestAnimationFrame(frame);
document.addEventListener('visibilitychange', () => { last = performance.now(); });

function botWay(goal) {
  const a = P.pos.clone().setY(3), b = goal.clone().setY(3);
  if (segHit(a, b, false, true) >= 0.995) return goal;
  let best = null, bs = 1e9;
  for (let i = 0; i <= 5; i++) for (let j = 0; j <= 5; j++) { const q = V3(i * 60, 3, j * 60); if (q.distanceTo(a) < 4 || segHit(a, q, false, true) < 0.995) continue; const sc = q.distanceTo(a) * 0.5 + q.distanceTo(b) * (segHit(q, b, false, true) >= 0.995 ? 1 : 1.6); if (sc < bs) { bs = sc; best = q; } }
  return best ? best.setY(0) : goal;
}
window.__game = {
  get state() { return G.state; }, get level() { return G.mode === 'siege' ? G.wave : G.mission; }, get score() { return G.score; },
  get fps() { return Math.round(fpsA); }, get calls() { return CALLS; }, get enemies() { return enemies.length; }, get hp() { return Math.round(P.hp); },
  begin,
  bot() {
    if (G.state !== 'play' || !P.alive) return;
    const now = G.t; let tgt = null, bd = 1e9;
    for (const e of enemies) { if (e.drop > 0) continue; let d = e.pos.distanceTo(P.pos); if (e.type === 'turret' || e.type === 'core' || e.type === 'boss') d *= 0.8; if (d < bd) { bd = d; tgt = e; } }
    let goal = null; const O = G.obj;
    if (G.mode === 'campaign' && G.mission === 3 && O.i < 3) goal = V3(MISSIONS[2].uplinks[O.i][0], 0, MISSIONS[2].uplinks[O.i][1]);
    if (tgt) { const c = tgt.center, v = c.clone().sub(camera.position); P.yaw += angDiff(P.yaw, Math.atan2(v.x, v.z)) * 0.6; P.pitch = clamp(lerp(P.pitch, Math.atan2(v.y, Math.hypot(v.x, v.z)) + 0.02, 0.6), -0.42, 0.8); }
    else if (goal) P.yaw += angDiff(P.yaw, Math.atan2(goal.x - P.pos.x, goal.z - P.pos.z)) * 0.5;
    let wdir = V3();
    if (goal && (!tgt || bd > 25 || Math.hypot(goal.x - P.pos.x, goal.z - P.pos.z) > 4)) wdir = botWay(goal).sub(P.pos).setY(0);
    else if (tgt) { const to = tgt.pos.clone().sub(P.pos).setY(0), dist = to.length(); to.normalize(); const side = V3(-to.z, 0, to.x).multiplyScalar(Math.sin(now * 0.7) > 0 ? 1 : -1); wdir = dist > (tgt.type === 'boss' ? 34 : 24) ? (segHit(P.pos.clone().setY(3), tgt.pos.clone().setY(3), false, true) < 0.995 ? botWay(tgt.pos).sub(P.pos).setY(0).normalize() : to.add(side.multiplyScalar(0.3))) : dist < 12 ? to.negate().add(side) : side; }
    else { wdir = V3(150, 0, 150).sub(P.pos).setY(0); }
    { const l0 = wdir.length(); if (l0 > 0.01) wdir.divideScalar(l0); }
    near(P.pos.x - 10, P.pos.z - 10, P.pos.x + 10, P.pos.z + 10, c => { if (!c.lot) return; const cx = clamp(P.pos.x, c.x0, c.x1), cz = clamp(P.pos.z, c.z0, c.z1), d = Math.hypot(P.pos.x - cx, P.pos.z - cz); if (d < 9 && d > 0.01) wdir.add(V3((P.pos.x - cx) / d, 0, (P.pos.z - cz) / d).multiplyScalar((9 - d) / 9 * 1.6)); });
    const l = wdir.length(); if (l > 0.01) wdir.divideScalar(l);
    const f = V3(Math.sin(P.yaw), 0, Math.cos(P.yaw)), r = V3(-Math.cos(P.yaw), 0, Math.sin(P.yaw));
    Object.assign(BOT, { mx: wdir.dot(r), mz: wdir.dot(f), fire: !!tgt && bd < 90, until: now + 0.35 });
    if (tgt && bd < 70 && (tgt.type !== 'drone' || enemies.length > 3)) fireRockets();
    if (tgt && (tgt.type === 'boss' || tgt.type === 'mech' || tgt.type === 'core') && bd < 70) fireLaser();
    if (P.hp < P.max * 0.5 || G.sights.length > 1) raiseShield();
    if (G.boss && G.boss.sweep && G.boss.sweep.t > 0.8) { jump(); if (Math.random() < 0.5) dash(); }
    if (P.ammo === 0) reload();
  },
};
