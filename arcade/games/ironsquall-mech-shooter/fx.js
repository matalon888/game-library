// Ironsquall FX: pooled cartoon particles (glow + puffy smoke), tracers/sparks, debris, scorch decals, shock rings,
// beams, a shield bubble and a small pool of flash lights. Everything is a fixed number of draw calls.
import * as THREE from './kit/three.module.min.js';
import { toonGrad } from './models.js';

const cv = (n) => { const c = document.createElement('canvas'); c.width = c.height = n; return c; };
function puffTex() {
  const n = 128, c = cv(n), x = c.getContext('2d');
  const blobs = [[64, 70, 40], [44, 56, 26], [84, 54, 28], [62, 42, 26], [86, 80, 22], [40, 82, 22]];
  x.fillStyle = '#fff'; for (const [a, b, r] of blobs) { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); }
  // cel shading: darker lower-right crescent
  x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(120,120,140,.38)'; for (const [a, b, r] of blobs) { x.beginPath(); x.arc(a + r * 0.35, b + r * 0.4, r * 0.85, 0, 7); x.fill(); }
  x.fillStyle = 'rgba(255,255,255,.9)'; for (const [a, b, r] of blobs.slice(0, 3)) { x.beginPath(); x.arc(a - r * 0.3, b - r * 0.35, r * 0.4, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c); return t;
}
function glowTex() {
  const n = 64, c = cv(n), x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.85)'); g.addColorStop(0.6, 'rgba(255,255,255,.25)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, n, n); return new THREE.CanvasTexture(c);
}
function scorchTex() {
  const n = 128, c = cv(n), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 62);
  g.addColorStop(0, 'rgba(25,20,30,.85)'); g.addColorStop(0.55, 'rgba(40,32,40,.6)'); g.addColorStop(1, 'rgba(40,32,40,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n);
  x.strokeStyle = 'rgba(20,16,24,.6)'; x.lineWidth = 4; for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28 + Math.random(); x.beginPath(); x.moveTo(64, 64); x.lineTo(64 + Math.cos(a) * (40 + Math.random() * 22), 64 + Math.sin(a) * (40 + Math.random() * 22)); x.stroke(); }
  return new THREE.CanvasTexture(c);
}

class Points {
  constructor(scene, n, additive, tex, fog) {
    this.n = n; this.alive = 0; this.add = additive;
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 4); this.size = new Float32Array(n); this.rot = new Float32Array(n);
    this.d = []; for (let i = 0; i < n; i++) this.d.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, max: 1, s0: 1, s1: 1, c0: new THREE.Color(), c1: new THREE.Color(), a: 1, g: 0, drag: 0, r: 0, vr: 0 });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('col', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('rot', new THREE.BufferAttribute(this.rot, 1).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, uScale: { value: 400 }, fogD: { value: fog.density }, fogC: { value: fog.color } },
      vertexShader: `attribute vec4 col; attribute float size, rot; uniform float uScale, fogD; varying vec4 vC; varying float vR, vF;
        void main(){ vC = col; vR = rot; vec4 mv = modelViewMatrix * vec4(position, 1.); float d = -mv.z; vF = exp(-fogD * fogD * d * d); gl_PointSize = min(size * uScale / max(d, .1), 900.); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; uniform vec3 fogC; varying vec4 vC; varying float vR, vF;
        void main(){ vec2 p = gl_PointCoord - .5; float c = cos(vR), s = sin(vR); p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + .5; vec4 t = texture2D(map, p);
          ${additive ? 'gl_FragColor = vec4(vC.rgb * t.a * vC.a * vF, 1.);' : 'vec3 col = vC.rgb * t.rgb; gl_FragColor = vec4(mix(fogC, col, vF), t.a * vC.a); if (gl_FragColor.a < .02) discard;'}
        }`,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; this.pts.renderOrder = additive ? 8 : 7; scene.add(this.pts); this.g = g;
  }
  spawn(p, v, life, s0, s1, c0, c1 = c0, a = 1, g = 0, drag = 0) {
    if (this.alive >= this.n) return null;
    const q = this.d[this.alive++]; q.p.copy(p); q.v.copy(v); q.life = q.max = life; q.s0 = s0; q.s1 = s1; q.c0.set(c0); q.c1.set(c1); q.a = a; q.g = g; q.drag = drag; q.r = Math.random() * 6.28; q.vr = (Math.random() - 0.5) * 2;
    return q;
  }
  update(dt) {
    let n = this.alive;
    for (let i = 0; i < n; i++) {
      const q = this.d[i]; q.life -= dt;
      if (q.life <= 0) { n--; const t = this.d[i]; this.d[i] = this.d[n]; this.d[n] = t; i--; continue; }
      q.v.y -= q.g * dt; if (q.drag) q.v.multiplyScalar(Math.max(0, 1 - q.drag * dt)); q.p.addScaledVector(q.v, dt); q.r += q.vr * dt;
      const k = 1 - q.life / q.max, s = q.s0 + (q.s1 - q.s0) * (1 - (1 - k) * (1 - k));
      this.pos[i * 3] = q.p.x; this.pos[i * 3 + 1] = q.p.y; this.pos[i * 3 + 2] = q.p.z; this.size[i] = s; this.rot[i] = q.r;
      const fa = this.add ? (1 - k) * (1 - k) : Math.min(1, (1 - k) * 2.2) * Math.min(1, k * 12 + 0.2);
      this.col[i * 4] = q.c0.r + (q.c1.r - q.c0.r) * k; this.col[i * 4 + 1] = q.c0.g + (q.c1.g - q.c0.g) * k; this.col[i * 4 + 2] = q.c0.b + (q.c1.b - q.c0.b) * k; this.col[i * 4 + 3] = q.a * fa;
    }
    this.alive = n; this.g.setDrawRange(0, n);
    for (const k of ['position', 'col', 'size', 'rot']) { const at = this.g.attributes[k]; at.needsUpdate = true; at.clearUpdateRanges(); at.addUpdateRange(0, n * at.itemSize); }
  }
}

export function createFX(scene, camera, renderer, { lite = false } = {}) {
  const fog = scene.fog;
  const glow = new Points(scene, lite ? 900 : 1800, true, glowTex(), fog);
  const smoke = new Points(scene, lite ? 500 : 1000, false, puffTex(), fog);
  // streaks (tracers + sparks)
  const NS = lite ? 160 : 280, sGeo = new THREE.BoxGeometry(1, 1, 1); sGeo.translate(0, 0, 0.5);
  const streak = new THREE.InstancedMesh(sGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), NS);
  streak.frustumCulled = false; streak.renderOrder = 9; streak.count = 0; scene.add(streak);
  const sd = []; for (let i = 0; i < NS; i++) sd.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), len: 1, w: 0.1, life: 0, max: 1, c: new THREE.Color(), g: 0, fixed: null }); let sn = 0;
  streak.setColorAt(0, new THREE.Color());
  // debris
  const ND = lite ? 60 : 110, debris = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.5, 0), new THREE.MeshToonMaterial({ gradientMap: toonGrad() }), ND);
  debris.castShadow = true; debris.frustumCulled = false; debris.count = 0; scene.add(debris); debris.setColorAt(0, new THREE.Color());
  const dd = []; for (let i = 0; i < ND; i++) dd.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), vr: new THREE.Vector3(), s: 1, life: 0, c: new THREE.Color(), hot: 0 }); let dn = 0;
  // decals
  const NDC = 60, dg = new THREE.PlaneGeometry(1, 1); dg.rotateX(-Math.PI / 2);
  const decals = new THREE.InstancedMesh(dg, new THREE.MeshBasicMaterial({ map: scorchTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), NDC);
  decals.frustumCulled = false; decals.count = 0; decals.renderOrder = 1; scene.add(decals); let dci = 0;
  // rings
  const rings = []; for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 9; scene.add(m); rings.push({ m, life: 0, max: 1, s: 1 }); }
  // beams
  const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 14, 1, true); beamGeo.rotateX(Math.PI / 2); beamGeo.translate(0, 0, 0.5);
  const beams = []; for (let i = 0; i < 6; i++) {
    const mat = new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Color() }, uA: { value: 1 }, uT: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying float vF; varying vec2 vUv; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.); vec3 n = normalize(normalMatrix * normal); vF = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uC; uniform float uA, uT; varying float vF; varying vec2 vUv; void main(){ float core = pow(vF, 6.); float wob = .8 + .2 * sin(vUv.y * 60. - uT * 40.); vec3 c = mix(uC * vF * 1.4, vec3(2.4), core) * wob; gl_FragColor = vec4(c * uA, 1.); }' });
    const m = new THREE.Mesh(beamGeo, mat); m.visible = false; m.frustumCulled = false; m.renderOrder = 9; scene.add(m); beams.push(m);
  }
  // shield bubble
  const shield = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uA: { value: 0 }, uHit: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying float vF; varying vec3 vP; void main(){ vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.); vec3 n = normalize(normalMatrix * normal); vF = 1. - abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float uT, uA, uHit; varying float vF; varying vec3 vP; void main(){ float hex = step(.9, fract(vP.y * 7. + uT * .6)) + step(.93, fract(atan(vP.z, vP.x) * 4.5)); vec3 c = vec3(.2, .9, 1.) * (pow(vF, 2.5) * 1.6 + hex * .25 + .06) + vec3(1.) * uHit * pow(vF, 1.5); gl_FragColor = vec4(c * uA, 1.); }' }));
  shield.visible = false; shield.renderOrder = 10; scene.add(shield);
  // lights
  const lights = []; for (let i = 0; i < (lite ? 3 : 5); i++) { const L = new THREE.PointLight(0xffaa55, 0, 26, 1.6); scene.add(L); lights.push({ L, i: 0, d: 10 }); } let li = 0;

  const _q = new THREE.Quaternion(), _z = new THREE.Vector3(0, 0, 1), _s = new THREE.Vector3(), _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _c = new THREE.Color();
  const rv = (s = 1) => _v.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  const F = {
    glow, smoke, shield,
    streak(p, v, len, w, col, life, g = 0) { if (sn >= NS) return; const q = sd[sn++]; q.p.copy(p); q.v.copy(v); q.len = len; q.w = w; q.c.set(col); q.life = q.max = life; q.g = g; q.fixed = null; },
    tracer(a, b, col = '#ffe066', w = 0.14) { if (sn >= NS) return; const q = sd[sn++]; q.p.copy(a); q.fixed = b.clone(); q.w = w; q.c.set(col); q.life = q.max = 0.06; q.v.set(0, 0, 0); },
    light(p, col, inten = 30, decay = 10) { const s = lights[li++ % lights.length]; s.L.position.copy(p); s.L.color.set(col); s.i = inten; s.d = decay; s.L.intensity = inten; },
    muzzle(p, dir, col = '#ffd23f', s = 1) {
      glow.spawn(p, dir.clone().multiplyScalar(4), 0.06, 2.2 * s, 3 * s, '#fff6c0', col, 1);
      for (let i = 0; i < 3; i++) glow.spawn(p, dir.clone().multiplyScalar(10 + i * 8).add(rv(3)), 0.08, 1.0 * s, 0.4 * s, col, '#ff7a1a', 0.9);
      if (Math.random() < 0.5) smoke.spawn(p, dir.clone().multiplyScalar(3).add(rv(1)).setY(1.5), 0.6, 0.6 * s, 2 * s, '#ffffff', '#d8d8e0', 0.5);
    },
    sparks(p, n = 8, col = '#ffd23f', speed = 18) {
      for (let i = 0; i < n; i++) { const v = rv(2).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8)); v.y = Math.abs(v.y) + 2; F.streak(p, v, 0.5 + Math.random() * 0.6, 0.06, col, 0.25 + Math.random() * 0.3, 30); }
      glow.spawn(p, _v.set(0, 0, 0), 0.1, 1.6, 2.6, '#ffffff', col, 1);
    },
    hit(p, col = '#ffd23f') { F.sparks(p, 5, col, 14); smoke.spawn(p, rv(2).setY(1.5), 0.45, 0.5, 1.4, '#ffffff', '#c8c8d0', 0.6); },
    puff(p, s = 1, col = '#ffffff', life = 1) { smoke.spawn(p, rv(1.5).setY(1 + Math.random()), life, s, s * 2.4, col, '#c8ccd8', 0.85); },
    dust(p, s = 1) { for (let i = 0; i < 4; i++) { const a = Math.random() * 6.28; smoke.spawn(_v.set(p.x + Math.cos(a) * s, p.y + 0.2, p.z + Math.sin(a) * s), new THREE.Vector3(Math.cos(a) * 3 * s, 0.8, Math.sin(a) * 3 * s), 0.7, 0.8 * s, 2.2 * s, '#efe6d6', '#d8d0c4', 0.75, 0, 2); } },
    trail(p) { smoke.spawn(p, rv(0.6), 0.9 + Math.random() * 0.4, 0.5, 2.2, '#ffffff', '#cfd2dc', 0.8); glow.spawn(p, rv(0.5), 0.08, 1.2, 0.5, '#fff0a0', '#ff8a1a', 1); },
    orb(p, col, s = 1) { glow.spawn(p, _v.set(0, 0, 0), 0.03, 2.2 * s, 2.2 * s, '#ffffff', col, 1); glow.spawn(p, _v.set(0, 0, 0), 0.03, 4.2 * s, 4.2 * s, col, col, 0.6); },
    debris(p, n = 6, col = '#8a4dff', speed = 14, s = 0.5) {
      for (let i = 0; i < n; i++) { if (dn >= ND) return; const q = dd[dn++]; q.p.copy(p).add(rv(1)); q.v.copy(rv(2)).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8)); q.v.y = Math.abs(q.v.y) * 1.2 + 4; q.r.set(Math.random() * 6, Math.random() * 6, 0); q.vr.copy(rv(16)); q.s = s * (0.5 + Math.random()); q.life = 2.5 + Math.random(); q.c.set(Math.random() < 0.3 ? '#3a3f4a' : col); q.hot = Math.random() < 0.4 ? 1 : 0; }
    },
    decal(p, s = 4) { _m.compose(_v.set(p.x, 0.06 + (dci % 7) * 0.004, p.z), _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6.28), _s.set(s, 1, s)); decals.setMatrixAt(dci % NDC, _m); dci++; decals.count = Math.min(NDC, dci); decals.instanceMatrix.needsUpdate = true; },
    ring(p, s = 6, col = '#ffd23f', life = 0.45) { const r = rings.find(r => r.life <= 0) || rings[0]; r.m.position.set(p.x, Math.max(0.15, p.y), p.z); r.m.material.color.set(col); r.life = r.max = life; r.s = s; r.m.visible = true; },
    explode(p, s = 1, col = '#ff8a1a') {
      for (let i = 0; i < 12 * s + 6; i++) glow.spawn(_c && p.clone().add(rv(1.6 * s)), rv(10 * s).add(new THREE.Vector3(0, 4 * s, 0)), 0.35 + Math.random() * 0.35, 3.5 * s, 1.2 * s, '#fff3b0', i % 2 ? col : '#ff4d2a', 1, -2, 2);
      for (let i = 0; i < 9 * s + 4; i++) smoke.spawn(p.clone().add(rv(2 * s)), rv(6 * s).add(new THREE.Vector3(0, 5 * s, 0)), 1.1 + Math.random() * 0.9, 2.2 * s, 5.5 * s, i % 3 ? '#4a4450' : '#ffb070', '#9a96a6', 0.95, -1.5, 1.6);
      F.sparks(p, (10 * s) | 0, '#ffd23f', 24 * s); F.debris(p, (4 * s + 2) | 0, '#5a5470', 16 * s, 0.45 * s);
      F.ring(p, 9 * s, '#fff0b0', 0.4); F.light(p.clone().setY(p.y + 2), '#ff9a40', 60 * s, 5);
      if (p.y < 4) F.decal(p, 4 + 3 * s);
    },
    beam(i) { return beams[i]; },
    setBeam(i, a, b, w, col, alpha = 1, t = 0) { const m = beams[i]; m.visible = alpha > 0.01; if (!m.visible) return; m.position.copy(a); m.lookAt(b); m.scale.set(w, w, a.distanceTo(b)); m.material.uniforms.uC.value.set(col); m.material.uniforms.uA.value = alpha; m.material.uniforms.uT.value = t; },
    resize(h, fov) { const sc = h * renderer.getPixelRatio() * 0.5 / Math.tan(fov * Math.PI / 360); glow.mat.uniforms.uScale.value = smoke.mat.uniforms.uScale.value = sc; },
    update(dt, t) {
      glow.update(dt); smoke.update(dt);
      // streaks
      let n = sn;
      for (let i = 0; i < n; i++) {
        const q = sd[i]; q.life -= dt;
        if (q.life <= 0) { n--; const tt = sd[i]; sd[i] = sd[n]; sd[n] = tt; i--; continue; }
        let len, dir;
        if (q.fixed) { dir = _v.subVectors(q.fixed, q.p); len = dir.length(); dir.normalize(); }
        else { q.v.y -= q.g * dt; q.p.addScaledVector(q.v, dt); dir = _v.copy(q.v).normalize(); len = q.len; }
        _q.setFromUnitVectors(_z, dir); const a = q.life / q.max;
        _m.compose(q.fixed ? q.p : _s.copy(q.p).addScaledVector(dir, -len), _q, new THREE.Vector3(q.w, q.w, len)); streak.setMatrixAt(i, _m);
        streak.setColorAt(i, _c.copy(q.c).multiplyScalar(2.2 * (q.fixed ? 1 : a)));
      }
      sn = n; streak.count = n; streak.instanceMatrix.needsUpdate = true; if (streak.instanceColor) streak.instanceColor.needsUpdate = true;
      // debris
      n = dn;
      for (let i = 0; i < n; i++) {
        const q = dd[i]; q.life -= dt;
        if (q.life <= 0) { n--; const tt = dd[i]; dd[i] = dd[n]; dd[n] = tt; i--; continue; }
        q.v.y -= 32 * dt; q.p.addScaledVector(q.v, dt); q.r.x += q.vr.x * dt; q.r.y += q.vr.y * dt;
        if (q.p.y < q.s * 0.4) { q.p.y = q.s * 0.4; q.v.y *= -0.35; q.v.x *= 0.6; q.v.z *= 0.6; q.vr.multiplyScalar(0.6); }
        if (q.hot && Math.random() < dt * 14) smoke.spawn(q.p, _s.set(0, 1.5, 0), 0.6, 0.4, 1.3, '#5a5460', '#a8a4b0', 0.6);
        const sc = q.s * Math.min(1, q.life * 2);
        _m.compose(q.p, _q.setFromEuler(q.r), _s.set(sc, sc, sc)); debris.setMatrixAt(i, _m); debris.setColorAt(i, q.c);
      }
      dn = n; debris.count = n; debris.instanceMatrix.needsUpdate = true; if (debris.instanceColor) debris.instanceColor.needsUpdate = true;
      for (const r of rings) if (r.life > 0) { r.life -= dt; const k = 1 - r.life / r.max; r.m.scale.setScalar(0.5 + r.s * (1 - (1 - k) * (1 - k))); r.m.material.opacity = (1 - k) * 0.9; if (r.life <= 0) r.m.visible = false; }
      for (const s of lights) { s.i = Math.max(0, s.i - s.i * s.d * dt - dt * 2); s.L.intensity = s.i; }
      shield.material.uniforms.uT.value = t; shield.material.uniforms.uHit.value = Math.max(0, shield.material.uniforms.uHit.value - dt * 4);
    },
  };
  return F;
}
