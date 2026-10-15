// space.js — deep-space environment. The sky (nebula + embedded starfields) is
// baked into HalfFloat cubemaps by an expensive shader. BOTH gauntlet systems
// are prebaked at boot (system list is deterministic from the seed), so
// setSystem during warp does ZERO bake work — it swaps a texture. A fallback
// runtime path (systems >= 2) rebakes in scissored strips well under 8ms per
// frame. Planets are PREBUILT at boot (geometry + compiled materials);
// per-system work is uniform updates only.
// ONE sun direction per system drives: the sun flare sprites, both planets'
// terminators, the atmosphere shells, asteroid lighting and the scene key
// light. Parallax star layers use a custom point shader (per-star size +
// colour temperature, band clustering, a few hot bloomers) and hide during
// warp so nothing static contradicts the streak field.
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// shared GLSL: 3D simplex noise (Ashima) + fbm
// ---------------------------------------------------------------------------
const GLSL_NOISE = /* glsl */`
  vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
  vec4 mod289(vec4 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
  vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
  float fbm6(vec3 p){ float v=0.0,a=0.5; for(int i=0;i<6;i++){ v+=a*snoise(p); p=p*2.02+11.3; a*=0.5; } return v; }
  float fbm4(vec3 p){ float v=0.0,a=0.5; for(int i=0;i<4;i++){ v+=a*snoise(p); p=p*2.07+7.7; a*=0.5; } return v; }
`;

// ---------------------------------------------------------------------------
// sky BAKE shader — runs into the cubemap (one face per frame), so it can be
// heavy. Multi-scale domain-warped nebula with hue families BRIDGED through
// shared structure (one warp field, one band, torn edges from the same fbm) so
// no colour family reads as pasted on. Dust lanes, hot emissive cores, three
// embedded star layers whose density follows the galactic band.
// ---------------------------------------------------------------------------
const BAKE_VERT = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const BAKE_FRAG = /* glsl */`
  precision highp float;
  varying vec3 vDir;
  uniform vec3 uDeep, uColA, uColB, uColC, uBandDir, uFlowDir, uOff, uSunDirBake, uSunWarm;
  uniform float uDustAmt, uCoreAmt, uStreakAmt, uStarBias, uStarAmt, uSoft;
  ${''}
  ${'PLACEHOLDER_NOISE'}

  vec4 hash43(vec3 p){
    vec4 p4 = fract(vec4(p.xyzx) * vec4(0.1031, 0.1030, 0.0973, 0.1099));
    p4 += dot(p4, p4.wzxy + 33.33);
    return fract((p4.xxyz + p4.yzzw) * p4.zywx);
  }

  // one cell-hash star layer: power-law brightness, colour temperature spread
  vec3 starLayer(vec3 d, float freq, float thresh, float maxB, float sig) {
    vec3 p = d * freq + uOff;
    vec3 id = floor(p);
    vec3 f = fract(p) - 0.5;
    vec4 h = hash43(id);
    float gate = step(thresh, h.w);
    float u = clamp((h.w - thresh) / max(1.0 - thresh, 1e-4), 0.0, 1.0);
    float b = maxB * (0.05 + 0.95 * pow(u, 7.0)) * gate;
    vec3 sp = (h.xyz - 0.5) * 0.62;
    float dist = length(f - sp);
    float g = exp(-dist * dist / (2.0 * sig * sig));
    float temp = fract(h.x * 7.31 + h.y * 3.71);
    // softened amber: accumulated subpixel stars must not sum to a gold wash
    vec3 tint = mix(vec3(0.95, 0.72, 0.45), vec3(0.62, 0.78, 1.10), temp);
    return tint * b * g;
  }

  void main() {
    vec3 d = normalize(vDir);
    // ONE dominant flow direction: the sampling domain is compressed along
    // uFlowDir so every structure field elongates the same way — the cloud
    // system reads as sheared drift, not isotropic cauliflower puffs
    vec3 dFlow = d - uFlowDir * dot(d, uFlowDir) * 0.60;
    vec3 q = dFlow * 2.2 + uOff;

    // ONE domain warp field shared by every colour family + the dust
    vec3 w1 = vec3(
      fbm4(q + vec3(3.1, 7.7, 1.3)),
      fbm4(q + vec3(8.2, 2.4, 5.9)),
      fbm4(q + vec3(1.7, 9.1, 4.2)));

    // galactic band (noise-torn edges)
    float band = 1.0 - abs(dot(d, uBandDir));
    float bandN = band + 0.20 * w1.x;
    float bandCore = smoothstep(0.68, 1.00, bandN);
    float bandWide = smoothstep(0.50, 0.95, bandN);

    float neb = fbm6(dFlow * 3.1 + uOff * 1.7 + w1 * 1.6);
    // detail frequency VARIES BY REGION: a low-frequency selector blends
    // between coarse billow detail and fine crunch, so no two stretches of
    // sky carry the same texture scale (kills the uniform-frequency read)
    float regf = 0.5 + 0.5 * fbm4(d * 0.85 + uOff * 1.9);
    float detLo = fbm6(dFlow * 4.4 + uOff * 0.9 - w1 * 2.3);
    float detHi = fbm6(dFlow * 10.5 + uOff * 1.4 + w1 * 1.1);
    float det = mix(detLo, detHi, smoothstep(0.30, 0.78, regf));
    // hue selector: low-frequency lobes BUT perturbed by the same mid-scale
    // detail field the density uses, so colour families share structure scale
    float hsel = 0.5 + 0.5 * fbm4(d * 1.05 + uOff * 2.3) + 0.16 * det;

    // wide, bridged hue transitions — A dominates, B/C take over gradually in
    // opposite lobes; no hard family seams
    vec3 nebCol = mix(uColA, uColB, smoothstep(0.50, 0.90, hsel));
    nebCol = mix(nebCol, uColC, 1.0 - smoothstep(0.12, 0.50, hsel));

    // dark dust lanes occlude both nebula light and stars — deep lanes run
    // near-black so the cloud reads as layered volume, not a flat wash.
    // uSoft eases the lanes: a painterly wash keeps its contrast restrained
    float dust = 0.5 + 0.5 * fbm6(d * 4.3 - w1 * 1.2 + uOff * 3.1);
    float lane = smoothstep(0.42, 0.80, dust) * uDustAmt * (1.0 - 0.35 * uSoft);
    float trans = exp(-lane * 5.2);

    // macro variety: a very low-frequency field gates whole regions — the
    // floor is near-ZERO so real stretches of sky run empty (black + stars
    // only) while dense regions pile up past unity. uSoft compresses the
    // swing toward a flat single wash (NMS space is painterly, not HDR photo)
    float macro = 0.5 + 0.5 * fbm4(d * 0.55 + uOff * 0.63 + w1 * 0.5);
    float macroGate = 0.05 + 1.95 * pow(smoothstep(0.26, 0.88, macro), 1.6);
    macroGate = mix(macroGate, 0.9, uSoft * 0.5);

    float density = bandCore * clamp(0.25 + 0.75 * neb + 0.50 * det, 0.0, 1.3) * macroGate;

    // near-black deep base — space stays darker than everything in front
    vec3 col = uDeep * (0.45 + 0.55 * clamp(neb, 0.0, 1.0));
    col += nebCol * 0.035 * bandWide * clamp(0.5 + det, 0.2, 1.2)
         * (0.30 + 0.70 * trans) * macroGate;
    col += nebCol * density * trans * 0.55;

    // bright emissive cores (hot values for the bloom threshold), clustered
    // into the dense macro regions — hot HEARTS, not a wash. pow 22 + a hard
    // macro gate: at pow 12 this term painted a warm wall over the whole
    // band-core zone (latent since r3 — the kaleidoscope cube bug meant no
    // face ever showed the real band core until r7 fixed the bake cameras)
    float core = pow(clamp(det * 0.5 + 0.5, 0.0, 1.0), 22.0) * bandCore * trans;
    col += (nebCol * 2.4 + vec3(0.9, 0.78, 0.6)) * core * uCoreAmt
         * (0.10 + 0.90 * smoothstep(0.62, 0.95, macro));

    // secondary streak crossing the field — SAME structure fields (neb + det)
    // tear its edges, its hue bridges toward the local nebula colour, and its
    // strength follows the wide band so it belongs to the same cloud system
    vec3 sdir = normalize(cross(uBandDir, vec3(0.31, 0.9, 0.28)));
    float streak = 1.0 - abs(dot(d, sdir));
    float sm = smoothstep(0.930, 0.996, streak + 0.055 * neb + 0.030 * det);
    vec3 streakCol = mix(uColB, nebCol, 0.45);
    col += streakCol * sm * (0.35 + 0.65 * clamp(det * 0.5 + 0.5, 0.0, 1.0))
         * trans * (0.35 + 0.65 * bandWide) * 0.95 * uStreakAmt;

    // sheared wisps: ridged noise sampled in a HARD flow-compressed domain —
    // long torn filaments raking one way across the field, strongest where
    // the cloud is already dense so they read as combed-out edges
    vec3 dWisp = d - uFlowDir * dot(d, uFlowDir) * 0.90;
    float wisp = 1.0 - abs(snoise(dWisp * 5.2 + uOff * 1.3 + w1 * 0.7));
    wisp = pow(wisp, 7.0) * bandWide * (0.25 + 0.75 * macro);
    col += mix(nebCol, uColA, 0.35) * wisp * trans * 0.34;

    // embedded starfields: density follows the band, dust dims them, and the
    // macro field CLUSTERS them — rich knots in dense regions, sparse gaps.
    // uStarBias raises the per-cell threshold (fewer baked stars — r5 m5:
    // "uniform dense white speckle"), uStarAmt eases their punch so the
    // moving parallax layers own the brightest pinpoints (depth read)
    // fine layer THINNED (thresh up, punch down): at bake res these stars
    // are subpixel, and a dense band of them linear-samples + blooms into a
    // solid amber wall (the r7 "orange wall" — latent until the cube fix
    // made the band core actually render)
    // r9 (unowned m5 defect 7, "random large bokeh orbs"): isolated by
    // capturing m5 with the vfx damage-mote spawn disabled — the orbs were
    // still there, so they are baked-sky stars, not particles. It is the
    // coarse layer below: at maxB 3.20 its brightest cells sail past the
    // bloom knee and the bloom pass spreads them into ~20px soft discs. Same
    // root cause as the parallax-star fix above and the mote fix in vfx.js —
    // in all three cases the orb was a BLOOM artefact of an over-bright
    // point, not a geometry or size problem. Dimmed and thinned so the
    // coarse layer still supplies the bright anchors without blooming into
    // discs; the parallax hero tier owns the genuinely bright pinpoints.
    vec3 st = starLayer(d, 300.0, 0.815 + uStarBias, 0.70, 0.15)
            + starLayer(d, 165.0, 0.820 + uStarBias, 1.50, 0.13)
            + starLayer(d,  82.0, 0.952 + uStarBias * 0.6, 1.70, 0.115);
    float sDens = mix(0.45, 1.40, bandWide) * (0.55 + 0.95 * macro) * uStarAmt;
    // dust lanes and dense nebula genuinely swallow the baked stars
    col += st * sDens * (0.08 + 0.92 * trans) * (1.0 - 0.78 * clamp(density, 0.0, 1.0));

    // the system sun WARMS the sky around its direction — the sprite glow
    // must exist IN the nebula, not float over it (r7 critic: "screen-blend
    // decal"). Broad low lobe + tighter hot lobe, both eaten by dust lanes.
    // kept SUBTLE: ACES + bloom lift any add far off the deep-space floor —
    // the first pass at 0.16/pow6 painted an amber wall over half the sky
    float sunDot = max(dot(d, uSunDirBake), 0.0);
    col += uSunWarm * (0.045 * pow(sunDot, 10.0) + 0.30 * pow(sunDot, 40.0))
         * (0.35 + 0.65 * trans);

    gl_FragColor = vec4(col, 1.0);
  }
`.replace('PLACEHOLDER_NOISE', GLSL_NOISE);

// ---------------------------------------------------------------------------
// nebula SHELL bake shader — RGBA clouds for the mid-distance parallax shells
// (r6: "nebula reads single-depth billboard"). Same band/flow/palette inputs
// as the sky bake so the shells read as NEARER PIECES of the same cloud
// system, not a second nebula pasted on top. Alpha is macro-gated: most of
// each shell is EMPTY — the layered read comes from a few dense clumps that
// visibly dim the stars and sky behind them.
// ---------------------------------------------------------------------------
const SHELL_BAKE_FRAG = /* glsl */`
  precision highp float;
  varying vec3 vDir;
  uniform vec3 uCa, uCb, uBandDir, uFlowDir, uOff;
  uniform float uFreq, uAlphaMax, uWispMix, uBright, uGateLo, uGateHi, uShear;
  ${'PLACEHOLDER_NOISE'}
  void main() {
    vec3 d = normalize(vDir);
    vec3 dF = d - uFlowDir * dot(d, uFlowDir) * uShear;
    vec3 q = dF * uFreq + uOff;
    vec3 w = vec3(
      fbm4(q + vec3(2.1, 5.3, 1.7)),
      fbm4(q + vec3(7.2, 1.4, 3.9)),
      fbm4(q + vec3(4.5, 8.1, 6.2)));
    float base = fbm6(dF * uFreq * 1.35 + w * 1.4 + uOff * 1.3);
    float band = 1.0 - abs(dot(d, uBandDir));
    float bandW = smoothstep(0.28, 0.90, band + 0.22 * w.x);
    // macro gate: real stretches of every shell stay empty sky
    float macro = 0.5 + 0.5 * fbm4(d * 0.62 + uOff * 0.71);
    float gate = smoothstep(uGateLo, uGateHi, macro);
    float dens = clamp(base * 1.0 + 0.45, 0.0, 1.0) * bandW * gate;
    // torn ridged wisps (near shell): combed filaments, not cotton wool
    float wisp = pow(1.0 - abs(snoise(dF * uFreq * 2.6 + w * 0.8 + uOff * 2.9)), 6.0);
    dens *= mix(1.0, wisp * 1.7, uWispMix);
    float a = clamp(dens, 0.0, 1.0);
    a = a * a * (3.0 - 2.0 * a) * uAlphaMax;
    // hue drifts WITHIN the family; edges brighter than cores (lit-from-
    // outside cloud read — dense hearts occlude, torn edges catch light)
    float hsel = 0.5 + 0.5 * fbm4(d * 0.9 + uOff * 1.7);
    vec3 col = mix(uCa, uCb, smoothstep(0.40, 0.95, hsel)); // accent = fringes only
    col *= (0.55 + 0.75 * clamp(base * 0.5 + 0.5, 0.0, 1.2)) * uBright;
    col *= mix(1.0, 0.30, smoothstep(0.55, 0.95, dens));
    gl_FragColor = vec4(col, a);
  }
`.replace('PLACEHOLDER_NOISE', GLSL_NOISE);

// shell display: sample the baked RGBA cubemap at the shell's real radius —
// normal blending genuinely DIMS whatever is behind (baked sky + farther
// star layers), which is what sells the depth stack
const SHELL_VERT = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const SHELL_FRAG = /* glsl */`
  precision mediump float;
  varying vec3 vDir;
  uniform samplerCube uTex;
  void main() {
    vec4 s = textureCube(uTex, normalize(vDir));
    if (s.a < 0.004) discard;
    gl_FragColor = s;
  }
`;

// cheap display shader: sample the baked cubemap on the far-plane sphere
const SKY_VERT = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // r12-perf: pin to the far plane EXACTLY (z = w -> ndc z = 1.0), not to
    // 0.99999*w. depthFunc is three's default LessEqualDepth, so this is the
    // standard skybox depth: it passes wherever the depth buffer is still at
    // its cleared 1.0 and fails wherever ANY geometry wrote depth, at any
    // distance.
    //
    // 0.99999 was NOT equivalent, and it is what broke the first attempt at
    // drawing the sky last. The camera is near 0.08 / far 300000, so a body at
    // 65 km writes depth 0.99999807 (r12 critic recomputed this; my first
    // comment said ~0.9999975, wrong in the 7th decimal — the inequality it
    // rests on is unaffected) — numerically LARGER than 0.99999. Drawn
    // first the sky never noticed, because it writes no depth and the planets
    // simply overdrew it. Drawn last, the sky WON the depth test against the
    // planets and painted over them: m2 changed on 134,309 px and m5 on
    // 381,495 px, channel deltas up to 195. Evidence:
    // reports/r12-perf/moment-diff-01-order-only-BROKEN.txt.
    // z = w removes the far-plane dependence entirely instead of retuning a
    // constant that only happens to work at some distances.
    gl_Position.z = gl_Position.w;
  }
`;
const SKY_FRAG = /* glsl */`
  precision highp float;
  varying vec3 vDir;
  uniform samplerCube uSky;
  void main() { gl_FragColor = vec4(textureCube(uSky, normalize(vDir)).rgb, 1.0); }
`;

// ---------------------------------------------------------------------------
// planet shader — smooth limb (per-fragment shading on a displaced unit
// sphere), relief normals from noise gradient, hard day/night terminator with
// a truly dark night side, saturated biome albedo, sun-biased lit-limb
// scattering, restrained clouds, optional ice caps, distance veil for the
// far body (depth hierarchy).
// ---------------------------------------------------------------------------
const PLANET_VERT = /* glsl */`
  varying vec3 vDir; varying vec3 vWP;
  uniform float uRadius, uAmp, uNFreq;
  uniform vec3 uOff2;
  ${'PLACEHOLDER_NOISE'}
  void main() {
    vec3 dir = normalize(position);
    float h = fbm4(dir * uNFreq + uOff2);
    vec3 p = dir * uRadius * (1.0 + uAmp * h);
    vDir = dir;
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vWP = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`.replace('PLACEHOLDER_NOISE', GLSL_NOISE);

const PLANET_FRAG = /* glsl */`
  precision highp float;
  varying vec3 vDir; varying vec3 vWP;
  uniform vec3 uSunDir, uColLo, uColMid, uColHi, uColAtmo, uColNight, uOff2, uVeilCol, uColSea;
  uniform float uNFreq, uCloudAmt, uIceAmt, uBandTint, uVeil, uCrater, uEarthshine, uSeaLvl;
  ${'PLACEHOLDER_NOISE'}

  void main() {
    vec3 dir = normalize(vDir);
    vec3 V = normalize(cameraPosition - vWP);

    // ONE domain warp shared by every surface field (r6: "tiling texture" —
    // uniform-frequency fbm reads as repetition; the warp drags coastlines,
    // ridges and detail along the same flow so nothing repeats evenly)
    vec3 wq = vec3(
      fbm4(dir * 1.7 + uOff2 * 1.31),
      fbm4(dir * 1.7 + uOff2 * 1.31 + vec3(4.7, 9.2, 1.8)),
      fbm4(dir * 1.7 + uOff2 * 1.31 + vec3(8.1, 2.6, 6.4)));

    // continent field: LOW frequency — a few large ragged landmasses, not
    // salt-and-pepper. Detail relief rides on top, warped the SAME way.
    float cont = fbm4(dir * uNFreq * 0.62 + wq * 0.85 + uOff2 * 0.7);
    float hd = fbm6(dir * uNFreq * 2.3 + wq * 1.15 + uOff2);
    float h = cont * 0.72 + hd * 0.50;

    // relief normal from the detail gradient
    float e = 0.014;
    vec3 t1 = normalize(cross(dir, vec3(0.0, 1.0, 0.001)));
    vec3 t2 = normalize(cross(dir, t1));
    float h1 = fbm6(normalize(dir + t1 * e) * uNFreq * 2.3 + wq * 1.15 + uOff2);
    float h2 = fbm6(normalize(dir + t2 * e) * uNFreq * 2.3 + wq * 1.15 + uOff2);
    vec3 N = normalize(dir - (t1 * (h1 - hd) + t2 * (h2 - hd)) * 2.6);

    float m = 0.5 + 0.5 * fbm4(dir * 2.6 + uOff2 * 1.9);

    // VALUE STRUCTURE — three distinct plateaus (r6: "cue-ball"): dark
    // lowland basins/seas, mid plains, bright ridged highlands
    float seaM = 1.0 - smoothstep(uSeaLvl - 0.05, uSeaLvl + 0.07, cont + hd * 0.18);
    float hh = clamp(0.5 + 0.62 * h, 0.0, 1.0);
    vec3 alb = mix(uColLo, uColMid, smoothstep(0.30, 0.58, hh));
    // ridged mountain chains: bright, following the warp flow
    float ridge = pow(1.0 - abs(snoise(dir * uNFreq * 3.1 + wq * 1.6 + uOff2 * 2.2)), 5.0)
                * smoothstep(0.45, 0.78, hh);
    alb = mix(alb, uColHi, clamp(smoothstep(0.62, 0.92, hh) + ridge * 0.80, 0.0, 1.0));
    // moisture pulls hue subtly cooler (kept gentle — no grey washing)
    alb = mix(alb, alb * vec3(0.90, 0.97, 1.05), (m - 0.5) * 0.25 + 0.12);
    // basins read as seas/dark flats: distinctly darker, cooler, in-family
    // (gated off the airless moon)
    alb = mix(alb, uColSea * (0.70 + 0.30 * hh), seaM * (1.0 - uCrater));
    // latitude banding: noise-broken so it never reads as clean stripes
    alb = mix(alb, alb * vec3(1.08, 0.97, 0.90),
              uBandTint * (0.5 + 0.5 * sin(dir.y * 7.0 + m * 2.0)) * (0.35 + 0.65 * m));
    // ice caps — restrained, slightly blue, never chalk
    float ice = smoothstep(0.78, 0.92, abs(dir.y) + (m - 0.5) * 0.16) * uIceAmt;
    alb = mix(alb, vec3(0.70, 0.78, 0.88), ice);
    // moon grammar (uCrater=1): maria blotches + crater rims/pits replace the
    // continental biome read — the companion must NOT be a retinted hero.
    // Craters at TWO scales, gated OUT of the maria: smooth dark seas beside
    // cratered highlands, so the surface is not one uniform bump frequency
    float mar = smoothstep(0.28, 0.72, 0.5 + 0.5 * fbm4(dir * 1.3 + uOff2 * 4.7));
    float crn1 = abs(snoise(dir * uNFreq * 4.5 + uOff2 * 1.7));
    float crn2 = abs(snoise(dir * uNFreq * 9.5 + uOff2 * 6.3));
    float crRim = (pow(1.0 - crn1, 10.0) + 0.55 * pow(1.0 - crn2, 14.0)) * (1.0 - 0.78 * mar);
    float pit = smoothstep(0.45, 0.85, 0.5 + 0.5 * snoise(dir * uNFreq * 3.5 + uOff2 * 9.1));
    vec3 albMoon = alb * mix(vec3(1.0), vec3(0.60, 0.58, 0.57), mar);
    albMoon *= mix(1.0, 0.74, pit * (1.0 - 0.6 * mar));
    albMoon += alb * crRim * 0.60;
    alb = mix(alb, albMoon, uCrater);
    // thin bright cloud systems — streaky, warped, high-value so they give
    // the disc a second read plane; biome still shows through
    float cl = smoothstep(0.55, 0.86,
      0.5 + 0.5 * fbm4(dir * vec3(1.3, 2.6, 1.3) + wq * 0.55 + uOff2 * 3.7)) * uCloudAmt;
    alb = mix(alb, vec3(0.96, 0.94, 0.90), cl * 0.60);
    // R10 (m2: "planet carries uniform high-frequency speckle across the whole
    // disc: no biome banding, NO CLOUD LAYER, no scale variation from limb to
    // centre"). Two additions, both aimed at that sentence rather than at the
    // clouds in isolation:
    //  1. A SECOND cloud population at a coarser scale and a lower threshold —
    //     broad banded sheets under the existing streaky wisps. One frequency
    //     of anything is what reads as speckle; two, an octave apart and
    //     differently shaped, read as weather.
    //  2. SCALE VARIATION FROM LIMB TO CENTRE. This is the part that has
    //     nothing to do with clouds: at the limb a sightline crosses the
    //     surface at a graze, so surface detail compresses toward the
    //     silhouette and the fine octaves stop being resolvable. Fading the
    //     high-frequency contrast as nv falls is what stops the disc looking
    //     like one flat noise texture pasted over a circle.
    float cl2 = smoothstep(0.42, 0.80,
      0.5 + 0.5 * fbm4(dir * vec3(0.62, 1.55, 0.62) + wq * 0.30 + uOff2 * 2.1)) * uCloudAmt;
    alb = mix(alb, vec3(0.93, 0.92, 0.91), cl2 * 0.34);
    cl = clamp(cl + cl2 * 0.55, 0.0, 1.0);
    vec3 Ns = normalize(mix(N, dir, cl));

    // lighting: lit day side, dark-but-textured night side, warm terminator
    // kiss. The terminator EDGE is wide (atmosphere diffusion) but the
    // gradient is a TRUE cosine — no wrap lift — so the anti-sun limb darkens
    // long before the terminator and the light direction reads at any phase
    // (r4: wrap-lit disc read "lit frontally" against the visible sun glow).
    // BOTH gauntlet poses view the planets heavily backlit (phaseDot 0.84 /
    // 0.92 measured): the whole lighting read lives in a thin crescent, so
    // the wrap is deliberately WIDE (stylised atmosphere diffusion) and the
    // grazing response steep — the crescent must pop at 1080p or the sun
    // agreement is unreadable (r2/r4/r6 recurring defect).
    float ndl = dot(Ns, uSunDir);
    float day = smoothstep(-0.32, 0.22, ndl);
    float wrap = pow(clamp(ndl + 0.06, 0.0, 1.0), 0.55);
    vec3 col = alb * vec3(1.12, 1.00, 0.86) * ((1.85 + 0.35 * uCrater) * wrap * day) + alb * 0.06 * day;
    // earthshine-style fill: the night side keeps its surface texture at a
    // whisper — never void-black
    col += alb * uEarthshine * (1.0 - day);
    col += uColNight * (1.0 - day) * 0.08 * (0.4 + 0.6 * hh);

    // LIMB DARKENING on the body shading only (r6: "uniform rim") — applied
    // BEFORE the terminator/rim adds so it can never crush the lit crescent
    float nv = clamp(dot(dir, V), 0.0, 1.0);
    col *= 0.62 + 0.38 * smoothstep(0.0, 0.42, nv);
    // R10 foreshortening (m2 "no scale variation from limb to centre"): the
    // fine relief loses contrast toward the silhouette because at a graze the
    // surface compresses into far fewer pixels per metre. Pulls the high-
    // frequency detail toward its own local mean over the outer ~25% of the
    // disc radius; the low-frequency continent/biome structure is untouched,
    // so the disc keeps its large shapes right out to the edge.
    col = mix(col * (0.88 + 0.12 * hh), col, smoothstep(0.02, 0.34, nv));

    float term = smoothstep(-0.26, 0.04, ndl) * (1.0 - smoothstep(0.04, 0.36, ndl));
    col += (uColAtmo * 0.22 + vec3(0.35, 0.14, 0.05) * 0.55) * term * (1.0 - 0.55 * uCrater);

    // ============ R10 PACKAGE 3: SCATTERING, NOT A FRESNEL ARC ============
    // Two critics, one object, the same read from opposite ends.
    //   m5: "planet rim is a CONSTANT-WIDTH WHITE ARC across the entire lit
    //        edge — a fresnel rim shader, not atmospheric scattering: no
    //        thickening toward the terminator, no cloud layering, and a plain
    //        linear terminator gradient."
    //   m2: "atmosphere is a 1px outline with NO RIM SCATTER INTO THE DISC."
    //
    // Both are describing the same missing physical driver. What the r9 code
    // had was pow(fres, 1.15) * sunF * sunF — one fixed profile width,
    // brightest where the SUN IS HIGHEST. That is exactly backwards. A limb
    // sightline's brightness is set by AIR MASS: how much atmosphere the ray
    // crossed, which is the product of TWO grazing angles, the view angle
    // (fres) and the light angle. Near the sub-solar point the light comes
    // straight down and the path is short; near the TERMINATOR the light
    // enters at a graze and crosses the entire depth of the shell, which is
    // why on any real photograph of a lit limb the band is widest, brightest
    // and reddest approaching the terminator and thins to almost nothing over
    // the sub-solar point. Biasing to sunF^2 produced precisely the
    // "constant-width arc across the entire lit edge" the critic named.
    float fres = pow(1.0 - nv, 1.9);
    float sunF = smoothstep(-0.05, 0.90, dot(dir, uSunDir));
    // air mass: 1 at the terminator, 0 under a high sun
    float airMass = pow(clamp(1.0 - abs(ndl), 0.0, 1.0), 1.7);
    // the shell is only visible where the sightline sees lit air at all
    float litAir = smoothstep(-0.34, 0.06, ndl);
    // WIDTH is now a variable, not a constant: a low fresnel power is a wide
    // soft band, a high one is a hairline. Lerped by air mass, the band runs
    // ~3x wider at the terminator than over the sub-solar point.
    float band = pow(1.0 - nv, mix(3.30, 1.06, airMass));
    // REDDENING with path length — short wavelengths scatter out of a long
    // path first, so the terminator limb goes orange while the high-sun limb
    // stays in the planet's own atmosphere hue. This is also what supplies the
    // "plain linear terminator gradient" fix: the gradient now changes COLOUR
    // across its width, not just brightness.
    vec3 scatCol = mix(uColAtmo,
                       uColAtmo * vec3(1.95, 0.95, 0.40) + vec3(0.13, 0.045, 0.005),
                       pow(airMass, 1.4) * 0.88);
    // (a) SCATTER INTO THE DISC. m2's "1px outline" is the absence of this
    // term, not a weakness of the rim: real atmosphere is a volume seen in
    // front of the ground, so it hazes the surface for a good fraction of the
    // disc radius before it ever reaches the silhouette. A LOW fresnel power
    // (1.05) is deliberately not a rim shape — it is a broad wash that has
    // already lifted a third of the way in from the limb.
    col = mix(col, scatCol * (0.14 + 0.86 * sunF),
              pow(1.0 - nv, 1.05) * 0.30 * day * (1.0 - uCrater));
    // (b) THE LIT LIMB ITSELF, now width- and colour-varying and gaining
    // amplitude toward the terminator instead of losing it.
    col += scatCol * band * litAir * (1.30 + 2.90 * airMass)
         * (0.35 + 0.65 * sunF) * (1.0 - uCrater);
    // airless moon: NO atmo ring, but the sunlit surface AT the limb gets a
    // bright kiss — without it the backlit moon is a flat cutout (r7 critic:
    // "ghost, not a body"). R10: the m5 critic's "constant-width white arc"
    // was largely THIS term, on the cratered body. An airless limb has no
    // scattering to smooth it, so what it must NOT be is smooth: the kiss is
    // now modulated by the surface's own albedo and crater relief (alb and
    // crRim already vary along the limb) and by the grazing-light term, so it
    // breaks into an uneven, bright-where-a-rim-catches-the-sun edge rather
    // than a drawn stroke. Amplitude down 1.1 -> 0.72 to match.
    float moonGraze = pow(clamp(dot(dir, uSunDir) * 0.9 + 0.1, 0.0, 1.0), 2.0);
    col += alb * vec3(1.05, 0.98, 0.88)
         * pow(1.0 - nv, mix(2.30, 1.15, airMass))
         * moonGraze * (0.55 + 1.55 * crRim) * 0.72 * uCrater;
    // faint scatter on the NIGHT limb — R10 CUT HARD, 0.030 -> 0.007. A blind
    // critic polar-resampled our two planets and named this term as the second
    // of its three tells: "the rim continues at peak L 45-84 across azimuths
    // that receive NO LIGHT AT ALL (+125, +135, +155, -115) ... that is a
    // fresnel/outline shader with a noise mask, not illumination". The r3
    // black-ball guard this whisper was written for is now covered properly by
    // the earthshine fill and the air-mass scattering above, so the ring no
    // longer has a job. It also takes the reddening now: the un-reddened blue
    // uColAtmo was what survived at the cusps where the main band dies, which
    // is why the same critic measured our band going BLUE toward the
    // terminator (R-B -40 to -48) when the whole point of the air-mass model
    // is that it should redden there.
    col += scatCol * pow(fres, 2.8) * mix(0.007, 0.002, uCrater);

    // distance veil: far body sinks toward the sky (depth hierarchy)
    col = mix(col, uVeilCol, uVeil);

    gl_FragColor = vec4(col, 1.0);
  }
`.replace('PLACEHOLDER_NOISE', GLSL_NOISE);

// atmosphere shell: a TIGHT band hugging the planet limb (shell only ~3.5%
// above the surface). r5 killed: at 1.10R the shell's own silhouette showed as
// a hard geometric rim — 'sphere-in-a-sphere'. Now the profile fades to ZERO
// before the shell's geometric limb (uEdge soft cut on nv), so the glow has no
// visible outer boundary; it decays into space. The r3 opposite failure
// (no halo = unlit black ball) is guarded by the ambient floor: a faint glow
// runs the FULL limb, with the bright band biased hard to the sun.
const ATMO_VERT = /* glsl */`
  varying vec3 vWN; varying vec3 vWP;
  void main() {
    vWN = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWP = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const ATMO_FRAG = /* glsl */`
  precision highp float;
  varying vec3 vWN; varying vec3 vWP;
  uniform vec3 uColor, uWarm, uSunDir;
  uniform float uMul;
  void main() {
    vec3 N = normalize(vWN);
    vec3 V = normalize(cameraPosition - vWP);
    float nv = clamp(dot(N, V), 0.0, 1.0);
    // nv==0 exactly at the shell's geometric silhouette: fade EVERYTHING to
    // zero there so no hard outer rim can exist at any pose/scale
    float edge = smoothstep(0.0, 0.24, nv);
    // R10: the shell carries the same air-mass model as the surface shader
    // (see the PACKAGE 3 note in PLANET_FRAG). rim WIDTH varies — wide and
    // soft approaching the terminator where the sightline crosses the whole
    // depth of the shell, tight over the sub-solar point — instead of one
    // fixed pow(1-nv, 3.0) profile, which is what let the two of them
    // together read as a drawn outline of constant thickness.
    float ndlA = dot(N, uSunDir);
    float airA = pow(clamp(1.0 - abs(ndlA), 0.0, 1.0), 1.7);
    float rim = pow(1.0 - nv, mix(3.60, 1.75, airA));
    float rim2 = pow(1.0 - nv, mix(8.00, 4.60, airA));
    float sunF = clamp(ndlA * 0.75 + 0.25, 0.0, 1.0);
    sunF *= sunF;
    // and the long path reddens, so the shell's own colour walks toward the
    // warm pole at the terminator rather than staying one blue everywhere
    vec3 uColorA = mix(uColor, uColor * vec3(1.85, 0.92, 0.42) + vec3(0.05, 0.02, 0.0),
                       pow(airA, 1.4) * 0.80);
    // ambient floor keeps a FAINT halo all the way around the limb (NMS never
    // lets the ring vanish on the night side — r3's black-ball guard) but it
    // must stay a whisper: r6 first pass ran it hot and the even blue ring
    // read as a glass marble outline. The clearly visible arc belongs to the
    // SUN side only.
    // amplitude gains toward the terminator (1.0 -> 1.85) instead of being
    // flat along the lit edge — the thickening the m5 critic said was missing
    vec3 col = (uColorA * rim * (0.12 + 2.90 * sunF) * (1.0 + 0.85 * airA)
              + uWarm * rim2 * sunF * 2.3) * uMul * edge;
    gl_FragColor = vec4(col, clamp(rim * (0.10 + 1.30 * sunF) * (1.0 + 0.55 * airA) * uMul, 0.0, 1.0) * edge);
  }
`;

// ---------------------------------------------------------------------------
// starfield point shader: per-star size + colour, soft round core with no
// texture (kills sprite-edge artifacts), additive
// ---------------------------------------------------------------------------
const STARPT_VERT = /* glsl */`
  attribute float aSize;
  attribute float aSpike;
  attribute float aGlowW;
  attribute float aRot;
  varying vec3 vCol;
  varying float vSpike;
  varying float vGlowW;
  varying float vRot;
  uniform float uScale;
  void main() {
    vCol = color;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float psRaw = aSize * (uScale / -mv.z);
    // r9 (unowned space defects routed to vfx — m5 "random large bokeh orbs",
    // m2 "no magnitude variance or bloomed brights"). These are one bug seen
    // from two angles: the layer specs encode magnitude as sprite DIAMETER, so
    // the hero tier prints 15-37px soft discs. A 30px disc does not read as a
    // bright star, it reads as a lens artefact pasted into space — which is
    // precisely how the blind critic described it. It also FLATTENS magnitude,
    // because spreading the same energy over a wide disc lowers peak value
    // instead of raising it, so nothing ever crosses the bloom knee. Magnitude
    // belongs in intensity: clamp diameter so nothing can print as an orb, and
    // pay the clipped size back as brightness, so the brightest stars stay
    // tight and are the only ones that bloom.
    float ps = min(psRaw, 11.5);
    float mag = clamp(psRaw / max(ps, 0.001), 1.0, 7.0);
    vCol *= min(2.7, pow(mag, 0.62));
    gl_PointSize = ps;
    // r5: pixel-size-gated crosses fired on a whole tier of similar-size
    // stars -> sprite-atlas tell. Crosses are now an EXPLICIT per-star flag
    // (2-3 flared stars per sky, set on the CPU), softened by screen size
    vSpike = aSpike * smoothstep(6.0, 10.0, ps);
    // bright stars tighten their halo: gated on the UNCLAMPED size now, since
    // ps can no longer exceed the old 14-30px trigger window. A bright star is
    // a hard pinpoint with a small tight glow, not a soft wide one.
    vGlowW = aGlowW * mix(1.0, 0.45, smoothstep(1.3, 4.0, mag));
    vRot = aRot;
    gl_Position = projectionMatrix * mv;
  }
`;
const STARPT_FRAG = /* glsl */`
  precision mediump float;
  varying vec3 vCol;
  varying float vSpike;
  varying float vGlowW;
  varying float vRot;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d2 = dot(c, c);
    float core = exp(-d2 * 26.0);
    // per-star halo WIDTH + WEIGHT vary (r6: "star sprites uniform with
    // identical flares") — tight hard pinpoints beside soft haloed ones
    // envelope forces the halo to ZERO inside the sprite bounds — a wide
    // gaussian otherwise prints the point sprite's square edge
    float glow = exp(-d2 * 7.0 / vGlowW) * (0.16 + 0.13 * vGlowW)
               * smoothstep(0.25, 0.12, d2);
    // 4-point diffraction spike, per-star ROTATION + arm tightness: the two
    // or three flared stars in a sky must not print the same cross
    float cs = cos(vRot), sn = sin(vRot);
    vec2 cr = vec2(c.x * cs - c.y * sn, c.x * sn + c.y * cs);
    float arm = 16.0 + 12.0 * vGlowW;
    float spike = (exp(-abs(cr.x) * arm) + exp(-abs(cr.y) * arm)) * exp(-d2 * 5.0);
    float a = core + glow + spike * vSpike * 0.62;
    if (a < 0.012) discard;
    gl_FragColor = vec4(vCol * a, 1.0);
  }
`;

// ---------------------------------------------------------------------------
function radialTexture(stops, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const half = size / 2;
  const grad = g.createRadialGradient(half, half, 0, half, half, half);
  for (const [t, col] of stops) grad.addColorStop(t, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
// layered sun flare textures — smooth long tails, zero geometry artifacts
const SUN_CORE_STOPS = [
  [0, 'rgba(255,255,255,1)'],
  [0.20, 'rgba(255,248,232,0.95)'],
  [0.45, 'rgba(255,228,180,0.34)'],
  [0.72, 'rgba(255,208,150,0.07)'],
  [1, 'rgba(0,0,0,0)'],
];
const SUN_HALO_STOPS = [
  [0, 'rgba(255,238,205,0.50)'],
  [0.35, 'rgba(255,205,135,0.17)'],
  [0.70, 'rgba(255,180,110,0.045)'],
  [1, 'rgba(0,0,0,0)'],
];

// palette per system — system 0 tuned to ref-2 (near-black maroon deep, olive
// band, purple/green streaks); system 1 is a PAINTERLY SINGLE-HUE deep-indigo
// wash (r5: teal/amber mix rendered as oversaturated Hubble wallpaper — NMS
// space is one flat hue family per system; m2's sys-0 discipline carried
// over). Optional knobs: soft (contrast compression), starBias/starAmt
// (baked-star density/punch — r5 m5: one-depth-plane white speckle).
const SYSTEM_PALETTES = [
  { deep: 0x1c060b, colA: 0x6b7a26, colB: 0x8a3fb0, colC: 0x2f8a4f, dust: 1.0, core: 4.2,
    planet: 0xb0703a, atmo: 0x86c8ff, warm: 0xff9a50, sun: 0xfff0dc, streak: 1.0 },
  { deep: 0x070a18, colA: 0x36426e, colB: 0x3d4a7a, colC: 0x453a6b, dust: 0.85, core: 1.7,
    planet: 0x9a5230, atmo: 0x5f9fe0, warm: 0xffb060, sun: 0xf2f4ff, streak: 0.35,
    soft: 1.0, starBias: 0.08, starAmt: 0.65 },
  { deep: 0x140414, colA: 0xa03070, colB: 0xd08030, colC: 0x4030a0, dust: 0.9, core: 4.8,
    planet: 0xa04a3a, atmo: 0xff9a70, warm: 0xffc060, sun: 0xffe8c8, streak: 0.8 },
  { deep: 0x04100b, colA: 0x2a7a50, colB: 0xc0a030, colC: 0x7040b0, dust: 1.0, core: 3.8,
    planet: 0x7a6ab0, atmo: 0xb0a8ff, warm: 0xffd080, sun: 0xfff4e0, streak: 0.7 },
];
// base sun direction per system (small deterministic jitter added on top).
// sys 0 is solved AT THE m2 POSE: the m2 camera looks along ~(-0.22,-0.16,
// +0.96) at the hero planet (upper-left of frame); this vector puts the sun
// sprite INSIDE the frame upper-RIGHT (~40 deg right, ~17 deg up of the
// planet sightline) so the disc gradient — bright limb upper-right, dark
// limb lower-left — points straight at the visible glow, on hero AND moon.
// sys 1: hard lateral left of the m5 sightline -> strong terminator + dark
// night side (ref-5).
const SUN_BASE_DIRS = [
  [-0.674, 0.036, 0.738], // solved for the m2 pose: open sky window between the top-right HUD and the right strut (~x1370,y300 at 1920x1080) — full sun disc visible, crescents aim at it
  // sys 1 solved AT THE m5 POSE (camera at identity looking -Z, planet centre
  // ~6 deg right / 9 deg up): sun ~29 deg right, ~20 deg up (-> ~x1390,y260)
  // sits in OPEN sky upper-right of the planet, INSIDE the frame. Planet +
  // moon render as crescents whose lit limbs aim at the visible glow, and the
  // shell's bright band hugs the same side — terminator agreement is checkable
  // in-frame (r5: sun was 69 deg off-axis left, no light source read at all).
  // y raised r7: the old dir put the sun in EXACT syzygy behind the m5 moon
  // (phaseDot 1.00) — the moon fully eclipsed the sun core, leaving a
  // silhouette with no visible light source. Now the core peeks past the
  // moon's limb (partial-eclipse read) and the moon gets a top crescent.
  [0.42, 0.36, -0.84],
  [0.70, 0.35, -0.50],
  [-0.45, 0.40, 0.60],
];

export function initSpace(G) {
  const group = new THREE.Group();
  G.scene.add(group);

  // ---- baked sky cubemaps + display sphere. TWO render targets: both
  // gauntlet systems are prebaked at boot, so a mid-warp setSystem is a
  // texture swap, not a bake (r3 perf suspect: a 1024 HalfFloat face with
  // 6-octave warped fbm can exceed 40ms GPU — that work now happens at boot).
  const SKY_RES = 1024;
  const PREBAKED_SYSTEMS = 2; // the gauntlet's system list, deterministic from the seed
  function makeSkyRT() {
    return new THREE.WebGLCubeRenderTarget(SKY_RES, {
      type: THREE.HalfFloatType, generateMipmaps: false,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    });
  }
  const skyRTs = [makeSkyRT(), makeSkyRT()];
  const skyRTOwner = [-1, -1]; // which system's sky each RT currently holds
  const cubeCam = new THREE.CubeCamera(0.1, 50, skyRTs[0]);
  // CRITICAL (root cause of the r6 "single-depth billboard" nebula): in
  // three r185 CubeCamera's constructor does NOT orient its six cameras —
  // orientation happens lazily in updateCoordinateSystem(), which only runs
  // inside CubeCamera.update(). The manual per-face bake path renders
  // cubeCam.children[i] directly and never calls update(), so every face
  // camera still looked down -Z: the whole sky cubemap was ONE view copied
  // six times (kaleidoscope wallpaper + razor-straight face-boundary seams).
  // Orient the face cameras explicitly, then bake their matrixWorlds (the
  // renderer skips auto-update for cameras that have a parent).
  cubeCam.coordinateSystem = G.renderer.coordinateSystem;
  cubeCam.updateCoordinateSystem();
  cubeCam.updateMatrixWorld(true);
  const bakeScene = new THREE.Scene();
  const bakeMat = new THREE.ShaderMaterial({
    vertexShader: BAKE_VERT, fragmentShader: BAKE_FRAG,
    uniforms: {
      uDeep: { value: new THREE.Color() },
      uColA: { value: new THREE.Color() },
      uColB: { value: new THREE.Color() },
      uColC: { value: new THREE.Color() },
      uBandDir: { value: new THREE.Vector3(0.2, 0.75, 0.3).normalize() },
      uFlowDir: { value: new THREE.Vector3(1, 0, 0) },
      uOff: { value: new THREE.Vector3() },
      uDustAmt: { value: 1.0 },
      uCoreAmt: { value: 2.5 },
      uStreakAmt: { value: 1.0 },
      uStarBias: { value: 0.0 },
      uStarAmt: { value: 1.0 },
      uSoft: { value: 0.0 },
      uSunDirBake: { value: new THREE.Vector3(1, 0, 0) },
      uSunWarm: { value: new THREE.Color(0xffc080) },
    },
    side: THREE.BackSide, depthWrite: false, depthTest: false,
  });
  bakeScene.add(new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), bakeMat));

  // full face when h omitted; a scissored strip (runtime fallback path) when
  // y0/h passed — each strip stays well under 8ms of GPU
  function bakeFace(rt, i, y0 = 0, h = SKY_RES) {
    const prevRT = G.renderer.getRenderTarget();
    if (h < SKY_RES) {
      rt.scissor.set(0, y0, SKY_RES, h);
      rt.scissorTest = true;
    }
    G.renderer.setRenderTarget(rt, i);
    G.renderer.render(bakeScene, cubeCam.children[i]);
    rt.scissorTest = false;
    G.renderer.setRenderTarget(prevRT);
  }

  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
    uniforms: { uSky: { value: skyRTs[0].texture } },
    side: THREE.BackSide, depthWrite: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(120000, 32, 16), skyMat);
  sky.frustumCulled = false;
  // r12-perf: draw the backdrop LAST among opaques instead of FIRST.
  //
  // three r0.185.1 sorts the opaque list groupOrder -> renderOrder ->
  // material.id -> materialVariant -> z. z is the FIFTH key, so with every
  // opaque at renderOrder 0 the order is MATERIAL CREATION ORDER, and skyMat is
  // the lowest-numbered material in this scene. Measured, not assumed:
  // reports/r12-perf/draworder-m2-BEFORE.json puts this mesh at index 0 of 16
  // opaque main-camera draws, ahead of both planet bodies and the whole cockpit
  // rig. CITE THAT FILE, NOT draworder-m2.json — the r12 critic caught this
  // comment naming the post-change dump, which correctly records 15/16 at
  // renderOrder 100 and so appears to contradict the sentence it was cited for.
  // Drawn at index 0 it shades all 2,073,600 pixels — nothing has written depth
  // yet — and the planets and cockpit then overdraw most of them.
  //
  // It writes no depth and SKY_VERT pins gl_Position.z to the far plane, so
  // moving it behind every depth-writing opaque cannot change a pixel: it now
  // survives exactly where nothing else drew, which is exactly where it was
  // visible before. Measured: the r12 critic's re-derivation puts the reclaimed
  // fill at 995,254 px on m2 (48.00% of the screen) and 1,086,628 px on m5
  // (52.40%). My own skyfill-m2/m5.json say 942,707 / 964,698, and they are
  // LOW: the magenta probe is an om.clone(), which mints a fresh material id,
  // and three sorts on material.id before z, so the probe drew later than the
  // real sky does. The error runs against this change's own case; the larger
  // figures are the better ones.
  //
  // SAFETY. Sound only while the sky is the ONLY opaque in the frame with
  // depthWrite:false — any other such object drawn before it would be painted
  // over. vfx.js's warp tunnel and caps ARE in that category (renderOrder -3
  // and -4), but setWarpMode() below sets `sky.visible = !on`, so the tunnel
  // and this mesh are never in one frame. Verified at runtime over a whole
  // scripted session by tools/r12-perf-orderguard.mjs, not just read off source.
  sky.renderOrder = 100;
  group.add(sky);

  // ---- nebula parallax shells: two translucent cloud layers at REAL radii
  // interleaved with the star layers (sky 120k > dustA > far shell 75k > mid
  // stars > near shell 33k > near stars). Prebaked RGBA8 cubemaps per system
  // (512 — soft clouds don't need more), swapped exactly like the sky.
  const SHELL_RES = 512;
  const shellSpecs = [
    // WIDE frequency separation between the planes (critic r7: "one noise
    // frequency everywhere") — far = broad soft masses, near = fine crisp
    // high-contrast filaments
    // coverage/alpha sit BETWEEN the r7 first pass (invisible) and second
    // pass (golden wall over half the sky): clumps, not wallpaper
    { radius: 75000, freq: 1.55, alphaMax: 0.60, wispMix: 0.15, bright: 0.90,
      gateLo: 0.34, gateHi: 0.74, shear: 0.55, renderOrder: -7 },
    { radius: 33000, freq: 4.60, alphaMax: 0.72, wispMix: 0.75, bright: 1.55,
      gateLo: 0.44, gateHi: 0.82, shear: 0.75, renderOrder: -5 },
  ];
  function makeShellRT() {
    return new THREE.WebGLCubeRenderTarget(SHELL_RES, {
      generateMipmaps: false,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    });
  }
  // shellRTs[slot][layer] — slot indices track skyRTOwner exactly
  const shellRTs = [[makeShellRT(), makeShellRT()], [makeShellRT(), makeShellRT()]];
  const shellBakeMat = new THREE.ShaderMaterial({
    vertexShader: BAKE_VERT, fragmentShader: SHELL_BAKE_FRAG,
    uniforms: {
      uCa: { value: new THREE.Color() },
      uCb: { value: new THREE.Color() },
      uBandDir: { value: new THREE.Vector3(0, 1, 0) },
      uFlowDir: { value: new THREE.Vector3(1, 0, 0) },
      uOff: { value: new THREE.Vector3() },
      uFreq: { value: 2.0 },
      uAlphaMax: { value: 0.4 },
      uWispMix: { value: 0.0 },
      uBright: { value: 1.0 },
      uGateLo: { value: 0.45 },
      uGateHi: { value: 0.85 },
      uShear: { value: 0.6 },
    },
    side: THREE.BackSide, depthWrite: false, depthTest: false,
  });
  const shellBakeScene = new THREE.Scene();
  shellBakeScene.add(new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), shellBakeMat));
  function bakeShellFace(rt, i) {
    const prevRT = G.renderer.getRenderTarget();
    G.renderer.setRenderTarget(rt, i);
    G.renderer.render(shellBakeScene, cubeCam.children[i]);
    G.renderer.setRenderTarget(prevRT);
  }
  // deterministic per (system, layer): same seed => same nebula
  function setShellUniformsFor(sysIndex, layer) {
    const pal = SYSTEM_PALETTES[sysIndex % SYSTEM_PALETTES.length];
    const spec = shellSpecs[layer];
    const rng = G.rngFor('shell' + layer + '-' + sysIndex);
    const u = shellBakeMat.uniforms;
    // hue pairs stay inside the system family and BOTH shells lead with the
    // dominant family colour (critic r7: a near shell led by the accent hue
    // read as a second-palette decal pasted on the sky)
    u.uCa.value.set(pal.colA);
    u.uCb.value.set(layer === 0 ? pal.colC : pal.colB);
    u.uBandDir.value.copy(bakeMat.uniforms.uBandDir.value);
    u.uFlowDir.value.copy(bakeMat.uniforms.uFlowDir.value);
    u.uOff.value.set(rng() * 70 + 5, rng() * 70 + 9, rng() * 70 + 2);
    u.uFreq.value = spec.freq;
    // painterly systems (soft flag) keep their shells quieter too
    u.uAlphaMax.value = spec.alphaMax * (pal.soft ? 0.88 : 1.0);
    u.uWispMix.value = spec.wispMix;
    u.uBright.value = spec.bright * (pal.soft ? 0.8 : 1.0);
    u.uGateLo.value = spec.gateLo;
    u.uGateHi.value = spec.gateHi;
    u.uShear.value = spec.shear;
  }
  const shellMeshes = shellSpecs.map((spec, l) => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 48, 32),
      new THREE.ShaderMaterial({
        vertexShader: SHELL_VERT, fragmentShader: SHELL_FRAG,
        uniforms: { uTex: { value: shellRTs[0][l].texture } },
        side: THREE.BackSide, transparent: true, depthWrite: false,
      }));
    mesh.scale.setScalar(spec.radius);
    mesh.frustumCulled = false;
    mesh.renderOrder = spec.renderOrder;
    group.add(mesh);
    return mesh;
  });

  // ---- parallax starfield layers: custom point shader, per-star size/colour,
  // amber<->blue-white temperature spread, band clustering. Buffers allocated
  // once; positions regenerated per system (queued, cheap). r5 lesson: the
  // four size CONSTANTS printed visible tiers. Each layer now draws sizes
  // from a long-tail power law WIDE enough to overlap its neighbours — one
  // continuous magnitude distribution across all depths (and the depth
  // spread itself carries the parallax read). Crosses: 2 flagged heroes only.
  const starLayers = [];
  // renderOrder stacks the sky (all NEGATIVE so cockpit/vfx transparents at
  // default 0 still draw last): dustA/mid/near stars < farShell(-7) <
  // nearShell(-5) < hero(-3) — both nebula shells genuinely dim the three
  // field-star layers behind them (plus the baked-sky stars); only the
  // sparse hero pinpoints and flares stay crisp in front of the cloud.
  const layerSpecs = [
    // ALL star shells sit BEYOND the worst-case planet-to-camera distance
    // (~65k at the m2 pose): a "star" is a distant sun and must NEVER render
    // in front of a planet disc (r7 regression caught in capture — the old
    // 19-48k inner shells put points on the hero planet's face). Sizes are
    // scaled up to preserve on-screen appearance; the size/brightness power
    // laws — not the radii — carry the depth read in a still frame.
    { name: 'dustA', n: 4200, rMin: 90000, rMax: 115000, size: 185, bMin: 0.09, bMax: 0.50, pw: 3.2, ro: -8 },
    { name: 'mid',   n: 2600, rMin: 78000, rMax: 100000, size: 405, bMin: 0.20, bMax: 1.05, pw: 3.6, ro: -7.6 },
    { name: 'near',  n: 1100, rMin: 70000, rMax: 90000,  size: 905, bMin: 0.34, bMax: 1.90, pw: 3.6, ro: -7.3 },
    // hero floor DOWN + steeper power law: fewer stars sit just over the
    // bloom threshold, so the post pass can't print rows of identical blobs
    { name: 'hero',  n: 64,   rMin: 66000, rMax: 84000,  size: 2750, bMin: 0.70, bMax: 4.20, pw: 4.0, ro: -3 },
  ];
  const bandDir = new THREE.Vector3(0.2, 0.75, 0.3).normalize();
  for (const spec of layerSpecs) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(spec.n * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(spec.n * 3), 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(spec.n), 1));
    geo.setAttribute('aSpike', new THREE.BufferAttribute(new Float32Array(spec.n), 1));
    geo.setAttribute('aGlowW', new THREE.BufferAttribute(new Float32Array(spec.n).fill(1), 1));
    geo.setAttribute('aRot', new THREE.BufferAttribute(new Float32Array(spec.n), 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: STARPT_VERT, fragmentShader: STARPT_FRAG,
      uniforms: { uScale: { value: 540 } },
      vertexColors: true, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.renderOrder = spec.ro;
    group.add(pts);
    starLayers.push({ pts, spec });
  }

  function fillStarLayer(idx, sysIndex) {
    const { pts, spec } = starLayers[idx];
    const rng = G.rngFor('stars-' + spec.name + '-' + sysIndex);
    const pos = pts.geometry.attributes.position.array;
    const col = pts.geometry.attributes.color.array;
    const siz = pts.geometry.attributes.aSize.array;
    const spk = pts.geometry.attributes.aSpike.array;
    const glw = pts.geometry.attributes.aGlowW.array;
    const rot = pts.geometry.attributes.aRot.array;
    const d = new THREE.Vector3();
    // a few knot centres per layer (band-biased): visible local clusters on
    // top of the broad band gradient — real skies clump, uniform fields don't
    const knots = [];
    for (let kk = 0; kk < 3; kk++) {
      const kd = new THREE.Vector3();
      for (let tries = 0; tries < 8; tries++) {
        const z = rng() * 2 - 1, a = rng() * Math.PI * 2, rr = Math.sqrt(1 - z * z);
        kd.set(rr * Math.cos(a), z, rr * Math.sin(a));
        const band = 1 - Math.abs(kd.dot(bandDir));
        if (rng() < band * band) break;
      }
      knots.push(kd.clone());
    }
    for (let i = 0; i < spec.n; i++) {
      if (spec.n > 200 && rng() < 0.26) {
        // clustered star: gaussian-ish scatter around a knot centre
        const kd = knots[(rng() * knots.length) | 0];
        d.set(kd.x + (rng() + rng() - 1) * 0.10,
              kd.y + (rng() + rng() - 1) * 0.10,
              kd.z + (rng() + rng() - 1) * 0.10).normalize();
      } else {
        // band-biased field star — HARD bias (band^3.5): dense lane, thin poles
        for (let tries = 0; tries < 6; tries++) {
          const z = rng() * 2 - 1;
          const a = rng() * Math.PI * 2;
          const rr = Math.sqrt(1 - z * z);
          d.set(rr * Math.cos(a), z, rr * Math.sin(a));
          const band = 1 - Math.abs(d.dot(bandDir));
          if (rng() < 0.10 + 0.90 * Math.pow(band, 3.5)) break;
        }
      }
      const rad = spec.rMin + rng() * (spec.rMax - spec.rMin);
      pos[i * 3] = d.x * rad; pos[i * 3 + 1] = d.y * rad; pos[i * 3 + 2] = d.z * rad;
      // power-law brightness; the hero tier punches past the 1.45 bloom
      // threshold on purpose
      let b = spec.bMin + (spec.bMax - spec.bMin) * Math.pow(rng(), spec.pw);
      // BIMODAL colour temperature: stars commit to warm amber or cool
      // blue-white — the two-population split must survive 1280w JPEG
      let temp = rng() < 0.55 ? Math.pow(rng(), 2.0) * 0.30 : 1.0 - Math.pow(rng(), 2.0) * 0.30;
      if (spec.name !== 'dustA' && rng() < 0.02) { b *= 1.5; temp = 0.80 + temp * 0.20; }
      // the SUN owns big warm halos: hero tier runs white-to-blue only, and
      // warm stars in the lower tiers stay under the bloom threshold so no
      // amber dot ever impersonates the system sun
      if (spec.name === 'hero') temp = 0.45 + temp * 0.55;
      else if (temp < 0.40) b = Math.min(b, 1.42);
      // dense band glow swallows starlight: dim ALL parallax stars toward
      // the band spine so pinpoints don't read composited OVER the glow
      {
        const bandF = 1 - Math.abs(d.dot(bandDir));
        b *= 1.0 - (spec.name === 'hero' ? 0.30 : 0.55) * Math.pow(bandF, 3.0);
      }
      // WIDER temperature separation than r6 — the warm/cool split must
      // survive bloom whitening and 1280w JPEG
      col[i * 3]     = b * (1.14 - temp * 0.62);
      col[i * 3 + 1] = b * (0.56 + temp * 0.17);
      col[i * 3 + 2] = b * (0.20 + temp * 0.98);
      // size: CONTINUOUS long-tail power law in every layer (r5: uniform-
      // large hero tier + fixed per-tier constants printed discrete sizes).
      // Ranges deliberately overlap neighbouring layers — no visible steps.
      siz[i] = spec.name === 'hero'
        ? spec.size * (0.28 + 1.45 * Math.pow(rng(), 2.0))
        : spec.size * (0.22 + 2.30 * Math.pow(rng(), 2.9)) * (0.65 + 0.35 * Math.min(b, 2.5));
      spk[i] = 0.0;
      // halo width/weight varies star to star: hard pinpoints vs soft halos
      glw[i] = 0.65 + rng() * 0.95;
      rot[i] = 0.0;
    }
    if (spec.name === 'hero') {
      // the sky's 2-3 true flare-bearers: the ONLY stars that earn a
      // diffraction cross — and each cross DIFFERS (strength, rotation, halo
      // width), so no two flares print the same sprite (r6 tell).
      // ten flare-bearers scattered over the sphere so a couple land in any
      // frame — each cross differs in strength, rotation and halo width;
      // most are FAINT so the sky never reads as a cross-stamp sheet
      const heroBoost = [
        [0, 1.00, 1.70, 1.00, 0.38, 1.35], // dominant: strong cross, rotated
        [1, 0.78, 1.35, 0.55, 0.00, 0.85], // axis-aligned, tighter
        [2, 0.62, 1.10, 0.30, 0.79, 1.60], // faint wide-halo glint
        [3, 0.88, 1.50, 0.75, 1.15, 1.10], // strong, steep rotation
        [4, 0.70, 1.25, 0.42, 0.58, 0.72], // hard pinpoint, thin cross
        [5, 0.58, 1.05, 0.22, 0.20, 1.45], // soft halo, whisper cross
        [6, 0.92, 1.55, 0.85, 0.94, 1.20], // second dominant, own angle
        [7, 0.66, 1.15, 0.35, 1.35, 0.90], // mid, steep angle
        [8, 0.55, 1.00, 0.18, 0.50, 1.30], // whisper
        [9, 0.74, 1.30, 0.48, 0.10, 1.05], // near-axis, mid strength
      ];
      for (const [hi, bF, sF, spF, rt, gw] of heroBoost) {
        const b = spec.bMax * bF;
        const temp = 0.62 + rng() * 0.30; // cool-white: the sun owns warm halos
        col[hi * 3]     = b * (1.14 - temp * 0.62);
        col[hi * 3 + 1] = b * (0.56 + temp * 0.17);
        col[hi * 3 + 2] = b * (0.20 + temp * 0.98);
        siz[hi] = spec.size * sF;
        spk[hi] = spF;
        rot[hi] = rt;
        glw[hi] = gw;
      }
    }
    pts.geometry.attributes.position.needsUpdate = true;
    pts.geometry.attributes.color.needsUpdate = true;
    pts.geometry.attributes.aSize.needsUpdate = true;
    pts.geometry.attributes.aSpike.needsUpdate = true;
    pts.geometry.attributes.aGlowW.needsUpdate = true;
    pts.geometry.attributes.aRot.needsUpdate = true;
  }

  // ---- sun: layered flare — hot core (bloom feeds on it), tinted halo,
  // subtle DELIBERATE anamorphic streak. No geometry, no stray lines.
  const sunGroup = new THREE.Group();
  group.add(sunGroup);
  const sunCoreTex = radialTexture(SUN_CORE_STOPS);
  const sunHaloTex = radialTexture(SUN_HALO_STOPS);
  const sunCoreMat = new THREE.SpriteMaterial({
    map: sunCoreTex, color: new THREE.Color(2.6, 2.4, 2.1), transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const sunCore = new THREE.Sprite(sunCoreMat);
  sunCore.scale.setScalar(6800);
  sunGroup.add(sunCore);
  const sunHaloMat = new THREE.SpriteMaterial({
    map: sunHaloTex, color: new THREE.Color(0.62, 0.48, 0.32), transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6,
  });
  const sunHalo = new THREE.Sprite(sunHaloMat);
  sunHalo.scale.setScalar(30000);
  sunGroup.add(sunHalo);
  const sunStreakMat = new THREE.SpriteMaterial({
    map: sunCoreTex, color: new THREE.Color(0.9, 0.88, 0.85), transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.30,
  });
  const sunStreak = new THREE.Sprite(sunStreakMat);
  sunStreak.scale.set(22000, 1150, 1); // screen-aligned horizontal anamorphic — kept SHORT so a strut-hidden sun can't orphan a long floating streak
  sunGroup.add(sunStreak);
  // sun sprites draw after the shells (-1): nebula never dims the sun disc
  sunCore.renderOrder = sunHalo.renderOrder = sunStreak.renderOrder = -1;
  const sunDir = new THREE.Vector3(0.6, 0.5, 0.1).normalize();

  // ---- planets: PREBUILT once (geometry + compiled materials); per-system
  // work is uniform/position updates only — no single-frame build spike.
  const planetGroup = new THREE.Group();
  group.add(planetGroup);
  const unitSphere = new THREE.SphereGeometry(1, 160, 110);
  const unitSphereMid = new THREE.SphereGeometry(1, 96, 66);
  const atmoSphere = new THREE.SphereGeometry(1, 96, 64);
  const planets = [];
  for (let k = 0; k < 2; k++) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: PLANET_VERT, fragmentShader: PLANET_FRAG,
      uniforms: {
        uRadius: { value: 1 },
        uAmp: { value: 0.012 },
        uNFreq: { value: 1.0 },
        uOff2: { value: new THREE.Vector3() },
        uSunDir: { value: sunDir },
        uColLo: { value: new THREE.Color() },
        uColMid: { value: new THREE.Color() },
        uColHi: { value: new THREE.Color() },
        uColAtmo: { value: new THREE.Color() },
        uColNight: { value: new THREE.Color() },
        uCloudAmt: { value: 0.3 },
        uIceAmt: { value: 0.0 },
        uBandTint: { value: 0.0 },
        uVeil: { value: 0.0 },
        uVeilCol: { value: new THREE.Color() },
        uCrater: { value: 0.0 },
        uEarthshine: { value: 0.06 },
        uColSea: { value: new THREE.Color() },
        uSeaLvl: { value: 0.0 },
      },
    });
    const mesh = new THREE.Mesh(k === 0 ? unitSphere : unitSphereMid, mat);
    mesh.frustumCulled = false; // shader scales the unit sphere
    planetGroup.add(mesh);
    const atmo = new THREE.Mesh(atmoSphere, new THREE.ShaderMaterial({
      vertexShader: ATMO_VERT, fragmentShader: ATMO_FRAG,
      uniforms: {
        uColor: { value: new THREE.Color() },
        uWarm: { value: new THREE.Color() },
        uSunDir: { value: sunDir },
        uMul: { value: 1.0 },
      },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide,
    }));
    planetGroup.add(atmo);
    planets.push({ mesh, atmo, radius: 1 });
  }

  function configurePlanets(sysIndex) {
    const pal = SYSTEM_PALETTES[sysIndex % SYSTEM_PALETTES.length];
    const rng = G.rngFor('planets' + sysIndex);
    const veilCol = new THREE.Color(pal.atmo).lerp(new THREE.Color(pal.deep), 0.60).multiplyScalar(0.35);
    for (let k = 0; k < 2; k++) {
      const pl = planets[k];
      const u = pl.mesh.material.uniforms;
      // saturated biome identity from the system palette
      const base = new THREE.Color(pal.planet).offsetHSL(k * 0.11 + (rng() - 0.5) * 0.04, 0.22, -0.01);
      const lo = base.clone().offsetHSL(-0.05, 0.10, -0.13);
      const hi = base.clone().offsetHSL(0.035, -0.02, 0.11);
      // hierarchy: k0 = big hero close in, k1 = clearly smaller companion
      // moon, placed NEAR the hero (angular neighbour) but farther + veiled
      const radius = k === 0 ? 7200 + rng() * 3200 : 2400 + rng() * 1000;
      const dist = k === 0 ? 25000 + rng() * 7000 : 0; // moon positioned off hero below
      u.uRadius.value = radius;
      // hero limb stays near-SMOOTH (r6: displacement dimples at the limb
      // read as a golf ball); relief lives in the shading normals instead.
      // moon keeps real crags — airless bodies wear their silhouette.
      u.uAmp.value = k === 0 ? 0.004 + rng() * 0.003 : 0.013 + rng() * 0.006;
      // moon noise freq HALVED r7: at a ~60px disc the old 1.7-2.6 crater
      // fields aliased into salt-and-pepper speckle (r7 critic: "mossy coin")
      u.uNFreq.value = k === 0 ? 0.8 + rng() * 0.7 : 0.9 + rng() * 0.5;
      u.uOff2.value.set(rng() * 40, rng() * 40, rng() * 40);
      // sea level / basin fraction: some planets archipelago, some dry with
      // dark lowland flats — the VALUE plateau survives either way
      u.uSeaLvl.value = -0.22 + rng() * 0.42;
      u.uColSea.value.set(pal.atmo).lerp(lo, 0.55).multiplyScalar(0.42);
      u.uColLo.value.copy(lo);
      u.uColMid.value.copy(base);
      u.uColHi.value.copy(hi);
      u.uColAtmo.value.set(pal.atmo);
      u.uColNight.value.set(pal.deep).multiplyScalar(0.6);
      u.uCloudAmt.value = k === 0 ? 0.20 + rng() * 0.14 : 0.0;
      u.uIceAmt.value = k === 0 && rng() < 0.4 ? 0.45 + rng() * 0.30 : 0.0;
      u.uBandTint.value = k === 0 ? rng() * 0.30 : 0.0;
      // moon: LESS veil + LESS earthshine than r4 — its dark side must go
      // genuinely dark so the shared light direction reads on both bodies
      // moon veil OFF: any wash toward the sky colour makes the small dark
      // disc read as a translucent cutout instead of a body
      u.uVeil.value = 0.0;
      u.uVeilCol.value.copy(veilCol);
      // companion is a cratered moon (maria + rims), never a retinted hero
      u.uCrater.value = k === 0 ? 0.0 : 1.0;
      // earthshine LOW: a readable night side competes with the crescent at
      // 1080p and the whole disc reads "lit from the wrong side" (r7 critic
      // misread the bright night texture as the day side)
      u.uEarthshine.value = k === 0 ? 0.020 : 0.030;
      pl.radius = radius;
      if (k === 0) {
        const ang = rng() * Math.PI * 2;
        pl.mesh.position.set(Math.cos(ang) * dist * 0.6, (rng() - 0.35) * dist * 0.25, -dist);
      } else {
        // companion moon: mostly LATERAL to the origin->hero axis so the
        // radius hierarchy (3x smaller) holds from any viewpoint on that axis
        const hero = planets[0];
        const away = hero.mesh.position.clone().normalize(); // origin -> hero
        const side = new THREE.Vector3().crossVectors(away, new THREE.Vector3(0, 1, 0)).normalize();
        const off = side.multiplyScalar((rng() < 0.5 ? -1 : 1) * hero.radius * (1.6 + rng() * 0.5))
          .addScaledVector(new THREE.Vector3(0, 1, 0), hero.radius * (0.5 + rng() * 0.6))
          .addScaledVector(away, hero.radius * (0.3 + rng() * 0.4));
        pl.mesh.position.copy(hero.mesh.position).add(off);
      }
      // r5: 1.10R shell showed its own geometric limb (bubble). 1.05R keeps
      // the glow hugging the surface (edge-fade removes the rim) while
      // giving the halo arc enough pixels to read at 1080p
      pl.atmo.scale.setScalar(radius * (k === 0 ? 1.05 : 1.02));
      pl.atmo.position.copy(pl.mesh.position);
      const au = pl.atmo.material.uniforms;
      au.uColor.value.set(pal.atmo);
      au.uWarm.value.set(pal.warm);
      // moon shell nearly off: airless body, halo whisper only. Hero uMul up
      // vs r5 — the band is ~3x thinner now and must survive blind scale
      // hero shell UP again for r7: at the gauntlet's backlit poses the
      // outer halo arc carries most of the "where is the sun" read
      au.uMul.value = k === 0 ? 2.6 : 0.20;
    }
  }

  // ---- asteroid field: THREE craggy geometry variants (positional sine-sum
  // displacement + crater dents on a detail-2 icosahedron — real surface
  // relief, not low-poly chunks), mottled fbm-style canvas albedo, size power
  // law with many small rocks, all LIT by the system sun. Plus additive dust
  // glints scattered through the belt so the field reads populated.
  const astRng = G.rngFor('asteroids');
  // r14-collide: ?astflat=1 restores the as-shipped hard-facet look (see the
  // normal weld inside makeAsteroidGeometry).
  const AST_FLAT_SHADING = new URLSearchParams(location.search).get('astflat') === '1';
  function makeAsteroidGeometry(rng) {
    const g = new THREE.IcosahedronGeometry(1, 2);
    const p = g.attributes.position;
    const waves = [];
    for (let w = 0; w < 6; w++) {
      waves.push({
        dir: new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize(),
        freq: (1.5 + rng() * 4.5) * Math.PI,
        amp: 0.17 / (1 + w * 0.5),
        ph: rng() * Math.PI * 2,
      });
    }
    const craters = [];
    for (let c = 0; c < 4; c++) {
      craters.push({
        dir: new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize(),
        rad: 0.35 + rng() * 0.45,
        depth: 0.10 + rng() * 0.13,
      });
    }
    const squashY = 0.68 + rng() * 0.28;
    const v = new THREE.Vector3();
    let maxR = 0, sumR = 0;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).normalize();
      let h = 0;
      for (const w of waves) h += Math.sin(v.dot(w.dir) * w.freq + w.ph) * w.amp;
      for (const c of craters) {
        const d = v.distanceTo(c.dir);
        if (d < c.rad) {
          const t = 1 - d / c.rad;
          h -= c.depth * t * t * (3 - 2 * t); // smooth bowl
        }
      }
      v.multiplyScalar(1 + h);
      p.setXYZ(i, v.x, v.y * squashY, v.z);
      // r14-collide: the TRUE post-displacement extent in local units, plus
      // the mean. The collision sphere scales from one of these rather than
      // from the unit sphere the icosahedron started as. MEASURED per variant
      // (tools/r14-collide-probe.mjs, census.localMaxRadius): max 1.3432 /
      // 1.2681 / 1.3879, so a unit-radius assumption would have under-covered
      // every rock by 27-39%.
      const r = Math.hypot(v.x, v.y * squashY, v.z);
      sumR += r;
      if (r > maxR) maxR = r;
    }
    g.computeVertexNormals();
    // r14-collide PART 2 — SMOOTH THE NORMALS. Player-reported: "asteroids read
    // as very low-poly up close." §12 puts remodelling out of scope and allows
    // only a trivial LOD-or-normals fix. MEASURED, this is the normals half:
    //
    //   * The rock is 180 triangles (icosphere detail 2: V=92, E=270, F=180)
    //     stored NON-INDEXED — 540 vertices for 92 distinct positions. So the
    //     geometry HAS the shared vertices to support smoothing.
    //   * The normals it ships with split by a mean of 44.22 / 46.81 / 52.95
    //     degrees (max 113 / 126 / 140) between vertices at the same position:
    //     they are face normals, not vertex normals.
    //   * At the distance a player passes a typical rock, 100-200u, ONE flat
    //     facet covers 17-43 screen pixels at 1080p, and 88-168 px on a big
    //     one (reports/r14-collide/REF-TARGETS.md §4).
    //
    // computeVertexNormals on NON-INDEXED geometry writes the face normal to
    // all three of a triangle's vertices, so clearing `flatShading` alone
    // changes nothing. That is not a deduction left standing on its own:
    // tools/r14-collide-facets.mjs renders it as arm B and the frame comes
    // back visually identical to as-shipped (reports/r14-collide/facets/
    // B-big-2.2R.png against A-big-2.2R.png). Only the weld below does
    // anything, and it is arm C — the rock stops reading as a faceted crystal
    // and reads as a rounded mass.
    //
    // The TRIANGLE COUNT is untouched and stays a carried defect: the
    // silhouette is still a 180-face polyhedron. This fixes facet HARDNESS,
    // which is the half that was a shading bug rather than a modelling job.
    //
    // ?astflat=1 restores the shipped flat look for A/B without a code change.
    if (!AST_FLAT_SHADING) {
      const nrm = g.attributes.normal;
      const acc = new Map();
      const key = (i) => `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
      for (let i = 0; i < p.count; i++) {
        const k = key(i);
        let a = acc.get(k);
        if (!a) { a = [0, 0, 0]; acc.set(k, a); }
        a[0] += nrm.getX(i); a[1] += nrm.getY(i); a[2] += nrm.getZ(i);
      }
      for (const a of acc.values()) {
        const L = Math.hypot(a[0], a[1], a[2]) || 1;
        a[0] /= L; a[1] /= L; a[2] /= L;
      }
      for (let i = 0; i < p.count; i++) {
        const a = acc.get(key(i));
        nrm.setXYZ(i, a[0], a[1], a[2]);
      }
      nrm.needsUpdate = true;
    }
    g.userData.astMaxRadius = maxR;
    g.userData.astMeanRadius = sumR / p.count;
    // r14-collide: EQUAL-VOLUME radius — the radius of the sphere enclosing
    // the same volume as this rock, by the divergence theorem over the (non
    // indexed) triangle soup. NOT the shipped collision radius; it is the
    // measured alternative arm, reachable with ?astradius=volume. See the
    // radius decision at the broadphase below.
    let vol6 = 0;
    for (let i = 0; i < p.count; i += 3) {
      const ax = p.getX(i), ay = p.getY(i), az = p.getZ(i);
      const bx = p.getX(i + 1), by = p.getY(i + 1), bz = p.getZ(i + 1);
      const cx = p.getX(i + 2), cy = p.getY(i + 2), cz = p.getZ(i + 2);
      vol6 += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
    }
    const vol = Math.abs(vol6) / 6;
    g.userData.astVolumeRadius = Math.cbrt(vol * 3 / (4 * Math.PI));
    return g;
  }
  function asteroidTexture(rng) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g2 = c.getContext('2d');
    g2.fillStyle = '#8d8a86';
    g2.fillRect(0, 0, 256, 256);
    // layered mottling — big soft patches down to fine grain
    for (let i = 0; i < 950; i++) {
      const r = 1.5 + rng() * rng() * 26;
      const l = (78 + rng() * 88) | 0;
      g2.fillStyle = `rgba(${l},${(l * 0.965) | 0},${(l * 0.93) | 0},${(0.07 + rng() * 0.16).toFixed(3)})`;
      g2.beginPath();
      g2.arc(rng() * 256, rng() * 256, r, 0, 7);
      g2.fill();
    }
    // dark pits
    for (let i = 0; i < 160; i++) {
      const r = 1 + rng() * 5;
      g2.fillStyle = `rgba(22,20,18,${(0.10 + rng() * 0.22).toFixed(3)})`;
      g2.beginPath();
      g2.arc(rng() * 256, rng() * 256, r, 0, 7);
      g2.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  const AST_COUNTS = [120, 90, 70];
  const astMeshes = [];
  const astStates = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3();
  const astCol = new THREE.Color();
  for (let vI = 0; vI < AST_COUNTS.length; vI++) {
    const geo = makeAsteroidGeometry(astRng);
    const mat = new THREE.MeshStandardMaterial({
      map: asteroidTexture(astRng),
      // r14-collide: was `flatShading: true`. On its own that flag was doing
      // nothing the geometry was not already doing (the normals are per-face
      // because the buffer is non-indexed) — measured as arm B in
      // tools/r14-collide-facets.mjs. It now tracks the weld switch so
      // ?astflat=1 gives back the old look in one place.
      roughness: 0.86, metalness: 0.04, flatShading: AST_FLAT_SHADING,
    });
    const n = AST_COUNTS[vI];
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const states = [];
    for (let i = 0; i < n; i++) {
      const a = astRng() * Math.PI * 2;
      const r = 1200 + astRng() * 5200;
      const pos = new THREE.Vector3(Math.cos(a) * r, (astRng() - 0.5) * 1600, Math.sin(a) * r - 3200);
      // size power law: MANY small rocks, a long tail of genuine boulders
      let sc = 3.5 + 55 * Math.pow(astRng(), 3.0);
      if (astRng() < 0.05) sc *= 2.3;
      const axis = new THREE.Vector3(astRng() - 0.5, astRng() - 0.5, astRng() - 0.5).normalize();
      states.push({
        pos, sc, axis,
        rate: (0.03 + astRng() * 0.16) * (astRng() < 0.5 ? -1 : 1),
        phase: astRng() * Math.PI * 2,
      });
      astCol.setHSL(0.055 + astRng() * 0.05, 0.16 + astRng() * 0.12, 0.30 + astRng() * 0.14);
      mesh.setColorAt(i, astCol);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    group.add(mesh);
    astMeshes.push(mesh);
    astStates.push(states);
  }

  // ---------------------------------------------------------------------
  // r14-collide — SHIP-vs-BELT BROADPHASE. Player-reported defect: the ship
  // flies straight through the rocks. MEASURED before the fix
  // (tools/r14-collide-probe.mjs -> artifacts/r14-collide/probe-base-prefix
  // .json): a head-on cruise approach reaches -0.995 R, i.e. the camera passes
  // within 0.7u of a 156u rock's CENTRE, with zero shield loss and no impact
  // signal of any kind. There was no ship-vs-asteroid test in the build.
  //
  // WHY A FLAT ARRAY AND A LINEAR SCAN, and not a grid:
  //   * The belt is STATIC in translation. updateAsteroids recomposes every
  //     matrix from a fixed st.pos and a fixed st.sc and varies only the
  //     rotation quaternion, so centre and radius are constants for the life
  //     of the scene. They can be packed once and never touched again.
  //   * N = 280. The scan is 280 iterations of contiguous-float arithmetic
  //     with no object dereference, no Vector3 and no allocation. MEASURED
  //     cost is in reports/r14-collide/REPORT.md; a spatial grid was rejected
  //     on the measurement, not on principle, and the note there says at what
  //     N it stops being the right call.
  //
  // WHICH RADIUS — a dial, decided on a measurement and left switchable.
  // A rock's surface radius runs 0.60 to 1.39 in local units (p05 / p50 / p95
  // / max = 0.60-0.68 / 0.91-0.97 / 1.20-1.24 / 1.27-1.39 across the three
  // variants; tools/r14-collide-radius.mjs). One sphere cannot fit that,
  // so the choice is which way to be wrong:
  //
  //   * EQUAL-VOLUME radius (0.6508 / 0.7017 / 0.7206 x max, per variant) —
  //     tried first. MEASURED: the ship
  //     comes to rest 40.7u INSIDE the biggest rock's outer surface
  //     (artifacts/r14-collide/probe-volume-radius.json). The camera sits at
  //     the ship's origin, so "inside the surface" means the near plane is
  //     inside the mesh and the player sees THROUGH the rock via backface
  //     culling. That is a harder visual break than the fly-through it was
  //     meant to replace, and no damage tuning fixes it.
  //   * MAX radius — SHIPPED. The ship never enters the rock's bounding
  //     sphere, which is also a checkable invariant the regression asserts on
  //     (the ship must come to rest a full SHIP_R clear of it, not merely at a
  //     non-negative gap — an earlier version of that assertion said >= 0 and
  //     a mutant with the pad removed passed it at 0.067u; r14-collide's
  //     critic, finding F2). It costs over-cover: the surface directly
  //     ahead of a stopped ship is up to (1 - 0.65) R away. Bounded, and it
  //     sits inside a silhouette that is already filling the frame at that
  //     range, because a silhouette is an upper envelope of the radius and so
  //     reads close to max from any direction.
  //
  // ?astradius=volume restores the rejected arm in process, so the two can be
  // compared by one build of one instrument rather than by argument.
  const AST_RADIUS_MODE = new URLSearchParams(location.search).get('astradius') === 'volume'
    ? 'astVolumeRadius' : 'astMaxRadius';
  // Layout: [cx, cy, cz, r] per rock, r = st.sc x the chosen local radius.
  const astSpheres = new Float64Array(astStates.reduce((a, s) => a + s.length, 0) * 4);
  {
    let k = 0;
    for (let vI = 0; vI < astMeshes.length; vI++) {
      const rLocal = astMeshes[vI].geometry.userData[AST_RADIUS_MODE];
      for (const st of astStates[vI]) {
        astSpheres[k++] = st.pos.x;
        astSpheres[k++] = st.pos.y;
        astSpheres[k++] = st.pos.z;
        astSpheres[k++] = st.sc * rLocal;
      }
    }
  }
  const AST_N = astSpheres.length / 4;

  // Swept-sphere query: earliest contact of the segment p0->p1, thickened by
  // `pad`, against the belt. Returns null on a miss, otherwise a REUSED result
  // object (never allocates on the hot path) carrying the entry fraction t in
  // [0,1], the rock's centre and radius, and the index.
  //
  // SWEPT, not a point test at p1. The reason first written here was WRONG and
  // is corrected in place, because a wrong comment outlives a wrong report.
  //
  //   WHAT IT SAID: "tunnelling is real at these speeds — boost is 320 u/s =
  //   5.33u per fixed step against a smallest-rock radius of 4.44, so a point
  //   test would pass clean through the small end of the size power law."
  //
  //   WHY THAT IS WRONG, and how it was caught: it compares the step to the
  //   rock's RADIUS and forgets the ship pad. The test sphere is astR + SHIP_R
  //   = 4.438 + 6 = 10.438, so the crossing a point test would have to miss is
  //   20.88u WIDE, against a 5.33u boost step — a factor of 3.9 of margin, not
  //   a tunnel. r14-collide's critic (finding F1) installed a point-at-p1 query
  //   at runtime and measured results IDENTICAL to the swept one on every row,
  //   including the smallest rock. The swept test is not currently preventing
  //   any tunnelling, because there is none to prevent.
  //
  //   WHY IT STAYS ANYWAY: the margin is thinner than it looks and it is not
  //   guarded by anything else. main.js clamps the frame delta at 0.05s
  //   (main.js `Math.min(0.05, ...)`), so a stalled frame steps the ship 16u at
  //   boost against that same 20.88u crossing — 77% of the way through, on the
  //   smallest rock in the belt. Shrinking SHIP_R, adding a smaller rock to the
  //   power law, or raising the boost ceiling would each close that gap, and
  //   the swept form costs nothing measurable (430ns/frame for the whole
  //   scan). It is insurance whose premium is zero, and it is NOT evidence of
  //   a bug it prevents. Do not cite it as such.
  const _astHit = { t: 0, index: -1, cx: 0, cy: 0, cz: 0, r: 0, startedInside: false };
  function asteroidSweptHit(p0x, p0y, p0z, p1x, p1y, p1z, pad) {
    const dx = p1x - p0x, dy = p1y - p0y, dz = p1z - p0z;
    const a = dx * dx + dy * dy + dz * dz;
    let bestT = Infinity, best = -1, bestInside = false;
    for (let i = 0, k = 0; i < AST_N; i++, k += 4) {
      const cx = astSpheres[k], cy = astSpheres[k + 1], cz = astSpheres[k + 2];
      const rr = astSpheres[k + 3] + pad;
      const mx = p0x - cx, my = p0y - cy, mz = p0z - cz;
      const c = mx * mx + my * my + mz * mz - rr * rr;
      if (c <= 0) {                     // already overlapping at p0
        if (0 < bestT) { bestT = 0; best = i; bestInside = true; }
        continue;
      }
      if (a === 0) continue;            // stationary and outside
      const b = mx * dx + my * dy + mz * dz;
      if (b >= 0) continue;             // moving away from this rock
      const disc = b * b - a * c;
      if (disc < 0) continue;           // the line misses the sphere
      const t = (-b - Math.sqrt(disc)) / a;
      if (t < 0 || t > 1) continue;     // contact is outside this step
      if (t < bestT) { bestT = t; best = i; bestInside = false; }
    }
    if (best < 0) return null;
    _astHit.t = bestT;
    _astHit.index = best;
    _astHit.cx = astSpheres[best * 4];
    _astHit.cy = astSpheres[best * 4 + 1];
    _astHit.cz = astSpheres[best * 4 + 2];
    _astHit.r = astSpheres[best * 4 + 3];
    _astHit.startedInside = bestInside;
    return _astHit;
  }
  // ---------------------------------------------------------------------

  // dust glints: tiny additive motes among the rocks — catch the key light
  // as sparse pinpricks so the belt has fine-scale life between boulders
  const N_GLINT = 260;
  const glintGeo = new THREE.BufferGeometry();
  {
    const gp = new Float32Array(N_GLINT * 3);
    const gc = new Float32Array(N_GLINT * 3);
    const gs = new Float32Array(N_GLINT);
    for (let i = 0; i < N_GLINT; i++) {
      const a = astRng() * Math.PI * 2;
      const r = 1100 + astRng() * 5600;
      gp[i * 3] = Math.cos(a) * r;
      gp[i * 3 + 1] = (astRng() - 0.5) * 1800;
      gp[i * 3 + 2] = Math.sin(a) * r - 3200;
      let b = 0.25 + Math.pow(astRng(), 2.6) * 1.1;
      if (astRng() < 0.03) b *= 1.7; // a few hot sparkles
      gc[i * 3] = b; gc[i * 3 + 1] = b * 0.86; gc[i * 3 + 2] = b * 0.66; // warm dust
      gs[i] = 14 + astRng() * 46;
    }
    glintGeo.setAttribute('position', new THREE.BufferAttribute(gp, 3));
    glintGeo.setAttribute('color', new THREE.BufferAttribute(gc, 3));
    glintGeo.setAttribute('aSize', new THREE.BufferAttribute(gs, 1));
    // shares STARPT shaders: aSpike/aRot zero (no crosses on dust), aGlowW=1
    glintGeo.setAttribute('aSpike', new THREE.BufferAttribute(new Float32Array(N_GLINT), 1));
    glintGeo.setAttribute('aGlowW', new THREE.BufferAttribute(new Float32Array(N_GLINT).fill(1), 1));
    glintGeo.setAttribute('aRot', new THREE.BufferAttribute(new Float32Array(N_GLINT), 1));
  }
  const glintMat = new THREE.ShaderMaterial({
    vertexShader: STARPT_VERT, fragmentShader: STARPT_FRAG,
    uniforms: { uScale: { value: 540 } },
    vertexColors: true, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const glints = new THREE.Points(glintGeo, glintMat);
  glints.renderOrder = -2;
  group.add(glints);

  // ---- lighting: sun key + dim coloured space ambient — SAME sunDir as the
  // sprite, terminators and atmo shells. Position AND target follow the
  // player every frame so the beam runs exactly sun-sprite -> camera area
  // (r4: "sun casts no light on the cockpit frame" — it was aimed at the
  // world origin and too weak to read on the cockpit's sun side).
  const starLight = new THREE.DirectionalLight(0xffeed2, 3.0);
  starLight.position.copy(sunDir).multiplyScalar(10000);
  group.add(starLight);
  group.add(starLight.target);
  // r7: lifted so backlit asteroids keep a readable face against bright
  // nebula instead of collapsing to black confetti (planets unaffected —
  // custom shaders ignore scene lights)
  const spaceAmbient = new THREE.AmbientLight(0x352a3c, 1.6);
  group.add(spaceAmbient);

  function updateAsteroids(t) {
    for (let vI = 0; vI < astMeshes.length; vI++) {
      const mesh = astMeshes[vI], states = astStates[vI];
      for (let i = 0; i < states.length; i++) {
        const st = states[i];
        q.setFromAxisAngle(st.axis, st.phase + st.rate * t);
        s3.setScalar(st.sc);
        m4.compose(st.pos, q, s3);
        mesh.setMatrixAt(i, m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
  updateAsteroids(0);

  // ---- system sky routing. setSystem stays cheap: for prebaked systems the
  // sky is a texture SWAP (zero bake work mid-warp); star-layer refills drain
  // one per frame from the task queue. Systems beyond the prebaked list fall
  // back to scissored strip bakes (48 strips, each far below 8ms GPU) into
  // whichever RT is not on screen, swapped in only when complete.
  let buildTasks = [];

  function setBakeUniformsFor(sysIndex) {
    const pal = SYSTEM_PALETTES[sysIndex % SYSTEM_PALETTES.length];
    const u = bakeMat.uniforms;
    u.uDeep.value.set(pal.deep);
    u.uColA.value.set(pal.colA);
    u.uColB.value.set(pal.colB);
    u.uColC.value.set(pal.colC);
    u.uDustAmt.value = pal.dust;
    u.uCoreAmt.value = pal.core;
    u.uStreakAmt.value = pal.streak;
    u.uStarBias.value = pal.starBias || 0.0;
    u.uStarAmt.value = pal.starAmt !== undefined ? pal.starAmt : 1.0;
    u.uSoft.value = pal.soft || 0.0;
    const rng = G.rngFor('sky' + sysIndex);
    u.uOff.value.set(rng() * 90 + 7, rng() * 90 + 3, rng() * 90 + 11);
    // deterministic replica of setSystem's sun draw: the baked warm region
    // must sit exactly where the sun sprite will render
    const srng = G.rngFor('sun' + sysIndex);
    const sb = SUN_BASE_DIRS[sysIndex % SUN_BASE_DIRS.length];
    u.uSunDirBake.value.set(
      sb[0] + (srng() - 0.5) * 0.10,
      sb[1] + (srng() - 0.5) * 0.08,
      sb[2] + (srng() - 0.5) * 0.10).normalize();
    u.uSunWarm.value.set(pal.warm).multiplyScalar(pal.soft ? 0.7 : 1.0);
    bandDir.set(rng() - 0.5, 0.35 + rng() * 0.55, rng() - 0.5).normalize();
    u.uBandDir.value.copy(bandDir);
    // dominant flow runs ALONG the band (tangent to it), jittered per system
    u.uFlowDir.value
      .set(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize()
      .cross(bandDir).normalize();
  }

  function queueSystemSky(sysIndex) {
    buildTasks = [];
    setBakeUniformsFor(sysIndex); // also refreshes bandDir for the star layers
    const cached = skyRTOwner.indexOf(sysIndex);
    if (cached >= 0) {
      skyMat.uniforms.uSky.value = skyRTs[cached].texture; // zero bake work
      for (let l = 0; l < shellMeshes.length; l++)
        shellMeshes[l].material.uniforms.uTex.value = shellRTs[cached][l].texture;
    } else {
      const displayed = skyMat.uniforms.uSky.value === skyRTs[0].texture ? 0 : 1;
      const slot = 1 - displayed;
      skyRTOwner[slot] = -1;
      const STRIPS = 8, H = SKY_RES / STRIPS;
      for (let f = 0; f < 6; f++)
        for (let s = 0; s < STRIPS; s++)
          buildTasks.push(() => bakeFace(skyRTs[slot], f, s * H, H));
      // shell rebakes: one 512 RGBA face per task — far below the 8ms budget
      for (let l = 0; l < shellMeshes.length; l++)
        for (let f = 0; f < 6; f++)
          buildTasks.push(() => { setShellUniformsFor(sysIndex, l); bakeShellFace(shellRTs[slot][l], f); });
      buildTasks.push(() => {
        skyRTOwner[slot] = sysIndex;
        skyMat.uniforms.uSky.value = skyRTs[slot].texture;
        for (let l = 0; l < shellMeshes.length; l++)
          shellMeshes[l].material.uniforms.uTex.value = shellRTs[slot][l].texture;
      });
    }
    for (let l = 0; l < starLayers.length; l++) buildTasks.push(() => fillStarLayer(l, sysIndex));
  }

  // boot prebake: BOTH gauntlet systems' skies land in VRAM before the first
  // frame (one-time boot cost — memory of one extra cubemap is the trade)
  for (let s = 0; s < PREBAKED_SYSTEMS; s++) {
    setBakeUniformsFor(s);
    for (let f = 0; f < 6; f++) bakeFace(skyRTs[s], f);
    // shells prebake with their system (uses the bandDir/flowDir just set)
    for (let l = 0; l < shellSpecs.length; l++) {
      setShellUniformsFor(s, l);
      for (let f = 0; f < 6; f++) bakeShellFace(shellRTs[s][l], f);
    }
    skyRTOwner[s] = s;
  }

  const S = {
    group, planets: () => planets,
    // R10: the ONE sun direction (sprite, terminators, atmo shells, star key)
    // published so other systems can key off the light the frame actually
    // shows. m5 critic: "the target ship is lit evenly toward camera, ignoring
    // the bright star at top-right which is the only strong key in the scene"
    // — vfx.js's fighter highlight used a hardcoded world vector unrelated to
    // any light in the frame. Live reference, not a copy: setSystem() mutates
    // this vector in place, so readers stay in sync across system changes.
    sunDir,
    // r14-collide: ship-vs-belt query, called once per player step from
    // flight.updatePlayer. Space owns the rocks; flight owns the consequence.
    asteroidSweptHit,
    asteroidCount: AST_N,
    // diagnostics only. Exposes the packed spheres and the per-variant radius
    // spread so an instrument can cross-check the collision radius against the
    // geometry it claims to stand in for, instead of trusting this file.
    asteroidDebug: () => ({
      meshes: astMeshes,
      spheres: astSpheres,
      count: AST_N,
      variants: astMeshes.map((m, i) => ({
        instances: astStates[i].length,
        localMaxRadius: m.geometry.userData.astMaxRadius,
        localMeanRadius: m.geometry.userData.astMeanRadius,
        localVolumeRadius: m.geometry.userData.astVolumeRadius,
        flatShading: !!m.material.flatShading,
      })),
    }),
    _dbg: { skyRTs, shellRTs }, // diagnostics only (capture probes)
    setWarpMode(on) {
      // hide solid bodies, sun, the static parallax star layers AND the baked
      // cubemap sky inside the hyperspace tunnel — during an NMS warp the
      // skybox is fully replaced by the tunnel; nothing static (nebula OR
      // baked stars) may show through the streak field
      sky.visible = !on;
      for (const sm of shellMeshes) sm.visible = !on;
      planetGroup.visible = !on;
      for (const am of astMeshes) am.visible = !on;
      glints.visible = !on;
      sunGroup.visible = !on;
      for (const l of starLayers) l.pts.visible = !on;
    },
    setSystem(sysIndex) {
      // ONE sun direction per system: sprite position, planet terminators,
      // atmo shells, asteroid key light all read from this vector.
      const srng = G.rngFor('sun' + sysIndex);
      const b = SUN_BASE_DIRS[sysIndex % SUN_BASE_DIRS.length];
      sunDir.set(
        b[0] + (srng() - 0.5) * 0.10,
        b[1] + (srng() - 0.5) * 0.08,
        b[2] + (srng() - 0.5) * 0.10).normalize();
      starLight.position.copy(sunDir).multiplyScalar(10000);
      const pal = SYSTEM_PALETTES[sysIndex % SYSTEM_PALETTES.length];
      const sunTint = new THREE.Color(pal.sun);
      sunCoreMat.color.setRGB(2.6 * sunTint.r, 2.5 * sunTint.g, 2.4 * sunTint.b);
      sunHaloMat.color.set(pal.warm).multiplyScalar(0.55);
      configurePlanets(sysIndex);
      queueSystemSky(sysIndex);
    },
    setVisible(vis) { group.visible = vis; },
    update(dt, t) {
      if (buildTasks.length) buildTasks.shift()(); // one heavy step per frame
      // sky, stars + sun follow the camera so space feels infinite
      const p = G.player.pos;
      sky.position.copy(p);
      for (const sm of shellMeshes) sm.position.copy(p);
      for (const l of starLayers) {
        l.pts.position.copy(p);
        l.pts.material.uniforms.uScale.value = G.renderer.domElement.height * 0.5;
      }
      glintMat.uniforms.uScale.value = G.renderer.domElement.height * 0.5;
      sunGroup.position.copy(p).addScaledVector(sunDir, 95000);
      // key light beam: from the sun sprite direction, at the camera area
      starLight.position.copy(p).addScaledVector(sunDir, 10000);
      starLight.target.position.copy(p);
      updateAsteroids(t || 0);
    },
    nearestPlanet() {
      let best = null, bd = Infinity;
      for (const pl of planets) {
        const d = pl.mesh.position.distanceTo(G.player.pos) - pl.radius;
        if (d < bd) { bd = d; best = pl; }
      }
      return { planet: best, dist: bd };
    },
  };
  G.space = S;
  return S;
}
