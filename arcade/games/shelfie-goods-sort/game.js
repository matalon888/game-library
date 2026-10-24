// Shelfie: Goods Sort — drag goods between shop shelves; three alike on one shelf clear, and the row hidden behind steps
// forward. No timer: stars come from how few moves you need. Restore three shops on Main Street with your stars, fill a
// sticker album, keep a daily streak. Mechanic inspired by Goods Sort / Match Factory; all code original, art = the
// AGENTPARK AI 3D library (assets/cozy) + a Hero Lab character. Rendering: kit/cine.js. Money: kit/money.js interface.
import { THREE, createUI, store, buzz, confetti, updateParticles } from './kit/hc.js';
import { cine } from './kit/cine.js';
import { GLTFLoader } from './kit/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from './kit/addons/geometries/RoundedBoxGeometry.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { money } from './kit/money.js';
import { snd } from './audio.js';
import { SHOPS, NAMES, ALL_GOODS, shopOfLevel, POSE } from './items.js';
import * as LV from './levels.js';
import * as TX from './tex.js';

const M = money({ game: 'shelfie', style: 'A' });

const V3 = THREE.Vector3, Q4 = THREE.Quaternion, M4 = THREE.Matrix4;
const NAME = 'Shelfie: Goods Sort';
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const easeBack = t => { const c = 1.9; t = clamp(t, 0, 1) - 1; return 1 + (c + 1) * t * t * t + c * t * t; };
const SLOT = 1, CW = 3, CH = 1.55, DEPTH = 1.5, BOARD = 0.16, POST = 0.16, PLINTH = 0.55, ZF = 0.3, ZB = -0.32;
const UW = CW + POST, UH = CH + BOARD;

// ------------------------------------------------------------------ save
const S = store('shelfie');
const save = {
  level: S.get('level', 1), stars: S.get('stars', {}), boost: S.get('boost', { undo: 3, wand: 2, shuffle: 2, cart: 1 }),
  album: S.get('album', []), pages: S.get('pages', []), decor: S.get('decor', {}), spent: S.get('spent', 0),
  dStreak: S.get('dStreak', 0), dLast: S.get('dLast', 0), freezeWeek: S.get('freezeWeek', ''), dDone: S.get('dDone', 0), seen: S.get('seen', 0),
};
const persist = () => { for (const k in save) S.set(k, save[k]); };
const totalStars = () => Object.values(save.stars).reduce((a, b) => a + b, 0) + (S.get('dailyStars', 0));
const starBank = () => totalStars() - save.spent;

// ------------------------------------------------------------------ kit layers
const ui = createUI({ title: 'Shelfie', hint: '', hand: '', progress: false, score: false });
const F = flow('shelfie');
buildCards();
const D = daily('shelfie', ui, { name: NAME });
const B = board({ game: 'shelfie', label: 'Stars won', mode: 'sum', limits: { maxRun: 6, maxPerSec: 2 }, corner: 'tl', accent: '#ff6fa0' });

// ------------------------------------------------------------------ renderer / scene
const R = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
R.domElement.className = 'hc-canvas'; document.body.prepend(R.domElement);
R.setPixelRatio(Math.min(devicePixelRatio, 2)); R.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#f6d4cf');
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.5, 200);
const C = cine(R, scene, camera, { bloom: 0.12, bloomThreshold: 0.92, bloomRadius: 0.4, exposure: 1.0, envIntensity: 0.55,
  grade: { sat: 1.16, contrast: 1.07, vignette: 0.12, grain: 0, tint: '#fff8f0' } });
const LITE = C.lite;
const hemi = new THREE.HemisphereLight('#fff6ec', '#d9a58c', 0.5); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffeed6', 2.9); sun.position.set(-5, 12, 14); sun.castShadow = true;
sun.shadow.mapSize.set(LITE ? 1024 : 2048, LITE ? 1024 : 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.025; sun.shadow.radius = 5;
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 2, far: 50 }); scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight('#ffe0ea', 0.5); fill.position.set(8, 4, 10); scene.add(fill);
const rbox = (w, h, d, r = 0.06) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));

// ------------------------------------------------------------------ model library
const loader = new GLTFLoader();
const TYPES = {};
function toFloat(g) {
  for (const k of Object.keys(g.attributes)) {
    const a = g.attributes[k]; if (a.array instanceof Float32Array && !a.isInterleavedBufferAttribute && !a.normalized) continue;
    const n = a.itemSize, out = new Float32Array(a.count * n);
    for (let i = 0; i < a.count; i++) { out[i * n] = a.getX(i); if (n > 1) out[i * n + 1] = a.getY(i); if (n > 2) out[i * n + 2] = a.getZ(i); if (n > 3) out[i * n + 3] = a.getW(i); }
    g.setAttribute(k, new THREE.BufferAttribute(out, n));
  }
  return g;
}
/** load a library GLB: stood up (Z-up → Y-up), base on y=0, centred, largest side 1 */
function piece(id) {
  if (TYPES[id]) return TYPES[id];
  return TYPES[id] = loader.loadAsync(`assets/${id}.glb`).then(gl => {
    gl.scene.updateMatrixWorld(true);
    let mesh = null; gl.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
    const geo = toFloat(mesh.geometry.clone()); geo.applyMatrix4(mesh.matrixWorld); geo.rotateX(Math.PI / 2);
    geo.computeBoundingBox(); const b = geo.boundingBox, s = new V3(); b.getSize(s);
    const k = 1 / Math.max(s.x, s.y, s.z), c = new V3(); b.getCenter(c);
    geo.translate(-c.x, -b.min.y, -c.z); geo.scale(k, k, k);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    geo.computeBoundingBox(); geo.computeBoundingSphere();
    const mat = mesh.material; mat.side = THREE.FrontSide; mat.envMapIntensity = 1.05;
    const t = { id, geo, mat, size: s.multiplyScalar(k), tris: (geo.index ? geo.index.count : geo.attributes.position.count) / 3, inst: null };
    const P = POSE[id] || {}; t.yaw = P.yaw || 0;
    const wEff = Math.abs(Math.cos(t.yaw)) * t.size.x + Math.abs(Math.sin(t.yaw)) * t.size.z, dEff = Math.abs(Math.sin(t.yaw)) * t.size.x + Math.abs(Math.cos(t.yaw)) * t.size.z;
    t.fit = Math.min(0.9 * SLOT / wEff, (CH - 0.36) / t.size.y, 1.05 / dEff) * (P.s || 1);
    t.h = t.size.y * t.fit;
    return t;
  }).catch(e => { console.warn('missing model', id, e && e.message); return null; });
}
const SYNC = {};
function instFor(t) {
  if (!t.inst) {
    t.inst = new THREE.InstancedMesh(t.geo, t.mat, 12); t.inst.castShadow = true; t.inst.receiveShadow = true;
    t.inst.frustumCulled = false; t.inst.count = 0; t.inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    t.inst.setColorAt(0, new THREE.Color(1, 1, 1)); scene.add(t.inst);
  }
  return t.inst;
}

// ------------------------------------------------------------------ room + cabinet
const room = new THREE.Group(), cab = new THREE.Group(), decorG = new THREE.Group(); scene.add(room, cab, decorG);
const TEXC = {};
function shopTex(shop) {
  if (TEXC[shop.key]) return TEXC[shop.key];
  const L = shop.look;
  const back = L.back === 'damask' ? TX.damask(L.backA, L.backB) : L.back === 'subway' ? TX.subway(L.backA, L.backB) : TX.gingham(L.backB, L.backA);
  const wall = TX.wallpaper(L.wall[0], L.wall[1], L.wall[2]); wall.repeat.set(9, 3);
  const floor = TX.herring(L.floor); floor.repeat.set(7, 7);
  const sign = TX.sign(shop.sign, L.signBg, '#fff', L.signEdge);
  const woodT = TX.wood(L.shelf); woodT.repeat.set(2, 0.5);
  return TEXC[shop.key] = { back, wall, floor, sign, woodT };
}
const MAT = {
  frame: new THREE.MeshStandardMaterial({ roughness: 0.32, metalness: 0.02 }),
  trim: new THREE.MeshStandardMaterial({ color: '#ffd27a', roughness: 0.25, metalness: 0.85 }),
  shelf: new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0 }),
  back: new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 }),
  wall: new THREE.MeshStandardMaterial({ roughness: 0.9 }),
  floor: new THREE.MeshStandardMaterial({ roughness: 0.55 }),
  wain: new THREE.MeshStandardMaterial({ color: '#fff6ee', roughness: 0.5 }),
  sign: new THREE.MeshStandardMaterial({ roughness: 0.4 }),
  door: new THREE.MeshStandardMaterial({ roughness: 0.35 }),
  cart: new THREE.MeshStandardMaterial({ color: '#ffe3a3', roughness: 0.3, metalness: 0.3 }),
  white: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 }),
  liner: new THREE.MeshStandardMaterial({ transparent: true, roughness: 0.8, side: THREE.DoubleSide }),
  glass: new THREE.MeshBasicMaterial({ color: '#e3f2fb' }),
};
const aoTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  let g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(60,20,40,.55)'); g.addColorStop(0.45, 'rgba(60,20,40,.08)'); g.addColorStop(0.85, 'rgba(60,20,40,0)'); g.addColorStop(1, 'rgba(60,20,40,.22)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  for (const [a, b] of [[0, 18], [128, 110]]) { g = x.createLinearGradient(a, 0, b, 0); g.addColorStop(0, 'rgba(60,20,40,.35)'); g.addColorStop(1, 'rgba(60,20,40,0)'); x.fillStyle = g; x.fillRect(Math.min(a, b), 0, 18, 128); }
  return new THREE.CanvasTexture(c); })();
const aoMat = new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, depthWrite: false });
let curShop = null;
function applyShop(shop) {
  if (curShop === shop) return; curShop = shop;
  const T = shopTex(shop), L = shop.look;
  MAT.frame.color.set(L.frame); MAT.trim.color.set(L.trim); MAT.door.color.set(new THREE.Color(L.frame).offsetHSL(0, -0.05, 0.06));
  MAT.shelf.map = T.woodT; MAT.shelf.color.set('#ffffff'); MAT.shelf.needsUpdate = true;
  MAT.back.map = T.back; MAT.back.needsUpdate = true; MAT.wall.map = T.wall; MAT.wall.needsUpdate = true;
  MAT.floor.map = T.floor; MAT.floor.needsUpdate = true; MAT.sign.map = T.sign; MAT.sign.needsUpdate = true;
  if (!MAT.liner.map) { MAT.liner.map = TX.scallop('#ffffff'); MAT.liner.alphaTest = 0.4; }
  scene.background.set(L.sky);
  document.body.dataset.shop = shop.key;
}
function buildRoom() {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), MAT.floor); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; room.add(floor);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(80, 30), MAT.wall); wall.position.set(0, 15, -DEPTH / 2 - 0.05); wall.receiveShadow = true; room.add(wall);
  const wain = new THREE.Mesh(new THREE.BoxGeometry(80, 1.6, 0.16), MAT.wain); wain.position.set(0, 0.8, -DEPTH / 2); wain.receiveShadow = true; room.add(wain);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(80, 0.14, 0.26), MAT.trim); rail.position.set(0, 1.62, -DEPTH / 2 + 0.02); room.add(rail);
  const crown = new THREE.Mesh(new THREE.BoxGeometry(80, 0.5, 0.4), MAT.wain); crown.position.set(0, 13.5, -DEPTH / 2); room.add(crown);
}
buildRoom();

// cabinet layout: logic never depends on it (the same level fits 2 columns on a phone, 3–4 on a desktop)
const G = { cols: 3, rows: 3, cells: [], W: 0, H: 0, top: 0, comps: 0, key: '' };
function gridFor(n, portrait) {
  if (portrait) return { cols: n <= 1 ? 1 : 2, rows: Math.ceil(n / 2) };
  const rows = n <= 8 ? 2 : 3, cols = Math.ceil(n / rows);
  return { cols, rows };
}
function buildCabinet(n, extraFlags = [], forceGrid = null) {
  const portrait = innerWidth / innerHeight < 0.85;
  const g = forceGrid || gridFor(n, portrait);
  const key = `${g.cols}x${g.rows}:${n}:${extraFlags.join('')}:${curShop.key}`;
  if (G.key === key) return; G.key = key;
  while (cab.children.length) { const c = cab.children.pop(); if (c.geometry && !c.userData.shared) c.geometry.dispose(); }
  G.cols = g.cols; G.rows = g.rows; G.comps = n;
  G.W = g.cols * UW + POST; G.H = g.rows * UH + BOARD;
  const x0 = -G.W / 2 + POST, y0 = PLINTH + BOARD;
  G.top = PLINTH + G.H;
  // cells: fill from the top row down, so a short last row sits at the bottom, centred
  G.cells = [];
  const full = Math.floor(n / g.cols) * g.cols, last = n - full;
  for (let i = 0; i < n; i++) {
    let r = Math.floor(i / g.cols), c = i % g.cols, xOff = 0;
    if (i >= full) { c = i - full; }
    const row = g.rows - 1 - r;
    G.cells.push({ x: x0 + c * UW + CW / 2 + xOff, y: y0 + row * UH, extra: !!extraFlags[i] });
  }
  const add = (geo, mat, x, y, z, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; cab.add(m); return m; };
  // back panel, sides, plinth, cornice
  const back = add(new THREE.PlaneGeometry(G.W - 0.1, G.H), MAT.back, 0, PLINTH + G.H / 2, -DEPTH / 2 + 0.02, false);
  back.material.map.repeat.set(G.W / 3.2, G.H / 3.2);
  add(rbox(POST * 2, G.H + 0.2, DEPTH + 0.1, 0.06), MAT.frame, -G.W / 2, PLINTH + G.H / 2, 0);
  add(rbox(POST * 2, G.H + 0.2, DEPTH + 0.1, 0.06), MAT.frame, G.W / 2, PLINTH + G.H / 2, 0);
  add(rbox(G.W + 0.5, PLINTH, DEPTH + 0.35, 0.1), MAT.frame, 0, PLINTH / 2, 0.05);
  add(rbox(G.W + 0.7, 0.1, DEPTH + 0.45, 0.04), MAT.trim, 0, PLINTH - 0.02, 0.05, false);
  add(rbox(G.W + 0.8, 0.42, DEPTH + 0.5, 0.12), MAT.frame, 0, PLINTH + G.H + 0.2, 0.05);
  add(rbox(G.W + 0.95, 0.1, DEPTH + 0.6, 0.04), MAT.trim, 0, PLINTH + G.H + 0.44, 0.05, false);
  // the sign on top
  const sw = Math.min(G.W * 0.62, 5.2), sh = sw / 4;
  add(rbox(sw + 0.3, sh + 0.3, 0.2, 0.08), MAT.trim, 0, PLINTH + G.H + 0.5 + sh / 2 + 0.1, 0.2);
  const sg = add(new THREE.PlaneGeometry(sw, sh), MAT.sign, 0, PLINTH + G.H + 0.5 + sh / 2 + 0.1, 0.31, false);
  G.signTop = PLINTH + G.H + 0.75 + sh;
  // shelves: one board per row across, gold lip and a scalloped liner
  for (let r = 0; r <= g.rows; r++) {
    const y = PLINTH + r * UH + BOARD / 2;
    if (r > 0 && r < g.rows) add(rbox(G.W - 0.1, BOARD, DEPTH, 0.04), MAT.shelf, 0, y, 0);
    if (r === 0) add(rbox(G.W - 0.1, BOARD, DEPTH, 0.04), MAT.shelf, 0, y, 0);
    if (r < g.rows) {
      add(new THREE.BoxGeometry(G.W - 0.1, 0.07, 0.07), MAT.trim, 0, y + BOARD / 2 - 0.01, DEPTH / 2 + 0.01, false);
      const ln = add(new THREE.PlaneGeometry(G.W - 0.3, 0.16), MAT.liner, 0, y - 0.06, DEPTH / 2 + 0.03, false);
      MAT.liner.map.repeat.set((G.W - 0.3) / 0.7, 1);
    }
  }
  // dividers per row between cells, and closed cupboard doors on empty cells
  const used = new Set(G.cells.map(c => `${Math.round(c.x * 100)}:${Math.round(c.y * 100)}`));
  for (let r = 0; r < g.rows; r++) {
    const yb = PLINTH + BOARD + r * UH;
    const rowCells = G.cells.filter(c => Math.abs(c.y - yb) < 0.01);
    const xs = new Set();
    for (const c of rowCells) { xs.add(+(c.x - CW / 2 - POST / 2).toFixed(3)); xs.add(+(c.x + CW / 2 + POST / 2).toFixed(3)); }
    for (const x of xs) if (Math.abs(Math.abs(x) - G.W / 2 + POST / 2) > 0.05) add(rbox(POST, CH, DEPTH - 0.06, 0.03), MAT.frame, x, yb + CH / 2, 0);
    for (let c = 0; c < g.cols; c++) {
      const cx = -G.W / 2 + POST + c * UW + CW / 2;
      const occupied = rowCells.some(k => Math.abs(k.x - cx) < CW / 2);
      if (!occupied) {
        // cupboard door pair
        for (const s of [-1, 1]) {
          add(rbox(CW / 2 - 0.06, CH - 0.06, 0.12, 0.06), MAT.door, cx + s * (CW / 4), yb + CH / 2, DEPTH / 2 - 0.08);
          add(new THREE.SphereGeometry(0.07, 12, 8), MAT.trim, cx + s * 0.18, yb + CH / 2, DEPTH / 2, false);
        }
      }
    }
  }
  // soft occlusion at the back of every open cell
  for (const c of G.cells) { const m = new THREE.Mesh(new THREE.PlaneGeometry(CW + POST, CH), aoMat); m.position.set(c.x, c.y + CH / 2, -DEPTH / 2 + 0.04); cab.add(m); }
  // extra (cart) shelves get a golden tray
  for (const c of G.cells) if (c.extra) {
    add(rbox(CW - 0.1, 0.08, DEPTH - 0.2, 0.03), MAT.cart, c.x, c.y + 0.04, 0, false);
  }
  // shadows cover the cabinet
  const ext = Math.max(G.W, G.H + PLINTH) / 2 + 3;
  Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext }); sun.shadow.camera.updateProjectionMatrix();
  sun.target.position.set(0, PLINTH + G.H / 2, 0); sun.position.set(-5, PLINTH + G.H / 2 + 12, 14);
  placeDecor(); layoutCamera(true);
}
const slotPos = (comp, slot, layer, out = new V3()) => {
  const c = G.cells[comp]; if (!c) return out.set(0, -50, 0);
  return out.set(c.x + (slot - 1) * SLOT, c.y + (layer ? 0.1 : 0), layer === 0 ? ZF : ZB - (layer - 1) * 0.25);
};

// ------------------------------------------------------------------ décor (meta) + host
const DECOR = {};   // id → mesh
const blobMat = new THREE.MeshBasicMaterial({ map: TX.blob(), transparent: true, depthWrite: false });
async function placeDecor(animId = null) {
  const shop = curShop; if (!shop) return;
  const n = save.decor[shop.key] || 0;
  for (const k in DECOR) DECOR[k].visible = false;
  for (let i = 0; i < shop.decor.length; i++) {
    const d = shop.decor[i]; if (i >= n) continue;
    let m = DECOR[d.id];
    if (!m) {
      const t = await piece(d.id); if (!t || curShop !== shop) continue;
      if (DECOR[d.id]) { m = DECOR[d.id]; } else {
        m = new THREE.Group(); const mesh = new THREE.Mesh(t.geo, t.mat); mesh.castShadow = true; mesh.receiveShadow = true; m.add(mesh);
        const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), blobMat); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.012; m.add(sh);
        m.userData.mesh = mesh; m.userData.shadow = sh; decorG.add(m); DECOR[d.id] = m;
      }
    }
    if (i >= (save.decor[shop.key] || 0)) continue;
    const [ax, ay, az] = d.at, side = Math.sign(ax) || 1;
    let x = ax, y = 0;
    if (ay === 'top') { x = side * Math.min(G.W / 2 - 0.9, Math.abs(ax)); y = G.top + 0.45; if (Math.abs(x) < 3.2 && G.W < 8) x = side * (G.W / 2 - 0.9); }
    else if (ay === 'ceil') { y = Math.max(G.signTop + 1.6, 9.5); }
    else if (Math.abs(ax) > 2) x = side * (G.W / 2 + Math.abs(ax) - 4.9);
    m.position.set(x, y, az); m.rotation.y = d.ry; m.userData.mesh.scale.setScalar(d.size);
    m.userData.shadow.visible = ay !== 'ceil' && d.id !== 'h08'; m.userData.shadow.scale.setScalar(d.size * 0.8);
    if (ay === 'ceil') m.userData.mesh.position.y = 0;
    m.visible = true;
    if (animId === d.id) { m.userData.pop = 0; }
  }
}
let host = null;
async function loadHost() {
  const gl = await loader.loadAsync('assets/host.glb');
  const root = gl.scene; root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root, true), hgt = box.max.y - box.min.y;
  const g = new THREE.Group(); g.add(root); root.position.y = -box.min.y; g.scale.setScalar(3.1 / hgt); scene.add(g);
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), blobMat); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.015; g.add(sh); sh.scale.setScalar(hgt / 3.1);
  const mixer = new THREE.AnimationMixer(root), acts = {};
  for (const c of gl.animations) acts[c.name] = mixer.clipAction(c);
  let cur = null;
  const play = (n, once = false) => { const a = acts[n]; if (!a) return; if (a === cur && !once) return; a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity); a.clampWhenFinished = once; a.play(); if (cur && cur !== a) cur.crossFadeTo(a, 0.25, false); cur = a;
    if (once) { clearTimeout(play.t); play.t = setTimeout(() => play('idle'), (a.getClip().duration * 1000) / a.timeScale + 100); } };
  play('idle');
  host = { g, mixer, play, h: 3.1 };
  placeHost();
}
function placeHost() {
  if (!host) return;
  if (mode === 'home') { host.g.position.set(G.W / 2 + 0.5, 0, 3.0); host.g.rotation.y = -0.5; }
  else { const por = innerWidth / innerHeight < 0.85; host.g.position.set(-(G.W / 2 + (por ? 4 : 1.9)), 0, 1.2); host.g.rotation.y = 0.55; }
}
let bubbleEl = null, bubbleT = 0;
function say(text, ms = 2400) { if (!host) return; bubbleEl?.remove(); bubbleEl = document.createElement('div'); bubbleEl.className = 'bubble'; bubbleEl.textContent = text; document.body.appendChild(bubbleEl); bubbleT = ms / 1000; }
const headP = new V3();
function placeBubble(dt) {
  if (!bubbleEl) return; bubbleT -= dt; if (bubbleT <= 0) { bubbleEl.remove(); bubbleEl = null; return; }
  host.g.getWorldPosition(headP); headP.y += 3.45; const p = headP.project(camera);
  const x = (p.x + 1) / 2 * innerWidth, y = (1 - p.y) / 2 * innerHeight;
  bubbleEl.style.left = clamp(x, 80, innerWidth - 80) + 'px'; bubbleEl.style.top = y + 'px';
  bubbleEl.style.opacity = (p.z < 1 && x > -40 && x < innerWidth + 40) ? Math.min(1, bubbleT * 3) : 0;
}

// ------------------------------------------------------------------ sparkles + rings + highlight
const SPN = 400, spPos = new Float32Array(SPN * 3), spCol = new Float32Array(SPN * 3), spV = new Float32Array(SPN * 3), spL = new Float32Array(SPN), spC = new Float32Array(SPN * 3);
const spGeo = new THREE.BufferGeometry(); spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3)); spGeo.setAttribute('color', new THREE.BufferAttribute(spCol, 3));
const sparks = new THREE.Points(spGeo, new THREE.PointsMaterial({ size: 0.22, map: TX.starSprite(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
sparks.frustumCulled = false; scene.add(sparks); spPos.fill(-999);
let spI = 0;
function sparkle(p, color, n = 24, speed = 2.2) {
  const c = new THREE.Color(color);
  for (let k = 0; k < n; k++) {
    const i = spI = (spI + 1) % SPN, a = Math.random() * Math.PI * 2, b = Math.acos(Math.random() * 2 - 1), s = speed * (0.4 + Math.random() * 0.8);
    spPos[i * 3] = p.x; spPos[i * 3 + 1] = p.y; spPos[i * 3 + 2] = p.z;
    spV[i * 3] = Math.sin(b) * Math.cos(a) * s; spV[i * 3 + 1] = Math.cos(b) * s + speed * 0.5; spV[i * 3 + 2] = Math.abs(Math.sin(b) * Math.sin(a)) * s;
    const w = Math.random() < 0.35 ? 1 : 0; spC[i * 3] = w ? 1 : c.r; spC[i * 3 + 1] = w ? 1 : c.g; spC[i * 3 + 2] = w ? 1 : c.b; spL[i] = 0.7 + Math.random() * 0.5;
  }
}
function updSparks(dt) {
  for (let i = 0; i < SPN; i++) {
    if (spL[i] <= 0) continue; spL[i] -= dt * 1.3;
    if (spL[i] <= 0) { spPos[i * 3 + 1] = -999; spCol[i * 3] = spCol[i * 3 + 1] = spCol[i * 3 + 2] = 0; continue; }
    spV[i * 3 + 1] -= 5 * dt; for (let k = 0; k < 3; k++) { spPos[i * 3 + k] += spV[i * 3 + k] * dt; spV[i * 3 + k] *= 0.97; spCol[i * 3 + k] = spC[i * 3 + k] * Math.min(1, spL[i] * 1.6); }
  }
  spGeo.attributes.position.needsUpdate = true; spGeo.attributes.color.needsUpdate = true;
}
const rings = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 48), new THREE.MeshBasicMaterial({ color: '#fff4c2', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); m.visible = false; scene.add(m); m.userData.t = 1; return m; });
let ringI = 0;
function ring(p, s = 1, color = '#fff4c2') { const r = rings[ringI = (ringI + 1) % rings.length]; r.position.copy(p); r.material.color.set(color); r.userData = { t: 0, s }; r.visible = true; }
function updRings(dt) { for (const r of rings) { if (!r.visible) continue; const u = r.userData; u.t += dt * 2.4; if (u.t >= 1) { r.visible = false; continue; } r.scale.setScalar(u.s * (0.3 + ease(u.t) * 1.3)); r.material.opacity = (1 - u.t) * 0.9; } }
// glowing frame over a shelf (drop target)
const hlTex = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
  x.strokeStyle = '#fff'; x.lineWidth = 14; x.shadowColor = '#fff'; x.shadowBlur = 18; x.beginPath(); x.roundRect(14, 14, 228, 100, 22); x.stroke(); return new THREE.CanvasTexture(c); })();
const hl = new THREE.Mesh(new THREE.PlaneGeometry(CW + 0.3, CH + 0.1), new THREE.MeshBasicMaterial({ map: hlTex, color: '#7dffc4', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
hl.position.z = DEPTH / 2 + 0.05; scene.add(hl);

// ------------------------------------------------------------------ level state
let mode = 'home', state = 'ready', busy = false;
const Lv = { n: 1, daily: false, shop: SHOPS[0], comps: [], objs: [], moves: 0, par3: 10, par2: 15, total: 0, cleared: 0, combo: 0, comboT: 0, grid: [],
  carts: 0, revived: 0, t0: 0, recorded: false, last: null, hard: false, token: 0 };
// comps here: [{ L: [[obj|null ×3], ...], extra }]
function view() {           // int view for the solver: type index per id
  const idx = {}; let k = 0;
  return Lv.comps.map(c => ({ L: c.L.map(row => row.map(o => o ? (idx[o.id] ??= k++) : -1)) }));
}
function themeForLevel(n, isDaily) { return isDaily ? SHOPS[(D.seed || 0) % 3] : shopOfLevel(n); }
async function startLevel(opt = {}) {
  if (busy) return; busy = true;
  snd.unlock();
  const isDaily = opt.daily ?? D.isDaily;
  const n = isDaily ? 10 : (opt.level || save.level);
  if (!isDaily && !opt.free) {
    const L = M.lives(); if (L.n <= 0) { busy = false; livesSheet(); return; }
  }
  const shop = themeForLevel(n, isDaily);
  const seed = isDaily ? D.seed : n * 1009 + 7;
  const gen = LV.generate(n, seed, shop.goods.map(g => g[0]), isDaily ? 1 : F.k());
  $('#loading').classList.add('on');
  const loaded = await Promise.all(gen.types.map(id => piece(id)));
  $('#loading').classList.remove('on');
  gen.types.forEach((id, i) => { SYNC[id] = loaded[i]; });
  // reset
  Lv.token++; clearObjs();
  Object.assign(Lv, { n, daily: isDaily, shop, moves: 0, par3: gen.par3, par2: gen.par2, cleared: 0, combo: 0, comboT: 0, carts: 0, revived: 0, recorded: false, last: null, hard: gen.hard, gen, wands: 0, triples: [] });
  applyShop(shop);
  Lv.comps = gen.comps.map(c => ({ L: c.L.map(row => row.map(() => null)), extra: false }));
  Lv.objs = [];
  const r = LV.rng(seed + 3);
  gen.comps.forEach((c, ci) => c.L.forEach((row, li) => row.forEach((t, s) => {
    if (t < 0) return;
    const id = gen.types[t], T = SYNC[id]; if (!T) return;
    const o = { id, t: T, comp: ci, layer: li, slot: s, p: new V3(), s: 0, dark: li === 0 ? 1 : 0.06, yawJ: (r() - 0.5) * 0.3, mode: 'rest', squash: 0, delay: 0, wob: 0 };
    Lv.comps[ci].L[li][s] = o; Lv.objs.push(o); instFor(T);
  })));
  Lv.total = Lv.objs.length;
  mode = 'play'; G.key = '';
  buildCabinet(Lv.comps.length, Lv.comps.map(c => c.extra));
  // goods drop onto the shelves from above, row by row
  for (const o of Lv.objs) { slotPos(o.comp, o.slot, o.layer, o.p); o.p.y += 3 + o.comp * 0.05; o.delay = 0.05 + (G.cells[o.comp]?.y || 0) * 0.04 + o.slot * 0.03 + o.layer * 0.08; o.s = o.t.fit; o.mode = 'drop'; o.v = 0; }
  placeHost(); host?.play('idle');
  refreshHUD(); refreshBoosters();
  ui.hideStart(); hideHome(); $('#hud').classList.remove('off'); $('#boosters').classList.remove('off');
  state = 'play'; busy = false; Lv.t0 = performance.now();
  B.start(); snd.whoosh(); snd.music(true);
  if (n === 1 && !isDaily) setTimeout(() => showTutorial(), 900);
  else if (n === 2 && !isDaily) setTimeout(() => toast('Clear a front row to reveal the next', true), 1100);
  else if (Lv.hard) setTimeout(() => toast('Hard level!', false), 700);
  // warm the next level's models
  setTimeout(() => { const nx = shopOfLevel(n + 1); nx.goods.slice(0, 8).forEach(g => piece(g[0])); }, 2500);
}
function clearObjs() { for (const id in SYNC) { const t = SYNC[id]; if (t && t.inst) t.inst.count = 0; } Lv.objs = []; drag = null; selected = null; hl.material.opacity = 0; }

// ------------------------------------------------------------------ moves
function freeSlots(ci) { return [0, 1, 2].filter(s => !Lv.comps[ci].L[0][s]); }
function canDrop(ci, from) { return ci >= 0 && ci !== from && freeSlots(ci).length > 0; }
function doMove(o, b, sb, viaBot = false) {
  if (state !== 'play') return false;
  const a = o.comp, sa = o.slot;
  if (!canDrop(b, a) || Lv.comps[b].L[0][sb]) return false;
  Lv.comps[a].L[0][sa] = null; Lv.comps[b].L[0][sb] = o;
  o.comp = b; o.slot = sb; o.mode = 'fly'; o.tp = 0; o.from = o.p.clone(); o.lift = viaBot ? 1.2 : 0.4;
  Lv.moves++; Lv.last = { o, a, sa, b, sb, clean: true };
  snd.tap(); buzz(8);
  const out = resolve([b, a]);
  if (out.cleared.length || out.advanced.length) Lv.last.clean = false;
  refreshHUD();
  afterResolve(out);
  return true;
}
/** clears + advances on the logical state; animations are scheduled on the objects */
function resolve(idxs, delay = 0.3) {
  const out = { cleared: [], advanced: [] };
  for (const i of idxs) {
    const f = Lv.comps[i].L[0];
    if (f[0] && f[1] && f[2] && f[0].id === f[1].id && f[1].id === f[2].id) {
      out.cleared.push(i); Lv.comps[i].L[0] = [null, null, null];
      for (const o of f) { o.mode = 'pop'; o.tp = -delay; o.from = null; }
      Lv.cleared += 3; onTriple(f[1], i, delay);
    }
  }
  for (const i of new Set(idxs)) advance(i, out, out.cleared.includes(i) ? delay + 0.28 : 0.05);
  return out;
}
function advance(i, out, delay) {
  const c = Lv.comps[i];
  // drop fully empty hidden rows (a wand can empty one)
  for (let k = c.L.length - 1; k >= 1; k--) if (c.L[k].every(o => !o)) c.L.splice(k, 1);
  while (c.L.length > 1 && c.L[0].every(o => !o)) {
    c.L.shift(); out.advanced.push(i);
    c.L.forEach((row, li) => row.forEach(o => { if (o) { o.layer = li; o.delay = Math.max(o.delay, delay); if (li === 0) o.hop = 1; } }));
    setTimeout(() => state === 'play' && snd.slide(), delay * 1000);
  }
}
function afterResolve(out) {
  const tok = Lv.token;
  const remaining = Lv.objs.filter(o => o.mode !== 'gone' && o.mode !== 'pop').length;
  if (remaining === 0) { setTimeout(() => { if (tok === Lv.token) winLevel(); }, 900); return; }
  if (Lv.comps.every(c => c.L[0].every(o => o))) setTimeout(() => { if (tok === Lv.token && state === 'play' && Lv.comps.every(c => c.L[0].every(o => o))) loseLevel(); }, 700);
}
const STICK = [];
function onTriple(o, ci, delay) {
  const tok = Lv.token;
  Lv.combo = Lv.comboT > 0 ? Lv.combo + 1 : 0; Lv.comboT = 4;
  Lv.triples.push(Lv.moves - (Lv.lastTripleMove || 0)); Lv.lastTripleMove = Lv.moves;
  setTimeout(() => {
    if (tok !== Lv.token) return;
    const p = slotPos(ci, 1, 0).add(new V3(0, o.t.h * 0.6 + 0.2, 0.25));
    snd.match(Lv.combo); buzz([10, 30, 14]);
    sparkle(p, '#ffd36b', 30, 2.6); sparkle(p, '#ffffff', 12, 1.6); ring(p, 0.8); ring(p, 0.5, '#ffd6e6');
    if (Lv.combo >= 1) { toast(['Nice!', 'Great!', 'Super!', 'Amazing!', 'Shelf-tastic!'][Math.min(4, Lv.combo - 1)] + (Lv.combo >= 2 ? ` x${Lv.combo + 1}` : '')); if (Lv.combo >= 2) host?.play('cheer', true); }
    flyStar(p);
    if (!save.album.includes(o.id)) { save.album.push(o.id); persist(); setTimeout(() => { if (tok === Lv.token) stickerToast(o.id); }, 500); }
    refreshHUD();
  }, delay * 1000 + 120);
}

// ------------------------------------------------------------------ boosters
const BOOST = ['undo', 'wand', 'shuffle', 'cart'];
const PRICE = { undo: 40, wand: 90, shuffle: 60, cart: 120 };
const BNAME = { undo: 'Undo', wand: 'Magic wand', shuffle: 'Shuffle', cart: 'Extra shelf' };
function refreshBoosters() { for (const b of document.querySelectorAll('.bst')) { const n = save.boost[b.dataset.k] || 0; b.querySelector('b').textContent = n || '+'; b.classList.toggle('zero', !n); } }
function useBooster(k, free = false) {
  if (state !== 'play' || busy) return false;
  const btn = document.querySelector(`.bst[data-k=${k}]`);
  if (!free && !(save.boost[k] > 0)) { boosterSheet(k); return false; }
  let ok = false;
  if (k === 'undo') ok = doUndo();
  if (k === 'wand') ok = doWand();
  if (k === 'shuffle') ok = doShuffle();
  if (k === 'cart') ok = doCart();
  if (!ok) { btn.classList.remove('shake'); void btn.offsetWidth; btn.classList.add('shake'); snd.deny(); return false; }
  if (!free) { save.boost[k]--; persist(); refreshBoosters(); }
  return true;
}
function doUndo() {
  const L = Lv.last; if (!L || !L.clean || L.o.comp !== L.b || L.o.slot !== L.sb || Lv.comps[L.a].L[0][L.sa]) { toast('Nothing to undo', true); return false; }
  Lv.comps[L.b].L[0][L.sb] = null; Lv.comps[L.a].L[0][L.sa] = L.o; L.o.comp = L.a; L.o.slot = L.sa; L.o.mode = 'fly'; L.o.tp = 0; L.o.from = L.o.p.clone(); L.o.lift = 0.6;
  Lv.moves = Math.max(0, Lv.moves - 1); Lv.last = null; snd.undo(); refreshHUD(); return true;
}
function doWand() {
  const vis = {};
  for (const o of Lv.objs) if (o.mode !== 'gone' && o.mode !== 'pop') { const w = o.layer === 0 ? 10 : o.layer === 1 ? 3 : 1; vis[o.id] = (vis[o.id] || 0) + w; }
  const id = Object.keys(vis).sort((a, b) => vis[b] - vis[a])[0]; if (!id) return false;
  const set = Lv.objs.filter(o => o.id === id && o.mode !== 'gone' && o.mode !== 'pop').sort((a, b) => a.layer - b.layer).slice(0, 3);
  if (set.length < 3) return false;
  const touched = new Set();
  const mid = new V3(); for (const o of set) mid.add(o.p); mid.multiplyScalar(1 / 3); mid.z = 1.6; mid.y += 0.6;
  for (const o of set) { Lv.comps[o.comp].L[o.layer][o.slot] = null; touched.add(o.comp); o.mode = 'wand'; o.tp = 0; o.from = o.p.clone(); o.to = mid.clone(); o.dark0 = o.dark; }
  Lv.cleared += 3; Lv.wands++;
  const tok = Lv.token;
  snd.magnet(); buzz(20);
  setTimeout(() => { if (tok !== Lv.token) return; for (const o of set) o.mode = 'gone'; snd.match(2); sparkle(mid, '#c7a6ff', 40, 3); sparkle(mid, '#fff', 16, 2); ring(mid, 2, '#d9c4ff'); flyStar(mid);
    if (!save.album.includes(id)) { save.album.push(id); persist(); stickerToast(id); } refreshHUD(); }, 620);
  const out = { cleared: [], advanced: [] };
  for (const ci of touched) advance(ci, out, 0.5);
  setTimeout(() => { if (tok === Lv.token) afterResolve({}); }, 650);
  Lv.last = null;
  return true;
}
function doShuffle() {
  const front = [], slots = [];
  Lv.comps.forEach((c, ci) => c.L[0].forEach((o, s) => { slots.push([ci, s]); if (o) front.push(o); }));
  if (front.length < 2) return false;
  for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]]; }
  // keep each shelf's empties where they were count-wise is not needed; just deal the goods out again
  Lv.comps.forEach(c => c.L[0] = [null, null, null]);
  front.forEach((o, i) => { const [ci, s] = slots[i]; Lv.comps[ci].L[0][s] = o; o.comp = ci; o.slot = s; o.mode = 'fly'; o.tp = -Math.random() * 0.15; o.from = o.p.clone(); o.lift = 1.4; });
  snd.whoosh(); buzz(25); Lv.last = null;
  const out = resolve(Lv.comps.map((c, i) => i), 0.55);
  afterResolve(out);
  return true;
}
function doCart() {
  if (Lv.carts >= 2) { toast('Two extra shelves max', true); return false; }
  Lv.carts++; Lv.comps.push({ L: [[null, null, null]], extra: true });
  G.key = ''; buildCabinet(Lv.comps.length, Lv.comps.map(c => c.extra));
  snd.whoosh(); buzz(20);
  const p = slotPos(Lv.comps.length - 1, 1, 0).add(new V3(0, 0.6, 0.3)); sparkle(p, '#ffd36b', 40, 3); ring(p, 2);
  toast('Extra shelf!', true); Lv.last = null;
  return true;
}
for (const b of document.querySelectorAll('.bst')) { b.addEventListener('pointerdown', e => e.stopPropagation()); b.addEventListener('click', e => { e.stopPropagation(); snd.unlock(); useBooster(b.dataset.k); }); }
function boosterSheet(k) {
  // one offer per screen: coins if you have them, otherwise a rewarded video for the wand (hint), otherwise the shop
  const price = PRICE[k], have = M.coins();
  const w = sheet(`<div class="sh-ic">${ICON[k]}</div><h3>${BNAME[k]}</h3><p>${BDESC[k]}</p>
    ${have >= price ? `<button class="big gold" data-a="buy">Buy 1 for ${COIN}${price}</button>` : k === 'wand' ? `<button class="big green" data-a="ad">▶ Watch a video: +1 wand</button>` : `<button class="big gold" data-a="shop">Get coins</button><p class="small">You have ${have} coins · win levels to earn more</p>`}
    <button class="x" data-a="x">Not now</button>`);
  w.addEventListener('click', async e => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'x') { w.remove(); return; }
    if (a === 'buy') { if (M.spend(price, 'booster:' + k)) { save.boost[k] = (save.boost[k] || 0) + 1; persist(); refreshBoosters(); snd.coin(); w.remove(); } return; }
    if (a === 'shop') { w.remove(); M.shop(); return; }
    if (a === 'ad') { w.remove(); if (await M.rewarded('hint', { what: '1 Magic wand (clears a set of three)' })) { save.boost.wand = (save.boost.wand || 0) + 1; persist(); refreshBoosters(); toast('+1 Magic wand', true); snd.coin(); } }
  });
}
const BDESC = { undo: 'Take back your last move.', wand: 'Clears one set of three goods for you.', shuffle: 'Deals the front goods out again.', cart: 'Adds a free shelf for this level.' };

// ------------------------------------------------------------------ input: drag (or tap-tap)
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function planeAt(x, y, z, out = new V3()) {
  ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const o = ray.ray.origin, d = ray.ray.direction, t = (z - o.z) / d.z; return out.copy(o).addScaledVector(d, t);
}
function compAt(p, pad = 0.25) {
  let best = -1, bd = 1e9;
  G.cells.forEach((c, i) => {
    if (i >= Lv.comps.length) return;
    const dx = Math.abs(p.x - c.x), dy = p.y - c.y;
    if (dx < CW / 2 + pad && dy > -pad - 0.2 && dy < CH + pad) { const d = dx + Math.abs(dy - CH / 2) * 0.5; if (d < bd) { bd = d; best = i; } }
  });
  return best;
}
let drag = null, selected = null;
const _p = new V3();
R.domElement.addEventListener('pointerdown', e => {
  snd.unlock();
  if (state !== 'play' || busy) return;
  const p = planeAt(e.clientX, e.clientY, ZF, _p), ci = compAt(p, 0.05);
  if (ci < 0) { if (selected) { selected = null; } return; }
  const slot = clamp(Math.round(p.x - G.cells[ci].x + 1), 0, 2);
  let o = Lv.comps[ci].L[0][slot];
  if (!o) { // empty slot: if something is selected, move it here
    if (selected && canDrop(ci, selected.comp)) { const s = Lv.comps[ci].L[0][slot] ? freeSlots(ci)[0] : slot; const so = selected; selected = null; doMove(so, ci, s); return; }
    const near = [0, 1, 2].map(s => Lv.comps[ci].L[0][s]).filter(Boolean).sort((a, b) => Math.abs(a.slot - (p.x - G.cells[ci].x + 1)) - Math.abs(b.slot - (p.x - G.cells[ci].x + 1)))[0];
    if (!near || Math.abs(near.slot - (p.x - G.cells[ci].x + 1)) > 0.8) return; o = near;
  }
  if (o.mode !== 'rest' && o.mode !== 'fly') return;
  if (selected && selected !== o && canDrop(ci, selected.comp)) { const so = selected; selected = null; doMove(so, ci, nearestFree(ci, p.x)); return; }
  drag = { o, x0: e.clientX, y0: e.clientY, moved: false, id: e.pointerId };
  o.mode = 'drag'; snd.pick(1); buzz(6);
  R.domElement.setPointerCapture?.(e.pointerId);
});
function nearestFree(ci, x) { const f = freeSlots(ci); return f.sort((a, b) => Math.abs(G.cells[ci].x + a - 1 - x) - Math.abs(G.cells[ci].x + b - 1 - x))[0]; }
R.domElement.addEventListener('pointermove', e => {
  if (!drag) return;
  if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 8) drag.moved = true;
  drag.x = e.clientX; drag.y = e.clientY;
});
const endDrag = e => {
  if (!drag) return; const d = drag; drag = null; const o = d.o;
  if (state !== 'play') { o.mode = 'rest'; return; }
  if (!d.moved) { // a tap: select it (tap a shelf next)
    o.mode = 'rest'; selected = selected === o ? null : o; if (selected) { o.hop = 1; } hl.material.opacity = 0; return;
  }
  const p = planeAt(e.clientX, e.clientY, ZF, _p), ci = compAt(p);
  hl.material.opacity = 0; selected = null;
  if (canDrop(ci, o.comp)) { o.mode = 'rest'; doMove(o, ci, nearestFree(ci, p.x)); }
  else { o.mode = 'fly'; o.tp = 0; o.from = o.p.clone(); o.lift = 0.2; if (ci >= 0 && ci !== o.comp) { snd.deny(); buzz(20); } }
};
R.domElement.addEventListener('pointerup', endDrag);
R.domElement.addEventListener('pointercancel', endDrag);

// ------------------------------------------------------------------ win / lose
function starsFor(m) { return m <= Lv.par3 ? 3 : m <= Lv.par2 ? 2 : 1; }
function record(won) {
  if (Lv.recorded) return; Lv.recorded = true;
  F.level(won, Lv.total ? Lv.cleared / Lv.total : 0);
}
let winCoins = 0;
function winLevel() {
  if (state !== 'play') return; state = 'won'; record(true); document.querySelector('.tut')?.remove();
  const stars = starsFor(Lv.moves), ms = performance.now() - Lv.t0;
  let gained = 0; const rewards = [];
  if (Lv.daily) {
    const today = D.seed;
    if (save.dDone !== today) {
      save.dDone = today; gained = stars; S.set('dailyStars', S.get('dailyStars', 0) + stars);
      // daily streak with one free freeze a week
      const yd = ymd(addDays(-1)), yd2 = ymd(addDays(-2)), wk = isoWeek();
      if (save.dLast === yd) save.dStreak++;
      else if (save.dLast === yd2 && save.freezeWeek !== wk) { save.dStreak++; save.freezeWeek = wk; rewards.push(['freeze', 0]); }
      else save.dStreak = 1;
      save.dLast = today;
    }
  } else {
    const old = save.stars[Lv.n] || 0; if (stars > old) { gained = stars - old; save.stars[Lv.n] = stars; }
    if (Lv.n === save.level) {
      save.level++;
      const k = BOOST[(Lv.n - 1) % 4]; save.boost[k] = (save.boost[k] || 0) + 1; rewards.push([k, 1]);
    }
  }
  winCoins = (Lv.hard ? 40 : 20) + stars * 5 + (Lv.daily ? 30 : 0);
  M.add(winCoins, Lv.daily ? 'daily-win' : 'level-win');
  persist();
  if (gained > 0) B.submit(gained, { ms });
  D.won(Lv.moves, 'cleared today\'s shelves in');
  snd.win(); buzz([20, 40, 20]); host?.play('cheer', true);
  const cpos = new V3(0, PLINTH + G.H / 2, 1.5); confetti(scene, cpos, 80);
  for (let k = 0; k < 4; k++) setTimeout(() => sparkle(new V3((Math.random() - 0.5) * G.W * 0.8, PLINTH + Math.random() * G.H, 1), ['#ffd36b', '#ff8db6', '#7fe0c1', '#9fc8ff'][k], 40, 3.5), k * 150);
  const w = ui.els.win;
  w.querySelector('.stars').innerHTML = [0, 1, 2].map(() => `<i>${STAR_SVG}</i>`).join('');
  w.querySelector('.reward').innerHTML = `<span class="coinline">${COIN}<b id="wc">+${winCoins}</b></span>` + rewards.map(([k, n]) => k === 'freeze' ? `<span>❄️ Streak freeze used</span>` : `<span>${ICON[k]}+${n}</span>`).join('');
  const dbl = w.querySelector('#dbl'); dbl.classList.remove('hc-hidden'); dbl.disabled = false; dbl.innerHTML = `▶ Double coins <small>watch a video</small>`;
  w.querySelector('#grid').classList.toggle('hc-hidden', !Lv.daily);
  w.querySelector('#streakL').textContent = Lv.daily ? `🔥 Daily streak ${save.dStreak}` : '';
  shareBtn && shareBtn.classList.toggle('hc-hidden', Lv.daily);
  w.querySelector('p').firstChild.textContent = Lv.daily ? 'DAILY PUZZLE' : 'LEVEL ';
  ui.win(Lv.daily ? '' : Lv.n, Lv.daily ? `Solved in ${Lv.moves} moves` : `${Lv.moves} moves · ${Lv.shop.name}`);
  setTimeout(() => { const st = w.querySelectorAll('.stars i'); for (let k = 0; k < stars; k++) setTimeout(() => { st[k].classList.add('on'); snd.star(k); buzz(10); }, 250 + k * 300); }, 650);
  setTimeout(() => { $('#hud').classList.add('off'); $('#boosters').classList.add('off'); }, 600);
}
function loseLevel() {
  if (state !== 'play') return; state = 'lost'; document.querySelector('.tut')?.remove();
  snd.lose(); buzz([40, 60, 40]); host?.play('fall', true);
  const l = ui.els.lose;
  const rev = l.querySelector('#rev'); rev.classList.toggle('hc-hidden', Lv.revived >= 2); rev.disabled = false;
  ui.lose('Shelves full!', Lv.revived >= 2 ? 'No more room this time' : 'One more shelf and you have it');
  setTimeout(() => { $('#boosters').classList.add('off'); }, 600);
}
async function revive() {
  if (!(await M.rewarded('revive', { what: 'An extra shelf so you can keep going' }))) return false;
  ui.els.lose.classList.add('hc-hidden');
  state = 'play'; Lv.revived++; Lv.carts = Math.min(Lv.carts, 1);
  $('#boosters').classList.remove('off'); $('#hud').classList.remove('off');
  doCart(); return true;
}
function failAndLeave() {
  record(false);
  if (!Lv.daily) { M.useLife(); }
}
ui.onTap(which => {
  snd.unlock();
  if (which === 'start') { ui.start(); return; }
  if (which === 'win') { afterWin(); return; }
  if (which === 'lose') { failAndLeave(); state = 'ready'; startLevel({ level: Lv.n, daily: Lv.daily }); }
});
async function afterWin() {
  state = 'ready'; clearObjs();
  await M.breakAd('level-end', { level: Lv.n });
  showHome(true);
}

// ------------------------------------------------------------------ HUD
function refreshHUD() {
  $('#lvl').textContent = Lv.daily ? '★' : Lv.n;
  $('#lvlTag').textContent = Lv.daily ? 'DAILY' : Lv.hard ? 'HARD' : 'LEVEL';
  document.querySelector('.lvlp').classList.toggle('hard', !!Lv.hard);
  $('#moves').textContent = Lv.moves;
  const st = starsFor(Lv.moves);
  document.querySelectorAll('#mstars i').forEach((el, i) => el.classList.toggle('on', i < st));
  const nxt = st === 3 ? Lv.par3 - Lv.moves : st === 2 ? Lv.par2 - Lv.moves : null;
  $('#mnext').textContent = nxt === null ? '' : `${nxt} left for ${st}★`;
  $('#bar i').style.width = (Lv.total ? Lv.cleared / Lv.total * 100 : 0) + '%';
  $('#coinN').textContent = M.coins();
}
let toastEl = null;
function toast(t, small = false) { if (toastEl) toastEl.remove(); const d = toastEl = document.createElement('div'); d.className = 'toast' + (small ? ' small' : ''); d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 1200); }
function stickerToast(id) {
  snd.sticker();
  const d = document.createElement('div'); d.className = 'stk'; d.innerHTML = `<img src="assets/thumbs/${id}.webp" alt=""><div><small>NEW STICKER</small>${NAMES[id] || ''}</div>`;
  document.body.appendChild(d); setTimeout(() => d.remove(), 2200);
}
function flyStar(p) {
  const v = p.clone().project(camera), x = (v.x + 1) / 2 * innerWidth, y = (1 - v.y) / 2 * innerHeight;
  const tgt = $('#bar').getBoundingClientRect(), tx = tgt.left + tgt.width * (Lv.total ? Lv.cleared / Lv.total : 0), ty = tgt.top + tgt.height / 2;
  for (let k = 0; k < 3; k++) {
    const s = document.createElement('div'); s.className = 'fly'; s.innerHTML = STAR_SVG; s.style.left = (x - 16 + (k - 1) * 22) + 'px'; s.style.top = (y - 16) + 'px'; document.body.appendChild(s);
    setTimeout(() => { s.style.transform = `translate(${tx - x - (k - 1) * 22}px,${ty - y}px) scale(.5)`; s.style.opacity = '0.6'; }, 30 + k * 70);
    setTimeout(() => s.remove(), 700 + k * 70);
  }
}
const muteBtn = $('#mute');
const paintMute = () => { muteBtn.innerHTML = snd.muted ? SVG.mute : SVG.sound; $('#hmute').innerHTML = muteBtn.innerHTML; };
for (const b of [muteBtn, $('#home'), $('#hmute')]) b.addEventListener('pointerdown', e => e.stopPropagation());
muteBtn.addEventListener('click', () => { snd.toggle(); paintMute(); });
$('#hmute').addEventListener('click', () => { snd.toggle(); paintMute(); });
$('#home').addEventListener('click', () => {
  if (state !== 'play') return;
  const w = sheet(`<h3>Leave this level?</h3><p>${Lv.daily ? 'You can come back to the daily puzzle any time today.' : 'You will lose a life.'}</p><button class="big green" data-a="stay">Keep playing</button><button class="x" data-a="go">Leave</button>`);
  w.addEventListener('click', e => { const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return; w.remove(); if (a === 'go') { failAndLeave(); state = 'ready'; clearObjs(); showHome(); } });
});
$('#coinChip').addEventListener('pointerdown', e => e.stopPropagation());
$('#coinChip').addEventListener('click', () => M.shop());
M.onChange(() => { $('#coinN').textContent = M.coins(); paintTop(); });

// ------------------------------------------------------------------ cards + sheets
const STAR_SVG = '<svg viewBox="0 0 64 64"><path d="M32 4l8.2 17.6 19.3 2.3-14.2 13.2 3.7 19.1L32 46.6 15 56.2l3.7-19.1L4.5 23.9l19.3-2.3z" fill="#ffc94a" stroke="#5b2a4e" stroke-width="4" stroke-linejoin="round"/><path d="M24 22l8-14 3 12z" fill="#fff" opacity=".55"/></svg>';
const COIN = '<svg class="coin" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="#ffc94a" stroke="#b9780b" stroke-width="2.5"/><circle cx="16" cy="16" r="8.5" fill="none" stroke="#fff3c4" stroke-width="2"/><path d="M13 11h5a3 3 0 0 1 0 6h-4a3 3 0 0 0 0 6h5" fill="none" stroke="#b9780b" stroke-width="2.4" stroke-linecap="round"/></svg>';
const SVG = {
  sound: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#ffc94a" stroke="#5b2a4e" stroke-width="2" stroke-linejoin="round"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" stroke="#5b2a4e" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg>',
  mute: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#ccc" stroke="#5b2a4e" stroke-width="2" stroke-linejoin="round"/><path d="M17 9l5 6M22 9l-5 6" stroke="#5b2a4e" stroke-width="2.4" stroke-linecap="round"/></svg>',
};
const ICON = {}, BCOL = { undo: '#ff8a3d', wand: '#9b6bff', shuffle: '#3aa7f0', cart: '#ff4f8b' };
for (const b of document.querySelectorAll('.bst')) ICON[b.dataset.k] = `<svg viewBox="-3 -3 38 38" style="background:${BCOL[b.dataset.k]};border-radius:9px">${b.querySelector('svg').innerHTML}</svg>`;
function sheet(html, cls = '') {
  const w = document.createElement('div'); w.className = 'sh-wrap ' + cls; w.innerHTML = `<div class="sh">${html}</div>`;
  w.addEventListener('pointerdown', e => { e.stopPropagation(); if (e.target === w) w.remove(); });
  document.body.appendChild(w); snd.tap(); return w;
}
let shareBtn = null;
function buildCards() {
  ui.els.win.id = 'winCard'; ui.els.lose.id = 'loseCard'; ui.els.start.id = 'startCard';
  const w = ui.els.win;
  w.querySelector('h1').innerHTML = 'Well stocked!';
  w.querySelector('h1').insertAdjacentHTML('afterend', '<div class="burst"></div><div class="stars"></div><div class="reward"></div><p id="streakL"></p><div class="btnrow"><button class="hc-btn dbl" id="dbl"></button><button class="hc-btn grid hc-hidden" id="grid">Share grid</button></div>');
  w.querySelector('.hint').textContent = 'Tap to continue';
  const dbl = w.querySelector('#dbl');
  dbl.addEventListener('pointerdown', e => e.stopPropagation());
  dbl.addEventListener('click', async e => { e.stopPropagation(); dbl.disabled = true; if (await M.rewarded('double', { what: `${winCoins * 2} coins instead of ${winCoins}` })) { M.add(winCoins, 'double'); $('#wc').textContent = '+' + winCoins * 2; dbl.innerHTML = '✓ Doubled!'; snd.coin(); } else dbl.disabled = false; });
  const gb = w.querySelector('#grid');
  gb.addEventListener('pointerdown', e => e.stopPropagation());
  gb.addEventListener('click', e => { e.stopPropagation(); shareGrid(); });
  const l = ui.els.lose;
  l.querySelector('h1').insertAdjacentHTML('afterend', '<div class="sadshelf"></div>');
  l.querySelector('[data-x]').insertAdjacentHTML('afterend', '<button class="hc-btn rev" id="rev">▶ Extra shelf <small>watch a video</small></button>');
  l.querySelector('.hint').textContent = 'Tap to try again';
  const rev = l.querySelector('#rev'); rev.addEventListener('pointerdown', e => e.stopPropagation());
  rev.addEventListener('click', async e => { e.stopPropagation(); rev.disabled = true; if (!(await revive())) rev.disabled = false; });
  setTimeout(() => { shareBtn = [...w.querySelectorAll('.hc-btn')].find(b => b.textContent === 'Share'); if (shareBtn) w.querySelector('.btnrow').appendChild(shareBtn); }, 0);
}
function shareGrid() {
  const st = starsFor(Lv.moves);
  const row = Lv.triples.map(m => m <= 2 ? '🟩' : m <= 4 ? '🟨' : '🟧');
  const lines = []; for (let i = 0; i < row.length; i += 8) lines.push(row.slice(i, i + 8).join(''));
  const d = new Date(), text = `Shelfie Daily ${d.getMonth() + 1}/${d.getDate()} ${'⭐'.repeat(st)}\n${lines.join('\n')}\n${Lv.moves} moves · 🔥${save.dStreak}`;
  const url = location.origin + location.pathname + '?daily=1';
  if (navigator.share) navigator.share({ title: NAME, text, url }).catch(() => {});
  else navigator.clipboard?.writeText(`${text}\n${url}`).then(() => toast('Copied!', true)).catch(() => {});
}
const ymd = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const addDays = k => { const d = new Date(); d.setDate(d.getDate() + k); return d; };
function isoWeek(d = new Date()) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return t.getUTCFullYear() + '-' + Math.ceil(((t - y0) / 864e5 + 1) / 7); }

// lives
function livesSheet() {
  const L = M.lives(), mins = Math.max(0, Math.ceil((L.nextAt - Date.now()) / 60000));
  const w = sheet(`<div class="sh-ic big">💗</div><h3>Out of lives</h3><p>Next life in ${mins} min. The daily puzzle is always free.</p>
    <button class="big green" data-a="ad">▶ Watch a video: refill lives</button><button class="x" data-a="daily">Play the daily puzzle</button>`);
  w.addEventListener('click', async e => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return; w.remove();
    if (a === 'ad') { if (await M.rewarded('lives')) { paintTop(); toast('Lives full!', true); } }
    if (a === 'daily') location.search = '?daily=1';
  });
}

// album
function openAlbum() {
  let page = SHOPS.indexOf(curShop) >= 0 ? SHOPS.indexOf(curShop) : 0;
  const w = sheet('', 'album');
  const draw = () => {
    const shop = SHOPS[page], got = shop.goods.filter(g => save.album.includes(g[0])).length, done = got === shop.goods.length, claimed = save.pages.includes(shop.key);
    w.querySelector('.sh').innerHTML = `<h3>Sticker album</h3><div class="tabs">${SHOPS.map((s, i) => `<button data-p="${i}" class="${i === page ? 'on' : ''}">${s.name}</button>`).join('')}</div>
      <p>${got}/${shop.goods.length} stickers · fill the page for ${COIN}150</p>
      <div class="stickers">${shop.goods.map(([id, n]) => `<div class="st ${save.album.includes(id) ? 'got' : ''}"><img src="assets/thumbs/${id}.webp" alt=""><span>${save.album.includes(id) ? n : '?'}</span></div>`).join('')}</div>
      ${done && !claimed ? '<button class="big gold" data-a="claim">Claim 150 coins</button>' : ''}<button class="x" data-a="x">Close</button>`;
  };
  draw();
  w.addEventListener('click', e => {
    const p = e.target.closest('[data-p]'); if (p) { page = +p.dataset.p; snd.tap(); draw(); return; }
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'x') w.remove();
    if (a === 'claim') { save.pages.push(SHOPS[page].key); persist(); M.add(150, 'album'); snd.coin(); draw(); }
  });
}

// ------------------------------------------------------------------ home (shop restore meta)
function homeShop() { return SHOPS.find(s => (save.decor[s.key] || 0) < s.decor.length) || shopOfLevel(save.level); }
async function showHome(fromWin = false) {
  mode = 'home'; state = 'ready'; snd.music(false);
  $('#hud').classList.add('off'); $('#boosters').classList.add('off');
  ui.hideStart(); $('#homeUI').classList.remove('off');
  const shop = homeShop(); applyShop(shop);
  await fillDisplay(shop);
  placeHost(); host?.play('idle');
  renderHome();
  if (fromWin && host) setTimeout(() => say(['Lovely work!', 'The shelves look great!', 'Customers will love it!', 'So tidy!'][(Math.random() * 4) | 0]), 500);
}
function hideHome() { $('#homeUI').classList.add('off'); bubbleEl?.remove(); bubbleEl = null; }
async function fillDisplay(shop) {
  // a fully stocked 3×3 display: each shelf sorted into three alike
  clearObjs(); G.key = '';
  const ids = shop.goods.slice(0, innerWidth / innerHeight < 0.85 ? 6 : 9).map(g => g[0]);
  const ts = await Promise.all(ids.map(piece));
  const pg = innerWidth / innerHeight < 0.85; buildCabinet(pg ? 6 : 9, [], pg ? { cols: 2, rows: 3 } : { cols: 3, rows: 3 });
  ids.forEach((id, ci) => { const t = ts[ci]; if (!t) return; SYNC[id] = t; instFor(t); for (let s = 0; s < 3; s++) { const o = { id, t, comp: ci, layer: 0, slot: s, p: slotPos(ci, s, 0), s: t.fit, dark: 1, yawJ: (s - 1) * 0.12, mode: 'rest', squash: 0, delay: 0 }; Lv.objs.push(o); } });
  placeDecor(); layoutCamera(true);
}
function paintTop() {
  const L = M.lives();
  for (const el of document.querySelectorAll('.coinsN')) el.textContent = M.coins();
  $('#livesN').textContent = L.n; $('#livesT').textContent = L.n >= L.max ? 'Full' : `${Math.max(0, Math.ceil((L.nextAt - Date.now()) / 60000))}m`;
  $('#starsN').textContent = starBank();
}
function renderHome() {
  paintTop();
  const shop = curShop, n = save.decor[shop.key] || 0, done = n >= shop.decor.length;
  const task = shop.decor[n];
  $('#taskCard').innerHTML = done
    ? `<div class="tk-ic"><img src="assets/thumbs/${shop.icon}.webp" alt=""></div><div class="tk-t"><b>${shop.name} restored!</b><small>All of Main Street is shining</small></div>`
    : `<div class="tk-ic"><img src="assets/thumbs/${task.id}.webp" alt=""></div><div class="tk-t"><small>${shop.name} makeover · ${n}/${shop.decor.length}</small><b>${task.name}</b><i class="tk-bar"><em style="width:${n / shop.decor.length * 100}%"></em></i></div>
       <button id="place" class="${starBank() >= task.cost ? 'ready' : ''}">${STAR_SVG}<span>${task.cost}</span></button>`;
  const pb = $('#place'); if (pb) { pb.addEventListener('pointerdown', e => e.stopPropagation()); pb.addEventListener('click', placeTask); }
  const nxt = save.level, hard = !D.isDaily && LV.plan(nxt).hard;
  $('#playBtn').innerHTML = D.isDaily ? (save.dDone === D.seed ? 'Daily solved ✓' : 'Play Daily Puzzle') : `Level ${nxt}${hard ? '<i class="hardtag">HARD</i>' : ''}`;
  $('#streakChip').textContent = save.dStreak > 0 ? `🔥${save.dStreak}` : '';
  $('#albumN').textContent = `${save.album.length}/${ALL_GOODS.length}`;
}
async function placeTask() {
  const shop = curShop, n = save.decor[shop.key] || 0, task = shop.decor[n]; if (!task) return;
  if (starBank() < task.cost) { snd.deny(); toast(`Win levels to earn ★${task.cost}`, true); const b = $('#playBtn'); b.classList.remove('nudge'); void b.offsetWidth; b.classList.add('nudge'); return; }
  save.spent += task.cost; save.decor[shop.key] = n + 1; persist();
  await placeDecor(task.id);
  const m = DECOR[task.id]; const p = m ? m.position.clone().add(new V3(0, task.size * 0.4, 0)) : new V3();
  snd.win(); buzz([10, 30, 10]); sparkle(p, '#ffd36b', 50, 3.2); sparkle(p, '#fff', 20, 2); ring(p, 2.4);
  host?.play('cheer', true); say(['Gorgeous!', 'I love it!', 'Perfect spot!', 'So pretty!', 'Dreamy!'][(Math.random() * 5) | 0]);
  if (n + 1 >= shop.decor.length) { setTimeout(() => { confetti(scene, new V3(0, 5, 2), 90); toast(`${shop.name} restored!`); M.add(300, 'shop-restored'); snd.sticker(); }, 700); setTimeout(() => showHome(), 3200); }
  renderHome();
}
$('#playBtn').addEventListener('click', () => { snd.unlock(); if (D.isDaily && save.dDone === D.seed) { toast('Come back tomorrow!', true); return; } startLevel(); });
$('#albumBtn').addEventListener('click', () => openAlbum());
$('#dailyBtn').addEventListener('click', () => { location.search = D.isDaily ? '' : '?daily=1'; });
$('#shopBtn').addEventListener('click', () => M.shop());
$('#topCoins').addEventListener('click', () => M.shop());
$('#topLives').addEventListener('click', () => { const L = M.lives(); if (L.n < L.max) livesSheet(); });
for (const el of document.querySelectorAll('#homeUI button, #homeUI .chip')) el.addEventListener('pointerdown', e => e.stopPropagation());
if (D.isDaily) $('#dailyBtn').querySelector('span').textContent = 'Levels';

function showTutorial() {
  if (state !== 'play' || Lv.n !== 1) return;
  // point from one item to the shelf where it completes a set
  const m = LV.greedy(LV.clone(view()), () => 0.5); if (!m) return;
  const o = Lv.comps[m.a].L[0][m.sa]; if (!o) return;
  const a = slotPos(m.a, m.sa, 0).add(new V3(0, o.t.h * 0.5, 0.3)).project(camera), b = slotPos(m.b, m.sb, 0).add(new V3(0, o.t.h * 0.5, 0.3)).project(camera);
  const px = v => ({ x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight });
  const A = px(a), Bp = px(b);
  const h = document.createElement('div'); h.className = 'tut'; h.innerHTML = '<div class="hand">👆</div><div class="tut-t">Drag 3 alike onto one shelf</div>';
  h.style.setProperty('--ax', A.x + 'px'); h.style.setProperty('--ay', A.y + 'px'); h.style.setProperty('--bx', Bp.x + 'px'); h.style.setProperty('--by', Bp.y + 'px');
  document.body.appendChild(h);
  const off = () => { h.remove(); removeEventListener('pointerdown', off, true); };
  addEventListener('pointerdown', off, true); setTimeout(off, 9000);
}

// ------------------------------------------------------------------ camera
const camGoal = { pos: new V3(0, 6, 30), look: new V3(0, 4, 0) }, camLook = new V3(0, 4, 0);
function layoutCamera(snap = false) {
  const w = innerWidth, h = innerHeight, portrait = w / h < 0.85;
  camera.aspect = w / h;
  let x0, x1, y0, y1, top, bot;
  if (mode === 'home') {
    const span = portrait ? 4.5 : 6.6; x0 = -span; x1 = span; y0 = -0.2; y1 = G.signTop + (portrait ? 0.3 : 2.2);
    top = portrait ? 150 : 90; bot = portrait ? 244 : 30;
  } else {
    x0 = -G.W / 2 - 0.55; x1 = G.W / 2 + 0.55; y0 = PLINTH - 0.3; y1 = G.signTop + 0.1;
    top = portrait ? 122 : 92; bot = portrait ? 104 : 100;
  }
  if (mode !== 'home' && !portrait) { x0 -= 3.6; x1 += 0.6; }
  const right = mode === 'home' && !portrait && w >= 900 ? 470 : 0, left = mode === 'home' && !portrait && w >= 900 ? 40 : 0;
  const availW = w - (portrait ? 16 : right ? 20 : 120) - right - left, availH = h - top - bot;
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const needH = (y1 - y0) * h / availH, needW = (x1 - x0) * w / availW;
  const visH = Math.max(needH, needW / camera.aspect);
  const d = visH / 2 / tanV + ZF + 0.6;
  const cy = (y0 + y1) / 2, cx = (x0 + x1) / 2 - ((left + (w - right)) / 2 - w / 2) * (Math.max(needH, needW / camera.aspect)) / h;
  const off = ((top + (h - bot)) / 2 - h / 2) * visH / h;     // shift so the rect centres in the free band
  const pitch = mode === 'home' ? 0.12 : 0.06;
  const lookY = cy + off;
  camGoal.look.set(cx, lookY, ZF);
  camGoal.pos.set(cx, lookY + Math.sin(pitch) * d, ZF + Math.cos(pitch) * d);
  if (snap) { camera.position.copy(camGoal.pos); camLook.copy(camGoal.look); camera.lookAt(camLook); }
  camera.updateProjectionMatrix();
}
function resize() { R.setSize(innerWidth, innerHeight); C.resize(innerWidth, innerHeight); if (mode === 'play') { G.key = ''; buildCabinet(Lv.comps.length, Lv.comps.map(c => c.extra)); } else layoutCamera(true); placeHost(); }
addEventListener('resize', resize);

// ------------------------------------------------------------------ frame loop
const _t = new V3(), _m = new M4(), _q = new Q4(), _s = new V3(), _col = new THREE.Color(), _e = new THREE.Euler(), UPY = new V3(0, 1, 0);
const DARK = new THREE.Color('#3a2c44');
let lastT = performance.now(), fpsAcc = 0, fpsN = 0, perfS = {};
R.info.autoReset = false;
function frame(now) {
  const dt = Math.min(1 / 30, (now - lastT) / 1000); lastT = now;
  if (state === 'play' && Lv.comboT > 0) Lv.comboT -= dt;
  updateObjects(dt);
  // drag target highlight
  if (drag && drag.moved && drag.x != null) {
    const p = planeAt(drag.x, drag.y, ZF, _p), ci = compAt(p);
    if (ci >= 0 && ci !== drag.o.comp) { const c = G.cells[ci]; hl.position.set(c.x, c.y + CH / 2, DEPTH / 2 + 0.05); hl.material.color.set(canDrop(ci, drag.o.comp) ? '#7dffc4' : '#ff7d9a'); hl.material.opacity = 0.9; }
    else hl.material.opacity = Math.max(0, hl.material.opacity - dt * 6);
  } else if (selected) { const c = G.cells[selected.comp]; hl.position.set(c.x + selected.slot - 1, c.y + CH / 2, DEPTH / 2 + 0.05); hl.scale.set(0.36, 1, 1); hl.material.color.set('#ffe27d'); hl.material.opacity = 0.6 + Math.sin(now / 150) * 0.3; }
  else hl.material.opacity = Math.max(0, hl.material.opacity - dt * 6);
  if (!selected) hl.scale.set(1, 1, 1);
  // camera ease
  const k = 1 - Math.exp(-dt * 5);
  camera.position.lerp(camGoal.pos, k); camLook.lerp(camGoal.look, k); camera.lookAt(camLook);
  // décor pop-in
  for (const id in DECOR) { const m = DECOR[id]; if (m.userData.pop != null) { m.userData.pop += dt / 0.7; const e = easeBack(m.userData.pop); m.scale.setScalar(Math.max(0.01, e)); m.position.y += 0; if (m.userData.pop >= 1) { m.userData.pop = null; m.scale.setScalar(1); } } }
  if (host) { host.mixer.update(dt); placeBubble(dt); }
  updSparks(dt); updRings(dt); updateParticles(dt * 60);
  R.info.reset(); C.render(dt); perfS = { calls: R.info.render.calls, tris: R.info.render.triangles };
  fpsAcc += dt; fpsN++;
  requestAnimationFrame(frame);
}
function updateObjects(dt) {
  for (const id in SYNC) { const t = SYNC[id]; if (t && t.inst) t.inst.count = 0; }
  const now = performance.now() / 1000;
  for (const o of Lv.objs) {
    if (o.mode === 'gone') continue;
    if (o.delay > 0) { o.delay -= dt; if (o.mode !== 'drop') { draw(o, now); continue; } }
    slotPos(o.comp, o.slot, o.layer, _t);
    const wantDark = o.layer === 0 ? 1 : o.layer === 1 ? 0.06 : 0;
    if (o.mode === 'drop') {
      if (o.delay > 0) { draw(o, now, true); continue; }
      o.v -= 40 * dt; o.p.y += o.v * dt; o.p.x = _t.x; o.p.z = _t.z;
      if (o.p.y <= _t.y) { o.p.y = _t.y; if (o.v < -3) { o.v = -o.v * 0.25; o.squash = 1; } else { o.mode = 'rest'; o.v = 0; } }
    } else if (o.mode === 'rest') {
      const kk = 1 - Math.exp(-dt * 14); o.p.lerp(_t, kk);
      if (o.hop > 0) { o.hop = Math.max(0, o.hop - dt * 3); }
    } else if (o.mode === 'fly') {
      o.tp += dt / 0.24; if (o.tp < 0) { draw(o, now); continue; }
      const k = ease(o.tp), a = 1 - k;
      _p.lerpVectors(o.from, _t, 0.5); _p.y += o.lift + 0.3; _p.z += 0.6;
      o.p.set(0, 0, 0).addScaledVector(o.from, a * a).addScaledVector(_p, 2 * a * k).addScaledVector(_t, k * k);
      if (o.tp >= 1) { o.mode = 'rest'; o.p.copy(_t); o.squash = 1; snd.land(o.slot); }
    } else if (o.mode === 'drag') {
      if (drag && drag.o === o && drag.x != null) { planeAt(drag.x, drag.y, ZF + 0.7, _p); _p.y -= o.t.h * 0.45; o.p.lerp(_p, 1 - Math.exp(-dt * 30)); }
      else o.p.lerp(_t.clone().add(new V3(0, 0.15, 0.4)), 1 - Math.exp(-dt * 20));
    } else if (o.mode === 'pop') {
      o.tp += dt / 0.5;
      if (o.tp < 0) { if (!o.from) o.p.lerp(_t, 1 - Math.exp(-dt * 14)); draw(o, now); continue; }
      if (!o.from) { o.from = o.p.clone(); }
      const mid = slotPos(o.comp, 1, 0); mid.y = o.from.y;
      const k = o.tp;
      if (k < 0.45) { const u = k / 0.45; o.p.copy(o.from); o.p.y += Math.sin(u * Math.PI / 2) * 0.45; o.p.z += u * 0.35; o.popS = 1 + u * 0.25; }
      else { const u = ease((k - 0.45) / 0.55); o.p.lerpVectors(o.from, mid, u); o.p.y += 0.45 - u * 0.1; o.p.z += 0.35; o.popS = 1.25 * (1 - u * u); }
      if (k >= 1) { o.mode = 'gone'; continue; }
    } else if (o.mode === 'wand') {
      o.tp += dt / 0.6; const k = ease(o.tp);
      o.p.lerpVectors(o.from, o.to, k); o.p.y += Math.sin(k * Math.PI) * 0.8; o.popS = 1 + Math.sin(k * Math.PI) * 0.35; o.dark = THREE.MathUtils.lerp(o.dark0, 1, k);
      if (o.tp >= 1) { o.mode = 'gone'; continue; }
    }
    if (o.mode !== 'wand') o.dark += (wantDark - o.dark) * (1 - Math.exp(-dt * 8));
    if (o.squash > 0) o.squash = Math.max(0, o.squash - dt * 4.5);
    draw(o, now);
  }
  for (const id in SYNC) { const t = SYNC[id]; if (t && t.inst) { t.inst.instanceMatrix.needsUpdate = true; if (t.inst.instanceColor) t.inst.instanceColor.needsUpdate = true; } }
}
function draw(o, now, hidden = false) {
  const t = o.t, inst = t.inst; if (!inst || inst.count >= 12) return;
  if (hidden) return;
  if (o.layer >= 2 && o.mode === 'rest' && o.dark < 0.02) return;
  let sc = o.s;
  if (o.mode === 'drag') sc *= 1.18;
  if (o.layer >= 1 && o.mode === 'rest') sc *= 0.9;
  if (o.popS) sc *= o.popS;
  if (o.mode !== 'pop' && o.mode !== 'wand') o.popS = 0;
  const sq = o.squash ? Math.sin(o.squash * Math.PI) * 0.18 : 0;
  const hop = o.hop > 0 ? Math.sin(o.hop * Math.PI) * 0.22 : 0;
  const sel = selected === o ? Math.abs(Math.sin(now * 6)) * 0.12 : 0;
  _s.set(sc * (1 + sq), sc * (1 - sq), sc * (1 + sq));
  const wob = o.mode === 'drag' ? Math.sin(now * 9) * 0.08 : 0;
  _e.set(o.mode === 'drag' ? -0.15 : 0, t.yaw + o.yawJ + wob, wob * 0.5); _q.setFromEuler(_e);
  _p.copy(o.p); _p.y += hop + sel;
  _m.compose(_p, _q, _s);
  const i = inst.count++;
  inst.setMatrixAt(i, _m);
  const d = clamp(o.dark, 0, 1);
  _col.copy(DARK).lerp(new THREE.Color(1, 1, 1), d); if (o.layer >= 2 && o.mode === 'rest') _col.multiplyScalar(0.6);
  inst.setColorAt(i, _col);
}

// ------------------------------------------------------------------ bot (check.cjs): plays like a careful player
function bot() {
  if (state === 'ready') { if (!busy && mode === 'home') startLevel({ free: true }); return; }
  if (state !== 'play' || busy) return;
  if (Lv.objs.some(o => o.mode === 'fly' || o.mode === 'drop' || o.mode === 'wand' || (o.mode === 'pop' && o.tp < 0.3))) return;
  if (Lv.moves > Lv.par2 * 2 + 10 && save.boost.wand > 0 && Math.random() < 0.3) { useBooster('wand'); return; }
  const m = LV.greedy(view(), Math.random, Lv.botLast);
  if (!m) { if (save.boost.cart > 0) useBooster('cart'); return; }
  const o = Lv.comps[m.a].L[0][m.sa]; if (o) { Lv.botLast = m; doMove(o, m.b, m.sb, true); }
}
window.__game = {
  get state() { return state; }, get level() { return Lv.daily ? 'daily' : save.level; }, get score() { return totalStars(); },
  get moves() { return Lv.moves; }, get mode() { return mode; },
  bot, start: startLevel, use: useBooster, money: M, revive, screenOf: (ci, s) => { const v = slotPos(ci, s, 0).add(new V3(0, 0.4, 0)).project(camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; },
  get debug() { return { Lv, G, view, save, loseLevel, winLevel }; },
  get perf() { const r = { ...perfS, fps: fpsN / Math.max(0.001, fpsAcc) }; fpsN = 0; fpsAcc = 0; return r; },
};

// ------------------------------------------------------------------ boot
paintMute();
applyShop(homeShop());
loadHost();
requestAnimationFrame(frame);
showHome();
