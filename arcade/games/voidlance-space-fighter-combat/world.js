// Voidlance world: a procedural nebula skybox baked once into an HDR cube map (also used for reflections), a ringed
// gas giant with atmosphere glow and ring shadow, a sun with lens flare, instanced PBR asteroid fields and speed dust.
import * as THREE from './kit/three.module.min.js';
import { Lensflare, LensflareElement } from './kit/addons/objects/Lensflare.js';
import { SimplexNoise } from './kit/addons/math/SimplexNoise.js';
import { mergeVertices } from './kit/addons/utils/BufferGeometryUtils.js';
import { procTex } from './kit/cine.js';
import { glowTex } from './fx.js';
import { GRAD } from './models.js';

export const SUN_DIR = new THREE.Vector3(0.8, 0.25, -0.45).normalize();
export const PLANET_DIR = new THREE.Vector3(-0.35, -0.08, -0.93).normalize();

const NOISE = `
float h3(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float a = .5, s = 0.; for (int i = 0; i < 6; i++){ s += a * vn(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= .5; } return s; }
`;

const SKY_F = `${NOISE}
uniform vec3 uSun; uniform float uSeed; varying vec3 vDir;
vec3 stars(vec3 d, float sc, float th){ vec3 p = d * sc, c = floor(p), f = fract(p); float h = h3(c + uSeed);
  if (h < th) return vec3(0.); vec3 o = vec3(h3(c + 3.1), h3(c + 7.7), h3(c + 1.3)) * .7 + .15; float r = length(f - o);
  float b = exp(-r * r * 90.) * (h - th) / (1. - th) * 14.; vec3 col = mix(vec3(.7, .8, 1.25), vec3(1.25, .9, .7), h3(c + 9.));
  return col * b; }
void main(){ vec3 d = normalize(vDir); vec3 q = d * 1.6 + uSeed * .01;
  float w = fbm(q * 1.4);
  float n = fbm(q * 2.1 + w * 2.2);
  float m = fbm(q * 1.1 + vec3(5.2, 1.3, 7.7));
  float band = exp(-pow(dot(d, normalize(vec3(.25, 1., .4))) * 2.1, 2.));
  vec3 cyan = vec3(.15, .75, 1.), pink = vec3(1., .28, .72), vio = vec3(.45, .22, 1.), peach = vec3(1., .55, .35);
  vec3 neb = mix(mix(vio, cyan, smoothstep(.35, .65, m)), pink, smoothstep(.5, .78, w));
  neb = mix(neb, peach, smoothstep(.62, .85, n) * .5);
  float dens = smoothstep(.25, .85, n);
  float dust = smoothstep(.5, .75, fbm(q * 3.3 + vec3(3., 1., 2.)));
  neb *= dens * (.35 + .9 * band) * (1. - .55 * dust) * .9;
  float sd = max(dot(d, uSun), 0.);
  neb += vec3(1., .65, .35) * pow(sd, 5.) * .7 + vec3(1., .85, .6) * pow(sd, 40.) * .9;
  vec3 base = mix(vec3(.02, .03, .12), vec3(.07, .03, .18), smoothstep(-.6, .6, d.y)) + vec3(.06, .02, .1) * band;
  vec3 col = base + neb;
  vec3 st = stars(d, 260., .965) + stars(d, 120., .982) * 1.6 + stars(d, 520., .93) * .4;
  col += st * (1. - .5 * dust);
  gl_FragColor = vec4(col, 1.); }`;

export function bakeSky(renderer, seed = 0, size = 1024) {
  const sc = new THREE.Scene();
  const m = new THREE.Mesh(new THREE.SphereGeometry(5, 64, 32), new THREE.ShaderMaterial({
    uniforms: { uSun: { value: SUN_DIR }, uSeed: { value: seed % 97 } }, side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }', fragmentShader: SKY_F }));
  sc.add(m);
  const rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  const cc = new THREE.CubeCamera(0.1, 20, rt); sc.add(cc);
  const tm = renderer.toneMapping; renderer.toneMapping = THREE.NoToneMapping; cc.update(renderer, sc); renderer.toneMapping = tm;
  m.geometry.dispose(); m.material.dispose();
  return rt;
}

// ---------------------------------------------------------------- planet + rings + sun (follow the camera: "at infinity")
const PLANET_V = `varying vec3 vObj; varying vec3 vWN; varying vec3 vWP; void main(){ vObj = position; vWN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const PLANET_F = `${NOISE}
uniform vec3 uSun; uniform float uR; varying vec3 vObj; varying vec3 vWN; varying vec3 vWP;
void main(){ vec3 p = normalize(vObj); vec3 n = normalize(vWN);
  float turb = fbm(p * 4. + vec3(0., p.y * 3., 0.)); float lat = p.y + (turb - .5) * .16 + sin(p.x * 9. + p.z * 6.) * .01;
  float b = sin(lat * 26.) * .5 + .5, b2 = sin(lat * 61. + turb * 4.) * .5 + .5;
  vec3 c1 = vec3(1., .62, .5), c2 = vec3(.95, .36, .5), c3 = vec3(1., .92, .78), c4 = vec3(.45, .85, .9);
  vec3 alb = mix(mix(c2, c1, b), c3, smoothstep(.6, 1., b2) * .55); alb = mix(alb, c4, smoothstep(.55, .9, abs(lat)) * .6);
  float storm = smoothstep(.12, .0, length(vec2(p.x + .35, (p.y + .22) * 1.8)) - fbm(p * 12.) * .05); alb = mix(alb, vec3(1., .85, .4), storm * .9);
  float ndl = dot(n, uSun); float diff = .28 + .72 * smoothstep(-.25, .45, ndl); diff = floor(diff * 4.) / 4. * .35 + diff * .65;
  vec3 V = normalize(cameraPosition - vWP); float fr = pow(1. - max(dot(n, V), 0.), 2.6);
  vec3 col = alb * diff * vec3(1.5, 1.35, 1.25) * .52;
  col += vec3(.45, .9, 1.) * fr * smoothstep(-.6, .45, ndl) * .8;
  col += vec3(1., .45, .2) * pow(fr, 1.5) * smoothstep(-.2, .1, ndl) * smoothstep(.35, -.1, ndl) * 1.4;
  gl_FragColor = vec4(col, 1.); }`;
const ATMO_F = `uniform vec3 uSun; varying vec3 vWN; varying vec3 vWP; varying vec3 vObj;
void main(){ vec3 n = normalize(vWN); vec3 V = normalize(cameraPosition - vWP); float r = 1. - abs(dot(n, V)); float i = pow(smoothstep(.0, 1., r), 5.) * 2.2;
  float s = smoothstep(-.4, .5, dot(n, uSun)); gl_FragColor = vec4(mix(vec3(.9, .3, 1.), vec3(.4, 1., 1.3), s) * i * (.2 + .5 * s), 1.); }`;
const RING_F = `${NOISE}
uniform vec3 uSun; uniform vec3 uC; uniform float uR; varying vec3 vObj; varying vec3 vWP; varying vec3 vWN;
void main(){ float r = length(vObj.xy) / uR; float t = (r - 1.25) / 1.15;
  float bands = .55 + .45 * sin(r * 90.) * sin(r * 37. + 1.) ; float gap = smoothstep(.0, .02, abs(t - .58) - .025) * smoothstep(0., .03, t) * smoothstep(1., .9, t);
  float dens = clamp(bands * gap * (.55 + .45 * vn(vec3(r * 140., 0., 0.))), 0., 1.);
  vec3 toC = uC - vWP; float tc = dot(toC, uSun); float sh = 1.; if (tc > 0.) { float dd = length(toC - uSun * tc); sh = smoothstep(uR * .97, uR * 1.03, dd); }
  vec3 V = normalize(cameraPosition - vWP); float fwd = pow(max(dot(-V, uSun), 0.), 6.);
  vec3 col = mix(vec3(.6, .45, .95), vec3(.95, .7, .85), bands) * (.25 + .75 * sh) * (1. + fwd * 1.5);
  gl_FragColor = vec4(col * dens * .6, dens * .55); }`;

export function makeSkyBodies() {
  const g = new THREE.Group(), R = 900, D = 3500;
  const pc = PLANET_DIR.clone().multiplyScalar(D);
  const u = { uSun: { value: SUN_DIR }, uR: { value: R }, uC: { value: new THREE.Vector3() } };
  const planet = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), new THREE.ShaderMaterial({ uniforms: u, vertexShader: PLANET_V, fragmentShader: PLANET_F }));
  planet.position.copy(pc); planet.rotation.set(0.25, 0.6, 0.18);
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.045, 64, 40), new THREE.ShaderMaterial({ uniforms: u, vertexShader: PLANET_V, fragmentShader: ATMO_F, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  atmo.position.copy(pc);
  const ring = new THREE.Mesh(new THREE.RingGeometry(R * 1.25, R * 2.4, 256, 1), new THREE.ShaderMaterial({ uniforms: u, vertexShader: PLANET_V, fragmentShader: RING_F, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  ring.position.copy(pc); ring.rotation.set(-Math.PI / 2 + 0.32, 0.15, 0.42);
  planet.renderOrder = -3; atmo.renderOrder = -2; ring.renderOrder = -1;
  g.add(planet, atmo, ring);
  // sun: hot core sprite + wide glow + lens flare
  const sunPos = SUN_DIR.clone().multiplyScalar(5200);
  const gt = glowTex('glow'), st = glowTex('star');
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, color: new THREE.Color(5, 4.2, 3.4), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  core.scale.setScalar(260); core.position.copy(sunPos);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, color: new THREE.Color(0.9, 0.5, 0.35), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true, opacity: 0.3 }));
  halo.scale.setScalar(1300); halo.position.copy(sunPos);
  const rays = new THREE.Sprite(new THREE.SpriteMaterial({ map: st, color: new THREE.Color(1.1, 0.9, 0.75), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  rays.scale.setScalar(1500); rays.position.copy(sunPos);
  g.add(halo, core, rays);
  const lf = new Lensflare(), ring2 = glowTex('ring'), hex = hexTex();
  lf.addElement(new LensflareElement(gt, 300, 0, new THREE.Color(0.7, 0.6, 0.5)));
  lf.addElement(new LensflareElement(hex, 70, 0.35, new THREE.Color(0.3, 0.6, 1)));
  lf.addElement(new LensflareElement(hex, 110, 0.55, new THREE.Color(0.6, 0.35, 1)));
  lf.addElement(new LensflareElement(ring2, 120, 0.75, new THREE.Color(0.15, 0.4, 0.45)));
  lf.addElement(new LensflareElement(hex, 50, 0.9, new THREE.Color(1, 0.55, 0.3)));
  lf.addElement(new LensflareElement(ring2, 160, 1.15, new THREE.Color(0.12, 0.2, 0.4)));
  lf.position.copy(sunPos); g.add(lf);
  for (const o of [planet, atmo, ring, core, halo, rays]) o.frustumCulled = false;
  u.uC.value.copy(pc);
  g.userData = { u, pc, rays };
  return g;
}
function hexTex() {
  const n = 128, c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d');
  x.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; x.lineTo(n / 2 + Math.cos(a) * n * 0.45, n / 2 + Math.sin(a) * n * 0.45); } x.closePath();
  const g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); g.addColorStop(0, 'rgba(255,255,255,.25)'); g.addColorStop(0.8, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,.1)');
  x.fillStyle = g; x.fill(); const t = new THREE.CanvasTexture(c); return t;
}

// ---------------------------------------------------------------- asteroids
const simplex = new SimplexNoise();
function rockGeo(seed, detail) {
  let g = new THREE.IcosahedronGeometry(1, detail); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), s = seed * 13.7;
  const sq = [0.75 + Math.random() * 0.5, 0.65 + Math.random() * 0.4, 0.8 + Math.random() * 0.5];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    let r = 1 + 0.32 * simplex.noise3d(x * 1.1 + s, y * 1.1, z * 1.1) + 0.12 * simplex.noise3d(x * 3 + s, y * 3, z * 3) + 0.045 * simplex.noise3d(x * 8, y * 8 + s, z * 8);
    // craters
    const cr = simplex.noise3d(x * 2.3 - s, y * 2.3, z * 2.3); if (cr > 0.45) r -= (cr - 0.45) * 0.5;
    p.setXYZ(i, x * r * sq[0], y * r * sq[1], z * r * sq[2]);
    const shade = 0.55 + (r - 1) * 1.4 + 0.18 * simplex.noise3d(x * 5, y * 5, z * 5 + s);
    const warm = 0.5 + 0.5 * simplex.noise3d(x * 0.8 + 40, y * 0.8, z * 0.8);
    const sh2 = 0.75 + shade * 0.45; col[i * 3] = sh2 * (0.95 + warm * 0.12); col[i * 3 + 1] = sh2 * (0.8 + warm * 0.08); col[i * 3 + 2] = sh2 * (0.95 - warm * 0.25);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}
export function rockMaterial() {
  const tex = procTex('rock', { size: 512 });
  const m = new THREE.MeshToonMaterial({ color: 0xc89a8a, vertexColors: true, gradientMap: GRAD });
  m.onBeforeCompile = sh => {
    sh.uniforms.uRock = { value: tex };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP; varying vec3 vON;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position; vON = normal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uRock; varying vec3 vOP; varying vec3 vON;')
      .replace('#include <map_fragment>', `vec3 bw = pow(abs(normalize(vON)), vec3(4.)); bw /= dot(bw, vec3(1.));
        vec3 tx = texture2D(uRock, vOP.yz * .7).rgb * bw.x + texture2D(uRock, vOP.zx * .7).rgb * bw.y + texture2D(uRock, vOP.xy * .7).rgb * bw.z;
        vec3 tx2 = texture2D(uRock, vOP.yz * 2.3).rgb * bw.x + texture2D(uRock, vOP.zx * 2.3).rgb * bw.y + texture2D(uRock, vOP.xy * 2.3).rgb * bw.z;
        diffuseColor.rgb *= mix(vec3(1.), tx * tx2 * 2.6, .55);`);
  };
  return m;
}

export class Asteroids {
  constructor(scene, lite) {
    this.mat = rockMaterial(); this.meshes = []; this.rocks = []; this.per = lite ? 70 : 120;
    for (let v = 0; v < 4; v++) {
      const im = new THREE.InstancedMesh(rockGeo(v + 1, v === 3 ? 5 : 3), this.mat, this.per); im.count = 0; im.frustumCulled = false; im.castShadow = false; scene.add(im); this.meshes.push(im);
    }
    this.M = new THREE.Matrix4(); this.Q = new THREE.Quaternion(); this.S = new THREE.Vector3();
    const cg = new THREE.OctahedronGeometry(1, 0); cg.scale(0.45, 1.4, 0.45); cg.translate(0, 0.9, 0);
    this.cry = new THREE.InstancedMesh(cg, new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }), lite ? 160 : 320); this.cry.count = 0; this.cry.frustumCulled = false; scene.add(this.cry);
    this.cryOut = new THREE.InstancedMesh(cg, new THREE.MeshBasicMaterial({ color: 0x1a1340, side: THREE.BackSide }), lite ? 160 : 320); this.cryOut.count = 0; this.cryOut.frustumCulled = false; scene.add(this.cryOut);
  }
  // a field: belt of rocks around `center` (a disc/torus), seeded
  build(rnd, center, { count = 300, radius = 700, thick = 160, big = 6, clear = 120 } = {}) {
    this.rocks = []; const per = this.per;
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < count; i++) {
      const v = i % 3; if (counts[v] >= per) continue;
      const a = rnd() * Math.PI * 2, rr = radius * Math.sqrt(rnd()), p = new THREE.Vector3(Math.cos(a) * rr, (rnd() - 0.5) * thick * (1 - rr / radius * 0.5), Math.sin(a) * rr).add(center);
      if (p.distanceTo(center) < clear) continue;
      const s = 1.5 + Math.pow(rnd(), 3.2) * 24;
      this.rocks.push({ v, i: counts[v]++, p, s, r: s * 1.05, q: new THREE.Quaternion().random(), ax: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(), w: (rnd() - 0.5) * 0.5 / Math.sqrt(s) });
    }
    for (let i = 0; i < big; i++) {     // hero rocks (detail mesh)
      const a = rnd() * Math.PI * 2, rr = radius * (0.35 + rnd() * 0.75), p = new THREE.Vector3(Math.cos(a) * rr, (rnd() - 0.5) * thick * 2, Math.sin(a) * rr).add(center);
      const s = 40 + rnd() * 70; this.rocks.push({ v: 3, i: counts[3]++, p, s, r: s * 1.0, q: new THREE.Quaternion().random(), ax: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(), w: (rnd() - 0.5) * 0.04 });
    }
    this.meshes.forEach((m, k) => (m.count = counts[k]));
    // glowing crystal clusters on some rocks (those rocks hold still so the crystals stay put)
    const pal = [[0.25, 1.3, 1.5], [1.5, 0.3, 1.1], [1.4, 1.1, 0.25], [0.8, 0.4, 1.6]], C = new THREE.Color(), up = new THREE.Vector3(0, 1, 0), n = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), M = new THREE.Matrix4(), O = new THREE.Matrix4();
    let ci = 0; const max = this.cry.instanceMatrix.count;
    for (const r of this.rocks) {
      if (r.s < 5 || rnd() > (r.v === 3 ? 0.9 : 0.3) || ci >= max - 8) continue;
      r.w = 0; const col = pal[(rnd() * pal.length) | 0], k = r.v === 3 ? 8 : 2 + ((rnd() * 4) | 0);
      const base = new THREE.Vector3().randomDirection();
      for (let j = 0; j < k && ci < max; j++) {
        n.copy(base).add(new THREE.Vector3().randomDirection().multiplyScalar(0.45)).normalize();
        q.setFromUnitVectors(up, n); const len = r.s * (0.18 + rnd() * 0.25);
        M.compose(n.clone().multiplyScalar(r.s * 0.78).add(r.p), q, sc.set(len * 0.7, len, len * 0.7));
        this.cry.setMatrixAt(ci, M); O.compose(n.clone().multiplyScalar(r.s * 0.78).add(r.p), q, sc.multiplyScalar(1.12)); this.cryOut.setMatrixAt(ci, O);
        C.setRGB(col[0] * (0.7 + rnd() * 0.5), col[1] * (0.7 + rnd() * 0.5), col[2] * (0.7 + rnd() * 0.5)); this.cry.setColorAt(ci, C); ci++;
      }
    }
    this.cry.count = this.cryOut.count = ci; this.cry.instanceMatrix.needsUpdate = this.cryOut.instanceMatrix.needsUpdate = true; if (this.cry.instanceColor) this.cry.instanceColor.needsUpdate = true;
    this.update(0, true);
  }
  carve(p, r) {
    for (const k of this.rocks) if (k.p.distanceTo(p) < r + k.r) { k.s = 0.0001; k.r = 0; }
    const M = new THREE.Matrix4(), v = new THREE.Vector3(), Z = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.cry.count; i++) { this.cry.getMatrixAt(i, M); v.setFromMatrixPosition(M); if (v.distanceTo(p) < r + 120) { this.cry.setMatrixAt(i, Z); this.cryOut.setMatrixAt(i, Z); } }
    this.cry.instanceMatrix.needsUpdate = this.cryOut.instanceMatrix.needsUpdate = true; this.update(0, true);
  }
  clear() { this.rocks = []; this.meshes.forEach(m => (m.count = 0)); this.cry.count = this.cryOut.count = 0; }
  update(dt, all = false) {
    const { M, Q, S } = this; const dirty = [false, false, false, false];
    for (const r of this.rocks) {
      if (!all && r.w === 0) continue;
      Q.setFromAxisAngle(r.ax, r.w * dt); r.q.premultiply(Q); S.setScalar(r.s); M.compose(r.p, r.q, S); this.meshes[r.v].setMatrixAt(r.i, M); dirty[r.v] = true;
    }
    this.meshes.forEach((m, k) => { if (dirty[k]) m.instanceMatrix.needsUpdate = true; });
  }
}

// ---------------------------------------------------------------- speed dust: short streaks around the camera
export class Dust {
  constructor(scene, n = 420) {
    this.n = n; this.R = 90; this.p = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) this.p[i] = (Math.random() - 0.5) * 2 * this.R;
    const g = new THREE.BufferGeometry(); this.pos = new Float32Array(n * 6); this.col = new Float32Array(n * 6);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.lines.frustumCulled = false; scene.add(this.lines); this.g = g;
  }
  update(cam, vel, boost) {
    const R = this.R, D = 2 * R, k = 0.03 + boost * 0.05, cx = cam.x, cy = cam.y, cz = cam.z;
    for (let i = 0; i < this.n; i++) {
      const i3 = i * 3, i6 = i * 6;
      let x = this.p[i3] - cx, y = this.p[i3 + 1] - cy, z = this.p[i3 + 2] - cz;
      x = ((x + R) % D + D) % D - R; y = ((y + R) % D + D) % D - R; z = ((z + R) % D + D) % D - R;
      const hx = cx + x, hy = cy + y, hz = cz + z;
      this.pos[i6] = hx; this.pos[i6 + 1] = hy; this.pos[i6 + 2] = hz;
      this.pos[i6 + 3] = hx - vel.x * k - 0.05; this.pos[i6 + 4] = hy - vel.y * k; this.pos[i6 + 5] = hz - vel.z * k;
      const d = Math.sqrt(x * x + y * y + z * z) / R, b = Math.max(0, 1 - d) * (0.35 + boost * 0.8);
      this.col[i6] = this.col[i6 + 3] = b * 0.7; this.col[i6 + 1] = this.col[i6 + 4] = b * 0.85; this.col[i6 + 2] = this.col[i6 + 5] = b;
      this.col[i6 + 3] *= 0.1; this.col[i6 + 4] *= 0.1; this.col[i6 + 5] *= 0.1;
    }
    this.g.attributes.position.needsUpdate = true; this.g.attributes.color.needsUpdate = true;
  }
}
