// Zoomburst cars: chunky stylised bodies lofted from cross-sections (smooth curves in every direction), glossy clearcoat
// paint with a canvas livery (stripes / flash / race number), ink outlines, merged trim, instanced wheels.
import { THREE } from './kit/cine.js';
import { mergeGeometries } from './kit/addons/utils/BufferGeometryUtils.js';
import { toon, outlineMat, INK, fin, box, place } from './world.js';

// keyframes [t, value], t: 0 = rear, 1 = nose
export const MODELS = [
  { id: 'pip', name: 'PIP GT-MINI', price: 0, top: 55, acc: 12.2, hand: 1.08, nos: 1.0, L: 3.7, W: 2.0, R: 0.42, tr: 0.2, tf: 0.8, lights: 'round', wing: 'lip', pillar: 0.52,
    hw: [[0, 0.86], [0.08, 0.97], [0.3, 1], [0.7, 1], [0.9, 0.96], [1, 0.84]], yb: [[0, 0.44], [0.08, 0.34], [0.9, 0.34], [1, 0.44]],
    belt: [[0, 0.98], [0.1, 1.04], [0.5, 1.02], [0.8, 0.98], [0.94, 0.88], [1, 0.7]], roof: [[0, 1.05], [0.06, 1.3], [0.16, 1.62], [0.4, 1.7], [0.6, 1.66], [0.74, 1.12], [0.86, 1.02], [0.96, 0.88], [1, 0.72]], cab: [[0, 0.7], [0.5, 0.74], [1, 0.7]] },
  { id: 'kestrel', name: 'VEXA KESTREL', price: 6000, top: 58, acc: 12.9, hand: 1.03, nos: 1.06, L: 4.3, W: 2.06, R: 0.41, tr: 0.19, tf: 0.8, lights: 'slim', wing: 'duck', pillar: 0.5,
    hw: [[0, 0.84], [0.05, 0.96], [0.15, 1], [0.32, 1], [0.5, 0.95], [0.72, 0.98], [0.9, 0.96], [0.97, 0.9], [1, 0.8]], yb: [[0, 0.4], [0.06, 0.3], [0.94, 0.3], [1, 0.38]],
    belt: [[0, 0.9], [0.06, 0.98], [0.22, 1.0], [0.45, 0.94], [0.65, 0.9], [0.82, 0.88], [0.93, 0.78], [1, 0.6]], roof: [[0, 0.95], [0.06, 1.03], [0.18, 1.08], [0.32, 1.4], [0.46, 1.5], [0.58, 1.48], [0.7, 1.06], [0.8, 0.97], [0.92, 0.83], [1, 0.64]], cab: [[0, 0.6], [0.45, 0.66], [0.75, 0.6], [1, 0.6]] },
  { id: 'ronin', name: 'RONIN S8', price: 12000, top: 60, acc: 13.6, hand: 1.13, nos: 1.0, L: 4.2, W: 2.02, R: 0.41, tr: 0.19, tf: 0.8, lights: 'slim', wing: 'gt', pillar: 0.47,
    hw: [[0, 0.88], [0.06, 0.98], [0.2, 1], [0.8, 1], [0.94, 0.95], [1, 0.84]], yb: [[0, 0.38], [0.06, 0.3], [0.94, 0.3], [1, 0.36]],
    belt: [[0, 0.98], [0.1, 1.0], [0.5, 0.97], [0.8, 0.93], [0.94, 0.82], [1, 0.66]], roof: [[0, 1.02], [0.08, 1.08], [0.2, 1.5], [0.32, 1.56], [0.55, 1.55], [0.7, 1.08], [0.84, 0.98], [0.95, 0.84], [1, 0.68]], cab: [[0, 0.66], [0.5, 0.7], [1, 0.66]] },
  { id: 'brutus', name: 'BRUTUS V', price: 20000, top: 64, acc: 14.6, hand: 0.95, nos: 1.15, L: 4.6, W: 2.12, R: 0.43, tr: 0.18, tf: 0.8, lights: 'round', wing: 'duck', scoop: true, pillar: 0.47,
    hw: [[0, 0.92], [0.04, 0.98], [0.2, 1], [0.8, 1], [0.96, 0.97], [1, 0.9]], yb: [[0, 0.4], [0.05, 0.32], [0.95, 0.32], [1, 0.4]],
    belt: [[0, 1.0], [0.08, 1.04], [0.5, 1.02], [0.85, 1.0], [0.96, 0.94], [1, 0.84]], roof: [[0, 1.04], [0.2, 1.08], [0.34, 1.5], [0.42, 1.58], [0.56, 1.58], [0.66, 1.12], [0.75, 1.08], [0.95, 1.0], [1, 0.86]], cab: [[0, 0.72], [0.5, 0.74], [1, 0.72]] },
  { id: 'strata', name: 'HALO STRATA', price: 34000, top: 68, acc: 15.2, hand: 1.09, nos: 1.22, L: 4.6, W: 2.16, R: 0.42, tr: 0.19, tf: 0.81, lights: 'slim', wing: 'gt', fin: true, pillar: 0.49,
    hw: [[0, 0.88], [0.05, 0.97], [0.18, 1], [0.35, 1], [0.55, 0.92], [0.75, 0.97], [0.92, 0.94], [1, 0.76]], yb: [[0, 0.36], [0.06, 0.28], [0.94, 0.28], [1, 0.34]],
    belt: [[0, 0.86], [0.08, 0.92], [0.25, 0.95], [0.5, 0.86], [0.75, 0.84], [0.9, 0.72], [1, 0.52]], roof: [[0, 0.9], [0.1, 0.98], [0.26, 1.12], [0.4, 1.34], [0.55, 1.36], [0.66, 1.0], [0.8, 0.88], [0.93, 0.72], [1, 0.54]], cab: [[0, 0.5], [0.45, 0.56], [1, 0.5]] },
];
export const TRAFFIC = [
  { id: 'sedan', L: 4.4, W: 1.95, R: 0.37, tr: 0.2, tf: 0.8, lights: 'slim', pillar: 0.5,
    hw: [[0, 0.9], [0.06, 0.98], [0.5, 1], [0.94, 0.97], [1, 0.88]], yb: [[0, 0.36], [0.06, 0.3], [0.94, 0.3], [1, 0.36]],
    belt: [[0, 0.98], [0.1, 1.0], [0.85, 0.95], [1, 0.8]], roof: [[0, 1.0], [0.2, 1.04], [0.32, 1.5], [0.62, 1.5], [0.74, 1.05], [0.96, 0.96], [1, 0.8]], cab: [[0, 0.74], [1, 0.74]] },
  { id: 'taxi', taxi: true, L: 4.4, W: 1.95, R: 0.37, tr: 0.2, tf: 0.8, lights: 'round', pillar: 0.5,
    hw: [[0, 0.9], [0.06, 0.98], [0.5, 1], [0.94, 0.97], [1, 0.88]], yb: [[0, 0.36], [0.06, 0.3], [0.94, 0.3], [1, 0.36]],
    belt: [[0, 0.98], [0.1, 1.0], [0.85, 0.95], [1, 0.8]], roof: [[0, 1.0], [0.2, 1.04], [0.32, 1.52], [0.62, 1.52], [0.74, 1.05], [0.96, 0.96], [1, 0.8]], cab: [[0, 0.74], [1, 0.74]] },
  { id: 'van', L: 4.9, W: 2.1, R: 0.4, tr: 0.18, tf: 0.82, lights: 'round', pillar: 0.6,
    hw: [[0, 0.95], [0.04, 1], [0.96, 1], [1, 0.93]], yb: [[0, 0.4], [0.04, 0.34], [0.96, 0.34], [1, 0.4]],
    belt: [[0, 1.2], [0.5, 1.2], [0.84, 1.15], [1, 0.95]], roof: [[0, 2.3], [0.04, 2.45], [0.7, 2.45], [0.8, 2.2], [0.9, 1.4], [1, 1.0]], cab: [[0, 0.92], [1, 0.9]] },
  { id: 'bubble', L: 3.4, W: 1.8, R: 0.36, tr: 0.2, tf: 0.8, lights: 'round', pillar: 0.5,
    hw: [[0, 0.82], [0.1, 0.96], [0.5, 1], [0.9, 0.96], [1, 0.82]], yb: [[0, 0.4], [0.1, 0.32], [0.9, 0.32], [1, 0.4]],
    belt: [[0, 0.9], [0.15, 0.98], [0.85, 0.95], [1, 0.75]], roof: [[0, 1.0], [0.12, 1.4], [0.3, 1.62], [0.6, 1.6], [0.78, 1.15], [0.92, 0.95], [1, 0.76]], cab: [[0, 0.76], [1, 0.76]] },
];
export const PAINTS = [['Hot Coral', '#ff4a3d'], ['Volt Yellow', '#ffc400'], ['Cyan Pop', '#14c8ff'], ['Grape', '#7a4dff'], ['Lime Rush', '#5bdc2a'], ['Bubblegum', '#ff5fb4'],
  ['Snow', '#f2f4f8'], ['Tangerine', '#ff8a1a'], ['Royal', '#2856ff'], ['Mint', '#3fe0b0'], ['Ink', '#272b3a'], ['Cherry', '#d0123a']];
export const FINISHES = ['Gloss', 'Metallic', 'Pearl', 'Toon'];
export const RIMS = [['Chrome', '#e8ecf2'], ['Black', '#22242c'], ['Gold', '#ffc23a'], ['Neon', '#4dfff0'], ['Red', '#ff3045']];
export const LIVERIES = ['Clean', 'Stripes', 'Flash', 'Race #'];

function I(keys, t) {
  if (t <= keys[0][0]) return keys[0][1]; const n = keys.length; if (t >= keys[n - 1][0]) return keys[n - 1][1];
  let k = 0; while (keys[k + 1][0] < t) k++;
  const [t0, v0] = keys[k], [t1, v1] = keys[k + 1], tm = k > 0 ? keys[k - 1] : keys[k], tp = k + 2 < n ? keys[k + 2] : keys[k + 1];
  const m0 = k > 0 ? (v1 - tm[1]) / (t1 - tm[0]) : (v1 - v0) / (t1 - t0), m1 = k + 2 < n ? (tp[1] - v0) / (tp[0] - t0) : (v1 - v0) / (t1 - t0);
  const h = t1 - t0, s = (t - t0) / h, s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * v0 + (s3 - 2 * s2 + s) * h * m0 + (-2 * s3 + 3 * s2) * v1 + (s3 - s2) * h * m1;
}
function cr(p0, p1, p2, p3, s) { const s2 = s * s, s3 = s2 * s; return 0.5 * (2 * p1 + (-p0 + p2) * s + (2 * p0 - 5 * p1 + 4 * p2 - p3) * s2 + (-p0 + 3 * p1 - 3 * p2 + p3) * s3); }

export function sectFn(m) {
  const L = m.L, HW = m.W / 2, R = m.R, wz = [-L / 2 + m.tr * L, -L / 2 + m.tf * L], ra = R + 0.09;
  return t => {
    const z = -L / 2 + t * L; let hw = HW * I(m.hw, t), yb = I(m.yb, t), belt = I(m.belt, t), top = I(m.roof, t); const cab = I(m.cab, t);
    for (const w of wz) { const dz = z - w; if (Math.abs(dz) < ra) yb = Math.max(yb, R + Math.sqrt(ra * ra - dz * dz)); }
    belt = Math.max(belt, yb + 0.14); top = Math.max(top, belt + 0.02);
    return { z, hw, yb, belt, top, cab };
  };
}

function loft(m, S = 90, sub = 3) {
  const sect = sectFn(m), K = 7 * sub + 1, N = 2 * K - 2, pos = [], uvs = [], cps = [];
  const slope = t => (I(m.roof, Math.min(1, t + 0.01)) - I(m.roof, Math.max(0, t - 0.01))) / 0.02;
  const g = t => { const s = sect(t); return Math.max(0, Math.min(1, (s.top - s.belt - 0.06) / 0.22)); };
  for (let si = 0; si <= S; si++) {
    const t = si / S, s = sect(t), gg = g(t), hw = s.hw, yb = s.yb, belt = s.belt, top = s.top;
    const lerp = (a, b) => a + (b - a) * gg;
    const c = [[0, yb], [hw * 0.8, yb], [hw * 0.98, yb + Math.min(0.12, (belt - yb) * 0.3)], [hw, yb + (belt - yb) * 0.6], [hw * 0.97, belt],
      [lerp(hw * 0.86, hw * s.cab * 1.12), lerp(belt + (top - belt) * 0.55, belt + (top - belt) * 0.45)], [lerp(hw * 0.5, hw * s.cab * 0.98), lerp(top - 0.01, top - 0.05)], [0, top]];
    const right = [];
    for (let k = 0; k < 7; k++) for (let j = 0; j < sub; j++) { const u = j / sub, a = c[Math.max(0, k - 1)], b = c[k], d = c[k + 1], e = c[Math.min(7, k + 2)]; right.push([cr(a[0], b[0], d[0], e[0], u), cr(a[1], b[1], d[1], e[1], u)]); }
    right.push(c[7]);
    for (let j = 0; j < K; j++) { pos.push(right[j][0], right[j][1], s.z); uvs.push(j / (K - 1) * 0.5, t); if (si === 0) cps.push(j / sub); }
    for (let j = K - 2; j >= 1; j--) { pos.push(-right[j][0], right[j][1], s.z); uvs.push(1 - j / (K - 1) * 0.5, t); if (si === 0) cps.push(j / sub); }
  }
  const body = [], glass = [];
  for (let si = 0; si < S; si++) {
    const t = (si + 0.5) / S, gg = g(t), sl = Math.abs(slope(t)), pillar = Math.abs(t - m.pillar) < 0.014;
    for (let k = 0; k < N; k++) {
      const a = si * N + k, b = si * N + (k + 1) % N, c = a + N, d = b + N, cp = (cps[k] + cps[(k + 1) % N]) / 2;
      const isG = gg > 0.55 && ((cp > 4.25 && cp < 5.95 && !pillar) || (cp >= 5.95 && sl > 1.6));
      (isG ? glass : body).push(a, c, b, b, c, d);
    }
  }
  // end caps
  for (const [si, flip] of [[0, true], [S, false]]) {
    const base = pos.length / 3; let cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < N; k++) { const o = (si * N + k) * 3; cx += pos[o] / N; cy += pos[o + 1] / N; cz = pos[o + 2]; }
    pos.push(cx, cy, cz + (flip ? -0.03 : 0.03)); uvs.push(0.25, si / S);
    for (let k = 0; k < N; k++) { const o = (si * N + k) * 3; pos.push(pos[o], pos[o + 1], pos[o + 2]); uvs.push(0.25, si / S); }
    for (let k = 0; k < N; k++) { const a = base + 1 + k, b = base + 1 + (k + 1) % N; flip ? body.push(base, b, a) : body.push(base, a, b); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(body.concat(glass)); geo.addGroup(0, body.length, 0); geo.addGroup(body.length, glass.length, 1);
  geo.computeVertexNormals();
  // make sure faces point outwards (roof normal up)
  const nr = geo.attributes.normal; const roof = (Math.floor(S / 2) * N + (K - 1)); if (nr.getY(roof) < 0) {
    const ix = geo.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } geo.computeVertexNormals();
  }
  geo.setAttribute('onorm', geo.attributes.normal.clone());
  return { geo, sect };
}

// livery canvas: u (x) around the body, v (y) along it; paint colour baked in
function liveryTex(paint, livery, num, accent) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512; const x = c.getContext('2d');
  x.fillStyle = paint; x.fillRect(0, 0, 256, 512);
  const g = x.createLinearGradient(0, 0, 256, 0); g.addColorStop(0, 'rgba(0,0,0,.25)'); g.addColorStop(0.2, 'rgba(0,0,0,0)'); g.addColorStop(0.8, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.25)'); x.fillStyle = g; x.fillRect(0, 0, 256, 512);
  if (livery === 1) { x.fillStyle = accent; x.fillRect(128 - 22, 0, 14, 512); x.fillRect(128 + 8, 0, 14, 512); }
  if (livery === 2) for (const u of [0.2, 0.8]) { x.fillStyle = accent; x.beginPath(); x.moveTo(u * 256 - 10, 40); x.lineTo(u * 256 + 14, 40); x.lineTo(u * 256 + 2, 470); x.lineTo(u * 256 - 22, 470); x.fill();
    x.fillStyle = '#fff'; x.fillRect(u * 256 + 16, 60, 5, 380); }
  if (livery === 3) {
    x.fillStyle = accent; x.fillRect(128 - 8, 0, 16, 512);
    for (const [u, r] of [[0.21, 1], [0.79, -1]]) { x.save(); x.translate(u * 256, 250); x.rotate(r * Math.PI / 2); x.fillStyle = '#fff'; x.beginPath(); x.arc(0, 0, 34, 0, 7); x.fill(); x.lineWidth = 6; x.strokeStyle = INK; x.stroke();
      x.fillStyle = INK; x.font = '900 40px "Arial Black", Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(num), 0, 2); x.restore(); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function paintMat(look, map) {
  const f = look.finish || 0;
  if (f === 3) return toon('#ffffff', { map });
  return new THREE.MeshPhysicalMaterial({ map, roughness: f === 1 ? 0.28 : 0.38, metalness: f === 1 ? 0.55 : 0.08, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.25,
    iridescence: f === 2 ? 1 : 0, iridescenceIOR: 1.6, iridescenceThicknessRange: [200, 600] });
}
const GLASS = new THREE.MeshPhysicalMaterial({ color: '#1c2c48', roughness: 0.04, metalness: 0.3, clearcoat: 1, envMapIntensity: 1.6 });
const OL = outlineMat(0.035);
const HEAD = new THREE.MeshStandardMaterial({ color: '#fffbe8', emissive: '#fff4c8', emissiveIntensity: 1.4, roughness: 0.1 });
const TRIM = toon('#ffffff', { vertexColors: true });
const SILVER = '#d8dce4', DARK = '#2a2d38';

// shared wheel geometry
function wheelGeos(R = 1) {
  const w = 0.36, prof = [[0.2, -w / 2], [0.86, -w / 2], [0.97, -w / 2 + 0.05], [1, -w / 4], [1, w / 4], [0.97, w / 2 - 0.05], [0.86, w / 2], [0.2, w / 2]].map(([r, y]) => new THREE.Vector2(r * R, y));
  const tyre = new THREE.LatheGeometry(prof, 28); tyre.rotateZ(Math.PI / 2); fin(tyre);
  const parts = [];
  const dish = new THREE.CylinderGeometry(R * 0.66, R * 0.62, 0.08, 24); dish.rotateZ(Math.PI / 2); dish.translate(w / 2 - 0.06, 0, 0); parts.push(dish);
  const hub = new THREE.CylinderGeometry(R * 0.14, R * 0.16, 0.1, 12); hub.rotateZ(Math.PI / 2); hub.translate(w / 2 - 0.0, 0, 0); parts.push(hub);
  for (let k = 0; k < 6; k++) { const s = new THREE.BoxGeometry(0.06, R * 0.5, 0.1); s.translate(w / 2 - 0.02, R * 0.36, 0); s.rotateX(k * Math.PI / 3); parts.push(s); }
  const ring = new THREE.TorusGeometry(R * 0.66, 0.035, 6, 28); ring.rotateY(Math.PI / 2); ring.translate(w / 2 - 0.03, 0, 0); parts.push(ring);
  parts.forEach(p => { p.deleteAttribute('uv'); });
  const rim = mergeGeometries(parts.map(p => p.toNonIndexed())); rim.computeVertexNormals(); fin(rim);
  return { tyre, rim };
}

export class WheelPool {
  constructor(scene, max) {
    const g = wheelGeos(1); this.max = max; this.n = 0; this.nodes = [];
    this.tyre = new THREE.InstancedMesh(g.tyre, toon('#2a2a33'), max); this.rim = new THREE.InstancedMesh(g.rim, new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0.7, roughness: 0.25 }), max);
    this.tyreO = new THREE.InstancedMesh(g.tyre, outlineMat(0.03), max);
    for (const m of [this.tyre, this.rim, this.tyreO]) { m.frustumCulled = false; m.count = 0; scene.add(m); }
    this.tyre.castShadow = true; this.rim.setColorAt(0, new THREE.Color(1, 1, 1));
  }
  add(node, R, rimCol) { const i = this.n++; this.nodes.push({ node, R }); this.rim.setColorAt(i, new THREE.Color(rimCol)); this.rim.instanceColor.needsUpdate = true; return i; }
  color(i, c) { this.rim.setColorAt(i, new THREE.Color(c)); this.rim.instanceColor.needsUpdate = true; }
  clear() { this.n = 0; this.nodes.length = 0; }
  update() {
    const m = new THREE.Matrix4(), s = new THREE.Matrix4();
    for (let i = 0; i < this.n; i++) { const { node, R } = this.nodes[i]; s.makeScale(1, R, R); m.multiplyMatrices(node.matrixWorld, s); this.tyre.setMatrixAt(i, m); this.rim.setMatrixAt(i, m); this.tyreO.setMatrixAt(i, m); }
    for (const x of [this.tyre, this.rim, this.tyreO]) { x.count = this.n; x.instanceMatrix.needsUpdate = true; }
  }
}

const geoCache = new Map();
function modelGeo(m) { if (!geoCache.has(m.id)) geoCache.set(m.id, loft(m, TRAFFIC.includes(m) ? 56 : 90)); return geoCache.get(m.id); }

// trim (bumpers, grille, wing, mirrors...) as one vertex-coloured mesh
function trimGeo(m, sect, paint, traffic) {
  const P = [], L = m.L, add = (g, col) => P.push(fin(g, col));
  const nose = sect(0.985), tail = sect(0.015), front = L / 2, rear = -L / 2;
  // bumpers + grille + splitter
  add(place(box(nose.hw * 1.85, 0.1, 0.34), 0, nose.yb + 0.02, front - 0.12), DARK);
  add(place(box(nose.hw * 1.0, 0.18, 0.14), 0, (nose.yb + nose.belt) / 2 - 0.02, front - 0.02), INK);
  add(place(box(tail.hw * 1.8, 0.1, 0.3), 0, tail.yb + 0.02, rear + 0.14), DARK);
  if (!traffic) for (let k = -2; k <= 2; k++) add(place(box(0.035, 0.12, 0.26), k * 0.22, tail.yb + 0.04, rear + 0.12), INK);
  add(place(box(0.52, 0.15, 0.04), 0, tail.yb + 0.3, rear + 0.0), '#f6f6f2'); add(place(box(0.44, 0.03, 0.05), 0, tail.yb + 0.3, rear - 0.005), '#3050c8');
  // side skirts + arch liners
  const mid = sect(0.5);
  for (const sd of [-1, 1]) add(place(box(0.12, 0.12, L * 0.42), sd * mid.hw * 0.97, mid.yb + 0.06, 0), DARK);
  for (const tw of [m.tr, m.tf]) for (const sd of [-1, 1]) {
    const s = sect(tw), g = new THREE.CylinderGeometry(m.R + 0.08, m.R + 0.08, 0.5, 18, 1, true, 0, Math.PI); g.rotateZ(Math.PI / 2); g.rotateX(Math.PI / 2);
    add(place(g, sd * (s.hw - 0.3), m.R, s.z), INK);
  }
  // exhausts
  if (!traffic) for (const sd of [-1, 1]) { const g = new THREE.CylinderGeometry(0.06, 0.07, 0.3, 12); g.rotateX(Math.PI / 2); add(place(g, sd * tail.hw * 0.45, tail.yb + 0.1, rear - 0.04), '#8a8f9a'); }
  // mirrors
  const mt = sect(0.66);
  for (const sd of [-1, 1]) { add(place(box(0.16, 0.1, 0.18), sd * (mt.hw * 0.97 + 0.07), mt.belt + 0.1, mt.z - 0.05), paint); add(place(box(0.12, 0.04, 0.06), sd * (mt.hw * 0.97), mt.belt + 0.06, mt.z - 0.02), INK); }
  // wings
  if (m.wing === 'gt') { const s = sect(0.06); for (const sd of [-0.55, 0.55]) add(place(box(0.08, 0.38, 0.22), sd * s.hw, s.top + 0.18, s.z), INK);
    add(place(box(m.W * 0.98, 0.07, 0.48), 0, s.top + 0.4, s.z - 0.02, 0, -0.12), INK); for (const sd of [-1, 1]) add(place(box(0.05, 0.26, 0.56), sd * m.W * 0.49, s.top + 0.42, s.z - 0.02), paint); }
  if (m.wing === 'duck') { const s = sect(0.04); add(place(box(s.hw * 1.8, 0.06, 0.3), 0, s.top + 0.03, s.z + 0.05, 0, -0.35), INK); }
  if (m.wing === 'lip') { const s = sect(0.07); add(place(box(s.hw * 1.3, 0.06, 0.24), 0, s.top + 0.06, s.z, 0, -0.2), INK); }
  if (m.scoop) { const s = sect(0.84); add(place(box(0.7, 0.16, 0.7), 0, s.top + 0.05, s.z), INK); }
  if (m.fin) { const s = sect(0.2); add(place(box(0.05, 0.3, 0.9), 0, s.top + 0.12, s.z - 0.1), paint); }
  if (m.taxi) { const s = sect(0.47); add(place(box(0.8, 0.26, 0.36), 0, s.top + 0.13, s.z), '#ffd23f'); }
  return mergeGeometries(P.map(g => { g.deleteAttribute('uv'); return g; }));
}
function lightGeos(m, sect) {
  const head = [], tail = [], L = m.L;
  const n = sect(0.965), t = sect(0.03);
  for (const sd of [-1, 1]) {
    if (m.lights === 'round') { const g = new THREE.SphereGeometry(0.17, 16, 12); g.scale(1, 1, 0.55); head.push(place(g, sd * n.hw * 0.6, (n.yb + n.belt) / 2 + 0.06, L / 2 - 0.08)); }
    else { const g = box(0.5, 0.1, 0.22); head.push(place(g, sd * n.hw * 0.62, n.belt - 0.1, L / 2 - 0.12, sd * 0.32)); }
    tail.push(place(box(0.42, 0.13, 0.12), sd * t.hw * 0.62, t.belt - 0.1, -L / 2 + 0.06));
  }
  tail.push(place(box(t.hw * 0.8, 0.05, 0.1), 0, t.belt - 0.1, -L / 2 + 0.05));
  const clean = a => mergeGeometries(a.map(g => { g.deleteAttribute('uv'); if (g.attributes.onorm) g.deleteAttribute('onorm'); return g.index ? g.toNonIndexed() : g; }));
  return { head: clean(head), tail: clean(tail) };
}

let flameTex;
function flameMat(col) {
  if (!flameTex) { const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 128); flameTex = new THREE.CanvasTexture(c); }
  return new THREE.MeshBasicMaterial({ map: flameTex, color: new THREE.Color(col).multiplyScalar(3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
}

// a full car: root (world placement) > body (roll/pitch) > meshes; wheel nodes feed the WheelPool
export function makeCar(m, look, pool, { traffic = false, shadow = true } = {}) {
  const { geo, sect } = modelGeo(m);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const car = { root, body, model: m, wheels: [], look: { ...look } };
  const tex = liveryTex(look.paint, traffic ? (m.taxi ? 1 : 0) : look.livery || 0, look.num || 7, look.accent || '#ffffff');
  const pm = traffic ? toon('#ffffff', { map: tex }) : paintMat(look, tex);
  const mesh = new THREE.Mesh(geo, [pm, GLASS]); mesh.castShadow = shadow; body.add(mesh);
  const ol = new THREE.Mesh(geo, OL); body.add(ol);
  const tg = trimGeo(m, sect, look.paint, traffic); const trim = new THREE.Mesh(tg, TRIM); trim.castShadow = shadow; body.add(trim); body.add(new THREE.Mesh(tg, OL));
  const lg = lightGeos(m, sect); body.add(new THREE.Mesh(lg.head, HEAD));
  const tailMat = new THREE.MeshStandardMaterial({ color: '#ff2a3a', emissive: '#ff1030', emissiveIntensity: 0.8, roughness: 0.2 }); body.add(new THREE.Mesh(lg.tail, tailMat));
  car.mesh = mesh; car.trim = trim; car.tailMat = tailMat; car.paintMat = pm; car.tex = tex;
  for (const [tw, front] of [[m.tf, true], [m.tr, false]]) for (const sd of [-1, 1]) {
    const s = sect(tw), steer = new THREE.Group(), spin = new THREE.Group(); steer.position.set(sd * (s.hw - 0.2), m.R, s.z); steer.add(spin); root.add(steer);
    if (sd < 0) spin.scale.x = -1;
    car.wheels.push({ steer, spin, front, sd, idx: pool.add(spin, m.R, look.rim || SILVER) });
  }
  if (!traffic) {   // nitro flames
    const fl = new THREE.Group(), t = sect(0.03);
    for (const sd of [-1, 1]) for (const [col, r, l] of [['#ff7a1a', 0.16, 1.5], ['#5ad8ff', 0.09, 1.0]]) { const g = new THREE.ConeGeometry(r, l, 10, 1, true); g.rotateX(-Math.PI / 2); g.translate(0, 0, -l / 2); const f = new THREE.Mesh(g, flameMat(col)); f.position.set(sd * t.hw * 0.45, t.yb + 0.12, -m.L / 2 - 0.15); fl.add(f); }
    fl.visible = false; body.add(fl); car.flames = fl;
  }
  car.setLook = (lk) => {
    car.look = { ...lk }; car.tex.dispose(); car.tex = liveryTex(lk.paint, lk.livery || 0, lk.num || 7, lk.accent || '#ffffff');
    const nm = paintMat(lk, car.tex); car.paintMat.dispose(); car.paintMat = nm; mesh.material = [nm, GLASS];
    for (const w of car.wheels) pool.color(w.idx, lk.rim || SILVER);
    const ng = trimGeo(m, sect, lk.paint, false); trim.geometry.dispose(); trim.geometry = ng; body.children[3].geometry = ng;
  };
  return car;
}
