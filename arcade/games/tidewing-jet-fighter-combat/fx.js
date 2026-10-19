// Tidewing effects: GPU-billboarded particle pools (smoke, fire, sparks, flares, spray), tracer pool,
// one-draw-call ribbon batch (wingtip vortices), explosion composer, flash-light pool, debris.
import * as THREE from './kit/three.module.min.js';

function canvasTex(n, draw) { const c = document.createElement('canvas'); c.width = c.height = n; draw(c.getContext('2d'), n); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
export const smokeTex = () => canvasTex(128, (x, n) => {          // cartoon puff: a few round blobs, soft rim, lit from the top-left
  const blobs = [[64, 64, 40], [44, 56, 26], [84, 54, 28], [60, 84, 26], [86, 80, 22], [40, 80, 20]];
  for (const [cx, cy, r] of blobs) { const g = x.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.75, 'rgba(225,228,240,1)'); g.addColorStop(0.92, 'rgba(200,205,225,.9)'); g.addColorStop(1, 'rgba(200,205,225,0)'); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); }
});
export const glowTex = () => canvasTex(64, (x, n) => { const g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.55)'); g.addColorStop(0.6, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); });
export const fireTex = () => canvasTex(128, (x, n) => { const g = x.createRadialGradient(54, 54, 4, 64, 64, 60); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(255,255,255,.95)'); g.addColorStop(0.85, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.arc(64, 64, 62, 0, 7); x.fill(); });
export const ringTex = () => canvasTex(128, (x, n) => { const g = x.createRadialGradient(n / 2, n / 2, n * 0.3, n / 2, n / 2, n / 2); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.7, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); });

const VS = `attribute vec3 iPos; attribute float iSize; attribute vec4 iCol; attribute float iRot;
varying vec2 vUv; varying vec4 vCol; varying float vFog; uniform float uFogD;
void main(){ vUv = uv; vCol = iCol; vec4 mv = viewMatrix * vec4(iPos, 1.0); float c = cos(iRot), s = sin(iRot);
  mv.xy += vec2(c * position.x - s * position.y, s * position.x + c * position.y) * iSize;
  float d = -mv.z; vFog = 1.0 - exp(-uFogD * uFogD * d * d); gl_Position = projectionMatrix * mv; }`;
const FS = `uniform sampler2D map; uniform vec3 uFogC; uniform float uAdd; varying vec2 vUv; varying vec4 vCol; varying float vFog;
void main(){ vec4 t = texture2D(map, vUv); vec4 c = vCol * t; if (c.a < 0.003) discard;
  if (uAdd > 0.5) c.rgb *= (1.0 - vFog); else c.rgb = mix(c.rgb, uFogC, vFog);
  gl_FragColor = c; }`;

export class Particles {
  constructor(scene, max, tex, additive, fog) {
    this.max = max; this.n = 0;
    const g = new THREE.InstancedBufferGeometry(); const q = new THREE.PlaneGeometry(1, 1);
    g.index = q.index; g.attributes.position = q.attributes.position; g.attributes.uv = q.attributes.uv;
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.InstancedBufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aRot = new THREE.InstancedBufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.aPos); g.setAttribute('iSize', this.aSize); g.setAttribute('iCol', this.aCol); g.setAttribute('iRot', this.aRot);
    g.instanceCount = 0; this.g = g;
    this.mat = new THREE.ShaderMaterial({ uniforms: { map: { value: tex }, uFogC: fog.c, uFogD: fog.d, uAdd: { value: additive ? 1 : 0 } }, vertexShader: VS, fragmentShader: FS,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = additive ? 3 : 2; scene.add(this.mesh);
    const F = n => new Float32Array(max * n);
    this.p = F(3); this.v = F(3); this.life = F(1); this.ml = F(1); this.s0 = F(1); this.s1 = F(1); this.c0 = F(4); this.c1 = F(4); this.rot = F(1); this.rv = F(1); this.drag = F(1); this.grav = F(1);
  }
  emit(x, y, z, vx, vy, vz, life, s0, s1, c0, c1, drag = 0.5, grav = 0) {
    let i = this.n; if (i >= this.max) i = (Math.random() * this.max) | 0; else this.n++;
    const i3 = i * 3, i4 = i * 4; this.p[i3] = x; this.p[i3 + 1] = y; this.p[i3 + 2] = z; this.v[i3] = vx; this.v[i3 + 1] = vy; this.v[i3 + 2] = vz;
    this.life[i] = this.ml[i] = life; this.s0[i] = s0; this.s1[i] = s1; for (let k = 0; k < 4; k++) { this.c0[i4 + k] = c0[k]; this.c1[i4 + k] = c1[k]; }
    this.rot[i] = Math.random() * 6.28; this.rv[i] = (Math.random() - 0.5) * 1.2; this.drag[i] = drag; this.grav[i] = grav;
  }
  copy(a, b) {
    const a3 = a * 3, b3 = b * 3, a4 = a * 4, b4 = b * 4;
    for (let k = 0; k < 3; k++) { this.p[a3 + k] = this.p[b3 + k]; this.v[a3 + k] = this.v[b3 + k]; }
    for (let k = 0; k < 4; k++) { this.c0[a4 + k] = this.c0[b4 + k]; this.c1[a4 + k] = this.c1[b4 + k]; }
    this.life[a] = this.life[b]; this.ml[a] = this.ml[b]; this.s0[a] = this.s0[b]; this.s1[a] = this.s1[b]; this.rot[a] = this.rot[b]; this.rv[a] = this.rv[b]; this.drag[a] = this.drag[b]; this.grav[a] = this.grav[b];
  }
  update(dt) {
    const P = this.aPos.array, S = this.aSize.array, C = this.aCol.array, R = this.aRot.array;
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.n--; if (i !== this.n) { this.copy(i, this.n); i--; } continue; }
      const i3 = i * 3, i4 = i * 4, t = 1 - this.life[i] / this.ml[i], dr = Math.max(0, 1 - this.drag[i] * dt);
      this.v[i3] *= dr; this.v[i3 + 1] = this.v[i3 + 1] * dr + this.grav[i] * dt; this.v[i3 + 2] *= dr;
      this.p[i3] += this.v[i3] * dt; this.p[i3 + 1] += this.v[i3 + 1] * dt; this.p[i3 + 2] += this.v[i3 + 2] * dt;
      P[i3] = this.p[i3]; P[i3 + 1] = this.p[i3 + 1]; P[i3 + 2] = this.p[i3 + 2];
      const e = 1 - (1 - t) * (1 - t); S[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * e;
      const fade = Math.min(1, t * 12) * (t > 0.6 ? (1 - t) / 0.4 : 1);
      for (let k = 0; k < 3; k++) C[i4 + k] = this.c0[i4 + k] + (this.c1[i4 + k] - this.c0[i4 + k]) * t;
      C[i4 + 3] = (this.c0[i4 + 3] + (this.c1[i4 + 3] - this.c0[i4 + 3]) * t) * fade;
      this.rot[i] += this.rv[i] * dt; R[i] = this.rot[i];
    }
    this.g.instanceCount = this.n;
    for (const a of [this.aPos, this.aSize, this.aCol, this.aRot]) { a.needsUpdate = true; a.clearUpdateRanges(); a.addUpdateRange(0, this.n * a.itemSize); }
  }
  clear() { this.n = 0; this.g.instanceCount = 0; }
}

// ---------------------------------------------------------------- tracers (instanced stretched boxes, HDR so they bloom)
export class Tracers {
  constructor(scene, max = 400) {
    const g = new THREE.BoxGeometry(0.35, 0.35, 1); g.translate(0, 0, -0.5);
    this.mesh = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }), max); this.mesh.frustumCulled = false; this.mesh.count = 0;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.setColorAt(0, new THREE.Color()); scene.add(this.mesh); this.max = max; this.list = [];
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.s = new THREE.Vector3(); this.z = new THREE.Vector3(0, 0, 1); this.d = new THREE.Vector3(); this.c = new THREE.Color();
  }
  add(pos, vel, life, owner, dmg, color, len = 22, width = 1) { if (this.list.length >= this.max) this.list.shift(); const b = { p: pos.clone(), v: vel.clone(), life, owner, dmg, color, len, w: width, prev: pos.clone() }; this.list.push(b); return b; }
  update(dt, hit) {
    const L = this.list; let w = 0;
    for (let i = 0; i < L.length; i++) {
      const b = L[i]; b.prev.copy(b.p); b.p.addScaledVector(b.v, dt); b.life -= dt;
      if (b.life > 0 && !hit(b)) L[w++] = b;
    }
    L.length = w; const M = this.mesh;
    for (let i = 0; i < w; i++) {
      const b = L[i]; this.d.copy(b.v).normalize(); this.q.setFromUnitVectors(this.z, this.d); this.s.set(b.w, b.w, b.len);
      this.m.compose(b.p, this.q, this.s); M.setMatrixAt(i, this.m); M.setColorAt(i, this.c.setRGB(b.color[0], b.color[1], b.color[2]));
    }
    M.count = w; M.instanceMatrix.needsUpdate = true; if (M.instanceColor) M.instanceColor.needsUpdate = true;
  }
  clear() { this.list.length = 0; this.mesh.count = 0; }
}

// ---------------------------------------------------------------- ribbons (one geometry, many trails)
export class Ribbons {
  constructor(scene, R = 40, N = 48, fog) {
    this.R = R; this.N = N; const V = R * N * 2;
    this.pos = new Float32Array(V * 3); this.alpha = new Float32Array(V);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const idx = []; for (let r = 0; r < R; r++) for (let i = 0; i < N - 1; i++) { const a = (r * N + i) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx); this.g = g;
    const m = new THREE.ShaderMaterial({ uniforms: { uFogC: fog.c, uFogD: fog.d, uCol: { value: new THREE.Color(1, 1, 1) } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: 'attribute float alpha; varying float vA; varying float vF; uniform float uFogD; void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.); float d=-mv.z; vF = 1.0-exp(-uFogD*uFogD*d*d); gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'uniform vec3 uFogC; uniform vec3 uCol; varying float vA; varying float vF; void main(){ gl_FragColor = vec4(mix(uCol, uFogC, vF), vA); }' });
    this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = false; this.mesh.renderOrder = 2; scene.add(this.mesh);
    this.tr = []; for (let r = 0; r < R; r++) this.tr.push({ used: false, pts: [], width: 0.5, op: 0.5 });
    this.v = new THREE.Vector3(); this.side = new THREE.Vector3(); this.tc = new THREE.Vector3();
  }
  get() { const t = this.tr.find(t => !t.used); if (!t) return null; t.used = true; t.pts.length = 0; return t; }
  free(t) { if (t) { t.used = false; t.pts.length = 0; } }
  push(t, p, strength) { if (!t) return; t.pts.unshift({ x: p.x, y: p.y, z: p.z, s: strength }); if (t.pts.length > this.N) t.pts.length = this.N; }
  update(cam) {
    const P = this.pos, A = this.alpha, N = this.N; const cp = cam.position;
    for (let r = 0; r < this.R; r++) {
      const t = this.tr[r], pts = t.pts, base = r * N * 2;
      for (let i = 0; i < N; i++) {
        const k = base + i * 2;
        if (!t.used || i >= pts.length) { A[k] = A[k + 1] = 0; const q = pts[pts.length - 1] || { x: 0, y: -1e5, z: 0 }; for (const kk of [k, k + 1]) { P[kk * 3] = q.x; P[kk * 3 + 1] = q.y; P[kk * 3 + 2] = q.z; } continue; }
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], p = pts[i];
        this.v.set(a.x - b.x, a.y - b.y, a.z - b.z); this.tc.set(cp.x - p.x, cp.y - p.y, cp.z - p.z);
        this.side.crossVectors(this.v, this.tc).normalize(); const f = i / (N - 1), w = t.width * (0.4 + f * 1.6);
        P[k * 3] = p.x + this.side.x * w; P[k * 3 + 1] = p.y + this.side.y * w; P[k * 3 + 2] = p.z + this.side.z * w;
        P[k * 3 + 3] = p.x - this.side.x * w; P[k * 3 + 4] = p.y - this.side.y * w; P[k * 3 + 5] = p.z - this.side.z * w;
        A[k] = A[k + 1] = t.op * p.s * (1 - f) * Math.min(1, i / 2);
      }
    }
    this.g.attributes.position.needsUpdate = true; this.g.attributes.alpha.needsUpdate = true;
  }
  clear() { for (const t of this.tr) { t.used = false; t.pts.length = 0; } }
}

// ---------------------------------------------------------------- flash lights (fixed pool so shaders never recompile)
export class Flashes {
  constructor(scene, n = 4) { this.L = []; for (let i = 0; i < n; i++) { const l = new THREE.PointLight(0xffaa55, 0, 400, 1.6); l.position.y = -1e4; scene.add(l); this.L.push({ l, t: 0, d: 1, i: 0 }); } this.k = 0; }
  fire(pos, color = 0xffaa55, intensity = 4e5, dur = 0.5, dist = 600) { const f = this.L[this.k++ % this.L.length]; f.l.position.copy(pos); f.l.color.set(color); f.l.distance = dist; f.i = intensity; f.t = f.d = dur; }
  update(dt) { for (const f of this.L) { f.t = Math.max(0, f.t - dt); f.l.intensity = f.i * (f.t / f.d) ** 2; } }
}

// ---------------------------------------------------------------- debris (instanced shards that smoke and burn as they fall)
export class Debris {
  constructor(scene, max = 80) {
    const g = new THREE.BoxGeometry(1, 0.3, 1.6); const m = new THREE.MeshStandardMaterial({ color: 0x2b2f36, metalness: 0.7, roughness: 0.5, emissive: 0x401000, emissiveIntensity: 1 });
    this.mesh = new THREE.InstancedMesh(g, m, max); this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(this.mesh);
    this.list = []; this.max = max; this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.s = new THREE.Vector3();
  }
  add(pos, vel, size, life) { if (this.list.length >= this.max) this.list.shift(); this.list.push({ p: pos.clone(), v: vel.clone(), r: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6), rv: new THREE.Vector3().randomDirection().multiplyScalar(6), size, life, smoke: 0 }); }
  update(dt, fx, groundAt) {
    let w = 0; const L = this.list;
    for (const d of L) {
      d.v.y -= 9.8 * dt; d.v.multiplyScalar(1 - 0.25 * dt); d.p.addScaledVector(d.v, dt); d.r.addScaledVector(d.rv, dt); d.life -= dt; d.smoke -= dt;
      if (d.smoke <= 0) { d.smoke = 0.035; fx.smoke.emit(d.p.x, d.p.y, d.p.z, 0, 2, 0, 1.6, d.size * 1.2, d.size * 4, [0.4, 0.36, 0.48, 0.8], [0.75, 0.72, 0.85, 0], 0.4, 1.5);
        if (d.life > 1.2) fx.fire.emit(d.p.x, d.p.y, d.p.z, 0, 0, 0, 0.25, d.size * 2.2, d.size, [4, 1.6, 0.4, 0.9], [1.5, 0.3, 0.05, 0], 0); }
      const gy = groundAt(d.p.x, d.p.z);
      if (d.p.y < gy) { if (gy <= 0.5) fx.splash(d.p, d.size * 0.6); d.life = 0; }
      if (d.life > 0) L[w++] = d;
    }
    L.length = w;
    for (let i = 0; i < w; i++) { const d = L[i]; this.q.setFromEuler(this.e.set(d.r.x, d.r.y, d.r.z)); this.s.setScalar(d.size); this.m4.compose(d.p, this.q, this.s); this.mesh.setMatrixAt(i, this.m4); }
    this.mesh.count = w; this.mesh.instanceMatrix.needsUpdate = true;
  }
  clear() { this.list.length = 0; this.mesh.count = 0; }
}

// ---------------------------------------------------------------- composer: explosions, splashes, impacts
export class FX {
  constructor(scene, fog, lite) {
    this.lite = lite; const k = lite ? 0.6 : 1;
    this.smoke = new Particles(scene, Math.round(3200 * k), smokeTex(), false, fog);
    this.fire = new Particles(scene, Math.round(2200 * k), fireTex(), true, fog);
    this.glow = new Particles(scene, Math.round(900 * k), glowTex(), true, fog);
    this.ring = new Particles(scene, 40, ringTex(), true, fog);
    this.tracers = new Tracers(scene, 500);
    this.ribbons = new Ribbons(scene, 48, 44, fog);
    this.flashes = new Flashes(scene, 4);
    this.debris = new Debris(scene, lite ? 50 : 90);
    this.smokeLit = [0.75, 0.75, 0.78];
    this.groups = [this.smoke.mesh, this.fire.mesh, this.glow.mesh, this.ring.mesh, this.tracers.mesh, this.ribbons.mesh];
  }
  explode(p, scale = 1, { debris = 6, color = [5, 2.2, 0.6], water = false } = {}) {
    const R = Math.random, s = scale, L = this.smokeLit;
    this.glow.emit(p.x, p.y, p.z, 0, 0, 0, 0.35, 30 * s, 120 * s, [9, 6, 3.5, 1], [3, 1, 0.2, 0], 0);
    this.ring.emit(p.x, p.y, p.z, 0, 0, 0, 0.6, 8 * s, 150 * s, [3, 2.4, 1.8, 0.7], [1, 0.6, 0.3, 0], 0);
    for (let i = 0; i < 26 * Math.min(2.5, s) * (this.lite ? 0.6 : 1); i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar((20 + R() * 45) * s);
      this.fire.emit(p.x + v.x * 0.15, p.y + v.y * 0.15, p.z + v.z * 0.15, v.x, v.y, v.z, 0.5 + R() * 0.8, (8 + R() * 10) * s, (22 + R() * 22) * s, [color[0], color[1], color[2], 1], [1.4, 0.25, 0.05, 0], 2.2, 4);
    }
    for (let i = 0; i < 18 * Math.min(2.5, s) * (this.lite ? 0.6 : 1); i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar((8 + R() * 22) * s), g = 0.1 + R() * 0.12;
      this.smoke.emit(p.x + v.x * 0.3, p.y + v.y * 0.3, p.z + v.z * 0.3, v.x, v.y + 3, v.z, 3 + R() * 3.5, (10 + R() * 8) * s, (40 + R() * 40) * s, [0.32 + g, 0.28 + g, 0.4 + g, 0.95], [0.75, 0.72, 0.85, 0], 0.9, 2.5);
    }
    for (let i = 0; i < 24 * Math.min(2, s); i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(60 + R() * 140);
      this.glow.emit(p.x, p.y, p.z, v.x, v.y, v.z, 0.6 + R() * 0.9, 2.2, 0.6, [6, 3.2, 1.2, 1], [3, 0.8, 0.1, 0], 1.2, -30);
    }
    for (let i = 0; i < debris; i++) this.debris.add(p, new THREE.Vector3().randomDirection().multiplyScalar(30 + R() * 50).add(new THREE.Vector3(0, 15, 0)), 0.6 + R() * 1.6 * s, 2 + R() * 2.5);
    this.flashes.fire(p, 0xff9a4a, 2500 * s, 0.5, 500 * Math.sqrt(s));
    if (water) this.splash(p, 3 * s);
  }
  splash(p, s = 1) {
    const R = Math.random;
    for (let i = 0; i < 20 * Math.min(3, s); i++) { const a = R() * 6.28, sp = (4 + R() * 10) * s; this.smoke.emit(p.x + Math.cos(a) * 2 * s, 1, p.z + Math.sin(a) * 2 * s, Math.cos(a) * sp, (18 + R() * 30) * Math.sqrt(s), Math.sin(a) * sp, 1.6 + R() * 1.4, 3 * s, 14 * s, [1.6, 1.65, 1.7, 0.9], [1.1, 1.15, 1.2, 0], 0.4, -16); }
    this.ring.emit(p.x, 1, p.z, 0, 0, 0, 1.4, 4 * s, 50 * s, [1.2, 1.3, 1.4, 0.5], [0.6, 0.7, 0.8, 0], 0);
  }
  spark(p, n = 6, col = [6, 3.5, 1.2]) {
    for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(40 + Math.random() * 60); this.glow.emit(p.x, p.y, p.z, v.x, v.y, v.z, 0.25 + Math.random() * 0.3, 1.4, 0.4, [col[0], col[1], col[2], 1], [col[0] * 0.5, col[1] * 0.3, 0.1, 0], 2, -20); }
    this.glow.emit(p.x, p.y, p.z, 0, 0, 0, 0.12, 6, 10, [4, 3, 2, 1], [2, 1, 0.5, 0], 0);
  }
  update(dt, cam, groundAt) { this.smoke.update(dt); this.fire.update(dt); this.glow.update(dt); this.ring.update(dt); this.flashes.update(dt); this.debris.update(dt, this, groundAt); this.ribbons.update(cam); }
  clear() { this.smoke.clear(); this.fire.clear(); this.glow.clear(); this.ring.clear(); this.tracers.clear(); this.debris.clear(); this.ribbons.clear(); }
}
