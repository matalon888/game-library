// Ringbreaker world: procedural textures, shared PBR materials, a merging level builder (one draw call per material),
// sci-fi props (crates, consoles, pipes, cables, dropship, reactor, planters, cryo pods...), sliding doors, and the
// space backdrop: star field, a shader Earth with clouds, city lights and atmosphere, the sun and the station ring.
import { THREE, procTex } from './kit/cine.js';
import { mergeGeometries } from './kit/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from './kit/addons/geometries/RoundedBoxGeometry.js';

const TAU = Math.PI * 2;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const R = (a, b) => a + Math.random() * (b - a);
function tex(c, rep = 1) { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.repeat.set(rep, rep); return t; }
function grain(x, n, a = 0.05) { for (let i = 0; i < n * 5; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '0,0,0'},${R(0.01, a)})`; const s = R(1, 4); x.fillRect(R(0, n), R(0, n), s, s); } }

// ---------------------------------------------------------------- textures
function wallTex() {
  // clean bright panels (tinted by the material colour), soft seams, a few stencils
  const n = 512, [c, x] = mk(n, n); x.fillStyle = '#f3f4f6'; x.fillRect(0, 0, n, n); grain(x, n, 0.025);
  const panel = (px, py, w, h) => {
    x.fillStyle = 'rgba(40,50,70,.22)'; x.fillRect(px, py, w, h);
    const g = x.createLinearGradient(px, py, px, py + h); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e4e7ec'); x.fillStyle = g; x.fillRect(px + 3, py + 3, w - 6, h - 6);
    x.fillStyle = 'rgba(255,255,255,.9)'; x.fillRect(px + 3, py + 3, w - 6, 3); x.fillStyle = 'rgba(30,40,60,.12)'; x.fillRect(px + 3, py + h - 7, w - 6, 4);
    x.fillStyle = 'rgba(30,40,60,.25)'; for (const [a, b] of [[12, 12], [w - 12, 12], [12, h - 12], [w - 12, h - 12]]) { x.beginPath(); x.arc(px + a, py + b, 4, 0, TAU); x.fill(); }
  };
  panel(0, 0, 256, 128); panel(256, 0, 256, 128); panel(0, 128, 160, 256); panel(160, 128, 192, 256); panel(352, 128, 160, 256); panel(0, 384, 512, 128);
  x.fillStyle = 'rgba(30,40,60,.28)'; for (let i = 0; i < 8; i++) { x.beginPath(); x.roundRect(196, 176 + i * 18, 120, 8, 4); x.fill(); }
  x.fillStyle = 'rgba(30,40,60,.5)'; x.font = '900 26px "Arial Black", sans-serif'; x.fillText((Math.random() * 9 + 1 | 0) + '-' + String.fromCharCode(65 + Math.random() * 6 | 0), 30, 176);
  const g = x.createLinearGradient(0, 430, 0, 512); g.addColorStop(0, 'rgba(40,50,70,0)'); g.addColorStop(1, 'rgba(40,50,70,.16)'); x.fillStyle = g; x.fillRect(0, 430, n, 82);
  return c;
}
function floorTex() {
  const n = 512, [c, x] = mk(n, n); x.fillStyle = '#e9ecf0'; x.fillRect(0, 0, n, n); grain(x, n, 0.03);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const px = i * 128, py = j * 128; x.fillStyle = (i + j) % 2 ? '#f6f7f9' : '#dfe3e9'; x.fillRect(px + 3, py + 3, 122, 122);
    x.fillStyle = 'rgba(30,40,60,.25)'; x.fillRect(px, py, 128, 3); x.fillRect(px, py, 3, 128);
    x.fillStyle = 'rgba(30,40,60,.18)'; for (const [a, b] of [[12, 12], [116, 12], [12, 116], [116, 116]]) { x.beginPath(); x.arc(px + a, py + b, 3.5, 0, TAU); x.fill(); }
  }
  x.fillStyle = 'rgba(30,40,60,.15)'; for (let a = 0; a < 5; a++) { x.beginPath(); x.roundRect(150, 160 + a * 22, 90, 9, 4); x.fill(); }
  return c;
}
// graffiti / sticker atlas (4 x 2 cells), drawn in code: bubble tags, arrows, the crew logo, warning stickers
export function graffitiTex() {
  const [c, x] = mk(1024, 512), cell = (i) => [(i % 4) * 256, Math.floor(i / 4) * 256];
  const bubble = (t, px, py, size, fill, stroke, rot = -0.12) => { x.save(); x.translate(px, py); x.rotate(rot); x.font = `900 ${size}px "Arial Black", Impact, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    x.lineWidth = size * 0.32; x.strokeStyle = '#1b1530'; x.strokeText(t, 0, 0); x.lineWidth = size * 0.16; x.strokeStyle = stroke; x.strokeText(t, 0, 0); const g = x.createLinearGradient(0, -size / 2, 0, size / 2); g.addColorStop(0, '#fff'); g.addColorStop(0.35, fill); g.addColorStop(1, fill); x.fillStyle = g; x.fillText(t, 0, 0); x.restore(); };
  // 0: tag
  { const [px, py] = cell(0); for (let i = 0; i < 18; i++) { x.fillStyle = `hsla(${300 + i * 4},90%,60%,.5)`; x.beginPath(); x.arc(px + 30 + Math.random() * 200, py + 60 + Math.random() * 140, 4 + Math.random() * 10, 0, TAU); x.fill(); } bubble('ZAP!', px + 128, py + 128, 88, '#ff3fa4', '#ffe14a'); }
  // 1: arrow
  { const [px, py] = cell(1); x.save(); x.translate(px + 128, py + 128); x.lineJoin = 'round'; x.beginPath(); x.moveTo(-100, -34); x.lineTo(30, -34); x.lineTo(30, -80); x.lineTo(110, 0); x.lineTo(30, 80); x.lineTo(30, 34); x.lineTo(-100, 34); x.closePath();
    x.lineWidth = 18; x.strokeStyle = '#1b1530'; x.stroke(); x.fillStyle = '#ffd23a'; x.fill(); x.lineWidth = 6; x.strokeStyle = '#fff'; x.stroke(); x.restore(); }
  // 2: crew logo
  { const [px, py] = cell(2); x.save(); x.translate(px + 128, py + 128); x.fillStyle = '#1b1530'; x.beginPath(); x.arc(0, 0, 112, 0, TAU); x.fill(); x.fillStyle = '#18c8ff'; x.beginPath(); x.arc(0, 0, 100, 0, TAU); x.fill();
    x.strokeStyle = '#fff'; x.lineWidth = 14; x.beginPath(); x.ellipse(0, 0, 92, 34, -0.4, 0, TAU); x.stroke(); x.fillStyle = '#ffd23a'; x.beginPath(); x.arc(0, 0, 40, 0, TAU); x.fill(); x.restore(); bubble('RB', px + 128, py + 132, 64, '#ff5a2a', '#fff', 0); }
  // 3: robot skull warning
  { const [px, py] = cell(3); x.fillStyle = '#ffd23a'; x.beginPath(); x.moveTo(px + 128, py + 20); x.lineTo(px + 240, py + 225); x.lineTo(px + 16, py + 225); x.closePath(); x.fill(); x.lineWidth = 12; x.strokeStyle = '#1b1530'; x.stroke();
    x.fillStyle = '#1b1530'; x.beginPath(); x.roundRect(px + 88, py + 100, 80, 70, 16); x.fill(); x.fillStyle = '#ff3a3a'; x.beginPath(); x.arc(px + 110, py + 133, 11, 0, TAU); x.arc(px + 146, py + 133, 11, 0, TAU); x.fill(); x.fillStyle = '#1b1530'; x.fillRect(px + 124, py + 76, 8, 26); }
  // 4: splat
  { const [px, py] = cell(4); x.fillStyle = '#7b4bff'; x.beginPath(); for (let i = 0; i < 28; i++) { const a = i / 28 * TAU, r = i % 2 ? 60 + Math.random() * 20 : 95 + Math.random() * 25; x.lineTo(px + 128 + Math.cos(a) * r, py + 128 + Math.sin(a) * r); } x.fill(); for (let i = 0; i < 10; i++) { x.beginPath(); x.arc(px + 128 + (Math.random() - .5) * 230, py + 128 + (Math.random() - .5) * 230, 5 + Math.random() * 9, 0, TAU); x.fill(); } bubble('GO', px + 128, py + 128, 70, '#5df2ff', '#fff', 0.1); }
  // 5: "BOT FREE ZONE" sticker
  { const [px, py] = cell(5); x.fillStyle = '#fff'; x.beginPath(); x.roundRect(px + 14, py + 60, 228, 136, 26); x.fill(); x.lineWidth = 10; x.strokeStyle = '#1b1530'; x.stroke(); x.fillStyle = '#ff3a6e'; x.beginPath(); x.roundRect(px + 26, py + 72, 204, 50, 14); x.fill();
    x.fillStyle = '#fff'; x.font = '900 30px "Arial Black", sans-serif'; x.textAlign = 'center'; x.fillText('NO BOTS', px + 128, py + 108); x.fillStyle = '#1b1530'; x.font = '900 24px "Arial Black", sans-serif'; x.fillText('BEYOND THIS', px + 128, py + 152); x.fillText('POINT  :)', px + 128, py + 182); x.textAlign = 'left'; }
  // 6: stars + smiley
  { const [px, py] = cell(6); bubble('★', px + 70, py + 80, 90, '#ffd23a', '#fff', 0.2); bubble('☺', px + 170, py + 160, 110, '#4dff9a', '#fff', -0.2); }
  // 7: stripes tag
  { const [px, py] = cell(7); bubble('WOW', px + 128, py + 128, 80, '#ff8a1a', '#5df2ff', 0.15); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function hazardTex() {
  const [c, x] = mk(256, 64); x.fillStyle = '#e0a810'; x.fillRect(0, 0, 256, 64); x.fillStyle = '#16181b';
  for (let i = -2; i < 12; i++) { x.beginPath(); x.moveTo(i * 32, 64); x.lineTo(i * 32 + 16, 64); x.lineTo(i * 32 + 48, 0); x.lineTo(i * 32 + 32, 0); x.fill(); }
  grain(x, 256, 0.12); return c;
}
function crateTex() {
  const n = 256, [c, x] = mk(n, n); x.fillStyle = '#f1f2f4'; x.fillRect(0, 0, n, n); grain(x, n, 0.03);
  x.strokeStyle = 'rgba(30,30,50,.55)'; x.lineWidth = 12; x.strokeRect(8, 8, n - 16, n - 16); x.lineWidth = 4; x.strokeRect(26, 26, n - 52, n - 52);
  x.strokeStyle = 'rgba(30,30,50,.25)'; x.lineWidth = 10; x.beginPath(); x.moveTo(30, 30); x.lineTo(n - 30, n - 30); x.stroke();
  x.fillStyle = 'rgba(20,20,40,.8)'; x.font = 'bold 34px monospace'; x.fillText('RB-' + (Math.random() * 900 + 100 | 0), 50, 140);
  x.fillStyle = '#e0a810'; x.fillRect(24, n - 52, n - 48, 14);
  return c;
}
function screenTex(hue = 190) {
  const [c, x] = mk(256, 160); x.fillStyle = '#02070c'; x.fillRect(0, 0, 256, 160);
  const col = `hsl(${hue},90%,62%)`; x.strokeStyle = col; x.fillStyle = col; x.lineWidth = 2; x.globalAlpha = 0.9;
  x.beginPath(); for (let i = 0; i < 120; i++) x.lineTo(10 + i, 60 - Math.sin(i * 0.15) * 18 - Math.random() * 8); x.stroke();
  for (let i = 0; i < 9; i++) x.fillRect(140 + i * 12, 70 - (i * 37 % 50), 8, (i * 37 % 50) + 2);
  x.globalAlpha = 0.6; x.font = '11px monospace'; for (let i = 0; i < 6; i++) x.fillText(['SYS 0x' + (Math.random() * 65535 | 0).toString(16), 'CORE ' + (Math.random() * 99 | 0) + '%', 'LINK OK', 'O2 98.2', 'GRID 3/4', 'SEC LOCK'][i], 12, 92 + i * 11);
  x.globalAlpha = 1; x.strokeRect(4, 4, 248, 152); x.beginPath(); x.arc(200, 120, 26, 0, TAU); x.stroke(); x.beginPath(); x.arc(200, 120, 26, -1, 1.4); x.lineWidth = 6; x.stroke();
  for (let y = 0; y < 160; y += 3) { x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, y, 256, 1); }
  return c;
}
export function signTex(text, sub = '', col = '#ffb020') {
  const [c, x] = mk(512, 128); x.fillStyle = '#0b0e12'; x.fillRect(0, 0, 512, 128);
  x.strokeStyle = col; x.lineWidth = 6; x.strokeRect(6, 6, 500, 116);
  x.fillStyle = col; x.font = '900 54px Orbitron, "Arial Black", sans-serif'; x.textBaseline = 'middle'; x.fillText(text, 28, sub ? 52 : 66);
  if (sub) { x.globalAlpha = .7; x.font = '700 22px monospace'; x.fillText(sub, 30, 100); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// ---------------------------------------------------------------- geometry helpers
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3();
/** box with UVs scaled to world size, so textures don't stretch (uv unit = `u` metres) */
export function sbox(w, h, d, u = 4) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / u, uv.getY(i) * dims[f][1] / u); }
  return g;
}
function clean(g, color) {
  if (g.index) g = g.toNonIndexed();
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  if (color) { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = color.r; a[i * 3 + 1] = color.g; a[i * 3 + 2] = color.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); }
  g.clearGroups(); return g;
}

/** collects geometry by material key and merges it: one mesh (draw call) per material */
export class Builder {
  constructor(mats) { this.mats = mats; this.b = new Map(); this.cols = []; }
  add(key, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, color = null) {
    tmpQ.setFromEuler(tmpE.set(rx, ry, rz, 'YXZ')); tmpM.compose(tmpV.set(x, y, z), tmpQ, tmpS.set(sx, sy, sz));
    const c = this.mats[key]?.vertexColors ? new THREE.Color(color ?? 0xffffff) : null;
    const g = clean(geo, c); g.applyMatrix4(tmpM);
    if (!this.b.has(key)) this.b.set(key, []); this.b.get(key).push(g); return g;
  }
  box(key, w, h, d, x, y, z, ry = 0, color = null, u = 4) { return this.add(key, sbox(w, h, d, u), x, y, z, 0, ry, 0, 1, 1, 1, color); }
  cyl(key, r, h, x, y, z, rx = 0, ry = 0, rz = 0, seg = 16, color = null, r2 = null) { return this.add(key, new THREE.CylinderGeometry(r2 ?? r, r, h, seg), x, y, z, rx, ry, rz, 1, 1, 1, color); }
  rbox(key, w, h, d, r, x, y, z, ry = 0, color = null) { return this.add(key, new RoundedBoxGeometry(w, h, d, 2, r), x, y, z, 0, ry, 0, 1, 1, 1, color); }
  /** axis-aligned collider in XZ with a height range; optional ref */
  col(x0, x1, z0, z1, y0 = 0, y1 = 4, ref = null) { const c = { x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y0, y1, ref, off: false }; this.cols.push(c); return c; }
  colBox(x, z, w, d, ry, y1, y0 = 0) { const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry)), hw = (w * c + d * s) / 2, hd = (w * s + d * c) / 2; return this.col(x - hw, x + hw, z - hd, z + hd, y0, y1); }
  finish(group) {
    for (const [k, list] of this.b) {
      const g = mergeGeometries(list, false); list.forEach(x => x.dispose()); if (!g) continue;
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, this.mats[k]); m.userData.shared = true;
      m.castShadow = !/glow|screen|glass|floor|ceil|holo|field|graffiti/.test(k); m.receiveShadow = !/glow|screen|holo|field/.test(k);
      group.add(m);
      if (/^(paint|crate|dark|trim|pipe|copper|hazard|rubber|wall)$/.test(k)) { if (!this.mats._ol) this.mats._ol = outlineMat(0.03); const o = new THREE.Mesh(g, this.mats._ol); o.userData.shared = true; group.add(o); }
    }
    this.b.clear();
  }
}

// ---------------------------------------------------------------- materials
// toon ramp (3 steps) + inverted-hull outlines that push along the normal in the vertex shader (works on merged geometry)
export const RAMP = (() => { const d = new Uint8Array([110, 185, 255]); const t = new THREE.DataTexture(d, 3, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
export function toon(color, o = {}) { return new THREE.MeshToonMaterial({ color, gradientMap: RAMP, ...o }); }
export function outlineMat(w = 0.035, color = 0x1b1530) {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = (sh) => { sh.uniforms.uW = { value: w }; sh.vertexShader = 'uniform float uW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += normalize(normal) * uW;'); };
  m.customProgramCacheKey = () => 'ol' + w; return m;
}
export function createMaterials() {
  const wt = wallTex(), ft = floorTex();
  const glow = (c, k = 2.2) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), toneMapped: false });
  const st = (o) => { delete o.roughness; delete o.metalness; return new THREE.MeshToonMaterial({ gradientMap: RAMP, ...o }); };
  const M = {
    wall: st({ map: tex(wt), bumpMap: tex(wt), bumpScale: 1.2 }),
    floor: st({ map: tex(ft), bumpMap: tex(ft), bumpScale: 1.2, roughness: 0.45, metalness: 0.12 }),
    ceil: st({ color: 0xffffff }),
    dark: st({ color: 0x2f3d6b, roughness: 0.55 }),          // themed secondary (ribs, frames, machinery)
    trim: st({ color: 0xffb23a, roughness: 0.5 }),            // themed accent trims
    paint: st({ vertexColors: true, roughness: 0.55 }),
    crate: st({ map: tex(crateTex()), roughness: 0.6 }),
    hazard: st({ map: tex(hazardTex()), roughness: 0.6 }),
    pipe: st({ color: 0xdfe6ee, metalness: 0.35, roughness: 0.32 }),
    copper: st({ color: 0xff9a4a, metalness: 0.3, roughness: 0.4 }),
    rubber: st({ color: 0x2a2f45, roughness: 0.8 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xbfe8ff, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.16, depthWrite: false }),
    leaf: st({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide }),
    ice: new THREE.MeshStandardMaterial({ color: 0xc9f0ff, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.5 }),
    graffiti: new THREE.MeshToonMaterial({ map: graffitiTex(), gradientMap: RAMP, transparent: true, alphaTest: 0.05, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false }),
    glowA: glow(0x22d3ee), glowB: glow(0xff7a1a), glowR: glow(0xff2a3a, 2.6), glowW: glow(0xffffff, 1.6), glowG: glow(0x4dff9a),
    screen: new THREE.MeshBasicMaterial({ map: tex(screenTex()), color: new THREE.Color(1.0, 1.0, 1.0), toneMapped: false }),
    screen2: new THREE.MeshBasicMaterial({ map: tex(screenTex(28)), color: new THREE.Color(1.0, 1.0, 1.0), toneMapped: false }),
    holo: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.2, 2), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }),
  };
  M.field = fieldMaterial();
  return M;
}
// animated hex force field (hangar bay)
function fieldMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color(0.25, 0.8, 1.6) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `varying vec2 vUv; uniform float uTime; uniform vec3 uCol;
      float hex(vec2 p){ p.x *= 1.1547; p.y += mod(floor(p.x), 2.) * .5; p = abs(fract(p) - .5); return abs(max(p.x * 1.5 + p.y, p.y * 2.) - 1.); }
      void main(){ vec2 p = vUv * vec2(24., 10.); float h = smoothstep(.0, .12, hex(p)); float scan = .5 + .5 * sin(vUv.y * 40. - uTime * 3.);
        float edge = smoothstep(.0, .06, vUv.y) * smoothstep(1., .94, vUv.y); float a = ((1. - h) * .3 + .02 + scan * .03) * edge;
        a *= .7 + .3 * sin(uTime * 2. + vUv.x * 9.); gl_FragColor = vec4(uCol * a, 1.); }`,
  });
}

// ---------------------------------------------------------------- space backdrop
const EARTH_VS = `varying vec3 vN; varying vec3 vP; varying vec3 vW; void main(){ vP = position; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const NOISE = `float h3(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
    return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y), mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
  float fbm(vec3 p){ float a = .5, s = 0.; for (int i = 0; i < 6; i++){ s += a * n3(p); p *= 2.03; a *= .5; } return s; }`;
const EARTH_FS = `varying vec3 vN; varying vec3 vP; varying vec3 vW; uniform vec3 uSun; uniform float uTime; ${NOISE}
  void main(){ vec3 n = normalize(vP); vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW);
    float c = fbm(n * 2.6 + vec3(3.1, 1.7, .4)); float land = smoothstep(.50, .53, c);
    float lat = abs(n.y); vec3 ocean = mix(vec3(.004, .025, .09), vec3(.01, .09, .2), smoothstep(.35, .5, c));
    float dry = fbm(n * 5. + 7.); vec3 ground = mix(vec3(.05, .13, .035), vec3(.33, .25, .13), smoothstep(.45, .65, dry)); ground = mix(ground, vec3(.75, .78, .82), smoothstep(.72, .82, lat));
    vec3 col = mix(ocean, ground, land); col = mix(col, vec3(.85, .9, .95), smoothstep(.86, .9, lat));
    float cl = fbm(n * 4. + vec3(uTime * .006, 0., uTime * .004)); cl = smoothstep(.56, .8, cl) * .85;
    float d = dot(N, uSun); float day = smoothstep(-.12, .25, d);
    vec3 H = normalize(uSun + V); float spec = pow(max(dot(N, H), 0.), 60.) * (1. - land) * (1. - cl) * day;
    vec3 lit = (col * (.08 + 1.4 * max(d, 0.)) + spec * vec3(1., .9, .7) * 1.6);
    lit = mix(lit, vec3(1.) * (.06 + 1.5 * max(d, 0.)), cl);
    float city = smoothstep(.62, .7, fbm(n * 22.)) * land * (1. - day) * (1. - cl);
    vec3 night = vec3(1., .62, .25) * city * 1.6 + col * .015;
    vec3 o = mix(night, lit, day);
    float rim = pow(1. - max(dot(N, V), 0.), 3.); o += vec3(.2, .45, 1.1) * rim * (.1 + .55 * smoothstep(-.3, .4, d));
    gl_FragColor = vec4(o, 1.); }`;
const ATMO_FS = `varying vec3 vN; varying vec3 vW; uniform vec3 uSun; void main(){ vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW);
    float f = pow(1. - abs(dot(N, V)), 2.2); float d = smoothstep(-.4, .5, dot(N, uSun)); float a = smoothstep(0., .9, f) * (1. - smoothstep(.92, 1., f));
    gl_FragColor = vec4(vec3(.3, .6, 1.4) * a * (.1 + .8 * d), 1.); }`;

export function createSpace(scene) {
  const g = new THREE.Group(); scene.add(g);
  // stars
  const N = 3200, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), sz = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const v = new THREE.Vector3().randomDirection(); const band = Math.random() < 0.45; if (band) { v.y *= 0.18; v.normalize(); }
    v.multiplyScalar(1600); pos.set([v.x, v.y, v.z], i * 3);
    const t = Math.random(), b = 0.5 + Math.random() * (Math.random() < 0.05 ? 3 : 1.1);
    col.set([b * (t < .2 ? 1 : .8), b * .85, b * (t > .7 ? 1.25 : .95)], i * 3); sz[i] = 1.2 + Math.random() * (Math.random() < 0.04 ? 4 : 1.8);
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(col, 3)); sg.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  const stars = new THREE.Points(sg, new THREE.ShaderMaterial({ uniforms: { uPx: { value: 2 } }, depthWrite: false,
    vertexShader: 'attribute float aSize; attribute vec3 color; varying vec3 vC; uniform float uPx; void main(){ vC = color; gl_PointSize = aSize * uPx; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'varying vec3 vC; void main(){ vec2 d = gl_PointCoord - .5; float r = dot(d,d) * 4.; if (r > 1.) discard; gl_FragColor = vec4(vC * pow(1. - r, 3.), 1.); }' }));
  stars.frustumCulled = false; g.add(stars);
  // nebula dome (very faint)
  const neb = new THREE.Mesh(new THREE.SphereGeometry(1700, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `varying vec3 vD; ${NOISE} void main(){ float n = fbm(vD * 3. + 2.); float b = smoothstep(.45, .85, n) * (1. - abs(vD.y) * 1.4); float u = vD.y * .5 + .5; vec3 base = mix(vec3(.05,.03,.16), vec3(.08,.12,.34), u); vec3 c = base + mix(vec3(.0), vec3(.55,.12,.6), b) + vec3(.05,.3,.5) * smoothstep(.5,.9,fbm(vD*5.+4.)); gl_FragColor = vec4(c, 1.); }` }));
  g.add(neb);
  // earth
  const sun = new THREE.Vector3(0.6, 0.35, -0.7).normalize();
  const eu = { uSun: { value: sun }, uTime: { value: 0 } };
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.ShaderMaterial({ uniforms: eu, vertexShader: EARTH_VS, fragmentShader: EARTH_FS }));
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.035, 64, 32), new THREE.ShaderMaterial({ uniforms: eu, vertexShader: EARTH_VS, fragmentShader: ATMO_FS, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  earth.add(atmo); g.add(earth);
  // sun disc + glow
  const sc = document.createElement('canvas'); sc.width = sc.height = 256; const x = sc.getContext('2d'); const gr = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.08, 'rgba(255,250,230,1)'); gr.addColorStop(0.2, 'rgba(255,200,140,.35)'); gr.addColorStop(1, 'rgba(255,160,80,0)'); x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
  const sunSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(sc), color: new THREE.Color(4, 3.6, 3.2), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  sunSpr.scale.setScalar(260); g.add(sunSpr);
  // the station ring far away
  const ring = new THREE.Group();
  const rmat = new THREE.MeshToonMaterial({ map: procTex('panel', { color: '#e8ecf4', repeat: 1 }), gradientMap: RAMP, fog: false });
  rmat.map.repeat.set(60, 2);
  const tor = new THREE.Mesh(new THREE.TorusGeometry(260, 14, 12, 120), rmat); ring.add(tor);
  const lights = new THREE.Mesh(new THREE.TorusGeometry(260, 14.3, 4, 120, TAU), new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 2.4, 3), toneMapped: false, wireframe: true, transparent: true, opacity: 0.08, fog: false }));
  ring.add(lights);
  for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 250, 8), rmat); s.rotation.z = Math.PI / 2; s.rotation.y = i * Math.PI / 3; s.position.set(0, 0, 0); s.geometry.translate(0, 0, 0); const p = new THREE.Group(); p.rotation.z = i * Math.PI / 3; s.rotation.set(0, 0, Math.PI / 2); s.position.x = 125; p.add(s); ring.add(p); }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(30, 30, 50, 24), rmat); hub.rotation.x = Math.PI / 2; ring.add(hub);
  g.add(ring);
  const api = {
    group: g, earth, sun, sunSpr, ring, uniforms: eu,
    /** earth centre + radius (world), sun direction, ring placement */
    set({ earthPos = [0, -900, -900], earthR = 700, sunDir = [0.6, 0.35, -0.7], ringPos = null, ringRot = [0.3, 0.4, 0], visible = true } = {}) {
      g.visible = visible; earth.position.set(...earthPos); earth.scale.setScalar(earthR); sun.set(...sunDir).normalize();
      sunSpr.position.copy(sun).multiplyScalar(1400); ring.visible = !!ringPos; if (ringPos) { ring.position.set(...ringPos); ring.rotation.set(...ringRot); }
    },
    update(dt, cam) { eu.uTime.value += dt; g.position.copy(cam.position).multiplyScalar(0); stars.position.copy(cam.position); neb.position.copy(cam.position); sunSpr.position.copy(sun).multiplyScalar(1400).add(cam.position); earth.rotation.y += dt * 0.004; },
    setPx(p) { stars.material.uniforms.uPx.value = p; },
  };
  return api;
}

// ---------------------------------------------------------------- props kit (bound to a room centre)
const C = (h) => new THREE.Color(h);
export function propsKit(B, mats, dyn, ox, oz) {
  const K = {
    ox, oz,
    crate(x, z, s = 1.2, ry = 0, y = 0) { x += ox; z += oz; B.box('crate', s, s, s, x, y + s / 2, z, ry, null, s); B.box('dark', s * 1.04, 0.08, s * 1.04, x, y + s - 0.04, z, ry); B.box('dark', s * 1.04, 0.08, s * 1.04, x, y + 0.04, z, ry); if (y === 0) B.colBox(x, z, s, s, ry, s); else B.colBox(x, z, s, s, ry, y + s, y); },
    stack(x, z, ry = 0) { K.crate(x, z, 1.3, ry); K.crate(x + 1.35 * Math.cos(ry), z - 1.35 * Math.sin(ry), 1.3, ry + 0.05); K.crate(x + 0.6 * Math.cos(ry), z - 0.6 * Math.sin(ry), 1.1, ry + 0.3, 1.3); },
    longCrate(x, z, ry = 0) { x += ox; z += oz; B.box('paint', 3, 1.25, 1.4, x, 0.625, z, ry, 0x3d6bff); B.box('hazard', 3.02, 0.18, 1.42, x, 1.1, z, ry, null, 1); B.box('glowA', 0.05, 0.1, 1.2, x + Math.cos(ry) * 1.52, 0.7, z - Math.sin(ry) * 1.52, ry); B.colBox(x, z, 3, 1.4, ry, 1.25); },
    barrier(x, z, w = 3, ry = 0) { x += ox; z += oz; B.rbox('paint', w, 1.15, 0.5, 0.08, x, 0.575, z, ry, 0xeef1f6); B.box('hazard', w * 0.98, 0.16, 0.52, x, 1.0, z, ry, null, 1); B.box('glowB', w * 0.6, 0.04, 0.53, x, 0.55, z, ry); B.colBox(x, z, w, 0.5, ry, 1.15); },
    pillar(x, z, h, s = 1) { x += ox; z += oz; B.box('dark', s, h, s, x, h / 2, z); B.box('trim', s * 1.2, 0.4, s * 1.2, x, 0.2, z); B.box('trim', s * 1.2, 0.4, s * 1.2, x, h - 0.2, z); for (const k of [-1, 1]) { B.box('glowA', 0.06, h * 0.6, 0.06, x + k * s * 0.5, h / 2, z + s * 0.5); B.box('glowA', 0.06, h * 0.6, 0.06, x + k * s * 0.5, h / 2, z - s * 0.5); } B.col(x - s / 2, x + s / 2, z - s / 2, z + s / 2, 0, h); },
    console(x, z, ry = 0, scr = 'screen') { x += ox; z += oz; const fx = Math.sin(ry), fz = Math.cos(ry);
      B.rbox('paint', 1.6, 1.0, 0.8, 0.06, x, 0.5, z, ry, 0x2b313a); B.add('paint', sbox(1.6, 0.08, 0.9), x + fx * 0.05, 1.03, z + fz * 0.05, -0.35, ry, 0, 1, 1, 1, 0x1a1e24);
      B.add(scr, new THREE.PlaneGeometry(1.4, 0.7), x - fx * 0.15, 1.45, z - fz * 0.15, -0.2, ry); B.add('dark', sbox(1.5, 0.8, 0.08), x - fx * 0.2, 1.45, z - fz * 0.2, -0.2, ry);
      B.box('glowA', 1.5, 0.03, 0.03, x + fx * 0.42, 0.9, z + fz * 0.42, ry); B.colBox(x, z, 1.6, 0.9, ry, 1.0); },
    canister(x, z) { x += ox; z += oz; dyn.canisters.push({ x, z }); },
    vent(x, y, z, dx, dy, dz, rate = 1) { dyn.vents.push({ p: new THREE.Vector3(x + ox, y, z + oz), d: new THREE.Vector3(dx, dy, dz), rate, t: Math.random() }); B.cyl('dark', 0.22, 0.3, x + ox, y, z + oz, dz ? Math.PI / 2 : 0, 0, dx ? Math.PI / 2 : 0, 10); },
    beacon(x, y, z) { dyn.beacons.push(new THREE.Vector3(x + ox, y, z + oz)); B.cyl('dark', 0.18, 0.12, x + ox, y - 0.18, z + oz); },
    sign(text, sub, x, y, z, ry = 0, w = 3, col) { dyn.signs.push({ text, sub, x: x + ox, y, z: z + oz, ry, w, col }); B.box('dark', w + 0.15, w / 4 + 0.15, 0.08, x + ox - Math.sin(ry) * 0.05, y, z + oz - Math.cos(ry) * 0.05, ry); },
    pipeRun(x0, z0, x1, z1, y, r = 0.14, mat = 'pipe') { x0 += ox; x1 += ox; z0 += oz; z1 += oz; const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz), ry = Math.atan2(dx, dz);
      B.add(mat, new THREE.CylinderGeometry(r, r, L, 12), (x0 + x1) / 2, y, (z0 + z1) / 2, Math.PI / 2, ry); for (let s = 1; s < L; s += 2.2) B.add('dark', new THREE.CylinderGeometry(r * 1.4, r * 1.4, 0.14, 12), x0 + dx * s / L, y, z0 + dz * s / L, Math.PI / 2, ry); },
    cable(pts, r = 0.05) { const v = pts.map(p => new THREE.Vector3(p[0] + ox, p[1], p[2] + oz)); B.add('rubber', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(v), 24, r, 6)); },
    sag(x0, y0, z0, x1, y1, z1, sag = 0.8, r = 0.05) { const m = [(x0 + x1) / 2, (y0 + y1) / 2 - sag, (z0 + z1) / 2]; K.cable([[x0, y0, z0], [x0 + (m[0] - x0) * .5, (y0 + m[1]) / 2 - sag * .3, z0 + (m[2] - z0) * .5], m, [m[0] + (x1 - m[0]) * .5, (m[1] + y1) / 2 - sag * .3, m[2] + (z1 - m[2]) * .5], [x1, y1, z1]], r); },
    locker(x, z, ry = 0) { x += ox; z += oz; for (let i = 0; i < 3; i++) { const o = (i - 1) * 0.62; B.rbox('paint', 0.58, 2.1, 0.55, 0.03, x + Math.cos(ry) * o, 1.05, z - Math.sin(ry) * o, ry, i % 2 ? 0x46505c : 0x3d4652); B.box('glowA', 0.4, 0.03, 0.03, x + Math.cos(ry) * o + Math.sin(ry) * 0.28, 1.7, z - Math.sin(ry) * o + Math.cos(ry) * 0.28, ry); } B.colBox(x, z, 1.9, 0.55, ry, 2.1); },
    rack(x, z, ry = 0) { x += ox; z += oz; B.box('dark', 0.9, 2.2, 0.9, x, 1.1, z, ry); for (let i = 0; i < 8; i++) B.box(i % 3 ? 'glowA' : 'glowB', 0.6, 0.02, 0.02, x + Math.sin(ry) * 0.46, 0.4 + i * 0.22, z + Math.cos(ry) * 0.46, ry); B.colBox(x, z, 0.9, 0.9, ry, 2.2); },
    dropship(x, z, ry = 0) { x += ox; z += oz; const P = (lx, ly, lz) => [x + Math.cos(ry) * lx + Math.sin(ry) * lz, ly, z - Math.sin(ry) * lx + Math.cos(ry) * lz];
      const hull = new THREE.CapsuleGeometry(1.5, 6, 8, 16); { const [a, b, c] = P(0, 2.2, 0); B.add('paint', hull, a, b, c, Math.PI / 2, ry, 0, 1.25, 1, 0.75, 0xc9ccd2); }
      { const [a, b, c] = P(0, 2.9, 4.0); B.add('glass', new THREE.SphereGeometry(1.2, 20, 12, 0, TAU, 0, 1.4), a, b, c, 1.3, ry, 0, 1.1, 0.6, 1); }
      for (const s of [-1, 1]) { const [a, b, c] = P(s * 2.6, 2.0, -0.6); B.add('paint', sbox(3.2, 0.25, 3.2), a, b, c, 0, ry + s * 0.25, s * -0.08, 1, 1, 1, 0x9ea4ad);
        const [e, f, g] = P(s * 3.8, 2.0, -1.6); B.add('dark', new THREE.CylinderGeometry(0.6, 0.75, 2.4, 16), e, f, g, Math.PI / 2, ry); const [h, i, j] = P(s * 3.8, 2.0, -2.85); B.add('glowA', new THREE.CircleGeometry(0.55, 16), h, i, j, 0, ry + Math.PI);
        const [k, l, m] = P(s * 1.4, 0.55, 1.8); B.add('dark', sbox(0.15, 1.1, 0.15), k, l, m, 0, ry); const [n, o, p] = P(s * 1.4, 0.55, -2.2); B.add('dark', sbox(0.15, 1.1, 0.15), n, o, p, 0, ry);
        const [q, r2, t] = P(s * 1.35, 2.2, 0); B.add('hazard', sbox(0.05, 0.25, 4), q, r2, t, 0, ry); }
      { const [a, b, c] = P(0, 3.5, -3.2); B.add('paint', sbox(0.2, 1.8, 1.8), a, b, c, -0.3, ry, 0, 1, 1, 1, 0x9ea4ad); }
      { const [a, b, c] = P(0, 1.2, -4.2); B.add('dark', sbox(1.8, 0.2, 2.2), a, b, c, -0.5, ry); }
      B.colBox(x, z, 3.6, 8.5, ry, 3.6); },
    shelf(x, z, ry = 0) { x += ox; z += oz; B.box('dark', 2.4, 0.08, 0.7, x, 0.9, z, ry); B.box('dark', 2.4, 0.08, 0.7, x, 1.8, z, ry); for (const s of [-1, 1]) B.box('trim', 0.08, 2.2, 0.7, x + Math.cos(ry) * s * 1.18, 1.1, z - Math.sin(ry) * s * 1.18, ry);
      for (let i = 0; i < 4; i++) B.box('crate', 0.4, 0.35, 0.4, x + Math.cos(ry) * (i - 1.5) * 0.55, 1.12, z - Math.sin(ry) * (i - 1.5) * 0.55, ry + i, null, 0.5); B.colBox(x, z, 2.4, 0.7, ry, 2.2); },
    planter(x, z, len = 6, ry = 0) { x += ox; z += oz; B.box('paint', 1.4, 0.9, len, x, 0.45, z, ry, 0x515a66); B.box('glowG', 1.42, 0.05, len, x, 0.75, z, ry); B.box('paint', 1.2, 0.1, len - 0.2, x, 0.86, z, ry, 0x2a1d12);
      for (let i = 0; i < len * 3; i++) { const t = (i / (len * 3) - 0.5) * (len - 0.6), side = (i % 2 - 0.5) * 0.6, px = x + Math.sin(ry) * t + Math.cos(ry) * side, pz = z + Math.cos(ry) * t - Math.sin(ry) * side, h = 0.6 + Math.random() * 0.9;
        B.add('leaf', new THREE.ConeGeometry(0.28 + Math.random() * 0.15, h, 5), px, 0.9 + h / 2, pz, (Math.random() - .5) * 0.3, Math.random() * 6, (Math.random() - .5) * 0.3, 1, 1, 1, new THREE.Color().setHSL(0.27 + Math.random() * 0.08, 0.7, 0.18 + Math.random() * 0.12));
        if (i % 4 === 0) B.add('leaf', new THREE.IcosahedronGeometry(0.3, 0), px, 1.1 + h * 0.6, pz, Math.random(), Math.random(), 0, 1, 0.7, 1, new THREE.Color().setHSL(0.3, 0.6, 0.22)); }
      B.box('pipe', 0.06, 0.06, len, x + Math.cos(ry) * 0.75, 0.3, z - Math.sin(ry) * 0.75, ry); B.colBox(x, z, 1.4, len, ry, 0.9); },
    growLamp(x, z, len, y, ry = 0) { x += ox; z += oz; B.box('dark', 0.5, 0.12, len, x, y, z, ry); B.box('glowG', 0.4, 0.03, len - 0.2, x, y - 0.07, z, ry); B.cyl('rubber', 0.015, 2, x, y + 1, z); },
    cryoPod(x, z, ry = 0) { x += ox; z += oz; const fx = Math.sin(ry), fz = Math.cos(ry);
      B.rbox('paint', 1.3, 0.35, 1.1, 0.08, x, 0.18, z, ry, 0x3c4450); B.rbox('paint', 1.3, 0.4, 1.1, 0.08, x, 2.5, z, ry, 0x3c4450);
      B.add('ice', new THREE.CylinderGeometry(0.52, 0.52, 2.0, 20, 1, true), x, 1.35, z); B.add('glowA', new THREE.CylinderGeometry(0.42, 0.42, 1.9, 14), x, 1.35, z);
      B.add('dark', new THREE.CapsuleGeometry(0.2, 1.0, 4, 8), x, 1.3, z, 0, 0, 0, 1, 1, 0.8);
      for (const s of [-1, 1]) B.box('trim', 0.12, 2.0, 0.12, x + Math.cos(ry) * s * 0.58 - fx * 0.3, 1.35, z - Math.sin(ry) * s * 0.58 - fz * 0.3, ry);
      B.box('screen', 0.5, 0.3, 0.02, x + fx * 0.56, 0.6, z + fz * 0.56, ry); B.colBox(x, z, 1.3, 1.1, ry, 2.7); },
    reactor(x, z, h) { x += ox; z += oz; dyn.reactor = { x, z, h };
      B.cyl('dark', 3.2, 1.2, x, 0.6, z, 0, 0, 0, 32); B.cyl('trim', 3.6, 0.3, x, 1.3, z, 0, 0, 0, 32); B.cyl('dark', 3.2, 1.6, x, h - 0.8, z, 0, 0, 0, 32);
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; B.box('dark', 0.4, h - 2.4, 0.5, x + Math.cos(a) * 2.6, h / 2, z + Math.sin(a) * 2.6, -a); B.box('glowB', 0.06, h - 3, 0.06, x + Math.cos(a) * 2.85, h / 2, z + Math.sin(a) * 2.85, -a); }
      B.col(x - 3.2, x + 3.2, z - 3.2, z + 3.2, 0, h); },
    holoTable(x, z) { x += ox; z += oz; B.cyl('paint', 1.6, 0.9, x, 0.45, z, 0, 0, 0, 24, 0x2b313a); B.cyl('glowA', 1.45, 0.04, x, 0.92, z, 0, 0, 0, 24); B.cyl('trim', 1.7, 0.1, x, 0.95, z, 0, 0, 0, 24); dyn.holo = { x, z }; B.col(x - 1.4, x + 1.4, z - 1.4, z + 1.4, 0, 1); },
    antenna(x, z, h = 6) { x += ox; z += oz; B.cyl('trim', 0.12, h, x, h / 2, z, 0, 0, 0, 8); B.cyl('dark', 0.5, 0.3, x, 0.15, z, 0, 0, 0, 12); B.add('glowR', new THREE.SphereGeometry(0.12, 8, 6), x, h, z); for (let i = 1; i < 4; i++) B.box('trim', 1.6 - i * 0.3, 0.05, 0.05, x, h * i / 4, z); B.col(x - 0.5, x + 0.5, z - 0.5, z + 0.5, 0, h); },
    solar(x, z, ry = 0) { x += ox; z += oz; B.box('trim', 0.2, 1.6, 0.2, x, 0.8, z); B.add('paint', sbox(3, 0.06, 1.8), x, 1.7, z, -0.5, ry, 0, 1, 1, 1, 0x14254a); B.add('glowA', sbox(2.9, 0.01, 0.02), x, 1.74, z, -0.5, ry); B.col(x - 0.3, x + 0.3, z - 0.3, z + 0.3, 0, 1.6); },
  };
  return K;
}
