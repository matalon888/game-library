// Honk Out! — original game. Tap vehicles to drive them out of a jammed car park. Free ones drive to the 5 parking
// spots at the stop; passengers board vehicles of their own colour in queue order; full vehicles leave.
// Jammed vehicles bump and back up. Spots full with no matching colour = jam (lose). Board everyone = win.
import { THREE, createStage, createUI, input, loop, sfx, tone, buzz, burst, confetti, store, rng, rounded, mat, clamp, lerp } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { board } from './kit/board.js';
const B = board({ game: 'honk-out', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 0.25 }, mode: 'sum' });   // world board: levels cleared today (RULES.md C)
const rbox = (w, h, d, r) => rounded(w - 1.8 * r, h - 1.8 * r, d, r);   // rounded() grows by its bevel; this keeps exact outer size

const COLORS = { red: '#ff4757', blue: '#2e86ff', yellow: '#ffc312', green: '#2ed573', purple: '#a55eea', orange: '#ff7f2a', pink: '#ff6bcb', cyan: '#1fd1d6' };
const CKEYS = Object.keys(COLORS);
const TYPES = { car: { len: 2, cap: 4 }, van: { len: 2, cap: 6 }, bus: { len: 3, cap: 10 } };
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const YAW = { up: Math.PI, down: 0, left: -Math.PI / 2, right: Math.PI / 2 };
const THEMES = [
  { bg: ['#cfe8ff', '#eef7ff'], ground: '#bfe8b5', lot: '#d7deea', pad: '#eef1f6', walk: '#f4e6cf', tree: '#57c26b' },
  { bg: ['#ffe3cf', '#fff6ec'], ground: '#f1dcb6', lot: '#e4d9cc', pad: '#f6efe6', walk: '#ffe8c2', tree: '#7bc95a' },
  { bg: ['#d9f2ff', '#f6fcff'], ground: '#eef6ff', lot: '#cfd9e8', pad: '#f4f8fc', walk: '#e2eef9', tree: '#3fae7f' },
  { bg: ['#e6dcff', '#f8f4ff'], ground: '#c9eac0', lot: '#d9d4e6', pad: '#f2eff8', walk: '#f7e4ef', tree: '#62c46a' },
];
const SLOTS = 5, SLOT_DX = 1.24;

const stage = createStage({ fov: 40, shadowSize: 11 });
const { scene, camera, sun } = stage;
const save = store('honkout');
const F = flow('honkout');
let level = save.get('level', 1), score = save.get('riders', 0), state = 'ready';
const ui = createUI({ title: 'HONK<br>OUT!', hint: 'Tap a car to drive it out', hand: '👆', score: false });

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
const pHead = new THREE.InstancedMesh(new THREE.SphereGeometry(0.135, 14, 10), mat('#ffd7ba'), PMAX);
pBody.castShadow = pHead.castShadow = true; scene.add(pBody, pHead);
for (let i = 0; i < PMAX; i++) pBody.setColorAt(i, new THREE.Color('#fff'));

// ---------------------------------------------------------------- level state
let D, W, H, zt, zRoad, zSlot, zq, theme, vehicles = [], occ = [], queue = [], qi = 0, slots = [], qOffset = 0, boardT = 0, riders = 0, totalRiders = 1;
let world = null, ims = {}, flyers = [], camFit = { y: 14, z: 10, tz: 0 };
const slotX = (i) => (i - (SLOTS - 1) / 2) * SLOT_DX;

// ---------------------------------------------------------------- procedural design (seeded) + greedy verifier
function design(n) {
  const fk = F.k(), R = rng(n * 4241 + 77), ri = (a, b) => a + Math.floor(R() * (b - a + 1));
  const W_ = clamp(3 + Math.ceil(n * 0.55), 4, 7), H_ = clamp(4 + Math.ceil(n * 0.55), 5, 9);
  const shape = n < 3 ? 'rect' : ['rect', 'circle', 'heart', 'diamond'][n % 4];
  const cx = (W_ - 1) / 2, cz = (H_ - 1) / 2;
  const mask = (i, j) => {
    const x = (i - cx) / (W_ / 2), y = (j - cz) / (H_ / 2);
    if (shape === 'circle') return x * x + y * y < 1.15;
    if (shape === 'diamond') return Math.abs(x) + Math.abs(y) < 1.35;
    if (shape === 'heart') { const X = x * 1.1, Y = -y * 1.15 + 0.25; return Math.pow(X * X + Y * Y - 1, 3) - X * X * Y * Y * Y < 0.15; }
    return true;
  };
  const maxV = Math.min(Math.round((4 + n * 2) * fk), 22), nc = clamp(n + 1, 2, 7);
  const pal = [...CKEYS].sort(() => R() - 0.5).slice(0, nc);
  for (let attempt = 0; attempt < 60; attempt++) {
    const g = Array.from({ length: W_ }, () => new Array(H_).fill(-1)); const vs = [];
    for (let t = 0; t < 900 && vs.length < maxV; t++) {
      const type = n === 1 ? 'car' : (R() < Math.min(0.35, 0.08 + n * 0.03) ? 'bus' : R() < 0.45 ? 'van' : 'car'), len = TYPES[type].len;
      const dir = Object.keys(DIRS)[ri(0, 3)], [dx, dz] = DIRS[dir]; const i0 = ri(0, W_ - 1), j0 = ri(0, H_ - 1);
      const cells = []; for (let k = 0; k < len; k++) cells.push([i0 - dx * k, j0 - dz * k]);   // head first
      if (cells.some(([i, j]) => i < 0 || j < 0 || i >= W_ || j >= H_ || !mask(i, j) || g[i][j] >= 0)) continue;
      const v = { id: vs.length, type, dir, cells, cap: TYPES[type].cap }; vs.push(v); cells.forEach(([i, j]) => g[i][j] = v.id);
    }
    if (vs.length < Math.min(maxV, 4)) continue;
    // make it unjammable: peel exitable vehicles; flip or drop stuck ones
    const rem = new Set(vs.map((v) => v.id)), order = [];
    while (rem.size) {
      const free = [...rem].filter((id) => exitable(vs[id], g, W_, H_));
      if (free.length) { const id = free[ri(0, free.length - 1)]; rem.delete(id); order.push(id); vs[id].cells.forEach(([i, j]) => g[i][j] = -2); continue; }
      const id = [...rem][ri(0, rem.size - 1)], v = vs[id];
      const opp = { up: 'down', down: 'up', left: 'right', right: 'left' }[v.dir];
      const flipped = { ...v, dir: opp, cells: [...v.cells].reverse() };
      if (exitable(flipped, g, W_, H_)) { v.dir = opp; v.cells.reverse(); } else { rem.delete(id); v.cells.forEach(([i, j]) => g[i][j] = -1); v.dead = true; }
    }
    const live = vs.filter((v) => !v.dead); live.forEach((v, k) => v.nid = k); const L = live.map((v) => ({ ...v, id: v.nid }));
    const ord = order.filter((id) => !vs[id].dead).map((id) => vs[id].nid);
    // colours: every palette colour used, consecutive vehicles in the peel order differ when possible
    ord.forEach((id, k) => { let c; do c = pal[ri(0, nc - 1)]; while (k && c === L[ord[k - 1]].color && nc > 1 && R() < 0.8); L[id].color = c; });
    pal.forEach((c, k) => { if (!L.some((v) => v.color === c) && L[ord[k]]) L[ord[k]].color = c; });
    // passenger queue in peel order, then mixed for difficulty
    const q = []; for (const id of ord) for (let k = 0; k < L[id].cap; k++) q.push(L[id].color);
    const mixW = n === 1 ? 0 : Math.min(12, Math.round((2 + n) * fk)), base = q.slice();
    for (let tries = 0; tries < 12; tries++) {
      const qq = base.slice(); const p = tries < 9 ? 0.5 : 0;
      for (let i = 0; i < qq.length; i++) if (R() < p) { const j = Math.min(qq.length - 1, i + ri(1, mixW)); [qq[i], qq[j]] = [qq[j], qq[i]]; }
      if (simulate(L, qq, W_, H_)) { const cells = []; for (let i = 0; i < W_; i++) for (let j = 0; j < H_; j++) if (mask(i, j)) cells.push([i, j]); return { W: W_, H: H_, vs: L, queue: qq, shape, cells }; }
    }
  }
  throw new Error('design failed');
}
function exitable(v, g, W_, H_, ignore = -1) {
  const [dx, dz] = DIRS[v.dir]; let [i, j] = v.cells[0];
  for (;;) { i += dx; j += dz; if (i < 0 || j < 0 || i >= W_ || j >= H_) return true; const o = g[i][j]; if (o >= 0 && o !== v.id && o !== ignore) return false; }
}
function rankFor(color, q, from, freeSeats) { let need = freeSeats[color] || 0; for (let k = from; k < q.length; k++) if (q[k] === color) { if (need === 0) return k; need--; } return 1e9; }
function simulate(vs, q, W_, H_) {
  const g = Array.from({ length: W_ }, () => new Array(H_).fill(-1)); vs.forEach((v) => v.cells.forEach(([i, j]) => g[i][j] = v.id));
  const rem = new Set(vs.map((v) => v.id)); const parked = []; let k = 0;
  while (k < q.length) {
    for (;;) { if (k >= q.length) break; const pv = parked.find((p) => p.color === q[k] && p.seats > 0); if (!pv) break; pv.seats--; k++; if (!pv.seats) parked.splice(parked.indexOf(pv), 1); }
    if (k >= q.length) break; if (parked.length >= SLOTS) return false;
    const free = [...rem].filter((id) => exitable(vs[id], g, W_, H_)); if (!free.length) return false;
    const fs = {}; parked.forEach((p) => fs[p.color] = (fs[p.color] || 0) + p.seats);
    const pick = free.map((id) => vs[id]).sort((a, b) => rankFor(a.color, q, k, fs) - rankFor(b.color, q, k, fs))[0];
    rem.delete(pick.id); pick.cells.forEach(([i, j]) => g[i][j] = -1); parked.push({ color: pick.color, seats: pick.cap });
  }
  return true;
}

// ---------------------------------------------------------------- world building
function cellPos(i, j) { return new THREE.Vector3(-W / 2 + i + 0.5, 0, zt + j + 0.5); }
function slab(w, d, h, color, x, z, y = 0, r = 0.3) { const m = new THREE.Mesh(rbox(w, d, h, r), mat(color, { roughness: 0.85 })); m.rotation.x = -Math.PI / 2; m.position.set(x, y - h / 2 + 0.001, z); m.receiveShadow = true; world.add(m); return m; }
function build(Ld) {
  if (world) scene.remove(world); world = new THREE.Group(); scene.add(world);
  for (const k in ims) { scene.remove(ims[k].tint, ims[k].fixed); } ims = {};
  W = Ld.W; H = Ld.H; zt = -H / 2 + 1.6; zRoad = zt - 1.15; zSlot = zRoad - 2.75; zq = zSlot - 2.7;
  theme = THEMES[(level - 1) % THEMES.length];
  document.body.style.setProperty('--bg1', theme.bg[0]); document.body.style.setProperty('--bg2', theme.bg[1]); document.body.style.setProperty('--ui', '#3b6cff');
  // ground + areas
  const gr = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), mat(theme.ground, { roughness: 1 })); gr.rotation.x = -Math.PI / 2; gr.position.y = -0.03; gr.receiveShadow = true; world.add(gr);
  const lotW = Math.max(W + 1.6, 7.4);
  slab(lotW, H + 1.0, 0.12, theme.lot, 0, zt + H / 2, 0.02, 0.5);
  // lot grid lines (one merged mesh)
  const lines = [];
  for (const [i, j] of Ld.cells) lines.push(part(new THREE.PlaneGeometry(0.92, 0.92), '#ffffff', M(-W / 2 + i + 0.5, 0.035, zt + j + 0.5, -Math.PI / 2)));
  const lm = new THREE.Mesh(merge(lines), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, transparent: true, opacity: 0.28 })); lm.receiveShadow = true; world.add(lm);
  // road with dashes
  const rw = 40; const road = new THREE.Mesh(new THREE.PlaneGeometry(rw, 1.5), mat('#4b5163', { roughness: 0.9 })); road.rotation.x = -Math.PI / 2; road.position.set(0, 0.012, zRoad); road.receiveShadow = true; world.add(road);
  const dashes = []; for (let x = -rw / 2; x < rw / 2; x += 1.1) dashes.push(part(new THREE.PlaneGeometry(0.55, 0.08), '#ffffff', M(x, 0.02, zRoad, -Math.PI / 2)));
  for (const s of [-1, 1]) dashes.push(part(new THREE.PlaneGeometry(rw, 0.06), '#ffffff', M(0, 0.02, zRoad + s * 0.68, -Math.PI / 2)));
  // parking pad + dashed slot outlines + station walk
  slab(SLOTS * SLOT_DX + 0.9, 3.7, 0.1, theme.pad, 0, zSlot + 0.05, 0.03, 0.3);
  for (let i = 0; i < SLOTS; i++) {
    const x = slotX(i), w = 1.06, d = 3.15;
    for (let t = -d / 2; t < d / 2 - 0.1; t += 0.32) for (const s of [-1, 1]) dashes.push(part(new THREE.PlaneGeometry(0.05, 0.2), '#9aa6bb', M(x + s * w / 2, 0.09, zSlot + t + 0.1, -Math.PI / 2)));
    for (let t = -w / 2; t < w / 2 - 0.05; t += 0.3) dashes.push(part(new THREE.PlaneGeometry(0.18, 0.05), '#9aa6bb', M(x + t + 0.1, 0.09, zSlot - d / 2, -Math.PI / 2)));
  }
  world.add(new THREE.Mesh(merge(dashes), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })));
  slab(11.5, 2.1, 0.14, theme.walk, 0, zq - 0.45, 0.04, 0.4);
  // decor: stop sign, trees, lamps (merged: one mesh)
  const dec = [];
  dec.push(part(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 8), '#7d8597', M(-0.75, 0.65, zq + 0.35)), part(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 20), '#2e86ff', M(-0.75, 1.35, zq + 0.35, Math.PI / 2)),
    part(new THREE.CylinderGeometry(0.2, 0.2, 0.07, 20), '#ffffff', M(-0.75, 1.35, zq + 0.36, Math.PI / 2)));
  for (const [x, z, s] of [[-5.3, zq - 0.6, 1], [5.4, zq - 0.3, 0.9], [-5.6, zRoad + 2.2, 1.1], [5.6, zRoad + 3.4, 1], [-5.4, zt + H - 0.6, 0.9], [5.5, zt + H + 0.2, 1.1]]) {
    dec.push(part(new THREE.CylinderGeometry(0.1, 0.13, 0.6, 8), '#9a6a3c', M(x, 0.3, z)), part(new THREE.IcosahedronGeometry(0.62 * s, 1), theme.tree, M(x, 0.95 * s + 0.25, z)), part(new THREE.IcosahedronGeometry(0.42 * s, 1), theme.tree, M(x + 0.25, 1.35 * s + 0.2, z + 0.1)));
  }
  // little town behind the stop: houses the riders come from
  const roof = (w, d, col) => { const sh = new THREE.Shape(); sh.moveTo(-w / 2 - 0.15, 0); sh.lineTo(w / 2 + 0.15, 0); sh.lineTo(0, w * 0.42); sh.closePath(); const r = new THREE.ExtrudeGeometry(sh, { depth: d + 0.3, bevelEnabled: false }); r.translate(0, 0, -(d + 0.3) / 2); return r; };
  for (const [x, w, h, col, rc] of [[0.6, 3.0, 1.7, '#fff1d6', '#ff6b6b'], [-2.9, 2.0, 1.3, '#d9ecff', '#5d8cff'], [3.6, 1.6, 1.1, '#ffe0ef', '#ff9a3c']]) {
    const z = zq - 2.3; dec.push(part(rbox(w, h, 1.4, 0.08), col, M(x, h / 2, z)), part(roof(w, 1.4, rc), rc, M(x, h, z)));
    dec.push(part(rbox(0.5, 0.8, 0.06, 0.03), '#9a6a3c', M(x, 0.4, z + 0.71)));
    for (const s of [-1, 1]) if (w > 1.7) dec.push(part(rbox(0.42, 0.38, 0.05, 0.03), '#8fd3ff', M(x + s * w * 0.3, h * 0.62, z + 0.71)));
  }
  for (const x of [-3.6, 3.6]) dec.push(part(new THREE.CylinderGeometry(0.05, 0.06, 1.6, 8), '#59607a', M(x, 0.8, zRoad - 0.95)), part(new THREE.SphereGeometry(0.16, 12, 8), '#fff5c2', M(x, 1.65, zRoad - 0.95)));
  const dm = new THREE.Mesh(merge(dec), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 })); dm.castShadow = true; world.add(dm);
  // vehicles (instanced per type: tinted body + fixed details)
  vehicles = Ld.vs.map((v) => ({ ...v, cells: v.cells.map((c) => c.slice()), seats: v.cap, state: 'lot', pos: new THREE.Vector3(), yaw: YAW[v.dir], shake: 0, pop: 0, bump: 0 }));
  for (const t of Object.keys(TYPES)) {
    const list = vehicles.filter((v) => v.type === t); if (!list.length) continue;
    const tint = new THREE.InstancedMesh(VGEO[t].tint, tintMat, list.length), fixed = new THREE.InstancedMesh(VGEO[t].fixed, fixedMat, list.length);
    tint.castShadow = fixed.castShadow = true; tint.receiveShadow = true; scene.add(tint, fixed); ims[t] = { tint, fixed, list };
    list.forEach((v, k) => { v.k = k; tint.setColorAt(k, new THREE.Color(COLORS[v.color])); });
    tint.instanceColor.needsUpdate = true;
  }
  occ = Array.from({ length: W }, () => new Array(H).fill(-1));
  for (const v of vehicles) { v.cells.forEach(([i, j]) => occ[i][j] = v.id); const c = v.cells.reduce((a, [i, j]) => a.add(cellPos(i, j)), new THREE.Vector3()).multiplyScalar(1 / v.cells.length); v.pos.copy(c); v.home = c.clone(); }
  // camera fit
  const halfW = Math.max(lotW / 2 + 0.35, 4.3), zTop = zq - 2.6, zBot = zt + H + 0.6;
  camFit = { halfW, zTop, zBot };
}
function placeCamera() {
  const { halfW, zTop, zBot } = camFit, tilt = THREE.MathUtils.degToRad(58), fovV = THREE.MathUtils.degToRad(camera.fov);
  const spanZ = (zBot - zTop), needH = spanZ * Math.sin(tilt) * 0.5 + 0.9;
  const dist = Math.max(halfW / (Math.tan(fovV / 2) * camera.aspect), needH / Math.tan(fovV / 2)) * 1.02;
  const tz = (zTop + zBot) / 2 - 0.55;
  camera.position.set(0, Math.sin(tilt) * dist, tz + Math.cos(tilt) * dist); camera.lookAt(0, 0, tz);
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
    }
    tint.instanceMatrix.needsUpdate = fixed.instanceMatrix.needsUpdate = true;
  }
}
function roundPath(pts, r = 0.7) {   // polyline with quadratic-rounded corners
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
function tapVehicle(v) {
  if (state !== 'play' || v.state !== 'lot' || v.route) return;
  const [dx, dz] = DIRS[v.dir]; let [i, j] = v.cells[0], steps = 0, blocker = null;
  for (;;) { i += dx; j += dz; if (i < 0 || j < 0 || i >= W || j >= H) break; const o = occ[i][j]; if (o >= 0 && o !== v.id) { blocker = vehicles[o]; break; } steps++; }
  if (blocker) {   // bump: roll forward to the blocker, shake, back up
    const dist = steps + 0.12, dir = new THREE.Vector3(dx, 0, dz), from = v.home.clone();
    tone(190, 0.12, 'square', 0.08, 0.7); buzz(35);
    drive(v, [from, from.clone().addScaledVector(dir, dist)], 14, () => { blocker.shake = 1; v.shake = 0.6; sfx.bounce(); tone(120, 0.1, 'sawtooth', 0.06, 0.8); drive(v, [v.pos.clone(), from], 8, () => v.pos.copy(from), true); });
    return;
  }
  const s = freeSlot();
  if (s < 0) { v.shake = 1; ui.pop('NO SPACE!', '#ff4757', 30, 30); tone(150, 0.2, 'square', 0.08, 0.6); buzz(60); return; }
  slots[s] = v; v.slot = s; v.state = 'moving'; v.cells.forEach(([a, b]) => occ[a][b] = -1);
  honk(); buzz(15);
  const x0 = -W / 2, x1 = W / 2, zb = zt + H, out = 0.75, front = v.pos.clone().addScaledVector(new THREE.Vector3(dx, 0, dz), TYPES[v.type].len / 2);
  const pts = [v.pos.clone()]; let E;
  if (v.dir === 'up') E = new THREE.Vector3(front.x, 0, zRoad);
  else if (v.dir === 'down') { E = new THREE.Vector3(front.x, 0, zb + out); const side = front.x < 0 ? x0 - out - 0.2 : x1 + out + 0.2; pts.push(E, new THREE.Vector3(side, 0, zb + out)); E = new THREE.Vector3(side, 0, zRoad); }
  else { E = new THREE.Vector3(v.dir === 'left' ? x0 - out - 0.2 : x1 + out + 0.2, 0, front.z); pts.push(E); E = new THREE.Vector3(E.x, 0, zRoad); }
  pts.push(E, new THREE.Vector3(slotX(s), 0, zRoad), new THREE.Vector3(slotX(s), 0, zSlot));
  drive(v, pts, 15, () => { v.state = 'parked'; v.yaw = Math.PI; v.pop = 1; tone(660, 0.06, 'triangle', 0.08, 1.2); burst(scene, v.pos.clone().setY(0.3), '#ffffff', 8, { speed: 0.05, up: 0.04, size: 0.4 }); });
}
let lastHonk = 0;
function honk() { const n = performance.now(); if (n - lastHonk < 120) return; lastHonk = n; tone(420, 0.09, 'square', 0.05, 1); setTimeout(() => tone(520, 0.12, 'square', 0.05, 1), 90); }

// ---------------------------------------------------------------- passengers
const pathPts = () => [[0.0, zq + 0.35], [3.9, zq + 0.35], [3.9, zq - 0.25], [-3.9, zq - 0.25], [-3.9, zq - 0.85], [3.9, zq - 0.85]].map(([x, z]) => new THREE.Vector3(x, 0, z));
let qPath = null;
function qPos(s, out) {
  let d = s * 0.38;
  for (let i = 1; i < qPath.length; i++) { const a = qPath[i - 1], b = qPath[i], L = a.distanceTo(b); if (d <= L) return out.lerpVectors(a, b, d / L); d -= L; }
  return out.copy(qPath[qPath.length - 1]);
}
const pm = new THREE.Matrix4(), pq = new THREE.Quaternion(), ps = new THREE.Vector3(1, 1, 1), pv = new THREE.Vector3(), hv = new THREE.Vector3();
function updatePassengers(dt, t) {
  qOffset *= Math.pow(0.78, dt); if (qOffset < 0.01) qOffset = 0;
  let n = 0;
  const vis = Math.min(queue.length - qi, PMAX - 8);
  for (let k = 0; k < vis; k++) {
    qPos(k + qOffset, pv); const walk = qOffset > 0.02 ? Math.abs(Math.sin(t * 16 + k)) * 0.06 : Math.abs(Math.sin(t * 3 + k * 0.7)) * 0.015;
    setP(n++, pv.x, 0.3 + walk, pv.z, queue[qi + k]);
  }
  for (const f of flyers) { f.t += dt / 60 / 0.3; const k = Math.min(1, f.t); pv.lerpVectors(f.a, f.b, k); pv.y = 0.24 + Math.sin(k * Math.PI) * 1.0 + k * 0.3; setP(n++, pv.x, pv.y, pv.z, f.color, 1 - k * 0.6); }
  flyers = flyers.filter((f) => f.t < 1 || (f.cb(), false));
  for (let k = n; k < PMAX; k++) { pm.makeScale(0, 0, 0); pBody.setMatrixAt(k, pm); pHead.setMatrixAt(k, pm); }
  pBody.count = pHead.count = PMAX; pBody.instanceMatrix.needsUpdate = pHead.instanceMatrix.needsUpdate = true; pBody.instanceColor.needsUpdate = true;
}
const tmpC = new THREE.Color();
function setP(k, x, y, z, color, sc = 1) {
  ps.setScalar(sc); pm.compose(hv.set(x, y, z), pq, ps); pBody.setMatrixAt(k, pm); pm.compose(hv.set(x, y + 0.33 * sc, z), pq, ps); pHead.setMatrixAt(k, pm);
  pBody.setColorAt(k, tmpC.set(COLORS[color]));
}
function boarding(dt) {
  boardT -= dt / 60; if (boardT > 0 || qi >= queue.length) return;
  const c = queue[qi], v = slots.find((s) => s && s.state === 'parked' && s.color === c && s.seats > 0 && !s.leaving);
  if (!v) return;
  boardT = 0.065; v.seats--; qi++; qOffset += 1; riders++; score++;
  const a = qPos(0, new THREE.Vector3()), b = v.pos.clone();
  flyers.push({ a, b, t: 0, color: c, cb: () => { v.squash = 1; tone(880 + (v.cap - v.seats) * 30, 0.03, 'sine', 0.06, 1.2); } });
  ui.progress(riders / totalRiders); ui.pill(`👥 ${queue.length - qi}`);
  if (v.seats === 0) { v.leaving = true; setTimeout(() => leave(v), 420); }
}
function leave(v) {
  if (v.state !== 'parked') return; v.state = 'leaving'; sfx.coin(); honk(); buzz(20); ui.pop(['FULL!', 'BEEP BEEP!', 'GO GO!', 'NICE!'][v.id % 4], COLORS[v.color], 32, 30);
  burst(scene, v.pos.clone().setY(1.0), [COLORS[v.color], '#ffffff', '#ffd23f'], 14, { speed: 0.08, up: 0.08, size: 0.5 });
  const x = v.pos.x, dirX = x >= 0 ? 1 : -1;
  drive(v, [v.pos.clone(), new THREE.Vector3(x, 0, zRoad)], 10, () => {
    slots[v.slot] = null;
    drive(v, [v.pos.clone(), new THREE.Vector3(x + dirX * 1.2, 0, zRoad), new THREE.Vector3(dirX * 16, 0, zRoad)], 16, () => v.state = 'gone');
  }, true);
}

// ---------------------------------------------------------------- flow
let Lcur;
function startLevel() {
  Lcur = design(level); build(Lcur); placeCamera();
  queue = Lcur.queue; qi = 0; slots = new Array(SLOTS).fill(null); qOffset = 0; flyers = []; riders = 0; totalRiders = queue.length; qPath = pathPts();
  ui.levels(level); ui.progress(0); ui.pill(`👥 ${queue.length}`);
}
let endT = 0;
function win() { if (state === 'play') B.submit(1); state = 'won'; F.level(true); endT = performance.now(); level++; save.set('level', level); save.set('riders', score); sfx.win(); buzz([30, 40, 60]); ui.flash(0.5); confetti(scene, new THREE.Vector3(0, 2, zSlot), 90); ui.win(level - 1, `${totalRiders} riders home!`); }
function lose() { state = 'lost'; F.level(false, qi / totalRiders); sfx.fail(); buzz([60, 40, 90]); ui.lose('JAMMED!', 'No spot left for the right colour.'); }
ui.onTap((which) => { B.start(); if (which === 'start') { state = 'play'; return; } startLevel(); state = 'play'; });

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
input({
  onTap(e) {
    if (state !== 'play') return;
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
    const objs = []; for (const k in ims) objs.push(ims[k].tint, ims[k].fixed);
    const h = ray.intersectObjects(objs, false)[0];
    if (h) { const k = Object.keys(ims).find((t) => ims[t].tint === h.object || ims[t].fixed === h.object); const v = ims[k].list[h.instanceId]; if (v) return tapVehicle(v); }
    // forgiving: nearest lot vehicle to the ground point
    const gp = new THREE.Vector3(); ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.4), gp);
    let best = null, bd = 0.9; for (const v of vehicles) if (v.state === 'lot') { const d = v.pos.distanceTo(gp.setY(0)); if (d < bd) { bd = d; best = v; } }
    if (best) tapVehicle(best);
  },
});

// ---------------------------------------------------------------- bot: same greedy rule as the verifier
function stallPoint() {   // where would the queue stop boarding with the vehicles already parked / on their way?
  const seats = slots.filter(Boolean).map((s) => ({ c: s.color, n: s.seats })); let k = qi;
  for (; k < queue.length; k++) { const s = seats.find((x) => x.c === queue[k] && x.n > 0); if (!s) break; s.n--; }
  const fs = {}; for (const s of seats) fs[s.c] = (fs[s.c] || 0) + s.n; return { k, fs };
}
function bot() {
  if (state !== 'play' || freeSlot() < 0) return;
  const { k, fs } = stallPoint(); if (k >= queue.length || k - qi > 8) return;
  const free = vehicles.filter((v) => v.state === 'lot' && !v.route && exitable(v, occ, W, H)); if (!free.length) return;
  const pick = free.sort((a, b) => rankFor(a.color, queue, k, fs) - rankFor(b.color, queue, k, fs))[0];
  tapVehicle(pick);
}

loop((dt, t) => {
  if (!world) return;
  for (const v of vehicles) {
    if (v.route) stepRoute(v, dt);
    v.shake = Math.max(0, v.shake - 0.05 * dt); v.pop = Math.max(0, v.pop - 0.06 * dt); v.squash = Math.max(0, (v.squash || 0) - 0.12 * dt);
    v.bob = v.state === 'moving' || v.state === 'leaving' ? Math.abs(Math.sin(t * 22)) * 0.025 : 0;
  }
  if (state === 'play' || state === 'won') boarding(dt);
  updateInstances(t); updatePassengers(dt, t);
  if (state === 'play') {
    if (qi >= queue.length && !flyers.length) win();
    else {
      const full = slots.every((s) => s && s.state === 'parked' && !s.leaving), headC = queue[qi];
      if (full && !slots.some((s) => s.color === headC && s.seats > 0) && !flyers.length) lose();
    }
  }
});

startLevel(); ui.start();
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; }, bot, design, simulate,
  load(n) { level = n; ui.hideStart(); ui.els.win.classList.add('hc-hidden'); ui.els.lose.classList.add('hc-hidden'); startLevel(); state = 'play'; },
};
