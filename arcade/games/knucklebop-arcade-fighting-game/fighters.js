// Knucklebop fighters: six original toy-like brawlers built from three.js primitives, their move data and their animation.
import { THREE, rounded } from './kit/hc.js';

// ---------------------------------------------------------------- frame data (60 fps frames; distances in metres)
// s = startup, a = active, r = recovery, hs = hitstun, bs = blockstun, reach = hitbox length in front, hy = hitbox height
export const NORMALS = {
  P: { name: 'Jab', anim: 'jab', s: 4, a: 3, r: 8, dmg: 48, hs: 16, bs: 10, reach: 0.95, hy: 1.35, lvl: 'mid', push: 0.06, cancel: ['P', 'K', 'S', 'SUP'] },
  K: { name: 'Kick', anim: 'kick', s: 8, a: 4, r: 15, dmg: 84, hs: 20, bs: 12, reach: 1.3, hy: 1.0, lvl: 'mid', push: 0.1, cancel: ['S', 'SUP'], heavy: 1 },
  cP: { name: 'Low jab', anim: 'cjab', s: 4, a: 3, r: 8, dmg: 40, hs: 15, bs: 9, reach: 0.9, hy: 0.7, lvl: 'mid', push: 0.05, cancel: ['P', 'K', 'S', 'SUP'] },
  cK: { name: 'Sweep', anim: 'sweep', s: 9, a: 4, r: 20, dmg: 70, hs: 0, bs: 12, reach: 1.4, hy: 0.22, hh: 0.25, lvl: 'low', kd: 1, push: 0.05, cancel: ['SUP'] },
  jP: { name: 'Air punch', anim: 'jpunch', s: 4, a: 8, r: 3, dmg: 60, hs: 17, bs: 10, reach: 0.95, hy: 0.85, lvl: 'high', air: 1, push: 0.05 },
  T: { name: 'Throw', anim: 'grab', s: 3, a: 2, r: 22, grab: 1, dmg: 80, reach: 0.75, hy: 1.1, hh: 0.6 },
  jK: { name: 'Air kick', anim: 'jkick', s: 6, a: 10, r: 3, dmg: 76, hs: 19, bs: 11, reach: 1.2, hy: 0.55, lvl: 'high', air: 1, push: 0.06, heavy: 1 },
};

// specials: [neutral SP (or ↓→ P), forward SP (or ↓← P), up SP (or →↓→ P)], plus one super
export const FIGHTERS = [
  {
    id: 'rivet', w: 0.5, name: 'RIVET', icon: '🤖', style: 'Robot boxer', blurb: 'A wind-up boxing robot with rocket gloves. Balanced and honest.',
    stats: [3, 3, 3], walk: 0.05, jv: 0.2, jh: 0.06, hp: 1.0, pow: 1.0, reach: 1.0,
    col: { main: '#3ec1c9', sub: '#e3e9f1', dark: '#4a5568', acc: '#ffd23f', glove: '#ff4d5e' },
    alt: { main: '#ff8c42', sub: '#2b2d42', dark: '#1b1f2a', acc: '#7bf1a8', glove: '#3a86ff' },
    sp: [
      { name: 'Rocket Glove', anim: 'cast', s: 12, a: 1, r: 22, proj: { kind: 'glove', vx: 0.17, r: 0.3, dmg: 92, hs: 20, bs: 12, life: 90, color: '#ff4d5e' } },
      { name: 'Piston Rush', anim: 'dash', s: 7, a: 14, r: 16, vx: 0.17, dmg: 104, kd: 1, bs: 14, reach: 1.0, hy: 1.2, hh: 0.5, lvl: 'mid', push: 0.08, heavy: 1 },
      { name: 'Spring Uppercut', anim: 'upper', s: 3, a: 10, r: 24, inv: 9, rise: 0.25, vx: 0.03, dmg: 118, launch: 0.2, kd: 1, bs: 12, reach: 0.9, hy: 1.7, hh: 0.8, lvl: 'mid', heavy: 1 },
    ],
    sup: { name: 'Turbo Barrage', anim: 'dash', s: 4, a: 26, r: 22, vx: 0.2, dmg: 64, hits: 5, iv: 5, kd: 1, bs: 8, reach: 1.1, hy: 1.2, hh: 0.6, lvl: 'mid', inv: 6 },
  },
  {
    id: 'prickla', w: 0.55, name: 'PRICKLA', icon: '🌵', style: 'Cactus wrestler', blurb: 'Champion desert wrestler. Slow, tough, and her hugs really hurt.',
    stats: [5, 2, 4], walk: 0.04, jv: 0.185, jh: 0.05, hp: 1.15, pow: 1.1, reach: 1.05,
    col: { main: '#5cc75a', sub: '#3e9e45', belt: '#ffcc33', boot: '#e0445a', petal: '#ff6fae', spine: '#fff4d6' },
    alt: { main: '#9ad0ff', sub: '#5b8fd6', belt: '#ff8fc1', boot: '#2b2d42', petal: '#ffe14d', spine: '#ffffff' },
    sp: [
      { name: 'Thorn Volley', anim: 'cast', s: 13, a: 1, r: 22, proj: { kind: 'thorn', vx: 0.12, vy: 0.09, g: 0.0055, r: 0.3, dmg: 86, hs: 20, bs: 12, life: 120, color: '#7ee06a' } },
      { name: 'Bear Hug', anim: 'grab', s: 6, a: 4, r: 28, grab: 1, dmg: 120, reach: 0.85, hy: 1.1, hh: 0.6 },
      { name: 'Tumbleweed Roll', anim: 'roll', s: 8, a: 20, r: 14, vx: 0.15, dmg: 96, kd: 1, bs: 14, reach: 0.9, hy: 0.5, hh: 0.5, lvl: 'low' },
    ],
    sup: { name: 'Cactus Crush', anim: 'grab', s: 4, a: 6, r: 34, grab: 1, dmg: 230, reach: 1.25, hy: 1.1, hh: 0.7 },
  },
  {
    id: 'kobi', w: 0.45, name: 'KOBI', icon: '🦝', style: 'Ninja raccoon', blurb: 'A night-shift ninja raccoon. Fast feet, acorn stars, light frame.',
    stats: [2, 5, 2], walk: 0.064, jv: 0.215, jh: 0.072, hp: 0.88, pow: 0.94, reach: 0.95,
    col: { main: '#9aa3ad', suit: '#353a48', mask: '#20232b', light: '#f4efe6', scarf: '#8b5cff' },
    alt: { main: '#d9a066', suit: '#2a5d4a', mask: '#3b2416', light: '#fff6e0', scarf: '#ff5d8f' },
    sp: [
      { name: 'Acorn Star', anim: 'cast', s: 9, a: 1, r: 16, proj: { kind: 'acorn', vx: 0.24, r: 0.22, dmg: 64, hs: 16, bs: 9, life: 60, color: '#c98a3c' } },
      { name: 'Shadow Step', anim: 'dash', s: 5, a: 12, r: 14, vx: 0.26, ghost: 1, inv: 14, dmg: 86, hs: 22, bs: 10, reach: 1.0, hy: 1.1, hh: 0.6, lvl: 'mid' },
      { name: 'Flip Kick', anim: 'flip', s: 3, a: 12, r: 22, inv: 8, rise: 0.23, vx: 0.05, dmg: 106, launch: 0.21, kd: 1, bs: 12, reach: 1.0, hy: 1.4, hh: 0.8 },
    ],
    sup: { name: 'Acorn Storm', anim: 'cast', s: 8, a: 1, r: 24, proj: { kind: 'bigacorn', vx: 0.2, r: 0.5, dmg: 70, hits: 5, iv: 5, kdEnd: 1, hs: 16, bs: 8, life: 80, color: '#ffb84d' } },
  },
  {
    id: 'mochibo', w: 0.62, name: 'MOCHIBO', icon: '🍮', style: 'Jelly monk', blurb: 'A calm jelly monk who wobbles off hits and answers with a palm.',
    stats: [3, 2, 5], walk: 0.04, jv: 0.19, jh: 0.055, hp: 1.2, pow: 1.0, reach: 1.0,
    col: { main: '#ff8fc1', core: '#ffd1e6', sash: '#ff9f1c', beads: '#8b5a2b', cheek: '#ff5d8f' },
    alt: { main: '#7fe0c4', core: '#d8fff2', sash: '#7b5cff', beads: '#2b2d42', cheek: '#3ab795' },
    sp: [
      { name: 'Bubble Orb', anim: 'cast', s: 14, a: 1, r: 24, proj: { kind: 'bubble', vx: 0.085, r: 0.45, dmg: 56, hits: 2, iv: 10, hs: 18, bs: 10, life: 160, color: '#ffb3d9' } },
      { name: 'Jelly Bounce', anim: 'slam', s: 4, a: 34, r: 16, rise: 0.22, vx: 0.075, slam: 1, dmg: 116, kd: 1, bs: 14, reach: 1.0, hy: 0.4, hh: 0.5, lvl: 'high', heavy: 1 },
      { name: 'Calm Palm', anim: 'counter', s: 2, a: 26, r: 16, counter: { dmg: 125 } },
    ],
    sup: { name: 'Big Wobble', anim: 'wave', s: 10, a: 12, r: 24, wave: 1, dmg: 86, hits: 4, iv: 3, kd: 1, bs: 10, reach: 2.6, hy: 0.9, hh: 1.0, lvl: 'mid', inv: 10 },
  },
  {
    id: 'fjord', w: 0.52, name: 'GRAN FJORD', icon: '👵', style: 'Viking grandma', blurb: 'Retired sea raider. Shield, rolling pin, and a knitting lasso.',
    stats: [4, 3, 3], walk: 0.045, jv: 0.19, jh: 0.055, hp: 1.05, pow: 1.05, reach: 1.1,
    col: { main: '#8e5cd9', sub: '#ffcf5a', skin: '#ffd7ba', hair: '#eceaf4', metal: '#c7ccd6', horn: '#fff3d6', wood: '#b5793f' },
    alt: { main: '#2a9d8f', sub: '#ff6b6b', skin: '#f1c19a', hair: '#ffd6a5', metal: '#ffd23f', horn: '#ffffff', wood: '#7a4b2a' },
    sp: [
      { name: 'Rolling Pin', anim: 'cast', s: 12, a: 1, r: 20, proj: { kind: 'pin', vx: 0.14, vy: 0.11, g: 0.0065, r: 0.3, dmg: 92, hs: 20, bs: 12, life: 120, color: '#d9a066' } },
      { name: 'Shield Charge', anim: 'dash', s: 8, a: 16, r: 16, vx: 0.15, armor: 1, dmg: 106, kd: 1, bs: 14, reach: 1.0, hy: 1.0, hh: 0.6, lvl: 'mid', heavy: 1 },
      { name: 'Knit Snare', anim: 'grab', s: 9, a: 5, r: 28, grab: 1, dmg: 105, reach: 1.5, hy: 1.1, hh: 0.6 },
    ],
    sup: { name: 'Saga Swing', anim: 'upper', s: 4, a: 18, r: 26, inv: 12, rise: 0.27, vx: 0.06, dmg: 76, hits: 4, iv: 4, launch: 0.24, kd: 1, bs: 10, reach: 1.2, hy: 1.5, hh: 1.0 },
  },
  {
    id: 'zappo', w: 0.52, name: 'ZAPPO', icon: '🐙', style: 'Lightning octopus', blurb: 'A storm-charged octopus with eight long reaches. The ladder boss.',
    stats: [3, 4, 3], walk: 0.052, jv: 0.21, jh: 0.065, hp: 0.95, pow: 1.0, reach: 1.15, locked: 1,
    col: { main: '#4f7cff', sub: '#3a5bd9', bolt: '#ffd23f', glass: '#7ff6ff', dark: '#22264a' },
    alt: { main: '#ff5d8f', sub: '#d63d72', bolt: '#7bf1a8', glass: '#fff6a8', dark: '#3a1f2b' },
    sp: [
      { name: 'Zap Ball', anim: 'cast', s: 11, a: 1, r: 20, proj: { kind: 'zap', vx: 0.16, r: 0.3, dmg: 86, hs: 20, bs: 12, life: 90, color: '#ffe14d' } },
      { name: 'Ink Dash', anim: 'dash', s: 6, a: 14, r: 14, vx: 0.2, dmg: 90, kd: 1, bs: 12, reach: 1.0, hy: 0.8, hh: 0.7, lvl: 'low' },
      { name: 'Spark Spin', anim: 'spin', s: 3, a: 16, r: 22, inv: 7, rise: 0.2, vx: 0.03, dmg: 46, hits: 3, iv: 5, launch: 0.18, kd: 1, bs: 8, reach: 1.0, hy: 1.3, hh: 0.9 },
    ],
    sup: { name: 'Thunder Line', anim: 'cast', s: 12, a: 16, r: 22, beam: 1, dmg: 58, hits: 5, iv: 3, kd: 1, bs: 8, reach: 5.2, hy: 1.2, hh: 0.35, lvl: 'mid' },
  },
];

const DMG = 2.0;   // global damage scale: short, punchy phone rounds
/** per-fighter move objects (scaled by power / reach); identity matters (f.mv.P === f.move) */
export function moveSet(def) {
  const pw = def.pow * DMG;
  const sc = (m, reachScale) => ({
    ...m, dmg: m.dmg ? Math.round(m.dmg * pw) : 0, reach: m.reach ? m.reach * (reachScale ? def.reach : 1) : 0,
    proj: m.proj ? { ...m.proj, dmg: Math.round(m.proj.dmg * pw) } : null,
    counter: m.counter ? { dmg: Math.round(m.counter.dmg * pw) } : null,
  });
  const N = NORMALS;
  return {
    P: sc(N.P, 1), K: sc(N.K, 1), T: sc(N.T, 0), cP: sc(N.cP, 1), cK: sc(N.cK, 1), jP: sc(N.jP, 1), jK: sc(N.jK, 1),
    sp: def.sp.map(m => ({ ...sc(m), special: 1 })), sup: { ...sc(def.sup), special: 1, super: 1 },
  };
}

// ---------------------------------------------------------------- models
const G = {
  sph: (r, w = 18, h = 14) => new THREE.SphereGeometry(r, w, h),
  cap: (r, l) => new THREE.CapsuleGeometry(r, l, 5, 12),
  cyl: (a, b, h, s = 16) => new THREE.CylinderGeometry(a, b, h, s),
  cone: (r, h, s = 12) => new THREE.ConeGeometry(r, h, s),
  tor: (r, t, a = 10, b = 28) => new THREE.TorusGeometry(r, t, a, b),
  box: (w, h, d, r = 0.06) => rounded(w, h, d, r),
};
function maker(mats) {
  const M = (c, o = {}) => {
    const key = c + JSON.stringify(o);
    if (!mats[key]) mats[key] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.42, metalness: 0.05, ...o });
    return mats[key];
  };
  const add = (parent, geo, c, p = [0, 0, 0], r = [0, 0, 0], s = 1, o) => {
    const m = new THREE.Mesh(geo, M(c, o)); m.position.set(...p); m.rotation.set(...r);
    if (typeof s === 'number') m.scale.setScalar(s); else m.scale.set(...s);
    m.castShadow = true; parent.add(m); return m;
  };
  return { M, add };
}
function skeleton(hip) {
  const root = new THREE.Group(), tilt = new THREE.Group(), rig = new THREE.Group(), up = new THREE.Group();
  root.add(tilt); tilt.position.y = 1; tilt.add(rig); rig.position.y = -1; rig.add(up); up.position.y = hip;
  return { root, tilt, rig, up };
}
const pivot = (parent, x, y, z = 0) => { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; };
function eyes(add, head, y, z, spread, r, white = '#ffffff', pupil = '#1b1b2a') {
  for (const s of [-1, 1]) {
    add(head, G.sph(r, 14, 10), white, [s * spread, y, z]);
    add(head, G.sph(r * 0.55, 12, 8), pupil, [s * spread, y, z + r * 0.62]);
    add(head, G.sph(r * 0.18, 8, 6), '#ffffff', [s * spread + r * 0.18, y + r * 0.2, z + r * 0.95]);
  }
}

const BUILD = {
  rivet(c) {
    const mats = {}, { add } = maker(mats), k = skeleton(0.62), { up, rig } = k;
    add(up, G.box(0.86, 0.72, 0.58, 0.14), c.main, [0, 0.42, 0]);
    add(up, G.box(0.46, 0.3, 0.1, 0.05), c.acc, [0, 0.45, 0.29]);
    add(up, G.cyl(0.07, 0.07, 0.06, 12), c.dark, [0, 0.45, 0.35], [Math.PI / 2, 0, 0]);
    add(up, G.box(0.7, 0.14, 0.5, 0.06), c.dark, [0, 0.04, 0]);
    const head = pivot(up, 0, 1.0);
    add(head, G.box(0.66, 0.54, 0.56, 0.15), c.sub, [0, 0, 0], [0, 0, 0], 1, { metalness: 0.25, roughness: 0.3 });
    add(head, G.box(0.54, 0.22, 0.08, 0.05), '#1b2333', [0, 0.03, 0.27], [0, 0, 0], 1, { roughness: 0.12 });
    for (const s of [-1, 1]) {
      add(head, G.sph(0.06, 12, 8), '#5ff3ff', [s * 0.13, 0.04, 0.32], [0, 0, 0], 1, { emissive: '#3de8ff', emissiveIntensity: 1.3 });
      add(head, G.box(0.08, 0.22, 0.22, 0.03), c.dark, [s * 0.35, 0, 0]);
    }
    add(head, G.cyl(0.025, 0.025, 0.25, 8), c.dark, [0.14, 0.38, 0]); add(head, G.sph(0.065), c.glove, [0.14, 0.52, 0]);
    const armF = pivot(up, -0.52, 0.62), armB = pivot(up, 0.52, 0.62);
    for (const p of [armF, armB]) {
      add(p, G.sph(0.15), c.sub, [0, 0, 0], [0, 0, 0], 1, { metalness: 0.25, roughness: 0.3 });
      add(p, G.cyl(0.075, 0.075, 0.32, 10), c.dark, [0, -0.2, 0]);
      add(p, G.cyl(0.15, 0.15, 0.09, 14), '#ffffff', [0, -0.33, 0]);
      add(p, G.sph(0.24), c.glove, [0, -0.5, 0.02], [0, 0, 0], [1, 1, 1.1], { roughness: 0.25 });
    }
    const legF = pivot(rig, -0.2, 0.62), legB = pivot(rig, 0.2, 0.62);
    for (const p of [legF, legB]) { add(p, G.cyl(0.1, 0.1, 0.42, 10), c.dark, [0, -0.24, 0]); add(p, G.box(0.28, 0.16, 0.42, 0.06), c.main, [0, -0.54, 0.06]); }
    return { ...k, head, armF, armB, legF, legB, mats };
  },
  prickla(c) {
    const mats = {}, { add } = maker(mats), k = skeleton(0.55), { up, rig } = k;
    add(up, G.cap(0.46, 0.55), c.main, [0, 0.64, 0]);
    for (const a of [-1.2, -0.6, 0, 0.6, 1.2, 2.2, -2.2]) add(up, G.cap(0.055, 0.62), c.sub, [Math.sin(a) * 0.44, 0.64, Math.cos(a) * 0.44]);
    for (const [a, y] of [[-0.9, 0.95], [0.9, 0.95], [-0.3, 0.45], [0.35, 0.5], [1.5, 0.7], [-1.5, 0.7], [2.6, 0.9], [-2.6, 0.5]]) {
      const g = pivot(up, 0, y); g.rotation.y = a; add(g, G.cone(0.035, 0.16, 6), c.spine, [0, 0, 0.48], [Math.PI / 2, 0, 0]);
    }
    add(up, G.tor(0.47, 0.075), c.belt, [0, 0.2, 0], [Math.PI / 2, 0, 0], 1, { metalness: 0.4, roughness: 0.25 });
    add(up, G.cyl(0.14, 0.14, 0.07, 18), c.belt, [0, 0.2, 0.48], [Math.PI / 2, 0, 0], 1, { metalness: 0.5, roughness: 0.2 });
    add(up, G.sph(0.06), c.petal, [0, 0.2, 0.52]);
    const head = pivot(up, 0, 0.9);
    eyes(add, head, 0.12, 0.38, 0.15, 0.085);
    for (const s of [-1, 1]) add(head, G.cap(0.035, 0.12), '#3b2a20', [s * 0.08, -0.06, 0.45], [0, 0, s * 1.2]);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; add(head, G.sph(0.09, 10, 8), c.petal, [Math.cos(a) * 0.11, 0.62, Math.sin(a) * 0.11], [0, 0, 0], [1, 0.6, 1]); }
    add(head, G.sph(0.07), '#ffd23f', [0, 0.66, 0]);
    const armF = pivot(up, -0.5, 0.75), armB = pivot(up, 0.5, 0.75);
    for (const p of [armF, armB]) { add(p, G.cap(0.12, 0.3), c.main, [0, -0.25, 0]); add(p, G.sph(0.15), c.main, [0, -0.5, 0]); add(p, G.cyl(0.13, 0.13, 0.08, 12), c.boot, [0, -0.36, 0]); }
    const legF = pivot(rig, -0.22, 0.55), legB = pivot(rig, 0.22, 0.55);
    for (const p of [legF, legB]) { add(p, G.cap(0.13, 0.18), c.main, [0, -0.2, 0]); add(p, G.box(0.3, 0.18, 0.42, 0.07), c.boot, [0, -0.46, 0.05]); }
    return { ...k, head, armF, armB, legF, legB, mats };
  },
  kobi(c) {
    const mats = {}, { add } = maker(mats), k = skeleton(0.6), { up, rig } = k;
    add(up, G.cap(0.3, 0.32), c.suit, [0, 0.42, 0]);
    add(up, G.tor(0.3, 0.06), c.scarf, [0, 0.18, 0], [Math.PI / 2, 0, 0]);
    add(up, G.tor(0.2, 0.08), c.scarf, [0, 0.78, 0], [Math.PI / 2, 0, 0]);
    add(up, G.cap(0.05, 0.3), c.scarf, [0.12, 0.6, -0.22], [0.9, 0, 0.3]);
    const head = pivot(up, 0, 1.06);
    add(head, G.sph(0.36, 22, 16), c.main);
    add(head, G.sph(0.365, 22, 16), c.mask, [0, 0.04, 0.0], [0, 0, 0], [1, 0.34, 1]);
    eyes(add, head, 0.05, 0.29, 0.14, 0.08);
    add(head, G.sph(0.17), c.light, [0, -0.12, 0.27], [0, 0, 0], [1, 0.72, 0.85]);
    add(head, G.sph(0.055), '#1b1b2a', [0, -0.07, 0.42]);
    for (const s of [-1, 1]) { add(head, G.cone(0.12, 0.24, 10), c.main, [s * 0.22, 0.32, -0.02], [0, 0, -s * 0.35]); add(head, G.cone(0.06, 0.12, 8), c.mask, [s * 0.22, 0.31, 0.04], [0, 0, -s * 0.35]); }
    add(head, G.tor(0.34, 0.035), c.scarf, [0, 0.16, 0], [Math.PI / 2 - 0.15, 0, 0]);
    const tail = pivot(up, 0, 0.05, -0.26);
    for (let i = 0; i < 6; i++) add(tail, G.sph(0.15 - i * 0.008, 12, 10), i % 2 ? c.mask : c.main, [0, i * 0.08, -0.08 - i * 0.12]);
    const armF = pivot(up, -0.36, 0.66), armB = pivot(up, 0.36, 0.66);
    for (const p of [armF, armB]) { add(p, G.cap(0.075, 0.26), c.suit, [0, -0.18, 0]); add(p, G.sph(0.11), c.main, [0, -0.4, 0]); }
    const legF = pivot(rig, -0.16, 0.6), legB = pivot(rig, 0.16, 0.6);
    for (const p of [legF, legB]) { add(p, G.cap(0.095, 0.28), c.suit, [0, -0.25, 0]); add(p, G.sph(0.13), c.main, [0, -0.52, 0.06], [0, 0, 0], [1, 0.6, 1.3]); }
    return { ...k, head, armF, armB, legF, legB, mats, tail };
  },
  mochibo(c) {
    const mats = {}, { add } = maker(mats), k = skeleton(0.3), { up, rig } = k;
    const blob = add(up, G.sph(0.66, 30, 22), c.main, [0, 0.56, 0], [0, 0, 0], [1.05, 0.96, 0.95], { transparent: true, opacity: 0.88, roughness: 0.1, metalness: 0.0 });
    add(up, G.sph(0.28), c.core, [0, 0.5, 0], [0, 0, 0], 1, { transparent: true, opacity: 0.7, emissive: c.core, emissiveIntensity: 0.25 });
    add(up, G.tor(0.62, 0.075), c.sash, [0, 0.36, 0], [Math.PI / 2 + 0.25, 0, 0.3]);
    add(up, G.tor(0.38, 0.05, 8, 24), c.beads, [0, 1.0, 0.04], [Math.PI / 2 + 0.45, 0, 0]);
    const head = pivot(up, 0, 0.78);
    eyes(add, head, 0.14, 0.55, 0.19, 0.09);
    for (const s of [-1, 1]) add(head, G.sph(0.09), c.cheek, [s * 0.34, 0.0, 0.5], [0, 0, 0], [1, 0.55, 0.4]);
    add(head, new THREE.TorusGeometry(0.06, 0.02, 6, 12, Math.PI), '#7a2a4a', [0, -0.04, 0.62], [0, 0, Math.PI]);
    add(head, G.sph(0.14), c.core, [0, 0.66, -0.02], [0, 0, 0], 1, { transparent: true, opacity: 0.9 });
    add(head, G.tor(0.11, 0.035), c.sash, [0, 0.6, -0.02], [Math.PI / 2, 0, 0]);
    const armF = pivot(up, -0.62, 0.6), armB = pivot(up, 0.62, 0.6);
    for (const p of [armF, armB]) { add(p, G.cap(0.12, 0.18), c.main, [0, -0.17, 0], [0, 0, 0], 1, { transparent: true, opacity: 0.9, roughness: 0.1 }); add(p, G.sph(0.14), c.core, [0, -0.36, 0]); }
    const legF = pivot(rig, -0.26, 0.3), legB = pivot(rig, 0.26, 0.3);
    for (const p of [legF, legB]) add(p, G.sph(0.18), c.main, [0, -0.2, 0.05], [0, 0, 0], [1, 0.6, 1.25], { transparent: true, opacity: 0.92, roughness: 0.1 });
    k.root.scale.setScalar(1.14);
    return { ...k, head, armF, armB, legF, legB, mats, blob };
  },
  fjord(c) {
    const mats = {}, { add } = maker(mats), k = skeleton(0.5), { up, rig } = k;
    add(up, G.cyl(0.27, 0.52, 0.86, 22), c.main, [0, 0.3, 0]);
    add(up, G.box(0.42, 0.5, 0.06, 0.03), '#ffffff', [0, 0.18, 0.37], [-0.26, 0, 0]);
    add(up, G.tor(0.24, 0.09), c.sub, [0, 0.72, 0], [Math.PI / 2, 0, 0]);
    const head = pivot(up, 0, 1.08);
    add(head, G.sph(0.3, 22, 16), c.skin);
    add(head, G.sph(0.31, 22, 16), c.hair, [0, 0.03, -0.06]);
    add(head, G.sph(0.14), c.hair, [0, 0.22, -0.24]);
    for (const s of [-1, 1]) {
      add(head, G.cap(0.07, 0.3), c.hair, [s * 0.25, -0.28, -0.04]);
      add(head, G.sph(0.06), c.sub, [s * 0.25, -0.5, -0.04]);
      add(head, G.cone(0.07, 0.32, 10), c.horn, [s * 0.32, 0.26, 0], [0, 0, -s * 0.9]);
      add(head, G.tor(0.075, 0.016, 6, 16), '#3b2a20', [s * 0.11, 0.02, 0.28]);
      add(head, G.sph(0.035), '#1b1b2a', [s * 0.11, 0.02, 0.27]);
      add(head, G.sph(0.06), '#ff9aa8', [s * 0.18, -0.09, 0.22], [0, 0, 0], [1, 0.6, 0.5]);
    }
    add(head, G.sph(0.06), c.skin, [0, -0.05, 0.3]);
    add(head, new THREE.SphereGeometry(0.335, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2), c.metal, [0, 0.06, 0], [0, 0, 0], 1, { metalness: 0.5, roughness: 0.25 });
    add(head, G.tor(0.33, 0.035), c.metal, [0, 0.07, 0], [Math.PI / 2, 0, 0], 1, { metalness: 0.5, roughness: 0.25 });
    const armF = pivot(up, -0.32, 0.66), armB = pivot(up, 0.32, 0.66);
    for (const p of [armF, armB]) { add(p, G.cap(0.09, 0.24), c.main, [0, -0.18, 0]); add(p, G.sph(0.1), c.skin, [0, -0.4, 0]); }
    add(armF, G.cyl(0.055, 0.055, 0.46, 10), c.wood, [0, -0.42, 0.06], [Math.PI / 2, 0, 0]);
    add(armB, G.cyl(0.34, 0.34, 0.06, 22), c.wood, [0.12, -0.32, 0], [0, 0, Math.PI / 2]);
    add(armB, G.sph(0.09), c.metal, [0.16, -0.32, 0], [0, 0, 0], 1, { metalness: 0.5, roughness: 0.25 });
    add(armB, G.tor(0.33, 0.03), c.metal, [0.14, -0.32, 0], [0, Math.PI / 2, 0], 1, { metalness: 0.5 });
    const legF = pivot(rig, -0.15, 0.5), legB = pivot(rig, 0.15, 0.5);
    for (const p of [legF, legB]) { add(p, G.cyl(0.07, 0.07, 0.36, 10), c.skin, [0, -0.24, 0]); add(p, G.box(0.22, 0.12, 0.32, 0.05), '#6b3e26', [0, -0.44, 0.05]); }
    return { ...k, head, armF, armB, legF, legB, mats };
  },
  zappo(c) {
    const mats = {}, { add } = maker(mats), k = skeleton(0.5), { up, rig } = k;
    add(up, G.sph(0.36), c.main, [0, 0.36, 0]);
    const head = pivot(up, 0, 0.98);
    add(head, G.sph(0.54, 26, 20), c.main, [0, 0, 0], [0, 0, 0], [1, 1.08, 1]);
    for (const [x, y, z, r] of [[-0.18, 0.32, 0.4, 0.6], [0, 0.24, 0.46, -0.6], [0.18, 0.16, 0.42, 0.6], [-0.42, 0.1, 0.18, 0.4], [0.44, 0.22, 0.1, -0.5]])
      add(head, G.box(0.22, 0.07, 0.07, 0.02), c.bolt, [x, y, z], [-0.5, Math.atan2(x, z) * 0.6, r], 1, { emissive: c.bolt, emissiveIntensity: 0.35 });
    for (const s of [-1, 1]) {
      add(head, G.cyl(0.15, 0.15, 0.08, 18), c.dark, [s * 0.18, -0.02, 0.48], [Math.PI / 2, 0, 0]);
      add(head, G.sph(0.12, 14, 10), c.glass, [s * 0.18, -0.02, 0.5], [0, 0, 0], [1, 1, 0.5], { transparent: true, opacity: 0.55, roughness: 0.05 });
      add(head, G.sph(0.06), '#1b1b2a', [s * 0.18, -0.02, 0.53]);
    }
    add(head, G.tor(0.53, 0.04), c.dark, [0, -0.02, 0], [Math.PI / 2 + 0.05, 0, 0]);
    const skirt = pivot(up, 0, 0.1);
    for (let i = 0; i < 4; i++) { const g = pivot(skirt, 0, 0); g.rotation.y = i / 4 * Math.PI * 2 + 0.4; add(g, G.cap(0.08, 0.3), c.sub, [0, -0.12, 0.3], [0.7, 0, 0]); }
    const armF = pivot(up, -0.4, 0.5), armB = pivot(up, 0.4, 0.5);
    for (const p of [armF, armB]) { add(p, G.cap(0.085, 0.36), c.main, [0, -0.24, 0]); add(p, G.sph(0.11), c.sub, [0, -0.48, 0.04]); add(p, G.sph(0.035), c.bolt, [0, -0.3, 0.08]); }
    const legF = pivot(rig, -0.17, 0.5), legB = pivot(rig, 0.17, 0.5);
    for (const p of [legF, legB]) { add(p, G.cap(0.1, 0.28), c.main, [0, -0.24, 0]); add(p, G.sph(0.12), c.sub, [0, -0.44, 0.08], [0, 0, 0], [1, 0.7, 1.3]); }
    return { ...k, head, armF, armB, legF, legB, mats, skirt };
  },
};

export function buildModel(def, alt = false) {
  const m = BUILD[def.id](alt ? def.alt : def.col);
  m.mlist = Object.values(m.mats);
  m.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  m.cur = { lean: 0, hy: 0, aF: 0, aB: 0, zF: 0, zB: 0, lF: 0, lB: 0, sq: 1, tz: 0, spin: 0, hd: 0 };
  return m;
}

// ---------------------------------------------------------------- animation (procedural poses)
const ease = (a, b, k) => a + (b - a) * k;
export function animate(M, f, time, dt) {
  const T = { lean: 0, hy: 0, aF: -1.0, aB: -0.7, zF: 0.15, zB: -0.15, lF: 0, lB: 0, sq: 1, tz: 0, spin: 0, hd: 0 };
  let snap = 0.3, tzAbs = null;
  const m = f.move, st = f.st;
  const e = m ? (f.mt < m.s ? f.mt / m.s : f.mt < m.s + m.a ? 1 : Math.max(0, 1 - (f.mt - m.s - m.a) / Math.max(1, m.r))) : 0;
  if (st === 'stand') {
    const walking = Math.abs(f.vx) > 0.004;
    if (walking) { const w = Math.sin(time * 11); T.lF = w * 0.6; T.lB = -w * 0.6; T.aF = -1.0 + w * 0.25; T.aB = -0.7 - w * 0.25; T.hy = Math.abs(w) * 0.04; T.lean = Math.sign(f.vx) === f.face ? 0.12 : -0.08; }
    else { T.hy = Math.sin(time * 4.5) * 0.03; T.sq = 1 + Math.sin(time * 4.5) * 0.015; }
  } else if (st === 'crouch') { T.sq = 0.72; T.aF = -1.1; T.aB = -0.8; T.lean = 0.2; }
  else if (st === 'jump') { T.lF = -0.9; T.lB = -0.35; T.aF = -2.0; T.aB = -1.6; T.sq = 1.04; }
  else if (st === 'land') { T.sq = 0.8; snap = 0.5; }
  else if (st === 'block') { T.aF = -1.35; T.aB = -1.35; T.zF = -0.35; T.zB = 0.35; T.lean = -0.12; T.sq = f.in.d ? 0.72 : 1; snap = 0.5; }
  else if (st === 'hit') { T.lean = -0.45; T.hd = -0.4; T.aF = -0.3; T.aB = -0.2; T.sq = 0.94; snap = 0.6; }
  else if (st === 'air' || st === 'ko') { tzAbs = f.face * (0.6 + (f.t * 0.16)); T.aF = -2.4; T.aB = -2.2; T.lF = -0.5; snap = 0.4; }
  else if (st === 'down') { tzAbs = f.face * 1.5; T.aF = -2.8; T.aB = -2.6; snap = 0.3; }
  else if (st === 'rise') { tzAbs = f.face * 1.5 * Math.max(0, 1 - f.t / 10); T.sq = 0.85; snap = 0.4; }
  else if (st === 'grabbed') { T.lean = -0.3; T.aF = -2.5; T.aB = -2.5; }
  else if (st === 'win') { const b = Math.abs(Math.sin(time * 6)); T.aF = -2.9; T.aB = -2.9 + b * 0.3; T.zF = 0.3; T.zB = -0.3; T.hy = b * 0.12; T.sq = 1 + b * 0.05; }
  else if (st === 'attack' && m) {
    snap = 0.55;
    switch (m.anim) {
      case 'jab': T.aF = -0.6 - 1.05 * e; T.zF = 0.05; T.lean = 0.18 * e; T.aB = -1.1; break;
      case 'kick': T.lF = -1.65 * e; T.lean = -0.28 * e; T.aF = -0.7; T.aB = -0.4; break;
      case 'cjab': T.sq = 0.72; T.aF = -0.6 - 1.0 * e; T.lean = 0.25; break;
      case 'sweep': T.sq = 0.6; T.lF = -1.55 * e; T.spin = -0.5 * e; T.aF = -0.4; T.aB = 0.3; break;
      case 'jpunch': T.aF = -0.8 - 0.7 * e; T.zF = -0.5 * e; T.lF = -0.8; T.lB = -0.6; T.lean = 0.35 * e; break;
      case 'jkick': T.lF = -1.4 * e; T.lB = -0.5; T.lean = -0.2; T.aF = -1.8; T.aB = -1.4; break;
      case 'upper': T.aF = -0.6 - 2.5 * e; T.aB = -0.8; T.sq = 1 + 0.15 * e; T.lean = -0.05; T.lF = -0.5 * e; break;
      case 'flip': T.lF = -1.6 * e; T.aF = -2.2; T.aB = -2.2; if (f.mt >= m.s && f.mt < m.s + m.a + 6) tzAbs = f.face * Math.PI * 2 * Math.min(1, (f.mt - m.s) / (m.a + 6)); break;
      case 'dash': T.lean = 0.55 * e; T.aF = -1.55 * e - 0.2; T.aB = -1.4 * e - 0.2; T.lF = -0.6 * e; T.lB = 0.4 * e; if (f.move.hits > 1) T.aF += Math.sin(time * 50) * 0.35; break;
      case 'cast': T.aF = -0.4 - 1.25 * e; T.aB = -0.4 - 1.25 * e; T.zF = -0.15; T.zB = 0.15; T.lean = 0.25 * e - (f.mt < m.s ? 0.2 : 0); break;
      case 'grab': T.aF = -1.4 * e; T.aB = -1.4 * e; T.zF = -0.45 * e; T.zB = 0.45 * e; T.lean = f.mt > m.s + m.a ? -0.45 : 0.25; break;
      case 'roll': T.sq = 0.75; T.aF = -2.4; T.aB = -2.4; T.lF = -1.2; T.lB = -1.2; if (f.mt >= m.s && f.mt < m.s + m.a) tzAbs = -f.face * f.mt * 0.45; break;
      case 'spin': T.zF = 1.3; T.zB = -1.3; T.aF = -0.3; T.aB = -0.3; if (f.mt >= m.s && f.mt < m.s + m.a + 4) T.spin = f.mt * 0.9; break;
      case 'slam': T.sq = f.vy > 0 ? 1.12 : 0.85; T.aF = -2.8; T.aB = -2.8; T.lF = -0.7; T.lB = -0.7; break;
      case 'counter': T.aF = -1.3; T.aB = -1.3; T.zF = -0.55; T.zB = 0.55; T.lean = 0.05; T.sq = 0.95 + Math.sin(time * 20) * 0.02; if (f.countered) { T.aF = -1.7; T.lean = 0.35; T.zF = 0; } break;
      case 'wave': T.zF = 1.5 * e; T.zB = -1.5 * e; T.aF = -0.3; T.aB = -0.3; T.sq = 1 + 0.28 * e * (0.7 + 0.3 * Math.sin(time * 30)); break;
    }
  }
  const k = 1 - Math.pow(1 - snap, dt), C = M.cur;
  for (const key in T) C[key] = ease(C[key], T[key], k);
  M.up.rotation.x = C.lean; M.up.position.y = M.up.userData.hy0 === undefined ? (M.up.userData.hy0 = M.up.position.y) : M.up.userData.hy0;
  M.up.position.y = M.up.userData.hy0 + C.hy;
  M.armF.rotation.x = C.aF; M.armB.rotation.x = C.aB; M.armF.rotation.z = -C.zF; M.armB.rotation.z = -C.zB;
  M.legF.rotation.x = C.lF; M.legB.rotation.x = C.lB; M.head.rotation.x = C.hd;
  const sq = C.sq, side = 1 + (1 - sq) * 0.5;
  M.tilt.scale.set(side, sq, side);
  // facing: model +z turned toward the opponent, opened 0.5 rad toward the camera
  const want = (f.face > 0 ? Math.PI / 2 - 0.5 : -Math.PI / 2 + 0.5) + C.spin;
  M.rig.rotation.y = ease(M.rig.rotation.y, want, Math.min(1, 0.35 * dt));
  if (tzAbs !== null) M.tilt.rotation.z = ease(M.tilt.rotation.z, tzAbs, st === 'down' || st === 'rise' ? 0.25 : 0.5);
  else M.tilt.rotation.z = ease(M.tilt.rotation.z, 0, 0.3);
  const downAmt = Math.min(1, Math.abs(M.tilt.rotation.z) / 1.5) * (st === 'down' || st === 'rise' || (st === 'ko' && f.y <= 0) ? 1 : 0);
  M.tilt.position.y = 1 - downAmt * 0.7;
  // extras
  if (M.tail) { M.tail.rotation.y = Math.sin(time * 3) * 0.4; M.tail.rotation.x = 0.2 + Math.sin(time * 2.2) * 0.1; }
  if (M.skirt) M.skirt.rotation.y = Math.sin(time * 2.5) * 0.25;
  if (M.blob) { const w = Math.sin(time * 7) * 0.025 + (st === 'hit' ? Math.sin(time * 40) * 0.06 : 0); M.blob.scale.set(1.05 + w, 0.96 - w, 0.95 + w); }
  // hit flash
  const fl = f.flash > 0 ? 0.9 : 0, glow = f.meter >= 100 ? 0.12 + 0.1 * Math.sin(time * 10) : 0;
  for (const mt of M.mlist) { if (!mt.userData.e0) mt.userData.e0 = mt.emissive.clone(), mt.userData.ei = mt.emissiveIntensity;
    if (fl) { mt.emissive.set('#ffffff'); mt.emissiveIntensity = fl; }
    else if (glow) { mt.emissive.set('#ffd23f'); mt.emissiveIntensity = glow; }
    else { mt.emissive.copy(mt.userData.e0); mt.emissiveIntensity = mt.userData.ei; } }
}
