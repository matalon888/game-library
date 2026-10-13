// WebGL2 post-processing motoru.
// Canvas2D'de çizilen sahneyi texture'a alır, üzerine CRT + bloom + chromatic
// aberration + scanline + vignette + film grain shader pass'leri uygular.
//
// Build/asset gerekmez: tek dosya, <script> ile yüklenir.
// init(targetCanvas) → WebGL2 yoksa false döner; game.js fallback'e geçer.

const WebGLFX = (() => {
  let gl = null;
  let canvas = null;
  let texInput = null;
  let progPost = null, progBright = null, progBlur = null, progComposite = null;
  let fboA = null, texA = null;     // bright extract / blur ping
  let fboB = null, texB = null;     // blur pong
  let vao = null;
  let uPost = {}, uBright = {}, uBlur = {}, uComposite = {};
  let ready = false;
  let width = 0, height = 0;

  // ---- Shader kaynakları ----
  const VERT = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

  // Bright pass — sahneden parlak pikselleri ayır
  const FRAG_BRIGHT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_threshold;
out vec4 fragColor;
void main() {
  vec3 c = texture(u_tex, v_uv).rgb;
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  float k = smoothstep(u_threshold, u_threshold + 0.25, lum);
  fragColor = vec4(c * k, 1.0);
}`;

  // Gaussian blur — single axis (run twice: horizontal + vertical)
  const FRAG_BLUR = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_dir;       // (1/W, 0) ya da (0, 1/H) * spread
out vec4 fragColor;
void main() {
  // 9-tap gauss
  float w[5];
  w[0]=0.227027; w[1]=0.194594; w[2]=0.121622; w[3]=0.054054; w[4]=0.016216;
  vec3 acc = texture(u_tex, v_uv).rgb * w[0];
  for (int i = 1; i < 5; i++) {
    float fi = float(i);
    acc += texture(u_tex, v_uv + u_dir * fi).rgb * w[i];
    acc += texture(u_tex, v_uv - u_dir * fi).rgb * w[i];
  }
  fragColor = vec4(acc, 1.0);
}`;

  // Composite — original + bloom + CRT + scanlines + chromatic + vignette + grain
  const FRAG_COMPOSITE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_scene;
uniform sampler2D u_bloom;
uniform float u_time;
uniform vec2 u_res;
uniform float u_bloomStr;
uniform float u_crt;
uniform float u_chromatic;
uniform float u_scanline;
uniform float u_vignette;
uniform float u_grain;
out vec4 fragColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  // CRT barrel distortion
  vec2 cc = v_uv - 0.5;
  float r2 = dot(cc, cc);
  vec2 uv = v_uv + cc * r2 * u_crt;

  // Ekran dışıysa siyah
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // Chromatic aberration — distortion ile artar
  float ab = u_chromatic * (r2 + 0.3);
  vec3 sc;
  sc.r = texture(u_scene, uv + vec2(ab, 0.0)).r;
  sc.g = texture(u_scene, uv).g;
  sc.b = texture(u_scene, uv - vec2(ab, 0.0)).b;

  // Bloom ekle (sahne UV'sinde, distortion'a tabi)
  vec3 bl = texture(u_bloom, uv).rgb;
  vec3 col = sc + bl * u_bloomStr;

  // Scanlines — soluk yatay çizgiler, hafif animasyon
  float scan = sin(uv.y * u_res.y * 1.4 + u_time * 1.5) * 0.5 + 0.5;
  col *= 1.0 - scan * u_scanline;

  // Vignette
  float vig = smoothstep(0.85, 0.35, r2 * 2.0);
  col *= mix(1.0 - u_vignette, 1.0, vig);

  // Film grain — animated random
  float g = hash(uv * u_res + u_time * 60.0);
  col += (g - 0.5) * u_grain;

  // Soft hafif color grade — cyan/magenta lift
  col.r *= 0.97;
  col.b *= 1.04;
  col.g *= 1.00;

  // Brightness pump (gamma)
  col = pow(max(col, 0.0), vec3(0.92));

  fragColor = vec4(col, 1.0);
}`;

  // ---- Internal helpers ----
  function compile(src, type) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error("Shader compile error:", gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  function link(vsSrc, fsSrc) {
    const vs = compile(vsSrc, gl.VERTEX_SHADER);
    const fs = compile(fsSrc, gl.FRAGMENT_SHADER);
    if (!vs || !fs) return null;
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(p));
      return null;
    }
    return p;
  }

  function makeTex(w, h) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  }

  function makeFBO(tex) {
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return f;
  }

  function getUniforms(prog, names) {
    const out = {};
    names.forEach(n => { out[n] = gl.getUniformLocation(prog, n); });
    return out;
  }

  // ---- Public ----
  function init(targetCanvas) {
    canvas = targetCanvas;
    try {
      gl = canvas.getContext("webgl2", { antialias: false, alpha: false, preserveDrawingBuffer: false, premultipliedAlpha: false });
    } catch (e) { gl = null; }
    if (!gl) return false;

    width = canvas.width;
    height = canvas.height;

    // Shader programs
    progBright = link(VERT, FRAG_BRIGHT);
    progBlur = link(VERT, FRAG_BLUR);
    progComposite = link(VERT, FRAG_COMPOSITE);
    if (!progBright || !progBlur || !progComposite) { gl = null; return false; }

    uBright = getUniforms(progBright, ["u_tex", "u_threshold"]);
    uBlur = getUniforms(progBlur, ["u_tex", "u_dir"]);
    uComposite = getUniforms(progComposite, [
      "u_scene", "u_bloom", "u_time", "u_res",
      "u_bloomStr", "u_crt", "u_chromatic", "u_scanline", "u_vignette", "u_grain",
    ]);

    // Fullscreen quad
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    // pos attrib is location 0 in all 3 shaders (same VERT source)
    const aPos = 0;
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    // Bloom pingpong textures (yarı çözünürlükte — performans)
    const bw = Math.max(64, Math.floor(width / 2));
    const bh = Math.max(64, Math.floor(height / 2));
    texA = makeTex(bw, bh);
    fboA = makeFBO(texA);
    texB = makeTex(bw, bh);
    fboB = makeFBO(texB);

    // Input texture (sahne — tam çözünürlük)
    texInput = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texInput);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    ready = true;
    return true;
  }

  // Default post-FX parametreleri. game.js içinden tune edilebilir.
  const params = {
    bloomStr: 0.95,
    crt: 0.08,
    chromatic: 0.0028,
    scanline: 0.07,
    vignette: 0.32,
    grain: 0.045,
    brightThreshold: 0.62,
    blurSpread: 1.7,
  };

  function setParams(p) { Object.assign(params, p); }

  function composite(srcCanvas, timeMs) {
    if (!ready) return;
    const t = (timeMs || performance.now()) * 0.001;

    // 1. Sahneyi GPU'ya yükle
    gl.bindTexture(gl.TEXTURE_2D, texInput);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, srcCanvas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

    gl.bindVertexArray(vao);

    // 2. Bright extract → texA (yarı çözünürlükte)
    const bw = Math.max(64, Math.floor(width / 2));
    const bh = Math.max(64, Math.floor(height / 2));
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboA);
    gl.viewport(0, 0, bw, bh);
    gl.useProgram(progBright);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texInput);
    gl.uniform1i(uBright.u_tex, 0);
    gl.uniform1f(uBright.u_threshold, params.brightThreshold);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // 3. Yatay blur: texA → texB
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboB);
    gl.viewport(0, 0, bw, bh);
    gl.useProgram(progBlur);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texA);
    gl.uniform1i(uBlur.u_tex, 0);
    gl.uniform2f(uBlur.u_dir, params.blurSpread / bw, 0.0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // 4. Dikey blur: texB → texA
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboA);
    gl.viewport(0, 0, bw, bh);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texB);
    gl.uniform1i(uBlur.u_tex, 0);
    gl.uniform2f(uBlur.u_dir, 0.0, params.blurSpread / bh);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // 5. Composite — sahne + bloom + tüm efektler → ekran
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.useProgram(progComposite);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texInput);
    gl.uniform1i(uComposite.u_scene, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texA);
    gl.uniform1i(uComposite.u_bloom, 1);
    gl.uniform1f(uComposite.u_time, t);
    gl.uniform2f(uComposite.u_res, width, height);
    gl.uniform1f(uComposite.u_bloomStr, params.bloomStr);
    gl.uniform1f(uComposite.u_crt, params.crt);
    gl.uniform1f(uComposite.u_chromatic, params.chromatic);
    gl.uniform1f(uComposite.u_scanline, params.scanline);
    gl.uniform1f(uComposite.u_vignette, params.vignette);
    gl.uniform1f(uComposite.u_grain, params.grain);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function resize(w, h) {
    if (!ready) return;
    width = w; height = h;
    canvas.width = w; canvas.height = h;
    const bw = Math.max(64, Math.floor(w / 2));
    const bh = Math.max(64, Math.floor(h / 2));
    gl.bindTexture(gl.TEXTURE_2D, texA);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, bw, bh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindTexture(gl.TEXTURE_2D, texB);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, bw, bh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  }

  function isReady() { return ready; }

  return { init, composite, setParams, resize, isReady, params };
})();
