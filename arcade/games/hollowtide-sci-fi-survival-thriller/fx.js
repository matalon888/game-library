// Hollowtide — effects: a pool of real point lights that follows the player through the fixtures, sparks, drips,
// dust in the flashlight beam, smoke, plasma bolts, burn decals, debris and the EMP shockwave. All pooled.
import { THREE } from './kit/cine.js';

const V = new THREE.Vector3();

// ------------------------------------------------------------------ light pool
export class LightPool {
  constructor(scene, n = 6) {
    this.lights = []; this.fx = [];
    for (let i = 0; i < n; i++) { const l = new THREE.PointLight(0xffffff, 0, 11, 1.7); scene.add(l); this.lights.push(l); }
    for (let i = 0; i < 2; i++) { const l = new THREE.PointLight(0xffffff, 0, 9, 1.8); scene.add(l); this.fx.push({ l, t: 0, dur: 1, peak: 0 }); }
    this.fixtures = []; this.dim = 1; this.fxi = 0;
  }
  setFixtures(f) { this.fixtures = f; }
  flash(p, color, peak = 30, dur = .08, dist = 9) { const f = this.fx[this.fxi++ % this.fx.length]; f.l.position.copy(p); f.l.color.set(color); f.l.distance = dist; f.t = dur; f.dur = dur; f.peak = peak; }
  update(p, t, dt) {
    const F = this.fixtures; for (const f of F) { const dx = f.x - p.x, dz = f.z - p.z; f.d2 = dx * dx + dz * dz; }
    const near = F.filter(f => f.d2 < 22 * 22).sort((a, b) => a.d2 - b.d2);
    for (let i = 0; i < this.lights.length; i++) {
      const l = this.lights[i], f = near[i];
      if (!f) { l.intensity = 0; continue; }
      let k = 1;
      if (f.flick) { const s = Math.sin(t * 13 + f.ph) * Math.sin(t * 7.3 + f.ph * 2) + Math.sin(t * 31 + f.ph) * .3; k = s > -.25 ? 1 : .04; if (Math.sin(t * .7 + f.ph) > .93) k = .02; f.flick.material.emissiveIntensity = 5.5 * k; }
      if (f.door) { l.color.setHex(f.door.unlocked || f.door.key === null ? 0x40ff90 : f.door.col); }
      else l.color.setHex(f.color);
      if (f.exit) l.color.setHex(f.exitOn ? 0x40ff90 : 0xff3a30);
      const d = Math.sqrt(f.d2), fade = Math.min(1, Math.max(0, (21 - d) / 5));
      l.position.set(f.x, f.y, f.z); l.intensity = f.int * k * fade * this.dim * (f.pulse ? .6 + .4 * Math.sin(t * 4) : 1);
    }
    for (const f of this.fx) { if (f.t > 0) { f.t -= dt; f.l.intensity = f.peak * Math.max(0, f.t / f.dur); } else f.l.intensity = 0; }
  }
}

// ------------------------------------------------------------------ soft particle pool (per-particle size / colour / alpha)
const PV = `attribute float size; attribute vec4 col; varying vec4 vC; uniform float uScale;
  void main(){ vC = col; vec4 mv = modelViewMatrix * vec4(position,1.); gl_PointSize = size * uScale / max(.1,-mv.z); gl_Position = projectionMatrix * mv; }`;
const PF = `varying vec4 vC; uniform float uSoft; void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, uSoft, d) * vC.a; if (a < .003) discard; gl_FragColor = vec4(vC.rgb, a); }`;
export class Particles {
  constructor(scene, n, { additive = true, soft = 0, gravity = 9, drag = .5 } = {}) {
    this.n = n; this.g = gravity; this.drag = drag;
    this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.col = new Float32Array(n * 4); this.size = new Float32Array(n); this.life = new Float32Array(n); this.max = new Float32Array(n); this.base = new Float32Array(n * 4); this.grow = new Float32Array(n); this.s0 = new Float32Array(n); this.bounce = new Uint8Array(n);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); geo.setAttribute('col', new THREE.BufferAttribute(this.col, 4)); geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    this.mat = new THREE.ShaderMaterial({ uniforms: { uScale: { value: 400 }, uSoft: { value: soft } }, vertexShader: PV, fragmentShader: PF, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.pts = new THREE.Points(geo, this.mat); this.pts.frustumCulled = false; scene.add(this.pts); this.i = 0;
  }
  spawn(x, y, z, vx, vy, vz, life, size, r, g, b, a = 1, grow = 0, bounce = 0) {
    const i = this.i++ % this.n, j = i * 3, k = i * 4;
    this.pos[j] = x; this.pos[j + 1] = y; this.pos[j + 2] = z; this.vel[j] = vx; this.vel[j + 1] = vy; this.vel[j + 2] = vz;
    this.life[i] = this.max[i] = life; this.s0[i] = size; this.grow[i] = grow; this.bounce[i] = bounce;
    this.base[k] = r; this.base[k + 1] = g; this.base[k + 2] = b; this.base[k + 3] = a;
  }
  update(dt, floorY = 0) {
    const P = this.pos, Vv = this.vel, dr = Math.max(0, 1 - this.drag * dt);
    for (let i = 0; i < this.n; i++) {
      const k = i * 4;
      if (this.life[i] <= 0) { this.col[k + 3] = 0; this.size[i] = 0; continue; }
      this.life[i] -= dt; const j = i * 3, f = Math.max(0, this.life[i] / this.max[i]);
      Vv[j + 1] -= this.g * dt; Vv[j] *= dr; Vv[j + 1] *= dr; Vv[j + 2] *= dr;
      P[j] += Vv[j] * dt; P[j + 1] += Vv[j + 1] * dt; P[j + 2] += Vv[j + 2] * dt;
      if (P[j + 1] < floorY + .02) { if (this.bounce[i]) { P[j + 1] = floorY + .02; Vv[j + 1] *= -.35; Vv[j] *= .6; Vv[j + 2] *= .6; } else if (this.g > 0) this.life[i] = 0; }
      this.size[i] = this.s0[i] * (1 + this.grow[i] * (1 - f));
      this.col[k] = this.base[k]; this.col[k + 1] = this.base[k + 1]; this.col[k + 2] = this.base[k + 2]; this.col[k + 3] = this.base[k + 3] * (this.grow[i] ? Math.sin(f * Math.PI) : f);
    }
    const g = this.pts.geometry; g.attributes.position.needsUpdate = g.attributes.col.needsUpdate = g.attributes.size.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ dust motes that only show inside the flashlight cone
export function dust(scene, n = 700) {
  const pos = new Float32Array(n * 3); for (let i = 0; i < n * 3; i++) pos[i] = Math.random() * 16 - 8;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Vector3() }, uLP: { value: new THREE.Vector3() }, uLD: { value: new THREE.Vector3(0, 0, -1) }, uOn: { value: 1 }, uT: { value: 0 }, uScale: { value: 400 } },
    vertexShader: `uniform vec3 uC, uLP, uLD; uniform float uOn, uT, uScale; varying float vA;
      void main(){ vec3 p = position; p.y += sin(uT*.3 + position.x*3.) * .3; p.x += sin(uT*.2 + position.z*2.)*.3;
        vec3 w = uC + mod(p - uC + 8., 16.) - 8.; w.y = clamp(w.y, .1, 4.4);
        vec3 d = w - uLP; float l = length(d); float c = smoothstep(.86, .97, dot(d / l, uLD)) * smoothstep(14., 1., l) * uOn;
        vA = .03 + c * .9; vec4 mv = viewMatrix * vec4(w, 1.); gl_PointSize = 0.035 * uScale / max(.1, -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - .5); gl_FragColor = vec4(vec3(.85,.95,1.) * 1.4, smoothstep(.5, 0., d) * vA); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const p = new THREE.Points(g, m); p.frustumCulled = false; scene.add(p); return m;
}

// ------------------------------------------------------------------ volumetric flashlight cone (cheap fake god-ray)
export function beam() {
  const g = new THREE.ConeGeometry(2.6, 12, 32, 1, true); g.translate(0, -6, 0); g.rotateX(-Math.PI / 2);
  const m = new THREE.ShaderMaterial({ uniforms: { uI: { value: .14 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying float vZ; varying vec3 vN, vV; void main(){ vZ = -position.z / 12.; vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float uI; varying float vZ; varying vec3 vN, vV; void main(){ float e = pow(abs(dot(vN, vV)), 1.6); float a = uI * e * (1. - vZ) * smoothstep(0., .08, vZ); gl_FragColor = vec4(vec3(.75,.9,1.) * a, 1.); }' });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 5; return mesh;
}

// ------------------------------------------------------------------ plasma bolts
export class Bolts {
  constructor(scene, n = 12) {
    const g = new THREE.BoxGeometry(.035, .035, 1.4); g.translate(0, 0, -.7);
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 4, 6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.b = []; for (let i = 0; i < n; i++) { const me = new THREE.Mesh(g, m); me.visible = false; scene.add(me); this.b.push({ me, from: new THREE.Vector3(), to: new THREE.Vector3(), t: 0, len: 0 }); }
    this.i = 0;
  }
  fire(from, to) { const b = this.b[this.i++ % this.b.length]; b.from.copy(from); b.to.copy(to); b.len = from.distanceTo(to); b.t = 0; b.me.visible = true; b.me.position.copy(from); b.me.lookAt(to); }
  update(dt) { for (const b of this.b) { if (!b.me.visible) continue; b.t += dt * 120; const k = Math.min(1, b.t / Math.max(.01, b.len)); b.me.position.lerpVectors(b.from, b.to, k); b.me.scale.z = Math.min(1, (b.len - b.t) / 1.4 + .2); if (k >= 1) b.me.visible = false; } }
}

// ------------------------------------------------------------------ burn decals (instanced) + glowing cut marks
export class Decals {
  constructor(scene, atlas, n = 60) {
    const g = new THREE.PlaneGeometry(.5, .5), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (2 + uv.getX(i)) / 4, 1 - (1 - uv.getY(i)) / 4);
    this.dark = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ map: atlas, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: .9 }), n);
    const gg = new THREE.PlaneGeometry(.22, .06);
    this.glow = new THREE.InstancedMesh(gg, new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 2.2, .5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6 }), n);
    for (const m of [this.dark, this.glow]) { m.count = n; m.frustumCulled = false; for (let i = 0; i < n; i++) m.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0)); scene.add(m); }
    this.n = n; this.i = 0; this.ages = new Float32Array(n).fill(9); this.mats = [];
  }
  add(p, nrm) {
    const i = this.i++ % this.n, q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm), o = p.clone().addScaledVector(nrm, .01);
    const rot = new THREE.Quaternion().setFromAxisAngle(nrm, Math.random() * 6); q.premultiply(rot);
    const M = new THREE.Matrix4().compose(o, q, new THREE.Vector3(1, 1, 1).multiplyScalar(.6 + Math.random() * .6)); this.dark.setMatrixAt(i, M); this.dark.instanceMatrix.needsUpdate = true;
    this.mats[i] = { o, q }; this.ages[i] = 0;
  }
  update(dt) {
    let dirty = false;
    for (let i = 0; i < this.n; i++) { if (this.ages[i] > 1.6) continue; this.ages[i] += dt; const k = Math.max(0, 1 - this.ages[i] / 1.5), m = this.mats[i]; this.glow.setMatrixAt(i, new THREE.Matrix4().compose(m.o.clone().addScaledVector(new THREE.Vector3(0, 0, 1).applyQuaternion(m.q), .005), m.q, new THREE.Vector3(k * 1.4, k * 1.4, 1))); dirty = true; }
    if (dirty) this.glow.instanceMatrix.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ debris (instanced chunks with simple physics)
export class Debris {
  constructor(scene, n = 70) {
    this.m = new THREE.InstancedMesh(new THREE.BoxGeometry(.12, .05, .18), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: .7, roughness: .4 }), n);
    this.m.castShadow = true; this.m.frustumCulled = false; this.n = n; this.i = 0; this.d = [];
    for (let i = 0; i < n; i++) { this.d.push({ p: new THREE.Vector3(0, -50, 0), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), s: 1, life: 0 }); this.m.setColorAt(i, new THREE.Color(0x333333)); }
    scene.add(this.m);
  }
  spawn(p, v, color, s = 1) { const i = this.i++ % this.n, d = this.d[i]; d.p.copy(p); d.v.copy(v); d.w.set(Math.random() * 20 - 10, Math.random() * 20 - 10, Math.random() * 20 - 10); d.s = s; d.life = 8; this.m.setColorAt(i, new THREE.Color(color)); this.m.instanceColor.needsUpdate = true; }
  update(dt) {
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3();
    for (let i = 0; i < this.n; i++) {
      const d = this.d[i]; if (d.life <= 0) { M.makeScale(0, 0, 0); this.m.setMatrixAt(i, M); continue; }
      d.life -= dt; d.v.y -= 12 * dt; d.p.addScaledVector(d.v, dt);
      if (d.p.y < .03) { d.p.y = .03; d.v.y *= -.3; d.v.x *= .7; d.v.z *= .7; d.w.multiplyScalar(.6); }
      d.r.x += d.w.x * dt; d.r.y += d.w.y * dt; d.r.z += d.w.z * dt;
      const s = d.s * Math.min(1, d.life); M.compose(d.p, Q.setFromEuler(d.r), S.set(s, s, s)); this.m.setMatrixAt(i, M);
    }
    this.m.instanceMatrix.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ EMP shockwave
export function shock() {
  const m = new THREE.ShaderMaterial({ uniforms: { uA: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec3 vN, vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'uniform float uA; varying vec3 vN, vV; void main(){ float f = pow(1.-abs(dot(vN,vV)), 2.5); gl_FragColor = vec4(vec3(.4,.8,2.4)*f*uA*3., 1.); }' });
  const s = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), m); s.visible = false; s.frustumCulled = false; return s;
}
