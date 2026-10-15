// Quest Party — a toy 3D dungeon auto-battler for your AI agents. RIFFCADE original: code, art and sound are our own.
// Every live Claude Code / Codex session is a hero. Its class comes from what it does most (edit = Knight, read = Mage,
// run = Rogue, web = Ranger, delegate = Summoner). Subagents are familiars. Finished tool calls are attacks, failures
// let the monster hit back, passing tests fire an ultimate, commits drop treasure chests, deploys clear the floor.
// The player is the party leader: strike the monster, time War Cry / Shield Wall / potions / the party Ultimate,
// pick the path at each fork (elite, shop, rest), and equip the loot.
import { THREE, createStage, rounded, tone, burst, confetti, loop, store, rng, clamp, lerp } from './kit/hc.js';
import { agents, toast } from './kit/agents.js';
import { board, flag } from './kit/board.js';

const $ = s => document.querySelector(s);
const NAME = 'Quest Party: Dungeon Heroes for Your AI Agents';
const S = store('questparty');
const dayKey = (t = Date.now()) => { const d = new Date(t); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };

// ================================================================ stage
const stage = createStage({ fov: 30, shadows: true, shadowSize: 11 });
const { scene, camera, renderer, sun, hemi } = stage;
hemi.color.set('#b9b4ff'); hemi.groundColor.set('#4a3020'); hemi.intensity = 1.25;
sun.intensity = 1.55; sun.color.set('#ffe7c9');
sun.shadow.mapSize.set(2048, 2048);
const AZ = 0.74;
const R = new THREE.Vector3(Math.cos(AZ), 0, -Math.sin(AZ));   // screen-right on the floor
const F = new THREE.Vector3(Math.sin(AZ), 0, Math.cos(AZ));    // toward the camera
const at = (s, t, y = 0) => new THREE.Vector3().addScaledVector(R, s).addScaledVector(F, t).setY(y);
const CAMDIR = new THREE.Vector3(Math.sin(AZ), 1.0, Math.cos(AZ)).normalize();
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.62, metalness: 0.04, flatShading: true, ...o });
const G = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.25, metalness: 0.1, ...o });
const mesh = (geo, mat, x = 0, y = 0, z = 0, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; return m; };

// ================================================================ save state (real save persists; demo runs in memory)
const TROPHIES = [
  ['blood', '🗡️', 'First Blood', 'Slay a monster', s => s.kills >= 1],
  ['slayer', '💀', 'Monster Hunter', 'Slay 100 monsters', s => s.kills >= 100],
  ['boss', '👑', 'Boss Slayer', 'Defeat a boss', s => s.bosses >= 1],
  ['boss5', '🐲', 'Legend', 'Defeat 5 bosses', s => s.bosses >= 5],
  ['f10', '🕳️', 'Deep Delver', 'Reach floor 10', s => s.best >= 10],
  ['f25', '🌋', 'Abyss Walker', 'Reach floor 25', s => s.best >= 25],
  ['crit', '💥', 'Crit Machine', '50 critical hits', s => s.crits >= 50],
  ['chest', '🧰', 'Treasure Hunter', 'Open 10 chests', s => s.chests >= 10],
  ['ult', '✨', 'Green Tests', 'A passing test fires an ultimate', s => s.tests >= 1],
  ['deploy', '🚀', 'Shipped It', 'Clear a floor with a deploy', s => s.deploys >= 1],
  ['party', '🎉', 'Full Party', '5 heroes in the dungeon at once', s => s.maxParty >= 5],
  ['fam', '🧚', 'Summoner\'s Call', 'A familiar joins the party', s => s.familiars >= 1],
  ['epic', '🌟', 'Epic Find', 'Find an Epic item', s => s.epics >= 1],
  ['elite', '🔥', 'Elite Hunter', 'Beat 5 elites', s => s.elites >= 5],
  ['camp', '🏕️', 'Campfire Tales', 'An agent rests at the campfire', s => s.rests >= 1],
  ['party_ult', '☄️', 'Party Ultimate', 'Unleash the party Ultimate', s => s.pults >= 1],
];
const freshSave = () => ({ floor: 1, room: 0, best: 1, gold: 30, potions: 2, level: 1, xp: 0, mana: 0, gear: { weapon: null, armor: null, charm: null }, bag: [], elite: false, mhp: null, trophies: {}, stats: { kills: 0, crits: 0, chests: 0, bosses: 0, tests: 0, deploys: 0, maxParty: 0, familiars: 0, epics: 0, elites: 0, rests: 0, pults: 0, best: 1 }, nid: 1 });
const freshToday = () => ({ d: dayKey(), hits: 0, crits: 0, kills: 0, chests: 0, floors: 0, bosses: 0, tests: 0, deploys: 0, fails: 0, tokens: 0, ults: 0, heroes: {} });
function demoSave() {
  const s = freshSave(); Object.assign(s, { floor: 4, room: 1, best: 4, gold: 145, potions: 2, level: 4, xp: 20 });
  s.gear.weapon = { id: 'd1', slot: 'weapon', name: 'Ember Blade', r: 1, dmg: 0.18 };
  s.gear.charm = { id: 'd2', slot: 'charm', name: 'Moon Ring', r: 2, crit: 0.07, gold: 0.15 };
  s.bag.push({ id: 'd3', slot: 'armor', name: 'Iron Mail', r: 1, hp: 0.2, def: 0.08 });
  return s;
}
let mode = 'real';
let save = Object.assign(freshSave(), S.get('save', null) || {});
save.stats = Object.assign(freshSave().stats, save.stats || {});
let today = S.get('today', null); if (!today || today.d !== dayKey()) today = freshToday();
let dirty = false;
const persist = () => { dirty = true; };
setInterval(() => { if (dirty && mode === 'real') { S.set('save', save); S.set('today', today); } dirty = false; }, 800);
addEventListener('pagehide', () => { if (mode === 'real') { S.set('save', save); S.set('today', today); } });

// ================================================================ gear
const RAR = [['Common', '#cfd3da'], ['Fine', '#7be08f'], ['Rare', '#5cb8ff'], ['Epic', '#d38cff']];
const SLOT_IC = { weapon: '⚔️', armor: '🛡️', charm: '💍' };
const gearStat = k => ['weapon', 'armor', 'charm'].reduce((a, s) => a + ((save.gear[s] && save.gear[s][k]) || 0), 0);
function makeItem(minR = 0, boost = 0) {
  const roll = Math.random() + boost; let r = roll > 1.12 ? 3 : roll > 0.86 ? 2 : roll > 0.55 ? 1 : 0; r = Math.max(r, minR);
  const slot = ['weapon', 'armor', 'charm'][(Math.random() * 3) | 0], k = 1 + save.floor * 0.03, j = () => 0.85 + Math.random() * 0.3;
  const adj = ['Rusty', 'Ember', 'Frost', 'Storm', 'Moon', 'Iron', 'Gilded', 'Shadow', 'Sun', 'Thorn', 'Star', 'Echo'][(Math.random() * 12) | 0];
  const base = { weapon: ['Blade', 'Staff', 'Bow', 'Daggers', 'Hammer', 'Wand'], armor: ['Mail', 'Robe', 'Cloak', 'Plate', 'Vest'], charm: ['Ring', 'Amulet', 'Rune', 'Idol', 'Pendant'] }[slot];
  const it = { id: 'i' + Date.now().toString(36) + (save.nid++), slot, r, name: adj + ' ' + base[(Math.random() * base.length) | 0] };
  if (slot === 'weapon') it.dmg = +((0.1 + 0.09 * r) * k * j()).toFixed(2);
  if (slot === 'armor') { it.hp = +((0.12 + 0.1 * r) * k * j()).toFixed(2); it.def = +((0.04 + 0.035 * r) * j()).toFixed(2); }
  if (slot === 'charm') { it.crit = +((0.03 + 0.025 * r) * j()).toFixed(3); it.gold = +((0.1 + 0.1 * r) * j()).toFixed(2); }
  if (r === 3) save.stats.epics++;
  return it;
}
const itemLine = it => [it.dmg && `+${Math.round(it.dmg * 100)}% damage`, it.hp && `+${Math.round(it.hp * 100)}% HP`, it.def && `-${Math.round(it.def * 100)}% hurt`, it.crit && `+${(it.crit * 100).toFixed(1)}% crit`, it.gold && `+${Math.round(it.gold * 100)}% gold`].filter(Boolean).join(' · ');
const itemPower = it => !it ? 0 : (it.dmg || 0) * 1.2 + (it.hp || 0) * 0.6 + (it.def || 0) * 2 + (it.crit || 0) * 4 + (it.gold || 0) * 0.5;
const sellPrice = it => Math.round((10 + it.r * 18) * (1 + save.floor * 0.05));
function addLoot(it, pos) {
  if (save.bag.length >= 12) { const w = save.bag.reduce((a, b) => itemPower(a) < itemPower(b) ? a : b); save.bag.splice(save.bag.indexOf(w), 1); save.gold += sellPrice(w); }
  save.bag.push(it);
  // empty slot or clearly better: auto-equip so idle players still grow, and tell them
  const cur = save.gear[it.slot];
  if (!cur) equip(it.id, true);
  else $('#bGear').classList.add('ping');
  if (pos) num(pos, `${SLOT_IC[it.slot]} ${it.name}`, 'info', RAR[it.r][1]);
  if (it.r >= 2) banner(`${RAR[it.r][0].toUpperCase()} LOOT!`, it.name, it.r === 3 ? 'purple' : 'blue');
  persist();
}
function equip(id, quiet) {
  const i = save.bag.findIndex(x => x.id === id); if (i < 0) return;
  const it = save.bag[i]; save.bag.splice(i, 1);
  if (save.gear[it.slot]) save.bag.push(save.gear[it.slot]);
  save.gear[it.slot] = it; heroes.forEach(h => { h.maxHp = heroMaxHp(); h.hp = Math.min(h.hp, h.maxHp); });
  if (!quiet) { sfx.equip(); } persist(); hud();
}

// ================================================================ numbers & formulas
const heroMaxHp = () => Math.round((60 + save.level * 9) * (1 + gearStat('hp')));
const xpNeed = l => Math.round(40 * Math.pow(1.32, l - 1));
const isBossFloor = f => f % 5 === 0;
const perFloor = f => isBossFloor(f) ? 1 : 3;
const monsterMax = (f, boss, elite) => Math.round((26 + Math.pow(f, 1.35) * 13) * (boss ? 6 : 1) * (elite ? 2.2 : 1));
const monsterAtk = () => Math.round((6 + save.floor * 1.7) * (mon && mon.boss ? 1.6 : mon && mon.elite ? 1.3 : 1));
let warCry = 0, shieldWall = 0;
const heroDmg = (mult = 1, rnd = true) => Math.max(1, Math.round((6 + save.level * 2.6) * (1 + gearStat('dmg')) * (warCry > 0 ? 2 : 1) * mult * (rnd ? 0.85 + Math.random() * 0.3 : 1)));
const critChance = () => 0.08 + gearStat('crit');

// ================================================================ dungeon room
const THEMES = [
  { name: 'Mossy Halls', floor: ['#7d8a73', '#8a977d', '#717e68', '#86926f'], wall: ['#5d6474', '#686f80', '#555c6b'], base: '#3b3348', moss: '#6fbf73', torch: '#ffa14a' },
  { name: 'Sandstone Crypt', floor: ['#d2ad72', '#c8a268', '#dab67c', '#c49b5f'], wall: ['#a9805a', '#b58c63', '#9d7650'], base: '#5d3f2c', moss: '#e0c27a', torch: '#ffb35c' },
  { name: 'Frost Caverns', floor: ['#a9d0e6', '#b9dcef', '#9cc4dc', '#c4e4f4'], wall: ['#7298be', '#7ea5cb', '#6a8db2'], base: '#2c3c5e', moss: '#e8f8ff', torch: '#7fd8ff' },
  { name: 'Ember Depths', floor: ['#6a5250', '#755c58', '#5f4846', '#7a5a50'], wall: ['#53403f', '#5e4949', '#4a3838'], base: '#2c1a1c', moss: '#ff7a3c', torch: '#ff7a3c' },
  { name: 'Crystal Grotto', floor: ['#8a78b8', '#9786c4', '#7f6dab', '#a08fcb'], wall: ['#5f4f8c', '#6b5a9a', '#56477f'], base: '#2a2048', moss: '#ff8be8', torch: '#d78cff' },
];
const theme = () => THEMES[Math.floor((save.floor - 1) / 5) % THEMES.length];
const room = new THREE.Group(); scene.add(room);
const HALF = 6;
const torches = [];
let campfire = null, doors = [];
const tileGeo = rounded(0.96, 0.34, 0.96, 0.07), brickGeo = rounded(1.02, 0.5, 0.62, 0.07);
function buildRoom() {
  room.clear(); torches.length = 0; doors = [];
  const th = theme(), r = rng(save.floor * 977 + 13), pick = a => a[(r() * a.length) | 0];
  // raised platform
  const base = mesh(rounded(HALF * 2 + 0.6, 1.6, HALF * 2 + 0.6, 0.25), M(th.base), 0, -0.95, 0); base.castShadow = false; room.add(base);
  const lip = mesh(rounded(HALF * 2 + 0.9, 0.3, HALF * 2 + 0.9, 0.12), M(th.base, { color: new THREE.Color(th.base).offsetHSL(0, 0, 0.06) }), 0, -0.2, 0); lip.castShadow = false; room.add(lip);
  // floor tiles
  const tiles = new THREE.InstancedMesh(tileGeo, M('#ffffff'), (HALF * 2) ** 2); tiles.receiveShadow = true;
  const m4 = new THREE.Matrix4(), c = new THREE.Color(); let n = 0;
  for (let x = -HALF; x < HALF; x++) for (let z = -HALF; z < HALF; z++) {
    m4.makeTranslation(x + 0.5, -0.02 + (r() - 0.5) * 0.06, z + 0.5); tiles.setMatrixAt(n, m4); tiles.setColorAt(n++, c.set(pick(th.floor)));
  }
  room.add(tiles);
  // two back walls (−z and −x), brick by brick
  const bricks = new THREE.InstancedMesh(brickGeo, M('#ffffff'), 400); bricks.castShadow = true; bricks.receiveShadow = true; n = 0;
  const q = new THREE.Quaternion(), yAxis = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(1, 1, 1);
  const doorX = [-3.2, 0.2, 3.6];
  for (let row = 0; row < 6; row++) {
    const y = 0.4 + row * 0.5, off = row % 2 ? 0.5 : 0;
    for (let i = -HALF - 1; i < HALF; i++) {
      const x = i + off + 0.5; if (x < -HALF - 0.2 || x > HALF + 0.2) continue;
      if (!(row < 4 && doorX.some(d => Math.abs(x - d) < 0.95))) { m4.compose(new THREE.Vector3(x, y, -HALF - 0.3), q.identity(), sc); bricks.setMatrixAt(n, m4); bricks.setColorAt(n++, c.set(pick(th.wall))); }
      const z = i + off + 0.5;
      m4.compose(new THREE.Vector3(-HALF - 0.3, y, z), q.setFromAxisAngle(yAxis, Math.PI / 2), sc); bricks.setMatrixAt(n, m4); bricks.setColorAt(n++, c.set(pick(th.wall)));
    }
  }
  bricks.count = n; room.add(bricks);
  // corner pillar + wall caps
  const capM = M(new THREE.Color(th.wall[0]).offsetHSL(0, 0, 0.08));
  room.add(mesh(rounded(1.3, 3.6, 1.3, 0.15), capM, -HALF - 0.3, 1.5, -HALF - 0.3));
  room.add(mesh(new THREE.ConeGeometry(0.75, 0.8, 4), capM, -HALF - 0.3, 3.7, -HALF - 0.3));
  room.add(mesh(rounded(HALF * 2 + 0.6, 0.25, 0.8, 0.08), capM, 0, 3.25, -HALF - 0.3));
  room.add(mesh(rounded(0.8, 0.25, HALF * 2 + 0.6, 0.08), capM, -HALF - 0.3, 3.25, 0));
  // three doors in the back wall (they glow at the fork)
  const doorCol = ['#ff6b6b', '#ffcf5a', '#7be08f'];
  doorX.forEach((x, i) => {
    const g = new THREE.Group(); g.position.set(x, 0, -HALF - 0.3);
    g.add(mesh(rounded(1.9, 2.2, 0.5, 0.1), M('#0d0a14'), 0, 1.0, -0.12, false));
    const arch = mesh(new THREE.TorusGeometry(0.88, 0.16, 6, 12, Math.PI), capM, 0, 1.95, 0.05); g.add(arch);
    g.add(mesh(rounded(0.32, 2.0, 0.6, 0.06), capM, -0.95, 0.95, 0.05), mesh(rounded(0.32, 2.0, 0.6, 0.06), capM, 0.95, 0.95, 0.05));
    const wood = M('#6b4126'); const dl = mesh(rounded(0.78, 1.9, 0.14, 0.05), wood, -0.4, 0.95, 0.05), dr = mesh(rounded(0.78, 1.9, 0.14, 0.05), wood, 0.4, 0.95, 0.05);
    for (const d of [dl, dr]) { d.add(mesh(new THREE.BoxGeometry(0.8, 0.07, 0.17), M('#2a2a33'), 0, 0.5, 0, false), mesh(new THREE.BoxGeometry(0.8, 0.07, 0.17), M('#2a2a33'), 0, -0.5, 0, false)); }
    g.add(dl, dr);
    const glow = mesh(new THREE.PlaneGeometry(1.5, 2.0), new THREE.MeshBasicMaterial({ color: doorCol[i], transparent: true, opacity: 0 }), 0, 0.95, -0.05, false); g.add(glow);
    const light = new THREE.PointLight(doorCol[i], 0, 6, 1.6); light.position.set(0, 1.2, 0.8); g.add(light);
    room.add(g); doors.push({ g, dl, dr, glow, light, open: 0 });
  });
  // torches
  const tPos = [[-5.3, -HALF + 0.05, 0], [5.1, -HALF + 0.05, 0], [-HALF + 0.05, -2.2, 1], [-HALF + 0.05, 3.2, 1]];
  for (const [a, b, side] of tPos) {
    const g = new THREE.Group(); g.position.set(side ? a : a, 2.0, side ? b : b);
    if (side) g.rotation.y = Math.PI / 2;
    g.add(mesh(new THREE.BoxGeometry(0.16, 0.16, 0.36), M('#3a3036'), 0, 0, 0.12));
    g.add(mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.55, 6), M('#7a4a2a'), 0, 0.15, 0.3));
    const cup = mesh(new THREE.CylinderGeometry(0.15, 0.1, 0.16, 6), M('#4a3a40'), 0, 0.42, 0.3); g.add(cup);
    const flame = mesh(new THREE.ConeGeometry(0.15, 0.42, 6), new THREE.MeshBasicMaterial({ color: th.torch }), 0, 0.68, 0.3, false);
    const core = mesh(new THREE.ConeGeometry(0.08, 0.24, 6), new THREE.MeshBasicMaterial({ color: '#fff3b0' }), 0, 0.62, 0.3, false);
    g.add(flame, core);
    const L = new THREE.PointLight(th.torch, 9, 9, 1.4); L.position.set(0, 0.8, 0.8); g.add(L);
    room.add(g); torches.push({ flame, core, L, ph: r() * 10 });
  }
  // props (seeded per floor): barrels, crates, rocks, bones, crystals, banners
  const propSpots = [[-4.8, -4.6], [-3.9, -5.0], [4.9, -4.7], [-5.0, -3.6], [-4.9, 4.7], [5.0, 4.9], [2.0, -5.0], [-5.0, 1.0], [5.1, -2.2], [-1.6, 5.0]];
  for (const [x, z] of propSpots) {
    const k = r(), g = new THREE.Group(); g.position.set(x + (r() - 0.5) * 0.4, 0.15, z + (r() - 0.5) * 0.4); g.rotation.y = r() * 6;
    if (k < 0.22) { g.add(mesh(new THREE.CylinderGeometry(0.38, 0.34, 0.8, 9), M('#8a5a34'), 0, 0.4, 0)); g.add(mesh(new THREE.TorusGeometry(0.37, 0.035, 4, 12), M('#3d3a40'), 0, 0.62, 0)); g.children[1].rotation.x = Math.PI / 2; }
    else if (k < 0.42) { g.add(mesh(rounded(0.75, 0.7, 0.75, 0.06), M('#a8713e'), 0, 0.35, 0)); g.add(mesh(new THREE.BoxGeometry(0.8, 0.08, 0.08), M('#6b4126'), 0, 0.35, 0.38)); }
    else if (k < 0.6) { for (let i = 0; i < 3; i++) g.add(mesh(new THREE.DodecahedronGeometry(0.22 + r() * 0.22, 0), M(pick(th.wall)), (r() - 0.5) * 0.6, 0.15, (r() - 0.5) * 0.6)); }
    else if (k < 0.75) { g.add(mesh(new THREE.SphereGeometry(0.2, 7, 6), M('#efe6d2'), 0, 0.17, 0)); g.add(mesh(new THREE.CapsuleGeometry(0.05, 0.5, 3, 5), M('#efe6d2'), 0.3, 0.06, 0.1)); g.children[1].rotation.z = Math.PI / 2;
      g.add(mesh(new THREE.SphereGeometry(0.05, 5, 4), M('#1a1020'), -0.07, 0.2, 0.17, false), mesh(new THREE.SphereGeometry(0.05, 5, 4), M('#1a1020'), 0.07, 0.2, 0.17, false)); }
    else { for (let i = 0; i < 3; i++) { const cr = mesh(new THREE.OctahedronGeometry(0.18 + r() * 0.2, 0), new THREE.MeshStandardMaterial({ color: th.moss, emissive: th.moss, emissiveIntensity: 0.6, flatShading: true, roughness: 0.3 }), (r() - 0.5) * 0.5, 0.25 + r() * 0.2, (r() - 0.5) * 0.5); cr.scale.y = 1.8; cr.rotation.z = (r() - 0.5) * 0.6; g.add(cr); } }
    room.add(g);
  }
  // hanging banners on the left wall
  for (const z of [-0.6, 1.9]) { const b = mesh(new THREE.BoxGeometry(0.05, 1.3, 0.75), M(pick(['#b33a3a', '#3a5bb3', '#7a3ab3', '#3a9b6b'])), -HALF + 0.02, 2.35, z); room.add(b); room.add(mesh(new THREE.ConeGeometry(0.4, 0.35, 3), b.material, -HALF + 0.02, 1.55, z)); room.children[room.children.length - 1].rotation.set(0, Math.PI / 2, Math.PI); }
  // moss / puddles of theme colour on the floor
  for (let i = 0; i < 5; i++) { const p = mesh(new THREE.CircleGeometry(0.35 + r() * 0.5, 7), new THREE.MeshStandardMaterial({ color: th.moss, transparent: true, opacity: 0.35, roughness: 0.9 }), (r() - 0.5) * 10, 0.165, (r() - 0.5) * 10, false); p.rotation.x = -Math.PI / 2; room.add(p); }
  // campfire (front left): resting heroes sit here
  const cf = new THREE.Group(); cf.position.copy(CAMP);
  for (let i = 0; i < 6; i++) { const s = mesh(new THREE.DodecahedronGeometry(0.17, 0), M('#6e6878'), Math.cos(i) * 0.55, 0.2, Math.sin(i) * 0.55); cf.add(s); }
  for (let i = 0; i < 3; i++) { const l = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.8, 6), M('#6b4126'), 0, 0.26, 0); l.rotation.set(Math.PI / 2, 0, i * 1.05); cf.add(l); }
  const ff = mesh(new THREE.ConeGeometry(0.3, 0.75, 7), new THREE.MeshBasicMaterial({ color: '#ff8a2a' }), 0, 0.62, 0, false);
  const fc = mesh(new THREE.ConeGeometry(0.16, 0.45, 7), new THREE.MeshBasicMaterial({ color: '#ffe680' }), 0, 0.52, 0, false);
  const fl = new THREE.PointLight('#ff9a3c', 6, 6, 1.5); fl.position.set(0, 1.0, 0);
  cf.add(ff, fc, fl); room.add(cf); campfire = { ff, fc, fl, boost: 0 };
  document.body.style.background = `radial-gradient(120% 90% at 50% 40%, ${new THREE.Color(th.base).offsetHSL(0, 0.05, 0.12).getStyle()} 0%, ${th.base} 50%, #0d0a14 100%)`;
}
const CAMP = at(1.2, 4.1, 0.16);
const MON_POS = at(2.9, 0, 0.17);

// ================================================================ heroes
const CLASSES = {
  knight: { name: 'Knight', ic: '🛡️' }, mage: { name: 'Mage', ic: '🔮' }, rogue: { name: 'Rogue', ic: '🗡️' },
  ranger: { name: 'Ranger', ic: '🏹' }, summoner: { name: 'Summoner', ic: '📖' },
};
const CAT_CLASS = { edit: 'knight', read: 'mage', run: 'rogue', test: 'rogue', web: 'ranger', delegate: 'summoner' };
const HCOL = ['#ff5d5d', '#4fb3ff', '#ffd23f', '#5ee38a', '#c77dff', '#ff8c42', '#3de0d0', '#ff6fb5', '#a3e635', '#f472b6'];
const SLOTS = [[-1.5, -1.1], [-1.5, 1.1], [-2.9, -2.2], [-2.9, 0], [-2.9, 2.2], [-4.3, -1.1], [-4.3, 1.1], [-1.5, -3.2]];
const heroes = new Map();
const tagsEl = $('#tags');
const hash = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
function classOf(h) {
  const c = h.counts, w = { knight: c.edit || 0, mage: c.read || 0, rogue: (c.run || 0) + (c.test || 0), ranger: (c.web || 0) * 1.5, summoner: (c.delegate || 0) * 3 };
  let best = h.cls || 'knight', bv = -1; for (const k in w) if (w[k] > bv) { bv = w[k]; best = k; }
  // a little stickiness so a hero doesn't swap class on every single tool call
  if (h.cls && best !== h.cls && bv < (w[h.cls] || 0) + 2) return h.cls;
  return bv > 0 ? best : h.cls || 'knight';
}
function buildHeroMesh(color, cls) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const col = M(color), dark = M('#3b3150'), skin = M('#ffd9b3'), steel = G('#d7dde6', { metalness: 0.5 }), wood = M('#8a5a34');
  body.add(mesh(new THREE.CapsuleGeometry(0.11, 0.14, 3, 6), dark, -0.14, 0.17, 0), mesh(new THREE.CapsuleGeometry(0.11, 0.14, 3, 6), dark, 0.14, 0.17, 0));
  const torso = mesh(rounded(0.64, 0.56, 0.48, 0.14), col, 0, 0.6, 0); body.add(torso);
  body.add(mesh(new THREE.BoxGeometry(0.66, 0.08, 0.5), M('#5a3a22'), 0, 0.42, 0));
  const head = new THREE.Group(); head.position.y = 1.15; body.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.31, 14, 11), skin));
  const eye = new THREE.SphereGeometry(0.045, 6, 5), em = M('#1a1020');
  head.add(mesh(eye, em, -0.11, 0.03, 0.28, false), mesh(eye, em, 0.11, 0.03, 0.28, false));
  const ch = new THREE.SphereGeometry(0.05, 6, 5), cm = M('#ff9a9a'); head.add(mesh(ch, cm, -0.19, -0.07, 0.23, false), mesh(ch, cm, 0.19, -0.07, 0.23, false));
  const armL = new THREE.Group(), armR = new THREE.Group(); armL.position.set(-0.38, 0.75, 0); armR.position.set(0.38, 0.75, 0);
  armL.add(mesh(new THREE.CapsuleGeometry(0.09, 0.22, 3, 6), col, 0, -0.16, 0)); armR.add(mesh(new THREE.CapsuleGeometry(0.09, 0.22, 3, 6), col, 0, -0.16, 0));
  armL.add(mesh(new THREE.SphereGeometry(0.09, 6, 5), skin, 0, -0.33, 0)); armR.add(mesh(new THREE.SphereGeometry(0.09, 6, 5), skin, 0, -0.33, 0));
  body.add(armL, armR);
  const hand = new THREE.Group(); hand.position.set(0, -0.33, 0.05); armR.add(hand);
  const offhand = new THREE.Group(); offhand.position.set(0, -0.3, 0.1); armL.add(offhand);
  if (cls === 'knight') {
    const helm = mesh(new THREE.SphereGeometry(0.35, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), steel, 0, 0.03, 0); head.add(helm);
    head.add(mesh(new THREE.BoxGeometry(0.06, 0.2, 0.08), steel, 0, 0.2, 0.3));
    const plume = mesh(new THREE.ConeGeometry(0.09, 0.42, 6), M('#ff4d4d'), 0, 0.42, -0.05); plume.rotation.x = -0.5; head.add(plume);
    const blade = mesh(new THREE.BoxGeometry(0.08, 0.72, 0.04), steel, 0, 0.42, 0); hand.add(blade);
    hand.add(mesh(new THREE.BoxGeometry(0.3, 0.06, 0.08), G('#ffcf5a', { metalness: 0.6 }), 0, 0.06, 0), mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 5), wood, 0, -0.04, 0));
    hand.rotation.x = 1.2;
    const sh = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.07, 8), M(color), 0, 0, 0.06); sh.rotation.x = Math.PI / 2; offhand.add(sh);
    const rim = mesh(new THREE.TorusGeometry(0.3, 0.04, 4, 8), steel, 0, 0, 0.1); offhand.add(rim);
    offhand.add(mesh(new THREE.SphereGeometry(0.07, 6, 5), G('#ffcf5a', { metalness: 0.6 }), 0, 0, 0.12));
  } else if (cls === 'mage') {
    const hatM = M('#4b3fc6');
    head.add(mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.05, 10), hatM, 0, 0.2, 0));
    const cone = mesh(new THREE.ConeGeometry(0.3, 0.62, 8), hatM, 0.04, 0.5, -0.03); cone.rotation.z = -0.25; head.add(cone);
    head.add(mesh(new THREE.OctahedronGeometry(0.07, 0), G('#ffe14d', { emissive: '#ffcf5a', emissiveIntensity: 0.6 }), 0, 0.42, 0.24, false));
    hand.add(mesh(new THREE.CylinderGeometry(0.035, 0.04, 1.1, 5), wood, 0, 0.2, 0));
    const orb = mesh(new THREE.IcosahedronGeometry(0.13, 0), new THREE.MeshStandardMaterial({ color: '#7fe7ff', emissive: '#3fd0ff', emissiveIntensity: 1.2, flatShading: true }), 0, 0.82, 0, false); hand.add(orb); g.orb = orb;
    body.add(mesh(new THREE.CylinderGeometry(0.33, 0.42, 0.32, 8), col, 0, 0.3, 0));
  } else if (cls === 'rogue') {
    const hood = mesh(new THREE.SphereGeometry(0.36, 12, 9, Math.PI * 0.8, Math.PI * 1.4), M('#2e2a3a'), 0, 0.04, -0.02); hood.rotation.y = Math.PI; head.add(hood);
    head.add(mesh(new THREE.BoxGeometry(0.5, 0.1, 0.1), M('#2e2a3a'), 0, -0.1, 0.25));
    const dag = () => { const d = new THREE.Group(); d.add(mesh(new THREE.ConeGeometry(0.05, 0.4, 4), steel, 0, 0.25, 0)); d.add(mesh(new THREE.BoxGeometry(0.16, 0.04, 0.05), M('#ffcf5a'), 0, 0.05, 0)); d.rotation.x = 1.3; return d; };
    hand.add(dag()); offhand.add(dag());
    body.add(mesh(new THREE.TorusGeometry(0.3, 0.06, 5, 10), M('#2e2a3a'), 0, 0.88, 0)); body.children[body.children.length - 1].rotation.x = Math.PI / 2;
  } else if (cls === 'ranger') {
    const cap = mesh(new THREE.ConeGeometry(0.36, 0.3, 7), M('#3f8a4a'), 0, 0.3, -0.02); cap.rotation.x = -0.25; head.add(cap);
    const feather = mesh(new THREE.ConeGeometry(0.05, 0.4, 4), M('#ffd23f'), 0.2, 0.42, -0.08); feather.rotation.z = -0.8; head.add(feather);
    const bow = mesh(new THREE.TorusGeometry(0.42, 0.035, 4, 12, Math.PI), wood, 0, 0, 0.05); bow.rotation.z = Math.PI / 2; bow.rotation.y = Math.PI / 2; offhand.add(bow);
    offhand.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.84, 3), M('#ffffff'), 0, 0, 0.05, false));
    body.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.55, 6), M('#6b4126'), 0.15, 0.8, -0.3)); body.children[body.children.length - 1].rotation.x = 0.4;
  } else {
    const hood = mesh(new THREE.ConeGeometry(0.42, 0.62, 8), M('#5a2d82'), 0, 0.22, -0.05); head.add(hood); hood.renderOrder = 1;
    head.children[0].position.z = 0.02;
    const horn = new THREE.ConeGeometry(0.06, 0.26, 5), hm = M('#f3e9d2');
    const h1 = mesh(horn, hm, -0.22, 0.3, 0), h2 = mesh(horn, hm, 0.22, 0.3, 0); h1.rotation.z = 0.6; h2.rotation.z = -0.6; head.add(h1, h2);
    const book = new THREE.Group(); book.position.set(0.7, 1.15, 0.45); g.add(book); g.book = book;
    book.add(mesh(new THREE.BoxGeometry(0.34, 0.06, 0.26), M('#7a3ab3'), 0, 0, 0));
    book.add(mesh(new THREE.BoxGeometry(0.3, 0.07, 0.22), new THREE.MeshStandardMaterial({ color: '#fff4d6', emissive: '#d38cff', emissiveIntensity: 0.5 }), 0, 0.02, 0, false));
    body.add(mesh(new THREE.CylinderGeometry(0.33, 0.44, 0.34, 8), M('#5a2d82'), 0, 0.3, 0));
  }
  // ground ring in the agent's colour
  const ring = mesh(new THREE.RingGeometry(0.55, 0.68, 22), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 }), 0, 0.03, 0, false); ring.rotation.x = -Math.PI / 2; g.add(ring);
  body.scale.setScalar(1.3); g.body = body; g.head = head; g.armL = armL; g.armR = armR; g.ring = ring;
  const mats = []; g.traverse(o => { if (o.isMesh && o.material && o.material.emissive && !mats.includes(o.material)) mats.push(o.material); }); g.mats = mats;
  return g;
}
function slotFor() {
  const used = new Set([...heroes.values()].filter(h => !h.resting).map(h => h.slot));
  for (let i = 0; i < SLOTS.length; i++) if (!used.has(i)) return i;
  return -1;
}
function pickColor(id) {
  const used = new Set([...heroes.values()].map(h => h.color));
  let i = hash(id) % HCOL.length; for (let k = 0; k < HCOL.length && used.has(HCOL[i]); k++) i = (i + 1) % HCOL.length;
  return HCOL[i];
}
function getHero(e, anim = true) {
  let h = heroes.get(e.agent);
  if (h) return h;
  h = { id: e.agent, label: e.label || 'agent', src: e.src, color: pickColor(e.agent), counts: {}, cls: CAT_CLASS[e.cat] || 'knight', hp: heroMaxHp(), maxHp: heroMaxHp(), ko: 0, resting: false, last: e.t || Date.now(), q: [], busy: false, fams: new Map(), hits: 0, flash: 0, sq: 0, pose: null };
  h.slot = slotFor(); if (h.slot < 0) h.hidden = true;
  heroes.set(h.id, h);
  makeHeroBody(h);
  const tg = document.createElement('div'); tg.className = 'tag'; tg.style.setProperty('--c', h.color);
  tg.innerHTML = `<div class="wait">✋ waiting for you</div><div class="nm"><span class="ic"></span><span class="lb"></span><span class="cls"></span></div><div class="hpb"><i></i></div>`;
  tg.querySelector('.lb').textContent = h.label; tagsEl.appendChild(tg); h.tag = tg;
  updTag(h);
  const home = homeOf(h); h.g.position.copy(home);
  if (anim) { h.g.position.y = 6; h.drop = 1; poof(home, h.color); sfx.join(); }
  save.stats.maxParty = Math.max(save.stats.maxParty, [...heroes.values()].length);
  layoutParty();
  return h;
}
function makeHeroBody(h) {
  const old = h.g; h.g = buildHeroMesh(h.color, h.cls); h.g.visible = !h.hidden;
  if (old) { h.g.position.copy(old.position); h.g.rotation.copy(old.rotation); scene.remove(old); }
  scene.add(h.g);
}
function updTag(h) {
  const c = CLASSES[h.cls]; h.tag.querySelector('.ic').textContent = c.ic; h.tag.querySelector('.cls').textContent = c.name;
  h.tag.querySelector('.hpb i').style.width = clamp(h.hp / h.maxHp, 0, 1) * 100 + '%';
  h.tag.classList.toggle('ko', h.ko > 0); h.tag.classList.toggle('waiting', h.resting);
}
function homeOf(h) {
  if (h.resting) { const rs = [...heroes.values()].filter(x => x.resting); const i = rs.indexOf(h), a = 2.4 + i * 1.1; return CAMP.clone().add(new THREE.Vector3(Math.cos(a) * 1.15, 0, Math.sin(a) * 1.15)).setY(0.17); }
  const s = SLOTS[Math.max(0, h.slot)]; return at(s[0], s[1], 0.17);
}
function layoutParty() {
  // keep fighters in the first free slots, extras beyond 8 wait off-screen
  const fighters = [...heroes.values()].filter(h => !h.resting);
  const taken = new Set();
  for (const h of fighters) { if (h.slot >= 0 && !taken.has(h.slot)) taken.add(h.slot); else h.slot = -1; }
  for (const h of fighters) if (h.slot < 0) { for (let i = 0; i < SLOTS.length; i++) if (!taken.has(i)) { h.slot = i; taken.add(i); break; } }
  for (const h of heroes.values()) { const hide = !h.resting && h.slot < 0; h.hidden = hide; if (h.g) h.g.visible = !hide; h.tag.style.display = hide ? 'none' : ''; }
  $('#idle').hidden = heroes.size > 0 || forkOpen;
}
function removeHero(h) {
  poof(h.g.position, h.color); scene.remove(h.g); h.tag.remove();
  for (const f of h.fams.values()) { scene.remove(f.g); f.tag.remove(); }
  heroes.delete(h.id); layoutParty();
}
function setRest(h, on) {
  if (h.resting === on) return;
  h.resting = on; if (on) { h.q.length = 0; h.slot = -1; } else h.slot = slotFor();
  layoutParty(); updTag(h);
}
// familiars (subagents)
function getFam(e) {
  let p = heroes.get(e.parent);
  if (!p) p = getHero({ ...e, agent: e.parent, parent: null, cat: 'delegate' }, true);
  let f = p.fams.get(e.agent);
  if (f) return f;
  const c = new THREE.Color(p.color).offsetHSL(0, 0, 0.18).getStyle();
  const g = new THREE.Group();
  const core = mesh(new THREE.IcosahedronGeometry(0.2, 0), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.7, flatShading: true }), 0, 0, 0);
  g.add(core);
  for (const s of [-1, 1]) { const w = mesh(new THREE.ConeGeometry(0.1, 0.32, 3), new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.75 }), s * 0.22, 0.05, -0.05, false); w.rotation.z = s * 1.2; g.add(w); }
  g.add(mesh(new THREE.SphereGeometry(0.04, 5, 4), M('#1a1020'), -0.07, 0.04, 0.18, false), mesh(new THREE.SphereGeometry(0.04, 5, 4), M('#1a1020'), 0.07, 0.04, 0.18, false));
  scene.add(g); g.position.copy(p.g.position).setY(3);
  const tg = document.createElement('div'); tg.className = 'tag fam'; tg.style.setProperty('--c', p.color); tg.innerHTML = '<div class="nm">✦ familiar</div>'; tg.style.display = 'none'; tagsEl.appendChild(tg);
  f = { id: e.agent, g, core, tag: tg, ph: Math.random() * 6, idx: p.fams.size, parent: p, last: Date.now(), zap: 0 };
  p.fams.set(e.agent, f); save.stats.familiars++;
  poof(g.position, p.color); sfx.summon();
  return f;
}
function endFam(e) {
  const p = heroes.get(e.parent); if (!p) return; const f = p.fams.get(e.agent); if (!f) return;
  poof(f.g.position, p.color); scene.remove(f.g); f.tag.remove(); p.fams.delete(e.agent);
}

// ================================================================ monsters
const MTYPES = ['slime', 'bat', 'goblin', 'skeleton', 'shroom', 'golem', 'mimic'];
const MNAMES = { slime: 'Goo Slime', bat: 'Cave Flapper', goblin: 'Grub Goblin', skeleton: 'Rattlebones', shroom: 'Spore Cap', golem: 'Rubble Golem', mimic: 'Snap Chest' };
const BOSSES = [['warden', 'The Gloom Warden'], ['slimeking', 'King Gloopus'], ['titan', 'The Stone Titan'], ['lich', 'Lord Hollowcrown']];
let mon = null;
function eyes(g, y, z, sp, s = 0.09, glow = null) {
  const w = glow ? new THREE.MeshBasicMaterial({ color: glow }) : M('#ffffff'), p = M('#140c1c');
  for (const k of [-1, 1]) { g.add(mesh(new THREE.SphereGeometry(s, 8, 6), w, k * sp, y, z, false)); if (!glow) g.add(mesh(new THREE.SphereGeometry(s * 0.55, 6, 5), p, k * sp, y, z + s * 0.6, false)); }
  const brow = M('#140c1c'); for (const k of [-1, 1]) { const b = mesh(new THREE.BoxGeometry(s * 2.2, s * 0.5, s * 0.5), brow, k * sp, y + s * 1.3, z + s * 0.2, false); b.rotation.z = -k * 0.4; g.add(b); }
}
function crown(g, y, s = 1) {
  const gm = G('#ffcf5a', { metalness: 0.6, emissive: '#7a5200', emissiveIntensity: 0.3 });
  const c = new THREE.Group(); c.position.y = y; c.scale.setScalar(s); g.add(c);
  c.add(mesh(new THREE.CylinderGeometry(0.42, 0.38, 0.22, 8, 1, true), gm));
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; c.add(mesh(new THREE.ConeGeometry(0.09, 0.3, 4), gm, Math.cos(a) * 0.38, 0.24, Math.sin(a) * 0.38)); }
  c.add(mesh(new THREE.OctahedronGeometry(0.09, 0), G('#ff4d6d', { emissive: '#ff4d6d', emissiveIntensity: 0.5 }), 0, 0.05, 0.42, false));
}
function buildMonster(type, elite) {
  const g = new THREE.Group(), b = new THREE.Group(); g.add(b);
  const th = theme();
  if (type === 'slime' || type === 'slimeking') {
    const c = type === 'slimeking' ? '#53d17a' : ['#6be37f', '#5cc8ff', '#ff7ab8', '#c48cff'][(save.floor + save.room) % 4];
    const body = mesh(new THREE.SphereGeometry(0.85, 9, 7), new THREE.MeshStandardMaterial({ color: c, roughness: 0.2, flatShading: true, transparent: true, opacity: 0.92, emissive: c, emissiveIntensity: 0.12 }), 0, 0.62, 0);
    body.scale.set(1, 0.78, 1); b.add(body); eyes(b, 0.8, 0.68, 0.24, 0.11);
    b.add(mesh(new THREE.SphereGeometry(0.16, 6, 5), new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.55 }), -0.38, 1.0, 0.45, false));
    if (type === 'slimeking') crown(b, 1.3, 1.2);
  } else if (type === 'bat') {
    const c = M('#5a3a7a'); b.add(mesh(new THREE.SphereGeometry(0.42, 8, 6), c, 0, 1.5, 0));
    for (const k of [-1, 1]) { const e = mesh(new THREE.ConeGeometry(0.12, 0.3, 4), c, k * 0.22, 1.9, 0); b.add(e); }
    const wg = new THREE.Shape(); wg.moveTo(0, 0); wg.lineTo(1.0, 0.4); wg.lineTo(0.85, -0.1); wg.lineTo(0.6, 0.05); wg.lineTo(0.45, -0.2); wg.lineTo(0.2, -0.1);
    const wgeo = new THREE.ShapeGeometry(wg); const wm = M('#3d2556', { side: THREE.DoubleSide });
    const wl = new THREE.Group(), wr = new THREE.Group(); wl.position.set(-0.3, 1.55, 0); wr.position.set(0.3, 1.55, 0);
    const a = mesh(wgeo, wm); a.scale.x = -1; wl.add(a); wr.add(mesh(wgeo, wm)); b.add(wl, wr); g.wings = [wl, wr];
    eyes(b, 1.55, 0.36, 0.14, 0.08, '#ff4d4d');
    b.add(mesh(new THREE.ConeGeometry(0.04, 0.1, 3), M('#ffffff'), -0.08, 1.36, 0.38, false), mesh(new THREE.ConeGeometry(0.04, 0.1, 3), M('#ffffff'), 0.08, 1.36, 0.38, false));
    b.children.slice(-2).forEach(t => t.rotation.x = Math.PI);
  } else if (type === 'goblin') {
    const sk = M('#7cc65a'); b.add(mesh(rounded(0.75, 0.7, 0.55, 0.16), M('#8a5a34'), 0, 0.55, 0)); b.add(mesh(new THREE.SphereGeometry(0.45, 9, 7), sk, 0, 1.2, 0));
    for (const k of [-1, 1]) { const e = mesh(new THREE.ConeGeometry(0.12, 0.5, 4), sk, k * 0.5, 1.3, 0); e.rotation.z = -k * 1.3; b.add(e); }
    eyes(b, 1.27, 0.38, 0.16, 0.09); b.add(mesh(new THREE.ConeGeometry(0.09, 0.3, 4), sk, 0, 1.12, 0.45)); b.children[b.children.length - 1].rotation.x = Math.PI / 2;
    const club = new THREE.Group(); club.position.set(0.5, 0.75, 0.15); club.rotation.z = -0.5; club.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 5), M('#6b4126'), 0, 0.2, 0)); club.add(mesh(new THREE.DodecahedronGeometry(0.2, 0), M('#6b4126'), 0, 0.55, 0)); b.add(club);
    b.add(mesh(new THREE.CapsuleGeometry(0.1, 0.15, 3, 5), sk, -0.18, 0.15, 0), mesh(new THREE.CapsuleGeometry(0.1, 0.15, 3, 5), sk, 0.18, 0.15, 0));
  } else if (type === 'skeleton') {
    const bone = M('#f1e9d6');
    b.add(mesh(new THREE.SphereGeometry(0.42, 9, 7), bone, 0, 1.45, 0)); b.add(mesh(new THREE.BoxGeometry(0.42, 0.18, 0.36), bone, 0, 1.12, 0.06));
    for (const k of [-1, 1]) b.add(mesh(new THREE.SphereGeometry(0.12, 6, 5), new THREE.MeshBasicMaterial({ color: '#1a0f22' }), k * 0.15, 1.48, 0.33, false), mesh(new THREE.SphereGeometry(0.05, 5, 4), new THREE.MeshBasicMaterial({ color: '#7fe7ff' }), k * 0.15, 1.48, 0.42, false));
    for (let i = 0; i < 4; i++) b.add(mesh(new THREE.TorusGeometry(0.26 - i * 0.03, 0.04, 4, 10), bone, 0, 0.92 - i * 0.14, 0));
    b.children.slice(-4).forEach(r => r.rotation.x = Math.PI / 2);
    b.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 5), bone, 0, 0.75, 0));
    b.add(mesh(new THREE.CapsuleGeometry(0.06, 0.4, 3, 5), bone, -0.14, 0.25, 0), mesh(new THREE.CapsuleGeometry(0.06, 0.4, 3, 5), bone, 0.14, 0.25, 0));
    const sw = mesh(new THREE.BoxGeometry(0.08, 0.8, 0.04), G('#a8b0bc', { metalness: 0.5 }), 0.45, 0.95, 0.2); sw.rotation.z = -0.3; b.add(sw);
  } else if (type === 'shroom') {
    b.add(mesh(new THREE.CylinderGeometry(0.32, 0.4, 0.75, 9), M('#f6ead2'), 0, 0.4, 0));
    const cap = mesh(new THREE.SphereGeometry(0.8, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2), M('#e8484f'), 0, 0.72, 0); cap.scale.y = 0.75; b.add(cap);
    for (let i = 0; i < 7; i++) { const a = i * 0.9, r = 0.35 + (i % 2) * 0.2; b.add(mesh(new THREE.SphereGeometry(0.1, 6, 5), M('#ffffff'), Math.cos(a) * r, 0.72 + Math.sqrt(Math.max(0, 0.64 - r * r)) * 0.75, Math.sin(a) * r, false)); }
    eyes(b, 0.48, 0.33, 0.13, 0.08);
  } else if (type === 'golem' || type === 'titan') {
    const st = M(type === 'titan' ? '#8d8aa0' : th.wall[1]);
    b.add(mesh(new THREE.DodecahedronGeometry(0.6, 0), st, 0, 0.95, 0)); b.add(mesh(new THREE.IcosahedronGeometry(0.36, 0), st, 0, 1.7, 0.05));
    for (const k of [-1, 1]) { b.add(mesh(new THREE.DodecahedronGeometry(0.3, 0), st, k * 0.75, 1.05, 0.1)); b.add(mesh(new THREE.DodecahedronGeometry(0.26, 0), st, k * 0.85, 0.55, 0.2)); b.add(mesh(new THREE.DodecahedronGeometry(0.28, 0), st, k * 0.3, 0.25, 0)); }
    eyes(b, 1.75, 0.33, 0.13, 0.07, type === 'titan' ? '#ff5a3c' : '#7fe7ff');
    b.add(mesh(new THREE.OctahedronGeometry(0.12, 0), new THREE.MeshBasicMaterial({ color: th.moss }), 0, 1.0, 0.58, false));
    if (type === 'titan') crown(b, 2.0, 1.0);
  } else if (type === 'mimic') {
    const wd = M('#a8713e'), gold = G('#ffcf5a', { metalness: 0.5 });
    b.add(mesh(rounded(1.1, 0.6, 0.8, 0.08), wd, 0, 0.32, 0));
    const lid = new THREE.Group(); lid.position.set(0, 0.62, -0.4); b.add(lid); g.lid = lid;
    lid.add(mesh(rounded(1.1, 0.35, 0.8, 0.08), wd, 0, 0.15, 0.4));
    for (let i = 0; i < 6; i++) { const t = mesh(new THREE.ConeGeometry(0.06, 0.18, 4), M('#ffffff'), -0.42 + i * 0.17, -0.05, 0.75); t.rotation.x = Math.PI; lid.add(t); b.add(mesh(new THREE.ConeGeometry(0.06, 0.16, 4), M('#ffffff'), -0.42 + i * 0.17, 0.68, 0.36)); }
    b.add(mesh(new THREE.BoxGeometry(1.14, 0.08, 0.84), gold, 0, 0.6, 0)); b.add(mesh(new THREE.SphereGeometry(0.2, 7, 5), M('#ff6b8a'), 0, 0.68, 0.15));
    eyes(lid, 0.42, 0.62, 0.22, 0.09, '#ffdf3c');
  } else if (type === 'warden' || type === 'lich') {
    const arm = M(type === 'lich' ? '#3d2d5c' : '#3a3550'), trim = G(type === 'lich' ? '#9be7ff' : '#c94b4b', { metalness: 0.3 });
    b.add(mesh(rounded(1.0, 1.0, 0.7, 0.2), arm, 0, 0.95, 0)); b.add(mesh(new THREE.CylinderGeometry(0.4, 0.62, 0.55, 8), arm, 0, 0.3, 0));
    b.add(mesh(new THREE.SphereGeometry(0.42, 9, 7), arm, 0, 1.72, 0));
    for (const k of [-1, 1]) { const h = mesh(new THREE.ConeGeometry(0.12, 0.62, 5), M('#f1e9d6'), k * 0.4, 2.05, 0); h.rotation.z = -k * 0.7; b.add(h); b.add(mesh(new THREE.SphereGeometry(0.3, 7, 5), trim, k * 0.65, 1.32, 0)); }
    eyes(b, 1.75, 0.36, 0.15, 0.08, type === 'lich' ? '#7fe7ff' : '#ffdf3c');
    const ax = new THREE.Group(); ax.position.set(0.85, 1.0, 0.3); ax.rotation.z = -0.3; b.add(ax);
    ax.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 5), M('#5a3a22'), 0, 0.3, 0));
    if (type === 'lich') ax.add(mesh(new THREE.IcosahedronGeometry(0.25, 0), new THREE.MeshStandardMaterial({ color: '#7fe7ff', emissive: '#3fd0ff', emissiveIntensity: 1.2, flatShading: true }), 0, 1.15, 0));
    else { const blade = mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 8, 1, false, 0, Math.PI), G('#c9d1dc', { metalness: 0.6 }), 0.0, 0.95, 0); blade.rotation.z = Math.PI / 2; ax.add(blade); }
    if (type === 'lich') crown(b, 2.0, 0.9);
  }
  if (elite) { const aura = mesh(new THREE.RingGeometry(0.9, 1.15, 24), new THREE.MeshBasicMaterial({ color: '#ffcf5a', transparent: true, opacity: 0.7 }), 0, 0.04, 0, false); aura.rotation.x = -Math.PI / 2; g.add(aura); g.aura = aura; }
  const shadowDisk = mesh(new THREE.CircleGeometry(0.85, 16), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.25 }), 0, 0.02, 0, false); shadowDisk.rotation.x = -Math.PI / 2; g.add(shadowDisk);
  const mats = []; g.traverse(o => { if (o.isMesh && o.material && o.material.emissive) { o.material = o.material.clone(); o.material.userData.e0 = o.material.emissive.clone(); o.material.userData.ei = o.material.emissiveIntensity; mats.push(o.material); } });
  g.mats = mats; g.body = b;
  return g;
}
function spawnMonster(fromSave = false) {
  if (mon) scene.remove(mon.g);
  const boss = isBossFloor(save.floor), elite = !boss && save.elite && save.room === 0;
  let type, name;
  if (boss) { const bi = (Math.floor(save.floor / 5) - 1) % BOSSES.length; [type, name] = BOSSES[bi]; }
  else { const r = rng(save.floor * 31 + save.room * 7 + 3); type = MTYPES[(r() * MTYPES.length) | 0]; name = MNAMES[type]; }
  const max = monsterMax(save.floor, boss, elite);
  const g = buildMonster(type, elite);
  const sc = boss ? 2.1 : elite ? 1.65 : 1.3;
  g.scale.setScalar(sc); g.position.copy(MON_POS); g.lookAt(at(-3, 0, 0.17)); g.position.y = fromSave ? MON_POS.y : 7;
  scene.add(g);
  mon = { type, name: (elite ? 'Elite ' : '') + name, boss, elite, max, hp: fromSave && save.mhp ? Math.min(save.mhp, max) : max, g, sc, flash: 0, sq: 0, dead: false, lunge: 0, falling: !fromSave, vy: 0 };
  save.mhp = mon.hp;
  const mb = $('#mbar'); mb.classList.toggle('boss', boss); mb.classList.toggle('elite', elite);
  mb.querySelector('.mname').textContent = (boss ? '👑 ' : elite ? '★ ' : '') + mon.name;
  if (boss && !fromSave) { banner('BOSS FLOOR', name, 'red'); sfx.boss(); focus(1.2, 0.5); }
  hud();
}
function flashMon(c = '#ffffff', s = 1) { if (!mon) return; mon.flash = 1; mon.flashC = c; mon.sq = s; }

// ================================================================ fx: tweens, projectiles, numbers, camera
const tweens = [];
const tween = (dur, fn, done) => tweens.push({ t: 0, dur, fn, done });
const wait = (s, fn) => tween(s, null, fn);
const _v = new THREE.Vector3();
function scr(p) { _v.copy(p).project(camera); return { x: (_v.x + 1) / 2 * innerWidth, y: (1 - _v.y) / 2 * innerHeight, ok: _v.z < 1 }; }
const numsEl = $('#nums');
function num(pos, text, cls = '', color = '#fff') {
  const s = scr(pos); if (!s.ok) return;
  const d = document.createElement('div'); d.className = 'num ' + cls; d.textContent = text; d.style.color = color;
  d.style.left = clamp(s.x + (Math.random() - 0.5) * 36, 40, innerWidth - 40) + 'px'; d.style.top = clamp(s.y, 60, innerHeight - 60) + 'px';
  numsEl.appendChild(d); setTimeout(() => d.remove(), 1000);
  while (numsEl.children.length > 40) numsEl.firstChild.remove();
}
let banTimer = 0;
function banner(t, sub = '', cls = '') { const b = $('#banner'); b.innerHTML = `<div class="b ${cls}">${t}${sub ? `<small></small>` : ''}</div>`; if (sub) b.querySelector('small').textContent = sub; clearTimeout(banTimer); banTimer = setTimeout(() => b.innerHTML = '', 1900); }
const projectiles = [];
function shoot(from, to, kind, color, onHit) {
  let m;
  if (kind === 'arrow') { m = new THREE.Group(); m.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 4), M('#8a5a34'), 0, 0, 0, false)); m.add(mesh(new THREE.ConeGeometry(0.07, 0.18, 4), G('#d7dde6'), 0, 0.42, 0, false)); }
  else { m = mesh(new THREE.IcosahedronGeometry(kind === 'big' ? 0.45 : kind === 'zap' ? 0.14 : 0.24, 0), new THREE.MeshBasicMaterial({ color }), 0, 0, 0, false); const L = new THREE.PointLight(color, 4, 4, 1.5); m.add(L); }
  scene.add(m); m.position.copy(from);
  projectiles.push({ m, from: from.clone(), to: to.clone(), t: 0, dur: kind === 'arrow' ? 0.32 : kind === 'big' ? 0.55 : 0.38, arc: kind === 'arrow' ? 0.9 : kind === 'zap' ? 1.2 : 0.4, kind, color, onHit });
}
let shake = 0, zoom = 0, zoomT = 0, zoomTo = null;
function focus(t, amt = 0.35, target = null) { zoomT = Math.max(zoomT, t); zoom = Math.max(zoom, 0.01); zoomAmt = amt; zoomTo = target; }
let zoomAmt = 0.35;
function poof(pos, color) { burst(scene, pos.clone().setY((pos.y || 0) + 0.8), [color, '#ffffff'], 14, { speed: 0.09, up: 0.06, size: 0.9, shape: 'sphere', gravity: 0.002 }); }
function sparkle(pos, color = '#ffe14d', n = 22) { burst(scene, pos, [color, '#ffffff', '#fff3b0'], n, { speed: 0.1, up: 0.12, size: 0.6, gravity: 0.004 }); }

// ================================================================ sound (short, quiet)
const sfx = {
  hit: () => tone(200 + Math.random() * 80, 0.07, 'square', 0.035, 0.5),
  slash: () => tone(900, 0.08, 'sawtooth', 0.025, 0.3),
  cast: () => tone(500, 0.18, 'sine', 0.05, 2.2),
  crit: () => { tone(330, 0.1, 'square', 0.05, 2); setTimeout(() => tone(660, 0.16, 'triangle', 0.06, 1.5), 70); },
  ult: () => [392, 523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.06, 1), i * 70)),
  hurt: () => tone(140, 0.2, 'sawtooth', 0.05, 0.5),
  block: () => tone(1200, 0.08, 'square', 0.03, 0.8),
  kill: () => { tone(260, 0.2, 'square', 0.05, 0.3); setTimeout(() => tone(880, 0.12, 'triangle', 0.05, 1.3), 120); },
  coin: () => { tone(988, 0.05, 'square', 0.03, 1); setTimeout(() => tone(1318, 0.1, 'square', 0.03, 1), 55); },
  chest: () => [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => tone(f, 0.12, 'triangle', 0.05, 1), i * 60)),
  level: () => [440, 554, 659, 880].forEach((f, i) => setTimeout(() => tone(f, 0.2, 'triangle', 0.06, 1), i * 90)),
  boss: () => { tone(80, 0.8, 'sawtooth', 0.06, 0.6); setTimeout(() => tone(60, 0.9, 'sawtooth', 0.05, 0.7), 300); },
  join: () => tone(600, 0.1, 'triangle', 0.04, 1.6),
  summon: () => tone(700, 0.25, 'sine', 0.04, 1.8),
  done: () => { tone(784, 0.15, 'sine', 0.05, 1); setTimeout(() => tone(1046, 0.25, 'sine', 0.05, 1), 140); },
  tap: () => tone(420, 0.05, 'square', 0.03, 0.6),
  equip: () => tone(660, 0.1, 'triangle', 0.05, 1.3),
  door: () => tone(110, 0.4, 'triangle', 0.06, 0.8),
};

// ================================================================ combat
function hitPoint() { return mon ? mon.g.position.clone().setY(mon.g.position.y + 1.0 * mon.sc) : MON_POS.clone(); }
function damage(amount, { crit = false, ult = false, color = '#fff', from = null, small = false } = {}) {
  if (!mon || mon.dead || mon.falling) return 0;
  mon.hp = Math.max(0, mon.hp - amount); save.mhp = mon.hp;
  flashMon(ult ? '#ff9cf0' : '#ffffff', ult ? 1.4 : crit ? 1 : 0.6);
  num(hitPoint(), (ult ? '✦' : '') + amount + (crit || ult ? '!' : ''), ult ? 'ult' : crit ? 'crit' : small ? 'small' : '', color);
  burst(scene, hitPoint(), [color, '#ffffff'], ult ? 26 : crit ? 14 : 6, { speed: ult ? 0.16 : 0.09, up: 0.06, size: ult ? 0.9 : 0.55, gravity: 0.004 });
  if (crit || ult) { shake = Math.max(shake, ult ? 0.5 : 0.25); sfx.crit(); } else sfx.hit();
  if (mon.hp <= 0) killMonster();
  hud(); persist();
  return amount;
}
function rollHit(h, mult = 1) {
  const crit = Math.random() < critChance();
  const dmg = heroDmg(mult * (crit ? 2 : 1));
  if (crit) { save.stats.crits++; today.crits++; if (Math.random() < 0.5) focus(0.5, 0.18); }
  return { dmg, crit };
}
// a finished, successful tool call: the hero attacks (class-specific)
function attack(h, counted, mult = 1) {
  if (h.ko > 0) { h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.2); if (h.hp > h.maxHp * 0.35) { h.ko = 0; h.pose = null; num(h.g.position.clone().setY(2), 'BACK UP!', 'info', '#7be08f'); } updTag(h); return; }
  if (counted) { today.hits++; h.hits++; heroToday(h).hits++; }
  const { dmg, crit } = rollHit(h, mult), apply = counted ? dmg : 0, col = crit ? '#ffe14d' : h.color;
  const go = (amt) => { if (amt) damage(amt, { crit, color: col }); else flashMon(); };
  const home = homeOf(h), tgt = hitPoint();
  const queue = fn => { if (h.q.length > 3) { go(apply); return; } h.q.push(fn); };
  if (h.cls === 'knight') queue(done => {
    const to = MON_POS.clone().addScaledVector(R, -1.25 * (mon ? mon.sc : 1)).setY(0.17);
    tween(0.16, p => h.g.position.lerpVectors(home, to, p * p), () => { h.swing = 1; sfx.slash(); go(apply); tween(0.22, p => h.g.position.lerpVectors(to, home, p), done); });
  });
  else if (h.cls === 'mage') queue(done => { h.cast = 1; sfx.cast(); const from = h.g.position.clone().setY(1.9); wait(0.12, () => shoot(from, tgt, 'orb', '#6fe3ff', () => go(apply))); wait(0.35, done); });
  else if (h.cls === 'rogue') queue(done => {
    const to = MON_POS.clone().addScaledVector(R, -1.15 * (mon ? mon.sc : 1)).addScaledVector(F, 0.6).setY(0.17);
    tween(0.2, p => { h.g.position.lerpVectors(home, to, p); h.g.position.y = 0.17 + Math.sin(p * Math.PI) * 1.1; h.g.body.rotation.x = p * Math.PI * 2; }, () => {
      h.g.body.rotation.x = 0; h.swing = 1; sfx.slash(); const a = Math.ceil(apply / 2), b = apply - a;
      go(a); wait(0.1, () => { h.swing = 1; go(b); }); wait(0.18, () => tween(0.22, p => { h.g.position.lerpVectors(to, home, p); h.g.position.y = 0.17 + Math.sin(p * Math.PI) * 0.8; }, done));
    });
  });
  else if (h.cls === 'ranger') queue(done => { h.cast = 1; sfx.slash(); shoot(h.g.position.clone().setY(1.0), tgt, 'arrow', '#fff', () => go(apply)); wait(0.3, done); });
  else queue(done => { h.cast = 1; sfx.cast(); const from = (h.g.book ? h.g.book.getWorldPosition(new THREE.Vector3()) : h.g.position.clone().setY(1.5)); shoot(from, tgt, 'orb', '#d38cff', () => go(apply)); wait(0.35, done); });
}
// passing tests: this hero's ultimate (5×, camera zoom)
function ultimate(h, counted) {
  if (counted) { save.stats.tests++; today.tests++; today.hits++; heroToday(h).hits++; }
  h.ko = 0; h.hp = h.maxHp; updTag(h);
  const dmg = counted ? heroDmg(5) : 0;
  h.q.unshift(done => {
    banner('TESTS PASSED!', `${h.label} · ${CLASSES[h.cls].name} ultimate`, 'green'); sfx.ult(); focus(1.1, 0.25);
    h.g.position.y = 0.17; tween(0.35, p => { h.g.position.y = 0.17 + Math.sin(p * Math.PI) * 1.6; h.g.rotation.y += 0.5; }, () => {
      shoot(h.g.position.clone().setY(1.8), hitPoint(), 'big', h.color, () => { if (dmg) damage(dmg, { ult: true, color: h.color }); else flashMon(); confetti(scene, hitPoint(), 40); });
      wait(0.6, done);
    });
  });
}
// a failed tool call: the monster strikes back at that hero
function monsterHits(h, counted, heavy = false) {
  if (!mon || mon.dead || mon.falling) return;
  if (counted) today.fails++;
  mon.lunge = 1; mon.lungeAt = h;
  wait(0.18, () => {
    if (shieldWall > 0) { num(h.g.position.clone().setY(2.1), 'BLOCK', 'info', '#7cc8ff'); sfx.block(); burst(scene, h.g.position.clone().setY(1), '#7cc8ff', 10, { speed: 0.08, up: 0.05, size: 0.5 }); return; }
    const dmg = Math.round(monsterAtk() * (heavy ? 1.8 : 1) * (1 - Math.min(0.6, gearStat('def'))));
    h.hp = Math.max(0, h.hp - dmg); h.flash = 1; h.sq = 1; shake = Math.max(shake, heavy ? 0.35 : 0.18); sfx.hurt();
    num(h.g.position.clone().setY(2.0), '-' + dmg, 'hurt');
    if (h.hp <= 0 && !h.ko) { h.ko = 1; h.pose = 'ko'; num(h.g.position.clone().setY(2.4), 'KNOCKED OUT', 'info', '#ff8080'); h.koT = 20; }
    updTag(h);
  });
}
function killMonster() {
  const m = mon; m.dead = true; sfx.kill(); shake = 0.45; focus(0.6, 0.25);
  const gold = Math.round((4 + save.floor * 1.6) * (m.boss ? 8 : m.elite ? 3 : 1) * (1 + gearStat('gold')));
  const xp = Math.round(m.max / 4);
  tween(0.45, p => { m.g.scale.setScalar(m.sc * (1 + p * 0.3) * (1 - p)); m.g.rotation.y += 0.3; }, () => scene.remove(m.g));
  burst(scene, hitPoint(), ['#ffcf5a', '#ffffff', '#ff8a8a'], 30, { speed: 0.15, up: 0.12, size: 0.8 });
  for (let i = 0; i < 6; i++) wait(0.1 + i * 0.05, () => { sfx.coin(); burst(scene, m.g.position.clone().setY(0.8), '#ffcf5a', 3, { speed: 0.12, up: 0.16, size: 0.7, shape: 'sphere', gravity: 0.008 }); });
  num(m.g.position.clone().setY(2.6 * m.sc), `+${gold} 🪙`, 'gold');
  save.gold += gold; gainXp(xp);
  save.stats.kills++; today.kills++;
  if (m.boss) { save.stats.bosses++; today.bosses++; banner('BOSS DEFEATED!', m.name, ''); confetti(scene, hitPoint(), 90); wait(0.6, () => addLoot(makeItem(2, 0.3), hitPoint())); }
  else if (m.elite) { save.stats.elites++; save.elite = false; wait(0.5, () => addLoot(makeItem(1, 0.15), hitPoint())); }
  else if (Math.random() < 0.12) wait(0.5, () => addLoot(makeItem(0), hitPoint()));
  save.room++; save.mhp = null;
  checkTrophies(); persist(); hud();
  if (save.room >= perFloor(save.floor)) wait(1.0, () => openFork());
  else wait(0.9, () => spawnMonster());
}
function gainXp(x) {
  save.xp += x;
  while (save.xp >= xpNeed(save.level)) { save.xp -= xpNeed(save.level); save.level++; banner('LEVEL UP!', `Party level ${save.level}`, 'green'); sfx.level(); heroes.forEach(h => { h.maxHp = heroMaxHp(); h.hp = h.maxHp; updTag(h); sparkle(h.g.position.clone().setY(1.2), h.color, 12); }); }
}
// commit: a treasure chest pops out of the floor
function chest(h, counted) {
  const pos = at(-0.2 + (Math.random() - 0.5) * 1.2, 1.9 + Math.random() * 0.5, 0.17);
  const g = new THREE.Group(); g.position.copy(pos); g.position.y = 5; g.rotation.y = AZ + Math.PI * 0 + (Math.random() - 0.5) * 0.4; scene.add(g);
  const wd = M('#b5763a'), gold = G('#ffcf5a', { metalness: 0.6, emissive: '#7a5200', emissiveIntensity: 0.3 });
  g.add(mesh(rounded(0.8, 0.45, 0.55, 0.06), wd, 0, 0.22, 0)); g.add(mesh(new THREE.BoxGeometry(0.84, 0.07, 0.59), gold, 0, 0.42, 0));
  const lid = new THREE.Group(); lid.position.set(0, 0.45, -0.27); g.add(lid); lid.add(mesh(rounded(0.8, 0.22, 0.55, 0.06), wd, 0, 0.1, 0.27)); lid.add(mesh(new THREE.BoxGeometry(0.16, 0.16, 0.06), gold, 0, 0.02, 0.56));
  const glow = new THREE.PointLight('#ffcf5a', 0, 4, 1.4); glow.position.set(0, 0.8, 0.2); g.add(glow);
  if (counted) { save.stats.chests++; today.chests++; }
  tween(0.35, p => { g.position.y = lerp(5, pos.y, p * p); }, () => {
    shake = Math.max(shake, 0.12); sfx.door();
    wait(0.35, () => {
      tween(0.3, p => { lid.rotation.x = -p * 1.9; glow.intensity = p * 8; }, () => {
        sfx.chest(); sparkle(g.position.clone().setY(0.9), '#ffe14d', 30);
        if (counted) {
          const gold = Math.round((15 + save.floor * 4) * (0.8 + Math.random() * 0.6) * (1 + gearStat('gold')));
          save.gold += gold; num(g.position.clone().setY(1.6), `+${gold} 🪙`, 'gold');
          if (Math.random() < 0.4) wait(0.3, () => addLoot(makeItem(0, 0.05), g.position.clone().setY(2.2)));
          else if (Math.random() < 0.3) { save.potions++; wait(0.3, () => num(g.position.clone().setY(2.2), '+1 🧪', 'info', '#7be08f')); }
          checkTrophies(); persist(); hud();
        }
        wait(1.4, () => tween(0.3, p => g.scale.setScalar(1 - p), () => scene.remove(g)));
      });
    });
  });
  banner('TREASURE!', `${h.label} committed`, '');
}
// deploy: the whole floor is cleared and the party descends
function deployClear(h, counted) {
  if (forkOpen || descending) return;
  if (counted) { save.stats.deploys++; today.deploys++; }
  banner('DEPLOYED!', `${h.label} cleared the floor`, 'blue'); sfx.ult(); focus(1.0, 0.3);
  if (mon && !mon.dead && !mon.falling) {
    const left = perFloor(save.floor) - save.room - 1;
    if (counted) { save.gold += Math.round(left * (4 + save.floor * 1.6)); }
    shoot(h.g.position.clone().setY(2), hitPoint(), 'big', '#7cc8ff', () => {
      if (!mon || mon.dead) return openFork();
      if (!counted) return flashMon('#7cc8ff', 1);
      num(hitPoint(), 'DEPLOYED!', 'ult', '#7cc8ff'); save.room = perFloor(save.floor) - 1; mon.hp = 0; killMonster();
    });
  } else openFork();
}

// ================================================================ fork (choose your path) and descending
let forkOpen = false, descending = false, forkTimer = 0;
function openFork() {
  if (forkOpen || descending) return;
  forkOpen = true; save.room = perFloor(save.floor); persist();
  $('#fork').hidden = false; $('#bottom').style.visibility = 'hidden'; $('#mbar').style.display = 'none'; $('#idle').hidden = true;
  forkTimer = A && A.demo ? 9 : 25;
  sfx.door(); banner('FLOOR CLEARED!', '', 'green');
  doors.forEach(d => d.open = 1);
  heroes.forEach(h => { if (!h.resting && !h.ko) h.cheer = 1.2; });
  const nextBoss = isBossFloor(save.floor + 1);
  $('#fork .d-elite span').textContent = nextBoss ? 'Boss next: sharpen up (+dmg)' : 'Tougher foe, sure gear drop';
}
function choose(p) {
  if (!forkOpen) return;
  forkOpen = false; $('#fork').hidden = true; sfx.tap();
  if (p === 'elite') { save.elite = !isBossFloor(save.floor + 1); if (!save.elite) { warCry = Math.max(warCry, 14); } descend(); }
  else if (p === 'shop') openShop(true);
  else {
    heroes.forEach(h => { h.hp = h.maxHp; h.ko = 0; h.pose = null; updTag(h); sparkle(h.g.position.clone().setY(1), '#7be08f', 10); });
    save.mana = Math.min(100, save.mana + 40); campfire.boost = 2; banner('RESTED', 'Party healed · +40 mana', 'green'); sfx.level();
    wait(1.3, descend);
  }
  persist();
}
function descend() {
  if (descending) return;
  descending = true; doors.forEach(d => d.open = 0);
  $('#fade').style.opacity = 1;
  setTimeout(() => {
    save.floor++; save.room = 0; save.mhp = null; today.floors++; save.best = Math.max(save.best, save.floor); save.stats.best = save.best;
    buildRoom(); spawnMonster(true); mon.g.position.y = 7; mon.falling = true;
    heroes.forEach(h => { const p = homeOf(h); h.g.position.copy(p); h.g.position.y = 4 + Math.random() * 2; h.drop = 1; });
    checkTrophies(); persist(); hud(); submitScore();
    $('#fade').style.opacity = 0; $('#bottom').style.visibility = ''; $('#mbar').style.display = '';
    if (isBossFloor(save.floor)) banner('BOSS FLOOR ' + save.floor, mon.name, 'red'); else banner('FLOOR ' + save.floor, theme().name, '');
    if (isBossFloor(save.floor)) { sfx.boss(); focus(1.4, 0.45); } else shake = 0.2;
    layoutParty();
    setTimeout(() => descending = false, 400);
  }, 480);
}

// ================================================================ player abilities
const CD = { cry: 25, wall: 30, pot: 1.5, ult: 0 };
const cdLeft = { cry: 0, wall: 0, pot: 0, ult: 0 };
function ability(a) {
  if (forkOpen || descending) return;
  if (cdLeft[a] > 0) return;
  if (a === 'cry') { warCry = 10; cdLeft.cry = CD.cry; banner('WAR CRY!', 'Double damage for 10 s', ''); sfx.level(); heroes.forEach(h => { h.cheer = 1; sparkle(h.g.position.clone().setY(1.6), '#ffcf5a', 8); }); }
  if (a === 'wall') { shieldWall = 8; cdLeft.wall = CD.wall; banner('SHIELD WALL!', 'Failures are blocked for 8 s', 'blue'); sfx.block(); }
  if (a === 'pot') {
    if (save.potions <= 0) { toast('No potions. Find them in chests or buy them in the shop.', 2500); return; }
    save.potions--; cdLeft.pot = CD.pot; sfx.equip();
    heroes.forEach(h => { h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.6); if (h.ko) { h.ko = 0; h.pose = null; } updTag(h); sparkle(h.g.position.clone().setY(1), '#7be08f', 12); });
    persist();
  }
  if (a === 'ult') {
    if (save.mana < 100 || !mon || mon.dead || mon.falling) return;
    save.mana = 0; save.stats.pults++; today.ults++;
    const team = [...heroes.values()].filter(h => !h.ko && !h.resting && !h.hidden);
    banner('PARTY ULTIMATE!', team.length ? `${team.length} hero${team.length > 1 ? 'es' : ''} strike together` : 'The leader strikes alone', 'purple'); sfx.ult(); focus(1.6, 0.22); shake = 0.3;
    const meteor = (i, col) => wait(0.25 + i * 0.16, () => { const from = hitPoint().add(new THREE.Vector3((Math.random() - 0.5) * 3, 7, (Math.random() - 0.5) * 3)); shoot(from, hitPoint(), 'big', col, () => damage(heroDmg(3), { ult: true, color: col })); });
    if (team.length) team.forEach((h, i) => { h.cheer = 1.2; meteor(i, h.color); }); else meteor(0, '#ff9cf0');
    checkTrophies(); persist();
  }
  hud();
}
document.querySelectorAll('#abil button').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); ability(b.dataset.a); }));
document.querySelectorAll('#fork button').forEach(b => b.addEventListener('click', () => choose(b.dataset.p)));
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  const k = { '1': 'cry', '2': 'wall', '3': 'pot', '4': 'ult' }[e.key]; if (k) ability(k);
  if (e.key === ' ') { e.preventDefault(); leaderStrike(); }
  if (forkOpen && ['q', 'w', 'e'].includes(e.key)) choose({ q: 'elite', w: 'shop', e: 'rest' }[e.key]);
});
// the leader taps the monster
let strikeCd = 0;
function leaderStrike() {
  if (!mon || mon.dead || mon.falling || strikeCd > 0 || forkOpen) return;
  strikeCd = 0.28; const crit = Math.random() < critChance();
  damage(Math.max(1, Math.round(heroDmg(crit ? 0.6 : 0.3))), { crit, color: '#ffffff', small: !crit });
  burst(scene, hitPoint(), '#ffffff', 5, { speed: 0.12, up: 0.04, size: 0.4 });
}
renderer.domElement.addEventListener('pointerdown', e => {
  if (!mon) return; const s = scr(hitPoint());
  if (Math.hypot(e.clientX - s.x, e.clientY - s.y) < Math.max(90, 70 * mon.sc)) leaderStrike();
});

// ================================================================ HUD
function hud() {
  $('#floorN').textContent = 'FLOOR ' + save.floor; $('#theme').textContent = theme().name;
  const n = perFloor(save.floor); let p = '';
  for (let i = 0; i < n; i++) p += `<i class="${i < save.room ? 'done' : i === save.room ? 'cur' : ''} ${isBossFloor(save.floor) ? 'boss' : ''}"></i>`;
  $('#pips').innerHTML = p;
  $('#gold').textContent = save.gold.toLocaleString(); $('#pots').textContent = save.potions;
  $('#lv').textContent = 'Lv ' + save.level; $('#xp').style.width = clamp(save.xp / xpNeed(save.level), 0, 1) * 100 + '%';
  $('#mana i').style.width = save.mana + '%'; $('#mana').classList.toggle('full', save.mana >= 100);
  $('#abil [data-a=pot] .cnt').textContent = save.potions;
  $('#abil [data-a=pot]').classList.toggle('off', save.potions <= 0);
  $('#abil [data-a=ult]').classList.toggle('ready', save.mana >= 100); $('#abil [data-a=ult]').classList.toggle('off', save.mana < 100);
  if (mon) $('#mbar .hp i').style.width = clamp(mon.hp / mon.max, 0, 1) * 100 + '%';
  const rk = (() => { try { return JSON.parse(localStorage.getItem('board_rank_agent-dungeon')); } catch (e) { return null; } })(), pf = B && B.profile();
  $('#myRank').textContent = pf && rk && mode === 'real' ? `${flag(pf.country)} #${rk} today` : '';
}
function heroToday(h) { return today.heroes[h.label] || (today.heroes[h.label] = { cls: h.cls, color: h.color, hits: 0 }); }
const questPoints = () => today.kills * 10 + today.floors * 50 + today.bosses * 200 + today.crits * 2 + today.tests * 15;
let lastSubmitted = 0;
function submitScore() { if (mode !== 'real' || !B) return; const q = questPoints(); if (q > lastSubmitted) { lastSubmitted = q; B.submit(q, { tools: today.hits + today.fails, ok: today.hits }); } }
setInterval(submitScore, 5000);
function checkTrophies() {
  for (const [id, ic, name, , test] of TROPHIES) if (!save.trophies[id] && test(save.stats)) {
    save.trophies[id] = Date.now();
    setTimeout(() => { const d = document.createElement('div'); d.className = 'tpop'; d.textContent = `${ic} Trophy: ${name}`; document.body.appendChild(d); setTimeout(() => d.remove(), 3200); sfx.chest(); }, 600);
    $('#bTro').classList.add('ping');
  }
}

// ================================================================ panels: gear, shop, today, trophies
const modal = $('#modal'); let onClose = null;
function openModal(title, html, close) { modal.querySelector('h2').textContent = title; modal.querySelector('.body').innerHTML = html; modal.hidden = false; onClose = close || null; }
function closeModal() { modal.hidden = true; const f = onClose; onClose = null; f && f(); }
modal.querySelector('.x').onclick = closeModal;
modal.addEventListener('pointerdown', e => { if (e.target === modal) closeModal(); });
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function gearPanel() {
  $('#bGear').classList.remove('ping');
  const slot = s => { const it = save.gear[s]; return `<div class="slot ${it ? 'has' : ''}" style="--r:${it ? RAR[it.r][1] : '#888'}"><small>${s}</small><div class="ii">${SLOT_IC[s]}</div>${it ? `<b>${esc(it.name)}</b><i>${itemLine(it)}</i>` : '<i>empty</i>'}</div>`; };
  const bag = save.bag.map(it => { const d = itemPower(it) - itemPower(save.gear[it.slot]); return `<div class="item" style="--r:${RAR[it.r][1]}"><b>${SLOT_IC[it.slot]} ${esc(it.name)}</b><i>${RAR[it.r][0]} · ${itemLine(it)}</i><i class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲ better' : '▼ weaker'} than equipped</i><div class="row"><button data-eq="${it.id}">Equip</button><button class="s" data-sell="${it.id}">Sell ${sellPrice(it)}🪙</button></div></div>`; }).join('');
  openModal('Party Gear', `<div class="slots">${slot('weapon')}${slot('armor')}${slot('charm')}</div>
    <p class="note" style="margin:0 0 8px">Gear is shared by the whole party. Damage ×${(1 + gearStat('dmg')).toFixed(2)} · HP ×${(1 + gearStat('hp')).toFixed(2)} · crit ${Math.round(critChance() * 100)}%</p>
    <div class="bag">${bag || '<p class="note">Your bag is empty. Chests (commits), elites and bosses drop loot.</p>'}</div>`);
  modal.querySelectorAll('[data-eq]').forEach(b => b.onclick = () => { equip(b.dataset.eq); gearPanel(); });
  modal.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => { const i = save.bag.findIndex(x => x.id === b.dataset.sell); if (i >= 0) { save.gold += sellPrice(save.bag[i]); save.bag.splice(i, 1); sfx.coin(); persist(); hud(); gearPanel(); } });
}
function openShop(thenDescend) {
  const k = 1 + save.floor * 0.08;
  const wares = [
    ['pot', '🧪', 'Healing Potion', 'Heals the party 60% and revives the knocked out', Math.round(25 * k)],
    ['mana', '🔷', 'Mana Tonic', '+50 party mana', Math.round(35 * k)],
    ['crate', '📦', 'Gear Crate', 'A random piece of gear', Math.round(70 * k)],
    ['fine', '🎁', 'Fine Crate', 'Rare or better', Math.round(190 * k)],
  ];
  const render = () => {
    openModal('Shop', `<p class="note" style="margin:0 0 10px">You have <b style="color:#ffcf5a">${save.gold} 🪙</b></p><div class="shopl">${wares.map(([id, ic, n, d, c]) => `<div class="ware"><em>${ic}</em><div><b>${n}</b><span>${d}</span></div><button data-buy="${id}" ${save.gold < c ? 'disabled' : ''}>${c} 🪙</button></div>`).join('')}</div>
      ${thenDescend ? '<button class="big" id="shopGo">Descend ⤵</button>' : ''}`, thenDescend ? descend : null);
    modal.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
      const w = wares.find(x => x[0] === b.dataset.buy); if (save.gold < w[4]) return; save.gold -= w[4]; sfx.coin();
      if (w[0] === 'pot') save.potions++;
      if (w[0] === 'mana') save.mana = Math.min(100, save.mana + 50);
      if (w[0] === 'crate') addLoot(makeItem(0, 0.1));
      if (w[0] === 'fine') addLoot(makeItem(2, 0.2));
      persist(); hud(); render();
    });
    const go = $('#shopGo'); if (go) go.onclick = closeModal;
  };
  render();
}
function todayPanel() {
  const hs = Object.entries(today.heroes).sort((a, b) => b[1].hits - a[1].hits);
  openModal('Today', `<div class="grid2">
    <div><b>${today.hits}</b><span>attacks</span></div><div><b>${today.kills}</b><span>monsters slain</span></div><div><b>${today.floors}</b><span>floors descended</span></div>
    <div><b>${today.crits}</b><span>critical hits</span></div><div><b>${today.chests}</b><span>chests (commits)</span></div><div><b>${today.tests}</b><span>tests passed</span></div>
    <div><b>${today.deploys}</b><span>deploys</span></div><div><b>${today.bosses}</b><span>bosses</span></div><div><b>${questPoints()}</b><span>quest points</span></div></div>
    <h3 style="margin:4px 0;font:18px 'Lilita One'">My agents today</h3>
    ${hs.length ? hs.map(([l, v]) => `<div class="hl" style="--c:${v.color}"><span class="dot"></span><b>${esc(l)}</b><span>${CLASSES[v.cls] ? CLASSES[v.cls].ic + ' ' + CLASSES[v.cls].name : ''} · ${v.hits} hits</span></div>`).join('') : '<p class="note">No heroes yet today. Connect your agents and they join as they work.</p>'}
    <p class="note">Deepest floor ever: ${save.best} · Party level ${save.level}${mode === 'demo' ? ' · This is the demo team: connect your agents to keep progress.' : ''}</p>
    <button class="big" id="tShare">Share my party's day</button>`);
  $('#tShare').onclick = share;
}
function trophyPanel() {
  $('#bTro').classList.remove('ping');
  const got = TROPHIES.filter(t => save.trophies[t[0]]).length;
  openModal(`Trophies ${got}/${TROPHIES.length}`, `<div class="tros">${TROPHIES.map(([id, ic, n, d]) => `<div class="tro ${save.trophies[id] ? 'got' : ''}"><em>${ic}</em><b>${n}</b><span>${d}</span></div>`).join('')}</div>
    <p class="note">Monsters slain: ${save.stats.kills} · Bosses: ${save.stats.bosses} · Crits: ${save.stats.crits} · Chests: ${save.stats.chests}</p>`);
}
$('#bGear').onclick = gearPanel; $('#bToday').onclick = todayPanel; $('#bTro').onclick = trophyPanel; $('#bShare').onclick = share;
$('#bRank').onclick = () => B && B.open();
$('#bConnect').onclick = () => A.open();

// ================================================================ share card (1200×630)
async function share() {
  const W = 1200, H = 630, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#2c2142'); bg.addColorStop(1, '#120d1c'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // live snapshot of the dungeon, cover-cropped into the right half
  renderer.render(scene, camera);
  const src = renderer.domElement, sw = src.width, sh = src.height, tw = 620, th = 560, s = Math.max(tw / sw, th / sh) * 1.08;
  g.save(); g.beginPath(); g.roundRect(550, 35, tw, th, 26); g.clip();
  const rg = g.createRadialGradient(860, 300, 40, 860, 300, 420); rg.addColorStop(0, '#4a3670'); rg.addColorStop(1, '#1a1428'); g.fillStyle = rg; g.fillRect(550, 35, tw, th);
  g.drawImage(src, 550 + tw / 2 - sw * s / 2, 35 + th / 2 - sh * s / 2 + 20, sw * s, sh * s); g.restore();
  g.strokeStyle = 'rgba(255,207,90,.6)'; g.lineWidth = 4; g.beginPath(); g.roundRect(550, 35, tw, th, 26); g.stroke();
  await document.fonts.load('40px "Lilita One"').catch(() => {});
  g.fillStyle = '#ffcf5a'; g.font = '62px "Lilita One", sans-serif'; g.fillText('QUEST PARTY', 48, 100);
  g.fillStyle = '#fff7e8'; g.font = '800 26px "Baloo 2", system-ui'; g.fillText('My AI agents in the dungeon today', 50, 140);
  const st = [[today.kills, 'slain'], ['F' + save.floor, 'floor'], [today.crits, 'crits'], [today.chests, 'chests'], [today.tests, 'tests passed'], [today.bosses, 'bosses']];
  st.forEach(([v, l], i) => { const x = 50 + (i % 3) * 160, y = 205 + Math.floor(i / 3) * 92; g.fillStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.roundRect(x, y - 50, 148, 80, 14); g.fill(); g.fillStyle = '#ffcf5a'; g.font = '40px "Lilita One"'; g.fillText(String(v), x + 14, y); g.fillStyle = '#cfc6dd'; g.font = '700 17px "Baloo 2", system-ui'; g.fillText(l, x + 14, y + 22); });
  const hs = Object.entries(today.heroes).sort((a, b) => b[1].hits - a[1].hits).slice(0, 4);
  g.font = '800 22px "Baloo 2", system-ui';
  (hs.length ? hs : [['demo party', { color: '#ffcf5a', cls: 'knight', hits: 0 }]]).forEach(([l, v], i) => { const y = 420 + i * 36; g.fillStyle = v.color; g.beginPath(); g.arc(62, y - 8, 10, 0, 7); g.fill(); g.fillStyle = '#fff7e8'; g.fillText(`${l}`, 82, y); g.fillStyle = '#b9b2c8'; g.fillText(`${CLASSES[v.cls] ? CLASSES[v.cls].name : ''} · ${v.hits} hits`, 300, y); });
  const pf = B && B.profile(); let rk = null; try { rk = JSON.parse(localStorage.getItem('board_rank_agent-dungeon')); } catch (e) {}
  g.fillStyle = '#ffcf5a'; g.font = '800 22px "Baloo 2", system-ui';
  g.fillText(pf && mode === 'real' ? `${flag(pf.country)} ${pf.name}${rk ? ` · #${rk} in the world today` : ''} · ${questPoints()} pts` : `${questPoints()} quest points`, 50, 590);
  g.fillStyle = '#8e88a0'; g.font = '700 18px "Baloo 2", system-ui'; g.fillText('riffcade.com', 1060, 620);
  const blob = await new Promise(r => c.toBlob(r, 'image/png')); const file = new File([blob], 'quest-party-today.png', { type: 'image/png' });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) return await navigator.share({ files: [file], title: NAME, text: `My AI agents cleared floor ${save.floor} in Quest Party today`, url: location.href.split('?')[0] }); } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Saved your party card as a PNG', 2500);
}

// ================================================================ agent events → game
function bumpCounts(h, e) { if (e.kind === 'tool' && e.cat) h.counts[e.cat] = (h.counts[e.cat] || 0) + 1; }
function reclass(h) { const c = classOf(h); if (c !== h.cls) { h.cls = c; makeHeroBody(h); updTag(h); poof(h.g.position, h.color); heroToday(h).cls = c; } }
function handle(e) {
  if (e.kind === 'end') { endFam(e); return; }
  if (e.parent) {   // subagent → familiar of its lead
    const f = getFam(e); f.last = Date.now();
    if (e.kind === 'result' && e.ok && f.parent && !forkOpen) {
      f.zap = 1; const amt = e.counted ? Math.max(1, Math.round(heroDmg(0.5))) : 0;
      if (e.counted) { today.hits++; heroToday(f.parent).hits++; }
      shoot(f.g.position.clone(), hitPoint(), 'zap', f.parent.color, () => amt ? damage(amt, { color: f.parent.color, small: true }) : flashMon());
    }
    if (e.kind === 'tokens' && e.counted) addMana(e.tokens);
    return;
  }
  const h = getHero(e); h.last = Date.now();
  if (e.kind === 'tool') { bumpCounts(h, e); reclass(h); if (h.resting) setRest(h, false); h.ready = 1; if (e.cat === 'delegate') { sparkle(h.g.position.clone().setY(0.3), h.color, 10); } return; }
  if (e.kind === 'prompt') { if (h.resting) setRest(h, false); num(h.g.position.clone().setY(2.3), '!', 'info', '#ffcf5a'); return; }
  if (e.kind === 'tokens') { if (e.counted) addMana(e.tokens); return; }
  if (e.kind === 'think') { h.think = 1; return; }
  if (e.kind === 'done') {
    setRest(h, true); sfx.done(); save.stats.rests++; checkTrophies();
    if (!A.demo) toast(`✋ ${h.label} is waiting for you at the campfire`, 3500); return;
  }
  if (e.kind === 'result') {
    if (h.resting) setRest(h, false);
    if (forkOpen || descending || !mon || mon.dead || mon.falling) { if (e.ok) h.cheer = 0.8; if (e.ok && e.counted) { today.hits++; heroToday(h).hits++; } return; }
    if (!e.ok) { monsterHits(h, e.counted, e.cat === 'test'); return; }
    if (e.cat === 'test') return ultimate(h, e.counted);
    if (e.cat === 'commit') { attack(h, e.counted); return chest(h, e.counted); }
    if (e.cat === 'deploy') return deployClear(h, e.counted);
    attack(h, e.counted);
  }
}
function addMana(t) { const was = save.mana; save.mana = Math.min(100, save.mana + t / 320); if (t) today.tokens += t; if (was < 100 && save.mana >= 100) { banner('MANA FULL', 'Ultimate ready: press 4', 'purple'); } hud(); persist(); }
// first batch after connecting: no replay. Seat live heroes, pay counted work once as "while you were away".
function backfill(list) {
  const per = new Map();
  for (const e of list) {
    const id = e.parent || e.agent;
    if (!per.has(id)) per.set(id, { e, counts: {}, last: null, live: false, fams: new Map() });
    const p = per.get(id); if (e.kind === 'tool' && !e.parent) p.counts[e.cat] = (p.counts[e.cat] || 0) + 1;
    if (e.live) { p.live = true; if (!e.parent) { p.last = e; p.e = e; } else if (e.kind === 'end') p.fams.delete(e.agent); else p.fams.set(e.agent, e); }
  }
  let ok = 0, fails = 0, tests = 0, commits = 0, deploys = 0, tok = 0;
  const td = dayKey();
  for (const e of list) {
    if (!e.counted) continue;
    if (e.kind === 'tokens') { tok += e.tokens || 0; if (dayKey(e.t) === td) today.tokens += e.tokens || 0; }
    if (e.kind !== 'result') continue;
    if (!e.ok) { fails++; if (dayKey(e.t) === td) today.fails++; continue; }
    if (e.cat === 'test') tests++; else if (e.cat === 'commit') commits++; else if (e.cat === 'deploy') deploys++; else ok++;
    if (dayKey(e.t) === td) { today.hits++; const lab = e.label || 'agent'; (today.heroes[lab] || (today.heroes[lab] = { cls: 'knight', color: HCOL[hash(e.parent || e.agent) % HCOL.length], hits: 0 })).hits++; }
  }
  for (const [id, p] of per) {
    if (!p.live || !p.e || p.e.parent) continue;
    const h = getHero({ ...p.e, agent: id }, false); h.counts = p.counts; reclass(h);
    heroToday(h).cls = h.cls; heroToday(h).color = h.color;
    if (p.last && p.last.kind === 'done') setRest(h, true);
    for (const fe of p.fams.values()) getFam(fe);
  }
  if (ok + tests + commits + deploys + fails + tok === 0) { layoutParty(); return; }
  // offline progress: simulate the damage against the floors (capped, no fork choices)
  save.mana = Math.min(100, save.mana + tok / 320);
  let dmg = ok * heroDmg(1, false) + tests * heroDmg(5, false), kills = 0, floors = 0, gold = 0, items = 0;
  save.stats.tests += tests; today.tests += tests; save.stats.deploys += deploys; today.deploys += deploys; save.stats.chests += commits; today.chests += commits;
  const step = () => { save.room = 0; save.floor++; floors++; today.floors++; save.best = Math.max(save.best, save.floor); save.stats.best = save.best; };
  for (let d = 0; d < Math.min(deploys, 3); d++) { gold += Math.round((4 + save.floor * 1.6) * 3); step(); }
  let hp = save.mhp || monsterMax(save.floor, isBossFloor(save.floor), save.elite && save.room === 0);
  while (dmg >= hp && floors < 5) {
    dmg -= hp; kills++; gold += Math.round((4 + save.floor * 1.6) * (isBossFloor(save.floor) ? 8 : 1)); gainXpQuiet(Math.round(hp / 4));
    if (isBossFloor(save.floor)) { save.stats.bosses++; today.bosses++; }
    save.room++; save.elite = false;
    if (save.room >= perFloor(save.floor)) step();
    hp = monsterMax(save.floor, isBossFloor(save.floor), false);
  }
  save.mhp = Math.max(1, hp - Math.min(dmg, hp - 1));
  for (let i = 0; i < commits; i++) { gold += Math.round(15 + save.floor * 4); if (Math.random() < 0.4 && items < 3) { addLoot(makeItem(0, 0.05)); items++; } }
  gold = Math.round(gold * (1 + gearStat('gold')));
  save.gold += gold; save.stats.kills += kills; today.kills += kills;
  buildRoom(); spawnMonster(true); checkTrophies(); persist(); hud(); submitScore(); layoutParty();
  const lines = [[ok + tests, 'attacks landed'], [kills, 'monsters slain'], [floors, 'floors descended'], [commits, 'chests opened'], [tests, 'test ultimates'], [deploys, 'deploys'], [gold, 'gold found'], [items, 'items found']].filter(x => x[0]);
  setTimeout(() => openModal('While you were away', `<p class="note" style="margin:0 0 8px">Your agents kept fighting. Their work since your last visit:</p><div class="grid2">${lines.map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}</div>${fails ? `<p class="note">${fails} failed steps let monsters hit back.</p>` : ''}<button class="big" id="awayOk">To battle!</button>`), 600);
  setTimeout(() => { const b = $('#awayOk'); if (b) b.onclick = closeModal; }, 700);
}
function gainXpQuiet(x) { save.xp += x; while (save.xp >= xpNeed(save.level)) { save.xp -= xpNeed(save.level); save.level++; } }
function switchMode(m) {
  if (m === mode) return;
  // the demo team never touches the real save
  if (mode === 'real') { S.set('save', save); S.set('today', today); }
  mode = m;
  for (const h of [...heroes.values()]) { scene.remove(h.g); h.tag.remove(); for (const f of h.fams.values()) { scene.remove(f.g); f.tag.remove(); } }
  heroes.clear();
  if (m === 'demo') { save = demoSave(); today = freshToday(); }
  else { save = Object.assign(freshSave(), S.get('save', null) || {}); save.stats = Object.assign(freshSave().stats, save.stats || {}); today = S.get('today', null); if (!today || today.d !== dayKey()) today = freshToday(); }
  forkOpen = false; $('#fork').hidden = true; $('#bottom').style.visibility = ''; $('#mbar').style.display = '';
  buildRoom(); spawnMonster(true); hud(); layoutParty();
}

let B = null;
const A = agents({
  game: 'agent-dungeon', title: 'QUEST PARTY', accent: '#ffcf5a', demoAgents: 4,
  tagline: 'Your AI agents are a party of dungeon heroes.',
  about: 'Each Claude Code or Codex session becomes a hero: edits make a Knight, reads a Mage, commands a Rogue, web a Ranger, delegating a Summoner. Finished steps are attacks, failures let the monster hit back, passing tests fire ultimates, commits drop chests and deploys clear the floor. You lead: time the abilities, pick the path, equip the loot.',
  onEvents(list, info) {
    B && B.onAgentEvents(list);
    switchMode(info.demo ? 'demo' : 'real');
    if (today.d !== dayKey()) { today = freshToday(); lastSubmitted = 0; }
    if (info.backfill) { backfill(list); return; }
    for (const e of list) { if (!e.live) continue; try { handle(e); } catch (err) { console.warn(err); } }
    checkTrophies(); persist(); submitScore();
  },
});
window.__A = A;
B = board({ game: 'agent-dungeon', label: 'Quest Points', A });
window.__B = B;
B.onRival((evs, r) => { rivalSync(); for (const e of evs) { try { rvEvent(e, r); } catch (er) { console.warn(er); } } });
window.__qp = () => ({ mode, save, today, heroes: heroes.size });

// ================================================================ the rival's party (live duel)
// In a live duel the rival's agents are a second party, one hero per agent (callsign tags, the rival's team colour,
// silver when simulated), fighting through their own dungeon in a chamber you watch through a scrying window.
// Their finished steps are their hits, passed tests their ultimates, commits their chests, deploys clear their floor,
// failures let their monster hit back. Their floor races yours.
const ROFF = new THREE.Vector3(0, 420, 0), RH2 = 3.5;
const rcam = new THREE.PerspectiveCamera(30, 1.6, 0.1, 200);
const rat = (s, t, y = 0.17) => at(s, t, y).add(ROFF);
const RSLOTS = [[-0.9, -0.85], [-0.9, 0.85], [-2.1, -1.7], [-2.1, 0], [-2.1, 1.7]];
const RCLS = ['knight', 'mage', 'rogue', 'ranger', 'summoner'];
const RVERB = { edit: 'edits', read: 'reads the code', run: 'runs a step', test: 'passes the tests', commit: 'commits', deploy: 'deploys', web: 'searches the web', delegate: 'sends a helper', other: 'finishes a step' };
const RV = { r: null, key: '', on: false, room: null, heroes: new Map(), mon: null, st: null, ticker: [], light: null, flames: [] };
const rvEl = document.createElement('div'); rvEl.id = 'rv'; rvEl.hidden = true;
rvEl.innerHTML = `<div class="rvh"><span class="rvn"></span><span class="rvs"></span></div><div class="rvv" id="rvView"><div class="rvt"></div><div class="rvo">😴 offline · their party rests</div></div><div class="rvm"><span class="mn"></span><span class="hp"><i></i></span></div><div class="rvk"></div><div class="rvr"></div>`;
document.body.appendChild(rvEl);
const rvView = rvEl.querySelector('.rvv'), rvTags = rvEl.querySelector('.rvt');
const rvLoad = key => { try { const j = JSON.parse(localStorage.getItem('questparty_rival')); if (j && j.key === key) return j; } catch (e) {} const real = mode === 'real' ? save : (S.get('save', null) || {}); return { key, floor: Math.max(1, real.floor || 1), room: 0, hp: null, kills: 0 }; };
const rvSave = () => { if (RV.st) try { localStorage.setItem('questparty_rival', JSON.stringify(RV.st)); } catch (e) {} };
const rvCol = () => RV.r ? (RV.r.sim ? '#c9ced8' : RV.r.color) : '#c9ced8';
function rvBuildRoom() {
  if (RV.room) scene.remove(RV.room);
  const g = new THREE.Group(); g.position.copy(ROFF); RV.room = g; scene.add(g); RV.flames = [];
  const th = THEMES[Math.floor((RV.st.floor - 1) / 5) % THEMES.length], r = rng(RV.st.floor * 131 + 7), pick = a => a[(r() * a.length) | 0], col = rvCol();
  const base = mesh(rounded(RH2 * 2 + 0.6, 1.4, RH2 * 2 + 0.6, 0.2), M(th.base), 0, -0.85, 0); g.add(base);
  g.add(mesh(rounded(RH2 * 2 + 0.9, 0.26, RH2 * 2 + 0.9, 0.1), M(col), 0, -0.2, 0, false));       // a rim in the rival's team colour
  const n = (RH2 * 2) ** 2, tiles = new THREE.InstancedMesh(tileGeo, M('#ffffff'), n), m4 = new THREE.Matrix4(), c = new THREE.Color(); let k = 0;
  for (let x = -RH2; x < RH2; x++) for (let z = -RH2; z < RH2; z++) { m4.makeTranslation(x + 0.5, -0.02 + (r() - 0.5) * 0.06, z + 0.5); tiles.setMatrixAt(k, m4); tiles.setColorAt(k++, c.set(pick(th.floor))); }
  g.add(tiles);
  const bricks = new THREE.InstancedMesh(brickGeo, M('#ffffff'), 120), q = new THREE.Quaternion(), yA = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(1, 1, 1); k = 0;
  for (let row = 0; row < 5; row++) { const y = 0.4 + row * 0.5, off = row % 2 ? 0.5 : 0;
    for (let i = -RH2 - 1; i < RH2; i++) { const x = i + off + 0.5; if (x < -RH2 - 0.2 || x > RH2 + 0.2) continue;
      m4.compose(new THREE.Vector3(x, y, -RH2 - 0.3), q.identity(), sc); bricks.setMatrixAt(k, m4); bricks.setColorAt(k++, c.set(pick(th.wall)));
      m4.compose(new THREE.Vector3(-RH2 - 0.3, y, x), q.setFromAxisAngle(yA, Math.PI / 2), sc); bricks.setMatrixAt(k, m4); bricks.setColorAt(k++, c.set(pick(th.wall))); } }
  bricks.count = k; g.add(bricks);
  for (const x of [-1.6, 1.4]) { const b = mesh(new THREE.BoxGeometry(0.8, 1.25, 0.05), M(col), x, 1.75, -RH2 + 0.02); g.add(b); const t = mesh(new THREE.ConeGeometry(0.42, 0.35, 3), b.material, x, 0.98, -RH2 + 0.02); t.rotation.set(0, 0, Math.PI); g.add(t); }
  for (const [x, z] of [[-RH2 + 0.1, 0.8], [0.1, -RH2 + 0.1]]) { const f = mesh(new THREE.ConeGeometry(0.14, 0.4, 6), new THREE.MeshBasicMaterial({ color: th.torch }), x, 2.1, z, false); g.add(f); RV.flames.push(f); }
  const L = new THREE.PointLight(th.torch, 7, 11, 1.3); L.position.set(-1, 2.6, -1); g.add(L); RV.light = L;
  const D = new THREE.DirectionalLight('#ffe7c9', 1.1); D.position.set(4, 9, 6); D.target.position.set(0, 0, 0); g.add(D, D.target);
}
function rvSpawn(drop = true) {
  if (RV.mon) scene.remove(RV.mon.g);
  const st = RV.st, boss = isBossFloor(st.floor);
  let type, name;
  if (boss) [type, name] = BOSSES[(Math.floor(st.floor / 5) - 1) % BOSSES.length];
  else { const r = rng(st.floor * 53 + st.room * 11 + 5); type = MTYPES[(r() * MTYPES.length) | 0]; name = MNAMES[type]; }
  const g = buildMonster(type, false), sc = boss ? 1.45 : 1.05, max = boss ? 10 : 4;
  g.scale.setScalar(sc); g.position.copy(rat(1.75, 0)); g.lookAt(rat(-3, 0)); if (drop) g.position.y += 6;
  scene.add(g);
  RV.mon = { g, type, name, boss, max, hp: st.hp != null ? Math.min(st.hp, max) : max, sc, flash: 0, sq: 0, lunge: 0, lungeAt: null, dead: false, falling: drop, vy: 0 };
  st.hp = RV.mon.hp; rvSave(); rvHud();
}
function rvHero(a) {
  let h = RV.heroes.get(a.k);
  if (h) return h;
  const cls = RCLS[hash(a.k + a.name) % RCLS.length];
  h = { k: a.k, name: a.name, src: a.src, cls, counts: {}, swing: 0, cast: 0, cheer: 0, flash: 0, sq: 0, drop: 1, state: a.state, slot: 0, busy: false };
  h.g = buildHeroMesh(rvCol(), cls); h.g.scale.setScalar(0.82); scene.add(h.g);
  const tg = document.createElement('div'); tg.className = 'tag rvtag'; tg.style.setProperty('--c', rvCol());
  tg.innerHTML = `<div class="wait">✋ waiting</div><div class="nm"><span class="ic"></span><span class="lb"></span><span class="cls"></span></div>`;
  tg.querySelector('.lb').textContent = a.name; tg.querySelector('.ic').textContent = CLASSES[cls].ic; tg.querySelector('.cls').textContent = a.src === 'codex' ? 'Codex' : 'Claude';
  rvTags.appendChild(tg); h.tag = tg;
  h.home = rat(RSLOTS[0][0], RSLOTS[0][1]); h.g.position.copy(h.home); h.g.position.y += 4;
  RV.heroes.set(a.k, h);
  return h;
}
function rvClear() {
  for (const h of RV.heroes.values()) { scene.remove(h.g); h.tag.remove(); }
  RV.heroes.clear(); if (RV.mon) scene.remove(RV.mon.g); RV.mon = null; if (RV.room) scene.remove(RV.room); RV.room = null;
}
function rivalSync() {
  const r = B && B.rival ? B.rival() : null;
  RV.r = r;
  if (!r) { if (RV.on) { RV.on = false; rvClear(); rvEl.hidden = true; stage.autoRender = true; document.body.classList.remove('rv-on'); } return; }
  const colChanged = RV.on && RV.colKey !== (r.sim ? 'sim' : r.color);
  if (!RV.on || RV.key !== r.key || colChanged) {
    rvClear(); RV.on = true; RV.key = r.key; RV.st = rvLoad(r.key); RV.ticker = []; RV.colKey = r.sim ? 'sim' : r.color;
    rvBuildRoom(); rvSpawn(false); rvEl.hidden = false; stage.autoRender = false; document.body.classList.add('rv-on');
  }
  rvEl.style.setProperty('--rc', rvCol());
  const seen = new Set();
  (r.agents || []).slice(0, 5).forEach((a, i) => { seen.add(a.k); const h = rvHero(a); h.slot = i; h.state = a.state; h.name = a.name; h.tag.classList.toggle('waiting', a.state === 'waiting' && r.online !== false); });
  for (const [k, h] of RV.heroes) if (!seen.has(k)) { poof(h.g.position, rvCol()); scene.remove(h.g); h.tag.remove(); RV.heroes.delete(k); }
  rvView.classList.toggle('off', !r.sim && !r.online);
  rvHud();
}
function rvHud() {
  const r = RV.r; if (!r || !RV.st) return;
  const ags = r.agents || [], f = RV.st.floor, me = save.floor;
  rvEl.querySelector('.rvn').textContent = `${r.flag} ${r.name}'s party`;
  rvEl.querySelector('.rvs').textContent = r.sim ? `${ags.length} heroes · simulated` : r.online ? `🟢 ${ags.filter(a => a.state === 'working').length}/${ags.length} fighting` : '😴 offline';
  if (RV.mon) { rvEl.querySelector('.mn').textContent = `FLOOR ${f} · ${RV.mon.boss ? '👑 ' : ''}${RV.mon.name}`; rvEl.querySelector('.hp i').style.width = clamp(RV.mon.hp / RV.mon.max, 0, 1) * 100 + '%'; }
  const lead = f > me ? `${r.name} leads by ${f - me} floor${f - me > 1 ? 's' : ''}` : f < me ? `you lead by ${me - f} floor${me - f > 1 ? 's' : ''}` : 'neck and neck';
  rvEl.querySelector('.rvr').innerHTML = `<b>You F${me}</b><i></i><b style="color:var(--rc)">F${f} ${r.flag}</b><small>${lead} · ⚡ ${r.myScore}–${r.score}</small>`;
  const tk = RV.ticker[0];
  rvEl.querySelector('.rvk').innerHTML = tk && Date.now() - tk.t < 20000 ? `<span class="${tk.bad ? 'bad' : ''}"></span>` : '';
  if (tk && Date.now() - tk.t < 20000) rvEl.querySelector('.rvk span').textContent = tk.s;
}
function rvSay(s, bad) { RV.ticker.unshift({ s, bad, t: Date.now() }); RV.ticker.splice(4); rvHud(); }
const _p = new THREE.Vector3();
function rvScr(p) { const rc = rvView.getBoundingClientRect(); _p.copy(p).project(rcam); return { x: (_p.x + 1) / 2 * rc.width, y: (1 - _p.y) / 2 * rc.height, ok: _p.z < 1 }; }
function rnum(pos, text, color = '#fff', cls = '') {
  const s = rvScr(pos); const d = document.createElement('div'); d.className = 'num small ' + cls; d.textContent = text; d.style.color = color;
  d.style.left = s.x + (Math.random() - 0.5) * 20 + 'px'; d.style.top = s.y + 'px'; rvTags.appendChild(d); setTimeout(() => d.remove(), 1000);
}
const rvHit = () => RV.mon ? RV.mon.g.position.clone().setY(RV.mon.g.position.y + 0.95 * RV.mon.sc) : rat(1.75, 0, 1);
function rvDamage(n, color, big) {
  const m = RV.mon; if (!m || m.dead || m.falling) return;
  m.hp = Math.max(0, m.hp - n); m.flash = 1; m.sq = big ? 1.3 : 0.7; RV.st.hp = m.hp;
  rnum(rvHit(), big ? `✦${n}!` : `-${n}`, big ? '#fff' : color, big ? 'ult' : '');
  burst(scene, rvHit(), [color, '#ffffff'], big ? 20 : 6, { speed: big ? 0.13 : 0.08, up: 0.05, size: big ? 0.8 : 0.5, gravity: 0.004 });
  if (m.hp <= 0) rvKill(); rvSave(); rvHud();
}
function rvKill() {
  const m = RV.mon, st = RV.st, r = RV.r; m.dead = true;
  tween(0.45, p => { m.g.scale.setScalar(m.sc * (1 + p * 0.3) * (1 - p)); m.g.rotation.y += 0.3; }, () => scene.remove(m.g));
  burst(scene, rvHit(), ['#ffcf5a', '#ffffff', rvCol()], 24, { speed: 0.13, up: 0.1, size: 0.7 });
  st.kills++; st.room++; st.hp = null;
  for (const h of RV.heroes.values()) h.cheer = 1;
  if (m.boss && r) { toast(`👑 ${r.flag} ${r.name}'s party defeated ${m.name}!`, 3500); rvSay(`${r.name}'s party defeated ${m.name}!`); }
  if (st.room >= perFloor(st.floor)) wait(0.9, rvDescend); else wait(0.8, () => rvSpawn(true));
  rvSave();
}
function rvDescend(byDeploy) {
  const st = RV.st, r = RV.r; if (!r) return;
  st.floor++; st.room = 0; st.hp = null; rvSave();
  rvBuildRoom(); rvSpawn(true);
  for (const h of RV.heroes.values()) { h.drop = 1; h.g.position.y += 4; }
  const me = save.floor, f = st.floor;
  rvSay(`${r.name}'s party descends to floor ${f}${byDeploy ? ' (deploy!)' : ''}`);
  toast(`⤵ ${r.flag} ${r.name}'s party reached floor ${f}${f > me ? `, ahead of you (F${me})` : f === me ? ', level with you' : ` (you: F${me})`}`, 3500);
  rvHud();
}
// one of the rival's agents finished a step
function rvEvent(e, r) {
  const h = RV.heroes.get(e.agent.k); if (!h) return;
  const m = RV.mon, col = rvCol(), who = h.name;
  h.counts[e.cat] = (h.counts[e.cat] || 0) + 1;
  if (!e.ok) {
    rvSay(`${who} hit an error, ${m && !m.dead ? m.name : 'the monster'} strikes back`, true);
    if (m && !m.dead && !m.falling) { m.lunge = 1; m.lungeAt = h; wait(0.18, () => { h.flash = 1; h.sq = 1; rnum(h.g.position.clone().setY(h.g.position.y + 2), 'OUCH', '#ff7070', 'hurt'); }); }
    return;
  }
  if (e.cat === 'deploy') { rvSay(`${who} deploys: the whole floor is cleared!`); toast(`🚀 ${r.flag} ${r.name}'s ${who} deployed and cleared floor ${RV.st.floor}`, 3000); if (m && !m.dead) { h.cast = 1; shoot(h.g.position.clone().setY(h.g.position.y + 1.8), rvHit(), 'big', '#7cc8ff', () => { if (RV.mon && !RV.mon.dead) { RV.mon.dead = true; scene.remove(RV.mon.g); } burst(scene, rvHit(), ['#7cc8ff', '#ffffff'], 24, { speed: 0.14, up: 0.1, size: 0.8 }); wait(0.5, () => rvDescend(true)); }); } return; }
  if (!m || m.dead || m.falling) { h.cheer = 0.8; return; }
  if (e.cat === 'test') {
    rvSay(`${who} passes the tests: ULTIMATE!`); h.cheer = 0.6;
    const p0 = h.g.position.clone().setY(h.g.position.y + 1.6);
    h.busy = true; tween(0.3, p => { h.g.position.y = h.home.y + Math.sin(p * Math.PI) * 1.3; h.g.rotation.y += 0.5; }, () => { h.busy = false; h.g.position.y = h.home.y; }); wait(0.3, () => shoot(p0, rvHit(), 'big', col === '#c9ced8' ? '#ff9cf0' : col, () => rvDamage(3, col, true)));
    return;
  }
  if (e.cat === 'commit') {
    rvSay(`${who} commits: a treasure chest!`);
    const cp = rat(-0.2 + (Math.random() - 0.5), 1.4, 0.6); sparkle(cp, '#ffe14d', 18); rnum(cp, '🧰 +loot', '#ffcf5a', 'gold');
  } else if (Math.random() < 0.35) rvSay(`${who} ${RVERB[e.cat] || RVERB.other} and hits ${m.name}`);
  // the hit itself, class-flavoured
  const home = h.home.clone(), tgt = rvHit();
  if (h.cls === 'knight' || h.cls === 'rogue') {
    if (h.busy) return rvDamage(1, col);
    h.busy = true; const to = rat(1.75 - 1.05 * m.sc, h.cls === 'rogue' ? 0.5 : 0);
    tween(0.16, p => h.g.position.lerpVectors(home, to, p * p), () => { h.swing = 1; rvDamage(1, col); tween(0.22, p => h.g.position.lerpVectors(to, home, p), () => { h.busy = false; }); });
  } else { h.cast = 1; shoot(h.g.position.clone().setY(h.g.position.y + 1.4), tgt, h.cls === 'ranger' ? 'arrow' : 'orb', h.cls === 'mage' ? '#6fe3ff' : col, () => rvDamage(1, col)); }
}
// per frame: animate the rival party and draw their chamber into the scrying window
function rvFrame(sec, t) {
  if (!RV.on) return;
  const r = RV.r, off = r && !r.sim && !r.online, mp = RV.mon ? RV.mon.g.position : rat(1.75, 0);
  for (const f of RV.flames) f.scale.set(1, 0.85 + Math.sin(t * 11 + f.id) * 0.1 + Math.random() * 0.08, 1);
  for (const h of RV.heroes.values()) {
    const g = h.g, s = RSLOTS[h.slot] || RSLOTS[0]; h.home = rat(s[0], s[1]);
    if (h.drop) { g.position.y = Math.max(h.home.y, g.position.y - 0.25 * sec * 60); if (g.position.y <= h.home.y + 0.001) h.drop = 0; }
    else if (!h.busy) { g.position.x = lerp(g.position.x, h.home.x, 0.12); g.position.z = lerp(g.position.z, h.home.z, 0.12); g.position.y = h.home.y; }
    if (!g.position.lengthSq() || Math.abs(g.position.y - ROFF.y) > 50) g.position.copy(h.home);
    const ang = Math.atan2(mp.x - g.position.x, mp.z - g.position.z); g.rotation.y = lerp(g.rotation.y, ang, 0.15);
    h.swing = Math.max(0, h.swing - sec * 4); h.cast = Math.max(0, h.cast - sec * 3); h.cheer = Math.max(0, h.cheer - sec); h.flash = Math.max(0, h.flash - sec * 4); h.sq = Math.max(0, h.sq - sec * 3);
    const waiting = h.state === 'waiting' && !off, resting = off || h.state === 'idle';
    g.body.position.y = resting ? -0.18 : Math.sin(t * 5 + hash(h.k)) * 0.04 + (h.cheer > 0 ? Math.abs(Math.sin(h.cheer * 10)) * 0.4 : 0);
    g.body.scale.set(1.3 * (1 + h.sq * 0.25), 1.3 * (1 - h.sq * 0.25), 1.3 * (1 + h.sq * 0.25));
    g.armR.rotation.x = waiting ? -2.8 + Math.sin(t * 8) * 0.4 : -h.swing * 2.4 - h.cast * 1.6 + (h.cheer > 0 ? -2.8 : 0);
    g.armL.rotation.x = h.cheer > 0 ? -2.8 : h.cls === 'ranger' ? -1.4 : -0.3;
    for (const mm of g.mats) { if (!mm.userData.e0) { mm.userData.e0 = mm.emissive.clone(); mm.userData.ei = mm.emissiveIntensity; } mm.emissive.copy(mm.userData.e0).lerp(new THREE.Color('#ff2a2a'), h.flash); mm.emissiveIntensity = h.flash > 0 ? 1 : mm.userData.ei; }
    g.ring.material.opacity = 0.45 + Math.sin(t * 3) * 0.15;
    h.sp = rvScr(g.position.clone().setY(g.position.y + (resting ? 1.9 : 2.25)));
  }
  // name tags: nudge overlapping ones upward so every callsign stays readable
  const placed = [];
  for (const h of [...RV.heroes.values()].sort((a, b) => b.sp.y - a.sp.y)) {
    if (!h.tw || Math.random() < 0.01) { h.tw = h.tag.offsetWidth || 70; h.th = 20; }
    let y = h.sp.y;
    for (let pass = 0; pass < 4; pass++) { let hit = false; for (const o of placed) if (Math.abs(o.x - h.sp.x) < (o.w + h.tw) / 2 + 2 && Math.abs(o.y - y) < h.th + 1) { y = o.y - h.th - 1; hit = true; } if (!hit) break; }
    placed.push({ x: h.sp.x, y, w: h.tw }); h.tag.style.left = h.sp.x + 'px'; h.tag.style.top = y + 'px';
  }
  const m = RV.mon;
  if (m && !m.dead) {
    const g = m.g, base = rat(1.75, 0);
    if (m.falling) { m.vy += 0.02 * sec * 60; g.position.y -= m.vy * sec * 60; if (g.position.y <= base.y) { g.position.y = base.y; m.falling = false; m.vy = 0; m.sq = 1.1; burst(scene, base.clone().setY(base.y + 0.2), '#d8cbb0', 8, { speed: 0.08, up: 0.03, size: 0.6 }); } }
    m.sq = Math.max(0, m.sq - sec * 4); m.flash = Math.max(0, m.flash - sec * 9); m.lunge = Math.max(0, m.lunge - sec * 3);
    const idle = Math.sin(t * 2.6); g.body.scale.set(1 + m.sq * 0.3, 1 - m.sq * 0.3 + idle * 0.02, 1 + m.sq * 0.3);
    if (!m.falling) { const to = m.lungeAt && m.lungeAt.g ? m.lungeAt.g.position : rat(-2, 0); const dir = new THREE.Vector3().subVectors(to, base).setY(0).normalize(), l = Math.sin(m.lunge * Math.PI) * 1.1; g.position.x = base.x + dir.x * l; g.position.z = base.z + dir.z * l; }
    if (g.wings) { g.wings[0].rotation.y = Math.sin(t * 14) * 0.8; g.wings[1].rotation.y = -Math.sin(t * 14) * 0.8; }
    for (const mm of g.mats) { mm.emissive.copy(mm.userData.e0).lerp(new THREE.Color('#ffffff'), m.flash * 0.7); mm.emissiveIntensity = m.flash > 0 ? Math.max(mm.userData.ei, m.flash * 0.45) : mm.userData.ei; }
  }
  // render: the main dungeon, then the rival's chamber into the window
  renderer.setScissorTest(false); renderer.setViewport(0, 0, innerWidth, innerHeight);
  renderer.render(scene, camera);
  const rc = rvView.getBoundingClientRect(); if (rc.width < 10 || rvEl.hidden) return;
  const asp = rc.width / rc.height; if (Math.abs(rcam.aspect - asp) > 0.001) { rcam.aspect = asp; rcam.updateProjectionMatrix(); }
  const look = ROFF.clone().add(at(-0.2, 0.2, 0.6)); rcam.position.copy(CAMDIR).multiplyScalar(asp < 1.2 ? 17 : 13.5).add(look); rcam.lookAt(look);
  const y = innerHeight - rc.bottom;
  renderer.setScissorTest(true); renderer.setViewport(rc.left, y, rc.width, rc.height); renderer.setScissor(rc.left, y, rc.width, rc.height);
  renderer.setClearColor('#120d1c', 1); renderer.clear();
  renderer.render(scene, rcam);
  renderer.setClearColor(0x000000, 0); renderer.setScissorTest(false); renderer.setViewport(0, 0, innerWidth, innerHeight);
  if ((RV.hudT = (RV.hudT || 0) + sec) > 1) { RV.hudT = 0; rvHud(); }
}

// ================================================================ frame loop
buildRoom(); spawnMonster(true); hud();
setInterval(rivalSync, 1500); setTimeout(rivalSync, 300);
const look = new THREE.Vector3(), camBase = new THREE.Vector3();
let camDist = 20, lastSec = performance.now() / 1000, tagT = 0;
function fitCamera() {
  const asp = innerWidth / innerHeight;
  camDist = clamp(17.5 / (0.536 * asp), 27, 66);
  if (asp < 0.8) camDist *= 0.86;
}
addEventListener('resize', fitCamera); fitCamera();
loop((dt, t) => {
  const sec = dt / 60;
  // timers
  for (const k in cdLeft) cdLeft[k] = Math.max(0, cdLeft[k] - sec);
  warCry = Math.max(0, warCry - sec); shieldWall = Math.max(0, shieldWall - sec); strikeCd = Math.max(0, strikeCd - sec);
  document.querySelectorAll('#abil button').forEach(b => { const a = b.dataset.a; b.style.setProperty('--cd', CD[a] ? cdLeft[a] / CD[a] : 0); b.classList.toggle('on', (a === 'cry' && warCry > 0) || (a === 'wall' && shieldWall > 0)); });
  if (forkOpen) { if (modal.hidden && !document.querySelector('.bd-wrap:not([hidden])')) forkTimer -= sec; $('#forkT').textContent = `· auto-rest in ${Math.ceil(Math.max(0, forkTimer))}s`; if (forkTimer <= 0) choose(A.demo ? ['elite', 'rest', 'rest'][(Math.random() * 3) | 0] : 'rest'); }
  for (let i = tweens.length - 1; i >= 0; i--) { const w = tweens[i]; w.t += sec; const p = Math.min(1, w.t / w.dur); w.fn && w.fn(p); if (p >= 1) { tweens.splice(i, 1); w.done && w.done(); } }
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i]; p.t += sec; const k = Math.min(1, p.t / p.dur);
    p.m.position.lerpVectors(p.from, p.to, k); p.m.position.y += Math.sin(k * Math.PI) * p.arc;
    if (p.kind === 'arrow') { const d = new THREE.Vector3().subVectors(p.to, p.from).normalize(); p.m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d); }
    else { p.m.rotation.x += 0.3; p.m.rotation.y += 0.2; if (Math.random() < 0.5) burst(scene, p.m.position, p.color, 1, { speed: 0.01, up: 0.005, size: 0.5, gravity: 0, life: 0.5 }); }
    if (k >= 1) { scene.remove(p.m); projectiles.splice(i, 1); p.onHit && p.onHit(); }
  }
  // torches and campfire flicker
  for (const tc of torches) { const f = 0.85 + Math.sin(t * 11 + tc.ph) * 0.08 + Math.sin(t * 23 + tc.ph * 2) * 0.06 + (Math.random() - 0.5) * 0.08; tc.L.intensity = 9 * f; tc.flame.scale.set(1, f * 1.1, 1); tc.core.scale.set(1, f, 1); }
  if (campfire) { campfire.boost = Math.max(0, campfire.boost - sec); const f = 0.85 + Math.sin(t * 9) * 0.1 + Math.random() * 0.08 + campfire.boost * 0.4; campfire.fl.intensity = 6 * f; campfire.ff.scale.set(1 + campfire.boost * 0.3, f * (1 + campfire.boost * 0.6), 1 + campfire.boost * 0.3); campfire.fc.scale.set(1, f, 1); if (Math.random() < 0.06 + campfire.boost * 0.2) burst(scene, CAMP.clone().setY(1.0), ['#ffb347', '#ff7a2a'], 1, { speed: 0.01, up: 0.04, size: 0.4, gravity: -0.001, life: 0.8 }); }
  for (const d of doors) { const o = d.open ? 1 : 0; d.glow.material.opacity = lerp(d.glow.material.opacity, o * 0.55 + (o ? Math.sin(t * 4) * 0.12 : 0), 0.1); d.light.intensity = lerp(d.light.intensity, o * 6, 0.1); d.dl.rotation.y = lerp(d.dl.rotation.y, -o * 1.2, 0.08); d.dr.rotation.y = lerp(d.dr.rotation.y, o * 1.2, 0.08); }
  // heroes
  const mp = mon ? mon.g.position : MON_POS;
  for (const h of heroes.values()) {
    const g = h.g; if (!g) continue;
    if (!h.busy && h.q.length) { h.busy = true; const fn = h.q.shift(); fn(() => { h.busy = false; }); }
    const home = homeOf(h);
    if (h.drop) { g.position.y = Math.max(home.y, g.position.y - 0.25 * dt); if (g.position.y <= home.y + 0.001) { h.drop = 0; h.sq = 0.8; burst(scene, home.clone().setY(0.3), '#d8cbb0', 6, { speed: 0.06, up: 0.02, size: 0.5 }); } }
    else if (!h.busy) { g.position.x = lerp(g.position.x, home.x, 0.08 * dt); g.position.z = lerp(g.position.z, home.z, 0.08 * dt); g.position.y = home.y; }
    const target = h.resting ? CAMP : mp.clone().addScaledVector(F, 3.5), ang = Math.atan2(target.x - g.position.x, target.z - g.position.z);
    g.rotation.y = lerp(g.rotation.y, ang, 0.15);
    h.sq = Math.max(0, h.sq - sec * 3); h.swing = Math.max(0, (h.swing || 0) - sec * 4); h.cast = Math.max(0, (h.cast || 0) - sec * 3); h.cheer = Math.max(0, (h.cheer || 0) - sec); h.flash = Math.max(0, h.flash - sec * 4); h.ready = Math.max(0, (h.ready || 0) - sec * 2); h.think = Math.max(0, (h.think || 0) - sec);
    const bob = Math.sin(t * 5 + hash(h.id)) * 0.04;
    g.body.position.y = h.resting ? -0.18 : bob + (h.cheer > 0 ? Math.abs(Math.sin(h.cheer * 10)) * 0.4 : 0);
    g.body.scale.set(1.3 * (1 + h.sq * 0.25), 1.3 * (1 - h.sq * 0.25 + h.ready * 0.06), 1.3 * (1 + h.sq * 0.25));
    g.armR.rotation.x = h.resting ? -2.6 + Math.sin(t * 8) * 0.5 : -h.swing * 2.4 + h.cast * -1.6 + (h.cheer > 0 ? -2.8 : 0) - h.ready * 0.4;
    g.armR.rotation.z = h.resting ? 0.4 : 0;
    g.armL.rotation.x = h.cheer > 0 ? -2.8 : h.cls === 'ranger' ? -1.4 - h.cast * 0.3 : -0.3;
    g.rotation.z = h.ko ? lerp(g.rotation.z, Math.PI / 2 * 0.95, 0.1) : lerp(g.rotation.z, 0, 0.2);
    if (h.ko) { h.koT -= sec; if (h.koT <= 0) { h.ko = 0; h.hp = h.maxHp * 0.4; updTag(h); num(g.position.clone().setY(2), 'BACK UP!', 'info', '#7be08f'); } }
    if (h.resting) h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.02 * sec);
    for (const m of g.mats) { if (!m.userData.e0) { m.userData.e0 = m.emissive.clone(); m.userData.ei = m.emissiveIntensity; } m.emissive.copy(m.userData.e0).lerp(new THREE.Color(h.flash > 0 ? '#ff2a2a' : warCry > 0 ? '#ffb020' : '#000'), h.flash > 0 ? h.flash : warCry > 0 ? 0.25 : 0); if (h.flash > 0 || warCry > 0) m.emissiveIntensity = 1; else m.emissiveIntensity = m.userData.ei; }
    g.ring.material.opacity = 0.45 + Math.sin(t * 3) * 0.15 + (shieldWall > 0 ? 0.3 : 0);
    g.ring.material.color.set(shieldWall > 0 ? '#7cc8ff' : h.color);
    if (g.orb) g.orb.rotation.y += 0.05 * dt;
    if (g.book) { g.book.position.y = 1.15 + Math.sin(t * 3) * 0.08; g.book.rotation.y += 0.02 * dt; }
    let i = 0;
    for (const f of h.fams.values()) {
      const a = t * 1.8 + f.idx * 2.1, tgtp = new THREE.Vector3(g.position.x + Math.cos(a) * 0.9, 1.7 + Math.sin(t * 4 + f.ph) * 0.15, g.position.z + Math.sin(a) * 0.9);
      f.g.position.lerp(tgtp, 0.12 * dt); f.g.rotation.y = a; f.zap = Math.max(0, f.zap - sec * 3); f.g.scale.setScalar(1 + f.zap * 0.5);
      f.g.children[1].rotation.z = 1.2 + Math.sin(t * 20) * 0.4; f.g.children[2].rotation.z = -1.2 - Math.sin(t * 20) * 0.4; i++;
    }
    if (Date.now() - h.last > 30 * 60e3 && !A.demo) removeHero(h);
  }
  if (A.demo) for (const h of heroes.values()) if (h.resting && Date.now() - h.last > 9000) setRest(h, false);
  // monster
  if (mon) {
    const g = mon.g;
    if (mon.falling) { mon.vy += 0.02 * dt; g.position.y -= mon.vy * dt; if (g.position.y <= MON_POS.y) { g.position.y = MON_POS.y; mon.falling = false; mon.vy = 0; mon.sq = 1.2; shake = mon.boss ? 0.6 : 0.25; burst(scene, MON_POS.clone().setY(0.3), '#d8cbb0', mon.boss ? 24 : 10, { speed: 0.1, up: 0.03, size: 0.7 }); } }
    if (!mon.dead) {
      mon.sq = Math.max(0, mon.sq - sec * 4); mon.flash = Math.max(0, mon.flash - sec * 9);
      const idle = Math.sin(t * (mon.type === 'slime' || mon.type === 'slimeking' ? 4 : 2.5));
      const s = mon.sc, isSlime = /slime/.test(mon.type);
      g.body.scale.set(1 + mon.sq * 0.3 + (isSlime ? idle * 0.06 : 0), 1 - mon.sq * 0.3 - (isSlime ? idle * 0.06 : 0) + (isSlime ? 0 : idle * 0.02), 1 + mon.sq * 0.3);
      if (mon.type === 'bat' && g.wings) { g.wings[0].rotation.y = Math.sin(t * 14) * 0.8; g.wings[1].rotation.y = -Math.sin(t * 14) * 0.8; g.body.position.y = Math.sin(t * 3) * 0.15; }
      if (g.lid) g.lid.rotation.x = -0.25 - Math.abs(Math.sin(t * 3)) * 0.35 - mon.sq * 0.5;
      if (g.aura) { g.aura.rotation.z += 0.03 * dt; g.aura.material.opacity = 0.5 + Math.sin(t * 5) * 0.2; }
      mon.lunge = Math.max(0, mon.lunge - sec * 3);
      const lungeTo = mon.lungeAt && mon.lungeAt.g ? mon.lungeAt.g.position : at(-2, 0);
      const l = Math.sin(mon.lunge * Math.PI) * 1.4;
      if (!mon.falling) { const dir = new THREE.Vector3().subVectors(lungeTo, MON_POS).setY(0).normalize(); g.position.x = MON_POS.x + dir.x * l + Math.sin(mon.flash * 30) * mon.flash * 0.08; g.position.z = MON_POS.z + dir.z * l; }
      for (const m of g.mats) { m.emissive.copy(m.userData.e0).lerp(new THREE.Color(mon.flashC || '#fff'), mon.flash * 0.7); m.emissiveIntensity = mon.flash > 0 ? Math.max(m.userData.ei, mon.flash * 0.45) : m.userData.ei; }
    }
  }
  // camera: iso diorama, zoom on crits / bosses, shake on big hits
  if (zoomT > 0) { zoomT -= sec; zoom = lerp(zoom, 1, 0.12); } else zoom = lerp(zoom, 0, 0.06);
  shake = Math.max(0, shake - sec * 1.6);
  const focusP = zoomTo || hitPoint();
  look.set(0.1, 0.5, 0.5).lerp(new THREE.Vector3(focusP.x, focusP.y * 0.7, focusP.z), zoom * 0.35);
  const asp = innerWidth / innerHeight;
  if (asp < 0.8) look.y -= 0.6;
  camBase.copy(CAMDIR).multiplyScalar(camDist * (1 - zoom * zoomAmt)).add(look);
  camera.position.copy(camBase); camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake;
  camera.lookAt(look);
  stage.followLight(new THREE.Vector3(0, 0, 0));
  // world-anchored HTML
  tagT += sec;
  for (const h of heroes.values()) {
    if (h.hidden) continue;
    const s = scr(h.g.position.clone().setY(h.g.position.y + (h.resting ? 2.2 : 2.6)));
    h.tag.style.left = s.x + 'px'; h.tag.style.top = s.y + 'px';
    for (const f of h.fams.values()) { const fs = scr(f.g.position.clone().setY(f.g.position.y + 0.35)); f.tag.style.left = fs.x + 'px'; f.tag.style.top = fs.y + 'px'; }
    if (tagT > 0.25) updTag(h);
  }
  if (tagT > 0.25) tagT = 0;
  if (mon) { const s = scr(mon.g.position.clone().setY(mon.g.position.y + (mon.boss ? 4.4 : mon.type === 'bat' ? 2.4 * mon.sc : 2.3 * mon.sc))); const mb = $('#mbar'); mb.style.left = s.x + 'px'; mb.style.top = s.y + 'px'; mb.style.opacity = mon.dead ? 0 : 1; }
  rvFrame(sec, t);
});
