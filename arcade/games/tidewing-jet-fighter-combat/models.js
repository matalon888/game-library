// Tidewing models, all built from three.js primitives in code and merged per material (few draw calls):
// the player's TW-9 Gannet (original design), VANTA drone jets, missiles, SAM sites, the Leviathan drone carrier,
// the Halcyon airborne fortress and the Gannet cockpit.
import * as THREE from './kit/three.module.min.js';
import { mergeGeometries } from './kit/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from './kit/addons/geometries/RoundedBoxGeometry.js';
import { procTex } from './kit/cine.js';
import { toon, outlineMat, outlineGeo, ramp } from './toon.js';

const V3 = THREE.Vector3, D2R = Math.PI / 180;
function tf(g, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) { g.applyMatrix4(new THREE.Matrix4().compose(new V3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new V3(...s))); return g; }
function strip(g) { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; }
function merge(list) { return list.length ? mergeGeometries(list.map(strip)) : null; }
// planform shape in (x, z) laid flat, thickness along +y
function plate(pts, thick, bevel = 0.05) {
  const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4 });
  g.rotateX(-Math.PI / 2); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 12, uv.getY(i) / 12);
  return g;
}
// fin in (z, y), thickness along x
function fin(pts, thick) {
  const s = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1 }); g.translate(0, 0, -thick / 2); g.rotateY(-Math.PI / 2);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 10, uv.getY(i) / 10); return g;
}
function lathe(prof, seg = 28, sx = 1, sy = 1) { const pts = prof.map(([r, y]) => new THREE.Vector2(r, y)); if (pts[0].y > pts[pts.length - 1].y) pts.reverse(); const g = new THREE.LatheGeometry(pts, seg); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i)); g.rotateX(Math.PI / 2); g.scale(sx, sy, 1); return g; }
function canvas(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }

// ---------------------------------------------------------------- liveries (lathe UV: u around from the belly, v nose→tail; canvas top = tail)
function playerLivery() {
  return canvas(1024, 1024, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#1f8fff'); g.addColorStop(0.18, '#1f8fff'); g.addColorStop(0.22, '#ffffff'); g.addColorStop(0.78, '#ffffff'); g.addColorStop(0.82, '#1f8fff'); g.addColorStop(1, '#1f8fff');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = '#ff7a1a'; x.fillRect(200, 0, 46, h); x.fillRect(778, 0, 46, h);                     // racing stripes on the flanks
    x.fillStyle = '#ffd23f'; x.fillRect(246, 0, 12, h); x.fillRect(766, 0, 12, h);
    x.fillStyle = '#1d1633'; for (let i = 0; i < 16; i++) for (let j = 0; j < 3; j++) if ((i + j) % 2) x.fillRect(i * 64, j * 32, 64, 32);   // tail checkers
    x.strokeStyle = 'rgba(29,22,51,.25)'; x.lineWidth = 3; for (const y of [220, 420, 610]) { x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); }
    for (const cx of [300, 724]) { x.save(); x.translate(cx, 905); if (cx > 512) x.scale(-1, 1);          // grinning shark mouth on the nose
      x.fillStyle = '#1d1633'; x.beginPath(); x.moveTo(-110, -30); x.quadraticCurveTo(-20, 70, 110, 10); x.quadraticCurveTo(10, 20, -110, -30); x.fill();
      x.fillStyle = '#e8303a'; x.beginPath(); x.moveTo(-96, -20); x.quadraticCurveTo(-20, 52, 96, 12); x.quadraticCurveTo(10, 18, -96, -20); x.fill();
      x.fillStyle = '#fff'; for (let k = 0; k < 7; k++) { x.beginPath(); const tx = -80 + k * 25; x.moveTo(tx, -8 + k * 3); x.lineTo(tx + 12, -8 + k * 3.4); x.lineTo(tx + 6, 10 + k * 2); x.fill(); }
      x.fillStyle = '#fff'; x.beginPath(); x.arc(-120, -70, 22, 0, 7); x.fill(); x.fillStyle = '#1d1633'; x.beginPath(); x.arc(-114, -70, 11, 0, 7); x.fill(); x.restore(); }
    x.fillStyle = '#1d1633'; x.font = '900 120px Impact, Arial Black, sans-serif'; x.textAlign = 'center'; x.fillText('07', 512, 560);
  });
}
function droneLivery() {
  return canvas(512, 512, (x, w, h) => {
    x.fillStyle = '#8b6fd6'; x.fillRect(0, 0, w, h); x.fillStyle = '#6d55b8'; x.fillRect(0, 0, w * 0.2, h); x.fillRect(w * 0.8, 0, w * 0.2, h);
    for (let i = -4; i < 20; i++) { x.fillStyle = i % 2 ? '#ffd23f' : '#1d1633'; x.beginPath(); x.moveTo(i * 32, 40); x.lineTo(i * 32 + 32, 40); x.lineTo(i * 32 + 8, 80); x.lineTo(i * 32 - 24, 80); x.fill(); }
    x.fillStyle = '#ff3d7f'; x.fillRect(w * 0.47, 0, w * 0.06, h);
  });
}
function emblem(fg, bg) { return canvas(256, 256, (x, w) => { x.clearRect(0, 0, w, w); x.fillStyle = '#1d1633'; x.beginPath(); x.arc(128, 128, 120, 0, 7); x.fill(); x.fillStyle = bg; x.beginPath(); x.arc(128, 128, 108, 0, 7); x.fill(); x.strokeStyle = fg; x.lineWidth = 12; x.beginPath(); x.arc(128, 128, 90, 0, 7); x.stroke();
  x.fillStyle = fg; x.beginPath(); x.moveTo(40, 150); x.quadraticCurveTo(100, 70, 128, 120); x.quadraticCurveTo(156, 70, 216, 150); x.quadraticCurveTo(160, 120, 128, 168); x.quadraticCurveTo(96, 120, 40, 150); x.fill(); }); }

export class Kit {
  constructor() {
    const T = (c, o) => toon(c, o);
    this.mPlayer = T('#ffffff', { map: playerLivery() });
    this.mWhite = T('#f4f6fa'); this.mBlue = T('#1f8fff'); this.mOrange = T('#ff7a1a'); this.mYellow = T('#ffd23f');
    this.mDrone = T('#ffffff', { map: droneLivery() }); this.mPurple = T('#7a5fd0'); this.mHead = T('#ff4fa3'); this.mHaz = T('#ffd23f');
    this.mDark = T('#3a3550');
    this.mGlass = new THREE.MeshPhysicalMaterial({ color: 0x2ad4ff, metalness: 0.1, roughness: 0.05, clearcoat: 1, envMapIntensity: 1.6, emissive: 0x0a4a7a, emissiveIntensity: 0.6 });
    this.mGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 3, 2.4) });
    this.mRed = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.0, 0.6) });
    this.mEngine = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.2, 0.8) });
    this.mConcrete = T('#d8d2c4'); this.mOlive = T('#7a8a4a'); this.mHull = T('#5d7cae'); this.mDeck = T('#5a6474'); this.mBoss = T('#ffffff', { map: canvas(256, 256, (x, w, h) => { x.fillStyle = '#4a4f86'; x.fillRect(0, 0, w, h); x.strokeStyle = '#2e3160'; x.lineWidth = 4; for (let i = 0; i <= w; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.moveTo(0, i); x.lineTo(w, i); x.stroke(); }
      x.fillStyle = '#ffd23f'; for (let i = -2; i < 10; i++) { x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32 + 16, 0); x.lineTo(i * 32 + 40, 24); x.lineTo(i * 32 + 24, 24); x.fill(); } x.fillStyle = '#ff4fa3'; x.fillRect(100, 120, 56, 16); }) }); this.mBoss2 = T('#2e3160');
    this.mDecal = new THREE.MeshBasicMaterial({ map: emblem('#ffd23f', '#1f8fff'), transparent: true, polygonOffset: true, polygonOffsetFactor: -2 });
    this.ink = outlineMat(2.2); this.inkThin = outlineMat(1.4);
    this.flameMats = [];
    this.missileGeo = this.makeMissileGeo();
    this.jetGeo = { player: this.jetParts('player'), drone: this.jetParts('drone') };
  }
  flameMat(c1, c2) {
    const m = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uPow: { value: 0.5 }, uC1: { value: new THREE.Color(c1) }, uC2: { value: new THREE.Color(c2) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; varying float vF; void main(){ vUv = uv; vec4 mv = modelViewMatrix*vec4(position,1.); vec3 n = normalize(normalMatrix*normal); vF = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix*mv; }',
      fragmentShader: `uniform float uTime, uPow; uniform vec3 uC1, uC2; varying vec2 vUv; varying float vF;
        void main(){ float v = vUv.y; float n = sin(v*38.0 - uTime*90.0 + vUv.x*6.28)*0.5+0.5; float dia = pow(sin(v*22.0 - uTime*4.0)*0.5+0.5, 6.0) * uPow;
          float a = pow(v, 1.6) * pow(vF, 1.4) * (0.65 + 0.35*n) + dia*0.5*pow(v,0.7);
          vec3 c = mix(uC2, uC1, pow(v, 2.5)); gl_FragColor = vec4(c * a * (0.6 + uPow*1.6), 1.0); }` });
    this.flameMats.push(m); return m;
  }
  vapourMat() {
    return new THREE.ShaderMaterial({ uniforms: { uAmt: { value: 0 }, uTime: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; varying float vF; void main(){ vUv = uv; vec4 mv = modelViewMatrix*vec4(position,1.); vec3 n = normalize(normalMatrix*normal); vF = 1.0-abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'uniform float uAmt, uTime; varying vec2 vUv; varying float vF; float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); } void main(){ float n = h(floor(vec2(vUv.x*60.0, vUv.y*14.0 - uTime*30.0))); float a = uAmt * smoothstep(0.0,0.35,vUv.y) * smoothstep(1.0,0.75,vUv.y) * (0.35+0.65*n) * (0.3 + vF*0.9); gl_FragColor = vec4(vec3(1.0), a*0.55); }' });
  }
  makeMissileGeo() {
    const white = [], red = [], dark = [];
    white.push(tf(new THREE.CylinderGeometry(0.2, 0.2, 2.6, 12), [0, 0, -0.1], [Math.PI / 2, 0, 0]));
    red.push(tf(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), [0, 0, 1.2], [Math.PI / 2, 0, 0], [1, 2.2, 1]));
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; red.push(tf(new THREE.BoxGeometry(0.05, 0.6, 0.55), [Math.cos(a) * 0.34, Math.sin(a) * 0.34, -1.1], [0, 0, a - Math.PI / 2])); }
    red.push(tf(new THREE.CylinderGeometry(0.21, 0.21, 0.18, 12), [0, 0, 0.5], [Math.PI / 2, 0, 0]));
    dark.push(tf(new THREE.CylinderGeometry(0.16, 0.2, 0.2, 12), [0, 0, -1.48], [Math.PI / 2, 0, 0]));
    const col = (g, c) => { g = strip(g); const a = new Float32Array(g.attributes.position.count * 3), cc = new THREE.Color(c); for (let i = 0; i < a.length; i += 3) { a[i] = cc.r; a[i + 1] = cc.g; a[i + 2] = cc.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
    return mergeGeometries([...white.map(g => col(g, '#ffffff')), ...red.map(g => col(g, '#ff3b46')), ...dark.map(g => col(g, '#3a3550'))]);
  }
  missileMesh() { return new THREE.Mesh(this.missileGeo, this.mMissile || (this.mMissile = toon('#ffffff', { vertexColors: true }))); }
  // ---------------------------------------------------------------- jets: chunky, bold paint, ink outlines
  jetParts(kind) {
    const P = { body: [], white: [], blue: [], orange: [], dark: [], glass: [], glow: [], red: [], engine: [] };
    if (kind === 'player') {
      P.body.push(lathe([[0, 8.0], [0.5, 7.6], [0.86, 6.3], [1.12, 4.6], [1.26, 2.8], [1.34, 0.5], [1.36, -2.5], [1.26, -5.5], [1.1, -7.6], [0.95, -8.4], [0.0, -8.4]], 32, 1.22, 0.92));
      P.orange.push(lathe([[0, 9.2], [0.24, 8.7], [0.52, 7.65], [0.53, 7.55]], 24, 1.22, 0.92));
      P.glass.push(tf(new THREE.SphereGeometry(1, 28, 16), [0, 0.86, 4.0], [0, 0, 0], [0.78, 0.72, 2.5]));
      P.dark.push(tf(new THREE.TorusGeometry(0.76, 0.07, 6, 20, Math.PI), [0, 0.86, 3.1], [0, 0, 0], [1.02, 0.95, 1]));
      P.white.push(tf(new RoundedBoxGeometry(1.2, 0.7, 8.5, 3, 0.3), [0, 0.72, -2.6]));
      for (const s of [-1, 1]) {
        P.blue.push(tf(new RoundedBoxGeometry(1.15, 1.4, 5.2, 3, 0.35), [s * 1.55, -0.3, 0.2], [0, s * 0.03, 0]));
        P.dark.push(tf(new RoundedBoxGeometry(0.95, 1.15, 0.3, 2, 0.1), [s * 1.58, -0.3, 2.8], [-0.25, 0, 0]));
        P.white.push(plate([[s * 1.1, 2.2], [s * 7.0, -3.2], [s * 7.0, -4.6], [s * 1.1, -6.2]], 0.24, 0.1).translate(0, -0.36, 0));
        P.orange.push(plate([[s * 6.2, -2.6], [s * 7.5, -3.6], [s * 7.5, -4.8], [s * 6.2, -4.6]], 0.26, 0.1).translate(0, -0.37, 0));        // wingtip caps
        P.blue.push(plate([[s * 0.9, 5.4], [s * 1.1, 1.8], [s * 2.8, 0.0], [s * 1.7, 2.2]], 0.14).translate(0, -0.14, 0));
        P.white.push(plate([[s * 1.0, -6.4], [s * 4.0, -8.2], [s * 4.0, -9.2], [s * 1.0, -8.9]], 0.18, 0.08).translate(0, -0.15, 0));
        P.blue.push(tf(fin([[-4.2, 0], [-6.8, 3.7], [-8.2, 3.8], [-8.8, 0]], 0.22), [s * 1.05, 0.55, 0], [0, 0, -s * 0.33]));
        P.orange.push(tf(fin([[-6.65, 3.3], [-6.85, 3.75], [-8.2, 3.85], [-8.35, 3.3]], 0.26), [s * 1.05, 0.55, 0], [0, 0, -s * 0.33]));
        P.dark.push(tf(new THREE.CylinderGeometry(0.72, 0.62, 1.5, 20, 1, true), [s * 0.7, -0.05, -9.05], [Math.PI / 2, 0, 0]));
        P.orange.push(tf(new THREE.TorusGeometry(0.66, 0.1, 8, 20), [s * 0.7, -0.05, -9.8]));
        P.engine.push(tf(new THREE.CircleGeometry(0.58, 20), [s * 0.7, -0.05, -9.2], [0, Math.PI, 0]));
        for (const x of [2.9, 4.8]) P.dark.push(tf(new THREE.BoxGeometry(0.16, 0.34, 1.6), [s * x, -0.56, -2.4]));
        P.glow.push(tf(new THREE.BoxGeometry(0.05, 0.1, 1.6), [s * 2.13, -0.1, 0.2]));
        (s > 0 ? P.red : P.glow).push(tf(new THREE.SphereGeometry(0.16, 8, 6), [s * 7.55, -0.24, -3.0]));
      }
    } else {
      P.body.push(lathe([[0, 6.6], [0.6, 6.1], [1.0, 4.6], [1.25, 2.0], [1.3, -1.0], [1.15, -4.0], [0.9, -5.6], [0.0, -5.6]], 28, 1.7, 0.66));
      P.white.push(tf(new THREE.SphereGeometry(1, 24, 14), [0, 0.35, 3.8], [0, 0, 0], [1.25, 0.95, 1.4]));                          // big round head
      P.red.push(tf(new THREE.SphereGeometry(0.55, 16, 12), [0, 0.42, 5.0]));                                                        // cyclops eye
      P.dark.push(tf(new THREE.TorusGeometry(0.62, 0.12, 8, 20), [0, 0.42, 4.95]));
      for (const s of [-1, 1]) {
        P.body.push(plate([[s * 1.3, 2.6], [s * 6.4, -2.6], [s * 6.6, -3.8], [s * 3.0, -3.4], [s * 1.1, -5.2]], 0.24, 0.1).translate(0, -0.14, 0));
        P.orange.push(plate([[s * 5.6, -1.9], [s * 6.6, -2.7], [s * 6.8, -3.9], [s * 5.7, -3.6]], 0.27, 0.1).translate(0, -0.15, 0));
        P.body.push(tf(fin([[-2.4, 0], [-4.4, 2.8], [-5.6, 2.8], [-5.8, 0]], 0.2), [s * 0.75, 0.2, 0], [0, 0, -s * 0.72]));
        P.red.push(tf(new THREE.BoxGeometry(0.12, 0.12, 2.2), [s * 3.6, 0.15, -1.3], [0, -s * 0.84, 0]));
        P.dark.push(tf(new RoundedBoxGeometry(1.0, 0.6, 1.8, 2, 0.15), [s * 1.45, -0.3, 1.4]));
      }
      P.dark.push(tf(new THREE.CylinderGeometry(0.82, 0.7, 1.2, 18, 1, true), [0, 0, -6.1], [Math.PI / 2, 0, 0]));
      P.orange.push(tf(new THREE.TorusGeometry(0.76, 0.1, 8, 20), [0, 0, -6.7]));
      P.engine.push(tf(new THREE.CircleGeometry(0.7, 18), [0, 0, -6.2], [0, Math.PI, 0]));
    }
    const out = {}; for (const k in P) out[k] = merge(P[k]);
    out.outline = outlineGeo(merge(['body', 'white', 'blue', 'orange', 'dark', 'glass'].flatMap(k => P[k].map(g => g.clone()))));
    return out;
  }
  jet(kind) {
    const G = this.jetGeo[kind], g = new THREE.Group(), player = kind === 'player';
    const mats = { body: player ? this.mPlayer : this.mDrone, white: player ? this.mWhite : this.mHead, blue: player ? this.mBlue : this.mPurple, orange: player ? this.mOrange : this.mHaz, dark: this.mDark, glass: this.mGlass, glow: this.mGlow, red: this.mRed, engine: player ? this.mEngine : this.mRed };
    for (const k in mats) if (G[k]) { const m = new THREE.Mesh(G[k], mats[k]); m.castShadow = player && !['glow', 'red', 'engine'].includes(k); m.receiveShadow = player; g.add(m); if (k === 'glass') g.userData.glass = m; }
    const ol = new THREE.Mesh(G.outline, this.ink); g.add(ol); g.userData.outline = ol;
    const flames = [], fm = player ? this.flameMat('#ffffff', '#ff8a1e') : this.flameMat('#ffe0f0', '#ff2a8a');
    const nozz = player ? [[-0.7, -0.05, -9.25], [0.7, -0.05, -9.25]] : [[0, 0, -6.3]];
    for (const p of nozz) { const f = new THREE.Mesh(tf(new THREE.CylinderGeometry(player ? 0.6 : 0.7, 0.15, 1, 18, 6, true).translate(0, -0.5, 0), [0, 0, 0], [Math.PI / 2, 0, 0]), fm); f.position.set(...p); f.renderOrder = 4; g.add(f); flames.push(f); }
    g.userData.flames = flames; g.userData.flameMat = fm; g.userData.nozzles = nozz.map(p => new V3(...p));
    g.userData.tips = player ? [new V3(-7.5, -0.2, -4.7), new V3(7.5, -0.2, -4.7)] : [new V3(-6.6, -0.1, -3.9), new V3(6.6, -0.1, -3.9)];
    if (player) {
      const rails = []; for (const [x, z] of [[-2.9, -2.2], [2.9, -2.2], [-4.8, -2.4], [4.8, -2.4]]) { const m = this.missileMesh(); m.position.set(x, -0.95, z); m.scale.setScalar(1.15); g.add(m); rails.push(m); }
      g.userData.rails = rails;
      for (const s of [-1, 1]) { const d = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), this.mDecal); d.rotation.x = -Math.PI / 2; d.position.set(s * 4.6, -0.1, -3.4); g.add(d); }
      for (const s of [-1, 1]) { const d2 = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), this.mDecal); d2.position.set(s * 1.3, 2.0, -6.9); d2.rotation.set(0, s * Math.PI / 2, -s * 0.33); g.add(d2); }
      const vap = new THREE.Mesh(tf(new THREE.ConeGeometry(2.8, 6, 28, 1, true), [0, 0.1, -0.5], [Math.PI / 2, 0, 0]), this.vapourMat()); vap.renderOrder = 5; g.add(vap); g.userData.vapour = vap;
      const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })); strobe.position.set(0, 4.05, -8.2); g.add(strobe); g.userData.strobe = strobe;
    }
    return g;
  }
  // ---------------------------------------------------------------- SAM site + its little base
  sam() {
    const g = new THREE.Group(), C = [], O = [], D = [], R = [], W = [], GL = [];
    C.push(tf(new THREE.CylinderGeometry(15, 16.5, 1.6, 8), [0, 0.3, 0]));
    O.push(tf(new THREE.TorusGeometry(16.5, 1.8, 6, 16), [0, 0.6, 0], [Math.PI / 2, 0, 0], [1, 1, 0.7]));
    O.push(tf(new THREE.CylinderGeometry(3.2, 3.8, 2.4, 12), [0, 2.2, 0]));
    // radar truck + dish mast
    O.push(tf(new RoundedBoxGeometry(4, 3, 9, 2, 0.3), [24, 2, 6])); D.push(tf(new THREE.BoxGeometry(4.2, 0.8, 9.2), [24, 0.6, 6]));
    O.push(tf(new THREE.CylinderGeometry(0.35, 0.35, 9, 6), [24, 7, 4]));
    for (const [x, z, r] of [[-26, -10, 6], [-30, 12, 5]]) { W.push(tf(new THREE.CylinderGeometry(r, r, 7, 16), [x, 3.5, z])); D.push(tf(new THREE.CylinderGeometry(r + 0.2, r + 0.2, 0.4, 16), [x, 7.1, z])); }
    // bunker with a lit window band + antenna lattice
    C.push(tf(new RoundedBoxGeometry(16, 6, 10, 2, 0.6), [6, 3, -30])); GL.push(tf(new THREE.BoxGeometry(12, 0.5, 0.1), [6, 4.4, -24.95]));
    for (let i = 0; i < 4; i++) D.push(tf(new THREE.BoxGeometry(0.25, 26, 0.25), [-12 + (i % 2) * 2.4, 13, -22 + (i >> 1) * 2.4]));
    for (let y = 3; y < 26; y += 4) D.push(tf(new THREE.BoxGeometry(2.6, 0.18, 2.6), [-10.8, y, -20.8]));
    R.push(tf(new THREE.SphereGeometry(0.5, 8, 6), [-10.8, 26.4, -20.8]));
    for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28; GL.push(tf(new THREE.BoxGeometry(0.5, 0.25, 0.5), [Math.cos(a) * 15.5, 1.2, Math.sin(a) * 15.5])); }
    const add = (geo, mat, shadow = true) => { const m = new THREE.Mesh(merge(geo), mat); m.castShadow = shadow; m.receiveShadow = true; g.add(m); if (mat.isMeshToonMaterial) g.add(new THREE.Mesh(outlineGeo(m.geometry), this.inkThin)); return m; };
    add(C, this.mConcrete); add(O, this.mOlive); add(D, this.mDark); add(W, this.mWhite); add(R, this.mRed, false); add(GL, this.mGlow, false);
    // rotating launcher with 4 tubes
    const turret = new THREE.Group(); turret.position.y = 4; g.add(turret);
    const pitch = new THREE.Group(); pitch.rotation.x = -0.6; turret.add(pitch);
    const LO = [tf(new RoundedBoxGeometry(5.6, 2.2, 3.2, 2, 0.3), [0, 0, -1])], LD = [];
    for (let i = 0; i < 4; i++) { const x = (i % 2 - 0.5) * 2.2, y = ((i >> 1) - 0.5) * 2.0 + 1.6; LO.push(tf(new THREE.CylinderGeometry(0.85, 0.85, 7.5, 12), [x, y, 1.5], [Math.PI / 2, 0, 0])); LD.push(tf(new THREE.CircleGeometry(0.7, 12), [x, y, 5.27])); }
    const lm = new THREE.Mesh(merge(LO), this.mOlive); lm.castShadow = true; pitch.add(lm); pitch.add(new THREE.Mesh(merge(LD), this.mDark));
    const dish = new THREE.Mesh(tf(new THREE.SphereGeometry(3.2, 16, 8, 0, Math.PI * 2, 0, 1.0), [0, 0, 0], [Math.PI / 2, 0, 0], [1, 1, 0.6]), this.mWhite); dish.position.set(24, 11.5, 4); g.add(dish);
    g.userData = { turret, pitch, dish, muzzle: new V3(0, 6, 5) };
    return g;
  }
  hangar() {
    const g = new THREE.Group(); const arch = new THREE.CylinderGeometry(14, 14, 40, 18, 1, false, 0, Math.PI); arch.rotateZ(Math.PI / 2); arch.rotateY(Math.PI / 2);
    const m = new THREE.Mesh(arch, this.mHull); m.castShadow = m.receiveShadow = true; g.add(m);
    const door = new THREE.Mesh(new THREE.CircleGeometry(13, 18, 0, Math.PI), this.mDark); door.position.z = 20.05; g.add(door);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(10, 0.4, 0.3), this.mGlow); lamp.position.set(0, 13, 20.3); g.add(lamp); return g;
  }
  // ---------------------------------------------------------------- the Leviathan drone carrier (bow toward +z)
  carrier() {
    const g = new THREE.Group(), H = [], D = [], W = [], GL = [], R = [];
    const outline = [[-22, -160], [24, -160], [30, -120], [37, 30], [33, 112], [12, 165], [-12, 155], [-30, 112], [-40, -10], [-30, -120]];
    const s = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)));
    const hull = new THREE.ExtrudeGeometry(s, { depth: 30, bevelEnabled: true, bevelThickness: 1, bevelSize: 1, bevelSegments: 1 }); hull.rotateX(-Math.PI / 2); hull.translate(0, -12, 0);
    const uv = hull.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 30, uv.getY(i) / 30);
    H.push(hull);
    H.push(tf(new THREE.CylinderGeometry(20, 6, 40, 12, 1), [0, -8, 140], [Math.PI / 2, 0, 0], [1, 1, 0.5]));
    // island superstructure
    H.push(tf(new RoundedBoxGeometry(13, 14, 34, 2, 0.8), [30, 25, -20])); H.push(tf(new RoundedBoxGeometry(10, 12, 22, 2, 0.6), [30, 37, -22])); H.push(tf(new RoundedBoxGeometry(8, 6, 12, 2, 0.5), [30, 46, -22]));
    for (const y of [22, 29, 35, 41]) GL.push(tf(new THREE.BoxGeometry(0.2, 0.9, y < 33 ? 30 : 18), [y < 33 ? 23.4 : 24.9, y, y < 33 ? -20 : -22]));
    D.push(tf(new THREE.CylinderGeometry(0.8, 1.2, 26, 8), [30, 60, -24])); for (const y of [56, 63, 69]) D.push(tf(new THREE.BoxGeometry(12 - (y - 56) * 0.4, 0.4, 0.6), [30, y, -24]));
    W.push(tf(new THREE.SphereGeometry(2.6, 14, 10), [26, 51, -14])); W.push(tf(new THREE.SphereGeometry(2.2, 14, 10), [34, 51, -30]));
    R.push(tf(new THREE.SphereGeometry(0.6, 8, 6), [30, 73.5, -24]));
    // deck-edge lights + catwalk details
    for (let z = -150; z < 150; z += 12) { GL.push(tf(new THREE.BoxGeometry(0.8, 0.3, 0.8), [-33 + Math.max(0, (z - 30) * 0.03) * 0, 18.6, z])); }
    for (let z = -140; z < 100; z += 24) D.push(tf(new THREE.BoxGeometry(3, 1.2, 10), [-41, 14, z]));
    const add = (geo, mat, sh = true) => { const m = new THREE.Mesh(merge(geo), mat); m.castShadow = sh; m.receiveShadow = true; g.add(m); if (mat.isMeshToonMaterial) g.add(new THREE.Mesh(outlineGeo(m.geometry), this.inkThin)); return m; };
    add(H, this.mHull); add(D, this.mDark); add(W, this.mWhite); add(GL, this.mGlow, false); add(R, this.mRed, false);
    // flight deck with markings
    const deckTex = canvas(256, 1024, (x, w, h) => {
      x.fillStyle = '#3a3d42'; x.fillRect(0, 0, w, h); for (let i = 0; i < 6000; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.07})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      x.strokeStyle = '#f5f5f0'; x.lineWidth = 3; x.setLineDash([18, 14]); x.beginPath(); x.moveTo(150, 980); x.lineTo(70, 380); x.stroke(); x.setLineDash([]);
      x.strokeStyle = '#e8c547'; x.lineWidth = 2; for (const xx of [60, 200]) { x.beginPath(); x.moveTo(xx, 40); x.lineTo(xx, 560); x.stroke(); }
      x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 2; x.beginPath(); x.moveTo(110, 1000); x.lineTo(40, 470); x.moveTo(190, 1000); x.lineTo(118, 470); x.stroke();
      x.fillStyle = '#f2f2ee'; x.font = 'bold 110px sans-serif'; x.textAlign = 'center'; x.save(); x.translate(128, 150); x.fillText('77', 0, 0); x.restore();
      for (let i = 0; i < 12; i++) { x.fillStyle = i % 2 ? '#c8352a' : '#f2f2ee'; x.fillRect(i * 22, h - 14, 22, 14); }
      x.strokeStyle = 'rgba(232,197,71,.8)'; x.strokeRect(160, 420, 70, 80); x.strokeRect(20, 620, 60, 70);
    });
    const dg = new THREE.ShapeGeometry(s); dg.rotateX(-Math.PI / 2); const du = dg.attributes.uv, dp = dg.attributes.position;
    for (let i = 0; i < du.count; i++) du.setXY(i, (dp.getX(i) + 42) / 84, (dp.getZ(i) + 165) / 335);   // ShapeGeometry y → -z after rotation; deck faces up
    const deck = new THREE.Mesh(dg, new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.85, metalness: 0.1 })); deck.position.y = 19.4; deck.receiveShadow = true; g.add(deck);
    const radar = new THREE.Mesh(new THREE.BoxGeometry(9, 2.2, 0.6), this.mDark); radar.position.set(30, 66, -24); g.add(radar);
    // parked drones (one instanced draw per material)
    const spots = [[-14, 70, 0.4], [-2, 90, 0.4], [10, 110, 0.4], [-18, -80, -0.3], [-6, -100, -0.3], [8, -120, -0.3]], parked = [];
    for (const k of ['body', 'dark', 'red']) {
      const mat = k === 'body' ? this.mDrone : k === 'dark' ? this.mDark : this.mRed, im = new THREE.InstancedMesh(this.jetGeo.drone[k], mat, spots.length);
      spots.forEach(([x, z, r], i) => im.setMatrixAt(i, new THREE.Matrix4().compose(new V3(x, 20, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r, 0)), new V3(1, 1, 1)))); im.castShadow = k === 'body'; g.add(im); parked.push(im);
    }
    // CIWS turrets (weak points)
    const turrets = [];
    for (const [x, z] of [[-30, 118], [28, 128], [-36, -60], [30, -130]]) {
      const t = new THREE.Group(); t.position.set(x, 18.6, z); g.add(t);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 3, 12), this.mHull); base.position.y = 1.5; base.castShadow = true; t.add(base);
      const yaw = new THREE.Group(); yaw.position.y = 3; t.add(yaw);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(2.6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), this.mWhite); dome.castShadow = true; yaw.add(dome);
      const pitch = new THREE.Group(); pitch.position.y = 1.2; yaw.add(pitch);
      const gun = new THREE.Mesh(tf(new THREE.CylinderGeometry(0.4, 0.5, 5, 8), [0, 0, 2.8], [Math.PI / 2, 0, 0]), this.mDark); pitch.add(gun);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), this.mRed); eye.position.set(0, 1.2, 1.8); yaw.add(eye);
      turrets.push({ g: t, yaw, pitch, muzzle: new V3(0, 0, 5.4) });
    }
    // wake foam
    const wakeTex = canvas(128, 512, (x, w, h) => { x.clearRect(0, 0, w, h); for (let i = 0; i < 1600; i++) { const v = i / 1600, yy = v * h, spread = 10 + v * 54; const xx = w / 2 + (Math.random() - 0.5) * 2 * spread; x.fillStyle = `rgba(255,255,255,${(1 - v) * 0.35 * Math.random()})`; x.beginPath(); x.arc(xx, yy, 2 + Math.random() * 5, 0, 7); x.fill(); } });
    wakeTex.wrapS = wakeTex.wrapT = THREE.ClampToEdgeWrapping;
    const wake = new THREE.Mesh(new THREE.PlaneGeometry(140, 700), new THREE.MeshBasicMaterial({ map: wakeTex, transparent: true, depthWrite: false, color: 0xdfe8ee })); wake.rotation.x = -Math.PI / 2; wake.position.set(0, 0.8, -500); wake.renderOrder = 1; g.add(wake);
    g.userData = { turrets, radar, parked };
    return g;
  }
  // ---------------------------------------------------------------- the Halcyon airborne fortress (nose toward +z)
  fortress() {
    const g = new THREE.Group(), B = [], D = [], GL = [], R = [];
    const wing = []; for (const s of [1, -1]) wing.push([s * 0, 55], [s * 125, -18], [s * 122, -40], [s * 70, -30], [s * 36, -50]);
    const pts = [[0, 55], [125, -18], [122, -40], [70, -30], [36, -50], [0, -42], [-36, -50], [-70, -30], [-122, -40], [-125, -18]];
    B.push(plate(pts, 5, 1.6).translate(0, -2.5, 0));
    B.push(tf(new THREE.SphereGeometry(1, 32, 16), [0, 1, 0], [0, 0, 0], [22, 9, 58]));
    B.push(tf(new THREE.SphereGeometry(1, 24, 12), [0, 6, 12], [0, 0, 0], [8, 5, 20]));
    for (const s of [-1, 1]) { B.push(tf(fin([[-20, 0], [-36, 24], [-46, 24], [-44, 0]], 1.2), [s * 30, 2, 0], [0, 0, -s * 0.25])); }
    const engines = [];
    for (const x of [-78, -42, 42, 78]) {
      const z = 10 - Math.abs(x) * 0.42;
      B.push(tf(new THREE.CylinderGeometry(5.2, 4.6, 26, 18), [x, -4.5, z], [Math.PI / 2, 0, 0]));
      D.push(tf(new THREE.TorusGeometry(5.0, 0.7, 8, 18), [x, -4.5, z + 13]));
      D.push(tf(new THREE.CircleGeometry(4.5, 18), [x, -4.5, z + 12.8]));
      GL.push(tf(new THREE.CircleGeometry(4.2, 18), [x, -4.5, z - 13.1], [0, Math.PI, 0]));
      engines.push(new V3(x, -4.5, z - 14));
    }
    for (let i = 0; i <= 20; i++) { const t = i / 20, x = 125 * t; R.push(tf(new THREE.BoxGeometry(1.2, 0.5, 1.2), [x, 0.2, 55 - 73 * t])); R.push(tf(new THREE.BoxGeometry(1.2, 0.5, 1.2), [-x, 0.2, 55 - 73 * t])); }
    for (const s of [-1, 1]) GL.push(tf(new THREE.BoxGeometry(60, 0.3, 0.4), [s * 50, 2.8, 8], [0, s * 0.53, 0]));
    const add = (geo, mat, sh = true) => { const m = new THREE.Mesh(merge(geo), mat); m.castShadow = sh; m.receiveShadow = sh; g.add(m); if (mat.isMeshToonMaterial) g.add(new THREE.Mesh(outlineGeo(m.geometry), this.inkThin)); return m; };
    add(B, this.mBoss); add(D, this.mDark); add(GL, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 3.5, 5) }), false); add(R, this.mRed, false);
    const pods = [];
    for (const [x, y, z] of [[-55, 3, -5], [55, 3, -5], [-95, 2, -25], [95, 2, -25], [-20, -9, 20], [20, -9, 20]]) {
      const t = new THREE.Group(); t.position.set(x, y, z); g.add(t); const up = y > 0 ? 1 : -1;
      const dome = new THREE.Mesh(new THREE.SphereGeometry(4.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), this.mHead); if (up < 0) dome.rotation.x = Math.PI; t.add(dome);
      const yaw = new THREE.Group(); yaw.position.y = up * 2.6; t.add(yaw);
      const pitch = new THREE.Group(); yaw.add(pitch);
      for (const s of [-1, 1]) pitch.add(new THREE.Mesh(tf(new THREE.CylinderGeometry(0.45, 0.6, 7, 8), [s * 1.1, 0, 3.6], [Math.PI / 2, 0, 0]), this.mBoss));
      const eye = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), this.mRed); eye.position.set(0, up * 1.2, 1.6); yaw.add(eye);
      pods.push({ g: t, yaw, pitch, muzzle: new V3(0, 0, 7.5), up });
    }
    const coreMat = new THREE.MeshStandardMaterial({ color: 0x330018, emissive: 0xff2a8a, emissiveIntensity: 2.5, metalness: 0.2, roughness: 0.2 });
    const core = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 16), coreMat); core.position.set(0, -10, -8); g.add(core);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(8.4, 1.4, 10, 28), this.mDark); ring.rotation.x = Math.PI / 2; ring.position.copy(core.position); g.add(ring);
    g.userData = { pods, engines, core, coreMat, ring };
    return g;
  }
  // ---------------------------------------------------------------- cockpit (camera sits at its origin, looking +z)
  cockpit() {
    const g = new THREE.Group(), D = [], F = [];
    D.push(tf(new RoundedBoxGeometry(1.7, 0.5, 0.5, 2, 0.08), [0, -0.6, 0.98]));
    D.push(tf(new RoundedBoxGeometry(1.3, 0.1, 0.4, 2, 0.04), [0, -0.33, 1.02], [-0.15, 0, 0]));
    for (const s of [-1, 1]) { D.push(tf(new THREE.BoxGeometry(0.12, 0.5, 2.6), [s * 0.66, -0.55, -0.1])); D.push(tf(new THREE.BoxGeometry(0.3, 0.06, 1.2), [s * 0.55, -0.32, 0.0])); }
    for (const z of [1.25, -0.25]) F.push(tf(new THREE.TorusGeometry(z > 0 ? 0.7 : 0.78, 0.016, 6, 24, Math.PI), [0, -0.2, z], [0, 0, 0], [1.1, 0.95, 1]));
    F.push(tf(new THREE.BoxGeometry(0.04, 0.04, 1.5), [0, 0.5, 0.45]));
    g.add(new THREE.Mesh(merge(D), toon('#4a4f74')));
    g.add(new THREE.Mesh(merge(F), this.mDark));
    const mfd = document.createElement('canvas'); mfd.width = 384; mfd.height = 128; const tex = new THREE.CanvasTexture(mfd); tex.colorSpace = THREE.SRGBColorSpace;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.42), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.3 }));
    scr.position.set(0, -0.43, 0.72); scr.rotation.set(-0.5, Math.PI, 0); scr.rotation.order = 'YXZ'; g.add(scr);
    const hud = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.32), new THREE.MeshPhysicalMaterial({ color: 0x7affc8, transparent: true, opacity: 0.08, roughness: 0, metalness: 0, depthWrite: false })); hud.position.set(0, -0.12, 0.95); hud.rotation.set(0.2, Math.PI, 0); g.add(hud);
    g.userData = { mfd, tex };
    return g;
  }
}
