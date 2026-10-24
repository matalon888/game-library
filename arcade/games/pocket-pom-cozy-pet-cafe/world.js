// Pocket Pom — the café diorama (built in code around the kawaii 3D props), model loading, icon renders, sparkle particles.
import { THREE } from './kit/hc.js';
import { GLTFLoader } from './kit/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from './kit/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from './kit/addons/environments/RoomEnvironment.js';

export const K = 0.8, FY = 0.075 * K;
export const FLOOR = { x0: -3.05 * K, x1: 3.05 * K, z0: -1.35 * K, z1: 4.75 * K };
const rbox = (w, h, d, r = 0.06, s = 4) => new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
const phys = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.18, ...o });
function canvasTex(w, h, draw, rep = null) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
function heartPath(x, cx, cy, s) {
  x.beginPath(); x.moveTo(cx, cy + s * 0.35);
  x.bezierCurveTo(cx - s * 0.9, cy - s * 0.25, cx - s * 0.45, cy - s * 0.95, cx, cy - s * 0.45);
  x.bezierCurveTo(cx + s * 0.45, cy - s * 0.95, cx + s * 0.9, cy - s * 0.25, cx, cy + s * 0.35); x.closePath();
}
function starPath(x, cx, cy, r, ri = 0.45) {
  x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * ri : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath();
}

// ---------------------------------------------------------------- loading
const loader = new GLTFLoader();
export const MODELS = {};
// kawaii props are Z-up: stand the node up (+90° about X), centre x/z, rest on y = 0, largest side = 1
function prep(sc) {
  sc.rotation.x = Math.PI / 2;
  const w = new THREE.Group(); w.add(sc); w.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(w), sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
  sc.position.set(-c.x, -bb.min.y, -c.z); w.scale.setScalar(1 / Math.max(sz.x, sz.y, sz.z));
  const root = new THREE.Group(); root.add(w);
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; const m = o.material; if (m) { m.envMapIntensity = 1.0; if (m.roughness !== undefined) m.roughness = Math.min(m.roughness, 0.55); } } });
  return root;
}
export async function loadProps(ids, onEach) {
  await Promise.all(ids.map(id => loader.loadAsync(`./assets/${id}.glb`).then(g => { MODELS[id] = prep(g.scene); onEach && onEach(); })));
}
export function prop(id, size = 1, rotY = 0) {
  const g = new THREE.Group(), m = MODELS[id].clone(); m.scale.setScalar(size); m.rotation.y = rotY; g.add(m); g.userData.id = id; return g;
}

// rigged chibi character / mascot with named clips
export async function loadChar(id, height) {
  const g = await loader.loadAsync(`./assets/chars/${id}.glb`);
  const root = new THREE.Group(), s = g.scene; root.add(s);
  s.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = true; o.receiveShadow = false; if (o.material) o.material.envMapIntensity = 0.9; } });
  const bb = new THREE.Box3().setFromObject(s), h = bb.max.y - bb.min.y || 1;
  s.scale.setScalar(height / h);
  const mixer = new THREE.AnimationMixer(s), acts = {};
  for (const c of g.animations) acts[c.name] = mixer.clipAction(c);
  let cur = null;
  const play = (name, { once = false, fade = 0.25, then = 'idle', speed = 1 } = {}) => {
    const a = acts[name]; if (!a) return;
    if (cur === a && !once) return;
    a.reset(); a.setEffectiveTimeScale(speed); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = once;
    if (cur && cur !== a) a.crossFadeFrom(cur, fade, false); a.play(); cur = a;
    if (once) { const d = a.getClip().duration / speed; clearTimeout(root.userData.t); root.userData.t = setTimeout(() => { if (cur === a) play(then); }, Math.max(200, d * 1000 - fade * 1000)); }
  };
  play('idle');
  return { id, object: root, mixer, play, get clip() { return cur && cur.getClip().name; } };
}

// ---------------------------------------------------------------- icons: render props to transparent PNGs once
let iconR = null, iconS = null, iconC = null;
export function iconOf(obj, { size = 160, yaw = -0.35, pitch = 0.32, pad = 1.08 } = {}) {
  if (!iconR) {
    iconR = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    iconR.setPixelRatio(1); iconR.setSize(size, size); iconR.outputColorSpace = THREE.SRGBColorSpace;
    iconR.toneMapping = THREE.ACESFilmicToneMapping; iconR.toneMappingExposure = 1.05;
    iconS = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(iconR); iconS.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; iconS.environmentIntensity = 0.7;
    iconS.add(new THREE.HemisphereLight('#fff4fb', '#c9a8e0', 1.6));
    const k = new THREE.DirectionalLight('#ffffff', 2.0); k.position.set(2, 4, 4); iconS.add(k);
    iconC = new THREE.PerspectiveCamera(26, 1, 0.05, 50);
  }
  const holder = new THREE.Group(); holder.add(obj); obj.rotation.y = yaw; iconS.add(holder); holder.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(holder), c = bb.getCenter(new THREE.Vector3()), sp = bb.getBoundingSphere(new THREE.Sphere());
  const d = sp.radius * pad / Math.sin(THREE.MathUtils.degToRad(13));
  iconC.position.set(c.x, c.y + Math.sin(pitch) * d, c.z + Math.cos(pitch) * d); iconC.lookAt(c);
  iconR.render(iconS, iconC);
  const url = iconR.domElement.toDataURL('image/png');
  iconS.remove(holder);
  return url;
}

// ---------------------------------------------------------------- sprite particles (hearts, stars, sparkles, bubbles, crumbs)
const SPR = {};
function sprTex(kind, color) {
  const key = kind + color; if (SPR[key]) return SPR[key];
  const t = canvasTex(64, 64, (x) => {
    x.fillStyle = color; x.strokeStyle = '#fff'; x.lineWidth = 5;
    if (kind === 'heart') { heartPath(x, 32, 36, 30); x.stroke(); x.fill(); x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.ellipse(22, 22, 5, 3.5, -0.6, 0, 7); x.fill(); }
    else if (kind === 'star') { starPath(x, 32, 34, 27); x.lineJoin = 'round'; x.stroke(); x.fill(); }
    else if (kind === 'sparkle') { x.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 6 : 29; x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } x.closePath(); x.fill(); }
    else if (kind === 'bubble') { const g = x.createRadialGradient(24, 22, 2, 32, 32, 28); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, color); g.addColorStop(1, 'rgba(255,255,255,.9)'); x.fillStyle = g; x.globalAlpha = 0.85; x.beginPath(); x.arc(32, 32, 26, 0, 7); x.fill(); x.globalAlpha = 1; x.lineWidth = 3; x.stroke(); }
    else { x.beginPath(); x.arc(32, 32, 22, 0, 7); x.fill(); }
  });
  return (SPR[key] = t);
}
const parts = [];
export function sparkles(scene, pos, { kind = 'heart', colors = ['#ff6fa8'], n = 8, speed = 1.6, up = 2.2, size = 0.28, life = 1.1, gravity = 3.2, spread = 0.2 } = {}) {
  for (let i = 0; i < n; i++) {
    if (parts.length > 120) { const o = parts.shift(); o.s.parent && o.s.parent.remove(o.s); o.s.material.dispose(); }
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sprTex(kind, colors[i % colors.length]), transparent: true, depthWrite: false }));
    s.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread));
    const a = Math.random() * Math.PI * 2, sp = speed * (0.4 + Math.random() * 0.8);
    s.scale.setScalar(0.001); s.renderOrder = 5;
    parts.push({ s, v: new THREE.Vector3(Math.cos(a) * sp, up * (0.6 + Math.random() * 0.7), Math.sin(a) * sp), age: 0, life: life * (0.75 + Math.random() * 0.5), size: size * (0.7 + Math.random() * 0.6), g: gravity, spin: (Math.random() - 0.5) * 4 });
    scene.add(s);
  }
}
export function updateSparkles(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.age += dt;
    p.v.y -= p.g * dt; p.v.multiplyScalar(1 - 1.2 * dt); p.s.position.addScaledVector(p.v, dt);
    const k = p.age / p.life, sc = p.size * (k < 0.15 ? k / 0.15 : 1) * (1 - Math.max(0, k - 0.7) / 0.3);
    p.s.scale.setScalar(Math.max(0.001, sc)); p.s.material.rotation += p.spin * dt;
    if (k >= 1) { p.s.parent && p.s.parent.remove(p.s); p.s.material.dispose(); parts.splice(i, 1); }
  }
}

// ---------------------------------------------------------------- the café
export function buildCafe(scene) {
  const G = new THREE.Group(); G.scale.setScalar(K); scene.add(G);
  const add = (geo, mat, x, y, z, { cast = true, rec = true, parent = G } = {}) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = rec; parent.add(m); return m; };

  // background: lilac→pink gradient with soft bokeh hearts and sparkles
  scene.background = canvasTex(512, 1024, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#7448c8'); g.addColorStop(0.38, '#a465dc'); g.addColorStop(0.72, '#e48bd2'); g.addColorStop(1, '#9a62dc');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    const r = (a => () => (a = (a * 16807) % 2147483647) / 2147483647)(7);
    for (let i = 0; i < 46; i++) { const cx = r() * w, cy = r() * h, s = 6 + r() * 26; x.globalAlpha = 0.08 + r() * 0.16; x.fillStyle = '#fff'; x.beginPath(); x.arc(cx, cy, s, 0, 7); x.fill(); }
    for (let i = 0; i < 14; i++) { const cx = r() * w, cy = r() * h, s = 8 + r() * 16; x.globalAlpha = 0.18 + r() * 0.2; x.fillStyle = ['#ffffff', '#ffe0f0', '#fff3b8'][i % 3]; heartPath(x, cx, cy, s); x.fill(); }
    for (let i = 0; i < 26; i++) { const cx = r() * w, cy = r() * h, s = 3 + r() * 8; x.globalAlpha = 0.5 + r() * 0.5; x.fillStyle = '#fff'; x.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, rr = k % 2 ? s * 0.22 : s; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.fill(); }
    x.globalAlpha = 1;
  });

  // floating island slab with a frosting rim
  const slabM = phys('#a874f0', { roughness: 0.35 });
  add(rbox(7.9, 0.7, 8.7, 0.3), slabM, 0, -0.36, 0.95);
  add(rbox(7.6, 0.18, 8.4, 0.09), phys('#ffe1f1', { roughness: 0.4 }), 0, -0.02, 0.95, { cast: false });
  const tileT = canvasTex(512, 512, (x, w) => {
    const n = 4, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { x.fillStyle = (i + j) % 2 ? '#ff9fcb' : '#ffe8f3'; x.fillRect(i * s, j * s, s, s); }
    x.strokeStyle = 'rgba(230,120,175,.6)'; x.lineWidth = 3; for (let i = 0; i <= n; i++) { x.beginPath(); x.moveTo(i * s, 0); x.lineTo(i * s, w); x.stroke(); x.beginPath(); x.moveTo(0, i * s); x.lineTo(w, i * s); x.stroke(); }
    x.fillStyle = 'rgba(255,255,255,.75)'; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if ((i + j) % 2) { heartPath(x, i * s + s / 2, j * s + s / 2 + 4, 13); x.fill(); }
  }, [3.6, 3.2]);
  const floor = add(new THREE.PlaneGeometry(7.3, 6.3), new THREE.MeshPhysicalMaterial({ map: tileT, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.3 }), 0, 0.075, 0.05, { cast: false });
  floor.rotation.x = -Math.PI / 2; floor.name = 'floor';
  // front pet terrace: mint deck with tiny flowers
  const deckT = canvasTex(512, 256, (x, w, h) => {
    x.fillStyle = '#86dfc2'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#93e6ca' : '#7ad6b8'; x.fillRect(0, i * 32, w, 30); }
    x.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 8; i++) x.fillRect(0, i * 32 + 30, w, 2);
    const r = (a => () => (a = (a * 16807) % 2147483647) / 2147483647)(11);
    for (let i = 0; i < 22; i++) { const cx = r() * w, cy = r() * h, c = ['#ffffff', '#ffd1e8', '#fff3a6', '#e2ccff'][i % 4]; x.fillStyle = c; for (let k = 0; k < 5; k++) { const a = k * 1.2566; x.beginPath(); x.arc(cx + Math.cos(a) * 5, cy + Math.sin(a) * 5, 4.2, 0, 7); x.fill(); } x.fillStyle = '#ffb84d'; x.beginPath(); x.arc(cx, cy, 3, 0, 7); x.fill(); }
  }, [2, 1]);
  const deck = add(new THREE.PlaneGeometry(7.3, 1.98), new THREE.MeshPhysicalMaterial({ map: deckT, roughness: 0.5, clearcoat: 0.4 }), 0, 0.074, 4.18, { cast: false });
  deck.rotation.x = -Math.PI / 2;
  // a round pet bed and a toy ball on the terrace
  const bed = new THREE.Group(); bed.position.set(1.0, 0.08, 4.25); bed.scale.setScalar(0.8); G.add(bed);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.24, 16, 40), phys('#ff9fd0', { roughness: 0.5, clearcoat: 0.3 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.2; ring.scale.z = 0.9; ring.castShadow = true; bed.add(ring);
  const cush = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.16, 32), phys('#fff0f8', { roughness: 0.6, clearcoat: 0.2 })); cush.position.y = 0.1; cush.receiveShadow = true; bed.add(cush);
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; const d = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), phys('#ffffff')); d.position.set(Math.cos(a) * 0.62, 0.42, Math.sin(a) * 0.56); bed.add(d); }
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), phys('#ffe07a')); ball.position.set(-1.6, 0.25, 3.7); ball.castShadow = true; G.add(ball);
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 8, 24), phys('#ff7fb6')); stripe.position.copy(ball.position); stripe.rotation.set(0.6, 0.3, 0); G.add(stripe);
  const stepM = phys('#ffffff', { roughness: 0.3 });
  add(rbox(7.3, 0.06, 0.12, 0.03), stepM, 0, 0.09, 3.2, { cast: false });
  // frosting scallops around the rim (instanced)
  const scal = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 14, 10), phys('#ffd3ea', { roughness: 0.3 }), 120);
  let si = 0; const dm = new THREE.Object3D();
  const rim = (x0, z0, x1, z1, n) => { for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; dm.position.set(x0 + (x1 - x0) * t, -0.02, z0 + (z1 - z0) * t); dm.scale.set(1, 0.75, 1); dm.updateMatrix(); scal.setMatrixAt(si++, dm.matrix); } };
  rim(-3.9, 5.3, 3.9, 5.3, 22); rim(3.95, -3.3, 3.95, 5.3, 24);
  scal.count = si; scal.castShadow = false; scal.receiveShadow = true; G.add(scal);
  // drips on the slab front
  const drips = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.11, 0.25, 6, 10), phys('#ffe6f3'), 16);
  for (let i = 0; i < 16; i++) { const x = -3.7 + i * 0.5 + Math.sin(i * 7) * 0.1; dm.position.set(x, -0.28 - (i % 3) * 0.07, 5.28); dm.scale.set(1, 0.8 + (i % 4) * 0.25, 1); dm.updateMatrix(); drips.setMatrixAt(i, dm.matrix); }
  G.add(drips);

  // walls: back + left, wallpaper with dots and tiny hearts, lilac wainscot, mint rail
  const paper = canvasTex(256, 256, (x, w) => {
    x.fillStyle = '#f9b2da'; x.fillRect(0, 0, w, w);
    x.fillStyle = '#ffcfe7'; for (let i = 0; i < 4; i++) x.fillRect(i * 64 + 22, 0, 20, w);
    x.fillStyle = '#ff63a8'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const cx = i * 64 + ((j % 2) ? 32 : 0), cy = j * 64 + 32; heartPath(x, cx, cy, 10); x.fill(); }
    x.fillStyle = '#fff'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.beginPath(); x.arc(i * 64 + ((j % 2) ? 0 : 32), j * 64 + 32, 3.5, 0, 7); x.fill(); }
  }, [5, 2.4]);
  const paperL = paper.clone(); paperL.needsUpdate = true; paperL.repeat.set(4.4, 2.4);
  const wallM = new THREE.MeshPhysicalMaterial({ map: paper, roughness: 0.6, clearcoat: 0.2 });
  const wallLM = new THREE.MeshPhysicalMaterial({ map: paperL, roughness: 0.6, clearcoat: 0.2 });
  add(rbox(7.7, 3.4, 0.3, 0.1), wallM, 0, 1.78, -3.3);
  add(rbox(0.3, 3.4, 6.7, 0.1), wallLM, -3.95, 1.78, 0.05);
  const wain = phys('#b588f7', { roughness: 0.4 }), rail = phys('#6fe0bf', { roughness: 0.3 });
  add(rbox(7.5, 0.95, 0.12, 0.05), wain, 0.05, 0.55, -3.1); add(rbox(7.6, 0.14, 0.2, 0.07), rail, 0.05, 1.05, -3.08);
  add(rbox(0.12, 0.95, 6.4, 0.05), wain, -3.76, 0.55, 0.15); add(rbox(0.2, 0.14, 6.5, 0.07), rail, -3.74, 1.05, 0.15);
  // wainscot panel insets
  const insetM = phys('#cdaaff', { roughness: 0.4 });
  for (let i = 0; i < 6; i++) add(rbox(0.9, 0.55, 0.05, 0.04), insetM, -2.95 + i * 1.22, 0.55, -3.03, { cast: false });
  for (let i = 0; i < 5; i++) add(rbox(0.05, 0.55, 0.95, 0.04), insetM, -3.69, 0.55, -2.4 + i * 1.2, { cast: false });
  // wall top caps (rounded pink icing)
  add(rbox(7.9, 0.2, 0.46, 0.1), phys('#ff74b2'), 0, 3.5, -3.3); add(rbox(0.46, 0.2, 6.9, 0.1), phys('#ff74b2'), -3.95, 3.5, 0.05);

  // arched windows with a dreamy sky
  const sky = canvasTex(256, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#9fd8ff'); g.addColorStop(1, '#ffe2f4'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = '#fff'; const cl = (cx, cy, s) => { for (const [dx, dy, r] of [[0, 0, 1], [0.9, 0.15, 0.75], [-0.9, 0.2, 0.7], [0.4, -0.45, 0.7]]) { x.beginPath(); x.arc(cx + dx * s, cy + dy * s, r * s, 0, 7); x.fill(); } };
    cl(70, 90, 26); cl(190, 160, 20); cl(120, 215, 16);
    x.fillStyle = '#ffb3d6'; for (let i = 0; i < 9; i++) { x.beginPath(); x.ellipse(30 + i * 27, 245 - (i % 3) * 5, 14, 9, 0, 0, 7); x.fill(); }
  });
  const glassM = new THREE.MeshBasicMaterial({ map: sky, toneMapped: false });
  const frameM = phys('#ffffff', { roughness: 0.25 });
  const winAt = (x, y, parent, rotY = 0, z = 0) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; parent.add(g);
    const sh = new THREE.Shape(); const w = 0.62, h = 0.55; sh.moveTo(-w, -h); sh.lineTo(w, -h); sh.lineTo(w, h * 0.35); sh.absarc(0, h * 0.35, w, 0, Math.PI, false); sh.lineTo(-w, -h);
    const glass = new THREE.Mesh(new THREE.ShapeGeometry(sh, 24), glassM); glass.position.z = 0.02; g.add(glass);
    const sh2 = new THREE.Shape(); const W = w + 0.13, H = h + 0.13; sh2.moveTo(-W, -H); sh2.lineTo(W, -H); sh2.lineTo(W, h * 0.35); sh2.absarc(0, h * 0.35, W, 0, Math.PI, false); sh2.lineTo(-W, -H); sh2.holes.push(sh);
    const fr = new THREE.Mesh(new THREE.ExtrudeGeometry(sh2, { depth: 0.1, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, curveSegments: 24 }), frameM); fr.castShadow = true; g.add(fr);
    const bar = new THREE.Mesh(rbox(0.06, 1.5, 0.06, 0.03), frameM); bar.position.set(0, 0.05, 0.06); g.add(bar);
    const bar2 = new THREE.Mesh(rbox(1.24, 0.06, 0.06, 0.03), frameM); bar2.position.set(0, -0.05, 0.06); g.add(bar2);
    const sill = new THREE.Mesh(rbox(1.6, 0.1, 0.28, 0.05), phys('#9ff0d4')); sill.position.set(0, -0.72, 0.1); g.add(sill);
    // striped scalloped awning
    const aw = canvasTex(128, 16, (c, w2, h2) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#ff8fbf'; c.fillRect(i * 16, 0, 16, h2); } });
    const awn = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 1.7, 24, 1, true, -Math.PI / 2, Math.PI / 2.2), new THREE.MeshPhysicalMaterial({ map: aw, side: THREE.DoubleSide, roughness: 0.4, clearcoat: 0.6 }));
    awn.rotation.z = Math.PI / 2; awn.position.set(0, 0.95, -0.25); awn.castShadow = true; g.add(awn);
    for (let i = 0; i < 7; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), new THREE.MeshPhysicalMaterial({ color: i % 2 ? '#ffffff' : '#ff8fbf', roughness: 0.35, clearcoat: 1 })); b.scale.set(1, 0.7, 0.6); b.position.set(-0.75 + i * 0.25, 0.86, 0.6); g.add(b); }
    return g;
  };
  winAt(-2.05, 2.15, G, 0, -3.13); winAt(2.25, 2.15, G, 0, -3.13);
  winAt(-3.77, 2.15, G, Math.PI / 2, 0.9);

  // shop sign (name drawn in code)
  const signT = canvasTex(512, 220, (x, w, h) => {
    x.fillStyle = '#ffffff'; x.strokeStyle = '#ff7fb6'; x.lineWidth = 10;
    x.beginPath(); x.roundRect(12, 30, w - 24, h - 50, 80); x.fill(); x.stroke();
    x.font = '800 92px "Baloo 2", system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 14; x.strokeStyle = '#ffd1e6'; x.strokeText('Pocket Pom', w / 2, h / 2 + 4);
    x.fillStyle = '#ff5fa2'; x.fillText('Pocket Pom', w / 2, h / 2 + 4);
    x.fillStyle = '#9b6cf0'; x.font = '800 30px "Baloo 2", system-ui'; x.fillText('✿ pet café ✿', w / 2, h - 34);
  });
  const sign = add(new THREE.PlaneGeometry(2.3, 0.99), new THREE.MeshBasicMaterial({ map: signT, transparent: true, toneMapped: false }), 0.1, 2.85, -3.12, { cast: false });
  sign.userData.tex = signT;

  // fairy lights along the back wall top
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ toneMapped: false }), 30);
  const BC = ['#fff6a8', '#ffb8e0', '#b8f5ff', '#e2c4ff'].map(c => new THREE.Color(c).multiplyScalar(1.8));
  for (let i = 0; i < 30; i++) {
    const t = i / 29; let x, z;
    if (t < 0.6) { x = -3.7 + (t / 0.6) * 7.4; z = -3.08; } else { x = -3.72; z = -2.9 + ((t - 0.6) / 0.4) * 5.6; }
    const sag = Math.abs(Math.sin((t < 0.6 ? t / 0.6 : (t - 0.6) / 0.4) * Math.PI * (t < 0.6 ? 3 : 2))) * 0.18;
    dm.position.set(x, 3.25 - sag, z); dm.scale.setScalar(1); dm.updateMatrix(); bulbs.setMatrixAt(i, dm.matrix); bulbs.setColorAt(i, BC[i % 4]);
  }
  G.add(bulbs);
  // bunting on the left wall
  const flagC = ['#ff8fbf', '#ffe17a', '#8ee8cf', '#c8a6ff'];
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Shape(); s.moveTo(-0.17, 0); s.lineTo(0.17, 0); s.lineTo(0, -0.34); s.closePath();
    const f = add(new THREE.ShapeGeometry(s), new THREE.MeshStandardMaterial({ color: flagC[i % 4], side: THREE.DoubleSide, roughness: 0.6 }), -3.76, 3.02 - Math.sin((i + 0.5) / 9 * Math.PI) * 0.22, -2.6 + i * 0.62, { cast: false });
    f.rotation.y = Math.PI / 2;
  }

  // back bar: code counter with the cake case + boba display (the owner stands behind it)
  const barBody = phys('#86e8cc'), barTop = phys('#ff8fc2', { roughness: 0.25 });
  add(rbox(3.0, 0.9, 0.85, 0.12), barBody, 1.35, 0.52, -2.2);
  add(rbox(3.2, 0.12, 1.0, 0.06), barTop, 1.35, 1.0, -2.2);
  for (let i = 0; i < 4; i++) add(rbox(0.6, 0.5, 0.04, 0.04), phys('#d4fff2'), 0.25 + i * 0.73, 0.5, -1.76, { cast: false });
  // pink scallop skirt
  for (let i = 0; i < 12; i++) { const b = add(new THREE.SphereGeometry(0.13, 12, 8), phys('#ffffff'), -0.05 + i * 0.255, 0.92, -1.72, { cast: false }); b.scale.set(1, 0.6, 0.5); }
  const anchors = {
    caseAt: new THREE.Vector3(2.15, 1.06, -2.25), bobaAt: new THREE.Vector3(0.35, 1.06, -2.05), teaAt: new THREE.Vector3(0.95, 1.06, -2.3),
    succAt: new THREE.Vector3(-2.1, 0, -2.2),
    counterAt: new THREE.Vector3(-2.0, 0, -2.3), owner: new THREE.Vector3(1.1, 0.4, -2.8), serveFrom: new THREE.Vector3(1.0, 1.4, -2.0),
    door: new THREE.Vector3(3.55, 0, 1.45), doorOut: new THREE.Vector3(5.2, 0, 1.45),
  };
  for (const v of Object.values(anchors)) v.multiplyScalar(K);
  return { G, bulbs, anchors, floor };
}

// shadow-catcher-ish contact blob under pets/customers (soft dark disc)
let blobTex = null;
export function blob(size = 0.6) {
  if (!blobTex) blobTex = canvasTex(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(120,60,140,.45)'); g.addColorStop(1, 'rgba(120,60,140,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.015; m.renderOrder = 1; return m;
}

// code-built care tools: a kibble bowl, a fluffy brush
export function kibbleBowl() {
  const g = new THREE.Group();
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.36, 0.28, 28, 1), phys('#ff9cc8')); bowl.position.y = 0.14; g.add(bowl);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 10, 32), phys('#ffffff')); rim.rotation.x = Math.PI / 2; rim.position.y = 0.28; g.add(rim);
  const kib = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 8, 6), phys('#e8a466', { roughness: 0.5 }), 26);
  const d = new THREE.Object3D();
  for (let i = 0; i < 26; i++) { const a = i * 2.4, r = Math.sqrt(i / 26) * 0.38; d.position.set(Math.cos(a) * r, 0.3 + (1 - r / 0.4) * 0.07, Math.sin(a) * r); d.rotation.set(i, i * 2, 0); d.updateMatrix(); kib.setMatrixAt(i, d.matrix); kib.setColorAt(i, new THREE.Color(['#e8a466', '#f5c27a', '#ff9cc8'][i % 3])); }
  g.add(kib);
  const h = new THREE.Mesh(new THREE.ShapeGeometry((() => { const s = new THREE.Shape(); s.moveTo(0, -0.07); s.bezierCurveTo(-0.16, 0.04, -0.08, 0.15, 0, 0.07); s.bezierCurveTo(0.08, 0.15, 0.16, 0.04, 0, -0.07); return s; })()), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  h.position.set(0, 0.14, 0.505); g.add(h);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
export function brush() {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.5, 6, 12), phys('#c8a6ff')); handle.rotation.z = Math.PI / 2; handle.position.set(0.45, 0.12, 0); g.add(handle);
  const head = new THREE.Mesh(rbox(0.5, 0.16, 0.34, 0.08), phys('#ff9cc8')); head.position.y = 0.12; g.add(head);
  const bri = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.025, 0.02, 0.14, 6), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 }), 24);
  const d = new THREE.Object3D(); for (let i = 0; i < 24; i++) { d.position.set(-0.19 + (i % 6) * 0.076, -0.02, -0.12 + Math.floor(i / 6) * 0.08); d.updateMatrix(); bri.setMatrixAt(i, d.matrix); }
  g.add(bri);
  const hrt = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), phys('#ffffff')); hrt.position.set(0, 0.22, 0); g.add(hrt);
  return g;
}
