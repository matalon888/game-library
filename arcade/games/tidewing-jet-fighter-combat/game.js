// Tidewing: Jet Fighter Combat — modern jet combat over an ocean archipelago. Original game, all art and sound in code.
import { THREE, createUI, store, buzz } from './kit/hc.js';
import { cine } from './kit/cine.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { World } from './world.js';
import { Kit } from './models.js';
import { FX } from './fx.js';
import { HUD, Controls } from './hud.js';
import { Sound } from './audio.js';
import { setOutlineRes } from './toon.js';

const V3 = THREE.Vector3, Q = THREE.Quaternion, R = Math.random, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const tmp = new V3(), tmp2 = new V3(), tmp3 = new V3(), qtmp = new Q(), UP = new V3(0, 1, 0), m4 = new THREE.Matrix4();
const FULL = 'Tidewing: Jet Fighter Combat';
function rng(seed) { seed = Math.floor(seed) % 2147483647 || 1; return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }

// ---------------------------------------------------------------- renderer + post
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' }); renderer.info.autoReset = false;
renderer.setSize(innerWidth, innerHeight); renderer.domElement.className = 'hc-canvas'; document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 1.5, 42000); scene.add(cam);
const LITE = Math.min(screen.width, screen.height) < 500 && devicePixelRatio > 2.5;
const world = new World(renderer, scene, LITE);
const kit = new Kit();
const fx = new FX(scene, world.fogU, LITE);
world.hideInReflection.push(...fx.groups, fx.debris.mesh);
const C = cine(renderer, scene, cam, { bloom: 0.3, bloomRadius: 0.45, bloomThreshold: 0.9, exposure: 1.1, env: false, lite: LITE, grade: { sat: 1.16, contrast: 1.05, vignette: 0.12, grain: 0 } });
setOutlineRes(innerWidth, innerHeight);
if (C.lite) renderer.shadowMap.type = THREE.PCFShadowMap;
const hud = new HUD(), snd = new Sound();

// ---------------------------------------------------------------- kit layers: UI, store, daily, flow, board
const ui = createUI({ title: 'TIDEWING', hint: 'Tap to take off', hand: '', progress: false, score: false });
const S = store('tidewing');
const D = daily('tidewing', ui, { name: FULL });
const F = flow('tidewing', { par: 4000, warmup: 2500 });
const B = board({ game: 'tidewing', label: 'Score', limits: { maxRun: 60000, maxPerSec: 200 }, mode: 'best', corner: 'tl', accent: '#ffb347' });

// ---------------------------------------------------------------- missions
const MISSIONS = [
  { name: 'FIRST LIGHT', sub: 'Splash the drone patrol over Saltreach Atoll', tod: 'morning', seed: 101, islands: 7, par: 150 },
  { name: 'CORAL WALL', sub: 'Break the SAM wall on the Coral Teeth', tod: 'noon', seed: 202, islands: 8, par: 200 },
  { name: 'GLASS SQUALL', sub: 'Hunt the raiders hiding in the storm front', tod: 'storm', seed: 303, islands: 6, par: 220 },
  { name: 'IRON TIDE', sub: 'Sink the drone carrier Leviathan', tod: 'afternoon', seed: 404, islands: 7, par: 260 },
  { name: 'RED ARCHIPELAGO', sub: 'Burn the radar chain before nightfall', tod: 'sunset', seed: 505, islands: 9, par: 300 },
  { name: 'SKYFORTRESS', sub: 'Bring down the airborne fortress Halcyon', tod: 'dusk', seed: 606, islands: 7, par: 320 },
];
const TODS = ['morning', 'noon', 'afternoon', 'sunset', 'storm', 'dusk'];

// ---------------------------------------------------------------- game state
const G = {
  state: 'ready', running: false, mode: 'mission', mi: 0, score: 0, time: 0, t: 0, cam, world,
  targets: [], drones: [], missiles: [], flares: [], wrecks: [], fires: [], threats: [], turrets: [],
  lockTarget: null, lockProg: 0, pipper: null, pipperHot: false, threatClose: false, outOfArea: false, objText: '', missionLabel: '',
  camMode: 'chase', shake: 0, combo: 0, comboT: 0, endT: 0, introT: 0, wave: 0, bot: null, beatenShown: false, kills: 0,
};
const P = G.player = {
  obj: kit.jet('player'), pos: new V3(), q: new Q(), fwd: new V3(0, 0, 1), up: new V3(0, 1, 0), right: new V3(-1, 0, 0), vel: new V3(),
  speed: 230, throttle: 0.5, boost: 0, hp: 100, msl: 60, flares: 3, flareT: 0, heat: 0, overheat: 0, railT: [0, 0, 0, 0], rail: 0, g: 1, alt: 1000, alive: true, lastHit: 99, gunT: 0, pitchRate: 0,
};
P.obj.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(P.obj);
P.ribbons = [fx.ribbons.get(), fx.ribbons.get()]; P.ribbons.forEach(r => { r.width = 0.18; r.op = 0.32; });
const cockpit = kit.cockpit(); cockpit.position.set(0, 1.42, 4.05); cockpit.visible = false; P.obj.add(cockpit);
const muzzle = new THREE.PointLight(0xffc070, 0, 25, 2); muzzle.position.set(1.0, 0.3, 6); P.obj.add(muzzle);

// pools: drones, missiles
const dronePool = [];
for (let i = 0; i < 14; i++) { const o = kit.jet('drone'); o.visible = false; o.position.y = -5000; scene.add(o); dronePool.push(o); world.hideInReflection.push(o); }
const MMAX = 48, mslMesh = new THREE.InstancedMesh(kit.missileGeo, new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.4, roughness: 0.4 }), MMAX);
mslMesh.count = 0; mslMesh.frustumCulled = false; mslMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(mslMesh);
let mission = null;   // current mission's built set pieces
const deco = [];      // per-mission scene objects (SAM sites, hangars, carrier, fortress)

// ---------------------------------------------------------------- helpers
function look(q, fwd, roll = 0) { const z = tmp.copy(fwd).normalize(), x = tmp2.crossVectors(UP, z); if (x.lengthSq() < 1e-6) x.set(1, 0, 0); x.normalize(); const y = tmp3.crossVectors(z, x); m4.makeBasis(x, y, z); q.setFromRotationMatrix(m4); if (roll) q.multiply(qtmp.setFromAxisAngle(new V3(0, 0, 1), roll)); return q; }
function turnToward(dir, desired, maxA) { const a = dir.angleTo(desired); if (a < 1e-5) return 0; const t = Math.min(1, maxA / a); dir.lerp(desired, t).normalize(); return a; }
function segSphere(a, b, c, r) { const ab = tmp.subVectors(b, a), t = clamp(tmp2.subVectors(c, a).dot(ab) / Math.max(1e-6, ab.lengthSq()), 0, 1); return tmp3.copy(a).addScaledVector(ab, t).distanceToSquared(c) < r * r; }
const groundAt = (x, z) => world.groundAt(x, z);
const fk = () => F.k(G.mode === 'intercept' ? G.score : Infinity);

// ---------------------------------------------------------------- entities
function addTarget(e) { Object.assign(e, { alive: true, maxHp: e.hp, vel: e.vel || new V3(), size: e.size || 1 }); G.targets.push(e); return e; }
function spawnDrone(pos, dir, objective = true) {
  const o = dronePool.find(d => !d.visible); if (!o) return null; o.visible = true;
  const e = addTarget({ type: 'drone', obj: o, pos: pos.clone(), fwd: dir.clone().normalize(), q: new Q(), roll: 0, speed: 210 + R() * 30, hp: 50, radius: 10, points: 150, objective,
    ai: 'engage', aiT: 0, side: R() < 0.5 ? 1 : -1, mslCd: 8 + R() * 6, gunCd: 0, flaresLeft: 2, ribbons: [fx.ribbons.get(), fx.ribbons.get()] });
  e.ribbons.forEach(r => { if (r) { r.width = 0.3; r.op = 0.4; } });
  look(e.q, e.fwd); o.position.copy(e.pos); o.quaternion.copy(e.q); G.drones.push(e); return e;
}
function squad(n, dist, objective = true, spread = 0.7) {
  const hd = Math.atan2(P.fwd.x, P.fwd.z) + (R() - 0.5) * spread * 2, base = new V3(Math.sin(hd), 0, Math.cos(hd)).multiplyScalar(dist).add(P.pos);
  base.x = clamp(base.x, -8500, 8500); base.z = clamp(base.z, -8500, 8500); base.y = 900 + R() * 900;
  const dir = tmp.copy(P.pos).sub(base).setY(0).normalize().clone();
  const side = new V3(dir.z, 0, -dir.x);
  for (let i = 0; i < n; i++) spawnDrone(base.clone().addScaledVector(side, (i - (n - 1) / 2) * 90).addScaledVector(dir, -Math.abs(i - (n - 1) / 2) * 70).add(new V3(0, (R() - 0.5) * 60, 0)), dir, objective);
}
function spawnSAM(spot, objective = true) {
  const o = kit.sam(); o.position.copy(spot); o.rotation.y = R() * 6; scene.add(o); deco.push(o); world.hideInReflection.push(o);
  return addTarget({ type: 'sam', obj: o, pos: spot.clone().add(new V3(0, 5, 0)), hp: 70, radius: 20, points: 200, objective, ground: true, cd: 4 + R() * 4, size: 1.3 });
}
function spawnHangar(spot) { const o = kit.hangar(); o.position.copy(spot); o.rotation.y = R() * 6; scene.add(o); deco.push(o); world.hideInReflection.push(o); }
function samsOnIslands(rand, n, objective = true) {
  const isl = [...world.islands].sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
  for (let i = 0; i < n; i++) { const I = isl[i % isl.length]; const s = world.findSpot(rand, I); spawnSAM(s, objective); if (i < 3) { const h = world.findSpot(rand, I); if (h.distanceTo(s) > 90) spawnHangar(h); } }
}
function spawnCarrier(pos, heading) {
  const o = kit.carrier(); o.position.copy(pos); o.rotation.y = heading; scene.add(o); deco.push(o);
  const cv = { obj: o, heading, speed: 14, launchT: 6, sinking: 0 };
  cv.hull = addTarget({ type: 'carrier', obj: o, pos: new V3(), hp: 900, radius: 160, points: 2500, objective: true, invuln: true, size: 3, ground: true,
    hitTest(p) { tmp.copy(p); o.worldToLocal(tmp); return Math.abs(tmp.x) < 42 && tmp.y > -12 && tmp.y < 50 && Math.abs(tmp.z) < 168; } });
  cv.turrets = o.userData.turrets.map(t => addTarget({ type: 'ciws', obj: t.g, tur: t, pos: new V3(), hp: 90, radius: 9, points: 300, objective: true, ground: true, burst: 0, cd: 2 + R() * 2 }));
  return cv;
}
function spawnFortress(center) {
  const o = kit.fortress(); scene.add(o); deco.push(o);
  const bf = { obj: o, center, ang: 0, r: 2600, alt: 1700, speed: 85, missileT: 10, dying: 0 };
  bf.hull = { pos: new V3() };
  bf.pods = o.userData.pods.map(p => addTarget({ type: 'pod', obj: p.g, tur: p, pos: new V3(), hp: 140, radius: 10, points: 400, objective: true, cd: 1 + R() * 2, burst: 0 }));
  bf.engines = o.userData.engines.map(lp => addTarget({ type: 'engine', local: lp, pos: new V3(), hp: 170, radius: 10, points: 500, objective: false }));
  bf.core = addTarget({ type: 'core', obj: o.userData.core, pos: new V3(), hp: 500, radius: 14, points: 4000, objective: true, invuln: true, size: 2 });
  bf.hitTest = p => { tmp.copy(p); o.worldToLocal(tmp); return Math.abs(tmp.x) < 125 && Math.abs(tmp.y) < 8 && tmp.z < 55 - Math.abs(tmp.x) * 0.58 && tmp.z > -50; };
  return bf;
}

// ---------------------------------------------------------------- setup a run
function clearRun() {
  for (const e of G.drones) { e.obj.visible = false; e.ribbons.forEach(r => fx.ribbons.free(r)); }
  for (const w of G.wrecks) { if (w.obj && w.pool) w.obj.visible = false; w.ribbons && w.ribbons.forEach(r => fx.ribbons.free(r)); }
  for (const o of deco) { scene.remove(o); const i = world.hideInReflection.indexOf(o); if (i >= 0) world.hideInReflection.splice(i, 1); }
  deco.length = 0; G.targets = []; G.drones = []; G.missiles = []; G.flares = []; G.wrecks = []; G.fires = []; G.threats = [];
  G.lockTarget = null; G.lockProg = 0; mission = null; fx.clear(); P.ribbons = [fx.ribbons.get(), fx.ribbons.get()]; P.ribbons.forEach(r => { r.width = 0.18; r.op = 0.32; });
}
function setupWorld(tod, seed, nIslands, opts = {}) {
  const P0 = world.setPreset(tod); fx.smokeLit = P0.smoke; const rand = rng(seed);
  world.buildIslands(rand, nIslands, opts); world.buildClouds(rand, P0.clouds, !!P0.storm);
  G.storm = !!P0.storm; G.lightT = 4; renderer.toneMappingExposure = P0.exp;
  return rand;
}
function resetPlayer(pos, heading) {
  P.pos.copy(pos); P.fwd.set(Math.sin(heading), 0, Math.cos(heading)); look(P.q, P.fwd); P.speed = 230; P.hp = 100; P.flares = 3; P.flareT = 0; P.heat = 0; P.overheat = 0; P.alive = true; P.lastHit = 99; P.boost = 0;
  P.obj.visible = true; P.obj.userData.rails.forEach(r => r.visible = true); P.railT.fill(0);
}
function startMission(i) {
  clearRun(); G.mode = 'mission'; G.mi = i; const M = MISSIONS[i];
  const rand = setupWorld(M.tod, M.seed, M.islands, { spread: 8000, clear: i === 3 ? { x: 0, z: 1800 } : null });
  resetPlayer(new V3(0, 1300, -6800), 0); P.msl = i === 5 ? 90 : 64;
  mission = { M, waves: [], kills: 0 };
  if (i === 0) { mission.waves = [() => squad(3, 3800), () => squad(3, 4200)]; mission.total = 6; mission.label = 'DRONES'; }
  if (i === 1) { samsOnIslands(rand, 4); squad(2, 4200, false); mission.waves = [() => squad(2, 3500, false)]; mission.total = 4; mission.label = 'SAM SITES'; mission.onlyObj = true; }
  if (i === 2) { mission.waves = [() => squad(4, 3600), () => squad(3, 3800), () => squad(3, 3600)]; mission.total = 10; mission.label = 'RAIDERS'; }
  if (i === 3) { mission.cv = spawnCarrier(new V3(0, 0, 1800), Math.PI / 2); mission.total = 5; mission.label = 'LEVIATHAN'; squad(2, 4500, false); }
  if (i === 4) { samsOnIslands(rand, 5); mission.waves = [() => squad(3, 3800), () => squad(3, 3600), () => squad(2, 3400)]; mission.total = 13; mission.label = 'TARGETS'; }
  if (i === 5) { mission.bf = spawnFortress(new V3(0, 0, 1000)); squad(3, 4500, false); mission.reinT = 30; mission.total = 7; mission.label = 'HALCYON'; }
  if (mission.waves.length) mission.waves.shift()();
  G.missionLabel = `MISSION ${i + 1} · ${M.name}`; begin(`MISSION ${i + 1}: ${M.name}`, M.sub);
}
function startIntercept() {
  clearRun(); G.mode = 'intercept'; const seed = D.seed || dayNum(); G.seed = seed; const r0 = rng(seed);
  const tod = TODS[Math.floor(r0() * TODS.length)];
  setupWorld(tod, seed, 7 + Math.floor(r0() * 3), { spread: 8000 }); G.irand = r0;
  resetPlayer(new V3(0, 1300, -6800), 0); P.msl = 80; G.wave = 0; mission = { M: { name: 'INTERCEPT', par: 9999 }, waves: [], total: 0, label: 'WAVE', kills: 0 };
  nextWave(); G.missionLabel = `INTERCEPT · DAILY ${String(seed).slice(-4)}`; begin('INTERCEPT', 'Endless waves. Today\'s skies are the same for every pilot.');
}
function nextWave() {
  G.wave++; const n = G.wave, k = fk(); const cnt = Math.min(10, Math.round((1 + n) * k));
  squad(Math.min(4, cnt), 3800); if (cnt > 4) squad(Math.min(4, cnt - 4), 4200); if (cnt > 8) squad(cnt - 8, 4600);
  if (n % 3 === 0) samsOnIslands(G.irand, Math.min(4, 1 + Math.floor(n / 3)));
  if (n > 1) { hud.banner(`WAVE ${n}`, `${G.targets.filter(t => t.alive && t.objective).length} hostiles inbound`, 2.2, '#ffb347'); P.hp = Math.min(100, P.hp + 30); P.msl += 16; }
}
const dayNum = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
function begin(title, sub) {
  G.state = 'play'; G.running = true; G.score = 0; G.time = 0; G.kills = 0; G.combo = 0; G.endT = 0; G.introT = 1.8; G.beatenShown = false; G.recorded = false;
  hud.banner(title, sub, 3.2); snd.init(); snd.intensity = 1; ctl.show(true); B.start(); menu.hidden = true; cockpit.visible = G.camMode === 'cockpit'; applyCam();
}

// ---------------------------------------------------------------- player flight model (arcade, Ace-style novice controls)
function flyPlayer(dt, inp) {
  const st = inp.stick; P.boost += ((inp.boost ? 1 : 0) - P.boost) * Math.min(1, dt * 3);
  const target = inp.boost ? 380 : inp.brake ? 140 : 235;
  P.speed += (target - P.speed) * dt * (inp.boost ? 0.55 : inp.brake ? 1.1 : 0.45) - P.fwd.y * 9.8 * dt * 0.9;
  P.speed = clamp(P.speed, 110, 430); P.throttle = inp.boost ? 1 : inp.brake ? 0.15 : 0.55;
  const auth = clamp(P.speed / 235, 0.65, 1.1) * (inp.brake ? 1.2 : 1);
  const up = P.up, right = P.right, bank = Math.atan2(-right.y, up.y);
  let sy = st.y, sx = st.x;
  // soft ceiling, terrain and area guards
  if (P.pos.y > 6500) sy = Math.min(sy, -0.5);
  const d = Math.hypot(P.pos.x, P.pos.z); G.outOfArea = d > 10500;
  let pitch = sy * 1.2 * auth + Math.abs(Math.sin(bank)) * Math.abs(sx) * 0.55 * auth * (Math.cos(bank) > 0 ? 1 : 0.3);
  let roll;
  if (Math.abs(P.fwd.y) < 0.9) { const tb = sx * 1.36; roll = clamp((tb - bank) * 4.2, -3.4, 3.4); } else roll = sx * 2.2;
  let yaw = -sx * 0.32 * auth;
  if (G.outOfArea) { const toC = tmp.set(-P.pos.x, 0, -P.pos.z).normalize(); const crossY = P.fwd.x * toC.z - P.fwd.z * toC.x; yaw += crossY > 0 ? -0.25 : 0.25; }
  P.q.multiply(qtmp.setFromAxisAngle(tmp.set(1, 0, 0), -pitch * dt)); P.q.multiply(qtmp.setFromAxisAngle(tmp.set(0, 0, 1), roll * dt));
  P.q.premultiply(qtmp.setFromAxisAngle(UP, yaw * dt)); P.q.normalize();
  P.fwd.set(0, 0, 1).applyQuaternion(P.q); P.up.set(0, 1, 0).applyQuaternion(P.q); P.right.set(-1, 0, 0).applyQuaternion(P.q);
  P.vel.copy(P.fwd).multiplyScalar(P.speed); P.pos.addScaledVector(P.vel, dt);
  P.pitchRate = pitch; const gl = 1 + Math.abs(pitch) * P.speed / 9.8 * 0.27; P.g += (gl - P.g) * Math.min(1, dt * 5);
  P.alt = P.pos.y - groundAt(P.pos.x, P.pos.z);
  const h = world.heightAt(P.pos.x, P.pos.z);
  if (P.pos.y < Math.max(0, h) + 3) crash(h > 0 ? 'land' : 'water');
  if (mission && mission.cv && mission.cv.hull.hitTest(P.pos)) crash('ship');
  if (mission && mission.bf && mission.bf.hitTest(P.pos)) crash('air');
  P.obj.position.copy(P.pos); P.obj.quaternion.copy(P.q);
}
function crash(kind) {
  if (!P.alive) return; P.alive = false; P.hp = 0; fx.explode(P.pos, 1.6, { debris: 10, water: kind === 'water' }); snd.boom(30, 1.6); G.shake = 2; P.obj.visible = false; buzz([60, 40, 120]);
  hud.banner(kind === 'water' || kind === 'land' ? 'CRASHED' : 'SHOT DOWN', 'Tidewing 1 is down', 2.4, '#ff4a3d'); setTimeout(() => finish(false), 2200);
}
function hurt(dmg, from) {
  if (!P.alive || G.endT > 0) return; P.hp -= dmg; P.lastHit = 0; G.shake = Math.max(G.shake, dmg > 20 ? 1.2 : 0.35); hud.dmgT = 1; dmgEl.style.opacity = Math.min(0.9, 0.3 + dmg / 40);
  buzz(dmg > 20 ? [40, 30, 80] : 15); if (dmg > 20) { snd.thud(); hud.msg('HIT  — DAMAGE ' + Math.round(100 - Math.max(0, P.hp)) + '%', '#ff4a3d'); } else snd.hit();
  if (P.hp <= 0) crash('air');
}

// ---------------------------------------------------------------- weapons
function railWorld(i) { return P.obj.userData.rails[i].getWorldPosition(new V3()); }
function fireMissile() {
  if (P.msl <= 0) { hud.msg('NO MISSILES', '#ffb347'); return; }
  let i = -1; for (let k = 0; k < 4; k++) { const j = (P.rail + k) % 4; if (P.railT[j] <= 0) { i = j; break; } } if (i < 0) return;
  P.rail = (i + 1) % 4; P.railT[i] = 1.6; P.obj.userData.rails[i].visible = false; P.msl--;
  const tgt = G.lockProg >= 1 ? G.lockTarget : null;
  G.missiles.push({ pos: railWorld(i), dir: P.fwd.clone(), speed: P.speed, target: tgt, owner: 'p', life: 9, turn: 2.9, max: 680, ign: 0.12, drop: P.up.clone().multiplyScalar(-8), smokeT: 0, fuse: tgt ? (tgt.radius + 8) : 12 });
  snd.missile(); buzz(12); if (!tgt) hud.msg('NO LOCK', '#ffb347');
}
function launchEnemyMissile(from, dir, target, kind = 'aam') {
  if (G.missiles.filter(m => m.owner === 'e').length >= (G.mode === 'intercept' ? 4 : 3)) return false;
  const k = fk();
  G.missiles.push({ pos: from.clone(), dir: dir.clone().normalize(), speed: kind === 'sam' ? 120 : 260, target, owner: 'e', life: kind === 'sam' ? 11 : 9, turn: (kind === 'sam' ? 1.45 : 1.75) * Math.sqrt(k), max: kind === 'sam' ? 560 : 520, ign: 0.05, drop: new V3(), smokeT: 0, fuse: 14, kind, warned: false });
  return true;
}
function dropFlares() {
  if (P.flares <= 0) { hud.msg('FLARES RECHARGING', '#ffb347'); return; }
  P.flares--; snd.flare(); buzz(10);
  for (let i = 0; i < 8; i++) setTimeout(() => { if (!P.alive) return; const s = i % 2 ? 1 : -1; const v = P.vel.clone().multiplyScalar(0.55).addScaledVector(P.right, s * (30 + R() * 25)).addScaledVector(P.up, -15 - R() * 20); G.flares.push({ pos: P.pos.clone().addScaledVector(P.fwd, -6), vel: v, life: 3.2, alive: true, flare: true, radius: 3 }); }, i * 70);
  setTimeout(() => { for (const m of G.missiles) if (m.owner === 'e' && m.target === P && m.pos.distanceTo(P.pos) < 2600 && R() < 0.85) { const f = G.flares[G.flares.length - 1 - Math.floor(R() * 4)]; if (f) m.target = f; } }, 300);
}
function enemyFlares(e) {
  e.flaresLeft--; for (let i = 0; i < 6; i++) G.flares.push({ pos: e.pos.clone(), vel: e.fwd.clone().multiplyScalar(e.speed * 0.5).add(new V3((R() - 0.5) * 60, -20 - R() * 20, (R() - 0.5) * 60)), life: 3, alive: true, flare: true, radius: 3 });
  for (const m of G.missiles) if (m.owner === 'p' && m.target === e && R() < 0.55) m.target = G.flares[G.flares.length - 1];
}
function gunAim() {
  // aim assist: bend the stream toward the lead point of a target near the nose
  let best = null, ba = (ctl.touch ? 9 : 5) * Math.PI / 180;
  for (const e of G.targets) { if (!e.alive) continue; const d = e.pos.distanceTo(P.pos); if (d > 1500) continue; const a = P.fwd.angleTo(tmp.subVectors(e.pos, P.pos)); if (a < ba) { ba = a; best = e; } }
  if (!best) { G.pipper = null; return P.fwd.clone(); }
  const d = best.pos.distanceTo(P.pos), t = d / (1150 + P.speed), lead = best.pos.clone().addScaledVector(best.vel, t);
  G.pipper = lead; G.pipperHot = ba < 2.5 * Math.PI / 180; return lead.sub(P.pos).normalize();
}
function playerGuns(dt, on) {
  P.overheat = Math.max(0, P.overheat - dt); const aim = gunAim();
  if (on && P.overheat <= 0) {
    P.heat += dt * 0.38; if (P.heat >= 1) { P.overheat = 2.2; hud.msg('GUN OVERHEAT', '#ffb347'); }
    P.gunT -= dt; while (P.gunT <= 0) {
      P.gunT += 1 / 26; const mp = P.obj.localToWorld(tmp.set(1.0, 0.25, 6.5)).clone(), sp = aim.clone().add(new V3((R() - 0.5) * 0.012, (R() - 0.5) * 0.012, (R() - 0.5) * 0.012)).normalize();
      fx.tracers.add(mp, sp.multiplyScalar(1150).addScaledVector(P.vel, 1), 1.4, 'p', 6, [6, 4.5, 1.2], 16, 0.55); snd.gun();
      fx.glow.emit(mp.x, mp.y, mp.z, P.vel.x, P.vel.y, P.vel.z, 0.05, 2.5, 4, [6, 4, 1.5, 1], [3, 1.5, 0.3, 0], 0);
    }
    muzzle.intensity = 30 + R() * 40; G.shake = Math.max(G.shake, 0.08);
  } else { P.gunT = 0; muzzle.intensity = 0; P.heat = Math.max(0, P.heat - dt * (P.overheat > 0 ? 0.45 : 0.6)); }
}
function updateLock(dt) {
  const cone = 38 * Math.PI / 180; let best = null, bs = 1e9;
  const valid = e => e.alive && !e.invuln && e.pos.distanceTo(P.pos) < (e.ground ? 5500 : 4200) && P.fwd.angleTo(tmp.subVectors(e.pos, P.pos)) < cone;
  for (const e of G.targets) { if (!valid(e)) continue; const s = P.fwd.angleTo(tmp.subVectors(e.pos, P.pos)) + e.pos.distanceTo(P.pos) / 9000 - (e.objective ? 0.08 : 0); if (s < bs) { bs = s; best = e; } }
  if (G.lockTarget && valid(G.lockTarget) && best && best !== G.lockTarget && P.fwd.angleTo(tmp.subVectors(G.lockTarget.pos, P.pos)) < 0.3) best = G.lockTarget;
  if (best !== G.lockTarget) { G.lockTarget = best; G.lockProg = 0; }
  if (best) { const was = G.lockProg; G.lockProg += dt / 0.55; if (was < 1 && G.lockProg >= 1) snd.ui(1650); } else G.lockProg = 0;
  // nearest objective for the off-screen arrow
  let no = null, nd = 1e9; for (const e of G.targets) if (e.alive && e.objective && !e.invuln) { const d = e.pos.distanceTo(P.pos); if (d < nd) { nd = d; no = e; } } G.nearestObjective = no;
}

// ---------------------------------------------------------------- damage + kills
let armorMsgT = 0;
function damage(e, dmg, at) {
  if (!e.alive) return;
  if (e.invuln) { fx.spark(at || e.pos, 3, [3, 4, 6]); if (armorMsgT <= 0) { hud.msg(e.type === 'core' ? 'CORE SHIELDED — DESTROY THE TURRET PODS' : 'ARMORED — TAKE OUT THE CIWS TURRETS', '#ffb347'); armorMsgT = 3; } return; }
  e.hp -= dmg; hud.hitT = 0.12; if (at) fx.spark(at, 4);
  if (e.hp <= 0) kill(e);
}
function addScore(n) { G.score += n; if (D.beaten(G.score) && !G.beatenShown) { G.beatenShown = true; ui.pop('BEATEN!', '#ffb347', 34, 30); } }
function kill(e) {
  e.alive = false; G.kills++; G.combo = G.comboT > 0 ? G.combo + 1 : 0; G.comboT = 5;
  const pts = e.points + G.combo * 50; addScore(pts); if (e.objective && mission) mission.kills++;
  const d = e.pos.distanceTo(P.pos); snd.boom(d, e.type === 'carrier' || e.type === 'core' ? 2 : 1); buzz(25); snd.ding();
  hud.msg(G.combo ? `DESTROYED  +${pts}  ×${G.combo + 1}` : `DESTROYED  +${pts}`, e.objective ? '#ffb347' : '#86ffbe');
  if (G.lockTarget === e) { G.lockTarget = null; G.lockProg = 0; }
  if (d < 600) G.shake = Math.max(G.shake, 0.8);
  if (e.type === 'drone') {
    fx.explode(e.pos, 1, { debris: 5 }); const i = G.drones.indexOf(e); if (i >= 0) G.drones.splice(i, 1);
    if (R() < 0.4) { e.obj.visible = false; e.ribbons.forEach(r => fx.ribbons.free(r)); }
    else G.wrecks.push({ obj: e.obj, pool: true, pos: e.pos.clone(), vel: e.fwd.clone().multiplyScalar(e.speed * 0.7), q: e.q.clone(), spin: (R() - 0.5) * 6, t: 0, ribbons: e.ribbons });
  } else if (e.type === 'sam') { fx.explode(e.pos, 1.6, { debris: 8 }); e.obj.userData.turret.visible = false; G.fires.push({ pos: e.pos.clone(), t: 40, s: 1.2 }); }
  else if (e.type === 'ciws') { fx.explode(e.pos, 1.2, { debris: 6 }); e.obj.visible = false; G.fires.push({ get: () => e.obj.parent.localToWorld(e.obj.position.clone()), pos: new V3(), t: 999, s: 0.9 }); if (mission.cv.turrets.every(t => !t.alive)) { mission.cv.hull.invuln = false; hud.banner('DEFENSES DOWN', 'Hit the Leviathan with everything', 2.4, '#ffb347'); } }
  else if (e.type === 'carrier') { mission.cv.sinking = 0.001; for (let i = 0; i < 8; i++) setTimeout(() => { const p = mission && mission.cv ? mission.cv.obj.localToWorld(new V3((R() - 0.5) * 60, 22, (R() - 0.5) * 300)) : P.pos; fx.explode(p, 2.2, { debris: 8 }); snd.boom(p.distanceTo(P.pos), 1.5); }, i * 350); }
  else if (e.type === 'pod') { fx.explode(e.pos, 1.4, { debris: 6 }); e.obj.visible = false; G.fires.push({ get: () => e.obj.parent.localToWorld(e.obj.position.clone()), pos: new V3(), t: 999, s: 1 }); if (mission.bf.pods.every(t => !t.alive)) { mission.bf.core.invuln = false; hud.banner('CORE EXPOSED', 'The Halcyon\'s core is open. Finish it.', 2.6, '#ffb347'); } }
  else if (e.type === 'engine') { fx.explode(e.pos, 1.4, { debris: 6 }); G.fires.push({ get: () => mission.bf.obj.localToWorld(e.local.clone()), pos: new V3(), t: 999, s: 1.6 }); mission.bf.speed *= 0.9; }
  else if (e.type === 'core') { const bf = mission.bf; bf.dying = 0.001; for (let i = 0; i < 12; i++) setTimeout(() => { if (!mission || !mission.bf) return; const p = bf.obj.localToWorld(new V3((R() - 0.5) * 220, 0, (R() - 0.5) * 60)); fx.explode(p, 2.6, { debris: 10 }); snd.boom(p.distanceTo(P.pos), 1.8); G.shake = Math.max(G.shake, 0.6); }, 200 + i * 260); }
}

// ---------------------------------------------------------------- enemies
function updateDrones(dt) {
  const k = fk();
  for (const e of G.drones) {
    const toP = tmp.subVectors(P.pos, e.pos), dist = toP.length(), dirP = toP.clone().normalize();
    const behind = e.fwd.dot(dirP) < -0.55 && dist < 1600, ahead = e.fwd.dot(dirP);
    e.aiT -= dt;
    if (e.ai === 'engage' && behind && P.alive && R() < dt * 0.9) { e.ai = 'break'; e.aiT = 2.2 + R() * 2; e.side = R() < 0.5 ? 1 : -1; }
    if (e.ai === 'engage' && dist < 260) { e.ai = 'extend'; e.aiT = 2.5; }
    if (e.ai !== 'engage' && e.aiT <= 0) e.ai = 'engage';
    let des;
    if (e.ai === 'engage' && P.alive) { const t = Math.min(4, dist / 450); des = P.pos.clone().addScaledVector(P.vel, t).sub(e.pos).normalize(); }
    else if (e.ai === 'break') { const rt = new V3().crossVectors(UP, e.fwd).normalize(); des = e.fwd.clone().addScaledVector(rt, e.side * 1.8).add(new V3(0, 0.25 * e.side, 0)).normalize(); }
    else des = e.fwd.clone().add(new V3(0, 0.08, 0)).normalize();
    if (!P.alive) des = e.fwd.clone().setY(0.1).normalize();
    // threats: flares + hard break when a missile is close
    for (const m of G.missiles) if (m.owner === 'p' && m.target === e) { const md = m.pos.distanceTo(e.pos); if (md < 900 && !m.seen) { m.seen = true; if (e.flaresLeft > 0 && R() < 0.42) enemyFlares(e); e.ai = 'break'; e.aiT = 2; } }
    const gy = groundAt(e.pos.x, e.pos.z), ahH = world.groundAt(e.pos.x + e.fwd.x * 600, e.pos.z + e.fwd.z * 600);
    if (e.pos.y < Math.max(gy, ahH) + 320) des.y = Math.max(des.y, 0.55);
    if (e.pos.y > 4500) des.y = Math.min(des.y, -0.2);
    if (Math.hypot(e.pos.x, e.pos.z) > 9500) des.lerp(tmp2.set(-e.pos.x, 0, -e.pos.z).normalize(), 0.6);
    des.normalize();
    const crossY = e.fwd.x * des.z - e.fwd.z * des.x, turn = (e.ai === 'break' ? 1.25 : 1.0) * Math.sqrt(k);
    turnToward(e.fwd, des, turn * dt);
    e.roll += (clamp(-crossY * 2.2, -1.35, 1.35) - e.roll) * Math.min(1, dt * 3);
    const tsp = e.ai === 'extend' || e.ai === 'break' ? 290 : dist > 2500 ? 270 : 225; e.speed += (tsp - e.speed) * dt * 0.6;
    e.vel.copy(e.fwd).multiplyScalar(e.speed); e.pos.addScaledVector(e.vel, dt);
    look(e.q, e.fwd, e.roll); e.obj.position.copy(e.pos); e.obj.quaternion.copy(e.q);
    const ud = e.obj.userData; ud.flameMat.uniforms.uTime.value = G.t; ud.flameMat.uniforms.uPow.value = e.speed > 260 ? 0.9 : 0.4; ud.flames[0].scale.set(1, 1, e.speed > 260 ? 5 : 2.5);
    const hard = Math.abs(crossY) > 0.25 ? 1 : 0; e.ribbons.forEach((r, i) => fx.ribbons.push(r, e.obj.localToWorld(tmp2.copy(ud.tips[i])), hard * 0.9));
    // weapons
    e.mslCd -= dt; e.gunCd -= dt;
    if (P.alive && G.endT <= 0 && e.mslCd <= 0 && dist < 3000 && dist > 500 && ahead > 0.85 && G.introT <= 0) { if (launchEnemyMissile(e.pos.clone().addScaledVector(e.fwd, 8), e.fwd, P)) e.mslCd = (9 + R() * 5) / k; else e.mslCd = 2; }
    if (P.alive && dist < 900 && ahead > 0.995 && e.gunCd <= 0) { e.gunCd = 0.07; const sp = dirP.clone().add(new V3((R() - 0.5) * 0.03, (R() - 0.5) * 0.03, (R() - 0.5) * 0.03)).normalize(); fx.tracers.add(e.pos.clone().addScaledVector(e.fwd, 8), sp.multiplyScalar(1000).add(e.vel), 1.2, 'e', 3, [5, 1.6, 2.4], 14, 0.6); if (R() < 0.5) snd.enemyGun(Math.min(1, 400 / dist)); }
  }
}
function updateGroundAndBoss(dt) {
  const k = fk();
  for (const e of G.targets) {
    if (!e.alive) continue;
    if (e.type === 'sam') {
      const ud = e.obj.userData, toP = tmp.subVectors(P.pos, e.pos); const yaw = Math.atan2(toP.x, toP.z) - e.obj.rotation.y; ud.turret.rotation.y += ((((yaw - ud.turret.rotation.y) % 6.283) + 9.425) % 6.283 - 3.1416) * Math.min(1, dt * 2);
      ud.pitch.rotation.x = -clamp(Math.atan2(toP.y, Math.hypot(toP.x, toP.z)), 0.3, 1.2); ud.dish.rotation.y += dt * 2;
      e.cd -= dt; const d = toP.length();
      if (P.alive && G.endT <= 0 && d < 5200 && e.cd <= 0 && G.introT <= 0) { const from = e.obj.localToWorld(new V3(0, 9, 0)); if (launchEnemyMissile(from, new V3(0, 1, 0).addScaledVector(toP.normalize(), 0.6), P, 'sam')) { e.cd = (8 + R() * 5) / k; fx.explode(from, 0.25, { debris: 0 }); } else e.cd = 2; }
    }
    if (e.type === 'ciws' || e.type === 'pod') {
      const tu = e.tur; e.pos.copy(tu.g.getWorldPosition(tmp2)); const lp = tu.g.worldToLocal(P.pos.clone());
      tu.yaw.rotation.y = Math.atan2(lp.x, lp.z); tu.pitch.rotation.x = -Math.atan2(lp.y * (tu.up || 1), Math.hypot(lp.x, lp.z)) * (tu.up || 1);
      const d = e.pos.distanceTo(P.pos); e.cd -= dt;
      if (P.alive && G.endT <= 0 && d < (e.type === 'pod' ? 2400 : 1700) && G.introT <= 0) {
        if (e.cd <= 0) { e.burst = 1.2; e.cd = (e.type === 'pod' ? 2.6 : 2.4) / k + R(); }
        if (e.burst > 0) {
          e.burst -= dt;
          if (e.type === 'pod' && d > 900) { if (R() < dt * 2.2) { const p = P.pos.clone().addScaledVector(P.vel, 0.6 + R() * 0.4).add(new V3().randomDirection().multiplyScalar((40 + R() * 70) / Math.sqrt(k))); flak(p); } }
          else if (R() < dt * 16) { const t = d / 900; const aim = P.pos.clone().addScaledVector(P.vel, t).sub(e.pos).normalize().add(new V3().randomDirection().multiplyScalar(0.035 / Math.sqrt(k))).normalize(); fx.tracers.add(e.pos.clone().addScaledVector(aim, 6), aim.multiplyScalar(900), 2, 'e', 2, [5, 1.6, 2.4], 12, 0.6); if (R() < 0.3) snd.enemyGun(Math.min(1, 500 / d)); }
        }
      }
    }
    if (e.type === 'carrier') e.pos.copy(e.obj.position).setY(20);
    if (e.type === 'engine') e.pos.copy(mission.bf.obj.localToWorld(tmp2.copy(e.local)));
    if (e.type === 'core') { e.obj.getWorldPosition(e.pos); const m = mission.bf.obj.userData.coreMat; m.emissiveIntensity = e.invuln ? 1.2 + Math.sin(G.t * 3) * 0.4 : 4 + Math.sin(G.t * 12) * 2; }
  }
  const cv = mission && mission.cv;
  if (cv) {
    const o = cv.obj; if (!cv.sinking) { o.position.x += Math.sin(cv.heading) * cv.speed * dt; o.position.z += Math.cos(cv.heading) * cv.speed * dt; o.rotation.z = Math.sin(G.t * 0.4) * 0.008; }
    else { cv.sinking += dt; o.position.y -= dt * 2.2; o.rotation.z += dt * 0.012; o.rotation.x -= dt * 0.006; if (R() < dt * 8) fx.smoke.emit(o.position.x + (R() - 0.5) * 60, 30, o.position.z + (R() - 0.5) * 260, 0, 12, 0, 6, 30, 120, [0.36, 0.32, 0.44, 0.9], [0.72, 0.7, 0.82, 0], 0.2, 2); }
    o.userData.radar.rotation.y += dt * 2.5;
    const bow = o.localToWorld(new V3(0, 2, 168)); if (!cv.sinking && R() < dt * 30) for (const s of [-1, 1]) { const p = o.localToWorld(new V3(s * 18, 1, 150)); fx.smoke.emit(p.x, 1, p.z, s * 4 * Math.cos(cv.heading), 5, -s * 4 * Math.sin(cv.heading), 1.6, 6, 22, [1.5, 1.55, 1.6, 0.6], [1, 1, 1, 0], 0.5, -4); }
    cv.hull.vel.set(Math.sin(cv.heading) * cv.speed, 0, Math.cos(cv.heading) * cv.speed); void bow;
    cv.launchT -= dt;
    if (!cv.sinking && cv.launchT <= 0 && G.drones.length < 3 && P.alive) { cv.launchT = 16 / k; const p = o.localToWorld(new V3(-10, 30, 150)); const d = spawnDrone(p, new V3(Math.sin(cv.heading), 0.35, Math.cos(cv.heading)), false); if (d) { d.ai = 'extend'; d.aiT = 3; d.speed = 160; hud.msg('DRONE LAUNCH FROM LEVIATHAN', '#ffb347'); } }
  }
  const bf = mission && mission.bf;
  if (bf) {
    const o = bf.obj;
    if (!bf.dying) { bf.ang += bf.speed / bf.r * dt; o.position.set(bf.center.x + Math.sin(bf.ang) * bf.r, bf.alt + Math.sin(G.t * 0.3) * 30, bf.center.z + Math.cos(bf.ang) * bf.r); o.rotation.set(0, bf.ang + Math.PI / 2, -0.06); }
    else { bf.dying += dt; o.position.y -= dt * (20 + bf.dying * 25); o.rotation.z -= dt * 0.12; o.rotation.x += dt * 0.05; o.position.x += Math.cos(bf.ang) * 60 * dt;
      if (R() < dt * 12) { const p = o.localToWorld(new V3((R() - 0.5) * 220, 0, (R() - 0.5) * 60)); fx.fire.emit(p.x, p.y, p.z, 0, 10, 0, 1, 20, 50, [6, 2.5, 0.6, 1], [1, 0.2, 0, 0], 0.5, 0); fx.smoke.emit(p.x, p.y, p.z, 0, 10, 0, 6, 30, 110, [0.36, 0.32, 0.44, 0.9], [0.72, 0.7, 0.82, 0], 0.3, 2); }
      if (o.position.y < 10 && !bf.splashed) { bf.splashed = true; fx.splash(o.position, 14); fx.explode(o.position, 4, { debris: 12, water: true }); snd.boom(o.position.distanceTo(P.pos), 2.5); o.visible = false; } }
    for (const e of [...bf.pods, bf.core]) e.vel.set(Math.cos(bf.ang), 0, -Math.sin(bf.ang)).multiplyScalar(bf.speed);
    bf.missileT -= dt;
    if (!bf.dying && bf.missileT <= 0 && P.alive && G.endT <= 0 && o.position.distanceTo(P.pos) < 5000) { bf.missileT = 15 / k; for (let i = 0; i < 3; i++) setTimeout(() => { if (mission && mission.bf && !bf.dying) launchEnemyMissile(o.localToWorld(new V3((i - 1) * 40, 8, 0)), new V3(0, 1, 0), P, 'sam'); }, i * 400); hud.msg('HALCYON MISSILE SALVO', '#ff4a3d'); }
    // engine glow trails
    for (const e of bf.engines) if (R() < dt * 20 && !bf.dying) { const p = e.pos; fx.glow.emit(p.x, p.y, p.z, 0, 0, 0, 0.4, 8, 14, [0.25, 0.7, 1.4, 0.5], [0.1, 0.3, 0.6, 0], 0); }
  }
}
function flak(p) {
  fx.glow.emit(p.x, p.y, p.z, 0, 0, 0, 0.18, 10, 26, [8, 5, 2.5, 1], [2, 1, 0.2, 0], 0);
  for (let i = 0; i < 5; i++) fx.smoke.emit(p.x, p.y, p.z, (R() - 0.5) * 8, (R() - 0.5) * 8, (R() - 0.5) * 8, 4 + R() * 2, 10, 30, [0.34, 0.3, 0.42, 0.95], [0.7, 0.68, 0.8, 0], 0.6, 0.5);
  const d = p.distanceTo(P.pos); snd.boom(d, 0.4); if (d < 35) hurt(9); else if (d < 80) G.shake = Math.max(G.shake, 0.3);
}

// ---------------------------------------------------------------- missiles, flares, wrecks, fires
const M4 = new THREE.Matrix4(), MQ = new Q(), MS = new V3(1, 1, 1);
function updateMissiles(dt) {
  G.threats = []; G.threatClose = false; let n = 0;
  for (const m of G.missiles) {
    m.life -= dt; m.ign -= dt; const prev = m.pos.clone();
    if (m.ign > 0) { m.pos.addScaledVector(m.dir, m.speed * dt).addScaledVector(m.drop, dt); }
    else {
      m.speed = Math.min(m.max, m.speed + 520 * dt);
      const T = m.target;
      if (T && (T.alive === false)) m.target = null;
      if (m.target) {
        const tv = T.vel || new V3(), d = T.pos.distanceTo(m.pos), close = Math.max(120, m.speed - tv.dot(m.dir)), tg = Math.min(3, d / close);
        const des = T.pos.clone().addScaledVector(tv, tg).sub(m.pos).normalize();
        const a = turnToward(m.dir, des, m.turn * dt);
        if (a > (m.owner === 'p' ? 1.4 : 1.2) && d < 1500) { m.target = null; if (m.owner === 'p') hud.msg('MISSED', '#86ffbe'); }
      }
      m.pos.addScaledVector(m.dir, m.speed * dt);
      // smoke trail + motor glow
      const L = fx.smokeLit, back = m.pos.clone().addScaledVector(m.dir, -2);
      const steps = Math.max(1, Math.round(m.speed * dt / 4));
      const nearCam = m.pos.distanceTo(cam.position) < 45;
      if (!nearCam) for (let s = 0; s < steps; s++) { const f = s / steps, p = back.clone().addScaledVector(m.dir, -m.speed * dt * f); fx.smoke.emit(p.x, p.y, p.z, (R() - 0.5) * 2, (R() - 0.5) * 2 + 1, (R() - 0.5) * 2, m.kind === 'sam' ? 3 : 2.2, 1.4, m.kind === 'sam' ? 8 : 5, [L[0], L[1], L[2], 0.6], [L[0] * 0.9, L[1] * 0.9, L[2] * 0.95, 0], 0.4, 0.6); }
      fx.glow.emit(back.x, back.y, back.z, 0, 0, 0, 0.05, 5, 7, [9, 6, 3, 1], [5, 2, 0.5, 0], 0);
    }
    // hit test (segment vs target), terrain
    const T = m.target;
    if (T && segSphere(prev, m.pos, T.pos, m.fuse)) {
      m.life = 0; fx.explode(T.pos.clone().lerp(m.pos, 0.5), 0.7, { debris: 2 });
      if (T === P) { hurt(m.kind === 'sam' ? 38 : 34); snd.boom(10, 1); }
      else if (!T.flare) damage(T, 60, m.pos);
    } else if (m.owner === 'p' && !T) {
      for (const e of G.targets) if (e.alive && (e.hitTest ? e.hitTest(m.pos) : segSphere(prev, m.pos, e.pos, e.radius))) { m.life = 0; fx.explode(m.pos, 0.7, { debris: 2 }); damage(e, 60, m.pos); break; }
    }
    if (m.life > 0 && m.owner === 'p' && mission && mission.bf && mission.bf.hitTest(m.pos) && m.target && !['pod', 'engine', 'core'].includes(m.target.type)) { m.life = 0; fx.explode(m.pos, 0.6, { debris: 1 }); }
    const gy = world.heightAt(m.pos.x, m.pos.z); if (m.pos.y < Math.max(0, gy)) { m.life = 0; if (gy <= 0) fx.splash(m.pos, 1.5); else fx.explode(m.pos, 0.6, { debris: 2 }); }
    if (m.life <= 0) { if (m.ign <= 0 && m.target !== P) { /* self-destruct puff */ fx.glow.emit(m.pos.x, m.pos.y, m.pos.z, 0, 0, 0, 0.2, 6, 14, [5, 3, 1, 1], [1, 0.4, 0, 0], 0); } continue; }
    if (m.owner === 'e' && m.target === P) { G.threats.push(m); const d = m.pos.distanceTo(P.pos); if (d < 1400) G.threatClose = true; if (!m.warned) { m.warned = true; } }
    if (n < MMAX) { MQ.setFromUnitVectors(tmp.set(0, 0, 1), m.dir); M4.compose(m.pos, MQ, MS.setScalar(m.kind === 'sam' ? 1.7 : 1.1)); mslMesh.setMatrixAt(n++, M4); }
    G.missiles[G.missiles.indexOf(m)] = m;
  }
  G.missiles = G.missiles.filter(m => m.life > 0);
  mslMesh.count = n; mslMesh.instanceMatrix.needsUpdate = true;
}
function updateFlares(dt) {
  for (const f of G.flares) { f.life -= dt; f.vel.y -= 9.8 * dt * 0.6; f.vel.multiplyScalar(1 - dt * 0.8); f.pos.addScaledVector(f.vel, dt);
    fx.glow.emit(f.pos.x, f.pos.y, f.pos.z, 0, 0, 0, 0.08, 7, 9, [9, 7, 4.5, 1], [6, 3, 1, 0], 0);
    if (R() < 0.7) fx.smoke.emit(f.pos.x, f.pos.y, f.pos.z, 0, 1, 0, 2.2, 1.5, 6, [1.3, 1.3, 1.3, 0.6], [1, 1, 1, 0], 0.5, 0.5);
    if (f.life <= 0) f.alive = false; }
  G.flares = G.flares.filter(f => f.alive);
}
function updateWrecks(dt) {
  for (const w of G.wrecks) {
    w.t += dt; w.vel.y -= 9.8 * dt * 1.6; w.vel.multiplyScalar(1 - dt * 0.15); w.pos.addScaledVector(w.vel, dt);
    w.q.multiply(qtmp.setFromAxisAngle(tmp.set(0, 0, 1), w.spin * dt)); w.obj.position.copy(w.pos); w.obj.quaternion.copy(w.q);
    fx.fire.emit(w.pos.x, w.pos.y, w.pos.z, (R() - 0.5) * 5, (R() - 0.5) * 5, (R() - 0.5) * 5, 0.35, 7, 3, [6, 2.6, 0.7, 1], [2, 0.4, 0.05, 0], 0);
    fx.smoke.emit(w.pos.x, w.pos.y, w.pos.z, 0, 3, 0, 4, 5, 22, [0.34, 0.3, 0.42, 0.95], [0.7, 0.68, 0.8, 0], 0.4, 1);
    w.ribbons && w.ribbons.forEach(r => fx.ribbons.push(r, w.pos, 0));
    const gy = world.heightAt(w.pos.x, w.pos.z);
    if (w.pos.y < Math.max(0, gy) || w.t > 9) { w.done = true; w.obj.visible = false; w.ribbons && w.ribbons.forEach(r => fx.ribbons.free(r)); if (gy <= 0) { fx.splash(w.pos, 3); fx.explode(w.pos.setY(4), 0.8, { debris: 2, water: true }); } else fx.explode(w.pos, 1, { debris: 3 }); snd.boom(w.pos.distanceTo(P.pos), 0.7); }
  }
  G.wrecks = G.wrecks.filter(w => !w.done);
  for (const f of G.fires) { f.t -= dt; const p = f.get ? f.get() : f.pos; if (R() < dt * 14) { fx.fire.emit(p.x + (R() - 0.5) * 6, p.y + 2, p.z + (R() - 0.5) * 6, 0, 8, 0, 0.7, 6 * f.s, 14 * f.s, [5, 2, 0.5, 1], [1, 0.2, 0, 0], 0.4, 4); fx.smoke.emit(p.x, p.y + 6, p.z, (R() - 0.5) * 4, 10, (R() - 0.5) * 4, 7, 10 * f.s, 45 * f.s, [0.36, 0.32, 0.44, 0.9], [0.72, 0.7, 0.82, 0], 0.15, 1.5); } }
  G.fires = G.fires.filter(f => f.t > 0);
}
function bulletHit(b) {
  if (b.owner === 'p') {
    for (const e of G.targets) { if (!e.alive) continue; if (e.hitTest ? e.hitTest(b.p) : segSphere(b.prev, b.p, e.pos, e.radius)) { damage(e, b.dmg, b.p); if (!e.invuln) snd.hit(); return true; } }
    if (mission && mission.bf && mission.bf.hitTest(b.p)) { fx.spark(b.p, 2, [3, 4, 6]); return true; }
  } else if (P.alive && segSphere(b.prev, b.p, P.pos, 7)) { hurt(b.dmg); fx.spark(b.p, 3); return true; }
  if (b.p.y < 1 && R() < 0.3) { if (world.heightAt(b.p.x, b.p.z) <= 0) fx.smoke.emit(b.p.x, 1, b.p.z, 0, 14, 0, 0.8, 1.5, 5, [1.5, 1.5, 1.5, 0.7], [1, 1, 1, 0], 0.5, -14); return true; }
  return b.p.y < world.heightAt(b.p.x, b.p.z);
}

// ---------------------------------------------------------------- objectives / end
function updateObjectives(dt) {
  if (!mission || G.endT > 0 || !P.alive) return;
  const objs = G.targets.filter(t => t.objective), alive = objs.filter(t => t.alive);
  if (G.mode === 'intercept') {
    G.objText = `WAVE ${G.wave} · ${alive.length} HOSTILE${alive.length === 1 ? '' : 'S'} LEFT`;
    if (!alive.length) { addScore(150 * G.wave); hud.msg(`WAVE CLEAR  +${150 * G.wave}`, '#ffb347'); nextWave(); }
    return;
  }
  const M = mission;
  if (G.mi === 3) G.objText = M.cv.hull.invuln ? `CIWS TURRETS ${M.cv.turrets.filter(t => !t.alive).length}/4` : `SINK THE LEVIATHAN  ${Math.max(0, Math.round(M.cv.hull.hp / M.cv.hull.maxHp * 100))}%`;
  else if (G.mi === 5) G.objText = M.bf.core.invuln ? `TURRET PODS ${M.bf.pods.filter(t => !t.alive).length}/6` : `DESTROY THE CORE  ${Math.max(0, Math.round(M.bf.core.hp / M.bf.core.maxHp * 100))}%`;
  else G.objText = `${M.label} ${M.kills}/${M.total}`;
  if (G.mi === 5) { M.reinT -= dt; if (M.reinT <= 0 && G.drones.length < 4) { M.reinT = 35; squad(2, 4000, false); hud.msg('ESCORT DRONES INBOUND', '#ffb347'); } }
  if (G.mi === 1 && G.drones.length === 0 && M.waves.length) M.waves.shift()();
  if (!alive.length) {
    if (M.waves.length) { M.waves.shift()(); hud.msg('ENEMY REINFORCEMENTS', '#ffb347'); return; }
    G.endT = G.mi >= 3 ? 4.5 : 3; snd.fanfare(); hud.banner('MISSION COMPLETE', `${M.M.name} — all targets destroyed`, 3.6, '#ffb347');
  }
}
function finish(won) {
  if (G.state !== 'play') return;
  G.running = false; hud.big = null; ctl.show(false); snd.silence(); snd.intensity = 0; muzzle.intensity = 0;
  const ms = G.time * 1000;
  let bonus = 0, lines = [];
  if (won && G.mode === 'mission') {
    const M = MISSIONS[G.mi], tb = Math.max(0, Math.round((M.par - G.time) * 4)), hb = Math.round(Math.max(0, P.hp) * 5), cb = 500 + 300 * G.mi;
    bonus = tb + hb + cb; lines = [`Kills ${G.kills}`, `Clear +${cb}`, `Time +${tb}`, `Armor +${hb}`]; addScore(bonus);
    const best = S.get('best' + G.mi, 0); if (G.score > best) S.set('best' + G.mi, G.score);
    S.set('unlocked', Math.max(S.get('unlocked', 1), Math.min(MISSIONS.length, G.mi + 2))); if (G.mi === MISSIONS.length - 1) S.set('done', 1);
  }
  if (G.mode === 'intercept') { const best = S.get('bestI', 0); if (G.score > best) S.set('bestI', G.score); }
  if (!G.recorded) { G.recorded = true; if (G.mode === 'intercept') F.endless(G.score); else F.level(won, mission ? mission.kills / Math.max(1, mission.total) : 0); }
  B.submit(G.score, { ms });
  if (won) { G.state = 'won'; D.won(G.score); winTitle.textContent = 'MISSION COMPLETE'; winSub.textContent = `MISSION ${G.mi + 1} · ${MISSIONS[G.mi].name}`; ui.win('', `Score ${G.score.toLocaleString()}  ·  ${lines.join('  ·  ')}`); }
  else { G.state = 'lost'; ui.lose(G.mode === 'intercept' ? 'SORTIE OVER' : 'MISSION FAILED', G.mode === 'intercept' ? `Wave ${G.wave} · Score ${G.score.toLocaleString()} · Best ${S.get('bestI', 0).toLocaleString()}` : `${mission.kills}/${mission.total} targets · Score ${G.score.toLocaleString()}`); }
  buildMenu();
}

// ---------------------------------------------------------------- camera
let camQ = new Q(), camP = new V3(), fovBase = 65;
function applyCam() { const ck = G.camMode === 'cockpit'; cockpit.visible = ck; P.obj.userData.outline.visible = !ck; cam.near = ck ? 0.1 : 1.5; cam.updateProjectionMatrix(); if (P.obj.userData.glass) P.obj.userData.glass.visible = !ck; P.obj.userData.flames.forEach(f => f.visible = !ck); P.obj.userData.vapour.visible = !ck; }
function toggleCam() { if (!G.running) return; G.camMode = G.camMode === 'chase' ? 'cockpit' : 'chase'; applyCam(); snd.ui(660); }
function updateCamera(dt) {
  const portrait = innerHeight > innerWidth; fovBase = portrait ? 74 : 62;
  if (!G.running && G.state === 'ready') {                               // attract mode: slow orbit around the jet
    const a = G.t * 0.12, off = new V3(Math.sin(a) * 34, 6 + Math.sin(G.t * 0.2) * 3, Math.cos(a) * 34).applyQuaternion(P.q);
    cam.position.copy(P.pos).add(off); cam.up.copy(P.up); cam.lookAt(tmp.copy(P.pos).addScaledVector(P.up, portrait ? 4 : 2)); cam.fov = portrait ? 66 : 50; cam.updateProjectionMatrix(); camP.copy(cam.position); camQ.copy(cam.quaternion); return;
  }
  if (G.camMode === 'cockpit' && P.alive && G.running) {
    cam.position.copy(P.obj.localToWorld(tmp.set(0, 1.42 + Math.min(0.06, (P.g - 1) * -0.006), 4.05))); cam.quaternion.copy(P.q).multiply(qtmp.setFromAxisAngle(UP, Math.PI));
    cam.position.add(tmp.set((R() - 0.5), (R() - 0.5), (R() - 0.5)).multiplyScalar(G.shake * 0.12));
    cam.fov = fovBase + P.boost * 6; cam.updateProjectionMatrix(); camP.copy(cam.position); camQ.copy(cam.quaternion); return;
  }
  const back = portrait ? 27 : 23, upo = portrait ? 7.5 : 5.8;
  let want = tmp.copy(P.pos).addScaledVector(P.fwd, -back - P.boost * 4).addScaledVector(P.up, upo);
  const lookAt = tmp2.copy(P.pos).addScaledVector(P.fwd, 40).addScaledVector(P.up, portrait ? 9 : 5.5);
  if (G.introT > 0) { const e = G.introT / 1.8, a = e * e * 2.6; want = tmp.copy(P.pos).add(new V3(-Math.sin(a) * back, upo + e * 6, -Math.cos(a) * back).applyQuaternion(P.q)); }
  if (!P.alive) { want = camP.clone().sub(P.pos).normalize().multiplyScalar(160).add(P.pos).add(new V3(0, 60, 0)); lookAt.copy(P.pos); }
  camP.lerp(want, 1 - Math.exp(-dt * (G.introT > 0 ? 6 : 14)));
  m4.lookAt(camP, lookAt, P.alive ? P.up : UP); const tq = new Q().setFromRotationMatrix(m4); camQ.slerp(tq, 1 - Math.exp(-dt * 9));
  cam.position.copy(camP); cam.quaternion.copy(camQ);
  if (G.shake > 0) { cam.position.add(tmp.set(R() - 0.5, R() - 0.5, R() - 0.5).multiplyScalar(G.shake * 1.6)); cam.rotateZ((R() - 0.5) * G.shake * 0.015); }
  cam.fov += (fovBase + P.boost * 9 + Math.max(0, P.speed - 240) * 0.02 - cam.fov) * Math.min(1, dt * 3); cam.updateProjectionMatrix();
}

// ---------------------------------------------------------------- player visuals (flames, vapour, contrails)
function playerVisuals(dt) {
  const ud = P.obj.userData; ud.flameMat.uniforms.uTime.value = G.t; ud.flameMat.uniforms.uPow.value = 0.12 + P.boost * 0.7;
  for (const f of ud.flames) f.scale.set(1 + P.boost * 0.15, 1 + P.boost * 0.15, 1.6 + P.throttle * 1.6 + P.boost * 5.5 + Math.sin(G.t * 60) * 0.2);
  for (const n of ud.nozzles) { const p = P.obj.localToWorld(tmp.copy(n).add(tmp2.set(0, 0, -0.6))); fx.glow.emit(p.x, p.y, p.z, P.vel.x, P.vel.y, P.vel.z, 0.03, 1.2 + P.boost * 2, 1.6 + P.boost * 2.5, [1.4 + P.boost * 3, 0.8 + P.boost * 1.5, 0.3 + P.boost, 0.8], [1, 0.4, 0.1, 0], 0); }
  const vap = clamp((P.g - 6.2) / 2, 0, 1) * 0.8 + clamp((P.speed - 345) / 40, 0, 1) * 0.9;
  ud.vapour.material.uniforms.uAmt.value += (Math.min(1, vap) * (0.7 + R() * 0.3) - ud.vapour.material.uniforms.uAmt.value) * Math.min(1, dt * 10); ud.vapour.material.uniforms.uTime.value = G.t;
  const trail = clamp((P.g - 5) / 2.5, 0, 1) + (P.pos.y > 3600 ? 0.5 : 0);
  P.ribbons.forEach((r, i) => fx.ribbons.push(r, P.obj.localToWorld(tmp.copy(ud.tips[i])), Math.min(1, trail)));
  ud.strobe.visible = (G.t % 1.3) < 0.08;
  // smoking when damaged
  if (P.hp < 40 && P.alive && R() < dt * 30) { const p = P.obj.localToWorld(tmp.set(0, 0.5, -8)); fx.smoke.emit(p.x, p.y, p.z, 0, 2, 0, 2.5, 2, 9, [0.4, 0.36, 0.48, 0.8], [0.75, 0.72, 0.85, 0], 0.5, 0); }
  // in-cloud vapour rushing past
  if (world.inCloud > 0.15 && R() < world.inCloud) { const p = cam.position.clone().addScaledVector(P.fwd, 60 + R() * 60).add(new V3((R() - 0.5) * 50, (R() - 0.5) * 30, (R() - 0.5) * 50)); fx.smoke.emit(p.x, p.y, p.z, 0, 0, 0, 0.8, 18, 30, [1.4, 1.42, 1.46, 0.35], [1.4, 1.4, 1.4, 0], 0, 0); }
}

// ---------------------------------------------------------------- bot (QA + attract): fly at the best target and fight
function bot() {
  if (!G.running || !P.alive) return;
  let tgt = null, bd = 1e9; for (const e of G.targets) { if (!e.alive || e.invuln) continue; const d = e.pos.distanceTo(P.pos) * (e.objective ? 1 : 1.3); if (d < bd) { bd = d; tgt = e; } }
  let des = tgt ? tgt.pos.clone().addScaledVector(tgt.vel, Math.min(2, bd / 800)).sub(P.pos).normalize() : P.fwd.clone().setY(0).normalize();
  if (tgt && tgt.ground && bd > 1500) des = tgt.pos.clone().add(new V3(0, Math.min(500, bd * 0.18), 0)).sub(P.pos).normalize();
  const look = P.pos.clone().addScaledVector(P.fwd, 900); const danger = P.alt < 350 || P.pos.y + P.fwd.y * 900 < world.groundAt(look.x, look.z) + 200;
  if (danger) des.y = Math.max(des.y, 0.6);
  const inv = P.q.clone().invert(), l = des.clone().applyQuaternion(inv);
  let sx = clamp(-l.x * 3, -1, 1), sy = clamp(l.y * 3, -1, 1); if (l.z < 0) { sy = 1; sx = l.x > 0 ? -0.8 : 0.8; }
  if (G.threatClose && P.flares === 0 && !danger) { sy = 1; sx = G.t % 6 < 3 ? 1 : -1; }
  if (danger) { sy = 1; sx = clamp(sx, -0.3, 0.3); }
  const ang = tgt ? P.fwd.angleTo(tmp.subVectors(tgt.pos, P.pos)) : 9;
  G.bot = { x: sx, y: sy, gun: !!tgt && bd < 1200 && ang < 0.1 && P.heat < 0.85, boost: !!tgt && bd > 2600, brake: !!tgt && bd < 500 && ang > 0.5, msl: G.lockProg >= 1 && R() < 0.5, flr: G.threatClose && P.flares > 0 && G.threats.some(m => m.pos.distanceTo(P.pos) < 900), ttl: 0.6 };
}

// ---------------------------------------------------------------- DOM: menu, overlays
const ctl = new Controls(toggleCam); ctl.show(false);
const dmgEl = document.createElement('div'); dmgEl.id = 'dmg'; document.body.appendChild(dmgEl);
const cloudEl = document.createElement('div'); cloudEl.id = 'cloudfog'; document.body.appendChild(cloudEl);
const startCard = ui.els.start; startCard.classList.add('tw-start');
startCard.querySelector('h1').innerHTML = 'TIDEWING<small>JET FIGHTER COMBAT</small>';
const menu = document.createElement('div'); menu.id = 'menu'; startCard.appendChild(menu);
['pointerdown', 'click'].forEach(t => menu.addEventListener(t, e => e.stopPropagation()));
let sel = Math.min(MISSIONS.length - 1, S.get('unlocked', 1) - 1); if (D.isDaily) sel = 'I';
function buildMenu() {
  const un = S.get('unlocked', 1); if (sel !== 'I' && G.state === 'ready') sel = Math.min(sel, un - 1);
  menu.innerHTML = `<div class="ms">${MISSIONS.map((M, i) => `<button class="mc ${i < un ? '' : 'lk'} ${sel === i ? 'on' : ''}" data-i="${i}"><b>${i + 1}</b><span>${i < un ? M.name : 'LOCKED'}</span>${S.get('best' + i, 0) ? `<em>${S.get('best' + i, 0).toLocaleString()}</em>` : ''}</button>`).join('')}
    <button class="mc int ${sel === 'I' ? 'on' : ''}" data-i="I"><b>∞</b><span>INTERCEPT · DAILY</span>${S.get('bestI', 0) ? `<em>${S.get('bestI', 0).toLocaleString()}</em>` : ''}</button></div>`;
  for (const b of menu.querySelectorAll('.mc')) b.onclick = () => { const i = b.dataset.i === 'I' ? 'I' : +b.dataset.i; if (i !== 'I' && i >= un) { snd.init(); snd.ui(220); return; } sel = i; snd.init(); snd.ui(); buildMenu(); briefing(); };
  briefing();
}
const brief = document.createElement('p'); brief.className = 'brief'; startCard.querySelector('h1').after(brief);
function briefing() { brief.textContent = sel === 'I' ? 'Intercept: endless waves over today\'s seeded skies. One life.' : `Mission ${sel + 1} · ${MISSIONS[sel].sub}`; }
const winSubP = ui.els.win.querySelector('p'); winSubP.innerHTML = '<span class="ws"></span><span data-l style="display:none"></span>'; const winSub = winSubP.querySelector('.ws'); const winTitle = ui.els.win.querySelector('h1');
for (const card of [ui.els.win, ui.els.lose]) { const b = document.createElement('button'); b.className = 'hc-btn tw-menu'; b.textContent = 'Missions'; b.addEventListener('pointerdown', e => e.stopPropagation()); b.addEventListener('click', e => { e.stopPropagation(); card.classList.add('hc-hidden'); toMenu(); }); card.querySelector('.hint').before(b); }
function toMenu() { G.state = 'ready'; G.running = false; clearRun(); attract(); ui.start(); buildMenu(); }
function attract() { setupWorld('afternoon', 77, 7, { spread: 8000 }); resetPlayer(new V3(-1500, 700, -2500), 0.6); }
ui.onTap(which => {
  snd.init();
  if (which === 'start') { if (sel === 'I') startIntercept(); else startMission(sel); }
  else if (which === 'win') { if (G.mode === 'mission' && G.mi < MISSIONS.length - 1) { sel = G.mi + 1; startMission(G.mi + 1); } else { toMenu(); } }
  else if (which === 'lose') { if (G.mode === 'intercept') startIntercept(); else startMission(G.mi); }
});

// ---------------------------------------------------------------- main loop
attract(); buildMenu();
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now; G.t += dt;
  if (G.running) {
    G.time += dt; G.introT = Math.max(0, G.introT - dt); G.comboT -= dt; armorMsgT -= dt; P.lastHit += dt;
    const b = G.bot && (G.bot.ttl -= dt) > 0 ? G.bot : null;
    const inp = b ? { stick: { x: b.x, y: b.y }, boost: b.boost, brake: b.brake, gun: b.gun } : { stick: ctl.read(dt), boost: ctl.boost, brake: ctl.brake, gun: ctl.gun };
    if (P.alive) {
      flyPlayer(dt, inp); updateLock(dt);
      if ((b && b.msl) || ctl.mslQ > 0) { ctl.mslQ = 0; if (b) b.msl = false; fireMissile(); }
      if ((b && b.flr) || ctl.flrQ > 0) { ctl.flrQ = 0; if (b) b.flr = false; dropFlares(); }
      playerGuns(dt, inp.gun);
      for (let i = 0; i < 4; i++) if (P.railT[i] > 0 && (P.railT[i] -= dt) <= 0 && P.msl > 0) P.obj.userData.rails[i].visible = true;
      if (P.flares < 3 && (P.flareT += dt) > 7) { P.flareT = 0; P.flares++; }
      if (P.lastHit > 6 && P.hp < 100) P.hp = Math.min(100, P.hp + dt * 2.5);
    }
    updateDrones(dt); updateGroundAndBoss(dt); updateMissiles(dt); updateFlares(dt); updateWrecks(dt); updateObjectives(dt);
    fx.tracers.update(dt, bulletHit);
    if (G.endT > 0 && (G.endT -= dt) <= 0) finish(true);
    snd.tones(dt, !P.alive ? 0 : G.lockProg >= 1 ? 2 : G.lockTarget ? 1 : 0, G.threats.length ? (G.threatClose ? 2 : 1) : 0);
    snd.engine(P.throttle, P.speed, P.boost, P.g, G.camMode === 'cockpit');
    const near = G.targets.some(t => t.alive && t.pos.distanceTo(P.pos) < 3500); snd.intensity = G.mode === 'mission' && G.mi === 5 ? 3 : near || G.threats.length ? 2 : 1;
    playerVisuals(dt);
  } else {
    // attract / end-card flight: gentle banked circle
    if (P.alive) { P.q.premultiply(qtmp.setFromAxisAngle(UP, -0.08 * dt)); const want = new Q(); look(want, P.fwd.set(0, 0, 1).applyQuaternion(P.q).setY(0).normalize(), 0.25); P.q.slerp(want, dt); P.fwd.set(0, 0, 1).applyQuaternion(P.q); P.up.set(0, 1, 0).applyQuaternion(P.q); P.right.set(-1, 0, 0).applyQuaternion(P.q); P.speed = 220; P.vel.copy(P.fwd).multiplyScalar(220); P.pos.addScaledVector(P.vel, dt); P.obj.position.copy(P.pos); P.obj.quaternion.copy(P.q); P.boost = 0; P.g = 1; P.throttle = 0.5; playerVisuals(dt); }
    updateDrones(dt); updateWrecks(dt); updateMissiles(dt); updateFlares(dt); fx.tracers.update(dt, bulletHit);
  }
  if (G.storm && G.running) { G.lightT -= dt; if (G.lightT <= 0) { G.lightT = 5 + R() * 8; G.flashT = 0.25; snd.thunder(); } }
  G.flashT = Math.max(0, (G.flashT || 0) - dt); world.hemi.intensity = world.P.hemiI * (1 + (G.flashT > 0 && (G.flashT * 30 | 0) % 2 ? 5 : 0));
  G.shake = Math.max(0, G.shake - dt * 2.2); dmgEl.style.opacity = Math.max(0, (+dmgEl.style.opacity || 0) - dt * 1.2) + (P.alive && P.hp < 30 && G.running ? 0.25 + Math.sin(G.t * 6) * 0.1 : 0);
  updateCamera(dt);
  world.followShadow(P.pos); world.update(dt, cam, G.t); cloudEl.style.opacity = Math.min(0.5, world.inCloud * 0.55);
  fx.update(dt, cam, groundAt);
  if (cockpit.visible && (G.mfdT = (G.mfdT || 0) - dt) <= 0) { G.mfdT = 0.2; drawMFD(); }
  renderer.info.reset(); C.render(dt); G.calls = renderer.info.render.calls; G.tris = renderer.info.render.triangles;
  hud.draw(G, dt);
}
requestAnimationFrame(frame);
function drawMFD() {
  const { mfd, tex } = cockpit.userData, x = mfd.getContext('2d'), w = mfd.width, h = mfd.height; x.fillStyle = '#020806'; x.fillRect(0, 0, w, h);
  x.strokeStyle = '#3dff9a'; x.fillStyle = '#3dff9a'; x.lineWidth = 2; x.font = 'bold 14px monospace';
  for (let i = 0; i < 3; i++) { x.strokeRect(i * 128 + 6, 6, 116, 116); }
  x.beginPath(); x.arc(64, 64, 50, 0, 7); x.stroke(); const hd = Math.atan2(P.fwd.x, P.fwd.z);
  for (const e of G.targets) if (e.alive) { const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z, c = Math.cos(-hd), s = Math.sin(-hd), rx = (dx * c + dz * s) / 7000 * 50, rz = (-dx * s + dz * c) / 7000 * 50; if (Math.hypot(rx, rz) < 50) { x.fillStyle = e.objective ? '#ffb347' : '#ff6a5a'; x.fillRect(64 - rx - 3, 64 - rz - 3, 6, 6); } }
  x.fillStyle = '#3dff9a'; x.fillText(`SPD ${Math.round(P.speed * 3.6)}`, 140, 30); x.fillText(`ALT ${Math.round(P.alt)}`, 140, 52); x.fillText(`G ${P.g.toFixed(1)}`, 140, 74); x.fillText(`MSL ${P.msl}`, 140, 96);
  x.fillText('ENG', 270, 30); x.fillRect(270, 40, 90 * (0.4 + P.throttle * 0.6), 10); x.fillText('DMG', 270, 74); x.fillStyle = P.hp < 40 ? '#ff4a3d' : '#3dff9a'; x.fillRect(270, 84, 90 * (1 - P.hp / 100), 10);
  tex.needsUpdate = true;
}
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); C.resize(innerWidth, innerHeight); hud.resize(); setOutlineRes(innerWidth, innerHeight); });

window.__game = {
  get state() { return G.state; }, get level() { return G.mode === 'intercept' ? G.wave : G.mi + 1; }, get score() { return G.score; },
  warp(d = 700) { const t = G.targets.find(e => e.alive && e.objective) || G.targets.find(e => e.alive); if (!t) return; const dir = new V3(0.6, 0, 0.8).normalize(); P.pos.copy(t.pos).addScaledVector(dir, -d).setY(Math.max(t.pos.y + 450, 650)); P.fwd.copy(t.pos).sub(P.pos).normalize(); look(P.q, P.fwd); camP.copy(P.pos).addScaledVector(P.fwd, -30); G.introT = 0; },
  bot, G, start(i) { ui.els.start.classList.add('hc-hidden'); snd.init(); if (i === 'I') startIntercept(); else startMission(i); }, cam(m) { if (m !== G.camMode) toggleCam(); },
};
