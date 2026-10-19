// Hivefall effects: pooled GPU particles (additive fire/sparks/goo glow + alpha smoke/dust), tracers, ground decals,
// a light pool for muzzle flashes and explosions, dust-storm billboards and a heat-haze / damage post pass.
import { THREE } from './kit/cine.js';
import { ShaderPass } from './kit/addons/postprocessing/ShaderPass.js';

// ------------------------------------------------------------------ particles
const PV = `attribute float aSize; attribute float aAlpha; attribute vec3 aCol; attribute float aSoft; varying vec3 vCol; varying float vA; varying float vSoft; uniform float uScale;
void main(){ vCol=aCol; vSoft=aSoft; vec4 mv=modelViewMatrix*vec4(position,1.); vA=aAlpha*smoothstep(.8, 4.5, -mv.z); gl_Position=projectionMatrix*mv; gl_PointSize=min(aSize*uScale/max(.1,-mv.z), 420.); if(aAlpha<=0.) gl_PointSize=0.; }`;
const PF = `varying vec3 vCol; varying float vA; varying float vSoft;
float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){ vec2 p=gl_PointCoord-.5; float d=length(p)*2.; if(d>1.) discard;
  float a=pow(1.-d, mix(1.2, 2.6, vSoft));
  #ifdef SMOKE
  float n = sin(p.x*13.+vA*9.)*sin(p.y*11.-vA*7.)*.18; a = clamp(a*(1.+n),0.,1.)*.85;
  #endif
  gl_FragColor=vec4(vCol*a*vA, a*vA);
  #ifdef SMOKE
  gl_FragColor=vec4(vCol, a*vA);
  #endif
}`;
export class Particles {
  constructor(scene, n, additive) {
    this.n = n; this.i = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3); this.size = new Float32Array(n); this.alpha = new Float32Array(n); this.soft = new Float32Array(n);
    this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n); this.grav = new Float32Array(n); this.drag = new Float32Array(n); this.grow = new Float32Array(n); this.a0 = new Float32Array(n);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aCol', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSoft', new THREE.BufferAttribute(this.soft, 1).setUsage(THREE.DynamicDrawUsage));
    this.uScale = { value: 400 };
    const m = new THREE.ShaderMaterial({ vertexShader: PV, fragmentShader: PF, uniforms: { uScale: this.uScale }, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, defines: additive ? {} : { SMOKE: 1 } });
    if (additive) m.blending = THREE.CustomBlending, m.blendSrc = THREE.OneFactor, m.blendDst = THREE.OneFactor;
    this.mesh = new THREE.Points(g, m); this.mesh.frustumCulled = false; this.mesh.renderOrder = additive ? 3 : 2; scene.add(this.mesh); this.g = g;
  }
  spawn(x, y, z, vx, vy, vz, { life = 1, size = 0.3, color = [1, 1, 1], alpha = 1, grav = 0, drag = 0, grow = 0, soft = 0 } = {}) {
    const i = this.i; this.i = (this.i + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z; this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 3] = color[0]; this.col[i * 3 + 1] = color[1]; this.col[i * 3 + 2] = color[2];
    this.life[i] = this.max[i] = life; this.size[i] = size; this.a0[i] = this.alpha[i] = alpha; this.grav[i] = grav; this.drag[i] = drag; this.grow[i] = grow; this.soft[i] = soft;
  }
  update(dt) {
    const P = this.pos, V = this.vel;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { if (this.alpha[i] !== 0) this.alpha[i] = 0; continue; }
      this.life[i] -= dt; const k = 1 - this.drag[i] * dt;
      V[i * 3 + 1] -= this.grav[i] * dt; V[i * 3] *= k; V[i * 3 + 1] *= k; V[i * 3 + 2] *= k;
      P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt;
      this.size[i] += this.grow[i] * dt; const t = this.life[i] / this.max[i];
      this.alpha[i] = this.a0[i] * Math.min(1, t * 2.5) * (t > 0.9 ? (1 - t) * 10 : 1);
    }
    for (const a of ['position', 'aCol', 'aSize', 'aAlpha', 'aSoft']) this.g.attributes[a].needsUpdate = true;
  }
}

// ------------------------------------------------------------------ tracers (stretched glowing boxes)
export class Tracers {
  constructor(scene, n = 64) {
    const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0, 0.5);
    this.mesh = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.9, 0.9), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), n);
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.list = []; this.n = n; scene.add(this.mesh); this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3();
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  }
  add(from, to, w = 0.035, life = 0.06, speed = 0, color = null) { if (this.list.length >= this.n) this.list.shift(); this.list.push({ a: from.clone(), b: to.clone(), w, life, max: life, speed, color }); }
  update(dt) {
    let n = 0; const up = this.v;
    for (let i = this.list.length - 1; i >= 0; i--) { const t = this.list[i]; t.life -= dt; if (t.life <= 0) { this.list.splice(i, 1); continue; } }
    for (const t of this.list) {
      const k = 1 - t.life / t.max; // travel: draw a segment that slides from a to b
      const a = this.v.copy(t.a).lerp(t.b, Math.max(0, k * 1.6 - 0.6)), b = t.b.clone().sub(t.a).multiplyScalar(Math.min(1, k * 1.6 + 0.25)).add(t.a);
      const d = b.clone().sub(a), L = d.length(); if (L < 0.01) continue;
      const o = _o; o.position.copy(a); o.lookAt(b); o.scale.set(t.w, t.w, L); o.updateMatrix();
      this.mesh.setMatrixAt(n, o.matrix); const c = t.color || [1, 1, 1]; this.mesh.instanceColor.setXYZ(n, c[0], c[1], c[2]); n++;
    }
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true;
  }
}
const _o = new THREE.Object3D();

// ------------------------------------------------------------------ decals (goo splats / scorch marks lying on the ground)
function decalTex(kind) {
  const n = 256, c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d'); x.translate(n / 2, n / 2);
  if (kind === 'goo') {
    for (let i = 0; i < 26; i++) { const a = Math.random() * 7, r = Math.random() * 80, s = 14 + Math.random() * 40; const g = x.createRadialGradient(Math.cos(a) * r, Math.sin(a) * r, 0, Math.cos(a) * r, Math.sin(a) * r, s);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.7, 'rgba(225,225,225,1)'); g.addColorStop(.72, 'rgba(160,160,160,.9)'); g.addColorStop(1, 'rgba(150,150,150,0)'); x.fillStyle = g; x.beginPath(); x.arc(Math.cos(a) * r, Math.sin(a) * r, s, 0, 7); x.fill(); }
    for (let i = 0; i < 14; i++) { const a = Math.random() * 7, r = 70 + Math.random() * 50; x.fillStyle = 'rgba(240,240,240,1)'; x.beginPath(); x.arc(Math.cos(a) * r, Math.sin(a) * r, 3 + Math.random() * 7, 0, 7); x.fill(); }
  } else {
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 125); g.addColorStop(0, 'rgba(60,40,70,.85)'); g.addColorStop(.55, 'rgba(80,55,90,.55)'); g.addColorStop(1, 'rgba(80,55,90,0)'); x.fillStyle = g; x.fillRect(-128, -128, 256, 256);
    x.strokeStyle = 'rgba(50,30,60,.5)'; for (let i = 0; i < 22; i++) { const a = Math.random() * 7; x.lineWidth = 2 + Math.random() * 4; x.beginPath(); x.moveTo(Math.cos(a) * 30, Math.sin(a) * 30); x.lineTo(Math.cos(a) * (80 + Math.random() * 45), Math.sin(a) * (80 + Math.random() * 45)); x.stroke(); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export class Decals {
  constructor(scene, kind, n = 140) {
    const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2);
    const m = kind === 'goo'
      ? new THREE.MeshBasicMaterial({ map: decalTex('goo'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })
      : new THREE.MeshBasicMaterial({ map: decalTex('scorch'), transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    this.mesh = new THREE.InstancedMesh(g, m, n); this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3); this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.receiveShadow = true; this.mesh.renderOrder = 1; this.n = n; this.i = 0; scene.add(this.mesh);
  }
  add(x, y, z, s, nrm, col) {
    _o.position.set(x, y + 0.04, z); _o.rotation.set(0, Math.random() * 6.28, 0); if (nrm) { _o.quaternion.setFromUnitVectors(_up, nrm); _o.rotateY(Math.random() * 6.28); }
    _o.scale.set(s, 1, s); _o.updateMatrix(); this.mesh.setMatrixAt(this.i, _o.matrix); this.mesh.instanceColor.setXYZ(this.i, ...(col || [1, 1, 1])); this.mesh.instanceColor.needsUpdate = true; this.i = (this.i + 1) % this.n; this.mesh.count = Math.min(this.n, this.mesh.count + 1); this.mesh.instanceMatrix.needsUpdate = true;
  }
  clear() { this.mesh.count = 0; this.i = 0; }
}
const _up = new THREE.Vector3(0, 1, 0);

// ------------------------------------------------------------------ light pool (fixed count: no shader recompiles)
export class LightPool {
  constructor(scene, n = 4) { this.L = []; for (let i = 0; i < n; i++) { const l = new THREE.PointLight(0xffaa55, 0, 18, 1.6); l.userData = { life: 0, max: 1, peak: 0 }; scene.add(l); this.L.push(l); } this.i = 0; }
  flash(pos, color, peak, life, dist = 18) { const l = this.L[this.i]; this.i = (this.i + 1) % this.L.length; l.position.copy(pos); l.color.set(color); l.distance = dist; l.userData = { life, max: life, peak }; l.intensity = peak; }
  update(dt) { for (const l of this.L) { const u = l.userData; if (u.life > 0) { u.life -= dt; l.intensity = Math.max(0, u.peak * Math.pow(u.life / u.max, 1.6)); } else l.intensity = 0; } }
}

// ------------------------------------------------------------------ dust storm sheets (camera-facing soft quads)
function dustTex() {
  const n = 128, c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d');
  for (let i = 0; i < 40; i++) { const px = 20 + Math.random() * 88, py = 20 + Math.random() * 88, r = 12 + Math.random() * 30; const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); }
  const t = new THREE.CanvasTexture(c); return t;
}
export class Dust {
  constructor(scene, n = 70) {
    const g = new THREE.PlaneGeometry(1, 1);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: dustTex() }, uCol: { value: new THREE.Color(0xffd6b4) }, uA: { value: 0 } }, transparent: true, depthWrite: false,
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; vec4 c = modelViewMatrix * instanceMatrix * vec4(0.,0.,0.,1.); float s = length(instanceMatrix[0].xyz); c.xy += position.xy * s; gl_Position = projectionMatrix * c; }`,
      fragmentShader: `uniform sampler2D map; uniform vec3 uCol; uniform float uA; varying vec2 vUv; void main(){ float a = texture2D(map, vUv).r * uA; gl_FragColor = vec4(uCol, a); }`,
    });
    this.mesh = new THREE.InstancedMesh(g, this.mat, n); this.mesh.frustumCulled = false; this.mesh.renderOrder = 4; scene.add(this.mesh);
    this.p = []; for (let i = 0; i < n; i++) this.p.push({ x: (Math.random() - .5) * 120, y: Math.random() * 14, z: (Math.random() - .5) * 120, s: 10 + Math.random() * 22 });
    this.k = 0;
  }
  update(dt, cam, wind, k) {
    this.k = k; this.mat.uniforms.uA.value = k * 0.45; this.mesh.visible = k > 0.01;
    if (!this.mesh.visible) return;
    this.p.forEach((q, i) => {
      q.x += wind.x * dt; q.z += wind.z * dt;
      let dx = q.x - cam.position.x, dz = q.z - cam.position.z;
      if (dx > 60) q.x -= 120; if (dx < -60) q.x += 120; if (dz > 60) q.z -= 120; if (dz < -60) q.z += 120;
      _o.position.set(q.x, cam.position.y - 2 + q.y, q.z); _o.rotation.set(0, 0, 0); _o.scale.setScalar(q.s); _o.updateMatrix(); this.mesh.setMatrixAt(i, _o.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ heat haze + damage aberration + storm grit (post pass, HDR)
export function hazePass() {
  return new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uHaze: { value: 0 }, uHurt: { value: 0 }, uStorm: { value: 0 }, uStormCol: { value: new THREE.Color(1.0, 0.78, 0.6) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uHaze, uHurt, uStorm; uniform vec3 uStormCol; varying vec2 vUv;
      void main(){ vec2 uv = vUv;
        float m = smoothstep(.75, .1, distance(uv, vec2(.6, .2))) * uHaze;
        uv += vec2(sin(uv.y * 90. + uTime * 17.) + sin(uv.y * 37. - uTime * 9.), cos(uv.x * 70. + uTime * 13.)) * .0035 * m;
        float ca = uHurt * .006 * distance(vUv, vec2(.5));
        vec3 c = vec3(texture2D(tDiffuse, uv + vec2(ca, 0.)).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - vec2(ca, 0.)).b);
        c = mix(c, uStormCol * (0.8 + 0.4 * vUv.y), uStorm * .12);
        gl_FragColor = vec4(c, 1.); }`,
  });
}
