// fx.js — shared visual helpers for the music games (glow sprites, gradient sky dome, stars). Our own code, MIT.
import { THREE } from '../kit/hc.js';

const texCache = {};
/** soft radial glow texture (white, alpha falloff) — tint with SpriteMaterial.color */
export function glowTex(kind = 'soft') {
  if (texCache[kind]) return texCache[kind];
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  if (kind === 'ring') { r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.72, 'rgba(255,255,255,0)'); r.addColorStop(0.86, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); }
  else if (kind === 'hard') { r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,0.9)'); r.addColorStop(0.6, 'rgba(255,255,255,0.25)'); r.addColorStop(1, 'rgba(255,255,255,0)'); }
  else if (kind === 'star') {
    g.translate(64, 64); g.fillStyle = '#fff'; g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 24 : 58; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    g.closePath(); g.shadowColor = '#fff'; g.shadowBlur = 10; g.fill();
    return texCache[kind] = new THREE.CanvasTexture(c);
  }
  else { r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); }
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return texCache[kind] = t;
}
export function glowSprite(color = '#fff', size = 1, kind = 'soft', opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(kind), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(size); return s;
}
/** a big inside-out sphere with a vertical 3-stop gradient (sky), follows nothing — add to scene once */
export function skyDome(top, mid, bottom, radius = 300) {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, mid: { value: new THREE.Color(mid) }, bot: { value: new THREE.Color(bottom) }, pulse: { value: 0 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform float pulse; varying vec3 vP;
      void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.55, h)) : mix(mid, bot, smoothstep(0.0, 0.35, -h));
      c += pulse * 0.08; gl_FragColor = vec4(c, 1.0); }`,
  });
  const d = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), m); d.renderOrder = -10; d.frustumCulled = false;
  d.setColors = (a, b, c) => { m.uniforms.top.value.set(a); m.uniforms.mid.value.set(b); m.uniforms.bot.value.set(c); };
  d.uniforms = m.uniforms; return d;
}
/** field of little twinkling points */
export function starField(n = 400, radius = 200, color = '#ffffff', size = 1.2, yMin = -0.1) {
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = Math.random() * Math.PI * 2, v = yMin + Math.random() * (1 - yMin), r = radius * (0.85 + Math.random() * 0.15), s = Math.sqrt(1 - v * v);
    pos.set([Math.cos(u) * s * r, v * r, Math.sin(u) * s * r], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color, size, sizeAttenuation: false, transparent: true, opacity: 0.85, depthWrite: false, map: glowTex('hard'), blending: THREE.AdditiveBlending }));
  p.frustumCulled = false; return p;
}
/** simple pooled additive "spark" particles that live in world space (cheap glow bursts) */
export function sparks(scene, max = 160) {
  const list = [];
  return {
    emit(pos, color, n = 12, { speed = 0.08, size = 0.35, up = 0.04, life = 1, gravity = 0.002, spread = 1 } = {}) {
      for (let k = 0; k < n; k++) {
        if (list.length >= max) { const o = list.shift(); scene.remove(o.s); o.s.material.dispose(); }
        const s = glowSprite(Array.isArray(color) ? color[k % color.length] : color, size * (0.5 + Math.random()), 'hard'); s.position.copy(pos); scene.add(s);
        const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI;
        list.push({ s, v: new THREE.Vector3(Math.cos(a) * Math.sin(b) * speed * spread, up + Math.random() * speed, Math.sin(a) * Math.sin(b) * speed * spread), life, g: gravity, base: s.scale.x });
      }
    },
    update(dt) {
      for (let k = list.length - 1; k >= 0; k--) {
        const o = list[k]; o.v.y -= o.g * dt; o.s.position.addScaledVector(o.v, dt); o.life -= 0.025 * dt;
        o.s.material.opacity = Math.max(0, o.life); o.s.scale.setScalar(o.base * (0.4 + 0.6 * o.life));
        if (o.life <= 0) { scene.remove(o.s); o.s.material.dispose(); list.splice(k, 1); }
      }
    },
    clear() { for (const o of list) { scene.remove(o.s); o.s.material.dispose(); } list.length = 0; },
  };
}
export const ease = { out: (t) => 1 - Math.pow(1 - t, 3), inOut: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, back: (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2) };
