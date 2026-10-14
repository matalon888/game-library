// fx.js — pooled point particles (one draw call per system), our own code.
import { THREE } from './kit/hc.js';

/** additive = glowing sparks; otherwise soft alpha puffs (smoke). size is in world units (perspective-scaled). */
export function particles(scene, { max = 600, additive = false, scale = 300 } = {}) {
  const pos = new Float32Array(max * 3), col = new Float32Array(max * 4), size = new Float32Array(max);
  const P = []; for (let i = 0; i < max; i++) P.push({ life: 0, max: 1, v: new THREE.Vector3(), c: new THREE.Color(), s0: 1, s1: 1, g: 0, drag: 0, a: 1 });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('pcol', new THREE.BufferAttribute(col, 4)); geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { k: { value: scale } },
    vertexShader: `attribute float size; attribute vec4 pcol; uniform float k; varying vec4 vC; void main(){ vC = pcol; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = size * k / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: additive
      ? `varying vec4 vC; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vC.rgb * (1. - d * 2.) * vC.a, 1.); }`
      : `varying vec4 vC; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; float a = smoothstep(0.5, 0.15, d) * vC.a; gl_FragColor = vec4(vC.rgb, a); }`,
  });
  const pts = new THREE.Points(geo, m); pts.frustumCulled = false; scene.add(pts);
  let i0 = 0;
  return {
    points: pts,
    emit(p, { color = '#fff', n = 10, speed = 3, size = 0.3, size1, life = 0.8, g = 0, drag = 1.5, alpha = 1, dir = null, spread = 1, z = 0 } = {}) {
      const c = new THREE.Color(color);
      for (let j = 0; j < n; j++) {
        const i = i0, q = P[i]; i0 = (i0 + 1) % max;
        q.max = q.life = life * (0.6 + Math.random() * 0.6); q.c.copy(c); q.s0 = size * (0.6 + Math.random() * 0.8); q.s1 = size1 === undefined ? q.s0 : size1 * (0.7 + Math.random() * 0.6);
        q.g = g; q.drag = drag; q.a = alpha;
        if (dir) q.v.set(dir.x + (Math.random() - 0.5) * spread, dir.y + (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread * z).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.6));
        else q.v.set(Math.random() - 0.5, Math.random() - 0.5, (Math.random() - 0.5) * z).normalize().multiplyScalar(speed * (0.3 + Math.random() * 0.7));
        pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
      }
    },
    update(dt) {
      for (let i = 0; i < max; i++) {
        const q = P[i]; if (q.life <= 0) { size[i] = 0; continue; }
        q.life -= dt; q.v.y -= q.g * dt; q.v.multiplyScalar(Math.max(0, 1 - q.drag * dt));
        pos[i * 3] += q.v.x * dt; pos[i * 3 + 1] += q.v.y * dt; pos[i * 3 + 2] += q.v.z * dt;
        const t = 1 - Math.max(0, q.life) / q.max;
        size[i] = q.s0 + (q.s1 - q.s0) * t;
        col[i * 4] = q.c.r; col[i * 4 + 1] = q.c.g; col[i * 4 + 2] = q.c.b; col[i * 4 + 3] = q.a * (1 - t) * Math.min(1, t * 8 + 0.2);
      }
      geo.attributes.position.needsUpdate = geo.attributes.pcol.needsUpdate = geo.attributes.size.needsUpdate = true;
    },
    clear() { for (const q of P) q.life = 0; },
  };
}
