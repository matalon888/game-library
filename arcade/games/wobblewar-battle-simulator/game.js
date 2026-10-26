// Wobblewar — original wobbly battle simulator. Place your cartoon army on your half within the budget, press FIGHT,
// watch the springy little fighters bonk, tumble and pop into confetti. 30 puzzle battles, a daily battle and a sandbox.
import { THREE, createStage, createUI, store, loop, buzz, tone, note, lerp, clamp, rng, rounded, mat } from './kit/hc.js';
import { demo } from './kit/demo.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';

const NAME = 'Wobblewar: Battle Simulator';
const S = store('wobblewar');
let unlocked = S.get('level', 1), stars = S.get('stars', {});
const F = flow('wobblewar');
const stage = createStage({ fov: 40, shadowSize: 13 });
const { scene, camera, sun, hemi, renderer } = stage;
sun.intensity = 1.55; hemi.intensity = 1.1; sun.shadow.mapSize.set(1536, 1536);
const ui = createUI({ title: 'WOBBLE<br>WAR', hint: 'Tap to fight', hand: '⚔️', progress: false, score: false });
const D = daily('wobblewar', ui, { name: NAME });
const B = board({ game: 'wobblewar', label: 'Battles won', mode: 'sum', limits: { maxRun: 1, maxPerSec: 0.5 }, corner: 'tl' });
const bs = document.body.style; bs.setProperty('--bg1', '#a9d8ff'); bs.setProperty('--bg2', '#e9f8ff'); bs.setProperty('--ui', '#3f86ff');
scene.fog = new THREE.Fog('#d4ecff', 34, 80);

const TEAM = [{ c: '#3f86ff', d: '#2759c4', l: '#9cc2ff', name: 'Blue' }, { c: '#ff4f68', d: '#c42c45', l: '#ffadb9', name: 'Red' }];
const FX = 5.0, FZ = 8.2;             // field half sizes: x ±FX, z ±FZ; blue owns z > 0, red z < 0

// ---------------------------------------------------------------- unit roster (all original)
// acc: accessories {g: box|sph|cone|cyl, at: root|head|armR|armL, p, r, s, c ('team'|'teamD'|'teamL'|hex)}
const UNITS = [
  { id: 'pillow', name: 'Pillow Basher', icon: '☁️', cost: 25, hp: 55, spd: 1.8, mass: 0.9, dmg: 7, range: 0.85, cd: 0.8, kb: 3.2, unlock: 1, size: 0.92, skin: '#ffd7ba',
    blurb: 'Cheap and bouncy. Knocks foes over.',
    acc: [{ g: 'box', at: 'armR', p: [0, -0.42, 0.18], s: [0.42, 0.26, 0.16], c: '#ffffff' }, { g: 'cone', at: 'head', p: [0.04, 0.24, -0.03], r: [-0.4, 0, -0.3], s: [0.3, 0.38, 0.3], c: 'teamL' }, { g: 'sph', at: 'head', p: [0.12, 0.42, -0.12], s: [0.1, 0.1, 0.1], c: '#ffffff' }] },
  { id: 'knight', name: 'Jelly Knight', icon: '🗡️', cost: 60, hp: 115, spd: 1.5, mass: 1.25, dmg: 18, range: 0.9, cd: 0.9, kb: 2.4, unlock: 1, size: 1, skin: '#a7f070',
    blurb: 'Sword and shield. A steady front line.',
    acc: [{ g: 'box', at: 'armR', p: [0, -0.42, 0.32], s: [0.06, 0.09, 0.66], c: '#e9eef7' }, { g: 'box', at: 'armR', p: [0, -0.42, 0.04], s: [0.22, 0.06, 0.06], c: '#ffc93c' },
      { g: 'cyl', at: 'armL', p: [-0.06, -0.3, 0.1], r: [0, 0, Math.PI / 2], s: [0.46, 0.07, 0.46], c: 'teamL' }, { g: 'sph', at: 'head', p: [0, 0.07, -0.02], s: [0.55, 0.5, 0.55], c: '#cfd6e4' }, { g: 'cone', at: 'head', p: [0, 0.34, -0.02], s: [0.12, 0.2, 0.12], c: 'team' }] },
  { id: 'archer', name: 'Bubble Archer', icon: '🫧', cost: 70, hp: 45, spd: 1.4, mass: 0.8, dmg: 13, range: 6.6, cd: 1.3, kb: 1.4, unlock: 2, size: 0.95, skin: '#ffe2f1', shot: 'dart',
    blurb: 'Shoots foam darts from far away.',
    acc: [{ g: 'cyl', at: 'armL', p: [0, -0.4, 0.06], r: [Math.PI / 2, 0, 0], s: [0.08, 0.7, 0.08], c: '#b07a4a' }, { g: 'sph', at: 'head', p: [0, 0.06, -0.05], s: [0.56, 0.54, 0.56], c: 'teamL' }, { g: 'cyl', at: 'root', p: [0.12, 0.95, -0.28], r: [0.3, 0, 0], s: [0.14, 0.5, 0.14], c: '#b07a4a' }, { g: 'sph', at: 'root', p: [0.12, 1.22, -0.36], s: [0.13, 0.13, 0.13], c: '#ff9de2' }] },
  { id: 'cactus', name: 'Cactus Spearman', icon: '🌵', cost: 85, hp: 100, spd: 1.35, mass: 1.15, dmg: 22, range: 1.55, cd: 1.1, kb: 2.8, unlock: 4, size: 1.02, skin: '#55c27a',
    blurb: 'Long reach. Pokes from behind friends.',
    acc: [{ g: 'cyl', at: 'armR', p: [0, -0.42, 0.42], r: [Math.PI / 2, 0, 0], s: [0.05, 1.5, 0.05], c: '#c79a5b' }, { g: 'cone', at: 'armR', p: [0, -0.42, 1.2], r: [Math.PI / 2, 0, 0], s: [0.1, 0.22, 0.1], c: '#e9eef7' },
      { g: 'cone', at: 'head', p: [0, 0.27, 0], s: [0.08, 0.16, 0.08], c: '#2e8b57' }, { g: 'cone', at: 'head', p: [0.2, 0.12, 0], r: [0, 0, -1.2], s: [0.07, 0.14, 0.07], c: '#2e8b57' }, { g: 'cone', at: 'head', p: [-0.2, 0.12, 0], r: [0, 0, 1.2], s: [0.07, 0.14, 0.07], c: '#2e8b57' }, { g: 'sph', at: 'head', p: [0.1, 0.24, 0.08], s: [0.13, 0.1, 0.13], c: '#ff7eb6' }] },
  { id: 'frog', name: 'Catapult Frog', icon: '🐸', cost: 150, hp: 85, spd: 1.0, mass: 1.6, dmg: 24, range: 9, minR: 2, cd: 2.6, kb: 4.2, splash: 1.45, unlock: 6, size: 1.05, w: 1.3, h: 0.8, skin: '#7bd14a', shot: 'lob',
    blurb: 'Lobs mud balls that splash a crowd.',
    acc: [{ g: 'sph', at: 'head', p: [0.13, 0.2, 0.08], s: [0.17, 0.17, 0.17], c: '#ffffff' }, { g: 'sph', at: 'head', p: [-0.13, 0.2, 0.08], s: [0.17, 0.17, 0.17], c: '#ffffff' }, { g: 'sph', at: 'head', p: [0.13, 0.22, 0.16], s: [0.08, 0.08, 0.08], c: '#222' }, { g: 'sph', at: 'head', p: [-0.13, 0.22, 0.16], s: [0.08, 0.08, 0.08], c: '#222' },
      { g: 'cyl', at: 'root', p: [0, 1.15, -0.25], r: [-0.7, 0, 0], s: [0.07, 0.75, 0.07], c: '#9a6b3c' }, { g: 'sph', at: 'root', p: [0, 1.42, -0.5], s: [0.26, 0.13, 0.26], c: '#9a6b3c' }] },
  { id: 'ninja', name: 'Sock Ninja', icon: '🧦', cost: 90, hp: 60, spd: 3.0, mass: 0.85, dmg: 11, range: 0.8, cd: 0.42, kb: 1.5, unlock: 9, size: 0.9, skin: '#f4f1ea',
    blurb: 'Super fast. Flurry of tiny bonks.',
    acc: [{ g: 'box', at: 'head', p: [0, 0.08, 0], s: [0.53, 0.1, 0.53], c: 'team' }, { g: 'box', at: 'head', p: [0, 0.1, -0.33], r: [0.6, 0, 0], s: [0.06, 0.06, 0.3], c: 'team' }, { g: 'box', at: 'armR', p: [0, -0.42, 0.2], s: [0.05, 0.05, 0.38], c: '#e9eef7' }, { g: 'box', at: 'head', p: [0, 0.22, 0], s: [0.5, 0.06, 0.5], c: '#ff8fab' }] },
  { id: 'balloon', name: 'Balloon Bomber', icon: '🎈', cost: 120, hp: 50, spd: 1.9, mass: 0.7, dmg: 26, range: 0.5, cd: 2.0, kb: 3.4, splash: 1.3, unlock: 12, size: 0.85, fly: true, skin: '#ffe6a8', shot: 'drop',
    blurb: 'Floats over the fight, drops water balloons.',
    acc: [{ g: 'sph', at: 'root', p: [0, 2.35, 0], s: [0.85, 1.0, 0.85], c: 'team' }, { g: 'cyl', at: 'root', p: [0, 1.65, 0], s: [0.02, 0.6, 0.02], c: '#ffffff' }, { g: 'sph', at: 'root', p: [0.18, 2.6, 0.3], s: [0.16, 0.24, 0.1], c: '#ffffff' }, { g: 'box', at: 'head', p: [0, 0.1, 0.18], s: [0.3, 0.08, 0.1], c: '#5a5f7a' }] },
  { id: 'bard', name: 'Kazoo Bard', icon: '🎺', cost: 110, hp: 70, spd: 1.3, mass: 1, dmg: 6, range: 4.2, cd: 1.0, kb: 0.8, unlock: 15, size: 0.95, skin: '#ffd2a8', shot: 'note', heal: 9,
    blurb: 'Heals nearby friends with catchy tunes.',
    acc: [{ g: 'cone', at: 'head', p: [0, 0.27, 0], r: [0, 0, 0.25], s: [0.42, 0.3, 0.42], c: '#8e5cff' }, { g: 'box', at: 'head', p: [0.18, 0.44, -0.1], r: [0, 0, -0.8], s: [0.05, 0.3, 0.08], c: '#ffd23f' }, { g: 'cyl', at: 'armR', p: [0, -0.42, 0.12], r: [Math.PI / 2, 0, 0], s: [0.06, 0.3, 0.06], c: '#ffc93c' }] },
  { id: 'giant', name: 'Snowball Giant', icon: '⛄', cost: 320, hp: 720, spd: 0.95, mass: 5, dmg: 46, range: 1.35, cd: 1.7, kb: 9, splash: 1.2, unlock: 19, size: 1.9, skin: '#f5fbff',
    blurb: 'Huge and slow. Bowls over whole squads.',
    acc: [{ g: 'cone', at: 'head', p: [0, 0, 0.3], r: [Math.PI / 2, 0, 0], s: [0.07, 0.24, 0.07], c: '#ff8c1a' }, { g: 'cyl', at: 'head', p: [0, 0.3, 0], s: [0.3, 0.26, 0.3], c: '#2c2f4a' }, { g: 'cyl', at: 'head', p: [0, 0.18, 0], s: [0.5, 0.03, 0.5], c: '#2c2f4a' }, { g: 'box', at: 'root', p: [0, 0.98, 0.05], s: [0.62, 0.1, 0.62], c: 'team' }] },
];
const U = Object.fromEntries(UNITS.map(t => [t.id, t]));
for (const t of UNITS) { t.w = t.w || 1; t.h = t.h || 1; t.rad = 0.3 * t.size * t.w; t.power = Math.sqrt(t.hp * t.dmg / t.cd * (t.splash ? 2.2 : 1) * (t.range > 2 ? 1.6 : 1) * (t.heal ? 1.8 : 1)) / t.cost; }
const MELEE = ['giant', 'cactus', 'knight', 'ninja', 'pillow'], RANGED = ['frog', 'archer', 'bard', 'balloon'];

// ---------------------------------------------------------------- 30 campaign battles (deterministic) + daily
const LNAMES = ['Pillow Fight', 'First Swords', 'Dart Practice', 'Front Line', 'Prickly Path', 'Mud Season', 'Two Hills', 'Shield Wall', 'Sock Drawer', 'Crossfire',
  'The Wedge', 'Up, Up, Away', 'Swamp Siege', 'Night Shift', 'Kazoo Choir', 'Double Flank', 'Frog Pond', 'Great Wall', 'Snow Day', 'The Pincer',
  'Bard Battalion', 'Sky Raid', 'Cactus Grove', 'Last Pillow', 'Big Freeze', 'Arrow Rain', 'Royal Mess', 'Iron Jelly', 'Giant Steps', 'Grand Wobble'];
const r10 = v => Math.round(v / 10) * 10;
function slots(team, rows, cols, z0, dz, spread = 0.95) {
  const out = [], s = team ? -1 : 1;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const k = c - (cols - 1) / 2; out.push({ x: k * spread + (r % 2) * spread * 0.4, z: s * (z0 + r * dz), o: Math.abs(k) + r * 2.2 }); }
  return out.sort((a, b) => a.o - b.o);
}
function armyFrom(r, avail, budget, theme, team, maxN = 36) {
  const list = [];
  let left = budget, guard = 0;
  const cheapest = Math.min(...avail.map(k => U[k].cost));
  while (left >= cheapest && list.length < maxN && guard++ < 200) {
    let pool = avail.filter(k => U[k].cost <= left);
    if (theme === 'rush') pool = pool.filter(k => MELEE.includes(k)).length ? pool.filter(k => MELEE.includes(k)) : pool;
    if (theme === 'ranged' && r() < 0.65) { const p = pool.filter(k => RANGED.includes(k)); if (p.length) pool = p; }
    if (theme === 'boss' && !list.length) pool.sort((a, b) => U[b].cost - U[a].cost), pool = pool.slice(0, 1);
    if (!pool.length) break;
    const k = pool[Math.floor(r() * pool.length)]; list.push(k); left -= U[k].cost;
  }
  // formation: melee in front, ranged behind
  const mel = slots(team, 4, 9, 1.4, 0.75), rng2 = slots(team, 4, 9, 4.4, 0.75, 1.05), out = [];
  const flank = theme === 'flank';
  const pick = (arr, k) => { let i = flank ? arr.findIndex(s => Math.abs(s.x) > 1.6) : 0; if (i < 0) i = 0; return arr.splice(i, 1)[0]; };
  for (const k of list) { const s = pick(RANGED.includes(k) ? rng2 : mel, k) || pick(mel, k); out.push({ k, x: clamp(s.x + (r() - 0.5) * 0.3, -FX + 0.4, FX - 0.4), z: s.z + (r() - 0.5) * 0.2 }); }
  return { units: out, spent: budget - left };
}
function makeLevel(L) {
  const r = rng(L * 7919 + 13), fk = F.k();
  const avail = UNITS.filter(t => t.unlock <= L + (L > 3 ? 1 : 0)).map(t => t.id);
  let army;
  if (L === 1) army = { units: [-1.5, -0.5, 0.5, 1.5].map(x => ({ k: 'pillow', x, z: -2 })), spent: 100 };
  else if (L === 2) army = { units: [{ k: 'knight', x: -0.6, z: -1.8 }, { k: 'knight', x: 0.6, z: -1.8 }, { k: 'pillow', x: -1.8, z: -2.2 }, { k: 'pillow', x: 1.8, z: -2.2 }, { k: 'pillow', x: 0, z: -2.8 }], spent: 195 };
  else {
    const themes = ['mixed', 'rush', 'ranged', 'flank', 'boss'];
    const theme = themes[(L * 3 + Math.floor(r() * 2)) % themes.length];
    army = armyFrom(r, avail, Math.round((40 + L * 62 + L * L * 2.4) * fk), theme, 1);
  }
  const ratio = L <= 2 ? 1.6 : 1.3 - 0.42 * (L - 1) / 29;
  return { L, name: LNAMES[L - 1], enemy: army.units, budget: Math.max(100, r10(army.spent * ratio)), avail: UNITS.filter(t => t.unlock <= L).map(t => t.id) };
}
function makeDaily(seed) {
  const r = rng(seed), all = UNITS.map(t => t.id), themes = ['mixed', 'rush', 'ranged', 'flank', 'boss'];
  const army = armyFrom(r, all, 1300 + Math.floor(r() * 500), themes[seed % 5], 1);
  return { L: 0, daily: true, name: 'Daily Battle', enemy: army.units, budget: r10(army.spent * 1.2), avail: all };
}

// ---------------------------------------------------------------- world: lawn arena, trees, flowers
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color(), _v = new THREE.Vector3();
const WHITE = new THREE.Color('#ffffff'), YAX = new THREE.Vector3(0, 1, 0);
const lawn = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512; const x = c.getContext('2d');
  for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? '#9edc6f' : '#93d463'; x.fillRect(0, i * 32, 256, 32); }
  const r = rng(5); for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(255,255,255,${0.08 + r() * 0.1})`; x.fillRect(r() * 256, r() * 512, 2, 3); }
  x.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 12; i++) x.fillRect(8 + i * 21.5, 253, 13, 6);
  x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 5; x.strokeRect(4, 4, 248, 504);
  x.beginPath(); x.arc(128, 256, 34, 0, 7); x.lineWidth = 4; x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
})();
const side = mat('#8a6a4a', { roughness: 0.9 });
const field = new THREE.Mesh(new THREE.BoxGeometry(FX * 2 + 0.6, 0.7, FZ * 2 + 0.6), [side, side, mat('#ffffff', { map: lawn, roughness: 0.95 }), side, side, side]);
field.position.y = -0.35; field.receiveShadow = true; scene.add(field);
const meadow = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), mat('#b6e39a', { roughness: 1 })); meadow.rotation.x = -Math.PI / 2; meadow.position.y = -0.62; meadow.receiveShadow = true; scene.add(meadow);
const zoneMat = [new THREE.MeshBasicMaterial({ color: TEAM[0].c, transparent: true, opacity: 0.16, depthWrite: false }), new THREE.MeshBasicMaterial({ color: TEAM[1].c, transparent: true, opacity: 0.12, depthWrite: false })];
const zones = [0, 1].map(t => { const z = new THREE.Mesh(new THREE.PlaneGeometry(FX * 2, FZ - 0.5), zoneMat[t]); z.rotation.x = -Math.PI / 2; z.position.set(0, 0.012, (t ? -1 : 1) * (FZ + 0.5) / 2); scene.add(z); return z; });
// trees + bushes + flowers around the arena (instanced)
const deco = [];
{ const r = rng(42); let guard = 0;
  while (deco.length < 46 && guard++ < 2000) { const x = (r() - 0.5) * 44, z = (r() - 0.5) * 50; if (Math.abs(x) < FX + 2.2 && Math.abs(z) < FZ + 2.2) continue; deco.push({ x, z, s: 0.8 + r() * 0.9, k: r() }); } }
const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.24, 1.2, 7), mat('#9a6b47'), deco.length); trunk.castShadow = true;
const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), mat('#ffffff', { flatShading: true, roughness: 0.8 }), deco.length); crown.castShadow = true;
deco.forEach((d, i) => {
  trunk.setMatrixAt(i, _m.compose(_p.set(d.x, -0.62 + 0.6 * d.s, d.z), _q.identity(), _s.setScalar(d.s)));
  crown.setMatrixAt(i, _m.compose(_p.set(d.x, -0.62 + 1.55 * d.s, d.z), _q.setFromEuler(_e.set(0, d.k * 6, 0)), _s.set(d.s * 0.95, d.s * 1.05, d.s * 0.95)));
  crown.setColorAt(i, _c.set(['#5cbf6a', '#79d27a', '#4fae6b', '#f7a8c4'][Math.floor(d.k * 4)]));
});
scene.add(trunk, crown);
const NFL = 90, flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 6, 5), mat('#ffffff'), NFL);
{ const r = rng(77); for (let i = 0; i < NFL; i++) { let x, z; do { x = (r() - 0.5) * 30; z = (r() - 0.5) * 34; } while (Math.abs(x) < FX + 0.8 && Math.abs(z) < FZ + 0.8);
  flowers.setMatrixAt(i, _m.compose(_p.set(x, -0.55, z), _q.identity(), _s.setScalar(0.7 + r()))); flowers.setColorAt(i, _c.set(['#ffffff', '#ffd23f', '#ff8fab', '#b39bff'][i % 4])); } }
scene.add(flowers);
// flags at the two ends
for (const t of [0, 1]) for (const sx of [-1, 1]) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), mat('#ffffff')); pole.position.set(sx * (FX + 0.1), 1.3 - 0.0, (t ? -1 : 1) * (FZ + 0.1)); pole.castShadow = true; scene.add(pole);
  const fl = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.55, 0.85), mat(TEAM[t].c)); fl.position.set(sx * (FX + 0.1), 2.3, (t ? -1 : 1) * (FZ + 0.1) + (t ? 0.45 : -0.45)); scene.add(fl);
}

// ---------------------------------------------------------------- instanced body parts for every unit (≈12 draw calls for the whole army)
const MAXU = 96;
const inst = (geo, material, n, shadow = true) => { const m = new THREE.InstancedMesh(geo, material, n); m.castShadow = shadow; m.frustumCulled = false; m.count = 0; scene.add(m); m.setColorAt(0, WHITE); return m; };
const torsoM = inst(new THREE.CapsuleGeometry(0.27, 0.3, 5, 14), mat('#ffffff', { roughness: 0.42 }), MAXU);
const headM = inst(new THREE.SphereGeometry(0.25, 18, 14), mat('#ffffff', { roughness: 0.38 }), MAXU);
const limbM = inst(new THREE.CapsuleGeometry(0.085, 0.3, 4, 8), mat('#ffffff', { roughness: 0.45 }), MAXU * 4);
const eyeM = inst(new THREE.SphereGeometry(0.048, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }), MAXU * 2, false);
const ACC = {
  box: inst(rounded(1, 1, 1, 0.12), mat('#ffffff', { roughness: 0.4 }), MAXU * 3),
  sph: inst(new THREE.SphereGeometry(0.5, 14, 10), mat('#ffffff', { roughness: 0.35 }), MAXU * 5),
  cone: inst(new THREE.ConeGeometry(0.5, 1, 10), mat('#ffffff', { roughness: 0.45 }), MAXU * 4),
  cyl: inst(new THREE.CylinderGeometry(0.5, 0.5, 1, 12), mat('#ffffff', { roughness: 0.45 }), MAXU * 3),
};
const discM = inst(new THREE.CircleGeometry(0.42, 20), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false }), MAXU, false);
discM.geometry.rotateX(-Math.PI / 2);
const projM = inst(new THREE.SphereGeometry(0.13, 10, 8), mat('#ffffff', { roughness: 0.3 }), 160);
const partM = inst(new THREE.BoxGeometry(0.14, 0.14, 0.14), mat('#ffffff', { roughness: 0.5 }), 700, false);
const ringM = inst(new THREE.RingGeometry(0.75, 1, 32), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }), 24, false);
ringM.geometry.rotateX(-Math.PI / 2);

// ---------------------------------------------------------------- state
let units = [], projs = [], parts = [], rings = [];
let state = 'ready', phase = 'menu', mode = D.seed ? 'daily' : 'camp', level = Math.min(unlocked, 30), def = null;
let budget = 0, spent = 0, sel = 'knight', placeTeam = 0, timeScale = 1, slowT = 0, speedX = 1, shake = 0, battleT = 0, wins = 0, recorded = false, beatenShown = false;
let lastArmy = null, sandArmy = null, startCount = [0, 0], resultT = 0, winner = -1, tipT = 0, voiceT = 0;
const cam = { yaw: 0, pitch: 0.98, dist: 24, tx: 0, tz: 0.6, uYaw: 0, uPitch: 0, uZoom: 1, userT: 0 };

function addUnit(k, team, x, z, popIn = true) {
  const T = U[k];
  const u = { T, k, team, x, z, y: T.fly ? 2 : 0, vx: 0, vy: 0, vz: 0, yaw: team ? 0 : Math.PI, hp: T.hp, tx: 0, tz: 0, wx: 0, wz: 0, ox: 0, oz: 0, ovx: 0, ovz: 0,
    down: 0, dead: false, deadT: 0, gone: false, cd: 0.3 + Math.random() * 0.5, swing: -1, hitDone: false, tgt: null, retT: 0, walk: Math.random() * 6, flash: 0, pop: popIn ? 0.01 : 1, healT: 1, idle: Math.random() * 6, cheer: 0 };
  units.push(u); return u;
}
function aliveOf(team) { let n = 0; for (const u of units) if (!u.dead && u.team === team) n++; return n; }

// ---------------------------------------------------------------- particles, rings, sound
function puff(x, y, z, col, n = 10, sp = 3, up = 3, life = 0.8, sz = 1) {
  for (let i = 0; i < n && parts.length < 700; i++) { const a = Math.random() * 6.283, s = sp * (0.4 + Math.random() * 0.8);
    parts.push({ x, y, z, vx: Math.cos(a) * s, vy: up * (0.5 + Math.random()), vz: Math.sin(a) * s, life, max: life, c: Array.isArray(col) ? col[i % col.length] : col, s: sz * (0.6 + Math.random() * 0.8), r: Math.random() * 6 }); }
}
const CONF = ['#ff5d8f', '#ffd23f', '#3ab795', '#3a86ff', '#7b5cff', '#ffffff'];
function ring(x, z, col, r = 1.4) { if (rings.length < 24) rings.push({ x, z, t: 0, r, c: col }); }
function squeak(pitch = 1) { if (voiceT > 0) return; voiceT = 0.06; tone((380 + Math.random() * 420) * pitch, 0.09, 'sine', 0.06, 1.7); }
const thump = () => tone(95 + Math.random() * 30, 0.12, 'triangle', 0.13, 0.5);
const popSnd = () => { tone(620 + Math.random() * 200, 0.07, 'square', 0.045, 2.2); tone(1250, 0.1, 'sine', 0.05, 1.3); };

// ---------------------------------------------------------------- combat
function hurt(u, dmg, dx, dz, kb, src) {
  if (u.dead) return;
  u.hp -= dmg; u.flash = 1;
  const l = Math.hypot(dx, dz) || 1, im = kb / u.T.mass;
  dx /= l; dz /= l;
  u.vx += dx * im * 1.4; u.vz += dz * im * 1.4; if (!u.T.fly) u.vy += im * 0.9;
  u.wx += dz * im * 2.2; u.wz -= dx * im * 2.2; u.ovx += dx * im * 1.5; u.ovz += dz * im * 1.5;
  if (im > 3.0 && !u.T.fly) { u.down = 0.6 + Math.random() * 0.5; u.fx = dx; u.fz = dz; }
  squeak(u.T.size > 1.5 ? 0.5 : 1);
  if (u.hp <= 0) {
    u.dead = true; u.deadT = 0; u.fx = dx; u.fz = dz; u.vy += 3.5; u.vx += dx * 2; u.vz += dz * 2; u.down = 99;
    if (src && src.T.id === 'giant') slowMo(0.3, 0.35);
  }
}
function slowMo(scale, sec) { timeScale = Math.min(timeScale, scale); slowT = Math.max(slowT, sec); }
function nearestEnemy(u) {
  let best = null, bd = 1e9;
  for (const o of units) { if (o.dead || o.team === u.team) continue; const d = (o.x - u.x) ** 2 + (o.z - u.z) ** 2 + (o.T.fly && !u.T.shot ? 4 : 0); if (d < bd) { bd = d; best = o; } }
  return best;
}
function shoot(u, t) {
  const T = u.T, hx = u.x + Math.sin(u.yaw) * 0.3, hz = u.z + Math.cos(u.yaw) * 0.3, hy = u.y + 1.1 * T.size * T.h;
  const tx = t.x + t.vx * 0.2, tz = t.z + t.vz * 0.2, ty = t.y + 0.8 * t.T.size;
  const d = Math.hypot(tx - hx, tz - hz), G = 14;
  let time;
  if (T.shot === 'drop') { projs.push({ x: u.x, y: u.y + 0.9, z: u.z, vx: u.vx * 0.5, vy: 0, vz: u.vz * 0.5, u, kind: 'drop', c: '#4cc9f0', team: u.team }); tone(500, 0.08, 'sine', 0.05, 0.6); return; }
  if (T.shot === 'lob') time = 0.85 + d * 0.09; else time = Math.max(0.12, d / 11);
  const vy = (ty - hy) / time + 0.5 * G * time;
  projs.push({ x: hx, y: hy, z: hz, vx: (tx - hx) / time, vy, vz: (tz - hz) / time, u, kind: T.shot, c: T.shot === 'lob' ? '#8a6a3c' : T.shot === 'note' ? '#ffd23f' : '#ff7ec8', team: u.team, life: 4 });
  if (T.shot === 'lob') { tone(160, 0.18, 'triangle', 0.1, 1.8); u.ovz -= 1.5; } else if (T.shot === 'note') note(76 + Math.floor(Math.random() * 5) * 2, 0.15, 0.06); else tone(900, 0.05, 'triangle', 0.05, 0.5);
}
function splash(x, z, p) {
  const T = p.u.T; let ko = 0;
  for (const o of units) { if (o.dead || o.team === p.team) continue; const dx = o.x - x, dz = o.z - z, d = Math.hypot(dx, dz), y = o.y;
    if (d < T.splash + o.T.rad && y < 3.2) { const f = 1 - 0.5 * d / T.splash; hurt(o, T.dmg * f, dx || 0.01, dz || 0.01, T.kb * f, p.u); if (o.dead) ko++; } }
  puff(x, 0.2, z, p.kind === 'drop' ? ['#4cc9f0', '#bdeeff', '#ffffff'] : ['#8a6a3c', '#b38b52', '#6bbf59'], 16, 3.5, 4, 0.7, 1.1); ring(x, z, p.kind === 'drop' ? '#bdeeff' : '#e9d3a8', T.splash);
  shake = Math.max(shake, 0.18); thump(); if (p.kind === 'drop') tone(300, 0.15, 'sine', 0.08, 0.4);
  if (ko >= 2) slowMo(0.3, 0.45);
}
function updateUnit(u, dt) {
  const T = u.T;
  u.flash = Math.max(0, u.flash - dt * 6); u.pop = Math.min(1, u.pop + dt * 4);
  if (u.dead) {
    u.deadT += dt;
    if (u.deadT > 0.75 && !u.gone) { u.gone = true; const c = TEAM[u.team].c; puff(u.x, u.y + 0.7 * T.size, u.z, [c, T.skin, ...CONF], 14 + Math.round(T.size * 6), 3.2 * Math.sqrt(T.size), 4, 0.9, 0.9); ring(u.x, u.z, '#ffffff', 0.8 * T.size); popSnd(); }
  }
  const fighting = phase === 'battle' && !u.dead;
  if (fighting) {
    u.cd -= dt; u.retT -= dt; if (u.down > 0) u.down -= dt;
    if (!u.tgt || u.tgt.dead || u.retT <= 0) { u.tgt = nearestEnemy(u); u.retT = 0.35 + Math.random() * 0.25; }
    if (T.heal) { u.healT -= dt; if (u.healT <= 0) { u.healT = 1.5; let any = false;
      for (const o of units) if (!o.dead && o.team === u.team && o !== u && o.hp < o.T.hp && (o.x - u.x) ** 2 + (o.z - u.z) ** 2 < 10) { o.hp = Math.min(o.T.hp, o.hp + T.heal); any = true; if (parts.length < 650) puff(o.x, o.y + 1.4 * o.T.size, o.z, '#7dffa0', 2, 0.6, 1.5, 0.6, 0.7); }
      if (any) { ring(u.x, u.z, '#7dffa0', 1.8); } } }
    const t = u.tgt, grounded = T.fly || u.y < 0.05;
    if (t && u.down <= 0) {
      const dx = t.x - u.x, dz = t.z - u.z, d = Math.hypot(dx, dz) || 0.001;
      const want = Math.atan2(dx, dz); let da = ((want - u.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; u.yaw += da * Math.min(1, 9 * dt);
      const reach = T.shot === 'drop' ? 0.45 : T.range + t.T.rad + u.T.rad * 0.5;
      let mvx = 0, mvz = 0;
      if (d > reach * 0.92) { mvx = dx / d * T.spd; mvz = dz / d * T.spd; }
      else if (T.minR && d < T.minR) { mvx = -dx / d * T.spd * 0.7; mvz = -dz / d * T.spd * 0.7; }
      if (grounded) { const k = Math.min(1, 7 * dt); u.vx += (mvx - u.vx) * k; u.vz += (mvz - u.vz) * k; }
      if (d <= reach && u.cd <= 0 && Math.abs(da) < 0.8) {
        u.cd = T.cd * (0.9 + Math.random() * 0.2);
        if (T.shot) { shoot(u, t); u.swing = 0; u.hitDone = true; }
        else { u.swing = 0; u.hitDone = false; }
      }
    } else if (grounded) { const k = Math.min(1, 6 * dt); u.vx -= u.vx * k; u.vz -= u.vz * k; }
    // melee hit lands mid-swing
    if (u.swing >= 0 && !u.hitDone && u.swing > 0.45 && t) {
      u.hitDone = true;
      const dx = t.x - u.x, dz = t.z - u.z, d = Math.hypot(dx, dz);
      if (d < T.range + t.T.rad + u.T.rad + 0.4) {
        if (T.splash) { for (const o of units) { if (o.dead || o.team === u.team) continue; const ex = o.x - t.x, ez = o.z - t.z; if (ex * ex + ez * ez < T.splash ** 2 && o.y < 2.4) hurt(o, T.dmg, o.x - u.x, o.z - u.z, T.kb, u); }
          shake = Math.max(shake, 0.3); thump(); puff(t.x, 0.1, t.z, ['#ffffff', '#e8f6ff'], 12, 3, 2.5, 0.6); ring(t.x, t.z, '#ffffff', 1.6); buzz(15); }
        else { hurt(t, T.dmg, dx, dz, T.kb, u); if (T.kb >= 3) shake = Math.max(shake, 0.08); }
        u.vx += dx * 0.5; u.vz += dz * 0.5;
      }
    }
  } else if (!u.dead) { const k = Math.min(1, 6 * dt); u.vx -= u.vx * k; u.vz -= u.vz * k; }
  if (u.swing >= 0) { u.swing += dt / (T.shot ? 0.4 : 0.36); if (u.swing >= 1) u.swing = -1; }
  // body physics: gravity, friction, hover for flyers
  if (T.fly && !u.dead) { u.y = lerp(u.y, 2.0 + Math.sin(u.idle * 2) * 0.15, Math.min(1, 3 * dt)); u.vy = 0; }
  else {
    if (u.y > 0 || u.vy > 0) { u.vy -= 18 * dt; u.y += u.vy * dt; if (u.y <= 0) { if (u.vy < -5) { puff(u.x, 0.05, u.z, '#f3ead7', 6, 1.6, 1, 0.5); thump(); } u.y = 0; u.vy = 0; } }
    if (u.y <= 0.001 && (u.down > 0 || u.dead)) { const k = Math.min(1, 5 * dt); u.vx -= u.vx * k; u.vz -= u.vz * k; }
  }
  u.x += u.vx * dt; u.z += u.vz * dt;
  if (Math.abs(u.x) > FX) { u.x = Math.sign(u.x) * FX; u.vx *= -0.4; }
  if (Math.abs(u.z) > FZ) { u.z = Math.sign(u.z) * FZ; u.vz *= -0.4; }
  // tilt spring: upright wobble, or lying down while knocked over
  let tx = u.vz * 0.05, tz = -u.vx * 0.05, K = 70, C = 7;
  if (u.down > 0) { tx = (u.fz || 0) * 1.45; tz = -(u.fx || 0) * 1.45; K = 40; C = 9; }
  if (u.cheer > 0) { u.cheer -= dt; }
  u.wx += ((tx - u.tx) * K - u.wx * C) * dt; u.wz += ((tz - u.tz) * K - u.wz * C) * dt;
  u.tx += u.wx * dt; u.tz += u.wz * dt;
  if (u.down > 0 && u.down - dt <= 0 && !u.dead && !T.fly) { u.vy = 3; }
  // head jiggle
  u.ovx += (-u.ox * 160 - u.ovx * 9) * dt; u.ovz += (-u.oz * 160 - u.ovz * 9) * dt; u.ox += u.ovx * dt; u.oz += u.ovz * dt;
  u.ox = clamp(u.ox, -0.18, 0.18); u.oz = clamp(u.oz, -0.18, 0.18);
  const sp = Math.hypot(u.vx, u.vz); u.walk += sp * dt * 4.2; u.idle += dt;
}
function separate() {
  for (let i = 0; i < units.length; i++) { const a = units[i]; if (a.gone) continue;
    for (let j = i + 1; j < units.length; j++) { const b = units[j]; if (b.gone || (a.T.fly !== b.T.fly)) continue;
      const dx = b.x - a.x, dz = b.z - a.z, rs = a.T.rad + b.T.rad, dd = dx * dx + dz * dz;
      if (dd < rs * rs && dd > 1e-6) { const d = Math.sqrt(dd), push = (rs - d) / d * 0.5, ma = a.T.mass, mb = b.T.mass, wa = mb / (ma + mb), wb = ma / (ma + mb);
        a.x -= dx * push * wa; a.z -= dz * push * wa; b.x += dx * push * wb; b.z += dz * push * wb; } } }
}
function updateProjs(dt) {
  for (const p of projs) {
    p.vy -= 14 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.life -= dt;
    if (p.kind === 'lob' || p.kind === 'drop') { if (p.y <= 0.1) { p.dead = true; splash(p.x, p.z, p); } continue; }
    for (const o of units) { if (o.dead || o.team === p.team) continue; const dx = o.x - p.x, dz = o.z - p.z, by = p.y - o.y;
      if (dx * dx + dz * dz < (o.T.rad + 0.18) ** 2 && by > -0.1 && by < 1.6 * o.T.size * o.T.h) { p.dead = true; hurt(o, p.u.T.dmg, p.vx, p.vz, p.u.T.kb, p.u); puff(p.x, p.y, p.z, [p.c, '#ffffff'], 5, 1.5, 1.5, 0.4, 0.6); break; } }
    if (p.y < 0 || p.life < 0) { p.dead = true; puff(p.x, 0.05, p.z, p.c, 3, 1, 1, 0.3, 0.5); }
  }
  projs = projs.filter(p => !p.dead);
}

// ---------------------------------------------------------------- rendering units into the instanced parts
const mRoot = new THREE.Matrix4(), mHead = new THREE.Matrix4(), mArmR = new THREE.Matrix4(), mArmL = new THREE.Matrix4(), mLoc = new THREE.Matrix4(), mOut = new THREE.Matrix4();
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
function loc(px, py, pz, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) { return mLoc.compose(_p.set(px, py, pz), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz)); }
const cnt = { t: 0, h: 0, l: 0, e: 0, d: 0, box: 0, sph: 0, cone: 0, cyl: 0 };
function teamCol(c, team) { return c === 'team' ? TEAM[team].c : c === 'teamD' ? TEAM[team].d : c === 'teamL' ? TEAM[team].l : c; }
function drawUnit(u, t) {
  const T = u.T, s = T.size * (u.pop < 1 ? (1 - Math.pow(1 - u.pop, 3)) * (1 + Math.sin(u.pop * 9) * 0.25 * (1 - u.pop)) : 1);
  const fl = u.flash, team = TEAM[u.team];
  const bob = phase === 'battle' && !u.dead ? Math.abs(Math.sin(u.walk)) * 0.06 : Math.sin(u.idle * 2.5) * 0.015;
  let cheerY = 0; if (u.cheer > 0) cheerY = Math.abs(Math.sin(u.cheer * 7)) * 0.5;
  qa.setFromEuler(_e.set(u.tx, 0, u.tz)); qb.setFromAxisAngle(YAX, u.yaw); qa.multiply(qb);
  mRoot.compose(_p.set(u.x, u.y + bob + cheerY, u.z), qa, _s.set(s * T.w, s * T.h, s * T.w));
  const col = (c) => _c.set(c).lerp(WHITE, fl * 0.8);
  // torso (squash on landing / breathing)
  torsoM.setMatrixAt(cnt.t, mOut.multiplyMatrices(mRoot, loc(0, 0.8, 0, 0, 0, 0, 1, 1 + Math.sin(u.idle * 3) * 0.03, 1))); torsoM.setColorAt(cnt.t++, col(team.c));
  mHead.multiplyMatrices(mRoot, loc(u.ox, 1.3, u.oz, u.oz * 1.5, 0, -u.ox * 1.5));
  headM.setMatrixAt(cnt.h, mHead); headM.setColorAt(cnt.h++, col(T.skin));
  for (const ex of [-0.09, 0.09]) { if (T.id === 'frog') break; eyeM.setMatrixAt(cnt.e, mOut.multiplyMatrices(mHead, loc(ex, 0.04, 0.215, 0, 0, 0, 1, u.dead ? 0.3 : 1.25 - (Math.sin(u.idle * 1.3 + u.x) > 0.97 ? 1 : 0), 1))); eyeM.setColorAt(cnt.e++, _c.set('#1f2033')); }
  // arms
  const moving = phase === 'battle' && Math.hypot(u.vx, u.vz) > 0.3, w = Math.sin(u.walk * 1.4);
  let aR = moving ? -w * 0.6 : Math.sin(u.idle * 2) * 0.08, aL = moving ? w * 0.6 : -Math.sin(u.idle * 2) * 0.08, spread = 0.12;
  if (u.swing >= 0) { const k = u.swing; aR = T.shot ? -1.5 + Math.sin(k * Math.PI) * 0.5 : (k < 0.45 ? -2.6 * (k / 0.45) : -2.6 + (k - 0.45) / 0.55 * 3.4); }
  if (T.shot === 'dart' && phase === 'battle') aL = -1.45;
  if (u.down > 0 || u.dead || T.fly) { aR = -2.6 + Math.sin(t * 14 + u.x) * 0.5; aL = -2.6 + Math.cos(t * 13 + u.z) * 0.5; spread = 0.5; }
  if (u.cheer > 0) { aR = aL = -2.9; spread = 0.35; }
  mArmR.multiplyMatrices(mRoot, loc(-0.36, 1.02, 0, aR, 0, -spread)); mArmL.multiplyMatrices(mRoot, loc(0.36, 1.02, 0, aL, 0, spread));
  const limbC = col(team.d);
  limbM.setMatrixAt(cnt.l, mOut.multiplyMatrices(mArmR, loc(0, -0.2, 0))); limbM.setColorAt(cnt.l++, limbC);
  limbM.setMatrixAt(cnt.l, mOut.multiplyMatrices(mArmL, loc(0, -0.2, 0))); limbM.setColorAt(cnt.l++, limbC);
  const lw = moving ? w * 0.7 : 0, dangle = T.fly ? Math.sin(t * 3 + u.x) * 0.3 : 0;
  for (const [lx, a] of [[-0.13, lw + dangle], [0.13, -lw - dangle]]) {
    limbM.setMatrixAt(cnt.l, mOut.multiplyMatrices(mRoot, loc(lx, 0.48, 0, a, 0, 0)).multiply(loc(0, -0.22, 0))); limbM.setColorAt(cnt.l++, _c.set(T.skin).lerp(_c2.set('#2c2f4a'), 0.15));
  }
  for (const a of T.acc) {
    const base = a.at === 'head' ? mHead : a.at === 'armR' ? mArmR : a.at === 'armL' ? mArmL : mRoot;
    const r = a.r || [0, 0, 0], M = ACC[a.g];
    M.setMatrixAt(cnt[a.g], mOut.multiplyMatrices(base, loc(a.p[0], a.p[1], a.p[2], r[0], r[1], r[2], a.s[0], a.s[1], a.s[2]))); M.setColorAt(cnt[a.g]++, col(teamCol(a.c, u.team)));
  }
  if (!u.dead) { discM.setMatrixAt(cnt.d, mOut.compose(_p.set(u.x, 0.02, u.z), _q.identity(), _s.setScalar(s * T.w * (T.fly ? 0.7 : 1)))); discM.setColorAt(cnt.d++, _c.set(team.c)); }
}
const _c2 = new THREE.Color();
function renderAll(t, dt) {
  for (const k in cnt) cnt[k] = 0;
  for (const u of units) if (!u.gone) drawUnit(u, t);
  const fin = (m, n) => { m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; };
  fin(torsoM, cnt.t); fin(headM, cnt.h); fin(limbM, cnt.l); fin(eyeM, cnt.e); fin(discM, cnt.d); for (const g in ACC) fin(ACC[g], cnt[g]);
  projs.forEach((p, i) => { const sp = Math.hypot(p.vx, p.vy, p.vz) || 1; _v.set(p.vx / sp, p.vy / sp, p.vz / sp); _q.setFromUnitVectors(YAX, _v);
    const big = p.kind === 'lob' ? 1.8 : p.kind === 'drop' ? 1.7 : 1, st = p.kind === 'dart' ? 2.2 : 1;
    projM.setMatrixAt(i, _m.compose(_p.set(p.x, p.y, p.z), _q, _s.set(big * (p.kind === 'dart' ? 0.6 : 1), big * st, big * (p.kind === 'dart' ? 0.6 : 1)))); projM.setColorAt(i, _c.set(p.c)); });
  fin(projM, projs.length);
  for (const p of parts) { p.vy -= 9 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.y < 0.05) { p.y = 0.05; p.vy *= -0.3; p.vx *= 0.7; p.vz *= 0.7; } p.life -= dt; p.r += dt * 6; }
  parts = parts.filter(p => p.life > 0);
  parts.forEach((p, i) => { const k = p.life / p.max; partM.setMatrixAt(i, _m.compose(_p.set(p.x, p.y, p.z), _q.setFromEuler(_e.set(p.r, p.r * 0.7, 0)), _s.setScalar(p.s * Math.min(1, k * 2)))); partM.setColorAt(i, _c.set(p.c)); });
  fin(partM, parts.length);
  for (const r of rings) r.t += dt * 2.2;
  rings = rings.filter(r => r.t < 1);
  rings.forEach((r, i) => { ringM.setMatrixAt(i, _m.compose(_p.set(r.x, 0.04, r.z), _q.identity(), _s.setScalar(r.r * (0.3 + r.t)))); ringM.setColorAt(i, _c.set(r.c).lerp(_c2.set('#9edc6f'), r.t)); });
  fin(ringM, rings.length);
}

// ---------------------------------------------------------------- HUD
const mk = (cls, html = '', parent = document.body) => { const d = document.createElement('div'); d.className = 'ww ' + cls; d.innerHTML = html; parent.appendChild(d); return d; };
const top = mk('ww-top', '<div class="ww-lvl"></div><div class="ww-name"></div><div class="ww-gold"></div><div class="ww-vs ww-hide"><span>0</span><i><b style="background:var(--blue)"></b></i><i><b style="background:var(--red);margin-left:auto"></b></i><span>0</span></div>');
const menuBtn = document.createElement('button'); menuBtn.className = 'ww-menu'; menuBtn.textContent = '☰'; document.body.appendChild(menuBtn);
const bot = mk('ww-bot', `<div class="ww-row"><button class="ww-btn ww-sm" data-clear>🗑️</button><button class="ww-btn ww-sm ww-team ww-hide" data-team>🔵 Blue</button><div class="ww-info"></div><button class="ww-btn ww-fight" data-fight>⚔️ FIGHT</button></div><div class="ww-bar"></div>`);
const bbat = mk('ww-bot ww-hide', `<div class="ww-row"><button class="ww-btn ww-sm" data-retreat>↩ Retreat</button><button class="ww-btn ww-sm" data-speed>▶▶ 2×</button></div>`);
const tip = mk('ww-tip', ''); tip.style.opacity = 0;
const ov = mk('ww-ov ww-hide', '');
const $ = (el, q) => el.querySelector(q);
for (const el of [top, menuBtn, bot, bbat, ov]) ['pointerdown', 'pointerup'].forEach(ev => el.addEventListener(ev, e => { if (e.target.closest('button,.ww-card,.ww-bar,.ww-ov')) e.stopPropagation(); }));
function showTip(t, sec = 2.4) { tip.textContent = t; tip.style.opacity = 1; tipT = sec; }
function buildBar() {
  const bar = $(bot, '.ww-bar'); bar.innerHTML = '';
  for (const T of UNITS) {
    const lockd = mode === 'camp' && !def.avail.includes(T.id);
    const c = document.createElement('div'); c.className = 'ww-card' + (lockd ? ' lock' : ''); c.dataset.k = T.id;
    c.innerHTML = `<div class="e">${T.icon}</div><div class="n">${lockd ? 'Unlocks at level ' + T.unlock : T.name}</div><div class="c">${lockd ? '🔒'  : mode === 'sand' ? '∞' : T.cost}</div>`;
    if (!lockd) c.addEventListener('click', () => { sel = T.id; tone(620, 0.05, 'triangle', 0.08, 1.3); refreshHud(); });
    bar.appendChild(c);
  }
}
function refreshHud() {
  const left = budget - spent;
  $(top, '.ww-lvl').textContent = mode === 'daily' ? 'DAILY BATTLE' : mode === 'sand' ? 'SANDBOX' : `LEVEL ${def.L} / 30`;
  $(top, '.ww-name').textContent = mode === 'sand' ? 'Anything goes' : def.name;
  $(top, '.ww-gold').innerHTML = mode === 'sand' ? `🔵 ${count(0)} <small>vs</small> ${count(1)} 🔴` : `💰 ${left} <small>/ ${budget}</small>`;
  for (const c of bot.querySelectorAll('.ww-card')) { const T = U[c.dataset.k]; c.classList.toggle('sel', c.dataset.k === sel); c.classList.toggle('redsel', placeTeam === 1);
    c.classList.toggle('poor', mode !== 'sand' && T.cost > left && !c.classList.contains('lock')); }
  const T = U[sel]; $(bot, '.ww-info').innerHTML = `<span><b>${T.icon} ${T.name}</b> · ❤️${T.hp}</span><span>${T.blurb}</span>`;
  $(bot, '[data-team]').classList.toggle('ww-hide', mode !== 'sand'); $(bot, '[data-team]').classList.toggle('red', placeTeam === 1); $(bot, '[data-team]').textContent = placeTeam ? '🔴 Red' : '🔵 Blue';
  $(bot, '[data-fight]').classList.toggle('off', !count(0) || !count(1));
}
const count = team => units.filter(u => u.team === team && !u.dead).length;
function setHud() {
  const p = phase === 'place', b = phase === 'battle';
  top.classList.toggle('ww-hide', !(p || b || phase === 'end')); bot.classList.toggle('ww-hide', !p); bbat.classList.toggle('ww-hide', !b);
  menuBtn.classList.toggle('ww-hide', !p);
  $(top, '.ww-gold').classList.toggle('ww-hide', !p); $(top, '.ww-vs').classList.toggle('ww-hide', p);
  zones.forEach((z, i) => z.visible = p && (mode === 'sand' || i === 0));
}
$(bot, '[data-clear]').addEventListener('click', () => { if (phase !== 'place') return; const before = units.length; units = units.filter(u => u.team !== placeTeam || (mode !== 'sand' && u.team === 1)); recount(); if (units.length < before) { tone(300, 0.15, 'triangle', 0.08, 0.5); } refreshHud(); });
$(bot, '[data-team]').addEventListener('click', () => { placeTeam = 1 - placeTeam; refreshHud(); });
$(bot, '[data-fight]').addEventListener('click', () => fight());
$(bbat, '[data-retreat]').addEventListener('click', () => { if (phase === 'battle') restart(true); });
$(bbat, '[data-speed]').addEventListener('click', e => { speedX = speedX === 1 ? 2 : 1; e.target.textContent = speedX === 1 ? '▶▶ 2×' : '▶ 1×'; });
menuBtn.addEventListener('click', () => openLevels());

function openLevels() {
  const max = Math.min(30, unlocked);
  ov.innerHTML = `<h2>Battles</h2><div class="ww-modes"><button class="ww-btn ww-sm" data-sand>🏖️ Sandbox</button><button class="ww-btn ww-sm" data-daily>📅 Daily battle</button></div><div class="ww-grid">${
    Array.from({ length: 30 }, (_, i) => { const L = i + 1, st = stars[L] || 0, lk = L > max;
      return `<button class="ww-tile ${lk ? 'lock' : ''} ${mode === 'camp' && def && def.L === L ? 'cur' : ''}" data-l="${L}">${lk ? '🔒' : L}<small>${lk ? '' : '★'.repeat(st) + '☆'.repeat(3 - st)}</small></button>`; }).join('')}</div><button class="ww-btn ww-sm ww-close" data-x>Close</button>`;
  ov.classList.remove('ww-hide');
  ov.querySelectorAll('[data-l]').forEach(b => b.addEventListener('click', () => { const L = +b.dataset.l; if (L > max) return; ov.classList.add('ww-hide'); ui.hideStart(); mode = 'camp'; level = L; enter(); }));
  $(ov, '[data-x]').addEventListener('click', () => ov.classList.add('ww-hide'));
  $(ov, '[data-sand]').addEventListener('click', () => { ov.classList.add('ww-hide'); ui.hideStart(); mode = 'sand'; enter(); });
  $(ov, '[data-daily]').addEventListener('click', () => { const u = new URL(location.href); u.searchParams.set('daily', '1'); location.href = u.href; });
}
// start-card buttons
{ const row = document.createElement('div'); row.className = 'ww-cardbtns ww';
  row.innerHTML = `<button class="ww-btn" data-lv>🗺️ Battles</button><button class="ww-btn" data-sb>🏖️ Sandbox</button>`;
  ui.els.start.querySelector('h1').after(row);
  row.addEventListener('pointerdown', e => e.stopPropagation());
  $(row, '[data-lv]').addEventListener('click', e => { e.stopPropagation(); openLevels(); });
  $(row, '[data-sb]').addEventListener('click', e => { e.stopPropagation(); ui.hideStart(); mode = 'sand'; enter(); });
  const sub = document.createElement('p'); sub.textContent = 'Place your wobbly army · press FIGHT'; sub.style.fontSize = '17px'; ui.els.start.querySelector('h1').after(sub);
}

// ---------------------------------------------------------------- flow of a battle
function recount() { spent = 0; for (const u of units) if (u.team === 0 && mode !== 'sand') spent += U[u.k].cost; }
function load() {
  units = []; projs = []; parts = []; rings = [];
  def = mode === 'daily' ? makeDaily(D.seed || 20261019) : mode === 'sand' ? { L: 0, name: 'Sandbox', enemy: sandArmy ? [] : [], budget: 0, avail: UNITS.map(t => t.id) } : makeLevel(level);
  for (const e of def.enemy) addUnit(e.k, 1, e.x, e.z, false);
  budget = mode === 'sand' ? Infinity : def.budget; spent = 0; placeTeam = 0;
  if (!def.avail.includes(sel)) sel = def.avail.includes('knight') ? 'knight' : def.avail[0];
  timeScale = 1; slowT = 0; battleT = 0; recorded = false; winner = -1;
  buildBar(); refreshHud();
}
function enter() {           // go to the placement phase of the current mode/level
  load(); phase = 'place'; state = 'play'; setHud(); B.start(); botStep = 0;
  if (mode === 'sand' && sandArmy) { for (const a of sandArmy) addUnit(a.k, a.team, a.x, a.z); refreshHud(); }
  showTip(mode === 'sand' ? 'Tap anywhere to place · switch team below' : def.L === 1 && !lastArmy ? 'Tap your blue half to place units' : 'Beat the red army within budget!', 3);
  cam.userT = 0; ui.flash(0.3);
}
function restart(keep) {   // back to placement with the same army (snapshot taken when FIGHT was pressed)
  const army = mode === 'sand' ? (sandArmy || []) : (lastArmy || []).map(a => ({ ...a, team: 0 }));
  load(); phase = 'place'; state = 'play'; setHud(); B.start();
  for (const a of (keep ? army : [])) addUnit(a.k, a.team, a.x, a.z, false);
  recount(); refreshHud();
}
function fight() {
  if (phase !== 'place') return;
  if (!count(0)) { showTip(mode === 'sand' ? 'Place some blue units first' : 'Place some units first!'); $(top, '.ww-gold').classList.add('bad'); setTimeout(() => $(top, '.ww-gold').classList.remove('bad'), 400); return; }
  if (!count(1)) { showTip('Place some red units too'); return; }
  for (const u of units) { u.x0 = u.x; u.z0 = u.z; }
  if (mode === 'sand') sandArmy = units.map(u => ({ k: u.k, team: u.team, x: u.x, z: u.z }));
  lastArmy = units.filter(u => u.team === 0).map(u => ({ k: u.k, x: u.x, z: u.z }));
  phase = 'battle'; startCount = [count(0), count(1)]; setHud(); battleT = 0; cam.userT = 0;
  [55, 60, 64, 67].forEach((n, i) => setTimeout(() => note(n + 12, 0.35, 0.12), i * 70)); tone(110, 0.5, 'sawtooth', 0.07, 1.5); buzz(20);
  ui.pop('FIGHT!', '#fff', 54, 34); shake = 0.2;
  for (const u of units) { u.vy = 2.5; u.ovz += 1; }
}
function endBattle(win) {
  phase = 'end'; winner = win ? 0 : 1; setHud();
  for (const u of units) if (!u.dead && u.team === winner) u.cheer = 3;
  const koFrac = startCount[1] ? 1 - count(1) / startCount[1] : 0;
  if (mode === 'sand') {
    state = 'lost';
    confetti3(); setTimeout(() => ui.lose(win ? 'BLUE WINS!' : 'RED WINS!', 'Tap for a rematch'), 500);
    return;
  }
  if (!recorded) { recorded = true; F.level(win, koFrac); if (win) { wins++; B.submit(1); } }
  if (win) {
    state = 'won';
    const frac = spent / budget, st = frac <= 0.8 ? 3 : frac <= 0.95 ? 2 : 1;
    let line = `${'★'.repeat(st)}${'☆'.repeat(3 - st)}  ·  ${budget - spent} gold left`;
    if (mode === 'camp') {
      stars[def.L] = Math.max(stars[def.L] || 0, st); S.set('stars', stars);
      if (def.L >= unlocked) { unlocked = Math.min(31, def.L + 1); S.set('level', unlocked); const nu = UNITS.find(t => t.unlock === def.L + 1); if (nu) line += `  ·  NEW: ${nu.icon} ${nu.name}`; }
      if (!beatenShown && D.beaten(def.L)) { beatenShown = true; setTimeout(() => ui.pop('BEATEN!', '#fff', 44, 30), 300); }
      D.won(def.L, 'cleared battle');
    } else D.won(budget - spent, 'won the daily battle with gold left:');
    confetti3(); sfxWin(); buzz([20, 40, 20]);
    setTimeout(() => ui.win(mode === 'daily' ? 'DAILY' : def.L, line), 600);
    lastArmy = null;
  } else {
    state = 'lost'; sfxLose(); buzz([40, 30, 80]);
    setTimeout(() => ui.lose('WIPED OUT!', `Knocked out ${Math.round(koFrac * startCount[1])} of ${startCount[1]} · try a new plan`), 600);
  }
}
function confetti3() { for (let i = 0; i < 4; i++) puff((Math.random() - 0.5) * 6, 3, (winner ? -1 : 1) * (1 + Math.random() * 4), CONF, 40, 5, 6, 1.6, 0.8); ui.flash(0.4); }
const sfxWin = () => [0, 4, 7, 12, 16].forEach((s, k) => setTimeout(() => note(67 + s, 0.4, 0.15), k * 90));
const sfxLose = () => { tone(220, 0.3, 'square', 0.08, 0.5); setTimeout(() => tone(140, 0.45, 'square', 0.08, 0.5), 170); };
ui.onTap(w => {
  if (w === 'start') { enter(); return; }
  if (w === 'win') { level = mode === 'camp' && def.L ? Math.min(30, def.L + 1) : Math.min(30, unlocked); mode = 'camp'; enter(); return; }
  if (w === 'lose') { restart(true); }
});

// ---------------------------------------------------------------- input: tap to place/remove, drag to orbit, pinch/wheel to zoom
const ptrs = new Map(); let gesture = null;
const cv = renderer.domElement;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
cv.addEventListener('pointerdown', e => {
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 1) gesture = { x0: e.clientX, y0: e.clientY, t0: performance.now(), moved: false };
  else { gesture = { pinch: true, d0: pinchD(), z0: cam.uZoom }; }
});
addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (!gesture) return;
  if (gesture.pinch) { if (ptrs.size >= 2) cam.uZoom = clamp(gesture.z0 * gesture.d0 / Math.max(20, pinchD()), 0.55, 1.5); cam.userT = 5; return; }
  if (Math.hypot(e.clientX - gesture.x0, e.clientY - gesture.y0) > 10) gesture.moved = true;
  if (gesture.moved) { cam.uYaw -= dx * 0.008; cam.uPitch = clamp(cam.uPitch + dy * 0.004, -0.45, 0.4); cam.userT = 5; }
});
function pinchD() { const a = [...ptrs.values()]; return a.length < 2 ? 1 : Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); }
const endPtr = e => {
  if (!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId);
  const g = gesture; if (ptrs.size === 0) gesture = null;
  if (g && !g.pinch && !g.moved && performance.now() - g.t0 < 500) tapAt(e.clientX, e.clientY);
};
addEventListener('pointerup', endPtr); addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); gesture = null; });
cv.addEventListener('wheel', e => { e.preventDefault(); cam.uZoom = clamp(cam.uZoom * (1 + e.deltaY * 0.001), 0.55, 1.5); cam.userT = 5; }, { passive: false });
function screenOf(x, y, z) { _v.set(x, y, z).project(camera); return [(_v.x + 1) / 2 * innerWidth, (1 - _v.y) / 2 * innerHeight]; }
function tapAt(sx, sy) {
  if (phase !== 'place') return;
  // remove an own unit under the finger
  let best = null, bd = 30 * 30;
  for (const u of units) { if (u.team !== placeTeam) continue; const [ux, uy] = screenOf(u.x, u.y + 0.7 * u.T.size, u.z), d = (ux - sx) ** 2 + (uy - sy) ** 2; if (d < bd) { bd = d; best = u; } }
  if (best) { units.splice(units.indexOf(best), 1); recount(); puff(best.x, 0.6, best.z, ['#ffffff', TEAM[best.team].l], 8, 2, 2, 0.5); tone(420, 0.08, 'triangle', 0.08, 0.6); refreshHud(); return; }
  ndc.set(sx / innerWidth * 2 - 1, -(sy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  if (!ray.ray.intersectPlane(plane, hit)) return;
  tryPlace(sel, placeTeam, hit.x, hit.z, true);
}
function tryPlace(k, team, x, z, manual) {
  const T = U[k], sgn = team ? -1 : 1;
  if (Math.abs(x) > FX - 0.25 || Math.abs(z) > FZ - 0.25) return false;
  if (z * sgn < 0.55) { if (manual) { showTip(team ? 'Red goes on the red half' : 'Only on your blue half!'); tone(200, 0.12, 'square', 0.05, 0.8); } return false; }
  if (mode !== 'sand' && spent + T.cost > budget) { if (manual) { showTip('Not enough gold'); const g = $(top, '.ww-gold'); g.classList.add('bad'); setTimeout(() => g.classList.remove('bad'), 400); tone(180, 0.15, 'square', 0.05, 0.8); } return false; }
  if (units.filter(u => u.team === team).length >= (mode === 'sand' ? 46 : 40)) { if (manual) showTip('Army is full'); return false; }
  for (const u of units) if ((u.x - x) ** 2 + (u.z - z) ** 2 < (u.T.rad + T.rad + 0.05) ** 2) { if (!manual) return false; const d = Math.hypot(x - u.x, z - u.z) || 1; x = u.x + (x - u.x) / d * (u.T.rad + T.rad + 0.06); z = u.z + (z - u.z) / d * (u.T.rad + T.rad + 0.06); }
  addUnit(k, team, x, z); recount();
  puff(x, 0.15, z, ['#ffffff', TEAM[team].l], 6, 1.5, 1.5, 0.4, 0.7); ring(x, z, TEAM[team].l, 0.7);
  tone(520 + Math.min(10, count(team)) * 30, 0.07, 'triangle', 0.1, 1.25); buzz(8);
  refreshHud(); return true;
}

// ---------------------------------------------------------------- music: marching snare + tuba bass in battle, plucky calm while planning
const BPM = 116, STEP = 60 / BPM / 2;
const TUBA = [36, 0, 43, 0, 36, 0, 43, 0, 41, 0, 36, 0, 43, 0, 31, 0], FIFE = [72, 74, 76, 72, 76, 77, 79, 0, 79, 81, 79, 77, 76, 72, 74, 0];
const PLUCK = [60, 64, 67, 72, 65, 69, 72, 77, 62, 65, 69, 74, 67, 71, 74, 79];
let mAcc = 0, mStep = 0;
const mf = m => 440 * Math.pow(2, (m - 69) / 12);
function music(dt) {
  if (phase === 'menu' || document.visibilityState === 'hidden') return;
  mAcc += dt;
  while (mAcc >= STEP) { mAcc -= STEP; const i = mStep % 16, bar = Math.floor(mStep / 16) % 4; mStep++;
    if (phase === 'battle') {
      if (TUBA[i]) tone(mf(TUBA[i] + (bar === 3 ? 5 : 0)), 0.24, 'sawtooth', 0.045, 0.97);
      if (i % 4 === 2) { tone(240, 0.07, 'square', 0.03, 0.3); tone(1900, 0.05, 'sawtooth', 0.012, 0.5); }
      if (i % 8 === 7 && bar % 2) tone(240, 0.05, 'square', 0.02, 0.3);
      if (FIFE[i] && bar >= 2) note(FIFE[i] + (bar === 3 ? 5 : 0), 0.18, 0.045);
    } else if (phase === 'place' && i % 2 === 0) note(PLUCK[(i / 2 + bar * 4) % 16], 0.5, 0.035);
  }
}

// ---------------------------------------------------------------- main loop
let fpsT = 0;
loop((d, t) => {
  const real = Math.min(0.05, d / 60);
  voiceT -= real; if (tipT > 0) { tipT -= real; if (tipT <= 0) tip.style.opacity = 0; }
  if (slowT > 0) { slowT -= real; if (slowT <= 0) timeScale = 1; } else timeScale = lerp(timeScale, 1, 0.1);
  const dt = real * timeScale * (phase === 'battle' ? speedX : 1);
  music(real);
  for (const u of units) updateUnit(u, dt);
  if (phase === 'battle') {
    separate(); updateProjs(dt); battleT += dt;
    units = units.filter(u => !u.gone);
    const a = aliveOf(0), b = aliveOf(1);
    const vs = $(top, '.ww-vs'); vs.children[0].textContent = a; vs.children[3].textContent = b;
    vs.children[1].firstChild.style.width = (startCount[0] ? a / startCount[0] * 100 : 0) + '%'; vs.children[2].firstChild.style.width = (startCount[1] ? b / startCount[1] * 100 : 0) + '%';
    if (!a || !b) { resultT += real; if (resultT > 0.9) { resultT = 0; endBattle(!b && a > 0); } }
    else if (battleT > 75) { let ha = 0, hb = 0; for (const u of units) if (!u.dead) (u.team ? (hb += u.hp) : (ha += u.hp)); endBattle(ha > hb); }
  } else if (phase === 'end') { updateProjs(dt); units = units.filter(u => !u.gone); for (const u of units) if (u.cheer > 0 && u.y <= 0 && Math.random() < 0.04) u.vy = 4; }
  renderAll(t, dt);
  // camera
  const portrait = innerWidth / innerHeight < 1;
  let tx = 0, tz = portrait ? (phase === 'place' ? 2.2 : 1.2) : 0.2, dist = portrait ? 26 : 19, yaw = portrait ? 0 : Math.PI / 2, pitch = portrait ? 0.98 : 0.86;
  if (phase === 'menu') yaw += Math.sin(t * 0.25) * 0.35;
  if (phase === 'battle' || phase === 'end') {
    let cx = 0, cz = 0, n = 0; for (const u of units) if (!u.dead) { cx += u.x; cz += u.z; n++; }
    if (n) { tx = cx / n * 0.5; tz = cz / n * 0.6 + (portrait ? 0.6 : 0); }
    yaw += Math.sin(battleT * 0.22) * 0.3; dist *= 0.8; pitch -= 0.06;
  }
  cam.userT -= real;
  if (cam.userT <= 0 && phase !== 'place') { cam.uYaw *= 0.98; cam.uPitch *= 0.98; cam.uZoom = lerp(cam.uZoom, 1, 0.02); }
  cam.yaw = lerp(cam.yaw, yaw + cam.uYaw, 0.06); cam.pitch = lerp(cam.pitch, clamp(pitch + cam.uPitch, 0.35, 1.4), 0.08); cam.dist = lerp(cam.dist, dist * cam.uZoom, 0.08);
  cam.tx = lerp(cam.tx, tx, 0.04); cam.tz = lerp(cam.tz, tz, 0.04);
  shake = Math.max(0, shake - real * 0.8);
  const sh = shake * shake * 3;
  camera.position.set(cam.tx + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist + (Math.random() - 0.5) * sh, Math.sin(cam.pitch) * cam.dist + (Math.random() - 0.5) * sh, cam.tz + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist);
  camera.lookAt(cam.tx, 0, cam.tz);
  sun.position.set(cam.tx + 6, 16, cam.tz + 7); sun.target.position.set(cam.tx, 0, cam.tz);
});

// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on battle 1, until the first real touch,
// two of the cheapest units pop onto your half (most of the budget stays yours), so placing is shown; it never presses FIGHT
demo(() => {
  const k = def.avail.filter(k => U[k].cost <= budget - spent).sort((a, b) => U[a].cost - U[b].cost)[0]; if (!k) return false; const mel = MELEE.includes(k);
  for (let t = 0; t < 40; t++) if (tryPlace(k, 0, (Math.random() - 0.5) * 6, mel ? 1.4 + Math.random() * 1.4 : 3.8 + Math.random() * 1.8, false)) return;
  return false;
}, { ready: () => state === 'play' && phase === 'place' && mode === 'camp' && def && def.L === 1, wait: 1800, every: 900, max: 2 });
// boot: show the current battle behind the start card
load(); setHud(); ui.start();

// ---------------------------------------------------------------- bot (QA): buy a sensible mix within budget, then fight
let botStep = 0;
function botPlan() {
  const avail = def.avail, plan = [];
  let left = budget - spent, guard = 0;
  const cnt2 = { m: 0, r: 0 };
  while (guard++ < 80 && plan.length < 34) {
    const wantRanged = cnt2.r * 1.6 < cnt2.m;
    let pool = avail.filter(k => U[k].cost <= left && (wantRanged ? RANGED : MELEE).includes(k));
    if (!pool.length) pool = avail.filter(k => U[k].cost <= left);
    if (!pool.length) break;
    pool.sort((a, b) => U[b].power * Math.sqrt(U[b].cost) - U[a].power * Math.sqrt(U[a].cost));
    const k = pool[Math.random() < 0.7 || pool.length < 2 ? 0 : 1]; plan.push(k); left -= U[k].cost; RANGED.includes(k) ? cnt2.r++ : cnt2.m++;
  }
  return plan;
}
let botQueue = [];
window.__game = {
  get state() { return state; }, get level() { return def ? def.L : level; }, get score() { return wins; },
  get dbg() { return { phase, mode, units: units.length, a: aliveOf(0), b: aliveOf(1), battleT: +battleT.toFixed(1), budget, spent }; },
  bot() {
    if (state !== 'play') return;
    if (phase === 'place') {
      if (botStep === 0) { botQueue = botPlan(); botStep = 1; }
      if (botQueue.length) {
        for (let n = 0; n < 3 && botQueue.length; n++) {
          const k = botQueue.shift(), mel = MELEE.includes(k);
          for (let tries = 0; tries < 40; tries++) {
            const x = (Math.random() - 0.5) * 7.5, z = mel ? 1.2 + Math.random() * 1.8 : 3.6 + Math.random() * 2.2;
            if (tryPlace(k, 0, x, z, false)) break;
          }
        }
      } else fight();
    }
  },
};
