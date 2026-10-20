// Mergewood garden: the manor, lawn, patio, board tray and the 18 restoration tasks (AI 3D garden pieces + code-built
// hedges, path, pond, lanterns, paint). Everything built here; the game only calls restore()/setRestored().
import * as THREE from './kit/three.module.min.js';
import { RoundedBoxGeometry } from './kit/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from './kit/addons/utils/BufferGeometryUtils.js';

const R = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(12345);
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...o });

function canvasTex(w, h, draw, repeat = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  t.repeat.set(repeat, repeat); return t;
}
export const radialTex = (inner = 'rgba(0,0,0,.55)', outer = 'rgba(0,0,0,0)') => canvasTex(128, 128, (x, w) => {
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, inner); g.addColorStop(0.55, inner.replace(/[\d.]+\)$/, m => (parseFloat(m) * 0.6) + ')')); g.addColorStop(1, outer);
  x.fillStyle = g; x.fillRect(0, 0, w, w);
});
function noisy(geo, amt = 0.12, seed = 1) {
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const n = Math.sin(v.x * 5.1 + seed) * Math.cos(v.y * 4.3 + seed * 2) * Math.sin(v.z * 4.7 + seed * 3);
    v.multiplyScalar(1 + n * amt); p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals(); return geo;
}

export function buildWorld(scene, M, renderer) {
  const W = { tasks: [], tweens: [], anim: [], cb: null };
  // ------------------------------------------------------------ sky + light
  scene.background = canvasTex(4, 512, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#7cc4f2'); g.addColorStop(0.45, '#b9e3ff'); g.addColorStop(0.7, '#fff1da'); g.addColorStop(1, '#ffe2bf');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
  scene.background.wrapS = scene.background.wrapT = THREE.ClampToEdgeWrapping;
  scene.fog = new THREE.Fog('#e9f2ee', 34, 78);
  const hemi = new THREE.HemisphereLight('#e4f3ff', '#f0dcb8', 1.15); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff0d8', 2.5); sun.position.set(7, 15, 6); sun.target.position.set(0, 0, -8);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
  Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 16, bottom: -16, near: 1, far: 50 });
  scene.add(sun, sun.target); W.sun = sun;

  // ------------------------------------------------------------ lawn (dry → lush after "Mow the lawn")
  const lawnTex = canvasTex(512, 512, (x, w) => {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, w);
    for (let i = 0; i < 9000; i++) { const s = R() * 3 + 1; x.fillStyle = `rgba(${R() < .5 ? '40,90,20' : '255,255,220'},${R() * 0.08})`; x.fillRect(R() * w, R() * w, s, s * 3); }
  }, 10);
  const stripeTex = canvasTex(64, 512, (x, w, h) => {
    for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#a6e07a' : '#6fb44a'; x.fillRect(0, i * h / 8, w, h / 8); }
  });
  const lawnMat = std('#a9c46c', { map: lawnTex, roughness: 0.95 });
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), lawnMat); lawn.rotation.x = -Math.PI / 2; lawn.receiveShadow = true; scene.add(lawn);
  const stripes = new THREE.Mesh(new THREE.PlaneGeometry(16, 13), new THREE.MeshStandardMaterial({ color: '#ffffff', map: stripeTex, transparent: true, opacity: 0, roughness: 1, depthWrite: false }));
  stripes.rotation.x = -Math.PI / 2; stripes.rotation.z = Math.PI / 2; stripes.position.set(0, 0.012, -13); stripes.receiveShadow = true; scene.add(stripes);
  // grass tufts (instanced)
  const tuftGeo = (() => { const parts = []; for (let i = 0; i < 5; i++) { const c = new THREE.ConeGeometry(0.035, 0.32 + R() * 0.15, 3); c.translate(0, 0.16, 0); c.rotateZ((R() - 0.5) * 0.6); c.rotateY(R() * 6.3); c.translate((R() - 0.5) * 0.12, 0, (R() - 0.5) * 0.12); parts.push(c); } return mergeGeometries(parts); })();
  const tuftMat = std('#9cad52', { roughness: 0.9 });
  const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, 420); tufts.receiveShadow = true;
  { const m = new THREE.Matrix4(), q = new THREE.Quaternion(); let k = 0;
    while (k < 420) { const x = (R() - 0.5) * 30, z = 6 - R() * 34; if (Math.abs(x) < 5.6 && z > -5.6 && z < 6.5) continue; if (Math.abs(x) < 1.1 && z < -5) continue;
      const s = 0.7 + R() * 0.9; m.compose(new THREE.Vector3(x, 0, z), q.setFromEuler(new THREE.Euler(0, R() * 6, 0)), new THREE.Vector3(s, s, s)); tufts.setMatrixAt(k++, m); } }
  scene.add(tufts);

  // ------------------------------------------------------------ patio + board tray
  const patioTex = canvasTex(512, 512, (x, w) => {
    x.fillStyle = '#d9c3a2'; x.fillRect(0, 0, w, w);
    const n = 6, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const ox = (j % 2) * s / 2, px = i * s + ox + 4 + R() * 4, py = j * s + 4 + R() * 4, pw = s - 10 - R() * 6, ph = s - 10 - R() * 6;
      const c = 220 + (R() * 22 | 0); x.fillStyle = `rgb(${c},${c - 14 - (R() * 8 | 0)},${c - 40})`;
      x.beginPath(); x.roundRect ? x.roundRect(px % w, py, pw, ph, 14) : x.rect(px % w, py, pw, ph); x.fill();
      for (let k = 0; k < 30; k++) { x.fillStyle = `rgba(120,90,50,${R() * 0.06})`; x.beginPath(); x.arc((px % w) + R() * pw, py + R() * ph, R() * 6, 0, 7); x.fill(); }
    }
  }, 2.2);
  const patio = new THREE.Mesh(new RoundedBoxGeometry(11.6, 0.14, 12.2, 3, 0.07), std('#e9d3b3', { map: patioTex, roughness: 0.85 }));
  patio.position.set(0, 0.0, -0.4); patio.receiveShadow = true; scene.add(patio);
  // low planters along the patio sides
  const woodTex = canvasTex(256, 256, (x, w) => {
    x.fillStyle = '#c98c55'; x.fillRect(0, 0, w, w);
    for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? 'rgba(90,45,10,.10)' : 'rgba(255,220,170,.10)'; x.fillRect(0, i * w / 8, w, w / 8); x.fillStyle = 'rgba(70,35,10,.35)'; x.fillRect(0, i * w / 8, w, 2); }
    for (let i = 0; i < 260; i++) { x.strokeStyle = `rgba(80,40,10,${R() * 0.12})`; x.beginPath(); const y = R() * w; x.moveTo(0, y); x.bezierCurveTo(w / 3, y + R() * 6 - 3, w * 2 / 3, y + R() * 6 - 3, w, y); x.stroke(); }
  });
  const tray = new THREE.Mesh(new RoundedBoxGeometry(7.75, 0.34, 7.75, 4, 0.12), std('#ffffff', { map: woodTex, roughness: 0.6 }));
  tray.position.set(0, 0.17, 0); tray.castShadow = true; tray.receiveShadow = true; scene.add(tray);
  const rim = new THREE.Mesh(new RoundedBoxGeometry(7.95, 0.12, 7.95, 3, 0.05), std('#f6d48a', { roughness: 0.35, metalness: 0.35 }));
  rim.position.set(0, 0.07, 0); scene.add(rim);

  // flowering shrubs framing the patio (always there: the garden is neglected, not dead)
  { const spots = []; for (let z = 5.2; z > -6.2; z -= 0.95) { spots.push([-6.15, z]); spots.push([6.15, z]); } for (const x of [-5.4, -4.4, 4.4, 5.4]) spots.push([x, -6.7]);
    const bush = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), std('#ffffff', { roughness: 0.85 }), spots.length);
    const fl = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.1, 0), std('#ffffff', { roughness: 0.5 }), spots.length * 9);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(); let k = 0;
    const FC = ['#ff8fb6', '#ffffff', '#ffd45a', '#ff6f9c', '#c9a0ff', '#ffb27a'];
    spots.forEach(([x, z], i) => { const s = 0.55 + R() * 0.2; m.compose(new THREE.Vector3(x + (R() - 0.5) * 0.2, s * 0.6, z), q, new THREE.Vector3(s, s * 0.85, s)); bush.setMatrixAt(i, m); bush.setColorAt(i, col.setHSL(0.27 + R() * 0.06, 0.5, 0.33 + R() * 0.1));
      const fc = FC[(R() * FC.length) | 0]; for (let j = 0; j < 9; j++) { const a = R() * 6.3, b = R() * 1.2; m.compose(new THREE.Vector3(x + Math.cos(a) * Math.sin(b) * s, s * 0.6 + Math.cos(b) * s * 0.85, z + Math.sin(a) * Math.sin(b) * s), q, new THREE.Vector3(1, 1, 1)); fl.setMatrixAt(k, m); fl.setColorAt(k++, col.set(fc)); } });
    bush.castShadow = bush.receiveShadow = true; scene.add(bush, fl); }
  // ------------------------------------------------------------ trees (instanced canopy blobs) + distant hills
  const blobGeo = noisy(new THREE.IcosahedronGeometry(1, 2), 0.1, 3);
  const blobs = [], trunks = [];
  const tree = (x, z, s = 1, hue = 0) => {
    trunks.push([x, z, s]);
    const n = 4 + (R() * 3 | 0);
    for (let i = 0; i < n; i++) blobs.push([x + (R() - 0.5) * 1.6 * s, (2.6 + R() * 1.4) * s, z + (R() - 0.5) * 1.4 * s, (0.9 + R() * 0.6) * s, hue]);
  };
  for (const [x, z, s] of [[-11, -6, 1.3], [-12.5, -12, 1.5], [-11.5, -19, 1.6], [-14, -25, 1.8], [11, -6.5, 1.3], [12.6, -12.5, 1.5], [11.8, -19.5, 1.6], [14, -25, 1.8],
    [-8.2, 1.5, 1.05], [8.4, 1.0, 1.1], [-9.8, 6, 1.2], [9.6, 6.5, 1.2], [-4, -30, 2], [4.5, -31, 2.1], [-20, -16, 2], [20, -16, 2], [-18, -4, 1.7], [18, -3, 1.7]]) tree(x, z, s, R());
  for (let i = 0; i < 26; i++) { const x = -34 + i * 2.7 + R(), z = -38 - R() * 5; blobs.push([x, 2 + R() * 2, z, 2 + R() * 1.5, R()]); }
  const blobM = new THREE.InstancedMesh(blobGeo, std('#ffffff', { roughness: 0.85 }), blobs.length);
  const trunkM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.3, 1, 7), std('#8a5a36'), trunks.length);
  { const m = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
    blobs.forEach(([x, y, z, s, h], i) => { m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s * 0.85, s)); blobM.setMatrixAt(i, m); blobM.setColorAt(i, col.setHSL(0.25 + h * 0.08, 0.5, 0.36 + h * 0.12)); });
    trunks.forEach(([x, z, s], i) => { m.compose(new THREE.Vector3(x, 1.4 * s, z), q, new THREE.Vector3(s, 2.8 * s, s)); trunkM.setMatrixAt(i, m); }); }
  blobM.castShadow = true; blobM.receiveShadow = true; trunkM.castShadow = true; scene.add(blobM, trunkM);
  const hillMat = std('#9fcf7a', { roughness: 1 });
  for (const [x, z, sx, sy] of [[-30, -58, 34, 9], [12, -62, 40, 12], [42, -54, 26, 8], [-8, -70, 30, 14]]) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), hillMat); h.scale.set(sx, sy, 16); h.position.set(x, -1, z); scene.add(h);
  }
  // clouds
  const cloudM = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.35, fog: false }), 24);
  { const m = new THREE.Matrix4(), q = new THREE.Quaternion(); let k = 0;
    for (const [cx, cy, cz] of [[-22, 18, -60], [6, 22, -70], [30, 17, -62], [-6, 14, -80]]) for (let i = 0; i < 6; i++) { const s = 2.5 + R() * 2.5; m.compose(new THREE.Vector3(cx + (i - 2.5) * 2.6, cy + R() * 1.5, cz + R() * 2), q, new THREE.Vector3(s * 1.3, s * 0.7, s)); cloudM.setMatrixAt(k++, m); } }
  scene.add(cloudM); W.clouds = cloudM;

  // ------------------------------------------------------------ the manor
  const manor = new THREE.Group(); manor.position.set(0, 0, -23.5); scene.add(manor);
  const pm = { wall: std('#a99f90', { roughness: 0.9 }), trim: std('#d8d0c4'), roof: std('#77706c', { roughness: 0.7 }), door: std('#5e544a'), shutter: std('#77736a'),
    glass: new THREE.MeshStandardMaterial({ color: '#3b4250', roughness: 0.15, metalness: 0.2, emissive: '#ffb860', emissiveIntensity: 0 }), plank: std('#9a7550') };
  const body = new THREE.Mesh(new RoundedBoxGeometry(15, 6.2, 3.2, 3, 0.12), pm.wall); body.position.y = 3.1; body.castShadow = body.receiveShadow = true; manor.add(body);
  const wingL = new THREE.Mesh(new RoundedBoxGeometry(4.2, 7.2, 3.8, 3, 0.12), pm.wall); wingL.position.set(-8.4, 3.6, 0.3); wingL.castShadow = wingL.receiveShadow = true; manor.add(wingL);
  const wingR = wingL.clone(); wingR.position.x = 8.4; manor.add(wingR);
  const band = new THREE.Mesh(new RoundedBoxGeometry(15.2, 0.3, 3.4, 2, 0.08), pm.trim); band.position.y = 3.2; manor.add(band);
  const roofShape = new THREE.Shape(); roofShape.moveTo(-2.2, 0); roofShape.lineTo(2.2, 0); roofShape.lineTo(0, 2.6); roofShape.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: 15.6, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 2 }); roofGeo.translate(0, 0, -7.8); roofGeo.rotateY(Math.PI / 2);
  const roof = new THREE.Mesh(roofGeo, pm.roof); roof.position.y = 6.2; roof.castShadow = true; manor.add(roof);
  const wroofGeo = new THREE.ConeGeometry(3.3, 2.8, 4, 1); wroofGeo.rotateY(Math.PI / 4);
  for (const x of [-8.4, 8.4]) { const r = new THREE.Mesh(wroofGeo, pm.roof); r.position.set(x, 8.6, 0.3); r.castShadow = true; manor.add(r); }
  for (const x of [-4.5, 5]) { const ch = new THREE.Mesh(new RoundedBoxGeometry(0.9, 2.2, 0.9, 2, 0.06), std('#b07a5e')); ch.position.set(x, 8, -0.4); ch.castShadow = true; manor.add(ch); }
  // windows (instanced frames, glass, shutters, flower boxes)
  const wins = [];
  for (const y of [1.9, 4.6]) for (const x of [-5.6, -2.9, 2.9, 5.6]) wins.push([x, y]);
  for (const x of [-8.4, 8.4]) for (const y of [1.9, 4.6]) wins.push([x, y, 0.35]);
  wins.push([0, 4.6]);
  const fM = new THREE.InstancedMesh(new RoundedBoxGeometry(1.35, 1.75, 0.22, 2, 0.06), pm.trim, wins.length);
  const gM = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.05, 1.45), pm.glass, wins.length);
  const sM = new THREE.InstancedMesh(new RoundedBoxGeometry(0.42, 1.65, 0.08, 2, 0.03), pm.shutter, wins.length * 2);
  const bM = new THREE.InstancedMesh(new RoundedBoxGeometry(1.3, 0.3, 0.36, 2, 0.05), std('#b9774c'), wins.length);
  const flM = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.12, 0), std('#ffffff'), wins.length * 7);
  { const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), col = new THREE.Color(); let fi = 0;
    wins.forEach(([x, y, dz = 0], i) => {
      const z = 1.62 + dz;
      m.compose(new THREE.Vector3(x, y, z), q, one); fM.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(x, y, z + 0.115), q, one); gM.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(x - 0.92, y, z + 0.05), q, one); sM.setMatrixAt(i * 2, m);
      m.compose(new THREE.Vector3(x + 0.92, y, z + 0.05), q, one); sM.setMatrixAt(i * 2 + 1, m);
      m.compose(new THREE.Vector3(x, y - 0.98, z + 0.2), q, one); bM.setMatrixAt(i, m);
      for (let k = 0; k < 7; k++) { m.compose(new THREE.Vector3(x - 0.52 + k * 0.17, y - 0.78 + R() * 0.06, z + 0.22 + (R() - 0.5) * 0.12), q, one); flM.setMatrixAt(fi, m); flM.setColorAt(fi++, col.set(['#ff7aa8', '#ffd04a', '#ffffff', '#ff9e5e', '#c88cff'][(R() * 5) | 0])); }
    }); }
  for (const im of [fM, sM, bM]) { im.castShadow = true; manor.add(im); } manor.add(gM, flM);
  flM.visible = false;
  // door + porch + steps
  const door = new THREE.Mesh(new RoundedBoxGeometry(1.6, 2.5, 0.2, 2, 0.08), pm.door); door.position.set(0, 1.45, 1.66); manor.add(door);
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.14, 8, 20, Math.PI), pm.trim); arch.position.set(0, 2.7, 1.72); manor.add(arch);
  for (const x of [-1.3, 1.3]) { const col = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 2.9, 12), pm.trim); col.position.set(x, 1.45, 2.4); col.castShadow = true; manor.add(col); }
  const porch = new THREE.Mesh(new RoundedBoxGeometry(3.4, 0.25, 1.6, 2, 0.06), pm.roof); porch.position.set(0, 3, 2.3); porch.castShadow = true; manor.add(porch);
  for (let i = 0; i < 3; i++) { const st = new THREE.Mesh(new RoundedBoxGeometry(3.6 + i * 0.8, 0.22, 0.7, 2, 0.05), pm.trim); st.position.set(0, 0.11 + (2 - i) * 0.22, 2.2 + i * 0.6); st.receiveShadow = true; manor.add(st); }
  // boarded windows before the paint job
  const planks = new THREE.InstancedMesh(new RoundedBoxGeometry(1.6, 0.22, 0.08, 1, 0.03), pm.plank, 9);
  { const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1); let k = 0;
    for (const wi of [0, 3, 6]) { const [x, y] = wins[wi]; for (let j = 0; j < 3; j++) { q.setFromEuler(new THREE.Euler(0, 0, (j - 1) * 0.35 + 0.1)); m.compose(new THREE.Vector3(x, y - 0.5 + j * 0.5, 1.85), q, one); planks.setMatrixAt(k++, m); } } }
  manor.add(planks);
  W.manor = manor;

  // ------------------------------------------------------------ helpers for restoration pieces
  function model(id, x, z, s, ry = 0, shadow = true) {
    const d = M[id]; const g = new THREE.Group(); const mesh = new THREE.Mesh(d.geo, d.mat);
    mesh.matrixAutoUpdate = false; mesh.matrix.copy(d.mm); mesh.castShadow = shadow && CASTERS.has(id); mesh.receiveShadow = true; g.add(mesh);
    g.position.set(x, 0, z); g.rotation.y = ry; g.scale.setScalar(s); g.userData.s = s; g.visible = false; scene.add(g); return g;
  }
  // dirt patches + weeds that mark every unrestored spot
  const patchMat = new THREE.MeshStandardMaterial({ color: '#7a5434', map: radialTex('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), transparent: true, depthWrite: false, roughness: 1 });
  const patches = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), patchMat, 40); patches.count = 0; patches.receiveShadow = true; scene.add(patches);
  const weedGeo = (() => { const p = []; for (let i = 0; i < 7; i++) { const c = new THREE.ConeGeometry(0.06, 0.55 + R() * 0.4, 4); c.translate(0, 0.3, 0); c.rotateZ((R() - 0.5) * 1.1); c.rotateY(R() * 6.3); p.push(c); } const b = new THREE.IcosahedronGeometry(0.16, 0); b.translate(0, 0.1, 0); p.push(b); return mergeGeometries(p.map(g => g.toNonIndexed())); })();
  const weeds = new THREE.InstancedMesh(weedGeo, std('#6f7a2c', { flatShading: true }), 220); weeds.count = 0; scene.add(weeds);
  const weedState = [];   // {x,z,s,ry,task,k}
  const patchState = [];
  const mm = new THREE.Matrix4(), qq = new THREE.Quaternion(), vv = new THREE.Vector3(), ss = new THREE.Vector3();
  function spot(task, x, z, r = 1, nWeeds = 5) {
    patchState.push({ x, z, s: r * 2.6, task, k: 1 });
    for (let i = 0; i < nWeeds; i++) { const a = R() * 6.3, d = Math.sqrt(R()) * r; weedState.push({ x: x + Math.cos(a) * d, z: z + Math.sin(a) * d, s: 0.7 + R() * 0.7, ry: R() * 6, task, k: 1 }); }
  }
  function syncSpots() {
    patches.count = patchState.length; weeds.count = weedState.length;
    patchState.forEach((p, i) => { const s = p.s * p.k; mm.compose(vv.set(p.x, 0.02 + i * 0.0004, p.z), qq.identity(), ss.set(s, 1, s)); patches.setMatrixAt(i, mm); });
    weedState.forEach((w, i) => { const s = w.s * w.k; mm.compose(vv.set(w.x, 0, w.z), qq.setFromEuler(new THREE.Euler(0, w.ry, 0)), ss.set(s, s, s)); weeds.setMatrixAt(i, mm); });
    patches.instanceMatrix.needsUpdate = weeds.instanceMatrix.needsUpdate = true;
  }

  // path stones
  const pathStones = [];
  for (let z = -5.9; z > -21; z -= 0.72) { if (z < -10.6 && z > -13.5) continue; for (const x of [-0.42, 0.42]) pathStones.push([x + (R() - 0.5) * 0.1, z + (x > 0 ? 0.36 : 0), 0.62 + R() * 0.1, R() * 0.4]); }
  for (let a = 0; a < 18; a++) { const t = a / 18 * Math.PI * 2; pathStones.push([Math.cos(t) * 2.35, -12 + Math.sin(t) * 2.35, 0.7, t]); }
  const stoneM = new THREE.InstancedMesh(new RoundedBoxGeometry(0.78, 0.1, 0.62, 2, 0.04), std('#e6dccb', { roughness: 0.9 }), pathStones.length);
  stoneM.receiveShadow = true; stoneM.visible = false; scene.add(stoneM);
  const setStones = k => { pathStones.forEach(([x, z, s, ry], i) => { const kk = Math.max(0, Math.min(1, k * 1.4 - i / pathStones.length * 0.4)); mm.compose(vv.set(x, 0.04, z), qq.setFromEuler(new THREE.Euler(0, ry, 0)), ss.set(s * kk, 1, s * kk)); stoneM.setMatrixAt(i, mm); }); stoneM.instanceMatrix.needsUpdate = true; };
  const dirtPath = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 15.5), new THREE.MeshStandardMaterial({ color: '#9b7a52', roughness: 1, transparent: true, opacity: 0.85, depthWrite: false }));
  dirtPath.rotation.x = -Math.PI / 2; dirtPath.position.set(0, 0.015, -13.4); dirtPath.receiveShadow = true; scene.add(dirtPath);

  // hedges: shaggy blobs before, neat rounded boxes after
  const hedgeRuns = [[-7.4, -6, -21.5], [7.4, -6, -21.5]];
  const hedgeBoxes = [], shag = [];
  for (const [x, z0, z1] of hedgeRuns) {
    for (let z = z0; z > z1; z -= 2.2) { hedgeBoxes.push([x, z - 1.1]); for (let k = 0; k < 3; k++) shag.push([x + (R() - 0.5) * 0.8, 0.8 + R() * 0.6, z - R() * 2.2, 0.8 + R() * 0.5]); }
  }
  const leafTex = canvasTex(256, 256, (x, w) => { x.fillStyle = '#4f9a3c'; x.fillRect(0, 0, w, w); for (let i = 0; i < 1600; i++) { x.fillStyle = `hsla(${95 + R() * 30},${45 + R() * 20}%,${28 + R() * 30}%,.8)`; x.beginPath(); x.ellipse(R() * w, R() * w, 3 + R() * 4, 2 + R() * 2, R() * 3, 0, 7); x.fill(); } }, 1);
  const hedgeM = new THREE.InstancedMesh(new RoundedBoxGeometry(1.15, 1.35, 2.15, 2, 0.4), std('#ffffff', { map: leafTex, roughness: 0.9 }), hedgeBoxes.length);
  hedgeBoxes.forEach(([x, z], i) => { mm.compose(vv.set(x, 0.68, z), qq.identity(), ss.set(1, 1, 1)); hedgeM.setMatrixAt(i, mm); });
  hedgeM.castShadow = hedgeM.receiveShadow = true; hedgeM.visible = false; scene.add(hedgeM);
  const shagM = new THREE.InstancedMesh(blobGeo, std('#5d6e2e', { roughness: 1 }), shag.length);
  shag.forEach(([x, y, z, s], i) => { mm.compose(vv.set(x, y, z), qq.identity(), ss.set(s * 0.9, s, s * 1.2)); shagM.setMatrixAt(i, mm); });
  shagM.castShadow = true; scene.add(shagM);

  // lanterns
  const lanterns = new THREE.Group(); lanterns.visible = false; scene.add(lanterns);
  const glowMat = new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffbf55', emissiveIntensity: 2.4 });
  const poleMat = std('#3d5a4a', { roughness: 0.35, metalness: 0.5 });
  for (const [x, z] of [[-1.35, -6.4], [1.35, -6.4], [-1.35, -17.5], [1.35, -17.5]]) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 2.2, 8), poleMat); pole.position.y = 1.1; pole.castShadow = true;
    const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.42, 6), poleMat); cage.position.y = 2.35;
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.34, 6), glowMat); glass.position.y = 2.35;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.22, 6), poleMat); cap.position.y = 2.66;
    g.add(pole, cage, glass, cap); lanterns.add(g);
  }
  // pond
  const pond = new THREE.Group(); pond.position.set(-4.4, 0, -15.2); pond.visible = false; scene.add(pond);
  { const water = new THREE.Mesh(new THREE.CircleGeometry(1.9, 40), new THREE.MeshPhysicalMaterial({ color: '#5ec4d8', roughness: 0.08, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0.92 }));
    water.rotation.x = -Math.PI / 2; water.position.y = 0.06; water.receiveShadow = true; pond.add(water);
    const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.32, 1), std('#c9c2b4'), 22);
    for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2; mm.compose(vv.set(Math.cos(a) * 2.05, 0.08, Math.sin(a) * 2.05), qq.setFromEuler(new THREE.Euler(R(), R(), R())), ss.set(1 + R() * 0.4, 0.55, 1 + R() * 0.3)); rocks.setMatrixAt(i, mm); }
    rocks.castShadow = true; pond.add(rocks);
    const padGeo = new THREE.CircleGeometry(0.32, 16, 0.4, Math.PI * 2 - 0.6); padGeo.rotateX(-Math.PI / 2);
    for (const [x, z] of [[-0.6, 0.3], [0.5, -0.6], [0.8, 0.7], [-0.3, -0.9]]) {
      const p = new THREE.Mesh(padGeo, std('#5fae4a')); p.position.set(x, 0.08, z); p.rotation.y = R() * 6; pond.add(p);
      const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 1), std('#ff9ec4', { emissive: '#ff6fa0', emissiveIntensity: 0.15 })); f.position.set(x + 0.08, 0.15, z); f.scale.y = 0.6; pond.add(f);
    }
  }

  // ------------------------------------------------------------ tasks
  const pieces = {}, CASTERS = new Set(['h23', 'h24', 'h25', 'h22']);
  const T = (name, cost, thumb, x, z, setup) => { const t = { name, cost, thumb, x, z, setup, i: W.tasks.length }; W.tasks.push(t); return t; };
  T('Mow the lawn', 1, '🌿', 0, -11, null);
  T('Lay the stone path', 1, '🪨', 0, -9, null);
  T('Plant a rose bush', 2, 'h26', -2.7, -7.6, () => pieces.rose = model('h26', -2.7, -7.6, 1.8, 0.4));
  T('Set the garden bench', 2, 'h22', 3.6, -9.6, () => pieces.bench = model('h22', 3.6, -9.6, 2.1, -0.75));
  T('Lavender planter', 2, 'h28', 2.4, -7.0, () => pieces.lav = model('h28', 2.4, -7.0, 1.25, -0.2));
  T('Restore the fountain', 3, 'h23', 0, -12, () => pieces.fountain = model('h23', 0, -12, 3.0, 0));
  T('Blue hydrangeas', 3, 'h27', -3.8, -10.4, () => pieces.hyd = model('h27', -3.8, -10.4, 1.7, 0.6));
  T('Trim the hedges', 3, '🌳', -7.4, -12, null);
  T('Stone bird bath', 3, 'h34', -5.0, -8.4, () => pieces.bath = model('h34', -5.0, -8.4, 1.6, 0.5));
  T('Tulip beds', 4, 'g04', 0, -15.5, () => { pieces.tulips = []; for (const [x, z] of [[-1.35, -14.6], [1.35, -14.6], [-1.35, -16], [1.35, -16], [-1.35, -8.3], [1.35, -8.3]]) pieces.tulips.push(model('g04', x, z, 0.85, R() * 6, false)); });
  T('Wheelbarrow of blooms', 3, 'h35', 5.0, -7.4, () => pieces.barrow = model('h35', 5.0, -7.4, 1.7, -0.9));
  T('Garden lanterns', 4, '🏮', 0, -6.4, null);
  T('Lily pond', 4, '🪷', -4.4, -15.2, null);
  T('Garden swing', 5, 'h25', 4.6, -14.8, () => pieces.swing = model('h25', 4.6, -14.8, 2.9, -0.5));
  T('A second rose bush', 4, 'h26', 4.4, -18.6, () => pieces.rose2 = model('h26', 4.4, -18.6, 1.9, 1.2));
  T('Blossom bonsai pots', 4, 'g06', 2.6, -20.5, () => { pieces.bonsai = [model('g06', 2.6, -20.3, 1.15, 0.3), model('g06', -2.6, -20.3, 1.15, -0.3)]; });
  T('Paint the manor', 5, '🏡', 0, -21, null);
  T('Build the gazebo', 6, 'h24', -4.7, -19.4, () => pieces.gazebo = model('h24', -4.7, -19.4, 3.9, 0.3));
  for (const t of W.tasks) if (t.setup) t.setup();
  // spots (weeds + dirt) for every task that sits somewhere
  W.tasks.forEach(t => {
    if (t.i === 0) { for (let k = 0; k < 10; k++) spot(0, (R() - 0.5) * 14, -6.5 - R() * 14, 0.6, 3); return; }
    if (t.i === 1 || t.i === 7 || t.i === 16) return;
    if (t.i === 11) { for (const [x, z] of [[-1.35, -6.4], [1.35, -6.4], [-1.35, -17.5], [1.35, -17.5]]) spot(11, x, z, 0.35, 2); return; }
    if (t.i === 9) { spot(9, -1.4, -15.3, 0.7, 4); spot(9, 1.4, -15.3, 0.7, 4); spot(9, 0, -8.3, 0.6, 3); return; }
    if (t.i === 15) { spot(15, 2.6, -20.3, 0.5, 2); spot(15, -2.6, -20.3, 0.5, 2); return; }
    spot(t.i, t.x, t.z, t.i === 5 ? 1.6 : t.i === 17 ? 2 : t.i === 12 ? 1.9 : 0.9, t.i === 5 ? 9 : 6);
  });
  // fountain rubble
  const rubble = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.3, 0), std('#b9b2a6', { flatShading: true }), 12);
  for (let i = 0; i < 12; i++) { const a = R() * 6.3, d = R() * 1.3; mm.compose(vv.set(Math.cos(a) * d, 0.12, -12 + Math.sin(a) * d), qq.setFromEuler(new THREE.Euler(R() * 3, R() * 3, R() * 3)), ss.setScalar(0.6 + R() * 0.8)); rubble.setMatrixAt(i, mm); }
  rubble.castShadow = true; scene.add(rubble);
  syncSpots();

  // ------------------------------------------------------------ apply
  const DRY = new THREE.Color('#a9c46c');
  const paint = k => {
    pm.wall.color.set('#a99f90').lerp(new THREE.Color('#fff1dc'), k); pm.trim.color.set('#d8d0c4').lerp(new THREE.Color('#ffffff'), k);
    pm.roof.color.set('#77706c').lerp(new THREE.Color('#5f6f9e'), k); pm.door.color.set('#5e544a').lerp(new THREE.Color('#3f78cf'), k);
    pm.shutter.color.set('#77736a').lerp(new THREE.Color('#7cc39a'), k); pm.glass.emissiveIntensity = 1.3 * k; pm.glass.color.set('#3b4250').lerp(new THREE.Color('#ffe2a8'), k);
  };
  function show(obj, on) { if (!obj) return; for (const o of [].concat(obj)) { o.visible = on; o.scale.setScalar(o.userData.s || 1); } }
  function setState(i, on, k = 1) {
    switch (i) {
      case 0: lawnMat.color.copy(DRY).lerp(new THREE.Color('#86c95a'), on ? k : 0); tuftMat.color.set(on ? '#7fbf4a' : '#9cad52'); stripes.material.opacity = on ? 0.35 * k : 0; break;
      case 1: stoneM.visible = on; setStones(on ? k : 0); dirtPath.material.opacity = on ? 0.85 * (1 - k * 0.6) : 0.85; break;
      case 5: show(pieces.fountain, on); rubble.visible = !on; break;
      case 7: hedgeM.visible = on; shagM.visible = !on; break;
      case 9: show(pieces.tulips, on); break;
      case 11: lanterns.visible = on; break;
      case 12: pond.visible = on; break;
      case 15: show(pieces.bonsai, on); break;
      case 16: paint(on ? k : 0); planks.visible = !on; flM.visible = on; break;
      default: { const key = { 2: 'rose', 3: 'bench', 4: 'lav', 6: 'hyd', 8: 'bath', 10: 'barrow', 13: 'swing', 14: 'rose2', 17: 'gazebo' }[i]; show(pieces[key], on); }
    }
  }
  W.setRestored = n => {
    W.tasks.forEach((t, i) => setState(i, i < n));
    patchState.forEach(p => p.k = p.task < n ? 0 : 1); weedState.forEach(w => w.k = w.task < n ? 0 : 1); syncSpots();
  };
  /** animate task i into place; returns the world position for the celebration */
  W.restore = i => {
    const t = W.tasks[i]; setState(i, true, 0);
    const objs = { 2: pieces.rose, 3: pieces.bench, 4: pieces.lav, 5: pieces.fountain, 6: pieces.hyd, 8: pieces.bath, 9: pieces.tulips, 10: pieces.barrow, 13: pieces.swing, 14: pieces.rose2, 15: pieces.bonsai, 17: pieces.gazebo }[i];
    const t0 = performance.now();
    W.anim.push(now => {
      const a = Math.min(1, (now - t0) / 900), e = a < 1 ? 1 - Math.pow(2, -10 * a) * Math.cos(a * 9) : 1;
      if (objs) for (const o of [].concat(objs)) o.scale.setScalar((o.userData.s || 1) * Math.max(0.001, e));
      if (i === 0 || i === 1 || i === 16) setState(i, true, Math.min(1, a * 1.2));
      if (i === 11) lanterns.children.forEach((g, k) => g.scale.setScalar(Math.max(0.001, Math.min(1, e * 1.2 - k * 0.05))));
      if (i === 12) pond.scale.setScalar(Math.max(0.001, e));
      if (i === 7) hedgeM.scale.set(1, Math.max(0.001, e), 1);
      patchState.forEach(p => { if (p.task === i) p.k = 1 - Math.min(1, a * 1.5); }); weedState.forEach(w => { if (w.task === i) w.k = 1 - Math.min(1, a * 2.2); });
      syncSpots();
      return a >= 1;
    });
    return new THREE.Vector3(t.x, 1.2, t.z);
  };
  W.update = (dt, t) => {
    const now = performance.now();
    W.anim = W.anim.filter(f => !f(now));
    cloudM.position.x = Math.sin(t * 0.02) * 6;
    if (pieces.swing && pieces.swing.visible) pieces.swing.children[0].rotation.z = 0;
  };
  W.pieces = pieces; W.lanterns = lanterns;
  return W;
}
