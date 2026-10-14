// Paw Lagoon — original swap-match-3 on a tropical beach. Swap neighbours to line up 3+, make rockets / coconut bombs /
// rainbow yarn balls, clear the level goals before the moves run out. Kittens cheer you on.
import { THREE, createStage, createUI, input, loop, burst, confetti, sfx, tone, note, buzz, store, lerp, clamp, rng } from './kit/hc.js';
import { part, merge, canvasTex, puff, starShape } from './geo.js';
import { makeCat } from './cat.js';
import { flow } from './kit/flow.js';

const N = 8, HALF = (N - 1) / 2;
const cx = c => c - HALF, cz = r => r - HALF;
const S = createStage({ fov: 30, shadowSize: 7 });
const { scene, camera, sun, hemi, renderer } = S;
S.autoRender = false;
renderer.localClippingEnabled = true;
sun.position.set(-3, 16, 7); sun.intensity = 1.5; hemi.intensity = 1.25; sun.shadow.bias = -0.0008; sun.shadow.mapSize.set(1024, 1024);
const ui = createUI({ title: 'PAW<br>LAGOON', hint: 'Swipe a fruit to match 3', hand: '👆', score: false });
const save = store('pawlagoon');
const F = flow('pawlagoon');
let level = save.get('level', 1);

// ---------------------------------------------------------------- tile kinds
const KINDS = [
  { n: 'berry', c: '#ff3b5c' }, { n: 'star', c: '#ffd23a' }, { n: 'blue', c: '#3d7cff' },
  { n: 'leaf', c: '#3cc45a' }, { n: 'grape', c: '#9b4dff' }, { n: 'flower', c: '#ff7ac8' },
];
const HL = (o = {}) => part(new THREE.SphereGeometry(1, 14, 10), '#ffffff', { x: -0.13, y: 0.27, z: -0.13, sx: 0.1, sy: 0.04, sz: 0.06, ry: 0.7, ...o });
const SPH = new THREE.SphereGeometry(1, 22, 16);
function heartShape(s) {
  const h = new THREE.Shape();
  h.moveTo(0, -0.42 * s);
  h.bezierCurveTo(-0.15 * s, -0.28 * s, -0.42 * s, -0.08 * s, -0.42 * s, 0.13 * s);
  h.bezierCurveTo(-0.42 * s, 0.34 * s, -0.27 * s, 0.42 * s, -0.14 * s, 0.42 * s);
  h.bezierCurveTo(-0.05 * s, 0.42 * s, 0, 0.37 * s, 0, 0.3 * s);
  h.bezierCurveTo(0, 0.37 * s, 0.05 * s, 0.42 * s, 0.14 * s, 0.42 * s);
  h.bezierCurveTo(0.27 * s, 0.42 * s, 0.42 * s, 0.34 * s, 0.42 * s, 0.13 * s);
  h.bezierCurveTo(0.42 * s, -0.08 * s, 0.15 * s, -0.28 * s, 0, -0.42 * s);
  return h;
}
function leafShape() { const s = new THREE.Shape(); s.moveTo(0, 0.44); s.quadraticCurveTo(0.46, 0.05, 0, -0.44); s.quadraticCurveTo(-0.46, 0.05, 0, 0.44); return s; }
function kindGeo(k) {
  const p = [];
  if (k === 0) { // strawberry heart
    p.push(part(puff(heartShape(0.92), { bev: 0.15, size: 0.06 }), '#ff3b5c'));
    for (const [x, z] of [[-0.18, -0.02], [0.02, 0.06], [0.18, -0.03], [-0.08, 0.18], [0.1, 0.2], [0, -0.12]]) p.push(part(SPH, '#ffe27a', { x, y: 0.29, z, sx: 0.035, sy: 0.02, sz: 0.05 }));
    p.push(part(puff(starShape(5, 0.2, 0.08), { bev: 0.05, size: 0.03, depth: 0.02 }), '#2fae4a', { y: 0.24, z: -0.28 }));
    p.push(HL({ x: -0.2, z: -0.16 }));
  } else if (k === 1) { // star fruit
    p.push(part(puff(starShape(5, 0.43, 0.24), { bev: 0.14, size: 0.06 }), '#ffd84a'));
    p.push(part(puff(starShape(5, 0.17, 0.09), { bev: 0.03, size: 0.02, depth: 0.01 }), '#fff1a8', { y: 0.26 }));
    p.push(HL({ x: -0.06, z: -0.2, sx: 0.06 }));
  } else if (k === 2) { // blueberry
    p.push(part(SPH, '#3d7cff', { y: 0.2, sx: 0.4, sy: 0.24, sz: 0.4 }));
    p.push(part(puff(starShape(5, 0.13, 0.06), { bev: 0.04, size: 0.02, depth: 0.02 }), '#1f3fa8', { y: 0.38 }));
    p.push(HL({ x: -0.17, y: 0.38, z: -0.17, sx: 0.1, sz: 0.07 }));
  } else if (k === 3) { // leaf
    p.push(part(puff(leafShape(), { bev: 0.12, size: 0.05 }), '#3cc45a', { ry: Math.PI / 4 }));
    p.push(part(new THREE.BoxGeometry(0.05, 0.03, 0.62), '#a8f0a0', { y: 0.25, ry: Math.PI / 4 }));
    for (const s of [-1, 1]) for (const d of [-0.12, 0.08]) p.push(part(new THREE.BoxGeometry(0.03, 0.03, 0.2), '#a8f0a0', { y: 0.25, x: d * 0.7 + s * 0.06, z: -d * 0.7 + s * 0.06, ry: Math.PI / 4 + s * 0.9 }));
    p.push(HL({ x: -0.12, z: 0.0 }));
  } else if (k === 4) { // grapes
    for (const [x, z] of [[-0.2, -0.12], [0, -0.14], [0.2, -0.12], [-0.1, 0.06], [0.1, 0.06], [0, 0.24]]) {
      p.push(part(SPH, '#9b4dff', { x, y: 0.17, z, s: 0.165 }));
      p.push(part(SPH, '#e2c8ff', { x: x - 0.05, y: 0.3, z: z - 0.05, sx: 0.04, sy: 0.02, sz: 0.03 }));
    }
    p.push(part(puff(leafShape(), { bev: 0.04, size: 0.02, depth: 0.02 }), '#38b34f', { x: 0.14, y: 0.24, z: -0.32, s: 0.42, ry: -1.0 }));
  } else if (k === 5) { // hibiscus flower
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 - Math.PI / 2; p.push(part(SPH, i % 2 ? '#ff6cc0' : '#ff80cc', { x: Math.cos(a) * 0.22, y: 0.14, z: Math.sin(a) * 0.22, sx: 0.22, sy: 0.12, sz: 0.17, ry: -a })); }
    p.push(part(SPH, '#ffe066', { y: 0.24, s: 0.12 }));
    p.push(part(SPH, '#ffffff', { x: -0.04, y: 0.33, z: -0.04, s: 0.035 }));
  }
  return merge(p);
}
function rocketGeo() {
  return merge([
    part(new THREE.CapsuleGeometry(0.17, 0.42, 6, 14), '#ff4d6d', { y: 0.22, rz: Math.PI / 2 }),
    part(new THREE.CylinderGeometry(0.175, 0.175, 0.08, 16), '#ffffff', { x: -0.08, y: 0.22, rz: Math.PI / 2 }),
    part(new THREE.CylinderGeometry(0.175, 0.175, 0.08, 16), '#ffffff', { x: 0.1, y: 0.22, rz: Math.PI / 2 }),
    part(new THREE.ConeGeometry(0.15, 0.2, 14), '#ffd23f', { x: 0.42, y: 0.22, rz: -Math.PI / 2 }),
    part(new THREE.ConeGeometry(0.15, 0.2, 14), '#ffd23f', { x: -0.42, y: 0.22, rz: Math.PI / 2 }),
    part(new THREE.BoxGeometry(0.16, 0.03, 0.42), '#3d7cff', { x: -0.25, y: 0.22 }),
    part(SPH, '#ffffff', { x: 0.0, y: 0.38, z: -0.06, sx: 0.18, sy: 0.02, sz: 0.04 }),
  ]);
}
function bombGeo() {
  return merge([
    part(SPH, '#2f3a6b', { y: 0.3, s: 0.34 }),
    part(new THREE.ConeGeometry(0.13, 0.22, 10), '#2f3a6b', { x: -0.2, y: 0.42, z: -0.2, rx: -0.6, rz: 0.4 }),
    part(new THREE.ConeGeometry(0.13, 0.22, 10), '#2f3a6b', { x: 0.2, y: 0.42, z: -0.2, rx: -0.6, rz: -0.4 }),
    part(SPH, '#ffffff', { x: -0.12, y: 0.55, z: 0.08, sx: 0.07, sy: 0.05, sz: 0.08 }),
    part(SPH, '#ffffff', { x: 0.12, y: 0.55, z: 0.08, sx: 0.07, sy: 0.05, sz: 0.08 }),
    part(SPH, '#111111', { x: -0.12, y: 0.59, z: 0.1, s: 0.035 }),
    part(SPH, '#111111', { x: 0.12, y: 0.59, z: 0.1, s: 0.035 }),
    part(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8), '#c89a5a', { x: 0.1, y: 0.64, z: -0.1, rz: -0.5 }),
    part(SPH, '#ffd23f', { x: 0.17, y: 0.74, z: -0.1, s: 0.07 }),
    part(SPH, '#ff7a2f', { x: 0.17, y: 0.74, z: -0.1, s: 0.045 }),
    part(SPH, '#8ea0ff', { x: -0.14, y: 0.5, z: -0.12, sx: 0.08, sy: 0.03, sz: 0.05 }),
  ]);
}
function yarnGeo() {
  const p = [part(SPH, '#ff7ac8', { y: 0.33, s: 0.33 })];
  const cols = ['#ff3b5c', '#ffc928', '#3cc45a', '#3d7cff', '#9b4dff', '#ffffff'];
  for (let i = 0; i < 6; i++) p.push(part(new THREE.TorusGeometry(0.33, 0.035, 6, 30), cols[i], { y: 0.33, rx: i * 0.52, ry: i * 1.1, rz: i * 0.4 }));
  p.push(part(SPH, '#ffffff', { x: -0.12, y: 0.55, z: -0.1, sx: 0.08, sy: 0.04, sz: 0.06 }));
  return merge(p);
}
const clip = new THREE.Plane(new THREE.Vector3(0, 0, 1), 4.02);
const tileMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.04, clippingPlanes: [clip], clipShadows: true });
const plankTex = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#c9884a'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#d49557' : '#bf7c40'; g.fillRect(8, 8 + i * 28, w - 16, 26); g.fillStyle = 'rgba(90,50,20,.35)'; g.fillRect(8, 33 + i * 28, w - 16, 2); }
  g.strokeStyle = '#8a5428'; g.lineWidth = 9; g.strokeRect(4, 4, w - 8, h - 8);
  g.fillStyle = '#6f4220'; for (const [x, y] of [[12, 12], [w - 12, 12], [12, h - 12], [w - 12, h - 12]]) { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
});
const plank2Tex = canvasTex(128, 128, (g, w, h) => {
  g.drawImage(plankTex.image, 0, 0);
  g.fillStyle = '#8b98a8'; g.fillRect(0, 20, w, 14); g.fillRect(0, h - 34, w, 14);
  g.fillStyle = '#c8d2de'; g.fillRect(0, 22, w, 4); g.fillRect(0, h - 32, w, 4);
  g.fillStyle = '#5c6878'; for (const x of [16, 64, 112]) { g.beginPath(); g.arc(x, 27, 3, 0, 7); g.arc(x, h - 27, 3, 0, 7); g.fill(); }
});
const crateMat1 = new THREE.MeshStandardMaterial({ map: plankTex, roughness: 0.7, clippingPlanes: [clip] });
const crateMat2 = new THREE.MeshStandardMaterial({ map: plank2Tex, roughness: 0.6, clippingPlanes: [clip] });
const CAP = 110;
function inst(geo, m) { const im = new THREE.InstancedMesh(geo, m, CAP); im.castShadow = true; im.receiveShadow = false; im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.count = 0; scene.add(im); return im; }
const kindGeos = KINDS.map((_, i) => kindGeo(i));
const MESH = { k: kindGeos.map(g => inst(g, tileMat)), r: inst(rocketGeo(), tileMat), b: inst(bombGeo(), tileMat), w: inst(yarnGeo(), tileMat),
  c1: inst(new THREE.BoxGeometry(0.88, 0.62, 0.88).translate(0, 0.31, 0), crateMat1), c2: inst(new THREE.BoxGeometry(0.88, 0.62, 0.88).translate(0, 0.31, 0), crateMat2) };
const ROCKET_GEO = MESH.r.geometry;

// ---------------------------------------------------------------- world: beach, jungle, board
const world = new THREE.Group(); scene.add(world);
const sandTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#f4d79c'; g.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(200,150,80,.18)' : 'rgba(255,255,255,.25)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }, true);
sandTex.repeat.set(6, 6);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ map: sandTex, roughness: 0.95 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.45; ground.receiveShadow = true; world.add(ground);
const grassTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#5cbf4f'; g.fillRect(0, 0, w, h); for (let i = 0; i < 500; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(30,110,40,.25)' : 'rgba(170,240,120,.3)'; const x = Math.random() * w, y = Math.random() * h; g.fillRect(x, y, 2, 6); } }, true);
grassTex.repeat.set(10, 6);
const grass = new THREE.Mesh(new THREE.PlaneGeometry(80, 46), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.95 }));
grass.rotation.x = -Math.PI / 2; grass.position.set(0, -0.44, -17.6); grass.receiveShadow = true; world.add(grass);
// lagoon water at the bottom of the screen
const waterTex = canvasTex(256, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#5fe0e6'); gr.addColorStop(1, '#2bb3d6'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 4; for (let i = 0; i < 9; i++) { g.beginPath(); const y = 20 + i * 28, x = (i * 67) % 200; g.moveTo(x, y); g.quadraticCurveTo(x + 20, y - 8, x + 40, y); g.stroke(); } }, true);
waterTex.repeat.set(4, 2);
const water = new THREE.Mesh(new THREE.PlaneGeometry(80, 20), new THREE.MeshStandardMaterial({ map: waterTex, roughness: 0.15, metalness: 0.1 }));
water.rotation.x = -Math.PI / 2; water.position.set(0, -0.4, 17.5); world.add(water);
const foam = new THREE.Mesh(new THREE.PlaneGeometry(80, 0.5), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 }));
foam.rotation.x = -Math.PI / 2; foam.position.set(0, -0.39, 7.65); world.add(foam);
// wooden frame + sand cells
const frameGeo = merge([
  part(ringSlab(9.1, 8.12, 0.42, 0.45), '#8a5228', { y: -0.3 }),
  part(ringSlab(8.85, 8.12, 0.42, 0.38), '#c98a4b', { y: -0.24 }),
  part(ringSlab(8.5, 8.12, 0.42, 0.3), '#e0a663', { y: -0.2 }),
  part(rounded2(8.2, 8.2, 0.3, 0.2), '#a8692f', { y: -0.42 }),
]);
function ringSlab(wo, wi, h, r) {
  const s = rrShape(wo, wo, r); s.holes.push(rrShape(wi, wi, 0.12));
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 6 }); g.rotateX(-Math.PI / 2); return g;
}
function rrShape(w, d, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
function rounded2(w, d, h, r) { // rounded slab lying flat, top at y = h
  const s = new THREE.Shape(), x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 6 }); g.rotateX(-Math.PI / 2); return g;
}
const frameMesh = new THREE.Mesh(frameGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }));
frameMesh.receiveShadow = true; frameMesh.castShadow = true; world.add(frameMesh);
const cellParts = [];
for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) cellParts.push(part(rounded2(0.97, 0.97, 0.12, 0.12), (r + c) % 2 ? '#fcecc6' : '#f3dca8', { x: cx(c), y: -0.1, z: cz(r) }));
const cellsMesh = new THREE.Mesh(merge(cellParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
cellsMesh.receiveShadow = true; world.add(cellsMesh);
// ice under tiles
const iceTex = canvasTex(128, 128, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#d4f6ff'); gr.addColorStop(1, '#5cc6f2'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 5; g.beginPath(); g.moveTo(14, 40); g.lineTo(40, 14); g.moveTo(16, 70); g.lineTo(70, 16); g.stroke();
  g.strokeStyle = '#ffffff'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
});
const iceMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.95, 0.06, 0.95), new THREE.MeshStandardMaterial({ map: iceTex, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92 }), N * N);
iceMesh.receiveShadow = true; iceMesh.count = 0; iceMesh.frustumCulled = false; world.add(iceMesh);
// jungle bushes + palm fronds around the frame
const bushGeo = new THREE.SphereGeometry(1, 14, 10);
const bushes = new THREE.InstancedMesh(bushGeo, new THREE.MeshStandardMaterial({ roughness: 0.75 }), 90);
{
  const r = rng(77), D = new THREE.Object3D(); let i = 0; const greens = ['#3fae4a', '#4cc35a', '#2f9a44', '#62d06a', '#2a8a3e'];
  const put = (x, z, s) => { D.position.set(x, -0.3 + s * 0.2, z); D.scale.set(s, s * 0.75, s); D.updateMatrix(); bushes.setMatrixAt(i, D.matrix); bushes.setColorAt(i, new THREE.Color(greens[i % 5])); i++; };
  for (let k = 0; k < 16; k++) { put(-5.4 - r() * 0.6, -5 + k * 0.7, 0.7 + r() * 0.5); put(5.4 + r() * 0.6, -5 + k * 0.7, 0.7 + r() * 0.5); }
  for (let k = 0; k < 14; k++) put(-5 + k * 0.78, -5.6 - r() * 0.5, 0.75 + r() * 0.4);
  for (let k = 0; k < 10; k++) { const x = (k < 5 ? -1 : 1) * (4.8 + (k % 5) * 0.6) ; put(x, 5.0 + r() * 1.5, 0.5 + r() * 0.5); }
  bushes.count = i; bushes.castShadow = true; bushes.receiveShadow = true; world.add(bushes);
}
const frondGeo = merge([part(SPH, '#36a84a', { sx: 0.35, sy: 0.05, sz: 1.5 }), part(new THREE.BoxGeometry(0.06, 0.04, 2.8), '#8fdc7a', { y: 0.04 })]);
const fronds = new THREE.InstancedMesh(frondGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), 16);
{
  const D = new THREE.Object3D(); let i = 0;
  for (const [x, z, ry] of [[-5.6, -4.4, 0.6], [-5.8, -1.5, 1.2], [-5.4, 2.6, 1.9], [5.6, -4.0, -0.7], [5.8, -0.6, -1.3], [5.4, 3.4, -1.9], [-4.6, 5.8, 2.6], [4.4, 6.2, -2.4], [-1.5, -6.0, 0.1], [2.2, -6.1, -0.2]]) {
    D.position.set(x, 0.25, z); D.rotation.set(0.15, ry, 0); D.updateMatrix(); fronds.setMatrixAt(i++, D.matrix);
  }
  fronds.count = i; fronds.castShadow = true; world.add(fronds);
}
const flowerGeo = merge([...[0, 1, 2, 3, 4].map(i => { const a = i / 5 * Math.PI * 2; return part(SPH, '#ff5fa8', { x: Math.cos(a) * 0.2, z: Math.sin(a) * 0.2, sx: 0.2, sy: 0.06, sz: 0.13, ry: -a }); }), part(SPH, '#ffe066', { y: 0.05, s: 0.08 })]);
const flowers = new THREE.InstancedMesh(flowerGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }), 10);
{ const D = new THREE.Object3D(); let i = 0; for (const [x, z] of [[-5.2, -3.2], [5.3, 1.4], [-5.0, 4.6], [4.7, -5.3], [-3.6, -5.6], [5.1, 5.4], [0.6, -5.7]]) { D.position.set(x, 0.55, z); D.rotation.y = i; D.scale.setScalar(1.3); D.updateMatrix(); flowers.setMatrixAt(i++, D.matrix); } flowers.count = i; world.add(flowers); }

// FX meshes: selection ring, flying rockets, beams, shock rings
const selRing = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.05, 8, 30), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 }));
selRing.rotation.x = -Math.PI / 2; selRing.visible = false; scene.add(selRing);
const flyRockets = []; for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(ROCKET_GEO, tileMat); m.visible = false; m.scale.setScalar(1.25); scene.add(m); flyRockets.push({ m, on: false }); }
const beamMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.06, 0.08), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95 }), 64);
beamMesh.count = 0; beamMesh.frustumCulled = false; scene.add(beamMesh);
let beams = [];
const rings = []; for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 32), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); rings.push({ m, t: 1, s: 1 }); }
let ringI = 0;
function shock(x, z, s = 1, color = '#ffffff') { const r = rings[ringI++ % rings.length]; r.t = 0; r.s = s; r.m.material.color.set(color); r.m.position.set(x, 0.5, z); r.m.visible = true; }

// ---------------------------------------------------------------- overlay scene: kittens (ortho, CSS px units)
const ov = new THREE.Scene(), ovP = new THREE.Scene(), ocam = new THREE.OrthographicCamera(0, 1, 0, -1, -2000, 2000);
for (const sc of [ov, ovP]) { sc.add(new THREE.HemisphereLight(0xffffff, 0xffe0c8, 1.3)); const d = new THREE.DirectionalLight(0xffffff, 1.6); d.position.set(-200, 400, 600); sc.add(d); }
const portraitBg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: canvasTex(64, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#7fdcff'); gr.addColorStop(0.65, '#c9f3ff'); gr.addColorStop(0.66, '#9ee07a'); gr.addColorStop(1, '#5cc45a'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }) }));
portraitBg.position.z = -900; ovP.add(portraitBg);
const hero = makeCat({ fur: '#f6a24a', stripe: '#e2792a', hat: 'straw' });
const pal1 = makeCat({ fur: '#c9ced8', stripe: '#8e96a6', belly: '#ffffff', iris: '#2a5a3a', eyeRing: '#3f8a5a', hat: 'bow', bowColor: '#3d7cff', collar: '#3d7cff', tailTip: '#8e96a6' });
const pal2 = makeCat({ fur: '#4a4048', stripe: '#2f282e', belly: '#fff3e8', iris: '#6b4b10', eyeRing: '#d8a52a', hat: 'leaf', inner: '#ff9ab8', tailTip: '#fff3e8' });
ovP.add(hero); ov.add(pal1, pal2);
pal1.rotation.y = 0.45; pal2.rotation.y = -0.45;
for (const k of [hero, pal1, pal2]) k.rotation.x = 0.12;

// ---------------------------------------------------------------- HUD
const css = document.createElement('style'); css.textContent = `
.pl-hud{position:fixed;top:calc(54px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);width:min(380px,96vw);height:118px;z-index:6;pointer-events:none}
.pl-panel{position:absolute;top:8px;width:31%;height:100px;border-radius:16px;background:linear-gradient(180deg,#f3c98a,#d9a05c);border:4px solid #8a5228;box-shadow:inset 0 3px 0 rgba(255,255,255,.45),0 5px 0 rgba(70,35,10,.35);color:#6b3a16;text-align:center}
.pl-panel b{display:block;margin:-2px auto 0;width:74%;font-size:15px;line-height:22px;border-radius:0 0 10px 10px;background:#f7dfb0;color:#8a5228;box-shadow:0 2px 0 rgba(70,35,10,.2)}
.pl-goal{left:0}.pl-moves{right:0}
.pl-moves .n{font-size:50px;line-height:66px;font-weight:800;color:#3fb54a;-webkit-text-stroke:2px #1d6b2a;text-shadow:0 3px 0 #1d6b2a}
.pl-moves .n.low{color:#ff5a5a;-webkit-text-stroke-color:#9b1d1d;text-shadow:0 3px 0 #9b1d1d}
.pl-goals{display:flex;justify-content:center;align-items:center;gap:2px;height:72px}
.pl-g{position:relative;width:48px;height:48px}.pl-g img{width:100%;height:100%}
.pl-g span{position:absolute;right:-6px;bottom:-8px;font-weight:800;font-size:19px;color:#fff;-webkit-text-stroke:4px #6b3a16;paint-order:stroke fill}
.pl-g.done span{color:#4ee05a}
.pl-frame{position:absolute;left:50%;top:0;width:34%;height:112px;transform:translateX(-50%);border-radius:20px;border:7px solid #9a5e2c;box-shadow:inset 0 0 0 3px #e9b06a,0 5px 0 rgba(70,35,10,.35)}
.pl-score{position:absolute;left:50%;top:104px;transform:translateX(-50%);background:#6b3a16;border:3px solid #e9b06a;border-radius:14px;padding:0 12px;font-weight:800;font-size:17px;line-height:22px;color:#ffe9a8;white-space:nowrap}
.hc-pop{-webkit-text-stroke:7px #8a3a12;paint-order:stroke fill;letter-spacing:.5px}
.hc-card h1{color:#fff;-webkit-text-stroke:8px #b4521c;paint-order:stroke fill;text-shadow:0 6px 0 rgba(90,40,10,.35)!important}
.hc-card p,.hc-card .hint{-webkit-text-stroke:5px #b4521c;paint-order:stroke fill}
.hc-card:first-of-type{}
.pl-map{display:flex;flex-direction:column-reverse;align-items:center;gap:6px;margin-top:8px}
.pl-node{width:46px;height:46px;border-radius:50%;background:#fff;color:#b4521c;font-weight:800;font-size:20px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 0 #b4521c;-webkit-text-stroke:0;position:relative}
.pl-node.done{background:#ffd23f}.pl-node.cur{width:66px;height:66px;font-size:28px;background:#ff5d8f;color:#fff;box-shadow:0 5px 0 #a8264f,0 0 0 6px rgba(255,255,255,.55)}
.pl-node:nth-child(odd){transform:translateX(-34px)}.pl-node:nth-child(even){transform:translateX(34px)}
.pl-node small{position:absolute;bottom:-14px;font-size:13px;color:#ffd23f;-webkit-text-stroke:3px #8a5228;paint-order:stroke fill;white-space:nowrap}
.pl-stars{display:flex;gap:8px;margin:6px 0}.pl-stars i{font-style:normal;font-size:58px;color:rgba(0,0,0,.18);transform:scale(0);animation:plstar .5s cubic-bezier(.3,1.8,.5,1) forwards}
.pl-stars i.on{color:#ffd23f;-webkit-text-stroke:4px #b4521c;paint-order:stroke fill}
@keyframes plstar{to{transform:scale(1)}}
.pl-fly{position:fixed;width:40px;height:40px;z-index:7;pointer-events:none;transition:transform .55s cubic-bezier(.5,-0.4,.7,1),opacity .55s;margin:-20px 0 0 -20px}
`; document.head.appendChild(css);
const hud = document.createElement('div'); hud.className = 'pl-hud';
hud.innerHTML = `<div class="pl-panel pl-goal"><b>Goal</b><div class="pl-goals"></div></div><div class="pl-frame"></div><div class="pl-score">★ 0</div><div class="pl-panel pl-moves"><b>Moves</b><div class="n">20</div></div>`;
document.body.appendChild(hud);
const goalsEl = hud.querySelector('.pl-goals'), movesEl = hud.querySelector('.pl-moves .n'), scoreEl = hud.querySelector('.pl-score'), frameEl = hud.querySelector('.pl-frame');
ui.els.start.style.background = 'radial-gradient(circle at 50% 45%,rgba(20,70,90,.15),rgba(20,60,80,.45))';
const mapEl = document.createElement('div'); mapEl.className = 'pl-map'; ui.els.start.insertBefore(mapEl, ui.els.start.querySelector('.hint'));
ui.els.win.style.background = ui.els.lose.style.background = 'radial-gradient(circle at 50% 40%,rgba(20,70,90,.25),rgba(20,50,70,.6))';
const starsEl = document.createElement('div'); starsEl.className = 'pl-stars'; ui.els.win.insertBefore(starsEl, ui.els.win.querySelector('[data-x]'));
document.body.style.setProperty('--bg1', '#7fdcff'); document.body.style.setProperty('--bg2', '#f4d79c'); document.body.style.setProperty('--ui', '#ff7a2f');

// goal icons rendered from the real 3D tiles
const ICON = {};
{
  const r2 = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); r2.setSize(96, 96); r2.outputColorSpace = THREE.SRGBColorSpace;
  const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0xffe8f0, 1.3)); const dl = new THREE.DirectionalLight(0xffffff, 1.7); dl.position.set(-2, 6, 4); sc.add(dl);
  const cam = new THREE.OrthographicCamera(-0.55, 0.55, 0.55, -0.55, 0.1, 20); cam.position.set(0, 5, 2.2); cam.lookAt(0, 0.15, 0);
  const plain = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.04 });
  const shot = (mesh, key) => { sc.add(mesh); r2.render(sc, cam); ICON[key] = r2.domElement.toDataURL(); sc.remove(mesh); };
  kindGeos.forEach((g, i) => shot(new THREE.Mesh(g, plain), i));
  shot(new THREE.Mesh(MESH.c1.geometry, new THREE.MeshStandardMaterial({ map: plankTex })), 'crate');
  shot(new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.1, 0.95), new THREE.MeshStandardMaterial({ map: iceTex })), 'ice');
  r2.dispose(); r2.forceContextLoss();
}

// ---------------------------------------------------------------- level state
let state = 'ready', grid = [], ice = [], tiles = [], goals = [], moves = 0, movesStart = 0, score = 0, colors = 5, busy = false, sel = null, combo = 0;
let shake = 0, hintT = 0, hintMove = null, idT = 1, levelR = rng(1), lastLand = 0;
function newTile(kind, r, c, sp = null) {
  const t = { id: idT++, kind, sp, hp: 0, r, c, x: cx(c), z: cz(r), y: 0, vz: 0, falling: false, app: 1, squash: 0, dieAt: -1, dk: 0, dead: false, wob: 0, mergeTo: null, rot: sp === 'rv' ? Math.PI / 2 : 0 };
  tiles.push(t); return t;
}
const at = (r, c) => (r >= 0 && c >= 0 && r < N && c < N) ? grid[r][c] : null;
const matchable = t => t && !t.sp && t.dieAt < 0;
function randKind() { return Math.floor(levelR() * colors); }

function levelDef(L) {
  const r = rng(L * 9173 + 5);
  const cols = L <= 3 ? 5 : 6;
  const type = L === 1 ? 'col' : L === 2 ? 'crate' : L === 3 ? 'ice' : ['mix', 'crate', 'col2', 'ice'][(L - 4) % 4];
  const d = { cols, goals: [], crates: [], ice: [], moves: 0 };
  const k1 = Math.floor(r() * cols), k2 = (k1 + 1 + Math.floor(r() * (cols - 1))) % cols;
  const hard = Math.min(1, (L - 1) / 14);
  const crateRows = (rows, hp2) => { for (let rr = N - rows; rr < N; rr++) for (let c = 0; c < N; c++) { const edge = (c === 0 || c === N - 1) && rr === N - rows; if (!edge || r() < 0.5) d.crates.push({ r: rr, c, hp: hp2 && rr === N - 1 ? 2 : 1 }); } };
  const icePat = (n) => { const pats = [(r0, c) => Math.abs(r0 - 3.5) + Math.abs(c - 3.5) <= 3, (r0, c) => r0 >= 2 && r0 <= 5, (r0, c) => (c <= 1 || c >= 6), (r0, c) => (r0 + c) % 2 === 0 && r0 >= 1 && r0 <= 6];
    const f = pats[Math.floor(r() * pats.length)]; for (let rr = 0; rr < N; rr++) for (let c = 0; c < N; c++) if (f(rr, c) && d.ice.length < n) d.ice.push({ r: rr, c }); };
  if (type === 'col') { d.goals.push({ t: 'col', k: k1, n: 12 }); d.moves = 16; }
  else if (type === 'crate') { crateRows(L === 2 ? 1 : 2, L > 6); d.goals.push({ t: 'crate', n: d.crates.length }); d.moves = L === 2 ? 18 : 22 + Math.floor(hard * 4); }
  else if (type === 'ice') { icePat(L === 3 ? 14 : 18 + Math.floor(hard * 10)); d.goals.push({ t: 'ice', n: d.ice.length }); d.moves = L === 3 ? 18 : 20; }
  else if (type === 'col2') { d.goals.push({ t: 'col', k: k1, n: 14 + Math.floor(hard * 12) }, { t: 'col', k: k2, n: 14 + Math.floor(hard * 12) }); d.moves = 20; }
  else { crateRows(1, false); d.goals.push({ t: 'col', k: k1, n: 12 + Math.floor(hard * 10) }, { t: 'crate', n: d.crates.length }); d.moves = 20; }
  const fk = F.k(); d.moves = Math.max(8, Math.round(d.moves / fk)); for (const g of d.goals) if (g.t === 'col') g.n = Math.round(g.n * fk);
  return d;
}
function hasMatchAt(r, c) {
  const t = at(r, c); if (!matchable(t)) return false; const k = t.kind;
  let h = 1; for (let i = c - 1; matchable(at(r, i)) && at(r, i).kind === k; i--) h++; for (let i = c + 1; matchable(at(r, i)) && at(r, i).kind === k; i++) h++;
  let v = 1; for (let i = r - 1; matchable(at(i, c)) && at(i, c).kind === k; i--) v++; for (let i = r + 1; matchable(at(i, c)) && at(i, c).kind === k; i++) v++;
  return h >= 3 || v >= 3;
}
function genLevel() {
  const d = levelDef(level); levelR = rng(level * 31337 + 7); colors = d.cols;
  tiles = []; grid = Array.from({ length: N }, () => Array(N).fill(null)); ice = Array.from({ length: N }, () => Array(N).fill(0));
  for (const cr of d.crates) { const t = newTile(-1, cr.r, cr.c, 'crate'); t.hp = cr.hp; grid[cr.r][cr.c] = t; }
  for (const ic of d.ice) ice[ic.r][ic.c] = 1;
  for (let tries = 0; tries < 50; tries++) {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { if (grid[r][c] && grid[r][c].sp === 'crate') continue; if (grid[r][c]) { tiles.splice(tiles.indexOf(grid[r][c]), 1); grid[r][c] = null; } }
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if (grid[r][c]) continue;
      let k, g = 0; do { k = randKind(); grid[r][c] = { kind: k, sp: null, dieAt: -1 }; g++; } while (hasMatchAt(r, c) && g < 30);
      grid[r][c] = newTile(k, r, c);
    }
    if (findMove()) break;
  }
  // drop-in intro: tiles fall from above, column-staggered
  for (const t of tiles) { t.z = cz(t.r) - N - 1 - t.c * 0.35 - (N - t.r) * 0.08; t.falling = true; t.vz = 0; }
  goals = d.goals.map(g => ({ ...g, have: 0 })); moves = movesStart = d.moves; score = 0; combo = 0; busy = false; sel = null; hintT = 0;
  renderGoals(); renderMoves(); scoreEl.textContent = '★ 0'; ui.levels(level); ui.progress(0);
  hero.reset(); pal1.reset(); pal2.reset();
}
function renderGoals() {
  goalsEl.innerHTML = goals.map((g, i) => `<div class="pl-g ${g.have >= g.n ? 'done' : ''}" data-g="${i}"><img src="${g.t === 'col' ? ICON[g.k] : ICON[g.t]}"><span>${g.have >= g.n ? '✔' : g.n - g.have}</span></div>`).join('');
  if (goals.length > 1) goalsEl.querySelectorAll('.pl-g').forEach(e => { e.style.width = e.style.height = '42px'; });
  const tot = goals.reduce((a, g) => a + g.n, 0), got = goals.reduce((a, g) => a + Math.min(g.n, g.have), 0);
  ui.progress(got / tot);
}
function renderMoves() { movesEl.textContent = Math.max(0, moves); movesEl.classList.toggle('low', moves <= 3); }
function renderMap() {
  const best = save.get('stars', {});
  let h = ''; for (let L = Math.max(1, level - 2); L <= Math.max(1, level - 2) + 4; L++) {
    const st = best[L] || 0;
    h += `<div class="pl-node ${L === level ? 'cur' : L < level ? 'done' : ''}">${L === level ? '🐾' : L}${L < level ? `<small>${'★'.repeat(st)}</small>` : ''}</div>`;
  }
  mapEl.innerHTML = h + `<p style="margin-bottom:6px">Level ${level}</p>`;
}

// ---------------------------------------------------------------- matching
function findGroups() {
  const runs = [], owner = new Map();
  for (let r = 0; r < N; r++) for (let c = 0; c < N;) {
    const t = grid[r][c]; if (!matchable(t)) { c++; continue; }
    let e = c + 1; while (e < N && matchable(grid[r][e]) && grid[r][e].kind === t.kind) e++;
    if (e - c >= 3) runs.push({ dir: 'h', cells: Array.from({ length: e - c }, (_, i) => r * N + c + i) }); c = e;
  }
  for (let c = 0; c < N; c++) for (let r = 0; r < N;) {
    const t = grid[r][c]; if (!matchable(t)) { r++; continue; }
    let e = r + 1; while (e < N && matchable(grid[e][c]) && grid[e][c].kind === t.kind) e++;
    if (e - r >= 3) runs.push({ dir: 'v', cells: Array.from({ length: e - r }, (_, i) => (r + i) * N + c) }); r = e;
  }
  const par = runs.map((_, i) => i), find = i => par[i] === i ? i : (par[i] = find(par[i]));
  runs.forEach((ru, i) => ru.cells.forEach(k => { if (owner.has(k)) par[find(i)] = find(owner.get(k)); else owner.set(k, i); }));
  const gm = new Map();
  runs.forEach((ru, i) => { const root = find(i); if (!gm.has(root)) gm.set(root, { cells: new Set(), runs: [] }); const g = gm.get(root); ru.cells.forEach(k => g.cells.add(k)); g.runs.push(ru); });
  return [...gm.values()].map(g => {
    const maxRun = Math.max(...g.runs.map(r => r.cells.length)), hasH = g.runs.some(r => r.dir === 'h'), hasV = g.runs.some(r => r.dir === 'v');
    let cross = null; if (hasH && hasV) { const hs = new Set(g.runs.filter(r => r.dir === 'h').flatMap(r => r.cells)); cross = g.runs.filter(r => r.dir === 'v').flatMap(r => r.cells).find(k => hs.has(k)); }
    const long = g.runs.find(r => r.cells.length === maxRun);
    return { cells: g.cells, maxRun, hasH, hasV, cross, dir: long.dir, mid: long.cells[Math.floor(long.cells.length / 2)], kind: grid[Math.floor(long.cells[0] / N)][long.cells[0] % N].kind };
  });
}
function swapGrid(a, b) { const ar = a.r, ac = a.c; grid[b.r][b.c] = a; grid[ar][ac] = b; a.r = b.r; a.c = b.c; b.r = ar; b.c = ac; }
function evalSwap(a, b) { // heuristic score of swapping two tiles (no side effects)
  if (!a || !b || a.sp === 'crate' || b.sp === 'crate') return -1;
  if (a.sp || b.sp) { const v = { rh: 30, rv: 30, b: 40, w: 60 }; return (v[a.sp] || 0) + (v[b.sp] || 0) + (a.sp && b.sp ? 40 : 0); }
  if (a.kind === b.kind) return -1;
  swapGrid(a, b); const gs = findGroups(); swapGrid(a, b);
  if (!gs.length) return -1;
  let s = 0;
  for (const g of gs) {
    s += g.cells.size; if (g.maxRun >= 5) s += 30; else if (g.hasH && g.hasV) s += 16; else if (g.maxRun === 4) s += 11;
    for (const k of g.cells) {
      const r = Math.floor(k / N), c = k % N;
      for (const go of goals) {
        if (go.have >= go.n) continue;
        if (go.t === 'col' && g.kind === go.k) s += 3;
        if (go.t === 'ice' && ice[r][c]) s += 4;
        if (go.t === 'crate') for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = at(r + dr, c + dc); if (n && n.sp === 'crate') s += 4; }
      }
      s += r * 0.08;
    }
  }
  return s;
}
function findMove(best = false) {
  let bm = null, bs = 0;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const a = grid[r][c]; if (!a) continue;
    if (a.sp && a.sp !== 'crate') { const s = { rh: 22, rv: 22, b: 30, w: 34 }[a.sp]; if (s > bs) { bs = s; bm = { a, b: null }; } if (!best) return bm; }
    for (const [dr, dc] of [[0, 1], [1, 0]]) {
      const b = at(r + dr, c + dc), s = evalSwap(a, b);
      if (s > 0 && !best) return { a, b };
      if (s > bs + (best ? Math.random() * 0.5 : 0)) { bs = s; bm = { a, b }; }
    }
  }
  return bm;
}

// ---------------------------------------------------------------- blasts (plans)
const sleep = ms => new Promise(res => setTimeout(res, ms));
function newPlan() { return { hits: new Map(), maxD: 0, fired: new Set(), color: new Map() }; }
function hitCell(P, r, c, d) {
  if (r < 0 || c < 0 || r >= N || c >= N) return;
  const k = r * N + c, prev = P.hits.get(k);
  if (prev !== undefined && prev <= d) return;
  P.hits.set(k, d); P.maxD = Math.max(P.maxD, d);
  const t = grid[r][c];
  if (t && t.sp && t.sp !== 'crate' && !P.fired.has(t.id)) { P.fired.add(t.id); fire(P, t, r, c, d + 70); }
}
function mostColor(exclude = -1) { const cnt = Array(colors).fill(0); for (const row of grid) for (const t of row) if (matchable(t) && t.kind !== exclude) cnt[t.kind]++; let b = 0; cnt.forEach((v, i) => { if (v > cnt[b]) b = i; }); return b; }
function fire(P, t, r, c, d, opt = {}) {
  const sp = opt.as || t.sp;
  if (sp === 'rh' || sp === 'rv' || sp === 'x') {
    const dirs = sp === 'rh' ? [[0, 1], [0, -1]] : sp === 'rv' ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1], [1, 0], [-1, 0]];
    for (const off of (opt.wide ? [-1, 0, 1] : [0])) for (const [dr, dc] of dirs) {
      const rr0 = r + (dc ? off : 0), cc0 = c + (dr ? off : 0);
      setTimeout(() => launchRocket(rr0, cc0, dr, dc), d);
      for (let i = 0; i < N; i++) hitCell(P, rr0 + dr * i, cc0 + dc * i, d + i * 28);
    }
  } else if (sp === 'b') {
    const R = opt.R || 2;
    setTimeout(() => boomFx(r, c, R), d);
    for (let dr = -R; dr <= R; dr++) for (let dc = -R; dc <= R; dc++) if (Math.abs(dr) + Math.abs(dc) <= R + (R > 2 ? 2 : 1)) hitCell(P, r + dr, c + dc, d + (Math.abs(dr) + Math.abs(dc)) * 35);
  } else if (sp === 'w') {
    const k = opt.kind ?? mostColor(), targets = [];
    for (let rr = 0; rr < N; rr++) for (let cc = 0; cc < N; cc++) { const o = grid[rr][cc]; if (matchable(o) && o.kind === k) targets.push([rr, cc]); }
    setTimeout(() => beamFx(r, c, targets, KINDS[k].c), d);
    targets.forEach(([rr, cc], i) => hitCell(P, rr, cc, d + 260 + i * 25));
    hitCell(P, r, c, d + 200);
  }
}
async function execPlan(P, matchCells = new Set(), creates = []) {
  const now = performance.now(), crateHit = new Set();
  let popped = 0;
  const damageCrate = (t, d) => {
    if (crateHit.has(t.id) || t.dieAt >= 0) return; crateHit.add(t.id); t.hp--;
    if (t.hp <= 0) { grid[t.r][t.c] = null; t.dieAt = now + d; t.crate = true; }
    else setTimeout(() => { t.wob = 1; burst(scene, new THREE.Vector3(t.x, 0.6, t.z), ['#c9884a', '#8a5428'], 6, { speed: 0.07, up: 0.08, size: 0.5 }); tone(200, 0.06, 'square', 0.06); }, d);
  };
  for (const [k, d] of P.hits) {
    const r = Math.floor(k / N), c = k % N, t = grid[r][c];
    if (t && t.sp === 'crate') { damageCrate(t, d); continue; }
    if (ice[r][c]) { ice[r][c] = 0; setTimeout(() => { burst(scene, new THREE.Vector3(cx(c), 0.2, cz(r)), ['#e8fbff', '#9fe0ff', '#ffffff'], 7, { speed: 0.08, up: 0.1, size: 0.45 }); tone(1400, 0.05, 'triangle', 0.05, 0.7); addGoal('ice', -1, cx(c), cz(r)); }, d); }
    if (!t || t.dieAt >= 0) continue;
    grid[r][c] = null; t.dieAt = now + d; popped++;
    if (!t.sp) { const kk = t.kind; setTimeout(() => addGoal('col', kk, t.x, t.z), d + 60); }
  }
  for (const k of matchCells) { const r = Math.floor(k / N), c = k % N; for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = at(r + dr, c + dc); if (n && n.sp === 'crate') damageCrate(n, P.hits.get(k) || 0); } }
  score += popped * 10 * Math.max(1, combo); scoreEl.textContent = '★ ' + score;
  for (const cr of creates) setTimeout(() => {
    const t = newTile(-1, cr.r, cr.c, cr.sp); t.app = 0; grid[cr.r][cr.c] = t;
    burst(scene, new THREE.Vector3(t.x, 0.5, t.z), ['#ffffff', '#ffd23f'], 12, { speed: 0.1, up: 0.12, size: 0.4, shape: 'sphere' });
    shock(t.x, t.z, 0.9, '#ffd23f'); tone(880, 0.12, 'triangle', 0.1, 1.5);
  }, 120);
  await sleep(Math.max(P.maxD, creates.length ? 140 : 0) + 115);
}
function addGoal(type, kind, x, z) {
  const i = goals.findIndex(g => g.t === type && (type !== 'col' || g.k === kind) && g.have < g.n);
  if (i < 0) return;
  const g = goals[i]; g.have++;
  // fly a little icon from the board into the goal panel
  const el = goalsEl.querySelector(`[data-g="${i}"]`);
  if (el && document.querySelectorAll('.pl-fly').length < 14) {
    const p = new THREE.Vector3(x, 0.3, z).project(camera), sx = (p.x + 1) / 2 * innerWidth, sy = (1 - p.y) / 2 * innerHeight, b = el.getBoundingClientRect();
    const f = document.createElement('img'); f.className = 'pl-fly'; f.src = type === 'col' ? ICON[kind] : ICON[type]; f.style.left = sx + 'px'; f.style.top = sy + 'px'; document.body.appendChild(f);
    requestAnimationFrame(() => { f.style.transform = `translate(${b.left + b.width / 2 - sx}px,${b.top + b.height / 2 - sy}px) scale(.8)`; });
    setTimeout(() => { f.remove(); renderGoals(); el.animate && goalsEl.querySelector(`[data-g="${i}"]`)?.animate([{ transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 180 }); }, 560);
  } else renderGoals();
}

// ---------------------------------------------------------------- FX
function launchRocket(r, c, dr, dc) {
  const fr = flyRockets.find(f => !f.on); if (!fr) return;
  fr.on = true; fr.x = cx(c); fr.z = cz(r); fr.dx = dc; fr.dz = dr; fr.m.visible = true; fr.m.rotation.y = dr ? (dr > 0 ? -Math.PI / 2 : Math.PI / 2) : (dc > 0 ? 0 : Math.PI);
  tone(300, 0.3, 'sawtooth', 0.05, 3); shake = Math.max(shake, 0.25);
}
function boomFx(r, c, R) {
  const p = new THREE.Vector3(cx(c), 0.5, cz(r));
  burst(scene, p, ['#ffd23f', '#ff7a2f', '#ffffff', '#ff4d6d'], 26 + R * 6, { speed: 0.2, up: 0.14, size: 0.7, shape: 'sphere' });
  shock(p.x, p.z, R * 1.4, '#ffd23f'); shock(p.x, p.z, R * 0.9, '#ffffff'); sfx.smash(); buzz(30); shake = Math.max(shake, 0.6 + R * 0.1); ui.flash(0.25);
}
function beamFx(r, c, targets, col) {
  const x0 = cx(c), z0 = cz(r);
  for (const [rr, cc] of targets) beams.push({ x0, z0, x1: cx(cc), z1: cz(rr), t: 0, col });
  [72, 76, 79, 84, 88].forEach((m, i) => setTimeout(() => note(m, 0.25, 0.12), i * 50));
  burst(scene, new THREE.Vector3(x0, 0.6, z0), ['#ff3b5c', '#ffc928', '#3cc45a', '#3d7cff', '#9b4dff'], 22, { speed: 0.12, up: 0.15, size: 0.5, shape: 'sphere' });
  shake = Math.max(shake, 0.4);
}
const WORDS = ['', '', 'Sweet!', 'Purr-fect!', 'Paw-some!', 'Meow-velous!', 'Fur-tastic!'];
function comboFx(n) {
  if (n >= 2) {
    ui.pop(WORDS[Math.min(n, WORDS.length - 1)], ['#fff', '#ffe066', '#7dffb0', '#ff9be0', '#8fe3ff'][n % 5], 34 + Math.min(n, 6) * 4, 46);
    hero.cheer(Math.min(1, n / 4)); if (n >= 3) { pal1.cheer(0.6); pal2.cheer(0.6); }
  }
}

// ---------------------------------------------------------------- turn flow
async function cascade(swapped = []) {
  combo = 0;
  for (let guard = 0; guard < 40; guard++) {
    const groups = findGroups();
    if (!groups.length) break;
    combo++;
    const P = newPlan(), matchCells = new Set(), creates = [];
    for (const g of groups) {
      let sp = null; if (g.maxRun >= 5) sp = 'w'; else if (g.hasH && g.hasV) sp = 'b'; else if (g.maxRun === 4) sp = g.dir === 'h' ? 'rh' : 'rv';
      let target = null;
      if (sp) {
        const sw = swapped.find(t => g.cells.has(t.r * N + t.c));
        target = sw ? sw.r * N + sw.c : sp === 'b' ? g.cross : g.mid;
        creates.push({ r: Math.floor(target / N), c: target % N, sp });
      }
      for (const k of g.cells) {
        matchCells.add(k); const t = grid[Math.floor(k / N)][k % N];
        if (sp && t) t.mergeTo = { x: cx(target % N), z: cz(Math.floor(target / N)) };
        hitCell(P, Math.floor(k / N), k % N, 0);
      }
    }
    const pitch = 67 + Math.min(combo, 8) * 2; note(pitch, 0.22, 0.14); setTimeout(() => note(pitch + 7, 0.2, 0.1), 60);
    buzz(12); comboFx(combo);
    await execPlan(P, matchCells, creates);
    await gravity();
    swapped = [];
  }
}
async function gravity() {
  for (let c = 0; c < N; c++) {
    let w = N - 1;
    for (let r = N - 1; r >= 0; r--) { const t = grid[r][c]; if (t) { if (r !== w) { grid[w][c] = t; grid[r][c] = null; t.r = w; t.falling = true; } w--; } }
    for (let r = w, k = 0; r >= 0; r--, k++) { const t = newTile(randKind(), r, c); grid[r][c] = t; t.z = cz(-1) - k - 0.6; t.falling = true; t.vz = 0.05; }
  }
  const t0 = performance.now();
  while (tiles.some(t => t.falling) && performance.now() - t0 < 2000) await sleep(20);
  await sleep(20);
}
async function activate(a, b) { // a special at a.r,a.c swapped with b (maybe null = tap)
  const P = newPlan(), r = a.r, c = a.c;
  if (b && b.sp && b.sp !== 'crate') {
    const sps = [a.sp, b.sp].sort().join('+');
    P.fired.add(a.id); P.fired.add(b.id); a.mergeTo = { x: b.x, z: b.z };
    hitCell(P, a.r, a.c, 0); hitCell(P, b.r, b.c, 0);
    const R = b.r, C = b.c;
    ui.pop(sps === 'w+w' ? 'MEGA PURR!' : 'COMBO!', '#ffe066', 46, 44); hero.cheer(1); pal1.cheer(1); pal2.cheer(1); buzz([20, 30, 20]);
    if (sps === 'w+w') { for (let rr = 0; rr < N; rr++) for (let cc = 0; cc < N; cc++) hitCell(P, rr, cc, 150 + (Math.abs(rr - R) + Math.abs(cc - C)) * 40); boomFx(R, C, 3); }
    else if (sps.includes('w')) {
      const other = a.sp === 'w' ? b.sp : a.sp, k = mostColor();
      const conv = []; for (const row of grid) for (const t of row) if (matchable(t) && t.kind === k) conv.push(t);
      conv.forEach((t, i) => setTimeout(() => { t.sp = other === 'b' ? 'b' : (i % 2 ? 'rh' : 'rv'); t.rot = t.sp === 'rv' ? Math.PI / 2 : 0; t.app = 0.3; tone(700 + i * 30, 0.05, 'triangle', 0.06); }, i * 40));
      beamFx(R, C, conv.map(t => [t.r, t.c]), KINDS[k].c);
      await sleep(conv.length * 40 + 250);
      conv.forEach((t, i) => { if (!P.fired.has(t.id)) { P.fired.add(t.id); hitCell(P, t.r, t.c, i * 60); fire(P, t, t.r, t.c, i * 60 + 40); } });
    }
    else if (sps === 'b+b') fire(P, b, R, C, 0, { as: 'b', R: 3 });
    else if (sps.includes('b')) fire(P, b, R, C, 0, { as: 'x', wide: true });
    else fire(P, b, R, C, 0, { as: 'x' });
  } else if (a.sp === 'w') {
    P.fired.add(a.id); hitCell(P, r, c, 0);
    fire(P, a, r, c, 0, { kind: b ? b.kind : mostColor() });
  } else hitCell(P, r, c, 0);
  combo = 1;
  await execPlan(P);
  await gravity();
}
async function trySwap(a, b) {
  if (busy || state !== 'play' || !a || !b || a.dieAt >= 0 || b.dieAt >= 0) return;
  if (a.sp === 'crate' || b.sp === 'crate') { a.wob = 1; tone(180, 0.07, 'square', 0.05); return; }
  busy = true; sel = null; hintT = 0; hintMove = null;
  swapGrid(a, b); tone(620, 0.05, 'sine', 0.1, 1.3);
  await sleep(130);
  if (a.sp || b.sp) {
    moves--; renderMoves();
    if (a.sp && b.sp) await activate(a, b);
    else if (a.sp) await activate(a, b); else await activate(b, a);
    await cascade();
  } else {
    if (!findGroups().length) {
      swapGrid(a, b); tone(240, 0.12, 'square', 0.06, 0.7); buzz(15); await sleep(160); a.wob = b.wob = 1; busy = false; return;
    }
    moves--; renderMoves();
    await cascade([a, b]);
  }
  await afterTurn();
}
async function tapSpecial(t) {
  if (busy || state !== 'play' || !t.sp || t.sp === 'crate') return;
  busy = true; sel = null; hintT = 0; moves--; renderMoves();
  await activate(t, null); await cascade(); await afterTurn();
}
async function afterTurn() {
  renderGoals();
  if (goals.every(g => g.have >= g.n)) { await winSeq(); return; }
  if (moves <= 0) { lose(); return; }
  if (!findMove()) await shuffle();
  busy = false;
}
async function shuffle() {
  ui.pop('Shuffle!', '#fff', 38, 46);
  for (let tries = 0; tries < 60; tries++) {
    const ts = tiles.filter(t => matchable(t) && t.dieAt < 0), ks = ts.map(t => t.kind);
    for (let i = ks.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ks[i], ks[j]] = [ks[j], ks[i]]; }
    ts.forEach((t, i) => t.kind = ks[i]);
    if (!findGroups().length && findMove()) break;
  }
  tiles.forEach(t => { if (!t.sp) t.app = 0.2; });
  await sleep(400);
}
async function winSeq() {
  busy = true; const left = moves;
  sfx.win(); ui.pop('GOAL REACHED!', '#ffe066', 40, 44); hero.party(true); pal1.party(true); pal2.party(true); buzz([20, 40, 20]);
  await sleep(500);
  // leftover moves turn into rockets — paw party!
  const n = Math.min(left, 8), picks = tiles.filter(t => matchable(t) && t.dieAt < 0).sort(() => Math.random() - 0.5).slice(0, n);
  for (const t of picks) { t.sp = Math.random() < 0.5 ? 'rh' : 'rv'; t.rot = t.sp === 'rv' ? Math.PI / 2 : 0; t.app = 0; moves--; renderMoves(); score += 50; tone(800 + Math.random() * 400, 0.06, 'triangle', 0.08); await sleep(70); }
  if (picks.length) { const P = newPlan(); picks.forEach((t, i) => hitCell(P, t.r, t.c, i * 90)); combo = 2; await execPlan(P); await gravity(); await cascade(); }
  moves = 0; renderMoves(); scoreEl.textContent = '★ ' + score;
  const ratio = left / movesStart, stars = ratio >= 0.3 ? 3 : ratio >= 0.12 ? 2 : 1;
  const best = save.get('stars', {}); best[level] = Math.max(best[level] || 0, stars); save.set('stars', best);
  save.set('level', level + 1); save.set('best', Math.max(save.get('best', 0), score));
  starsEl.innerHTML = [0, 1, 2].map(i => `<i class="${i < stars ? 'on' : ''}" style="animation-delay:${0.15 + i * 0.2}s">★</i>`).join('');
  state = 'won'; F.level(true); ui.flash(0.5);
  for (let i = 0; i < 3; i++) setTimeout(() => confetti(scene, new THREE.Vector3((i - 1) * 2.5, 3, 0), 60), i * 160);
  ui.win(level, `Score ${score}`);
}
function lose() {
  state = 'lost'; F.level(false, goals.reduce((a, g) => a + Math.min(1, g.have / g.n), 0) / goals.length); sfx.fail(); buzz([40, 30, 60]); hero.sad(); pal1.sad(); pal2.sad(); shake = 0.5;
  const left = goals.filter(g => g.have < g.n).map(g => `${g.n - g.have} ${g.t === 'col' ? KINDS[g.k].n + (g.n - g.have > 1 ? 's' : '') : g.t === 'crate' ? 'crates' : 'ice'}`).join(' + ');
  ui.lose('OUT OF MOVES', `Just ${left} to go!`);
}

// ---------------------------------------------------------------- input
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.25), hit = new THREE.Vector3();
function cellAt(e) {
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  if (!ray.ray.intersectPlane(plane, hit)) return null;
  const c = Math.round(hit.x + HALF), r = Math.round(hit.z + HALF); return (r >= 0 && c >= 0 && r < N && c < N) ? { r, c } : null;
}
let down = null;
input({
  onDown: e => { if (state !== 'play' || busy) return; down = cellAt(e); if (down) down.x = e.clientX, down.y = e.clientY; },
  onMove: (dx, dy, e) => {
    if (!down || busy) return; const mx = e.clientX - down.x, my = e.clientY - down.y; if (Math.hypot(mx, my) < 18) return;
    const dir = Math.abs(mx) > Math.abs(my) ? [0, Math.sign(mx)] : [Math.sign(my), 0];
    const a = at(down.r, down.c), b = at(down.r + dir[0], down.c + dir[1]); down = null; if (a && b) trySwap(a, b);
  },
  onTap: e => {
    if (state !== 'play' || busy) return; const p = cellAt(e); down = null; if (!p) { sel = null; return; }
    const t = at(p.r, p.c); if (!t) return;
    if (sel && sel !== t && Math.abs(sel.r - t.r) + Math.abs(sel.c - t.c) === 1) { const s = sel; sel = null; trySwap(s, t); return; }
    if (t.sp && t.sp !== 'crate') { tapSpecial(t); return; }
    sel = sel === t ? null : t; if (sel) tone(700, 0.04, 'sine', 0.08);
  },
});
ui.onTap(w => { if (w === 'win') level++; genLevel(); state = 'play'; });

// ---------------------------------------------------------------- layout + camera
let frameRect = null, camD = 30, boardPx = 380, boardCy = 400, TILT = 0.2;
function layout() {
  const W = innerWidth, H = innerHeight, top = 190 + (H > 800 ? 4 : 0), bottom = Math.min(250, H * 0.27);
  boardPx = Math.min(W * 0.985, H - top - bottom); boardCy = top + (H - top - bottom) / 2 + (W * 0.985 < H - top - bottom ? -6 : 0);
  camera.fov = 30; camera.aspect = W / H;
  const d = 9.1 * H / (2 * Math.tan(camera.fov / 2 * Math.PI / 180) * boardPx);
  camD = d; camera.position.set(0, d * Math.cos(TILT), d * Math.sin(TILT)); camera.lookAt(0, 0, 0);
  camera.setViewOffset(W, H, 0, -(boardCy - H / 2), W, H); camera.updateProjectionMatrix();
  ocam.left = 0; ocam.right = W; ocam.top = 0; ocam.bottom = -H; ocam.updateProjectionMatrix();
  // kittens: hero inside the wooden frame, two pals lounging on the beach below the board
  const fr = frameEl.getBoundingClientRect();
  portraitBg.position.set(fr.left + fr.width / 2, -(fr.top + fr.height / 2), -900); portraitBg.scale.set(fr.width - 4, fr.height - 4, 1);
  const hs = fr.height * 0.44; hero.position.set(fr.left + fr.width / 2, -(fr.top + fr.height * 0.52 + hs * 1.35), 0); hero.scale.setScalar(hs); frameRect = fr;
  const wy = new THREE.Vector3(0, -0.4, 7.7).project(camera), waterY = (1 - wy.y) / 2 * H;
  const ks = Math.min(60, bottom * 0.26), by = clamp(waterY + 4, boardCy + boardPx / 2 + ks * 2.4, H - 10);
  pal1.position.set(W / 2 - Math.min(W * 0.3, 150), -by, 0); pal2.position.set(W / 2 + Math.min(W * 0.3, 150), -by, 0);
  pal1.scale.setScalar(ks); pal2.scale.setScalar(ks);
}
addEventListener('resize', layout); layout(); setTimeout(layout, 300);

// ---------------------------------------------------------------- loop
const D = new THREE.Object3D(), V = new THREE.Vector3(), CP = new THREE.Vector3();
const easeBack = k => 1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2);
loop((dt, T) => {
  const sec = dt / 60, now = performance.now();
  // tiles
  const cnt = new Map(); const use = m => { const i = cnt.get(m) || 0; cnt.set(m, i + 1); return i; };
  for (const m of [...MESH.k, MESH.r, MESH.b, MESH.w, MESH.c1, MESH.c2]) cnt.set(m, 0);
  let landed = 0;
  for (const t of tiles) {
    if (t.dead) continue;
    const tx = cx(t.c), tz = cz(t.r);
    if (t.falling) {
      t.vz = Math.min(0.75, t.vz + 0.042 * dt); t.z += t.vz * dt; t.x = tx;
      if (t.z >= tz) { t.z = tz; t.falling = false; t.squash = Math.min(1, 0.4 + t.vz * 2); t.vz = 0; landed++; }
    } else if (t.dieAt < 0 || now < t.dieAt) { t.x = lerp(t.x, tx, Math.min(1, 0.32 * dt)); t.z = lerp(t.z, tz, Math.min(1, 0.32 * dt)); }
    let s = 1, y = 0, sx = 1, sy = 1, ry = t.rot;
    if (t.app < 1) { t.app = Math.min(1, t.app + sec * 4); s *= Math.max(0, easeBack(t.app)); }
    if (t.dieAt >= 0 && now >= t.dieAt) {
      if (t.dk === 0) {
        const col = t.crate ? ['#c9884a', '#8a5428', '#f3c98a'] : t.sp ? ['#ffffff', '#ffd23f'] : [KINDS[t.kind].c, '#ffffff'];
        if (!t.mergeTo) { burst(scene, V.set(t.x, 0.35, t.z), col, t.crate ? 10 : 6, { speed: 0.075, up: 0.1, size: t.crate ? 0.6 : 0.42, shape: t.crate ? 'box' : 'sphere', gravity: 0.01 }); shock(t.x, t.z, 0.55, t.sp ? '#ffd23f' : '#ffffff'); }
        if (t.crate) { addGoal('crate', -1, t.x, t.z); tone(160, 0.1, 'square', 0.08, 0.6); }
      }
      t.dk += sec * (t.mergeTo ? 8 : 9);
      if (t.mergeTo) { t.x = lerp(t.x, t.mergeTo.x, 0.35); t.z = lerp(t.z, t.mergeTo.z, 0.35); s *= 1 - t.dk * 0.6; }
      else s *= t.dk < 0.3 ? 1 + t.dk * 1.1 : 1.33 * Math.max(0, 1 - (t.dk - 0.3) / 0.7);
      y += t.dk * 0.3;
      if (t.dk >= 1) { t.dead = true; continue; }
    }
    if (t.squash > 0) { t.squash = Math.max(0, t.squash - sec * 5); const q = Math.sin(t.squash * Math.PI) * t.squash; sx = 1 + q * 0.22; sy = 1 - q * 0.35; }
    if (t === sel) { y += 0.12 + Math.sin(T * 9) * 0.06; s *= 1.08; }
    if (t.wob > 0) { t.wob = Math.max(0, t.wob - sec * 3); ry += Math.sin(t.wob * 25) * 0.25 * t.wob; }
    if (hintMove && (t === hintMove.a || t === hintMove.b)) { ry += Math.sin(T * 12) * 0.2; s *= 1 + Math.sin(T * 6) * 0.06; }
    if (t.sp === 'w') ry += T * 1.5; if (t.sp === 'b') sy *= 1 + Math.sin(T * 8) * 0.04;
    const m = t.sp === 'crate' ? (t.hp >= 2 ? MESH.c2 : MESH.c1) : t.sp === 'rh' || t.sp === 'rv' ? MESH.r : t.sp ? MESH[t.sp] : MESH.k[t.kind];
    D.position.set(t.x, y, t.z); D.rotation.set(0, ry, 0); D.scale.set(s * sx, s * sy, s * sx); D.updateMatrix();
    const i = use(m); if (i < CAP) m.setMatrixAt(i, D.matrix);
  }
  if (landed && now - lastLand > 70) { lastLand = now; tone(300 + Math.random() * 60, 0.04, 'sine', 0.05, 0.8); }
  for (const [m, n] of cnt) { m.count = Math.min(n, CAP); m.instanceMatrix.needsUpdate = true; }
  if (tiles.length > 140) tiles = tiles.filter(t => !t.dead);
  // ice
  let ic = 0; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (ice[r][c]) { D.position.set(cx(c), -0.0, cz(r)); D.rotation.set(0, 0, 0); D.scale.setScalar(1); D.updateMatrix(); iceMesh.setMatrixAt(ic++, D.matrix); }
  iceMesh.count = ic; iceMesh.instanceMatrix.needsUpdate = true;
  // selection ring
  selRing.visible = !!sel; if (sel) { selRing.position.set(sel.x, 0.04, sel.z); selRing.scale.setScalar(1 + Math.sin(T * 8) * 0.05); }
  // flying rockets
  for (const f of flyRockets) if (f.on) {
    f.x += f.dx * dt * 0.6; f.z += f.dz * dt * 0.6; f.m.position.set(f.x, 0.55, f.z);
    if (Math.random() < 0.7) burst(scene, V.set(f.x - f.dx * 0.4, 0.5, f.z - f.dz * 0.4), ['#ffffff', '#ffd23f', '#ff9a3c'], 1, { speed: 0.02, up: 0.02, size: 0.5, shape: 'sphere', gravity: 0 });
    if (Math.abs(f.x) > 6.5 || Math.abs(f.z) > 6.5) { f.on = false; f.m.visible = false; }
  }
  // rainbow beams
  let bi = 0; beams = beams.filter(b => (b.t += sec * 2.2) < 1);
  for (const b of beams) { const len = Math.hypot(b.x1 - b.x0, b.z1 - b.z0), k = Math.min(1, b.t * 3); D.position.set(b.x0 + (b.x1 - b.x0) * k / 2, 0.7, b.z0 + (b.z1 - b.z0) * k / 2); D.rotation.set(0, -Math.atan2(b.z1 - b.z0, b.x1 - b.x0), 0); D.scale.set(len * k + 0.01, 1 + (1 - b.t) * 2, 1 + (1 - b.t) * 2); D.updateMatrix(); beamMesh.setMatrixAt(bi, D.matrix); beamMesh.setColorAt(bi, new THREE.Color(b.col).lerp(new THREE.Color('#ffffff'), 0.5)); bi++; if (bi >= 64) break; }
  beamMesh.count = bi; beamMesh.instanceMatrix.needsUpdate = true; if (beamMesh.instanceColor) beamMesh.instanceColor.needsUpdate = true;
  // shock rings
  for (const r of rings) if (r.m.visible) { r.t += sec * 3; r.m.scale.setScalar(r.s * (0.3 + r.t * 0.9)); r.m.material.opacity = Math.max(0, 0.8 * (1 - r.t)); if (r.t >= 1) r.m.visible = false; }
  // hint after idle
  if (state === 'play' && !busy) { hintT += sec; if (hintT > 5 && !hintMove) hintMove = findMove(true); } else hintMove = null;
  // camera shake
  shake = Math.max(0, shake - sec * 2.2);
  CP.set(0, camD * Math.cos(TILT), camD * Math.sin(TILT));
  if (shake > 0) CP.x += (Math.random() - 0.5) * shake * 0.35, CP.z += (Math.random() - 0.5) * shake * 0.35;
  camera.position.copy(CP);
  water.material.map.offset.x = T * 0.01; water.material.map.offset.y = Math.sin(T * 0.7) * 0.03;
  hero.update(dt, T); pal1.update(dt, T); pal2.update(dt, T);
  // render main + overlay
  renderer.autoClear = true; renderer.render(scene, camera);
  renderer.autoClear = false; renderer.clearDepth(); renderer.render(ov, ocam);
  if (frameRect) { const f = frameRect; renderer.setScissorTest(true); renderer.setScissor(f.left + 3, innerHeight - f.bottom + 3, f.width - 6, f.height - 6); renderer.clearDepth(); renderer.render(ovP, ocam); renderer.setScissorTest(false); }
  renderer.autoClear = true;
});

// ---------------------------------------------------------------- boot + test hooks
genLevel(); renderMap(); ui.start();
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state === 'ready') return;
    if (state !== 'play' || busy) return;
    const m = findMove(true); if (!m) return;
    if (!m.b) tapSpecial(m.a); else trySwap(m.a, m.b);
  },
};
