// Tidewing world, stylised: painted gradient sky with a cartoon sun, bright reflective lagoon ocean (Water.js +
// a normal map generated in code), low-poly toon islands from SimplexNoise with beaches, cliffs, palms, round trees,
// villages, docks, lighthouses and sailboats, and puffy toon cumulus you can fly through.
import * as THREE from './kit/three.module.min.js';
import { Water } from './kit/addons/objects/Water.js';
import { SimplexNoise } from './kit/addons/math/SimplexNoise.js';
import { mergeGeometries } from './kit/addons/utils/BufferGeometryUtils.js';
import { toon, outlineMat, outlineGeo, ramp } from './toon.js';

export const PRESETS = {
  morning:  { elev: 24, azim: 130, top: '#1d6ee6', mid: '#58b4ff', hor: '#d4f1ff', sun: '#fff1d2', sunI: 2.7, hemiSky: '#cde9ff', hemiGnd: '#4a9a8a', hemiI: 1.35, exp: 1.08, water: '#0d8fbf', clouds: 30, cloud: '#ffffff', cloudSh: '#9fc4ef', fogD: 0.000062, smoke: [1, 1, 1] },
  noon:     { elev: 58, azim: 200, top: '#1561dc', mid: '#4aaeff', hor: '#dcf6ff', sun: '#fffaf0', sunI: 2.8, hemiSky: '#d6eeff', hemiGnd: '#4aa39a', hemiI: 1.4, exp: 1.05, water: '#0a96c4', clouds: 34, cloud: '#ffffff', cloudSh: '#a7cdf2', fogD: 0.00006, smoke: [1, 1, 1] },
  storm:    { elev: 30, azim: 60, top: '#3d4c86', mid: '#7086bf', hor: '#c9d3ec', sun: '#e8ecff', sunI: 1.9, hemiSky: '#c3cdec', hemiGnd: '#3e6f80', hemiI: 1.5, exp: 1.1, water: '#1d6f90', clouds: 58, cloud: '#e4e8f6', cloudSh: '#6c7aa6', fogD: 0.000095, smoke: [0.92, 0.93, 0.98], storm: true },
  afternoon:{ elev: 26, azim: 250, top: '#2468d8', mid: '#69b8f6', hor: '#ffeccc', sun: '#ffe6b8', sunI: 2.8, hemiSky: '#d8ecff', hemiGnd: '#5a9a7a', hemiI: 1.3, exp: 1.08, water: '#0b88b8', clouds: 34, cloud: '#fffaf0', cloudSh: '#b2b8e6', fogD: 0.000065, smoke: [1, 0.98, 0.95] },
  sunset:   { elev: 7, azim: 275, top: '#3a3ea8', mid: '#c46cc6', hor: '#ffbb8c', sun: '#ffb27a', sunI: 2.6, hemiSky: '#e7c3e8', hemiGnd: '#5a5a9a', hemiI: 1.3, exp: 1.08, water: '#2c64a8', clouds: 30, cloud: '#ffe0d0', cloudSh: '#a77fc9', fogD: 0.00007, smoke: [1, 0.92, 0.9] },
  dusk:     { elev: 4, azim: 300, top: '#20256a', mid: '#6e4ab0', hor: '#ff94a0', sun: '#ff9f72', sunI: 2.3, hemiSky: '#c9b6ec', hemiGnd: '#4a4a8a', hemiI: 1.35, exp: 1.12, water: '#26468a', clouds: 28, cloud: '#ffd2d8', cloudSh: '#7d62b8', fogD: 0.000075, smoke: [0.95, 0.88, 0.92] },
};

function waterNormals(n = 256) {
  const h = new Float32Array(n * n), R = Math.random, waves = [];
  for (let i = 0; i < 40; i++) { const kx = Math.round((R() * 2 - 1) * (2 + i * 0.5)), ky = Math.round((R() * 2 - 1) * (2 + i * 0.5)); if (!kx && !ky) continue; waves.push([kx, ky, 1 / Math.pow(Math.hypot(kx, ky), 1.2), R() * 6.28]); }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { let v = 0; for (const [kx, ky, a, ph] of waves) v += a * Math.sin(6.2832 * (kx * x + ky * y) / n + ph); h[y * n + x] = v; }
  const d = new Uint8Array(n * n * 4), s = 2.0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = (h[y * n + (x + 1) % n] - h[y * n + (x - 1 + n) % n]) * s, dy = (h[((y + 1) % n) * n + x] - h[((y - 1 + n) % n) * n + x]) * s;
    const l = Math.hypot(dx, dy, 1), k = (y * n + x) * 4; d[k] = (-dx / l * 0.5 + 0.5) * 255; d[k + 1] = (-dy / l * 0.5 + 0.5) * 255; d[k + 2] = (1 / l * 0.5 + 0.5) * 255; d[k + 3] = 255;
  }
  const t = new THREE.DataTexture(d, n, n, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true; return t;
}
const vcol = (g, hex) => { g = g.index ? g.toNonIndexed() : g; const c = new THREE.Color(hex), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); if (g.attributes.uv) g.deleteAttribute('uv'); return g; };
const T = (g, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...s)));

// ---------------------------------------------------------------- prop geometries (vertex coloured, merged)
function palmGeo() {
  const parts = []; let x = 0, y = 0;
  for (let i = 0; i < 6; i++) { const seg = new THREE.CylinderGeometry(0.62 - i * 0.05, 0.7 - i * 0.05, 3.1, 7); parts.push(vcol(T(seg, [x, y + 1.5, 0], [0, 0, -0.06 * i]), i % 2 ? '#a8743f' : '#8c5a2e')); x += 0.2 * i; y += 3; }
  for (let k = 0; k < 7; k++) {
    const a = k / 7 * 6.283, leaf = new THREE.ConeGeometry(1.4, 9, 4, 1); leaf.scale(1, 1, 0.25); leaf.rotateZ(-Math.PI / 2); leaf.translate(4.5, 0, 0); leaf.rotateZ(-0.45);
    parts.push(vcol(T(leaf, [x, y + 0.4, 0], [0, a, 0]), k % 2 ? '#3fbf3a' : '#2fa843'));
  }
  parts.push(vcol(T(new THREE.SphereGeometry(0.6, 6, 5), [x + 0.5, y - 0.3, 0.4]), '#7a4a20'));
  return mergeGeometries(parts);
}
function treeGeo() {
  return mergeGeometries([vcol(T(new THREE.CylinderGeometry(0.7, 1, 6, 6), [0, 3, 0]), '#7d5534'), vcol(T(new THREE.IcosahedronGeometry(5.5, 0), [0, 9, 0]), '#45b33a'), vcol(T(new THREE.IcosahedronGeometry(4, 0), [2.8, 7.5, 1]), '#3a9f35'), vcol(T(new THREE.IcosahedronGeometry(3.6, 0), [-2.6, 8, -1.2]), '#58c444')]);
}
function lighthouseGeo() {
  const p = []; for (let i = 0; i < 6; i++) p.push(vcol(T(new THREE.CylinderGeometry(3.4 - i * 0.25, 3.6 - i * 0.25, 4, 14), [0, 2 + i * 4, 0]), i % 2 ? '#ffffff' : '#ee3b3b'));
  p.push(vcol(T(new THREE.CylinderGeometry(3.4, 3.4, 0.6, 14), [0, 24.3, 0]), '#2e3a4a'), vcol(T(new THREE.CylinderGeometry(1.9, 1.9, 3, 10), [0, 26.1, 0]), '#ffe57a'), vcol(T(new THREE.ConeGeometry(2.4, 2.4, 10), [0, 28.8, 0]), '#ee3b3b'), vcol(T(new THREE.BoxGeometry(6, 3, 6), [5, 1.5, 0]), '#ffffff'), vcol(T(new THREE.ConeGeometry(4.6, 2.6, 4), [5, 4.3, 0], [0, Math.PI / 4, 0]), '#2f6fdc'));
  return mergeGeometries(p);
}
function boatGeo() {
  const hull = new THREE.CylinderGeometry(1.6, 1.0, 9, 8, 1); hull.rotateX(Math.PI / 2); hull.scale(1, 0.6, 1);
  const sail = new THREE.BufferGeometry(); sail.setAttribute('position', new THREE.Float32BufferAttribute([0, 1, -3, 0, 10, -0.5, 0, 1, 3, 0, 1, 3, 0, 10, -0.5, 0, 1, -3], 3)); sail.computeVertexNormals();
  return mergeGeometries([vcol(T(hull, [0, 0.4, 0]), '#ffffff'), vcol(T(new THREE.BoxGeometry(2.8, 0.4, 8.2), [0, 1.0, 0]), '#d9884a'), vcol(T(new THREE.CylinderGeometry(0.12, 0.12, 10, 5), [0, 5.5, -0.5]), '#5b3a1e'), vcol(sail, '#fff6e6')]);
}

export class World {
  constructor(renderer, scene, lite) {
    this.R = renderer; this.scene = scene; this.lite = lite;
    this.fogU = { c: { value: new THREE.Color() }, d: { value: 0.0001 } };
    scene.fog = new THREE.FogExp2(0xcfefff, 0.00006);
    this.skyU = { uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uBelow: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() } };
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(30000, 32, 16), new THREE.ShaderMaterial({ uniforms: this.skyU, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position + cameraPosition, 1.0); gl_Position = p.xyww; }',
      fragmentShader: `uniform vec3 uTop, uMid, uHor, uBelow, uSun, uSunCol; varying vec3 vD;
        void main(){ vec3 d = normalize(vD); float y = d.y;
          vec3 c = mix(uHor, uMid, smoothstep(0.0, 0.28, y)); c = mix(c, uTop, smoothstep(0.28, 0.95, y));
          float s = max(dot(d, uSun), 0.0);
          c += uSunCol * (smoothstep(0.9993, 0.9996, s) * 6.0 + pow(s, 30.0) * 0.45 + pow(s, 4.0) * 0.12);
          c = mix(c, uBelow, smoothstep(0.0, -0.1, y)); gl_FragColor = vec4(c, 1.0); }` }));
    this.sky.frustumCulled = false; this.sky.renderOrder = -10; scene.add(this.sky);
    this.skyScene = new THREE.Scene();
    this.sun = new THREE.DirectionalLight(0xffffff, 3); this.sun.castShadow = true; const sm = lite ? 1024 : 2048; this.sun.shadow.mapSize.set(sm, sm);
    Object.assign(this.sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 10, far: 2600 }); this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.06; this.sun.shadow.radius = 3;
    this.hemi = new THREE.HemisphereLight(0xbfd4ff, 0x203040, 1); scene.add(this.sun, this.sun.target, this.hemi);
    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.water = new Water(new THREE.PlaneGeometry(60000, 60000), { textureWidth: lite ? 256 : 512, textureHeight: lite ? 256 : 512, waterNormals: waterNormals(256), sunDirection: new THREE.Vector3(), sunColor: 0xffffff, waterColor: 0x0d8fbf, distortionScale: 2.6, fog: true });
    this.water.rotation.x = -Math.PI / 2; this.water.material.uniforms.size.value = 0.45; scene.add(this.water);
    this.hideInReflection = [];
    const orig = this.water.onBeforeRender.bind(this.water);
    this.water.onBeforeRender = (r, s, c, ...a) => { const vis = this.hideInReflection.map(o => o.visible); this.hideInReflection.forEach(o => o.visible = false); orig(r, s, c, ...a); this.hideInReflection.forEach((o, i) => o.visible = vis[i]); };
    // cloud puffs: instanced toon spheres
    const cmax = this.cloudMax = lite ? 420 : 760;
    this.cloudMat = toon('#ffffff', { emissive: new THREE.Color('#9fc4ef'), emissiveIntensity: 0.35 }); this.cloudMat.gradientMap = ramp([150, 215, 255]);
    this.clouds = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), this.cloudMat, cmax); this.clouds.count = 0; this.clouds.frustumCulled = false; scene.add(this.clouds);
    this.cloudClusters = [];
    this.islands = []; this.islandGroup = new THREE.Group(); scene.add(this.islandGroup); this.props = [];
    this.geo = { palm: palmGeo(), tree: treeGeo(), light: lighthouseGeo(), boat: boatGeo() };
    this.propMat = toon('#ffffff', { vertexColors: true });
    this.inCloud = 0;
  }
  setPreset(name) {
    const P = this.P = PRESETS[name] || PRESETS.noon, U = this.skyU;
    U.uTop.value.set(P.top); U.uMid.value.set(P.mid); U.uHor.value.set(P.hor); U.uSunCol.value.set(P.sun);
    const phi = THREE.MathUtils.degToRad(90 - P.elev), th = THREE.MathUtils.degToRad(P.azim); this.sunDir.setFromSphericalCoords(1, phi, th); U.uSun.value.copy(this.sunDir);
    U.uBelow.value.set(P.water).lerp(new THREE.Color(P.hor), 0.35);
    const haze = new THREE.Color(P.hor); this.haze = haze;
    this.scene.fog.color.copy(haze); this.scene.fog.density = P.fogD; this.fogU.c.value.copy(haze); this.fogU.d.value = P.fogD;
    this.sun.color.set(P.sun); this.sun.intensity = P.sunI; this.hemi.color.set(P.hemiSky); this.hemi.groundColor.set(P.hemiGnd); this.hemi.intensity = P.hemiI;
    const wu = this.water.material.uniforms; wu.sunDirection.value.copy(this.sunDir); wu.sunColor.value.set(P.sun); wu.waterColor.value.set(P.water);
    // env lighting from this sky (glossy paint reflects it)
    this.skyScene.add(this.sky); const pm = new THREE.PMREMGenerator(this.R); if (this.envRT) this.envRT.dispose();
    this.envRT = pm.fromScene(this.skyScene, 0.02, 1, 40000); pm.dispose(); this.scene.add(this.sky);
    this.scene.environment = this.envRT.texture; this.scene.environmentIntensity = 0.7;
    this.cloudMat.color.set(P.cloud); this.cloudMat.emissive.set(P.cloudSh);
    return P;
  }
  // ---------------------------------------------------------------- islands + props
  buildIslands(rand, count, opts = {}) {
    const old = new Set(this.islandGroup.children); this.hideInReflection = this.hideInReflection.filter(o => !old.has(o)); for (const o of old) this.islandGroup.remove(o);
    this.islands = []; const noise = new SimplexNoise({ random: rand });
    const pp = { palm: [], tree: [], light: [], boat: [], house: [], plank: [] };
    for (let k = 0; k < count; k++) {
      let x, z, r, tries = 0;
      do { const a = rand() * 6.283, d = (k === 0 ? 0.25 : 0.35 + rand() * 0.75) * (opts.spread || 8000); x = Math.cos(a) * d; z = Math.sin(a) * d; r = 900 + rand() * 1200; tries++; }
      while (tries < 40 && (this.islands.some(i => Math.hypot(i.x - x, i.z - z) < (i.r + r) * 0.85) || (opts.clear && Math.hypot(x - opts.clear.x, z - opts.clear.z) < r + 1200)));
      const peak = 110 + rand() * 300, seg = this.lite ? 72 : 96, n = seg + 1, grid = new Float32Array(n * n), ox = rand() * 100, oz = rand() * 100;
      const g0 = new THREE.PlaneGeometry(r * 2, r * 2, seg, seg); g0.rotateX(-Math.PI / 2); const P0 = g0.attributes.position;
      for (let i = 0; i < P0.count; i++) {
        const px = P0.getX(i), pz = P0.getZ(i), d = Math.hypot(px, pz) / r;
        const fb = noise.noise(px / 700 + ox, pz / 700 + oz) * 0.55 + noise.noise(px / 260 + ox, pz / 260 + oz) * 0.25 + noise.noise(px / 90, pz / 90) * 0.06;
        const ridge = 1 - Math.abs(noise.noise(px / 420 + oz, pz / 420 + ox));
        const e = (1 - d * d) * 0.95 + fb * 0.5 - 0.42;
        let h = e > 0 ? peak * Math.pow(e, 1.4) * (0.65 + ridge * ridge * 0.6) + e * 18 : e * 110;
        if (e > 0 && e < 0.06) h = Math.min(h, 3.5);                               // wide flat beaches
        if (d > 0.97) h = Math.min(h, -30);
        P0.setY(i, h); grid[i] = h;
      }
      const g = g0.toNonIndexed(); g.computeVertexNormals(); const PA = g.attributes.position, NA = g.attributes.normal;
      const col = new Float32Array(PA.count * 3), c = new THREE.Color();
      const sand = new THREE.Color('#ffe7a3'), wet = new THREE.Color('#e9c77e'), grass = new THREE.Color('#86e04a'), grass2 = new THREE.Color('#45c046'), rock = new THREE.Color('#b9a48e'), rock2 = new THREE.Color('#957f6c'), under = new THREE.Color('#5fd6c4');
      for (let f = 0; f < PA.count; f += 3) {
        const h = (PA.getY(f) + PA.getY(f + 1) + PA.getY(f + 2)) / 3, ny = NA.getY(f), fx = PA.getX(f), fz = PA.getZ(f), nn = noise.noise(fx / 120, fz / 120) * 0.5 + 0.5;
        if (h < 0.2) c.copy(wet).lerp(under, Math.min(1, -h / 10));
        else if (h < 5 + nn * 2) c.copy(sand);
        else { c.copy(grass).lerp(grass2, nn); const steep = THREE.MathUtils.smoothstep(ny, 0.6, 0.42), high = THREE.MathUtils.smoothstep(h / peak, 0.68, 0.9); c.lerp(rock.clone().lerp(rock2, nn), Math.max(steep, high)); }
        for (let v = 0; v < 3; v++) { col[(f + v) * 3] = c.r; col[(f + v) * 3 + 1] = c.g; col[(f + v) * 3 + 2] = c.b; }
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const mesh = new THREE.Mesh(g, toon('#ffffff', { vertexColors: true })); mesh.position.set(x, 0, z); mesh.receiveShadow = true; this.islandGroup.add(mesh);
      const I = { x, z, r, peak, grid, n, seg, mesh }; this.islands.push(I);
      // lagoon shallows + foam ring
      const L = 256, cv = document.createElement('canvas'); cv.width = cv.height = L; const cx = cv.getContext('2d'), im = cx.createImageData(L, L);
      for (let yy = 0; yy < L; yy++) for (let xx = 0; xx < L; xx++) {
        const h = this.heightAt(x - r + xx / (L - 1) * r * 2, z - r + yy / (L - 1) * r * 2), kk = (yy * L + xx) * 4;
        if (h > 1.5 || h < -70) { im.data[kk + 3] = 0; continue; }
        const depth = Math.max(0, -h), foam = h > -3 ? 1 - Math.abs(h + 0.8) / 2.4 : 0, a = Math.pow(1 - depth / 70, 1.5);
        const band = depth < 18 ? 1 : 0.7;   // two-tone toon shallows
        im.data[kk] = 70 + foam * 185; im.data[kk + 1] = 225 * band + foam * 30; im.data[kk + 2] = 215 * band + foam * 40 + 20; im.data[kk + 3] = Math.min(255, (a * 0.8 + Math.max(0, foam) * 0.9) * 255);
      }
      cx.putImageData(im, 0, 0); const lt = new THREE.CanvasTexture(cv); lt.colorSpace = THREE.SRGBColorSpace;
      const lagoon = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: lt, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -40 }));
      lagoon.rotation.x = -Math.PI / 2; lagoon.position.set(x, 1, z); this.islandGroup.add(lagoon); this.hideInReflection.push(lagoon);
      // props
      for (let t = 0; t < 2600; t++) {
        const a = rand() * 6.283, dd = Math.sqrt(rand()) * r * 0.95, px = x + Math.cos(a) * dd, pz = z + Math.sin(a) * dd, h = this.heightAt(px, pz);
        if (h > 2.5 && h < 9) { if (rand() < 0.5) pp.palm.push([px, h, pz, rand()]); }
        else if (h > 12 && h < peak * 0.55 && rand() < 0.55) { const sl = Math.abs(this.heightAt(px + 15, pz) - h) + Math.abs(this.heightAt(px, pz + 15) - h); if (sl < 12) pp.tree.push([px, h, pz, rand()]); }
      }
      // villages + docks + lighthouse
      const vill = this.lite ? 1 : 2;
      for (let v = 0; v < vill; v++) {
        let s = null; for (let t = 0; t < 300 && !s; t++) { const a = rand() * 6.283, dd = r * (0.45 + rand() * 0.4), px = x + Math.cos(a) * dd, pz = z + Math.sin(a) * dd, h = this.heightAt(px, pz); if (h > 4 && h < 16) s = [px, pz, a]; }
        if (!s) continue;
        for (let hh = 0; hh < 12; hh++) { const px = s[0] + (rand() - 0.5) * 220, pz = s[1] + (rand() - 0.5) * 220, h = this.heightAt(px, pz); if (h < 4 || h > 30) continue; const sl = Math.abs(this.heightAt(px + 10, pz) - h) + Math.abs(this.heightAt(px, pz + 10) - h); if (sl < 6) pp.house.push([px, h, pz, rand()]); }
        // dock: walk outward until water, then extend 70 m
        let px = s[0], pz = s[1]; const dx = Math.cos(s[2]), dz = Math.sin(s[2]); for (let t = 0; t < 120 && this.heightAt(px, pz) > 0.5; t++) { px += dx * 8; pz += dz * 8; }
        for (let t = 0; t < 12; t++) pp.plank.push([px + dx * t * 6, 2.2, pz + dz * t * 6, s[2]]);
        for (let b = 0; b < 3; b++) pp.boat.push([px + dx * (30 + b * 25) + dz * (b - 1) * 22, 0.3, pz + dz * (30 + b * 25) - dx * (b - 1) * 22, rand() * 6]);
      }
      for (let t = 0; t < 300; t++) { const a = rand() * 6.283, dd = r * (0.6 + rand() * 0.35), px = x + Math.cos(a) * dd, pz = z + Math.sin(a) * dd, h = this.heightAt(px, pz); if (h > 6 && h < 60 && this.heightAt(px + Math.cos(a) * 60, pz + Math.sin(a) * 60) < 1) { pp.light.push([px, h, pz, a]); break; } }
      for (let b = 0; b < 4; b++) { const a = rand() * 6.283, dd = r * (1.0 + rand() * 0.4), px = x + Math.cos(a) * dd, pz = z + Math.sin(a) * dd; if (this.heightAt(px, pz) < -3) pp.boat.push([px, 0.3, pz, rand() * 6]); }
    }
    // instanced props, one draw each
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
    const inst = (geo, list, scaleFn, mat = this.propMat, outline = 0, cap = 4000) => {
      const n = Math.min(list.length, cap); if (!n) return null; const im = new THREE.InstancedMesh(geo, mat, n);
      for (let i = 0; i < n; i++) { const [x, y, z, r] = list[i]; q.setFromAxisAngle(Y, r * 6.283); s.setScalar(scaleFn(r)); M.compose(p.set(x, y - 0.5, z), q, s); im.setMatrixAt(i, M); }
      im.receiveShadow = true; this.islandGroup.add(im);
      if (outline) { const o = new THREE.InstancedMesh(outlineGeo(geo), outlineMat(outline), n); o.instanceMatrix = im.instanceMatrix; this.islandGroup.add(o); this.hideInReflection.push(o); }
      return im;
    };
    inst(this.geo.palm, pp.palm, r => 0.8 + r * 0.6, this.propMat, 0, this.lite ? 1200 : 2600);
    inst(this.geo.tree, pp.tree, r => 0.8 + r * 0.7, this.propMat, 0, this.lite ? 1500 : 3500);
    inst(this.geo.light, pp.light, () => 1.3, this.propMat, 1.6);
    inst(this.geo.boat, pp.boat, () => 1.4, this.propMat, 1.2);
    // houses: coloured walls + roofs via instance colours
    if (pp.house.length) {
      const wallT = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#2d5fa0'; x.fillRect(10, 18, 14, 16); x.fillRect(40, 18, 14, 16); x.fillStyle = '#7a4a26'; x.fillRect(26, 38, 12, 26); x.fillStyle = 'rgba(255,255,255,.5)'; x.fillRect(12, 20, 4, 12); x.fillRect(42, 20, 4, 12); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
      const wg = new THREE.BoxGeometry(10, 7, 9); wg.translate(0, 3.5, 0); const rg = new THREE.ConeGeometry(8.4, 5, 4); rg.rotateY(Math.PI / 4); rg.translate(0, 9.5, 0); rg.scale(1, 1, 0.92);
      const walls = new THREE.InstancedMesh(wg, toon('#ffffff', { map: wallT }), pp.house.length), roofs = new THREE.InstancedMesh(rg, toon('#ffffff'), pp.house.length);
      const WC = ['#fff4e0', '#ffd6e0', '#d6f0ff', '#fff2a8', '#d8ffd0', '#ffe0c2'], RC = ['#e8453c', '#2f7de1', '#ff8a2a', '#1fae8f', '#9a5ce6'], cc = new THREE.Color();
      pp.house.forEach(([x, y, z, r], i) => { q.setFromAxisAngle(Y, r * 6.283); s.setScalar(0.9 + r * 0.5); M.compose(p.set(x, y - 0.4, z), q, s); walls.setMatrixAt(i, M); roofs.setMatrixAt(i, M); walls.setColorAt(i, cc.set(WC[i % WC.length])); roofs.setColorAt(i, cc.set(RC[(i * 7) % RC.length])); });
      for (const m of [walls, roofs]) { m.receiveShadow = true; this.islandGroup.add(m); }
      const ow = new THREE.InstancedMesh(outlineGeo(mergeGeometries([wg.toNonIndexed(), rg.toNonIndexed()].map(g => { for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; }))), outlineMat(1.4), pp.house.length); ow.instanceMatrix = walls.instanceMatrix; this.islandGroup.add(ow); this.hideInReflection.push(ow);
    }
    if (pp.plank.length) { const pg = mergeGeometries([vcol(new THREE.BoxGeometry(5, 0.8, 6.2), '#b07a45'), vcol(T(new THREE.CylinderGeometry(0.5, 0.5, 8, 6), [2.2, -3, 2.6]), '#6e4826'), vcol(T(new THREE.CylinderGeometry(0.5, 0.5, 8, 6), [-2.2, -3, 2.6]), '#6e4826')]);
      const im = new THREE.InstancedMesh(pg, this.propMat, pp.plank.length); pp.plank.forEach(([x, y, z, a], i) => { q.setFromAxisAngle(Y, -a + Math.PI / 2); M.compose(p.set(x, y, z), q, s.setScalar(1)); im.setMatrixAt(i, M); }); this.islandGroup.add(im); }
    this.hideInReflection.push(...this.islandGroup.children.filter(o => o.isInstancedMesh));
  }
  heightAt(x, z) {
    let best = -100;
    for (const I of this.islands) {
      const lx = x - I.x + I.r, lz = z - I.z + I.r, s = I.r * 2; if (lx < 0 || lz < 0 || lx >= s || lz >= s) continue;
      const gx = lx / s * I.seg, gz = lz / s * I.seg, ix = Math.floor(gx), iz = Math.floor(gz), fx = gx - ix, fz = gz - iz, n = I.n, G = I.grid;
      const h = (G[iz * n + ix] * (1 - fx) + G[iz * n + ix + 1] * fx) * (1 - fz) + (G[(iz + 1) * n + ix] * (1 - fx) + G[(iz + 1) * n + ix + 1] * fx) * fz;
      if (h > best) best = h;
    }
    return best;
  }
  groundAt(x, z) { return Math.max(0, this.heightAt(x, z)); }
  findSpot(rand, I, minH = 12) {
    for (let t = 0; t < 400; t++) {
      const a = rand() * 6.28, d = rand() * I.r * 0.7, x = I.x + Math.cos(a) * d, z = I.z + Math.sin(a) * d, h = this.heightAt(x, z);
      if (h < minH || h > I.peak * 0.6) continue;
      const sl = Math.max(Math.abs(this.heightAt(x + 20, z) - h), Math.abs(this.heightAt(x, z + 20) - h), Math.abs(this.heightAt(x - 20, z) - h), Math.abs(this.heightAt(x, z - 20) - h));
      if (sl < 6) return new THREE.Vector3(x, h, z);
    }
    return new THREE.Vector3(I.x, Math.max(5, this.heightAt(I.x, I.z)), I.z);
  }
  // ---------------------------------------------------------------- toon cumulus
  buildClouds(rand, count, storm) {
    this.cloudClusters = []; const M = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(); let n = 0;
    for (let c = 0; c < count && n < this.cloudMax - 8; c++) {
      const a = rand() * 6.28, d = 600 + rand() * 11500, cx = Math.cos(a) * d, cz = Math.sin(a) * d, cy = (storm ? 800 : 1000) + rand() * 1400;
      const w = 220 + rand() * 420, np = Math.round(7 + w / 45);
      this.cloudClusters.push({ x: cx, y: cy + w * 0.2, z: cz, r: w * 0.9 });
      for (let i = 0; i < np && n < this.cloudMax; i++) {
        const u = rand() * 6.28, rr = Math.sqrt(rand()), px = cx + Math.cos(u) * rr * w, pz = cz + Math.sin(u) * rr * w * 0.6;
        const rad = (90 + rand() * 120) * (1.15 - rr * 0.5), py = cy + (1 - rr) * w * 0.35 + rand() * 30;
        M.compose(p.set(px, py, pz), q.setFromEuler(new THREE.Euler(rand(), rand() * 6, 0)), s.set(rad * 1.2, rad * 0.8, rad)); this.clouds.setMatrixAt(n++, M);
      }
      for (let i = 0; i < 3 && n < this.cloudMax; i++) { M.compose(p.set(cx + (i - 1) * w * 0.55, cy - 10, cz), q.identity(), s.set(w * 0.45, 40, w * 0.4)); this.clouds.setMatrixAt(n++, M); }   // flat bases
    }
    this.clouds.count = n; this.clouds.instanceMatrix.needsUpdate = true; this.clouds.computeBoundingSphere();
  }
  update(dt, cam) {
    this.water.material.uniforms.time.value += dt * 0.6;
    this.water.position.x = Math.round(cam.position.x / 100) * 100; this.water.position.z = Math.round(cam.position.z / 100) * 100;
    let inside = 0; const cp = cam.position;
    for (const c of this.cloudClusters) { const d = Math.hypot((cp.x - c.x) / c.r, (cp.y - c.y) / (c.r * 0.5), (cp.z - c.z) / (c.r * 0.7)); if (d < 1) inside = Math.max(inside, 1 - d); }
    this.inCloud += (Math.min(1, inside * 2.5) - this.inCloud) * Math.min(1, dt * 4);
  }
  followShadow(p) { this.sun.position.copy(p).addScaledVector(this.sunDir, 1200); this.sun.target.position.copy(p); }
}
