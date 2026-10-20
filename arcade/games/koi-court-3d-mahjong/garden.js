// Koi Court garden: the zen courtyard around the mahjong table. Raked sand, a wooden dais with a tatami mat, the
// AI 3D library's zen pieces (z01-z08 + a few garden extras) and code-built walls, cherry trees, stones and a torii.
// The meta goal: spend stars to restore the garden piece by piece (TASKS).
import { THREE } from './kit/hc.js';
import { GLTFLoader } from './kit/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from './kit/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from './kit/addons/utils/BufferGeometryUtils.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const SAND_Y = -0.55;
const loader = new GLTFLoader();
const MODELS = {};
// the library GLBs are quantized (normalized int attributes): copy to float before transforming, or positions clamp to ±1
function toFloat(src) {
  const g = new THREE.BufferGeometry(); if (src.index) g.setIndex(src.index.clone());
  for (const [name, a] of Object.entries(src.attributes)) {
    const n = a.count, s = a.itemSize, arr = new Float32Array(n * s), get = [a.getX, a.getY, a.getZ, a.getW];
    for (let i = 0; i < n; i++) for (let j = 0; j < s; j++) arr[i * s + j] = get[j].call(a, i);
    g.setAttribute(name, new THREE.BufferAttribute(arr, s));
  }
  return g;
}
export function loadModel(id) {
  if (MODELS[id]) return MODELS[id];
  return MODELS[id] = loader.loadAsync(`assets/${id}.glb`).then(g => {
    g.scene.updateMatrixWorld(true);
    let mesh = null; g.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
    const geo = toFloat(mesh.geometry); geo.applyMatrix4(mesh.matrixWorld);   // de-quantize first: the GLBs use normalized int attributes
    geo.rotateX(Math.PI / 2);                      // library GLBs are stored Z-up: stand them up (front faces +Z)
    geo.computeBoundingBox(); const bb = geo.boundingBox, s = bb.getSize(V3()), k = 1 / Math.max(s.x, s.y, s.z);
    geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2); geo.scale(k, k, k);
    geo.computeBoundingBox(); geo.computeBoundingSphere();
    const mat = mesh.material; mat.envMapIntensity = 0.85; mat.side = THREE.FrontSide;
    return { geo, mat };
  }).catch(e => { console.warn('model', id, e && e.message); return null; });
}

// ------------------------------------------------------------------ textures
function sandTex(raked, stones) {
  const N = 1536, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d');
  const W = 72, toPx = v => (v / W + 0.5) * N;
  x.fillStyle = raked ? '#efe2c6' : '#e3d3b2'; x.fillRect(0, 0, N, N);
  for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,250' : '150,120,80'},${Math.random() * 0.08})`; const s = Math.random() * 3 + 1; x.fillRect(Math.random() * N, Math.random() * N, s, s); }
  if (raked) {
    // parallel grooves, bending into rings around every stone island
    const step = 9;
    const field = (px, py) => { let best = 1e9, sx = 0, sy = 0, r = 0; for (const s of stones) { const d = Math.hypot(px - toPx(s.x), py - toPx(s.z)) - s.r / W * N; if (d < best) { best = d; sx = toPx(s.x); sy = toPx(s.z); r = s.r / W * N; } } return { best, sx, sy, r }; };
    x.lineWidth = 3.2;
    for (let y = 0; y < N; y += step) {
      x.beginPath(); let started = false;
      for (let px = 0; px <= N; px += 6) {
        const f = field(px, y); if (f.best < 70) { started = false; continue; }
        const py = y + Math.sin(px * 0.004 + y * 0.01) * 3;
        if (!started) { x.moveTo(px, py); started = true; } else x.lineTo(px, py);
      }
      x.strokeStyle = 'rgba(170,140,95,.42)'; x.stroke(); x.save(); x.translate(0, 3); x.strokeStyle = 'rgba(255,252,240,.6)'; x.lineWidth = 2; x.stroke(); x.restore(); x.lineWidth = 3.2;
    }
    for (const s of stones) {
      const cx = toPx(s.x), cy = toPx(s.z), r0 = s.r / W * N;
      for (let k = 1; k <= 7; k++) { x.beginPath(); x.ellipse(cx, cy, r0 + k * step, r0 * 0.9 + k * step, 0, 0, Math.PI * 2); x.strokeStyle = 'rgba(170,140,95,.42)'; x.lineWidth = 3.2; x.stroke(); x.beginPath(); x.ellipse(cx, cy + 3, r0 + k * step, r0 * 0.9 + k * step, 0, 0, Math.PI * 2); x.strokeStyle = 'rgba(255,252,240,.55)'; x.lineWidth = 2; x.stroke(); }
    }
  } else {
    // untidy: footprints, scuffs and fallen leaves
    for (let i = 0; i < 160; i++) { const px = Math.random() * N, py = Math.random() * N; x.fillStyle = `rgba(${120 + Math.random() * 60},${90 + Math.random() * 40},40,.5)`; x.beginPath(); x.ellipse(px, py, 6, 3, Math.random() * 3, 0, 7); x.fill(); }
    for (let i = 0; i < 60; i++) { x.strokeStyle = 'rgba(150,120,80,.15)'; x.lineWidth = 10; x.beginPath(); const px = Math.random() * N, py = Math.random() * N; x.moveTo(px, py); x.quadraticCurveTo(px + 40, py + 30, px + 90 * Math.random(), py + 80); x.stroke(); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function tatamiTex() {
  // deep indigo cloth with a soft seigaiha (wave) pattern: ivory tiles read clearly on it
  const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d');
  x.fillStyle = '#263c5c'; x.fillRect(0, 0, N, N);
  const r = 32;
  for (let row = -1; row < N / (r * 0.5) + 2; row++) for (let col = -1; col < N / (r * 2) + 2; col++) {
    const cx = col * r * 2 + (row % 2 ? r : 0), cy = row * r * 0.5;
    for (let k = 4; k >= 1; k--) { x.beginPath(); x.arc(cx, cy, r * k / 4, Math.PI, 0); x.fillStyle = k % 2 ? '#2b4466' : '#22375a'; x.fill(); x.lineWidth = 2; x.strokeStyle = 'rgba(160,190,230,.18)'; x.stroke(); }
  }
  for (let i = 0; i < 3000; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`; x.fillRect(Math.random() * N, Math.random() * N, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function woodTex(base = '#7a3f22') {
  const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, N, N);
  for (let i = 0; i < 90; i++) { x.strokeStyle = `rgba(${Math.random() < 0.5 ? '255,200,150' : '40,15,5'},${Math.random() * 0.12})`; x.lineWidth = 1 + Math.random() * 3; x.beginPath(); const y = Math.random() * N; x.moveTo(0, y); for (let px = 0; px <= N; px += 32) x.lineTo(px, y + Math.sin(px * 0.02 + i) * 4); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function skyTex() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 512; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#9fd0f2'); g.addColorStop(0.45, '#ffe6d2'); g.addColorStop(0.7, '#ffd4c8'); g.addColorStop(1, '#f5e3c9');
  x.fillStyle = g; x.fillRect(0, 0, 4, 512); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function glowTex(col = '255,210,140') {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, `rgba(${col},1)`); g.addColorStop(0.35, `rgba(${col},.45)`); g.addColorStop(1, `rgba(${col},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}
export function blobTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(60,40,20,.45)'); g.addColorStop(0.6, 'rgba(60,40,20,.18)'); g.addColorStop(1, 'rgba(60,40,20,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}

// ------------------------------------------------------------------ the garden
export function buildGarden(scene, opts = {}) {
  const G = { group: new THREE.Group(), tasks: [], done: new Set(), anim: [], glows: [], floaters: [], dusk: 0 };
  scene.add(G.group);
  scene.background = skyTex();
  scene.fog = new THREE.Fog('#f6dccb', 70, 170);

  const STONES = [{ x: -3.2, z: -11, r: 1.3 }, { x: 2.6, z: -11.4, r: 0.9 }, { x: -11.8, z: -2.2, r: 1.1 }, { x: 11.2, z: -2.6, r: 1.1 }, { x: 6.8, z: 12.2, r: 1.0 }, { x: -10.6, z: 11, r: 0.9 }];
  const sandMat = new THREE.MeshStandardMaterial({ map: sandTex(false, STONES), roughness: 0.95 });
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(72, 72), sandMat); sand.rotation.x = -Math.PI / 2; sand.position.y = SAND_Y; sand.receiveShadow = true; G.group.add(sand);
  // grass beyond the sand
  const grass = new THREE.Mesh(new THREE.RingGeometry(34, 140, 48), new THREE.MeshStandardMaterial({ color: '#9cc77a', roughness: 1 })); grass.rotation.x = -Math.PI / 2; grass.position.y = SAND_Y - 0.02; G.group.add(grass);
  // distant hills
  const hillM = new THREE.MeshStandardMaterial({ color: '#9bbf9a', roughness: 1, flatShading: true });
  for (const [x, z, s, h] of [[-50, -70, 26, 12], [-10, -85, 34, 18], [40, -72, 28, 13], [75, -55, 22, 10], [-80, -50, 22, 9]]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), hillM); m.scale.set(s, h, s * 0.7); m.position.set(x, SAND_Y - 1, z); G.group.add(m);
  }

  // stone islands (always there; the moss arrives with a task)
  const stoneM = new THREE.MeshStandardMaterial({ color: '#8f8a84', roughness: 0.85, flatShading: true });
  const stoneGeo = new THREE.IcosahedronGeometry(1, 1); { const p = stoneGeo.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + Math.sin(p.getX(i) * 5.1 + p.getZ(i) * 3.7) * 0.08 + Math.cos(p.getY(i) * 4.3) * 0.06; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); } stoneGeo.computeVertexNormals(); }
  const mossM = new THREE.MeshStandardMaterial({ color: '#6fa64a', roughness: 1 });
  const mossGroup = new THREE.Group(); mossGroup.visible = false; G.group.add(mossGroup);
  STONES.forEach((s, i) => {
    const n = 1 + (i % 3);
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(stoneGeo, stoneM); const sc = s.r * (k ? 0.55 : 0.9);
      m.scale.set(sc * 1.15, sc * 0.75, sc); m.position.set(s.x + (k ? (k === 1 ? 1 : -1) * s.r * 0.9 : 0), SAND_Y + sc * 0.35, s.z + (k ? 0.4 : 0)); m.rotation.set(0.3 * k, i + k, 0.2);
      m.castShadow = true; m.receiveShadow = true; G.group.add(m);
    }
    const moss = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mossM); moss.scale.set(s.r * 1.6, 0.35, s.r * 1.4); moss.position.set(s.x, SAND_Y, s.z); moss.receiveShadow = true; mossGroup.add(moss);
  });

  // the dais: dark wood frame + tatami mat, resized to every board
  const woodM = new THREE.MeshStandardMaterial({ map: woodTex('#7a3a20'), roughness: 0.45, metalness: 0.02 });
  const trimM = new THREE.MeshStandardMaterial({ color: '#d9a441', roughness: 0.3, metalness: 0.8 });
  const tat = tatamiTex(); const matM = new THREE.MeshStandardMaterial({ map: tat, roughness: 0.75 });
  const dais = new THREE.Group(); G.group.add(dais);
  const base = new THREE.Mesh(new RoundedBoxGeometry(1, 1, 1, 3, 0.04), woodM); base.castShadow = true; base.receiveShadow = true; dais.add(base);
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), matM); mat.rotation.x = -Math.PI / 2; mat.receiveShadow = true; dais.add(mat);
  const bandGeo = new THREE.BoxGeometry(1, 1, 1);
  const bands = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(bandGeo, new THREE.MeshStandardMaterial({ color: '#d9a441', roughness: 0.35, metalness: 0.6 })); m.receiveShadow = true; dais.add(m); return m; });
  const trims = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(bandGeo, trimM); dais.add(m); return m; });
  const feet = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 0.3, 12), woodM); m.castShadow = true; dais.add(m); return m; });
  G.setDais = (w, d) => {
    const H = 0.5, W = w + 1.4, D = d + 1.4;
    base.scale.set(W, H, D); base.position.set(0, -H / 2 - 0.001, 0);
    mat.scale.set(W - 0.5, D - 0.5, 1); mat.position.set(0, 0.002, 0); tat.repeat.set((W - 0.5) / 3.2, (D - 0.5) / 3.2);
    // cloth border of the tatami
    const b = 0.08; const set = (m, sx, sz, x, z) => { m.scale.set(sx, 0.012, sz); m.position.set(x, 0.008, z); };
    set(bands[0], W - 0.5, b, 0, -(D - 0.5) / 2 + b / 2); set(bands[1], W - 0.5, b, 0, (D - 0.5) / 2 - b / 2);
    set(bands[2], b, D - 0.5, -(W - 0.5) / 2 + b / 2, 0); set(bands[3], b, D - 0.5, (W - 0.5) / 2 - b / 2, 0);
    const tr = (m, sx, sz, x, z) => { m.scale.set(sx, 0.06, sz); m.position.set(x, -0.03, z); };
    tr(trims[0], W + 0.02, 0.06, 0, -D / 2); tr(trims[1], W + 0.02, 0.06, 0, D / 2); tr(trims[2], 0.06, D + 0.02, -W / 2, 0); tr(trims[3], 0.06, D + 0.02, W / 2, 0);
    feet.forEach((f, i) => f.position.set((i % 2 ? 1 : -1) * (W / 2 - 0.4), -H - 0.1, (i < 2 ? -1 : 1) * (D / 2 - 0.4)));
    G.daisSize = { W, D };
  };
  G.setDais(6, 8);

  // ---------------------------------------------------------------- placing library models
  const blob = new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false });
  async function place(id, x, z, s, ry = 0, y = SAND_Y, parent = G.group, shadow = true) {
    const m = await loadModel(id); if (!m) return null;
    const mesh = new THREE.Mesh(m.geo, m.mat); mesh.position.set(x, y, z); mesh.scale.setScalar(s); mesh.rotation.y = ry;
    mesh.castShadow = shadow && Math.abs(x) < 10 && Math.abs(z) < 10; mesh.receiveShadow = true; parent.add(mesh);   // far props: blob shadow only (triangle budget)
    if (y <= SAND_Y + 0.01) { const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), blob); sh.rotation.x = -Math.PI / 2; sh.scale.setScalar(s * 1.25); sh.position.set(x, SAND_Y + 0.02, z); parent.add(sh); mesh.userData.shadow = sh; }
    return mesh;
  }

  // ---------------------------------------------------------------- code-built pieces
  const redM = new THREE.MeshStandardMaterial({ color: '#d8392a', roughness: 0.4 });
  const blackM = new THREE.MeshStandardMaterial({ color: '#2b2522', roughness: 0.5 });
  function torii() {
    const g = new THREE.Group();
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 4.4, 16), redM); p.position.set(s * 1.9, 2.2, 0); p.castShadow = true; g.add(p); const f = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.4, 16), blackM); f.position.set(s * 1.9, 0.2, 0); g.add(f); }
    const nuki = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.3, 0.3), redM); nuki.position.y = 3.4; nuki.castShadow = true; g.add(nuki);
    const kasa = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.32, 0.5), blackM); kasa.position.y = 4.55; kasa.castShadow = true; g.add(kasa);
    const sh = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.34, 0.42), redM); sh.position.y = 4.25; g.add(sh);
    for (const s of [-1, 1]) { const tip = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.5), blackM); tip.position.set(s * 2.9, 4.7, 0); tip.rotation.z = s * 0.25; g.add(tip); }
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.12), blackM); plaque.position.set(0, 3.85, 0.1); g.add(plaque);
    return g;
  }
  const blossomM = new THREE.MeshStandardMaterial({ color: '#ffb6cf', roughness: 0.7, flatShading: true, emissive: '#ff9cbc', emissiveIntensity: 0.08 });
  const barkM = new THREE.MeshStandardMaterial({ color: '#6b4430', roughness: 0.9 });
  const mapleM = new THREE.MeshStandardMaterial({ color: '#f0703a', roughness: 0.7, flatShading: true, emissive: '#c03a10', emissiveIntensity: 0.06 });
  function cherryTree(seed = 1, size = 1, leafM = blossomM) {
    let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const g = new THREE.Group(); const trunk = [];
    let p = V3(0, 0, 0), dir = V3(0, 1, 0);
    for (let i = 0; i < 4; i++) {
      const len = 1.1 + r() * 0.4, rad = 0.38 - i * 0.07;
      const c = new THREE.CylinderGeometry(rad * 0.8, rad, len, 8); c.translate(0, len / 2, 0);
      const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), dir); c.applyQuaternion(q); c.translate(p.x, p.y, p.z); trunk.push(c);
      p = p.clone().addScaledVector(dir, len); dir = dir.clone().add(V3((r() - 0.5) * 0.7, 0, (r() - 0.5) * 0.5)).normalize();
    }
    const tm = new THREE.Mesh(mergeGeometries(trunk), barkM); tm.castShadow = true; g.add(tm);
    const puffs = [];
    for (let i = 0; i < 16; i++) {
      const a = r() * Math.PI * 2, d = 0.4 + r() * 1.8, sz = 0.7 + r() * 0.7;
      const sp = new THREE.IcosahedronGeometry(sz, 1); sp.scale(1, 0.75, 1); sp.translate(p.x + Math.cos(a) * d, p.y + 0.2 + r() * 1.2 - d * 0.25, p.z + Math.sin(a) * d * 0.8); puffs.push(sp);
    }
    const bm = new THREE.Mesh(mergeGeometries(puffs), leafM); bm.castShadow = true; g.add(bm);
    g.scale.setScalar(size);
    return g;
  }
  function wall() {
    const g = new THREE.Group();
    const plaster = new THREE.MeshStandardMaterial({ color: '#f6ecda', roughness: 0.9 });
    const roofM = new THREE.MeshStandardMaterial({ color: '#4a5a6a', roughness: 0.55 });
    const w = new THREE.Mesh(new THREE.BoxGeometry(60, 2.6, 0.7), plaster); w.position.y = 1.3; w.receiveShadow = true; g.add(w);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(60, 0.6, 0.9), new THREE.MeshStandardMaterial({ color: '#9a9088', roughness: 0.9 })); foot.position.y = 0.3; g.add(foot);
    for (let x = -28; x <= 28; x += 4) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.6, 0.8), woodM); p.position.set(x, 1.3, 0.02); g.add(p); }
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 61, 3, 1), roofM); roof.rotation.z = Math.PI / 2; roof.rotation.x = Math.PI / 2 + Math.PI / 6; roof.scale.set(1.2, 1, 0.55); roof.position.y = 2.95; roof.castShadow = true; g.add(roof);
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(61, 0.22, 0.3), roofM); ridge.position.y = 3.5; g.add(ridge);
    return g;
  }
  function stepping() {
    const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: '#a59d92', roughness: 0.9 });
    const pts = [[0.6, 8.6], [-0.5, 10.1], [0.5, 11.6], [-0.4, 13.1], [7.2, -9.4], [8.2, -10.8]];
    pts.forEach(([x, z], i) => { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.75 + (i % 3) * 0.1, 0.8, 0.22, 10), m); s.position.set(x, SAND_Y + 0.08, z); s.rotation.y = i; s.scale.z = 0.8; s.receiveShadow = true; s.castShadow = true; g.add(s); });
    return g;
  }
  function lanternPost(x, z) {
    const g = new THREE.Group(); g.position.set(x, SAND_Y, z);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 4.2, 0.22), woodM); post.position.y = 2.1; post.castShadow = true; g.add(post);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.18, 0.18), woodM); arm.position.set(0.6, 4.1, 0); g.add(arm);
    return g;
  }

  // ---------------------------------------------------------------- always there: the courtyard wall, old cherry trees, clipped shrubs
  const shrubM = new THREE.MeshStandardMaterial({ color: '#5f9a48', roughness: 0.9, flatShading: true });
  function shrubs(list, seed = 3) {
    let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; const parts = [];
    for (const [x, z, sz] of list) for (let k = 0; k < 4; k++) { const g = new THREE.IcosahedronGeometry(sz * (0.55 + r() * 0.35), 1); g.scale(1, 0.72, 1); g.translate(x + (r() - 0.5) * sz * 1.4, SAND_Y + sz * 0.38, z + (r() - 0.5) * sz); parts.push(g); }
    const m = new THREE.Mesh(mergeGeometries(parts), shrubM); m.castShadow = true; m.receiveShadow = true; return m;
  }
  { const w = wall(); w.position.set(0, SAND_Y, -14.5); G.group.add(w);
    const t1 = cherryTree(7, 1.2); t1.position.set(-8.6, SAND_Y, -11.6); G.group.add(t1);
    const t2 = cherryTree(29, 1.1); t2.position.set(9.4, SAND_Y, -12); G.group.add(t2);
    G.group.add(shrubs([[-13, -12.8, 1.3], [-4.5, -13, 1.0], [3.5, -13.2, 1.1], [13.5, -12.6, 1.3], [-16, -6, 1.2], [16.5, -4, 1.2], [-16, 10, 1.3], [16.5, 9, 1.2]])); }

  // ---------------------------------------------------------------- restoration tasks
  const T = (id, name, cost, thumb, focus, make) => G.tasks.push({ id, name, cost, thumb, focus, make });
  T('rake', 'Rake the sand', 1, 'sym:3', V3(0, 0, 3), async () => { sandMat.map.dispose(); sandMat.map = sandTex(true, STONES); sandMat.needsUpdate = true; return null; });
  T('lantern', 'Light a stone lantern', 1, 'z01', V3(7, 0, -6), () => place('z01', 7.3, -6.6, 3.0, -0.5));
  T('pond', 'Dig the koi pond', 2, 'z03', V3(-8.5, 0, 2.5), () => place('z03', -8.8, 2.6, 5.6, 0.35));
  T('lotus', 'Float the lotus flowers', 2, 'z07', V3(-8.5, 0, 2.5), async () => { const a = await place('z07', -10.2, 2.0, 1.25, 0.3, SAND_Y + 0.7, G.group, false); const b = await place('z07', -7.6, 3.9, 0.95, 1.8, SAND_Y + 0.7, G.group, false); return [a, b]; });
  T('bamboo', 'Plant the bamboo grove', 2, 'z05', V3(10, 0, -8), async () => [await place('z05', 10.6, -9.4, 4.6, 0.2), await place('z05', 12.8, -7.2, 4.0, 1.4), await place('z05', -11.5, -9.8, 4.8, 2.2)]);
  T('bonsai', 'Set the pine bonsai', 2, 'z02', V3(8, 0, 1.5), () => place('z02', 8.3, 1.2, 3.0, -0.7));
  T('moss', 'Grow moss on the stones', 2, 'sym:8', V3(-4, 0, -11), async () => { mossGroup.visible = true; return null; });
  T('bridge', 'Build the arched bridge', 3, 'z04', V3(-8.5, 0, -5), () => place('z04', -8.6, -5.4, 4.4, Math.PI / 2 - 0.15));
  T('steps', 'Lay the stepping stones', 2, 'sym:13', V3(0, 0, 10), async () => { const s = stepping(); G.group.add(s); return s; });
  T('cherry', 'Plant a blossom tree', 3, 'sym:10', V3(-12, 2, 7), async () => { const t = cherryTree(11, 0.95); t.position.set(-12.5, SAND_Y, 7.5); G.group.add(t); return t; });
  T('dragon', 'Raise the jade dragon', 3, 'z06', V3(7.5, 0, 7.5), () => place('z06', 7.6, 7.4, 2.6, -0.6));
  T('lanterns', 'Hang the paper lanterns', 3, 'z08', V3(0, 2, -12), async () => {
    const out = [], cord = new THREE.MeshBasicMaterial({ color: '#3a2418' });
    for (const x of [-6, -2, 2, 6]) {
      const l = await place('z08', x, -13.7, 2.1, 0, SAND_Y + 0.9, G.group); out.push(l);
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 4), cord); c.position.set(x, SAND_Y + 3.15, -13.7); G.group.add(c);
      addGlow(V3(x, SAND_Y + 1.9, -13.3), 3.2, '255,140,90');
    }
    return out;
  });
  T('maple', 'Plant a red maple', 3, 'sym:12', V3(12, 2, 1), async () => { const t = cherryTree(53, 1.0, mapleM); t.position.set(12.8, SAND_Y, 0.5); G.group.add(t); return t; });
  T('hydrangea', 'Plant hydrangea bushes', 3, 'h27', V3(-7, 0, 9), async () => [await place('h27', -7.2, 9.2, 2.1, 0.4), await place('h27', 10.2, 10.4, 2.0, 2)]);
  T('bonsai2', 'Display the cherry bonsai', 3, 'g06', V3(4.5, 0, 9), () => place('g06', 4.6, 9.4, 1.9, -0.4));
  T('lantern2', 'A second stone lantern', 3, 'z01', V3(-4.6, 0, 10.5), () => place('z01', -4.6, 10.8, 2.6, 0.6));
  T('birdbath', 'A stone bird bath', 3, 'h34', V3(10.5, 0, 5), () => place('h34', 10.8, 5.2, 1.9, -0.8));
  T('cherry2', 'A blossom grove', 4, 'sym:10', V3(0, 2, 13), async () => { const a = cherryTree(71, 0.9); a.position.set(12.5, SAND_Y, 13); G.group.add(a); const b = cherryTree(97, 0.85); b.position.set(-11.5, SAND_Y, 14); G.group.add(b); return [a, b]; });
  T('torii', 'Raise the torii gate', 4, 'sym:20', V3(0, 2, 14), async () => { const t = torii(); t.position.set(0, SAND_Y, 15.5); t.traverse(o => { if (o.isMesh) o.castShadow = true; }); G.group.add(t); return t; });
  T('fountain', 'A water basin by the gate', 4, 'h23', V3(-8, 0, 13), () => place('h23', -7.6, 13.4, 2.0, 0.5));
  T('temple', 'Wake the floating shrine', 5, 'd02', V3(-12, 2, -9), async () => {
    const m = await place('d02', -12.6, -9.4, 5.6, 0.5, SAND_Y + 1.2, G.group, true); if (m) { G.floaters.push(m); addGlow(V3(-12.6, SAND_Y + 0.3, -9.2), 4, '255,220,170'); }
    return m;
  });
  T('dusk', 'Lantern-lit evening', 5, 'sym:4', V3(0, 0, 0), async () => { G.dusk = 1; return null; });

  // lantern glows (additive sprites) — brighter at dusk
  const glowMap = glowTex();
  function addGlow(p, s, col) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap, color: `rgb(${col})`, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.35 })); sp.position.copy(p); sp.scale.setScalar(s); G.group.add(sp); G.glows.push(sp); }

  G.apply = async (id, animate) => {
    const t = G.tasks.find(t => t.id === id); if (!t || G.done.has(id)) return;
    G.done.add(id);
    if (id === 'lantern' || id === 'lantern2') addGlow(V3(id === 'lantern' ? 8.2 : -6.8, SAND_Y + 2.2, id === 'lantern' ? -6.2 : 12.6), 2.4, '255,200,120');
    const res = await t.make();
    const list = [].concat(res || []).filter(Boolean);
    if (animate) for (const o of list) { o.userData.y0 = o.position.y; o.userData.s0 = o.scale.clone(); o.position.y += 6; o.scale.multiplyScalar(0.6); G.anim.push({ o, t: 0 }); }
    return list;
  };
  G.nextTask = () => G.tasks.find(t => !G.done.has(t.id));
  G.update = (dt) => {
    for (let i = G.anim.length - 1; i >= 0; i--) {
      const a = G.anim[i]; a.t += dt / 0.8; const k = Math.min(1, a.t);
      const bounce = k < 1 ? 1 - Math.pow(1 - k, 3) : 1; const sq = Math.sin(Math.min(1, k * 1.3) * Math.PI) * 0.15;
      a.o.position.y = a.o.userData.y0 + 6 * (1 - bounce) * (1 - bounce);
      a.o.scale.copy(a.o.userData.s0).multiplyScalar(0.6 + 0.4 * bounce); a.o.scale.y *= 1 - sq * 0.6; a.o.scale.x *= 1 + sq * 0.3; a.o.scale.z *= 1 + sq * 0.3;
      if (a.t >= 1) { a.o.position.y = a.o.userData.y0; a.o.scale.copy(a.o.userData.s0); G.anim.splice(i, 1); }
    }
    const tt = performance.now() / 1000;
    for (const f of G.floaters) if (!G.anim.some(a => a.o === f)) { f.position.y = (f.userData.y0 ?? f.position.y) + Math.sin(tt * 0.9) * 0.25; f.userData.y0 ??= f.position.y; f.rotation.y += 0.002; }
    for (const [i, g] of G.glows.entries()) g.material.opacity = (0.28 + G.dusk * 0.4) * (0.9 + Math.sin(tt * 2 + i) * 0.1);
  };
  G.SAND_Y = SAND_Y; G.place = place;
  return G;
}

// ------------------------------------------------------------------ falling cherry petals
export function petals(scene, n = 70) {
  const g = new THREE.PlaneGeometry(0.16, 0.12);
  const m = new THREE.MeshStandardMaterial({ color: '#ffc2d6', side: THREE.DoubleSide, roughness: 0.6, emissive: '#ff9fbf', emissiveIntensity: 0.25 });
  const im = new THREE.InstancedMesh(g, m, n); im.frustumCulled = false; scene.add(im);
  const P = []; for (let i = 0; i < n; i++) P.push({ p: V3((Math.random() - 0.5) * 26, Math.random() * 8, (Math.random() - 0.5) * 22), r: V3(Math.random() * 6, Math.random() * 6, Math.random() * 6), s: 0.6 + Math.random() * 0.8, ph: Math.random() * 6 });
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = V3();
  return {
    im,
    update(dt, center) {
      const t = performance.now() / 1000;
      P.forEach((q, i) => {
        q.p.y -= dt * (0.55 + q.s * 0.3); q.p.x += dt * (0.5 + Math.sin(t * 0.7 + q.ph) * 0.6); q.p.z += dt * Math.cos(t * 0.5 + q.ph) * 0.3;
        q.r.x += dt * 1.6; q.r.y += dt * 1.1;
        if (q.p.y < -0.5) { q.p.set(center.x + (Math.random() - 0.5) * 26, 4 + Math.random() * 4, center.z + (Math.random() - 0.5) * 22 - 2); }
        M.compose(q.p, Q.setFromEuler(E.set(q.r.x, q.r.y, q.r.z)), S.setScalar(q.s)); im.setMatrixAt(i, M);
      });
      im.instanceMatrix.needsUpdate = true;
    },
  };
}
