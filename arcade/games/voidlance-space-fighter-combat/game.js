// Voidlance: Space Fighter Combat. Cockpit-view starfighter combat: 6 missions + a daily-seeded endless Gauntlet.
import { THREE, cine } from './kit/cine.js';
import { createUI, store, buzz, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { bakeSky, makeSkyBodies, Asteroids, Dust } from './world.js';
import * as MD from './models.js';
import { Particles, Bolts, Debris, Blasts, glowTex } from './fx.js';
import { createHUD, createPad } from './hud.js';
import { audioInit, S, engineStart, setEngine, musicStart, setMusic, setMuted, isMuted } from './audio.js';

const V3 = THREE.Vector3, Col = THREE.Color;
const v1 = new V3(), v2 = new V3(), v3 = new V3(), v4 = new V3(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), m1 = new THREE.Matrix4(), e1 = new THREE.Euler();
const ZP = new V3(0, 0, 1), YP = new V3(0, 1, 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
const TOUCH = (matchMedia && matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 0;

// ---------------------------------------------------------------- renderer + look
const R = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
R.domElement.className = 'vl'; document.body.prepend(R.domElement); R.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 9000); scene.add(cam);
const SMALL = Math.min(innerWidth, innerHeight) < 520;
const sky = bakeSky(R, 7, SMALL ? 512 : 1024); scene.background = sky.texture; scene.backgroundIntensity = 0.62;
const C = cine(R, scene, cam, { env: false, bloom: 0.7, bloomRadius: 0.5, bloomThreshold: 0.92, exposure: 1.0, grade: { tint: '#ffffff', sat: 1.22, contrast: 1.08, vignette: 0.16, grain: 0 } });
const LITE = C.lite || SMALL;
scene.fog = new THREE.FogExp2(0x2a2160, 0.00022);
const sun = new THREE.DirectionalLight(0xfff2e0, 2.5); sun.position.copy(new V3(0.8, 0.25, -0.45)).multiplyScalar(100); scene.add(sun);
const hemi = new THREE.HemisphereLight(0xa99cff, 0x5a2a6a, 0.95); scene.add(hemi);
const skyG = makeSkyBodies(); scene.add(skyG);

// ---------------------------------------------------------------- pools: effects, models
const fire = new Particles(scene, LITE ? 1400 : 2600, { additive: true, tex: glowTex() });
const smoke = new Particles(scene, LITE ? 500 : 900, { additive: false, tex: glowTex('smoke') });
const MATS = MD.makeMats();
const pBolts = new Bolts(scene, 160, new Col(0.6, 3.2, 4.2), { len: 10, width: 0.24 });
const eBolts = new Bolts(scene, 220, new Col(4.5, 0.6, 2.6), { len: 8, width: 0.3 });
const debris = new Debris(scene, LITE ? 80 : 150, MATS.debris);
const blasts = new Blasts(scene, LITE);
const AST = new Asteroids(scene, LITE);
const dust = new Dust(scene, LITE ? 260 : 420);
const GE = { wisp: MD.wispGeos(), hammer: MD.hammerGeos(), lance: MD.lanceGeos(), missile: MD.missileGeos(true), torp: MD.torpGeos(), turret: MD.turretGeos(false), bigTurret: MD.turretGeos(true), frigate: MD.frigateGeos(), dread: MD.dreadGeos(), dparts: MD.dreadParts(), carrier: MD.carrierGeos() };
const COCK = MD.buildCockpit(MATS); cam.add(COCK.group);
const flashTex = glowTex('star'), GLOW = glowTex(); COCK.flashes.forEach(f => (f.material.map = flashTex));

const POOL = {};
function getObj(kind, build) {
  const p = (POOL[kind] ||= []); let o = p.pop();
  if (!o) { o = build(); scene.add(o); }
  o.visible = true; o.traverse(c => (c.visible = true)); if (o.userData.reset) o.userData.reset();
  return o;
}
function relObj(kind, o) { o.visible = false; (POOL[kind] ||= []).push(o); }
function plumes(o) { const a = []; o.traverse(c => { if (c.name && c.name.startsWith('plume')) a.push(c); }); return a; }

// ---------------------------------------------------------------- UI / meta
const ui = createUI({ title: 'VOIDLANCE', hint: 'Tap to launch', hand: '', progress: false, score: false });
const ST = store('voidlance');
const D = daily('voidlance', ui, { name: 'Voidlance: Space Fighter Combat' });
const F = flow('voidlance', { par: 6000, warmup: 2500 });
const B = board({ game: 'voidlance', label: 'Score', limits: { maxRun: 400000, maxPerSec: 600 }, corner: 'tl', accent: '#ffcf3a' });
const H = createHUD(), PAD = createPad();
const today = (() => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); })();

const MISSIONS = [
  { name: 'First Light', brief: 'Choir scout drones are probing the Keth belt. Clear them before they call the swarm.', field: { count: 300, radius: 650, clear: 90, center: [0, 0, -60] }, wing: 2,
    phases: [{ obj: 'Destroy the scout drones', spawn: s => s.wisps(4, [0, 20, -320]), say: ['VESNA', 'Lance Two, weapons free. Four scouts dead ahead.'] },
             { obj: 'Second flight inbound', spawn: s => s.wisps(5, [-380, 60, -120]), say: ['VESNA', 'More on the left flank! Break and engage.'] }] },
  { name: 'Rockfall', brief: 'The carrier Halcyon is crossing the belt. Choir bombers want it. Keep them off her hull.', field: { count: 380, radius: 720, clear: 70, center: [0, 0, -120] }, wing: 2, carrier: [190, -50, 560],
    phases: [{ obj: 'Clear the screen', spawn: s => s.wisps(4, [0, 30, -350]), say: ['HALCYON', 'Lance flight, you are our only cover. Clear that screen.'] },
             { obj: 'Stop the bombers', spawn: s => { s.hammers(3, [-300, 40, -380], 'carrier'); s.wisps(3, [200, 0, -380]); }, say: ['KOTA', 'Bombers! Heavy signatures heading for Halcyon!'] },
             { obj: 'Last strike wave', spawn: s => { s.hammers(3, [300, -40, -300], 'carrier'); s.wisps(4, [-200, 60, -400]); }, say: ['HALCYON', 'Torpedoes in the water... er, in the void. Shoot them down!'] }] },
  { name: 'Iron Picket', brief: 'A Cantor-class frigate guards the jump lane. Strip its turrets, then break its hull.', field: { count: 220, radius: 650, clear: 140, center: [0, 0, -300] }, wing: 2,
    phases: [{ obj: 'Destroy the frigate', spawn: s => { s.frigate([0, 30, -560]); s.wisps(4, [100, 40, -420], false); }, say: ['VESNA', 'Frigate on the lane. Turrets first, then hit the hull with missiles.'] },
             { obj: 'Mop up the escorts', spawn: s => s.wisps(5, [-300, 0, -200]), say: ['KOTA', 'Its escorts are angry. Very angry.'] }] },
  { name: 'Needle Run', brief: 'Two frigates are hiding in the densest part of the belt. Thread the rocks and take them both.', field: { count: 460, radius: 760, clear: 60, center: [0, 0, -380] }, wing: 2,
    phases: [{ obj: 'Destroy both frigates', spawn: s => { s.frigate([-260, 0, -620]); s.frigate([300, 50, -720]); s.wisps(4, [0, 40, -420], false); s.hammers(2, [0, -40, -500], 'player', false); }, say: ['VESNA', 'Tight rocks, big guns. Use the asteroids as cover.'] },
             { obj: 'Clear the belt', spawn: s => s.wisps(6, [0, 80, -300]), say: ['KOTA', 'Drone swarm waking up! Here they come!'] }] },
  { name: 'Hammerfall', brief: 'The Choir has found Halcyon again. Three strike waves, one frigate. Nothing gets through.', field: { count: 300, radius: 700, clear: 90, center: [0, 0, -150] }, wing: 2, carrier: [160, -40, 560],
    phases: [{ obj: 'Stop the bombers', spawn: s => { s.hammers(4, [-260, 30, -420], 'carrier'); s.wisps(4, [260, 0, -420]); }, say: ['HALCYON', 'Strike wave inbound. Lance flight, intercept!'] },
             { obj: 'Destroy the frigate', spawn: s => { s.frigate([0, 60, -620]); s.hammers(3, [300, 0, -350], 'carrier', false); }, say: ['VESNA', 'Frigate jumping in, bearing zero-zero-one. Take it down.'] },
             { obj: 'Final strike wave', spawn: s => { s.hammers(5, [0, -60, -450], 'carrier'); s.wisps(5, [-300, 60, -380]); }, say: ['KOTA', 'Everything they have left. This is it!'] }] },
  { name: 'Requiem', brief: 'The dreadnought Requiem leads the swarm. Take it apart: shields, engines, then the reactor core.', field: { count: 200, radius: 800, clear: 300, center: [0, 0, -400] }, wing: 2,
    phases: [{ obj: 'Destroy the shield generators', spawn: s => { s.dread([0, 40, -820]); s.wisps(4, [0, 80, -500], false); }, say: ['VESNA', 'That is the Requiem. Shield generators on the wings. Go!'] },
             { obj: 'Cripple the engine banks', spawn: s => { s.wisps(4, [-200, 0, -500], false); }, say: ['KOTA', 'Shields are down! Engines at the stern, hit them!'] },
             { obj: 'Destroy the reactor core', spawn: s => { s.wisps(5, [200, -40, -500], false); }, say: ['VESNA', 'Its belly is open. The core! Hit the core!'] }] },
];
const NAMES = { wisp: 'WISP DRONE', hammer: 'HAMMER BOMBER', torp: 'TORPEDO', turret: 'TURRET', bigturret: 'BATTERY', frigate: 'CANTOR FRIGATE', gen: 'SHIELD GEN', eng: 'ENGINE BANK', core: 'REACTOR CORE', lance: 'WINGMAN', carrier: 'HALCYON' };
const PTS = { wisp: 100, hammer: 250, torp: 25, turret: 150, bigturret: 200, frigate: 1500, gen: 600, eng: 600, core: 3000 };

// ---------------------------------------------------------------- state
let state = 'ready', mode = 'campaign', mIdx = Math.min(ST.get('unlocked', 0), 5), sel = D.seed ? 'g' : mIdx;
let ents = [], missiles = [], burners = [], phase = 0, phaseT = 0, phaseWait = 0, score = 0, chain = 1, chainT = 0, kills = 0, runT = 0, endT = -1, endWin = false, wave = 0, beatenPop = false, rnd = Math.random;
let carrier = null, dread = null, shake = 0, botOn = 0, menuT = 0, lowT = 0, recorded = false;
const P = { pos: new V3(), q: new THREE.Quaternion(), vel: new V3(), w: new V3(), thr: 0.65, boost: 1, boosting: false, shield: 100, hull: 100, heat: 0, over: 0, missiles: 6, pwr: 0, fireCd: 0, side: 1, lockT: 0, locked: null, target: null, alive: true, shCd: 0, hitT: 0, tgtT: 0, mslCd: 0, team: 0, r: 3, kind: 'player' };
const PWR = ['BAL', 'ENG', 'WPN', 'SHD'];
const IN = { mx: 0, my: 0, fire: false, boost: false, roll: 0, thrUp: false, thrDn: false, msl: 0, locked: false };

// ---------------------------------------------------------------- entities
function baseEnt(kind, team, obj, hp, r, extra = {}) {
  const e = { kind, team, obj, pos: obj.position, vel: new V3(), hp, maxHp: hp, r, alive: true, req: false, state: 'attack', stT: 0, tt: 0, target: null, fireCd: 1 + Math.random() * 2, burst: 0, brk: new V3(), hitT: 0, ...extra };
  e.plumes = plumes(obj); ents.push(e); return e;
}
function fighter(kind, pos, team, req = true) {
  const g = kind === 'wisp' ? GE.wisp : kind === 'hammer' ? GE.hammer : GE.lance;
  const obj = getObj(kind, () => { const o = MD.meshFrom(g, MATS, kind === 'hammer' ? 0.09 : 0.07);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: kind === 'lance' ? new Col(0.4, 1.6, 2) : kind === 'hammer' ? new Col(2.2, 1.4, 0.3) : new Col(2.4, 0.5, 1.6), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    sp.scale.setScalar(kind === 'hammer' ? 9 : 7); sp.position.z = kind === 'lance' ? -4 : -2.6; sp.renderOrder = 4; o.add(sp); return o; });
  obj.position.copy(pos); obj.scale.setScalar(kind === 'wisp' ? 2.6 : kind === 'hammer' ? 2.1 : 2.2);
  const hp = kind === 'wisp' ? 30 : kind === 'hammer' ? 90 : 400;
  const e = baseEnt(kind, team, obj, hp, kind === 'wisp' ? 8.5 : kind === 'hammer' ? 13 : 9, { fighter: true, req: team === 1 && req, speed: kind === 'hammer' ? 46 : kind === 'wisp' ? 76 : 84, turn: kind === 'hammer' ? 0.9 : kind === 'wisp' ? 1.7 : 1.9 });
  obj.lookAt(P.pos); e.vel.set(0, 0, 1).applyQuaternion(obj.quaternion).multiplyScalar(e.speed);
  return e;
}
function torpedo(from, target) {
  const obj = getObj('torp', () => MD.meshFrom(GE.torp, MATS, 0.06)); obj.position.copy(from.pos); obj.quaternion.copy(from.obj.quaternion); obj.scale.setScalar(1.6);
  const e = baseEnt('torp', 1, obj, 10, 3.5, { fighter: true, torp: true, speed: 58, turn: 0.75, life: 14 }); e.target = target; e.vel.set(0, 0, 1).applyQuaternion(obj.quaternion).multiplyScalar(30);
  return e;
}
function addTurret(ship, mount, big) {
  const g = big ? GE.bigTurret : GE.turret, base = MD.meshFrom(g.base, MATS), head = MD.meshFrom(g.head, MATS);
  base.position.fromArray(mount.p); base.quaternion.setFromUnitVectors(YP, v1.fromArray(mount.up)); head.position.y = (big ? 1.7 : 1) * 2.3; base.add(head); ship.add(base);
  return { base, head, up: new V3().fromArray(mount.up), big };
}
function buildFrigate() {
  const o = MD.meshFrom(GE.frigate.geos, MATS, 0.35); o.userData.turrets = GE.frigate.mounts.map(m => addTurret(o, m, false));
  return o;
}
function frigate(p) {
  const obj = getObj('frigate', buildFrigate); obj.position.fromArray(p); obj.lookAt(P.pos.x, p[1], P.pos.z); obj.scale.setScalar(1);
  const e = baseEnt('frigate', 1, obj, 650, 70, { capital: true, req: true, speed: 5, hull: GE.frigate.hull.map(h => ({ l: new V3(h[0], h[1], h[2]), r: h[3], p: new V3() })), subs: [], armor: 0.5 });
  for (const t of obj.userData.turrets) e.subs.push(subEnt('turret', e, t.head, 70, 5, { tur: t }));
  return e;
}
function subEnt(kind, parent, obj, hp, r, extra = {}) {
  const s = { kind, team: 1, sub: true, parent, obj, pos: new V3(), vel: new V3(), hp, maxHp: hp, r, alive: true, fireCd: 2 + Math.random() * 2, burst: 0, ...extra };
  obj.getWorldPosition(s.pos); ents.push(s); return s;
}
function buildDread() {
  const o = MD.meshFrom(GE.dread.geos, MATS, 0.9), P2 = GE.dparts;
  const gens = [-1, 1].map(s => { const g = MD.meshFrom(P2.gen, MATS, 0.4); g.position.set(s * 60, 7, 10); o.add(g); return g; });
  const engs = [-1, 1].map(s => { const g = MD.meshFrom(P2.eng, MATS, 0.5); g.position.set(s * 60, -4, -142); o.add(g); return g; });
  const core = MD.meshFrom(P2.core, MATS); core.position.set(0, -27, 25); o.add(core);
  const shells = [0, 1].map(i => { const g = MD.meshFrom(P2.shell, MATS, 0.4); g.position.set(0, -27, 25); g.rotation.set(0, i * Math.PI, 0); o.add(g); return g; });
  const mounts = [{ p: [0, 19.5, 120], up: [0, 1, 0] }, { p: [0, 36.5, -20], up: [0, 1, 0] }, { p: [60, 7.5, 70], up: [0, 1, 0] }, { p: [-60, 7.5, 70], up: [0, 1, 0] }, { p: [60, 7.5, -70], up: [0, 1, 0] }, { p: [-60, 7.5, -70], up: [0, 1, 0] }, { p: [0, -19.5, -60], up: [0, -1, 0] }, { p: [0, -19.5, 140], up: [0, -1, 0] }];
  o.userData = { gens, engs, core, shells, turrets: mounts.map(m => addTurret(o, m, true)) };
  o.userData.reset = () => { shells.forEach((s, i) => { s.position.set(0, -27, 25); }); };
  return o;
}
function dreadSpawn(p) {
  const obj = getObj('dread', buildDread); obj.position.fromArray(p); obj.lookAt(P.pos.x, p[1], P.pos.z);
  const U = obj.userData;
  const hull = []; for (let z = 200; z >= -150; z -= 35) hull.push({ l: new V3(0, 0, z), r: z > 160 ? 24 : 30, p: new V3() });
  for (const s of [-1, 1]) for (let z = 80; z >= -120; z -= 40) hull.push({ l: new V3(s * 60, -4, z), r: 22, p: new V3() });
  hull.push({ l: new V3(0, 40, -90), r: 22, p: new V3() });
  const e = baseEnt('dread', 1, obj, 99999, 260, { capital: true, speed: 3.5, hull, subs: [], invuln: true, launchT: 18 });
  for (const g of U.gens) e.subs.push(subEnt('gen', e, g, 380, 14, { req: true, ph: 0 }));
  for (const g of U.engs) e.subs.push(subEnt('eng', e, g, 460, 20, { req: true, ph: 1, invuln: true }));
  e.subs.push(subEnt('core', e, U.core, 1300, 14, { req: true, ph: 2, invuln: true }));
  for (const t of U.turrets) e.subs.push(subEnt('bigturret', e, t.head, 150, 7, { tur: t }));
  dread = e; return e;
}
function carrierSpawn(p) {
  const obj = getObj('carrier', () => MD.meshFrom(GE.carrier.geos, MATS, 0.6)); obj.position.fromArray(p); obj.rotation.set(0, Math.PI, 0);
  const e = baseEnt('carrier', 0, obj, 2200, 120, { capital: true, speed: 4, hull: GE.carrier.hull.map(h => ({ l: new V3(h[0], h[1], h[2]), r: h[3], p: new V3() })), subs: [], pdT: 0 });
  carrier = e; return e;
}

// spawner used by mission phases
function near(c, max = 420) {      // pull a spawn group toward the player so fights start on screen
  const p = v3.fromArray(c); const d = p.distanceTo(P.pos); if (d > max && state === 'play') p.sub(P.pos).multiplyScalar(max / d).add(P.pos); return p.toArray();
}
const SP = {
  wisps(n, c, req = true) { c = near(c); for (let i = 0; i < n; i++) fighter('wisp', v1.fromArray(c).add(v2.set((rnd() - 0.5) * 120, (rnd() - 0.5) * 70, (rnd() - 0.5) * 120)), 1, req); },
  hammers(n, c, tgt, req = true) { c = near(c, 520); for (let i = 0; i < n; i++) { const e = fighter('hammer', v1.fromArray(c).add(v2.set((i - n / 2) * 40, (rnd() - 0.5) * 40, (rnd() - 0.5) * 60)), 1, req); e.goal = tgt; } },
  frigate(p) { frigate(p); }, dread(p) { dreadSpawn(p); },
};

// ---------------------------------------------------------------- run setup
function clearWorld() {
  for (const e of ents) if (!e.sub && e.obj) relObj(e.kind, e.obj);
  for (const m of missiles) relObj(m.kind, m.obj);
  ents = []; missiles = []; burners = []; carrier = null; dread = null;
  pBolts.clear(); eBolts.clear(); debris.clear(); fire.clear(); smoke.clear();
}
function resetPlayer() {
  P.pos.set(0, 0, 430); P.q.identity(); P.vel.set(0, 0, -60); P.w.set(0, 0, 0); P.thr = 0.65; P.boost = 1; P.shield = 100; P.hull = 100; P.heat = 0; P.over = 0; P.missiles = 6; P.pwr = 0;
  P.lockT = 0; P.locked = null; P.target = null; P.alive = true; P.shCd = 0; P.fireCd = 0; P.mslCd = 0;
}
function launch(which) {
  audioInit(); engineStart(); musicStart();
  clearWorld(); resetPlayer(); score = 0; chain = 1; chainT = 0; kills = 0; runT = 0; endT = -1; phase = 0; phaseWait = 1.2; wave = 0; beatenPop = false; recorded = false;
  mode = which === 'g' ? 'gauntlet' : 'campaign';
  if (mode === 'campaign') {
    mIdx = which; const M = MISSIONS[mIdx]; rnd = rng(1000 + mIdx * 77);
    AST.build(rnd, new V3().fromArray(M.field.center), M.field);
    if (M.carrier) carrierSpawn(M.carrier);
    for (let i = 0; i < (M.wing || 0); i++) fighter('lance', v1.set(i ? 40 : -40, -8, 470), 0).obj.lookAt(0, -8, 0);
    H.big(`MISSION ${mIdx + 1}`, M.name.toUpperCase(), 2.6);
  } else {
    rnd = rng(D.seed || today); AST.build(rnd, new V3(0, 0, -100), { count: 340, radius: 760, clear: 80 });
    for (let i = 0; i < 2; i++) fighter('lance', v1.set(i ? 40 : -40, -8, 470), 0).obj.lookAt(0, -8, 0);
    H.big('GAUNTLET', `DAILY RUN · ${String(today).slice(4, 6)}/${String(today).slice(6)}`, 2.6);
  }
  state = 'play'; COCK.group.visible = true; H.show(true); PAD.show(TOUCH); B.start();
}
function nextPhase() {
  if (mode === 'campaign') {
    const M = MISSIONS[mIdx]; if (phase >= M.phases.length) return finish(true);
    const ph = M.phases[phase]; ph.spawn(SP); if (ph.say) say(...ph.say);
  } else {
    wave++; const r = rng((D.seed || today) * 31 + wave), k = F.k(score);
    const nW = Math.min(12, Math.round((3 + wave) * k)), nH = Math.min(5, Math.floor(wave / 2)), nF = Math.floor(wave / 4);
    const ang = r() * Math.PI * 2, c = [Math.cos(ang) * 520, (r() - 0.5) * 120, -100 + Math.sin(ang) * 520];
    rnd = r; SP.wisps(nW, c); if (nH) SP.hammers(nH, [c[0] * -0.8, c[1], c[2]], 'player'); for (let i = 0; i < nF; i++) frigate([Math.cos(ang + 1 + i) * 650, 40, -100 + Math.sin(ang + 1 + i) * 650]);
    if (wave > 1) { H.big(`WAVE ${wave}`, `+${(wave - 1) * 250} · SHIELDS RESTORED`, 2.2); P.shield = 100; P.hull = Math.min(100, P.hull + 15); P.missiles = Math.min(8, P.missiles + 2); addScore((wave - 1) * 250, false); }
    else H.big('WAVE 1', 'SURVIVE AS LONG AS YOU CAN', 2.2);
    say(...[['VESNA', 'Contacts on scope. Weapons free.'], ['KOTA', 'Another wave! They just keep coming.'], ['VESNA', 'Stay sharp, Lance Two. Watch your six.'], ['KOTA', 'Bigger signatures this time!']][wave % 4]);
  }
  phase++;
}
const reqOn = e => e.req && (e.ph === undefined || e.ph === phase - 1);
function phaseDone() {
  for (const e of ents) if (e.alive && reqOn(e)) return false;
  return true;
}
function finish(win) {
  if (endT >= 0) return; endWin = win; endT = 0;
  if (win) { const bonus = mode === 'campaign' ? 1000 * (mIdx + 1) + Math.round(P.hull) * 10 : 0; addScore(bonus, false); H.big('MISSION COMPLETE', bonus ? `+${bonus} BONUS` : '', 3); S.win(); }
}
function endRun() {
  state = endWin ? 'won' : 'lost'; H.show(false); PAD.show(false); document.exitPointerLock && document.pointerLockElement && document.exitPointerLock();
  B.submit(score, { ms: Math.round(runT * 1000) });
  if (!recorded) { recorded = true; if (mode === 'gauntlet') F.endless(score); else F.level(endWin, Math.min(1, phase / MISSIONS[mIdx].phases.length)); }
  ST.set('best', Math.max(ST.get('best', 0), score));
  if (endWin) {
    if (mode === 'campaign') ST.set('unlocked', Math.max(ST.get('unlocked', 0), Math.min(5, mIdx + 1)));
    D.won(score);
    ui.els.win.querySelector('h1').textContent = mIdx === 5 ? 'REQUIEM FALLS' : 'VICTORY';
    ui.win(`${mIdx + 1} · ${MISSIONS[mIdx].name.toUpperCase()}`, '');
    statsInto(ui.els.win.querySelector('[data-x]'));
  } else {
    ui.lose(mode === 'gauntlet' ? 'GAUNTLET OVER' : carrier && !carrier.alive ? 'HALCYON LOST' : 'SHOT DOWN', '');
    statsInto(ui.els.lose.querySelector('[data-x]'));
  }
}
function statsInto(el) {
  el.innerHTML = `<div class="vl-stats"><span>SCORE</span><b>${score.toLocaleString()}</b><span>KILLS</span><b>${kills}</b>${mode === 'gauntlet' ? `<span>WAVE</span><b>${wave}</b>` : ''}<span>TIME</span><b>${Math.floor(runT / 60)}:${String(Math.floor(runT % 60)).padStart(2, '0')}</b><span>BEST</span><b>${ST.get('best', 0).toLocaleString()}</b></div>`;
}
ui.els.win.querySelector('p').firstChild.textContent = 'MISSION ';

// ---------------------------------------------------------------- start card (hangar)
const card = ui.els.start;
card.querySelector('h1').insertAdjacentHTML('afterend', '<div class="vl-tag">SPACE FIGHTER COMBAT</div>');
const brief = document.createElement('div'); brief.className = 'vl-brief'; const chips = document.createElement('div'); chips.className = 'vl-chips';
const keys = document.createElement('div'); keys.className = 'vl-keys'; keys.textContent = TOUCH ? 'Left stick: fly · FIRE · MSL locks on · BOOST · PWR routes power' : 'Mouse: fly · Click: fire · Right-click: missile · Shift: boost · W/S: throttle · A/D: roll · 1-4: power';
const hint = card.querySelector('.hint'); card.insertBefore(brief, hint); card.insertBefore(chips, hint); card.insertBefore(keys, hint);
function renderMenu() {
  const un = ST.get('unlocked', 0);
  chips.innerHTML = MISSIONS.map((m, i) => `<button class="vl-chip" data-i="${i}" aria-pressed="${sel === i}" ${i > un ? 'disabled' : ''}>${i > un ? '🔒' : i + 1}</button>`).join('') + `<button class="vl-chip g" data-i="g" aria-pressed="${sel === 'g'}">DAILY GAUNTLET</button>`;
  if (sel === 'g') brief.innerHTML = `<small>ENDLESS · TODAY'S SEED</small><b>THE GAUNTLET</b><span>Wave after wave from the Choir swarm. Same waves for every pilot today. Best run counts on the world board.</span>`;
  else brief.innerHTML = `<small>MISSION ${sel + 1} OF 6</small><b>${MISSIONS[sel].name.toUpperCase()}</b><span>${MISSIONS[sel].brief}</span>`;
}
chips.addEventListener('pointerdown', e => { const b = e.target.closest('button'); if (b && !b.disabled) e.stopPropagation(); });
chips.addEventListener('click', e => { const b = e.target.closest('button'); if (!b || b.disabled) return; e.stopPropagation(); sel = b.dataset.i === 'g' ? 'g' : +b.dataset.i; S.ui(); renderMenu(); });
renderMenu();
for (const c of [ui.els.win, ui.els.lose]) {
  const b = document.createElement('button'); b.className = 'hc-btn'; b.textContent = 'HANGAR'; b.style.marginTop = '10px';
  b.addEventListener('pointerdown', e => e.stopPropagation()); b.addEventListener('click', e => { e.stopPropagation(); c.classList.add('hc-hidden'); toMenu(); });
  c.querySelector('.hint').before(b);
}
ui.onTap(w => {
  audioInit();
  if (w === 'start') launch(sel);
  else if (w === 'win') launch(mode === 'gauntlet' ? 'g' : Math.min(5, mIdx + 1));
  else launch(mode === 'gauntlet' ? 'g' : mIdx);
});
function toMenu() { state = 'ready'; sel = mode === 'gauntlet' ? 'g' : Math.min(ST.get('unlocked', 0), mIdx + (endWin ? 1 : 0)); renderMenu(); ui.start(); setupAttract(); }
const mute = document.createElement('button'); mute.className = 'mute'; mute.textContent = '🔊'; document.body.appendChild(mute);
mute.addEventListener('pointerdown', e => e.stopPropagation()); mute.addEventListener('click', e => { e.stopPropagation(); audioInit(); setMuted(!isMuted()); mute.textContent = isMuted() ? '🔇' : '🔊'; });

// attract scene behind the menu: a live skirmish around a Choir frigate, slow cinematic camera
function setupAttract() {
  clearWorld(); resetPlayer(); rnd = rng(42); COCK.group.visible = false; H.show(false); PAD.show(false); H.clear();
  AST.build(rnd, new V3(0, 0, -200), { count: 300, radius: 700, clear: 120 });
  frigate([60, 10, -260]); ents[0].obj.rotation.set(0.05, -2.0, 0.12); ents[0].speed = 0;
  for (let k = 0; k <= 1; k += 0.1) AST.carve(v1.set(60, 10, -260).lerp(v2.set(95, 30, -40), k), 70);
  for (let i = 0; i < 5; i++) fighter('wisp', v1.set(-80 + rnd() * 200, rnd() * 60, -150 - rnd() * 150), 1);
  for (let i = 0; i < 3; i++) fighter('lance', v1.set(-60 + i * 40, -20, -40), 0);
  menuT = 0;
}

// ---------------------------------------------------------------- input (desktop)
let locked = false;
addEventListener('mousemove', e => {
  if (state !== 'play' || TOUCH) return;
  if (locked) { IN.mx = clamp(IN.mx + e.movementX / 260, -1, 1); IN.my = clamp(IN.my + e.movementY / 260, -1, 1); const l = Math.hypot(IN.mx, IN.my); if (l > 1) { IN.mx /= l; IN.my /= l; } }
  else { const s = Math.min(innerWidth, innerHeight) * 0.38; IN.mx = clamp((e.clientX - innerWidth / 2) / s, -1, 1); IN.my = clamp((e.clientY - innerHeight / 2) / s, -1, 1); }
});
R.domElement.addEventListener('mousedown', e => {
  if (state !== 'play' || TOUCH) return;
  if (e.button === 0) { IN.fire = true; if (!locked && R.domElement.requestPointerLock) { try { const r = R.domElement.requestPointerLock(); r && r.catch && r.catch(() => {}); } catch (er) {} } }
  if (e.button === 2) IN.msl++;
});
addEventListener('mouseup', e => { if (e.button === 0) IN.fire = false; });
addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === R.domElement; if (locked) { IN.mx = IN.my = 0; } });
const KEY = {};
addEventListener('keydown', e => {
  KEY[e.code] = true; if (state !== 'play') { if ((e.code === 'Space' || e.code === 'Enter') && state === 'ready') { card.classList.add('hc-hidden'); launch(sel); } return; }
  if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3' || e.code === 'Digit4') setPower(+e.code.slice(5) - 1);
  if (e.code === 'KeyP' || e.code === 'Tab') { e.preventDefault(); setPower((P.pwr + 1) % 4); }
  if (e.code === 'KeyF' || e.code === 'KeyE' && false) IN.msl++;
  if (e.code === 'KeyR') IN.msl++;
  if (e.code === 'KeyT') P.tgtT = 0, P.target = null;
});
addEventListener('keyup', e => (KEY[e.code] = false));
function setPower(i) { if (P.pwr === i) return; P.pwr = i; S.power(); H.big(`POWER: ${['BALANCED', 'ENGINES', 'WEAPONS', 'SHIELDS'][i]}`, '', 1.1); }

// ---------------------------------------------------------------- helpers
function segSphere(a, b, c, r) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z, acx = c.x - a.x, acy = c.y - a.y, acz = c.z - a.z;
  const L2 = abx * abx + aby * aby + abz * abz; let t = L2 > 0 ? (acx * abx + acy * aby + acz * abz) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = a.x + abx * t - c.x, dy = a.y + aby * t - c.y, dz = a.z + abz * t - c.z; return dx * dx + dy * dy + dz * dz <= r * r;
}
function leadPoint(from, T, sp, out) { out.copy(T.pos); let t = out.distanceTo(from) / sp; for (let i = 0; i < 2; i++) { out.copy(T.vel).multiplyScalar(t).add(T.pos); t = out.distanceTo(from) / sp; } return out; }
const fwdOf = (q, out) => out.set(0, 0, -1).applyQuaternion(q);
function hostilesOf(team) { return ents.filter(e => e.alive && e.team !== team && !e.torp && (e.fighter || e.capital || e.sub) && !(e.capital && e.subs && e.kind === 'dread')); }

// ---------------------------------------------------------------- effects
const CF = new Col(), CR = new Col();
function boom(p, size, hue = 'fire') {
  const d = p.distanceTo(cam.position), n = Math.min(60, Math.round(16 * Math.pow(size, 0.8)));
  blasts.flash(p, size * 4.5, CF.setRGB(2.4, 1.6, 1.0), 0.25 + size * 0.04);
  blasts.ring(p, size * 22, hue === 'blue' ? CR.setRGB(0.3, 1.1, 1.5) : CR.setRGB(1.6, 0.5, 1.2), 0.6 + size * 0.08);
  if (size > 1.5) blasts.ring(p, size * 16, CR.setRGB(1.6, 1.2, 0.3), 0.8 + size * 0.1);
  for (let i = 0; i < n; i++) {
    v1.randomDirection().multiplyScalar((6 + Math.random() * 18) * Math.sqrt(size));
    fire.spawn(p.x, p.y, p.z, v1.x, v1.y, v1.z, 0.5 + Math.random() * 0.6 * Math.sqrt(size), size * 2.5, size * (6 + Math.random() * 5), 4, 1.9, 0.8, 1, 2.2, 2.2);
  }
  for (let i = 0; i < n * 0.6; i++) { v1.randomDirection().multiplyScalar((3 + Math.random() * 8) * Math.sqrt(size)); smoke.spawn(p.x + v1.x, p.y + v1.y, p.z + v1.z, v1.x, v1.y, v1.z, 1.6 + Math.random() * 1.6 * Math.sqrt(size), size * 4, size * 13, 0.42, 0.34, 0.6, 0.55, 0.6); }
  for (let i = 0; i < n * 1.2; i++) { v1.randomDirection().multiplyScalar(60 + Math.random() * 90 * Math.sqrt(size)); fire.spawn(p.x, p.y, p.z, v1.x, v1.y, v1.z, 0.4 + Math.random() * 0.6, 0.9, 0.3, 5, 3.6, 1.6, 1, 1.6); }
  for (let i = 0; i < Math.min(14, 3 + size * 3); i++) { v1.randomDirection().multiplyScalar(14 + Math.random() * 30); debris.spawn(p, v1, 0.4 + Math.random() * size * 0.8, 2 + Math.random() * 2, 1); }
  blasts.light(p, 4000 * size * size, CF.setRGB(1, 0.65, 0.35), 0.5 + size * 0.1);
  S.explode(size, d); shake = Math.min(1.2, shake + size * 0.5 / (1 + d / 120));
}
function sparks(p, n = 6, c = [5, 3.5, 1.4]) {
  for (let i = 0; i < n; i++) { v1.randomDirection().multiplyScalar(30 + Math.random() * 50); fire.spawn(p.x, p.y, p.z, v1.x, v1.y, v1.z, 0.25 + Math.random() * 0.3, 0.7, 0.2, c[0], c[1], c[2], 1, 3); }
  fire.spawn(p.x, p.y, p.z, 0, 0, 0, 0.18, 4, 7, c[0] * 0.6, c[1] * 0.6, c[2] * 0.6, 1, 0);
}
function addBurner(obj, scale = 1, off = null) { burners.push({ obj, s: scale, off: off ? off.clone() : new V3(), t: 0 }); }
function say(who, text) { H.comms(who, text, 4.2); S.radio(); }
function addScore(n, chainIt = true) {
  if (chainIt) { chain = chainT > 0 ? Math.min(4, chain + 1) : 1; chainT = 3.5; n *= chain; }
  score += n; if (D.beat && !beatenPop && D.beaten(score)) { beatenPop = true; H.big('BEATEN!', `TARGET ${D.beat.toLocaleString()} PASSED`, 2); }
}

// ---------------------------------------------------------------- damage + kills
function damage(e, dmg, p, src) {
  if (!e.alive) return;
  if (e.invuln) { sparks(p, 4, [2, 3, 5]); if (src === P) { S.armor(); if (Math.random() < 0.02) H.big('ARMORED', e.kind === 'core' ? 'DESTROY SHIELDS + ENGINES FIRST' : e.kind === 'eng' ? 'DESTROY THE SHIELD GENERATORS FIRST' : 'TARGET THE SUBSYSTEMS', 1.6, true); } return; }
  e.hp -= dmg; e.hitT = 0.12; sparks(p, 5);
  if (src === P) { S.hit(); H.hit(false); }
  if (e.fighter && e.state === 'attack' && Math.random() < 0.35) { e.state = 'evade'; e.stT = 0.8 + Math.random(); e.brk.randomDirection(); }
  if (e.hp <= 0) kill(e, src);
}
function kill(e, src) {
  e.alive = false;
  const big = e.kind === 'hammer' ? 1.6 : e.kind === 'wisp' ? 1.1 : e.kind === 'torp' ? 0.7 : e.kind === 'lance' ? 1.2 : e.sub ? (e.kind === 'core' ? 6 : e.kind === 'turret' ? 1.4 : 2.4) : e.kind === 'frigate' ? 5 : 3;
  if (e.kind === 'frigate' || e.kind === 'dread') { e.dying = 0; e.dyingP = 0; }
  else boom(e.pos, big, e.team === 0 ? 'blue' : 'fire');
  if (src === P && PTS[e.kind]) { addScore(PTS[e.kind]); kills++; H.kill(`${NAMES[e.kind]} DESTROYED  +${PTS[e.kind] * chain}`); H.hit(true); buzz(20); }
  if (e.fighter) relObj(e.kind, e.obj);
  if (e.sub) {
    if (e.kind === 'turret' || e.kind === 'bigturret') { e.obj.visible = false; addBurner(e.tur.base, e.kind === 'bigturret' ? 2 : 1.2); if (e.parent.kind === 'frigate') damage(e.parent, 60, e.pos, null); }
    if (e.kind === 'gen') { e.obj.children.forEach(c => { if (c.material === MATS.shieldGen) c.visible = false; }); addBurner(e.obj, 3, v1.set(0, 6, 0)); }
    if (e.kind === 'eng') { e.obj.children.forEach(c => { if (c.material === MATS.plumeR || c.material === MATS.red) c.visible = false; }); addBurner(e.obj, 3.5, v1.set(0, 0, -10)); }
    if (e.kind === 'core') { e.obj.visible = false; e.parent.alive = false; e.parent.dying = 0; e.parent.dyingP = 0; }
  }
  if (e.kind === 'lance') say(Math.random() < 0.5 ? 'KOTA' : 'VESNA', 'I\'m hit! Ejecting!');
  if (e.kind === 'carrier') { boom(e.pos, 8); finish(false); }
}

// ---------------------------------------------------------------- bolt collisions
function boltVsWorld(b) {
  const a = b.prev, c = b.p;
  for (const r of AST.rocks) { const dx = r.p.x - c.x, dy = r.p.y - c.y, dz = r.p.z - c.z, rr = r.r + 12; if (dx * dx + dy * dy + dz * dz > rr * rr) continue; if (segSphere(a, c, r.p, r.r * 0.92)) { sparks(c, 4, [3, 2.2, 1.4]); return true; } }
  return false;
}
function hitTeam(b, team) {   // bolt b hits something of `team`
  const a = b.prev, c = b.p;
  for (const e of ents) {
    if (!e.alive || e.team !== team) continue;
    if (e.capital) {
      if (c.distanceToSquared(e.pos) > (e.r + 20) * (e.r + 20)) continue;
      for (const s of e.subs) if (s.alive && segSphere(a, c, s.pos, s.r + (b.owner === P ? 1.5 : 0))) { damage(s, b.dmg, c, b.owner); return true; }
      for (const h of e.hull) if (segSphere(a, c, h.p, h.r)) { if (e.kind === 'frigate') damage(e, b.dmg * e.armor, c, b.owner); else { sparks(c, 4, team === 0 ? [1, 3, 4] : [4, 2, 4]); if (e.kind === 'carrier') { e.hp -= b.dmg * 0.4; if (e.hp <= 0 && e.alive) kill(e, null); } else if (b.owner === P) S.armor(); } return true; }
    } else if (e.fighter && !e.sub) { if (segSphere(a, c, e.pos, e.r + (b.owner === P && TOUCH ? 1.5 : 0))) { damage(e, b.dmg, c, b.owner); return true; } }
  }
  return false;
}
function hitPlayer(b) {
  if (!P.alive || state !== 'play') return false;
  if (segSphere(b.prev, b.p, P.pos, P.r)) { hurt(b.dmg, b.p); return true; }
  return false;
}
function hurt(d, from) {
  if (!P.alive) return;
  P.shCd = P.pwr === 3 ? 1.5 : 3;
  if (P.shield > 0) { P.shield -= d; H.shd(0.9); S.shieldHit(); if (P.shield < 0) { P.hull += P.shield; P.shield = 0; H.big('SHIELDS DOWN', '', 1.2, true); } }
  else { P.hull -= d * 1.0; H.dmg(0.85); S.hullHit(); buzz(40); }
  shake = Math.min(1, shake + 0.28 + d * 0.01);
  if (P.hull <= 0) { P.hull = 0; P.alive = false; boom(v1.copy(P.pos).addScaledVector(fwdOf(P.q, v2), 6), 2.2); shake = 1.4; finish(false); }
}

// ---------------------------------------------------------------- player flight + weapons
const MUZ = [new V3(-0.62, -0.42, -3), new V3(0.62, -0.42, -3)];
function updatePlayer(dt) {
  if (!P.alive) { P.pos.addScaledVector(P.vel, dt); P.vel.multiplyScalar(1 - dt * 0.5); q1.setFromEuler(e1.set(dt * 0.8, dt * 0.3, dt * 2.4)); P.q.multiply(q1); return; }
  let pitch = 0, yaw = 0, roll = 0, fireOn = false, boostOn = false, msl = 0, thr = 0;
  if (botOn > 0) { const bi = botInput(dt); pitch = bi.pitch; yaw = bi.yaw; fireOn = bi.fire; boostOn = bi.boost; msl = bi.msl; }
  else if (TOUCH && PAD.st.used) {
    const ex = v => Math.sign(v) * Math.pow(Math.abs(v), 1.4);
    yaw = ex(PAD.st.sx); pitch = -ex(PAD.st.sy); fireOn = PAD.st.fire; boostOn = PAD.st.boost; msl = PAD.st.msl; PAD.st.msl = 0;
    if (PAD.st.pwr) { setPower((P.pwr + PAD.st.pwr) % 4); PAD.st.pwr = 0; }
  } else {
    const dz = v => (Math.abs(v) < 0.05 ? 0 : (v - Math.sign(v) * 0.05) / 0.95);
    yaw = dz(IN.mx); pitch = -dz(IN.my); fireOn = IN.fire || KEY.KeyJ; boostOn = KEY.ShiftLeft || KEY.ShiftRight || KEY.Space; msl = IN.msl; IN.msl = 0;
    if (KEY.ArrowLeft) yaw = -1; if (KEY.ArrowRight) yaw = 1; if (KEY.ArrowUp) pitch = -1; if (KEY.ArrowDown) pitch = 1;
    roll = (KEY.KeyA || KEY.KeyQ ? 1 : 0) - (KEY.KeyD || KEY.KeyE ? 1 : 0); thr = (KEY.KeyW ? 1 : 0) - (KEY.KeyS ? 1 : 0);
    if (locked) { IN.mx *= Math.exp(-dt * 0.9); IN.my *= Math.exp(-dt * 0.9); }
  }
  P.thr = clamp(P.thr + thr * dt * 0.8, 0, 1);
  // aim magnetism on phone: ease the nose toward the target under the reticle
  const fwd = fwdOf(P.q, v4);
  if ((TOUCH || botOn > 0) && P.target && P.target.alive) {
    v1.copy(P.target.pos).sub(P.pos); const d = v1.length(); v1.normalize(); const ang = Math.acos(clamp(fwd.dot(v1), -1, 1));
    if (ang < 0.12 && d < 700) { q1.copy(P.q).invert(); v1.applyQuaternion(q1); yaw += clamp(v1.x * 3, -0.25, 0.25); pitch += clamp(v1.y * 3, -0.25, 0.25); }
  }
  // boost
  const engPow = P.pwr === 1 ? 1.25 : 1;
  P.boosting = boostOn && P.boost > 0.02; if (P.boosting && !P.wasBoost) S.boost(); P.wasBoost = P.boosting;
  P.boost = clamp(P.boost + (P.boosting ? -0.33 : 0.13 * (P.pwr === 1 ? 2 : 1)) * dt, 0, 1);
  // rotation: rates, bank-to-turn + gentle auto-level
  const tr = (P.boosting ? 0.75 : 1) * (P.pwr === 1 ? 1.1 : 1);
  const right = v1.set(1, 0, 0).applyQuaternion(P.q), wantRy = -yaw * 0.42;
  const levelRoll = roll !== 0 ? roll * 2.4 : -(right.y - wantRy) * 2.6;
  P.w.x = lerp(P.w.x, pitch * 1.45 * tr, 1 - Math.exp(-dt * 7)); P.w.y = lerp(P.w.y, -yaw * 1.2 * tr, 1 - Math.exp(-dt * 7)); P.w.z = lerp(P.w.z, levelRoll, 1 - Math.exp(-dt * 6));
  q1.setFromEuler(e1.set(P.w.x * dt, P.w.y * dt, P.w.z * dt)); P.q.multiply(q1).normalize();
  // translation
  fwdOf(P.q, fwd); const sp = P.boosting ? 175 * engPow : (38 + P.thr * 66) * (P.pwr === 3 ? 0.92 : P.pwr === 1 ? 1.15 : 1);
  P.vel.lerp(v2.copy(fwd).multiplyScalar(sp), 1 - Math.exp(-dt * 2.4)); P.pos.addScaledVector(P.vel, dt);
  // collisions: rocks and capital hulls
  for (const r of AST.rocks) { const rr = r.r * 0.9 + P.r; if (Math.abs(r.p.x - P.pos.x) > rr || Math.abs(r.p.z - P.pos.z) > rr) continue; if (r.p.distanceToSquared(P.pos) < rr * rr) collide(r.p, rr); }
  for (const e of ents) if (e.capital && e.alive !== undefined && e.hull && e.pos.distanceToSquared(P.pos) < (e.r + 40) ** 2) for (const h of e.hull) { const rr = h.r + P.r; if (h.p.distanceToSquared(P.pos) < rr * rr) collide(h.p, rr); }
  // shields + heat
  P.shCd -= dt; if (P.shCd <= 0 && P.shield < 100) P.shield = Math.min(100, P.shield + dt * 9 * (P.pwr === 3 ? 2.5 : P.pwr === 2 ? 0.6 : 1));
  P.heat = Math.max(0, P.heat - dt * (P.over > 0 ? 45 : 32)); if (P.over > 0) P.over -= dt;
  // guns: alternating left/right, aim assist bends bolts toward the lead point
  P.fireCd -= dt;
  if (fireOn && P.fireCd <= 0 && P.over <= 0 && state === 'play') {
    P.fireCd = 1 / (P.pwr === 2 ? 12 : 8.5); P.side = -P.side; const i = P.side > 0 ? 1 : 0;
    const mz = v2.copy(MUZ[i]); mz.x *= COCK.group.userData.portrait ? 0.62 : 1; mz.y += COCK.group.userData.gunY || 0; mz.applyQuaternion(P.q).add(P.pos);
    const dir = v3.copy(fwd);
    if (P.target && P.target.alive) {
      const lp = leadPoint(P.pos, P.target, 560, v1); const want = lp.sub(mz).normalize(); const ang = Math.acos(clamp(dir.dot(want), -1, 1));
      if (ang < (TOUCH || botOn > 0 ? 0.11 : 0.05)) dir.copy(want);
    }
    dir.x += (Math.random() - 0.5) * 0.006; dir.y += (Math.random() - 0.5) * 0.006;
    pBolts.fire(mz, dir, 560 + sp * 0.5, 10, 1.3, P);
    S.laser(P.side, P.heat / 100); COCK.flashes[i].scale.setScalar(0.5); COCK.flashes[i].material.rotation = Math.random() * 3;
    blasts.light(mz, 60, CF.setRGB(0.4, 0.9, 1), 0.06);
    P.heat += P.pwr === 2 ? 4.2 : P.pwr === 1 ? 7 : 5.6; if (P.heat >= 100) { P.over = 1.6; S.overheat(); H.big('OVERHEAT', '', 1.0, true); }
    shake = Math.min(1, shake + 0.03);
  }
  // targeting + missile lock
  P.tgtT -= dt;
  if (P.tgtT <= 0) { P.tgtT = 0.3; pickTarget(fwd); }
  const T = P.target;
  if (T && T.alive && !T.invuln) {
    v1.copy(T.pos).sub(P.pos); const d = v1.length(), ang = Math.acos(clamp(fwd.dot(v1.normalize()), -1, 1));
    if (ang < 0.26 && d < 900) { const was = P.lockT; P.lockT += dt * (P.pwr === 2 ? 1.5 : 1); if (P.lockT >= 1.1 && was < 1.1) { S.lock(2); P.locked = T; } else if (P.lockT < 1.1 && Math.floor(P.lockT * 7) !== Math.floor(was * 7)) S.lock(1); }
    else { P.lockT = Math.max(0, P.lockT - dt * 2); if (P.lockT < 1.1) P.locked = null; }
  } else { P.lockT = 0; P.locked = null; }
  P.mslCd -= dt;
  if (msl && P.mslCd <= 0) {
    if (P.missiles > 0) { P.missiles--; P.mslCd = 0.5; fireMissile(P.locked && P.locked.alive ? P.locked : null, fwd); }
    else H.big('NO MISSILES', '', 0.8, true);
  }
}
function collide(c, rr) {
  v1.copy(P.pos).sub(c); const d = v1.length() || 1; v1.divideScalar(d); P.pos.copy(c).addScaledVector(v1, rr + 0.1);
  const vn = P.vel.dot(v1); if (vn < 0) { P.vel.addScaledVector(v1, -vn * 1.6); hurt(Math.min(35, 6 + -vn * 0.22), P.pos); sparks(v2.copy(P.pos).addScaledVector(v1, -P.r), 14, [4, 3, 2]); }
}
function pickTarget(fwd) {
  let best = null, bs = 1e9;
  const cur = P.target && P.target.alive ? P.target : null;
  for (const e of ents) {
    if (!e.alive || e.team !== 1 || (e.capital && e.kind === 'dread')) continue;
    if (e.sub && e.invuln && !e.req) continue;
    v1.copy(e.pos).sub(P.pos); const d = v1.length(); if (d > 2400) continue;
    const ang = Math.acos(clamp(fwd.dot(v1.normalize()), -1, 1));
    let s = ang * 3 + d / 900 + (e.invuln ? 2 : 0) - (e.req ? 0.2 : 0) - (e.torp ? 0.4 : 0);
    if (e === cur) s -= 0.5;
    if (s < bs) { bs = s; best = e; }
  }
  if (best !== P.target) { P.target = best; if (P.locked !== best) { P.lockT = 0; P.locked = null; } }
}
function fireMissile(T, fwd) {
  const obj = getObj('missile', () => MD.meshFrom(GE.missile, MATS)); obj.scale.setScalar(1.3);
  obj.position.copy(P.pos).addScaledVector(v1.set(0, -1.4, 0).applyQuaternion(P.q), 1).addScaledVector(fwd, 3); obj.quaternion.copy(P.q).multiply(q1.setFromAxisAngle(YP, Math.PI));
  missiles.push({ kind: 'missile', obj, pos: obj.position, vel: v2.copy(fwd).multiplyScalar(P.vel.length() + 30).add(v3.set(0, -6, 0).applyQuaternion(P.q)).clone(), T, life: 6, sp: P.vel.length() + 30 });
  S.missile(); shake = Math.min(1, shake + 0.15);
}
function updateMissiles(dt) {
  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i]; m.life -= dt; m.sp = Math.min(290, m.sp + 160 * dt);
    const dir = v1.copy(m.vel).normalize();
    if (m.T && m.T.alive && m.life < 5.8) { const want = leadPoint(m.pos, m.T, m.sp, v2).sub(m.pos).normalize(); const a = Math.acos(clamp(dir.dot(want), -1, 1)); if (a > 0.001) dir.lerp(want, Math.min(1, 3.2 * dt / a)).normalize(); }
    m.vel.copy(dir).multiplyScalar(m.sp); m.pos.addScaledVector(m.vel, dt);
    m.obj.quaternion.setFromUnitVectors(ZP, dir);
    smoke.spawn(m.pos.x, m.pos.y, m.pos.z, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, 1.3, 0.8, 4.5, 0.85, 0.8, 1, 0.55, 0.4);
    fire.spawn(m.pos.x - dir.x * 1.6, m.pos.y - dir.y * 1.6, m.pos.z - dir.z * 1.6, 0, 0, 0, 0.12, 2.6, 0.8, 4, 2.4, 0.8, 1, 0);
    let hit = null;
    for (const e of ents) { if (!e.alive || e.team !== 1) continue; if (e.capital) { if (m.pos.distanceToSquared(e.pos) > (e.r + 10) ** 2) continue; for (const s of e.subs) if (s.alive && m.pos.distanceTo(s.pos) < s.r + 4) { hit = s; break; } if (!hit) for (const h of e.hull) if (m.pos.distanceTo(h.p) < h.r + 2) { hit = e; break; } if (hit) break; } else if (m.pos.distanceTo(e.pos) < e.r + 4) { hit = e; break; } }
    if (!hit) for (const r of AST.rocks) if (Math.abs(r.p.x - m.pos.x) < r.r && r.p.distanceToSquared(m.pos) < r.r * r.r * 0.8) { hit = 'rock'; break; }
    if (hit || m.life <= 0) {
      boom(m.pos, hit && hit !== 'rock' ? 1.5 : 1);
      if (hit && hit !== 'rock') { if (hit.kind === 'frigate') damage(hit, 160, m.pos, P); else if (hit.capital) { sparks(m.pos, 8, [2, 3, 5]); } else damage(hit, 160, m.pos, P); }
      relObj('missile', m.obj); missiles.splice(i, 1);
    }
  }
}

// ---------------------------------------------------------------- AI
function pickFor(e) {
  if (e.team === 1) {
    if (e.goal === 'carrier' && carrier && carrier.alive) return carrier;
    const opts = ents.filter(x => x.alive && x.team === 0 && (x.fighter || x.kind === 'carrier'));
    if (state === 'play' && P.alive && (Math.random() < 0.62 || !opts.length)) return P;
    return opts.length ? opts[(Math.random() * opts.length) | 0] : null;
  }
  const foes = ents.filter(x => x.alive && x.team === 1 && (x.fighter || x.sub) && !x.invuln);
  let best = null, bd = 1e12; for (const f of foes) { const d = f.pos.distanceToSquared(e.pos) * (f.sub ? 2.5 : 1) * (0.6 + Math.random() * 0.8); if (d < bd) { bd = d; best = f; } }
  return best;
}
function avoid(e, want, look) {
  const fwd = v3.set(0, 0, 1).applyQuaternion(e.obj.quaternion);
  const test = (c, r) => { v1.copy(c).sub(e.pos); const along = v1.dot(fwd); if (along < 0 || along > look + r) return; v1.addScaledVector(fwd, -along); const lat = v1.length(); if (lat < r + 14) { if (lat < 0.01) v1.set(0, 1, 0); want.addScaledVector(v1.normalize(), -2.2 * (1 - lat / (r + 14))); } };
  for (const r of AST.rocks) { if (Math.abs(r.p.x - e.pos.x) > look + r.r || Math.abs(r.p.z - e.pos.z) > look + r.r) continue; test(r.p, r.r); }
  for (const c of ents) if (c.capital && c.alive && c !== e && c.pos.distanceToSquared(e.pos) < (c.r + look) ** 2) for (const h of c.hull) test(h.p, h.r);
}
function updateFighter(e, dt) {
  e.tt -= dt;
  if (e.torp) return updateTorp(e, dt);
  if (!e.target || !e.target.alive || e.tt <= 0 || (e.target === P && (!P.alive || state !== 'play'))) { e.target = pickFor(e); e.tt = 3 + Math.random() * 3; }
  const T = e.target, want = v4;
  const sp = e.kind === 'lance' ? 900 : 430;
  if (!T) { want.set(0, 0, 1).applyQuaternion(e.obj.quaternion); }
  else {
    const d = T.pos.distanceTo(e.pos);
    if (e.state === 'attack') {
      leadPoint(e.pos, T, sp, want).sub(e.pos).normalize();
      if (e.kind === 'hammer' && d < 340) { want.cross(YP).normalize().lerp(v1.copy(T.pos).sub(e.pos).normalize(), 0.35).normalize(); }
      else if (d < (T.capital ? T.r * 0.6 + 50 : 70)) { e.state = 'break'; e.stT = 1.4 + Math.random() * 1.6; e.brk.randomDirection().addScaledVector(v1.copy(e.pos).sub(T.pos).normalize(), 1.2).normalize(); }
    } else { want.copy(e.brk); e.stT -= dt; if (e.state === 'evade' && Math.random() < dt * 2) e.brk.randomDirection(); if (e.stT <= 0) e.state = 'attack'; }
    // shoot
    e.fireCd -= dt; const fwd = v3.set(0, 0, 1).applyQuaternion(e.obj.quaternion), aim = leadPoint(e.pos, T, sp, v2).sub(e.pos);
    const dist = aim.length(); aim.divideScalar(dist);
    if (e.kind === 'hammer') {
      if (e.fireCd <= 0 && dist < 520 && fwd.dot(v1.copy(T.pos).sub(e.pos).normalize()) > 0.2) { e.fireCd = 6.5 / F.k(score) + Math.random() * 2; torpedo(e, T); }
    } else if (e.state === 'attack' && dist < 520 && fwd.dot(aim) > 0.985 && e.fireCd <= 0 && (T !== P || state === 'play')) {
      const acc = e.team === 0 ? 0.02 : 0.034 / F.k(score);
      const dir = v1.copy(aim).add(v3.set((Math.random() - 0.5) * acc, (Math.random() - 0.5) * acc, (Math.random() - 0.5) * acc)).normalize();
      const mz = v2.copy(e.pos).addScaledVector(dir, e.r);
      if (e.team === 0) pBolts.fire(mz, dir, 540, 7, 1.3, e); else { eBolts.fire(mz, dir, 430, 5, 1.6, e); const cd = cam.position.distanceTo(e.pos); S.enemyLaser(1 / (1 + cd / 90)); }
      e.burst++; if (e.burst >= 3) { e.burst = 0; e.fireCd = (1.1 + Math.random() * 1.2) / F.k(score); } else e.fireCd = 0.13;
    }
  }
  avoid(e, want.normalize(), 120);
  m1.lookAt(v1.copy(e.pos).add(want), e.pos, YP); m1.lookAt(e.pos, v1, YP);
  q1.setFromRotationMatrix(m1.lookAt(v2.copy(e.pos).sub(want), e.pos, YP));
  const before = v2.set(0, 0, 1).applyQuaternion(e.obj.quaternion).clone();
  e.obj.quaternion.rotateTowards(q1, e.turn * dt);
  const after = v3.set(0, 0, 1).applyQuaternion(e.obj.quaternion);
  // bank into turns
  const turnSide = before.cross(after).dot(v1.set(0, 1, 0).applyQuaternion(e.obj.quaternion));
  e.bank = lerp(e.bank || 0, clamp(-turnSide * 60, -1, 1), 1 - Math.exp(-dt * 4)); e.obj.rotateZ(e.bank * dt * 0);
  const speed = e.speed * (e.state === 'break' ? 1.2 : 1);
  e.vel.lerp(after.multiplyScalar(speed), 1 - Math.exp(-dt * 1.8)); e.pos.addScaledVector(e.vel, dt);
  // engine trail
  if (Math.random() < 0.5) { const back = v1.set(0, 0, -1).applyQuaternion(e.obj.quaternion); const c = e.team === 0 ? [0.6, 2.2, 3] : e.kind === 'hammer' ? [3, 1.8, 0.5] : [3, 0.8, 2.2]; fire.spawn(e.pos.x + back.x * 5, e.pos.y + back.y * 5, e.pos.z + back.z * 5, back.x * 8, back.y * 8, back.z * 8, 0.35, 1.6, 0.4, c[0], c[1], c[2], 0.8, 0); }
}
function updateTorp(e, dt) {
  e.life -= dt; const T = e.target;
  const dir = v1.copy(e.vel).normalize();
  if (T && T.alive !== false) { const want = v2.copy(T.pos).sub(e.pos).normalize(); const a = Math.acos(clamp(dir.dot(want), -1, 1)); if (a > 0.001) dir.lerp(want, Math.min(1, e.turn * dt / a)).normalize(); }
  e.vel.copy(dir).multiplyScalar(Math.min(e.speed, e.vel.length() + 20 * dt)); e.pos.addScaledVector(e.vel, dt); e.obj.quaternion.setFromUnitVectors(ZP, dir);
  fire.spawn(e.pos.x - dir.x * 2, e.pos.y - dir.y * 2, e.pos.z - dir.z * 2, 0, 0, 0, 0.25, 3, 1, 4, 2.6, 0.5, 1, 0);
  smoke.spawn(e.pos.x, e.pos.y, e.pos.z, 0, 0, 0, 1, 1, 4, 0.9, 0.7, 0.9, 0.35, 0);
  let hitT = false;
  if (T === P) { if (P.alive && e.pos.distanceTo(P.pos) < 5) { hurt(28, e.pos); hitT = true; } }
  else if (T && T.capital) { for (const h of T.hull) if (e.pos.distanceTo(h.p) < h.r + 2) { hitT = true; T.hp -= 80; H.big('HALCYON HIT', `HULL ${Math.max(0, Math.round(T.hp / T.maxHp * 100))}%`, 1.2, true); if (T.hp <= 0 && T.alive) kill(T, null); break; } }
  else if (T && T.alive && e.pos.distanceTo(T.pos) < 5) { damage(T, 60, e.pos, null); hitT = true; }
  if (hitT || e.life <= 0) { e.alive = false; boom(e.pos, 1.6); relObj('torp', e.obj); }
}
function updateTurret(s, dt) {
  const ship = s.parent; if (!ship.alive) return;
  s.fireCd -= dt;
  let T = null; const range = s.kind === 'bigturret' ? 820 : 640;
  if (state === 'play' && P.alive && P.pos.distanceTo(s.pos) < range) T = P;
  else { let bd = range * range; for (const e of ents) if (e.alive && e.team === 0 && e.fighter) { const d = e.pos.distanceToSquared(s.pos); if (d < bd) { bd = d; T = e; } } }
  if (!T) return;
  const sp = s.kind === 'bigturret' ? 300 : 360, aim = leadPoint(s.pos, T, sp, v1);
  const up = v2.copy(s.tur.up).transformDirection(ship.obj.matrixWorld), dir = v3.copy(aim).sub(s.pos).normalize();
  if (dir.dot(up) < -0.05) return;
  s.obj.lookAt(aim);
  if (s.fireCd <= 0) {
    const acc = (s.kind === 'bigturret' ? 0.03 : 0.04) / F.k(score);
    dir.x += (Math.random() - 0.5) * acc; dir.y += (Math.random() - 0.5) * acc; dir.z += (Math.random() - 0.5) * acc; dir.normalize();
    const mz = v4.copy(s.pos).addScaledVector(dir, s.kind === 'bigturret' ? 10 : 6);
    eBolts.fire(mz, dir, sp, s.kind === 'bigturret' ? 8 : 6, 2.6, s, s.kind === 'bigturret' ? 2.6 : 1.7);
    fire.spawn(mz.x, mz.y, mz.z, 0, 0, 0, 0.1, s.kind === 'bigturret' ? 9 : 5, 2, 4, 1, 2.6, 1, 0);
    S.enemyLaser(1.4 / (1 + mz.distanceTo(cam.position) / 120));
    s.burst++; if (s.burst >= 4) { s.burst = 0; s.fireCd = (2.2 + Math.random() * 1.5) / F.k(score); } else s.fireCd = 0.14;
  }
}
function updateCapital(e, dt) {
  if (e.dying !== undefined) { capitalDeath(e, dt); return; }
  // slow cruise; the dreadnought stops when both engine banks are gone
  let sp = e.speed; if (e.kind === 'dread') { const engAlive = e.subs.some(s => s.kind === 'eng' && s.alive); if (!engAlive) sp = 0; }
  if (e.kind === 'carrier') sp = 3;
  e.vel.set(0, 0, sp).applyQuaternion(e.obj.quaternion); e.pos.addScaledVector(e.vel, dt);
  e.obj.updateMatrixWorld(true);
  for (const h of e.hull) h.p.copy(h.l).applyMatrix4(e.obj.matrixWorld);
  for (const s of e.subs) { s.obj.getWorldPosition(s.pos); if (s.alive && s.tur) updateTurret(s, dt); }
  for (const p of e.plumes) p.scale.z = 0.85 + Math.random() * 0.3;
  if (e.kind === 'dread') {
    const gensAlive = e.subs.some(s => s.kind === 'gen' && s.alive), engAlive = e.subs.some(s => s.kind === 'eng' && s.alive);
    for (const s of e.subs) { if (s.kind === 'eng') s.invuln = gensAlive; if (s.kind === 'core') s.invuln = gensAlive || engAlive; }
    const U = e.obj.userData, open = !gensAlive && !engAlive;
    U.shells.forEach((sh, i) => { const tx = open ? (i ? -24 : 24) : 0; sh.position.x = lerp(sh.position.x, tx, 1 - Math.exp(-dt * 1.2)); });
    U.core.rotation.y += dt * 0.8; U.gens.forEach(g => g.children.forEach(c => { if (c.material === MATS.shieldGen) c.scale.setScalar(1 + Math.sin(performance.now() / 300) * 0.03); }));
    e.launchT -= dt;
    if (e.launchT <= 0 && state === 'play') { e.launchT = 24; if (ents.filter(x => x.alive && x.kind === 'wisp').length < 9) { for (const s of [-1, 1]) { const f = fighter('wisp', v1.set(s * 76, -4, 30).applyMatrix4(e.obj.matrixWorld), 1, false); f.obj.quaternion.copy(e.obj.quaternion); } say('VESNA', 'It is launching drones from the wing hangars!'); } }
  }
  if (e.kind === 'carrier' && state === 'play') {     // point defence: slow blue bolts at nearby enemies
    e.pdT -= dt; if (e.pdT <= 0) { e.pdT = 0.35; let T = null, bd = 450 * 450; for (const x of ents) if (x.alive && x.team === 1 && x.fighter) { const d = x.pos.distanceToSquared(e.pos); if (d < bd) { bd = d; T = x; } }
      if (T) { const h = e.hull[(Math.random() * e.hull.length) | 0]; const mz = v2.copy(h.p).addScaledVector(v3.copy(T.pos).sub(h.p).normalize(), h.r + 2); const dir = leadPoint(mz, T, 420, v1).sub(mz).normalize(); dir.x += (Math.random() - 0.5) * 0.06; dir.y += (Math.random() - 0.5) * 0.06; pBolts.fire(mz, dir.normalize(), 420, 6, 1.4, e); } }
  }
  if (e.kind === 'frigate' && e.hp < e.maxHp * 0.5 && Math.random() < dt * 4) { const h = e.hull[(Math.random() * e.hull.length) | 0]; v1.randomDirection().multiplyScalar(h.r * 0.8).add(h.p); fire.spawn(v1.x, v1.y, v1.z, 0, 2, 0, 0.6, 3, 8, 4, 1.8, 0.6, 0.9, 0, 2); smoke.spawn(v1.x, v1.y, v1.z, 0, 4, 0, 2, 4, 14, 0.4, 0.35, 0.55, 0.5, 0); }
}
function capitalDeath(e, dt) {
  e.dying += dt; const dur = e.kind === 'dread' ? 4.5 : 2.4;
  e.pos.addScaledVector(e.vel, dt * 0.5); e.obj.rotateZ(dt * 0.08); e.obj.updateMatrixWorld(true); for (const h of e.hull) h.p.copy(h.l).applyMatrix4(e.obj.matrixWorld);
  if (e.dying - e.dyingP > (e.kind === 'dread' ? 0.22 : 0.3)) { e.dyingP = e.dying; const h = e.hull[(Math.random() * e.hull.length) | 0]; boom(v1.randomDirection().multiplyScalar(h.r * 0.7).add(h.p), e.kind === 'dread' ? 3.4 : 2.2); }
  if (e.dying >= dur && !e.gone) {
    e.gone = true; const big = e.kind === 'dread' ? 9 : 5; boom(e.pos, big); for (let i = 0; i < 6; i++) boom(v1.randomDirection().multiplyScalar(e.r * 0.4).add(e.pos), big * 0.5);
    blasts.ring(e.pos, big * 60, CR.setRGB(1.5, 3, 4), 1.8, null); H.dmg(0); shake = 1.5; buzz([60, 40, 120]);
    for (const b of burners) if (b.obj.parent && isChildOf(b.obj, e.obj)) b.dead = true;
    relObj(e.kind, e.obj); if (e.kind === 'frigate' && e.subs) for (const s of e.subs) s.alive = false;
    if (e.kind === 'dread') { for (const s of e.subs) s.alive = false; for (const x of ents) if (x.alive && x.team === 1 && x.fighter) kill(x, null); }
  }
}
const isChildOf = (o, p) => { while (o) { if (o === p) return true; o = o.parent; } return false; };

// ---------------------------------------------------------------- bot: aims at the best target, fires, locks missiles, avoids rocks
let botLast = 0;
function botInput(dt) {
  const out = { pitch: 0, yaw: 0, fire: false, boost: false, msl: 0 };
  if (!P.alive) return out;
  const T = P.target && P.target.alive ? P.target : null;
  const fwd = fwdOf(P.q, v4.clone());
  const want = new V3();
  if (T) leadPoint(P.pos, T, 560, want).sub(P.pos); else want.set(0, 0, -400).sub(P.pos);
  const dist = want.length(); want.normalize();
  if (T && dist < (T.capital || T.sub ? 90 : 45)) want.multiplyScalar(-1).add(v1.set(0, 1, 0)).normalize();
  for (const r of AST.rocks) { v1.copy(r.p).sub(P.pos); const al = v1.dot(fwd); if (al < 0 || al > 140) continue; v1.addScaledVector(fwd, -al); const lat = v1.length(); if (lat < r.r + 12) want.addScaledVector(v1.normalize(), -1.5); }
  const loc = want.applyQuaternion(q1.copy(P.q).invert());
  out.yaw = clamp(loc.x * 4, -1, 1); out.pitch = clamp(loc.y * 4, -1, 1);
  if (loc.z > 0) { out.yaw = loc.x >= 0 ? 1 : -1; out.pitch = 0.4; }
  if (T) { const ang = Math.acos(clamp(fwd.dot(v1.copy(T.pos).sub(P.pos).normalize()), -1, 1)); out.fire = ang < 0.14 && dist < 650 && P.heat < 92; out.boost = dist > 600 && P.boost > 0.4; }
  if (P.locked && P.missiles > 0 && (P.locked.capital || P.locked.sub || P.locked.kind === 'hammer') && performance.now() - botLast > 1500) { out.msl = 1; botLast = performance.now(); }
  return out;
}

// ---------------------------------------------------------------- HUD per frame
const proj = new V3(); let radarT = 0, scrT = 0;
function toScreen(p, out) { proj.copy(p).project(cam); out.x = (proj.x * 0.5 + 0.5) * innerWidth; out.y = (-proj.y * 0.5 + 0.5) * innerHeight; out.z = proj.z; out.on = proj.z < 1 && Math.abs(proj.x) < 1 && Math.abs(proj.y) < 1; return out; }
const SC = { x: 0, y: 0, z: 0, on: false };
function updateHUD(dt) {
  H.tick(dt);
  if (state !== 'play') return;
  const sp = P.vel.length();
  H.reticle(P.shield / 100, P.hull / 100, P.heat / 100, P.boost, P.over > 0);
  H.speed(`${Math.round(sp * 3.6)} M/S · ${PWR[P.pwr]}${P.over > 0 ? ' · OVERHEAT' : ''}`);
  // objective
  if (mode === 'campaign') {
    const M = MISSIONS[mIdx], ph = M.phases[Math.max(0, phase - 1)], req = ents.filter(reqOn), done = req.filter(e => !e.alive).length;
    H.objective(`MISSION ${mIdx + 1} · ${M.name.toUpperCase()}${carrier ? ` · HALCYON ${Math.max(0, Math.round(carrier.hp / carrier.maxHp * 100))}%` : ''}`, `${ph.obj}${req.length ? ` ${done}/${req.length}` : ''}`, req.length ? done / req.length : 0);
  } else { const left = ents.filter(e => e.alive && e.team === 1 && (e.fighter || e.capital) && !e.torp).length; H.objective(`GAUNTLET · WAVE ${wave}`, `Hostiles remaining: ${left}`, 0); }
  H.score(score, chain);
  // target boxes
  const list = [], arr = [];
  for (const e of ents) {
    if (!e.alive || e.capital || e === P) continue;
    if (e.sub && e.invuln && e !== P.target) continue;
    const d = e.pos.distanceTo(P.pos); if (d > 2200) continue;
    toScreen(e.pos, SC); const cur = e === P.target;
    if (SC.on) list.push({ x: SC.x, y: SC.y, kind: e.team === 0 ? 'fr' : e.sub ? 'sub' : 'foe', cur, label: cur ? `${NAMES[e.kind]} · ${Math.round(d)}m` : e.sub && e.req ? NAMES[e.kind] : '', hp: cur || e.sub ? e.hp / e.maxHp : null, size: cur ? 0 : clamp(1400 / d, 16, 40) });
    else if ((cur || (e.req && e.sub)) && arr.length < 4) {
      proj.copy(e.pos).applyMatrix4(cam.matrixWorldInverse); const a = Math.atan2(proj.x, proj.y); const rx = innerWidth / 2 - 30, ry = innerHeight / 2 - 60, k = Math.min(rx / Math.abs(Math.sin(a) || 1e-3), ry / Math.abs(Math.cos(a) || 1e-3));
      arr.push({ x: innerWidth / 2 + Math.sin(a) * k, y: innerHeight / 2 - Math.cos(a) * k, a, kind: e.sub ? 'sub' : '' });
    }
    if (list.length > 26) break;
  }
  H.targets(list); H.arrows(arr);
  const T = P.target;
  if (T && T.alive) {
    toScreen(leadPoint(P.pos, T, 560, v1), SC); H.lead(SC.x, SC.y, SC.on && T.pos.distanceTo(P.pos) < 800);
    toScreen(T.pos, SC); H.lock(SC.x, SC.y, SC.on && P.lockT > 0.05 && P.missiles > 0 ? (P.locked ? 2 : 1) : 0, Math.min(1, P.lockT / 1.1));
  } else { H.lead(0, 0, false); H.lock(0, 0, 0); }
  H.cursor(innerWidth / 2 + IN.mx * Math.min(innerWidth, innerHeight) * 0.38, innerHeight / 2 + IN.my * Math.min(innerWidth, innerHeight) * 0.38, !TOUCH && locked);
  PAD.setMsl(P.missiles, !!P.locked); PAD.setPwr(PWR[P.pwr]);
  // damage overlays fade
  const low = P.hull < 30;
  H.dmg(Math.max(0, (parseFloat(document.querySelector('.dmg').style.opacity) || 0) - dt * 1.4) + (low ? 0.18 + Math.sin(performance.now() / 200) * 0.08 : 0));
  H.shd(Math.max(0, (parseFloat(document.querySelector('.shd').style.opacity) || 0) - dt * 2.2));
  if (low && P.alive) { lowT -= dt; if (lowT <= 0) { lowT = 1.2; S.warn(); } }
  // radar (10 Hz)
  radarT -= dt; if (radarT <= 0) { radarT = 0.1; drawRadar(); }
  scrT -= dt; if (scrT <= 0) { scrT = 0.2; drawScreens(); }
}
function drawRadar() {
  const c = H.radarCtx, W = 200, Rr = 92, range = 1300; c.clearRect(0, 0, W, W);
  c.fillStyle = 'rgba(20,10,60,.55)'; c.beginPath(); c.arc(100, 100, Rr, 0, 7); c.fill();
  c.strokeStyle = 'rgba(127,240,255,.5)'; c.lineWidth = 2; c.stroke(); c.lineWidth = 1; c.strokeStyle = 'rgba(127,240,255,.22)';
  c.beginPath(); c.arc(100, 100, Rr / 2, 0, 7); c.moveTo(100, 8); c.lineTo(100, 192); c.moveTo(8, 100); c.lineTo(192, 100); c.stroke();
  c.fillStyle = 'rgba(127,240,255,.15)'; c.beginPath(); c.moveTo(100, 100); c.arc(100, 100, Rr, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5); c.fill();
  q1.copy(P.q).invert();
  for (const e of ents) {
    if (!e.alive || (e.sub && !e.req)) continue;
    v1.copy(e.pos).sub(P.pos).applyQuaternion(q1); let x = v1.x / range, y = v1.z / range; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    const px = 100 + x * Rr, py = 100 + y * Rr;
    c.fillStyle = e.team === 0 ? '#7ff0ff' : e.sub ? '#ffcf3a' : e.torp ? '#ffe36a' : '#ff5fa8';
    const s = e.capital ? 7 : e.sub ? 4 : 3;
    if (e.capital) c.fillRect(px - s, py - s * 0.6, s * 2, s * 1.2); else { c.beginPath(); c.arc(px, py, s, 0, 7); c.fill(); }
    if (!e.capital) { c.fillRect(px - 0.5, py, 1, clamp(-v1.y / range * Rr, -14, 14)); }
  }
  c.fillStyle = '#fff'; c.beginPath(); c.moveTo(100, 94); c.lineTo(105, 104); c.lineTo(95, 104); c.fill();
}
function drawScreens() {
  const L = COCK.scrL, Rr = COCK.scrR;
  let x = L.x, w = L.c.width, h = L.c.height; x.fillStyle = '#0b1a3a'; x.fillRect(0, 0, w, h);
  x.font = 'bold 18px "Baloo 2", sans-serif'; x.fillStyle = '#7ff0ff'; x.fillText('POWER', 10, 22);
  ['ENG', 'WPN', 'SHD'].forEach((n, i) => { const lv = P.pwr === 0 ? 0.66 : P.pwr === i + 1 ? 1 : 0.4; x.fillStyle = 'rgba(127,240,255,.2)'; x.fillRect(16 + i * 80, 40, 50, 80); x.fillStyle = P.pwr === i + 1 ? '#ffcf3a' : '#7ff0ff'; x.fillRect(16 + i * 80, 40 + 80 * (1 - lv), 50, 80 * lv); x.fillText(n, 22 + i * 80, 140); });
  L.t.needsUpdate = true;
  x = Rr.x; w = Rr.c.width; h = Rr.c.height; x.fillStyle = '#0b1a3a'; x.fillRect(0, 0, w, h); x.font = 'bold 18px "Baloo 2", sans-serif';
  const T = P.target;
  if (T && T.alive) { x.fillStyle = '#ff6fb5'; x.fillText(NAMES[T.kind], 10, 24); x.fillStyle = 'rgba(255,111,181,.25)'; x.fillRect(10, 36, 230, 14); x.fillStyle = '#ff6fb5'; x.fillRect(10, 36, 230 * Math.max(0, T.hp / T.maxHp), 14); x.fillStyle = '#7ff0ff'; x.fillText(`${Math.round(T.pos.distanceTo(P.pos))} m`, 10, 76); x.fillText(P.locked ? 'MISSILE LOCK' : 'TRACKING', 10, 100); }
  else { x.fillStyle = '#7ff0ff'; x.fillText('NO TARGET', 10, 24); }
  x.fillStyle = '#ffcf3a'; x.fillText(`MSL ×${P.missiles}`, 10, 136); Rr.t.needsUpdate = true;
}

// ---------------------------------------------------------------- frame
let last = performance.now(), fovBase = 70;
function resize() {
  R.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight;
  fovBase = cam.aspect >= 1.3 ? 66 : Math.min(100, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(32)) / cam.aspect)));
  cam.fov = fovBase; cam.updateProjectionMatrix(); C.resize(innerWidth, innerHeight); COCK.fit(cam);
  const sc = innerHeight * R.getPixelRatio() / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))); fire.mat.uniforms.uScale.value = smoke.mat.uniforms.uScale.value = sc;
}
addEventListener('resize', resize); resize();

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  botOn = Math.max(0, botOn - dt);
  if (state === 'play') {
    runT += dt;
    if (endT < 0) {
      if (phaseWait > 0) { phaseWait -= dt; if (phaseWait <= 0) nextPhase(); }
      else if (phaseDone()) { if (mode === 'campaign' && phase >= MISSIONS[mIdx].phases.length) finish(true); else phaseWait = mode === 'gauntlet' ? 3.0 : 1.6; }
    } else { endT += dt; if (endT > (endWin ? 3.2 : 2.6)) endRun(); }
    chainT -= dt; if (chainT <= 0) chain = 1;
  }
  if (state === 'play' || state === 'won' || state === 'lost') updatePlayer(state === 'play' ? dt : dt * 0.3);
  for (const e of ents) { if (e.capital && (e.alive || (e.dying !== undefined && !e.gone))) updateCapital(e, dt); }
  for (const e of ents) if (e.alive && e.fighter) { updateFighter(e, dt); for (const p of e.plumes) p.scale.z = 0.8 + Math.random() * 0.4; }
  if (ents.length > 80) ents = ents.filter(e => e.alive || (e.capital && !e.gone) || e.sub && e.parent && !e.parent.gone);
  updateMissiles(dt);
  pBolts.update(dt, b => boltVsWorld(b) || hitTeam(b, 1));
  eBolts.update(dt, b => boltVsWorld(b) || hitPlayer(b) || hitTeam(b, 0));
  for (const b of burners) { if (b.dead || !b.obj.parent) continue; b.obj.localToWorld(v1.copy(b.off)); if (Math.random() < 0.6) fire.spawn(v1.x, v1.y, v1.z, (Math.random() - 0.5) * 4, 3 + Math.random() * 4, (Math.random() - 0.5) * 4, 0.6, b.s * 2.5, b.s * 4, 4, 1.7, 0.5, 0.9, 0, 2); if (Math.random() < 0.3) smoke.spawn(v1.x, v1.y, v1.z, 0, 6, 0, 2.4, b.s * 3, b.s * 12, 0.38, 0.32, 0.55, 0.45, 0); }
  AST.update(dt); fire.update(dt); smoke.update(dt); debris.update(dt, fire, smoke); blasts.update(dt);
  // camera
  if (state === 'ready') attractCam(dt);
  else {
    cam.position.copy(P.pos); cam.quaternion.copy(P.q);
    shake = Math.max(0, shake - dt * 1.6); const s2 = shake * shake;
    if (s2 > 0.0001) { cam.position.add(v1.set((Math.random() - 0.5), (Math.random() - 0.5), 0).multiplyScalar(s2 * 0.9).applyQuaternion(P.q)); q1.setFromEuler(e1.set((Math.random() - 0.5) * s2 * 0.05, (Math.random() - 0.5) * s2 * 0.05, (Math.random() - 0.5) * s2 * 0.06)); cam.quaternion.multiply(q1); }
    COCK.group.position.set(-P.w.y * 0.012, -P.w.x * 0.012 - (P.boosting ? 0.02 : 0), P.boosting ? 0.03 : 0); COCK.group.rotation.z = -P.w.z * 0.015;
    const fv = fovBase + (P.boosting ? 9 : 0); if (Math.abs(cam.fov - fv) > 0.05) { cam.fov = lerp(cam.fov, fv, 1 - Math.exp(-dt * 5)); cam.updateProjectionMatrix(); }
    for (const f of COCK.flashes) f.scale.multiplyScalar(Math.exp(-dt * 28));
    if (state === 'play') { setEngine(P.vel.length() / 120, P.boosting ? 1 : 0); let near = 0; for (const e of ents) if (e.alive && e.team === 1 && e.pos.distanceTo(P.pos) < 700) near++; setMusic(near ? 1 : 0.3, dread && dread.alive ? 1 : 0); }
  }
  skyG.position.copy(cam.position);
  dust.update(cam.position, state === 'ready' ? v1.set(0, 0, 0) : P.vel, P.boosting ? 1 : 0);
  updateHUD(dt);
  C.render(dt);
}
let attractPh = 0;
function attractCam(dt) {
  menuT += dt; const t = menuT * 0.06, port = cam.aspect < 0.8;
  const F = v2.set(60, 10, -260);
  cam.position.set(F.x + 30 + Math.sin(t) * 40, F.y + 18 + Math.sin(t * 0.7) * 8, F.z + (port ? 230 : 190) + Math.cos(t) * 15);
  cam.lookAt(F.x - (port ? 0 : 30), F.y - (port ? 34 : 8), F.z);
  const fv = port ? 62 : 52; if (Math.abs(cam.fov - fv) > 0.1) { cam.fov = fv; cam.updateProjectionMatrix(); }
  // keep the skirmish alive
  if (ents.filter(e => e.alive && e.kind === 'wisp').length < 4) fighter('wisp', v1.set(-200 + Math.random() * 300, Math.random() * 80, -380), 1);
  if (ents.filter(e => e.alive && e.kind === 'lance').length < 2) fighter('lance', v1.set(-100, -10, 0), 0);
}

setupAttract();
requestAnimationFrame(frame);
if (D.seed) { sel = 'g'; renderMenu(); }

window.__game = {
  get state() { return state; }, get level() { return mode === 'gauntlet' ? wave : mIdx + 1; }, get score() { return score; },
  bot() { botOn = 0.6; },
  get debug() { return { ents: ents.length, alive: ents.filter(e => e.alive).length, phase, hull: P.hull, shield: P.shield, mode, calls: R.info.render.calls, tris: R.info.render.triangles }; },
};
window.__vl = { R, COCK, scene, cam, P, MATS, launch: w => { ui.els.start.classList.add("hc-hidden"); launch(w); }, ents: () => ents };
