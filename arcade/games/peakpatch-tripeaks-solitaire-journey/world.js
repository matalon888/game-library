// Peakpatch world: a warm sky, a glittering sea, drifting clouds and the 12 AI-modelled diorama islands strung along a
// stepping-stone path. The same world is the journey map (camera high above the path) and every level's backdrop
// (camera close on the island you are sailing to).
import { THREE } from './kit/hc.js';
import { GLTFLoader } from './kit/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from './kit/addons/utils/BufferGeometryUtils.js';

export const ISLAND_NAMES = ['Beacon Bluff', 'Blossom Rise', 'Rue Petite', 'Azure Cliff', 'Canal Bella', 'Pine Hollow',
  'Palm Lagoon', 'Lantern Souk', 'Rosegate', 'Mirage Oasis', 'Toadstool Glen', 'Tulip Polder'];
export const ISLAND_SKY = [   // sky top, sky bottom, sea for each island backdrop
  ['#8fd3ff', '#fff1d6', '#43c6db'], ['#ffc4dc', '#fff3e6', '#5ccfe0'], ['#a9c8ff', '#ffe9d2', '#4fb9d8'], ['#7fd0ff', '#f2fbff', '#2fb2e0'],
  ['#ffc59e', '#fff0d8', '#48b8c8'], ['#b9d6ff', '#f6f3ff', '#5aa9d6'], ['#6fe0ff', '#fffbe0', '#2fd3cf'], ['#ffc08a', '#ffefd0', '#3fb4c4'],
  ['#a8dcff', '#fffbe8', '#4cc2d8'], ['#ffd59a', '#fff6e2', '#38c0c8'], ['#ffb98e', '#fff0dc', '#4ab0c0'], ['#9fd6ff', '#fff4f0', '#47c3da']];
const FLOAT = new Set([0, 1]);       // the floating islands (lighthouse, blossom) hover and bob
export const SIZE = 7.2, GAP = 15;

export function islandPos(i) { return new THREE.Vector3((i % 2 ? 1 : -1) * 3.7, 0, -i * GAP); }

const loader = new GLTFLoader();
function toFloat(g) {
  for (const k of Object.keys(g.attributes)) {
    const a = g.attributes[k]; if (a.array instanceof Float32Array && !a.isInterleavedBufferAttribute && !a.normalized) continue;
    const n = a.itemSize, out = new Float32Array(a.count * n);
    for (let i = 0; i < a.count; i++) { out[i * n] = a.getX(i); if (n > 1) out[i * n + 1] = a.getY(i); if (n > 2) out[i * n + 2] = a.getZ(i); if (n > 3) out[i * n + 3] = a.getW(i); }
    g.setAttribute(k, new THREE.BufferAttribute(out, n));
  }
  return g;
}

export function createWorld(scene) {
  const W = { islands: [], group: new THREE.Group(), t: 0 };
  scene.add(W.group);

  // ---------------------------------------------------------------- sky
  const skyC = document.createElement('canvas'); skyC.width = 4; skyC.height = 256;
  const skyT = new THREE.CanvasTexture(skyC); skyT.colorSpace = THREE.SRGBColorSpace; scene.background = skyT;
  scene.fog = new THREE.Fog('#fff1d6', 40, 120);
  let skyKey = '';
  W.paintSky = (top, bot) => {
    const k = top + bot; if (k === skyKey) return; skyKey = k;
    const x = skyC.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, top); g.addColorStop(0.62, bot); g.addColorStop(1, bot);
    x.fillStyle = g; x.fillRect(0, 0, 4, 256); skyT.needsUpdate = true; scene.fog.color.set(bot);
  };
  W.paintSky(...ISLAND_SKY[0]);

  // ---------------------------------------------------------------- sea (scrolling procedural ripples)
  const nC = document.createElement('canvas'); nC.width = nC.height = 256; {
    const x = nC.getContext('2d'), img = x.createImageData(256, 256), h = (u, v) => Math.sin(u * 0.049 + Math.sin(v * 0.07) * 1.3) * 0.5 + Math.sin(v * 0.098 + u * 0.024) * 0.35 + Math.sin((u + v) * 0.147) * 0.15;
    for (let y = 0; y < 256; y++) for (let X = 0; X < 256; X++) {
      const dx = h(X + 1, y) - h(X - 1, y), dy = h(X, y + 1) - h(X, y - 1), i = (y * 256 + X) * 4;
      img.data[i] = 128 + dx * 160; img.data[i + 1] = 128 + dy * 160; img.data[i + 2] = 255; img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
  }
  const nT = new THREE.CanvasTexture(nC); nT.wrapS = nT.wrapT = THREE.RepeatWrapping; nT.repeat.set(26, 60);
  const seaMat = new THREE.MeshStandardMaterial({ color: '#43c6db', roughness: 0.16, metalness: 0.05, normalMap: nT, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.1 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(260, 600), seaMat); sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.05, -150); sea.receiveShadow = true; W.group.add(sea);
  W.sea = sea; W.seaMat = seaMat;

  // foam halo texture
  const fC = document.createElement('canvas'); fC.width = fC.height = 128; {
    const x = fC.getContext('2d'), g = x.createRadialGradient(64, 64, 30, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.55, 'rgba(255,255,255,.0)'); g.addColorStop(0.72, 'rgba(255,255,255,.55)'); g.addColorStop(0.82, 'rgba(210,250,255,.25)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  }
  const foamMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(fC), transparent: true, depthWrite: false, toneMapped: false, opacity: 0.85 });
  const shoal = new THREE.MeshBasicMaterial({ color: '#7ff0ea', transparent: true, opacity: 0.35, depthWrite: false });

  // ---------------------------------------------------------------- clouds (one instanced mesh)
  const parts = [];
  for (const [x, y, z, r] of [[0, 0, 0, 1], [0.9, -0.15, 0.1, 0.75], [-0.95, -0.2, 0, 0.7], [0.4, 0.45, -0.1, 0.65], [-0.45, 0.3, 0.2, 0.6], [1.6, -0.35, 0, 0.45], [-1.65, -0.35, 0.1, 0.42]]) {
    const g = new THREE.IcosahedronGeometry(r, 2); g.translate(x, y, z); parts.push(g);
  }
  const cloudGeo = mergeGeometries(parts); cloudGeo.scale(1, 0.72, 0.8);
  const NC = 26, clouds = new THREE.InstancedMesh(cloudGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#fff4ea', emissiveIntensity: 0.35, flatShading: false }), NC);
  const cl = []; for (let i = 0; i < NC; i++) { const side = i % 2 ? 1 : -1; cl.push({ x: side * (9 + Math.random() * 14), y: 10 + Math.random() * 6, z: 12 - i * 7.5 - Math.random() * 4, s: 1.4 + Math.random() * 1.8, v: 0.15 + Math.random() * 0.25 }); }
  W.group.add(clouds); W.clouds = clouds;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();

  // ---------------------------------------------------------------- the journey path (stepping stones)
  const pts = [new THREE.Vector3(0.4, 0, 12)];
  for (let i = 0; i < 12; i++) { const p = islandPos(i); pts.push(new THREE.Vector3(-Math.sign(p.x) * 1.4, 0, p.z - 4)); }
  pts.push(new THREE.Vector3(0, 0, -11 * GAP - 9));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal'); W.curve = curve;
  // arc length at each control point, so the six level nodes before every island are evenly spaced
  const DIV = 3000, lens = curve.getLengths(DIV), Ltot = lens[DIV], at = i => lens[Math.round(i / (pts.length - 1) * DIV)];
  W.nodePos = n => { n = Math.min(n, 72); const i = Math.floor((n - 1) / 6), j = (n - 1) % 6, a = at(i), b = at(i + 1);
    return curve.getPointAt(Math.min(1, (a + (b - a) * (j + 0.6) / 6) / Ltot)).setY(0.1); };
  const stoneGeo = new THREE.CylinderGeometry(0.42, 0.5, 0.22, 18); stoneGeo.translate(0, 0.05, 0);
  const NS = 300, stones = new THREE.InstancedMesh(stoneGeo, new THREE.MeshStandardMaterial({ color: '#fff3dc', roughness: 0.6 }), NS);
  stones.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(NS * 3), 3);
  const L = curve.getLength(); let si = 0; const cA = new THREE.Color('#fff3dc'), cB = new THREE.Color('#f3dcb8');
  for (let d = 0.6; d < L && si < NS; d += 0.95, si++) { const p = curve.getPointAt(d / L); m4.compose(p.setY(0), q.identity(), sc.set(1, 1, 1).multiplyScalar(0.8 + (si % 3) * 0.06)); stones.setMatrixAt(si, m4); stones.setColorAt(si, si % 2 ? cA : cB); }
  stones.count = si; stones.receiveShadow = true; W.group.add(stones);
  W.stones = stones;

  // ---------------------------------------------------------------- islands
  for (let i = 0; i < 12; i++) {
    const g = new THREE.Group(); g.position.copy(islandPos(i)); W.group.add(g);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(SIZE * 1.55, SIZE * 1.55), foamMat); halo.rotation.x = -Math.PI / 2; halo.position.y = 0.03; halo.renderOrder = 1; g.add(halo);
    const sh = new THREE.Mesh(new THREE.CircleGeometry(SIZE * 0.62, 40), shoal); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.01; g.add(sh);
    const puff = new THREE.Group(); g.add(puff);     // fog of the unvisited: a few cloud puffs over the island
    const pm = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#eef3ff', emissiveIntensity: 0.4, transparent: true, opacity: 0.95 });
    for (let k = 0; k < 7; k++) { const c = new THREE.Mesh(cloudGeo, pm); const a = k / 6 * Math.PI * 2, r = k === 6 ? 0 : 2.3; c.position.set(Math.cos(a) * r, 0, Math.sin(a) * r * 0.8); c.userData.y = (k % 2) * 0.7 + (k === 6 ? 1.2 : 0); c.scale.setScalar(k === 6 ? 2.6 : 1.9 + (k % 3) * 0.35); puff.add(c); }
    W.islands.push({ i, g, mesh: null, sat: 1, satT: 1, fog: 1, fogT: 1, puff, pm, loading: null, h: 1, float: FLOAT.has(i), radius: SIZE * 0.6 });
  }
  W.load = i => {
    const I = W.islands[i]; if (I.loading) return I.loading;
    I.loading = loader.loadAsync(`./assets/d${String(i + 1).padStart(2, '0')}.glb`).then(gl => {
      gl.scene.updateMatrixWorld(true);
      let mesh = null; gl.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
      const geo = toFloat(mesh.geometry.clone()); geo.applyMatrix4(mesh.matrixWorld);
      geo.rotateX(Math.PI / 2);                   // library GLBs are stored Z-up: stand them up, front faces +Z
      geo.computeBoundingBox(); const b = geo.boundingBox, s = new THREE.Vector3(), c = new THREE.Vector3(); b.getSize(s); b.getCenter(c);
      const k = SIZE / Math.max(s.x, s.y, s.z);
      geo.translate(-c.x, -b.min.y, -c.z); geo.scale(k, k, k); geo.computeBoundingSphere();
      const mat = mesh.material; mat.side = THREE.FrontSide; mat.envMapIntensity = 0.9;
      const u = { uSat: { value: I.sat } };
      mat.onBeforeCompile = sh => { sh.uniforms.uSat = u.uSat; sh.fragmentShader = 'uniform float uSat;\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n{ float l = dot(diffuseColor.rgb, vec3(.299,.587,.114)); diffuseColor.rgb = mix(vec3(l) * vec3(.86,.9,1.02), diffuseColor.rgb, uSat) * mix(.82, 1., uSat); }'); };
      I.u = u;
      const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true;
      I.h = s.y * k; I.mesh = m;
      const sink = I.float ? 1.3 : -0.12; m.position.y = sink; I.baseY = sink;
      m.scale.setScalar(0.01); I.pop = 0;
      I.g.add(m);
      return I;
    });
    return I.loading;
  };
  W.setVisited = (i, visited, instant) => { const I = W.islands[i]; I.satT = visited ? 1 : 0.18; I.fogT = visited ? 0 : 1; if (instant) { I.sat = I.satT; I.fog = I.fogT; } };
  W.center = i => { const I = W.islands[i]; return I.g.position.clone().add(new THREE.Vector3(0, (I.float ? 1.3 : 0) + I.h * 0.45, 0)); };

  W.update = (dt, focus) => {
    W.t += dt;
    nT.offset.x = (W.t * 0.012) % 1; nT.offset.y = (W.t * 0.02) % 1;
    for (let i = 0; i < NC; i++) { const c = cl[i]; c.x += c.v * dt * (i % 2 ? -1 : 1) * 0.6; if (c.x > 26) c.x = -26; if (c.x < -26) c.x = 26;
      m4.compose(ps.set(c.x, c.y + Math.sin(W.t * 0.3 + i) * 0.2, c.z), q.identity(), sc.setScalar(c.s)); clouds.setMatrixAt(i, m4); }
    clouds.instanceMatrix.needsUpdate = true;
    for (const I of W.islands) {
      I.sat += (I.satT - I.sat) * Math.min(1, dt * 1.6); I.fog += (I.fogT - I.fog) * Math.min(1, dt * 1.4);
      if (I.u) I.u.uSat.value = I.sat;
      I.puff.visible = I.fog > 0.02; I.pm.opacity = 0.95 * I.fog; I.puff.rotation.y = W.t * 0.05 + I.i;
      I.puff.children.forEach((c, k) => c.position.y = (I.float ? 1.3 : 0) + I.h * 0.55 + c.userData.y + (1 - I.fog) * 5 + Math.sin(W.t + k) * 0.1);
      if (I.mesh) {
        if (I.pop < 1) { I.pop = Math.min(1, I.pop + dt * 1.8); const e = I.pop, b = 1 + 2.7 * Math.pow(e - 1, 3) + 1.7 * Math.pow(e - 1, 2); I.mesh.scale.setScalar(Math.max(0.01, b)); }
        if (I.float) I.mesh.position.y = I.baseY + Math.sin(W.t * 0.8 + I.i) * 0.12;
        I.mesh.rotation.y = focus === I.i ? Math.sin(W.t * 0.25) * 0.05 : 0;
      }
    }
  };
  return W;
}
