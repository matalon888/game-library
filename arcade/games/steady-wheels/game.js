// Steady Wheels — original careful-driving / parking game. Hold to drive, slide to steer the wheel, tap the lever for
// reverse; follow the road and stop the vehicle inside the green bay without scraping anything.
import { THREE, createStage, createUI, input, loop, burst, confetti, sfx, tone, buzz, store, lerp, clamp, rng, rounded } from './kit/hc.js';
import { flow } from './kit/flow.js';

import { board } from './kit/board.js';
const WB = board({ game: 'steady-wheels', label: 'Levels cleared', limits: { maxRun: 1, maxPerSec: 0.15 }, mode: 'sum' });
const S = store('steadywheels');
const F = flow('steadywheels');
let level = S.get('level', 1), coinsTotal = S.get('coins', 0);
const stage = createStage({ fov: 42, shadowSize: 26 });
const { scene, camera, renderer, sun, hemi } = stage;
camera.far = 400; camera.updateProjectionMatrix();
const ui = createUI({ title: 'STEADY<br>WHEELS', hint: 'Tap to roll · hold to drive · slide to steer', hand: '👆', score: false });
hemi.intensity = 1.25; hemi.groundColor.set('#cfe8c0'); sun.intensity = 1.8; sun.shadow.mapSize.set(2048, 2048);
scene.fog = new THREE.Fog('#d8eeff', 70, 190);

// ------------------------------------------------------------------ helpers
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(sx, sy, sz));
function merge(parts) {
  const pos = [], nor = [], col = [], c = new THREE.Color();
  for (const [g0, m, color] of parts) {
    const g = g0.index ? g0.toNonIndexed() : g0.clone(); g.applyMatrix4(m); c.set(color);
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(c.r, c.g, c.b); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g;
}
const vmat = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.05, ...o });
// rounded box lying the right way: w (x) × h (y) × d (z)
const rbox = (w, h, d, r = 0.12) => { const g = rounded(w - 1.8 * r, d - 1.8 * r, h, r); g.rotateX(-Math.PI / 2); return g; };
const fwd = th => V(Math.sin(th), 0, -Math.cos(th)), rgt = th => V(Math.cos(th), 0, Math.sin(th));
function canvasTex(w, h, draw, rep = [1, 1]) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 8; return t; }

// ------------------------------------------------------------------ vehicles
const VEH = [
  { name: 'Hatchback', len: 4.2, wid: 2.0, wb: 2.6, vmax: 8.5, col: '#ff5d5d', dash: '#ff5d5d' },
  { name: 'Pickup', len: 5.3, wid: 2.2, wb: 3.3, vmax: 8, col: '#3a86ff', dash: '#3a86ff' },
  { name: 'Fire Engine', len: 8.2, wid: 2.6, wb: 4.8, vmax: 7, col: '#e63946', dash: '#e63946' },
  { name: 'City Bus', len: 9.6, wid: 2.7, wb: 5.6, vmax: 6.5, col: '#ffb703', dash: '#ffb703' },
  { name: 'Tanker', len: 9.2, wid: 2.6, wb: 5.4, vmax: 6.5, col: '#4c6ef5', dash: '#4c6ef5' },
];
function buildVehicle(spec) {
  const { len: L, wid: W } = spec, parts = [], c = spec.col, glass = '#2b3a55', dark = '#2a2c31';
  const add = (g, m, col) => parts.push([g, m, col]);
  if (spec.name === 'Hatchback' || spec.name === 'Pickup') {
    add(rbox(W, 0.75, L, 0.25), M(0, 0.75, 0), c);
    if (spec.name === 'Hatchback') { add(rbox(W * 0.86, 0.62, L * 0.6, 0.2), M(0, 1.36, 0.25), glass); add(rbox(W * 0.84, 0.14, L * 0.4, 0.07), M(0, 1.72, 0.35), c); }
    else { add(rbox(W * 0.9, 0.66, 2.1, 0.2), M(0, 1.42, -0.55), glass); add(rbox(W * 0.86, 0.14, 1.4, 0.07), M(0, 1.8, -0.45), c); add(rbox(W * 0.95, 0.35, 2.0, 0.08), M(0, 1.18, 1.35), '#1d2a44'); }
  } else if (spec.name === 'Fire Engine') {
    add(rbox(W, 1.5, L * 0.98, 0.18), M(0, 1.35, 0), c); add(rbox(W * 1.01, 0.3, L * 0.9, 0.06), M(0, 1.0, 0.1), '#ffffff');
    add(rbox(W * 0.98, 0.7, 1.0, 0.1), M(0, 1.55, -L / 2 + 0.6), glass);
    for (const sx of [-0.45, 0.45]) add(new THREE.BoxGeometry(0.12, 0.12, L * 0.75), M(sx, 2.35, 0.4), '#d9dde4');
    for (let i = 0; i < 9; i++) add(new THREE.BoxGeometry(0.9, 0.06, 0.08), M(0, 2.35, -L * 0.3 + i * L * 0.09), '#d9dde4');
    add(new THREE.BoxGeometry(1.2, 0.18, 0.3), M(0, 2.2, -L / 2 + 0.9), '#ff2244'); add(new THREE.BoxGeometry(0.5, 0.2, 0.32), M(0.35, 2.22, -L / 2 + 0.9), '#2f6bff');
    for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(0.04, 0.6, 1.1), M(sd * W / 2, 1.45, -0.6 + i * 1.5), '#c22a35');
    for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(W * 0.8, 0.08, 0.06), M(0, 1.2 + i * 0.35, L / 2 * 0.98 + 0.02), '#d9dde4');
    add(new THREE.CylinderGeometry(0.35, 0.35, W * 0.7, 14), M(0, 2.25, L / 2 - 0.6, 0, 0, Math.PI / 2), '#f2f2f2');
  } else if (spec.name === 'City Bus') {
    add(rbox(W, 2.2, L, 0.3), M(0, 1.6, 0), c); add(rbox(W * 1.01, 0.75, L * 0.9, 0.1), M(0, 2.05, 0.2), glass);
    add(rbox(W * 0.95, 1.0, 0.2, 0.08), M(0, 1.9, -L / 2 + 0.02), glass); add(rbox(W * 0.9, 0.2, L * 0.7, 0.08), M(0, 2.78, 0.3), '#f1f1f1');
    add(rbox(W * 1.01, 0.25, L * 0.98, 0.06), M(0, 1.05, 0), '#ffffff');
    add(rbox(W * 0.8, 0.7, 0.1, 0.05), M(0, 2.1, L / 2 + 0.01), glass); add(new THREE.BoxGeometry(W * 0.5, 0.35, 0.06), M(0, 1.2, L / 2 + 0.03), '#2a2c31');
    add(rbox(1.2, 0.35, 1.6, 0.1), M(0, 2.85, -1.5), '#cfd4dc'); add(rbox(1.0, 0.3, 1.2, 0.1), M(0, 2.85, 2.2), '#cfd4dc');
    for (let i = 0; i < 6; i++) for (const sd of [-1, 1]) add(new THREE.BoxGeometry(0.04, 0.6, 0.1), M(sd * W * 0.505, 2.05, -L / 2 + 1.6 + i * 1.35), c);
  } else {
    add(rbox(W, 1.8, 2.4, 0.25), M(0, 1.45, -L / 2 + 1.2), c); add(rbox(W * 0.98, 0.7, 0.9, 0.1), M(0, 1.8, -L / 2 + 0.55), glass);
    add(new THREE.BoxGeometry(W * 0.8, 0.3, L - 2.6), M(0, 0.8, 1.2), dark);
    const tk = new THREE.CapsuleGeometry(W * 0.46, L - 3.9, 6, 18); tk.rotateX(Math.PI / 2); add(tk, M(0, 1.75, 1.3), '#e9edf2');
    for (let i = 0; i < 3; i++) add(new THREE.TorusGeometry(W * 0.47, 0.05, 4, 20), M(0, 1.75, -0.3 + i * 2.3), '#aab3c0');
    add(new THREE.BoxGeometry(W * 0.9, 0.12, L - 3.4), M(0, 2.98, 1.3), '#aab3c0'); add(new THREE.CylinderGeometry(0.4, 0.4, 0.2, 12), M(0, 3.0, 1.3), '#4c6ef5');
    for (let i = 0; i < 5; i++) add(new THREE.BoxGeometry(0.5, 0.05, 0.06), M(0.4, 1.4 + i * 0.32, L / 2 + 0.15), '#aab3c0');
  }
  // lights + bumpers
  for (const sd of [-1, 1]) { add(new THREE.BoxGeometry(0.4, 0.22, 0.08), M(sd * (W / 2 - 0.35), 0.95, -L / 2 - 0.02), '#fff6c2'); add(new THREE.BoxGeometry(0.4, 0.2, 0.08), M(sd * (W / 2 - 0.35), 0.95, L / 2 + 0.02), '#ff2a3a'); }
  add(rbox(W * 0.98, 0.25, 0.25, 0.08), M(0, 0.55, -L / 2 + 0.05), '#d5d9e0'); add(rbox(W * 0.98, 0.25, 0.25, 0.08), M(0, 0.55, L / 2 - 0.05), '#d5d9e0');
  const g = new THREE.Group(), body = new THREE.Mesh(merge(parts), vmat({ roughness: 0.35 })); body.castShadow = true; body.receiveShadow = true; g.add(body); g.body = body;
  // wheels
  const wr = spec.len > 7 ? 0.55 : 0.42, wg = merge([[new THREE.CylinderGeometry(wr, wr, 0.38, 18), M(0, 0, 0, 0, 0, Math.PI / 2), '#24262b'], [new THREE.CylinderGeometry(wr * 0.55, wr * 0.55, 0.4, 10), M(0, 0, 0, 0, 0, Math.PI / 2), '#cfd4dc']]);
  const wm = vmat({ roughness: 0.7 }); g.wheels = [];
  const axles = spec.len > 7 ? [-spec.wb / 2, spec.wb / 2 - 0.6, spec.wb / 2 + 0.6] : [-spec.wb / 2, spec.wb / 2];
  axles.forEach((z, i) => { for (const sd of [-1, 1]) { const piv = new THREE.Group(); piv.position.set(sd * (W / 2 - 0.12), wr, z); const w = new THREE.Mesh(wg, wm); w.castShadow = true; piv.add(w); g.add(piv); g.wheels.push({ piv, w, front: i === 0 }); } });
  g.wr = wr;
  return g;
}

// ------------------------------------------------------------------ world
const ASPHALT = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#4b4f58'; x.fillRect(0, 0, w, h); for (let i = 0; i < 3500; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.08)'; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); } });
const PAVE = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#d9d6d0'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(120,115,110,.35)'; x.lineWidth = 2; for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { x.strokeRect(i * 32 + (j % 2) * 16, j * 32, 32, 32); } });
const GRASS = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#86c66a'; x.fillRect(0, 0, w, h); for (let i = 0; i < 1500; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(40,110,40,.12)' : 'rgba(220,255,160,.1)'; x.fillRect(Math.random() * w, Math.random() * h, 3, 3); } }, [40, 40]);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.MeshStandardMaterial({ map: GRASS, roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
let world = new THREE.Group(); scene.add(world);

let path = [], obst = [], cones = [], coins = [], zone = null, veh = null, spec, roadHW = 4;
function ribbon(pts, w0, w1, y, mat, uvScale = 0.2) {
  const pos = [], uv = [], idx = [];
  let acc = 0;
  pts.forEach((p, i) => { if (i) acc += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z); const r = rgt(p.h); pos.push(p.x + r.x * w0, y, p.z + r.z * w0, p.x + r.x * w1, y, p.z + r.z * w1); uv.push(0, acc * uvScale, 1, acc * uvScale); });
  for (let i = 0; i < pts.length - 1; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  mat.side = THREE.DoubleSide; const m = new THREE.Mesh(g, mat); m.receiveShadow = true; world.add(m); return m;
}
function nearestOnPath(x, z, from = 0, to = path.length) {
  let bi = 0, bd = 1e9; for (let i = Math.max(0, from); i < Math.min(path.length, to); i++) { const d = (path[i].x - x) ** 2 + (path[i].z - z) ** 2; if (d < bd) { bd = d; bi = i; } } return [bi, Math.sqrt(bd)];
}
const BUILD_COLS = ['#f6f1e7', '#cfe3ff', '#ffe1c7', '#e4f3d9', '#f9d9e6'];
function facadeTex(col) { return canvasTex(128, 256, (x, w, h) => { x.fillStyle = col; x.fillRect(0, 0, w, h); for (let j = 0; j < 7; j++) for (let i = 0; i < 3; i++) { x.fillStyle = '#4e79b8'; x.fillRect(14 + i * 38, 16 + j * 34, 24, 22); x.fillStyle = 'rgba(255,255,255,.55)'; x.fillRect(14 + i * 38, 16 + j * 34, 24, 4); x.fillStyle = 'rgba(0,0,0,.1)'; x.fillRect(10 + i * 38, 39 + j * 34, 32, 3); } }); }
const FACADES = BUILD_COLS.map(facadeTex);

function buildLevel() {
  world.traverse(o => { if (o.geometry) o.geometry.dispose(); }); scene.remove(world); world = new THREE.Group(); scene.add(world);
  const r = rng(level * 977 + 3), fk = F.k(); spec = VEH[(level - 1) % VEH.length];
  roadHW = (3.6 + (spec.wid - 2) * 1.2 + Math.max(0, 1.4 - level * 0.08)) / fk;
  // turtle-walk road
  path = []; let x = 0, z = 0, h = 0;
  const step = (len, turn, R) => { const n = Math.ceil(len); for (let i = 0; i < n; i++) { if (turn) h += turn / n; x += Math.sin(h) * len / n; z -= Math.cos(h) * len / n; path.push({ x, z, h }); } };
  path.push({ x, z, h }); step(22, 0);
  const pieces = 4 + Math.min(4, Math.floor(level / 2)), minR = 9 + spec.len * 0.9;
  let total = 0;
  for (let k = 0; k < pieces; k++) {
    let a = (0.6 + r() * 0.9) * (r() < 0.5 ? -1 : 1) * Math.min(1.15, (0.7 + level * 0.06) * fk);
    if (Math.abs(h + a) > 1.9) a = -a;
    const R = minR + r() * 8; step(R * Math.abs(a), a, R); step(5 + r() * 9, 0);
  }
  step(spec.len + 14, 0);
  // ground layers: sidewalk, asphalt, edge lines, centre dashes
  ribbon(path, -roadHW - 2.4, roadHW + 2.4, 0.02, new THREE.MeshStandardMaterial({ map: PAVE, roughness: 0.9 }), 0.12);
  ribbon(path, -roadHW, roadHW, 0.04, new THREE.MeshStandardMaterial({ map: ASPHALT, roughness: 0.85 }));
  const yel = new THREE.MeshStandardMaterial({ color: '#ffc21a', roughness: 0.6 });
  ribbon(path, -roadHW + 0.25, -roadHW + 0.55, 0.06, yel); ribbon(path, roadHW - 0.55, roadHW - 0.25, 0.06, yel);
  { const dashes = []; for (let i = 6; i < path.length - spec.len - 10; i += 4) dashes.push(path[i]);
    const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.25, 1.8).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#f4f4f4' }), dashes.length);
    dashes.forEach((p, i) => im.setMatrixAt(i, M(p.x, 0.065, p.z, 0, -p.h, 0))); world.add(im); }
  // painted direction arrows
  { const at = new THREE.MeshBasicMaterial({ map: canvasTex(64, 96, (x2) => { x2.fillStyle = '#fff'; x2.beginPath(); x2.moveTo(32, 4); x2.lineTo(60, 40); x2.lineTo(42, 40); x2.lineTo(42, 92); x2.lineTo(22, 92); x2.lineTo(22, 40); x2.lineTo(4, 40); x2.closePath(); x2.fill(); }), transparent: true, opacity: 0.75, depthWrite: false });
    for (let i = 26; i < path.length - spec.len - 16; i += 22) { const p = path[i], m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.2).rotateX(-Math.PI / 2), at); m.position.set(p.x, 0.07, p.z); m.rotation.y = -p.h; world.add(m); } }
  obst = []; cones = []; coins = [];
  // parking bay at the end, flanked by parked cars
  const end = path[path.length - 1], zh = end.h, zl = spec.len + 2.2, zw = spec.wid + 1.5;
  const zc = V(end.x, 0, end.z).addScaledVector(fwd(zh), -zl / 2 - 1.2);
  zone = { x: zc.x, z: zc.z, h: zh, hl: zl / 2, hw: zw / 2 };
  { const g = new THREE.Group(); g.position.set(zc.x, 0.08, zc.z); g.rotation.y = -zh;
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(zw, zl).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#39e36b', transparent: true, opacity: 0.45, depthWrite: false })); g.add(fill);
    const lm = new THREE.MeshBasicMaterial({ color: '#7dff9a' });
    for (const [w, d, px, pz] of [[zw, 0.18, 0, -zl / 2], [zw, 0.18, 0, zl / 2], [0.18, zl, -zw / 2, 0], [0.18, zl, zw / 2, 0]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), lm); b.position.set(px, 0.03, pz); g.add(b); }
    const wall = new THREE.Mesh(new THREE.BoxGeometry(zw, 1.6, zl, 1, 1, 1), new THREE.MeshBasicMaterial({ color: '#53ff86', transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide })); wall.position.y = 0.8; g.add(wall);
    const arrow = new THREE.Group(); const am = new THREE.MeshStandardMaterial({ color: '#2fe36a', emissive: '#1a9a40', emissiveIntensity: 0.4 });
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.2, 4), am); head.rotation.x = Math.PI; const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.2, 0.5), am); shaft.position.y = 1.1; arrow.add(head, shaft); arrow.position.y = 4.5; g.add(arrow);
    g.userData.arrow = arrow; g.userData.fill = fill; world.add(g); zone.g = g; }
  const fz = fwd(zh), rz = rgt(zh);
  for (const sd of [-1, 1]) {
    const ps = VEH[Math.floor(r() * 2)], pc = buildVehicle({ ...ps, col: ['#9b5de5', '#f15bb5', '#00bbf9', '#00c49a', '#adb5bd'][Math.floor(r() * 5)] });
    const p = zc.clone().addScaledVector(rz, sd * (zw / 2 + 1.45)).addScaledVector(fz, (r() - 0.5) * 1.5);
    pc.position.copy(p); pc.rotation.y = -zh + (r() - 0.5) * 0.1; world.add(pc);
    obst.push({ type: 'box', x: p.x, z: p.z, h: zh, hl: ps.len / 2, hw: ps.wid / 2, name: 'car' });
  }
  { const p = zc.clone().addScaledVector(fz, zl / 2 + 1.6); const b = new THREE.Mesh(rbox(zw + 6, 1.0, 0.8, 0.2), new THREE.MeshStandardMaterial({ color: '#f2c94c' })); b.position.set(p.x, 0.5, p.z); b.rotation.y = -zh; b.castShadow = true; world.add(b); obst.push({ type: 'box', x: p.x, z: p.z, h: zh, hl: 0.4, hw: (zw + 6) / 2, name: 'barrier' }); }
  // props: trees, buildings, lamps (hard), cones (knockable), coins
  const trees = [], tryPlace = (minD) => { for (let k = 0; k < 20; k++) { const i = Math.floor(r() * path.length), p = path[i], side = r() < 0.5 ? -1 : 1, d = minD + r() * 30, q = V(p.x, 0, p.z).addScaledVector(rgt(p.h), side * d); const [, nd] = nearestOnPath(q.x, q.z); if (nd > minD - 0.5 && V(q.x, 0, q.z).distanceTo(V(zc.x, 0, zc.z)) > zl + 4) return [q, p.h, side]; } return null; };
  for (let k = 0; k < 12; k++) { const t = tryPlace(roadHW + 7.5); if (!t) continue; const [q, hh, side] = t; const bw = 7 + r() * 5, bd = 6 + r() * 4, bh = 7 + r() * 10; const ci = Math.floor(r() * 5);
    const fm = FACADES[ci].clone(); fm.needsUpdate = true; fm.repeat.set(Math.round(bw / 4), Math.round(bh / 4));
    const bg = new THREE.BoxGeometry(bw, bh, bd), ix = bg.index.array, sides = [], top = [];
    for (const f of [0, 1, 4, 5]) sides.push(...ix.slice(f * 6, f * 6 + 6)); top.push(...ix.slice(12, 18));
    bg.setIndex([...sides, ...top]); bg.clearGroups(); bg.addGroup(0, sides.length, 0); bg.addGroup(sides.length, 6, 1);
    const b = new THREE.Mesh(bg, [new THREE.MeshStandardMaterial({ map: fm }), new THREE.MeshStandardMaterial({ color: '#9aa3ad' })]);
    b.position.set(q.x, bh / 2, q.z); b.rotation.y = -hh; b.castShadow = b.receiveShadow = true; world.add(b); obst.push({ type: 'box', x: q.x, z: q.z, h: hh, hl: bd / 2, hw: bw / 2, name: 'building' }); }
  for (let k = 0; k < 160; k++) { const t = tryPlace(roadHW + 3.2); if (!t) continue; const [q] = t; if (obst.some(o => o.type === 'box' && Math.hypot(o.x - q.x, o.z - q.z) < o.hw + o.hl)) continue; trees.push([q, 0.8 + r() * 0.8]); }
  { const trunkG = new THREE.CylinderGeometry(0.22, 0.3, 1.6, 7); trunkG.translate(0, 0.8, 0);
    const topG = merge([[new THREE.ConeGeometry(1.8, 3.4, 8), M(0, 2.8, 0), '#2f8f4e'], [new THREE.ConeGeometry(1.35, 2.7, 8), M(0, 4.2, 0), '#3aa35b'], [new THREE.ConeGeometry(0.85, 1.9, 8), M(0, 5.4, 0), '#4cb86a']]);
    const ti = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: '#7a5233' }), trees.length), fi = new THREE.InstancedMesh(topG, vmat({ flatShading: true }), trees.length);
    trees.forEach(([q, s], i) => { const m = M(q.x, 0, q.z, 0, r() * 6, 0, s); ti.setMatrixAt(i, m); fi.setMatrixAt(i, m); obst.push({ type: 'circle', x: q.x, z: q.z, rad: 0.45 * s, name: 'tree' }); });
    ti.castShadow = fi.castShadow = true; world.add(ti, fi); }
  { const bushes = []; for (let k = 0; k < 90; k++) { const t = tryPlace(roadHW + 2.9); if (!t) continue; const [q] = t; if (obst.some(o => o.type === 'box' && circleBox(q.x, q.z, 1.2, o))) continue; bushes.push(q); }
    const bg = merge([[new THREE.IcosahedronGeometry(0.9, 1), M(0, 0.6, 0, 0, 0, 0, 1, 0.8, 1), '#4cae4f'], [new THREE.IcosahedronGeometry(0.6, 1), M(0.6, 0.5, 0.2), '#5cc25e'], [new THREE.IcosahedronGeometry(0.55, 1), M(-0.5, 0.45, -0.3), '#3f9a45']]);
    const bi = new THREE.InstancedMesh(bg, vmat({ flatShading: true }), bushes.length); bushes.forEach((q, i) => bi.setMatrixAt(i, M(q.x, 0, q.z, 0, r() * 6, 0, 0.7 + r() * 0.6))); bi.castShadow = true; world.add(bi); }
  const lampG = merge([[new THREE.CylinderGeometry(0.1, 0.14, 4.2, 8), M(0, 2.1, 0), '#3b4250'], [new THREE.BoxGeometry(0.12, 0.12, 1.2), M(0, 4.15, -0.5), '#3b4250'], [new THREE.SphereGeometry(0.22, 10, 8), M(0, 4.05, -1.05), '#fff6c2'], [new THREE.CylinderGeometry(0.28, 0.32, 0.25, 8), M(0, 0.12, 0), '#3b4250']]);
  for (let i = 22, sd = 1; i < path.length - spec.len - 8; i += 16 + Math.floor(r() * 8), sd = -sd) {
    const p = path[i], q = V(p.x, 0, p.z).addScaledVector(rgt(p.h), sd * (roadHW + 0.9)); const [, nd] = nearestOnPath(q.x, q.z); if (nd < roadHW + 0.6) continue;
    const l = new THREE.Mesh(lampG, vmat()); l.position.copy(q); l.rotation.y = -p.h + (sd > 0 ? -Math.PI / 2 : Math.PI / 2); l.castShadow = true; world.add(l); obst.push({ type: 'circle', x: q.x, z: q.z, rad: 0.3, name: 'lamp' });
  }
  const coneG = merge([[new THREE.ConeGeometry(0.3, 0.8, 12), M(0, 0.45, 0), '#ff7a1a'], [new THREE.CylinderGeometry(0.2, 0.24, 0.14, 12), M(0, 0.42, 0), '#ffffff'], [new THREE.BoxGeometry(0.62, 0.08, 0.62), M(0, 0.04, 0), '#ff7a1a']]);
  // cones on the inside of tight bends
  for (let i = 12; i < path.length - 2; i += 3) {
    const dh = path[Math.min(path.length - 1, i + 2)].h - path[i - 2].h; if (Math.abs(dh) < 0.05 || r() > 0.4) continue;
    const sd = dh > 0 ? 1 : -1, p = path[i], q = V(p.x, 0, p.z).addScaledVector(rgt(p.h), sd * (roadHW - 0.6));
    const c = new THREE.Mesh(coneG, vmat()); c.position.copy(q); c.castShadow = true; world.add(c); cones.push({ m: c, x: q.x, z: q.z, v: null, hit: false });
  }
  const coinG = merge([[new THREE.CylinderGeometry(0.55, 0.55, 0.14, 24), M(0, 0, 0, Math.PI / 2, 0, 0), '#ffc21a'], [new THREE.CylinderGeometry(0.38, 0.38, 0.16, 24), M(0, 0, 0, Math.PI / 2, 0, 0), '#ffe066']]);
  const coinM = vmat({ metalness: 0.4, roughness: 0.25, emissive: '#6b4a00', emissiveIntensity: 0.3 });
  for (let i = 24; i < path.length - spec.len - 10; i += 11 + Math.floor(r() * 7)) { const p = path[i], lat = (r() - 0.5) * roadHW; const q = V(p.x, 1.1, p.z).addScaledVector(rgt(p.h), lat); const c = new THREE.Mesh(coinG, coinM); c.position.copy(q); c.castShadow = true; world.add(c); coins.push({ m: c, got: false, t: 0 }); }
  // vehicle
  if (veh) scene.remove(veh.g);
  const g = buildVehicle(spec); scene.add(g);
  veh = { g, x: path[12].x, z: path[12].z, th: 0, v: 0, steer: 0, dist: 0, inv: 0 };
  camYaw = 0; damage = 0; got = 0; gear = 1; holding = false; steerIn = 0; parkT = 0; maxIdx = 0;
  setGear(1); updDamage(); ui.levels(level); ui.progress(0); ui.pill('🪙 ' + coinsTotal);
  dashColor(spec.dash);
}

// ------------------------------------------------------------------ dashboard (SVG overlay)
const dash = document.createElement('div'); dash.className = 'sw-dash';
dash.innerHTML = `<svg class="bg" viewBox="0 0 390 270" preserveAspectRatio="none"><defs><linearGradient id="dg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a4e57"/><stop offset="1" stop-color="#2d3036"/></linearGradient></defs>
<path id="trim" d="M0 60 Q0 22 40 18 L350 18 Q390 22 390 60 L390 270 L0 270Z" fill="#ff5d5d"/>
<path d="M10 70 Q12 40 46 38 L344 38 Q378 40 380 70 L390 270 L0 270Z" fill="url(#dg)"/>
<rect x="56" y="200" width="44" height="40" rx="6" fill="#26292e"/><g fill="#3a3e46">${[0, 1, 2, 3, 4].map(i => `<rect x="62" y="${205 + i * 7}" width="32" height="3" rx="1"/>`).join('')}</g>
<circle cx="74" cy="250" r="9" fill="#26292e"/><circle cx="100" cy="250" r="9" fill="#26292e"/></svg>
<div class="sw-horn" id="horn">🚨</div>
<svg class="sw-gear" id="gear" viewBox="0 0 90 170"><rect x="10" y="6" width="70" height="158" rx="14" fill="#2a2c31"/><rect x="38" y="22" width="14" height="118" rx="7" fill="#15161a"/>
<text id="gD" x="66" y="52" font-family="Baloo 2,system-ui" font-weight="800" font-size="26" fill="#ff4d4d" text-anchor="middle">D</text>
<text id="gR" x="66" y="128" font-family="Baloo 2,system-ui" font-weight="800" font-size="26" fill="#d0d4da" text-anchor="middle">R</text>
<g id="knob" style="transition:transform .18s cubic-bezier(.3,1.6,.5,1)"><rect x="40" y="38" width="10" height="34" rx="4" fill="#c9ced6"/><circle cx="45" cy="34" r="17" fill="#1b1c20"/><circle cx="40" cy="28" r="5" fill="#3c3f47"/></g></svg>
<div class="sw-wheel"><svg id="wheel" viewBox="0 0 200 200"><circle cx="100" cy="100" r="86" fill="none" stroke="#1d1f23" stroke-width="20"/><circle cx="100" cy="100" r="86" fill="none" stroke="#33363d" stroke-width="5" stroke-dasharray="6 10"/>
<path d="M100 100 L18 92 M100 100 L182 92 M100 100 L100 180" stroke="#1d1f23" stroke-width="20" stroke-linecap="round"/><circle cx="100" cy="100" r="34" fill="#26282d"/><path d="M100 82 L114 106 L86 106Z" fill="#3f434b"/><rect x="92" y="10" width="16" height="10" rx="3" fill="#ffc21a"/></svg></div>`;
document.body.appendChild(dash);
const dmgEl = document.createElement('div'); dmgEl.className = 'sw-dmg'; document.body.appendChild(dmgEl);
const $ = id => document.getElementById(id);
function dashColor(c) { $('trim').setAttribute('fill', c); }
let gear = 1, holding = false, steerIn = 0, holdX = 0, damage = 0, got = 0, parkT = 0, camYaw = 0, shake = 0, maxIdx = 0, botUntil = 0, bot = { hold: false, steer: 0 };
function setGear(gv) { gear = gv; $('knob').style.transform = gv > 0 ? 'translateY(0)' : 'translateY(76px)'; $('gD').setAttribute('fill', gv > 0 ? '#ff4d4d' : '#d0d4da'); $('gR').setAttribute('fill', gv < 0 ? '#ff4d4d' : '#d0d4da'); }
$('gear').addEventListener('pointerdown', e => { e.stopPropagation(); if (state !== 'play') return; setGear(-gear); tone(gear > 0 ? 300 : 220, 0.08, 'square', 0.08, 1); buzz(12); });
$('horn').addEventListener('pointerdown', e => { e.stopPropagation(); tone(392, 0.25, 'sawtooth', 0.07, 1); tone(494, 0.25, 'sawtooth', 0.05, 1); buzz(20); });
function updDamage() { dmgEl.innerHTML = [0, 1, 2].map(i => `<span class="${i < damage ? 'off' : ''}">❤️</span>`).join(''); }

// ------------------------------------------------------------------ input: hold = drive, slide = steer
let state = 'ready';
input({
  onDown: (e) => { if (state !== 'play') return; holding = true; holdX = e.clientX; steerIn = 0; },
  onMove: (dx, dy, e) => { if (!holding) return; steerIn = clamp((e.clientX - holdX) / 110, -1, 1); },
  onUp: () => { holding = false; steerIn = 0; },
  onTap: (e) => { if (state !== 'play') return; tapUntil = performance.now() + 450; const d = e.clientX - innerWidth / 2; tapSteer = Math.abs(d) > 50 ? Math.sign(d) * 0.7 : 0; },   // a tap = a short roll, nosing toward the tapped side
});
let tapUntil = 0, tapSteer = 0;
ui.onTap(w => { WB.start(); if (w === 'start') { state = 'play'; } else { buildLevel(); state = 'play'; } });

// ------------------------------------------------------------------ collision helpers
function circleBox(cx, cz, rad, o) {
  const c = Math.cos(o.h), s = Math.sin(o.h), dx = cx - o.x, dz = cz - o.z;
  const lx = dx * c + dz * s, lz = -dx * s + dz * c;     // into box frame (x = right, z = back)
  const px = clamp(lx, -o.hw, o.hw), pz = clamp(lz, -o.hl, o.hl);
  return (lx - px) ** 2 + (lz - pz) ** 2 < rad * rad;
}
function vehCircles(x, z, th) {
  const f = fwd(th), n = Math.max(2, Math.ceil(spec.len / spec.wid) + 1), out = [], rad = spec.wid / 2 * 0.92;
  for (let i = 0; i < n; i++) { const k = -spec.len / 2 + rad + (spec.len - 2 * rad) * i / (n - 1); out.push([x + f.x * k, z + f.z * k, rad]); }
  return out;
}
function hits(x, z, th) {
  for (const [cx, cz, rad] of vehCircles(x, z, th)) for (const o of obst) {
    if (o.type === 'circle') { if ((cx - o.x) ** 2 + (cz - o.z) ** 2 < (rad + o.rad) ** 2) return o; }
    else if (circleBox(cx, cz, rad, o)) return o;
  }
  return null;
}
function inZone() {
  const f = fwd(veh.th), r = rgt(veh.th), c = Math.cos(zone.h), s = Math.sin(zone.h);
  for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const x = veh.x + f.x * a * spec.len / 2 + r.x * b * spec.wid / 2 - zone.x, z = veh.z + f.z * a * spec.len / 2 + r.z * b * spec.wid / 2 - zone.z;
    const lx = x * c + z * s, lz = -x * s + z * c; if (Math.abs(lx) > zone.hw || Math.abs(lz) > zone.hl) return false;
  }
  return true;
}

// ------------------------------------------------------------------ main loop
const MAXSTEER = 0.6;
loop((dt, t) => {
  const sec = dt / 60;
  if (!veh) return;
  const tapRoll = !holding && performance.now() < tapUntil;
  const drive = state === 'play' && (holding || tapRoll || (performance.now() < botUntil && bot.hold));
  const sIn = performance.now() < botUntil ? bot.steer : tapRoll ? tapSteer : steerIn;
  veh.steer = lerp(veh.steer, (state === 'play' && (holding || tapRoll || performance.now() < botUntil)) ? sIn : veh.steer * 0.9, 0.18 * dt);
  const target = drive ? spec.vmax * gear * (gear < 0 ? 0.55 : 1) : 0;
  veh.v += (target - veh.v) * (drive ? 0.035 : 0.12) * dt;
  if (Math.abs(veh.v) < 0.02 && !drive) veh.v = 0;
  // off-road = slower
  const [ni, nd] = nearestOnPath(veh.x, veh.z, maxIdx - 30, maxIdx + 40);
  if (nd > roadHW + 2.4) veh.v *= Math.pow(0.97, dt);
  maxIdx = Math.max(maxIdx, ni);
  const nth = veh.th + veh.v * Math.tan(veh.steer * MAXSTEER) / spec.wb * sec, f = fwd(nth);
  const nx = veh.x + f.x * veh.v * sec, nz = veh.z + f.z * veh.v * sec;
  const h = Math.abs(veh.v) > 0.05 ? hits(nx, nz, nth) : null;
  veh.inv = Math.max(0, veh.inv - sec);
  if (h) {
    if (veh.inv <= 0 && Math.abs(veh.v) > 1.2 && state === 'play') {
      damage++; updDamage(); veh.inv = 0.9; shake = 1; ui.flash(0.35); sfx.smash(); buzz([40, 30, 40]);
      ui.pop(damage >= 3 ? 'WRECKED!' : 'SCRATCH!', '#ff4d6d', 40, 32);
      burst(scene, V(nx, 1.2, nz).addScaledVector(fwd(veh.th), Math.sign(veh.v) * spec.len / 2), ['#ffd23f', '#ffffff', '#ff8c42'], 14, { speed: 0.12, up: 0.12, size: 0.6 });
      if (damage >= 3) { state = 'lost'; F.level(false, maxIdx / (path.length - 1)); holding = false; ui.lose('WRECKED!', 'Three scrapes and you\'re out'); sfx.fail(); }
    }
    veh.v = -veh.v * 0.25;
  } else { veh.th = nth; veh.x = nx; veh.z = nz; }
  veh.dist += veh.v * sec;
  // cones (knockable) + coins
  for (const c of cones) {
    if (!c.v) { for (const [cx, cz, rad] of vehCircles(veh.x, veh.z, veh.th)) if ((cx - c.x) ** 2 + (cz - c.z) ** 2 < (rad + 0.35) ** 2 && Math.abs(veh.v) > 0.3) { const d = V(c.x - cx, 0, c.z - cz).normalize(); c.v = V(d.x * 0.15 + fwd(veh.th).x * veh.v * 0.02, 0.18, d.z * 0.15 + fwd(veh.th).z * veh.v * 0.02); c.spin = (Math.random() - 0.5) * 0.4; tone(600, 0.06, 'square', 0.06, 0.6); ui.pop('BONK!', '#ff9a3c', 26, 36); buzz(10); break; } }
    else if (c.m.position.y > -1) { c.v.y -= 0.01 * dt; c.m.position.addScaledVector(c.v, dt); c.m.rotation.x += c.spin * dt; c.m.rotation.z += c.spin * dt; if (c.m.position.y < 0 && c.v.y < 0) { c.m.position.y = 0; c.v.multiplyScalar(0.5); c.v.y = Math.abs(c.v.y) > 0.03 ? -c.v.y : 0; if (c.v.length() < 0.02) c.m.position.y = -0.0001, c.v.set(0, 0, 0), c.spin = 0; } }
  }
  for (const c of coins) {
    if (c.got) { c.t += sec; c.m.position.y += 0.15 * dt; c.m.scale.setScalar(Math.max(0.01, 1 - c.t * 2)); c.m.rotation.y += 0.4 * dt; if (c.t > 0.5) c.m.visible = false; continue; }
    c.m.rotation.y += 0.05 * dt; c.m.position.y = 1.1 + Math.sin(t * 3 + c.m.position.x) * 0.15;
    if (Math.hypot(c.m.position.x - veh.x, c.m.position.z - veh.z) < spec.len / 2 + 0.6 && state === 'play') { c.got = true; got++; coinsTotal++; S.set('coins', coinsTotal); ui.pill('🪙 ' + coinsTotal); sfx.coin(); buzz(8); burst(scene, c.m.position, ['#ffd23f', '#fff3b0'], 8, { speed: 0.08, up: 0.08, size: 0.5 }); }
  }
  // parking check
  if (state === 'play') {
    ui.progress(Math.min(0.98, maxIdx / (path.length - 1)));
    const inside = inZone();
    zone.g.userData.fill.material.opacity = inside ? 0.6 + Math.sin(t * 10) * 0.1 : 0.42;
    if (inside && !drive && Math.abs(veh.v) < 0.25) {
      parkT += sec; if (parkT > 0.35) {
        state = 'won'; F.level(true); WB.submit(1); const ang = Math.abs(((veh.th - zone.h) % Math.PI + Math.PI * 1.5) % Math.PI - Math.PI / 2);
        const perfect = ang < 0.12 && damage === 0; ui.progress(1);
        ui.pop(perfect ? 'PERFECT PARK!' : 'PARKED!', '#7dff9a', 44, 30); sfx.win(); buzz([20, 40, 20]); ui.flash(0.5);
        for (let i = 0; i < 3; i++) setTimeout(() => confetti(scene, V(zone.x, 2, zone.z), 60), i * 180);
        ui.win(level, `${spec.name} parked${perfect ? ' perfectly' : ''} · 🪙 ${got}`); level++; S.set('level', level);
      }
    } else parkT = 0;
  }
  // visuals: vehicle pose, wheels, wheel graphic, camera
  veh.g.position.set(veh.x, 0, veh.z); veh.g.rotation.y = -veh.th;
  veh.g.body.rotation.z = -veh.steer * Math.abs(veh.v) * 0.006; veh.g.body.rotation.x = (target - veh.v) * 0.004;
  for (const w of veh.g.wheels) { w.w.rotation.x -= veh.v * sec / veh.g.wr; if (w.front) w.piv.rotation.y = -veh.steer * MAXSTEER; }
  $('wheel').style.transform = `rotate(${veh.steer * 200}deg)`;
  zone.g.userData.arrow.position.y = 4.5 + Math.abs(Math.sin(t * 3)) * 1.2; zone.g.userData.arrow.rotation.y += 0.03 * dt;
  camYaw = lerp(camYaw, veh.th, 0.035 * dt);
  const cf = fwd(camYaw - 0.32), back = 15 + spec.len * 1.0, up = 12.5 + spec.len * 0.75;
  shake = Math.max(0, shake - sec * 3);
  camera.position.set(veh.x - cf.x * back + (Math.random() - 0.5) * shake * 0.4, up + (Math.random() - 0.5) * shake * 0.4, veh.z - cf.z * back);
  { const lf = fwd(camYaw); camera.lookAt(veh.x + lf.x * (3 + spec.len * 0.25), 0, veh.z + lf.z * (3 + spec.len * 0.25)); }
  if (camera.view === null || camera.view.offsetY !== Math.round(innerHeight * 0.13)) { camera.setViewOffset(innerWidth, innerHeight, 0, Math.round(innerHeight * 0.13), innerWidth, innerHeight); }
  stage.followLight(V(veh.x, 0, veh.z).addScaledVector(cf, 8));
});

buildLevel();
ui.start();

// ------------------------------------------------------------------ test hooks + bot (pure-pursuit along the road, stop in the bay)
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return got; },
  bot() {
    if (state !== 'play') return;
    if (gear < 0) setGear(1);
    const [ni] = nearestOnPath(veh.x, veh.z, maxIdx - 30, maxIdx + 40);
    const zoneDist = Math.hypot(zone.x - veh.x, zone.z - veh.z);
    const ld = clamp(4 + spec.wb * 0.9, 5, 10), tp = zoneDist < spec.len + 8 ? { x: zone.x, z: zone.z } : path[Math.min(path.length - 1, ni + Math.round(ld))];
    const dx = tp.x - veh.x, dz = tp.z - veh.z, f = fwd(veh.th), r = rgt(veh.th), lx = dx * r.x + dz * r.z, lf = dx * f.x + dz * f.z;
    const L2 = lx * lx + lf * lf, delta = Math.atan2(2 * spec.wb * lx, L2);
    bot.steer = clamp(delta / MAXSTEER, -1, 1);
    // drive until the vehicle sits in the bay (front past its centre), then let go
    const c = Math.cos(zone.h), s = Math.sin(zone.h), lz = -(veh.x - zone.x) * s + (veh.z - zone.z) * c;
    bot.hold = !(inZone() || (zoneDist < spec.len && lz < 0.4 && Math.abs(veh.v) > 2.5));
    botUntil = performance.now() + 300;
  },
};
