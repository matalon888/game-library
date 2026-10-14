// bloom.js — small neon bloom post-process (our own code). Renders the scene into an HDR target, extracts bright
// pixels, blurs them on a 4-level mip chain and adds them back. ~10 cheap full-screen passes.
import { THREE } from './kit/hc.js';

const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;

export function createBloom(renderer, scene, camera, { strength = 1.1, threshold = 0.75, levels = 4 } = {}) {
  const T = { type: THREE.HalfFloatType, depthBuffer: false };
  const main = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
  const down = [], tmp = [];
  for (let i = 0; i < levels; i++) { down.push(new THREE.WebGLRenderTarget(4, 4, T)); tmp.push(new THREE.WebGLRenderTarget(4, 4, T)); }
  const qs = new THREE.Scene(), qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false; qs.add(quad);
  const sm = (fs, uniforms) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false });
  const bright = sm(`uniform sampler2D t; uniform float th; varying vec2 vUv;
    void main(){ vec3 c = texture2D(t, vUv).rgb; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(th, th + 0.5, l), 1.); }`,
    { t: { value: null }, th: { value: threshold } });
  const blur = sm(`uniform sampler2D t; uniform vec2 d; varying vec2 vUv;
    void main(){ vec3 c = texture2D(t, vUv).rgb * 0.227;
      c += (texture2D(t, vUv + d * 1.385).rgb + texture2D(t, vUv - d * 1.385).rgb) * 0.316;
      c += (texture2D(t, vUv + d * 3.231).rgb + texture2D(t, vUv - d * 3.231).rgb) * 0.070;
      gl_FragColor = vec4(c, 1.); }`, { t: { value: null }, d: { value: new THREE.Vector2() } });
  const comp = sm(`uniform sampler2D base, b0, b1, b2, b3; uniform float s, vig, sat; uniform vec3 tint; varying vec2 vUv;
    void main(){ vec3 c = texture2D(base, vUv).rgb;
      vec3 b = texture2D(b0, vUv).rgb * 0.9 + texture2D(b1, vUv).rgb * 0.8 + texture2D(b2, vUv).rgb * 0.7 + texture2D(b3, vUv).rgb * 0.6;
      c += b * s;
      float g = dot(c, vec3(0.299, 0.587, 0.114)); c = mix(vec3(g), c, sat);
      vec2 q = vUv - 0.5; float v = smoothstep(0.25, 0.85, length(q * vec2(1.0, 0.8)));
      c = mix(c, tint, v * vig);
      gl_FragColor = vec4(c, 1.);
      #include <colorspace_fragment>
    }`, { base: { value: main.texture }, b0: { value: down[0].texture }, b1: { value: down[Math.min(1, levels - 1)].texture },
      b2: { value: down[Math.min(2, levels - 1)].texture }, b3: { value: down[Math.min(3, levels - 1)].texture },
      s: { value: strength }, vig: { value: 0 }, sat: { value: 1 }, tint: { value: new THREE.Color(0, 0, 0) } });
  const size = new THREE.Vector2(); let W = 0, H = 0;
  function pass(m, target) { quad.material = m; renderer.setRenderTarget(target); renderer.render(qs, qc); }
  function render() {
    renderer.getDrawingBufferSize(size);
    if (size.x !== W || size.y !== H) {
      W = size.x; H = size.y; main.setSize(W, H);
      for (let i = 0; i < levels; i++) { const w = Math.max(1, W >> (i + 1)), h = Math.max(1, H >> (i + 1)); down[i].setSize(w, h); tmp[i].setSize(w, h); }
    }
    renderer.setRenderTarget(main); renderer.render(scene, camera);
    for (let i = 0; i < levels; i++) {
      const src = i === 0 ? main.texture : down[i - 1].texture;
      bright.uniforms.t.value = src; bright.uniforms.th.value = i === 0 ? api.threshold : 0; pass(bright, down[i]);
      const w = down[i].width, h = down[i].height;
      blur.uniforms.t.value = down[i].texture; blur.uniforms.d.value.set(1 / w, 0); pass(blur, tmp[i]);
      blur.uniforms.t.value = tmp[i].texture; blur.uniforms.d.value.set(0, 1 / h); pass(blur, down[i]);
    }
    comp.uniforms.s.value = api.strength; pass(comp, null);
  }
  const api = { render, strength, threshold, uniforms: comp.uniforms };
  return api;
}

/** fresnel "neon outline" material: bright rim, dark core. Fades into the dark with distance. */
export function neonMat(color, { core = 0.06, power = 2.0, gain = 2.8 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { c: { value: new THREE.Color(color) }, flash: { value: 0 }, core: { value: core }, pw: { value: power }, gain: { value: gain } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vD;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 c; uniform float flash, core, pw, gain; varying vec3 vN; varying vec3 vV; varying float vD;
      void main(){ float r = 1. - abs(dot(normalize(vN), normalize(vV)));
        float e = pow(r, pw) * gain + core;
        float fade = exp(-max(0., vD - 18.) * 0.06);
        gl_FragColor = vec4((c * e + flash) * fade, 1.); }`,
  });
}
