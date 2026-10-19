// Ringbreaker effects: pooled sparks (streak lines), glow embers, smoke/steam, tracers, impact decals, debris,
// explosions and flash lights. Every system is one draw call.
import { THREE } from './kit/cine.js';

const V = new THREE.Vector3(), Q = new THREE.Quaternion(), M = new THREE.Matrix4(), S = new THREE.Vector3(), UP = new THREE.Vector3(0, 0, 1);

function softTex(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  if (kind === 'scorch') {
    const g = x.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, 'rgba(0,0,0,.95)'); g.addColorStop(0.35, 'rgba(10,8,6,.8)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    x.strokeStyle = 'rgba(0,0,0,.6)'; for (let i = 0; i < 14; i++) { const a = Math.random() * 6.28, r = 20 + Math.random() * 40; x.lineWidth = 1 + Math.random() * 3; x.beginPath(); x.moveTo(64, 64); x.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); x.stroke(); }
    const h = x.createRadialGradient(64, 64, 0, 64, 64, 14); h.addColorStop(0, 'rgba(255,170,80,.9)'); h.addColorStop(1, 'rgba(255,90,20,0)'); x.fillStyle = h; x.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const PV = `attribute float aSize; attribute vec4 aCol; varying vec4 vCol; uniform float uScale;
void main(){ vCol = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(aSize * uScale / max(0.1, -mv.z), 1.0, 600.0); gl_Position = projectionMatrix * mv; }`;
const PF_ADD = `varying vec4 vCol; void main(){ vec2 d = gl_PointCoord - .5; float r = dot(d, d) * 4.; if (r > 1.) discard; float a = pow(1. - r, 2.); gl_FragColor = vec4(vCol.rgb * a * vCol.a, 1.); }`;
const PF_SMOKE = `varying vec4 vCol; void main(){ vec2 d = gl_PointCoord - .5; float r = dot(d, d) * 4.; if (r > 1.) discard; float a = (1. - r); a = a * a * vCol.a; gl_FragColor = vec4(vCol.rgb, a); }`;

class PointSys {
  constructor(scene, max, additive) {
    this.max = max; this.n = 0;
    this.p = new Float32Array(max * 3); this.c = new Float32Array(max * 4); this.s = new Float32Array(max);
    this.v = new Float32Array(max * 3); this.life = new Float32Array(max); this.l0 = new Float32Array(max); this.grow = new Float32Array(max); this.g = new Float32Array(max); this.base = new Float32Array(max * 4); this.drag = new Float32Array(max);
    const geo = new THREE.BufferGeometry();
    this.pa = new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage); this.ca = new THREE.BufferAttribute(this.c, 4).setUsage(THREE.DynamicDrawUsage); this.sa = new THREE.BufferAttribute(this.s, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.pa); geo.setAttribute('aCol', this.ca); geo.setAttribute('aSize', this.sa);
    this.uni = { uScale: { value: 400 } };
    this.mat = new THREE.ShaderMaterial({ uniforms: this.uni, vertexShader: PV, fragmentShader: additive ? PF_ADD : PF_SMOKE, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.pts = new THREE.Points(geo, this.mat); this.pts.frustumCulled = false; this.pts.renderOrder = additive ? 3 : 2; scene.add(this.pts);
  }
  add(x, y, z, vx, vy, vz, life, size, r, g, b, a, grow = 0, grav = 0, drag = 0) {
    let i = this.n; if (i >= this.max) i = (Math.random() * this.max) | 0; else this.n++;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z; this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.life[i] = this.l0[i] = life; this.s[i] = size; this.grow[i] = grow; this.g[i] = grav; this.drag[i] = drag;
    this.base[i * 4] = r; this.base[i * 4 + 1] = g; this.base[i * 4 + 2] = b; this.base[i * 4 + 3] = a;
  }
  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { const j = --this.n; if (i !== j) this.copy(j, i); continue; }
      const k = this.life[i] / this.l0[i], dr = Math.max(0, 1 - this.drag[i] * dt);
      this.v[i * 3] *= dr; this.v[i * 3 + 2] *= dr; this.v[i * 3 + 1] = this.v[i * 3 + 1] * dr - this.g[i] * dt;
      this.p[i * 3] += this.v[i * 3] * dt; this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      if (this.p[i * 3 + 1] < 0.02 && this.g[i] > 0) { this.p[i * 3 + 1] = 0.02; this.v[i * 3 + 1] *= -0.35; this.v[i * 3] *= 0.6; this.v[i * 3 + 2] *= 0.6; }
      this.s[i] += this.grow[i] * dt;
      this.c[i * 4] = this.base[i * 4]; this.c[i * 4 + 1] = this.base[i * 4 + 1]; this.c[i * 4 + 2] = this.base[i * 4 + 2]; this.c[i * 4 + 3] = this.base[i * 4 + 3] * Math.min(1, k * 1.6) * (this.grow[i] > 0 ? Math.min(1, (1 - k) * 8) : 1);
      i++;
    }
    this.pts.geometry.setDrawRange(0, this.n);
    this.pa.needsUpdate = this.ca.needsUpdate = this.sa.needsUpdate = true;
  }
  copy(j, i) {
    for (let a = 0; a < 3; a++) { this.p[i * 3 + a] = this.p[j * 3 + a]; this.v[i * 3 + a] = this.v[j * 3 + a]; }
    for (let a = 0; a < 4; a++) { this.base[i * 4 + a] = this.base[j * 4 + a]; this.c[i * 4 + a] = this.c[j * 4 + a]; }
    this.life[i] = this.life[j]; this.l0[i] = this.l0[j]; this.s[i] = this.s[j]; this.grow[i] = this.grow[j]; this.g[i] = this.g[j]; this.drag[i] = this.drag[j];
  }
  clear() { this.n = 0; this.pts.geometry.setDrawRange(0, 0); }
}

// streak sparks + arc bolts as additive line segments
class StreakSys {
  constructor(scene, max) {
    this.max = max; this.n = 0; this.p = new Float32Array(max * 6); this.c = new Float32Array(max * 6);
    this.pos = new Float32Array(max * 3); this.v = new Float32Array(max * 3); this.life = new Float32Array(max); this.l0 = new Float32Array(max); this.col = new Float32Array(max * 3); this.len = new Float32Array(max); this.fixed = new Float32Array(max * 3);
    const geo = new THREE.BufferGeometry(); this.pa = new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage); this.ca = new THREE.BufferAttribute(this.c, 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.pa); geo.setAttribute('color', this.ca);
    this.lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.lines.frustumCulled = false; this.lines.renderOrder = 4; scene.add(this.lines);
  }
  add(x, y, z, vx, vy, vz, life, r, g, b, len = 0.035, fx = null) {
    let i = this.n; if (i >= this.max) i = (Math.random() * this.max) | 0; else this.n++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z; this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.life[i] = this.l0[i] = life; this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b; this.len[i] = len;
    if (fx) { this.fixed[i * 3] = fx[0]; this.fixed[i * 3 + 1] = fx[1]; this.fixed[i * 3 + 2] = fx[2]; this.len[i] = -1; }
  }
  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { const j = --this.n; if (i !== j) { for (let a = 0; a < 3; a++) { this.pos[i * 3 + a] = this.pos[j * 3 + a]; this.v[i * 3 + a] = this.v[j * 3 + a]; this.col[i * 3 + a] = this.col[j * 3 + a]; this.fixed[i * 3 + a] = this.fixed[j * 3 + a]; } this.life[i] = this.life[j]; this.l0[i] = this.l0[j]; this.len[i] = this.len[j]; } continue; }
      const k = this.life[i] / this.l0[i], o = i * 6;
      if (this.len[i] < 0) { // fixed bolt segment
        this.p[o] = this.pos[i * 3]; this.p[o + 1] = this.pos[i * 3 + 1]; this.p[o + 2] = this.pos[i * 3 + 2]; this.p[o + 3] = this.fixed[i * 3]; this.p[o + 4] = this.fixed[i * 3 + 1]; this.p[o + 5] = this.fixed[i * 3 + 2];
      } else {
        this.v[i * 3 + 1] -= 9.8 * dt;
        for (let a = 0; a < 3; a++) this.pos[i * 3 + a] += this.v[i * 3 + a] * dt;
        if (this.pos[i * 3 + 1] < 0.02) { this.pos[i * 3 + 1] = 0.02; this.v[i * 3 + 1] *= -0.4; this.v[i * 3] *= 0.5; this.v[i * 3 + 2] *= 0.5; }
        this.p[o] = this.pos[i * 3]; this.p[o + 1] = this.pos[i * 3 + 1]; this.p[o + 2] = this.pos[i * 3 + 2];
        for (let a = 0; a < 3; a++) this.p[o + 3 + a] = this.pos[i * 3 + a] - this.v[i * 3 + a] * this.len[i];
      }
      for (let a = 0; a < 3; a++) { this.c[o + a] = this.col[i * 3 + a] * k; this.c[o + 3 + a] = this.col[i * 3 + a] * k * 0.2; }
      i++;
    }
    this.lines.geometry.setDrawRange(0, this.n * 2); this.pa.needsUpdate = this.ca.needsUpdate = true;
  }
  clear() { this.n = 0; this.lines.geometry.setDrawRange(0, 0); }
}

class Instanced {
  constructor(scene, geo, mat, max) {
    this.mesh = new THREE.InstancedMesh(geo, mat, max); this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.frustumCulled = false;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.max = max; this.items = []; this.mesh.count = 0; scene.add(this.mesh);
  }
}

export function createFX(scene, { lite = false } = {}) {
  const sparks = new StreakSys(scene, lite ? 500 : 1200);
  const glow = new PointSys(scene, lite ? 300 : 700, true);
  const smoke = new PointSys(scene, lite ? 160 : 360, false);

  // tracers: unit box stretched from 0..-1 along local z, oriented to the shot
  const tg = new THREE.BoxGeometry(1, 1, 1); tg.translate(0, 0, 0.5);
  const tracers = new Instanced(scene, tg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), 80);
  tracers.mesh.renderOrder = 4;
  // impact decals
  const dg = new THREE.PlaneGeometry(1, 1);
  const decals = new Instanced(scene, dg, new THREE.MeshBasicMaterial({ map: softTex('scorch'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), 90);
  decals.mesh.renderOrder = 1; decals.head = 0;
  // debris chunks
  const bg = new THREE.BoxGeometry(1, 1, 1);
  const debris = new Instanced(scene, bg, new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.8, roughness: 0.4 }), lite ? 60 : 120);
  debris.mesh.castShadow = false;
  // explosion fireballs + shock rings
  const fireMat = () => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const fires = [], rings = [];
  const fgeo = new THREE.IcosahedronGeometry(1, 2), rgeo = new THREE.RingGeometry(0.85, 1, 48);
  for (let i = 0; i < 5; i++) {
    const f = new THREE.Mesh(fgeo, fireMat()); f.visible = false; f.renderOrder = 4; scene.add(f); fires.push({ m: f, t: 0, d: 0, s: 1, c: new THREE.Color() });
    const r = new THREE.Mesh(rgeo, fireMat()); r.visible = false; r.renderOrder = 4; r.rotation.x = -Math.PI / 2; scene.add(r); rings.push({ m: r, t: 0, d: 0, s: 1, c: new THREE.Color() });
  }
  // flash lights
  const lights = [];
  for (let i = 0; i < 2; i++) { const L = new THREE.PointLight(0xffaa55, 0, 18, 2); L.position.set(0, -50, 0); scene.add(L); lights.push({ L, t: 0, i0: 0 }); }

  const api = {
    sparks, glow, smoke,
    setScale(s) { glow.uni.uScale.value = s; smoke.uni.uScale.value = s; },
    clear() { sparks.clear(); glow.clear(); smoke.clear(); tracers.items.length = 0; debris.items.length = 0; decals.mesh.count = 0; decals.head = 0; fires.forEach(f => f.m.visible = false); rings.forEach(f => f.m.visible = false); lights.forEach(l => { l.t = 0; l.L.intensity = 0; }); },
    // metal impact: hot sparks + a glow pop + a little smoke
    impact(p, n, col = [1, 0.75, 0.4], amt = 1) {
      const c = Math.round((lite ? 6 : 12) * amt);
      for (let i = 0; i < c; i++) {
        const s = 3 + Math.random() * 7; V.set(n.x + (Math.random() - 0.5) * 1.6, n.y + (Math.random() - 0.3) * 1.4, n.z + (Math.random() - 0.5) * 1.6).normalize().multiplyScalar(s);
        sparks.add(p.x, p.y, p.z, V.x, V.y, V.z, 0.25 + Math.random() * 0.45, col[0] * 3, col[1] * 3, col[2] * 3, 0.03);
      }
      glow.add(p.x + n.x * 0.05, p.y + n.y * 0.05, p.z + n.z * 0.05, 0, 0, 0, 0.09, 0.9 * amt, col[0] * 4, col[1] * 4, col[2] * 4, 1);
      if (Math.random() < 0.6) smoke.add(p.x + n.x * 0.1, p.y + n.y * 0.1, p.z + n.z * 0.1, n.x * 0.4, 0.3 + n.y * 0.3, n.z * 0.4, 0.9, 0.25, 0.32, 0.32, 0.34, 0.45, 1.2, -0.05, 0.5);
    },
    burstGlow(p, col, n = 10, speed = 4, size = 0.25, life = 0.6) { for (let i = 0; i < n; i++) { V.randomDirection().multiplyScalar(speed * (0.3 + Math.random())); glow.add(p.x, p.y, p.z, V.x, V.y, V.z, life * (0.5 + Math.random() * 0.8), size, col[0], col[1], col[2], 1, -size * 0.5, 2, 1.5); } },
    steam(p, dir, amt = 1, col = [0.8, 0.85, 0.9]) { for (let i = 0; i < amt; i++) smoke.add(p.x, p.y, p.z, dir.x * (1 + Math.random()) + (Math.random() - 0.5) * 0.4, dir.y * (1 + Math.random()) + Math.random() * 0.3, dir.z * (1 + Math.random()) + (Math.random() - 0.5) * 0.4, 1.4 + Math.random() * 0.8, 0.4, col[0], col[1], col[2], 0.22, 2.2, -0.15, 0.8); },
    smokePuff(p, n = 6, dark = 0.12, size = 1.2, life = 2.2) { for (let i = 0; i < n; i++) { V.randomDirection(); smoke.add(p.x + V.x * 0.4, p.y + Math.abs(V.y) * 0.4, p.z + V.z * 0.4, V.x * 1.2, Math.abs(V.y) * 1.5 + 0.6, V.z * 1.2, life * (0.6 + Math.random() * 0.6), size, dark, dark, dark * 1.05, 0.6, size * 1.2, -0.25, 1.4); } },
    tracer(a, b, col, w = 0.03, life = 0.06) {
      const it = tracers.items.length < tracers.max ? {} : tracers.items.shift();
      it.a = a.clone(); it.b = b.clone(); it.c = col; it.w = w; it.t = it.l = life; tracers.items.push(it);
    },
    decal(p, n, size = 0.35) {
      const i = decals.head; decals.head = (decals.head + 1) % decals.max; decals.mesh.count = Math.max(decals.mesh.count, decals.head === 0 ? decals.max : decals.head);
      V.copy(p).addScaledVector(n, 0.012); Q.setFromUnitVectors(UP, n); const rq = new THREE.Quaternion().setFromAxisAngle(UP, Math.random() * 6.28); Q.multiply(rq);
      S.set(size, size, size); M.compose(V, Q, S); decals.mesh.setMatrixAt(i, M); decals.mesh.instanceColor.setXYZ(i, 1, 1, 1);
      decals.mesh.instanceMatrix.needsUpdate = true; decals.mesh.instanceColor.needsUpdate = true;
    },
    debris(p, n = 6, col = [0.25, 0.27, 0.3], speed = 6, size = 0.12) {
      for (let i = 0; i < n; i++) {
        const it = debris.items.length < debris.max ? {} : debris.items.shift();
        V.randomDirection(); V.y = Math.abs(V.y) + 0.4;
        it.p = p.clone(); it.v = V.clone().multiplyScalar(speed * (0.4 + Math.random())); it.r = new THREE.Euler(Math.random() * 6, Math.random() * 6, 0); it.w = new THREE.Vector3().randomDirection().multiplyScalar(10);
        it.s = new THREE.Vector3(size * (0.5 + Math.random()), size * (0.3 + Math.random() * 0.6), size * (0.6 + Math.random() * 1.2)); it.t = 2.5 + Math.random() * 1.5; it.c = col; it.hot = Math.random() < 0.3;
        debris.items.push(it);
      }
    },
    flash(p, col = 0xffaa55, inten = 60, dur = 0.25) { const l = lights.reduce((a, b) => (a.t < b.t ? a : b)); l.L.position.copy(p); l.L.color.set(col); l.i0 = inten; l.t = l.d = dur; l.L.intensity = inten; },
    explode(p, scale = 1, col = [3, 1.4, 0.4]) {
      const f = fires.reduce((a, b) => (a.t < b.t ? a : b)); f.m.position.copy(p); f.t = f.d = 0.55; f.s = 1.7 * scale; f.c.setRGB(col[0], col[1], col[2]); f.m.visible = true;
      const r = rings.reduce((a, b) => (a.t < b.t ? a : b)); r.m.position.set(p.x, Math.max(0.05, p.y - 0.4 * scale), p.z); r.t = r.d = 0.45; r.s = 6 * scale; r.c.setRGB(col[0] * 0.6, col[1] * 0.8, col[2] * 1.5); r.m.visible = true;
      api.flash(p, new THREE.Color(col[0] / 3, col[1] / 3, col[2] / 3).getHex(), 140 * scale, 0.4);
      for (let i = 0; i < (lite ? 25 : 60) * scale; i++) { V.randomDirection(); V.y = Math.abs(V.y) * 1.3; V.multiplyScalar(6 + Math.random() * 14); sparks.add(p.x, p.y, p.z, V.x, V.y, V.z, 0.5 + Math.random() * 0.8, 3, 1.6 + Math.random(), 0.5, 0.04); }
      api.burstGlow(p, [col[0] * 1.3, col[1] * 1.3, col[2] * 1.3], lite ? 10 : 22, 6 * scale, 0.5 * scale, 0.7);
      api.smokePuff(p, lite ? 6 : 12, 0.08, 1.5 * scale, 3);
      api.debris(p, Math.round((lite ? 5 : 10) * scale), [0.2, 0.2, 0.22], 9 * scale, 0.16);
    },
    arc(a, b, col = [1.2, 2.4, 4], life = 0.12) {
      const segs = 7; let px = a.x, py = a.y, pz = a.z;
      for (let i = 1; i <= segs; i++) {
        const k = i / segs, j = i === segs ? 0 : 0.5;
        const nx = a.x + (b.x - a.x) * k + (Math.random() - 0.5) * j, ny = a.y + (b.y - a.y) * k + (Math.random() - 0.5) * j, nz = a.z + (b.z - a.z) * k + (Math.random() - 0.5) * j;
        sparks.add(px, py, pz, 0, 0, 0, life, col[0], col[1], col[2], 0, [nx, ny, nz]); px = nx; py = ny; pz = nz;
      }
    },
    update(dt, cam) {
      sparks.update(dt); glow.update(dt); smoke.update(dt);
      // tracers
      let n = 0;
      for (let i = tracers.items.length - 1; i >= 0; i--) { const it = tracers.items[i]; it.t -= dt; if (it.t <= 0) tracers.items.splice(i, 1); }
      for (const it of tracers.items) {
        const k = it.t / it.l; V.subVectors(it.b, it.a); const len = V.length(); if (len < 0.01) continue;
        Q.setFromUnitVectors(UP, V.multiplyScalar(1 / len)); S.set(it.w * (0.4 + k * 0.6), it.w * (0.4 + k * 0.6), len); M.compose(it.a, Q, S);
        tracers.mesh.setMatrixAt(n, M); tracers.mesh.instanceColor.setXYZ(n, it.c[0] * k, it.c[1] * k, it.c[2] * k); n++;
      }
      tracers.mesh.count = n; tracers.mesh.instanceMatrix.needsUpdate = true; tracers.mesh.instanceColor.needsUpdate = true;
      // debris
      n = 0;
      for (let i = debris.items.length - 1; i >= 0; i--) { const it = debris.items[i]; it.t -= dt; if (it.t <= 0) debris.items.splice(i, 1); }
      for (const it of debris.items) {
        it.v.y -= 14 * dt; it.p.addScaledVector(it.v, dt);
        if (it.p.y < it.s.y * 0.5) { it.p.y = it.s.y * 0.5; it.v.y *= -0.35; it.v.x *= 0.6; it.v.z *= 0.6; it.w.multiplyScalar(0.6); }
        it.r.x += it.w.x * dt; it.r.y += it.w.y * dt; it.r.z += it.w.z * dt; Q.setFromEuler(it.r);
        const sh = Math.min(1, it.t * 2); S.copy(it.s).multiplyScalar(sh); M.compose(it.p, Q, S); debris.mesh.setMatrixAt(n, M);
        const hot = it.hot ? Math.max(0, it.t - 2) * 3 : 0; debris.mesh.instanceColor.setXYZ(n, it.c[0] + hot * 3, it.c[1] + hot, it.c[2]); n++;
        if (it.hot && it.t > 2 && Math.random() < 0.3) smoke.add(it.p.x, it.p.y, it.p.z, 0, 0.5, 0, 0.6, 0.12, 0.2, 0.2, 0.2, 0.4, 0.5, -0.1, 0);
      }
      debris.mesh.count = n; debris.mesh.instanceMatrix.needsUpdate = true; debris.mesh.instanceColor.needsUpdate = true;
      for (const f of fires) if (f.t > 0) { f.t -= dt; const k = 1 - f.t / f.d; f.m.scale.setScalar(f.s * (0.3 + Math.pow(k, 0.4) * 0.9)); f.m.material.color.copy(f.c).multiplyScalar(0.55 * Math.pow(1 - k, 2)); f.m.rotation.y += dt * 2; if (f.t <= 0) f.m.visible = false; }
      for (const r of rings) if (r.t > 0) { r.t -= dt; const k = 1 - r.t / r.d; r.m.scale.setScalar(r.s * Math.pow(k, 0.5)); r.m.material.color.copy(r.c).multiplyScalar(1 - k); if (r.t <= 0) r.m.visible = false; }
      for (const l of lights) if (l.t > 0) { l.t -= dt; l.L.intensity = l.i0 * Math.max(0, l.t / l.d); }
    },
  };
  return api;
}
