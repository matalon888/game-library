// Bowtwist: Pin Puzzle — tap a bow-pin to lift it, tap its colour gift box or a spare hole to place it; jelly plates swing
// on their last pin and plop off when free. Momo's dorm room is decorated with the stars you earn; stickers fill an album.
// Mechanic in the family of Screw Jam / Wood Nuts & Bolts; all code and art original (Kawaii Pop AI 3D library + code).
// Rules engine + solver: logic.js (the same engine as Twistwood, so every level is proven solvable).
import { money } from './kit/money.js';
import { THREE, createUI, store, buzz } from './kit/hc.js';
import { cine } from './kit/cine.js';
import { GLTFLoader } from './kit/addons/loaders/GLTFLoader.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { snd } from './audio.js';
import * as G from './logic.js';
import { PIN as SCREW, JELLY, initMaterials, initGeometry, makeScrew, makePlate, makeHoles, makeBox, wallTex, quiltTex, floorTex, blobTex, starTex, MAT } from './art.js';
import { TASKS, ALBUM, PAGES } from './meta.js';

const V3 = THREE.Vector3;
const NAME = 'Bowtwist: Pin Puzzle', KEY = 'bowtwist';
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const easeBack = t => { t = clamp(t, 0, 1); const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const Q = new URLSearchParams(location.search);

// ------------------------------------------------------------------ save
const SV = store(KEY);
const save = {
  level: SV.get('level', 1), stars: SV.get('stars', {}), spent: SV.get('spent', 0), tasks: SV.get('tasks', 0),
  boost: SV.get('boost', { hint: 2, drill: 1, hole: 1 }), album: SV.get('album', {}), pagesPaid: SV.get('pagesPaid', {}),
  dstreak: SV.get('dstreak', { n: 0, last: 0, freezeWeek: -1 }), dailyDone: SV.get('dailyDone', 0), tut: SV.get('tut', 0),
};
const persist = () => { for (const k in save) SV.set(k, save[k]); };
const totalStars = () => Object.values(save.stars).reduce((a, b) => a + b, 0);
const starBank = () => totalStars() - save.spent;

// ------------------------------------------------------------------ kit layers
const M = money({ game: KEY, style: 'B' });
addEventListener('ap:ad', e => { if (e.detail && e.detail.phase === 'start') snd.pause(); else snd.resume(); });
const ui = createUI({ title: 'Bowtwist', hint: '', hand: '', progress: false, score: false });
const F = flow(KEY);
const D = daily(KEY, null, { name: NAME });
const B = board({ game: 'bowtwist', label: 'Stars won', mode: 'sum', limits: { maxRun: 6, maxPerSec: 1.5 }, corner: 'tl', accent: '#ff6fae' });

// ------------------------------------------------------------------ renderer / scene
const R = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
R.domElement.className = 'hc-canvas'; document.body.prepend(R.domElement);
R.setPixelRatio(Math.min(devicePixelRatio, 2)); R.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#c99be6');
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.5, 400);
const C = cine(R, scene, camera, { bloom: 0.2, bloomThreshold: 0.96, bloomRadius: 0.4, exposure: 0.95, envIntensity: 0.5,
  grade: { sat: 1.18, contrast: 1.06, vignette: 0.12, grain: 0, tint: '#fff8fc' } });
const LITE = C.lite;
const hemi = new THREE.HemisphereLight('#fff4fb', '#c9a8e0', 0.6); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff6fb', 1.9); sun.position.set(-7, 11, 13); sun.castShadow = true;
sun.shadow.mapSize.set(LITE ? 1024 : 2048, LITE ? 1024 : 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02; sun.shadow.radius = 5;
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 10, bottom: -9, near: 2, far: 50 }); sun.target.position.set(0, 1, 0); scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight('#ffd9f0', 0.6); fill.position.set(8, 3, 14); scene.add(fill);
initMaterials(); initGeometry();
window.__dbg = { scene, camera, R, C };

// ------------------------------------------------------------------ room + board (static)
const room = new THREE.Group(), boardG = new THREE.Group(), lvlG = new THREE.Group(), boxG = new THREE.Group();
scene.add(room, boardG, lvlG, boxG);
const BOARD = { x0: -3.4, x1: 3.4, y0: -3.95, y1: 4.95 };
const BENCH_Y = -5.3, FLOOR_Y = -15;
const loader = new GLTFLoader();
const blob = new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false });
function rbox(w, h, d, r, mat, seg = 3) { return new THREE.Mesh(new (RBG())(w, h, d, seg, r), mat); }
let _RBG = null; const RBG = () => _RBG;
async function buildRoom() {
  _RBG = (await import('./kit/addons/geometries/RoundedBoxGeometry.js')).RoundedBoxGeometry;
  // wall: pink heart wallpaper + a white chair rail with a lilac stripe
  const wt = wallTex(); wt.repeat.set(14, 7);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(140, 70), new THREE.MeshStandardMaterial({ map: wt, roughness: 0.8 }));
  wall.position.set(0, 10, -0.5); wall.receiveShadow = true; room.add(wall);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(140, 0.45, 0.35), MAT.white); rail.position.set(0, 11.5, -0.35); room.add(rail);
  const railL = new THREE.Mesh(new THREE.BoxGeometry(140, 0.14, 0.4), MAT.lilacRim); railL.position.set(0, 11.2, -0.33); room.add(railL);
  // dresser ledge: mint top, lilac drawers with heart knobs
  const ledgeM = new THREE.MeshPhysicalMaterial({ color: '#fbd3ec', roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 });
  const top = rbox(70, 0.9, 7.2, 0.35, ledgeM); top.position.set(0, BENCH_Y - 0.45, 3.1); top.receiveShadow = true; top.castShadow = true; room.add(top);
  const front = new THREE.Mesh(new THREE.BoxGeometry(68, 8.6, 0.4), new THREE.MeshStandardMaterial({ color: '#f0bfe9', roughness: 0.55 })); front.position.set(0, BENCH_Y - 5.2, 6.1); front.receiveShadow = true; room.add(front);
  const drM = new THREE.MeshPhysicalMaterial({ color: '#c3a6ff', roughness: 0.3, clearcoat: 0.8 });
  for (let i = -3; i <= 3; i++) {
    const dr = rbox(7.2, 3, 0.3, 0.45, drM); dr.position.set(i * 9.2, BENCH_Y - 3.0, 6.35); room.add(dr);
    const kn = new THREE.Mesh(new THREE.SphereGeometry(0.4, 18, 12), MAT.pinkRim); kn.scale.set(1, 1, 0.7); kn.position.set(i * 9.2, BENCH_Y - 3.0, 6.6); room.add(kn);
  }
  // floor: pastel boards
  const fl = floorTex(); fl.repeat.set(10, 12);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 90), new THREE.MeshStandardMaterial({ map: fl, roughness: 0.6 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, FLOOR_Y, 30); floor.receiveShadow = true; room.add(floor);
  // shelf for the gift boxes: a pink jelly shelf on white heart brackets
  const shelf = rbox(9.2, 0.42, 2.0, 0.2, MAT.pinkRim); shelf.position.set(0, 5.32, 0.5); shelf.castShadow = true; shelf.receiveShadow = true; room.add(shelf);
  for (const x of [-3.7, 3.7]) { const b = rbox(0.34, 1.1, 1.4, 0.14, MAT.white); b.position.set(x, 4.7, 0.1); room.add(b); }
  buildBoard();
  // a big satin bow on the board frame (Kawaii library b01) + a heart clip on the shelf
  loadPiece('b01').then(m => { for (const sx of [-1, 1]) { const c = sx < 0 ? m : m.clone(); c.scale.setScalar(1.5); c.position.set(sx * 3.62, BOARD.y0 - 0.75, 0.35); c.rotation.z = -sx * 0.3; boardG.add(c); } }).catch(() => {});
  loadPiece('m12').then(m => { m.scale.setScalar(3.2); m.position.set(-10.5, BENCH_Y, 2.6); m.rotation.y = 0.4; room.add(m); }).catch(() => {});
  const shaft = new THREE.Mesh(new THREE.PlaneGeometry(6, 30), new THREE.MeshBasicMaterial({ color: '#fff0fa', transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  shaft.position.set(-9, -2, 5); shaft.rotation.set(-0.9, 0.5, 0.35); room.add(shaft);
  props();
}
// the puzzle board: a quilted lilac cushion in a puffy pink candy frame, white spare-hole strip on top
const spareHoles = makeHoles(64);
function buildBoard() {
  const { x0, x1, y0, y1 } = BOARD, w = x1 - x0, h = y1 - y0, cy = (y0 + y1) / 2;
  const qt = quiltTex(); qt.repeat.set(1.6, 1.9);
  const panel = rbox(w, h, 0.5, 0.2, new THREE.MeshStandardMaterial({ map: qt, roughness: 0.6 })); panel.position.set(0, cy, -0.25); panel.receiveShadow = true; boardG.add(panel);
  const t = 0.5;
  for (const [ww, hh, x, y] of [[w + 2 * t, t, 0, y1 + t / 2], [w + 2 * t, t, 0, y0 - t / 2], [t, h, x0 - t / 2, cy], [t, h, x1 + t / 2, cy]]) {
    const f = rbox(ww, hh, 0.8, 0.24, MAT.pinkRim); f.position.set(x, y, -0.1); f.castShadow = true; f.receiveShadow = true; boardG.add(f);
  }
  for (const [x, y] of [[x0 - t / 2, y1 + t / 2], [x1 + t / 2, y1 + t / 2]]) {
    const k = new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 14), MAT.pearl); k.scale.set(1, 1, 0.75); k.position.set(x, y, 0.3); boardG.add(k);
  }
  // spare strip: a white jelly bar
  const strip = rbox(7.0, 0.96, 0.14, 0.4, MAT.white); strip.position.set(0, G.SPARE_Y, 0.0); strip.receiveShadow = true; boardG.add(strip);
  const stripIn = rbox(6.8, 0.78, 0.06, 0.34, new THREE.MeshStandardMaterial({ color: '#e6c8ff', roughness: 0.6 })); stripIn.position.set(0, G.SPARE_Y, 0.02); boardG.add(stripIn);
  boardG.add(spareHoles);
}
const PROPS = {};   // id → mesh (restoration props)
async function loadPiece(id) {
  const gl = await loader.loadAsync(`assets/${id}.glb`);
  gl.scene.updateMatrixWorld(true); let mesh = null; gl.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
  const geo = toFloat(mesh.geometry.clone()); geo.applyMatrix4(mesh.matrixWorld); geo.rotateX(Math.PI / 2);
  geo.computeBoundingBox(); const b = geo.boundingBox, s = new V3(); b.getSize(s); const k = 1 / Math.max(s.x, s.y, s.z), c = new V3(); b.getCenter(c);
  geo.translate(-c.x, -b.min.y, -c.z); geo.scale(k, k, k); if (!geo.attributes.normal) geo.computeVertexNormals();
  const mat = mesh.material; mat.side = THREE.FrontSide; mat.envMapIntensity = 0.9;
  const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; return m;
}
function toFloat(g) {
  for (const k of Object.keys(g.attributes)) {
    const a = g.attributes[k]; if (a.array instanceof Float32Array && !a.isInterleavedBufferAttribute && !a.normalized) continue;
    const n = a.itemSize, out = new Float32Array(a.count * n);
    for (let i = 0; i < a.count; i++) { out[i * n] = a.getX(i); if (n > 1) out[i * n + 1] = a.getY(i); if (n > 2) out[i * n + 2] = a.getZ(i); if (n > 3) out[i * n + 3] = a.getW(i); }
    g.setAttribute(k, new THREE.BufferAttribute(out, n));
  }
  return g;
}
async function props() {
  for (const [i, t] of TASKS.entries()) {
    if (!t.prop) continue;
    loadPiece(t.prop).then(m => {
      m.scale.setScalar(t.s); m.position.set(...t.at); m.rotation.y = t.ry || 0;
      const g = new THREE.Group(); g.add(m);
      if (t.shadow !== false) { const sh = new THREE.Mesh(new THREE.PlaneGeometry(t.s * 1.2, t.s * 1.2 * (t.sd || 0.7)), blob); sh.rotation.x = -Math.PI / 2; sh.position.set(t.at[0], t.at[1] + 0.03, t.at[2]); g.add(sh); }
      g.visible = i < save.tasks; room.add(g); PROPS[t.id] = g;
    }).catch(e => console.warn('prop', t.prop, e && e.message));
  }
}

// ------------------------------------------------------------------ host: Momo (Kawaii library chibi k01)
let host = null; const HOST_YAW = 1.0;   // play view: turned toward the board
async function loadHost() {
  const gl = await loader.loadAsync('assets/chars/k01.glb');
  const root = gl.scene; root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root, true), hgt = box.max.y - box.min.y;
  const g = new THREE.Group(); root.position.y = -box.min.y; g.add(root);
  const mixer = new THREE.AnimationMixer(root), acts = {}; for (const c of gl.animations) acts[c.name] = mixer.clipAction(c);
  let cur = null;
  const play = (n, once = false) => { const a = acts[n]; if (!a) return; if (a === cur && !once) return; a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity); a.clampWhenFinished = once; a.play(); if (cur && cur !== a) cur.crossFadeTo(a, 0.25, false); cur = a;
    if (once) { clearTimeout(play.t); play.t = setTimeout(() => play('idle'), a.getClip().duration * 1000 + 80); } };
  play('idle'); scene.add(g);
  host = { g, h: hgt, mixer, play, acts, root }; window.__dbg.host = host;
  placeHost();
}
// the chibi's clips turn her hips (idle drifts ~45°, cheer swings): keep her facing where the group points
const _hm = new THREE.Matrix4();
function pinFacing() {
  const h = host; if (!h.hips) { h.root.traverse(o => { if (o.isBone && !h.hips && /hip/i.test(o.name)) h.hips = o; }); if (!h.hips) return; }
  h.g.updateMatrixWorld(true); _hm.copy(h.g.matrixWorld).invert().multiply(h.hips.matrixWorld);
  const e = _hm.elements, yaw = Math.atan2(e[8], e[10]);
  let d = 1.5 + Math.PI - yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); h.root.rotation.y += d * 0.5;
}
function placeHost() {
  if (!host) return;
  const por = innerWidth / innerHeight < 0.8, hh = por ? 11 : 12;
  host.g.scale.setScalar(hh / host.h);
  if (mode === 'home' && por) { host.g.scale.setScalar(6.8 / host.h); host.g.position.set(4.6, BENCH_Y, 3.6); host.g.rotation.y = 1.25; host.g.visible = true; }
  else if (mode === 'home') { host.g.position.set(7.2, FLOOR_Y, 9); host.g.rotation.y = 1.2; host.g.visible = true; }
  else if (!por) { host.g.scale.setScalar(7.5 / host.h); host.g.position.set(-7.6, BENCH_Y, 1.6); host.g.rotation.y = 1.55 + HOST_YAW; host.g.visible = true; }
  else host.g.visible = false;
}

// ------------------------------------------------------------------ sparkles + rings
const SPN = 420, spPos = new Float32Array(SPN * 3), spCol = new Float32Array(SPN * 3), spV = new Float32Array(SPN * 3), spL = new Float32Array(SPN), spC = new Float32Array(SPN * 3), spG = new Float32Array(SPN);
const spGeo = new THREE.BufferGeometry(); spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3)); spGeo.setAttribute('color', new THREE.BufferAttribute(spCol, 3));
const sparks = new THREE.Points(spGeo, new THREE.PointsMaterial({ size: 0.32, map: starTex(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
sparks.frustumCulled = false; scene.add(sparks); spPos.fill(-999);
let spI = 0;
function sparkle(p, color, n = 22, speed = 3, grav = 6) {
  const c = new THREE.Color(color);
  for (let k = 0; k < n; k++) {
    const i = spI = (spI + 1) % SPN, a = Math.random() * Math.PI * 2, b = Math.acos(Math.random() * 2 - 1), s = speed * (0.35 + Math.random() * 0.8);
    spPos[i * 3] = p.x; spPos[i * 3 + 1] = p.y; spPos[i * 3 + 2] = p.z;
    spV[i * 3] = Math.sin(b) * Math.cos(a) * s; spV[i * 3 + 1] = Math.cos(b) * s + speed * 0.4; spV[i * 3 + 2] = Math.abs(Math.sin(b) * Math.sin(a)) * s;
    const w = Math.random() < 0.35; spC[i * 3] = w ? 1 : c.r; spC[i * 3 + 1] = w ? 1 : c.g; spC[i * 3 + 2] = w ? 1 : c.b; spL[i] = 0.6 + Math.random() * 0.5; spG[i] = grav;
  }
}
function updSparks(dt) {
  for (let i = 0; i < SPN; i++) {
    if (spL[i] <= 0) continue; spL[i] -= dt * 1.3;
    if (spL[i] <= 0) { spPos[i * 3 + 1] = -999; spCol[i * 3] = spCol[i * 3 + 1] = spCol[i * 3 + 2] = 0; continue; }
    spV[i * 3 + 1] -= spG[i] * dt; for (let k = 0; k < 3; k++) { spPos[i * 3 + k] += spV[i * 3 + k] * dt; spV[i * 3 + k] *= 0.97; spCol[i * 3 + k] = spC[i * 3 + k] * Math.min(1, spL[i] * 1.6); }
  }
  spGeo.attributes.position.needsUpdate = true; spGeo.attributes.color.needsUpdate = true;
}
// candy sprinkles: tiny instanced capsules that tumble when a plate plops off
const CHN = 60, chips = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.045, 0.14, 4, 8), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35 }), CHN);
const SPRINK = ['#ff6fae', '#ffd23f', '#6fd6ff', '#9be29a', '#c79bff', '#ffffff'].map(c => new THREE.Color(c));
for (let i = 0; i < CHN; i++) chips.setColorAt(i, SPRINK[i % SPRINK.length]);
chips.count = CHN; chips.frustumCulled = false; scene.add(chips);
const chipS = Array.from({ length: CHN }, () => ({ p: new V3(0, -999, 0), v: new V3(), r: new V3(), w: new V3(), l: 0 }));
let chI = 0; const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s3 = new V3();
function woodChips(p, n = 10) { for (let k = 0; k < n; k++) { const c = chipS[chI = (chI + 1) % CHN]; c.p.copy(p); c.v.set((Math.random() - 0.5) * 5, Math.random() * 4 + 1, Math.random() * 3); c.w.set(Math.random() * 12, Math.random() * 12, Math.random() * 12); c.l = 1; } }
function updChips(dt) {
  for (let i = 0; i < CHN; i++) { const c = chipS[i]; if (c.l > 0) { c.l -= dt * 0.9; c.v.y -= 14 * dt; c.p.addScaledVector(c.v, dt); c.r.addScaledVector(c.w, dt); if (c.l <= 0) c.p.y = -999; }
    _e.set(c.r.x, c.r.y, c.r.z); _q.setFromEuler(_e); _s3.setScalar(c.l > 0 ? Math.min(1, c.l * 3) : 0.0001); _m4.compose(c.p, _q, _s3); chips.setMatrixAt(i, _m4); }
  chips.instanceMatrix.needsUpdate = true;
}
// glow rings under the selected screw / hint targets
const glowMat = new THREE.MeshBasicMaterial({ color: '#fff6c0', transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
const glows = Array.from({ length: 12 }, () => { const m = new THREE.Mesh(new THREE.RingGeometry(0.31, 0.47, 40), glowMat.clone()); m.visible = false; scene.add(m); return m; });
function setGlows(list) { glows.forEach((g, i) => { const p = list[i]; g.visible = !!p; if (p) { g.position.set(p.x, p.y, p.z); g.material.color.set(p.c || '#fff2a8'); g.userData.k = p.k || 1; } }); }

// ------------------------------------------------------------------ layout / camera
const L = { w: 0, h: 0, ppu: 50 };
const CAM = { pos: new V3(0, 1, 40), look: new V3(0, 1, 0), tPos: new V3(0, 1, 40), tLook: new V3(0, 1, 0), off: 0, tOff: 0 };
let mode = 'home';
function fitDistance(xr, y0, y1, availW, availH, pitch) {
  // straight-on approximation of the camera distance that fits [−xr, xr] × [y0, y1] into availW × availH pixels
  const vf = THREE.MathUtils.degToRad(camera.fov), hFit = (y1 - y0) / (2 * Math.tan(vf / 2)) * (L.h / availH);
  const wFit = (2 * xr) / (2 * Math.tan(vf / 2) * camera.aspect) * (L.w / availW);
  return Math.max(hFit, wFit) / Math.cos(pitch) + 0.6;
}
function views() {
  const por = L.w / L.h < 0.8;
  // play: board + boxes between the top HUD and the booster bar
  const top = 74, bot = por ? 98 : 104, aw = L.w - 10, ah = L.h - top - bot;
  const pitch = THREE.MathUtils.degToRad(5);
  const d = fitDistance(3.95, -4.45, 7.15, aw, ah, pitch), cy = (7.15 - 4.45) / 2;
  const shift = ((top - bot) / 2) / L.h * (2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));   // centre the content in the free band
  L.play = { pos: new V3(0, cy + Math.sin(pitch) * d + shift, Math.cos(pitch) * d), look: new V3(0, cy + shift, 0) };
  L.ppu = ah / (11.6 * Math.max(1, (d / Math.cos(pitch)) / fitDistance(3.95, -4.45, 7.15, aw, ah, pitch)));
  // home: the workshop: board on the wall, bench, Otto
  const hd = por ? 52 : 46;
  L.home = { pos: new V3(por ? -0.8 : -5.5, por ? 3.5 : 1.0, hd), look: new V3(por ? -0.8 : -5.5, por ? -2.2 : -3.2, 0) };
}
function layout() {
  L.w = innerWidth; L.h = innerHeight; R.setSize(L.w, L.h); C.resize(L.w, L.h); camera.aspect = L.w / L.h;
  camera.fov = L.w / L.h < 0.62 ? 34 : 30; camera.updateProjectionMatrix();
  views(); const v = mode === 'play' ? L.play : L.home; CAM.tPos.copy(v.pos); CAM.tLook.copy(v.look);
  placeHost();
}
function setMode(m, snap = false) {
  mode = m; const v = m === 'play' ? L.play : L.home; CAM.tPos.copy(v.pos); CAM.tLook.copy(v.look);
  if (snap) { CAM.pos.copy(v.pos); CAM.look.copy(v.look); }
  placeHost();
}
function project(p) { const v = p.clone().project(camera); return { x: (v.x + 1) / 2 * L.w, y: (1 - v.y) / 2 * L.h }; }

// ------------------------------------------------------------------ level state
let S = null, Lv = null, state = 'ready', busy = 0;
const vis = { plates: [], screws: [], boxes: [] };   // visual twins of S
const anims = [];                                     // { t, dur, fn(k), done() }
function tween(dur, fn, done, delay = 0) { const a = { t: -delay, dur, fn, done }; anims.push(a); return a; }
const plateZ = d => 0.16 + (d - 1) * 0.27;
const THICK = 0.18;
function seatZ(s) { // z of the head base for a screw in its hole
  if (s.plate >= 0) { const pl = S.plates[s.plate]; return plateZ(pl.depth) + pl.i * 0.002 + THICK; }
  return S.holes[s.hole] && S.holes[s.hole].kind === 'spare' ? 0.1 : 0.02;
}

function levelParams(n) {
  if (Lv && Lv.daily) return { ...G.params(23, 1), hard: false, spare: 5, n: 'daily' };
  return G.params(n, F.k());
}
function clearLevel() {
  for (const v of vis.plates) lvlG.remove(v.g);
  for (const v of vis.screws) { if (v.g.parent) v.g.parent.remove(v.g); }
  for (const b of vis.boxes) if (b && b.g) boxG.remove(b.g);
  vis.plates = []; vis.screws = []; vis.boxes = []; anims.length = 0; setGlows([]); hideHand();
}
function startLevel(opt = {}) {
  snd.unlock();
  clearLevel();
  const isDaily = opt.daily ?? (D.isDaily && !save.__dailyPlayedThisLoad);
  const n = isDaily ? 'daily' : save.level;
  Lv = { n, daily: isDaily, t: 0, moves: 0, revived: 0, recorded: false, done: false, holesAdded: 0, filled: [], drill: false, beat: false };
  const P = isDaily ? { ...G.params(23, 1), hard: false, spare: 5 } : G.params(n, F.k());
  const seed = isDaily ? D.seed : n * 1009 + 7;
  const LD = G.genLevel(P, seed);
  Lv.hard = !!P.hard; Lv.L = LD; Lv.par = 10 + LD.screws.length * 2.6 + (Lv.hard ? 8 : 0);
  S = G.makeState(LD);
  // plates
  for (const pl of S.plates) {
    const screwPts = [...pl.screws].map(i => [S.screws[i].x, S.screws[i].y]);
    const g = makePlate(pl, screwPts, THICK); g.position.z = plateZ(pl.depth) + pl.i * 0.002;
    lvlG.add(g); vis.plates.push({ g, pl, vy: 0, vz: 0, wz: 0, fall: 0, z0: g.position.z, wob: 0 });
  }
  // grid holes (under the screws) + spare holes
  paintHoles();
  // screws
  for (const s of S.screws) {
    const g = makeScrew(s.color); g.position.set(s.x, s.y, seatZ(s)); g.spin.rotation.z = Math.random() * 6; lvlG.add(g);
    vis.screws.push({ g, s, st: 'seat', lift: 0, bob: Math.random() * 6, sq: 0 });
  }
  // boxes
  S.slots.forEach((bi, k) => { if (bi >= 0) arriveBox(k, S.boxes[bi], 0.15 + k * 0.12); });
  state = 'play'; busy = 0; sel = null;
  B.start();
  setMode('play');
  hud(); refreshBoosters();
  $('#hud').classList.remove('off'); $('#bottom').classList.remove('off'); $('#home').classList.add('hide');
  snd.music(true); host && host.play('idle');
  M.level(typeof n === 'number' ? n : save.level);
  tutorial(0);
  // the board shakes in: plates drop onto it
  vis.plates.forEach((v, i) => { const z0 = v.z0; v.g.position.z = z0 + 3; v.g.scale.setScalar(1); tween(0.45, k => { v.g.position.z = z0 + 3 * (1 - easeBack(k)); }, () => { v.g.position.z = z0; if (i % 2 === 0) snd.clack(); }, 0.05 + i * 0.05); });
  vis.screws.forEach((v, i) => { const z = v.g.position.z; v.g.position.z = z + 3.4; tween(0.4, k => { v.g.position.z = z + 3.4 * (1 - easeBack(k)); v.g.spin.rotation.z += 0.2; }, null, 0.25 + i * 0.025); });
}
function spareCount() { return S.holes.filter(h => h.kind === 'spare').length; }
function paintHoles() {
  const list = [];
  for (const h of S.holes) list.push({ x: h.x, y: h.y, z: h.kind === 'spare' ? 0.07 : 0.0, s: h.kind === 'spare' ? 1.05 : 0.92 });
  spareHoles.set(list);
}
function addSpareHole() {
  const n = spareCount(); if (n >= 7) return false;
  S.holes.push({ i: S.holes.length, x: 0, y: G.SPARE_Y, kind: 'spare', screw: null });
  const sp = S.holes.filter(h => h.kind === 'spare'); sp.forEach((h, k) => { h.x = G.spareX(k, sp.length); if (h.screw !== null) { const s = S.screws[h.screw]; s.x = h.x; const v = vis.screws[s.i]; const x0 = v.g.position.x; tween(0.3, k2 => { v.g.position.x = x0 + (h.x - x0) * ease(k2); }); } });
  paintHoles(); snd.unlock2(); sparkle(new V3(sp[sp.length - 1].x, G.SPARE_Y, 0.4), '#ffe9a8', 26);
  return true;
}

// ------------------------------------------------------------------ boxes
const SLOT_X = [-1.62, 1.62], BOX_Y = 6.12, BOX_Z = 0.62;
function arriveBox(slot, b, delay = 0) {
  const g = makeBox(b.color); boxG.add(g);
  const vb = { g, b, slot, ready: false, gone: false, readyAt: performance.now() / 1000 + delay + 0.5 };
  vis.boxes[b.i] = vb;
  const x1 = SLOT_X[slot], x0 = slot ? 8 : -8;
  g.position.set(x0, BOX_Y, BOX_Z);
  tween(0.5, k => { g.position.x = x0 + (x1 - x0) * easeBack(k); g.rotation.z = (1 - k) * (slot ? 0.25 : -0.25) * Math.sin(k * 9); }, () => { vb.ready = true; snd.slideIn(); g.position.x = x1; g.rotation.z = 0; }, delay);
  hudNext();
  return vb;
}
function departBox(vb) {
  vb.gone = true; const g = vb.g;
  snd.boxFull(); sparkle(g.position.clone().add(new V3(0, 0.4, 0.6)), SCREW[vb.b.color].c, 34, 4); ring(g.position.clone().add(new V3(0, 0, 0.7)), 0.8);
  buzz(18);
  const x0 = g.position.x, dir = vb.slot ? 1 : -1;
  tween(0.24, k => { const s = 1 + Math.sin(k * Math.PI) * 0.16; g.scale.set(s, 2 - s, s); }, null);
  tween(0.42, k => { g.position.x = x0 + dir * 9 * k * k; g.position.y = BOX_Y + Math.sin(k * Math.PI) * 0.8; g.rotation.z = -dir * k * 0.5; }, () => {
    boxG.remove(g);
    for (const v of vis.screws) if (v.boxRef === vb) { v.st = 'gone'; }
  }, 0.26);
  Lv.filled.push(vb.b.color);
}
function boxSlotWorld(vb, k) { vb.g.updateMatrixWorld(true); return vb.g.localToWorld(vb.g.userData.slots[k].clone()); }

// ------------------------------------------------------------------ moves (logic + animation)
let sel = null;   // the lifted screw (visual record)
function liftVisual(v, on) {
  if (on) { v.st = 'lift'; snd.unscrew(); buzz(8); }
  else if (v.st === 'lift') { v.st = 'seat'; snd.seat(); }
}
function commit(v, target, viaDrill = false) {
  // target: { box: logic box } | { hole: logic hole }
  const s = v.s, from = v.g.position.clone();
  if (s.plate >= 0 && vis.plates[s.plate]) vis.plates[s.plate].jig = 0.7;
  const { fell, swing } = G.lift(S, s);
  if (target.box) { G.putBox(S, s, target.box); s.slot = target.box.n - 1; } else G.putHole(S, s, target.hole);
  S.moves++; Lv.moves++;
  sel = null; setGlows([]);
  if (swing) startSwing(swing);
  if (fell) startFall(fell);
  flyScrew(v, from, target, viaDrill ? 0 : (v.lift > 0.6 ? 0.05 : 0.16));
  settleLogic();
  hideHand(); tutorial(1);
}
function flyScrew(v, from, target, unscrewT) {
  v.st = 'fly'; const s = v.s;
  let vb = null; if (target.box) vb = vis.boxes[target.box.i];
  const slot = s.slot;
  const start = () => {
    const to = vb ? boxSlotWorld(vb, slot) : new V3(target.hole.x, target.hole.y, seatZ(s));
    const p0 = v.g.position.clone(), mid = p0.clone().lerp(to, 0.5); mid.z += 2.2; mid.y += 0.6;
    v.g.updateMatrixWorld();
    tween(0.36, k => { const e = ease(k), a = 1 - e; v.g.position.set(0, 0, 0).addScaledVector(p0, a * a).addScaledVector(mid, 2 * a * e).addScaledVector(to, e * e); v.g.spin.rotation.z -= 0.35; },
      () => {
        if (vb) { boxG.attach(v.g); vb.g.attach(v.g); v.boxRef = vb; v.g.position.copy(vb.g.userData.slots[slot]); v.g.position.z += 0.02; }
        else v.g.position.copy(to);
        v.st = 'screw'; v.sq = 1; const z = v.g.position.z;
        tween(0.2, k => { v.g.position.z = z + 0.5 * (1 - k); v.g.spin.rotation.z -= 0.55; }, () => {
          v.st = vb ? 'box' : 'seat'; v.g.position.z = z;
          if (vb) { snd.box(slot); sparkle(boxSlotWorld(vb, slot), SCREW[s.color].c, 10, 2); if (vb.b.done && vis.screws.filter(o => o.boxRef === vb && o.st === 'box').length >= 3) departBox(vb); }
          else { snd.seat(0); sparkle(v.g.position.clone(), '#fff3cf', 6, 1.4); }
        });
      });
  };
  // unscrew up first, then fly once the box is in place
  const z0 = from.z, up = Math.max(0, 0.75 - (v.g.position.z - seatZ0(v)));
  tween(unscrewT, k => { v.g.position.z = from.z + up * k; v.g.spin.rotation.z += 0.5; }, () => {
    const wait = vb ? Math.max(0, vb.readyAt - performance.now() / 1000) : 0;
    if (wait > 0.01) tween(wait, () => { v.g.spin.rotation.z += 0.05; }, start); else start();
  });
  void z0;
}
const seatZ0 = v => v.z0 ?? v.g.position.z;
/** logic follow-ups: full boxes leave and new ones arrive, loose screws auto-collect */
function settleLogic() {
  for (let guard = 0; guard < 20; guard++) {
    if (G.fullBoxInSlot(S)) {
      const arr = G.advanceBoxes(S);
      for (const { slot, box } of arr) {
        // wait for the departing box in this slot
        const leaving = vis.boxes.find(vb => vb && !vb.gone && vb.slot === slot && vb.b.done);
        const delay = leaving ? 1.15 : 0.1;
        arriveBox(slot, box, delay);
      }
      continue;
    }
    const a = G.autoCollect(S); if (!a.length) break;
    for (const { s, b } of a) {
      const v = vis.screws[s.i]; const h = S.holes[s.hole]; h.screw = null; s.hole = -1; G.putBox(S, s, b); s.slot = b.n - 1;
      flyScrew(v, v.g.position.clone(), { box: b }, 0.12);
    }
  }
  hud();
}
function startSwing(pl) {
  const v = vis.plates[pl.i]; const [px, py] = pl.pin;
  v.g.position.x = px; v.g.position.y = py; v.g.userData.inner.position.set(-px, -py, 0);
  const vx = pl.com[0] - px, vy = pl.com[1] - py, d2 = vx * vx + vy * vy;
  let k2 = 0; for (const p of pl.poly) k2 += (p[0] - pl.com[0]) ** 2 + (p[1] - pl.com[1]) ** 2; k2 = k2 / pl.poly.length * 0.55 + 0.12;
  v.K = 24 * Math.sqrt(d2) / (k2 + d2); pl.w = 0; snd.swing(); v.swing = true;
}
function startFall(pl) {
  const v = vis.plates[pl.i]; pl.falling = true;
  if (!pl.pin) { const c = pl.com; v.g.position.x = c[0]; v.g.position.y = c[1]; v.g.userData.inner.position.set(-c[0], -c[1], 0); }
  v.fall = 1; v.vy = 1.2; v.vz = 3.2 + Math.random(); v.wz = (Math.random() - 0.5) * 3 + (pl.w || 0) * 0.6; v.wx = -1.2 - Math.random();
  snd.drop(pl.poly.length); buzz(14);
  const c = new V3(pl.com[0], pl.com[1], plateZ(pl.depth) + 0.3);
  woodChips(c, 14); sparkle(c, JELLY[pl.color % JELLY.length], 18, 2.6); jellyPop(v);
  host && Math.random() < 0.5 && host.play('cheer', true);
  const left = G.platesLeft(S);
  if (left && Lv.combo) {}
  if (!left) setTimeout(() => winLevel(), 900);
}
function jellyPop(v) { v.jig = 1; }
const ringMeshes = Array.from({ length: 4 }, () => { const m = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.9, 40), new THREE.MeshBasicMaterial({ color: '#fff4c2', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); m.visible = false; scene.add(m); m.userData.t = 1; return m; });
let ringI = 0;
function ring(p, s = 1) { const r = ringMeshes[ringI = (ringI + 1) % 4]; r.position.copy(p); r.userData = { t: 0, s }; r.visible = true; }

// ------------------------------------------------------------------ input
const _ndc = new V3();
function pickables() {
  const out = [];
  for (const v of vis.screws) if (v.st === 'seat' || v.st === 'lift') { const p = v.g.position; out.push({ kind: 'screw', v, p: new V3(p.x, p.y, p.z + 0.1) }); }
  if (sel) {
    for (const h of S.holes) if (h.kind === 'spare' && G.holeFree(S, h)) out.push({ kind: 'hole', h, p: new V3(h.x, h.y, 0.1) });
    for (const vb of vis.boxes) if (vb && !vb.gone && !vb.b.done) out.push({ kind: 'box', vb, p: vb.g.position.clone().add(new V3(0, 0, 0.5)), r: 1.25 });
  } else for (const vb of vis.boxes) if (vb && !vb.gone && !vb.b.done) out.push({ kind: 'box', vb, p: vb.g.position.clone().add(new V3(0, 0, 0.5)), r: 1.25 });
  return out;
}
function pickAt(x, y) {
  let best = null, bd = 1e9;
  const ppu = pxPerUnit();
  for (const c of pickables()) {
    const q = project(c.p), d = Math.hypot(q.x - x, q.y - y), r = (c.r || 0.52) * ppu;
    const score = d / Math.max(18, r);
    if (d < Math.max(24, r) && score < bd) { bd = score; best = c; }
  }
  return best;
}
function pxPerUnit() { const a = project(new V3(0, 0, 0)), b = project(new V3(1, 0, 0)); return Math.abs(b.x - a.x); }
function onTap(x, y) {
  if (state !== 'play') return;
  const c = pickAt(x, y);
  if (Lv.drill) {
    if (c && c.kind === 'screw') return drillOut(c.v);
    Lv.drill = false; refreshBoosters(); return;
  }
  if (!c) { if (sel) { liftVisual(sel, false); sel = null; setGlows([]); } return; }
  if (c.kind === 'screw') {
    const v = c.v, s = v.s;
    if (G.blocked(S, s)) { denyBlocked(v); return; }
    if (sel === v) {   // second tap on the lifted screw: send it to the best place
      const b = G.boxFor(S, s.color); if (b) return commit(v, { box: b });
      const h = S.holes.find(h => h.kind === 'spare' && G.holeFree(S, h)); if (h && s.plate >= 0) return commit(v, { hole: h });
      liftVisual(v, false); sel = null; setGlows([]); return;
    }
    if (sel) liftVisual(sel, false);
    if (s.plate < 0 && !G.boxFor(S, s.color)) { // a loose screw only moves to its box
      sel = null; setGlows([]); snd.deny(); toast('Waiting for its gift box', true); return;
    }
    sel = v; liftVisual(v, true); showTargets(v); tutorial(0.5);
    return;
  }
  if (!sel) { if (c.kind === 'box') { shakeBox(c.vb); } return; }
  if (c.kind === 'hole') { if (sel.s.plate < 0) { snd.deny(); return; } return commit(sel, { hole: c.h }); }
  if (c.kind === 'box') {
    const b = c.vb.b;
    if (b.color === sel.s.color && b.n < 3) return commit(sel, { box: b });
    shakeBox(c.vb); snd.deny(); return;
  }
}
function showTargets(v) {
  const list = [], b = G.boxFor(S, v.s.color);
  if (b) { const vb = vis.boxes[b.i]; if (vb) list.push({ ...boxSlotWorld(vb, b.n), c: '#fff6b8', k: 1.2 }); }
  if (v.s.plate >= 0) for (const h of S.holes) if (h.kind === 'spare' && G.holeFree(S, h)) list.push({ x: h.x, y: h.y, z: 0.16, c: '#ffe2a0', k: 0.9 });
  setGlows(list);
}
function denyBlocked(v) {
  snd.deny(); buzz(10);
  const s = v.s, h = S.holes[s.hole];
  for (const pl of S.plates) if (pl.depth > G.screwDepth(S, s) && G.covers(pl, h.x, h.y, G.HEAD * 0.55)) vis.plates[pl.i].wob = 1;
  if (!save.tut || save.tut < 3) toast('Covered! Free the jelly on top first', true);
}
function shakeBox(vb) { const g = vb.g, x = g.position.x; tween(0.3, k => { g.position.x = x + Math.sin(k * 30) * 0.12 * (1 - k); }, () => g.position.x = x); }
let downAt = null;
R.domElement.addEventListener('pointerdown', e => { downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; });
R.domElement.addEventListener('pointerup', e => { if (!downAt) return; if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 18) onTap(e.clientX, e.clientY); downAt = null; });

// ------------------------------------------------------------------ boosters
const COST = { hint: 40, drill: 70, hole: 90 };
function refreshBoosters() {
  for (const b of document.querySelectorAll('.bst')) {
    const k = b.dataset.k, n = save.boost[k] || 0, el = b.querySelector('b');
    if (n) { el.className = ''; el.textContent = n; } else { el.className = 'buy'; el.innerHTML = coinSVG() + COST[k]; }
    b.classList.toggle('armed', k === 'drill' && !!(Lv && Lv.drill));
  }
}
async function useBooster(k) {
  if (state !== 'play') return false;
  if (k === 'drill' && Lv.drill) { Lv.drill = false; refreshBoosters(); return false; }
  if (k === 'hole' && spareCount() >= 7) { toast('The strip is full', true); return false; }
  if (!(save.boost[k] > 0)) {
    // out: hint can be watched for; everything can be bought with coins (one offer)
    if (k === 'hint') { const ok = await M.rewarded('hint'); if (!ok) return false; save.boost.hint = (save.boost.hint || 0) + 1; }
    else if (M.spend(COST[k], 'booster:' + k)) { save.boost[k] = (save.boost[k] || 0) + 1; snd.coin(); }
    else { toast('Not enough coins', true); M.shop(); return false; }
  }
  let ok = false;
  if (k === 'hint') ok = showHint();
  if (k === 'drill') { Lv.drill = true; ok = true; toast('Tap any pin to pop it out', true); refreshBoosters(); return true; }
  if (k === 'hole') ok = addSpareHole();
  if (ok) { save.boost[k]--; persist(); }
  refreshBoosters();
  return ok;
}
function showHint() {
  const m = G.bestMove(S); if (!m) { toast('No moves left', true); return false; }
  const v = vis.screws[m.s.i]; snd.hint();
  const list = [{ x: v.g.position.x, y: v.g.position.y, z: v.g.position.z + 0.18, c: '#9ff0ff', k: 1.3 }];
  if (m.box) { const vb = vis.boxes[m.box.i]; if (vb) list.push({ ...boxSlotWorld(vb, m.box.n), c: '#9ff0ff', k: 1.2 }); }
  else list.push({ x: m.hole.x, y: m.hole.y, z: 0.16, c: '#9ff0ff', k: 1 });
  setGlows(list); showHandAt(v.g.position);
  setTimeout(() => { if (!sel) setGlows([]); hideHand(); }, 2600);
  return true;
}
function drillOut(v) {
  const s = v.s;
  if (v.st !== 'seat' && v.st !== 'lift') return;
  const b = G.boxFor(S, s.color), h = S.holes.find(h => h.kind === 'spare' && G.holeFree(S, h));
  if (!b && !(h && s.plate >= 0)) { snd.deny(); toast('No room for it yet', true); return; }
  Lv.drill = false; save.boost.drill--; persist(); refreshBoosters();
  snd.drill(); woodChips(v.g.position.clone(), 12);
  if (sel && sel !== v) liftVisual(sel, false);
  commit(v, b ? { box: b } : { hole: h }, true);
}
for (const b of document.querySelectorAll('.bst')) b.addEventListener('click', e => { e.stopPropagation(); useBooster(b.dataset.k); });

// ------------------------------------------------------------------ win / lose
function stars() { const t = Lv.t; return t <= Lv.par ? 3 : t <= Lv.par * 1.7 ? 2 : 1; }
function record(won) {
  if (Lv.recorded || Lv.daily) return; Lv.recorded = true;
  F.level(won, won ? 1 : 1 - G.platesLeft(S) / S.plates.length);
}
function winLevel() {
  if (state !== 'play') return;
  state = 'won'; record(true); sel = null; setGlows([]); hideHand();
  const st = stars(), n = Lv.n, ms = Math.round(Lv.t * 1000);
  let gained = 0;
  if (Lv.daily) {
    const today = dayNum();
    if (save.dailyDone !== today) { gained = st; save.dailyDone = today; dailyStreakWin(today); }
  } else {
    const prev = save.stars[n] || 0; if (st > prev) { gained = st - prev; save.stars[n] = st; }
    save.level = n + 1;
  }
  if (gained > 0) B.submit(gained, { ms });
  D.won(st, 'earned stars on');
  // leftover loose screws pop for a bonus
  let bonus = 0;
  for (const v of vis.screws) if (v.st === 'seat') { bonus++; const p = v.g.position.clone(); tween(0.3, k => { v.g.scale.setScalar(1 + k * 0.6); v.g.position.z = p.z + k * 1.5; }, () => { v.g.visible = false; sparkle(p, SCREW[v.s.color].c, 12, 3); snd.pop(); }, bonus * 0.08); }
  const coins = (10 + st * 5) * (Lv.hard ? 2 : 1) + (Lv.daily ? 25 : 0) + bonus * 2;
  Lv.coins = coins; M.add(coins, Lv.daily ? 'daily' : 'win');
  const sticker = dropSticker();
  persist();
  snd.win(); buzz([20, 40, 20]); host && host.play('cheer', true);
  for (let i = 0; i < 4; i++) setTimeout(() => sparkle(new V3((Math.random() - 0.5) * 6, 1 + Math.random() * 4, 2), ['#ffd56b', '#ff9ab0', '#8fd3ff', '#9be29a'][i], 40, 5), i * 160);
  setTimeout(() => { $('#bottom').classList.add('off'); showWin(st, coins, sticker, gained); }, 700);
}
function loseLevel() {
  if (state !== 'play') return;
  state = 'lost'; sel = null; setGlows([]); hideHand(); snd.lose();
  setTimeout(() => { $('#bottom').classList.add('off'); showLose(); }, 500);
}
function revive() {   // continue the same level with one more spare hole (never changes difficulty otherwise)
  state = 'play'; Lv.revived++; addSpareHole(); $('#lose').classList.add('hide'); $('#bottom').classList.remove('off'); snd.music(true);
}

// ------------------------------------------------------------------ daily streak with a weekly freeze
function dayNum(d = new Date()) { return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 864e5); }
function dailyStreakWin(today) {
  const z = save.dstreak, week = Math.floor((today + 3) / 7);
  if (z.last === today) return;
  if (z.last === today - 1) z.n++;
  else if (z.last === today - 2 && z.freezeWeek !== week) { z.n++; z.freezeWeek = week; z.froze = today; }   // one free streak freeze per week
  else z.n = 1;
  z.last = today;
}
function streakNow() { const z = save.dstreak, t = dayNum(); if (z.last >= t - 1) return z.n; if (z.last === t - 2 && z.freezeWeek !== Math.floor((t + 3) / 7)) return z.n; return 0; }
function shareGrid() {
  const d = new Date(), date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const sq = Lv.filled.map(c => SCREW[c].e).join('');
  const st = '⭐'.repeat(stars()) + '☆'.repeat(3 - stars());
  const mm = Math.floor(Lv.t / 60), ss = String(Math.floor(Lv.t % 60)).padStart(2, '0');
  const text = `Bowtwist Daily · ${date}\n${sq}\n${st} in ${mm}:${ss}${streakNow() > 1 ? ` · 🔥${streakNow()}` : ''}`;
  const url = location.origin + location.pathname + '?daily=1';
  (async () => {
    try { if (navigator.share) { await navigator.share({ title: NAME, text, url }); return; } } catch (e) { return; }
    try { await navigator.clipboard.writeText(text + '\n' + url); toast('Copied!', true); } catch (e) {}
  })();
}

// ------------------------------------------------------------------ album
function dropSticker() {
  const missing = ALBUM.filter(id => !save.album[id]);
  const pick = missing.length && Math.random() < 0.8 ? missing[Math.floor(Math.random() * missing.length)] : ALBUM[Math.floor(Math.random() * ALBUM.length)];
  const isNew = !save.album[pick]; save.album[pick] = (save.album[pick] || 0) + 1;
  if (!isNew) M.add(5, 'sticker-dupe');
  // a finished page pays once
  let page = null;
  for (const p of PAGES) if (!save.pagesPaid[p.id] && p.ids.every(id => save.album[id])) { save.pagesPaid[p.id] = 1; page = p; M.add(150, 'album-page'); for (const k in save.boost) save.boost[k]++; }
  return { id: pick, isNew, page };
}

// ------------------------------------------------------------------ HUD / screens
const coinSVG = () => `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10.2" fill="#ffd34d" stroke="#e08a1e" stroke-width="1.8"/><circle cx="12" cy="12" r="7.4" fill="#ffe680"/><path d="M12 17.2c-3.6-2.4-5.4-4.4-5.4-6.4 0-1.6 1.2-2.8 2.7-2.8 1.1 0 2 .6 2.7 1.6.7-1 1.6-1.6 2.7-1.6 1.5 0 2.7 1.2 2.7 2.8 0 2-1.8 4-5.4 6.4z" fill="#ff5fa8" stroke="#d93b88" stroke-width=".8"/><circle cx="9.4" cy="10.4" r="1" fill="#fff" opacity=".8"/></svg>`;
const starSVG = (c = '#ffcf3f') => `<svg viewBox="0 0 24 24"><path d="M12 2.2l2.9 6.2 6.8.8-5 4.6 1.4 6.7L12 17.1l-6.1 3.4 1.4-6.7-5-4.6 6.8-.8z" fill="${c}" stroke="#c97a12" stroke-width="1.4" stroke-linejoin="round"/><path d="M9 8.6l1.6-3.2" stroke="#fff8d0" stroke-width="1.4" stroke-linecap="round"/></svg>`;
function coinsHTML() { return `${coinSVG()}<span>${M.coins().toLocaleString()}</span><span class="plus">+</span>`; }
function hud() {
  if (!Lv) return;
  $('#lvlTxt').textContent = Lv.daily ? 'Daily' : `Level ${Lv.n}`;
  const tag = $('#tag'); tag.hidden = !(Lv.hard || Lv.daily); tag.textContent = Lv.daily ? 'DAILY' : 'HARD'; tag.className = 'tag' + (Lv.daily ? ' daily' : '');
  hudNext();
}
function hudNext() {
  if (!S) return; const q = S.boxes.slice(S.next, S.next + 3);
  $('#next').innerHTML = q.length ? `NEXT ${q.map(b => `<i style="background:${SCREW[b.color].c}"></i>`).join('')}` : '';
  $('#next').style.opacity = q.length ? 1 : 0;
}
function paintMeter() { const st = state === 'play' && Lv ? stars() : 3; $('#meter').innerHTML = [0, 1, 2].map(i => `<i class="${i < st ? '' : 'off'}">${starSVG()}</i>`).join(''); }
function paintCoins() { for (const id of ['#coinsHud', '#coinsHome']) $(id).innerHTML = coinsHTML(); }
M.onChange(() => paintCoins());
for (const id of ['#coinsHud', '#coinsHome']) $(id).addEventListener('click', e => { e.stopPropagation(); M.shop(); });
const paintMute = () => { $('#muteBtn').innerHTML = `<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#ff8cc6" stroke="#5b2565" stroke-width="2" stroke-linejoin="round"/>${snd.muted ? '<path d="M16 9l5 6M21 9l-5 6" stroke="#5b2565" stroke-width="2.2" stroke-linecap="round"/>' : '<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="#5b2565" stroke-width="2" stroke-linecap="round" fill="none"/>'}</svg>`; };
$('#muteBtn').addEventListener('click', e => { e.stopPropagation(); snd.toggle(); paintMute(); });
$('#homeBtn').addEventListener('click', e => { e.stopPropagation(); goHome(); });
let toastEl = null;
function toast(t, small = false) { toastEl?.remove(); const d = toastEl = document.createElement('div'); d.className = 'toast' + (small ? ' small' : ''); d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 1100); }

function goHome() {
  if (state === 'play' && Lv && !Lv.recorded && S && G.platesLeft(S) < S.plates.length) record(false);
  state = 'ready'; sel = null; setGlows([]); hideHand();
  $('#hud').classList.add('off'); $('#bottom').classList.add('off'); $('#win').classList.add('hide'); $('#lose').classList.add('hide');
  setMode('home'); renderHome(); $('#home').classList.remove('hide');
  snd.music(true);
}
function renderHome() {
  paintCoins();
  const sk = streakNow();
  $('#streakLine').innerHTML = D.isDaily ? `<span class="streak">📅 Daily puzzle${sk ? ` · 🔥 ${sk}` : ''}</span>` : sk > 1 ? `<span class="streak">🔥 ${sk}-day daily streak</span>` : '';
  const t = TASKS[save.tasks], bank = starBank();
  if (t) {
    $('#task').innerHTML = `<img src="assets/thumbs/${t.thumb}.webp" alt=""><div class="tt"><small>Momo's room · ${save.tasks}/${TASKS.length}</small><b>${t.name}</b><div class="bar"><i style="width:${Math.min(100, bank / t.cost * 100)}%"></i></div></div>
      <button id="restoreBtn" class="${bank >= t.cost ? 'go' : 'no'}">${starSVG()}${t.cost}</button>`;
    $('#restoreBtn').onclick = e => { e.stopPropagation(); restore(); };
  } else $('#task').innerHTML = `<img src="assets/thumbs/k01.webp" alt=""><div class="tt"><small>Momo's room</small><b>All decorated. So cute!</b></div>`;
  const hard = !D.isDaily && G.params(save.level).hard;
  $('#playBtn').innerHTML = D.isDaily && save.dailyDone !== dayNum() ? 'Daily Puzzle' : `Level ${save.level}${hard ? '<small>HARD</small>' : ''}`;
  const found = ALBUM.filter(id => save.album[id]).length;
  $('#chips').innerHTML = `<span class="chip">${starSVG()}${bank}</span>
    <span class="chip" id="albumChip"><img src="assets/thumbs/t02.webp" alt="">${found}/${ALBUM.length}</span>
    ${D.isDaily ? `<a class="chip" href="?" style="text-decoration:none">🎀 Levels</a>` : `<a class="chip ${save.dailyDone === dayNum() ? '' : 'hot'}" href="?daily=1" style="text-decoration:none">📅 Daily${sk ? ' 🔥' + sk : ''}</a>`}
    <span class="chip" id="muteChip">${snd.muted ? '🔇' : '🔊'}</span>`;
  $('#albumChip').onclick = e => { e.stopPropagation(); openAlbum(); };
  $('#muteChip').onclick = e => { e.stopPropagation(); snd.toggle(); paintMute(); renderHome(); };
}
$('#playBtn').addEventListener('click', e => { e.stopPropagation(); startFromHome(); });
function startFromHome() {
  if (D.isDaily && save.dailyDone === dayNum()) { save.__dailyPlayedThisLoad = true; }
  startLevel(); if (D.isDaily) save.__dailyPlayedThisLoad = true;
}
function restore() {
  const t = TASKS[save.tasks]; if (!t) return;
  if (starBank() < t.cost) { toast(`Need ${t.cost - starBank()} more ★`, true); snd.deny(); return; }
  save.spent += t.cost; save.tasks++; persist(); snd.restore(); buzz(20);
  const g = PROPS[t.id];
  if (g) { g.visible = true; const m = g.children[0], s0 = m.scale.x; tween(0.7, k => m.scale.setScalar(s0 * easeBack(k)), null); const p = new V3(...t.at); p.y += t.s * 0.5; for (let i = 0; i < 3; i++) setTimeout(() => sparkle(p, ['#ffe08a', '#ffffff', '#ffc2d1'][i], 40, 6, 3), i * 140); }
  if (t.id === 'bench') benchShine();
  host && host.play('cheer', true);
  atmos();
  renderHome();
}
function benchShine() {}
function atmos() { const k = save.tasks / TASKS.length; hemi.intensity = 0.7 + k * 0.25; fill.intensity = 0.45 + k * 0.25; }

function showWin(st, coins, sticker, gained) {
  const W = $('#win');
  const thumb = sticker ? `<div class="sticker"><img src="assets/thumbs/${sticker.id}.webp" alt=""><em>${sticker.isNew ? 'New sticker!' : 'Duplicate +5'}</em></div>` : '';
  W.innerHTML = `<div class="rays"></div><div class="sub">${Lv.daily ? 'Daily puzzle' : `Level ${Lv.n}`}${Lv.hard ? ' · Hard' : ''}</div><h2>${Lv.daily ? 'Solved!' : ['Done!', 'Nice!', 'Neat work!', 'Perfect!'][st]}</h2>
    <div class="stars">${[0, 1, 2].map(() => `<i>${starSVG()}</i>`).join('')}</div>
    <div class="rew"><span>${coinSVG()}+<b id="wc">${coins}</b></span>${gained ? `<span>${starSVG()}+${gained}</span>` : ''}</div>
    ${thumb}<div class="yay"><img src="assets/thumbs/k01.webp" alt=""><b>${['Yay!', 'Yay!', 'So cute!', 'Yay!'][st]}</b></div>${sticker && sticker.page ? `<div class="sub">Album page “${sticker.page.name}” complete! +150 coins</div>` : ''}
    <div class="tapon">Tap to continue</div>
    <div class="cardfoot">${Lv.daily ? '<button class="big sky" id="shareBtn">Share result</button>' : ''}<button class="big alt" id="dbl">▶ Watch · ×2 coins</button></div>`;
  W.classList.remove('hide');
  W.querySelectorAll('.stars i').forEach((el, i) => setTimeout(() => { if (i < st) { el.classList.add('on'); snd.star(i); } }, 300 + i * 260));
  const dbl = $('#dbl');
  dbl.addEventListener('pointerdown', e => e.stopPropagation());
  dbl.onclick = async e => { e.stopPropagation(); dbl.disabled = true; const ok = await M.rewarded('double'); if (ok) { M.add(Lv.coins, 'double'); $('#wc').textContent = Lv.coins * 2; snd.coin(); dbl.remove(); } else dbl.disabled = false; };
  const sb = $('#shareBtn'); if (sb) { sb.addEventListener('pointerdown', e => e.stopPropagation()); sb.onclick = e => { e.stopPropagation(); shareGrid(); }; }
  W.onpointerdown = async e => {
    if (e.target.closest('button')) return;
    W.onpointerdown = null; W.classList.add('hide');
    if (Lv.daily) { goHome(); return; }
    await M.breakAd('level-end', { level: Lv.n });   // natural break; the kit applies every cap
    startLevel();
  };
}
function showLose() {
  const W = $('#lose'), canHole = spareCount() < 7;
  W.innerHTML = `<div class="sub">${Lv.daily ? 'Daily puzzle' : `Level ${Lv.n}`}</div><h2>Out of holes!</h2>
    <div class="sub" style="max-width:300px">No pin can move. One more spare hole would do it.</div>
    <div class="tapon" style="margin-top:22px">Tap to try again</div>
    <div class="cardfoot">${canHole ? `<button class="big alt" id="rv">▶ Watch · +1 hole</button><button class="big sky" id="rvc">${coinSVG()} 90 · +1 hole</button>` : ''}</div>`;
  W.classList.remove('hide'); record(false);
  const foot = W.querySelector('.cardfoot'); foot.style.visibility = 'hidden'; setTimeout(() => { foot.style.visibility = ''; }, 1300);
  const rv = $('#rv'), rvc = $('#rvc');
  for (const b of [rv, rvc]) b && b.addEventListener('pointerdown', e => e.stopPropagation());
  if (rv) rv.onclick = async e => { e.stopPropagation(); rv.disabled = true; const ok = await M.rewarded('revive', { what: 'One more spare hole, keep this board' }); if (ok) revive(); else rv.disabled = false; };
  if (rvc) rvc.onclick = e => { e.stopPropagation(); if (M.spend(90, 'revive')) { snd.coin(); revive(); } else { toast('Not enough coins', true); M.shop(); } };
  W.onpointerdown = e => { if (e.target.closest('button')) return; W.onpointerdown = null; W.classList.add('hide'); startLevel({ daily: Lv.daily }); };
}
// sheets
function sheet(html) { $('#sheet').innerHTML = `<button class="x" id="sx">✕</button>` + html; $('#sheetbg').classList.remove('hide'); $('#sx').onclick = closeSheet; }
function closeSheet() { $('#sheetbg').classList.add('hide'); }
$('#sheetbg').addEventListener('pointerdown', e => { if (e.target.id === 'sheetbg') closeSheet(); });
function openAlbum() {
  const found = ALBUM.filter(id => save.album[id]).length;
  sheet(`<h3>Sticker Album</h3><div style="text-align:center;font-weight:800;opacity:.75">${found}/${ALBUM.length} · every win brings a sticker</div>` +
    PAGES.map(p => { const n = p.ids.filter(id => save.album[id]).length; return `<div class="pg"><span>${p.name}</span>${save.pagesPaid[p.id] ? '<span class="pgdone">Complete ✓</span>' : `<small>${n}/${p.ids.length} · page prize 150 coins</small>`}</div>
      <div class="grid">${p.ids.map((id, i) => `<div class="st8 ${save.album[id] ? 'yes' : 'no'}" style="--r:${(i % 3 - 1) * 3}deg"><img src="assets/thumbs/${id}.webp" alt="">${save.album[id] > 1 ? `<i>×${save.album[id]}</i>` : ''}</div>`).join('')}</div>`; }).join(''));
}

// ------------------------------------------------------------------ tutorial hand
let handEl = null, tipEl = null;
function showHandAt(p, tip) {
  const q = project(p); if (!handEl) { handEl = document.createElement('div'); handEl.className = 'hand'; handEl.innerHTML = `<svg viewBox="0 0 64 64"><path d="M22 30V12a5 5 0 0 1 10 0v14l2-1a5 5 0 0 1 6 2l1 1a5 5 0 0 1 6 2l1 1a5 5 0 0 1 6 3v12c0 9-6 15-15 15h-4c-6 0-10-3-13-8l-7-11a5 5 0 0 1 7-6z" fill="#fff" stroke="#5b2565" stroke-width="3" stroke-linejoin="round"/></svg>`; document.body.appendChild(handEl); }
  handEl.style.left = q.x + 'px'; handEl.style.top = q.y + 'px'; handEl.style.display = 'block';
  if (tip) { if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'tip'; document.body.appendChild(tipEl); } tipEl.textContent = tip; tipEl.style.top = Math.min(L.h - 150, q.y + 62) + 'px'; tipEl.style.opacity = 1; }
}
function hideHand() { if (handEl) handEl.style.display = 'none'; if (tipEl) tipEl.style.opacity = 0; }
function tutorial(step) {
  if (!Lv || Lv.daily || Lv.n !== 1 || save.tut >= 2) return;
  if (step === 0) {
    setTimeout(() => {
      if (state !== 'play' || sel) return;
      const m = G.bestMove(S); if (!m) return; const v = vis.screws[m.s.i];
      showHandAt(v.g.position, 'Tap a bow-pin to lift it');
    }, 1100);
  } else if (step === 0.5 && sel) {
    const b = G.boxFor(S, sel.s.color); if (b && vis.boxes[b.i]) showHandAt(boxSlotWorld(vis.boxes[b.i], b.n), 'Tap its colour box');
  } else if (step === 1) { save.tut = Math.max(save.tut, 1) + (Lv.moves >= 2 ? 1 : 0); persist(); if (save.tut < 2) tutorial(0); }
}

// ------------------------------------------------------------------ frame
let last = performance.now(), idleCheck = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  // tweens
  for (let i = anims.length - 1; i >= 0; i--) {
    const a = anims[i]; a.t += dt; if (a.t < 0) continue;
    const k = a.dur > 0 ? Math.min(1, a.t / a.dur) : 1; a.fn && a.fn(k);
    if (k >= 1) { anims.splice(i, 1); a.done && a.done(); }
  }
  if (state === 'play' && Lv) { Lv.t += dt; if ((Lv.t * 4 | 0) !== Lv.mt) { Lv.mt = Lv.t * 4 | 0; paintMeter(); } }
  // plates: swing, fall, wobble
  if (S) for (const v of vis.plates) {
    const pl = v.pl;
    if (v.fall) {
      v.vy -= 26 * dt; v.g.position.y += v.vy * dt; v.g.position.z += v.vz * dt; v.g.rotation.z += v.wz * dt; v.g.rotation.x += (v.wx || 0) * dt;
      if (v.g.position.y < -16 && v.g.parent) { lvlG.remove(v.g); v.fall = 0; }
    } else if (v.swing) {
      const acc = -v.K * Math.sin(pl.ang - pl.rest) - 1.5 * pl.w;
      pl.w += acc * dt; pl.ang += pl.w * dt; v.g.rotation.z = pl.ang;
      if (Math.abs(pl.w) > 0.8 && Math.abs(Math.sin(pl.ang - pl.rest)) < 0.05 && now - (v.lastClack || 0) > 300) { v.lastClack = now; }
    }
    if (v.jig > 0) { v.jig = Math.max(0, v.jig - dt * 2.2); const a = Math.sin((1 - v.jig) * 22) * 0.07 * v.jig; v.g.userData.jig.scale.set(1 + a, 1 - a, 1 + a * 0.5); }
    if (v.wob > 0) { v.wob = Math.max(0, v.wob - dt * 3); v.g.userData.inner.position.z = Math.sin(v.wob * 30) * 0.05 * v.wob; }
  }
  // screws: lifted hover / squash
  for (const v of vis.screws) {
    if (v.st === 'lift') { v.lift = Math.min(1, v.lift + dt * 6); v.bob += dt * 4; }
    else if (v.st === 'seat') v.lift = Math.max(0, v.lift - dt * 6);
    if ((v.st === 'lift' || v.st === 'seat') && S) {
      const base = seatZ(v.s); v.z0 = base;
      v.g.position.z = base + ease(v.lift) * 0.75 + (v.st === 'lift' ? Math.sin(v.bob) * 0.05 : 0);
      if (v.st === 'lift') v.g.spin.rotation.z += dt * 2.2;
      if (v.st === 'seat' && v.lift > 0) v.g.spin.rotation.z -= dt * 12 * v.lift;
    }
    if (v.sq > 0) { v.sq = Math.max(0, v.sq - dt * 4); const a = Math.sin(v.sq * Math.PI) * 0.25; v.g.scale.set(1 + a, 1 + a, 1 - a); }
  }
  // glows pulse
  const pulse = 0.65 + Math.sin(now / 160) * 0.3;
  for (const g of glows) if (g.visible) { g.material.opacity = pulse; g.scale.setScalar(g.userData.k * (1 + Math.sin(now / 200) * 0.06)); }
  for (const r of ringMeshes) { if (!r.visible) continue; const u = r.userData; u.t += dt * 2.4; if (u.t >= 1) { r.visible = false; continue; } r.scale.setScalar(u.s * (0.3 + ease(u.t) * 1.3)); r.material.opacity = (1 - u.t) * 0.5; }
  updSparks(dt); updChips(dt);
  // idle checks: auto-collect after swings, lose when nothing can move
  idleCheck += dt;
  if (state === 'play' && S && idleCheck > 0.25) {
    idleCheck = 0;
    const a = G.autoCollect(S); if (a.length) settleLogic();
    const settling = anims.length > 0 || vis.plates.some(v => v.swing && !v.pl.falling && v.pl.alive && (Math.abs(v.pl.w) > 0.05 || Math.abs(v.pl.ang - v.pl.rest) > 0.05)) || vis.boxes.some(vb => vb && !vb.ready && !vb.gone);
    if (!settling && G.platesLeft(S) && !G.moves(S).length) { Lv.stuckT = (Lv.stuckT || 0) + 1; if (Lv.stuckT > 2) loseLevel(); } else Lv.stuckT = 0;
  }
  // camera ease
  const kc = 1 - Math.exp(-dt * 3.2); CAM.pos.lerp(CAM.tPos, kc); CAM.look.lerp(CAM.tLook, kc);
  if (mode === 'home') { const t = now / 1000; camera.position.set(CAM.pos.x + Math.sin(t * 0.25) * 0.8, CAM.pos.y + Math.sin(t * 0.33) * 0.3, CAM.pos.z); }
  else camera.position.copy(CAM.pos);
  camera.lookAt(CAM.look);
  if (host) { host.mixer.update(dt); pinFacing(); }
  C.render(dt);
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ bot (for check.cjs) + hooks
function bot() {
  if (state === 'ready') { $('#home').classList.add('hide'); startFromHome(); return; }
  if (state !== 'play' || !S) return;
  if (anims.some(a => a.t < 0)) return;   // let delayed flights start
  const now = performance.now(); if (now - (bot.t || 0) < 600) return; bot.t = now;   // human pace: one move ~0.6 s
  const m = G.bestMove(S);
  if (!m) { if (save.boost.hole > 0 && spareCount() < 7) useBooster('hole'); return; }
  const v = vis.screws[m.s.i];
  if (v.st !== 'seat' && v.st !== 'lift') return;
  if (sel && sel !== v) { liftVisual(sel, false); sel = null; }
  commit(v, m.box ? { box: m.box } : { hole: m.hole });
}
window.__game = {
  get state() { return state; }, get level() { return Lv && Lv.daily ? 'daily' : save.level; }, get score() { return totalStars(); },
  bot, start: startLevel, use: useBooster, home: goHome,
  get debug() { return { S, Lv, vis, save, lose: loseLevel, album: openAlbum }; }, get money() { return M; },
};

// ------------------------------------------------------------------ boot
addEventListener('resize', () => { layout(); if (state === 'ready') renderHome(); });
layout(); setMode('home', true);
paintMute(); paintCoins(); paintMeter(); renderHome(); atmos();
buildRoom();
loadHost().catch(e => console.warn('host', e && e.message));
// an idle board behind the home screen so the wall never looks empty
(function idleBoard() {
  const P = G.params(7); const LD = G.genLevel(P, 4242); S = G.makeState(LD);
  for (const pl of S.plates) { const g = makePlate(pl, [...pl.screws].map(i => [S.screws[i].x, S.screws[i].y]), THICK); g.position.z = plateZ(pl.depth) + pl.i * 0.002; lvlG.add(g); vis.plates.push({ g, pl, z0: g.position.z, wob: 0 }); }
  for (const s of S.screws) { const g = makeScrew(s.color); g.position.set(s.x, s.y, seatZ(s)); g.spin.rotation.z = Math.random() * 6; lvlG.add(g); vis.screws.push({ g, s, st: 'seat', lift: 0, bob: 0, sq: 0 }); }
  paintHoles();
  S.slots.forEach((bi, k) => { if (bi >= 0) { const vb = arriveBox(k, S.boxes[bi], 0.2); vb.g.position.x = SLOT_X[k]; } });
})();
requestAnimationFrame(frame);
