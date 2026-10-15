// ============================================================================
// worldlight.js — environment coupling for the cockpit interior (R10)
// ============================================================================
//
// THE DEFECT THIS EXISTS TO FIX
// All five round-9 blind critics, independently, answered that the cockpit
// reads "composited on top" while the reference reads "in-camera". The
// sharpest statements:
//   m3  "swap the background and the cockpit would look identical"
//   m5  "upper-left and upper-right struts face substantially different
//        directions yet read at near-identical luminance and hue: real
//        lighting cannot do that"
//
// WHY IT HAPPENED (diagnosed with tools/lightprobe.mjs)
// It is NOT that the world lights are missing. The cockpit rig hangs off
// G.camera which is in the main scene, so the space star light, the space
// ambient, the planet sun and the planet hemisphere fill all reach the
// cockpit materials already. The failure is threefold:
//   1. The world contribution is SWAMPED — the interior point-light rig sits
//      0.3-0.7m from the surfaces it lights, so at decay 2 it delivers an
//      order of magnitude more irradiance than a 1.75-3.0 lux world key.
//   2. The biggest light sources in these five frames are not lights at all.
//      The warp tunnel, the nebula, the planet disc and the sky dome are
//      emissive GEOMETRY. Nothing converts them into a direction the shading
//      can respond to.
//   3. The baked interior bounce is added to totalEmissiveRadiance, which is
//      orientation-independent by construction. Turn it up far enough and it
//      buries whatever N.L variation the world key was producing. That is
//      literally the critic's "ambient-plus-emissive tinting, not lighting".
//
// THE ARCHITECTURE
// A per-frame environment estimate, reduced to a fixed three-lobe basis:
//
//   KEY      the single dominant directional source (star / sun / a big
//            near point light). Produces the orientation-dependent split.
//   FILL     the CANOPY APERTURE. The window is a large opening and in four
//            of the five moments it is the brightest thing in the cockpit's
//            hemisphere. This lobe carries the tunnel cyan, the daylight sky
//            blue and the nebula colour into the cabin.
//   BOUNCE   the nearest planet's lit limb — albedo x phase x solid angle.
//
// plus a scalar `worldLum` used to couple the interior's own emissive output
// to the exterior, so the cabin is world-dominated in daylight and
// interior-dominated in deep space (one exposure system, not two).
//
// Two deliberate design choices:
//
//  * The world lights are DISCOVERED by scene traversal, not hardcoded. Four
//    workers are editing this scene in parallel this round; if r10-visual
//    retunes the star colour or planet.js changes its sun, the cockpit key
//    follows automatically instead of drifting out of agreement. Anything in
//    the scene that is not parented under the camera is "the world".
//
//  * The result is delivered as UNIFORMS into the cockpit materials, not as
//    new THREE lights. Adding three scene lights would change the light-count
//    permutation for every material in the scene — terrain included, at
//    ~700k triangles — costing fps on a round where the fps gate is already
//    the other headline defect, and invalidating the prewarm the perf worker
//    owns. Uniforms cost the four cockpit materials and nothing else.
//
import * as THREE from 'three';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _camPos = new THREE.Vector3();
const _lp = new THREE.Vector3();
const _tp = new THREE.Vector3();
const _pdir = new THREE.Vector3();
const _gdir = new THREE.Vector3();
const FWD = new THREE.Vector3(0, 0, -1);
const WORLD_UP = new THREE.Vector3(0, 1, 0);

const lumOf = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

export function createWorldLight(G) {
  const camera = G.camera;
  // R11: debug affordances, read by tools/r11-fill-ab.mjs. `fullScan` restores
  // round 10's behaviour exactly (a whole-graph traverse every 0.4s) so the
  // change can be A/B'd inside ONE build, in one contention bracket, instead of
  // being compared against a number another worker measured on another day.
  // Two boolean reads per frame, both false in play and in every capture.
  const flags = { fullScan: false };
  let r10Acc = 1e9;

  // ---- discovered world lights ---------------------------------------------
  // R11 COST NOTE. Round 10 shipped this as a full G.scene.traverse() every
  // 0.4s and called "a scene traverse at 2.5Hz is free". It is not free in the
  // metric this project is actually gated on. Amortising a spike does not
  // remove it: a traverse of the whole graph lands entirely inside ONE frame,
  // so at 2.5Hz it produces a periodic hitch — and the gate is p1low, the 1%
  // WORST frames, which is precisely where periodic hitches live. The round-10
  // gameplay critic measured +4.33 p1low from switching this subsystem off,
  // against only +5.4 avg fps; a cost that hurts p1low almost as much as it
  // hurts the mean is a spike, not a load.
  //
  // So the traverse is now SPLIT ACROSS FRAMES with an explicit node budget.
  // No frame ever walks more than SCAN_BUDGET nodes.
  //
  // DETERMINISM. The first update does a COMPLETE synchronous walk, so frame 1
  // is never lit by a partial light set. After that the incremental walk
  // advances a fixed number of nodes per update() call, which makes the state
  // at settle frame N a pure function of N — the same property __settle(90)
  // already relies on. It is not wall-clock or frame-rate dependent.
  let found = [];
  let building = [];
  let stack = null;              // null = idle; otherwise an in-progress walk
  let sinceWalk = 0;
  const SCAN_BUDGET = 96;        // nodes per frame
  const WALK_GAP = 24;           // frames to wait between walks

  function visibleChain(o) {
    for (let p = o; p; p = p.parent) {
      if (p.visible === false) return false;
      if (p === camera) return false; // the cockpit's own rig is not "the world"
    }
    return true;
  }
  function scanFull() {
    found.length = 0;
    G.scene.traverse((o) => { if (o.isLight && visibleChain(o)) found.push(o); });
  }
  // one frame's slice of the walk; returns true when a full pass completed
  function scanStep() {
    if (!stack) {
      if (++sinceWalk < WALK_GAP) return false;
      sinceWalk = 0;
      stack = [G.scene];
      building.length = 0;
    }
    let n = SCAN_BUDGET;
    while (stack.length && n-- > 0) {
      const o = stack.pop();
      if (o.visible === false || o === camera) continue;  // prune whole subtrees
      if (o.isLight) building.push(o);
      const ch = o.children;
      for (let i = 0; i < ch.length; i++) stack.push(ch[i]);
    }
    if (stack.length) return false;
    stack = null;
    const t = found; found = building; building = t;      // swap, never allocate
    return true;
  }

  // ---- output state ---------------------------------------------------------
  const env = {
    keyDir: new THREE.Vector3(0, 0, -1),   // view space, points TOWARD the source
    keyCol: new THREE.Color(0, 0, 0),      // irradiance (lux-ish, matches THREE light intensity)
    // The key BEFORE canopy transmission. Transmission is a diffuse-scattering
    // idea: it says the cabin as a whole receives a fraction of the exterior
    // level. A specular highlight is not a fraction of anything — a star seen
    // through a pane still makes a hard glint on a buffed plate, at full
    // intensity, just smaller. Feeding the transmitted key to the specular
    // lobe threw away the single most directional cue available.
    keyRawCol: new THREE.Color(0, 0, 0),
    fillDir: new THREE.Vector3(0, 0.3, -1).normalize(),
    fillCol: new THREE.Color(0, 0, 0),
    bounceDir: new THREE.Vector3(0, -0.4, -1).normalize(),
    bounceCol: new THREE.Color(0, 0, 0),
    ambCol: new THREE.Color(0, 0, 0),
    // ---- R11: THE HEMISPHERE FLOOR -----------------------------------------
    // The term round 10 was missing. KEY/FILL/BOUNCE are all lobes: each one
    // needs a surface to face it, and each one is gated by the canopy form
    // factor. Underneath them there was nothing at all, so a surface facing
    // away from the window sat at albedo x 0 — measured on m3 as a strut ramp
    // starting at blue channel 5 under an open sky, and 3.56% of our interior
    // below L12 against the reference's 0.11%.
    //
    // This is not a fourth lobe and not a constant. It is the irradiance a
    // surface receives from the whole upper/lower hemisphere, interpolated by
    // the surface's own orientation against world up. That single property is
    // what does BOTH jobs the measurements ask for:
    //   * it has no zero — every surface gets something, so m3's crushed tail
    //     comes up;
    //   * it is orientation-dependent — up-facing surfaces get sky and
    //     down-facing get ground, so orientation CONTRAST goes up rather than
    //     down. ref-3's dash coaming does 3.09:1 between an up-facing ledge
    //     and a forward face 24 rows below it, entirely from this effect. Our
    //     equivalent pair measured 0.90:1 — inverted.
    // A flat additive floor does the first and actively destroys the second,
    // which is why "raise the ambient" was the wrong prescription.
    skyCol: new THREE.Color(0, 0, 0),   // upper hemisphere (canopy/sky/backdrop)
    gndCol: new THREE.Color(0, 0, 0),   // lower hemisphere (terrain bounce + cabin floor)
    // world up, in view space. The sky dome is overhead; a surface whose
    // normal points DOWN sees the cabin floor and the console, not the sky.
    upView: new THREE.Vector3(0, 1, 0),
    worldLum: 0,       // scalar: how bright the cockpit's exterior hemisphere is
    interiorDim: 1,    // multiplier for the cabin's own emissive output
    // diagnostics — read by tools, never by the renderer
    _dbg: { nLights: 0, keySrc: 'none', fillSrc: 'none' },
  };

  // scratch lobes, reused; never allocates per frame
  const lobes = [];
  let nLobes = 0;
  function pushLobe(dirView, r, g, b, src) {
    let L = lobes[nLobes];
    if (!L) { L = lobes[nLobes] = { dir: new THREE.Vector3(), r: 0, g: 0, b: 0, src: '' }; }
    L.dir.copy(dirView); L.r = r; L.g = g; L.b = b; L.src = src;
    nLobes++;
  }

  // world direction -> view direction. The cockpit rig is an unrotated child of
  // the camera, so a view-space direction is also a rig-space direction, which
  // is exactly the space three's fragment `normal` lives in.
  function toView(outV, worldDir) {
    return outV.copy(worldDir).transformDirection(camera.matrixWorldInverse);
  }

  // ---- the canopy aperture --------------------------------------------------
  // Rough solid angle of the window opening as seen from the pilot's eye,
  // used to convert "the sky/tunnel out there is this bright" into an
  // irradiance the interior actually receives. The opening is a trapezoid
  // roughly 2.0m wide at the sill narrowing to 0.9m at the header, ~1.0m tall,
  // ~0.8m in front of the eye. Treating it as a 1.4m x 1.0m aperture at 0.8m
  // gives a hemisphere coverage fraction of very roughly 0.30 — the canopy is
  // a large chunk of the cabin's sky, which is exactly why an unlit canopy
  // reads as a compositing error.
  const APERTURE = 0.30;

  function accumulate(ctx) {
    nLobes = 0;
    env.ambCol.setRGB(0, 0, 0);
    camera.getWorldPosition(_camPos);

    // aperture (window) accumulator — everything the canopy "sees"
    let apR = 0, apG = 0, apB = 0;
    let apSrc = 'none';
    // hemisphere light, if any. planet.js adds one and space.js does not, so
    // its presence is the honest "am I in atmosphere" signal — better than
    // asking G.mode, which is a game-state flag rather than a lighting fact.
    let hemi = null;
    let ambRaw = null;   // the scene's own ambient colour: in space this is
                         // space.js's statement about the nebula's cast

    for (const L of found) {
      const c = L.color, I = L.intensity;
      if (I <= 1e-4) continue;

      if (L.isAmbientLight) {
        env.ambCol.r += c.r * I; env.ambCol.g += c.g * I; env.ambCol.b += c.b * I;
        if (!ambRaw) ambRaw = { r: c.r * I, g: c.g * I, b: c.b * I };
        continue;
      }
      if (L.isHemisphereLight) {
        hemi = L;
        // ground bounce is handled as its own directed lobe below; only the
        // residue folds into ambient here
        const g = L.groundColor;
        env.ambCol.r += g.r * I * 0.12;
        env.ambCol.g += g.g * I * 0.12;
        env.ambCol.b += g.b * I * 0.12;
        continue;
      }
      if (L.isDirectionalLight) {
        L.getWorldPosition(_lp);
        if (L.target) { L.target.getWorldPosition(_tp); } else { _tp.set(0, 0, 0); }
        _v.copy(_lp).sub(_tp);
        if (_v.lengthSq() < 1e-8) continue;
        _v.normalize();
        toView(_v2, _v);
        pushLobe(_v2, c.r * I, c.g * I, c.b * I, 'dir');
        continue;
      }
      if (L.isPointLight || L.isSpotLight) {
        L.getWorldPosition(_lp);
        _v.copy(_lp).sub(_camPos);
        const d = _v.length();
        if (d < 1e-4) continue;
        if (L.distance > 0 && d > L.distance) continue;
        // inverse-square, floored so a light sitting in the pilot's lap cannot
        // produce a divide-by-nothing key
        let E = I / Math.max(d * d, 0.5);
        // window falloff, matching THREE's own for distance-limited lights
        if (L.distance > 0) E *= Math.max(0, 1 - d / L.distance);
        if (E < 1e-3) continue;
        _v.divideScalar(d);
        toView(_v2, _v);
        pushLobe(_v2, c.r * E, c.g * E, c.b * E, 'point');
        continue;
      }
    }

    // ---- synthesised source: THE SKY DOME ----------------------------------
    // A HemisphereLight's intensity is tuned for "ambient fill on terrain",
    // which badly understates the sky as seen through a canopy: in daylight
    // the sky dome is the single largest area source in the pilot's
    // hemisphere. r9's m2 critic asked for "a light source in frame
    // accounting for it" — in m3 and m4 that source is the sky, and until now
    // nothing carried its blue into the cabin at all.
    let groundLobe = null;
    if (hemi) {
      const s = hemi.color, g = hemi.groundColor, I = hemi.intensity;
      apR += s.r * I * ctx.skyAperture;
      apG += s.g * I * ctx.skyAperture;
      apB += s.b * I * ctx.skyAperture;
      apSrc = 'sky';
      // ---- synthesised source: TERRAIN BOUNCE ------------------------------
      // At 80m over a sunlit desert the ground fills the lower half of the
      // window and is a very large lambertian reflector. In m4 (mid-turn, sun
      // behind the ship) it is in fact the ONLY thing lighting the interior —
      // before this the estimate found no key at all there.
      let sunE = 0;
      for (let i = 0; i < nLobes; i++) {
        if (lobes[i].src !== 'dir') continue;
        sunE = Math.max(sunE, lumOf(lobes[i].r, lobes[i].g, lobes[i].b));
      }
      const gE = (sunE * 0.55 + I) * ctx.groundBounce;
      // down and forward through the window, leaning with the real horizon so
      // it stays attached to the world while the ship banks
      toView(_v, WORLD_UP);
      _gdir.copy(FWD).addScaledVector(_v, -0.85).normalize();
      groundLobe = { dir: _gdir, r: g.r * gE, g: g.g * gE, b: g.b * gE };
    }

    // ---- synthesised source: THE BACKDROP (deep space) ---------------------
    // In space there is no hemisphere light, so nothing states what colour the
    // sky outside the canopy is — yet m2's window is filled with a green and
    // gold nebula and m5's with a blue one. space.js's AmbientLight colour IS
    // its statement about the system's cast; promote it to the aperture so the
    // canopy carries that colour inward instead of the cabin sitting at its
    // own fixed orange in every system.
    // NOTE ON UNITS: three's colour management converts hex literals from sRGB
    // to LINEAR, so space.js's 0x352a3c ambient arrives as roughly (0.06,
    // 0.04, 0.07) — about a sixth of its sRGB value. Read as an absolute
    // brightness that is nearly nothing (measured: it produced a fill
    // luminance of 0.021 and no visible cast at all). It is used here the same
    // way the warp tunnel is: as a CHROMA statement normalised to unit
    // luminance, with the magnitude supplied by an explicit aperture constant.
    if (!hemi && ambRaw) {
      const n = Math.max(lumOf(ambRaw.r, ambRaw.g, ambRaw.b), 1e-4);
      const k = ctx.backdropAperture / n;
      apR += ambRaw.r * k; apG += ambRaw.g * k; apB += ambRaw.b * k;
      if (apSrc === 'none') apSrc = 'backdrop';
    }

    // ---- synthesised source: the WARP TUNNEL -------------------------------
    // A hyperspace tunnel fills the entire forward hemisphere. vfx.js does put
    // a point light in its core, but a point source 9m ahead is a wild
    // under-statement of an emitter that occupies the whole window, so the
    // tunnel is promoted to the aperture with its own colour. Round-3's critic
    // said it first: "a green supernova outside and not one green photon lands
    // on the red struts".
    if (ctx.inWarp) {
      // take the colour from the brightest forward point lobe (that IS the vfx
      // tunnel core) so the two never disagree about what colour warp is
      let best = null, bestL = 0;
      for (let i = 0; i < nLobes; i++) {
        const L = lobes[i];
        if (L.dir.z > -0.3) continue;          // must be ahead of the pilot
        const l = lumOf(L.r, L.g, L.b);
        if (l > bestL) { bestL = l; best = L; }
      }
      const tr = best ? best.r : 0.19, tg = best ? best.g : 1.0, tb = best ? best.b : 0.75;
      const n = Math.max(lumOf(tr, tg, tb), 1e-3);
      // normalise to a chroma and re-scale: the tunnel's absolute point-light
      // intensity is meaningless as an aperture brightness
      apR += (tr / n) * ctx.warpBrightness;
      apG += (tg / n) * ctx.warpBrightness;
      apB += (tb / n) * ctx.warpBrightness;
      apSrc = 'warp';
    }

    // ---- synthesised source: NEARBY PLANET BOUNCE ---------------------------
    // m5's critic: "the planet's lit limb contributes no bounce". A planet
    // filling a chunk of the window is a huge area light. Approximate it as a
    // lambertian disc: albedo x phase x (radius/distance)^2.
    env.bounceCol.setRGB(0, 0, 0);
    if (!ctx.inWarp && !hemi && G.space && G.space.nearestPlanet) {
      const np = G.space.nearestPlanet();
      if (np && np.planet && np.planet.mesh) {
        const pl = np.planet;
        _v.copy(pl.mesh.position).sub(_camPos);
        const d = _v.length();
        if (d > 1e-3 && pl.radius) {
          _v.divideScalar(d);
          toView(_pdir, _v);                    // direction to the planet, view space
          // solid-angle fraction of the hemisphere covered by the disc
          const solid = Math.min(0.9, (pl.radius * pl.radius) / (d * d));
          // PHASE. A planet is full when the viewer sits between it and the
          // star (dirToPlanet and dirToStar point opposite ways, dot = -1) and
          // new when the viewer looks back toward the star past it (dot = +1).
          // The floor is not zero: a new planet still has an atmosphere ring
          // and the terminator glow, and NMS is stylised.
          let ph = 0.5;
          for (let i = 0; i < nLobes; i++) {
            if (lobes[i].src !== 'dir') continue;
            ph = 0.15 + 0.85 * (0.5 - 0.5 * _pdir.dot(lobes[i].dir));
            break;
          }
          const albedo = planetTint(pl);
          const E = solid * ph * ctx.planetBounce;
          if (E > 1e-3) {
            env.bounceDir.copy(_pdir);
            env.bounceCol.setRGB(albedo.r * E, albedo.g * E, albedo.b * E);
            // a planet in the window is also part of what the canopy sees
            apR += albedo.r * E * 0.55;
            apG += albedo.g * E * 0.55;
            apB += albedo.b * E * 0.55;
            if (apSrc === 'none') apSrc = 'planet';
          }
        }
      }
    }
    // on a planet the ground IS the bounce, and it is a much bigger one
    if (groundLobe) {
      env.bounceDir.copy(groundLobe.dir);
      env.bounceCol.setRGB(groundLobe.r, groundLobe.g, groundLobe.b);
    }

    // ---- pick the KEY -------------------------------------------------------
    // The dominant directional source. Only lobes that are actually in front of
    // the pilot can key the interior: a star behind the ship's hull does not
    // shine through it. Rear lobes fold into ambient at low weight.
    // CANOPY ADMITTANCE, not a hard front/back cut. An earlier version
    // rejected anything with view-space z > 0.25, which left m4 — mid-turn
    // with the sun behind the ship — with NO key at all. But an NMS canopy is
    // glass overhead and down both sides, and ref-3's cabin is very obviously
    // lit by a sun coming over the pilot's shoulder. So rear sources are
    // admitted at reduced weight instead of discarded.
    let key = null, keyL = 0, keyAdm = 1;
    for (let i = 0; i < nLobes; i++) {
      const L = lobes[i];
      // In warp, space.js has hidden the entire skybox — sun sprite, stars,
      // nebula, planets. Nothing exists outside the hull but the tunnel, so a
      // star light still sitting in the scene behind the ship must not key the
      // cabin. (It did, on the iteration that introduced admittance: m1's key
      // came out warm-white from astern while the window was full of teal.)
      if (ctx.inWarp && L.dir.z > -0.3) continue;
      const adm = 0.18 + 0.82 * (0.5 - 0.5 * L.dir.z); // 1.0 dead ahead, 0.18 dead astern
      const l = lumOf(L.r, L.g, L.b) * adm;
      if (l > keyL) { keyL = l; key = L; keyAdm = adm; }
    }
    if (key) {
      env.keyDir.copy(key.dir);
      // CANOPY TRANSMISSION. The scene's key intensity is authored for open
      // exteriors — hulls, terrain, asteroids. The pilot sits in a recess
      // behind tinted glass, so only a fraction of it lands inside, and the
      // gap matters: at full strength a 3-lux star turned m5's saturated red
      // alert into pink (measured, iteration 1). What has to survive the
      // attenuation is the key's DIRECTION and CHROMA, which are what the
      // critics were reading; its raw magnitude is not the point.
      const kt = ctx.keyTransmission * keyAdm;
      env.keyCol.setRGB(key.r * kt, key.g * kt, key.b * kt);
      env.keyRawCol.setRGB(key.r * keyAdm, key.g * keyAdm, key.b * keyAdm);
      env._dbg.keySrc = key.src;
    } else {
      env.keyCol.setRGB(0, 0, 0);
      env.keyRawCol.setRGB(0, 0, 0);
      env._dbg.keySrc = 'none';
    }
    // everything that is not the key contributes as ambient at a modest weight
    for (let i = 0; i < nLobes; i++) {
      const L = lobes[i];
      if (L === key) continue;
      // R11: 0.22/0.10 -> 0.11/0.045. This is an UNSHAPED add and unshaped adds
      // are the defect. Measured on m4: our interior p10 sat at 29 against the
      // reference's 6 and the dynamic range at 4.86 against 20.83.
      const w = L.dir.z < 0.25 ? 0.11 : 0.045; // non-key lobes fold in as ambient
      env.ambCol.r += L.r * w; env.ambCol.g += L.g * w; env.ambCol.b += L.b * w;
    }

    // ---- the FILL lobe is the aperture -------------------------------------
    // Direction: out through the canopy and a little up, because the header is
    // higher than the sill and in planet mode the sky is above. Blending the
    // world-up direction in means that when the ship banks (m4 is mid-turn) the
    // fill leans with the horizon instead of staying welded to the cockpit —
    // which is one of the things that makes an interior read as attached to
    // the frame rather than to the world.
    toView(_v, WORLD_UP);
    // R12 BUG FIX, isolated from the rest of r12-integ so its cost can be
    // measured alone. `env.upView` was DECLARED (line 185) and NEVER ASSIGNED —
    // it shipped as a constant (0,1,0) in VIEW space, i.e. constant camera-up,
    // for the whole of round 11. It feeds `uEnvSkyUp`, which src/cockpit.js's
    // hemisphere floor consumes as `upW = dot(normal, uEnvSkyUp)*0.5+0.5`,
    // under a comment asserting that it "is recomputed into view space every
    // frame and so leans when the ship banks". That comment was false, and
    // false about the exact property round 11's hemisphere floor was built
    // around. `_v` already holds world-up in view space from the line above.
    env.upView.copy(_v);
    // The up-blend is heavier in atmosphere: ref-3's blue lands on the tube
    // CROWNS and the roof underside, i.e. on up-facing normals, because the
    // sky dome is overhead. In space the window is straight ahead and there
    // is no dome, so the fill stays forward.
    env.fillDir.copy(FWD).addScaledVector(_v, hemi ? 0.95 : 0.40).normalize();
    env.fillCol.setRGB(apR * APERTURE, apG * APERTURE, apB * APERTURE);
    env._dbg.fillSrc = apSrc;
    env._dbg.nLights = found.length;

    // ---- the HEMISPHERE FLOOR ----------------------------------------------
    // UPPER: what a surface pointed at the roof sees. Physically that is the
    // canopy glass and, through it, the sky/tunnel/backdrop — the aperture
    // accumulator, at a lower coefficient than the FILL lobe because the FILL
    // lobe already models the direct line of sight and this is the part that
    // arrives after bouncing around the glazing.
    // ...plus the cabin's own upper band. Symmetric with ctx.floor* below and
    // for the same reason: what an up-facing surface integrates is the canopy
    // header and the glazing, and in a red-alert cabin that band is the ONLY
    // thing in the pilot's upper hemisphere that is not red. ref-5's header
    // rail probes at rgb 205,228,230 / hue 184.7 inside a fully drenched cabin;
    // our whole m5 interior measured a cool-hue share of 0.01% against the
    // reference's 8.42%. Feeding the cool practical in HERE rather than leaving
    // it as a lone point light is what lets it answer the normal: up-facing
    // surfaces take it, the inboard faces beside them stay saturated red, which
    // is exactly the reference's structure rather than a wash over everything.
    env.skyCol.setRGB(apR * ctx.hemiSky, apG * ctx.hemiSky, apB * ctx.hemiSky);
    // LOWER: what a surface pointed at the floor sees. Two contributors, and
    // both matter in different moments:
    //   * the ground/planet bounce, which is the only real illuminant in m4
    //     (mid-turn, sun behind the ship);
    //   * the CABIN'S OWN FLOOR, passed in by cockpit.js. This is the term that
    //     makes m5 work. During a red alert the console and footwell are a
    //     large red-flooded lambertian surface directly below everything in the
    //     cabin, so "the lower hemisphere is red" is not a stylisation, it is
    //     what a red-alert cabin IS. Delivering it here rather than as a baked
    //     emissive is the whole difference between the reference's read and
    //     ours: this version answers the surface normal.
    const bl = ctx.hemiGround;
    env.gndCol.setRGB(
      env.bounceCol.r * bl + ctx.floorR,
      env.bounceCol.g * bl + ctx.floorG,
      env.bounceCol.b * bl + ctx.floorB);

    // ---- exposure coupling --------------------------------------------------
    // One scalar describing how bright it is OUT THERE. Weighted toward the
    // aperture and the bounce rather than the key, because the question this
    // answers is "how much light is the cabin swimming in", and a star is a
    // very bright pinprick while a sky is the whole window.
    //
    // The first version weighted the key at 0.5 and got m2 (deep space, a
    // black window with one small star) and m3 (a sunlit desert filling the
    // frame) at 0.652 and 0.647 — indistinguishable, which made the exposure
    // coupling below do the wrong thing in both. Measured exterior luminance
    // for those two frames is 71 and 178.
    env.worldLum = lumOf(env.fillCol.r, env.fillCol.g, env.fillCol.b)
      + lumOf(env.bounceCol.r, env.bounceCol.g, env.bounceCol.b) * 0.70
      + lumOf(env.ambCol.r, env.ambCol.g, env.ambCol.b) * 0.60
      + lumOf(env.keyCol.r, env.keyCol.g, env.keyCol.b) * 0.25;
  }

  // planet albedo, best-effort. planet/space are owned by another worker this
  // round, so this reads whatever is there and degrades to a neutral warm grey
  // rather than reaching into their internals.
  // R11: memoised per material. Round 10 re-ran a five-key string lookup over a
  // uniforms object EVERY FRAME to answer a question whose answer changes when
  // a planet's material is authored, i.e. never at runtime.
  const _tint = new THREE.Color();
  const _tintCache = new WeakMap();
  function planetTint(pl) {
    const m = pl.mesh && pl.mesh.material;
    if (!m) return _tint.setRGB(0.55, 0.52, 0.48);
    let c = _tintCache.get(m);
    if (c === undefined) {
      c = null;
      if (m.color && m.color.isColor) c = m.color.clone();
      else if (m.uniforms) {
        for (const k of ['uColorA', 'uLand', 'uColor', 'uTint', 'uGround']) {
          const u = m.uniforms[k];
          if (u && u.value && u.value.isColor) { c = u.value.clone(); break; }
        }
      }
      if (!c) c = new THREE.Color(0.55, 0.52, 0.48);
      _tintCache.set(m, c);
    }
    return _tint.copy(c);
  }

  // smoothing: the estimate must not strobe when a bolt flies past or a light
  // is culled for a frame. Snapped on the first update so a posed capture that
  // settles only a handful of frames is never caught mid-adaptation (same
  // reasoning as the r9 HUD exposure key).
  let primed = false;
  const _sKey = new THREE.Color(), _sKeyRaw = new THREE.Color(), _sFill = new THREE.Color(), _sAmb = new THREE.Color(), _sBounce = new THREE.Color();
  const _sSky = new THREE.Color(), _sGnd = new THREE.Color();
  const _sKeyDir = new THREE.Vector3(), _sFillDir = new THREE.Vector3(), _sBounceDir = new THREE.Vector3();
  let _sWorld = 0;
  const lerpC = (a, b, k) => { a.r += (b.r - a.r) * k; a.g += (b.g - a.g) * k; a.b += (b.b - a.b) * k; };

  return {
    env,
    flags,
    update(dt, ctx) {
      // First call: a COMPLETE walk, so frame 1 is never lit by a partial
      // light set. Afterwards the walk is spread across frames (see the note
      // at scanStep) and never spikes a single frame.
      if (!primed) scanFull();
      else if (flags.fullScan) { r10Acc += dt; if (r10Acc >= 0.4) { r10Acc = 0; scanFull(); } }
      else scanStep();
      accumulate(ctx);

      // temporal smoothing
      const k = primed ? Math.min(1, dt * 6.0) : 1;
      primed = true;
      lerpC(_sKey, env.keyCol, k); lerpC(_sKeyRaw, env.keyRawCol, k); lerpC(_sFill, env.fillCol, k);
      lerpC(_sAmb, env.ambCol, k); lerpC(_sBounce, env.bounceCol, k);
      lerpC(_sSky, env.skyCol, k); lerpC(_sGnd, env.gndCol, k);
      _sKeyDir.lerp(env.keyDir, k).normalize();
      _sFillDir.lerp(env.fillDir, k).normalize();
      _sBounceDir.lerp(env.bounceDir, k).normalize();
      _sWorld += (env.worldLum - _sWorld) * k;

      env.keyCol.copy(_sKey); env.keyRawCol.copy(_sKeyRaw); env.fillCol.copy(_sFill);
      env.ambCol.copy(_sAmb); env.bounceCol.copy(_sBounce);
      env.skyCol.copy(_sSky); env.gndCol.copy(_sGnd);
      env.keyDir.copy(_sKeyDir); env.fillDir.copy(_sFillDir); env.bounceDir.copy(_sBounceDir);
      env.worldLum = _sWorld;

      // Interior emissive falls back as the world comes up. This is the
      // scene-side half of the exposure coupling: r9 gave the HUD a scene
      // exposure stage in post; this gives the GEOMETRY the same relationship,
      // and it is why the cabin can be world-dominated at m3 and
      // interior-dominated at m2 without either being hand-posed.
      // DEAD ZONE, not a plain reciprocal. Deep space genuinely IS
      // interior-dominated — ref-2 and ref-5 both keep a warm cabin against a
      // dark window, and r9 spent a whole cycle getting the strip bounce
      // visible again after r8 over-ducked it. Ducking must therefore not
      // start until the world is actually brighter than a dark starfield.
      // Measured worldLum: m2/m5 ~0.4 (dark), m4 0.65, m1/m3 ~0.87.
      const over = Math.max(0, env.worldLum - ctx.dimFloor);
      env.interiorDim = 1 / (1 + over * ctx.dimStrength);
      return env;
    },
  };
}
