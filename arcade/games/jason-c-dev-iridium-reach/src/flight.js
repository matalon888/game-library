// flight.js — player 6DOF flight (pitch/yaw/roll, thrust, boost, brake-turn),
// procedural chunky enemy fighters with pursuit/evade AI + shot leading,
// wave escalation, photon-cannon heat model, shield/hull damage model with
// red-alert trigger, and hit registration both ways.
import * as THREE from 'three';

const BOLT_SPEED = 620;
const ENEMY_BOLT_SPEED = 420;

// hostile ship naming — NMS combat HUD shows the locked target's name over
// its health readout; cockpit.js reads these via G.target.
// Faction-functional grammar ("Outlaw Interceptor", "Pirate Marauder") —
// r3 critics flagged "Marauder Dropship" as wrong-voiced for NMS.
const RAIDER_A = ['Outlaw', 'Pirate', 'Corsair', 'Marauder', 'Renegade', 'Rogue'];
const RAIDER_B = ['Interceptor', 'Marauder', 'Raider', 'Reaver', 'Strafer', 'Cutter', 'Gunship', 'Skiff'];

// ---------- enemy behavioural classes (r9, re-tuned r10) ----------
// Distinct movement/damage signatures layered over the cosmetic hull
// variants. Multipliers apply to the per-system/wave base numbers (see the
// DIFFICULTY CURVE table above `curve` below). points = score per kill,
// before the per-system multiplier (1 + systemIndex * 0.5).
//  - raider:      the round-8 baseline behaviour, numerically unchanged
//  - interceptor: fragile, much faster, hard lateral strafing runs
//  - gunship:     slow, tanky, harder-hitting; appears from system 2+
// scale is the mesh scale (baseline pool value was uniform 2.6): the long
// thin dart vs the broad brute give each class a distinct silhouette.
//
// r10 — THREE DIFFERENT ENGAGEMENT MODELS, not one chase AI with three
// stat blocks. Round 9's gunship was "a stationary turret given a chase AI":
// nominal 60 against a 150 player cruise, a 44-degree on-nose firing gate and
// agility 0.5, so it fired 0 shots in the whole session. Rather than making it
// fast (that clones the interceptor), the heavy now plays a STANDOFF SIEGE
// game — `engage: 'intercept'`:
//   * it steers to a station on the player's PREDICTED path (lead time from
//     its own transit speed), so it cuts the corner instead of tail-chasing;
//   * its guns are TURRETED: a 69-degree arc (fireArcCos 0.35) and 1400u of
//     reach against the darts' 44 degrees / 750u;
//   * a SIEGE BURN lifts its ceiling to 1.6x nominal for 2.5s when the range
//     opens past 520u, on a 4s cooldown — a lunge, not a cruise speed.
// It stays the slowest class by nominal speed (0.72 vs raider 1.0), so its
// telemetry signature stays distinct at both ends: slowest, longest-ranged.
//
// burst = the HARD, ENFORCED ceiling as a multiple of nominal speed
// (see the clamp in updateEnemy). r9's "speedCap" was not a cap at all —
// every class exceeded it. speedLimit = nominalSpeed * burst is the number
// the sim actually enforces; nothing else claims to be a cap.
export const ENEMY_CLASSES = {
  raider:      { hp: 1.0,  speed: 1.0,  dmg: 1.0, fireRate: 1.0,  aim: 1.0,  agility: 1.0, burst: 1.30, engage: 'pursuit',   fireArcCos: 0.72, fireRange: 750,  points: 100, scale: [2.6, 2.6, 2.6] },
  interceptor: { hp: 0.55, speed: 1.65, dmg: 0.7, fireRate: 1.3,  aim: 1.2,  agility: 1.9, burst: 1.30, engage: 'strafe',    fireArcCos: 0.72, fireRange: 750,  points: 150, scale: [1.9, 1.75, 3.1] },
  gunship:     { hp: 2.4,  speed: 0.72, dmg: 1.6, fireRate: 0.55, aim: 1.70, agility: 0.5, burst: 1.60, engage: 'intercept', fireArcCos: 0.35, fireRange: 1400, points: 250, scale: [3.7, 3.3, 3.1] },
};
// r11 — `aim` is a MULTIPLIER ON AIM ERROR, so a value below 1.0 makes a class
// MORE accurate. r10 shipped the gunship at aim 0.85, which made the heavy the
// most accurate class in the game while DECISIONS-gameplay.md said it threatens
// "by suppression volume, not marksmanship". Accuracy, blast area (11u fuse vs
// the darts' 5u = 4.8x the hit area) and per-bolt damage (2.0x) all stacked the
// same way, and the arena measured the result: 126 damage at a 24% hit rate in
// an engaged turn against raider 30 / interceptor 21. That is a boss, not a
// class. The tuning now matches the stated design instead of the doc being
// rewritten to match the tuning: aim 0.85 -> 1.70 makes the heavy comfortably
// the WORST marksman in the game (system-2 dispersion 0.092 against raider
// 0.054 and interceptor 0.065), and dmg 2.0 -> 1.6 keeps it the hardest single
// hit without three multipliers compounding. Reach (1400u), turret arc (69 deg), beaten
// zone (11u proximity fuse), hull (2.4x) and persistence (siege burn) are
// untouched — those are the legs the design actually stands on.
// gunship siege burn — the lunge that lets a heavy close a gap it could never
// out-run. Duration/cooldown in seconds, trigger range in world units.
const BURN = { range: 520, duration: 2.5, cooldown: 4.0 };
const GUNSHIP_STANDOFF = 300;  // station radius it holds off the intercept point
// class-consistent second name word (index reuses the seeded draw so rng
// consumption is identical for every class — determinism guard)
const CLASS_NAMES = {
  interceptor: ['Interceptor', 'Strafer'],
  gunship: ['Gunship', 'Cutter'],
};

// ---------- DIFFICULTY CURVE (r9) ----------
// sys = G.systemIndex (0-based); wave = global wave number (1-based).
// Deliberate easy -> medium -> hard ramp. Target: a first-time player
// survives system 1, is pressured in system 2, and dies without skill
// growth by system 3-4.
//
// | system | aimErr(w1) | dmg/bolt | raiderHp(w1) | nominal(w1)  | class mix (wave 2+)            |
// |   1    |   0.080    |    7     |  100+20w     |   90+5w      | raiders + 1 interceptor        |
// |   2    |   0.058    |   10     |  150+20w     |  104+5w      | + gunships enter (1)           |
// |   3    |   0.036    |   13     |  200+20w     |  118+5w      | 1-2 gunships, more interceptors|
// |   4    |   0.014    |   16     |  250+20w     |  132+5w      | 2 gunships, heavy mix          |
// |   5    |   0.012    |   19     |  300+20w     |  146+5w      | 2 gunships, heavy mix          |
//
// hp/speed formulas are unchanged from round 8 (session pacing preserved);
// aimErr is MORE generous in system 1 than r8 (0.080 vs 0.062) and tightens
// faster; per-bolt damage starts lower (7 vs 9) and climbs steeper (+3/sys).
// All four metrics change monotonically with system.
//
// r10 — ONE function, two clearly named readouts. r9 shipped a telemetry
// table called `difficultyCurve` that evaluated these same formulas at a
// FIXED wave 1 while the live game evaluated them at the real wave number,
// so the "curve" said system-2 hp 150 while the executed system-2 wave-2
// encounter used hp 170. Both were called the difficulty curve. Now:
//   * game.difficultyProjection — this `curve` evaluated at a STATED
//     reference wave (each row carries atWave), with the formulas as strings.
//     A projection, and labelled as one.
//   * game.waveStats — the values the sim actually spawned, per executed
//     (system, wave). The measurement.
// Nothing computes difficulty a second way.
const curve = {
  aimErr: (sys, wave) => Math.max(0.012, 0.08 - sys * 0.022 - (wave - 1) * 0.004),
  dmg: (sys) => 7 + sys * 3,
  hp: (sys, wave) => 80 + sys * 50 + wave * 20,
  speed: (sys, wave) => 85 + sys * 14 + wave * 5,
  fireScale: (sys) => 0.9 - Math.min(0.5, sys * 0.15), // rng span of the refire interval
};

// ---------- procedural enemy fighter ----------
// r7 re-author (r3 "folded-paper", r6 "blocky flat-green"): NMS pirate-raider
// silhouette language with three distinct masses — a FACETED tapered fuselage
// (hex cross-section, not a box), stepped swept wing planform with tip
// blades, and twin engine cans with hot discs — plus greeble detail
// (antennae, panel insets, gun barrels, nozzle lips) and running lights.
// Four seeded variants per session: per-ship silhouette asymmetry (fin
// layout, sensor pod side, antenna count) and accent-colour variance inside
// one warm pirate wave palette (crimson / burnt orange / bone / oxblood).
// Three material groups (same three materials as r6 — no new programs):
//   0 = hull   (dark gunmetal, low roughness -> hard sun ping)
//   1 = panels (green paint + accent livery, matte)
//   2 = glow   (engine discs + canopy + running lights, unlit -> blooms)
const FIGHTER_VARIANTS = 4;
// wave palette: warm accents worn over the shared pirate green + gunmetal
// r7 critic pass 1: "no per-ship variety — one ship stamped three times".
// Fin layout + accent trim don't read at 250u; COLOUR BLOCKING does (ref-4
// pairs a cream-bodied hull with a green-and-white one). So the variants now
// vary the wing paint itself, not just the trim:
//   v0 classic green + crimson   v1 olive + burnt orange
//   v2 BONE/cream + green trim   v3 deep green + oxblood
const SCHEMES = [
  { wing: 0x3e8a4c, trim: 0x549e62, accent: 0xd8502a, stripe: 0xc4ead0 },
  { wing: 0x5d8a3e, trim: 0x74a052, accent: 0xe07830, stripe: 0xd8e4c2 },
  { wing: 0xcfc9b0, trim: 0xe0dcc8, accent: 0x3e8a4c, stripe: 0xd8502a },
  { wing: 0x2f7a44, trim: 0x479258, accent: 0xb43838, stripe: 0xc4ead0 },
];

// taper a box along `axis` ('x' spanwise wing / 'y' vertical fin): chord (z)
// shrinks and rakes BACK toward the tip, thickness thins — turns the square
// slab into a swept trapezoid blade (r7 critic 2: "square where the
// reference tapers to an aggressive point").
function taperBlade(geo, axis, a0, a1, tipChord, sweepBack, tipThin) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const a = axis === 'x' ? p.getX(i) : p.getY(i);
    const t = THREE.MathUtils.clamp((a - a0) / (a1 - a0), 0, 1);
    p.setZ(i, p.getZ(i) * (1 - t * (1 - tipChord)) + sweepBack * t);
    if (axis === 'x') p.setY(i, p.getY(i) * (1 - t * (1 - tipThin)));
    else p.setX(i, p.getX(i) * (1 - t * (1 - tipThin)));
  }
  geo.computeVertexNormals();
}

function buildFighterVariant(rng, v) {
  const parts = [];   // { geo, color, mat }
  function add(geo, color, mat) { parts.push({ geo, color: new THREE.Color(color), mat }); }
  const scheme = SCHEMES[v % SCHEMES.length];
  const accent = scheme.accent;
  const green = scheme.wing;     // "wing paint" — bone on v2, greens elsewhere
  const greenLt = scheme.trim;
  const j = (s) => (rng() - 0.5) * s; // small seeded jitter

  // ---- group 0: dark metal hull
  // faceted fuselage: 6-sided tapered barrel, flattened — reads as beaten
  // pirate plating with a hard specular crease line, not a brick
  const fus = new THREE.CylinderGeometry(0.62, 1.42, 10.2, 6, 1);
  fus.rotateX(-Math.PI / 2);           // +Y -> -Z: taper toward the nose
  fus.rotateZ(Math.PI / 6);            // flat facet up (crease line on top)
  fus.scale(1.18, 0.74, 1);            // flatten: wider than tall
  fus.translate(0, 0, -0.9);
  add(fus, 0x3c4248, 0);
  // nose cone continues the taper to a dart point
  const nose = new THREE.ConeGeometry(0.66, 5.4, 6);
  nose.rotateX(-Math.PI / 2);
  nose.rotateZ(Math.PI / 6);
  nose.scale(1.18, 0.74, 1);
  nose.translate(0, 0, -8.6);
  add(nose, v === 2 ? 0xb8b2a0 : 0x474e55, 0); // v2 wears the bone paint on the nose too
  // aft transom block between the engine cans
  const aft = new THREE.BoxGeometry(2.6, 1.15, 3.0);
  aft.translate(0, -0.08, 4.7);
  add(aft, 0x2e3338, 0);
  // twin engine cans — the rear mass. Kept at the same lateral stance as r6
  // so hit sphere + glow sprites stay consistent.
  const canL = new THREE.CylinderGeometry(0.78, 0.95, 3.5, 8);
  canL.rotateX(Math.PI / 2);
  canL.translate(-1.8, -0.28, 4.9);
  add(canL, 0x3f464c, 0);
  const canR = new THREE.CylinderGeometry(0.78, 0.95, 3.5, 8);
  canR.rotateX(Math.PI / 2);
  canR.translate(1.8, -0.28, 4.9);
  add(canR, 0x3f464c, 0);
  // nozzle lips — darker ring lip proud of each can (greeble)
  const lipL = new THREE.CylinderGeometry(1.02, 1.02, 0.42, 8);
  lipL.rotateX(Math.PI / 2);
  lipL.translate(-1.8, -0.28, 6.6);
  add(lipL, 0x22262a, 0);
  const lipR = new THREE.CylinderGeometry(1.02, 1.02, 0.42, 8);
  lipR.rotateX(Math.PI / 2);
  lipR.translate(1.8, -0.28, 6.6);
  add(lipR, 0x22262a, 0);
  // dorsal spine ridge
  const spine = new THREE.BoxGeometry(0.66, 0.5, 6.4);
  spine.translate(0, 0.86, 0.6);
  add(spine, 0x343a40, 0);
  // ventral keel blade
  const keel = new THREE.BoxGeometry(0.3, 1.5, 2.6);
  keel.rotateX(-0.5);
  keel.translate(0, -1.15, 3.4);
  add(keel, 0x31373d, 0);
  // twin gun barrels under the nose — pirate cannon read
  const gunL = new THREE.CylinderGeometry(0.1, 0.1, 3.0, 5);
  gunL.rotateX(Math.PI / 2);
  gunL.translate(-0.62, -0.5, -7.6);
  add(gunL, 0x23282c, 0);
  const gunR = new THREE.CylinderGeometry(0.1, 0.1, 3.0, 5);
  gunR.rotateX(Math.PI / 2);
  gunR.translate(0.62, -0.5, -7.6);
  add(gunR, 0x23282c, 0);
  // hull panel insets — thin proud plates that catch the sun ping (greeble)
  for (let i = 0; i < 3; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const ins = new THREE.BoxGeometry(0.08, 0.55 + rng() * 0.3, 1.6 + rng() * 1.2);
    ins.translate(side * (1.42 + i * 0.04), 0.05 + j(0.5), -3.2 + i * 2.5 + j(0.8));
    add(ins, 0x272c31, 0);
  }
  // antennae — count/placement varies per ship (1-2 dorsal whips)
  const nAnt = 1 + (v % 2);
  for (let i = 0; i < nAnt; i++) {
    const ant = new THREE.CylinderGeometry(0.045, 0.045, 1.9 + rng() * 1.1, 4);
    ant.translate(j(0.9), 1.9, 2.2 + i * 1.6 + j(0.6));
    add(ant, 0x1e2226, 0);
  }
  // asymmetric sensor pod on ONE wing root (side flips by variant) — the
  // per-ship asymmetry read; v2 carries a nose probe instead
  const podSide = v === 2 ? 0 : (v % 2 === 0 ? -1 : 1);
  if (podSide !== 0) {
    const pod = new THREE.SphereGeometry(0.5, 6, 5);
    pod.scale(1, 0.8, 1.5);
    pod.translate(podSide * 3.1, 0.42, 0.9);
    add(pod, 0x2a3036, 0);
    const dish = new THREE.CylinderGeometry(0.34, 0.42, 0.3, 6);
    dish.translate(podSide * 3.1, 0.95, 0.9);
    add(dish, 0x22272c, 0);
  } else {
    const probe = new THREE.CylinderGeometry(0.05, 0.05, 3.4, 4);
    probe.rotateX(Math.PI / 2);
    probe.translate(0, -0.05, -12.4);
    add(probe, 0x1e2226, 0);
  }

  // ---- group 1: painted green panels + accent livery
  // stepped swept wing: broad-chord inner panel, raked tapering outer blade,
  // height step at the join so the seam reads under sun
  for (const s of [-1, 1]) {
    // per-side sweep asymmetry: seeded, small — a handmade pirate airframe,
    // not a mirrored CAD model (critic 2: "wings too symmetric")
    const wAsym = j(0.05);
    const wIn = new THREE.BoxGeometry(5.2, 0.28, 4.6);
    taperBlade(wIn, 'x', -s * 2.6, s * 2.6, 0.6, 0.9, 0.85); // trapezoid, raked LE
    wIn.rotateZ(s * -0.07);
    wIn.rotateY(s * (-0.30 + wAsym));
    wIn.translate(s * 3.5, 0.05, 1.3);
    add(wIn, green, 1);
    const wOut = new THREE.BoxGeometry(5.4, 0.22, 2.7);
    taperBlade(wOut, 'x', -s * 2.7, s * 2.7, 0.36, 1.5, 0.6); // pointed blade tip
    wOut.rotateZ(s * -0.11);
    wOut.rotateY(s * (-0.50 + wAsym));
    wOut.translate(s * 7.9, 0.32, 2.6);
    add(wOut, green, 1);
    // tall raked wingtip blade
    const fin = new THREE.BoxGeometry(0.34, 3.1, 2.2);
    taperBlade(fin, 'y', -1.55, 1.55, 0.45, 1.0, 0.75); // swept fin, not a slab
    fin.rotateX(0.35 + j(0.1));
    fin.translate(s * 10.1, 1.15, 3.4);
    add(fin, greenLt, 1);
    // wingtip blade accent cap
    const cap = new THREE.BoxGeometry(0.38, 0.8, 1.5);
    cap.rotateX(0.35);
    cap.translate(s * 10.15, 2.3, 4.25);
    add(cap, accent, 1);
    // canard blades near the nose
    const can2 = new THREE.BoxGeometry(2.0, 0.14, 1.15);
    taperBlade(can2, 'x', -s * 1.0, s * 1.0, 0.45, 0.55, 0.7);
    can2.rotateY(s * -0.42);
    can2.translate(s * 1.7, 0.22, -5.3);
    add(can2, green, 1);
    // wing panel insets (darker paint plates — greeble on the planform)
    const wIns = new THREE.BoxGeometry(1.7 + rng() * 0.8, 0.31, 1.5 + rng() * 0.7);
    wIns.rotateZ(s * -0.07);
    wIns.rotateY(s * -0.30);
    wIns.translate(s * (3.3 + rng() * 1.2), 0.07, 1.3 + j(1.4));
    add(wIns, new THREE.Color(green).multiplyScalar(0.72), 1); // darker plate of the same paint
    // accent livery band across the wing root (faction markings)
    const band = new THREE.BoxGeometry(1.9, 0.32, 4.62);
    band.rotateZ(s * -0.07);
    band.rotateY(s * -0.30);
    band.translate(s * 4.4, 0.08, 1.35);
    add(band, accent, 1);
    // cheek flash along the fuselage facet
    const flash = new THREE.BoxGeometry(0.5, 0.5, 2.9);
    flash.translate(s * 1.45, 0.22, -2.2);
    add(flash, accent, 1);
  }
  // tail fin layout varies per variant: 0/3 single tall, 1 twin canted,
  // 2 single OFFSET (asymmetric silhouette)
  if (v === 1) {
    for (const s of [-1, 1]) {
      const tf = new THREE.BoxGeometry(0.26, 2.5, 2.7);
      taperBlade(tf, 'y', -1.25, 1.25, 0.5, 0.9, 0.8);
      tf.rotateX(0.5);
      tf.rotateZ(s * -0.5);
      tf.translate(s * 1.35, 1.55, 4.4);
      add(tf, green, 1);
      const tt = new THREE.BoxGeometry(0.3, 0.6, 1.5);
      tt.rotateX(0.5);
      tt.rotateZ(s * -0.5);
      tt.translate(s * 2.15, 2.6, 4.9);
      add(tt, accent, 1);
    }
  } else {
    const fx = v === 2 ? 0.7 : 0;
    const tf = new THREE.BoxGeometry(0.32, 3.0, 3.2);
    taperBlade(tf, 'y', -1.5, 1.5, 0.48, 1.1, 0.8);
    tf.rotateX(0.52);
    tf.translate(fx, 1.75, 4.3);
    add(tf, green, 1);
    const tt = new THREE.BoxGeometry(0.36, 0.72, 1.7);
    tt.rotateX(0.52);
    tt.translate(fx, 3.05, 5.0);
    add(tt, accent, 1);
  }
  // dorsal paint panels along the spine + pale ID stripe
  const spineP = new THREE.BoxGeometry(1.9, 0.3, 5.8);
  spineP.translate(0, 0.72, -1.8);
  add(spineP, green, 1);
  const stripe = new THREE.BoxGeometry(0.5, 0.2, 4.4);
  stripe.translate(0, 0.92, -3.8);
  add(stripe, scheme.stripe, 1);

  // ---- group 2: hot parts (unlit, x2.2 -> engine discs cross the bloom knee)
  const canopy = new THREE.SphereGeometry(0.9, 8, 6);
  canopy.scale(1.05, 0.7, 2.0);
  canopy.translate(0, 0.98, -3.2);
  add(canopy, 0x86e8c8, 2);
  const engL = new THREE.CircleGeometry(0.74, 12);
  engL.translate(-1.8, -0.28, 6.85);
  add(engL, 0xd0ffe8, 2);
  const engR = new THREE.CircleGeometry(0.74, 12);
  engR.translate(1.8, -0.28, 6.85);
  add(engR, 0xd0ffe8, 2);
  // running lights: port crimson / starboard pale — tiny hot studs at the
  // wingtips, tail tip, and a ventral pair (NMS strobe grammar, frozen on)
  const rl = (x, y, z, c, r = 0.13) => {
    const lgt = new THREE.SphereGeometry(r, 5, 4);
    lgt.translate(x, y, z);
    add(lgt, c, 2);
  };
  // r9 (blind verdict: "no running lights" at pose distance): studs sized up
  // ~50% — at 150-300u a 0.13u stud is sub-pixel; 0.2u crosses ~2px and reads
  rl(-10.1, 2.6, 4.4, 0xff5a48, 0.20);   // port wingtip: crimson
  rl(10.1, 2.6, 4.4, 0xcfe8ff, 0.20);    // starboard wingtip: pale ice
  rl(v === 1 ? 2.15 : (v === 2 ? 0.7 : 0), v === 1 ? 2.75 : 3.3, 5.4, 0xfff2d0, 0.16); // tail beacon
  rl(-1.45, -0.62, -1.0, 0xffa040, 0.15); // ventral strobes: warm orange
  rl(1.45, -0.62, -1.0, 0xffa040, 0.15);
  // wing leading-edge marker pair — the lit-dots-along-the-planform NMS read
  rl(-6.2, 0.42, 1.7, 0xff5a48, 0.13);
  rl(6.2, 0.42, 1.7, 0xcfe8ff, 0.13);
  if (podSide === 0) rl(0, -0.05, -14.0, 0xffd0a0, 0.14); // nose probe tip

  // merge — parts ordered by material so each group is one contiguous range
  parts.sort((a, b) => a.mat - b.mat);
  let total = 0;
  for (const p of parts) total += p.geo.attributes.position.count;
  const pos = new Float32Array(total * 3), norm = new Float32Array(total * 3);
  const colors = new Float32Array(total * 3);
  const idx = [];
  const groupStart = [0, 0, 0], groupCount = [0, 0, 0];
  let vo = 0;
  let prevMat = 0, groupFrom = 0;
  for (const p of parts) {
    if (p.mat !== prevMat) {
      groupStart[prevMat] = groupFrom; groupCount[prevMat] = idx.length - groupFrom;
      // materials with no parts keep zero counts
      for (let mm = prevMat + 1; mm < p.mat; mm++) { groupStart[mm] = idx.length; groupCount[mm] = 0; }
      groupFrom = idx.length; prevMat = p.mat;
    }
    pos.set(p.geo.attributes.position.array, vo * 3);
    norm.set(p.geo.attributes.normal.array, vo * 3);
    const n = p.geo.attributes.position.count;
    for (let i = 0; i < n; i++) {
      // baked top-light: critic pass 1 called the hulls "one flat dark tone
      // front to back — a paper cutout". Scale vertex colour by normal.y so
      // upward faces carry a painted-light value and undersides sit in
      // baked shade — the painterly NMS value split that survives flat
      // ambient. Glow parts (mat 2) stay untouched.
      let f = 1;
      let er = 0, eg = 0, eb = 0;
      if (p.mat < 2) {
        const ny = norm[(vo + i) * 3 + 1];
        f = ny >= 0 ? 0.80 + 0.34 * ny : 0.80 + 0.30 * ny; // 1.14 top .. 0.50 bottom
        // r9 baked engine bounce (blind verdict: "no engine glow gradient"):
        // rear-hull vertices near the twin nozzles carry a baked teal wash so
        // the engines visibly LIGHT the surrounding plating at ANY distance —
        // the shader wash (vfx.js) adds the live directional term on top.
        const px = pos[(vo + i) * 3], py = pos[(vo + i) * 3 + 1], pz = pos[(vo + i) * 3 + 2];
        for (const sx of [-1.8, 1.8]) {
          const dx = px - sx, dy = py + 0.28, dz = pz - 6.9;
          const d2 = dx * dx + dy * dy + dz * dz;
          const w = Math.exp(-d2 * 0.055) * 0.85;
          er += 0.13 * w; eg += 0.62 * w; eb += 0.50 * w;
        }
      }
      colors[(vo + i) * 3] = p.color.r * f + er;
      colors[(vo + i) * 3 + 1] = p.color.g * f + eg;
      colors[(vo + i) * 3 + 2] = p.color.b * f + eb;
    }
    const pi = p.geo.index.array;
    for (let i = 0; i < pi.length; i++) idx.push(pi[i] + vo);
    vo += n;
  }
  groupStart[prevMat] = groupFrom; groupCount[prevMat] = idx.length - groupFrom;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.setIndex(idx);
  for (let m = 0; m < 3; m++) g.addGroup(groupStart[m], groupCount[m], m);
  // engine anchors: where the pooled halo sprites sit for this hull
  return { geo: g, engines: [new THREE.Vector3(-1.8, -0.28, 7.0), new THREE.Vector3(1.8, -0.28, 7.0)] };
}

function hpLabelCanvas() {
  const c = document.createElement('canvas');
  // R9 (ui, critic cycle 1): the readout is a RETICLE now, not two floating
  // numerals — needs the resolution to carry a ring and bracket ticks.
  c.width = 192; c.height = 192;
  return c;
}

export function initFlight(G) {
  const rng = G.rngFor('flight');

  // ================= player =================
  const player = G.player; // created in main
  player.vel = new THREE.Vector3();
  player.speed = 0;
  player.shield = 100;
  player.hull = 100;
  player.heat = 0;
  player.overheated = false;
  // r15 cannon heat upgrade — see grantCannonUpgrade(). MK I is the round-14
  // cannon exactly: heatCap 1 divides HEAT_PER_SHOT by one and changes nothing.
  // A posed capture and every harness boot start and stay here, which is why
  // the HUD mark badge is gated on heatCap > 1 and posed frames are unmoved.
  player.cannonMk = 1;
  player.heatCap = 1;
  player.lastDamageT = -99;
  player.altitude = 0;

  const MAXV = { cruise: 150, boost: 320 };
  let fireCooldown = 0;
  let muzzleSide = 1;
  let lastFireT = -9;

  // ================= cannon heat upgrade (r15) =================
  // THE PROBLEM, in Jason's words: the photon cannon overheats too fast in
  // later waves — difficulty ramps and the player's ability to shoot does not.
  // THE FIX: a wave clear installs a cannon upgrade. Time-to-overheat doubles
  // per system, and NOTHING ELSE MOVES — not enemy hp, damage, speed, aim or
  // count, not the heat decay rate, not the un-overheat threshold, not the
  // 0.125s refire. This is a pure player-endurance lever.
  //
  // THE ARITHMETIC. 1 / HEAT_PER_SHOT = 11.76 shots to overheat at MK I, at
  // 0.125 s/shot with no cooling during sustained fire (decay only starts
  // 0.35 s after the last shot), = 1.5 s of held trigger. heatCap divides the
  // per-shot heat, so:
  //     MK I   cap  1   12 shots    1.5 s
  //     MK II  cap  2   24 shots    3.0 s
  //     MK III cap  4   48 shots    6.0 s
  //     MK IV  cap  8   95 shots   11.9 s   <- CEILING
  //     (MK V  cap 16  189 shots   23.6 s)  <- NOT SHIPPED
  //
  // THE CAP IS MEASURED, NOT PICKED. A wave in this game lives 15.2-23.3 s
  // (clearedInS across 20 committed session telemetries, wave 1 15.2-16.7,
  // wave 2 15.6-23.3). At cap 16 the time-to-overheat is 23.6 s, which is
  // LONGER THAN THE WAVE — a player holding the trigger from the first spawn
  // to the last kill would never reach it, and the thermal gauge would become
  // scenery. That does not make the cannon fun, it deletes a mechanic. At cap
  // 8 the 11.9 s sits comfortably inside the shortest measured wave, so
  // overheat stays reachable by a player who simply holds fire, which is the
  // behaviour the limit exists to price. So the doubling runs MK I -> MK IV
  // and stops, and the flat tail is recorded rather than hidden.
  //
  // In space each cleared wave immediately triggers the warp (main.js
  // handleWaveEnd), so "one upgrade per wave clear" and "double per system"
  // are the same statement. In planet mode waves repeat without a warp, so a
  // player farming a planet reaches the MK IV ceiling faster — that is the
  // ceiling doing its job.
  const HEAT_PER_SHOT = 0.085;
  const HEAT_CAP_MAX = 8;
  function grantCannonUpgrade() {
    if (player.heatCap >= HEAT_CAP_MAX) return false;  // at the ceiling: no grant, no line
    player.cannonMk++;
    player.heatCap = Math.min(HEAT_CAP_MAX, player.heatCap * 2);
    G.telemetryData.cannonMk = player.cannonMk;
    G.telemetryData.cannonHeatCap = player.heatCap;
    G.telemetryData.cannonUpgrades++;
    return true;
  }

  // ================= asteroid collision (r14-collide) =================
  // PLAYER-REPORTED: "I can fly straight through asteroids." MEASURED true
  // before the fix — a head-on cruise approach reached -0.995 R, the camera
  // passing within 0.7u of a 156u rock's centre, with zero shield loss and no
  // impact signal (artifacts/r14-collide/probe-base-prefix.json). space.js
  // owns the rocks and answers the swept query; this file owns the
  // consequence, because this is where the damage model lives.
  //
  // EVERY NUMBER BELOW MATCHES SOMETHING ALREADY IN THE BUILD. Nothing here
  // is a new damage curve — DECISIONS-gameplay.md is silent on asteroids, so
  // the rule was to match conventions rather than invent one:
  //
  //  * SHIP_R = 6 is the PLANET TERRAIN CLEARANCE (`if (player.altitude < 6)`
  //    ... `player.pos.y = ground + 6`, updatePlayer below). That line is the
  //    only place in the game where the player has a body radius at all, so
  //    the belt uses the same one rather than a second, different, invented
  //    one. It is also within a whisker of the 5u radius an enemy dart's bolt
  //    tests the player at (checkHits, `b.hitRadius || 5`).
  //  * RESTITUTION = 0.3 is the TERRAIN BOUNCE verbatim: terrain does
  //    `if (player.vel.y < 0) player.vel.y = Math.abs(player.vel.y) * 0.3`,
  //    which is exactly "reflect the inward normal component at 0.3". The
  //    sphere case is the same rule with a normal that is not (0,1,0).
  //  * Damage is routed through damagePlayer(), which is THE damage entry
  //    point — it owns shield-then-hull, the red-alert transition, post.hit,
  //    audio, the ?dietest multiplier, the wave shield-loss stat, and the
  //    death / soft-respawn split with its 20% score haircut (DECISIONS-
  //    gameplay.md decision 1). A collision that reimplemented any of that
  //    would be a second damage model wearing the first one's name.
  //
  // The one genuinely new number is IMPACT_DMG_AT_CRUISE, and it is a DIAL.
  // Its reference measurement, both failure poles and their detectors are in
  // reports/r14-collide/REF-TARGETS.md, committed before this file changed.
  // The curve is quadratic in the closing speed along the surface NORMAL, so
  // (a) one constant sets the whole curve, (b) a rim graze costs almost
  // nothing for free rather than needing a separate threshold, and (c) the
  // shape is the kinetic-energy shape rather than a hand-drawn ramp.
  //
  // DESTRUCTION AT SPEED IS REACHABLE, and it is reachable through the
  // EXISTING model rather than through a new overflow rule. damagePlayer does
  // not spill shield overflow into hull (a big hit on a full shield strips the
  // shield and stops), which is the behaviour bolts already have. So a boosted
  // head-on impact on a full shield strips it; the same impact with the shield
  // already down puts 0.7 x its damage into a 100 hull. Both halves are
  // MEASURED in reports/r14-collide/REPORT.md — the claim is not left standing
  // on this comment.
  const NO_ASTEROID_COLLIDE = new URLSearchParams(location.search).get('nocollide') === '1';
  const SHIP_R = 6;
  const IMPACT_RESTITUTION = 0.3;
  const IMPACT_DMG_AT_CRUISE = 40;   // damage from a head-on impact at MAXV.cruise
  const IMPACT_DMG_FLOOR = 1.0;      // below this it is a scrape: deflect, no damage
  const MAX_IMPACT_RESOLVES = 3;     // rocks can overlap; do not let one trap the ship
  const IMPACT_EVENT_CAP = 64;
  // The impact COUNTER is the deterministic collision signal, and it is
  // deliberately independent of the damage curve: HARNESS.md/WORKER-COMMON §11
  // lists shield and hull as outcome-deterministic but NOT timing-deterministic,
  // so a collision check that asserts on shield is asserting on a number that
  // does not agree run to run. asteroidImpacts increments on EVERY registered
  // contact including sub-floor scrapes that cost nothing.
  G.telemetryData.asteroidImpacts = 0;
  G.telemetryData.asteroidContacts = 0;   // resolved contacts below the damage floor
  G.telemetryData.asteroidImpactEvents = [];
  const _prevPos = new THREE.Vector3();
  const _impN = new THREE.Vector3();
  const _impContact = new THREE.Vector3();

  function collideAsteroids() {
    if (NO_ASTEROID_COLLIDE) return;         // §3a off-switch: proves the check can go RED
    if (G.mode !== 'space') return;          // the belt is a space-mode object
    if (G.state === 'warp') return;          // rocks are hidden in the tunnel (space.setWarpMode)
    // THE WRECK STILL COLLIDES. An earlier version returned here on
    // 'destroyed' on the reasoning that damagePlayer already no-ops during the
    // tumble — true, but it skipped the DE-PENETRATION too, so a ship killed at
    // a rock spent the whole ~3.0s destruction sequence sitting at the rock's
    // centre with the camera inside the mesh. MEASURED by r14-collide's critic
    // (finding F3): -156.663, a full -1.00 R, held for 120 frames, against a
    // control that ejects to +6.001 on frame 1. That is the same
    // camera-inside-geometry break the equal-volume radius was rejected for,
    // and the tumble is the moment the player is doing nothing but looking.
    // So the contact still resolves; `wrecked` suppresses the accounting.
    const wrecked = G.state === 'destroyed';
    const S = G.space;
    if (!S || !S.asteroidSweptHit) return;
    for (let iter = 0; iter < MAX_IMPACT_RESOLVES; iter++) {
      const hit = S.asteroidSweptHit(
        _prevPos.x, _prevPos.y, _prevPos.z,
        player.pos.x, player.pos.y, player.pos.z, SHIP_R);
      if (!hit) break;
      _impContact.copy(_prevPos).lerp(player.pos, hit.t);
      _impN.set(_impContact.x - hit.cx, _impContact.y - hit.cy, _impContact.z - hit.cz);
      if (_impN.lengthSq() < 1e-12) _impN.copy(player.vel).multiplyScalar(-1); // dead-centre
      if (_impN.lengthSq() < 1e-12) _impN.set(0, 1, 0);
      _impN.normalize();
      // closing speed along the surface normal, taken BEFORE the deflection
      const vn = player.vel.dot(_impN);
      const closing = vn < 0 ? -vn : 0;
      // push out to the surface (terrain's clamp-to-clearance, on a sphere)
      player.pos.set(hit.cx, hit.cy, hit.cz).addScaledVector(_impN, hit.r + SHIP_R + 0.001);
      // deflect (terrain's 0.3 restitution, on a normal that is not straight up)
      if (vn < 0) player.vel.addScaledVector(_impN, -vn * (1 + IMPACT_RESTITUTION));
      const dmg = IMPACT_DMG_AT_CRUISE * (closing / MAXV.cruise) * (closing / MAXV.cruise);
      // CONTACT CHATTER, and why the counter is gated on the damage floor.
      // Holding thrust into a rock is a real thing a player does. Each frame
      // the deflection pushes the ship out at 0.3 of its closing speed and the
      // thrust lerp pulls it back in, so the ship re-contacts every few frames
      // for as long as the throttle is held. MEASURED on the first build of
      // this fix, which counted every contact: ONE approach logged 331 impacts
      // (artifacts/r14-collide/probe-volume-radius.json), which is a resting
      // ship's telemetry, not a collision count.
      //   So a contact is only an IMPACT when it costs the player something.
      // Sub-floor contacts still resolve — the ship is still pushed out and
      // still deflected — they simply do not fire damagePlayer (which would
      // otherwise stamp lastDamageT every frame and permanently suppress the
      // 5-second shield regen), do not spawn a ripple, and do not count.
      //   The floor is 1.0 damage, which the quadratic puts at a closing speed
      // of 150 x sqrt(1/40) = 23.7 u/s, i.e. 16% of cruise.
      //   CORRECTION, and it is a correction to what this comment first said.
      // The first version predicted a pinned ship would pay "roughly 8 small
      // impacts a second" as the throttle rebuilt the closing speed past the
      // floor. THE INSTRUMENT SAYS OTHERWISE and the instrument wins. The
      // deflection zeroes the inward normal component every frame, while the
      // thrust lerp only rebuilds dt x accel = 2.8% of 150 = 4.2 u/s per
      // frame, and the next frame's contact zeroes that again — so the closing
      // speed never climbs to 23.7 and a pinned ship pays NOTHING further.
      // MEASURED (artifacts/r14-collide/probe-fixed.json, cruise head-on): the
      // approach logs exactly TWO impacts, 40.00 then 2.44 damage 0.32s later,
      // then 347 silent contacts with the ship resting at 1.0 u/s exactly
      // SHIP_R off the bounding sphere. The prediction was wrong by a factor
      // of the accel term; it is left visible rather than quietly deleted.
      if (dmg >= IMPACT_DMG_FLOOR && !wrecked) {
        G.telemetryData.asteroidImpacts++;
        const ev = G.telemetryData.asteroidImpactEvents;
        if (ev.length >= IMPACT_EVENT_CAP) ev.shift();
        ev.push({
          t: Math.round(G.time * 1000) / 1000,
          rock: hit.index,
          rockRadius: Math.round(hit.r * 100) / 100,
          speed: Math.round(player.speed * 10) / 10,
          closingSpeed: Math.round(closing * 10) / 10,
          damage: Math.round(dmg * 100) / 100,
          shieldBefore: Math.round(player.shield * 100) / 100,
          hullBefore: Math.round(player.hull * 100) / 100,
          startedInside: hit.startedInside,
        });
        // spatial read for the hit, in the grammar the game already uses for
        // "something struck the shield" (the m5 posed impacts call the same fn)
        if (G.vfx && G.vfx.shieldRipple) G.vfx.shieldRipple(_impContact, 0x86d8ff);
        // r15 asteroid-nearmiss — HUNG OFF THE GATED COUNTER, DELIBERATELY.
        // The round-14 hand-off is explicit that the damage floor is
        // load-bearing here: the ungated proximity signal read 347 "impacts"
        // for ONE approach (a resting ship's telemetry, not a collision
        // count), so a line wired to it would have stuttered 347 times.
        //   IT IS IMPACT-ONLY, AND THE NAME OVERSTATES IT. A true near miss —
        // a close approach that never touches — HAS NO SIGNAL IN THIS BUILD.
        // The two counters r14 shipped are asteroidImpacts (contact costing
        // damage) and asteroidContacts (contact costing nothing); both require
        // the swept sphere to actually overlap the rock. There is no
        // proximity-without-contact query, and inventing one here would mean a
        // second broadphase pass for a voice line. So the line fires on a real
        // impact, the manifest text survives it ("that was closer than I would
        // like"), and the gap is recorded rather than papered over.
        if (G.audio && G.audio.say) G.audio.say('asteroid-nearmiss');
        damagePlayer(dmg);
      } else {
        G.telemetryData.asteroidContacts++;   // resolved, cost nothing, not an impact
      }
      _prevPos.copy(player.pos); // next iteration sweeps from the resolved point
    }
  }

  // ================= enemies =================
  // four seeded silhouette/accent variants (see buildFighterVariant). Own
  // rng streams so the 'flight' stream (AI, spawns, names) stays untouched —
  // geometry changes must not shift gameplay determinism.
  const fighterVariants = [];
  for (let v = 0; v < FIGHTER_VARIANTS; v++) {
    fighterVariants.push(buildFighterVariant(G.rngFor('fighter-v' + v), v));
  }
  // 3-material dart (see buildFighterVariant): dark metal hull with a hard sun
  // ping, matte painted green panels, and unlit hot engine/canopy parts.
  // r4 critics: fighters read as EMISSIVE GREEN BLOBS at pose distance — the
  // self-glow floor was doing the lighting job the sun should do. r5: halve
  // the emissive floors (just enough to keep shade off dead-black), sharpen
  // the hull specular so the sun ping carves the silhouette.
  // r11 (HO-12, deferred out of r11-craft and landed here alongside the vfx.js
  // emissive cuts — that pairing is what the hand-off asked for): both emissive
  // floors HALVED again. r5 halved them once to kill the r4 "emissive green
  // blobs"; the round-11 measurement says they are still doing the wrong job.
  // An emissive floor is by definition a dark-end lift and the dark end IS the
  // defect — AERO-TARGETS measures our craft at p5 133-136 against a reference
  // at 45. Zeroing both, on frozen isolation masks, gives p5 -5.24 / span +4.66
  // (r11-craft's critic independently measured p5 -6.8/-8.2/-3.3 per craft, so
  // the two instruments agree). Halved rather than zeroed because the stated
  // purpose — keeping shade off dead-black — is still real, and this round is
  // not going to re-run the r4 regression to find out exactly where that edge
  // sits.
  //
  // CORRECTION, caught by r11-aero's own critic before this shipped: an earlier
  // version of this comment claimed metalness 0.9 is "precisely why the
  // albedo-side key split in vfx.js is inert on this material". That is WRONG.
  // three.js sets specularColor = mix(vec3(0.04), diffuseColor, metalness), so
  // at 0.9 the base colour still drives ~90% of F0 rather than being discarded.
  // Measured by runtime shader patch on the shipped build: scaling diffuseColor
  // to 0.05 moves p5 by -16.85, and to 0.70 by -3.27 for only -0.55 p95. The
  // diffuse path on this material is LIVE and is the best span-per-p5 lever
  // found all round (0.83 against the 0.77 of what shipped) — see hand-off
  // HO-A6. It is the terminator FLOOR specifically that is inert, for the
  // narrower reason written out at the key-split site in vfx.js. Do not read
  // "metalness 0.9" as "albedo does not matter here".
  const fighterHullMat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.17, metalness: 0.9, // harder sun ping on the metal
    emissive: 0x0a0d10, emissiveIntensity: 0.85, // shadow floor only — sun does the work
  });
  const fighterPanelMat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.48, metalness: 0.22, // paint with a slight sheen
    emissive: 0x0f1c13, emissiveIntensity: 0.9, // hint of green in shade, no self-glow (r7: nudged so shadow-side planforms read at pose distance without the r4 blob regression)
  });
  const fighterGlowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  fighterGlowMat.color.setScalar(2.2); // engine discs + canopy still cross bloom knee
  const fighterMat = [fighterHullMat, fighterPanelMat, fighterGlowMat];
  const glowTexC = document.createElement('canvas');
  glowTexC.width = glowTexC.height = 64;
  {
    const g = glowTexC.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(180,255,240,1)');
    gr.addColorStop(0.5, 'rgba(60,220,190,0.5)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
  }
  const glowTex = new THREE.CanvasTexture(glowTexC);

  const MAX_ENEMIES = 8;
  const enemies = [];
  const glowMat = new THREE.SpriteMaterial({
    map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  glowMat.color.set(0x70ffd8).multiplyScalar(1.6); // hot halo: engines are the 300-600u beacon
  for (let i = 0; i < MAX_ENEMIES; i++) {
    // pool slot i wears variant i%4 — deterministic per-ship variety with
    // zero per-spawn geometry work
    const variant = fighterVariants[i % FIGHTER_VARIANTS];
    const mesh = new THREE.Mesh(variant.geo, fighterMat);
    mesh.scale.setScalar(2.6); // chunky, readable through the canopy
    mesh.visible = false;
    G.scene.add(mesh);
    // bright engine glow on each pod tail — the "look here" beacon at range.
    // Gameplay scale stays 4.5: bigger additive quads cost real fill rate when
    // fighters pass the camera (measured: 6.0 scale = 257 -> 194 avg fps).
    // Moment poses bump per-enemy scale via en.glowL/en.glowR so frozen
    // fighters halo past their hull silhouette in captures at zero session cost.
    // per-enemy halo material (same map/program, own opacity uniform) so the
    // halo can FADE at close range — critic pass 1: the posed close crosser
    // was "a blown-out circle with streaks fanning off it", the additive
    // halos swallowing the hull they were meant to garnish. Far ships keep
    // the full 300-600u beacon; near ones hand the job to the geometry discs.
    const haloMat = glowMat.clone();
    const glowL = new THREE.Sprite(haloMat);
    glowL.scale.set(4.5, 4.5, 1);
    glowL.position.copy(variant.engines[0]);
    mesh.add(glowL);
    const glowR = new THREE.Sprite(haloMat);
    glowR.scale.set(4.5, 4.5, 1);
    glowR.position.copy(variant.engines[1]);
    mesh.add(glowR);
    // hp label sprite
    const hpCanvas = hpLabelCanvas();
    const hpTex = new THREE.CanvasTexture(hpCanvas);
    const hpSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: hpTex, depthWrite: false, depthTest: false, opacity: 0.92,
    }));
    // small square tick block sitting TIGHT over the hull (was 14x7 at y=5.5
    // — read as a big floating numeral)
    // R9 (ui, critic cycle 1): "plain white text hanging in space beside the
    // target, with no reticle, no plate" — against a reference that puts the
    // same numbers inside a small ring LOCKED AROUND the target silhouette.
    // The ring is sized off the variant's own bounding sphere (same local
    // space as the sprite), so it hugs every hull shape in the pool.
    variant.geo.computeBoundingSphere();
    const bs = variant.geo.boundingSphere;
    const hpR = (bs ? bs.radius : 2.4) * 2.05;
    hpSprite.scale.set(hpR, hpR, 1);
    // centre on the hull's bounding-sphere centre, not the mesh origin —
    // the variants are not symmetric about it and an offset ring reads as a
    // decal that happens to be nearby rather than a lock
    if (bs) hpSprite.position.copy(bs.center); else hpSprite.position.set(0, 0, 0);
    mesh.add(hpSprite);
    enemies.push({
      alive: false, mesh, hpSprite, hpTex, hpCanvas, glowL, glowR, haloMat,
      pos: mesh.position, quat: mesh.quaternion,
      vel: new THREE.Vector3(), hp: 100, maxHp: 100,
      state: 'pursuit', stateT: 0, fireT: 0, aimErr: 0.06,
      evadeDir: new THREE.Vector3(), orbitOffset: new THREE.Vector3(), orbitT: 0,
      frozen: false, scriptFire: 0, boltColor: 0x30f0ff, scriptAimOffset: null,
      name: 'Outlaw Interceptor',
    });
  }

  // NMS damage-tick grammar (ref-5): a SMALL stacked double — current over
  // max, thin divider — in a light face with slight transparency, glued
  // tight over the target. r4 critique: single large floating numeral read
  // as a game-jam damage popup, not the NMS 640/640 tick.
  function drawHp(en) {
    const S = 192, C = S / 2;
    const g = en.hpCanvas.getContext('2d');
    g.clearRect(0, 0, S, S);
    const hp = `${Math.max(0, en.hp | 0)}`;
    const max = `${en.maxHp | 0}`;
    const FACE = (wt, px) => `${wt} ${px}px "Avenir Next Condensed", "Arial Narrow", "Avenir Next", sans-serif`;
    // --- reticle ring: four arcs with gaps at the cardinals, plus corner
    // bracket ticks outside them. Thin, dim, and broken — a lock indicator,
    // not a crosshair decal.
    const R = C - 26;
    g.shadowColor = 'rgba(0,0,0,0.55)';
    g.shadowBlur = 5;
    g.strokeStyle = 'rgba(238,244,248,0.44)';
    g.lineWidth = 1.7;
    for (let q = 0; q < 4; q++) {
      const a0 = q * Math.PI / 2 + 0.20, a1 = (q + 1) * Math.PI / 2 - 0.20;
      g.beginPath(); g.arc(C, C, R, a0, a1); g.stroke();
    }
    // bracket ticks on the diagonals — the ring's mounting marks
    g.lineWidth = 2.0;
    g.strokeStyle = 'rgba(238,244,248,0.34)';
    for (let q = 0; q < 4; q++) {
      const a = q * Math.PI / 2 + Math.PI / 4;
      const cx = Math.cos(a), sy = Math.sin(a);
      g.beginPath();
      g.moveTo(C + cx * (R + 3), C + sy * (R + 3));
      g.lineTo(C + cx * (R + 13), C + sy * (R + 13));
      g.stroke();
    }
    // --- damage tick riding the ring's upper-right shoulder: current over
    // max with a thin divider (the stacked NMS double), leader line back to
    // the ring so the numbers belong to the lock rather than float near it
    const tx = C + R * 0.60, ty = C - R * 0.62;
    g.strokeStyle = 'rgba(238,244,248,0.32)';
    g.lineWidth = 1.3;
    g.beginPath();
    g.moveTo(C + Math.cos(-0.80) * R, C + Math.sin(-0.80) * R);
    g.lineTo(tx - 3, ty + 9);
    g.stroke();
    g.textAlign = 'left';
    g.font = FACE('600', 17);
    g.fillStyle = 'rgba(240,245,249,0.82)';
    g.fillText(hp, tx, ty + 2);
    g.font = FACE('500', 14);
    g.fillStyle = 'rgba(240,245,249,0.55)';
    g.fillText(max, tx, ty + 22);
    g.shadowBlur = 0;
    g.strokeStyle = 'rgba(240,245,249,0.38)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(tx, ty + 8);
    g.lineTo(tx + 22, ty + 8);
    g.stroke();
    en.hpTex.needsUpdate = true;
  }

  // per-class stats for telemetry (game.enemyClassStats).
  //
  // r10 — r9 reported `hp`/`dmgPerBolt`/`speedCap` as if they were class
  // PROPERTIES; they were last-write-wins snapshots of whichever ship spawned
  // most recently, so "raider: spawned 5, hp 170" was false for the three that
  // spawned at hp 100 in wave 1. Configured values now report the RANGE
  // actually spawned (min/max over every spawn of the class), and everything
  // measured from the running sim lives under `observed`, separately named.
  const range = () => ({ min: null, max: null });
  const seen = (r, v) => {
    if (r.min === null || v < r.min) r.min = v;
    if (r.max === null || v > r.max) r.max = v;
  };
  function cstat(cls) {
    let s = G.telemetryData.enemyClassStats[cls];
    if (!s) {
      s = G.telemetryData.enemyClassStats[cls] = {
        spawned: 0, killed: 0, shotsFired: 0, hitsOnPlayer: 0, points: 0,
        // what the difficulty curve x class multipliers ASKED for, as the
        // spread over every spawn of this class in the run
        configured: {
          hp: range(), dmgPerBolt: range(),
          nominalSpeed: range(),  // the class's steady-state speed target
          speedLimit: range(),    // nominalSpeed * burst — the ENFORCED ceiling
          // r11: the class's MARKSMANSHIP, after the class aim multiplier.
          // This is the dispersion half-width the ship actually spawned with,
          // which is what separates "shoots badly" from "shoots badly but has
          // a big beaten zone" — the two were indistinguishable in r10
          // telemetry, and the gunship's design rationale turns on exactly
          // that distinction.
          aimErr: range(),
        },
        // what the sim actually did
        observed: {
          // r11 — `maxSpeed` used to hold the post-clamp VELOCITY magnitude,
          // sampled immediately after the clamp that guarantees it, and was
          // then compared against a RUN-WIDE max speedLimit across ships with
          // different individual limits. Both halves made the assertion
          // near-unfalsifiable: a wave-1 raider (limit 117) running at 130
          // was invisible to it. The decomposition below is per-ship and
          // includes a pre-clamp reading, so the detector can be shown to
          // fire.
          maxSpeed: 0,            // TRUE observed speed: |dPos|/dt across EVERY
                                  // write to en.pos in a step (integration AND
                                  // the planet ground-clearance correction)
          maxVelMagnitude: 0,     // post-clamp |en.vel| — what r10 called maxSpeed
          overLimitFrames: 0,     // frames where post-clamp |vel| exceeded THIS
                                  // ship's OWN speedLimit. Must be 0; CAN be >0.
          maxOverLimitRatio: 0,   // worst post-clamp |vel| / that ship's own limit
          maxOverLimitRatioPreClamp: 0, // same measurement one line earlier —
                                  // >1 proves the clamp is load-bearing AND that
                                  // this detector actually fires on over-speed
          clampEngagements: 0,    // frames the clamp actually reduced a velocity
          terrainLiftFrames: 0,   // frames the planet ground correction moved the
                                  // ship — explains any maxSpeed > maxVelMagnitude
          meanFireDistance: 0,    // behavioural signature: standoff vs knife-fight
          burnEvents: 0,          // gunship siege burns (0 for the darts)
          // MEASURED accuracy: bolts of this class that connected with the
          // player / bolts of this class fired. This is the honest replacement
          // for r9's difficultyProjection[].aimAccuracy, which was literally
          // 1 - aimErr — the complement of a dispersion half-width, reported as
          // if it were a hit rate.
          hitRateOnPlayer: 0,
        },
      };
    }
    return s;
  }

  // score credit for a kill — the one path both real kills (damageEnemy) and
  // the deterministic session failsafe (autopilot.forceClear) go through, so
  // telemetry score always equals sum(class points x system mult) + bonuses
  function creditKill(en) {
    // r12 POSTHUMOUS-SCORING GUARD (3 of 5). See the decision block above
    // checkHits(). Defence in depth: this is the chokepoint every KILL award
    // passes through, so a caller that gets past the checkHits and damageEnemy
    // guards still cannot credit a kill to a wreck.
    // NOT "every point-award" — CORRECTION, critic CMT-7: endWave() writes the
    // wave-clear bonus straight to score (measured, 0 -> 200 on a build with
    // only this guard in place) and the F.addScore test hook writes score
    // directly. Guard 4 covers the first; the second is deliberately unguarded,
    // see below.
    // MEASURED on the build this sentence describes, which is the part the
    // first draft got wrong (critic CMT-5: it cited path P4, and P4 runs with
    // ALL FOUR guards stripped, so it never tested "with only checkHits in
    // place"). The critic built that exact single-guard variant and measured
    // creditKill taking score 0 -> 100 while destroyed:
    // artifacts/r12-bug/critic-comments.json. This guard is load-bearing.
    if (G.state === 'destroyed') return;
    const cls = en.cls || 'raider';
    const pts = Math.round(ENEMY_CLASSES[cls].points * (1 + G.systemIndex * 0.5));
    G.telemetryData.score += pts;
    const s = cstat(cls);
    s.killed++;
    s.points += pts;
  }

  let gunshipSaidForSystem = -1;   // r15: first gunship of each system only

  function spawnEnemy(pos, sysIndex, waveNum, clsName = 'raider') {
    const en = enemies.find(e => !e.alive);
    if (!en) return null;
    if (G.noteSpike) G.noteSpike('spawn');
    const cls = ENEMY_CLASSES[clsName] || ENEMY_CLASSES.raider;
    en.alive = true;
    en.frozen = false;
    en.scriptAimOffset = null;
    en.cls = clsName;
    // name: same two seeded draws for every class (determinism guard); the
    // second word swaps to a class-consistent one via the SAME drawn index
    const bIdx = (rng() * RAIDER_B.length) | 0;
    const bWord = CLASS_NAMES[clsName] ? CLASS_NAMES[clsName][bIdx % 2] : RAIDER_B[bIdx];
    en.name = RAIDER_A[(rng() * RAIDER_A.length) | 0] + ' ' + bWord;
    en.glowL.scale.set(4.5, 4.5, 1); // poses may enlarge; live spawns reset
    en.glowR.scale.set(4.5, 4.5, 1);
    en.pos.copy(pos);
    en.vel.set(0, 0, 0);
    en.maxHp = en.hp = Math.round(curve.hp(sysIndex, waveNum) * cls.hp);
    en.aimErr = curve.aimErr(sysIndex, waveNum) * cls.aim;
    // nominalSpeed = steady-state target; speedLimit = the hard ceiling the
    // clamp in updateEnemy enforces on the integrated velocity. Neither is
    // r9's "speedCap", which capped nothing.
    en.nominalSpeed = curve.speed(sysIndex, waveNum) * cls.speed;
    en.speedLimit = en.nominalSpeed * (cls.burst || 1.3);
    en.dmg = Math.round(curve.dmg(sysIndex) * cls.dmg * 10) / 10;
    en.fireRateMul = cls.fireRate;
    en.agility = cls.agility;
    en.engage = cls.engage || 'pursuit';
    en.fireArcCos = cls.fireArcCos !== undefined ? cls.fireArcCos : 0.72;
    en.fireRange = cls.fireRange || 750;
    en.burning = false;
    en.burnT = 1.0; // first siege burn is available a second after arrival
    en.hitR = 14 * ((cls.scale[0] + cls.scale[1] + cls.scale[2]) / 3) / 2.6;
    en.boltColor = clsName === 'gunship' ? 0xff8c30 : 0x30f0ff; // heavy shot reads warm
    en.mesh.scale.set(cls.scale[0], cls.scale[1], cls.scale[2]);
    en.state = 'pursuit';
    en.stateT = 0;
    en.fireT = (0.5 + rng() * 1.2) / cls.fireRate;
    en.orbitT = 0;
    en.orbitOffset.set(rng() - 0.5, (rng() - 0.5) * 0.6, rng() - 0.5).normalize().multiplyScalar(120 + rng() * 160);
    en.mesh.visible = true;
    const s = cstat(clsName);
    s.spawned++;
    // r15: the heavy gets an introduction, once per system. Not once per wave
    // and not once per spawn — the point is "you have not met one of these
    // HERE before", and gunships appear from system 2 on (waveComposition).
    if (clsName === 'gunship' && gunshipSaidForSystem !== G.systemIndex) {
      gunshipSaidForSystem = G.systemIndex;
      if (G.audio && G.audio.say) G.audio.say('gunship');
    }
    if (wave.statEntry && wave.statEntry.clearedInS === null) wave.statEntry.enemySpawnedInWave++;
    // configured values are RANGES over every spawn, not a last-write snapshot
    seen(s.configured.hp, en.maxHp);
    seen(s.configured.dmgPerBolt, en.dmg);
    seen(s.configured.nominalSpeed, Math.round(en.nominalSpeed * 10) / 10);
    seen(s.configured.speedLimit, Math.round(en.speedLimit * 10) / 10);
    seen(s.configured.aimErr, Math.round(en.aimErr * 10000) / 10000);
    drawHp(en);
    // arrival flash
    G.vfx.sparkBurst(pos, 0xa0f0ff, 24);
    return en;
  }

  // ================= waves =================
  const wave = { num: 0, pending: 0, active: false, spawnT: 0, toSpawn: 0, startT: 0, statEntry: null, comp: [], spawnIdx: 0 };

  // class mix per wave: COUNTS follow the documented difficulty schedule
  // (interceptors from the second wave on, gunships from system 2+, both
  // thickening with system/wave); slot ORDER is a seeded shuffle from a
  // dedicated rng stream, so the mix derives from the seed without touching
  // the 'flight' stream that drives AI, names and spawn positions.
  // System-1 wave-1 is ALL raiders — first contact stays forgiving and the
  // scripted session's wave-1 invariants (3 raiders, red-alert timing) hold.
  function waveComposition(sys, num, count) {
    const comp = new Array(count).fill('raider');
    if (sys === 0 && num <= 1) return comp;
    const nGun = sys >= 1 ? Math.min(count - 2, 1 + Math.floor((sys - 1 + Math.max(0, num - 2)) / 2)) : 0;
    const nInt = Math.min(count - nGun - 1, Math.max(1, Math.floor((count - nGun) / 3) + (sys >= 2 ? 1 : 0)));
    let i = 0;
    for (let k = 0; k < nGun; k++) comp[i++] = 'gunship';
    for (let k = 0; k < nInt; k++) comp[i++] = 'interceptor';
    const wrng = G.rngFor('wavecomp-s' + sys + '-w' + num);
    for (let k = count - 1; k > 0; k--) {
      const jx = (wrng() * (k + 1)) | 0;
      const t = comp[k]; comp[k] = comp[jx]; comp[jx] = t;
    }
    return comp;
  }

  function startWave(num) {
    if (G.noteSpike) G.noteSpike('wave-start');
    if (G.audio && G.audio.say) G.audio.say('wave-incoming');
    shieldLowSaidForWave = -1;   // r15: shield-low is once per wave
    wave.num = num;
    wave.active = true;
    wave.toSpawn = Math.min(MAX_ENEMIES, 2 + num + Math.floor(G.systemIndex * 0.5));
    wave.spawnT = 0;
    wave.startT = G.time;
    wave.comp = waveComposition(G.systemIndex, num, wave.toSpawn);
    wave.spawnIdx = 0;
    G.telemetryData.wave = num;
    // per-wave difficulty telemetry — escalation must be provable from numbers
    const sys = G.systemIndex;
    const avgFireInterval = 0.4 + 0.5 * curve.fireScale(sys);
    const mix = {};
    for (const c of wave.comp) mix[c] = (mix[c] || 0) + 1;
    // EXECUTED difficulty for this wave — the base (class-multiplier-free)
    // values the sim is about to spawn against, at the REAL wave number.
    // This is the measurement; game.difficultyProjection is the projection.
    // r11 telemetry sweep — two fields in this row over-claimed in exactly the
    // way r10's rule forbids, and both sat directly beside `classMix`:
    //   * `enemyFireRate` was 1/(0.4 + 0.5*fireScale) with NO class fireRate
    //     multiplier, reported as one number (1.29) for a wave holding raider
    //     1.0, interceptor 1.3 and gunship 0.55. Read as "this wave's fire
    //     rate" it predicted ~59 raider shots in wave 1's 16.7s against 24
    //     actually fired. It is a per-ship BASE refire cadence, before the
    //     class multiplier and before arc/range gating ever throttles it.
    //   * `enemyAimError` had the identical defect against `cls.aim`.
    // Both are now named `...Base` (matching enemyHpBase / enemyDmgPerBoltBase /
    // enemyNominalSpeedBase), both ship a per-class breakdown for the classes
    // this wave actually contains, and the row carries a MEASURED shot count so
    // a reader can compute the real rate instead of inferring one.
    const refireHzBase = Math.round((1 / avgFireInterval) * 100) / 100;
    const aimErrBase = curve.aimErr(sys, num);
    const byClass = (f) => {
      const o = {};
      for (const c of Object.keys(mix)) o[c] = f(ENEMY_CLASSES[c] || ENEMY_CLASSES.raider);
      return o;
    };
    wave.statEntry = {
      system: sys + 1,
      wave: num,
      // r11 sweep: `enemyCount` was the PLANNED total, fixed at wave start. A
      // wave handed to the player by the failsafe never spawns all of them, so
      // the field over-claimed in exactly the direction that matters. Planned
      // and spawned are now two names.
      enemyCountPlanned: wave.toSpawn,
      enemySpawnedInWave: 0,
      enemyHpBase: curve.hp(sys, num),
      // per-ship refire cadence BEFORE the class fireRate multiplier and
      // before the firing-arc / range gate. NOT the wave's shot rate.
      enemyRefireHzBase: refireHzBase,
      enemyRefireHzByClass: byClass(c => Math.round(refireHzBase * c.fireRate * 100) / 100),
      enemyAimErrorBase: aimErrBase,
      enemyAimErrorByClass: byClass(c => Math.round(aimErrBase * c.aim * 10000) / 10000),
      enemyDmgPerBoltBase: curve.dmg(sys),
      enemyDmgPerBoltByClass: byClass(c => Math.round(curve.dmg(sys) * c.dmg * 10) / 10),
      classMix: mix,
      clearedInS: null,
      playerShieldLost: 0,
      // MEASURED, this wave only — the counterpart to the projected cadence
      // above. enemyShotsInWave / clearedInS is the wave's real fleet fire rate.
      enemyShotsInWave: 0,
      enemyHitsInWave: 0,
    };
    G.telemetryData.waveStats.push(wave.statEntry);
  }

  function aliveCount() {
    let n = 0;
    for (const e of enemies) if (e.alive) n++;
    return n;
  }

  // current combat target for the HUD (cockpit.js reads G.target.name /
  // G.target.hp / G.target.maxHp) — nearest alive hostile, null when clear.
  // Reference assignment only: no per-frame allocation.
  function updateTarget() {
    let best = null, bd = Infinity;
    for (const en of enemies) {
      if (!en.alive) continue;
      const d = en.pos.distanceToSquared(player.pos);
      if (d < bd) { bd = d; best = en; }
    }
    G.target = best;
  }

  // ================= weapons =================
  const _fwd = new THREE.Vector3(), _muzzle = new THREE.Vector3(), _tmp = new THREE.Vector3(), _tmp2 = new THREE.Vector3();

  function playerFire(aimDir) {
    // r12 POSTHUMOUS-SCORING GUARD (5 of 5) — a wreck fires no new ordnance.
    // ADDED IN RESPONSE TO THE IN-WORKTREE CRITIC (finding CMT-11). The first
    // draft left this path to main.js, which zeroes G.input.fire the moment the
    // state flips (~main.js:1020), and merely asserted in the regression test
    // that shotsFired stays frozen. The critic's objection is right on both
    // counts: (a) that assertion was VACUOUS — it passed identically on a build
    // with every guard removed, because the path it tests is closed in a
    // different file, so it had no falsification arm and could never have
    // failed; and (b) calling F.playerFire() directly while destroyed really
    // did fire a real bolt and move shotsFired 1 -> 2 (measured, critic path
    // C5). With this guard the assertion becomes falsifiable like the other
    // four, and the closure stops depending on a file this worker does not own.
    // NOT a behaviour change on any reachable path today: the only callers are
    // flight.update's `if (G.input.fire)` (already zeroed by main.js) and the
    // posed-capture path, which uses scriptedPlayerFire and never runs in the
    // 'destroyed' state.
    if (G.state === 'destroyed') return false;
    if (player.overheated || fireCooldown > 0) return false;
    fireCooldown = 0.125;
    muzzleSide = -muzzleSide;
    lastFireT = G.time;
    _fwd.set(0, 0, -1).applyQuaternion(player.quat);
    const dir = aimDir ? _tmp2.copy(aimDir).normalize() : _fwd;
    // wingtip cannons: wide muzzles make the twin tracers read on screen
    // (bolts hugging the camera axis foreshorten into invisible dots)
    _muzzle.copy(player.pos)
      .addScaledVector(_tmp.set(1, 0, 0).applyQuaternion(player.quat), muzzleSide * 5.0)
      .addScaledVector(_tmp.set(0, 1, 0).applyQuaternion(player.quat), -2.2)
      .addScaledVector(_fwd, 3);
    const vel = _tmp.copy(dir).multiplyScalar(BOLT_SPEED).add(player.vel);
    G.vfx.fireBolt(_muzzle, vel, 0xffc860, 'player', 1.7);
    // r15 CANNON HEAT UPGRADE — the divisor is the whole mechanic.
    // HEAT_PER_SHOT is unchanged at 0.085 and so is every cooldown semantic
    // below (decay 0.28/s after a 0.35s idle, un-overheat at 0.35). What grows
    // is ENDURANCE: heat per shot is divided by player.heatCap, so the 0..1
    // gauge fills heatCap times slower and time-to-overheat scales linearly
    // with it. Nothing about recovery, nothing about damage, nothing about the
    // enemy. See grantCannonUpgrade() for the curve and its measured cap.
    player.heat += HEAT_PER_SHOT / player.heatCap;
    if (player.heat >= 1) {
      player.heat = 1;
      player.overheated = true;
      G.audio.overheat();
      G.audio.say && G.audio.say('overheat');
    }
    G.telemetryData.shotsFired++;
    G.audio.laser();
    return true;
  }

  const _direct = new THREE.Vector3(), _intercept = new THREE.Vector3();
  const COS_3DEG = Math.cos(3 * Math.PI / 180);     // fire dir must land this close to the intercept
  const COS_1_5DEG = Math.cos(1.5 * Math.PI / 180); // and intercept must differ from the direct line

  function enemyFire(en, target, lead) {
    _muzzle.copy(en.pos).addScaledVector(_tmp.set(0, 0, -1).applyQuaternion(en.quat), 6);
    _direct.copy(target).sub(_muzzle).normalize();
    const aim = _tmp2.copy(target);
    if (lead) {
      const dist = en.pos.distanceTo(target);
      const tof = dist / ENEMY_BOLT_SPEED;
      aim.addScaledVector(player.vel, tof);
    }
    const dir = aim.sub(_muzzle).normalize();
    _intercept.copy(dir); // time-of-flight intercept solution, pre-error
    // aim error
    dir.x += (rng() - 0.5) * en.aimErr * 2;
    dir.y += (rng() - 0.5) * en.aimErr * 2;
    dir.z += (rng() - 0.5) * en.aimErr * 2;
    dir.normalize();
    // honest lead accounting: count only shots that actually FLEW at the
    // intercept solution (within 3 deg after aim error) AND where the intercept
    // measurably differs from the direct line to the player (else it's just a
    // straight shot, lead or not).
    if (lead && dir.dot(_intercept) > COS_3DEG && _intercept.dot(_direct) < COS_1_5DEG) {
      G.telemetryData.enemyLeadShots++;
    }
    const vel = _tmp.copy(dir).multiplyScalar(ENEMY_BOLT_SPEED);
    // class-scaled beam: gunship slugs read heavy, interceptor needles light
    const boltScale = en.cls === 'gunship' ? 3.2 : en.cls === 'interceptor' ? 1.6 : 2.2;
    const b = G.vfx.fireBolt(_muzzle, vel, en.boltColor, 'enemy', boltScale); // long beam read
    if (b) {
      b.dmg = en.dmg;         // per-class damage rides on the bolt (checkHits)
      b.cls = en.cls || 'raider'; // ...and so does the class, for hitsOnPlayer
      // AREA DENIAL — the third leg of the gunship fix. A heavy that shoots
      // from 500-700u out still hits nothing if it needs the same 5u pinpoint
      // as a dart: at that range its aim error is about +/-24u, so ~4% of
      // shots connect (measured: 1 hit in 33 shots, arena pass 1). The heavy's
      // ordnance is PROXIMITY-FUSED, an 11u burst radius, so what threatens is
      // its suppression volume rather than its marksmanship. Nothing new is
      // drawn for it: same bolt colour, same scale, same pooled sprite.
      b.hitRadius = en.cls === 'gunship' ? 11 : 5;
    }
    G.telemetryData.enemyShotsFired++;
    if (wave.statEntry && wave.statEntry.clearedInS === null) wave.statEntry.enemyShotsInWave++;
    const cs = cstat(en.cls || 'raider');
    cs.shotsFired++;
    // measured accuracy for this class, kept in step with every shot so the
    // field is never a stale ratio (see observed.hitRateOnPlayer)
    cs.observed.hitRateOnPlayer = Math.round((cs.hitsOnPlayer / cs.shotsFired) * 1000) / 1000;
    // running mean firing range — the standoff-vs-knife-fight signature that
    // separates the siege gunship from the two darts in telemetry
    const fireDist = en.pos.distanceTo(target);
    cs.observed.meanFireDistance = Math.round(
      ((cs.observed.meanFireDistance * (cs.shotsFired - 1)) + fireDist) / cs.shotsFired * 10) / 10;
    G.audio.enemyLaser();
  }

  // ================= damage =================
  // r15 voice gate: shield-low fires ONCE PER WAVE, not once per hit. The
  // per-event cooldown in voice.js is the backstop; this is the semantic gate,
  // and it is reset in startWave. Without it a shield sitting at 28 would
  // re-request the line on every single bolt for the rest of the wave.
  let shieldLowSaidForWave = -1;
  const SHIELD_LOW_AT = 30;
  const HULL_CRITICAL_AT = 25;

  function damagePlayer(amount) {
    if (G.state === 'destroyed') return; // wreck takes no further hits
    if (G.dietest) amount *= 8; // ?dietest=1 — accelerated death for testing (HARNESS.md)
    player.lastDamageT = G.time;
    G.post.hit(0.5);
    G.audio.shieldHit();
    if (player.shield > 0) {
      if (wave.statEntry && wave.statEntry.clearedInS === null) {
        wave.statEntry.playerShieldLost += Math.min(player.shield, amount);
      }
      player.shield -= amount;
      if (player.shield <= 0) {
        player.shield = 0;
        if (G.state !== 'red-alert') {
          G.enterRedAlert();   // r15: the shield-down line hangs off enterRedAlert (main.js)
        }
      } else if (player.shield < SHIELD_LOW_AT && shieldLowSaidForWave !== wave.num) {
        shieldLowSaidForWave = wave.num;
        if (G.audio && G.audio.say) G.audio.say('shield-low');
      }
    } else {
      player.hull -= amount * 0.7;
      if (player.hull > 0 && player.hull < HULL_CRITICAL_AT) {
        // no once-per-wave gate here: hull does not regenerate, so this can
        // only fire while the player is genuinely in the last quarter of it,
        // and voice.js's 20 s cooldown is the whole throttle it needs.
        if (G.audio && G.audio.say) G.audio.say('hull-critical');
      }
      if (player.hull <= 0) {
        G.telemetryData.deaths++;
        if (!G.harness && G.beginDestruction) {
          // human play: hull gone -> destruction sequence -> game over (ui.js)
          player.hull = 0;
          G.beginDestruction();
        } else {
          // HARNESS (any of ?session/?moment/?harness): soft respawn — keep
          // the session alive. Scripted critic sessions must never dead-end;
          // this is the r8 behaviour verbatim (contract: HARNESS.md).
          //
          // r10 DEATH-SCORE DECISION (see DECISIONS-gameplay.md): a respawn
          // costs 20% of the score banked so far. r9's 25-death dietest run
          // reported the SAME score as a flawless run, which made death free
          // wherever the run continues. Human play needs no haircut — the run
          // simply ends, which is the maximum penalty a score can carry — so
          // the cost lands exactly where the run does NOT end.
          const lost = Math.round(G.telemetryData.score * 0.20);
          G.telemetryData.score = Math.max(0, G.telemetryData.score - lost);
          G.telemetryData.scoreLostToDeaths += lost;
          player.hull = 100;
          player.shield = 50;
          G.post.whiteout = 1;
        }
      }
    }
  }

  function damageEnemy(en, amount, hitPos) {
    // r12 POSTHUMOUS-SCORING GUARD (2 of 5) — the mirror of damagePlayer's
    // guard six lines up, which is the asymmetry that caused the defect.
    // Reachable today only from checkHits (which already skips player bolts
    // while destroyed), so this is a second lock on the same door rather than
    // the primary gate. It exists because damageEnemy is where the three
    // scoreboard writes live (hitsRegistered, enemiesKilled, creditKill) and a
    // future caller should not have to know about the checkHits guard.
    if (G.state === 'destroyed') return;
    en.hp -= amount;
    G.telemetryData.hitsRegistered++;
    G.vfx.sparkBurst(hitPos, 0xffd080, 8);
    G.audio.hit();
    drawHp(en);
    if (en.hp <= 0) {
      en.alive = false;
      en.mesh.visible = false;
      G.telemetryData.enemiesKilled++;
      creditKill(en); // score: class points x system multiplier
      // r15: ~30% of kills get a line. The dice live in voice.js (Math.random,
      // never the seeded `rng` above — a voice line must not be able to move a
      // single AI decision) and the 12 s cooldown sits on top of the dice.
      if (G.audio && G.audio.say) G.audio.say('kill');
      if (G.noteSpike) G.noteSpike('explode');
      G.vfx.explode(en.pos, en.cls === 'gunship' ? 1.7 : 1.2);
      // gunships barely evade, raiders/interceptors keep the r8 0.65 odds —
      // same single rng() draw either way (determinism guard)
    } else if (!en.frozen && en.state !== 'evade' && rng() < (en.cls === 'gunship' ? 0.22 : 0.65)) {
      en.state = 'evade';
      en.stateT = 1.2 + rng() * 1.6;
      en.evadeDir.set(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize();
      G.telemetryData.enemyEvadeEvents++;
    }
  }

  // ================= hit registration =================
  const _seg = new THREE.Vector3(), _toC = new THREE.Vector3(), _close = new THREE.Vector3();
  function segmentSphere(p0, p1, center, radius) {
    _seg.copy(p1).sub(p0);
    const segLen2 = _seg.lengthSq();
    if (segLen2 < 1e-8) return p0.distanceToSquared(center) < radius * radius;
    _toC.copy(center).sub(p0);
    const t = THREE.MathUtils.clamp(_toC.dot(_seg) / segLen2, 0, 1);
    _close.copy(p0).addScaledVector(_seg, t);
    return _close.distanceToSquared(center) < radius * radius;
  }

  // ---------------------------------------------------------------------
  // r12 POSTHUMOUS SCORING — the decision, written down.
  //
  // DEFECT: main.js keeps ticking flight for the ~3.0s destruction tumble
  // (DESTRUCT_SECONDS, main.js), so player bolts already in the air when the
  // ship died kept resolving hits. damagePlayer had a destroyed-guard and
  // damageEnemy did not, so a dead pilot could still bank points and kills.
  // The GAME OVER panel reads T.score at the END of the tumble (main.js
  // 'destroyed' case), and ui.js writes that value to the localStorage high
  // score — so this was persisted user state corrupted by a dead pilot.
  //
  // DECISION — bolts already in flight DO NOT SCORE. The scoreboard freezes at
  // the instant of death; the panel reports what the pilot had earned when the
  // hull failed, and nothing else. The alternative (in-flight bolts still
  // count, because a living pilot fired them) is rejected because THE PILOT HAS
  // NO AGENCY DURING THE TUMBLE. main.js zeroes every input the moment the
  // state flips (pitch/yaw/roll/thrust/fire, main.js ~1020) and the autopilot
  // stands down (main.js:1029), so nothing the player does between death and
  // the panel can affect whether a bolt connects. Crediting those points scores
  // a coin flip on ordnance already in the air. Score should track agency.
  //
  // CORRECTION, r12 in-worktree critic, finding F1 — the rationale that was
  // written here first said the points were "unobservable, because the tumble
  // takes the HUD away". THAT IS FALSE and it was measured false against the
  // game's own DOM (artifacts/r12-bug/critic-hudread.json): `#ir-hudscore` is
  // `display: block` on 10 of 10 samples across the whole tumble, `uiState`
  // stays 'running' so ui.js's 150ms paintScoreHud poll keeps repainting it,
  // and on a guards-removed build the RENDERED readout ticks "100" -> "200" at
  // tumble frame 40. The HUD retires at the PANEL, not at death. The player
  // watches the posthumous points land in real time — which makes the defect
  // more visible, not less, and does not change the decision. Recorded rather
  // than silently edited so the next round inherits the correction and not the
  // original mistake.
  //
  // DECISION — bolts KEEP FLYING AND KEEP RENDERING. This is why the gate is
  // here and not on the `b.active = false` line: a guard inside damageEnemy
  // alone would leave checkHits deactivating the bolt on contact, so a dead
  // pilot's tracers would blink out at the enemy hull with no impact spark.
  // Skipping the collision test instead lets each bolt fly through and expire
  // on its own 2.2s life (vfx.js), with the normal end-of-life fizzle. Bolt
  // life 2.2s < tumble 3.0s, so every airborne bolt burns out inside the death
  // sequence and nothing is left hanging under the panel.
  //   MEASURED (tools/r12-bug-posthumous.mjs, Pole-B block, 5/5 seeds): across
  //   the 180 tumble frames the surviving player bolt keeps advancing
  //   33.33u per 3 frames = 11.111u/frame, which is its own |vel| 666.65.
  //   That is BOLT_SPEED 620 plus the player's MUZZLE speed 46.65u/s —
  //   playerFire adds player.vel, and the two are collinear (dot 1.000000) so
  //   it is a plain scalar sum. (CORRECTION, critic CMT-2: this comment first
  //   said 52.33u/s, which is the player's speed six frames LATER, where the
  //   probe samples it. 620 + 52.33 = 672.33, not 666.65 — the arithmetic did
  //   not close and the error was the timestamp of the velocity term.)
  //   It passes THROUGH the target rather than being consumed: closest
  //   approach 10.7u, then 17.4u on the next FRAME (the 1169.7u this comment
  //   first quoted is the same event sampled on the test's 3-frame cadence —
  //   critic CMT-3). On the same scenario with the guards stripped the bolt IS
  //   consumed at the target, so the assertion discriminates rather than
  //   passing vacuously.
  //
  // WHY THE TEST IS PER-BOLT AND NOT AT FUNCTION ENTRY: the player can die
  // partway through this very loop. An enemy bolt at a lower pool index can
  // land the killing hit on the player, and a player bolt at a higher index
  // then resolves against an enemy in the SAME pass, with G.state already
  // 'destroyed'. A single check at the top of checkHits() reads the state from
  // before that death and lets the later bolt score.
  //   MEASURED: path P6 of the regression test constructs exactly that pool
  //   ordering and it scores 100 points on the unguarded build.
  //
  // FIVE GUARDS, not one: this one (primary, and the only one that also gets
  // the visuals right), damageEnemy (the kill/hit chokepoint), creditKill
  // (every KILL award), endWave (the wave-clear bonus) and playerFire (no new
  // ordnance from a wreck). Enumerated with a measurement each in
  // reports/r12-bug/REPORT.md and independently in reports/r12-bug/CRITIC.md.
  //
  // NOT guarded, deliberately: F.addScore(), the overlay-check injection hook.
  // It is a test instrument that exists to put a known constant on the HUD and
  // has no gameplay caller (grep: tools/overlay-check.mjs only).
  //
  // The soft-respawn path is UNAFFECTED, because it never enters this state:
  // under any harness param damagePlayer respawns instead of calling
  // beginDestruction, so G.state stays 'combat'/'red-alert' and the 20% score
  // haircut is taken from a base no posthumous kill can reach. Verified by
  // measurement, not by reading: see REPORT.md "the harness path".
  // ---------------------------------------------------------------------
  function checkHits() {
    for (const b of G.vfx.bolts) {
      if (!b.active) continue;
      if (b.owner === 'player') {
        if (G.state === 'destroyed') continue; // r12 GUARD (1 of 5) — see above
        for (const en of enemies) {
          if (!en.alive || en.frozen) continue; // frozen = posed for a capture; hp stays as posed
          if (segmentSphere(b.prev, b.pos, en.pos, en.hitR || 14)) {
            b.active = false;
            damageEnemy(en, 34, b.pos);
            break;
          }
        }
      } else if (b.owner === 'enemy') {
        if (segmentSphere(b.prev, b.pos, player.pos, b.hitRadius || 5)) {
          b.active = false;
          // per-class damage AND class tagged on the bolt at fire time; the
          // fallback matches the raider column of the difficulty-curve table
          const hcs = cstat(b.cls || 'raider');
          hcs.hitsOnPlayer++;
          hcs.observed.hitRateOnPlayer = hcs.shotsFired
            ? Math.round((hcs.hitsOnPlayer / hcs.shotsFired) * 1000) / 1000 : 0;
          if (wave.statEntry && wave.statEntry.clearedInS === null) wave.statEntry.enemyHitsInWave++;
          damagePlayer(b.dmg !== undefined ? b.dmg : curve.dmg(G.systemIndex));
        }
      }
    }
  }

  // ================= enemy AI =================
  const _desired = new THREE.Vector3(), _lookM = new THREE.Matrix4(), _lookQ = new THREE.Quaternion();
  const _strafe = new THREE.Vector3(), _strafeUp = new THREE.Vector3();
  const _predict = new THREE.Vector3(), _station = new THREE.Vector3();
  // r11: position at the top of the integration step, so observed.maxSpeed can
  // be a real displacement/dt across every write to en.pos (module-scope reuse
  // — no per-frame allocation)
  const _p0 = new THREE.Vector3();

  const _frozenAim = new THREE.Vector3();

  function updateEnemy(en, dt) {
    // close-range halo fade (applies to frozen poses too): under ~150u the
    // additive halo drops to a whisper so the hull silhouette survives;
    // by ~400u it's back to full beacon strength.
    en.haloMat.opacity = THREE.MathUtils.clamp(
      (en.pos.distanceTo(player.pos) - 140) / 260, 0.25, 1);
    if (en.frozen) {
      // posed for a moment capture: hold position, keep firing on a timer.
      // scriptAimOffset skews the beam off the camera axis so it reads as a
      // raking beam instead of a foreshortened dot / lens-filling ribbon.
      en.scriptFire -= dt;
      if (en.scriptFire <= 0) {
        en.scriptFire = 0.38 + rng() * 0.15;
        _frozenAim.copy(player.pos);
        if (en.scriptAimOffset) _frozenAim.add(en.scriptAimOffset);
        enemyFire(en, _frozenAim, false);
      }
      return;
    }
    en.stateT -= dt;
    en.orbitT += dt;

    const distToPlayer = en.pos.distanceTo(player.pos);
    // per-class steady-state speed target set at spawn (raider == r8 formula).
    // NOT a cap: the enforced ceiling is en.speedLimit, clamped after the
    // velocity integration below.
    const nominal = en.nominalSpeed || (85 + G.systemIndex * 14 + wave.num * 5);
    const stat = cstat(en.cls || 'raider');

    // ---- gunship siege burn: the heavy's answer to a 150u/s player ----
    // A lunge with a duty cycle, not a cruise speed. Fires when the range
    // opens past BURN.range, runs BURN.duration, then sits out BURN.cooldown.
    // While burning the ship may use its full speedLimit (1.6x nominal);
    // otherwise it steers at nominal like everything else.
    if (en.engage === 'intercept') {
      en.burnT -= dt;
      if (en.burning) {
        if (en.burnT <= 0) { en.burning = false; en.burnT = BURN.cooldown; }
      } else if (en.burnT <= 0 && distToPlayer > BURN.range) {
        en.burning = true;
        en.burnT = BURN.duration;
        stat.observed.burnEvents++;
      }
    }
    const maxSpeed = en.burning ? en.speedLimit : nominal;

    if (en.state === 'evade') {
      if (en.stateT <= 0) { en.state = 'pursuit'; en.stateT = 0; }
      _desired.copy(en.evadeDir).multiplyScalar(maxSpeed * 1.25);
      // corkscrew jink
      _tmp.set(0, 0, -1).applyQuaternion(en.quat).cross(en.evadeDir).normalize();
      _desired.addScaledVector(_tmp, Math.sin(en.orbitT * 9) * maxSpeed * 0.7);
    } else if (en.engage === 'intercept') {
      // ---- gunship: standoff INTERCEPT, not tail-chase ----
      // Aim at where the player will be after the time it takes this hull to
      // cover the current gap, then hold station GUNSHIP_STANDOFF off that
      // point. A tail-chaser at 78u/s can never touch a 150u/s cruise; a ship
      // cutting to the player's future position only has to beat the corner.
      if (en.orbitT > 3) {
        en.orbitT = 0;
        en.orbitOffset.set(rng() - 0.5, (rng() - 0.5) * 0.6, rng() - 0.5).normalize().multiplyScalar(110 + rng() * 190);
      }
      const tLead = THREE.MathUtils.clamp(distToPlayer / Math.max(40, maxSpeed), 0, 6);
      _predict.copy(player.pos).addScaledVector(player.vel, tLead);
      _station.copy(en.orbitOffset).normalize().multiplyScalar(GUNSHIP_STANDOFF).add(_predict);
      _desired.copy(_station).sub(en.pos);
      const d = _desired.length();
      // never coasts: a heavy that idles at station is the r9 turret again
      _desired.normalize().multiplyScalar(Math.min(maxSpeed, Math.max(maxSpeed * 0.45, d * 0.8)));
      if (distToPlayer < 90) {
        // wallow out — the brute is too slow to dodge a collision late
        _desired.copy(en.pos).sub(player.pos).normalize().multiplyScalar(maxSpeed);
      }
    } else {
      // pursuit: chase a drifting offset point near the player
      if (en.orbitT > 3) {
        en.orbitT = 0;
        en.orbitOffset.set(rng() - 0.5, (rng() - 0.5) * 0.6, rng() - 0.5).normalize().multiplyScalar(110 + rng() * 190);
      }
      _tmp.copy(player.pos).add(en.orbitOffset);
      _desired.copy(_tmp).sub(en.pos);
      const d = _desired.length();
      _desired.normalize().multiplyScalar(Math.min(maxSpeed, d * 0.6));
      // interceptor signature: hard lateral strafing weave across the
      // pursuit line (the 'strafe' engagement model gates the branch)
      if (en.engage === 'strafe') {
        _strafe.copy(_desired).normalize().cross(_strafeUp.set(0, 1, 0));
        if (_strafe.lengthSq() > 0.01) {
          _desired.addScaledVector(_strafe.normalize(), Math.sin(en.orbitT * 5) * maxSpeed * 0.7);
        }
      }
      if (distToPlayer < 55) {
        // break away — don't ram the cockpit
        _desired.copy(en.pos).sub(player.pos).normalize().multiplyScalar(maxSpeed);
      }
    }

    // steer velocity toward desired — turn authority scales with class
    // agility (raider 1.0 => the r8 1.6 rate; gunship ponderous, interceptor snappy)
    en.vel.lerp(_desired, Math.min(1, dt * 1.6 * (en.agility || 1)));
    // ---- the speed limit is now an actual limit ----
    // r9 stacked evade (x1.25) and the interceptor strafe (+0.7 * maxSpeed on
    // a vector already at maxSpeed) on top of a number it called speedCap,
    // then reported that number as a cap while every class blew through it by
    // up to a quarter. The ceiling is enforced here, once, after every
    // manoeuvre has had its say — so observed.maxSpeed can never exceed
    // configured.speedLimit and the field means what it says.
    const limit = en.speedLimit || nominal * 1.3;
    const ob = stat.observed;
    {
      // measured ONE LINE BEFORE the clamp: this is the same detector that
      // guards the post-clamp state, so a reading > 1.0 here is the proof that
      // it fires on real over-speed rather than being unfalsifiable by
      // construction.
      const sp = en.vel.length();
      const r = Math.round((sp / limit) * 1000) / 1000;
      if (r > ob.maxOverLimitRatioPreClamp) ob.maxOverLimitRatioPreClamp = r;
      if (sp > limit) { ob.clampEngagements++; en.vel.multiplyScalar(limit / sp); }
    }
    // per-ship post-clamp check, against THIS ship's own limit — not a run-wide
    // maximum across ships that were never subject to it.
    {
      const sp = en.vel.length();
      if (sp > ob.maxVelMagnitude) ob.maxVelMagnitude = Math.round(sp * 10) / 10;
      const r = Math.round((sp / limit) * 1000) / 1000;
      if (r > ob.maxOverLimitRatio) ob.maxOverLimitRatio = r;
      if (sp > limit + 1e-4) ob.overLimitFrames++;
    }
    _p0.copy(en.pos);
    en.pos.addScaledVector(en.vel, dt);

    // stay above terrain in planet mode
    if (G.mode === 'planet') {
      const ground = G.planet.heightAt(en.pos.x, en.pos.z);
      if (en.pos.y < ground + 40) {
        en.pos.y = ground + 40;
        if (en.vel.y < 0) en.vel.y *= -0.4;
        ob.terrainLiftFrames++;
      }
    }
    // TRUE observed speed — displacement over the step across EVERY write to
    // en.pos, not the length of the velocity vector the clamp just guaranteed.
    // The ground-clearance correction above teleports; if it ever moves a ship
    // faster than its limit, this field says so and maxVelMagnitude does not.
    if (dt > 0) {
      const sp = _p0.distanceTo(en.pos) / dt;
      if (sp > ob.maxSpeed) ob.maxSpeed = Math.round(sp * 10) / 10;
    }

    // face along velocity
    if (en.vel.lengthSq() > 1) {
      _lookM.lookAt(en.pos, _tmp.copy(en.pos).add(en.vel), _tmp2.set(0, 1, 0));
      _lookQ.setFromRotationMatrix(_lookM);
      en.quat.slerp(_lookQ, Math.min(1, dt * 3.5));
    }

    // firing: only when facing the player within the class's arc, in range,
    // in pursuit. r10 — arc and range are per class. The darts keep r9's
    // fixed forward cannons (44 deg / 750u); the gunship's mounts are
    // TURRETED (69 deg / 1400u), which is what makes a slow hull a threat
    // without giving it dart speed.
    en.fireT -= dt;
    if (en.state === 'pursuit' && en.fireT <= 0 && distToPlayer < (en.fireRange || 750) && distToPlayer > 40) {
      _fwd.set(0, 0, -1).applyQuaternion(en.quat);
      _tmp.copy(player.pos).sub(en.pos).normalize();
      if (_fwd.dot(_tmp) > (en.fireArcCos !== undefined ? en.fireArcCos : 0.72)) {
        const lead = player.vel.lengthSq() > 25;
        enemyFire(en, player.pos, lead);
        // class cadence: interceptor sprays, gunship thuds (raider == r8)
        en.fireT = (0.4 + rng() * (0.9 - Math.min(0.5, G.systemIndex * 0.15))) / (en.fireRateMul || 1);
      } else {
        en.fireT = 0.15;
      }
    }

    // hp label faces player automatically (sprite); hide when far
    en.hpSprite.visible = distToPlayer < 900;
  }

  // ================= player physics =================
  const _rotQ = new THREE.Quaternion(), _axis = new THREE.Vector3();

  let brakeTurnLatch = false;

  function updatePlayer(dt) {
    const inp = G.input;
    const braking = inp.brake;
    const turnMult = braking ? 1.85 : 1.0; // brake-turn: tighter turn rate
    const PITCH = 1.35 * turnMult, YAW = 0.95 * turnMult, ROLL = 2.1;

    // maneuver telemetry
    if (inp.boost) G.telemetryData.boostSeconds += dt;
    const turning = Math.abs(inp.pitch) + Math.abs(inp.yaw) > 0.5;
    if (braking && turning) {
      if (!brakeTurnLatch) { brakeTurnLatch = true; G.telemetryData.brakeTurns++; }
    } else if (!braking) {
      brakeTurnLatch = false;
    }

    _axis.set(1, 0, 0);
    _rotQ.setFromAxisAngle(_axis, inp.pitch * PITCH * dt);
    player.quat.multiply(_rotQ);
    _axis.set(0, 1, 0);
    _rotQ.setFromAxisAngle(_axis, inp.yaw * YAW * dt);
    player.quat.multiply(_rotQ);
    _axis.set(0, 0, 1);
    _rotQ.setFromAxisAngle(_axis, inp.roll * ROLL * dt);
    player.quat.multiply(_rotQ);
    player.quat.normalize();

    _fwd.set(0, 0, -1).applyQuaternion(player.quat);
    const maxV = inp.boost ? MAXV.boost : MAXV.cruise;
    const targetSpeed = inp.thrust * maxV * (braking ? 0.35 : 1);
    // ship-style flight: velocity chases forward*targetSpeed
    _tmp.copy(_fwd).multiplyScalar(targetSpeed);
    const accel = inp.boost ? 2.6 : 1.7;
    player.vel.lerp(_tmp, Math.min(1, dt * accel));
    _prevPos.copy(player.pos);           // r14: sweep origin for the belt test
    player.pos.addScaledVector(player.vel, dt);
    player.speed = player.vel.length() * (player.vel.dot(_fwd) < 0 ? -1 : 1);

    // asteroid collision (space mode). Swept against the belt — see the
    // corrected note at asteroidSweptHit in space.js for what that does and
    // does NOT currently buy (it is not preventing a measured tunnel).
    collideAsteroids();
    // re-read speed AFTER any deflection so the HUD shows the bounce rather
    // than the velocity the ship had a frame before it hit something. The
    // impact EVENT records the pre-bounce speed, which is the impact speed.
    player.speed = player.vel.length() * (player.vel.dot(_fwd) < 0 ? -1 : 1);

    // terrain collision / altitude
    if (G.mode === 'planet') {
      const ground = G.planet.heightAt(player.pos.x, player.pos.z);
      player.altitude = player.pos.y - ground;
      if (player.altitude < 6) {
        player.pos.y = ground + 6;
        if (player.vel.y < 0) player.vel.y = Math.abs(player.vel.y) * 0.3;
        player.altitude = 6;
      }
      if (player.pos.y > 5200) player.pos.y = 5200; // planet-mode ceiling
    } else {
      player.altitude = 0;
    }

    // heat cooldown
    if (G.time - lastFireT > 0.35) {
      player.heat = Math.max(0, player.heat - dt * 0.28);
      if (player.overheated && player.heat <= 0.35) player.overheated = false;
    }
    fireCooldown -= dt;

    // shield regen after 5s without damage
    if (player.shield < 100 && G.time - player.lastDamageT > 5) {
      player.shield = Math.min(100, player.shield + dt * 14);
    }

    // engine trail particles when boosting
    if (inp.boost && Math.random() < 0.5) {
      _tmp.copy(player.pos).addScaledVector(_fwd, -8)
        .addScaledVector(_tmp2.set(0, 1, 0).applyQuaternion(player.quat), -1);
      G.vfx.spawnParticle(_tmp, _tmp2.set((rng() - 0.5) * 6, (rng() - 0.5) * 6, (rng() - 0.5) * 6), 0x60c0ff, 0.5, 1);
    }
  }

  // ================= warp camera jitter =================
  // r6 moment-1 verdict: "frame perfectly centred — warp should jitter".
  // During warp the pilot's head is being shaken by the drive: low-frequency
  // drift (the head being pushed around, ~1 deg) + a fine high-frequency
  // tremor (~0.25 deg). Composed ONTO whatever camOffset the pose set (m1's
  // cant survives; session warp starts from identity) and restored exactly
  // at warp exit. Driven by G.time -> deterministic under ?fixedstep=1.
  // Deliberately small: the failure modes are a tripod frame AND seasick.
  const warpBase = new THREE.Quaternion();
  let warpJitterOn = false;
  const _jitE = new THREE.Euler(), _jitQ = new THREE.Quaternion();
  function updateWarpJitter() {
    const warping = G.state === 'warp';
    if (warping && !warpJitterOn) { warpJitterOn = true; warpBase.copy(G.camOffset); }
    if (!warping) {
      if (warpJitterOn) { warpJitterOn = false; G.camOffset.copy(warpBase); }
      return;
    }
    const t = G.time;
    _jitE.set(
      0.014 * Math.sin(t * 1.9 + 0.9) + 0.0038 * Math.sin(t * 23.7 + 2.0),
      0.017 * Math.sin(t * 1.3 + 4.2) + 0.0033 * Math.cos(t * 27.1),
      0.021 * Math.sin(t * 1.7 + 1.3) + 0.0046 * Math.sin(t * 19.3 + 0.7)
    );
    G.camOffset.copy(warpBase).multiply(_jitQ.setFromEuler(_jitE));
  }

  // ================= posed player fire (moment captures) =================
  // fires real bolts from the real muzzles so combat poses show the player
  // shooting; bypasses heat/cooldown/telemetry — it's a pose, not gameplay
  let posedFireT = 0.1;
  let poseDustT = 0;
  function scriptedPlayerFire(targetPos) {
    muzzleSide = -muzzleSide;
    _fwd.set(0, 0, -1).applyQuaternion(player.quat);
    _muzzle.copy(player.pos)
      .addScaledVector(_tmp.set(1, 0, 0).applyQuaternion(player.quat), muzzleSide * 5.0)
      .addScaledVector(_tmp.set(0, 1, 0).applyQuaternion(player.quat), -2.2)
      .addScaledVector(_fwd, 3);
    const dir = _tmp2.copy(targetPos).sub(_muzzle).normalize();
    dir.x += (rng() - 0.5) * 0.02;
    dir.y += (rng() - 0.5) * 0.02;
    dir.normalize();
    G.vfx.fireBolt(_muzzle, _tmp.copy(dir).multiplyScalar(BOLT_SPEED), 0xffc860, 'player', 1.8);
  }

  // ================= public =================
  const F = {
    enemies,
    wave,
    // r11: the class multiplier table, reachable from the harness. Two uses,
    // both about honesty rather than convenience: an instrument can READ the
    // multipliers it is reasoning about instead of hardcoding a copy that goes
    // stale (that is how DECISIONS-gameplay.md came to describe a gunship the
    // game did not have), and tools/class-arena.mjs can run a BEFORE column by
    // restoring a previous round's tuning IN PROCESS, so before and after are
    // measured by one build of one instrument. Live objects, so writes bite —
    // only the arena's --tuning path writes, and it says so in its output.
    classes: ENEMY_CLASSES,
    playerFire,
    spawnEnemy,
    startWave,
    damagePlayer,
    creditKill,
    addScore: (n) => { G.telemetryData.score += Math.round(n); }, // test hook (overlay-check)
    // r15 cannon upgrade, reachable from the harness so tools/r15-heat-probe.mjs
    // can MEASURE time-to-overheat per mark instead of recomputing the formula
    // in the instrument and calling that a measurement.
    grantCannonUpgrade,
    cannonHeat: { HEAT_PER_SHOT, HEAT_CAP_MAX },
    refreshHp: drawHp,
    aliveCount,
    // PROJECTION of the difficulty ramp for telemetry — the same single
    // `curve` the live sim uses, evaluated at a STATED reference wave. r9
    // called this "difficultyCurve" and left the evaluation point implicit,
    // so its rows disagreed with the executed encounters and two things wore
    // one name. Rows carry atWave; the executed values live in waveStats.
    difficultyProjection: (n = 5, atWave = 1) => {
      const rows = [];
      for (let s = 0; s < n; s++) {
        const mix = {};
        for (const c of waveComposition(s, 2, Math.min(MAX_ENEMIES, 4 + Math.floor(s * 0.5)))) mix[c] = (mix[c] || 0) + 1;
        rows.push({
          system: s + 1,
          atWave,
          // r11: `aimAccuracy` DELETED, not renamed. It was 1 - aimErr — the
          // arithmetic complement of a per-axis uniform dispersion half-width
          // on a normalised direction vector. That complement is not an
          // accuracy, not a probability and not a rate: it reported 0.92 for a
          // session that measured 4 hits from 35 enemy shots (11.4%). No
          // rename could make it true, because the number it held is not a
          // property anything in the game has. A MEASURED accuracy now lives
          // where it can be measured: enemyClassStats[cls].observed
          // .hitRateOnPlayer (hitsOnPlayer / shotsFired), and per wave in
          // waveStats[].enemyShotsInWave / enemyHitsInWave.
          //
          // aimErr survives under its own name because it IS the dispersion
          // half-width, which is exactly what it is called.
          // r11 sweep: these four are all PRE-class-multiplier values sitting
          // directly beside wave2ClassMix — the identical defect that got
          // waveStats[].enemyFireRate renamed, and the executed rows in
          // waveStats already used the `...Base` suffix while these did not.
          // r10's own rule is that a field needing a footnote to be true has
          // the wrong name, and difficultyFormulas was that footnote.
          aimErrBase: Math.round(curve.aimErr(s, atWave) * 1000) / 1000,
          dmgPerBoltBase: curve.dmg(s),
          enemyHpBase: curve.hp(s, atWave),
          enemyNominalSpeedBase: curve.speed(s, atWave),
          wave2ClassMix: mix,
        });
      }
      return rows;
    },
    // the formulas themselves, so a reader can check a projected row against
    // an executed one without opening this file
    difficultyFormulas: {
      enemyHp: '80 + system0*50 + wave*20, x class hp multiplier',
      enemyNominalSpeed: '85 + system0*14 + wave*5, x class speed multiplier',
      enemySpeedLimit: 'enemyNominalSpeed x class burst multiplier (ENFORCED)',
      dmgPerBolt: '7 + system0*3, x class dmg multiplier',
      aimErr: 'max(0.012, 0.08 - system0*0.022 - (wave-1)*0.004), x class aim multiplier',
      enemyRefireHz: '1 / (0.4 + 0.5*(0.9 - min(0.5, system0*0.15))), x class fireRate multiplier — a per-ship cadence CEILING; the firing-arc and range gate throttle it further, so it is not a shot rate',
      note: 'system0 is 0-based; telemetry `system` fields are 1-based',
      aimErrModel: 'aimErr is a per-axis uniform perturbation of half-width aimErr applied to a normalised aim direction, then renormalised. It is a DISPERSION parameter. It is not an accuracy and 1-aimErr is not a hit rate. Measured accuracy: enemyClassStats[cls].observed.hitRateOnPlayer, and waveStats[].enemyHitsInWave / enemyShotsInWave.',
    },
    waveCleared: () => wave.active && wave.toSpawn === 0 && aliveCount() === 0,
    endWave: () => {
      // r12 POSTHUMOUS-SCORING GUARD (4 of 5) — the wave-clear bonus is the
      // SECOND way a dead pilot's bolt reaches the scoreboard (200 x system
      // multiplier, plus a wavesCleared increment the panel displays), and it
      // is a different code path from creditKill.
      // MEASURED: today it is already unreachable during the tumble, because
      // main.js's state machine switches on G.state and its 'destroyed' case
      // never calls handleWaveEnd, while the autopilot that also calls
      // endWave() stands down at main.js:1029. So this guard changes no
      // reachable behaviour on THIS build — it is here so that the closure
      // does not depend on a file this worker does not own. Path P3 of
      // tools/r12-bug-posthumous.mjs asserts both halves: that the state
      // machine does not reach it, AND that a direct call cannot pay out.
      if (G.state === 'destroyed') return;
      wave.active = false;
      if (wave.statEntry && wave.statEntry.clearedInS === null) {
        wave.statEntry.clearedInS = Math.round((G.time - wave.startT) * 10) / 10;
        wave.statEntry.playerShieldLost = Math.round(wave.statEntry.playerShieldLost);
        // wave-clear bonus, scaled by system (score = kills + these bonuses)
        const bonus = Math.round(200 * (1 + G.systemIndex * 0.5));
        G.telemetryData.score += bonus;
        G.telemetryData.waveBonusTotal += bonus;
        G.telemetryData.wavesCleared++;
        // r15: the wave clear is what pays for the cannon upgrade.
        const upgraded = grantCannonUpgrade();
        // VOICE, and it is deliberately ONE LINE, not two. Jason's rule:
        // "wave-cleared line OR upgrade line, upgrade wins on the waves where
        // an upgrade lands". A wave clear in space already fires warp-charge
        // within the same second and arrival ~10s later, so this moment is the
        // most crowded in the game — a second line here is where nattering
        // would start. CONSEQUENCE, stated rather than buried: in a space run
        // every clear grants an upgrade until MK IV, so "wave-cleared" is not
        // heard until the fifth clear (or any clear at the ceiling). That is
        // the cost of the rule and it is Jason's call to keep or change.
        if (G.audio && G.audio.say) G.audio.say(upgraded ? 'cannon-upgrade' : 'wave-cleared');
      }
    },
    clearEnemies() {
      for (const en of enemies) { en.alive = false; en.mesh.visible = false; }
      wave.active = false;
      wave.toSpawn = 0;
    },
    update(dt) {
      updateWarpJitter();
      if (G.momentMode) {
        // posed capture: physics frozen, but posed enemies keep firing and
        // bolts keep registering so the frame shows live combat
        for (const en of enemies) if (en.alive) updateEnemy(en, dt);
        // keep player bolts airborne in combat poses (m4/m5)
        if (G.state === 'combat' || G.state === 'red-alert') {
          posedFireT -= dt;
          if (posedFireT <= 0) {
            posedFireT = 0.26;
            let tgt = null, bd = Infinity;
            for (const en of enemies) {
              if (!en.alive) continue;
              const d = en.pos.distanceToSquared(player.pos);
              if (d < bd) { bd = d; tgt = en; }
            }
            if (tgt) scriptedPlayerFire(tgt.pos);
          }
        }
        // posed velocity cue (m4, planet combat pose only): near-field dust
        // streaking past the canopy. r5 verdict: "no sense of banked motion —
        // the tilted horizon does all the work". A frozen pose has no motion
        // blur, so a sparse stream of fast, dim, foreshortened tracers
        // carries the ~176u/s read. Deliberately few and faint (the opposite
        // failure is anime speed lines): dim warm-grey colour keeps the
        // sheath at a whisper and the spawn ring keeps them off the frame
        // centre. Owner 'dust' touches no counters, no hit registration, no
        // mirror-twin, no muzzle pop.
        if (G.mode === 'planet' && G.state === 'combat') {
          poseDustT -= dt;
          if (poseDustT <= 0) {
            poseDustT = 0.045; // r7: a touch denser — the banked-motion cue was whispering below the read threshold
            const a = rng() * Math.PI * 2;
            const r = 7 + rng() * 12;
            // ring centre biased down-right (player-local ≈ screen space in
            // the pose): the banked frame's terrain side, where an additive
            // streak has dark ground to read against — over the bright sky
            // half a faint additive line simply disappears (first r6 try).
            // Spawn 25-85u ahead: enough runway that ~5 motes are mid-pass at
            // any settle count (the first z<50 band held only 1-2 on screen)
            _tmp.set(Math.cos(a) * r + 4, Math.sin(a) * r * 0.7 - 2, -25 - rng() * 60)
              .applyQuaternion(player.quat).add(player.pos);
            // dust is static in-world; the implied forward speed streams it
            // BACKWARD past the cockpit, with a little outward divergence.
            // Pale sun-catch tan: reads on terrain, whispers on sky; the far
            // spawns lead with a small hot mote (NMS's own speed specks)
            _tmp2.set(Math.cos(a) * 9, Math.sin(a) * 6, 150 + rng() * 65)
              .applyQuaternion(player.quat);
            G.vfx.fireBolt(_tmp, _tmp2, 0xe8d8ba, 'dust', 0.46);
          }
        }
        checkHits();
        updateTarget();
        return;
      }
      updatePlayer(dt);
      // staged spawning
      if (wave.active && wave.toSpawn > 0) {
        wave.spawnT -= dt;
        if (wave.spawnT <= 0) {
          wave.spawnT = 0.5;
          _tmp.set(rng() - 0.5, (rng() - 0.4) * 0.7, -(0.5 + rng() * 0.5)).normalize()
            .applyQuaternion(player.quat).multiplyScalar(450 + rng() * 250)
            .add(player.pos);
          if (G.mode === 'planet') {
            const g = G.planet.heightAt(_tmp.x, _tmp.z);
            _tmp.y = Math.max(_tmp.y, g + 120 + rng() * 200);
          }
          spawnEnemy(_tmp, G.systemIndex, wave.num, wave.comp[wave.spawnIdx++] || 'raider');
          wave.toSpawn--;
        }
      }
      for (const en of enemies) if (en.alive) updateEnemy(en, dt);
      checkHits();
      updateTarget();
      if (G.input.fire) playerFire(G.autopilot ? G.autopilot.aimDir : null);
    },
  };
  G.flight = F;
  return F;
}
