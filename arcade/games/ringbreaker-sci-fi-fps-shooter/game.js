// RINGBREAKER: Sci-Fi FPS Shooter. A first-person campaign through a code-built orbital station (6 missions)
// plus a daily-seeded Holdout wave mode. Everything (models, textures, sound, music) is generated in code.
import { THREE, cine } from './kit/cine.js';
import { createUI, store, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { createMaterials, createSpace, RAMP, outlineMat } from './world.js';
import { MISSIONS, HOLDOUT, buildLevel } from './levels.js';
import { createFX } from './fx.js';
import { createEnemies, STATS } from './enemies.js';
import { initAudio, snd, setAlarm, setIntensity, setMuted, isMuted, setAmbience } from './audio.js';

const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, rand = (a, b) => a + Math.random() * (b - a);
const V = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3();
const $ = (id) => document.getElementById(id);
const FULL = 'Ringbreaker: Sci-Fi FPS Shooter';
const TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (TOUCH) document.body.classList.add('touch');

// ---------------------------------------------------------------- renderer / scene
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.domElement.className = 'hc-canvas'; document.body.prepend(renderer.domElement);
renderer.setSize(innerWidth, innerHeight, false); renderer.info.autoReset = false;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x1a2a6c);
const cam = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.04, 3200); scene.add(cam);
const C = cine(renderer, scene, cam, { bloom: 0.32, bloomThreshold: 0.92, bloomRadius: 0.45, exposure: 1.08, envIntensity: 0.5, grade: { sat: 1.18, contrast: 1.06, vignette: 0.14, grain: 0 } });
const LITE = C.lite;
if (LITE) C.bloom.resolution?.set?.(256, 256);
const hemi = new THREE.HemisphereLight(0xd8ecff, 0x9a8a7a, 1.15); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 2.6); sun.castShadow = true; sun.shadow.mapSize.setScalar(LITE ? 1024 : 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 140 }); scene.add(sun, sun.target);
const POOL = []; for (let i = 0; i < 4; i++) { const L = new THREE.PointLight(0xffffff, 0, 14, 2); L.position.set(0, -50, 0); scene.add(L); POOL.push(L); }
const space = createSpace(scene); space.setPx(renderer.getPixelRatio());
const mats = createMaterials();
const fx = createFX(scene, { lite: LITE });

// ---------------------------------------------------------------- kit layers: UI, daily, flow, board
const ui = createUI({ title: 'RING<span>BREAKER</span>', hint: 'Tap anywhere to deploy', hand: '', progress: false, score: false });
const D = daily('ringbreaker', ui, { name: FULL });
const Fm = flow('ringbreaker_m'), Fh = flow('ringbreaker_h', { par: 4000, warmup: 500 });
const B = board({ game: 'ringbreaker', label: 'Score', limits: { maxRun: 200000, maxPerSec: 300 }, corner: 'tr', accent: '#ffd23a' });
const S = store('ringbreaker');
let unlocked = S.get('unlocked', 1), sel = Math.min(unlocked, MISSIONS.length);

// ---------------------------------------------------------------- game context shared with enemies
const player = { pos: new THREE.Vector3(), vy: 0, yaw: 0, pitch: 0, ground: true, shield: 100, hp: 100, regen: 0, dead: false, speed: 0, bob: 0, stepD: 0, kick: 0 };
let L = null, mission = MISSIONS[0], mode = 'campaign', state = 'ready', intro = 0, runT = 0, score = 0, beatenShown = false, deadT = 0;
let obj = null, combo = { n: 0, t: 0 }, shakeA = 0, holdout = null, seedRnd = Math.random;
const G = {
  scene, fx, snd, player, get level() { return L; },
  get playerRoom() { return roomAt(player.pos.x, player.pos.z); },
  diff: () => (mode === 'holdout' ? Fh.k(score) * (1 + Math.min(0.6, (holdout?.wave || 1) * 0.03)) : Fm.k() * (0.9 + mission.id * 0.04)),
  dmgScale: () => (mode === 'holdout' ? 1 + Math.min(0.5, (holdout?.wave || 1) * 0.025) : 0.9 + mission.id * 0.05),
  distTo: (p) => p.distanceTo(player.pos),
  los, collide, solidAt, explode, shake: (a) => { shakeA = Math.min(1.2, shakeA + a); },
  hurtPlayer, onKill, say: (t, c) => banner(t, '', 1.3, c), marker, running: () => state === 'play',
};
const enemies = createEnemies(G);

// ---------------------------------------------------------------- collision helpers
function collide(p, r, y0, y1) {
  if (!L) return;
  for (const c of L.cols) {
    if (c.off || c.y1 <= y0 || c.y0 >= y1) continue;
    const nx = clamp(p.x, c.x0, c.x1), nz = clamp(p.z, c.z0, c.z1), dx = p.x - nx, dz = p.z - nz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) { const d = Math.sqrt(d2); p.x += dx / d * (r - d); p.z += dz / d * (r - d); }
    else { const a = p.x - c.x0, b = c.x1 - p.x, e = p.z - c.z0, f = c.z1 - p.z, m = Math.min(a, b, e, f); if (m === a) p.x = c.x0 - r; else if (m === b) p.x = c.x1 + r; else if (m === e) p.z = c.z0 - r; else p.z = c.z1 + r; }
  }
}
function groundAt(x, z, y, r = 0.3) { let g = 0; if (!L) return 0; for (const c of L.cols) { if (c.off || c.y1 > y + 0.45) continue; if (x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r) g = Math.max(g, c.y1); } return g; }
function solidAt(p) { if (!L) return false; for (const c of L.cols) if (!c.off && p.x > c.x0 && p.x < c.x1 && p.z > c.z0 && p.z < c.z1 && p.y > c.y0 && p.y < c.y1) { if (c.ref?.canister) hitCanister(c.ref, 8); return true; } return false; }
const HIT = { t: 0, c: null, n: new THREE.Vector3() };
function rayStatic(o, d, maxT) {
  HIT.t = maxT; HIT.c = null;
  if (d.y < -1e-4) { const t = -o.y / d.y; if (t > 0 && t < HIT.t) { HIT.t = t; HIT.c = 'floor'; HIT.n.set(0, 1, 0); } }
  for (const c of L.cols) {
    if (c.off) continue;
    let tmin = -Infinity, tmax = Infinity, ax = -1;
    const lo = [c.x0, c.y0, c.z0], hi = [c.x1, c.y1, c.z1], oo = [o.x, o.y, o.z], dd = [d.x, d.y, d.z];
    let miss = false;
    for (let k = 0; k < 3; k++) {
      if (Math.abs(dd[k]) < 1e-9) { if (oo[k] < lo[k] || oo[k] > hi[k]) { miss = true; break; } continue; }
      let t1 = (lo[k] - oo[k]) / dd[k], t2 = (hi[k] - oo[k]) / dd[k], s = -1; if (t1 > t2) { const q = t1; t1 = t2; t2 = q; s = 1; }
      if (t1 > tmin) { tmin = t1; ax = k * 2 + (s > 0 ? 1 : 0); } if (t2 < tmax) tmax = t2; if (tmin > tmax) { miss = true; break; }
    }
    if (miss || tmin < 0 || tmin >= HIT.t) continue;
    HIT.t = tmin; HIT.c = c; HIT.n.set(0, 0, 0); HIT.n.setComponent(ax >> 1, ax & 1 ? 1 : -1);
  }
  return HIT;
}
function los(a, b) { V3.subVectors(b, a); const d = V3.length(); V3.multiplyScalar(1 / d); const h = rayStatic(a, V3, d); return h.t >= d - 0.05; }
function roomAt(x, z) { if (!L) return 0; for (const R of L.rooms) if (x >= R.x0 - 0.3 && x <= R.x1 + 0.3 && z <= R.z0 + 0.3 && z >= R.z1 - 0.3) return R.i; return -1; }

// ---------------------------------------------------------------- viewmodels (toon, outlined, merged per gun)
const OLG = outlineMat(0.006), vm = new THREE.Group(); cam.add(vm);
function gunBuilder() {
  const body = [], glow = [];
  const put = (arr, g, c, x, y, z, rx = 0, ry = 0, rz = 0) => { if (g.index) g = g.toNonIndexed(); for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k);
    const n = g.attributes.position.count, a = new Float32Array(n * 3), col = new THREE.Color(c); for (let i = 0; i < n; i++) a.set([col.r, col.g, col.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1))); arr.push(g); };
  const rb = (w, h, d, r) => new (RB())(w, h, d, 2, r);
  return { body: (...a) => put(body, ...a), glow: (...a) => put(glow, ...a), rb, build() {
    const g = new THREE.Group(); const m = (geos, mat) => { const gg = mergeAll(geos); return new THREE.Mesh(gg, mat); };
    if (body.length) { const b = m(body, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: RAMP })); g.add(b); g.add(new THREE.Mesh(b.geometry, OLG)); }
    if (glow.length) g.add(m(glow, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, color: new THREE.Color(2.4, 2.4, 2.4) })));
    return g; } };
}
let RBG = null, mergeAll = null;
const RB = () => RBG;
const GLOVE = 0x2a2f55, SLEEVE = 0xff6a1a;
function hands(b, gx, gy, gz, fx, fy, fz) {
  b.body(new THREE.SphereGeometry(0.045, 12, 8), GLOVE, gx, gy, gz); b.body(new THREE.CapsuleGeometry(0.04, 0.2, 4, 10), SLEEVE, gx + 0.04, gy - 0.07, gz + 0.15, 1.1, 0, 0.25);
  b.body(new THREE.SphereGeometry(0.045, 12, 8), GLOVE, fx, fy, fz); b.body(new THREE.CapsuleGeometry(0.04, 0.26, 4, 10), SLEEVE, fx - 0.08, fy - 0.11, fz + 0.15, 0.9, 0, -0.55);
  b.body(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12), 0xffffff, gx + 0.03, gy - 0.03, gz + 0.06, 1.1, 0, 0.25);
}
const WEAPONS = [
  { id: 'pulse', name: 'PULSE RIFLE', mag: 30, rate: 9.5, dmg: 15, pellets: 1, spread: 0.7, bloom: 0.25, recoil: 0.8, reload: 1.35, auto: true, col: [0.7, 2.6, 4], muzzle: [0, 0.012, -0.64], flash: 0x7fe8ff, sound: 'pulse' },
  { id: 'scatter', name: 'SCATTER GUN', mag: 6, rate: 1.7, dmg: 12, pellets: 9, spread: 5.5, bloom: 0, recoil: 3.4, reload: 1.8, auto: true, col: [4, 2, 0.5], muzzle: [0, 0.02, -0.62], flash: 0xffb04a, sound: 'scatter' },
  { id: 'rail', name: 'RAIL LANCE', mag: 4, rate: 1.05, dmg: 140, pellets: 1, spread: 0, bloom: 0, recoil: 5, reload: 2.0, auto: false, col: [2.8, 0.9, 4.2], muzzle: [0, 0.02, -0.82], flash: 0xc77dff, sound: 'rail', pierce: true },
];
function buildGuns() {
  const out = [];
  { const b = gunBuilder(), rb = b.rb;
    b.body(rb(0.11, 0.13, 0.5, 0.03), 0xf4f6fa, 0, 0, -0.12); b.body(rb(0.085, 0.05, 0.36, 0.02), 0x2f4bd8, 0, 0.08, -0.12); b.body(rb(0.04, 0.05, 0.08, 0.01), 0x2a2f55, 0, 0.13, -0.02);
    b.body(new THREE.CylinderGeometry(0.028, 0.03, 0.26, 12), 0x2a2f55, 0, 0.012, -0.5, Math.PI / 2); b.body(rb(0.125, 0.11, 0.2, 0.03), 0xff6a1a, 0, 0.0, -0.3);
    b.body(rb(0.05, 0.12, 0.06, 0.015), 0x2a2f55, 0, -0.1, 0.07, -0.3); b.body(rb(0.08, 0.1, 0.17, 0.025), 0xf4f6fa, 0, -0.02, 0.2);
    b.glow(new THREE.BoxGeometry(0.02, 0.035, 0.22), 0x22d3ee, 0.058, 0.0, -0.12); b.glow(new THREE.BoxGeometry(0.02, 0.035, 0.22), 0x22d3ee, -0.058, 0.0, -0.12); b.glow(new THREE.SphereGeometry(0.012, 8, 6), 0xff3a6e, 0, 0.14, -0.065);
    b.glow(new THREE.TorusGeometry(0.03, 0.006, 6, 16), 0x22d3ee, 0, 0.012, -0.63);
    hands(b, 0.0, -0.14, 0.08, -0.01, -0.07, -0.3);
    const g = b.build(); const mg = gunBuilder(); mg.body(mg.rb(0.06, 0.14, 0.08, 0.015), 0xff6a1a, 0, 0, 0); mg.glow(new THREE.BoxGeometry(0.062, 0.02, 0.03), 0x22d3ee, 0, -0.03, 0.03); const mag = mg.build(); mag.position.set(0, -0.11, -0.1); mag.rotation.x = 0.2; g.add(mag); g.userData.mag = mag; out.push(g); }
  { const b = gunBuilder(), rb = b.rb;
    b.body(rb(0.15, 0.15, 0.42, 0.04), 0xff6a1a, 0, 0, -0.1); for (const s of [-1, 1]) b.body(new THREE.CylinderGeometry(0.036, 0.036, 0.36, 14), 0x2a2f55, s * 0.036, 0.025, -0.43, Math.PI / 2);
    b.body(rb(0.16, 0.06, 0.1, 0.02), 0xf4f6fa, 0, 0.025, -0.56); b.body(rb(0.06, 0.13, 0.07, 0.02), 0x2a2f55, 0, -0.11, 0.06, -0.3); b.body(rb(0.1, 0.12, 0.2, 0.03), 0xf4f6fa, 0, -0.02, 0.19);
    b.body(rb(0.05, 0.04, 0.18, 0.015), 0x2a2f55, 0, 0.1, -0.12); for (let i = 0; i < 3; i++) b.glow(new THREE.CylinderGeometry(0.018, 0.018, 0.06, 10), 0xffd23a, 0.08, -0.02 + i * 0.0, -0.02 - i * 0.07, 0, 0, Math.PI / 2);
    b.glow(new THREE.BoxGeometry(0.155, 0.02, 0.2), 0xffd23a, 0, 0.065, -0.14);
    hands(b, 0.0, -0.15, 0.07, -0.01, -0.09, -0.36);
    const g = b.build(); const pg = gunBuilder(); pg.body(pg.rb(0.11, 0.08, 0.17, 0.025), 0x2a2f55, 0, 0, 0); const pump = pg.build(); pump.position.set(0, -0.055, -0.36); g.add(pump); g.userData.mag = pump; out.push(g); }
  { const b = gunBuilder(), rb = b.rb;
    b.body(rb(0.1, 0.12, 0.62, 0.03), 0x7b4bff, 0, 0, -0.18); b.body(rb(0.05, 0.06, 0.4, 0.02), 0xf4f6fa, 0, 0.085, -0.2); b.body(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 12), 0x2a2f55, 0, 0.14, -0.08, Math.PI / 2);
    for (const s of [-1, 1]) b.body(rb(0.025, 0.05, 0.26, 0.01), 0xf4f6fa, s * 0.04, 0.0, -0.62); b.body(rb(0.06, 0.13, 0.07, 0.02), 0x2a2f55, 0, -0.11, 0.06, -0.3); b.body(rb(0.09, 0.11, 0.2, 0.03), 0x2a2f55, 0, -0.01, 0.2);
    for (let i = 0; i < 4; i++) b.glow(new THREE.TorusGeometry(0.06, 0.012, 6, 18), 0xff5ad8, 0, 0, -0.32 - i * 0.08); b.glow(new THREE.SphereGeometry(0.03, 10, 8), 0xff5ad8, 0, 0.14, 0.02); b.glow(new THREE.BoxGeometry(0.02, 0.02, 0.5), 0xc77dff, 0, -0.065, -0.2);
    hands(b, 0.0, -0.14, 0.08, -0.01, -0.07, -0.26);
    const g = b.build(); const mg = gunBuilder(); mg.body(mg.rb(0.07, 0.1, 0.1, 0.02), 0xf4f6fa, 0, 0, 0); mg.glow(new THREE.BoxGeometry(0.072, 0.03, 0.05), 0xff5ad8, 0, 0, 0); const mag = mg.build(); mag.position.set(0, -0.09, -0.08); g.add(mag); g.userData.mag = mag; out.push(g); }
  for (const g of out) { g.visible = false; g.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.renderOrder = 5; } }); vm.add(g); }
  return out;
}
// muzzle flash: crossed additive planes + a core
const flashTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.translate(64, 64);
  for (let i = 0; i < 7; i++) { x.rotate(TAU / 7); x.beginPath(); x.moveTo(0, -6); x.lineTo(60, 0); x.lineTo(0, 6); x.fillStyle = 'rgba(255,255,255,.9)'; x.fill(); }
  const g = x.createRadialGradient(0, 0, 0, 0, 0, 34); g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(-64, -64, 128, 128); return new THREE.CanvasTexture(c); })();
const flashMat = new THREE.MeshBasicMaterial({ map: flashTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, color: new THREE.Color(3, 3, 3) });
const mflash = new THREE.Group(); for (let i = 0; i < 3; i++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), flashMat); if (i === 1) p.rotation.y = Math.PI / 2; if (i === 2) p.rotation.x = Math.PI / 2; p.renderOrder = 6; mflash.add(p); } mflash.visible = false; vm.add(mflash);
const mlight = new THREE.PointLight(0x7fe8ff, 0, 9, 2); cam.add(mlight); mlight.position.set(0.1, -0.1, -0.9);
let GUNS = [];

// ---------------------------------------------------------------- weapons state
const W = { cur: 0, ammo: [30, 6, 4], cool: 0, reloading: 0, swap: 0, fireHeld: false, bloom: 0, nades: 3, nadeCool: 0, kick: 0, recoilP: 0, firedOnce: false };
const owned = () => (mode === 'holdout' ? 3 : Math.min(3, unlocked >= 3 ? 3 : unlocked >= 2 ? 2 : 1)) ;
function selectWeapon(i) { if (i >= owned() || i === W.cur && W.swap <= 0) return; W.cur = i; W.reloading = 0; W.swap = 0.35; snd.swap(); GUNS.forEach((g, k) => g.visible = k === i); hudAmmo(); }
function reload() { const w = WEAPONS[W.cur]; if (W.reloading > 0 || W.ammo[W.cur] >= w.mag || W.swap > 0) return; W.reloading = w.reload; snd.reload(W.cur); hudAmmo(); }
function camDir(out) { return out.set(0, 0, -1).applyQuaternion(cam.quaternion); }
const tgtTmp = [];
function aimAssistTarget(maxDeg) {
  let best = null, bd = maxDeg * Math.PI / 180; const o = cam.getWorldPosition(V2), d = camDir(V3.clone());
  for (const e of enemies.list) { if (!e.alive) continue; const sp = enemies.spheres(e, tgtTmp); const c = sp.find(s => s.name === 'body') || sp[0];
    const to = V.subVectors(c.c, o); const dist = to.length(); if (dist > 40) continue; const a = to.normalize().angleTo(d); if (a < bd && los(o, c.c)) { bd = a; best = { e, p: c.c.clone(), a, dist }; } }
  return best;
}
function fire() {
  const w = WEAPONS[W.cur];
  if (W.cool > 0 || W.reloading > 0 || W.swap > 0 || player.dead) return;
  if (W.ammo[W.cur] <= 0) { snd.dry(); W.cool = 0.25; reload(); return; }
  W.ammo[W.cur]--; W.cool = 1 / w.rate; W.kick = Math.min(1.5, W.kick + w.recoil * 0.25); W.firedOnce = true;
  snd[w.sound]();
  const o = cam.getWorldPosition(new THREE.Vector3()), base = camDir(new THREE.Vector3());
  // bullet magnetism on touch screens (aim assist)
  if (TOUCH || botOn) { const t = aimAssistTarget(TOUCH ? 4.5 : botOn ? 5 : 2.5); if (t) base.lerp(V.subVectors(t.p, o).normalize(), 0.75).normalize(); }
  const mz = new THREE.Vector3(...w.muzzle); GUNS[W.cur].localToWorld(mz);
  let anyHit = false, crit = false, kill = false;
  for (let p = 0; p < w.pellets; p++) {
    const s = (w.spread + W.bloom) * Math.PI / 180, d = base.clone(); d.x += rand(-s, s); d.y += rand(-s, s); d.z += rand(-s, s); d.normalize();
    const res = shoot(o, d, w, mz); anyHit = anyHit || res.hit; crit = crit || res.crit; kill = kill || res.kill;
  }
  W.bloom = Math.min(3, W.bloom + w.bloom);
  player.pitch += w.recoil * 0.0045; W.recoilP += w.recoil * 0.0045; player.yaw += rand(-1, 1) * w.recoil * 0.0012;
  mflash.visible = true; mflash.position.set(...w.muzzle); mflash.rotation.z = Math.random() * TAU; mflash.scale.setScalar(w.id === 'scatter' ? 1.6 : w.id === 'rail' ? 1.4 : 1); flashMat.color.set(w.flash).multiplyScalar(3);
  mlight.color.set(w.flash); mlight.intensity = w.id === 'pulse' ? 8 : 18; flashT = 0.05;
  shakeA = Math.min(1, shakeA + w.recoil * 0.05);
  if (anyHit) hitMarker(kill ? 'kill' : crit ? 'crit' : '');
  if (w.id === 'scatter') setTimeout(() => { const pm = GUNS[1].userData.mag; pm.position.z = -0.27; setTimeout(() => pm.position.z = -0.36, 160); }, 120);
  if (W.ammo[W.cur] === 0) setTimeout(reload, 200);
  hudAmmo();
}
let flashT = 0;
function shoot(o, d, w, mz) {
  let range = 120, out = { hit: false, crit: false, kill: false };
  const h = rayStatic(o, d, range); const wallT = h.t, wallC = h.c, wn = h.n.clone();
  let from = o.clone(), travelled = 0, end = o.clone().addScaledVector(d, wallT), hits = 0;
  while (true) {
    const eh = enemies.ray(from, d, wallT - travelled);
    if (!eh) break;
    const p = from.clone().addScaledVector(d, eh.t), e = eh.e, before = e.alive;
    const dmg = enemies.damage(e, w.dmg * (w.pellets > 1 ? 1 : 1), eh.part, p, { from: o, pierce: !!w.pierce, weapon: w.id, crit: eh.part === 'head' || eh.part === 'core' });
    if (dmg === -1) { end = p; out.hit = false; break; }
    out.hit = true; if (eh.part === 'head' || eh.part === 'core') out.crit = true; if (before && !e.alive) out.kill = true;
    const n = d.clone().negate(); fx.impact(p, n, e.type === 'heavy' ? [1, 0.8, 0.3] : [1, 0.65, 0.25], w.pellets > 1 ? 0.5 : 1);
    fx.burstGlow(p, [3.5, 2.6, 0.6], w.pellets > 1 ? 2 : 4, 3, 0.12, 0.35);
    dmgNum(p, Math.round(dmg), eh.part === 'head' || eh.part === 'core');
    hits++; end = p;
    if (!w.pierce || hits > 5) break;
    travelled += eh.t + 0.6; from = p.clone().addScaledVector(d, 0.6);
  }
  if (!out.hit || w.pierce) {
    if (!w.pierce && end.distanceTo(o) < wallT - 0.01 && !out.hit) { /* blocked by shield */ }
    else if (wallC) {
      const p = o.clone().addScaledVector(d, wallT); if (!w.pierce || !out.hit) end = p; else end = p;
      if (wallC.ref?.canister) hitCanister(wallC.ref, w.dmg);
      fx.impact(p, wn, w.id === 'rail' ? [1.2, 0.5, 1.6] : [1, 0.85, 0.5], w.pellets > 1 ? 0.35 : 0.8); fx.decal(p, wn, w.id === 'rail' ? 0.5 : w.pellets > 1 ? 0.18 : 0.26);
    }
  }
  // tracer from the muzzle
  if (w.id === 'rail') { fx.tracer(mz, end, w.col, 0.07, 0.35); fx.tracer(mz, end, [3, 3, 3], 0.02, 0.2); for (let i = 0; i < 12; i++) { V.lerpVectors(mz, end, i / 12); fx.glow.add(V.x, V.y, V.z, rand(-.3, .3), rand(-.3, .3), rand(-.3, .3), 0.5, 0.25, 1.6, 0.6, 2.6, 1, 0.3, 0, 1); } }
  else fx.tracer(mz, end, w.col, w.pellets > 1 ? 0.018 : 0.028, w.pellets > 1 ? 0.07 : 0.06);
  return out;
}

// arc grenades
const nades = [];
const nadeGeo = new THREE.SphereGeometry(0.11, 14, 10), nadeMat = new THREE.MeshToonMaterial({ color: 0x36c8ff, gradientMap: RAMP, emissive: 0x0a3a66 }), nadeGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 3, 4), toneMapped: false });
function throwNade() {
  if (W.nades <= 0 || W.nadeCool > 0 || player.dead || W.swap > 0) return;
  W.nades--; W.nadeCool = 0.8; snd.throwG(); W.swap = 0.3;
  const m = new THREE.Mesh(nadeGeo, nadeMat); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 6, 16), nadeGlow); m.add(ring); m.add(new THREE.Mesh(nadeGeo, OLG)); scene.add(m);
  const d = camDir(new THREE.Vector3()); const p = cam.getWorldPosition(new THREE.Vector3()).addScaledVector(d, 0.6); p.y -= 0.15;
  nades.push({ m, p, v: d.multiplyScalar(17).add(new THREE.Vector3(0, 4.5, 0)), t: 1.35 }); hudAmmo();
}
function updateNades(dt) {
  for (let i = nades.length - 1; i >= 0; i--) {
    const n = nades[i]; n.t -= dt; n.v.y -= 15 * dt;
    const np = n.p.clone().addScaledVector(n.v, dt);
    if (np.y < 0.11) { np.y = 0.11; n.v.y *= -0.45; n.v.x *= 0.7; n.v.z *= 0.7; }
    if (solidAt(np)) { // bounce: find axis
      const tx = n.p.clone(); tx.x = np.x; if (solidAt(tx)) n.v.x *= -0.5; const tz = n.p.clone(); tz.z = np.z; if (solidAt(tz)) n.v.z *= -0.5; const ty = n.p.clone(); ty.y = np.y; if (solidAt(ty)) n.v.y *= -0.4; np.copy(n.p);
    }
    n.p.copy(np); n.m.position.copy(n.p); n.m.rotation.x += dt * 10; n.m.children[0].scale.setScalar(1 + Math.sin(n.t * 30) * 0.3);
    if (Math.random() < 0.5) fx.glow.add(n.p.x, n.p.y, n.p.z, 0, 0, 0, 0.25, 0.12, 0.6, 2, 3, 1);
    if (n.t <= 0) {
      scene.remove(n.m); nades.splice(i, 1);
      explode(n.p.clone(), 5.5, 150, { col: [0.8, 2.4, 4.2], scale: 1.1, arc: true, player: true });
    }
  }
}

// ---------------------------------------------------------------- explosions, canisters, damage
function explode(p, radius, dmg, o = {}) {
  fx.explode(p, o.scale || 1, o.col || [3.2, 1.5, 0.45]); const d = p.distanceTo(player.pos); snd.boom(d, o.scale || 1); shakeA = Math.min(1.4, shakeA + clamp(10 / (d + 2), 0, 1) * (o.scale || 1));
  if (o.arc) { snd.arc(d); for (const e of enemies.list) if (e.alive && e.root.position.distanceTo(p) < radius + 3) { V.copy(e.root.position); V.y += e.type === 'drone' ? 0 : 1.2; fx.arc(p, V.clone(), [1.2, 2.6, 4.5], 0.25); fx.arc(p, V.clone(), [2, 3, 4], 0.2); } }
  if (dmg > 0) {
    if (!o.enemy || true) for (const e of [...enemies.list]) { if (!e.alive) continue; const ed = e.root.position.distanceTo(p) - STATS[e.type].r; if (ed < radius) { if (o.enemy && e.type === 'boss') continue; const k = 1 - Math.max(0, ed) / radius; const before = e.alive; const dd = enemies.damage(e, dmg * (0.4 + 0.6 * k) * (o.enemy ? 0.6 : 1), 'body', V.copy(e.root.position).setY(1.2), { splash: true, from: p }); if (dd > 0) dmgNum(V.copy(e.root.position).setY(e.type === 'drone' ? e.root.position.y + 0.6 : 2.2), Math.round(dd), false); if (before && !e.alive) hitMarker('kill'); } }
    if ((o.enemy && !o.noPlayerDirect) || o.player) { const pd = p.distanceTo(V.copy(player.pos).setY(player.pos.y + 1)); if (pd < radius) hurtPlayer(dmg * (1 - pd / radius) * (o.enemy ? 1 : 0.35), p, 'splash'); }
    if (L) for (const c of L.dynamic.canisters) if (!c.dead && Math.hypot(c.x - p.x, c.z - p.z) < radius) setTimeout(() => hitCanister(c, 100), 90 + Math.random() * 120);
  }
}
function hitCanister(c, dmg) { if (c.dead) return; c.hp -= dmg; c.flash = 1; if (c.hp <= 0) { c.dead = true; c.col.off = true; c.g.visible = false; explode(new THREE.Vector3(c.x, 0.8, c.z), 5, 120, { scale: 1.2, player: true }); fx.decal(new THREE.Vector3(c.x, 0.01, c.z), new THREE.Vector3(0, 1, 0), 2.6); } else if (c.hp < 20 && !c.leak) { c.leak = 1; } }
function hurtPlayer(dmg, from, kind) {
  if (player.dead || state !== 'play' || intro > 0) return;
  player.regen = 3.5; const hadShield = player.shield > 0;
  if (player.shield > 0) { player.shield -= dmg; if (player.shield <= 0) { player.hp += player.shield; player.shield = 0; snd.shieldDown(); $('hurt').style.opacity = 1; setTimeout(() => $('hurt').style.opacity = 0, 250); } }
  else player.hp -= dmg;
  snd.hurt(player.shield > 0); shakeA = Math.min(1.2, shakeA + 0.25);
  if (hadShield) { $('hurt').style.opacity = 0.7; setTimeout(() => $('hurt').style.opacity = 0, 120); }
  // direction indicator
  if (from) { const a = Math.atan2(from.x - player.pos.x, from.z - player.pos.z), rel = a - Math.atan2(-Math.sin(player.yaw), -Math.cos(player.yaw)); const el = document.createElement('i'); el.style.transform = `rotate(${-rel}rad)`; $('dmgDirs').appendChild(el); requestAnimationFrame(() => el.style.opacity = 1); setTimeout(() => el.style.opacity = 0, 350); setTimeout(() => el.remove(), 1000); }
  if (player.hp <= 0) { player.hp = 0; die(); }
  hudVitals();
}
function onKill(e, o) {
  const st = STATS[e.type]; let pts = st.score, tag = '';
  if (o.crit) { pts += 50; tag = 'HEADSHOT'; }
  combo.n = combo.t > 0 ? combo.n + 1 : 1; combo.t = 2.6;
  if (combo.n >= 2) { const b = combo.n * 75; pts += b; tag = ['', '', 'DOUBLE KILL', 'TRIPLE KILL', 'MULTI KILL', 'RAMPAGE'][Math.min(5, combo.n)] || 'RAMPAGE'; }
  if (e.type === 'boss') { tag = 'WARDEN DESTROYED'; }
  addScore(pts); V.copy(e.root.position); V.y += e.type === 'drone' ? 0.6 : e.type === 'boss' ? 6 : 2.4; scorePop(V, '+' + pts, tag);
  if (tag) { $('combo').textContent = tag; clearTimeout(onKill.t); onKill.t = setTimeout(() => $('combo').textContent = '', 1400); }
  if (e.type === 'heavy') W.nades = Math.min(4, W.nades + 1);
  if (Math.random() < (e.type === 'drone' ? 0.12 : 0.25)) dropPickup(e.root.position);
  hudAmmo();
}
function addScore(n) { score += n; $('score').textContent = score.toLocaleString('en-US'); if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#ffd23a', 40, 30); fx.burstGlow(V.copy(player.pos).setY(2), [4, 3, 0.5], 30, 4, 0.3, 1); } }

// pickups
const pickups = [], pkGeo = new THREE.OctahedronGeometry(0.22, 0);
function dropPickup(p) {
  const kind = Math.random() < 0.6 ? 'hp' : 'nade';
  const m = new THREE.Mesh(pkGeo, new THREE.MeshToonMaterial({ color: kind === 'hp' ? 0x4dff6a : 0x36c8ff, gradientMap: RAMP, emissive: kind === 'hp' ? 0x0a5a1a : 0x0a3a66 }));
  m.add(new THREE.Mesh(pkGeo, OLG)); m.position.set(p.x, 0.6, p.z); scene.add(m); pickups.push({ m, kind, t: 20 });
}
function updatePickups(dt, t) {
  for (let i = pickups.length - 1; i >= 0; i--) { const k = pickups[i]; k.t -= dt; k.m.rotation.y += dt * 3; k.m.position.y = 0.6 + Math.sin(t * 3 + i) * 0.12;
    if (Math.random() < 0.15) fx.glow.add(k.m.position.x, k.m.position.y, k.m.position.z, 0, 0.6, 0, 0.6, 0.1, k.kind === 'hp' ? 0.6 : 0.5, k.kind === 'hp' ? 3 : 2, k.kind === 'hp' ? 0.8 : 3.5, 1);
    if (Math.hypot(k.m.position.x - player.pos.x, k.m.position.z - player.pos.z) < 1.4 || k.t <= 0) {
      if (k.t > 0) { snd.pickup(); if (k.kind === 'hp') { player.hp = Math.min(100, player.hp + 35); player.shield = Math.min(100, player.shield + 25); scorePop(k.m.position, '+HP', ''); } else { W.nades = Math.min(4, W.nades + 1); scorePop(k.m.position, '+1 ARC', ''); } hudVitals(); hudAmmo(); }
      scene.remove(k.m); pickups.splice(i, 1);
    } }
}

// missile ground markers (boss)
const markers = [];
function marker(p, r, life) { const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.88, r, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.4, 0.3), transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.05, p.z); scene.add(m);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(r, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 0.2, 0.15), transparent: true, opacity: 0.25, toneMapped: false, depthWrite: false })); m.add(inner); inner.position.z = -0.01; markers.push({ m, inner, t: life, l: life }); }
function updateMarkers(dt) { for (let i = markers.length - 1; i >= 0; i--) { const k = markers[i]; k.t -= dt; k.inner.scale.setScalar(1 - k.t / k.l); k.m.material.opacity = 0.5 + 0.5 * Math.sin(k.t * 20); if (k.t <= 0) { scene.remove(k.m); markers.splice(i, 1); } } }

// ---------------------------------------------------------------- level load
function unload() {
  if (!L) return;
  L.group.traverse(o => { if (o.isMesh) { if (o.userData.shared || o.material === mats.wall || o.material === mats.hazard || o.material === mats.glowA || o.material === mats.trim || o.material === mats.paint || o.material === mats.field) { o.geometry.dispose(); o.material = null; } } });
  scene.remove(L.group); enemies.clear(); fx.clear(); for (const n of nades) scene.remove(n.m); nades.length = 0; for (const k of pickups) scene.remove(k.m); pickups.length = 0; for (const k of markers) scene.remove(k.m); markers.length = 0; L = null;
}
const canGeo = (() => { const parts = []; const add = (g, c, y) => { g = g.toNonIndexed(); const n = g.attributes.position.count, a = new Float32Array(n * 3), col = new THREE.Color(c); for (let i = 0; i < n; i++) a.set([col.r, col.g, col.b], i * 3); g.deleteAttribute('uv'); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.translate(0, y, 0); parts.push(g); };
  add(new THREE.CylinderGeometry(0.42, 0.42, 1.1, 20), 0xff3a3a, 0.62); add(new THREE.CylinderGeometry(0.44, 0.44, 0.12, 20), 0xf4f6fa, 0.3); add(new THREE.CylinderGeometry(0.44, 0.44, 0.12, 20), 0xf4f6fa, 0.95); add(new THREE.CylinderGeometry(0.3, 0.36, 0.12, 16), 0x2a2f55, 1.22); add(new THREE.CylinderGeometry(0.36, 0.3, 0.08, 16), 0x2a2f55, 0.04); add(new THREE.CylinderGeometry(0.08, 0.08, 0.14, 8), 0xffd23a, 1.32);
  return mergeAll(parts); });
let CANGEO = null;
function loadMission(def, m) {
  unload(); mission = def; mode = m;
  seedRnd = m === 'holdout' ? rng((D.isDaily && D.seed) || (holdoutSeed = (Math.random() * 1e9) | 0)) : rng(def.id * 7919 + 13);
  L = buildLevel(def, mats, seedRnd); scene.add(L.group);
  const th = def.theme;
  scene.fog = new THREE.Fog(th.fog, th.fogNear || 22, th.fogFar || 130);
  hemi.color.set(th.hemi[0]); hemi.groundColor.set(th.hemi[1]); hemi.intensity = th.hemi[2];
  sun.color.set(th.sun[0]); sun.intensity = th.sun[1]; renderer.toneMappingExposure = th.exposure || 1.08;
  space.set(th.space);
  // dynamic props
  const dyn = L.dynamic = { canisters: [], vents: L.dyn.vents, beacons: [], reactor: null, holo: null };
  CANGEO = CANGEO || canGeo();
  const canMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: RAMP });
  for (const c of L.dyn.canisters) { const g = new THREE.Group(); const m = new THREE.Mesh(CANGEO, canMat); m.castShadow = true; g.add(m); g.add(new THREE.Mesh(CANGEO, outlineMat(0.02))); const band = new THREE.Mesh(new THREE.CylinderGeometry(0.425, 0.425, 0.08, 20), mats.glowB); band.position.y = 0.62; g.add(band);
    g.position.set(c.x, 0, c.z); g.rotation.y = Math.random() * 6; L.group.add(g); const col = { x0: c.x - 0.42, x1: c.x + 0.42, z0: c.z - 0.42, z1: c.z + 0.42, y0: 0, y1: 1.3, off: false }; const can = { x: c.x, z: c.z, hp: 25, g, col, m: canMat, flash: 0 }; col.ref = { canister: true }; Object.assign(col.ref, { get dead() { return can.dead; } }); col.ref = can; can.canister = true; L.cols.push(col); dyn.canisters.push(can); }
  for (const b of L.dyn.beacons) { const g = new THREE.Group(); g.position.copy(b); const cone = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI), new THREE.MeshBasicMaterial({ color: new THREE.Color(th.alarm ? 3 : 0.4, th.alarm ? 0.4 : 1.5, th.alarm ? 0.3 : 2.5), toneMapped: false })); cone.rotation.y = Math.PI / 2; g.add(cone); const cap = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 8, Math.PI, Math.PI), mats.glass); cap.rotation.y = Math.PI / 2; g.add(cap); L.group.add(g); dyn.beacons.push(g); }
  if (L.dyn.reactor) { const r = L.dyn.reactor, g = new THREE.Group(); g.position.set(r.x, 0, r.z); const core = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, r.h - 3, 24, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.5, 0.4), toneMapped: false })); core.position.y = r.h / 2; g.add(core);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, r.h - 3, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.4, 1.8), toneMapped: false })); inner.position.y = r.h / 2; g.add(inner);
    const rings = []; for (let i = 0; i < 4; i++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.18, 8, 40), mats.trim); ring.rotation.x = Math.PI / 2; ring.position.y = 3 + i * (r.h - 6) / 3; g.add(ring); ring.add(new THREE.Mesh(ring.geometry, outlineMat(0.03))); rings.push(ring); }
    L.group.add(g); dyn.reactor = { g, core, rings, inner }; const rl = new THREE.PointLight(0xffa040, 30, 26, 1.6); rl.position.set(r.x, 6, r.z); L.group.add(rl); dyn.reactorLight = rl; }
  if (L.dyn.holo) { const h = L.dyn.holo, g = new THREE.Group(); g.position.set(h.x, 2.3, h.z); const e = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.4, 2.6), wireframe: true, toneMapped: false, transparent: true, opacity: 0.7 })); g.add(e);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.02, 6, 48), mats.holo); ring.rotation.x = 1.2; g.add(ring); const cone = new THREE.Mesh(new THREE.ConeGeometry(1.4, 1.3, 24, 1, true), mats.holo); cone.position.y = -0.75; cone.rotation.x = Math.PI; g.add(cone); L.group.add(g); dyn.holo = g; }
  // zone ring for hack/defend/reach
  const zr = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.6, 1.2), transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false, side: THREE.DoubleSide })); zr.rotation.x = -Math.PI / 2; zr.visible = false; L.group.add(zr);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 6, 32, 1, true), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uC: { value: new THREE.Color(0.3, 1.6, 0.8) }, uT: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }', fragmentShader: 'varying vec2 vUv; uniform vec3 uC; uniform float uT; void main(){ float a = pow(1. - vUv.y, 2.) * (.55 + .45 * sin(vUv.y * 30. - uT * 6.)); gl_FragColor = vec4(uC * a, 1.); }' }));
  beam.position.y = 3; zr.add(beam); beam.rotation.x = Math.PI / 2; beam.position.set(0, 0, -3); L.zone = zr; L.zoneBeam = beam;
  // signs etc. never move
  enemies.clear(); spawnRoom(0);
  // player start
  const R0 = L.rooms[0]; player.pos.set(R0.cx, 0, R0.z0 - 2.5); player.yaw = 0; player.pitch = -0.02; player.vy = 0; player.shield = 100; player.hp = 100; player.dead = false; player.regen = 0; deadT = 0;
  W.ammo = WEAPONS.map(w => w.mag); W.reloading = 0; W.cool = 0; W.nades = 3; W.cur = 0; W.swap = 0; GUNS.forEach((g, k) => g.visible = k === 0);
  obj = { i: 0, prog: 0, wave: 0, timer: 0, started: false, done: false };
  if (def.holdout) holdout = { wave: 0, queue: [], spawnT: 0, breakT: 2.5, alive: 0 }; else holdout = null;
  score = 0; runT = 0; beatenShown = false; combo.n = 0; $('score').textContent = '0'; $('combo').textContent = '';
  setObjectiveText(); hudVitals(); hudAmmo(); assignLights(true);
}
function spawnRoom(i) { const R = L.rooms[i]; if (!R || R.spawned) return; R.spawned = true; for (const [t, x, z] of R.def.en || []) enemies.spawn(t, R.cx + x, R.cz + z, i); }
function openDoor(i) { const d = L.doors.find(d => d.room === i); if (d && d.target !== 1) { d.target = 1; snd.door(); d.status.material.color.setRGB(0.3, 3, 0.8); } spawnRoom(i + 1); }

// ---------------------------------------------------------------- objectives
function curRoom() { return L.rooms[obj.i]; }
function objPoint(out) {
  const R = curRoom(), o = R.def.obj;
  if (o.at) return out.set(R.cx + o.at[0], 0, R.cz + o.at[1]);
  if (o.type === 'clear' || o.type === 'boss') { const a = enemies.alive(obj.i); if (a.length && roomAt(player.pos.x, player.pos.z) === obj.i) return null; if (roomAt(player.pos.x, player.pos.z) !== obj.i) return out.set(R.cx, 0, R.cz); return null; }
  return null;
}
function setObjectiveText() {
  const o = curRoom().def.obj;
  $('objTag').textContent = mode === 'holdout' ? (D.isDaily ? 'DAILY HOLDOUT' : 'HOLDOUT') + ' · CARGO RING' : `MISSION ${mission.id} · ${mission.name}`;
  $('objTxt').textContent = mode === 'holdout' ? (holdout && holdout.wave ? `Wave ${holdout.wave}: destroy every robot` : 'Get ready…') : o.text;
  $('objBar').style.display = ['hack', 'defend', 'escape'].includes(o.type) ? 'block' : 'none'; $('objBar').firstChild.style.width = '0%';
  $('obj').classList.remove('alert');
}
function completeObjective() {
  const R = curRoom(), o = R.def.obj; addScore(500); snd.objective(); W.nades = Math.min(4, W.nades + 1); hudAmmo();
  banner('OBJECTIVE COMPLETE', '+500', 1.6, '#7cff6b');
  if (obj.i >= L.rooms.length - 1) return missionComplete();
  openDoor(obj.i); obj.i++; obj.prog = 0; obj.wave = 0; obj.started = false; obj.timer = curRoom().def.obj.time || 0;
  setTimeout(() => { if (state === 'play') { setObjectiveText(); banner('NEW OBJECTIVE', curRoom().def.obj.text, 1.8, '#ffd23a'); } }, 1500);
}
function spawnWave(R, type) {
  const pts = (R.def.spawns || []).map(([x, z]) => new THREE.Vector3(R.cx + x, 0, R.cz + z)).sort((a, b) => b.distanceTo(player.pos) - a.distanceTo(player.pos));
  const p = pts[Math.floor(seedRnd() * Math.min(3, pts.length))] || new THREE.Vector3(R.cx, 0, R.cz);
  return enemies.spawn(type, p.x + rand(-1, 1), p.z + rand(-1, 1), R.i, { warp: true });
}
function updateObjective(dt) {
  if (!L || state !== 'play' || intro > 0) return;
  const R = curRoom(), o = R.def.obj, zc = objPoint(V);
  const inside = o.at && Math.hypot(player.pos.x - (R.cx + o.at[0]), player.pos.z - (R.cz + o.at[1])) < (o.r || 2.3);
  // zone ring
  if (o.at) { L.zone.visible = true; L.zone.position.set(R.cx + o.at[0], 0.06, R.cz + o.at[1]); L.zone.scale.setScalar(o.r || 2.3); L.zoneBeam.material.uniforms.uT.value += dt; const c = inside ? [0.6, 2.8, 1.2] : o.type === 'escape' || o.type === 'reach' ? [0.4, 1.8, 3] : [3, 2.2, 0.4]; L.zone.material.color.setRGB(...c); L.zoneBeam.material.uniforms.uC.value.setRGB(c[0] * 0.5, c[1] * 0.5, c[2] * 0.5); }
  else L.zone.visible = false;
  switch (o.type) {
    case 'clear': if (R.spawned && enemies.alive(obj.i).length === 0) completeObjective(); break;
    case 'boss': { const b = enemies.boss(); $('bossBar').style.display = b ? 'block' : 'none'; if (b) $('bossBar').querySelector('i').style.width = Math.max(0, b.hp / b.max * 100) + '%'; if (R.spawned && !b) { $('bossBar').style.display = 'none'; completeObjective(); } break; }
    case 'hack': case 'defend': {
      if (inside) { if (!obj.started) { obj.started = true; banner(o.type === 'hack' ? 'HACKING…' : 'HOLD THE ZONE', 'Stay inside the ring', 1.4, '#7cff6b'); } obj.prog = Math.min(1, obj.prog + dt / o.time); if (Math.random() < dt * 4) snd.beep(Math.random() < 0.5); }
      $('obj').classList.toggle('alert', obj.started && !inside);
      $('objTxt').textContent = obj.started && !inside ? 'Get back in the ring!' : o.text;
      $('objBar').firstChild.style.width = obj.prog * 100 + '%';
      const waves = R.def.waves || []; while (obj.started && obj.wave < waves.length && obj.prog >= (obj.wave + 0.4) / (waves.length + 0.3)) spawnWave(R, waves[obj.wave++]);
      if (obj.prog >= 1) completeObjective();
      break; }
    case 'reach': if (inside) completeObjective(); break;
    case 'escape': {
      if (!obj.started) { obj.started = true; obj.timer = o.time; }
      obj.timer -= dt; $('objTxt').textContent = `${o.text}: ${Math.max(0, obj.timer).toFixed(1)}s`; $('objBar').firstChild.style.width = Math.max(0, obj.timer / o.time * 100) + '%'; $('obj').classList.toggle('alert', obj.timer < 10);
      const waves = R.def.waves || []; if (obj.wave < waves.length && o.time - obj.timer > 4 + obj.wave * 6) spawnWave(R, waves[obj.wave++]);
      if (inside) completeObjective(); else if (obj.timer <= 0) lose('OUT OF TIME', 'The pod launched without you.');
      break; }
    case 'waves': updateHoldout(dt); break;
  }
}
let holdoutSeed = 0;
function updateHoldout(dt) {
  const H = holdout, R = L.rooms[0];
  if (H.breakT > 0) { H.breakT -= dt; if (H.breakT <= 0) { H.wave++; const n = 3 + Math.floor(H.wave * 1.6); H.queue = [];
      for (let i = 0; i < n; i++) { const r = seedRnd(); H.queue.push(H.wave >= 3 && i % Math.max(3, 8 - Math.floor(H.wave / 3)) === 2 ? 'heavy' : r < 0.45 ? 'drone' : 'walker'); }
      if (H.wave % 8 === 0) H.queue.push('boss');
      banner(`WAVE ${H.wave}`, `${H.queue.length} hostiles inbound`, 1.8, '#ff3a6e'); setObjectiveText(); }
    return; }
  H.spawnT -= dt;
  if (H.queue.length && H.spawnT <= 0 && enemies.count() < 9) { H.spawnT = 0.7; spawnWave(R, H.queue.shift()); }
  const b = enemies.boss(); $('bossBar').style.display = b ? 'block' : 'none'; if (b) $('bossBar').querySelector('i').style.width = Math.max(0, b.hp / b.max * 100) + '%';
  $('objTxt').textContent = `Wave ${H.wave}: ${H.queue.length + enemies.count()} robots left`;
  if (!H.queue.length && enemies.count() === 0 && !enemies.list.some(e => e.dying)) { const bonus = 100 * H.wave; addScore(bonus); snd.objective(); banner(`WAVE ${H.wave} CLEARED`, `+${bonus}`, 1.8, '#7cff6b'); H.breakT = 3.5; player.shield = 100; W.nades = Math.min(4, W.nades + 1); hudVitals(); hudAmmo(); }
}

// ---------------------------------------------------------------- end states
function missionComplete() {
  state = 'won'; const t = runT; const timeB = Math.max(0, Math.round((mission.par - t) * 10)), hpB = Math.round((player.hp + player.shield) * 3);
  addScore(timeB + hpB); snd.win(); setIntensity(0.2); setAlarm(false); document.exitPointerLock?.();
  const best = S.get('best' + mission.id, 0); if (score > best) S.set('best' + mission.id, score);
  if (mission.id + 1 > unlocked) { unlocked = Math.min(MISSIONS.length + 1, mission.id + 1); S.set('unlocked', unlocked); }
  Fm.level(true); B.submit(score, { ms: t * 1000 }); D.won(score);
  ui.win(mission.id, '');
  const w = ui.els.win; w.querySelector('p').innerHTML = `MISSION ${mission.id} · ${mission.name}`; w.querySelector('h1').textContent = mission.id === MISSIONS.length ? 'STATION SAVED!' : 'MISSION COMPLETE';
  let brk = w.querySelector('.brk'); if (!brk) { brk = document.createElement('div'); brk.className = 'brk'; w.querySelector('[data-x]').after(brk); }
  brk.innerHTML = `Time ${t.toFixed(0)}s · time bonus <span>+${timeB}</span><br>Health bonus <span>+${hpB}</span><br>SCORE <span style="font-size:26px">${score.toLocaleString('en-US')}</span>${score > best ? ' · NEW BEST' : ''}${mission.id === 1 ? '<br>Unlocked: <span>SCATTER GUN</span>' : mission.id === 2 ? '<br>Unlocked: <span>RAIL LANCE</span>' : ''}`;
  w.querySelector('.hint').textContent = mission.id < MISSIONS.length ? `Tap for mission ${mission.id + 1}` : 'Tap for the menu';
  $('hud').classList.add('off');
}
function die() { player.dead = true; deadT = 0; snd.lose(); setTimeout(() => lose('DOWN!', ''), 900); }
function lose(title, line) {
  if (state !== 'play') return; state = 'lost'; setIntensity(0.1); setAlarm(false); document.exitPointerLock?.();
  B.submit(score, { ms: runT * 1000 });
  if (mode === 'holdout') { Fh.endless(score); const best = S.get('bestH', 0); if (score > best) S.set('bestH', score); line = `Reached wave ${holdout.wave} · score ${score.toLocaleString('en-US')}${score > best ? ' · NEW BEST' : ''}`; title = title === 'DOWN!' ? 'OVERRUN!' : title; }
  else { Fm.level(false, obj.i / L.rooms.length); line = line || `Score ${score.toLocaleString('en-US')} · objective ${obj.i + 1}/${L.rooms.length}`; }
  ui.lose(title, line); ui.els.lose.querySelector('.hint').textContent = 'Tap to retry';
  $('hud').classList.add('off');
}

// ---------------------------------------------------------------- HUD
function banner(t, sub = '', secs = 1.5, col = '#fff') { const b = $('banner'); b.innerHTML = `${t}${sub ? `<small>${sub}</small>` : ''}`; b.style.color = col; b.classList.add('on'); clearTimeout(banner.t); banner.t = setTimeout(() => b.classList.remove('on'), secs * 1000); }
function hudVitals() { $('shBar').style.width = Math.max(0, player.shield) + '%'; $('hpBar').style.width = Math.max(0, player.hp) + '%'; $('shNum').textContent = Math.ceil(Math.max(0, player.shield)); $('hpNum').textContent = Math.ceil(Math.max(0, player.hp)); $('hpBar').parentNode.classList.toggle('low', player.hp < 35); $('vig').style.opacity = player.hp < 60 ? (1 - player.hp / 60) * 0.9 : 0; }
function hudAmmo() { const w = WEAPONS[W.cur]; $('wname').textContent = w.name; $('amag').textContent = W.ammo[W.cur]; $('amax').textContent = w.mag; $('acount').classList.toggle('low', W.ammo[W.cur] <= w.mag * 0.25); $('nades').textContent = '⚡'.repeat(W.nades) + ' ARC'; $('nadeN').textContent = W.nades; $('reloadTip').style.display = W.ammo[W.cur] === 0 || W.reloading > 0 ? 'block' : 'none'; $('reloadTip').textContent = W.reloading > 0 ? 'RELOADING…' : 'RELOAD'; }
function hitMarker(k) { const h = $('hitm'); h.className = 'on ' + k; snd[k === 'crit' ? 'crit' : 'hit'](); clearTimeout(hitMarker.t); hitMarker.t = setTimeout(() => h.className = k, 70); }
const nums = []; for (let i = 0; i < 24; i++) { const s = document.createElement('span'); s.style.display = 'none'; $('nums').appendChild(s); nums.push({ s, t: 0, p: new THREE.Vector3() }); }
let numI = 0;
function dmgNum(p, n, crit) { if (n <= 0) return; const k = nums[numI++ % nums.length]; k.p.copy(p).add(new THREE.Vector3(rand(-.3, .3), rand(0, .3), rand(-.3, .3))); k.t = 0.8; k.s.textContent = n; k.s.className = crit ? 'c' : ''; k.s.style.display = 'block'; }
function scorePop(p, text, tag) { const k = nums[numI++ % nums.length]; k.p.copy(p); k.t = 1.1; k.s.textContent = text; k.s.className = 's'; k.s.style.display = 'block'; if (tag) ui.pop(tag, '#ffd23a', 30, 24); }
function updateNums(dt) {
  for (const k of nums) { if (k.t <= 0) continue; k.t -= dt; k.p.y += dt * 1.2; V.copy(k.p).project(cam); if (V.z > 1 || k.t <= 0) { k.s.style.display = 'none'; k.t = 0; continue; }
    k.s.style.left = (V.x * 0.5 + 0.5) * innerWidth + 'px'; k.s.style.top = (-V.y * 0.5 + 0.5) * innerHeight + 'px'; k.s.style.opacity = Math.min(1, k.t * 3); k.s.style.transform = `translate(-50%,-50%) scale(${1 + Math.max(0, k.t - 0.6) * 1.5})`; }
}
function updateWaypoint() {
  const wp = $('wp'); if (!L || state !== 'play' || intro > 0) { wp.style.display = 'none'; return; }
  let p = objPoint(V2); if (!p && curRoom().def.obj.type !== 'waves') { // point at nearest enemy if none visible for a while
    p = null; }
  if (!p) { wp.style.display = 'none'; return; }
  p = p.clone(); p.y = 1.6; const d = p.distanceTo(player.pos); V.copy(p).project(cam);
  let x = V.x, y = V.y; const behind = V.z > 1; if (behind) { x = -x; y = -1; }
  const m = 0.86; if (behind || Math.abs(x) > m || Math.abs(y) > m) { const s = m / Math.max(Math.abs(x), Math.abs(y)); x *= s; y *= s; }
  wp.style.display = 'block'; wp.style.left = (x * 0.5 + 0.5) * innerWidth + 'px'; wp.style.top = (-y * 0.5 + 0.5) * innerHeight + 'px'; $('wpd').textContent = Math.round(d) + 'm';
}

// ---------------------------------------------------------------- input
const keys = {}; let stick = null, look = null, mouseDown = false, locked = false, botOn = false, botT = 0;
const inp = { mx: 0, mz: 0, sprint: false, jump: false };
addEventListener('keydown', e => { keys[e.code] = true; if (state !== 'play') return; if (e.code === 'KeyR') reload(); if (e.code === 'Digit1') selectWeapon(0); if (e.code === 'Digit2') selectWeapon(1); if (e.code === 'Digit3') selectWeapon(2); if (e.code === 'KeyQ') selectWeapon((W.cur + 1) % owned()); if (e.code === 'KeyG' || e.code === 'KeyF') throwNade(); if (e.code === 'Space') { inp.jump = true; e.preventDefault(); } });
addEventListener('keyup', e => { keys[e.code] = false; });
setTimeout(() => $('lockTip').style.opacity = 0, 15000); $('lockTip').style.transition = 'opacity 1s';
document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === renderer.domElement; $('lockTip').style.display = locked || TOUCH ? 'none' : 'block'; });
renderer.domElement.addEventListener('mousedown', e => {
  if (TOUCH || state !== 'play') return; initAudio();
  if (intro > 0) { intro = 0.01; return; }
  if (!locked) { try { const r = renderer.domElement.requestPointerLock(); r && r.catch && r.catch(() => {}); } catch (err) {} mouseDown = e.button === 0; return; }
  if (e.button === 0) mouseDown = true; if (e.button === 2) throwNade();
});
addEventListener('mouseup', () => mouseDown = false);
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousemove', e => { if (TOUCH || state !== 'play' || player.dead) return; if (locked || mouseDown) { const s = 0.0022 * (cam.fov / 72); player.yaw -= e.movementX * s; player.pitch = clamp(player.pitch - e.movementY * s, -1.45, 1.45); } });
addEventListener('wheel', e => { if (state === 'play') selectWeapon((W.cur + (e.deltaY > 0 ? 1 : owned() - 1)) % owned()); });
// touch: left half = floating stick, right half = look, fire button also looks while held
const lookSens = () => 0.0058 * (cam.fov / 80) * (assistOn ? 0.55 : 1);
let assistOn = false;
addEventListener('pointerdown', e => {
  initAudio();
  if (!TOUCH || state !== 'play' || e.target.closest('.tb,.bd-trophy,#bMute,.bd-wrap')) return;
  if (intro > 0) { intro = 0.01; return; }
  if (e.clientX < innerWidth * 0.45 && !stick) { stick = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0 }; const s = $('stick'); s.style.display = 'block'; s.style.left = e.clientX + 'px'; s.style.top = e.clientY + 'px'; s.style.bottom = 'auto'; s.firstChild.style.transform = ''; }
  else if (!look) look = { id: e.pointerId, x: e.clientX, y: e.clientY };
});
addEventListener('pointermove', e => {
  if (stick && e.pointerId === stick.id) { let dx = e.clientX - stick.x, dy = e.clientY - stick.y; const d = Math.hypot(dx, dy), m = 50; if (d > m) { dx *= m / d; dy *= m / d; } stick.dx = dx / m; stick.dy = dy / m; $('stick').firstChild.style.transform = `translate(${dx}px,${dy}px)`; }
  if (look && e.pointerId === look.id) { const s = lookSens(); player.yaw -= (e.clientX - look.x) * s; player.pitch = clamp(player.pitch - (e.clientY - look.y) * s, -1.4, 1.4); look.x = e.clientX; look.y = e.clientY; }
});
const endPtr = e => { if (stick && e.pointerId === stick.id) { stick = null; $('stick').style.display = 'none'; } if (look && e.pointerId === look.id) look = null; };
addEventListener('pointerup', endPtr); addEventListener('pointercancel', endPtr);
function tb(id, down, up) { const b = $(id); b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); initAudio(); b.classList.add('on'); if (intro > 0) { intro = 0.01; return; } down(e); }); const u = e => { b.classList.remove('on'); up && up(e); }; b.addEventListener('pointerup', u); b.addEventListener('pointercancel', u); b.addEventListener('pointerleave', u); }
tb('bFire', e => { W.fireHeld = true; if (!look) look = { id: e.pointerId, x: e.clientX, y: e.clientY }; }, e => { W.fireHeld = false; if (look && look.id === e.pointerId) look = null; });
tb('bJump', () => inp.jump = true); tb('bReload', reload); tb('bNade', throwNade); tb('bSwap', () => selectWeapon((W.cur + 1) % owned()));
$('bMute').addEventListener('pointerdown', e => { e.stopPropagation(); setMuted(!isMuted()); $('bMute').textContent = isMuted() ? '🔇' : '🔊'; });

// ---------------------------------------------------------------- player update
const FWD = new THREE.Vector3(), RIGHT = new THREE.Vector3();
function updatePlayer(dt) {
  if (player.dead) { deadT += dt; return; }
  let mx = 0, mz = 0;
  if (keys.KeyW || keys.ArrowUp) mz += 1; if (keys.KeyS || keys.ArrowDown) mz -= 1; if (keys.KeyA || keys.ArrowLeft) mx -= 1; if (keys.KeyD || keys.ArrowRight) mx += 1;
  if (stick) { mx += stick.dx; mz -= stick.dy; }
  if (botOn) { mx += bot.mx; mz += bot.mz; }
  const len = Math.hypot(mx, mz); if (len > 1) { mx /= len; mz /= len; }
  const sprint = (keys.ShiftLeft || keys.ShiftRight || (stick && Math.hypot(stick.dx, stick.dy) > 0.95 && stick.dy < -0.7) || (botOn && bot.sprint)) && mz > 0.3;
  const sp = (sprint ? 7.6 : 5.4) * (W.fireHeld || mouseDown ? 0.92 : 1);
  FWD.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw)); RIGHT.set(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  const tx = (FWD.x * mz + RIGHT.x * mx) * sp, tz = (FWD.z * mz + RIGHT.z * mx) * sp;
  player.vx = lerp(player.vx || 0, tx, Math.min(1, dt * (player.ground ? 12 : 3))); player.vz = lerp(player.vz || 0, tz, Math.min(1, dt * (player.ground ? 12 : 3)));
  const ox = player.pos.x, oz = player.pos.z;
  player.pos.x += player.vx * dt; player.pos.z += player.vz * dt;
  collide(player.pos, 0.42, player.pos.y + 0.42, player.pos.y + 1.75);
  const moved = Math.hypot(player.pos.x - ox, player.pos.z - oz); player.speed = moved / Math.max(dt, 1e-4);
  // vertical
  if (inp.jump && player.ground) { player.vy = 5.6; player.ground = false; }
  inp.jump = false;
  player.vy -= 16 * dt; player.pos.y += player.vy * dt;
  const g = groundAt(player.pos.x, player.pos.z, player.pos.y);
  if (player.pos.y <= g) { if (!player.ground && player.vy < -6) { snd.land(); shakeA += 0.15; } player.pos.y = g; player.vy = 0; player.ground = true; } else if (player.pos.y > g + 0.05) player.ground = false;
  // footsteps
  if (player.ground && moved > 0.001) { player.stepD += moved; player.bob += moved * (sprint ? 2.2 : 2.6); if (player.stepD > (sprint ? 2.1 : 1.7)) { player.stepD = 0; snd.step((player.bob * 10) | 0); } }
  player.sprint = sprint;
  // regen
  player.regen -= dt; if (player.regen <= 0) { if (player.shield < 100) { if (player.shield <= 0) snd.shieldUp(); player.shield = Math.min(100, player.shield + 45 * dt); } else if (player.hp < 100) player.hp = Math.min(100, player.hp + 8 * dt); }
  if (Math.random() < dt * 6) hudVitals();
}
function updateWeapons(dt) {
  const w = WEAPONS[W.cur];
  W.cool -= dt; W.nadeCool -= dt; W.bloom = Math.max(0, W.bloom - dt * 4);
  if (W.swap > 0) W.swap -= dt;
  if (W.reloading > 0) { W.reloading -= dt; if (W.reloading <= 0) { W.ammo[W.cur] = w.mag; hudAmmo(); } }
  const firing = (W.fireHeld || (mouseDown && locked) || (mouseDown && !TOUCH && !locked && navigator.webdriver) || (botOn && bot.fire)) && !player.dead && intro <= 0;
  if (firing && (w.auto || !W.firedOnce)) fire();
  if (!firing) W.firedOnce = false;
  // touch aim assist: slow down over targets + gentle pull while firing
  assistOn = false;
  if (TOUCH && state === 'play') { const t = aimAssistTarget(6); if (t) { assistOn = true; $('cross').classList.add('enemy'); if (firing || look) { const o = cam.getWorldPosition(V2); const want = Math.atan2(-(t.p.x - o.x), -(t.p.z - o.z)); let dy = want - player.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); player.yaw += dy * Math.min(1, dt * 2.2); } } else $('cross').classList.remove('enemy'); }
  else { const t = aimAssistTarget(1.6); $('cross').classList.toggle('enemy', !!t); }
  // recoil recovery
  const rec = W.recoilP * Math.min(1, dt * 7); player.pitch -= rec; W.recoilP -= rec;
  const sp = (w.spread + W.bloom) * 3 + 6 + Math.min(10, player.speed * 0.6) + W.kick * 8; const cr = $('cross').children;
  cr[0].style.transform = `translateY(${-sp - 10}px)`; cr[1].style.transform = `translateY(${sp}px)`; cr[2].style.transform = `translateX(${-sp - 10}px)`; cr[3].style.transform = `translateX(${sp}px)`;
}
// viewmodel animation
function updateVM(dt, t) {
  const portrait = innerWidth < innerHeight, g = GUNS[W.cur], w = WEAPONS[W.cur]; if (!g) return;
  W.kick = Math.max(0, W.kick - dt * 6);
  const bx = portrait ? 0.075 : 0.2, by = portrait ? -0.14 : -0.17, bz = portrait ? -0.4 : -0.46; vm.scale.setScalar(portrait ? 0.42 : 0.68);
  const moving = player.speed > 0.5 && player.ground, bob = player.bob;
  let x = bx + (moving ? Math.sin(bob) * 0.012 : 0), y = by + (moving ? -Math.abs(Math.cos(bob)) * 0.014 : Math.sin(t * 1.6) * 0.003), z = bz + W.kick * 0.05;
  let rx = W.kick * 0.09, rz = 0, ry = 0;
  if (player.sprint) { rx -= 0.25; ry += 0.5; x -= 0.05; y -= 0.04; }
  if (W.reloading > 0) { const k = 1 - W.reloading / w.reload, s = Math.sin(k * Math.PI); rx -= s * 0.45; rz += s * 0.5; y -= s * 0.06; const m = g.userData.mag; if (m && W.cur !== 1) m.position.y = (W.cur === 2 ? -0.09 : -0.11) - Math.sin(Math.min(1, k * 1.6) * Math.PI) * 0.18; if (W.cur === 1 && m) m.position.z = -0.36 + Math.sin(k * Math.PI * 4) * 0.06; }
  if (W.swap > 0) { y -= W.swap * 0.6; rx -= W.swap * 1.2; }
  if (player.dead) y -= 0.5;
  vm.position.set(lerp(vm.position.x, x, Math.min(1, dt * 18)), lerp(vm.position.y, y, Math.min(1, dt * 18)), z);
  vm.rotation.set(lerp(vm.rotation.x, rx, Math.min(1, dt * 14)), lerp(vm.rotation.y, ry, Math.min(1, dt * 10)), lerp(vm.rotation.z, rz, Math.min(1, dt * 10)));
  flashT -= dt; if (flashT <= 0) { mflash.visible = false; mlight.intensity = Math.max(0, mlight.intensity - dt * 200); }
  if (g.userData.glowPulse) {}
}

// ---------------------------------------------------------------- world animation
let lightT = 0;
function assignLights(force) {
  if (!L) return; lightT = 0;
  const p = player.pos, list = L.lights.map(l => ({ l, d: l.p.distanceToSquared(p) })).sort((a, b) => a.d - b.d);
  POOL.forEach((PL, i) => { const it = list[i]; if (it) { PL.position.copy(it.l.p); PL.color.set(it.l.c); PL.intensity = it.l.i; } else PL.intensity = 0; });
}
function updateWorld(dt, t) {
  if (!L) return;
  if ((lightT += dt) > 0.4) assignLights();
  // sun follows the player for shadows
  const sd = mission.theme.space.sunDir || [0.4, 0.8, 0.3]; sun.position.set(player.pos.x + sd[0] * 50, sd[1] * 50, player.pos.z + sd[2] * 50); sun.target.position.set(player.pos.x, 0, player.pos.z); sun.target.updateMatrixWorld();
  for (const d of L.doors) {
    const k = d.target ? 1 : 0; d.open += (k - d.open) * Math.min(1, dt * 2.2); d.col.off = d.open > 0.55;
    if (d.field) { d.halves[0].material = mats.field; d.halves[0].scale.y = Math.max(0.001, 1 - d.open); d.halves[0].visible = d.open < 0.98; }
    else for (const h of d.halves) h.position.x = h.userData.s * (0.8 + d.open * 1.55);
  }
  mats.field.uniforms.uTime.value = t;
  for (const v of L.dynamic.vents) { v.t -= dt * v.rate; if (v.t <= 0) { v.t = 0.07; fx.steam(v.p, v.d, 1, [0.92, 0.95, 1]); } }
  for (const c of L.dynamic.canisters) { if (c.dead) continue; c.flash = Math.max(0, c.flash - dt * 6); c.m.emissive.setRGB(c.flash, c.flash * 0.3, 0); if (c.leak && Math.random() < dt * 20) fx.steam(new THREE.Vector3(c.x, 1.25, c.z), new THREE.Vector3(0, 1, 0), 1, [0.9, 0.5, 0.4]); if (c.leak) { c.hp -= dt * 6; if (c.hp <= 0) hitCanister(c, 1); } }
  const combat = enemies.list.some(e => e.alive && e.active);
  const alarm = mission.theme.alarm && combat;
  for (const b of L.dynamic.beacons) { b.rotation.y += dt * (alarm ? 6 : 1.2); }
  if (L.dynamic.reactor) { const r = L.dynamic.reactor; r.rings.forEach((ring, i) => { ring.rotation.z += dt * (i % 2 ? 0.6 : -0.8); }); const pulse = 1 + Math.sin(t * 4) * 0.08; r.inner.scale.set(pulse, 1, pulse); L.dynamic.reactorLight.intensity = 26 + Math.sin(t * 4) * 8; }
  if (L.dynamic.holo) { L.dynamic.holo.rotation.y += dt * 0.6; L.dynamic.holo.children[0].rotation.x += dt * 0.2; }
  setAlarm(alarm && state === 'play');
  const boss = enemies.boss(), defend = obj && ['defend', 'escape'].includes(curRoom().def.obj.type) && obj.started;
  setIntensity(state !== 'play' ? 0.15 : boss || defend || (holdout && holdout.wave > 0 && enemies.count() > 0) ? 1 : combat ? 0.6 : 0.25);
}

// ---------------------------------------------------------------- camera (play, intro, attract)
let attractT = 0;
function updateCamera(dt, t) {
  if (state === 'ready' && L) { // attract: slow orbit through the first room
    attractT += dt; const R = L.rooms[0], a = Math.sin(attractT * 0.12) * 0.55 - 0.35;
    cam.position.set(R.cx - R.w * 0.18 + Math.sin(attractT * 0.1) * 1.5, 1.9 + Math.sin(attractT * 0.3) * 0.15, R.z0 - 3.2);
    cam.lookAt(cam.position.x - Math.sin(a) * 10, 2.6, cam.position.z - Math.cos(a) * 10); vm.visible = false; return;
  }
  vm.visible = !player.dead && intro <= 0 && state === 'play';
  if (intro > 0) {
    intro -= dt; const k = 1 - Math.max(0, intro) / 4.2, e = k * k * (3 - 2 * k), R = L.rooms[0], hh = Math.max(6, R.h || 8);
    const p0 = new THREE.Vector3(R.x1 - 2, hh * 0.85, R.z1 + 3), p1 = new THREE.Vector3(R.cx - R.w * 0.25, hh * 0.5, R.cz + 2), p2 = new THREE.Vector3(player.pos.x, 1.65, player.pos.z);
    const curve = new THREE.QuadraticBezierCurve3(p0, p1, p2); cam.position.copy(curve.getPoint(e));
    const look = new THREE.Vector3().lerpVectors(new THREE.Vector3(player.pos.x, 1.2, player.pos.z + 1), new THREE.Vector3(player.pos.x, 1.6, player.pos.z - 10), e);
    cam.lookAt(look);
    if (intro <= 0) { $('letter').classList.remove('on'); $('hud').classList.remove('off'); banner('OBJECTIVE', curRoom().def.obj.text, 1.8, '#ffd23a'); cam.rotation.order = 'YXZ'; }
    return;
  }
  cam.rotation.order = 'YXZ';
  let y = player.pos.y + 1.65, roll = 0;
  if (player.dead) { const k = Math.min(1, deadT / 0.8); y = lerp(y, player.pos.y + 0.4, k * k); roll = k * 0.6; }
  shakeA = Math.max(0, shakeA - dt * 2.2); const s = shakeA * shakeA * 0.12;
  cam.position.set(player.pos.x + rand(-s, s), y + rand(-s, s) + (player.ground && player.speed > 0.5 ? Math.abs(Math.sin(player.bob)) * 0.03 : 0), player.pos.z + rand(-s, s));
  cam.rotation.set(player.pitch + rand(-s, s) * 0.3, player.yaw, roll + rand(-s, s) * 0.2);
}

// ---------------------------------------------------------------- bot (used by the QA checker)
const bot = { mx: 0, mz: 0, fire: false, sprint: false, last: new THREE.Vector3(), stuckT: 0, side: 1, sideT: 0, yaw: null, pitch: 0, unstick: 0 };
function botThink() {
  botOn = true; botT = 1.0;
  if (state !== 'play') return;
  if (intro > 0) { if (intro < 3.4) intro = 0.01; return; }
  const o = cam.getWorldPosition(new THREE.Vector3()), pr = roomAt(player.pos.x, player.pos.z);
  // target: nearest visible enemy
  let tgt = null, td = 1e9;
  for (const e of enemies.list) { if (!e.alive) continue; const sp = enemies.spheres(e, tgtTmp); const c = (sp.find(s => s.name === 'core') || sp.find(s => s.name === 'body')).c; const d = c.distanceTo(o); if (d < 38 && d < td && los(o, c)) { td = d; tgt = { e, p: c.clone() }; } }
  const w = WEAPONS[W.cur];
  if (tgt) {
    if (tgt.e.type === 'heavy' && owned() >= 3 && W.cur !== 2 && W.ammo[2] > 0) selectWeapon(2);
    else if (tgt.e.type !== 'heavy' && tgt.e.type !== 'boss' && W.cur === 2) selectWeapon(0);
    if ((tgt.e.type === 'heavy' || tgt.e.type === 'boss' || enemies.count() >= 4) && W.nades > 0 && td < 16 && td > 5 && Math.random() < 0.12) { bot.yaw = Math.atan2(-(tgt.p.x - o.x), -(tgt.p.z - o.z)); throwNade(); }
    bot.yaw = Math.atan2(-(tgt.p.x - o.x), -(tgt.p.z - o.z)); bot.pitch = Math.atan2(tgt.p.y - o.y, Math.hypot(tgt.p.x - o.x, tgt.p.z - o.z));
    const err = Math.abs(Math.atan2(Math.sin(bot.yaw - player.yaw), Math.cos(bot.yaw - player.yaw)));
    bot.fire = err < (td < 6 ? 0.25 : 0.12) && W.reloading <= 0;
  } else { bot.fire = false; if (W.ammo[W.cur] < WEAPONS[W.cur].mag * 0.5) reload(); }
  // movement goal
  const R = curRoom(), ob = R.def.obj; let goal = null;
  if (pr >= 0 && pr < obj.i) { const d = L.doors.find(d => d.room === pr); if (d) goal = new THREE.Vector3(d.x, 0, d.z - 2.5); }
  else if (ob.at) goal = new THREE.Vector3(R.cx + ob.at[0], 0, R.cz + ob.at[1]);
  else if (!tgt) { const near = enemies.alive().sort((a, b) => a.root.position.distanceTo(player.pos) - b.root.position.distanceTo(player.pos))[0]; goal = near ? near.root.position.clone() : new THREE.Vector3(R.cx, 0, R.cz); }
  let mx = 0, mz = 0;
  const toLocal = (gx, gz) => { const yaw = player.yaw; const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw); const l = Math.hypot(gx, gz) || 1; return [(gx * rx + gz * rz) / l, (gx * fx + gz * fz) / l]; };
  if (goal) { const gx = goal.x - player.pos.x, gz = goal.z - player.pos.z, gd = Math.hypot(gx, gz); if (gd > 0.8) [mx, mz] = toLocal(gx, gz); if (!tgt) bot.yaw = Math.atan2(-gx, -gz), bot.pitch = 0; }
  if (tgt) { bot.sideT -= 0.12; if (bot.sideT <= 0) { bot.side *= -1; bot.sideT = rand(0.6, 1.6); } mx += bot.side * 0.6; if (!goal) { if (td > 13) mz += 0.8; else if (td < 5) mz -= 0.6; } }
  // stuck
  if (player.pos.distanceTo(bot.last) < 0.12 && Math.hypot(mx, mz) > 0.3) bot.stuckT += 0.12; else bot.stuckT = 0;
  bot.last.copy(player.pos);
  if (bot.stuckT > 0.6) { bot.unstick = 0.8; bot.side = Math.random() < 0.5 ? 1 : -1; inp.jump = true; bot.stuckT = 0; }
  if (bot.unstick > 0) { bot.unstick -= 0.12; mx = bot.side; mz = 0.3; }
  bot.mx = mx; bot.mz = mz; bot.sprint = !tgt && !!goal;
  if (W.ammo[W.cur] === 0) reload();
}
function botApply(dt) {
  if (!botOn) return; botT -= dt; if (botT <= 0) { botOn = false; bot.fire = false; bot.mx = bot.mz = 0; return; }
  if (bot.yaw != null && state === 'play' && intro <= 0) { let dy = bot.yaw - player.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); player.yaw += dy * Math.min(1, dt * 9); player.pitch += (bot.pitch - player.pitch) * Math.min(1, dt * 7); }
}

// ---------------------------------------------------------------- start / flow
function startRun(m, def) {
  initAudio();
  loadMission(def, m); state = 'play'; intro = 4.2; attractT = 0;
  $('letter').classList.add('on'); $('hud').classList.add('off');
  $('iTag').textContent = m === 'holdout' ? (D.isDaily ? 'DAILY HOLDOUT · SAME SEED FOR EVERYONE' : 'HOLDOUT') : `MISSION ${def.id} OF ${MISSIONS.length}`;
  $('iName').textContent = m === 'holdout' ? 'CARGO RING' : def.name; $('iSub').textContent = def.sub;
  B.start(); vm.visible = false; cam.rotation.order = 'YXZ';
}
$('letter').addEventListener('pointerdown', e => { e.stopPropagation(); if (intro > 0) intro = 0.01; });
// start card: logo, missions, modes
function buildMenu() {
  const st = ui.els.start; st.querySelectorAll('.menu').forEach(x => x.remove());
  st.querySelector('h1').className = 'logo';
  const m = document.createElement('div'); m.className = 'menu'; m.style.cssText = 'display:flex;flex-direction:column;align-items:center';
  const bh = S.get('bestH', 0);
  m.innerHTML = `<div class="sub">SCI-FI FPS SHOOTER · retake the station</div>
    <div class="mgrid">${MISSIONS.map(M => { const lock = M.id > unlocked, best = S.get('best' + M.id, 0); return `<button class="mc ${lock ? 'lock' : ''} ${M.id === sel ? 'sel' : ''} ${best ? 'done' : ''}" data-m="${M.id}"><b>MISSION ${M.id}</b>${lock ? '🔒 ' : ''}${M.name}<small>${best ? 'Best ' + best.toLocaleString('en-US') : lock ? 'Locked' : 'Not played'}</small></button>`; }).join('')}</div>
    <div class="brow"><button class="bigb" data-play>▶ PLAY<small>Mission ${sel}</small></button><button class="bigb alt" data-hold>HOLDOUT<small>Best ${bh.toLocaleString('en-US')}</small></button><button class="bigb alt2" data-daily>DAILY<small>same waves for all</small></button></div>
    <div class="ctl">${TOUCH ? 'Left thumb moves · drag right side to aim · FIRE has aim assist' : 'Click to aim · WASD move · Shift sprint · Space jump · R reload · 1-3 / Q weapons · G arc grenade'}</div>`;
  st.querySelector('h1').after(m);
  m.querySelectorAll('button').forEach(b => b.addEventListener('pointerdown', e => e.stopPropagation()));
  m.querySelectorAll('.mc').forEach(b => b.addEventListener('click', () => { const id = +b.dataset.m; if (id > unlocked) { snd.dry(); return; } sel = id; snd.ui(); buildMenu(); }));
  m.querySelector('[data-play]').addEventListener('click', () => { ui.hideStart(); startRun('campaign', MISSIONS[sel - 1]); });
  m.querySelector('[data-hold]').addEventListener('click', () => { ui.hideStart(); D.isDaily = false; startRun('holdout', HOLDOUT); });
  m.querySelector('[data-daily]').addEventListener('click', () => { const u = new URL(location.href); if (!D.isDaily) { u.searchParams.set('daily', '1'); location.href = u.href; return; } ui.hideStart(); startRun('holdout', HOLDOUT); });
}
ui.onTap(which => {
  initAudio();
  if (which === 'start') { if (D.isDaily) startRun('holdout', HOLDOUT); else startRun('campaign', MISSIONS[sel - 1]); }
  else if (which === 'win') { if (mission.id < MISSIONS.length) { sel = mission.id + 1; startRun('campaign', MISSIONS[mission.id]); } else { state = 'ready'; sel = 1; buildMenu(); ui.start(); loadMission(MISSIONS[0], 'campaign'); state = 'ready'; } }
  else if (which === 'lose') { if (mode === 'holdout') startRun('holdout', HOLDOUT); else startRun('campaign', mission); }
});

// ---------------------------------------------------------------- resize + loop
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); cam.aspect = w / h; cam.fov = w < h ? 80 : 70; cam.updateProjectionMatrix(); C.resize(w, h);
  fx.setScale(h * renderer.getPixelRatio() / (2 * Math.tan(cam.fov * Math.PI / 360)));
}
addEventListener('resize', resize);
let last = performance.now(), tAll = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now; tAll += dt;
  if (state === 'play' && intro <= 0 && !player.dead) runT += dt;
  combo.t -= dt;
  botApply(dt);
  if (state === 'play' && intro <= 0) { updatePlayer(dt); updateWeapons(dt); updateNades(dt); updatePickups(dt, tAll); updateObjective(dt); enemies.update(dt); }
  else if (state === 'play' && player.dead) { deadT += dt; enemies.update(dt); }
  else if (state !== 'play') enemies.update(0);
  updateMarkers(dt); updateWorld(dt, tAll); updateCamera(dt, tAll); updateVM(dt, tAll);
  fx.update(dt, cam); space.update(dt, cam);
  updateNums(dt); updateWaypoint();
  renderer.info.reset(); C.render(dt);
}

// ---------------------------------------------------------------- boot
(async () => {
  const [{ RoundedBoxGeometry }, { mergeGeometries }] = await Promise.all([import('./kit/addons/geometries/RoundedBoxGeometry.js'), import('./kit/addons/utils/BufferGeometryUtils.js')]);
  RBG = RoundedBoxGeometry; mergeAll = (list) => mergeGeometries(list);
  GUNS = buildGuns(); GUNS[0].visible = true;
  resize(); buildMenu();
  if (D.isDaily) { const p = ui.els.start.querySelector('[data-play]'); }
  loadMission(MISSIONS[0], 'campaign'); state = 'ready';
  requestAnimationFrame(frame);
  window.__game = {
    get state() { return state === 'play' ? 'play' : state; },
    get level() { return mode === 'holdout' ? 0 : mission.id; },
    get score() { return score; },
    bot: botThink,
    _room(i) { intro = 0.01; for (let k = 0; k < i; k++) { for (const e of enemies.alive(obj.i)) enemies.damage(e, 1e6, 'body', e.root.position, { splash: true }); openDoor(obj.i); obj.i++; } const R = L.rooms[i]; player.pos.set(R.cx, 0, R.z0 - 2); setObjectiveText(); },
    _start(id) { ui.hideStart(); if (id === 0) startRun('holdout', HOLDOUT); else startRun('campaign', MISSIONS[id - 1]); },
    get debug() { return { obj: obj && obj.i, room: roomAt(player.pos.x, player.pos.z), hp: player.hp, sh: player.shield, enemies: enemies.count(), pos: player.pos.toArray().map(v => +v.toFixed(1)), calls: renderer.info.render.calls, tris: renderer.info.render.triangles }; },
  };
})();
