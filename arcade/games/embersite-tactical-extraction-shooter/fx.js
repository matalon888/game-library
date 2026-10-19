// Embersite FX: pooled particles (additive sparks/fire + alpha smoke/dust), tracers, bullet-hole decals, debris chunks,
// toon fireballs + shockwave rings, a small pool of flash lights, emitters (burning wrecks, smoke grenades, flares), shake.
import { THREE } from './kit/cine.js';
import { RAMP } from './models.js';
const V3 = THREE.Vector3;

function dotTex(hard = .35) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(hard, 'rgba(255,255,255,.85)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
function puffTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28, r = i ? 26 : 0, px = 64 + Math.cos(a) * r, py = 64 + Math.sin(a) * r, rad = i ? 30 : 40; const g = x.createRadialGradient(px, py, 0, px, py, rad); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.7, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.arc(px, py, rad, 0, 7); x.fill(); }
  return new THREE.CanvasTexture(c);
}
class PS {
  constructor(scene, n, additive, tex) {
    this.n = n; this.i = 0;
    const A = k => new Float32Array(n * k);
    Object.assign(this, { pos: A(3), vel: A(3), col: A(4), size: A(1), life: A(1), max: A(1), s0: A(1), s1: A(1), a0: A(1), grav: A(1), drag: A(1), rot: A(1) });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aCol', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aRot', new THREE.BufferAttribute(this.rot, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uTex: { value: tex }, uScale: { value: 400 }, uFog: { value: new THREE.Color() }, uDen: { value: .003 } },
      vertexShader: `attribute vec4 aCol; attribute float aSize, aRot; varying vec4 vCol; varying float vFd, vRot; uniform float uScale;
        void main(){ vCol = aCol; vRot = aRot; vec4 mv = modelViewMatrix * vec4(position, 1.); vFd = -mv.z; gl_PointSize = aSize * uScale / max(.1, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D uTex; uniform vec3 uFog; uniform float uDen; varying vec4 vCol; varying float vFd, vRot;
        void main(){ vec2 p = gl_PointCoord - .5; float c = cos(vRot), s = sin(vRot); p = mat2(c, -s, s, c) * p + .5; vec4 t = texture2D(uTex, p);
          float ff = 1. - exp(-uDen * uDen * vFd * vFd); vec3 col = ${additive ? 'vCol.rgb * (1. - ff)' : 'mix(vCol.rgb, uFog, ff)'};
          gl_FragColor = vec4(col, t.a * vCol.a); if (gl_FragColor.a < .01) discard; }`,
    });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; this.pts.renderOrder = additive ? 8 : 7; scene.add(this.pts);
    this.g = g;
  }
  spawn(p, v, life, s0, s1, r, gg, b, a, grav = 0, drag = 0) {
    const i = this.i; this.i = (this.i + 1) % this.n;
    this.pos.set([p.x, p.y, p.z], i * 3); this.vel.set([v.x, v.y, v.z], i * 3); this.col.set([r, gg, b, a], i * 4);
    this.life[i] = this.max[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = a; this.grav[i] = grav; this.drag[i] = drag; this.size[i] = s0; this.rot[i] = Math.random() * 6.28;
  }
  update(dt) {
    const { pos, vel, col, size, life, max, s0, s1, a0, grav, drag } = this;
    for (let i = 0; i < this.n; i++) {
      if (life[i] <= 0) { if (size[i]) size[i] = 0; continue; }
      life[i] -= dt; const t = 1 - life[i] / max[i], k = i * 3, dd = Math.max(0, 1 - drag[i] * dt);
      vel[k] *= dd; vel[k + 1] = vel[k + 1] * dd - grav[i] * dt; vel[k + 2] *= dd;
      pos[k] += vel[k] * dt; pos[k + 1] += vel[k + 1] * dt; pos[k + 2] += vel[k + 2] * dt;
      size[i] = life[i] <= 0 ? 0 : s0[i] + (s1[i] - s0[i]) * Math.sqrt(t);
      col[i * 4 + 3] = a0[i] * Math.min(1, t * 8) * (1 - t * t);
    }
    this.g.attributes.position.needsUpdate = this.g.attributes.aCol.needsUpdate = this.g.attributes.aSize.needsUpdate = true;
  }
}

export function createFX(scene, camera, world, renderer, { lite = false } = {}) {
  const add = new PS(scene, lite ? 500 : 900, true, dotTex(.25)), smoke = new PS(scene, lite ? 500 : 900, false, puffTex());
  const fx = { add, smoke, trauma: 0, emitters: [] };
  const rv = (s = 1) => new V3((Math.random() - .5) * 2 * s, (Math.random() - .5) * 2 * s, (Math.random() - .5) * 2 * s);
  const tmp = new V3();
  // ---- flash lights (fixed count so shaders never recompile)
  const lights = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xffa040, 0, 12, 2); scene.add(l); return { l, t: 0, d: 1, i: 0 }; });
  let li = 0;
  fx.flash = (p, color = 0xffa040, intensity = 40, dist = 14, dur = .08) => { const L = lights[li]; li = (li + 1) % lights.length; L.l.position.copy(p); L.l.color.set(color); L.l.distance = dist; L.i = intensity; L.t = L.d = dur; L.l.intensity = intensity; };
  // ---- streaks (tracers / plasma bolts / laser)
  const SN = 96, sg = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, -.5);
  const sm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: true });
  const streaks = new THREE.InstancedMesh(sg, sm, SN); streaks.instanceMatrix.setUsage(THREE.DynamicDrawUsage); streaks.frustumCulled = false; streaks.renderOrder = 9;
  streaks.setColorAt(0, new THREE.Color()); scene.add(streaks);
  const sl = Array.from({ length: SN }, () => ({ on: false, life: 0 })), zero = new THREE.Matrix4().makeScale(0, 0, 0), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), Z = new V3(0, 0, 1);
  for (let i = 0; i < SN; i++) streaks.setMatrixAt(i, zero);
  fx.streak = (a, b, color, width = .04, life = 0) => { // life 0 = owned (caller frees); >0 = auto fade
    let i = sl.findIndex(s => !s.on); if (i < 0) i = 0;
    sl[i].on = true; sl[i].life = life; sl[i].max = life; sl[i].w = width; fx.setStreak(i, a, b, width); streaks.setColorAt(i, tmp.set(0, 0, 0) && new THREE.Color(color)); streaks.instanceColor.needsUpdate = true; return i;
  };
  fx.setStreak = (i, a, b, w = sl[i].w) => { tmp.subVectors(a, b); const L = tmp.length(); if (L < 1e-4) { streaks.setMatrixAt(i, zero); return; } q.setFromUnitVectors(Z, tmp.divideScalar(L)); m4.compose(a, q, new V3(w, w, L)); streaks.setMatrixAt(i, m4); streaks.instanceMatrix.needsUpdate = true; };
  fx.freeStreak = i => { if (i == null || i < 0) return; sl[i].on = false; streaks.setMatrixAt(i, zero); streaks.instanceMatrix.needsUpdate = true; };
  // ---- decals
  const DN = lite ? 40 : 80, dtex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 30); g.addColorStop(0, 'rgba(10,8,12,1)'); g.addColorStop(.3, 'rgba(20,16,20,.9)'); g.addColorStop(.55, 'rgba(40,30,30,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const decals = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: dtex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, opacity: .8 }), DN);
  decals.frustumCulled = false; for (let i = 0; i < DN; i++) decals.setMatrixAt(i, zero); scene.add(decals); let di = 0;
  fx.decal = (p, n, s = .25) => { q.setFromUnitVectors(Z, n); q.multiply(new THREE.Quaternion().setFromAxisAngle(Z, Math.random() * 6.28)); m4.compose(tmp.copy(p).addScaledVector(n, .02), q, new V3(s, s, s)); decals.setMatrixAt(di, m4); di = (di + 1) % DN; decals.instanceMatrix.needsUpdate = true; };
  // ---- debris chunks (toon)
  const BN = lite ? 50 : 100, debris = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshToonMaterial({ gradientMap: RAMP }), BN);
  debris.castShadow = true; debris.frustumCulled = false; debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage); for (let i = 0; i < BN; i++) { debris.setMatrixAt(i, zero); debris.setColorAt(i, new THREE.Color(1, 1, 1)); } scene.add(debris);
  const bl = Array.from({ length: BN }, () => ({ life: 0, p: new V3(), v: new V3(), r: new THREE.Euler(), w: new V3(), s: .1 })); let bi = 0;
  fx.debris = (p, n, color, speed = 6, size = .12) => { for (let k = 0; k < n; k++) { const d = bl[bi]; debris.setColorAt(bi, new THREE.Color(Array.isArray(color) ? color[k % color.length] : color)); bi = (bi + 1) % BN; d.life = 2.5 + Math.random() * 2; d.p.copy(p); d.v.copy(rv(speed)).add(new V3(0, speed * .7, 0)); d.w.copy(rv(10)); d.s = size * (.5 + Math.random()); } debris.instanceColor.needsUpdate = true; };
  // ---- toon fireballs + shockwave rings
  const balls = Array.from({ length: 6 }, () => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshBasicMaterial({ color: 0xffb030, transparent: true, depthWrite: false })); m.visible = false; scene.add(m); return { m, t: 0, d: 1, s: 1 }; });
  const rings = Array.from({ length: 4 }, () => { const m = new THREE.Mesh(new THREE.RingGeometry(.8, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide })); m.visible = false; scene.add(m); return { m, t: 0, d: 1, s: 1 }; });
  let fb = 0, rg = 0;
  // ---- presets
  fx.sparks = (p, n = 12, speed = 6, hot = 1) => { for (let k = 0; k < n; k++) add.spawn(p, rv(speed).add(new V3(0, speed * .4, 0)), .25 + Math.random() * .35, .14 * hot, .03, 4 * hot, 2.4 * hot, .8, 1, 14, 1.5); add.spawn(p, new V3(), .08, .9 * hot, 1.4 * hot, 5, 3.5, 1.5, 1); };
  fx.puff = (p, n, rgb, size = .6, up = 1, life = 1.2, spread = 1) => { for (let k = 0; k < n; k++) smoke.spawn(tmp.copy(p).add(rv(.2 * spread)), rv(spread).add(new V3(0, up, 0)), life * (.7 + Math.random() * .6), size * .5, size * (1.4 + Math.random()), rgb[0], rgb[1], rgb[2], .85, -.3, 1.5); };
  fx.impact = (hit, dir) => {
    const p = hit.p, n = hit.n || new V3(0, 1, 0);
    if (hit.kind === 'water') { for (let k = 0; k < 10; k++) smoke.spawn(p, new V3((Math.random() - .5) * 1.5, 3 + Math.random() * 3, (Math.random() - .5) * 1.5), .7, .15, .5, .85, .95, 1, .9, 9, .5); return; }
    if (hit.kind === 'robot') { fx.sparks(p, 10, 7); fx.puff(p, 2, [.25, .25, .3], .25, .6, .6); fx.flash(p, 0xffb050, 10, 6, .05); return; }
    const c = hit.kind === 'terrain' ? [.62, .5, .34] : hit.kind === 'box' ? [.82, .8, .76] : hit.kind === 'rock' ? [.7, .7, .75] : [.55, .38, .22];
    fx.puff(tmp.copy(p).addScaledVector(n, .1), 3, c, .35, .8, .9, .7);
    if (hit.kind === 'box' || hit.kind === 'rock') fx.sparks(p, 4, 4, .7);
    fx.debris(p, 2, hit.kind === 'terrain' ? '#7a5a36' : hit.kind === 'tree' || hit.kind === 'tree' ? '#9a6a3a' : '#9a968c', 3, .06);
    if (hit.kind !== 'tree') fx.decal(p, n, .22);
  };
  fx.explosion = (p, s = 1) => {
    const B = balls[fb]; fb = (fb + 1) % balls.length; B.m.position.copy(p); B.t = 0; B.d = .55 * s; B.s = 3.2 * s; B.m.visible = true;
    const B2 = balls[fb]; fb = (fb + 1) % balls.length; B2.m.position.copy(p).add(new V3(0, .8 * s, 0)); B2.t = -.05; B2.d = .7 * s; B2.s = 2.4 * s; B2.m.visible = true;
    const Rr = rings[rg]; rg = (rg + 1) % rings.length; Rr.m.position.copy(p).setY(Math.max(p.y - .3, world.h(p.x, p.z) + .15)); Rr.t = 0; Rr.d = .45; Rr.s = 9 * s; Rr.m.visible = true;
    for (let k = 0; k < 26 * s; k++) add.spawn(p, rv(9 * s).add(new V3(0, 5 * s, 0)), .4 + Math.random() * .5, .18, .04, 5, 2.8, .8, 1, 12, 1);
    for (let k = 0; k < 14 * s; k++) add.spawn(tmp.copy(p).add(rv(1.2 * s)), rv(3 * s).add(new V3(0, 2, 0)), .35 + Math.random() * .3, 1.6 * s, 3.2 * s, 4, 1.6, .4, .9, -1, 2);
    fx.puff(p, Math.round(12 * s), [.32, .3, .32], 1.6 * s, 2.2, 2.4, 2.5 * s);
    fx.debris(p, Math.round(10 * s), ['#3a3f4c', '#ff7a22', '#eef0f3', '#2b3140'], 9 * s, .2 * s);
    fx.flash(p, 0xff9a40, 120 * s, 30 * s, .25);
    fx.decal(tmp.set(p.x, world.h(p.x, p.z), p.z), world.normal(p.x, p.z), 2.4 * s);
  };
  fx.emitter = (o) => { const e = { p: o.p.clone(), life: o.life ?? 8, rate: o.rate ?? 8, kind: o.kind || 'smoke', acc: 0, size: o.size || 1, color: o.color, follow: o.follow || null }; fx.emitters.push(e); return e; };
  fx.shake = a => { fx.trauma = Math.min(1.2, fx.trauma + a); };

  fx.update = (dt) => {
    const h = renderer.getDrawingBufferSize(new THREE.Vector2()).y;
    add.mat.uniforms.uScale.value = smoke.mat.uniforms.uScale.value = h * camera.projectionMatrix.elements[5] * .5;
    if (scene.fog) { smoke.mat.uniforms.uFog.value.copy(scene.fog.color); smoke.mat.uniforms.uDen.value = add.mat.uniforms.uDen.value = scene.fog.density; }
    add.update(dt); smoke.update(dt);
    for (const L of lights) if (L.t > 0) { L.t -= dt; L.l.intensity = Math.max(0, L.i * L.t / L.d); } else L.l.intensity = 0;
    for (let i = 0; i < SN; i++) { const s = sl[i]; if (!s.on || !s.max) continue; s.life -= dt; if (s.life <= 0) fx.freeStreak(i); }
    let dm = false;
    for (let i = 0; i < BN; i++) { const d = bl[i]; if (d.life <= 0) continue; dm = true; d.life -= dt; d.v.y -= 20 * dt; d.p.addScaledVector(d.v, dt);
      const g = world.h(d.p.x, d.p.z); if (d.p.y < g + d.s * .5) { d.p.y = g + d.s * .5; d.v.y = Math.abs(d.v.y) * .35; d.v.x *= .6; d.v.z *= .6; d.w.multiplyScalar(.6); }
      d.r.x += d.w.x * dt; d.r.y += d.w.y * dt; d.r.z += d.w.z * dt; const sc = d.s * Math.min(1, d.life * 2);
      m4.compose(d.p, q.setFromEuler(d.r), new V3(sc, sc * .7, sc * 1.3)); debris.setMatrixAt(i, d.life > 0 ? m4 : zero); }
    if (dm) debris.instanceMatrix.needsUpdate = true;
    for (const B of balls) { if (!B.m.visible) continue; B.t += dt; const t = Math.max(0, B.t / B.d); if (t >= 1) { B.m.visible = false; continue; }
      B.m.scale.setScalar(B.s * (.3 + Math.sqrt(t) * .9)); B.m.material.opacity = 1 - t * t; B.m.material.color.setRGB(3, 1.6 - t, .5 - t * .4).lerp(new THREE.Color(.3, .28, .3), t * t); }
    for (const Rr of rings) { if (!Rr.m.visible) continue; Rr.t += dt; const t = Rr.t / Rr.d; if (t >= 1) { Rr.m.visible = false; continue; } Rr.m.scale.setScalar(.5 + t * Rr.s); Rr.m.material.opacity = (1 - t) * .8; }
    for (let i = fx.emitters.length - 1; i >= 0; i--) {
      const e = fx.emitters[i]; e.life -= dt; if (e.life <= 0) { fx.emitters.splice(i, 1); continue; }
      if (e.follow) e.p.copy(e.follow.getWorldPosition ? e.follow.getWorldPosition(tmp) : e.follow);
      e.acc += e.rate * dt;
      while (e.acc >= 1) { e.acc--;
        if (e.kind === 'smoke') smoke.spawn(tmp.copy(e.p).add(rv(.3 * e.size)), rv(.4).add(new V3(0, 1.4, 0)), 2.6, .5 * e.size, 2.2 * e.size, .22, .22, .26, .8, -.2, .4);
        else if (e.kind === 'fire') { add.spawn(tmp.copy(e.p).add(rv(.25 * e.size)), rv(.4).add(new V3(0, 2.2, 0)), .5, .6 * e.size, .15, 4, 1.6, .3, 1, -1, 1); }
        else if (e.kind === 'cloud') smoke.spawn(tmp.copy(e.p).add(rv(2.5)), rv(1.5).add(new V3(0, .25, 0)), 7, 3, 7.5, .93, .95, .98, .95, 0, .5);
        else if (e.kind === 'flare') smoke.spawn(tmp.copy(e.p).add(rv(.2)), rv(.5).add(new V3(0, 3.2, 0)), 4.5, .6, 4, e.color[0], e.color[1], e.color[2], .9, -.15, .2);
        else if (e.kind === 'mist') smoke.spawn(tmp.copy(e.p).add(new V3((Math.random() - .5) * 22, 0, (Math.random() - .5) * 4)), rv(.8).add(new V3(0, 1.5, 1.5)), 3, 2, 6, .95, .98, 1, .5, 0, .3);
      }
    }
    fx.trauma = Math.max(0, fx.trauma - dt * 1.6);
  };
  return fx;
}
