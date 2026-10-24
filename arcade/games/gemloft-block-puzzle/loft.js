// The lofts you restore with stars: data (makeover tasks + where each piece goes) and a builder that makes each loft as a
// dollhouse slice in code (floorboards, plaster / brick walls, a big steel factory window with light shafts, exposed
// roof beams, fairy lights, dusty crates) and furnishes it with the AI 3D library (assets/*.glb).
import { THREE } from './kit/hc.js';
import { RoundedBoxGeometry } from './kit/addons/geometries/RoundedBoxGeometry.js';
import { piece, prop } from './assets.js';

const PI = Math.PI;
export const LOFTS = [
  { id: 'studio', name: 'Studio Loft', W: 11, D: 8, H: 5.2, host: [1.5, 0, 1.6, -0.5], win: { x: 1.6, y: 2.75, w: 3.8, h: 3.3 },
    wall: { a: '#f0c9b2', b: '#e9b9a0' }, brick: '#b8573f', floor: { a: '#d79a5d', b: '#c4844a' }, lights: '#ffd27a',
    clutter: [[-1.6, 0, -2.6, 0.2, 1.05], [-0.6, 0, -2.9, -0.3, 0.9], [-1.2, 1.0, -2.75, 0.5, 0.8], [3.4, 0, 0.8, 0.4, 1.0], [4.2, 0, 1.6, -0.2, 0.85], [-3.9, 0, 1.2, 0.3, 0.95]],
    sheets: [[-4.4, -2.6, 1.0, 1.5, 0.8, 0], [3.6, 2.6, 1.3, 0.9, 1.0, 0.4]],
    tasks: [
      { id: 'clutter', name: 'Clear the boxes', cost: 1, kind: 'clutter', icon: '📦' },
      { id: 'window', name: 'Wash the big window', cost: 1, kind: 'window', icon: '🪟' },
      { id: 'sofa', name: 'Velvet sofa', cost: 2, item: 'h01', at: [-1.9, 0, -2.85], rot: 0, size: 3.4 },
      { id: 'walls', name: 'Exposed brick wall', cost: 2, kind: 'walls', icon: '🧱' },
      { id: 'rug', name: 'Woven rug', cost: 1, item: 'h08', at: [-0.8, 0, -0.5], rot: 0, size: 4.2, sy: 0.35 },
      { id: 'table', name: 'Coffee table', cost: 1, item: 'h03', at: [-0.8, 0, -0.6], rot: 0.3, size: 1.25 },
      { id: 'floor', name: 'Honey oak floor', cost: 2, kind: 'floor', icon: '🪵' },
      { id: 'lamp', name: 'Brass floor lamp', cost: 1, item: 'h04', at: [-4.3, 0, -3.1], rot: 0, size: 2.7 },
      { id: 'lights', name: 'Fairy lights', cost: 2, kind: 'lights', icon: '✨' },
      { id: 'shelf', name: 'Bookshelf', cost: 2, item: 'h07', at: [-5.05, 0, 1.6], rot: PI / 2, size: 3.0 },
      { id: 'plant', name: 'Monstera', cost: 1, item: 'h05', at: [4.4, 0, -3.15], rot: 0, size: 1.9 },
      { id: 'chair', name: 'Pink armchair', cost: 2, item: 'h02', at: [2.3, 0, 0.3], rot: -0.9, size: 1.75 },
      { id: 'art', name: 'Landscape painting', cost: 1, item: 'h16', at: [-1.9, 3.15, -3.83], rot: 0, size: 1.5 },
      { id: 'gramo', name: 'Gramophone', cost: 2, item: 'h15', at: [-4.7, 0, -1.2], rot: PI / 2 - 0.3, size: 1.35 },
      { id: 'fig', name: 'Fig in a basket', cost: 1, item: 'h06', at: [4.7, 0, 1.4], rot: 0, size: 2.2 },
      { id: 'cat', name: 'Sleepy cat', cost: 2, item: 'h19', at: [-0.2, 0, 1.3], rot: 0.6, size: 1.0 },
    ] },
  { id: 'nook', name: 'Bedroom Nook', W: 11, D: 8, H: 5.2, host: [0.6, 0, 1.8, -0.4], win: { x: -1.4, y: 2.75, w: 3.4, h: 3.3 },
    wall: { a: '#dfe6f4', b: '#d2dbee' }, brick: '#a8644c', floor: { a: '#e7c9a0', b: '#d8b385' }, lights: '#ffe1a8',
    clutter: [[2.4, 0, -2.8, 0.3, 1.0], [3.2, 0, -2.4, -0.2, 0.9], [2.8, 1.0, -2.7, 0.4, 0.8], [-2.8, 0, 1.0, 0.1, 1.0], [-2.0, 0, 1.7, 0.6, 0.85]],
    sheets: [[2.6, 0.4, 1.6, 1.1, 1.2, 0], [-4.5, -2.4, 0.9, 1.4, 0.7, 0]],
    tasks: [
      { id: 'clutter', name: 'Clear the boxes', cost: 1, kind: 'clutter', icon: '📦' },
      { id: 'walls', name: 'Brick + powder blue', cost: 2, kind: 'walls', icon: '🎨' },
      { id: 'bed', name: 'Canopy bed', cost: 3, item: 'h11', at: [2.6, 0, -2.4], rot: 0, size: 3.3 },
      { id: 'window', name: 'Wash the big window', cost: 1, kind: 'window', icon: '🪟' },
      { id: 'floor', name: 'Whitewashed boards', cost: 2, kind: 'floor', icon: '🪵' },
      { id: 'rug', name: 'Pastel rug', cost: 1, item: 'h08', at: [1.6, 0, 0.6], rot: 0, size: 3.6, sy: 0.35 },
      { id: 'drawers', name: 'Chest of drawers', cost: 2, item: 'h12', at: [-4.6, 0, -2.9], rot: 0.4, size: 1.7 },
      { id: 'vanity', name: 'Vanity table', cost: 2, item: 'h13', at: [-4.95, 0, 0.8], rot: PI / 2, size: 2.1 },
      { id: 'lights', name: 'Fairy lights', cost: 2, kind: 'lights', icon: '✨' },
      { id: 'chand', name: 'Crystal chandelier', cost: 2, item: 'h17', at: [1.6, 3.25, 0.2], rot: 0, size: 1.4, hang: true },
      { id: 'clock', name: 'Grandfather clock', cost: 2, item: 'h10', at: [5.0, 0, -0.9], rot: -PI / 2, size: 3.1 },
      { id: 'fig', name: 'Fiddle leaf fig', cost: 1, item: 'h06', at: [-4.7, 0, 3.0], rot: 0, size: 2.1 },
      { id: 'bouquet', name: 'Fresh flowers', cost: 1, item: 'g05', at: [-4.6, 1.7, -2.9], rot: 0.2, size: 0.75 },
      { id: 'lamp', name: 'Reading lamp', cost: 1, item: 'h04', at: [0.4, 0, -3.2], rot: 0, size: 2.5 },
      { id: 'candle', name: 'Glow candle', cost: 1, item: 't27', at: [-4.95, 1.62, 0.3], rot: 0, size: 0.32 },
    ] },
];

// ---------------------------------------------------------------- canvas textures
function canvas(w, h, fn) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}
const rnd = (a, b) => a + Math.random() * (b - a);
function grime(x, w, h, n = 50, a = 0.18) {
  for (let i = 0; i < n; i++) { const r = rnd(10, 70), px = rnd(0, w), py = rnd(0, h), g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, `rgba(70,60,50,${rnd(0.04, a)})`); g.addColorStop(1, 'rgba(70,60,50,0)'); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); }
}
const plasterShabby = () => canvas(512, 512, (x, w, h) => {
  x.fillStyle = '#d2c3ae'; x.fillRect(0, 0, w, h); grime(x, w, h, 80, 0.2);
  for (let i = 0; i < 7; i++) { x.strokeStyle = 'rgba(80,70,55,.28)'; x.lineWidth = rnd(1, 2.5); x.beginPath(); let px = rnd(0, w), py = rnd(0, h); x.moveTo(px, py); for (let k = 0; k < 7; k++) x.lineTo(px += rnd(-25, 25), py += rnd(5, 30)); x.stroke(); }
  for (let i = 0; i < 8; i++) { x.fillStyle = 'rgba(150,140,128,.7)'; const px = rnd(0, w), py = rnd(0, h); x.beginPath(); x.ellipse(px, py, rnd(14, 40), rnd(8, 22), rnd(0, 3), 0, 7); x.fill(); }
});
const plasterNice = (a, b) => canvas(512, 512, (x, w, h) => {
  x.fillStyle = a; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) { const r = rnd(20, 90), px = rnd(0, w), py = rnd(0, h), g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, i % 2 ? b : 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.globalAlpha = 0.25; x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); }
  x.globalAlpha = 1;
});
const brickTex = (base, shabby) => canvas(512, 512, (x, w, h) => {
  x.fillStyle = shabby ? '#a39d93' : '#efe2d0'; x.fillRect(0, 0, w, h);
  const bw = 64, bh = 28; const c = new THREE.Color(base);
  for (let r = 0; r < h / bh + 1; r++) for (let k = -1; k < w / bw + 1; k++) {
    const px = k * bw + (r % 2 ? bw / 2 : 0) + 3, py = r * bh + 3, cc = c.clone().offsetHSL(rnd(-0.015, 0.015), rnd(-0.08, 0.05), rnd(-0.08, 0.08));
    if (shabby) cc.lerp(new THREE.Color('#b6aea2'), 0.75);
    x.fillStyle = '#' + cc.getHexString(); x.beginPath(); x.roundRect(px, py, bw - 6, bh - 6, 4); x.fill();
    const g = x.createLinearGradient(0, py, 0, py + bh); g.addColorStop(0, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(0,0,0,.14)'); x.fillStyle = g; x.fill();
  }
  if (shabby) grime(x, w, h, 70, 0.3); else grime(x, w, h, 12, 0.06);
});
const floorTex = (f, shabby) => canvas(512, 512, (x, w, h) => {
  const pw = 256, ph = 42;
  for (let y = 0; y < h; y += ph) for (let px = ((y / ph) % 2) * -128; px < w; px += pw) {
    x.fillStyle = shabby ? (Math.random() < 0.5 ? '#ab977c' : '#b8a488') : (Math.random() < 0.5 ? f.a : f.b); x.fillRect(px, y, pw, ph);
    x.strokeStyle = shabby ? 'rgba(40,35,30,.45)' : 'rgba(100,60,25,.4)'; x.lineWidth = 2; x.strokeRect(px, y, pw, ph);
    for (let g = 0; g < 4; g++) { x.strokeStyle = shabby ? 'rgba(60,50,40,.12)' : 'rgba(120,70,30,.13)'; x.beginPath(); x.moveTo(px, y + rnd(6, 36)); x.bezierCurveTo(px + 80, y + rnd(6, 36), px + 160, y + rnd(6, 36), px + pw, y + rnd(6, 36)); x.stroke(); }
  }
  if (shabby) grime(x, w, h, 70, 0.3); else { x.fillStyle = 'rgba(255,240,220,.06)'; x.fillRect(0, 0, w, h); }
});
const skyTex = () => canvas(128, 256, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#8fcfff'); g.addColorStop(0.65, '#d8f0ff'); g.addColorStop(1, '#ffe9c9'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.fillStyle = 'rgba(255,255,255,.9)'; for (let i = 0; i < 7; i++) { const cx = rnd(5, 120), cy = rnd(30, 160); for (let k = 0; k < 4; k++) { x.beginPath(); x.ellipse(cx + k * 9, cy + Math.sin(k) * 3, rnd(8, 14), rnd(4, 7), 0, 0, 7); x.fill(); } }
  // distant rooftops
  x.fillStyle = '#c99f8f'; for (let i = 0; i < 9; i++) { const bx = i * 15 + rnd(-3, 3), bh = rnd(18, 50); x.fillRect(bx, h - bh, 14, bh); }
  x.fillStyle = '#b48676'; for (let i = 0; i < 6; i++) { const bx = rnd(0, w), bh = rnd(10, 30); x.fillRect(bx, h - bh, 20, bh); }
});
const shaftTex = () => canvas(64, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,236,190,.6)'); g.addColorStop(1, 'rgba(255,236,190,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
const cobwebTex = () => canvas(256, 256, (x) => {
  x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 1.5;
  for (let i = 0; i <= 8; i++) { const a = i / 8 * PI / 2; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * 250, Math.sin(a) * 250); x.stroke(); }
  for (let r = 30; r < 250; r += 30) { x.beginPath(); for (let i = 0; i <= 8; i++) { const a = i / 8 * PI / 2, rr = r + Math.sin(i * 3) * 6; i ? x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : x.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } x.stroke(); }
});

// ---------------------------------------------------------------- builder
const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...o });
export async function buildLoft(def) {
  const g = new THREE.Group(); g.name = def.id;
  const { W, D, H } = def, hw = W / 2, hd = D / 2;
  const R = { group: g, def, items: {}, apply: {}, glow: [] };
  // slab + floor
  const slab = new THREE.Mesh(new RoundedBoxGeometry(W + 0.6, 0.7, D + 0.6, 3, 0.18), M('#e6d2b8', { roughness: 0.9 })); slab.position.set(-0.15, -0.36, -0.15); slab.receiveShadow = true; g.add(slab);
  const fS = floorTex(def.floor, true), fN = floorTex(def.floor, false); fS.repeat.set(W / 4, D / 4); fN.repeat.set(W / 4, D / 4);
  const floorMat = M('#ffffff', { map: fS, roughness: 0.85 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat); floor.rotation.x = -PI / 2; floor.position.y = 0.005; floor.receiveShadow = true; g.add(floor);
  R.apply.floor = nice => { floorMat.map = nice ? fN : fS; floorMat.roughness = nice ? 0.42 : 0.85; floorMat.needsUpdate = true; };
  // walls: back = plaster, left = brick (shabby: both grey)
  const backS = plasterShabby(), backN = plasterNice(def.wall.a, def.wall.b), brS = brickTex(def.brick, true), brN = brickTex(def.brick, false);
  for (const t of [backS, backN]) t.repeat.set(W / 4, H / 4);
  for (const t of [brS, brN]) t.repeat.set(D / 3, H / 3);
  const backMat = M('#ffffff', { map: backS, roughness: 0.9 }), leftMat = M('#ffffff', { map: brS, roughness: 0.9 }), capMat = M('#f6ece0', { roughness: 0.7 });
  const mkWall = (w, d, x, z, inner, mat) => { const mats = Array(6).fill(capMat); mats[inner] = mat; const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), mats); m.position.set(x, H / 2, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  mkWall(W + 0.6, 0.3, -0.15, -hd - 0.15, 4, backMat);
  mkWall(0.3, D, -hw - 0.15, 0, 0, leftMat);
  // skirting + steel trims shown after the walls task
  const trims = new THREE.Group(), trimM = M('#fff8ef', { roughness: 0.45 });
  const sk1 = new THREE.Mesh(new THREE.BoxGeometry(W, 0.24, 0.12), trimM); sk1.position.set(0, 0.12, -hd + 0.06); trims.add(sk1);
  const sk2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, D), trimM); sk2.position.set(-hw + 0.06, 0.12, 0); trims.add(sk2);
  trims.visible = false; g.add(trims);
  R.apply.walls = nice => { backMat.map = nice ? backN : backS; leftMat.map = nice ? brN : brS; backMat.needsUpdate = leftMat.needsUpdate = true; trims.visible = nice; };
  // roof beams (always there: it's a loft) + a ridge
  const beamM = M('#7a4f33', { roughness: 0.7 }), beams = new THREE.Group(); g.add(beams); R.beams = beams;
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, D + 0.3), beamM); b.position.set(-hw + 2 + i * (W - 4) / 2, H + 0.1, -0.15); b.castShadow = true; beams.add(b); }
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 0.36, 0.36), beamM); ridge.position.set(-0.15, H + 0.1, -hd + 0.1); beams.add(ridge);
  // factory window: steel grid, sky, grime, light shafts
  const { x: wx, y: wy, w: ww, h: wh } = def.win, win = new THREE.Group(); win.position.set(wx, wy, -hd + 0.02);
  const skyM = new THREE.MeshBasicMaterial({ map: skyTex(), toneMapped: false, color: '#7d8590' });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), skyM); sky.position.z = 0.01; win.add(sky);
  const steel = M('#2f2b33', { roughness: 0.35, metalness: 0.6 });
  const bars = [];
  const bar = (w, h, x, y, d = 0.14) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), steel); b.position.set(x, y, 0.06); b.castShadow = true; win.add(b); bars.push(b); };
  bar(ww + 0.24, 0.16, 0, wh / 2); bar(ww + 0.24, 0.2, 0, -wh / 2); bar(0.16, wh, -ww / 2, 0); bar(0.16, wh, ww / 2, 0);
  for (let i = 1; i < 4; i++) bar(0.06, wh, -ww / 2 + i * ww / 4, 0, 0.08);
  for (let i = 1; i < 3; i++) bar(ww, 0.06, 0, -wh / 2 + i * wh / 3, 0.08);
  const sill = new THREE.Mesh(new RoundedBoxGeometry(ww + 0.6, 0.12, 0.5, 2, 0.04), M('#fff6ea', { roughness: 0.5 })); sill.position.set(0, -wh / 2 - 0.12, 0.22); sill.castShadow = true; win.add(sill);
  const dirt = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), new THREE.MeshBasicMaterial({ map: cobwebTex(), transparent: true, opacity: 0.55, depthWrite: false, color: '#d8d0c4' })); dirt.position.z = 0.03; win.add(dirt);
  const shaftM = new THREE.MeshBasicMaterial({ map: shaftTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0.3 });
  const shafts = new THREE.Group();
  for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(ww * 0.42, 7.5), shaftM); s.position.set(-ww * 0.3 + i * ww * 0.3, -2.4, 2.8); s.rotation.set(-1.0, 0.1, 0); shafts.add(s); }
  win.add(shafts); g.add(win);
  R.apply.window = nice => { skyM.color.set(nice ? '#ffffff' : '#7d8590'); dirt.visible = !nice; shafts.visible = nice; };
  // fairy lights: two catenaries of warm bulbs under the beams
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 10, 8), new THREE.MeshBasicMaterial({ color: def.lights, toneMapped: false }), 60);
  const wire = new THREE.Group(), wireM = new THREE.MeshBasicMaterial({ color: '#4a3a2c' }); const m4 = new THREE.Matrix4(); let bi = 0;
  for (const [x0, z0, x1, z1] of [[-hw + 0.2, -hd + 0.3, hw - 0.6, -hd + 0.3], [-hw + 0.25, -hd + 0.3, -hw + 0.25, hd - 0.6]]) {
    const pts = []; for (let i = 0; i <= 30; i++) { const t = i / 30; pts.push(new THREE.Vector3(x0 + (x1 - x0) * t, H - 0.25 - Math.sin(t * PI) * 0.9, z0 + (z1 - z0) * t)); }
    const curve = new THREE.CatmullRomCurve3(pts); wire.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.012, 4), wireM));
    for (let i = 1; i < 30 && bi < 60; i++) { const p = curve.getPoint(i / 30); m4.makeTranslation(p.x, p.y - 0.08, p.z); bulbs.setMatrixAt(bi++, m4); }
  }
  bulbs.count = bi; const lightsG = new THREE.Group(); lightsG.add(wire, bulbs); lightsG.visible = false; g.add(lightsG);
  R.apply.lights = nice => { lightsG.visible = nice; };
  R.bulbs = bulbs;
  // clutter: crates, cobwebs, dust sheets
  const clutter = new THREE.Group(); g.add(clutter);
  const crate = await piece('m11', 'base');
  for (const [x, y, z, r, s] of def.clutter) { const m = new THREE.Mesh(crate.geo, crate.mat); m.position.set(x, y, z); m.rotation.y = r; m.scale.setScalar(s); m.castShadow = m.receiveShadow = true; clutter.add(m); }
  const web = new THREE.MeshBasicMaterial({ map: cobwebTex(), transparent: true, depthWrite: false, opacity: 0.8 });
  const w1 = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), web); w1.position.set(-hw + 0.95, H - 0.95, -hd + 0.06); w1.rotation.z = -PI / 2; clutter.add(w1);
  const sheetG = new THREE.SphereGeometry(1, 20, 12, 0, PI * 2, 0, PI / 2), sp = sheetG.attributes.position;
  for (let i = 0; i < sp.count; i++) sp.setXYZ(i, sp.getX(i) * (1 + Math.sin(i * 1.7) * 0.05), sp.getY(i) * (0.9 + Math.sin(i * 0.9) * 0.08), sp.getZ(i) * (1 + Math.cos(i * 1.3) * 0.05));
  sheetG.computeVertexNormals();
  const sm = M('#efe6da', { roughness: 0.95 });
  for (const [x, z, sx, sy, sz, r] of def.sheets) { const m = new THREE.Mesh(sheetG, sm); m.position.set(x, 0, z); m.scale.set(sx, sy, sz); m.rotation.y = r; m.castShadow = m.receiveShadow = true; clutter.add(m); }
  R.clutter = clutter; R.apply.clutter = nice => { clutter.visible = !nice; };
  // furniture (hidden until placed)
  for (const t of def.tasks) {
    if (!t.item) continue;
    const m = await prop(t.item, t.size); m.position.set(...t.at); m.rotation.y = t.rot || 0;
    if (t.sy) m.scale.y *= t.sy;
    if (t.hang) { const L = H - t.at[1] - t.size, ch = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 6), M('#c8a04a', { metalness: 0.8, roughness: 0.3 })); ch.scale.set(1 / t.size, L / t.size, 1 / t.size); ch.position.y = 1 + L / t.size / 2; m.add(ch); }
    m.visible = false; m.userData.base = m.scale.clone(); g.add(m); R.items[t.id] = m;
  }
  return R;
}
