// Honeyfield Farm — the land: painted ground (grass, paths, pens, road), fences, hills, trees, field beds.
// Built in code around the AI 3D farm props (placed from game.js). Everything static is merged per material.
import { THREE } from './kit/hc.js';
import { RoundedBoxGeometry } from './kit/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from './kit/addons/utils/BufferGeometryUtils.js';

// farm layout (world units: x → right, z → toward the camera, y up)
export const LAY = {
  house: [-2.55, -9.35], barn: [2.6, -9.15], mill: [-3.1, -6.15], oven: [3.15, -6.05],
  plotStep: 1.42, plotSize: 1.28, plotCols: [-1.42, 0, 1.42], plotRows: [-4.45, -3.03, -1.61, -0.19],
  coop: [-3.35, -4.35], yard: { x0: -4.15, x1: -2.4, z0: -5.0, z1: -1.05 },
  hive: [-3.3, 0.0], tree: [3.2, -4.2], tree2: [3.5, -2.75], stand: [3.25, -0.35],
  cowPen: { x0: -4.15, x1: -0.35, z0: 1.55, z1: 4.55 }, sheepPen: { x0: 0.35, x1: 4.15, z0: 1.55, z1: 4.55 },
  roadZ: 6.05, truck: [-1.7, 6.05], fenceZ: 5.15,
};
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...o });
function canvasTex(w, h, draw, rep = null) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
const rbox = (w, h, d, r = 0.04, s = 2) => new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2, h / 2, d / 2));
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

function grassNoise(x, w, h, base, n = 9000) {
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) { const g = x.createRadialGradient(0, 0, 0, 0, 0, 1); const c = rnd() < 0.5 ? 'rgba(255,255,170,' : 'rgba(40,110,30,'; g.addColorStop(0, c + (0.05 + rnd() * 0.07) + ')'); g.addColorStop(1, c + '0)');
    x.save(); x.translate(rnd() * w, rnd() * h); x.scale(20 + rnd() * 60, 20 + rnd() * 60); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 1, 0, 7); x.fill(); x.restore(); }
  for (let i = 0; i < n; i++) { const px = rnd() * w, py = rnd() * h, l = 2 + rnd() * 5; x.strokeStyle = rnd() < 0.5 ? `rgba(220,255,140,${0.12 + rnd() * 0.2})` : `rgba(30,100,25,${0.1 + rnd() * 0.15})`; x.lineWidth = 1 + rnd(); x.beginPath(); x.moveTo(px, py); x.lineTo(px + (rnd() - 0.5) * 2, py - l); x.stroke(); }
}

export function buildWorld(scene) {
  const G = new THREE.Group(); scene.add(G);
  const add = (geo, mat, x, y, z, { shadow = true, recv = true, parent = G } = {}) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = recv; parent.add(m); return m; };

  // ---------------------------------------------------------------- painted ground: grass + paths + pens + road in one texture
  const GX0 = -13, GX1 = 13, GZ0 = -15, GZ1 = 12, PX = 64;          // pixels per world unit
  const gw = (GX1 - GX0) * PX, gh = (GZ1 - GZ0) * PX;
  const U = x => (x - GX0) * PX, V = z => (z - GZ0) * PX;
  const groundT = canvasTex(gw, gh, (x, w, h) => {
    grassNoise(x, w, h, '#7ccb4a', 26000);
    const blob = (pts, fill, edge, ew = 10) => { x.save(); x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(U(a), V(b)) : x.moveTo(U(a), V(b)))); x.closePath(); x.lineJoin = 'round'; x.strokeStyle = edge; x.lineWidth = ew; x.stroke(); x.fillStyle = fill; x.fill(); x.restore(); };
    const rr = (x0, z0, x1, z1, r, fill, edge, ew = 12) => { x.save(); x.beginPath(); x.roundRect(U(x0), V(z0), (x1 - x0) * PX, (z1 - z0) * PX, r * PX); x.strokeStyle = edge; x.lineWidth = ew; x.stroke(); x.fillStyle = fill; x.fill(); x.restore(); };
    const speckle = (x0, z0, x1, z1, cols, n) => { for (let i = 0; i < n; i++) { x.fillStyle = cols[Math.floor(rnd() * cols.length)]; const s = 1 + rnd() * 3; x.fillRect(U(x0 + rnd() * (x1 - x0)), V(z0 + rnd() * (z1 - z0)), s, s); } };
    // dirt paths (house → road, side lanes)
    const path = '#e7c793', pathE = 'rgba(150,110,60,.35)';
    rr(-0.38, -8.4, 0.38, 6.4, 0.38, path, pathE, 14);
    rr(-4.6, -7.55, 4.6, -7.05, 0.25, path, pathE, 12);
    rr(-4.4, 0.78, 4.4, 1.22, 0.22, path, pathE, 12);
    speckle(-0.38, -8.4, 0.38, 6.4, ['rgba(160,120,70,.35)', 'rgba(255,240,210,.5)'], 2500);
    speckle(-4.6, -7.55, 4.6, -7.05, ['rgba(160,120,70,.35)', 'rgba(255,240,210,.5)'], 1500);
    speckle(-4.4, 0.78, 4.4, 1.22, ['rgba(160,120,70,.35)', 'rgba(255,240,210,.5)'], 1500);
    // yard in front of the house + barn (packed earth)
    rr(-4.6, -10.8, 4.6, -7.55, 0.8, '#dcbb85', pathE, 14); speckle(-4.6, -10.8, 4.6, -7.55, ['rgba(150,110,60,.3)', 'rgba(255,240,210,.45)'], 4000);
    // field bed: darker tilled earth framing the plots
    rr(-2.22, -5.25, 2.22, 0.6, 0.3, '#9a6a42', 'rgba(80,50,25,.5)', 10); speckle(-2.22, -5.25, 2.22, 0.6, ['rgba(60,35,15,.4)', 'rgba(200,150,100,.3)'], 5000);
    // pens: straw floor
    for (const P of [LAY.cowPen, LAY.sheepPen, LAY.yard]) { rr(P.x0 + 0.1, P.z0 + 0.1, P.x1 - 0.1, P.z1 - 0.1, 0.3, P === LAY.yard ? '#e9d08a' : '#cfe07a', 'rgba(120,120,40,.25)', 10);
      for (let i = 0; i < 900; i++) { const px = U(P.x0 + 0.2 + rnd() * (P.x1 - P.x0 - 0.4)), pz = V(P.z0 + 0.2 + rnd() * (P.z1 - P.z0 - 0.4)); x.strokeStyle = `rgba(${rnd() < 0.5 ? '255,235,150' : '190,150,60'},.5)`; x.lineWidth = 1.5; x.beginPath(); x.moveTo(px, pz); const a = rnd() * 6.3; x.lineTo(px + Math.cos(a) * 7, pz + Math.sin(a) * 7); x.stroke(); } }
    // mud puddle for the pig + pond-ish shade under the trees
    blob([[-5.9, 5.0], [-4.7, 4.8], [-4.3, 5.3], [-5.0, 5.8], [-5.9, 5.6]], '#8a6040', 'rgba(70,45,25,.4)', 10);
    // the road along the bottom
    rr(GX0 - 1, LAY.roadZ - 0.8, GX1 + 1, LAY.roadZ + 0.8, 0.1, '#d2b07a', 'rgba(140,100,55,.45)', 16);
    speckle(GX0, LAY.roadZ - 0.8, GX1, LAY.roadZ + 0.8, ['rgba(120,90,50,.35)', 'rgba(255,240,210,.4)'], 9000);
    for (let i = GX0; i < GX1; i += 0.9) { x.fillStyle = 'rgba(140,100,55,.35)'; x.fillRect(U(i), V(LAY.roadZ - 0.45), 0.5 * PX, 5); x.fillRect(U(i + 0.3), V(LAY.roadZ + 0.4), 0.5 * PX, 5); }
    // tiny wild flowers in the grass
    for (let i = 0; i < 1400; i++) { const fx = GX0 + rnd() * (GX1 - GX0), fz = GZ0 + rnd() * (GZ1 - GZ0);
      if (fx > -4.6 && fx < 4.6 && fz > -10.9 && fz < 6.9) continue;
      const c = ['#ffffff', '#ffe066', '#ff9ec7', '#c9a6ff'][Math.floor(rnd() * 4)]; x.fillStyle = c; for (let p = 0; p < 5; p++) { const a = p / 5 * 6.28; x.beginPath(); x.arc(U(fx) + Math.cos(a) * 3, V(fz) + Math.sin(a) * 3, 2.2, 0, 7); x.fill(); } x.fillStyle = '#ffb703'; x.beginPath(); x.arc(U(fx), V(fz), 1.6, 0, 7); x.fill(); }
  });
  const ground = add(new THREE.PlaneGeometry(GX1 - GX0, GZ1 - GZ0), std(0xffffff, { map: groundT, roughness: 0.95 }), (GX0 + GX1) / 2, 0, (GZ0 + GZ1) / 2, { shadow: false });
  ground.rotation.x = -Math.PI / 2;
  // outer grass (repeating) under everything
  const outerT = canvasTex(512, 512, (x, w, h) => grassNoise(x, w, h, '#7ccb4a', 5000), [24, 24]);
  const outer = add(new THREE.PlaneGeometry(200, 200), std(0xffffff, { map: outerT, roughness: 0.95 }), 0, -0.02, 0, { shadow: false }); outer.rotation.x = -Math.PI / 2;

  // ---------------------------------------------------------------- field plots (soil beds; game.js shows/hides them by count)
  const soilT = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#7a4a2a'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) { const y = 20 + i * 40, g = x.createLinearGradient(0, y - 16, 0, y + 16); g.addColorStop(0, '#5e3519'); g.addColorStop(0.45, '#9b6538'); g.addColorStop(0.6, '#a8713f'); g.addColorStop(1, '#5e3519'); x.fillStyle = g; x.fillRect(0, y - 16, w, 32); }
    for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(${rnd() < 0.5 ? '40,20,5' : '210,160,110'},${rnd() * 0.3})`; x.fillRect(rnd() * w, rnd() * h, 2, 2); }
  });
  const soilMat = std(0xffffff, { map: soilT, roughness: 1 });
  const rimMat = std(0x6bb544, { roughness: 0.9 });
  const plotGeo = rbox(LAY.plotSize, 0.2, LAY.plotSize, 0.07, 2);
  const rimGeo = rbox(LAY.plotSize + 0.12, 0.12, LAY.plotSize + 0.12, 0.05, 1);
  const plots = [], lockGeo = rbox(LAY.plotSize - 0.1, 0.14, LAY.plotSize - 0.1, 0.06, 1);
  const lockedMat = std(0x6cbd45, { roughness: 0.95 });
  const tuftMat = std(0xffffff, { roughness: 0.9, vertexColors: true });
  const tuftGeo = (() => { const parts = []; const cs = new THREE.Color();
    for (let i = 0; i < 9; i++) { const g = new THREE.IcosahedronGeometry(0.1 + rnd() * 0.08, 0); g.scale(1, 0.75, 1); g.translate((rnd() - 0.5) * 1.0, 0.05, (rnd() - 0.5) * 1.0); const n = g.attributes.position.count, col = new Float32Array(n * 3); cs.setHSL(0.26 + rnd() * 0.06, 0.55, 0.36 + rnd() * 0.12); for (let k = 0; k < n; k++) col.set([cs.r, cs.g, cs.b], k * 3); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); parts.push(g); }
    for (let i = 0; i < 4; i++) { const g = new THREE.SphereGeometry(0.045, 6, 4); g.translate((rnd() - 0.5) * 0.9, 0.16, (rnd() - 0.5) * 0.9); const n = g.attributes.position.count, col = new Float32Array(n * 3); cs.set(['#ffffff', '#ffe066', '#ff9ec7', '#c9a6ff'][i]); for (let k = 0; k < n; k++) col.set([cs.r, cs.g, cs.b], k * 3); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); parts.push(g.toNonIndexed()); }
    return mergeGeometries(parts.map(g => g.index ? g.toNonIndexed() : g)); })();
  for (const z of LAY.plotRows) for (const x0 of LAY.plotCols) {
    const g = new THREE.Group(); g.position.set(x0, 0, z); G.add(g);
    const soil = add(plotGeo, soilMat, 0, 0.1, 0, { parent: g, shadow: false });
    const rim = add(rimGeo, rimMat, 0, 0.05, 0, { parent: g, shadow: false });
    const lock = add(lockGeo, lockedMat, 0, 0.07, 0, { parent: g, shadow: false });
    const tuft = add(tuftGeo, tuftMat, 0, 0.12, 0, { parent: g, shadow: false });
    soil.userData.dyn = rim.userData.dyn = lock.userData.dyn = tuft.userData.dyn = true; lock.add(tuft); tuft.position.set(0, 0.05, 0);
    plots.push({ g, soil, rim, lock, pos: new THREE.Vector3(x0, 0.2, z) });
  }
  // tufts on locked plots (instanced, toggled per plot)
  // ---------------------------------------------------------------- fences: white pickets around the pens + the farm edge
  const pickets = [], rails = [];
  const fenceLine = (x0, z0, x1, z1, gap = null) => {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.round(L / 0.32)), a = Math.atan2(x1 - x0, z1 - z0);
    for (let i = 0; i <= n; i++) { const t = i / n, px = x0 + (x1 - x0) * t, pz = z0 + (z1 - z0) * t; if (gap && Math.hypot(px - gap[0], pz - gap[1]) < gap[2]) continue; pickets.push([px, pz, a]); }
    rails.push([x0, z0, x1, z1, a, L, gap]);
  };
  const pen = (P, gapSide) => {
    const { x0, x1, z0, z1 } = P;
    fenceLine(x0, z0, x1, z0, gapSide === 'n' ? [(x0 + x1) / 2, z0, 0.5] : null); fenceLine(x0, z1, x1, z1); fenceLine(x0, z0, x0, z1); fenceLine(x1, z0, x1, z1);
  };
  pen(LAY.cowPen, 'n'); pen(LAY.sheepPen, 'n'); pen(LAY.yard, 'e');
  // farm boundary along the road (both sides of the entrance)
  fenceLine(-4.6, LAY.fenceZ, -0.7, LAY.fenceZ); fenceLine(0.7, LAY.fenceZ, 4.6, LAY.fenceZ, [2.4, LAY.fenceZ, 0.01]);
  const picketGeo = (() => { const g = new THREE.BoxGeometry(0.11, 0.62, 0.05); g.translate(0, 0.31, 0); const tip = new THREE.ConeGeometry(0.078, 0.1, 4); tip.rotateY(Math.PI / 4); tip.scale(1, 1, 0.45); tip.translate(0, 0.66, 0); return mergeGeometries([g.toNonIndexed(), tip.toNonIndexed()]); })();
  const white = std(0xfffaf0, { roughness: 0.6 });
  const pk = new THREE.InstancedMesh(picketGeo, white, pickets.length); pk.castShadow = true; pk.receiveShadow = true;
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3(), _e = new THREE.Euler();
  pickets.forEach(([x, z, a], i) => { _q.setFromEuler(_e.set(0, a + Math.PI / 2, 0)); _s.set(1, 0.9 + rnd() * 0.15, 1); pk.setMatrixAt(i, _m.compose(_p.set(x, 0, z), _q, _s)); });
  G.add(pk);
  const railGeo = new THREE.BoxGeometry(1, 0.07, 0.04);
  const railList = []; for (const [x0, z0, x1, z1, a, L, gap] of rails) for (const y of [0.22, 0.46]) {
    if (gap) { const mx = gap[0], mz = gap[1], gw2 = gap[2], ux = (x1 - x0) / L, uz = (z1 - z0) / L, dm = (mx - x0) * ux + (mz - z0) * uz;
      railList.push([x0, z0, x0 + ux * (dm - gw2), z0 + uz * (dm - gw2), y]); railList.push([x0 + ux * (dm + gw2), z0 + uz * (dm + gw2), x1, z1, y]); }
    else railList.push([x0, z0, x1, z1, y]);
  }
  const rl = new THREE.InstancedMesh(railGeo, white, railList.length); rl.castShadow = true; rl.receiveShadow = true;
  railList.forEach(([x0, z0, x1, z1, y], i) => { const L = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(x1 - x0, z1 - z0); _q.setFromEuler(_e.set(0, a + Math.PI / 2, 0)); rl.setMatrixAt(i, _m.compose(_p.set((x0 + x1) / 2, y, (z0 + z1) / 2 + 0.03), _q, _s.set(L, 1, 1))); });
  G.add(rl);

  // ---------------------------------------------------------------- troughs (cow + sheep pens), feed bowl in the yard
  const wood = std(0xb8794a, { roughness: 0.7 }), waterM = std(0x6ec6ff, { roughness: 0.1, metalness: 0.1, emissive: 0x1b4f7a, emissiveIntensity: 0.15 });
  for (const P of [LAY.cowPen, LAY.sheepPen]) {
    const tx = P.x1 - 0.75, tz = P.z0 + 0.55;
    add(rbox(1.0, 0.3, 0.42, 0.06), wood, tx, 0.15, tz); add(rbox(0.86, 0.04, 0.3, 0.02), waterM, tx, 0.29, tz, { shadow: false });
  }

  // ---------------------------------------------------------------- trees around the farm + hills behind (instanced, low poly)
  const trunkGeo = new THREE.CylinderGeometry(0.09, 0.14, 1, 7); trunkGeo.translate(0, 0.5, 0);
  const crownGeo = new THREE.IcosahedronGeometry(1, 1);
  const trees = [];
  const ring = [[-6.0, -11.4, 1.25], [-5.2, -12.8, 1.0], [-6.4, -8.6, 1.15], [-6.1, -5.4, 1.0], [-6.5, -2.0, 1.2], [-6.0, 1.4, 0.95], [-6.6, 4.3, 1.1],
    [6.0, -11.2, 1.2], [5.0, -12.9, 1.05], [6.5, -8.0, 1.1], [6.0, -4.8, 0.95], [6.5, -1.4, 1.25], [6.0, 2.0, 1.0], [6.7, 4.8, 1.15],
    [-1.9, -13.2, 1.1], [1.2, -13.6, 1.25], [3.6, -12.6, 0.9], [-3.9, -13.0, 0.95],
    [-9.5, -12, 1.4], [9.5, -12.5, 1.4], [-9.2, -6.5, 1.3], [9.4, -7, 1.35], [-9.8, -1, 1.3], [9.8, -1.5, 1.3], [-9.5, 4, 1.2], [9.4, 3.5, 1.2],
    [-8.5, 8.8, 1.2], [8.6, 9.0, 1.25], [-4.5, 9.2, 1.0], [4.8, 9.4, 1.1], [0.2, 9.8, 1.2], [-12.5, 1.5, 1.4], [12.5, -3, 1.4], [-12, -9, 1.3], [12.2, 6, 1.3]];
  for (const [x, z, s] of ring) trees.push({ x: x + (rnd() - 0.5) * 0.4, z: z + (rnd() - 0.5) * 0.4, s: s * (0.9 + rnd() * 0.2) });
  const trunk = new THREE.InstancedMesh(trunkGeo, std(0x8a5a36), trees.length); trunk.castShadow = true;
  const crowns = new THREE.InstancedMesh(crownGeo, std(0xffffff, { roughness: 0.85 }), trees.length * 3); crowns.castShadow = true; crowns.receiveShadow = true;
  const cc = new THREE.Color(); let ci = 0;
  trees.forEach((t, i) => {
    trunk.setMatrixAt(i, _m.compose(_p.set(t.x, 0, t.z), _q.identity(), _s.set(t.s, t.s * 1.2, t.s)));
    for (let k = 0; k < 3; k++) {
      const ox = [0, -0.45, 0.42][k] * t.s, oy = [1.75, 1.35, 1.4][k] * t.s, oz = [0, 0.15, -0.1][k] * t.s, r = [0.82, 0.62, 0.66][k] * t.s;
      crowns.setMatrixAt(ci, _m.compose(_p.set(t.x + ox, oy, t.z + oz), _q.identity(), _s.set(r, r * 0.92, r)));
      crowns.setColorAt(ci, cc.setHSL(0.27 + rnd() * 0.06, 0.55 + rnd() * 0.15, 0.36 + rnd() * 0.1)); ci++;
    }
  });
  G.add(trunk, crowns);
  // hills
  const hillMat = std(0x8fd35a, { roughness: 1 }), hillMat2 = std(0x6fbf4a, { roughness: 1 });
  for (const [x, z, sx, sy, sz, m] of [[-14, -24, 14, 5, 7, hillMat], [6, -27, 18, 6.5, 8, hillMat2], [22, -20, 12, 4.5, 8, hillMat], [-26, -12, 10, 4, 10, hillMat2], [26, -6, 9, 3.5, 9, hillMat2], [-24, 6, 9, 3, 8, hillMat]]) {
    const h = add(new THREE.SphereGeometry(1, 24, 12), m, x, -0.3, z, { shadow: false }); h.scale.set(sx, sy, sz);
  }

  // ---------------------------------------------------------------- small dressing: stepping stones, bushes along the edge
  const bushGeo = new THREE.IcosahedronGeometry(1, 1), bushes = [];
  for (let i = 0; i < 30; i++) { const side = i % 2 ? 1 : -1; bushes.push([side * (4.85 + rnd() * 0.45), -10.2 + i * 0.52 + rnd() * 0.3, 0.26 + rnd() * 0.16]); }
  for (let i = 0; i < 10; i++) bushes.push([-5.0 + i * 0.45 + rnd() * 0.2, -11.0 - rnd() * 0.3, 0.3 + rnd() * 0.15], [0.7 + i * 0.45 + rnd() * 0.2, -11.0 - rnd() * 0.3, 0.3 + rnd() * 0.15]);
  const bush = new THREE.InstancedMesh(bushGeo, std(0xffffff, { roughness: 0.9 }), bushes.length); bush.castShadow = true; bush.receiveShadow = true;
  bushes.forEach(([x, z, r], i) => { bush.setMatrixAt(i, _m.compose(_p.set(x, r * 0.55, z), _q.identity(), _s.set(r, r * 0.8, r))); bush.setColorAt(i, cc.setHSL(0.28 + rnd() * 0.05, 0.5, 0.33 + rnd() * 0.1)); });
  G.add(bush);
  // a mailbox at the gate
  add(rbox(0.07, 0.8, 0.07, 0.02), wood, 0.95, 0.4, 5.45); add(rbox(0.28, 0.22, 0.42, 0.1), std(0x3f8fd6, { roughness: 0.4 }), 0.95, 0.86, 5.45); add(rbox(0.04, 0.16, 0.08, 0.01), std(0xff5d5d), 1.1, 0.98, 5.36);

  bake(G);
  return { G, plots };
}

// merge static code-built meshes that share a material (originals hidden, never removed)
function bake(G) {
  G.updateMatrixWorld(true);
  const groups = new Map();
  for (const m of G.children) {
    if (!m.isMesh || m.isInstancedMesh || m.userData.dyn) continue;
    const key = m.material.uuid + '|' + m.castShadow + m.receiveShadow;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const geos = list.map(m => { const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); g.applyMatrix4(m.matrixWorld); return g; });
    if (geos.some(g => !g.attributes.uv || !g.attributes.normal)) continue;
    const merged = mergeGeometries(geos, false); if (!merged) continue;
    const mesh = new THREE.Mesh(merged, list[0].material); mesh.castShadow = list[0].castShadow; mesh.receiveShadow = list[0].receiveShadow;
    G.add(mesh); for (const m of list) m.visible = false;
  }
}
