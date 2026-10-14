import * as THREE from "three";

// Low-poly material helper. We DON'T use material.flatShading because the
// WebGPU build's WebGL2 fallback backend generates an invalid shader for it
// (derivatives in the vertex stage). Instead we bake per-face normals into the
// geometry via facet(), which yields the same faceted look on both backends.
function mat(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05 });
}

// Convert a geometry to a faceted (flat-shaded) one: non-indexed geometry where
// each triangle gets its own vertices means computeVertexNormals() produces a
// single normal per face -> hard low-poly edges.
export function facet(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.computeVertexNormals();
  return g;
}
const Box = (...a) => facet(new THREE.BoxGeometry(...a));
const Cone = (...a) => facet(new THREE.ConeGeometry(...a));
const Cyl = (...a) => facet(new THREE.CylinderGeometry(...a));
const Ico = (...a) => facet(new THREE.IcosahedronGeometry(...a));

// Builds a rigged low-poly humanoid. The "rig" is a hierarchy of named
// limb groups (pelvis -> torso -> head/arms, pelvis -> legs). Each named node
// is animated by AnimationMixer via the clips returned from buildClips().
export function buildCharacter(palette = {}) {
  const c = {
    skin: palette.skin ?? 0xd8a070,
    cloth: palette.cloth ?? 0x3a6ea5,
    cloth2: palette.cloth2 ?? 0x274b73,
    accent: palette.accent ?? 0xffcf5f,
  };

  const root = new THREE.Group();
  root.name = "root";

  const pelvis = new THREE.Group(); pelvis.name = "pelvis"; pelvis.position.y = 0.9;
  root.add(pelvis);

  // Torso
  const torso = new THREE.Group(); torso.name = "torso";
  const torsoMesh = new THREE.Mesh(Box(0.7, 0.8, 0.4), mat(c.cloth));
  torsoMesh.position.y = 0.4; torsoMesh.castShadow = true;
  torso.add(torsoMesh);
  pelvis.add(torso);

  // Head
  const head = new THREE.Group(); head.name = "head"; head.position.y = 0.95;
  const headMesh = new THREE.Mesh(Box(0.42, 0.42, 0.42), mat(c.skin));
  headMesh.castShadow = true;
  const nose = new THREE.Mesh(Cone(0.07, 0.16, 4), mat(c.skin));
  nose.rotation.x = Math.PI / 2; nose.position.set(0, 0, 0.24);
  const crest = new THREE.Mesh(Cone(0.16, 0.3, 4), mat(c.accent));
  crest.position.y = 0.34;
  head.add(headMesh, nose, crest);
  torso.add(head);

  // Arms (shoulder pivots so rotation looks like a real joint)
  function arm(side) {
    const shoulder = new THREE.Group();
    shoulder.name = side > 0 ? "armR" : "armL";
    shoulder.position.set(side * 0.45, 0.7, 0);
    const upper = new THREE.Mesh(Box(0.22, 0.5, 0.22), mat(c.cloth2));
    upper.position.y = -0.25; upper.castShadow = true;
    const hand = new THREE.Mesh(Box(0.2, 0.2, 0.2), mat(c.skin));
    hand.position.y = -0.55;
    shoulder.add(upper, hand);
    return shoulder;
  }
  const armL = arm(-1), armR = arm(1);
  torso.add(armL, armR);

  // Staff in right hand (weapon for attack/cast visuals)
  const staff = new THREE.Group(); staff.name = "staff"; staff.position.y = -0.55;
  const shaft = new THREE.Mesh(Cyl(0.04, 0.04, 1.1, 5), mat(0x6b4a2b));
  shaft.position.y = 0.2;
  const orb = new THREE.Mesh(Ico(0.13, 0), mat(c.accent));
  orb.position.y = 0.78; orb.name = "orb";
  staff.add(shaft, orb);
  armR.add(staff);

  // Legs (hip pivots)
  function leg(side) {
    const hip = new THREE.Group();
    hip.name = side > 0 ? "legR" : "legL";
    hip.position.set(side * 0.2, 0, 0);
    const thigh = new THREE.Mesh(Box(0.24, 0.55, 0.26), mat(c.cloth2));
    thigh.position.y = -0.28; thigh.castShadow = true;
    const foot = new THREE.Mesh(Box(0.24, 0.16, 0.4), mat(0x222a36));
    foot.position.set(0, -0.6, 0.06);
    hip.add(thigh, foot);
    return hip;
  }
  const legL = leg(-1), legR = leg(1);
  pelvis.add(legL, legR);

  root.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });

  return { root, parts: { pelvis, torso, head, armL, armR, legL, legR, staff, orb } };
}

const PI = Math.PI;
// Quaternion track helper from euler keyframes (x-axis rotation = limb swing)
function qTrack(node, times, eulers) {
  const values = [];
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (const [x, y, z] of eulers) {
    e.set(x, y, z);
    q.setFromEuler(e);
    values.push(q.x, q.y, q.z, q.w);
  }
  return new THREE.QuaternionKeyframeTrack(`${node}.quaternion`, times, values);
}
function posTrack(node, times, ys) {
  const values = [];
  for (const y of ys) values.push(0, y, 0);
  return new THREE.VectorKeyframeTrack(`${node}.position`, times, values);
}

// Procedural animation clips bound by name to the rig nodes.
export function buildClips() {
  const clips = {};

  // IDLE — gentle breathing
  clips.idle = new THREE.AnimationClip("idle", 2, [
    posTrack("pelvis", [0, 1, 2], [0.9, 0.94, 0.9]),
    qTrack("armL", [0, 1, 2], [[0, 0, 0.12], [0, 0, 0.18], [0, 0, 0.12]]),
    qTrack("armR", [0, 1, 2], [[0, 0, -0.12], [0, 0, -0.18], [0, 0, -0.12]]),
    qTrack("head", [0, 1, 2], [[0, -0.1, 0], [0, 0.1, 0], [0, -0.1, 0]]),
  ]);

  // RUN — alternating legs/arms
  const t = [0, 0.25, 0.5, 0.75, 1];
  clips.run = new THREE.AnimationClip("run", 1, [
    posTrack("pelvis", t, [0.9, 0.98, 0.9, 0.98, 0.9]),
    qTrack("legL", t, [[0.9, 0, 0], [0, 0, 0], [-0.9, 0, 0], [0, 0, 0], [0.9, 0, 0]]),
    qTrack("legR", t, [[-0.9, 0, 0], [0, 0, 0], [0.9, 0, 0], [0, 0, 0], [-0.9, 0, 0]]),
    qTrack("armL", t, [[-0.7, 0, 0.1], [0, 0, 0.1], [0.7, 0, 0.1], [0, 0, 0.1], [-0.7, 0, 0.1]]),
    qTrack("armR", t, [[0.7, 0, -0.1], [0, 0, -0.1], [-0.7, 0, -0.1], [0, 0, -0.1], [0.7, 0, -0.1]]),
    qTrack("torso", t, [[0, 0.12, 0], [0, 0, 0], [0, -0.12, 0], [0, 0, 0], [0, 0.12, 0]]),
  ]);

  // ATTACK — overhead staff swing
  clips.attack = new THREE.AnimationClip("attack", 0.5, [
    qTrack("armR", [0, 0.18, 0.32, 0.5], [[-0.3, 0, -0.1], [-2.4, 0, -0.1], [0.6, 0, -0.1], [-0.3, 0, -0.1]]),
    qTrack("torso", [0, 0.18, 0.32, 0.5], [[0, 0, 0], [0, -0.3, 0], [0, 0.2, 0], [0, 0, 0]]),
  ]);

  // CAST — both arms raise, staff forward
  clips.cast = new THREE.AnimationClip("cast", 0.6, [
    qTrack("armR", [0, 0.25, 0.6], [[-0.3, 0, -0.1], [-1.7, 0, -0.1], [-0.3, 0, -0.1]]),
    qTrack("armL", [0, 0.25, 0.6], [[0, 0, 0.12], [-1.4, 0, 0.3], [0, 0, 0.12]]),
    posTrack("pelvis", [0, 0.25, 0.6], [0.9, 0.86, 0.9]),
  ]);

  return clips;
}
