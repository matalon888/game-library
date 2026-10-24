// Bubblebay meta: the bay you restore with stars. Each island is a 3D diorama on a sandy, grassy isle in a turquoise
// sea; tasks place garden pieces, rescued critters wander the beach. Islands, sea, sky and dock are built here.
import { THREE } from './kit/hc.js';
import { piece } from './assets.js';

const PI = Math.PI, V3 = THREE.Vector3;
export const ISLAND_R = 5.2;

// at: [x, z] on the isle (front = +z, toward the camera), size = largest side, rot = y rotation
export const ISLANDS = [
  { id: 'lighthouse', name: 'Lighthouse Isle', dio: 'd01', dioS: 5.2, dioAt: [0.2, -1.9], sea: '#12b0d0', tasks: [
    { id: 'crates', name: 'Clear the washed-up crates', icon: '🧺', kind: 'clutter', cost: 1 },
    { id: 'bench', name: 'Seaside bench', item: 'h22', at: [-2.6, 1.4], size: 1.3, rot: 0.5, cost: 1 },
    { id: 'roses', name: 'Rose bush', item: 'h26', at: [2.7, 0.9], size: 1.1, rot: 0, cost: 2 },
    { id: 'lamp', name: 'Harbour lamp', item: 'h30', at: [-1.2, 2.6], size: 1.7, rot: 0, cost: 2 },
    { id: 'bath', name: 'Bird bath', item: 'h34', at: [1.4, 2.4], size: 1.0, rot: -0.4, cost: 2 },
    { id: 'barrow', name: 'Flower barrow', item: 'h35', at: [3.1, 2.3], size: 1.1, rot: -0.9, cost: 3 },
    { id: 'fountain', name: 'Shell fountain', item: 'h23', at: [-3.3, -0.2], size: 1.3, rot: 0, cost: 3 },
  ] },
  { id: 'palm', name: 'Palm Cove', dio: 'd07', dioS: 5.4, dioAt: [0, -1.8], sea: '#0fc0c8', tasks: [
    { id: 'crates', name: 'Clear the washed-up crates', icon: '🧺', kind: 'clutter', cost: 1 },
    { id: 'swing', name: 'Hammock swing', item: 'h25', at: [-2.7, 1.2], size: 1.5, rot: 0.6, cost: 2 },
    { id: 'hydra', name: 'Hydrangea', item: 'h27', at: [2.8, 1.1], size: 1.0, rot: 0, cost: 2 },
    { id: 'pond', name: 'Lily pond', item: 'h33', at: [0.9, 2.5], size: 1.5, rot: 0, cost: 2 },
    { id: 'cafe', name: 'Beach café table', item: 'f12', at: [-1.6, 2.7], size: 1.3, rot: 0.2, cost: 3 },
    { id: 'hive', name: 'Honey hive', item: 'r17', at: [3.3, -0.4], size: 0.9, rot: -0.6, cost: 2 },
    { id: 'gazebo', name: 'Sunset gazebo', item: 'h24', at: [-3.4, -0.6], size: 1.9, rot: 0.3, cost: 3 },
  ] },
  { id: 'cottage', name: 'Rose Cottage', dio: 'd09', dioS: 5.2, dioAt: [0, -1.8], sea: '#1aa8de', tasks: [
    { id: 'crates', name: 'Clear the washed-up crates', icon: '🧺', kind: 'clutter', cost: 1 },
    { id: 'lav', name: 'Lavender planter', item: 'h28', at: [-2.6, 1.6], size: 1.0, rot: 0.3, cost: 2 },
    { id: 'well', name: 'Wishing well', item: 'r13', at: [2.7, 1.2], size: 1.3, rot: -0.5, cost: 2 },
    { id: 'topi', name: 'Spiral topiary', item: 'h29', at: [-0.9, 2.7], size: 1.4, rot: 0, cost: 2 },
    { id: 'apple', name: 'Apple tree', item: 'r18', at: [-3.3, -0.4], size: 2.0, rot: 0, cost: 3 },
    { id: 'basket', name: 'Garden basket', item: 'g17', at: [1.3, 2.6], size: 0.8, rot: 0.4, cost: 1 },
    { id: 'stall', name: 'Flower stall', item: 'r25', at: [3.4, -0.5], size: 1.7, rot: -0.7, cost: 3 },
  ] },
  { id: 'dome', name: 'Blue Dome Cliffs', dio: 'd04', dioS: 5.4, dioAt: [0, -1.9], sea: '#0f9fe0', tasks: [
    { id: 'crates', name: 'Clear the washed-up crates', icon: '🧺', kind: 'clutter', cost: 1 },
    { id: 'bench', name: 'White bench', item: 'h22', at: [2.6, 1.4], size: 1.3, rot: -0.5, cost: 2 },
    { id: 'plant', name: 'Potted palm', item: 'h05', at: [-2.8, 1.2], size: 1.2, rot: 0, cost: 1 },
    { id: 'bridge', name: 'Little bridge', item: 'z04', at: [-0.9, 2.6], size: 1.6, rot: 1.2, cost: 3 },
    { id: 'roses', name: 'Rose bush', item: 'h26', at: [1.5, 2.6], size: 1.0, rot: 0, cost: 2 },
    { id: 'fountain', name: 'Plaza fountain', item: 'h23', at: [3.3, -0.4], size: 1.4, rot: 0, cost: 3 },
    { id: 'gift', name: 'Welcome gifts', item: 't21', at: [-3.2, -0.4], size: 0.8, rot: 0.3, cost: 2 },
  ] },
  { id: 'canal', name: 'Canal Town', dio: 'd05', dioS: 5.4, dioAt: [0, -1.9], sea: '#13b2c4', tasks: [
    { id: 'crates', name: 'Clear the washed-up crates', icon: '🧺', kind: 'clutter', cost: 1 },
    { id: 'cafe', name: 'Canal café', item: 'f12', at: [-2.6, 1.4], size: 1.3, rot: 0.4, cost: 2 },
    { id: 'lamp', name: 'Street lamp', item: 'h30', at: [2.3, 1.8], size: 1.7, rot: 0, cost: 1 },
    { id: 'lav', name: 'Lavender box', item: 'h28', at: [-0.9, 2.7], size: 1.0, rot: 0, cost: 2 },
    { id: 'hydra', name: 'Hydrangea', item: 'h27', at: [1.0, 2.7], size: 1.0, rot: 0, cost: 2 },
    { id: 'stall', name: 'Market stall', item: 'r25', at: [3.4, -0.5], size: 1.7, rot: -0.7, cost: 3 },
    { id: 'swing', name: 'Garden swing', item: 'h25', at: [-3.4, -0.5], size: 1.5, rot: 0.5, cost: 3 },
  ] },
];

// ---------------------------------------------------------------- textures
function noiseTex(base, spots, n = 256, rep = 4, amt = 0.06) {
  const c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, n, n);
  for (let i = 0; i < n * 3; i++) { x.fillStyle = spots[i % spots.length]; x.globalAlpha = Math.random() * amt; const s = 1 + Math.random() * 5; x.beginPath(); x.arc(Math.random() * n, Math.random() * n, s, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function waterNormal(n = 256) {   // tileable ripple normal map from summed sines
  const c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d'), img = x.createImageData(n, n), h = new Float32Array(n * n);
  const waves = []; for (let i = 0; i < 14; i++) waves.push({ kx: ((Math.random() * 10) | 0) - 5, ky: ((Math.random() * 10) | 0) - 5, a: Math.random() * 0.5 + 0.15, p: Math.random() * 7 }); for (const w of waves) if (!w.kx && !w.ky) w.kx = 3;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { let v = 0; for (const w of waves) v += w.a * Math.sin((w.kx * i + w.ky * j) / n * PI * 2 + w.p); h[j * n + i] = v; }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const dx = h[j * n + (i + 1) % n] - h[j * n + (i - 1 + n) % n], dy = h[((j + 1) % n) * n + i] - h[((j - 1 + n) % n) * n + i];
    const nx = -dx * 2, ny = -dy * 2, nz = 1, l = Math.hypot(nx, ny, nz), k = (j * n + i) * 4;
    img.data[k] = (nx / l * 0.5 + 0.5) * 255; img.data[k + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[k + 2] = (nz / l * 0.5 + 0.5) * 255; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function radialTex(stops, n = 256) {
  const c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d'), g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  for (const [o, col] of stops) g.addColorStop(o, col); x.fillStyle = g; x.fillRect(0, 0, n, n); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function foamTex(n = 512) {
  const c = document.createElement('canvas'); c.width = n; c.height = 64; const x = c.getContext('2d');
  for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.6})`; x.beginPath(); x.ellipse(Math.random() * n, 20 + Math.random() * 30, 3 + Math.random() * 14, 2 + Math.random() * 5, 0, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.repeat.set(6, 1); return t;
}

// ---------------------------------------------------------------- sea + sky (shared by every island)
export function buildSea(scene) {
  const g = new THREE.Group(); scene.add(g);
  const nrm = waterNormal(); nrm.repeat.set(40, 40);
  const mat = new THREE.MeshPhysicalMaterial({ color: '#36c6d9', roughness: 0.12, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.08, normalMap: nrm, normalScale: new THREE.Vector2(0.18, 0.18), envMapIntensity: 0.9, sheen: 0.3, sheenColor: new THREE.Color('#bff6ff') });
  const sea = new THREE.Mesh(new THREE.CircleGeometry(150, 64), mat); sea.rotation.x = -PI / 2; sea.receiveShadow = true; g.add(sea);
  const shallow = new THREE.Mesh(new THREE.CircleGeometry(ISLAND_R + 4.5, 64), new THREE.MeshBasicMaterial({ map: radialTex([[0, 'rgba(170,255,240,.95)'], [0.55, 'rgba(140,250,235,.7)'], [1, 'rgba(120,240,230,0)']]), transparent: true, depthWrite: false, toneMapped: false, opacity: 0.55 }));
  shallow.rotation.x = -PI / 2; shallow.position.y = 0.02; g.add(shallow);
  const foam = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_R + 0.45, ISLAND_R + 0.45, 0.14, 64, 1, true), new THREE.MeshBasicMaterial({ map: foamTex(), transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, alphaMap: null }));
  foam.position.y = 0.06; g.add(foam);
  const foam2 = new THREE.Mesh(new THREE.RingGeometry(ISLAND_R + 0.05, ISLAND_R + 0.9, 64), new THREE.MeshBasicMaterial({ map: radialTex([[0, 'rgba(255,255,255,0)'], [0.84, 'rgba(255,255,255,0)'], [0.9, 'rgba(255,255,255,.9)'], [1, 'rgba(255,255,255,0)']]), transparent: true, depthWrite: false, toneMapped: false }));
  foam2.rotation.x = -PI / 2; foam2.position.y = 0.03; g.add(foam2);
  // puffy clouds (one instanced mesh)
  const cg = new THREE.SphereGeometry(1, 16, 12), cm = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#fff4f0', emissiveIntensity: 0.55 });
  const puffs = []; for (let k = 0; k < 7; k++) { const a = -PI / 2 + (k - 3) * 0.34 + (Math.random() - 0.5) * 0.15, d = 55 + Math.random() * 20, cx = Math.cos(a) * d, cz = Math.sin(a) * d, cy = 7 + Math.random() * 8;
    for (let j = 0; j < 6; j++) puffs.push([cx + (j - 2.5) * 2.6 + Math.random(), cy + Math.random() * 1.6 + (j === 2 || j === 3 ? 1.5 : 0), cz + Math.random() * 2, 2.2 + Math.random() * 1.8]); }
  const clouds = new THREE.InstancedMesh(cg, cm, puffs.length); const m = new THREE.Matrix4();
  puffs.forEach((p, i) => { m.makeScale(p[3] * 1.3, p[3] * 0.8, p[3]); m.setPosition(p[0], p[1], p[2]); clouds.setMatrixAt(i, m); }); g.add(clouds);
  let t = 0;
  return { group: g, mat, foam, update(dt) { t += dt; nrm.offset.set(t * 0.012, t * 0.007); foam.material.map.offset.x = t * 0.01; foam.scale.setScalar(1 + Math.sin(t * 1.3) * 0.012); foam2.scale.setScalar(1 + Math.sin(t * 1.1 + 1) * 0.02); } };
}

// ---------------------------------------------------------------- one island
const sandTex = noiseTex('#efc98c', ['#d4a868', '#fbe3b6', '#e2b878'], 256, 6, 0.3);
const grassTex = noiseTex('#5fb84a', ['#4a9e3c', '#8fd46a', '#6cc04a'], 256, 5, 0.35);
const sandMat = new THREE.MeshStandardMaterial({ map: sandTex, roughness: 0.92 });
const grassMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.85 });
const woodMat = new THREE.MeshStandardMaterial({ color: '#c08a5b', roughness: 0.7 });
const woodDark = new THREE.MeshStandardMaterial({ color: '#8f6040', roughness: 0.75 });

function isleGeometry() {
  const R = ISLAND_R, prof = [[0, 0.42], [R * 0.6, 0.42], [R * 0.86, 0.36], [R * 0.95, 0.22], [R, 0.05], [R + 0.25, -0.3]].map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(prof, 72); return g;
}
function grassGeometry(seed) {
  const s = new THREE.Shape(), n = 64, R = ISLAND_R * 0.8;
  for (let i = 0; i <= n; i++) { const a = i / n * PI * 2, r = R * (1 + 0.05 * Math.sin(a * 5 + seed) + 0.035 * Math.sin(a * 11 + seed * 2)) - (Math.sin(a) > 0.2 ? 0.55 * Math.sin(a) : 0); const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? s.lineTo(x, y) : s.moveTo(x, y); }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.12, bevelSegments: 3, curveSegments: 4 });
  g.rotateX(-PI / 2); return g;
}
function dock() {
  const g = new THREE.Group(), L = 3.6;
  for (let i = 0; i < 9; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.36), i % 2 ? woodMat : woodDark); p.position.set(0, 0.45, ISLAND_R - 0.6 + i * 0.41); p.rotation.y = (Math.random() - 0.5) * 0.04; p.castShadow = p.receiveShadow = true; g.add(p); }
  for (const sx of [-0.7, 0.7]) for (let i = 0; i < 3; i++) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 1.2, 10), woodDark); post.position.set(sx, 0.05, ISLAND_R + 0.1 + i * 1.4); post.castShadow = true; g.add(post);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 6, 0, PI * 2, 0, PI / 2), woodDark); cap.position.set(sx, 0.65, ISLAND_R + 0.1 + i * 1.4); g.add(cap); }
  const rope = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.05, 6, 16), new THREE.MeshStandardMaterial({ color: '#f1e1bf', roughness: 0.8 })); rope.position.set(0.7, 0.52, ISLAND_R + 2.9); rope.rotation.x = PI / 2; g.add(rope);
  g.userData.end = new V3(0, 0.5, ISLAND_R + 2.6); return g;
}

export async function buildIsland(def, seed = 1) {
  const group = new THREE.Group();
  const isle = new THREE.Mesh(isleGeometry(), sandMat); isle.receiveShadow = true; group.add(isle);
  const grass = new THREE.Mesh(grassGeometry(seed), grassMat); grass.position.y = 0.36; grass.receiveShadow = true; group.add(grass);
  const dk = dock(); group.add(dk);
  // the landmark diorama
  const dp = await piece(def.dio, 'base');
  const dio = new THREE.Mesh(dp.geo, dp.mat); dio.scale.setScalar(def.dioS); dio.position.set(def.dioAt[0], 0.42, def.dioAt[1]); dio.castShadow = true; dio.receiveShadow = true; group.add(dio);
  // a few beach rocks + shells (code)
  const rockMat = new THREE.MeshStandardMaterial({ color: '#b8aca0', roughness: 0.8, flatShading: true });
  for (let i = 0; i < 9; i++) { const a = PI * 0.15 + i / 9 * PI * 1.7 + Math.random() * 0.2, r = ISLAND_R * (0.95 + Math.random() * 0.06), rk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22 + Math.random() * 0.25, 0), rockMat);
    rk.position.set(Math.cos(a) * r, 0.1, Math.sin(a) * r); if (rk.position.z > 3.8 && Math.abs(rk.position.x) < 1.5) continue; rk.rotation.set(Math.random() * 3, Math.random() * 3, 0); rk.scale.y = 0.7; rk.castShadow = true; group.add(rk); }
  // tasks
  const items = {};
  await Promise.all(def.tasks.filter(t => t.item).map(async t => {
    const p = await piece(t.item, 'base'); const m = new THREE.Mesh(p.geo, p.mat); m.scale.setScalar(t.size); m.position.set(t.at[0], 0.42, t.at[1]); m.rotation.y = t.rot || 0;
    m.castShadow = true; m.receiveShadow = true; m.visible = false; m.userData.base = m.scale.clone(); items[t.id] = m; group.add(m);
  }));
  // washed-up clutter (cleared by the first task)
  const clutter = new THREE.Group(); group.add(clutter);
  const cp = await piece('m11', 'base');
  for (const [x, z, s, r] of [[-1.8, 1.8, 0.75, 0.3], [-1.2, 2.3, 0.55, -0.5], [1.9, 1.9, 0.7, 0.9], [2.4, 0.5, 0.5, 0.2], [0.6, 3.4, 0.5, -0.3], [-3.0, 0.6, 0.6, 0.7]]) {
    const m = new THREE.Mesh(cp.geo, cp.mat); m.scale.setScalar(s); m.position.set(x, 0.4, z); m.rotation.set((Math.random() - 0.5) * 0.4, r, (Math.random() - 0.5) * 0.4); m.castShadow = true; clutter.add(m);
  }
  const seaweed = new THREE.MeshStandardMaterial({ color: '#5d8f4a', roughness: 0.9 });
  for (let i = 0; i < 7; i++) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.25 + Math.random() * 0.15, 0.06, 6, 14, PI * 1.3), seaweed); w.rotation.x = -PI / 2; w.rotation.z = Math.random() * 6; w.position.set((Math.random() - 0.5) * 6, 0.44, 0.8 + Math.random() * 2.6); clutter.add(w); }
  const apply = { clutter(on) { clutter.visible = !on; } };
  return { group, def, items, clutter, apply, dio, dockEnd: dk.userData.end };
}

// ---------------------------------------------------------------- rescued critters wandering the isle
export function critterHerd(group) {
  const list = [];
  return {
    list,
    async set(species, P) {   // species: array of critter indices to show
      while (list.length > species.length) { const c = list.pop(); group.remove(c.m); }
      for (let i = 0; i < species.length; i++) {
        if (list[i] && list[i].sp === species[i]) continue;
        if (list[i]) group.remove(list[i].m);
        const p = P[species[i]], m = new THREE.Mesh(p.geo, p.mat); m.scale.setScalar(0.6); m.castShadow = true;
        const a = Math.random() * PI * 2, r = 1 + Math.random() * 2.4; m.position.set(Math.cos(a) * r * 1.1, 0.42, 1.2 + Math.abs(Math.sin(a)) * 1.8);
        group.add(m); list[i] = { m, sp: species[i], tgt: m.position.clone(), wait: Math.random() * 2, hop: 0 };
      }
    },
    update(dt, t) {
      for (const c of list) {
        const m = c.m;
        if (c.wait > 0) { c.wait -= dt; m.position.y = 0.42; m.rotation.z = Math.sin(t * 3 + c.sp) * 0.05; if (c.wait <= 0) { const a = Math.random() * PI * 2, r = 0.8 + Math.random() * 2.8; c.tgt.set(Math.cos(a) * r * 1.15, 0.42, 0.9 + Math.abs(Math.sin(a)) * r * 0.75); } continue; }
        const d = new V3().subVectors(c.tgt, m.position); d.y = 0; const dist = d.length();
        if (dist < 0.08) { c.wait = 1 + Math.random() * 3; continue; }
        const want = Math.atan2(d.x, d.z); let da = want - m.rotation.y; while (da > PI) da -= 2 * PI; while (da < -PI) da += 2 * PI; m.rotation.y += da * Math.min(1, dt * 8);
        d.normalize().multiplyScalar(Math.min(dist, dt * 1.1)); m.position.add(d); c.hop += dt * 11; m.position.y = 0.42 + Math.abs(Math.sin(c.hop)) * 0.16;
      }
    },
  };
}
