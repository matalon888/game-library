// Twistwood art built in code: canvas wood, painted plywood plates, brass + lacquer screws, toolboxes, holes.
// Every material is shared; meshes are cheap groups. Colours: 9 screw colours, each with its own head symbol so the
// game also reads without colour (plus, slot, square, triangle, star, hex, diamond, heart, ring).
import { THREE } from './kit/hc.js';
import { RoundedBoxGeometry } from './kit/addons/geometries/RoundedBoxGeometry.js';
import { R as PLATE_R } from './logic.js';

export const SCREW = [
  { name: 'Red', c: '#e5484d', e: '🟥' }, { name: 'Orange', c: '#f7862a', e: '🟧' }, { name: 'Yellow', c: '#f6c425', e: '🟨' },
  { name: 'Lime', c: '#86cf45', e: '🟩' }, { name: 'Green', c: '#17a46f', e: '🟢' }, { name: 'Sky', c: '#2bb4ea', e: '🔵' },
  { name: 'Blue', c: '#3f5cdb', e: '🟦' }, { name: 'Purple', c: '#9152d1', e: '🟪' }, { name: 'Pink', c: '#ec4c95', e: '🩷' },
];
export const PAINT = ['#f7867c', '#45c99a', '#58a6f2', '#a785f2', '#f89c4c', '#f27bb2', '#8fcb52'];
const SYM = ['plus', 'slot', 'square', 'tri', 'star', 'hex', 'diamond', 'heart', 'ring'];

const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const ctex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
const rnd = (a, b) => a + Math.random() * (b - a);

/** wood planks with grain. dir 'h' = planks run horizontally */
export function woodTex({ base = '#d9a066', dark = '#a8693a', planks = 5, n = 1024, dir = 'h', knots = 4, grain = 1, gap = 0.5 } = {}) {
  const [c, x] = cv(n); const B = new THREE.Color(base), D = new THREE.Color(dark), h = n / planks;
  for (let p = 0; p < planks; p++) {
    const k = rnd(-0.07, 0.07), col = B.clone().offsetHSL(rnd(-0.01, 0.01), rnd(-0.04, 0.04), k);
    x.fillStyle = '#' + col.getHexString(); x.fillRect(0, p * h, n, h);
    // grain: long wavy lines
    const ph = rnd(0, 9);
    for (let i = 0; i < 46 * grain; i++) {
      const y0 = p * h + rnd(0, h), a = rnd(0.6, 3.2), f = rnd(0.002, 0.008);
      x.strokeStyle = `rgba(${D.r * 255 | 0},${D.g * 255 | 0},${D.b * 255 | 0},${rnd(0.06, 0.2)})`; x.lineWidth = rnd(0.6, 2.4);
      x.beginPath(); for (let px = 0; px <= n; px += 8) { const py = y0 + Math.sin(px * f + ph + i) * a + Math.sin(px * 0.031 + i) * 0.6; px ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke();
    }
    for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(255,240,215,${rnd(0.02, 0.06)})`; x.fillRect(rnd(0, n), p * h + rnd(0, h), rnd(20, 120), rnd(1, 2)); }
    for (let i = 0; i < knots / planks * 2; i++) if (Math.random() < 0.5) {
      const kx = rnd(40, n - 40), ky = p * h + rnd(h * 0.25, h * 0.75), rw = rnd(8, 18);
      for (let r = rw; r > 1; r -= 2.5) { x.strokeStyle = `rgba(${D.r * 200 | 0},${D.g * 200 | 0},${D.b * 200 | 0},0.22)`; x.lineWidth = 1.4; x.beginPath(); x.ellipse(kx, ky, r * 2.2, r, 0, 0, 7); x.stroke(); }
    }
    if (gap) { x.fillStyle = `rgba(60,30,10,${0.35 * gap})`; x.fillRect(0, p * h, n, 2.5); x.fillStyle = `rgba(255,235,200,${0.25 * gap})`; x.fillRect(0, p * h + 2.5, n, 1.5); }
  }
  if (dir === 'v') { const [c2, x2] = cv(n); x2.translate(n / 2, n / 2); x2.rotate(Math.PI / 2); x2.drawImage(c, -n / 2, -n / 2); return ctex(c2); }
  return ctex(c);
}
/** near-white grain map that tints a painted plate (wood shows through the lacquer) */
function paintGrain() {
  const n = 512, [c, x] = cv(n); x.fillStyle = '#fff'; x.fillRect(0, 0, n, n);
  for (let i = 0; i < 70; i++) {
    const y0 = rnd(0, n), a = rnd(1, 5), f = rnd(0.004, 0.012), ph = rnd(0, 9);
    x.strokeStyle = `rgba(120,90,60,${rnd(0.04, 0.11)})`; x.lineWidth = rnd(0.8, 2.2);
    x.beginPath(); for (let px = 0; px <= n; px += 8) { const py = y0 + Math.sin(px * f + ph) * a; px ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke();
  }
  return ctex(c);
}
/** plywood edge: thin layer stripes */
function plyTex() {
  const n = 256, [c, x] = cv(n, 64); const cols = ['#e9cfa4', '#d7b07a', '#f1dbb3', '#caa06b'];
  for (let i = 0; i < 8; i++) { x.fillStyle = cols[i % cols.length]; x.fillRect(0, i * 8, n, 8); }
  for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(90,60,30,${rnd(0.03, 0.1)})`; x.fillRect(rnd(0, n), rnd(0, 64), rnd(4, 30), 1); }
  const t = ctex(c); t.repeat.set(2, 1 / 0.22); return t;
}
/** painted beadboard wall: vertical boards in a soft colour */
export function wallTex(base = '#9fb89a') {
  const n = 1024, [c, x] = cv(n); const B = new THREE.Color(base); const boards = 8, w = n / boards;
  for (let b = 0; b < boards; b++) {
    x.fillStyle = '#' + B.clone().offsetHSL(0, 0, rnd(-0.02, 0.02)).getHexString(); x.fillRect(b * w, 0, w, n);
    for (let i = 0; i < 26; i++) { x.strokeStyle = `rgba(40,60,40,${rnd(0.03, 0.07)})`; x.lineWidth = rnd(0.6, 1.8); const x0 = b * w + rnd(4, w - 4); x.beginPath(); x.moveTo(x0, 0); for (let y = 0; y <= n; y += 16) x.lineTo(x0 + Math.sin(y * 0.01 + i) * 1.5, y); x.stroke(); }
    x.fillStyle = 'rgba(30,45,30,.28)'; x.fillRect(b * w, 0, 3, n); x.fillStyle = 'rgba(255,255,240,.22)'; x.fillRect(b * w + 3, 0, 2, n);
    x.fillStyle = 'rgba(30,45,30,.12)'; x.fillRect(b * w + w / 2 - 1, 0, 2, n);
  }
  return ctex(c);
}
/** soft round shadow blob */
export function blobTex() {
  const [c, x] = cv(128); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(40,20,10,.5)'); g.addColorStop(0.6, 'rgba(40,20,10,.2)'); g.addColorStop(1, 'rgba(40,20,10,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); return t;
}
/** a sparkle star sprite */
export function starTex() {
  const [c, x] = cv(64); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#fff'; x.beginPath(); x.moveTo(32, 2); x.lineTo(35.5, 28.5); x.lineTo(62, 32); x.lineTo(35.5, 35.5); x.lineTo(32, 62); x.lineTo(28.5, 35.5); x.lineTo(2, 32); x.lineTo(28.5, 28.5); x.closePath(); x.fill();
  return new THREE.CanvasTexture(c);
}

// ---------------------------------------------------------------- materials (shared)
export const MAT = {};
export function initMaterials() {
  MAT.brass = new THREE.MeshStandardMaterial({ color: '#e0b25a', metalness: 0.9, roughness: 0.28 });
  MAT.brassDark = new THREE.MeshStandardMaterial({ color: '#b98a3a', metalness: 0.85, roughness: 0.38 });
  MAT.steel = new THREE.MeshStandardMaterial({ color: '#d9d4cc', metalness: 0.9, roughness: 0.3 });
  MAT.hole = new THREE.MeshBasicMaterial({ color: '#2a1608' });
  MAT.holeIn = new THREE.MeshStandardMaterial({ color: '#4a2a12', roughness: 0.9 });
  MAT.ply = new THREE.MeshStandardMaterial({ map: plyTex(), roughness: 0.75 });
  MAT.grain = paintGrain();
  MAT.paint = PAINT.map(c => new THREE.MeshPhysicalMaterial({ color: c, map: MAT.grain, roughness: 0.38, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.25, envMapIntensity: 0.3 }));
  MAT.head = SCREW.map(s => new THREE.MeshPhysicalMaterial({ color: s.c, roughness: 0.22, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.06 }));
  MAT.sym = SCREW.map(s => new THREE.MeshStandardMaterial({ color: new THREE.Color(s.c).multiplyScalar(0.42), roughness: 0.6 }));
  MAT.box = SCREW.map(s => new THREE.MeshPhysicalMaterial({ color: s.c, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15 }));
  MAT.cream = new THREE.MeshStandardMaterial({ color: '#fff4e2', roughness: 0.5 });
  MAT.glow = new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending });
  MAT.white = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.45 });
  return MAT;
}

// ---------------------------------------------------------------- symbols (head slots, box labels)
function symShape(k, s = 1) {
  const S = new THREE.Shape();
  const poly = pts => { S.moveTo(pts[0][0] * s, pts[0][1] * s); for (const p of pts.slice(1)) S.lineTo(p[0] * s, p[1] * s); S.closePath(); };
  const reg = (n, r, rot = 0) => Array.from({ length: n }, (_, i) => [Math.cos(rot + i * 2 * Math.PI / n) * r, Math.sin(rot + i * 2 * Math.PI / n) * r]);
  const a = 0.13, b = 0.035;
  if (k === 'plus') poly([[-b, a], [b, a], [b, b], [a, b], [a, -b], [b, -b], [b, -a], [-b, -a], [-b, -b], [-a, -b], [-a, b], [-b, b]]);
  else if (k === 'slot') poly([[-a, b], [a, b], [a, -b], [-a, -b]]);
  else if (k === 'square') poly(reg(4, 0.1, Math.PI / 4));
  else if (k === 'tri') poly(reg(3, 0.12, Math.PI / 2));
  else if (k === 'star') { const p = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.055 : 0.13, t = Math.PI / 2 + i * Math.PI / 5; p.push([Math.cos(t) * r, Math.sin(t) * r]); } poly(p); }
  else if (k === 'hex') poly(reg(6, 0.11));
  else if (k === 'diamond') poly([[0, 0.13], [0.08, 0], [0, -0.13], [-0.08, 0]]);
  else if (k === 'heart') {
    S.moveTo(0, -0.11 * s); S.bezierCurveTo(-0.16 * s, 0.0, -0.1 * s, 0.13 * s, 0, 0.05 * s); S.bezierCurveTo(0.1 * s, 0.13 * s, 0.16 * s, 0, 0, -0.11 * s);
  } else if (k === 'ring') { S.absarc(0, 0, 0.11 * s, 0, Math.PI * 2, false); const h = new THREE.Path(); h.absarc(0, 0, 0.055 * s, 0, Math.PI * 2, true); S.holes.push(h); }
  return S;
}
const GEO = {};
export function initGeometry() {
  // screw head: lacquered dome (lathe around Y, then turned so the axis is +Z)
  const prof = [[0, 0], [0.27, 0], [0.295, 0.025], [0.29, 0.065], [0.255, 0.105], [0.19, 0.135], [0.1, 0.152], [0, 0.156]].map(([r, y]) => new THREE.Vector2(r, y));
  GEO.head = new THREE.LatheGeometry(prof, 40); GEO.head.rotateX(Math.PI / 2);
  GEO.sym = SYM.map(k => { const g = new THREE.ExtrudeGeometry(symShape(k, 1.05), { depth: 0.02, bevelEnabled: false, curveSegments: 10 }); g.translate(0, 0, 0.142); return g; });
  GEO.washer = new THREE.CylinderGeometry(0.33, 0.33, 0.035, 36); GEO.washer.rotateX(Math.PI / 2); GEO.washer.translate(0, 0, -0.012);
  // threaded shank: sawtooth lathe profile, pointed tip
  const sp = [new THREE.Vector2(0, -1.0), new THREE.Vector2(0.03, -0.98)]; let y = -0.93;
  sp.push(new THREE.Vector2(0.065, y)); while (y < -0.04) { sp.push(new THREE.Vector2(0.105, y + 0.035)); sp.push(new THREE.Vector2(0.07, y + 0.07)); y += 0.07; }
  sp.push(new THREE.Vector2(0.075, 0)); sp.push(new THREE.Vector2(0, 0));
  GEO.shaft = new THREE.LatheGeometry(sp, 18); GEO.shaft.rotateX(Math.PI / 2); GEO.shaft.scale(1, 1, 1);
  // holes: dark recess + brass ring
  GEO.holeDisc = new THREE.CircleGeometry(0.2, 28);
  GEO.ring = new THREE.TorusGeometry(0.245, 0.045, 10, 36);
  GEO.glow = new THREE.RingGeometry(0.3, 0.46, 40);
  GEO.boxSym = SYM.map(k => new THREE.ExtrudeGeometry(symShape(k, 2.0), { depth: 0.04, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.012, bevelSegments: 2, curveSegments: 10 }));
  return GEO;
}

/** a screw: group with .head .sym .shaft; local +Z is out of the board */
export function makeScrew(color) {
  const g = new THREE.Group();
  const head = new THREE.Mesh(GEO.head, MAT.head[color]); head.castShadow = true;
  const sym = new THREE.Mesh(GEO.sym[color], MAT.sym[color]);
  const washer = new THREE.Mesh(GEO.washer, MAT.brass); washer.castShadow = true;
  const shaft = new THREE.Mesh(GEO.shaft, MAT.brass); shaft.castShadow = true;
  const spin = new THREE.Group(); spin.add(head, sym, washer, shaft); g.add(spin);
  g.userData = { spin, color }; g.spin = spin;
  return g;
}

/** a plate: rounded hull of its key points, holes under its screws, painted face + plywood edge.
 *  Returned as outer (pivot) group → inner mesh, so the plate can later swing around any screw. */
export function makePlate(pl, screwPts, thick = 0.18) {
  const ring = [];
  for (const [x, y] of pl.pts) for (let i = 0; i < 28; i++) { const t = i / 28 * Math.PI * 2; ring.push([x + Math.cos(t) * PLATE_R, y + Math.sin(t) * PLATE_R]); }
  const out = hull2(ring);
  const shape = new THREE.Shape(); out.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y)); shape.closePath();
  for (const [x, y] of screwPts) { const h = new THREE.Path(); h.absarc(x, y, 0.16, 0, Math.PI * 2, true); shape.holes.push(h); }
  const bev = 0.035;
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thick - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 18 });
  geo.translate(0, 0, bev);
  // face UVs come from x/y in board units: scale so the grain is readable
  const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.28, uv.getY(i) * 0.28);
  const mesh = new THREE.Mesh(geo, [MAT.paint[pl.color % MAT.paint.length], MAT.ply]); mesh.castShadow = true; mesh.receiveShadow = true;
  const inner = new THREE.Group(); inner.add(mesh);
  const outer = new THREE.Group(); outer.add(inner);
  outer.userData = { inner, mesh, thick };
  return outer;
}
function hull2(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

/** instanced holes (dark recess + brass ring) */
export function makeHoles(max = 64) {
  const disc = new THREE.InstancedMesh(GEO.holeDisc, MAT.hole, max), ring = new THREE.InstancedMesh(GEO.ring, MAT.brass, max);
  ring.castShadow = false; ring.receiveShadow = true; disc.count = ring.count = 0;
  const g = new THREE.Group(); g.add(disc, ring);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  g.set = (list) => {   // list: [{x,y,z,s}]
    disc.count = ring.count = list.length;
    list.forEach((h, i) => {
      const s = h.s || 1;
      m.compose(new THREE.Vector3(h.x, h.y, h.z + 0.004), q, new THREE.Vector3(s, s, s)); disc.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(h.x, h.y, h.z + 0.01), q, new THREE.Vector3(s, s, s * 0.6)); ring.setMatrixAt(i, m);
    });
    disc.instanceMatrix.needsUpdate = ring.instanceMatrix.needsUpdate = true;
  };
  return g;
}

/** a colour toolbox with 3 holes on its cream front panel. Box centre at origin; holes at box.userData.slots (local) */
export function makeBox(color) {
  const g = new THREE.Group(), W = 2.35, H = 1.2, D = 0.95;
  const body = new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 4, 0.16), MAT.box[color]); body.castShadow = true; body.receiveShadow = true;
  const panel = new THREE.Mesh(new RoundedBoxGeometry(W - 0.32, H - 0.42, 0.1, 3, 0.05), MAT.cream); panel.position.set(0, -0.08, D / 2 + 0.01); panel.receiveShadow = true;
  const lip = new THREE.Mesh(new RoundedBoxGeometry(W + 0.08, 0.16, D + 0.08, 3, 0.06), MAT.box[color]); lip.position.y = H / 2 - 0.04; lip.castShadow = true;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.055, 10, 24, Math.PI), MAT.brass); handle.position.set(0, H / 2 + 0.04, 0); handle.castShadow = true;
  const label = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.3, 0.06, 2, 0.03), MAT.brass); label.position.set(0, H / 2 - 0.2, D / 2 + 0.02);
  const sym = new THREE.Mesh(GEO.boxSym[color], MAT.sym[color]); sym.scale.setScalar(0.62); sym.position.set(0, H / 2 - 0.2, D / 2 + 0.05);
  g.add(body, panel, lip, handle, label, sym);
  const slots = [-0.62, 0, 0.62].map(x => new THREE.Vector3(x, -0.08, D / 2 + 0.07));
  const holes = makeHoles(3); holes.set(slots.map(p => ({ x: p.x, y: p.y, z: p.z - 0.01, s: 0.95 }))); g.add(holes);
  g.userData = { slots, color, W, H, D };
  return g;
}
export { GEO };
