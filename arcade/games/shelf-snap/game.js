// Shelf Snap — original game. Unpack the shopping baskets and snap every grocery into its outlined spot on the fridge
// shelves. Inspired by the mechanic of Fill The Fridge! (Rollic). All code and art original (three.js primitives).
import { THREE, createStage, createUI, input, loop, burst, confetti, sfx, tone, buzz, mat, glossy, rounded, store, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';

const ST = store('shelfsnap');
let level = ST.get('level', 1), best = ST.get('best', 0), score = 0;
const F = flow('shelfsnap'); let fk = 1, HMAX = 3;
const { scene, camera, renderer, sun, hemi } = createStage({ fov: 45, shadowSize: 9 });
sun.position.set(4, 14, 12); sun.intensity = 1.5; hemi.intensity = 1.25;
const ui = createUI({ title: 'SHELF<br>SNAP', hint: 'Drag groceries into the fridge', hand: '👆', score: false });

// ------------------------------------------------------------------ helpers
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lathe = (pts, seg = 22) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
const MATS = {}; const M = (c, o) => MATS[c + JSON.stringify(o || {})] || (MATS[c + JSON.stringify(o || {})] = mat(c, o));
const G = (c, o) => MATS['g' + c + JSON.stringify(o || {})] || (MATS['g' + c + JSON.stringify(o || {})] = glossy(c, o));
function canvasTex(w, h, draw, rx = 1, ry = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4; return t;
}
const easeOutBack = t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

// ------------------------------------------------------------------ fridge dimensions
const FX = 2.75, FY0 = -2.0, FY1 = 8.7, FZ0 = -1.15, FZ1 = 0.8;      // outer box
const IX = 2.5, IY0 = 0.55, IY1 = 8.45, ROWS = 4, RH = (IY1 - IY0) / ROWS, SLOTZ = -0.15;
const rowFloor = r => IY0 + r * RH + (r ? 0.05 : 0);

// ------------------------------------------------------------------ grocery models (origin = bottom centre)
const CAN_G = new THREE.CylinderGeometry(0.28, 0.28, 0.78, 24).translate(0, 0.41, 0);
const CANRIM_G = new THREE.CylinderGeometry(0.255, 0.27, 0.86, 24, 1, true).translate(0, 0.43, 0);
const CANTOP_G = new THREE.CylinderGeometry(0.25, 0.27, 0.04, 24).translate(0, 0.82, 0);
const BOT_G = lathe([[0, 0], [0.27, 0], [0.3, 0.05], [0.3, 0.78], [0.26, 0.98], [0.12, 1.17], [0.11, 1.32], [0, 1.32]]);
const BOTCAP_G = new THREE.CylinderGeometry(0.125, 0.125, 0.13, 16).translate(0, 1.37, 0);
const BOTLAB_G = new THREE.CylinderGeometry(0.308, 0.308, 0.36, 22, 1, true).translate(0, 0.45, 0);
const CART_G = rounded(0.66, 0.86, 0.66, 0.05).translate(0, 0.43, 0);
const roofShape = new THREE.Shape(); roofShape.moveTo(-0.33, 0); roofShape.lineTo(0.33, 0); roofShape.lineTo(0, 0.26); roofShape.lineTo(-0.33, 0);
const ROOF_G = new THREE.ExtrudeGeometry(roofShape, { depth: 0.64, bevelEnabled: false }).rotateY(Math.PI / 2).translate(-0.32, 0.86, 0);
const CARTBAND_G = new THREE.BoxGeometry(0.672, 0.32, 0.672).translate(0, 0.42, 0);
const APPLE_G = (() => { const p = []; for (let i = 0; i <= 20; i++) { const a = i / 20 * Math.PI, r = Math.sin(a) * 0.31 * (1 + 0.08 * Math.cos(a)); let y = 0.3 - Math.cos(a) * 0.29; if (i > 16) y -= (i - 16) * 0.02; if (i < 3) y += (3 - i) * 0.012; p.push([Math.max(0.001, r), y]); } return lathe(p, 22); })();
const STEM_G = new THREE.CylinderGeometry(0.022, 0.03, 0.16, 6).translate(0, 0.62, 0);
const LEAF_G = new THREE.SphereGeometry(0.09, 10, 6).scale(1, 0.25, 0.5).translate(0.08, 0.66, 0);
const ORANGE_G = new THREE.SphereGeometry(0.3, 22, 16).scale(1, 0.94, 1).translate(0, 0.29, 0);
const YOG_G = lathe([[0, 0], [0.2, 0], [0.27, 0.46], [0.29, 0.48], [0, 0.48]], 22);
const YOGLID_G = new THREE.CylinderGeometry(0.3, 0.3, 0.03, 22).translate(0, 0.495, 0);
const wedge = new THREE.Shape(); wedge.moveTo(-0.45, 0); wedge.lineTo(0.45, 0); wedge.lineTo(0.45, 0.42); wedge.lineTo(-0.45, 0);
const CHEESE_G = new THREE.ExtrudeGeometry(wedge, { depth: 0.55, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 }).translate(0, 0.03, -0.275);
const HOLE_G = new THREE.CircleGeometry(0.055, 12);
const JAR_G = new THREE.CylinderGeometry(0.29, 0.29, 0.6, 22).translate(0, 0.3, 0);
const JARLID_G = new THREE.CylinderGeometry(0.31, 0.31, 0.14, 22).translate(0, 0.66, 0);
const TRAY_G = rounded(1.0, 0.16, 0.66, 0.04).translate(0, 0.08, 0);
const EGG_G = new THREE.SphereGeometry(0.13, 14, 10).scale(1, 1.3, 1);
const MELON_G = (() => { const s = new THREE.Shape(); s.absarc(0, 0, 0.48, 0, Math.PI, false); s.lineTo(0.48, 0); return new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 }).translate(0, 0.02, -0.15); })();
const MELONIN_G = (() => { const s = new THREE.Shape(); s.absarc(0, 0, 0.41, 0, Math.PI, false); s.lineTo(0.41, 0); return new THREE.ShapeGeometry(s).translate(0, 0.06, 0.175); })();
const SEED_G = new THREE.SphereGeometry(0.025, 6, 4).scale(1, 1.6, 0.5);

const shadowed = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
// each type: w = slot width, h = height, lie = lies on its side in the basket, snd = sound family, cols = colour variants
const TYPES = {
  can: { w: 0.62, h: 0.86, lie: true, snd: 'metal', ghost: CAN_G, cols: ['#ff4757', '#2f80ff', '#1fbf75', '#ff9f1a', '#a55eea'],
    build(c) { const g = new THREE.Group(); g.add(shadowed(new THREE.Mesh(CAN_G, G(c))), new THREE.Mesh(CANTOP_G, G('#d9dee6', { metalness: 0.6, roughness: 0.25 })), new THREE.Mesh(CANRIM_G, G('#ffffff', { metalness: 0.3 }))); g.children[2].scale.set(1.01, 0.28, 1.01); g.children[2].position.y = 0.3; return g; } },
  bottle: { w: 0.66, h: 1.44, lie: true, snd: 'glass', ghost: BOT_G, cols: ['#63d39b', '#57b8ff', '#ffb547', '#ff7aa8'],
    build(c) { const g = new THREE.Group(); g.add(shadowed(new THREE.Mesh(BOT_G, G(c, { transparent: true, opacity: 0.82, roughness: 0.12 }))), new THREE.Mesh(BOTCAP_G, G('#ffffff')), new THREE.Mesh(BOTLAB_G, M('#fff6e0'))); return g; } },
  carton: { w: 0.74, h: 1.12, lie: true, snd: 'soft', ghost: CART_G, cols: ['#3a86ff', '#ff8c42', '#ff5d8f', '#52b788'],
    build(c) { const g = new THREE.Group(); g.add(shadowed(new THREE.Mesh(CART_G, M('#fbfbff'))), shadowed(new THREE.Mesh(ROOF_G, M(c))), new THREE.Mesh(CARTBAND_G, M(c))); return g; } },
  apple: { w: 0.64, h: 0.66, lie: false, snd: 'fruit', ghost: APPLE_G, cols: ['#ff3b3b', '#7ed957', '#ff5a4e'],
    build(c) { const g = new THREE.Group(); g.add(shadowed(new THREE.Mesh(APPLE_G, G(c, { roughness: 0.3 }))), new THREE.Mesh(STEM_G, M('#7a4a26')), new THREE.Mesh(LEAF_G, M('#3fae3a'))); return g; } },
  orange: { w: 0.64, h: 0.6, lie: false, snd: 'fruit', ghost: ORANGE_G, cols: ['#ff9a1f', '#ffd23f'],
    build(c) { const g = new THREE.Group(); g.add(shadowed(new THREE.Mesh(ORANGE_G, M(c, { roughness: 0.75 }))), new THREE.Mesh(LEAF_G, M('#3fae3a'))); g.children[1].position.y = -0.06; return g; } },
  yogurt: { w: 0.62, h: 0.5, lie: false, snd: 'soft', ghost: YOG_G, cols: ['#ff9ec4', '#b39dff', '#8fe3ff', '#ffe08a'],
    build(c) { const g = new THREE.Group(); g.add(shadowed(new THREE.Mesh(YOG_G, M(c))), new THREE.Mesh(YOGLID_G, G('#e6ebf2', { metalness: 0.5 }))); return g; } },
  cheese: { w: 0.96, h: 0.46, lie: false, snd: 'soft', ghost: CHEESE_G, cols: ['#ffd23f', '#ffb703'],
    build(c) { const g = new THREE.Group(); g.add(shadowed(new THREE.Mesh(CHEESE_G, M(c, { roughness: 0.6 })))); for (const [x, y] of [[0.15, 0.12], [0.3, 0.26], [0.32, 0.1]]) { const h = new THREE.Mesh(HOLE_G, M('#e0a400')); h.position.set(x, y, 0.31); g.add(h); } return g; } },
  jar: { w: 0.68, h: 0.74, lie: false, snd: 'glass', ghost: JAR_G, cols: ['#ff4d6d', '#7b5cff', '#ff8c42'],
    build(c) { const g = new THREE.Group(); g.add(shadowed(new THREE.Mesh(JAR_G, G(c, { transparent: true, opacity: 0.88, roughness: 0.15 }))), new THREE.Mesh(JARLID_G, G('#ffffff'))); g.children[1].material = G(c === '#7b5cff' ? '#ffd23f' : '#ffffff'); return g; } },
  eggs: { w: 1.06, h: 0.4, lie: false, snd: 'soft', ghost: TRAY_G, cols: ['#fff3e0', '#f2c79b'],
    build(c) { const g = new THREE.Group(); g.add(shadowed(new THREE.Mesh(TRAY_G, M('#c8a27a', { roughness: 0.9 }))));
      const im = new THREE.InstancedMesh(EGG_G, M(c, { roughness: 0.55 }), 6), o = new THREE.Object3D(); for (let i = 0; i < 6; i++) { o.position.set(-0.3 + (i % 3) * 0.3, 0.26, -0.14 + Math.floor(i / 3) * 0.28); o.updateMatrix(); im.setMatrixAt(i, o.matrix); } im.castShadow = true; g.add(im); return g; } },
  melon: { w: 1.02, h: 0.52, lie: false, snd: 'fruit', ghost: MELON_G, cols: ['#ff5d6c'],
    build(c) { const g = new THREE.Group(); g.add(shadowed(new THREE.Mesh(MELON_G, M('#3aa655')))); const f = new THREE.Mesh(MELONIN_G, M(c)); f.scale.y = 1; g.add(f);
      const im = new THREE.InstancedMesh(SEED_G, M('#2b2d42'), 7), o = new THREE.Object3D(); for (let i = 0; i < 7; i++) { const a = 0.4 + i * 0.36; o.position.set(Math.cos(a) * 0.24, 0.06 + Math.sin(a) * 0.24, 0.18); o.rotation.z = a - Math.PI / 2; o.updateMatrix(); im.setMatrixAt(i, o.matrix); } g.add(im); return g; } },
};
const UNLOCK = [['can', 'carton', 'apple', 'yogurt'], ['bottle', 'orange'], ['cheese', 'jar'], ['eggs'], ['melon']];

// ------------------------------------------------------------------ kitchen set
const room = new THREE.Group(); scene.add(room);
let wallMat;
function kitchen() {
  wallMat = new THREE.MeshStandardMaterial({ roughness: 0.6 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(26, 22), wallMat); wall.position.set(0, 7, -1.6); wall.receiveShadow = true; room.add(wall);
  const floorTex = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#e9c49a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#d4a877'; x.lineWidth = 4;
    for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(0, i * 64); x.lineTo(w, i * 64); x.stroke(); x.beginPath(); const o = (i * 97) % 256; x.moveTo(o, i * 64); x.lineTo(o, i * 64 + 64); x.stroke(); }
    x.globalAlpha = 0.08; for (let i = 0; i < 60; i++) { x.fillStyle = i % 2 ? '#a0703c' : '#fff'; x.fillRect(Math.random() * w, Math.random() * h, 40 + Math.random() * 60, 2); } }, 3, 3);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(26, 14), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.7 })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, FY0, 5); floor.receiveShadow = true; room.add(floor);
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(26, 0.35, 0.12), M('#ffffff')); skirt.position.set(0, FY0 + 0.17, -1.5); room.add(skirt);
  // little window + plant on the wall for coziness
  const win = new THREE.Mesh(rounded(2.2, 2.6, 0.15, 0.12), M('#ffffff')); win.position.set(-4.6, 6.6, -1.5);
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.2), new THREE.MeshBasicMaterial({ color: '#bfe8ff' })); pane.position.set(-4.6, 6.6, -1.41);
  const plantPot = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.32, 0.6, 16), M('#ff9f80')); plantPot.position.set(1.6, FY1 + 0.3, -0.3); plantPot.castShadow = true;
  const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 1), M('#5cc46a', { flatShading: true })); leaves.position.set(1.6, FY1 + 0.95, -0.3); leaves.scale.set(1, 0.85, 1); leaves.castShadow = true;
  const box = new THREE.Mesh(rounded(1.3, 0.75, 0.9, 0.08), M('#ffd6a5')); box.position.set(-1.4, FY1 + 0.38, -0.4); box.castShadow = true;
  room.add(win, pane, plantPot, leaves, box);
}
kitchen();
function setWall(p) {
  const a = p.bg[0], b = p.bg[1];
  wallMat.map = canvasTex(256, 256, (x, w, h) => { x.fillStyle = b; x.fillRect(0, 0, w, h); x.fillStyle = a;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { if ((i + j) % 2) x.fillRect(i * 64, j * 64, 64, 64); }
    x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 4; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, h); x.stroke(); x.beginPath(); x.moveTo(0, i * 64); x.lineTo(w, i * 64); x.stroke(); } }, 6, 5);
  wallMat.needsUpdate = true;
}

// ------------------------------------------------------------------ fridge
const fridge = new THREE.Group(); scene.add(fridge);
const BODYCOLS = ['#6cc3ff', '#ff8fab', '#62d2a2', '#ffb454', '#a78bfa', '#4fd1c5'];
let bodyMat = mat('#6cc3ff'), trimMat = mat('#ff9f43'), shelves = [], door, doorAng = 0, doorTarget = 0;
const linerMat = mat('#e3f1fb', { roughness: 0.8, emissive: '#eaf6ff', emissiveIntensity: 0.22 }), glassMat = new THREE.MeshStandardMaterial({ color: '#d7f1ff', transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.1, emissive: '#ffffff', emissiveIntensity: 0 });
function buildFridge() {
  const T = FX - IX, add = (geo, m, x, y, z, cast = false) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.receiveShadow = true; o.castShadow = cast; fridge.add(o); return o; };
  const zc = (FZ0 + FZ1) / 2, D = FZ1 - FZ0;
  add(rounded(T, FY1 - FY0, D, 0.08), bodyMat, -FX + T / 2, (FY0 + FY1) / 2, zc, true);
  add(rounded(T, FY1 - FY0, D, 0.08), bodyMat, FX - T / 2, (FY0 + FY1) / 2, zc, true);
  add(rounded(FX * 2, FY1 - IY1, D, 0.08), bodyMat, 0, (IY1 + FY1) / 2, zc, true);
  add(new THREE.BoxGeometry(IX * 2, IY1 - IY0, 0.1), linerMat, 0, (IY0 + IY1) / 2, FZ0 + 0.05).receiveShadow = false;
  add(new THREE.BoxGeometry(0.06, IY1 - IY0, D * 0.98), linerMat, -IX + 0.03, (IY0 + IY1) / 2, zc).receiveShadow = false;
  add(new THREE.BoxGeometry(0.06, IY1 - IY0, D * 0.98), linerMat, IX - 0.03, (IY0 + IY1) / 2, zc).receiveShadow = false;
  // bottom: crisper drawer block
  add(rounded(FX * 2, IY0 - FY0, D, 0.08), bodyMat, 0, (FY0 + IY0) / 2, zc, true);
  add(rounded(FX * 2 - 0.5, IY0 - FY0 - 0.45, 0.12, 0.06), mat('#ffffff', { roughness: 0.4 }), 0, (FY0 + IY0) / 2 + 0.05, FZ1 + 0.04);
  add(rounded(1.6, 0.18, 0.16, 0.07), mat('#c9d3e0', { roughness: 0.3, metalness: 0.4 }), 0, IY0 - 0.55, FZ1 + 0.15);
  // shelves: glass + coloured front trim
  shelves = [];
  for (let r = 0; r < ROWS; r++) {
    const y = IY0 + r * RH;
    const gm = glassMat.clone(); const tm = trimMat;
    const g = add(new THREE.BoxGeometry(IX * 2 - 0.04, 0.06, D - 0.1), r ? gm : linerMat, 0, y + 0.02, zc - 0.04);
    const t = add(rounded(IX * 2 - 0.04, 0.14, 0.1, 0.04), tm, 0, y + 0.02, FZ1 - 0.06);
    shelves.push({ g, gm, glow: 0 });
  }
  // light bar
  add(new THREE.BoxGeometry(1.6, 0.08, 0.3), new THREE.MeshBasicMaterial({ color: '#fffbe6' }), 0, IY1 - 0.06, -0.2);
  // door (pivots on the left hinge)
  door = new THREE.Group(); door.position.set(-FX, 0, FZ1); fridge.add(door);
  const DH = FY1 - IY0 + 0.25;
  const panel = new THREE.Mesh(rounded(FX * 2, DH, 0.3, 0.12), bodyMat); panel.position.set(FX, (IY0 - 0.25 + FY1) / 2, 0.15); panel.castShadow = true; door.add(panel);
  const inner = new THREE.Mesh(rounded(FX * 2 - 0.5, DH - 0.5, 0.1, 0.08), linerMat); inner.position.set(FX, panel.position.y, -0.04); door.add(inner);
  const handle = new THREE.Mesh(rounded(0.2, 2.6, 0.22, 0.09), mat('#e8eef6', { roughness: 0.25, metalness: 0.4 })); handle.position.set(FX * 2 - 0.42, IY0 + RH * 2.4, 0.42); door.add(handle);
  const badge = new THREE.Mesh(new THREE.CircleGeometry(0.28, 20), mat('#ffffff')); badge.position.set(FX, FY1 - 0.9, 0.31); door.add(badge);
  const snow = new THREE.Mesh(new THREE.CircleGeometry(0.18, 6), mat('#9fd8ff')); snow.position.set(FX, FY1 - 0.9, 0.32); door.add(snow);
  for (let i = 0; i < 2; i++) { const pock = new THREE.Mesh(rounded(FX * 2 - 0.8, 0.5, 0.35, 0.06), trimMat); pock.position.set(FX, IY0 + 1.2 + i * 3.2, -0.25); door.add(pock); }
}
buildFridge();
const ilight = new THREE.PointLight('#fff6e0', 3, 10, 1.6); ilight.position.set(0, 6.5, 1.2); scene.add(ilight);

// ------------------------------------------------------------------ baskets
const BASKX = [-1.88, 0, 1.88], BASKZ = 3.8, BW = 1.76, BD = 1.3, BH = 0.5;
const S = 1.25, BS = 0.8;   // grocery scale, extra scale while sitting in a basket
const weave = canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { x.fillStyle = (i + j) % 2 ? '#d9d9d9' : '#f4f4f4'; x.fillRect(i * 32 + 2, j * 32 + 2, 28, 28); x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(i * 32 + 2, j * 32 + 26, 28, 4); } }, 6, 2);
const BASK_G = (() => { const s = Math.SQRT2; const g = lathe([[0.001, 0], [0.82 * s, 0], [1.0 * s, BH], [1.06 * s, BH + 0.02], [1.06 * s, BH + 0.1], [0.98 * s, BH + 0.08], [0.8 * s, 0.1], [0.001, 0.1]].map(([r, y]) => [r, y]), 4); g.rotateY(Math.PI / 4); g.computeVertexNormals(); return g; })();
const baskets = [];
const BASKCOLS = [['#ff7aa2', '#7cc6ff', '#ffd166'], ['#62d2a2', '#ff9f80', '#b39dff'], ['#7cc6ff', '#ffd166', '#ff7aa2']];
for (let i = 0; i < 3; i++) {
  const m = new THREE.Mesh(BASK_G, new THREE.MeshStandardMaterial({ color: '#ff7aa2', map: weave, roughness: 0.75, flatShading: true }));
  m.scale.set(BW / 2, 1, BD / 2); m.position.set(BASKX[i], FY0, BASKZ); m.castShadow = true; m.receiveShadow = true; scene.add(m); baskets.push(m);
}

// ------------------------------------------------------------------ level state
let state = 'ready', items = [], slots = [], drag = null, hearts = 3, placedN = 0, combo = 0, lastPlace = 0, hover = null, botBusy = false, rowsInfo = [], winT = 0;
const ghostMat = new THREE.MeshBasicMaterial({ color: '#6f8fb3', transparent: true, opacity: 0.3, depthWrite: false });
const hiMat = new THREE.MeshBasicMaterial({ color: '#4ade80', transparent: true, opacity: 0.6, depthWrite: false });
const badMat = new THREE.MeshBasicMaterial({ color: '#ff4d6d', transparent: true, opacity: 0.5, depthWrite: false });
const levelGroup = new THREE.Group(); scene.add(levelGroup);

function makeItem(type, color) {
  const T = TYPES[type], g = T.build(color); g.userData.item = true;
  const it = { type, color, g, placed: false, slot: null, home: null, anim: null, sq: 0, sqv: 0, lift: 0 };
  g.traverse(o => { o.userData.it = it; });
  levelGroup.add(g); return it;
}
function buildLevel() {
  fk = F.k(); HMAX = Math.max(2, Math.round(3 / fk));
  levelGroup.clear(); items = []; slots = []; drag = null; hover = null; botBusy = false; placedN = 0; combo = 0; hearts = HMAX; winT = 0;
  const r = rng(level * 7919 + 13), p = { bg: [['#ffe1ea', '#fff3f7'], ['#dff3ff', '#f2faff'], ['#e3f8e9', '#f5fff8'], ['#fff1d6', '#fffaf0'], ['#ece4ff', '#f8f4ff'], ['#d9f7f3', '#f1fffd']][(level - 1) % 6], ui: ['#ff5d8f', '#2f80ff', '#22b573', '#ff8c42', '#7b5cff', '#14b8a6'][(level - 1) % 6] };
  document.body.style.setProperty('--bg1', p.bg[0]); document.body.style.setProperty('--bg2', p.bg[1]); document.body.style.setProperty('--ui', p.ui);
  setWall(p); bodyMat.color.set(BODYCOLS[(level - 1) % BODYCOLS.length]); trimMat.color.set(['#ff9f43', '#ffffff', '#ffd166', '#ff7aa2'][(level - 1) % 4]);
  BASKCOLS[(level - 1) % 3].forEach((c, i) => baskets[i].material.color.set(c));
  const unlocked = UNLOCK.slice(0, Math.min(UNLOCK.length, 1 + Math.floor((level - 1) / 2))).flat();
  const pool = [...unlocked]; for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const active = level === 1 ? 2 : level < 4 ? 3 : 4;
  const order = [0, 1, 2, 3]; for (let i = 3; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const activeRows = new Set(level === 1 ? [1, 2] : order.slice(0, active));
  const cap = level === 1 ? 4 : level === 2 ? 5 : 7;
  const decorTypes = ['can', 'yogurt', 'apple', 'carton'].filter(t => !pool.slice(0, 6).includes(t));
  rowsInfo = [];
  let pi = 0;
  for (let row = 0; row < ROWS; row++) {
    const isActive = activeRows.has(row), segs = [];
    if (isActive) {
      const split = level >= 4 && r() < Math.min(0.9, (0.35 + level * 0.03) * fk) && pool.length - pi >= 2;
      if (split) { const a = pool[pi++ % pool.length], b = pool[pi++ % pool.length]; segs.push([a, 2 + Math.floor(r() * 2)], [b, 2 + Math.floor(r() * 2)]); }
      else { const a = pool[pi++ % pool.length]; segs.push([a, 99]); }
    } else segs.push([['can', 'yogurt', 'orange', 'jar'][(row + level) % 4], 99]);
    // fit segments into the row width
    const W = IX * 2 - 0.3, gap = 0.08; let list = [];
    for (const [t, n] of segs) { const fit = Math.floor((W / segs.length + gap) / (TYPES[t].w * S + gap)); for (let k = 0; k < Math.min(n, fit, isActive ? cap : 99); k++) list.push(t); }
    const total = list.reduce((s, t) => s + TYPES[t].w * S, 0) + gap * (list.length - 1); let x = -total / 2;
    const colorFor = t => TYPES[t].cols[Math.floor(r() * TYPES[t].cols.length)];
    const segColor = {}; for (const t of new Set(list)) segColor[t] = colorFor(t);
    const rowSlots = [];
    for (const t of list) {
      const w = TYPES[t].w * S, s = { type: t, row, x: x + w / 2, y: rowFloor(row), z: SLOTZ, item: null, active: isActive, ghost: null, color: segColor[t] };
      x += w + gap;
      if (isActive) { const gh = new THREE.Mesh(TYPES[t].ghost, ghostMat); gh.position.set(s.x, s.y + 0.01, s.z); gh.scale.setScalar(S * 1.02); levelGroup.add(gh); s.ghost = gh; slots.push(s); }
      else { const it = makeItem(t, s.color); it.placed = true; it.slot = s; s.item = it; it.g.position.set(s.x, s.y, s.z); }
      rowSlots.push(s);
    }
    rowsInfo.push({ row, slots: rowSlots, active: isActive, done: !isActive });
  }
  // groceries for every active slot go into the baskets, shuffled
  const bag = slots.map(s => makeItem(s.type, s.color));
  for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
  const per = [[], [], []]; bag.forEach((it, i) => per[i % 3].push(it));
  per.forEach((list, b) => list.forEach((it, k) => {
    const T = TYPES[it.type], nb = list.length, cols = nb > 6 ? 4 : 3, col = k % cols, lay = Math.floor(k / cols), half = BW / 2 - 0.36;
    const x = BASKX[b] + (col - (cols - 1) / 2) * half * (cols > 3 ? 0.62 : 0.92) + (r() - 0.5) * 0.12, z = BASKZ + (lay % 2 ? 0.22 : -0.18) + (r() - 0.5) * 0.12;
    const y = FY0 + 0.22 + lay * 0.32 + (col > 0 && col < cols - 1 ? 0.12 : 0) + (T.lie ? 0.3 : 0.04);
    const rot = T.lie ? V((r() - 0.5) * 0.4, (r() - 0.5) * 1.2, Math.PI / 2 * (r() < 0.5 ? 1 : -1) + (r() - 0.5) * 0.3) : V((r() - 0.5) * 0.5, r() * 6.28, (r() - 0.5) * 0.5);
    if (T.lie) { /* lying items are centred on their length */ }
    it.home = { p: V(x, y, z), r: rot }; it.g.position.copy(it.home.p); it.g.rotation.set(rot.x, rot.y, rot.z);
    if (T.lie) it.g.position.x -= Math.sign(rot.z) * -T.h * 0.5 * 0 ;
    items.push(it);
  }));
  // lying items: shift so their middle sits at the home point
  for (const it of items) if (TYPES[it.type].lie) { const off = V(0, TYPES[it.type].h * S * BS / 2, 0).applyEuler(it.g.rotation); it.home.p.sub(off); it.home.p.y += 0.0; it.g.position.copy(it.home.p); }
  ui.levels(level); ui.progress(0); ui.pill('❤️'.repeat(hearts)); ui.sub('');
  doorAng = 0; doorTarget = 0;
}

// ------------------------------------------------------------------ picking + dragging
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), tmp = V(0, 0, 0), dragPlane = new THREE.Plane(V(0, 0, 1), -1.5);
function setRay(e) { ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); }
function screenOf(v) { tmp.copy(v).project(camera); return [(tmp.x + 1) / 2 * innerWidth, (1 - tmp.y) / 2 * innerHeight]; }
function pick(e) {
  setRay(e);
  const free = items.filter(it => !it.placed && !it.anim);
  const hits = ray.intersectObjects(free.map(it => it.g), true);
  if (hits.length) return hits[0].object.userData.it;
  let bestIt = null, bd = 58;
  for (const it of free) { const c = it.g.position.clone(); c.y += 0.25; const [sx, sy] = screenOf(c); const d = Math.hypot(sx - e.clientX, sy - e.clientY); if (d < bd) { bd = d; bestIt = it; } }
  return bestIt;
}
function aimPoint(e) { setRay(e); const p = V(0, 0, 0); ray.ray.intersectPlane(dragPlane, p); return p; }
// project a world point (in front of the fridge) back onto the slot plane along the camera ray
function onSlotPlane(p) { const d = p.clone().sub(camera.position); const t = (SLOTZ - camera.position.z) / d.z; return camera.position.clone().addScaledVector(d, t); }
function targetFor(it, pos) {
  const q = onSlotPlane(pos); if (Math.abs(q.x) > FX + 0.2 || q.y < IY0 - 0.6 || q.y > IY1 + 0.2) return null;
  const row = clamp(Math.floor((q.y - IY0 + 0.25) / RH), 0, ROWS - 1);
  const free = slots.filter(s => s.row === row && !s.item);
  if (!free.length) return null;
  const match = free.filter(s => s.type === it.type), list = match.length ? match : free;
  let b = null, bd = 1e9; for (const s of list) { const d = Math.abs(s.x - q.x); if (d < bd) { bd = d; b = s; } }
  return b;
}
function setHover(s, it) {
  if (hover && hover.ghost) hover.ghost.material = ghostMat;
  hover = s; if (s && s.ghost) s.ghost.material = s.type === it.type ? hiMat : badMat;
}

input({
  onDown(e) {
    if (state !== 'play' || drag || doorAng < 0.6) return;
    const it = pick(e); if (!it) return;
    drag = { it, target: aimPoint(e).add(V(0, 0.55, 0)) }; it.lift = 1; it.sq = 0.25;
    sfx.pick(placedN % 6); buzz(6);
  },
  onMove(dx, dy, e) { if (drag) { drag.target = aimPoint(e).add(V(0, 0.55, 0)); } },
  onUp() {
    if (!drag) return; const it = drag.it; drag = null; const s = targetFor(it, it.g.position); setHover(null, it);
    if (!s) return sendHome(it);
    if (s.type !== it.type) return wrong(it, s);
    flyTo(it, s, 7);
  },
});

function flyTo(it, s, dur = 14, arc = 0) {
  s.item = it; // reserve
  it.anim = { from: it.g.position.clone(), fr: it.g.rotation.clone(), to: V(s.x, s.y, s.z), tr: V(0, (Math.random() - 0.5) * 0.25, 0), t: 0, dur, arc, done: () => place(it, s) };
}
function sendHome(it, arc = 0.8) {
  it.lift = 0;
  it.anim = { from: it.g.position.clone(), fr: it.g.rotation.clone(), to: it.home.p.clone(), tr: it.home.r.clone(), t: 0, dur: 18, arc, done: () => { it.sq = 0.35; tone(260, 0.07, 'sine', 0.1, 0.7); } };
}
function wrong(it, s) {
  hearts--; ui.pill(hearts > 0 ? '❤️'.repeat(hearts) + '🤍'.repeat(HMAX - hearts) : '🤍'.repeat(HMAX)); combo = 0;
  sfx.fail(); buzz([30, 30, 50]); ui.flash(0.25); document.querySelector('.hc-flash').style.background = '#ff4d6d'; setTimeout(() => document.querySelector('.hc-flash').style.background = '#fff', 300);
  ui.pop('WRONG SHELF', '#ff4d6d', 30, 22);
  if (s.ghost) { s.ghost.material = badMat; setTimeout(() => { if (s.ghost && hover !== s) s.ghost.material = ghostMat; }, 350); }
  sendHome(it, 1.6);
  if (hearts <= 0) { state = 'lost'; F.level(false, placedN / Math.max(1, slots.length)); doorTarget = 0; ui.lose('OOPS!', `Wrong shelf ${HMAX} times`); }
}
const SND = {
  metal: () => { tone(1900, 0.05, 'sine', 0.07, 1); tone(640, 0.1, 'triangle', 0.12, 0.75); },
  glass: () => { tone(2600, 0.08, 'sine', 0.06, 1); tone(1320, 0.12, 'sine', 0.06, 1); tone(420, 0.06, 'triangle', 0.08, 0.7); },
  soft: () => { tone(240, 0.08, 'triangle', 0.16, 0.6); tone(900, 0.03, 'sine', 0.04, 1); },
  fruit: () => { tone(330, 0.09, 'sine', 0.16, 0.55); },
};
function place(it, s) {
  it.placed = true; it.slot = s; it.lift = 0; it.sq = 0.55; placedN++;
  if (s.ghost) { levelGroup.remove(s.ghost); s.ghost = null; }
  SND[TYPES[it.type].snd](); buzz(10);
  const now = performance.now(); combo = now - lastPlace < 1600 ? combo + 1 : 1; lastPlace = now;
  score += 10 + Math.min(combo, 10) * 2;
  burst(scene, V(s.x, s.y + TYPES[it.type].h * S * 0.7, s.z + 0.4), ['#ffffff', '#fff3a0', '#a0f0ff'], 8, { speed: 0.06, up: 0.05, size: 0.45, shape: 'sphere', gravity: 0.002 });
  if (combo === 3) ui.pop('NICE!', '#fff', 34, 20); else if (combo === 5) ui.pop('GREAT!', '#ffd23f', 38, 20); else if (combo >= 8 && combo % 3 === 2) ui.pop('ON A ROLL!', '#ff8fab', 38, 20);
  // whole row neatly filled
  const ri = rowsInfo[s.row];
  if (!ri.done && ri.slots.every(x => x.item && x.item.placed)) {
    ri.done = true; shelves[s.row].glow = 1; score += 50;
    ui.pop(['NEAT!', 'PERFECT!', 'SO TIDY!'][s.row % 3], '#ffffff', 44, 30); sfx.coin(); ui.flash(0.18);
    for (const x of ri.slots) x.item.sq = 0.45;
    confetti(scene, V(0, rowFloor(s.row) + 1, 1), 26);
  }
  ui.progress(placedN / slots.length);
  if (placedN === slots.length) win();
}
function win() {
  state = 'won'; F.level(true); best = Math.max(best, score); ST.set('best', best); winT = 1;
  setTimeout(() => { if (state === 'won') doorTarget = 0; }, 350);
  setTimeout(() => { if (state !== 'won') return; sfx.win(); buzz([20, 40, 20]); ui.flash(0.6); confetti(scene, V(0, 5, 2), 70); burst(scene, V(0, 4, 2), ['#ffffff', '#ffd23f'], 20, { speed: 0.16, up: 0.12, size: 0.5, shape: 'sphere' }); }, 700);
  ui.win(level, `Fridge stocked! ${score} pts`);
}
ui.onTap(w => {
  if (w === 'start') { state = 'play'; doorTarget = 1; sfx.tap(); tone(180, 0.25, 'sine', 0.08, 1.4); }
  else if (w === 'win') { level++; ST.set('level', level); buildLevel(); state = 'play'; doorTarget = 1; tone(180, 0.25, 'sine', 0.08, 1.4); }
  else if (w === 'lose') { score = 0; buildLevel(); state = 'play'; doorTarget = 1; }
});

// ------------------------------------------------------------------ loop
function resize() {
  const a = innerWidth / innerHeight;
  const dist = a < 0.62 ? 16.6 : 13.5;
  camera.position.set(0, 3.0, dist); camera.lookAt(0, 3.05, 0);
}
addEventListener('resize', resize); resize();
let tPrev = 0;
loop((dt, t) => {
  // door: spring-ish ease
  const dd = doorTarget - doorAng; doorAng += dd * (doorTarget ? 0.07 : 0.11) * dt; if (Math.abs(dd) < 0.002) doorAng = doorTarget;
  door.rotation.y = -2.25 * easeOutBack(clamp(doorAng, 0, 1)) * (doorTarget ? 1 : 1);
  ilight.intensity = 3 * clamp(doorAng * 1.2, 0, 1);
  for (const s of shelves) { s.glow = Math.max(0, s.glow - 0.02 * dt); s.gm.emissiveIntensity = s.glow * 0.9; s.gm.emissive.set('#9dffb0'); }
  if (drag) {
    const it = drag.it, p = it.g.position;
    const vx = (drag.target.x - p.x);
    p.lerp(drag.target, 0.42 * Math.min(1, dt)); it.g.rotation.x = lerp(it.g.rotation.x, 0, 0.25); it.g.rotation.y = lerp(it.g.rotation.y, 0, 0.25); it.g.rotation.z = lerp(it.g.rotation.z, clamp(-vx * 0.5, -0.5, 0.5), 0.25);
    const s = targetFor(it, p); if (s !== hover) { setHover(s, it); if (s) tone(s.type === it.type ? 760 : 300, 0.03, 'sine', 0.05, 1); }
  }
  // ghost pulse
  const pul = 0.3 + Math.sin(t * 4) * 0.1; ghostMat.opacity = pul; hiMat.opacity = 0.55 + Math.sin(t * 12) * 0.15;
  for (const it of items.concat()) {
    const g = it.g;
    if (it.anim) {
      const a = it.anim; a.t += dt / a.dur; const k = Math.min(1, a.t), e = 1 - Math.pow(1 - k, 3);
      g.position.lerpVectors(a.from, a.to, e); g.position.y += Math.sin(k * Math.PI) * a.arc;
      g.rotation.set(lerp(a.fr.x, a.tr.x, e), lerp(a.fr.y, a.tr.y, e), lerp(a.fr.z, a.tr.z, e));
      if (k >= 1) { it.anim = null; a.done(); }
    }
    // squash spring
    it.sqv += (-it.sq) * 0.28 * dt; it.sqv *= 0.78; it.sq += it.sqv * dt;
    it.bs = lerp(it.bs ?? BS, (it.placed || it.lift || (drag && drag.it === it)) ? 1 : BS, 0.2); const sc = S * it.bs * (drag && drag.it === it ? 1.12 : 1);
    g.scale.set(sc * (1 + it.sq * 0.35), sc * (1 - it.sq * 0.45), sc * (1 + it.sq * 0.35));
  }
  if (state === 'ready') { /* idle bob on the start card */ }
  if (state === 'play' && !drag && performance.now() - lastPlace > 4500 && level <= 2) {
    // gentle hint: wiggle one free item
    const it = items.find(x => !x.placed && !x.anim); if (it && Math.sin(t * 3) > 0.995) it.sq = 0.3;
  }
});

// ------------------------------------------------------------------ test hooks
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; }, _dbg: { ghostMat, slots: () => slots, items: () => items, scr: (x, y, z) => screenOf(V(x, y, z)), get hearts() { return hearts; }, get placed() { return placedN; } },
  bot() {
    if (state !== 'play' || drag || doorAng < 0.6) return;
    if (items.some(it => it.anim && !it.placed && it.slot === null && it.anim.dur === 13)) return;
    const it = items.find(x => !x.placed && !x.anim); if (!it) return;
    const s = slots.find(x => !x.item && x.type === it.type); if (!s) return;
    it.lift = 1; it.sq = 0.25; sfx.pick(placedN % 6);
    flyTo(it, s, 13, 1.2);
  },
};
buildLevel(); ui.start();
