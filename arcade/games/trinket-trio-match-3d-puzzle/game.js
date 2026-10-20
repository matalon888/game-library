// Trinket Trio: Match 3D — tap trinkets from a tumbling heap in a velvet trinket box into a 7-slot tray; three alike pop.
// Clear the goals before the tray fills or the timer runs out. Mechanic inspired by Match Factory (Peak); all code original,
// art = the AGENTPARK AI 3D library (assets/cozy). Rendering: kit/cine.js; physics: ./physics.js (sphere-cluster bodies).
import { THREE, createUI, store, rng, buzz, confetti, updateParticles } from './kit/hc.js';
import { cine } from './kit/cine.js';
import { GLTFLoader } from './kit/addons/loaders/GLTFLoader.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { World } from './physics.js';
import { snd } from './audio.js';
import { ITEMS, BY_ID, CHAPTERS, chapterOf } from './items.js';
import { quilt, wood, wallpaper, blob } from './tex.js';

const V3 = THREE.Vector3, Q4 = THREE.Quaternion, M4 = THREE.Matrix4;
const NAME = 'Trinket Trio: Match 3D Puzzle';
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const TRAY = 7, BOX = { W: 7, D: 9.6 }, PITCH = 58 * Math.PI / 180;

// ------------------------------------------------------------------ save + meta
const S = store('trinkettrio');
const save = {
  level: S.get('level', 1), stars: S.get('stars', {}), boost: S.get('boost', { undo: 2, magnet: 2, shuffle: 2, freeze: 2 }),
  found: S.get('found', []), dailyWon: S.get('dailyWon', 0),
};
const persist = () => { for (const k in save) S.set(k, save[k]); };
const totalStars = () => Object.values(save.stars).reduce((a, b) => a + b, 0);

// ------------------------------------------------------------------ kit layers
const ui = createUI({ title: 'Trinket Trio', hint: '', hand: '', progress: false, score: false });
const F = flow('trinkettrio');
buildHomeShell();
const D = daily('trinkettrio', ui, { name: NAME });
const B = board({ game: 'trinket-trio', label: 'Stars won', mode: 'sum', limits: { maxRun: 6, maxPerSec: 2 }, corner: 'tl', accent: '#ff6fa0' });

// ------------------------------------------------------------------ renderer / scene
const R = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
R.domElement.className = 'hc-canvas'; document.body.prepend(R.domElement);
R.setPixelRatio(Math.min(devicePixelRatio, 2)); R.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#f3cdb6');
const camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.5, 120);
const C = cine(R, scene, camera, { bloom: 0, exposure: 0.96, envIntensity: 0.5,
  grade: { sat: 1.15, contrast: 1.04, vignette: 0.1, grain: 0, tint: '#fffaf4' } });
const LITE = C.lite;
window.__dbg = { C, scene, R, camera };

const hemi = new THREE.HemisphereLight('#fff6ec', '#f2c2a8', 0.7); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff0dc', 2.7); sun.position.set(-6, 15, 5); sun.castShadow = true;
sun.shadow.mapSize.set(LITE ? 1024 : 2048, LITE ? 1024 : 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4;
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 2, far: 40 }); scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight('#ffd9e6', 0.55); fill.position.set(6, 5, 12); scene.add(fill);

// ------------------------------------------------------------------ room + trinket box
const feltMat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, bumpScale: 2.2 });
const feltMat2 = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, bumpScale: 2.2 });
const lacquer = new THREE.MeshStandardMaterial({ color: '#ffc4d6', roughness: 0.3, metalness: 0.02 });
const cream = new THREE.MeshStandardMaterial({ color: '#fff1e4', roughness: 0.4, metalness: 0.02 });
const goldM = new THREE.MeshStandardMaterial({ color: '#ffcf6b', roughness: 0.28, metalness: 0.85 });
const roseM = new THREE.MeshStandardMaterial({ color: '#ff9fbf', roughness: 0.4, metalness: 0.05 });
let RBG = null;
function roundedBox(w, h, d, r) { return RBG ? new RBG(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d); }

const room = new THREE.Group(); scene.add(room);
const boxG = new THREE.Group(); scene.add(boxG);
async function buildRoom() {
  RBG = (await import('./kit/addons/geometries/RoundedBoxGeometry.js')).RoundedBoxGeometry;
  // table
  const tw = wood('#d39a6a'); tw.repeat.set(4, 4);
  const table = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), new THREE.MeshStandardMaterial({ map: tw, roughness: 0.55, metalness: 0 }));
  table.rotation.x = -Math.PI / 2; table.position.y = -0.62; table.receiveShadow = true; room.add(table);
  // back wall with wallpaper, wainscoting and a window of soft light
  const wp = wallpaper(); wp.repeat.set(10, 4);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(80, 26), new THREE.MeshStandardMaterial({ map: wp, roughness: 0.9 }));
  wall.position.set(0, 12, -16); room.add(wall);
  const wain = new THREE.Mesh(new THREE.BoxGeometry(80, 5, 0.4), new THREE.MeshStandardMaterial({ color: '#f7e2d2', roughness: 0.6 }));
  wain.position.set(0, 1.9, -15.8); room.add(wain);
  for (let i = -9; i <= 9; i++) { const p = new THREE.Mesh(roundedBox(3.2, 3.2, 0.3, 0.12), lacquer); p.position.set(i * 4, 1.9, -15.5); room.add(p); }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(80, 0.35, 0.7), goldM); rail.position.set(0, 4.5, -15.6); room.add(rail);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(9, 8), new THREE.MeshBasicMaterial({ color: '#fffaf0' }));
  win.position.set(-8, 11, -15.9); room.add(win);
  const frameM = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 });
  for (const [w, h, x, y] of [[9.8, 0.5, -8, 15.1], [9.8, 0.5, -8, 6.9], [0.5, 8.4, -12.7, 11], [0.5, 8.4, -3.3, 11], [9, 0.3, -8, 11], [0.3, 8, -8, 11]]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.4), frameM); f.position.set(x, y, -15.7); room.add(f);
  }
  // light shaft from the window across the table
  const shaft = new THREE.Mesh(new THREE.PlaneGeometry(8, 26), new THREE.MeshBasicMaterial({ color: '#fff3d6', transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  shaft.position.set(-12, 5, -8); shaft.rotation.set(-1.05, 0.35, 0.1); room.add(shaft);

  // the trinket box: velvet floor, lacquered walls with gold rims, an open mirror lid behind
  const { W, D } = BOX, t = 0.5, hS = 1.25, hF = 0.62, hB = 1.5;
  const q = quilt('#9fdcc9', '#7cc7b2', 7); q.map.repeat.set(1, D / W); q.bump.repeat.set(1, D / W);
  feltMat.map = q.map; feltMat.bumpMap = q.bump; feltMat.needsUpdate = true;
  const q2 = quilt('#ffb3c9', '#f598b5', 5); q2.map.repeat.set(1, 5.4 / (W - 0.4)); q2.bump.repeat.set(1, 5.4 / (W - 0.4)); feltMat2.map = q2.map; feltMat2.bumpMap = q2.bump;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), feltMat); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; boxG.add(floor);
  const base = new THREE.Mesh(roundedBox(W + 2 * t + 0.2, 0.62, D + 2 * t + 0.2, 0.2), lacquer); base.position.y = -0.335; base.receiveShadow = true; base.castShadow = true; boxG.add(base);
  const plinth = new THREE.Mesh(roundedBox(W + 2 * t + 0.6, 0.18, D + 2 * t + 0.6, 0.08), cream); plinth.position.y = -0.55; boxG.add(plinth);
  const wallM = lacquer, inner = new THREE.MeshStandardMaterial({ color: '#7cc7b2', roughness: 0.9 });
  const walls = [
    [t, hS, D + 2 * t, -W / 2 - t / 2, 0], [t, hS, D + 2 * t, W / 2 + t / 2, 0],
    [W, hB, t, 0, -D / 2 - t / 2], [W, hF, t, 0, D / 2 + t / 2],
  ];
  for (const [w, h, d, x, z] of walls) {
    const m = new THREE.Mesh(roundedBox(w, h, d, 0.16), wallM); m.position.set(x, h / 2, z); m.castShadow = true; m.receiveShadow = true; boxG.add(m);
    const rim = new THREE.Mesh(roundedBox(w + 0.12, 0.16, d + 0.12, 0.07), goldM); rim.position.set(x, h + 0.02, z); boxG.add(rim);
  }
  // rose band around the outside
  for (const [w, d, x, z] of [[W + 2 * t + 0.04, 0.06, 0, D / 2 + t + 0.01], [0.06, D + 2 * t, -W / 2 - t - 0.01, 0], [0.06, D + 2 * t, W / 2 + t + 0.01, 0]]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22, d), roseM); band.position.set(x, -0.2, z); boxG.add(band);
  }
  // corner finials
  for (const [x, z, h] of [[-1, -1, hB], [1, -1, hB], [-1, 1, hF], [1, 1, hF]]) {
    const k = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 14), goldM); k.position.set(x * (W / 2 + t / 2), Math.max(h, hS) + 0.3, z * (D / 2 + t / 2)); k.castShadow = true; boxG.add(k);
  }
  // open lid with a mirror, leaning back behind the box
  const lid = new THREE.Group(); lid.position.set(0, hB, -D / 2 - t); lid.rotation.x = -0.32; boxG.add(lid);
  const lidB = new THREE.Mesh(roundedBox(W + 2 * t + 0.2, 6.4, 0.5, 0.2), lacquer); lidB.position.set(0, 3.2, -0.25); lidB.castShadow = true; lid.add(lidB);
  const lidF = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.4, 5.4), feltMat2);
  lidF.position.set(0, 3.2, 0.03); lid.add(lidF);
  for (const [w, h, x, y] of [[W - 0.1, 0.18, 0, 0.45], [W - 0.1, 0.18, 0, 5.95], [0.18, 5.6, -(W - 0.3) / 2, 3.2], [0.18, 5.6, (W - 0.3) / 2, 3.2]]) {
    const f = new THREE.Mesh(roundedBox(w, h, 0.16, 0.07), goldM); f.position.set(x, y, 0.08); lid.add(f);
  }
  boxG.userData = { floor, inner };

  // a few décor props on the table (visible on wider screens): bouquet, bonsai, espresso machine, chalkboard, bistro table
  const decor = [['g05', 3.2, -7.6, -4.5, 0.4], ['g06', 3.0, 7.8, -5.4, -0.5], ['f10', 3.2, 8.4, 2.8, -0.7], ['f13', 4.2, -8.8, 3.6, 0.5], ['g09', 1.7, -6.7, 6.9, 0.9], ['f05', 1.6, 6.9, 7.4, -0.3]];
  const bl = new THREE.MeshBasicMaterial({ map: blob(), transparent: true, depthWrite: false });
  for (const [id, s, x, z, ry] of decor) {
    loadType(id).then(t => {
      if (!t) return;
      const m = new THREE.Mesh(t.geo, t.mat); m.matrixAutoUpdate = false;
      const mm = new M4().compose(new V3(x, -0.62, z), new Q4().setFromAxisAngle(new V3(0, 1, 0), ry), new V3(s, s, s)).multiply(t.M);
      m.matrix.copy(mm); m.castShadow = true; room.add(m);
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(s * 1.3, s * 1.3), bl); sh.rotation.x = -Math.PI / 2; sh.position.set(x, -0.6, z); room.add(sh);
    });
  }
}

// ------------------------------------------------------------------ model library (lazy)
const loader = new GLTFLoader();
const TYPES = {};
function loadType(id) {
  if (TYPES[id]) return TYPES[id];
  return TYPES[id] = loader.loadAsync(`assets/${id}.glb`).then(g => {
    let mesh = null; g.scene.updateMatrixWorld(true); g.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
    if (!mesh) return null;
    const geo = mesh.geometry, mat = mesh.material, M = mesh.matrixWorld.clone();
    mat.side = THREE.FrontSide; mat.envMapIntensity = 1.1;
    geo.computeBoundingBox(); const bb = geo.boundingBox.clone().applyMatrix4(M);
    const size = bb.getSize(new V3()), center = bb.getCenter(new V3());
    const base = new M4().makeTranslation(-center.x, -center.y, -center.z).multiply(M);
    const tris = (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
    return { id, geo, mat, M, size, center, base, tris, pile: null, tray: null };
  }).catch(e => { console.warn('missing model', id, e && e.message); return null; });
}
function meshesFor(t) {
  if (!t.pile) {
    t.pile = new THREE.InstancedMesh(t.geo, t.mat, 9); t.pile.castShadow = true; t.pile.receiveShadow = true;
    t.tray = new THREE.InstancedMesh(t.geo, t.mat, 9);
    for (const m of [t.pile, t.tray]) { m.frustumCulled = false; m.count = 0; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); }
  }
}

// ------------------------------------------------------------------ sparkles (additive points) + ring flashes
const SPN = 360, spPos = new Float32Array(SPN * 3), spCol = new Float32Array(SPN * 3), spV = new Float32Array(SPN * 3), spL = new Float32Array(SPN), spC = new Float32Array(SPN * 3);
const spGeo = new THREE.BufferGeometry(); spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3)); spGeo.setAttribute('color', new THREE.BufferAttribute(spCol, 3));
const starTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(32, 2); x.lineTo(36, 28); x.lineTo(62, 32); x.lineTo(36, 36); x.lineTo(32, 62); x.lineTo(28, 36); x.lineTo(2, 32); x.lineTo(28, 28); x.closePath(); x.fill(); return new THREE.CanvasTexture(c); })();
const sparks = new THREE.Points(spGeo, new THREE.PointsMaterial({ size: 0.2, map: starTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
sparks.frustumCulled = false; scene.add(sparks); spPos.fill(-999);
let spI = 0;
function sparkle(p, color, n = 24, speed = 2.2, size = 1) {
  const c = new THREE.Color(color);
  for (let k = 0; k < n; k++) {
    const i = spI = (spI + 1) % SPN, a = Math.random() * Math.PI * 2, b = Math.acos(Math.random() * 2 - 1), s = speed * (0.4 + Math.random() * 0.8);
    spPos[i * 3] = p.x; spPos[i * 3 + 1] = p.y; spPos[i * 3 + 2] = p.z;
    spV[i * 3] = Math.sin(b) * Math.cos(a) * s; spV[i * 3 + 1] = Math.cos(b) * s + speed * 0.5; spV[i * 3 + 2] = Math.sin(b) * Math.sin(a) * s;
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
const rings = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 40), new THREE.MeshBasicMaterial({ color: '#fff4c2', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); m.visible = false; scene.add(m); m.userData.t = 1; return m; });
let ringI = 0;
function ring(p, s = 1, color = '#fff4c2') { const r = rings[ringI = (ringI + 1) % rings.length]; r.position.copy(p); r.quaternion.copy(camera.quaternion); r.material.color.set(color); r.userData = { t: 0, s }; r.visible = true; }
function updRings(dt) { for (const r of rings) { if (!r.visible) continue; const u = r.userData; u.t += dt * 2.6; if (u.t >= 1) { r.visible = false; continue; } r.scale.setScalar(u.s * (0.3 + ease(u.t) * 1.2)); r.material.opacity = (1 - u.t) * 0.9; } }

// ------------------------------------------------------------------ layout: camera fit + tray in screen space
const L = { w: 0, h: 0, trayY: 0, slot: 56, wpp: 0.01, dTray: 8 };
const trayG = new THREE.Group(); scene.add(trayG);
let trayBuilt = 0;
const camTarget = new V3(0, 0.3, 0.25);
function layout() {
  const w = innerWidth, h = innerHeight; L.w = w; L.h = h;
  R.setSize(w, h); C.resize(w, h); camera.aspect = w / h;
  const portrait = w / h < 0.8;
  const sTop = 140, boostH = (w >= 700 ? 68 : 62) + 16;
  L.slot = Math.min(Math.floor((Math.min(w, 560) - 22) / TRAY), w >= 700 ? 70 : 64);
  const trayH = L.slot + 22; L.trayY = h - boostH - 12 - trayH / 2;
  const top = sTop + (portrait ? 6 : 0), bottom = L.trayY - trayH / 2 - 8;
  const availW = Math.min(w - 12, portrait ? w : 760), availH = bottom - top;
  // fit the box's outer corners into [availW × availH]
  let d = 24; camera.clearViewOffset();
  const pts = []; for (const x of [-1, 1]) for (const z of [-1, 1]) for (const y of [0, 1.2]) pts.push(new V3(x * (BOX.W / 2 + 0.6), y, z * (BOX.D / 2 + 0.6)));
  const proj = new V3();
  for (let it = 0; it < 4; it++) {
    placeCam(d); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const p of pts) { proj.copy(p).project(camera); const px = (proj.x + 1) / 2 * w, py = (1 - proj.y) / 2 * h; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
    const ratio = Math.max((x1 - x0) / availW, (y1 - y0) / availH);
    d *= ratio;
    if (it === 3) { placeCam(d); camera.updateMatrixWorld(); }
  }
  // vertical: centre the projected box in its region
  camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  let y0 = 1e9, y1 = -1e9; for (const p of pts) { proj.copy(p).project(camera); const py = (1 - proj.y) / 2 * h; y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
  const want = (top + bottom) / 2, have = (y0 + y1) / 2;
  camera.setViewOffset(w, h, 0, have - want, w, h); camera.updateProjectionMatrix();
  // tray plane: a fixed depth in front of the camera, 1 group unit = 1 CSS pixel
  L.dTray = d * 0.42; L.wpp = 2 * L.dTray * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / h;
  screenToWorld(w / 2, L.trayY, L.dTray, trayG.position); trayG.quaternion.copy(camera.quaternion); trayG.scale.setScalar(L.wpp); trayG.updateMatrixWorld(true);
  buildTray();
  sun.shadow.camera.updateProjectionMatrix();
}
function placeCam(d) { camera.position.set(camTarget.x, camTarget.y + Math.sin(PITCH) * d, camTarget.z + Math.cos(PITCH) * d); camera.lookAt(camTarget); camera.updateMatrixWorld(); camera.updateProjectionMatrix(); L.camD = d; }
const _ray = new V3(), _fwd = new V3();
function screenToWorld(px, py, depth, out) {
  _ray.set(px / L.w * 2 - 1, -(py / L.h) * 2 + 1, 0.5).unproject(camera).sub(camera.position).normalize();
  camera.getWorldDirection(_fwd); return out.copy(camera.position).addScaledVector(_ray, depth / _ray.dot(_fwd));
}
function worldToScreen(p) { const v = p.clone().project(camera); return { x: (v.x + 1) / 2 * L.w, y: (1 - v.y) / 2 * L.h }; }
const trayMat = new THREE.MeshStandardMaterial({ color: '#ffd0de', roughness: 0.35, metalness: 0.02 });
const wellMat = new THREE.MeshStandardMaterial({ color: '#fff6ee', roughness: 0.7 });
const wellGlow = new THREE.MeshStandardMaterial({ color: '#ffd6e3', roughness: 0.6, emissive: '#ff6fa0', emissiveIntensity: 0 });
function buildTray() {
  const key = L.slot + 'x' + (RBG ? 1 : 0); if (trayBuilt === key) return; trayBuilt = key;
  while (trayG.children.length) { const c = trayG.children.pop(); c.geometry.dispose(); }
  const s = L.slot, w = s * TRAY + 18, h = s + 20;
  const plate = new THREE.Mesh(roundedBox(w, h, 26, 10), trayMat); plate.position.z = -14; trayG.add(plate);
  const lip = new THREE.Mesh(roundedBox(w + 10, h + 10, 14, 6.5), goldM); lip.position.z = -22; trayG.add(lip);
  trayG.userData.wells = [];
  for (let i = 0; i < TRAY; i++) {
    const wl = new THREE.Mesh(roundedBox(s - 6, s - 4, 8, 3.5), wellMat); wl.position.set((i - (TRAY - 1) / 2) * s, 0, 0); trayG.add(wl);
    trayG.userData.wells.push(wl);
  }
}
function slotWorld(i, out) { return trayG.localToWorld(out.set((i - (TRAY - 1) / 2) * L.slot, 2, L.slot * 0.55)); }

// ------------------------------------------------------------------ level generation
const Lv = { n: 1, daily: false, objs: [], tray: [], goals: {}, goalOrder: [], time: 60, left: 60, frozen: 0, intro: 0, world: null, hist: [], combo: 0, comboT: 0, points: 0, t0: 0, matched: 0, goalTotal: 0, recorded: false };
let state = 'ready', loadingLevel = false;
function genLevel(n, seed) {
  const r = rng(seed * 7919 + 13), fk = F.k();
  const ch = n <= 50 ? CHAPTERS[chapterOf(n)] : CHAPTERS[5];
  const all = ITEMS.map(i => i.id), pool = (ch.pool || all).slice();
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const nTypes = n <= 3 ? [3, 4, 5][n - 1] : clamp(Math.round(5 + (n - 3) * 0.3), 5, 13);
  const total = n <= 3 ? [9, 12, 18][n - 1] : Math.round(clamp((18 + n * 1.35) * fk, 18, 60) / 3) * 3;
  let types = shuffle(pool).slice(0, nTypes);
  if (types.length < nTypes) types = types.concat(shuffle(all.filter(i => !types.includes(i))).slice(0, nTypes - types.length));
  if (!ch.pool && n > 50) types = shuffle(all).slice(0, nTypes);
  const copies = Object.fromEntries(types.map(t => [t, 3]));
  let sum = types.length * 3, guard = 0;
  while (sum < total && guard++ < 200) { const t = types[Math.floor(r() * types.length)]; if (copies[t] < 9) { copies[t] += 3; sum += 3; } }
  const nGoals = n <= 2 ? 2 : clamp(2 + Math.floor(n / 9), 2, 4);
  const goalTypes = shuffle(types.slice()).slice(0, nGoals);
  const goals = Object.fromEntries(goalTypes.map(t => [t, copies[t]]));
  const time = Math.round((24 + sum * 1.65) / fk / 5) * 5;
  return { n, types, copies, goals, goalOrder: goalTypes, time, ch, seed };
}

// ------------------------------------------------------------------ objects
const _p = new V3(), _q = new Q4(), _s = new V3(), _m = new M4(), _v = new V3(), _up = new V3();
const PILE_S = 1.5;
async function startLevel(opt = {}) {
  if (loadingLevel) return; loadingLevel = true;
  snd.unlock();
  const isDaily = opt.daily ?? D.isDaily;
  const n = isDaily ? 16 : (opt.level || save.level);
  const seed = isDaily ? D.seed : n * 1009 + 7;
  const G = genLevel(n, seed);
  $('#loading').classList.add('on');
  const loaded = await Promise.all(G.types.map(id => loadType(id)));
  $('#loading').classList.remove('on');
  // drop any type that failed to load (a missing model never breaks the level)
  G.types.forEach((id, i) => { if (!loaded[i]) { delete G.copies[id]; delete G.goals[id]; } });
  G.types = G.types.filter((id, i) => loaded[i]); G.goalOrder = G.goalOrder.filter(id => G.goals[id]);
  // triangle budget: trim the heaviest types (keeps the heap ≤ ~320k triangles)
  let tris = () => G.types.reduce((a, id) => a + TYPES_SYNC[id].tris * G.copies[id], 0);
  for (const id of G.types) TYPES_SYNC[id] = await loadType(id);
  let guard = 0;
  while (tris() > 240000 && guard++ < 30) { const h = G.types.filter(id => G.copies[id] > 3).sort((a, b) => TYPES_SYNC[b].tris - TYPES_SYNC[a].tris)[0]; if (!h) break; G.copies[h] -= 3; if (G.goals[h]) G.goals[h] = G.copies[h]; }
  // reset
  for (const id in TYPES_SYNC) { const t = TYPES_SYNC[id]; if (t && t.pile) { t.pile.count = 0; t.tray.count = 0; } }
  Lv.n = n; Lv.daily = isDaily; Lv.G = G; Lv.tray = []; Lv.hist = []; Lv.goals = { ...G.goals }; Lv.goalOrder = G.goalOrder.slice();
  Lv.goalTotal = Object.values(G.goals).reduce((a, b) => a + b, 0); Lv.matched = 0;
  Lv.time = G.time; Lv.left = G.time; Lv.frozen = 0; Lv.intro = 1.1; Lv.combo = 0; Lv.comboT = 0; Lv.points = 0; Lv.recorded = false; Lv.beatShown = false;
  Lv.world = new World({ W: BOX.W, D: BOX.D, H: 9 }); Lv.token = (Lv.token || 0) + 1; merges.length = 0; clearBoard();
  setFelt(G.ch, n);
  const objs = []; const r = rng(seed + 99);
  const ids = []; for (const id of G.types) for (let k = 0; k < G.copies[id]; k++) ids.push(id);
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  const cols = 5, rows = 7, cells = [...Array(cols * rows).keys()];
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  ids.forEach((id, i) => {
    const t = TYPES_SYNC[id]; meshesFor(t);
    const sc = PILE_S * (BY_ID[id]?.s || 1);
    const layer = Math.floor(i / (cols * rows)), k = cells[i % (cols * rows)];
    const p = new V3(((k % cols) + 0.5) / cols * (BOX.W - 1.2) - (BOX.W - 1.2) / 2 + (r() - 0.5) * 0.5,
      2.2 + layer * 1.6 + r() * 2.2,
      (Math.floor(k / cols) + 0.5) / rows * (BOX.D - 1.2) - (BOX.D - 1.2) / 2 + (r() - 0.5) * 0.5);
    const q = new Q4().setFromEuler(new THREE.Euler(r() * 6.28, r() * 6.28, r() * 6.28));
    const body = Lv.world.add([t.size.x * sc, t.size.y * sc, t.size.z * sc], p, q);
    body.v.set((r() - 0.5) * 2, -4 - r() * 4, (r() - 0.5) * 2); body.w.set((r() - 0.5) * 6, (r() - 0.5) * 6, (r() - 0.5) * 6);
    objs.push({ i, id, t, sc, body, state: 'pile', pos: p.clone(), quat: q.clone(), scl: sc, from: null, tp: 0, squash: 0, hl: 0 });
  });
  Lv.objs = objs;
  buildGoalsHud(); refreshBoosters();
  $('#lvl').textContent = isDaily ? '★' : n;
  ui.hideStart(); $('#hud').classList.remove('off'); $('#boosters').classList.remove('off');
  state = 'play'; loadingLevel = false; Lv.t0 = performance.now();
  B.start(); snd.whoosh(); snd.music(true);
  if (n <= 2 && !isDaily) setTimeout(() => toast(n === 1 ? 'Tap 3 alike!' : 'Fill the goals!', true), 900);
  // warm the next level's models in the background
  setTimeout(() => { const nx = genLevel(n + 1, (n + 1) * 1009 + 7); nx.types.forEach(loadType); }, 2500);
}
const TYPES_SYNC = {};

function setFelt(ch, n) {
  const c = n > 50 ? CHAPTERS[(n % 5)].felt : ch.felt;
  if (feltMat.userData.key === c[0]) return; feltMat.userData.key = c[0];
  const q = quilt(c[0], c[1], 7); q.map.repeat.set(1, BOX.D / BOX.W); q.bump.repeat.set(1, BOX.D / BOX.W);
  if (feltMat.map) { feltMat.map.dispose(); feltMat.bumpMap.dispose(); }
  feltMat.map = q.map; feltMat.bumpMap = q.bump; feltMat.needsUpdate = true;
}

// ------------------------------------------------------------------ picking
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), probe = new THREE.Mesh(), hits = [];
function instMatrix(o, out) { _s.setScalar(o.scl); if (o.squash) { const a = Math.sin(o.squash * Math.PI) * 0.22; _s.x *= 1 + a; _s.y *= 1 - a; _s.z *= 1 + a; } return out.compose(o.pos, o.quat, _s).multiply(o.t.base); }
function pickAt(x, y) {
  ndc.set(x / L.w * 2 - 1, -(y / L.h) * 2 + 1); ray.setFromCamera(ndc, camera);
  const cands = [];
  for (const o of Lv.objs) {
    if (o.state !== 'pile') continue;
    const d2 = ray.ray.distanceSqToPoint(o.pos), rr = o.body.R * 1.05;
    if (d2 < rr * rr) cands.push({ o, along: _v.subVectors(o.pos, ray.ray.origin).dot(ray.ray.direction), d2 });
  }
  cands.sort((a, b) => a.along - b.along);
  let best = null, bestD = 1e9;
  for (const c of cands.slice(0, 10)) {
    probe.geometry = c.o.t.geo; probe.material = c.o.t.mat; instMatrix(c.o, probe.matrixWorld);
    hits.length = 0; probe.raycast(ray, hits);
    for (const h of hits) if (h.distance < bestD) { bestD = h.distance; best = c.o; }
  }
  if (best) return best;
  // forgiving fallback for fat fingers: the nearest centre close to the ray, front-most first
  let fb = null, fd = 1e9; for (const c of cands) { const s = c.d2 + c.along * 0.01; if (c.d2 < (c.o.body.R * 0.75) ** 2 && s < fd) { fd = s; fb = c.o; } }
  return fb;
}
R.domElement.addEventListener('pointerdown', e => {
  snd.unlock();
  if (state !== 'play') return;
  const o = pickAt(e.clientX, e.clientY); if (o) take(o);
});

// ------------------------------------------------------------------ tray logic
function trayCounts() { const c = {}; for (const o of Lv.tray) c[o.id] = (c[o.id] || 0) + 1; return c; }
function take(o) {
  if (state !== 'play' || o.state !== 'pile') return false;
  if (Lv.tray.length >= TRAY) { snd.deny(); buzz(30); shakeTray(); return false; }
  Lv.world.remove(o.body);
  let idx = -1; for (let i = Lv.tray.length - 1; i >= 0; i--) if (Lv.tray[i].id === o.id) { idx = i + 1; break; }
  if (idx < 0) idx = Lv.tray.length;
  Lv.tray.splice(idx, 0, o);
  o.state = 'fly'; o.tp = 0; o.from = { pos: o.pos.clone(), quat: o.quat.clone(), scl: o.scl };
  Lv.hist.push(o);
  snd.pick(Lv.tray.length); buzz(8);
  return true;
}
let trayShake = 0;
function shakeTray() { trayShake = 0.35; }
const dispQ = new Q4().setFromEuler(new THREE.Euler(1.0, -0.45, 0));
const merges = [];
function checkMatches() {
  const byType = {};
  for (const o of Lv.tray) if (o.state === 'tray') (byType[o.id] = byType[o.id] || []).push(o);
  for (const id in byType) if (byType[id].length >= 3) { matchSet(byType[id].slice(0, 3)); return true; }
  return false;
}
function matchSet(set, viaMagnet = false) {
  const mid = set[1] || set[0];
  const center = viaMagnet ? screenToWorld(L.w / 2, L.trayY - L.slot * 1.4, L.dTray, new V3()) : mid.pos.clone();
  for (const o of set) { const k = Lv.tray.indexOf(o); if (k >= 0) Lv.tray.splice(k, 1); o.state = 'merge'; o.tp = 0; o.from = { pos: o.pos.clone(), quat: o.quat.clone(), scl: o.scl }; o.mc = center; }
  merges.push({ set, t: 0, center, id: set[0].id, magnet: viaMagnet });
}
function finishMerge(m) {
  for (const o of m.set) o.state = 'gone';
  Lv.combo = Lv.comboT > 0 ? Lv.combo + 1 : 0; Lv.comboT = 3.2; Lv.matched += 3;
  Lv.points += 30 * (1 + Lv.combo);
  snd.match(Lv.combo); buzz([10, 30, 14]);
  const col = TINT[m.id] || '#ffd36b';
  sparkle(m.center, col, 34, 2.6); sparkle(m.center, '#ffffff', 12, 1.6); ring(m.center, L.slot * L.wpp * 1.6);
  if (Lv.combo >= 1) toast(['Nice!', 'Great!', 'Super!', 'Amazing!', 'Trinket Trio!'][Math.min(4, Lv.combo - 1)] + (Lv.combo >= 2 ? ` x${Lv.combo + 1}` : ''));
  // collection
  if (!save.found.includes(m.id)) { save.found.push(m.id); persist(); setTimeout(() => toast('New trinket!', true), 450); }
  // goals: fly three thumbnails to the chip
  if (Lv.goals[m.id] > 0) {
    const s = worldToScreen(m.center);
    const tok = Lv.token;
    for (let k = 0; k < 3; k++) setTimeout(() => flyThumb(m.id, s.x, s.y, () => {
      if (tok !== Lv.token) return;
      Lv.goals[m.id] = Math.max(0, Lv.goals[m.id] - 1); paintGoal(m.id); snd.goal();
      if (Object.values(Lv.goals).every(v => v === 0) && state === 'play') winLevel();
    }), k * 90);
  }
  if (D.beaten(Lv.points) && !Lv.beatShown) { Lv.beatShown = true; toast('BEATEN!'); confetti(scene, m.center, 40); }
}
const TINT = {};   // per-type sparkle colour, sampled from the thumbnail
function sampleTint(id) {
  if (TINT[id]) return; const im = new Image(); im.src = `assets/thumbs/${id}.webp`;
  im.onload = () => { try { const c = document.createElement('canvas'); c.width = c.height = 16; const x = c.getContext('2d'); x.drawImage(im, 0, 0, 16, 16); const d = x.getImageData(0, 0, 16, 16).data; let r = 0, g = 0, b = 0, n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; } if (n) TINT[id] = new THREE.Color(r / n / 255, g / n / 255, b / n / 255).offsetHSL(0, 0.2, 0.1).getStyle(); } catch (e) {} };
}

// ------------------------------------------------------------------ boosters
const BOOST = ['undo', 'magnet', 'shuffle', 'freeze'];
function refreshBoosters() { for (const b of document.querySelectorAll('.bst')) { const n = save.boost[b.dataset.k] || 0; b.querySelector('b').textContent = n || '+'; b.classList.toggle('zero', !n); } }
function useBooster(k) {
  if (state !== 'play') return false;
  const btn = document.querySelector(`.bst[data-k=${k}]`);
  if (!(save.boost[k] > 0)) { btn.classList.remove('shake'); void btn.offsetWidth; btn.classList.add('shake'); snd.deny(); toast('Win levels to earn more', true); return false; }
  let ok = false;
  if (k === 'undo') ok = doUndo();
  if (k === 'magnet') ok = doMagnet();
  if (k === 'shuffle') ok = doShuffle();
  if (k === 'freeze') ok = doFreeze();
  if (!ok) { btn.classList.remove('shake'); void btn.offsetWidth; btn.classList.add('shake'); snd.deny(); return false; }
  save.boost[k]--; persist(); refreshBoosters(); return true;
}
for (const b of document.querySelectorAll('.bst')) { b.addEventListener('pointerdown', e => e.stopPropagation()); b.addEventListener('click', e => { e.stopPropagation(); useBooster(b.dataset.k); }); }
function doUndo() {
  for (let i = Lv.hist.length - 1; i >= 0; i--) {
    const o = Lv.hist[i]; if (!Lv.tray.includes(o)) continue;
    Lv.hist.splice(i, 1); Lv.tray.splice(Lv.tray.indexOf(o), 1);
    o.state = 'return'; o.tp = 0; o.from = { pos: o.pos.clone(), quat: o.quat.clone(), scl: o.scl };
    o.to = new V3((Math.random() - 0.5) * 3, 4.5, (Math.random() - 0.5) * 3);
    snd.undo(); return true;
  }
  return false;
}
function doMagnet() {
  const cnt = trayCounts(); const pileBy = {};
  for (const o of Lv.objs) if (o.state === 'pile') (pileBy[o.id] = pileBy[o.id] || []).push(o);
  let best = null, bs = -1;
  for (const id in pileBy) {
    const inTray = Lv.tray.filter(o => o.id === id && o.state === 'tray').length;
    if (inTray + pileBy[id].length < 3) continue;
    const s = inTray * 10 + (Lv.goals[id] > 0 ? 5 : 0) + Math.random();
    if (s > bs) { bs = s; best = id; }
  }
  if (!best) return false;
  const fromTray = Lv.tray.filter(o => o.id === best && o.state === 'tray').slice(0, 3);
  const need = 3 - fromTray.length, pile = pileBy[best].sort((a, b) => b.pos.y - a.pos.y).slice(0, need);
  for (const o of pile) { Lv.world.remove(o.body); }
  matchSet(fromTray.concat(pile), true);
  snd.magnet(); buzz(20);
  return true;
}
function doShuffle() {
  const W = Lv.world; let n = 0;
  for (const o of Lv.objs) if (o.state === 'pile') { const b = o.body; W.wake(b); b.v.set((Math.random() - 0.5) * 5, 7 + Math.random() * 5, (Math.random() - 0.5) * 5); b.w.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14); n++; }
  if (!n) return false;
  snd.whoosh(); shake = 0.4; buzz(25); return true;
}
function doFreeze() { if (Lv.frozen > 0) return false; Lv.frozen = 10; $('#frost').classList.add('on'); $('#timer').classList.add('ice'); snd.freeze(); return true; }

// ------------------------------------------------------------------ HUD
function buildGoalsHud() {
  const g = $('#goals'); g.innerHTML = '';
  for (const id of Lv.goalOrder) {
    sampleTint(id);
    const d = document.createElement('div'); d.className = 'goal'; d.dataset.id = id;
    d.innerHTML = `<img src="assets/thumbs/${id}.webp" alt=""><b>${Lv.goals[id]}</b>`; g.appendChild(d);
  }
  for (const id of Lv.G.types) sampleTint(id);
  paintTime();
}
function paintGoal(id) {
  const d = document.querySelector(`.goal[data-id="${id}"]`); if (!d) return;
  const v = Lv.goals[id]; d.querySelector('b').textContent = v > 0 ? v : '✓'; d.classList.toggle('done', v <= 0);
  d.classList.remove('bump'); void d.offsetWidth; d.classList.add('bump');
}
function flyThumb(id, x, y, done) {
  const tgt = document.querySelector(`.goal[data-id="${id}"]`); if (!tgt) { done(); return; }
  const r = tgt.getBoundingClientRect(), im = document.createElement('img'); im.className = 'fly'; im.src = `assets/thumbs/${id}.webp`;
  im.style.left = (x - 22) + 'px'; im.style.top = (y - 22) + 'px'; document.body.appendChild(im);
  requestAnimationFrame(() => requestAnimationFrame(() => { im.style.transform = `translate(${r.left + r.width / 2 - x}px,${r.top + r.height / 2 - y}px) scale(.8)`; }));
  setTimeout(() => { im.remove(); done(); }, 560);
}
let lastSec = -1;
function paintTime() {
  const s = Math.max(0, Math.ceil(Lv.left)); $('#time').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  $('#timer').classList.toggle('low', s <= 10 && Lv.frozen <= 0 && state === 'play');
  if (s !== lastSec && s <= 5 && s > 0 && state === 'play' && Lv.frozen <= 0) snd.tick(); lastSec = s;
}
let toastEl = null;
function toast(t, small = false) { if (toastEl) toastEl.remove(); const d = toastEl = document.createElement('div'); d.className = 'toast' + (small ? ' small' : ''); d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 1000); }
const muteBtn = $('#mute');
const paintMute = () => { muteBtn.innerHTML = snd.muted ? '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#ccc" stroke="#5b2a4e" stroke-width="2" stroke-linejoin="round"/><path d="M17 9l5 6M22 9l-5 6" stroke="#5b2a4e" stroke-width="2.4" stroke-linecap="round"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#ffc94a" stroke="#5b2a4e" stroke-width="2" stroke-linejoin="round"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" stroke="#5b2a4e" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg>'; };
paintMute();
for (const b of [muteBtn, $('#home')]) b.addEventListener('pointerdown', e => e.stopPropagation());
muteBtn.addEventListener('click', () => { snd.toggle(); paintMute(); });
$('#home').addEventListener('click', () => { if (state === 'play') { record(false); clearBoard(); showHome(); } });

// ------------------------------------------------------------------ win / lose
function record(won) {
  if (Lv.recorded) return; Lv.recorded = true;
  F.level(won, Lv.goalTotal ? (Lv.goalTotal - Object.values(Lv.goals).reduce((a, v) => a + v, 0)) / Lv.goalTotal : 0);
}
function winLevel() {
  if (state !== 'play') return; state = 'won'; record(true);
  const frac = Lv.left / Lv.time, stars = frac >= 0.45 ? 3 : frac >= 0.2 ? 2 : 1;
  Lv.points += Math.round(Lv.left) * 5;
  const ms = performance.now() - Lv.t0;
  const rewards = [];
  let gained = 0;
  if (Lv.daily) {
    const today = new Date().toISOString().slice(0, 10);
    if (save.dailyWon !== today) { save.dailyWon = today; gained = stars; save.boost.magnet++; rewards.push(['magnet', 1]); }
  } else {
    const old = save.stars[Lv.n] || 0; if (stars > old) { gained = stars - old; save.stars[Lv.n] = stars; }
    if (Lv.n === save.level) {
      save.level++;
      const k = BOOST[(Lv.n - 1) % 4]; save.boost[k] = (save.boost[k] || 0) + 1; rewards.push([k, 1]);
      if (Lv.n % 5 === 0) { for (const b of BOOST) save.boost[b]++; rewards.push(['chest', 4]); }
    }
  }
  persist();
  if (gained > 0) B.submit(gained, { ms });
  D.won(Lv.points);
  snd.win(); buzz([20, 40, 20]);
  const cpos = new V3(0, 3, 0); confetti(scene, cpos, 70);
  for (let k = 0; k < 4; k++) setTimeout(() => sparkle(new V3((Math.random() - 0.5) * 5, 2.5, (Math.random() - 0.5) * 6), ['#ffd36b', '#ff8db6', '#7fe0c1', '#9fc8ff'][k], 40, 3.5), k * 150);
  // card
  const w = ui.els.win; w.querySelector('.stars').innerHTML = [0, 1, 2].map(() => `<i>${STAR_SVG}</i>`).join('');
  w.querySelector('.reward').innerHTML = rewards.map(([k, n]) => k === 'chest' ? `<span><img src="assets/thumbs/g18.webp" alt="">+1 each</span>` : `<span>${ICON[k]}+${n}</span>`).join('') + `<span>Score ${Lv.points}</span>`;
  ui.win(Lv.daily ? 'DAILY' : Lv.n, Lv.daily ? 'Daily puzzle solved!' : `${CHAPTERS[Math.min(5, chapterOf(Lv.n))].name}`);
  setTimeout(() => { const st = w.querySelectorAll('.stars i'); for (let k = 0; k < stars; k++) setTimeout(() => { st[k].classList.add('on'); snd.star(k); }, 250 + k * 280); }, 650);
  setTimeout(() => { $('#hud').classList.add('off'); $('#boosters').classList.add('off'); }, 600);
}
function loseLevel(title, line) {
  if (state !== 'play') return; state = 'lost'; record(false);
  snd.lose(); buzz([40, 60, 40]); shakeTray();
  ui.lose(title, line);
  setTimeout(() => { $('#boosters').classList.add('off'); $('#hud').classList.add('off'); }, 600);
}
ui.onTap(which => {
  snd.unlock();
  if (which === 'start') { startLevel(); return; }
  clearBoard();
  if (which === 'win') { showHome(); return; }
  if (which === 'lose') { startLevel({ level: Lv.n, daily: Lv.daily }); }
});
function clearBoard() { $('#frost').classList.remove('on'); $('#timer').classList.remove('ice', 'low'); merges.length = 0; }

// ------------------------------------------------------------------ home (journey map)
const STAR_SVG = '<svg viewBox="0 0 64 64"><path d="M32 4l8.2 17.6 19.3 2.3-14.2 13.2 3.7 19.1L32 46.6 15 56.2l3.7-19.1L4.5 23.9l19.3-2.3z" fill="#ffc94a" stroke="#5b2a4e" stroke-width="4" stroke-linejoin="round"/><path d="M24 22l8-14 3 12z" fill="#fff" opacity=".55"/></svg>';
const ICON = {}, BCOL = { undo: '#ff8a3d', magnet: '#ff4f8b', shuffle: '#7b5cff', freeze: '#3aa7f0' };
for (const b of document.querySelectorAll('.bst')) ICON[b.dataset.k] = `<svg viewBox="-3 -3 38 38" style="background:${BCOL[b.dataset.k]};border-radius:9px">${b.querySelector('svg').innerHTML}</svg>`;
function buildHomeShell() {
  const s = ui.els.start;
  s.innerHTML = `<div id="homeIn"><div class="logo"><h1>Trinket <span>Trio</span></h1><div class="sub">Match 3D</div></div>
    <div id="map"><div id="path"></div></div>
    <button id="playBtn">Play</button>
    <div class="meta" id="meta"></div></div>`;
  ui.els.win.id = 'winCard'; ui.els.lose.id = 'loseCard'; ui.els.start.id = 'homeCard';
  const w = ui.els.win; w.querySelector('h1').insertAdjacentHTML('afterend', '<div class="burst"></div><div class="stars"></div><div class="reward"></div>');
  s.querySelector('#map').addEventListener('pointerdown', e => e.stopPropagation());
  s.querySelector('#meta').addEventListener('pointerdown', e => { if (e.target.closest('.btn')) e.stopPropagation(); });
}
function showHome() {
  state = 'ready'; snd.music(false);
  $('#hud').classList.add('off'); $('#boosters').classList.add('off');
  ui.start(); renderHome();
  setTimeout(() => { if (state === 'ready') idleHeap(); }, 350);
}
function renderHome() {
  const cur = save.level, path = $('#path'), map = $('#map');
  const lo = Math.max(1, cur - 3), hi = cur + 7, gap = 92, cw = map.clientWidth || Math.min(innerWidth - 32, 440);
  const rows = []; let y = 60;
  for (let n = hi; n >= lo; n--) { rows.push({ n, y }); y += gap; if (n % 10 === 1 && n > 1) y += 0; }
  const H = y + 40; path.style.height = H + 'px';
  const X = n => cw / 2 + Math.sin(n * 0.95) * cw * 0.27;
  let html = `<svg class="trail" width="${cw}" height="${H}"><path d="${rows.map((r, i) => (i ? 'L' : 'M') + X(r.n).toFixed(1) + ' ' + r.y).join(' ')}" stroke="rgba(255,255,255,.95)" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="${rows.map((r, i) => (i ? 'L' : 'M') + X(r.n).toFixed(1) + ' ' + r.y).join(' ')}" stroke="#ffb3cb" stroke-width="5" stroke-dasharray="2 12" fill="none" stroke-linecap="round"/></svg>`;
  for (const r of rows) {
    const n = r.n, st = save.stars[n] || 0, cls = n < cur ? 'done' : n === cur ? 'cur' : 'lock';
    html += `<div class="node ${cls}" data-n="${n}" style="left:${X(n)}px;top:${r.y}px">${n}${n < cur ? `<span class="ns">${'⭐'.repeat(st)}</span>` : ''}</div>`;
    if (n % 5 === 0) html += `<img class="gift ${n < cur ? 'open' : ''}" src="assets/thumbs/g18.webp" style="left:${X(n) + (X(n) > cw / 2 ? -64 : 64)}px;top:${r.y - 6}px" alt="">`;
    if (n % 10 === 1) { const ch = CHAPTERS[Math.min(5, chapterOf(n))]; html += `<div class="chap" style="top:${r.y + 34}px"><img src="assets/thumbs/${ch.icon}.webp" alt="">${ch.name}<small>&nbsp;ch.${Math.floor((n - 1) / 10) + 1}</small></div>`; }
  }
  path.innerHTML = html;
  const curRow = rows.find(r => r.n === cur); map.scrollTop = Math.max(0, curRow.y - map.clientHeight * 0.62);
  for (const el of path.querySelectorAll('.node.done,.node.cur')) el.addEventListener('click', () => { snd.unlock(); ui.hideStart(); startLevel({ level: +el.dataset.n, daily: false }); });
  $('#playBtn').textContent = D.isDaily ? 'Play Daily Puzzle' : `Play Level ${cur}`;
  const ch = CHAPTERS[Math.min(5, chapterOf(cur))];
  const nextGift = Math.ceil(cur / 5) * 5;
  $('#meta').innerHTML = `<span class="chip">${STAR_SVG.replace('viewBox', 'width="22" height="22" viewBox')} ${totalStars()}</span>
    <span class="chip"><img src="assets/thumbs/${ch.icon}.webp" alt="">${save.found.length}/${ITEMS.length} found</span>
    <span class="chip"><img src="assets/thumbs/g18.webp" alt="">Gift at ${nextGift}</span>
    ${D.isDaily ? '' : `<a class="chip btn" href="?daily=1" style="text-decoration:none">📅 Daily</a>`}`;
}

// ------------------------------------------------------------------ frame loop
let perfS = {}; R.info.autoReset = false;
let shake = 0, lastT = performance.now(), fpsAcc = 0, fpsN = 0;
function frame(now) {
  const dt = Math.min(1 / 30, (now - lastT) / 1000); lastT = now;
  if (Lv.world) {
    const W = Lv.world; W.step(dt / 2); W.step(dt / 2);
    if (state === 'play') {
      if (Lv.intro > 0) Lv.intro -= dt;
      else if (Lv.frozen > 0) { Lv.frozen -= dt; if (Lv.frozen <= 0) { $('#frost').classList.remove('on'); $('#timer').classList.remove('ice'); } }
      else { Lv.left -= dt; if (Lv.left <= 0) { Lv.left = 0; paintTime(); loseLevel('Out of time!', 'So close — try again'); } }
      paintTime();
      if (Lv.comboT > 0) Lv.comboT -= dt;
    }
    updateObjects(dt);
  }
  // camera breathing + shake
  if (shake > 0) shake = Math.max(0, shake - dt);
  const sx = shake ? (Math.random() - 0.5) * shake * 0.5 : 0, sy = shake ? (Math.random() - 0.5) * shake * 0.5 : 0;
  placeCam(L.camD || 24); camera.position.x += sx; camera.position.y += sy; camera.updateMatrixWorld();
  if (trayShake > 0) { trayShake = Math.max(0, trayShake - dt); }
  updSparks(dt); updRings(dt); updateParticles(dt * 60);
  R.info.reset(); C.render(dt); perfS = { calls: R.info.render.calls, tris: R.info.render.triangles };
  fpsAcc += dt; fpsN++;
  requestAnimationFrame(frame);
}
const _t = new V3(), _mid = new V3(), _qd = new Q4();
function updateObjects(dt) {
  const counts = {};
  // tray targets
  Lv.tray.forEach((o, i) => o.slot = i);
  const trayScale = L.slot * L.wpp * 0.86;
  _up.set(0, 1, 0).applyQuaternion(camera.quaternion);
  const sh = trayShake > 0 ? Math.sin(trayShake * 60) * trayShake * L.slot * L.wpp * 0.4 : 0;
  trayG.position.x += 0; // (tray plate stays; items wobble)
  for (const o of Lv.objs) {
    if (o.state === 'pile') { o.pos.copy(o.body.p); o.quat.copy(o.body.q); }
    else if (o.state === 'fly' || o.state === 'tray') {
      slotWorld(o.slot, _t); _t.addScaledVector(_v.set(1, 0, 0).applyQuaternion(camera.quaternion), sh);
      _qd.copy(trayG.quaternion).multiply(dispQ);
      const ts = trayScale * (o.sc / PILE_S);
      if (o.state === 'fly') {
        o.tp += dt / 0.3; const k = ease(o.tp);
        _mid.lerpVectors(o.from.pos, _t, 0.5).addScaledVector(_up, 1.6);
        const a = 1 - k; o.pos.set(0, 0, 0).addScaledVector(o.from.pos, a * a).addScaledVector(_mid, 2 * a * k).addScaledVector(_t, k * k);
        o.quat.slerpQuaternions(o.from.quat, _qd, k); o.scl = THREE.MathUtils.lerp(o.from.scl, ts, k) * (1 + Math.sin(k * Math.PI) * 0.25);
        if (o.tp >= 1) { o.state = 'tray'; o.squash = 1; snd.land(o.slot); if (!checkMatches()) checkLose(); }
      } else {
        o.pos.lerp(_t, 1 - Math.exp(-dt * 16)); o.quat.slerp(_qd, 1 - Math.exp(-dt * 10)); o.scl = ts;
      }
    } else if (o.state === 'return') {
      o.tp += dt / 0.35; const k = ease(o.tp);
      o.pos.lerpVectors(o.from.pos, o.to, k); o.scl = THREE.MathUtils.lerp(o.from.scl, o.sc, k);
      if (o.tp >= 1) { o.state = 'pile'; o.scl = o.sc; const b = o.body; b.p.copy(o.pos); b.q.copy(o.quat); b.v.set(0, -3, 0); b.w.set(Math.random() * 4, Math.random() * 4, 0); b.on = true; b.asleep = false; b.sleepT = 0; }
    }
    if (o.squash > 0) o.squash = Math.max(0, o.squash - dt * 4);
  }
  // merges: slide together, swell, pop
  for (let i = merges.length - 1; i >= 0; i--) {
    const m = merges[i]; m.t += dt / (m.magnet ? 0.5 : 0.24);
    const k = ease(m.t);
    for (const o of m.set) {
      o.pos.lerpVectors(o.from.pos, m.center, k);
      o.scl = THREE.MathUtils.lerp(o.from.scl, L.slot * L.wpp * 0.86 * (o.sc / PILE_S), Math.min(1, k * 1.5)) * (1 + Math.sin(Math.min(1, m.t) * Math.PI) * 0.3);
      if (m.magnet) o.quat.slerp(_qd.copy(trayG.quaternion).multiply(dispQ), k);
    }
    if (m.t >= 1) { merges.splice(i, 1); finishMerge(m); }
  }
  // write instances
  for (const id in TYPES_SYNC) { const t = TYPES_SYNC[id]; if (t && t.pile) { t.pile.count = 0; t.tray.count = 0; } }
  for (const o of Lv.objs) {
    if (o.state === 'gone') continue;
    const mesh = o.state === 'pile' ? o.t.pile : o.t.tray;
    if (mesh.count >= 9) continue;
    mesh.setMatrixAt(mesh.count++, instMatrix(o, _m));
  }
  for (const id in TYPES_SYNC) { const t = TYPES_SYNC[id]; if (t && t.pile) { t.pile.instanceMatrix.needsUpdate = true; t.tray.instanceMatrix.needsUpdate = true; } }
  // tray wells glow when nearly full
  const full = Lv.tray.length >= 5 && state === 'play';
  const wells = trayG.userData.wells || []; wells.forEach((w, i) => { w.material = full && i >= Lv.tray.length ? wellGlow : wellMat; });
  wellGlow.emissiveIntensity = full ? 0.25 + Math.sin(performance.now() / 150) * 0.15 : 0;
}
function checkLose() {
  if (state !== 'play') return;
  if (Lv.tray.length >= TRAY && Lv.tray.every(o => o.state === 'tray') && !merges.length) loseLevel('Tray full!', 'Plan your triples — try again');
}

// ------------------------------------------------------------------ bot (for check.cjs): plays like a careful player
function exposure(o) { let s = o.pos.y * 2; for (const p of Lv.objs) if (p !== o && p.state === 'pile' && p.pos.y > o.pos.y + 0.3 && Math.hypot(p.pos.x - o.pos.x, p.pos.z - o.pos.z) < 0.9) s -= 3; return s; }
function bot() {
  if (state === 'ready') { if (!loadingLevel) { ui.hideStart(); startLevel(); } return; }
  if (state !== 'play' || loadingLevel || Lv.intro > 0.6) return;
  const cnt = trayCounts(), pile = Lv.objs.filter(o => o.state === 'pile');
  if (!pile.length) return;
  const best = id => pile.filter(o => o.id === id).sort((a, b) => exposure(b) - exposure(a))[0];
  for (const id in cnt) if (cnt[id] % 3 === 2) { const o = best(id); if (o) { take(o); return; } }
  if (Lv.tray.length <= 5) for (const id in cnt) if (cnt[id] % 3 === 1) { const o = best(id); if (o) { take(o); return; } }
  if (Lv.tray.length >= 5) { if (save.boost.magnet > 0 && useBooster('magnet')) return; if (save.boost.undo > 0 && Lv.tray.length >= 6 && useBooster('undo')) return; }
  if (Lv.left < Lv.time * 0.3 && save.boost.freeze > 0 && Lv.frozen <= 0) { useBooster('freeze'); return; }
  // start a goal type that has the most exposed copies
  const ids = [...new Set(pile.map(o => o.id))].sort((a, b) => ((Lv.goals[b] > 0) - (Lv.goals[a] > 0)) || (exposure(best(b)) - exposure(best(a))));
  const o = best(ids[0]); if (o) take(o);
}
window.__game = {
  get state() { return state; }, get level() { return Lv.daily ? 'daily' : save.level; }, get score() { return totalStars(); },
  get points() { return Lv.points; }, get tray() { return Lv.tray.map(o => o.id); }, get left() { return Lv.left; },
  bot, start: startLevel, use: useBooster,
  get debug() { return { Lv, take }; },
  get perf() { const r = { ...perfS, fps: fpsN / Math.max(0.001, fpsAcc) }; fpsN = 0; fpsAcc = 0; return r; },
};

// ------------------------------------------------------------------ boot
addEventListener('resize', () => { layout(); if (state === 'ready') renderHome(); });
buildRoom().then(() => { trayBuilt = 0; layout(); });
layout();
renderHome();
requestAnimationFrame(frame);
// an idle heap behind the home screen so the box never looks empty
async function idleHeap() {
  const ids = ['t01', 'f04', 'g13', 'm01', 't03', 'f05', 'g09', 'm03'];
  await Promise.all(ids.map(loadType)); for (const id of ids) TYPES_SYNC[id] = await loadType(id);
  if (state !== 'ready') return;
  Lv.token = (Lv.token || 0) + 1; merges.length = 0;
  Lv.world = new World({ W: BOX.W, D: BOX.D, H: 9 }); Lv.objs = []; Lv.tray = [];
  const r = rng(5);
  ids.concat(ids, ids).forEach((id, i) => {
    const t = TYPES_SYNC[id]; if (!t) return; meshesFor(t);
    const p = new V3((r() - 0.5) * 5.5, 1 + i * 0.25, (r() - 0.5) * 8.5), q = new Q4().setFromEuler(new THREE.Euler(r() * 6, r() * 6, r() * 6));
    const body = Lv.world.add([t.size.x * PILE_S, t.size.y * PILE_S, t.size.z * PILE_S], p, q);
    Lv.objs.push({ i, id, t, sc: PILE_S, body, state: 'pile', pos: p.clone(), quat: q.clone(), scl: PILE_S, tp: 0, squash: 0 });
  });
  for (let k = 0; k < 240; k++) Lv.world.step(1 / 60);
}
idleHeap();
