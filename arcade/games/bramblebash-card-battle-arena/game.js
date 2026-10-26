// Bramblebash — a 3D woodland card battler: 1v1 against a fair CPU in a two-lane arena. Original game: code, art and sound are our own.
// Spend Sap to drop critter troops, buildings and spells; take the CPU's towers in 3 minutes; knock out its Hearth to win at once.
import { THREE, createStage, createUI, loop, confetti, sfx, tone, note, buzz, store, clamp, lerp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { vcMat } from './merge.js';
import { unitGeo, towerGeo, bushGeo, treeGeo, cardArt, UNIT_KEYS } from './models.js';

const NAME = 'Bramblebash: Card Battle Arena';
const S = store('bramblebash');
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
.bb-sheet{position:fixed;inset:0;z-index:45;background:rgba(24,20,16,.9);display:flex;justify-content:center;overflow:auto;padding:calc(14px + env(safe-area-inset-top)) 10px 20px}
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
const REG = 180, OT = 60;

function makeHand(d, r) { const q = d.slice(); for (let i = q.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [q[i], q[j]] = [q[j], q[i]]; } return { hand: q.slice(0, 4), queue: q.slice(4) }; }
function cycle(team, i) { const h = hands[team], c = h.hand[i]; h.hand[i] = h.queue.shift(); h.queue.push(c); return c; }

function addTower(team, kind, lane) {
  const def = kind === 'hearth' ? { hp: 3000, dmg: 75, rate: 1.0, range: 4.6, r: 1.2 } : { hp: 1500, dmg: 55, rate: 0.85, range: 4.4, r: 0.85 };
  const t = { id: ++eid, team, kind: 'tower', sub: kind, lane, x: lane * BR, z: team * TP[kind], hp: def.hp, max: def.hp, def: { ...def, air: true, proj: 'arrow' }, r: def.r, cd: 0, active: kind !== 'hearth', y: 0, flash: 0 };
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
  cpuDeck = cpuDeckFor(r);
  hands = { 1: makeHand(deck, r), [-1]: makeHand(cpuDeck, r) };
  for (const team of [1, -1]) { addTower(team, 'small', -1); addTower(team, 'small', 1); addTower(team, 'hearth', 0); }
  T = 0; overtime = false; recorded = false; ended = false; beatenShown = false; cpuThink = 2.5; cpuPlan = null; selected = -1;
  gs = gsPref; paintSpeed(); matchT0 = performance.now(); B.start();
  top.querySelector('.bb-time small').textContent = `CPU · ${DIFF[matchDiff].name}`;
  state = 'play'; paintHand(); paintCrowns(); handEl.style.visibility = ''; top.style.visibility = ''; fit();
  showBanner(`BATTLE!<small>vs ${DIFF[matchDiff].name} CPU${D.seed ? ' · daily' : ''}</small>`, 1600); sfx.win();
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
  if (team === 1) { tone(420, 0.08, 'triangle', 0.12, 1.5); buzz(15); } else tone(300, 0.06, 'triangle', 0.05, 1.4);
  if (team === 1) paintHand();
  return true;
}
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): in your first match, until the first real
// touch, one troop card from your hand drops onto your side of a lane (its Sap is given back), so the arena shows a deploy
demo(() => {
  const i = hands[1].hand.findIndex(c => CARDS[c].kind === 'troop' && CARDS[c].cost <= sap[1]); if (i < 0) return false;
  const s0 = sap[1], lane = Math.random() < 0.5 ? -1 : 1; if (deploy(1, i, lane * BR, RIV + 2.2)) { sap[1] = s0; paintHand(); }
}, { ready: () => state === 'play' && wins === 0 && !D.isDaily && selected < 0 && !dragging, wait: 1800, max: 1 });
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
  if (e.kind === 'tower') { if (e.sub === 'hearth') e.active = true; if (Math.random() < 0.5 || dmg > 100) dmgNum(e.x, 3, e.z, '-' + Math.round(dmg), e.team === 1 ? '#ffd0d8' : '#fff3a0'); }
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
  if (!muted && Math.random() < 0.7) tone(500 + Math.random() * 200, 0.07, 'sine', 0.07, 1.8);
}
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
  for (const t of [1, -1]) sap[t] = Math.min(10, sap[t] + h / 2.8 * (dbl ? 2 : 1));
  if (!overtime && left <= 60 && left + h > 60) { showBanner('2× SAP!<small>last minute</small>', 1500); tone(660, 0.15, 'triangle', 0.1, 1.3); }
  cpuThink -= h;
  if (cpuThink <= 0) { aiThink(-1, matchDiff); cpuThink = DIFF[matchDiff].think / F.k() * (0.75 + Math.random() * 0.5); }
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
  tm.querySelector('small').textContent = overtime ? 'OVERTIME' : `CPU · ${DIFF[matchDiff].name}`;
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
  if (!g.ok) { tone(160, 0.12, 'square', 0.06); ui.pop('Deploy on your side', '#fff', 22, 40); return; }
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
ui.onTap(w => { if (w === 'start') return startMatch(); paintStart(); startMatch(); });
handEl.style.visibility = 'hidden';
paintStart(); fit();
// a tiny idle scene behind the start card
(function idle() { for (const team of [1, -1]) { addTower(team, 'small', -1); addTower(team, 'small', 1); addTower(team, 'hearth', 0); } })();

window.__game = {
  get state() { return state; }, get level() { return wins; }, get score() { return crowns[1]; },
  _qa() { return { T: Math.round(T), crowns: { you: crowns[1], cpu: crowns[-1] }, sap: sap[1].toFixed(1), n: ents.length, diff: matchDiff }; },
  bot() {
    if (state !== 'play') return;
    gs = window.__turbo || 12; paintSpeed();
    if (selected >= 0 && !dragging) { selected = -1; hideGhost(); paintHand(); }
    if (aiThink(1, window.__botLvl === undefined ? 1 : window.__botLvl)) paintHand();
  },
};
