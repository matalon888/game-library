// Zoomburst effects: cartoon smoke puffs, spark streaks, skid marks, speed lines and a radial speed blur pass.
import { THREE } from './kit/cine.js';
import { ShaderPass } from './kit/addons/postprocessing/ShaderPass.js';

export class Puffs {
  constructor(scene, max = 700) {
    this.max = max; this.i = 0;
    const g = new THREE.BufferGeometry();
    this.P = new Float32Array(max * 3); this.Cc = new Float32Array(max * 3); this.A = new Float32Array(max); this.S = new Float32Array(max);
    this.V = new Float32Array(max * 3); this.life = new Float32Array(max); this.max0 = new Float32Array(max); this.grow = new Float32Array(max); this.a0 = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.P, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.Cc, 3));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.A, 1)); g.setAttribute('size', new THREE.BufferAttribute(this.S, 1));
    this.mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uScale: { value: 400 } },
      vertexShader: `attribute float alpha, size; attribute vec3 color; varying float vA; varying vec3 vC; uniform float uScale;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); vA = alpha * smoothstep(1.5, 7.0, -mv.z); vC = color; gl_PointSize = size * uScale / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying float vA; varying vec3 vC;
        void main(){ vec2 p = gl_PointCoord - .5; float d = length(p); if (d > .5) discard; float a = smoothstep(.5, .4, d) * vA;
          float sh = .78 + .32 * smoothstep(.25, -.25, p.y + p.x * .3); gl_FragColor = vec4(vC * sh, a); }` });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; scene.add(this.pts);
  }
  emit(x, y, z, vx, vy, vz, size, life, col, alpha = 0.8, grow = 1.5) {
    const i = this.i = (this.i + 1) % this.max;
    this.P[i * 3] = x; this.P[i * 3 + 1] = y; this.P[i * 3 + 2] = z; this.V[i * 3] = vx; this.V[i * 3 + 1] = vy; this.V[i * 3 + 2] = vz;
    this.Cc[i * 3] = col.r; this.Cc[i * 3 + 1] = col.g; this.Cc[i * 3 + 2] = col.b; this.S[i] = size; this.life[i] = this.max0[i] = life; this.grow[i] = grow; this.a0[i] = alpha; this.A[i] = alpha;
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.A[i] = 0; continue; }
      this.life[i] -= dt; const f = Math.max(0, this.life[i] / this.max0[i]);
      this.P[i * 3] += this.V[i * 3] * dt; this.P[i * 3 + 1] += this.V[i * 3 + 1] * dt; this.P[i * 3 + 2] += this.V[i * 3 + 2] * dt;
      this.V[i * 3] *= 1 - 2 * dt; this.V[i * 3 + 2] *= 1 - 2 * dt; this.V[i * 3 + 1] = this.V[i * 3 + 1] * (1 - 1.5 * dt) + 0.6 * dt;
      this.S[i] += this.grow[i] * dt; this.A[i] = this.a0[i] * Math.min(1, f * 1.6);
    }
    const g = this.pts.geometry; for (const k of ['position', 'alpha', 'size', 'color']) g.attributes[k].needsUpdate = true;
  }
}

export class Sparks {
  constructor(scene, max = 300) {
    this.max = max; this.i = 0; this.P = new Float32Array(max * 6); this.C = new Float32Array(max * 6); this.V = new Float32Array(max * 3); this.life = new Float32Array(max);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.P, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.C, 3));
    this.lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.lines.frustumCulled = false; scene.add(this.lines);
  }
  emit(x, y, z, vx, vy, vz, life = 0.5) { const i = this.i = (this.i + 1) % this.max; this.P[i * 6] = x; this.P[i * 6 + 1] = y; this.P[i * 6 + 2] = z; this.V[i * 3] = vx; this.V[i * 3 + 1] = vy; this.V[i * 3 + 2] = vz; this.life[i] = life; }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      const o = i * 6; if (this.life[i] <= 0) { this.C.fill(0, o, o + 6); continue; }
      this.life[i] -= dt; this.V[i * 3 + 1] -= 18 * dt;
      let x = this.P[o] + this.V[i * 3] * dt, y = this.P[o + 1] + this.V[i * 3 + 1] * dt, z = this.P[o + 2] + this.V[i * 3 + 2] * dt;
      if (y < 0.05 && this.V[i * 3 + 1] < 0) { this.V[i * 3 + 1] *= -0.35; y = 0.05; }
      this.P[o] = x; this.P[o + 1] = y; this.P[o + 2] = z; const k = 0.035; this.P[o + 3] = x - this.V[i * 3] * k; this.P[o + 4] = y - this.V[i * 3 + 1] * k; this.P[o + 5] = z - this.V[i * 3 + 2] * k;
      const f = Math.min(1, this.life[i] * 3); this.C[o] = 3 * f; this.C[o + 1] = 2.2 * f; this.C[o + 2] = 0.8 * f; this.C[o + 3] = 1.6 * f; this.C[o + 4] = 0.5 * f; this.C[o + 5] = 0.1 * f;
    }
    this.lines.geometry.attributes.position.needsUpdate = true; this.lines.geometry.attributes.color.needsUpdate = true;
  }
}

export class Skids {
  constructor(scene, max = 1400) {
    this.max = max; this.i = 0; this.P = new Float32Array(max * 12); const idx = [];
    for (let q = 0; q < max; q++) { const b = q * 4; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.P, 3)); g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#1a1820', transparent: true, opacity: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false; scene.add(this.mesh);
  }
  seg(ax, ay, az, bx, by, bz, w = 0.16) {
    const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz); if (l < 0.05 || l > 6) return;
    const nx = -dz / l * w, nz = dx / l * w, o = (this.i = (this.i + 1) % this.max) * 12, P = this.P;
    P[o] = ax + nx; P[o + 1] = ay; P[o + 2] = az + nz; P[o + 3] = ax - nx; P[o + 4] = ay; P[o + 5] = az - nz;
    P[o + 6] = bx + nx; P[o + 7] = by; P[o + 8] = bz + nz; P[o + 9] = bx - nx; P[o + 10] = by; P[o + 11] = bz - nz;
    this.dirty = true;
  }
  update() { if (this.dirty) { this.mesh.geometry.attributes.position.needsUpdate = true; this.dirty = false; } }
  clear() { this.P.fill(0); this.dirty = true; }
}

export class SpeedLines {
  constructor(camera, n = 80) {
    this.n = n; this.P = new Float32Array(n * 6); this.D = [];
    for (let i = 0; i < n; i++) this.D.push({ a: Math.random() * Math.PI * 2, r: 1.6 + Math.random() * 3.4, z: -Math.random() * 40 });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.P, 3));
    this.mat = new THREE.LineBasicMaterial({ color: new THREE.Color(2.4, 2.4, 2.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });
    this.lines = new THREE.LineSegments(g, this.mat); this.lines.frustumCulled = false; this.lines.renderOrder = 20; camera.add(this.lines);
  }
  update(dt, amount, speed) {
    this.mat.opacity = amount * 0.55; this.lines.visible = amount > 0.02; if (!this.lines.visible) return;
    const len = 1.5 + speed * 0.08;
    for (let i = 0; i < this.n; i++) { const d = this.D[i]; d.z += speed * 1.4 * dt; if (d.z > -1) { d.z = -30 - Math.random() * 10; d.a = Math.random() * Math.PI * 2; d.r = 1.6 + Math.random() * 3.4; }
      const x = Math.cos(d.a) * d.r * 1.6, y = Math.sin(d.a) * d.r, o = i * 6; this.P[o] = x; this.P[o + 1] = y; this.P[o + 2] = d.z; this.P[o + 3] = x; this.P[o + 4] = y; this.P[o + 5] = d.z - len; }
    this.lines.geometry.attributes.position.needsUpdate = true;
  }
}

export function radialBlur() {
  const p = new ShaderPass({ uniforms: { tDiffuse: { value: null }, uAmt: { value: 0 }, uC: { value: new THREE.Vector2(0.5, 0.55) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uAmt; uniform vec2 uC; varying vec2 vUv;
      void main(){ vec2 d = vUv - uC; float e = smoothstep(.12, .6, length(d)); vec4 c = vec4(0.);
        for (int i = 0; i < 8; i++) { float k = 1. - uAmt * e * float(i) / 8.; c += texture2D(tDiffuse, uC + d * k); }
        c /= 8.; float ab = uAmt * e * .5; c.r = mix(c.r, texture2D(tDiffuse, uC + d * (1. + ab)).r, .6); gl_FragColor = c; }` });
  return p;
}
