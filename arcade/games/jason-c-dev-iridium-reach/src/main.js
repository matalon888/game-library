// main.js — boot, seeded RNG, state machine, input, harness API
// (__ready / __settle / __telemetry / __sessionDone), moment poser (?moment=1..5)
// and the scripted autopilot session (?session=1).
import * as THREE from 'three';
import { initPost } from './post.js';
import { initAudio } from './audio.js';
import { initSpace } from './space.js';
import { initPlanet } from './planet.js';
import { initVfx } from './vfx.js';
import { initFlight } from './flight.js';
import { initCockpit } from './cockpit.js';
import { runPrewarm } from './prewarm.js';

// ---------------- error capture (before anything can throw) ----------------
const errors = [];
window.addEventListener('error', (e) => errors.push(String(e.message || e.error || e)));
window.addEventListener('unhandledrejection', (e) => errors.push('unhandledrejection: ' + String(e.reason)));

// ---------------- URL params ----------------
const qs = new URLSearchParams(location.search);
const SEED = Math.max(1, parseInt(qs.get('seed') || '1', 10) || 1);
const MOMENT = parseInt(qs.get('moment') || '0', 10) || 0;
const SESSION = qs.get('session') === '1';
const FIXEDSTEP = qs.get('fixedstep') === '1';
const FIXED_DT = 1 / 60;
// HARNESS TRANSPARENCY: any harness-facing param disables the whole UI layer —
// ui.js is never imported, no DOM is injected, no listener behavior changes.
const HARNESS = SESSION || MOMENT > 0 || qs.get('harness') === '1';
// ?dietest=1 — accelerated-death test hook (x8 incoming damage, flight.js).
// NOT a harness param by itself: absent from default sessions, so default
// determinism is untouched. Under HARNESS death still soft-respawns;
// in human play it reaches the destruction sequence quickly. See HARNESS.md.
const DIETEST = qs.get('dietest') === '1';
// ?autoplay=1 (r10) — run the scripted autopilot in HUMAN-PLAY mode: the UI
// layer still loads, the start overlay still gates the launch, the score HUD
// still paints and hull<=0 still runs the destruction sequence into the
// GAME OVER panel. Deliberately NOT a harness param: it exists so a test can
// watch score EARNED by real kills propagate to the rendered DOM and to the
// localStorage high score, which no harness boot can observe (harness boots
// inject zero DOM). See tools/score-e2e.mjs and HARNESS.md.
const AUTOPLAY = qs.get('autoplay') === '1';
// the autopilot drives the ship in both — free-play wave spawning and
// proximity planet entry must stand down for either
const SCRIPTED = SESSION || AUTOPLAY;

// ---------------- seeded RNG ----------------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function strHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ---------------- name generator ----------------
const SYL_A = ['Ga', 'Uk', 'Pe', 'Vo', 'Ny', 'Ze', 'Ta', 'Ori', 'Kel', 'Ha', 'Iri', 'Mo', 'Su', 'Ren'];
const SYL_B = ['dis', 'ubu', 'hae', 'ran', 'lo', 'mir', 'ket', 'va', 'dun', 'shi', 'gor', 'nal'];
const SYL_C = ['Beta', 'Prime', 'Major', 'IX', 'VII', 'Minor', 'Reach', 'Expanse', 'III', 'Sigma'];
const SHIP_A = ['Golden', 'Crimson', 'Silent', 'Radiant', 'Umber', 'Azure', 'Solar', 'Feral'];
const SHIP_B = ['Vector', 'Pride', 'Lance', 'Harrier', 'Songbird', 'Talon', 'Meridian', 'Wake'];
function genSystemName(rng) {
  return SYL_A[(rng() * SYL_A.length) | 0] + SYL_B[(rng() * SYL_B.length) | 0] + ' ' + SYL_C[(rng() * SYL_C.length) | 0];
}
function genPlanetName(rng) {
  return SYL_A[(rng() * SYL_A.length) | 0] + SYL_B[(rng() * SYL_B.length) | 0] + SYL_B[(rng() * SYL_B.length) | 0];
}

// ---------------- renderer / scene / camera ----------------
// R11-PERF: antialias was `true`, which allocates a 4x-multisampled 1920x1080
// default drawing buffer and resolves it on every present. Nothing the game
// draws ever touches that buffer directly: EffectComposer renders the scene
// and every post pass into its OWN render targets, and the only draw that ever
// lands on the default framebuffer is the final ShaderPass's fullscreen quad.
// A quad that covers every sample of every pixel has one fragment value per
// pixel, so the multisample resolve returns exactly that value — the presented
// image is identical, and the MSAA storage and resolve are pure cost.
// Measured on posed moment 4 at 1920x1080, paired arms in the same contention
// bracket: -0.24, -0.35, -0.39 ms/frame (three clean pairs; the machine had
// three other workers on it and the dirty pairs are reported in REPORT.md).
// Byte-identity of all five posed moments verified with tools/moment-diff.mjs.
// The frame's antialiasing does not come from MSAA in any case — the composer
// has no MSAA and no TAA history, and post.js's 4-tap capture-softness block
// is explicitly documented as "the only place frame softness can come from".
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // final pass does the grade
renderer.info.autoReset = false;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030208);
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.08, 300000);
scene.add(camera);

// ---------------- shared context ----------------
const G = {
  scene, camera, renderer,
  seed: SEED,
  rngFor: (name) => mulberry32((SEED * 2654435761 + strHash(name)) >>> 0),
  state: 'cruise',
  mode: 'space',           // 'space' | 'planet'
  systemIndex: 0,
  momentMode: MOMENT > 0,
  autopilot: null,
  time: 0,
  // HUD-facing combat/warp state (cockpit.js reads these):
  warpEta: 0,    // seconds until warp exit (counts down through warp-charge + warp)
  target: null,  // nearest alive hostile: { name, hp, maxHp } — null when clear
  poseSway: false, // moment poses: deterministic micro-sway on the camera
  input: { pitch: 0, yaw: 0, roll: 0, thrust: 0.6, boost: false, brake: false, fire: false },
  player: {
    pos: new THREE.Vector3(0, 0, 0),
    quat: new THREE.Quaternion(),
  },
  names: { system: '', nextSystem: '', planet: '', ship: '' },
  telemetryData: {
    wave: 0, shotsFired: 0, hitsRegistered: 0, enemiesKilled: 0,
    enemyShotsFired: 0, enemyEvadeEvents: 0, enemyLeadShots: 0,
    warpCount: 0, redAlertsEntered: 0,
    boostSeconds: 0, brakeTurns: 0, waveStats: [],
    // r9 gameplay-systems package
    score: 0, deaths: 0, wavesCleared: 0, waveBonusTotal: 0,
    enemyClassStats: {},
    // r10: death has a score consequence wherever the run continues
    // (soft-respawn only — see flight.damagePlayer + DECISIONS-gameplay.md)
    scoreLostToDeaths: 0,
    // r10: the session failsafe declares itself instead of dressing a handed
    // wave up as an earned one (autopilot.forceClear)
    forceCleared: false, forceClearedKills: 0,
    // r15 cannon heat upgrade — MK I / cap 1 is the round-14 cannon exactly
    cannonMk: 1, cannonHeatCap: 1, cannonUpgrades: 0,
  },
  camOffset: new THREE.Quaternion(), // posed camera cant/shake (moments only)
  // human-play tuning (ui.js overwrites from localStorage; harness boots keep
  // these exact defaults so the mouse-steer math is bit-identical)
  settings: { sensitivity: 1.0, invertY: false },
};
G.harness = HARNESS; // flight.js branches death handling on this (see damagePlayer)
G.dietest = DIETEST;
if (!HARNESS) {
  // sim holds behind the start overlay from the very first frame; ui.js
  // (dynamically imported at the end of boot) flips these on click-to-fly
  G.uiHold = true;
  G.uiState = 'start';
}

{
  const nrng = G.rngFor('names0');
  G.names.system = genSystemName(nrng);
  G.names.nextSystem = genSystemName(nrng);
  G.names.planet = genPlanetName(nrng);
  G.names.ship = SHIP_A[(nrng() * SHIP_A.length) | 0] + ' ' + SHIP_B[(nrng() * SHIP_B.length) | 0];
}

// ---------------- subsystems ----------------
initAudio(G);
initSpace(G);
initPlanet(G);
initVfx(G);
initFlight(G);
initCockpit(G);
initPost(G);

G.space.setSystem(0);
G.planet.setSystem(0);
let planetSysNow = 0; // which system the planet subsystem currently holds (prewarm restore)

// ---------------- mode switching ----------------
function enterPlanetMode(altitude = 2400) {
  if (G.noteSpike) G.noteSpike('planet-enter');
  G.mode = 'planet';
  G.space.setVisible(false);
  G.planet.setVisible(true);
  const pal = G.planet.palette();
  scene.fog = new THREE.FogExp2(pal.haze, 0.00035);
  scene.background = new THREE.Color(pal.horizon);
  const ground = G.planet.heightAt(G.player.pos.x, G.player.pos.z);
  G.player.pos.y = ground + altitude;
  G.post.whiteout = 1;
  if (G.state !== 'combat' && G.state !== 'red-alert') G.state = 'planet';
}
function exitPlanetMode() {
  if (G.noteSpike) G.noteSpike('planet-exit');
  G.mode = 'space';
  G.planet.setVisible(false);
  G.space.setVisible(true);
  scene.fog = null;
  scene.background = new THREE.Color(0x030208);
  G.player.pos.set(G.player.pos.x, 0, G.player.pos.z);
  G.post.whiteout = 1;
  if (G.state !== 'combat' && G.state !== 'red-alert') G.state = 'cruise';
}
G.enterPlanetMode = enterPlanetMode;
G.exitPlanetMode = exitPlanetMode;

G.enterRedAlert = () => {
  if (G.state === 'red-alert') return;
  // shields-down never interrupts hyperspace sequencing
  if (G.state === 'warp' || G.state === 'warp-charge' || G.state === 'arrive') return;
  if (G.state === 'destroyed') return;
  G.state = 'red-alert';
  G.telemetryData.redAlertsEntered++;
  // r15: shield-down hangs off the red-alert transition rather than off
  // damagePlayer's shield<=0 branch, so every path into red alert gets the
  // line and the three early-returns above suppress it for free (a line
  // announcing the shields are gone during a warp tunnel would be nonsense).
  if (G.audio && G.audio.say) G.audio.say('shield-down');
};

// ---------------- ship destruction (human play only) ----------------
// flight.js calls this at hull <= 0 when !G.harness. Under ANY harness param
// the r8 soft-respawn runs instead — scripted critic sessions never see this
// path (same gating pattern as the ui.js overlay). Sequence: detonation
// flash + explosion at the ship, ~3s of camera tumble while the wreck
// drifts, then freeze-frame + GAME OVER overlay (ui.js registers onGameOver).
const DESTRUCT_SECONDS = 3.0;
let destruct = null; // { spin: axis, rate }
G.beginDestruction = () => {
  if (G.harness || G.state === 'destroyed') return;
  const drng = G.rngFor('destruct');
  destruct = {
    spin: new THREE.Vector3(drng() * 2 - 1, drng() * 2 - 1, drng() * 2 - 1).normalize(),
    rate: 0,
  };
  G.state = 'destroyed';
  SM.timer = DESTRUCT_SECONDS;
  G.vfx.explode(G.player.pos, 2.4);
  G.post.hit(1);
  G.post.whiteout = Math.max(G.post.whiteout, 0.8); // detonation flash, decays in ~0.6s
  if (G.audio) {
    G.audio.explosion && G.audio.explosion();
    G.audio.klaxonOff && G.audio.klaxonOff();
    // r15: game-over is alert-class, so it cuts off whatever flavour line the
    // pilot's last kill started. The ship exploding outranks a compliment.
    G.audio.say && G.audio.say('game-over');
  }
};

// ---------------- staged next-system build ----------------
// Rebuilding the destination system synchronously at warp-exit was round-1's
// biggest frame spike (p1low 32fps). The build is now staged across the ~10s
// of warp-charge + warp. If planet.js ships an incremental builder
// (beginBuild/stepBuild), we drive it a few ms per frame; otherwise we fall
// back to spreading the synchronous calls one per frame, hidden inside the
// tunnel where the outside world isn't visible anyway.
const _preScatterPos = new THREE.Vector3();
const _warpFwd = new THREE.Vector3();
const _tumbleQ = new THREE.Quaternion(); // destruction camera tumble
function prescatterFlora(sys) {
  // Trigger the flora scatter for the post-warp landing cell NOW (mid-warp)
  // instead of on first planet frame. The landing x/z is deterministic.
  const P = G.player.pos;
  _preScatterPos.copy(P);
  P.set(sys * 40000, 0, 0);
  const wasVis = G.planet.group.visible;
  G.planet.group.visible = true;
  G.planet.update(0, G.time);
  G.planet.group.visible = wasVis;
  P.copy(_preScatterPos);
}

// ---------------- state machine ----------------
const SM = {
  timer: 0,
  freeWaveTimer: 14, // free play: first wave after 14s of cruising
  build: null,       // staged destination-system build (see above)
  set(state, t = 0) { G.state = state; SM.timer = t; },
  beginSystemBuild(sys) {
    const hasWorkerBuild = !!(G.planet.beginBuild && G.planet.stepBuild);
    SM.build = {
      sys,
      hasWorkerBuild,
      planetDone: false,
      spaceDone: false,
      // the incremental builder owns flora staging; sync path pre-scatters
      scatterDone: hasWorkerBuild,
    };
    if (hasWorkerBuild) G.planet.beginBuild({ system: sys, seed: G.seed });
  },
  stepSystemBuild() {
    const b = SM.build;
    if (!b) return;
    if (b.hasWorkerBuild && !b.planetDone) {
      G.noteSpike('planet-build-step');
      if (G.planet.stepBuild(4) >= 1) b.planetDone = true;
      return; // one build task per frame
    }
    // space.setSystem queues ~10 sky-bake tasks that space.update drains one
    // per frame — tag that window so spikes inside it are attributable
    if (b.bakeFrames > 0) { b.bakeFrames--; G.noteSpike('sky-bake-step'); }
    // sync-fallback steps only run once the tunnel fully covers the view
    if (G.state !== 'warp' || SM.timer > 5.5) return;
    if (!b.planetDone) { G.noteSpike('planet-setSystem'); G.planet.setSystem(b.sys); b.planetDone = true; return; }
    if (!b.spaceDone) {
      G.noteSpike('space-setSystem');
      G.space.setSystem(b.sys);
      b.spaceDone = true;
      b.bakeFrames = 12; // 6 cubemap faces + 4 star layers drain over the next frames
      return;
    }
    if (!b.scatterDone) { G.noteSpike('flora-prescatter'); prescatterFlora(b.sys); b.scatterDone = true; return; }
  },
  finishSystemBuild() {
    // safety net at warp exit — anything unfinished lands synchronously here
    const b = SM.build;
    if (!b) return;
    if (!b.planetDone || !b.spaceDone) G.noteSpike('warp-exit-drain');
    if (b.hasWorkerBuild && !b.planetDone) {
      let guard = 0;
      while (G.planet.stepBuild(8) < 1 && ++guard < 500) { /* drain */ }
      b.planetDone = true;
    }
    if (!b.planetDone) G.planet.setSystem(b.sys);
    if (!b.spaceDone) G.space.setSystem(b.sys);
    SM.build = null;
  },
  handleWaveEnd(baseState) {
    G.flight.endWave();
    if (G.mode === 'space') {
      SM.set('warp-charge', 3.5);
      const nrng = G.rngFor('names' + (G.systemIndex + 1));
      G.names.nextSystem = genSystemName(nrng);
      G.audio.warpSwell();
      G.audio.say && G.audio.say('warp-charge');
      SM.beginSystemBuild(G.systemIndex + 1);
    } else {
      SM.set(baseState);
      SM.freeWaveTimer = 25;
    }
  },
  update(dt) {
    if (G.momentMode) return; // posed captures never advance the loop
    const F = G.flight;
    const baseState = G.mode === 'planet' ? 'planet' : 'cruise';

    // HUD warp countdown: charge phase still has the full 6.5s tunnel ahead
    G.warpEta = G.state === 'warp-charge' ? SM.timer + 6.5
      : G.state === 'warp' ? Math.max(0, SM.timer)
      : 0;

    switch (G.state) {
      case 'cruise':
      case 'planet':
        if (F.aliveCount() > 0 || (F.wave.active && F.wave.toSpawn > 0)) { SM.set('combat'); break; }
        if (!SCRIPTED) {
          SM.freeWaveTimer -= dt;
          if (SM.freeWaveTimer <= 0) {
            F.startWave(F.wave.num + 1);
            SM.freeWaveTimer = 30;
          }
        }
        break;

      case 'combat':
        if (G.player.shield <= 0) { G.enterRedAlert(); break; }
        if (F.waveCleared()) SM.handleWaveEnd(baseState);
        break;

      case 'red-alert':
        if (G.player.shield > 25) {
          if (F.aliveCount() > 0) SM.set('combat');
          else if (F.waveCleared()) SM.handleWaveEnd(baseState);
          else SM.set(baseState);
        }
        break;

      case 'warp-charge':
        SM.stepSystemBuild();
        SM.timer -= dt;
        if (SM.timer <= 0) {
          G.noteSpike('warp-on');
          SM.set('warp', 6.5);
          G.vfx.setWarp(true);
          G.telemetryData.warpCount++;
        }
        break;

      case 'warp': {
        SM.stepSystemBuild();
        SM.timer -= dt;
        // ram forward through hyperspace
        _warpFwd.set(0, 0, -1).applyQuaternion(G.player.quat);
        G.player.pos.addScaledVector(_warpFwd, 2600 * dt);
        if (SM.timer <= 0) {
          G.noteSpike('warp-off');
          G.vfx.setWarp(false);
          G.systemIndex++;
          G.names.system = G.names.nextSystem;
          const nrng = G.rngFor('pnames' + G.systemIndex);
          G.names.planet = genPlanetName(nrng);
          SM.finishSystemBuild(); // usually a no-op: staged during the tunnel
          G.player.pos.set(G.systemIndex * 40000, 0, 0);
          G.player.vel && G.player.vel.set(0, 0, 0);
          G.post.whiteout = 1;
          SM.set('arrive', 2.5);
          G.audio.say && G.audio.say('arrival');   // r15
        }
        break;
      }

      case 'arrive':
        SM.timer -= dt;
        if (SM.timer <= 0) {
          SM.set('cruise');
          SM.freeWaveTimer = 15;
        }
        break;

      case 'destroyed': {
        // human play only (flight.js gates on !G.harness before entering).
        // Dead stick: the wreck tumbles, rotation rate ramping in; velocity
        // bleeds off. At timer end the frame freezes under the game-over
        // panel (ui.js dims it with its own scrim — no full whiteout here,
        // the wreck view IS the game-over backdrop).
        SM.timer -= dt;
        if (destruct) {
          destruct.rate = Math.min(2.4, destruct.rate + dt * 2.0);
          _tumbleQ.setFromAxisAngle(destruct.spin, destruct.rate * dt);
          G.player.quat.multiply(_tumbleQ).normalize();
          if (G.player.vel) G.player.vel.multiplyScalar(Math.max(0, 1 - dt * 0.9));
        }
        if (SM.timer <= 0) {
          destruct = null;
          G.uiHold = true;      // freeze the sim under the panel
          G.uiState = 'gameover';
          const T = G.telemetryData;
          if (G.onGameOver) {
            G.onGameOver({
              score: T.score,
              wavesCleared: T.wavesCleared,
              systemsReached: G.systemIndex + 1,
              enemiesKilled: T.enemiesKilled,
            });
          }
        }
        break;
      }
    }

    // free-play planet entry/exit
    if (!SCRIPTED && G.mode === 'space' && (G.state === 'cruise')) {
      const { dist } = G.space.nearestPlanet();
      if (dist < 3500) enterPlanetMode();
    }
    if (G.mode === 'planet' && G.player.pos.y >= 5190 && G.input.pitch > 0.3) {
      exitPlanetMode();
    }
  },
};

// ---------------- input ----------------
const keys = {};
window.addEventListener('keydown', (e) => { keys[e.code] = true; });
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
let mouseDX = 0, mouseDY = 0, mouseDown = false;
renderer.domElement.addEventListener('mousedown', () => {
  mouseDown = true;
  if (!SESSION && !MOMENT && document.pointerLockElement !== renderer.domElement) {
    renderer.domElement.requestPointerLock?.();
  }
});
window.addEventListener('mouseup', () => { mouseDown = false; });
window.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === renderer.domElement) {
    mouseDX += e.movementX; mouseDY += e.movementY;
  }
});

function pollInput(dt) {
  if (SCRIPTED || MOMENT) return; // scripted control
  const inp = G.input;
  inp.pitch = (keys.ArrowUp ? -1 : 0) + (keys.ArrowDown ? 1 : 0);
  inp.yaw = (keys.ArrowLeft ? 1 : 0) + (keys.ArrowRight ? -1 : 0);
  inp.roll = (keys.KeyA ? 1 : 0) + (keys.KeyD ? -1 : 0);
  // mouse steer — sensitivity + invert-Y applied LIVE from G.settings
  // (ui.js mutates these; harness boots keep {1.0, false} so this line is
  // numerically identical to the pre-UI build)
  const sens = 0.02 * G.settings.sensitivity;
  const invY = G.settings.invertY ? -1 : 1;
  inp.pitch += THREE.MathUtils.clamp(-mouseDY * sens * invY, -1, 1);
  inp.yaw += THREE.MathUtils.clamp(-mouseDX * sens, -1, 1);
  mouseDX *= 0.5; mouseDY *= 0.5;
  inp.thrust = keys.KeyW ? 1 : (keys.KeyS ? -0.25 : 0.55);
  inp.boost = !!keys.ShiftLeft || !!keys.ShiftRight;
  inp.brake = !!keys.Space || !!keys.ControlLeft;
  inp.fire = mouseDown || !!keys.KeyF;
}

// ---------------- autopilot (?session=1) ----------------
const _apDir = new THREE.Vector3(), _apLocal = new THREE.Vector3(), _apInv = new THREE.Quaternion();
const _apAim = new THREE.Vector3(), _apFwd = new THREE.Vector3(), _apRight = new THREE.Vector3();
const _apAimDir = new THREE.Vector3();
const _apPerp = new THREE.Vector3(), _apPerpSide = new THREE.Vector3();
const autopilot = SCRIPTED ? {
  phase: 'spawn', phaseT: 0, aimDir: null,
  dmgTimer: 0, scriptedDamageDone: false, wobble: 0,
  burstT: 0,          // sustained-burst rhythm so bolts are usually airborne
  holdKillUntil: 0,   // don't finish the last enemy before the snapshot mark
  holdAnyKillUntil: 0, // suppress near-death targets so kills (and their
                       // explosions) land JUST AFTER this mark — tuned so the
                       // 20s/50s session snapshots catch a kill on screen
  // robust wave-done check: does not depend on wave.active (the state machine
  // may have already called endWave on the same frame it cleared)
  waveDone(F) { return F.wave.toSpawn === 0 && F.aliveCount() === 0; },
  update(dt) {
    const F = G.flight, P = G.player, inp = G.input, t = G.time;
    this.phaseT += dt;
    this.wobble += dt;
    this.burstT += dt;
    inp.boost = false; inp.brake = false; inp.fire = false;
    this.aimDir = null;

    const steerTo = (targetPos) => {
      _apDir.copy(targetPos).sub(P.pos);
      const dist = _apDir.length();
      _apDir.normalize();
      _apInv.copy(P.quat).invert();
      _apLocal.copy(_apDir).applyQuaternion(_apInv);
      inp.pitch = THREE.MathUtils.clamp(_apLocal.y * 3.2, -1, 1);
      inp.yaw = THREE.MathUtils.clamp(-_apLocal.x * 3.2, -1, 1);
      inp.roll = THREE.MathUtils.clamp(-_apLocal.x * 0.7, -0.5, 0.5);
      return dist;
    };

    const fightNearest = () => {
      let best = null, bd = Infinity;
      for (const e of F.enemies) {
        if (!e.alive) continue;
        const d = e.pos.distanceToSquared(P.pos);
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) return false;
      // lead the shot: bolt inherits player velocity
      const dist = best.pos.distanceTo(P.pos);
      const tof = dist / 620;
      _apAim.copy(best.pos)
        .addScaledVector(best.vel, tof)
        .addScaledVector(P.vel, -tof * 0.9);
      // human-ish error — enough wobble that fights take real time
      _apAim.x += Math.sin(this.wobble * 3.1) * dist * 0.022;
      _apAim.y += Math.cos(this.wobble * 2.3) * dist * 0.022;
      // pacing: until the snapshot mark passes, the pilot "can't finish" a
      // nearly-dead last enemy — fire goes deliberately wide (suppressive),
      // so bolts stay airborne but the kill lands after the mark. A hard
      // hold-fire gate can't do this: bolts already in flight land the kill.
      if ((t < this.holdKillUntil && F.aliveCount() === 1) ||
          (t < this.holdAnyKillUntil && best.hp <= 70)) {
        const side = Math.sin(this.wobble * 0.9) > 0 ? 1 : -1;
        // offset PERPENDICULAR to the firing line (a world-axis offset can
        // silently align with the line of fire and stop missing)
        _apPerp.copy(best.pos).sub(P.pos).normalize();
        _apPerpSide.set(0, 1, 0).cross(_apPerp);
        if (_apPerpSide.lengthSq() < 0.01) _apPerpSide.set(1, 0, 0);
        _apPerpSide.normalize();
        _apAim.addScaledVector(_apPerpSide, side * Math.max(dist * 0.09, 30));
        _apAim.y += dist * 0.03;
      }
      steerTo(_apAim);
      _apAimDir.copy(_apAim).sub(P.pos).normalize();
      inp.thrust = dist > 450 ? 1 : (dist < 120 ? 0.35 : 0.75);
      inp.boost = dist > 520 && _apLocal.z < -0.5; // burn in when the target runs
      inp.brake = _apLocal.z > -0.4; // target far off-nose: brake-turn
      // sustained bursts: ~0.75s firing / 0.3s pause while roughly on-nose;
      // ease off before overheat — a locked cannon means 2+ seconds with no
      // tracers on screen
      const burstOpen = (this.burstT % 1.05) < 0.75 && P.heat < 0.78;
      if (_apLocal.z < -0.80 && dist < 900 && burstOpen) {
        inp.fire = true;
        this.aimDir = _apAimDir;
      }
      return true;
    };

    switch (this.phase) {
      case 'spawn':
        inp.thrust = 0.5;
        if (this.phaseT > 1) { this.phase = 'cruise'; this.phaseT = 0; }
        break;
      case 'cruise':
        inp.thrust = 0.8;
        inp.yaw = Math.sin(t * 0.4) * 0.12;
        inp.pitch = Math.sin(t * 0.3) * 0.06;
        if (this.phaseT > 5) {
          F.startWave(1);
          this.phase = 'combat1'; this.phaseT = 0;
          this.holdKillUntil = 21; // combat must still be live at the 20s snapshot
          this.holdAnyKillUntil = 18.5; // first kill+explosion lands ~19-21s -> on the 20s frame
          // (21/18.5 not 23: wave-1 overrun here delays wave 2 past the 50s snapshot)
        }
        break;
      case 'combat1': {
        fightNearest();
        // hold fire for the opening seconds so the scripted red alert always
        // lands before the wave can be cleared
        if (this.phaseT < 3.5) { inp.fire = false; }
        // scripted damage intake drives shields to 0 -> red alert
        if (this.phaseT > 4 && !this.scriptedDamageDone && F.aliveCount() > 0) {
          this.dmgTimer -= dt;
          if (this.dmgTimer <= 0) {
            this.dmgTimer = 0.25;
            F.damagePlayer(12);
            if (P.shield <= 0) this.scriptedDamageDone = true;
          }
        }
        if (this.phaseT > 1 && this.waveDone(F)) { this.phase = 'awaitWarp'; this.phaseT = 0; }
        // failsafe kill switch
        if (t > 70) this.forceClear();
        break;
      }
      case 'awaitWarp':
        // state machine handles warp-charge -> warp -> arrive
        inp.thrust = 0.6;
        if (G.state === 'arrive' || (G.state === 'cruise' && G.systemIndex >= 1)) {
          this.phase = 'descend'; this.phaseT = 0;
          // 800m, shallower dive: the steep 1100m entry swept a huge terrain
          // frustum and was the clean run's worst GPU-bound window (~50ms
          // render-submit frames at atmosphere entry)
          enterPlanetMode(800);
        }
        break;
      case 'descend': {
        inp.thrust = 1;
        inp.boost = P.altitude > 450;
        // moderate dive angle: keeps the horizon (not the whole cell) in frame
        const targetPitch = P.altitude > 600 ? -0.60 : (P.altitude > 220 ? -0.28 : 0.1);
        _apFwd.set(0, 0, -1).applyQuaternion(P.quat);
        inp.pitch = THREE.MathUtils.clamp((targetPitch - Math.asin(THREE.MathUtils.clamp(_apFwd.y, -1, 1))) * 2, -1, 1);
        inp.yaw = 0;
        // keep wings level
        _apRight.set(1, 0, 0).applyQuaternion(P.quat);
        inp.roll = THREE.MathUtils.clamp(-_apRight.y * 2, -1, 1);
        if (P.altitude < 200 || this.phaseT > 20) { this.phase = 'lowflight'; this.phaseT = 0; }
        break;
      }
      case 'lowflight': {
        inp.thrust = 0.85;
        // hold ~150m, gentle S-turns over the terrain
        const err = (150 - P.altitude) / 150;
        _apFwd.set(0, 0, -1).applyQuaternion(P.quat);
        inp.pitch = THREE.MathUtils.clamp(err * 0.8 - _apFwd.y * 1.4, -0.6, 0.6);
        inp.yaw = Math.sin(t * 0.5) * 0.25;
        _apRight.set(1, 0, 0).applyQuaternion(P.quat);
        inp.roll = THREE.MathUtils.clamp(-_apRight.y * 2 + Math.sin(t * 0.5) * 0.2, -1, 1);
        if (this.phaseT > 1.2 || t > 44) {
          F.startWave(2);
          this.phase = 'combat2'; this.phaseT = 0;
          this.holdKillUntil = 54; // combat must still be live at the 50s snapshot
          this.holdAnyKillUntil = 49; // kills cluster ~49.5-52s -> explosion on the 50s frame
        }
        break;
      }
      case 'combat2': {
        if (!fightNearest()) {
          // hold altitude while the wave finishes spawning
          const err = (200 - P.altitude) / 200;
          inp.pitch = THREE.MathUtils.clamp(err * 0.6, -0.5, 0.5);
          inp.thrust = 0.7;
        }
        if (this.phaseT > 1 && this.waveDone(F)) {
          F.endWave();
          this.phase = 'done'; this.phaseT = 0;
          window.__sessionDone = true;
        }
        if (t > 155) this.forceClear();
        break;
      }
      case 'done':
        inp.thrust = 0.5;
        inp.pitch = 0; inp.yaw = 0; inp.roll = 0;
        break;
    }
  },
  forceClear() {
    // Deterministic failsafe so the session always finishes inside the window.
    //
    // r10 — this path is now DECLARED in telemetry. r9's version silently
    // incremented hitsRegistered and enemiesKilled exactly as an earned kill
    // would, so a wave handed to the player was indistinguishable from one
    // fought for. It did not fire in the r9 run, which is luck, not safety.
    // Two changes: hitsRegistered is no longer faked (no bolt connected with
    // anything — that counter now means bolts that actually hit), and every
    // failsafe kill is flagged and counted separately.
    const F = G.flight;
    F.wave.toSpawn = 0;
    for (const en of F.enemies) {
      if (en.alive) {
        G.telemetryData.forceCleared = true;
        G.telemetryData.forceClearedKills++;
        G.telemetryData.enemiesKilled++;
        F.creditKill(en); // score stays sum(class points x mult) on the failsafe path too
        en.alive = false;
        en.mesh.visible = false;
        G.vfx.explode(en.pos, 1.2);
      }
    }
  },
} : null;
G.autopilot = autopilot;

// ---------------- moment poser ----------------
function poseMoment(m) {
  const P = G.player, F = G.flight;
  const rng = G.rngFor('moment' + m);
  P.quat.identity();
  P.pos.set(0, 0, 0);
  P.vel.set(0, 0, 0);
  G.camOffset.identity();
  G.input.thrust = 0;

  if (m === 1) {
    // warp tunnel — ref-1: convergence OFF-CENTRE with a slight camera
    // cant/yaw (the tunnel follows the ship axis; the pilot's head doesn't),
    // plus live micro-sway so the frame never reads as a locked tripod shot
    G.state = 'warp';
    G.vfx.setWarp(true);
    P.vel.set(0, 0, 0);
    G.camOffset.setFromEuler(new THREE.Euler(0.07, -0.17, 0.12));
    G.poseSway = true; // deterministic head drift (see tick)
    G.warpEta = 4.2;   // HUD countdown mid-transit
    G.player.speed = 20471; // cosmetic: panel shows huge warp speed
  }

  if (m === 2) {
    // deep-space cruise — ref-2: nebula band + planet, warm cockpit, no enemies
    G.state = 'cruise';
    const pl = G.space.planets()[0];
    if (pl) {
      // stand off so the planet floats upper-left through the canopy
      const dir = new THREE.Vector3(0.22, 0.16, -1).normalize();
      const dist = pl.radius * 6.5;
      P.pos.copy(pl.mesh.position).addScaledVector(dir, dist);
      const look = new THREE.Matrix4().lookAt(P.pos, pl.mesh.position, new THREE.Vector3(0, 1, 0));
      P.quat.setFromRotationMatrix(look);
      // nudge so the planet sits off-centre
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.10, -0.14, 0));
      P.quat.multiply(q);
    }
    P.vel.set(0, 0, -1).applyQuaternion(P.quat).multiplyScalar(0.01);
    G.player.speed = 0;
  }

  if (m === 3) {
    // planet surface daylight — ref-3: ochre desert, flora, mountain, 80m up
    G.planet.setSystem(0);
    planetSysNow = 0;
    enterPlanetMode(80);
    G.post.whiteout = 0;
    G.state = 'planet';
    // find the biggest peak on a ring and face it
    let bestH = -1e9, bestA = 0;
    for (let a = 0; a < Math.PI * 2; a += 0.12) {
      const h = G.planet.heightAt(P.pos.x + Math.cos(a) * 2600, P.pos.z + Math.sin(a) * 2600);
      if (h > bestH) { bestH = h; bestA = a; }
    }
    const look = new THREE.Vector3(Math.cos(bestA), 0, Math.sin(bestA));
    const m4 = new THREE.Matrix4().lookAt(P.pos, P.pos.clone().add(look), new THREE.Vector3(0, 1, 0));
    P.quat.setFromRotationMatrix(m4);
    const ground = G.planet.heightAt(P.pos.x, P.pos.z);
    P.pos.y = ground + 80;
    P.vel.copy(look).multiplyScalar(0.01);
    G.player.speed = 78;
    G.player.altitude = 80;
  }

  if (m === 4) {
    // low-altitude combat — ref-4: green hills, cyan beams, player mid-BANK,
    // fighters close enough to actually read as ships.
    // R2 lesson: the roll WAS on the camera, but heavy haze makes the fog line
    // radially symmetric (orientation-free) so the frame still read level.
    // Fix: pose at the real system-2 location, face the OPEN valley so a hard
    // terrain-silhouette horizon crosses the canopy, then bank against it.
    G.systemIndex = 1;
    G.planet.setSystem(1);
    planetSysNow = 1;
    // real post-warp coords for system 2 — nav panel must not show 0.00, 0.00
    P.pos.set(40000, 0, -820);
    // refresh EVERYTHING the panels read (same rng streams the session uses)
    {
      const nrng = G.rngFor('names1');
      G.names.system = genSystemName(nrng);
      G.names.nextSystem = genSystemName(nrng);
      const prng = G.rngFor('pnames1');
      G.names.planet = genPlanetName(prng);
    }
    enterPlanetMode(300);
    G.post.whiteout = 0;
    G.state = 'combat';
    G.telemetryData.wave = 2;
    // face the most OPEN direction (lowest ring terrain near+far): guarantees
    // a long sightline whose silhouette line shows the bank
    let bestScore = 1e12, bestA = 0;
    for (let a = 0; a < Math.PI * 2; a += 0.10) {
      const h1 = G.planet.heightAt(P.pos.x + Math.cos(a) * 2400, P.pos.z + Math.sin(a) * 2400);
      const h2 = G.planet.heightAt(P.pos.x + Math.cos(a) * 5200, P.pos.z + Math.sin(a) * 5200);
      const score = h1 * 1.0 + h2 * 0.7;
      if (score < bestScore) { bestScore = score; bestA = a; }
    }
    const heading = new THREE.Vector3(Math.cos(bestA), 0, Math.sin(bestA));
    const lookM = new THREE.Matrix4().lookAt(P.pos, P.pos.clone().add(heading), new THREE.Vector3(0, 1, 0));
    P.quat.setFromRotationMatrix(lookM);
    // hard mid-turn bank (~43 deg, r3's 33 read as a hillside) + nose-down so
    // the terrain horizon line crosses the canopy corner-to-corner
    // r7 (flight worker diagnosis): 43.5° roll had NO visible agreeing line —
    // skyline read ~60°, fog wash read level. -0.54 (31°) matches the visible
    // silhouette; unlike r3's 33° attempt the pose now faces the open valley.
    P.quat.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.09, 0, -0.54)));
    const ground = G.planet.heightAt(P.pos.x, P.pos.z);
    P.pos.y = ground + 300;
    G.player.speed = 176;
    G.input.boost = true;   // boost chevrons lit — mid-manoeuvre, not parked
    G.player.altitude = 300;
    P.vel.set(0, 0, -1).applyQuaternion(P.quat).multiplyScalar(0.01);
    // 3 enemies through the canopy, frozen, firing cyan; aim offsets keep the
    // beams raking across the frame instead of foreshortening into dots.
    // [0]/[1] posed 3/4-on at range so wing planforms + livery catch the sun;
    // [2] is the CLOSE one (~160u) crossing the frame laterally, near side-on,
    // its beam raking hard across the view (ref-4's near fighter).
    // r5: far pair pulled ~20% closer (r4 critique: geometry unreadable at
    // pose distance — hull panels must read). Close crosser stays at ~160u.
    const spots = [
      new THREE.Vector3(-76, 70, -256),
      new THREE.Vector3(84, 56, -304),
      new THREE.Vector3(30, -12, -158),
    ];
    const aimOffs = [
      new THREE.Vector3(70, -30, 25),
      new THREE.Vector3(-55, -45, 10),
      // close crosser: was (-150,25,50) — beam raked nearly edge-to-edge and
      // read as a screen-wide bar. Tighter down-left offset keeps it a
      // raking PASS anchored at the fighter (vfx r5 caps posed beam length)
      new THREE.Vector3(-85, -25, 30),
    ];
    const poseTilt = [
      new THREE.Euler(0.10, 0.62, -0.55),
      new THREE.Euler(-0.06, -0.55, 0.70),
      new THREE.Euler(0.10, 0.85, -0.45),
    ];
    for (let i = 0; i < 3; i++) {
      const wp = spots[i].clone().applyQuaternion(P.quat).add(P.pos);
      wp.y = Math.max(wp.y, G.planet.heightAt(wp.x, wp.z) + 60);
      const en = F.spawnEnemy(wp, 1, 2);
      if (en) {
        en.frozen = true;
        en.scriptFire = 0.2 + i * 0.23;
        en.boltColor = 0x30f0ff;
        en.scriptAimOffset = aimOffs[i].applyQuaternion(P.quat);
        en.quat.setFromRotationMatrix(new THREE.Matrix4().lookAt(en.pos, P.pos, new THREE.Vector3(0, 1, 0)));
        en.quat.multiply(new THREE.Quaternion().setFromEuler(poseTilt[i]));
        en.hpSprite.visible = false;
        // r4's 6.5 halo swamped the hull silhouette into a green blob at pose
        // distance — with the closer pose + darker materials, a modest halo
        // reads as engines, not as the ship. r8: 5.0 STILL erased the centre
        // diving ship's hull ("an explosion with wings" — vfx critic); 2.5
        // matches m5's r6-halved value and lets the new engine-glow hull
        // wash carry the throttle read instead of the sprite.
        en.glowL.scale.set(2.5, 2.5, 1);
        en.glowR.scale.set(2.5, 2.5, 1);
      }
    }
  }

  if (m === 5) {
    // red-alert space combat — ref-5: cabin flooded red, SHIELD DOWN banner,
    // enemy with health number, incoming orange fire + player bolts out,
    // ~140u/s on the speed readout, slight camera-shake pose
    G.systemIndex = 1;
    G.space.setSystem(1);
    // refresh nav state for system 2 (r2: panels showed system-1 names + 0,0)
    {
      const nrng = G.rngFor('names1');
      G.names.system = genSystemName(nrng);
      G.names.nextSystem = genSystemName(nrng);
      const prng = G.rngFor('pnames1');
      G.names.planet = genPlanetName(prng);
    }
    P.pos.set(-3694, 0, 1726); // non-origin coords on the nav readout
    G.state = 'red-alert';
    // r13: same INCREMENT as G.enterRedAlert(), not `= 1`. The counter was 0
    // here, so the value is unchanged (1) and the pose stays byte-identical —
    // what changes is that both write sites now have ONE semantic. The old
    // literal assignment is why the field read as a flag in the two
    // configurations everyone looked at. tools/r13-boot-telfieldcheck.mjs A1
    // is the check that can tell the two apart.
    G.telemetryData.redAlertsEntered++;
    G.telemetryData.wave = 1;
    G.player.shield = 0;
    G.player.hull = 62;
    G.player.heat = 0.85;
    G.player.lastDamageT = 0;
    G.player.speed = 142; // mid-evasion, not parked
    G.camOffset.setFromEuler(new THREE.Euler(0.017, -0.024, 0.028)); // shake pose
    G.poseSway = true; // live micro-shake on top of the cant — mid-fight, not tripod
    // ACTIVE impact feedback: deterministic shield-ripple + spark schedule so
    // the settle frame (t ~= 1.52s) catches a flash mid-bloom on the glass.
    // r5: offsets sit ON the camera-facing shield boundary (~12u dome, ahead
    // through the canopy) — vfx's redesigned impact-glued conformal flash
    // needs boundary points, not free-floating mid-air ones (r4: "circles
    // floating screen-aligned")
    G.poseImpacts = [
      { t: 0.55, off: new THREE.Vector3(5.5, -3, -10.5), done: false },  // early hit warms the pipeline
      { t: 1.30, off: new THREE.Vector3(-4.8, -2.5, -10.8), done: false }, // mid-bloom at the snapshot
    ];
    // primary hostile: CLOSE (175u) and posed 3/4-on so the hull, livery and
    // engine glows read as a ship — r2's head-on pose was an unlit dark sliver
    // ("no enemy ship exists"). Its fire still converges past the camera.
    // r5: pulled to ~150u so the stacked 640/640 tick + hull detail read;
    // aim offset tightened so its fire visibly CONVERGES at the camera —
    // ~18u perpendicular miss lands inside vfx's 9-40u graze window, so
    // these beams terminate on the shield with the new conformal flash
    const wp = new THREE.Vector3(-26, 17, -148).add(P.pos);
    const en = F.spawnEnemy(wp, 1, 3);
    if (en) {
      en.frozen = true;
      en.scriptFire = 0.15;
      en.boltColor = 0xff6018;
      // r8: posed part-damaged (230/640) — a pristine 640/640 hostile during
      // a SHIELD DOWN red alert contradicted the battle (two critics flagged)
      en.hp = 230; en.maxHp = 640;
      F.refreshHp(en); // spawn drew the default HP — redraw with the posed value
      en.scriptAimOffset = new THREE.Vector3(15, -9, 5); // converge at camera, graze the shield
      en.quat.setFromRotationMatrix(new THREE.Matrix4().lookAt(en.pos, P.pos, new THREE.Vector3(0, 1, 0)));
      // r6: more yaw — swing the long fuselage + wing planform toward the
      // camera so the LIT flank faces the lens (r5's 0.55 left it near
      // nose-on: silhouette only)
      en.quat.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.06, 0.92, 0.30)));
      en.glowL.scale.set(2.5, 2.5, 1); // r6: halved — r5's 5.0 still drowned the hull in green bloom
      en.glowR.scale.set(2.5, 2.5, 1);
      // warm light on the CAMERA side of the hull. r5's rim (4.2 @ ~140u,
      // decay 1.5, parked BEHIND the ship at -95z) attenuated to ~0.003 by
      // three's physical falloff — it never lit anything, and what it would
      // have lit was the far side. r6: camera-side placement ~50u off the
      // hull, physical-units intensity (7200 cd / d^2 ≈ 3.0 at the hull),
      // tight 240u cutoff so the warm spill dies before the red cabin.
      const rim = new THREE.PointLight(0xffa068, 10500, 240, 2);
      rim.position.copy(wp).add(new THREE.Vector3(18, 24, 44));
      G.scene.add(rim);
    }
    // wingman IN frame (upper right, against dark nebula) so its beams also
    // have a visible source instead of entering from off-screen
    const en2 = F.spawnEnemy(new THREE.Vector3(150, 85, -420).add(P.pos), 1, 3);
    if (en2) {
      en2.frozen = true;
      en2.scriptFire = 0.4;
      en2.boltColor = 0xff6018;
      en2.hpSprite.visible = false;
      en2.scriptAimOffset = new THREE.Vector3(-30, 14, 0);
      en2.quat.setFromRotationMatrix(new THREE.Matrix4().lookAt(en2.pos, P.pos, new THREE.Vector3(0, 1, 0)));
      // r7: more yaw so the far fighter shows planform, not a "plus-sign" frontal
      en2.quat.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.08, -0.7, -0.30)));
      en2.glowL.scale.set(2.5, 2.5, 1); // r6: halved with the primary's
      en2.glowR.scale.set(2.5, 2.5, 1);
    }
  }
}

// ---------------- fps tracking ----------------
const _swayE = new THREE.Euler(), _swayQ = new THREE.Quaternion();
const MAX_FRAME_DTS = 20000;
const frameDts = new Float64Array(MAX_FRAME_DTS); // preallocated: no growth churn in the loop
// r9: per-frame draw-call counts alongside the dts. telemetry's headline
// `drawCalls` samples ONLY the last rendered frame — an arbitrary instant of
// a wall-clock-stepped sim, which is where the same-seed 89-96 spread in the
// round-8 evidence came from (calls legitimately swing 85-170 within a combat
// second). The median over the whole run is the stable per-run number.
const frameDcs = new Uint16Array(MAX_FRAME_DTS);
let frameDtCount = 0;
let fpsFrames = 0, fpsStart = 0, lastNow = 0;

// ---------------- frame-spike tracker ----------------
// Worst N frames of the run as {ms, t, state, note} — the note is whatever
// notable event ran during the tick that produced the frame (spawn, planet
// transition, staged-build step, warp flip, explosion, sky-bake window).
// Subsystems tag the current tick via G.noteSpike('...').
const SPIKE_N = 25;
const frameSpikes = [];   // kept sorted desc by ms; length <= SPIKE_N
let _tickNote = '';
G.noteSpike = (s) => {
  if (!_tickNote) _tickNote = s;
  else if (_tickNote.length < 90 && !_tickNote.includes(s)) _tickNote += '+' + s;
};
let _prevTickNote = '', _prevTickState = '';
function recordFrameSpike(ms, t, state, note) {
  if (frameSpikes.length >= SPIKE_N && ms <= frameSpikes[frameSpikes.length - 1].ms) return;
  // insert sorted (desc) — tiny array, rare event
  let i = frameSpikes.length;
  while (i > 0 && frameSpikes[i - 1].ms < ms) i--;
  frameSpikes.splice(i, 0, {
    ms: Math.round(ms * 100) / 100,
    t: Math.round(t * 100) / 100,
    state, note,
  });
  if (frameSpikes.length > SPIKE_N) frameSpikes.length = SPIKE_N;
}

// ---------------- main loop ----------------
let readyResolve;
const readyPromise = new Promise((res) => { readyResolve = res; });
window.__ready = readyPromise;
window.__sessionDone = false;

// per-subsystem tick timing: when a frame spikes with no event note, the
// spike entry names the subsystem that owned the time (e.g. "planet:340ms")
const SEC_NAMES = ['flight', 'sm', 'space', 'planet', 'vfx', 'cockpit', 'audio', 'post', 'render'];
const _secMs = new Float64Array(SEC_NAMES.length);

// r11-perf INSTRUMENT — per-STATE accumulation of the same _secMs numbers.
// r10 left the round with "distribution-width work, not spike-hunting" and a
// per-state p1low tail, but no per-state SUBSYSTEM attribution: the tail told
// us combat and warp-charge were expensive and nothing told us which part of
// the tick they spent it in. This costs 10 float adds per tick, touches no
// simulation state and is skipped on posed presentation frames, so it cannot
// move a byte of a posed capture. Read via __telemetry().subsysMs.
const _subAcc = new Map();     // state -> { n, sums:Float64Array(10) } (index 9 = whole tick)
let _subEnabled = true;
function accumulateSubsys(state, tickMs) {
  if (!_subEnabled) return;
  let e = _subAcc.get(state);
  if (!e) { e = { n: 0, sums: new Float64Array(SEC_NAMES.length + 1) }; _subAcc.set(state, e); }
  e.n++;
  for (let i = 0; i < SEC_NAMES.length; i++) e.sums[i] += _secMs[i];
  e.sums[SEC_NAMES.length] += tickMs;
}

const _impactPos = new THREE.Vector3();
let _warmTick = 0; // cadence counter for vfx.warmWarp (r7 warp-entry stall fix)
let _dieTestT = 1.5; // ?dietest=1 integrity-cascade cadence (first tick after 1.5s)
function tick(dt) {
  G.time += dt;
  pollInput(dt);
  if (G.state === 'destroyed') {
    // dead stick: controls are gone, the tumble in SM owns the camera
    const inp = G.input;
    inp.pitch = inp.yaw = inp.roll = 0;
    inp.thrust = 0;
    inp.fire = inp.boost = inp.brake = false;
  }
  // the autopilot stands down once the ship is a wreck (?autoplay=1 reaches
  // the destruction sequence — the input zeroing above must survive the tick)
  if (autopilot && !G.momentMode && G.state !== 'destroyed') autopilot.update(dt);
  // ?dietest=1: deterministic integrity cascade — a fixed 6-dmg tick every
  // 0.5s (x8 by the dietest damage multiplier => 48) guarantees death is
  // reachable within seconds regardless of enemy aim. Fixed cadence, no rng:
  // determinism per seed holds. Absent from default runs entirely.
  if (DIETEST && !G.momentMode && G.state !== 'destroyed') {
    _dieTestT -= dt;
    if (_dieTestT <= 0) {
      _dieTestT = 0.5;
      G.flight.damagePlayer(6);
    }
  }
  // posed impact schedule (m5): fire shield-ripple + sparks at fixed times so
  // the capture shows live impact feedback, deterministically
  if (G.momentMode && G.poseImpacts) {
    for (const im of G.poseImpacts) {
      if (!im.done && G.time >= im.t) {
        im.done = true;
        _impactPos.copy(im.off).applyQuaternion(G.player.quat).add(G.player.pos);
        G.vfx.shieldRipple(_impactPos, 0x86d8ff); // ring + a few sparks + glass flash
      }
    }
  }
  let _pt = performance.now();
  const sec = (i) => { const n = performance.now(); _secMs[i] = n - _pt; _pt = n; };
  // r10 pose-fix, second half. Freezing G.time was not sufficient on its own:
  // several subsystems do work PER CALL rather than per unit time, so a dt=0
  // presentation frame still mutated the scene. planet.update drains the
  // amortised flora-rescatter queue per call, which is why moment 4 (the
  // terrain moment) stayed non-deterministic at maxChannelDelta=31 over 12.8%
  // of pixels after the G.time fix had already made m1/m2/m3/m5 byte-identical.
  // In moment mode a presentation frame (dt===0) now renders the settled scene
  // and updates nothing; __settle(n) remains the only thing that advances a
  // posed capture. Measured: 5/5 moments byte-identical across repeat captures.
  const posePresent = G.momentMode && dt === 0;
  // r11-perf: a posed presentation frame runs NO subsystem update, so the
  // stale _secMs from the last __settle tick would otherwise be attributed to
  // it. Zeroing leaves render (index 8) as the only non-zero slot, which makes
  // a free-running moment a pure render-throughput measurement.
  if (posePresent) _secMs.fill(0);
  const _tickT0 = performance.now();
  if (!posePresent) {
    G.flight.update(dt); sec(0);
    SM.update(dt); sec(1);
    G.space.update(dt, G.time); sec(2);
    G.planet.update(dt, G.time); sec(3);
    G.vfx.update(dt, G.time); sec(4);
    G.cockpit.update(dt, G.time); sec(5);
    G.audio.update(dt); sec(6);
    G.post.whiteout = Math.max(0, G.post.whiteout - dt * 1.4);
    G.post.update(dt, G.time); sec(7);
  }

  camera.position.copy(G.player.pos);
  camera.quaternion.copy(G.player.quat).multiply(G.camOffset);
  if (G.momentMode && G.poseSway) {
    // deterministic pilot-head sway/micro-shake for posed captures: slow
    // drift + fine tremor, all phase-offset so no axis ever sits centred.
    // Driven by G.time under fixedstep -> exactly reproducible per settle count.
    const t = G.time;
    _swayE.set(
      0.009 * Math.sin(t * 0.83 + 1.7) + 0.0022 * Math.sin(t * 17.3),
      0.011 * Math.sin(t * 0.67 + 0.5) + 0.0018 * Math.cos(t * 14.1),
      0.014 * Math.sin(t * 0.71 + 2.3)
    );
    _swayQ.setFromEuler(_swayE);
    camera.quaternion.multiply(_swayQ);
  }

  renderer.info.reset();
  _pt = performance.now();
  G.post.render(); sec(8);
  // r7 perf: keep the warp tunnel's driver pipelines + upload ring hot (see
  // vfx.warmWarp). Every 64th frame in fogless space states, tightening to
  // EVERY frame during warp-charge. Off-screen, full-size into the composer's
  // scene target, self-restoring.
  // r10-perf: this comment used to say "every 8th ... so the last pre-pump
  // lands <100ms before the real warp-on" while the constant said 1, which
  // reads like drift. It is not drift. Tried 8, A/B'd it, put it back.
  //   every frame: p1low 53.08 / 19.25; warp is 0-13% of the worst 1% with
  //                mean-of-its-worst 13.79ms.
  //   every 8th:   p1low 17.43 / 26.82 / 18.78; warp jumps to 53% of the worst
  //                1% at mean-of-its-worst 37.7-63.4ms — the r7 warp-on stall,
  //                straight back, and tools/prewarm-audit.mjs failed 2 of 3.
  // The second render is buying more than the pre-pump cadence the old comment
  // described. Do not "optimise" this constant without re-running that A/B.
  if (++_warmTick >= (G.state === 'warp-charge' ? 1 : 64)) {
    _warmTick = 0;
    if (G.mode === 'space' && !G.momentMode) G.vfx.warmWarp();
  }
  // name the heaviest subsystem of this tick when it dominates (>8ms) — the
  // spike recorder appends it to note-less slow frames
  let mi = 0;
  for (let i = 1; i < _secMs.length; i++) if (_secMs[i] > _secMs[mi]) mi = i;
  if (_secMs[mi] > 8) G.noteSpike(SEC_NAMES[mi] + ':' + _secMs[mi].toFixed(1) + 'ms');
  accumulateSubsys(G.state, performance.now() - _tickT0);
  // r10-perf runtime tripwire: three integer compares. Anything the renderer
  // created after boot could not have been warmed, so its first use will cost a
  // stall — name it now rather than letting a later round rediscover it as an
  // unexplained hitch. See src/prewarm.js.
  if (G.prewarmCheck) G.prewarmCheck();
}

// Boot warm-up window: Chrome's GPU process lands two big deterministic
// stalls (~270ms + ~480ms) in the first ~1.2s of ANY WebGL page — measured
// outside tick(), identical with all game code stashed. Real games absorb
// this behind the loading fade; we do the same: the loop runs and renders
// behind the arrival whiteout for BOOT_WARM_MS, and the fps meter starts
// when gameplay is actually visible. Session logic, autopilot and
// determinism are untouched — only stats start late. Not applied to posed
// moment captures (they must render clean, unfaded frames immediately).
const BOOT_WARM_MS = 1800;
let bootRafStart = 0, statsOn = false;

function animate(now) {
  requestAnimationFrame(animate);
  if (G.uiHold) {
    // start/pause overlay up (human play only — G.uiHold is undefined under
    // any harness param): sim frozen, no fps/spike accounting, frame kept
    // alive for the dimmed backdrop + resize correctness.
    lastNow = 0;
    animate._prev = 0;
    G.post.render();
    return;
  }
  if (!bootRafStart) bootRafStart = now;
  if (!statsOn && !G.momentMode && now - bootRafStart < BOOT_WARM_MS) {
    // loading moment: keep the whiteout up (fading through the window) so
    // the warm-up is a fade-in, not visible jank
    G.post.whiteout = Math.max(G.post.whiteout, 1 - (now - bootRafStart) / BOOT_WARM_MS);
  } else if (!statsOn) {
    statsOn = true;
  }
  if (!lastNow) lastNow = now;
  if (statsOn && !fpsStart) fpsStart = now;
  const realDt = Math.min(0.05, (now - lastNow) / 1000) || FIXED_DT;
  lastNow = now;
  // r10 pose-fix: POSED MOMENTS ADVANCE ONLY VIA __settle(n).
  // Until now the rAF loop kept ticking during the wall-clock gap between
  // __settle(90) and the screenshot in tools/capture.mjs, so G.time at capture
  // was (settle ticks + however many rAF frames happened to fire) * FIXED_DT.
  // That made every posed capture wall-clock dependent, which is a ?fixedstep=1
  // determinism promise in HARNESS.md not being kept. Two round-10 workers found
  // it independently: r10-cockpit measured m5's G.time varying 1.5667/1.6000/
  // 1.5833 across runs of ONE build (the red-alert flood is sin(t*6.2), so a
  // one-frame slip swings it ~13% and its cool-share went bimodal 0.54/3.59/
  // 6.77%); r10-perf measured base d76a964 differing FROM ITSELF by up to 249
  // channel levels on moments 1/2/4/5. Every blind visual verdict from round 3
  // onward was taken on a frame that varied between captures.
  // In moment mode the loop still RENDERS every rAF frame (presentation, resize,
  // screenshot correctness) but advances no simulation time, so a posed frame is
  // a pure function of the settle count: __settle(90) is exactly G.time 1.5.
  const dt = G.momentMode ? 0 : (FIXEDSTEP ? FIXED_DT : realDt);
  // the rAF delta closes the books on the PREVIOUS tick's frame — attribute
  // the spike to the note/state captured during that tick
  if (animate._prev && statsOn) {
    const ms = now - animate._prev;
    if (frameDtCount < MAX_FRAME_DTS) {
      frameDcs[frameDtCount] = renderer.info.render.calls; // previous frame's count
      frameDts[frameDtCount++] = ms || 16.7;
    }
    recordFrameSpike(ms, G.time, _prevTickState, _prevTickNote);
    fpsFrames++;
  }
  animate._prev = now;
  _tickNote = '';
  tick(dt);
  _prevTickNote = _tickNote;
  _prevTickState = G.state;
}

// ---------------- harness API ----------------
window.__settle = function (n) {
  for (let i = 0; i < n; i++) tick(FIXED_DT);
  return Promise.resolve(true);
};

window.__telemetry = function () {
  let rendererStr = 'unknown';
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    rendererStr = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  } catch (e) {}
  const seconds = fpsStart ? (lastNow - fpsStart) / 1000 : 0;
  const sorted = frameDts.slice(0, frameDtCount).sort((a, b) => b - a);
  const worstN = Math.max(1, Math.floor(sorted.length * 0.01));
  let worstSum = 0;
  for (let i = 0; i < worstN; i++) worstSum += sorted[i];
  const p1low = worstN && worstSum ? 1000 / (worstSum / worstN) : 0;
  const T = G.telemetryData;
  return {
    renderer: rendererStr,
    fps: {
      avg: seconds > 0 ? fpsFrames / seconds : 0,
      p1low,
      frames: fpsFrames,
      seconds,
    },
    drawCalls: renderer.info.render.calls,
    // stable per-run number (see frameDcs comment): median frame's call count
    drawCallsMedian: frameDtCount
      ? frameDcs.slice(0, frameDtCount).sort()[frameDtCount >> 1]
      : renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    frameSpikes: frameSpikes.slice(),
    // r11-perf: per-state mean milliseconds per subsystem, over every tick of
    // the run. `tick` is the whole timed region (subsystems + render).
    subsysMs: (() => {
      const out = {};
      for (const [state, e] of _subAcc) {
        const row = { frames: e.n };
        for (let i = 0; i < SEC_NAMES.length; i++) row[SEC_NAMES[i]] = +(e.sums[i] / e.n).toFixed(4);
        row.tick = +(e.sums[SEC_NAMES.length] / e.n).toFixed(4);
        out[state] = row;
      }
      return out;
    })(),
    // r10-perf: boot prewarm coverage. `gaps` names any linked program the boot
    // sweep never drew; `violations` names any program/geometry/texture created
    // AFTER boot (which by construction cannot have been warmed). Both are
    // empty on a healthy build; tools/prewarm-audit.mjs fails on either.
    prewarm: prewarmReport ? {
      ms: prewarmReport.ms, timings: prewarmReport.timings,
      programsLinked: prewarmReport.programsLinked, programsDrawn: prewarmReport.programsDrawn,
      bakeResidue: prewarmReport.bakeResidue,
      materialsInScene: prewarmReport.materialsInScene, materialsWarmed: prewarmReport.materialsWarmed,
      coverage: prewarmReport.coverage,
      gaps: prewarmReport.gaps, violations: prewarmReport.violations,
    } : null,
    errors: errors.slice(),
    game: {
      state: G.state,
      // ui field exists only when the UI layer is live (never under harness
      // params — telemetry stays shape-identical for harness runs)
      ...(G.uiState ? { ui: G.uiState } : {}),
      system: G.systemIndex + 1,
      wave: T.wave,
      shield: Math.round(G.player.shield),
      hull: Math.round(G.player.hull),
      heat: Math.round(G.player.heat * 100) / 100,
      shotsFired: T.shotsFired,
      hitsRegistered: T.hitsRegistered,
      enemiesKilled: T.enemiesKilled,
      enemyShotsFired: T.enemyShotsFired,
      enemyEvadeEvents: T.enemyEvadeEvents,
      enemyLeadShots: T.enemyLeadShots,
      warpCount: T.warpCount,
      redAlertsEntered: T.redAlertsEntered,
      boostSeconds: Math.round(T.boostSeconds * 10) / 10,
      brakeTurns: T.brakeTurns,
      // r14-collide: ship-vs-asteroid contacts, surfaced here because this
      // literal picks T.* fields EXPLICITLY, so a field added by flight.js is
      // invisible to every tool that reads __telemetry(). asteroidImpacts
      // counts only contacts that cost the player something; asteroidContacts
      // counts resolved contacts below the damage floor (a ship resting
      // against a rock — an ungated counter read 347 for one approach). Both
      // are direct event counters, NOT derived from shield/hull, which
      // HARNESS.md lists as timing-non-deterministic and unsafe to assert on.
      asteroidImpacts: T.asteroidImpacts,
      asteroidContacts: T.asteroidContacts,
      // r15 cannon heat upgrade. Direct counters, same reasoning as above:
      // cannonUpgrades is how many grants LANDED (a grant at the MK IV ceiling
      // is refused and does not count), cannonHeatCap is the divisor actually
      // in force. Time-to-overheat at cruise fire = ceil(cap/0.085) * 0.125 s.
      cannonMk: T.cannonMk,
      cannonHeatCap: T.cannonHeatCap,
      cannonUpgrades: T.cannonUpgrades,
      waveStats: T.waveStats,
      warpEta: Math.round(G.warpEta * 10) / 10,
      target: G.target ? { name: G.target.name, hp: Math.max(0, G.target.hp | 0), maxHp: G.target.maxHp } : null,
      // r9 gameplay-systems package. r14: this line used to cite HARNESS.md
      // "Telemetry additions", a heading that did not exist for five rounds.
      // These fields are documented in HARNESS.md's telemetry schema block,
      // under the inline marker "r9 gameplay-systems additions:".
      score: T.score,
      deaths: T.deaths,
      scoreLostToDeaths: T.scoreLostToDeaths,
      wavesCleared: T.wavesCleared,
      waveBonusTotal: T.waveBonusTotal,
      // failsafe declaration: true means at least one wave was HANDED to the
      // player by autopilot.forceClear rather than fought for
      forceCleared: T.forceCleared,
      forceClearedKills: T.forceClearedKills,
      enemyClassStats: T.enemyClassStats,
      // r10 rename: difficultyCurve -> difficultyProjection. Same single
      // `curve` function the live sim uses, evaluated at a stated reference
      // wave (rows carry atWave). The EXECUTED numbers are in waveStats.
      difficultyProjection: G.flight.difficultyProjection(5, 1),
      difficultyFormulas: G.flight.difficultyFormulas,
      ...(DIETEST ? { dietest: true } : {}),
    },
  };
};

// ---------------- resize ----------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  G.post.resize(window.innerWidth, window.innerHeight);
});

// ---------------- boot ----------------
if (MOMENT >= 1 && MOMENT <= 5) {
  poseMoment(MOMENT);
  G.post.whiteout = 0;
}

// ---------------- prewarm ----------------
// The variant space is warmed by ENUMERATION, not by an allowlist — see
// src/prewarm.js for the measurement that motivated the rewrite and for what
// happens when a future round adds a variant this file has never heard of.
// Kept here: only the call site and the report handoff.
const prewarmReport = runPrewarm({ G, scene, camera, renderer, FIXED_DT, planetSysNow, harness: HARNESS });


tick(FIXED_DT); // first full frame before ready resolves
if (!HARNESS) {
  // The shader prewarm above leaves red-alert leftovers on the cockpit panel
  // canvases ("TARGET LOCK LOST" / SHIELD DOWN toast). A live sim repaints
  // them within ~2s behind the boot whiteout, but the start overlay FREEZES
  // the first frame — so drain the panel repaint cadences now (toast slowest
  // at 2.0s => 160 fixed steps) so the held backdrop shows a clean cruise
  // cockpit. Harness boots skip this: their loop runs immediately.
  for (let i = 0; i < 160; i++) G.cockpit.update(FIXED_DT, G.time);
  G.post.render(); // repaint the held frame with the refreshed panels
}
requestAnimationFrame(animate);
readyResolve(true);
window.__ready.__resolved = true;
window.__G = G; // debug/diagnostic handle (harness + perf probes)

// human play only: start/pause/settings overlay. Gated so harness boots
// (?harness=1 / ?moment=N / ?session=1) never even fetch ui.js.
if (!HARNESS) {
  import('./ui.js')
    .then((m) => m.initUI(G))
    .catch((e) => errors.push('ui-init: ' + String(e && e.message || e)));
}
