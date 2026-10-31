// Honk Out! deep v2 (studio lane 33, 2026-10-31): 30 hand-drawn car parks in 3 worlds (Sunny Lot, Rush Hour, Harbour Night), taxis (leave by either
// end), sleepy cars (wake after N leave), a rainbow bus (takes any rider), 4 spots in world 3, stars (spots used vs par, bumps, hops), convoy + fever
// streaks, a hop booster, a town map with 30 stickers, 4 paints and a daily rush with a streak. Plan in DESIGN.md. Same game as v1 (v1.js).
import { THREE, createStage, createUI, input, loop, sfx, tone, buzz, burst, confetti, store, rng, rounded, mat, clamp, lerp } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { LEVELS, WORLDS } from './levels.js';
import { BAKE } from './bake.js';
import { parse, exitable, clearWay, OPP, rankFor, generate, DIRS, FROM_INIT } from './blogic.js';
const B = board({ game: 'honk-out', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 0.25 }, mode: 'sum' });   // world board: levels cleared (first clears + daily), RULES.md C
const stage = createStage({ fov: 40, shadowSize: 11 });
const { scene, camera, sun } = stage;
const save = store('honkout'), prog = store('honkout2');   // v1 keeps 'honkout'; v2 progress is separate
const F = flow('honkout');
const dayNum = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const today = dayNum(), yest = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return dayNum(d); })();
let streak = prog.get('streak', 0); { const last = prog.get('lastDay', 0); if (last !== today) { streak = last === yest ? streak + 1 : 1; prog.set('streak', streak); prog.set('lastDay', today); } }
const dailyNo = Math.max(1, Math.floor((Date.now() - Date.UTC(2026, 9, 30)) / 864e5) + 1);
let unlocked = prog.get('unlocked', 1), starsOf = prog.get('stars', {}), hops = prog.get('hops', 2), paintOn = prog.get('paint', 0), medals = prog.get('medals', 0), dailyDone = prog.get('dailyDone', 0) === today;
let bests = prog.get('best', {});
const urlLevel = +(/[?&]level=(\d+)/.exec(location.search) || [])[1];
let level = urlLevel || unlocked, daily = /[?&]daily=1/.test(location.search), state = 'ready', score = save.get('riders', 0);
const ui = createUI({ title: 'HONK<br>OUT!', hint: 'Tap a car to drive it out', hand: '👆', score: false });
const STICK = ['🏠', '🌳', '⛲', '🚏', '🏪', '🌷', '🎡', '🏫', '🚒', '🎪', '🌉', '⛪', '🏥', '🚓', '🍕', '🎭', '🚂', '🏰', '🎠', '🛝', '⚓', '🚢', '🗼', '🌃', '🎆', '🐚', '🦀', '🏝️', '🔦', '🌠'];
const PALS = [
  { name: 'Classic', at: 0, c: null },
  { name: 'Candy', at: 6, c: { red: '#ff7a8a', blue: '#7ab8ff', yellow: '#ffe070', green: '#7fe6a8', purple: '#c9a0ff', orange: '#ffaa70', pink: '#ffa3dc', cyan: '#7be8ec' } },
  { name: 'Neon', at: 15, c: { red: '#ff1f4b', blue: '#1f6bff', yellow: '#ffe600', green: '#00e676', purple: '#b620ff', orange: '#ff7a00', pink: '#ff2fd0', cyan: '#00e5ff' } },
  { name: 'Night', at: 27, c: { red: '#d9344c', blue: '#3a5bd9', yellow: '#e0a91e', green: '#1fa86a', purple: '#7c47c9', orange: '#d9702a', pink: '#cf4aa0', cyan: '#1da7b8' } },
];
const COLORS0 = {};
const rbox = (w, h, d, r) => rounded(w - 1.8 * r, h - 1.8 * r, d, r);   // rounded() grows by its bevel; this keeps exact outer size

let COLORS = { red: '#ff4757', blue: '#2e86ff', yellow: '#ffc312', green: '#2ed573', purple: '#a55eea', orange: '#ff7f2a', pink: '#ff6bcb', cyan: '#1fd1d6' };
const CKEYS = Object.keys(COLORS);
const YAW = { u: Math.PI, d: 0, l: -Math.PI / 2, r: Math.PI / 2 };
const THEMES = [
  { bg: ['#cfe8ff', '#eef7ff'], ground: '#bfe8b5', lot: '#d7deea', pad: '#eef1f6', walk: '#f4e6cf', tree: '#57c26b' },
  { bg: ['#ffe3cf', '#fff6ec'], ground: '#f1dcb6', lot: '#e4d9cc', pad: '#f6efe6', walk: '#ffe8c2', tree: '#7bc95a' },
  { bg: ['#d9f2ff', '#f6fcff'], ground: '#eef6ff', lot: '#cfd9e8', pad: '#f4f8fc', walk: '#e2eef9', tree: '#3fae7f' },
  { bg: ['#e6dcff', '#f8f4ff'], ground: '#c9eac0', lot: '#d9d4e6', pad: '#f2eff8', walk: '#f7e4ef', tree: '#62c46a' },
];
let SLOTS = 5; const SLOT_DX = 1.24;


// ---------------------------------------------------------------- geometry helpers
const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));
function part(geo, color, m) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone(); g.applyMatrix4(m);
  const n = g.attributes.position.count, c = new THREE.Color(color), a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
function merge(parts) {
  let n = 0; for (const p of parts) n += p.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
  for (const p of parts) { pos.set(p.attributes.position.array, o * 3); nor.set(p.attributes.normal.array, o * 3); col.set(p.attributes.color.array, o * 3); o += p.attributes.position.count; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere(); g.computeBoundingBox(); return g;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const WHEEL = (() => { const g = new THREE.CylinderGeometry(0.17, 0.17, 0.13, 14); g.rotateZ(Math.PI / 2); return g; })();
const ARROW = (s = 1) => { const sh = new THREE.Shape(); [[0, 0.32], [0.24, 0.04], [0.09, 0.04], [0.09, -0.3], [-0.09, -0.3], [-0.09, 0.04], [-0.24, 0.04]].forEach(([x, y], i) => i ? sh.lineTo(x * s, y * s) : sh.moveTo(x * s, y * s));
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.025, bevelEnabled: false }); g.rotateX(Math.PI / 2); g.translate(0, 0.025, 0); return g; };
const GLASS = '#33415e', TIRE = '#2a2c36', WHITE = '#ffffff', LIGHT = '#fff3b0';
function vehicleGeo(type) {
  const tint = [], fixed = [];
  if (type === 'car') {
    tint.push(part(rbox(0.84, 0.34, 1.78, 0.14), WHITE, M(0, 0.33, 0)), part(rbox(0.72, 0.3, 0.96, 0.13), WHITE, M(0, 0.6, -0.12)));
    fixed.push(part(box(0.62, 0.2, 0.04), GLASS, M(0, 0.6, 0.37, -0.5)), part(box(0.62, 0.18, 0.04), GLASS, M(0, 0.6, -0.61, 0.5)));
    for (const x of [-0.362, 0.362]) fixed.push(part(box(0.02, 0.16, 0.74), GLASS, M(x, 0.61, -0.12)));
    fixed.push(part(ARROW(0.95), WHITE, M(0, 0.75, -0.12)));
    for (const x of [-0.4, 0.4]) for (const z of [-0.56, 0.56]) fixed.push(part(WHEEL, TIRE, M(x, 0.17, z)));
    for (const x of [-0.26, 0.26]) fixed.push(part(box(0.16, 0.08, 0.04), LIGHT, M(x, 0.38, 0.9)));
  } else if (type === 'van') {
    tint.push(part(rbox(0.9, 0.66, 1.84, 0.16), WHITE, M(0, 0.5, 0)));
    fixed.push(part(box(0.74, 0.26, 0.04), GLASS, M(0, 0.64, 0.92)));
    for (const x of [-0.455, 0.455]) fixed.push(part(box(0.02, 0.22, 1.36), GLASS, M(x, 0.64, -0.12)));
    fixed.push(part(ARROW(1.1), WHITE, M(0, 0.83, -0.05)));
    for (const x of [-0.42, 0.42]) for (const z of [-0.58, 0.58]) fixed.push(part(WHEEL, TIRE, M(x, 0.17, z)));
    for (const x of [-0.28, 0.28]) fixed.push(part(box(0.16, 0.08, 0.04), LIGHT, M(x, 0.36, 0.93)));
  } else {
    tint.push(part(rbox(0.96, 0.74, 2.8, 0.16), WHITE, M(0, 0.54, 0)));
    fixed.push(part(box(0.8, 0.3, 0.04), GLASS, M(0, 0.7, 1.41)));
    for (const x of [-0.485, 0.485]) for (let k = 0; k < 4; k++) fixed.push(part(box(0.02, 0.24, 0.5), GLASS, M(x, 0.72, -1.0 + k * 0.6)));
    fixed.push(part(ARROW(1.35), WHITE, M(0, 0.91, 0)));
    for (const x of [-0.44, 0.44]) for (const z of [-0.9, 0.9]) fixed.push(part(WHEEL, TIRE, M(x, 0.17, z)));
    for (const x of [-0.3, 0.3]) fixed.push(part(box(0.16, 0.08, 0.04), LIGHT, M(x, 0.4, 1.42)));
  }
  return { tint: merge(tint), fixed: merge(fixed) };
}
const VGEO = { car: vehicleGeo('car'), van: vehicleGeo('van'), bus: vehicleGeo('bus') };
const tintMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.38, metalness: 0.05 });
const fixedMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.05 });

// passengers: instanced capsule bodies + heads
const PMAX = 72;
const pBody = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.15, 0.24, 4, 10), new THREE.MeshStandardMaterial({ color: '#fff', roughness: 0.5 }), PMAX);
const pHead = new THREE.InstancedMesh(new THREE.SphereGeometry(0.135, 14, 10), mat('#ffffff'), PMAX);
pBody.castShadow = pHead.castShadow = true; scene.add(pBody, pHead);
for (let i = 0; i < PMAX; i++) { pBody.setColorAt(i, new THREE.Color('#fff')); pHead.setColorAt(i, new THREE.Color('#ffd7ba')); }
Object.assign(COLORS0, COLORS);
const worldOf = (n) => Math.min(2, Math.floor((n - 1) / 10));
const sumStars = () => Object.entries(starsOf).filter(([k]) => +k <= 99).reduce((a, [, v]) => a + v, 0);
function applyPalette() { const p = PALS[paintOn]; Object.assign(COLORS, COLORS0, p.c || {}); recolor(); }
const SLEEP_GREY = new THREE.Color('#8a93aa'), _c = new THREE.Color();
function vColor(v, t = 0) {
  if (v.color === '*') return _c.setHSL((t * 0.45) % 1, 0.85, 0.62);
  _c.set(COLORS[v.color]); if (v.z > departed) _c.lerp(SLEEP_GREY, 0.62); return _c;
}
function recolor() { for (const k in ims) { const { tint, list } = ims[k]; list.forEach((v) => tint.setColorAt(v.k, vColor(v))); if (tint.instanceColor) tint.instanceColor.needsUpdate = true; } }

// ---------------------------------------------------------------- level state
let D, W, H, zt, zRoad, zSlot, zq, theme, vehicles = [], occ = [], queue = [], qGold = [], qi = 0, slots = [], qOffset = 0, boardT = 0, riders = 0, totalRiders = 1;
let world = null, ims = {}, flyers = [], camFit = { y: 14, z: 10, tz: 0 }, labels = [], departed = 0, Lcur = null, par = 3, peak = 0, bumps = 0, usedHops = 0, convoy = 0, bestConvoy = 0, lastLeave = 0, feverT = 0, goldHit = 0, stuckAt = 0, t0 = 0, curN = 1;
const slotX = (i) => (i - (SLOTS - 1) / 2) * SLOT_DX;

// ---------------------------------------------------------------- labels (sleepy count, taxi arrows, rainbow star) as sprites
function makeLabel(kind, n) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const t = new THREE.CanvasTexture(c);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.renderOrder = 9; sp.scale.setScalar(0.72); sp.userData = { c, t, key: '' }; sp.userData.kind = kind; drawLabel(sp, kind, n); return sp;
}
function drawLabel(sp, kind, n) {
  const key = kind + n; if (sp.userData.key === key) return; sp.userData.key = key;
  const x = sp.userData.c.getContext('2d'); x.clearRect(0, 0, 128, 128); x.textAlign = 'center'; x.textBaseline = 'middle';
  const disc = (col) => { x.fillStyle = col; x.beginPath(); x.arc(64, 64, 46, 0, 7); x.fill(); x.lineWidth = 7; x.strokeStyle = '#fff'; x.stroke(); };
  if (kind === 'z') { disc('#4b5a8a'); x.fillStyle = '#fff'; x.font = 'bold 62px sans-serif'; x.fillText(String(n), 64, 74); x.font = 'bold 30px sans-serif'; x.fillText('zz', 90, 36); }
  else if (kind === 'v' || kind === 'h') {   // taxi: a double arrow, drawn (no font glyphs)
    disc('#1f9d6a'); x.fillStyle = '#fff'; x.save(); x.translate(64, 64); if (kind === 'v') x.rotate(Math.PI / 2);
    x.beginPath(); x.moveTo(-34, 0); x.lineTo(-14, -18); x.lineTo(-14, -7); x.lineTo(14, -7); x.lineTo(14, -18); x.lineTo(34, 0); x.lineTo(14, 18); x.lineTo(14, 7); x.lineTo(-14, 7); x.lineTo(-14, 18); x.closePath(); x.fill(); x.restore();
  } else {   // rainbow: a drawn star
    disc('#ff9f1c'); x.fillStyle = '#fff'; x.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 15 : 34, a = -Math.PI / 2 + i * Math.PI / 5; x[i ? 'lineTo' : 'moveTo'](64 + Math.cos(a) * r, 66 + Math.sin(a) * r); }
    x.closePath(); x.fill();
  }
  sp.userData.t.needsUpdate = true;
}
function clearLabels() { for (const l of labels) { l.material.map.dispose(); l.material.dispose(); } labels = []; }

// ---------------------------------------------------------------- the level (authored 1-30; bonus rooms after; the daily)
const initials = (s) => [...s].map((c) => FROM_INIT[c]);
function getLevel(n, isDaily) {
  if (isDaily) {
    for (let k = 0; k < 6; k++) { try { const { Ld, queue: q } = generate(13 + ((today + k) % 4), today * 7 + k, rng, Object.keys(COLORS0)); return { w: Ld.w, h: Ld.h, slots: 5, cones: [], vs: Ld.vs, queue: q, par: 3, theme: 3 }; } catch (e) {} }
  }
  if (n <= LEVELS.length) { const Ld = parse(LEVELS[n - 1]), b = BAKE[n - 1]; return { ...Ld, queue: initials(b.q), par: b.par, theme: worldOf(n), spec: LEVELS[n - 1] }; }
  for (let k = 0; k < 8; k++) { try { const { Ld, queue: q } = generate(10 + ((n - 31) % 14), 9100 + n * 31 + k, rng, Object.keys(COLORS0)); return { w: Ld.w, h: Ld.h, slots: 5, cones: [], vs: Ld.vs, queue: q, par: 3, theme: 3 }; } catch (e) {} }
  throw new Error('no level');
}

// ---------------------------------------------------------------- world building
function cellPos(i, j) { return new THREE.Vector3(-W / 2 + i + 0.5, 0, zt + j + 0.5); }
function slab(w, d, h, color, x, z, y = 0, r = 0.3) { const m = new THREE.Mesh(rbox(w, d, h, r), mat(color, { roughness: 0.85 })); m.rotation.x = -Math.PI / 2; m.position.set(x, y - h / 2 + 0.001, z); m.receiveShadow = true; world.add(m); return m; }
const CONE_G = (() => [part(new THREE.CylinderGeometry(0.06, 0.2, 0.5, 12), '#ff7a1a', M(0, 0.28, 0)), part(new THREE.CylinderGeometry(0.115, 0.14, 0.09, 12), '#ffffff', M(0, 0.26, 0)), part(box(0.46, 0.04, 0.46), '#ff7a1a', M(0, 0.02, 0))])();
function build(Ld) {
  if (world) scene.remove(world); world = new THREE.Group(); scene.add(world); clearLabels();
  for (const k in ims) { scene.remove(ims[k].tint, ims[k].fixed); } ims = {};
  W = Ld.w; H = Ld.h; SLOTS = Ld.slots; zt = -H / 2 + 1.6; zRoad = zt - 1.15; zSlot = zRoad - 2.75; zq = zSlot - 2.7;
  theme = THEMES[Ld.theme % THEMES.length];
  document.body.style.setProperty('--bg1', theme.bg[0]); document.body.style.setProperty('--bg2', theme.bg[1]); document.body.style.setProperty('--ui', '#3b6cff');
  const gr = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), mat(theme.ground, { roughness: 1 })); gr.rotation.x = -Math.PI / 2; gr.position.y = -0.03; gr.receiveShadow = true; world.add(gr);
  const lotW = Math.max(W + 1.6, 7.4);
  slab(lotW, H + 1.0, 0.12, theme.lot, 0, zt + H / 2, 0.02, 0.5);
  const lines = [];
  for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) lines.push(part(new THREE.PlaneGeometry(0.92, 0.92), '#ffffff', M(-W / 2 + i + 0.5, 0.035, zt + j + 0.5, -Math.PI / 2)));
  const lm = new THREE.Mesh(merge(lines), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, transparent: true, opacity: 0.28 })); lm.receiveShadow = true; world.add(lm);
  const rw = 40; const road = new THREE.Mesh(new THREE.PlaneGeometry(rw, 1.5), mat('#4b5163', { roughness: 0.9 })); road.rotation.x = -Math.PI / 2; road.position.set(0, 0.012, zRoad); road.receiveShadow = true; world.add(road);
  const dashes = []; for (let x = -rw / 2; x < rw / 2; x += 1.1) dashes.push(part(new THREE.PlaneGeometry(0.55, 0.08), '#ffffff', M(x, 0.02, zRoad, -Math.PI / 2)));
  for (const s of [-1, 1]) dashes.push(part(new THREE.PlaneGeometry(rw, 0.06), '#ffffff', M(0, 0.02, zRoad + s * 0.68, -Math.PI / 2)));
  slab(SLOTS * SLOT_DX + 0.9, 3.7, 0.1, theme.pad, 0, zSlot + 0.05, 0.03, 0.3);
  for (let i = 0; i < SLOTS; i++) {
    const x = slotX(i), w = 1.06, d = 3.15;
    for (let t = -d / 2; t < d / 2 - 0.1; t += 0.32) for (const s of [-1, 1]) dashes.push(part(new THREE.PlaneGeometry(0.05, 0.2), '#9aa6bb', M(x + s * w / 2, 0.09, zSlot + t + 0.1, -Math.PI / 2)));
    for (let t = -w / 2; t < w / 2 - 0.05; t += 0.3) dashes.push(part(new THREE.PlaneGeometry(0.18, 0.05), '#9aa6bb', M(x + t + 0.1, 0.09, zSlot - d / 2, -Math.PI / 2)));
  }
  world.add(new THREE.Mesh(merge(dashes), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })));
  slab(11.5, 2.1, 0.14, theme.walk, 0, zq - 0.45, 0.04, 0.4);
  const dec = [];
  dec.push(part(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 8), '#7d8597', M(-0.75, 0.65, zq + 0.35)), part(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 20), '#2e86ff', M(-0.75, 1.35, zq + 0.35, Math.PI / 2)),
    part(new THREE.CylinderGeometry(0.2, 0.2, 0.07, 20), '#ffffff', M(-0.75, 1.35, zq + 0.36, Math.PI / 2)));
  for (const [x, z, s] of [[-5.3, zq - 0.6, 1], [5.4, zq - 0.3, 0.9], [-5.6, zRoad + 2.2, 1.1], [5.6, zRoad + 3.4, 1], [-5.4, zt + H - 0.6, 0.9], [5.5, zt + H + 0.2, 1.1]]) {
    dec.push(part(new THREE.CylinderGeometry(0.1, 0.13, 0.6, 8), '#9a6a3c', M(x, 0.3, z)), part(new THREE.IcosahedronGeometry(0.62 * s, 1), theme.tree, M(x, 0.95 * s + 0.25, z)), part(new THREE.IcosahedronGeometry(0.42 * s, 1), theme.tree, M(x + 0.25, 1.35 * s + 0.2, z + 0.1)));
  }
  const roof = (w, d) => { const sh = new THREE.Shape(); sh.moveTo(-w / 2 - 0.15, 0); sh.lineTo(w / 2 + 0.15, 0); sh.lineTo(0, w * 0.42); sh.closePath(); const r = new THREE.ExtrudeGeometry(sh, { depth: d + 0.3, bevelEnabled: false }); r.translate(0, 0, -(d + 0.3) / 2); return r; };
  for (const [x, w, h, col, rc] of [[0.6, 3.0, 1.7, '#fff1d6', '#ff6b6b'], [-2.9, 2.0, 1.3, '#d9ecff', '#5d8cff'], [3.6, 1.6, 1.1, '#ffe0ef', '#ff9a3c']]) {
    const z = zq - 2.3; dec.push(part(rbox(w, h, 1.4, 0.08), col, M(x, h / 2, z)), part(roof(w, 1.4), rc, M(x, h, z)));
    dec.push(part(rbox(0.5, 0.8, 0.06, 0.03), '#9a6a3c', M(x, 0.4, z + 0.71)));
    for (const s of [-1, 1]) if (w > 1.7) dec.push(part(rbox(0.42, 0.38, 0.05, 0.03), '#8fd3ff', M(x + s * w * 0.3, h * 0.62, z + 0.71)));
  }
  for (const x of [-3.6, 3.6]) dec.push(part(new THREE.CylinderGeometry(0.05, 0.06, 1.6, 8), '#59607a', M(x, 0.8, zRoad - 0.95)), part(new THREE.SphereGeometry(0.16, 12, 8), '#fff5c2', M(x, 1.65, zRoad - 0.95)));
  // cones: wall cells of this lot
  for (const [i, j] of Ld.cones) { const p = cellPos(i, j); for (const g of CONE_G) { const g2 = g.clone(); g2.translate(p.x, 0.06, p.z); dec.push(g2); } }
  const dm = new THREE.Mesh(merge(dec), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 })); dm.castShadow = true; world.add(dm);
  vehicles = Ld.vs.map((v) => ({ ...v, cells: v.cells.map((c) => c.slice()), seats: v.cap, state: 'lot', pos: new THREE.Vector3(), yaw: YAW[v.dir], shake: 0, pop: 0, squash: 0, bump: 0 }));
  for (const t of ['car', 'van', 'bus']) {
    const list = vehicles.filter((v) => v.type === t); if (!list.length) continue;
    const tint = new THREE.InstancedMesh(VGEO[t].tint, tintMat, list.length), fixed = new THREE.InstancedMesh(VGEO[t].fixed, fixedMat, list.length);
    tint.castShadow = fixed.castShadow = true; tint.receiveShadow = true; scene.add(tint, fixed); ims[t] = { tint, fixed, list };
    list.forEach((v, k) => { v.k = k; });
  }
  occ = Array.from({ length: W }, () => new Array(H).fill(-1));
  for (const [i, j] of Ld.cones) occ[i][j] = 99;
  for (const v of vehicles) { v.cells.forEach(([i, j]) => occ[i][j] = v.id); const c = v.cells.reduce((a, [i, j]) => a.add(cellPos(i, j)), new THREE.Vector3()).multiplyScalar(1 / v.cells.length); v.pos.copy(c); v.home = c.clone(); }
  departed = 0; recolor();
  for (const v of vehicles) { const kind = v.z ? 'z' : v.both ? (v.dir === 'u' || v.dir === 'd' ? 'v' : 'h') : v.color === '*' ? '*' : null; if (kind) { v.label = makeLabel(kind, Math.max(0, v.z - departed)); world.add(v.label); labels.push(v.label); } }
  const halfW = Math.max(lotW / 2 + 0.35, 4.3), zTop = zq - 2.6, zBot = zt + H + 0.6;
  camFit = { halfW, zTop, zBot };
}
function placeCamera() {
  const { halfW, zTop, zBot } = camFit, tilt = THREE.MathUtils.degToRad(58), fovV = THREE.MathUtils.degToRad(camera.fov);
  const spanZ = (zBot - zTop), needH = spanZ * Math.sin(tilt) * 0.5 + 0.9;
  const dist = Math.max(halfW / (Math.tan(fovV / 2) * camera.aspect), needH / Math.tan(fovV / 2)) * 1.02;
  const tz = (zTop + zBot) / 2 - 0.55;
  camera.position.set(0, Math.sin(tilt) * dist, tz + Math.cos(tilt) * dist); camera.lookAt(0, 0, tz); camBase = camera.position.clone();
  sun.position.set(4, 18, tz + 9); sun.target.position.set(0, 0, tz);
}
addEventListener('resize', () => world && placeCamera());

// ---------------------------------------------------------------- vehicle motion
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
function updateInstances(t) {
  for (const k in ims) {
    const { tint, fixed, list } = ims[k];
    for (const v of list) {
      const sh = v.shake > 0 ? Math.sin(t * 60) * 0.06 * v.shake : 0, gone = v.state === 'gone';
      _e.set(0, v.yaw + sh * 0.6, sh * 0.5); _q.setFromEuler(_e);
      const sc = gone ? 0 : 1 + v.pop * 0.12; _s.set(sc, gone ? 0 : 1 + v.pop * 0.2 - v.squash * 0.15, sc);
      _p.copy(v.pos); if (v.bob) _p.y += v.bob;
      _m.compose(_p, _q, _s); tint.setMatrixAt(v.k, _m); fixed.setMatrixAt(v.k, _m);
      if (v.color === '*') { tint.setColorAt(v.k, vColor(v, t)); tint.instanceColor.needsUpdate = true; }
      if (v.label) { v.label.position.set(v.pos.x, 1.55 + Math.sin(t * 3 + v.id) * 0.04, v.pos.z - 0.1); v.label.visible = v.state === 'lot'; }
    }
    tint.instanceMatrix.needsUpdate = fixed.instanceMatrix.needsUpdate = true;
  }
}
function roundPath(pts, r = 0.7) {
  const out = [pts[0].clone()];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], p = pts[i], b = pts[i + 1], da = p.clone().sub(a), db = b.clone().sub(p), la = da.length(), lb = db.length();
    if (la < 1e-3 || lb < 1e-3) continue; const rr = Math.min(r, la / 2, lb / 2);
    const p1 = p.clone().addScaledVector(da.normalize(), -rr), p2 = p.clone().addScaledVector(db.normalize(), rr);
    for (let k = 0; k <= 6; k++) { const t = k / 6; out.push(new THREE.Vector3().addScaledVector(p1, (1 - t) * (1 - t)).addScaledVector(p, 2 * t * (1 - t)).addScaledVector(p2, t * t)); }
  }
  out.push(pts[pts.length - 1].clone()); return out;
}
function drive(v, pts, speed, done, reverse = false) {
  const path = roundPath(pts); const segs = []; let L = 0;
  for (let i = 1; i < path.length; i++) { const d = path[i].distanceTo(path[i - 1]); segs.push({ a: path[i - 1], b: path[i], L0: L, d }); L += d; }
  v.route = { segs, L, s: 0, speed, done, reverse };
}
function stepRoute(v, dt) {
  const r = v.route; r.s = Math.min(r.L, r.s + r.speed * dt / 60);
  const seg = r.segs.find((sg) => r.s <= sg.L0 + sg.d) || r.segs[r.segs.length - 1];
  const k = seg.d ? (r.s - seg.L0) / seg.d : 1; v.pos.lerpVectors(seg.a, seg.b, clamp(k, 0, 1));
  if (seg.d > 0.01) { let yaw = Math.atan2(seg.b.x - seg.a.x, seg.b.z - seg.a.z); if (r.reverse) yaw += Math.PI; let d = yaw - v.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; v.yaw += d * Math.min(1, 0.35 * dt); }
  if (r.s >= r.L) { v.route = null; r.done && r.done(); }
}

// ---------------------------------------------------------------- tapping a vehicle
function freeSlot() { for (let i = 0; i < SLOTS; i++) if (!slots[i]) return i; return -1; }
const usedSlots = () => slots.filter(Boolean).length;
function wakeCheck() {
  for (const v of vehicles) if (v.z && v.state === 'lot') {
    const left = Math.max(0, v.z - departed);
    if (v.label) { drawLabel(v.label, 'z', left); if (left === 0 && v.label.userData.kind === 'z') { v.label.userData.kind = 'woke'; world.remove(v.label); v.label.visible = false; v.label = null; v.pop = 1; tone(740, 0.1, 'triangle', 0.1, 1.4); ui.pop('AWAKE!', '#ffd23f', 28, 28); burst(scene, v.pos.clone().setY(0.9), '#ffffff', 10, { speed: 0.05, up: 0.06, size: 0.4 }); } }
  }
  recolor();
}
function tapVehicle(v) {
  if (state !== 'play' || v.state !== 'lot' || v.route) return;
  if (v.z > departed) { v.shake = 1; ui.pop(`💤 ${v.z - departed} more`, '#fff', 28, 30); tone(260, 0.12, 'sine', 0.07, 0.7); buzz(25); return; }
  let dir = v.dir;
  if (v.both && !clearWay(v, occ, W, H, dir) && clearWay(v, occ, W, H, OPP[dir])) { dir = OPP[dir]; v.dir = dir; v.cells.reverse(); v.yaw = YAW[dir]; }
  const [dx, dz] = DIRS[dir]; let [i, j] = v.cells[0], steps = 0, blocker = null, blocked = false;
  for (;;) { i += dx; j += dz; if (i < 0 || j < 0 || i >= W || j >= H) break; const o = occ[i][j]; if (o >= 0 && o !== v.id) { blocked = true; blocker = o === 99 ? null : vehicles[o]; break; } steps++; }
  if (blocked) {   // bump: roll forward to the blocker, shake, back up
    bumps++; starChip(); ui.pop('BLOCKED!', '#ff4757', 30, 26); ui.flash(0.18); camKick = 0.5; if (blocker) blocker.shake = 1;
    const dist = steps + 0.12, dirv = new THREE.Vector3(dx, 0, dz), from = v.home.clone();
    tone(190, 0.12, 'square', 0.08, 0.7); buzz(35);
    drive(v, [from, from.clone().addScaledVector(dirv, dist)], 14, () => { if (blocker) blocker.shake = 1; v.shake = 0.6; sfx.bounce(); tone(120, 0.1, 'sawtooth', 0.06, 0.8); drive(v, [v.pos.clone(), from], 8, () => v.pos.copy(from), true); });
    return;
  }
  const s = freeSlot();
  if (s < 0) { v.shake = 1; ui.pop('NO SPACE!', '#ff4757', 30, 30); tone(150, 0.2, 'square', 0.08, 0.6); buzz(60); return; }
  slots[s] = v; v.slot = s; v.state = 'moving'; v.cells.forEach(([a, b]) => occ[a][b] = -1); departed++; wakeCheck();
  peak = Math.max(peak, usedSlots()); starChip();
  honk(); buzz(15);
  const x0 = -W / 2, x1 = W / 2, zb = zt + H, out = 0.75, front = v.pos.clone().addScaledVector(new THREE.Vector3(dx, 0, dz), v.cells.length / 2);
  const pts = [v.pos.clone()]; let E;
  if (dir === 'u') E = new THREE.Vector3(front.x, 0, zRoad);
  else if (dir === 'd') { E = new THREE.Vector3(front.x, 0, zb + out); const side = front.x < 0 ? x0 - out - 0.2 : x1 + out + 0.2; pts.push(E, new THREE.Vector3(side, 0, zb + out)); E = new THREE.Vector3(side, 0, zRoad); }
  else { E = new THREE.Vector3(dir === 'l' ? x0 - out - 0.2 : x1 + out + 0.2, 0, front.z); pts.push(E); E = new THREE.Vector3(E.x, 0, zRoad); }
  pts.push(E, new THREE.Vector3(slotX(s), 0, zRoad), new THREE.Vector3(slotX(s), 0, zSlot));
  drive(v, pts, 15, () => { v.state = 'parked'; v.yaw = Math.PI; v.pop = 1; tone(660, 0.06, 'triangle', 0.08, 1.2); burst(scene, v.pos.clone().setY(0.3), '#ffffff', 8, { speed: 0.05, up: 0.04, size: 0.4 }); });
}
let lastHonk = 0, camKick = 0, camBase = null;
function honk() { const n = performance.now(); if (n - lastHonk < 120) return; lastHonk = n; tone(420, 0.09, 'square', 0.05, 1); setTimeout(() => tone(520, 0.12, 'square', 0.05, 1), 90); }

// ---------------------------------------------------------------- passengers
const pathPts = () => [[0.0, zq + 0.35], [3.9, zq + 0.35], [3.9, zq - 0.25], [-3.9, zq - 0.25], [-3.9, zq - 0.85], [3.9, zq - 0.85]].map(([x, z]) => new THREE.Vector3(x, 0, z));
let qPath = null;
function qPos(s, out) {
  let d = s * 0.38;
  for (let i = 1; i < qPath.length; i++) { const a = qPath[i - 1], b = qPath[i], L = a.distanceTo(b); if (d <= L) return out.lerpVectors(a, b, d / L); d -= L; }
  return out.copy(qPath[qPath.length - 1]);
}
const pm = new THREE.Matrix4(), pq = new THREE.Quaternion(), ps = new THREE.Vector3(1, 1, 1), pv = new THREE.Vector3(), hv = new THREE.Vector3(), tmpC = new THREE.Color(), SKIN = new THREE.Color('#ffd7ba'), GOLD = new THREE.Color('#ffd400');
function setP(k, x, y, z, color, sc = 1, gold = false) {
  ps.setScalar(sc); pm.compose(hv.set(x, y, z), pq, ps); pBody.setMatrixAt(k, pm); pm.compose(hv.set(x, y + 0.33 * sc, z), pq, ps); pHead.setMatrixAt(k, pm);
  pBody.setColorAt(k, tmpC.set(COLORS[color])); pHead.setColorAt(k, gold ? GOLD : SKIN);
}
function updatePassengers(dt, t) {
  qOffset *= Math.pow(0.78, dt); if (qOffset < 0.01) qOffset = 0;
  let n = 0;
  const vis = Math.min(queue.length - qi, PMAX - 8);
  for (let k = 0; k < vis; k++) {
    qPos(k + qOffset, pv); const g = qGold[qi + k], walk = qOffset > 0.02 ? Math.abs(Math.sin(t * 16 + k)) * 0.06 : Math.abs(Math.sin(t * (g ? 7 : 3) + k * 0.7)) * (g ? 0.06 : 0.015);
    setP(n++, pv.x, 0.3 + walk, pv.z, queue[qi + k], 1, g);
  }
  for (const f of flyers) { f.t += dt / 60 / 0.3; const k = Math.min(1, f.t); pv.lerpVectors(f.a, f.b, k); pv.y = 0.24 + Math.sin(k * Math.PI) * 1.0 + k * 0.3; setP(n++, pv.x, pv.y, pv.z, f.color, 1 - k * 0.6, f.gold); }
  flyers = flyers.filter((f) => f.t < 1 || (f.cb(), false));
  for (let k = n; k < PMAX; k++) { pm.makeScale(0, 0, 0); pBody.setMatrixAt(k, pm); pHead.setMatrixAt(k, pm); }
  pBody.count = pHead.count = PMAX; pBody.instanceMatrix.needsUpdate = pHead.instanceMatrix.needsUpdate = true; pBody.instanceColor.needsUpdate = pHead.instanceColor.needsUpdate = true;
}
const seatFor = (c) => slots.find((s) => s && s.state === 'parked' && s.color === c && s.seats > 0 && !s.leaving) || slots.find((s) => s && s.state === 'parked' && s.color === '*' && s.seats > 0 && !s.leaving);
function boarding(dt) {
  boardT -= dt / 60; if (boardT > 0 || qi >= queue.length) return;
  const c = queue[qi], v = seatFor(c);
  if (!v) return;
  const g = qGold[qi];
  boardT = feverT > 0 ? 0.035 : 0.065; v.seats--; qi++; qOffset += 1; riders++; score++;
  const a = qPos(0, new THREE.Vector3()), b = v.pos.clone();
  flyers.push({ a, b, t: 0, color: c, gold: g, cb: () => { v.squash = 1; tone(880 + (v.cap - v.seats) * 30, 0.03, 'sine', 0.06, 1.2); if (g) goldRider(v); } });
  ui.progress(riders / totalRiders); ui.pill(`👥 ${queue.length - qi}`); nextChip();
  if (v.seats === 0) { v.leaving = true; setTimeout(() => leave(v), 420); }
}
function goldRider(v) {
  goldHit++; hops++; prog.set('hops', hops); hopChip(); sfx.coin(); buzz([20, 30, 20]); ui.pop('GOLDEN RIDER! +1 ⏩', '#ffd400', 34, 24); ui.flash(0.35);
  burst(scene, v.pos.clone().setY(1.0), ['#ffd400', '#ffffff'], 18, { speed: 0.09, up: 0.1, size: 0.5 });
}
function leave(v) {
  if (v.state !== 'parked' || state === 'lost') return; v.state = 'leaving'; sfx.coin(); honk(); buzz(20);
  const now = performance.now(); convoy = now - lastLeave < 3600 ? convoy + 1 : 1; lastLeave = now; bestConvoy = Math.max(bestConvoy, convoy);
  const col = v.color === '*' ? '#ffd23f' : COLORS[v.color];
  if (convoy >= 2) { const big = convoy >= 5 ? 'UNSTOPPABLE' : convoy >= 4 ? 'FEVER' : convoy >= 3 ? 'CONVOY' : 'DOUBLE'; ui.pop(`${big} x${convoy}`, col, 30 + Math.min(14, convoy * 2), 30); tone(440 + convoy * 80, 0.14, 'triangle', 0.1, 1.5); setTimeout(() => tone(660 + convoy * 80, 0.14, 'triangle', 0.09, 1.5), 90); }
  else ui.pop(['FULL!', 'BEEP BEEP!', 'GO GO!', 'NICE!'][v.id % 4], col, 32, 30);
  if (convoy >= 2) camKick = Math.min(1, 0.35 + convoy * 0.15);
  if (convoy === 4) { feverT = 4.5; ui.flash(0.5); }
  if (convoy >= 5 && convoy % 2 === 1) confetti(scene, new THREE.Vector3(0, 2, zSlot), 40);
  burst(scene, v.pos.clone().setY(1.0), [col, '#ffffff', '#ffd23f'], 14 + Math.min(16, convoy * 3), { speed: 0.08, up: 0.08, size: 0.5 });
  const x = v.pos.x, dirX = x >= 0 ? 1 : -1;
  drive(v, [v.pos.clone(), new THREE.Vector3(x, 0, zRoad)], 10, () => {
    slots[v.slot] = null; starChip();
    drive(v, [v.pos.clone(), new THREE.Vector3(x + dirX * 1.2, 0, zRoad), new THREE.Vector3(dirX * 16, 0, zRoad)], 16, () => v.state = 'gone');
  }, true);
}

// ---------------------------------------------------------------- stars
const starsFor = (n, cost) => n <= 2 ? 3 : cost <= 2 ? 3 : cost <= 4 ? 2 : 1;
const costNow = () => Math.max(0, peak - par) + bumps + usedHops * 2;
const starHtml = (n) => '⭐'.repeat(n) + '<span style="opacity:.25;filter:grayscale(1)">' + '⭐'.repeat(3 - n) + '</span>';

// ---------------------------------------------------------------- UI: star chip, hop button, result card, lose card, map
const css2 = document.createElement('style');
css2.textContent = `.ho-next{position:fixed;left:50%;top:calc(96px + env(safe-area-inset-top));transform:translateX(-50%);z-index:5;pointer-events:none;display:flex;gap:6px;align-items:center;background:rgba(255,255,255,.92);border-radius:20px;padding:4px 12px 4px 10px;font-weight:800;font-size:13px;color:#2b3550;box-shadow:0 3px 0 rgba(0,0,0,.14);transition:transform .15s}.ho-next.hc-hidden{display:none}.ho-next i{display:inline-block;width:20px;height:20px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 2px rgba(0,0,0,.18)}.ho-next.pulse{transform:translateX(-50%) scale(1.25)}
.ho-stars{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(14px + env(safe-area-inset-bottom));z-index:5;pointer-events:none;text-align:center;font-weight:800;font-size:22px;letter-spacing:1px;color:#ffc61a;text-shadow:0 2px 0 rgba(0,0,0,.2);transition:transform .15s}
.ho-stars.drop{transform:translateX(-50%) scale(1.35)}.ho-stars small{display:block;font-size:12px;letter-spacing:0;color:#2b3550;opacity:.85;text-shadow:none}
.ho-btn{position:fixed;bottom:calc(16px + env(safe-area-inset-bottom));z-index:6;border:0;border-radius:18px;font-weight:800;font-family:inherit;background:#fff;color:#3a5bd9;font-size:20px;padding:8px 14px;box-shadow:0 4px 0 rgba(0,0,0,.18)}
.ho-hop{left:12px}.ho-hop.hot{background:#ff9f1c;color:#fff;animation:hcpulse .5s ease-in-out infinite}.ho-map-btn{right:12px}
.ho-sub{position:fixed;left:0;right:0;top:calc(96px + env(safe-area-inset-top));z-index:5;pointer-events:none;text-align:center;font-weight:800;font-size:19px;color:#2b3550;text-shadow:0 2px 0 rgba(255,255,255,.7);transition:opacity .4s}
.ho-res,.ho-map{position:fixed;inset:0;z-index:12;display:flex;flex-direction:column;align-items:center;color:#24335e;font-family:inherit;text-align:center}
.ho-res{justify-content:flex-start;padding:calc(70px + env(safe-area-inset-top)) 18px 30px;gap:9px;background:rgba(40,60,110,.38)}
.ho-res h1{margin:0;font-size:clamp(36px,10.5vw,58px);font-weight:800;line-height:.95;color:#fff;text-shadow:0 5px 0 rgba(0,0,0,.25)}
.ho-res .sub{font-size:19px;font-weight:700;color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.25)}
.ho-res .st{font-size:60px;letter-spacing:4px;line-height:1;color:#ffc61a;text-shadow:0 5px 0 rgba(0,0,0,.2)}
.ho-res .st span{display:inline-block;opacity:0;transform:scale(3) rotate(-30deg)}.ho-res .st span.on{opacity:1;transform:none;transition:transform .35s cubic-bezier(.3,1.7,.5,1),opacity .15s}.ho-res .st span.off{opacity:.5;filter:grayscale(1);transform:none}
.ho-res .chip{background:#fff;border-radius:18px;padding:8px 16px;font-weight:800;font-size:17px;box-shadow:0 4px 0 rgba(0,0,0,.14);animation:cxi .4s cubic-bezier(.3,1.6,.5,1)}
.ho-res .row{display:flex;gap:12px;margin-top:auto;margin-bottom:5vh;align-items:center}
.ho-bt{border:0;border-radius:26px;font-weight:800;font-family:inherit;color:#fff;background:#3cc46a;box-shadow:0 6px 0 #2a9a50;font-size:28px;padding:15px 40px;animation:hcpulse 1.4s ease-in-out infinite}
.ho-bt.sm{font-size:24px;padding:13px 20px;background:#fff;color:#3a7bff;box-shadow:0 5px 0 rgba(0,0,0,.16);animation:none}.ho-bt.red{background:#ff6b5e;box-shadow:0 6px 0 #d64a3e}
.ho-map{justify-content:flex-start;background:linear-gradient(#cfe6ff,#f4f9ff);overflow:auto;padding:calc(14px + env(safe-area-inset-top)) 14px 30px;gap:6px}
.ho-map h2{margin:6px 0 0;font-size:22px;font-weight:800}.ho-map .wn{font-size:13px;opacity:.8;margin-bottom:4px}
.ho-map .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:9px;width:min(94vw,440px)}
.ho-node{position:relative;aspect-ratio:1;border-radius:18px;border:0;background:#fff;box-shadow:0 4px 0 rgba(0,0,0,.14);font-weight:800;font-size:22px;color:#3a5b9f;font-family:inherit;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1}
.ho-node small{font-size:10px;color:#ffb81c;letter-spacing:0;margin-top:2px;min-height:11px}.ho-node.lock{opacity:.45;box-shadow:none}.ho-node.hard{outline:3px solid #ff4d5e}
.ho-node.next{background:#3cc46a;color:#fff;animation:hcpulse 1s ease-in-out infinite}.ho-node.done{background:#fff7d6}.ho-node em{font-style:normal;font-size:26px}
.ho-pals{display:flex;gap:8px;margin:2px 0 6px}.ho-pal{width:54px;height:42px;border-radius:14px;border:3px solid #fff;box-shadow:0 3px 0 rgba(0,0,0,.18);font-size:10px;font-weight:800;color:#fff;display:flex;align-items:center;justify-content:center;text-shadow:0 1px 0 rgba(0,0,0,.4)}
.ho-pal.on{outline:3px solid #3cc46a}.ho-pal.lk{filter:grayscale(1);opacity:.5}
.ho-close{position:sticky;top:0;align-self:flex-end;border:0;background:#fff;border-radius:50%;width:40px;height:40px;font-size:20px;box-shadow:0 3px 0 rgba(0,0,0,.16)}
.ho-daily{border:0;border-radius:20px;background:#ffb81c;color:#fff;font-weight:800;font-size:18px;padding:10px 20px;font-family:inherit;box-shadow:0 4px 0 #d9930b}.ho-daily.done{background:#c8d3e8;box-shadow:none}`;
document.head.appendChild(css2);
const mk2 = (cls, tag = 'div') => { const d = document.createElement(tag); d.className = cls; document.body.appendChild(d); return d; };
const nextEl = mk2('ho-next hc-hidden'), starEl = mk2('ho-stars hc-hidden'), subEl = mk2('ho-sub'), resEl = mk2('ho-res hc-hidden'), mapEl = mk2('ho-map hc-hidden'), mapBtn = mk2('ho-btn ho-map-btn', 'button'), hopBtn = mk2('ho-btn ho-hop', 'button');
mapBtn.textContent = '🗺️'; mapBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (state === 'play' || state === 'ready') B.start(); openMap(); });
hopBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); hop(); });
for (const el of [resEl, mapEl]) el.addEventListener('pointerdown', (e) => e.stopPropagation());
let lastNext = '';
function nextChip() { if (state !== 'play' || qi >= queue.length) { nextEl.classList.add('hc-hidden'); lastNext = ''; return; } const c = queue[qi]; if (c === lastNext) return; lastNext = c; nextEl.classList.remove('hc-hidden'); nextEl.innerHTML = `next <i style="background:${c === '*' ? '#fff' : (COLORS[c] || '#999')}"></i>`; nextEl.classList.add('pulse'); setTimeout(() => nextEl.classList.remove('pulse'), 160); }
function hopChip() { hopBtn.textContent = `⏩ ${hops}`; hopBtn.style.opacity = hops > 0 ? 1 : 0.55; }
function showSub(t, ms = 4200) { subEl.textContent = t || ''; subEl.style.opacity = t ? 1 : 0; if (t) { clearTimeout(showSub.t); showSub.t = setTimeout(() => subEl.style.opacity = 0, ms); } }
function starChip() {
  const n = starsFor(daily ? 99 : curN, costNow()), was = starEl.dataset.n; starEl.dataset.n = n;
  starEl.innerHTML = `${starHtml(n)}<small>${n === 3 ? 'perfect: park only what the line needs' : `${usedSlots()} in spots · best ${par}`}</small>`;
  starEl.classList.toggle('hc-hidden', state !== 'play');
  if (was && +was > n) { starEl.classList.add('drop'); setTimeout(() => starEl.classList.remove('drop'), 260); }
}
function hop() {
  if (state !== 'play' || hops <= 0 || queue.length - qi < 6) { if (hops <= 0) ui.pop('no hops left', '#fff', 24, 30); return; }
  hops--; usedHops++; prog.set('hops', hops); hopChip();
  const a = queue.splice(qi, 3), g = qGold.splice(qi, 3); queue.push(...a); qGold.push(...g); qOffset = 3; stuckAt = 0; hopBtn.classList.remove('hot');
  ui.pop('HOP! the line shuffles', '#fff', 28, 30); tone(520, 0.08, 'triangle', 0.1, 1.3); setTimeout(() => tone(780, 0.1, 'triangle', 0.1, 1.3), 80); buzz(15); starChip();
}
const tomorrowLine = () => `Tomorrow: Daily Rush #${dailyNo + 1} · 🔥 day ${streak + 1}`;
const nextPal = (tot) => PALS.find((p) => p.at > tot);
function showWin({ st, newSticker, gained, hopGain, first }) {
  const tot = sumStars(), np = nextPal(tot), w = daily ? { icon: '📅', name: 'Daily Rush' } : WORLDS[worldOf(curN)] || { icon: '♾️', name: 'Bonus lots' };
  const left = st < 3 ? `${st === 2 ? 'So close!' : 'Cleared!'} Fewer spots in use and no bumps for 3 stars` : 'Three stars!';
  const bar = (n, of) => `<span style="display:inline-block;width:90px;height:10px;border-radius:5px;background:#ddd;vertical-align:middle"><i style="display:block;height:10px;border-radius:5px;background:#ffb81c;width:${n / of * 100}%"></i></span>`;
  const done = Object.keys(starsOf).filter((k) => +k <= 30).length;
  const chips = [
    daily ? `<div class="chip" style="background:#fff3b0;font-size:22px">📅 Daily medal #${medals}</div>` : '',
    newSticker ? `<div class="chip">${STICK[curN - 1]} New sticker for the town! ${done}/30${done === 29 ? ' · 1 missing!' : ''}</div>` : '',
    ...gained.map((i) => `<div class="chip">🎨 New paint: ${PALS[i].name}!</div>`),
    hopGain ? `<div class="chip">⏩ +${hopGain} hop${goldHit ? ' · golden rider' : ''}</div>` : '',
    bestConvoy >= 3 ? `<div class="chip">🚗 Best convoy x${bestConvoy}</div>` : '',
    `<div class="chip" style="font-size:14px;opacity:.9">⭐ ${tot}${np ? ` · ${np.name} paint at ${np.at}` : ''} · ${bar(done, 30)} town ${done}/30</div>`,
    `<div class="chip" style="font-size:14px;background:#fff0d6">${tomorrowLine()}</div>`,
  ].join('');
  const nextN = daily ? Math.min(unlocked, 9999) : curN + 1;
  resEl.innerHTML = `<div class="sub">${w.icon} ${w.name}${daily ? '' : ' · lot ' + curN}</div><h1>${LEVELS[curN - 1]?.hard && !daily ? 'BIG JAM<br>CLEARED!' : 'LOT<br>CLEARED!'}</h1><div class="st"><span>⭐</span><span>⭐</span><span>⭐</span></div><div class="sub">${left}</div>${chips}
    <div class="row"><button class="ho-bt sm" data-a="map">🗺️</button><button class="ho-bt" data-a="next">${daily ? '▶' : nextN + ' ▶'}</button><button class="ho-bt sm" data-a="again">🔁</button></div>`;
  setTimeout(() => {
    if (state !== 'won') return; resEl.classList.remove('hc-hidden');
    [...resEl.querySelectorAll('.st span')].forEach((e, i) => setTimeout(() => { e.classList.add(i < st ? 'on' : 'off'); if (i < st) { tone(660 + i * 220, 0.12, 'triangle', 0.12, 1.2); buzz(15); if (i === 2) { sfx.coin(); confetti(scene, new THREE.Vector3(0, 1.5, 0), 60); } } }, 250 + i * 330));
  }, 900);
}
function showLose() {
  const head = queue[qi], seen = [...new Set(slots.filter(Boolean).map((s) => s.color))].filter((c) => c !== '*');
  const left = queue.length - qi, pct = Math.round(riders / totalRiders * 100);
  const why = head ? `Nobody in the spots is ${head}: the line is waiting for a ${head} car` : 'The spots are full';
  resEl.innerHTML = `<h1>JAMMED!</h1><div class="sub">${left <= 8 ? `SO CLOSE: ${left} riders left` : `${pct}% of riders home`}</div>
    <div class="chip" style="display:flex;gap:8px;align-items:center;justify-content:center">Waiting for <i style="display:inline-block;width:26px;height:26px;border-radius:50%;background:${COLORS[head] || '#999'};border:3px solid #fff;box-shadow:0 2px 0 rgba(0,0,0,.2)"></i></div>
    <div class="chip" style="font-size:15px;font-weight:700">${why}</div>${hops > 0 ? '' : '<div class="chip" style="font-size:14px">Win a lot with 3 stars to earn a ⏩ hop</div>'}
    <div class="chip" style="font-size:14px;background:#fff0d6">${tomorrowLine()}</div>
    <div class="row"><button class="ho-bt sm" data-a="map">🗺️</button><button class="ho-bt red" data-a="again">🔁 Again</button></div>`;
  setTimeout(() => { if (state === 'lost') resEl.classList.remove('hc-hidden'); }, 700);
}
resEl.addEventListener('click', (e) => { const a = e.target.closest('[data-a]'); if (!a) return; B.start(); if (a.dataset.a === 'map') openMap(); else if (a.dataset.a === 'next') play(daily ? unlocked : curN + 1); else play(curN, daily); });
function openMap() {
  const tot = sumStars(), done = Object.keys(starsOf).filter((k) => +k <= 30).length;
  let h = `<button class="ho-close" data-a="close">❌</button><h2>⭐ ${tot} · town ${done}/30 · ⏩ ${hops}</h2><div class="ho-pals">`;
  PALS.forEach((p, i) => { const ok = tot >= p.at, c = p.c || COLORS0; h += `<div class="ho-pal ${i === paintOn ? 'on' : ''} ${ok ? '' : 'lk'}" data-p="${i}" style="background:linear-gradient(135deg,${c.red},${c.blue},${c.green})">${ok ? p.name : p.at + '⭐'}</div>`; });
  h += `</div><button class="ho-daily ${dailyDone ? 'done' : ''}" data-d="1">📅 Daily Rush #${dailyNo}${dailyDone ? ' ✓' : ''} · 🔥 ${streak}</button><div class="wn">${dailyDone ? tomorrowLine() : 'A new lot every day: a medal and a hop'} · 🏅 ${medals}</div>`;
  WORLDS.forEach((w, wi) => {
    h += `<h2>${w.icon} ${w.name}</h2><div class="wn">${w.note}</div><div class="grid">`;
    for (let n = wi * 10 + 1; n <= wi * 10 + 10; n++) {
      const spec = LEVELS[n - 1], st = starsOf[n] || 0, ok = n <= unlocked;
      h += `<button class="ho-node ${ok ? '' : 'lock'} ${n === unlocked ? 'next' : st ? 'done' : ''} ${spec.hard ? 'hard' : ''}" data-n="${n}">${st ? `<em>${STICK[n - 1]}</em>` : ok ? n : '🔒'}<small>${st ? starHtml(st) : spec.hard ? 'HARD' : ''}</small></button>`;
    }
    h += '</div>';
  });
  if (unlocked > 30) h += `<h2>♾️ Bonus lots</h2><div class="grid"><button class="ho-node next" data-n="${unlocked}">${unlocked}<small></small></button></div>`;
  mapEl.innerHTML = h; mapEl.classList.remove('hc-hidden'); resEl.classList.add('hc-hidden');
  const nx = mapEl.querySelector('.next'); if (nx) setTimeout(() => nx.scrollIntoView({ block: 'center' }), 30);
}
mapEl.addEventListener('click', (e) => {
  const t = e.target.closest('[data-n],[data-p],[data-a],[data-d]'); if (!t) return; B.start();
  if (t.dataset.a === 'close') { mapEl.classList.add('hc-hidden'); if (state === 'won' || state === 'lost') resEl.classList.remove('hc-hidden'); return; }
  if (t.dataset.p !== undefined) { const i = +t.dataset.p; if (sumStars() >= PALS[i].at) { paintOn = i; prog.set('paint', i); applyPalette(); tone(900, 0.08, 'triangle', 0.1, 1.3); openMap(); } return; }
  if (t.dataset.d) { play(0, true); return; }
  const n = +t.dataset.n; if (n <= unlocked) play(n);
});

// ---------------------------------------------------------------- flow
function play(n, isDaily = false) {
  daily = isDaily; curN = n || curN; if (!isDaily) level = n;
  mapEl.classList.add('hc-hidden'); resEl.classList.add('hc-hidden'); ui.hideStart(); ui.els.win.classList.add('hc-hidden'); ui.els.lose.classList.add('hc-hidden');
  startLevel(); state = 'play'; starChip();
}
function startLevel() {
  Lcur = getLevel(daily ? 0 : curN, daily); build(Lcur); placeCamera();
  queue = Lcur.queue.slice(); qGold = queue.map(() => false); par = Lcur.par; peak = 0; bumps = 0; usedHops = 0; convoy = 0; bestConvoy = 0; feverT = 0; goldHit = 0; stuckAt = 0; lastLeave = 0; t0 = performance.now();
  if (queue.length > 24 && (curN > 5 || daily) && Math.random() < 0.4) qGold[6 + Math.floor(Math.random() * (queue.length - 8))] = true;   // a golden rider now and then: +1 hop (does not change the line)
  qi = 0; slots = new Array(SLOTS).fill(null); qOffset = 0; flyers = []; riders = 0; totalRiders = queue.length; qPath = pathPts();
  ui.levels(daily ? '📅' : curN); ui.progress(0); ui.pill(`👥 ${queue.length}`); hopChip(); lastNext = ''; setTimeout(nextChip, 50); hopBtn.classList.remove('hot'); showSub(daily ? 'DAILY RUSH' : Lcur.spec?.tag || '', 3600);
}
let endT = 0;
function win() {
  state = 'won'; endT = performance.now(); F.level(true); const st = starsFor(daily ? 99 : curN, costNow()); const secs = Math.round((endT - t0) / 1000);
  const oldTot = sumStars(); let newSticker = false, hopGain = goldHit ? 1 : 0, first = false;
  if (daily) { if (!dailyDone) { dailyDone = true; medals++; prog.set('medals', medals); prog.set('dailyDone', today); hopGain++; first = true; } }
  else {
    first = !(starsOf[curN] > 0); newSticker = first && curN <= 30; if (st > (starsOf[curN] || 0)) { if (st === 3 && (starsOf[curN] || 0) < 3) hopGain++; starsOf[curN] = st; prog.set('stars', starsOf); }
    if (curN >= unlocked) { unlocked = curN + 1; prog.set('unlocked', unlocked); }
    if (!bests[curN] || secs < bests[curN]) { bests[curN] = secs; prog.set('best', bests); }
  }
  if (first) B.submit(1);
  if (hopGain) { hops += hopGain - (goldHit ? 1 : 0); prog.set('hops', hops); hopChip(); }
  const nowTot = sumStars(), gained = PALS.map((p, i) => i).filter((i) => PALS[i].at > oldTot && PALS[i].at <= nowTot);
  save.set('riders', score); sfx.win(); buzz([30, 40, 60]); ui.flash(0.5); confetti(scene, new THREE.Vector3(0, 2, zSlot), 90); starEl.classList.add('hc-hidden'); nextEl.classList.add('hc-hidden');
  showWin({ st, newSticker, gained, hopGain, first });
}
function lose() { state = 'lost'; nextEl.classList.add('hc-hidden'); F.level(false, qi / totalRiders); sfx.fail(); buzz([60, 40, 90]); starEl.classList.add('hc-hidden'); nextEl.classList.add('hc-hidden'); hopBtn.classList.remove('hot'); showLose(); }
let lastDown = null; addEventListener('pointerdown', (e) => { lastDown = { clientX: e.clientX, clientY: e.clientY }; }, true);
ui.onTap((which) => { B.start(); if (which === 'start') { state = 'play'; starChip(); const d = lastDown; if (d) setTimeout(() => tapAt(d), 60); return; } });

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
input({ onTap: (e) => tapAt(e) });
function tapAt(e) {
    if (state !== 'play') return;
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
    const objs = []; for (const k in ims) objs.push(ims[k].tint, ims[k].fixed);
    const h = ray.intersectObjects(objs, false)[0];
    if (h) { const k = Object.keys(ims).find((t) => ims[t].tint === h.object || ims[t].fixed === h.object); const v = ims[k].list[h.instanceId]; if (v) return tapVehicle(v); }
    const gp = new THREE.Vector3(); ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.4), gp);
    let best = null, bd = 0.9; for (const v of vehicles) if (v.state === 'lot') { const d = v.pos.distanceTo(gp.setY(0)); if (d < bd) { bd = d; best = v; } }
    if (best) tapVehicle(best);
}

// the first seconds play themselves on lot 1 (Oct 26: under-1-minute players left within 10 s): until the first real touch the right car honks out twice
demo(() => {
  const lot = () => vehicles.filter((v) => v.state === 'lot').length, n0 = lot();
  if (n0 <= 2) return false; bot(); if (lot() === n0) return false;
}, { ready: () => state === 'play' && curN === 1 && !daily && !vehicles.some((v) => v.state === 'moving'), wait: 900, every: 1400, max: 2 });

// ---------------------------------------------------------------- bot: same greedy rule as the verifier (qa/playall.cjs drives it)
function stallPoint() {
  const seats = slots.filter(Boolean).map((s) => ({ c: s.color, n: s.seats })); let k = qi;
  for (; k < queue.length; k++) { const s = seats.find((x) => x.c === queue[k] && x.n > 0) || seats.find((x) => x.c === '*' && x.n > 0); if (!s) break; s.n--; }
  const fs = {}; for (const s of seats) if (s.c !== '*') fs[s.c] = (fs[s.c] || 0) + s.n; return { k, fs };
}
function bot() {
  if (state !== 'play' || freeSlot() < 0) return;
  const { k, fs } = stallPoint(); if (k >= queue.length || k - qi > 8) return;
  const free = vehicles.filter((v) => v.state === 'lot' && !v.route && v.z <= departed && exitable(v, occ, W, H)); if (!free.length) return;
  const pick = free.sort((a, b) => rankFor(a.color, queue, k, fs) - rankFor(b.color, queue, k, fs))[0];
  tapVehicle(pick);
}

loop((dt, t) => {
  if (!world) return;
  if (camBase) { if (camKick > 0.01) { camera.position.set(camBase.x + Math.sin(t * 90) * 0.12 * camKick, camBase.y - 0.35 * camKick + Math.sin(t * 70) * 0.08 * camKick, camBase.z); camKick *= Math.pow(0.88, dt); } else if (camKick > 0) { camKick = 0; camera.position.copy(camBase); } }
  for (const v of vehicles) {
    if (v.route) stepRoute(v, dt);
    v.shake = Math.max(0, v.shake - 0.05 * dt); v.pop = Math.max(0, v.pop - 0.06 * dt); v.squash = Math.max(0, (v.squash || 0) - 0.12 * dt);
    v.bob = v.state === 'moving' || v.state === 'leaving' ? Math.abs(Math.sin(t * 22)) * 0.025 : 0;
  }
  if (feverT > 0) feverT -= dt / 60;
  if (state === 'play' || state === 'won') boarding(dt);
  updateInstances(t); updatePassengers(dt, t);
  if (state === 'play') {
    if (qi >= queue.length && !flyers.length) win();
    else {
      const full = slots.every((s) => s && s.state === 'parked' && !s.leaving), headC = queue[qi];
      const stuck = full && !seatFor(headC) && !flyers.length;
      if (stuck) {
        const helps = hops > 0 && queue.length - qi >= 6 && queue.slice(qi + 3, qi + 13).some((c) => slots.some((s) => s && (s.color === c || s.color === '*') && s.seats > 0));
        if (!helps) lose();
        else if (!stuckAt) { stuckAt = performance.now(); ui.pop('JAMMED! tap ⏩', '#ff9f1c', 34, 28); hopBtn.classList.add('hot'); }
        else if (performance.now() - stuckAt > 5000) lose();
      } else if (stuckAt) { stuckAt = 0; hopBtn.classList.remove('hot'); }
    }
  }
});

applyPalette();
if (daily) { curN = 0; }
else if (level > 99999) level = 1;
curN = daily ? 0 : level; startLevel(); ui.start(); hopChip();
window.__game = {
  get state() { return state; }, get level() { return curN; }, get score() { return score; }, bot, getLevel, play, openMap, hop,
  get stars() { return starsFor(curN, costNow()); }, get cost() { return costNow(); }, get par() { return par; }, get stuck() { return stuckAt; },
  load(n) { play(n); },
  lose, win,
  get slots() { return slots.map((s) => s && [s.color, s.seats]); },
};
