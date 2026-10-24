// Bowtwist art, all built in code in the Kawaii Pop look: glossy jelly plates with tiny faces, candy bow-pins,
// ribboned gift boxes, a quilted cushion board, heart wallpaper. Every material is shared; meshes are cheap groups.
// 9 pin colours, each with its own white head symbol (heart, star, drop, clover, moon, diamond, flower, square, ring),
// so the game reads without colour.
import { THREE } from './kit/hc.js';
import { RoundedBoxGeometry } from './kit/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from './kit/addons/utils/BufferGeometryUtils.js';
import { R as PLATE_R } from './logic.js';

export const PIN = [
  { name: 'Strawberry', c: '#ff4f8b', e: '🩷', sym: 'heart' },
  { name: 'Lemon', c: '#ffc928', e: '🟨', sym: 'star' },
  { name: 'Ocean', c: '#3d8bff', e: '🟦', sym: 'drop' },
  { name: 'Mint', c: '#21c48a', e: '🟩', sym: 'clover' },
  { name: 'Grape', c: '#9a5cff', e: '🟪', sym: 'moon' },
  { name: 'Tangerine', c: '#ff8a2a', e: '🟧', sym: 'diamond' },
  { name: 'Aqua', c: '#22c6e0', e: '🩵', sym: 'flower' },
  { name: 'Cherry', c: '#ee3b4b', e: '🟥', sym: 'square' },
  { name: 'Cocoa', c: '#a5704f', e: '🟫', sym: 'ring' },
];
// jelly plate pastels: strawberry milk, mint, lilac, butter, sky, peach, lime
export const JELLY = ['#ff7fb5', '#4fd6a6', '#a684ff', '#ffc93d', '#5cb8ff', '#ff9a63', '#a8e85a'];

const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const ctex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

/** pink wallpaper: soft stripes + tiny hearts and sparkles */
export function wallTex() {
  const n = 512, [c, x] = cv(n);
  x.fillStyle = '#c99be6'; x.fillRect(0, 0, n, n);
  for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? 'rgba(255,255,255,.12)' : 'rgba(150,90,200,.12)'; x.fillRect(i * n / 8, 0, n / 8, n); }
  const heart = (cx, cy, s, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(cx, cy + s * 0.9); x.bezierCurveTo(cx - s * 1.6, cy - s * 0.2, cx - s * 0.6, cy - s * 1.3, cx, cy - s * 0.4); x.bezierCurveTo(cx + s * 0.6, cy - s * 1.3, cx + s * 1.6, cy - s * 0.2, cx, cy + s * 0.9); x.fill(); };
  const spark = (cx, cy, s, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(cx, cy - s); x.quadraticCurveTo(cx, cy, cx + s, cy); x.quadraticCurveTo(cx, cy, cx, cy + s); x.quadraticCurveTo(cx, cy, cx - s, cy); x.quadraticCurveTo(cx, cy, cx, cy - s); x.fill(); };
  for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) {
    const cx = k * 128 + (r % 2 ? 64 : 0) + 32, cy = r * 128 + 40;
    heart(cx, cy, 11, 'rgba(255,170,220,.85)'); spark(cx + 64, cy + 64, 9, 'rgba(255,240,170,.85)');
  }
  return ctex(c);
}
/** quilted cushion: soft diamonds with buttons (the board face) */
export function quiltTex(base = '#dcbcff', line = '#b48ae8') {
  const n = 512, [c, x] = cv(n), s = n / 4;
  const g = x.createLinearGradient(0, 0, 0, n); g.addColorStop(0, base); g.addColorStop(1, new THREE.Color(base).offsetHSL(0, 0, -0.03).getStyle()); x.fillStyle = g; x.fillRect(0, 0, n, n);
  for (let i = -4; i <= 8; i++) for (let j = -4; j <= 8; j++) {
    const cx = i * s, cy = j * s;   // soft pillow shading per diamond
    const rg = x.createRadialGradient(cx + s / 2, cy + s / 2, 2, cx + s / 2, cy + s / 2, s * 0.75);
    rg.addColorStop(0, 'rgba(255,255,255,.28)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = rg; x.fillRect(cx, cy, s, s);
  }
  x.strokeStyle = line; x.lineWidth = 3; x.globalAlpha = 0.55;
  for (let i = -4; i <= 8; i++) { x.beginPath(); x.moveTo(i * s, 0); x.lineTo(i * s + n, n); x.stroke(); x.beginPath(); x.moveTo(i * s, 0); x.lineTo(i * s - n, n); x.stroke(); }
  x.globalAlpha = 1;
  for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) for (const [ox, oy] of [[0, 0], [s / 2, s / 2]]) {
    const cx = i * s + ox, cy = j * s + oy; const rg = x.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, 7);
    rg.addColorStop(0, '#fff'); rg.addColorStop(1, line); x.fillStyle = rg; x.beginPath(); x.arc(cx, cy, 6, 0, 7); x.fill();
  }
  return ctex(c);
}
/** pastel floor boards */
export function floorTex() {
  const n = 512, [c, x] = cv(n), p = 6, h = n / p;
  for (let i = 0; i < p; i++) { x.fillStyle = i % 2 ? '#e2b8e8' : '#d8aae0'; x.fillRect(0, i * h, n, h); x.fillStyle = 'rgba(160,100,170,.18)'; x.fillRect(0, i * h, n, 3); x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(0, i * h + 3, n, 2); }
  return ctex(c);
}
/** the tiny face that goes on every jelly plate */
const FACES = [];
export function faceTex(kind = 0) {
  if (FACES[kind]) return FACES[kind];
  const n = 256, [c, x] = cv(n); x.clearRect(0, 0, n, n);
  const ink = '#4a2546';
  const eye = (cx, wink) => {
    if (wink) { x.strokeStyle = ink; x.lineWidth = 9; x.lineCap = 'round'; x.beginPath(); x.arc(cx, 112, 15, Math.PI * 1.1, Math.PI * 1.9); x.stroke(); return; }
    x.fillStyle = ink; x.beginPath(); x.ellipse(cx, 110, 15, 19, 0, 0, 7); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(cx - 5, 102, 6, 0, 7); x.fill(); x.beginPath(); x.arc(cx + 5, 117, 3, 0, 7); x.fill();
  };
  eye(84, false); eye(172, kind === 2);
  x.fillStyle = 'rgba(255,110,150,.55)'; for (const cx of [58, 198]) { x.beginPath(); x.ellipse(cx, 146, 22, 13, 0, 0, 7); x.fill(); }
  x.strokeStyle = ink; x.lineWidth = 8; x.lineCap = 'round';
  if (kind === 1) { x.fillStyle = '#d64a6a'; x.beginPath(); x.arc(128, 138, 15, 0, Math.PI); x.fill(); }
  else { x.beginPath(); x.moveTo(110, 138); x.quadraticCurveTo(119, 150, 128, 139); x.quadraticCurveTo(137, 150, 146, 138); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; FACES[kind] = t; return t;
}
/** soft round shadow blob */
export function blobTex() {
  const [c, x] = cv(128); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(110,40,110,.42)'); g.addColorStop(0.6, 'rgba(110,40,110,.16)'); g.addColorStop(1, 'rgba(110,40,110,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
/** sparkle star sprite */
export function starTex() {
  const [c, x] = cv(64); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#fff'; x.beginPath(); x.moveTo(32, 2); x.quadraticCurveTo(32, 32, 62, 32); x.quadraticCurveTo(32, 32, 32, 62); x.quadraticCurveTo(32, 32, 2, 32); x.quadraticCurveTo(32, 32, 32, 2); x.fill();
  return new THREE.CanvasTexture(c);
}

// ---------------------------------------------------------------- materials (shared)
export const MAT = {};
const jellyMat = (c, o = {}) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.16, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.45, ...o });
export function initMaterials() {
  MAT.white = jellyMat('#f6eefb', { roughness: 0.3 });
  MAT.cream = jellyMat('#fbe6f6', { roughness: 0.35, clearcoat: 0.6 });
  MAT.pearl = jellyMat('#f9e3f5', { roughness: 0.2, iridescence: 0.6, iridescenceIOR: 1.4 });
  MAT.pinkRim = jellyMat('#ff6fae');
  MAT.lilacRim = jellyMat('#a77dff');
  MAT.hole = new THREE.MeshBasicMaterial({ color: '#4a1f55' });
  MAT.shaft = jellyMat('#f4e9ff', { roughness: 0.25, metalness: 0.2 });
  // plates: translucent jelly so the pins under them stay readable (Screw Jam style)
  MAT.jelly = JELLY.map(c => jellyMat(c, { transparent: true, opacity: 0.9, roughness: 0.1, emissive: new THREE.Color(c).multiplyScalar(0.1) }));
  MAT.jellyEdge = JELLY.map(c => jellyMat(new THREE.Color(c).offsetHSL(0, 0.12, -0.2), { transparent: true, opacity: 0.97 }));
  MAT.face = [0, 1, 2].map(k => new THREE.MeshBasicMaterial({ map: faceTex(k), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  MAT.head = PIN.map(s => jellyMat(s.c, { roughness: 0.12, emissive: new THREE.Color(s.c).multiplyScalar(0.08) }));
  MAT.bow = PIN.map(s => jellyMat(new THREE.Color(s.c).offsetHSL(0, 0.1, 0.1), { roughness: 0.2 }));
  MAT.sym = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35, emissive: '#ffffff', emissiveIntensity: 0.25 });
  MAT.box = PIN.map(s => jellyMat(s.c, { roughness: 0.18 }));
  MAT.ribbon = PIN.map(s => jellyMat(new THREE.Color(s.c).lerp(new THREE.Color('#ffffff'), 0.32), { roughness: 0.25 }));
  MAT.glow = new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending });
  return MAT;
}

// ---------------------------------------------------------------- symbols (pin heads, box badges)
function symShape(k, s = 1) {
  const S = new THREE.Shape();
  const poly = pts => { S.moveTo(pts[0][0] * s, pts[0][1] * s); for (const p of pts.slice(1)) S.lineTo(p[0] * s, p[1] * s); S.closePath(); };
  const reg = (n, r, rot = 0) => Array.from({ length: n }, (_, i) => [Math.cos(rot + i * 2 * Math.PI / n) * r, Math.sin(rot + i * 2 * Math.PI / n) * r]);
  if (k === 'heart') { S.moveTo(0, -0.12 * s); S.bezierCurveTo(-0.2 * s, 0.0, -0.11 * s, 0.15 * s, 0, 0.055 * s); S.bezierCurveTo(0.11 * s, 0.15 * s, 0.2 * s, 0, 0, -0.12 * s); }
  else if (k === 'star') { const p = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.06 : 0.14, t = Math.PI / 2 + i * Math.PI / 5; p.push([Math.cos(t) * r, Math.sin(t) * r]); } poly(p); }
  else if (k === 'drop') { S.moveTo(0, 0.14 * s); S.bezierCurveTo(0.03 * s, 0.07 * s, 0.1 * s, 0.01 * s, 0.1 * s, -0.04 * s); S.absarc(0, -0.04 * s, 0.1 * s, 0, Math.PI, true); S.bezierCurveTo(-0.1 * s, 0.01 * s, -0.03 * s, 0.07 * s, 0, 0.14 * s); }
  else if (k === 'clover') { const out = []; for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4, c = new THREE.Shape(); c.absarc(Math.cos(a) * 0.062 * s, Math.sin(a) * 0.062 * s, 0.062 * s, 0, Math.PI * 2, false); out.push(c); } return out; }
  else if (k === 'moon') { S.absarc(0, 0, 0.13 * s, Math.PI * 0.32, Math.PI * 1.68, false); S.absarc(0.07 * s, 0, 0.1 * s, Math.PI * 1.5, Math.PI * 0.5, true); }
  else if (k === 'diamond') poly([[0, 0.14], [0.1, 0], [0, -0.14], [-0.1, 0]]);
  else if (k === 'flower') { const p = []; for (let i = 0; i <= 60; i++) { const t = i / 60 * Math.PI * 2, r = 0.09 + 0.045 * Math.cos(5 * t); p.push([Math.cos(t) * r, Math.sin(t) * r]); } poly(p); const h = new THREE.Path(); h.absarc(0, 0, 0.035 * s, 0, Math.PI * 2, true); S.holes.push(h); }
  else if (k === 'square') { const r = 0.03, a = 0.1; S.moveTo((-a + r) * s, -a * s); S.lineTo((a - r) * s, -a * s); S.quadraticCurveTo(a * s, -a * s, a * s, (-a + r) * s); S.lineTo(a * s, (a - r) * s); S.quadraticCurveTo(a * s, a * s, (a - r) * s, a * s); S.lineTo((-a + r) * s, a * s); S.quadraticCurveTo(-a * s, a * s, -a * s, (a - r) * s); S.lineTo(-a * s, (-a + r) * s); S.quadraticCurveTo(-a * s, -a * s, (-a + r) * s, -a * s); }
  else if (k === 'ring') { S.absarc(0, 0, 0.12 * s, 0, Math.PI * 2, false); const h = new THREE.Path(); h.absarc(0, 0, 0.06 * s, 0, Math.PI * 2, true); S.holes.push(h); }
  return S;
}
const GEO = {};
function bowGeo(scale = 1) {
  // a satin bow seen from the front: two puffy loops, two tails, a round knot (merged into one geometry)
  const parts = [];
  for (const sx of [-1, 1]) {
    const loop = new THREE.SphereGeometry(0.15, 18, 12); loop.scale(1.25, 0.82, 0.55); loop.rotateZ(sx * 0.32); loop.translate(sx * 0.15, 0.02, 0); parts.push(loop);
    const tail = new THREE.SphereGeometry(0.07, 12, 8); tail.scale(0.8, 1.7, 0.5); tail.rotateZ(sx * 0.5); tail.translate(sx * 0.07, -0.12, -0.01); parts.push(tail);
  }
  const knot = new THREE.SphereGeometry(0.07, 16, 12); knot.scale(1, 0.95, 0.75); knot.translate(0, 0.01, 0.03); parts.push(knot);
  const g = mergeGeometries(parts.map(p => { p.deleteAttribute('uv'); return p; })); g.scale(scale, scale, scale); return g;
}
export function initGeometry() {
  // pin head: a plump jelly button (lathe around Y, turned so the axis is +Z)
  const prof = [[0, 0], [0.27, 0], [0.3, 0.035], [0.3, 0.08], [0.275, 0.13], [0.21, 0.175], [0.11, 0.2], [0, 0.205]].map(([r, y]) => new THREE.Vector2(r, y));
  GEO.head = new THREE.LatheGeometry(prof, 40); GEO.head.rotateX(Math.PI / 2);
  GEO.sym = PIN.map(p => { const sh = symShape(p.sym, 1.15); const g = new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.008, bevelSegments: 2, curveSegments: 12 }); g.translate(0, 0, 0.18); return g; });
  GEO.bow = bowGeo(1); GEO.bow.translate(0, 0.27, 0.17);
  // pin shank: a pearly peg with a rounded tip
  const sp = [new THREE.Vector2(0, -0.95), new THREE.Vector2(0.06, -0.9), new THREE.Vector2(0.085, -0.8), new THREE.Vector2(0.085, -0.05), new THREE.Vector2(0.12, 0), new THREE.Vector2(0, 0)];
  GEO.shaft = new THREE.LatheGeometry(sp, 16); GEO.shaft.rotateX(Math.PI / 2);
  // holes: plum recess + pearly ring
  GEO.holeDisc = new THREE.CircleGeometry(0.21, 28);
  GEO.ring = new THREE.TorusGeometry(0.25, 0.05, 10, 36);
  GEO.boxSym = PIN.map(p => new THREE.ExtrudeGeometry(symShape(p.sym, 2.0), { depth: 0.04, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.012, bevelSegments: 2, curveSegments: 10 }));
  GEO.boxBow = bowGeo(2.3);
  GEO.badge = new THREE.CylinderGeometry(0.3, 0.3, 0.08, 32); GEO.badge.rotateX(Math.PI / 2);
  GEO.face = new THREE.PlaneGeometry(0.62, 0.62);
  return GEO;
}

/** a bow-pin: group with .spin (head + symbol + bow + shank); local +Z is out of the board */
export function makeScrew(color) {
  const g = new THREE.Group();
  const head = new THREE.Mesh(GEO.head, MAT.head[color]); head.castShadow = true;
  const sym = new THREE.Mesh(GEO.sym[color], MAT.sym);
  const shaft = new THREE.Mesh(GEO.shaft, MAT.shaft); shaft.castShadow = true;
  const spin = new THREE.Group(); spin.add(head, sym, shaft);
  const bow = new THREE.Mesh(GEO.bow, MAT.bow[color]); bow.castShadow = true;
  g.add(spin, bow);   // the bow stays upright while the head twists
  g.userData = { spin, color, bow }; g.spin = spin; g.bow = bow;
  return g;
}

/** a jelly plate: rounded hull of its key points, holes under its pins, translucent candy face + a tiny face.
 *  Returned as outer (pivot) group → inner mesh, so the plate can later swing around any pin. */
export function makePlate(pl, screwPts, thick = 0.18) {
  const ring = [];
  for (const [x, y] of pl.pts) for (let i = 0; i < 28; i++) { const t = i / 28 * Math.PI * 2; ring.push([x + Math.cos(t) * PLATE_R, y + Math.sin(t) * PLATE_R]); }
  const out = hull2(ring);
  const shape = new THREE.Shape(); out.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y)); shape.closePath();
  for (const [x, y] of screwPts) { const h = new THREE.Path(); h.absarc(x, y, 0.17, 0, Math.PI * 2, true); shape.holes.push(h); }
  const bev = 0.075;
  const geo = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.02, thick - bev * 2), bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.9, bevelSegments: 3, curveSegments: 18 });
  geo.translate(0, 0, bev);
  const ci = pl.color % JELLY.length;
  const mesh = new THREE.Mesh(geo, [MAT.jelly[ci], MAT.jellyEdge[ci]]); mesh.castShadow = true; mesh.receiveShadow = false;
  mesh.renderOrder = 1;
  const inner = new THREE.Group(), jig = new THREE.Group(), [cx, cy] = pl.com || [0, 0];
  jig.position.set(cx, cy, 0); mesh.position.set(-cx, -cy, 0); jig.add(mesh); inner.add(jig);   // jig = jelly wobble pivot at the plate centre
  // the face: on the widest free spot of the plate (centroid, nudged away from the pins)
  const face = faceSpot(pl, screwPts);
  if (face) {
    const f = new THREE.Mesh(GEO.face, MAT.face[(pl.i * 7 + pl.color) % 3]); f.position.set(face[0] - cx, face[1] - cy, thick + 0.012); f.scale.setScalar(face[2]); f.renderOrder = 2; jig.add(f);
  }
  const outer = new THREE.Group(); outer.add(inner);
  outer.userData = { inner, mesh, thick, jig };
  return outer;
}
function faceSpot(pl, pins) {
  // sample points inside the plate hull, pick the one farthest from any pin and the rim
  const P = pl.poly; let best = null, bd = -1;
  const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
  const x0 = Math.min(...xs) - PLATE_R, x1 = Math.max(...xs) + PLATE_R, y0 = Math.min(...ys) - PLATE_R, y1 = Math.max(...ys) + PLATE_R;
  for (let i = 0; i <= 12; i++) for (let j = 0; j <= 12; j++) {
    const x = x0 + (x1 - x0) * i / 12, y = y0 + (y1 - y0) * j / 12;
    const rim = PLATE_R - polyDistSigned(P, x, y); if (rim < 0.18) continue;
    let d = rim; for (const [px, py] of pins) d = Math.min(d, Math.hypot(px - x, py - y) - 0.3);
    if (d > bd) { bd = d; best = [x, y]; }
  }
  if (!best || bd < 0.14) return null;
  return [best[0], best[1], Math.min(1.25, Math.max(0.55, bd * 2.2))];
}
function polyDistSigned(P, x, y) {   // distance to the hull polygon (0 inside); inside points get -depth
  if (P.length < 3) { let d = 1e9; const n = P.length; for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; d = Math.min(d, segD(x, y, a, b)); } return d; }
  let inside = true, d = 1e9;
  for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; if ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) < 0) inside = false; d = Math.min(d, segD(x, y, a, b)); }
  return inside ? -d : d;
}
function segD(px, py, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy; let t = l ? ((px - a[0]) * dx + (py - a[1]) * dy) / l : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy); }
function hull2(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

/** instanced holes (plum recess + pearly ring) */
export function makeHoles(max = 64) {
  const disc = new THREE.InstancedMesh(GEO.holeDisc, MAT.hole, max), ring = new THREE.InstancedMesh(GEO.ring, MAT.pearl, max);
  ring.receiveShadow = true; disc.count = ring.count = 0;
  const g = new THREE.Group(); g.add(disc, ring);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  g.set = (list) => {
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

/** a gift box in the pin colour: ribbon cross, big bow on top, cream front with 3 holes, symbol badge.
 *  Box centre at origin; holes at box.userData.slots (local) */
export function makeBox(color) {
  const g = new THREE.Group(), W = 2.35, H = 1.2, D = 0.95;
  const body = new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 4, 0.22), MAT.box[color]); body.castShadow = true; body.receiveShadow = true;
  const lid = new THREE.Mesh(new RoundedBoxGeometry(W + 0.12, 0.3, D + 0.12, 3, 0.12), MAT.box[color]); lid.position.y = H / 2 - 0.02; lid.castShadow = true;
  const rib = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.34, D + 0.16, 2, 0.06), MAT.ribbon[color]); rib.position.y = H / 2 - 0.02;
  const panel = new THREE.Mesh(new RoundedBoxGeometry(W - 0.3, H - 0.5, 0.1, 3, 0.12), MAT.cream); panel.position.set(0, -0.12, D / 2 + 0.01); panel.receiveShadow = true;
  const bow = new THREE.Mesh(GEO.boxBow, MAT.ribbon[color]); bow.position.set(0, H / 2 + 0.3, 0.1); bow.castShadow = true;
  const badge = new THREE.Mesh(GEO.badge, MAT.white); badge.position.set(-W / 2 + 0.05, H / 2 - 0.02, D / 2 + 0.04);
  const sym = new THREE.Mesh(GEO.boxSym[color], MAT.box[color]); sym.scale.setScalar(0.85); sym.position.set(-W / 2 + 0.05, H / 2 - 0.02, D / 2 + 0.08);
  g.add(body, lid, rib, panel, bow, badge, sym);
  const slots = [-0.62, 0, 0.62].map(x => new THREE.Vector3(x, -0.12, D / 2 + 0.07));
  const holes = makeHoles(3); holes.set(slots.map(p => ({ x: p.x, y: p.y, z: p.z - 0.01, s: 0.95 }))); g.add(holes);
  g.userData = { slots, color, W, H, D };
  return g;
}
export { GEO };
