// Cinematic rendering for the immersive games (batch 10): filmic tone mapping, image-based lighting, soft shadows,
// bloom, anti-aliasing and an optional colour grade + vignette. One call: const C = cine(renderer, scene, camera, opts);
// then C.render() every frame (instead of renderer.render) and C.resize(w, h) on resize. Uses three.js r170 add-ons
// vendored in kit/addons (publish.py ships them only with games that import them).
import * as THREE from './three.module.min.js';
import { EffectComposer } from './addons/postprocessing/EffectComposer.js';
import { RenderPass } from './addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './addons/postprocessing/OutputPass.js';
import { ShaderPass } from './addons/postprocessing/ShaderPass.js';
import { SMAAPass } from './addons/postprocessing/SMAAPass.js';
import { RoomEnvironment } from './addons/environments/RoomEnvironment.js';

export { THREE };

// grade + vignette + subtle film grain, applied after tone mapping
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTint: { value: new THREE.Color(1, 1, 1) }, uLift: { value: new THREE.Color(0, 0, 0) },
    uSat: { value: 1.1 }, uContrast: { value: 1.08 }, uVignette: { value: 0.35 }, uGrain: { value: 0.035 }, uTime: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec3 uTint, uLift; uniform float uSat, uContrast, uVignette, uGrain, uTime; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime) * 43758.5453); }
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec3 col = c.rgb * uTint + uLift;
      float l = dot(col, vec3(.2126, .7152, .0722)); col = mix(vec3(l), col, uSat); col = (col - .5) * uContrast + .5;
      float d = distance(vUv, vec2(.5)); col *= 1. - uVignette * smoothstep(.35, .85, d);
      col += (h(vUv * 1000.) - .5) * uGrain; gl_FragColor = vec4(clamp(col, 0., 1.), c.a); }`,
};

export function cine(renderer, scene, camera, o = {}) {
  const lite = o.lite ?? (Math.min(screen.width, screen.height) < 500 && devicePixelRatio > 2.5) ?? false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = o.exposure ?? 1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(devicePixelRatio, lite ? 1.5 : 2));
  if (o.env !== false && !scene.environment) {           // soft studio reflections on every MeshStandardMaterial
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
    scene.environmentIntensity = o.envIntensity ?? 0.6;
  }
  if (o.fog) scene.fog = o.fog === true ? new THREE.FogExp2(scene.background?.isColor ? scene.background : 0x0a0d14, 0.02) : o.fog;
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), o.bloom ?? 0.6, o.bloomRadius ?? 0.5, o.bloomThreshold ?? 0.85);
  if ((o.bloom ?? 0.6) > 0) composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  if (o.grade !== false) {
    const g = o.grade || {};
    if (g.tint) grade.uniforms.uTint.value.set(g.tint);
    if (g.lift) grade.uniforms.uLift.value.set(g.lift);
    for (const k of ['sat', 'contrast', 'vignette', 'grain']) if (g[k] != null) grade.uniforms['u' + k[0].toUpperCase() + k.slice(1)].value = g[k];
    composer.addPass(grade);
  }
  let smaa = null;
  if (!lite && o.aa !== false) { smaa = new SMAAPass(size.x * renderer.getPixelRatio(), size.y * renderer.getPixelRatio()); composer.addPass(smaa); }
  let t = 0;
  return {
    composer, bloom, grade, lite,
    render(dt = 1 / 60) { t += dt; grade.uniforms.uTime.value = t % 100; composer.render(dt); },
    resize(w, h) { composer.setSize(w, h); bloom.setSize(w, h); smaa && smaa.setSize(w * renderer.getPixelRatio(), h * renderer.getPixelRatio()); },
  };
}

// procedural PBR textures drawn on a canvas (no image files): 'metal', 'concrete', 'panel', 'rock', 'grid'
export function procTex(kind = 'concrete', o = {}) {
  const n = o.size || 512, c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d');
  const r = (a, b) => a + Math.random() * (b - a), base = o.color || { metal: '#6b7280', concrete: '#8a8a86', panel: '#4b5563', rock: '#6d6458', grid: '#1f2937' }[kind] || '#888';
  x.fillStyle = base; x.fillRect(0, 0, n, n);
  for (let i = 0; i < n * 6; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '0,0,0'},${r(0.01, 0.05)})`; const s = r(1, kind === 'rock' ? 18 : 6); x.fillRect(r(0, n), r(0, n), s, s); }
  if (kind === 'metal') for (let i = 0; i < n; i += 2) { x.fillStyle = `rgba(255,255,255,${r(0, .04)})`; x.fillRect(0, i, n, 1); }
  if (kind === 'panel' || kind === 'grid') {
    const step = kind === 'grid' ? n / 8 : n / 4; x.strokeStyle = kind === 'grid' ? 'rgba(120,200,255,.35)' : 'rgba(0,0,0,.45)'; x.lineWidth = kind === 'grid' ? 2 : 4;
    for (let i = 0; i <= n; i += step) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, n); x.moveTo(0, i); x.lineTo(n, i); x.stroke(); }
    if (kind === 'panel') { x.fillStyle = 'rgba(0,0,0,.35)'; for (let i = step / 2; i < n; i += step) for (let j = step / 2; j < n; j += step) [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { x.beginPath(); x.arc(i + a * step * .38, j + b * step * .38, 4, 0, 7); x.fill(); }); }
  }
  if (kind === 'concrete' || kind === 'rock') for (let i = 0; i < 40; i++) { x.strokeStyle = `rgba(0,0,0,${r(.05, .18)})`; x.lineWidth = r(.5, 2); x.beginPath(); let px = r(0, n), py = r(0, n); x.moveTo(px, py); for (let k = 0; k < 6; k++) x.lineTo(px += r(-30, 30), py += r(-30, 30)); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (o.repeat) t.repeat.set(o.repeat, o.repeat);
  return t;
}
