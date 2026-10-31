// Bramblebash — a 3D woodland card battler: 1v1 against a fair CPU in a two-lane arena. Original game: code, art and sound are our own.
// Spend Sap to drop critter troops, buildings and spells; take the CPU's towers in 3 minutes; knock out its Hearth to win at once.
import { THREE, createStage, createUI, loop, confetti, sfx, tone, note, buzz, store, clamp, lerp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { vcMat } from './merge.js';
import { ab } from './kit/xp.js';
import { LEVELS, WORLDS, STICKERS, REWARDS, g3Text } from './campaign.js';
import { unitGeo, towerGeo, bushGeo, treeGeo, cardArt, UNIT_KEYS } from './models.js';

// deep v2 (studio lane 35, 2026-10-31): 30 hand-made duels in 3 worlds (campaign.js) with twists, stars, a map, card rewards, stickers, daily streak.
// READY stays false until v2 is finished and checked: until then no player sees it (?deep=1 is for QA only).
const READY = true;
const DEEP = (READY && ab('deep-bramblebash')) || /[?&]deep=1(&|$)/.test(location.search);
const NAME = 'Bramblebash: Card Battle Arena';
const S = store('bramblebash');
const DS = store('bramblebash2');
const F = flow('bramblebash');

// ================================================================ cards
const CARDS = {
  knight: { name: 'Acorn Knight', cost: 3, kind: 'troop', n: 1, hp: 720, dmg: 85, rate: 1.1, range: 0.55, spd: 1.0, r: 0.34, info: 'Sturdy melee fighter' },
  brute: { name: 'Beetle Brute', cost: 5, kind: 'troop', n: 1, hp: 2100, dmg: 135, rate: 1.5, range: 0.6, spd: 0.7, r: 0.5, bld: true, info: 'Tank · hits buildings only' },
  bees: { name: 'Bee Swarm', cost: 3, kind: 'troop', n: 3, hp: 115, dmg: 52, rate: 0.9, range: 0.5, spd: 1.6, r: 0.22, fly: true, air: true, info: '3 fast flyers' },
  archers: { name: 'Hedgehog Archers', cost: 3, kind: 'troop', n: 2, hp: 270, dmg: 50, rate: 1.0, range: 3.4, spd: 1.0, r: 0.3, air: true, proj: 'arrow', info: 'Ranged pair · hits air' },
  frog: { name: 'Frog Bomber', cost: 4, kind: 'troop', n: 1, hp: 360, dmg: 120, rate: 1.7, range: 3.0, spd: 0.9, r: 0.32, splash: 0.95, proj: 'bomb', info: 'Splash damage · ground' },
  cannon: { name: 'Mushroom Cannon', cost: 3, kind: 'bld', hp: 780, dmg: 90, rate: 0.9, range: 4.0, r: 0.6, life: 30, proj: 'ball', info: 'Building · ground defence' },
  volley: { name: 'Pinecone Volley', cost: 3, kind: 'spell', rad: 1.6, dmg: 290, info: 'Spell · area damage' },
  squirrels: { name: 'Squirrel Gang', cost: 2, kind: 'troop', n: 4, hp: 135, dmg: 55, rate: 1.0, range: 0.45, spd: 1.5, r: 0.22, info: '4 quick scrappers' },
  mole: { name: 'Mole Digger', cost: 4, kind: 'troop', n: 1, hp: 760, dmg: 95, rate: 1.2, range: 0.55, spd: 1.1, r: 0.34, anywhere: true, info: 'Digs in anywhere' },
  snare: { name: 'Honey Snare', cost: 2, kind: 'spell', rad: 2.0, dmg: 70, slow: 0.55, dur: 4, info: 'Spell · slows + stings' },
  heal: { name: 'Puffball Heal', cost: 3, kind: 'spell', rad: 2.0, heal: 380, info: 'Spell · heals your troops' },
  badger: { name: 'Badger Charger', cost: 4, kind: 'troop', n: 1, hp: 1150, dmg: 170, rate: 1.3, range: 0.6, spd: 1.0, r: 0.4, charge: true, info: 'Charges: double hit' },
  boulder: { name: 'Rolling Boulder', cost: 2, kind: 'spell', rad: 0.8, dmg: 230, roll: true, info: 'Rolls ahead · knocks back' },
  moth: { name: 'Moth Lanterns', cost: 4, kind: 'troop', n: 2, hp: 300, dmg: 72, rate: 1.2, range: 2.4, spd: 1.2, r: 0.28, fly: true, air: true, proj: 'spark', info: '2 ranged flyers' },
  bear: { name: 'Moss Bear', cost: 7, kind: 'troop', n: 1, hp: 3900, dmg: 245, rate: 1.6, range: 0.7, spd: 0.65, r: 0.6, info: 'Huge melee tank' },
};
const ALL = Object.keys(CARDS);
const START_DECK = ['knight', 'brute', 'bees', 'archers', 'frog', 'cannon', 'volley', 'squirrels'];
const UNLOCKS = ['mole', 'snare', 'heal', 'badger', 'boulder', 'moth', 'bear'];
const DIFF = [{ name: 'Easy', think: 2.3, col: '#52b788' }, { name: 'Normal', think: 1.25, col: '#3a86ff' }, { name: 'Hard', think: 0.6, col: '#ff4d6d' }];
const TEAMC = { 1: '#3a86ff', [-1]: '#ff4d6d' };

// ================================================================ save
let deck = S.get('deck', START_DECK.slice()), owned = S.get('owned', START_DECK.slice()), diff = S.get('diff', 0);
let wins = S.get('wins', 0), trophies = S.get('trophies', 0), muted = S.get('muted', false), gsPref = S.get('speed', 1);
if (deck.length !== 8 || deck.some(c => !owned.includes(c))) deck = START_DECK.slice();

// ================================================================ stage
const stage = createStage({ fov: 36, shadows: true, shadowSize: 12 });
const { scene, camera, renderer, sun, hemi } = stage;
hemi.color.set('#ffffff'); hemi.groundColor.set('#7da86a'); hemi.intensity = 1.2; sun.intensity = 1.6; sun.color.set('#fff2da'); sun.position.set(5, 16, 6);
document.body.style.setProperty('--bg1', '#7fc46a'); document.body.style.setProperty('--bg2', '#5ea34e'); document.body.style.setProperty('--ui', '#ff8c42');
const ui = createUI({ title: 'BRAMBLE<br>BASH', hint: '', hand: '', progress: false, score: false });
const D = daily('bramblebash', ui, { name: NAME });
const B = board({ game: 'bramblebash', label: 'Wins vs CPU', limits: { maxRun: 4, maxPerSec: 0.15 }, mode: 'sum', corner: 'tl' });
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, metalness: 0, ...o });
const VC = vcMat({ roughness: 0.5 });
const $ = h => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };

// ================================================================ arena
const AX = 5, AZ = 9.4, BR = 3, RIV = 0.75;
const TP = { small: 6.3, hearth: 8.2 };
function tileTex() {
  const c = document.createElement('canvas'); c.width = 160; c.height = 304; const x = c.getContext('2d');
  for (let i = 0; i < 10; i++) for (let j = 0; j < 19; j++) { x.fillStyle = (i + j) % 2 ? '#9ad673' : '#a8df82'; x.fillRect(i * 16, j * 16, 16, 16); }
  for (let i = 0; i < 300; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(60,130,50,.16)' : 'rgba(255,255,255,.12)'; x.fillRect(Math.random() * 160, Math.random() * 304, 2, 3); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; return t;
}
function inst(geo, mat, list, shadow = true) {
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length)), o = new THREE.Object3D(), col = new THREE.Color();
  list.forEach((it, i) => { o.position.set(it[0], it[1], it[2]); o.rotation.set(0, it[4] || 0, 0); const s = it[3]; o.scale.set(...(Array.isArray(s) ? s : [s, s, s])); o.updateMatrix(); im.setMatrixAt(i, o.matrix); if (it[5]) im.setColorAt(i, col.set(it[5])); });
  im.count = list.length; im.castShadow = shadow; im.receiveShadow = true; return im;
}
const water = new THREE.Mesh(new THREE.PlaneGeometry(AX * 2 + 1.4, RIV * 2), new THREE.MeshStandardMaterial({ color: '#4fc0ec', roughness: 0.1, metalness: 0.1 }));
(function buildArena() {
  const r = rng(42);
  const out = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), M('#6cb257')); out.rotation.x = -Math.PI / 2; out.position.y = -0.45; out.receiveShadow = true; scene.add(out);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(AX * 2 + 0.7, 0.45, AZ * 2 + 0.7), M('#9b7653')); slab.position.y = -0.23; slab.receiveShadow = true; scene.add(slab);
  const g = new THREE.Mesh(new THREE.PlaneGeometry(AX * 2 + 0.6, AZ * 2 + 0.6), M('#ffffff', { map: tileTex() })); g.rotation.x = -Math.PI / 2; g.position.y = 0.002; g.receiveShadow = true; scene.add(g);
  // lanes (dirt) + river + bridges
  for (const s of [-1, 1]) for (const t of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(1.15, TP.small - RIV), M('#e9d3a0', { roughness: 0.95 })); p.rotation.x = -Math.PI / 2; p.position.set(s * BR, 0.008, t * (RIV + (TP.small - RIV) / 2)); p.receiveShadow = true; scene.add(p); }
  for (const t of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(BR * 2 + 1.15, 1.0), M('#e9d3a0', { roughness: 0.95 })); p.rotation.x = -Math.PI / 2; p.position.set(0, 0.009, t * 7.3); p.receiveShadow = true; scene.add(p); }
  const bed = new THREE.Mesh(new THREE.BoxGeometry(AX * 2 + 0.7, 0.3, RIV * 2), M('#6f5a44')); bed.position.y = -0.17; scene.add(bed);
  water.rotation.x = -Math.PI / 2; water.position.y = -0.05; scene.add(water);
  for (const s of [-1, 1]) {
    const br = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, RIV * 2 + 0.5), M('#b07a45')); br.position.set(s * BR, 0.04, 0); br.castShadow = br.receiveShadow = true; scene.add(br);
    for (const q of [-1, 1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, RIV * 2 + 0.5), M('#8a5a3a')); rail.position.set(s * BR + q * 0.62, 0.18, 0); rail.castShadow = true; scene.add(rail); }
  }
  // bramble hedges on both banks, except at the bridges
  const bush = [];
  for (let x = -AX - 0.1; x <= AX + 0.1; x += 0.55) for (const t of [-1, 1]) { if (Math.abs(Math.abs(x) - BR) < 0.95) continue; bush.push([x + (r() - 0.5) * 0.1, 0.12, t * (RIV + 0.12), 0.48 + r() * 0.18, r() * 6, ['#3f8f3a', '#4a9c40', '#3a8536'][(x * 7 | 0) % 3 + 0 | 0] || '#3f8f3a']); }
  scene.add(inst(bushGeo(), vcMat({ roughness: 0.8 }), bush));
  // fence and trees around
  const fence = [];
  for (let x = -AX - 0.3; x <= AX + 0.31; x += 0.6) for (const t of [-1, 1]) fence.push([x, 0.18, t * (AZ + 0.32), [0.1, 0.36, 0.1], 0, '#a8794e']);
  for (let z = -AZ - 0.3; z <= AZ + 0.31; z += 0.6) for (const t of [-1, 1]) { if (Math.abs(z) < RIV + 0.2) continue; fence.push([t * (AX + 0.32), 0.18, z, [0.1, 0.36, 0.1], 0, '#a8794e']); }
  scene.add(inst(new THREE.BoxGeometry(1, 1, 1), M('#ffffff'), fence));
  const tr = [];
  for (let k = 0; k < 160 && tr.length < 70; k++) { const x = (r() * 2 - 1) * 16, z = (r() * 2 - 1) * 18; if (Math.abs(x) < AX + 1.2 && Math.abs(z) < AZ + 1.2) continue; if (z > AZ && z < AZ + 6 && Math.abs(x) < AX + 3) continue; tr.push([x, -0.45, z, 0.9 + r() * 0.9, r() * 6]); }
  scene.add(inst(treeGeo(), VC, tr));
})();
// deploy zone overlay (red where you can't drop troops)
const noGo = [-1, 1].map(s => { const m = new THREE.Mesh(new THREE.PlaneGeometry(AX, 1), new THREE.MeshBasicMaterial({ color: '#ff3355', transparent: true, opacity: 0.22, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(s * AX / 2, 0.03, 0); m.visible = false; scene.add(m); return m; });
const ghostRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false })); ghostRing.rotation.x = -Math.PI / 2; ghostRing.position.y = 0.05; ghostRing.visible = false; scene.add(ghostRing);
const ghostDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.2, depthWrite: false })); ghostDisc.rotation.x = -Math.PI / 2; ghostDisc.position.y = 0.04; ghostDisc.visible = false; scene.add(ghostDisc);

// ================================================================ camera fit
const PITCH = 1.12, camT = new THREE.Vector3(), camPos = new THREE.Vector3(); let shake = 0;
function fit() {
  const W = innerWidth, H = innerHeight, top = 66 / H, bot = (Math.max(handEl ? handEl.offsetHeight : 0, Math.min(170, 118 + innerWidth * 0.12)) + 4) / H;
  const ay0 = -1 + 2 * bot, ay1 = 1 - 2 * top, ax = 1 - 10 / W, v = new THREE.Vector3();
  const cs = [[-AX - 0.4, -AZ - 0.4, 0], [AX + 0.4, -AZ - 0.4, 0], [-AX - 0.4, AZ + 0.4, 0], [AX + 0.4, AZ + 0.4, 0], [0, -TP.hearth, 3.6]];
  let Dd = 28, tz = 0;
  for (let it = 0; it < 40; it++) {
    camera.position.set(0, Math.sin(PITCH) * Dd, tz + Math.cos(PITCH) * Dd); camera.lookAt(0, 0, tz); camera.updateMatrixWorld();
    let y0 = 9, y1 = -9, x0 = 9, x1 = -9;
    for (const [x, z, y] of cs) { v.set(x, y, z).project(camera); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); }
    const sc = Math.max((y1 - y0) / (ay1 - ay0), (x1 - x0) / (2 * ax));
    Dd *= Math.pow(sc, 0.7); tz += ((y0 + y1) / 2 - (ay0 + ay1) / 2) * -Dd * 0.18;
  }
  camT.set(0, 0, tz); camPos.copy(camera.position);
}
addEventListener('resize', () => setTimeout(fit, 30));

// ================================================================ instanced unit meshes (per type × team), hp bars, projectiles, particles
const MAXU = 32, umesh = {};
for (const t of UNIT_KEYS) for (const team of [1, -1]) {
  const m = new THREE.InstancedMesh(unitGeo(t, TEAMC[team]), VC, MAXU); m.castShadow = true; m.frustumCulled = false; m.count = 0; m.visible = false; scene.add(m); umesh[t + team] = m;
}
const MAXB = 90, barGeo = new THREE.PlaneGeometry(1, 1);
const barBg = new THREE.InstancedMesh(barGeo, new THREE.MeshBasicMaterial({ color: '#1d1726', depthTest: false, transparent: true }), MAXB), barFg = new THREE.InstancedMesh(barGeo, new THREE.MeshBasicMaterial({ depthTest: false, transparent: true }), MAXB);
barBg.renderOrder = 10; barFg.renderOrder = 11; for (const b of [barBg, barFg]) { b.frustumCulled = false; b.count = 0; scene.add(b); } barFg.setColorAt(0, new THREE.Color());
const MAXJ = 120, projMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshStandardMaterial({ roughness: 0.4 }), MAXJ); projMesh.frustumCulled = false; projMesh.count = 0; projMesh.setColorAt(0, new THREE.Color()); scene.add(projMesh);
const MAXP = 600, partMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.11, 0.11, 0.11), new THREE.MeshStandardMaterial({ roughness: 0.5 }), MAXP); partMesh.frustumCulled = false; partMesh.count = 0; partMesh.setColorAt(0, new THREE.Color()); scene.add(partMesh);
const parts = [];
function spark(x, y, z, color, n = 8, sp = 2.5, up = 3, size = 1) {
  const cols = [].concat(color).map(c => new THREE.Color(c));
  for (let i = 0; i < n && parts.length < MAXP; i++) { const a = Math.random() * 6.283; parts.push({ x, y, z, vx: Math.cos(a) * sp * (0.3 + Math.random()), vy: up * (0.4 + Math.random()), vz: Math.sin(a) * sp * (0.3 + Math.random()), life: 0.5 + Math.random() * 0.5, c: cols[i % cols.length], s: size * (0.6 + Math.random() * 0.8), r: Math.random() * 3 }); }
}
const rings = [], ringGeo = new THREE.RingGeometry(0.85, 1, 40);
function ring(x, z, r, color = '#ffffff', y = 0.06) {
  let o = rings.find(q => q.t <= 0); if (!o) { o = { m: new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })), t: 0 }; o.m.rotation.x = -Math.PI / 2; scene.add(o.m); rings.push(o); }
  o.m.material.color.set(color); o.m.position.set(x, y, z); o.r = r; o.t = 1; o.m.visible = true;
}

// ================================================================ HUD (DOM)
const css = document.createElement('style'); css.textContent = `
.bb-top{position:fixed;top:calc(8px + env(safe-area-inset-top));left:58px;right:58px;display:flex;justify-content:center;align-items:center;gap:8px;z-index:6;pointer-events:none;font-weight:800}
.bb-cr{display:flex;gap:1px;font-size:18px;background:rgba(20,30,24,.55);border-radius:12px;padding:2px 7px;align-items:center}
.bb-cr i{font-style:normal;filter:grayscale(1) opacity(.35)}.bb-cr i.on{filter:none}
.bb-cr.cpu{box-shadow:inset 0 -3px 0 #ff4d6d}.bb-cr.you{box-shadow:inset 0 -3px 0 #3a86ff}
.bb-time{min-width:74px;text-align:center;background:rgba(20,30,24,.7);border-radius:14px;padding:1px 10px;line-height:1.05}
.bb-time b{font-size:24px;display:block}.bb-time small{font-size:11px;opacity:.85;display:block;margin-top:-2px}
.bb-time.hot{background:#ff4d6d}
.bb-tr{position:fixed;top:calc(10px + env(safe-area-inset-top));right:10px;display:flex;flex-direction:column;gap:6px;z-index:7}
.bb-ib{width:42px;height:42px;border-radius:50%;border:0;background:rgba(20,30,24,.62);color:#fff;font:800 15px/1 'Baloo 2',system-ui;cursor:pointer;display:grid;place-items:center}
.bb-hand{position:fixed;left:0;right:0;bottom:0;z-index:8;display:flex;justify-content:center;padding:8px 6px calc(8px + env(safe-area-inset-bottom));background:linear-gradient(to top,rgba(38,30,22,.95) 70%,rgba(38,30,22,.0))}
.bb-hw{width:100%;max-width:440px;display:flex;flex-direction:column;gap:6px}
.bb-row{display:flex;gap:6px;align-items:flex-end;justify-content:center}
.bb-next{flex:0 0 46px;display:flex;flex-direction:column;align-items:center;font-size:11px;font-weight:800;opacity:.9}
.bb-next canvas{width:40px;height:48px;border-radius:8px;box-shadow:0 2px 0 rgba(0,0,0,.3)}
.bb-card{flex:0 1 74px;min-width:0;position:relative;border-radius:12px;cursor:pointer;transition:transform .12s;touch-action:none}
.bb-card canvas{width:100%;display:block;border-radius:12px;box-shadow:0 4px 0 rgba(0,0,0,.35);border:3px solid #fff8e8}
.bb-card .cost{position:absolute;left:-4px;top:-6px;width:26px;height:26px;border-radius:50% 50% 50% 8%;background:linear-gradient(#ffd166,#ff9f1c);color:#3a2400;font-weight:800;font-size:16px;display:grid;place-items:center;box-shadow:0 2px 0 rgba(0,0,0,.3);transform:rotate(0deg)}
.bb-card .nm{position:absolute;left:3px;right:3px;bottom:5px;font-size:11px;line-height:1;text-align:center;font-weight:800;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.8)}
.bb-card.poor canvas{filter:grayscale(.85) brightness(.75)}.bb-card.sel{transform:translateY(-10px)}.bb-card.sel canvas{border-color:#ffd23f}
.bb-sap{position:relative;height:22px;border-radius:12px;background:rgba(0,0,0,.45);margin-left:52px}
.bb-sap i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(#ffd166,#ff9f1c);border-radius:12px;transition:width .1s linear}
.bb-sap .seg{position:absolute;inset:0;border-radius:12px;background:repeating-linear-gradient(90deg,transparent 0 calc(10% - 2px),rgba(0,0,0,.35) calc(10% - 2px) 10%)}
.bb-sap b{position:absolute;left:-52px;top:-6px;width:44px;height:32px;display:grid;place-items:center;font-size:20px;background:linear-gradient(#ffd166,#ff9f1c);color:#3a2400;border-radius:50% 50% 50% 12%;box-shadow:0 2px 0 rgba(0,0,0,.3)}
.bb-x2{position:absolute;right:8px;top:0;font-size:13px;font-weight:800;color:#fff;line-height:22px}
.bb-banner{position:fixed;left:0;right:0;top:36%;text-align:center;font-weight:800;font-size:40px;line-height:1;pointer-events:none;z-index:6;text-shadow:0 4px 0 rgba(0,0,0,.25);opacity:0;transition:opacity .3s,transform .3s;transform:scale(.8)}
.bb-banner.on{opacity:1;transform:scale(1)}.bb-banner small{display:block;font-size:20px;margin-top:6px}
.bb-num{position:fixed;z-index:5;pointer-events:none;font-weight:800;font-size:16px;color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.5);transform:translate(-50%,-50%);transition:transform .7s ease-out,opacity .7s}
.bb-crown{position:fixed;z-index:9;font-size:44px;pointer-events:none;transition:all .9s cubic-bezier(.5,-0.3,.6,1)}
.bb-diff{display:flex;gap:6px;margin-top:12px}
.bb-db{border:0;border-radius:14px;padding:8px 14px;font:800 17px/1 'Baloo 2',system-ui;color:#fff;background:rgba(255,255,255,.22);cursor:pointer;box-shadow:0 3px 0 rgba(0,0,0,.2)}
.bb-db.sel{background:var(--c);transform:translateY(-2px)}
.bb-tro{font-size:16px!important;opacity:.95}
.bb-deckbtn{border:0;border-radius:16px;padding:9px 20px;font:800 18px/1 'Baloo 2',system-ui;color:#3a2400;background:linear-gradient(#ffd166,#ff9f1c);cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.25);margin-top:6px}
.bb-deckrow{display:flex;gap:4px;margin-top:6px}.bb-deckrow canvas{width:34px;height:41px;border-radius:6px;box-shadow:0 2px 0 rgba(0,0,0,.25)}
.bb-sheet{position:fixed;inset:0;z-index:49;background:rgba(24,20,16,.9);display:flex;justify-content:center;overflow:auto;padding:calc(14px + env(safe-area-inset-top)) 10px 20px}
.bb-sheet>div{width:100%;max-width:460px}
.bb-sheet h2{margin:4px 0 2px;font-size:28px;text-align:center}.bb-sheet p{margin:0 0 8px;text-align:center;font-size:14px;opacity:.85}
.bb-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}
.bb-gc{position:relative;border-radius:10px;cursor:pointer}.bb-gc canvas{width:100%;display:block;border-radius:10px;border:3px solid #fff8e8}
.bb-gc.sel canvas{border-color:#ffd23f;box-shadow:0 0 0 3px #ffd23f}.bb-gc.lock canvas{filter:grayscale(1) brightness(.5)}
.bb-gc .cost{position:absolute;left:-3px;top:-5px;width:22px;height:22px;border-radius:50%;background:#ffb000;color:#3a2400;font-weight:800;font-size:13px;display:grid;place-items:center}
.bb-gc .nm{position:absolute;left:2px;right:2px;bottom:4px;font-size:10.5px;line-height:1;text-align:center;font-weight:800;text-shadow:0 1px 2px rgba(0,0,0,.9)}
.bb-gc .lk{position:absolute;inset:0;display:grid;place-items:center;font-size:12px;font-weight:800;text-align:center;padding:4px}
.bb-info{min-height:40px;text-align:center;font-size:15px;margin:8px 0;font-weight:600}
.bb-done{display:block;margin:10px auto 0;border:0;border-radius:16px;padding:10px 30px;font:800 20px/1 'Baloo 2',system-ui;color:#fff;background:#3ab795;cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.25)}
.hc-card{background:linear-gradient(rgba(30,24,16,.6),rgba(30,24,16,.2) 55%,rgba(30,24,16,.55))}
.hc-card h1{font-size:clamp(40px,12vw,70px)}
`; document.head.appendChild(css);
const top = $(`<div class="bb-top"><div class="bb-cr cpu" data-c="-1"><i>👑</i><i>👑</i><i>👑</i></div><div class="bb-time"><b>3:00</b><small>CPU · Easy</small></div><div class="bb-cr you" data-c="1"><i>👑</i><i>👑</i><i>👑</i></div></div>`);
const trb = $(`<div class="bb-tr"><button class="bb-ib" data-mute>🔊</button><button class="bb-ib" data-spd>×1</button></div>`);
const handEl = $(`<div class="bb-hand"><div class="bb-hw"><div class="bb-row"></div><div class="bb-sap"><i></i><div class="seg"></div><b>5</b><span class="bb-x2"></span></div></div></div>`);
const banner = $(`<div class="bb-banner"></div>`);
document.body.append(top, trb, handEl, banner);
for (const el of [trb, handEl]) el.addEventListener('pointerdown', e => e.stopPropagation());
trb.querySelector('[data-mute]').onclick = () => { muted = !muted; S.set('muted', muted); paintMute(); };
const paintMute = () => trb.querySelector('[data-mute]').textContent = muted ? '🔇' : '🔊'; paintMute();
trb.querySelector('[data-spd]').onclick = () => { gs = gs === 1 ? 2 : gs === 2 ? 3 : 1; gsPref = gs; S.set('speed', gs); paintSpeed(); sfx.tap(); };
const paintSpeed = () => trb.querySelector('[data-spd]').textContent = '×' + gs;
let bannerT = 0;
function showBanner(h, ms = 1500) { banner.innerHTML = h; banner.classList.add('on'); clearTimeout(bannerT); bannerT = setTimeout(() => banner.classList.remove('on'), ms); }
const nums = [];
const toScreen = (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; };
function dmgNum(x, y, z, txt, color = '#fff') {
  let d = nums.find(q => !q.busy); if (!d) { if (nums.length > 24) return; d = { el: $(`<div class="bb-num"></div>`), busy: false }; document.body.appendChild(d.el); nums.push(d); }
  const [sx, sy] = toScreen(x, y, z); d.busy = true; d.el.textContent = txt; d.el.style.color = color; d.el.style.transition = 'none'; d.el.style.left = sx + 'px'; d.el.style.top = sy + 'px'; d.el.style.opacity = 1; d.el.style.transform = 'translate(-50%,-50%) scale(1.2)';
  void d.el.offsetWidth; d.el.style.transition = ''; d.el.style.transform = 'translate(-50%,-180%) scale(1)'; d.el.style.opacity = 0; setTimeout(() => d.busy = false, 720);
}

// ================================================================ match state
let state = 'ready', gs = 1, T = 0, overtime = false, ents = [], projs = [], eid = 0, crowns = { 1: 0, [-1]: 0 }, sap = { 1: 5, [-1]: 5 };
let hands = {}, cpuDeck = [], cpuThink = 1, matchT0 = 0, recorded = false, matchDiff = 0, beatenShown = false, ended = false, cpuPlan = null;
const towers = [];
let REG = 180; const OT = 60;
let camp = null, hpScale = { 1: 1, [-1]: 1 }, thinkMul = 1, regen = { 1: 1, [-1]: 1 }, zones = [], acorn = null, acornT = 0, hiveT = 0, boostCpuDelay = 0, comeFrom = 0;

function makeHand(d, r) { const q = d.slice(); for (let i = q.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [q[i], q[j]] = [q[j], q[i]]; } return { hand: q.slice(0, 4), queue: q.slice(4) }; }
function cycle(team, i) { const h = hands[team], c = h.hand[i]; h.hand[i] = h.queue.shift(); h.queue.push(c); return c; }

function addTower(team, kind, lane) {
  const def = kind === 'hearth' ? { hp: 3000, dmg: 75, rate: 1.0, range: 4.6, r: 1.2 } : { hp: 1500, dmg: 55, rate: 0.85, range: 4.4, r: 0.85 };
  const t = { id: ++eid, team, kind: 'tower', sub: kind, lane, x: lane * BR, z: team * TP[kind], hp: def.hp * hpScale[team], max: def.hp * hpScale[team], def: { ...def, air: true, proj: 'arrow' }, r: def.r, cd: 0, active: kind !== 'hearth', y: 0, flash: 0 };
  t.mesh = new THREE.Mesh(towerGeo(kind, TEAMC[team]), VC); t.mesh.castShadow = true; t.mesh.receiveShadow = true; t.mesh.position.set(t.x, 0, t.z); t.mesh.rotation.y = team === 1 ? Math.PI : 0; scene.add(t.mesh);
  ents.push(t); towers.push(t); return t;
}
function cpuDeckFor(r) {
  if (matchDiff === 0 && !D.seed) return START_DECK.slice();
  for (let tries = 0; tries < 50; tries++) {
    const pool = ALL.slice(), d = []; while (d.length < 8) d.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    const air = d.some(c => CARDS[c].air || c === 'volley'), spell = d.some(c => CARDS[c].kind === 'spell'), tank = d.some(c => ['brute', 'bear', 'knight', 'badger'].includes(c));
    if (air && spell && tank) return d;
  }
  return START_DECK.slice();
}
function startMatch() {
  for (const e of ents) if (e.mesh) scene.remove(e.mesh);
  ents = []; projs = []; towers.length = 0; parts.length = 0; crowns = { 1: 0, [-1]: 0 }; sap = { 1: 5, [-1]: 5 };
  matchDiff = D.seed ? 1 : diff;
  const r = rng(D.seed ? D.seed : (Date.now() & 0xffffff));
  const C = DEEP && !D.seed ? camp : null; camp = C;
  REG = 180; hpScale = { 1: 1, [-1]: 1 }; thinkMul = 1; regen = { 1: 1, [-1]: 1 }; zones.forEach(z => scene.remove(z.m)); zones = []; if (acorn) { scene.remove(acorn.m); acorn = null; } acornT = 14; hiveT = 20; acornGot = 0;
  if (C) {
    matchDiff = C.ai; cpuDeck = C.deck.slice(); REG = C.t; hpScale = { 1: C.myHp, [-1]: C.cpuHp * ((C.mods || []).includes('boss') ? 1.25 : 1) }; thinkMul = C.think;
    sap = { 1: C.sap0, [-1]: Math.min(C.sap0, 5) };
    const mods = C.mods || []; if (mods.includes('storm')) regen = { 1: 1.5, [-1]: 1.5 }; if (C.cpuRegen) regen[-1] *= C.cpuRegen;
  } else cpuDeck = cpuDeckFor(r);
  const pdeck = C && C.fixed ? C.fixed : deck;
  hands = { 1: makeHand(pdeck, r), [-1]: makeHand(cpuDeck, r) };
  if (C && C.hand) { const h = hands[1]; C.hand.forEach((c, i) => { const all = h.hand.concat(h.queue), k = all.indexOf(c); if (k < 0 || h.hand[i] === c) return; if (k < 4) { [h.hand[i], h.hand[k]] = [h.hand[k], h.hand[i]]; } else { const q = h.queue, qi = k - 4; [h.hand[i], q[qi]] = [q[qi], h.hand[i]]; } }); }
  for (const team of [1, -1]) { addTower(team, 'small', -1); addTower(team, 'small', 1); addTower(team, 'hearth', 0); }
  if (C && (C.mods || []).includes('noleft')) { const t = towers.find(q => q.team === 1 && q.sub === 'small' && q.lane === -1); t.dead = true; t.hp = 0; scene.remove(t.mesh); t.mesh = new THREE.Mesh(towerGeo('rubble', TEAMC[1]), VC); t.mesh.position.set(t.x, 0, t.z); scene.add(t.mesh); crowns[-1] = 1; towers.find(q => q.team === 1 && q.sub === 'hearth').active = true; }
  if (C && C.open) C.open.forEach((t, i) => { spawnUnit(-1, t, (i % 2 ? 1 : -1) * 2.2, -4.5 - i, 0.4); });
  T = 0; overtime = false; recorded = false; ended = false; beatenShown = false; cpuThink = 2.5 + (C ? C.delay : 0); cpuPlan = null; selected = -1;
  gs = gsPref; paintSpeed(); matchT0 = performance.now(); B.start();
  top.querySelector('.bb-time small').textContent = C ? C.opp : `CPU · ${DIFF[matchDiff].name}`;
  state = 'play'; paintHand(); paintCrowns(); handEl.style.visibility = ''; top.style.visibility = ''; fit();
  if (C) { campIntro(C); } else showBanner(`BATTLE!<small>vs ${DIFF[matchDiff].name} CPU${D.seed ? ' · daily' : ''}</small>`, 1600);
  sfx.win();
}

// ================================================================ spawning
function spawnUnit(team, type, x, z, delay = 1) {
  const d = CARDS[type];
  const u = { id: ++eid, team, type, kind: d.kind === 'bld' ? 'bld' : 'troop', def: d, x, z, hp: d.hp, max: d.hp, r: d.r, cd: 0.3, spawn: delay, tgt: null, retarget: 0, slowT: 0, slowF: 0, face: team === 1 ? Math.PI : 0, walk: 0, atk: 0, flash: 0, life: d.life || 0, charge: 0, y: d.fly ? 1.0 : 0, moved: false };
  ents.push(u); return u;
}
function deploy(team, idx, x, z) {
  const type = hands[team].hand[idx], d = CARDS[type];
  if (sap[team] < d.cost || !canDeploy(team, type, x, z)) return false;
  sap[team] -= d.cost; cycle(team, idx);
  if (d.kind === 'spell') castSpell(team, type, x, z);
  else if (d.kind === 'bld') { spawnUnit(team, type, x, z, 1); spark(x, 0.3, z, ['#e9dcc0', '#fff'], 10, 2, 2); }
  else {
    const n = d.n;
    for (let i = 0; i < n; i++) { const a = i / n * 6.283 + 0.4, rr = n > 1 ? 0.38 : 0; spawnUnit(team, type, clamp(x + Math.cos(a) * rr, -AX + 0.2, AX - 0.2), z + Math.sin(a) * rr, d.anywhere ? 1.4 : 1); }
    if (d.anywhere) spark(x, 0.2, z, ['#8b6a49', '#5a3a20'], 16, 2.5, 3); else spark(x, 0.2, z, ['#ffffff', TEAMC[team]], 10, 2, 2.5);
  }
  ring(x, z, d.rad || 1, TEAMC[team]);
  if (team === 1) { tone(420, 0.08, 'triangle', 0.12, 1.5); buzz(15); if (DEEP) { shake = Math.max(shake, 0.12); spark(x, 0.15, z, ['#c9b18a', '#fff'], 8, 1.6, 1.6); } } else tone(300, 0.06, 'triangle', 0.05, 1.4);
  if (team === 1) paintHand();
  return true;
}
function canDeploy(team, type, x, z) {
  const d = CARDS[type];
  if (Math.abs(x) > AX - 0.15 || Math.abs(z) > AZ - 0.2) return false;
  if (d.kind === 'spell') return true;
  if (Math.abs(z) < RIV + 0.25) return false;
  for (const t of towers) if (!t.dead && Math.hypot(t.x - x, t.z - z) < t.r) return false;
  if (d.anywhere) return true;
  const zz = z * team;   // positive = own half
  if (zz >= RIV + 0.25) return true;
  const side = x < 0 ? -1 : 1, enemySmall = towers.find(t => t.team === -team && t.sub === 'small' && t.lane === side);
  return enemySmall && enemySmall.dead && zz > -4.2;
}
function castSpell(team, type, x, z) {
  const d = CARDS[type], hz = team * TP.hearth;
  if (d.roll) { projs.push({ kind: 'boulder', team, x, z, vz: -team * 3.4, dist: 6.5, dmg: d.dmg, hit: new Set() }); return; }
  projs.push({ kind: 'spell', type, team, x0: 0, z0: hz, x, z, t: 0, T: d.kind === 'spell' && type === 'volley' ? 0.8 : 0.45, h: 4 });
}
function applySpell(p) {
  const d = CARDS[p.type];
  if (p.type === 'heal') { for (const e of ents) if (!e.dead && e.team === p.team && e.kind !== 'tower' && (e.x - p.x) ** 2 + (e.z - p.z) ** 2 < d.rad * d.rad) { e.hp = Math.min(e.max, e.hp + d.heal); spark(e.x, 0.6, e.z, '#7dffcb', 4, 1, 2); } ring(p.x, p.z, d.rad, '#7dffcb'); spark(p.x, 0.3, p.z, ['#ffffff', '#c8fff0'], 24, 2.5, 2); if (!muted) [660, 880].forEach((f, i) => setTimeout(() => tone(f, 0.12, 'sine', 0.08, 1.2), i * 80)); return; }
  for (const e of ents) {
    if (e.dead || e.team === p.team) continue; const rr = d.rad + e.r * 0.6;
    if ((e.x - p.x) ** 2 + (e.z - p.z) ** 2 > rr * rr) continue;
    hurt(e, e.kind === 'tower' ? d.dmg * 0.35 : d.dmg, p.team);
    if (d.slow && e.kind !== 'tower') { e.slowT = d.dur; e.slowF = d.slow; }
  }
  ring(p.x, p.z, d.rad, p.type === 'snare' ? '#ffb000' : '#ffd9a0'); ring(p.x, p.z, d.rad * 0.6, '#ffffff');
  spark(p.x, 0.3, p.z, p.type === 'snare' ? ['#ffb000', '#ffd166'] : ['#8a5a3a', '#c99a68', '#5a3a20'], 26, 3.5, 3.5, 1.2);
  shake = Math.max(shake, 0.15); if (!muted) { tone(110, 0.2, 'square', 0.1, 0.5); tone(70, 0.25, 'sawtooth', 0.06, 0.5); }
}

// ================================================================ combat
function hurt(e, dmg, by) {
  if (e.dead) return; e.hp -= dmg; e.flash = 1;
  if (e.kind === 'tower') { if (e.sub === 'hearth') e.active = true; if (DEEP) shake = Math.max(shake, e.team === -1 ? 0.1 : 0.14); if (Math.random() < 0.5 || dmg > 100) dmgNum(e.x, 3, e.z, '-' + Math.round(dmg), e.team === 1 ? '#ffd0d8' : '#fff3a0'); }
  if (e.hp <= 0) kill(e, by);
}
function kill(e, by) {
  e.dead = true;
  if (e.kind === 'tower') {
    scene.remove(e.mesh); e.mesh = new THREE.Mesh(towerGeo('rubble', TEAMC[e.team]), VC); e.mesh.position.set(e.x, 0, e.z); e.mesh.castShadow = true; scene.add(e.mesh);
    spark(e.x, 1.4, e.z, ['#8a5a3a', '#c99a68', TEAMC[e.team], '#fff'], 60, 5, 6, 1.6); ring(e.x, e.z, 3, '#ffffff'); shake = 0.7; buzz([40, 30, 80]);
    sfx.smash(); setTimeout(() => sfx.smash(), 120);
    const other = -e.team, n = e.sub === 'hearth' ? 3 - crowns[other] : 1; crowns[other] += n; flyCrown(e, other, n);
    if (e.sub !== 'hearth') { const h = towers.find(t => t.team === e.team && t.sub === 'hearth'); if (h) h.active = true; }
    paintCrowns();
    if (e.sub === 'hearth') return setTimeout(() => endMatch(other), 700);
    if (overtime) return setTimeout(() => endMatch(other), 700);
    showBanner(e.team === -1 ? 'TOWER DOWN!<small>you can deploy further now</small>' : 'TOWER LOST!', 1400);
    return;
  }
  spark(e.x, 0.4 + e.y, e.z, ['#ffffff', '#f2eadf', TEAMC[e.team]], e.def.hp > 1000 ? 22 : 9, 2.5, 2.8, e.def.hp > 1000 ? 1.4 : 0.9);
  if (DEEP && e.team === -1 && by === 1) {
    const now = performance.now(); killChain = now - lastKill < 2200 ? killChain + 1 : 1; lastKill = now;
    shake = Math.max(shake, 0.12 + Math.min(killChain, 6) * 0.05); ring(e.x, e.z, 1.2 + killChain * 0.2, '#ffd166');
    spark(e.x, 0.8 + e.y, e.z, ['#ffd166', '#ffffff', '#ff9bb0'], 8 + killChain * 4, 3, 3.4, 1);
    dmgNum(e.x, 2.2, e.z, killChain > 1 ? 'CHAIN x' + killChain + '!' : 'POP!', killChain > 2 ? '#ffd166' : '#ffffff');
    if (!muted) tone(420 + killChain * 70, 0.12, 'triangle', 0.09, 1.6);
    if (e.def.hp > 1000) buzz([30, 20, 50]);
  }
  if (!muted && Math.random() < 0.7) tone(500 + Math.random() * 200, 0.07, 'sine', 0.07, 1.8);
}
let killChain = 0, lastKill = 0;
function flyCrown(t, team, n) {
  const [sx, sy] = toScreen(t.x, 2.5, t.z), tgt = top.querySelector(`[data-c="${team}"]`).getBoundingClientRect();
  for (let i = 0; i < n; i++) { const c = $(`<div class="bb-crown">👑</div>`); c.style.left = sx - 22 + i * 20 + 'px'; c.style.top = sy - 22 + 'px'; document.body.appendChild(c); setTimeout(() => { c.style.left = tgt.left + tgt.width / 2 - 22 + 'px'; c.style.top = tgt.top - 10 + 'px'; c.style.transform = 'scale(.5)'; c.style.opacity = 0.6; }, 60 + i * 120); setTimeout(() => c.remove(), 1100 + i * 120); }
}
const canHit = (a, b) => !b.dead && b.team !== a.team && (!b.def.fly || a.def.air || a.kind === 'tower') && (!a.def.bld || b.kind !== 'troop');
const sight = 5.2;
function findTarget(u) {
  let best = null, bd = 1e9;
  const range = u.kind === 'troop' ? sight : u.def.range + 0.3;
  for (const e of ents) {
    if (!canHit(u, e) || e.spawn > 0) continue; const d = Math.hypot(e.x - u.x, e.z - u.z) - e.r;
    if (d > range) continue; const w = d + (e.kind === 'tower' ? 0.8 : 0); if (w < bd) { bd = w; best = e; }
  }
  if (!best && u.kind === 'troop') {
    const side = u.x < 0 ? -1 : 1; const s = towers.find(t => t.team !== u.team && t.sub === 'small' && t.lane === side && !t.dead);
    best = s || towers.find(t => t.team !== u.team && t.sub === 'hearth' && !t.dead) || null;
  }
  return best;
}
function moveToward(u, gx, gz, sp, h) {
  if (!u.def.fly && Math.sign(gz || 1) !== Math.sign(u.z || 1) && Math.abs(u.z) > 0.01) {
    const bx = u.x < 0 ? -BR : BR;
    if (Math.abs(u.z) > RIV + 0.05 && Math.abs(u.x - bx) > 0.35) { gx = bx; gz = Math.sign(u.z) * (RIV + 0.2); }
    else { gx = bx + clamp(u.x - bx, -0.3, 0.3); gz = -Math.sign(u.z) * (RIV + 0.6); }
  }
  const dx = gx - u.x, dz = gz - u.z, d = Math.hypot(dx, dz) || 1, st = Math.min(d, sp * h);
  u.x += dx / d * st; u.z += dz / d * st; u.face = Math.atan2(dx, dz); u.moved = true;
}
function shoot(u, t) {
  const d = u.def, k = d.proj;
  if (!k) { hurt(t, d.dmg * (u.charge > 1.6 ? 2 : 1), u.team); if (u.charge > 1.6) { spark(t.x, 0.5, t.z, '#ffffff', 10, 3, 2); ring(t.x, t.z, 1, '#ffffff'); } u.charge = 0; spark(t.x, 0.5 + (t.y || 0), t.z, '#fff8e8', 3, 1.5, 1.5, 0.7); if (!muted && Math.random() < 0.5) tone(180 + Math.random() * 60, 0.05, 'square', 0.04, 0.6); return; }
  const y0 = u.kind === 'tower' ? (u.sub === 'hearth' ? 3.0 : 2.0) : 0.5 + u.y;
  projs.push({ kind: k, team: u.team, x: u.x, y: y0, z: u.z, tgt: t, tx: t.x, tz: t.z, dmg: d.dmg, splash: d.splash || 0, src: u, sp: k === 'bomb' || k === 'ball' ? 7 : 11, col: k === 'arrow' ? '#6b4630' : k === 'spark' ? '#fff3a0' : k === 'bomb' ? '#2b2b35' : '#4a4f5c', y0, dist0: Math.hypot(t.x - u.x, t.z - u.z) });
  if (!muted && Math.random() < 0.35) tone(k === 'arrow' ? 900 : 260, 0.04, 'triangle', 0.04, 0.6);
}
function stepUnits(h) {
  for (const u of ents) {
    if (u.dead) continue;
    if (u.spawn > 0) { u.spawn -= h; continue; }
    if (u.kind === 'tower' && !u.active) continue;
    if (u.kind === 'bld') { u.hp -= u.max / u.def.life * h; if (u.hp <= 0) { kill(u, 0); continue; } }
    u.slowT -= h; const slow = u.slowT > 0 ? 1 - u.slowF : 1;
    u.cd -= h * slow; u.retarget -= h;
    if (!u.tgt || u.tgt.dead || u.retarget <= 0) { u.tgt = findTarget(u); u.retarget = 0.35; }
    const t = u.tgt; u.moved = false;
    if (!t) continue;
    const dist = Math.hypot(t.x - u.x, t.z - u.z) - t.r - u.r * 0.5;
    if (dist <= u.def.range) { if (u.kind !== 'tower') u.face = Math.atan2(t.x - u.x, t.z - u.z); if (u.cd <= 0) { u.cd = u.def.rate; u.atk = 1; shoot(u, t); } }
    else if (u.kind === 'troop') { if (u.def.charge) u.charge += h; moveToward(u, t.x, t.z, u.def.spd * slow * (u.def.charge && u.charge > 1.6 ? 1.9 : 1), h); }
  }
  // gentle separation so crowds don't stack
  for (let i = 0; i < ents.length; i++) {
    const a = ents[i]; if (a.dead || a.kind !== 'troop' || a.spawn > 0) continue;
    for (let j = 0; j < ents.length; j++) {
      const b = ents[j]; if (i === j || b.dead || (b.def.fly !== a.def.fly && b.kind === 'troop')) continue;
      const dx = a.x - b.x, dz = a.z - b.z, rr = a.r + b.r * (b.kind === 'troop' ? 0.9 : 1), d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2), push = (rr - d) * (b.kind === 'troop' ? 0.5 : 1); a.x += dx / d * push; a.z += dz / d * push; }
    }
    a.x = clamp(a.x, -AX + 0.2, AX - 0.2); a.z = clamp(a.z, -AZ + 0.2, AZ - 0.2);
    if (!a.def.fly && Math.abs(a.z) < RIV + 0.1) { const bx = a.x < 0 ? -BR : BR; a.x = clamp(a.x, bx - 0.5, bx + 0.5); }
  }
}
function stepProj(h) {
  for (let i = projs.length - 1; i >= 0; i--) {
    const p = projs[i];
    if (p.kind === 'spell') { p.t += h; if (p.t >= p.T) { applySpell(p); projs.splice(i, 1); } continue; }
    if (p.kind === 'boulder') {
      const st = Math.abs(p.vz) * h; p.z += p.vz * h; p.dist -= st; p.rot = (p.rot || 0) + st * 2;
      for (const e of ents) { if (e.dead || e.team === p.team || e.def.fly || p.hit.has(e.id)) continue; if ((e.x - p.x) ** 2 + (e.z - p.z) ** 2 < (0.8 + e.r) ** 2) { p.hit.add(e.id); hurt(e, e.kind === 'tower' ? p.dmg * 0.35 : p.dmg, p.team); if (e.kind === 'troop') e.z += Math.sign(p.vz) * 0.7; spark(e.x, 0.3, e.z, '#c9c2b6', 6, 2, 2); } }
      if (Math.random() < 0.3) spark(p.x, 0.1, p.z, '#c9b79c', 1, 1, 1);
      if (p.dist <= 0 || Math.abs(p.z) > AZ) { spark(p.x, 0.4, p.z, ['#9aa0a8', '#c9c2b6'], 14, 2.5, 3); projs.splice(i, 1); }
      continue;
    }
    if (p.tgt && !p.tgt.dead) { p.tx = p.tgt.x; p.tz = p.tgt.z; }
    const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz), st = p.sp * h;
    const ty = p.tgt ? 0.4 + (p.tgt.y || 0) + (p.tgt.kind === 'tower' ? 1 : 0) : 0.3;
    if (d <= st + 0.05) {
      if (p.splash) { for (const e of ents) if (!e.dead && e.team !== p.team && !e.def.fly && (e.x - p.tx) ** 2 + (e.z - p.tz) ** 2 < (p.splash + e.r * 0.5) ** 2) hurt(e, p.dmg, p.team); ring(p.tx, p.tz, p.splash, '#ffb000'); spark(p.tx, 0.3, p.tz, ['#ffb000', '#ff6b3d', '#3a3a3a'], 12, 2.5, 3); if (!muted) tone(90, 0.15, 'square', 0.07, 0.5); }
      else if (p.tgt && !p.tgt.dead) hurt(p.tgt, p.dmg, p.team);
      projs.splice(i, 1); continue;
    }
    p.x += dx / d * st; p.z += dz / d * st; const u = 1 - d / Math.max(0.01, p.dist0); p.y = lerp(p.y0, ty, u) + (p.kind === 'bomb' || p.kind === 'ball' ? Math.sin(u * Math.PI) * 1.2 : 0);
  }
}

// ================================================================ CPU (and the QA bot, with the same brain): same rules, sees only the board
function aiThink(team, lvl) {
  const h = hands[team].hand, mySap = sap[team], r = Math.random;
  const affordable = h.map((c, i) => [c, i]).filter(([c]) => CARDS[c].cost <= mySap);
  if (!affordable.length) return false;
  const threats = ents.filter(e => !e.dead && e.team !== team && e.kind === 'troop' && e.spawn <= 0 && e.z * team > -1.5).sort((a, b) => b.z * team - a.z * team);
  const own = (x, z) => [clamp(x, -AX + 0.4, AX - 0.4), team * clamp(z, RIV + 0.4, AZ - 0.5)];
  if (lvl === 0 && r() < 0.45) return false;                    // Easy: hesitates
  if (threats.length) {
    const t = threats[0], air = t.def.fly, heavy = t.max > 1500;
    // spells on a clump (Normal+)
    if (lvl >= 1) {
      const clump = threats.filter(e => Math.hypot(e.x - t.x, e.z - t.z) < 1.6);
      const sp = affordable.find(([c]) => (c === 'volley' || c === 'snare') && clump.length >= (c === 'volley' ? 3 : 2));
      if (sp) return deploy(team, sp[1], t.x, t.z + (t.def.spd || 0) * -team * 0.4);
    }
    let pick = null;
    if (lvl === 0) pick = affordable.filter(([c]) => CARDS[c].kind !== 'spell')[Math.floor(r() * affordable.length)] || affordable[0];
    else {
      const score = ([c]) => { const d = CARDS[c]; if (d.kind === 'spell') return -9; let s = 0;
        if (air) s += d.air ? 6 : -8; if (heavy) s += (d.dmg * (d.n || 1)) / 40 + (c === 'cannon' ? 3 : 0); else s += (d.splash || d.n > 2 ? 3 : 0);
        if (d.bld && d.kind === 'troop') s -= 6; s -= d.cost * (lvl === 2 ? 0.6 : 0.9); if (c === 'mole') s -= 3; return s; };
      pick = affordable.slice().sort((a, b) => score(b) - score(a))[0];
      if (pick && CARDS[pick[0]].kind === 'spell') pick = null;
    }
    if (!pick || (lvl < 2 && mySap < CARDS[pick[0]].cost + (r() < 0.5 ? 1 : 0) && t.z * team < 3)) return false;
    const d = CARDS[pick[0]];
    let px = t.x, pz = t.z * team + (d.proj ? 2.4 : 1.0);
    if (d.kind === 'bld') { px = clamp(t.x * 0.4, -2, 2); pz = 4.2; }
    const [x, z] = own(px, pz); return deploy(team, pick[1], x, z);
  }
  // no threats: build a push
  const thr = lvl === 0 ? 5 + r() * 5 : lvl === 1 ? 8.5 : (cpuPlan ? 3 : 8);
  if (mySap < thr && !(lvl >= 1 && mySap >= 9.8)) return false;
  const enemyTowers = towers.filter(t => t.team !== team && t.sub === 'small' && !t.dead);
  let lane = enemyTowers.length ? enemyTowers.sort((a, b) => a.hp - b.hp)[0].lane : (r() < 0.5 ? -1 : 1);
  if (lvl === 0) lane = r() < 0.5 ? -1 : 1;
  // finish a weak tower with a spell (Hard)
  if (lvl === 2) { const weak = towers.find(t => t.team !== team && !t.dead && t.hp < 110); const sp = affordable.find(([c]) => c === 'volley' || c === 'boulder'); if (weak && sp) return deploy(team, sp[1], weak.x, weak.z); }
  const mine = ents.filter(e => !e.dead && e.team === team && e.kind === 'troop' && e.max > 1000);
  const tank = affordable.find(([c]) => ['bear', 'brute', 'badger', 'knight'].includes(c));
  const trp = affordable.filter(([c]) => CARDS[c].kind === 'troop');
  if (mine.length && trp.length && lvl >= 1) { const lead = mine[0], p = trp.find(([c]) => !['bear', 'brute'].includes(c)) || trp[0]; const [x, z] = lead.z * team > RIV ? own(lead.x, lead.z * team + 1.2) : own(lead.x, 2); cpuPlan = null; return deploy(team, p[1], x, z); }
  const p = (lvl >= 1 && tank) || trp[Math.floor(r() * trp.length)] || null;
  if (!p) return false;
  if (CARDS[p[0]].anywhere && lvl >= 1) { const tt = enemyTowers[0]; if (tt) return deploy(team, p[1], tt.x + 0.2, tt.z + team * 1.3); }
  const [x, z] = CARDS[p[0]].spd < 0.8 ? own(lane * BR, 7.6) : own(lane * BR, lvl === 0 ? 2 + r() * 4 : 1.5); cpuPlan = lvl === 2; return deploy(team, p[1], x, z);
}

// ================================================================ match flow
function paintCrowns() { for (const t of [1, -1]) top.querySelectorAll(`[data-c="${t}"] i`).forEach((el, i) => el.classList.toggle('on', i < crowns[t])); }
function endMatch(winner) {
  if (ended) return; ended = true;
  const won = winner === 1, draw = winner === 0, ms = performance.now() - matchT0;
  if (!recorded) { recorded = true; F.level(won, crowns[1] / 3); B.submit(won ? (matchDiff === 2 ? 2 : 1) : 0, { ms }); }
  if (camp) { endCamp(won, draw); selected = -1; hideGhost(); return; }
  if (won) {
    wins++; S.set('wins', wins); trophies += 25 + matchDiff * 10 + crowns[1] * 2; S.set('trophies', trophies);
    const next = UNLOCKS.find(c => !owned.includes(c)); let extra = '';
    if (next) { owned.push(next); S.set('owned', owned); extra = ` · New card: ${CARDS[next].name}!`; }
    D.won(wins, 'won');
    if (!beatenShown && D.beaten(wins)) { beatenShown = true; ui.pop('BEATEN!', '#ffd23f', 44); }
    state = 'won'; sfx.win(); buzz([30, 40, 60]); confetti(scene, new THREE.Vector3(0, 2, -6), 120);
    ui.els.win.children[0].innerHTML = `WIN <span data-l>1</span>`; ui.els.win.querySelector('h1').textContent = 'VICTORY!';
    ui.win(wins, `${crowns[1]} – ${crowns[-1]} crowns vs ${DIFF[matchDiff].name} CPU · 🏆 ${trophies}${extra}`);
  } else {
    if (!draw) { trophies = Math.max(0, trophies - 12); S.set('trophies', trophies); }
    state = 'lost'; sfx.fail(); buzz([60, 40, 120]);
    ui.lose(draw ? 'DRAW!' : 'DEFEAT', `${crowns[1]} – ${crowns[-1]} crowns vs ${DIFF[matchDiff].name} CPU · 🏆 ${trophies}`);
  }
  selected = -1; hideGhost();
}
function clockEnd() {
  if (crowns[1] !== crowns[-1]) return endMatch(crowns[1] > crowns[-1] ? 1 : -1);
  if (!overtime) { overtime = true; T = 0; showBanner('OVERTIME!<small>next tower wins · double sap</small>', 1800); tone(220, 0.3, 'square', 0.08, 1.5); return; }
  const frac = t => towers.filter(q => q.team === t).reduce((s, q) => s + Math.max(0, q.hp) / q.max, 0);
  const a = frac(1), b = frac(-1); endMatch(Math.abs(a - b) < 0.01 ? 0 : a > b ? 1 : -1);
}

// ================================================================ step
function step(h) {
  T += h;
  const left = (overtime ? OT : REG) - T, dbl = overtime || left <= 60;
  for (const t of [1, -1]) sap[t] = Math.min(10, sap[t] + h / 2.8 * (dbl ? 2 : 1) * regen[t]);
  if (!overtime && left <= 60 && left + h > 60) { showBanner('2× SAP!<small>last minute</small>', 1500); tone(660, 0.15, 'triangle', 0.1, 1.3); }
  cpuThink -= h;
  if (cpuThink <= 0) { aiThink(-1, matchDiff); cpuThink = DIFF[matchDiff].think * thinkMul / F.k() * (0.75 + Math.random() * 0.5); }
  if (camp) twists(h);
  stepUnits(h); stepProj(h);
  let j = 0; for (let i = 0; i < ents.length; i++) if (!ents[i].dead || ents[i].kind === 'tower') ents[j++] = ents[i]; ents.length = j;
  if (left <= 0 && !ended) clockEnd();
}

// ================================================================ render
const O = new THREE.Object3D(), COL = new THREE.Color(), camQ = new THREE.Quaternion(), camR = new THREE.Vector3();
let hudT = 0;
function render(dt, now) {
  const cnt = {};
  for (const k in umesh) cnt[k] = 0;
  let nb = 0;
  const bar = (x, y, z, w, f, col) => { if (nb >= MAXB) return; const hgt = w > 1 ? 0.2 : 0.11;
    O.position.set(x, y, z); O.quaternion.copy(camQ); O.scale.set(w + 0.06, hgt + 0.06, 1); O.updateMatrix(); barBg.setMatrixAt(nb, O.matrix);
    O.position.set(x - camR.x * w * (1 - f) / 2, y - camR.y * w * (1 - f) / 2, z - camR.z * w * (1 - f) / 2); O.scale.set(Math.max(0.001, w * f), hgt, 1); O.updateMatrix(); barFg.setMatrixAt(nb, O.matrix); barFg.setColorAt(nb, COL.set(col)); nb++; };
  for (const e of ents) {
    if (e.kind === 'tower') {
      e.flash *= Math.pow(0.85, dt);
      if (!e.dead) { const s = 1 + e.flash * 0.05; e.mesh.scale.set(s, 1 - e.flash * 0.04, s); bar(e.x, e.sub === 'hearth' ? 4.6 : 3.4, e.z, e.sub === 'hearth' ? 1.8 : 1.4, e.hp / e.max, e.team === 1 ? '#5aa9ff' : '#ff5d7a'); }
      continue;
    }
    if (e.dead) continue;
    const k = e.type + e.team, m = umesh[k]; if (!m || cnt[k] >= MAXU) continue;
    e.atk *= Math.pow(0.8, dt); e.flash *= Math.pow(0.8, dt); e.walk += e.moved ? dt * 0.25 : 0;
    const bob = e.moved ? Math.abs(Math.sin(e.walk)) : 0, sq = e.spawn > 0 ? Math.max(0.05, 1 - e.spawn) : 1;
    const big = e.type === 'bear' ? 1.45 : e.type === 'brute' ? 1.25 : 1.38, lunge = e.atk * 0.18;
    O.position.set(e.x + Math.sin(e.face) * lunge, e.y + bob * 0.08 + (e.def.fly ? Math.sin(now * 6 + e.id) * 0.08 : 0) + (e.spawn > 0 && e.def.anywhere ? -0.3 * e.spawn : 0), e.z + Math.cos(e.face) * lunge);
    O.rotation.set(0, e.face, 0); O.scale.set(big * sq * (1 + bob * 0.06), big * sq * (1 - bob * 0.08 + e.atk * 0.08), big * sq * (1 + bob * 0.06)); O.updateMatrix();
    m.setMatrixAt(cnt[k]++, O.matrix);
    if (e.hp < e.max || e.kind === 'bld') bar(e.x, e.y + (e.def.hp > 1500 ? 1.5 : 1.0), e.z, e.def.hp > 1500 ? 0.9 : 0.6, Math.max(0, e.hp / e.max), e.team === 1 ? '#5aa9ff' : '#ff5d7a');
  }
  for (const k in umesh) { const m = umesh[k]; m.count = cnt[k]; m.visible = cnt[k] > 0; m.instanceMatrix.needsUpdate = true; }
  barBg.count = barFg.count = nb; barBg.instanceMatrix.needsUpdate = barFg.instanceMatrix.needsUpdate = true; if (barFg.instanceColor) barFg.instanceColor.needsUpdate = true;
  let np = 0;
  for (const p of projs) {
    if (np >= MAXJ) break;
    if (p.kind === 'spell') { const u = p.t / p.T; O.position.set(lerp(p.x0, p.x, u), 1 + Math.sin(u * Math.PI) * p.h, lerp(p.z0, p.z, u)); O.rotation.set(u * 8, u * 5, 0); O.scale.setScalar(2.2); COL.set(p.type === 'snare' ? '#ffb000' : p.type === 'heal' ? '#e0fff4' : '#8a5a3a'); }
    else if (p.kind === 'boulder') { O.position.set(p.x, 0.75, p.z); O.rotation.set(p.rot, 0, 0); O.scale.setScalar(6.5); COL.set('#9aa0a8'); }
    else { O.position.set(p.x, p.y, p.z); O.rotation.set(0, 0, 0); O.scale.setScalar(p.kind === 'arrow' ? 0.7 : p.kind === 'spark' ? 1 : 1.3); COL.set(p.col); }
    O.updateMatrix(); projMesh.setMatrixAt(np, O.matrix); projMesh.setColorAt(np, COL); np++;
  }
  projMesh.count = np; projMesh.instanceMatrix.needsUpdate = true; if (projMesh.instanceColor) projMesh.instanceColor.needsUpdate = true;
  const hh = dt / 60; let k = 0;
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.vy -= 9 * hh; p.x += p.vx * hh; p.y += p.vy * hh; p.z += p.vz * hh; if (p.y < 0.05) { p.y = 0.05; p.vy *= -0.3; p.vx *= 0.7; p.vz *= 0.7; } p.life -= hh; if (p.life <= 0) parts.splice(i, 1); }
  for (const p of parts) { O.position.set(p.x, p.y, p.z); O.rotation.set(p.r + p.life * 6, p.life * 4, 0); O.scale.setScalar(p.s * Math.min(1, p.life * 3)); O.updateMatrix(); partMesh.setMatrixAt(k, O.matrix); partMesh.setColorAt(k, p.c); k++; }
  partMesh.count = k; partMesh.instanceMatrix.needsUpdate = true; if (partMesh.instanceColor) partMesh.instanceColor.needsUpdate = true;
  for (const r of rings) if (r.t > 0) { r.t -= dt * 0.045; const s = r.r * (1.15 - r.t * 0.4); r.m.scale.set(s, s, 1); r.m.material.opacity = Math.max(0, r.t) * 0.85; if (r.t <= 0) r.m.visible = false; }
  water.material.color.setHSL(0.54, 0.75, 0.6 + Math.sin(now * 1.5) * 0.025);
  shake *= Math.pow(0.88, dt);
  camera.position.set(camPos.x + (Math.random() - 0.5) * shake, camPos.y + (Math.random() - 0.5) * shake * 0.5, camPos.z + (Math.random() - 0.5) * shake);
  camera.lookAt(camT); camQ.copy(camera.quaternion); camR.set(1, 0, 0).applyQuaternion(camQ);
}
function paintHud() {
  if (state !== 'play') return;
  const left = Math.max(0, (overtime ? OT : REG) - T), m = Math.floor(left / 60), s = Math.floor(left % 60);
  const tm = top.querySelector('.bb-time'); tm.querySelector('b').textContent = `${m}:${String(s).padStart(2, '0')}`; tm.classList.toggle('hot', overtime || left <= 60);
  tm.querySelector('small').textContent = overtime ? 'OVERTIME' : camp ? camp.opp : `CPU · ${DIFF[matchDiff].name}`;
  const sp = handEl.querySelector('.bb-sap'); sp.querySelector('i').style.width = sap[1] * 10 + '%'; sp.querySelector('b').textContent = Math.floor(sap[1]);
  sp.querySelector('.bb-x2').textContent = overtime || left <= 60 ? '2×' : '';
  handEl.querySelectorAll('.bb-card').forEach((c, i) => c.classList.toggle('poor', CARDS[hands[1].hand[i]].cost > sap[1]));
}

// ================================================================ hand + deploy input
let selected = -1, dragging = null;
const artCache = {};
const art = (type) => { const c = cardArt(type); return c; };
function paintHand() {
  const row = handEl.querySelector('.bb-row'); row.innerHTML = '';
  if (!hands[1]) return;
  const nx = $(`<div class="bb-next"></div>`); nx.appendChild(cardArt(hands[1].queue[0], 80, 96)); nx.appendChild($(`<span>NEXT</span>`)); row.appendChild(nx);
  hands[1].hand.forEach((type, i) => {
    const c = $(`<div class="bb-card ${i === selected ? 'sel' : ''}"><div class="cost">${CARDS[type].cost}</div><div class="nm">${CARDS[type].name}</div></div>`); c.prepend(cardArt(type));
    c.addEventListener('pointerdown', e => { e.stopPropagation(); if (state !== 'play') return; selected = selected === i && !dragging ? -1 : i; dragging = { x: e.clientX, y: e.clientY, i, moved: false }; paintHand(); showZones(); sfx.tap(); });
    row.appendChild(c);
  });
  paintHud();
}
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ndc = new THREE.Vector2(), hit = new THREE.Vector3();
function ground(cx, cy) { ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.ray.intersectPlane(plane, hit) ? hit.clone() : null; }
function showZones() {
  if (selected < 0 || !hands[1]) { noGo.forEach(m => m.visible = false); return; }
  const d = CARDS[hands[1].hand[selected]];
  for (const [i, s] of [[0, -1], [1, 1]].map(q => q)) {
    const m = noGo[i]; if (d.kind === 'spell') { m.visible = false; continue; }
    if (d.anywhere) { m.visible = true; m.scale.y = (RIV + 0.25) * 2; m.position.z = 0; continue; }
    const et = towers.find(t => t.team === -1 && t.sub === 'small' && t.lane === s), z0 = et && et.dead ? -4.2 : RIV + 0.25;
    m.visible = true; m.scale.y = z0 + AZ; m.position.z = (-AZ + z0) / 2;
  }
}
function hideGhost() { ghostRing.visible = ghostDisc.visible = false; noGo.forEach(m => m.visible = false); }
function ghostAt(cx, cy, lift = 0) {
  if (selected < 0) return null; const g = ground(cx, cy - lift); if (!g) return null;
  const type = hands[1].hand[selected], d = CARDS[type], ok = canDeploy(1, type, g.x, g.z), r = d.rad || Math.max(0.5, d.r + 0.3);
  ghostRing.visible = ghostDisc.visible = true; ghostRing.position.set(g.x, 0.05, g.z); ghostDisc.position.set(g.x, 0.04, g.z); ghostRing.scale.set(r, r, 1); ghostDisc.scale.set(r, r, 1);
  const col = ok ? (d.cost <= sap[1] ? '#ffffff' : '#ffd166') : '#ff4d6d'; ghostRing.material.color.set(col); ghostDisc.material.color.set(col);
  return { x: g.x, z: g.z, ok };
}
function tryDeploy(cx, cy, lift) {
  const g = ghostAt(cx, cy, lift); if (!g) return;
  const type = hands[1].hand[selected];
  if (!g.ok) { tone(160, 0.12, 'square', 0.06); ui.pop(Math.abs(g.z) < RIV + 0.25 ? 'Too close to the river' : (towers.some(t => !t.dead && Math.hypot(t.x - g.x, t.z - g.z) < t.r) ? 'Too close to a tower' : 'Deploy on your side'), '#fff', 22, 40); return; }
  if (CARDS[type].cost > sap[1]) { tone(160, 0.12, 'square', 0.06); ui.pop(`Need ${CARDS[type].cost} sap`, '#ffd166', 24, 40); return; }
  deploy(1, selected, g.x, g.z); selected = -1; hideGhost(); paintHand();
}
let downAt = null;
addEventListener('pointerdown', e => { if (e.target !== renderer.domElement) return; downAt = { x: e.clientX, y: e.clientY }; });
addEventListener('pointermove', e => {
  if (state !== 'play' || selected < 0) return;
  if (dragging) { if (Math.hypot(e.clientX - dragging.x, e.clientY - dragging.y) > 22) dragging.moved = true; if (dragging.moved) ghostAt(e.clientX, e.clientY, e.pointerType === 'touch' ? 50 : 0); }
  else if (e.pointerType === 'mouse' && e.target === renderer.domElement) ghostAt(e.clientX, e.clientY);
});
addEventListener('pointerup', e => {
  if (state !== 'play') { dragging = null; downAt = null; return; }
  if (dragging) { const d = dragging; dragging = null; if (d.moved && selected >= 0) { if (document.elementFromPoint(e.clientX, e.clientY) === renderer.domElement) tryDeploy(e.clientX, e.clientY, e.pointerType === 'touch' ? 50 : 0); else { hideGhost(); showZones(); } } return; }
  if (!downAt || e.target !== renderer.domElement) { downAt = null; return; }
  const tap = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 14; downAt = null;
  if (tap && selected >= 0) tryDeploy(e.clientX, e.clientY, 0);
});
addEventListener('keydown', e => { if (state !== 'play') return; const i = '1234'.indexOf(e.key); if (i >= 0) { selected = i; paintHand(); showZones(); } if (e.key === 'Escape') { selected = -1; hideGhost(); paintHand(); } });

// ================================================================ music: a little woodland march, composed in code
const MEL = [67, 0, 72, 72, 74, 0, 76, 74, 72, 0, 67, 0, 69, 71, 72, 0, 74, 0, 76, 77, 79, 0, 76, 72, 74, 0, 71, 67, 72, 0, 0, 0];
const BAS = [48, 55, 48, 55, 45, 52, 45, 52, 43, 50, 43, 50, 48, 55, 43, 50];
let mstep = 0;
setInterval(() => {
  if (muted || state !== 'play' || document.hidden) return;
  const i = mstep++ % 32, hot = overtime || (REG - T) <= 60;
  if (MEL[i]) note(MEL[i] + (hot ? 2 : 0), 0.2, 0.04);
  if (i % 2 === 0) note(BAS[(i / 2) % 16] + (hot ? 2 : 0), 0.28, 0.05);
  if (i % 4 === 0) tone(80, 0.07, 'sine', 0.08, 0.5); if (i % 4 === 2) tone(2400, 0.02, 'square', 0.015, 0.8);
}, hot0());
function hot0() { return 140; }

// ================================================================ main loop
loop((dt, now) => {
  if (state === 'play') { let h = Math.min(dt / 60, 0.05) * gs; while (h > 0 && state === 'play' && !ended) { const s = Math.min(h, 1 / 40); step(s); h -= s; } }
  render(dt, now);
  hudT -= dt; if (hudT <= 0) { hudT = 6; paintHud(); }
});

// ================================================================ start card: difficulty, deck, trophies
const startEl = ui.els.start, hintEl = startEl.querySelector('.hint');
const tro = $(`<p class="bb-tro"></p>`); startEl.querySelector('h1').after(tro);
const diffEl = $(`<div class="bb-diff"></div>`), deckRow = $(`<div class="bb-deckrow"></div>`), deckBtn = $(`<button class="bb-deckbtn">🃏 Deck</button>`);
hintEl.before(diffEl, deckRow, deckBtn);
[diffEl, deckRow, deckBtn].forEach(el => el.addEventListener('pointerdown', e => e.stopPropagation()));
function paintStart() {
  tro.innerHTML = `🏆 ${trophies} trophies · ${wins} win${wins === 1 ? '' : 's'} · ${owned.length}/${ALL.length} cards`;
  if (D.seed) { diffEl.innerHTML = `<button class="bb-db sel" style="--c:#3a86ff">Daily duel · Normal</button>`; }
  else { diffEl.innerHTML = DIFF.map((d, i) => `<button class="bb-db ${i === diff ? 'sel' : ''}" style="--c:${d.col}" data-d="${i}">${d.name}</button>`).join(''); diffEl.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { diff = +b.dataset.d; S.set('diff', diff); paintStart(); sfx.tap(); }); }
  deckRow.innerHTML = ''; deck.forEach(c => deckRow.appendChild(cardArt(c, 68, 82)));
  hintEl.innerHTML = 'Tap to battle';
  if (DEEP && !D.seed) { tro.innerHTML = `${ss(1, 14)} ${totalStars()}/90 · 🏆 ${trophies}`; diffEl.style.display = deckRow.style.display = deckBtn.style.display = 'none'; hintEl.innerHTML = unlocked <= 1 && !stars[1] ? 'Tap to play' : 'Tap for the map'; }
}
deckBtn.onclick = () => openDeck();
function openDeck() {
  let sel = 0;
  const sh = $(`<div class="bb-sheet"><div><h2>Your deck</h2><p>Tap a deck card, then a card from your collection to swap. Win battles to unlock more.</p><div class="bb-grid" data-deck></div><div class="bb-info"></div><h2 style="font-size:22px">Collection</h2><div class="bb-grid" data-all></div><button class="bb-done">Done</button></div></div>`);
  ['pointerdown', 'pointerup'].forEach(t => sh.addEventListener(t, e => e.stopPropagation()));
  document.body.appendChild(sh);
  const gc = (c, cls, lock) => { const el = $(`<div class="bb-gc ${cls}"><div class="cost">${CARDS[c].cost}</div><div class="nm">${CARDS[c].name}</div>${lock ? `<div class="lk">🔒<br>${lock}</div>` : ''}</div>`); el.prepend(cardArt(c, 120, 144)); return el; };
  const paint = () => {
    const dk = sh.querySelector('[data-deck]'), al = sh.querySelector('[data-all]'); dk.innerHTML = ''; al.innerHTML = '';
    deck.forEach((c, i) => { const el = gc(c, i === sel ? 'sel' : ''); el.onclick = () => { sel = i; paint(); sfx.tap(); }; dk.appendChild(el); });
    const avg = deck.reduce((s, c) => s + CARDS[c].cost, 0) / 8;
    sh.querySelector('.bb-info').innerHTML = `<b>${CARDS[deck[sel]].name}</b> · ${CARDS[deck[sel]].info}<br><small>Average sap cost ${avg.toFixed(1)}</small>`;
    ALL.forEach(c => { if (deck.includes(c)) return; const li = UNLOCKS.indexOf(c), lock = owned.includes(c) ? '' : `win ${li + 1 - (owned.length - START_DECK.length)} more`; const el = gc(c, owned.includes(c) ? '' : 'lock', lock);
      el.onclick = () => { if (!owned.includes(c)) { tone(160, 0.1, 'square', 0.05); return; } deck[sel] = c; S.set('deck', deck); paint(); tone(520, 0.08, 'triangle', 0.1, 1.4); }; al.appendChild(el); });
  };
  sh.querySelector('.bb-done').onclick = () => { sh.remove(); paintStart(); };
  paint();
}
// ================================================================ DEEP v2: campaign twists, map, stars, results
let acornGot = 0, acornN = 0, puddleT = 8;
const dcss = document.createElement('style'); dcss.textContent = `
.bb-goal{white-space:nowrap;font-size:11px;position:fixed;top:calc(58px + env(safe-area-inset-top));left:0;right:0;text-align:center;z-index:5;pointer-events:none;font-size:12px;font-weight:800;text-shadow:0 1px 3px rgba(0,0,0,.7);opacity:.95}
.bb-goal span{background:rgba(20,30,24,.55);border-radius:10px;padding:1px 8px;margin:0 2px}
.bb-coach{position:fixed;left:50%;transform:translateX(-50%);top:calc(100px + env(safe-area-inset-top));z-index:6;pointer-events:none;background:#fff8e0;color:#3a2400;border-radius:14px;padding:6px 12px;font-weight:800;font-size:15px;box-shadow:0 3px 0 rgba(0,0,0,.25);animation:bbpulse 1s infinite alternate;max-width:86vw;text-align:center}
@keyframes bbpulse{to{transform:translateX(-50%) scale(1.06)}}
.bb-map{position:fixed;inset:0;z-index:46;background:linear-gradient(#2d4a2a,#1e3320);overflow:auto;padding:calc(10px + env(safe-area-inset-top)) 10px 120px;display:flex;justify-content:center}
.bb-map>div{width:100%;max-width:440px}
.bb-mh{display:flex;justify-content:space-between;align-items:center;font-weight:800;font-size:15px;margin-bottom:6px;gap:6px}
.bb-mh b{background:rgba(255,255,255,.14);border-radius:12px;padding:3px 9px}
.bb-wh{margin:14px 0 6px;font-weight:800;font-size:19px;display:flex;align-items:center;gap:8px}.bb-wh small{font-size:12px;opacity:.8;font-weight:600}
.bb-nodes{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
.bb-nd{position:relative;aspect-ratio:1;border-radius:50%;border:0;background:var(--c);color:#fff;font:800 20px/1 'Baloo 2',system-ui;cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.35);display:grid;place-items:center;padding-bottom:10px}
.bb-nd.lock{background:#4d5a4a;opacity:.55;cursor:default}.bb-nd.cur{outline:4px solid #ffd23f;animation:bbpulse2 .9s infinite alternate}.bb-nd.boss{border-radius:18px;font-size:22px}
@keyframes bbpulse2{to{transform:scale(1.1)}}
.bb-nd i{position:absolute;bottom:3px;left:0;right:0;display:flex;justify-content:center;gap:1px;font-style:normal}
.bb-nd i svg{width:11px;height:11px}
.bb-lv{position:fixed;left:0;right:0;bottom:0;z-index:48;background:#fff8e8;color:#3a2400;border-radius:22px 22px 0 0;padding:14px 16px calc(14px + env(safe-area-inset-bottom));box-shadow:0 -6px 20px rgba(0,0,0,.4);text-align:center}
.bb-lv h3{margin:0;font-size:24px}.bb-lv p{margin:4px 0;font-size:15px;font-weight:600}.bb-lv .g{font-size:13px;opacity:.85;line-height:1.5}
.bb-go{border:0;border-radius:16px;padding:10px 34px;font:800 22px/1 'Baloo 2',system-ui;color:#fff;background:#3ab795;box-shadow:0 4px 0 rgba(0,0,0,.25);cursor:pointer;margin:8px 4px 0}
.bb-go.alt{background:#8a7a64;font-size:16px;padding:8px 16px}
.bb-res{position:fixed;inset:0;z-index:47;display:flex;align-items:center;justify-content:center;background:rgba(20,18,12,.55);padding:14px}
.bb-res>div{background:#fff8e8;color:#3a2400;border-radius:24px;padding:16px 16px 14px;width:100%;max-width:360px;text-align:center;box-shadow:0 8px 0 rgba(0,0,0,.3);animation:bbin .35s cubic-bezier(.3,1.5,.5,1)}
@keyframes bbin{from{transform:scale(.6);opacity:0}}
.bb-res h2{margin:0;font-size:34px;line-height:1}.bb-res p{margin:6px 0;font-size:15px;font-weight:600}
.bb-st{display:flex;justify-content:center;gap:6px;margin:8px 0}.bb-st svg{width:46px;height:46px;transform:scale(.3);opacity:0}.bb-st svg.in{animation:bbstar .45s forwards}
@keyframes bbstar{60%{transform:scale(1.35);opacity:1}to{transform:scale(1);opacity:1}}
.bb-gl{font-size:13px;text-align:left;display:inline-block;line-height:1.55}
.bb-rw{display:flex;align-items:center;justify-content:center;gap:8px;background:#ffe9a8;border-radius:14px;padding:6px;margin:6px 0;font-weight:800}
.bb-rw canvas{width:40px;height:48px;border-radius:6px}
.bb-bar{height:10px;border-radius:6px;background:rgba(0,0,0,.15);overflow:hidden;margin:4px 0}.bb-bar i{display:block;height:100%;background:linear-gradient(#ffd166,#ff9f1c)}
.bb-stk{display:flex;gap:3px;flex-wrap:wrap;justify-content:center;font-size:20px}.bb-stk span.off{filter:grayscale(1) opacity(.3)}
`; document.head.appendChild(dcss);
const svgStar = on => `<svg viewBox="0 0 24 24"><path d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.5 5.7 21l1.5-7L2 9.3l7-.8z" fill="${on ? '#ffc21a' : '#b9aa8c'}" stroke="${on ? '#b8760a' : '#8f826a'}" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
const ss = (on = 1, z = 12) => svgStar(on).replace('<svg', `<svg width=${z} height=${z} style="vertical-align:-2px"`);
const goalEl = $(`<div class="bb-goal"></div>`); document.body.appendChild(goalEl); goalEl.style.display = 'none';
let coachEl = null;
const stars = DS.get('stars', {}); let unlocked = Math.max(1, DS.get('unlocked', 1)), fails = DS.get('fails', {}), stickers = DS.get('stickers', 0), streak = DS.get('streak', 0), lastDay = DS.get('last', '');
const totalStars = () => Object.values(stars).reduce((a, b) => a + b, 0);
const dayStr = (d = new Date()) => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
const MODNAME = { acorn: '🌰 golden acorn', honey: '🍯 sticky puddles', hive: '🐝 enemy hive', storm: '⚡ double flow', fixed: '🃏 set deck', boss: '👑 boss Hearth', noleft: '⚠ tower down' };
function campIntro(C) {
  goalEl.style.display = ''; goalEl.innerHTML = `<span>${ss()} win</span><span>${ss()}${ss()} keep towers</span><span>${ss()}${ss()}${ss()} ${g3Text(C.g3).replace('Knock out the Hearth', 'Hearth down')}</span>`;
  clearTimeout(goalEl._t); goalEl._t = setTimeout(() => { goalEl.style.display = 'none'; }, 5000);
  showBanner(`${C.opp}<small>${C.why}</small>`, 2200);
  if (coachEl) coachEl.remove(); coachEl = null;
  const tip = C.tip || ((C.mods || []).length ? MODNAME[C.mods[0]] : '');
  if (tip && (C.n < 12 ? true : !DS.get('tip' + C.mods[0], false))) { coachEl = $(`<div class="bb-coach">${tip}</div>`); document.body.appendChild(coachEl); const c = coachEl; setTimeout(() => c.remove(), C.n <= 3 ? 9000 : 5000); if (C.mods && C.mods[0]) DS.set('tip' + C.mods[0], true); }
}
function twists(h) {
  const mods = camp.mods || [];
  if (mods.includes('acorn')) {
    acornT -= h;
    if (!acorn && acornT <= 0 && T < REG - 25) {
      const x = (acornN++ % 2 ? 1 : -1) * BR, m = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10), new THREE.MeshStandardMaterial({ color: '#ffc21a', emissive: '#c98a00', emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.4 }));
      m.scale.y = 1.25; m.position.set(x, 0.7, 0); scene.add(m); acorn = { x, m, life: 15 }; ring(x, 0, 1.2, '#ffd23f'); showBanner('🌰 GOLDEN ACORN!<small>first troop onto the bridge gets +3 sap</small>', 1500); tone(880, 0.12, 'triangle', 0.1, 1.4);
    }
    if (acorn) {
      acorn.life -= h; acorn.m.position.y = 0.75 + Math.sin(T * 5) * 0.14; acorn.m.rotation.y += h * 3;
      const g = ents.find(e => !e.dead && e.kind === 'troop' && e.spawn <= 0 && Math.hypot(e.x - acorn.x, e.z) < 0.9);
      if (g) { sap[g.team] = Math.min(10, sap[g.team] + 3); spark(acorn.x, 0.8, 0, ['#ffd23f', '#fff3a0', '#ffffff'], 30, 3, 4); ring(acorn.x, 0, 1.6, '#ffd23f'); if (g.team === 1) { ui.pop('+3 SAP 🌰', '#ffd23f', 34, 30); acornGot++; buzz(25); } tone(1040, 0.1, 'triangle', 0.1, 1.5); setTimeout(() => tone(1560, 0.14, 'triangle', 0.1, 1.2), 90); scene.remove(acorn.m); acorn = null; acornT = 26; }
      else if (acorn.life <= 0) { scene.remove(acorn.m); acorn = null; acornT = 18; }
    }
  }
  if (mods.includes('honey')) {
    puddleT -= h;
    if (puddleT <= 0 && zones.length < 3) {
      puddleT = 11; const lane = Math.random() < 0.5 ? -1 : 1, x = lane * BR + (Math.random() - 0.5) * 1.2, z = (Math.random() < 0.5 ? -1 : 1) * (2.2 + Math.random() * 3.6);
      const m = new THREE.Mesh(new THREE.CircleGeometry(1.25, 28), new THREE.MeshBasicMaterial({ color: '#ffb000', transparent: true, opacity: 0.5, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.035, z); scene.add(m);
      zones.push({ x, z, m, life: 13 }); ring(x, z, 1.4, '#ffd166'); spark(x, 0.3, z, ['#ffb000', '#ffd166'], 10, 1.5, 2);
      if (!DS.get('puddle', false)) { DS.set('puddle', true); showBanner('🍯 STICKY PUDDLE<small>slows every troop that walks in</small>', 1500); }
    }
    for (let i = zones.length - 1; i >= 0; i--) {
      const zn = zones[i]; zn.life -= h; zn.m.material.opacity = 0.35 + Math.sin(T * 4 + i) * 0.1;
      if (zn.life <= 0) { scene.remove(zn.m); zones.splice(i, 1); continue; }
      for (const e of ents) if (!e.dead && e.kind === 'troop' && !e.def.fly && (e.x - zn.x) ** 2 + (e.z - zn.z) ** 2 < 1.6) { e.slowT = Math.max(e.slowT, 0.25); e.slowF = 0.45; }
    }
  }
  if (mods.includes('hive')) {
    hiveT -= h;
    const hr = towers.find(t => t.team === -1 && t.sub === 'hearth');
    if (hiveT <= 0 && hr && !hr.dead) {
      hiveT = 24; const lane = Math.random() < 0.5 ? -1 : 1;
      for (let i = 0; i < 3; i++) spawnUnit(-1, 'bees', lane * BR + (i - 1) * 0.35, -TP.hearth + 1.8, 1);
      spark(0, 3, -TP.hearth, ['#ffd23f', '#3a2400'], 14, 2, 3); showBanner('🐝 HIVE BUZZ!<small>free bees from the enemy Hearth</small>', 1100); tone(500, 0.2, 'sawtooth', 0.05, 1.8);
    }
  }
}
function lvlStars(C) {
  const a = crowns[-1] === 0 ? 1 : 0, g = C.g3, b = g === 'hearth' ? (crowns[1] === 3 ? 1 : 0) : (!overtime && T <= +g.split(':')[1] ? 1 : 0);
  return { s: 1 + a + b, a, b };
}
let resEl = null;
function closeRes() { if (resEl) { resEl.remove(); resEl = null; } }
function endCamp(won, draw) {
  const C = camp, n = C.n; goalEl.style.display = 'none'; if (coachEl) { coachEl.remove(); coachEl = null; }
  let html = '', rw = null;
  if (won) {
    wins++; S.set('wins', wins); trophies += 25 + C.ai * 10 + crowns[1] * 2; S.set('trophies', trophies);
    const r = lvlStars(C), before = stars[n] || 0, before9 = Math.floor(totalStars() / 9);
    if (r.s > before) { stars[n] = r.s; DS.set('stars', stars); }
    const gain = Math.max(0, r.s - before); fails[n] = 0; DS.set('fails', fails);
    if (n >= unlocked) { unlocked = Math.min(31, n + 1); DS.set('unlocked', unlocked); }
    const card = REWARDS[n]; if (card && !owned.includes(card)) { owned.push(card); S.set('owned', owned); rw = card; }
    const after9 = Math.floor(totalStars() / 9), newStk = Math.min(10, after9) > Math.min(10, before9);
    if (newStk) { stickers = Math.min(10, after9); DS.set('stickers', stickers); }
    const today = dayStr(), yest = dayStr(new Date(Date.now() - 864e5));
    if (lastDay !== today) { streak = lastDay === yest ? streak + 1 : 1; lastDay = today; DS.set('streak', streak); DS.set('last', today); }
    D.won(wins, 'won'); state = 'won'; sfx.win(); buzz([30, 40, 60]); confetti(scene, new THREE.Vector3(0, 2, -6), 120 + r.s * 40);
    const tot = totalStars(), toNext = 9 - (tot % 9), nx = LEVELS[n];
    html = `<h2>${crowns[1] === 3 ? 'HEARTH SMASHED!' : 'VICTORY!'}</h2><p>${C.opp} beaten · ${crowns[1]}–${crowns[-1]} crowns</p>
      <div class="bb-st">${svgStar(1)}${svgStar(r.a)}${svgStar(r.b)}</div>
      <div class="bb-gl">${ss(1)} Win<br>${ss(r.a)} Keep both towers<br>${ss(r.b)} ${g3Text(C.g3)}</div>
      ${rw ? `<div class="bb-rw" data-rw><span>New card!</span><span>${CARDS[rw].name}</span></div>` : ''}
      ${newStk ? `<div class="bb-rw"><span>New sticker</span><span style="font-size:30px">${STICKERS[stickers - 1]}</span></div>` : ''}
      <div class="bb-bar"><i style="width:${(tot % 9) / 9 * 100}%"></i></div><p style="font-size:13px;margin:2px 0">${tot >= 90 ? 'All stars!' : `${toNext} star${toNext === 1 ? '' : 's'} to the next sticker`}${gain ? ` · +${gain}` : ''}</p>
      <p style="font-size:12px;opacity:.8;margin:2px 0">Tomorrow: daily duel · ${streak}-day streak${nx ? ` · next: ${nx.name}` : ''}</p>
      <button class="bb-go" data-next>${n >= 30 ? 'Map' : (n % 10 === 0 ? 'Next world ▶' : 'Next duel ▶')}</button><button class="bb-go alt" data-retry>${r.s < 3 ? 'Retry' : 'Again'}</button><button class="bb-go alt" data-map>Map</button>`;
  } else {
    if (!draw) { trophies = Math.max(0, trophies - 12); S.set('trophies', trophies); }
    fails[n] = (fails[n] || 0) + 1; DS.set('fails', fails); state = 'lost'; sfx.fail(); buzz([60, 40, 120]);
    const hr = towers.find(t => t.team === -1 && t.sub === 'hearth'), pct = Math.round(Math.max(0, hr.hp) / hr.max * 100), close = crowns[1] > 0 || pct < 40 || draw;
    const why = draw ? 'Dead level at the buzzer.' : crowns[-1] >= 2 && crowns[1] === 0 ? 'Two of your towers fell. Defend first, then counter.' : crowns[-1] === 3 ? 'Your Hearth was smashed.' : crowns[1] < crowns[-1] ? `Out-crowned ${crowns[1]}–${crowns[-1]}. Their Hearth had ${pct}% left.` : `Their Hearth had ${pct}% left.`;
    html = `<h2>${draw ? 'DRAW!' : close ? 'SO CLOSE!' : 'DEFEAT'}</h2><p>${C.opp} · ${crowns[1]}–${crowns[-1]} crowns</p><p>${why}</p>
      ${fails[n] >= 2 ? `<p style="background:#ffe9a8;border-radius:12px;padding:6px">💡 ${C.why}</p>` : ''}
      <button class="bb-go" data-retry>Again!</button><button class="bb-go alt" data-map>Map</button>`;
  }
  setTimeout(() => {
    closeRes(); resEl = $(`<div class="bb-res"><div>${html}</div></div>`); document.body.appendChild(resEl);
    resEl.addEventListener('pointerdown', e => e.stopPropagation());
    const q = s => resEl.querySelector(s);
    if (won) { const sv = resEl.querySelectorAll('.bb-st svg'), lit = [1, lvlStars(C).a, lvlStars(C).b]; sv.forEach((el, i) => { if (!lit[i]) return; setTimeout(() => { el.classList.add('in'); tone(520 + i * 160, 0.14, 'triangle', 0.1, 1.3); }, 250 + i * 300); }); }
    q('[data-next]') && (q('[data-next]').onclick = () => { const nn = n >= 30 || n % 10 === 0 ? 0 : n + 1; closeRes(); if (nn) playLevel(nn); else openMap(); });
    q('[data-retry]').onclick = () => { closeRes(); playLevel(n); };
    q('[data-map]') && (q('[data-map]').onclick = () => { closeRes(); openMap(); });
  }, won ? 900 : 700);
}
function playLevel(n) {
  camp = LEVELS[n - 1]; closeMap(); const f = fails[n] || 0;
  startMatch();
  if (f >= 2) thinkMul = camp.think * (1 + 0.1 * Math.min(3, f - 1));   // kind assist after repeated losses
}
let mapEl = null, lvEl = null;
function closeMap() { if (mapEl) { mapEl.remove(); mapEl = null; } if (lvEl) { lvEl.remove(); lvEl = null; } }
function openLevel(n) {
  const C = LEVELS[n - 1]; if (lvEl) lvEl.remove();
  const st = stars[n] || 0;
  lvEl = $(`<div class="bb-lv"><h3>${n}. ${C.name}</h3><p>${C.opp} — ${C.why}</p><div class="g">${(C.mods || []).map(m => MODNAME[m]).join(' · ') || 'a clean duel'}<br>${svgStar(1).replace('<svg', '<svg width=13 height=13')} win ${svgStar(1).replace('<svg', '<svg width=13 height=13')}${svgStar(1).replace('<svg', '<svg width=13 height=13')} keep both towers ${svgStar(1).replace('<svg', '<svg width=13 height=13')}${svgStar(1).replace('<svg', '<svg width=13 height=13')}${svgStar(1).replace('<svg', '<svg width=13 height=13')} ${g3Text(C.g3)}<br>Best: ${[1, 2, 3].map(k => ss(k <= st)).join('')}</div><button class="bb-go" data-go>Battle!</button><button class="bb-go alt" data-x>Back</button></div>`);
  lvEl.addEventListener('pointerdown', e => e.stopPropagation()); document.body.appendChild(lvEl);
  lvEl.querySelector('[data-go]').onclick = () => playLevel(n); lvEl.querySelector('[data-x]').onclick = () => { lvEl.remove(); lvEl = null; };
}
function openMap(focus) {
  closeMap(); closeRes(); hideGhost(); handEl.style.visibility = 'hidden'; top.style.visibility = 'hidden'; goalEl.style.display = 'none'; state = 'ready'; ui.hideStart && ui.hideStart();
  const tot = totalStars();
  let h = `<div><div class="bb-mh"><b>🏆 ${trophies}</b><b>${ss(1, 14)} ${tot}/90</b><b>🔥 ${streak} day${streak === 1 ? '' : 's'}</b><b>🃏 ${owned.length}/${ALL.length}</b></div><div class="bb-stk">${STICKERS.map((s, i) => `<span class="${i < stickers ? '' : 'off'}">${s}</span>`).join('')}</div><p style="text-align:center;margin:2px 0;font-size:12px;opacity:.8">${9 - tot % 9} stars to the next sticker</p>`;
  for (const w of WORLDS) {
    h += `<div class="bb-wh"><span>${w.icon}</span>${w.name}<small>${w.blurb}</small></div><div class="bb-nodes">`;
    for (let n = w.from; n <= w.to; n++) { const lock = n > unlocked, cur = n === unlocked, s = stars[n] || 0; h += `<button class="bb-nd ${lock ? 'lock' : ''} ${cur ? 'cur' : ''} ${n % 10 === 0 ? 'boss' : ''}" style="--c:${w.col}" data-n="${n}">${lock ? '🔒' : n}<i>${[1, 2, 3].map(k => svgStar(k <= s)).join('')}</i></button>`; }
    h += '</div>';
  }
  h += `<div style="text-align:center;margin-top:16px"><button class="bb-go alt" data-deck>🃏 Deck</button><button class="bb-go alt" data-daily>📅 Daily duel</button><button class="bb-go alt" data-quick>⚔ Quick battle (${DIFF[diff].name})</button></div></div>`;
  mapEl = $(`<div class="bb-map">${h}</div>`); document.body.appendChild(mapEl);
  mapEl.addEventListener('pointerdown', e => e.stopPropagation());
  mapEl.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { if (+b.dataset.n > unlocked) { tone(160, 0.1, 'square', 0.05); return; } sfx.tap(); openLevel(+b.dataset.n); });
  mapEl.querySelector('[data-deck]').onclick = () => openDeck();
  mapEl.querySelector('[data-daily]').onclick = () => { location.search = /[?&]deep=1/.test(location.search) ? '?deep=1&daily=1' : '?daily=1'; };
  mapEl.querySelector('[data-quick]').onclick = () => { camp = null; closeMap(); startMatch(); };
  const cur = mapEl.querySelector('.cur'); if (cur) setTimeout(() => cur.scrollIntoView({ block: 'center' }), 30);
  if (focus) openLevel(focus);
}
ui.onTap(w => {
  if (DEEP && !D.seed) { if (w !== 'start') return; if (unlocked <= 1 && !stars[1]) return playLevel(1); return openMap(); }
  if (w === 'start') return startMatch(); paintStart(); startMatch();
});
handEl.style.visibility = 'hidden';
paintStart(); fit();
// a tiny idle scene behind the start card
(function idle() { for (const team of [1, -1]) { addTower(team, 'small', -1); addTower(team, 'small', 1); addTower(team, 'hearth', 0); } })();

window.__game = {
  play: n => playLevel(n), openMap: () => openMap(), get camp() { return camp; }, get stars() { return stars; },
  get state() { return state; }, get level() { return wins; }, get score() { return crowns[1]; },
  _qa() { return { T: Math.round(T), crowns: { you: crowns[1], cpu: crowns[-1] }, sap: sap[1].toFixed(1), n: ents.length, diff: matchDiff }; },
  bot() {
    if (state !== 'play') return;
    gs = window.__turbo || 12; paintSpeed();
    if (selected >= 0 && !dragging) { selected = -1; hideGhost(); paintHand(); }
    if (aiThink(1, window.__botLvl === undefined ? 1 : window.__botLvl)) paintHand();
  },
};
