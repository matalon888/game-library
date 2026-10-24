// The Club room: a pastel clubhouse corner with bunting, a neon sign, a round window and Lulu (the lilac kitty host,
// kawaii library k07) who reacts to every move. Decor pieces (kawaii library props) appear as you spend stars.
// In play mode the same renderer shrinks to a sticker-sized Lulu in the corner (transparent background).
import * as THREE from './kit/three.module.min.js';
import { GLTFLoader } from './kit/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from './kit/addons/environments/RoomEnvironment.js';

const PI = Math.PI, V3 = THREE.Vector3;
const loader = new GLTFLoader();
const cache = new Map();
function toFloat(g) {
  for (const k of Object.keys(g.attributes)) {
    const a = g.attributes[k]; if (a.array instanceof Float32Array && !a.isInterleavedBufferAttribute && !a.normalized) continue;
    const n = a.itemSize, out = new Float32Array(a.count * n);
    for (let i = 0; i < a.count; i++) { out[i * n] = a.getX(i); if (n > 1) out[i * n + 1] = a.getY(i); if (n > 2) out[i * n + 2] = a.getZ(i); if (n > 3) out[i * n + 3] = a.getW(i); }
    g.setAttribute(k, new THREE.BufferAttribute(out, n));
  }
  return g;
}
function piece(id) {
  if (!cache.has(id)) cache.set(id, loader.loadAsync(`./assets/${id}.glb`).then(gl => {
    gl.scene.updateMatrixWorld(true);
    let mesh = null; gl.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
    const geo = toFloat(mesh.geometry.clone()); geo.applyMatrix4(mesh.matrixWorld); geo.rotateX(PI / 2);
    geo.computeBoundingBox(); const b = geo.boundingBox, s = new V3(); b.getSize(s);
    const k = 1 / Math.max(s.x, s.y, s.z), c = new V3(); b.getCenter(c);
    geo.translate(-c.x, -b.min.y, -c.z); geo.scale(k, k, k);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    geo.computeBoundingBox(); geo.computeBoundingSphere();
    const mat = mesh.material; mat.side = THREE.FrontSide;
    if (mat.roughness !== undefined) { mat.roughness = Math.min(mat.roughness, 0.45); mat.envMapIntensity = 0.9; }
    return { geo, mat };
  }));
  return cache.get(id);
}

// decor bought with stars (the meta layer): cost in stars, kawaii library prop, where it sits
export const DECOR = [
  { id: 'rug', glb: 'h05', name: 'Cloud rug', cost: 3, size: 2.4, pos: [-0.15, 0.01, 1.0], rot: 0 },
  { id: 'lamp', glb: 'h06', name: 'Mushroom lamp', cost: 4, size: 0.9, pos: [-1.75, 0, -0.95], rot: 0.5 },
  { id: 'plant', glb: 'h07', name: 'Succulent pot', cost: 5, size: 0.55, pos: [1.95, 0, -0.9], rot: -0.4 },
  { id: 'bean', glb: 'h02', name: 'Heart beanbag', cost: 6, size: 1.05, pos: [-1.8, 0, 0.55], rot: 0.65 },
  { id: 'shelf', glb: 'h08', name: 'Kawaii wall shelf', cost: 7, size: 1.05, pos: [1.6, 1.25, -1.62], rot: 0 },
  { id: 'rainbow', glb: 'x05', name: 'Rainbow cloud', cost: 8, size: 0.95, pos: [-0.65, 3.0, -1.66], rot: 0 },
  { id: 'loaf', glb: 'g16', name: 'Cat-loaf pillow', cost: 9, size: 0.5, pos: [0.35, 0, 1.75], rot: -0.4 },
  { id: 'cattree', glb: 'h12', name: 'Cat tree', cost: 10, size: 1.6, pos: [2.3, 0, 0.05], rot: -0.6 },
  { id: 'bunny', glb: 'g17', name: 'Big plush bunny', cost: 12, size: 0.8, pos: [-2.35, 0, -0.35], rot: 0.9 },
  { id: 'arch', glb: 'w10', name: 'Heart light arch', cost: 14, size: 1.9, pos: [-0.35, 0, -1.3], rot: 0 },
  { id: 'pile', glb: 'g18', name: 'Plush pile', cost: 15, size: 0.95, pos: [-1.0, 0, -1.1], rot: 0.3 },
  { id: 'blossom', glb: 'r01', name: 'Blossom tree', cost: 18, size: 1.9, pos: [-2.45, 0, -1.25], rot: 0.2 },
];

function canvasTex(w, h, draw, repeat = null) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
const heartPath = (x, cx, cy, s) => { x.beginPath(); x.moveTo(cx, cy + s * 0.35); x.bezierCurveTo(cx - s, cy - s * 0.4, cx - s * 0.45, cy - s * 1.05, cx, cy - s * 0.45); x.bezierCurveTo(cx + s * 0.45, cy - s * 1.05, cx + s, cy - s * 0.4, cx, cy + s * 0.35); x.fill(); };
const starPath = (x, cx, cy, r) => { x.beginPath(); for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, rr = i % 2 ? r * 0.45 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); x.fill(); };
const wallpaper = () => canvasTex(256, 256, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#d9bcff'); g.addColorStop(1, '#f3c4ea'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,0)'; x.fillRect(i * 32, 0, 32, h); }
  for (let k = 0; k < 6; k++) { const cx = (k % 3) * 86 + 40 + (k > 2 ? 43 : 0), cy = k > 2 ? 190 : 64;
    x.fillStyle = k % 2 ? 'rgba(255,140,190,.55)' : 'rgba(255,255,255,.75)'; if (k % 2) heartPath(x, cx, cy, 13); else starPath(x, cx, cy, 11); }
}, [4, 2]);
const floorTex = () => canvasTex(256, 256, (x, w, h) => {
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#f9a9cf' : '#ffe1ef'; x.fillRect(i * 64, j * 64, 64, 64); }
  x.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) x.fillRect(i * 64 + 6, j * 64 + 6, 20, 6);
}, [5, 5]);
const skyTex = () => canvasTex(256, 256, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#9fd8ff'); g.addColorStop(0.65, '#ffd6ec'); g.addColorStop(1, '#ffe9c9'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.fillStyle = 'rgba(255,255,255,.95)';
  for (const [cx, cy, s] of [[70, 120, 26], [180, 80, 20], [150, 170, 30]]) { for (const [dx, dy, r] of [[0, 0, 1], [0.9, 0.15, 0.8], [-0.9, 0.2, 0.75], [0.35, -0.5, 0.85]]) { x.beginPath(); x.arc(cx + dx * s, cy + dy * s, r * s, 0, 7); x.fill(); } }
  x.fillStyle = '#fff6b0'; starPath(x, 210, 40, 9); starPath(x, 40, 50, 6);
});
const neonTex = () => canvasTex(512, 160, (x, w, h) => {
  x.clearRect(0, 0, w, h); x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '700 92px Fredoka, "Baloo 2", system-ui, sans-serif';
  x.shadowColor = '#ff4fa3'; x.shadowBlur = 26; x.lineWidth = 10; x.strokeStyle = '#ff7cc0'; x.strokeText('club', w / 2, h / 2 + 4);
  x.shadowBlur = 10; x.fillStyle = '#fff3fb'; x.fillText('club', w / 2, h / 2 + 4);
  x.fillStyle = '#ffe36e'; x.shadowColor = '#ffb100'; x.shadowBlur = 16; starPath(x, 70, 50, 22); starPath(x, w - 66, 108, 16);
});

const _e = new THREE.Euler();
export function createScene() {
  const R = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  R.setPixelRatio(Math.min(devicePixelRatio, 2)); R.toneMapping = THREE.NeutralToneMapping ?? THREE.ACESFilmicToneMapping; R.toneMappingExposure = 0.95;
  R.outputColorSpace = THREE.SRGBColorSpace; R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  R.domElement.id = 'club3d'; document.body.prepend(R.domElement);
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(R); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.75; pm.dispose();
  const cam = new THREE.PerspectiveCamera(36, 1, 0.1, 60);
  scene.add(new THREE.HemisphereLight('#fff4fb', '#b98fe0', 1.0));
  const sun = new THREE.DirectionalLight('#fff6fb', 1.7); sun.position.set(2.5, 6, 4.5); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 20 }); sun.shadow.radius = 5; sun.shadow.bias = -0.0005;
  scene.add(sun);
  const fill = new THREE.PointLight('#ffb7e0', 6, 9); fill.position.set(-1.8, 2.2, 1.8); scene.add(fill);

  // ---- room
  const room = new THREE.Group(); scene.add(room);
  const wallMat = new THREE.MeshStandardMaterial({ map: wallpaper(), roughness: 0.9, envMapIntensity: 0.3 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 4.2), wallMat); back.position.set(0.1, 2.1, -1.75); back.receiveShadow = true; room.add(back);
  const side = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), wallMat.clone()); side.material.map = wallpaper(); side.material.map.repeat.set(2.4, 2);
  side.rotation.y = PI / 2; side.position.set(-3.0, 2.1, 0.25); side.receiveShadow = true; room.add(side);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 6), new THREE.MeshStandardMaterial({ map: floorTex(), roughness: 0.5, metalness: 0, envMapIntensity: 0.4 }));
  floor.rotation.x = -PI / 2; floor.position.set(0.1, 0, 1.25); floor.receiveShadow = true; room.add(floor);
  // skirting + chair rail in glossy mint
  const trim = new THREE.MeshPhysicalMaterial({ color: '#b9f0dc', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.2 });
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.18, 0.06), trim); skirt.position.set(0.1, 0.09, -1.72); room.add(skirt);
  const skirt2 = new THREE.Mesh(new THREE.BoxGeometry(4, 0.18, 0.06), trim); skirt2.rotation.y = PI / 2; skirt2.position.set(-2.97, 0.09, 0.25); room.add(skirt2);
  // round window with sky
  const win = new THREE.Group(); win.position.set(0.55, 2.25, -1.73); room.add(win);
  const sky = new THREE.Mesh(new THREE.CircleGeometry(0.62, 48), new THREE.MeshBasicMaterial({ map: skyTex(), toneMapped: false })); sky.position.z = 0.005; win.add(sky);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.07, 16, 64), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.25, clearcoat: 1 })); ring.position.z = 0.04; ring.castShadow = true; win.add(ring);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.05, 0.04), ring.material); bar.position.z = 0.04; win.add(bar);
  const bar2 = bar.clone(); bar2.rotation.z = PI / 2; win.add(bar2);
  // neon "club" sign
  const neon = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.42), new THREE.MeshBasicMaterial({ map: neonTex(), transparent: true, toneMapped: false })); neon.position.set(-1.25, 2.55, -1.72); room.add(neon);
  // bunting garland across the back wall
  const flagCols = ['#ff9cc8', '#ffe27a', '#9ff0c8', '#a9d8ff', '#cdb2ff'];
  const flags = new THREE.Group(); room.add(flags);
  const flagGeo = new THREE.BufferGeometry().setFromPoints([new V3(-0.13, 0, 0), new V3(0.13, 0, 0), new V3(0, -0.26, 0)]); flagGeo.computeVertexNormals();
  for (let i = 0; i < 15; i++) { const t = i / 14, x = -2.9 + t * 6.0, y = 3.55 - Math.sin(t * PI) * 0.32;
    const f = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ color: flagCols[i % 5], roughness: 0.6, side: THREE.DoubleSide })); f.position.set(x, y, -1.68); flags.add(f); }
  const string = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new V3(-3.0, 3.58, -1.69), new V3(0.1, 3.24, -1.69), new V3(3.2, 3.58, -1.69)]), 32, 0.008, 4), new THREE.MeshBasicMaterial({ color: '#ffffff' })); flags.add(string);
  // a jelly club table (code-built) where the puzzles sit
  const table = new THREE.Group(); table.position.set(0.95, 0, 0.55); room.add(table);
  const jelly = c => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.15, sheen: 0.4, sheenColor: new THREE.Color('#ffffff') });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.1, 40), jelly('#ffb3d6')); top.position.y = 0.62; top.castShadow = top.receiveShadow = true; table.add(top);
  const topRim = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 12, 40), jelly('#ffffff')); topRim.rotation.x = PI / 2; topRim.position.y = 0.66; table.add(topRim);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.16, 0.6, 20), jelly('#c9b3ff')); leg.position.y = 0.3; leg.castShadow = true; table.add(leg);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.33, 0.06, 28), jelly('#c9b3ff')); foot.position.y = 0.03; table.add(foot);
  // the three daily puzzle "cards" standing on the table (tinted when solved)
  const cardMats = ['#ffe27a', '#9ff0c8', '#a9d8ff'].map(c => jelly(c));
  const cards = cardMats.map((m, i) => { const c = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.04), m); c.position.set(-0.25 + i * 0.25, 0.81, 0.05 + (i === 1 ? 0.08 : 0)); c.rotation.set(-0.25, (i - 1) * -0.35, 0); c.castShadow = true; table.add(c); return c; });
  // stool
  const stool = new THREE.Group(); stool.position.set(1.75, 0, 1.25); room.add(stool);
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.12, 30), jelly('#9ff0c8')); seat.position.y = 0.42; seat.castShadow = true; stool.add(seat);
  const sleg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.38, 14), jelly('#ffffff')); sleg.position.y = 0.19; stool.add(sleg);

  // ---- Lulu (k07)
  let host = null, mixer = null, actions = {}, cur = null, react = null, hips = null;
  const hostG = new THREE.Group(); hostG.position.set(-0.8, 0, 1.7); scene.add(hostG);
  const hostReady = loader.loadAsync('./assets/chars/k07.glb').then(g => {
    host = g.scene; host.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = true; if (o.material) { o.material.envMapIntensity = 0.8; } } });
    const box = new THREE.Box3().setFromObject(host), h = box.max.y - box.min.y; host.scale.setScalar(1.8 / h); hostG.add(host);
    host.traverse(o => { if (!hips && o.isBone && /hips/i.test(o.name)) hips = o; });
    mixer = new THREE.AnimationMixer(host);
    for (const c of g.animations) actions[c.name] = mixer.clipAction(c);
    play('idle'); hostG.rotation.y = 0.25;
    mixer.addEventListener('finished', () => play('idle'));
  }).catch(e => console.warn('host', e));
  function play(name, once = false) {
    const a = actions[name] || actions.idle; if (!a) return;
    if (cur === a && !once) return;
    a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = false;
    if (cur && cur !== a) a.crossFadeFrom(cur, 0.25, false); a.play(); cur = a;
  }
  // reactions: 'happy' (jump), 'cheer', 'oops' (a little droop + head shake, done in code), 'wave'
  function reactTo(kind) {
    if (kind === 'happy') play('jump', true);
    else if (kind === 'cheer') play('cheer', true);
    else if (kind === 'oops') react = { t: 0, kind };
    else if (kind === 'idle') play('idle');
  }

  // ---- decor
  const decor = new Map();
  async function placeDecor(id, pop = false) {
    const d = DECOR.find(q => q.id === id); if (!d || decor.has(id)) return;
    decor.set(id, null);
    const p = await piece(d.glb); const m = new THREE.Mesh(p.geo, p.mat);
    m.scale.setScalar(pop ? 0.001 : d.size); m.position.set(...d.pos); m.rotation.y = d.rot; m.castShadow = true; m.receiveShadow = true;
    room.add(m); decor.set(id, m);
    if (pop) m.userData.pop = { t: 0, s: d.size };
  }

  // ---- modes + framing
  let mode = 'home', box = { x: 0, y: 0, w: innerWidth, h: innerHeight }, t = 0;
  function frame() {
    const W = innerWidth, H = innerHeight;
    if (mode === 'home') {
      R.domElement.style.cssText = `position:fixed;left:0;top:0;width:${W}px;height:${H}px;z-index:0`;
      R.setSize(W, H, false); cam.aspect = W / H;
      // phone: room fills the top ~45%; desktop: room on the left side
      const portrait = W / H < 0.8;
      // phone: the room fills the top ~half above the sheet; desktop: the room sits left of the sheet panel
      const visH = portrait ? Math.max(4.6 / (H * 0.47 / H), 5.0 / (W / H)) : 5.6;
      const d = 10; cam.fov = 2 * Math.atan(visH / 2 / d) * 180 / PI;
      cam.position.set(0.1, 2.35, d); cam.lookAt(0.1, 1.55, 0);
      if (portrait) cam.setViewOffset(W, H, 0, H * 0.235, W, H); else cam.setViewOffset(W, H, W * 0.19, -H * 0.02, W, H);
      room.visible = true; hostG.position.set(-0.8, 0, 1.7);
    } else {
      const s = box.w;
      R.domElement.style.cssText = `position:fixed;left:${box.x}px;top:${box.y}px;width:${s}px;height:${box.h}px;z-index:31;pointer-events:none`;
      R.setSize(s, box.h, false); cam.aspect = s / box.h; cam.fov = 30; cam.clearViewOffset();
      cam.position.set(0, 0.95, 3.6); cam.lookAt(0, 0.8, 0); room.visible = false; hostG.position.set(0, 0, 0);
    }
    cam.updateProjectionMatrix();
  }
  function setMode(m, b) { mode = m; if (b) box = b; frame(); }
  addEventListener('resize', frame); frame();

  function update(dt) {
    t += dt; if (mixer) mixer.update(dt);
    // the mocap clips turn the hips (idle ≈ 45°): cancel the yaw so Lulu always faces the player
    if (hips) { _e.setFromQuaternion(hips.quaternion, 'YXZ'); _e.y = 0; hips.quaternion.setFromEuler(_e); }
    // breathing bob + gentle turn toward the camera
    if (host) {
      let rz = 0, sy = 1, ry = mode === 'home' ? 0.12 + Math.sin(t * 0.5) * 0.1 : Math.sin(t * 0.7) * 0.2;
      if (react) { react.t += dt; const k = react.t; if (k > 0.9) react = null; else { rz = Math.sin(k * 18) * 0.12 * (1 - k / 0.9); sy = 1 - 0.08 * Math.sin(Math.min(1, k / 0.9) * PI); } }
      hostG.rotation.y += (ry - hostG.rotation.y) * Math.min(1, dt * 4); host.rotation.z = rz; host.scale.y = host.scale.x * sy;
    }
    for (const m of decor.values()) if (m && m.userData.pop) { const p = m.userData.pop; p.t += dt; const k = Math.min(1, p.t / 0.7); const e = 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2); m.scale.setScalar(p.s * Math.max(0.001, e)); if (k >= 1) { m.scale.setScalar(p.s); delete m.userData.pop; } }
    cards.forEach((c, i) => c.position.y = 0.81 + Math.sin(t * 2 + i) * 0.012);
    flags.children.forEach((f, i) => { if (f.isMesh && f.geometry === flagGeo) f.rotation.x = Math.sin(t * 1.6 + i * 0.7) * 0.12; });
  }
  function render() { R.render(scene, cam); }
  function setCards(done) { cards.forEach((c, i) => { c.material.emissive = new THREE.Color(done[i] ? '#ffffff' : '#000000'); c.material.emissiveIntensity = done[i] ? 0.25 : 0; c.visible = true; }); }
  // where Lulu's head is on screen (for the speech bubble)
  function hostScreen() { const v = new V3(); hostG.getWorldPosition(v); v.y += 1.3; v.project(cam); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; }
  return { R, scene, cam, hostReady, placeDecor, decor, setMode, update, render, reactTo, setCards, hostScreen, get mode() { return mode; } };
}
