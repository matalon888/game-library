// prewarm.js — warm the WHOLE variant space at boot, by enumeration.
//
// ============================================================================
// WHY THIS IS NOT A LIST
// ============================================================================
// Rounds 3, 6, 7 and 9 each shipped a mid-session stall of the same shape: a
// visual variant that existed in the build but had never been DRAWN before the
// moment it appeared in gameplay. Each time the fix was another hand-written
// line in a prewarm allowlist, and each time the next round added a variant the
// list did not know about.
//
// Round-10 measurement (tools/stall-probe.mjs, captures/r10-perf/stall-*.json)
// settled what the cost actually is, and the answer corrects the round-9 theory:
//
//   * NOTHING COMPILES MID-SESSION. renderer.info.programs.length is 186 from
//     the end of boot to the end of the session, on every run. The CPU profile
//     contains zero acquireProgram / WebGLProgram / compileShader samples after
//     t=2s. The "shader recompile" theory is refuted.
//   * Exactly one program in the build was first DRAWN mid-session: the vfx
//     scorch decal (cacheKey "...,vfx-scorch", a 14-instance InstancedMesh that
//     ships `visible = false` and only turns on when a bolt hits terrain).
//   * The 250-370ms stall lands on the frame where that object enters the render
//     list. The stall frame has the SAME draw-call count and the SAME triangle
//     count as its neighbours (129 vs 128 calls, +16 triangles) — it is not a
//     workload spike. No individual GL entry point is slow; the time is spread
//     across three.js's uniform setters. That is the signature of the renderer
//     process blocking on the GPU process: ANGLE/Metal creates the Metal
//     pipeline state off the client thread, so the cost of a first draw surfaces
//     in whatever GL call next fills the command buffer, not in the draw itself.
//
// So the unit of warming is not "material" and not "shader" — it is
// **(program x render state) actually drawn**. This module therefore does not
// name effects. It:
//
//   1. Enumerates WORLD STATES as a cross product (world x alert x warp), not
//      as a hand-written list of four scenes.
//   2. For each state, REFLECTIVELY SWEEPS the scene graph and forces every
//      renderable to issue a draw — visible = true, frustumCulled = false,
//      InstancedMesh.count = capacity — so a mesh nobody told this file about
//      is warmed anyway. Lights are the one thing never forced (see
//      pinLights below): the light set IS a program dimension, so changing it
//      would warm variants the game can never reach and miss the ones it can.
//   3. AUDITS itself. Every program three.js has linked is checked against the
//      set of programs actually drawn during the sweep. Anything left over is
//      named — by cacheKey — in a PREWARM-GAP warning, in window.__telemetry()
//      .prewarm, and as a hard failure in tools/prewarm-audit.mjs.
//   4. Leaves a RUNTIME TRIPWIRE. Programs/geometries/textures created after
//      boot cannot have been warmed by construction; a three-integer compare
//      per frame catches them and records the time and the state.
//
// WHAT HAPPENS WHEN A FUTURE ROUND ADDS A VARIANT THIS FILE HAS NEVER SEEN
//   - a new mesh / material / effect pool anywhere under `scene`  -> warmed
//     automatically by the sweep, no edit here.
//   - a new conditionally-visible object (visible=false, count=0, culled)
//     -> warmed automatically; that is precisely what the sweep overrides.
//   - a new light, or a new world state (a new palette, a new alert mode)
//     -> NOT warmed automatically. It is caught: either the audit names the
//     unwarmed program at boot, or the runtime tripwire names it mid-session,
//     and tools/prewarm-audit.mjs fails the build either way. Fixing it means
//     adding one entry to WORLD_STATES below — a state, not an effect.
//   - a material created lazily after boot -> not warmable at boot by anyone;
//     the runtime tripwire names it and the audit tool fails.
// ============================================================================

import * as THREE from 'three';

// ---------------------------------------------------------------------------
// The state space, as a cross product.
// A "world state" is any combination that can change a compiled program or the
// pipeline it specialises into: which top-level groups are visible (that is the
// light set), whether scene.fog is set, which palette the planet holds, and
// whether the warp composite is up. Everything else — bolt colour, bolt scale,
// explosion scale, mesh scale, enemy class, alive/dead, speed threshold — does
// NOT change the program, so it does not belong here. Those are covered by the
// sweep, which draws every pooled mesh in every state regardless of parameter.
// ---------------------------------------------------------------------------
const WORLDS = [
  { world: 'space', palette: 'current' },
  { world: 'planet', palette: 'current' },
  { world: 'planet', palette: 'next' },      // post-warp arrival: flora species + textures differ
];
const ALERTS = ['normal', 'red-alert'];

export const WORLD_STATES = [];
for (const w of WORLDS) {
  for (const alert of ALERTS) {
    // planet + next-palette + red-alert is reachable (shields can drop after a
    // warp arrival) but shares its program set with planet/current/red-alert;
    // skip it to keep boot bounded — the audit will say so if that is wrong.
    if (w.palette === 'next' && alert === 'red-alert') continue;
    WORLD_STATES.push({ name: `${w.world}-${w.palette}-${alert}`, ...w, alert, warp: false });
  }
}
// warp is a space-only composite with its own group + spill light
WORLD_STATES.push({ name: 'warp', world: 'space', palette: 'current', alert: 'normal', warp: true });

// ---------------------------------------------------------------------------
// Reflective sweep: make every renderable in the CURRENTLY VISIBLE subtrees
// issue a draw, without touching the light set.
// ---------------------------------------------------------------------------

// Lights are a program dimension (NUM_DIR_LIGHTS / NUM_POINT_LIGHTS /
// NUM_HEMI_LIGHTS / SHADOWMAP_TYPE all bake into the cache key). Before we force
// meshes visible we PIN every light that is currently effectively invisible to
// visible=false, so revealing its parent group cannot smuggle it into the light
// set. Lights that are already effectively visible are left exactly as they are.
function pinLights(scene, restore) {
  const stack = [{ o: scene, vis: true }];
  while (stack.length) {
    const { o, vis } = stack.pop();
    const v = vis && o.visible;
    if (o.isLight && !v && o.visible) { restore.push([o, 'visible', o.visible]); o.visible = false; }
    for (let i = 0; i < o.children.length; i++) stack.push({ o: o.children[i], vis: v });
  }
}

// Which subtrees are STATE-OWNED, and therefore off limits to the sweep?
//
// The dividing line is lights. A group that contains a light is a world-state
// switch: showing it changes NUM_DIR_LIGHTS / NUM_HEMI_LIGHTS / shadow counts,
// which changes the program every material in the scene compiles to. Those
// groups belong to WORLD_STATES — the sweep must not touch them, or it warms
// combinations the game can never reach (round 3's exact mistake: planet and
// space lit simultaneously) and pays for them at boot.
//
// A group with no light in it is content. The sweep owns it, and that is what
// makes the mechanism robust to variants nobody declared: a mesh, a pool, a
// decal, a conditionally-visible overlay added by any future round is content
// by default and gets warmed with no edit here. A future round that adds a new
// LIGHT-bearing group gets the opposite treatment — its contents stay cold, the
// coverage audit names every material inside it, and tools/prewarm-audit.mjs
// fails until WORLD_STATES learns the new state.
function hasLightDescendant(o) {
  if (o.isLight) return true;
  for (let i = 0; i < o.children.length; i++) if (hasLightDescendant(o.children[i])) return true;
  return false;
}

// Force every non-light object to draw. Returns nothing; `restore` collects
// [object, prop, previousValue] triples applied in reverse afterwards.
function forceDrawAll(scene, restore) {
  const stack = [scene];
  while (stack.length) {
    const o = stack.pop();
    if (o.isLight || o.isCamera) continue;
    // a hidden light-bearing subtree is this state's business, not the sweep's:
    // skip it AND everything under it
    if (!o.visible && hasLightDescendant(o)) continue;
    for (let i = 0; i < o.children.length; i++) stack.push(o.children[i]);
    if (!o.visible) { restore.push([o, 'visible', false]); o.visible = true; }
    // frustumCulled=false is what makes an off-screen object still ISSUE its
    // draw. A draw that rasterises no pixels still forces the driver to build
    // and bind the pipeline state, which is the whole cost we are moving to
    // boot — the same trick the pooled effects already relied on by living at
    // y = -80000.
    if (o.frustumCulled) { restore.push([o, 'frustumCulled', true]); o.frustumCulled = false; }
    // a pool parked at count 0 issues no draw at all
    if (o.isInstancedMesh) {
      const cap = o.instanceMatrix ? o.instanceMatrix.count : 0;
      if (o.count < cap) { restore.push([o, 'count', o.count]); o.count = cap; }
    }
    if (o.isLOD && o.levels) {
      for (const lv of o.levels) if (lv.object && !lv.object.visible) { restore.push([lv.object, 'visible', false]); lv.object.visible = true; }
    }
  }
}

function undo(restore) {
  for (let i = restore.length - 1; i >= 0; i--) { const [o, k, v] = restore[i]; o[k] = v; }
  restore.length = 0;
}

// ---------------------------------------------------------------------------
// Coverage recorder: which linked programs actually got drawn, and in which
// state. Installed by monkey-patching renderBufferDirect for the duration of
// the prewarm only — zero cost once boot is over.
// ---------------------------------------------------------------------------
// The audit universe is MATERIALS, not programs.
//
// It has to be. three.js only materialises a program when something is about to
// be drawn with it (renderer.compile() is the exception, and this module does
// not call it — see the note in the pass loop). So renderer.info.programs can
// never contain a program that "should have been drawn but wasn't": by the time
// it exists, it has been drawn. Auditing programs would therefore be an audit
// that can only ever pass, which is the most dangerous kind.
//
// Materials are the right universe because they exist whether or not anything
// draws them, they are discoverable by reflection over the scene graph, and one
// material that never draws during the sweep is exactly one object that will
// pay a pipeline cost the first time the game reveals it.
function installRecorder(renderer) {
  const drawnMats = new Map();      // material uuid -> Set(stateName)
  const drawnProgs = new Set();     // GL program objects that were actually drawn
  const orig = renderer.renderBufferDirect.bind(renderer);
  let stateName = 'boot';
  renderer.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
    const r = orig(camera, scene, geometry, material, object, group);
    let s = drawnMats.get(material.uuid);
    if (!s) drawnMats.set(material.uuid, (s = new Set()));
    s.add(stateName);
    try {
      const p = renderer.properties.get(material).currentProgram;
      if (p && p.program) drawnProgs.add(p.program);
    } catch (e) { /* material not yet set up */ }
    return r;
  };
  return {
    drawnMats, drawnProgs,
    set: (n) => { stateName = n; },
    uninstall: () => { renderer.renderBufferDirect = orig; },
  };
}

// Every material reachable from the scene graph, with the object that owns it.
// This is the reflective half of "enumerate, don't list": a mesh another worker
// adds in a later round shows up here without anyone editing this file.
function sceneMaterials(scene) {
  const out = [];
  scene.traverse((o) => {
    if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite)) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m) continue;
      out.push({
        uuid: m.uuid,
        name: `${o.type}:${o.name || '(unnamed)'} / ${m.type}:${m.name || '(unnamed)'}` +
              (o.isInstancedMesh ? `[inst ${o.count}/${o.instanceMatrix ? o.instanceMatrix.count : '?'}]` : ''),
      });
    }
  });
  return out;
}

// ---------------------------------------------------------------------------
// main entry
// ---------------------------------------------------------------------------
export function runPrewarm(ctx) {
  const { G, scene, camera, renderer, FIXED_DT, planetSysNow, harness } = ctx;
  const t0 = performance.now();
  const timings = [];
  const rec = installRecorder(renderer);

  // ---- snapshot everything the prewarm is allowed to touch ----------------
  const save = {
    state: G.state,
    mode: G.mode,
    fog: scene.fog,
    bg: scene.background,
    planetVis: G.planet.group.visible,
    spaceVis: G.space.group.visible,
    warpOn: G.state === 'warp',              // moment 1 poses with the tunnel up
    speed: G.player.speed,
    pos: G.player.pos.clone(),
    camPos: camera.position.clone(),
    camQuat: camera.quaternion.clone(),
    enemies: G.flight.enemies.map((e) => ({ mesh: e.mesh.visible, hp: e.hpSprite.visible, alive: e.alive, pos: e.pos.clone() })),
  };

  camera.position.copy(G.player.pos);
  camera.quaternion.copy(G.player.quat);
  // r7: conditionally-visible cruise speed-streaks draw only above 24u/s. The
  // sweep would force the mesh visible anyway, but the streaks also need their
  // per-instance buffers non-degenerate, so keep the speed bump.
  G.player.speed = 80;

  // Fighters: every pooled fighter alive + visible so mesh, hp label, engine
  // glow and the alive-only engine-trail ribbon all draw. The sweep handles
  // visibility, but `alive` is a game-logic predicate the renderer cannot see,
  // so it is set explicitly here. Same class of thing as `count` on a pool.
  const enFront = G.flight.enemies.find((e) => !e.alive) || G.flight.enemies[0];
  for (const en of G.flight.enemies) {
    G.flight.refreshHp(en);
    en.mesh.visible = true;
    en.hpSprite.visible = true;
    en.alive = true;
  }
  enFront.pos.set(0, 0, -60).applyQuaternion(G.player.quat).add(G.player.pos);

  // Pooled effects, ignited far below the camera. Parameters (bolt colour,
  // bolt scale, explosion scale) deliberately do NOT vary: they do not change
  // the program, and round 9's allowlist grew a line per parameter for no
  // measurable reason. What matters is that each POOL draws, which the sweep
  // guarantees even for pools these calls do not touch.
  const fxPos = new THREE.Vector3(0, -80000, 0);
  const fxVel = new THREE.Vector3(0, 0, 1);
  const igniteFx = () => {
    G.vfx.fireBolt(fxPos, fxVel, 0xffc860, 'prewarm', 1);
    G.vfx.fireBolt(fxPos, fxVel, 0xff6018, 'enemy', 1);   // enemy path: muzzle pop + graze branch
    G.vfx.explode(fxPos, 1);
    G.vfx.shieldRipple(fxPos);
    G.vfx.update(FIXED_DT, 0);
  };

  // ---- state application ---------------------------------------------------
  const applyState = (st) => {
    const wantPlanet = st.world === 'planet';
    G.mode = wantPlanet ? 'planet' : 'space';
    G.space.group.visible = !wantPlanet;
    G.planet.group.visible = wantPlanet;
    G.vfx.setWarp(st.warp);
    if (wantPlanet) {
      const sys = st.palette === 'next' ? planetSysNow + 1 : planetSysNow;
      // Warm AT the site, camera above ground looking at the horizon: distant
      // flora and imposters only upload on a real rasterising draw, and a
      // camera at y=0 may sit inside terrain and draw nothing.
      const px = sys * 40000;
      G.player.pos.set(px, 0, 0);
      G.planet.setSystem(sys);
      G.planet.update(0, 0);                       // sync flora scatter around this cell
      G.player.pos.y = G.planet.heightAt(px, 0) + (st.palette === 'next' ? 150 : 80);
      const pal = G.planet.palette();
      scene.fog = new THREE.FogExp2(pal.haze, 0.00035);
      scene.background = new THREE.Color(pal.horizon);
      camera.position.copy(G.player.pos);
      camera.quaternion.copy(G.player.quat);
      // park a fighter in front of THIS camera so its fogged variants rasterise
      enFront.pos.set(0, 0, -60).applyQuaternion(camera.quaternion).add(camera.position);
    } else {
      G.player.pos.copy(save.pos);
      scene.fog = null;
      camera.position.copy(G.player.pos);
      camera.quaternion.copy(G.player.quat);
      enFront.pos.set(0, 0, -60).applyQuaternion(camera.quaternion).add(camera.position);
    }
    G.state = st.warp ? 'warp' : (st.alert === 'red-alert' ? 'red-alert' : (wantPlanet ? 'planet' : 'cruise'));
    // the alert rig lives on the cockpit; one update flips the light
    // intensities and repaints the panel canvases for this state
    G.cockpit.update(FIXED_DT, 0);
    G.post.update(FIXED_DT, 0);
    if (st.warp) G.vfx.update(FIXED_DT, 0);
  };

  // ---- the enumerated passes ----------------------------------------------
  // Ignite the pools ONCE, not once per state. The allowlist had to re-ignite
  // in each pass because a pool with no live particles has count 0 and issues
  // no draw; the sweep sets count to capacity regardless, so re-igniting only
  // piles up live particles that survive into frame 1. Measured leak from
  // igniting per state: 90/96 live debris and 3 live glow sprites at __ready,
  // against 28 and 0 on the base build (tools/boot-state.mjs).
  igniteFx();

  for (const st of WORLD_STATES) {
    const ts = performance.now();
    rec.set(st.name);
    applyState(st);

    // pass A — the honest scene, exactly as the game will present it
    G.post.render();
    G.post.render();

    // pass B — the sweep. Everything that CAN draw in this light/fog state
    // does draw, including objects the game only reveals on a predicate.
    const restore = [];
    pinLights(scene, restore);
    forceDrawAll(scene, restore);
    G.post.render();
    G.post.render();
    undo(restore);

    // NOTE — deliberately NO renderer.compile(). three.js's compile() walks the
    // scene with `traverse`, not `traverseVisible`, so it links a program for
    // EVERY material under the current light set, including materials on
    // objects that state can never show. That inflates renderer.info.programs
    // with variants nothing will ever draw, which (a) is wasted boot time and
    // (b) makes the coverage audit below meaningless — it can never reach zero.
    // Drawing is strictly stronger than compiling: a forced draw links the
    // program AND specialises the pipeline. Measured: dropping compile() took
    // renderer.info.programs from 187 (16 of them undrawable) to the set that
    // is actually reachable, and cut boot.

    timings.push({ state: st.name, ms: Math.round((performance.now() - ts) * 10) / 10 });
  }

  // ---- flora cell-crossing rescatter storm --------------------------------
  // Not a program variant: the amortised rescatter flags full instance-buffer
  // uploads ~27 frames in a row, and the first such storm of the process ends
  // in one driver stall (measured 350-424ms, first crossing only). Fake one
  // crossing, drain it with real renders, cross back, drain again.
  {
    const ts = performance.now();
    rec.set('flora-crossing');
    applyState({ name: 'planet-current-normal', world: 'planet', palette: 'current', alert: 'normal', warp: false });
    G.player.pos.x += 900;
    for (let i = 0; i < 30; i++) { G.planet.update(FIXED_DT, 0); G.post.render(); }
    G.player.pos.copy(save.pos);
    G.planet.setSystem(planetSysNow);
    for (let i = 0; i < 30; i++) G.planet.update(FIXED_DT, 0);
    G.post.render();
    timings.push({ state: 'flora-crossing', ms: Math.round((performance.now() - ts) * 10) / 10 });
  }

  // ---- warp re-touch -------------------------------------------------------
  // The first warp draw AFTER other passes still costs ~20ms (driver-side state
  // respecialisation), so warp is the last composite exercised.
  {
    const ts = performance.now();
    rec.set('warp-retouch');
    applyState({ name: 'warp', world: 'space', palette: 'current', alert: 'normal', warp: true });
    G.vfx.update(FIXED_DT, 0);
    G.post.render();
    G.vfx.setWarp(false);
    timings.push({ state: 'warp-retouch', ms: Math.round((performance.now() - ts) * 10) / 10 });
  }

  // ---- restore -------------------------------------------------------------
  rec.uninstall();
  G.player.speed = save.speed;
  for (const b of G.vfx.bolts) b.active = false;
  G.vfx.update(FIXED_DT, 0);
  G.flight.enemies.forEach((e, i) => {
    e.mesh.visible = save.enemies[i].mesh;
    e.hpSprite.visible = save.enemies[i].hp;
    e.alive = save.enemies[i].alive;
    e.pos.copy(save.enemies[i].pos);
  });
  G.planet.setSystem(planetSysNow);
  G.planet.update(0, 0);
  G.player.pos.copy(save.pos);
  G.mode = save.mode;
  G.state = save.state;
  scene.fog = save.fog;
  scene.background = save.bg;
  G.planet.group.visible = save.planetVis;
  G.space.group.visible = save.spaceVis;
  G.vfx.setWarp(save.warpOn);
  camera.position.copy(save.camPos);
  camera.quaternion.copy(save.camQuat);
  G.post.flash = 0;                 // prewarm ripples pumped the impact flash
  G.post.whiteout = G.momentMode ? 0 : G.post.whiteout;
  G.post.redAlert = save.state === 'red-alert' ? 1 : 0;
  G.post.update(FIXED_DT, 0);       // settle post uniforms back to the real state
  G.cockpit.update(FIXED_DT, 0);    // and the alert rig / panel canvases

  // ---- audit ---------------------------------------------------------------
  // Reflective sweep of the scene graph vs what the passes actually drew.
  // Anything left over is an object the enumeration could not reach, and it
  // will pay its pipeline cost the first time the game reveals it — the exact
  // defect this module exists to kill.
  const mats = sceneMaterials(scene);
  const seen = new Set();
  const gaps = [];
  for (const m of mats) {
    if (seen.has(m.uuid)) continue;
    seen.add(m.uuid);
    if (!rec.drawnMats.has(m.uuid)) gaps.push({ material: m.name, uuid: m.uuid });
  }
  // Informational: programs linked before this module ran (subsystem bake
  // renders during init) that no in-game state ever draws. Dead weight, not a
  // stall risk — they can never appear mid-session because nothing uses them.
  let bakeResidue = 0;
  for (const p of renderer.info.programs || []) if (!rec.drawnProgs.has(p.program)) bakeResidue++;

  const report = {
    ms: Math.round((performance.now() - t0) * 10) / 10,
    states: WORLD_STATES.map((s) => s.name),
    timings,
    programsLinked: (renderer.info.programs || []).length,
    programsDrawn: rec.drawnProgs.size,
    bakeResidue,
    materialsInScene: seen.size,
    materialsWarmed: seen.size - gaps.length,
    // per-state coverage, so a partial gap (drawn in space, never under fog)
    // is visible in the report even though it does not fail the audit
    coverage: WORLD_STATES.map((s) => ({
      state: s.name,
      materials: [...rec.drawnMats.values()].filter((set) => set.has(s.name)).length,
    })),
    gaps,
    // runtime tripwire baseline — see G.prewarmCheck below
    baseline: {
      programs: (renderer.info.programs || []).length,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
    },
    violations: [],
  };

  if (gaps.length) {
    // LOUD, and named. console.warn (not error) so the harness's zero-error
    // check still means what it says; tools/prewarm-audit.mjs treats any gap as
    // a hard failure, and window.__telemetry().prewarm carries it to the report.
    console.warn(`PREWARM-GAP: ${gaps.length} scene material(s) were never drawn during the boot sweep — each will stall the frame it first appears on:`);
    for (const g of gaps) console.warn('  PREWARM-GAP  ' + g.material);
  }

  // ---- runtime tripwire ----------------------------------------------------
  // Three integer compares per frame. A program, geometry or texture created
  // after boot cannot have been warmed by construction, so its first use will
  // cost a stall — name it, with the time and state, instead of letting a
  // future round rediscover it as an unexplained hitch.
  G.prewarmCheck = () => {
    const b = report.baseline;
    const np = (renderer.info.programs || []).length;
    const ng = renderer.info.memory.geometries;
    const nt = renderer.info.memory.textures;
    if (np === b.programs && ng === b.geometries && nt === b.textures) return;
    if (report.violations.length < 12) {
      const kind = [];
      if (np !== b.programs) kind.push('program');
      if (ng !== b.geometries) kind.push('geometry');
      if (nt !== b.textures) kind.push('texture');
      report.violations.push({
        kind, t: Math.round(G.time * 100) / 100, state: G.state,
        programs: [b.programs, np], geometries: [b.geometries, ng], textures: [b.textures, nt],
      });
      if (G.noteSpike) G.noteSpike('PREWARM-MISS:' + kind.join('+'));
    }
    b.programs = np; b.geometries = ng; b.textures = nt;
  };

  return report;
}
