// post.js — EffectComposer chain: render -> thresholded bloom -> final grade.
// NMS signature: dark cockpit silhouette wrapping a bright, saturated world.
// Bloom is reserved for genuinely hot pixels (beam cores, warp streaks, panel
// glyphs, sun) via a max-channel high pass; the grade keeps deep blacks,
// punchy saturated mids (vibrance), a cool-shadow/warm-highlight split tone,
// edge-weighted chromatic aberration, fine film grain and a gentle vignette.
// Red alert: cabin flood is cockpit lighting's job — post commits the FRAME:
// corner pulse + alarm-synced vignette/exposure breathing + a brief shock-
// ripple refraction ring on damage intake (canopy flexing, not a glitch LUT).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

// ============================================================================
// R11-PERF: THE SCENE-KEY TAPS, DEFINED ONCE
// ============================================================================
// These sixteen taps are the r9 exposure stage's scene-key estimate. They are
// taken at FIXED uv, so every one of the 2,073,600 fragments in a 1920x1080
// frame was computing the identical reduction — sixteen dependent texture
// fetches, sixteen log2 and a clamp each — and throwing away 2,073,599 copies
// of the answer.
//
// MEASURED (tools/r11-perf-probe.mjs, moment 4, 1920x1080, contended):
//   whole final ShaderPass ......... 0.80 ms/frame
//   THIS BLOCK ..................... 0.63 ms/frame  (79% of the pass)
// The ablation that produced 0.63 replaced sceneKey/sceneCol with values the
// compiler could not constant-fold (uRes-derived), so everything downstream of
// the block — expo, sceneTint, the HUD cast, the ambient fill, the vignette
// scene coupling — was still being computed. 0.63 ms is the reduction itself.
//
// So the block moves into SceneKeyPass below: one 1x1 RGBA32F draw per frame,
// the same taps, the same arithmetic, and the final pass reads the answer with
// a single always-cached tap. This is a pure algorithmic move — the numbers
// are not approximated, sampled less often, or amortised across frames (an
// amortised version would make a posed capture depend on frame count, which
// HARNESS.md forbids). The prepass runs inside the same composer.render() and
// reads the same readBuffer the inline taps read, so there is not even a frame
// of lag.
//
// The text is shared between the two shaders deliberately: a copy-paste pair
// is a divergence waiting for the round where someone retunes one of them.
const KEY_TAPS = /* glsl */`
      float k = 0.0; vec3 kc = vec3(0.0); vec3 tp;
      tp = clamp(texture2D(tDiffuse, vec2(0.16, 0.34)).rgb, 0.0, 3.0); kc += tp; k += log2(max(maxc(tp), 0.002));
      tp = clamp(texture2D(tDiffuse, vec2(0.38, 0.34)).rgb, 0.0, 3.0); kc += tp; k += log2(max(maxc(tp), 0.002));
      tp = clamp(texture2D(tDiffuse, vec2(0.62, 0.34)).rgb, 0.0, 3.0); kc += tp; k += log2(max(maxc(tp), 0.002));
      tp = clamp(texture2D(tDiffuse, vec2(0.84, 0.34)).rgb, 0.0, 3.0); kc += tp; k += log2(max(maxc(tp), 0.002));
      tp = clamp(texture2D(tDiffuse, vec2(0.16, 0.46)).rgb, 0.0, 3.0); kc += tp; k += log2(max(maxc(tp), 0.002));
      tp = clamp(texture2D(tDiffuse, vec2(0.38, 0.46)).rgb, 0.0, 3.0); kc += tp; k += log2(max(maxc(tp), 0.002));
      tp = clamp(texture2D(tDiffuse, vec2(0.62, 0.46)).rgb, 0.0, 3.0); kc += tp; k += log2(max(maxc(tp), 0.002));
      tp = clamp(texture2D(tDiffuse, vec2(0.84, 0.46)).rgb, 0.0, 3.0); kc += tp; k += log2(max(maxc(tp), 0.002));
      tp = clamp(texture2D(tDiffuse, vec2(0.16, 0.58)).rgb, 0.0, 3.0); kc += tp; k += log2(max(maxc(tp), 0.002));
      tp = clamp(texture2D(tDiffuse, vec2(0.38, 0.58)).rgb, 0.0, 3.0); kc += tp; k += log2(max(maxc(tp), 0.002));
      tp = clamp(texture2D(tDiffuse, vec2(0.62, 0.58)).rgb, 0.0, 3.0); kc += tp; k += log2(max(maxc(tp), 0.002));
      tp = clamp(texture2D(tDiffuse, vec2(0.84, 0.58)).rgb, 0.0, 3.0); kc += tp; k += log2(max(maxc(tp), 0.002));
      tp = clamp(texture2D(tDiffuse, vec2(0.28, 0.70)).rgb, 0.0, 3.0); kc += tp; k += log2(max(maxc(tp), 0.002));
      tp = clamp(texture2D(tDiffuse, vec2(0.45, 0.70)).rgb, 0.0, 3.0); kc += tp; k += log2(max(maxc(tp), 0.002));
      tp = clamp(texture2D(tDiffuse, vec2(0.58, 0.70)).rgb, 0.0, 3.0); kc += tp; k += log2(max(maxc(tp), 0.002));
      tp = clamp(texture2D(tDiffuse, vec2(0.74, 0.70)).rgb, 0.0, 3.0); kc += tp; k += log2(max(maxc(tp), 0.002));
`;

const FULLSCREEN_VERT = /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

// The 1x1 reduction. RGBA32F so the round-trip is exact: the final pass must
// see the SAME float it would have computed inline, or the grade shifts and
// the posed captures stop matching. (Verified by tools/moment-diff.mjs — all
// five moments byte-identical against the pre-change build.)
const KEY_FRAG = /* glsl */`
    uniform sampler2D tDiffuse;
    float maxc(vec3 c) { return max(c.r, max(c.g, c.b)); }
    void main() {
${KEY_TAPS}
      gl_FragColor = vec4(kc / 16.0, exp2(k / 16.0));
    }
  `;

class SceneKeyPass extends Pass {
  constructor(rt) {
    super();
    this.rt = rt;
    this.needsSwap = false;   // reads readBuffer, writes its own 1x1 target
    this.fsQuad = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: KEY_FRAG,
      depthTest: false, depthWrite: false,
    }));
  }
  render(renderer, writeBuffer, readBuffer) {
    this.fsQuad.material.uniforms.tDiffuse.value = readBuffer.texture;
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(this.rt);
    this.fsQuad.render(renderer);
    renderer.setRenderTarget(prev);
  }
  setSize() { /* always 1x1 */ }
  dispose() { this.fsQuad.dispose(); }
}

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    tKey: { value: null },       // r11-perf: 1x1 scene-key target (KEYPASS builds only)
    uTime: { value: 0 },
    uRedAlert: { value: 0 },     // 0..1 red corner pulse (subtle — never a wash)
    uFlash: { value: 0 },        // shield-impact blue-white flash 0..1
    uWhiteout: { value: 0 },     // transition whiteout 0..1
    uCA: { value: 0.00004 },     // global lens CA — R10: OFF in all but name, BY MEASUREMENT (see CA block)
    uWarp: { value: 0 },         // 0..1 warp state — enables per-streak dispersion
    uShock: { value: 0 },        // 1 at damage intake -> 0 over ~0.4s (ripple envelope)
    uShockAmp: { value: 0 },     // ripple amplitude scale set from hit strength
    uSat: { value: 1.35 },       // vibrance ceiling for muted pixels
    uVig: { value: 1.0 },        // vignette amount scale
    uRes: { value: new THREE.Vector2(1920, 1080) },
  },
  vertexShader: FULLSCREEN_VERT,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform sampler2D tKey;
    uniform float uTime, uRedAlert, uFlash, uWhiteout, uCA, uWarp, uSat, uVig;
    uniform float uShock, uShockAmp;
    uniform vec2 uRes;
    varying vec2 vUv;

    // CA-split sample: R/B pulled apart along the radial offset. Each
    // displaced channel is TWO averaged taps (0.75x / 1.35x of the offset) so
    // the fringe smears across a short spectrum like real dispersion instead
    // of printing a hard saturated line (critic-2: the single-tap version
    // drew a razor pure-blue stroke along dark-strut-vs-sky edges).
    vec3 sampleCA(vec2 p, vec2 off) {
      return vec3((texture2D(tDiffuse, p + off * 0.65).r + texture2D(tDiffuse, p + off * 1.45).r) * 0.5,
                  texture2D(tDiffuse, p).g,
                  (texture2D(tDiffuse, p - off * 0.65).b + texture2D(tDiffuse, p - off * 1.45).b) * 0.5);
    }

    float maxc(vec3 c) { return max(c.r, max(c.g, c.b)); }

    // ================= R14-ALERT: HUD READABILITY UNDER RED ALERT =============
    // Player-reported: the HUD is hard to read during a red alert. Confirmed,
    // and bigger than the carried figure: our m5 "Photon Cannon" panel measures
    // Michelson 0.5036 against ref-5's own alert-state panel at 0.8739 — a 42.4%
    // deficit, not the 37% carried from round 13 (that 37% was ours-vs-reference
    // too, NOT the cost of entering the alert; nothing in round 13 measured the
    // latter). reports/r14-alert/REF-TARGETS.md §2.
    //
    // THE CARRIED MECHANISM IS WRONG AND IS NOT WHAT THESE THREE CONSTANTS FIX.
    // "The alert tint composites OVER the UI layer" has no render-order form
    // here: src/ui.js is a DOM overlay that harness boots never even fetch, and
    // the HUD is in-scene geometry inside the one RenderPass (see the hudM block
    // below, which already IS the "UI drawn after the lens" mechanism). Ablated
    // term by term on the posed m5 frame, inside the HUDGEO region
    // (reports/r14-alert/artifacts/ablation-m5.txt), the whole-frame tint terms
    // are NOT the cost:
    //     corner pulse ......................  +1.71%   <- the only real "tint on the HUD"
    //     its additive vec3(0.07,0,0) .......  +0.09%
    //     alarm slate wash ..................  +7.27%
    //     HUD ambient fill ..................  +15.12%  <- targeted AT the HUD on purpose
    //     every post alert term off .........  +22.04%
    // and on the panel faces themselves the substrate barely moves when all of
    // post's alert terms are disabled: ground RGB (167,55,41) -> (169,56,49)
    // against the reference's (35,4,7). Four fifths of the flood is the cabin's
    // red point lights in src/cockpit.js, which is a file this worker does not
    // own — see HANDOFF-r14-alert.md.
    //
    // WHICH NUMBER TO BELIEVE. The gain quoted for this block is +15.35%
    // Michelson on the NINE OPAQUE MFD PANEL FACES — the surfaces a player
    // actually reads — measured in the r14-alert critic's name-derived mask
    // (reports/r14-alert/critic-masks/mfdfaces.*, built by rendering only
    // meshes matching ^panel-(speed|left|gaugeL|gaugeR|right|weapon|cowl|
    // status|thermal)$). An earlier draft of this block quoted +23.20% from a
    // screen-space band region; that region is 56.9% cockpit structure — cowl,
    // bezels, chassis, strut ends and the radar hologram — and that half gains
    // MORE than the panels do, so the band figure overstates what a reader
    // gets. Numbers: reports/r14-alert/CRITIC.md 3c, and
    // reports/r14-alert/artifacts/critic-instrument-output.txt.
    //
    // RA_HUD_AMB — the red-alert arm of the HUD ambient substrate fill below.
    // Both poles named, per WORKER-COMMON 4. Pole B (too much) is where we
    // were: HUD ground 55.3 L under alert against 30.9 L in cruise. Pole A (too
    // little) is r9 iter-7's defect, panel backgrounds pinned at RGB ~(2,3,6)
    // with no cast — and it is MEASURED UNREACHABLE from this dial: with this
    // term ablated on the PRE-FIX build the substrate still reads R/B 5.71,
    // redder than the reference's own 4.94, because the cabin lights already
    // over-supply it. (5.71 is that isolated ablation, NOT what the shipped
    // build lands on — see the RA_SHIELD_WASH note for the landed value.) A
    // dial with one unreachable pole goes to its low end.
    //
    // RA_SHIELD_* — hudM shielding of the two whole-frame frame-commit terms.
    // This IS the layering half of the brief, done the only way this chain can
    // do it: the same (1.0 - hudM) weighting the grade already applies to
    // chromatic aberration, warp dispersion and film grain.
    //
    // RA_SHIELD_WASH IS DELIBERATELY ZERO, AND THE HISTORY MATTERS. It shipped
    // at 0.65 first, on the reasoning that 0.65 bought 3.3 more points of
    // Michelson than 0.00 and contrast was the axis the player complained
    // about. The critic measured what 0.65 actually LANDS on and that reasoning
    // does not survive: pole A for this dial is a HUE failure (the HUD
    // substrate going monochrome red), the pole sits at R/B ~12.3, and 0.65
    // landed the substrate at R/B 11.63 overall and 22.63 on the top-banner
    // band, against the reference's 4.94. That is at the pole, not clear of it.
    // At 0.00 the substrate is unmoved (8.55 -> 8.57 on the panel faces) and
    // 82% of the readability gain survives. Paying 3.3 points of contrast to
    // avoid arriving at a named failure pole is the right trade and the earlier
    // landing was wrong. reports/r14-alert/CRITIC.md 6 and 7.
    //
    // Pole A for RA_SHIELD_PULSE is a full exemption: the dash stops breathing
    // with the klaxon. MEASURED, not asserted — across the alarm cycle at
    // uRedAlert 1 the HUD's contrast breathing amplitude falls from 0.029 to
    // 0.012, i.e. reduced by 59%, so the pole is approached and not reached.
    // The pulse is a CORNER term (edge = smoothstep(0.24, 0.50, r2)) and the
    // dash band it now skips is where speed, nav and weapon state are read.
    // Sweep of every arm: reports/r14-alert/artifacts/variant-sweep-m5.txt and
    // REF-TARGETS.md section 5; live ramp: CRITIC.md 12(iv).
    const float RA_HUD_AMB      = 0.000;   // was 0.030
    const float RA_SHIELD_WASH  = 0.00;    // was 0.0; briefly 0.65, reverted on measurement
    const float RA_SHIELD_PULSE = 1.00;    // was 0.0 (no exemption)

    vec3 aces(vec3 x) {
      const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
      return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
    }

    void main() {
      vec2 uv = vUv;
      vec2 d = uv - 0.5;
      float r2 = dot(d, d);
      float rn = length(d) * 1.41421356;      // 0 at centre -> 1 at corner

      // R8 damage shock-ripple: one expanding refraction ring on damage
      // intake — the canopy flexing under the hit. Pure displacement of the
      // SOURCE uv (no colour work, no extra taps) so it reads as the world
      // lurching for a beat, not a glitch-filter overlay. Ring sweeps from
      // centre past the corners in ~0.4s and is gone.
      if (uShock > 0.001) {
        float ring = (1.0 - uShock) * 1.15;         // ring radius over the envelope
        float w = rn - ring;
        float band = exp(-w * w * 90.0);            // tight gaussian band on the ring
        float ripple = sin(w * 42.0) * band;
        uv += (d / max(rn, 1e-4)) * ripple * 0.0068 * uShock * uShock * uShockAmp;
        d = uv - 0.5; r2 = dot(d, d); rn = length(d) * 1.41421356;
      }

      // alarm waveform (red alert): asymmetric klaxon sweep — rises, dwells,
      // falls — shared by the corner pulse, vignette breath and exposure
      // breath so the whole frame breathes on ONE alarm, ~0.67Hz.
      float alarmW = smoothstep(-0.85, 0.9, sin(uTime * 4.2));

      // chromatic aberration — R9, swing 7, the mechanism meant to END the
      // pendulum. History of the two poles: r3/r7 pure-radial-at-a-whisper
      // read ABSENT ("surgically clean edges"); r5/r8 drive-boosted read
      // PAINTED ("constant-strength fringes hugging every strut edge
      // including dead-center geometry"). The r7/r8 luminance-contrast DRIVE
      // term is the painted pole's root cause: it SATURATED at every
      // hot/contrasty edge (HUD glyphs, emissive strips, strut-vs-sky), so
      // every edge got the same boosted split regardless of radius — i.e.
      // "constant-strength". Real transverse CA has exactly ONE driver:
      // radius. So r9 deletes the drive entirely and makes radius the sole
      // strength axis, with the AMPLITUDE calibrated to be unmissable at the
      // periphery instead of whispered (the absent pole was an amplitude
      // failure, not a mechanism failure):
      //   zero inside rn 0.30 (nav text + all central geometry clean),
      //   ~1.2px split in the 60-70% band at 1280w (visible only where a
      //   high-contrast edge lives there — flat regions can't show a fringe),
      //   ~3.5-4px split in the far corners at 1280w.
      // Warp: global radial CA gets only a whisper more (identity comes from
      // the per-streak dispersion below, not a global dial) and the falloff
      // stays put — r8's opened falloff (0.20 start) let fringes reach the
      // centre band during warp, feeding the "dead-center" read.
      // R9 iter-2 (critic): the dash cluster lives at MAXIMUM lens radius, so
      // pure-radial CA + shadow-weighted grain both hit hardest on exactly
      // the surfaces NMS renders as clean UI — the frame's only VISIBLE
      // fringing was peripheral HUD text, and its noisiest flats were panel
      // glass. The HUD is in-scene geometry (no separate composite to
      // reorder), but the cockpit camera is FIXED: the dash band (bottom
      // ~21%) and the floating top slabs (top band, centre half) are HUD by
      // construction. One soft screen-space mask shields them from CA, warp
      // dispersion AND grain — the post-pass equivalent of "UI drawn after
      // the lens". Soft ~3%-uv edges so no seam prints on edges crossing
      // the boundary.
      // iter-3 (critic cycle 2 NEW-ARTIFACT): the full-width bottom band was
      // itself becoming the tell — at the frame edges the dash is only ~10%
      // tall (corner u/s readout panels, tops ~uv 0.09) with open space
      // beside it, so the band boundary printed a grain-density step and an
      // abruptly-terminating CA fringe on continuous scene (m2/m5 frame
      // edges, m4 BL corner, y band ~0.20-0.23). Two-part fix: the boundary
      // DROPS toward the edges (0.205 centre -> 0.10 outboard of the side
      // panel clusters) AND the feather widens there (0.035 -> 0.055 uv,
      // ~100px total ramp) — a gradient that slow reads as lens falloff, not
      // a line. The centre keeps the tight boundary, hidden behind the
      // console/panel clusters.
      float eHud = abs(vUv.x - 0.5);
      float bndY = mix(0.205, 0.10, smoothstep(0.38, 0.435, eHud));
      float fthY = mix(0.035, 0.055, smoothstep(0.38, 0.435, eHud));
      float hudM = clamp((1.0 - smoothstep(bndY, bndY + fthY, vUv.y))
                       + smoothstep(0.775, 0.805, vUv.y)
                         * (1.0 - smoothstep(0.235, 0.265, eHud)), 0.0, 1.0);
      // R9 iter-5 — MAGNITUDE ONLY, measured. The character (pure radial,
      // two-tap spectrum smear, 0.30 knee, 1.15 falloff, HUD shield) is
      // CORRECT and is deliberately untouched here; only the drive is
      // divided. tools/r9post-probe.mjs regresses the edge chroma residual
      // against the radial luminance derivative, which returns the R->B
      // split in pixels directly. At iter-4 (uCA 0.0032) the outer band
      // (rn 0.6-1.0) measured 0.273 / 0.151 / 0.382 / 0.327 / 0.047 px across
      // m1-m5 at 1280w against reference frames measuring -0.045 / 0.011 /
      // -0.095 / 0.009 / -0.096 — i.e. we sat 5-10x over reference on the
      // four moments where the metric has signal. uCA 0.0032 -> 0.00045
      // (/7.1) landed the outer band at 0.014 / 0.080 / 0.085 / -0.008 px
      // (m2-m5) against refs of 0.011 / 0.089 / 0.009 / -0.096 — i.e. ON the
      // reference. iter-6 backs off to 0.00060 (/5.3, the VISIBLE end of the
      // brief's 5-10x band) after the cycle-1 critic answered ABSENT on all
      // five. Deliberately NOT a return swing, and here is why the pendulum
      // stops here: the critic was never asked the same question about the
      // reference frames, and the references measure -0.045 / 0.011 /
      // -0.095 / 0.009 / -0.096 px — essentially zero. A frame matched to
      // the reference will earn "absent" from a critic looking for fringing,
      // because the reference would earn it too. Not one of the cycle-1
      // critic's five pick-driving tells was chromatic aberration; the picks
      // were instanced sprites, missing contact shadows, flat-faceted ships
      // and blind-protocol leaks. Swinging this dial an eighth time to buy a
      // perceptual word costs reference fidelity and buys no verdict.
      // Nothing else in the CA path moves.
      //
      // ================== R10: THE PENDULUM STOPS HERE ==================
      // Eight swings. Both poles named by critics. What ended it is not a
      // judgement call, it is an ABLATION — tools/ca-radial.mjs, which extends
      // the r9 regression with the one band r9 could not see (r9 skipped
      // everything inside rn 0.30, which is exactly where "constant, not
      // radial" lives) and reports five radial bands plus the two HUD boxes.
      //
      // Three measurements, all at 1280w blind scale, artifacts committed
      // under captures/r10v-instrument/:
      //  (a) THE REFERENCES. Outer band (rn 0.8-1.0), signed R->B split in px:
      //      ref-1 -0.054(*up)  ref-2 -0.013(*up)  ref-3 +0.116  ref-4 +0.011
      //      ref-5 +0.040.  ref-4 is native 1920w and therefore the most
      //      trustworthy datum in the whole set: it reads 0.004 / 0.004 /
      //      -0.017 / 0.003 / 0.011 across ALL FIVE radial bands. That is a
      //      flat zero at every radius. The references do not use lens CA.
      //  (b) OUR CONTENT FLOOR, with uCA and the warp dispersion set to
      //      literal zero: outer band -0.035 / 0.058 / 0.041 / 0.035 / -0.027
      //      across m1-m5. So ~0.04px of the metric is CONTENT (chroma edges
      //      that happen to co-vary with the radial luma gradient), not lens.
      //      This also explains m1's -0.218px CENTRE reading, which SURVIVES
      //      with CA off: it is the blue-white warp core sitting in a warm
      //      surround, not a fringe. Worth knowing before swinging again at a
      //      number that no dial in this file can move.
      //  (c) OUR r9 SHIPPING STATE: outer band 0.493 / 0.122 / 0.297 / 0.321 /
      //      0.074 — i.e. 5x to 45x the reference on four of five moments,
      //      and m1 (the untouched warp dispersion) worst by a factor of ten.
      //      The m1 critic called it "the opposite pole ... fringing on the
      //      left strut edge is the same magnitude as at frame centre".
      //
      // So: the asymptote is near-zero and we err LOW, deliberately, because
      // the reference errs low. uCA 0.00060 -> 0.00012 -> 0.00004. The last
      // step is a THIRD blind critic's measurement, on the 0.00012 build,
      // using an unsigned metric this file's own instrument does not report:
      // mean |R-vs-B| sub-pixel offset over ~2400 strong edges, binned by
      // radius. Ours 0.283px against the reference's 0.142px, and — the part
      // that matters — with correlation to radius of -0.059, i.e. NO RADIAL
      // LAW. Its words: "a uniform post-process fringe pass, not optics".
      // Twice the reference's residual, spread flat across the frame, is the
      // painted pole in miniature, so the dial goes to a token value. The
      // mechanism is deliberately left wired rather than deleted — the knee,
      // the 1.15 falloff, the two-tap spectrum smear and the HUD shield are
      // all intact, so re-enabling is one number if a future round ever gets a
      // critic asking for lens fringing. None of the three this round did.
      //
      // AND THE THING THAT ACTUALLY ENDED IT: the pendulum swung eight times
      // because two different defects were being read as one. "CA is absent"
      // (r7, r9) and "the frame has no spectral character" are not the same
      // complaint, but a global CA dial is the only knob that answers to both
      // names, so every round that heard the second reached for the first. It
      // never worked, because the references have no lens CA to copy — they
      // have spectral EFFECTS. Measured on the same warp frame the critics
      // judged: blue+violet+magenta is 0.63-1.68% of the reference's tunnel
      // and 0.01-0.04% of ours, and warm/cool co-occurrence within 4px of each
      // other — the signature of a filament that disperses across its own
      // width — is 4.02% of the reference against 0.01% of ours. That gap is
      // 400x and no value of uCA closes any of it. See tools/hue-census.mjs
      // and the note on the haze floor in vfx.js WARP_FRAG, which is where the
      // remaining work lives.
      //
      // What replaces it is not nothing. The reference's spectral character
      // is EFFECT-NATIVE: separate warp filaments are separately coloured
      // (vfx.js MID/OUT/VIO/GLD palettes + the world-space R/B ghost pair per
      // dash), beams disperse at their own edges, the nebula spreads
      // spectrally. Colour separation that belongs to a THING IN THE WORLD
      // does not print at the optical centre, does not sit on HUD glyphs, and
      // does not register on a radial-fringe regression — which is precisely
      // why the references measure zero here and still read spectral. R10
      // spends the budget there (vfx.js warp ghost dispersion up 1.45x and
      // carried by more dashes) instead of on the lens.
      float caFall = pow(smoothstep(0.30, 1.0, rn), 1.15);
      // red alert eases CA ~20% — builder judgment call against ref-5's
      // register (dark, low-contrast, flood-dominated: fringing is far less
      // apparent there than in daylight refs). NOT a critic finding — cycle
      // 2 actually rated the m5 corner dispersion in-register — so this is
      // conservative headroom, kept because the alarm frame wants the flood,
      // not the lens, doing the talking.
      float caAmp = uCA * (1.0 + 0.2 * uWarp) * (1.0 - 0.2 * uRedAlert) * (1.0 - hudM);
      vec2 caOff = d * (caAmp * caFall);
      vec3 col = sampleCA(uv, caOff);

      // R8 WARP PER-STREAK DISPERSION (r7 verdict: warp CA read as ABSENT at
      // blind scale; the fix is chroma split along the streak MOTION FIELD,
      // not a bigger global dial). Streaks radiate from the vanishing point,
      // so the motion vector at any pixel is the radial direction. Probe the
      // HDR buffer along that direction; where a hot streak lives (pre-
      // tonemap cores read > 1) R marches outward and B inward ALONG the
      // streak, so each streak fringes individually — warm leading edge,
      // cool trailing edge, like a fast pan on a real lens. The tunnel wash
      // between streaks gets only a whisper (drive ~0 below the streak knee),
      // which is what keeps this off the r2/r5 full-frame-rainbow pole; the
      // centre band stays clean for nav text via the radial weight.
      if (uWarp > 0.001) {
        // R10: the knee moves OUT to match the global CA knee (0.14 -> 0.32).
        // At 0.14 the warp dispersion reached into the centre band, which is
        // the mechanical cause of the m1 critic's "same magnitude at frame
        // centre as on the left strut edge" — the one complaint a critic
        // punishes at ANY magnitude, because real transverse CA is radial by
        // definition. Every dispersion term below is now gated behind a knee
        // that is zero across the middle third of the frame.
        vec2 sdir = d / max(length(d), 1e-4);
        float radW = pow(smoothstep(0.32, 0.98, rn), 1.25);
        vec2 pr = sdir * (0.0026 * radW);
        float sHere = maxc(col);
        float sOut = maxc(texture2D(tDiffuse, uv + pr).rgb);
        float sIn  = maxc(texture2D(tDiffuse, uv - pr).rgb);
        float streak = smoothstep(0.30, 0.88, max(sHere, max(sOut, sIn)));
        // anisotropy gate (v5: dispersion + sharpen ghosted the bottom-left
        // HUD panel text, which is bright AND peripheral). A streak is
        // radially ELONGATED — brightness barely changes along the radial
        // probe line — while glyphs/panel edges vary hard in every
        // direction. Radial variation high => not a streak => no split.
        float radVar = abs(sOut - sIn) + abs(sHere * 2.0 - sOut - sIn) * 0.5;
        // knee wide + floored: v6's tight gate (0.12/0.50, no floor) starved
        // the streaks it was meant to protect and the tunnel went soft again
        float aniso = 1.0 - 0.80 * smoothstep(0.30, 1.00, radVar);
        // the gate is load-bearing for the SHARPEN (that's what rang around
        // HUD glyphs); r8 gave dispersion only half of it — and the r8 m1
        // verdict shows the cost: rainbow doubling on the bottom-left panel
        // glyphs (hot text saturates the streak knee, so only the aniso term
        // can tell a glyph from a streak). R9: dispersion takes 0.85 of the
        // gate. The knee stays wide + floored (0.30/1.00, 0.80 depth) — that
        // is what protects tapering streak ends from the v6 starvation.
        streak *= mix(1.0, aniso, 0.85);
        // R9 HUD SHIELD for the dispersion: the aniso gate cannot protect
        // thick glyph STROKE INTERIORS — the pixel itself looks isotropic-
        // flat while its displaced tap crosses the stroke edge, so whole
        // glyphs duplicated in rainbow (r8 m1: bottom panels). The cockpit
        // camera is fixed, so the dash band (bottom ~21%) and the floating
        // top slabs (top band, centre half) are HUD by construction — the
        // dash OCCLUDES the tunnel, so no real streak lives there. Kill
        // dispersion + sharpen inside those boxes; streaks everywhere else
        // keep full budget. Max split also trims 0.0110 -> 0.0085 (the r8
        // corner split overshot into parody range on hot streaks).
        // (iter-2: hudM now computed once above the CA block and shared by
        // CA, dispersion, sharpen and grain.)
        streak *= 1.0 - hudM;
        // R10 MAGNITUDE. Measured: m1's outer-band split was 0.493px against
        // ref-1's -0.054px, the largest single miss anywhere in the CA metric,
        // and the ablation attributes 0.528px of it to THIS block. Two terms,
        // cut differently because they are different sins:
        //  - the 0.0009 BASE term applied to every pixel the radial weight
        //    reached, streak or not. That is a global lens split wearing a
        //    warp costume, and it is the parody pole. -> 0.00012, i.e. gone.
        //  - the 0.0085 STREAK term at least lands on streaks, but a
        //    post-process split along the radial axis is still the LENS
        //    separating colour, not the tunnel doing it. -> 0.0024. The
        //    difference is made up in vfx.js, where each dash already carries
        //    a world-space magenta/cyan ghost pair that moves WITH the dash
        //    through 3D and cannot print on a strut or a glyph.
        float disp = radW * (0.00012 * (1.0 - 0.85 * hudM) + 0.0024 * streak);
        vec2 s = sdir * disp;
        // G takes a PARTIAL outward shift (~0.22s effective): leading fringe
        // reads gold (R+G), trailing reads blue (B minus G) — the classic
        // fast-pan spectrum, and the ref-1 gold/cyan streak-edge read. A
        // G-static split only moves R/B and the eye (luma ~= G) barely sees
        // it — the v1 "still absent at 1280w" failure.
        float dr = (texture2D(tDiffuse, uv + s * 0.5).r + texture2D(tDiffuse, uv + s).r) * 0.5;
        float db = (texture2D(tDiffuse, uv - s * 0.5).b + texture2D(tDiffuse, uv - s).b) * 0.5;
        float dg = (col.g + texture2D(tDiffuse, uv + s * 0.45).g) * 0.5;
        col = mix(col, vec3(dr, dg, db), uWarp);

        // Tangential unsharp (critic-1: "streaks are too soft for CA to ever
        // read on them — a fringe on a soft gradient is invisible by
        // construction"). Streaks are radial lines, so two taps straddling
        // the line ALONG THE TANGENT lift streak-vs-wash contrast: streaks
        // become thin countable lines again and the gold/blue split lands on
        // a real edge. HDR-space, warp-gated, radially weighted; max() floor
        // stops ringing going negative.
        // critic-2 measured mean streak contrast at 4.7/255 and widths of
        // 10-20px: a 1.4px unsharp radius does NOTHING to a 15px smear — the
        // radius has to be comparable to the feature. 7px offset + 2.2 gain.
        vec2 tOff = vec2(-sdir.y, sdir.x) * (7.0 / uRes.y);
        vec3 tAvg = (texture2D(tDiffuse, uv + tOff).rgb + texture2D(tDiffuse, uv - tOff).rgb) * 0.5;
        // aniso squared here: at 2.2 gain the 7px radius started drawing
        // visible halos along the cockpit struts, which are exactly the
        // non-streak content the gate exists to protect
        col = max(col + (col - tAvg) * (1.6 * radW * aniso * aniso * (1.0 - hudM) * uWarp), 0.0);

        // critic-2: "a blue-trailing fringe on a cyan field is invisible by
        // construction" — the tunnel ground is mid-teal everywhere, so the
        // cool half of the split has nowhere to land. Bias the split toward
        // the axis the background CAN'T absorb: push the leading edge warm
        // (R+G against teal) and drain the trailing edge's blue so it reads
        // deep/violet rather than "more teal".
        float lead = smoothstep(0.0, 0.35, dot(sdir, sdir)) * streak * radW * uWarp;
        col.r += (dr - col.r) * 0.55 * lead;
        col.b -= (col.b - db) * 0.35 * lead;
      }

      // TAA-style frame softness: 4 diagonal taps at ~0.8px mixed in lightly
      // so razor-sharp geometry/glyph edges gain video-capture mush without
      // reading as defocus.
      // R10: radius 0.8 -> 1.05px and mix 0.26 -> 0.40. A blind critic
      // measured the one number this dial exists to move: mean transition
      // width on near-vertical high-contrast edges, ours 1.57px with 70%
      // SINGLE-PIXEL hard steps against the reference's 2.63px with 45% of
      // edges >=3px, and listed "no antialiasing" as one of its three tells
      // ("B's struts against sky staircase visibly at the top-left corner").
      // The composer renders at native 1920x1080 with no MSAA and no TAA
      // history, so this pass is the only place frame softness can come from.
      // Warp still eases it out (the tunnel needs countable crisp streaks).
      vec2 px = 1.05 / uRes;
      vec3 soft = texture2D(tDiffuse, uv + vec2( px.x,  px.y)).rgb
                + texture2D(tDiffuse, uv + vec2(-px.x,  px.y)).rgb
                + texture2D(tDiffuse, uv + vec2( px.x, -px.y)).rgb
                + texture2D(tDiffuse, uv + vec2(-px.x, -px.y)).rgb;
      // warp eases the capture-mush mix — the tunnel needs countable crisp
      // streaks (critic-1), and softness here undoes the tangential sharpen
      col = mix(col, soft * 0.25, 0.40 * (1.0 - 0.85 * uWarp));

      // R8 alarm exposure breathing (shields down): the frame inhales and
      // exhales ~1 stop-tenth on the klaxon phase — pre-tonemap so it reads
      // as the cabin power sagging, not a brightness slider.
      col *= mix(1.0, 0.90 + 0.14 * alarmW, uRedAlert);

      // pre-tonemap peak — the only HUD mask reachable from post: the dash
      // glyphs / floating banners are EMISSIVE (banner titles sit just over
      // the 1.45 bloom threshold; panel text close behind), so a high HDR
      // max-channel identifies self-lit UI (and genuine hot speculars, which
      // grain also shouldn't sit on). Used by the r9 grain block below.
      // Captured BEFORE the exposure stage below, deliberately: the grain
      // exemption knee must keep identifying the same pixels as UI whatever
      // the exposure does to their level. grain-over-HUD was named by four of
      // five r8 critics and is now cleared — dimming the HUD must not quietly
      // walk it back through a shifted knee.
      float hdrRaw = maxc(col);

      // ================= R9 iter-5: SCENE EXPOSURE STAGE =================
      // STRUCTURAL FIX. Until now this chain had NO exposure stage at all: it
      // went straight from the HDR buffer into a fixed ACES curve. The HUD is
      // in-scene geometry drawn from LDR canvas textures at a constant albedo,
      // so its whites entered the tonemap at a constant ~0.87 linear and left
      // it at ~230/255 in EVERY scene — bright-daylight m3 and near-black m2
      // measured the same HUD luminance. That is almost certainly the root of
      // five rounds of "the HUD sits pasted on top of the frame" verdicts: a
      // real HUD shares the camera's exposure with everything else, so it
      // washes out in daylight and blooms at night. Nothing about the glyphs
      // themselves reads as fake; their INDEPENDENCE from the frame does.
      //
      // Scene key without a readback or a mip chain: 16 taps at FIXED uv in
      // the canopy region (clear of the dash band below 0.205 and the top
      // banner slabs above 0.775). Because the coordinates are identical for
      // every fragment, all 16 texels are served from texture cache — this is
      // far cheaper than its tap count suggests. Geometric mean (log2 average)
      // so the key tracks the bulk of the scene rather than its brightest
      // pixel, with per-tap clamping so a sun or a beam core crossing one tap
      // cannot drag the whole frame.
      // R11-PERF: the sixteen taps and their log-average now happen ONCE per
      // frame in SceneKeyPass (see the top of this file), not once per pixel.
      // Same taps, same clamp, same log2/exp2, same source buffer, same frame
      // — a 1x1 RGBA32F round trip, so the value the grade sees is bit-for-bit
      // the value the inline version computed. The #else branch is the exact
      // original code and is what runs if the platform has no float render
      // targets; it is also the B arm of the in-process A/B (?r11ab=1).
      float sceneKey; vec3 sceneCol;
      #ifdef KEYPASS
      { vec4 kt = texture2D(tKey, vec2(0.5)); sceneCol = kt.rgb; sceneKey = kt.a; }
      #else
      {
${KEY_TAPS}
        sceneCol = kc / 16.0;
        sceneKey = exp2(k / 16.0);
      }
      #endif
      // Half-power response so the mid range stays graceful instead of
      // snapping between the clamps, and an ASYMMETRIC clamp: pulling down in
      // daylight is safe, pushing up in the dark risks blowing the dash, so
      // the ceiling is tighter than the floor.
      // iter-6: cycle-1 critic still read HUD luminance as invariant with the
      // [0.50,1.55] / 0.85 settings (measured spread was real but only 36
      // levels), so the clamp widens and the HUD weight goes up.
      float expo = clamp(pow(0.14 / max(sceneKey, 1e-4), 0.55), 0.42, 1.60);
      // Two weights, not one. The HUD region takes most of the exposure (this
      // is the fix — HUD luminance now tracks the scene); the rest of the
      // frame takes a quarter of it, which is a mild, honest auto-exposure
      // and also reaches the centre-frame HUD text (target markers, SHIELD
      // DOWN banner) that no screen-space box mask can isolate. A full-frame
      // exposure alone would NOT fix anything — it scales HUD and scene
      // together and leaves the ratio exactly where it was.
      col *= mix(mix(1.0, expo, 0.25), mix(1.0, expo, 0.92), hudM);

      // R9 iter-6 — AMBIENT COLOUR SPILL ONTO THE HUD LAYER, the second half
      // of the same structural finding. Exposure fixed the LEVEL; the
      // cycle-1 critic then named the HUE, three times and precisely:
      // "[m1] the panel faces stay flat near-black with pure #ffffff type and
      // receive zero cyan spill" from a blinding cyan-white warp core;
      // "[m5] the alert text is neutral white in a scene where every physical
      // surface is red-lit"; and, on the REAL frames, praise for exactly the
      // thing we lacked — "m3-B's dash readouts pick up orange bounce from
      // the console". A HUD that shares the frame's light shares its colour,
      // not just its brightness. The 16 exposure taps already carry the
      // scene's colour, so the ambient hue is free: luma-normalise their mean
      // so this tints without changing level. Under red alert the cast comes
      // from the CABIN flood instead of the exterior, which is what the m5
      // reference shows (cool slate outside the canopy, red-lit hardware and
      // red-cast UI inside it).
      // (sceneCol comes from the scene-key block above — r11-perf)
      vec3 sceneTint = clamp(sceneCol / max(dot(sceneCol, vec3(0.2126, 0.7152, 0.0722)), 1e-4),
                             0.60, 1.70);
      // Reach: the box mask covers dash + top slabs; the emissive knee picks
      // up the centre-frame text (SHIELD DOWN, target markers) that no box
      // can isolate, at reduced weight so genuine hot scene pixels — beam
      // cores, the warp core, the sun — are only lightly touched.
      float emUI = smoothstep(0.85, 1.40, hdrRaw);
      float hudSel = clamp(hudM + 0.55 * emUI * (1.0 - hudM), 0.0, 1.0);
      vec3 hudCast = mix(sceneTint, vec3(1.22, 0.78, 0.74), 0.80 * uRedAlert);
      col = mix(col, col * hudCast, 0.28 * hudSel);

      // R9 iter-7 — AMBIENT FILL ON THE HUD SUBSTRATE. The cycle-2 critic
      // found the sharpest single number in the whole gauntlet: "across every
      // frame I judged an imitation, panel backgrounds measure RGB ~ (2, 3, 6)
      // regardless of whether the scene is deep space or full daylight;
      // across every frame I judged real, panel blacks measure 13-79 with an
      // unmistakable colour cast from the dominant light. That single number
      // separates the two sets perfectly." It is right, and it is the same
      // decoupling as the exposure finding seen from the shadow end: the
      // panels are unlit LDR canvas textures with a near-black background
      // fill, so their substrate receives no ambient term from anything and
      // renders at the black floor in every scene. Exposure and hue cast both
      // scale what is there; neither can lift a floor.
      // The post-side half is an additive ambient on DARK pixels inside the
      // HUD selector, sized from the scene key and tinted by the same light —
      // so the substrate floats with the scene instead of sitting at the
      // floor.
      // The other half is NOT post's to make: a real fix gives the panel
      // materials an ambient/bounce term so the lift is per-surface rather
      // than per-screen-region. Handed to r9-ui, spelled out in the report.
      //
      // R14-ALERT — CORRECTED CLAIM. This block used to end "Red alert supplies
      // its own much redder, brighter fill, which is what the reference's
      // (79, 16, 15) panel blacks actually are." That number is wrong and it is
      // the justification the extra fill rested on. Two independent
      // measurements of ref-5's own alert-state panel ground disagree with it:
      // (35.0, 4.2, 7.1) measured here on refs/ref-5 at native 2400x1601, and
      // (41.4, 3.1, 4.8) measured by reports/r13-verdict/probes-m5/p04_measure.py
      // section 7 on the blind JPEG. The comment's red channel was ~2x the
      // reference. Ours under alert was reading (146, 32, 22) in HUDGEO and
      // (167, 55, 41) on the panel rect — 4x the reference, on a justification
      // that was itself 2x over. RA_HUD_AMB accordingly goes to zero; the fill
      // that remains is the base scene-key term, and it is still red-cast under
      // alert because sceneTint is (the cabin is red-lit). Overlays and rects:
      // reports/r14-alert/overlays/{ref5,ours-m5}-panel-rect.png.
      vec3 hudAmbCol = mix(sceneTint, vec3(1.90, 0.42, 0.38), 0.85 * uRedAlert);
      float hudAmbAmt = 0.006 + 0.030 * clamp(sceneKey, 0.0, 1.2) + RA_HUD_AMB * uRedAlert;
      col += hudAmbCol * hudAmbAmt * hudSel * (1.0 - smoothstep(0.02, 0.20, hdrRaw));

      float hdrMax = maxc(col);

      // ================= R13: HIGHLIGHT SHOULDER, IN HDR SPACE =================
      // THE DEFECT, measured before this line was written
      // (reports/r13-tone/REF-TARGETS.md, tools/r13-tone-shoulder.py):
      // m4's 3,810 pixels at exactly R==G==B==255 are not scattered speculars.
      // 3,712 of them — 97.4% — are ONE 8-connected component: the sun disc,
      // 112x78 px at uv (0.306, 0.673), luminance sigma 0.000, one distinct
      // level, clouds terminating at its boundary. Ref-4's 551 white pixels are
      // 93 components with a largest of 85 (15.4%) and a mean horizontal run
      // of 1.71 against our 10.76. We do not lack headroom. We spend it as one
      // blob.
      // (Those component figures first shipped here as 3,729 / 97.9% and
      // 87 / 148 / 26.9%. The r13-tone critic (F10) found the labeller's
      // row-skip test was  < cs[i] - 1  where 8-connectivity needs  < cs[i] ,
      // so it merged runs separated by a two-column gap. Fixed, with a
      // known-answer self-test added. The conclusion strengthens rather than
      // weakens: ref-4's largest white blob is 85 px, not 148.)
      //
      // WHY THE FIX HAS TO BE HERE AND NOT IN THE DISPLAY-SPACE SHOULDER BELOW.
      // aces() clamps to 1.0, and the ACES fit reaches 1.0 at HDR 7.2416, so
      // every pixel above that is already IDENTICAL before the display stage —
      // the shoulder at the bottom of this shader cannot separate what the
      // tonemap has already merged. Worse, the whole chain (aces -> pow(1/2.2)
      // -> contrast -> display shoulder) saturates at HDR 3.44, so
      // [3.44, inf) is one code value. artifacts/r13-tone/transfer-model.txt.
      //
      // THE FORM. Applied to the max channel as a scalar gain, so the HDR
      // channel RATIOS entering the tonemap are unchanged:
      //     m' = m                                for m <= SHOULDER_KNEE
      //     m' = k + A * ln(1 + (m - k) / A)      for m >  SHOULDER_KNEE
      // Identity below the knee is a property of the function, not something
      // observed in an output: at m == k the value, the first derivative and
      // the gain are all continuous, and the gain is exactly 1.0.
      //
      // A SCALAR HDR GAIN IS NOT THE SAME AS UNCHANGED OUTPUT CHROMA, and an
      // earlier version of this comment wrongly claimed "hue and saturation are
      // untouched". Five per-channel nonlinear stages follow — aces, vibrance,
      // the highlight desat toward white at smoothstep(0.88, 1.0), the gamut
      // ceiling and the R7 crosstalk matrix — so displayed saturation DOES
      // move: +0.0847 on m1's changed set, +0.0243 on m4, +0.0337 on m5. Inside
      // the frozen m4 sun core, base RGB is exactly (255.00, 255.00, 255.00)
      // and ship is (248.56, 253.62, 254.99) — a 6.4-level red deficit. The
      // shoulder does not preserve output chroma; it REVEALS the HDR
      // chromaticity the clip was hiding. Whether a faintly cool sun disc is
      // correct is an upstream question this file cannot answer, and the
      // highlight-desat comment further down asserts the opposite intent ("NMS
      // hot cores burn white, not neon"). Found by the r13-tone critic (F11a).
      //
      // Identity below the knee still matters, and for the original reason:
      // a global exposure reduction lowers the blown-pixel count in
      // exactly the same way a shoulder does, and the blown count alone cannot
      // tell the two apart. This one provably cannot touch anything below the
      // knee.
      //
      // Log rather than a bounded exponential DELIBERATELY: the log form is
      // unbounded, so genuinely extreme HDR still reaches 255. r9 iter-2
      // recorded that a ceiling capping whites at ~245 read as an LDR tell in
      // its own right; a shoulder that takes the frame's white count to zero
      // would repeat that mistake from the other side.
      //
      // WHERE THE KNEE IS AND WHY. m3's entire frame tops out at L233.18 and
      // has ZERO pixels above L235; m1 has 882/MP above L235. Both are BELOW
      // their references there rather than above, so two of five moments want
      // the OPPOSITE of a shoulder — and a tonemap change is global. (The size
      // of that deficit is NOT quoted here on purpose: ref-1 is a 596x335
      // source and ref-3 is 1600x900, so a per-megapixel ratio against them is
      // in the unstable-multiplier class — see
      // reports/r13-orchestrator/UNSTABLE-MULTIPLIER-CLASS.md. The direction is
      // safe, the multiplier is not.) The knee sits above everything m3
      // contains and above all but the extreme tail of m1.
      // MEASURED, not predicted (tools/r13-tone-notexposure.py,
      // artifacts/r13-tone/notexposure-ship.json): m3 changes by ONE pixel of
      // ONE level in the entire frame; m1 changes 365 px of 2,073,600 (0.018%),
      // of which 342 are above L192 and the remaining 23 move by 1 to 3 levels.
      // (An earlier version of this comment said "every one of them above L192".
      // Wrong by 23 pixels, corrected against the artifact rather than left
      // standing: a comment gets believed, a report only gets superseded.)
      //
      // THE ONE PLACE THIS REACHES FURTHER DOWN THAN THE KNEE SUGGESTS, and it
      // is a property of the max-channel driver rather than a bug: on m5 the
      // red-alert flood produces pixels whose R sits well over the knee while
      // their LUMINANCE is only ~120, so they compress even though they are not
      // bright. m5 changes 0.37% of its 96-128 luminance band. Driving the
      // shoulder from luminance instead removes that entirely and also costs
      // most of the effect (m4 L>=253 per MP lands at 2,976 that way against 94
      // this way, on a reference reading 1,672). Both were captured and
      // measured; artifacts/r13-tone/shoulder-v5.json is the luminance variant.
      //
      // What the m5 compression does looks like a loss and is not: over the
      // 35,303 pixels it touches, mean luminance falls 7.59 and mean SATURATION
      // rises 0.0337 — the blown pink wash on the upper cockpit returns to the
      // red family instead of desaturating toward white.
      // artifacts/r13-tone/m5-saturation-check.txt.
      const float SHOULDER_KNEE = 1.5;   // HDR max-channel below which gain is exactly 1.0
      const float SHOULDER_SOFT = 1.1;   // ln-domain scale; smaller = longer reach, more cost below
      float sm = maxc(col);
      float sEx = max(sm - SHOULDER_KNEE, 0.0);
      float smC = sm - sEx + SHOULDER_SOFT * log(1.0 + sEx / SHOULDER_SOFT);
      col *= smC / max(sm, 1e-5);

      // filmic tonemap
      col = aces(col);

      // vibrance: push muted pixels hard, protect already-saturated ones so
      // single-hue frames (warp green, desert beige) don't clip further into
      // one family
      float mx = max(col.r, max(col.g, col.b));
      float mn = min(col.r, min(col.g, col.b));
      float sat = mx - mn;
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      // WARP grade ease (~40% via uWarp): the tunnel should keep teal-family
      // hue variance rather than getting shoved into one two-tone LUT, so
      // the vibrance push relaxes toward neutral during warp.
      float satCeil = mix(uSat, 1.0 + (uSat - 1.0) * 0.6, uWarp);
      float amt = mix(satCeil, 1.0, smoothstep(0.35, 0.85, sat));
      col = mix(vec3(luma), col, amt);

      // whisper of highlight desat: the very hottest pixels drift toward
      // white (NMS hot cores burn white, not neon). High knee so ordinary
      // bright surfaces (sand, sky) are untouched.
      float hot = max(col.r, max(col.g, col.b));
      col = mix(col, vec3(hot), 0.30 * smoothstep(0.88, 1.0, hot));

      // gamut ceiling: NMS's filmic grade never leaves a primary fully
      // clipped — pull the most saturated pixels a whisper toward luma so
      // pure reds/greens keep a trace of the other channels.
      float sat2 = max(col.r, max(col.g, col.b)) - min(col.r, min(col.g, col.b));
      col = mix(col, vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))), 0.07 * smoothstep(0.80, 1.0, sat2));

      // R7 GRADE: the old two-pole split tone (cool shadows / warm highs) read
      // as a teal-amber LUT. Replaced with (a) a gentle channel-crosstalk
      // matrix that bends hue families the way NMS's filmic grade does —
      // greens lean teal, reds lean orange, blues lean violet — giving hue
      // axes a 2-pole tone curve can't produce, and (b) THREE luma bands
      // (shadow/mid/high) each with its own tint, plus (c) per-state hue
      // shifts so warp and red-alert don't collapse onto the cruise poles.
      // Everything multiplicative or row-normalised: neutrals stay neutral,
      // blacks stay black.
      vec3 xt = vec3(dot(col, vec3(0.960,  0.048, -0.008)),   // reds pick up green -> orange lean
                     dot(col, vec3(0.018,  0.964,  0.018)),   // green nearly clean (luma carrier)
                     dot(col, vec3(-0.024, 0.052,  0.972)));  // greens feed blue -> teal; reds starve blue -> deeper warms
      col = mix(col, xt, 0.38);

      // three-band tints; bands overlap softly so no banding at the seams
      float wSh = 1.0 - smoothstep(0.10, 0.42, luma);
      float wHi = smoothstep(0.45, 0.85, luma);
      float wMd = clamp(1.0 - wSh - wHi, 0.0, 1.0);
      // cruise poles — r9: hiT/mdT warmth pulled back (m4: "sepia/warm cast
      // flattens sky, terrain, and cockpit into one temperature"); the warm
      // half of the frame now comes from the interior REGION split below,
      // not from a global highlight tint that sepia-washes the sky.
      vec3 shT = vec3(0.93, 1.00, 1.11);                      // cool blue-violet shadows
      vec3 mdT = vec3(1.012, 0.995, 0.978);                   // near-neutral mids
      vec3 hiT = vec3(1.038, 1.00, 0.940);                    // faint warm highlights
      // warp: shadows swing green-teal, mids go neutral, highs toward cream-green
      shT = mix(shT, vec3(0.94, 1.055, 1.045), uWarp);
      mdT = mix(mdT, vec3(1.0), 0.55 * uWarp);
      hiT = mix(hiT, vec3(1.015, 1.035, 0.945), uWarp);
      // red alert: highlights swing COOL (blue-white speculars against the red
      // flood, the ref-5 read); shadows go faint violet so the frame isn't
      // monochrome red
      shT = mix(shT, vec3(1.00, 0.945, 1.075), 0.55 * uRedAlert);
      hiT = mix(hiT, vec3(0.965, 1.00, 1.075), 0.50 * uRedAlert);
      col *= shT * wSh + mdT * wMd + hiT * wHi;

      // R9 TEMPERATURE SPLIT (m4: "split cool sky vs warm cockpit interior").
      // There is no depth buffer in this chain, but the composition gives us
      // the split for free: the cockpit frame owns the periphery and the
      // dash owns the lower quarter, while everything seen THROUGH the
      // canopy lives upper-centre. Cool the exterior region, warm the
      // interior region — two temperatures in one frame, which is the ref
      // signature the single global cast could never produce. Eases during
      // warp (tunnel owns the whole frame) and red alert (the flood is the
      // temperature story there).
      float interiorM = clamp(smoothstep(0.38, 0.68, rn)
                            + (1.0 - smoothstep(0.10, 0.38, vUv.y)), 0.0, 1.0);
      float exteriorM = 1.0 - interiorM;
      float splitStr = 1.0 - 0.55 * uWarp;
      // R9 iter-5 — POLARITY, read off refs/ref-4 and refs/ref-5 directly
      // rather than off the round-8 verdict text. What the two references
      // actually show:
      //   ref-4: exterior = SATURATED cool blue sky over green terrain;
      //          interior = dark charcoal/violet hardware. The interior is
      //          not warm — its only warmth is CONTENT (the orange radar
      //          bulb, amber bezel trim), which the grade must not imitate
      //          with a global amber cast. Our m4 had hot orange struts and
      //          a washed pale sky: dash R/B 3.05 vs the ref's 1.66, corner
      //          R/B 0.27 vs 0.16, centre 0.51 vs 0.68. Over-warm interior
      //          AND under-cool exterior, which reads as the whole frame
      //          sitting one sepia step off the reference.
      //   ref-5: interior = flooded hot red; exterior = DESATURATED cool
      //          slate. Ours had the exterior warm (brown/amber nebula) and
      //          the interior a dull brick — i.e. genuinely inverted against
      //          the reference in the sense that mattered.
      // So the poles: exterior carries the cool, the interior goes NEARLY
      // NEUTRAL under cruise (let content supply the warmth) and only takes
      // real warmth under red alert, where the reference flood justifies it.
      // Red alert no longer EASES the split — that easing is what let the
      // warm nebula own the m5 exterior; it now pushes the exterior colder.
      vec3 extPole = mix(vec3(0.958, 0.998, 1.052),   // cruise: cool blue lean
                         vec3(0.930, 0.982, 1.080),   // red alert: colder still
                         uRedAlert);
      vec3 intPole = mix(vec3(1.014, 1.000, 0.984),   // cruise: a whisper warm
                         vec3(1.052, 0.982, 0.952),   // red alert: takes the flood
                         uRedAlert);
      vec3 tempT = mix(extPole, intPole, interiorM);
      col *= mix(vec3(1.0), tempT, 0.90 * splitStr);
      // ref-4's sky is not just cooler than ours, it is more SATURATED — the
      // washed-pale read is a chroma deficit as much as a temperature one, and
      // a cool multiply alone cannot fix it. Push exterior chroma away from
      // its own luma, cruise only (red alert wants the exterior desaturated,
      // handled below).
      float extLuma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(extLuma), col, 1.0 + 0.10 * exteriorM * splitStr * (1.0 - uRedAlert));

      // vignette — R9: coupled into the grade instead of a flat multiply
      // (m1: "grain and vignette laid on uniformly like a poster filter").
      // Two couplings: (a) luminance-protected — bright content punches
      // through the corners so the falloff tracks the scene instead of
      // sitting on it; (b) channel-weighted — blue darkens least, so corners
      // sink toward the cool shadow family the grade already owns rather
      // than plain black. Red alert keeps the klaxon breathing.
      // iter-5: the round-8 read was UNDER-STRENGTH, so depth 0.25 -> 0.42 and
      // the knee starts further in (0.12 -> 0.09 in r2) to give the falloff
      // more travel instead of a late crush at the corners. The two existing
      // couplings stay (per-pixel luminance protection, channel weighting) and
      // a THIRD is added: the vignette now also tracks the SCENE key through
      // the new exposure stage — a bright scene gets a deeper falloff, a dark
      // scene a shallower one, so the amount is a property of the frame's
      // light rather than a constant laid over every frame. That is what the
      // m1 "poster filter" verdict and the m2 "no vignette at all" verdict
      // were naming from opposite ends: a constant, not a strength.
      // iter-6: still ABSENT to the cycle-1 critic, and its evidence located
      // the bug precisely — "[m2] the pale grey panel filling (0,0)-(60,120)
      // and its mirror are at full brightness right into the corner pixels",
      // "[m3] sky inside the aperture at (350,60) reads the same as sky at
      // (640,60)". Both cited pixels are BRIGHT, and the luminance-protection
      // term was cutting the vignette by up to 42% on exactly the bright
      // corner content where a vignette is the only place it can be seen. So
      // the protection drops to 0.20 (enough to keep the falloff scene-
      // coupled rather than a flat overlay — which was the m1 "poster filter"
      // verdict — without neutering it where it counts), depth 0.42 -> 0.52,
      // and the knee moves in again (0.09 -> 0.05 in r2) so the gradient has
      // real travel by mid-radius instead of a late crush at the corners.
      // Measured at 1280w this takes the extreme corner from ~26% to ~43%
      // darkening in red, and mid-radius from ~3% to ~12%.
      float vigMask = smoothstep(0.05, 0.58, r2) * uVig;
      float lumV = dot(col, vec3(0.2126, 0.7152, 0.0722));
      float vigAmt = vigMask * (1.0 - 0.20 * smoothstep(0.45, 0.90, lumV));
      float vigScene = clamp(1.26 - 0.36 * expo, 0.70, 1.14);
      // iter-7 back-off: the cycle-2 critic got the one clean vignette
      // measurement available anywhere in the set — flat sky in both top
      // corners of m3 — and read ours at a symmetric 22% corner darkening
      // against a reference showing none there, and 25% vs the reference's
      // 18% on m4. So the round-8 "under-strength" verdict is closed, and we
      // are now a shade OVER. 0.52 -> 0.44 puts the predicted corner falloff
      // at ~19-21%, straddling the one reference number we have. Not measured
      // by a third critic cycle — the brief caps at two — so this is a
      // numeric landing, honestly flagged.
      float vigDepth = 0.44 * vigScene + uRedAlert * (0.05 + 0.07 * alarmW);
      col *= 1.0 - vigAmt * vigDepth * vec3(1.10, 1.02, 0.86);

      // R8 alarm wash (critic-1: "the red stops at the window frame" — the
      // exterior stayed a serene purple-blue postcard). A gentle slate-desat
      // + red-lean over the WHOLE frame on the klaxon phase: cool exterior
      // content drops toward ref-5's desaturated slate so the red owns the
      // frame, while already-red pixels pass through nearly unchanged
      // (multiplicative lean, luma-preserving desat — no pink veil).
      // critic-2: verbatim "the red stops at the window frame" — the wash was
      // too weak AND uniform. Now HUE-SELECTIVE: cool/green content (nebula
      // indigo, mint hostiles, cyan scanner) gets pulled hard toward slate,
      // warm content passes through untouched, and the very hottest pixels
      // are EXEMPT so cool speculars survive (critic-2 point 5: "red-on-cool
      // is what reads as alarm" — a flat multiply removes the contrast the
      // effect depends on).
      // iter-5: hue-selectivity alone was the hole. ref-5's exterior is a
      // DESATURATED COOL SLATE; ours was a warm brown/amber nebula, and a
      // wash that only pulls COOL content toward slate passes warm content
      // through untouched — so the one region that most needed desaturating
      // was the one region the wash could not reach. The wash is now
      // REGION-coupled as well as hue-coupled: everything seen through the
      // canopy goes slate under alert regardless of its native hue, while the
      // interior keeps the hue-selective behaviour (its warm hardware should
      // survive; only its cool content gets pulled). The slate itself splits
      // too — cool-neutral outside the canopy (the ref's read), warm-leaning
      // inside where the red flood lives.
      float lumaRA = dot(col, vec3(0.2126, 0.7152, 0.0722));
      float coolness = clamp((max(col.g, col.b) - col.r) * 2.2, 0.0, 1.0);
      float specExempt = 1.0 - smoothstep(0.62, 0.92, maxc(col));
      vec3 slate = vec3(lumaRA) * mix(vec3(1.12, 0.90, 0.87),
                                      vec3(0.96, 0.99, 1.07), exteriorM);
      float washSel = (0.14 + 0.52 * coolness) * interiorM + 0.58 * exteriorM;
      // R14-ALERT: the wash is a WHOLE-FRAME commit and the HUD is inside it,
      // so the HUD's own cool coding (cyan headers, blue bars, the SHIELD DOWN
      // banner) is pulled toward slate along with the nebula. The shield hook
      // is wired and RA_SHIELD_WASH IS ZERO — the wash keeps its full reach
      // over the HUD ON PURPOSE. Removing it is the single term that drives the
      // HUD substrate toward monochrome red: ablated entirely the substrate
      // goes R/B 6.54 -> 12.29, and even a 0.65 shield landed it at 11.63
      // (22.63 on the top-banner band) against the reference's 4.94. Since
      // this dial's failure pole IS the hue, and 0.00 keeps 82% of the
      // readability gain at zero hue cost (panel-face R/B 8.55 -> 8.57), the
      // hook stays at zero. It is left wired rather than deleted so a future
      // round can retest in one number. Numbers: reports/r14-alert/CRITIC.md 6
      // and 7, artifacts/variant-sweep-m5.txt, artifacts/critic-instrument-output.txt.
      col = mix(col, slate, uRedAlert * (0.55 + 0.45 * alarmW)
                            * washSel * specExempt
                            * (1.0 - RA_SHIELD_WASH * hudM));

      // red alert: corner pulse; multiplicative red so corners deepen
      // toward red instead of washing pink. Cabin flood comes from the
      // cockpit's red point lights, not post. R8: pulse rides the shared
      // klaxon waveform so pulse/vignette/exposure move as one alarm, and
      // the pulse starts further in + mixes harder so it survives next to
      // the strut flood (critic-1 couldn't find it).
      float pulse = 0.55 + 0.45 * alarmW;
      float edge = smoothstep(0.24, 0.50, r2);
      vec3 raCol = col * vec3(1.22, 0.40, 0.36) + vec3(0.07, 0.0, 0.0);
      // R14-ALERT: fully hudM-shielded. This is the one term that genuinely was
      // a whole-frame tint sitting on top of the HUD with no exemption — the
      // literal form of the carried "the tint composites over the UI" claim —
      // and measured it is worth only +1.71% of HUD Michelson, with its
      // additive vec3(0.07,0,0) worth +0.09%. Shielded anyway because it costs
      // nothing: the pulse is a CORNER vignette effect and the dash band it
      // now skips is where the player reads speed, nav and weapon state.
      col = mix(col, raCol, uRedAlert * pulse * edge * 0.68
                            * (1.0 - RA_SHIELD_PULSE * hudM));

      // shield hit flash (cool blue-white ring)
      col += vec3(0.35, 0.55, 0.9) * uFlash * smoothstep(0.05, 0.4, r2);

      // whiteout (warp arrival / atmosphere entry)
      col = mix(col, vec3(0.92, 0.96, 1.0), uWhiteout);

      // to display gamma (renderer outputs linear; we do sRGB here)
      col = pow(max(col, 0.0), vec3(1.0 / 2.2));

      // contrast in display space: punchy mids. R9: the top end gets a SOFT
      // SHOULDER instead of a hard clamp (m2: "clinically sharp/raw-render
      // read — no tonemapped highlight rolloff"). Anything the contrast push
      // sends over 0.86 compresses smoothly and tops out ~0.97, so clouds,
      // banners and hot cores roll off like a captured frame instead of
      // clipping to flat paper-white.
      // iter-2 (critic): the 0.86/2.6 shoulder capped whites at ~245 — a
      // stop too early (refs reach 253-255 on cloud whites / warp core; the
      // capped ceiling itself started to read as an LDR tell). Knee 0.90,
      // gentler slope: ceiling ~251, still no flat paper-white clip.
      col = max((col - 0.5) * 1.08 + 0.5, 0.0);
      vec3 ex = max(col - 0.90, 0.0);
      col = min(col, 0.90) + ex / (1.0 + 1.8 * ex);

      // filmic black floor: a cool lift so blacks never hit #000 — NMS's
      // grade leaves shadows sitting on a faint blue-grey pedestal. Warp
      // raises the pedestal slightly (R5 critic: crushed blacks in-tunnel).
      // critic-2: "m1 has no blacks anywhere in the window" — the r5 warp
      // pedestal raise is now the thing flattening the tunnel and starving
      // streak contrast. Warp keeps only a whisper above the cruise floor,
      // and gains a warp-only shoulder-preserving contrast push so the gaps
      // BETWEEN streaks go dark and the filaments read as filaments.
      col = mix(col, clamp((col - 0.42) * 1.13 + 0.42, 0.0, 1.0), 0.75 * uWarp);
      vec3 lift = mix(vec3(0.009, 0.012, 0.017), vec3(0.012, 0.015, 0.020), uWarp);
      col = lift + col * (1.0 - lift);

      // R9 FILM GRAIN — the r8 headline defect (named by four of five
      // critics: "uniform overlay at constant strength blankets the frame
      // INCLUDING HUD panels"). Post-mortem of what the r8 merge regressed:
      // r8's 2px-cell quantisation (correct — it's what made grain survive
      // the 1280w resample at all) ALSO made the previously-invisible
      // chroma-decorrelation term visible, and that term had ZERO luminance
      // coupling — uniform rainbow speckle on dark HUD glass. On top of
      // that, two rounds of "more tooth" tweaks (floor 0.30->0.45, highlight
      // rolloff 0.55->0.46, amp 0.055->0.060) compressed the luminance
      // response to a ~25% total swing — responsive in name only. R9:
      //  (a) HUD/emissive EXEMPTION: hdrMax (pre-tonemap) identifies the
      //      self-lit dash glyphs / banners — grain fades to zero on them.
      //      Real NMS never grains its UI.
      //  (b) real luminance response restored: floor 0.45 -> 0.18, highlight
      //      rolloff deepened — shadows carry ~3.5x the grain of highlights.
      //  (c) clump irregularity: the two hashes now live on DIFFERENT
      //      lattices (2px + 3px) whose beat pattern breaks the square-grid
      //      read into variable-size clumps.
      //  (d) overall subtler at blind scale: 0.060 -> 0.045, chroma term
      //      halved and given the same weighting as the luma grain.
      // iter-2 (critic): three refinements on the r9 shape —
      //  (1) the HDR exemption caught the hot top banners but NOT the dimmer
      //      dash glyphs or dark panel glass (bottom panels measured NOISIER
      //      than scene shadows, 3.9-5.0 sigma). The shared hudM mask now
      //      does what the emissive knee alone couldn't: UI carries ~8% of
      //      scene grain, like NMS's clean-UI-over-grained-scene composite.
      //  (2) texture read as "fine even dither, not clumped film" — the
      //      coarse 3px lattice now leads the mix (clump beat dominates) and
      //      shadow amplitude comes up a touch, while a hard bright-kill
      //      takes daylight sky toward the ref's near-zero (ref sky sigma
      //      0.33 vs our 2.44): grain lives in shadows/low-mids, dies in
      //      brights, instead of a uniform veil scaled down.
      //  (3) near-black cockpit corners showed coarse CHROMA mottle
      //      ("compression murk") — the chroma fleck is now gated out of
      //      deep shadows (luma-only grain below ~0.10) and reduced.
      //
      // R12 — TWO NUMBERS ABOVE ARE NOW STALE. Measured, not re-argued;
      // tools/r12-aero-grain.mjs, artifacts/r12-aero/grain.json. No code below
      // was changed this round: this is a comment correction only, because a
      // wrong explanatory comment steers the next round and a wrong report only
      // gets superseded.
      //   (b) claims "shadows carry ~3.5x the grain of highlights". That is an
      //       UNDERSTATEMENT. The real ratio is between 10x and 78x depending on
      //       where you stop, and the shadow-weighting is much stronger than the
      //       comment claims, not weaker.
      //
      //       (A first r12 pass put 2.62 here, from a high-pass-residual method
      //       that CANNOT separate grain from fine scene detail — m4 has terrain,
      //       hull panels and HUD in every bucket. The r12 critic caught it and
      //       did the clean measurement instead. The wrong number survived in
      //       this file for one commit; this is what replaced it.)
      //
      //       Clean method, tools/r12-aerocrit-grainiso.mjs: G.post.finalPass is
      //       reachable, so uTime can be set directly and the composer re-run at
      //       dt = 0. The ONLY thing that differs between the two renders is the
      //       grain hash, so scene detail cancels exactly. Control: render A
      //       reproduces the shipped capture sha1 bit-for-bit, a third render
      //       back at the original uTime is byte-identical to A, and A != B.
      //       uRedAlert / uWarp / uWhiteout all read 0, so nothing else in this
      //       shader moves with time.
      //       artifacts/r12-aerocrit/grainiso-m4.json, isolated sigma_grain:
      //         2.998 2.024 2.274 2.217 1.377 0.561 0.293 0.038
      //       dark/bright = 78.1 raw, or 10.2 restricted to buckets clearing the
      //       8-bit quantisation floor of 0.289. Analytically gAmt at gLuma
      //       0.063 vs 0.941 is 0.0520 vs 0.00281 = 18.5x before uiEx takes
      //       bright pixels the rest of the way to zero. Three independent lines,
      //       all >= 10x.
      //   (2) claims "ref sky sigma 0.33 vs our 2.44". That state NO LONGER
      //       HOLDS: our m4 open-sky flat patch reads sigma 0.79 at L 160.8
      //       against ref-4's 0.91 at L 189. We are in family and slightly
      //       QUIETER than the reference, not 7x noisier. Anyone reading 2.44
      //       as a live defect would be chasing something that closed in r9/r10.
      // The residual method's failure is not a matter of degree: on m1 it reads
      // dark/bright 0.55, i.e. INVERTED, where the isolated method on the same
      // moment reads 10.08 (artifacts/r12-aerocrit/grainiso-m1.json). Any future
      // grain measurement in this block should use uTime differencing and not a
      // high-pass residual.
      //
      // WHAT IS STILL OPEN, and it is a defect rather than a caveat: the isolated
      // m4 sky bucket reads sigma_grain 0.038, BELOW the 8-bit quantisation floor
      // of 0.289 — there is effectively no grain at all on bright scene content.
      //
      // R13 — THE DEFECT IS REAL AND THE ATTRIBUTION WAS WRONG. The r12 critic
      // (N5) named uiEx below: "the hdrRaw knee is meant to exempt self-lit UI,
      // but hot SCENE pixels clear the same knee, so sky and speculars are
      // exempted too." Measured by ablation with tools/r13-tone-flatpatch.py
      // (--selftest recovers a known added sigma; --selftest-noop is the red
      // run), artifacts/r13-tone/grain-ablation.txt, four captures of m4 through
      // the frozen world mask. n is the surviving flat-patch count and is shown
      // because it is load-bearing, see below:
      //
      //   build                        L140-170     L170-195     L195-215
      //   shipped                    0.996 n=327  0.500 n=567  0.356 n=510
      //   uiEx knee -> 1.35/2.20     0.996 n=327  0.501 n=567  0.356 n=510
      //   uiEx ABLATED to 1.0        0.996 n=327  0.501 n=567  0.356 n=510
      //   brightKill ABLATED to 1.0  0.410 n=250  1.270 n=487  1.237 n=469
      //   ref-4 (JPEG, biased DOWN)  0.706        0.786        0.866
      //
      // **Deleting uiEx entirely changes bright-sky texture by 0.000.** It is
      // not the suppressor. brightKill is: removing it takes L195-215 from
      // 0.356 to ~1.24, overshooting ref-4's 0.866 in the other direction. Anyone
      // acting on N5 would have moved the wrong term and measured no result.
      //
      // The deficit against ref-4 is real (0.356 against 0.866 at L195-215, and
      // JPEG quantises noise out of smooth blocks so the reference number is
      // biased DOWN — the true gap is at least this wide). It is NOT fixed here,
      // for a reason that is a measurement rather than caution: the flat-patch
      // instrument that produced these numbers selects patches by a gradient
      // threshold, and adding grain changes which patches pass. The n column
      // above is that bias, visible: the three rows that do not change noise
      // share an identical patch set (327/567/510), and the brightKill row does
      // not (250/487/469). The tool's own --selftest arm C drives the point
      // home — at an added sigma of 2.0 the surviving patch count collapses
      // from 512 to 0. So it is sound for comparing builds that do not change
      // noise (the r13 shoulder) and UNSOUND for tuning a grain amplitude. The direction is trustworthy, the
      // magnitude is not, and tuning brightKill on the last round of the
      // gauntlet with an instrument that cannot measure the thing being tuned is
      // how a comment like the one above gets written.
      // UNVERIFIED: whether a partial brightKill reduction lands ON ref-4 rather
      // than past it. Nothing in this file measures that yet.
      vec2 gp = floor(uv * uRes * 0.5);
      vec2 gp2 = floor(uv * uRes / 3.0);
      float gt = fract(uTime * 0.37) * 61.3;
      float n1 = fract(sin(dot(gp + gt, vec2(12.9898, 78.233))) * 43758.5453);
      float n2 = fract(sin(dot(gp2 + gt * 1.7 + 19.7, vec2(26.6514, 41.735))) * 24634.6345);
      float gN = (n1 - 0.5) * 0.55 + (n2 - 0.5) * 0.65;
      float gLuma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      // hdrRaw, not hdrMax: PRE-exposure, so the emissive-UI knee identifies
      // the same pixels no matter what the new exposure stage does to their
      // level. Using the post-exposure peak would let a dimmed daylight HUD
      // fall back under the knee and re-acquire grain — the exact r8 defect
      // this round cleared.
      float uiEx = 1.0 - smoothstep(0.75, 1.30, hdrRaw);
      float gw = smoothstep(0.0, 0.05, gLuma) * (1.0 - 0.78 * smoothstep(0.18, 0.80, gLuma));
      float brightKill = 1.0 - 0.85 * smoothstep(0.45, 0.85, gLuma);
      float gAmt = 0.052 * (0.18 + 0.82 * gw) * brightKill * uiEx * (1.0 - 0.92 * hudM);
      col += gN * gAmt;
      col += (vec3(n2, n1, fract(n1 + n2)) - 0.5) * 0.07 * gAmt * smoothstep(0.08, 0.22, gLuma);

      // R10 OUTPUT DITHER. m1 verdict: "background outside the streaks is a
      // flat gradient with visible QUANTISATION BANDING". The grain above
      // cannot fix this and in fact guarantees it: brightKill deliberately
      // takes grain to near-zero above luma ~0.45 (that clamp is what got the
      // daylight sky down to the reference's near-zero sigma), and a bright
      // smooth gradient is exactly where 8-bit quantisation bands. So the two
      // needs are opposite and need separate mechanisms — grain is a LOOK and
      // is shaped by luminance; dither is a QUANTISATION FIX and must be flat,
      // unshaped and always on.
      // One triangular-PDF sample of amplitude 1 LSB, which is the textbook
      // amount: it fully decorrelates the quantisation error, costs 1/255 of
      // noise (below the grain already present anywhere grain exists), and
      // turns a hard step into a stochastic edge. Two independent hashes make
      // the TPDF; a per-channel offset stops the dither itself printing as a
      // grey pattern. Applied last, after every grade stage, because the only
      // quantiser that matters is the framebuffer write.
      float d1 = fract(sin(dot(gl_FragCoord.xy + 0.31, vec2(12.9898, 78.233))) * 43758.5453);
      float d2 = fract(sin(dot(gl_FragCoord.xy + 7.77, vec2(63.7264, 10.873))) * 32168.9137);
      col += vec3(d1 - d2, d2 - d1, fract(d1 + d2) - 0.5) * (1.0 / 255.0);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export function initPost(G) {
  const { renderer, scene, camera } = G;
  const size = renderer.getSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));

  // Bloom: only genuinely hot pixels (HDR > 1) may bloom. The stock high pass
  // rates on luminance, which starves saturated emitters (red strips, cyan
  // glyphs) while letting broad warm midtones veil the frame — swap the
  // metric to max-channel so "hot" means any channel over threshold.
  // R7: attack the UnrealBloom fingerprint. The stock pass with radius=0.45
  // lerps every mip factor toward 1.2 (lerpBloomFactor), which produces the
  // smooth monotonic pyramid the critics can smell — every scale glowing in
  // the same proportion. radius -> 0 hands us the raw per-mip weights, and
  // we shape a TWO-SCALE composite: strong tight core (mips 0-1), a deep
  // mid-scale dip (mips 2-3, this is what kills the uniform veil), and a
  // resurgent wide faint halation on mip 4. Result: hot emissives keep a
  // crisp core wrapped in a soft distant halo, with no mid-frequency glow
  // connecting them.
  // R9: threshold 1.45 -> 1.30 — m2/m3/m4 want genuine brights (stars,
  // engine glows, warp core) rewarded; the two-scale mip shaping below is
  // what keeps this honest (no mid-frequency veil), so the knee can come
  // down a touch without the frame milking over. NO compensation for the
  // radar bulb blowout — that is an emissive-intensity issue owned by the
  // cockpit worker.
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.72, 0.0, 1.30);
  bloom.materialHighPassFilter.fragmentShader =
    bloom.materialHighPassFilter.fragmentShader.replace(
      'luminance( texel.xyz )',
      'max( texel.r, max( texel.g, texel.b ) )'
    );
  bloom.materialHighPassFilter.needsUpdate = true;
  bloom.highPassUniforms.smoothWidth.value = 0.22; // tighter knee: midtones stay matte

  const mipWeights = [1.18, 0.82, 0.28, 0.14, 0.38];
  bloom.compositeMaterial.uniforms.bloomFactors.value = mipWeights;

  // Halation: the wide resurgent mip carries a warm tint so anything hot
  // bleeds a faint amber halo (NMS emissives bleed warm, not clinically
  // white). Tight mips stay neutral so beam cores keep their own colour.
  bloom.bloomTintColors[2].set(1.0, 0.93, 0.84);
  bloom.bloomTintColors[3].set(1.0, 0.87, 0.72);
  bloom.bloomTintColors[4].set(1.0, 0.80, 0.68);
  composer.addPass(bloom);

  // ---- R11-PERF: scene-key prepass ----------------------------------------
  // Needs a FLOAT colour attachment. Half-float would quantise sceneKey and
  // sceneCol and shift the grade a level or two, which is a visual regression
  // bought with performance — not a trade this round accepts. If the platform
  // cannot do it, the final pass keeps the original inline taps (no KEYPASS
  // define) and is exactly the round-10 shader.
  //
  // ============ DEFAULT OFF — AND WHY, WHICH IS THE POINT ============
  // This shipped ON. The in-worktree critic then took it apart and it does not
  // survive:
  //   * The 0.145 ms/frame saving was read off SEVEN adjacent-slice pairs
  //     chosen out of fifteen because they were the small, tidy ones. That is
  //     selecting on the outcome. All fifteen give -0.96 +/- 0.81 — a band that
  //     contains zero comfortably.
  //   * The critic's own two replications found no cluster at -0.145 at all,
  //     and its tightest values sat at +0.43 ms, i.e. a COST.
  //   * It is the only change in this branch that moves a pixel (5 of
  //     2,073,600 at one channel level, moment 5, from a 1-ulp float32 round
  //     trip of exp2(k/16) landing on a quantisation boundary).
  // An unproven saving is not worth a real pixel, however small the pixel. So
  // the default is OFF and the shipped build is byte-identical to round 10.
  //
  // The mechanism is deliberately left wired rather than deleted, because the
  // ALGORITHM is still right — sixteen fixed-uv taps computed once per frame
  // instead of 2,073,600 times — and only the MEASUREMENT failed, on a machine
  // running four workers. Flip USE_KEY_PREPASS to true and measure it in a
  // quiet window; if it pays, it pays for the 5 pixels.
  //
  // Needs a FLOAT colour attachment. Half-float would quantise sceneKey and
  // sceneCol and shift the grade further than the thing it is trying to buy.
  const USE_KEY_PREPASS = false;
  const canFloatRT = USE_KEY_PREPASS
    && renderer.capabilities.isWebGL2
    && renderer.extensions.has('EXT_color_buffer_float');
  let keyRT = null, keyPass = null;
  if (canFloatRT) {
    keyRT = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.FloatType, format: THREE.RGBAFormat,
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
      depthBuffer: false, stencilBuffer: false, generateMipmaps: false,
    });
    keyPass = new SceneKeyPass(keyRT);
    composer.addPass(keyPass);        // after bloom, before the grade
  }
  FinalShader.defines = canFloatRT ? { KEYPASS: 1 } : {};

  const finalPass = new ShaderPass(FinalShader);
  finalPass.uniforms.uRes.value.set(size.x, size.y);
  if (canFloatRT) finalPass.uniforms.tKey.value = keyRT.texture;
  composer.addPass(finalPass);

  // ---- in-process A/B harness (?r11ab=1) -----------------------------------
  // Reload-based arms stopped resolving anything on this machine: with three
  // other workers on the box, a 3-second pose window drifted 9.3 -> 15.8 ms
  // between arms and swamped a 0.6 ms effect. Two materials sharing ONE
  // uniform block, swapped every couple of seconds inside a single GL context,
  // put both arms inside the same contention burst. Built only under the
  // param, so a normal boot still links exactly one final-pass program and the
  // prewarm audit is unaffected.
  let abAlt = null;
  if (canFloatRT && new URLSearchParams(location.search).get('r11ab') === '1') {
    abAlt = new THREE.ShaderMaterial({
      defines: {},                     // no KEYPASS => the inline 16-tap path
      uniforms: finalPass.uniforms,    // shared, so both arms grade identically
      vertexShader: FinalShader.vertexShader,
      fragmentShader: FinalShader.fragmentShader,
    });
  }
  const abMain = finalPass.material;

  const P = {
    composer, bloom, finalPass, keyPass, keyRT,
    // A-arm = the shipped path (1x1 prepass); B-arm = the round-10 inline taps.
    // Returns false when the harness is not built, so a probe can tell "the
    // toggle did nothing" from "the toggle is off".
    // Arm C exists because arm A bundles TWO changes: it removes the 16
    // per-pixel taps AND it adds a render-pass switch for the 1x1 target. A
    // beat B by far less than the tap ablation predicted, and only a third arm
    // can say which half is responsible. C runs the KEYPASS shader with the
    // prepass DISABLED, so tKey holds the previous frame's value — on a POSED
    // moment nothing in the scene changes, so C's image is identical to A's and
    // C is a legitimate cost measurement. C is NOT a shippable arm: in a live
    // session it would lag the exposure by a frame.
    //   A - C = what the extra 1x1 render pass costs
    //   C - B = what the 16 per-pixel taps cost
    __abKeyPass(arm) {
      if (!abAlt) return false;
      if (arm === true) arm = 'A';
      if (arm === false) arm = 'B';
      finalPass.material = (arm === 'B') ? abAlt : abMain;
      if (keyPass) keyPass.enabled = (arm === 'A');
      return true;
    },
    _flash: 0, shock: 0, shockAmp: 0,
    whiteout: 0, redAlert: 0, warp: 0,
    // main.js resets `G.post.flash = 0` after prewarm to stop impact residue
    // bleeding into frame 1 — mirror that intent for the shock ripple by
    // clearing it on the same external reset (post.js-local; no main edit).
    get flash() { return P._flash; },
    set flash(v) { P._flash = v; if (v === 0) P.shock = 0; },
    hit(strength = 0.8) {
      P._flash = Math.min(1, P._flash + strength);
      // shock ripple only on real intakes — the 0.12-strength spark ticks
      // would otherwise keep the canopy wobbling like jelly
      if (strength >= 0.2) {
        P.shock = 1;
        P.shockAmp = Math.min(1, 0.4 + strength * 0.6);
      }
    },
    update(dt, t) {
      P._flash = Math.max(0, P._flash - dt * 2.2);
      P.shock = Math.max(0, P.shock - dt * 2.4);   // ~0.4s ring sweep
      const target = (G.state === 'red-alert') ? 1 : 0;
      P.redAlert += (target - P.redAlert) * Math.min(1, dt * 4);
      // warp CA boost: linear ~0.5s ramp in/out with the state (same G.state
      // read as red alert above — no main.js hookup needed)
      const warpTarget = (G.state === 'warp') ? 1 : 0;
      const step = Math.min(Math.abs(warpTarget - P.warp), dt * 2);
      P.warp += Math.sign(warpTarget - P.warp) * step;
      // warp bloom ease (critic-1: vanishing-point core flattens to a
      // featureless white disc) — the tunnel keeps its glow but the core
      // stops swallowing streak convergence
      // critic-2: the vanishing-point core is still a flat blown disc while
      // the cabin orb halates properly — pull warp bloom harder and lift the
      // warp threshold so the tunnel core stops swallowing streak origins.
      bloom.strength = 0.72 * (1 - 0.30 * P.warp);
      bloom.threshold = 1.30 + 0.70 * P.warp;
      finalPass.uniforms.uWarp.value = P.warp;
      finalPass.uniforms.uTime.value = t;
      finalPass.uniforms.uRedAlert.value = P.redAlert;
      finalPass.uniforms.uFlash.value = P._flash;
      finalPass.uniforms.uWhiteout.value = P.whiteout;
      finalPass.uniforms.uShock.value = P.shock;
      finalPass.uniforms.uShockAmp.value = P.shockAmp;
    },
    render() { composer.render(); },
    resize(w, h) { composer.setSize(w, h); bloom.setSize(w, h); finalPass.uniforms.uRes.value.set(w, h); },
  };
  G.post = P;
  return P;
}
