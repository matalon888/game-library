// Hivefall world: dusk sky with two moons, procedural desert terrain (heightmap shared with gameplay), banded rock
// spires, a bone field, glowing crystals, and Outpost Kestrel-7 (uplink mast, prefab modules, sandbag ring with gates,
// floodlight towers with light shafts, crates, barrels, cables, signage). Static geometry is merged per material.
import { THREE, procTex } from './kit/cine.js';
import { toon, outline, outlineMat, hullGeo, canvasTex as cTex, graffiti, INK } from './style.js';
import { SimplexNoise } from './kit/addons/math/SimplexNoise.js';
import { RoundedBoxGeometry } from './kit/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from './kit/addons/utils/BufferGeometryUtils.js';

export const SIZE = 480, SEG = 240, RING = 24, LZ = new THREE.Vector3(8, 0, -112);
export const HIVE_SITES = [[-70, -40], [62, -58], [-38, 88], [92, 34], [-108, 22], [24, 104], [-20, -150], [120, -90], [-125, -95]];
const GATES = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
const sx = new SimplexNoise({ random: mulberry(7) });
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function rawHeight(x, z) {
  const r = Math.hypot(x, z);
  let h = 2.6 * sx.noise(x * 0.011, z * 0.011) + 1.1 * sx.noise(x * 0.03 + 9, z * 0.026) + 0.3 * sx.noise(x * 0.1, z * 0.1);
  h += Math.abs(sx.noise(x * 0.02 - 4, z * 0.007)) * 2.2;                       // long dune crests
  h += sm(140, 225, r) * (16 + 22 * (0.5 + 0.5 * sx.noise(x * 0.008, z * 0.008)));    // distant mesa wall: a bowl horizon
  h *= sm(27, 46, r);                                                                // flat plateau under the outpost
  const lz = Math.hypot(x - LZ.x, z - LZ.z); h *= sm(10, 24, lz) * 0.85 + 0.15 * (lz > 10 ? 1 : 0);
  for (const [hx, hz] of HIVE_SITES) { const d = Math.hypot(x - hx, z - hz); h -= (1 - sm(0, 14, d)) * 1.6; }   // hive craters
  return h;
}
// heightmap grid (gameplay samples this; the mesh is built from the same numbers)
const N1 = SEG + 1, STEP = SIZE / SEG, HM = new Float32Array(N1 * N1);
for (let j = 0; j < N1; j++) for (let i = 0; i < N1; i++) HM[j * N1 + i] = rawHeight(-SIZE / 2 + i * STEP, -SIZE / 2 + j * STEP);
export function ground(x, z) {
  const fx = (x + SIZE / 2) / STEP, fz = (z + SIZE / 2) / STEP;
  const i = Math.max(0, Math.min(SEG - 1, Math.floor(fx))), j = Math.max(0, Math.min(SEG - 1, Math.floor(fz))), u = Math.min(1, Math.max(0, fx - i)), v = Math.min(1, Math.max(0, fz - j));
  const a = HM[j * N1 + i], b = HM[j * N1 + i + 1], c = HM[(j + 1) * N1 + i], d = HM[(j + 1) * N1 + i + 1];
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}
export function groundNormal(x, z, out = new THREE.Vector3()) { const e = 1; return out.set(ground(x - e, z) - ground(x + e, z), 2 * e, ground(x, z - e) - ground(x, z + e)).normalize(); }
export const inGate = (a) => GATES.some(g => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < 0.13);

// colliders for the player: circles {x,z,r} and oriented boxes {x,z,hw,hd,c,s}
export const COL = { circles: [], boxes: [] };

// ------------------------------------------------------------------ helpers
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
class Merger {
  constructor() { this.parts = {}; }
  add(key, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), typeof s === 'number' ? _s.set(s, s, s) : _s.set(...s)); g.applyMatrix4(_m);
    (this.parts[key] = this.parts[key] || []).push(g); return g;
  }
  addM(key, geo, matrix) { let g = geo.index ? geo.toNonIndexed() : geo.clone(); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); g.applyMatrix4(matrix); (this.parts[key] = this.parts[key] || []).push(g); }
  build(scene, mats, { cast = true, receive = true, ol = 0.035 } = {}) {
    const out = {};
    for (const [k, list] of Object.entries(this.parts)) { const g = mergeGeometries(list); const m = new THREE.Mesh(g, mats[k]); const glow = k.startsWith('glow') || k === 'lamp';
      m.castShadow = cast && !glow; m.receiveShadow = receive; scene.add(m); out[k] = m; if (!glow && ol) outline(m, k === 'cable' ? 0.02 : ol); }
    return out;
  }
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const rbox = (w, h, d, r = 0.06) => new RoundedBoxGeometry(w, h, d, 2, r);
const cyl = (rt, rb, h, s = 12, open = false) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open);
function beam(M, key, a, b, r = 0.08, s = 6) {   // cylinder from point a to b
  const d = new THREE.Vector3().subVectors(b, a), L = d.length(); const g = cyl(r, r, L, s); g.translate(0, L / 2, 0);
  _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); _m.compose(a, _q, _s.set(1, 1, 1)); M.addM(key, g, _m);
}
const canvasTex = cTex;
const strip = (geos) => geos.map(g => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k); return g; });

// ------------------------------------------------------------------ sky dome (vivid gradient), sun glow, two moons, toon clouds
export function buildSky(scene, sunDir) {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uSun: { value: sunDir.clone().normalize() } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform vec3 uSun; varying vec3 vD; void main(){ float y = vD.y;
      vec3 top = vec3(.13, .42, 1.), mid = vec3(.45, .78, 1.), hor = vec3(1., .86, .74), pink = vec3(1., .66, .76);
      vec3 c = mix(mid, top, smoothstep(.12, .75, y)); c = mix(mix(hor, pink, .35), c, smoothstep(-.02, .2, y));
      float s = max(0., dot(vD, uSun)); c += vec3(1., .85, .6) * (pow(s, 8.) * .35 + pow(s, 400.) * 2.5);
      gl_FragColor = vec4(c, 1.); }` }));
  sky.renderOrder = -10; scene.add(sky);
  // moons: big lavender ringed planet + small peach moon, hanging in the daytime sky
  const moonTex = (base, spot) => canvasTex(512, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, base[0]); g.addColorStop(1, base[1]); x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { const px = Math.random() * w, py = Math.random() * h, r = Math.pow(Math.random(), 2) * 22 + 4; x.fillStyle = spot; x.globalAlpha = 0.35; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); x.globalAlpha = 0.5; x.fillStyle = '#fff'; x.beginPath(); x.arc(px - r * 0.25, py - r * 0.25, r * 0.4, 0, 7); x.fill(); } x.globalAlpha = 1; });
  const big = new THREE.Mesh(new THREE.SphereGeometry(80, 48, 24), new THREE.MeshBasicMaterial({ map: moonTex(['#e9dcff', '#b9a4ff'], '#9b84f0'), fog: false }));
  big.position.set(-380, 380, -820); big.rotation.set(0.3, 1.2, 0.2);
  const ring = new THREE.Mesh(new THREE.RingGeometry(105, 165, 96, 1), new THREE.MeshBasicMaterial({ map: canvasTex(512, 8, (x, w) => { for (let i = 0; i < w; i++) { const a = 0.45 + 0.5 * Math.abs(Math.sin(i * 0.09) * Math.sin(i * 0.031)); x.fillStyle = `hsla(${280 + i * 0.12},90%,85%,${a})`; x.fillRect(i, 0, 1, 8); } }), transparent: true, side: THREE.DoubleSide, fog: false, depthWrite: false }));
  const rp = ring.geometry.attributes.position, ruv = ring.geometry.attributes.uv; for (let i = 0; i < rp.count; i++) { const r = Math.hypot(rp.getX(i), rp.getY(i)); ruv.setXY(i, (r - 105) / 60, 0.5); }
  ring.position.copy(big.position); ring.rotation.set(1.2, 0.25, 0.5);
  const small = new THREE.Mesh(new THREE.SphereGeometry(26, 32, 16), new THREE.MeshBasicMaterial({ map: moonTex(['#ffe1c4', '#ffb38a'], '#f08a6a'), fog: false }));
  small.position.set(520, 300, -700);
  scene.add(big, ring, small);
  // puffy toon clouds (one merged mesh)
  const cg = []; const R = mulberry(77);
  for (let i = 0; i < 16; i++) { const a = R() * Math.PI * 2, r = 520 + R() * 380, cx = Math.cos(a) * r, cz = Math.sin(a) * r, cy = 110 + R() * 160, s = 14 + R() * 18;
    for (let j = 0; j < 5; j++) { const g = new THREE.SphereGeometry(s * (0.7 + R() * 0.6), 14, 10); g.scale(1, 0.75, 1); g.translate(cx + (j - 2) * s * 0.9 * Math.cos(a + 1.57), cy + R() * s * 0.4, cz + (j - 2) * s * 0.9 * Math.sin(a + 1.57)); cg.push(g); } }
  const clouds = new THREE.Mesh(mergeGeometries(strip(cg)), new THREE.MeshToonMaterial({ color: '#ffffff', emissive: '#9fb6e8', emissiveIntensity: 0.35, fog: false, gradientMap: toon('#fff').gradientMap }));
  scene.add(clouds);
  return { sky, moons: [big, small] };
}

// ------------------------------------------------------------------ terrain + candy spires + bones + crystals + glowing plants
export function buildTerrain(scene, lite) {
  const g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  const sand = new THREE.Color('#ffb784'), low = new THREE.Color('#e98fa6'), crest = new THREE.Color('#ffe2b0'), far = new THREE.Color('#c77ad8'), pad = new THREE.Color('#f2d2b0'), moss = new THREE.Color('#5fd6b8');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i); const y = HM[i]; p.setY(i, y);
    const n = sx.noise(x * 0.05, z * 0.05), n2 = sx.noise(x * 0.4, z * 0.4), n3 = sx.noise(x * 0.018 + 40, z * 0.018);
    c.copy(sand).lerp(low, Math.max(0, Math.min(1, -y * 0.3 + 0.1 + n * 0.15))).lerp(crest, Math.max(0, Math.min(1, (y - 2.2) * 0.15 + n * 0.12)));
    if (n3 > 0.45) c.lerp(moss, Math.min(0.75, (n3 - 0.45) * 3));
    const r = Math.hypot(x, z); if (r > 120) c.lerp(far, sm(140, 210, r) * 0.7);
    if (r < 40) c.lerp(pad, (1 - sm(28, 40, r)) * 0.6);
    c.multiplyScalar(0.94 + n2 * 0.06);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  const speck = canvasTex(256, 256, (x, w) => { x.fillStyle = '#fff'; x.fillRect(0, 0, w, w); for (let i = 0; i < 1600; i++) { x.fillStyle = ['#f1e6e6', '#e6d8dc', '#fff8ee', '#e9dbe8'][i % 4]; const s = 2 + Math.random() * 4; x.beginPath(); x.arc(Math.random() * w, Math.random() * w, s, 0, 7); x.fill(); } });
  speck.wrapS = speck.wrapT = THREE.RepeatWrapping; speck.repeat.set(90, 90);
  const terrain = new THREE.Mesh(g, toon('#ffffff', { vertexColors: true, map: speck }));
  terrain.receiveShadow = true; scene.add(terrain);

  const R = mulberry(31);
  const avoid = (x, z, rr) => Math.hypot(x, z) < 38 + rr || Math.hypot(x - LZ.x, z - LZ.z) < 20 + rr || HIVE_SITES.some(([hx, hz]) => Math.hypot(x - hx, z - hz) < 16 + rr);
  const spireGeos = [];
  const spire = (x, z, h, rb, rt, cap) => {
    const g = new THREE.CylinderGeometry(rt, rb, h, 10, Math.ceil(h / 0.9)); g.translate(0, h / 2, 0);
    const pp = g.attributes.position, seed = R() * 100, lean = new THREE.Vector2((R() - 0.5) * 0.12, (R() - 0.5) * 0.12);
    for (let i = 0; i < pp.count; i++) { const vx = pp.getX(i), vy = pp.getY(i), vz = pp.getZ(i), a = Math.atan2(vz, vx);
      const k = 1 + 0.2 * sx.noise3d(Math.cos(a) * 1.2, vy * 0.1, seed) + 0.06 * Math.sin(vy * 0.9 + seed);   // smooth bulges
      pp.setXYZ(i, vx * k + lean.x * vy, vy, vz * k + lean.y * vy); }
    const y0 = ground(x, z) - 1.5; g.translate(x, y0, z); spireGeos.push(g);
    if (cap) { const cg = new THREE.SphereGeometry(rt * 2.3, 14, 8); cg.scale(1, 0.42, 1); cg.translate(x + lean.x * h, y0 + h + rt * 0.3, z + lean.y * h); spireGeos.push(cg); }
    COL.circles.push({ x, z, r: rb * 0.85 });
  };
  let placed = 0;
  for (let t = 0; t < 400 && placed < (lite ? 34 : 46); t++) {
    const a = R() * Math.PI * 2, r = 44 + Math.pow(R(), 0.8) * 120, x = Math.cos(a) * r, z = Math.sin(a) * r, rb = 2.5 + R() * 4.5;
    if (avoid(x, z, rb) || COL.circles.some(c => Math.hypot(c.x - x, c.z - z) < c.r + rb + 5)) continue;
    const h = 9 + R() * 28 * (0.5 + r / 160); spire(x, z, h, rb, rb * (0.3 + R() * 0.35), R() < 0.5); placed++;
    if (R() < 0.45) spire(x + (R() - .5) * rb * 3, z + (R() - .5) * rb * 3, h * (0.35 + R() * 0.3), rb * 0.55, rb * 0.25, R() < 0.5);
  }
  for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2 + R() * 0.2, r = 180 + R() * 30, x = Math.cos(a) * r, z = Math.sin(a) * r; spire(x, z, 30 + R() * 45, 12 + R() * 10, 8 + R() * 6, R() < 0.5); }
  const sp = mergeGeometries(strip(spireGeos)); sp.computeVertexNormals();
  { const pp = sp.attributes.position, cc = new Float32Array(pp.count * 3), bands = ['#ff7a6b', '#ffb35c', '#ffe08a', '#ff8fc0', '#b77bff', '#ff9a7a'].map(h => new THREE.Color(h));
    for (let i = 0; i < pp.count; i++) { const y = pp.getY(i), n = sx.noise(pp.getX(i) * 0.03, pp.getZ(i) * 0.03); const b = Math.floor((y + n * 2.5) / 2.6); c.copy(bands[((b % 6) + 6) % 6]); cc[i * 3] = c.r; cc[i * 3 + 1] = c.g; cc[i * 3 + 2] = c.b; }
    for (let i = 0; i < cc.length; i++) cc[i] = 1; sp.setAttribute('color', new THREE.BufferAttribute(cc, 3)); }
  const spMat = toon('#ffffff', { vertexColors: true });
  spMat.onBeforeCompile = sh => { sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWP = (modelMatrix * vec4(transformed, 1.)).xyz;');
    sh.fragmentShader = 'varying vec3 vWP;\n' + sh.fragmentShader.replace('#include <color_fragment>', `
      float bb = floor((vWP.y + sin(vWP.x * .07) * 1.6 + cos(vWP.z * .05) * 1.6) / 2.4); float k = mod(bb, 6.);
      vec3 bc = k < 1. ? vec3(1., .3, .26) : k < 2. ? vec3(1., .55, .12) : k < 3. ? vec3(1., .82, .3) : k < 4. ? vec3(1., .34, .6) : k < 5. ? vec3(.55, .3, 1.) : vec3(.35, .72, 1.);
      diffuseColor.rgb *= bc;`); };
  const spMesh = new THREE.Mesh(sp, spMat);
  spMesh.castShadow = true; spMesh.receiveShadow = true; scene.add(spMesh); outline(spMesh, 0.12);
  // boulders (instanced, pastel)
  const bg = new THREE.IcosahedronGeometry(1, 1), bp = bg.attributes.position; for (let i = 0; i < bp.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(bp, i); v.multiplyScalar(1 + 0.22 * sx.noise3d(v.x * 1.5, v.y * 1.5, v.z * 1.5)); bp.setXYZ(i, v.x, v.y * 0.7, v.z); } bg.computeVertexNormals();
  const NB = lite ? 150 : 240, boulders = new THREE.InstancedMesh(bg, toon('#ffffff'), NB);
  const o = new THREE.Object3D(); let nb = 0; const rockCols = ['#ff9b85', '#c79bff', '#ffc28a', '#f58fb0'];
  for (let t = 0; t < 2000 && nb < NB; t++) { const x = (R() - .5) * 420, z = (R() - .5) * 420, s = 0.3 + Math.pow(R(), 3) * 3.2; if (avoid(x, z, 2) || Math.hypot(x, z) > 200) continue;
    o.position.set(x, ground(x, z) + s * 0.1, z); o.rotation.set(R() * 3, R() * 6, R() * 3); o.scale.set(s * (0.8 + R() * 0.5), s * (0.6 + R() * 0.5), s * (0.8 + R() * 0.5)); o.updateMatrix(); boulders.setMatrixAt(nb, o.matrix);
    boulders.setColorAt(nb, new THREE.Color(rockCols[nb % 4])); if (s > 1.6) COL.circles.push({ x, z, r: s * 0.8, h: s }); nb++; }
  boulders.count = nb; boulders.castShadow = true; boulders.receiveShadow = true; scene.add(boulders); outline(boulders, 0.06);
  // bone field: the ribcage of something enormous
  const bones = [];
  const rib = (cx, cz, yaw) => { const parts = [];
    for (let i = 0; i < 9; i++) { const z = (i - 4) * 2.6, s = 1 - Math.abs(i - 3) * 0.09; for (const side of [-1, 1]) {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 9 * s, z), new THREE.Vector3(side * 5 * s, 8 * s, z + 0.6), new THREE.Vector3(side * 8 * s, 3 * s, z + 1.4), new THREE.Vector3(side * 8.6 * s, -1.5, z + 2.2)]);
      parts.push(new THREE.TubeGeometry(curve, 16, 0.38 * s + 0.1, 7, false)); } }
    parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 6, -16), new THREE.Vector3(0, 9.2, -8), new THREE.Vector3(0, 9.4, 4), new THREE.Vector3(0, 7.5, 12), new THREE.Vector3(0, 2, 20)]), 40, 0.8, 8, false));
    const skull = new THREE.SphereGeometry(3.2, 16, 12); skull.scale(1, 0.7, 1.5); skull.translate(0, 2.2, 23); parts.push(skull);
    for (const side of [-1, 1]) { const horn = new THREE.ConeGeometry(0.7, 6, 8); horn.rotateX(-1.1); horn.rotateZ(side * 0.5); horn.translate(side * 2.2, 4.4, 25.5); parts.push(horn); }
    for (const g of strip(parts)) { g.rotateY(yaw); g.translate(cx, ground(cx, cz) - 1, cz); bones.push(g); }
    COL.circles.push({ x: cx, z: cz, r: 3 });
  };
  rib(-58, 48, 0.9); rib(70, 95, -2.2);
  const boneMesh = new THREE.Mesh(mergeGeometries(bones), toon('#fff3dc'));
  boneMesh.castShadow = boneMesh.receiveShadow = true; scene.add(boneMesh); outline(boneMesh, 0.08);
  // glowing crystal clusters near spire feet
  const cr = [], crc = [];
  for (let k = 0; k < 24; k++) { const c0 = COL.circles[Math.floor(R() * Math.min(COL.circles.length, 90))]; if (!c0) break; const a = R() * 6.28, x = c0.x + Math.cos(a) * (c0.r + 1.2), z = c0.z + Math.sin(a) * (c0.r + 1.2); if (Math.hypot(x, z) < 36) continue;
    const hue = k % 2 ? new THREE.Color('#3ff0ff') : new THREE.Color('#ff5fd2');
    for (let i = 0; i < 5; i++) { const h = 0.8 + R() * 2.6, g = new THREE.ConeGeometry(0.25 + R() * 0.25, h, 5); g.translate(0, h / 2, 0); g.rotateX((R() - .5) * 0.9); g.rotateZ((R() - .5) * 0.9); g.translate(x + (R() - .5) * 1.2, ground(x, z) - 0.2, z + (R() - .5) * 1.2); const ng = g.toNonIndexed(); cr.push(ng); crc.push([hue, ng.attributes.position.count]); } }
  if (cr.length) { const mg = mergeGeometries(strip(cr)); const cc = new Float32Array(mg.attributes.position.count * 3); let off = 0; for (const [h, n] of crc) { for (let i = 0; i < n; i++) cc.set([h.r, h.g, h.b], (off + i) * 3); off += n; } mg.setAttribute('color', new THREE.BufferAttribute(cc, 3));
    const cm = new THREE.Mesh(mg, new THREE.MeshToonMaterial({ vertexColors: true, color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.0, gradientMap: toon('#fff').gradientMap }));
    cm.material.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vColor.rgb * .9;'); };
    scene.add(cm); outline(cm, 0.05); }
  // glowing alien plants: bulb stalks + spiky grass tufts (instanced)
  const stalkG = new THREE.CylinderGeometry(0.06, 0.12, 1, 6); stalkG.translate(0, 0.5, 0);
  const bulbG = new THREE.SphereGeometry(0.32, 12, 8);
  const grassG = (() => { const parts = []; for (let i = 0; i < 6; i++) { const g = new THREE.ConeGeometry(0.09, 0.9 + (i % 3) * 0.3, 4); g.translate(0, 0.45, 0); g.rotateZ((i - 2.5) * 0.18); g.rotateY(i * 1.1); parts.push(g); } return mergeGeometries(strip(parts)); })();
  const NP = lite ? 120 : 220, NG = lite ? 260 : 480;
  const stalks = new THREE.InstancedMesh(stalkG, toon('#3b9c8a'), NP), bulbs = new THREE.InstancedMesh(bulbG, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.5, 1.5) }), NP), grass = new THREE.InstancedMesh(grassG, toon('#ffffff'), NG);
  const plantCols = ['#7dfcff', '#ff6be8', '#c6ff5a', '#ffd34d'], grassCols = ['#4fd1b0', '#46b8e0', '#8a7bff', '#5ee08f'];
  let np = 0, ng = 0;
  for (let t = 0; t < 6000 && (np < NP || ng < NG); t++) { const x = (R() - .5) * 400, z = (R() - .5) * 400; if (Math.hypot(x, z) < 27 || Math.hypot(x, z) > 195) continue; const y = ground(x, z);
    const lush = sx.noise(x * 0.018 + 40, z * 0.018) > 0.3 || R() < 0.15;
    if (!lush) continue;
    if (np < NP && R() < 0.35) { for (let j = 0; j < 3 && np < NP; j++) { const h = 0.8 + R() * 1.8, ox = x + (R() - .5) * 1.4, oz = z + (R() - .5) * 1.4, oy = ground(ox, oz); o.position.set(ox, oy - 0.1, oz); o.rotation.set((R() - .5) * 0.4, 0, (R() - .5) * 0.4); o.scale.set(1, h, 1); o.updateMatrix(); stalks.setMatrixAt(np, o.matrix);
      const top = new THREE.Vector3(0, 1, 0).applyMatrix4(o.matrix); o.position.copy(top); o.rotation.set(0, 0, 0); o.scale.setScalar(0.8 + R() * 0.7); o.updateMatrix(); bulbs.setMatrixAt(np, o.matrix); bulbs.setColorAt(np, new THREE.Color(plantCols[np % 4])); np++; } }
    else if (ng < NG) { o.position.set(x, y - 0.05, z); o.rotation.set(0, R() * 6, 0); o.scale.setScalar(0.7 + R() * 0.9); o.updateMatrix(); grass.setMatrixAt(ng, o.matrix); grass.setColorAt(ng, new THREE.Color(grassCols[ng % 4])); ng++; } }
  stalks.count = bulbs.count = np; grass.count = ng; stalks.castShadow = true; grass.receiveShadow = true;
  scene.add(stalks, bulbs, grass); outline(stalks, 0.03); outline(bulbs, 0.04); outline(grass, 0.025);
  return { terrain, bulbs };
}

// ------------------------------------------------------------------ the outpost
export function buildOutpost(scene) {
  const M = new Merger();
  const mats = {
    metal: toon('#f4f1ea'), dark: toon('#3a4466'), concrete: toon('#d9d2c6'),
    hazard: toon('#ffffff', { map: canvasTex(128, 128, (x) => { x.fillStyle = '#ffcf2e'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#2a2140'; for (let i = -128; i < 256; i += 40) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 20, 0); x.lineTo(i + 148, 128); x.lineTo(i + 128, 128); x.fill(); } }) }),
    teal: toon('#22c3a6'), orange: toon('#ff7a2e'), crate: toon('#ffa733'), blue: toon('#3d8bff'),
    barrel: toon('#ff4b5c'), cable: toon('#2a2140'),
    glowCyan: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.4, 2.6) }), glowWarm: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.8, 0.9) }),
    glowRed: new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.4, 0.3) }), lamp: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.1, 1.8) }),
  };
  // pad: painted plaza with stencils
  const padTex = canvasTex(1024, 1024, (x, w) => {
    x.fillStyle = '#f3e6d4'; x.fillRect(0, 0, w, w);
    const zc = ['#bff3e8', '#ffd9b8', '#ffd1ec', '#cfe6ff']; for (let i = 0; i < 26; i++) { x.fillStyle = zc[i % 4]; const zx = Math.floor(Math.random() * 12) * 80, zy = Math.floor(Math.random() * 12) * 80; x.fillRect(zx, zy, 80, 80); }
    for (let i = 0; i < 4000; i++) { x.fillStyle = ['rgba(0,0,0,.05)', 'rgba(255,255,255,.3)', 'rgba(120,80,60,.06)'][i % 3]; x.fillRect(Math.random() * w, Math.random() * w, 4, 4); }
    x.strokeStyle = '#c9c0b2'; x.lineWidth = 4; for (let i = 0; i <= w; i += 80) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, w); x.moveTo(0, i); x.lineTo(w, i); x.stroke(); }
    x.strokeStyle = '#22c3a6'; x.lineWidth = 18; x.beginPath(); x.arc(w / 2, w / 2, w * 0.46, 0, 7); x.stroke();
    x.strokeStyle = '#ff7a2e'; x.setLineDash([46, 30]); x.lineWidth = 12; x.beginPath(); x.arc(w / 2, w / 2, w * 0.17, 0, 7); x.stroke(); x.setLineDash([]);
    graffiti(x, 'K-7', w / 2, w * 0.8, 140, '#ffcf2e'); graffiti(x, 'HOLD IT!', w * 0.26, w * 0.3, 70, '#ff5fd2', -0.3); graffiti(x, 'NO BUGS', w * 0.76, w * 0.32, 64, '#3fd0ff', 0.25);
    for (const a of [0, 1, 2, 3]) { x.save(); x.translate(w / 2, w / 2); x.rotate(a * Math.PI / 2); x.fillStyle = '#ff7a2e'; x.beginPath(); x.moveTo(0, -w * 0.41); x.lineTo(34, -w * 0.34); x.lineTo(-34, -w * 0.34); x.fill(); x.restore(); }
  });
  const pad = new THREE.Mesh(new THREE.CircleGeometry(25.5, 64), toon('#ffffff', { map: padTex, polygonOffset: true, polygonOffsetFactor: -1 }));
  pad.rotation.x = -Math.PI / 2; pad.position.y = 0.03; pad.receiveShadow = true; scene.add(pad);

  // ---- uplink mast (the thing you defend)
  M.add('dark', cyl(3.2, 3.6, 1.2, 6), 0, 0.6, 0); M.add('hazard', cyl(3.65, 3.65, 0.25, 6, true), 0, 0.15, 0); M.add('metal', cyl(2.2, 2.8, 1.6, 6), 0, 2, 0); M.add('teal', cyl(2.25, 2.25, 0.3, 6), 0, 2.6, 0);
  const legs = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (const [a, b] of legs) beam(M, 'orange', new THREE.Vector3(a * 1.4, 2.8, b * 1.4), new THREE.Vector3(a * 0.45, 15, b * 0.45), 0.13);
  for (let y = 3.6; y < 14.5; y += 1.6) { const k = 1.4 - (y - 2.8) / 12.2 * 0.95, k2 = 1.4 - (y + 1.6 - 2.8) / 12.2 * 0.95;
    for (let i = 0; i < 4; i++) { const [a, b] = legs[[0, 1, 3, 2][i]], [c2, d2] = legs[[0, 1, 3, 2][(i + 1) % 4]]; beam(M, 'metal', new THREE.Vector3(a * k, y, b * k), new THREE.Vector3(c2 * k2, y + 1.6, d2 * k2), 0.05, 4); beam(M, 'metal', new THREE.Vector3(a * k, y, b * k), new THREE.Vector3(c2 * k, y, d2 * k), 0.06, 4); } }
  M.add('dark', cyl(0.5, 0.5, 0.5, 8), 0, 15.2, 0); M.add('glowRed', new THREE.SphereGeometry(0.25, 12, 8), 0, 15.6, 0);
  for (const [y, yaw, s] of [[11.5, 0.4, 1.4], [9, 2.6, 1.1], [13.2, 4.4, 0.9]]) {
    const dish = new THREE.SphereGeometry(s, 20, 8, 0, Math.PI * 2, 0, 0.9); dish.rotateX(Math.PI / 2); M.add('metal', dish, Math.cos(yaw) * 0.9, y, Math.sin(yaw) * 0.9, 0, -yaw + Math.PI / 2, 0);
    M.add('dark', cyl(0.06, 0.06, s * 1.2, 5), Math.cos(yaw) * (0.9 + s * 0.5), y, Math.sin(yaw) * (0.9 + s * 0.5), 0, -yaw, Math.PI / 2); }
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.6, 2.8) })); core.position.y = 5; scene.add(core);
  for (let i = 0; i < 3; i++) M.add('teal', new THREE.TorusGeometry(1.35 + i * 0.18, 0.06, 6, 30), 0, 4.2 + i * 0.8, 0, Math.PI / 2);
  COL.circles.push({ x: 0, z: 0, r: 3.8 });
  // resupply station
  M.add('blue', rbox(1.8, 1.2, 1.2, 0.1), 5.2, 0.6, 3.4, 0, 0.6); M.add('glowCyan', box(1.1, 0.3, 0.05), 5.2 + Math.sin(0.6) * 0.62, 0.85, 3.4 + Math.cos(0.6) * 0.62, 0, 0.6);
  M.add('crate', rbox(1.2, 0.8, 1.0, 0.08), 5.6, 1.6, 3.2, 0, 0.3);
  COL.circles.push({ x: 5.3, z: 3.4, r: 1.2 });
  // ---- prefab modules (white with teal/orange trims, graffiti panels)
  const graffitiMat = (i) => toon('#ffffff', { map: canvasTex(512, 160, (x, w, h) => { x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, w, h); const words = ['ZAP!', 'BUGS?', 'K-7', 'POW', 'HOLD', 'YEAH']; const cols = ['#ff5fd2', '#3fd0ff', '#ffcf2e', '#7cff6b', '#a45dff', '#ff7a2e'];
    graffiti(x, words[i % 6], w * 0.32, h * 0.5, 84, cols[i % 6], -0.08); graffiti(x, words[(i + 3) % 6], w * 0.75, h * 0.48, 60, cols[(i + 2) % 6], 0.1);
    for (let d = 0; d < 14; d++) { x.fillStyle = cols[d % 6]; x.beginPath(); x.arc(Math.random() * w, Math.random() * h, 3 + Math.random() * 6, 0, 7); x.fill(); } }) });
  const panels = [];
  const module = (x, z, yaw, L, H, D, trim, gi) => {
    const c = Math.cos(yaw), s = Math.sin(yaw), P = (lx, ly, lz) => [x + lx * c + lz * s, ly, z - lx * s + lz * c];
    M.add('concrete', box(L + 0.8, 0.4, D + 0.8), ...P(0, 0.2, 0), 0, yaw);
    M.add('metal', rbox(L, H, D, 0.18), ...P(0, 0.4 + H / 2, 0), 0, yaw);
    M.add(trim, box(L + 0.06, 0.35, D + 0.06), ...P(0, 0.4 + H - 0.25, 0), 0, yaw);
    M.add(trim, box(L + 0.06, 0.2, D + 0.06), ...P(0, 0.55, 0), 0, yaw);
    M.add('dark', box(1.2, 2.1, 0.1), ...P(-L / 2 + 1.3, 0.4 + 1.05, D / 2 + 0.07), 0, yaw);
    M.add('glowWarm', box(1.4, 0.5, 0.05), ...P(L * 0.3, 0.4 + H * 0.62, D / 2 + 0.08), 0, yaw);
    M.add('dark', rbox(1.6, 0.8, 1.2, 0.08), ...P(L * 0.25, 0.4 + H + 0.4, 0), 0, yaw);
    M.add('metal', cyl(0.38, 0.38, 0.12, 16), ...P(L * 0.25, 0.4 + H + 0.84, 0), 0, yaw);
    M.add('dark', cyl(0.05, 0.05, 3.4, 5), ...P(-L / 2 + 0.6, 0.4 + H + 1.7, -D / 2 + 0.4));
    M.add('glowRed', new THREE.SphereGeometry(0.12, 8, 6), ...P(-L / 2 + 0.6, 0.4 + H + 3.45, -D / 2 + 0.4));
    M.add('dark', box(1.4, 0.16, 1.1), ...P(-L / 2 + 1.3, 0.25, D / 2 + 0.75), 0, yaw);
    // graffiti panel on the back wall
    const gp = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.8, H * 0.55), graffitiMat(gi)); gp.position.set(...P(0.4, 0.4 + H * 0.45, -D / 2 - 0.02)); gp.rotation.y = yaw + Math.PI; scene.add(gp);
    COL.boxes.push({ x, z, hw: L / 2 + 0.5, hd: D / 2 + 0.5, c, s });
  };
  module(-13.5, -3, 0.35, 9, 3, 3.4, 'teal', 0); module(11, -10.5, -0.75, 8, 3.2, 3.4, 'orange', 1); module(10.5, 11, 0.95, 6.5, 2.7, 3, 'blue', 2); module(-9, 13.5, -0.3, 5.5, 2.6, 3, 'teal', 3);
  // ---- sandbag ring (instanced, chunky) + gates, barriers, tank traps
  const bagG = new RoundedBoxGeometry(0.95, 0.36, 0.56, 3, 0.16); const bp = bagG.attributes.position;
  for (let i = 0; i < bp.count; i++) { const y = bp.getY(i), xx = bp.getX(i); bp.setY(i, y * (1 - 0.25 * Math.pow(Math.abs(xx) / 0.48, 4))); }
  bagG.computeVertexNormals();
  const bags = []; const o = new THREE.Object3D(), R = mulberry(5);
  for (let row = 0; row < 4; row++) { const r = RING + (row === 3 ? 0 : (row % 2 ? 0.28 : -0.28)) * (row < 3 ? 1 : 0), y = 0.18 + row * 0.31; const n = Math.floor(Math.PI * 2 * r / 0.9);
    for (let i = 0; i < n; i++) { const a = (i + (row % 2) * 0.5) / n * Math.PI * 2; if (inGate(a)) continue; for (const off of row < 3 ? [-0.3, 0.3] : [0]) {
      const rr = r + off; o.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr); o.rotation.set((R() - .5) * 0.08, -a + Math.PI / 2 + (R() - .5) * 0.12, (R() - .5) * 0.08); o.scale.set(1, 1, 1); o.updateMatrix(); bags.push(o.matrix.clone()); } } }
  const bagMesh = new THREE.InstancedMesh(bagG, toon('#ffffff'), bags.length);
  bags.forEach((m, i) => { bagMesh.setMatrixAt(i, m); bagMesh.setColorAt(i, new THREE.Color().setHSL(0.1 + R() * 0.03, 0.55, 0.68 + R() * 0.1)); }); bagMesh.castShadow = bagMesh.receiveShadow = true; scene.add(bagMesh); outline(bagMesh, 0.03);
  for (const g of GATES) for (const side of [-1, 1]) {
    const a = g + side * 0.17, x = Math.cos(a) * RING, z = Math.sin(a) * RING;
    M.add('blue', rbox(1.5, 1.8, 1.5, 0.1), x, 0.9, z, 0, -a); M.add('hazard', box(1.56, 0.25, 1.56), x, 1.5, z, 0, -a);
    M.add('dark', cyl(0.1, 0.1, 3.2, 6), x, 1.6, z); M.add(side > 0 ? 'glowRed' : 'glowCyan', new THREE.SphereGeometry(0.18, 10, 6), x, 3.25, z);
  }
  for (let i = 0; i < 34; i++) { const a = i / 34 * Math.PI * 2 + 0.09, r = RING + 5 + (i % 3) * 1.6; if (inGate(a)) continue; const x = Math.cos(a) * r, z = Math.sin(a) * r, y = ground(x, z);
    for (const [rx, rz] of [[0.6, 0.6], [-0.6, 0.6], [0, 0]]) M.add('orange', box(0.2, 2.3, 0.2), x, y + 0.75, z, rx, a, rz === 0 ? 0 : rz);
    M.add('orange', box(2.3, 0.2, 0.2), x, y + 0.75, z, 0, a + 0.8, 0.5); }
  // ---- floodlight towers + bunting between them
  const lights = [], tops = [];
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + k * Math.PI / 2, r = 20.5, x = Math.cos(a) * r, z = Math.sin(a) * r, H = 10;
    for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) beam(M, 'dark', new THREE.Vector3(x + dx * 1.1, 0, z + dz * 1.1), new THREE.Vector3(x + dx * 0.5, H, z + dz * 0.5), 0.1, 5);
    for (let y = 1.5; y < H; y += 2.2) { const k1 = 1.1 - y / H * 0.6, k2 = 1.1 - (y + 2.2) / H * 0.6; for (const [p1, p2] of [[[1, 1], [1, -1]], [[1, -1], [-1, -1]], [[-1, -1], [-1, 1]], [[-1, 1], [1, 1]]]) beam(M, 'metal', new THREE.Vector3(x + p1[0] * k1, y, z + p1[1] * k1), new THREE.Vector3(x + p2[0] * k2, Math.min(H, y + 2.2), z + p2[1] * k2), 0.045, 4); }
    M.add('teal', box(2.4, 0.2, 2.4), x, H, z, 0, -a); M.add('hazard', box(2.45, 0.3, 0.1), x + Math.cos(a) * 1.2, H + 0.25, z + Math.sin(a) * 1.2, 0, -a + Math.PI / 2);
    for (let j = 0; j < 4; j++) { const ox = (j % 2 - 0.5) * 0.9, oy = Math.floor(j / 2) * 0.75 + 0.75; const lx = x + Math.cos(a) * 0.9 - Math.sin(a) * ox, lz = z + Math.sin(a) * 0.9 + Math.cos(a) * ox;
      M.add('dark', rbox(0.7, 0.6, 0.5, 0.08), lx, H + oy, lz, 0.5, -a + Math.PI / 2, 0); M.add('lamp', box(0.56, 0.46, 0.04), lx + Math.cos(a) * 0.27, H + oy - 0.13, lz + Math.sin(a) * 0.27, 0.5, -a + Math.PI / 2, 0); }
    COL.circles.push({ x, z, r: 1.4 }); tops.push(new THREE.Vector3(x, H + 1.9, z));
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(x * 0.95, 0.06, z * 0.95), new THREE.Vector3(x * 0.6 + 1, 0.05, z * 0.6), new THREE.Vector3(x * 0.3, 0.06, z * 0.3 + 1), new THREE.Vector3(Math.cos(a) * 3.3, 0.3, Math.sin(a) * 3.3)]);
    M.add('cable', new THREE.TubeGeometry(curve, 40, 0.08, 5, false));
  }
  // bunting: flag strings from each tower to the mast top
  const flagCols = ['#ff5fd2', '#ffcf2e', '#3fd0ff', '#7cff6b', '#ff7a2e'], flagG = [], flagC = [];
  for (const t of tops) { const top = new THREE.Vector3(0, 14, 0); for (let i = 1; i < 14; i++) { const f = i / 14, p = t.clone().lerp(top, f); p.y -= Math.sin(f * Math.PI) * 2.2; const g = new THREE.BufferGeometry(); const d = top.clone().sub(t).setY(0).normalize();
    const v = [p.x - d.x * 0.25, p.y, p.z - d.z * 0.25, p.x + d.x * 0.25, p.y, p.z + d.z * 0.25, p.x, p.y - 0.55, p.z]; g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals(); flagG.push(g); const cc = new THREE.Color(flagCols[i % 5]); flagC.push(cc, cc, cc); }
    beam(M, 'cable', t, top, 0.02, 4); }
  const fg = mergeGeometries(flagG), fc = new Float32Array(flagC.length * 3); flagC.forEach((c, i) => fc.set([c.r, c.g, c.b], i * 3)); fg.setAttribute('color', new THREE.BufferAttribute(fc, 3));
  scene.add(new THREE.Mesh(fg, toon('#ffffff', { vertexColors: true, side: THREE.DoubleSide })));
  // ---- clutter: crates, barrels, sign
  const crateStack = (x, z, yaw) => { M.add('crate', rbox(1.4, 1, 1, 0.1), x, 0.5, z, 0, yaw); M.add('blue', rbox(1.2, 0.9, 1, 0.1), x + 0.2, 1.45, z, 0, yaw + 0.25); M.add('teal', rbox(1, 0.8, 0.9, 0.1), x - 1.3 * Math.cos(yaw), 0.4, z + 1.3 * Math.sin(yaw), 0, yaw - 0.2); M.add('hazard', box(1.42, 0.14, 1.02), x, 0.82, z, 0, yaw); COL.circles.push({ x, z, r: 1.3 }); };
  const barrels = (x, z) => { for (let i = 0; i < 3; i++) { const bx = x + (i % 2) * 0.7, bz = z + (i > 1 ? 0.65 : 0); M.add(i === 1 ? 'crate' : 'barrel', cyl(0.3, 0.3, 0.9, 14), bx, 0.45, bz); M.add('metal', new THREE.TorusGeometry(0.31, 0.035, 4, 16), bx, 0.25, bz, Math.PI / 2); M.add('metal', new THREE.TorusGeometry(0.31, 0.035, 4, 16), bx, 0.65, bz, Math.PI / 2); } COL.circles.push({ x: x + 0.35, z: z + 0.3, r: 1 }); };
  crateStack(-5.5, 8, 0.4); crateStack(6.5, -4.5, -0.9); crateStack(-16, 6, 1.2); crateStack(17, 2.5, 0.2); crateStack(-6, -15, -0.3);
  barrels(-3, 10.8); barrels(8.4, -7); barrels(-17.5, -9); barrels(15.5, 7.5); barrels(2.5, -16.5);
  const signTex = canvasTex(512, 180, (x, w, h) => { x.fillStyle = '#3a4466'; x.fillRect(0, 0, w, h); x.fillStyle = '#ffcf2e'; x.fillRect(0, 0, w, 16); x.fillRect(0, h - 16, w, 16); graffiti(x, 'KESTREL-7', w / 2, 72, 70, '#3fd0ff'); x.fillStyle = '#fff'; x.font = '900 26px Impact, sans-serif'; x.textAlign = 'center'; x.fillText('NO BUGS BEYOND THIS POINT (PLEASE)', w / 2, 140); });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.4, 0.15), [toon('#3a4466'), toon('#3a4466'), toon('#3a4466'), toon('#3a4466'), new THREE.MeshBasicMaterial({ map: signTex }), toon('#3a4466')]);
  sign.position.set(-5.2, 2.7, RING + 0.8); sign.rotation.y = 0; scene.add(sign); outline(sign, 0.04); M.add('dark', box(0.14, 2.6, 0.14), -6.9, 1.3, RING + 0.75); M.add('dark', box(0.14, 2.6, 0.14), -3.5, 1.3, RING + 0.75);
  // rover parked by the west module
  { const rx = -6.5, rz = -8.5, ry = 0.5, c = Math.cos(ry), s = Math.sin(ry), P = (lx, ly, lz) => [rx + lx * c + lz * s, ly, rz - lx * s + lz * c];
    M.add('orange', rbox(2.2, 0.9, 3.8, 0.25), ...P(0, 1.0, 0), 0, ry); M.add('metal', rbox(1.9, 0.8, 1.6, 0.25), ...P(0, 1.8, -0.4), 0, ry); M.add('glowCyan', box(1.6, 0.35, 0.05), ...P(0, 1.85, 0.42), 0, ry);
    M.add('dark', box(2.3, 0.25, 0.4), ...P(0, 0.7, 1.95), 0, ry); M.add('lamp', box(0.3, 0.15, 0.05), ...P(0.75, 1.15, 1.92), 0, ry); M.add('lamp', box(0.3, 0.15, 0.05), ...P(-0.75, 1.15, 1.92), 0, ry);
    for (const wz of [-1.3, 0, 1.3]) for (const wx of [-1.15, 1.15]) { M.add('dark', cyl(0.48, 0.48, 0.4, 16), ...P(wx, 0.48, wz), 0, ry, Math.PI / 2); M.add('teal', cyl(0.22, 0.22, 0.42, 10), ...P(wx, 0.48, wz), 0, ry, Math.PI / 2); }
    M.add('dark', cyl(0.04, 0.04, 2.2, 5), ...P(0.8, 2.9, -1.4)); M.add('glowRed', new THREE.SphereGeometry(0.1, 8, 6), ...P(0.8, 4.0, -1.4));
    COL.boxes.push({ x: rx, z: rz, hw: 1.4, hd: 2.2, c, s }); }
  // drop pods: capsules with glowing stripes
  for (const [px, pz, t] of [[14.5, -3, 0.2], [-15.5, 10.5, -0.15], [3, 15.5, 0.1]]) { M.add('metal', new THREE.CapsuleGeometry(0.9, 1.6, 6, 14), px, 1.7, pz, t, 0, t); M.add('orange', cyl(0.95, 0.95, 0.3, 16), px, 2.2, pz, t, 0, t); M.add('glowCyan', cyl(0.93, 0.93, 0.08, 16, true), px, 1.4, pz, t, 0, t); M.add('dark', cyl(1.1, 1.3, 0.3, 12), px, 0.15, pz); COL.circles.push({ x: px, z: pz, r: 1.2 }); }
  // ground dish
  { const dish = new THREE.SphereGeometry(1.8, 24, 10, 0, Math.PI * 2, 0, 1.0); dish.rotateX(-0.9); M.add('metal', dish, -14, 3.2, -12); M.add('dark', cyl(0.15, 0.3, 2.6, 8), -14, 1.3, -12); M.add('orange', cyl(0.06, 0.06, 1.6, 6), -14, 3.4, -11.2, -0.9); M.add('glowRed', new THREE.SphereGeometry(0.12, 8, 6), -14, 4.1, -10.6); COL.circles.push({ x: -14, z: -12, r: 1 }); }
  const meshes = M.build(scene, mats, { ol: 0.035 });
  return { mats, core, lights, shafts: [], meshes, bagMesh, sign };
}

// ------------------------------------------------------------------ hive mound (shared geometry, glow vents)
export function hiveGeometry() {
  const g = new THREE.IcosahedronGeometry(5, 4), p = g.attributes.position, glow = new Float32Array(p.count), col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i), n = sx.noise3d(v.x * 0.35, v.y * 0.35, v.z * 0.35), n2 = sx.noise3d(v.x * 1.1, v.y * 1.1, v.z * 1.1);
    v.multiplyScalar(1 + 0.2 * n + 0.05 * n2); v.y = v.y > 0 ? v.y * 0.9 : v.y * 0.3; p.setXYZ(i, v.x, v.y, v.z);
    const vent = Math.max(0, n2 - 0.3) * 3.5; glow[i] = Math.min(1, vent); const c = new THREE.Color('#a24bd6').lerp(new THREE.Color('#ff6fae'), 0.5 + 0.5 * n); col.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute('aGlow', new THREE.BufferAttribute(glow, 1)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
}

// ------------------------------------------------------------------ dropship (extraction)
export function buildDropship() {
  const G = new THREE.Group(), M = new Merger();
  const hull = toon('#f4f1ea'), dark = toon('#3a4466'), trim = toon('#ff7a2e');
  const glowE = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 2.2, 3) }), glowR = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.4, 0.3) });
  M.add('hull', rbox(4.2, 3, 13, 0.6), 0, 0, 0); M.add('hull', rbox(3.4, 2.2, 4, 0.5), 0, 0.5, 7.5, 0.25); M.add('dark', rbox(2.6, 0.8, 2, 0.3), 0, 1.2, 8.3, 0.35); M.add('trim', box(4.25, 0.5, 8), 0, 0.4, 0);
  for (const s of [-1, 1]) { M.add('hull', rbox(7, 0.5, 4, 0.2), s * 5, 0.6, -1.5, 0, 0, s * -0.08); M.add('dark', cyl(1.2, 1.4, 3.2, 16), s * 8.4, 0.4, -1.5, Math.PI / 2); M.add('glowE', cyl(1.05, 1.05, 0.1, 16), s * 8.4, 0.4, -3.15, Math.PI / 2); M.add('trim', rbox(0.4, 3, 3, 0.15), s * 1.9, 2.2, -5.5, 0, 0, s * 0.35); M.add('glowR', new THREE.SphereGeometry(0.2, 8, 6), s * 8.4, 1.7, -1.5); }
  M.add('dark', box(3.6, 0.2, 3.6), 0, -1.5, -5.6, -0.5);
  M.build(G, { hull, dark, trim, glowE, glowR }, { cast: true, receive: false, ol: 0.06 });
  const thrust = []; for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.ConeGeometry(1, 6, 16, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 3, 6), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })); f.position.set(s * 8.4, -3.4, -1.5); f.rotation.x = Math.PI; G.add(f); thrust.push(f); }
  G.thrust = thrust; return G;
}
