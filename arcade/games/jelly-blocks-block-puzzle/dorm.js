// The rooms you decorate with stars: data (makeover tasks + where each piece goes) and a builder that makes each room as
// a pastel dollhouse slice in code (planks → candy checker floor, dusty plaster → polka-dot wallpaper, a cloud window
// with curtains, heart fairy lights, moving boxes) and furnishes it with the kawaii 3D library (assets/*.glb).
import { THREE } from './kit/hc.js';
import { RoundedBoxGeometry } from './kit/addons/geometries/RoundedBoxGeometry.js';
import { prop } from './assets.js';

const PI = Math.PI;
export const ROOMS = [
  { id: 'dorm', name: 'Dorm Room', W: 10, D: 8, H: 5, host: [0.9, 0, 1.2, -0.3], win: { x: 1.6, y: 2.9, w: 3.0, h: 2.4 },
    paper: { a: '#d2b3fb', dot: '#ffffff', b: '#ffb0d6' }, floor: { a: '#ffbcdc', b: '#fff0f7' }, lights: ['#ff8fc6', '#ffe27a', '#8ff0cf', '#c6a4ff'],
    boxes: [[-1.2, 0, -2.6, 0.2, 1.05], [-0.2, 0, -3.0, -0.3, 0.85], [-0.8, 0.82, -2.8, 0.5, 0.7], [3.0, 0, 0.6, 0.4, 1.0], [3.7, 0, 1.6, -0.2, 0.8], [-3.6, 0, 1.4, 0.3, 0.95]],
    tasks: [
      { id: 'clutter', name: 'Unpack the boxes', cost: 1, kind: 'clutter', icon: '📦' },
      { id: 'window', name: 'Open the curtains', cost: 1, kind: 'window', icon: '☁️' },
      { id: 'bed', name: 'Cloud-pink bed', cost: 2, item: 'h01', at: [-3.15, 0, -2.0], rot: 0, size: 3.6 },
      { id: 'walls', name: 'Polka-dot wallpaper', cost: 2, kind: 'walls', icon: '🎀' },
      { id: 'rug', name: 'Cloud rug', cost: 1, item: 'h05', at: [0.6, 0, 0.6], rot: 0, size: 3.4, sy: 0.6 },
      { id: 'desk', name: 'Study desk', cost: 2, item: 'h03', at: [1.7, 0, -2.95], rot: 0, size: 2.1 },
      { id: 'floor', name: 'Candy tile floor', cost: 2, kind: 'floor', icon: '🍬' },
      { id: 'beanbag', name: 'Comfy beanbag', cost: 1, item: 'h02', at: [2.9, 0, 1.0], rot: -0.7, size: 1.7 },
      { id: 'lamp', name: 'Mushroom lamp', cost: 1, item: 'h06', at: [4.1, 0, -3.1], rot: -0.3, size: 1.4 },
      { id: 'lights', name: 'Heart fairy lights', cost: 2, kind: 'lights', icon: '✨' },
      { id: 'vanity', name: 'Bulb-mirror vanity', cost: 2, item: 'h04', at: [-4.15, 0, 1.6], rot: PI / 2, size: 2.4 },
      { id: 'shelf', name: 'Cute wall shelf', cost: 1, item: 'h08', at: [-0.25, 2.0, -3.82], rot: 0, size: 1.6 },
      { id: 'rainbow', name: 'Rainbow wall art', cost: 1, item: 'x05', at: [-3.15, 3.3, -3.86], rot: 0, size: 1.7 },
      { id: 'bear', name: 'Bestie bear', cost: 1, item: 'g15', at: [-3.6, 0.9, -2.9], rot: 0.3, size: 0.8 },
      { id: 'plant', name: 'Smiley succulent', cost: 1, item: 'h07', at: [4.2, 0, 0.0], rot: -0.4, size: 0.9 },
      { id: 'bunny', name: 'Big bunny plush', cost: 2, item: 'g17', at: [-1.2, 0, 2.2], rot: 0.5, size: 1.2 },
      { id: 'cat', name: 'Cat-loaf pillow', cost: 1, item: 'g16', at: [-2.6, 0.95, -0.9], rot: 0.2, size: 0.75 },
    ] },
  { id: 'cafe', name: 'Sweet Café Corner', W: 10, D: 8, H: 5, host: [0.0, 0, 2.0, -0.2], win: { x: -0.8, y: 2.9, w: 3.2, h: 2.4 },
    paper: { a: '#aeead4', dot: '#ffffff', b: '#ffd98a' }, floor: { a: '#ffc4e0', b: '#d6c2ff' }, lights: ['#fff3a0', '#ff9fd0', '#a6e8ff'],
    boxes: [[2.4, 0, -2.8, 0.3, 1.0], [3.3, 0, -2.4, -0.2, 0.9], [2.8, 0.82, -2.7, 0.4, 0.75], [-2.8, 0, 1.2, 0.1, 1.0], [-2.0, 0, 1.9, 0.6, 0.85]],
    tasks: [
      { id: 'clutter', name: 'Unpack the boxes', cost: 1, kind: 'clutter', icon: '📦' },
      { id: 'walls', name: 'Mint wallpaper', cost: 2, kind: 'walls', icon: '🎀' },
      { id: 'counter', name: 'Cashier counter', cost: 3, item: 'h09', at: [-2.9, 0, -2.6], rot: 0.15, size: 2.6 },
      { id: 'window', name: 'Open the curtains', cost: 1, kind: 'window', icon: '☁️' },
      { id: 'floor', name: 'Candy tile floor', cost: 2, kind: 'floor', icon: '🍬' },
      { id: 'table', name: 'Café table', cost: 2, item: 'h10', at: [1.2, 0, 0.6], rot: -0.2, size: 2.8 },
      { id: 'case', name: 'Cake display', cost: 2, item: 'h11', at: [2.0, 0, -3.1], rot: 0, size: 1.5 },
      { id: 'lights', name: 'Fairy lights', cost: 2, kind: 'lights', icon: '✨' },
      { id: 'cattree', name: 'Cat tree', cost: 2, item: 'h12', at: [4.1, 0, -2.6], rot: -0.4, size: 2.8 },
      { id: 'cake', name: 'Tiered cake', cost: 1, item: 'g12', at: [1.2, 1.0, 0.6], rot: 0.3, size: 0.75 },
      { id: 'plush', name: 'Plush pile', cost: 2, item: 'g18', at: [-3.7, 0, 1.7], rot: 0.6, size: 1.7 },
      { id: 'rainbow', name: 'Rainbow sign', cost: 1, item: 'x05', at: [2.4, 3.4, -3.86], rot: 0, size: 1.6 },
      { id: 'plant', name: 'Smiley succulent', cost: 1, item: 'h07', at: [-0.7, 0, -3.3], rot: 0, size: 0.9 },
      { id: 'bunny', name: 'Bunny greeter', cost: 2, item: 'g17', at: [3.4, 0, 1.9], rot: -0.5, size: 1.1 },
      { id: 'shortcake', name: 'Strawberry shortcake', cost: 1, item: 'g11', at: [-2.4, 1.75, -2.5], rot: 0.2, size: 0.55 },
    ] },
];

// ---------------------------------------------------------------- canvas textures
function canvas(w, h, fn) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}
const rnd = (a, b) => a + Math.random() * (b - a);
function dust(x, w, h, n = 50, a = 0.16) {
  for (let i = 0; i < n; i++) { const r = rnd(10, 70), px = rnd(0, w), py = rnd(0, h), g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, `rgba(90,80,100,${rnd(0.04, a)})`); g.addColorStop(1, 'rgba(90,80,100,0)'); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); }
}
const heart = (x, cx, cy, r) => { x.beginPath(); x.moveTo(cx, cy + r); x.bezierCurveTo(cx - r * 1.5, cy, cx - r * 0.6, cy - r, cx, cy - r * 0.35); x.bezierCurveTo(cx + r * 0.6, cy - r, cx + r * 1.5, cy, cx, cy + r); x.fill(); };
const plainWall = () => canvas(512, 512, (x, w, h) => { x.fillStyle = '#e2d8ea'; x.fillRect(0, 0, w, h); dust(x, w, h, 50, 0.12); });
const dotPaper = p => canvas(512, 512, (x, w, h) => {
  x.fillStyle = p.a; x.fillRect(0, 0, w, h);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const px = c * 64 + (r % 2 ? 32 : 0) + 16, py = r * 64 + 32; x.fillStyle = (r + c) % 3 ? p.dot : p.b; if ((r + c) % 3) { x.beginPath(); x.arc(px, py, 9, 0, 7); x.fill(); } else heart(x, px, py, 10); }
});
const stripePaper = p => canvas(512, 512, (x, w, h) => {
  x.fillStyle = p.a; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? 'rgba(255,255,255,.55)' : p.b; x.globalAlpha = i % 2 ? 1 : 0.45; x.fillRect(i * 64, 0, 32, h); }
  x.globalAlpha = 1; x.fillStyle = '#ffffff'; for (let i = 0; i < 24; i++) heart(x, (i % 8) * 64 + 48, Math.floor(i / 8) * 170 + 80, 7);
});
const planks = () => canvas(512, 512, (x, w, h) => {
  const pw = 256, ph = 48;
  for (let y = 0; y < h; y += ph) for (let px = ((y / ph) % 2) * -128; px < w; px += pw) { x.fillStyle = Math.random() < 0.5 ? '#d8c8bc' : '#e2d4c8'; x.fillRect(px, y, pw, ph); x.strokeStyle = 'rgba(60,50,45,.4)'; x.lineWidth = 2; x.strokeRect(px, y, pw, ph); }
  dust(x, w, h, 50, 0.16);
});
const checker = f => canvas(512, 512, (x, w, h) => {
  const s = 128; for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { x.fillStyle = (r + c) % 2 ? f.a : f.b; x.fillRect(c * s, r * s, s, s); }
  x.fillStyle = 'rgba(255,255,255,.5)'; for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if ((r + c) % 2) heart(x, c * s + s / 2, r * s + s / 2, 12);
});
const skyTex = () => canvas(256, 256, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#9fd8ff'); g.addColorStop(0.7, '#e4f4ff'); g.addColorStop(1, '#ffe2f1'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.fillStyle = 'rgba(255,255,255,.95)'; for (let i = 0; i < 6; i++) { const cx = rnd(10, 240), cy = rnd(40, 200); for (let k = 0; k < 4; k++) { x.beginPath(); x.arc(cx + k * 14 - 20, cy + Math.sin(k * 2) * 5, rnd(12, 20), 0, 7); x.fill(); } }
});

// ---------------------------------------------------------------- builder
const MS = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0, ...o });
const MP = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1, ...o });
export async function buildRoom(def) {
  const g = new THREE.Group(); g.name = def.id;
  const { W, D, H } = def, hw = W / 2, hd = D / 2;
  const R = { group: g, def, items: {}, apply: {} };
  const slab = new THREE.Mesh(new RoundedBoxGeometry(W + 0.7, 0.7, D + 0.7, 4, 0.25), MP('#ffb3d6', { emissive: '#ff8fc6', emissiveIntensity: 0.08 })); slab.position.set(-0.15, -0.36, -0.15); slab.receiveShadow = true; g.add(slab);
  const fS = planks(), fN = checker(def.floor); fS.repeat.set(W / 4, D / 4); fN.repeat.set(W / 4, D / 4);
  const floorMat = MS('#ffffff', { map: fS, roughness: 0.85 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat); floor.rotation.x = -PI / 2; floor.position.y = 0.005; floor.receiveShadow = true; g.add(floor);
  R.apply.floor = nice => { floorMat.map = nice ? fN : fS; floorMat.roughness = nice ? 0.3 : 0.85; floorMat.needsUpdate = true; };
  // walls
  const backS = plainWall(), leftS = plainWall(), backN = dotPaper(def.paper), leftN = stripePaper(def.paper);
  for (const t of [backS, backN]) t.repeat.set(W / 3.4, H / 3.4);
  for (const t of [leftS, leftN]) t.repeat.set(D / 3.4, H / 3.4);
  const backMat = MS('#ffffff', { map: backS, roughness: 0.85 }), leftMat = MS('#ffffff', { map: leftS, roughness: 0.85 }), capMat = MS('#fff3fa', { roughness: 0.5 });
  const mkWall = (w, d, x, z, inner, mat) => { const mats = Array(6).fill(capMat); mats[inner] = mat; const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), mats); m.position.set(x, H / 2, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  mkWall(W + 0.6, 0.3, -0.15, -hd - 0.15, 4, backMat);
  mkWall(0.3, D, -hw - 0.15, 0, 0, leftMat);
  const trims = new THREE.Group(), trimM = MP('#ffffff', { roughness: 0.35 });
  const sk1 = new THREE.Mesh(new RoundedBoxGeometry(W, 0.3, 0.14, 2, 0.05), trimM); sk1.position.set(0, 0.15, -hd + 0.07); trims.add(sk1);
  const sk2 = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.3, D, 2, 0.05), trimM); sk2.position.set(-hw + 0.07, 0.15, 0); trims.add(sk2);
  const rail1 = sk1.clone(); rail1.scale.y = 0.4; rail1.position.y = 1.7; trims.add(rail1);
  const rail2 = sk2.clone(); rail2.scale.y = 0.4; rail2.position.y = 1.7; trims.add(rail2);
  trims.visible = false; g.add(trims);
  R.apply.walls = nice => { backMat.map = nice ? backN : backS; leftMat.map = nice ? leftN : leftS; backMat.needsUpdate = leftMat.needsUpdate = true; trims.visible = nice; };
  // window: rounded pastel frame, cloudy sky, curtains (drawn = dim room, open = sunny)
  const { x: wx, y: wy, w: ww, h: wh } = def.win, win = new THREE.Group(); win.position.set(wx, wy, -hd + 0.02);
  const skyM = new THREE.MeshBasicMaterial({ map: skyTex(), toneMapped: false, color: '#9a97a8' });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), skyM); sky.position.z = 0.01; win.add(sky);
  const frameM = MP('#ffffff', { roughness: 0.25 });
  const bar = (w, h, x, y, d = 0.16) => { const b = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h) * 0.45), frameM); b.position.set(x, y, 0.07); b.castShadow = true; win.add(b); };
  bar(ww + 0.3, 0.2, 0, wh / 2); bar(ww + 0.3, 0.2, 0, -wh / 2); bar(0.2, wh + 0.2, -ww / 2, 0); bar(0.2, wh + 0.2, ww / 2, 0); bar(0.08, wh, 0, 0, 0.1); bar(ww, 0.08, 0, 0, 0.1);
  const sill = new THREE.Mesh(new RoundedBoxGeometry(ww + 0.7, 0.14, 0.5, 2, 0.06), MP('#ffd0e6')); sill.position.set(0, -wh / 2 - 0.14, 0.24); sill.castShadow = true; win.add(sill);
  const curtM = MP('#ff9cc9', { roughness: 0.6, clearcoat: 0.2, sheen: 1, sheenColor: new THREE.Color('#ffffff') });
  const curtG = new THREE.CylinderGeometry(0.5, 0.62, 1, 18, 1, true); { const p = curtG.attributes.position; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); const k = 1 + Math.sin(a * 7) * 0.12; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k * 0.35); } curtG.computeVertexNormals(); }
  const curts = [], shut = [];
  for (const s of [-1, 1]) { const c = new THREE.Mesh(curtG, curtM); c.scale.set(1, wh + 0.6, 1); c.position.set(s * (ww / 2 - 0.1), 0.05, 0.3); c.castShadow = true; win.add(c); curts.push(c); }
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, ww + 1.4, 10), MP('#fff1a8', { metalness: 0.3 })); rod.rotation.z = PI / 2; rod.position.set(0, wh / 2 + 0.4, 0.32); win.add(rod);
  g.add(win);
  R.apply.window = nice => { skyM.color.set(nice ? '#ffffff' : '#9a97a8'); curts.forEach((c, i) => { c.scale.x = nice ? 0.75 : 1.55; c.position.x = (i ? 1 : -1) * (nice ? ww / 2 + 0.25 : ww / 4); }); };
  // fairy lights: hearts strung along the back and left walls
  const hg = new THREE.ExtrudeGeometry((() => { const s = new THREE.Shape(), k = 0.11; s.moveTo(0, -0.9 * k); s.bezierCurveTo(-0.2 * k, -0.6 * k, -k, -0.2 * k, -k, 0.3 * k); s.bezierCurveTo(-k, 0.9 * k, -0.25 * k, k, 0, 0.55 * k); s.bezierCurveTo(0.25 * k, k, k, 0.9 * k, k, 0.3 * k); s.bezierCurveTo(k, -0.2 * k, 0.2 * k, -0.6 * k, 0, -0.9 * k); return s; })(), { depth: 0.05, bevelEnabled: false });
  const bulbs = new THREE.InstancedMesh(hg, new THREE.MeshBasicMaterial({ toneMapped: false }), 60);
  const wire = new THREE.Group(), wireM = new THREE.MeshBasicMaterial({ color: '#ffffff' }); const m4 = new THREE.Matrix4(); let bi = 0; const lc = def.lights.map(c => new THREE.Color(c).multiplyScalar(1.6));
  for (const [x0, z0, x1, z1] of [[-hw + 0.2, -hd + 0.2, hw - 0.4, -hd + 0.2], [-hw + 0.2, -hd + 0.2, -hw + 0.2, hd - 0.5]]) {
    const pts = []; for (let i = 0; i <= 30; i++) { const t = i / 30; pts.push(new THREE.Vector3(x0 + (x1 - x0) * t, H - 0.2 - Math.abs(Math.sin(t * PI * 2)) * 0.6, z0 + (z1 - z0) * t)); }
    const curve = new THREE.CatmullRomCurve3(pts); wire.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 50, 0.014, 4), wireM));
    for (let i = 1; i < 30 && bi < 60; i++) { const p = curve.getPoint(i / 30); m4.makeTranslation(p.x, p.y - 0.1, p.z + 0.02); if (x0 === x1) m4.multiply(new THREE.Matrix4().makeRotationY(PI / 2)); bulbs.setMatrixAt(bi, m4); bulbs.setColorAt(bi, lc[bi % lc.length]); bi++; }
  }
  bulbs.count = bi; const lightsG = new THREE.Group(); lightsG.add(wire, bulbs); lightsG.visible = false; g.add(lightsG);
  R.apply.lights = nice => { lightsG.visible = nice; };
  R.bulbs = bulbs;
  // clutter: moving boxes with tape
  const clutter = new THREE.Group(); g.add(clutter);
  const boxG = new RoundedBoxGeometry(1, 0.8, 0.9, 2, 0.06), boxM = MS('#d9b58c', { roughness: 0.8 }), tapeM = MS('#f7e7c4', { roughness: 0.5 }), tapeG = new THREE.BoxGeometry(0.22, 0.02, 0.92);
  for (const [x, y, z, r, s] of def.boxes) { const b = new THREE.Group(); const m = new THREE.Mesh(boxG, boxM); m.position.y = 0.4; m.castShadow = m.receiveShadow = true; const t = new THREE.Mesh(tapeG, tapeM); t.position.y = 0.805; b.add(m, t); b.position.set(x, y, z); b.rotation.y = r; b.scale.setScalar(s); clutter.add(b); }
  R.clutter = clutter; R.apply.clutter = nice => { clutter.visible = !nice; };
  // furniture (hidden until placed)
  for (const t of def.tasks) {
    if (!t.item) continue;
    const m = await prop(t.item, t.size); m.position.set(...t.at); m.rotation.y = t.rot || 0;
    if (t.sy) m.scale.y *= t.sy;
    m.visible = false; m.userData.base = m.scale.clone(); g.add(m); R.items[t.id] = m;
  }
  return R;
}
