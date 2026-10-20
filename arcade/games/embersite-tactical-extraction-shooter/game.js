// EMBERSITE: Tactical Extraction Shooter. Drop into Halvard Valley, scout WARDEN robot patrols, loot crates,
// complete a contract and reach the KITE-6 helicopter before the window closes. All models, sounds and music are code.
import { THREE, cine } from './kit/cine.js';
import { createUI, store } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { createWorld, LZS, SPAWNS, BASE, RELAY, PYLONS, DAM_X, DAM_Z, CREST, BOUND, mulberry, riverX } from './world.js';
import { gunRifle, gunCarbine, gunSMG, crate, charge, powerCell, heli, RARITY } from './models.js';
import { createFX } from './fx.js';
import { createAudio } from './audio.js';
import { createEnemies } from './enemies.js';
import { createHUD } from './hud.js';
const V3 = THREE.Vector3, clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t;

// ------------------------------------------------------------------ renderer + world
const Q = new URLSearchParams(location.search);
const TOUCH = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
const LITE = Q.has('lite') || (Math.min(screen.width, screen.height) < 500 && devicePixelRatio > 2.5);
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight); renderer.domElement.className = 'hc-canvas'; document.body.prepend(renderer.domElement);
const scene = new THREE.Scene(); renderer.info.autoReset = false;
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, .05, 2600); scene.add(camera);
const world = createWorld(scene, renderer, { lite: LITE });
const C = cine(renderer, scene, camera, { lite: LITE, bloom: .32, bloomThreshold: .9, bloomRadius: .5, exposure: 1.08, fog: scene.fog, grade: { sat: 1.16, contrast: 1.05, vignette: .14, grain: 0, tint: '#fffaf2' } });
const fx = createFX(scene, camera, world, renderer, { lite: LITE });
const audio = createAudio();
const S = store('embersite');
const ui = createUI({ title: 'EMBERSITE', progress: false, score: false });
ui.els.start.classList.add('hc-hidden');
const D = daily('embersite', ui, { name: 'Embersite: Tactical Extraction Shooter' });
const F = flow('embersite');
const B = board({ game: 'embersite', label: 'Contract score', limits: { maxRun: 30000, maxPerSec: 150 }, mode: 'best', corner: 'tl' });
const shareBtn = ui.els.win.querySelector('.hc-btn'); if (shareBtn) shareBtn.style.display = 'none';

// ------------------------------------------------------------------ shared game context
const G = { scene, camera, world, fx, audio, touch: TOUCH, state: 'ready', time: 0, k: 1, ads: 0, spreadPx: 0, scoped: false, binoc: false };
const P = G.player = {
  p: new V3(), vel: new V3(), yaw: 0, pitch: 0, onGround: true, crouch: false, sprint: false, alive: true, hp: 100, armor: 50, loudT: -99, eyeH: 1.62, hurtT: -99, stepD: 0,
  chest(out = new V3()) { return out.set(this.p.x, this.p.y + (this.crouch ? .8 : 1.25), this.p.z); },
  eye(out = new V3()) { return out.set(this.p.x, this.p.y + this.eyeH, this.p.z); },
};
const enemies = G.enemies = createEnemies(G);
const hud = createHUD(G);
G.coverNear = (x, z, r) => { const out = world.cover.filter(c => Math.abs(c.x - x) < r && Math.abs(c.z - z) < r); const seen = new Set(); for (const cell of world.near(x, z, r)) for (const t of cell.t) if (!seen.has(t)) { seen.add(t); out.push({ x: t.x, z: t.z, r: t.r + .3 }); } return out; };

// ------------------------------------------------------------------ weapons
const WEAP = {
  rifle: { key: 'rifle', name: 'M7 LANCER', sub: 'Marksman rifle', mag: 8, reserve: 24, rof: 1.05, dmg: 120, crit: 2.2, speed: 420, spread: .02, ads: .0004, recoil: .055, auto: false, reload: 2.2, zoom: 8, loud: 240, zero: .0028, tracer: new THREE.Color(5, 4, 2.2), gun: gunRifle(), hip: new V3(.17, -.2, -.44) },
  carbine: { key: 'carbine', name: 'K4 CARBINE', sub: 'Assault carbine', mag: 30, reserve: 120, rof: .09, dmg: 25, crit: 1.8, speed: 620, spread: .032, ads: .006, recoil: .012, auto: true, reload: 1.8, zoom: 1.6, loud: 170, zero: .0013, tracer: new THREE.Color(5, 3, 1.2), gun: gunCarbine(), hip: new V3(.17, -.19, -.4) },
  smg: { key: 'smg', name: 'WISP SMG', sub: 'Suppressed SMG', mag: 32, reserve: 128, rof: .066, dmg: 17, crit: 1.8, speed: 400, spread: .042, ads: .012, recoil: .009, auto: true, reload: 1.6, zoom: 1.3, loud: 16, zero: .002, tracer: null, gun: gunSMG(), hip: new V3(.16, -.18, -.36) },
};
const ORDER = ['carbine', 'rifle', 'smg'];
for (const k of ORDER) { const g = WEAP[k].gun; g.root.visible = false; camera.add(g.root); g.magHome = g.mag.position.clone(); }
// muzzle flash: two crossed additive quads
const flashTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, '#fff'); g.addColorStop(.25, 'rgba(255,220,120,.95)'); g.addColorStop(1, 'rgba(255,120,20,0)'); x.fillStyle = g; x.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28, r = i % 2 ? 12 : 32; x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } x.fill(); return new THREE.CanvasTexture(c); })();
const flashMesh = new THREE.Group(); { const m = new THREE.MeshBasicMaterial({ map: flashTex, color: new THREE.Color(3, 2.2, 1.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const a = new THREE.Mesh(new THREE.PlaneGeometry(.22, .22), m), b = a.clone(); b.rotation.y = Math.PI / 2; const c = new THREE.Mesh(new THREE.PlaneGeometry(.12, .12), m); c.rotation.y = 0; a.rotation.x = 0; flashMesh.add(a, b, c); flashMesh.visible = false; flashMesh.renderOrder = 11; camera.add(flashMesh); }
const muzzleLight = new THREE.PointLight(0xffb060, 0, 9, 2); camera.add(muzzleLight); muzzleLight.position.set(.1, -.1, -1);
const W = { cur: 'carbine', st: {}, cool: 0, reloadT: 0, swapT: 0, kick: 0, kickYaw: 0, bloom: 0, trigger: false, lastTrig: false, nades: { frag: 2, smoke: 1 } };
function resetWeapons() {
  for (const k of ORDER) W.st[k] = { ammo: WEAP[k].mag, reserve: WEAP[k].reserve, ap: false, optic: k === 'rifle' ? '8x scope' : k === 'carbine' ? 'red dot' : 'holo', zoom: WEAP[k].zoom, mag: WEAP[k].mag };
  W.nades = { frag: 2, smoke: 1 }; W.cur = 'carbine'; W.cool = W.reloadT = W.swapT = 0; showGun();
}
function showGun() { for (const k of ORDER) WEAP[k].gun.root.visible = k === W.cur && G.state === 'play' && G.phase === 'active'; }
function switchWeapon(k) { if (k === W.cur || W.swapT > 0) return; W.cur = k; W.swapT = .35; W.reloadT = 0; showGun(); audio.reload('swap'); hudWeapon(); }
const hudWeapon = () => hud.weapon(WEAP[W.cur], W.st[W.cur], W.nades);
function reload() { const w = WEAP[W.cur], s = W.st[W.cur]; if (W.reloadT > 0 || s.ammo >= s.mag || s.reserve <= 0) return; W.reloadT = w.reload; audio.reload(w.key); }

const bullets = [];
const fwd = new V3(), tmp = new V3(), tmp2 = new V3();
function camForward(out = fwd) { const pt = P.pitch + (G.recoilP || 0); return out.set(-Math.sin(P.yaw) * Math.cos(pt), Math.sin(pt), -Math.cos(P.yaw) * Math.cos(pt)); }
function fire() {
  const w = WEAP[W.cur], s = W.st[W.cur];
  if (W.cool > 0 || W.reloadT > 0 || W.swapT > 0) return;
  if (s.ammo <= 0) { if (!W.lastTrig) { audio.shot('dry'); reload(); } return; }
  s.ammo--; W.cool = w.rof;
  const moving = Math.hypot(P.vel.x, P.vel.z) > 1, base = lerp(w.spread, w.ads, G.ads) * (moving ? 1.6 : 1) * (P.onGround ? 1 : 2) * (P.crouch ? .8 : 1) + W.bloom;
  const eye = P.eye(), dir = camForward(new V3());
  dir.applyAxisAngle(new V3(Math.cos(P.yaw), 0, -Math.sin(P.yaw)), w.zero);
  const r = Math.sqrt(Math.random()) * base, a = Math.random() * 6.28, right = new V3(Math.cos(P.yaw), 0, -Math.sin(P.yaw)), up = new V3().crossVectors(right, dir).normalize();
  dir.addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
  const muz = w.gun.root.localToWorld(w.gun.muzzle.clone());
  const b = { p: eye.clone(), v: dir.multiplyScalar(w.speed), life: 2.2, w, ap: s.ap, vis: muz.sub(eye), streak: w.tracer ? fx.streak(eye, eye, w.tracer, w.key === 'rifle' ? .05 : .035) : -1, dist: 0 };
  bullets.push(b);
  // feel: recoil, flash, sound, shake, brass
  W.kick = Math.min(.25, W.kick + w.recoil * (G.ads > .5 ? .7 : 1)); W.kickYaw += (Math.random() - .5) * w.recoil * .5; W.bloom = Math.min(.05, W.bloom + w.spread * .18);
  W.vk = (W.vk || 0) + (w.key === 'rifle' ? .09 : .035);
  audio.shot(w.key); P.loudT = w.loud > 50 ? G.time : P.loudT;
  if (w.loud > 50) { enemies.noise(P.p, w.loud, true); } else enemies.noise(P.p, w.loud, false);
  if (w.key !== 'smg') { flashMesh.visible = true; flashMesh.position.copy(w.gun.muzzle).add(w.gun.root.position); flashMesh.rotation.z = Math.random() * 6.28; flashMesh.scale.setScalar(w.key === 'rifle' ? 1.4 : 1); W.flashT = .045; muzzleLight.intensity = 14; muzzleLight.position.copy(flashMesh.position); }
  fx.shake(w.key === 'rifle' ? .16 : .045);
  if (w.key === 'rifle') { audio.boltCycle(); W.boltT = .7; }
  const port = w.gun.root.localToWorld(new V3(.04, .03, -.02)); fx.debris(port, 1, '#f0c24a', 2.2, .03);
  if (s.ammo === 0) setTimeout(reload, 250);
  hudWeapon();
}
function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i]; b.life -= dt;
    const a = b.p.clone(); b.v.y -= 9.8 * dt; const nb = a.clone().addScaledVector(b.v, dt), L = a.distanceTo(nb), dir = tmp.subVectors(nb, a).normalize().clone();
    const eh = enemies.hitTest(a, nb), wh = world.ray(a, dir, L, { trees: true });
    let done = false;
    if (eh && (!wh || eh.t <= wh.t)) {
      const crit = eh.crit, dmg = b.w.dmg * (crit ? b.w.crit : 1) * (b.ap ? 1.15 : 1), r = eh.e.damage(dmg, crit, P.p, b.ap);
      fx.impact({ p: eh.p, n: dir.clone().negate(), kind: 'robot' }); audio.ping(crit); hud.hit(r && r.killed, crit);
      if (r && r.killed) onKill(eh.e, crit, r.stealth, b.w); else if (eh.e.T.armor && !crit) G.armorHint();
      done = true;
    } else if (wh) { fx.impact(wh, dir); if (wh.kind === 'water') audio.step(true); done = true; }
    b.dist += L;
    if (b.streak >= 0) { b.vis.multiplyScalar(Math.max(0, 1 - dt * 14)); const head = (done ? (eh && (!wh || eh.t <= wh.t) ? eh.p : wh.p) : nb).clone().add(b.vis); const tail = head.clone().addScaledVector(dir, -Math.min(b.dist + .5, b.w.key === 'rifle' ? 14 : 8)); fx.setStreak(b.streak, head, tail); }
    if (done || b.life <= 0) { if (b.streak >= 0) { const s = b.streak; setTimeout(() => fx.freeStreak(s), 30); } bullets.splice(i, 1); continue; }
    b.p.copy(nb);
  }
}
// grenades
const nades = [];
const nadeGeo = new THREE.IcosahedronGeometry(.09, 1), fragMat = new THREE.MeshToonMaterial({ color: 0x3f8a3a }), smokeMat = new THREE.MeshToonMaterial({ color: 0xc9d0da });
function throwNade(kind) {
  if (W.nades[kind] <= 0 || G.phase !== 'active') return; W.nades[kind]--; hudWeapon();
  const m = new THREE.Mesh(nadeGeo, kind === 'frag' ? fragMat : smokeMat); m.castShadow = true; scene.add(m);
  const d = camForward(new V3()); const v = d.multiplyScalar(17).add(new V3(0, 4.5, 0)).add(P.vel.clone().multiplyScalar(.5));
  nades.push({ kind, m, p: P.eye().add(d.clone().normalize().multiplyScalar(.5)), v, fuse: kind === 'frag' ? 2.3 : 1.1 }); audio.throw(); W.vk = (W.vk || 0) + .05;
}
function updateNades(dt) {
  for (let i = nades.length - 1; i >= 0; i--) {
    const n = nades[i]; n.fuse -= dt; n.v.y -= 18 * dt; const prev = n.p.clone(); n.p.addScaledVector(n.v, dt);
    const g = world.groundAt(n.p.x, n.p.z, prev.y);
    if (n.p.y < g + .09) { n.p.y = g + .09; if (Math.abs(n.v.y) > 2) audio.bounce(); n.v.y = Math.abs(n.v.y) * .35; n.v.x *= .6; n.v.z *= .6; }
    if (world.collide(n.p, .1, n.p.y - .1, .2)) { n.v.x *= -.45; n.v.z *= -.45; }
    if (world.depth(n.p.x, n.p.z) > 0 && n.p.y < world.waterY(n.p.x, n.p.z)) { n.v.multiplyScalar(.9); }
    n.m.position.copy(n.p); n.m.rotation.x += dt * 8;
    if (n.fuse <= 0) {
      scene.remove(n.m); nades.splice(i, 1);
      if (n.kind === 'frag') explode(n.p, 7.5, 320, true);
      else { world.smokes.push({ p: n.p.clone().add(new V3(0, 1.8, 0)), r: 6.5, life: 16 }); fx.emitter({ p: n.p.clone().add(new V3(0, .4, 0)), life: 13, rate: 9, kind: 'cloud' }); audio.smokePop(); enemies.noise(n.p, 25, false); }
    }
  }
}
function explode(p, R, dmg, byPlayer) {
  fx.explosion(p, R / 6); const d = p.distanceTo(P.p); audio.boom(d); fx.shake(Math.max(0, 1.1 - d / 30));
  for (const e of enemies.list) { if (!e.alive) continue; const c = e.p.clone().add(new V3(0, e.T.height * .4, 0)), dd = c.distanceTo(p); if (dd > R + e.T.radius) continue;
    const r = e.damage(dmg * Math.pow(1 - Math.min(1, Math.max(0, dd - e.T.radius) / R), .7) * (e.T.armor ? 2.2 : 1), false, p, true); if (byPlayer) { hud.hit(r && r.killed, false); if (r && r.killed) onKill(e, false, r.stealth, { key: 'frag', name: 'FRAG' }); } }
  if (d < R * .75 && P.alive) hurt(70 * (1 - d / (R * .75)), p);
  enemies.noise(p, 260, true);
}

// ------------------------------------------------------------------ contracts
const CONTRACTS = [
  { id: 'ledger', name: 'Silent Ledger', where: 'Halvard Dam', brief: 'Pull the WARDEN patrol logs from the dam terminal, then exfil.', time: 420, spawn: 0, lz: 0, obj: 'hack' },
  { id: 'glass', name: 'Glass Ear', where: 'Kessel Radar Station', brief: 'Plant a charge on the radar core. Get clear. Get out.', time: 480, spawn: 2, lz: 2, obj: 'plant' },
  { id: 'cell', name: 'Cold Cell', where: 'Forest Relay', brief: 'Steal the power cell. It pings WARDEN every 25 s while you carry it.', time: 480, spawn: 4, lz: 3, obj: 'carry' },
  { id: 'shepherd', name: 'Iron Shepherd', where: 'Dam Road', brief: 'A Bulwark walker escorts the convoy road. Bring it down. Shoot the glowing back core.', time: 480, spawn: 1, lz: 1, obj: 'kill' },
  { id: 'blackout', name: 'Blackout', where: 'Valley Pylons', brief: 'Sabotage all three relay pylons, then reach the bird.', time: 600, spawn: 3, lz: 0, obj: 'multi' },
];
const crest = (x, o = {}) => ({ x: DAM_X + x, z: DAM_Z, feet: CREST, ...o });
function enemyPlan(id, R) {
  const at = (cx, cz, r) => { const a = R() * 6.28, d = R() * r; return [cx + Math.cos(a) * d, cz + Math.sin(a) * d]; };
  const L = [];
  const house = { x: DAM_X + 94, z: DAM_Z - 13 };
  if (id === 'ledger') {
    L.push(['picket', DAM_X - 40, DAM_Z, { feet: CREST, route: [new V3(DAM_X - 70, 0, DAM_Z), new V3(DAM_X - 5, 0, DAM_Z)] }], ['picket', DAM_X + 20, DAM_Z, { feet: CREST, route: [new V3(DAM_X - 10, 0, DAM_Z), new V3(DAM_X + 70, 0, DAM_Z)] }]);
    L.push(['picket', house.x - 6, house.z + 8, { patrol: 8 }], ['picket', house.x + 8, house.z + 6, { patrol: 10 }], ['strider', house.x, house.z + 12, { patrol: 5 }]);
    L.push(['picket', DAM_X + 12, DAM_Z + 46, { patrol: 12 }], ['picket', DAM_X - 18, DAM_Z + 58, { patrol: 14 }], ['picket', DAM_X + 110, DAM_Z + 12, { patrol: 12 }]);
    L.push(['kestrel', DAM_X + 30, DAM_Z + 30, { patrol: 40 }], ['picket', -40, 40, { patrol: 10 }], ['picket', -34, 52, { patrol: 8 }]);
  } else if (id === 'glass') {
    for (let i = 0; i < 7; i++) L.push(['picket', ...at(BASE.x, BASE.z, 36), { patrol: 14 }]);
    L.push(['strider', BASE.x - 10, BASE.z + 8, { patrol: 6 }], ['strider', BASE.x + 20, BASE.z - 20, { patrol: 6 }], ['kestrel', BASE.x, BASE.z, { patrol: 50 }]);
    L.push(['picket', BASE.x - 60, BASE.z + 4, { patrol: 12 }], ['picket', BASE.x + 10, BASE.z + 60, { patrol: 16 }]);
  } else if (id === 'cell') {
    for (let i = 0; i < 4; i++) L.push(['picket', ...at(RELAY.x, RELAY.z, 18), { patrol: 10 }]);
    L.push(['strider', RELAY.x + 4, RELAY.z - 8, { patrol: 4 }], ['kestrel', RELAY.x, RELAY.z, { patrol: 40 }], ['picket', -180, 20, { patrol: 20 }], ['picket', -150, -60, { patrol: 25 }], ['picket', -170, -120, { patrol: 20 }]);
  } else if (id === 'shepherd') {
    const road = [new V3(DAM_X + 100, 0, DAM_Z + 6), new V3(60, 0, 10), new V3(92, 0, 46), new V3(60, 0, 10)];
    L.push(['bulwark', 60, 10, { route: road }], ['picket', 64, 14, { route: road }], ['picket', 56, 6, { route: road }], ['strider', 66, 4, { route: road }], ['picket', 58, 18, { route: road }]);
    L.push(['kestrel', 60, 30, { patrol: 60 }], ['picket', 30, 90, { patrol: 15 }], ['picket', 95, 120, { patrol: 15 }]);
  } else if (id === 'blackout') {
    for (const p of PYLONS) { L.push(['picket', p.x + 6, p.z + 4, { patrol: 9 }], ['picket', p.x - 7, p.z - 3, { patrol: 12 }]); L.push([R() < .5 ? 'strider' : 'kestrel', p.x, p.z + 10, { patrol: 8 }]); }
    L.push(['picket', DAM_X - 60, DAM_Z, { feet: CREST, route: [new V3(DAM_X - 70, 0, DAM_Z), new V3(DAM_X + 70, 0, DAM_Z)] }]);
  }
  return L;
}
const LOOT_SPOTS = [[DAM_X + 88, DAM_Z - 4], [DAM_X - 90, DAM_Z + 10], [DAM_X + 104, DAM_Z - 20], [BASE.x - 30, BASE.z - 10], [BASE.x + 24, BASE.z + 30], [BASE.x - 50, BASE.z + 30], [RELAY.x - 8, RELAY.z + 8], [RELAY.x + 12, RELAY.z - 2],
  [PYLONS[0].x + 5, PYLONS[0].z - 6], [PYLONS[1].x - 5, PYLONS[1].z + 6], [PYLONS[2].x + 6, PYLONS[2].z - 4], [-152, 56], [60, 14], [92, 50], [-120, -30], [20, 130], [160, -20], [-60, 120], [-100, -120], [130, 150]];
const LOOT = [
  [['AMMO CACHE', s => { for (const k of ORDER) W.st[k].reserve += Math.round(WEAP[k].mag * 1.5); }], ['FRAG GRENADE', () => W.nades.frag++], ['ARMOR PLATE', () => { P.armor = Math.min(150, P.armor + 50); audio.plate(); }]],
  [['ARMOR PLATE x2', () => { P.armor = Math.min(150, P.armor + 100); audio.plate(); }], ['SMOKE + FRAG', () => { W.nades.smoke++; W.nades.frag++; }], ['EXTENDED MAG', () => { const s = W.st.smg; s.mag = 45; s.optic = 'ext mag'; W.st.carbine.mag = 40; }]],
  [['AP ROUNDS', () => { W.st.rifle.ap = W.st.carbine.ap = true; }], ['HOLO 2.5x', () => { W.st.carbine.zoom = 2.5; W.st.carbine.optic = 'holo 2.5x'; }], ['RIFLE MAGS', () => { W.st.rifle.reserve += 24; }]],
  [['12x VARIABLE SCOPE + AP', () => { W.st.rifle.zoom = 12; W.st.rifle.optic = '12x scope'; W.st.rifle.ap = W.st.carbine.ap = true; P.armor = Math.min(150, P.armor + 50); }]],
];
let R = mulberry(1), C0 = null, run = null;
const crates = [], objs = [];
function clearRun() {
  enemies.clear(); for (const c of crates) scene.remove(c.root); crates.length = 0; for (const o of objs) o.mesh && scene.remove(o.mesh); objs.length = 0;
  for (const b of bullets) b.streak >= 0 && fx.freeStreak(b.streak); bullets.length = 0; for (const n of nades) scene.remove(n.m); nades.length = 0; world.smokes.length = 0;
  if (run && run.heli) scene.remove(run.heli.root);
  world.dish.rotation.x = 0; world.dish.position.y = world.props.baseY + 20.4; fx.emitters.length = 0;
}
function startContract(idx) {
  audio.init(); clearRun();
  const isDaily = idx === 5; const seed = isDaily ? (D.seed || +new Date().toISOString().slice(0, 10).replace(/-/g, '')) : 1000 + idx * 77 + (S.get('runs', 0) % 1000);
  R = mulberry(seed);
  let c = CONTRACTS[isDaily ? Math.floor(R() * 5) : idx];
  if (isDaily) c = { ...c, name: 'Daily: ' + c.name, time: Math.round(c.time * .9), spawn: Math.floor(R() * SPAWNS.length), lz: Math.floor(R() * LZS.length), daily: true };
  C0 = c;
  G.k = F.k() * (isDaily ? 1.1 : 1) * (1 + idx * .04);
  run = { idx, c, score: 0, kills: 0, crits: 0, stealthKills: 0, marks: 0, loot: 0, alarm: false, t0: performance.now(), time: c.time, objDone: false, objStep: 0, heli: null, exfil: null, carry: false, beaconT: 25, ships: 0, recorded: false, intro: 3.4, ended: false };
  G.time = 0; G.state = 'play'; G.phase = 'intro';
  // player
  const sp = SPAWNS[c.spawn]; P.p.set(sp.x, world.h(sp.x, sp.z), sp.z); P.yaw = sp.yaw; P.pitch = -.05; P.vel.set(0, 0, 0); P.hp = 100; P.armor = 50; P.alive = true; P.crouch = false;
  // aim the spawn at the contract target
  const tgt = objectiveTarget(c); if (tgt) P.yaw = Math.atan2(-(tgt.x - P.p.x), -(tgt.z - P.p.z));
  resetWeapons();
  // enemies
  for (const [type, x, z, o] of enemyPlan(c.id, R)) { const e = enemies.spawn(type, x, z, { ...o, yaw: R() * 6.28 }); if (o && o.feet) { e.p.y = world.groundAt(x, z, o.feet); e.m.root.position.copy(e.p); } if (isDaily && R() < .3) e.hpMul = 1; }
  // loot crates
  const spots = LOOT_SPOTS.slice().sort(() => R() - .5).slice(0, 8);
  spots.push([sp.x + Math.cos(sp.yaw) * 4, sp.z - Math.sin(sp.yaw) * 4]);
  for (const [x, z] of spots) { let xx = x, zz = z; for (let k = 0; k < 6 && (world.depth(xx, zz) > 0 || world.collide(new V3(xx, 0, zz), .6, world.h(xx, zz), 1)); k++) { xx += (R() - .5) * 6; zz += (R() - .5) * 6; }
    const rr = R(), rar = rr < .45 ? 0 : rr < .75 ? 1 : rr < .93 ? 2 : 3, m = crate(rar); m.root.position.set(xx, world.groundAt(xx, zz, world.h(xx, zz) + 1), zz); m.root.rotation.y = R() * 6.28; scene.add(m.root); crates.push({ ...m, rar, open: false, t: 0 }); }
  // objectives
  setupObjective(c);
  B.start();
  hud.hideMenu(); hud.hud(true); showGun(); hudWeapon(); hud.vitals(P.hp, P.armor); hud.timer(run.time);
  hud.radio('KITE-6', `Ember, this is Kite-6. ${c.brief}`, 6);
  audio.intensity = 0;
}
function objectiveTarget(c) { return { hack: world.props.terminal, plant: world.props.core, carry: world.props.cell, kill: new V3(60, 0, 10), multi: PYLONS[0].target }[c.obj]; }
function setupObjective(c) {
  if (c.obj === 'hack') objs.push({ type: 'hold', p: world.props.terminal, label: 'TERMINAL', hold: 1.2, verb: 'Start upload', then: 'upload', r: 2.4 });
  if (c.obj === 'plant') objs.push({ type: 'hold', p: world.props.core, label: 'RADAR CORE', hold: 3.5, verb: 'Plant charge', then: 'charge', r: 3 });
  if (c.obj === 'carry') { const m = powerCell(); m.root.position.copy(world.props.cell).add(new V3(0, .4, 0)); scene.add(m.root); objs.push({ type: 'hold', p: world.props.cell, label: 'POWER CELL', hold: 1.5, verb: 'Take the cell', then: 'carry', r: 2.6, mesh: m.root }); }
  if (c.obj === 'kill') { const bw = enemies.list.find(e => e.type === 'bulwark'); bw.marked = true; objs.push({ type: 'kill', e: bw, label: 'BULWARK' }); }
  if (c.obj === 'multi') for (const [i, p] of PYLONS.entries()) objs.push({ type: 'hold', p: p.target, label: 'PYLON ' + 'ABC'[i], hold: 2.6, verb: 'Plant charge', then: 'charge', r: 3.2, small: true });
}
function objText() {
  if (!run) return ['', ''];
  if (run.exfil) return [run.exfil.state === 'landed' ? 'BOARD KITE-6' : 'EXFIL ' + LZS[C0.lz].name, run.exfil.state === 'landed' ? 'The bird is down. Get in!' : `Kite-6 inbound · ${Math.ceil(run.exfil.eta)} s`];
  const left = objs.filter(o => !o.done);
  if (run.uploading) return ['UPLOADING', `Stay near the terminal · ${Math.floor(run.upload * 100)}%`];
  if (run.carry) return ['CARRY THE CELL', 'Reach any exfil · it pings WARDEN'];
  if (C0.obj === 'multi') return [C0.name.toUpperCase(), `Sabotage pylons · ${3 - left.length}/3`];
  const o = left[0]; return [C0.name.toUpperCase(), o ? (o.type === 'kill' ? 'Destroy the Bulwark walker' : o.verb + ' · ' + o.label) : 'Objective complete'];
}
function completeObjective() {
  if (run.objDone) return; run.objDone = true; addScore(1500, 'CONTRACT OBJECTIVE', '#ffd23a');
  hud.banner('OBJECTIVE COMPLETE', 'Exfil at ' + LZS[C0.lz].name, '#ffd23a', 3); audio.win();
  callExfil();
}
function callExfil() {
  const lz = LZS[C0.lz]; const y = world.h(lz.x, lz.z);
  const h = heli(); scene.add(h.root);
  const a = Math.atan2(lz.x, lz.z) + .5, from = new V3(lz.x + Math.sin(a) * 320, y + 90, lz.z + Math.cos(a) * 320); h.root.position.copy(from);
  run.heli = h; run.exfil = { state: 'inbound', eta: 32, t: 0, from, to: new V3(lz.x, y + .1, lz.z), p: from.clone() };
  fx.emitter({ p: new V3(lz.x + 3, y + .2, lz.z + 3), life: 200, rate: 10, kind: 'flare', color: [.35, 1, .5] });
  hud.radio('KITE-6', `Copy, Ember. Wheels down at ${lz.name} in thirty. Pop smoke is up, green.`, 5);
  enemies.dropship(lz.x + 30, lz.z + 20, 3); run.ships++;
}
// points already earned count even if the run later fails (a failed run keeps its points), so the running total is
// posted as it grows (the kit keeps today's best); the extraction bonus is added by endRun's final submit.
function postProgress() { if (!run || run.ended || G.time < 20 || G.time - (run.postT || -9) < 4) return; run.postT = G.time; B.submit(run.score, { ms: performance.now() - run.t0 }); }
function addScore(n, label, color) { run.score += Math.round(n); setTimeout(postProgress, 0); if (label) hud.feed(label, Math.round(n), color); if (D.beaten(run.score) && !run.beat) { run.beat = true; ui.pop('BEATEN!', '#ffd23a', 40, 30); } }
function onKill(e, crit, stealth, w) {
  const mult = (crit ? 1.25 : 1) * (stealth ? 1.5 : 1), pts = e.T.score * mult; run.kills++; if (crit) run.crits++; if (stealth) run.stealthKills++;
  addScore(pts, `${e.T.label}${crit ? ' · CRIT' : ''}${stealth ? ' · SILENT' : ''}`, crit ? '#ffd23a' : '#fff'); audio.hitmark(true);
  for (const o of objs) if (o.type === 'kill' && o.e === e && !o.done) { o.done = true; hud.banner('BULWARK DOWN', 'Huge. Now get out.', '#ffd23a'); completeObjective(); }
}
G.onKillPublic = onKill; G.dev = { get inp() { return inp; }, hold: on => { keys.KeyE = on; }, objs: () => objs, sw: k => switchWeapon(k), binoc: () => toggleBinoc(), complete: () => completeObjective(), run: () => run, end: w => endRun(w, 'TEST', '') }; G.start = i => startContract(i);
G.onAlarm = (e) => {
  if (!run || run.alarm || G.state !== 'play') return;
  audio.intensity = 1; run.alarm = true;
  hud.banner('⚠ ALARM', 'WARDEN knows you are here', '#ff3b5c', 2.4);
  for (const o of enemies.list) if (o.alive && o !== e && o.p.distanceTo(e.p) < 110) o.alert(P.p.clone().add(new V3((Math.random() - .5) * 20, 0, (Math.random() - .5) * 20)), false);
  setTimeout(() => { if (run && !run.ended && run.ships < 3 && G.state === 'play') { const a = Math.random() * 6.28; enemies.dropship(P.p.x + Math.cos(a) * 45, P.p.z + Math.sin(a) * 45, 3, ['picket', 'picket', 'strider']); run.ships++; hud.radio('KITE-6', 'WARDEN dropship inbound on your position. Find cover.', 4); } }, 14000);
};
G.onSpotted = () => {};
G.onDropship = () => { audio.alert(30); };
G.armorHint = () => { if (!run.hinted) { run.hinted = true; hud.radio('KITE-6', 'Armor plating is soaking it. Hit the glowing core on its back, or use frags and AP rounds.', 5); } };
G.onWhiz = () => audio.charge(3, 2400);
function hurt(dmg, from) {
  if (!P.alive || G.phase === 'intro') return;
  const a = Math.min(P.armor, dmg); P.armor -= a; P.hp -= (dmg - a) + a * .08; P.hurtT = G.time;
  hud.damage(from); audio.hurt(); fx.shake(.2 + dmg / 120); hud.el.vig.style.opacity = Math.min(1, .35 + dmg / 40);
  if (P.hp <= 0) { P.hp = 0; P.alive = false; endRun(false, 'K.I.A.', 'WARDEN got you'); }
  hud.vitals(P.hp, P.armor);
}
G.hurtPlayer = hurt;

// ------------------------------------------------------------------ input
const keys = {}, inp = { mx: 0, my: 0, lookX: 0, lookY: 0, fire: false, ads: false, use: false, jump: false, sprint: false };
addEventListener('keydown', e => {
  keys[e.code] = true; if (G.state !== 'play') return;
  if (e.code === 'KeyR') reload(); if (e.code === 'Digit1') switchWeapon('carbine'); if (e.code === 'Digit2') switchWeapon('rifle'); if (e.code === 'Digit3') switchWeapon('smg');
  if (e.code === 'KeyQ') switchWeapon(ORDER[(ORDER.indexOf(W.cur) + 1) % 3]);
  if (e.code === 'KeyC' || e.code === 'ControlLeft') P.crouch = !P.crouch; if (e.code === 'KeyG') throwNade('frag'); if (e.code === 'KeyX') throwNade('smoke');
  if (e.code === 'KeyB') toggleBinoc(); if (e.code === 'Space') inp.jump = true; if (e.code === 'KeyM') audio.muted = !audio.muted;
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('wheel', e => { if (G.state === 'play') switchWeapon(ORDER[(ORDER.indexOf(W.cur) + (e.deltaY > 0 ? 1 : 2)) % 3]); });
const cv = renderer.domElement;
addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('pointerlockchange', () => { hud.el.lock.style.display = !TOUCH && G.state === 'play' && document.pointerLockElement !== cv ? 'block' : 'none'; });
addEventListener('mousemove', e => { if (G.state !== 'play') return; if (document.pointerLockElement === cv || (drag && !TOUCH)) { inp.lookX += e.movementX; inp.lookY += e.movementY; } });
let drag = false;
const pointers = new Map(); let stickId = null, stickO = null;
cv.addEventListener('pointerdown', e => {
  if (G.state !== 'play') return; audio.init();
  if (e.pointerType === 'mouse') {
    if (document.pointerLockElement !== cv && !TOUCH) { try { const r = cv.requestPointerLock(); r && r.catch && r.catch(() => {}); } catch (er) {} drag = true; }
    if (e.button === 0) { if (G.binoc) markTarget(true); else inp.fire = true; } if (e.button === 2) inp.ads = true; return;
  }
  // touch: left-lower = stick, else look
  if (e.clientX < innerWidth * .45 && e.clientY > innerHeight * .4 && stickId === null) { stickId = e.pointerId; stickO = { x: e.clientX, y: e.clientY }; const s = hud.el.stick; s.style.display = 'block'; s.style.left = e.clientX + 'px'; s.style.top = e.clientY + 'px'; s.firstChild.style.transform = ''; }
  else pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, role: 'look' });
});
addEventListener('pointerup', e => { if (e.pointerType === 'mouse') { if (e.button === 0) inp.fire = false; if (e.button === 2) inp.ads = false; drag = false; } endPtr(e); });
addEventListener('pointercancel', endPtr);
function endPtr(e) { if (e.pointerId === stickId) { stickId = null; inp.mx = inp.my = 0; hud.el.stick.style.display = 'none'; } const p = pointers.get(e.pointerId); if (p) { if (p.role === 'btn') btnUp(p.id); pointers.delete(e.pointerId); } }
addEventListener('pointermove', e => {
  if (e.pointerId === stickId) { const dx = e.clientX - stickO.x, dy = e.clientY - stickO.y, L = Math.hypot(dx, dy), m = 50, k = Math.min(1, L / m); inp.mx = L ? dx / L * k : 0; inp.my = L ? -dy / L * k : 0; inp.sprint = L > m * 1.25 && dy < -m * .9; hud.el.stick.firstChild.style.transform = `translate(${dx / Math.max(1, L) * Math.min(L, m)}px,${dy / Math.max(1, L) * Math.min(L, m)}px)`; return; }
  const p = pointers.get(e.pointerId); if (!p) return; if (p.role === 'look' || p.id === 'fire') { const s = TOUCH ? 1.7 : 1; inp.lookX += (e.clientX - p.x) * s; inp.lookY += (e.clientY - p.y) * s; } p.x = e.clientX; p.y = e.clientY;
});
for (const [id, b] of Object.entries(hud.btns)) b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); audio.init(); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, role: 'btn', id }); btnDown(id); });
function btnDown(id) {
  hud.press(id, true);
  if (id === 'fire') { if (G.binoc) markTarget(true); else inp.fire = true; } if (id === 'ads') inp.ads = !inp.ads; if (id === 'reload') reload(); if (id === 'jump') inp.jump = true; if (id === 'crouch') P.crouch = !P.crouch;
  if (id === 'frag') throwNade('frag'); if (id === 'smoke') throwNade('smoke'); if (id === 'binoc') toggleBinoc(); if (id === 'use') inp.use = true;
}
function btnUp(id) { if (id !== 'ads') hud.press(id, false); if (id === 'fire') inp.fire = false; if (id === 'use') inp.use = false; if (id === 'ads') hud.press('ads', inp.ads); }
hud.el.weap.addEventListener('pointerdown', e => { e.stopPropagation(); if (G.state === 'play') switchWeapon(ORDER[(ORDER.indexOf(W.cur) + 1) % 3]); });
function toggleBinoc() { G.binoc = !G.binoc; hud.binoc(G.binoc); inp.ads = false; hud.press('ads', false); hud.press('binoc', G.binoc); audio.ui(); }

// ------------------------------------------------------------------ binocular marking
let markT = 0, markCand = null;
function markTarget(force) {
  if (!markCand) return; if (!markCand.marked) { markCand.marked = true; run.marks++; addScore(25, `MARKED ${markCand.T.label} · ${Math.round(markCand.p.distanceTo(P.p))} m`, '#ff9a22'); audio.beep(true); }
}
function updateBinoc(dt) {
  if (!G.binoc) { markCand = null; return; }
  const eye = P.eye(), f = camForward(new V3()); let best = null, ba = .035;
  for (const e of enemies.list) { if (!e.alive) continue; const c = e.p.clone().add(new V3(0, e.T.fly ? 0 : e.T.height * .5, 0)), d = tmp.subVectors(c, eye), L = d.length(); if (L > 400) continue; const ang = Math.acos(clamp(d.dot(f) / L, -1, 1)); if (ang < ba && world.los(eye, c)) { ba = ang; best = e; } }
  if (best !== markCand) { markCand = best; markT = 0; }
  if (markCand && !markCand.marked) { markT += dt; if (markT > .45) markTarget(); }
  const hit = world.ray(eye, f, 600, { trees: true }); hud.range('binoc', (markCand ? `${markCand.T.label} · ${markCand.marked ? 'MARKED' : 'MARKING…'} · ` : '') + (hit ? Math.round(hit.t) + ' m' : '--- m'));
}

// ------------------------------------------------------------------ interaction (crates + objectives)
let holdT = 0, holdTarget = null;
function updateInteract(dt) {
  if (G.phase !== 'active') { hud.prompt(null); return; }
  let target = null, best = 9;
  for (const c of crates) if (!c.open) { const d = c.root.position.distanceTo(P.p); if (d < 2.4 && d < best) { best = d; target = { kind: 'crate', c, hold: .45, txt: `Open ${RARITY[c.rar].n.toLowerCase()} crate` }; } }
  for (const o of objs) if (o.type === 'hold' && !o.done && !(run.uploading)) { const d = tmp.set(o.p.x, P.p.y, o.p.z).distanceTo(P.p); if (d < o.r && Math.abs(o.p.y - P.p.y) < 3) { target = { kind: 'obj', o, hold: o.hold, txt: o.verb }; } }
  if (run.exfil && run.exfil.state === 'landed' && run.heli.root.position.distanceTo(P.p) < 9) { endRun(true); return; }
  const holding = keys.KeyE || keys.KeyF || inp.use || (G.botHold && G.time - G.botT < .5);
  if (target && holdTarget && (target.c !== holdTarget.c || target.o !== holdTarget.o)) holdT = 0;
  holdTarget = target;
  if (!target) { holdT = 0; hud.prompt(null); return; }
  if (holding) holdT += dt; else holdT = Math.max(0, holdT - dt * 2);
  hud.prompt(target.txt, holdT / target.hold);
  if (holdT >= target.hold) { holdT = 0; if (target.kind === 'crate') openCrate(target.c); else doObjective(target.o); }
}
function openCrate(c) {
  c.open = true; c.t = 0; c.mat.userData.glow.value = .3; const opts = LOOT[c.rar], [name, fn] = opts[Math.floor(Math.random() * opts.length)]; fn(); run.loot++;
  hud.loot(c.rar, name); audio.loot(c.rar); addScore(50 + c.rar * 50, null); fx.sparks(c.root.position.clone().add(new V3(0, .6, 0)), 14, 4); hudWeapon(); hud.vitals(P.hp, P.armor);
}
function doObjective(o) {
  if (o.then === 'upload') { o.done = true; run.uploading = true; run.upload = 0; hud.radio('KITE-6', 'Upload running. Hold that terminal, Ember. They will feel it.', 4); enemies.noise(o.p, 120, false); setTimeout(() => { if (run && !run.ended) { enemies.dropship(o.p.x - 40, o.p.z + 30, 3); run.ships++; } }, 4000); }
  if (o.then === 'charge') { o.done = true; const m = charge(); m.root.position.copy(o.p).add(new V3(0, .2, 0)); scene.add(m.root); o.mesh = m.root; o.fuse = o.small ? 5 : 7; o.armed = true; hud.banner('CHARGE SET', `${o.fuse} seconds. Move!`, '#ff7a22', 2); run.objStep++; }
  if (o.then === 'carry') { o.done = true; run.carry = true; scene.remove(o.mesh); hud.banner('CELL SECURED', 'It is pinging WARDEN. Move fast.', '#3fe6ff'); enemies.noise(o.p, 150, false); completeObjective(); }
}
function updateObjectives(dt) {
  for (const o of objs) if (o.type === 'kill' && !o.done && !o.e.alive) { o.done = true; hud.banner('BULWARK DOWN', 'Huge. Now get out.', '#ffd23a'); completeObjective(); }
  for (const o of objs) {
    if (o.armed) { o.fuse -= dt; if (Math.floor(o.fuse * 2) !== Math.floor((o.fuse + dt) * 2)) audio.beep(o.fuse < 2);
      if (o.fuse <= 0) { o.armed = false; scene.remove(o.mesh); explode(o.p.clone().add(new V3(0, .8, 0)), o.small ? 6 : 9, 200, true);
        if (!o.small) { fx.explosion(o.p.clone().add(new V3(0, 6, 0)), 2.2); run.dishFall = 0; G.onAlarm(enemies.list.find(e => e.alive) || { p: o.p }); completeObjective(); }
        else { fx.emitter({ p: o.p.clone(), life: 30, rate: 6, kind: 'smoke', size: 1.5 }); if (objs.every(q => q.done && !q.armed)) completeObjective(); else { hud.banner('PYLON DOWN', `${objs.filter(q => q.done && !q.armed).length}/3`, '#ffd23a'); if (!run.alarm) G.onAlarm(enemies.list.find(e => e.alive) || { p: o.p }); } } } }
  }
  if (run.uploading) { const d = tmp.copy(world.props.terminal).setY(P.p.y).distanceTo(P.p); if (d < 14) run.upload += dt / 14; if (run.upload >= 1) { run.uploading = false; hud.banner('LOGS SECURED', '', '#3fe6ff'); completeObjective(); } }
  if (run.dishFall !== undefined && run.dishFall < 1) { run.dishFall = Math.min(1, run.dishFall + dt * .7); world.dish.rotation.x = run.dishFall * run.dishFall * 1.3; world.dish.position.y = world.props.baseY + 20.4 - run.dishFall * run.dishFall * 6; }
  if (run.carry) { run.beaconT -= dt; if (run.beaconT <= 0) { run.beaconT = 25; enemies.noise(P.p, 160, false); hud.feed('CELL PING · WARDEN knows', 0, '#3fe6ff'); audio.beep(true); } }
  // exfil helicopter
  const X = run.exfil; if (X) {
    X.t += dt; X.eta -= dt; const h = run.heli;
    if (X.state === 'inbound') { const k = clamp(1 - X.eta / 32, 0, 1), e = 1 - Math.pow(1 - k, 2); X.p.lerpVectors(X.from, tmp.copy(X.to).add(new V3(0, 12 * (1 - k) + 0, 0)), e); if (X.eta <= 0) { X.state = 'landed'; hud.banner('KITE-6 IS DOWN', 'Get to the helicopter!', '#5dff8a'); hud.radio('KITE-6', 'Wheels down. Get in, Ember!', 3); } h.root.rotation.y = Math.atan2(X.to.x - X.from.x, X.to.z - X.from.z); h.body.rotation.x = (1 - k) * .18; }
    else h.body.rotation.x *= .95;
    h.root.position.copy(X.p); h.rotor.rotation.y += dt * 28; h.tail.rotation.x += dt * 40;
    const hd = X.p.distanceTo(P.p); audio.loops({ rotor: Math.min(1, 40 / (hd + 10)) });
    if (hd < 40 && X.state !== 'inbound') { if (Math.random() < dt * 20) fx.puff(tmp.set(X.p.x + (Math.random() - .5) * 10, world.h(X.p.x, X.p.z) + .2, X.p.z + (Math.random() - .5) * 10), 1, [.8, .72, .55], 1.2, .4, 1.4, 3); }
  }
}

// ------------------------------------------------------------------ end of run
function endRun(win, title, sub) {
  if (run.ended) return; run.ended = true; G.phase = 'done';
  const ms = performance.now() - run.t0, rows = [['Kills', run.kills], ['Crits / silent', `${run.crits} / ${run.stealthKills}`], ['Crates · marks', `${run.loot} · ${run.marks}`]];
  if (win) { const tb = Math.round(run.time * 3); run.score += 2000 + tb; rows.push(['Extraction', '+2000'], ['Time left bonus', '+' + tb]); if (!run.alarm) { run.score += 1500; rows.push(['GHOST (no alarm)', '+1500']); } audio.win(); }
  else audio.lose();
  rows.push(['CONTRACT SCORE', run.score.toLocaleString()]);
  if (!run.recorded) { run.recorded = true; F.level(win, run.objDone ? .7 : Math.min(.5, run.kills / 12)); }
  const key = 'best_' + (run.idx === 5 ? 'daily' : run.idx), best = S.get(key, 0); if (run.score > best) S.set(key, run.score);
  if (win && run.idx < 5) S.set('unlocked', Math.max(S.get('unlocked', 0), run.idx + 1));
  S.set('runs', S.get('runs', 0) + 1);
  if (win) D.won(run.score, 'scored');
  B.submit(run.score, { ms });
  G.state = win ? 'won' : 'lost'; inp.fire = inp.ads = false; G.binoc = false; hud.binoc(false); hud.scope(false); hud.prompt(null);
  try { document.exitPointerLock && document.exitPointerLock(); } catch (e) {}
  setTimeout(() => {
    hud.hud(false); showGun();
    hud.result({ win, title: win ? 'EXFIL COMPLETE' : title, sub: win ? `${C0.name} · ${C0.where}` : sub, color: win ? '#5dff8a' : '#ff3b5c', rows, best: run.score > best ? '🏆 NEW BEST!' : `Best: ${best.toLocaleString()}` }, shareBtn, () => { G.state = 'ready'; showMenu(); });
  }, win ? 1400 : 1600);
}

// ------------------------------------------------------------------ menu / title camera
let sel = 0;
function showMenu() {
  G.state = 'ready'; G.phase = 'menu'; clearRun(); menuDressing(); P.alive = false; hud.hud(false); showGun(); audio.intensity = 0;
  const unl = S.get('unlocked', 0);
  sel = Math.min(unl, 4);
  const cards = CONTRACTS.map((c, i) => ({ name: c.name, sub: i <= unl ? `${c.where} · ${Math.round(c.time / 60)} min` : 'Locked · extract from the previous contract', icon: i <= unl ? i + 1 : '🔒', cls: (i > unl ? 'locked' : '') + (i === sel ? ' sel' : ''), score: (S.get('best_' + i, 0) || '—').toLocaleString(), scoreLabel: 'best' }));
  cards.push({ name: 'Daily Contract', sub: 'Same seed for everyone today', icon: '★', cls: 'daily', score: (S.get('best_daily', 0) || '—').toLocaleString(), scoreLabel: 'today' });
  hud.menu(cards, D.streak, i => { if (i < 0) i = D.isDaily ? 5 : sel; if (i < 5 && i > unl) { audio.ui(); return; } startContract(i); });
  if (D.isDaily) sel = 5;
}
// ------------------------------------------------------------------ bot (window.__game.bot)
G.botT = -9;
let botTarget = null, botLosT = 0, botStuck = 0, botLast = new V3(), botStrafe = 1;
function bot() {
  if (G.state === 'ready') { startContract(D.isDaily ? 5 : Math.min(S.get('unlocked', 0), 4)); return; }
  G.botT = G.time;
}
function botThink(dt) {
  const eye = P.eye();
  botLosT -= dt;
  if (botLosT <= 0) { botLosT = .3; botTarget = null; let bd = 150;
    for (const e of enemies.list) { if (!e.alive || e.dropping) continue; const c = e.hits()[e.type === 'bulwark' ? 0 : 0].c, d = c.distanceTo(eye); if (d < bd && world.los(eye, c, false)) { bd = d; botTarget = e; } } }
  let mx = 0, my = 0; G.botHold = false; let wantFire = false, wantAds = false;
  G.botDbg = botTarget ? botTarget.type + '@' + Math.round(botTarget.p.distanceTo(P.p)) : 'none';
  if (botTarget && botTarget.alive) {
    const hs = botTarget.hits(), aim = (hs.find(h => h.crit && botTarget.type !== 'bulwark') || hs[0]).c.clone(), d = aim.distanceTo(eye);
    const want = d > 55 && W.st.rifle.ammo + W.st.rifle.reserve > 0 ? 'rifle' : W.st.carbine.ammo + W.st.carbine.reserve > 0 ? 'carbine' : 'smg'; if (want !== W.cur && W.reloadT <= 0) switchWeapon(want);
    const w = WEAP[W.cur], tof = d / w.speed; aim.y += .5 * 9.8 * tof * tof - w.zero * d; aim.addScaledVector(botTarget.T.fly ? new V3() : new V3(Math.sin(botTarget.yaw), 0, Math.cos(botTarget.yaw)), botTarget.speed * tof);
    const dir = aim.sub(eye).normalize(), ty = Math.atan2(-dir.x, -dir.z), tp = Math.asin(clamp(dir.y, -1, 1));
    let dy = Math.atan2(Math.sin(ty - P.yaw), Math.cos(ty - P.yaw)); const dp = tp - P.pitch;
    P.yaw += clamp(dy, -dt * 5, dt * 5); P.pitch += clamp(dp, -dt * 4, dt * 4);
    const err = Math.hypot(dy, dp); wantAds = d > 25; wantFire = err < (w.key === 'rifle' ? .012 : .03) && (w.key !== 'rifle' || G.ads > .9);
    if (d < 14) my = -1; mx = botStrafe * .6; if (Math.random() < dt * .4) botStrafe *= -1;
    if (W.nades.frag > 0 && d > 14 && d < 32 && enemies.list.filter(e => e.alive && e.p.distanceTo(botTarget.p) < 7).length >= 2 && Math.random() < dt * .5) throwNade('frag');
  } else {
    let goal = null;
    if (run.exfil) goal = run.heli.root.position; else { const o = objs.find(o => !o.done && o.type === 'hold'); if (o) goal = o.p; else { const k = objs.find(o => o.type === 'kill' && !o.done); if (k) goal = k.e.p; } }
    const cr = crates.find(c => !c.open && c.root.position.distanceTo(P.p) < 25); if (cr && !run.uploading) goal = cr.root.position;
    if (run.uploading) goal = world.props.terminal;
    if (goal) { const ty = Math.atan2(-(goal.x - P.p.x), -(goal.z - P.p.z)); const dy = Math.atan2(Math.sin(ty - P.yaw), Math.cos(ty - P.yaw)); P.yaw += clamp(dy, -dt * 3, dt * 3); P.pitch *= .95; my = goal.distanceTo(P.p) > 1.6 ? 1 : 0; G.botHold = holdTarget !== null; inp.sprintBot = true; }
    const s = W.st[W.cur]; if (s.ammo < s.mag * .5) reload();
  }
  if (botTarget) inp.sprintBot = false;
  // stuck: jump + sidestep
  botStuck += dt; if (botStuck > 1.5) { if (botLast.distanceTo(P.p) < .8 && (my || mx)) { inp.jump = true; botStrafe *= -1; P.yaw += 1; } botStuck = 0; botLast.copy(P.p); }
  return { mx, my, wantFire, wantAds };
}

// ------------------------------------------------------------------ player update
let lastStepD = 0;
function updatePlayer(dt) {
  const botOn = G.time - G.botT < .6;
  let mx = inp.mx + ((keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0)), my = inp.my + ((keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0));
  let wantFire = inp.fire, wantAds = inp.ads;
  if (botOn && G.phase === 'active') { const b = botThink(dt); mx = b.mx; my = b.my; wantFire = b.wantFire; wantAds = b.wantAds; }
  // look
  const zoom = G.binoc ? 7 : lerp(1, W.st[W.cur].zoom, G.ads), sens = (TOUCH ? .0042 : .0023) / Math.pow(zoom, .85);
  P.yaw -= inp.lookX * sens; P.pitch = clamp(P.pitch - inp.lookY * sens, -1.45, 1.45); inp.lookX = inp.lookY = 0;
  // touch aim assist: gentle pull toward a visible robot near the crosshair while firing / aiming
  if (TOUCH && !botOn && (wantFire || G.ads > .5)) { const eye = P.eye(), f = camForward(new V3()); let best = null, ba = .07; for (const e of enemies.list) { if (!e.alive) continue; const c = e.hits()[0].c, d = tmp.subVectors(c, eye), L = d.length(); if (L > 160) continue; const a = Math.acos(clamp(d.dot(f) / L, -1, 1)); if (a < ba) { ba = a; best = c; } }
    if (best) { const d = best.clone().sub(eye).normalize(), ty = Math.atan2(-d.x, -d.z), tp = Math.asin(d.y); P.yaw += Math.atan2(Math.sin(ty - P.yaw), Math.cos(ty - P.yaw)) * Math.min(1, dt * 3); P.pitch += (tp - P.pitch) * Math.min(1, dt * 3); } }
  // move
  const L = Math.hypot(mx, my); if (L > 1) { mx /= L; my /= L; }
  const sprinting = (keys.ShiftLeft || inp.sprint || (botOn && inp.sprintBot)) && my > .3 && G.ads < .3 && !run.carry && !G.binoc;
  if (sprinting && P.crouch) P.crouch = false;
  P.sprint = sprinting && Math.hypot(P.vel.x, P.vel.z) > 3;
  const depth = world.depth(P.p.x, P.p.z);
  let spd = sprinting ? 7.2 : P.crouch ? 2.4 : 4.7; spd *= lerp(1, .55, G.ads); if (depth > .3) spd *= .6; if (run.carry) spd *= .88; if (G.binoc) spd *= .5;
  const fx_ = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
  const want = new V3((fx_ * my + rx * mx) * spd, 0, (fz * my + rz * mx) * spd);
  const acc = P.onGround ? 11 : 2.5; P.vel.x += (want.x - P.vel.x) * Math.min(1, acc * dt); P.vel.z += (want.z - P.vel.z) * Math.min(1, acc * dt);
  if ((inp.jump || keys.Space) && P.onGround) { P.vel.y = 7.2; P.onGround = false; P.crouch = false; } inp.jump = false;
  P.vel.y -= 22 * dt;
  const prev = P.p.clone();
  P.p.x += P.vel.x * dt; P.p.z += P.vel.z * dt;
  if (world.depth(P.p.x, P.p.z) > 1.9) { P.p.x = prev.x; P.p.z = prev.z; }
  const r = Math.hypot(P.p.x, P.p.z); if (r > BOUND) { P.p.x *= BOUND / r; P.p.z *= BOUND / r; if (!run.boundT || G.time - run.boundT > 4) { run.boundT = G.time; hud.banner('LEAVING THE AREA', 'Turn back, Ember', '#ffd23a', 1.5); } }
  world.collide(P.p, .36, P.p.y, P.crouch ? 1.1 : 1.75);
  P.p.y += P.vel.y * dt;
  const g = world.groundAt(P.p.x, P.p.z, Math.max(prev.y, P.p.y));
  if (P.p.y <= g + (P.onGround ? .45 : 0) && P.vel.y <= 0) { if (!P.onGround && P.vel.y < -6) { audio.land(); fx.shake(.1); } P.p.y = g; P.vel.y = 0; P.onGround = true; }
  else if (P.p.y > g + .45) P.onGround = false;
  const eyeT = P.crouch ? 1.08 : 1.62; P.eyeH += (eyeT - P.eyeH) * Math.min(1, dt * 10);
  // footsteps
  const hv = Math.hypot(P.vel.x, P.vel.z); P.stepD += hv * dt; if (P.onGround && P.stepD > (P.sprint ? 2.6 : 2.1)) { P.stepD = 0; audio.step(depth > .1); if (P.sprint) enemies.noise(P.p, 10, false); if (depth > .1) fx.puff(P.p.clone().add(new V3(0, depth, 0)), 2, [.9, .95, 1], .4, 1, .6); }
  // health regen
  if (G.time - P.hurtT > 5 && P.hp < 100 && P.alive) { P.hp = Math.min(100, P.hp + dt * 12); hud.vitals(P.hp, P.armor); }
  hud.el.vig.style.opacity = Math.max(+hud.el.vig.style.opacity - dt * .8, P.hp < 35 ? .45 + Math.sin(G.time * 6) * .15 : 0);
  // weapon state
  W.cool -= dt; W.swapT = Math.max(0, W.swapT - dt); W.bloom = Math.max(0, W.bloom - dt * .12); W.boltT = Math.max(0, (W.boltT || 0) - dt);
  if (W.reloadT > 0) { W.reloadT -= dt; if (W.reloadT <= 0) { const s = W.st[W.cur], n = Math.min(s.mag - s.ammo, s.reserve); s.ammo += n; s.reserve -= n; hudWeapon(); } }
  const w = WEAP[W.cur];
  const adsWanted = wantAds && W.reloadT <= 0 && W.swapT <= 0 && !G.binoc && !sprinting;
  G.ads += ((adsWanted ? 1 : 0) - G.ads) * Math.min(1, dt * (w.key === 'rifle' ? 8 : 11));
  if (wantFire && !G.binoc && !sprinting && (w.auto || !W.lastTrig)) fire();
  W.lastTrig = wantFire;
  // recoil recovery
  const kickNow = W.kick; W.kick *= Math.max(0, 1 - dt * 9); P.pitch += (kickNow - W.kick) * 0 + 0; G.recoilP = W.kick; P.yaw += W.kickYaw * dt * 8; W.kickYaw *= Math.max(0, 1 - dt * 10);
}
// camera + viewmodel
const bobV = new V3(); let bobT = 0;
function updateCamera(dt) {
  const tr = fx.trauma * fx.trauma, sh = tr * .05;
  camera.position.copy(P.eye()).add(new V3((Math.random() - .5) * sh, (Math.random() - .5) * sh, (Math.random() - .5) * sh));
  const hv = Math.hypot(P.vel.x, P.vel.z); bobT += dt * hv * 1.6 * (P.onGround ? 1 : 0);
  const bob = Math.min(1, hv / 6) * (1 - G.ads * .85);
  camera.position.y += Math.abs(Math.sin(bobT)) * .045 * bob;
  camera.rotation.set(P.pitch + G.recoilP + (Math.random() - .5) * tr * .03, P.yaw, Math.sin(bobT * .5) * .006 * bob + (Math.random() - .5) * tr * .02, 'YXZ');
  // fov + zoom
  const base = camera.aspect < .75 ? 80 : 70, w = WEAP[W.cur], st = W.st[W.cur];
  const zoom = G.binoc ? 7 : lerp(1, st.zoom, G.ads);
  G.scoped = w.key === 'rifle' && G.ads > .88 && !G.binoc;
  const fov = G.scoped ? base / st.zoom : base / zoom; if (Math.abs(camera.fov - fov) > .01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  if (G.scoped && G.scopeFov !== fov) { G.scopeFov = fov; hud.resize(); }
  hud.scope(G.scoped); if (G.scoped) { const hit = world.ray(P.eye(), camForward(new V3()), 800, { trees: true }); hud.range('scope', (hit ? Math.round(hit.t) : '---') + ' m · ' + st.zoom + 'x'); }
  // viewmodel
  const g = w.gun; g.root.visible = G.state === 'play' && !G.scoped && !G.binoc && G.phase !== 'intro';
  const gs = camera.aspect < .75 ? .8 : 1; g.root.scale.setScalar(gs);
  const sightY = g.sight * gs, adsPos = new V3(0, -sightY, (w.key === 'rifle' ? -.44 : w.key === 'smg' ? -.32 : -.36) * gs);
  const t = G.ads; const pos = new V3().lerpVectors(w.hip.clone().multiplyScalar(gs), adsPos, t);
  const swayX = Math.sin(bobT) * .012 * bob, swayY = -Math.abs(Math.cos(bobT)) * .01 * bob;
  W.vk = (W.vk || 0) * Math.max(0, 1 - dt * 14);
  pos.x += swayX; pos.y += swayY + (W.swapT > 0 ? -W.swapT * .6 : 0) + (P.sprint ? -.03 : 0); pos.z += W.vk * .6;
  g.root.position.copy(pos);
  let rx = W.vk * 1.2 + (P.sprint ? -.25 : 0), rz = P.sprint ? .35 : 0, ry = P.sprint ? .3 : 0;
  if (W.reloadT > 0) { const k = 1 - W.reloadT / w.reload, a = Math.sin(Math.min(1, k * 1.15) * Math.PI); rx += a * .35; rz += a * .5; g.mag.position.y = g.magHome.y - Math.sin(clamp(k * 2.2, 0, 1) * Math.PI) * .3; } else g.mag.position.copy(g.magHome);
  if (W.boltT > 0 && w.key === 'rifle') { const k = W.boltT / .7; rz += Math.sin(k * Math.PI) * .25; rx += Math.sin(k * Math.PI) * .1; }
  g.root.rotation.set(rx, ry, rz);
  if (W.flashT > 0) { W.flashT -= dt; if (W.flashT <= 0) { flashMesh.visible = false; muzzleLight.intensity = 0; } }
  G.spreadPx = (lerp(w.spread, w.ads, G.ads) + W.bloom) * innerHeight * 3 + Math.hypot(P.vel.x, P.vel.z) * 2;
}

// ------------------------------------------------------------------ markers for the HUD
const C_OBJ = '#ffd23a', C_LZ = '#5dff8a';
G.markers = () => {
  const out = []; if (!run || G.phase === 'menu') return out;
  for (const o of objs) { if (o.done && !o.armed) continue; if (o.type === 'kill') { if (o.e.alive) out.push({ p: o.e.p.clone().add(new V3(0, 6, 0)), color: C_OBJ, label: `${o.label} ${Math.round(o.e.p.distanceTo(P.p))} m`, compass: true, mini: 4 }); continue; }
    out.push({ p: o.p.clone().add(new V3(0, 1.4, 0)), color: o.armed ? '#ff3b5c' : C_OBJ, label: o.armed ? `${Math.ceil(o.fuse)}` : `${o.label} ${Math.round(o.p.distanceTo(P.p))} m`, compass: true, mini: 4 }); }
  if (run.uploading) out.push({ p: world.props.terminal.clone().add(new V3(0, 2, 0)), color: '#3fe6ff', label: `UPLOAD ${Math.floor(run.upload * 100)}%`, compass: true, mini: 4 });
  if (run.exfil) out.push({ p: run.exfil.to.clone().add(new V3(0, 3, 0)), color: C_LZ, label: `${LZS[C0.lz].name} ${Math.round(run.exfil.to.distanceTo(P.p))} m`, compass: true, mini: 5 });
  else if (run.objDone || C0.obj !== 'carry') { const lz = LZS[C0.lz]; out.push({ p: new V3(lz.x, world.h(lz.x, lz.z) + 3, lz.z), color: 'rgba(93,255,138,.55)', label: '', shape: 'tri', size: 6, always: false, compass: run.objDone, mini: 3 }); }
  for (const e of enemies.list) if (e.marked && e.alive) out.push({ p: e.p.clone().add(new V3(0, (e.T.fly ? .8 : e.T.height + .5), 0)), color: e.state === 'combat' ? '#ff3b5c' : '#ff9a22', label: e.p.distanceTo(P.p) > 25 ? Math.round(e.p.distanceTo(P.p)) + '' : '', shape: 'tri', size: 7, always: false, compass: true });
  for (const c of crates) if (!c.open) { const d = c.root.position.distanceTo(P.p); if (d < 45) out.push({ p: c.root.position.clone().add(new V3(0, 1, 0)), color: RARITY[c.rar].c, label: '', shape: 'dot', size: 8, always: false, mini: 2.2 }); }
  return out;
};

// ------------------------------------------------------------------ main loop
let last = performance.now(), menuT = 0, fpsAcc = 0, fpsN = 0;
G.fps = 60;
const menuCam = { a: .4 };
function frame(now) {
  requestAnimationFrame(frame);
  const raw = (now - last) / 1000, dt = Math.min(.05, raw); last = now; fpsAcc += raw; fpsN++; if (fpsAcc > 1) { G.fps = fpsN / fpsAcc; fpsAcc = fpsN = 0; }
  if (G.state === 'play' || G.state === 'won' || G.state === 'lost') {
    if (G.state === 'play') G.time += dt;
    if (G.phase === 'intro') {
      run.intro -= dt; const k = 1 - Math.max(0, run.intro) / 3.4, e = 1 - Math.pow(1 - k, 3);
      const eye = P.eye(), f = camForward(new V3()), from = eye.clone().addScaledVector(f, -38).add(new V3(0, 46, 0));
      camera.position.lerpVectors(from, eye, e); camera.rotation.set(lerp(-.9, P.pitch, e), P.yaw, 0, 'YXZ');
      const fv = camera.aspect < .75 ? 80 : 70; if (camera.fov !== fv) { camera.fov = fv; camera.updateProjectionMatrix(); }
      if (run.intro <= 0) { G.phase = 'active'; hud.el.keys.style.opacity = 1; setTimeout(() => hud.el.keys.style.opacity = 0, 14000); hud.banner(C0.name.toUpperCase(), C0.where, '#ffd23a', 2.2); showGun(); hud.el.lock.style.display = !TOUCH && document.pointerLockElement !== cv ? 'block' : 'none'; }
    } else if (G.phase === 'active') {
      run.time -= dt; if (run.time <= 0) { run.time = 0; endRun(false, 'WINDOW CLOSED', 'Kite-6 had to leave without you'); }
      updatePlayer(dt); updateBinoc(dt); updateInteract(dt); updateObjectives(dt); updateCamera(dt);
    } else if (G.phase === 'done') { if (!P.alive) { camera.position.y = lerp(camera.position.y, P.p.y + .3, dt * 3); camera.rotation.z = lerp(camera.rotation.z, .6, dt * 3); } else updateObjectives(dt); }
    updateBullets(dt); updateNades(dt); enemies.update(dt);
    const [ot, os] = objText(); if (G.state === 'play') { hud.objective(ot, os); hud.timer(run.time); }
    // music intensity
    let I = 0; for (const e of enemies.list) if (e.alive) { if (e.state === 'combat' && G.time - e.lastSeen < 10) I = 1; else if (e.aw > .3) I = Math.max(I, .5); }
    if (run && run.exfil) I = Math.max(I, .6); audio.intensity += (I - audio.intensity) * Math.min(1, dt * .8);
    let eng = 0; for (const s of enemies.ships) eng = Math.max(eng, 60 / (s.p.distanceTo(P.p) + 20)); const spill = world.spillSrc.distanceTo(P.p);
    audio.loops({ engine: Math.min(1, eng), water: Math.min(.18, 10 / (spill + 20)), rotor: run && run.exfil ? Math.min(1, 40 / (run.exfil.p.distanceTo(P.p) + 10)) : 0 });
    for (const c of crates) { if (c.open && c.t < 1) { c.t = Math.min(1, c.t + dt * 4); c.lid.rotation.x = -c.t * 1.9; c.beam.material.opacity = .32 * (1 - c.t); } else if (!c.open) { c.beam.scale.y = 1 + Math.sin(G.time * 3) * .04; c.beam.material.opacity = .32 * clamp((c.root.position.distanceTo(camera.position) - 3) / 10, 0, 1); } }
  } else {
    // title: slow orbit over the dam
    menuT += dt; const portrait = camera.aspect < .75;
    camera.position.copy(menuCam.pos).add(new V3(Math.sin(menuT * .07) * 5, Math.sin(menuT * .2) * .6 + (portrait ? 2.5 : 0), portrait ? 2 : 0)); camera.lookAt(menuCam.target.x, menuCam.target.y + (portrait ? -2.5 : 1), menuCam.target.z);
    const fv = camera.aspect < .75 ? 70 : 52; if (camera.fov !== fv) { camera.fov = fv; camera.updateProjectionMatrix(); }
    enemies.update(dt);
  }
  const fd = G.state === 'ready' ? .0009 : .0016; scene.fog.density = fd; world.grass.uniforms.uDen.value = fd;
  world.followSun(camera.position); world.update(dt, camera); fx.update(dt);
  hud.draw(dt);
  renderer.info.reset(); C.render(dt);
}
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); C.resize(innerWidth, innerHeight); });
// a few ambient patrols on the title screen so the valley feels alive
function menuDressing() {
  const bx = riverX(30) + 26, e1 = enemies.spawn('bulwark', bx, 22, { patrol: 2, yaw: 3.6 }), e2 = enemies.spawn('picket', bx - 7, 34, { patrol: 2, yaw: 3.3 }), e3 = enemies.spawn('strider', bx + 6, 36, { patrol: 3, yaw: 3.0 });
  enemies.spawn('kestrel', bx - 10, 30, { patrol: 12 }); enemies.spawn('picket', DAM_X - 20, DAM_Z, { route: [new V3(DAM_X - 60, 0, DAM_Z), new V3(DAM_X + 40, 0, DAM_Z)] }).p.y = CREST;
  menuCam.target = new V3(bx - 4, world.h(bx, 26) + 3.5, 24); menuCam.pos = new V3(bx + 14, world.h(bx + 14, 52) + 3.2, 52);
}
showMenu();
requestAnimationFrame(frame);

window.__game = {
  get state() { return G.state; }, get level() { return run ? run.idx + 1 : S.get('unlocked', 0) + 1; }, get score() { return run ? run.score : 0; },
  // arcade auto-start: drop straight into the next unlocked contract
  autostart() { if (G.state !== 'ready') return; startContract(D.isDaily ? 5 : Math.min(S.get('unlocked', 0), 4)); },
  bot, G, get info() { return { fps: G.fps, calls: renderer.info.render.calls, tris: renderer.info.render.triangles, enemies: enemies.list.filter(e => e.alive).length, phase: G.phase, hp: P.hp, time: run && run.time, bot: G.botDbg, kills: run && run.kills, p: P.p.toArray().map(Math.round) }; },
};
