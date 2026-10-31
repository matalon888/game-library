// Flip Agent v2 (deep) — the same somersault shooter, with 30 hand-made missions in 3 worlds (levels.js), mission stars (clear /
// no wasted bullet / a trick), riot-shield goons and bosses, a level map and agent suits. Plan: DESIGN.md. v1 is v1.js.
// The agent runs and somersaults over gaps in slow motion; his laser sight sweeps with the spin. Tap = one bullet along the laser.
// Clear every masked goon before you land, never hit a hostage. Steel ricochets, barrels explode.
import { THREE, createStage, createUI, input, loop, sfx, tone, buzz, store, rng, lerp, clamp, mat, glossy, rounded, confetti } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { adapter } from './kit/adapt.js';
import { board as worldBoard } from './kit/board.js';
import { particles } from './fx.js';
import { LEVELS, WORLDS, SUITS, worldOf, hitsOf, slackOf, TRICK_TXT } from './levels.js';

const stage = createStage({ fov: 40, shadows: true, shadowSize: 14 });
const { scene, camera, renderer } = stage;
const ui = createUI({ title: 'FLIP<br>AGENT', hint: 'Tap when the laser turns green', hand: '👆' });
const save = store('flipagent2');
const FL = flow('flipagent');
const WB = worldBoard({ game: 'flip-agent', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 0.6 }, mode: 'sum' });
let fk = 1;
// ------------------------------------------------------------------ in-round adaptation (ADAPT_BRIEF.md): honest + bounded
// Reads ONLY how this player is playing right now: good/bad moves in the last 20 s and time since the last success.
// level −1 (struggling) … +1 (cruising) moves ≤ 0.25 per 3 s and drifts back to 0 when neutral. k(fk) = multiplier for a
// harder-when-bigger knob: ±20 %, and together with flow.js's between-run nudge it stays within ±25 %. Rescues: at most one
// per round and 60 s apart, only for a player who has been playing sensibly (never for an idle one). QA reads window.__game.adapt.
const AD = adapter(); let tapAt = 0, flipTaps = 0, rescueFlip = false;
const N = LEVELS.length;
const SAVE = { stars: save.get('stars', {}), unlocked: save.get('unlocked', 1), suit: save.get('suit', 0), seenSuits: save.get('seen', 1), day: save.get('day', ''), streak: save.get('streak', 0), stickers: save.get('stickers', []), dday: save.get('dday', ''), dwins: save.get('dwins', 0) };
const fails = {};   // consecutive losses per mission (a rescue bullet after 2)
const STICKERS = ['🕶️', '🎩', '🦆', '🍩', '🚁', '💎', '🧨', '🛰️', '🐙', '🍕', '🪙', '🏆'];   // pulled at random from a 3-star mission (a golden goon adds a pull)
const sv = k => save.set(k === 'seenSuits' ? 'seen' : k, SAVE[k]);
function pullSticker() { const free = STICKERS.map((e, i) => i).filter(i => !SAVE.stickers.includes(i)); if (!free.length) return null; const i = free[Math.floor(Math.random() * free.length)]; SAVE.stickers.push(i); sv('stickers'); return i; }
const totalStars = () => Object.values(SAVE.stars).reduce((a, b) => a + b, 0);
let level = +new URLSearchParams(location.search).get('level') || Math.min(SAVE.unlocked, save.get('level', 1)), best = save.get('best', 0), score = 0, state = 'ready';
const firstTime = () => !SAVE.stars[1];   // level 1 before it was ever cleared: the agent helps (fires on his own once the laser is green)

// ------------------------------------------------------------------ themes (sky gradient, rooftop colours, sea)
const THEMES = [
  { sky: ['#7cc8ff', '#d8f3ff'], top: '#f2cf9c', side: '#b97b4f', sea: '#5cc6e6', city: '#a9c3e8', stripe: '#3d6fe0', ui: '#2f7bff', fog: '#cdeeff' },
  { sky: ['#2f3a7a', '#8d6fc0'], top: '#4fb7a8', side: '#25706d', sea: '#3a4c8a', city: '#5b4f98', stripe: '#e8443a', ui: '#4fb7a8', fog: '#7a68b4' },
  { sky: ['#ff9fbd', '#ffe3c4'], top: '#cfe6ff', side: '#7b8fd6', sea: '#ff9dbb', city: '#f6b7cf', stripe: '#7b4cff', ui: '#ff5d8f', fog: '#ffd2cf' },
  { sky: ['#8fe0c8', '#f2fbe6'], top: '#f7e3bf', side: '#cf9160', sea: '#4fc9b0', city: '#a6d8c6', stripe: '#ff7a1a', ui: '#2fa889', fog: '#dff6e8' },
];
let TH = THEMES[0];
function applyTheme(n) {
  TH = THEMES[(n - 1) % THEMES.length];
  const s = document.body.style; s.setProperty('--bg1', TH.sky[0]); s.setProperty('--bg2', TH.sky[1]); s.setProperty('--ui', TH.ui);
  s.background = `linear-gradient(180deg,${TH.sky[0]},${TH.sky[1]} 70%)`;
  scene.fog.color.set(TH.fog); seaMat.color.set(TH.sea); cityMesh.material.color.set(TH.city);
  M.top.color.set(TH.top); M.side.color.set(TH.side); stripeTex(TH.stripe);
}

// ------------------------------------------------------------------ DOM extras: ammo pill + slow-mo vignette
const css = document.createElement('style');
css.textContent = `
.fa-ammo{position:fixed;left:12px;top:calc(170px + env(safe-area-inset-top));width:34px;padding:8px 0;border-radius:20px;background:rgba(30,40,70,.55);
  display:flex;flex-direction:column;align-items:center;gap:3px;z-index:5;pointer-events:none;box-shadow:0 3px 0 rgba(0,0,0,.15)}
.fa-ammo span{font-weight:800;font-size:16px;line-height:1;margin-bottom:2px}
.fa-ammo b{display:block;width:12px;height:19px;border-radius:7px 7px 2px 2px;background:linear-gradient(90deg,#ffe066,#f5b301);box-shadow:inset 0 -4px 0 #c98a00;transition:transform .15s,opacity .15s}
.fa-ammo b.off{background:#556;box-shadow:none;opacity:.45;transform:scale(.8)}
.fa-vig{position:fixed;inset:0;pointer-events:none;z-index:3;opacity:0;transition:opacity .15s;background:radial-gradient(ellipse at 50% 50%,rgba(255,255,255,0) 50%,rgba(255,255,255,.55) 100%)}
.hc-card h1{letter-spacing:1px}
.hc-score{text-shadow:0 4px 0 rgba(20,40,90,.35),0 0 18px rgba(20,40,90,.25)}.hc-sub{text-shadow:0 2px 0 rgba(20,40,90,.35)}
.hc-pop{text-shadow:0 3px 0 rgba(0,0,0,.25),0 0 14px rgba(0,0,0,.18)!important}`;
document.head.appendChild(css);
const ammoEl = Object.assign(document.createElement('div'), { className: 'fa-ammo' });
const vig = Object.assign(document.createElement('div'), { className: 'fa-vig' });
document.body.append(ammoEl, vig);
function drawAmmo() { const n = Math.min(8, ammoMax), on = Math.min(n, ammo); ammoEl.innerHTML = `<span>${ammo}</span>` + Array.from({ length: n }, (_, i) => `<b class="${i < n - on ? 'off' : ''}"></b>`).join(''); }

// ------------------------------------------------------------------ world backdrop: sea, distant city, clouds
scene.fog = new THREE.Fog('#cdeeff', 45, 150);
const seaMat = new THREE.MeshBasicMaterial({ color: '#5cc6e6' });
const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 400), seaMat); sea.rotation.x = -Math.PI / 2; sea.position.set(0, -13, -120); scene.add(sea);
const cityMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#a9c3e8' }), 70);
{ const r = rng(42), m = new THREE.Matrix4(); for (let i = 0; i < 70; i++) { const h = 6 + r() * 22, w = 4 + r() * 7; m.compose(new THREE.Vector3(-60 + i * 6 + r() * 3, -13 + h / 2, -60 - r() * 25), new THREE.Quaternion(), new THREE.Vector3(w, h, 4)); cityMesh.setMatrixAt(i, m); } }
scene.add(cityMesh);
const cloudMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false, transparent: true, opacity: 0.85 }), 60);
{ const r = rng(7), m = new THREE.Matrix4(); for (let i = 0; i < 60; i++) { const c = Math.floor(i / 4), s = 2 + r() * 2.5; m.compose(new THREE.Vector3(-50 + c * 22 + (i % 4) * 2.4 + r(), 2 + (c % 3) * 3.5 + r() * 1.5, -58), new THREE.Quaternion(), new THREE.Vector3(s * 1.4, s * 0.8, 1)); cloudMesh.setMatrixAt(i, m); } }
scene.add(cloudMesh);

// ------------------------------------------------------------------ materials / geometry
const M = {
  top: mat('#f2cf9c'), side: mat('#b97b4f'), steel: glossy('#7d8ca8', { metalness: 0.35 }), steelDark: mat('#4d5872'),
  crate: mat('#cf7f45'), crateDark: mat('#9c5a2c'), barrel: glossy('#ec3b2f'), band: mat('#fff3d6'),
  suit: mat('#24242c'), white: mat('#ffffff', { roughness: 0.35 }), black: mat('#16161c'), tie: mat('#e8333a'), gun: mat('#2b2b33', { roughness: 0.3 }),
  boss: mat('#8a1020'), hostShirt: mat('#ff7eb3'), hostSkin: mat('#ffd7ba'), hair: mat('#8a4b22'), cable: mat('#3b3f4a'), hazard: mat('#ffd23f'),
};
const stripeCanvas = document.createElement('canvas'); stripeCanvas.width = 8; stripeCanvas.height = 64;
const stripeMap = new THREE.CanvasTexture(stripeCanvas); stripeMap.wrapS = stripeMap.wrapT = THREE.RepeatWrapping; stripeMap.colorSpace = THREE.SRGBColorSpace;
function stripeTex(c) { const x = stripeCanvas.getContext('2d'); for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#ffffff' : c; x.fillRect(0, i * 8, 8, 8); } stripeMap.needsUpdate = true; }
M.stripe = mat('#ffffff', { map: stripeMap }); M.gold = mat('#ffc928');
const G = {
  torso: new THREE.CapsuleGeometry(0.22, 0.4, 6, 14), head: new THREE.SphereGeometry(0.27, 22, 16), limb: new THREE.CapsuleGeometry(0.08, 0.4, 4, 10),
  band: new THREE.CylinderGeometry(0.275, 0.275, 0.1, 24, 1, true), cap: new THREE.SphereGeometry(0.285, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.42),
  gun: rounded(0.36, 0.13, 0.1, 0.03), grip: new THREE.BoxGeometry(0.07, 0.14, 0.08), tie: new THREE.BoxGeometry(0.05, 0.28, 0.05),
  bullet: new THREE.CapsuleGeometry(0.06, 0.18, 4, 8), barrel: new THREE.CylinderGeometry(0.42, 0.42, 1.0, 22), bandG: new THREE.CylinderGeometry(0.43, 0.43, 0.12, 22),
  cableG: new THREE.CylinderGeometry(0.03, 0.03, 1, 6), flash: new THREE.SphereGeometry(0.22, 12, 8),
};
M.band.side = THREE.DoubleSide;
const fx = particles(scene, { max: 700 });
const sparks = particles(scene, { max: 300, additive: true });

// ------------------------------------------------------------------ figures (side view: forward = local +x, limbs swing with rotation.z)
function figure(kind, look = '') {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const shirt = kind === 'agent' ? M.suit : kind === 'hostage' ? M.hostShirt : look === 'boss' ? M.boss : look === 'gold' ? M.gold : M.stripe, skin = kind === 'hostage' ? M.hostSkin : M.white;
  const add = (geo, m, parent, x, y, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
  const torso = add(G.torso, shirt, body, 0, 0.95), head = add(G.head, skin, body, 0.02, 1.55);
  if (kind === 'enemy') { const b = add(G.band, M.black, head, 0, 0.04); b.castShadow = false; }
  if (kind === 'agent') { const c = add(G.cap, M.black, head, -0.03, 0.02); c.rotation.z = 0.35; add(G.tie, M.tie, body, 0.2, 1.02).rotation.z = 0.1; }
  if (kind === 'hostage') { const c = add(G.cap, M.hair, head, -0.02, 0.03); c.rotation.z = 0.25; }
  const piv = (x, y, z) => { const p = new THREE.Group(); p.position.set(x, y, z); body.add(p); return p; };
  const limbM = kind === 'agent' ? M.suit : shirt;
  const aL = piv(0, 1.24, -0.27), aR = piv(0, 1.24, 0.27), lL = piv(0, 0.66, -0.11), lR = piv(0, 0.66, 0.11);
  add(G.limb, limbM, aL, 0, -0.28); add(G.limb, limbM, aR, 0, -0.28); add(G.limb, kind === 'enemy' ? M.black : limbM, lL, 0, -0.3); add(G.limb, kind === 'enemy' ? M.black : limbM, lR, 0, -0.3);
  let gun = null;
  if (kind !== 'hostage') { gun = new THREE.Group(); gun.position.set(0, -0.6, 0); aR.add(gun); const gm = add(G.gun, M.gun, gun, 0, -0.08); gm.rotation.z = -Math.PI / 2; add(G.grip, M.gun, gun, 0.06, 0.02); }
  return { g, body, torso, head, aL, aR, lL, lR, gun };
}
// arm angle helper: point a limb at world-ish angle phi (0 = forward, + = up)
const aim = (piv, phi) => { piv.rotation.z = phi + Math.PI / 2; };

// ------------------------------------------------------------------ level state
let world = [];          // meshes to clear
let solids = [];         // {x0,x1,y0,y1,metal}
let actors = [];         // enemies + hostages: {kind,x,y,z,fig,alive,stage,face,vx,vy,w}
let barrels = [];        // {x,y,mesh,alive,stage}
let bullets = [], tracers = [], flashes = [];
let S = { wasted: 0, head: 0, boom: 0, ric: 0, multi: 0, chain: 0 }, killCam = null, slowUntil = 0;   // S = this mission's star counters
let plat = [], stages = [], stageIdx = 0, ammo = 0, ammoMax = 0, kills = 0, totalEnemies = 0, flipKills = 0;
const agent = { fig: figure('agent'), x: 0, y: 0, phase: 'idle', t: 0, spin: 0, jump: null, squash: 0, dead: false, vx: 0, vy: 0 };
scene.add(agent.fig.g);
agent.fig.body.position.y = -0.95;    // pivot at body centre so flips spin around the waist
let timeScale = 1, tsTarget = 1, shake = 0;

function addMesh(m, shadow = true) { m.castShadow = shadow; m.receiveShadow = true; scene.add(m); world.push(m); return m; }
function block(x0, x1, y0, y1, z0 = -4, z1 = 2.2) {     // rooftop / cliff
  const w = x1 - x0, h = y1 - y0, d = z1 - z0;
  const m = addMesh(new THREE.Mesh(rounded(w, h, d, 0.12), [M.side, M.top]), false);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); m.receiveShadow = true;
  // ledge trim (lighter cap) for the toy look
  const cap = addMesh(new THREE.Mesh(rounded(w + 0.12, 0.22, d + 0.12, 0.08), M.top), false); cap.position.set((x0 + x1) / 2, y1 - 0.08, (z0 + z1) / 2);
  solids.push({ x0, x1, y0, y1, metal: false });
}
function girder(cx, y, w = 2.8, hang = true) {          // floating steel beam (metal → ricochet)
  const m = addMesh(new THREE.Mesh(rounded(w, 0.34, 1.0, 0.06), M.steel)); m.position.set(cx, y - 0.17, 0);
  for (let i = 0; i < Math.floor(w / 0.7); i++) { const s = addMesh(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.06), M.steelDark), false); s.position.set(cx - w / 2 + 0.35 + i * 0.7, y - 0.17, 0.52); s.rotation.z = 0.7; }
  if (hang) for (const s of [-1, 1]) { const c = addMesh(new THREE.Mesh(G.cableG, M.cable), false); c.scale.y = 30; c.position.set(cx + s * (w / 2 - 0.3), y + 15, 0); }
  solids.push({ x0: cx - w / 2, x1: cx + w / 2, y0: y - 0.34, y1: y, metal: true });
}
function plate(x, y0, h) {                               // standing steel plate (ricochet wall)
  const m = addMesh(new THREE.Mesh(rounded(0.36, h, 1.6, 0.06), M.steel)); m.position.set(x, y0 + h / 2, -0.2);
  const st = addMesh(new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.2, 1.62), M.hazard), false); st.position.set(x, y0 + h - 0.35, -0.2);
  solids.push({ x0: x - 0.18, x1: x + 0.18, y0, y1: y0 + h, metal: true });
}
function crate(x, y, s = 1.1, z = 0) {
  const m = addMesh(new THREE.Mesh(rounded(s, s, s, 0.06), M.crate)); m.position.set(x, y + s / 2, z);
  for (const k of [-1, 1]) { const p = addMesh(new THREE.Mesh(new THREE.BoxGeometry(s * 0.98, 0.1, 0.04), M.crateDark), false); p.position.set(x, y + s / 2 + k * s * 0.3, z + s / 2 + 0.01); }
  const d = addMesh(new THREE.Mesh(new THREE.BoxGeometry(s * 1.2, 0.1, 0.04), M.crateDark), false); d.position.set(x, y + s / 2, z + s / 2 + 0.02); d.rotation.z = 0.78;
  if (z === 0) solids.push({ x0: x - s / 2, x1: x + s / 2, y0: y, y1: y + s, metal: false });
  return y + s;
}
function barrel(x, y, st) {
  const g = new THREE.Group(); g.position.set(x, y, 0.2);
  const b = new THREE.Mesh(G.barrel, M.barrel); b.position.y = 0.5; b.castShadow = true; g.add(b);
  for (const yy of [0.25, 0.75]) { const r = new THREE.Mesh(G.bandG, M.band); r.position.y = yy; g.add(r); }
  const sign = new THREE.Mesh(new THREE.CircleGeometry(0.16, 3), M.hazard); sign.position.set(0, 0.5, 0.43); sign.rotation.z = Math.PI / 2; g.add(sign);
  scene.add(g); world.push(g); barrels.push({ x, y, mesh: g, alive: true, stage: st });
}
let bossHp = 2, fever = false, goldSeen = 0, goldMade = false;
function person(kind, x, y, st, z = 0, o = {}) {
  if (kind === 'enemy' && !o.boss && !o.shield && ((level >= 4 && Math.random() < 0.1) || (level >= 3 && level <= 6 && goldSeen === 0 && !goldMade))) { o.gold = true; goldMade = true; }   // a rare golden goon: same fight, big payout
  const f = figure(kind, o.boss ? 'boss' : o.gold ? 'gold' : ''); f.g.position.set(x, y, z); if (o.boss) f.g.scale.setScalar(1.3); scene.add(f.g); world.push(f.g);
  const a = { kind, x, y, z, fig: f, alive: true, stage: st, face: -1, vx: 0, vy: 0, w: 0, t: Math.random() * 6, dead: 0, hp: o.boss ? bossHp : 1, hp0: o.boss ? bossHp : 1, sc: o.boss ? 1.3 : 1, hurt: 0, shield: null, gold: !!o.gold };
  if (o.shield) {   // riot shield on the side the agent comes from: a steel solid (bullets bounce) covering the body, the head stays open
    const side = o.side || -1, sm = new THREE.Mesh(rounded(0.24, 0.95, 0.9, 0.06), M.steel); sm.position.set(side * 0.62, 0.7, 0); sm.castShadow = true; f.g.add(sm);
    const sc = a.sc, sol = { x0: x + side * 0.62 * sc - 0.12 * sc, x1: x + side * 0.62 * sc + 0.12 * sc, y0: y + 0.22 * sc, y1: y + 1.17 * sc, metal: true, owner: a };
    solids.push(sol); a.shield = { mesh: sm, sol };
  }
  if (kind === 'hostage') { aim(f.aL, 1.25); aim(f.aR, 1.25); }
  actors.push(a); if (kind === 'enemy') totalEnemies++; return a;
}

// ------------------------------------------------------------------ procedural level (seeded, endless)
function buildLevel() {
  for (const m of world) scene.remove(m);
  for (const b of bullets) scene.remove(b.m); for (const t of tracers) scene.remove(t.m); for (const f of flashes) scene.remove(f.m);
  AD.round(); S = { wasted: 0, head: 0, boom: 0, ric: 0, multi: 0, chain: 0 }; killCam = null; slowUntil = 0; fever = false; goldMade = false;
  world = []; solids = []; actors = []; barrels = []; bullets = []; tracers = []; flashes = []; plat = []; stages = [];
  totalEnemies = 0; kills = 0; stageIdx = 0; flipKills = 0;
  const L = LEVELS[level - 1];   // authored mission (1-30) or a generated contract after it
  bossHp = L?.hp || 2;
  applyTheme(L ? L.th + 1 : level);
  fk = FL.k(); const r = rng(level * 977 + 31), pick = (a) => a[Math.floor(r() * a.length)];
  const nst = L ? L.st.length : level === 1 ? 1 : level <= 3 ? 2 : level <= 7 ? 3 : 4;   // level 1: one flip, one goon — a near-sure first win
  let x = -14, top = 0, len = 14;
  plat.push({ a: x, b: x + len, top }); block(x, x + len, -16, top);
  for (let s = 0; s < nst; s++) {
    const SP = L && L.st[s], R = SP ? () => 0.5 : r, prev = plat[plat.length - 1], gap = SP ? (SP.gap ?? 4.6) : 4.2 + r() * 0.9;
    const ntop = SP ? clamp(prev.top + (SP.dy || 0), -2.5, 2.5) : level === 1 ? prev.top : clamp(prev.top + pick([-1.4, -0.8, 0, 0.8, 1.4]), -2.5, 2.5), nlen = s === nst - 1 ? 14 : SP ? 8.5 : 7 + r() * 2.5;
    const a = prev.b + gap, b = a + nlen; plat.push({ a, b, top: ntop }); block(a, b, -16, ntop);
    const H = prev.top, T = ntop, J = prev.b, mid = J + gap / 2, hi = Math.max(H, T);
    const n = level <= 3 ? 1 : level <= 6 ? 2 : level <= 8 ? 2 + (r() < 0.35 ? 1 : 0) : clamp(Math.round((2 + Math.floor((level - 7) / 2) + (r() < 0.35 ? 1 : 0)) * fk), 2, 6);
    const slots = ['far', 'far2', 'girder', 'below', 'crate', 'high'];
    if (level === 1) slots.splice(1);       // first flip: one goon standing on the far roof, right where the laser starts
    else if (level <= 4) slots.splice(3);   // gentle ramp: ground + one girder
    const used = new Set(), spots = SP ? SP.g.map(x => x.split(':')[0]) : [];
    while (!SP && spots.length < n && used.size < slots.length) { const sl = pick(slots); if (used.has(sl)) continue; used.add(sl); spots.push(sl); }
    const placed = [];
    const st = { J, L: a, H, T, mid, gap, enemies: [], hostages: 0, cleared: false };
    for (const [gi, sl] of spots.entries()) {
      let ex, ey;
      if (sl === 'far') { ex = a + 2.0 + R() * 0.8; ey = T; }
      else if (sl === 'far2') { ex = a + 3.2 + R() * 0.6; ey = T; }
      else if (sl === 'crate') { ex = a + 3.0 + R() * 1.5; ey = crate(ex, T, 1.1, 0); }
      else if (sl === 'girder') { ex = mid + 1.3 + R() * 0.9; ey = hi + 4.3 + R() * 0.6; girder(ex, ey, 1.3); }
      else if (sl === 'high') { ex = J - 2.2 - R() * 1.0; ey = H + 4.6 + R() * 0.6; girder(ex, ey, 1.3); }
      else { ex = mid + (R() - 0.5) * 1.2; ey = Math.min(H, T) - 3.4 - R() * 0.6; girder(ex, ey, 2.8, true); }
      const kd = SP ? SP.g[gi].split(':')[1] : level > N && /^(far|far2|crate)$/.test(sl) && r() < 0.3 ? 's' : '';
      const e = person('enemy', ex, ey, s, 0, { boss: kd === 'b', shield: kd === 's', side: ex < J ? 1 : -1 }); placed.push({ e, sl }); st.enemies.push(e);
    }
    // de-overlap ground enemies vs crates
    if (!SP) for (const p of placed) for (const q of placed) if (p !== q && Math.abs(p.e.x - q.e.x) < 0.9 && Math.abs(p.e.y - q.e.y) < 0.5) { q.e.x += 1.0; q.e.fig.g.position.x = q.e.x; }
    // hostage next to one enemy (level 2+)
    if (SP) {
      for (const [gi, side] of SP.h || []) { const g = placed[gi].e; person('hostage', g.x + side * 0.85, g.y, s); st.hostages++; }
      for (const dx of SP.b || []) barrel(a + dx, T, s);
      for (const { dx, h } of SP.pl || []) plate(b - dx, T, h);
    } else {
    if (level >= 3 && r() < 0.55 + Math.min(0.3, level * 0.03)) {
      const host = pick(placed), side = r() < 0.5 ? -1 : 1;
      person('hostage', host.e.x + side * 0.85, host.e.y, s); st.hostages++;
    }
    if (level >= 5 && r() < 0.5) barrel(a + 1.0, T, s);
    if (level >= 4 && r() < 0.45) plate(b - 0.5, T, 3.6);
    }
    stages.push(st);
  }
  for (const p of plat) { const dr = rng(Math.floor(p.a * 13) + level);
    for (let x = p.a + 1.2; x < p.b - 1; x += 2.5 + dr() * 3) { if (dr() < 0.5) crate(x, p.top, 0.9 + dr() * 0.4, -2.6); else { const u = addMesh(new THREE.Mesh(rounded(1.3, 0.9, 1.0, 0.1), M.band)); u.position.set(x, p.top + 0.45, -2.8); const f = addMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 16), M.steelDark), false); f.rotation.x = Math.PI / 2; f.position.set(x + 0.2, p.top + 0.45, -2.27); } }
    const lad = addMesh(new THREE.Mesh(new THREE.BoxGeometry(0.08, 6, 0.08), M.steelDark), false); lad.position.set(p.a + 0.9, p.top - 3, 2.25);
    const lad2 = lad.clone(); lad2.position.x += 0.6; scene.add(lad2); world.push(lad2);
    for (let k = 0; k < 9; k++) { const rr = addMesh(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.06), M.steelDark), false); rr.position.set(p.a + 1.2, p.top - 0.4 - k * 0.6, 2.25); } }
  // solvability pass: every goon must be hittable at some moment of its stage's flip, else drop it (authored missions are checked by qa/levels.cjs instead)
  for (let si = 0; !L && si < stages.length; si++) {
    const st = stages[si], p0 = plat[si], J = { x0: st.J - 0.35, y0: st.H, x1: st.L + 0.9, y1: st.T, apex: Math.max(st.H, st.T) + 2.7 }, seen = new Set();
    for (let k = 0; k <= 300; k++) { const P = flipPose(J, JUMP_T * k / 300 * 0.97); const [mx, my, dx, dy] = muzzle(P.x, P.y, P.spin); const h = trace(mx, my, dx, dy, 2, 34).hit; if (h.actor) seen.add(h.actor); }
    for (const e of st.enemies.slice()) if (!seen.has(e)) { scene.remove(e.fig.g); actors.splice(actors.indexOf(e), 1); st.enemies.splice(st.enemies.indexOf(e), 1); totalEnemies--; }
    if (!st.enemies.length) { const e = person('enemy', st.L + 2.2, st.T, si); st.enemies.push(e); }
  }
  // fairness pass: a goon must stay in the sights long enough for a human tap (players were losing to 20-40 ms windows)
  const minMs = level <= 3 ? 700 : level <= 6 ? 380 : 300;
  for (let si = 0; !L && si < stages.length; si++) {
    const st = stages[si];
    for (const e of st.enemies.slice()) if (st.enemies.length > 1 && lockMs(st, e) < minMs) { scene.remove(e.fig.g); actors.splice(actors.indexOf(e), 1); st.enemies.splice(st.enemies.indexOf(e), 1); totalEnemies--; }
    const e = st.enemies[0];
    if (st.enemies.length === 1 && lockMs(st, e) < minMs) for (const dx of [2.0, 2.6, 3.2, 1.6]) {
      if (lockMs(st, e) >= minMs) break;
      const g = actors.find(a => a.kind === 'hostage' && a.stage === si); e.x = st.L + dx; e.y = st.T; e.fig.g.position.set(e.x, e.y, e.z);
      if (g) { g.x = e.x + 0.85; g.y = e.y; g.fig.g.position.set(g.x, g.y, g.z); }
    }
  }
  solids = solids.filter(q => !q.owner || actors.includes(q.owner));   // goons the passes dropped take their shield with them
  // finish line on the last roof
  const last = plat[plat.length - 1];
  const flag = addMesh(new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.6, 0.12), M.steelDark)); flag.position.set(last.a + 7, last.top + 1.3, -0.6);
  const cloth = addMesh(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.04), M.hazard)); cloth.position.set(last.a + 7.55, last.top + 2.2, -0.6);
  ammoMax = L ? hitsOf(level) + slackOf(level) : totalEnemies + 2 + nst; if ((fails[level] || 0) >= (level >= 5 && level <= 8 ? 1 : 2)) ammoMax++; if ((fails[level] || 0) >= 4) ammoMax++;   // stuck: a spare bullet (sooner on the mission 5-8 cliff, two after 4 losses)
  ammo = ammoMax; drawAmmo(); queued = 0;
  agent.x = -6; agent.y = 0; agent.phase = 'idle'; agent.spin = 0; agent.jump = null; agent.dead = false; agent.fig.g.rotation.set(0, 0, 0);
  agent.fig.g.position.set(agent.x, agent.y + 0.95, 0); agent.fig.body.rotation.set(0, -0.45, 0);
  aim(agent.fig.aR, -1.2); aim(agent.fig.aL, -1.4);
  timeScale = tsTarget = 1;
  ui.levels(level); ui.progress(0); ui.score(score); ui.sub('');
  camPos.set(agent.x + 3, agent.y + 5, 24); camAt.set(agent.x + 3, agent.y + 2, 0);
}

// ------------------------------------------------------------------ 2D ray tracing (laser, bullets, bot all share it)
function rayBox(ox, oy, dx, dy, b) {
  let tmin = -Infinity, tmax = Infinity, nx = 0, ny = 0;
  if (Math.abs(dx) < 1e-9) { if (ox < b.x0 || ox > b.x1) return null; } else {
    let t1 = (b.x0 - ox) / dx, t2 = (b.x1 - ox) / dx; if (t1 > t2) [t1, t2] = [t2, t1];
    if (t1 > tmin) { tmin = t1; nx = -Math.sign(dx); ny = 0; } tmax = Math.min(tmax, t2);
  }
  if (Math.abs(dy) < 1e-9) { if (oy < b.y0 || oy > b.y1) return null; } else {
    let t1 = (b.y0 - oy) / dy, t2 = (b.y1 - oy) / dy; if (t1 > t2) [t1, t2] = [t2, t1];
    if (t1 > tmin) { tmin = t1; nx = 0; ny = -Math.sign(dy); } tmax = Math.min(tmax, t2);
  }
  if (tmin > tmax || tmax < 0 || tmin < 0.001) return null;
  return { t: tmin, nx, ny };
}
function rayCircle(ox, oy, dx, dy, cx, cy, r) {
  const fx_ = ox - cx, fy = oy - cy, b = fx_ * dx + fy * dy, c = fx_ * fx_ + fy * fy - r * r, disc = b * b - c;
  if (disc < 0) return null; const t = -b - Math.sqrt(disc); return t > 0.01 ? t : null;
}
const PARTS = [[1.55, 0.3, 'head'], [0.98, 0.38, 'body'], [0.42, 0.3, 'legs']];
function trace(ox, oy, dx, dy, bounces = 2, maxLen = 32) {
  const pts = [[ox, oy]]; let left = maxLen;
  for (let k = 0; k <= bounces; k++) {
    let best = { t: left, type: 'none' };
    for (const s of solids) { const h = rayBox(ox, oy, dx, dy, s); if (h && h.t < best.t) best = { t: h.t, type: s.metal ? 'metal' : 'wall', nx: h.nx, ny: h.ny }; }
    for (const a of actors) { if (!a.alive) continue; for (const [py, pr, part] of PARTS) { const sc = a.sc || 1, t = rayCircle(ox, oy, dx, dy, a.x, a.y + py * sc, pr * sc); if (t !== null && t < best.t) best = { t, type: a.kind, actor: a, part }; } }
    for (const b of barrels) { if (!b.alive) continue; const t = rayCircle(ox, oy, dx, dy, b.x, b.y + 0.5, 0.5); if (t !== null && t < best.t) best = { t, type: 'barrel', barrel: b }; }
    const hx = ox + dx * best.t, hy = oy + dy * best.t; pts.push([hx, hy]); left -= best.t;
    if (best.type === 'metal' && k < bounces && left > 0.5) {
      if (best.nx) dx = -dx; else dy = -dy; ox = hx + dx * 0.01; oy = hy + dy * 0.01; continue;
    }
    return { pts, hit: best };
  }
  return { pts, hit: { type: 'none' } };
}
function muzzle(x = agent.x, y = agent.y, spin = agent.spin) {
  const c = Math.cos(spin), s = Math.sin(spin), cx = x, cy = y + 0.95, lx = 0.85, ly = 0.3;
  return [cx + c * lx - s * ly, cy + s * lx + c * ly, c, s];
}
const JUMP_T = 0.95;
// aim assist: a tap fires at the goon nearest the laser if he is within this angle (and in clear sight). Wide on level 1, tight later.
const ASSIST = [0.9, 0.7, 0.55, 0.45, 0.38, 0.32, 0.28];
const assistAng = () => (ASSIST[level - 1] ?? 0.24) * (level <= 2 ? 1 : 2 - AD.k());   // in-round: up to 20 % wider for a struggling player, 20 % tighter when cruising
const slowMo = () => level === 1 ? 0.17 : level === 2 ? 0.2 : clamp(0.24 * AD.k(fk), 0.19, 0.3);   // lower = slower flip
// Slow-mo follows the laser: deep while a goon is in the sights or about to be, a quicker "cruise" while the sight sweeps
// empty sky (players used to sit through 3 s of slow spin with nothing to hit, tap, and see nothing happen).
const cruise = () => level === 1 ? 0.42 : level <= 3 ? 0.5 : 0.55;
const SLOW_END = 0.97;   // slow-mo (and the shooting) lasts to 97 % of the flip: the landing sweep is where the far-roof goons are
/** real ms that goon e stays locked during stage st's flip (others treated as already shot) */
function lockMs(st, e) {
  const J = { x0: st.J - 0.35, y0: st.H, x1: st.L + 0.9, y1: st.T, apex: Math.max(st.H, st.T) + 2.7 }, others = new Set(actors.filter(a => a !== e)), step = 0.005; let t = 0, ms = 0; aimSt = e.stage;
  for (; t < JUMP_T * SLOW_END; t += step) { const P = flipPose(J, t), A = aimShot(P.x, P.y, P.spin, others); if (A.locked && A.tr.hit.actor === e) ms += step / slowMo() * 1000; }
  aimSt = -1; return ms;
}
// goons/barrels that already have enough bullets in the air (a boss needs hp of them)
function pendingSet() { const c = new Map(); for (const b of bullets) { const t = b.hit.actor || b.hit.barrel; if (t) c.set(t, (c.get(t) || 0) + 1); } return new Set([...c].filter(([t, n]) => n >= (t.hp || 1)).map(([t]) => t)); }
/** the shot a tap would fire right now (or at pose x,y,spin): snapped onto a goon when locked */
// Only the goons of the gap being jumped lock on (green): locking onto the next roof's goon used to let a player "hit",
// see NICE!, and still land in front of the goon who mattered.
let aimSt = -1;   // stage whose goons lock (−1 = the current one); lockMs / lockMap set it while they measure
function aimShot(x = agent.x, y = agent.y, spin = agent.spin, pend = pendingSet()) {
  const [mx, my, dx, dy] = muzzle(x, y, spin), raw = trace(mx, my, dx, dy, 2, 34), si = aimSt >= 0 ? aimSt : stageIdx;
  if (raw.hit.type === 'enemy' && raw.hit.actor.stage === si && !pend.has(raw.hit.actor)) return { mx, my, dx, dy, tr: raw, locked: true };
  let best = null, bd = assistAng();
  for (const a of actors) {
    if (!a.alive || a.kind !== 'enemy' || a.stage !== si || pend.has(a)) continue;
    for (const py of [0.98 * a.sc, 1.55 * a.sc]) {
      const ex = a.x - mx, ey = a.y + py - my, l = Math.hypot(ex, ey); if (l > 30) continue;
      const ux = ex / l, uy = ey / l, d = Math.acos(clamp(ux * dx + uy * dy, -1, 1));
      if (d >= bd) continue;
      const tr = trace(mx, my, ux, uy, 0, 34); if (tr.hit.actor !== a) continue;
      bd = d; best = { mx, my, dx: ux, dy: uy, tr, locked: true };
    }
  }
  return best || { mx, my, dx, dy, tr: raw, locked: false };
}
function flipPose(J, t) {          // position + spin along the jump at game time t
  const u = Math.min(1, t / JUMP_T), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2, k = lerp(u, e, 0.35);
  return { u, x: lerp(J.x0, J.x1, u), y: lerp(J.y0, J.y1, u) + 4 * (J.apex - (J.y0 + J.y1) / 2) * u * (1 - u), spin: -0.4 + k * (Math.PI * 2 + 0.4) };
}

// ------------------------------------------------------------------ laser sight (up to 3 segments)
const laserMat = new THREE.MeshBasicMaterial({ color: '#ff2a3a', transparent: true, opacity: 0.9, depthWrite: false, fog: false });
const laserMat2 = new THREE.MeshBasicMaterial({ color: '#ffe14d', transparent: true, opacity: 0.85, depthWrite: false, fog: false });
const laserGeo = new THREE.BoxGeometry(1, 0.055, 0.055); laserGeo.translate(0.5, 0, 0);
const lasers = [0, 1, 2].map(i => { const m = new THREE.Mesh(laserGeo, i ? laserMat2 : laserMat); m.visible = false; m.renderOrder = 5; scene.add(m); return m; });
const dotM = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: '#ff2a3a', fog: false })); scene.add(dotM); dotM.visible = false;
const ringM = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.8, 40), new THREE.MeshBasicMaterial({ color: '#3dff7a', transparent: true, opacity: 0.95, depthTest: false, depthWrite: false, fog: false }));
ringM.renderOrder = 6; ringM.visible = false; scene.add(ringM);
let wasLocked = false, lockFrom = 0, lastLock = null;   // lastLock = { a: goon, at: ms } — the goon most recently in the sights
function drawLaser(on) {
  for (const l of lasers) l.visible = false; dotM.visible = false; ringM.visible = false;
  if (!on) { wasLocked = false; return; }
  const A = aimShot(), tr = A.tr, armed = queued > performance.now(), th = A.locked ? 2.6 : armed ? 1.8 : 1;
  for (let i = 0; i < tr.pts.length - 1 && i < 3; i++) {
    const [ax, ay] = tr.pts[i], [bx, by] = tr.pts[i + 1], l = lasers[i];
    l.visible = true; l.position.set(ax, ay, 0.05); l.scale.set(Math.hypot(bx - ax, by - ay), th, th); l.rotation.z = Math.atan2(by - ay, bx - ax);
  }
  const e = tr.pts[tr.pts.length - 1]; dotM.visible = tr.hit.type !== 'none'; dotM.position.set(e[0], e[1], 0.1);
  dotM.scale.setScalar(A.locked ? 3.2 + Math.sin(performance.now() / 60) * 0.6 : 1);
  laserMat.color.set(A.locked ? '#3dff7a' : tr.hit.type === 'hostage' ? '#ff8fe0' : armed ? '#ffe14d' : '#ff2a3a'); dotM.material.color.set(A.locked ? '#3dff7a' : '#ff2a3a');
  if (A.locked) {
    const g = A.tr.hit.actor, pu = 1 + Math.sin(performance.now() / 70) * 0.12; lastLock = { a: g, at: performance.now() };
    ringM.visible = true; ringM.position.set(g.x, g.y + 1.15, 0.6); ringM.scale.setScalar(pu); ringM.lookAt(camera.position);
  }
  if (A.locked && !wasLocked) {
    lockFrom = performance.now(); tone(1400, 0.05, 'sine', 0.07, 1.2); buzz(8);
    if (level <= 3 && !armed && !bullets.length) ui.pop('TAP!', '#3dff7a', 46, 30);
  }
  wasLocked = A.locked;
  return tr;
}

// ------------------------------------------------------------------ shooting
const bulletMat = new THREE.MeshBasicMaterial({ color: '#ffe680', fog: false });
const trailMat = new THREE.MeshBasicMaterial({ color: '#fff2a8', transparent: true, opacity: 0.7, depthWrite: false, fog: false });
function fire(shot = aimShot(), free = false) {
  if (state !== 'play' || agent.phase !== 'flip') return;
  if (ammo <= 0) { tone(180, 0.06, 'square', 0.06, 0.8); ui.pop('NO AMMO', '#ffffff', 26, 30); return; }
  if (!free) { ammo--; drawAmmo(); } queued = 0; shots++;
  const { mx, my, dx, dy, tr } = shot;
  if (!free && tr.hit.type !== 'enemy' && tr.hit.type !== 'barrel') { AD.bad(0.75); S.wasted++; S.chain = 0; fever = false; updateMission(); if (tr.hit.type !== 'hostage') ui.pop('MISS!', '#ffd0d0', 30, 30); ammoEl.animate([{ transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'none' }], 220); }   // a wasted bullet: say so
  const m = new THREE.Mesh(G.bullet, bulletMat); m.position.set(mx, my, 0.05); scene.add(m);
  const tm = new THREE.Mesh(laserGeo, trailMat); tm.scale.set(0.01, 1.6, 1.6); scene.add(tm);
  let len = 0; const segs = []; for (let i = 0; i < tr.pts.length - 1; i++) { const l = Math.hypot(tr.pts[i + 1][0] - tr.pts[i][0], tr.pts[i + 1][1] - tr.pts[i][1]); segs.push(l); len += l; }
  bullets.push({ m, tm, pts: tr.pts, segs, len, d: 0, hit: tr.hit, seg: 0 });
  // muzzle flash + recoil + sound
  const f = new THREE.Mesh(G.flash, new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, fog: false })); f.position.set(mx, my, 0.1); scene.add(f); flashes.push({ m: f, t: 0 });
  sparks.emit(new THREE.Vector3(mx, my, 0.1), { color: '#ffd23f', n: 8, speed: 5, size: 0.14, life: 0.25, dir: new THREE.Vector3(dx, dy, 0), spread: 0.8 });
  fx.emit(new THREE.Vector3(mx, my, 0), { color: '#ffffff', n: 4, speed: 1.2, size: 0.35, size1: 0.8, life: 0.5, alpha: 0.6 });
  agent.recoil = 1; shake = Math.max(shake, 0.12);
  tone(900, 0.05, 'square', 0.07, 0.35); tone(140, 0.09, 'sawtooth', 0.08, 0.5); buzz(12);
}
function v3(x, y, z = 0) { return new THREE.Vector3(x, y, z); }
function killActor(a, dx, dy, part, how = 'shot') {
  if (!a.alive) return;
  a.alive = false; a.dead = 0.001;
  const p = v3(a.x, a.y + (part === 'head' ? 1.55 : 1.0) * a.sc, a.z);
  if (a.shield) { solids.splice(solids.indexOf(a.shield.sol), 1); a.shield = null; }
  a.vx = dx * 7 + (Math.random() - 0.5); a.vy = 5 + dy * 4 + Math.random() * 2; a.w = (dx >= 0 ? -1 : 1) * (6 + Math.random() * 5);
  fx.emit(p, { color: '#ffffff', n: 14, speed: 3, size: 0.45, size1: 1.0, life: 0.9, alpha: 0.85, drag: 2.5 });
  sparks.emit(p, { color: a.kind === 'hostage' ? '#ff7eb3' : '#ffd23f', n: 22, speed: 7, size: 0.18, life: 0.7, g: 6 });
  fx.emit(p, { color: a.kind === 'hostage' ? '#ff7eb3' : TH.stripe, n: 8, speed: 5, size: 0.18, life: 1.2, g: 9, drag: 0.5 });
  if (a.kind === 'hostage') { lose('hostage'); return; }
  kills++; flipKills++; AD.good(); S.chain++; S.multi = Math.max(S.multi, flipKills);
  if (part === 'head' && !a.hpHead) S.head++;
  if (how === 'ricochet') S.ric++; if (how === 'boom') S.boom++;
  let pts = 10, txt = ['NICE!', 'GREAT!', 'COOL!'][Math.floor(Math.random() * 3)], col = '#ffffff';
  if (part === 'head') { pts += 10; txt = 'HEADSHOT!'; col = '#ffd23f'; }
  if (how === 'ricochet') { pts += 15; txt = 'RICOCHET!'; col = '#7cf3ff'; }
  if (how === 'boom') { pts += 5; txt = 'KABOOM!'; col = '#ff8a3d'; }
  if (flipKills >= 2) { pts += flipKills * 5; txt = ['', '', 'DOUBLE!', 'TRIPLE!', 'QUAD!', 'MAYHEM!'][Math.min(5, flipKills)]; col = '#ff5d8f'; }
  pts += Math.min(S.chain, 6) * 2; if (S.chain >= 3 && flipKills < 2) txt += ` ×${S.chain}`;
  if (a.gold) { pts += 100; txt = 'GOLDEN GOON! +100'; col = '#ffc928'; confetti(scene, v3(a.x, a.y + 2, 0), 60); sparks.emit(p, { color: '#ffd23f', n: 50, speed: 9, size: 0.22, life: 1, g: 4 }); sfx.coin(); S.gold = (S.gold || 0) + 1; goldSeen++; }
  if (S.chain >= (level <= 6 ? 3 : 4) && !fever) { fever = true; ui.pop('FEVER! ×2', '#ff5d8f', 46, 20); confetti(scene, v3(agent.x, agent.y + 2, 0), 40); shake = Math.max(shake, 0.6); ui.flash(0.35); }
  if (fever) pts *= 2;
  if (!a.gold && a.hp0 <= 1 && level >= 2 && Math.random() < (level <= 5 ? 0.18 : 0.08)) { pts += 50; txt = 'LUCKY! +50'; col = '#7dffb0'; confetti(scene, v3(a.x, a.y + 2, 0), 30); sparks.emit(p, { color: '#7dffb0', n: 30, speed: 8, size: 0.2, life: 0.9, g: 4 }); sfx.coin(); }
  if (a.hp0 > 1) { pts += 30; txt = 'BOSS DOWN!'; col = '#ff5d8f'; confetti(scene, v3(a.x, a.y + 2, 0), 50); shake = 0.8; }
  score += pts; ui.score(score); ui.pop(txt, col, flipKills >= 2 || a.hp0 > 1 ? 40 : 34, 26); updateMission();
  timeScale = Math.min(timeScale, 0.03);   // hit-stop: a short freeze on every kill
  sfx.smash(); tone(520 + Math.min(S.chain, 10) * 70 + flipKills * 60, 0.1, 'triangle', 0.1, 1.4); buzz([20, 20, 30]); shake = Math.max(shake, 0.3); ui.flash(0.18);
  const st = stages[stageIdx];
  if (st && st.enemies.every(e => !e.alive) && agent.phase === 'flip') { tsTarget = 0.85; slowUntil = performance.now() + 420; killCam = { x: a.x, y: a.y + 1.2, until: performance.now() + 650 }; ui.pop(st === stages[stages.length - 1] ? 'CLEAR!' : 'CLEAR!', '#7dffb0', 44, 34); sfx.coin(); }
  updateProgress();
}
// a boss takes hp hits: the first ones stagger him, the last one kills
function hitActor(a, dx, dy, part, how) {
  if (a.kind === 'enemy' && a.hp > 1) {
    a.hp--; a.hurt = 1; if (part === 'head') { S.head++; a.hpHead = true; }
    const p = v3(a.x, a.y + 1.3 * a.sc, a.z); sparks.emit(p, { color: '#ff5d8f', n: 26, speed: 8, size: 0.2, life: 0.6, g: 5 }); fx.emit(p, { color: '#ffffff', n: 8, speed: 3, size: 0.6, size1: 1.1, life: 0.6, alpha: 0.8 });
    sfx.smash(); tone(220, 0.2, 'sawtooth', 0.12, 0.5); buzz([30, 20, 40]); shake = Math.max(shake, 0.5); ui.flash(0.25); timeScale = Math.min(timeScale, 0.03);
    ui.pop(`BOSS HIT! ${a.hp} left`, '#ff9fbd', 36, 26); S.chain++; return;
  }
  killActor(a, dx, dy, part, how);
}
function explode(b) {
  if (!b.alive) return; b.alive = false; scene.remove(b.mesh);
  const p = v3(b.x, b.y + 0.6, 0.2);
  sparks.emit(p, { color: '#ffb43d', n: 60, speed: 11, size: 0.3, life: 0.8, g: 4 }); fx.emit(p, { color: '#4a4a55', n: 18, speed: 3, size: 0.8, size1: 1.8, life: 1.4, alpha: 0.7, g: -1.5 });
  fx.emit(p, { color: '#ffd23f', n: 16, speed: 6, size: 0.6, size1: 0.1, life: 0.6 });
  sfx.smash(); tone(60, 0.5, 'sawtooth', 0.14, 0.4); buzz([40, 30, 60]); shake = 0.7; ui.flash(0.5);
  for (const a of actors) if (a.alive && Math.hypot(a.x - b.x, a.y + 0.9 - b.y - 0.5) < 2.7) { const dx = a.x - b.x, dy = a.y - b.y + 1; const l = Math.hypot(dx, dy) || 1; hitActor(a, dx / l, dy / l, 'body', 'boom'); if (state !== 'play') return; }
  for (const o of barrels) if (o.alive && Math.hypot(o.x - b.x, o.y - b.y) < 2.7) setTimeout(() => explode(o), 120);
}
function updateProgress() { const done = stages.filter(s => s.cleared).length; ui.progress(totalEnemies ? 0.85 * kills / totalEnemies + 0.15 * done / stages.length : 0); }

// ------------------------------------------------------------------ mission stars, cards, map, suits
const tr_ = () => LEVELS[level - 1]?.trick;
const trickDone = () => { const k = tr_(); if (!k) return false; return k.t === 'spare' ? ammo >= k.n : k.t === 'multi' ? S.multi >= k.n : S[k.t] >= k.n; };
const starsNow = () => 1 + (S.wasted === 0 ? 1 : 0) + (trickDone() ? 1 : 0);
function applySuit(i) { const u = SUITS[i]; M.suit.color.set(u.c); M.tie.color.set(u.tie); }
applySuit(SAVE.suit);
const css2 = document.createElement('style');
css2.textContent = `
.fa-mis{position:fixed;left:50%;top:calc(112px + env(safe-area-inset-top));transform:translateX(-50%);z-index:5;pointer-events:none;display:flex;gap:6px;font:800 13px/1 "Baloo 2",system-ui,sans-serif;color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.3)}
.fa-mis span{background:rgba(30,40,70,.55);padding:6px 10px;border-radius:14px;white-space:nowrap;transition:background .2s,transform .2s}
.fa-mis span.ok{background:#f5b301;color:#4a3000;text-shadow:none;transform:scale(1.12)}.fa-mis span.bad{opacity:.45;text-decoration:line-through}
.fa-ban{position:fixed;left:0;right:0;top:34%;z-index:6;text-align:center;pointer-events:none;color:#fff;font:800 20px/1.15 "Baloo 2",system-ui,sans-serif;text-shadow:0 3px 0 rgba(0,0,0,.35);animation:fabn 2.6s both}
.fa-ban b{display:block;font-size:34px;letter-spacing:1px}.fa-ban i{display:inline-block;margin-top:6px;font-style:normal;background:rgba(30,40,70,.6);border-radius:16px;padding:5px 12px;font-size:15px}
.fa-ban.hard b{color:#ff8a8a}
@keyframes fabn{0%{opacity:0;transform:translateY(20px)}12%,78%{opacity:1;transform:none}100%{opacity:0;transform:translateY(-10px)}}
.fa-hand{position:fixed;left:50%;bottom:16%;font-size:64px;z-index:6;pointer-events:none;transform:translateX(-50%);animation:fahand .5s ease-in-out infinite alternate;display:none}
@keyframes fahand{to{transform:translateX(-50%) translateY(-14px) scale(.9)}}
.fa-mapbtn{position:fixed;right:12px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:7;width:54px;height:54px;border-radius:50%;border:0;background:rgba(30,40,70,.5);font-size:26px;color:#fff;cursor:pointer;pointer-events:auto}
.fa-card{position:fixed;inset:0;z-index:12;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:rgba(15,25,55,.55);color:#fff;font:800 20px/1.2 "Baloo 2",system-ui,sans-serif;text-align:center;text-shadow:0 3px 0 rgba(0,0,0,.3);animation:facd .25s both}
@keyframes facd{from{opacity:0}}
.fa-card h1{margin:0;font-size:46px;letter-spacing:1px}.fa-card p{margin:0;font-size:18px;opacity:.95}
.fa-stars{font-size:62px;letter-spacing:6px;line-height:1}.fa-stars s{text-decoration:none;opacity:.25;display:inline-block;transition:transform .3s,opacity .3s}.fa-stars s.on{opacity:1;transform:scale(1.2) rotate(-8deg)}
.fa-chip{background:rgba(30,40,70,.6);border-radius:16px;padding:6px 14px;font-size:16px}.fa-chip.ok{background:#f5b301;color:#4a3000;text-shadow:none}
.fa-bar{width:230px;height:14px;border-radius:8px;background:rgba(0,0,0,.35);overflow:hidden}.fa-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#ffe066,#f5b301);transition:width .9s}
.fa-btn{pointer-events:auto;font:inherit;color:#fff;background:var(--ui,#2f7bff);border:0;border-radius:40px;padding:12px 34px;box-shadow:0 5px 0 rgba(0,0,0,.25);cursor:pointer;font-size:26px}
.fa-btn.go{background:#3cc46a;box-shadow:0 6px 0 #2a9a50;padding:14px 56px;font-size:30px;animation:hcpulse 1.4s ease-in-out infinite}.fa-btn.sm{font-size:17px;padding:8px 18px;background:rgba(30,40,70,.6)}
.fa-row{display:flex;gap:10px}
.fa-map{position:fixed;inset:0;z-index:20;background:linear-gradient(#17284f,#2c1d58);color:#fff;font-family:"Baloo 2",system-ui,sans-serif;overflow-y:auto;padding:calc(14px + env(safe-area-inset-top)) 14px 40px;box-sizing:border-box}
.fa-map h2{margin:16px 0 4px;font-size:22px}.fa-map small{opacity:.75;font-size:13px;font-weight:600}
.fa-map .g{display:grid;grid-template-columns:repeat(5,1fr);gap:9px;margin:8px 0}
.fa-map .c{aspect-ratio:1;border-radius:14px;background:rgba(255,255,255,.14);display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:800;font-size:20px;cursor:pointer;position:relative}
.fa-map .c.lock{opacity:.35;cursor:default}.fa-map .c.hard{box-shadow:inset 0 0 0 3px #ff6a6a}.fa-map .c.next{background:#3cc46a;animation:hcpulse 1.2s infinite}
.fa-map .c i{font-style:normal;font-size:11px;letter-spacing:1px;color:#ffd23f}.fa-map .suits{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}
.fa-map .su{border-radius:14px;padding:8px 4px;text-align:center;background:rgba(255,255,255,.12);font-size:12px;cursor:pointer}.fa-map .su.lock{opacity:.4;cursor:default}.fa-map .su.sel{box-shadow:0 0 0 3px #ffd23f}
.fa-map .su b{display:block;width:30px;height:44px;margin:0 auto 4px;border-radius:12px 12px 6px 6px}
.fa-x{position:sticky;top:0;float:right;font-size:30px;background:none;border:0;color:#fff;cursor:pointer;pointer-events:auto}`;
document.head.appendChild(css2);
const ho = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
const missionEl = ho('<div class="fa-mis"></div>'), handEl = ho('<div class="fa-hand">👆</div>'), mapBtn = ho('<button class="fa-mapbtn" aria-label="Missions">🗺</button>');
document.body.append(missionEl, handEl, mapBtn);
let cardEl = null, bannerEl = null;
function updateMission() {
  const k = tr_(); if (!LEVELS[level - 1]) { missionEl.innerHTML = `<span class="${S.wasted ? 'bad' : ''}">★ no miss</span>`; return; }
  missionEl.innerHTML = `<span class="${S.wasted ? 'bad' : ''}">★ no miss</span><span class="${trickDone() ? 'ok' : ''}">★ ${TRICK_TXT[k.t](k.n)}</span>`;
}
function showBanner() {
  bannerEl?.remove(); const L = LEVELS[level - 1], k = tr_();
  bannerEl = ho(`<div class="fa-ban ${L?.hard ? 'hard' : ''}"><b>${L ? (L.hard ? 'HARD · ' : '') + L.n.toUpperCase() : 'CONTRACT ' + (level - N)}</b>MISSION ${level}${k ? `<br><i>★ ${TRICK_TXT[k.t](k.n)}</i>` : ''}</div>`);
  document.body.appendChild(bannerEl); setTimeout(() => bannerEl?.remove(), 2700);
}
function closeCard() { cardEl?.remove(); cardEl = null; }
function startLevel(lv) {
  closeMap(true); closeCard(); level = lv; save.set('level', lv); score = 0; buildLevel(); state = 'play'; agent.phase = 'run'; ui.hideStart(); updateMission(); showBanner(); WB.start();
}
const retry = () => startLevel(level);
function suitGain(prev, now) { return SUITS.map((u, i) => i).filter(i => SUITS[i].at > prev && SUITS[i].at <= now); }
function win() {
  if (state !== 'play') return;
  state = 'won'; delete fails[level]; FL.level(true); WB.submit(1); score += ammo * 5; ui.score(score);
  best = Math.max(best, score); save.set('best', best);
  const stars = starsNow(), had = SAVE.stars[level] || 0, before = totalStars(), L = LEVELS[level - 1];
  if (L) { if (stars > had) { SAVE.stars[level] = stars; sv('stars'); } }
  if (level >= SAVE.unlocked) { SAVE.unlocked = Math.min(level + 1, 999); sv('unlocked'); }
  const today = new Date().toISOString().slice(0, 10), yest = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  if (SAVE.day !== today) { SAVE.streak = SAVE.day === yest ? SAVE.streak + 1 : 1; SAVE.day = today; sv('streak'); sv('day'); }
  if (SAVE.dday !== today) { SAVE.dday = today; SAVE.dwins = 0; sv('dday'); }
  const dBefore = SAVE.dwins; SAVE.dwins++; sv('dwins'); const dDone = dBefore < 3 && SAVE.dwins >= 3; if (dDone) { SAVE.stars.bonus = (SAVE.stars.bonus || 0) + 2; sv('stars'); }
  const pulls = []; if (stars === 3 && L) { const x = pullSticker(); if (x !== null) pulls.push(x); } if (S.gold) { const x = pullSticker(); if (x !== null) pulls.push(x); }
  const gained = suitGain(before, totalStars()); if (gained.length) { SAVE.suit = gained[gained.length - 1]; SAVE.seenSuits = SAVE.suit + 1; sv('suit'); sv('seenSuits'); applySuit(SAVE.suit); }
  sfx.win(); buzz([30, 40, 30]);
  const p = v3(agent.x, agent.y + 2, 0);
  for (let i = 0; i < 3; i++) setTimeout(() => fx.emit(p.clone().add(v3((Math.random() - 0.5) * 4, Math.random() * 2, 0)), { color: ['#ff5d8f', '#ffd23f', '#3ab795', '#3a86ff', '#7b5cff'][i], n: 30, speed: 7, size: 0.22, life: 1.6, g: 6, drag: 0.6 }), i * 150);
  confetti(scene, v3(agent.x, agent.y + 3, 0), 80); shake = Math.max(shake, 0.4); ui.flash(0.4);
  const k = tr_(), nextSuit = SUITS.find(u => u.at > totalStars()), now = totalStars();
  const prevAt = [...SUITS].reverse().find(u => u.at <= now)?.at ?? 0;
  const bar = nextSuit ? Math.round(100 * (now - prevAt) / (nextSuit.at - prevAt)) : 100, bar0 = nextSuit ? Math.round(100 * (before - prevAt) / (nextSuit.at - prevAt)) : 100;
  setTimeout(() => {
    cardEl = ho(`<div class="fa-card"><p>MISSION ${level}${L ? ' · ' + L.n : ''}</p><h1>${stars === 3 ? 'PERFECT!' : 'CLEARED!'}</h1>
      <div class="fa-stars">${[0, 1, 2].map(i => `<s data-i="${i}">★</s>`).join('')}</div>
      ${stars === 3 ? '' : `<div class="fa-chip ${S.wasted ? '' : 'ok'}">★ no miss ${S.wasted ? '· ' + S.wasted + ' missed' : '✓'}</div>`}
      ${k ? `<div class="fa-chip ${trickDone() ? 'ok' : ''}">★ ${TRICK_TXT[k.t](k.n)} ${trickDone() ? '✓' : ''}</div>` : ''}
      <div class="fa-chip ${SAVE.dwins >= 3 ? 'ok' : ''}">DAILY ${Math.min(3, SAVE.dwins)}/3 ${dDone ? '✓ +2★' : ''}</div>
      <p>${score} pts${SAVE.streak > 1 ? ` · 🔥 ${SAVE.streak} days` : ''}</p>
      ${pulls.length ? `<div class="fa-chip ok" style="font-size:26px">NEW STICKER ${pulls.map(i => STICKERS[i]).join(' ')} <small style="font-size:13px">${SAVE.stickers.length}/${STICKERS.length}</small></div>` : ''}
      ${gained.length ? `<div class="fa-chip ok">NEW SUIT: ${SUITS[gained[gained.length - 1]].n}!</div>` : ''}
      ${nextSuit ? `<div class="fa-bar"><i style="width:${gained.length ? 0 : bar0}%"></i></div><p style="font-size:14px">${nextSuit.at - now} ★ to the ${nextSuit.n} suit</p>` : ''}
      <div class="fa-row"><button class="fa-btn sm" data-a="map">🗺</button><button class="fa-btn sm" data-a="again">↻</button></div>
      <button class="fa-btn go" data-a="next">${L && level === N ? 'CONTRACTS ▶' : 'NEXT ▶'}</button></div>`);
    document.body.appendChild(cardEl);
    for (let i = 0; i < stars; i++) setTimeout(() => { cardEl?.querySelector(`[data-i="${i}"]`)?.classList.add('on'); tone(520 + i * 160, 0.18, 'triangle', 0.12, 1.2); buzz(15); }, 350 + i * 330);
    setTimeout(() => { const b = cardEl?.querySelector('.fa-bar i'); if (b) b.style.width = bar + '%'; }, 500);
    cardEl.addEventListener('pointerdown', e => { e.stopPropagation(); const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return; if (a === 'map') openMap(); else if (a === 'again') retry(); else startLevel(level + 1); });
  }, 700);
}
function lose(why) {
  if (state !== 'play') return; note('LOSE ' + why + ' ammo' + ammo + ' alive' + actors.filter(a => a.alive && a.kind === 'enemy' && a.stage === stageIdx).length);
  state = 'lost'; fails[level] = (fails[level] || 0) + 1; FL.level(false, totalEnemies ? kills / totalEnemies : 0); AD.bad(2); timeScale = tsTarget = 0.35;
  best = Math.max(best, score); save.set('best', best);
  sfx.fail(); buzz([60, 40, 80]); shake = 0.6;
  const left = actors.filter(a => a.alive && a.kind === 'enemy');
  let title, line;
  if (why === 'hostage') { ui.flash(0.5); title = 'HOSTAGE HIT!'; line = 'Never shoot the pink ones'; }
  else {
    for (const e of left) tracer(e.x + e.face * 0.6, e.y + 1.25, agent.x, agent.y + 1.0, '#ff5a3d');   // the survivors open fire
    agent.dead = true; agent.vx = -4; agent.vy = 6; agent.phase = 'dead';
    sparks.emit(v3(agent.x, agent.y + 1, 0), { color: '#ff7a3d', n: 26, speed: 7, size: 0.18, life: 0.6 });
    title = why === 'ammo' ? 'OUT OF BULLETS' : left.length === 1 ? 'ONE GOON LEFT!' : 'SPOTTED!';
    const sh = left.find(e => e.shield), bs = left.find(e => e.hp0 > 1);
    line = sh ? 'Shields block the body: aim at the head, or bank it off steel' : bs ? 'Bosses take ' + bs.hp0 + ' hits' : S.wasted ? `${S.wasted} bullet${S.wasted > 1 ? 's' : ''} missed: wait for the green ring` : 'Clear every goon before you land';
  }
  const loseNext = SUITS.find(u => u.at > totalStars());
  const near = totalEnemies ? `${kills}/${totalEnemies} goons down` + ((fails[level] || 0) >= 2 ? ' · a spare bullet is waiting' : '') : '';
  setTimeout(() => {
    cardEl = ho(`<div class="fa-card" style="background:rgba(40,10,20,.5);justify-content:flex-end;padding-bottom:12vh"><h1 style="font-size:38px">${title}</h1><p>${line}</p>
      ${near ? `<p style="font-size:15px;color:#ffd96a">${near}</p>` : ''}
      ${loseNext ? `<p style="font-size:14px">${loseNext.at - totalStars()} ★ to the ${loseNext.n} suit</p>` : ''}
      <button class="fa-btn go" data-a="again">RETRY ↻</button><div class="fa-row"><button class="fa-btn sm" data-a="map">🗺</button></div></div>`);
    document.body.appendChild(cardEl);
    cardEl.addEventListener('pointerdown', e => { e.stopPropagation(); const a = e.target.closest('[data-a]')?.dataset.a; if (a === 'map') openMap(); else retry(); });
  }, 420);
}
// level map: three worlds + the suit wardrobe
let mapEl = null, mapPrev = null;
function openMap() {
  if (mapEl) return; mapPrev = state; if (state === 'play') state = 'paused'; closeCard();
  let h = `<button class="fa-x" data-a="x">✕</button><h2 style="margin-top:6px">★ ${totalStars()} / ${N * 3}${SAVE.streak > 1 ? ` · 🔥 ${SAVE.streak} days` : ''}</h2>`;
  WORLDS.forEach((w, wi) => {
    const lo = wi * 10 + 1, st = Array.from({ length: 10 }, (_, i) => SAVE.stars[lo + i] || 0).reduce((a, b) => a + b, 0);
    h += `<h2>${w.icon} ${w.name} <small>★ ${st}/30 · ${w.note}</small></h2><div class="g">`;
    for (let i = 0; i < 10; i++) { const lv = lo + i, L = LEVELS[lv - 1], ok = lv <= SAVE.unlocked, ss = SAVE.stars[lv] || 0;
      h += `<div class="c ${ok ? '' : 'lock'} ${L.hard ? 'hard' : ''} ${lv === SAVE.unlocked ? 'next' : ''}" data-l="${lv}">${ok ? lv : '🔒'}<i>${ok ? '★'.repeat(ss) + '☆'.repeat(3 - ss) : ''}</i></div>`; }
    h += '</div>';
  });
  if (SAVE.unlocked > N) h += `<h2>Contracts <small>endless, harder every time</small></h2><div class="g"><div class="c next" data-l="${Math.max(N + 1, SAVE.unlocked)}">▶</div></div>`;
  h += `<h2>Stickers <small>${SAVE.stickers.length}/${STICKERS.length} · 3★ missions and golden goons</small></h2><div class="suits">${STICKERS.map((e, i) => `<div class="su ${SAVE.stickers.includes(i) ? '' : 'lock'}" style="font-size:22px">${SAVE.stickers.includes(i) ? e : '?'}</div>`).join('')}</div>`;
  h += `<h2>Suits <small>${SUITS.filter(u => u.at <= totalStars()).length}/${SUITS.length} · earned with stars</small></h2><div class="suits">`;
  SUITS.forEach((u, i) => { const ok = u.at <= totalStars(); h += `<div class="su ${ok ? '' : 'lock'} ${SAVE.suit === i ? 'sel' : ''}" data-s="${i}"><b style="background:${ok ? u.c : '#555'}"></b>${ok ? u.n : u.at + ' ★'}</div>`; });
  mapEl = ho(`<div class="fa-map">${h}</div>`); document.body.appendChild(mapEl);
  mapEl.addEventListener('pointerdown', e => e.stopPropagation());
  mapEl.addEventListener('click', e => {
    const c = e.target.closest('[data-l]'), su = e.target.closest('[data-s]');
    if (e.target.closest('[data-a="x"]')) closeMap(false);
    else if (c && !c.classList.contains('lock')) startLevel(+c.dataset.l);
    else if (su && !su.classList.contains('lock')) { SAVE.suit = +su.dataset.s; sv('suit'); applySuit(SAVE.suit); mapEl.querySelectorAll('.su').forEach(x => x.classList.toggle('sel', x === su)); tone(700, 0.08, 'triangle', 0.1, 1.3); }
  });
}
function closeMap(leaving) { if (!mapEl) return; mapEl.remove(); mapEl = null; if (!leaving && mapPrev === 'play') state = 'play'; else if (!leaving && mapPrev) state = mapPrev; }
mapBtn.addEventListener('pointerdown', e => { e.stopPropagation(); if (state !== 'ready') openMap(); });
function tracer(ax, ay, bx, by, color) {
  const m = new THREE.Mesh(laserGeo, new THREE.MeshBasicMaterial({ color, transparent: true, fog: false, depthWrite: false }));
  m.position.set(ax, ay, 0.1); m.scale.set(Math.hypot(bx - ax, by - ay), 2.4, 2.4); m.rotation.z = Math.atan2(by - ay, bx - ax); scene.add(m); tracers.push({ m, t: 0 });
}

// ------------------------------------------------------------------ input
// A tap never gets lost: in a flip it fires at once when locked on; if the laser is about to lock (or the flip is about to start)
// the tap is held for a moment and fires on the lock. Extra taps while one is held don't burn bullets.
let queued = 0, waitPop = 0, shots = 0;
const LATE_MS = 220;   // coyote time: a tap this soon after the goon left the sights still gets him (if he is in clear sight)
function waitGreen() { const now = performance.now(); if (now > waitPop) { ui.pop('WAIT FOR GREEN', '#ffffff', 28, 30); waitPop = now + 900; } tone(260, 0.05, 'sine', 0.05, 0.9); }
function lateShot() {
  if (!lastLock || performance.now() - lastLock.at > LATE_MS) return null;
  const a = lastLock.a, pend = pendingSet(); if (!a.alive || pend.has(a) || a.stage !== stageIdx) return null;
  const [mx, my] = muzzle();
  for (const py of [0.98 * a.sc, 1.55 * a.sc]) { const ex = a.x - mx, ey = a.y + py - my, l = Math.hypot(ex, ey), tr = trace(mx, my, ex / l, ey / l, 0, 34); if (tr.hit.actor === a) return { mx, my, dx: ex / l, dy: ey / l, tr, locked: true }; }
  return null;
}
function lockSoon(ms) {
  if (agent.phase !== 'flip') return false; const pend = pendingSet();
  for (let k = 1; k * 10 <= ms; k++) { const P = flipPose(agent.jump, agent.t + k * 0.01 * Math.max(timeScale, 0.1)); if (P.u >= 1) break; if (aimShot(P.x, P.y, P.spin, pend).locked) return true; }
  return false;
}
function lockAhead(gt) {   // will the laser lock onto a goon within gt seconds of game time?
  const pend = pendingSet();
  for (const k of [0, 0.25, 0.5, 0.75, 1]) { const P = flipPose(agent.jump, agent.t + gt * k); if (P.u >= 1) break; if (aimShot(P.x, P.y, P.spin, pend).locked) return true; }
  return false;
}
const tapLog = [], note = (r) => { tapLog.push([Math.round(performance.now()), level, stageIdx, agent.phase, r]); if (tapLog.length > 60) tapLog.shift(); };   // QA: what each tap did
function tapSpark(c = '#bfe9ff') { if (!agent) return; const p = v3(agent.x, agent.y + 1.2, 0.1); sparks.emit(p, { color: c, n: 10, speed: 4, size: 0.14, life: 0.35, g: 3 }); fx.emit(p, { color: '#ffffff', n: 3, speed: 1.2, size: 0.3, size1: 0.8, life: 0.4, alpha: 0.5 }); tone(1100, 0.04, 'triangle', 0.05, 0.6); }
function tapShoot() {
  if (state === 'play' && performance.now() < slowUntil) { slowUntil = 0; killCam = null; }
  if (state !== 'play') return; const now = performance.now(); tapAt = now; if (agent.phase === 'flip') flipTaps++;
  if (queued > now) { tapSpark('#ffe680'); return note('held'); }
  const st = stages[stageIdx], pend = pendingSet();
  if (st && !st.enemies.some(e => e.alive && !pend.has(e))) { if (!bullets.length && now > waitPop) { ui.pop('ALL CLEAR ✓', '#7dffb0', 28, 30); waitPop = now + 900; } tapSpark('#7dffb0'); return note('none-left'); }   // every goon here is down or has a bullet coming: don't waste one
  if (agent.phase === 'flip') {
    const A = aimShot();
    if (A.locked || A.tr.hit.type === 'barrel') return note('hit'), fire(A);
    const late = lateShot(); if (late) return note('late'), fire(late);
    // early tap: held (the laser turns yellow) and fired the moment it goes green. Level 1: for the rest of the flip.
    const hold = level === 1 ? 6000 : level === 2 ? 700 : 400;
    if (lockSoon(Math.min(hold, 1500))) { queued = now + hold + 400; tone(700, 0.04, 'sine', 0.05, 1); return note('hold'); }
    if (level <= 2) { note('toy'); ui.pop('PING!', '#bfe9ff', 26, 30); return fire(A, true); }   // early levels: an off-target tap is a free ricochet toy, no bullet spent   // early levels: an off-target tap costs nothing, it just says when
    return note('miss'), fire(A);
  }
  if (agent.phase === 'run' && stageIdx < stages.length) {
    const toEdge = (stages[stageIdx].J - 0.35 - agent.x) / 7;   // seconds until the flip starts
    if (toEdge < 0.6) { queued = now + toEdge * 1000 + (level <= 2 ? 1200 : 600); tone(700, 0.04, 'sine', 0.05, 1); return note('run-hold'); }
    note('run-wait'); tapSpark(); if (now > waitPop) { ui.pop('WAIT FOR THE FLIP', '#ffffff', 26, 30); waitPop = now + 1200; }
  }
}
input({ onDown: tapShoot });
ui.onTap(which => { WB.start(); if (which === 'start') { state = 'play'; agent.phase = 'run'; sfx.tap(); updateMission(); showBanner(); } });

// ------------------------------------------------------------------ main loop
const camPos = new THREE.Vector3(0, 5, 24), camAt = new THREE.Vector3(0, 2, 0), _sun = new THREE.Vector3();
loop((dt60) => {
  if (state === 'paused') return;   // the map is open
  const rdt = Math.min(0.05, dt60 / 60);
  timeScale = lerp(timeScale, tsTarget, 1 - Math.pow(0.0005, rdt));
  const dt = rdt * timeScale, tNow = performance.now() / 1000;
  if (state === 'play') AD.tick(performance.now() - tapAt < 8000);
  const A = agent, F = A.fig;

  // ---- agent
  if (A.phase === 'idle') { F.body.position.y = -0.95 + Math.sin(tNow * 3) * 0.02; }
  if (A.phase === 'run') {
    const p = plat.find(q => A.x >= q.a - 0.5 && A.x <= q.b + 0.1) || plat[0];
    A.x += 7 * dt; A.y = p.top;
    F.g.rotation.z = 0; A.spin = 0;
    const s = Math.sin(tNow * 15); F.lL.rotation.z = s * 0.9; F.lR.rotation.z = -s * 0.9; aim(F.aL, -1.2 - s * 0.4); aim(F.aR, -0.6);
    F.body.position.y = -0.95 + Math.abs(Math.cos(tNow * 15)) * 0.08;
    const last = plat[plat.length - 1];
    if (stageIdx >= stages.length) { if (A.x > last.a + 6.6) { A.phase = 'done'; win(); } }
    else if (A.x >= stages[stageIdx].J - 0.35) {
      const st = stages[stageIdx];
      A.phase = 'flip'; A.t = 0; flipKills = 0; flipTaps = 0; rescueFlip = false;
      A.jump = { x0: A.x, y0: A.y, x1: st.L + 0.9, y1: st.T, apex: Math.max(st.H, st.T) + 2.7 };
      // slow-mo kicks in at take-off when a goon is already in the sights: the take-off window used to pass at almost full
      // speed while time was still easing down (a 600 ms window on paper was ~250 ms on screen)
      tsTarget = lockAhead(0.08) ? slowMo() : cruise(); timeScale = Math.min(timeScale, tsTarget + 0.05); tone(300, 0.25, 'sine', 0.1, 2.2); buzz(15);
      fx.emit(v3(A.x, A.y + 0.1, 0), { color: '#ffffff', n: 8, speed: 2, size: 0.4, size1: 0.9, life: 0.6, alpha: 0.7 });
      if (!queued) ui.pop(level <= 2 && stageIdx === 0 ? 'WAIT FOR GREEN…' : 'SLOW-MO', '#ffffff', 28, 30);
      if (level === 3 && stageIdx === 0 && st.hostages) setTimeout(() => state === 'play' && !wasLocked && ui.pop('SPARE THE PINK ONE', '#ff8fe0', 28, 30), 450);
    }
  }
  if (A.phase === 'flip') {
    const J = A.jump; A.t += dt; const P = flipPose(J, A.t), u = P.u;
    A.x = P.x; A.y = P.y; A.spin = P.spin;
    F.g.rotation.z = A.spin;
    F.lL.rotation.z = lerp(F.lL.rotation.z, 1.5, 0.2); F.lR.rotation.z = lerp(F.lR.rotation.z, 1.2, 0.2); aim(F.aL, 0.6);
    aim(F.aR, -(A.recoil || 0) * 0.5); A.recoil = Math.max(0, (A.recoil || 0) - rdt * 6);
    // rescue (once a round): about to land with a goon still up, after sensible shooting and a tap in this very flip, and he
    // can still be locked on before touchdown → time slows down further for the rest of this flip. Nothing else changes.
    // (slow-mo stays on to 97 % of the flip instead of 86 %, and 20 % deeper)
    if (rescueFlip === false && u >= 0.7 && u < 0.86 && state === 'play' && flipTaps && ammo > 0 && AD.sensible(2)) {
      const pend = pendingSet(), st = stages[stageIdx];
      if (st && st.enemies.some(e => e.alive && !pend.has(e))) {
        let can = false; for (let tt = A.t; tt < JUMP_T * 0.97 && !can; tt += 0.005) { const P2 = flipPose(J, tt); can = aimShot(P2.x, P2.y, P2.spin, pend).locked; }
        rescueFlip = null;   // checked once per flip
        if (can && AD.rescue()) { rescueFlip = true; ui.pop('FOCUS!', '#7dffb0', 34, 30); tone(500, 0.3, 'sine', 0.08, 0.5); }
      }
    }
    const stc = stages[stageIdx], live = stc && stc.enemies.some(e => e.alive);
    if (state !== 'play') { /* lost mid-flip (hostage): keep the slow fail beat */ }
    else if (u >= SLOW_END || !live) tsTarget = u >= SLOW_END ? 1 : 0.85;
    else if (performance.now() < slowUntil) tsTarget = 0.14;
    else { const soon = wasLocked || lockAhead(0.07); tsTarget = soon || queued ? slowMo() * (rescueFlip ? 0.8 : 1) : cruise(); }
    if (u >= 1) {
      A.phase = 'run'; A.y = J.y1; A.spin = 0; F.g.rotation.z = 0; A.squash = 1; tsTarget = 1;
      fx.emit(v3(A.x, A.y + 0.1, 0), { color: '#ffffff', n: 12, speed: 3, size: 0.4, size1: 1.0, life: 0.7, alpha: 0.7 });
      sfx.bounce(); buzz(10);
      const st = stages[stageIdx];
      if (st.enemies.some(e => e.alive)) lose(ammo <= 0 ? 'ammo' : 'spotted');
      else { st.cleared = true; stageIdx++; updateProgress(); AD.good(); }
    }
  }
  if (A.phase === 'dead') { A.vy -= 20 * dt; A.x += A.vx * dt; A.y += A.vy * dt; F.g.rotation.z += 5 * dt; F.lL.rotation.z = 1; aim(F.aR, 1.5); aim(F.aL, 1.8); }
  A.squash = Math.max(0, A.squash - rdt * 5);
  F.g.position.set(A.x, A.y + 0.95, 0); F.g.scale.set(1 + A.squash * 0.2, 1 - A.squash * 0.22, 1);
  drawLaser(A.phase === 'flip' && state === 'play');
  if (queued && state === 'play') { if (performance.now() > queued || A.phase === 'run' && A.squash > 0.9) { queued = 0; note('expired'); waitGreen(); } else if (A.phase === 'flip' && wasLocked) { note('held-fired'); fire(); } }
  // level 1, first time ever: the agent fires on his own once the ring has been green for 0.7 s (the first win must happen);
  // levels 1-2: a hand shows where to tap while the laser is green
  if (state === 'play' && A.phase === 'flip' && wasLocked && level === 1 && firstTime() && !bullets.length && !queued && performance.now() - lockFrom > 700) { note('auto'); fire(); }
  handEl.style.display = state === 'play' && A.phase === 'flip' && wasLocked && level <= 2 && !bullets.length && ammo > 0 ? 'block' : 'none';
  vig.style.opacity = A.phase === 'flip' && state === 'play' ? clamp((1 - timeScale) * 1.3, 0, 1) : 0;

  // ---- actors: idle bob, aim at the agent, ragdoll when dead
  for (const a of actors) {
    const f = a.fig;
    if (a.alive) {
      a.t += rdt;
      if (a.kind === 'enemy') {
        a.face = A.x > a.x ? 1 : -1;
        f.body.rotation.y = lerp(f.body.rotation.y, a.face > 0 ? -0.5 : Math.PI + 0.5, 0.15);
        const phi = Math.atan2(A.y + 1 - (a.y + 1.24), (A.x - a.x) * a.face); aim(f.aR, clamp(phi, -1.3, 1.3)); aim(f.aL, -1.0 + Math.sin(a.t * 2) * 0.05);
        f.lL.rotation.z = 0.12; f.lR.rotation.z = -0.12;
      } else { f.body.rotation.y = 0.2; aim(f.aL, 1.3 + Math.sin(a.t * 9) * 0.25); aim(f.aR, 1.3 - Math.sin(a.t * 9) * 0.25); }
      f.body.position.y = Math.sin(a.t * 3) * 0.02; a.hurt = Math.max(0, a.hurt - rdt * 2.5); f.body.rotation.z = a.hurt * 0.35;
    } else if (a.dead > 0) {
      a.dead += dt; a.vy -= 22 * dt; a.x += a.vx * dt; a.y += a.vy * dt;
      f.g.rotation.z += a.w * dt; f.aL.rotation.z += 9 * dt; f.aR.rotation.z -= 7 * dt; f.lL.rotation.z = Math.sin(a.dead * 14) * 1.2; f.lR.rotation.z = -Math.sin(a.dead * 14) * 1.2;
      f.g.position.set(a.x, a.y, a.z);
      if (a.y < -18 || a.dead > 4) { a.dead = -1; scene.remove(f.g); }
    }
  }

  // ---- bullets (real time, so shots stay snappy in slow-mo)
  for (const b of bullets) {
    b.d += 46 * rdt;
    let d = Math.min(b.d, b.len), i = 0; while (i < b.segs.length - 1 && d > b.segs[i]) { d -= b.segs[i]; i++; }
    if (i > b.seg) { b.seg = i; const [px, py] = b.pts[i]; sparks.emit(v3(px, py, 0.1), { color: '#bfefff', n: 12, speed: 5, size: 0.14, life: 0.35 }); tone(1800, 0.06, 'triangle', 0.06, 0.6); }
    const [ax, ay] = b.pts[i], [bx, by] = b.pts[i + 1], sl = b.segs[i] || 1, k = Math.min(1, d / sl);
    const x = lerp(ax, bx, k), y = lerp(ay, by, k), ang = Math.atan2(by - ay, bx - ax);
    b.m.position.set(x, y, 0.05); b.m.rotation.z = ang - Math.PI / 2;
    const tl = Math.min(1.6, d + 0.01); b.tm.position.set(x - Math.cos(ang) * tl, y - Math.sin(ang) * tl, 0.05); b.tm.rotation.z = ang; b.tm.scale.set(tl, 1.4, 1.4);
    if (b.d >= b.len) {
      b.done = true; scene.remove(b.m); scene.remove(b.tm);
      const h = b.hit, [ex, ey] = b.pts[b.pts.length - 1], [sx, sy] = b.pts[b.pts.length - 2];
      const l = Math.hypot(ex - sx, ey - sy) || 1;
      if ((h.type === 'enemy' || h.type === 'hostage') && h.actor.alive) hitActor(h.actor, (ex - sx) / l, (ey - sy) / l, h.part, b.pts.length > 2 ? 'ricochet' : 'shot');
      else if (h.type === 'barrel') explode(h.barrel);
      else if (h.type === 'none') { sparks.emit(v3(ex, ey, 0.1), { color: '#bfefff', n: 14, speed: 6, size: 0.14, life: 0.5, g: 4 }); fx.emit(v3(ex, ey, 0.2), { color: '#ffffff', n: 4, speed: 2, size: 0.3, size1: 0.9, life: 0.5, alpha: 0.5 }); tone(1500, 0.08, 'triangle', 0.05, 0.4); }
      else if (h.type !== 'none') { shake = Math.max(shake, 0.18); sparks.emit(v3(ex, ey, 0.1), { color: '#c9a36b', n: 10, speed: 5, size: 0.2, life: 0.9, g: 12 }); sparks.emit(v3(ex, ey, 0.1), { color: '#ffe680', n: 10, speed: 4, size: 0.12, life: 0.3 }); fx.emit(v3(ex, ey, 0.2), { color: '#d9c3a5', n: 5, speed: 1.5, size: 0.3, size1: 0.6, life: 0.5, alpha: 0.6 }); tone(400, 0.04, 'square', 0.04, 0.5); }
    }
  }
  bullets = bullets.filter(b => !b.done);
  for (const f of flashes) { f.t += rdt * 9; f.m.scale.setScalar(1 + f.t * 1.5); f.m.material.opacity = Math.max(0, 1 - f.t); if (f.t >= 1) { scene.remove(f.m); f.dead = true; } }
  flashes = flashes.filter(f => !f.dead);
  for (const t of tracers) { t.t += rdt * 2.5; t.m.material.opacity = Math.max(0, 1 - t.t); if (t.t >= 1) { scene.remove(t.m); t.dead = true; } }
  tracers = tracers.filter(t => !t.dead);
  fx.update(dt); sparks.update(dt);

  // ---- camera: follow on the run, frame the whole gap + goons during the flip
  let tx, ty, fit;
  const st = stages[Math.min(stageIdx, stages.length - 1)];
  if (st && (A.phase === 'flip' || (A.phase === 'run' && stageIdx < stages.length && A.x > st.J - 4.5) || (state === 'lost' && stageIdx < stages.length))) {
    const xs = [st.J - 0.6, st.L + 2.6], ys = [Math.min(st.H, st.T) - 0.6, Math.max(st.H, st.T) + 3.6];
    for (const e of st.enemies) { xs.push(e.x); ys.push(e.y + 2.2, e.y - 0.4); }
    const x0 = Math.min(...xs) - 0.8, x1 = Math.max(...xs) + 1.1, y0 = Math.min(...ys), y1 = Math.max(...ys);
    tx = (x0 + x1) / 2; ty = (y0 + y1) / 2 + 0.6; fit = Math.max((x1 - x0) / camera.aspect, (y1 - y0) * 1.5);
  } else { tx = A.x + 1.9; ty = A.y + 2.4; fit = 7.5 / camera.aspect; }
  if (killCam && performance.now() < killCam.until) { tx = (tx + killCam.x * 2) / 3; ty = (ty + killCam.y * 2) / 3; fit *= 0.72; }
  const vh = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), dist = clamp(fit / vh, 13, 40);
  const tP = v3(tx - 1.4, ty + dist * 0.3, dist), tA = v3(tx, ty, 0);
  const kk = 1 - Math.pow(0.06, rdt);
  camPos.lerp(tP, kk); camAt.lerp(tA, kk);
  shake = Math.max(0, shake - rdt * 2.2);
  camera.position.copy(camPos).add(v3((Math.random() - 0.5) * shake * 0.5, (Math.random() - 0.5) * shake * 0.5, 0));
  camera.lookAt(camAt);
  stage.followLight(_sun.set(camAt.x, camAt.y, 0));
});

buildLevel();
ui.start();
ui.els.start.querySelector('.hint').lastChild.textContent = level > 1 ? `Mission ${level} · tap to play` : 'Tap when the laser turns green';

// ------------------------------------------------------------------ test hooks
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  go(l) { startLevel(l); }, get stars() { return { ...SAVE.stars, now: starsNow() }; }, get S() { return { ...S, ammo }; }, get trick() { return trickDone(); }, get unlocked() { return SAVE.unlocked; }, get left() { return actors.filter(a => a.alive && a.kind === 'enemy').length; },
  get adapt() { return { level: +AD.level.toFixed(2), rescues: AD.rescues }; }, get phase() { return agent.phase; }, get shots() { return shots; }, get taps() { return tapLog.slice(); },
  bot() {
    // look ahead over the next ~130 ms of the spin and schedule the shot for the first moment the laser lands on a goon
    if (state !== 'play' || agent.phase !== 'flip' || ammo <= 0 || botTimer) return;
    const pending = pendingSet();
    const good = (h) => {
      if (h.type === 'enemy') return !pending.has(h.actor);
      if (h.type === 'barrel' && !pending.has(h.barrel)) { const b = h.barrel;
        return actors.some(a => a.alive && a.kind === 'enemy' && Math.hypot(a.x - b.x, a.y - b.y) < 2.5) && !actors.some(a => a.alive && a.kind === 'hostage' && Math.hypot(a.x - b.x, a.y - b.y) < 2.9); }
      return false;
    };
    for (let k = 0; k <= 13; k++) {
      const P = flipPose(agent.jump, agent.t + k * 0.01 * timeScale);
      const [mx, my, dx, dy] = muzzle(P.x, P.y, P.spin), h = trace(mx, my, dx, dy, 2, 34).hit;
      if (good(h)) {
        const shoot = () => { botTimer = 0; if (state !== 'play' || agent.phase !== 'flip') return; const [a, b, c, d] = muzzle(); if (!good(trace(a, b, c, d, 2, 34).hit)) return;
          dispatchEvent(new PointerEvent('pointerdown', { clientX: 200, clientY: 500, pointerId: 1, bubbles: true })); dispatchEvent(new PointerEvent('pointerup', { clientX: 200, clientY: 500, pointerId: 1, bubbles: true })); };
        if (k === 0) shoot(); else botTimer = setTimeout(shoot, k * 10);
        return;
      }
    }
  },
};
let botTimer = 0;
// test hook: for each stage, how many ms (real, at the stage's slow-mo) each goon is locked on during its flip
window.__game.lockMap = () => stages.map((st, si) => {
  const J = { x0: st.J - 0.35, y0: st.H, x1: st.L + 0.9, y1: st.T, apex: Math.max(st.H, st.T) + 2.7 }, ts = slowMo();
  const ms = new Map(st.enemies.map(e => [e, 0])), none = new Set(), step = 0.005; aimSt = si;
  for (let t = 0; t < JUMP_T * SLOW_END; t += step) { const P = flipPose(J, t), A = aimShot(P.x, P.y, P.spin, none); if (A.locked && ms.has(A.tr.hit.actor)) ms.set(A.tr.hit.actor, ms.get(A.tr.hit.actor) + step / ts * 1000); }
  aimSt = -1; return { stage: si, goons: [...ms.values()].map(Math.round), hostages: st.hostages };
});
window.__dbg = () => `${state} ${agent.phase} st${stageIdx} k${kills}/${totalEnemies} ammo${ammo} ts${timeScale.toFixed(2)} lock${wasLocked ? 1 : 0}`;
// test hook: per stage, per goon: ms (real, at slow-mo speed) it stays in the green window when every other goon of the stage is already down
window.__game.lockSeq = () => stages.map((st, si) => {
  const J = { x0: st.J - 0.35, y0: st.H, x1: st.L + 0.9, y1: st.T, apex: Math.max(st.H, st.T) + 2.7 }, ts = slowMo(), none = new Set(), step = 0.005;
  return st.enemies.map(e => {
    const was = st.enemies.map(o => o.alive); st.enemies.forEach(o => { if (o !== e) o.alive = false; });
    let ms = 0; aimSt = si; for (let t = 0; t < JUMP_T * SLOW_END; t += step) { const P = flipPose(J, t), A = aimShot(P.x, P.y, P.spin, none); if (A.locked && A.tr.hit.actor === e) ms += step / ts * 1000; }
    aimSt = -1; st.enemies.forEach((o, i) => { o.alive = was[i]; }); return Math.round(ms);
  });
});
