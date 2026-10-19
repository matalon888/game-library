// Voidlance effects: pooled particles (additive fire/sparks + alpha smoke), laser bolts, debris, shockwave rings,
// flashes and a small pool of point lights. Everything is pooled: nothing is allocated per shot.
import * as THREE from './kit/three.module.min.js';

const V = new THREE.Vector3(), V2 = new THREE.Vector3(), Q = new THREE.Quaternion(), M = new THREE.Matrix4(), Z = new THREE.Vector3(0, 0, 1), ONE = new THREE.Vector3(1, 1, 1);

export function glowTex(kind = 'glow') {
  const n = 128, c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d');
  if (kind === 'smoke') {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * 6.28, r = Math.random() * n * 0.2, px = n / 2 + Math.cos(a) * r, py = n / 2 + Math.sin(a) * r, rr = n * (0.12 + Math.random() * 0.18);
      const g = x.createRadialGradient(px, py, 0, px, py, rr); g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n);
    }
  } else if (kind === 'ring') {
    const g = x.createRadialGradient(n / 2, n / 2, n * 0.3, n / 2, n / 2, n / 2); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.75, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n);
  } else if (kind === 'star') {
    const g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.15, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n);
    x.globalCompositeOperation = 'lighter'; for (const [w, h] of [[n, 3], [3, n]]) { const l = x.createLinearGradient(0, 0, w === n ? n : 0, h === n ? n : 0); l.addColorStop(0, 'rgba(255,255,255,0)'); l.addColorStop(0.5, 'rgba(255,255,255,.8)'); l.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = l; x.fillRect((n - w) / 2, (n - h) / 2, w, h); }
  } else {
    const g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.55)'); g.addColorStop(0.6, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------------------------------------------------------------- particles
const PV = `attribute float aSize; attribute float aAlpha; attribute vec3 aColor; varying vec3 vC; varying float vA; uniform float uScale;
void main(){ vC = aColor; vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = min(aSize * uScale / max(-mv.z, .1), 600.); }`;
const PF = `uniform sampler2D uMap; varying vec3 vC; varying float vA; void main(){ vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vC * t.rgb, t.a * vA); }`;
export class Particles {
  constructor(scene, max, { additive = true, tex }) {
    this.max = max; this.n = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.size = new Float32Array(max); this.alpha = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({ uniforms: { uScale: { value: 800 }, uMap: { value: tex } }, vertexShader: PV, fragmentShader: PF, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = additive ? 3 : 2; scene.add(this.points);
    this.geo = g;
    const f = () => new Float32Array(max);
    this.px = f(); this.py = f(); this.pz = f(); this.vx = f(); this.vy = f(); this.vz = f(); this.life = f(); this.ml = f(); this.s0 = f(); this.s1 = f();
    this.r = f(); this.g = f(); this.b = f(); this.a0 = f(); this.drag = f(); this.fade = f();
  }
  spawn(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a = 1, drag = 0, fade = 1) {
    let i = this.n; if (i >= this.max) i = (Math.random() * this.max) | 0; else this.n++;
    this.px[i] = x; this.py[i] = y; this.pz[i] = z; this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz; this.life[i] = this.ml[i] = life;
    this.s0[i] = s0; this.s1[i] = s1; this.r[i] = r; this.g[i] = g; this.b[i] = b; this.a0[i] = a; this.drag[i] = drag; this.fade[i] = fade;
  }
  update(dt) {
    const P = this;
    for (let i = 0; i < P.n; i++) {
      P.life[i] -= dt;
      if (P.life[i] <= 0) { const j = --P.n; for (const k of ['px', 'py', 'pz', 'vx', 'vy', 'vz', 'life', 'ml', 's0', 's1', 'r', 'g', 'b', 'a0', 'drag', 'fade']) P[k][i] = P[k][j]; i--; continue; }
      const d = Math.max(0, 1 - P.drag[i] * dt);
      P.vx[i] *= d; P.vy[i] *= d; P.vz[i] *= d;
      P.px[i] += P.vx[i] * dt; P.py[i] += P.vy[i] * dt; P.pz[i] += P.vz[i] * dt;
      const t = 1 - P.life[i] / P.ml[i], i3 = i * 3;
      P.pos[i3] = P.px[i]; P.pos[i3 + 1] = P.py[i]; P.pos[i3 + 2] = P.pz[i];
      const heat = P.fade[i] > 1 ? Math.max(0, 1 - t * P.fade[i]) : 1;      // fire cools toward smoke colour
      P.col[i3] = P.r[i] * (0.25 + 0.75 * heat); P.col[i3 + 1] = P.g[i] * heat * heat; P.col[i3 + 2] = P.b[i] * heat * heat;
      P.size[i] = P.s0[i] + (P.s1[i] - P.s0[i]) * Math.sqrt(t);
      P.alpha[i] = P.a0[i] * (t < 0.08 ? t / 0.08 : 1 - (t - 0.08) / 0.92);
    }
    this.geo.setDrawRange(0, this.n);
    for (const k of ['position', 'aColor', 'aSize', 'aAlpha']) this.geo.attributes[k].needsUpdate = true;
  }
  clear() { this.n = 0; this.geo.setDrawRange(0, 0); }
}

// ---------------------------------------------------------------- bolts (instanced, HDR colour so they bloom)
export class Bolts {
  constructor(scene, max, color, { len = 9, width = 0.22 } = {}) {
    const g = new THREE.CylinderGeometry(width, width, 1, 6, 1, true); g.rotateX(Math.PI / 2); g.translate(0, 0, -0.5);
    this.mat = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    this.mesh = new THREE.InstancedMesh(g, this.mat, max); this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.renderOrder = 4; scene.add(this.mesh);
    this.max = max; this.list = []; this.len = len;
    for (let i = 0; i < max; i++) this.list.push({ on: false, p: new THREE.Vector3(), d: new THREE.Vector3(), prev: new THREE.Vector3(), sp: 0, life: 0, dmg: 0, owner: null, w: 1 });
    this.n = 0;
  }
  fire(p, dir, sp, dmg, life, owner, w = 1) {
    let b = this.list.find(b => !b.on); if (!b) b = this.list[(Math.random() * this.max) | 0];
    b.on = true; b.p.copy(p); b.prev.copy(p); b.d.copy(dir).normalize(); b.sp = sp; b.dmg = dmg; b.life = life; b.owner = owner; b.w = w; b.age = 0;
    return b;
  }
  update(dt, hit) {
    let n = 0;
    for (const b of this.list) {
      if (!b.on) continue;
      b.prev.copy(b.p); b.p.addScaledVector(b.d, b.sp * dt); b.life -= dt; b.age += dt;
      if (b.life <= 0 || hit(b)) { b.on = false; continue; }
      const L = Math.min(this.len, b.age * b.sp);
      Q.setFromUnitVectors(Z, b.d); V2.set(b.w, b.w, L); M.compose(b.p, Q, V2); this.mesh.setMatrixAt(n++, M);
    }
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true;
  }
  clear() { for (const b of this.list) b.on = false; this.mesh.count = 0; }
}

// ---------------------------------------------------------------- debris chunks
export class Debris {
  constructor(scene, max, mat) {
    const g = new THREE.DodecahedronGeometry(1, 0); g.scale(1, 0.45, 0.8);
    this.mesh = new THREE.InstancedMesh(g, mat, max); this.mesh.frustumCulled = false; this.mesh.count = 0; scene.add(this.mesh);
    this.list = []; this.max = max;
    for (let i = 0; i < max; i++) this.list.push({ on: false, p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), w: new THREE.Vector3(), s: 1, life: 0, hot: 0 });
  }
  spawn(p, v, s, life = 3, hot = 1) {
    let d = this.list.find(d => !d.on); if (!d) d = this.list[(Math.random() * this.max) | 0];
    d.on = true; d.p.copy(p); d.v.copy(v); d.q.random(); d.w.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(8); d.s = s; d.life = life; d.ml = life; d.hot = hot;
  }
  update(dt, fire, smoke) {
    let n = 0;
    for (const d of this.list) {
      if (!d.on) continue;
      d.life -= dt; if (d.life <= 0) { d.on = false; continue; }
      d.p.addScaledVector(d.v, dt); Q.setFromAxisAngle(V.copy(d.w).normalize(), d.w.length() * dt); d.q.premultiply(Q);
      if (d.hot > 0 && Math.random() < 0.7) {
        const k = d.life / d.ml;
        fire.spawn(d.p.x, d.p.y, d.p.z, d.v.x * 0.1, d.v.y * 0.1, d.v.z * 0.1, 0.35, d.s * 1.6 * k, d.s * 0.4, 3.5, 1.3, 0.35, 0.9 * k, 2);
        if (Math.random() < 0.35) smoke.spawn(d.p.x, d.p.y, d.p.z, 0, 0, 0, 1.4, d.s * 1.2, d.s * 4, 0.09, 0.085, 0.09, 0.45 * k, 0);
      }
      const sc = d.s * Math.min(1, d.life * 2); V2.set(sc, sc, sc); M.compose(d.p, d.q, V2); this.mesh.setMatrixAt(n++, M);
    }
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true;
  }
  clear() { for (const d of this.list) d.on = false; this.mesh.count = 0; }
}

// ---------------------------------------------------------------- pooled meshes: shockwave rings + flash spheres + light pool
export class Blasts {
  constructor(scene, lite) {
    this.rings = []; this.flashes = []; this.lights = [];
    const rg = new THREE.RingGeometry(0.93, 1, 72, 1), fg = new THREE.SphereGeometry(1, 20, 14);
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
      m.visible = false; m.renderOrder = 5; scene.add(m); this.rings.push({ m, t: 1, dur: 1, size: 1 });
      const f = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      f.visible = false; f.renderOrder = 5; scene.add(f); this.flashes.push({ m: f, t: 1, dur: 1, size: 1 });
    }
    for (let i = 0; i < (lite ? 2 : 4); i++) { const L = new THREE.PointLight(0xffaa66, 0, 0, 2); scene.add(L); this.lights.push({ L, t: 1, dur: 1, I: 0 }); }
  }
  ring(p, size, color, dur = 0.8, q = null) {
    const r = this.rings.find(r => r.t >= 1) || this.rings[0]; r.t = 0; r.dur = dur; r.size = size;
    r.m.position.copy(p); if (q) r.m.quaternion.copy(q); else r.m.quaternion.random(); r.m.material.color.copy(color); r.m.visible = true; r.c = r.m.material.color.clone();
  }
  flash(p, size, color, dur = 0.35) {
    const f = this.flashes.find(r => r.t >= 1) || this.flashes[0]; f.t = 0; f.dur = dur; f.size = size; f.m.position.copy(p); f.c = color.clone(); f.m.visible = true;
  }
  light(p, I, color, dur = 0.4) {
    let l = this.lights.find(l => l.t >= 1); if (!l) l = this.lights.reduce((a, b) => (a.I * (1 - a.t) < b.I * (1 - b.t) ? a : b));
    l.t = 0; l.dur = dur; l.I = I; l.L.position.copy(p); l.L.color.copy(color);
  }
  update(dt) {
    for (const r of this.rings) if (r.t < 1) { r.t = Math.min(1, r.t + dt / r.dur); const e = 1 - Math.pow(1 - r.t, 3); r.m.scale.setScalar(0.1 + r.size * e); r.m.material.color.copy(r.c).multiplyScalar(Math.pow(1 - r.t, 1.5)); if (r.t >= 1) r.m.visible = false; }
    for (const f of this.flashes) if (f.t < 1) { f.t = Math.min(1, f.t + dt / f.dur); f.m.scale.setScalar(f.size * (0.35 + 0.65 * Math.sqrt(f.t))); f.m.material.color.copy(f.c).multiplyScalar(Math.pow(1 - f.t, 2)); if (f.t >= 1) f.m.visible = false; }
    for (const l of this.lights) { if (l.t < 1) l.t = Math.min(1, l.t + dt / l.dur); l.L.intensity = l.I * Math.pow(1 - l.t, 2); }
  }
}
export { ONE };
