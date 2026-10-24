// The breakfast nook: a sunny corner with a window, a café table laid for breakfast, Bijou (Hero Lab host) and the
// decor you unlock with stars. Art: AI 3D library pieces (assets/*.glb, ours) + walls/floor/light drawn in code.
import { THREE } from './kit/hc.js';
import { cine } from './kit/cine.js';
import { GLTFLoader } from './kit/addons/loaders/GLTFLoader.js';

const PI = Math.PI, V3 = THREE.Vector3;
export const loader = new GLTFLoader();
const cache = new Map();
function toFloat(g) {   // quantized attributes → float32 so transforms can be baked in
  for (const k of Object.keys(g.attributes)) {
    const a = g.attributes[k]; if (a.array instanceof Float32Array && !a.isInterleavedBufferAttribute && !a.normalized) continue;
    const n = a.itemSize, out = new Float32Array(a.count * n);
    for (let i = 0; i < a.count; i++) { out[i * n] = a.getX(i); if (n > 1) out[i * n + 1] = a.getY(i); if (n > 2) out[i * n + 2] = a.getZ(i); if (n > 3) out[i * n + 3] = a.getW(i); }
    g.setAttribute(k, new THREE.BufferAttribute(out, n));
  }
  return g;
}
/** one library GLB → { geo, mat } standing up, feet on y=0, centred, largest side = 1 */
export function piece(id) {
  if (!cache.has(id)) cache.set(id, loader.loadAsync(`./assets/${id}.glb`).then(gl => {
    gl.scene.updateMatrixWorld(true);
    let mesh = null; gl.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
    const geo = toFloat(mesh.geometry.clone()); geo.applyMatrix4(mesh.matrixWorld);
    geo.rotateX(PI / 2);
    geo.computeBoundingBox(); const b = geo.boundingBox, s = new V3(); b.getSize(s);
    const k = 1 / Math.max(s.x, s.y, s.z), c = new V3(); b.getCenter(c);
    geo.translate(-c.x, -b.min.y, -c.z); geo.scale(k, k, k);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    geo.computeBoundingBox(); geo.computeBoundingSphere();
    const mat = mesh.material; mat.side = THREE.FrontSide;
    return { geo, mat };
  }));
  return cache.get(id);
}
async function prop(id, size, pos, rotY = 0) {
  const p = await piece(id), m = new THREE.Mesh(p.geo, p.mat);
  m.scale.setScalar(size); m.position.copy(pos); m.rotation.y = rotY; m.castShadow = true; m.receiveShadow = true;
  return m;
}

// ---------------------------------------------------------------- decor you unlock with stars (the meta layer)
export const DECOR = [
  { id: 'rug', glb: 'h08', name: 'Woven rug', cost: 3, size: 4.4, pos: [0.1, 0.005, 0.5], rot: 0 },
  { id: 'monstera', glb: 'h05', name: 'Monstera', cost: 4, size: 1.7, pos: [-3.1, 0, -2.2], rot: 0.5 },
  { id: 'painting', glb: 'h16', name: 'Sunset painting', cost: 5, size: 1.25, pos: [2.55, 2.35, -2.88], rot: 0 },
  { id: 'cat', glb: 'h19', name: 'Marmalade the cat', cost: 6, size: 0.95, pos: [-1.75, 0, 1.55], rot: 0.6 },
  { id: 'sideboard', glb: 'h12', name: 'Sideboard', cost: 7, size: 1.35, pos: [2.75, 0, -2.45], rot: 0 },
  { id: 'espresso', glb: 'f10', name: 'Espresso machine', cost: 8, size: 0.62, pos: [2.5, 1.35, -2.45], rot: -0.35, needs: 'sideboard', onTop: 'sideboard' },
  { id: 'lamp', glb: 'h04', name: 'Floor lamp', cost: 9, size: 2.5, pos: [-3.45, 0, -0.6], rot: 0 },
  { id: 'shelf', glb: 'h07', name: 'Bookshelf', cost: 10, size: 2.6, pos: [-3.85, 0, -1.9], rot: PI / 2 },
  { id: 'armchair', glb: 'h02', name: 'Pink armchair', cost: 12, size: 1.45, pos: [-2.6, 0, 0.5], rot: 0.9 },
  { id: 'fig', glb: 'h06', name: 'Fiddle-leaf fig', cost: 12, size: 1.9, pos: [3.55, 0, -1.2], rot: -0.4 },
  { id: 'teastand', glb: 'g11', name: 'Afternoon tea stand', cost: 15, size: 0.6, pos: [3.05, 1.35, -2.45], rot: 0, needs: 'sideboard', onTop: 'sideboard' },
  { id: 'chandelier', glb: 'h17', name: 'Crystal chandelier', cost: 15, size: 1.1, pos: [0.1, 3.75, 0.1], rot: 0 },
];

// ---------------------------------------------------------------- procedural textures
function canvasTex(w, h, draw, repeat = null) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
const wallpaper = () => canvasTex(256, 256, (x, w, h) => {
  x.fillStyle = '#f9e6bf'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? 'rgba(255,255,255,.28)' : 'rgba(240,200,140,.16)'; x.fillRect(i * 64, 0, 32, h); }
  // tiny sprigs
  for (let k = 0; k < 8; k++) { const cx = (k % 4) * 64 + 48, cy = Math.floor(k / 4) * 128 + (k % 2 ? 96 : 32);
    x.fillStyle = 'rgba(232,150,120,.55)'; for (let p = 0; p < 5; p++) { const a = p / 5 * PI * 2; x.beginPath(); x.arc(cx + Math.cos(a) * 4, cy + Math.sin(a) * 4, 3.2, 0, 7); x.fill(); }
    x.fillStyle = 'rgba(255,214,120,.9)'; x.beginPath(); x.arc(cx, cy, 2.4, 0, 7); x.fill();
    x.strokeStyle = 'rgba(130,170,110,.55)'; x.lineWidth = 2; x.beginPath(); x.moveTo(cx, cy + 6); x.quadraticCurveTo(cx + 6, cy + 14, cx + 2, cy + 20); x.stroke(); }
}, [3, 1.4]);
const herringbone = () => canvasTex(512, 512, (x, w, h) => {
  x.fillStyle = '#c98f5c'; x.fillRect(0, 0, w, h);
  const L = 128, W = 32, tones = ['#d9a26b', '#cf955f', '#e2b17c', '#c4874f', '#d79c64'];
  let k = 0;
  for (let gy = -L; gy < h + L; gy += W * 2) for (let gx = -L; gx < w + L; gx += W * 2) {
    for (const flip of [0, 1]) {
      x.save(); x.translate(gx + (flip ? W : 0), gy + (flip ? 0 : W)); x.rotate(flip ? PI / 4 : -PI / 4);
      x.fillStyle = tones[(k++ * 7) % tones.length]; x.fillRect(0, 0, L * 0.7, W - 2);
      x.fillStyle = 'rgba(255,255,255,.07)'; x.fillRect(0, 0, L * 0.7, 3);
      x.strokeStyle = 'rgba(90,50,20,.35)'; x.lineWidth = 1.5; x.strokeRect(0, 0, L * 0.7, W - 2);
      x.restore();
    }
  }
}, [3, 3]);
const shaftTex = () => canvasTex(64, 256, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,236,190,.95)'); g.addColorStop(1, 'rgba(255,236,190,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  const s = x.createLinearGradient(0, 0, w, 0); s.addColorStop(0, 'rgba(0,0,0,1)'); s.addColorStop(0.25, 'rgba(0,0,0,0)'); s.addColorStop(0.75, 'rgba(0,0,0,0)'); s.addColorStop(1, 'rgba(0,0,0,1)');
  x.globalCompositeOperation = 'destination-out'; x.fillStyle = s; x.fillRect(0, 0, w, h);
});
const glowTex = () => canvasTex(128, 128, (x, w, h) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,245,220,.5)'); g.addColorStop(1, 'rgba(255,240,210,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });

// ---------------------------------------------------------------- the scene
export function createScene() {
  const LITE = Math.min(screen.width, screen.height) < 500 && devicePixelRatio > 2.5;
  const R = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  R.setSize(innerWidth, innerHeight); R.domElement.className = 'hc-canvas'; document.body.prepend(R.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#f6dcb4');
  const cam = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.1, 120); scene.add(cam);
  const TUNE = Object.fromEntries((new URLSearchParams(location.search).get('tune') || '').split(',').filter(Boolean).map(kv => kv.split('=')).map(([k, v]) => [k, +v]));
  const C = cine(R, scene, cam, { bloom: TUNE.bloom ?? 0.1, bloomThreshold: TUNE.thr ?? 1.0, bloomRadius: 0.4, exposure: TUNE.exp ?? 0.85, envIntensity: 0.5, lite: LITE, grade: { sat: 1.12, contrast: 1.04, vignette: 0.1, grain: 0, tint: '#fffaf2' } });
  const hemi = new THREE.HemisphereLight('#fff6e6', '#e8c9a8', 1.05); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffe2b0', 2.6); sun.position.set(-2.5, 9, -9); sun.target.position.set(0.6, 0, 1.2);
  sun.castShadow = true; sun.shadow.mapSize.set(LITE ? 1024 : 2048, LITE ? 1024 : 2048); Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 30 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; sun.shadow.radius = 5; scene.add(sun, sun.target);
  const key = new THREE.DirectionalLight('#fff3e2', 1.0); key.position.set(5, 6, 9); scene.add(key);   // soft front fill (no shadow)

  const room = new THREE.Group(); scene.add(room);
  // floor, walls, wainscoting, baseboards
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 10), new THREE.MeshStandardMaterial({ map: herringbone(), roughness: 0.55, metalness: 0 }));
  floor.rotation.x = -PI / 2; floor.position.set(0, 0, 1.5); floor.receiveShadow = true; room.add(floor);
  const wp = wallpaper(), wallMat = new THREE.MeshStandardMaterial({ map: wp, roughness: 0.9 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(9, 5.2), wallMat); back.position.set(0, 2.6, -3); back.receiveShadow = true; room.add(back);
  const lwp = wp.clone(); lwp.repeat.set(2.4, 1.4); lwp.needsUpdate = true;
  const left = new THREE.Mesh(new THREE.PlaneGeometry(7, 5.2), new THREE.MeshStandardMaterial({ map: lwp, roughness: 0.9, color: '#f3dcc0' })); left.rotation.y = PI / 2; left.position.set(-4.5, 2.6, 0.5); left.receiveShadow = true; room.add(left);
  const panel = new THREE.MeshStandardMaterial({ color: '#fbf4e8', roughness: 0.6 }), trim = new THREE.MeshStandardMaterial({ color: '#f4e6cf', roughness: 0.45 });
  const box = (w, h, d, m, x, y, z, ry = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.rotation.y = ry; b.castShadow = false; b.receiveShadow = true; room.add(b); return b; };
  box(9, 1.25, 0.06, panel, 0, 0.625, -2.97); box(9, 0.09, 0.12, trim, 0, 1.28, -2.94); box(9, 0.18, 0.1, trim, 0, 0.09, -2.94);
  box(7, 1.25, 0.06, panel, -4.47, 0.625, 0.5, PI / 2); box(7, 0.09, 0.12, trim, -4.44, 1.28, 0.5, PI / 2); box(7, 0.18, 0.1, trim, -4.44, 0.09, 0.5, PI / 2);
  for (let i = -4; i <= 4; i++) box(0.05, 0.85, 0.05, trim, i * 1.0 + 0.5, 0.68, -2.93);   // panel mouldings
  box(9, 0.14, 0.18, trim, 0, 5.1, -2.92);   // crown moulding
  // sky glow behind the window + light shafts + dust
  const glowT = glowTex();
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.6), new THREE.MeshBasicMaterial({ color: '#fff6dd', toneMapped: false }));
  sky.position.set(-0.2, 2.45, -3.05); room.add(sky);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.MeshBasicMaterial({ map: glowT, color: '#ffe9b8', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  halo.position.set(-0.2, 2.5, -2.8); room.add(halo);
  const sh = shaftTex(), shafts = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9 + i * 0.25, 6), new THREE.MeshBasicMaterial({ map: sh, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
    m.position.set(-0.6 + i * 0.55, 2.0, -1.3); m.rotation.set(-0.62, 0.05 * i, 0.12 - i * 0.06); room.add(m); shafts.push(m);
  }
  const DUST = 70, dust = new THREE.InstancedMesh(new THREE.SphereGeometry(0.012, 6, 4), new THREE.MeshBasicMaterial({ color: '#fff7dc', transparent: true, opacity: 0.8, toneMapped: false }), DUST);
  const dp = [...Array(DUST)].map(() => new V3(-1.2 + Math.random() * 2.4, 0.4 + Math.random() * 3.2, -2.6 + Math.random() * 3.4)); dust.frustumCulled = false; room.add(dust);
  const tmpM = new THREE.Matrix4();

  // ---- props: window, table, breakfast
  const ready = (async () => {
    const add = async (id, size, pos, rot) => { const m = await prop(id, size, new V3(...pos), rot); room.add(m); return m; };
    const win = await add('h18', 2.75, [-0.2, 1.12, -2.95], 0); win.castShadow = false;
    const table = await add('f12', 3.0, [0.15, 0, 0.35], 0);
    // find the table top height by casting down onto it
    table.updateMatrixWorld(true);
    const rc = new THREE.Raycaster(new V3(0.15, 5, 0.35), new V3(0, -1, 0)); const hit = rc.intersectObject(table)[0];
    const topY = hit ? hit.point.y : 1.15;
    const dish = [['f03', 0.42, [-0.3, topY, 0.42], 0.3], ['f01', 0.34, [0.28, topY, 0.62], -0.4], ['g10', 0.42, [0.42, topY, 0.12], -0.7], ['f02', 0.32, [-0.05, topY, 0.78], 0.6], ['g05', 0.5, [0.0, topY, 0.12], 0]];
    for (const d of dish) await add(...d);
    await add('t10', 0.34, [-1.05, 1.36, -2.72], 0.35);   // alarm clock on the sill
    return { topY };
  })();

  // ---- decor slots
  const decor = {};
  async function placeDecor(d, animate = false) {
    if (decor[d.id]) return decor[d.id];
    const m = await prop(d.glb, d.size, new V3(...d.pos), d.rot);
    if (d.id === 'rug') { m.castShadow = false; }
    if (d.id === 'chandelier') { m.position.y = 5.1 - d.size; m.castShadow = false; }
    room.add(m); decor[d.id] = m;
    if (animate) { m.scale.setScalar(0.001); m.userData.pop = { t: 0, s: d.size }; }
    return m;
  }

  // ---- host: Bijou (Hero Lab)
  let host = null;
  const hostReady = loader.loadAsync('./assets/host.glb').then(gl => {
    const root = gl.scene; root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    root.updateMatrixWorld(true);
    const bx = new THREE.Box3().setFromObject(root, true), hgt = bx.max.y - bx.min.y;
    const inner = new THREE.Group(); inner.add(root); root.position.y = -bx.min.y;
    const g = new THREE.Group(); g.add(inner); g.scale.setScalar(2.35 / hgt);
    const mixer = new THREE.AnimationMixer(root), acts = {};
    for (const c of gl.animations) acts[c.name] = mixer.clipAction(c);
    let cur = null;
    const play = (n, once = false) => { const a = acts[n]; if (!a) return; if (a === cur && !once) return; a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity); a.clampWhenFinished = once; a.play(); if (cur && cur !== a) cur.crossFadeTo(a, 0.25, false); cur = a;
      if (once) { clearTimeout(play.t); play.t = setTimeout(() => play('idle'), (a.getClip().duration * 1000) / a.timeScale + 80); } };
    play('idle');
    g.position.set(2.55, 0, 1.25); g.rotation.y = (+new URLSearchParams(location.search).get('hr') || 1.8); room.add(g);
    host = { g, h: 2.35, mixer, play };
    return host;
  });

  // ---------------------------------------------------------------- camera framing
  // 'home': the whole nook framed in the free band between the header and the puzzle cards
  // 'play': closer on the window and table; the puzzle tray floats in front (boards.js)
  let mode = 'home', band = { top: 120, bottom: 300 };
  const camCur = { pos: new V3(3, 4, 12), tgt: new V3(0, 1.8, 0) };
  function pose() {
    const W = innerWidth, H = innerHeight, por = W / H < 0.8;
    const tgt = mode === 'home' ? new V3(por ? 0.45 : 0.3, 1.75, -0.3) : new V3(0.1, 2.0, -0.6);
    const dir = new V3(0.36, mode === 'home' ? 0.26 : 0.2, 1).normalize();
    const tanV = Math.tan(cam.fov * PI / 360), tanH = tanV * cam.aspect;
    let dist;
    if (mode === 'home') {
      const free = Math.max(160, H - band.top - band.bottom), freeW = Math.max(200, W - (band.left || 0) - (band.right || 0)), fw = por ? 6.2 : 8.6, fh = 4.6;
      dist = Math.max(fw / 2 / (tanH * freeW / W), (fh / 2) / (tanV * free / H));
    } else dist = Math.max(8.5 / 2 / tanH, 6 / 2 / tanV, 15);
    return { pos: tgt.clone().addScaledVector(dir, dist), tgt };
  }
  function shift() {   // move the framed nook into the middle of the free band
    if (mode !== 'home') { cam.clearViewOffset(); return; }
    const off = (band.top - band.bottom) / 2, offX = ((band.left || 0) - (band.right || 0)) / 2;
    cam.setViewOffset(innerWidth, innerHeight, -offX, -off, innerWidth, innerHeight);
  }
  function setMode(m, b) { mode = m; if (b) band = b; shift(); C.bloom.enabled = m === 'home' && (TUNE.bloom ?? 0.1) > 0; }
  function snap() { const p = pose(); camCur.pos.copy(p.pos); camCur.tgt.copy(p.tgt); }

  function resize() { R.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); C.resize(innerWidth, innerHeight); shift(); }

  let t = 0;
  function update(dt) {
    t += dt;
    const p = pose(), k = 1 - Math.pow(0.02, dt);
    camCur.pos.lerp(p.pos, k); camCur.tgt.lerp(p.tgt, k);
    cam.position.copy(camCur.pos).add(new V3(Math.sin(t * 0.3) * 0.06, Math.sin(t * 0.43) * 0.04, 0)); cam.lookAt(camCur.tgt);
    for (let i = 0; i < DUST; i++) { const q = dp[i]; q.y += Math.sin(t * 0.7 + i) * 0.0008 + 0.0009; q.x += Math.sin(t * 0.4 + i * 2) * 0.0007; if (q.y > 3.8) q.y = 0.4; tmpM.makeTranslation(q.x, q.y, q.z); dust.setMatrixAt(i, tmpM); }
    dust.instanceMatrix.needsUpdate = true;
    shafts.forEach((s, i) => s.material.opacity = 0.13 + Math.sin(t * 0.5 + i * 1.7) * 0.03);
    for (const id in decor) { const m = decor[id], pp = m.userData.pop; if (!pp) continue; pp.t += dt / 0.55; const e = Math.min(1, pp.t), c = 1.7; const s = 1 + (c + 1) * Math.pow(e - 1, 3) + c * Math.pow(e - 1, 2); m.scale.setScalar(pp.s * Math.max(0.001, s)); if (e >= 1) { m.scale.setScalar(pp.s); delete m.userData.pop; } }
    if (host) host.mixer.update(dt);
  }
  function render(dt) { C.render(dt); }
  const headPos = new V3();
  function hostScreen() {   // where Bijou's head is on screen (for the speech bubble)
    if (!host) return null;
    host.g.updateMatrixWorld(true); host.g.getWorldPosition(headPos); headPos.y += host.h * 1.02;
    headPos.project(cam); return { x: (headPos.x + 1) / 2 * innerWidth, y: (1 - headPos.y) / 2 * innerHeight };
  }
  snap();
  return { R, scene, cam, C, room, ready, hostReady, get host() { return host; }, placeDecor, decor, setMode, snap, resize, update, render, hostScreen, get mode() { return mode; } };
}
